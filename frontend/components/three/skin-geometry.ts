/**
 * Full-body skin layer — the anatomical surface between the EVA suit and
 * the organs. Built in MODEL-LOCAL coordinates on the same rig as the suit
 * (data/suit-rig.ts), split into segments that follow their suit part when
 * the model explodes. Vertex colours are near-white luminance masks; the
 * material colour carries the skin zone's triage status (natural tone when
 * nominal, matte red when the skin is the problem).
 */

import * as THREE from "three";

import { armTransform, HIP_X, type Side } from "@/data/suit-rig";
import { at, ellipsoid, fbm, merge, smooth, superBlob, tube, type G, type Vec } from "./procedural";

export type SkinSegment = "head" | "thorax" | "abdomen" | "arm_l" | "arm_r" | "leg_l" | "leg_r";

/** Suit part whose explode offset each skin segment follows. */
export const SKIN_SEGMENT_PART: Record<SkinSegment, string> = {
  head: "head",
  thorax: "chest",
  abdomen: "abdomen",
  arm_l: "arm_l",
  arm_r: "arm_r",
  leg_l: "leg_l",
  leg_r: "leg_r",
};

export const SKIN_SEGMENTS = Object.keys(SKIN_SEGMENT_PART) as SkinSegment[];

const tone = (p: THREE.Vector3, k = 1) =>
  new THREE.Color().setScalar(0.93 + 0.05 * k * fbm(p.x * 30, p.y * 30, p.z * 30));

function head(): G {
  const skull = superBlob(
    [0.078, 0.1, 0.094],
    [1, 1, 1],
    (o) => tone(o),
    (d, o) => {
      if (d.y < -0.2) o.x *= 1 - 0.3 * smooth(-0.2, -0.95, d.y); // jaw
      if (d.z < -0.3 && d.y > -0.2) o.z *= 1.06; // occiput
      for (const s of [1, -1]) {
        const dx = o.x - s * 0.033;
        const dy = o.y + 0.005;
        const sock = Math.exp(-(dx * dx + dy * dy) / 0.00025) * smooth(0.3, 0.8, d.z);
        o.z -= 0.012 * sock; // eye sockets
      }
      return 0;
    },
    56,
  );
  return merge([
    at(skull, [0, 1.502, 0.004]),
    at(ellipsoid([0.011, 0.021, 0.015], (o) => tone(o), 18), [0, 1.48, 0.094]),
    at(ellipsoid([0.007, 0.022, 0.014], (o) => tone(o), 16), [0.079, 1.5, -0.006]),
    at(ellipsoid([0.007, 0.022, 0.014], (o) => tone(o), 16), [-0.079, 1.5, -0.006]),
    tube([[0, 1.44, -0.006], [0, 1.39, -0.004], [0, 1.33, -0.004]], (t) => 0.043 + 0.008 * t, { segments: 16, radial: 24, color: () => tone(new THREE.Vector3(), 0) }),
  ]);
}

function thorax(): G {
  return at(
    superBlob(
      [1, 1, 1],
      [0.85, 0.7, 0.85],
      (o) => tone(o),
      (d, o) => {
        const yy = d.y;
        const w = 0.172 + 0.016 * smooth(0.2, 0.7, yy) - 0.014 * smooth(-0.2, -1, yy);
        o.x *= w;
        o.y *= 0.2;
        o.z *= d.z > 0 ? 0.138 : 0.135;
        o.y -= 0.06 * Math.pow(Math.min(1, Math.abs(o.x) / w), 2) * smooth(0, 0.8, yy); // shoulder slope
        const pec = Math.exp(-(((Math.abs(o.x) - 0.075) / 0.05) ** 2 + ((o.y - 0.05) / 0.05) ** 2));
        o.z += 0.008 * pec * smooth(0.2, 0.8, d.z);
        return 0;
      },
      64,
    ),
    [0, 1.2, 0],
  );
}

function abdomen(): G {
  return at(
    superBlob(
      [1, 1, 1],
      [0.85, 0.8, 0.85],
      (o) => tone(o),
      (d, o) => {
        const yy = d.y;
        const w = 0.152 + 0.014 * smooth(0.2, -0.4, yy) - 0.05 * smooth(-0.55, -1, yy);
        o.x *= w;
        o.y *= 0.17;
        o.z *= 0.128;
        const glute = Math.exp(-(((Math.abs(o.x) - 0.06) / 0.05) ** 2 + ((o.y + 0.07) / 0.05) ** 2));
        if (d.z < 0) o.z -= 0.01 * glute;
        return 0;
      },
      56,
    ),
    [0, 0.88, 0],
  );
}

