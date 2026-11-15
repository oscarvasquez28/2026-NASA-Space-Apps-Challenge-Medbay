# 6-Zone Anatomical Body Status & Dual-View Aggregator

## Overview

The astronaut service (`backend/app/astronaut/`) synthesizes recent physiological streams, vitals, and diagnostic images across six primary anatomical zones corresponding to critical spaceflight human risks.

## 6 Anatomical Zones

1. **`head_eyes` (Head & Neuro-Ocular / SANS):** Spaceflight-Associated Neuro-Ocular Syndrome (SANS), cephalad fluid redistribution, choroidal folds, cotton wool spots, and intracranial pressure shifts.
2. **`cardiovascular_chest` (Cardiovascular & Thoracic):** Thoracic fluid redistribution, stroke volume shifts, orthostatic intolerance, cardiac dysrhythmias, and EVA hypoxia.
3. **`spine_skeletal` (Spine & Skeletal System):** Axial spinal elongation (5-7 cm), lumbar paraspinal strain, disc herniation risk, and bone mineral density demineralization.
4. **`musculoskeletal_limbs` (Musculoskeletal & Limbs):** Postural slow-twitch (Type I) muscle fiber loss, gastrocnemius/soleus atrophy, and heel enthesopathy.
5. **`gut_microbiome` (Gastrointestinal & Microbiome):** Space Motion Sickness (SMS), altered gastrointestinal motility, metabolic glucose shifts, and microbiome dysbiosis.
6. **`skin` (Skin & Integumentary Barrier):** Epidermal thinning, skin barrier breakdown, contact dermatitis, and microgravity/radiation-induced herpesvirus (EBV/VZV) reactivation.

## Semantic UI Design Tokens

Each anatomical zone returns a standardized UI token designed for zero-logic frontend component rendering:
- `status-nominal`: Green / stable baseline.
- `status-caution`: Amber / elevated risk or minor symptom reported.
- `status-critical`: Red / immediate clinical intervention or CMO review required.

## Dual-View Synthesis

`AstronautBodyStatusResponse` returns top-level `status`, `overall_status`, `overall_ui_token`, `high_level`, and `technical` summaries, and each anatomical zone provides dual-mode clinical summaries:
- **`high_level`:** Astronaut-facing plain-English summary highlighting immediate action items and physical self-exam steps.
- **`technical`:** Flight Surgeon clinical telemetry metrics, biomarker evaluations, and pathophysiological context.
- **Checklists & Mitigations:** Every zone includes `self_exam_steps` (crew instructions) and `recommended_countermeasures` (targeted exercise, LBNP, pharmaceutical, or ECLSS operational protocols).
