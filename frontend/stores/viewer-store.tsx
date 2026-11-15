"use client";

/**
 * Ephemeral viewer state — one independent store per ModelViewport instance
 * (vanilla zustand store + React context), so multiple viewports can coexist
 * (main stage, mini previews, compare panels).
 *
 * External control channel: window event `astro:command`
 * ({ detail: "wireframe"|"edges"|"explode"|"section"|"measure"|"reset"|"fit" })
 * and `?tool=` query param — lets the sidebar / command palette drive the
 * viewer without coupling.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import { zoneFraming } from "@/data/organs";
import { MODEL_GROUP_OFFSET } from "@/types/health";
import type { BodyZone, Organ, Vec3, ZoneId } from "@/types/health";

export type CameraPreset = "iso" | "front" | "side" | "top";
export type OverlayMode =
  | "none"
  | "thermal"
  | "exertion"
  | "fatigue"
  | "radiation";
export type InteractionTool = "rotate" | "pan" | "zoom";
export type SectionAxis = "x" | "y" | "z";

export interface ViewerState {
  selectedZoneId: ZoneId | null;
  /** Drill-down depth 2 — organ inside selectedZoneId. */
  selectedOrganId: string | null;
  focusPoint: Vec3 | null;
  /** Camera dolly distance used by the focus rig (zone: fitted to its organs, organ: per-atlas 0.2–0.85). */
  focusDistance: number;
  /** bumped on every focus() — CameraRig animates to focusPoint. */
  focusRevision: number;
  cameraPreset: CameraPreset;
  presetRevision: number;
  resetRevision: number;
  explode: number;
  section: boolean;
  sectionAxis: SectionAxis;
  sectionOffset: number;
  wireframe: boolean;
  edges: boolean;
  measureMode: boolean;
  measurePoints: Vec3[];
  overlay: OverlayMode;
  interaction: InteractionTool;
  autoRotate: boolean;
}

interface ViewerActions {
  select: (zoneId: ZoneId | null) => void;
  selectOrgan: (organId: string | null) => void;
  /** Focus camera on a zone (or arbitrary point). */
  focus: (zone: Pick<BodyZone, "id" | "position"> | { id: null; position: Vec3 }) => void;
  /** Drill deeper: focus camera on an organ inside its parent zone. */
  focusOrgan: (
    organ: Pick<Organ, "id" | "zoneId" | "position" | "focusDistance">,
  ) => void;
  setPreset: (p: CameraPreset) => void;
  reset: () => void;
  setExplode: (v: number) => void;
  toggleSection: () => void;
  setSectionAxis: (a: SectionAxis) => void;
  setSectionOffset: (v: number) => void;
  toggleWireframe: () => void;
  toggleEdges: () => void;
  toggleMeasure: () => void;
  addMeasurePoint: (p: Vec3) => void;
  clearMeasure: () => void;
  setOverlay: (m: OverlayMode) => void;
  setInteraction: (t: InteractionTool) => void;
  setAutoRotate: (v: boolean) => void;
  applyCommand: (cmd: string) => void;
}

export type ViewerStore = StoreApi<ViewerState & ViewerActions>;

const initialState: ViewerState = {
  selectedZoneId: null,
  selectedOrganId: null,
  focusPoint: null,
  focusDistance: 1.15,
  focusRevision: 0,
  cameraPreset: "iso",
  presetRevision: 0,
  resetRevision: 0,
  explode: 0,
  section: false,
  sectionAxis: "y",
  sectionOffset: 0,
  wireframe: false,
  edges: false,
  measureMode: false,
  measurePoints: [],
  overlay: "none",
  interaction: "rotate",
  autoRotate: true,
};

