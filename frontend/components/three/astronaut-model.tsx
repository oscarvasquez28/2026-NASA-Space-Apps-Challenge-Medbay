"use client";

/**
 * Procedural astronaut in three layers: EVA suit → full-body skin → organs.
 * Every suit mesh belongs to a `partId`; each partId belongs to a BodyZone.
 * Selection, status tinting, explode offsets, section clipping, wireframe
 * and edges all flow from the per-instance viewer store. Layers never
 * pop: every mesh fades/slides towards a damped target (useFade), and
 * hidden meshes drop out of raycasting so they can't steal clicks.
 */

import { Edges, Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import * as THREE from "three";

import { useAppStore } from "@/stores/app-store";
import { useViewerStore, type OverlayMode } from "@/stores/viewer-store";
import { ORGANS, organsOf, organStatus } from "@/data/organs";
import { armTransform, HIP_X } from "@/data/suit-rig";
import { organGeometry, ribcageGeometry, warmOrganCache } from "./organ-geometry";
import { SKIN_SEGMENT_PART, SKIN_SEGMENTS, skinGeometry, type SkinSegment } from "./skin-geometry";
import { suitGeometry } from "./suit-geometry";
import { MODEL_GROUP_OFFSET } from "@/types/health";
import type {
  BodyZone,
  Organ,
  TriageLevel,
  Vec3,
  ZoneId,
} from "@/types/health";

/* ------------------------- materials / colors ------------------------- */

const SUIT_WHITE = "#e2e4df";
const ACCENT_EMISSIVE = "#31456b";

const STATUS_TINT: Record<TriageLevel, string> = {
  NOMINAL: SUIT_WHITE,
  CAUTION: "#e2cf9c",
  URGENT: "#e2aa86",
  CRITICAL: "#de9090",
};

/** DCM display glow follows the chest zone's triage level. */
const SCREEN_GLOW: Record<TriageLevel, string> = {
  NOMINAL: "#7f9fe8",
  CAUTION: "#e0c070",
  URGENT: "#e09060",
  CRITICAL: "#ff6a60",
};

/** Material finishes (meshPhysicalMaterial presets, MECHAVIS §6.2). */
type Finish = "fabric" | "hard" | "metal" | "visor" | "rubber";

const FINISH: Record<
  Finish,
  {
    roughness: number;
    metalness: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    sheen?: number;
    sheenRoughness?: number;
    envMapIntensity?: number;
  }
> = {
  fabric: { roughness: 0.84, metalness: 0, sheen: 0.65, sheenRoughness: 0.7 },
  hard: { roughness: 0.4, metalness: 0.02, clearcoat: 0.55, clearcoatRoughness: 0.3 },
  metal: { roughness: 0.3, metalness: 0.85, clearcoat: 0.3, clearcoatRoughness: 0.25 },
  // not fully metallic: a pure mirror only shows the dark studio and reads
  // black — keep some gold albedo + a strong clearcoat glint
  visor: { roughness: 0.18, metalness: 0.62, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 2.2 },
  rubber: { roughness: 0.92, metalness: 0 },
};

/** Conceptual overlay palettes (provider-owned semantics, per-zone tint). */
const OVERLAY_COLORS: Record<string, string> = {
  cold: "#5d7fb4",
  warm: "#b4805d",
  hot: "#b45d5d",
  low: "#6d7684",
  mid: "#a89b72",
  high: "#b45d5d",
};

function overlayTint(zone: BodyZone | undefined, mode: OverlayMode): string | null {
  if (!zone || mode === "none") return null;
  const v = (key: string) => zone.vitals.find((x) => x.key === key)?.value;
  switch (mode) {
    case "thermal": {
      const t = v("skin_temp") ?? v("core_temp_c");
      if (t == null) return OVERLAY_COLORS.low;
      return t < 33 ? OVERLAY_COLORS.cold : t < 35.5 ? OVERLAY_COLORS.warm : OVERLAY_COLORS.hot;
    }
    case "exertion": {
      const hr = v("heart_rate_bpm") ?? v("exertion") ?? 0;
      return hr < 80 ? OVERLAY_COLORS.low : hr < 120 ? OVERLAY_COLORS.mid : OVERLAY_COLORS.high;
    }
    case "fatigue": {
      const f = v("exertion") ?? v("sleep_debt") ?? 0;
      return f < 40 ? OVERLAY_COLORS.low : f < 70 ? OVERLAY_COLORS.mid : OVERLAY_COLORS.high;
    }
    case "radiation": {
      const r = v("radiation_msv_hr");
      if (zone.id !== "skin") return "#4a505a";
      return (r ?? 0) < 0.05 ? OVERLAY_COLORS.low : (r ?? 0) < 0.09 ? OVERLAY_COLORS.mid : OVERLAY_COLORS.high;
    }
    default:
      return null;
  }
}

/* ------------------------------ part ids ------------------------------ */

const EXPLODE_OFFSET: Record<string, Vec3> = {
  helmet: [0, 0.42, 0],
  visor: [0, 0.3, 0.34],
  head: [0, 0, 0],
  collar: [0, 0.2, 0],
  chest: [0, 0, 0.1],
  abdomen: [0, -0.06, 0.06],
  spine: [0, 0, -0.22],
  plss: [0, 0, -0.5],
  arm_l: [0.38, 0.04, 0],
  arm_r: [-0.38, 0.04, 0],
  leg_l: [0.12, -0.28, 0],
  leg_r: [-0.12, -0.28, 0],
};

/** How far non-selected parts slide out while they fade during a drill. */
const AWAY = 0.45;

interface PartSpec {
  partId: string;
  zoneId: ZoneId;
}

export const PART_ZONE: Record<string, ZoneId> = {
  helmet: "head",
  head: "head",
  visor: "head",
  collar: "head",
  skin_body: "skin",
  chest: "chest",
  abdomen: "gut",
  spine: "spine",
  plss: "skin",
  arm_l: "limbs",
  arm_r: "limbs",
  leg_l: "limbs",
  leg_r: "limbs",
};

/** Suit part an organ rides with when the model explodes. */
function organPart(o: Organ): string {
  const side = o.side === -1 ? "_r" : "_l";
  switch (o.zoneId) {
    case "head":
      return "head";
    case "chest":
      return "chest";
    case "spine":
      return "spine";
    case "gut":
      return "abdomen";
    case "limbs":
      return (o.shape === "biceps" ? "arm" : "leg") + side;
    default:
      return o.id === "dermis_arm" ? "arm_l" : "abdomen";
  }
}

const PartContext = createContext<PartSpec | null>(null);

/* --------------------------- shared behaviour --------------------------- */

const noRaycast = () => null;
const meshRaycast = THREE.Mesh.prototype.raycast;

/** The pointer ray also hits an organ / beacon behind this surface — suit
 * and skin step aside (no stopPropagation) so the organ gets the click. */
function hitsOrgan(e: ThreeEvent<MouseEvent>) {
  return e.intersections.some((i) => i.object.userData.organId != null);
}

/** Damped 0..1 presence applied to a material every frame: fades opacity,
 * flips transparency / depthWrite as needed, hides the mesh at 0. */
function useFade(
  target: number,
  matRef: RefObject<THREE.Material | null>,
  meshRef: RefObject<THREE.Object3D | null>,
  rate = 6,
) {
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const v = useRef(target);
  useFrame((_, dt) => {
    let next = reduceMotion ? target : THREE.MathUtils.damp(v.current, target, rate, dt);
    if (Math.abs(next - target) < 0.003) next = target;
    v.current = next;
    const m = matRef.current;
    if (m) {
      m.opacity = next;
      const transparent = next < 0.995;
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.needsUpdate = true;
      }
      m.depthWrite = next > 0.6;
    }
    const mesh = meshRef.current;
    if (mesh) mesh.visible = next > 0.004;
  });
  return v;
}

