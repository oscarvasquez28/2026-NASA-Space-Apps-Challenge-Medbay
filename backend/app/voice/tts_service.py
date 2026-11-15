"""Hybrid voice synthesis gateway service with ElevenLabs and pure-Python RIFF/WAV synthesizer."""

import base64
import io
import logging
import math
import re
import struct
from typing import Optional
import wave

from app.core.config import Settings, get_settings
from app.voice.models import TTSRequest, TTSResponse, VisemeCue

logger = logging.getLogger(__name__)


def _select_viseme_for_word(word: str) -> str:
    """Map word phonetics to a dominant mouth viseme (A, E, I, O, U, M, rest)."""
    clean = re.sub(r"[^a-z]", "", word.lower())
    if not clean:
        return "rest"
    if clean.startswith(("m", "b", "p")):
        return "M"
    for ch in clean:
        if ch in "aeiou":
            return ch.upper()
    return "E"


def generate_offline_riff_wav(
    text: str,
    severity: str = "nominal",
) -> tuple[str, int, list[VisemeCue], bytes]:
    """Generate authentic 16-bit 16000Hz mono PCM WAV audio and lip-sync visemes.

    Modulates acoustic frequency by severity:
      - nominal: 440 Hz fundamental + 660 Hz harmonic with bell envelope
      - caution: 880 Hz rhythmic alert pulses + 440 Hz undertone
      - critical: 1200 Hz / 900 Hz high-urgency alternating warble tone

    Returns:
        tuple: (base64_wav_str, duration_ms, viseme_cues, raw_wav_bytes)
    """
    sample_rate = 16000
    words = re.findall(r"[A-Za-z0-9\'-]+", text)
    if not words:
        words = ["Status", "nominal"]

    word_duration_ms = 180
    silence_gap_ms = 40
    current_ms = 0

    viseme_cues: list[VisemeCue] = []
    pcm_chunks: list[bytes] = []

    for word in words:
        start_ms = current_ms
        end_ms = current_ms + word_duration_ms
        viseme_char = _select_viseme_for_word(word)
        viseme_cues.append(
            VisemeCue(
                start_ms=start_ms,
                end_ms=end_ms,
                viseme=viseme_char,
            )
        )

        num_samples = int(sample_rate * (word_duration_ms / 1000.0))
        word_samples = bytearray()

        fade_len = max(1, int(num_samples * 0.12))

        for n in range(num_samples):
            t = n / sample_rate

            # Smooth fade in and fade out envelope to eliminate audio clicks
            if n < fade_len:
                env = n / fade_len
            elif n > num_samples - fade_len:
                env = (num_samples - n) / fade_len
            else:
                env = 1.0

            if severity == "critical":
                # High-urgency 1200 Hz / 900 Hz warble
                freq = 1200.0 if int(t * 14) % 2 == 0 else 900.0
                signal = math.sin(2.0 * math.pi * freq * t) * 0.85
            elif severity == "caution":
                # 880 Hz alert pulse with rhythmic amplitude modulation
                pulse = 0.9 if int(t * 10) % 2 == 0 else 0.3
                signal = (
                    math.sin(2.0 * math.pi * 880.0 * t) * 0.7 * pulse
                    + math.sin(2.0 * math.pi * 440.0 * t) * 0.25
                )
            else:
                # 440 Hz fundamental + 660 Hz soothing third harmonic
                signal = (
                    math.sin(2.0 * math.pi * 440.0 * t) * 0.65
                    + math.sin(2.0 * math.pi * 660.0 * t) * 0.35
                )

            sample_val = int(signal * env * 24000.0)
            sample_val = max(-32767, min(32767, sample_val))
            word_samples.extend(struct.pack("<h", sample_val))

        pcm_chunks.append(bytes(word_samples))

        # Inter-word silence
        silence_samples = int(sample_rate * (silence_gap_ms / 1000.0))
        pcm_chunks.append(b"\x00\x00" * silence_samples)

        current_ms += word_duration_ms + silence_gap_ms

    raw_pcm_data = b"".join(pcm_chunks)
    total_duration_ms = current_ms

    # Construct genuine RIFF/WAVE container
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(raw_pcm_data)

    raw_wav_bytes = wav_io.getvalue()
    b64_audio = base64.b64encode(raw_wav_bytes).decode("ascii")

    return (b64_audio, total_duration_ms, viseme_cues, raw_wav_bytes)


