"use client";

/**
 * /compare — MEDBAY comparison view (spec §9): pick two enrolled operators,
 * get the "X IS MORE AT RISK" verdict, per-zone status table and a radar of
 * normalized zone status. Provider data only — no clinical prioritization.
 */

import { useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

import { StatusChip } from "@/components/ui/primitives";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useCrew } from "@/hooks/useCrew";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useUserStore } from "@/stores/user-store";
import type { CrewMember, TriageLevel } from "@/types/health";

const ORDER: TriageLevel[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];

function worst(member: CrewMember): TriageLevel {
  return [...member.zones].sort((a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status))[0].status;
}

function radarRows(a: CrewMember, b: CrewMember) {
  return a.zones.map((za) => {
    const zb = b.zones.find((z) => z.id === za.id);
    const avg = (m: CrewMember, zid: string) => {
      const z = m.zones.find((x) => x.id === zid);
      if (!z) return 0;
      return Math.max(0, 100 - ORDER.indexOf(z.status) * 25);
    };
    return {
      zone: za.id,
      [a.callsign]: avg(a, za.id),
      [b?.callsign ?? "B"]: zb ? avg(b, zb.id) : 0,
    };
  });
}

const HEALTH_WORD: Record<TriageLevel, string> = {
  NOMINAL: "HEALTHY",
  CAUTION: "RISK",
  URGENT: "RISK",
  CRITICAL: "CRITICAL",
};

export default function ComparePage() {
  const { crew, loading } = useCrew();
  const viewMode = useAppStore((s) => s.viewMode);
  const technical = viewMode === "technical";
  const { activeUser } = useCheckIn();
  const users = useUserStore((s) => s.users);
  const [idA, setIdA] = useState(() => activeUser?.astronautId ?? "");
  const [idB, setIdB] = useState(
    () => users.find((u) => u.astronautId !== activeUser?.astronautId)?.astronautId ?? "",
  );

  const a = crew.find((c) => c.id === idA);
  const b = crew.find((c) => c.id === idB);
  const radar = useMemo(() => (a && b ? radarRows(a, b) : []), [a, b]);

  const verdict = useMemo(() => {
    if (!a || !b) return null;
    const wa = worst(a);
    const wb = worst(b);
    if (wa === wb) {
      const first = a.readiness.score <= b.readiness.score ? a : b;
      return {
        text: `${first.callsign} is more at risk`,
        detail: `Both read ${HEALTH_WORD[wa]} — readiness ${a.readiness.score} vs ${b.readiness.score}.`,
      };
    }
    const worse = ORDER.indexOf(wb) > ORDER.indexOf(wa) ? b : a;
    return {
      text: `${worse.callsign} is more at risk`,
      detail: `Worst zone status ${HEALTH_WORD[ORDER.indexOf(wb) > ORDER.indexOf(wa) ? wb : wa]}.`,
    };
  }, [a, b]);

  const selector = (value: string, onChange: (v: string) => void, label: string) => (
    <select
      className="flex h-9 border border-input bg-black px-3 text-sm"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {crew.map((c) => (
        <option key={c.id} value={c.id}>
          {c.callsign} · {c.id}
        </option>
      ))}
    </select>
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="medbay-display text-xl tracking-widest">Compare</h1>
        {selector(idA, setIdA, "Subject A")}
        <span className="medbay-micro text-foreground/60">vs</span>
        {selector(idB, setIdB, "Subject B")}
      </div>

      {loading && <div className="medbay-micro text-foreground/60" role="status">Linking…</div>}

      {a && b && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4">
          {/* verdict */}
          {verdict && (
            <div className="flex flex-col items-center justify-center border border-input bg-[var(--panel-tint)] p-6 text-center">
              <span className="medbay-micro text-foreground/60">Verdict</span>
              <span className="medbay-display mt-2 text-[clamp(20px,2.4vw,32px)] uppercase leading-tight">
                {verdict.text}
              </span>
              <p className="medbay-copy mt-2 text-[13px] text-foreground/70">{verdict.detail}</p>
              <p className="medbay-micro mt-4 text-foreground/45">
                Comparative rendering of provider statuses — no clinical prioritization. Simulated data.
              </p>
            </div>
          )}

          {/* radar */}
          <div className="border border-input p-4">
            <div className="medbay-micro text-foreground/70">Zone status (normalized)</div>
            <div className="mt-2 h-[300px]" role="img" aria-label="Radar comparison of zone status">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="rgba(255,255,255,0.15)" />
                  <PolarAngleAxis
                    dataKey="zone"
                    tick={{ fontSize: 8, fontFamily: "var(--font-mono)", fill: "rgba(255,255,255,0.6)" }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={a.callsign} dataKey={a.callsign} stroke="var(--state)" fill="var(--state)" fillOpacity={0.18} />
                  <Radar name={b.callsign} dataKey={b.callsign} stroke="var(--medbay-risk)" fill="var(--medbay-risk)" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="medbay-micro flex gap-4">
              <span className="text-state">— {a.callsign}</span>
              <span className="text-risk">— {b.callsign}</span>
            </div>
          </div>

          {/* status table */}
          <div className="border border-input p-4">
            <div className="medbay-micro text-foreground/70">Status by zone</div>
            <table className="medbay-copy mt-3 w-full text-[13px]">
              <thead>
                <tr className="medbay-micro text-foreground/60">
                  <th className="pb-2 text-left font-normal">Zone</th>
                  <th className="pb-2 text-left font-normal">{a.callsign}</th>
                  <th className="pb-2 text-left font-normal">{b.callsign}</th>
                </tr>
              </thead>
              <tbody>
                {a.zones.map((za) => {
                  const zb = b.zones.find((z) => z.id === za.id)!;
                  return (
                    <tr key={za.id} className="border-t border-input">
                      <th scope="row" className="py-2 text-left font-normal">
                        {technical ? za.id : za.name}
                      </th>
                      <td className="py-2"><StatusChip level={za.status} /></td>
                      <td className="py-2"><StatusChip level={zb.status} /></td>
                    </tr>
                  );
                })}
                <tr className="border-t border-input">
                  <th scope="row" className="py-2 text-left font-normal">Readiness</th>
                  <td className="py-2">{a.readiness.score}/100</td>
                  <td className="py-2">{b.readiness.score}/100</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <span className={cn("hidden")} aria-hidden />
    </div>
  );
}
