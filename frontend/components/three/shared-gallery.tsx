"use client";

/**
 * SharedGallery — one <Canvas> renders every preview <View> on the page
 * (drei View/View.Port pattern): a single WebGL context drives N mini
 * astronaut previews efficiently. Previews share one ViewerStore.
 */

import { View } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { ViewerProvider } from "@/stores/viewer-store";
import type { BodyZone } from "@/types/health";
import { AstronautModel } from "./astronaut-model";

/** The shared canvas camera defaults to looking down -Z, which left the
 * astronaut off-centre (bottom-left) in every preview — aim it once at the
 * model's centre instead. No controls run in this canvas. */
function AimCenter() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

function PreviewModel({ zones, spin }: { zones: BodyZone[]; spin: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin && ref.current) ref.current.rotation.y += delta * 0.35;
  });
  return (
    <group ref={ref} position={[0, 0.1, 0]}>
      <AstronautModel zones={zones} scale={0.9} anatomy={false} />
    </group>
  );
}

const SharedCanvas = dynamic(
  () =>
    Promise.resolve(function SharedCanvasInner() {
      return (
        <ViewerProvider>
          <Canvas
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 5,
              pointerEvents: "none",
            }}
            eventSource={typeof document !== "undefined" ? document.body : undefined}
            dpr={1}
            gl={{ antialias: true, alpha: true }}
            camera={{ position: [1.7, 0.55, 2.2], fov: 36 }}
          >
            <AimCenter />
            <View.Port />
          </Canvas>
        </ViewerProvider>
      );
    }),
  { ssr: false },
);

/** Wrap a page section containing <GalleryPreview> boxes. */
export function SharedGallery({ children }: { children: ReactNode }) {
  return (
    <>
      <SharedCanvas />
      {children}
    </>
  );
}

/**
 * Tracking div — the shared canvas renders a model inside this rect.
 * Position it inside a relatively-positioned card box.
 */
export function GalleryPreview({
  zones,
  spin = true,
}: {
  zones: BodyZone[];
  spin?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div
        ref={trackRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />
      <View track={trackRef as React.RefObject<HTMLElement>}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[3, 4, 3]} intensity={1.15} />
        <PreviewModel zones={zones} spin={spin} />
      </View>
    </>
  );
}
