# Postman Collections & Environment Exports (`doc/back/api/postman/index.md`)

> **Context-Saving Rule:** Read this manifest to locate phase-specific ready-to-send Postman collections and local environment templates.

## Postman Workspace Sync (`My Workspace` — `c71d0d6b-b768-41c0-89e8-b0da7d572dac`)

- **Phase 1 Collection:** `Astronaut Health Monitoring & Autonomous Triage API - Phase 1` (`uid: 39296505-63d2d3cc-96e6-4084-ae03-03748fd2ce13`)
- **Phase 2 Collection:** `Astronaut Health Monitoring & Autonomous Triage API - Phase 2` (`uid: 39296505-dbed4868-15dd-4107-a126-e522b9d10280`)
- **Phase 3 Collection:** `Astronaut Health Monitoring & Autonomous Triage API - Phase 3` (`uid: 39296505-87fe8b68-ef96-4869-975a-0ef2d69e0087`)
- **Phase 4 (Master) Collection:** `Astronaut Health Monitoring & Autonomous Triage API - Phase 4 (Master)` (`uid: 39296505-783f7b86-91d2-441f-a53b-555cde9d903d`)
- **Environment:** `Astronaut Health & Autonomous Triage - Local` (`uid: 39296505-1e1e8fae-007b-4b81-9196-87fe926f6775`)

## Local JSON Exports

| Artifact | Purpose | Status |
| :--- | :--- | :--- |
| [`phase1_collection.json`](phase1_collection.json) | Phase 1 ready-to-send collection covering `/health`, `/api/v1/context/location`, `/api/v1/telemetry/ingest`, `/api/v1/astronaut/body-status`, and `/api/v1/triage/evaluate` | Active (Phase 1) |
| [`phase2_collection.json`](phase2_collection.json) | Phase 2 ready-to-send 15-request collection adding 3-tier clinical triage, all 4 NASA HRP / CSA domain evaluator scenarios, and `/api/v1/trends/{indicator}` Ridge forecasting | Active (Phase 2) |
| [`phase3_collection.json`](phase3_collection.json) | Phase 3 comprehensive 24-request collection adding RAG semantic knowledge search (`/api/v1/ai/knowledge`), hybrid clinical chat router (`/api/v1/ai/chat`), and offline voice synthesis (`/api/v1/ai/tts`) | Active (Phase 3) |
| [`phase4_collection.json`](phase4_collection.json) | Phase 4 ready-to-send collection adding Gamification (`/api/v1/gamification/status`, `/api/v1/gamification/checkup-complete`) and Tempus Pro Telemedicine (`/api/v1/telemedicine/sync-queue`, `/api/v1/telemedicine/flush`) | Active (Phase 4) |
| [`master_collection.json`](master_collection.json) | Comprehensive Master unified Postman collection uniting all 29 requests across Phases 1–4 plus `PUT /api/v1/tests/dbsnapshot` with full assertions | Active (Master / Gate 2) |
| [`environment.json`](environment.json) | Local Docker Compose Postman environment pre-configured with `base_url = http://localhost:8080` and `astronautId = AST-01` | Active (Phase 1+) |
