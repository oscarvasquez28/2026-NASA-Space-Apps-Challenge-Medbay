"use client";

import { useEffect, type ReactNode } from "react";

import { useLocationTheme } from "@/hooks/useLocationTheme";
import { useAppStore } from "@/stores/app-store";

/**
 * Publishes the MEDBAY theme on <html>: `data-location` (highlight colour)
 * and `data-health` (risk/critical accents) — see app/globals.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { chosen } = useLocationTheme();
  const health = useAppStore((s) => s.subjectHealth);

  useEffect(() => {
    document.documentElement.dataset.location = chosen;
  }, [chosen]);
  useEffect(() => {
    document.documentElement.dataset.health = health;
  }, [health]);

  return <>{children}</>;
}
