# Frontend Models Overview

## Domain Types (`frontend/types/health.ts`)

- **Backend DTO mirrors** — `TriageLevel` (`NOMINAL|CAUTION|URGENT|CRITICAL`), `VitalSigns` (request of `POST /api/v1/triage/evaluate`), `TriageAssessment` (response), `HealthResponse` (`GET /health`). Keep aligned with `backend/app/triage/models.py`.
- **Explorer model** — `ZoneId` (`head|chest|spine|limbs|gut|skin`), `BodyZone` (status, vitals, `partIds`, 3D `position`, description), `CrewMember` (zones, biometrics, risks, protocols, checks, readiness), `ViewMode` (`high_level|technical`).
- **Drill-down anatomy** — `Organ` (model-local `position`, procedural `geo` primitive + `scale`/`rotation`, vitals, description). `MODEL_GROUP_OFFSET` converts model-local ↔ world coords; organ status is inherited from the parent `BodyZone`.
- **Telemetry** — `TelemetryMetric`, `TelemetrySeries` (points + forecast + `MissionEvent[]` + provider-owned reference `band` — bands come from data, never hardcoded in components).
- **Location context** — `LocationProfile` (`commLatencySec`, `blackoutRisk`, `linkMode`, `HazardWeights`), `LocationId` (station/spacecraft/moon/mars/eva).
- **AI companion contract** — `AssistantResponse` (`message`, `referencedZoneIds`, `actions: [{type:"focus",zoneId}]`, `insights`, `assumptions`, `mode`), `ChatMessage`.
- **Ingest / gamification** — `BehaviorLog`, `LogAck`, `GamificationState`, `SkinDef`.

## Curated Datasets (`frontend/data/`)

- `crew.ts` — crew members with zones, vitals, risks, insights, biometrics, checks. Curated/simulated.
- `organs.ts` — `ORGANS` atlas (~17 procedural organs: brain, eyes, heart, lungs, vertebrae, muscles, bones, stomach, liver, gut loop, dermal patches) + `organsOf(zoneId)` / `getOrgan(id)`. Shared across crew; status inherited from parent zone.
- `mission.ts` — `LOCATION_PROFILES` (hazard weights + comm profiles) + mission day/phases.
- `telemetry.ts` — deterministic time series + forecast + mission-event markers + reference bands.
- `gamification.ts` — daily checklist + skin catalog.

All datasets are deterministic and labelled simulated; the REST provider delegates to them for endpoints that don't exist yet (flagged via `partial: true`).

## Procedural Part→Zone Map (`components/three/astronaut-model.tsx`)

- `PART_ZONE` maps suit/body partIds (`helmet`, `visor`, `collar`, `chest`, `abdomen`, `spine`, `plss`, `arm_l/r`, `leg_l/r`) to `ZoneId`s.
- `EXPLODE_OFFSET` gives each part an explode direction; `overlayTint()` renders conceptual overlays (thermal/exertion/fatigue/radiation) from zone vitals.
- Click → `select(zone.id)` + `focus(zone)` — the same pipeline the zone list and AI actions use.
- **Drill-down isolation (`OrganLayer`)** — depth 1 (zone selected): all other zones' parts UNMOUNT (not `visible=false` — invisible three.js meshes still intercept raycast hits and would steal clicks), the selected shell goes translucent (0.15, `depthWrite` off, clicks fall through) and its `ORGANS` render as clickable labelled meshes. Depth 2 (organ selected via `focusOrgan()`, `focusDistance` ≈0.6 vs zone ≈1.5): every suit shell and sibling organ unmounts — the organ floats alone. Hidden while `explode > 0`.

## Legacy note

The earlier `lib/vitals.ts` / `lib/zones.ts` / `lib/types.ts` and `components/BodyModel.tsx` were superseded by `types/health.ts` + `data/` + the R3F model and were removed; `components/three/fallback-figure.tsx` provides the accessible SVG fallback.
