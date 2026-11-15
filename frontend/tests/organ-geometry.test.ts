import { describe, expect, it } from "vitest";

import { organGeometry, ribcageGeometry } from "@/components/three/organ-geometry";
import { ORGANS } from "@/data/organs";

function assertSane(name: string, g: ReturnType<typeof organGeometry>, maxRadius: number) {
  for (const attr of ["position", "normal", "color"]) {
    expect(g.getAttribute(attr), `${name}.${attr}`).toBeDefined();
  }
  const pos = g.getAttribute("position").array;
  const nrm = g.getAttribute("normal").array;
  for (let i = 0; i < pos.length; i++) {
    if (!Number.isFinite(pos[i]) || !Number.isFinite(nrm[i])) {
      throw new Error(`${name}: non-finite vertex data at ${i}`);
    }
  }
  expect(g.index, `${name} indexed`).not.toBeNull();
  expect(g.boundingSphere!.radius, `${name} radius`).toBeGreaterThan(0.004);
  expect(g.boundingSphere!.radius, `${name} radius`).toBeLessThan(maxRadius);
}

describe("procedural organ geometry", () => {
  it.each(ORGANS.map((o) => [o.id, o] as const))("%s builds one sane merged mesh", (_id, organ) => {
    const g = organGeometry(organ.shape, organ.side ?? 1);
    assertSane(organ.id, g, 0.3);
  });

  it("caches per shape + side", () => {
    expect(organGeometry("kidney", 1)).toBe(organGeometry("kidney", 1));
    expect(organGeometry("kidney", 1)).not.toBe(organGeometry("kidney", -1));
  });

  it("builds the ribcage context layer", () => {
    const g = ribcageGeometry();
    g.computeBoundingSphere();
    assertSane("ribcage", g, 1.6);
  });

  it("keeps organ ids unique", () => {
    expect(new Set(ORGANS.map((o) => o.id)).size).toBe(ORGANS.length);
  });
});

describe("zone framing", () => {
  it("fits every zone with organs inside a sane distance band", async () => {
    const { zoneFraming } = await import("@/data/organs");
    for (const z of ["head", "chest", "spine", "limbs", "gut", "skin"]) {
      const f = zoneFraming(z)!;
      expect(f, z).not.toBeNull();
      expect(f.distance).toBeGreaterThanOrEqual(0.5);
      expect(f.distance).toBeLessThanOrEqual(2.8);
    }
    expect(zoneFraming("head")!.distance).toBeLessThan(zoneFraming("limbs")!.distance);
    expect(zoneFraming(null)).toBeNull();
  });
});

describe("procedural EVA suit", () => {
  it("builds every suit piece for both sides", async () => {
    const { suitGeometry } = await import("@/components/three/suit-geometry");
    const pieces = [
      "helmet", "visor", "helmetLamps", "helmetLenses", "commCap", "neckRing", "hut", "dcm",
      "dcmScreen", "lowerTorso", "waistRing", "dorsalRail", "plss", "plssDetails", "hoses",
      "arm", "armBearings", "glove", "armPatch", "leg", "boot", "sole",
    ] as const;
    for (const piece of pieces) {
      for (const side of [1, -1] as const) {
        const g = suitGeometry(piece, side);
        expect(g.getAttribute("position").count, piece).toBeGreaterThan(8);
        expect(g.getAttribute("normal"), piece).toBeDefined();
        const pos = g.getAttribute("position").array;
        for (let i = 0; i < pos.length; i++) {
          if (!Number.isFinite(pos[i])) throw new Error(`${piece}: non-finite vertex`);
        }
        expect(g.boundingSphere!.radius, piece).toBeLessThan(0.6);
      }
    }
  });

  it("keeps the arms attached to the torso", async () => {
    const { armPoint, SHOULDER } = await import("@/data/suit-rig");
    // shoulder bearing sits inside the torso's half-width (~0.21 at the top)
    expect(SHOULDER[0]).toBeLessThan(0.21);
    const elbow = armPoint(1, -0.3);
    expect(elbow[0]).toBeGreaterThan(SHOULDER[0]);
    expect(elbow[0] - 0.06).toBeLessThan(0.23);
  });
});

describe("organ status", () => {
  it("flags only the organs whose watched vitals are off-nominal", async () => {
    const { CREW } = await import("@/data/crew");
    const { getOrgan, organStatus, organVitals } = await import("@/data/organs");
    const novak = CREW.find((c) => c.id === "AST-04")!;
    const chest = novak.zones.find((z) => z.id === "chest")!;
    expect(chest.status).not.toBe("NOMINAL");
    expect(organStatus(getOrgan("heart")!, chest)).not.toBe("NOMINAL");
    expect(organStatus(getOrgan("lung_r")!, chest)).not.toBe("NOMINAL");
    expect(organStatus(getOrgan("trachea")!, chest)).toBe("NOMINAL");
    // live zone reading replaces the curated organ value
    const hr = organVitals(getOrgan("heart")!, chest).find((v) => v.key === "heart_rate_bpm")!;
    expect(hr.value).toBe(chest.vitals.find((v) => v.key === "heart_rate_bpm")!.value);
    const voss = CREW.find((c) => c.id === "AST-01")!;
    const vossChest = voss.zones.find((z) => z.id === "chest")!;
    expect(organStatus(getOrgan("heart")!, vossChest)).toBe("NOMINAL");
  });
});

describe("skin layer", () => {
  it("builds every skin segment between suit and organs", async () => {
    const { skinGeometry, SKIN_SEGMENTS } = await import("@/components/three/skin-geometry");
    for (const seg of SKIN_SEGMENTS) {
      const g = skinGeometry(seg);
      const pos = g.getAttribute("position").array;
      for (let i = 0; i < pos.length; i++) {
        if (!Number.isFinite(pos[i])) throw new Error(`${seg}: non-finite vertex`);
      }
      expect(g.getAttribute("color"), seg).toBeDefined();
      expect(g.boundingSphere!.radius, seg).toBeLessThan(0.6);
    }
  });
});
