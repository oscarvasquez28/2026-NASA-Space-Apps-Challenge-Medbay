# Frontend Models Overview

## Domain Types (`frontend/types/health.ts`)

- **Backend DTO mirrors** — `TriageLevel` (`NOMINAL|CAUTION|URGENT|CRITICAL`), `VitalSigns` (request of `POST /api/v1/triage/evaluate`), `TriageAssessment` (response), `HealthResponse` (`GET /health`). Keep aligned with `backend/app/triage/models.py`.
- **Explorer model** — `ZoneId` (`head|chest|spine|limbs|gut|skin`), `BodyZone` (status, vitals, `partIds`, 3D `position`, description), `CrewMember` (zones, biometrics, risks, protocols, checks, readiness), `ViewMode` (`high_level|technical`).
- **Drill-down anatomy** — `Organ` (model-local `position`/`rotation`, `shape: OrganShape` builder id, `side` ±1 for paired organs, optional `focusDistance` and `anim: heartbeat|breath|peristalsis`, vitals, description). `MODEL_GROUP_OFFSET` converts model-local ↔ world coords. Organ status is the organ's own: `organStatus()` = worst live zone reading among its vital keys + `ORGAN_WATCH` keys (e.g. URGENT chest HR/BP → heart, SpO2 → lungs, trachea stays nominal); `organVitals()` overlays the member's live zone readings on the curated values.
- **Telemetry** — `TelemetryMetric`, `TelemetrySeries` (points + forecast + `MissionEvent[]` + provider-owned reference `band` — bands come from data, never hardcoded in components).
- **Location context** — `LocationProfile` (`commLatencySec`, `blackoutRisk`, `linkMode`, `HazardWeights`), `LocationId` (station/spacecraft/moon/mars/eva).
- **AI companion contract** — `AssistantResponse` (`message`, `referencedZoneIds`, `actions: [{type:"focus",zoneId}]`, `insights`, `assumptions`, `mode`), `ChatMessage`.
- **Ingest / gamification** — `BehaviorLog`, `LogAck`, `GamificationState`, `SkinDef`.

## Curated Datasets (`frontend/data/`)

- `crew.ts` — crew members with zones, vitals, risks, insights, biometrics, checks. Curated/simulated.
- `suit-rig.ts` — EVA-suit skeleton (shoulders, arm abduction, hips; floor y = 0) shared by the suit geometry and the organ atlas.
- `organs.ts` — `ORGANS` atlas (28 organs) + `organsOf(zoneId)` / `getOrgan(id)` / `zoneFraming(zoneId)` (skin → full-body framing) / `organStatus` / `organVitals`. Shared across crew; per-member status comes from that member's zone vitals. Convention: the model faces +z, so **patient-left = +x** (`side: 1`).
  - head: brain (hemispheres + gyri, cerebellum, brainstem), eyes ×2 (iris/pupil, optic nerve, recti)
  - chest: heart (4 chambers, aortic arch + branches, pulmonary trunk, venae cavae, coronaries), lungs ×2 (fissures, cardiac notch), trachea/bronchi, esophagus, diaphragm
  - spine: cervical / thoracic / lumbar columns (bodies, discs, arches, processes), pelvis/sacrum
  - limbs: upper arms ×2 (biceps + humerus), femurs ×2 (head, trochanter, condyles, patella)
  - gut: liver, gallbladder, stomach + duodenum, spleen, pancreas, kidneys ×2 (vessels, adrenal, ureter), small intestine, colon (haustra, appendix), bladder
  - skin: cross-section blocks (epidermis/dermis/hypodermis, follicles, sweat gland, vessels) on abdomen + L forearm
- `mission.ts` — `LOCATION_PROFILES` (hazard weights + comm profiles) + mission day/phases.
- `telemetry.ts` — deterministic time series + forecast + mission-event markers + reference bands.
- `gamification.ts` — daily checklist + skin catalog.

All datasets are deterministic and labelled simulated; the REST provider delegates to them for endpoints that don't exist yet (flagged via `partial: true`).

## Procedural EVA Suit (`components/three/suit-geometry.ts` + `astronaut-model.tsx`)

