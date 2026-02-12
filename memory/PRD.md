# KR AA Run Health OS - Product Requirements Document

## Original Problem Statement
Build an interactive "Conviction Prototype" web app demo for BPCL Kochi Refinery (KR) Acrylic Acid (AA) unit to help executives consistently reach/beat golden run-length and protect productivity.

## User Personas
- **Executive Director (ED)**: Decision maker who needs quick visibility into run health and risks
- **Plant Managers**: Operations leaders who need actionable insights and specific recommendations
- **Process Engineers**: Technical users who need detailed metric comparisons and trends

## Core Requirements (Static)
1. 5-screen application: Mission Control, Action Center, What Changed, Golden Comparator, Data Feed
2. Golden baseline of 111 days (02-Dec-2024 to 23-Mar-2025)
3. Manual demo controls for live presentations
4. Specific, non-vague insights with exact metrics, bands, and checklists
5. Light professional theme (executive-friendly)

## What's Been Implemented (Jan 2026)
- ✅ Mission Control dashboard with KPI cards, progress bar, risk percentages
- ✅ Action Center with full action card schema (triggers, evidence, checklists)
- ✅ What Changed timeline with metrics trend chart (Recharts)
- ✅ Golden Comparator with comparison table and run history
- ✅ Data Feed & Freshness with confidence indicators
- ✅ Demo Controls Panel (advance time, inject events, resolve actions)
- ✅ 7 core metrics tracking: CW Inlet Temp, Inhibitor Continuity, ΔP Index, Reactor Oscillation, AA Dimer, MeHQ, Excursions
- ✅ Editable config file: /config/golden_bands.json
- ✅ 10 historical runs + current live run simulation

## Tech Stack
- Frontend: React 19 with Recharts, Tailwind CSS, Shadcn/UI
- Backend: FastAPI (Python)
- Database: MongoDB (for future persistence)
- Fonts: Manrope (headings), Inter (body), JetBrains Mono (data)

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] All 5 screens implemented
- [x] Demo controls functional
- [x] Action card generation from deviations
- [x] Golden baseline comparison

### P1 (High Priority) - Future
- [ ] PDF/Print export of Mission Control snapshot
- [ ] Guided demo walkthrough overlay
- [ ] Configurable thresholds via admin panel

### P2 (Medium Priority) - Future
- [ ] Historical trend analysis across multiple runs
- [ ] Predictive analytics for early warning
- [ ] Mobile-responsive enhancements

## Next Tasks
1. Consider adding PDF export for executive reporting
2. Add more sophisticated projection models
3. Implement data persistence with MongoDB
4. Add user preferences/settings

---
## Update: Day Scenario Selector Feature (Jan 2026)

### New Features Added:
1. **Day Selector Dropdown** on Mission Control page
   - 7 predefined day scenarios: 1, 18, 35, 55, 70, 90, 105
   - Color-coded risk levels: Low (green), Medium (amber), High (red), Critical (dark red)
   - Toast notifications with descriptions when switching

2. **Progressive Scenario System**
   - Day 1: Fresh start - all metrics optimal, 0 actions, 5-15% risk
   - Day 18: Early run - minor fluctuations, low risk
   - Day 35: Mid run - attention needed, medium risk
   - Day 55: Late-mid run - multiple parameters trending
   - Day 70: Late run - active intervention required, high risk
   - Day 90: Critical phase - maximum vigilance, high risk
   - Day 105: Final stretch - all hands on deck, critical risk

3. **Action Card Impact Section**
   - Risk reduction percentages (7-day, 14-day, 30-day)
   - Productivity impact explanation
   - Run length impact explanation
   - Urgency badges (Critical/High/Medium)
   - Confidence level indicator

### API Endpoints Added:
- GET /api/demo/available-days - List of day scenarios
- POST /api/demo/set-day - Switch to specific day scenario
