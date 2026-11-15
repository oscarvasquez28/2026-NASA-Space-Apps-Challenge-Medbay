# Frontend Documentation Router (`doc/front/index.md`)

> **Current Status:** `frontend/` is a **MECHAVIS-style interactive lab console** — Next.js 16 (App Router) + React 19 + TS + Tailwind 4 + R3F/drei procedural 3D + Zustand + Recharts. Data flows through `HealthDataProvider`, defaulting to `rest` (`RestHealthDataProvider`, `partial: false`) connected to all 15 FastAPI endpoints across the 29-item Postman Master suite; `mock` remains available for offline simulation and unit tests.  
> **Context-Saving Rule:** Read only the subdomain router below matching your task and update it immediately when adding/modifying frontend code.

## Routing Table

| Subdomain / Task | Read this router | Status |
| :--- | :--- | :--- |
| App shell, routing, providers, stores/hooks, backend API integration, local operator session (register/check-in/users + Prize Drum) | [`general/index.md`](general/index.md) | Active (Full 29-API REST integration + local session layer) |
| Design blueprint the UI replicates (MECHAVIS reference) | [`mechavis-design-reference.md`](mechavis-design-reference.md) | Reference doc |
| Text-to-Speech (TTS) & hands-free voice alert synthesis | [`tts/index.md`](tts/index.md) | Active (`POST /api/v1/ai/tts` + visemes via `useSpeech`) |
| Client-side data models, body-zone visual model contracts | [`models/index.md`](models/index.md) | Initialized (`types/health.ts` + curated data + procedural part→zone map) |
