# Frontend General Architecture (Pending Initialization)

## Current State

- `frontend/` is intentionally empty except for `frontend/.gitkeep`.
- Do **not** scaffold a framework inside `frontend/` until the team selects the frontend tech stack and final UI design.

## Integration & Container Contract (Ready for Future Implementation)

When the frontend stack is chosen:
1. **Separate Container:** Create `frontend/Dockerfile` serving the app on `0.0.0.0:${PORT:-8080}` (Cloud Run compatible) and switch the `frontend` service in [`docker-compose.yml`](../../../docker-compose.yml) from the placeholder image to `build: ./frontend`.
2. **Backend Communication:**
   - Browser requests target `PUBLIC_API_URL` (local default: `http://localhost:8080`).
   - Any server-side proxy/SSR requests inside Docker Compose target `INTERNAL_BACKEND_URL` (`http://backend:8080`).
   - Backend API contracts are documented in [`doc/back/api/endpoints.md`](../../back/api/endpoints.md).
3. **Documentation Sync:** Immediately update this file, [`doc/front/index.md`](../index.md), and [`doc/infra/docker-and-env.md`](../../infra/docker-and-env.md) when initializing `frontend/`.
