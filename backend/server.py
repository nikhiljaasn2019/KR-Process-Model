from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Load golden bands config
CONFIG_PATH = Path(__file__).parent.parent / 'config' / 'golden_bands.json'
with open(CONFIG_PATH, 'r') as f:
    GOLDEN_CONFIG = json.load(f)

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Pydantic Models
class ActionTrigger(BaseModel):
    metric: str
    golden_band: str
    current_value: str
    deviation: str
    time_window: str

class ActionCard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    protects: str
    trigger: ActionTrigger
    evidence: List[str]
    action_checklist: List[str]
    expected_effect: str
    status: str = "New"
    note: str = ""
    created_at: str = ""
    updated_at: str = ""

class ActionStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = ""

class DemoEventRequest(BaseModel):
    event_type: str
    duration_steps: Optional[int] = 4

class RunRecord(BaseModel):
    run_id: str
    start_ts: str
    end_ts: Optional[str]
    duration_days: int
    end_reason: str
    notes: str
    is_golden: bool = False
    is_current: bool = False

class MetricSnapshot(BaseModel):
    timestamp: str
    cw_inlet_temp: float
    inhibitor_continuity: float
    column_dp_index: float
    reactor_temp_oscillation: float
    aa_dimer: float
    mehq: float
    excursion_count: int

class DataFreshness(BaseModel):
    last_data_ts: str
    last_scoring_ts: str
    stale_metrics: List[str]
    flatline_flags: List[str]
    is_paused: bool
    confidence: str

# In-memory simulation state
class SimulationState:
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.current_run_start = datetime(2025, 1, 15, 8, 0, tzinfo=timezone.utc)
        self.simulated_time = datetime(2025, 1, 15, 8, 0, tzinfo=timezone.utc)
        self.current_day = 1
        self.is_paused = False
        self.last_update = datetime.now(timezone.utc)
        self.injected_events = []
        self.action_counter = 1
        self.actions = {}
        self.timeline_events = []
        self.metrics_history = []
        self.generate_initial_metrics()
        
    def generate_initial_metrics(self):
        # Generate initial stable metrics
        self.current_metrics = {
            "cw_inlet_temp": 27.8,
            "inhibitor_continuity": 99.8,
            "column_dp_index": 28,
            "reactor_temp_oscillation": 0.5,
            "aa_dimer": 0.22,
            "mehq": 195,
            "excursion_count": 1
        }
        self.metrics_history = [self._create_metric_snapshot()]
    
    def _create_metric_snapshot(self):
        return {
            "timestamp": self.simulated_time.isoformat(),
            "day": self.current_day,
            **self.current_metrics
        }
    
    def advance_time(self, hours: int = 6):
        if self.is_paused:
            return
        
        self.simulated_time += timedelta(hours=hours)
        self.current_day = (self.simulated_time - self.current_run_start).days + 1
        self.last_update = datetime.now(timezone.utc)
        
        # Natural metric drift
        self._apply_natural_drift()
        
        # Process injected events
        self._process_injected_events()
        
        # Record metrics
        self.metrics_history.append(self._create_metric_snapshot())
        if len(self.metrics_history) > 100:
            self.metrics_history = self.metrics_history[-100:]
    
    def _apply_natural_drift(self):
        # Small random variations (natural process noise)
        self.current_metrics["cw_inlet_temp"] += random.uniform(-0.1, 0.15)
        self.current_metrics["cw_inlet_temp"] = max(26.0, min(32.0, self.current_metrics["cw_inlet_temp"]))
        
        self.current_metrics["inhibitor_continuity"] += random.uniform(-0.1, 0.05)
        self.current_metrics["inhibitor_continuity"] = max(95.0, min(100.0, self.current_metrics["inhibitor_continuity"]))
        
        self.current_metrics["column_dp_index"] += random.uniform(-1, 2)
        self.current_metrics["column_dp_index"] = max(20, min(60, self.current_metrics["column_dp_index"]))
        
        self.current_metrics["reactor_temp_oscillation"] += random.uniform(-0.05, 0.08)
        self.current_metrics["reactor_temp_oscillation"] = max(0.2, min(1.5, self.current_metrics["reactor_temp_oscillation"]))
        
        self.current_metrics["aa_dimer"] += random.uniform(-0.01, 0.02)
        self.current_metrics["aa_dimer"] = max(0.15, min(0.50, self.current_metrics["aa_dimer"]))
        
        self.current_metrics["mehq"] += random.uniform(-3, 2)
        self.current_metrics["mehq"] = max(150, min(220, self.current_metrics["mehq"]))
        
        self.current_metrics["excursion_count"] = max(0, min(8, self.current_metrics["excursion_count"] + random.choice([-1, 0, 0, 1])))
    
    def _process_injected_events(self):
        remaining_events = []
        for event in self.injected_events:
            event["remaining_steps"] -= 1
            if event["remaining_steps"] > 0:
                remaining_events.append(event)
                self._apply_event_effect(event)
        self.injected_events = remaining_events
    
    def _apply_event_effect(self, event):
        if event["type"] == "cw_spike":
            self.current_metrics["cw_inlet_temp"] += 0.8
        elif event["type"] == "inhibitor_interruption":
            self.current_metrics["inhibitor_continuity"] -= 1.5
        elif event["type"] == "dimer_rise":
            self.current_metrics["aa_dimer"] += 0.04
        elif event["type"] == "dp_increase":
            self.current_metrics["column_dp_index"] += 4
    
    def inject_event(self, event_type: str, duration_steps: int = 4):
        event = {
            "type": event_type,
            "remaining_steps": duration_steps,
            "injected_at": self.simulated_time.isoformat(),
            "day": self.current_day
        }
        self.injected_events.append(event)
        
        # Add to timeline
        event_names = {
            "cw_spike": "CW Temperature Spike",
            "inhibitor_interruption": "Inhibitor Dosing Interruption",
            "dimer_rise": "AA Dimer Rise Detected",
            "dp_increase": "Column ΔP Increase"
        }
        self.timeline_events.append({
            "id": str(uuid.uuid4())[:8],
            "timestamp": self.simulated_time.isoformat(),
            "day": self.current_day,
            "event_type": event_type,
            "title": event_names.get(event_type, event_type),
            "description": f"Event detected at Day {self.current_day}",
            "triggered_actions": []
        })
        
        # Immediately apply first effect
        self._apply_event_effect(event)
        
        return event

