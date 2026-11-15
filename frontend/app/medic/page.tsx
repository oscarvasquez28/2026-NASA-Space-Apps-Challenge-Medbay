"use client";

/**
 * /medic — AI companion & RAG space medicine knowledge base page (module D host).
 * Left stage holds 3D anatomical viewport + toggleable Mapped Regions /
 * Space Medicine RAG Knowledge Explorer; right rail holds ChatPanel.
 */

import { BookOpen, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { Eyebrow, StatusDot } from "@/components/ui/primitives";
import { ModelViewport } from "@/components/three/model-viewport";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { useBodyStatus } from "@/hooks/useBodyStatus";
import { useCrew } from "@/hooks/useCrew";
import { useProvider } from "@/hooks/useProvider";
import { useAppStore } from "@/stores/app-store";
import {
  useViewerStore,
  ViewerProvider,
} from "@/stores/viewer-store";
import type { KnowledgeSearchResponse } from "@/types/health";

const RAG_CATEGORIES = [
  "",
  "SANS",
  "EVA/Hypoxia",
  "Radiation/CANS",
  "Countermeasures/Aging",
  "Cardiovascular",
  "Skin/Microbiome",
  "Behavioral/Sleep",
  "Telemedicine",
];

function MedicInner() {
  const params = useSearchParams();
  const provider = useProvider();
  const viewMode = useAppStore((s) => s.viewMode);
  const { crew } = useCrew();
  const [crewId, setCrewId] = useState(params.get("crew") ?? "AST-01");
  const { member } = useBodyStatus(crewId);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const focus = useViewerStore((s) => s.focus);

  const [leftTab, setLeftTab] = useState<"zones" | "rag">("zones");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [topK] = useState(4);
  const [ragData, setRagData] = useState<KnowledgeSearchResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (qText: string, catText: string, k: number) => {
      if (!provider) return;
      setRagLoading(true);
      setRagError(null);
      try {
        const res = await provider.searchKnowledge(qText.trim(), {
          category: catText || undefined,
          topK: k,
        });
        setRagData(res);
      } catch (e) {
        setRagError(e instanceof Error ? e.message : "RAG search failed.");
      } finally {
        setRagLoading(false);
      }
    },
    [provider],
  );

  const technical = viewMode === "technical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
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
        <Eyebrow>Medic AI / clinical copilot &amp; RAG knowledge base</Eyebrow>
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
        {/* model + mapped regions / RAG explorer */}
        <div className="stage" style={{ borderRight: "1px solid var(--line)" }}>
          <div className="stage-canvas" style={{ flex: "1 1 50%" }}>
            {member ? (
              <ModelViewport zones={member.zones}>
                <div className="viewer-scene-meta">CONTEXT LINKED</div>
                <div className="viewer-bottom-left">
                  the copilot focuses what it describes
                </div>
              </ModelViewport>
            ) : (
              <div className="fallback-figure mono" role="status">
                LINKING SUBJECT…
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid var(--line)",
              padding: "10px 16px",
              flex: "1 1 auto",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button
                className="camera-preset"
                aria-pressed={leftTab === "zones"}
                onClick={() => setLeftTab("zones")}
              >
                MAPPED REGIONS
              </button>
              <button
                className="camera-preset"
                aria-pressed={leftTab === "rag"}
                onClick={() => {
                  setLeftTab("rag");
                  if (!ragData && provider) {
                    void runSearch(query, category, topK);
                  }
                }}
              >
                <BookOpen size={10} style={{ marginRight: 4 }} />
                RAG KNOWLEDGE BASE
              </button>
            </div>

            {leftTab === "zones" && member && (
              <div>
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
            )}

            {leftTab === "rag" && (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 4,
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="text"
                    style={{ flex: 1, minWidth: 140 }}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runSearch(query, category, topK);
                    }}
                    placeholder="Search NASA HRP protocols…"
                    aria-label="RAG query"
                  />
                  <select
                    className="ctx-select"
                    aria-label="Knowledge category"
                    value={category}
                    onChange={(e) => {
                      const nextCategory = e.target.value;
                      setCategory(nextCategory);
                      void runSearch(query, nextCategory, topK);
                    }}
                  >
                    {RAG_CATEGORIES.map((c) => (
                      <option key={c || "all"} value={c}>
                        {c || "All categories"}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-primary"
                    disabled={ragLoading}
                    onClick={() => void runSearch(query, category, topK)}
                  >
                    <Search size={10} />
                    {ragLoading ? "…" : "Search"}
                  </button>
                </div>

                {ragError && (
                  <p className="micro" style={{ marginTop: 8, color: "var(--status-critical)" }}>
                    {ragError}
                  </p>
                )}

                {ragData && (
                  <div style={{ marginTop: 10 }}>
                    <div className="micro-8" style={{ color: "var(--dim)" }}>
                      {ragData.embedding_provider} · {ragData.total_chunks} total chunks ·{" "}
                      {technical ? ragData.technical : ragData.high_level}
                    </div>
                    {ragData.results.map((doc) => (
                      <div key={doc.chunk_key} className="callout" style={{ marginTop: 8 }}>
                        <div className="micro-8" style={{ color: "var(--accent)" }}>
                          {doc.category} · sim {(doc.similarity_score ?? doc.score).toFixed(3)} ·{" "}
                          {doc.source_reference}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 3 }}>
                          {doc.title}
                        </div>
                        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                          {technical ? doc.content_technical : doc.content_high_level}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
      <Suspense
        fallback={<div className="empty-state mono">LINKING COPILOT…</div>}
      >
        <MedicInner />
      </Suspense>
    </ViewerProvider>
  );
}
