/**
 * Procedural anatomy — one merged, vertex-coloured BufferGeometry per organ.
 *
 * No external assets: every organ is sculpted from three.js building blocks
 *  - `blob`  — unit sphere pushed through a shape function (organic masses)
 *  - `tube`  — variable-radius sweep along a Catmull-Rom curve, rounded caps
 *  - `lathe` — revolved profile (domes, cups)
 * then merged so each organ is ONE mesh → one raycast target, one onClick,
 * one material (the focus/selection pipeline relies on this).
 *
 * Units ≈ metres in model-local space; geometry is built around the organ's
 * anchor (`Organ.position`). Anatomical convention: the model faces +z, so
 * patient-left is +x (`side = 1`) and patient-right is −x (`side = -1`).
 * Stylised for a lab console — readable silhouettes, not clinical meshes.
 */

import * as THREE from "three";

import type { OrganShape } from "@/types/health";
import {
  at,
  blob,
  C,
  clamp01,
  ellipsoid,
  fbm,
  lathe,
  merge,
  mix,
  n3,
  paint,
  smooth,
  solid,
  tube,
  vessel,
  weld,
  type G,
  type Side,
  type Vec,
} from "./procedural";

/* ------------------------------- palette ------------------------------- */

const P = {
  bone: C("#ddd3c1"),
  boneDark: C("#b4a88f"),
  cartilage: C("#cfd9de"),
  disc: C("#a9bccb"),
  artery: C("#c0605a"),
  vein: C("#5b6c9c"),
  nerve: C("#e0d2a8"),
  fat: C("#d9bd7c"),
  muscle: C("#a5524b"),
  muscleDark: C("#7f3a37"),
  tendon: C("#e6dccb"),
};

/* ------------------------------- builders ------------------------------ */

function brain(): G {
  const groove = (d: THREE.Vector3, s: number) => {
    const n = fbm(d.x * 5.5 + s * 3.1, d.y * 5.5, d.z * 5.5);
    return Math.pow(1 - Math.min(1, Math.abs(n) * 6), 3);
  };
  const hemi = (s: Side) =>
    blob(
      96,
      72,
      (d, o) => {
        o.set(d.x * 0.037, d.y * 0.053, d.z * 0.079);
        if (d.x * s < 0) o.x *= 0.32; // flat medial face → longitudinal fissure
        if (d.y < 0) o.y *= 0.72;
        if (d.z > 0.35 && d.y < 0) o.y *= 0.82; // frontal base
        const tl = Math.exp(-(((d.y + 0.42) ** 2) / 0.05 + ((d.z - 0.05) ** 2) / 0.22)) * Math.max(0, d.x * s);
        o.x += s * 0.008 * tl; // temporal lobe
        o.y -= 0.006 * tl;
        const gr = groove(d, s);
        o.multiplyScalar(1 - (0.0038 * gr) / Math.max(o.length(), 1e-4));
        o.x += s * 0.0035;
        return gr;
      },
      (o, d, gr) => mix(mix(C("#d8b6b0"), C("#c79f9b"), clamp01(-d.y)), C("#8d6766"), gr * 0.85),
    );
  const cerebellum = at(
    blob(
      64,
      40,
      (d, o) => {
        o.set(d.x * 0.046, d.y * 0.022, d.z * 0.03);
        o.z *= 1 - 0.18 * Math.exp(-(d.x * d.x) / 0.01); // vermis
        const f = 0.5 + 0.5 * Math.sin(d.y * 38);
        o.multiplyScalar(1 - 0.06 * f);
        return f;
      },
      (_o, _d, f) => mix(C("#bf9692"), C("#916b69"), f * 0.6),
    ),
    [0, -0.034, -0.052],
  );
  const stem = vessel(
    [[0, -0.016, -0.02], [0, -0.045, -0.03], [0, -0.08, -0.034]],
    (t) => 0.0105 - 0.003 * t,
    C("#cdb3ab"),
  );
  return merge([hemi(1), hemi(-1), cerebellum, stem]);
}

function eye(s: Side): G {
  const globe = blob(
    40,
    30,
    (d, o) => {
      o.copy(d).multiplyScalar(0.0125);
      if (d.z > 0.82) o.multiplyScalar(1 + 0.12 * ((d.z - 0.82) / 0.18)); // cornea
      return 0;
    },
    (_o, d) => {
      if (d.z > 0.975) return C("#101418"); // pupil
      if (d.z > 0.9) {
        const rays = 0.5 + 0.5 * Math.sin(Math.atan2(d.y, d.x) * 30);
        return mix(C("#5f84b5"), C("#34507a"), rays * 0.6 + (0.975 - d.z) * 3);
      }
      return mix(C("#ebe6dc"), C("#d8b5ae"), smooth(0.1, -0.7, d.z));
    },
  );
  const nerve = vessel(
    [[0, 0, -0.011], [-s * 0.008, -0.002, -0.03], [-s * 0.018, -0.004, -0.05]],
    0.0032,
    P.nerve,
  );
  const recti = [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    return vessel(
      [
        [Math.cos(a) * 0.0108, Math.sin(a) * 0.0108, -0.002],
        [Math.cos(a) * 0.009 - s * 0.006, Math.sin(a) * 0.008, -0.022],
        [-s * 0.016 + Math.cos(a) * 0.003, -0.004 + Math.sin(a) * 0.003, -0.045],
      ],
      (t) => 0.0019 * (1 - 0.4 * t),
      P.muscle,
      18,
      8,
    );
  });
  return merge([globe, nerve, ...recti]);
}