/** Damp a group towards `base + offset(part) · k` (explode / slide-away). */
function useExplodeFollow(
  ref: RefObject<THREE.Group | null>,
  base: Vec3,
  partId: string,
  k: number,
  rate = 4.5,
) {
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const [ox, oy, oz] = EXPLODE_OFFSET[partId] ?? [0, 0, 0];
    const tx = base[0] + ox * k;
    const ty = base[1] + oy * k;
    const tz = base[2] + oz * k;
    if (reduceMotion) {
      g.position.set(tx, ty, tz);
      return;
    }
    g.position.x = THREE.MathUtils.damp(g.position.x, tx, rate, dt);
    g.position.y = THREE.MathUtils.damp(g.position.y, ty, rate, dt);
    g.position.z = THREE.MathUtils.damp(g.position.z, tz, rate, dt);
  });
}

/** Drill state every layer derives its visibility from. */
function useDrill() {
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const wireframe = useViewerStore((s) => s.wireframe);
  const explode = useViewerStore((s) => s.explode);
  return { selectedZoneId, selectedOrganId, wireframe, explode };
}

/* ------------------------------ suit layer ------------------------------ */

interface BodyPartProps extends PartSpec {
  position?: Vec3;
  rotation?: Vec3;
  children: ReactNode;
}

