# SANS & Cephalad Fluid-Shift Evaluator

## Pathophysiology

Spaceflight-Associated Neuro-Ocular Syndrome (SANS) results from microgravity cephalad fluid redistribution that elevates central venous and intracranial pressure (ICP). This leads to optic disc edema (Frisén grading), posterior globe flattening, hyperopic visual acuity shifts (LogMAR degradation), choroidal folds, and cotton wool spots.

Hypercapnia (>3.0-4.0 mmHg ambient cabin CO2) exacerbates cerebral vasodilation, while 1-carbon metabolic genetic polymorphism (*MTRR*, *SHMT1*) and B-vitamin insufficiency increase biochemical susceptibility.

## Thresholds & Actions

- **Critical:** LogMAR $\ge 0.50$ or symptoms including scotoma, severe vision loss, or disc edema.
  - *Severity:* `critical` (`TIER_3_GROUND_SURGEON`)
  - *Protocols:* Urgent OCT Retinal Thickness Scan, Chibis / LBNP Urgent Decompression (35 mmHg, 2h), High-Dose B-Complex Protocol, Ground Flight Surgeon Emergency Consult.
- **Caution:** LogMAR $> 0.20$ or inspired CO2 $\ge 4.0$ mmHg in 0g or crew headache/visual blur.
  - *Severity:* `caution` (`TIER_2_CMO_REVIEW`)
  - *Protocols:* Thigh Cuffs Venous Restriction Protocol (30-40 mmHg), B-Complex 1-Carbon Vitamin Protocol (Folate 800mcg, B12 1000mcg, B6 50mg), Optical Coherence Tomography (OCT) Checklist, ECLSS Cabin Ventilation Micro-Pocket Clearance.
- **Nominal:** LogMAR $\le 0.20$, normal CO2, no visual symptoms.
  - *Protocols:* Routine Near-Vision Card Check Protocol, Standard Microgravity Fluid Shift Monitoring.