function heart(): G {
  const ventShape = (d: THREE.Vector3, o: THREE.Vector3) => {
    const apex = Math.max(0, -d.y);
    const k = 1 - 0.5 * Math.pow(apex, 1.5);
    o.set(d.x * 0.043 * k, d.y * 0.052 * (1 + 0.12 * apex), d.z * 0.038 * k);
    const gx = d.x - (0.12 + 0.25 * d.y);
    const lad = Math.exp(-(gx * gx) / 0.004) * Math.max(0, d.z); // interventricular sulcus
    const av = Math.exp(-((d.y - 0.55) ** 2) / 0.004); // coronary sulcus
    o.multiplyScalar(1 - 0.05 * lad - 0.06 * av);
    return Math.max(lad, av);
  };
  const vent = blob(64, 48, ventShape, (_o, d, g) =>
    mix(mix(C("#a9524c"), C("#c06a5f"), smooth(-0.2, -1, d.y)), C("#d6b376"), g * 0.75),
  );
  const onSurface = (d: THREE.Vector3): Vec => {
    const o = new THREE.Vector3();
    ventShape(d.normalize(), o);
    o.multiplyScalar(1.04);
    return [o.x, o.y, o.z];
  };
  const ladPts: Vec[] = [];
  for (let v = 0.62; v >= -0.9; v -= 0.17) {
    const x = 0.12 + 0.25 * v;
    ladPts.push(onSurface(new THREE.Vector3(x, v, Math.sqrt(Math.max(0.02, 1 - x * x - v * v)))));
  }
  const cxPts: Vec[] = [];
  const c = Math.sqrt(1 - 0.55 * 0.55);
  for (let th = -1.5; th <= 1.6; th += 0.31) {
    cxPts.push(onSurface(new THREE.Vector3(Math.sin(th) * c, 0.55, Math.cos(th) * c)));
  }
  const coronary = C("#c9584a");
  const core = merge([
    vent,
    vessel(ladPts, 0.0022, coronary, 30, 8),
    vessel(cxPts, 0.0022, coronary, 30, 8),
  ]);
  core.rotateX(-0.3).rotateZ(0.45); // apex points left-down-forward

  const atrium = C("#8f4247");
  const parts: G[] = [
    core,
    at(ellipsoid([0.026, 0.022, 0.024], atrium), [-0.032, 0.035, -0.004]),
    at(ellipsoid([0.024, 0.018, 0.022], atrium), [0.012, 0.038, -0.03]),
    at(ellipsoid([0.012, 0.008, 0.01], C("#9a4a4d")), [0.036, 0.046, 0.006]),
    // aortic arch + descending aorta
    vessel(
      [[-0.005, 0.03, 0.0], [-0.01, 0.075, 0.005], [0.0, 0.105, -0.005], [0.025, 0.1, -0.03], [0.032, 0.06, -0.045], [0.03, -0.02, -0.05]],
      (t) => 0.0125 - 0.002 * t,
      P.artery,
      48,
      14,
    ),
    // brachiocephalic, left carotid, left subclavian
    vessel([[-0.004, 0.1, -0.002], [-0.01, 0.135, 0.0]], 0.0042, P.artery, 8, 8),
    vessel([[0.008, 0.106, -0.012], [0.01, 0.142, -0.012]], 0.0036, P.artery, 8, 8),
    vessel([[0.018, 0.102, -0.022], [0.024, 0.136, -0.026]], 0.0038, P.artery, 8, 8),
    // pulmonary trunk → left + right pulmonary arteries
    vessel([[0.012, 0.025, 0.03], [0.018, 0.06, 0.025], [0.05, 0.07, 0.0]], 0.0092, C("#6c7fb0"), 24, 12),
    vessel([[0.018, 0.06, 0.025], [-0.01, 0.07, -0.01], [-0.045, 0.065, -0.012]], 0.0082, C("#6c7fb0"), 24, 12),
    // venae cavae
    vessel([[-0.035, 0.03, -0.005], [-0.036, 0.11, -0.01]], 0.009, P.vein, 12, 12),
    vessel([[-0.03, -0.025, -0.02], [-0.03, -0.07, -0.025]], 0.009, P.vein, 12, 12),
  ];
  return merge(parts);
}

