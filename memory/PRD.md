# KR AA Run Health OS - Product Requirements Document

## Version 2.2 - Decision Instrument (Feb 2026)

## Original Problem Statement
Build a conviction prototype for BPCL Kochi Refinery Acrylic Acid unit that makes the ED + operators feel: "We desperately need this to achieve long AND predictable runs (>= golden run) and to plan output + shutdowns."

## PRIMARY GOAL: Decision Instrument
Transform from a status dashboard into a **DECISION INSTRUMENT** that answers 3 critical questions:
1. **Are we going to BEAT the golden run (111 days)?**
2. **What output can we COMMIT to customers, with confidence bands?**
3. **What EXACT actions must happen today/this week — and do they change the forecast?**

## Key Features Implemented (V2.2)

### A) Default Landing = Critical Moment (Day 70)
- Landing day changed from Day 1 to **Day 70** (rescue window)
- Quick jump buttons: **7, 30, 52, 70, 96, 110** (critical moments)
- Each button labeled with phase and moment description

### B) Golden Gap Tile
- **Golden Target**: 111 days
- **Forecast P50/P90**: Predicted end dates
- **Gap to Golden**: Days ahead/behind target (+4 to +18 depending on scenario)
- Visual status: "On track to beat Golden" (green) / "Behind Golden target" (red)

### C) Commitment View (for ED)
- **P90 Committed Output**: Conservative estimate (33,820 tons)
- **P50 Expected Output**: Base case (35,800 tons)
- **P10 Upside Output**: Optimistic estimate (37,032 tons)
- **Shutdown Window (P90)**: Date range for planning

### D) Scenario Toggle
Side-by-side comparison: **"If we do nothing"** vs **"If we execute Today's Moves"**
- Switching scenarios updates:
  - Golden Gap (+4 → +18 days)
  - Days Remaining (45 → 59 days)
  - Run Health Score (75 → 84)
  - All P10/P50/P90 output projections
  - Shutdown Window
- "SIMULATED" badges appear when Execute Moves selected

### E) Today's Moves - Urgent Actions
Each action card includes:
- **Urgency Level**: CRITICAL, HIGH, MEDIUM, ROUTINE
- **Protects**: Run Length / Productivity / Both
- **Trigger Section**:
  - Metric name
  - Current value
  - Baseline value
  - Normal band
  - Deviation percentage (e.g., +448%)
  - Time window (Last 24h/48h/72h/7d)
- **Assets**: Equipment tags (G8, G9, V-014, V-022, etc.)
- **Why**: Explanation with numbers + timeframe
- **Action Checklist**: Numbered specific steps
- **Expected Effect**: 
  - Run Length impact (e.g., "+4 to +8 days (simulated)")
  - Polymer/Risk slope impact
  - Confidence level
- **Impact Preview**: Shows delta when action marked Done

### F) Actions Change Outcomes
When a user marks an action **Done**:
- **Immediately reflects** in:
  - Predicted run end window (shifts later)
  - Confidence interval (tightens)
  - Polymer burden slope (flattens)
  - Health score (improves)
- **Impact bar** shows: "+6 days, +3 health"

### G) Chart Texture (Eventful)
Output trajectory chart includes:
- **Dual axis**: Output (TPD) + Polymer (kg/day)
- **Event markers**: Reference lines for operational events
- **Event legend**: Recent events with severity badges

### H) Simulator with Meaningful Deltas
4 Operating Levers:
1. **Cleaning Cadence**: Baseline / +1 / +2 cycles/week
2. **Inhibitor Dose Index**: 0.9 - 1.3
3. **Flush Frequency**: Baseline / +1 per day
4. **Intervention Discipline**: Low / Medium / High

Results show clear Before → After with delta badges.

## Navigation (2 Items Only)
1. **Mission Control** - The cockpit (default) with embedded Evidence drawer
2. **Simulator** - What-if scenarios

## API Endpoints
- `GET /api/` - Health check
- `GET /api/run-info` - Golden run metadata
- `GET /api/day/{day}` - Day metrics with P10/P50/P90, golden gap
- `GET /api/time-series` - Historical data
- `GET /api/what-changed/{day}` - Last 7 days changes
- `GET /api/events` - Events, shift logs, pipeline status
- `GET /api/quick-days` - Jump to moments (7, 30, 52, 70, 96, 110)
- `GET /api/scenario-comparison/{day}` - Do Nothing vs Execute Moves
- `POST /api/apply-action-impact/{day}` - Calculate metrics after actions
- `POST /api/simulate` - What-if simulation
- `GET /api/actions/statuses` - All action statuses
- `POST /api/actions/{action_id}/status` - Update action status

## Testing Results (V2.2)
- Backend: 100% (37/37 tests passed)
- Frontend: 100% (14/14 tests passed)
- All Decision Instrument features verified

## Files Reference
- Backend: `/app/backend/server.py`
- Data: `/app/data/sim/run_seed.json`, `/app/data/sim/ops_events.json`
- Frontend: `/app/frontend/src/App.js`, `/app/frontend/src/pages/MissionControl.js`, `Simulator.js`
- Styles: `/app/frontend/src/App.css`

## Completed in V2.2
- [x] Default landing Day 70 (critical moment)
- [x] Quick jump buttons: 7, 30, 52, 70, 96, 110
- [x] Golden Gap tile with on-track/behind status
- [x] Commitment View with P90/P50/P10 outputs
- [x] Scenario toggle (Do Nothing vs Execute Moves)
- [x] Actions with Protects, Trigger, Deviation, Assets, Checklist
- [x] Actions change outcomes immediately when marked Done
- [x] Output chart with event markers
- [x] Simulator with meaningful deltas
- [x] "Prototype / Simulated" labels

## Next Action Items
1. Add shift handover report export with commitment summary
2. Real-time data pipeline integration (replace simulation)
3. Multi-run comparison view
4. Mobile-responsive design

## Backlog
- Historical run analysis
- ML model integration for predictions
- Role-based access (ED vs Operator views)
- Alerting system for critical events
