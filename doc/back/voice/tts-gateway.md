# Hybrid Voice Synthesis Gateway

## Overview

The Voice Synthesis Gateway (`backend/app/voice/`) delivers audible spoken alerts, clinical instructions, and synchronized mouth viseme cues for crew self-care and 3D avatar lip-sync animation.

It exposes two API contracts:
1. `POST /api/v1/ai/tts`: Unicast speech synthesis returning base64 audio and viseme cue array.
2. `WS /api/v1/ai/tts/stream`: Real-time streaming WebSocket delivering progressive viseme cues and chunked PCM audio packets.

## Providers & Acoustic Frequency Modulation

### 1. ElevenLabs Cloud Audio (`elevenlabs`)
- Invoked when `ELEVENLABS_API_KEY` is configured and `force_offline` is False.
- Streams multilingual audio bytes (`audio/mpeg`).
- Simulates synchronized viseme markers aligned to word intervals.

### 2. Pure-Python Offline RIFF/WAV Generator (`local-riff-wav-synth`)
- Zero external binary dependencies (no `ffmpeg` or `espeak-ng` required).
- Generates valid 16-bit 16000 Hz mono PCM WAV audio (`audio/wav`) with valid RIFF/WAVE container headers.
- **Severity-Modulated Acoustics:**
  - `nominal`: 440 Hz fundamental + 660 Hz third harmonic with smooth bell envelope for reassuring guidance.
  - `caution`: 880 Hz alert tone with rhythmic amplitude modulation pulses and 440 Hz sub-harmonic.
  - `critical`: 1200 Hz / 900 Hz high-urgency alternating warble tone with rapid pulsation.

## Viseme Timing Cues (`VisemeCue`)

Each word in the synthesized text is mapped to a standardized mouth shape for 3D avatar lip-synchronization:
- `A`: Open mouth (vowel 'a' / 'ah')
- `E`: Wide mouth (vowel 'e' / 'ee')
- `I`: Narrow high mouth (vowel 'i')
- `O`: Rounded open mouth (vowel 'o')
- `U`: Small puckered mouth (vowel 'u' / 'oo')
- `M`: Closed lips (bilabial consonants 'm', 'b', 'p')
- `rest`: Neutral resting mouth posture

Each cue includes `start_ms`, `end_ms`, and `viseme`.

## Browser Speech Synthesis Hint (`browser_speech_hint`)

Every TTS response includes a JSON hint dictionary (`text`, `lang`, `rate`, `pitch`) formatted for instant zero-latency consumption via the browser `window.speechSynthesis` Web Speech API.
