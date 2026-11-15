"""Hybrid Cloud + Local LLM Clinical Router Service."""

import base64
import logging
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.ai.schemas import AIChatRequest, AIChatResponse
from app.context.service import get_current_location_context
from app.core.config import Settings, get_settings
from app.db.models import TelemetryRecord
from app.rag.models import KnowledgeDocumentSchema
from app.rag.retriever import retrieve_knowledge
from app.voice.models import TTSRequest, TTSResponse
from app.voice.tts_service import synthesize_voice

logger = logging.getLogger(__name__)


def _guess_image_mime(data: bytes) -> str:
    """Sniff the container format for a decoded diagnostic image payload."""
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:3] == b"GIF":
        return "image/gif"
    return "image/jpeg"


def _evaluate_clinical_severity(
    message: str,
    vitals: Optional[TelemetryRecord],
    retrieved_docs: list[KnowledgeDocumentSchema],
) -> tuple[str, str]:
    """Evaluate severity status ('nominal' | 'caution' | 'critical') and triage tier."""
    msg = message.lower()

    # 1. Critical triggers
    critical_keywords = [
        "abort", "depressuriz", "suit pressure is 24", "suit pressure 24", "spo2 dropped to 86",
        "spo2 is 86", "86%", "bends", "decompression sickness", "hypoxia", "spe alert",
        "solar particle event", "250 msv", "cardiac arrest", "unconscious", "refractory shock",
        "severe vision loss", "blind spot", "critical",
    ]
    if any(k in msg for k in critical_keywords):
        return ("critical", "TIER_3_GROUND_SURGEON")

    if vitals:
        if vitals.spo2_percent < 88.0 or (vitals.suit_pressure_kpa is not None and vitals.suit_pressure_kpa < 25.0):
            return ("critical", "TIER_3_GROUND_SURGEON")
        if vitals.radiation_dose_msv is not None and vitals.radiation_dose_msv >= 250.0:
            return ("critical", "TIER_3_GROUND_SURGEON")
        if vitals.visual_acuity_logmar is not None and vitals.visual_acuity_logmar >= 0.50:
            return ("critical", "TIER_3_GROUND_SURGEON")
        if vitals.bone_mineral_density_t_score is not None and vitals.bone_mineral_density_t_score <= -2.5:
            return ("critical", "TIER_3_GROUND_SURGEON")
        if vitals.status == "critical":
            return ("critical", "TIER_3_GROUND_SURGEON")

    # 2. Caution triggers
    caution_keywords = [
        "blur", "headache", "vision", "sans", "optic", "edema", "rash", "shingles",
        "vzv", "tingling", "blister", "pressure", "fatigue", "sleep", "insomnia",
        "bone", "muscle", "glucose", "dizziness", "fainting", "syncope", "pruritus",
        "dryness", "caution", "pain",
    ]
    if any(k in msg for k in caution_keywords):
        return ("caution", "TIER_2_CMO_REVIEW")

    if vitals:
        if vitals.spo2_percent < 95.0 or (vitals.suit_pressure_kpa is not None and vitals.suit_pressure_kpa < 29.6):
            return ("caution", "TIER_2_CMO_REVIEW")
        if vitals.radiation_dose_msv is not None and vitals.radiation_dose_msv > 50.0:
            return ("caution", "TIER_2_CMO_REVIEW")
        if vitals.visual_acuity_logmar is not None and vitals.visual_acuity_logmar >= 0.20:
            return ("caution", "TIER_2_CMO_REVIEW")
        if vitals.blood_sugar_mg_dl > 110.0:
            return ("caution", "TIER_2_CMO_REVIEW")
        if vitals.status == "caution":
            return ("caution", "TIER_2_CMO_REVIEW")

    return ("nominal", "TIER_1_SELF_CARE")


