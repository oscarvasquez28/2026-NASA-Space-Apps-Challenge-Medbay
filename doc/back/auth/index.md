# Operator Auth & Facial Recognition Router (`doc/back/auth/index.md`)

> **Context-Saving Rule:** Read only the file(s) needed for operator session management and local OpenCV facial recognition.

## Routing Table

| Topic | Read this file | Mapped Code |
| :--- | :--- | :--- |
| Operator profiles, `face_credentials` table, OpenCV YuNet+SFace engine, idle check-in & spin claim | [`session-and-face-id.md`](session-and-face-id.md) | `backend/app/auth/models.py`, `backend/app/auth/face_engine.py`, `backend/app/auth/service.py`, `backend/app/api/routes/auth.py` |
