"use client";

/**
 * /users — operator management (medic clearance only).
 * Medics see every enrolled operator; normal users are denied.
 */

import { ScanFace, ShieldAlert, UserPlus, UserX } from "lucide-react";
import Link from "next/link";

import { Disclaimer, Eyebrow } from "@/components/ui/primitives";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useUserStore } from "@/stores/user-store";

export default function UsersPage() {
  const { users, activeUser, isMedic, streak, totalCheckIns, checkedInToday } =
    useCheckIn();
  const removeUser = useUserStore((s) => s.removeUser);

  if (!isMedic) {
    return (
      <div style={{ padding: "22px 26px", maxWidth: 560 }}>
        <div className="panel panel-pad" style={{ textAlign: "center", padding: "40px 22px" }}>
          <ShieldAlert size={26} style={{ color: "var(--status-urgent)" }} />
          <div style={{ fontSize: 15, fontWeight: 500, marginTop: 10 }}>
            Medic clearance required
          </div>
          <p className="micro" style={{ color: "var(--muted)", marginTop: 8 }}>
            Operator management is restricted to flight-surgeon accounts.
            {activeUser
              ? ` Signed in as ${activeUser.name} (${activeUser.role.toUpperCase()}).`
              : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "22px 26px", maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow>Session / operator management</Eyebrow>
        <span className="micro-8" style={{ marginLeft: "auto" }}>
          {users.length} ENROLLED
        </span>
        <Link href="/register" className="btn btn-primary">
          <UserPlus size={11} /> Add user
        </Link>
      </div>

      <div className="user-grid" style={{ marginTop: 14 }}>
        {users.map((u) => (
          <div key={u.id} className="panel panel-pad user-card">
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.facePhoto} alt={u.name} className="user-photo" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {u.name}
                  {u.id === activeUser?.id && (
                    <span className="micro-8" style={{ color: "var(--accent)" }}> · ACTIVE</span>
                  )}
                </div>
                <div className="micro-8" style={{ marginTop: 3 }}>
                  {u.callsign ?? u.astronautId} ·{" "}
                  <span style={{ color: u.role === "medic" ? "var(--accent)" : "var(--muted)" }}>
                    {u.role === "medic" ? "MEDIC" : "USER"}
                  </span>
                </div>
              </div>
            </div>
            <div className="micro-8" style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>STREAK {String(streak(u.id)).padStart(2, "0")} SOL</span>
              <span>{totalCheckIns(u.id)} CHECK-INS</span>
              <span>{checkedInToday(u.id) ? "TODAY ✓" : "TODAY —"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {u.id !== activeUser?.id && (
                <Link href="/checkin" className="btn" style={{ fontSize: 10 }}>
                  <ScanFace size={10} /> Check in as…
                </Link>
              )}
              {users.length > 1 && (
                <button
                  className="btn"
                  style={{ fontSize: 10 }}
                  onClick={() => {
                    if (confirm(`Remove ${u.name}? Their check-ins are deleted.`))
                      removeUser(u.id);
                  }}
                >
                  <UserX size={10} /> Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Disclaimer>
          LOCAL PROFILES ONLY — photos and check-ins persist in this
          browser&apos;s localStorage. No account is sent to the backend.
        </Disclaimer>
      </div>
    </div>
  );
}
