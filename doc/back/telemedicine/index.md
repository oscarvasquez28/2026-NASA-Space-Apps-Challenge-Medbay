# Telemedicine Domain Documentation Router (`doc/back/telemedicine/index.md`)

> **Context-Saving Rule:** Read only the file(s) needed for Tempus Pro store-and-forward telemedicine and ground sync queueing.

## Routing Table

| Topic | Read this file | Mapped Code |
| :--- | :--- | :--- |
| Store-and-forward packet bundling, Ridge forecasting integration, comm window awareness, and burst flush | [`sync-queue.md`](sync-queue.md) | `backend/app/telemedicine/models.py`, `backend/app/telemedicine/service.py`, `backend/app/api/routes/telemedicine.py` |
