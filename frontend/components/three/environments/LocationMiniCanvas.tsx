"use client";

import { Canvas } from "@react-three/fiber";

import type { LocationId } from "@/types/health";
import { MiniLocationModel, Stars } from "./LocationEnvironment";

/** Small rotating 3D model for the MEDBAY location tile. */
export default function LocationMiniCanvas({ location }: { location: LocationId }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.4, 3], fov: 40 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 2, 2]} intensity={2.2} />
      <Stars radius={20} depth={10} count={300} factor={2} fade speed={0.3} />
      <MiniLocationModel location={location} />
    </Canvas>
  );
}
