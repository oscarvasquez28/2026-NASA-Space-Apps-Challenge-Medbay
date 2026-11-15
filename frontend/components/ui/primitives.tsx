import type { ReactNode } from "react";

import type { TriageLevel } from "@/types/health";

/** Section label: 4px accent square + tiny uppercase mono text. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="eyebrow">
      <span className="tiny-square" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Glowing 5px status dot; variant follows triage severity. */
export function StatusDot({
  level = "NOMINAL",
}: {
  level?: TriageLevel | "OFFLINE";
}) {
  const cls =
    level === "OFFLINE" ? "offline" : level.toLowerCase();
  return <span className={`status-dot ${cls}`} aria-hidden />;
}

const CHIP_LABEL: Record<TriageLevel, string> = {
  NOMINAL: "NOMINAL",
  CAUTION: "CAUTION",
  URGENT: "URGENT",
  CRITICAL: "CRITICAL",
};

/** Bordered mono chip showing a triage level with its semantic token. */
export function StatusChip({ level }: { level: TriageLevel }) {
  return (
    <span className={`status-chip ${level.toLowerCase()}`}>
      <StatusDot level={level} />
      {CHIP_LABEL[level]}
    </span>
  );
}

export function MicroLabel({ children }: { children: ReactNode }) {
  return <div className="micro">{children}</div>;
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="disclaimer">{children}</p>;
}

export const HONESTY_LABEL =
  "SIMULATED TELEMETRY · NOT A MEDICAL DEVICE · CURATED DATASETS";

/** Corner "+" ornaments wrapper for empty states / previews. */
export function CrosshairBox({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`crosshair ${className}`}>{children}</div>;
}