/** Suit part group — explodes along its offset, and slides out a little
 * while its shell fades when another zone is drilled. */
function BodyPart({ partId, zoneId, position, rotation, children }: BodyPartProps) {
  const ref = useRef<THREE.Group>(null);
  const { selectedZoneId, selectedOrganId, explode } = useDrill();
  const zone = PART_ZONE[partId];
  const away = selectedOrganId != null || (selectedZoneId != null && selectedZoneId !== zone);
  useExplodeFollow(ref, position ?? [0, 0, 0], partId, explode + (away ? AWAY : 0));

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <PartContext.Provider value={{ partId, zoneId }}>
        {children}
      </PartContext.Provider>
    </group>
  );
}

/** Suit opacity in the wireframe overview — lines stay readable while the
 * organs inside show through. */
const WIRE_SUIT_OPACITY = 0.14;
const GHOST_SHELL_OPACITY = 0.14;

interface SolidProps {
  zone: BodyZone | undefined;
  geometry: THREE.BufferGeometry;
  baseColor: string;
  finish?: Finish;
  /** Status/overlay tint the shell (false for true-colour pieces). */
  tint?: boolean;
  onMeasure?: (p: Vec3) => void;
}

/** Selectable zone shell inside a PartContext — status/overlay tinted. */
function Solid({ zone, geometry, baseColor, finish = "fabric", tint: tintable = true, onMeasure }: SolidProps) {
  const part = useContext(PartContext);
  const { selectedZoneId, selectedOrganId, wireframe } = useDrill();
  const edges = useViewerStore((s) => s.edges);
  const overlay = useViewerStore((s) => s.overlay);
  const measureMode = useViewerStore((s) => s.measureMode);
  const select = useViewerStore((s) => s.select);
  const focus = useViewerStore((s) => s.focus);

  const isZonePart = part != null && zone != null && zone.partIds.includes(part.partId);
  const selected = isZonePart && selectedZoneId === zone?.id;
  const tint = tintable ? overlayTint(zone, overlay) : null;
  const color = tint ?? (isZonePart && tintable ? STATUS_TINT[zone.status] : baseColor);
  // Drill-down isolation:
  //  depth 0 — full suit (translucent wire in the wireframe overview).
  //  depth 1 (zone selected) — other zones fade out; selected shell ghosts.
  //  depth 2 (organ selected) — every suit shell fades out.
  const drilled = selectedZoneId != null;
  const ghosted = drilled && selected && selectedOrganId == null;
  const hidden = selectedOrganId != null || (drilled && !selected);
  const target = hidden ? 0 : ghosted ? GHOST_SHELL_OPACITY : wireframe ? WIRE_SUIT_OPACITY : 1;

  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFade(target, matRef, meshRef);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitsOrgan(e)) return; // organ / beacon behind the shell takes it
    e.stopPropagation();
    if (e.delta > 4) return; // drag, not click
    if (measureMode) {
      onMeasure?.([e.point.x, e.point.y, e.point.z]);
      return;
    }
    if (!isZonePart || !zone) return;
    select(zone.id);
    focus(zone);
  };

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow={target === 1}
      receiveShadow
      onClick={onClick}
      raycast={hidden || ghosted ? noRaycast : meshRaycast}
    >
      <meshPhysicalMaterial
        ref={matRef}
        {...FINISH[finish]}
        vertexColors={geometry.hasAttribute("color")}
        color={color}
        sheenColor="#ffffff"
        wireframe={wireframe}
        emissive={selected ? ACCENT_EMISSIVE : "#000000"}
        emissiveIntensity={selected ? 1 : 0}
      />
      {/* no edges on the ghosted shell — its segment lines read as a cage
          in front of the anatomy */}
      {(edges || selected) && !ghosted && !hidden && (
        <Edges threshold={32} color={selected ? "#8badfa" : "#3a4048"} />
      )}
    </mesh>
  );
}

/**
 * Detail mesh (bearings, gloves, boots, DCM, hoses…) — true colours, and
 * clicks delegate to its zone's selection so details never swallow
 * pointer events. Details fade out as soon as anything is drilled.
 */
interface AuxProps {
  zone: BodyZone | undefined;
  geometry: THREE.BufferGeometry;
  baseColor?: string;
  finish?: Finish;
  emissive?: string;
  emissiveIntensity?: number;
  onMeasure?: (p: Vec3) => void;
}

