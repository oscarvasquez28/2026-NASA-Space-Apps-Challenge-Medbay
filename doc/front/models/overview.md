# Frontend Models Overview

## Domain Types (`frontend/types/health.ts`)

- **Backend DTO mirrors** — All Phase 1–4 backend Pydantic contracts are mirrored cleanly: `TriageLevel` / `VitalSigns` / `TriageAssessment` / `HealthResponse`, `LocationContextResponse` / `LocationContextUpdate` / `HazardMultipliers`, `TelemetryIngestRequest` / `TelemetryIngestResponse` / `ImageMetadata`, `AstronautBodyStatusResponse` / `AnatomicalZoneStatusBackend`, `TrendAnalysisResponse`, `KnowledgeSearchResponse` / `KnowledgeDocument`, `AIChatRequest` / `AIChatResponse`, `TTSRequest` / `TTSResponse` / `VisemeCue`, `GamificationStatusResponse` / `CheckupCompleteResponse`, `TelemedicineSyncQueueResponse` / `TelemedicineFlushResponse`, and `DatabaseSnapshotRestoreResponse`.
- **Explorer model** — `ZoneId` (`head|chest|spine|limbs|gut|skin`), `BodyZone` (status, `uiToken`, vitals, `partIds`, 3D `position`, `highLevel`, `technical`, `selfExamSteps`, `recommendedCountermeasures`, `activeRisks`), `CrewMember` (zones, biometrics, risks, protocols, checks, readiness, overall status), `ViewMode` (`high_level|technical`).
- **Drill-down anatomy** — `Organ` (model-local `position`/`rotation`, `shape: OrganShape` builder id, `side` ±1 for paired organs, optional `focusDistance` and `anim: heartbeat|breath|peristalsis`, vitals, description). `MODEL_GROUP_OFFSET` converts model-local ↔ world coords. Organ status is the organ's own: `organStatus()` = worst live zone reading among its vital keys + `ORGAN_WATCH` keys; `organVitals()` overlays the member's live zone readings on the curated values.
- **Telemetry** — `TelemetryMetric` (`heart_rate`, `spo2`, `core_temp`, `exertion`, `radiation`, `fatigue`, `blood_sugar`, `bone_density`, `visual_acuity`, `mission_readiness`), `TelemetrySeries` (points + forecast with `lowerCi`/`upperCi` + `MissionEvent[]` + reference `band` + `thresholdWarning`/`warningDetails` + `highLevel`/`technical`).
- **Location context** — `LocationProfile` (synced with backend `location_setting`, `gravityG`, `commLatencySec`, `offlineFallbackActive`, 5 `HazardWeights` + `HazardMultipliers`, `eclss` readings), `LocationId` (station/spacecraft/moon/mars/eva).
- **AI companion contract** — `AssistantResponse` (`message`, `highLevel`, `technical`, `referencedZoneIds`, `actions: [{type:"focus",zoneId}]`, `insights`, `assumptions`, `mode`, `providerUsed`, `failoverReason`, `offlineMode`, `triageTier`, `retrievedKnowledge`, `recommendedActions`, `voicePayload`), `ChatMessage`.
- **Ingest / gamification** — `BehaviorLog`, `LogAck`, `GamificationState` (12 skins across `common|rare|epic|legendary`, 5 backend `routine_tasks`, tokens, compliance %, equipped skin id), `SkinDef`.

## Curated & Offline Datasets (`frontend/data/`)

- `crew.ts` — baseline structural/biometric metadata + `ORGAN_WATCH` vital templates overlaid by `/api/v1/astronaut/body-status` in `rest` mode.
- `suit-rig.ts` — EVA-suit skeleton (shoulders, arm abduction, hips; floor y = 0) shared by the suit geometry and the organ atlas.
- `organs.ts` — `ORGANS` atlas (28 organs) + `organsOf(zoneId)` / `getOrgan(id)` / `zoneFraming(zoneId)` / `organStatus` / `organVitals`. Shared across crew; per-member status comes from that member's live zone vitals. Convention: the model faces +z, so **patient-left = +x** (`side: 1`).
  - head: brain (hemispheres + gyri, cerebellum, brainstem), eyes ×2 (iris/pupil, optic nerve, recti)
  - chest: heart (4 chambers, aortic arch + branches, pulmonary trunk, venae cavae, coronaries), lungs ×2 (fissures, cardiac notch), trachea/bronchi, esophagus, diaphragm
  - spine: cervical / thoracic / lumbar columns (bodies, discs, arches, processes), pelvis/sacrum
  - limbs: upper arms ×2 (biceps + humerus), femurs ×2 (head, trochanter, condyles, patella)
  - gut: liver, gallbladder, stomach + duodenum, spleen, pancreas, kidneys ×2 (vessels, adrenal, ureter), small intestine, colon (haustra, appendix), bladder
  - skin: cross-section blocks (epidermis/dermis/hypodermis, follicles, sweat gland, vessels) on abdomen + L forearm
- `mission.ts` — `LOCATION_PROFILES` fallback presets matching the 5 backend `LocationSetting` profiles + mission day/phases.
- `telemetry.ts` — deterministic mock time series + 95% CI forecast fallback + mission-event markers + reference bands for all 10 `TelemetryMetric` keys.
- `gamification.ts` — 5 backend-aligned `DAILY_CHECKLIST` routine tasks (`task_*`), `SKIN_PALETTES` (`getSkinPalette`), and 12 `COMPANION_SKINS` across `common|rare|epic|legendary`.

In default `rest` mode (`partial: false`), live data comes from FastAPI across all 29 Postman Master requests; only mock-only metrics (`exertion`, `fatigue`) or explicit `DATA_PROVIDER=mock` / Vitest use the offline datasets above.

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
