"use client";

/**
 * /medic — AI companion page (module D, dedicated view).
 * Model on the left (CONTEXT LINKED), ChatPanel on the right, plus a
 * numbered "Mapped regions" list driving the same focus pipeline.
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Eyebrow, StatusDot } from "@/components/ui/primitives";
import { ModelViewport } from "@/components/three/model-viewport";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { useBodyStatus } from "@/hooks/useBodyStatus";
import { useCrew } from "@/hooks/useCrew";
import {
  useViewerStore,
  ViewerProvider,
} from "@/stores/viewer-store";

function MedicInner() {
  const params = useSearchParams();
  const { crew } = useCrew();
  const [crewId, setCrewId] = useState(params.get("crew") ?? "AST-01");
  const { member } = useBodyStatus(crewId);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const focus = useViewerStore((s) => s.focus);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        // see /crew/[id]: fill only what main-area leaves after the ctxbar —
        // height:100% overflows the viewport by the ctxbar's height.
        flex: "1 1 0%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 20px 10px",
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <Eyebrow>Medic AI / clinical copilot</Eyebrow>
        <select
          className="ctx-select"
          style={{ marginLeft: "auto" }}
          aria-label="Subject"
          value={crewId}
          onChange={(e) => setCrewId(e.target.value)}
        >
          {crew.map((c) => (
            <option key={c.id} value={c.id}>
              {c.callsign} · {c.id}
            </option>
          ))}
        </select>
      </div>

      <div className="workspace-grid" style={{ flex: 1, minHeight: 0 }}>
        {/* model + mapped regions */}
        <div className="stage" style={{ borderRight: "1px solid var(--line)" }}>
          <div className="stage-canvas" style={{ flex: "1 1 55%" }}>
            {member ? (
              <ModelViewport zones={member.zones}>
                <div className="viewer-scene-meta">CONTEXT LINKED</div>
                <div className="viewer-bottom-left">the copilot focuses what it describes</div>
              </ModelViewport>
            ) : (
              <div className="fallback-figure mono" role="status">LINKING SUBJECT…</div>
            )}
          </div>
          {member && (
            <div style={{ borderTop: "1px solid var(--line)", padding: "10px 16px", flex: "1 1 auto", overflowY: "auto" }}>
              <Eyebrow>Mapped regions</Eyebrow>
              <div style={{ marginTop: 6 }}>
                {member.zones.map((z, i) => (
                  <button
                    key={z.id}
                    className="zone-list-item"
                    aria-pressed={selectedZoneId === z.id}
                    onClick={() => focus(z)}
                  >
                    <span className="zn">{String(i + 1).padStart(2, "0")}</span>
                    <span className="zl">{z.name}</span>
                    <StatusDot level={z.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* chat */}
        <div style={{ minHeight: 0, borderLeft: "1px solid var(--line)" }}>
          {member && <ChatPanel member={member} />}
        </div>
      </div>
    </div>
  );
}

export default function MedicPage() {
  return (
    <ViewerProvider>
      <Suspense fallback={<div className="empty-state mono">LINKING COPILOT…</div>}>
        <MedicInner />
      </Suspense>
    </ViewerProvider>
  );
}
