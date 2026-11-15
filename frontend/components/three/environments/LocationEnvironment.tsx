"use client";

/**
 * Procedural MEDBAY location environments (spec §10 + location reduction):
 * the astronaut is shown inside the place the crew is in.
 *  - station    → ISS-style pressurised module (0 g, astronaut floats)
 *  - spacecraft → Orion / Artemis II crew cabin (0 g, astronaut floats)
 *  - mars       → Mars surface with habitat (0.38 g, astronaut stands)
 * Interiors use BackSide shells so the orbit camera always sees a cutaway.
 */

import { Stars } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import type { LocationId } from "@/types/health";

const FLOOR_Y = -0.93;

/* ------------------------------ helpers ------------------------------ */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Gentle micro-gravity drift for the crew member (cm-scale, keeps focus framing). */
export function GravityRig({
  location,
  reduceMotion,
  children,
}: {
  location: LocationId;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const floating = location !== "mars";
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (!floating || reduceMotion) {
      g.position.y = 0;
      g.rotation.z = 0;
      return;
    }
    const t = clock.elapsedTime;
    g.position.y = 0.035 + Math.sin(t * 0.6) * 0.025;
    g.rotation.z = Math.sin(t * 0.35) * 0.02;
  });
  return <group ref={ref}>{children}</group>;
}

/* --------------------------- ISS module --------------------------- */

function StationModule({ lite }: { lite: boolean }) {
  const racks = useMemo(() => {
    const out: { x: number; a: number; c: string; h: number }[] = [];
    const rnd = seeded(7);
    for (let i = -4; i <= 4; i++) {
      for (let k = 0; k < 8; k++) {
        if (lite && k % 2) continue;
        out.push({ x: i * 1.1, a: (k / 8) * Math.PI * 2 + Math.PI / 8, c: rnd() > 0.7 ? "#c9ccd3" : "#9aa0aa", h: 0.6 + rnd() * 0.3 });
      }
    }
    return out;
  }, [lite]);
  const R = 2.7;
  return (
    <group position={[0, 0.35, 0]}>
      {/* hull */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[R, R, 11, 8, 1, true]} />
        <meshStandardMaterial color="#d9dce2" roughness={0.85} side={THREE.BackSide} />
      </mesh>
      {/* end hatches */}
      {[-5.5, 5.5].map((x) => (
        <group key={x} position={[x, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh>
            <circleGeometry args={[R, 8]} />
            <meshStandardMaterial color="#b8bcc5" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, x > 0 ? -0.02 : 0.02]}>
            <ringGeometry args={[0.7, 0.85, 32]} />
            <meshStandardMaterial color="#555b66" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* racks / panels on the 8 walls */}
      {racks.map((r, i) => (
        <group key={i} position={[r.x, 0, 0]} rotation={[r.a, 0, 0]}>
          <mesh position={[0, R * 0.9, 0]}>
            <boxGeometry args={[1, 0.14, r.h * 1.6]} />
            <meshStandardMaterial color={r.c} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* handrails */}
      {[-3.3, -1.1, 1.1, 3.3].map((x) =>
        [0.6, -0.6].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -R * 0.62, z * 1.6]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.025, 0.025, 0.8, 8]} />
            <meshStandardMaterial color="#e3b341" />
          </mesh>
        )),
      )}
      {/* light strips */}
      {[-3.3, 0, 3.3].map((x) => (
        <mesh key={x} position={[x, R * 0.78, 0]}>
          <boxGeometry args={[0.9, 0.02, 0.25]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1.4} />
        </mesh>
      ))}
      <pointLight position={[0, 1.4, 0]} intensity={6} distance={9} color="#f3f6ff" />
      {/* floating laptop + bag */}
      <mesh position={[1.6, 0.7, -1.1]} rotation={[0.4, 0.6, 0.2]}>
        <boxGeometry args={[0.36, 0.02, 0.26]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <mesh position={[-1.8, 1.0, 1.0]} rotation={[0.2, 0.3, 0.8]}>
        <boxGeometry args={[0.3, 0.18, 0.2]} />
        <meshStandardMaterial color="#e7e2d4" roughness={1} />
      </mesh>
    </group>
  );
}

