"use client";

/**
 * /log — telemetry & logger page (module E host).
 */

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Eyebrow } from "@/components/ui/primitives";
import { TelemetryLogger } from "@/components/widgets/TelemetryLogger";
import { useCrew } from "@/hooks/useCrew";

function LogInner() {
  const params = useSearchParams();
  const { crew } = useCrew();
  const [crewId, setCrewId] = useState(params.get("crew") ?? "AST-01");

  return (
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow>Telemetry log / ingest console</Eyebrow>
        <select
          className="ctx-select"
          style={{ marginLeft: "auto" }}
          aria-label="Subject"
          value={crewId}
          onChange={(e) => setCrewId(e.target.value)}
        >
          {(crew.length ? crew : [{ id: crewId } as never]).map((c) => (
            <option key={(c as { id: string }).id} value={(c as { id: string }).id}>
              {(c as { callsign?: string }).callsign ?? (c as { id: string }).id}
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginTop: 16 }}>
        <TelemetryLogger crewId={crewId} />
      </div>
    </div>
  );
}

export default function LogPage() {
  return (
    <Suspense fallback={<div className="empty-state mono">LOADING…</div>}>
      <LogInner />
    </Suspense>
  );
}