sim_state = SimulationState()

# Historical runs data
HISTORICAL_RUNS = [
    {"run_id": "RUN-2024-06", "start_ts": "2024-06-01T08:00:00Z", "end_ts": "2024-06-25T14:30:00Z", "duration_days": 24, "end_reason": "Polymerization/Fouling", "notes": "Early fouling in column internals", "is_golden": False},
    {"run_id": "RUN-2024-07", "start_ts": "2024-07-05T08:00:00Z", "end_ts": "2024-08-18T10:00:00Z", "duration_days": 44, "end_reason": "Polymerization/Fouling", "notes": "Inhibitor supply issue mid-run", "is_golden": False},
    {"run_id": "RUN-2024-08", "start_ts": "2024-08-25T08:00:00Z", "end_ts": "2024-09-08T16:00:00Z", "duration_days": 14, "end_reason": "Planned Shutdown", "notes": "Scheduled turnaround", "is_golden": False},
    {"run_id": "RUN-2024-09", "start_ts": "2024-09-20T08:00:00Z", "end_ts": "2024-11-28T12:00:00Z", "duration_days": 69, "end_reason": "Polymerization/Fouling", "notes": "CW temperature issues in late run", "is_golden": False},
    {"run_id": "RUN-2024-12", "start_ts": "2024-12-02T17:20:00Z", "end_ts": "2025-03-23T07:06:00Z", "duration_days": 111, "end_reason": "Golden Run Candidate", "notes": "Baseline reference window: 02-Dec-2024 to 23-Mar-2025", "is_golden": True},
    {"run_id": "RUN-2025-04", "start_ts": "2025-04-01T08:00:00Z", "end_ts": "2025-04-22T14:00:00Z", "duration_days": 21, "end_reason": "Utilities Interruption", "notes": "Power grid issue caused emergency shutdown", "is_golden": False},
    {"run_id": "RUN-2025-05", "start_ts": "2025-05-01T08:00:00Z", "end_ts": "2025-06-28T10:00:00Z", "duration_days": 58, "end_reason": "Polymerization/Fouling", "notes": "Gradual ΔP buildup", "is_golden": False},
    {"run_id": "RUN-2025-07", "start_ts": "2025-07-10T08:00:00Z", "end_ts": "2025-08-25T16:00:00Z", "duration_days": 46, "end_reason": "Polymerization/Fouling", "notes": "Dimer levels exceeded limits", "is_golden": False},
    {"run_id": "RUN-2025-09", "start_ts": "2025-09-01T08:00:00Z", "end_ts": "2025-09-10T12:00:00Z", "duration_days": 9, "end_reason": "Planned Shutdown", "notes": "Catalyst replacement window", "is_golden": False},
    {"run_id": "RUN-2025-10", "start_ts": "2025-10-15T08:00:00Z", "end_ts": "2025-12-02T14:00:00Z", "duration_days": 48, "end_reason": "Polymerization/Fouling", "notes": "Reactor oscillation issues", "is_golden": False}
]

