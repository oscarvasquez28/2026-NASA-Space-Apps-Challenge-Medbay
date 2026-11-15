"use client";

/**
 * /users — operator management (medic clearance only).
 * Medics see every enrolled operator; normal users are denied.
 */

import { ScanFace, ShieldAlert, UserPlus, UserX } from "lucide-react";
import Link from "next/link";

import { AstronautIcon } from "@/components/icons/medbay";
import { Button } from "@/components/ui/button";
import { useCheckIn } from "@/hooks/useCheckIn";
import { deleteOperatorUser } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

export default function UsersPage() {
  const { users, activeUser, isMedic, streak, totalCheckIns, checkedInToday } = useCheckIn();
  const removeUser = useUserStore((s) => s.removeUser);

  if (!isMedic) {
    return (
      <div className="grid h-full place-items-center p-8">
        <div className="flex max-w-md flex-col items-center gap-3 border border-risk p-10 text-center">
          <ShieldAlert size={28} className="text-risk" />
          <div className="medbay-display text-lg">Medic clearance required</div>
          <p className="medbay-copy text-[13px] text-foreground/70">
            Operator management is restricted to flight-surgeon accounts.
            {activeUser ? ` Signed in as ${activeUser.name} (${activeUser.role.toUpperCase()}).` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto px-6 py-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="medbay-display text-xl tracking-widest">Operators</h1>
        <span className="medbay-micro text-foreground/60">{users.length} enrolled</span>
        <Button className="ml-auto" asChild>
          <Link href="/register">
            <UserPlus size={12} /> Add user
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {users.map((u) => (
          <div key={u.id} className="border border-input bg-black p-4">
            <div className="flex items-center gap-3">
              {u.facePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.facePhoto} alt={u.name} className="size-12 rounded-full object-cover" />
              ) : (
                <span className="grid size-12 place-items-center rounded-full bg-[var(--panel-tint)]">
                  <AstronautIcon size={22} className="text-foreground/70" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="medbay-display truncate text-[15px]">
                  {u.name}
                  {u.id === activeUser?.id && <span className="medbay-micro text-state"> · active</span>}
                </div>
                <div className="medbay-micro mt-0.5 text-foreground/60">
                  {u.callsign ?? u.astronautId} ·{" "}
                  <span className={u.role === "medic" ? "text-state" : ""}>
                    {u.role === "medic" ? "MEDIC" : "USER"}
                  </span>
                </div>
              </div>
            </div>
            <div className="medbay-micro mt-3 flex flex-wrap gap-3 text-foreground/70">
              <span>Streak {String(streak(u.id)).padStart(2, "0")} sol</span>
              <span>{totalCheckIns(u.id)} check-ins</span>
              <span className={checkedInToday(u.id) ? "text-ok" : ""}>
                {checkedInToday(u.id) ? "Today ✓" : "Today —"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              {u.id !== activeUser?.id && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/checkin">
                    <ScanFace size={10} /> Check in as…
                  </Link>
                </Button>
              )}
              {users.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-risk hover:text-critical"
                  onClick={() => {
                    if (confirm(`Remove ${u.name}? Their check-ins and saved face credentials are deleted.`)) {
                      removeUser(u.id);
                      void getRuntimeConfig().then((cfg) => {
                        if (cfg.dataProvider === "rest") {
                          return deleteOperatorUser(u.id).catch(() => undefined);
                        }
                        return undefined;
                      });
                    }
                  }}
                >
                  <UserX size={10} /> Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="medbay-micro text-foreground/45">
        OPERATOR DIRECTORY — profiles, face credentials, and daily check-ins
        synchronize with FastAPI /api/v1/auth/*.
      </p>
      <span className={cn("hidden")} aria-hidden />
    </div>
  );
}
