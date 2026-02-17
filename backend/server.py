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
    
    def _calculate_derived_metrics(self, day: int, metrics: dict) -> dict:
        """Calculate derived/computed metrics with FUTURE-LOOKING dates"""
        
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
        
        # ========== FUTURE-LOOKING DATE LOGIC ==========
        # Run start date = today - (currentDay - 1) days
        # This makes all dates appear plausible and future-looking
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        run_start_date = today - timedelta(days=day - 1)
        current_date = today  # "Today" in the simulation
        predicted_end = today + timedelta(days=remaining)  # Forecast end from today
        
        metrics["predicted_end_date"] = predicted_end.strftime("%Y-%m-%d")
        metrics["predicted_end_date_early"] = (predicted_end - timedelta(days=ci)).strftime("%Y-%m-%d")
        metrics["predicted_end_date_late"] = (predicted_end + timedelta(days=ci)).strftime("%Y-%m-%d")
        
        # Current date (today)
        metrics["current_date"] = current_date.strftime("%Y-%m-%d")
        metrics["current_date_display"] = current_date.strftime("%d %b %Y")
        metrics["run_start_date"] = run_start_date.strftime("%Y-%m-%d")
        
        # ========== TOTAL RUN LENGTH (intuitive metric) ==========
        # predicted_total_run_length = current_day + predicted_remaining_days
        metrics["predicted_total_run_length"] = day + remaining
        metrics["predicted_total_run_length_p90"] = day + remaining - int(ci * 0.5)
        metrics["predicted_total_run_length_p10"] = day + remaining + int(ci * 0.5)
        
        # ========== BENCHMARK GAP CALCULATIONS ==========
        benchmark_target_days = 111  # Current Best Run length
        forecast_end_day = day + remaining
        metrics["benchmark_gap_days"] = forecast_end_day - benchmark_target_days  # positive = ahead
        metrics["benchmark_target_days"] = benchmark_target_days
        metrics["forecast_end_day_p50"] = forecast_end_day
        metrics["forecast_end_day_p90"] = forecast_end_day - int(ci * 0.5)  # P90 = pessimistic
        metrics["forecast_end_day_p10"] = forecast_end_day + int(ci * 0.5)  # P10 = optimistic
        
        # End dates for P10/P50/P90 (all future-looking)
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
        
        # Shutdown window (P90 - conservative) - future-looking
        shutdown_start = predicted_end - timedelta(days=int(ci * 0.7))
        shutdown_end = predicted_end + timedelta(days=int(ci * 0.3))
        metrics["shutdown_window_start"] = shutdown_start.strftime("%Y-%m-%d")
        metrics["shutdown_window_end"] = shutdown_end.strftime("%Y-%m-%d")
        
        # ========== BENCHMARK POLYMER DATA (rising, not flat) ==========
        # Benchmark polymer should be plausible rising trajectory (lower than actual)
        base_polymer = 120  # Starting benchmark polymer
        polymer_growth_rate = 2.5  # kg/day increase per run day
        metrics["benchmark_polymer_kg_per_day"] = base_polymer + (day * polymer_growth_rate * 0.8)  # 80% of actual growth
        
        # ========== BENCHMARK OUTPUT DATA ==========
        metrics["benchmark_output_tpd"] = 340  # Benchmark daily output
        metrics["benchmark_cumulative_tons"] = int(340 * day * 0.98)  # Benchmark cumulative
        
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
        """Generate urgent, specific actions with full details for critical days"""
        actions = []
        is_critical_day = day in [52, 70, 96] or day >= 90
        
        # Calculate deviations for triggers
        polymer_baseline = 180
        polymer_current = metrics["polymer_burden_kg_per_day"]
        polymer_deviation = ((polymer_current - polymer_baseline) / polymer_baseline) * 100
        
        filter_baseline = 0.4
        filter_current = metrics["filter_change_count_per_day"]
        filter_deviation = ((filter_current - filter_baseline) / filter_baseline) * 100
        
        fouling_baseline = 2.2
        fouling_current = metrics["fouling_risk_index"]
        fouling_deviation = ((fouling_current - fouling_baseline) / fouling_baseline) * 100
        
        inhibitor_baseline = 1.0
        inhibitor_current = metrics["inhibitor_dose_index"]
        inhibitor_deviation = ((inhibitor_current - inhibitor_baseline) / inhibitor_baseline) * 100
        
        # Critical day urgent actions (NOT routine) 
        if is_critical_day and metrics["polymer_burden_kg_per_day"] > 600:
            actions.append({
                "id": f"ACT-{day:03d}-01",
                "priority": 1,
                "urgency": "critical",
                "title": "Emergency Flush Cycle + Filter Swap",
                "protects": "Run Length",
                "trigger": {
                    "metric": "Polymer Burden",
                    "current": f"{int(polymer_current)} kg/day",
                    "baseline": f"{polymer_baseline} kg/day",
                    "band": "150-220 kg/day",
                    "deviation": f"+{polymer_deviation:.0f}%",
                    "time_window": "Last 24h"
                },
                "where": ["G8", "G9", "V-014", "V-022"],
                "why": f"Polymer at {polymer_deviation:.0f}% above baseline threatens run termination within 7-10 days without intervention",
                "checklist": [
                    "IMMEDIATE: Initiate emergency flush on G8 (20 min cycle, max pressure)",
                    "Swap G9 filter element if DP > 1.0 bar",
                    "Increase inhibitor flow by 5% for next 48h",
                    "Log polymer collection volume (target: >50kg removal)",
                    "Brief oncoming shift: 'Run rescue protocol active'",
                    "Schedule follow-up inspection at +24h"
                ],
                "expected_effect": {
                    "run_length": "+4 to +8 days (simulated)",
                    "polymer_slope": "↓ flatten for 72h",
                    "confidence": "Medium-High"
                },
                "impact_on_done": {
                    "remaining_days_delta": 6,
                    "health_score_delta": 3,
                    "polymer_reduction_pct": 20,
                    "ci_tightening_days": 1
                },
                "status": "New"
            })
        elif metrics["polymer_burden_kg_per_day"] > 400:
            actions.append({
                "id": f"ACT-{day:03d}-01",
                "priority": 1,
                "urgency": "high" if is_critical_day else "medium",
                "title": "Increase Flush Frequency",
                "protects": "Run Length",
                "trigger": {
                    "metric": "Polymer Burden",
                    "current": f"{int(polymer_current)} kg/day",
                    "baseline": f"{polymer_baseline} kg/day",
                    "band": "150-220 kg/day",
                    "deviation": f"+{polymer_deviation:.0f}%",
                    "time_window": "Last 24h"
                },
                "where": ["G8", "G9", "V-014"],
                "why": f"Polymer accumulation at {polymer_deviation:.0f}% above baseline; preemptive flushing reduces filter change frequency",
                "checklist": [
                    "Verify flush line pressure at G8 (target: 4.5-5.0 bar)",
                    "Open flush valve for G9 and run 15-min cycle",
                    "Log polymer collection volume post-flush",
                    "Check DP across filters before/after (target drop: 0.2-0.4 bar)",
                    "Update shift log with flush completion time"
                ],
                "expected_effect": {
                    "run_length": "+2 to +4 days (simulated)",
                    "polymer_slope": "↓ reduce by 15-25% over 48h",
                    "confidence": "Medium"
                },
                "impact_on_done": {
                    "remaining_days_delta": 3,
                    "health_score_delta": 2,
                    "polymer_reduction_pct": 15,
                    "ci_tightening_days": 0
                },
                "status": "New"
            })
        
        # Critical: Fouling risk cluster response
        if is_critical_day and metrics["fouling_risk_index"] > 5.5:
            actions.append({
                "id": f"ACT-{day:03d}-02",
                "priority": 1 if len(actions) == 0 else 2,
                "urgency": "critical",
                "title": "Activate Run Rescue Mode",
                "protects": "Both",
                "trigger": {
                    "metric": "Fouling Risk Index",
                    "current": f"{fouling_current:.1f}/10",
                    "baseline": f"{fouling_baseline}/10",
                    "band": "1.5-3.0/10",
                    "deviation": f"+{fouling_deviation:.0f}%",
                    "time_window": "Last 72h trend"
                },
                "where": ["V-014", "V-022", "E-015", "G8", "G9"],
                "why": f"Fouling risk at {fouling_current:.1f} indicates imminent polymer cascade; rescue mode slows deterioration",
                "checklist": [
                    "Declare 'Run Rescue Mode' in shift log (triggers enhanced monitoring)",
                    "Reduce temperature bands on V-014, V-022 by 1°C",
                    "Increase cleaning cadence: +1 cycle per shift",
                    "Inhibitor dose: increase by 8% for 72h",
                    "Hourly DP checks on G8, G9 (log all readings)",
                    "Alert maintenance: potential filter swap in 24-48h"
                ],
                "expected_effect": {
                    "run_length": "+5 to +10 days (simulated)",
                    "risk_slope": "↓ reduce compounding by 30%",
                    "confidence": "Medium"
                },
                "impact_on_done": {
                    "remaining_days_delta": 7,
                    "health_score_delta": 5,
                    "polymer_reduction_pct": 25,
                    "ci_tightening_days": 2
                },
                "status": "New"
            })
        elif metrics["fouling_risk_index"] > 4.5:
            actions.append({
                "id": f"ACT-{day:03d}-02",
                "priority": 2 if len(actions) > 0 else 1,
                "urgency": "high" if is_critical_day else "medium",
                "title": "Tighten Temperature Operating Band",
                "protects": "Run Length",
                "trigger": {
                    "metric": "Fouling Risk Index",
                    "current": f"{fouling_current:.1f}/10",
                    "baseline": f"{fouling_baseline}/10",
                    "band": "1.5-3.0/10",
                    "deviation": f"+{fouling_deviation:.0f}%",
                    "time_window": "Last 72h"
                },
                "where": ["V-014", "V-022", "E-015"],
                "why": f"Fouling risk elevated at +{fouling_deviation:.0f}%; tighter temp control reduces polymer formation",
                "checklist": [
                    "Access DCS and navigate to V-014 temperature loop",
                    "Reduce high alarm from +3°C to +2°C above setpoint",
                    "Set V-022 outlet temp warning at current value +1°C",
                    "Brief incoming shift on tighter bands (verbal + logbook)",
                    "Monitor for 12h; if no alarms, bands are sustainable"
                ],
                "expected_effect": {
                    "run_length": "+2 to +5 days (simulated)",
                    "polymer_slope": "↓ reduce formation by 10-20%",
                    "confidence": "Medium"
                },
                "impact_on_done": {
                    "remaining_days_delta": 3,
                    "health_score_delta": 2,
                    "polymer_reduction_pct": 12,
                    "ci_tightening_days": 1
                },
                "status": "New"
            })
        
        # Filter inspection (if filter changes elevated)
        if metrics["filter_change_count_per_day"] > 1.0:
            actions.append({
                "id": f"ACT-{day:03d}-03",
                "priority": len(actions) + 1,
                "urgency": "high" if filter_current > 2.0 else "medium",
                "title": "Schedule Preventive Filter Inspection",
                "protects": "Productivity",
                "trigger": {
                    "metric": "Filter Change Frequency",
                    "current": f"{filter_current:.1f}/day",
                    "baseline": f"{filter_baseline}/day",
                    "band": "0.3-0.6/day",
                    "deviation": f"+{filter_deviation:.0f}%",
                    "time_window": "Last 48h"
                },
                "where": ["G8", "G9"],
                "why": f"Filter changes at +{filter_deviation:.0f}% of baseline; early inspection prevents unplanned downtime",
                "checklist": [
                    "Take G8 offline during shift change window (06:00 or 18:00)",
                    "Measure DP across filter element (record value)",
                    "Visual inspection for polymer deposits (photograph if abnormal)",
                    "If DP > 1.2 bar or visible fouling, initiate replacement",
                    "Document inspection findings in maintenance log"
                ],
                "expected_effect": {
                    "productivity": "Avoid 2-4h unplanned downtime (simulated)",
                    "filter_life": "Extend by identifying issues early",
                    "confidence": "High"
                },
                "impact_on_done": {
                    "remaining_days_delta": 1,
                    "health_score_delta": 1,
                    "polymer_reduction_pct": 5,
                    "ci_tightening_days": 0
                },
                "status": "New"
            })
        
        # Inhibitor check
        if metrics["inhibitor_dose_index"] > 1.1:
            actions.append({
                "id": f"ACT-{day:03d}-04",
                "priority": len(actions) + 1,
                "urgency": "medium",
                "title": "Validate Inhibitor Injection Point",
                "protects": "Run Length",
                "trigger": {
                    "metric": "Inhibitor Dose Index",
                    "current": f"{inhibitor_current:.2f}",
                    "baseline": f"{inhibitor_baseline:.2f}",
                    "band": "0.95-1.08",
                    "deviation": f"+{inhibitor_deviation:.0f}%",
                    "time_window": "Last 7d trend"
                },
                "where": ["V-014", "V-012", "LV3601"],
                "why": f"Dose creep at +{inhibitor_deviation:.0f}% suggests reduced injection efficiency; early fix prevents polymerization",
                "checklist": [
                    "Isolate injection line LV3601 (coordinate with panel)",
                    "Flush line with cleaning solvent for 10 min",
                    "Check nozzle spray pattern (should be fine mist)",
                    "Measure flow rate and compare to baseline (±5% acceptable)",
                    "If blocked, replace nozzle and re-validate"
                ],
                "expected_effect": {
                    "run_length": "+1 to +3 days (simulated)",
                    "dose_index": "Stabilize at 1.05-1.08",
                    "confidence": "Medium"
                },
                "impact_on_done": {
                    "remaining_days_delta": 2,
                    "health_score_delta": 1,
                    "polymer_reduction_pct": 8,
                    "ci_tightening_days": 0
                },
                "status": "New"
            })
        
        # Default routine action only if nothing else triggered
        if len(actions) == 0:
            actions = [
                {
                    "id": f"ACT-{day:03d}-01",
                    "priority": 1,
                    "urgency": "routine",
                    "title": "Routine DP Trend Review",
                    "protects": "Both",
                    "trigger": {
                        "metric": "System DP",
                        "current": "Within band",
                        "baseline": "Within band",
                        "band": "Normal",
                        "deviation": "0%",
                        "time_window": "Last 24h"
                    },
                    "where": ["G8", "G9"],
                    "why": "Proactive monitoring catches drift before it becomes actionable",
                    "checklist": [
                        "Pull 24h DP trend from DCS historian",
                        "Confirm no upward drift > 0.1 bar/day",
                        "Note any step changes (investigate if found)",
                        "Document 'stable' in shift log"
                    ],
                    "expected_effect": {
                        "run_length": "Maintain baseline (simulated)",
                        "early_warning": "Detect drift before critical",
                        "confidence": "High"
                    },
                    "impact_on_done": {
                        "remaining_days_delta": 0,
                        "health_score_delta": 0,
                        "polymer_reduction_pct": 0,
                        "ci_tightening_days": 0
                    },
                    "status": "New"
                }
            ]
        
        # Sort by priority and return top 3
        actions.sort(key=lambda x: x["priority"])
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

