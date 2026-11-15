"use client";

/**
 * /checkin — MEDBAY Screen 0 (spec §1–§2).
 *  - standby:   "ANYONE THERE?" + large Visual AI Model + location tile
 *  - camera:    "HELLO YOU!" — the camera feed takes the main area while the
 *               mascot shrinks to the lower-right; YuNet+SFace identification
 *               auto-checks the operator in
 *  - bonus:     "WEEKLY CHECK IN BONUS" — one spin per WHEEL_CADENCE_DAYS
 *               consecutive days (7 in spec), awarding a Visual AI Model skin
 * Unrecognized faces, manual login and idle-lock re-identification preserved.
 */

import {
  BadgeCheck,
  Lock,
  LogIn,
  RefreshCw,
  ScanFace,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LocationTile } from "@/components/medbay/LocationTile";
import { VisualAI } from "@/components/medbay/VisualAI";
import { FaceCapture } from "@/components/ui/FaceCapture";
import { PrizeWheel } from "@/components/widgets/PrizeWheel";
import { Button } from "@/components/ui/button";
import { useCheckIn } from "@/hooks/useCheckIn";
import { identifyOperatorFace, recordOperatorCheckIn } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useHeadline } from "@/stores/header-store";
import { dayKey, useUserStore } from "@/stores/user-store";

type Phase = "standby" | "scan" | "identifying" | "unrecognized" | "manual" | "done";