function Aux({
  zone,
  geometry,
  baseColor = "#ffffff",
  finish = "hard",
  emissive,
  emissiveIntensity = 1,
  onMeasure,
}: AuxProps) {
  const part = useContext(PartContext);
  const { selectedZoneId, wireframe } = useDrill();
  const select = useViewerStore((s) => s.select);
  const focus = useViewerStore((s) => s.focus);
  const measureMode = useViewerStore((s) => s.measureMode);
  const isZonePart = part != null && zone != null && zone.partIds.includes(part.partId);
  const hidden = selectedZoneId != null;
  const target = hidden ? 0 : wireframe ? WIRE_SUIT_OPACITY : 1;

  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFade(target, matRef, meshRef);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitsOrgan(e)) return;
    e.stopPropagation();
    if (e.delta > 4) return;
    if (measureMode) {
      onMeasure?.([e.point.x, e.point.y, e.point.z]);
      return;
    }
    if (!isZonePart || !zone) return;
    select(zone.id);
    focus(zone);
  };

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      castShadow={target === 1}
      onClick={onClick}
      raycast={hidden ? noRaycast : meshRaycast}
    >
      <meshPhysicalMaterial
        ref={matRef}
        {...FINISH[finish]}
        vertexColors={geometry.hasAttribute("color")}
        color={baseColor}
        wireframe={wireframe}
        emissive={emissive ?? "#000000"}
        emissiveIntensity={emissive ? emissiveIntensity : 0}
      />
    </mesh>
  );
}

/* ------------------------------ skin layer ------------------------------ */

/** Natural tone when nominal; matte, opaque red when the skin itself is
 * the problem (pressure loss, radiation, burns…). */
const SKIN_TONE: Record<TriageLevel, string> = {
  NOMINAL: "#d6a690",
  CAUTION: "#c9826a",
  URGENT: "#a8463c",
  CRITICAL: "#8f302b",
};
const SKIN_MEMBRANE_OPACITY = 0.16;

function SkinMesh({
  segment,
  zone,
  onMeasure,
}: {
  segment: SkinSegment;
  zone: BodyZone | undefined;
  onMeasure?: (p: Vec3) => void;
}) {
  const { selectedZoneId, selectedOrganId, wireframe, explode } = useDrill();
  const select = useViewerStore((s) => s.select);
  const focus = useViewerStore((s) => s.focus);
  const measureMode = useViewerStore((s) => s.measureMode);
  const geometry = useMemo(() => skinGeometry(segment), [segment]);
  const status = zone?.status ?? "NOMINAL";
  const abnormal = status !== "NOMINAL";

  // suit (outer) → skin → organs: skin is the whole body when the skin zone
  // is drilled, a faint membrane around any other drilled zone, and gone in
  // the wireframe overview (suit + organs only) or at organ depth.
  const target =
    wireframe || selectedOrganId != null
      ? 0
      : selectedZoneId === "skin"
        ? 1
        : selectedZoneId != null
          ? abnormal ? SKIN_MEMBRANE_OPACITY * 1.8 : SKIN_MEMBRANE_OPACITY
          : 0;

  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFade(target, matRef, meshRef, 5);
  useExplodeFollow(groupRef, [0, 0, 0], SKIN_SEGMENT_PART[segment], explode);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (hitsOrgan(e)) return;
    e.stopPropagation();
    if (e.delta > 4 || !zone) return;
    if (measureMode) {
      onMeasure?.([e.point.x, e.point.y, e.point.z]);
      return;
    }
    if (selectedZoneId === "skin") return;
    select("skin");
    focus(zone);
  };

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        castShadow={target === 1}
        receiveShadow
        onClick={onClick}
        raycast={target > 0 ? meshRaycast : noRaycast}
      >
        <meshPhysicalMaterial
          ref={matRef}
          vertexColors
          color={SKIN_TONE[status]}
          roughness={abnormal ? 0.9 : 0.6}
          metalness={0}
          sheen={abnormal ? 0 : 0.4}
          sheenRoughness={0.6}
          sheenColor="#ffd8c8"
          clearcoat={abnormal ? 0 : 0.12}
          clearcoatRoughness={0.6}
        />
      </mesh>
    </group>
  );
}

function SkinLayer({ zones, onMeasure }: { zones: BodyZone[]; onMeasure?: (p: Vec3) => void }) {
  const zone = zones.find((z) => z.id === "skin");
  return (
    <>
      {SKIN_SEGMENTS.map((s) => (
        <SkinMesh key={s} segment={s} zone={zone} onMeasure={onMeasure} />
      ))}
    </>
  );
}

/* --------------------------- organ drill layer --------------------------- */

/** Triage-status rim glow (fresnel) — the organ's silhouette reads its
 * own status at a glance; selection pushes it to the accent. */
