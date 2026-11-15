"use client";

/**
 * MEDBAY Astronaut View (spec §3–§6) — shared between `/` (the checked-in
 * operator) and `/crew/[id]` (any enrolled operator).
 *
 * Modes:
 *  - overview : info box + streak/affected vitals + vital tiles | 3D + tile + AI
 *  - vital    : single vital view (current value, history/prediction, manual edit)
 *  - dashboard: all graph tiles + expanded AI panel + BACK (3D and tile hidden)
 * Zone focus (clicking the 3D body) swaps the vitals area for the zone
 * description + self-help / emergency protocol.
 */

import { useEffect, useMemo, useState } from "react";

import { LocationTile } from "@/components/medbay/LocationTile";
import { VisualAI } from "@/components/medbay/VisualAI";
import { ModelViewport } from "@/components/three/model-viewport";
import { OrganTooltip } from "@/components/three/organ-tooltip";
import { ViewerToolbar } from "@/components/three/viewer-toolbar";
import { ZoneTooltip } from "@/components/three/zone-tooltip";
import { Modal } from "@/components/ui/Modal";
import { Eyebrow, StatusDot } from "@/components/ui/primitives";
import { ChecklistWidget } from "@/components/widgets/ChecklistWidget";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { ZoneInspector } from "@/components/widgets/ZoneInspector";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getOrgan } from "@/data/organs";
import { infoMessage, improvedStat, suggestFaqs, worstZoneOf } from "@/lib/medbay-copy";
import { tileStates, type VitalTileId } from "@/lib/medbay-vitals";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useBodyStatus } from "@/hooks/useBodyStatus";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useProvider } from "@/hooks/useProvider";
import { healthOfZones } from "@/hooks/useHealthState";
import { useViewerStore } from "@/stores/viewer-store";
import type { TelemetryMetric, TelemetrySeries } from "@/types/health";
import { AffectedVitals, InfoBox, ProtocolList, StreakBox } from "./InfoBlocks";
import { ProfileHeader } from "./ProfileHeader";
import { SubjectDashboard } from "./SubjectDashboard";
import { VitalDetail } from "./VitalDetail";
import { type GraphMode } from "./VitalGraph";
import { VitalsPanel } from "./VitalTiles";

const INFO_METRICS: TelemetryMetric[] = ["heart_rate", "spo2", "core_temp", "blood_sugar"];

type Mode = { kind: "overview" } | { kind: "vital"; id: VitalTileId } | { kind: "dashboard" };