function lung(s: Side): G {
  return blob(
    72,
    56,
    (d, o) => {
      const top = Math.max(0, d.y);
      const taper = 1 - 0.45 * top * top;
      o.set(d.x * 0.072 * taper, d.y * 0.105, d.z * 0.09 * taper);
      const medial = d.x * s < 0;
      if (medial) o.x *= 0.5;
      o.y += 0.035 * smooth(0.8, 1, -d.y); // diaphragmatic dish
      if (s === 1 && medial) {
        const notch = Math.exp(-(((d.y + 0.25) ** 2) / 0.12 + ((d.z - 0.55) ** 2) / 0.15));
        o.x *= 1 - 0.6 * notch; // cardiac notch
        o.z *= 1 - 0.25 * notch;
      }
      const ob = d.y + 0.65 * d.z - 0.15;
      let fis = Math.exp(-(ob * ob) / 0.0025); // oblique fissure
      if (s === -1) {
        const hz = d.y - 0.12; // right horizontal fissure
        fis = Math.max(fis, Math.exp(-(hz * hz) / 0.0025) * smooth(-0.1, 0.2, d.z));
      }
      o.multiplyScalar((1 - 0.06 * fis) * (1 + 0.012 * fbm(d.x * 9, d.y * 9, d.z * 9)));
      const hilum = medial ? Math.exp(-((d.y * d.y) / 0.06 + (d.z * d.z) / 0.08)) : 0;
      return fis + hilum * 2;
    },
    (_o, d, tag) => {
      const fis = Math.min(1, tag % 2);
      const hilum = tag >= 2 ? 1 : 0;
      const mottle = smooth(0.1, 0.45, Math.abs(fbm(d.x * 14, d.y * 14, d.z * 14)));
      const base = mix(mix(C("#c89ca0"), C("#9c6f7b"), smooth(0.6, -0.9, d.y)), C("#8a5f6c"), mottle * 0.45);
      return mix(mix(base, C("#6c4756"), fis * 0.8), C("#7c5a6b"), hilum * 0.8);
    },
  );
}

function trachea(): G {
  const mucosa = C("#c7a59c");
  const ringCol = C("#e2d6c8");
  const rings: G[] = [];
  for (let y = 0.062; y >= -0.026; y -= 0.0085) {
    const r = new THREE.TorusGeometry(0.0093, 0.0017, 6, 20, Math.PI * 1.6);
    rings.push(at(solid(r, ringCol).rotateZ(-0.3 * Math.PI).rotateX(Math.PI / 2), [0, y, 0]));
  }
  const tree = (pts: Vec[], r0: number, r1: number) =>
    vessel(pts, (t) => r0 + (r1 - r0) * t, mucosa, 20, 10);
  return merge([
    ...rings.map((g) => { g.computeVertexNormals(); return g; }),
    tree([[0, 0.07, 0.003], [0, 0.02, 0], [0, -0.035, -0.002]], 0.0085, 0.0085),
    tree([[0, -0.035, -0.002], [0.02, -0.055, -0.004], [0.045, -0.08, -0.006]], 0.0068, 0.0055),
    tree([[0, -0.035, -0.002], [-0.015, -0.055, -0.004], [-0.034, -0.08, -0.006]], 0.0074, 0.006),
    tree([[0.045, -0.08, -0.006], [0.055, -0.07, -0.002], [0.064, -0.062, 0.002]], 0.0045, 0.0032),
    tree([[0.045, -0.08, -0.006], [0.053, -0.1, -0.01], [0.06, -0.118, -0.014]], 0.0048, 0.0034),
    tree([[-0.034, -0.08, -0.006], [-0.048, -0.066, -0.002], [-0.06, -0.058, 0.0]], 0.0046, 0.0032),
    tree([[-0.034, -0.08, -0.006], [-0.05, -0.09, 0.008], [-0.062, -0.094, 0.016]], 0.004, 0.003),
    tree([[-0.034, -0.08, -0.006], [-0.042, -0.102, -0.01], [-0.05, -0.122, -0.014]], 0.0048, 0.0034),
  ]);
}

function esophagus(): G {
  return tube(
    [[0, 0.16, 0], [0, 0.08, -0.004], [0.002, 0, -0.006], [0.008, -0.08, 0.0], [0.03, -0.14, 0.03], [0.06, -0.165, 0.065]],
    (t) => 0.0075 * (1 + 0.08 * Math.sin(t * 40)),
    { segments: 80, radial: 12, color: (t, a) => mix(C("#c3877c"), C("#9d6359"), 0.5 + 0.5 * Math.sin(a * 6) * 0.6 + 0.1 * Math.sin(t * 40)) },
  );
}

