# Radiation Dosimetry & Immune Dysregulation Evaluator

## Pathophysiology

Galactic Cosmic Radiation (GCR) and Solar Particle Events (SPE) produce persistent DNA double-strand breaks and oxidative stress in deep space. When combined with circadian disruption (sleep deficit) and high stress, cell-mediated immunity is suppressed. This triggers reactivation of latent herpesviruses (EBV, VZV / herpes zoster / shingles), manifesting as painful dermatomal rashes, skin barrier breakdown, and gut microbiome dysbiosis.

## Thresholds & Actions

- **Critical:** Cumulative dose $\ge 250.0$ mSv (acute radiation sickness / SPE storm) or active shingles/herpes zoster dermatomal lesions.
  - *Severity:* `critical` (`TIER_3_GROUND_SURGEON`)
  - *Protocols:* Emergency SPE Storm Shelter Protocol, Oral Antiviral Protocol (Valacyclovir 1000mg TID), Dosimeter Badge Lockdown & Biodosimetry Blood Draw, Ground Flight Surgeon Critical Telemedicine Alert.
- **Caution:** Radiation dose $> 50.0$ mSv, or combined sleep $< 5.5$h + stress $\ge 6.0$, or diagnostic image uploaded with rash symptoms.
  - *Severity:* `caution` (`TIER_2_CMO_REVIEW`)
  - *Protocols:* Topical Ceramide & Hydrocortisone 1% Barrier Repair Protocol, Prebiotic Soluble Fiber & Multi-Strain Probiotic Protocol, Saliva PCR Viral Shedding Assay (EBV/VZV), Circadian Blue-Depleted Lighting & 8.5h Sleep Recovery Opportunity.
- **Nominal:** Radiation $< 50.0$ mSv, sleep $\ge 6.0$h, stress $< 6.0$, no skin/gut symptoms.
  - *Protocols:* Artemis Radiation Dosimetry Standard Measures, Epidermal Moisturizing Protocol, Nominal Spaceflight Prebiotic Nutrition.
