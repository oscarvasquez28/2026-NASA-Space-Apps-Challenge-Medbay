"""Async vector embedder with Ollama integration and deterministic L2-normalized fallback."""

import asyncio
import logging
import math
import re
from typing import Optional

import httpx

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

# 16 domain keyword buckets mapped to indices 48-63
KEYWORD_BUCKETS: list[tuple[int, list[str]]] = [
    (48, ["sans", "optic", "vision", "eye", "disc", "edema", "intracranial", "globe", "frisen", "chorioretinal", "blur", "headache"]),
    (49, ["radiation", "spe", "gcr", "solar", "dose", "msv", "proton", "dosimeter", "shelter", "biodosimetry"]),
    (50, ["cans", "shingles", "vzv", "ebv", "viral", "herpes", "rash", "valacyclovir", "blister", "herpesvirus"]),
    (51, ["eva", "suit", "spacewalk", "airlock", "pressure", "kpa", "psia", "glove", "helmet", "umbilical"]),
    (52, ["hypoxia", "hypoxemia", "spo2", "oxygen", "o2", "saturation", "prebreathe", "co2", "lioh", "scrubber"]),
    (53, ["dcs", "bends", "decompression", "nitrogen", "bubble", "emboli", "joint", "hyperbaric", "recompression"]),
    (54, ["countermeasures", "ared", "cevis", "exercise", "loading", "resistive", "t2", "workout", "cycle"]),
    (55, ["bone", "bmd", "osteoporosis", "osteopenia", "calcium", "resorption", "spine", "elongation", "radiculopathy"]),
    (56, ["muscle", "sarcopenia", "atrophy", "soleus", "postural", "strength", "disuse"]),
    (57, ["metabolism", "glucose", "insulin", "resistance", "glycemic", "diet", "nutrition", "veggie", "microgreens", "vitamin"]),
    (58, ["cardiovascular", "orthostatic", "fainting", "syncope", "tachycardia", "hypotension", "fluid", "g-suit", "blood pressure"]),
    (59, ["skin", "epidermal", "barrier", "ceramide", "dryness", "pruritus", "flaking", "tewl", "stratum"]),
    (60, ["microbiome", "gut", "dysbiosis", "probiotic", "prebiotic", "staphylococcus", "bifidobacterium", "hygiene"]),
    (61, ["sleep", "circadian", "insomnia", "melatonin", "lighting", "ssls", "fatigue", "pvt", "alertness"]),
    (62, ["telemedicine", "tempus", "store-and-forward", "latency", "delay", "uplink", "dsn", "ground", "earth", "comms"]),
    (63, ["emergency", "triage", "critical", "tier", "caution", "alert", "intervention", "protocol", "stabilization"]),
]


def deterministic_fallback_embedding(text: str) -> list[float]:
    """Generate a deterministic 64-dimensional L2-normalized vector.

    Dimensions 0-47: Character trigram hash projection.
    Dimensions 48-63: Domain-specific space medicine keyword bucket weights.
    """
    clean_text = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    words = clean_text.split()
    padded_str = f"  {clean_text}  "

    vec = [0.0] * 64

    # 1. Trigram hashing into bins 0..47
    if len(padded_str) >= 3:
        for i in range(len(padded_str) - 2):
            tri = padded_str[i : i + 3]
            # Simple polynomial rolling hash for trigram
            h = (ord(tri[0]) * 31 * 31 + ord(tri[1]) * 31 + ord(tri[2])) % 48
            vec[h] += 1.0

    # 2. Domain keyword matching into bins 48..63
    text_tokens = set(words)
    for dim, kw_list in KEYWORD_BUCKETS:
        weight = 0.0
        for kw in kw_list:
            if kw in text_tokens:
                weight += 2.5
            elif kw in clean_text:
                weight += 1.2
        vec[dim] += weight

    # 3. L2 normalization
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 1e-9:
        vec = [round(x / norm, 6) for x in vec]
    else:
        # Uniform vector fallback if text is empty
        val = round(1.0 / math.sqrt(64), 6)
        vec = [val] * 64

    return vec


async def generate_embedding(
    text: str,
    settings: Optional[Settings] = None,
) -> tuple[list[float], str]:
    """Generate embedding vector for text using Ollama with fast deterministic fallback.

    Returns:
        tuple[list[float], str]: (embedding_vector, provider_name)
    """
    app_settings = settings or get_settings()

    if app_settings.ollama_base_url:
        endpoint = f"{app_settings.ollama_base_url.rstrip('/')}/api/embeddings"
        payload = {
            "model": app_settings.ollama_embed_model,
            "prompt": text,
        }
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                # Enforce hard wall-clock bound because getaddrinfo() can block past httpx's socket timeout.
                response = await asyncio.wait_for(client.post(endpoint, json=payload), timeout=1.5)
                if response.status_code == 200:
                    data = response.json()
                    embedding = data.get("embedding")
                    if isinstance(embedding, list) and len(embedding) > 0:
                        return (embedding, f"ollama:{app_settings.ollama_embed_model}")
                else:
                    logger.debug(
                        "Ollama embedding returned %s: %s",
                        response.status_code,
                        response.text[:100],
                    )
        except Exception as exc:
            logger.debug("Ollama embedding connection error (%s); falling back to deterministic trigram.", exc)

    fallback_vec = deterministic_fallback_embedding(text)
    return (fallback_vec, "deterministic-trigram-fallback")
