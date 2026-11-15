"use client";

/**
 * PrizeWheel — check-in reward drum (module G, local roll).
 * 12 segments labelled only COMMON / RARE / LEGENDARY; a weighted local roll
 * picks the rarity, then a skin of that tier from the companion catalog
 * (preferring locked ones). The drum lands on the rolled rarity — the
 * animation follows the result, never the other way around.
 */

import { AnimatePresence, motion } from "motion/react";
import { Gift, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { MicroLabel } from "@/components/ui/primitives";
import {
  pickSkinOfRarity,
  rollDrumRarity,
  type DrumRarity,
} from "@/data/gamification";
import { useCheckIn } from "@/hooks/useCheckIn";
import { claimOperatorWheelSpin, completeCheckup } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { useAppStore } from "@/stores/app-store";
import { userStore } from "@/stores/user-store";
import type { SkinDef } from "@/types/health";

const SEG_COUNT = 12;
const SEG_ANGLE = 360 / SEG_COUNT;
const TURNS = 6;
const SPIN_S = 4.2;

/** Visual mix on the drum: 6 common / 4 rare / 2 legendary wedges. */
const SEGMENTS: DrumRarity[] = [
  "common", "rare", "common", "common", "legendary", "common",
  "rare", "common", "common", "legendary", "common", "rare",
];

const RARITY_FILL: Record<DrumRarity, string> = {
  common: "rgba(139,173,250,0.10)",
  rare: "rgba(139,173,250,0.38)",
  legendary: "rgba(217,164,65,0.45)",
};
const RARITY_STROKE: Record<DrumRarity, string> = {
  common: "rgba(139,173,250,0.35)",
  rare: "rgba(139,173,250,0.8)",
  legendary: "rgba(217,164,65,0.9)",
};
const RARITY_LABEL: Record<DrumRarity, string> = {
  common: "COMMON",
  rare: "RARE",
  legendary: "LEGENDARY",
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
  const r = R * 0.66;
  return {
    x: CX + r * Math.cos(mid),
    y: CY + r * Math.sin(mid),
    deg: (index + 0.5) * SEG_ANGLE,
  };
}

interface RolledPrize {
  rarity: DrumRarity;
  skin: SkinDef;
  targetRotation: number;
}

function rollPrize(ownedIds: readonly string[]): RolledPrize {
  const rarity = rollDrumRarity();
  const skin = pickSkinOfRarity(rarity, ownedIds) ?? pickSkinOfRarity("common", [])!;
  const candidates = SEGMENTS.map((s, i) => (s === rarity ? i : -1)).filter(
    (i) => i >= 0,
  );
  const segIndex = candidates[Math.floor(Math.random() * candidates.length)];
  // Pointer sits at 0° — bring the chosen segment's centre to the top.
  const targetRotation = TURNS * 360 - (segIndex + 0.5) * SEG_ANGLE;
  return { rarity, skin, targetRotation };
}

export function PrizeWheel({
  open,
  onOpenChange,
  onClaimed,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onClaimed?: (skin: SkinDef) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="PRIZE DRUM / CHECK-IN REWARD">
      {/* Mounts fresh per opening so the roll happens once, on open. */}
      {open && <DrumContent onOpenChange={onOpenChange} onClaimed={onClaimed} />}
    </Modal>
  );
}

function DrumContent({
  onOpenChange,
  onClaimed,
}: {
  onOpenChange: (o: boolean) => void;
  onClaimed?: (skin: SkinDef) => void;
}) {
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const ownedSkinIds = useAppStore((s) => s.ownedSkinIds);
  const rewardSkin = useAppStore((s) => s.rewardSkin);
  const { activeUser } = useCheckIn();

  const [prize] = useState<RolledPrize>(() => rollPrize(ownedSkinIds));
  const [phase, setPhase] = useState<"spinning" | "reveal">(
    reduceMotion ? "reveal" : "spinning",
  );

  const claim = () => {
    rewardSkin(prize.skin.id);
    onClaimed?.(prize.skin);
    void getRuntimeConfig().then(async (cfg) => {
      if (cfg.dataProvider !== "rest") return;
      try {
        if (activeUser) {
          await claimOperatorWheelSpin({
            user_id: activeUser.id,
            unlocked_skin_id: prize.skin.id,
            equip: true,
          });
        } else {
          await completeCheckup({
            astronaut_id: userStore().users[0]?.astronautId ?? "AST-U00",
            completed_tasks: [],
            perform_gachapon_roll: false,
            unlock_skin_id: prize.skin.id,
          });
        }
      } catch {
        // Local skin unlock already applied; backend sync fails gracefully offline
      }
    });
    onOpenChange(false);
  };

  const wheel = useMemo(
    () => (
      <svg viewBox="0 0 280 280" className="drum-svg" aria-hidden>
        <circle
          cx={CX}
          cy={CY}
          r={R + 14}
          fill="none"
          stroke="var(--line)"
          strokeWidth="1"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R + 8}
          fill="none"
          stroke="var(--dim)"
          strokeWidth="0.5"
          strokeDasharray="2 4"
        />
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: prize.targetRotation }}
          transition={{ duration: SPIN_S, ease: [0.12, 0.65, 0.15, 1] }}
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          onAnimationComplete={() => setPhase("reveal")}
        >
          {SEGMENTS.map((rarity, i) => (
            <g key={i}>
              <path
                d={wedgePath(i)}
                fill={RARITY_FILL[rarity]}
                stroke={RARITY_STROKE[rarity]}
                strokeWidth="0.8"
              />
              <text
                x={labelPos(i).x}
                y={labelPos(i).y}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${labelPos(i).deg} ${labelPos(i).x} ${labelPos(i).y})`}
                className="drum-label"
                fill={
                  rarity === "legendary"
                    ? "rgba(217,164,65,0.95)"
                    : "var(--accent)"
                }
              >
                {RARITY_LABEL[rarity]}
              </text>
            </g>
          ))}
          <circle
            cx={CX}
            cy={CY}
            r={26}
            fill="var(--panel-2)"
            stroke="var(--accent)"
            strokeWidth="1"
          />
        </motion.g>
        {/* pointer */}
        <path
          d={`M ${CX - 8} ${CY - R - 22} L ${CX + 8} ${CY - R - 22} L ${CX} ${CY - R - 6} Z`}
          fill="var(--accent)"
        />
        <circle
          cx={CX}
          cy={CY}
          r={10}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
        />
      </svg>
    ),
    [prize.targetRotation],
  );

  return (
    <div style={{ padding: "18px 22px 22px" }}>
      <AnimatePresence mode="wait">
        {phase === "spinning" && (
          <motion.div
            key="drum"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            style={{ textAlign: "center" }}
          >
            {wheel}
            <MicroLabel>
              <span style={{ display: "block", marginTop: 6 }}>
                DRUM SPINNING…
              </span>
            </MicroLabel>
          </motion.div>
        )}

        {phase === "reveal" && (
          <motion.div
            key={prize.skin.id}
            className="gacha-card"
            initial={{ scale: 0.7, opacity: 0, rotateX: 40 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <div
              className="skin-swatch"
              style={{
                background: `linear-gradient(140deg, ${prize.skin.palette.suit} 55%, ${prize.skin.palette.accent} 55%)`,
              }}
            />
            <div className="micro-8" style={{ color: "var(--accent)" }}>
              <Sparkles size={9} style={{ verticalAlign: -1 }} />{" "}
              {RARITY_LABEL[prize.rarity]} TIER
            </div>
            <div style={{ fontSize: 17, fontWeight: 500, marginTop: 6 }}>
              {prize.skin.name}
            </div>
            <p
              style={{
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 8,
                lineHeight: 1.7,
              }}
            >
              {prize.skin.description}
            </p>
            <button
              className="btn btn-primary"
              onClick={claim}
              style={{ marginTop: 14, width: "100%", justifyContent: "center" }}
            >
              <Gift size={11} /> Claim reward
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