function diaphragm(): G {
  const g = lathe(
    [
      [0.0005, 0.031], [0.045, 0.026], [0.085, 0.011], [0.118, -0.012], [0.142, -0.044],
      [0.148, -0.042], [0.124, -0.006], [0.089, 0.018], [0.047, 0.033], [0.0005, 0.038],
    ],
    64,
    (p) => {
      const r = Math.hypot(p.x, p.z);
      const th = Math.atan2(p.z, p.x);
      const tendon = smooth(0.07, 0.045, r + 0.012 * Math.cos(3 * th));
      const fibres = 0.5 + 0.5 * Math.sin(th * 60);
      return mix(mix(C("#a3665e"), C("#874f49"), fibres * 0.35), C("#d9ccb9"), tendon);
    },
  );
  const pos = g.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setXYZ(i, x, pos.getY(i) + 0.01 * smooth(0, 0.12, -x), pos.getZ(i) * 0.82); // right dome higher
  }
  g.computeVertexNormals();
  return g;
}

/** Stack of vertebrae: body + disc + neural arch + spinous/transverse processes. */
function column(n: number, rb: number, hb: number, spacing: number, curve: (u: number) => number, proc: number): G {
  const parts: G[] = [];
  const boneCol = (p: THREE.Vector3) =>
    mix(P.bone, P.boneDark, 0.35 + 0.35 * fbm(p.x * 400, p.y * 400, p.z * 400));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    const y = -(i - (n - 1) / 2) * spacing;
    const z = curve(u);
    parts.push(at(paint(weld(new THREE.CylinderGeometry(rb, rb * 1.04, hb, 20, 1)), boneCol), [0, y, z]));
    const rf = rb * 0.8;
    const zc = z - rb * 0.75;
    const arch = paint(weld(new THREE.TorusGeometry(rf, rb * 0.22, 8, 18, Math.PI)), boneCol);
    parts.push(at(arch.rotateX(-Math.PI / 2), [0, y, zc]));
    parts.push(vessel([[0, y, zc - rf], [0, y - proc * 0.35, zc - rf - proc * 0.6], [0, y - proc * 0.7, zc - rf - proc]], (t) => rb * 0.24 * (1 - 0.4 * t), P.boneDark, 12, 8));
    for (const s of [1, -1] as const) {
      parts.push(vessel([[s * rf * 0.9, y, zc - rf * 0.2], [s * (rf + proc * 0.6), y + 0.002, zc - rf * 0.45]], rb * 0.17, P.boneDark, 8, 8));
    }
    if (i < n - 1) {
      parts.push(at(solid(new THREE.CylinderGeometry(rb * 0.96, rb * 0.96, spacing - hb, 20, 1), P.disc), [0, y - spacing / 2, z + (curve(u + 1 / Math.max(1, n - 1)) - z) / 2]));
    }
  }
  parts.forEach((g) => g.computeVertexNormals());
  return merge(parts);
}

function pelvis(): G {
  const parts: G[] = [];
  for (const s of [1, -1] as const) {
    parts.push(
      at(
        ellipsoid(
          [0.05, 0.045, 0.011],
          (o, d) => mix(P.bone, P.boneDark, smooth(0.2, -0.8, d.y) * 0.5 + (d.y > 0.85 ? -0.3 : 0)),
          36,
          (d, o) => {
            o.x *= 1 - 0.6 * Math.max(0, -d.y); // fan: wide crest, narrow neck
            o.y *= d.y < 0 ? 1.25 : 1;
            o.z += 0.018 * (d.x * d.x) - 0.006 * Math.max(0, d.y); // bowl curvature
          },
        ).rotateY(s * 0.75),
        [s * 0.072, 0.03, -0.005],
      ),
    );
    parts.push(
      vessel(
        [[s * 0.06, -0.02, 0.0], [s * 0.068, -0.05, 0.025], [s * 0.045, -0.072, 0.05], [s * 0.012, -0.062, 0.062], [s * 0.02, -0.04, 0.055], [s * 0.05, -0.03, 0.035]],
        0.0075,
        P.bone,
        40,
        10,
      ),
    );
    const acet = solid(new THREE.TorusGeometry(0.013, 0.0045, 8, 20), P.boneDark);
    acet.computeVertexNormals();
    parts.push(at(acet.rotateY(Math.PI / 2), [s * 0.054, -0.03, 0.05]));
  }
  parts.push(
    at(
      ellipsoid(
        [0.033, 0.045, 0.012],
        (o) => {
          const fx = Math.abs(o.x) - 0.012;
          const hole = Math.abs(fx) < 0.004 && Math.abs(((o.y + 0.03) % 0.016) - 0.008) < 0.004;
          return hole ? C("#8a7d68") : P.bone;
        },
        36,
        (d, o) => { o.x *= 1 - 0.5 * Math.max(0, -d.y); },
      ).rotateX(0.35),
      [0, 0.01, -0.055],
    ),
  );
  return merge(parts);
}