@api_router.delete("/actions/statuses/clear")
async def clear_all_action_statuses():
    """Clear all action statuses (for demo reset)"""
    result = await db.action_statuses.delete_many({})
    return {"deleted_count": result.deleted_count}

@api_router.get("/actions/{action_id}/status")
async def get_action_status(action_id: str):
    """Get status of a specific action"""
    status = await db.action_statuses.find_one({"action_id": action_id}, {"_id": 0})
    if not status:
        return {"action_id": action_id, "status": "New"}
    return status

@api_router.get("/quick-days")
async def get_quick_days():
    """Get quick jump day options - critical moments"""
    return {
        "days": [
            {"day": 7, "label": "Day 7", "phase": "Early", "moment": "Startup stable"},
            {"day": 30, "label": "Day 30", "phase": "Mid", "moment": "First trends"},
            {"day": 52, "label": "Day 52", "phase": "Mid-Late", "moment": "Polymer drift"},
            {"day": 70, "label": "Day 70", "phase": "Critical", "moment": "Rescue window"},
            {"day": 96, "label": "Day 96", "phase": "Late", "moment": "End game"},
            {"day": 110, "label": "Day 110", "phase": "End", "moment": "Final stretch"}
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
    
    # Cap the effects at reasonable bounds
    total_remaining_delta = min(total_remaining_delta, 15)
    total_health_delta = min(total_health_delta, 10)
    total_polymer_reduction = min(total_polymer_reduction, 40)
    total_ci_tightening = min(total_ci_tightening, 4)
    
    remaining_base = base_data["predicted_remaining_days"]
    health_base = base_data["run_health_score"]
    ci_base = base_data["prediction_ci_90pct_days"]
    
    # "Do Nothing" scenario (current trajectory)
    do_nothing = {
        "predicted_remaining_days": remaining_base,
        "forecast_end_day": base_data["forecast_end_day_p50"],
        "predicted_end_date_p50": base_data["predicted_end_date_p50"],
        "predicted_end_date_p90": base_data["predicted_end_date_p90"],
        "benchmark_gap_days": base_data.get("benchmark_gap_days", base_data.get("golden_gap_days", 0)),
        "run_health_score": health_base,
        "output_p50_tons": base_data["output_p50_tons"],
        "output_p90_tons": base_data["output_p90_tons"],
        "output_p10_tons": base_data["output_p10_tons"],
        "shutdown_window_start": base_data["shutdown_window_start"],
        "shutdown_window_end": base_data["shutdown_window_end"],
        "ci_days": ci_base
    }
    
    # "Execute Moves" scenario (with action impacts) - USE FUTURE-LOOKING DATES
    new_remaining = remaining_base + total_remaining_delta
    new_health = min(100, health_base + total_health_delta)
    new_ci = max(2, ci_base - total_ci_tightening)
    new_polymer = base_data["polymer_burden_kg_per_day"] * (1 - total_polymer_reduction / 100)
    
    # Recalculate end dates using future-looking logic
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    new_end_date = today + timedelta(days=new_remaining)
    
    new_forecast_end_day = day + new_remaining
    new_benchmark_gap = new_forecast_end_day - 111
    
    # Recalculate outputs
    avg_output = base_data["eaa_output_tpd"] * 0.95
    new_output_p50 = int(base_data["cumulative_output_tons"] + avg_output * new_remaining)
    new_output_p90 = int(base_data["cumulative_output_tons"] + avg_output * 0.92 * (new_remaining - int(new_ci * 0.5)))
    new_output_p10 = int(base_data["cumulative_output_tons"] + avg_output * 1.02 * (new_remaining + int(new_ci * 0.5)))
    
    execute_moves = {
        "predicted_remaining_days": new_remaining,
        "forecast_end_day": new_forecast_end_day,
        "predicted_end_date_p50": new_end_date.strftime("%Y-%m-%d"),
        "predicted_end_date_p90": (new_end_date - timedelta(days=int(new_ci * 0.5))).strftime("%Y-%m-%d"),
        "benchmark_gap_days": new_benchmark_gap,
        "run_health_score": new_health,
        "output_p50_tons": new_output_p50,
        "output_p90_tons": new_output_p90,
        "output_p10_tons": new_output_p10,
        "shutdown_window_start": (new_end_date - timedelta(days=int(new_ci * 0.7))).strftime("%Y-%m-%d"),
        "shutdown_window_end": (new_end_date + timedelta(days=int(new_ci * 0.3))).strftime("%Y-%m-%d"),
        "ci_days": new_ci,
        "polymer_burden_kg_per_day": int(new_polymer)
    }
    
    # Deltas
    deltas = {
        "remaining_days": total_remaining_delta,
        "health_score": total_health_delta,
        "benchmark_gap": new_benchmark_gap - base_data.get("benchmark_gap_days", base_data.get("golden_gap_days", 0)),
        "output_p50": new_output_p50 - base_data["output_p50_tons"],
        "ci_days": -total_ci_tightening
    }
    
    return {
        "day": day,
        "do_nothing": do_nothing,
        "execute_moves": execute_moves,
        "deltas": deltas,
        "actions_count": len(actions)
    }

@api_router.post("/apply-action-impact/{day}")
async def apply_action_impact(day: int, action_ids: List[str] = []):
    """Calculate metrics after applying completed actions"""
    base_data = sim_engine.get_day_data(day).copy()
    
    # Get completed action statuses from DB
    completed_statuses = await db.action_statuses.find(
        {"status": "Done"},
        {"_id": 0}
    ).to_list(100)
    
    completed_ids = set(s["action_id"] for s in completed_statuses)
    completed_ids.update(action_ids)  # Include any passed in directly
    
    # Get today's actions
    actions = base_data.get("actions", [])
    
    # Calculate cumulative impact
    total_remaining_delta = 0
    total_health_delta = 0
    total_polymer_reduction = 0
    total_ci_tightening = 0
    
    for action in actions:
        if action["id"] in completed_ids:
            impact = action.get("impact_on_done", {})
            total_remaining_delta += impact.get("remaining_days_delta", 0)
            total_health_delta += impact.get("health_score_delta", 0)
            total_polymer_reduction += impact.get("polymer_reduction_pct", 0)
            total_ci_tightening += impact.get("ci_tightening_days", 0)
    
    # Apply impacts
    adjusted = base_data.copy()
    adjusted["predicted_remaining_days"] = base_data["predicted_remaining_days"] + min(total_remaining_delta, 15)
    adjusted["run_health_score"] = min(100, base_data["run_health_score"] + min(total_health_delta, 10))
    adjusted["polymer_burden_kg_per_day"] = base_data["polymer_burden_kg_per_day"] * (1 - min(total_polymer_reduction, 40) / 100)
    adjusted["prediction_ci_90pct_days"] = max(2, base_data["prediction_ci_90pct_days"] - min(total_ci_tightening, 4))
    
    # Recalculate derived metrics
    remaining = adjusted["predicted_remaining_days"]
    ci = adjusted["prediction_ci_90pct_days"]
    start_date = datetime.fromisoformat(sim_engine.golden_run["start_ts"].replace("+05:30", "+05:30"))
    base_date = start_date + timedelta(days=day - 1)
    predicted_end = base_date + timedelta(days=remaining)
    
    adjusted["predicted_end_date"] = predicted_end.strftime("%Y-%m-%d")
    adjusted["predicted_end_date_p50"] = predicted_end.strftime("%Y-%m-%d")
    adjusted["predicted_end_date_p90"] = (predicted_end - timedelta(days=int(ci * 0.5))).strftime("%Y-%m-%d")
    adjusted["forecast_end_day_p50"] = day + remaining
    adjusted["golden_gap_days"] = (day + remaining) - 111
    
    # Recalculate outputs
    avg_output = adjusted["eaa_output_tpd"] * 0.95
    adjusted["output_p50_tons"] = int(base_data["cumulative_output_tons"] + avg_output * remaining)
    adjusted["output_p90_tons"] = int(base_data["cumulative_output_tons"] + avg_output * 0.92 * (remaining - int(ci * 0.5)))
    adjusted["output_p10_tons"] = int(base_data["cumulative_output_tons"] + avg_output * 1.02 * (remaining + int(ci * 0.5)))
    
    return {
        "day": day,
        "baseline": base_data,
        "adjusted": adjusted,
        "completed_actions": list(completed_ids),
        "impact_applied": {
            "remaining_days_delta": min(total_remaining_delta, 15),
            "health_delta": min(total_health_delta, 10),
            "polymer_reduction_pct": min(total_polymer_reduction, 40),
            "ci_tightening_days": min(total_ci_tightening, 4)
        }
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
