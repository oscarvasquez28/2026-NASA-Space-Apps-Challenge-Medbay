# Frontend General Architecture

> Reference blueprint: [`mechavis-design-reference.md`](../mechavis-design-reference.md) (MECHAVIS "digital engineering lab" reskin: mechanical component → astronaut body/suit, hotspot → anatomical zone, criticality → triage status).

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** in [`frontend/`](../../../frontend/).
- **Tailwind CSS 4** + design tokens in [`app/globals.css`](../../../frontend/app/globals.css) — dark workbench theme (`#101113` bg, hairline borders, blue-lavender accent, semantic status tokens `--status-nominal/caution/urgent/critical` — never hardcode status hex in components).
- **Three.js + @react-three/fiber + drei + camera-controls** — procedural xEMU-style EVA suit + sculpted procedural anatomy (no external assets, rig in `data/suit-rig.ts`), loaded via `dynamic({ ssr: false })` with an accessible SVG fallback.
- **Zustand** — `app-store` (persisted prefs) + `viewer-store` (per-viewport store via React context).
- **Motion** (boot/boot overlay, gachapon), **Recharts** (trends), **Radix Dialog** (modal/palette/drawer), **lucide-react**, **@fontsource** Inter + IBM Plex Mono.
- **Vitest** — provider contract tests in `frontend/tests/`.

## Layout

