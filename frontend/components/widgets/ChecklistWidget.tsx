"use client";

/**
 * ChecklistWidget + GachaponModal + 12-Skin Suit Locker — gamification module (G).
 * Synced with GET /api/v1/gamification/status and
 * POST /api/v1/gamification/checkup-complete (Postman #25 & #26).
 */

import { AnimatePresence, motion } from "motion/react";
import { Check, Gift, Sparkles } from "lucide-react";
import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Eyebrow, MicroLabel } from "@/components/ui/primitives";
import { useGamification } from "@/hooks/useGamification";
import { useAppStore } from "@/stores/app-store";
import type { SkinDef } from "@/types/health";

const RARITY_LABEL: Record<SkinDef["rarity"], string> = {
  common: "COMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

export function ChecklistWidget({ crewId }: { crewId: string }) {
  const {
    checklist,
    allDone,
    toggleChecklist,
    streakDays,
    gachaponTokens,
    complianceRatePercent,
    equippedSkinId,
    catalog,
    highLevel,
    technical,
    pulling,
    saving,
    lastPull,
    lastResult,
    error,
    completeAndRoll,
    equipSkin,
  } = useGamification(crewId);
  const viewMode = useAppStore((s) => s.viewMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [lockerOpen, setLockerOpen] = useState(false);

  const isTech = viewMode === "technical";
  const equipped = catalog.find((s) => s.id === equippedSkinId) ?? catalog[0];
  const unlockedCount = catalog.filter((s) => s.unlocked).length;

  return (
    <div className="panel panel-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Eyebrow>Routine checkups &amp; gachapon</Eyebrow>
        <span className="micro-8" style={{ marginLeft: "auto" }}>
          STREAK {String(streakDays).padStart(2, "0")} SOL · TOKENS {gachaponTokens} ·{" "}
          {Math.round(complianceRatePercent)}% COMPLIANCE
        </span>
      </div>

      {(highLevel || technical) && (
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          {isTech ? technical : highLevel}
        </p>
      )}

      <div style={{ marginTop: 8 }}>
        {checklist.map((item) => (
          <button
            key={item.id}
            className={`check-item${item.done ? " done" : ""}`}
            onClick={() => void toggleChecklist(item.id)}
            aria-pressed={item.done}
            disabled={saving}
            style={{ width: "100%", textAlign: "left" }}
          >
            <span className="check-box">
              {item.done && <Check size={10} strokeWidth={3} />}
            </span>
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.frequency && (
              <span className="micro-8" style={{ color: "var(--dim)" }}>
                {item.frequency.toUpperCase()}
              </span>
            )}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn btn-primary"
          disabled={pulling || saving}
          onClick={() => {
            setModalOpen(true);
            void completeAndRoll();
          }}
        >
          <Gift size={11} />
          {pulling ? "Rolling…" : "Checkup & Roll Gachapon"}
        </button>
        <button
          className="btn"
          aria-expanded={lockerOpen}
          onClick={() => setLockerOpen((v) => !v)}
        >
          Suit Locker ({unlockedCount}/{catalog.length})
        </button>
        <span className="micro-8">
          {equipped ? `EQUIPPED: ${equipped.name}` : allDone ? "All routine items complete" : "Log checkups to earn gachapon tokens"}
        </span>
      </div>

      {error && (
        <p className="micro" style={{ marginTop: 8, color: "var(--status-critical)" }}>
          {error}
        </p>
      )}

      {lastResult?.roll_result && (
        <div className="micro-8" style={{ marginTop: 8, color: "var(--accent)" }}>
          {lastResult.roll_result.message} ({lastResult.roll_result.rolled_skin.name} ·{" "}
          {lastResult.roll_result.rarity})
        </div>
      )}

      {lockerOpen && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 8,
          }}
        >
          {catalog.map((s) => {
            const isEquipped = s.id === equippedSkinId || s.equipped;
            return (
              <div
                key={s.id}
                className="callout"
                style={{
                  opacity: s.unlocked ? 1 : 0.62,
                  borderColor: isEquipped ? "var(--accent)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      display: "inline-block",
                      background: `linear-gradient(135deg, ${s.palette.suit} 50%, ${s.palette.accent} 50%)`,
                      border: "1px solid var(--line)",
                    }}
                  />
                  <span className="micro-8" style={{ color: "var(--accent)" }}>
                    {RARITY_LABEL[s.rarity]}
                    {s.probabilityPercent !== undefined ? ` · ${s.probabilityPercent}%` : ""}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                  {s.name}
                </div>
                <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>
                  {s.description}
                </p>
                <div style={{ marginTop: 6 }}>
                  {s.unlocked ? (
                    <button
                      className={isEquipped ? "btn btn-primary" : "btn"}
                      disabled={isEquipped || saving}
                      onClick={() => void equipSkin(s.id)}
                      style={{ fontSize: 10, padding: "4px 8px" }}
                    >
                      {isEquipped ? "Equipped" : "Equip Skin"}
                    </button>
                  ) : (
                    <span className="micro-8" style={{ color: "var(--dim)" }}>
                      LOCKED · ROLL TO UNLOCK
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
                companion skin rolled
                {viewMode === "technical" ? ` · ${skin.id}` : ""}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
