# EVA Decompression Sickness & Hypoxia Guard

## Pathophysiology

Extravehicular activity in hypobaric space suits (29.6 kPa / 4.3 psia 100% O2) creates decompression stress, risking bubble formation in tissues and venous gas emboli (decompression sickness / bends). Micro-meteoroid impacts or seal failures can cause suit depressurization (<25.0 kPa), while metabolic exertion can lead to acute hypoxemia (SpO2 < 88%) and exhaled CO2 accumulation in helmet dead space (>4.0 mmHg). Gravity transitions induce neuro-vestibular ataxia and spatial disorientation.

## Thresholds & Actions

- **Critical:** Suit pressure $< 25.0$ kPa, SpO2 $< 88.0\%$, helmet CO2 $\ge 7.0$ mmHg, or bends/embolism symptoms.
  - *Severity:* `critical` (`TIER_3_GROUND_SURGEON`)
  - *Protocols:* Emergency EVA Abort & Airlock Ingress Protocol, Suit/Airlock Immediate Repressurization (101.3 kPa / 14.7 psia), Bends Hyperbaric Decompression Treatment Protocol (100% O2 Wash), High-Priority Telemedicine Ground Evacuation Notice.
- **Caution:** SpO2 $< 95.0\%$, suit pressure $< 29.6$ kPa, helmet CO2 $> 4.0$ mmHg, HR $> 120$ bpm or $< 50$ bpm, or vestibular ataxia/dizziness.
  - *Severity:* `caution` (`TIER_2_CMO_REVIEW`)
  - *Protocols:* Prebreathe Protocol Extension (100% O2 In-Suit Exercise Prebreathe), LiOH / Amine CO2 Scrubber Replacement & Purge Protocol, Graybiel Motion Sickness & Sensorimotor Ataxia Balance Protocol, EVA Workload Throttle & Fluid Tether Rehydration.
- **Nominal:** SpO2 $\ge 95.0\%$, suit pressure nominal, CO2 $\le 4.0$ mmHg, normal HR, no bends or ataxia symptoms.
  - *Protocols:* Nominal EVA Metabolic Telemetry Protocol, Standard Prebreathe Schedule Verification.
