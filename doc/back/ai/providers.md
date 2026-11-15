# AI Clinical Advisory Providers

## Design Boundary & Hybrid Router Integration

The AI subsystem operates across two integration boundaries:
1. **Advisory Enrichment (`backend/app/ai/client.py`):** Enriches deterministic `TriageAssessment` during standard telemetry evaluation.
2. **Interactive Clinical Router (`backend/app/ai/router_service.py`):** Serves `POST /api/v1/ai/chat` for crew queries, multi-turn dialogues, multimodal diagnostic photos, and voice synthesis payloads.

### Provider Cascade Tiers

| Tier | Provider Identifier | Target Runtime / Engine | Trigger Conditions | Fallback Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | `google-genai:gemini` | Cloud Vertex AI / Gemini 2.5 Flash (`google.genai.Client`) | `earth_comm_latency_sec <= 5.0`, `offline_fallback_active=False`, `GEMINI_API_KEY` set | On network failure, 400 invalid key, or timeout -> cascades to Tier 2 |
| **Tier 2** | `ollama:medgemma` | Containerized edge LLM (`http://ollama:11434`, model `medgemma`) | High latency (>5s), cloud bypass, or Tier 1 failure | On 404 model unpulled or connection timeout (4.0s) -> cascades to Tier 3 |
| **Tier 3** | `offline-rag-clinical-synth` | Pure deterministic Python clinical synthesizer | All offline states or previous tiers unavailable | Grounded in retrieved NASA HRP / CSA protocols; guaranteed 100% zero 500 errors |

### Safety Guardrails
- **Offline Immutability:** When operating in Mars transit or lunar far-side environments (`earth_comm_latency_sec > 5.0`), the system automatically bypasses cloud APIs to prevent communications blocking.
- **Failover Auditability:** Every chat response reports `provider_used`, `offline_mode`, and explicit `failover_reason` explaining why fallback occurred.
