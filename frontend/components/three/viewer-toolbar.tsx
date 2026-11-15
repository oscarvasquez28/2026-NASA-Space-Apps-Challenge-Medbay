"use client";

/**
 * ViewerToolbar — bottom-centered floating tool rail for the 3D stage:
 * interaction tools (rotate/pan/zoom), reset, explode, section, wireframe,
 * edges, measure + ISO/FRONT/SIDE/TOP camera presets.
 */

import {
  Box,
  Layers,
  Move3d,
  Rotate3d,
  RotateCcw,
  Ruler,
  Scissors,
  ZoomIn,
} from "lucide-react";

import {
  useViewerStore,
  type CameraPreset,
  type InteractionTool,
} from "@/stores/viewer-store";

const TOOLS: { id: InteractionTool; icon: typeof Rotate3d; label: string }[] = [
  { id: "rotate", icon: Rotate3d, label: "Orbit" },
  { id: "pan", icon: Move3d, label: "Pan" },
  { id: "zoom", icon: ZoomIn, label: "Zoom" },
];

const PRESETS: CameraPreset[] = ["iso", "front", "side", "top"];

export function ViewerToolbar() {
  const interaction = useViewerStore((s) => s.interaction);
  const setInteraction = useViewerStore((s) => s.setInteraction);
  const explode = useViewerStore((s) => s.explode);
  const setExplode = useViewerStore((s) => s.setExplode);
  const section = useViewerStore((s) => s.section);
  const sectionAxis = useViewerStore((s) => s.sectionAxis);
  const sectionOffset = useViewerStore((s) => s.sectionOffset);
  const toggleSection = useViewerStore((s) => s.toggleSection);
  const setSectionAxis = useViewerStore((s) => s.setSectionAxis);
  const setSectionOffset = useViewerStore((s) => s.setSectionOffset);
  const wireframe = useViewerStore((s) => s.wireframe);
  const toggleWireframe = useViewerStore((s) => s.toggleWireframe);
  const edges = useViewerStore((s) => s.edges);
  const toggleEdges = useViewerStore((s) => s.toggleEdges);
  const measureMode = useViewerStore((s) => s.measureMode);
  const toggleMeasure = useViewerStore((s) => s.toggleMeasure);
  const reset = useViewerStore((s) => s.reset);
  const setPreset = useViewerStore((s) => s.setPreset);

  return (
    <>
      {/* mode adjustment strip */}
      {explode > 0 && (
        <div className="mode-adjustment" role="group" aria-label="Explode amount">
          <span>EXPLODE</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
            aria-label="Explode amount"
          />
          <span>{Math.round(explode * 100)}%</span>
        </div>
      )}
      {section && (
        <div className="mode-adjustment" role="group" aria-label="Section plane">
          <span>SECTION</span>
          {(["x", "y", "z"] as const).map((a) => (
            <button
              key={a}
              className="camera-preset"
              aria-pressed={sectionAxis === a}
              onClick={() => setSectionAxis(a)}
            >
              {a.toUpperCase()}
            </button>
          ))}
          <input
            type="range"
            min={-1}
            max={1.6}
            step={0.01}
            value={sectionOffset}
            onChange={(e) => setSectionOffset(Number(e.target.value))}
            aria-label="Section offset"
          />
        </div>
      )}
      {measureMode && (
        <div className="mode-adjustment" role="status">
          <span>MEASURE — click two points on the model</span>
        </div>
      )}

      <div className="viewer-toolbar" role="toolbar" aria-label="Viewer tools">
        {TOOLS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className="tool"
            aria-pressed={interaction === id}
            aria-label={label}
            title={label}
            onClick={() => setInteraction(id)}
          >
            <Icon size={14} strokeWidth={1.5} />
          </button>
        ))}

        <span className="sep" />

        <button className="tool" aria-label="Reset view" title="Reset" onClick={reset}>
          <RotateCcw size={14} strokeWidth={1.5} />
        </button>
        <button
          className="tool"
          aria-pressed={explode > 0}
          aria-label="Explode suit layers"
          title="Explode"
          onClick={() => setExplode(explode > 0 ? 0 : 0.65)}
        >
          <Layers size={14} strokeWidth={1.5} />
        </button>
        <button
          className="tool"
          aria-pressed={section}
          aria-label="Section plane"
          title="Section"
          onClick={toggleSection}
        >
          <Scissors size={14} strokeWidth={1.5} />
        </button>
        <button
          className="tool"
          aria-pressed={wireframe}
          aria-label="Wireframe"
          title="Wireframe"
          onClick={toggleWireframe}
        >
          <Box size={14} strokeWidth={1.5} />
        </button>
        <button
          className="tool"
          aria-pressed={edges}
          aria-label="Edge outlines"
          title="Edges"
          onClick={toggleEdges}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
            <rect x="2" y="2" width="10" height="10" />
            <path d="M2 2 L5 5 M12 2 L9 5 M2 12 L5 9 M12 12 L9 9" />
          </svg>
        </button>
        <button
          className="tool"
          aria-pressed={measureMode}
          aria-label="Measure distance"
          title="Measure"
          onClick={toggleMeasure}
        >
          <Ruler size={14} strokeWidth={1.5} />
        </button>

        <span className="sep" />

        {PRESETS.map((p) => (
          <button
            key={p}
            className="camera-preset"
            onClick={() => setPreset(p)}
            aria-label={`Camera preset ${p}`}
          >
            {p.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
