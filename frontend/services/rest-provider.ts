/**
 * RestHealthDataProvider — full phase 1–4 HTTP integration with FastAPI.
 *
 * Connects all FastAPI Phase 1–4 endpoints (health, operational context & 5-hazards,
 * baseline triage, multi-modal telemetry ingest, 6-zone anatomical body status, trends
 * with 95% CI, RAG knowledge base search, clinical AI chat, voice TTS + visemes,
 * gamification & gachapon, Tempus Pro telemedicine queue/flush, and baseline reset).
 *
 * Preserves local crew/organ geometric metadata (`partIds`, `position`, watch keys)
 * so the 3D holographic scene and organ animations reflect live backend telemetry.
 */

import { crewMemberFromOperator } from "@/data/crew";
import { getSkinPalette } from "@/data/gamification";
import { LOCATION_PROFILES, getLocationProfile as getBaseLocation } from "@/data/mission";
import {
  evaluateTriage,
  flushTelemedicineQueue as apiFlushTelemedicineQueue,
  getAstronautBodyStatus,
  getContextLocation,
  getGamificationStatus,
  getHealth,
  getTelemedicineSyncQueue,
  getTrendAnalysis,
  ingestTelemetry as apiIngestTelemetry,
  restoreDatabaseSnapshot as apiRestoreDatabaseSnapshot,
  searchKnowledge as apiSearchKnowledge,
  sendAIChat,
  synthesizeTTS as apiSynthesizeTTS,
  updateContextLocation,
  completeCheckup as apiCompleteCheckup,
} from "@/lib/api";
import { userStore } from "@/stores/user-store";
import type {
  AIChatResponse,
  AIInsight,
  AnatomicalZoneStatusBackend,
  AssistantAction,
  AssistantResponse,
  AstronautBodyStatusResponse,
  BackendTrendIndicator,
  BehaviorLog,
  BodyZone,
  CheckupCompleteRequest,
  CheckupCompleteResponse,
  CrewMember,
  DatabaseSnapshotRestoreResponse,
  GamificationState,
  GamificationStatusResponse,
  HealthResponse,
  KnowledgeDocument,
  KnowledgeSearchResponse,
  LocationContextResponse,
  LocationContextUpdate,
  LocationId,
  LocationProfile,
  LocationSettingBackend,
  LogAck,
  MissionEvent,
  RiskFactor,
  SkinDef,
  TelemedicineFlushRequest,
  TelemedicineFlushResponse,
  TelemedicineSyncQueueResponse,
  TelemetryIngestRequest,
  TelemetryIngestResponse,
  TelemetryMetric,
  TelemetrySeries,
  TriageAssessment,
  TriageLevel,
  TTSRequest,
  TTSResponse,
  VitalReading,
  VitalSigns,
  ZoneId,
} from "@/types/health";
import type { AssistantRequest, HealthDataProvider } from "./health-provider";
import { MockHealthDataProvider } from "./mock-provider";

const BACKEND_LOCATION_MAP: Record<LocationId, LocationSettingBackend> = {
  station: "Space Station [0g]",
  spacecraft: "Spacecraft [0g Transit]",
  mars: "Mars [3/8g]",
};

const FRONTEND_LOCATION_MAP: Record<string, LocationId> = {
  "Space Station [0g]": "station",
  "Spacecraft [0g Transit]": "spacecraft",
  "Moon [1/6g]": "mars",
  "Mars [3/8g]": "mars",
  "Rover / EVA": "mars",
};

const FRONT_TO_BACKEND_ZONE: Record<ZoneId, string> = {
  head: "head_eyes",
  chest: "cardiovascular_chest",
  spine: "spine_skeletal",
  limbs: "musculoskeletal_limbs",
  gut: "gut_microbiome",
  skin: "skin",
};

const METRIC_TO_BACKEND_INDICATOR: Partial<
  Record<TelemetryMetric, BackendTrendIndicator>
> = {
  heart_rate: "heart_rate_bpm",
  spo2: "spo2_percent",
  core_temp: "core_temp_c",
  radiation: "radiation_dose_msv",
  blood_sugar: "blood_sugar_mg_dl",
  bone_density: "bone_mineral_density_t_score",
  visual_acuity: "visual_acuity_logmar",
  mission_readiness: "mission_readiness_score",
  sleep: "sleep_hours",
  systolic_bp: "systolic_bp_mmhg",
  suit_pressure: "suit_pressure_kpa",
  cabin_co2: "co2_partial_pressure_mmhg",
};