function biceps(): G {
  const belly = blob(
    48,
    40,
    (d, o) => {
      const k = 1 - 0.7 * Math.pow(Math.abs(d.y), 2.5);
      o.set(d.x * 0.024 * k, d.y * 0.085, d.z * 0.021 * k);
      o.z *= 1 - 0.25 * Math.exp(-(d.x * d.x) / 0.02) * smooth(0.5, 0.9, d.y); // two heads
      return 0.5 + 0.5 * Math.sin(Math.atan2(d.z, d.x) * 26);
    },
    (_o, _d, f) => mix(P.muscle, P.muscleDark, f * 0.35),
  );
  return merge([
    belly,
    vessel([[0, 0.08, 0], [0, 0.105, -0.004], [0, 0.13, -0.008]], 0.0035, P.tendon, 12, 8),
    vessel([[0, -0.08, 0], [0, -0.105, 0.004], [0, -0.125, 0.004]], 0.004, P.tendon, 12, 8),
    vessel([[0, 0.135, -0.024], [0, 0.0, -0.026], [0, -0.13, -0.022]], 0.0078, P.bone, 24, 10),
    at(ellipsoid([0.016, 0.016, 0.016], P.cartilage, 20), [0, 0.14, -0.024]),
  ]);
}

function femur(s: Side): G {
  const bone = (t: number) => mix(P.bone, P.boneDark, 0.25 + 0.2 * Math.sin(t * 30));
  return merge([
    tube(
      [[0, 0.15, 0], [0, 0, 0.006], [0, -0.16, 0]],
      (t) => 0.0105 * (1 + 0.55 * (Math.exp(-t * 12) + Math.exp(-(1 - t) * 9))),
      { segments: 40, radial: 14, color: bone },
    ),
    vessel([[0, 0.15, 0], [-s * 0.02, 0.172, -0.004], [-s * 0.034, 0.186, -0.007]], 0.0085, P.bone, 14, 10),
    at(ellipsoid([0.019, 0.019, 0.019], C("#e8e2d4"), 24), [-s * 0.04, 0.19, -0.008]),
    at(ellipsoid([0.014, 0.02, 0.015], P.bone, 20), [s * 0.01, 0.17, -0.006]),
    at(ellipsoid([0.008, 0.008, 0.008], P.boneDark, 14), [-s * 0.008, 0.12, -0.01]),
    at(ellipsoid([0.017, 0.019, 0.02], (o, d) => mix(P.bone, P.cartilage, smooth(0, -0.8, d.y)), 22), [0.013, -0.175, -0.004]),
    at(ellipsoid([0.017, 0.019, 0.02], (o, d) => mix(P.bone, P.cartilage, smooth(0, -0.8, d.y)), 22), [-0.013, -0.175, -0.004]),
    at(ellipsoid([0.012, 0.014, 0.006], P.cartilage, 18), [0, -0.16, 0.022]),
  ]);
}

function liver(): G {
  return blob(
    72,
    56,
    (d, o) => {
      const lr = (1 - d.x) / 2; // 1 at patient-right lobe, 0 at left tip
      const thick = 0.35 + 0.65 * lr;
      o.set(d.x * 0.095, d.y * 0.06 * thick, d.z * 0.075 * (0.55 + 0.45 * lr));
      if (d.y < 0) o.y *= 0.55; // flat visceral surface
      else o.y += 0.01 * (1 - d.x * d.x); // diaphragmatic dome
      if (d.x > 0.5) o.y -= 0.012 * (d.x - 0.5);
      const fx = d.x - 0.18;
      const fal = Math.exp(-(fx * fx) / 0.003) * Math.max(0, d.y) * smooth(0, 0.5, d.z);
      o.multiplyScalar(1 - 0.06 * fal);
      o.multiplyScalar(1 + 0.008 * fbm(d.x * 7, d.y * 7, d.z * 7));
      return fal;
    },
    (_o, d, fal) => mix(mix(C("#7b3f3a"), C("#9a564c"), smooth(-0.4, 0.9, d.y)), C("#5a2c2a"), fal),
  );
}

function gallbladder(): G {
  const g = lathe(
    [[0.0005, -0.028], [0.009, -0.024], [0.0125, -0.012], [0.012, 0.004], [0.008, 0.016], [0.004, 0.024], [0.0025, 0.032]],
    24,
    (p) => mix(C("#6f8a54"), C("#4c6739"), smooth(-0.028, 0.03, p.y)),
  );
  return merge([g, vessel([[0, 0.031, 0], [0.004, 0.042, -0.004], [0.006, 0.05, -0.01]], 0.0018, C("#7f9a62"), 10, 8)]).rotateX(-1.1);
}

