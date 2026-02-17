from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import random
import math

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Load simulation data
DATA_DIR = Path(__file__).parent.parent / 'data' / 'sim'
with open(DATA_DIR / 'run_seed.json', 'r') as f:
    RUN_SEED = json.load(f)
with open(DATA_DIR / 'ops_events.json', 'r') as f:
    OPS_EVENTS = json.load(f)

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== SYNTHETIC DATA ENGINE WITH HARD CONSTRAINTS ==========

class SyntheticDataEngine:
    """
    Rigorous synthetic data engine with hard constraints.
    
    CORE STORY: Actual + Forecast are BETTER than Benchmark (Current Best Run)
    - Lower polymer/fouling → longer run length + higher output + tighter CI
    
    RELATIONSHIPS (must hold everywhere):
    - Benchmark polymer: 350-850 kg/day (smooth rising)
    - Actual polymer: 10-20% LOWER than benchmark (with event spikes)
    - Forecast polymer: 20-30% LOWER than benchmark (stable/flattening)
    - Run length derived FROM polymer burden
    - Output rate inversely tied to polymer
    - CI widens during spikes, tightens when stable
    """
    
    # Fixed events (only 2, well-defined)
    EVENTS = [
        {"day": 12, "type": "FILTER_CLEANING_SPIKE", "severity": "medium", "label": "Filter Cleaning Spike"},
        {"day": 52, "type": "FOULING_RISK_CLUSTER", "severity": "high", "label": "Fouling Risk Cluster"}
    ]
    
    # Core parameters
    BENCHMARK_RUN_LENGTH = 111  # Current Best Run total days
    ACTUAL_RUN_BONUS = 5       # Actual is ~5 days better than benchmark
    FORECAST_RUN_BONUS = 10    # Forecast is ~10 days better (with actions)
    
    # Polymer constraints
    BENCHMARK_POLYMER_START = 380  # kg/day at day 1
    BENCHMARK_POLYMER_END = 780    # kg/day at day 111
    ACTUAL_POLYMER_FACTOR = 0.85   # Actual is 15% lower than benchmark
    FORECAST_POLYMER_FACTOR = 0.72 # Forecast is 28% lower than benchmark
    
    # Output constraints
    BENCHMARK_OUTPUT_RATE = 330    # tons/day baseline
    ACTUAL_OUTPUT_RATE = 345       # tons/day (better)
    FORECAST_OUTPUT_RATE = 358     # tons/day (best)
    
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)
        self.golden_run = RUN_SEED["golden_run_candidate"]
        
        # Pre-generate all time series data
        self._generate_all_series()
    
    def _generate_all_series(self):
        """Generate coherent time series for all 111 days"""
        self.series_data = {}
        
        for day in range(1, 112):
            self.series_data[day] = self._compute_day_metrics(day)
    
    def _get_benchmark_polymer(self, day: int) -> float:
        """Benchmark polymer: smooth rising curve 380 → 780 kg/day"""
        # Use slight exponential growth for realism
        progress = (day - 1) / 110  # 0 to 1
        # Polynomial growth (starts slower, accelerates)
        growth = progress ** 1.3
        return self.BENCHMARK_POLYMER_START + (self.BENCHMARK_POLYMER_END - self.BENCHMARK_POLYMER_START) * growth
    
    def _get_event_spike(self, day: int) -> tuple:
        """Returns (spike_amount, is_event, event_info) for a day"""
        for event in self.EVENTS:
            event_day = event["day"]
            # Spike on event day and 2 days after with decay
            if event_day <= day <= event_day + 2:
                decay = 1.0 - (day - event_day) * 0.35
                decay = max(0.3, decay)
                spike = 180 if event["severity"] == "high" else 120
                return (spike * decay, True, event)
        return (0, False, None)
    
    def _compute_day_metrics(self, day: int) -> dict:
        """Compute all metrics for a single day with hard constraints"""
        
        # ========== POLYMER/FOULING ==========
        benchmark_polymer = self._get_benchmark_polymer(day)
        spike, is_event, event_info = self._get_event_spike(day)
        
        # Actual polymer: 15% lower than benchmark + small jitter + event spikes
        jitter = self.rng.uniform(-0.02, 0.02)
        actual_polymer = benchmark_polymer * (self.ACTUAL_POLYMER_FACTOR + jitter) + spike
        
        # Forecast polymer: 28% lower, stable (no spikes in forecast)
        forecast_polymer = benchmark_polymer * self.FORECAST_POLYMER_FACTOR
        # Slight flattening effect after day 60
        if day > 60:
            forecast_polymer *= 0.95
        
        # ========== RUN LENGTH (derived from polymer) ==========
        # Core formula: higher polymer = shorter remaining days
        # Benchmark: fixed at 111 days total
        benchmark_total_run = self.BENCHMARK_RUN_LENGTH
        
        # Actual: polymer is lower, so run is longer
        # remainingDays = (111 - day) + bonus adjusted by polymer ratio
        polymer_advantage = (benchmark_polymer - actual_polymer) / benchmark_polymer
        actual_bonus = self.ACTUAL_RUN_BONUS * (1 + polymer_advantage * 0.5)
        actual_remaining = max(1, (benchmark_total_run - day) + actual_bonus)
        actual_total_run = day + actual_remaining
        
        # Forecast: even lower polymer, even longer run
        forecast_bonus = self.FORECAST_RUN_BONUS * (1 + polymer_advantage * 0.3)
        forecast_remaining = max(1, (benchmark_total_run - day) + forecast_bonus)
        forecast_total_run = day + forecast_remaining
        
        # ========== CONFIDENCE INTERVAL ==========
        # Base CI: ±4 days when stable
        base_ci = 4
        # Widen during events
        if is_event:
            ci = base_ci + 3  # ±7 days during events
        elif spike > 0:  # Decay period
            ci = base_ci + 1.5
        else:
            # Tighten as we get closer to end (more certainty)
            progress = day / 111
            ci = base_ci - progress * 1.5
        ci = max(2, min(8, ci))
        
        # ========== OUTPUT ==========
        # Higher when polymer is lower
        polymer_ratio = actual_polymer / benchmark_polymer
        
        # Benchmark cumulative output
        benchmark_output_rate = self.BENCHMARK_OUTPUT_RATE
        benchmark_cumulative = benchmark_output_rate * day
        
        # Actual: better output rate when polymer is lower
        actual_output_rate = self.ACTUAL_OUTPUT_RATE * (1.1 - polymer_ratio * 0.1)
        # Small dip during events
        if is_event:
            actual_output_rate *= 0.97
        actual_cumulative = actual_output_rate * day
        
        # Forecast: best output rate
        forecast_output_rate = self.FORECAST_OUTPUT_RATE
        forecast_cumulative = forecast_output_rate * day
        
        # ========== FILTER CHANGES ==========
        # Derived from polymer burden
        filter_changes = (actual_polymer / 500) * (1 + self.rng.uniform(-0.1, 0.1))
        if is_event:
            filter_changes += 0.8
        
        # ========== HEALTH SCORE ==========
        # Inversely related to polymer
        health_base = 85
        polymer_penalty = (actual_polymer - 300) / 50  # Higher polymer = lower health
        health_score = health_base - polymer_penalty
        if is_event:
            health_score -= 8
        health_score = max(50, min(95, health_score))
        
        # ========== FOULING RISK INDEX ==========
        fouling_risk = (actual_polymer / 200) * (1 + self.rng.uniform(-0.05, 0.05))
        if is_event:
            fouling_risk += 1.5
        fouling_risk = min(10, fouling_risk)
        
        return {
            "day": day,
            # Polymer/Fouling
            "benchmark_polymer": round(benchmark_polymer, 1),
            "actual_polymer": round(actual_polymer, 1),
            "forecast_polymer": round(forecast_polymer, 1),
            "polymer_burden_kg_per_day": round(actual_polymer, 1),
            "filter_change_count_per_day": round(filter_changes, 2),
            "fouling_risk_index": round(fouling_risk, 2),
            # Run length
            "benchmark_total_run": benchmark_total_run,
            "actual_total_run": round(actual_total_run, 1),
            "forecast_total_run": round(forecast_total_run, 1),
            "predicted_remaining_days": round(actual_remaining),
            "predicted_total_run_length": round(actual_total_run),
            # Confidence
            "prediction_ci_90pct_days": round(ci, 1),
            # Output
            "benchmark_output_rate": round(benchmark_output_rate, 1),
            "actual_output_rate": round(actual_output_rate, 1),
            "forecast_output_rate": round(forecast_output_rate, 1),
            "benchmark_cumulative": round(benchmark_cumulative),
            "actual_cumulative": round(actual_cumulative),
            "forecast_cumulative": round(forecast_cumulative),
            "eaa_output_tpd": round(actual_output_rate, 1),
            "cumulative_output_tons": round(actual_cumulative),
            # Health
            "run_health_score": round(health_score, 1),
            # Events
            "has_event": is_event,
            "event_info": event_info,
            # Other metrics (for compatibility)
            "data_freshness_score": 95 - self.rng.uniform(0, 5),
        }
    
    def get_day_data(self, day: int) -> dict:
        """Get full data for a specific day"""
        if day < 1:
            day = 1
        if day > 111:
            day = 111
        
        base = self.series_data[day].copy()
        
        # Add date calculations
        base = self._add_date_fields(day, base)
        
        # Add commitment/output projections
        base = self._add_commitment_fields(day, base)
        
        # Add actions
        base["actions"] = self._get_actions_for_day(day)
        
        return base
    
    def _add_date_fields(self, day: int, metrics: dict) -> dict:
        """Add future-looking date fields"""
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        run_start_date = today - timedelta(days=day - 1)
        
        remaining = metrics["predicted_remaining_days"]
        ci = metrics["prediction_ci_90pct_days"]
        
        predicted_end = today + timedelta(days=remaining)
        
        metrics["run_start_date"] = run_start_date.strftime("%Y-%m-%d")
        metrics["current_date"] = today.strftime("%Y-%m-%d")
        metrics["current_date_display"] = today.strftime("%d %b %Y")
        
        metrics["predicted_end_date"] = predicted_end.strftime("%Y-%m-%d")
        metrics["predicted_end_date_p50"] = predicted_end.strftime("%Y-%m-%d")
        metrics["predicted_end_date_p90"] = (predicted_end - timedelta(days=int(ci * 0.5))).strftime("%Y-%m-%d")
        metrics["predicted_end_date_p10"] = (predicted_end + timedelta(days=int(ci * 0.5))).strftime("%Y-%m-%d")
        
        # Shutdown window
        shutdown_start = predicted_end - timedelta(days=int(ci * 0.7))
        shutdown_end = predicted_end + timedelta(days=int(ci * 0.3))
        metrics["shutdown_window_start"] = shutdown_start.strftime("%Y-%m-%d")
        metrics["shutdown_window_end"] = shutdown_end.strftime("%Y-%m-%d")
        
        # P10/P90 run lengths
        metrics["predicted_total_run_length_p90"] = metrics["predicted_total_run_length"] - int(ci * 0.5)
        metrics["predicted_total_run_length_p10"] = metrics["predicted_total_run_length"] + int(ci * 0.5)
        
        # Benchmark gap
        metrics["benchmark_gap_days"] = metrics["predicted_total_run_length"] - self.BENCHMARK_RUN_LENGTH
        metrics["benchmark_target_days"] = self.BENCHMARK_RUN_LENGTH
        metrics["forecast_end_day_p50"] = metrics["predicted_total_run_length"]
        
        return metrics
    
    def _add_commitment_fields(self, day: int, metrics: dict) -> dict:
        """Add output commitment projections"""
        remaining = metrics["predicted_remaining_days"]
        ci = metrics["prediction_ci_90pct_days"]
        current_cumulative = metrics["cumulative_output_tons"]
        output_rate = metrics["eaa_output_tpd"]
        
        # P50 expected output
        p50_output = current_cumulative + output_rate * remaining
        metrics["output_p50_tons"] = round(p50_output)
        
        # P90 committed output (conservative)
        p90_remaining = remaining - int(ci * 0.5)
        p90_output = current_cumulative + output_rate * 0.95 * p90_remaining
        metrics["output_p90_tons"] = round(p90_output)
        
        # P10 upside output
        p10_remaining = remaining + int(ci * 0.5)
        p10_output = current_cumulative + output_rate * 1.02 * p10_remaining
        metrics["output_p10_tons"] = round(p10_output)
        
        # Other compatibility fields
        metrics["expected_total_output_tons"] = metrics["output_p50_tons"]
        metrics["eaa_output_band_min"] = round(output_rate * 0.95)
        metrics["eaa_output_band_max"] = round(output_rate * 1.05)
        metrics["polymer_build_index"] = min(100, int((metrics["polymer_burden_kg_per_day"] / 1000) * 100))
        
        if metrics["prediction_ci_90pct_days"] <= 4:
            metrics["predictability_score"] = "High"
        elif metrics["prediction_ci_90pct_days"] <= 6:
            metrics["predictability_score"] = "Medium"
        else:
            metrics["predictability_score"] = "Low"
        
        if metrics["data_freshness_score"] >= 90:
            metrics["feed_status"] = "Healthy"
        else:
            metrics["feed_status"] = "Delayed"
        
        return metrics
    
    def _get_actions_for_day(self, day: int) -> list:
        """Get recommended actions based on current state"""
        metrics = self.series_data[day]
        actions = []
        
        polymer = metrics["polymer_burden_kg_per_day"]
        fouling = metrics["fouling_risk_index"]
        health = metrics["run_health_score"]
        
        # Action 1: Emergency flush if polymer high
        if polymer > 500:
            actions.append({
                "id": f"ACT-{day:03d}-01",
                "title": "Emergency Flush Cycle + Filter Swap",
                "urgency": "critical" if polymer > 600 else "high",
                "protects": "Run Length",
                "effort": "High",
                "horizon": "now",
                "trigger": {
                    "metric": "Polymer Burden",
                    "current": f"{round(polymer)} kg/day",
                    "baseline": "180 kg/day",
                    "band": "150-220 kg/day",
                    "deviation": f"+{round((polymer - 180) / 180 * 100)}%",
                    "time_window": "Last 24h"
                },
                "where": ["G8", "G9", "V-014", "V-022"],
                "checklist": [
                    "IMMEDIATE: Initiate emergency flush on G8 (20 min cycle, max pressure)",
                    "Swap G9 filter element if DP > 1.0 bar",
                    "Increase inhibitor flow by 5% for next 48h",
                    "Log polymer collection volume (target: >50kg removal)",
                    "Brief oncoming shift: 'Run rescue protocol active'",
                    "Schedule follow-up inspection at +24h"
                ],
                "impact_on_done": {
                    "remaining_days_delta": 6,
                    "health_score_delta": 5,
                    "polymer_reduction_pct": 15,
                    "ci_tightening_days": 1
                },
                "expected_effect": {
                    "run_extension": "+4 to +8 days (simulated)",
                    "polymer_change": "↓ flatten for 72h",
                    "ci_change": "+6 days P50",
                    "ci_tightening": "-1d"
                }
            })
        
        # Action 2: Run rescue if fouling high
        if fouling > 4.5:
            actions.append({
                "id": f"ACT-{day:03d}-02",
                "title": "Activate Run Rescue Mode",
                "urgency": "critical" if fouling > 6 else "high",
                "protects": "Both",
                "effort": "High",
                "horizon": "now",
                "trigger": {
                    "metric": "Fouling Risk Index",
                    "current": f"{round(fouling, 1)}/10",
                    "baseline": "2.2/10",
                    "band": "1.5-3.0/10",
                    "deviation": f"+{round((fouling - 2.2) / 2.2 * 100)}%",
                    "time_window": "Last 72h trend"
                },
                "where": ["V-014", "V-022", "E-015", "G8", "G9"],
                "checklist": [
                    "Declare 'Run Rescue Mode' in shift log (triggers enhanced monitoring)",
                    "Reduce temperature bands on V-014, V-022 by 1°C",
                    "Increase cleaning cadence: +1 cycle per shift",
                    "Inhibitor dose: increase by 8% for 72h",
                    "Hourly DP checks on G8, G9 (log all readings)",
                    "Alert maintenance: potential filter swap in 24-48h"
                ],
                "impact_on_done": {
                    "remaining_days_delta": 7,
                    "health_score_delta": 8,
                    "polymer_reduction_pct": 20,
                    "ci_tightening_days": 2
                },
                "expected_effect": {
                    "run_extension": "+5 to +10 days (simulated)",
                    "polymer_change": "↓ slope reduction",
                    "ci_change": "+7 days P50",
                    "ci_tightening": "-2d"
                }
            })
        
        # Action 3: Preventive inspection (medium priority)
        if health < 80 or (polymer > 400 and polymer < 500):
            actions.append({
                "id": f"ACT-{day:03d}-03",
                "title": "Schedule Preventive Filter Inspection",
                "urgency": "medium",
                "protects": "Run Length",
                "effort": "Medium",
                "horizon": "next_24h",
                "trigger": {
                    "metric": "Health Score",
                    "current": f"{round(health)}/100",
                    "baseline": "85/100",
                    "band": "80-90/100",
                    "deviation": f"{round(health - 85)}",
                    "time_window": "Current"
                },
                "where": ["G8", "G9"],
                "checklist": [
                    "Schedule filter inspection for next maintenance window",
                    "Pre-position replacement elements",
                    "Review DP trend over last 7 days",
                    "Coordinate with operations for timing"
                ],
                "impact_on_done": {
                    "remaining_days_delta": 3,
                    "health_score_delta": 3,
                    "polymer_reduction_pct": 5,
                    "ci_tightening_days": 1
                },
                "expected_effect": {
                    "run_extension": "+2 to +4 days (simulated)",
                    "polymer_change": "→ stabilize",
                    "ci_change": "+3 days P50",
                    "ci_tightening": "-1d"
                }
            })
        
        return actions
    
    def get_time_series(self, start: int = 1, end: int = 111) -> list:
        """Get time series data for a range of days"""
        series = []
        for day in range(start, min(end + 1, 112)):
            series.append(self.series_data[day])
        return series
    
    def get_events(self) -> list:
        """Get list of events with day numbers"""
        return [
            {
                "day": e["day"],
                "type": e["type"],
                "severity": "high" if e["severity"] == "high" else "medium",
                "label": e["label"]
            }
            for e in self.EVENTS
        ]


