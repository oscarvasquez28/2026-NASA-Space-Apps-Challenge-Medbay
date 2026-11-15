"use client";

/**
 * AuthGate — session gate for the lab console.
 *  - no enrolled operators      → /register (first account = medic)
 *  - enrolled but not checked in → /checkin (simulated visual ID session)
 * Exempts /register & /checkin. Renders a boot-styled placeholder while
 * persisted stores hydrate so the app never flashes through the gate.
 */

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useIdleLock } from "@/hooks/useIdleLock";
import { useAppStore } from "@/stores/app-store";
import { dayKey, useUserStore } from "@/stores/user-store";

const EXEMPT_PREFIXES = ["/register", "/checkin"];

function BootPlaceholder() {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        minHeight: "40vh",
      }}
    >
      <div className="micro-8" style={{ color: "var(--dim)" }}>
        VERIFYING SESSION…
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useIdleLock();

  const appHydrated = useAppStore((s) => s.hydrated);
  const userHydrated = useUserStore((s) => s.hydrated);
  const users = useUserStore((s) => s.users);
  const activeUserId = useUserStore((s) => s.activeUserId);
  const checkIns = useUserStore((s) => s.checkIns);
  const sessionLocked = useUserStore((s) => s.sessionLocked);

  const hydrated = appHydrated && userHydrated;
  const exempt = EXEMPT_PREFIXES.some((p) => pathname.startsWith(p));
  const day = dayKey(0);
  const todayDone = activeUserId
    ? checkIns.some((c) => c.userId === activeUserId && c.day === day)
    : false;
  const needsRegister = hydrated && users.length === 0;
  const needsCheckIn = hydrated && users.length > 0 && (!todayDone || sessionLocked);

  useEffect(() => {
    if (!hydrated || exempt) return;
    if (needsRegister) router.replace("/register");
    else if (needsCheckIn) {
      router.replace(sessionLocked ? "/checkin?reason=idle" : "/checkin");
    }
  }, [hydrated, exempt, needsRegister, needsCheckIn, sessionLocked, router]);

  if (!hydrated) return <BootPlaceholder />;
  if (!exempt && (needsRegister || needsCheckIn)) return <BootPlaceholder />;
  return <>{children}</>;
}
