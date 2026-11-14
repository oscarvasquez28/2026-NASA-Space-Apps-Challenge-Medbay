"use client";

import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

import { useAppStore } from "@/stores/app-store";

const BOOT_LINES = [
  "ASTROLAB / HEALTH MONITORING SYSTEM",
  "INITIALIZING TELEMETRY LINK…",
  "LOADING CREW DATASETS…",
  "CALIBRATING ZONE GEOMETRY…",
  "LINK ESTABLISHED · SIM MODE",
];

const BOOT_KEY = "astro-lab:booted";

/**
 * First-load boot overlay (once per session). Self-dismisses on a timer —
 * deliberately not tied to WebGL readiness so the UI is never blocked.
 */
export function BootSequence() {
  const booted = useAppStore((s) => s.booted);
  const setBooted = useAppStore((s) => s.setBooted);
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState(0);

  useEffect(() => {
    const seen =
      typeof window !== "undefined" && sessionStorage.getItem(BOOT_KEY);
    if (!seen && !booted) queueMicrotask(() => setVisible(true));
  }, [booted]);

  useEffect(() => {
    if (!visible) return;
    const lineTimer = setInterval(
      () => setLines((l) => Math.min(l + 1, BOOT_LINES.length)),
      340,
    );
    const done = setTimeout(() => {
      sessionStorage.setItem(BOOT_KEY, "1");
      setBooted();
      setVisible(false);
    }, 2100);
    return () => {
      clearInterval(lineTimer);
      clearTimeout(done);
    };
  }, [visible, setBooted]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="boot-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
          role="status"
          aria-label="Initializing console"
        >
          <div className="boot-box">
            <div className="boot-title">
              <span className="tiny-square" aria-hidden /> A/ ASTROLAB
            </div>
            <div className="boot-lines">
              {BOOT_LINES.slice(0, lines).map((l, i) => (
                <div key={l} className={i === BOOT_LINES.length - 1 ? "ok" : ""}>
                  {i === BOOT_LINES.length - 1 ? "▸ " : ""}
                  {l}
                </div>
              ))}
            </div>
            <div className="boot-bar">
              <motion.i
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.9, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
