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

# ========== SIMULATION ENGINE ==========

class SimulationEngine:
    """
    Deterministic simulation engine for KR AA Run Health prototype.
    Generates daily time-series using piecewise linear interpolation + jitter + events.
    """
    
    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)
        self.anchors = RUN_SEED["anchors"]
        self.events = OPS_EVENTS["events"]
        self.golden_run = RUN_SEED["golden_run_candidate"]
        self.target_days = RUN_SEED["kpi_targets"]["target_run_length_days"]
        self.start_date = datetime.fromisoformat(self.golden_run["start_ts"].replace("+05:30", "+05:30"))
        
        # Pre-generate full time series
        self.time_series = self._generate_full_series()
        
        # Simulator state (for what-if)
        self.simulator_adjustments = {
            "cleaning_cadence": 0,  # 0, +1, +2
            "inhibitor_dose_index": 1.0,  # 0.9 to 1.3
            "flush_frequency": 0,  # 0, +1
            "intervention_discipline": "medium"  # low/medium/high
        }
    
    def _get_jitter(self, base_value: float, max_pct: float = 2.5) -> float:
        """Apply deterministic jitter to a value"""
        jitter_pct = self.rng.uniform(-max_pct, max_pct) / 100
        return base_value * (1 + jitter_pct)
    
    def _interpolate(self, day: int, metric: str) -> float:
        """Piecewise linear interpolation between anchors"""
        anchor_days = [a["day"] for a in self.anchors]
        
        # Find surrounding anchors
        lower_anchor = None
        upper_anchor = None
        
        for i, anchor in enumerate(self.anchors):
            if anchor["day"] <= day:
                lower_anchor = anchor
            if anchor["day"] >= day and upper_anchor is None:
                upper_anchor = anchor
                break
        
        if lower_anchor is None:
            lower_anchor = self.anchors[0]
        if upper_anchor is None:
            upper_anchor = self.anchors[-1]
        
        if lower_anchor["day"] == upper_anchor["day"]:
            return lower_anchor.get(metric, 0)
        
        # Linear interpolation
        t = (day - lower_anchor["day"]) / (upper_anchor["day"] - lower_anchor["day"])
        lower_val = lower_anchor.get(metric, 0)
        upper_val = upper_anchor.get(metric, 0)
        
        return lower_val + t * (upper_val - lower_val)
    
    def _apply_event_effects(self, day: int, metrics: dict) -> dict:
        """Apply event overrides/spikes to metrics"""
        for event in self.events:
            event_day = event["day"]
            
            # Event affects current day and a few days after
            if event_day <= day <= event_day + 3:
                severity_mult = {"low": 1.0, "medium": 1.3, "high": 1.6}.get(event["severity"], 1.0)
                decay = 1.0 - (day - event_day) * 0.2  # Decay effect over days
                decay = max(0.3, decay)
                
                if event["type"] == "FILTER_CLEANING_SPIKE":
                    metrics["filter_change_count_per_day"] += 1.5 * severity_mult * decay
                    metrics["polymer_burden_kg_per_day"] += 200 * severity_mult * decay
                
                elif event["type"] == "TEMP_EXCURSION":
                    metrics["fouling_risk_index"] += 0.8 * severity_mult * decay
                    metrics["run_health_score"] -= 2 * severity_mult * decay
                
                elif event["type"] == "FOULING_RISK_CLUSTER":
                    metrics["fouling_risk_index"] += 1.5 * severity_mult * decay
                    metrics["polymer_burden_kg_per_day"] += 400 * severity_mult * decay
                    metrics["filter_change_count_per_day"] += 2 * decay
                    metrics["run_health_score"] -= 5 * decay
                
                elif event["type"] == "RUN_RESCUE_MODE":
                    # Rescue mode SLOWS worsening
                    metrics["fouling_risk_index"] *= 0.9
                    metrics["run_health_score"] += 3 * decay
                
                elif event["type"] == "PREDICTED_END_SHIFT":
                    if day == event_day:
                        metrics["predicted_remaining_days"] = event["observed"]["predicted_remaining_days_after"]
        
        return metrics
    
    def _calculate_derived_metrics(self, day: int, metrics: dict) -> dict:
        """Calculate derived/computed metrics"""
        
        # Polymer Build Index (0-100) from polymer burden + filter changes
        polymer_normalized = min(100, (metrics["polymer_burden_kg_per_day"] / 1500) * 100)
        filter_normalized = min(100, (metrics["filter_change_count_per_day"] / 3) * 100)
        metrics["polymer_build_index"] = int((polymer_normalized * 0.6 + filter_normalized * 0.4))
        
        # Cumulative output (tons)
        metrics["cumulative_output_tons"] = int(metrics["eaa_output_tpd"] * day * 0.95)
        
        # Expected total output till end
        remaining = metrics["predicted_remaining_days"]
        avg_future_output = metrics["eaa_output_tpd"] * 0.95  # Slight decline assumed
        metrics["expected_total_output_tons"] = int(metrics["cumulative_output_tons"] + avg_future_output * remaining)
        
        # Output forecast band
        metrics["eaa_output_band_min"] = int(metrics["eaa_output_tpd"] * 0.92)
        metrics["eaa_output_band_max"] = int(metrics["eaa_output_tpd"] * 1.05)
        
        # Predictability score
        ci = metrics["prediction_ci_90pct_days"]
        if ci <= 5:
            metrics["predictability_score"] = "High"
        elif ci <= 9:
            metrics["predictability_score"] = "Medium"
        else:
            metrics["predictability_score"] = "Low"
        
        # Data freshness status
        if metrics["data_freshness_score"] >= 90:
            metrics["feed_status"] = "Healthy"
        elif metrics["data_freshness_score"] >= 75:
            metrics["feed_status"] = "Delayed"
        else:
            metrics["feed_status"] = "Interrupted"
        
        # Predicted end date (P50)
        base_date = self.start_date + timedelta(days=day - 1)
        predicted_end = base_date + timedelta(days=remaining)
        metrics["predicted_end_date"] = predicted_end.strftime("%Y-%m-%d")
        metrics["predicted_end_date_early"] = (predicted_end - timedelta(days=ci)).strftime("%Y-%m-%d")
        metrics["predicted_end_date_late"] = (predicted_end + timedelta(days=ci)).strftime("%Y-%m-%d")
        
        # Current date
        current_date = self.start_date + timedelta(days=day - 1)
        metrics["current_date"] = current_date.strftime("%Y-%m-%d")
        metrics["current_date_display"] = current_date.strftime("%d %b %Y")
        
        # ========== GOLDEN GAP CALCULATIONS ==========
        golden_target_days = 111
        forecast_end_day = day + remaining
        metrics["golden_gap_days"] = forecast_end_day - golden_target_days  # negative = behind golden
        metrics["golden_target_days"] = golden_target_days
        metrics["forecast_end_day_p50"] = forecast_end_day
        metrics["forecast_end_day_p90"] = forecast_end_day - int(ci * 0.5)  # P90 = pessimistic
        metrics["forecast_end_day_p10"] = forecast_end_day + int(ci * 0.5)  # P10 = optimistic
        
        # End dates for P10/P50/P90
        metrics["predicted_end_date_p50"] = predicted_end.strftime("%Y-%m-%d")
        metrics["predicted_end_date_p90"] = (predicted_end - timedelta(days=int(ci * 0.5))).strftime("%Y-%m-%d")
        metrics["predicted_end_date_p10"] = (predicted_end + timedelta(days=int(ci * 0.5))).strftime("%Y-%m-%d")
        
        # ========== COMMITMENT VIEW - P10/P50/P90 OUTPUT ==========
        # P50 expected output (base case)
        p50_remaining_output = avg_future_output * remaining
        metrics["output_p50_tons"] = int(metrics["cumulative_output_tons"] + p50_remaining_output)
        
        # P90 committed output (conservative - shorter run, lower output)
        p90_remaining_days = remaining - int(ci * 0.5)
        p90_output_rate = metrics["eaa_output_tpd"] * 0.92  # Lower bound of output
        metrics["output_p90_tons"] = int(metrics["cumulative_output_tons"] + p90_output_rate * p90_remaining_days * 0.95)
        
        # P10 upside output (optimistic - longer run, higher output)
        p10_remaining_days = remaining + int(ci * 0.5)
        p10_output_rate = metrics["eaa_output_tpd"] * 1.02  # Slightly better
        metrics["output_p10_tons"] = int(metrics["cumulative_output_tons"] + p10_output_rate * p10_remaining_days * 0.95)
        
        # Shutdown window (P90 - conservative)
        shutdown_start = predicted_end - timedelta(days=int(ci * 0.7))
        shutdown_end = predicted_end + timedelta(days=int(ci * 0.3))
        metrics["shutdown_window_start"] = shutdown_start.strftime("%Y-%m-%d")
        metrics["shutdown_window_end"] = shutdown_end.strftime("%Y-%m-%d")
        
        return metrics
    
    def _get_drivers_for_day(self, day: int, metrics: dict) -> List[dict]:
        """Generate top 5 drivers with specific details"""
        drivers = []
        
        # Find closest anchor for baseline comparison
        closest_anchor = self.anchors[0]
        for anchor in self.anchors:
            if anchor["day"] <= day:
                closest_anchor = anchor
        
        # Polymer burden driver
        polymer_baseline = 180  # Day 1 baseline
        polymer_current = metrics["polymer_burden_kg_per_day"]
        if polymer_current > polymer_baseline * 1.5:
            severity = "high" if polymer_current > 800 else "medium"
            drift_start = max(1, day - int((polymer_current - polymer_baseline) / 50))
            drivers.append({
                "metric": "Polymer Burden",
                "current_value": f"{int(polymer_current)} kg/day",
                "baseline": f"{polymer_baseline} kg/day",
                "direction": "↑",
                "severity": severity,
                "since_day": drift_start,
                "trend_data": [polymer_baseline + (polymer_current - polymer_baseline) * i / 7 for i in range(8)]
            })
        
        # Filter change driver
        filter_baseline = 0.4
        filter_current = metrics["filter_change_count_per_day"]
        if filter_current > filter_baseline * 2:
            severity = "high" if filter_current > 2 else "medium"
            drivers.append({
                "metric": "Filter Change Frequency",
                "current_value": f"{filter_current:.1f}/day",
                "baseline": f"{filter_baseline}/day",
                "direction": "↑",
                "severity": severity,
                "since_day": max(1, day - 10),
                "trend_data": [filter_baseline + (filter_current - filter_baseline) * i / 7 for i in range(8)]
            })
        
        # Fouling risk driver
        fouling_baseline = 2.2
        fouling_current = metrics["fouling_risk_index"]
        if fouling_current > 4:
            severity = "high" if fouling_current > 6 else "medium"
            drivers.append({
                "metric": "Fouling Risk Index",
                "current_value": f"{fouling_current:.1f}/10",
                "baseline": f"{fouling_baseline}/10",
                "direction": "↑",
                "severity": severity,
                "since_day": max(1, day - 15),
                "trend_data": [fouling_baseline + (fouling_current - fouling_baseline) * i / 7 for i in range(8)]
            })
        
        # Inhibitor dose driver
        inhibitor_baseline = 1.0
        inhibitor_current = metrics["inhibitor_dose_index"]
        if inhibitor_current > 1.08:
            severity = "medium" if inhibitor_current < 1.2 else "high"
            drivers.append({
                "metric": "Inhibitor Dose Index",
                "current_value": f"{inhibitor_current:.2f}",
                "baseline": f"{inhibitor_baseline:.2f}",
                "direction": "↑",
                "severity": severity,
                "since_day": max(1, day - 20),
                "trend_data": [inhibitor_baseline + (inhibitor_current - inhibitor_baseline) * i / 7 for i in range(8)]
            })
        
        # Output decline driver
        output_baseline = 345
        output_current = metrics["eaa_output_tpd"]
        if output_current < output_baseline * 0.95:
            severity = "high" if output_current < 320 else "medium"
            drivers.append({
                "metric": "EAA Output Rate",
                "current_value": f"{int(output_current)} TPD",
                "baseline": f"{output_baseline} TPD",
                "direction": "↓",
                "severity": severity,
                "since_day": max(1, day - 25),
                "trend_data": [output_baseline - (output_baseline - output_current) * i / 7 for i in range(8)]
            })
        
        # Health score driver
        health_baseline = 92
        health_current = metrics["run_health_score"]
        if health_current < health_baseline - 10:
            severity = "high" if health_current < 70 else "medium"
            drivers.append({
                "metric": "Run Health Score",
                "current_value": f"{int(health_current)}",
                "baseline": f"{health_baseline}",
                "direction": "↓",
                "severity": severity,
                "since_day": max(1, day - 30),
                "trend_data": [health_baseline - (health_baseline - health_current) * i / 7 for i in range(8)]
            })
        
        # Sort by severity and return top 5
        severity_order = {"high": 0, "medium": 1, "low": 2}
        drivers.sort(key=lambda x: severity_order.get(x["severity"], 2))
        
        return drivers[:5]
    
    def _get_actions_for_day(self, day: int, metrics: dict) -> List[dict]:
        """Generate top 3 specific actions with full details"""
        actions = []
        
        # Find closest anchor
        closest_anchor = self.anchors[0]
        for anchor in self.anchors:
            if anchor["day"] <= day:
                closest_anchor = anchor
        
        # Action 1: Based on polymer burden
        if metrics["polymer_burden_kg_per_day"] > 400:
            actions.append({
                "id": f"ACT-{day:03d}-01",
                "priority": 1,
                "title": "Increase Flush Frequency",
                "metric": "Polymer Burden",
                "current_value": f"{int(metrics['polymer_burden_kg_per_day'])} kg/day",
                "baseline": "180 kg/day",
                "time_window": "Last 24h",
                "what": "Add +1 flush cycle per shift to G8, G9 filters",
                "where": ["G8", "G9", "V-014"],
                "why": "Polymer accumulation rate 2.3x baseline; preemptive flushing reduces filter change frequency",
                "checklist": [
                    "Verify flush line pressure at G8 (target: 4.5-5.0 bar)",
                    "Open flush valve for G9 and run 15-min cycle",
                    "Log polymer collection volume post-flush",
                    "Check DP across filters before/after (target drop: 0.2-0.4 bar)",
                    "Update shift log with flush completion time"
                ],
                "expected_effect": "Reduce polymer accumulation by 15-25% over next 48h (simulated)",
                "status": "New"
            })
        
        # Action 2: Based on filter changes
        if metrics["filter_change_count_per_day"] > 1.0:
            actions.append({
                "id": f"ACT-{day:03d}-02",
                "priority": 2,
                "title": "Schedule Preventive Filter Inspection",
                "metric": "Filter Change Frequency",
                "current_value": f"{metrics['filter_change_count_per_day']:.1f}/day",
                "baseline": "0.4/day",
                "time_window": "Last 48h",
                "what": "Conduct visual + DP inspection of high-frequency filters",
                "where": ["G8", "G9"],
                "why": "Filter changes at 3x baseline; early inspection prevents unplanned downtime",
                "checklist": [
                    "Take G8 offline during shift change window (06:00 or 18:00)",
                    "Measure DP across filter element (record value)",
                    "Visual inspection for polymer deposits (photograph if abnormal)",
                    "If DP > 1.2 bar or visible fouling, initiate replacement",
                    "Document inspection findings in maintenance log"
                ],
                "expected_effect": "Identify 1-2 filters nearing replacement; avoid unplanned change (simulated)",
                "status": "New"
            })
        
        # Action 3: Based on fouling risk
        if metrics["fouling_risk_index"] > 4.5:
            actions.append({
                "id": f"ACT-{day:03d}-03",
                "priority": 3,
                "title": "Tighten Temperature Operating Band",
                "metric": "Fouling Risk Index",
                "current_value": f"{metrics['fouling_risk_index']:.1f}/10",
                "baseline": "2.2/10",
                "time_window": "Last 72h",
                "what": "Reduce temperature setpoint tolerance on V-014, V-022",
                "where": ["V-014", "V-022", "E-015"],
                "why": "Elevated fouling risk correlates with temperature excursions; tighter control reduces polymer formation rate",
                "checklist": [
                    "Access DCS and navigate to V-014 temperature loop",
                    "Reduce high alarm from +3°C to +2°C above setpoint",
                    "Set V-022 outlet temp warning at current value +1°C",
                    "Brief incoming shift on tighter bands (verbal + logbook)",
                    "Monitor for 12h; if no alarms, bands are sustainable"
                ],
                "expected_effect": "Reduce temperature-driven polymer formation by 10-20% (simulated)",
                "status": "New"
            })
        
        # Action 4: Inhibitor check
        if metrics["inhibitor_dose_index"] > 1.1:
            actions.append({
                "id": f"ACT-{day:03d}-04",
                "priority": 4,
                "title": "Validate Inhibitor Injection Point",
                "metric": "Inhibitor Dose Index",
                "current_value": f"{metrics['inhibitor_dose_index']:.2f}",
                "baseline": "1.00",
                "time_window": "Last 7d trend",
                "what": "Inspect inhibitor injection line for partial blockage",
                "where": ["V-014", "V-012", "LV3601"],
                "why": "Dose creep suggests reduced injection efficiency; early detection prevents polymerization events",
                "checklist": [
                    "Isolate injection line LV3601 (coordinate with panel)",
                    "Flush line with cleaning solvent for 10 min",
                    "Check nozzle spray pattern (should be fine mist)",
                    "Measure flow rate and compare to baseline (±5% acceptable)",
                    "If blocked, replace nozzle and re-validate"
                ],
                "expected_effect": "Restore injection efficiency; dose index should stabilize at 1.05-1.08 (simulated)",
                "status": "New"
            })
        
        # Default actions if nothing triggered
        if len(actions) == 0:
            actions = [
                {
                    "id": f"ACT-{day:03d}-01",
                    "priority": 1,
                    "title": "Routine DP Trend Review",
                    "metric": "System DP",
                    "current_value": "Within band",
                    "baseline": "Within band",
                    "time_window": "Last 24h",
                    "what": "Verify DP trends on critical filters are stable",
                    "where": ["G8", "G9"],
                    "why": "Proactive monitoring catches drift before it becomes actionable",
                    "checklist": [
                        "Pull 24h DP trend from DCS historian",
                        "Confirm no upward drift > 0.1 bar/day",
                        "Note any step changes (investigate if found)",
                        "Document 'stable' in shift log"
                    ],
                    "expected_effect": "Maintain baseline performance; early warning if drift begins (simulated)",
                    "status": "New"
                }
            ]
        
        return actions[:3]
    
    def _generate_full_series(self) -> Dict[int, dict]:
        """Generate complete time series from Day 1 to Day 111"""
        series = {}
        
        for day in range(1, 112):
            # Reset RNG for this day (deterministic)
            self.rng.seed(self.seed + day)
            
            # Interpolate base metrics
            metrics = {
                "day": day,
                "run_health_score": self._get_jitter(self._interpolate(day, "run_health_score")),
                "predicted_remaining_days": int(self._interpolate(day, "predicted_remaining_days")),
                "prediction_ci_90pct_days": int(self._interpolate(day, "prediction_ci_90pct_days")),
                "eaa_output_tpd": self._get_jitter(self._interpolate(day, "eaa_output_tpd")),
                "polymer_burden_kg_per_day": self._get_jitter(self._interpolate(day, "polymer_burden_kg_per_day")),
                "filter_change_count_per_day": max(0, self._get_jitter(self._interpolate(day, "filter_change_count_per_day"))),
                "inhibitor_dose_index": self._get_jitter(self._interpolate(day, "inhibitor_dose_index")),
                "fouling_risk_index": self._get_jitter(self._interpolate(day, "fouling_risk_index")),
                "data_freshness_score": self._get_jitter(self._interpolate(day, "data_freshness_score")),
            }
            
            # Apply event effects
            metrics = self._apply_event_effects(day, metrics)
            
            # Clamp values
            metrics["run_health_score"] = max(0, min(100, metrics["run_health_score"]))
            metrics["fouling_risk_index"] = max(0, min(10, metrics["fouling_risk_index"]))
            metrics["filter_change_count_per_day"] = max(0, min(6, metrics["filter_change_count_per_day"]))
            
            # Calculate derived metrics
            metrics = self._calculate_derived_metrics(day, metrics)
            
            # Add drivers and actions
            metrics["drivers"] = self._get_drivers_for_day(day, metrics)
            metrics["actions"] = self._get_actions_for_day(day, metrics)
            
            series[day] = metrics
        
        return series
    
    def get_day_data(self, day: int) -> dict:
        """Get all metrics for a specific day"""
        day = max(1, min(111, day))
        return self.time_series.get(day, self.time_series[1])
    
    def get_time_series_range(self, start_day: int, end_day: int) -> List[dict]:
        """Get time series for a range of days"""
        return [self.time_series[d] for d in range(start_day, end_day + 1) if d in self.time_series]
    
    def get_what_changed(self, current_day: int) -> List[dict]:
        """Get what changed in last 7 days"""
        changes = []
        
        for day in range(max(1, current_day - 6), current_day + 1):
            day_data = self.time_series.get(day, {})
            prev_data = self.time_series.get(day - 1, {})
            
            # Check for events on this day
            events_today = [e for e in self.events if e["day"] == day]
            
            # Calculate deltas
            health_delta = day_data.get("run_health_score", 0) - prev_data.get("run_health_score", day_data.get("run_health_score", 0))
            remaining_delta = day_data.get("predicted_remaining_days", 0) - prev_data.get("predicted_remaining_days", day_data.get("predicted_remaining_days", 0))
            output_delta = day_data.get("eaa_output_tpd", 0) - prev_data.get("eaa_output_tpd", day_data.get("eaa_output_tpd", 0))
            
            change = {
                "day": day,
                "date": day_data.get("current_date_display", ""),
                "health_score": int(day_data.get("run_health_score", 0)),
                "health_delta": round(health_delta, 1),
                "remaining_days": day_data.get("predicted_remaining_days", 0),
                "remaining_delta": remaining_delta,
                "output_tpd": int(day_data.get("eaa_output_tpd", 0)),
                "output_delta": round(output_delta, 1),
                "events": events_today,
                "has_event": len(events_today) > 0
            }
            changes.append(change)
        
        return changes
    
    def simulate_what_if(self, day: int, adjustments: dict) -> dict:
        """Simulate what-if scenarios"""
        base_data = self.get_day_data(day).copy()
        
        cleaning_effect = adjustments.get("cleaning_cadence", 0)
        inhibitor_effect = adjustments.get("inhibitor_dose_index", 1.0)
        flush_effect = adjustments.get("flush_frequency", 0)
        discipline = adjustments.get("intervention_discipline", "medium")
        
        # Calculate effects
        risk_reduction = cleaning_effect * 0.08 + flush_effect * 0.05
        if discipline == "high":
            risk_reduction += 0.15
        elif discipline == "low":
            risk_reduction -= 0.10
        
        output_boost = cleaning_effect * 3 + flush_effect * 2
        if inhibitor_effect > 1.0:
            output_boost += (inhibitor_effect - 1.0) * 20
        
        # Calculate simulated metrics
        simulated = {
            "run_health_score": min(100, base_data["run_health_score"] + risk_reduction * 10),
            "predicted_remaining_days": int(base_data["predicted_remaining_days"] * (1 + risk_reduction * 0.3)),
            "eaa_output_tpd": base_data["eaa_output_tpd"] + output_boost,
            "fouling_risk_index": max(1, base_data["fouling_risk_index"] * (1 - risk_reduction)),
            "polymer_burden_kg_per_day": base_data["polymer_burden_kg_per_day"] * (1 - cleaning_effect * 0.1 - flush_effect * 0.05),
        }
        
        # Calculate end date
        base_date = self.start_date + timedelta(days=day - 1)
        predicted_end = base_date + timedelta(days=simulated["predicted_remaining_days"])
        simulated["predicted_end_date"] = predicted_end.strftime("%Y-%m-%d")
        
        # Cumulative output
        remaining = simulated["predicted_remaining_days"]
        simulated["expected_total_output_tons"] = int(base_data["cumulative_output_tons"] + simulated["eaa_output_tpd"] * remaining * 0.95)
        
        return {
            "baseline": base_data,
            "simulated": simulated,
            "adjustments": adjustments,
            "deltas": {
                "health_score": round(simulated["run_health_score"] - base_data["run_health_score"], 1),
                "remaining_days": simulated["predicted_remaining_days"] - base_data["predicted_remaining_days"],
                "output_tpd": round(simulated["eaa_output_tpd"] - base_data["eaa_output_tpd"], 1),
                "total_output": simulated["expected_total_output_tons"] - base_data["expected_total_output_tons"]
            }
        }

