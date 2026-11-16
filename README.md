# MEDBAY — Astronaut Health Monitoring & Autonomous Triage System

**NASA Space Apps Challenge Monorepo**

MEDBAY is an autonomous medical officer console for deep-space crews. It monitors
astronaut vitals continuously, triages emergencies on board without Earth's help
(offline-first deterministic rules + ML anomaly scoring), forecasts health trends,
and queues structured cases for ground surgeons when the link returns.

A two-service containerized system (`backend` FastAPI + `frontend` Next.js 16)
orchestrated locally with Docker Compose and deployable to GCP Cloud Run.

> **For AI Agents & Contributors:** Read [`AGENTS.md`](AGENTS.md) and
> [`doc/index.md`](doc/index.md) **before** answering questions or modifying any code.

## What it does

- **6-zone body status** — per-zone status derived from real linked vitals
  (`GET /api/v1/astronaut/body-status`), rendered on a 3D body you can drill down
  body → zone → organ (breadcrumb, ESC, empty-click step-back)
- **Offline-first triage** — deterministic physiological-floor rules that never
  need the network; ML IsolationForest + tier predictor escalates early
  multivariate deterioration
- **Trend forecasting** — 12 indicators with baseline-relative Ridge forecasts
  and 95% CI (`GET /api/v1/trends/{indicator}`), incl. sleep, systolic BP,
  suit pressure and cabin CO₂
- **AI medical companion** — chat routed across Gemini → Ollama (medgemma) →
  deterministic clinical answers, grounded in a pgvector RAG knowledge base;
  optional TTS voice alerts
- **Operator face-ID** — YuNet + SFace biometric sign-in/check-in, operator
  roles (medic/crew), configurable wheel-cadence prizes
- **Telemedicine queue** — Tempus Pro-style store-and-forward alert packets
  with comm-latency simulation
- **Location-aware hazards** — station / transit ship / Mars surface themes and
  hazard multipliers that reshape the triage math
- **Gamified adherence** — daily check-ins, streaks, prize wheel unlocking
  alternate Pulse Orb mascot skins
- **Snapshot restore** — frozen `snapshot` schema restore point; the Settings
  "Reset baseline" button returns the DB to it (seeder baseline fallback)

## Architecture

```text
┌──────────────────────┐        ┌─────────────────────────┐
│  frontend :3000→8080 │ ─────▶ │  backend :8080 (FastAPI) │
│  Next.js 16, R3F 3D, │  HTTP  │  triage · trends · auth  │
│  Zustand, shadcn kit │        │  RAG · voice · gamified  │
└──────────────────────┘        └───────────┬─────────────┘
                                            │
              ┌─────────────────────────────┼──────────────────────────┐
              ▼                             ▼                          ▼
     ┌─────────────────┐          ┌──────────────────┐        ┌──────────────┐
     │ Postgres (Supa- │          │ ollama :11434    │        │ db :5432     │
     │ base via        │          │ medgemma +       │        │ pgvector     │
     │ DATABASE_URL)   │          │ nomic-embed-text │        │ (fallback)   │
     └─────────────────┘          └──────────────────┘        └──────────────┘

  db-autorestore (profile `restore`): one-shot guard that repopulates `public`
  from the frozen `snapshot` schema only when operators are wiped.
```

Application data lives wherever `DATABASE_URL` points — currently a remote
Supabase Postgres; the local `db` container is the offline fallback.

## Quick Start (Local)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start the stack:
   ```bash
   docker compose up --build
   ```
3. Open:
   - Console: `http://localhost:3000`
   - Backend health: `http://localhost:8080/health`
   - OpenAPI docs: `http://localhost:8080/docs`

   Frontend without Docker: `cd frontend && npm install && npm run dev`
   (see [`frontend/README.md`](frontend/README.md) for env vars).

### Demo helpers

- **Crew statuses** — enrolled operators carry real telemetry rows; the seeded
  demo snapshot has one nominal, one caution and one critical astronaut.
- **RUN SIM** (technical view, VITAL SIGNS header) — plays a scripted health
  arc from `frontend/data/sim-progress.json`, POSTing a real telemetry row to
  the backend every ~5s; tiles, zones, trends and status update live.
- **Reset baseline** (Settings) — `PUT /api/v1/tests/dbsnapshot` restores the
  frozen snapshot point (operators + telemetry + gamification) or the generic
  seeder baseline if no snapshot exists.
- **Snapshot tooling** — `scripts/db-snapshot.sh` freezes `public` into a
  `snapshot` schema; `scripts/db-restore.sh` replays it manually;
  `docker compose --profile restore up db-autorestore` repopulates an
  externally wiped DB only when operators are empty.
- **DATA_PROVIDER** — `rest` (default) uses real endpoints; `mock` runs a
  deterministic offline dataset for isolated dev.
- **WHEEL_CADENCE_DAYS** — consecutive check-in days per wheel spin (spec 7;
  set 1 to demo the wheel on day one).

## Repository Structure

```text
.
├── AGENTS.md               # Mandatory agent workflow & repo rules
├── docker-compose.yml      # 4 services + db-autorestore one-shot guard
├── .env.example            # Root environment template (local & GCP)
├── backend/                # FastAPI: triage, trends, auth/face, AI/RAG, telemetry
├── frontend/               # Next.js 16 MEDBAY console (R3F, Zustand, shadcn kit)
├── scripts/                # db-snapshot/restore tooling + GCP deploy helpers
└── doc/                    # Hierarchical documentation & index.md routers
```

## Documentation

Start at [`doc/index.md`](doc/index.md) to route directly to the documentation
for your task without reading unrelated modules — MEDBAY visual language in
[`doc/front/medbay-design.md`](doc/front/medbay-design.md), snapshot workflow in
[`doc/infra/docker-and-env.md`](doc/infra/docker-and-env.md).