```text
frontend/
├── app/
│   ├── layout.tsx                # fonts + AppShell
│   ├── page.tsx                  # Home hero (live 3D astronaut + location/crew spec strip + checklist)
│   ├── globals.css               # design tokens + component classes
│   ├── api/runtime-config/       # GET runtime env bridge (apiUrl, dataProvider, ids)
│   ├── crew/page.tsx             # Roster explorer (shared-canvas 3D previews)
│   ├── crew/[id]/page.tsx        # Anatomical explorer — live 6-zone status + self-exams + countermeasures
│   ├── telemetry/page.tsx        # Trends dashboard (8 backend indicators + 95% CI forecast + overlays)
│   ├── log/page.tsx              # Multi-modal telemetry ingest + triage + Tempus Pro queue/flush
│   ├── medic/page.tsx            # Clinical AI copilot + RAG Space Medicine Knowledge Explorer
│   ├── compare/page.tsx          # Two-subject comparison
│   ├── settings/page.tsx         # Quality / motion / view-mode prefs + baseline reset
│   ├── register/page.tsx         # Operator enrollment (face photo required)
│   ├── checkin/page.tsx          # Daily check-in — simulated visual-ID scan
│   └── users/page.tsx            # Operator management (medic-only)
├── components/
│   ├── ui/                       # primitives (Eyebrow, StatusChip…), Modal (Radix),
│   │                             #   FaceCapture (capture/scan camera + upload fallback)
│   ├── layout/                   # AppShell, Sidebar, Topbar, MissionContextBar (+ ECLSS popover),
│   │                             #   CommandPalette (⌘K + baseline reset), BootSequence,
│   │                             #   AuthGate (register/check-in session gate)
│   ├── three/                    # astronaut-model, canvas-scene, model-viewport,
│   │                             #   procedural (shared toolkit), suit-geometry (EVA suit),
│   │                             #   organ-geometry (procedural anatomy), skin-geometry,
│   │                             #   viewer-toolbar, zone/organ tooltips, shared-gallery, fallback-figure
│   └── widgets/                  # ZoneInspector, ChatPanel (+ AUTO TTS & viseme sync,
│                                 #   markdown-rendered assistant replies), TelemetryLogger,
│                                 #   TrendsChart (with 95% CI), ChecklistWidget (+ 12-Skin Suit Locker),
│                                 #   PrizeWheel (check-in reward drum — COMMON/RARE/LEGENDARY)
├── types/health.ts               # Domain types + Phase 1–4 backend DTO mirrors
├── data/                         # Curated metadata, fallbacks & backend-aligned palettes
├── services/                     # health-provider (contract), mock-provider,
│                                 #   rest-provider (partial=false), provider (factory, default rest)
├── hooks/                        # useProvider/useCrew/useBodyStatus/useTelemetry/
│                                 #   useLocationContext/useHealthStatus/
│                                 #   useAICompanion/useGamification/useSpeech (TTS + visemes)
│                                 #   useCheckIn (session/streak/spin cadence), useIdleLock (inactivity lock)
├── stores/                       # app-store (persist + synced location context), viewer-store,
│                                 #   user-store (persisted + backend-synced operators, key `astro-lab:user`)
├── lib/                          # api.ts (typed FastAPI client), config.ts, sample-media.ts
└── tests/                        # provider.test.ts (contract suite) +
                                  #   user-store.test.ts (session logic)

## Key architectural mandates

1. **Headless separation** — all fetching/state lives in `hooks/` + `stores/`; components are presentational.
2. **HealthDataProvider contract** (`services/health-provider.ts`) — `rest` (default, `RestHealthDataProvider` with `partial: false`, connected to all FastAPI Phase 1–4 endpoints) vs `mock` (offline deterministic dataset + Vitest parity). Swap via `NEXT_PUBLIC_DATA_PROVIDER` / `DATA_PROVIDER`.
3. **Dual view** — `app-store.viewMode` (`high_level` | `technical`) dynamically renders backend dual-narrative fields (`high_level` vs `technical`) across context, zones, trends, telemetry, RAG docs, AI chat, gamification, telemedicine, and baseline reset.
4. **Location context & ECLSS** — `app-store.locationId` + `liveLocationProfile` synchronize with `GET/POST /api/v1/context/location` (5-Hazards multipliers, gravity, comm latency, offline fallback, ECLSS parameters) via `useLocationContext`.
5. **Single selection/focus pipeline** — model clicks, zone lists, chat references, and AI `focus` actions all call `viewer-store.focus(zone)` (one store per `ViewerProvider`). `BodyZone.position` is model-local; `focus()` converts it to world space via `MODEL_GROUP_OFFSET` (`types/health.ts`).
6. **Anatomical drill-down & live Vital merge** — `RestHealthDataProvider` merges backend `AstronautBodyStatusResponse` zone statuses, `self_exam_steps`, `recommended_countermeasures`, and `linked_vitals` onto structural `ORGAN_WATCH` baselines in `data/crew.ts`, keeping organ heartbeat/breath/peristalsis animations accurate while reflecting real DB values.
7. **Viewport-height contract** — workspace pages bound themselves to the space `.main-area` leaves (`flex: 1 1 0%` + `min-height: 0` + `overflow: hidden` on the page root).
8. **Biometric session gate & idle lock** — `AuthGate` (inside `AppShell`, using `useIdleLock` + `hydrateAppStore()` + `hydrateUserStore()`) redirects: no operator profiles → `/register`; active operator without a check-in for today or `sessionLocked === true` (after configurable `idleTimeoutMs`, default 3 minutes) → `/checkin`. When `DATA_PROVIDER=rest`, profiles, `face_credentials` embeddings (OpenCV YuNet + SFace), check-ins, and `PrizeWheel` skin rewards synchronize with FastAPI `/api/v1/auth/*` and `/api/v1/gamification/*` (falling back locally in `mock` mode). First enrolled profile is enforced `medic`; `/users` renders for medics only. Recognized faces auto-login and unlock immediately; unrecognized faces prompt `/register` (pre-filled with the captured frame) or manual login. `ChecklistWidget` binds to the active operator's `astronautId`.

## Backend Communication Contract

- Browser calls backend directly; CORS handled backend-side.
- Base URL resolution: `NEXT_PUBLIC_API_URL` (build) → `GET /api/runtime-config` (`PUBLIC_API_URL`, Docker-friendly) → `http://localhost:8080`.
- Full endpoint surface consumed by `RestHealthDataProvider` (`frontend/lib/api.ts`):
  - `GET /health` → `checkHealth()`
  - `GET /api/v1/context/location`, `POST /api/v1/context/location` → `getActiveLocation()`, `getLocationProfile()`, `updateLocationProfile()`
  - `POST /api/v1/triage/evaluate` → `submitTelemetry()`
  - `POST /api/v1/telemetry/ingest` (JSON & `multipart/form-data` image upload) → `ingestTelemetry()`, `submitLog()`
  - `GET /api/v1/astronaut/body-status` → `getCrewMember()`, `getCrew()`
  - `GET /api/v1/trends/{indicator}` (8 backend indicators + 95% CI bounds) → `getTelemetrySeries()`
  - `GET /api/v1/ai/knowledge` → `searchKnowledge()`
  - `POST /api/v1/ai/chat` → `ask()`
  - `POST /api/v1/ai/tts` → `synthesizeSpeech()` (via `useSpeech`)
  - `GET /api/v1/gamification/status`, `POST /api/v1/gamification/checkup-complete` → `getGamification()`, `completeCheckup()`, `pullGachapon()`, `PrizeWheel` skin reward persistence
  - `GET /api/v1/auth/session-state`, `POST /api/v1/auth/register`, `POST /api/v1/auth/identify`, `POST /api/v1/auth/checkin`, `POST /api/v1/auth/claim-wheel-spin`, `DELETE /api/v1/auth/users/{user_id}` → operator enrollment, OpenCV face recognition login, idle lock, and spin claims
  - `GET /api/v1/telemedicine/sync-queue`, `POST /api/v1/telemedicine/flush` → `getTelemedicineQueue()`, `flushTelemedicineQueue()`
  - `PUT /api/v1/tests/dbsnapshot` → `restoreDatabaseSnapshot()`
- `INTERNAL_BACKEND_URL=http://backend:8080` reserved for future server-side proxying.
- Astronaut IDs: `ASTRONAUT_IDS` / `NEXT_PUBLIC_ASTRONAUT_IDS` configures the roster list queried against `/api/v1/astronaut/body-status`; baseline 3D/biometric metadata merges from `frontend/data/crew.ts` (note: two legacy mock-only trend metrics `exertion` and `fatigue` still delegate to `MockHealthDataProvider`).
