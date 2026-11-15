# Vectorized Space Medicine Knowledge Base (RAG)

## Architecture Overview

The Space Medicine Knowledge Base (`backend/app/rag/`) grounds autonomous clinical decisions, AI chat responses, and crew guidance in authoritative NASA Human Research Program (HRP) Evidence Reports, NASA-STD-3001, and Canadian Space Agency (CSA) space medicine clinical protocols.

```
+-------------------------------------------------------------+
|                      Client Query                           |
|       (GET /api/v1/ai/knowledge  or  POST /api/v1/ai/chat)  |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|               Resilient Embedding Generator                 |
|               (backend/app/rag/embedder.py)                 |
|  1. Ollama (nomic-embed-text) via HTTP (1.5s timeout)       |
|  2. Fast Deterministic 64-dim L2 Trigram + Keyword Fallback |
+------------------------------+------------------------------+
                               | Query Vector
                               v
+-------------------------------------------------------------+
|                Cosine Similarity Retriever                  |
|               (backend/app/rag/retriever.py)                |
|  - Cosine similarity: dot_product(chunk_vec, query_vec)     |
|  - Dimension compatibility handling (64-dim vs 768-dim)     |
|  - Category filtering & descending rank score               |
+------------------------------+------------------------------+
                               | Top-k Chunks
                               v
+-------------------------------------------------------------+
|               MedicalKnowledgeChunk SQLModel                |
|               (Table: medical_knowledge_chunks)             |
|  - Portable JSON string storage (embedding_json)            |
|  - 100% cross-compatible with SQLite test db & PostgreSQL   |
+-------------------------------------------------------------+
```

## Seeded Clinical Domains (`seed_data.py`)

Eight core NASA HRP and CSA clinical protocol chunks are pre-seeded automatically on first database initialization:

1. **SANS (`nasa-hrp-sans-001`):** Spaceflight-Associated Neuro-ocular Syndrome. Protocols: Thigh Cuffs (30-40 mmHg, 4h), 1-carbon B-complex vitamins (Folate 800mcg, B12 1000mcg, B6 50mg), LBNP/Chibis (35 mmHg, 2h), OCT RNFL scans.
2. **Radiation/CANS (`nasa-hrp-radiation-cans-002`):** SPE shelter protocol, latent herpesvirus (VZV/EBV) reactivation, oral Valacyclovir (1000 mg PO TID), ceramide barrier repair cream, and biodosimetry.
3. **EVA/Hypoxia (`nasa-hrp-eva-dcs-hypoxia-003`):** Extravehicular decompression sickness, suit pressure lower limits (29.6 kPa caution, 25.0 kPa critical), SpO2 thresholds (<92% caution, <88% critical), 100% O2 prebreathe wash, airlock emergency abort.
4. **Countermeasures/Aging (`nasa-hrp-countermeasures-aging-004`):** Accelerated musculoskeletal degradation, Zero T2 regimen (45m ARED heavy axial loading + 30m CEVIS intervals), Food Physiology (sodium <2000mg/d, protein 1.2-1.5g/kg), Space Gardening microgreens, Vitamin D3.
5. **Cardiovascular (`nasa-csa-cardiovascular-orthostatic-005`):** Plasma volume loss, orthostatic intolerance, pre-landing oral fluid loading (8g NaCl in 1.2L water at T-120 min), 5-bladder anti-G compression suits, recumbent couch posture.
6. **Skin/Microbiome (`nasa-csa-skin-microbiome-006`):** Low humidity ECLSS barrier breakdown, ceramide-cholesterol lipid repair cream, chlorhexidine 2% wound antiseptic, multi-strain probiotics (>=10B CFU) + prebiotic inulin fiber.
7. **Behavioral/Sleep (`nasa-hrp-behavioral-circadian-007`):** Circadian desynchrony and sleep architecture loss (<5.5h debt), SSLS dynamic circadian lighting (6500K blue-enriched day, 2700K warm evening), 8.5h sleep opportunity, micro-dose melatonin (0.5-3.0 mg).
8. **Telemedicine (`nasa-exmc-telemedicine-008`):** Deep space communications latency (1.3s to 22 min), store-and-forward telemetry packetization (`telemedicine_alerts`), asynchronous Flight Surgeon uplink, autonomous stabilization bridge protocols.

## Resilient Embedder (`embedder.py`)

- **Primary Provider:** Ollama (`nomic-embed-text`) through `${OLLAMA_BASE_URL}/api/embeddings` when `OLLAMA_BASE_URL` is non-empty, bounded by `asyncio.wait_for(..., timeout=1.5)` so unreachable Docker hostnames (like `ollama` on Cloud Run) cannot stall startup past HTTP client socket timeouts.
- **Deterministic Offline Fallback:** When Ollama is unreachable or model weights are missing, generates an L2-normalized 64-dimensional float vector:
  - Dimensions 0–47: Polynomial rolling hash of character trigrams.
  - Dimensions 48–63: 16 clinical keyword buckets weighted by domain token matches.
  - L2-normalized: `sqrt(sum(x^2)) == 1.0 ± 1e-4`.
- **Zero 500 Guarantee:** Never raises unhandled network exceptions; always produces valid embedding vectors.
