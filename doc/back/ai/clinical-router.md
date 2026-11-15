# Hybrid Cloud + Local LLM Clinical Router

## Architecture & Cascade Tiers

The AI Clinical Router (`backend/app/ai/router_service.py`) implements a resilient 3-tier cascade designed to provide clinical decision support under any spaceflight operational condition:

```
+-------------------------------------------------------------+
|               Incoming Clinical Chat Request                |
|                    POST /api/v1/ai/chat                     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|         1. Context, Telemetry & RAG Pre-Processing          |
|  - Active LocationContext (earth_comm_latency_sec, offline) |
|  - Latest TelemetryRecord for requested astronaut_id        |
|  - Retrieve Top-3 NASA HRP / CSA protocols via RAG          |
|  - Determine clinical severity (nominal / caution / critical)|
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      Routing Cascade                        |
|                                                             |
|  [Tier 1: Cloud GenAI]                                      |
|    - Eligible: latency <= 5.0s, offline=False, API key set |
|    - Model: gemini-2.5-flash via google.genai               |
|    - Exception / Timeout -> Cascade to Tier 2              |
|                                                             |
|  [Tier 2: Edge LLM]                                         |
|    - Eligible: latency > 5s or Tier 1 failed, & OLLAMA_BASE_URL|
|    - Model: medgemma via Ollama client (4.0s wait_for timeout)|
|    - Exception / Model Not Found -> Cascade to Tier 3       |
|                                                             |
|  [Tier 3: Offline RAG Clinical Synthesizer]                 |
|    - Deterministic clinical countermeasure synthesizer      |
|    - Grounded in retrieved NASA HRP protocols & vitals      |
|    - 100% Guaranteed ZERO 500 ERRORS under any condition    |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      Response Assembly                      |
|  - Dual View Modes: high_level (crew) & technical (surgeon) |
|  - reply formatted according to requested view_mode         |
|  - Optional voice_payload via Voice Synthesis Gateway       |
+-------------------------------------------------------------+
```

## Dual Clinical View Modes

- **Crew View (`high_level`):** Plain-language, operational self-care actions with clear, reassuring steps (e.g. donning Thigh Cuffs at 30-40 mmHg, taking 1-carbon B-complex packets, initiating 100% O2 prebreathe, or retreating to the SPE storm shelter).
- **Flight Surgeon View (`technical`):** Pathophysiological assessment, Frisén edema grading, hemodynamic and intracranial pressure metrics, radiation biodosimetry, and cited clinical protocols.

## Zero-500 Resilience Guarantee

Deep-space exploration involves communication latencies up to 22 minutes (Mars opposition) or total radio blackout behind celestial bodies. All external network calls (Google GenAI, ElevenLabs) are protected with timeouts and graceful exception handlers. If any cloud service is unreachable, the system automatically logs `failover_reason`, sets `offline_mode = True`, and generates deterministic clinical guidance without ever raising an HTTP 500 error.
