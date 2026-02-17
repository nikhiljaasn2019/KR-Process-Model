# KR AA Run Health OS - Product Requirements Document

## Version 3.0 - Complete 3-Tab Architecture (Feb 2026)

## Original Problem Statement
Build a conviction prototype for BPCL Kochi Refinery Acrylic Acid unit that makes the ED + operators feel: "We desperately need this to achieve long AND predictable runs (>= golden run) and to plan output + shutdowns."

## PRIMARY GOAL: Structured Decision-Making Tool
Transform from a single cockpit into a **3-TAB INFORMATION ARCHITECTURE** with:
1. **Mission Control**: High-level cockpit for a quick glance
2. **Actions Required**: Detailed workbench for operators to execute and track tasks
3. **Plan & Commit**: Decision studio for scenario planning

## V3.0 Features Implemented

### A) 3-Tab Navigation
- **Mission Control** (default): Quick overview with Hero Triptych
- **Actions Required**: Detailed action workbench by horizon
- **Plan & Commit**: Scenario planning with 4 distinct options

### B) Mission Control - Hero Triptych
Three side-by-side charts "above the fold":
1. **Run End Path**: Benchmark Run + Actual + P10-P90 forecast cone
2. **Output Path**: Cumulative output trajectory vs benchmark
3. **Polymer/Fouling Path**: Polymer burden with event markers

**Commitment Box** displays:
- P90 commitment date (production until)
- Committed output (P90): Conservative
- Expected output (P50): Base case
- Shutdown window (P90)
- Confidence trend (14d): Tightening/Stable/Widening

**Priority Actions Preview**: Top 3 actions with:
- Urgency badges (CRITICAL/HIGH/MEDIUM)
- Trigger deviation percentages
- Asset tags
- Impact chips
- Link to Actions Required

### C) Actions Required - Workbench
Actions grouped by horizon:
- **Now (this shift)**: Critical and time-sensitive
- **Next 24 hours**: High priority
- **This week**: Medium/routine

Each action card includes:
- **Protects**: Run Length / Productivity / Both
- **Effort Level**: Low / Med / High
- **Trigger Section**: Metric, current vs baseline, band, deviation, time window
- **Where**: Asset tags (G8, G9, V-014, V-022, etc.)
- **Checklist**: Numbered specific steps
- **Impact (Simulated)**: Run length gain, polymer slope, CI tightening
- **Evidence Section**: Add note + attach evidence (placeholder)

**Action Buttons**:
- Acknowledge (eye icon)
- Mark Done (green, applies impact)
- Not Feasible (red, opens reason dialog)

**Not Feasible Reasons**:
- Utility constraint
- Equipment issue
- Manpower
- Process limitation
- Unknown

**Closed-Loop Feedback**: When marking "Done":
- Toast notification
- Green completion banner: "Completed - Impact applied to forecast"
- Outcome Delta Panel shows cumulative impact (Run Extended, Health Improved, Polymer Flattened, CI Tightened)

### D) Plan & Commit - Scenario Cards
4 distinct scenarios:
1. **Baseline Discipline** (Low Effort): Continue current practices, +0 days
2. **Proactive Protection** (Medium): Enhanced monitoring + preemptive maintenance, +8 days
3. **Run Rescue** (High): Aggressive intervention for elevated risk, +14 days
4. **Custom** (Variable): Configure specific operating levers

**Scenario Comparison View**:
- Current Trajectory vs With Scenario
- Forecast End (P50)
- Days Remaining
- Expected Output (P50)
- Confidence Interval

**Custom Levers Panel** (when Custom selected):
- Cleaning Cadence: Baseline / +1/wk / +2/wk
- Inhibitor Dose Index: Slider 0.9-1.3
- Flush Frequency: Baseline / +1/day / +2/day
- Intervention Discipline: Low / Medium / High

**Intervention Windows & Output Delivery**:
- Timeline chart showing baseline vs scenario cumulative output
- Recommended intervention windows with dates and reasons
- Optional intervention windows

### E) Day Selector
- Default landing: **Day 70** (Critical - Rescue window)
- Slider: 1-111 days
- Quick chips: **7** (Early), **30** (Mid), **52** (Mid-Late), **70** (Critical), **96** (Late), **110** (End)

### F) Terminology Updates
- "Golden Run" replaced with "Benchmark Run" / "Best Run"
- "Golden Gap" replaced with "Ahead/Behind Best"

## API Endpoints
- `GET /api/` - Health check
- `GET /api/run-info` - Run metadata
- `GET /api/day/{day}` - Day metrics with actions, P10/P50/P90
- `GET /api/time-series` - Historical series (1-111)
- `GET /api/what-changed/{day}` - Last 7 days changes
- `GET /api/events` - Events, shift logs, lab results, pipeline status
- `GET /api/quick-days` - Jump to critical moments
- `GET /api/scenario-comparison/{day}` - Do Nothing vs Execute Moves
- `POST /api/apply-action-impact/{day}` - Apply completed actions
- `POST /api/simulate` - What-if simulation
- `GET /api/intervention-window/{day}` - Recommended intervention window
- `GET /api/actions/statuses` - All persisted action statuses
- `POST /api/actions/{action_id}/status` - Update action status
- `DELETE /api/actions/statuses/clear` - Clear all statuses (demo reset)

## Testing Results (V3.0)
- Backend: 100% (37/37 tests passed)
- Frontend: 100% (all V3 features verified)

## Files Reference
- Backend: `/app/backend/server.py`
- Data: `/app/data/sim/run_seed.json`, `/app/data/sim/ops_events.json`
- Frontend: 
  - `/app/frontend/src/App.js` (Main layout, context, navigation)
  - `/app/frontend/src/pages/MissionControl.js` (Hero triptych, commitment box)
  - `/app/frontend/src/pages/ActionsRequired.js` (Action workbench)
  - `/app/frontend/src/pages/PlanCommit.js` (Scenario planning)
- Styles: `/app/frontend/src/App.css`

## Completed in V3.0
- [x] 3-tab navigation (Mission Control, Actions Required, Plan & Commit)
- [x] Hero Triptych with 3 charts (Run End, Output, Polymer)
- [x] Commitment Box with P90/P50 metrics and shutdown window
- [x] Priority Actions Preview with top 3 actions
- [x] Actions grouped by horizon (Now, Next 24h, This week)
- [x] Detailed action cards with triggers, checklists, impacts
- [x] Mark Done with closed-loop feedback (Outcome Delta Panel)
- [x] Not Feasible with 5 reason codes
- [x] 4 scenario cards (Baseline, Proactive, Rescue, Custom)
- [x] Custom scenario levers panel
- [x] Scenario comparison (Current vs With Scenario)
- [x] Intervention Windows timeline
- [x] Day selector with quick chips (7, 30, 52, 70, 96, 110)
- [x] Benchmark Run terminology (replaced Golden Run)
- [x] Simulated/Demo labels throughout

## Next Action Items (P0/P1)
1. Add shift handover report export with commitment summary
2. Persist scenario selections across sessions
3. Add "Re-run simulation" button after actions change
4. Historical trend comparison for intervention windows

## Backlog (P2)
- Real-time data pipeline integration (replace simulation)
- Multi-run comparison view
- Mobile-responsive design
- Historical run analysis
- ML model integration for predictions
- Role-based access (ED vs Operator views)
- Alerting system for critical events
- Evidence attachment functionality (currently placeholder)
