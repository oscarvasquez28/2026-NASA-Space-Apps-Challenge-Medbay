"use client";

/**
 * /crew — MEDBAY USERS browsing (spec §9): every enrolled operator as a
 * colour-coded card (HEALTHY green / RISK yellow / CRITICAL red ring), a
 * notification strip naming the most urgent case, search + filter, and a
 * list/grid toggle. Cards link into the shared Astronaut View.
 */

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AstronautIcon, GridViewIcon, ListViewIcon } from "@/components/icons/medbay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCrew } from "@/hooks/useCrew";
import { crewNotification } from "@/lib/medbay-copy";
import { cn } from "@/lib/utils";
import type { CrewMember, TriageLevel } from "@/types/health";

const FILTERS: { id: TriageLevel | "all"; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "NOMINAL", label: "HEALTHY" },
  { id: "CAUTION", label: "CAUTION" },
  { id: "URGENT", label: "RISK" },
  { id: "CRITICAL", label: "CRITICAL" },
];

const ORDER: TriageLevel[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];

function worstOf(c: CrewMember) {
  return [...c.zones].sort((a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status))[0];
}

function healthClass(status: TriageLevel) {
  if (status === "CRITICAL") return "health-critical";
  if (status === "NOMINAL") return "health-ok";
  return "health-risk";
}

export default function CrewPage() {
  const { crew, loading, error } = useCrew();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [grid, setGrid] = useState(true);

  const notification = useMemo(() => crewNotification(crew), [crew]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crew.filter((c) => {
      const worst = worstOf(c)?.status;
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      {/* most-urgent notification strip (spec §9) */}
      {notification && (
        <Link
          href={`/crew/${notification.member.id}`}
          className="medbay-copy flex items-center gap-3 border border-risk bg-[color-mix(in_srgb,var(--medbay-risk)_15%,black)] px-4 py-3 text-[15px] hover:border-critical"
        >
          <BellIcon size={15} className="shrink-0 text-risk" />
          <span>
            {notification.message.lead}
            <span className="text-risk">{notification.message.emphasis}</span>
            {notification.message.tail}
          </span>
          <span className="medbay-micro ml-auto">OPEN →</span>
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="medbay-display text-xl tracking-widest">Users</h1>
        <span className="medbay-micro text-foreground/60">
          {loading ? "…" : `${filtered.length}/${crew.length} shown`}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Input
            type="search"
            placeholder="Search name, callsign…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search crew"
            className="w-56"
          />
          <div className="flex border border-input" role="group" aria-label="Status filter">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "medbay-micro px-3 py-2",
                  filter === f.id ? "bg-foreground text-black" : "hover:text-state",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={grid ? "Switch to list" : "Switch to grid"}
            onClick={() => setGrid((g) => !g)}
          >
            {grid ? <ListViewIcon size={18} /> : <GridViewIcon size={18} />}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/compare">Compare</Link>
          </Button>
        </div>
      </div>

      {loading && <div className="medbay-micro text-foreground/60" role="status">Linking crew manifest…</div>}
      {error && !loading && <div className="medbay-micro text-risk" role="alert">{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div className="medbay-micro text-foreground/60">No subjects match the query</div>
      )}

      <div className={cn(grid ? "grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4" : "flex flex-col gap-2")}>
        {filtered.map((c) => {
          const worst = worstOf(c);
          const h = healthClass(worst.status);
          return (
            <Link
              key={c.id}
              href={`/crew/${c.id}`}
              className={cn(
                "medbay-surface group flex transition-all hover:-translate-y-0.5",
                grid ? "flex-col" : "items-center gap-4 px-4 py-2",
                h === "health-critical"
                  ? "medbay-surface-critical hover:shadow-[0_10px_28px_rgba(0,0,0,0.55),0_0_18px_color-mix(in_srgb,var(--medbay-critical)_35%,transparent)]"
                  : h === "health-risk"
                    ? "medbay-surface-risk hover:shadow-[0_10px_28px_rgba(0,0,0,0.55),0_0_18px_color-mix(in_srgb,var(--medbay-risk)_35%,transparent)]"
                    : "hover:border-state/60 hover:shadow-[0_10px_28px_rgba(0,0,0,0.55),0_0_18px_var(--accent-soft)]",
              )}
            >
              <div
                className={cn(
                  "relative grid shrink-0 place-items-center overflow-hidden",
                  grid ? "aspect-square w-full" : "size-14",
                  h === "health-critical"
                    ? "bg-[color-mix(in_srgb,var(--medbay-critical)_30%,black)]"
                    : h === "health-risk"
                      ? "bg-[color-mix(in_srgb,var(--medbay-risk)_30%,black)]"
                      : "bg-[color-mix(in_srgb,var(--medbay-ok)_25%,black)]",
                )}
              >
                {c.facePhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.facePhoto} alt="" className="size-full object-cover" />
                ) : (
                  <AstronautIcon size={grid ? 56 : 26} className="text-foreground/70" />
                )}
              </div>
              <div className={cn("min-w-0 px-3 py-2.5", !grid && "flex flex-1 items-center gap-4 py-0")}>
                <div className="min-w-0">
                  <div className="medbay-display truncate text-[14px]">{c.name}</div>
                  <div className="medbay-micro text-foreground/60">
                    {c.callsign} · {c.role}
                  </div>
                </div>
                <span
                  className={cn(
                    "medbay-micro mt-1 inline-block",
                    h === "health-critical" ? "text-critical" : h === "health-risk" ? "text-risk" : "text-ok",
                    !grid && "ml-auto mt-0",
                  )}
                >
                  {worst.status === "NOMINAL" ? "HEALTHY" : worst.status === "CRITICAL" ? "CRITICAL" : "RISK"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
