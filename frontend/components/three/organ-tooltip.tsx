"use client";

/**
 * Floating tooltip for the selected organ — drill-down depth 2.
 * Status is inherited from the parent BodyZone; vitals come from the
 * curated organ atlas (data/organs.ts). Same overlay pipeline as
 * ZoneTooltip — the page swaps one for the other.
 */

import { MessageSquare, X } from "lucide-react";

import { StatusChip } from "@/components/ui/primitives";
import { useAppStore } from "@/stores/app-store";
import { useViewerStore } from "@/stores/viewer-store";
import type { BodyZone, Organ, ViewMode } from "@/types/health";

export function OrganTooltip({
  organ,
  zone,
  viewMode,
}: {
  organ: Organ;
  zone: BodyZone;
  viewMode: ViewMode;
}) {
  const selectOrgan = useViewerStore((s) => s.selectOrgan);
  const focus = useViewerStore((s) => s.focus);
  const openChat = useAppStore((s) => s.openChat);

  return (
    <aside
      className="hotspot-tooltip"
      style={{ position: "absolute", top: 34, left: 12, zIndex: 10 }}
      role="status"
      aria-label={`${organ.name} details`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="tt-name" style={{ flex: 1 }}>
          {organ.name}
        </div>
        <StatusChip level={zone.status} />
        <button
          aria-label="Close organ tooltip"
          onClick={() => {
            selectOrgan(null);
            focus(zone); // step back out to zone level
          }}
          style={{ color: "var(--dim)" }}
        >
          <X size={12} />
        </button>
      </div>

      <dl>
        {organ.vitals
          .slice(0, viewMode === "technical" ? 4 : 2)
          .map((v) => (
            <div key={v.key} style={{ display: "contents" }}>
              <dt>{v.label}</dt>
              <dd>
                {v.value} {v.unit}
              </dd>
            </div>
          ))}
        {viewMode === "technical" && (
          <>
            <dt>organ id</dt>
            <dd>{organ.id}</dd>
            <dt>parent zone</dt>
            <dd>{organ.zoneId}</dd>
          </>
        )}
      </dl>

      <p className="tt-desc">
        {viewMode === "technical"
          ? organ.description
          : organ.description.split(".")[0] + "."}
      </p>

      <button
        className="btn"
        style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
        onClick={() => openChat(organ.zoneId)}
      >
        <MessageSquare size={11} />
        Ask about this zone
      </button>
    </aside>
  );
}