async def synthesize_voice(
    request: TTSRequest,
    settings: Optional[Settings] = None,
) -> TTSResponse:
    """Synthesize speech using ElevenLabs when available or pure-Python offline PCM wave."""
    app_settings = settings or get_settings()

    # Browser SpeechSynthesis fallback parameters
    speech_rate = 1.0 if request.severity == "nominal" else (1.15 if request.severity == "caution" else 1.3)
    speech_pitch = 1.0 if request.severity == "nominal" else (1.2 if request.severity == "caution" else 1.4)
    browser_hint = {
        "text": request.text,
        "lang": "en-US",
        "rate": speech_rate,
        "pitch": speech_pitch,
    }

    # 1. Attempt ElevenLabs if API key configured and offline mode not forced
    if app_settings.elevenlabs_api_key and not request.force_offline:
        try:
            from elevenlabs.client import AsyncElevenLabs

            client = AsyncElevenLabs(api_key=app_settings.elevenlabs_api_key)
            voice_id = request.voice_id or app_settings.elevenlabs_voice_id or "JBFqnCBsd6RMkjVDRZzb"
            audio_stream = client.text_to_speech.convert(
                voice_id=voice_id,
                text=request.text,
                model_id="eleven_multilingual_v2",
            )
            audio_bytes = b"".join([chunk async for chunk in audio_stream])
            if audio_bytes:
                b64_str = base64.b64encode(audio_bytes).decode("ascii")
                # Generate timing markers aligned with words
                words = re.findall(r"[A-Za-z0-9\'-]+", request.text) or ["Audio"]
                estimated_duration = max(800, len(words) * 220)
                cues = [
                    VisemeCue(
                        start_ms=i * 220,
                        end_ms=(i + 1) * 220 - 40,
                        viseme=_select_viseme_for_word(w),
                    )
                    for i, w in enumerate(words)
                ]
                return TTSResponse(
                    status=request.severity,
                    high_level=f"Synthesized {len(words)} words via ElevenLabs cloud audio stream.",
                    technical=f"ElevenLabs voice_id={voice_id}, format=audio/mpeg, bytes={len(audio_bytes)}",
                    provider_used="elevenlabs",
                    offline_mode=False,
                    mime_type="audio/mpeg",
                    audio_base64=b64_str,
                    duration_ms=estimated_duration,
                    viseme_cues=cues,
                    browser_speech_hint=browser_hint,
                )
        except Exception as exc:
            logger.warning("ElevenLabs synthesis failed (%s); cascading to offline PCM WAV.", exc)

    # 2. Local offline pure-Python RIFF/WAV synthesis fallback
    b64_audio, duration_ms, viseme_cues, _ = generate_offline_riff_wav(
        text=request.text,
        severity=request.severity,
    )

    return TTSResponse(
        status=request.severity,
        high_level=f"Synthesized {len(viseme_cues)} mouth visemes via offline RIFF/WAV generator.",
        technical=(
            f"Pure Python PCM generator: 16-bit 16000Hz mono, severity={request.severity}, "
            f"duration={duration_ms}ms, viseme_count={len(viseme_cues)}"
        ),
        provider_used="local-riff-wav-synth",
        offline_mode=True,
        mime_type="audio/wav",
        audio_base64=b64_audio,
        duration_ms=duration_ms,
        viseme_cues=viseme_cues,
        browser_speech_hint=browser_hint,
    )