# Create global instance
sim_engine = SyntheticDataEngine(seed=42)


# ========== PYDANTIC MODELS ==========

class ActionStatusUpdate(BaseModel):
    status: str
    reason_code: Optional[str] = None
    note: Optional[str] = ""

class SimulatorRequest(BaseModel):
    day: int
    cleaning_cadence: int = 0
    inhibitor_dose_index: float = 1.0
    flush_frequency: int = 0
    intervention_discipline: str = "medium"

# ========== API ROUTES ==========

@api_router.get("/")
async def root():
    return {"message": "KR AA Run Health OS API", "status": "operational", "version": "3.0"}

@api_router.get("/run-info")
async def get_run_info():
    """Get run metadata"""
    return {
        "run_id": RUN_SEED["golden_run_candidate"]["run_id"],
        "start_ts": RUN_SEED["golden_run_candidate"]["start_ts"],
        "end_ts": RUN_SEED["golden_run_candidate"]["end_ts"],
        "target_days": RUN_SEED["kpi_targets"]["target_run_length_days"],
        "output_band": RUN_SEED["kpi_targets"]["target_output_tpd_band"],
        "assets": RUN_SEED["assets_dictionary"],
        "benchmark_run_length": 111
    }

@api_router.get("/day/{day}")
async def get_day_data(day: int):
    """Get all metrics for a specific day"""
    return sim_engine.get_day_data(day)

