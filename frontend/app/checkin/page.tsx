"use client";

/**
 * /checkin — biometric facial recognition login & daily check-in lock screen.
 * - Idle lock or missing daily check-in opens the on-device camera scan.
 * - Matched face -> auto-login & unlock immediately.
 * - Unrecognized face -> prompt to Generate New Account (/register) or Login Manually.
 * - Every WHEEL_EVERY_N-th check-in opens the Prize Drum connected to backend gamification.
 */

import {
  BadgeCheck,
  Gift,
  Lock,
  LogIn,
  RefreshCw,
  ScanFace,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FaceCapture } from "@/components/ui/FaceCapture";
import { Disclaimer, Eyebrow, MicroLabel } from "@/components/ui/primitives";
import { PrizeWheel } from "@/components/widgets/PrizeWheel";
import { useCheckIn } from "@/hooks/useCheckIn";
import {
  identifyOperatorFace,
  recordOperatorCheckIn,
} from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { dayKey, useUserStore } from "@/stores/user-store";

type Phase = "scan" | "identifying" | "unrecognized" | "manual" | "done";

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

  const sessionLocked = useUserStore((s) => s.sessionLocked);
  const setSessionLocked = useUserStore((s) => s.setSessionLocked);
  const setUnrecognizedFacePhoto = useUserStore(
    (s) => s.setUnrecognizedFacePhoto,
  );
  const upsertServerUser = useUserStore((s) => s.upsertServerUser);

  const [phase, setPhase] = useState<Phase>(
    todayDone && !sessionLocked ? "done" : "scan",
  );
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [earnedToday, setEarnedToday] = useState(false);
  const [scanConfidence, setScanConfidence] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scanAttempt, setScanAttempt] = useState(0);

  const effectivePhase: Phase =
    sessionLocked && phase === "done" ? "scan" : phase;

  const candidate = users.find((u) => u.id === (candidateId ?? activeUser?.id));

  const completeLoginAndCheckIn = async (userId: string) => {
    const wasIdleLock = useUserStore.getState().sessionLocked;
    let earnedSpin = false;

    try {
      const cfg = await getRuntimeConfig();
      if (cfg.dataProvider === "rest") {
        const remote = await recordOperatorCheckIn(userId, dayKey(0));
        earnedSpin = remote.earned_spin;
      }
    } catch {
      // Fallback to local store check-in if offline/mock
    }

    const local = checkIn(userId);
    earnedSpin = earnedSpin || local.earnedSpin;

    setActiveUser(userId);
    setSessionLocked(false);
    setEarnedToday(earnedSpin || pendingSpins > 0);
    setPhase("done");

    if (earnedSpin) {
      setWheelOpen(true);
    } else if (wasIdleLock) {
      router.push("/");
    }
  };

  const handleScanComplete = async (capturedDataUrl?: string) => {
    if (!capturedDataUrl) {
      setStatusMessage("Camera unavailable — select your operator manually.");
      setPhase("manual");
      return;
    }

    setPhase("identifying");
    setStatusMessage(null);

    try {
      const cfg = await getRuntimeConfig();
      if (cfg.dataProvider !== "rest") {
        setPhase("manual");
        return;
      }

      const res = await identifyOperatorFace(capturedDataUrl);
      setScanConfidence(res.confidence);

      if (res.status === "matched" && res.matched_user) {
        upsertServerUser(res.matched_user);
        setStatusMessage(
          `Recognized ${res.matched_user.name} (${Math.round(res.confidence * 100)}% match)`,
        );
        await completeLoginAndCheckIn(res.matched_user.id);
        return;
      }

      if (res.status === "unknown_face") {
        setUnrecognizedFacePhoto(capturedDataUrl);
        setStatusMessage(res.message);
        setPhase("unrecognized");
        return;
      }

      // status === "no_face"
      setStatusMessage(
        "No face detected in frame. Center your face or login manually.",
      );
      setPhase("manual");
    } catch {
      setStatusMessage("Biometric service unreachable — use manual login.");
      setPhase("manual");
    }
  };

  const retryScan = () => {
    setStatusMessage(null);
    setScanConfidence(null);
    setScanAttempt((n) => n + 1);
    setPhase("scan");
  };

  return (
    <div style={{ padding: "22px 26px", maxWidth: 680 }}>
      <Eyebrow>
        {sessionLocked
          ? "Session / idle lock screen — camera ID"
          : "Session / biometric visual check-in"}
      </Eyebrow>

      {sessionLocked && (
        <div
          className="callout"
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Lock size={13} style={{ color: "var(--accent)" }} />
          <span className="micro-8">
            CONSOLE LOCKED DUE TO INACTIVITY — LOOK AT THE CAMERA TO UNLOCK AUTOMATICALLY
          </span>
        </div>
      )}

      <div className="panel panel-pad" style={{ marginTop: 14 }}>
        {effectivePhase === "scan" && (
          <>
            <MicroLabel>
              <span style={{ display: "block", marginBottom: 10 }}>
                STEP 1 — ON-DEVICE FACE RECOGNITION
              </span>
            </MicroLabel>
            <FaceCapture
              key={`${scanAttempt}-${sessionLocked ? "locked" : "open"}`}
              mode="scan"
              onScanComplete={(url) => void handleScanComplete(url)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPhase("manual")}
              >
                <LogIn size={11} /> Login manually
              </button>
            </div>
          </>
        )}

        {effectivePhase === "identifying" && (
          <div style={{ textAlign: "center", padding: "36px 12px" }}>
            <ScanFace size={26} style={{ color: "var(--accent)" }} />
            <div className="micro-8" style={{ marginTop: 12 }}>
              VERIFYING FACIAL EMBEDDING AGAINST FACE_CREDENTIALS…
            </div>
          </div>
        )}

        {effectivePhase === "unrecognized" && (
          <div>
            <MicroLabel>
              <span style={{ display: "block", marginBottom: 8, color: "var(--status-caution)" }}>
                FACE DETECTED — NO ACCOUNT MATCH
              </span>
            </MicroLabel>
            <p className="micro" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
              {statusMessage ??
                "We detected a face on camera, but it does not match any enrolled operator."}
              {scanConfidence !== null
                ? ` (Best similarity: ${Math.round(scanConfidence * 100)}%)`
                : ""}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => router.push("/register")}
              >
                <UserPlus size={11} /> Generate new account
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPhase("manual")}
              >
                <LogIn size={11} /> Login manually
              </button>
              <button type="button" className="btn" onClick={retryScan}>
                <RefreshCw size={11} /> Retry scan
              </button>
            </div>
          </div>
        )}

        {effectivePhase === "manual" && candidate && (
          <>
            <MicroLabel>
              <span style={{ display: "block", marginBottom: 10 }}>
                MANUAL OPERATOR LOGIN
              </span>
            </MicroLabel>
            {statusMessage && (
              <p className="micro-8" style={{ marginBottom: 10, color: "var(--muted)" }}>
                {statusMessage}
              </p>
            )}
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
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => void completeLoginAndCheckIn(candidate.id)}
              >
                <BadgeCheck size={11} /> Login as {candidate.name}
              </button>
              <button className="btn" onClick={retryScan}>
                <ScanFace size={11} /> Retry camera scan
              </button>
              <button className="btn" onClick={() => router.push("/register")}>
                <UserPlus size={11} /> Create new account
              </button>
            </div>
          </>
        )}

        {effectivePhase === "manual" && !candidate && (
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

        {effectivePhase === "done" && activeUser && (
          <div style={{ textAlign: "center", padding: "14px 0 6px" }}>
            <BadgeCheck
              size={30}
              style={{ color: "var(--status-nominal)" }}
            />
            <div style={{ fontSize: 17, fontWeight: 500, marginTop: 10 }}>
              Signed in — {activeUser.name}
            </div>
            {statusMessage && (
              <div className="micro-8" style={{ marginTop: 4, color: "var(--status-nominal)" }}>
                {statusMessage}
              </div>
            )}
            <div className="micro-8" style={{ marginTop: 6 }}>
              STREAK {String(streak(activeUser.id)).padStart(2, "0")} SOL ·
              TOTAL {totalCheckIns(activeUser.id)} CHECK-IN
              {totalCheckIns(activeUser.id) === 1 ? "" : "S"}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              {earnedToday || pendingSpins > 0 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setWheelOpen(true)}
                >
                  <Gift size={11} /> Open Prize Drum ({pendingSpins} pending)
                </button>
              ) : (
                <span className="micro-8" style={{ alignSelf: "center" }}>
                  NEXT DRUM SPIN AT{" "}
                  {Math.ceil((totalCheckIns(activeUser.id) + 1) / 5) * 5} CHECK-INS
                </span>
              )}
              <button className="btn" onClick={() => router.push("/")}>
                <LogIn size={11} /> Enter console
              </button>
              <button className="btn" onClick={retryScan}>
                <ScanFace size={11} /> Switch via face scan
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <Disclaimer>
          <ScanFace size={9} style={{ verticalAlign: -1 }} /> BIOMETRIC VISUAL ID
          — frames are matched locally in Python against saved{" "}
          <code>face_credentials</code>; no external cloud vision API is called.
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
