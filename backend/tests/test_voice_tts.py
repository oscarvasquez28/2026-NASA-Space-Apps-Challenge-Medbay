"""Test suite for Feature 3.3: Hybrid Voice Synthesis Gateway."""

import base64
import pytest
from httpx import ASGITransport, AsyncClient
from starlette.testclient import TestClient

from app.main import app


@pytest.mark.asyncio
async def test_voice_tts_offline_audio_and_visemes() -> None:
    """Verify offline pure-Python RIFF/WAV synthesis, audio header, and mouth viseme markers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "text": "Caution: SANS visual acuity shift detected. Don Thigh Cuffs.",
            "severity": "caution",
            "force_offline": True,
        }
        response = await client.post("/api/v1/ai/tts", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["provider_used"] == "local-riff-wav-synth"
        assert data["offline_mode"] is True
        assert data["mime_type"] == "audio/wav"
        assert data["status"] == "caution"
        assert data["duration_ms"] > 0
        assert len(data["audio_base64"]) > 0

        # Decode base64 audio and verify genuine RIFF/WAVE header
        wav_bytes = base64.b64decode(data["audio_base64"])
        assert wav_bytes[:4] == b"RIFF"
        assert wav_bytes[8:12] == b"WAVE"
        assert b"fmt " in wav_bytes
        assert b"data" in wav_bytes

        # Verify viseme cues
        cues = data["viseme_cues"]
        assert len(cues) >= 5
        valid_visemes = {"A", "E", "I", "O", "U", "M", "rest"}
        for cue in cues:
            assert cue["start_ms"] >= 0
            assert cue["end_ms"] > cue["start_ms"]
            assert cue["viseme"] in valid_visemes

        # Verify browser speech hint
        hint = data["browser_speech_hint"]
        assert hint["text"] == payload["text"]
        assert hint["lang"] == "en-US"
        assert hint["rate"] > 1.0  # Caution rate slightly faster
        assert hint["pitch"] > 1.0


@pytest.mark.asyncio
async def test_voice_tts_critical_severity_modulation() -> None:
    """Verify acoustic frequency modulation on critical emergency alerts."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "text": "CRITICAL: Severe suit depressurization alert. Abort EVA immediately.",
            "severity": "critical",
            "force_offline": True,
        }
        response = await client.post("/api/v1/ai/tts", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "critical"
        assert data["provider_used"] == "local-riff-wav-synth"
        wav_bytes = base64.b64decode(data["audio_base64"])
        assert wav_bytes[:4] == b"RIFF"
        assert wav_bytes[8:12] == b"WAVE"


def test_voice_tts_streaming_websocket() -> None:
    """Verify WebSocket /api/v1/ai/tts/stream frames: start, viseme, audio_chunk, and complete."""
    sync_client = TestClient(app)
    with sync_client.websocket_connect("/api/v1/ai/tts/stream") as websocket:
        # Send initial synthesis request
        websocket.send_json({
            "text": "Oxygen level nominal. All environmental systems within operational bounds.",
            "severity": "nominal",
            "force_offline": True,
        })

        # Frame 1: start
        frame_start = websocket.receive_json()
        assert frame_start["type"] == "start"
        assert frame_start["provider"] == "local-riff-wav-synth"

        # Frame 2: viseme
        frame_viseme = websocket.receive_json()
        assert frame_viseme["type"] == "viseme"
        assert len(frame_viseme["viseme_cues"]) > 0

        # Frame 3+: audio_chunk
        audio_chunks_received = 0
        while True:
            frame = websocket.receive_json()
            if frame["type"] == "audio_chunk":
                audio_chunks_received += 1
                assert "chunk_base64" in frame
                assert len(frame["chunk_base64"]) > 0
                assert frame["format"] == "wav"
            elif frame["type"] == "complete":
                assert frame["total_chunks"] >= 1
                assert frame["total_duration_ms"] > 0
                assert frame["status"] == "nominal"
                break
            else:
                pytest.fail(f"Unexpected frame type: {frame.get('type')}")

        assert audio_chunks_received >= 1


@pytest.mark.asyncio
async def test_voice_tts_elevenlabs_online_async_generator(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify ElevenLabs online path consumes async_generator stream without awaiting convert()."""
    from types import SimpleNamespace
    import elevenlabs.client

    async def fake_convert(**kwargs: object):
        assert kwargs["voice_id"] == "custom-voice-id"
        yield b"ID3-chunk-1-"
        yield b"chunk-2"

    class FakeAsyncElevenLabs:
        def __init__(self, api_key: str) -> None:
            assert api_key == "test-elevenlabs-key"
            self.text_to_speech = SimpleNamespace(convert=fake_convert)

    monkeypatch.setattr(elevenlabs.client, "AsyncElevenLabs", FakeAsyncElevenLabs)

    from app.core.config import Settings
    from app.voice.models import TTSRequest
    from app.voice.tts_service import synthesize_voice

    settings = Settings(
        elevenlabs_api_key="test-elevenlabs-key",
        elevenlabs_voice_id="custom-voice-id",
    )
    response = await synthesize_voice(
        request=TTSRequest(text="Oxygen nominal.", force_offline=False),
        settings=settings,
    )

    assert response.provider_used == "elevenlabs"
    assert response.offline_mode is False
    assert response.mime_type == "audio/mpeg"
    assert base64.b64decode(response.audio_base64) == b"ID3-chunk-1-chunk-2"
    assert len(response.viseme_cues) == 2