def get_phase(day: int) -> str:
    phases = GOLDEN_CONFIG["phases"]
    if day <= phases["early"]["end"]:
        return "early"
    elif day <= phases["mid"]["end"]:
        return "mid"
    return "late"

def get_metric_band(metric_key: str, phase: str) -> dict:
    return GOLDEN_CONFIG["metrics"][metric_key]["bands"][phase]

def check_deviations():
    """Check current metrics against golden bands and generate/update action cards"""
    phase = get_phase(sim_state.current_day)
    metrics = sim_state.current_metrics
    
    deviations = []
    
    for metric_key, metric_config in GOLDEN_CONFIG["metrics"].items():
        band = metric_config["bands"][phase]
        current_val = metrics.get(metric_key.replace("_", "_"), metrics.get(metric_key))
        
        if current_val is None:
            continue
            
        is_violated = False
        deviation_str = ""
        band_str = ""
        
        if "max" in band:
            if current_val > band["max"]:
                is_violated = True
                deviation_str = f"+{current_val - band['max']:.2f}"
                band_str = f"≤{band['max']}"
        if "min" in band:
            if current_val < band["min"]:
                is_violated = True
                deviation_str = f"{current_val - band['min']:.2f}"
                band_str = f"≥{band['min']}"
        
        if is_violated:
            deviations.append({
                "metric_key": metric_key,
                "metric_name": metric_config["name"],
                "unit": metric_config["unit"],
                "current_value": current_val,
                "band": band,
                "band_str": band_str,
                "deviation_str": deviation_str,
                "protects": metric_config["protects"],
                "action_template": metric_config["action_template"]
            })
    
    # Create action cards for new deviations
    for dev in deviations:
        existing_action = None
        for action_id, action in sim_state.actions.items():
            if action["trigger"]["metric"] == dev["metric_name"] and action["status"] not in ["Done", "Not feasible"]:
                existing_action = action
                break
        
        if not existing_action:
            action_id = f"AC-{sim_state.action_counter:03d}"
            sim_state.action_counter += 1
            
            # Format current value
            cv = dev['current_value']
            current_val_str = f"{cv:.2f}" if isinstance(cv, float) else str(cv)
            
            action = {
                "id": action_id,
                "title": dev["action_template"]["title"],
                "protects": dev["protects"],
                "trigger": {
                    "metric": dev["metric_name"],
                    "golden_band": f"{dev['band_str']} {dev['unit']}",
                    "current_value": f"{current_val_str} {dev['unit']}",
                    "deviation": dev["deviation_str"],
                    "time_window": "Last 6 hours"
                },
                "evidence": [
                    f"Current: {current_val_str} {dev['unit']}",
                    f"Golden band ({get_phase(sim_state.current_day)} phase): {dev['band_str']} {dev['unit']}",
                    f"Run day: {sim_state.current_day}"
                ],
                "action_checklist": dev["action_template"]["checklist"],
                "expected_effect": dev["action_template"]["expected_effect"].replace("{max}", str(dev['band'].get('max', ''))).replace("{min}", str(dev['band'].get('min', ''))),
                "status": "New",
                "note": "",
                "created_at": sim_state.simulated_time.isoformat(),
                "updated_at": sim_state.simulated_time.isoformat()
            }
            sim_state.actions[action_id] = action
    
    return deviations

