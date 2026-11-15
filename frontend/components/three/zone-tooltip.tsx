"use client";

/**
 * Floating tooltip for the selected zone — overlays the 3D stage.
 * Shows zone name, status badge, current vitals, description and the
 * "Ask about this zone" entry point into the AI companion drawer.
 */

import { MessageSquare, X } from "lucide-react";

import { StatusChip } from "@/components/ui/primitives";
import { useAppStore } from "@/stores/app-store";
import { useViewerStore } from "@/stores/viewer-store";
import type { BodyZone, ViewMode } from "@/types/health";

export function ZoneTooltip({
  zone,
  viewMode,
}: {
  zone: BodyZone;
  viewMode: ViewMode;
}) {
  const select = useViewerStore((s) => s.select);
  const openChat = useAppStore((s) => s.openChat);

  return (
    <aside
      className="hotspot-tooltip"
      style={{ position: "absolute", top: 34, left: 12, zIndex: 10 }}
      role="status"
      aria-label={`${zone.name} details`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="tt-name" style={{ flex: 1 }}>
          {zone.name}
        </div>
        <StatusChip level={zone.status} />
        <button
          aria-label="Close zone tooltip"
          onClick={() => select(null)}
          style={{ color: "var(--dim)" }}
        >
          <X size={12} />
        </button>
      </div>

      <dl>
        {zone.vitals.slice(0, viewMode === "technical" ? 4 : 2).map((v) => (
          <div key={v.key} style={{ display: "contents" }}>
            <dt>{v.label}</dt>
            <dd>
              {v.value} {v.unit}
            </dd>
          </div>
        ))}
        {viewMode === "technical" && (
          <>
            <dt>zone id</dt>
            <dd>{zone.id}</dd>
            <dt>anchor</dt>
            <dd>
              {zone.position.map((p) => p.toFixed(2)).join(" · ")}
            </dd>
          </>
        )}
      </dl>

      <p className="tt-desc">
        {(viewMode === "technical" ? zone.technical : zone.highLevel) ??
          (viewMode === "technical"
            ? zone.description
            : zone.description.split(".")[0] + ".")}
      </p>

      {zone.selfExamSteps && zone.selfExamSteps.length > 0 && (
        <div
          className="micro-8"
          style={{ marginTop: 6, color: "var(--muted)", lineHeight: 1.5 }}
        >
          SELF-EXAM: {zone.selfExamSteps[0]}
        </div>
      )}

      <button
        className="btn"
        style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
        onClick={() => openChat(zone.id)}
      >
        <MessageSquare size={11} />
        Ask about this zone
      </button>
    </aside>
  );
}
