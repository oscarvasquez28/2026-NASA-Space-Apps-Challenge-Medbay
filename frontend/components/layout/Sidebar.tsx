"use client";

import {
  Activity,
  Bot,
  ClipboardList,
  GitCompare,
  LayoutGrid,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusDot } from "@/components/ui/primitives";
import { useAppStore } from "@/stores/app-store";

const NAV = {
  lab: [
    { href: "/", label: "Lab Home", icon: LayoutGrid },
    { href: "/crew", label: "Crew Roster", icon: Users },
    { href: "/telemetry", label: "Telemetry", icon: Activity },
    { href: "/compare", label: "Compare", icon: GitCompare },
  ],
  tools: [
    { href: "/log", label: "Telemetry Log", icon: ClipboardList },
    { href: "/medic", label: "Medic AI", icon: Bot },
  ],
  system: [{ href: "/settings", label: "Settings", icon: Settings }],
};

export function Sidebar() {
  const pathname = usePathname();
  const hydrated = useAppStore((s) => s.hydrated);
  const viewMode = useAppStore((s) => s.viewMode);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const group = (label: string, items: typeof NAV.lab) => (
    <div className="nav-group" key={label}>
      <div className="nav-label">{label}</div>
      {items.map(({ href, label: text, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`nav-item${isActive(href) ? " active" : ""}`}
        >
          <Icon size={14} strokeWidth={1.5} />
          <span className="nav-text">{text}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="brand">
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          <rect x="1" y="1" width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
          <circle cx="10" cy="7" r="3" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
          <path d="M5 18 L8 11 h4 L15 18" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
        </svg>
        <div className="brand-text">
          <div className="brand-name">ASTROLAB</div>
          <div className="brand-tag">Health monitoring</div>
        </div>
      </div>

      <div className="workspace-label">MED.001 / MONITOR MODE</div>

      {group("LAB", NAV.lab)}
      {group("TOOLS", NAV.tools)}
      {group("SYSTEM", NAV.system)}

      <div className="sidebar-footer">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <StatusDot level="NOMINAL" />
          <span className="micro-8">
            {hydrated && viewMode === "technical" ? "TECH VIEW" : "SIM LINK"}
          </span>
        </div>
        <div className="micro-8">REV. 01 · LOCAL</div>
      </div>
    </aside>
  );
}
