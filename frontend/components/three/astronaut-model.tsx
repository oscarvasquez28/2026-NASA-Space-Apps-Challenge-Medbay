"use client";

/**
 * Procedural EVA-suit astronaut — capsule/sphere primitives only.
 * Every mesh belongs to a `partId`; each partId belongs to a BodyZone.
 * Selection, status tinting, explode offsets, section clipping, wireframe
 * and edges all flow from the per-instance viewer store.
 */

import { Edges, Html } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import * as THREE from "three";

import { useViewerStore, type OverlayMode } from "@/stores/viewer-store";
import { organsOf } from "@/data/organs";
import { MODEL_GROUP_OFFSET } from "@/types/health";
import type {
  BodyZone,
  Organ,
  TriageLevel,
  Vec3,
  ZoneId,
} from "@/types/health";

/* ------------------------- materials / colors ------------------------- */

const SUIT_BASE = "#9ea8b5";
const HELMET = "#b9c2cf";
const INNER = "#3d434d";
const VISOR = "#1d232e";
const ACCENT_EMISSIVE = "#31456b";

const STATUS_TINT: Record<TriageLevel, string> = {
  NOMINAL: SUIT_BASE,
  CAUTION: "#b3a58a",
  URGENT: "#bb8d72",
  CRITICAL: "#b47c7c",
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
  arm_l: [-0.38, 0.04, 0],
  arm_r: [0.38, 0.04, 0],
  leg_l: [-0.12, -0.28, 0],
  leg_r: [0.12, -0.28, 0],
};

interface PartSpec {
  partId: string;
  zoneId: ZoneId;
}

export const PART_ZONE: Record<string, ZoneId> = {
  helmet: "head",
  head: "head",
  visor: "skin",
  collar: "skin",
  chest: "chest",
  abdomen: "gut",
  spine: "spine",
  plss: "skin",
  arm_l: "limbs",
  arm_r: "limbs",
  leg_l: "limbs",
  leg_r: "limbs",
};

const PartContext = createContext<PartSpec | null>(null);

/* ------------------------------ geometry ------------------------------ */

interface BodyPartProps extends PartSpec {
  position?: Vec3;
  rotation?: Vec3;
  children: ReactNode;
}

/** Group that animates explode offset for a partId. */
function BodyPart({ partId, zoneId, position, rotation, children }: BodyPartProps) {
  const ref = useRef<THREE.Group>(null);
  const explode = useViewerStore((s) => s.explode);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const [ox, oy, oz] = EXPLODE_OFFSET[partId] ?? [0, 0, 0];
    const [bx, by, bz] = position ?? [0, 0, 0];
    g.position.x = THREE.MathUtils.damp(g.position.x, bx + ox * explode, 8, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, by + oy * explode, 8, delta);
    g.position.z = THREE.MathUtils.damp(g.position.z, bz + oz * explode, 8, delta);
  });

  return (
    <group ref={ref} position={position} rotation={rotation}>
      <PartContext.Provider value={{ partId, zoneId }}>
        {children}
      </PartContext.Provider>
    </group>
  );
}

interface SolidProps {
  zone: BodyZone | undefined;
  baseColor: string;
  roughness?: number;
  metalness?: number;
  transparent?: boolean;
  opacity?: number;
  children: ReactNode;
  onMeasure?: (p: Vec3) => void;
}

/** Single mesh inside a PartContext — selectable + status/overlay tinted. */
function Solid({ zone, baseColor, roughness = 0.72, metalness = 0.06, transparent, opacity, children, onMeasure }: SolidProps) {
  const part = useContext(PartContext);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const wireframe = useViewerStore((s) => s.wireframe);
  const edges = useViewerStore((s) => s.edges);
  const overlay = useViewerStore((s) => s.overlay);
  const measureMode = useViewerStore((s) => s.measureMode);
  const select = useViewerStore((s) => s.select);
  const focus = useViewerStore((s) => s.focus);

  const isZonePart = part != null && zone != null && zone.partIds.includes(part.partId);
  const selected = isZonePart && selectedZoneId === zone?.id;
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const tint = overlayTint(zone, overlay);
  const color = tint ?? (isZonePart ? STATUS_TINT[zone.status] : baseColor);
  // Drill-down isolation:
  //  depth 0 — full suit opaque.
  //  depth 1 (zone selected) — other zones hidden; selected shell ghosts.
  //  depth 2 (organ selected) — every suit shell disappears entirely.
  const drilled = selectedZoneId != null;
  const ghosted = drilled && selected && selectedOrganId == null;
  // Unmount hidden parts — visible={false} still intercepts raycast hits,
  // so invisible shells would steal clicks meant for organs/other zones.
  const hidden = selectedOrganId != null || (drilled && !selected);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (ghosted) return; // transparent shell — let clicks fall through to organs
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

  if (hidden) return null;

  return (
    <mesh castShadow receiveShadow onClick={onClick}>
      {children}
      <meshStandardMaterial
        key={ghosted ? "ghost" : "solid"}
        color={color}
        roughness={roughness}
        metalness={metalness}
        transparent={transparent || ghosted}
        opacity={ghosted ? 0.15 : (opacity ?? 1)}
        depthWrite={!ghosted}
        wireframe={wireframe}
        emissive={selected ? ACCENT_EMISSIVE : "#000000"}
        emissiveIntensity={selected ? 1 : 0}
      />
      {(edges || selected) && (
        <Edges color={selected ? "#8badfa" : "#3a4048"} />
      )}
    </mesh>
  );
}

