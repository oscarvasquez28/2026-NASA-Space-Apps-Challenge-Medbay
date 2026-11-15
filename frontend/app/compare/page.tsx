"use client";

/**
 * /compare — two crew members side by side: status table, radar chart of
 * normalized zone-vitals, readiness bars. Provider data only.
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

import { Disclaimer, Eyebrow, StatusChip } from "@/components/ui/primitives";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useCrew } from "@/hooks/useCrew";
import { useAppStore } from "@/stores/app-store";
import { useUserStore } from "@/stores/user-store";
import type { CrewMember, TriageLevel } from "@/types/health";

const ORDER: TriageLevel[] = ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"];

function worst(member: CrewMember): TriageLevel {
  return [...member.zones].sort(
    (a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status),
  )[0].status;
}

function radarRows(a: CrewMember, b: CrewMember) {
  return a.zones.map((za) => {
    const zb = b.zones.find((z) => z.id === za.id);
    const avg = (m: CrewMember, zid: string) => {
      const z = m.zones.find((x) => x.id === zid);
      if (!z) return 0;
      // normalized: 100 - severityIndex*25 - count flags weight
      const sev = ORDER.indexOf(z.status);
      return Math.max(0, 100 - sev * 25);
    };
    return {
      zone: za.id,
      [a.callsign]: avg(a, za.id),
      [b?.callsign ?? "B"]: zb ? avg(b, zb.id) : 0,
    };
  });
}

export default function ComparePage() {
  const { crew, loading } = useCrew();
  const viewMode = useAppStore((s) => s.viewMode);
  const technical = viewMode === "technical";
  const { activeUser } = useCheckIn();
  const users = useUserStore((s) => s.users);
  const [idA, setIdA] = useState(() => activeUser?.astronautId ?? "");
  const [idB, setIdB] = useState(
    () =>
      users.find((u) => u.astronautId !== activeUser?.astronautId)
        ?.astronautId ?? "",
  );

  const a = crew.find((c) => c.id === idA);
  const b = crew.find((c) => c.id === idB);
  const radar = useMemo(() => (a && b ? radarRows(a, b) : []), [a, b]);

  const verdict = useMemo(() => {
    if (!a || !b) return null;
    const wa = worst(a);
    const wb = worst(b);
    if (wa === wb)
      return `Both subjects read ${wa}. Readiness: ${a.readiness.score} vs ${b.readiness.score} — prioritize ${a.readiness.score <= b.readiness.score ? a.callsign : b.callsign} for the next check window.`;
    return `${ORDER.indexOf(wb) > ORDER.indexOf(wa) ? b.callsign : a.callsign} requires attention first — worst zone status ${ORDER.indexOf(wb) > ORDER.indexOf(wa) ? wb : wa}.`;
  }, [a, b]);

  const selector = (
    value: string,
    onChange: (v: string) => void,
    label: string,
  ) => (
    <select
      className="ctx-select"
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
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow>Compare / subjects</Eyebrow>
        {selector(idA, setIdA, "Subject A")}
        <span className="micro-8">VS</span>
        {selector(idB, setIdB, "Subject B")}
      </div>

      {loading && <div className="empty-state mono" role="status">LINKING…</div>}

      {a && b && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 14,
            marginTop: 16,
          }}
        >
          {/* radar */}
          <div className="panel panel-pad">
            <Eyebrow>Zone status radar (normalized)</Eyebrow>
            <div style={{ height: 300, marginTop: 8 }} role="img" aria-label="Radar comparison of zone status">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="var(--line)" />
                  <PolarAngleAxis
                    dataKey="zone"
                    tick={{ fontSize: 8, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name={a.callsign}
                    dataKey={a.callsign}
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.18}
                  />
                  <Radar
                    name={b.callsign}
                    dataKey={b.callsign}
                    stroke="var(--status-urgent)"
                    fill="var(--status-urgent)"
                    fillOpacity={0.15}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="micro-8" style={{ display: "flex", gap: 16 }}>
              <span style={{ color: "var(--accent)" }}>— {a.callsign}</span>
              <span style={{ color: "var(--status-urgent)" }}>— {b.callsign}</span>
            </div>
          </div>

          {/* status table */}
          <div className="panel panel-pad">
            <Eyebrow>Status by zone</Eyebrow>
            <table className="spec-table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>ZONE</th>
                  <th>{a.callsign}</th>
                  <th>{b.callsign}</th>
                </tr>
              </thead>
              <tbody>
                {a.zones.map((za) => {
                  const zb = b.zones.find((z) => z.id === za.id)!;
                  return (
                    <tr key={za.id}>
                      <th scope="row">{technical ? za.id : za.name}</th>
                      <td><StatusChip level={za.status} /></td>
                      <td><StatusChip level={zb.status} /></td>
                    </tr>
                  );
                })}
                <tr>
                  <th scope="row">Readiness</th>
                  <td>{a.readiness.score}/100</td>
                  <td>{b.readiness.score}/100</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* verdict */}
          <div className="panel panel-pad">
            <Eyebrow>Recommendation</Eyebrow>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10, lineHeight: 1.8 }}>
              {verdict}
            </p>
            <Disclaimer>
              Comparative rendering of provider statuses — no clinical
              prioritization is computed. SIMULATED DATA.
            </Disclaimer>
          </div>
        </div>
      )}
    </div>
  );
}
