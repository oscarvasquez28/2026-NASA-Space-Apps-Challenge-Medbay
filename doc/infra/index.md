# Infrastructure Documentation Router (`doc/infra/index.md`)

> **Context-Saving Rule:** Read only the file below that matches your infrastructure task. If you modify `docker-compose.yml`, `backend/Dockerfile`, or any `.env.example`, update the corresponding doc immediately.

## Routing Table

| Task Focus | Read this file | Mapped Repository Files |
| :--- | :--- | :--- |
| Local Docker Compose (4-container topology: db, ollama, backend, frontend), `.env.example` variables | [`docker-and-env.md`](docker-and-env.md) | `docker-compose.yml`, `.env.example`, `backend/.env.example`, `backend/Dockerfile`, `backend/.dockerignore` |

| GCP Cloud Run, Artifact Registry, IAM & service-to-service topology | [`gcp-deployment.md`](gcp-deployment.md) | `backend/Dockerfile`, `docker-compose.yml`, `.env.example` |