const ORGAN_RIM: Record<TriageLevel, string> = {
  NOMINAL: "#6f8fd0",
  CAUTION: "#e0bf6a",
  URGENT: "#f08a4f",
  CRITICAL: "#ff4f45",
};
const RIM_SELECTED = "#9db8ff";

const RIM_UNIFORMS = "uniform vec3 uRimColor;\nuniform float uRimStrength;";
const RIM_CHUNK = `
  {
    float rimF = 1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
    totalEmissiveRadiance += uRimColor * pow(rimF, 2.6) * uRimStrength;
  }`;

/** Organs with ≤ this many siblings keep their labels pinned; denser zones
 * (gut) show a label on hover only, so the stage doesn't drown in chips. */
const PINNED_LABEL_MAX = 4;

function organVital(organ: Organ, key: string, fallback: number) {
  return organ.vitals.find((v) => v.key === key)?.value ?? fallback;
}

/** Lub-dub contraction envelope, 0..1, for a beat phase f ∈ [0,1). */
function beat(f: number) {
  return Math.exp(-(((f - 0.08) / 0.045) ** 2)) + 0.6 * Math.exp(-(((f - 0.3) / 0.05) ** 2));
}

/** Alarm pulse 0..1 — faster as severity rises. */
function alarm(t: number, status: TriageLevel) {
  const speed = status === "CRITICAL" ? 6 : status === "URGENT" ? 4.5 : 3;
  return 0.5 + 0.5 * Math.sin(t * speed);
}

