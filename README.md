# Astronaut Health Monitoring & Autonomous Triage System

**NASA Space Apps Challenge Monorepo**

A two-service containerized system (`backend` and `frontend`) designed for local orchestration with Docker Compose and deployment to Google Cloud Platform (GCP Cloud Run).

> **For AI Agents & Contributors:** Read [`AGENTS.md`](AGENTS.md) and [`doc/index.md`](doc/index.md) **before** answering questions or modifying any code.

## Repository Structure

```text
.
├── AGENTS.md               # Mandatory agent workflow & repo rules
├── docker-compose.yml      # Local multi-container orchestration (backend + frontend)
├── .env.example            # Root environment template (local & GCP)
├── backend/                # Python FastAPI backend (API, AI, Autonomous Triage)
├── frontend/               # Empty (.gitkeep only) — awaiting frontend stack & UI design
└── doc/                    # Hierarchical context-saving documentation & index.md routers
```

## Quick Start (Local)

1. Copy `.env.example` to `.env` (and optionally `backend/.env.example` to `backend/.env`):
   ```bash
   cp .env.example .env
   ```
2. Validate and start the services:
   ```bash
   docker compose config
   docker compose up --build
   ```
3. Verify the backend health endpoint:
   - Backend Health: `http://localhost:8080/health`
   - Backend OpenAPI Docs: `http://localhost:8080/docs`
   - Frontend Placeholder: `http://localhost:3000`

## Documentation

Start at [`doc/index.md`](doc/index.md) to route directly to the documentation for your task without reading unrelated modules.