@api_router.get("/time-series")
async def get_time_series(start: int = 1, end: int = 111):
    """Get time series for a range of days"""
    return {
        "series": sim_engine.get_time_series(start, end),
        "total_days": end - start + 1
    }

@api_router.get("/what-changed/{day}")
async def get_what_changed(day: int):
    """Get what changed in last 7 days"""
    changes = []
    for d in range(max(1, day - 6), day + 1):
        data = sim_engine.series_data.get(d, {})
        prev = sim_engine.series_data.get(d - 1, data)
        changes.append({
            "day": d,
            "health_delta": round(data.get("run_health_score", 0) - prev.get("run_health_score", 0), 1),
            "remaining_delta": data.get("predicted_remaining_days", 0) - prev.get("predicted_remaining_days", 0),
            "output_delta": round(data.get("eaa_output_tpd", 0) - prev.get("eaa_output_tpd", 0), 1),
            "is_significant": data.get("has_event", False)
        })
    return {"current_day": day, "changes": changes}

@api_router.get("/events")
async def get_events():
    """Get all operational events"""
    return {
        "events": sim_engine.get_events(),
        "shift_logs": [],
        "lab_results": [],
        "pipeline_status": "healthy"
    }

@api_router.get("/quick-days")
async def get_quick_days():
    """Get critical day markers"""
    return {
        "days": [
            {"day": 7, "label": "Early", "reason": "Initial stabilization"},
            {"day": 30, "label": "Mid", "reason": "First major checkpoint"},
            {"day": 52, "label": "Event", "reason": "Fouling risk cluster"},
            {"day": 70, "label": "Critical", "reason": "Rescue window"},
            {"day": 96, "label": "Late", "reason": "Final stretch"},
            {"day": 110, "label": "End", "reason": "Near benchmark end"}
        ]
    }