/**
 * Decorative accessory mesh — delegates clicks to its zone's selection so
 * chestpack/belt/antenna/gloves/boots don't swallow pointer events.
 */
interface AuxProps {
  zone: BodyZone | undefined;
  baseColor: string;
  roughness?: number;
  metalness?: number;
  position?: Vec3;
  rotation?: Vec3;
  children: ReactNode;
  onMeasure?: (p: Vec3) => void;
}

function Aux({
  zone,
  baseColor,
  roughness = 0.6,
  metalness = 0.1,
  position,
  rotation,
  children,
  onMeasure,
}: AuxProps) {
  const part = useContext(PartContext);
  const select = useViewerStore((s) => s.select);
  const focus = useViewerStore((s) => s.focus);
  const measureMode = useViewerStore((s) => s.measureMode);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const isZonePart = part != null && zone != null && zone.partIds.includes(part.partId);
  const drilled = selectedZoneId != null;
  const selected = isZonePart && selectedZoneId === zone?.id;
  const ghosted = drilled && selected && selectedOrganId == null;
  const hidden = selectedOrganId != null || (drilled && !selected);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (ghosted) return; // let clicks fall through to organs
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

  if (hidden) return null;

  return (
    <mesh
      castShadow
      position={position}
      rotation={rotation}
      onClick={onClick}
    >
      {children}
      <meshStandardMaterial
        key={ghosted ? "ghost" : "solid"}
        color={baseColor}
        roughness={roughness}
        metalness={metalness}
        transparent={ghosted}
        opacity={ghosted ? 0.1 : 1}
        depthWrite={!ghosted}
      />
    </mesh>
  );
}

/* --------------------------- organ drill layer --------------------------- */

/** Muted tissue palette per organ id (lab aesthetic, not clinical). */
const ORGAN_COLOR: Record<string, string> = {
  brain: "#8d8396",
  eye_l: "#9fb0c4",
  eye_r: "#9fb0c4",
  heart: "#a05f5f",
  lung_l: "#7d8ba0",
  lung_r: "#7d8ba0",
  vert_c: "#9aa3ad",
  vert_t: "#9aa3ad",
  vert_l: "#9aa3ad",
  bicep_l: "#9a6a62",
  bicep_r: "#9a6a62",
  femur_l: "#b0b6bd",
  femur_r: "#b0b6bd",
  stomach: "#9c8a6a",
  liver: "#8a6a5d",
  gut_loop: "#93766e",
  dermis: "#a08a80",
  dermis_arm: "#a08a80",
};

/** Status glow the organ layer breathes with (parent-zone triage level). */
const ORGAN_EMISSIVE: Record<TriageLevel, string> = {
  NOMINAL: "#243044",
  CAUTION: "#5d4d24",
  URGENT: "#6e3a24",
  CRITICAL: "#6e2424",
};

/** Stylized organs render ~30% larger than anatomy for readability. */
const ORGAN_SCALE = 1.3;

