# KR AA Run Health OS - Product Requirements Document

## Version 4.0 - Major UI/UX Clarity Refactor (Feb 2026)

## Original Problem Statement
Build a conviction prototype for BPCL Kochi Refinery Acrylic Acid unit that makes the ED + operators feel: "We desperately need this to achieve long AND predictable runs (>= Current Best Run) and to plan output + shutdowns."

## PRIMARY GOALS
1. Consistently match or beat the "Current Best Run" (best observed run length of 111 days)
2. Predict run end + output so planning/customer commitments + shutdown windows are possible
3. Provide specific actions that visibly improve the trajectory (closed-loop feel)

---

## V4.0 Features Implemented - Clarity & Comprehension Fixes

### A) GLOBAL COLOR CODING (Non-negotiable)
Consistent across ALL charts:
- **BENCHMARK (Current Best Run)** = Blue (#3B82F6), dashed line
- **ACTUAL** = Black (#1E293B), solid line
- **FORECAST (P50)** = Green (#10B981), solid line
- **FORECAST BAND (P10–P90)** = Light green translucent shaded region
- **EVENTS** = Red markers (#EF4444), small dots/vertical lines

### B) CHART 1: Run Length Trajectory (INTUITIVE METRIC)
- **Changed from**: "Run End Path" (confusing downward slope)
- **Changed to**: "Predicted TOTAL run length (days)"
- **Definition**: `predicted_total_run_length = current_day + predicted_remaining_days`
- **Y-axis**: "Total Run Length (days)"
- **X-axis**: DATE (not day numbers)
- **Behavior**: Line goes UP as run extends (intuitive!)
- **Header shows**:
  - Forecast end (P50 date)
  - End window (P90 range)
  - Ahead/Behind Current Best (days) - e.g., "+4d vs Best"

### C) CHART 2: Output Trajectory (Cumulative)
- **Metric**: Cumulative output (tons)
- **Y-axis**: "Cumulative Output (t)"
- **X-axis**: DATE
- **Header shows**:
  - Committed output till end (P90)
  - Expected output till end (P50)
  - Expected shutdown window (P90)

### D) CHART 3: Polymer / Fouling Trajectory
- **Metric**: Polymer burden (kg/day)
- **Y-axis**: "Polymer Burden (kg/day)"
- **X-axis**: DATE
- **CRITICAL FIX**: Benchmark is now **RISING** (not flat!)
  - Starts at ~120 kg/day, grows to ~260+ kg/day over run
  - Benchmark = Current Best Run's polymer trajectory (lower/smoother than actual)
- **Event markers** in red with chips below (e.g., "D12: Filter Cleaning Spike")
- **Header shows**:
  - Trend: Rising / Stable / Improving
  - Filter Δ/day
  - Current polymer burden (kg/day)

### E) TOOLTIP IMPROVEMENTS (Non-negotiable)
All chart tooltips now show:
- **Date** (e.g., "29 Jan 2026")
- **Day#** (e.g., "Day 51")
- **Benchmark value** (in blue)
- **Actual value** (in black)
- **Forecast P50 value** (in green)
- **P10/P90 band** (where applicable)

### F) X-AXIS DATE LABELS
- All charts show **dates** on X-axis (Dec, Jan, Feb, Mar, Apr)
- Day numbers shown **only in tooltips**
- Ticks every 20 days approximately

### G) FUTURE-LOOKING DATE LOGIC
- **Run start date** = today - (currentDay - 1) days
- All forecast dates computed forward from today
- All dates show 2026 (plausible future)
- Shutdown window, commitment dates all in future

### H) MISSION CONTROL - 3-ZONE LAYOUT
**Zone 1: The 3 Curves** (Vertically Stacked, Full Width, Taller)
- Charts are BIG and readable (not cramped 3-in-a-row)
- Each chart ~220px height
- Full width with proper margins

**Zone 2: Priority Actions Preview** (Top 3 Only)
- Shows "Priority Actions (next 24–72 hours)"
- 3 action cards with IMPACT visible upfront:
  - "+6 days (P50), CI tightens ~1d, polymer slope flattens"
- "Open in Actions Required" link on each card

**Zone 3: Trust Strip** (Small, Not Big Cards)
- Run date: "17 Feb 2026 (Day 70 of 111)"
- Data updated: "2 min ago"
- Scored: "5 min ago"
- Demo tag: "Simulated / Demo — Not plant-validated"

**REMOVED**: Big "Run Planning & Commitments" card (redundant)

### I) PLAN & COMMIT - ACTION PLAYBOOK
New "Action Playbook" panel for selected scenario with 4 columns:

**Immediate (This shift)**:
- 2-3 specific steps

**Next 24h (High priority)**:
- 2-3 specific steps

**Next 72h (Follow-up)**:
- 1-2 specific steps

**Guardrails / Thresholds**:
- Specific numbers (e.g., "Polymer Burden < 600 kg/day")

**Playbook changes per scenario**:
- **Baseline**: Continue current monitoring
- **Proactive**: Enhanced monitoring, preventive inspection
- **Run Rescue**: DECLARE mode, emergency flush, swap filters, escalate to ED
- **Custom**: Apply configured levers

---

## Testing Results (V4.0)
- Backend: 100% (37/37 tests passed)
- Frontend: 100% (all V4 features verified)

## API Endpoints
- `GET /api/day/{day}` - Returns all day metrics including:
  - `predicted_total_run_length` (new intuitive metric)
  - `benchmark_gap_days` (renamed from golden_gap_days)
  - `benchmark_polymer_kg_per_day` (rising, not flat)
  - `run_start_date`, `current_date`, `current_date_display` (future-looking)
- All other endpoints unchanged from V3

## Files Reference
- Backend: `/app/backend/server.py`
- Frontend:
  - `/app/frontend/src/pages/MissionControl.js` (Complete rewrite for V4)
  - `/app/frontend/src/pages/PlanCommit.js` (Action Playbook added)
  - `/app/frontend/src/pages/ActionsRequired.js`
  - `/app/frontend/src/App.css` (V4 styles added)

---

## Completed in V4.0
- [x] Global color coding across all charts
- [x] X-axis shows dates (not day numbers)
- [x] Tooltips show Date + Day# + all series values
- [x] Run Length chart shows intuitive "Total run length" metric (line goes UP)
- [x] Polymer benchmark is RISING (not flat)
- [x] All dates are future-looking (2026)
- [x] Mission Control: 3 zones only (charts vertical, priority actions, trust strip)
- [x] Removed redundant "Run Planning & Commitments" card
- [x] Plan & Commit: Action Playbook panel added
- [x] Playbook shows Immediate/Next24h/Next72h/Guardrails
- [x] Playbook content changes per scenario
- [x] Run Rescue playbook has specific emergency steps

## Completed in V3.0 (Previous)
- [x] 3-tab navigation (Mission Control, Actions Required, Plan & Commit)
- [x] Actions grouped by horizon (Now, Next 24h, This week)
- [x] Mark Done with closed-loop feedback
- [x] 4 scenario cards (Baseline, Proactive, Rescue, Custom)
- [x] Custom scenario levers panel
- [x] Benchmark Run terminology (replaced Golden Run)

---

## Next Action Items (P1)
1. Add shift handover report export with commitment summary
2. Make charts responsive for smaller screens
3. Add data export functionality (CSV)

## Backlog (P2)
- Real-time data pipeline integration (replace simulation)
- Multi-run comparison view
- Mobile-responsive design
- Historical run analysis
- ML model integration for predictions
- Role-based access (ED vs Operator views)
- Alerting system for critical events
- Evidence attachment functionality
