"use client";

/**
 * ModelViewport — single entry point for 3D in pages.
 * dynamic(ssr:false) + splash + error boundary + WebGL fallback.
 * Every viewport owns an independent ViewerStore via ViewerProvider.
 */

import dynamic from "next/dynamic";
import {
  Component,
  useState,
  type ReactNode,
} from "react";

import { useAppStore } from "@/stores/app-store";
import type { BodyZone, LocationId, ZoneId } from "@/types/health";
import { FallbackFigure } from "./fallback-figure";
import type { CanvasSceneProps } from "./canvas-scene";

const CanvasScene = dynamic<CanvasSceneProps>(
  () => import("./canvas-scene"),
  {
    ssr: false,
    loading: () => <ViewportSplash />,
  },
);

function ViewportSplash() {
  return (
    <div
      className="fallback-figure"
      role="status"
      aria-label="Loading 3D viewport"
    >
      <div className="micro">INITIALIZING TELEMETRY LINK…</div>
    </div>
  );
}

interface BoundaryState {
  failed: boolean;
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

interface ModelViewportProps {
  zones: BodyZone[];
  children?: ReactNode;
  /** Optional overlay rendered inside the canvas (Html, markers…). */
  canvasOverlays?: ReactNode;
  /** MEDBAY location environment rendered around the astronaut. */
  environment?: LocationId | null;
}

export function ModelViewport({
  zones,
  children,
  canvasOverlays,
  environment,
}: ModelViewportProps) {
  const quality = useAppStore((s) => s.quality);
  const hydrated = useAppStore((s) => s.hydrated);
  const [contextLost, setContextLost] = useState(0); // 0 ok, >0 lost
  const [retryKey, setRetryKey] = useState(0);
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null);

  const fallback = (
    <div style={{ position: "relative", height: "100%" }}>
      <FallbackFigure
        zones={zones}
        selectedZoneId={selectedZone}
        onSelect={(z) => setSelectedZone(z.id)}
      />
      {contextLost > 0 && (
        <button
          className="btn"
          style={{ position: "absolute", top: 12, right: 12 }}
          onClick={() => {
            setContextLost(0);
            setRetryKey((k) => k + 1);
          }}
        >
          Retry WebGL
        </button>
      )}
    </div>
  );

  // Requires a surrounding <ViewerProvider> — the workspace owns the store
  // so the inspector, toolbar and canvas share one selection pipeline.
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <SceneBoundary fallback={fallback}>
        {contextLost > 0 ? (
          fallback
        ) : (
          <CanvasScene
            key={retryKey}
            zones={zones}
            quality={hydrated ? quality : "high"}
            onContextLost={() => setContextLost((c) => c + 1)}
            environment={environment}
          >
            {canvasOverlays}
          </CanvasScene>
        )}
      </SceneBoundary>
      {children}
    </div>
  );
}
