"use client";

import { useEffect, useRef } from "react";

import { useAppStore } from "@/stores/app-store";
import { speechSignal } from "@/stores/companion-store";

/**
 * rAF loop shared by animated skins. Calls `draw(t, level)` with seconds and
 * a smoothed speech amplitude (0–1). Reduced motion draws one static frame.
 */
export function useMascotLoop(draw: (t: number, level: number) => void) {
  const reduce = useAppStore((s) => s.reduceMotion);
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const prefersReduced =
      reduce || (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    if (prefersReduced) {
      drawRef.current(0, 0);
      return;
    }
    let frame = 0;
    let level = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const target = speechSignal.speaking ? speechSignal.level : 0;
      level += (target - level) * 0.18;
      drawRef.current((now - start) / 1000, level);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce]);
}
