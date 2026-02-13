# KR AA Run Health OS - Product Requirements Document

## Version 2.0 - Complete Rebuild (Jan 2026)

## Original Problem Statement
Build a conviction prototype for BPCL Kochi Refinery Acrylic Acid unit that makes the ED + operators feel: "We desperately need this to achieve long AND predictable runs (>= golden run) and to plan output + shutdowns."

## User Personas
- **Executive Director (ED)**: Needs high-level visibility into run health, predictability, and planning
- **Plant Operators**: Need specific, actionable guidance with asset tags and checklists
- **Process Engineers**: Need evidence and data to support decisions

## Architecture

### Data Files (Static)
- `/data/sim/run_seed.json` - Anchor points for 6 key days (1, 7, 18, 30, 70, 110)
- `/data/sim/ops_events.json` - Operational events, shift logs, lab results, pipeline status

### Simulation Engine
- Piecewise linear interpolation between anchor points
- Deterministic jitter (seed=42, max 2.5%)
- Event overrides/spikes from ops_events.json
- Correlation rules: polymer↑ → filter changes↑ → output↓

## Navigation (3 Items Only)
1. **Mission Control** - The cockpit (default)
2. **Simulator** - What-if scenarios
3. **Evidence** - Event timeline, shift logs, data pipeline

## Key Features Implemented

### Mission Control (Cockpit)
- Global status strip (Feed: Healthy/Delayed/Interrupted)
- Day slider (1-111) + quick jump buttons (Day 1, 7, 18, 30, 70, 110)
- 4 Hero KPI tiles:
  - Run Health Score (0-100 gauge)
  - Predicted Run End (date + CI)
  - Predictability (Low/Med/High + visual)
  - Output Today (TPD + cumulative)
- Golden Progress Bar with projection overlay
- Run Plan: Output trajectory chart with intervention window
- Top 5 Drivers with sparklines
- Fouling & Polymer Build metrics
- What Changed mini timeline (last 7 days)
- Today's 3 Moves (sticky right rail)

### Simulator
- 4 Operating Levers:
  - Cleaning cadence (baseline/+1/+2)
  - Inhibitor dose index (0.9-1.3)
  - Flush frequency (baseline/+1)
  - Intervention discipline (low/med/high)
- Before vs After comparison with delta indicators
- Simulated end date and total output projections

### Evidence
- Event timeline with filters (Polymer/Filters, Temperature, Fouling Risk, Rescue Mode, Prediction Shifts)
- Shift logs with flags (WATCH, HIGH_RISK)
- Lab results
- Data Pipeline status (OK/LATE/BROKEN)

## Testing Results
- Backend: 100% success rate
- Frontend: 95% success rate
- All 6 day scenarios tested (1, 7, 18, 30, 70, 110)

## Next Action Items
1. Add "Not Feasible" reason codes dialog (Utility constraint, Equipment issue, etc.)
2. Implement action status persistence (Done/Acknowledged logging)
3. Add prediction shift tracking over time
4. Consider adding shift handover report export

## Files Reference
- Backend: `/app/backend/server.py`
- Data: `/app/data/sim/run_seed.json`, `/app/data/sim/ops_events.json`
- Frontend: `/app/frontend/src/pages/MissionControl.js`, `Simulator.js`, `Evidence.js`
