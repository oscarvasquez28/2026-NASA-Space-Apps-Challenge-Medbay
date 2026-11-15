/**
 * Procedural EVA suit — xEMU-inspired, stylised for the lab console.
 *
 * Each builder returns ONE merged, vertex-coloured BufferGeometry in its
 * part's LOCAL frame (the frame of the `BodyPart` group that mounts it in
 * astronaut-model.tsx). Two colour conventions:
 *  - tinted shells (fabric / hard torso / PLSS): vertex colours are
 *    near-white LUMINANCE masks (seams, panels, quilting) multiplied by the
 *    material colour, so triage status tints still read;
 *  - detail parts (bearings, visor, gloves, boots, DCM): true colours.
 *
 * Rig (shoulders, hips, floor at y = 0) lives in data/suit-rig.ts so the
 * organ atlas and the suit agree on where every limb is; limb builders are
 * authored in their part frame (shoulder / hip) and mounted from the rig.
 */

import * as THREE from "three";

import {
  at,
  C,
  ellipsoid,
  merge,
  mix,
  ring,
  smooth,
  superBlob,
  tube,
  vessel,
  type G,
  type Side,
  type Vec,
} from "./procedural";

const L = (v: number) => new THREE.Color(v, v, v); // luminance mask
const seam = (dist: number, width = 0.0035) => Math.exp(-(dist * dist) / (width * width));

const METAL = C("#9aa3ad");
const METAL_DARK = C("#5d656f");
const ANODIZED = C("#4f6fae");
const RUBBER = C("#3b3e43");
const GLOVE = C("#dad7cd");

/* -------------------------------- helmet ------------------------------- */

/** Hard helmet shell (EVVA) + rim around the visor opening. Local: helmet centre. */
function helmet(): G {
  const R = 0.172;
  const shell = superBlob([R, R * 1.02, R], [1, 1, 1], (o) => {
    const ridge = seam(o.x, 0.006) * smooth(0, 0.08, -o.z + 0.05) * smooth(0.0, 0.12, o.y + 0.04);
    return L(0.97 - 0.12 * ridge - 0.06 * smooth(-0.05, -0.17, o.y));
  }, undefined, 64);
  // visor-opening rim (closed loop on the sphere)
  const rim: Vec[] = [];
  const PH = 1.22;
  const T0 = 0.5;
  const T1 = 2.05;
  const pt = (phi: number, th: number): Vec => {
    const r = R + 0.004;
    return [-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th)];
  };
  for (let k = 0; k <= 12; k++) rim.push(pt(Math.PI / 2 - PH + (2 * PH * k) / 12, T0));
  for (let k = 1; k < 8; k++) rim.push(pt(Math.PI / 2 + PH, T0 + ((T1 - T0) * k) / 8));
  for (let k = 0; k <= 12; k++) rim.push(pt(Math.PI / 2 + PH - (2 * PH * k) / 12, T1));
  for (let k = 1; k < 8; k++) rim.push(pt(Math.PI / 2 - PH, T1 - ((T1 - T0) * k) / 8));
  return merge([shell, tube(rim, () => 0.0075, { closed: true, segments: 160, radial: 10, color: () => L(0.86) })]);
}

