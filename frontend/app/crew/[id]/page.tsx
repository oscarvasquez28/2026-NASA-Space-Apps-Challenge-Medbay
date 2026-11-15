"use client";

/**
 * /crew/[id] — Anatomical explorer (module C), the core screen.
 * 3D stage + medical-data inspector + AI companion drawer, all sharing one
 * selection/focus pipeline via a per-page ViewerProvider.
 */

import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { use, useMemo } from "react";

import { Modal } from "@/components/ui/Modal";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { ZoneInspector } from "@/components/widgets/ZoneInspector";
import {
  Eyebrow,
  StatusDot,
} from "@/components/ui/primitives";
import { ModelViewport } from "@/components/three/model-viewport";
import { OrganTooltip } from "@/components/three/organ-tooltip";
import { ViewerToolbar } from "@/components/three/viewer-toolbar";
import { ZoneTooltip } from "@/components/three/zone-tooltip";
import { getOrgan } from "@/data/organs";
import { useBodyStatus } from "@/hooks/useBodyStatus";
import { useProvider } from "@/hooks/useProvider";
import { useAppStore } from "@/stores/app-store";
import { ViewerProvider, useViewerStore } from "@/stores/viewer-store";

export default function CrewMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ViewerProvider key={id}>
      <Workspace crewId={id} />
    </ViewerProvider>
  );
}

function Workspace({ crewId }: { crewId: string }) {
  const provider = useProvider();
  const { member, loading, error, refresh } = useBodyStatus(crewId);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const closeChat = useAppStore((s) => s.closeChat);
  const openChat = useAppStore((s) => s.openChat);
  const chatContextZoneId = useAppStore((s) => s.chatContextZoneId);
  const viewMode = useAppStore((s) => s.viewMode);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const focus = useViewerStore((s) => s.focus);
  const reset = useViewerStore((s) => s.reset);
  const wireframe = useViewerStore((s) => s.wireframe);
  const edges = useViewerStore((s) => s.edges);
  const overlay = useViewerStore((s) => s.overlay);
  const explode = useViewerStore((s) => s.explode);

  const selectedZone = useMemo(
    () => member?.zones.find((z) => z.id === selectedZoneId) ?? null,
    [member, selectedZoneId],
  );
  const selectedOrgan = useMemo(
    () => getOrgan(selectedOrganId) ?? null,
    [selectedOrganId],
  );
  const contextZone = useMemo(
    () => member?.zones.find((z) => z.id === chatContextZoneId) ?? null,
    [member, chatContextZoneId],
  );

  const renderMode = [
    wireframe ? "WIREFRAME" : "SHADED",
    edges ? "+EDGES" : "",
    overlay !== "none" ? `· ${overlay.toUpperCase()}` : "",
    explode > 0 ? `· EXPLODE ${Math.round(explode * 100)}%` : "",
  ].join(" ");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        // flex-basis 0 + shrink: fill only what main-area leaves after the
        // ctxbar sibling — height:100% would overflow by the ctxbar's height.
        flex: "1 1 0%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {/* stage header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 20px 10px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <Link href="/crew" className="btn" aria-label="Back to roster">
          <ArrowLeft size={11} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>
            {member ? `${member.callsign} / ${member.id}` : "CREW MEMBER"}
          </Eyebrow>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: "-0.6px",
              marginTop: 4,
            }}
          >
            {member?.name ?? crewId}
          </h1>
          <div className="micro-8" style={{ marginTop: 2 }}>
            {(viewMode === "technical"
              ? member?.technical
              : member?.highLevel) ??
              member?.subtitle ??
              "LOADING"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className={`status-chip ${
              member?.overallStatus === "critical"
                ? "critical"
                : member?.overallStatus === "caution"
                  ? "caution"
                  : "nominal"
            }`}
          >
            <StatusDot
              level={
                member?.overallStatus === "critical"
                  ? "CRITICAL"
                  : member?.overallStatus === "caution"
                    ? "CAUTION"
                    : "NOMINAL"
              }
            />{" "}
            MONITORED · {provider?.kind === "rest" ? "LIVE" : "SIM"}
          </span>
          <button
            className="btn"
            onClick={refresh}
            aria-label="Refresh telemetry"
          >
            <RefreshCw size={11} />
          </button>
          <button
            className="btn btn-primary"
            onClick={() => openChat(selectedZoneId)}
            aria-label="Open Medic AI"
          >
            <Sparkles size={11} /> Medic AI
          </button>
        </div>
      </div>

      {/* workspace */}
      {loading && (
        <div className="empty-state mono" role="status">
          LINKING TELEMETRY…
        </div>
      )}
      {error && !loading && (
        <div className="empty-state" role="alert">
          <p className="mono" style={{ fontSize: 11 }}>
            {error}
          </p>
          <button className="btn" style={{ marginTop: 12 }} onClick={refresh}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && member && (
        <div className="workspace-grid" style={{ flex: 1 }}>
          {/* 3D stage */}
          <div className="stage">
            <div className="stage-canvas">
              <ModelViewport zones={member.zones}>
                <div className="viewer-scene-meta">{renderMode}</div>
                <div className="viewer-bottom-left">
                  drag orbit · scroll zoom · click zone to inspect
                </div>
                <div className="viewport-axis" aria-hidden>
                  <span>X</span>
                  <span>Y</span>
                  <span>Z</span>
                </div>
                {selectedZone && (
                  <div className="drill-breadcrumb" role="navigation" aria-label="Drill-down level">
                    <button onClick={reset}>BODY</button>
                    <span aria-hidden>/</span>
                    {selectedOrgan ? (
                      <button onClick={() => focus(selectedZone)}>
                        {selectedZone.name.toUpperCase()}
                      </button>
                    ) : (
                      <span className="drill-current">
                        {selectedZone.name.toUpperCase()}
                      </span>
                    )}
                    {selectedOrgan && (
                      <>
                        <span aria-hidden>/</span>
                        <span className="drill-current">
                          {selectedOrgan.name.toUpperCase()}
                        </span>
                      </>
                    )}
                  </div>
                )}
                {selectedZone && selectedOrgan && (
                  <OrganTooltip
                    organ={selectedOrgan}
                    zone={selectedZone}
                    viewMode={viewMode}
                  />
                )}
                {selectedZone && !selectedOrgan && (
                  <ZoneTooltip zone={selectedZone} viewMode={viewMode} />
                )}
                <ViewerToolbar />
              </ModelViewport>
            </div>
          </div>

          {/* inspector */}
          <ZoneInspector member={member} />
        </div>
      )}

      {/* companion drawer */}
      <Modal
        open={chatOpen}
        onOpenChange={(o) => (o ? undefined : closeChat())}
        variant="drawer"
      >
        {member && (
          <ChatPanel
            member={member}
            contextZone={contextZone ?? undefined}
            onCloseContext={() => openChat(null)}
            onClose={closeChat}
          />
        )}
      </Modal>
    </div>
  );
}
