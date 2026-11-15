# Frontend — Astronaut Health Monitoring Lab Console

MECHAVIS-style interactive lab: Next.js 16 (App Router) + React 19 + TypeScript
+ Tailwind 4 design tokens + Three.js/R3F procedural 3D body model + Zustand +
Recharts. All data flows through a `HealthDataProvider` contract — a
deterministic **mock** by default; **rest** wires the real backend endpoints
(`GET /health`, `POST /api/v1/triage/evaluate`).

Everything non-backend is explicitly labelled **SIMULATED — NOT A MEDICAL
DEVICE**.

## Local development

```bash
cd frontend
cp .env.example .env.local   # optional — defaults already point to localhost:8080
npm install
npm run dev                  # http://localhost:3000
```

Optional: run the backend for `rest` provider mode:

```bash
docker compose up backend    # or: uvicorn app.main:app --port 8080 (from backend/)
```

## Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Next dev server |
| `npm run build` / `npm start` | Production build / standalone server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest provider-contract suite |

## Routes

| Route | Module |
| :--- | :--- |
| `/` | Home hero (procedural 3D astronaut + spec strip) |
| `/crew` | Roster explorer — search/filter cards, shared-canvas 3D previews |
| `/crew/[id]` | **Anatomical explorer** — clickable 3D zones, inspector, AI drawer |
| `/telemetry` | Trends dashboard — charts, event overlays, forecast mode |
| `/log` | Telemetry & behavioral logger (vitals → triage echo) |
| `/medic` | Dedicated AI companion view |
| `/compare` | Two-subject status comparison + radar |
| `/settings` | Render quality, motion, view mode (persisted) |
| `/register` | Operator enrollment — name/callsign/role + required face photo |
| `/checkin` | Daily check-in via simulated visual-ID scan → confirm → streak |
| `/users` | Operator management (medic-only; users see an access-denied panel) |

## Local operator profiles (simulated session layer)

A **local-only** session layer sits in front of the console:

- `AuthGate` (in `AppShell`) redirects to `/register` when no operators exist
  and to `/checkin` when the active operator has not checked in today.
- Profiles live in `localStorage` under `astro-lab:user` (users, active
  session, check-in records, claimed drum spins). **Nothing is sent to the
  backend** — this is not an auth API.
- The first enrolled operator is always `MEDIC` (flight surgeon); later ones
  may be `medic` or `user`. `/users` and its nav entry are medic-only.
- Enrollment requires a face photo (`getUserMedia` snapshot compressed to a
  ~360px JPEG data URL, or file-upload fallback). `/checkin` runs a
  **simulated visual-ID scan** — the camera only feeds a scan animation; no
  face detection runs. Real recognition is a future adapter.
- Every 5th check-in earns a **Prize Drum** spin (`WHEEL_EVERY_N` in
  `stores/user-store.ts`): a 12-wedge drum labelled only COMMON / RARE /
  LEGENDARY (`DRUM_WEIGHTS` in `data/gamification.ts`) that lands on a
  locally rolled suit skin, preferring ones not already owned.
- Camera capture requires a **secure context** — localhost or HTTPS.

## Environment variables

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Browser (build-time) | `http://localhost:8080` | Backend base URL. When unset, the client falls back to `/api/runtime-config`. |
| `NEXT_PUBLIC_DATA_PROVIDER` | Browser (build-time) | `mock` | `mock` (deterministic simulated data) or `rest` (real endpoints; missing surfaces delegate to labelled mocks, `partial`). |
| `PUBLIC_API_URL` | Server (runtime) | `http://localhost:8080` | Backend URL returned by `GET /api/runtime-config` inside Docker Compose. |
| `DATA_PROVIDER` | Server (runtime) | `mock` | Runtime override of the provider in Docker. |

`GET /api/runtime-config` lets the container image stay generic: change the
compose env and restart — no rebuild needed.

## Docker

`docker-compose.yml` builds this directory via `frontend/Dockerfile`
(Next.js standalone output, non-root user, `PORT=8080`, `HOSTNAME=0.0.0.0`).

## Layout

```text
app/            App Router routes + /api/runtime-config route handler
components/ui   primitives + Modal (Radix Dialog) + FaceCapture (camera
                capture/scan with upload fallback)
components/layout  AppShell, Sidebar, Topbar, MissionContextBar,
                   CommandPalette (⌘K), BootSequence, AuthGate (session gate)
components/three   astronaut-model (suit parts + organ drill layer), suit-geometry
                   (xEMU-style EVA suit), skin-geometry (full-body skin layer),
                   organ-geometry (28 organs), procedural
                   (shared geometry toolkit),
                   canvas-scene, model-viewport (+SVG fallback), toolbar,
                   zone/organ tooltips, shared-gallery (drei View previews)
components/widgets   ZoneInspector, ChatPanel, TelemetryLogger,
                     TrendsChart, ChecklistWidget (+Gachapon modal),
                     PrizeWheel (check-in reward drum)
types/health.ts  Domain types (mirrors of backend DTOs + explorer model)
data/            Curated deterministic datasets (crew/organs/mission/
                 telemetry/gamification)
services/        health-provider contract · mock-provider · rest-provider · factory
hooks/           Headless data/state hooks (useCrew, useBodyStatus, useTelemetry,
                 useAICompanion, useLocationContext, useGamification,
                 useSpeech, useCheckIn…)
stores/          app-store (persisted prefs) · viewer-store (per-viewport) ·
                 user-store (local operator profiles + check-ins)
lib/             api.ts (REST client) · config.ts (runtime config)
tests/           Vitest — HealthDataProvider contract suite + user-store
                 session logic
```

See `doc/front/` for the authoritative documentation.