/** Gold EV visor — spherical cap over the helmet opening. Local: helmet centre. */
function visor(): G {
  const g = new THREE.SphereGeometry(0.176, 56, 40, Math.PI / 2 - 1.2, 2.4, 0.52, 1.5);
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = mix(C("#e2bf6a"), C("#8a6424"), smooth(0.12, -0.1, p.y) * 0.8 + 0.2 * smooth(0.05, 0.15, Math.abs(p.x)));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

/** Helmet lamp housings + camera (metal) — both sides merged. */
function helmetLamps(): G {
  const parts: G[] = [];
  for (const s of [1, -1] as const) {
    parts.push(at(superBlob([0.018, 0.024, 0.04], [0.4, 0.5, 0.5], () => METAL_DARK, undefined, 24), [s * 0.168, 0.06, 0.055], [0, 0, s * 0.15]));
    parts.push(vessel([[s * 0.17, 0.06, 0.02], [s * 0.172, 0.02, -0.04], [s * 0.168, -0.03, -0.08]], 0.005, METAL, 16, 8));
  }
  parts.push(at(superBlob([0.012, 0.012, 0.022], [0.5, 0.5, 0.5], () => C("#2b2f35"), undefined, 18), [0.13, 0.11, 0.07]));
  return merge(parts);
}

/** Lamp lenses — separate mesh so they can glow. */
function helmetLenses(): G {
  return merge(
    ([1, -1] as const).map((s) =>
      at(ellipsoid([0.014, 0.017, 0.006], C("#f2f6ff"), 18), [s * 0.17, 0.06, 0.095], [0, 0, s * 0.15]),
    ),
  );
}

/** Comm carrier ("snoopy cap") over the head. Local: head centre. */
function commCap(): G {
  return superBlob([0.105, 0.108, 0.104], [1, 1, 1], (o, d) => {
    const ear = smooth(0.72, 0.9, Math.abs(d.x)) * smooth(-0.6, -0.1, d.y) * smooth(0.6, 0.1, Math.abs(d.z));
    const crown = smooth(0.2, 0.6, d.y);
    const stitch = seam(o.x, 0.004) * crown;
    return mix(mix(C("#7b6a55"), C("#e9e6df"), crown), C("#2f3238"), ear * 0.9).multiplyScalar(1 - 0.25 * stitch);
  }, (d, o) => {
    const ear = smooth(0.75, 0.95, Math.abs(d.x)) * smooth(-0.6, -0.1, d.y) * smooth(0.55, 0.1, Math.abs(d.z));
    o.x *= 1 + 0.16 * ear;
    return 0;
  }, 48);
}

/** Neck bearing ring. Local: neck centre. */
function neckRing(): G {
  return ring(
    [[0.096, -0.022], [0.121, -0.022], [0.125, -0.01], [0.125, 0.01], [0.118, 0.024], [0.096, 0.024]],
    56,
    (p) => (Math.abs(p.y - 0.0) < 0.004 ? ANODIZED : mix(METAL, METAL_DARK, smooth(-0.01, -0.022, p.y))),
  );
}

/* -------------------------------- torso -------------------------------- */

/** Hard Upper Torso — broad rounded shell, sloped shoulders, panel seams.
 * Local: (0, 1.17, 0). Spans y ≈ 0.96 → 1.38. */
function hut(): G {
  const H = 0.21;
  return superBlob(
    [1, 1, 1],
    [0.72, 0.62, 0.8],
    (o) => {
      const s1 = seam(o.y - 0.06) * smooth(0.0, 0.12, o.z); // chest yoke seam
      const s2 = seam(Math.abs(o.x) - 0.12) * smooth(0.05, 0.13, o.z) * smooth(0.12, -0.05, o.y);
      const s3 = seam(o.y + 0.17, 0.006); // lower edge band
      const q = 0.5 + 0.5 * Math.sin(o.y * 120);
      return L(0.96 - 0.22 * Math.max(s1, s2) - 0.18 * s3 - 0.025 * q * smooth(-0.05, -0.15, o.y));
    },
    (d, o) => {
      const yy = d.y;
      const w = 0.19 + 0.022 * smooth(0.1, 0.65, yy) - 0.03 * smooth(-0.2, -1, yy);
      o.x *= w;
      o.y *= H;
      o.z *= d.z > 0 ? 0.142 : 0.15;
      o.y -= 0.055 * Math.pow(Math.min(1, Math.abs(o.x) / w), 2.2) * smooth(0.0, 0.8, yy); // shoulder slope
      o.z += 0.012 * smooth(0.2, 0.9, d.z) * smooth(-0.4, 0.3, yy); // chest bulge
      return 0;
    },
    72,
  );
}

/** Display & Control Module housing + knobs + purge valve. Local: torso frame. */
function dcm(): G {
  const parts: G[] = [
    at(superBlob([0.088, 0.056, 0.028], [0.35, 0.35, 0.5], (o) => mix(C("#7f8994"), C("#4e5660"), smooth(0.01, 0.028, -o.z + 0.0)), undefined, 40), [0, 0.06, 0.172]),
    at(superBlob([0.07, 0.012, 0.01], [0.3, 0.5, 0.5], () => C("#3a4048"), undefined, 20), [0, 0.0, 0.196]),
  ];
  for (const [x, y, r] of [[-0.058, 0.088, 0.011], [-0.03, 0.088, 0.008], [0.058, 0.088, 0.011], [0.03, 0.088, 0.008], [-0.062, 0.03, 0.009], [0.062, 0.03, 0.009]] as const) {
    const k = new THREE.CylinderGeometry(r, r * 1.06, 0.014, 18, 1);
    k.deleteAttribute("uv");
    k.rotateX(Math.PI / 2);
    const g = at(k, [x, y, 0.205]);
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const c = pos.getZ(i) > 0.21 ? C("#c9cdd2") : METAL_DARK;
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  parts.push(vessel([[0.075, -0.02, 0.18], [0.09, -0.035, 0.19]], 0.007, C("#b2433c"), 8, 10));
  return merge(parts);
}

/** DCM display — separate mesh, emissive. Local: torso frame. */
function dcmScreen(): G {
  return at(superBlob([0.036, 0.018, 0.003], [0.3, 0.3, 1], (o) => {
    const lines = 0.5 + 0.5 * Math.sin(o.y * 900);
    return mix(C("#a9c4ff"), C("#6f8fd8"), lines * 0.5);
  }, undefined, 24), [0, 0.07, 0.2]);
}

/** Lower torso + brief. Local: (0, 0.92, 0). Spans y ≈ 0.72 → 1.12. */
function lowerTorso(): G {
  return superBlob(
    [1, 1, 1],
    [0.85, 0.75, 0.85],
    (o) => {
      const q = seam(((o.y + 0.3) % 0.045) - 0.0225, 0.004) * smooth(0.04, -0.06, o.y);
      const fly = seam(o.x, 0.005) * smooth(0.0, -0.14, o.y) * smooth(0.04, 0.12, o.z);
      return L(0.94 - 0.13 * q - 0.18 * fly);
    },
    (d, o) => {
      const yy = d.y;
      const w = 0.158 + 0.02 * smooth(0.2, -0.35, yy) - 0.045 * smooth(-0.55, -1, yy);
      o.x *= w;
      o.y *= 0.2;
      o.z *= d.z > 0 ? 0.138 : 0.132;
      o.z += 0.012 * smooth(-0.6, 0.0, yy) * smooth(0, 1, d.z); // belly
      return 0;
    },
    64,
  );
}

/** Waist bearing (elliptical). Local: lower-torso frame. */
function waistRing(): G {
  const g = ring(
    [[0.158, -0.016], [0.176, -0.016], [0.18, -0.006], [0.18, 0.006], [0.175, 0.016], [0.158, 0.016]],
    64,
    (p) => (Math.abs(p.y) < 0.003 ? ANODIZED : mix(METAL, METAL_DARK, smooth(0.0, -0.016, p.y))),
  );
  g.scale(1, 1, 0.86);
  return g.translate(0, 0.085, 0);
}

/** Dorsal mounting rail between torso and PLSS. Local: (0, 1.13, −0.17). */
function dorsalRail(): G {
  const parts: G[] = [vessel([[0, 0.22, -0.006], [0, 0, -0.012], [0, -0.22, -0.006]], 0.012, L(0.7), 24, 10)];
  for (let i = 0; i < 8; i++) {
    const y = 0.2 - i * 0.057;
    parts.push(at(superBlob([0.05, 0.02, 0.022], [0.5, 0.7, 0.6], (o) => L(0.95 - 0.25 * smooth(0.012, 0.022, Math.abs(o.y))), undefined, 28), [0, y, 0]));
  }
  return merge(parts);
}

/* --------------------------------- PLSS -------------------------------- */

/** Portable Life Support System shell. Local: (0, 1.18, −0.285). */
function plss(): G {
  return superBlob(
    [0.165, 0.235, 0.08],
    [0.32, 0.3, 0.45],
    (o) => {
      const h = seam(o.y - 0.085) + seam(o.y + 0.12);
      const v = seam(Math.abs(o.x) - 0.115) * smooth(0.06, 0.08, -o.z);
      const bolt = seam(Math.abs(o.x) - 0.14, 0.004) * seam(Math.abs(o.y) - 0.2, 0.004);
      return L(0.95 - 0.2 * Math.min(1, h + v) - 0.3 * bolt);
    },
    undefined,
    64,
  );
}

/** PLSS lid, SOP module, side vents, antenna. Local: PLSS frame. */
function plssDetails(): G {
  const parts: G[] = [
    at(superBlob([0.13, 0.022, 0.062], [0.35, 0.5, 0.4], (o) => mix(C("#c7cbcf"), C("#9aa0a7"), smooth(0.0, 0.02, o.y)), undefined, 32), [0, 0.236, -0.004]),
    at(superBlob([0.148, 0.042, 0.072], [0.35, 0.45, 0.45], (o) => mix(C("#c2c6cb"), C("#8e949b"), smooth(0.02, -0.04, o.y)), undefined, 36), [0, -0.268, -0.006]),
    vessel([[0.12, 0.255, -0.03], [0.122, 0.34, -0.03], [0.124, 0.42, -0.032]], (t) => 0.0045 - 0.002 * t, METAL_DARK, 12, 8),
    at(ellipsoid([0.008, 0.008, 0.008], C("#b2433c"), 12), [0.124, 0.425, -0.032]),
  ];
  for (const s of [1, -1] as const) {
    for (let k = 0; k < 5; k++) {
      parts.push(at(superBlob([0.004, 0.006, 0.05], [0.5, 0.5, 0.3], () => C("#2e3237"), undefined, 14), [s * 0.165, 0.11 - k * 0.028, -0.005]));
    }
  }
  return merge(parts);
}

/** Corrugated umbilicals: DCM sides → around the waist → PLSS. Local: PLSS frame. */
function hoses(): G {
  const rel = (p: Vec): Vec => [p[0], p[1] - 1.18, p[2] + 0.285];
  return merge(
    ([1, -1] as const).map((s) =>
      tube(
        [
          [s * 0.07, 1.205, 0.186], [s * 0.13, 1.14, 0.17], [s * 0.178, 1.04, 0.115],
          [s * 0.198, 0.995, 0.02], [s * 0.19, 1.0, -0.11], [s * 0.158, 1.03, -0.2],
        ].map((p) => rel(p as Vec)),
        (t) => 0.0105 * (1 + 0.13 * Math.pow(Math.abs(Math.sin(t * Math.PI * 60)), 0.5)),
        { segments: 200, radial: 10, color: (t) => mix(C("#4a5058"), C("#2b2f35"), 0.5 + 0.5 * Math.sin(t * Math.PI * 120)) },
      ),
    ),
  );
}

/* --------------------------------- arms -------------------------------- */

/** One profile for arm/leg fabric: seam bands + convolute (bellows) joint. */
function limbColor(t: number, a: number, joint: [number, number], seams: number[]): THREE.Color {
  const inJoint = t > joint[0] && t < joint[1];
  const ribs = inJoint ? 0.5 + 0.5 * Math.sin(((t - joint[0]) / (joint[1] - joint[0])) * Math.PI * 14) : 0;
  const band = Math.max(0, ...seams.map((s) => seam(t - s, 0.006)));
  const lat = 0.03 * Math.cos(a * 2);
  return L(0.95 - 0.18 * ribs - 0.2 * band + lat);
}

/** Arm shell: shoulder cap → upper arm → convolute elbow → forearm.
 * Local: shoulder bearing centre, hanging along −y. */
function arm(): G {
  const top = 0.0;
  const bottom = -0.54;
  const span = top - bottom;
  const ty = (y: number) => (top - y) / span;
  const joint: [number, number] = [ty(-0.26), ty(-0.335)];
  const body = tube(
    [[0, top, 0], [0, -0.13, 0.002], [0, -0.26, 0.004], [0, -0.3, 0.008], [0, -0.42, 0.02], [0, bottom, 0.032]],
    (t) => {
      const base = 0.06 - 0.008 * smooth(0, joint[0], t) - 0.008 * smooth(joint[1], 1, t);
      const rib = t > joint[0] && t < joint[1] ? 0.06 * Math.pow(Math.abs(Math.sin(((t - joint[0]) / (joint[1] - joint[0])) * Math.PI * 7)), 0.7) : 0;
      return base * (1 + rib);
    },
    { segments: 140, radial: 22, color: (t, a) => limbColor(t, a, joint, [ty(-0.06), ty(-0.2), ty(-0.47)]) },
  );
  const cap = ellipsoid([0.066, 0.06, 0.064], (o) => L(0.93 - 0.08 * smooth(0.02, 0.05, o.y)), 32);
  return merge([body, cap]);
}

/** Shoulder + wrist bearings. Local: shoulder frame. */
function armBearings(s: Side): G {
  const shoulder = ring(
    [[0.058, -0.014], [0.072, -0.014], [0.075, -0.004], [0.075, 0.004], [0.071, 0.014], [0.058, 0.014]],
    40,
    (p) => (Math.abs(p.y) < 0.003 ? ANODIZED : METAL),
  );
  shoulder.rotateZ(-s * 1.05).translate(-s * 0.012, 0.012, 0);
  const wrist = ring(
    [[0.041, -0.011], [0.051, -0.011], [0.053, 0], [0.05, 0.011], [0.041, 0.011]],
    36,
    (p) => (Math.abs(p.y) < 0.003 ? C("#b2433c") : METAL),
  );
  wrist.rotateX(-0.05).translate(0, -0.545, 0.033);
  return merge([shoulder, wrist]);
}

/** EVA glove: gauntlet cuff, palm, mitt fingers, thumb. Local: shoulder frame. */
function glove(s: Side): G {
  const cx = 0;
  const cy = -0.62;
  const cz = 0.036;
  const parts: G[] = [
    vessel([[cx, -0.548, cz], [cx, -0.58, cz + 0.002]], (t) => 0.049 - 0.006 * t, GLOVE, 10, 18),
    at(
      superBlob([0.02, 0.045, 0.038], [0.7, 0.8, 0.7], (o) => mix(GLOVE, C("#8d897d"), smooth(0.004, 0.018, -s * o.x)), undefined, 32),
      [cx, cy, cz],
    ),
  ];
  for (let f = 0; f < 4; f++) {
    const z = cz - 0.026 + f * 0.017;
    const len = [0.042, 0.05, 0.048, 0.038][f];
    parts.push(
      tube(
        [[cx, cy - 0.038, z], [cx - s * 0.004, cy - 0.038 - len * 0.55, z], [cx - s * 0.014, cy - 0.038 - len, z + 0.002]],
        (t) => 0.0085 - 0.0012 * t,
        { segments: 14, radial: 10, color: (t) => mix(GLOVE, RUBBER, smooth(0.72, 0.9, t)) },
      ),
    );
  }
  parts.push(
    tube(
      [[cx - s * 0.006, cy + 0.006, cz + 0.034], [cx - s * 0.018, cy - 0.024, cz + 0.05], [cx - s * 0.026, cy - 0.05, cz + 0.046]],
      (t) => 0.009 - 0.0015 * t,
      { segments: 14, radial: 10, color: (t) => mix(GLOVE, RUBBER, smooth(0.7, 0.9, t)) },
    ),
  );
  return merge(parts);
}

/** Mission patch (left) / stripe flag (right) on the upper arm. Local: shoulder frame. */
function armPatch(s: Side): G {
  const g = new THREE.CylinderGeometry(0.024, 0.024, 0.003, 32, 2);
  g.deleteAttribute("uv");
  const pos = g.getAttribute("position");
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const c =
      s === 1
        ? r < 0.011 ? C("#4f6fae") : r < 0.017 ? C("#d0b064") : C("#1d2840")
        : Math.abs(z) < 0.012 && x < -0.004 ? C("#2a3d6e") : Math.floor((z + 0.024) / 0.0048) % 2 ? C("#e8e6e0") : C("#b2433c");
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g.rotateZ(Math.PI / 2).rotateY(s === 1 ? 0.35 : -0.35).translate(s * 0.058, -0.1, 0.012);
}

/* --------------------------------- legs -------------------------------- */

/** Leg shell: hip → thigh → convolute knee (+ pad) → calf → ankle.
 * Local: (±HIP_X, 0, 0) with model-local y (floor at 0). */
function leg(): G {
  const top = 0.86;
  const bottom = 0.13;
  const span = top - bottom;
  const ty = (y: number) => (top - y) / span;
  const joint: [number, number] = [ty(0.505), ty(0.42)];
  const body = tube(
    [[0, top, 0], [0, 0.7, 0.004], [0, 0.505, 0.012], [0, 0.42, 0.012], [0, 0.3, 0.0], [0, bottom, -0.004]],
    (t) => {
      const y = top - t * span;
      const base = 0.081 - 0.017 * smooth(0.82, 0.52, y) - 0.008 * smooth(0.4, 0.15, y) + 0.006 * Math.exp(-(((y - 0.33) / 0.06) ** 2));
      const rib = t > joint[0] && t < joint[1] ? 0.055 * Math.pow(Math.abs(Math.sin(((t - joint[0]) / (joint[1] - joint[0])) * Math.PI * 8)), 0.7) : 0;
      return base * (1 + rib);
    },
    { segments: 160, radial: 24, color: (t, a) => limbColor(t, a, joint, [ty(0.78), ty(0.6), ty(0.22)]) },
  );
  const pad = at(
    superBlob([0.046, 0.044, 0.014], [0.6, 0.6, 0.8], (o) => L(0.82 - 0.12 * smooth(0.03, 0.044, Math.abs(o.y))), undefined, 28),
    [0, 0.462, 0.072],
  );
  return merge([body, pad]);
}

/** Boot upper + ankle cuff. Local: leg frame. */
function boot(): G {
  const upper = superBlob(
    [0.059, 0.066, 0.118],
    [0.8, 0.7, 0.75],
    (o, d) => mix(C("#e4e2dc"), C("#a9aaa6"), smooth(0.4, 0.95, d.z) * 0.6 + 0.4 * seam(o.y + 0.02, 0.006)),
    (d, o) => {
      if (d.y > 0) o.y *= 1 - 0.55 * smooth(-0.2, 0.9, d.z); // toe slopes down
      if (d.y < 0) o.y *= 0.45; // flat footbed
      return 0;
    },
    48,
  );
  return merge([
    at(upper, [0, 0.075, 0.032]),
    vessel([[0, 0.11, -0.004], [0, 0.18, -0.004]], (t) => 0.057 - 0.008 * t, C("#cfcdc6"), 8, 22),
    ring([[0.05, 0.125], [0.058, 0.125], [0.06, 0.132], [0.058, 0.139], [0.05, 0.139]], 36, (p) => (Math.abs(p.y - 0.132) < 0.002 ? ANODIZED : METAL)),
  ]);
}

/** Lugged rubber sole + toe/heel caps. Local: leg frame. */
function sole(): G {
  return merge([
    at(
      superBlob([0.063, 0.022, 0.126], [0.5, 0.6, 0.6], (o) => {
        const lug = o.y < -0.008 && Math.sin(o.z * 260) > 0.2 ? 0.55 : 1;
        return mix(RUBBER, C("#1f2125"), 1 - lug);
      }, undefined, 40),
      [0, 0.022, 0.032],
    ),
    at(ellipsoid([0.05, 0.03, 0.02], RUBBER, 20), [0, 0.05, 0.15]),
  ]);
}

/* -------------------------------- registry ------------------------------ */

export type SuitPiece =
  | "helmet"
  | "visor"
  | "helmetLamps"
  | "helmetLenses"
  | "commCap"
  | "neckRing"
  | "hut"
  | "dcm"
  | "dcmScreen"
  | "lowerTorso"
  | "waistRing"
  | "dorsalRail"
  | "plss"
  | "plssDetails"
  | "hoses"
  | "arm"
  | "armBearings"
  | "glove"
  | "armPatch"
  | "leg"
  | "boot"
  | "sole";

const BUILDERS: Record<SuitPiece, (s: Side) => G> = {
  helmet,
  visor,
  helmetLamps,
  helmetLenses,
  commCap,
  neckRing,
  hut,
  dcm,
  dcmScreen,
  lowerTorso,
  waistRing,
  dorsalRail,
  plss,
  plssDetails,
  hoses,
  arm,
  armBearings,
  glove,
  armPatch,
  leg,
  boot,
  sole,
};

const cache = new Map<string, G>();

/** Cached suit geometry (shared by every viewport and the roster gallery). */
export function suitGeometry(piece: SuitPiece, side: Side = 1): G {
  const key = `${piece}:${side}`;
  let g = cache.get(key);
  if (!g) {
    g = BUILDERS[piece](side);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    cache.set(key, g);
  }
  return g;
}
