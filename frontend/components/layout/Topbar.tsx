"use client";

import { Search } from "lucide-react";
import { usePathname } from "next/navigation";

import Link from "next/link";

import { StatusDot } from "@/components/ui/primitives";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useHealthStatus } from "@/hooks/useHealthStatus";
import { useAppStore } from "@/stores/app-store";

const CRUMBS: Record<string, string> = {
  "/": "LAB HOME",
  "/crew": "CREW ROSTER",
  "/telemetry": "TELEMETRY",
  "/compare": "COMPARE",
  "/log": "TELEMETRY LOG",
  "/medic": "MEDIC AI",
  "/checkin": "CHECK-IN",
  "/register": "ENROLL OPERATOR",
  "/users": "OPERATORS",
  "/settings": "SETTINGS",
};

function crumbFor(pathname: string): string {
  if (CRUMBS[pathname]) return CRUMBS[pathname];
  if (pathname.startsWith("/crew/")) return "CREW / MONITOR";
  return "LAB";
}

export function Topbar() {
  const pathname = usePathname();
  const { state, providerKind } = useHealthStatus();
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const { activeUser } = useCheckIn();

  return (
    <header className="topbar">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <span>MED.001</span>
        <span aria-hidden>/</span>
        <span className="crumb-current">{crumbFor(pathname)}</span>
      </nav>

      <div style={{ flex: 1 }} />

      <button
        className="search-trigger"
        onClick={() => setCommandOpen(true)}
        aria-label="Open command palette"
      >
        <Search size={11} />
        <span style={{ flex: 1, textAlign: "left" }}>Search or command</span>
        <span className="kbd">⌘K</span>
      </button>

      <div
        className="env-indicator"
        title={
          state.status === "ok"
            ? `provider=${providerKind} · ${JSON.stringify(state.data)}`
            : state.status === "error"
              ? state.error
              : "checking…"
        }
      >
        <StatusDot
          level={
            state.status === "ok"
              ? "NOMINAL"
              : state.status === "error"
                ? "CRITICAL"
                : "OFFLINE"
          }
        />
        {state.status === "ok"
          ? providerKind === "rest"
            ? state.partial
              ? "BACKEND LINK · PARTIAL"
              : "BACKEND LINK"
            : "LOCAL SIMULATION"
          : state.status === "error"
            ? "LINK DOWN"
            : "CHECKING…"}
      </div>

      <Link
        href="/checkin"
        className="avatar"
        title={
          activeUser
            ? `${activeUser.name} (${activeUser.role.toUpperCase()}) — check-in`
            : "No operator enrolled — check-in"
        }
      >
        {activeUser ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeUser.facePhoto} alt={activeUser.name} />
        ) : (
          "—"
        )}
      </Link>
    </header>
  );
}