const TREND_META: Record<
  BackendTrendIndicator,
  { label: string; band: { low: number; high: number; label: string } }
> = {
  heart_rate_bpm: {
    label: "Heart rate",
    band: { low: 50, high: 120, label: "CLINICAL REFERENCE BAND" },
  },
  spo2_percent: {
    label: "SpO2 saturation",
    band: { low: 94, high: 100, label: "CLINICAL REFERENCE BAND" },
  },
  core_temp_c: {
    label: "Core temperature",
    band: { low: 35.8, high: 38.0, label: "CLINICAL REFERENCE BAND" },
  },
  radiation_dose_msv: {
    label: "Radiation cumulative dose",
    band: { low: 0, high: 20, label: "NASA ALARA REFERENCE" },
  },
  blood_sugar_mg_dl: {
    label: "Blood glucose",
    band: { low: 70, high: 120, label: "METABOLIC REFERENCE BAND" },
  },
  bone_mineral_density_t_score: {
    label: "Bone mineral density T-score",
    band: { low: -1.0, high: 1.5, label: "OSTEOPENIA THRESHOLD" },
  },
  visual_acuity_logmar: {
    label: "Visual acuity (logMAR)",
    band: { low: -0.1, high: 0.2, label: "SANS SCREENING BAND" },
  },
  mission_readiness_score: {
    label: "Mission readiness score",
    band: { low: 75, high: 100, label: "FLIGHT READINESS TARGET" },
  },
  sleep_hours: {
    label: "Sleep duration",
    band: { low: 6, high: 10, label: "CREW RECOVERY BAND" },
  },
  systolic_bp_mmhg: {
    label: "Systolic blood pressure",
    band: { low: 90, high: 140, label: "CLINICAL REFERENCE BAND" },
  },
  suit_pressure_kpa: {
    label: "Suit pressure",
    band: { low: 26, high: 34, label: "EVA OPERATIONAL ENVELOPE" },
  },
  co2_partial_pressure_mmhg: {
    label: "Cabin CO2 partial pressure",
    band: { low: 0, high: 4, label: "SMAC OPERATIONAL LIMIT" },
  },
};

const VITAL_DISPLAY_META: Record<string, { label: string; unit: string }> = {
  heart_rate_bpm: { label: "Heart rate", unit: "bpm" },
  spo2_percent: { label: "SpO2", unit: "%" },
  core_temp_c: { label: "Core temp", unit: "°C" },
  systolic_bp_mmhg: { label: "Systolic BP", unit: "mmHg" },
  suit_pressure_kpa: { label: "Suit pressure", unit: "kPa" },
  co2_partial_pressure_mmhg: { label: "Cabin CO2", unit: "mmHg" },
  visual_acuity_logmar: { label: "Visual acuity", unit: "logMAR" },
  radiation_dose_msv: { label: "Radiation dose", unit: "mSv" },
  radiation_msv_hr: { label: "Dose rate", unit: "mSv/h" },
  blood_sugar_mg_dl: { label: "Blood glucose", unit: "mg/dL" },
  glucose: { label: "Blood glucose", unit: "mg/dL" },
  bone_mineral_density_t_score: { label: "BMD T-score", unit: "T" },
  sleep_hours: { label: "Sleep duration", unit: "hr" },
  mood_score: { label: "Mood index", unit: "/10" },
  stress_level: { label: "Stress level", unit: "/10" },
};

function toTriageLevel(status?: string): TriageLevel {
  const norm = status?.toLowerCase();
  if (norm === "critical" || norm === "urgent") return "CRITICAL";
  if (norm === "caution") return "CAUTION";
  return "NOMINAL";
}

function mapLocationIdToBackend(id: LocationId): LocationSettingBackend {
  return BACKEND_LOCATION_MAP[id] ?? "Space Station [0g]";
}

function mapBackendLocationToId(setting: string): LocationId {
  return FRONTEND_LOCATION_MAP[setting] ?? "station";
}