@api_router.get("/scenario-comparison/{day}")
async def get_scenario_comparison(day: int):
    """Get side-by-side comparison: 'Do Nothing' vs 'Execute Moves'"""
    base_data = sim_engine.get_day_data(day)
    actions = base_data.get("actions", [])
    
    # Calculate total impact if all actions are done
    total_remaining_delta = 0
    total_health_delta = 0
    total_polymer_reduction = 0
    total_ci_tightening = 0
    
    for action in actions:
        impact = action.get("impact_on_done", {})
        total_remaining_delta += impact.get("remaining_days_delta", 0)
        total_health_delta += impact.get("health_score_delta", 0)
        total_polymer_reduction += impact.get("polymer_reduction_pct", 0)
        total_ci_tightening += impact.get("ci_tightening_days", 0)
    
    # Cap effects
    total_remaining_delta = min(total_remaining_delta, 15)
    total_ci_tightening = min(total_ci_tightening, 4)
    
    remaining_base = base_data["predicted_remaining_days"]
    health_base = base_data["run_health_score"]
    ci_base = base_data["prediction_ci_90pct_days"]
    
    # Do nothing scenario
    do_nothing = {
        "predicted_remaining_days": remaining_base,
        "forecast_end_day": base_data.get("forecast_end_day_p50", base_data["predicted_total_run_length"]),
        "predicted_end_date_p50": base_data["predicted_end_date_p50"],
        "predicted_end_date_p90": base_data["predicted_end_date_p90"],
        "benchmark_gap_days": base_data.get("benchmark_gap_days", 0),
        "run_health_score": health_base,
        "output_p50_tons": base_data["output_p50_tons"],
        "output_p90_tons": base_data["output_p90_tons"],
        "output_p10_tons": base_data.get("output_p10_tons", base_data["output_p50_tons"]),
        "shutdown_window_start": base_data["shutdown_window_start"],
        "shutdown_window_end": base_data["shutdown_window_end"],
        "ci_days": ci_base
    }
    
    # Execute moves scenario
    new_remaining = remaining_base + total_remaining_delta
    new_health = min(100, health_base + total_health_delta)
    new_ci = max(2, ci_base - total_ci_tightening)
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    new_end_date = today + timedelta(days=new_remaining)
    new_forecast_end_day = day + new_remaining
    
    avg_output = base_data["eaa_output_tpd"] * 0.95
    new_output_p50 = int(base_data["cumulative_output_tons"] + avg_output * new_remaining)
    
    execute_moves = {
        "predicted_remaining_days": new_remaining,
        "forecast_end_day": new_forecast_end_day,
        "predicted_end_date_p50": new_end_date.strftime("%Y-%m-%d"),
        "predicted_end_date_p90": (new_end_date - timedelta(days=int(new_ci * 0.5))).strftime("%Y-%m-%d"),
        "benchmark_gap_days": new_forecast_end_day - 111,
        "run_health_score": new_health,
        "output_p50_tons": new_output_p50,
        "output_p90_tons": int(new_output_p50 * 0.95),
        "output_p10_tons": int(new_output_p50 * 1.05),
        "shutdown_window_start": (new_end_date - timedelta(days=int(new_ci * 0.7))).strftime("%Y-%m-%d"),
        "shutdown_window_end": (new_end_date + timedelta(days=int(new_ci * 0.3))).strftime("%Y-%m-%d"),
        "ci_days": new_ci
    }
    
    return {
        "day": day,
        "do_nothing": do_nothing,
        "execute_moves": execute_moves,
        "deltas": {
            "remaining_days": total_remaining_delta,
            "health_score": total_health_delta,
            "benchmark_gap": (new_forecast_end_day - 111) - base_data.get("benchmark_gap_days", 0),
            "output_p50": new_output_p50 - base_data["output_p50_tons"],
            "ci_days": -total_ci_tightening
        },
        "actions_count": len(actions)
    }