def calculate_projections():
    """Calculate run-length projections based on current state"""
    golden_days = GOLDEN_CONFIG["projection_settings"]["golden_run_days"]
    current_day = sim_state.current_day
    
    # Base remaining days on golden target
    base_remaining = golden_days - current_day
    
    # Adjust based on active deviations
    active_actions = [a for a in sim_state.actions.values() if a["status"] not in ["Done", "Not feasible"]]
    deviation_penalty = len(active_actions) * 5
    
    # Calculate risk factors
    metrics = sim_state.current_metrics
    phase = get_phase(current_day)
    
    risk_score = 0
    risk_factors = []
    
    # CW temp risk
    cw_band = get_metric_band("cw_inlet_temp", phase)
    if metrics["cw_inlet_temp"] > cw_band["max"]:
        risk_score += 0.25
        risk_factors.append(f"CW inlet temp at {metrics['cw_inlet_temp']:.1f}°C (>{cw_band['max']}°C)")
    
    # ΔP index risk
    dp_band = get_metric_band("column_dp_index", phase)
    if metrics["column_dp_index"] > dp_band["max"]:
        risk_score += 0.30
        risk_factors.append(f"ΔP Index at {metrics['column_dp_index']:.0f} (>{dp_band['max']})")
    
    # Excursion risk
    exc_band = get_metric_band("excursion_count", phase)
    if metrics["excursion_count"] > exc_band["max"]:
        risk_score += 0.20
        risk_factors.append(f"Excursions at {metrics['excursion_count']}/24h (>{exc_band['max']})")
    
    # Inhibitor risk
    inh_band = get_metric_band("inhibitor_continuity", phase)
    if metrics["inhibitor_continuity"] < inh_band["min"]:
        risk_score += 0.35
        risk_factors.append(f"Inhibitor continuity at {metrics['inhibitor_continuity']:.1f}% (<{inh_band['min']}%)")
    
    # Calculate projected remaining days
    projected_remaining = max(5, base_remaining - deviation_penalty - int(risk_score * 20))
    projected_end = sim_state.simulated_time + timedelta(days=projected_remaining)
    
    # Date window (±3-7 days based on confidence)
    window_margin = 3 if risk_score < 0.3 else (5 if risk_score < 0.5 else 7)
    projected_end_early = projected_end - timedelta(days=window_margin)
    projected_end_late = projected_end + timedelta(days=window_margin)
    
    # Confidence level
    confidence = "High" if risk_score < 0.2 else ("Medium" if risk_score < 0.5 else "Low")
    
    # Risk of ending within windows
    risk_7d = min(95, max(5, int(risk_score * 100 + len(active_actions) * 5)))
    risk_14d = min(95, max(10, int(risk_7d * 1.3)))
    risk_30d = min(95, max(15, int(risk_7d * 1.8)))
    
    # Productivity risk
    dp_dev = max(0, metrics["column_dp_index"] - dp_band["max"]) / dp_band["max"]
    exc_dev = max(0, metrics["excursion_count"] - exc_band["max"]) / max(1, exc_band["max"])
    cw_dev = max(0, metrics["cw_inlet_temp"] - cw_band["max"]) / cw_band["max"]
    
    prod_score = dp_dev * 0.4 + exc_dev * 0.35 + cw_dev * 0.25
    productivity_status = "Stable" if prod_score < 0.15 else "At Risk"
    productivity_reason = ", ".join(risk_factors[:2]) if risk_factors else "All key metrics within golden bands"
    
    return {
        "golden_target_days": golden_days,
        "current_day": current_day,
        "projected_remaining_days": projected_remaining,
        "projected_total_days": current_day + projected_remaining,
        "projected_end_date": projected_end.strftime("%b %d"),
        "projected_end_window": f"{projected_end_early.strftime('%b %d')}–{projected_end_late.strftime('%b %d')}",
        "gap_to_golden": projected_remaining + current_day - golden_days,
        "confidence": confidence,
        "risk_7d": risk_7d,
        "risk_14d": risk_14d,
        "risk_30d": risk_30d,
        "productivity_status": productivity_status,
        "productivity_reason": productivity_reason,
        "risk_factors": risk_factors,
        "active_action_count": len(active_actions)
    }

