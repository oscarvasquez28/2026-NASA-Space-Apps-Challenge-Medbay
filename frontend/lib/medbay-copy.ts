/**
 * MEDBAY "general information box" copy (spec §3–§5, §9) and the Visual AI
 * FAQ suggestions. Deterministic — built from zones, vitals and trends.
 */

import type { HealthState } from "@/stores/app-store";
import type { BodyZone, CrewMember, TelemetrySeries } from "@/types/health";
import { atRisk, type TileState, verdictSentence } from "./medbay-vitals";

export interface InfoMessage {
  lead: string;
  /** Emphasised fragment, rendered in the state colour (yellow/red). */
  emphasis?: string;
  tail?: string;
}

const RANK = { NOMINAL: 0, CAUTION: 1, URGENT: 2, CRITICAL: 3 } as const;

export function worstZoneOf(zones: BodyZone[]): BodyZone | undefined {
  return [...zones].sort((a, b) => RANK[b.status] - RANK[a.status])[0];
}

function issueOf(zone: BodyZone): string {
  return (zone.activeRisks?.[0] ?? `${zone.name} critical`).replace(/_/g, " ");
}

/** Healthy: a statistic that improved since the last reading. */
export function improvedStat(series: TelemetrySeries[]): InfoMessage | null {
  const phrase: Record<string, string> = {
    blood_sugar: "Your sugar levels are",
    heart_rate: "Your heart rate is",
    spo2: "Your oxygen levels are",
    core_temp: "Your temperature is",
  };
  for (const s of series) {
    const pts = s.points;
    if (pts.length < 2 || !s.band) continue;
    const prev = pts[pts.length - 2].value;
    const last = pts[pts.length - 1].value;
    const mid = (s.band.low + s.band.high) / 2;
    if (Math.abs(last - mid) < Math.abs(prev - mid) - 1e-6) {
      return { lead: `${phrase[s.metric] ?? `Your ${s.label.toLowerCase()} is`} better than yesterday.` };
    }
  }
  return null;
}

export function infoMessage(
  health: HealthState,
  zones: BodyZone[],
  tiles: TileState[],
  improved: InfoMessage | null,
  focusZone?: BodyZone | null,
): InfoMessage {
  if (focusZone) {
    const z = focusZone;
    if (z.status === "CRITICAL") return { lead: `${issueOf(z)}.`, emphasis: "Medical professional needed." };
    if (z.status !== "NOMINAL")
      return {
        lead: `${z.name}: `,
        emphasis: z.recommendedCountermeasures?.[0] ?? "follow the self-care steps below",
        tail: ".",
      };
    return { lead: z.highLevel ?? `${z.name} looks healthy.` };
  }

  const worst = worstZoneOf(zones);
  if (health === "critical" && worst) {
    return { lead: `Ongoing ${issueOf(worst)}.`, emphasis: "Medical professional needed." };
  }
  if (health === "risk") {
    const risky = tiles.find((t) => atRisk(t.verdict));
    if (risky) {
      return { lead: `${verdictSentence(risky.def, risky.verdict)}, `, emphasis: "consult the Medical Professional", tail: "." };
    }
    if (worst) {
      const fix = worst.recommendedCountermeasures?.[0];
      return fix
        ? { lead: `${worst.name} needs attention — `, emphasis: fix, tail: "." }
        : { lead: `${worst.name} needs attention, `, emphasis: "consult the Medical Professional", tail: "." };
    }
  }
  return improved ?? { lead: "All your vitals are within the nominal range." };
}

/** Technical notification centre: the most pressing issue across the crew. */
export function crewNotification(crew: CrewMember[]): { member: CrewMember; message: InfoMessage } | null {
  let best: { member: CrewMember; zone: BodyZone } | null = null;
  for (const m of crew) {
    const z = worstZoneOf(m.zones);
    if (z && z.status !== "NOMINAL" && (!best || RANK[z.status] > RANK[best.zone.status])) best = { member: m, zone: z };
  }
  if (!best) return null;
  const first = best.member.name.split(" ")[0];
  return best.zone.status === "CRITICAL"
    ? { member: best.member, message: { lead: `${first} is suffering a `, emphasis: issueOf(best.zone), tail: "." } }
    : { member: best.member, message: { lead: `${first} needs attention: `, emphasis: best.zone.name, tail: "." } };
}

const FAQ_BY_TILE: Record<string, string[]> = {
  temp: ["How do I lower my temperature?"],
  sleep: ["How can I sleep better?", "Is it okay if I don't sleep 8 hrs?"],
  hr: ["How do I bring my heart rate down?"],
  spo2: ["What should I do if my oxygen is low?"],
  bp: ["How can I lower my blood pressure?"],
  glucose: ["How do I keep my sugar levels stable?"],
  radiation: ["How do I reduce my radiation exposure?"],
};

export function suggestFaqs(tiles: TileState[], zone?: BodyZone | null): string[] {
  const out: string[] = [];
  if (zone) out.push(`What does my ${zone.name.split(" /")[0].toLowerCase()} status mean?`);
  for (const t of tiles) if (atRisk(t.verdict)) out.push(...(FAQ_BY_TILE[t.def.id] ?? []));
  if (out.length < 3) out.push("Explain my current status", "How can I stay healthy today?", "How can I sleep better?");
  return [...new Set(out)].slice(0, 3);
}
