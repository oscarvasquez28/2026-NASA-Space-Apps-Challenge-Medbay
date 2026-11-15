"use client";

/**
 * /checkin — daily session via simulated visual ID.
 * Camera scan → matched enrolled operator → confirm check-in (or enroll a
 * new face). Every WHEEL_EVERY_N-th check-in opens the Prize Drum.
 */

import { BadgeCheck, Gift, LogIn, ScanFace, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FaceCapture } from "@/components/ui/FaceCapture";
import { Disclaimer, Eyebrow, MicroLabel } from "@/components/ui/primitives";
import { PrizeWheel } from "@/components/widgets/PrizeWheel";
import { useCheckIn } from "@/hooks/useCheckIn";

type Phase = "scan" | "identified" | "done";

export default function CheckInPage() {
  const router = useRouter();
  const {
    users,
    activeUser,
    todayDone,
    pendingSpins,
    checkIn,
    claimWheelSpin,
    setActiveUser,
    streak,
    totalCheckIns,
  } = useCheckIn();

  const [phase, setPhase] = useState<Phase>(todayDone ? "done" : "scan");
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [earnedToday, setEarnedToday] = useState(false);

  const candidate = users.find((u) => u.id === (candidateId ?? activeUser?.id));

  const confirm = (userId: string) => {
    const { earnedSpin } = checkIn(userId);
    setEarnedToday(earnedSpin || pendingSpins > 0);
    setPhase("done");
    if (earnedSpin) setWheelOpen(true);
  };

  return (
    <div style={{ padding: "22px 26px", maxWidth: 680 }}>
      <Eyebrow>Session / daily visual check-in</Eyebrow>

      <div className="panel panel-pad" style={{ marginTop: 14 }}>
        {phase === "scan" && (
          <>
            <MicroLabel>
              <span style={{ display: "block", marginBottom: 10 }}>
                STEP 1 — FACE SCAN (SIMULATED RECOGNITION)
              </span>
            </MicroLabel>
            <FaceCapture
              mode="scan"
              onScanComplete={() => setPhase("identified")}
            />
          </>
        )}

        {phase === "identified" && candidate && (
          <>
            <MicroLabel>
              <span style={{ display: "block", marginBottom: 10 }}>
                STEP 2 — CONFIRM IDENTITY
              </span>
            </MicroLabel>
            <div className="user-strip">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`user-chip${u.id === candidate.id ? " selected" : ""}`}
                  onClick={() => setCandidateId(u.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u.facePhoto} alt="" className="user-thumb" />
                  <span>
                    {u.name}
                    {u.callsign ? ` · ${u.callsign}` : ""}
                  </span>
                  <span className="micro-8">{u.role.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <p className="micro-8" style={{ marginTop: 10, color: "var(--dim)" }}>
              SIMULATED MATCH — pick the operator the scan should have found.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setActiveUser(candidate.id);
                  confirm(candidate.id);
                }}
              >
                <BadgeCheck size={11} /> That&apos;s me — check in
              </button>
              <button className="btn" onClick={() => router.push("/register")}>
                <UserPlus size={11} /> Not recognized — enroll
              </button>
            </div>
          </>
        )}

        {phase === "identified" && !candidate && (
          <div>
            <p className="micro" style={{ color: "var(--muted)" }}>
              No enrolled operators yet.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: 10 }}
              onClick={() => router.push("/register")}
            >
              <UserPlus size={11} /> Enroll first operator
            </button>
          </div>
        )}

        {phase === "done" && activeUser && (
          <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
            <BadgeCheck
              size={30}
              style={{ color: "var(--status-nominal)" }}
            />
            <div style={{ fontSize: 17, fontWeight: 500, marginTop: 10 }}>
              Checked in — {activeUser.name}
            </div>
            <div className="micro-8" style={{ marginTop: 6 }}>
              STREAK {String(streak(activeUser.id)).padStart(2, "0")} SOL ·
              TOTAL {totalCheckIns(activeUser.id)} CHECK-IN
              {totalCheckIns(activeUser.id) === 1 ? "" : "S"}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              {earnedToday || pendingSpins > 0 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setWheelOpen(true)}
                >
                  <Gift size={11} /> Open Prize Drum ({pendingSpins} pending)
                </button>
              ) : (
                <span className="micro-8" style={{ alignSelf: "center" }}>
                  NEXT DRUM SPIN AT {Math.ceil((totalCheckIns(activeUser.id) + 1) / 5) * 5} CHECK-INS
                </span>
              )}
              <button className="btn" onClick={() => router.push("/")}>
                <LogIn size={11} /> Enter console
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <Disclaimer>
          <ScanFace size={9} style={{ verticalAlign: -1 }} /> SIMULATED VISUAL
          ID — the camera feeds a scan animation only; no face detection runs.
          Check-ins persist in localStorage.
        </Disclaimer>
      </div>

      <PrizeWheel
        open={wheelOpen}
        onOpenChange={setWheelOpen}
        onClaimed={() => claimWheelSpin()}
      />
    </div>
  );
}
