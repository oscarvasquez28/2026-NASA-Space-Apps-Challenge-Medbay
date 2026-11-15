"use client";

/**
 * CanvasScene — the actual R3F canvas (loaded via dynamic ssr:false).
 * Studio lighting, infinite technical grid, CameraControls with focus /
 * preset / reset rig, measure tool, section clipping plane.
 */

import {
  CameraControls,
  ContactShadows,
  Environment,
  Grid,
  Html,
  Lightformer,
  Line,
} from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import CameraControlsImpl from "camera-controls";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { useAppStore } from "@/stores/app-store";
import {
  useViewerStore,
  type CameraPreset,
} from "@/stores/viewer-store";
import type { BodyZone, Vec3 } from "@/types/health";
import { AstronautModel } from "./astronaut-model";

/** 1 scene unit ≈ 100 cm — measure labels read in centimetres. */
export const MODEL_CM_PER_UNIT = 100;

const PRESET_POS: Record<CameraPreset, { pos: Vec3; target: Vec3 }> = {
  // lower elevation + shorter distance so the figure fills the frame height
  iso: { pos: [1.75, 0.95, 2.2], target: [0, -0.05, 0] },
  front: { pos: [0, 0.4, 3.1], target: [0, 0.05, 0] },
  side: { pos: [3.1, 0.4, 0], target: [0, 0.05, 0] },
  top: { pos: [0, 3.6, 0.001], target: [0, 0, 0] },
};

function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-5, 3, -3]} intensity={0.35} />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.2} position={[0, 5, 0]} scale={[6, 6, 1]} />
        <Lightformer intensity={0.5} position={[4, 2, 4]} scale={[2, 3, 1]} />
        <Lightformer intensity={0.4} position={[-4, 1, -2]} scale={[2, 3, 1]} />
      </Environment>
    </>
  );
}

/* ------------------------------ camera rig ------------------------------ */

function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const focusRevision = useViewerStore((s) => s.focusRevision);
  const focusPoint = useViewerStore((s) => s.focusPoint);
  const focusDistance = useViewerStore((s) => s.focusDistance);
  const presetRevision = useViewerStore((s) => s.presetRevision);
  const cameraPreset = useViewerStore((s) => s.cameraPreset);
  const resetRevision = useViewerStore((s) => s.resetRevision);
  const interaction = useViewerStore((s) => s.interaction);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const setAutoRotate = useViewerStore((s) => s.setAutoRotate);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const autoRotatePref = useAppStore((s) => s.autoRotate);

  // Focus animation — every focus()/focusOrgan() bumps focusRevision.
  // focusDistance scales the approach: zone 1.5u, organ per-atlas 0.2–0.85u.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || !focusPoint) return;
    const [x, y, z] = focusPoint;
    const dir = new THREE.Vector3(1.6, 0.55, 2.0)
      .normalize()
      .multiplyScalar(focusDistance);
    void c.setLookAt(x + dir.x, y + dir.y, z + dir.z, x, y, z, !reduceMotion);
  }, [focusRevision, focusPoint, focusDistance, reduceMotion]);

  // Camera presets.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || presetRevision === 0) return;
    const { pos, target } = PRESET_POS[cameraPreset];
    void c.setLookAt(...pos, ...target, !reduceMotion);
  }, [presetRevision, cameraPreset, reduceMotion]);

  // Reset.
  useEffect(() => {
    const c = controlsRef.current;
    if (!c || resetRevision === 0) return;
    const { pos, target } = PRESET_POS.iso;
    void c.setLookAt(...pos, ...target, true);
  }, [resetRevision]);

  // Interaction tool → pointer mapping (wheel/touch zoom is always dolly).
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.mouseButtons.left =
      interaction === "rotate"
        ? CameraControlsImpl.ACTION.ROTATE
        : interaction === "pan"
          ? CameraControlsImpl.ACTION.TRUCK
          : CameraControlsImpl.ACTION.DOLLY;
    c.mouseButtons.right = CameraControlsImpl.ACTION.TRUCK;
    c.mouseButtons.wheel = CameraControlsImpl.ACTION.DOLLY;
    c.touches.one = CameraControlsImpl.ACTION.TOUCH_ROTATE;
    c.touches.two = CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK;
    // Zoom converges on the lookAt target — dollyToCursor made the model
    // drift off-centre (it ended up low in frame) depending on cursor pos.
    c.dollyToCursor = false;
    c.dollySpeed = 0.7; // gentler wheel steps, less overshoot
  }, [interaction]);

  // Seed auto-rotate from the persisted app preference once hydrated.
  const hydrated = useAppStore((s) => s.hydrated);
  useEffect(() => {
    if (hydrated) setAutoRotate(autoRotatePref);
  }, [hydrated, autoRotatePref, setAutoRotate]);

  // Stop auto-rotate on first user interaction. NOTE: wheel dolly does not
  // emit 'controlstart' in camera-controls v3 — listen on the canvas too.
  const canvasEl = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const stop = () => setAutoRotate(false);
    c.addEventListener("controlstart", stop);
    canvasEl.addEventListener("wheel", stop, { passive: true });
    canvasEl.addEventListener("pointerdown", stop);
    return () => {
      c.removeEventListener("controlstart", stop);
      canvasEl.removeEventListener("wheel", stop);
      canvasEl.removeEventListener("pointerdown", stop);
    };
  }, [setAutoRotate, canvasEl]);

  // camera-controls v3 dropped autoRotate — idle turntable via rotate().
  // enableTransition=false: constant angular speed, no queued tweens that
  // would fight the user's wheel/drag input.
  useFrame((_, delta) => {
    const c = controlsRef.current;
    if (!c || !autoRotate || selectedZoneId) return;
    void c.rotate(delta * 0.35, 0, false);
  });

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minDistance={0.15}
      maxDistance={8}
      smoothTime={0.28}
      draggingSmoothTime={0.08}
    />
  );
}