def get_threats_and_actions():
    """Get top threats and recommended actions"""
    check_deviations()
    
    active_actions = [a for a in sim_state.actions.values() if a["status"] not in ["Done", "Not feasible"]]
    
    # Sort by severity (Run-length > Both > Productivity)
    priority_order = {"Both": 0, "Run-length": 1, "Productivity": 2}
    sorted_actions = sorted(active_actions, key=lambda x: priority_order.get(x["protects"], 3))
    
    threats = []
    for action in sorted_actions[:3]:
        threats.append({
            "metric": action["trigger"]["metric"],
            "current": action["trigger"]["current_value"],
            "band": action["trigger"]["golden_band"],
            "deviation": action["trigger"]["deviation"],
            "protects": action["protects"]
        })
    
    return {
        "threats": threats,
        "actions": sorted_actions[:3]
    }

# API Routes
@api_router.get("/")
async def root():
    return {"message": "KR AA Run Health OS API", "status": "operational"}

@api_router.get("/config")
async def get_config():
    return GOLDEN_CONFIG

@api_router.get("/runs")
async def get_runs():
    # Add current run
    current_run = {
        "run_id": "RUN-CURRENT",
        "start_ts": sim_state.current_run_start.isoformat(),
        "end_ts": None,
        "duration_days": sim_state.current_day,
        "end_reason": "In Progress",
        "notes": "Current live run",
        "is_golden": False,
        "is_current": True
    }
    return {"historical": HISTORICAL_RUNS, "current": current_run}

@api_router.get("/metrics")
async def get_metrics():
    check_deviations()
    phase = get_phase(sim_state.current_day)
    
    metrics_with_bands = {}
    for key, value in sim_state.current_metrics.items():
        config = GOLDEN_CONFIG["metrics"].get(key, {})
        band = config.get("bands", {}).get(phase, {})
        metrics_with_bands[key] = {
            "value": value,
            "unit": config.get("unit", ""),
            "name": config.get("name", key),
            "band": band,
            "phase": phase,
            "protects": config.get("protects", "")
        }
    
    return {
        "timestamp": sim_state.simulated_time.isoformat(),
        "run_day": sim_state.current_day,
        "phase": GOLDEN_CONFIG["phases"][phase]["label"],
        "metrics": metrics_with_bands,
        "history": sim_state.metrics_history[-20:]
    }

@api_router.get("/projections")
async def get_projections():
    check_deviations()
    return calculate_projections()

@api_router.get("/actions")
async def get_actions():
    check_deviations()
    return {
        "actions": list(sim_state.actions.values()),
        "active_count": len([a for a in sim_state.actions.values() if a["status"] not in ["Done", "Not feasible"]]),
        "done_count": len([a for a in sim_state.actions.values() if a["status"] == "Done"])
    }

@api_router.post("/actions/{action_id}/status")
async def update_action_status(action_id: str, update: ActionStatusUpdate):
    if action_id not in sim_state.actions:
        raise HTTPException(status_code=404, detail="Action not found")
    
    action = sim_state.actions[action_id]
    action["status"] = update.status
    action["note"] = update.note or action["note"]
    action["updated_at"] = sim_state.simulated_time.isoformat()
    
    # If marked done, slightly improve related metric
    if update.status == "Done":
        metric_name = action["trigger"]["metric"]
        metric_key_map = {
            "CW Inlet Temperature": "cw_inlet_temp",
            "Inhibitor Dosing Continuity": "inhibitor_continuity",
            "Column ΔP Index": "column_dp_index",
            "Reactor Temp Oscillation": "reactor_temp_oscillation",
            "AA Dimer": "aa_dimer",
            "MeHQ": "mehq",
            "Excursion Count": "excursion_count"
        }
        key = metric_key_map.get(metric_name)
        if key:
            if key in ["inhibitor_continuity", "mehq"]:
                sim_state.current_metrics[key] = min(100 if key == "inhibitor_continuity" else 220, 
                                                      sim_state.current_metrics[key] + (2 if key == "inhibitor_continuity" else 15))
            else:
                sim_state.current_metrics[key] = max(0, sim_state.current_metrics[key] * 0.85)
    
    return action

@api_router.get("/threats")
async def get_threats():
    return get_threats_and_actions()

@api_router.get("/timeline")
async def get_timeline():
    return {
        "events": sim_state.timeline_events,
        "metrics_trend": sim_state.metrics_history,
        "current_day": sim_state.current_day
    }