function OrganMesh({ organ, status }: { organ: Organ; status: TriageLevel }) {
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const focusOrgan = useViewerStore((s) => s.focusOrgan);
  const wireframe = useViewerStore((s) => s.wireframe);
  const edges = useViewerStore((s) => s.edges);
  const measureMode = useViewerStore((s) => s.measureMode);
  const selected = selectedOrganId === organ.id;

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  // Slow "vital" pulse — the heart beats faster, everything breathes.
  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;
    const speed = organ.id === "heart" ? 6 : 2;
    m.emissiveIntensity =
      (selected ? 1.1 : 0.7) +
      Math.sin(clock.elapsedTime * speed) * (selected ? 0.25 : 0.15);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4 || measureMode) return;
    focusOrgan(organ);
  };

  const { kind, args } = organ.geo;
  const scale = organ.scale
    ? (organ.scale.map((v) => v * ORGAN_SCALE) as Vec3)
    : ORGAN_SCALE;
  return (
    <mesh
      castShadow
      position={organ.position}
      rotation={organ.rotation}
      scale={scale}
      onClick={onClick}
    >
      {kind === "sphere" && (
        <sphereGeometry args={[args[0], args[1] ?? 16, args[2] ?? 12]} />
      )}
      {kind === "capsule" && (
        <capsuleGeometry
          args={[args[0], args[1], args[2] ?? 4, args[3] ?? 10]}
        />
      )}
      {kind === "cylinder" && (
        <cylinderGeometry
          args={[args[0], args[1] ?? args[0], args[2] ?? 0.05, args[3] ?? 12]}
        />
      )}
      {kind === "torus" && (
        <torusGeometry
          args={[args[0], args[1] ?? 0.015, args[2] ?? 8, args[3] ?? 20]}
        />
      )}
      <meshStandardMaterial
        ref={matRef}
        color={ORGAN_COLOR[organ.id] ?? "#8f7f82"}
        roughness={0.5}
        metalness={0.05}
        wireframe={wireframe}
        emissive={selected ? "#8badfa" : ORGAN_EMISSIVE[status]}
        emissiveIntensity={0.7}
      />
      {(edges || selected) && (
        <Edges color={selected ? "#8badfa" : "#454c56"} />
      )}
      {/* discovery label at zone level only — hidden once the organ is
          focused (tooltip + breadcrumb already name it, and an Html label
          would blow up at close focus distance) */}
      {!selected && (
        <Html
          position={[0, 0.12, 0]}
          center
          wrapperClass="organ-label"
          style={{ pointerEvents: "none" }}
        >
          <div className="organ-label-chip">{organ.name}</div>
        </Html>
      )}
    </mesh>
  );
}

/** Organs of the selected zone — hidden while the suit explodes; once an
 * organ is focused its siblings disappear (isolated organ view). */
function OrganLayer({ zones }: { zones: BodyZone[] }) {
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const explode = useViewerStore((s) => s.explode);
  if (!selectedZoneId || explode > 0.05) return null;
  const zone = zones.find((z) => z.id === selectedZoneId);
  if (!zone) return null;
  return organsOf(selectedZoneId)
    .filter((o) => selectedOrganId == null || o.id === selectedOrganId)
    .map((o) => <OrganMesh key={o.id} organ={o} status={zone.status} />);
}

/* ------------------------------ the model ------------------------------ */

interface AstronautModelProps {
  zones: BodyZone[];
  onMeasure?: (p: Vec3) => void;
  scale?: number;
}