function mapLocationResponse(res: LocationContextResponse): LocationProfile {
  const id = mapBackendLocationToId(res.location_setting);
  const preset = getBaseLocation(id);
  const blackoutRisk =
    res.earth_comm_latency_sec >= 240
      ? "DEEP-SPACE DELAY"
      : res.earth_comm_latency_sec >= 1.5
        ? "MODERATE"
        : res.offline_fallback_active
          ? "BLACKOUT ACTIVE"
          : "LOW";

  return {
    ...preset,
    id,
    label: res.location_setting,
    locationSetting: res.location_setting,
    gravityG: res.gravity_g,
    commLatencySec: res.earth_comm_latency_sec,
    blackoutRisk,
    linkMode: res.offline_fallback_active ? "local" : "advisory",
    offlineFallbackActive: res.offline_fallback_active,
    hazards: {
      radiation: res.hazard_multipliers.space_radiation,
      isolation: res.hazard_multipliers.isolation_and_confinement,
      gravity: res.hazard_multipliers.gravity_fields,
      workload: res.hazard_multipliers.hostile_closed_environments,
      distance: res.hazard_multipliers.distance_from_earth,
      composite: res.hazard_multipliers.composite_multiplier,
    },
    hazardMultipliers: res.hazard_multipliers,
    eclss: {
      temperature_c: res.temperature_c,
      pressure_kpa: res.pressure_kpa,
      lighting_lux: res.lighting_lux,
      noise_dba: res.noise_dba,
      microbial_cfu_m3: res.microbial_cfu_m3,
      co2_mmhg: res.co2_mmhg,
    },
    status: res.status,
    highLevel: res.high_level,
    technical: res.technical,
    updatedAt: res.updated_at,
  };
}

function mergeZoneVitals(
  baseZone: BodyZone,
  backendZone: AnatomicalZoneStatusBackend,
  timestamp: string,
): VitalReading[] {
  const zoneLevel = toTriageLevel(backendZone.status);
  const byKey = new Map<string, VitalReading>();

  // Preserve baseline structural/organ watch vitals first so 3D animations keep all expected keys.
  for (const v of baseZone.vitals) {
    byKey.set(v.key, { ...v });
  }

  const upsert = (
    key: string,
    val: number,
    status: TriageLevel = zoneLevel,
    label?: string,
    unit?: string,
  ) => {
    const existing = byKey.get(key);
    const meta = VITAL_DISPLAY_META[key];
    byKey.set(key, {
      key,
      label: label ?? existing?.label ?? meta?.label ?? key.replace(/_/g, " "),
      value: Math.round(val * 1000) / 1000,
      unit: unit ?? existing?.unit ?? meta?.unit ?? "",
      status,
      updatedAt: timestamp,
    });
  };

  for (const [k, raw] of Object.entries(backendZone.linked_vitals ?? {})) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      upsert(k, raw, zoneLevel);
      if (k === "blood_sugar_mg_dl") {
        upsert("glucose", raw, zoneLevel, "Blood glucose", "mg/dL");
      }
      if (k === "radiation_dose_msv") {
        upsert("radiation_msv_hr", Math.round((raw / 24) * 1000) / 1000, zoneLevel, "Dose rate", "mSv/h");
      }
      if (k === "bone_mineral_density_t_score") {
        const bone = byKey.get("bone_marker");
        if (bone) {
          byKey.set("bone_marker", { ...bone, status: zoneLevel, updatedAt: timestamp });
        }
      }
    } else if (k === "blood_pressure_mmhg" && typeof raw === "string") {
      const sys = Number.parseFloat(raw.split("/")[0] ?? "");
      if (Number.isFinite(sys)) {
        upsert("systolic_bp_mmhg", sys, zoneLevel, "Systolic BP", "mmHg");
      }
    }
  }

  return Array.from(byKey.values());
}

function mapBodyStatusToCrewMember(
  base: CrewMember,
  res: AstronautBodyStatusResponse,
): CrewMember {
  const mergedZones: BodyZone[] = base.zones.map((baseZone) => {
    const bKey = FRONT_TO_BACKEND_ZONE[baseZone.id];
    const bz = res.zones?.[bKey];
    if (!bz) return baseZone;
    return {
      ...baseZone,
      name: bz.label || baseZone.name,
      status: toTriageLevel(bz.status),
      uiToken: bz.ui_token,
      highLevel: bz.high_level,
      technical: bz.technical,
      description: bz.high_level || baseZone.description,
      selfExamSteps: bz.self_exam_steps,
      recommendedCountermeasures: bz.recommended_countermeasures,
      activeRisks: bz.active_risks,
      vitals: mergeZoneVitals(baseZone, bz, res.timestamp),
    };
  });

  const liveRisks: RiskFactor[] = [];
  for (const z of mergedZones) {
    for (const risk of z.activeRisks ?? []) {
      liveRisks.push({
        name: risk,
        cause: `${z.name} (${z.status})`,
        mitigation:
          z.recommendedCountermeasures?.[0] ?? "Follow autonomous countermeasure protocol.",
        zoneId: z.id,
      });
    }
  }

  const label =
    res.overall_status === "critical"
      ? "CRITICAL"
      : res.overall_status === "caution"
        ? "CAUTION"
        : "FLIGHT READY";

  return {
    ...base,
    id: res.astronaut_id,
    zones: mergedZones,
    risks: liveRisks.length > 0 ? liveRisks : base.risks,
    readiness: {
      score: Math.round(res.mission_readiness_score),
      label,
    },
    locationSetting: res.location_setting,
    overallStatus: res.overall_status,
    overallUiToken: res.overall_ui_token,
    highLevel: res.high_level,
    technical: res.technical,
  };
}

