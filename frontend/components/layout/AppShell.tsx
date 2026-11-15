"use client";

import {
  Activity,
  Bot,
  ClipboardList,
  LayoutGrid,
  Users,
} from "lucide-react";
import { MotionConfig } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { HONESTY_LABEL } from "@/components/ui/primitives";
import { hydrateAppStore, useAppStore } from "@/stores/app-store";
import { hydrateUserStore } from "@/stores/user-store";
import { AuthGate } from "./AuthGate";
import { BootSequence } from "./BootSequence";
import { CommandPalette } from "./CommandPalette";
import { MissionContextBar } from "./MissionContextBar";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const MOBILE_NAV = [
  { href: "/", icon: LayoutGrid, label: "Home" },
  { href: "/crew", icon: Users, label: "Crew" },
  { href: "/telemetry", icon: Activity, label: "Telemetry" },
  { href: "/log", icon: ClipboardList, label: "Log" },
  { href: "/medic", icon: Bot, label: "Medic" },
];

/**
 * Fixed application shell: sidebar (collapses to icon rail on /crew/[id]
 * "focused mode"), topbar, mission context bar, footer, mobile nav.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const focused = /^\/crew\/[^/]+/.test(pathname);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    hydrateAppStore();
    hydrateUserStore();
  }, []);

  return (
    <MotionConfig reducedMotion={hydrated && reduceMotion ? "always" : "never"}>
      <BootSequence />
      <div className={`app-shell${focused ? " focused" : ""}`}>
        <Sidebar />
        <Topbar />
        <div className="main-area">
          <MissionContextBar />
          <AuthGate>{children}</AuthGate>
        </div>
        <footer className="app-footer">
          <span>ASTROLAB MONITOR ENGINE</span>
          <span aria-hidden>·</span>
          <span>CONCEPTUAL TELEMETRY VISUALIZATION</span>
          <span style={{ flex: 1 }} />
          <span>{HONESTY_LABEL}</span>
        </footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile">
        {MOBILE_NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={
              href === "/" ? (pathname === "/" ? "active" : "") : pathname.startsWith(href) ? "active" : ""
            }
          >
            <Icon size={16} strokeWidth={1.5} />
          </Link>
        ))}
      </nav>

      <CommandPalette />
    </MotionConfig>
  );
}
