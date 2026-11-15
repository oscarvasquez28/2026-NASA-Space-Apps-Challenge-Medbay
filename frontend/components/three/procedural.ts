/**
 * Shared procedural-geometry toolkit (organs + EVA suit).
 *
 *  - `blob` / `superBlob` — unit sphere pushed through a shape function
 *  - `tube` / `vessel`    — variable-radius Catmull-Rom sweeps (open + caps,
 *                           or closed loops)
 *  - `lathe` / `ring`     — revolved profiles
 *  - `merge` / `at`       — combine parts into ONE BufferGeometry per mesh
 *
 * All outputs are indexed with position + normal + color attributes so any
 * of them can be merged together. Deterministic (trig noise, no RNG).
 */

import * as THREE from "three";
import {
  mergeGeometries,
  mergeVertices,
} from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type G = THREE.BufferGeometry;
export type Side = 1 | -1;
export type Vec = [number, number, number];

/* ------------------------------- helpers ------------------------------- */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
export const C = (hex: string) => new THREE.Color(hex);
export const mix = (a: THREE.Color, b: THREE.Color, t: number) =>
  a.clone().lerp(b, clamp01(t));
export const v3 = (p: Vec) => new THREE.Vector3(p[0], p[1], p[2]);

/** Deterministic trig "noise" — stable across renders, no RNG. */
export function n3(x: number, y: number, z: number) {
  return (
    Math.sin(x * 1.7 + y * 3.1 + 0.3) *
    Math.cos(y * 2.3 - z * 1.3 + 1.1) *
    Math.sin(z * 2.9 + x * 0.7 + 2.2)
  );
}
export function fbm(x: number, y: number, z: number) {
  return (
    n3(x, y, z) * 0.55 +
    n3(x * 2.03 + 5.2, y * 2.11 + 1.3, z * 1.97 + 7.1) * 0.3 +
    n3(x * 4.1 + 2.7, y * 3.9 + 8.1, z * 4.3 + 3.3) * 0.15
  );
}

/** Drop uv/normal and weld seams so deformation + normals stay smooth. */
export function weld(g: G): G {
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return mergeVertices(g);
}

export function paint(g: G, fn: (p: THREE.Vector3, i: number) => THREE.Color): G {
  const pos = g.getAttribute("position");
  const out = new Float32Array(pos.count * 3);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const c = fn(p, i);
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(out, 3));
  return g;
}

export function solid(g: G, color: THREE.Color): G {
  return paint(weld(g), () => color);
}

/** Organic mass: unit sphere → `shape(dir, out)`; the shape's return value
 * (a 0..1 "feature" weight: groove, hilum…) is handed to `color`. */
