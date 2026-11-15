/**
 * Contract tests for the provider layer — deterministic mock must satisfy
 * the same HealthDataProvider surface the REST provider implements.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { MockHealthDataProvider } from "@/services/mock-provider";
import { RestHealthDataProvider } from "@/services/rest-provider";
import { useUserStore } from "@/stores/user-store";
import type { LocalUser, TelemetryMetric, VitalSigns } from "@/types/health";

const provider = new MockHealthDataProvider();

// The roster is built from enrolled operators — seed two before assertions.
const TEST_OPERATORS: LocalUser[] = [
  {
    id: "u_alpha",
    name: "Cmdr. Test Alpha",
    callsign: "ALPHA",
    role: "medic",
    facePhoto: "",
    astronautId: "AST-01",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "u_beta",
    name: "Spec. Test Beta",
    callsign: "BETA",
    role: "user",
    facePhoto: "",
    astronautId: "AST-02",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

beforeAll(() => {
  useUserStore.setState({ users: TEST_OPERATORS, activeUserId: "u_alpha" });
});

describe("MockHealthDataProvider", () => {
  it("returns a roster built from enrolled operators", async () => {
    const crew = await provider.getCrew();
    expect(crew.length).toBe(TEST_OPERATORS.length);
    for (const member of crew) {
      expect(member.id).toMatch(/^AST-/);
      expect(member.zones.length).toBeGreaterThan(0);
      expect(member.readiness.score).toBeGreaterThanOrEqual(0);
      expect(member.readiness.score).toBeLessThanOrEqual(100);
    }
    expect(crew.map((m) => m.id).sort()).toEqual(["AST-01", "AST-02"]);
  });

  it("resolves a single crew member with zones + vitals", async () => {
    const member = await provider.getCrewMember("AST-01");
    expect(member).toBeDefined();
    const zone = member!.zones[0];
    expect(zone.id).toBeTruthy();
    expect(zone.position).toHaveLength(3);
    expect(Array.isArray(zone.vitals)).toBe(true);
  });

  it("returns undefined for unknown crew ids", async () => {
    expect(await provider.getCrewMember("AST-99")).toBeUndefined();
  });

  it("serves telemetry series with events + forecast + band", async () => {
    const series = await provider.getTelemetrySeries("AST-01", "heart_rate");
    expect(series.points.length).toBeGreaterThan(10);
    expect(series.forecast.length).toBeGreaterThan(0);
    expect(series.events.length).toBeGreaterThan(0);
    if (series.band) expect(series.band.high).toBeGreaterThan(series.band.low);
  });

  it("echoes a triage assessment on telemetry submit", async () => {
    const vitals: VitalSigns = {
      astronaut_id: "AST-01",
      timestamp: new Date().toISOString(),
      heart_rate_bpm: 150,
      spo2_percent: 89,
      core_temp_c: 39.2,
      symptoms: ["dizziness"],
    };
    const res = await provider.submitTelemetry("AST-01", vitals);
    expect(res.astronaut_id).toBe("AST-01");
    expect(["NOMINAL", "CAUTION", "URGENT", "CRITICAL"]).toContain(
      res.triage_level,
    );
    expect(res.evaluated_at).toBeTruthy();
  });

  it("acknowledges behavioral logs", async () => {
    const ack = await provider.submitLog("AST-01", {
      kind: "sleep",
      value: "7.2h restful",
    });
    expect(ack.kind).toBe("sleep");
    expect(ack.receivedAt).toBeTruthy();
  });

  it("assistant returns the response contract with zone references", async () => {
    const res = await provider.ask("AST-01", {
      prompt: "critical zones",
      locationId: "station",
    });
    expect(typeof res.message).toBe("string");
    expect(Array.isArray(res.referencedZoneIds)).toBe(true);
    expect(Array.isArray(res.actions)).toBe(true);
    expect(Array.isArray(res.assumptions)).toBe(true);
    for (const a of res.actions) {
      expect(a.type).toBe("focus");
      expect(typeof a.zoneId).toBe("string");
    }
  });

  it("assistant answers are deterministic per prompt", async () => {
    const a = await provider.ask("AST-01", {
      prompt: "explain my status",
      locationId: "station",
    });
    const b = await provider.ask("AST-01", {
      prompt: "explain my status",
      locationId: "station",
    });
    expect(a.message).toBe(b.message);
  });

  it("gamification returns checklist + streak + skin catalog", async () => {
    const g = await provider.getGamification("AST-01");
    expect(g.checklist.length).toBeGreaterThan(0);
    expect(g.streakDays).toBeGreaterThanOrEqual(0);
    const skin = await provider.pullGachapon("AST-01");
    expect(skin.id).toBeTruthy();
    expect(skin.name).toBeTruthy();
  });

  it("exposes location profiles with hazard + comm context", async () => {
    const locations = await provider.getLocations();
    expect(locations.length).toBe(3);
    for (const loc of locations) {
      const profile = await provider.getLocationProfile(loc.id);
      expect(profile.commLatencySec).toBeGreaterThanOrEqual(0);
      expect(profile.hazards.radiation).toBeGreaterThanOrEqual(0);
      expect(["local", "advisory"]).toContain(profile.linkMode);
    }
  });

  it("supports active location updates & ECLSS overrides", async () => {
    const updated = await provider.updateLocationProfile("mars", {
      co2_mmhg: 4.1,
      offline_fallback_active: true,
    });
    expect(updated.id).toBe("mars");
    expect(updated.eclss?.co2_mmhg).toBe(4.1);
    expect(updated.offlineFallbackActive).toBe(true);
    const active = await provider.getActiveLocation();
    expect(active.id).toBe("mars");
  });

  it("serves all 8 backend trend metrics with 95% CI bounds", async () => {
    const metrics: TelemetryMetric[] = [
      "heart_rate",
      "spo2",
      "core_temp",
      "radiation",
      "blood_sugar",
      "bone_density",
      "visual_acuity",
      "mission_readiness",
    ];
    for (const metric of metrics) {
      const s = await provider.getTelemetrySeries("AST-01", metric);
      expect(s.points.length).toBeGreaterThan(0);
      expect(s.forecast.length).toBeGreaterThan(0);
      expect(s.forecast[0].lowerCi).toBeDefined();
      expect(s.forecast[0].upperCi).toBeDefined();
    }
  });

  it("ingests multi-modal telemetry and enqueues off-nominal packets", async () => {
    const res = await provider.ingestTelemetry({
      astronaut_id: "AST-01",
      heart_rate_bpm: 145,
      spo2_percent: 84,
      suit_pressure_kpa: 22,
      target_anatomical_zone: "cardiovascular_chest",
    });
    expect(res.status).toBe("critical");
    expect(res.anomaly_flags.length).toBeGreaterThan(0);

    const queue = await provider.getTelemedicineQueue();
    expect(queue.pending_count).toBeGreaterThan(0);
    const flushed = await provider.flushTelemedicineQueue({ force_flush: true });
    expect(flushed.flushed_count).toBeGreaterThan(0);
  });

  it("searches RAG knowledge base & synthesizes speech + visemes", async () => {
    const rag = await provider.searchKnowledge("SANS optic disc edema", {
      topK: 2,
    });
    expect(rag.results.length).toBeGreaterThan(0);

    const tts = await provider.synthesizeSpeech({
      text: "Caution: elevated cabin carbon dioxide.",
      severity: "caution",
      force_offline: true,
    });
    expect(tts.audio_base64.length).toBeGreaterThan(10);
    expect(tts.viseme_cues.length).toBeGreaterThan(0);
    expect(tts.offline_mode).toBe(true);
  });

  it("completes checkups, equips skins, and restores DB snapshot", async () => {
    const res = await provider.completeCheckup({
      astronaut_id: "AST-01",
      completed_tasks: ["task_morning_vitals", "task_ared_exercise"],
      perform_gachapon_roll: true,
      deterministic_seed: 3,
    });
    expect(res.roll_performed).toBe(true);
    expect(res.roll_result?.rolled_skin.skin_id).toBeTruthy();

    const restored = await provider.restoreDatabaseSnapshot();
    expect(restored.restored).toBe(true);
    expect(restored.default_astronaut_id).toBe("AST-01");
  });
});

describe("RestHealthDataProvider configuration", () => {
  it("marks full backend wiring with partial = false", () => {
    const rest = new RestHealthDataProvider();
    expect(rest.kind).toBe("rest");
    expect(rest.partial).toBe(false);
  });
});