- xEMU-inspired, stylised, no external assets. `suitGeometry(piece, side)` builds cached, merged, vertex-coloured meshes from the shared toolkit `components/three/procedural.ts` (also used by the organs): EVVA helmet + gold visor + lamps, comm cap, neck/waist/shoulder/wrist bearings, hard upper torso, DCM (knobs, purge valve, status-glowing display), lower torso/brief, dorsal rail, PLSS (lid, SOP, vents, antenna), corrugated umbilicals, arms with convolute elbows + gloves + mission patch/flag, legs with convolute knees + knee pads, boots with lugged soles.
- **Rig** — `data/suit-rig.ts` (`SHOULDER`, `ARM_ABDUCTION`, `HIP_X`, `armTransform`, `armPoint`); floor at model y = 0, model faces +z (patient-left = +x). Arms hang from shoulder bearings inside the torso's half-width (no gap); organ anatomy (biceps, forearm skin sample, femurs) is placed from the same rig.
- **Two colour conventions** — tinted shells carry near-white luminance masks (seams, panels, quilting) multiplied by the status/overlay tint; detail pieces carry true colours. Material finishes (`fabric | hard | metal | visor | rubber`) are `meshPhysicalMaterial` presets.
- `PART_ZONE` maps partIds to `ZoneId`s: head ← `helmet`, `head`, `visor`, `collar`; skin ← `skin_body` (skin layer) + `plss` (suit-pressure loop); chest ← `chest`; gut ← `abdomen`; spine ← `spine`; limbs ← `arm_l/r`, `leg_l/r` (`_l` = patient-left/+x). Mirrored in `data/crew.ts` `partIds`. Each part = one selectable `Solid` shell + `Aux` details that delegate clicks to the zone and fade out when anything is drilled.
- `EXPLODE_OFFSET` gives each part an explode direction; `overlayTint()` renders conceptual overlays (thermal/exertion/fatigue/radiation) from zone vitals.
- Click → `select(zone.id)` + `focus(zone)` — the same pipeline the zone list and AI actions use.
- **Three layers: suit → skin → organs.** `components/three/skin-geometry.ts` builds a full-body skin (head with face/ears/neck, thorax, abdomen, arms + hands on the arm rig, legs + feet) split into segments that follow their suit part's explode offset. Skin colour = skin-zone status: natural tone when nominal, matte opaque red when off-nominal.
- **Drill states** (all transitions are damped fades/slides via `useFade` / `useExplodeFollow` — nothing pops; hidden meshes get `raycast = noop`, because invisible three.js meshes still intercept hits):
  - depth 0 — opaque suit; skin + organs hidden; **off-nominal organs show pulsing beacons drawn through the suit** (`depthTest` off) — clicking one drills straight to that organ.
  - wireframe overview (depth 0 + wireframe) — suit as faint wire (0.14), skin hidden, **every internal organ visible and clickable from outside**.
  - depth 1 (zone) — other zones fade + slide out; selected shell ghosts (0.14); skin fades in as a membrane (0.16, stronger when abnormal); the zone's organs fade in (labels pinned when ≤ 4, else on hover); chest adds the translucent ribcage. Clicking skin where no organ is behind drills to the skin zone.
  - skin zone — the whole skin body opaque + the skin cross-section samples; framed full-body.
  - depth 2 (organ via `focusOrgan()`, per-organ `focusDistance` 0.2–0.85; zone focus frames the organ extent via `zoneFraming()`) — every shell, the skin and sibling organs fade out; the organ floats alone.
- **Click routing** — suit/skin handlers check `e.intersections` for an `organId` (organ or beacon) behind them and step aside without `stopPropagation`, so organs win through ghost shells, wireframe and beacons.
- **Off-nominal organs glow from inside** — emissive + fresnel rim + an inverted-hull halo in the status colour, pulsing faster with severity (softer once isolated); labels/inspector/tooltip show the organ's own status and live vitals (off-nominal first).
- **Explode** — organs, skin and ribcage ride their part's explode offset (`organPart()`), so drilling while exploded shows anatomy instead of empty shells. Explode motion is damped (rate 4.5) for a fluid spread.
- Organ meshes mount per zone on first use (then stay mounted to fade), and `warmOrganCache()` pre-builds them in idle time; gallery previews pass `anatomy={false}` (beacons only).

## Procedural Anatomy (`components/three/organ-geometry.ts`)

- No external assets. Builders combine `blob` (unit sphere through a shape function — organic masses, grooves, hila), `tube` (variable-radius Catmull-Rom sweep with rounded caps — vessels, bowel, airways, bones), `lathe` (diaphragm, gallbladder) and boxes (skin layers), with vertex colours and deterministic trig noise.
- Every organ is **one merged `BufferGeometry`** → one raycast target / `onClick` / material (required by `focusOrgan()`); cached per `shape:side`, shared by all viewports.
- `ribcageGeometry()` — translucent ribs/sternum/clavicles shown as chest context; `raycast` disabled so it never steals organ clicks.
- Material (`OrganMesh` in `astronaut-model.tsx`): `meshPhysicalMaterial` (vertex colours, clearcoat + sheen = wet tissue) with an `onBeforeCompile` fresnel rim tinted by the parent zone's triage status (accent when selected). Heartbeat/breath/peristalsis scale animations read the organ's own vitals (`heart_rate_bpm`, `resp_rate`) and stop under reduced motion.
- Labels: pinned when a zone has ≤ 4 organs, hover-only in denser zones; hidden once the organ is focused.
- `tests/organ-geometry.test.ts` builds every organ in Node and checks attributes, finite data, indexing, size band and zone framing.

## Legacy note

The earlier `lib/vitals.ts` / `lib/zones.ts` / `lib/types.ts` and `components/BodyModel.tsx` were superseded by `types/health.ts` + `data/` + the R3F model and were removed; `components/three/fallback-figure.tsx` provides the accessible SVG fallback.
