"use client";

/**
 * MEDBAY left-column blocks: general information box, check-up streak box
 * (or the affected vitals in a critical state) and the emergency / self-care
 * protocol list.
 */

import { useEffect, useState } from "react";

import { HeartIcon } from "@/components/icons/medbay";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProvider } from "@/hooks/useProvider";
import type { InfoMessage } from "@/lib/medbay-copy";
import { cn } from "@/lib/utils";
import { useAppStore, type HealthState } from "@/stores/app-store";
import type { BodyZone, KnowledgeDocument } from "@/types/health";

export function InfoBox({
  message,
  health,
  onClick,
  className,
}: {
  message: InfoMessage;
  health: HealthState;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "medbay-surface flex min-h-[150px] w-full items-center px-6 py-5 text-left",
        health === "critical" && "medbay-surface-critical",
        onClick && "transition-colors hover:border-highlight/70",
        className,
      )}
      aria-live="polite"
    >
      <span
        aria-hidden
        className={cn(
          "mr-5 w-0.5 shrink-0 self-stretch",
          health === "risk" ? "bg-risk" : health === "critical" ? "bg-critical" : "bg-highlight",
        )}
        style={{ boxShadow: "0 0 10px color-mix(in srgb, var(--state) 60%, transparent)" }}
      />
      <p className="medbay-copy text-[clamp(15px,1.45vw,22px)]">
        {message.lead}
        {message.emphasis && (
          <span className={cn(health === "risk" ? "text-risk" : "text-state", "uppercase")}>{message.emphasis}</span>
        )}
        {message.tail}
      </p>
    </Tag>
  );
}

export function StreakBox({ streak, unknown }: { streak: number; unknown?: boolean }) {
  // Highlight colour after a month of regular check-ins; white before.
  const month = streak >= 30;
  return (
    <div
      className={cn(
        "flex size-[120px] shrink-0 flex-col items-center justify-center gap-1 text-center",
        month ? "medbay-surface-accent" : "medbay-surface",
      )}
    >
      <span className="medbay-micro leading-tight">
        Check up
        <br />
        streak
      </span>
      <span className={cn("medbay-display text-[34px]", month ? "text-state" : "text-foreground")}>
        {unknown ? "––" : streak}
      </span>
    </div>
  );
}

export function AffectedVitals({ zone }: { zone: BodyZone }) {
  const vitals = zone.vitals.slice(0, 3);
  return (
    <div className="medbay-surface medbay-surface-critical flex min-h-[120px] shrink-0 items-center gap-3 px-4 py-3">
      <HeartIcon size={34} className="text-critical" />
      <dl className="medbay-copy grid grid-cols-[auto_auto] gap-x-2 text-[13px] uppercase">
        {vitals.map((v) => (
          <div key={v.key} className="contents">
            <dt>{v.label}:</dt>
            <dd className={v.status === "NOMINAL" ? "" : "text-critical"}>
              {Number.isInteger(v.value) ? v.value : v.value.toFixed(1)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Retrieves the matching RAG protocol for an issue (GET /api/v1/ai/knowledge). */
export function useProtocolDoc(query: string | null) {
  const provider = useProvider();
  const [doc, setDoc] = useState<KnowledgeDocument | null>(null);
  useEffect(() => {
    if (!provider || !query) return;
    let cancelled = false;
    provider
      .searchKnowledge(query, { topK: 1 })
      .then((r) => !cancelled && setDoc(r.results[0] ?? null))
      .catch(() => !cancelled && setDoc(null));
    return () => {
      cancelled = true;
    };
  }, [provider, query]);
  return query ? doc : null;
}

/**
 * Scrollable step list: tips (healthy), self-help (risk) or the first-aid /
 * emergency protocol (critical) for a zone, enriched with the RAG protocol.
 */
export function ProtocolList({ zone, health }: { zone: BodyZone; health: HealthState }) {
  const technical = useAppStore((s) => s.viewMode === "technical");
  const query = health === "healthy" ? null : `${zone.activeRisks?.[0] ?? zone.name} protocol`;
  const doc = useProtocolDoc(query);

  const steps: { title: string; body?: string }[] = [];
  if (health === "healthy") {
    steps.push({ title: "Stay healthy", body: zone.highLevel ?? zone.description });
    for (const c of zone.recommendedCountermeasures ?? []) steps.push({ title: c });
  } else {
    for (const s of zone.selfExamSteps ?? []) steps.push({ title: s });
    for (const c of zone.recommendedCountermeasures ?? []) steps.push({ title: c });
    if (health === "critical") steps.unshift({ title: "Call for help.", body: "Tell someone nearby to call the Medical Staff." });
  }
  if (doc) steps.push({ title: doc.title, body: technical ? doc.content_technical : doc.content_high_level });
  if (steps.length === 0) steps.push({ title: zone.name, body: zone.description });

  const heading =
    health === "critical" ? "First aid / emergency response" : health === "risk" ? "What you can do" : "Tips to stay healthy";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col p-4", "bg-[var(--panel-tint)]")}>
      <div className="medbay-surface flex min-h-0 flex-1 flex-col">
        <div className={cn("medbay-micro-lg px-4 pt-3", health === "critical" ? "text-critical" : "text-state")}>{heading}</div>
        <ScrollArea className="min-h-0 flex-1">
          <ol className="flex flex-col gap-3 px-4 py-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className={cn("medbay-micro mt-0.5 shrink-0", health === "critical" ? "text-critical" : "text-state")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="medbay-display text-[15px]">{s.title}</div>
                  {s.body && <p className="mt-1 text-[12px] leading-snug text-foreground/85">{s.body}</p>}
                </div>
              </li>
            ))}
          </ol>
        </ScrollArea>
        {doc && <div className="medbay-micro px-4 pb-2 text-foreground/50">SRC: {doc.source_reference}</div>}
      </div>
    </div>
  );
}
