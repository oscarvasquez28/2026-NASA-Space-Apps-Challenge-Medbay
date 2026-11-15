"""Versioned API routes for AI Clinical Advisory, RAG Knowledge Base, and Voice Synthesis."""

import base64
import json
import logging
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    Query,
    WebSocket,
    WebSocketDisconnect,
    status,
)
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.router_service import handle_ai_chat
from app.ai.schemas import AIChatRequest, AIChatResponse
from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.rag.models import (
    KnowledgeDocumentSchema,
    KnowledgeSearchResponse,
)
from app.rag.retriever import retrieve_knowledge
from app.voice.models import TTSRequest, TTSResponse
from app.voice.tts_service import (
    generate_offline_riff_wav,
    synthesize_voice,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Clinical Advisory & Voice"])


@router.get(
    "/knowledge",
    response_model=KnowledgeSearchResponse,
    summary="Semantic Space Medicine Knowledge Search",
    description="Vector search across authoritative NASA HRP and CSA clinical protocols using cosine similarity.",
)
async def search_space_medicine_knowledge(
    q: str = Query(default="", description="Medical query, symptom keywords, or protocol topic"),
    category: Optional[str] = Query(default=None, description="Optional clinical domain filter"),
    top_k: int = Query(default=3, ge=1, le=20, description="Maximum number of protocol chunks to return"),
    session: AsyncSession = Depends(get_session),
) -> KnowledgeSearchResponse:
    """Execute vector similarity search across seeded NASA HRP / CSA protocols."""
    results, provider, total_chunks = await retrieve_knowledge(
        session=session,
        query=q,
        top_k=top_k,
        category=category,
    )

    if results:
        top_match = results[0]
        high_level = (
            f"Found {len(results)} relevant space medicine protocols. "
            f"Top match: {top_match.title} ({top_match.category}) with similarity score {top_match.score:.4f}."
        )
        technical = (
            f"Vector retrieval executed across {total_chunks} chunks using provider '{provider}'. "
            f"Top chunk key: {top_match.chunk_key}, reference: {top_match.source_reference}."
        )
        search_status = "nominal"
    else:
        high_level = "No matching space medicine protocols found for query."
        technical = f"Knowledge base empty or query '{q}' yielded no results across {total_chunks} records."
        search_status = "caution"

    return KnowledgeSearchResponse(
        status=search_status,
        high_level=high_level,
        technical=technical,
        total_chunks=total_chunks,
        embedding_provider=provider,
        results=results,
    )


@router.post(
    "/chat",
    response_model=AIChatResponse,
    summary="Hybrid Cloud + Local LLM Clinical Chat Router",
    description="Context-aware 3-tier cascade (Google GenAI -> Ollama MedGemma -> Offline RAG Clinical Synth) with zero 500 guarantee.",
)
async def chat_with_clinical_ai(
    request: AIChatRequest,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> AIChatResponse:
    """Route crew or flight surgeon chat queries to the most appropriate AI tier."""
    return await handle_ai_chat(request=request, session=session, settings=settings)


@router.post(
    "/tts",
    response_model=TTSResponse,
    summary="Hybrid Voice Synthesis Gateway",
    description="Synthesize speech with ElevenLabs (online) or pure-Python RIFF/WAV PCM generator (offline) with lip-sync visemes.",
)
async def text_to_speech(
    request: TTSRequest,
    settings: Settings = Depends(get_settings),
) -> TTSResponse:
    """Generate audio waveform and lip-sync visemes for astronaut guidance."""
    return await synthesize_voice(request=request, settings=settings)


@router.websocket("/tts/stream")
async def stream_text_to_speech(
    websocket: WebSocket,
) -> None:
    """Real-time streaming WebSocket endpoint for chunked audio and mouth viseme cues."""
    await websocket.accept()
    try:
        data = await websocket.receive_json()
        text = data.get("text", "Status nominal.")
        severity = data.get("severity", "nominal")
        force_offline = data.get("force_offline", True)

        # 1. Send start frame
        await websocket.send_json({
            "type": "start",
            "provider": "local-riff-wav-synth",
            "severity": severity,
            "offline_mode": force_offline,
        })

        # 2. Generate audio and viseme cues
        b64_audio, duration_ms, viseme_cues, raw_wav = generate_offline_riff_wav(
            text=text,
            severity=severity,
        )

        # 3. Send viseme timing frame
        await websocket.send_json({
            "type": "viseme",
            "viseme_cues": [cue.model_dump() for cue in viseme_cues],
        })

        # 4. Stream audio chunks (split into 4096-byte segments)
        chunk_size = 4096
        total_chunks = max(1, (len(raw_wav) + chunk_size - 1) // chunk_size)

        for i in range(total_chunks):
            start_idx = i * chunk_size
            end_idx = min(len(raw_wav), (i + 1) * chunk_size)
            chunk_slice = raw_wav[start_idx:end_idx]
            chunk_b64 = base64.b64encode(chunk_slice).decode("ascii")

            await websocket.send_json({
                "type": "audio_chunk",
                "chunk_index": i,
                "total_chunks": total_chunks,
                "chunk_base64": chunk_b64,
                "format": "wav",
            })

        # 5. Send completion frame
        await websocket.send_json({
            "type": "complete",
            "total_chunks": total_chunks,
            "total_duration_ms": duration_ms,
            "status": "nominal",
        })

        await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)

    except WebSocketDisconnect:
        logger.debug("WebSocket client disconnected normally during TTS streaming.")
    except Exception as exc:
        logger.error("Error during WebSocket TTS streaming: %s", exc)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(exc),
            })
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        except Exception:
            pass
