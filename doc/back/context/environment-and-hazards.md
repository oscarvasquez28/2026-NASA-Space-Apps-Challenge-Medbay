# Operational Context & NASA HRP 5-Hazards Modeling

## Overview

The context service (`backend/app/context/`) models environmental and operational conditions across diverse human spaceflight mission profiles based on the NASA Human Research Program (HRP) 5 Hazards of Human Spaceflight.

## 5 Human Spaceflight Hazards

1. **Space Radiation:** Galactic Cosmic Rays (GCR) and Solar Particle Events (SPE).
2. **Isolation and Confinement:** Psychological stress, circadian disruption, and behavioral fatigue.
3. **Distance from Earth:** Communication latency, loss of real-time ground guidance, and evacuation impossibility.
4. **Gravity Fields:** Microgravity (0g), lunar (1/6g), and Martian (3/8g) physiological adaptations.
5. **Hostile Closed Environments:** ECLSS life-support recycling, CO2 accumulation, toxic particulates, and microbial virulence.

## Baseline Operational Profiles

| Location Setting | Space Radiation | Isolation | Distance | Gravity | Hostile Closed Env | Comm Latency | Offline Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Space Station [0g]** | 1.2 | 1.1 | 1.0 | 1.8 | 1.2 | 0.05 s | `False` |
| **Spacecraft [0g Transit]** | 2.5 | 2.0 | 2.2 | 2.0 | 1.8 | 45.0 s | `True` |
| **Moon [1/6g]** | 1.8 | 1.4 | 1.3 | 1.4 | 1.5 | 1.3 s | `False` |
| **Mars [3/8g]** | 2.8 | 2.8 | 3.0 | 1.3 | 2.2 | 720.0 s | `True` |
| **Rover / EVA** | 3.0 | 1.8 | 2.0 | 1.5 | 3.0 | 180.0 s | `True` |

## Dynamic Multiplier Adjustments

Hazard multipliers adjust dynamically based on incoming ECLSS sensor metrics:
- **Elevated CO2:** If `co2_mmhg > 4.0`, adds dynamic strain to `hostile_closed_environments` (+0.3 or higher).
- **Cabin Depressurization:** If `pressure_kpa < 90.0`, adds +0.4 to `hostile_closed_environments`.
- **Microbial Load:** If `microbial_cfu_m3 > 500.0`, adds +0.2 to `hostile_closed_environments`.
- **Acoustic Noise:** If `noise_dba > 65.0`, adds +0.1 to both `isolation_and_confinement` and `hostile_closed_environments`.
- **Latency Threshold:** Any communication latency > 10.0 seconds automatically enforces `offline_fallback_active = True`.
- **Gravity & Dual-View Status Output:** `LocationContextResponse` includes `gravity_g`, standardized severity token `status` (`nominal` | `caution` | `critical`), and dual-mode summaries (`high_level` and `technical`).