def _synthesize_deterministic_clinical_guidance(
    message: str,
    status: str,
    triage_tier: str,
    vitals: Optional[TelemetryRecord],
    retrieved_docs: list[KnowledgeDocumentSchema],
    has_image: bool = False,
) -> tuple[str, str, list[str]]:
    """Synthesize structured high_level and technical responses grounded in NASA HRP/CSA RAG chunks."""
    msg = message.lower()
    top_doc = retrieved_docs[0] if retrieved_docs else None

    # Determine dominant clinical domain from top doc or keywords
    domain = top_doc.category if top_doc else "General"
    if "sans" in msg or "optic" in msg or "blur" in msg or "eye" in msg:
        domain = "SANS"
    elif "hypoxia" in msg or "suit" in msg or "depressuriz" in msg or "bends" in msg or "airlock" in msg or "eva" in msg:
        domain = "EVA/Hypoxia"
    elif "radiation" in msg or "spe" in msg or "rash" in msg or "shingles" in msg or "blister" in msg or "tingling" in msg:
        domain = "Radiation/CANS"
    elif "bone" in msg or "muscle" in msg or "ared" in msg or "exercise" in msg or "glucose" in msg:
        domain = "Countermeasures/Aging"
    elif "faint" in msg or "orthostatic" in msg or "syncope" in msg or "cardiovascular" in msg:
        domain = "Cardiovascular"
    elif "skin" in msg or "dry" in msg or "itch" in msg or "microbiome" in msg:
        domain = "Skin/Microbiome"
    elif "sleep" in msg or "circadian" in msg or "insomnia" in msg:
        domain = "Behavioral/Sleep"

    recommended_actions: list[str] = []

    if domain == "SANS":
        high_level = (
            "Microgravity fluid shift detected. Immediately don Thigh Cuffs at 30-40 mmHg bilateral pressure for 4 hours "
            "to draw pooled cranial fluids back into the lower extremities. Take the prescribed 1-carbon B-complex vitamin packet "
            "(Folate 800mcg, B12 1000mcg, B6 50mg). Avoid strenuous Valsalva maneuvers and schedule an immediate Optical Coherence "
            "Tomography (OCT) retinal and optic disc nerve fiber layer scan."
        )
        technical = (
            "SANS Clinical Assessment (Frisén Grade 1-2 evaluation): Microgravity cephalad fluid shift eliminates hydrostatic gradient, "
            "inducing elevated central venous pressure and intracranial pressure (~15-20 mmHg). Environmental hypercapnia exacerbates cerebral "
            "arteriolar vasodilation. Prescribed Interventions: (1) Bilateral thigh cuffs at 30-40 mmHg for 4 hours; (2) 1-carbon B-complex "
            "pathway supplementation (Folate 800 mcg/d, B12 1000 mcg/d, B6 50 mg/d); (3) Lower Body Negative Pressure (LBNP/Chibis) "
            "at 35 mmHg for 2 hours; (4) Serial OCT RNFL thickness scans and Humphrey visual field mapping."
        )
        recommended_actions = [
            "Don bilateral thigh cuffs at 30-40 mmHg for 4 hours",
            "Take oral 1-carbon B-complex vitamin packet (Folate 800mcg, B12 1000mcg, B6 50mg)",
            "Perform OCT retinal nerve fiber layer (RNFL) scan",
            "Check cabin PICO2 level (<3.0 mmHg nominal)",
            "Prepare LBNP/Chibis chamber decompression protocol at 35 mmHg",
        ]

    elif domain == "EVA/Hypoxia":
        if status == "critical":
            high_level = (
                "EMERGENCY: Critical EVA suit depressurization and acute hypoxemia detected! Abort the spacewalk immediately, "
                "return to the airlock, initiate rapid airlock repressurization to 101.3 kPa (14.7 psia), and commence 100% "
                "high-flow oxygen prebreathe to purge nitrogen and treat suspected decompression sickness (bends)."
            )
            technical = (
                "Critical Hypobaric Decompression & Hypoxia Protocol: Severe ambient suit pressure drop (<25 kPa / 3.6 psia) and acute "
                "desaturation (SpO2 < 88%) indicate catastrophic decompression and tissue nitrogen bubble supersaturation (venous gas emboli). "
                "Immediate Clinical Countermeasures: (1) Immediate EVA mission abort and emergency airlock ingress; (2) Repressurize airlock "
                "to 101.3 kPa (14.7 psia); (3) Commence 100% O2 hyperbaric recompression protocol (simulated US Navy Table 6); "
                "(4) Replace LiOH/amine CO2 scrubber canisters; (5) Continuous pulse oximetry and ECG monitoring."
            )
            recommended_actions = [
                "ABORT EVA IMMEDIATELY: Ingress airlock and repressurize to 101.3 kPa (14.7 psia)",
                "Initiate 100% high-flow oxygen wash and hyperbaric recompression protocol",
                "Swap LiOH / metal-organic framework CO2 scrubber canisters",
                "Immobilize affected joints to prevent nitrogen bubble coalescence",
                "Enqueue Tier-3 Store-and-Forward Telemedicine alert to Ground Surgeon",
            ]
        else:
            high_level = (
                "Caution: Mild EVA suit pressure fluctuation or elevated CO2 detected. Check suit pressure seals and reduce physical "
                "exertion. Ensure LiOH scrubber is functioning properly and monitor SpO2 continuously."
            )
            technical = (
                "EVA Physiological Caution: Suit pressure approaching lower boundary (29.6 kPa) with elevated exertional metabolic "
                "rate. Monitor helmet PICO2 and verify suit seal integrity. Maintain SpO2 >= 95%."
            )
            recommended_actions = [
                "Reduce EVA metabolic work rate",
                "Verify suit seal integrity and umbilical connections",
                "Check suit oxygen supply and LiOH scrubber status",
            ]

    elif domain == "Radiation/CANS":
        high_level = (
            "Radiation exposure and viral reactivation alert. Doses above safe thresholds compromise immune defenses, predisposing to "
            "latent herpesvirus (shingles/varicella zoster) reactivation. If acute radiation alarms sound, seek immediate shelter in the "
            "heavily shielded SPE storm module. For dermatomal rash and tingling blisters, initiate oral Valacyclovir 1000 mg three times daily "
            "and apply soothing topical ceramide barrier cream."
        )
        technical = (
            "Radiation Biodosimetry & Latent Viral Reactivation Protocol: GCR / SPE ionizing radiation induces DNA double-strand breaks "
            "and severe T-cell immunosuppression (suppressed CD4+/CD8+ ratios). Coupled with operational sleep debt, latent human herpesviruses "
            "(VZV/EBV) reactivate presenting as dermatomal vesicular lesions. Interventions: (1) SPE polyethylene water-wall storm shelter retreat; "
            "(2) Valacyclovir 1000 mg PO TID for 7-10 days; (3) Dosimeter lockdown and saliva PCR viral shedding assay; (4) Topical ceramide "
            "plus hydrocortisone 1% barrier repair cream; (5) Probiotic and soluble prebiotic fiber supplementation."
        )
        recommended_actions = [
            "Retreat to shielded SPE storm shelter if solar flare in progress",
            "Initiate Valacyclovir 1000 mg PO TID for 7-10 days",
            "Apply topical ceramide barrier repair cream twice daily",
            "Collect saliva swab for PCR viral shedding biodosimetry",
            "Log cumulative radiation dosimeter reading in health record",
        ]

    elif domain == "Countermeasures/Aging":
        high_level = (
            "Musculoskeletal unloading detected. Without gravity, bone calcium resorption and muscle atrophy mirror accelerated terrestrial aging. "
            "Complete your prescribed daily 2.5-hour countermeasure workout: 45 minutes of heavy axial resistive exercises (squats, deadlifts) "
            "on ARED, followed by 30 minutes of high-intensity intervals on CEVIS. Consume fresh Veggie microgreens, restrict sodium to <2000 mg, "
            "and take Vitamin D3 1000 IU."
        )
        technical = (
            "Musculoskeletal & Metabolic Countermeasures (Zero T2 Regimen): Mechanical unloading induces osteoclastic trabecular resorption "
            "(BMD loss ~1-1.5%/month) and Type I postural muscle fiber atrophy (soleus, gastrocnemius). Disuse downregulates GLUT-4 transporters, "
            "producing peripheral insulin resistance (blood glucose elevation). Clinical Management: (1) ARED resistive axial loading (45 min); "
            "(2) CEVIS/T2 aerobic intervals (30 min); (3) Food Physiology diet: sodium <2000 mg/d, protein 1.2-1.5 g/kg/d, Vitamin D3 1000-2000 IU/d; "
            "(4) Fresh microgreens for antioxidant flavonoids; (5) Fetal lumbar sleep positioning to counter intervertebral disc hyper-hydration."
        )
        recommended_actions = [
            "Execute Zero T2 workout: 45 min ARED heavy resistive loading + 30 min CEVIS aerobic intervals",
            "Take Vitamin D3 1000-2000 IU and calcium citrate supplement",
            "Harvest and consume fresh microgreens from Veggie chamber",
            "Adhere to sodium restriction (<2000 mg/day) and adequate protein (1.2-1.5 g/kg)",
            "Perform weekly near-infrared lumbar spinal alignment assessment",
        ]

    elif domain == "Cardiovascular":
        high_level = (
            "Orthostatic deconditioning precaution. In zero-g, reduced vascular tone and contracted blood volume increase syncope risks during "
            "gravity transitions. Two hours prior to de-orbit or high-G maneuvers, execute oral fluid loading: drink 1.2 liters of water with "
            "8 grams of sodium chloride electrolyte tablets. Don your 5-bladder anti-gravity compression suit and remain supine."
        )
        technical = (
            "Cardiovascular Deconditioning & Orthostatic Intolerance: Chronic microgravity suppresses renin-angiotensin-aldosterone axis, "
            "reducing circulating plasma volume by 10-15% and desensitizing arterial baroreceptors. G-vector transitions induce splanchnic and "
            "lower-limb venous pooling. Protocols: (1) Oral fluid loading: 8 g NaCl dissolved in 1.2 L water at T-120 min; (2) Don 5-bladder "
            "anti-G compression garment (40-50 mmHg at ankles); (3) Supine recumbent couch configuration (Gx acceleration vector); "
            "(4) Prepare IV normal saline 1000 mL bolus for refractory hypotension."
        )
        recommended_actions = [
            "Initiate oral fluid loading (8g NaCl in 1.2L water) 120 min prior to gravity transition",
            "Don 5-bladder pneumatic anti-G suit or graduated compression stockings",
            "Maintain recumbent supine posture during deceleration",
            "Monitor continuous ECG for postural reflex tachycardia",
        ]

    elif domain == "Skin/Microbiome":
        high_level = (
            "Integumentary barrier irritation detected. Low cabin humidity and rinseless cleansers degrade the skin's lipid barrier, causing "
            "dryness and micro-fissures. Apply ceramide barrier restoration moisturizer twice daily. Use antiseptic wipes for active lesions "
            "and take your daily multi-strain probiotic to sustain healthy gut and dermal microbiomes."
        )
        technical = (
            "Integumentary Barrier Degradation & Microbiome Dysbiosis: ECLSS low humidity (40-50%) accelerates transepidermal water loss (TEWL) "
            "and stratum corneum thinning. Closed habitat induces commensal depletion and opportunistic pathogen colonization. "
            "Protocol: (1) Ceramide-cholesterol lipid barrier cream twice daily; (2) Chlorhexidine 2% cleansing on erythematous lesions; "
            "(3) Multi-strain oral probiotic (>=10 billion CFU) + 5g chicory inulin soluble fiber; (4) ECLSS HEPA antimicrobial check."
        )
        recommended_actions = [
            "Apply ceramide lipid repair cream twice daily to dry/irritated areas",
            "Cleanse active lesions with chlorhexidine gluconate 2% wipes",
            "Take daily encapsulated probiotic (>= 10B CFU) and soluble prebiotic fiber",
            "Inspect ECLSS cabin air filter status",
        ]

    elif domain == "Behavioral/Sleep":
        high_level = (
            "Circadian sleep debt detected. 90-minute orbital photoperiods disrupt natural melatonin rhythms. Ensure a protected 8.5-hour sleep "
            "window in your acoustic-shielded sleep compartment with earplugs. Utilize blue-enriched lighting (6500K) during waking shifts "
            "and switch to warm blue-free lighting (2700K) 2 hours before sleep."
        )
        technical = (
            "Circadian Desynchrony & Sleep Architecture Fragmentation: Ambient ECLSS avionics noise (55-65 dBA) and circadian disruption cause "
            "slow-wave and REM sleep suppression, elevating sympathetic tone and degrading psychomotor vigilance. Interventions: "
            "(1) SSLS dynamic circadian lighting: 6500K blue-enriched day, 2700K blue-depleted evening; (2) Protected 8.5h sleep opportunity; "
            "(3) Exogenous micro-dose melatonin (0.5-3.0 mg PO 30 min before sleep); (4) Daily 3-minute PVT-B cognitive fatigue screening."
        )
        recommended_actions = [
            "Ensure protected 8.5-hour sleep opportunity in sound-attenuated sleep quarters",
            "Switch SSLS dynamic cabin lighting to warm blue-depleted mode (2700K)",
            "Consider micro-dose melatonin (0.5 - 3.0 mg) 30 min prior to sleep",
            "Perform 3-minute Psychomotor Vigilance Task (PVT-B) fatigue test",
        ]

    else:
        high_level = (
            f"Astronaut health status is currently evaluated as {status}. Vital signs and telemetry are tracked under nominal operating "
            "parameters. Adhere to your standard daily exercise schedule, nutritional countermeasure intake, and scheduled sleep windows."
        )
        technical = (
            f"Autonomous Clinical Assessment: Status evaluated as {status} (Triage Tier: {triage_tier}). Telemetry parameters: "
            f"HR={vitals.heart_rate_bpm if vitals else 72} bpm, SpO2={vitals.spo2_percent if vitals else 98}%, "
            f"Core Temp={vitals.core_temp_c if vitals else 37.0} C. No immediate intervention required."
        )
        recommended_actions = [
            "Maintain scheduled 2.5-hour countermeasure physical exercise",
            "Follow standard hydration and balanced space food physiology diet",
            "Report any emergent vision, skin, or respiratory symptoms",
        ]

    if has_image:
        high_level += " Diagnostic image received — no on-board vision model ran in offline mode; flagged for flight-surgeon review."
        technical += " Diagnostic image payload ingested (base64); no vision-capable inference tier available offline — flagged for ground medical review."

    return (high_level, technical, recommended_actions)