function inferMissionEventKind(
  ev: { event_name: string; impact: string },
): MissionEvent["kind"] {
  const text = `${ev.event_name} ${ev.impact}`.toLowerCase();
  if (text.includes("eva") || text.includes("suit") || text.includes("depressur"))
    return "eva";
  if (text.includes("rad") || text.includes("spe") || text.includes("flare") || text.includes("solar"))
    return "radiation";
  if (text.includes("ared") || text.includes("exercise") || text.includes("resist"))
    return "exercise";
  if (text.includes("sleep") || text.includes("circadian")) return "sleep";
  return "gravity";
}

function inferZonesFromText(
  text: string,
  docs: KnowledgeDocument[],
  contextZoneId?: ZoneId | null,
): ZoneId[] {
  const combined = `${text} ${docs.map((d) => `${d.category} ${d.title}`).join(" ")}`.toLowerCase();
  const zones: ZoneId[] = [];
  if (contextZoneId) zones.push(contextZoneId);

  const checks: Array<[ZoneId, string[]]> = [
    ["head", ["head", "eye", "optic", "sans", "visual", "logmar", "co2", "neuro", "vestibular", "edema"]],
    ["chest", ["chest", "heart", "cardio", "hypox", "spo2", "oxygen", "suit", "bends", "decompression", "bp"]],
    ["spine", ["spine", "bone", "skeletal", "osteopen", "bmd", "lumbar", "vertebral"]],
    ["limbs", ["limb", "muscle", "ared", "sleep", "fatigue", "orthostatic"]],
    ["gut", ["gut", "microbiome", "glucose", "insulin", "sugar", "nutrition", "metabolic"]],
    ["skin", ["skin", "rash", "dermat", "radiation", "dosimetr", "msv"]],
  ];

  for (const [zoneId, keywords] of checks) {
    if (keywords.some((kw) => combined.includes(kw)) && !zones.includes(zoneId)) {
      zones.push(zoneId);
    }
  }
  return zones;
}

function inferInsightCategory(category: string): AIInsight["category"] {
  const lower = category.toLowerCase();
  if (lower.includes("neuro") || lower.includes("sans")) return "Neuro";
  if (lower.includes("cardio") || lower.includes("hypox") || lower.includes("eva"))
    return "Cardio";
  if (lower.includes("bone") || lower.includes("musculo")) return "Musculoskeletal";
  if (lower.includes("rad")) return "Radiation";
  if (lower.includes("eclss") || lower.includes("env")) return "Environment";
  if (lower.includes("nutr") || lower.includes("metab")) return "Nutrition";
  return "Mission";
}

function mapGamification(res: GamificationStatusResponse): GamificationState {
  const catalog: SkinDef[] = res.catalog.map((s) => ({
    id: s.skin_id,
    name: s.name,
    rarity: s.rarity.toLowerCase() as SkinDef["rarity"],
    description: s.description,
    palette: getSkinPalette(s.skin_id),
    unlocked: s.unlocked,
    equipped: s.equipped,
    probabilityPercent: s.probability_percent,
  }));

  return {
    streakDays: res.readiness_streak_days,
    totalCheckupsCompleted: res.total_checkups_completed,
    gachaponTokens: res.gachapon_tokens,
    complianceRatePercent: res.compliance_rate_percent,
    checklist: res.routine_tasks.map((t) => ({
      id: t.task_id,
      label: t.title,
      done: t.completed,
      frequency: t.frequency,
      category: t.category,
      description: t.description,
    })),
    ownedSkinIds: catalog.filter((s) => s.unlocked).map((s) => s.id),
    equippedSkinId: res.equipped_skin.skin_id,
    catalog,
    status: res.status,
    highLevel: res.high_level,
    technical: res.technical,
  };
}