function stomach(): G {
  const body = tube(
    [[0.035, 0.055, -0.04], [0.05, 0.015, -0.01], [0.035, -0.03, 0.02], [-0.005, -0.05, 0.03], [-0.045, -0.04, 0.025], [-0.068, -0.023, 0.012], [-0.08, -0.02, 0.0]],
    (t) => 0.012 + 0.024 * (1 - smooth(0.25, 1, t)),
    {
      segments: 72,
      radial: 20,
      color: (t, a) => mix(mix(C("#c99c88"), C("#d9b19b"), 0.5 + 0.5 * Math.cos(a)), C("#a87a67"), 0.15 + 0.1 * Math.sin(t * 60)),
    },
  );
  const duodenum = vessel(
    [[-0.08, -0.02, 0.0], [-0.095, -0.035, -0.01], [-0.095, -0.06, -0.02], [-0.08, -0.07, -0.015], [-0.055, -0.067, -0.025]],
    0.0088,
    C("#c69585"),
    32,
    12,
  );
  return merge([body, duodenum]);
}

function spleen(): G {
  return blob(
    40,
    32,
    (d, o) => {
      o.set(d.x * 0.02, d.y * 0.048, d.z * 0.034);
      if (d.x < 0) o.x *= 0.5; // concave visceral face (toward midline)
      const notch = Math.exp(-((d.y - 0.3) ** 2) / 0.005) * smooth(0.3, 0.8, d.z);
      o.multiplyScalar(1 - 0.05 * notch);
      return notch;
    },
    (_o, d, n) => mix(mix(C("#7d4a65"), C("#5f3550"), smooth(0.8, -0.8, d.x)), C("#4a2840"), n),
  ).rotateZ(0.35);
}

function pancreas(): G {
  return tube(
    [[-0.045, -0.015, 0.025], [-0.015, -0.002, 0.027], [0.03, 0.008, 0.01], [0.075, 0.025, -0.02], [0.095, 0.04, -0.035]],
    (t, a) => (0.0065 + 0.0095 * (1 - t) + 0.006 * Math.exp(-t * 12)) * (1 + 0.14 * n3(t * 40, Math.cos(a) * 3, Math.sin(a) * 3)),
    { segments: 64, radial: 16, color: (t, a) => mix(C("#dcbd90"), C("#c39a68"), 0.5 + 0.5 * n3(t * 50, Math.cos(a) * 4, Math.sin(a) * 4)) },
  );
}

function kidney(s: Side): G {
  const body = blob(
    56,
    44,
    (d, o) => {
      o.set(d.x * 0.026, d.y * 0.05, d.z * 0.019);
      const hil = Math.exp(-(d.y * d.y) / 0.12) * Math.max(0, -d.x * s);
      o.x *= 1 - 0.55 * hil; // renal hilum
      return hil;
    },
    (_o, d, hil) => mix(mix(C("#904844"), C("#7a3a38"), smooth(0.5, -0.9, d.z)), C("#d6b884"), hil * 0.7),
  ).rotateZ(s * 0.18);
  return merge([
    body,
    vessel([[-s * 0.012, 0.004, 0.003], [-s * 0.03, 0.006, 0.006], [-s * 0.05, 0.008, 0.01]], 0.004, P.artery, 10, 8),
    vessel([[-s * 0.012, -0.004, 0.006], [-s * 0.03, -0.005, 0.01], [-s * 0.05, -0.006, 0.014]], 0.0048, P.vein, 10, 8),
    vessel([[-s * 0.012, -0.012, 0], [-s * 0.022, -0.05, 0.01], [-s * 0.035, -0.11, 0.04], [-s * 0.04, -0.15, 0.09], [-s * 0.04, -0.165, 0.115]], 0.0025, C("#d6c3a4"), 40, 8),
    at(
      ellipsoid([0.016, 0.01, 0.008], C("#d0a359"), 18, (d, o) => { o.x *= 1 - 0.6 * Math.max(0, d.y); }),
      [-s * 0.004, 0.056, 0],
    ),
  ]);
}

function smallIntestine(): G {
  const pts: Vec[] = [];
  const N = 260;
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * Math.PI * 2 * 0.97;
    pts.push([
      0.058 * Math.sin(5 * u + 0.7 * Math.sin(2 * u)),
      0.042 * Math.cos(3 * u + 0.5 * Math.sin(5 * u)),
      0.022 * Math.sin(7 * u + 1.3),
    ]);
  }
  return tube(pts, () => 0.0105, {
    segments: 900,
    radial: 10,
    color: (t, a) => mix(mix(C("#d4a291"), C("#c08a7a"), 0.5 + 0.5 * Math.sin(t * 140)), C("#e0b9a8"), 0.25 * (0.5 + 0.5 * Math.cos(a))),
  });
}

