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

## Environment variables

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Browser (build-time) | `http://localhost:8080` | Backend base URL. When unset, the client falls back to `/api/runtime-config`. |
| `NEXT_PUBLIC_ASTRONAUT_IDS` | Browser (build-time) | `AST-01,AST-02,AST-03` | Comma-separated crew IDs. |
| `NEXT_PUBLIC_DATA_PROVIDER` | Browser (build-time) | `mock` | `mock` (deterministic simulated data) or `rest` (real endpoints; missing surfaces delegate to labelled mocks, `partial`). |
| `PUBLIC_API_URL` | Server (runtime) | `http://localhost:8080` | Backend URL returned by `GET /api/runtime-config` inside Docker Compose. |
| `ASTRONAUT_IDS` | Server (runtime) | `AST-01,AST-02,AST-03` | Runtime override for the selector list in Docker. |
| `DATA_PROVIDER` | Server (runtime) | `mock` | Runtime override of the provider in Docker. |

`GET /api/runtime-config` lets the container image stay generic: change the
compose env and restart — no rebuild needed.

## Docker

`docker-compose.yml` builds this directory via `frontend/Dockerfile`
(Next.js standalone output, non-root user, `PORT=8080`, `HOSTNAME=0.0.0.0`).

## Layout

```text
app/            App Router routes + /api/runtime-config route handler
components/ui   primitives + Modal (Radix Dialog)
components/layout  AppShell, Sidebar, Topbar, MissionContextBar,
                   CommandPalette (⌘K), BootSequence
components/three   astronaut-model (procedural + organ drill layer),
                   canvas-scene, model-viewport (+SVG fallback), toolbar,
                   zone/organ tooltips, shared-gallery (drei View previews)
components/widgets   ZoneInspector, ChatPanel, TelemetryLogger,
                     TrendsChart, ChecklistWidget (+Gachapon modal)
types/health.ts  Domain types (mirrors of backend DTOs + explorer model)
data/            Curated deterministic datasets (crew/organs/mission/
                 telemetry/gamification)
services/        health-provider contract · mock-provider · rest-provider · factory
hooks/           Headless data/state hooks (useCrew, useBodyStatus, useTelemetry,
                 useAICompanion, useLocationContext, useGamification, useSpeech…)
stores/          app-store (persisted prefs) · viewer-store (per-viewport)
lib/             api.ts (REST client) · config.ts (runtime config)
tests/           Vitest — HealthDataProvider contract suite
```

See `doc/front/` for the authoritative documentation.