export class RestHealthDataProvider implements HealthDataProvider {
  readonly kind = "rest" as const;
  readonly partial = false;

  private readonly fallback = new MockHealthDataProvider();

  checkHealth(): Promise<HealthResponse> {
    return getHealth();
  }

  async getCrew(): Promise<CrewMember[]> {
    // Only enrolled operators are mission crew — the visual-ID check-in is
    // what places them aboard, so no pre-canned roster entries exist.
    const users = userStore().users;
    const results = await Promise.all(
      users.map((u) => this.getCrewMember(u.astronautId)),
    );
    return results.filter((m): m is CrewMember => m !== undefined);
  }

  async getCrewMember(id: string): Promise<CrewMember | undefined> {
    const user = userStore().users.find((u) => u.astronautId === id);
    if (!user) return undefined;
    const base = crewMemberFromOperator(user);
    try {
      const status = await getAstronautBodyStatus(id);
      return mapBodyStatusToCrewMember(base, status);
    } catch {
      // Backend unreachable — render the operator's nominal baseline.
      return base;
    }
  }

  async getLocations(): Promise<LocationProfile[]> {
    const active = await this.getActiveLocation().catch(() => null);
    return LOCATION_PROFILES.map((loc) =>
      active && active.id === loc.id ? active : loc,
    );
  }

  async getActiveLocation(): Promise<LocationProfile> {
    const res = await getContextLocation();
    return mapLocationResponse(res);
  }

  async getLocationProfile(id: LocationId): Promise<LocationProfile> {
    const res = await getContextLocation();
    if (mapBackendLocationToId(res.location_setting) === id) {
      return mapLocationResponse(res);
    }
    return getBaseLocation(id);
  }

  async updateLocationProfile(
    id: LocationId,
    updates?: Partial<LocationContextUpdate>,
  ): Promise<LocationProfile> {
    const payload: LocationContextUpdate = {
      ...updates,
      location_setting: updates?.location_setting ?? mapLocationIdToBackend(id),
    };
    const res = await updateContextLocation(payload);
    return mapLocationResponse(res);
  }

  async getTelemetrySeries(
    crewId: string,
    metric: TelemetryMetric,
  ): Promise<TelemetrySeries> {
    const indicator = METRIC_TO_BACKEND_INDICATOR[metric];
    if (!indicator) {
      return this.fallback.getTelemetrySeries(crewId, metric);
    }
    const res = await getTrendAnalysis(indicator, crewId, {
      historyLimit: 20,
      forecastSteps: 5,
    });
    const meta = TREND_META[indicator];
    return {
      metric,
      indicator: res.indicator,
      label: meta.label,
      unit: res.unit,
      points: res.historical_points.map((p) => ({
        t: p.timestamp,
        value: p.value,
      })),
      forecast: res.forecast_points.map((f) => ({
        t: f.timestamp,
        value: f.predicted_value,
        lowerCi: f.lower_ci,
        upperCi: f.upper_ci,
      })),
      events: res.event_markers.map((e) => ({
        t: e.timestamp,
        label: e.event_name,
        kind: inferMissionEventKind(e),
        impact: e.impact,
        description: e.description,
      })),
      band: meta.band,
      thresholdWarning: res.threshold_warning,
      warningDetails: res.warning_details,
      status: res.status,
      highLevel: res.high_level,
      technical: res.technical,
    };
  }

  submitTelemetry(
    crewId: string,
    vitals: VitalSigns,
  ): Promise<TriageAssessment> {
    return evaluateTriage({ ...vitals, astronaut_id: crewId });
  }

  ingestTelemetry(
    payload: TelemetryIngestRequest,
    imageFile?: File | null,
  ): Promise<TelemetryIngestResponse> {
    return apiIngestTelemetry(payload, imageFile);
  }

  async submitLog(crewId: string, log: BehaviorLog): Promise<LogAck> {
    const num = Number.parseFloat(log.value);
    const payload: TelemetryIngestRequest = {
      astronaut_id: crewId,
      heart_rate_bpm: 72,
    };
    if (log.kind === "sleep" && Number.isFinite(num)) {
      payload.sleep_hours = num;
    } else if (log.kind === "mood" && Number.isFinite(num)) {
      payload.mood_score = num;
    } else if (log.kind === "exercise") {
      payload.heart_rate_bpm = 112;
      payload.stress_level = 3.5;
    } else if (log.kind === "hydration") {
      payload.blood_sugar_mg_dl = 95;
    }
    if (log.note) {
      payload.symptoms = [log.note];
    }
    const res = await apiIngestTelemetry(payload);
    return {
      id: String(res.id),
      receivedAt: res.timestamp,
      kind: log.kind,
    };
  }

