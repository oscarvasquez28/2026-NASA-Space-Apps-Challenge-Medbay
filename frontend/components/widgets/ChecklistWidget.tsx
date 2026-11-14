"use client";

/**
 * ChecklistWidget + GachaponModal — gamification module (G).
 * Daily checkup checklist; completing all items unlocks a gachapon pull
 * that awards a companion "suit skin" card with a pull animation.
 */

import { AnimatePresence, motion } from "motion/react";
import { Check, Gift, Sparkles } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import {
  Eyebrow,
  MicroLabel,
} from "@/components/ui/primitives";
import { useGamification } from "@/hooks/useGamification";
import { useAppStore } from "@/stores/app-store";
import type { SkinDef } from "@/types/health";

const RARITY_LABEL: Record<SkinDef["rarity"], string> = {
  common: "COMMON",
  rare: "RARE",
  legendary: "LEGENDARY",
};

export function ChecklistWidget({ crewId }: { crewId: string }) {
  const {
    checklist,
    allDone,
    toggleChecklist,
    streakDays,
    pulling,
    lastPull,
    pull,
  } = useGamification(crewId);
  const viewMode = useAppStore((s) => s.viewMode);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="panel panel-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Eyebrow>Daily checkup</Eyebrow>
        <span className="micro-8" style={{ marginLeft: "auto" }}>
          STREAK {String(streakDays).padStart(2, "0")} SOL
        </span>
      </div>

      <div style={{ marginTop: 8 }}>
        {checklist.map((item) => (
          <button
            key={item.id}
            className={`check-item${item.done ? " done" : ""}`}
            onClick={() => toggleChecklist(item.id)}
            aria-pressed={item.done}
            style={{ width: "100%", textAlign: "left" }}
          >
            <span className="check-box">
              {item.done && <Check size={10} strokeWidth={3} />}
            </span>
            {item.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
        }}
      >
        <button
          className="btn btn-primary"
          disabled={!allDone || pulling}
          onClick={() => {
            setModalOpen(true);
            void pull();
          }}
        >
          <Gift size={11} />
          {pulling ? "Pulling…" : "Open gachapon"}
        </button>
        <span className="micro-8">
          {allDone
            ? "reward unlocked"
            : "complete the checklist to unlock a pull"}
        </span>
      </div>

      <GachaponModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        pulling={pulling}
        skin={lastPull}
        viewMode={viewMode}
      />
    </div>
  );
}

function GachaponModal({
  open,
  onOpenChange,
  pulling,
  skin,
  viewMode,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pulling: boolean;
  skin: SkinDef | null;
  viewMode: string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="GACHAPON / REWARD">
      <div style={{ padding: 22 }}>
        <AnimatePresence mode="wait">
          {pulling && (
            <motion.div
              key="pull"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ textAlign: "center", padding: "30px 0" }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                style={{ display: "inline-block" }}
              >
                <Gift size={30} style={{ color: "var(--accent)" }} />
              </motion.div>
              <MicroLabel>
                <span style={{ marginTop: 14, display: "block" }}>
                  DISPENSING CAPSULE…
                </span>
              </MicroLabel>
            </motion.div>
          )}

          {!pulling && skin && (
            <motion.div
              key={skin.id}
              className="gacha-card"
              initial={{ scale: 0.7, opacity: 0, rotateX: 40 }}
              animate={{ scale: 1, opacity: 1, rotateX: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
            >
              <div
                className="skin-swatch"
                style={{
                  background: `linear-gradient(140deg, ${skin.palette.suit} 55%, ${skin.palette.accent} 55%)`,
                }}
              />
              <div className="micro-8" style={{ color: "var(--accent)" }}>
                <Sparkles size={9} style={{ verticalAlign: -1 }} />{" "}
                {RARITY_LABEL[skin.rarity]}
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, marginTop: 6 }}>
                {skin.name}
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  marginTop: 8,
                  lineHeight: 1.7,
                }}
              >
                {skin.description}
              </p>
              <div className="micro-8" style={{ marginTop: 12 }}>
                companion skin unlocked
                {viewMode === "technical" ? ` · ${skin.id}` : ""}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