# Initialize simulation engine
sim_engine = SimulationEngine(seed=42)

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
    return {"message": "KR AA Run Health OS API", "status": "operational", "version": "2.0"}

@api_router.get("/run-info")
async def get_run_info():
    """Get golden run metadata"""
    return {
        "run_id": RUN_SEED["golden_run_candidate"]["run_id"],
        "start_ts": RUN_SEED["golden_run_candidate"]["start_ts"],
        "end_ts": RUN_SEED["golden_run_candidate"]["end_ts"],
        "target_days": RUN_SEED["kpi_targets"]["target_run_length_days"],
        "output_band": RUN_SEED["kpi_targets"]["target_output_tpd_band"],
        "assets": RUN_SEED["assets_dictionary"]
    }

@api_router.get("/day/{day}")
async def get_day_data(day: int):
    """Get all metrics for a specific day"""
    return sim_engine.get_day_data(day)

@api_router.get("/time-series")
async def get_time_series(start: int = 1, end: int = 111):
    """Get time series for a range of days"""
    return {
        "series": sim_engine.get_time_series_range(start, end),
        "total_days": end - start + 1
    }

@api_router.get("/what-changed/{day}")
async def get_what_changed(day: int):
    """Get what changed in last 7 days"""
    return {
        "current_day": day,
        "changes": sim_engine.get_what_changed(day)
    }

