"use client";

/**
 * PrizeWheel — WEEKLY CHECK IN BONUS (spec §2).
 * Three tiers — COMMON 60 / RARE 30 / MYTHIC 10 — award a Visual AI Model
 * skin (spec design/AI_Model.jpeg). "SPIN IT!" starts the drum; the reveal
 * shows the unlocked mascot and the NEW SKIN indicator clears once the
 * operator views it in the AI panel.
 * The spin itself is consumed through POST /api/v1/auth/claim-wheel-spin
 * (no skin_id — backend only tracks suit skins; mascot skins stay local).
 */

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { MascotStage } from "@/components/mascot/MascotStage";
import { NewSkinIcon } from "@/components/icons/medbay";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import {
  mascotForTier,
  rollWheelTier,
  type MascotRarity,
  type MascotSkinDef,
} from "@/data/mascots";
import { useCheckIn } from "@/hooks/useCheckIn";
import { claimOperatorWheelSpin } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useUserStore } from "@/stores/user-store";

const SEG_COUNT = 10;
const SEG_ANGLE = 360 / SEG_COUNT;
const TURNS = 6;
const SPIN_S = 4.0;

/** Drum mix matching the roll weights: 6 common / 3 rare / 1 mythic. */
const SEGMENTS: MascotRarity[] = [
  "common", "rare", "common", "common", "mythic", "common", "rare", "common", "common", "rare",
];

const RARITY_COLOR: Record<MascotRarity, string> = {
  common: "rgba(160,170,190,0.18)",
  rare: "rgba(110,170,255,0.45)",
  mythic: "rgba(255,190,60,0.5)",
};
const RARITY_TEXT: Record<MascotRarity, string> = {
  common: "rgba(220,226,238,0.85)",
  rare: "rgba(140,190,255,0.95)",
  mythic: "rgba(255,200,90,0.98)",
};

const R = 120;
const CX = 140;
const CY = 140;