/* --------------------------- Orion cabin --------------------------- */

function OrionCabin() {
  return (
    <group position={[0, 0.25, 0]}>
      {/* conical pressure vessel */}
      <mesh>
        <cylinderGeometry args={[1.25, 2.8, 3.6, 24, 1, true]} />
        <meshStandardMaterial color="#c8ccd4" roughness={0.8} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, -1.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.8, 24]} />
        <meshStandardMaterial color="#6d737e" roughness={0.9} />
      </mesh>
      {/* crew seats */}
      {[-1.1, 0, 1.1].map((x, i) => (
        <group key={x} position={[x, -1.45, i === 1 ? -1.35 : -1.1]} rotation={[-0.35, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.6, 0.08, 0.9]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
          <mesh position={[0, 0.4, -0.42]} rotation={[1.2, 0, 0]}>
            <boxGeometry args={[0.6, 0.08, 0.9]} />
            <meshStandardMaterial color="#2b2f36" />
          </mesh>
        </group>
      ))}
      {/* glass cockpit displays */}
      {[-0.7, 0, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.2, -1.62]} rotation={[0.25, 0, 0]}>
          <planeGeometry args={[0.55, 0.38]} />
          <meshStandardMaterial color="#0a1a3a" emissive="#2f6bff" emissiveIntensity={0.9} />
        </mesh>
      ))}
      {/* window with Earth */}
      <group position={[1.55, 0.6, -1.0]} rotation={[0, -0.95, 0]}>
        <mesh>
          <circleGeometry args={[0.32, 24]} />
          <meshBasicMaterial color="#020410" />
        </mesh>
        <mesh position={[0.04, -0.05, 0.01]}>
          <circleGeometry args={[0.2, 24]} />
          <meshBasicMaterial color="#2f7bff" />
        </mesh>
        <mesh position={[0, 0, 0.005]}>
          <ringGeometry args={[0.32, 0.4, 24]} />
          <meshStandardMaterial color="#8d939e" />
        </mesh>
      </group>
      <pointLight position={[0, 1.0, 0.4]} intensity={4} distance={7} color="#dfe8ff" />
    </group>
  );
}

/* --------------------------- Mars surface --------------------------- */

function MarsSurface({ lite }: { lite: boolean }) {
  const terrain = useMemo(() => {
    const seg = lite ? 60 : 120;
    const g = new THREE.PlaneGeometry(60, 60, seg, seg);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z);
      const flat = THREE.MathUtils.smoothstep(d, 2.2, 7);
      const h =
        Math.sin(x * 0.22) * Math.cos(z * 0.18) * 0.8 +
        Math.sin(x * 0.7 + z * 0.4) * 0.18 +
        Math.max(0, d - 14) * 0.18;
      p.setY(i, h * flat);
    }
    g.computeVertexNormals();
    return g;
  }, [lite]);

  const rocks = useMemo(() => {
    const rnd = seeded(42);
    return Array.from({ length: lite ? 24 : 60 }, () => {
      const a = rnd() * Math.PI * 2;
      const d = 2.2 + rnd() * 16;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.05 + rnd() * (d > 6 ? 0.5 : 0.18), r: rnd() * 3 };
    });
  }, [lite]);

  return (
    <group>
      <color attach="background" args={["#2a1206"]} />
      <fog attach="fog" args={["#6b2d10", 6, 30]} />
      <hemisphereLight args={["#ffb27a", "#3a1505", 0.9]} />
      <directionalLight position={[-6, 5, 3]} intensity={1.6} color="#ffd2a8" />
      <mesh geometry={terrain} position={[0, FLOOR_Y, 0]} receiveShadow>
        <meshStandardMaterial color="#b4532a" roughness={1} />
      </mesh>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, FLOOR_Y + r.s * 0.4, r.z]} rotation={[r.r, r.r * 2, 0]} castShadow>
          <dodecahedronGeometry args={[r.s, 0]} />
          <meshStandardMaterial color="#7a3519" roughness={1} flatShading />
        </mesh>
      ))}
      {/* habitat */}
      <group position={[-4.5, FLOOR_Y, -6]}>
        <mesh>
          <sphereGeometry args={[1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e9e4dc" roughness={0.6} />
        </mesh>
        <mesh position={[2.2, 0.5, 0.4]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.5, 0.5, 1.8, 16]} />
          <meshStandardMaterial color="#d8d2c7" />
        </mesh>
        <mesh position={[0, 0.8, 1.55]}>
          <boxGeometry args={[0.5, 0.7, 0.2]} />
          <meshStandardMaterial color="#ff8f09" emissive="#ff8f09" emissiveIntensity={0.5} />
        </mesh>
      </group>
      {/* distant sun */}
      <mesh position={[-14, 7, -22]}>
        <circleGeometry args={[0.6, 24]} />
        <meshBasicMaterial color="#fff3e0" />
      </mesh>
    </group>
  );
}