@api_router.get("/events")
async def get_events():
    """Get all operational events"""
    return {
        "events": OPS_EVENTS["events"],
        "shift_logs": OPS_EVENTS["shift_logs"],
        "lab_results": OPS_EVENTS["lab_results"],
        "pipeline_status": OPS_EVENTS["data_pipeline_status"]
    }

@api_router.post("/simulate")
async def simulate_what_if(request: SimulatorRequest):
    """Run what-if simulation"""
    return sim_engine.simulate_what_if(
        request.day,
        {
            "cleaning_cadence": request.cleaning_cadence,
            "inhibitor_dose_index": request.inhibitor_dose_index,
            "flush_frequency": request.flush_frequency,
            "intervention_discipline": request.intervention_discipline
        }
    )

@api_router.post("/actions/{action_id}/status")
async def update_action_status(action_id: str, update: ActionStatusUpdate):
    """Update action status - persists to MongoDB"""
    action_doc = {
        "action_id": action_id,
        "status": update.status,
        "reason_code": update.reason_code,
        "note": update.note,
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Upsert - update if exists, insert if not
    await db.action_statuses.update_one(
        {"action_id": action_id},
        {"$set": action_doc},
        upsert=True
    )
    
    return {
        "action_id": action_id,
        "new_status": update.status,
        "reason_code": update.reason_code,
        "note": update.note,
        "updated_at": action_doc["updated_at"].isoformat()
    }

@api_router.get("/actions/statuses")
async def get_all_action_statuses():
    """Get all persisted action statuses"""
    statuses = await db.action_statuses.find({}, {"_id": 0}).to_list(1000)
    return {"statuses": statuses}

@api_router.get("/actions/{action_id}/status")
async def get_action_status(action_id: str):
    """Get status of a specific action"""
    status = await db.action_statuses.find_one({"action_id": action_id}, {"_id": 0})
    if not status:
        return {"action_id": action_id, "status": "New"}
    return status

@api_router.get("/quick-days")
async def get_quick_days():
    """Get quick jump day options"""
    return {
        "days": [
            {"day": 1, "label": "Day 1", "phase": "Startup"},
            {"day": 7, "label": "Day 7", "phase": "Early"},
            {"day": 18, "label": "Day 18", "phase": "Early-Mid"},
            {"day": 30, "label": "Day 30", "phase": "Mid"},
            {"day": 70, "label": "Day 70", "phase": "Late"},
            {"day": 110, "label": "Day 110", "phase": "End"}
        ]
    }

@api_router.get("/intervention-window/{day}")
async def get_intervention_window(day: int):
    """Get recommended intervention window"""
    data = sim_engine.get_day_data(day)
    
    # Calculate optimal window based on risk trajectory
    if data["fouling_risk_index"] > 5:
        window_start = day + 3
        window_end = day + 10
        urgency = "high"
        reason = "Fouling risk elevated; intervention now reduces unplanned shutdown risk by ~25%"
    elif data["fouling_risk_index"] > 3.5:
        window_start = day + 7
        window_end = day + 15
        urgency = "medium"
        reason = "Proactive window; intervention here extends run by estimated 5-10 days"
    else:
        window_start = None
        window_end = None
        urgency = "low"
        reason = "No immediate intervention needed; continue monitoring"
    
    return {
        "current_day": day,
        "window_start": window_start,
        "window_end": window_end,
        "urgency": urgency,
        "reason": reason
    }

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
