"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type HeadlineTone = "default" | "state" | "risk" | "critical" | "highlight";

export interface Headline {
  title: string;
  /** Second line (technical view shows the status under OVERVIEW). */
  sub?: string;
  titleTone?: HeadlineTone;
  subTone?: HeadlineTone;
  /** Optional avatar square + name prefix (dashboard: "VINCENT WHITE | RISKY"). */
  lead?: { name: string; photo?: string };
}

interface HeaderState {
  headline: Headline | null;
  setHeadline: (h: Headline | null) => void;
}

export const useHeaderStore = create<HeaderState>()((set) => ({
  headline: null,
  setHeadline: (headline) => set({ headline }),
}));

/** Pages declare their MEDBAY headline; cleared on unmount. */
export function useHeadline(h: Headline | null) {
  const setHeadline = useHeaderStore((s) => s.setHeadline);
  const key = h ? JSON.stringify(h) : "";
  useEffect(() => {
    setHeadline(key ? (JSON.parse(key) as Headline) : null);
    return () => setHeadline(null);
  }, [key, setHeadline]);
}