@api_router.post("/simulate")
async def simulate_scenario(request: SimulatorRequest):
    """Run what-if simulation"""
    base_data = sim_engine.get_day_data(request.day)
    
    cleaning = request.cleaning_cadence
    inhibitor = request.inhibitor_dose_index
    flush = request.flush_frequency
    discipline = request.intervention_discipline
    
    risk_reduction = cleaning * 0.08 + flush * 0.05
    if discipline == "high":
        risk_reduction += 0.15
    
    simulated = {
        "run_health_score": min(100, base_data["run_health_score"] + risk_reduction * 10),
        "predicted_remaining_days": int(base_data["predicted_remaining_days"] * (1 + risk_reduction * 0.3)),
        "eaa_output_tpd": base_data["eaa_output_tpd"] + cleaning * 3 + flush * 2,
        "fouling_risk_index": max(1, base_data["fouling_risk_index"] * (1 - risk_reduction)),
        "polymer_burden_kg_per_day": base_data["polymer_burden_kg_per_day"] * (1 - cleaning * 0.1),
    }
    
    return {
        "baseline": base_data,
        "simulated": simulated,
        "deltas": {
            "health_score": round(simulated["run_health_score"] - base_data["run_health_score"], 1),
            "remaining_days": simulated["predicted_remaining_days"] - base_data["predicted_remaining_days"],
        }
    }