function useCursor(hovered: boolean) {
  useEffect(() => {
    if (!hovered) return;
    document.body.style.cursor = "pointer";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
}

function OrganMesh({
  organ,
  status,
  present,
  pinnedLabel,
}: {
  organ: Organ;
  status: TriageLevel;
  present: boolean;
  pinnedLabel: boolean;
}) {
  const { selectedOrganId, explode } = useDrill();
  const focusOrgan = useViewerStore((s) => s.focusOrgan);
  const edges = useViewerStore((s) => s.edges);
  const measureMode = useViewerStore((s) => s.measureMode);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const selected = selectedOrganId === organ.id;
  const abnormal = status !== "NOMINAL";
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && present);

  const geometry = useMemo(
    () => organGeometry(organ.shape, organ.side ?? 1),
    [organ.shape, organ.side],
  );
  const labelY = (geometry.boundingBox?.max.y ?? 0.05) + 0.014;

  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const vis = useFade(present ? 1 : 0, matRef, meshRef, 5);
  useExplodeFollow(groupRef, organ.position, organPart(organ), explode);

  const rim = useRef({
    uRimColor: { value: new THREE.Color(ORGAN_RIM.NOMINAL) },
    uRimStrength: { value: 0.5 },
  });

  const onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, rim.current);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${RIM_UNIFORMS}`)
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>${RIM_CHUNK}`,
      );
  };

  const hr = organVital(organ, "heart_rate_bpm", 70);
  const rr = organVital(organ, "resp_rate", 13);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const v = vis.current;
    const pulse = reduceMotion ? 0.6 : alarm(t, status);

    const u = rim.current;
    u.uRimColor.value.set(selected && !abnormal ? RIM_SELECTED : ORGAN_RIM[status]);
    const rimTarget = abnormal ? 0.9 + 0.8 * pulse : selected ? 1.25 : hovered ? 1.0 : 0.55;
    u.uRimStrength.value = rimTarget * v;

    // abnormal organs glow from the inside — "click me" at a glance
    // softer once the organ is isolated so its anatomy stays readable
    const glow = selected ? 0.45 : 1;
    const m = matRef.current;
    if (m) m.emissiveIntensity = abnormal ? (0.25 + 0.55 * pulse) * v * glow : 0;
    const h = haloMat.current;
    if (h) h.opacity = abnormal ? (0.1 + 0.22 * pulse) * v * glow : 0;
    if (haloRef.current) haloRef.current.visible = abnormal && v > 0.01;

    const mesh = meshRef.current;
    if (!mesh) return;
    const grow = 0.9 + 0.1 * v; // settle in while fading
    if (reduceMotion || !organ.anim) {
      mesh.scale.setScalar(grow);
      return;
    }
    if (organ.anim === "heartbeat") {
      const k = 1 - 0.045 * beat(((t * hr) / 60) % 1);
      mesh.scale.set(k * grow, (k * 0.985 + 0.015) * grow, k * grow);
    } else if (organ.anim === "breath") {
      const b = 0.5 - 0.5 * Math.cos((t * rr * Math.PI * 2) / 60);
      mesh.scale.set((1 + 0.022 * b) * grow, (1 + 0.016 * b) * grow, (1 + 0.026 * b) * grow);
    } else {
      const p = Math.sin(t * 1.4) * 0.006;
      mesh.scale.set((1 + p) * grow, (1 - p * 0.5) * grow, (1 + p) * grow);
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4 || measureMode) return;
    focusOrgan(organ);
  };

  const showLabel = present && !selected && (pinnedLabel || hovered);

  return (
    <group ref={groupRef} position={organ.position} rotation={organ.rotation}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        userData={{ organId: organ.id }}
        castShadow={present}
        receiveShadow
        onClick={onClick}
        raycast={present ? meshRaycast : noRaycast}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <meshPhysicalMaterial
          ref={matRef}
          vertexColors
          color="#ffffff"
          roughness={0.46}
          metalness={0}
          clearcoat={0.55}
          clearcoatRoughness={0.38}
          sheen={0.35}
          sheenRoughness={0.6}
          sheenColor="#ffd9cf"
          emissive={ORGAN_RIM[status]}
          emissiveIntensity={0}
          onBeforeCompile={onBeforeCompile}
          customProgramCacheKey={() => "organ-rim-v1"}
        />
        {edges && present && <Edges threshold={35} color="#454c56" />}
        {/* glow shell hugging the organ's own silhouette (inverted hull),
            child of the mesh so it beats/breathes with it */}
        {abnormal && (
          <mesh ref={haloRef} geometry={geometry} scale={1.07} raycast={noRaycast} renderOrder={3}>
            <meshBasicMaterial
              ref={haloMat}
              color={ORGAN_RIM[status]}
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.BackSide}
            />
          </mesh>
        )}
      </mesh>
      {/* label: pinned in sparse zones, hover-only in dense ones; hidden once
          focused (tooltip + breadcrumb name it). Fixed CSS size — no
          distanceFactor, so it never balloons at close focus. */}
      {showLabel && (
        <Html
          position={[0, labelY, 0]}
          center
          wrapperClass="organ-label"
          style={{ pointerEvents: "none" }}
        >
          <div className="organ-label-chip">
            {abnormal && <span className={`organ-label-dot ${status.toLowerCase()}`} />}
            {organ.name}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Off-nominal organ seen from OUTSIDE the suit (no zone drilled): a pulsing
 * glow drawn through the suit (depthTest off). Clicking it drills straight
 * to the organ; the suit steps aside because the beacon carries organId.
 */
function OrganBeacon({ organ, status, visible }: { organ: Organ; status: TriageLevel; visible: boolean }) {
  const { explode } = useDrill();
  const focusOrgan = useViewerStore((s) => s.focusOrgan);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && visible);
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const vis = useFade(visible ? 1 : 0, coreMat, coreRef, 5);
  useExplodeFollow(groupRef, organ.position, organPart(organ), explode);

  useFrame(({ clock }) => {
    const p = reduceMotion ? 0.6 : alarm(clock.elapsedTime, status);
    const v = vis.current;
    if (coreMat.current) coreMat.current.opacity = (0.55 + 0.35 * p) * v;
    if (haloMat.current) haloMat.current.opacity = (0.12 + 0.28 * p) * v;
    if (haloRef.current) {
      haloRef.current.visible = v > 0.01;
      haloRef.current.scale.setScalar((hovered ? 1.3 : 1) * (0.85 + 0.3 * p));
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    focusOrgan(organ);
  };

  const color = ORGAN_RIM[status];
  return (
    <group ref={groupRef} position={organ.position}>
      <mesh
        ref={coreRef}
        userData={{ organId: organ.id }}
        renderOrder={10}
        onClick={onClick}
        raycast={visible ? meshRaycast : noRaycast}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.03, 20, 14]} />
        <meshBasicMaterial ref={coreMat} color={color} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={haloRef} raycast={noRaycast} renderOrder={10}>
        <sphereGeometry args={[0.065, 20, 14]} />
        <meshBasicMaterial ref={haloMat} color={color} transparent opacity={0} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {hovered && visible && (
        <Html position={[0, 0.08, 0]} center wrapperClass="organ-label" style={{ pointerEvents: "none" }}>
          <div className="organ-label-chip">
            <span className={`organ-label-dot ${status.toLowerCase()}`} />
            {organ.name} · {status}
          </div>
        </Html>
      )}
    </group>
  );
}

/** Translucent ribcage/sternum/clavicles — orientation context for the
 * chest drill. Never raycastable, so it can't steal organ clicks. */
function RibcageContext({ visible }: { visible: boolean }) {
  const { explode } = useDrill();
  const geometry = useMemo(() => ribcageGeometry(), []);
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFade(visible ? 0.22 : 0, matRef, meshRef, 5);
  useExplodeFollow(groupRef, [0, 0, 0], "chest", explode);
  return (
    <group ref={groupRef}>
      <mesh ref={meshRef} geometry={geometry} raycast={noRaycast} renderOrder={2}>
        <meshStandardMaterial ref={matRef} vertexColors color="#ffffff" roughness={0.6} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Organ meshes of one zone. Mounted on first use and kept afterwards so
 * later drills fade in/out instead of rebuilding geometry. */
function ZoneOrgans({
  organs,
  zone,
  active,
  presentIds,
  pinned,
}: {
  organs: Organ[];
  zone: BodyZone | undefined;
  active: boolean;
  presentIds: Set<string>;
  pinned: boolean;
}) {
  const [armed, setArmed] = useState(active);
  if (active && !armed) setArmed(true);
  if (!armed) return null;
  return (
    <>
      {organs.map((o) => (
        <OrganMesh
          key={o.id}
          organ={o}
          status={organStatus(o, zone)}
          present={presentIds.has(o.id)}
          pinnedLabel={pinned}
        />
      ))}
    </>
  );
}

const ZONE_IDS: ZoneId[] = ["head", "chest", "spine", "limbs", "gut", "skin"];

function OrganLayer({ zones }: { zones: BodyZone[] }) {
  const { selectedZoneId, selectedOrganId, wireframe } = useDrill();

  // present organs per drill state:
  //  organ depth — only that organ · zone depth — that zone's organs ·
  //  wireframe overview — every internal organ (skin samples excluded)
  const presentIds = new Set<string>(
    ORGANS.filter((o) =>
      selectedOrganId != null
        ? o.id === selectedOrganId
        : selectedZoneId != null
          ? o.zoneId === selectedZoneId
          : wireframe && o.zoneId !== "skin",
    ).map((o) => o.id),
  );
  const zoneOf = (id: ZoneId) => zones.find((z) => z.id === id);
  const beaconsOn = selectedZoneId == null && !wireframe;

  return (
    <>
      <RibcageContext visible={selectedZoneId === "chest" && selectedOrganId == null} />
      {ZONE_IDS.map((zid) => {
        const organs = organsOf(zid);
        const active = organs.some((o) => presentIds.has(o.id));
        return (
          <ZoneOrgans
            key={zid}
            organs={organs}
            zone={zoneOf(zid)}
            active={active}
            presentIds={presentIds}
            pinned={selectedZoneId === zid && organs.length <= PINNED_LABEL_MAX}
          />
        );
      })}
      {ORGANS.map((o) => {
        const status = organStatus(o, zoneOf(o.zoneId));
        if (status === "NOMINAL") return null;
        return <OrganBeacon key={o.id} organ={o} status={status} visible={beaconsOn} />;
      })}
    </>
  );
}

/* ------------------------------ the model ------------------------------ */

interface AstronautModelProps {
  zones: BodyZone[];
  onMeasure?: (p: Vec3) => void;
  scale?: number;
  /** Skin + organ layers (off for lightweight gallery previews; status
   * beacons still render so the roster shows what's wrong). */
  anatomy?: boolean;
}

const SIDES = [1, -1] as const;

export function AstronautModel({ zones, onMeasure, scale = 1, anatomy = true }: AstronautModelProps) {
  const zoneById = useMemo(() => {
    const map = new Map<ZoneId, BodyZone>();
    zones.forEach((z) => map.set(z.id, z));
    return (partId: string) => map.get(PART_ZONE[partId]);
  }, [zones]);

  // pre-build organ meshes in idle time so the first drill doesn't stall
  useEffect(() => (anatomy ? warmOrganCache(ORGANS) : undefined), [anatomy]);

  const g = suitGeometry;
  const m = onMeasure;
  const chestStatus = zoneById("chest")?.status ?? "NOMINAL";

  return (
    <group scale={scale} position={MODEL_GROUP_OFFSET}>
      {/* helmet (EVVA shell + lamps) · comm cap · gold visor · neck bearing */}
      <BodyPart partId="helmet" zoneId="head" position={[0, 1.52, 0]}>
        <Solid zone={zoneById("helmet")} geometry={g("helmet")} baseColor={SUIT_WHITE} finish="hard" onMeasure={m} />
        <Aux zone={zoneById("helmet")} geometry={g("helmetLamps")} finish="metal" onMeasure={m} />
        <Aux zone={zoneById("helmet")} geometry={g("helmetLenses")} emissive="#e4ecff" emissiveIntensity={1.6} onMeasure={m} />
      </BodyPart>
      <BodyPart partId="head" zoneId="head" position={[0, 1.5, 0]}>
        <Solid zone={zoneById("head")} geometry={g("commCap")} baseColor="#ffffff" tint={false} onMeasure={m} />
      </BodyPart>
      <BodyPart partId="visor" zoneId="head" position={[0, 1.52, 0]}>
        <Solid zone={zoneById("visor")} geometry={g("visor")} baseColor="#ffffff" tint={false} finish="visor" onMeasure={m} />
      </BodyPart>
      <BodyPart partId="collar" zoneId="head" position={[0, 1.37, 0]}>
        <Solid zone={zoneById("collar")} geometry={g("neckRing")} baseColor="#ffffff" tint={false} finish="metal" onMeasure={m} />
      </BodyPart>

      {/* hard upper torso + display & control module */}
      <BodyPart partId="chest" zoneId="chest" position={[0, 1.17, 0]}>
        <Solid zone={zoneById("chest")} geometry={g("hut")} baseColor={SUIT_WHITE} finish="hard" onMeasure={m} />
        <Aux zone={zoneById("chest")} geometry={g("dcm")} onMeasure={m} />
        <Aux zone={zoneById("chest")} geometry={g("dcmScreen")} emissive={SCREEN_GLOW[chestStatus]} emissiveIntensity={1.2} onMeasure={m} />
      </BodyPart>

      {/* lower torso / brief + waist bearing */}
      <BodyPart partId="abdomen" zoneId="gut" position={[0, 0.92, 0]}>
        <Solid zone={zoneById("abdomen")} geometry={g("lowerTorso")} baseColor={SUIT_WHITE} onMeasure={m} />
        <Aux zone={zoneById("abdomen")} geometry={g("waistRing")} finish="metal" onMeasure={m} />
      </BodyPart>

      {/* dorsal mounting rail (spine zone) */}
      <BodyPart partId="spine" zoneId="spine" position={[0, 1.13, -0.17]}>
        <Solid zone={zoneById("spine")} geometry={g("dorsalRail")} baseColor={SUIT_WHITE} finish="hard" onMeasure={m} />
      </BodyPart>

      {/* PLSS backpack + SOP, vents, antenna, umbilicals */}
      <BodyPart partId="plss" zoneId="skin" position={[0, 1.18, -0.285]}>
        <Solid zone={zoneById("plss")} geometry={g("plss")} baseColor={SUIT_WHITE} finish="hard" onMeasure={m} />
        <Aux zone={zoneById("plss")} geometry={g("plssDetails")} onMeasure={m} />
        <Aux zone={zoneById("plss")} geometry={g("hoses")} finish="rubber" onMeasure={m} />
      </BodyPart>

      {/* arms hang from the shoulder bearings (data/suit-rig.ts) */}
      {SIDES.map((side) => {
        const partId = side === 1 ? "arm_l" : "arm_r";
        const { position, rotation } = armTransform(side);
        return (
          <BodyPart key={partId} partId={partId} zoneId="limbs" position={position} rotation={rotation}>
            <Solid zone={zoneById(partId)} geometry={g("arm")} baseColor={SUIT_WHITE} onMeasure={m} />
            <Aux zone={zoneById(partId)} geometry={g("armBearings", side)} finish="metal" onMeasure={m} />
            <Aux zone={zoneById(partId)} geometry={g("glove", side)} finish="fabric" onMeasure={m} />
            <Aux zone={zoneById(partId)} geometry={g("armPatch", side)} onMeasure={m} />
          </BodyPart>
        );
      })}

      {/* legs: hip → convolute knee → boots on the floor (model y = 0) */}
      {SIDES.map((side) => {
        const partId = side === 1 ? "leg_l" : "leg_r";
        return (
          <BodyPart key={partId} partId={partId} zoneId="limbs" position={[side * HIP_X, 0, 0]}>
            <Solid zone={zoneById(partId)} geometry={g("leg")} baseColor={SUIT_WHITE} onMeasure={m} />
            <Aux zone={zoneById(partId)} geometry={g("boot")} finish="fabric" onMeasure={m} />
            <Aux zone={zoneById(partId)} geometry={g("sole")} finish="rubber" onMeasure={m} />
          </BodyPart>
        );
      })}

      {/* skin between suit and organs, then the organ drill layer */}
      {anatomy && <SkinLayer zones={zones} onMeasure={m} />}
      {anatomy ? (
        <OrganLayer zones={zones} />
      ) : (
        ORGANS.map((o) => {
          const status = organStatus(o, zones.find((z) => z.id === o.zoneId));
          return status === "NOMINAL" ? null : <OrganBeacon key={o.id} organ={o} status={status} visible />;
        })
      )}
    </group>
  );
}
