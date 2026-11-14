/**
 * Contract tests for the provider layer — deterministic mock must satisfy
 * the same HealthDataProvider surface the REST provider implements.
 */

import { describe, expect, it } from "vitest";

import { MockHealthDataProvider } from "@/services/mock-provider";
import type { VitalSigns } from "@/types/health";

const provider = new MockHealthDataProvider();

describe("MockHealthDataProvider", () => {
  it("returns the curated crew roster", async () => {
    const crew = await provider.getCrew();
    expect(crew.length).toBeGreaterThanOrEqual(2);
    for (const member of crew) {
      expect(member.id).toMatch(/^AST-/);
      expect(member.zones.length).toBeGreaterThan(0);
      expect(member.readiness.score).toBeGreaterThanOrEqual(0);
      expect(member.readiness.score).toBeLessThanOrEqual(100);
    }
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
    expect(locations.length).toBeGreaterThanOrEqual(4);
    for (const loc of locations) {
      const profile = await provider.getLocationProfile(loc.id);
      expect(profile.commLatencySec).toBeGreaterThanOrEqual(0);
      expect(profile.hazards.radiation).toBeGreaterThanOrEqual(0);
      expect(["local", "advisory"]).toContain(profile.linkMode);
    }
  });
});