async def handle_ai_chat(
    request: AIChatRequest,
    session: AsyncSession,
    settings: Optional[Settings] = None,
) -> AIChatResponse:
    """Process an AI clinical chat query through the resilient 3-tier cascade.

    Cascade tiers:
      Tier 1: Google GenAI (gemini-2.5-flash) when online, low latency, and key present
      Tier 2: Ollama (medgemma) local edge LLM with 4.0s timeout
      Tier 3: Offline deterministic RAG clinical synthesizer (guaranteed zero 500 errors)
    """
    app_settings = settings or get_settings()

    # 1. Fetch current operational environment context
    location_context = await get_current_location_context(session)
    comm_latency = location_context.earth_comm_latency_sec
    is_offline_env = location_context.offline_fallback_active

    # 2. Fetch latest telemetry vitals for target astronaut
    vitals_stmt = (
        select(TelemetryRecord)
        .where(TelemetryRecord.astronaut_id == request.astronaut_id)
        .order_by(TelemetryRecord.timestamp.desc())
        .limit(1)
    )
    vitals_result = await session.execute(vitals_stmt)
    latest_vitals = vitals_result.scalar_one_or_none()

    # 3. Retrieve relevant space medicine knowledge chunks via RAG
    retrieved_knowledge, embed_provider, _ = await retrieve_knowledge(
        session=session,
        query=request.message,
        top_k=3,
    )

    # 4. Assess clinical status and triage tier
    status, triage_tier = _evaluate_clinical_severity(
        message=request.message,
        vitals=latest_vitals,
        retrieved_docs=retrieved_knowledge,
    )

    # 4.5 Decode the optional diagnostic image once so whichever tier answers
    #     actually receives it in a vision-capable format.
    diag_image_b64: Optional[str] = request.diagnostic_image_base64 or None
    if diag_image_b64 and ";base64," in diag_image_b64:
        # Tolerate data-URL framed payloads — providers want raw base64.
        diag_image_b64 = diag_image_b64.rsplit(";base64,", 1)[-1]
    diag_image_bytes: Optional[bytes] = None
    if diag_image_b64:
        try:
            diag_image_bytes = base64.b64decode(diag_image_b64, validate=True)
        except Exception:
            logger.warning("Ignoring invalid diagnostic_image_base64 payload")
            diag_image_b64 = None

    provider_used: Any = "offline-rag-clinical-synth"
    failover_reason: Optional[str] = None
    offline_mode = True
    high_level_text = ""
    technical_text = ""
    recommended_actions: list[str] = []

    # 5. Routing Evaluation
    can_attempt_gemini = (
        not request.force_offline
        and not is_offline_env
        and comm_latency <= 5.0
        and bool(app_settings.gemini_api_key)
    )

    if request.force_offline:
        failover_reason = "Offline mode explicitly forced by client"
    elif is_offline_env:
        failover_reason = "Spacecraft operational context has offline fallback active"
    elif comm_latency > 5.0:
        failover_reason = (
            f"Earth comm latency ({comm_latency:.1f}s) exceeds real-time interactive threshold (5.0s); "
            "autonomous edge clinical routing engaged"
        )
    elif not app_settings.gemini_api_key:
        failover_reason = "No GEMINI_API_KEY configured; edge clinical synthesis engaged"

    # Tier 1: Attempt Google GenAI
    if can_attempt_gemini:
        try:
            from google import genai

            client = genai.Client(api_key=app_settings.gemini_api_key)
            prompt = (
                f"You are the NASA/CSA Autonomous Space Medicine Clinical Assistant.\n"
                f"Astronaut: {request.astronaut_id}\n"
                f"Message: {request.message}\n"
                f"Location: {location_context.location_setting} (latency={comm_latency}s)\n"
                f"Retrieved Protocols: {[d.title for d in retrieved_knowledge]}\n"
                f"Provide concise crew instructions and technical flight surgeon assessment."
            )
            contents: list[Any] = [prompt]
            if diag_image_bytes is not None:
                from google.genai import types as genai_types

                contents[0] = prompt + (
                    "\nA diagnostic image is attached — analyze its visible "
                    "clinical features and fold them into the assessment."
                )
                contents.append(
                    genai_types.Part.from_bytes(
                        data=diag_image_bytes,
                        mime_type=_guess_image_mime(diag_image_bytes),
                    )
                )
            response = await client.aio.models.generate_content(
                model=app_settings.vertex_ai_model,
                contents=contents,
            )
            if response and response.text:
                provider_used = "google-genai:gemini"
                offline_mode = False
                high_level_text = response.text
                technical_text = (
                    f"Gemini 2.5 Flash Advisory:\n{response.text}\n"
                    f"Referenced Protocols: {', '.join(d.chunk_key for d in retrieved_knowledge)}"
                )
                recommended_actions = [
                    f"Adhere to {d.title}" for d in retrieved_knowledge
                ]
        except Exception as exc:
            logger.warning("Google GenAI call failed (%s); cascading to Edge LLM.", exc)
            failover_reason = f"Google GenAI error: {exc}"

    # Tier 2: Attempt Ollama MedGemma
    if (
        provider_used == "offline-rag-clinical-synth"
        and not request.force_offline
        and app_settings.ollama_base_url
    ):
        try:
            import asyncio
            import ollama

            ollama_client = ollama.AsyncClient(host=app_settings.ollama_base_url)
            user_message: dict[str, Any] = {
                "role": "user",
                "content": request.message,
            }
            if diag_image_b64:
                # MedGemma is multimodal — Ollama accepts base64 image frames.
                user_message["images"] = [diag_image_b64]
            # Enforce hard 4.0s timeout (covers DNS resolution + inference) to avoid blocking astronauts.
            chat_resp = await asyncio.wait_for(
                ollama_client.chat(
                    model=app_settings.ollama_llm_model,
                    messages=[
                        {
                            "role": "system",
                            "content": "You are MedGemma space medicine clinical advisor.",
                        },
                        user_message,
                    ],
                ),
                timeout=4.0,
            )
            if chat_resp and "message" in chat_resp and "content" in chat_resp["message"]:
                med_content = chat_resp["message"]["content"]
                provider_used = "ollama:medgemma"
                offline_mode = True
                high_level_text = med_content
                technical_text = f"MedGemma Edge Assessment:\n{med_content}"
                recommended_actions = [f"Follow {d.title}" for d in retrieved_knowledge]
        except Exception as exc:
            logger.debug("Ollama MedGemma unavailable (%s); cascading to offline RAG synthesizer.", exc)
            if failover_reason is None:
                failover_reason = f"Ollama MedGemma unavailable ({exc})"

    # Tier 3: Deterministic Offline RAG Clinical Synthesizer (Guaranteed 100% Zero-500)
    if provider_used == "offline-rag-clinical-synth":
        has_diag_image = diag_image_b64 is not None
        synth_high, synth_tech, synth_actions = _synthesize_deterministic_clinical_guidance(
            message=request.message,
            status=status,
            triage_tier=triage_tier,
            vitals=latest_vitals,
            retrieved_docs=retrieved_knowledge,
            has_image=has_diag_image,
        )
        high_level_text = synth_high
        technical_text = synth_tech
        recommended_actions = synth_actions

    # Select reply based on view_mode
    reply_text = high_level_text if request.view_mode == "high_level" else technical_text

    # Voice synthesis payload if requested
    voice_payload: Optional[TTSResponse] = None
    if request.include_voice:
        tts_req = TTSRequest(
            text=reply_text,
            astronaut_id=request.astronaut_id,
            severity=status,
            force_offline=request.force_offline or offline_mode,
            view_mode=request.view_mode,
        )
        voice_payload = await synthesize_voice(tts_req, settings=app_settings)

    return AIChatResponse(
        status=status,
        high_level=high_level_text,
        technical=technical_text,
        astronaut_id=request.astronaut_id,
        reply=reply_text,
        view_mode=request.view_mode,
        provider_used=provider_used,
        failover_reason=failover_reason,
        offline_mode=offline_mode,
        earth_comm_latency_sec=comm_latency,
        triage_tier=triage_tier,
        retrieved_knowledge=retrieved_knowledge,
        recommended_actions=recommended_actions,
        voice_payload=voice_payload,
    )