function colon(): G {
  const anchor: Vec = [0, 0.87, 0.035];
  const world: Vec[] = [
    [-0.088, 0.8, 0.035], [-0.095, 0.86, 0.03], [-0.092, 0.915, 0.035], [-0.075, 0.935, 0.055],
    [-0.035, 0.89, 0.077], [0.0, 0.876, 0.082], [0.04, 0.884, 0.077], [0.082, 0.952, 0.045],
    [0.095, 0.9, 0.025], [0.092, 0.83, 0.025], [0.075, 0.79, 0.04], [0.04, 0.785, 0.06],
    [0.015, 0.775, 0.03], [0.005, 0.755, -0.01], [0, 0.72, -0.025],
  ];
  const rel = (p: Vec): Vec => [p[0] - anchor[0], p[1] - anchor[1], p[2] - anchor[2]];
  const haustra = (t: number) => 0.86 + 0.18 * Math.pow(Math.abs(Math.sin(t * Math.PI * 34)), 0.6);
  const body = tube(
    world.map(rel),
    (t, a) => (0.017 + 0.005 * Math.exp(-t * 14) - 0.003 * smooth(0.85, 1, t)) * haustra(t) * (1 - 0.05 * Math.pow(Math.max(0, Math.cos(3 * a)), 8)),
    { segments: 360, radial: 16, color: (t) => mix(C("#b98f76"), C("#94705c"), 1 - haustra(t) + 0.1) },
  );
  const appendix = vessel([rel([-0.088, 0.785, 0.03]), rel([-0.08, 0.765, 0.045]), rel([-0.07, 0.758, 0.04])], 0.0035, C("#b08872"), 12, 8);
  return merge([body, appendix]);
}

function bladder(): G {
  return merge([
    blob(
      40,
      32,
      (d, o) => {
        o.set(d.x * 0.03, d.y * 0.026, d.z * 0.026);
        if (d.y > 0) o.y *= 0.8;
        o.x *= 1 - 0.3 * Math.max(0, -d.y); // trigone
        return 0;
      },
      (_o, d) => mix(C("#c9a48e"), C("#dab9a3"), smooth(-0.5, 0.8, d.y)),
    ),
    vessel([[0, -0.024, 0], [0, -0.036, 0.002], [0, -0.046, 0.005]], 0.0035, C("#c09a86"), 8, 8),
  ]);
}

/** Textbook skin block: epidermis / dermis / hypodermis (exploded layers),
 * hair follicles + sebaceous glands, a sweat-gland coil and a vessel pair. */
function skinSection(): G {
  const W = 0.07;
  const H = 0.05;
  const GAP = 0.0012;
  const layer = (t: number, z: number, segs: number, color: (p: THREE.Vector3) => THREE.Color) => {
    const g = new THREE.BoxGeometry(W, H, t, segs, Math.round(segs * 0.7), 1);
    g.deleteAttribute("uv");
    g.translate(0, 0, z);
    return paint(g, color);
  };
  const hypo = layer(0.014, -0.007 - GAP, 14, (p) => {
    const lob = Math.abs(n3(p.x * 220, p.y * 220, p.z * 90));
    return mix(C("#e3cf8f"), C("#c49f57"), smooth(0.15, 0.02, lob));
  });
  const dermis = layer(0.009, 0.0045, 14, (p) => mix(C("#d09489"), C("#b67268"), 0.5 + 0.5 * n3(p.x * 300, p.y * 300, 1)));
  const epi = layer(0.0025, 0.0105 + GAP, 28, (p) => mix(C("#b98a72"), C("#e6c4ab"), smooth(0.0095 + GAP, 0.0118 + GAP, p.z)));
  const epiPos = epi.getAttribute("position");
  for (let i = 0; i < epiPos.count; i++) {
    const x = epiPos.getX(i);
    const y = epiPos.getY(i);
    if (epiPos.getZ(i) > 0.011 + GAP) {
      const edge = smooth(W / 2, W / 2 - 0.004, Math.abs(x)) * smooth(H / 2, H / 2 - 0.004, Math.abs(y));
      epiPos.setZ(i, epiPos.getZ(i) + 0.0005 * Math.sin(x * 700) * Math.sin(y * 500) * edge);
    }
  }
  [hypo, dermis, epi].forEach((g) => g.computeVertexNormals());

  const parts: G[] = [hypo, dermis, epi];
  for (const [x, y] of [[-0.02, 0.01], [0.008, -0.012], [0.022, 0.014]] as const) {
    parts.push(at(ellipsoid([0.0028, 0.0028, 0.0035], C("#6b4a3c"), 14), [x, y, -0.008]));
    parts.push(vessel([[x, y, -0.008], [x + 0.002, y, 0.004], [x + 0.006, y + 0.001, 0.02], [x + 0.012, y + 0.002, 0.03]], 0.0009, C("#2e2622"), 24, 6));
    parts.push(at(ellipsoid([0.002, 0.0016, 0.0022], C("#e6d08a"), 12), [x - 0.003, y, 0.002]));
  }
  const coil: Vec[] = [];
  for (let k = 0; k <= 36; k++) {
    const a = (k / 36) * Math.PI * 6;
    coil.push([-0.005 + 0.0025 * Math.cos(a), 0.012 + 0.0025 * Math.sin(a), -0.011 + (k / 36) * 0.004]);
  }
  coil.push([-0.005, 0.012, 0.0], [-0.005, 0.012, 0.0115 + GAP]);
  parts.push(vessel(coil, 0.0006, C("#b9c6d6"), 80, 6));
  parts.push(vessel([[-W / 2, -0.006, -0.0015], [-0.01, -0.002, -0.0012], [0.012, -0.008, -0.0016], [W / 2, -0.004, -0.0015]], 0.0016, P.artery, 30, 10));
  parts.push(vessel([[-W / 2, 0.003, -0.002], [-0.008, 0.007, -0.0022], [0.014, 0.002, -0.0018], [W / 2, 0.005, -0.002]], 0.0019, P.vein, 30, 10));
  return merge(parts);
}

