"use client";

/**
 * /register — enroll a console operator (MEDBAY Screen 0, enrollment branch).
 * Face photo is mandatory (stored as a face credential for the YuNet+SFace
 * lock-screen identification). The FIRST enrolled operator is locked to the
 * medic role — later enrollees may pick medic or normal user.
 */

import { ScanFace, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { VisualAI } from "@/components/medbay/VisualAI";
import { FaceCapture } from "@/components/ui/FaceCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerOperator } from "@/lib/api";
import { getRuntimeConfig } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";
import type { UserRole } from "@/types/health";

export default function RegisterPage() {
  const router = useRouter();
  const users = useUserStore((s) => s.users);
  const addUser = useUserStore((s) => s.addUser);
  const upsertServerUser = useUserStore((s) => s.upsertServerUser);
  const setActiveUser = useUserStore((s) => s.setActiveUser);
  const unrecognizedFacePhoto = useUserStore((s) => s.unrecognizedFacePhoto);
  const setUnrecognizedFacePhoto = useUserStore((s) => s.setUnrecognizedFacePhoto);

  const firstUser = users.length === 0;
  const [name, setName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [astronautId, setAstronautId] = useState(
    `AST-U${String(users.length + 1).padStart(2, "0")}`,
  );
  const [facePhoto, setFacePhoto] = useState<string | null>(() => unrecognizedFacePhoto);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return setError("Name is required.");
    if (!facePhoto) return setError("A face photo is required for visual ID.");

    setSubmitting(true);
    setError(null);

    try {
      const cfg = await getRuntimeConfig();
      if (cfg.dataProvider === "rest") {
        const res = await registerOperator({
          name: name.trim(),
          callsign: callsign.trim() || undefined,
          role: firstUser ? "medic" : role,
          astronaut_id: astronautId.trim() || undefined,
          face_photo: facePhoto,
        });
        upsertServerUser(res.user);
        setActiveUser(res.user.id);
        setUnrecognizedFacePhoto(null);
        router.push("/checkin");
        return;
      }

      const user = addUser({
        name: name.trim(),
        callsign: callsign.trim() || undefined,
        role: firstUser ? "medic" : role,
        astronautId: astronautId.trim() || undefined,
        facePhoto,
      });
      if (!user) return setError("Could not save the operator profile.");
      setUnrecognizedFacePhoto(null);
      router.push("/checkin");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the operator profile.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden px-8 py-6">
      <h1 className="medbay-display text-[clamp(28px,3.6vw,48px)] tracking-widest">
        Nice to meet you!
      </h1>
      <p className="medbay-micro mt-1 text-foreground/60">
        {firstUser
          ? "Enroll the first operator — this account is the Medical Professional"
          : "Enroll a new crew operator"}
      </p>

      <form onSubmit={submit} className="mt-6 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
        {/* left: camera takes the lead, mascot in the corner */}
        <div className="flex min-h-0 flex-col gap-4">
          <div className="medbay-micro text-foreground/70">Face photo — used by the visual ID check-in</div>
          <div className="relative min-h-0 flex-1 border border-input bg-black">
            {facePhoto ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={facePhoto} alt="Enrolled face" className="size-full object-cover" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="absolute bottom-3 right-3"
                  onClick={() => setFacePhoto(null)}
                >
                  Retake
                </Button>
              </>
            ) : (
              <FaceCapture mode="capture" onCapture={setFacePhoto} />
            )}
          </div>
          <div className="pointer-events-none self-end">
            <VisualAI variant="hero" size={110} />
          </div>
        </div>

        {/* right: form fields */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            <Label htmlFor="reg-name">Name *</Label>
            <Input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Oscar Vásquez" autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reg-callsign">Callsign</Label>
            <Input id="reg-callsign" value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="e.g. OV-01" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reg-role">Role</Label>
            <select
              id="reg-role"
              className="flex h-9 w-full border border-input bg-black px-3 text-sm"
              value={firstUser ? "medic" : role}
              disabled={firstUser}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="medic">MEDIC — flight surgeon, sees all operators</option>
              <option value="user">USER — sees own data only</option>
            </select>
            {firstUser && (
              <span className="medbay-micro text-state">First account must be the Medical Professional</span>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reg-astronaut">Astronaut ID (gamification key)</Label>
            <Input id="reg-astronaut" value={astronautId} onChange={(e) => setAstronautId(e.target.value)} />
          </div>

          {error && (
            <p className="medbay-micro text-risk" role="alert">
              {error}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting}>
              <UserPlus size={12} />
              {submitting ? "Saving face embedding…" : firstUser ? "Create medic account" : "Enroll operator"}
            </Button>
            {!firstUser && (
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            )}
          </div>

          <p className="medbay-micro mt-auto text-foreground/50">
            BIOMETRIC PROFILE — operator metadata and the facial embedding are saved to
            face_credentials for automatic lock-screen login. No external cloud vision API.
          </p>
        </div>
      </form>

      {users.length > 0 && (
        <div className="mt-4 shrink-0 border border-input p-3">
          <div className="medbay-micro mb-2 flex items-center gap-2 text-foreground/70">
            <ScanFace size={11} /> Enrolled operators ({users.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {users.map((u) => (
              <div
                key={u.id}
                className={cn("flex items-center gap-2 border border-input px-2.5 py-1.5")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.facePhoto} alt="" className="size-6 rounded-full object-cover" />
                <span className="medbay-display text-[11px]">{u.name}</span>
                <span className="medbay-micro text-foreground/60">{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
