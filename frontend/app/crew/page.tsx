"use client";

/**
 * /crew — crew roster explorer: search + status filter + cards with
 * shared-canvas 3D previews (single WebGL context via drei View).
 */

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Eyebrow,
  StatusChip,
  StatusDot,
} from "@/components/ui/primitives";
import {
  GalleryPreview,
  SharedGallery,
} from "@/components/three/shared-gallery";
import { useCrew } from "@/hooks/useCrew";
import type { TriageLevel } from "@/types/health";

const FILTERS: { id: TriageLevel | "all"; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "NOMINAL", label: "NOMINAL" },
  { id: "CAUTION", label: "CAUTION" },
  { id: "URGENT", label: "URGENT" },
  { id: "CRITICAL", label: "CRITICAL" },
];

const ORDER: TriageLevel[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];

export default function CrewPage() {
  const { crew, loading, error } = useCrew();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crew.filter((c) => {
      const worst = [...c.zones].sort(
        (a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status),
      )[0]?.status;
      if (filter !== "all" && worst !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.callsign.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
      );
    });
  }, [crew, query, filter]);

  return (
    <SharedGallery>
      <div style={{ padding: "22px 26px" }}>
        {/* header + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <Eyebrow>Crew roster / monitored subjects</Eyebrow>
          <span className="micro-8" style={{ marginLeft: "auto" }}>
            {loading ? "…" : `${filtered.length}/${crew.length} SHOWN`}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 380 }}>
            <Search
              size={12}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--dim)" }}
            />
            <input
              type="search"
              placeholder="Search name, callsign, role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search crew"
              style={{ width: "100%", paddingLeft: 28 }}
            />
          </div>
          <div className="view-toggle" role="group" aria-label="Status filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* states */}
        {loading && (
          <div className="empty-state mono" role="status">LINKING CREW MANIFEST…</div>
        )}
        {error && !loading && (
          <div className="empty-state" role="alert">
            <div
              className="crosshair mono"
              style={{ display: "inline-block", padding: 24 }}
            >
              {error}
            </div>
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div
              className="crosshair mono"
              style={{ display: "inline-block", padding: 24 }}
            >
              NO SUBJECTS MATCH THE QUERY
            </div>
          </div>
        )}

        {/* cards */}
        <div className="crew-grid" style={{ marginTop: 20 }}>
          {filtered.map((c) => {
            const worst = [...c.zones].sort(
              (a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status),
            )[0];
            const flaggedCount = c.zones.filter((z) => z.status !== "NOMINAL").length;
            return (
              <Link key={c.id} href={`/crew/${c.id}`} className="card crew-card" style={{ display: "block" }}>
                <div className="preview-box">
                  <GalleryPreview zones={c.zones} />
                  {c.facePhoto && (
                    // eslint-disable-next-line @next/next/no-img-element -- enrollment capture is a dataURL
                    <img
                      src={c.facePhoto}
                      alt={`${c.name} enrollment capture`}
                      style={{
                        position: "absolute",
                        bottom: 8,
                        left: 8,
                        zIndex: 6,
                        width: 34,
                        height: 34,
                        objectFit: "cover",
                        borderRadius: "50%",
                        border: "1px solid var(--accent)",
                      }}
                    />
                  )}
                  <div className="micro-8" style={{ position: "absolute", top: 8, left: 10, zIndex: 6 }}>
                    {c.id} · {c.mission}
                  </div>
                  <div style={{ position: "absolute", top: 8, right: 10, zIndex: 6 }}>
                    <StatusChip level={worst.status} />
                  </div>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    <span className="micro-8">{c.callsign}</span>
                  </div>
                  <div className="micro-8" style={{ marginTop: 5, display: "flex", gap: 10 }}>
                    <span>{c.role}</span>
                    <span style={{ marginLeft: "auto" }}>
                      RDY {c.readiness.score} · {flaggedCount} FLAGGED
                    </span>
                  </div>
                  <div
                    className="micro-8"
                    style={{ marginTop: 8, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    MONITOR <StatusDot level={worst.status} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </SharedGallery>
  );
}
