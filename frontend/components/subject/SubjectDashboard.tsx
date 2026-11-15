"use client";

/**
 * Vitals dashboard (spec §6, ASTRONAUT VIEW - RISK - DASHBOARD): every
 * supported vital in its own graph tile, name + status in the header (via
 * `useHeadline`), 3D model and location tile hidden, AI panel expanded.
 */

import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

import { VisualAI } from "@/components/medbay/VisualAI";
import { suggestFaqs } from "@/lib/medbay-copy";
import { tileStates } from "@/lib/medbay-vitals";
import { cn } from "@/lib/utils";
import { HEALTH_LABEL } from "@/hooks/useHealthState";
import type { HealthState } from "@/stores/app-store";
import { useHeaderStore } from "@/stores/header-store";
import type { CrewMember } from "@/types/health";
import { VitalGraph } from "./VitalGraph";
import { GraphToggles, TILE_ICON } from "./VitalTiles";

export function SubjectDashboard({
  member,
  health,
  technical,
  onBack,
}: {
  member: CrewMember;
  health: HealthState;
  technical: boolean;
  onBack: () => void;
}) {
  const setHeadline = useHeaderStore((s) => s.setHeadline);
  const tiles = tileStates(member, technical);

  useEffect(() => {
    setHeadline({
      lead: { name: member.name.toUpperCase(), photo: member.facePhoto },
      title: "|",
      sub: HEALTH_LABEL[health],
      subTone: health === "critical" ? "critical" : health === "risk" ? "risk" : "state",
    });
    return () => setHeadline(null);
  }, [member, health, setHeadline]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden px-6 py-5">
      <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4 overflow-y-auto pr-1">
        {tiles.map((t) => {
          const Icon = TILE_ICON[t.def.id];
          const risky = t.verdict !== "ok" && t.verdict !== "none";
          return (
            <div key={t.def.id} className={cn("flex flex-col border bg-black p-3", risky ? "border-risk" : "border-input")}>
              <div className="flex items-center gap-2.5">
                <Icon size={22} className={risky ? "text-risk" : undefined} />
                <span className="medbay-display flex-1 text-[13px] uppercase">
                  {t.def.title}
                  {t.verdict === "high" || t.verdict === "flagged" ? " high" : t.verdict === "low" ? " low" : ""}
                </span>
                <GraphToggles mode="history" onMode={() => {}} size={26} />
              </div>
              <div className="mt-2 min-h-[150px] flex-1 border border-input">
                <VitalGraph crewId={member.id} metric={t.def.metric} mode="history" />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex h-[240px] shrink-0 items-stretch gap-4">
        <button
          type="button"
          onClick={onBack}
          className="medbay-display flex w-44 flex-col items-center justify-center gap-3 border border-input text-xl transition-colors hover:border-state"
        >
          <ArrowLeft size={34} />
          Back
        </button>
        <VisualAI
          member={member}
          variant="dock"
          size={240}
          faqs={suggestFaqs(tiles)}
          caption={false}
          className="flex-1"
        />
      </div>
    </div>
  );
}
