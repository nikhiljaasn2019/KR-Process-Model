# KR AA Run Health OS - Product Requirements Document

## Version 2.1 - V1/V2 Merge (Feb 2026)

## Original Problem Statement
Build a conviction prototype for BPCL Kochi Refinery Acrylic Acid unit that makes the ED + operators feel: "We desperately need this to achieve long AND predictable runs (>= golden run) and to plan output + shutdowns."

## V2.1 Merge Requirements
Create V2.1 by merging the best of V1 (action-oriented) and V2 (simulation-oriented):
1. **Restore "Today's Moves"** - V1's specific, actionable recommendations with persistent statuses
2. **Simplify navigation** - Reduce to 2 items: Mission Control and Simulator
3. **Embed Evidence** - Convert Evidence page to drawer/modal accessible from Mission Control
4. **Light theme** - Clean, readable light theme throughout
5. **Keep V2 Simulator** - Retain the What-If simulator with 4 operating levers
6. **Persist action statuses** - Acknowledge, Done, Not Feasible statuses stored in MongoDB

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

### Database
- **MongoDB**: Action status persistence (action_statuses collection)

## Navigation (2 Items Only)
1. **Mission Control** - The cockpit (default) with embedded Evidence drawer
2. **Simulator** - What-if scenarios

## Key Features Implemented

### Mission Control (Cockpit)
- Global status strip (Feed: Healthy/Delayed/Interrupted)
- Day slider (1-111) + quick jump buttons (Day 1, 7, 18, 30, 70, 110)
- Evidence button to open drawer
- 4 Hero KPI tiles:
  - Run Health Score (0-100 gauge with Healthy/Watch/At Risk states)
  - Predicted Run End (date + CI)
  - Predictability (Low/Med/High + visual bands)
  - Output Today (TPD + cumulative + expected total)
- Golden Progress Bar with projection overlay
- Run Plan: Output trajectory chart with intervention window
- Top 5 Drivers with sparklines and severity indicators
- Fouling & Polymer Build metrics with mini chart
- What Changed mini timeline (last 7 days)
- Today's Moves (sticky right rail):
  - 3-5 action cards with expand/collapse
  - Metrics: Current value, Baseline, Assets
  - Why explanation and Action Checklist
  - Expected effect indicator
  - **Action buttons: Acknowledge, Done, Not Feasible**
  - **Reason code dialog for Not Feasible** (6 options)
  - **Status persistence across sessions**

### Evidence Drawer
- Filter chips: All Events, Polymer/Filters, Temperature, Fouling Risk, Rescue Mode, Prediction Shifts
- Event cards with severity badges (HIGH/MEDIUM/LOW)
- Asset tags and operator notes
- Recent shift logs with flags (WATCH, HIGH_RISK)
- Data pipeline status (OK/LATE/BROKEN)

### Simulator
- 4 Operating Levers:
  - Cleaning cadence (baseline/+1/+2 cycles/wk)
  - Inhibitor dose index (0.9-1.3)
  - Flush frequency (baseline/+1/day)
  - Intervention discipline (low/med/high)
- Before vs After comparison with delta indicators
- Simulated end date and total output projections
- Key insight message

## Testing Results (V2.1)
- Backend: 100% (27/27 tests passed)
- Frontend: 100%
- All day scenarios tested (1, 7, 18, 30, 70, 110)
- Action status persistence verified
- Evidence drawer verified
- Light theme verified

## API Endpoints
- `GET /api/` - Health check
- `GET /api/run-info` - Golden run metadata
- `GET /api/day/{day}` - Day metrics with drivers and actions
- `GET /api/time-series?start=&end=` - Time series data
- `GET /api/what-changed/{day}` - Last 7 days changes
- `GET /api/events` - Events, shift logs, lab results, pipeline status
- `GET /api/quick-days` - Quick jump options
- `POST /api/simulate` - What-if simulation
- `GET /api/actions/statuses` - All action statuses
- `GET /api/actions/{action_id}/status` - Single action status
- `POST /api/actions/{action_id}/status` - Update action status

## Files Reference
- Backend: `/app/backend/server.py`
- Data: `/app/data/sim/run_seed.json`, `/app/data/sim/ops_events.json`
- Frontend: `/app/frontend/src/App.js`, `/app/frontend/src/pages/MissionControl.js`, `Simulator.js`
- Styles: `/app/frontend/src/App.css`

## Completed in V2.1
- [x] Merged V1 and V2 branches
- [x] Restored "Today's Moves" with action statuses
- [x] Simplified navigation to 2 items
- [x] Converted Evidence page to drawer
- [x] Applied light theme
- [x] Action status persistence in MongoDB
- [x] Reason code dialog for Not Feasible
- [x] Full testing passed

## Next Action Items
1. Add shift handover report export
2. Add action completion impact on simulation (when action marked Done, show projected benefit)
3. Add notification/alert system for critical events
4. Consider role-based access (ED vs Operator views)

## Backlog
- Multi-run comparison view
- Historical run analysis
- ML model integration for real predictions
- Mobile-responsive design
- Real-time data pipeline integration
