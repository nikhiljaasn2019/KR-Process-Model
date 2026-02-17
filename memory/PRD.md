# KR AA Run Health OS - Product Requirements Document

## Version 4.1 - Data Rigour & Coherence (Feb 2026)

## Original Problem Statement
Build a conviction prototype for BPCL Kochi Refinery Acrylic Acid unit that makes the ED + operators feel: "We desperately need this to achieve long AND predictable runs (>= Current Best Run) and to plan output + shutdowns."

## PRIMARY GOALS
1. Consistently match or beat the "Current Best Run" (111 days)
2. Predict run end + output for planning/customer commitments
3. Provide specific actions that visibly improve the trajectory (closed-loop)

---

## V4.1 - DATA RIGOUR & COHERENCE

### Core Demo Story (Now Implemented)
**"This run (Actual + Forecast) is tracking BETTER than the Benchmark"**
- Better = Lower polymer/fouling → Longer run → Higher output → Tighter confidence

### Synthetic Data Engine with Hard Constraints

**Polymer/Fouling Trajectories:**
- **Benchmark**: 380 → 780 kg/day (smooth rising curve)
- **Actual**: 15% LOWER than benchmark (~500 kg/day at Day 70)
- **Forecast**: 28% LOWER than benchmark (~410 kg/day), stable/flattening

**Run Length (derived from polymer):**
- **Benchmark**: Fixed at 111 days
- **Actual**: ~116 days (5 days better due to lower polymer)
- **Forecast**: ~121 days (10 days better with actions)

**Output (inversely tied to polymer):**
- **Benchmark**: 330 t/day → ~35,000 t cumulative
- **Actual**: 345 t/day → ~38,000 t cumulative
- **Forecast**: 358 t/day → ~41,000 t cumulative

**Confidence Band:**
- Tightens when polymer is stable (±3 days)
- Widens during events (±7 days)

**Events (only 2, well-defined):**
1. **D12: Filter Cleaning Spike** - Polymer spike, CI widens, brief output dip
2. **D52: Fouling Risk Cluster** - Higher severity, larger impact

### Premium Color Palette (Non-Negotiable)
```css
/* Consistent across ALL charts */
--benchmark: #64748B;    /* Slate - dashed 2.5px */
--actual: #0F172A;       /* Near-black - solid 3.5px */
--forecast: #0F766E;     /* Teal - solid 3px */
--forecast-band: rgba(15,118,110,0.16);
--event: #F97316;        /* Orange for events */
--grid: #E5E7EB;         /* Subtle 0.6px */
--axis-text: #475569;    /* Slate-600, weight 600 */
```

### Visual Coherence Rules
1. **No magic jumps** - Forecast lines change gradually
2. **No flat benchmark** - Benchmark polymer rises smoothly
3. **Consistent ordering** - Same relationship on all 3 charts
4. **Events annotated** - Orange dots + reference lines + chips

---

## Testing Results (V4.1)
- Backend: 100% (14/14 data coherence tests passed)
- Frontend: 100% (all visual coherence verified)

## Data Coherence Verification
| Metric | Benchmark | Actual | Forecast | Ordering |
|--------|-----------|--------|----------|----------|
| Polymer (kg/day) | 598 | 499 | 409 | ✅ B > A > F |
| Run Length (days) | 111 | 116 | 121 | ✅ B < A < F |
| Output (tons) | ~35k | ~38k | ~41k | ✅ B < A < F |

---

## API Endpoints
- `GET /api/day/{day}` - Returns coherent metrics:
  - `benchmark_polymer`, `actual_polymer`, `forecast_polymer`
  - `benchmark_total_run`, `actual_total_run`, `forecast_total_run`
  - `benchmark_cumulative`, `actual_cumulative`, `forecast_cumulative`
- All other endpoints unchanged

## Files Reference
- Backend: `/app/backend/server.py` (SyntheticDataEngine)
- Frontend: `/app/frontend/src/pages/MissionControl.js` (Premium charts)
- Tests: `/app/backend/tests/test_data_coherence.py`

---

## Completed in V4.1
- [x] SyntheticDataEngine with hard constraints
- [x] Polymer: Benchmark > Actual > Forecast
- [x] Run Length: Forecast > Actual > Benchmark  
- [x] Output: Forecast > Actual > Benchmark
- [x] Rising benchmark polymer (380→780)
- [x] Events D12 & D52 with orange markers
- [x] Premium color palette applied
- [x] No magic jumps in forecast
- [x] Tooltips with Date + Day# + all values

## Completed in V4.0
- [x] Global color coding across all charts
- [x] X-axis shows dates
- [x] Run Length chart shows "Total run length" (intuitive)
- [x] Mission Control: 3 zones layout
- [x] Plan & Commit: Action Playbook panel

---

## Next Action Items (P1)
1. Add shift handover report export
2. Make charts responsive for smaller screens
3. Add data export functionality (CSV)

## Backlog (P2)
- Real-time data pipeline integration
- Multi-run comparison view
- Mobile-responsive design
