# Clinical Domain Evaluators Documentation Router (`doc/back/triage/evaluators/index.md`)

> **Context-Saving Rule:** Read only the specialized evaluator leaf document matching your target clinical domain.

## Routing Table

| Clinical Evaluator | Leaf Document | Mapped Anatomical Zones | Mapped Code |
| :--- | :--- | :--- | :--- |
| SANS & Cephalad Fluid Shift | [`sans.md`](sans.md) | `head_eyes` | `backend/app/triage/evaluators/sans.py` |
| Radiation Dosimetry & Immune Reactivation | [`radiation_immune.md`](radiation_immune.md) | `skin`, `gut_microbiome` | `backend/app/triage/evaluators/radiation_immune.py` |
| EVA Decompression & Hypoxia Guard | [`eva_hypoxia.md`](eva_hypoxia.md) | `cardiovascular_chest`, `head_eyes` | `backend/app/triage/evaluators/eva_hypoxia.py` |
| Countermeasures & Accelerated Aging Prescriber | [`countermeasures_aging.md`](countermeasures_aging.md) | `spine_skeletal`, `musculoskeletal_limbs` | `backend/app/triage/evaluators/countermeasures_aging.py` |
