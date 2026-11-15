"""Authoritative NASA HRP and CSA Space Medicine Knowledge Base Seed Chunks."""

from typing import Any

SPACE_MEDICINE_SEED_CHUNKS: list[dict[str, Any]] = [
    {
        "chunk_key": "nasa-hrp-sans-001",
        "title": "NASA HRP Clinical Practice Guideline: SANS Assessment & Countermeasures",
        "category": "SANS",
        "source_reference": "NASA HRP Evidence Report: Risk of Spaceflight-Associated Neuro-ocular Syndrome (SANS) (NASA/TP-2017-217377); CSA Space Medicine Clinical Guidance.",
        "content_high_level": (
            "Microgravity shifts bodily fluids upward toward the head, elevating pressure behind the eyes. "
            "This can cause optic disc swelling, flattened globes, and hyperopic vision blurring. "
            "If vision becomes blurry or headaches occur, immediately don Thigh Cuffs at 30-40 mmHg for 4 hours "
            "to draw fluid back into the legs, and consume the prescribed 1-carbon B-complex vitamin packet. "
            "For critical vision changes or blind spots, stop strenuous workouts, perform an OCT eye scan, "
            "and prepare the lower body negative pressure (LBNP/Chibis) device."
        ),
        "content_technical": (
            "Cephalad fluid redistribution eliminates the 2-meter terrestrial hydrostatic gradient, elevating central venous pressure "
            "(CVP) and intracranial pressure (ICP) to ~15-20 mmHg continuously. This results in optic disc edema (Frisén Grade 1-4), "
            "chorioretinal folds, posterior globe flattening, and hyperopic refractive shift (LogMAR >= 0.20 caution, >= 0.50 critical). "
            "Genetic polymorphisms in the 1-carbon metabolic pathway (MTRR, SHMT1) and elevated homocysteine predispose crew to endothelial dysfunction. "
            "Environmental hypercapnia (PICO2 > 3.0-4.0 mmHg) causes cerebral vasodilation, exacerbating ICP.\n"
            "Prescribed Protocols:\n"
            "1. Thigh Cuffs Venous Restriction Protocol: 30-40 mmHg bilateral cuff inflation for 4 hours/day.\n"
            "2. B-Complex 1-Carbon Vitamin Protocol: Folate (800 mcg/d), Vitamin B12 (1000 mcg/d), Vitamin B6 (50 mg/d).\n"
            "3. LBNP Decompression Protocol: Chibis chamber at 35 mmHg vacuum for 2 hours.\n"
            "4. Diagnostic Monitoring: Optical Coherence Tomography (OCT) RNFL thickness scan, Humphrey visual fields, and Rosenbaum near-vision card check at 14 inches."
        ),
    },
    {
        "chunk_key": "nasa-hrp-radiation-cans-002",
        "title": "NASA HRP Radiation Health Standard: SPE Shelter & Latent Viral Reactivation",
        "category": "Radiation/CANS",
        "source_reference": "NASA-STD-3001 Vol 1 §4.2; NASA HRP Risk of Acute Radiation Syndromes Due to Solar Particle Events; NASA HRP Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders.",
        "content_high_level": (
            "Deep space cosmic rays and solar flares can penetrate the spacecraft. Doses above 50 mSv weaken immune defenses, "
            "allowing dormant viruses like shingles (varicella zoster) or Epstein-Barr to reactivate as painful skin rashes. "
            "If radiation alarms sound or cumulative dose exceeds 250 mSv, take immediate shelter in the heavily shielded SPE storm module. "
            "For rash outbreaks, take oral valacyclovir antiviral tablets and apply soothing ceramide creams."
        ),
        "content_technical": (
            "Galactic Cosmic Radiation (GCR, high-Z and high-energy HZE ions) and Solar Particle Events (SPE, solar energetic protons) produce "
            "complex DNA double-strand breaks and central nervous system (CANS) oxidative stress. Doses > 50 mSv (monthly caution) and "
            ">= 250 mSv (acute permissible limit) cause profound T-cell immunosuppression (decreased CD4+/CD8+ ratios, impaired IL-2 signaling). "
            "Coupled with sleep debt (<5.5h) and elevated cortisol, latent human herpesviruses (EBV, VZV / shingles) reactivate, "
            "presenting with dermatomal vesicular eruptions, epidermal necrosis, and gut microbiome dysbiosis.\n"
            "Prescribed Protocols:\n"
            "1. Emergency SPE Storm Shelter Protocol: Immediate retreat to water-wall / polyethylene shielded storm shelter.\n"
            "2. Oral Antiviral Protocol: Valacyclovir 1000 mg PO TID for 7-10 days.\n"
            "3. Biodosimetry Protocol: Dosimeter badge lockdown, saliva PCR for EBV/VZV shedding, and peripheral blood draw for dicentric chromosome aberration assay.\n"
            "4. Barrier & Immune Support: Topical ceramide + hydrocortisone 1% cream; soluble prebiotic fiber and multi-strain probiotic pack."
        ),
    },
    {
        "chunk_key": "nasa-hrp-eva-dcs-hypoxia-003",
        "title": "NASA JSC EVA Physiology: Decompression Sickness Guard & Hypoxia Thresholds",
        "category": "EVA/Hypoxia",
        "source_reference": "NASA Johnson Space Center (JSC) Extravehicular Activity Standard Medical Operations; NASA HRP Risk of Decompression Sickness (DCS).",
        "content_high_level": (
            "Working outside in an EVA suit (4.3 psia / 29.6 kPa) puts you at risk for the bends (nitrogen bubbles in joints or lungs) "
            "if cabin pressure drops too quickly. Watch your suit pressure and oxygen levels constantly. If SpO2 drops below 92%, "
            "slow down your work rate. If SpO2 drops below 88%, suit pressure falls below 25 kPa, or you feel joint pain or chest tightness, "
            "abort the spacewalk immediately, return to the airlock, repressurize to 14.7 psia, and breathe 100% pure oxygen."
        ),
        "content_technical": (
            "Decompression from 101.3 kPa (14.7 psia) habitat to hypobaric suit environment (29.6 kPa / 4.3 psia 100% O2) creates tissue "
            "nitrogen supersaturation, predisposing to venous gas emboli (VGE) and bubble formation in periarticular tissues and microvasculature. "
            "Exertional metabolic demand during surface operations causes acute hypoxemia (SpO2 < 92% caution, < 88% critical) and helmet dead-space "
            "CO2 accumulation (PICO2 > 4.0-4.5 mmHg caution, >= 7.0 mmHg critical) from LiOH/amine canister exhaustion. "
            "Gravity transitions exacerbate neuro-vestibular sensorimotor ataxia.\n"
            "Prescribed Protocols:\n"
            "1. In-Suit Prebreathe Protocol: 60-90 min 100% O2 wash with light cycle ergometry to strip inert nitrogen.\n"
            "2. Emergency EVA Abort & Airlock Repressurization Protocol: Immediate airlock ingress and repressurization to 101.3 kPa (14.7 psia).\n"
            "3. Hyperbaric Treatment Protocol: 100% high-flow O2 hyperbaric recompression therapy (simulated US Navy Table 6).\n"
            "4. Scrubber Replacement Protocol: Immediate canister swap for LiOH / metal-organic framework CO2 scrubbers."
        ),
    },
    {
        "chunk_key": "nasa-hrp-countermeasures-aging-004",
        "title": "NASA HRP Musculoskeletal & Metabolic Protocol: Zero T2 & Food Physiology",
        "category": "Countermeasures/Aging",
        "source_reference": "NASA HRP Risk of Early Onset Osteoporosis; NASA HRP Risk of Impaired Performance Due to Reduced Muscle Size, Strength, and Endurance; NASA Food Physiology Investigation.",
        "content_high_level": (
            "Without gravity pulling on your body, bones lose calcium (1% per month) and postural muscles shrink, mirroring accelerated aging on Earth. "
            "Muscle unloading also makes cells resistant to insulin, raising blood sugar levels. Protect yourself by completing your 2.5-hour "
            "daily workout: heavy squats and deadlifts on the ARED machine plus interval cycling on CEVIS. Eat fresh microgreens harvested "
            "from the Veggie garden, keep sodium under 2000 mg, and take your daily Vitamin D3 supplement."
        ),
        "content_technical": (
            "Unloading of weight-bearing skeletal structures induces osteoclastic resorption exceeding osteoblastic synthesis, resulting in trabecular "
            "bone loss of 1.0-1.5% per month (BMD T-score < -1.0 osteopenia, <= -2.5 osteoporosis). Disuse causes selective atrophy of slow-twitch "
            "Type I postural muscle fibers (soleus and gastrocnemius) with downregulation of skeletal muscle GLUT-4 transporters, causing "
            "microgravity-induced peripheral insulin resistance (blood sugar > 110 mg/dL caution, >= 180 mg/dL critical). Paraspinal muscle "
            "unloading causes intervertebral disc hyper-hydration and 5-7 cm spinal lengthening, increasing lumbar radiculopathy risks.\n"
            "Prescribed Protocols:\n"
            "1. Zero T2 Exercise Regimen: 45 minutes heavy ARED resistive axial loading (squats, deadlifts, heel raises) + 30 minutes CEVIS / T2 high-intensity aerobic intervals.\n"
            "2. Food Physiology Countermeasure: Sodium restriction (<2000 mg/day), protein intake (1.2-1.5 g/kg/day), Vitamin D3 (1000-2000 IU/day), and calcium citrate.\n"
            "3. Space Gardening Cultivation Task: Daily consumption of fresh microgreens from Veggie / APH for lutein, polyphenols, and antioxidant flavonoids.\n"
            "4. Spinal Health Protocol: Lumbar fetal positioning harness during sleep; anti-resorptive bisphosphonate (zoledronic acid) clinical review for BMD T-scores < -2.0."
        ),
    },
    {
        "chunk_key": "nasa-csa-cardiovascular-orthostatic-005",
        "title": "NASA/CSA Cardiovascular Protocol: Fluid Loading & Orthostatic G-Transition",
        "category": "Cardiovascular",
        "source_reference": "NASA HRP Risk of Orthostatic Intolerance During and Following Spaceflight; CSA Bio-Monitor & Cardio-Ox Investigation Protocols.",
        "content_high_level": (
            "In zero-g, your heart doesn't have to work against gravity, causing blood volume to decrease by 10-15%. When returning to gravity "
            "(Earth, Moon, or Mars), blood rushes down into your abdomen and legs, causing dizziness, fainting, or racing heart rates. "
            "Two hours before landing, complete the oral fluid loading protocol: drink 1 liter of water with electrolyte tablets. "
            "Don your anti-gravity compression suit, and remain reclined in your seat couch during deceleration."
        ),
        "content_technical": (
            "Microgravity cephalad fluid redistribution prompts renal central volume contraction, suppressing renin-angiotensin-aldosterone axis "
            "and reducing total circulating plasma volume by 10-15%. Prolonged cardiac unloading results in left ventricular mass reduction "
            "and baroreceptor desensitization. Gravity re-entry (Gz/Gx vectors) precipitates splanchnic and lower-extremity venous pooling, "
            "resulting in severe orthostatic hypotension (systolic drop > 20 mmHg), reflex tachycardia (HR > 120 bpm), and cerebral hypoperfusion syncope.\n"
            "Prescribed Protocols:\n"
            "1. Oral Fluid Loading Protocol: 8 grams NaCl (salt tablets) dissolved in 1.0 to 1.5 L water consumed 120 minutes prior to de-orbit burn.\n"
            "2. Anti-Gravity Compression Garment: 5-bladder pneumatic G-suit or graded compression stockings (40-50 mmHg at ankles) donned prior to gravity onset.\n"
            "3. Recumbent Re-entry Couches: Positioning crew in supine posture to transform deceleration vector into chest-to-back (Gx) rather than head-to-toe (Gz).\n"
            "4. IV Crystalloid Resuscitation: Normal saline 1000 mL IV bolus for refractory post-landing orthostatic collapse; continuous Holter monitoring for ectopic rhythms."
        ),
    },
    {
        "chunk_key": "nasa-csa-skin-microbiome-006",
        "title": "NASA/CSA Integumentary Standard: Epidermal Barrier & Habitat Microbiome",
        "category": "Skin/Microbiome",
        "source_reference": "NASA HRP Risk of Adverse Health Outcomes Due to Altered Host-Microbe Interactions; CSA At Home in Space Study; NASA Dermatological Clinical Standards.",
        "content_high_level": (
            "Spacecraft cabin air is dry, lacks natural breezes, and relies on rinseless cleansers, causing skin to dry out, flake, and itch. "
            "At the same time, microbial balances on skin and in the gut change, increasing susceptibility to rashes and infections. "
            "Apply ceramide barrier moisturizing lotions twice daily, use pH-balanced antimicrobial wipes for skin lesions, "
            "and take your daily probiotic packet to protect your gut and immune health."
        ),
        "content_technical": (
            "Confinement in closed-loop environmental control systems (ECLSS) with relative humidity 40-50% and altered skin surface hydration produces "
            "progressive stratum corneum degradation, epidermal thinning (up to 15% reduction in dermal elasticity), and impaired transepidermal "
            "water loss (TEWL). Concurrently, human cutaneous and gastrointestinal microbiomes undergo dysbiotic shifts: depletion of beneficial "
            "commensals (Bifidobacterium, Faecalibacterium prausnitzii) and overgrowth of opportunistic pathogens (Staphylococcus aureus, "
            "Malassezia restricta, Enterobacteriaceae).\n"
            "Prescribed Protocols:\n"
            "1. Topical Barrier Restoration: Ceramide, cholesterol, and free fatty acid lipid barrier repair moisturizer applied twice daily; hydrocortisone 1% for active contact dermatitis.\n"
            "2. Antiseptic Wound & Skin Cleansing: Chlorhexidine gluconate 2% or polyhexamethylene biguanide wipes for localized pruritic or erythematous plaques.\n"
            "3. Oral Microbiome Probiotics: Multi-strain encapsulated probiotic (>= 10 billion CFU Lactobacillus rhamnosus, Bifidobacterium longum) + 5g chicory inulin soluble prebiotic fiber daily.\n"
            "4. Habitat Environmental Sanitation: Weekly swab collection and ECLSS HEPA antimicrobial filter verification."
        ),
    },
    {
        "chunk_key": "nasa-hrp-behavioral-circadian-007",
        "title": "NASA HRP Behavioral Health: Dynamic SSLS Lighting & Sleep Architecture",
        "category": "Behavioral/Sleep",
        "source_reference": "NASA HRP Risk of Adverse Cognitive or Behavioral Conditions and Psychiatric Disorders; NASA-STD-3001 Lighting and Sleep Guidelines.",
        "content_high_level": (
            "Orbiting Earth every 90 minutes disrupts your natural 24-hour internal clock. Cabin pump noise and high workloads make it hard "
            "to get quality sleep. Chronic sleep loss drains mental sharpness, mood, and reflexes. Sleep at least 8.5 hours in your sleep station "
            "with sound-dampening earplugs. In the morning, use blue-enriched bright light to wake up; in the evening, switch to warm, "
            "blue-free light to let natural melatonin rise."
        ),
        "content_technical": (
            "Disruption of the 24-hour terrestrial photoperiod, ambient background noise (55-65 dBA from ECLSS avionics), high operational workload, "
            "and microgravity cephalad fluid shifts severely fragment sleep architecture (marked loss of slow-wave sleep and REM phases). "
            "Cumulative sleep debt (< 5.5 hours/24h window) elevates autonomic sympathetic tone, increases salivary cortisol, degrades working memory, "
            "and slows psychomotor vigilance task (PVT) reaction speeds by > 30%.\n"
            "Prescribed Protocols:\n"
            "1. SSLS Dynamic Circadian Lighting: Blue-enriched high-lux lighting (460-490 nm, 6500K, 500 lux) during subjective day; blue-depleted warm lighting (2700K, < 100 lux) 2 hours prior to sleep window.\n"
            "2. Sleep Hygiene & Acoustic Isolation: Protected 8.5-hour sleep opportunity in sound-attenuated crew sleep compartments; active noise-cancelling earplugs and eye masks.\n"
            "3. Circadian Phase Shifting: Micro-dose exogenous melatonin (0.5 to 3.0 mg PO 30 min before sleep) for EVA or docking shift adjustments; avoidance of caffeine within 6 hours of sleep.\n"
            "4. Objective Cognitive Assessment: Daily 3-minute Psychomotor Vigilance Task (PVT-B) to screen for operational fatigue."
        ),
    },
    {
        "chunk_key": "nasa-exmc-telemedicine-008",
        "title": "NASA Exploration Medical Capability (ExMC): Store-and-Forward Telemedicine",
        "category": "Telemedicine",
        "source_reference": "NASA Exploration Medical Capability (ExMC) Architecture; Tempus Pro Telemedicine Technical Manual; NASA HRP Risk of Inability to Provide Adequate Medical Care in Deep Space.",
        "content_high_level": (
            "When missions take you beyond the Moon to Mars, radio signals take up to 22 minutes each way, making phone calls or live video "
            "consultations with Earth impossible during medical emergencies. Your onboard system evaluates vitals automatically. "
            "If a Tier-3 critical emergency occurs, the system bundles your medical readings, ultrasound scans, and photos into a high-priority packet, "
            "queues it for transmission to Mission Control, and starts immediate life-saving treatments autonomously while waiting for ground review."
        ),
        "content_technical": (
            "Deep space transit beyond cislunar space introduces one-way radio propagation latencies from 1.3 seconds (Moon) to 22 minutes (Mars opposition), "
            "invalidating interactive synchronous telemedicine. Autonomous clinical architectures employ a 3-tier triage hierarchy: Tier-1 (Autonomous Self-Care), "
            "Tier-2 (Crew Medical Officer In-Flight Review), and Tier-3 (Ground Flight Surgeon Multidisciplinary Review). Critical triggers "
            "(refractory shock, SpO2 < 88%, severe SANS Frisén grade >= 3, decompression bends, acute radiation >= 250 mSv) automatically package "
            "structured HL7/FHIR medical telemetry bundles into the persistent store-and-forward queue (telemedicine_alerts).\n"
            "Prescribed Protocols:\n"
            "1. Asynchronous Telemedicine Packetization: Compressed encryption of 12-lead ECG waveforms, vitals time-series, ultrasound cine-loops, and multi-modal diagnostic images.\n"
            "2. Priority Queue Transmission: Priority tagging (CRITICAL, URGENT, ROUTINE) with tracking ID and transmission status (pending, transmitted, acknowledged).\n"
            "3. Ground Flight Surgeon Asynchronous Review: Ground medical console review and generation of uplinked treatment protocols over the Deep Space Network (DSN).\n"
            "4. Autonomous Bridge Protocol: Execution of local deterministic clinical stabilization protocols until ground uplink confirmation is received."
        ),
    },
]