export function blob(
  segW: number,
  segH: number,
  shape: (d: THREE.Vector3, o: THREE.Vector3) => number,
  color: (o: THREE.Vector3, d: THREE.Vector3, tag: number) => THREE.Color,
): G {
  const g = weld(new THREE.SphereGeometry(1, segW, segH));
  const pos = g.getAttribute("position");
  const cols = new Float32Array(pos.count * 3);
  const d = new THREE.Vector3();
  const o = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const tag = shape(d, o.set(0, 0, 0));
    pos.setXYZ(i, o.x, o.y, o.z);
    const c = color(o, d, tag);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/** Ellipsoid blob with a flat colour and optional per-vertex tweak. */
export function ellipsoid(
  r: Vec,
  color: THREE.Color | ((o: THREE.Vector3, d: THREE.Vector3) => THREE.Color),
  seg = 28,
  tweak?: (d: THREE.Vector3, o: THREE.Vector3) => void,
): G {
  return blob(
    seg,
    Math.round(seg * 0.75),
    (d, o) => {
      o.set(d.x * r[0], d.y * r[1], d.z * r[2]);
      tweak?.(d, o);
      return 0;
    },
    (o, d) => (typeof color === "function" ? color(o, d) : color),
  );
}

export interface TubeOpts {
  segments?: number;
  radial?: number;
  caps?: boolean;
  /** Closed loop (rims, seams): no caps, last ring stitches to the first. */
  closed?: boolean;
  color: (t: number, a: number) => THREE.Color;
}

/** Variable-radius sweep along a Catmull-Rom curve with rounded end caps.
 * `radius(t, a)` — t ∈ [0,1] along the curve, a ∈ [0,2π) around it. */
export function tube(points: Vec[], radius: (t: number, a: number) => number, opts: TubeOpts): G {
  const { segments = 48, radial = 12, closed = false, color } = opts;
  const caps = !closed && (opts.caps ?? true);
  const curve = new THREE.CatmullRomCurve3(points.map(v3), closed, "catmullrom", 0.5);
  const frames = curve.computeFrenetFrames(segments, closed);

  interface Ring { c: THREE.Vector3; n: THREE.Vector3; b: THREE.Vector3; t: number; k: number }
  const rings: Ring[] = [];
  for (let i = 0; i < (closed ? segments : segments + 1); i++) {
    const t = i / segments;
    rings.push({ c: curve.getPointAt(t), n: frames.normals[i], b: frames.binormals[i], t, k: 1 });
  }
  if (caps) {
    const CAP = 4;
    const first = rings[0];
    const last = rings[rings.length - 1];
    const r0 = radius(0, 0);
    const r1 = radius(1, 0);
    const t0 = frames.tangents[0];
    const t1 = frames.tangents[segments];
    const head: Ring[] = [];
    const tail: Ring[] = [];
    for (let k = 1; k <= CAP; k++) {
      const ang = (k / CAP) * (Math.PI / 2);
      head.unshift({ ...first, c: first.c.clone().addScaledVector(t0, -r0 * Math.sin(ang)), k: Math.cos(ang) });
      tail.push({ ...last, c: last.c.clone().addScaledVector(t1, r1 * Math.sin(ang)), k: Math.cos(ang) });
    }
    rings.unshift(...head);
    rings.push(...tail);
  }

  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const tmp = new THREE.Vector3();
  rings.forEach((ring) => {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const r = radius(ring.t, a) * ring.k;
      tmp
        .copy(ring.c)
        .addScaledVector(ring.n, Math.cos(a) * r)
        .addScaledVector(ring.b, Math.sin(a) * r);
      pos.push(tmp.x, tmp.y, tmp.z);
      const c = color(ring.t, a);
      col.push(c.r, c.g, c.b);
    }
  });
  const spans = closed ? rings.length : rings.length - 1;
  for (let i = 0; i < spans; i++) {
    const n = (i + 1) % rings.length;
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = n * radial + j;
      const d = n * radial + ((j + 1) % radial);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Constant-colour tube shorthand. */
export function vessel(points: Vec[], r: number | ((t: number) => number), color: THREE.Color, segments = 24, radial = 10): G {
  const rf = typeof r === "number" ? () => r : r;
  return tube(points, (t) => rf(t), { segments, radial, color: () => color });
}

export function lathe(profile: [number, number][], segs: number, color: (p: THREE.Vector3) => THREE.Color): G {
  const g = weld(
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs),
  );
  paint(g, (p) => color(p));
  g.computeVertexNormals();
  return g;
}

export function merge(parts: G[]): G {
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error("organ-geometry: incompatible parts");
  return g;
}

export const at = (g: G, p: Vec, rot?: Vec): G => {
  if (rot) g.rotateX(rot[0]).rotateY(rot[1]).rotateZ(rot[2]);
  return g.translate(p[0], p[1], p[2]);
};

/** Superellipsoid — `exp` < 1 squares the silhouette (hard shells, packs);
 * `shape` may further deform the point and returns a 0..1 colour tag. */
export function superBlob(
  half: Vec,
  exp: Vec,
  color: (o: THREE.Vector3, d: THREE.Vector3, tag: number) => THREE.Color,
  shape?: (d: THREE.Vector3, o: THREE.Vector3) => number,
  seg = 48,
): G {
  const sp = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
  return blob(
    seg,
    Math.round(seg * 0.75),
    (d, o) => {
      o.set(sp(d.x, exp[0]) * half[0], sp(d.y, exp[1]) * half[1], sp(d.z, exp[2]) * half[2]);
      return shape ? shape(d, o) : 0;
    },
    color,
  );
}

/** Revolved closed ring profile `[radius, y][]` (bearings, cuffs). */
export function ring(profile: [number, number][], segs: number, color: (p: THREE.Vector3) => THREE.Color): G {
  return lathe([...profile, profile[0]], segs, color);
}
