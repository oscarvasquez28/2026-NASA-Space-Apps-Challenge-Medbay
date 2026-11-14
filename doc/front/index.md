# Frontend Documentation Router (`doc/front/index.md`)

> **Current Status:** `frontend/` is a **MECHAVIS-style interactive lab console** — Next.js 16 (App Router) + React 19 + TS + Tailwind 4 + R3F/drei procedural 3D + Zustand + Recharts. Data flows through a `HealthDataProvider` contract (mock by default; `rest` wires `GET /health` + `POST /api/v1/triage/evaluate`).  
> **Context-Saving Rule:** Read only the subdomain router below matching your task and update it immediately when adding/modifying frontend code.

## Routing Table

| Subdomain / Task | Read this router | Status |
| :--- | :--- | :--- |
| App shell, routing, providers, stores/hooks, backend API integration | [`general/index.md`](general/index.md) | Initialized (lab console) |
| Design blueprint the UI replicates (MECHAVIS reference) | [`mechavis-design-reference.md`](mechavis-design-reference.md) | Reference doc |
| Text-to-Speech (TTS) & hands-free voice alert synthesis | [`tts/index.md`](tts/index.md) | Adapter stub (`useSpeech`) |
| Client-side data models, body-zone visual model contracts | [`models/index.md`](models/index.md) | Initialized (`types/health.ts` + curated data + procedural part→zone map) |