  searchKnowledge(
    query: string,
    opts?: { category?: string; topK?: number },
  ): Promise<KnowledgeSearchResponse> {
    return apiSearchKnowledge(query, opts);
  }

  async ask(
    crewId: string,
    req: AssistantRequest,
    signal?: AbortSignal,
  ): Promise<AssistantResponse> {
    const res: AIChatResponse = await sendAIChat(
      {
        astronaut_id: crewId,
        message: req.prompt,
        view_mode: req.viewMode ?? "high_level",
        include_voice: req.includeVoice ?? false,
        force_offline: req.forceOffline ?? false,
        diagnostic_image_base64: req.diagnosticImageBase64 ?? null,
      },
      signal,
    );

    const referencedZoneIds = inferZonesFromText(
      `${req.prompt} ${res.reply}`,
      res.retrieved_knowledge,
      req.contextZoneId,
    );
    const actions: AssistantAction[] = referencedZoneIds.map((zoneId) => ({
      type: "focus",
      zoneId,
    }));

    const viewMode = req.viewMode ?? res.view_mode ?? "high_level";
    const insights: AIInsight[] = res.retrieved_knowledge.map((doc) => ({
      category: inferInsightCategory(doc.category),
      title: doc.title,
      description:
        viewMode === "technical" ? doc.content_technical : doc.content_high_level,
    }));

    const assumptions: string[] = [
      `Provider: ${res.provider_used}`,
      `Triage tier: ${res.triage_tier}`,
      `Earth link latency: ${res.earth_comm_latency_sec}s (${res.offline_mode ? "offline" : "online"})`,
    ];
    if (res.failover_reason) {
      assumptions.push(`Failover: ${res.failover_reason}`);
    }

    return {
      message: res.reply,
      highLevel: res.high_level,
      technical: res.technical,
      status: res.status,
      referencedZoneIds,
      actions,
      insights,
      assumptions,
      mode: res.offline_mode ? "local" : "advisory",
      providerUsed: res.provider_used,
      failoverReason: res.failover_reason,
      offlineMode: res.offline_mode,
      earthCommLatencySec: res.earth_comm_latency_sec,
      triageTier: res.triage_tier,
      retrievedKnowledge: res.retrieved_knowledge,
      recommendedActions: res.recommended_actions,
      voicePayload: res.voice_payload ?? null,
    };
  }

  synthesizeSpeech(req: TTSRequest, signal?: AbortSignal): Promise<TTSResponse> {
    return apiSynthesizeTTS(req, signal);
  }

  async getGamification(crewId: string): Promise<GamificationState> {
    const res = await getGamificationStatus(crewId);
    return mapGamification(res);
  }

  completeCheckup(
    req: CheckupCompleteRequest,
  ): Promise<CheckupCompleteResponse> {
    return apiCompleteCheckup(req);
  }

  async pullGachapon(crewId: string): Promise<SkinDef> {
    const current = await getGamificationStatus(crewId);
    const completed = current.routine_tasks
      .filter((t) => t.completed)
      .map((t) => t.task_id);
    const res = await apiCompleteCheckup({
      astronaut_id: crewId,
      completed_tasks: completed.length > 0 ? completed : ["task_morning_vitals"],
      perform_gachapon_roll: true,
    });
    const rolled = res.roll_result?.rolled_skin ?? res.equipped_skin;
    return {
      id: rolled.skin_id,
      name: rolled.name,
      rarity: rolled.rarity.toLowerCase() as SkinDef["rarity"],
      description: rolled.description,
      palette: getSkinPalette(rolled.skin_id),
      unlocked: rolled.unlocked,
      equipped: rolled.equipped,
      probabilityPercent: rolled.probability_percent,
    };
  }

  getTelemedicineQueue(): Promise<TelemedicineSyncQueueResponse> {
    return apiGetQueueHelper();
  }

  flushTelemedicineQueue(
    req?: TelemedicineFlushRequest,
  ): Promise<TelemedicineFlushResponse> {
    return apiFlushTelemedicineQueue(req);
  }

  restoreDatabaseSnapshot(): Promise<DatabaseSnapshotRestoreResponse> {
    return apiRestoreDatabaseSnapshot();
  }
}

function apiGetQueueHelper(): Promise<TelemedicineSyncQueueResponse> {
  return getTelemedicineSyncQueue();
}