@api_router.get("/golden-comparison")
async def get_golden_comparison():
    check_deviations()
    phase = get_phase(sim_state.current_day)
    
    comparisons = []
    for key, config in GOLDEN_CONFIG["metrics"].items():
        band = config["bands"][phase]
        current_val = sim_state.current_metrics.get(key)
        
        if current_val is None:
            continue
        
        is_ok = True
        deviation = 0
        if "max" in band:
            is_ok = current_val <= band["max"]
            deviation = current_val - band["max"]
        elif "min" in band:
            is_ok = current_val >= band["min"]
            deviation = current_val - band["min"]
        
        comparisons.append({
            "metric_key": key,
            "metric_name": config["name"],
            "unit": config["unit"],
            "golden_band": f"{'≤' if 'max' in band else '≥'}{band.get('max', band.get('min'))}",
            "current_value": round(current_val, 2) if isinstance(current_val, float) else current_val,
            "deviation": round(deviation, 2),
            "is_within_band": is_ok,
            "protects": config["protects"],
            "phase": phase
        })
    
    # Find related actions for deviations
    deviating = [c for c in comparisons if not c["is_within_band"]]
    
    return {
        "run_day": sim_state.current_day,
        "phase": GOLDEN_CONFIG["phases"][phase]["label"],
        "comparisons": comparisons,
        "deviations_count": len(deviating),
        "focus_areas": deviating[:4]
    }

@api_router.get("/data-freshness")
async def get_data_freshness():
    now = datetime.now(timezone.utc)
    last_update_age = (now - sim_state.last_update).total_seconds() / 3600
    
    stale_threshold = GOLDEN_CONFIG["projection_settings"]["stale_threshold_hours"]
    confidence_decay = GOLDEN_CONFIG["projection_settings"]["confidence_decay_hours"]
    
    confidence = "High"
    if last_update_age > confidence_decay:
        confidence = "Medium"
    if last_update_age > stale_threshold * 2:
        confidence = "Low"
    
    stale_metrics = []
    flatline_flags = []
    
    # Check for stale lab results (simulated)
    if sim_state.current_day > 3 and random.random() < 0.1:
        stale_metrics.append("AA Dimer (lab sample pending)")
    
    return {
        "last_data_ts": sim_state.simulated_time.isoformat(),
        "last_scoring_ts": sim_state.last_update.isoformat(),
        "real_time_now": now.isoformat(),
        "simulated_time": sim_state.simulated_time.isoformat(),
        "run_day": sim_state.current_day,
        "stale_metrics": stale_metrics,
        "flatline_flags": flatline_flags,
        "is_paused": sim_state.is_paused,
        "confidence": confidence,
        "last_update_age_hours": round(last_update_age, 2)
    }

# Demo control endpoints
@api_router.post("/demo/advance-time")
async def demo_advance_time():
    sim_state.advance_time(6)
    check_deviations()
    return {
        "message": "Advanced 6 hours",
        "new_day": sim_state.current_day,
        "simulated_time": sim_state.simulated_time.isoformat()
    }

@api_router.post("/demo/inject-event")
async def demo_inject_event(request: DemoEventRequest):
    event = sim_state.inject_event(request.event_type, request.duration_steps or 4)
    check_deviations()
    return {
        "message": f"Injected {request.event_type}",
        "event": event,
        "current_metrics": sim_state.current_metrics
    }

@api_router.post("/demo/resolve-action")
async def demo_resolve_action():
    """Auto-resolve the oldest active action"""
    active = [a for a in sim_state.actions.values() if a["status"] not in ["Done", "Not feasible"]]
    if not active:
        return {"message": "No active actions to resolve"}
    
    action = active[0]
    action["status"] = "Done"
    action["note"] = "Resolved via demo control"
    action["updated_at"] = sim_state.simulated_time.isoformat()
    
    return {"message": f"Resolved {action['id']}", "action": action}

@api_router.post("/demo/pause")
async def demo_pause():
    sim_state.is_paused = True
    return {"message": "Data feed paused", "is_paused": True}

@api_router.post("/demo/resume")
async def demo_resume():
    sim_state.is_paused = False
    sim_state.last_update = datetime.now(timezone.utc)
    return {"message": "Data feed resumed", "is_paused": False}

@api_router.post("/demo/reset")
async def demo_reset():
    sim_state.reset()
    return {"message": "Simulation reset", "current_day": sim_state.current_day}

@api_router.post("/demo/inject-missing")
async def demo_inject_missing():
    """Simulate a missing metric"""
    return {"message": "Missing metric injected (simulation placeholder)"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