/* -------------------------------- registry ------------------------------ */

const BUILDERS: Record<OrganShape, (side: Side) => G> = {
  brain,
  eye,
  heart,
  lung,
  trachea,
  esophagus,
  diaphragm,
  spine_cervical: () => column(5, 0.011, 0.012, 0.019, (u) => 0.006 * (1 - 4 * u * u), 0.016),
  spine_thoracic: () => column(8, 0.014, 0.016, 0.027, (u) => -0.008 * (1 - 4 * u * u), 0.026),
  spine_lumbar: () => column(5, 0.019, 0.02, 0.03, (u) => 0.008 * (1 - 4 * u * u), 0.022),
  pelvis,
  biceps,
  femur,
  liver,
  gallbladder,
  stomach,
  spleen,
  pancreas,
  kidney,
  small_intestine: smallIntestine,
  colon,
  bladder,
  skin_section: skinSection,
};

const cache = new Map<string, G>();

/** Cached organ geometry (shared by every crew member / viewport). */
export function organGeometry(shape: OrganShape, side: Side = 1): G {
  const key = `${shape}:${side}`;
  let g = cache.get(key);
  if (!g) {
    g = BUILDERS[shape](side);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    cache.set(key, g);
  }
  return g;
}

/** Non-selectable ribcage + sternum + clavicles (model-local), shown as
 * translucent context while the chest zone is drilled. */
export function ribcageGeometry(): G {
  const key = "ribcage";
  const hit = cache.get(key);
  if (hit) return hit;
  const parts: G[] = [];
  for (const s of [1, -1] as const) {
    for (let i = 0; i < 10; i++) {
      const y0 = 1.375 - i * 0.031;
      const a = 0.1 + 0.042 * Math.sin(Math.PI * Math.min(1, (i + 1.5) / 9));
      const thMax = Math.PI * (i < 7 ? 0.9 - i * 0.02 : 0.62 - (i - 7) * 0.06);
      const pts: Vec[] = [];
      for (let k = 0; k <= 10; k++) {
        const th = (thMax * k) / 10;
        pts.push([s * (0.012 + a * Math.sin(th)), y0 - 0.055 * Math.pow(k / 10, 1.3), -0.115 * Math.cos(th)]);
      }
      const last = pts[pts.length - 1];
      if (i < 7) pts.push([s * 0.016, last[1] - 0.012, 0.128]);
      parts.push(
        tube(pts, () => 0.0042, {
          segments: 40,
          radial: 8,
          color: (t) => (i < 7 && t > 0.82 ? P.cartilage : P.bone),
        }),
      );
    }
    parts.push(vessel([[s * 0.012, 1.375, 0.125], [s * 0.07, 1.39, 0.11], [s * 0.13, 1.4, 0.06], [s * 0.15, 1.405, 0.02]], 0.0055, P.bone, 24, 10));
  }
  parts.push(at(ellipsoid([0.014, 0.08, 0.006], P.bone, 24), [0, 1.255, 0.13]));
  parts.push(at(ellipsoid([0.022, 0.02, 0.007], P.bone, 20), [0, 1.345, 0.125]));
  const g = merge(parts);
  g.computeBoundingSphere();
  cache.set(key, g);
  return g;
}

/**
 * Build every organ mesh during browser idle time (one per slice) so the
 * first drill-down / wireframe overview doesn't stall on ~250 ms of
 * geometry work. Safe to call repeatedly; returns a cancel function.
 */
export function warmOrganCache(
  organs: readonly { shape: OrganShape; side?: Side }[],
): () => void {
  let i = 0;
  let handle: number | undefined;
  const idle =
    typeof window !== "undefined" && "requestIdleCallback" in window
      ? (cb: () => void) => window.requestIdleCallback(cb, { timeout: 1500 })
      : (cb: () => void) => window.setTimeout(cb, 30);
  const step = () => {
    if (i >= organs.length) return;
    const o = organs[i++];
    organGeometry(o.shape, o.side ?? 1);
    handle = idle(step);
  };
  handle = idle(step);
  return () => {
    if (handle === undefined) return;
    if ("cancelIdleCallback" in window) window.cancelIdleCallback(handle);
    window.clearTimeout(handle);
  };
}
