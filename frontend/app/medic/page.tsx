"use client";

/**
 * /medic — AI companion & RAG space medicine knowledge base page (module D host).
 * Left stage holds 3D anatomical viewport + toggleable Mapped Regions /
 * Space Medicine RAG Knowledge Explorer; right rail holds ChatPanel.
 */

import { BookOpen, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";

import { StatusDot } from "@/components/ui/primitives";
import { ModelViewport } from "@/components/three/model-viewport";
import { ChatPanel } from "@/components/widgets/ChatPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useBodyStatus } from "@/hooks/useBodyStatus";
import { useCheckIn } from "@/hooks/useCheckIn";
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
  const { activeUser } = useCheckIn();
  const [crewId, setCrewId] = useState(
    params.get("crew") ?? activeUser?.astronautId ?? "",
  );
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-input px-6 py-3">
        <h1 className="medbay-display text-lg tracking-widest">Medic AI</h1>
        <span className="medbay-micro text-foreground/60">clinical copilot · RAG knowledge base</span>
        <select
          className="ml-auto flex h-9 border border-input bg-black px-3 text-sm"
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

      <div className="grid min-h-0 flex-1 grid-cols-2">
        {/* model + mapped regions / RAG explorer */}
        <div className="flex min-h-0 flex-col border-r border-input">
          <div className="relative min-h-0 flex-[1_1_50%] border-b border-input">
            {member ? (
              <ModelViewport zones={member.zones}>
                <div className="medbay-micro absolute left-3 top-3 text-foreground/50">CONTEXT LINKED</div>
                <div className="medbay-micro absolute bottom-2 left-3 text-foreground/50">
                  the copilot focuses what it describes
                </div>
              </ModelViewport>
            ) : (
              <div className="medbay-micro grid h-full place-items-center text-foreground/60" role="status">
                Linking subject…
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex gap-2">
              <button
                className={cn("medbay-micro border px-3 py-1.5", leftTab === "zones" ? "border-state text-state" : "border-input")}
                aria-pressed={leftTab === "zones"}
                onClick={() => setLeftTab("zones")}
              >
                Mapped regions
              </button>
              <button
                className={cn("medbay-micro flex items-center gap-1.5 border px-3 py-1.5", leftTab === "rag" ? "border-state text-state" : "border-input")}
                aria-pressed={leftTab === "rag"}
                onClick={() => {
                  setLeftTab("rag");
                  if (!ragData && provider) {
                    void runSearch(query, category, topK);
                  }
                }}
              >
                <BookOpen size={10} />
                RAG knowledge base
              </button>
            </div>

            {leftTab === "zones" && member && (
              <div>
                {member.zones.map((z, i) => (
                  <button
                    key={z.id}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-input px-2 py-2 text-left",
                      selectedZoneId === z.id && "bg-[var(--panel-tint)]",
                    )}
                    aria-pressed={selectedZoneId === z.id}
                    onClick={() => focus(z)}
                  >
                    <span className="medbay-micro text-foreground/50">{String(i + 1).padStart(2, "0")}</span>
                    <span className="medbay-display flex-1 text-[13px]">{z.name}</span>
                    <StatusDot level={z.status} />
                  </button>
                ))}
              </div>
            )}

            {leftTab === "rag" && (
              <div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="text"
                    className="min-w-[140px] flex-1"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runSearch(query, category, topK);
                    }}
                    placeholder="Search NASA HRP protocols…"
                    aria-label="RAG query"
                  />
                  <select
                    className="flex h-9 border border-input bg-black px-3 text-sm"
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
                  <Button disabled={ragLoading} onClick={() => void runSearch(query, category, topK)}>
                    <Search size={10} />
                    {ragLoading ? "…" : "Search"}
                  </Button>
                </div>

                {ragError && (
                  <p className="medbay-micro mt-2 text-risk">{ragError}</p>
                )}

                {ragData && (
                  <div className="mt-3">
                    <div className="medbay-micro text-foreground/60">
                      {ragData.embedding_provider} · {ragData.total_chunks} total chunks ·{" "}
                      {technical ? ragData.technical : ragData.high_level}
                    </div>
                    {ragData.results.map((doc) => (
                      <div key={doc.chunk_key} className="mt-2 border border-input p-3">
                        <div className="medbay-micro text-state">
                          {doc.category} · sim {(doc.similarity_score ?? doc.score).toFixed(3)} ·{" "}
                          {doc.source_reference}
                        </div>
                        <div className="medbay-display mt-1 text-[13px]">{doc.title}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-foreground/70">
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
        <div className="min-h-0">
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