function arm(s: Side): G {
  const g = merge([
    tube(
      [[0, 0.01, 0], [0, -0.13, 0.002], [0, -0.26, 0.004], [0, -0.3, 0.008], [0, -0.42, 0.02], [0, -0.535, 0.032]],
      (t) => {
        const y = -t * 0.545;
        return 0.034 + 0.016 * smooth(-0.52, -0.2, y) + 0.004 * Math.exp(-(((y + 0.13) / 0.06) ** 2)) - 0.006 * Math.exp(-(((y + 0.29) / 0.03) ** 2)) + 0.006 * Math.exp(-(((y + 0.36) / 0.04) ** 2));
      },
      { segments: 80, radial: 20, color: (t) => tone(new THREE.Vector3(t, 0, 0), 0.4) },
    ),
    ellipsoid([0.05, 0.048, 0.048], (o) => tone(o), 28),
    hand(s),
  ]);
  const { position, rotation } = armTransform(s);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(1, 1, 1),
  );
  return g.applyMatrix4(m);
}

function hand(s: Side): G {
  const cy = -0.6;
  const cz = 0.036;
  const parts: G[] = [
    at(superBlob([0.015, 0.04, 0.032], [0.8, 0.85, 0.8], (o) => tone(o), undefined, 28), [0, cy, cz]),
  ];
  for (let f = 0; f < 4; f++) {
    const z = cz - 0.023 + f * 0.015;
    const len = [0.038, 0.046, 0.044, 0.034][f];
    parts.push(
      tube([[0, cy - 0.034, z], [-s * 0.004, cy - 0.034 - len * 0.55, z], [-s * 0.012, cy - 0.034 - len, z + 0.002]], (t) => 0.0065 - 0.001 * t, {
        segments: 12,
        radial: 10,
        color: () => tone(new THREE.Vector3(f, 0, 0), 0.3),
      }),
    );
  }
  parts.push(
    tube([[-s * 0.005, cy + 0.006, cz + 0.03], [-s * 0.016, cy - 0.022, cz + 0.045], [-s * 0.023, cy - 0.046, cz + 0.042]], (t) => 0.0072 - 0.001 * t, {
      segments: 12,
      radial: 10,
      color: () => tone(new THREE.Vector3(9, 0, 0), 0.3),
    }),
  );
  return merge(parts);
}

function leg(s: Side): G {
  const x = s * HIP_X;
  const pts: Vec[] = [[0, 0.86, 0], [0, 0.7, 0.004], [0, 0.5, 0.012], [0, 0.42, 0.012], [0, 0.3, 0], [0, 0.1, -0.004]];
  const body = tube(
    pts,
    (t) => {
      const y = 0.86 - t * 0.76;
      return 0.033 + 0.042 * smooth(0.35, 0.85, y) + 0.008 * Math.exp(-(((y - 0.31) / 0.07) ** 2)) - 0.004 * Math.exp(-(((y - 0.46) / 0.04) ** 2));
    },
    { segments: 90, radial: 22, color: (t) => tone(new THREE.Vector3(t * 3, s, 0), 0.4) },
  );
  const foot = at(
    superBlob([0.034, 0.032, 0.092], [0.85, 0.8, 0.85], (o) => tone(o), (d, o) => {
      if (d.y > 0) o.y *= 1 - 0.5 * smooth(-0.2, 0.9, d.z);
      if (d.y < 0) o.y *= 0.5;
      return 0;
    }, 36),
    [0, 0.045, 0.036],
  );
  return merge([body, foot]).translate(x, 0, 0);
}

const BUILDERS: Record<SkinSegment, () => G> = {
  head,
  thorax,
  abdomen,
  arm_l: () => arm(1),
  arm_r: () => arm(-1),
  leg_l: () => leg(1),
  leg_r: () => leg(-1),
};

const cache = new Map<SkinSegment, G>();

export function skinGeometry(segment: SkinSegment): G {
  let g = cache.get(segment);
  if (!g) {
    g = BUILDERS[segment]();
    g.computeBoundingSphere();
    cache.set(segment, g);
  }
  return g;
}