@api_router.get("/intervention-window/{day}")
async def get_intervention_window(day: int):
    """Get recommended intervention windows"""
    return {
        "windows": [
            {"start": day + 3, "end": day + 10, "type": "Recommended", "reason": "Pre-drift maintenance"},
            {"start": day + 25, "end": day + 32, "type": "Optional", "reason": "Mid-cycle optimization"}
        ]
    }

@api_router.post("/apply-action-impact/{day}")
async def apply_action_impact(day: int, action_id: str):
    """Apply impact of completed action"""
    data = sim_engine.get_day_data(day)
    actions = data.get("actions", [])
    action = next((a for a in actions if a["id"] == action_id), None)
    
    if not action:
        return {"success": False, "message": "Action not found"}
    
    impact = action.get("impact_on_done", {})
    return {
        "success": True,
        "impact_applied": impact,
        "new_forecast": {
            "remaining_days_delta": impact.get("remaining_days_delta", 0),
            "health_delta": impact.get("health_score_delta", 0),
            "ci_tightening": impact.get("ci_tightening_days", 0)
        }
    }

# ========== ACTION STATUS PERSISTENCE ==========

@api_router.get("/actions/statuses")
async def get_action_statuses():
    """Get all persisted action statuses"""
    statuses = await db.action_statuses.find().to_list(100)
    for s in statuses:
        s["_id"] = str(s["_id"])
    return {"statuses": statuses}

@api_router.post("/actions/{action_id}/status")
async def update_action_status(action_id: str, update: ActionStatusUpdate):
    """Update action status"""
    await db.action_statuses.update_one(
        {"action_id": action_id},
        {"$set": {
            "action_id": action_id,
            "status": update.status,
            "reason_code": update.reason_code,
            "note": update.note,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    return {"success": True, "action_id": action_id, "status": update.status}

@api_router.delete("/actions/statuses/clear")
async def clear_action_statuses():
    """Clear all action statuses (demo reset)"""
    result = await db.action_statuses.delete_many({})
    return {"deleted_count": result.deleted_count}

# ========== CORS AND APP SETUP ==========

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