/* ----------------------------- section plane ---------------------------- */

function useSectionPlanes() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const section = useViewerStore((s) => s.section);
  const axis = useViewerStore((s) => s.sectionAxis);
  const offset = useViewerStore((s) => s.sectionOffset);

  const plane = useMemo(() => new THREE.Plane(), []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability -- WebGLRenderer requires the imperative flag
    gl.localClippingEnabled = section;
    const normal = new THREE.Vector3();
    normal[axis === "x" ? "x" : axis === "y" ? "y" : "z"] = -1;
    plane.normal.copy(normal);
    // eslint-disable-next-line react-hooks/immutability -- THREE.Plane is a mutable math object
    plane.constant = offset;

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m) => {
          m.clippingPlanes = section ? [plane] : [];
          m.clipShadows = section;
          m.needsUpdate = true;
        });
      }
    });
  }, [scene, gl, section, axis, offset, plane]);

  return plane;
}

function SectionHelper() {
  const section = useViewerStore((s) => s.section);
  const axis = useViewerStore((s) => s.sectionAxis);
  const offset = useViewerStore((s) => s.sectionOffset);
  useSectionPlanes();

  if (!section) return null;
  const rotation: Vec3 =
    axis === "x"
      ? [0, Math.PI / 2, 0]
      : axis === "y"
        ? [Math.PI / 2, 0, 0]
        : [0, 0, 0];
  const position: Vec3 =
    axis === "x" ? [offset, 0, 0] : axis === "y" ? [0, offset, 0] : [0, 0, offset];

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[3.4, 3.4]} />
      <meshBasicMaterial
        color="#8badfa"
        transparent
        opacity={0.07}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ----------------------------- measure layer ---------------------------- */

function MeasureLayer() {
  const points = useViewerStore((s) => s.measurePoints);
  const clear = useViewerStore((s) => s.clearMeasure);

  if (points.length === 0) return null;
  const dist =
    points.length === 2
      ? new THREE.Vector3(...points[0]).distanceTo(
          new THREE.Vector3(...points[1]),
        ) * MODEL_CM_PER_UNIT
      : null;

  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.018, 12, 8]} />
          <meshBasicMaterial color="#8badfa" />
        </mesh>
      ))}
      {points.length === 2 && (
        <>
          <Line points={points} color="#8badfa" dashed dashSize={0.03} gapSize={0.02} />
          <Html
            position={[
              (points[0][0] + points[1][0]) / 2,
              (points[0][1] + points[1][1]) / 2 + 0.06,
              (points[0][2] + points[1][2]) / 2,
            ]}
            center
            style={{ pointerEvents: "auto" }}
          >
            <button
              onClick={clear}
              className="micro"
              style={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 3,
                padding: "3px 8px",
                color: "var(--accent)",
                whiteSpace: "nowrap",
              }}
              title="Clear measurement"
            >
              {dist?.toFixed(1)} cm ✕
            </button>
          </Html>
        </>
      )}
    </group>
  );
}

/* ------------------------------ the scene ------------------------------- */

export interface CanvasSceneProps {
  zones: BodyZone[];
  children?: ReactNode;
  quality: "high" | "balanced";
  onContextLost?: () => void;
}

export default function CanvasScene({
  zones,
  children,
  quality,
  onContextLost,
}: CanvasSceneProps) {
  const addMeasurePoint = useViewerStore((s) => s.addMeasurePoint);

  const onMeasure = (p: Vec3) => addMeasurePoint(p);

  return (
    <Canvas
      shadows={quality === "high"}
      dpr={quality === "high" ? [1, 2] : 1}
      camera={{ position: PRESET_POS.iso.pos, fov: 38, near: 0.05, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
    >
      <StudioLights />

      <Grid
        position={[0, -0.93, 0]}
        args={[20, 20]}
        cellSize={0.25}
        cellColor="#22262c"
        sectionSize={1.25}
        sectionColor="#2c3038"
        fadeDistance={14}
        fadeStrength={2.4}
        infiniteGrid
      />
      <ContactShadows
        position={[0, -0.92, 0]}
        opacity={0.55}
        scale={4}
        blur={2.4}
        far={2.4}
        color="#000000"
      />

      <AstronautModel zones={zones} onMeasure={onMeasure} />
      <SectionHelper />
      <MeasureLayer />
      {children}
      <CameraRig />
    </Canvas>
  );
}