const PHASE_HEADLINE: Record<Phase, string> = {
  standby: "Anyone there?",
  scan: "Hello you!",
  identifying: "Hello you!",
  unrecognized: "I don't know you… yet",
  manual: "Who's there?",
  done: "Check-in",
};

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
    wheelEveryN,
  } = useCheckIn();

  const sessionLocked = useUserStore((s) => s.sessionLocked);
  const setSessionLocked = useUserStore((s) => s.setSessionLocked);
  const setUnrecognizedFacePhoto = useUserStore((s) => s.setUnrecognizedFacePhoto);
  const upsertServerUser = useUserStore((s) => s.upsertServerUser);

  const [phase, setPhase] = useState<Phase>(
    todayDone && !sessionLocked ? "done" : "standby",
  );
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [earnedToday, setEarnedToday] = useState(false);
  const [scanConfidence, setScanConfidence] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scanAttempt, setScanAttempt] = useState(0);

  const candidate = users.find((u) => u.id === (candidateId ?? activeUser?.id));
  useHeadline({ title: PHASE_HEADLINE[phase] });

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

      setStatusMessage("No face detected in frame. Center your face or login manually.");
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

  const daysToBonus =
    activeUser !== null
      ? wheelEveryN - (streak(activeUser.id) % wheelEveryN || wheelEveryN)
      : wheelEveryN;

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-8 py-6">
      {/* ------------------------------- standby ------------------------------- */}
      {phase === "standby" && (
        <button
          type="button"
          className="flex min-h-0 flex-1 items-center justify-center outline-none"
          onClick={() => setPhase("scan")}
          aria-label="Wake the console and start face scan"
        >
          <div className="relative w-[min(62%,980px)]">
            <div className="medbay-stage grid aspect-[16/10] place-items-center">
              <VisualAI variant="hero" size={300} />
              <span className="medbay-micro absolute bottom-5 left-1/2 -translate-x-1/2 text-foreground/60">
                Come closer — the camera wakes when you do
              </span>
            </div>
            {/* location tile floats on the stage corner (spec §1) */}
            <div className="medbay-surface absolute -left-12 -top-8 p-3">
              <LocationTile size={120} />
            </div>
          </div>
          {sessionLocked && (
            <span className="medbay-micro absolute right-8 top-6 flex items-center gap-2 text-risk">
              <Lock size={12} /> Console locked — look at the camera to unlock
            </span>
          )}
        </button>
      )}

      {/* ------------------------------- camera -------------------------------- */}
      {(phase === "scan" || phase === "identifying") && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="relative min-h-0 flex-1 self-stretch">
            <div className="medbay-stage relative size-full overflow-hidden">
              <FaceCapture
                key={`${scanAttempt}-${sessionLocked ? "locked" : "open"}`}
                mode="scan"
                onScanComplete={(url) => void handleScanComplete(url)}
              />
              {/* viewfinder corners */}
              {(["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2",
                 "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"] as const).map(
                (c) => (
                  <span key={c} aria-hidden className={cn("pointer-events-none absolute size-8 border-state/80", c)} />
                ),
              )}
              {phase === "identifying" && (
                <div className="absolute inset-0 grid place-items-center bg-black/80">
                  <div className="flex flex-col items-center gap-3">
                    <ScanFace size={30} className="animate-pulse text-state" />
                    <span className="medbay-micro">Verifying face credential…</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setPhase("manual")}>
              <LogIn size={12} /> Login manually
            </Button>
            <span className="medbay-micro text-foreground/50">
              LOCAL BIOMETRIC ID — OpenCV YuNet + SFace, on-device only
            </span>
          </div>
          {/* mascot shrinks to the corner while the camera runs (spec §1) */}
          <div className="pointer-events-none absolute bottom-4 right-6">
            <VisualAI variant="hero" size={140} />
          </div>
        </div>
      )}

      {/* ---------------------------- unrecognized ----------------------------- */}
      {phase === "unrecognized" && (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
          <div className="medbay-copy max-w-xl text-[15px] text-foreground/80">
            {statusMessage ??
              "We detected a face on camera, but it does not match any enrolled operator."}
            {scanConfidence !== null &&
              ` (Best similarity: ${Math.round(scanConfidence * 100)}%)`}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push("/register")}>
              <UserPlus size={12} /> Generate new account
            </Button>
            <Button variant="outline" onClick={() => setPhase("manual")}>
              <LogIn size={12} /> Login manually
            </Button>
            <Button variant="ghost" onClick={retryScan}>
              <RefreshCw size={12} /> Retry scan
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------- manual -------------------------------- */}
      {phase === "manual" && (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
          {statusMessage && (
            <p className="medbay-micro text-foreground/60">{statusMessage}</p>
          )}
          {candidate ? (
            <>
              <div className="grid max-w-2xl grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setCandidateId(u.id)}
                    className={cn(
                      "flex items-center gap-3 border p-3 text-left transition-colors",
                      u.id === candidate.id
                        ? "border-state bg-[var(--panel-tint)]"
                        : "border-input hover:border-state",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.facePhoto} alt="" className="size-10 rounded-full object-cover" />
                    <span className="flex min-w-0 flex-col">
                      <span className="medbay-display truncate text-[13px]">
                        {u.name}
                        {u.callsign ? ` · ${u.callsign}` : ""}
                      </span>
                      <span className="medbay-micro text-foreground/60">{u.role}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void completeLoginAndCheckIn(candidate.id)}>
                  <BadgeCheck size={12} /> Login as {candidate.name}
                </Button>
                <Button variant="outline" onClick={retryScan}>
                  <ScanFace size={12} /> Retry camera scan
                </Button>
                <Button variant="ghost" onClick={() => router.push("/register")}>
                  <UserPlus size={12} /> Create new account
                </Button>
              </div>
            </>
          ) : (
            <div>
              <p className="medbay-copy text-foreground/70">No enrolled operators yet.</p>
              <Button className="mt-4" onClick={() => router.push("/register")}>
                <UserPlus size={12} /> Enroll first operator
              </Button>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------- done --------------------------------- */}
      {phase === "done" && activeUser && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
          <h1 className="medbay-display text-[clamp(30px,4vw,56px)] tracking-widest">
            Welcome, {activeUser.name.split(" ")[0]}
          </h1>
          {statusMessage && (
            <span className="medbay-micro text-state">{statusMessage}</span>
          )}
          <div className="flex items-center gap-8">
            <VisualAI variant="hero" size={180} />
            <div className="medbay-surface-accent flex flex-col items-center gap-2 px-8 py-6">
              <span className="medbay-micro">Check up streak</span>
              <span className="medbay-display text-4xl">
                {String(streak(activeUser.id)).padStart(2, "0")}
              </span>
            </div>
          </div>
          {earnedToday || pendingSpins > 0 ? (
            <Button size="lg" onClick={() => setWheelOpen(true)}>
              {wheelEveryN === 7 ? "Weekly" : "Check in"} bonus — {pendingSpins} spin
              {pendingSpins === 1 ? "" : "s"}
            </Button>
          ) : (
            <span className="medbay-micro text-foreground/60">
              {daysToBonus} day{daysToBonus === 1 ? "" : "s"} to{" "}
              {wheelEveryN === 7 ? "weekly" : "next"} bonus
            </span>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push("/")}>
              <LogIn size={12} /> Enter console
            </Button>
            <Button variant="ghost" onClick={retryScan}>
              <ScanFace size={12} /> Switch via face scan
            </Button>
          </div>
        </div>
      )}

      <PrizeWheel open={wheelOpen} onOpenChange={setWheelOpen} onClaimed={() => claimWheelSpin()} />
    </div>
  );
}