export function LocationEnvironment({ location, lite = false }: { location: LocationId; lite?: boolean }) {
  if (location === "mars") return <MarsSurface lite={lite} />;
  if (location === "spacecraft") return <OrionCabin />;
  return <StationModule lite={lite} />;
}

/* --------------------------- mini tile models --------------------------- */

export function MiniLocationModel({ location }: { location: LocationId }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.4;
  });

  const marsTex = useMemo(() => {
    if (location !== "mars") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#c1440e";
    ctx.fillRect(0, 0, 256, 128);
    const rnd = seeded(11);
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = rnd() > 0.5 ? "rgba(90,30,10,0.35)" : "rgba(240,150,90,0.25)";
      ctx.beginPath();
      ctx.ellipse(rnd() * 256, rnd() * 128, 4 + rnd() * 18, 2 + rnd() * 6, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(0, 0, 256, 6);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [location]);

  return (
    <group ref={ref}>
      {location === "mars" && (
        <mesh rotation={[0.3, 0, 0.1]}>
          <sphereGeometry args={[1, 40, 20]} />
          <meshStandardMaterial map={marsTex} roughness={1} />
        </mesh>
      )}
      {location === "station" && (
        <group rotation={[0.45, 0, 0.15]} scale={0.9}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, 2.6, 6]} />
            <meshStandardMaterial color="#cfd3da" />
          </mesh>
          {[-1.05, -0.7, 0.7, 1.05].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.28, 0.01, 1.3]} />
              <meshStandardMaterial color="#c79a2b" metalness={0.4} roughness={0.4} />
            </mesh>
          ))}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.9, 12]} />
            <meshStandardMaterial color="#e6e8ec" />
          </mesh>
          <mesh position={[0, 0, 0.55]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.6, 12]} />
            <meshStandardMaterial color="#e6e8ec" />
          </mesh>
        </group>
      )}
      {location === "spacecraft" && (
        <group rotation={[0.5, 0, -0.35]} scale={0.95}>
          <mesh position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.18, 0.5, 0.5, 20]} />
            <meshStandardMaterial color="#e9ebef" />
          </mesh>
          <mesh position={[0, -0.05, 0]}>
            <cylinderGeometry args={[0.45, 0.45, 0.55, 20]} />
            <meshStandardMaterial color="#d7d9dd" />
          </mesh>
          <mesh position={[0, -0.42, 0]}>
            <coneGeometry args={[0.18, 0.25, 16]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} rotation={[0, (i * Math.PI) / 2 + Math.PI / 4, 0]} position={[0, -0.05, 0]}>
              <boxGeometry args={[2, 0.01, 0.22]} />
              <meshStandardMaterial color="#2c4a9a" metalness={0.3} roughness={0.4} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export { Stars };