function wedgePath(index: number): string {
  const a0 = ((index * SEG_ANGLE - 90) * Math.PI) / 180;
  const a1 = (((index + 1) * SEG_ANGLE - 90) * Math.PI) / 180;
  const x0 = CX + R * Math.cos(a0);
  const y0 = CY + R * Math.sin(a0);
  const x1 = CX + R * Math.cos(a1);
  const y1 = CY + R * Math.sin(a1);
  return `M ${CX} ${CY} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function labelPos(index: number): { x: number; y: number; deg: number } {
  const mid = ((index + 0.5) * SEG_ANGLE - 90) * (Math.PI / 180);
  const r = R * 0.74;
  const deg = (index + 0.5) * SEG_ANGLE;
  // Keep labels upright: flip the ones that would render upside-down.
  const flipped = deg % 360 > 90 && deg % 360 < 270;
  return { x: CX + r * Math.cos(mid), y: CY + r * Math.sin(mid), deg: deg + (flipped ? 180 : 0) };
}

/** Segment divider — thin radial tick between wedges for the drum look. */
function dividerPath(index: number): string {
  const a = ((index * SEG_ANGLE - 90) * Math.PI) / 180;
  const x0 = CX + (R * 0.42) * Math.cos(a);
  const y0 = CY + (R * 0.42) * Math.sin(a);
  const x1 = CX + R * Math.cos(a);
  const y1 = CY + R * Math.sin(a);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

interface RolledPrize {
  tier: MascotRarity;
  skin: MascotSkinDef;
  alreadyOwned: boolean;
  targetRotation: number;
}

function rollPrize(owned: string[]): RolledPrize {
  const tier = rollWheelTier();
  const skin = mascotForTier(tier);
  const winnerIndex = SEGMENTS.findIndex((r) => r === tier);
  const targetRotation = TURNS * 360 + (360 - (winnerIndex + 0.5) * SEG_ANGLE);
  return { tier, skin, alreadyOwned: owned.includes(skin.id), targetRotation };
}

export function PrizeWheel({
  open,
  onOpenChange,
  onClaimed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClaimed?: (skin: MascotSkinDef) => void;
}) {
  const everyN = useAppStore((s) => s.wheelCadenceDays);
  // Spec cadence is 7 ("weekly"); test/dev environments may run a shorter cycle.
  const title = everyN === 7 ? "WEEKLY CHECK IN BONUS" : "CHECK IN BONUS";
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title}>
      {open && <DrumContent onClaimed={onClaimed} onOpenChange={onOpenChange} />}
    </Modal>
  );
}

function DrumContent({
  onClaimed,
  onOpenChange,
}: {
  onClaimed?: (skin: MascotSkinDef) => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const everyN = useAppStore((s) => s.wheelCadenceDays);
  const { activeUser } = useCheckIn();
  const extras = useUserStore((s) => (activeUser ? s.extras[activeUser.id] : undefined));
  const unlockMascot = useUserStore((s) => s.unlockMascot);

  const [prize] = useState<RolledPrize>(() => rollPrize(extras?.mascotSkins ?? []));
  const [phase, setPhase] = useState<"idle" | "spinning" | "reveal">(
    reduceMotion ? "reveal" : "idle",
  );
  const [claimed, setClaimed] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const spin = () => setPhase("spinning");

  const claim = () => {
    if (claimed) return;
    setClaimed(true);
    if (activeUser) unlockMascot(activeUser.id, prize.skin.id);
    onClaimed?.(prize.skin);
    void getRuntimeConfig().then(async (cfg) => {
      if (cfg.dataProvider !== "rest" || !activeUser) return;
      try {
        // Consume the spin server-side; mascot skin IDs stay local-only.
        await claimOperatorWheelSpin({ user_id: activeUser.id });
      } catch {
        // Local unlock already applied — backend sync fails gracefully offline.
      }
    });
    // Brief beat so the "skin added" state lands, then close the modal.
    closeTimer.current = setTimeout(() => onOpenChange?.(false), 700);
  };

  const wheel = useMemo(
    () => (
      <svg viewBox="0 0 280 280" className="h-auto w-full" aria-hidden>
        <circle cx={CX} cy={CY} r={R + 14} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={R + 8} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" strokeDasharray="2 4" />
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: phase === "idle" ? 0 : prize.targetRotation }}
          transition={{ duration: SPIN_S, ease: [0.12, 0.65, 0.15, 1] }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          onAnimationComplete={() => phase === "spinning" && setPhase("reveal")}
        >
          {SEGMENTS.map((rarity, i) => (
            <g key={i}>
              <path
                d={wedgePath(i)}
                fill={RARITY_COLOR[rarity]}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="0.6"
              />
              <path
                d={dividerPath(i)}
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.7"
              />
              <text
                x={labelPos(i).x}
                y={labelPos(i).y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${labelPos(i).deg} ${labelPos(i).x} ${labelPos(i).y})`}
                style={{ font: "600 8px var(--font-mono), monospace", letterSpacing: "0.08em" }}
                fill={RARITY_TEXT[rarity]}
              >
                {rarity.toUpperCase()}
              </text>
            </g>
          ))}
          <circle cx={CX} cy={CY} r={26} fill="rgba(6,8,12,0.9)" stroke="var(--state)" strokeWidth="1" />
        </motion.g>
        <path d={`M ${CX - 8} ${CY - R - 22} L ${CX + 8} ${CY - R - 22} L ${CX} ${CY - R - 6} Z`} fill="var(--state)" />
        <circle cx={CX} cy={CY} r={10} fill="none" stroke="var(--state)" strokeWidth="0.8" />
      </svg>
    ),
    [prize.targetRotation, phase],
  );

  return (
    <div className="px-6 py-5">
      <h2 className="medbay-display text-center text-2xl tracking-widest">
        {everyN === 7 ? "Weekly check in bonus" : "Check in bonus"}
      </h2>
      <p className="medbay-micro mt-1 text-center text-foreground/60">
        {everyN === 7
          ? "One week of check-ins — one spin for a new Visual AI Model skin."
          : `Every ${everyN === 1 ? "check-in" : `${everyN} check-in days`} earns a spin for a new Visual AI Model skin.`}
      </p>

      <div className="relative mx-auto mt-4 w-[min(320px,72vw)]">
        {wheel}
        <AnimatePresence>
          {phase === "reveal" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 grid place-items-center"
            >
              <div className="flex flex-col items-center gap-2 border border-state bg-black/95 px-6 py-5">
                <MascotStage skin={prize.skin.id} emotion="happy" size={96} />
                <span className="medbay-display text-sm uppercase tracking-widest">
                  {prize.skin.name}
                </span>
                <span
                  className={cn("medbay-micro")}
                  style={{ color: RARITY_TEXT[prize.tier] }}
                >
                  {prize.tier} skin
                </span>
                {!prize.alreadyOwned && (
                  <span className="flex items-center gap-1.5 text-[#ffd75e]">
                    <NewSkinIcon size={14} />
                    <span className="medbay-micro">New skin</span>
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 flex justify-center">
        {phase === "reveal" ? (
          <Button size="lg" onClick={claim} disabled={claimed}>
            {claimed ? "Skin added to your AI" : "Collect"}
          </Button>
        ) : (
          <Button size="lg" onClick={spin} disabled={phase === "spinning"}>
            {phase === "spinning" ? "Spinning…" : "SPIN IT!"}
          </Button>
        )}
      </div>
    </div>
  );
}
