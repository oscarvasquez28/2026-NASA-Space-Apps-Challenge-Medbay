"use client";

/**
 * /register — enroll a console operator.
 * Face photo is mandatory (stored as a local dataURL for the future
 * visual-recognition adapter). The FIRST enrolled operator is locked to
 * the medic role — later enrollees may pick medic or normal user.
 */

import { ScanFace, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FaceCapture } from "@/components/ui/FaceCapture";
import { Disclaimer, Eyebrow } from "@/components/ui/primitives";
import { useUserStore } from "@/stores/user-store";
import type { UserRole } from "@/types/health";

export default function RegisterPage() {
  const router = useRouter();
  const users = useUserStore((s) => s.users);
  const addUser = useUserStore((s) => s.addUser);

  const firstUser = users.length === 0;
  const [name, setName] = useState("");
  const [callsign, setCallsign] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [astronautId, setAstronautId] = useState(
    `AST-U${String(users.length + 1).padStart(2, "0")}`,
  );
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required.");
    if (!facePhoto) return setError("A face photo is required for visual ID.");
    const user = addUser({
      name: name.trim(),
      callsign: callsign.trim() || undefined,
      role: firstUser ? "medic" : role,
      astronautId: astronautId.trim() || undefined,
      facePhoto,
    });
    if (!user) return setError("Could not save the operator profile.");
    router.push("/checkin");
  };

  return (
    <div style={{ padding: "22px 26px", maxWidth: 680 }}>
      <Eyebrow>
        {firstUser ? "Session / enroll first operator (medic)" : "Session / enroll operator"}
      </Eyebrow>

      <form onSubmit={submit} className="panel panel-pad" style={{ marginTop: 14 }}>
        <div className="form-grid">
          <label className="form-row">
            <span className="micro-8">NAME *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oscar Vásquez"
              autoFocus
            />
          </label>
          <label className="form-row">
            <span className="micro-8">CALLSIGN</span>
            <input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="e.g. OV-01"
            />
          </label>
          <label className="form-row">
            <span className="micro-8">ROLE</span>
            <select
              value={firstUser ? "medic" : role}
              disabled={firstUser}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="medic">MEDIC — flight surgeon, sees all operators</option>
              <option value="user">USER — sees own data only</option>
            </select>
            {firstUser && (
              <span className="micro-8" style={{ color: "var(--accent)" }}>
                FIRST ACCOUNT MUST BE FLIGHT SURGEON (MEDIC)
              </span>
            )}
          </label>
          <label className="form-row">
            <span className="micro-8">ASTRONAUT ID (gamification key)</span>
            <input
              value={astronautId}
              onChange={(e) => setAstronautId(e.target.value)}
            />
          </label>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="micro-8" style={{ marginBottom: 8 }}>
            FACE PHOTO * — used by the visual-ID check-in
          </div>
          {facePhoto ? (
            <div className="face-capture">
              <div className="face-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={facePhoto} alt="Enrolled face" className="face-media" />
              </div>
              <div className="face-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setFacePhoto(null)}
                >
                  Retake
                </button>
              </div>
            </div>
          ) : (
            <FaceCapture mode="capture" onCapture={setFacePhoto} />
          )}
        </div>

        {error && (
          <p className="micro" role="alert" style={{ marginTop: 12, color: "var(--status-critical)" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button type="submit" className="btn btn-primary">
            <UserPlus size={11} /> {firstUser ? "Create medic account" : "Enroll operator"}
          </button>
          {!firstUser && (
            <button type="button" className="btn" onClick={() => router.back()}>
              Cancel
            </button>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <Disclaimer>
            LOCAL PROFILE — photo and identity live in this browser&apos;s
            localStorage only. Visual recognition is simulated until a real
            adapter ships.
          </Disclaimer>
        </div>
      </form>

      {users.length > 0 && (
        <div className="panel panel-pad" style={{ marginTop: 14 }}>
          <Eyebrow>
            <ScanFace size={10} style={{ verticalAlign: -1 }} /> Enrolled operators ({users.length})
          </Eyebrow>
          <div className="user-strip">
            {users.map((u) => (
              <div key={u.id} className="user-chip">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.facePhoto} alt="" className="user-thumb" />
                <span>{u.name}</span>
                <span className="micro-8">{u.role.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
