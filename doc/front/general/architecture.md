# Frontend General Architecture

> Reference blueprint: [`mechavis-design-reference.md`](../mechavis-design-reference.md) (MECHAVIS "digital engineering lab" reskin: mechanical component → astronaut body/suit, hotspot → anatomical zone, criticality → triage status).

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript** in [`frontend/`](../../../frontend/).
- **Tailwind CSS 4** + design tokens in [`app/globals.css`](../../../frontend/app/globals.css) — dark workbench theme (`#101113` bg, hairline borders, blue-lavender accent, semantic status tokens `--status-nominal/caution/urgent/critical` — never hardcode status hex in components).
- **Three.js + @react-three/fiber + drei + camera-controls** — procedural EVA-suit astronaut (capsule/sphere primitives only, no external assets), loaded via `dynamic({ ssr: false })` with an accessible SVG fallback.
- **Zustand** — `app-store` (persisted prefs) + `viewer-store` (per-viewport store via React context).
- **Motion** (boot/boot overlay, gachapon), **Recharts** (trends), **Radix Dialog** (modal/palette/drawer), **lucide-react**, **@fontsource** Inter + IBM Plex Mono.
- **Vitest** — provider contract tests in `frontend/tests/`.

## Layout

```text
frontend/
├── app/
│   ├── layout.tsx                # fonts + AppShell
│   ├── page.tsx                  # Home hero (3D astronaut + spec strip)
│   ├── globals.css               # design tokens + component classes
│   ├── api/runtime-config/       # GET runtime env bridge (apiUrl, dataProvider, ids)
│   ├── crew/page.tsx             # Roster explorer (shared-canvas 3D previews)
│   ├── crew/[id]/page.tsx        # Anatomical explorer — core workspace
│   ├── telemetry/page.tsx        # Trends dashboard + overlay modes
│   ├── log/page.tsx              # Telemetry & behavioral logger
│   ├── medic/page.tsx            # Dedicated AI companion view
│   ├── compare/page.tsx          # Two-subject comparison
│   └── settings/page.tsx         # Quality / motion / view-mode prefs
├── components/
│   ├── ui/                       # primitives (Eyebrow, StatusChip…), Modal (Radix)
│   ├── layout/                   # AppShell, Sidebar, Topbar, MissionContextBar,
│   │                             #   CommandPalette (⌘K), BootSequence
│   ├── three/                    # astronaut-model, canvas-scene, model-viewport,
│   │                             #   viewer-toolbar, zone-tooltip, shared-gallery,
│   │                             #   fallback-figure (SVG, a11y)
│   └── widgets/                  # ZoneInspector, ChatPanel, TelemetryLogger,
│                                 #   TrendsChart, ChecklistWidget (+Gachapon)
├── types/health.ts               # Domain types (zones, crew, telemetry, assistant…)
├── data/                         # Curated datasets (crew, mission, telemetry, gamification)
├── services/                     # health-provider (contract), mock-provider,
│                                 #   rest-provider, provider (factory)
├── hooks/                        # useProvider/useCrew/useBodyStatus/useTelemetry/
│                                 #   useLocationContext/useHealthStatus/
│                                 #   useAICompanion/useGamification/useSpeech
├── stores/                       # app-store (persist), viewer-store (context)
├── lib/                          # api.ts (REST client), config.ts (runtime cfg)
└── tests/provider.test.ts        # HealthDataProvider contract suite
```

## Key architectural mandates

1. **Headless separation** — all fetching/state lives in `hooks/` + `stores/`; components are presentational.
2. **HealthDataProvider contract** (`services/health-provider.ts`) — `mock` (default, deterministic curated data, simulated latency) vs `rest` (wires the real endpoints and delegates missing surface to mock, flagged `partial: true`). Swap via `NEXT_PUBLIC_DATA_PROVIDER` / `DATA_PROVIDER`.
3. **Dual view** — `app-store.viewMode` (`high_level` | `technical`) re-renders every widget; persisted.
4. **Location context** — `app-store.locationId` → `LocationProfile` (comm latency, blackout risk, hazard weights, AI link mode) via `useLocationContext`.
5. **Honesty labels** — everything simulated carries `SIMULATED TELEMETRY · NOT A MEDICAL DEVICE` disclaimers (`<Disclaimer>` / `HONESTY_LABEL`).
6. **Single selection/focus pipeline** — model clicks, zone lists, chat references and AI `focus` actions all call `viewer-store.focus(zone)` (one store per `ViewerProvider`). `BodyZone.position` is model-local; `focus()` converts it to world space via `MODEL_GROUP_OFFSET` (`types/health.ts`), the same constant the model group renders at.
7. **Anatomical drill-down** — three depths: body → zone → organ. `viewer-store` tracks `selectedZoneId` + `selectedOrganId` + `focusDistance` (≈1.15 zone, ≈0.42 organ). `focusOrgan(organ)` keeps the parent zone selected; `focus()`/`select()`/`reset()` step back up. UI: `drill-breadcrumb` overlay, `OrganTooltip`, "INTERNAL STRUCTURES" list in `ZoneInspector`. Organ anatomy lives in `data/organs.ts` (shared atlas, parent-zone status inheritance) — not part of the provider contract.
8. **Viewport-height contract** — workspace pages bound themselves to the space `.main-area` leaves (`flex: 1 1 0%` + `min-height: 0` + `overflow: hidden` on the page root), never `min-height:100%`/`height:100%` (content-driven → overflows the fold by sibling heights like `.ctxbar`'s). `.workspace-grid` uses `grid-template-rows: minmax(0,1fr)` so the inspector's content can't inflate the row; `.main-area > *:not(.ctxbar)` carries the fill rule (equal specificity used to override `.ctxbar`'s own `flex` and balloon it).

## Backend Communication Contract

- Browser calls backend directly; CORS handled backend-side.
- Base URL resolution: `NEXT_PUBLIC_API_URL` (build) → `GET /api/runtime-config` (`PUBLIC_API_URL`, Docker-friendly) → `http://localhost:8080`.
- Real endpoints consumed (rest provider): `GET /health` → `checkHealth()`; `POST /api/v1/triage/evaluate` → `submitTelemetry()`. No contract changes.
- `INTERNAL_BACKEND_URL=http://backend:8080` reserved for future server-side proxying.
- Astronaut IDs: `ASTRONAUT_IDS` / `NEXT_PUBLIC_ASTRONAUT_IDS` (no roster endpoint exists).

## Known Gaps (backend contract)

- No roster, telemetry-history, zone, or AI endpoints → those surfaces are served by the **mock provider** and labelled simulated; `rest` mode marks itself `partial` and still delegates them.
- No per-vital status from the API → zone status values come from curated datasets only; no clinical thresholds are hardcoded in components (reference bands ship inside provider telemetry series).
