# Voice Synthesis Documentation Router (`doc/back/voice/index.md`)

> **Context-Saving Rule:** Read only the file below when working on speech synthesis, audio streaming, or viseme lip-sync markers. Update immediately after modifying `backend/app/voice/`.

## Routing Table

| Topic | Read this file | Mapped Code |
| :--- | :--- | :--- |
| Hybrid voice synthesis gateway, ElevenLabs streaming, pure-Python RIFF/WAV PCM synthesizer & lip-sync visemes | [`tts-gateway.md`](tts-gateway.md) | `backend/app/voice/models.py`, `backend/app/voice/tts_service.py`, `backend/app/api/routes/ai.py` |