export function SubjectView({ crewId }: { crewId: string | undefined }) {
  const provider = useProvider();
  const { member, loading, error, refresh, sim, toggleSim } = useBodyStatus(crewId);
  const { activeUser } = useCheckIn();
  const { locationId } = useLocationContext();
  const viewMode = useAppStore((s) => s.viewMode);
  const technical = viewMode === "technical";

  const zones = useMemo(() => member?.zones ?? [], [member]);
  const health = healthOfZones(zones);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const focus = useViewerStore((s) => s.focus);
  const reset = useViewerStore((s) => s.reset);
  const wireframe = useViewerStore((s) => s.wireframe);
  const edges = useViewerStore((s) => s.edges);
  const overlay = useViewerStore((s) => s.overlay);
  const explode = useViewerStore((s) => s.explode);
  const chatOpen = useAppStore((s) => s.chatOpen);
  const closeChat = useAppStore((s) => s.closeChat);
  const openChat = useAppStore((s) => s.openChat);
  const chatContextZoneId = useAppStore((s) => s.chatContextZoneId);
  const focusZone = useMemo(() => zones.find((z) => z.id === selectedZoneId) ?? null, [zones, selectedZoneId]);
  const selectedOrgan = useMemo(() => getOrgan(selectedOrganId) ?? null, [selectedOrganId]);
  const contextZone = useMemo(
    () => zones.find((z) => z.id === chatContextZoneId) ?? null,
    [zones, chatContextZoneId],
  );
  const renderMode = [
    wireframe ? "WIREFRAME" : "SHADED",
    edges ? "+EDGES" : "",
    overlay !== "none" ? `· ${overlay.toUpperCase()}` : "",
    explode > 0 ? `· EXPLODE ${Math.round(explode * 100)}%` : "",
  ].join(" ");

  const [mode, setMode] = useState<Mode>({ kind: "overview" });
  const [graphMode, setGraphMode] = useState<GraphMode>("history");
  const [lockerOpen, setLockerOpen] = useState(false);

  // Keep the global subject state in sync so the header LED mirrors it.
  const setSubjectHealth = useAppStore((s) => s.setSubjectHealth);
  useEffect(() => setSubjectHealth(health), [health, setSubjectHealth]);

  const [streak, setStreak] = useState<number | null>(null);
  const [series, setSeries] = useState<TelemetrySeries[]>([]);
  useEffect(() => {
    if (!provider || !crewId) return;
    let cancelled = false;
    provider
      .getGamification(crewId)
      .then((g) => !cancelled && setStreak(g.streakDays))
      .catch(() => !cancelled && setStreak(null));
    Promise.all(
      INFO_METRICS.map((m) => provider.getTelemetrySeries(crewId, m).catch(() => null)),
    ).then((rs) => !cancelled && setSeries(rs.filter((r): r is TelemetrySeries => Boolean(r))));
    return () => {
      cancelled = true;
    };
  }, [provider, crewId, member]);

  const tiles = useMemo(() => tileStates(member, technical), [member, technical]);
  const message = useMemo(
    () => infoMessage(health, zones, tiles, improvedStat(series), focusZone),
    [health, zones, tiles, series, focusZone],
  );
  const worst = worstZoneOf(zones);
  const faqs = suggestFaqs(tiles, focusZone);
  const selfView = member?.id === activeUser?.astronautId;

  if (loading && !member) {
    return <div className="medbay-micro grid h-full place-items-center text-foreground/60">Loading subject…</div>;
  }
  if (error || !member) {
    return (
      <div className="medbay-micro grid h-full place-items-center text-risk">
        {error ?? "No subject selected."}
      </div>
    );
  }

  if (mode.kind === "dashboard") {
    return <SubjectDashboard member={member} health={health} technical={technical} onBack={() => setMode({ kind: "overview" })} />;
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden px-6 py-5">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,5fr)_minmax(0,4fr)] gap-4">
        {/* ---------------- left column ---------------- */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex items-center gap-3 px-1">
            <Eyebrow>{technical ? "SUBJECT FILE · TECHNICAL REVIEW" : "SUBJECT FILE"}</Eyebrow>
            <StatusDot level={health === "critical" ? "CRITICAL" : health === "risk" ? "URGENT" : "NOMINAL"} />
            <span className="micro ml-auto text-[8px] text-[var(--dim)]">{member.id} · REV. 01</span>
          </div>
          <div className="flex items-start gap-4">
            <ProfileHeader member={member} technical={technical} health={health} />
            <div className="ml-auto">
              {health === "critical" && worst ? (
                <AffectedVitals zone={worst} />
              ) : (
                <StreakBox streak={streak ?? 0} unknown={streak === null} />
              )}
            </div>
          </div>

          <InfoBox message={message} health={health} className="min-h-0 max-h-[38%] flex-1" />

          {mode.kind === "vital" ? (
            <VitalDetail
              tile={tiles.find((t) => t.def.id === mode.id) ?? tiles[0]}
              crewId={member.id}
              zones={zones}
              mode={graphMode}
              onMode={setGraphMode}
              onBack={() => setMode({ kind: "overview" })}
              onSaved={refresh}
            />
          ) : focusZone ? (
            <ProtocolList zone={focusZone} health={health} />
          ) : (
            <VitalsPanel
              tiles={tiles}
              health={health}
              feed={provider?.kind === "mock" || sim.running ? "SIM FEED" : "LIVE FEED"}
              sim={
                provider?.kind === "rest"
                  ? { running: sim.running, inserts: sim.inserts, onToggle: toggleSim }
                  : undefined
              }
              onSelect={(id) => setMode({ kind: "vital", id })}
              onDashboard={(m) => {
                setGraphMode(m);
                setMode({ kind: "dashboard" });
              }}
            />
          )}
        </div>

        {/* ---------------- right column ---------------- */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="medbay-stage crosshair relative min-h-0 flex-1">
            <ModelViewport zones={zones} environment={locationId}>
              <div className="viewer-scene-meta">{renderMode}</div>
              <div className="viewer-bottom-left">
                drag orbit · scroll zoom · click to inspect · esc/empty-click to step back
              </div>
              <div className="viewport-axis" aria-hidden>
                <span>X</span>
                <span>Y</span>
                <span>Z</span>
              </div>
              {focusZone && (
                <div className="drill-breadcrumb" role="navigation" aria-label="Drill-down level">
                  <button onClick={reset}>BODY</button>
                  <span aria-hidden>/</span>
                  {selectedOrgan ? (
                    <button onClick={() => focus(focusZone)}>
                      {focusZone.name.toUpperCase()}
                    </button>
                  ) : (
                    <span className="drill-current">{focusZone.name.toUpperCase()}</span>
                  )}
                  {selectedOrgan && (
                    <>
                      <span aria-hidden>/</span>
                      <span className="drill-current">{selectedOrgan.name.toUpperCase()}</span>
                    </>
                  )}
                </div>
              )}
              {focusZone && selectedOrgan ? (
                <OrganTooltip organ={selectedOrgan} zone={focusZone} viewMode={viewMode} />
              ) : focusZone ? (
                <ZoneTooltip zone={focusZone} viewMode={viewMode} />
              ) : null}
              <ViewerToolbar />
            </ModelViewport>
            <div className="pointer-events-none absolute right-3 top-3">
              <LocationTile size={132} />
            </div>
            {focusZone && (
              <div className="medbay-surface absolute bottom-[210px] right-3 top-[154px] z-10 hidden w-[300px] overflow-hidden xl:block">
                <ZoneInspector member={member} />
              </div>
            )}
            {/* Visual AI — mascot anchors the corner; chat floats above it (spec §7) */}
            <VisualAI member={member} variant="stage" floating size={170} faqs={faqs} />
          </div>
        </div>
      </div>

      {/* checklist + suit locker — collapsible, preserves existing behavior */}
      {selfView && (
        <div className="medbay-surface shrink-0">
          <button
            type="button"
            className="medbay-micro flex w-full items-center justify-between px-4 py-2.5 hover:text-state"
            onClick={() => setLockerOpen((o) => !o)}
            aria-expanded={lockerOpen}
          >
            <span>Daily check-up checklist · suit locker</span>
            <span className="text-state">{lockerOpen ? "−" : "+"}</span>
          </button>
          {lockerOpen && (
            <ScrollArea className="max-h-72 border-t border-input">
              <div className="p-3">
                <ChecklistWidget crewId={member.id} />
              </div>
            </ScrollArea>
          )}
        </div>
      )}
      {/* companion drawer — same store as the inline VisualAI panel */}
      <Modal
        open={chatOpen}
        onOpenChange={(o) => (o ? undefined : closeChat())}
        variant="drawer"
      >
        <ChatPanel
          member={member}
          contextZone={contextZone ?? undefined}
          onCloseContext={() => openChat(null)}
          onClose={closeChat}
        />
      </Modal>
      <span className={cn("hidden")} aria-hidden />
    </div>
  );
}