function createViewerStore(): ViewerStore {
  return createStore<ViewerState & ViewerActions>()((set, get) => ({
    ...initialState,

    select: (selectedZoneId) =>
      set((s) => ({
        selectedZoneId,
        selectedOrganId:
          selectedZoneId === s.selectedZoneId ? s.selectedOrganId : null,
      })),

    selectOrgan: (selectedOrganId) => set({ selectedOrganId }),

    focus: (zone) =>
      set((s) => {
        // Drilled zones frame their anatomy (organ extent), not the suit
        // anchor; arbitrary points (id null) keep the caller's position.
        const frame = zone.id === null ? null : zoneFraming(zone.id);
        const local = frame ? frame.center : zone.position;
        return {
          selectedZoneId: zone.id ?? s.selectedZoneId,
          selectedOrganId: null,
          focusDistance: frame ? frame.distance : 1.5,
          // positions are model-local — convert to world so the camera
          // targets where the part actually renders.
          focusPoint: (
            zone.id === null
              ? [...zone.position]
              : [
                  local[0] + MODEL_GROUP_OFFSET[0],
                  local[1] + MODEL_GROUP_OFFSET[1],
                  local[2] + MODEL_GROUP_OFFSET[2],
                ]
          ) as Vec3,
          focusRevision: s.focusRevision + 1,
          measureMode: false,
        };
      }),

    focusOrgan: (organ) =>
      set((s) => ({
        selectedZoneId: organ.zoneId,
        selectedOrganId: organ.id,
        // per-organ framing: an eye needs ~0.2u, a femur ~0.85u
        focusDistance: organ.focusDistance ?? 0.6,
        focusPoint: [
          organ.position[0] + MODEL_GROUP_OFFSET[0],
          organ.position[1] + MODEL_GROUP_OFFSET[1],
          organ.position[2] + MODEL_GROUP_OFFSET[2],
        ] as Vec3,
        focusRevision: s.focusRevision + 1,
        measureMode: false,
      })),

    setPreset: (cameraPreset) =>
      set((s) => ({ cameraPreset, presetRevision: s.presetRevision + 1 })),

    reset: () =>
      set((s) => ({
        ...initialState,
        resetRevision: s.resetRevision + 1,
      })),

    setExplode: (explode) =>
      set({ explode, measureMode: false, section: false }),

    toggleSection: () =>
      set((s) => ({
        section: !s.section,
        measureMode: false,
        explode: 0,
      })),
    setSectionAxis: (sectionAxis) => set({ sectionAxis, section: true }),
    setSectionOffset: (sectionOffset) => set({ sectionOffset }),

    toggleWireframe: () => set((s) => ({ wireframe: !s.wireframe })),
    toggleEdges: () => set((s) => ({ edges: !s.edges })),

    toggleMeasure: () =>
      set((s) => ({
        measureMode: !s.measureMode,
        measurePoints: s.measureMode ? s.measurePoints : [],
        explode: 0,
        section: false,
      })),
    addMeasurePoint: (p) =>
      set((s) =>
        s.measurePoints.length >= 2
          ? { measurePoints: [p] }
          : { measurePoints: [...s.measurePoints, p] },
      ),
    clearMeasure: () => set({ measurePoints: [] }),

    setOverlay: (overlay) => set({ overlay }),
    setInteraction: (interaction) => set({ interaction }),
    setAutoRotate: (autoRotate) => set({ autoRotate }),

    applyCommand: (cmd) => {
      const s = get();
      switch (cmd) {
        case "wireframe":
          s.toggleWireframe();
          break;
        case "edges":
          s.toggleEdges();
          break;
        case "explode":
          s.setExplode(s.explode > 0 ? 0 : 0.65);
          break;
        case "section":
          s.toggleSection();
          break;
        case "measure":
          s.toggleMeasure();
          break;
        case "reset":
          s.reset();
          break;
        default:
          break;
      }
    },
  }));
}

/* ------------------------------ context ------------------------------ */

const ViewerContext = createContext<ViewerStore | null>(null);

export const VIEWER_COMMAND_EVENT = "astro:command";

export function ViewerProvider({ children }: { children: ReactNode }) {
  // One-time lazy init — a fresh vanilla store per provider instance.
  const [store] = useState<ViewerStore>(() => createViewerStore());

  // External command channel: window events + ?tool= query param.
  useEffect(() => {
    const onCommand = (e: Event) =>
      store.getState().applyCommand((e as CustomEvent<string>).detail);
    window.addEventListener(VIEWER_COMMAND_EVENT, onCommand);

    const tool = new URLSearchParams(window.location.search).get("tool");
    if (tool) store.getState().applyCommand(tool);

    return () => window.removeEventListener(VIEWER_COMMAND_EVENT, onCommand);
  }, [store]);

  return (
    <ViewerContext.Provider value={store}>
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewerStore<T>(selector: (s: ViewerState & ViewerActions) => T): T {
  const store = useContext(ViewerContext);
  if (!store) throw new Error("useViewerStore outside <ViewerProvider>");
  return useStore(store, selector);
}

export function useViewerApi(): ViewerStore {
  const store = useContext(ViewerContext);
  if (!store) throw new Error("useViewerApi outside <ViewerProvider>");
  return store;
}

/** Dispatch a viewer command from anywhere (sidebar, palette…). */
export function dispatchViewerCommand(cmd: string) {
  window.dispatchEvent(new CustomEvent(VIEWER_COMMAND_EVENT, { detail: cmd }));
}
