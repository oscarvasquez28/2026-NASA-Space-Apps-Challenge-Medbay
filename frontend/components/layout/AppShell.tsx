"use client";

import { MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { hydrateAppStore, useAppStore } from "@/stores/app-store";
import { hydrateUserStore } from "@/stores/user-store";
import { AuthGate } from "./AuthGate";
import { BootSequence } from "./BootSequence";
import { CommandPalette } from "./CommandPalette";
import { MedbayHeader } from "./MedbayHeader";
import { MissionContextBar } from "./MissionContextBar";
import { ThemeProvider } from "./ThemeProvider";

/**
 * MEDBAY application shell: themed grid background, MEDBAY header, and the
 * main area. The mission-context strip (5-Hazards / ECLSS overrides) is a
 * technical-view tool, so it only renders for medical professionals in
 * TECHNICAL VIEW.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const hydrated = useAppStore((s) => s.hydrated);
  const technical = useAppStore((s) => s.viewMode === "technical");

  useEffect(() => {
    hydrateAppStore();
    hydrateUserStore();
  }, []);

  return (
    <MotionConfig reducedMotion={hydrated && reduceMotion ? "always" : "never"}>
      <TooltipProvider>
        <ThemeProvider>
          <BootSequence />
          <div className="medbay-shell medbay-grid flex h-dvh flex-col overflow-hidden text-foreground">
            <MedbayHeader />
            <div className="main-area relative flex min-h-0 flex-1 flex-col">
              {technical && <MissionContextBar />}
              <div key={pathname} className="medbay-enter flex min-h-0 flex-1 flex-col">
                <AuthGate>{children}</AuthGate>
              </div>
            </div>
          </div>
          <CommandPalette />
        </ThemeProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