export function AstronautModel({ zones, onMeasure, scale = 1 }: AstronautModelProps) {
  const zoneById = useMemo(() => {
    const map = new Map<ZoneId, BodyZone>();
    zones.forEach((z) => map.set(z.id, z));
    return (partId: string) => map.get(PART_ZONE[partId]);
  }, [zones]);

  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} scale={scale} position={MODEL_GROUP_OFFSET}>
      {/* helmet + visor + head */}
      <BodyPart partId="helmet" zoneId="head" position={[0, 1.52, 0]}>
        <Solid zone={zoneById("helmet")} baseColor={HELMET} transparent opacity={0.92} onMeasure={onMeasure}>
          <sphereGeometry args={[0.17, 32, 24]} />
        </Solid>
      </BodyPart>
      <BodyPart partId="head" zoneId="head" position={[0, 1.5, 0]}>
        <Solid zone={zoneById("head")} baseColor={INNER} roughness={0.9} onMeasure={onMeasure}>
          <sphereGeometry args={[0.105, 24, 18]} />
        </Solid>
      </BodyPart>
      <BodyPart partId="visor" zoneId="skin" position={[0, 1.52, 0.1]}>
        <Solid zone={zoneById("visor")} baseColor={VISOR} roughness={0.18} metalness={0.85} onMeasure={onMeasure}>
          <sphereGeometry args={[0.115, 24, 18]} />
        </Solid>
      </BodyPart>
      <BodyPart partId="collar" zoneId="skin" position={[0, 1.365, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Solid zone={zoneById("collar")} baseColor="#8b95a3" onMeasure={onMeasure}>
          <torusGeometry args={[0.1, 0.028, 12, 28]} />
        </Solid>
      </BodyPart>

      {/* torso */}
      <BodyPart partId="chest" zoneId="chest" position={[0, 1.17, 0]}>
        <Solid zone={zoneById("chest")} baseColor={SUIT_BASE} onMeasure={onMeasure}>
          <capsuleGeometry args={[0.165, 0.22, 8, 20]} />
        </Solid>
        {/* chest control pack (same zone) */}
        <Aux zone={zoneById("chest")} baseColor="#7d8794" roughness={0.5} metalness={0.3} position={[0, 0.03, 0.17]} onMeasure={onMeasure}>
          <boxGeometry args={[0.16, 0.14, 0.05]} />
        </Aux>
      </BodyPart>
      <BodyPart partId="abdomen" zoneId="gut" position={[0, 0.93, 0]}>
        <Solid zone={zoneById("abdomen")} baseColor="#98a1ae" onMeasure={onMeasure}>
          <capsuleGeometry args={[0.14, 0.14, 8, 20]} />
        </Solid>
        <Aux zone={zoneById("abdomen")} baseColor="#7d8794" position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]} onMeasure={onMeasure}>
          <torusGeometry args={[0.135, 0.026, 10, 24]} />
        </Aux>
      </BodyPart>
      <BodyPart partId="spine" zoneId="spine" position={[0, 1.13, -0.16]}>
        <Solid zone={zoneById("spine")} baseColor="#7d8794" roughness={0.55} onMeasure={onMeasure}>
          <capsuleGeometry args={[0.045, 0.36, 6, 12]} />
        </Solid>
      </BodyPart>
      <BodyPart partId="plss" zoneId="skin" position={[0, 1.18, -0.31]}>
        <Solid zone={zoneById("plss")} baseColor="#8b95a3" roughness={0.5} metalness={0.25} onMeasure={onMeasure}>
          <boxGeometry args={[0.3, 0.44, 0.15]} />
        </Solid>
        <Aux zone={zoneById("plss")} baseColor="#5d6672" metalness={0.6} roughness={0.4} position={[0.1, 0.3, -0.02]} onMeasure={onMeasure}>
          <cylinderGeometry args={[0.006, 0.006, 0.16, 8]} />
        </Aux>
      </BodyPart>

      {/* arms */}
      <BodyPart partId="arm_l" zoneId="limbs" position={[-0.25, 1.1, 0]} rotation={[0, 0, 0.28]}>
        <Solid zone={zoneById("arm_l")} baseColor={SUIT_BASE} onMeasure={onMeasure}>
          <capsuleGeometry args={[0.052, 0.4, 6, 14]} />
        </Solid>
        <Aux zone={zoneById("arm_l")} baseColor="#8b95a3" roughness={0.7} position={[0, -0.27, 0]} onMeasure={onMeasure}>
          <sphereGeometry args={[0.055, 14, 10]} />
        </Aux>
      </BodyPart>
      <BodyPart partId="arm_r" zoneId="limbs" position={[0.25, 1.1, 0]} rotation={[0, 0, -0.28]}>
        <Solid zone={zoneById("arm_r")} baseColor={SUIT_BASE} onMeasure={onMeasure}>
          <capsuleGeometry args={[0.052, 0.4, 6, 14]} />
        </Solid>
        <Aux zone={zoneById("arm_r")} baseColor="#8b95a3" roughness={0.7} position={[0, -0.27, 0]} onMeasure={onMeasure}>
          <sphereGeometry args={[0.055, 14, 10]} />
        </Aux>
      </BodyPart>

      {/* legs */}
      <BodyPart partId="leg_l" zoneId="limbs" position={[-0.09, 0.5, 0]}>
        <Solid zone={zoneById("leg_l")} baseColor="#98a1ae" onMeasure={onMeasure}>
          <capsuleGeometry args={[0.065, 0.5, 6, 14]} />
        </Solid>
        <Aux zone={zoneById("leg_l")} baseColor="#7d8794" position={[0, -0.33, 0.03]} onMeasure={onMeasure}>
          <boxGeometry args={[0.11, 0.07, 0.17]} />
        </Aux>
      </BodyPart>
      <BodyPart partId="leg_r" zoneId="limbs" position={[0.09, 0.5, 0]}>
        <Solid zone={zoneById("leg_r")} baseColor="#98a1ae" onMeasure={onMeasure}>
          <capsuleGeometry args={[0.065, 0.5, 6, 14]} />
        </Solid>
        <Aux zone={zoneById("leg_r")} baseColor="#7d8794" position={[0, -0.33, 0.03]} onMeasure={onMeasure}>
          <boxGeometry args={[0.11, 0.07, 0.17]} />
        </Aux>
      </BodyPart>

      {/* drill-down anatomy — appears once a zone is selected */}
      <OrganLayer zones={zones} />
    </group>
  );
}
