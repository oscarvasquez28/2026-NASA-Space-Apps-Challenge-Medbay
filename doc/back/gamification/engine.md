# Routine Measurement Scheduler & Gachapon Reward Engine (`doc/back/gamification/engine.md`)

## Overview

Feature 4.1 mitigates long-duration isolation, monotony, and adherence fatigue by introducing an autonomous gamification engine:
1. **Routine Health Measurement Scheduler:** Tracks daily and weekly operational, physiological, and countermeasure tasks.
2. **Gachapon Reward Engine:** Awards tokens upon checkup completion to roll for rare 3D AI Companion skins across 4 calibrated rarity tiers.
3. **Dual-View & Persistence:** Auto-seeds profiles on first query and delivers dual crew/Flight Surgeon response narratives.

## Rarity Tiers & Drop Probabilities

The companion skin catalog contains 12 unique items distributed across 4 tiers:

| Rarity Tier | Total Probability | Individual Drop Chance (3 skins/tier) | Example Skins |
| :--- | :--- | :--- | :--- |
| **COMMON** | 60.0% | 20.0% each | `skin_standard_suit`, `skin_flight_suit`, `skin_exercise_apparel` |
| **RARE** | 25.0% | ~8.33% each | `skin_lunar_explorer`, `skin_martian_pioneer`, `skin_apollo_heritage` |
| **EPIC** | 12.0% | 4.0% each | `skin_bioluminescent_pulse`, `skin_solar_flare_shield`, `skin_cybernetic_visor` |
| **LEGENDARY** | 3.0% | 1.0% each | `skin_deep_space_quantum`, `skin_mars_vanguard`, `skin_canadarm_cybershell` |

## Routine Health Measurement Tasks

| Task ID | Title | Frequency | Domain | Clinical Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `task_morning_vitals` | Daily Morning Vitals Baseline | Daily | Physiological | Resting HR, BP, core temp, and SpO2 dock check |
| `task_ared_exercise` | ARED Resistance Countermeasure Log | Daily | Musculoskeletal | 2.5h ARED + T2 treadmill workout log |
| `task_hydration_nutrition` | Hydration & Space Garden Nutrition Log | Daily | Metabolic | Fluid balance (>=2.5L) & electrolyte intake |
| `task_sans_visual` | SANS Visual Acuity & OCT Eye Screening | Daily | Neuro-Ophthalmology | Optical coherence tomography & LogMAR eye exam |
| `task_weekly_dosimetry_skin` | Dosimeter Load & Skin Barrier Inspection | Weekly | Radiation / Derm | Cumulative mSv upload & rash examination |

## API Contracts

### 1. `GET /api/v1/gamification/status`
- **Query Params:** `astronaut_id: str = "AST-01"`
- **Response:** `GamificationStatusResponse`
  - Auto-seeds `GamificationProfileRecord` if non-existent (streak=1, tokens=1, `skin_standard_suit` equipped).
  - Returns calculated `compliance_rate_percent`, full `routine_tasks` checklist, `equipped_skin`, and 12-skin `catalog`.

### 2. `POST /api/v1/gamification/checkup-complete`
- **Payload:** `CheckupCompleteRequest`
  - `astronaut_id: str`
  - `completed_tasks: list[str]`
  - `perform_gachapon_roll: bool = True`
  - `equip_skin_id: Optional[str] = None`
  - `unlock_skin_id: Optional[str] = None` *(persists skins won via the frontend check-in `PrizeWheel`)*
  - `deterministic_seed: Optional[int] = None`
- **Behavior:**
  - Validates that `equip_skin_id` (if passed) is already unlocked; otherwise raises HTTP 400.
  - Updates completed routine tasks list and recalculates compliance %.
  - Increments `readiness_streak_days` (+1) and `total_checkups_completed` (+1).
  - Awards +1 token.
  - If `perform_gachapon_roll=True` and token balance >= 1, deducts 1 token and executes weighted roll (deterministic if seed provided).
  - Commits updates to database and returns `CheckupCompleteResponse`.
