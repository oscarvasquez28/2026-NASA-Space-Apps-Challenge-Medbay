"use client";

/**
 * ZoneInspector — right-rail data panel of the anatomical workspace.
 * Tabs: Overview | Vitals | Biometrics | Risks | Protocols | Checks, then a
 * numbered MONITORED ZONES list that drives the same focus pipeline as
 * clicking the 3D model (focus(zone) → camera + selection).
 */

import { MessageSquare } from "lucide-react";
import { useState } from "react";

import {
  Disclaimer,
  Eyebrow,
  StatusDot,
} from "@/components/ui/primitives";
import { organsOf } from "@/data/organs";
import { useAppStore } from "@/stores/app-store";
import { useViewerStore } from "@/stores/viewer-store";
import type { CrewMember } from "@/types/health";

const TABS = [
  "Overview",
  "Vitals",
  "Biometrics",
  "Risks",
  "Protocols",
  "Checks",
] as const;

export function ZoneInspector({ member }: { member: CrewMember }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const viewMode = useAppStore((s) => s.viewMode);
  const openChat = useAppStore((s) => s.openChat);
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const selectedOrganId = useViewerStore((s) => s.selectedOrganId);
  const focus = useViewerStore((s) => s.focus);
  const focusOrgan = useViewerStore((s) => s.focusOrgan);
  const technical = viewMode === "technical";

  const flagged = member.zones.filter((z) => z.status !== "NOMINAL");

  return (
    <div className="inspector">
      <div className="inspector-head">
        <Eyebrow>MEDICAL DATA / REV. 01</Eyebrow>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 500 }}>{member.name}</h2>
          <span className="micro-8">{member.id}</span>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Inspector sections">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="tab"
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="inspector-body">
        {tab === "Overview" && (
          <div>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.8 }}>
              {member.description}
            </p>
            <table className="spec-table" style={{ marginTop: 14 }}>
              <tbody>
                <tr>
                  <th scope="row">Role</th>
                  <td>{member.role}</td>
                </tr>
                <tr>
                  <th scope="row">Mission</th>
                  <td>{member.mission}</td>
                </tr>
                <tr>
                  <th scope="row">Readiness</th>
                  <td>
                    {member.readiness.score}/100 · {member.readiness.label}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Flagged zones</th>
                  <td>{flagged.length === 0 ? "none" : flagged.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {tab === "Vitals" && (
          <table className="spec-table">
            <tbody>
              {member.zones.flatMap((z) =>
                z.vitals.map((v) => (
                  <tr key={`${z.id}-${v.key}`}>
                    <th scope="row">
                      {technical ? `${z.name} — ${v.label}` : v.label}
                    </th>
                    <td>
                      <StatusDot level={v.status} />{" "}
                      {v.value} {v.unit}
                      {technical && (
                        <span style={{ color: "var(--dim)" }}>
                          {" "}
                          · {new Date(v.updatedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}

        {tab === "Biometrics" && (
          <table className="spec-table">
            <tbody>
              {member.biometrics.map((b) => (
                <tr key={b.label}>
                  <th scope="row">{b.label}</th>
                  <td>
                    {b.value} {b.unit ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Risks" && (
          <div>
            {member.risks.map((r) => (
              <div key={r.name} className="callout" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>
                    {r.name}
                  </span>
                  <button
                    className="micro-8"
                    style={{ color: "var(--accent)" }}
                    onClick={() =>
                      focus(member.zones.find((z) => z.id === r.zoneId)!)
                    }
                  >
                    LOCATE
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  {r.cause}
                </p>
                <p
                  className="micro"
                  style={{ marginTop: 6, color: "var(--status-nominal)" }}
                >
                  → {r.mitigation}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "Protocols" && (
          <table className="spec-table">
            <tbody>
              {member.protocols.map((p) => (
                <tr key={p.label}>
                  <th scope="row">{p.label}</th>
                  <td>{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "Checks" && (
          <table className="spec-table">
            <tbody>
              {member.checks.map((c) => (
                <tr key={c.label}>
                  <th scope="row">{c.label}</th>
                  <td>{c.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* monitored zones — numbered list driving the same focus pipeline */}
        <div style={{ marginTop: 22 }}>
          <Eyebrow>Monitored zones</Eyebrow>
          <div style={{ marginTop: 8 }}>
            {member.zones.map((z, i) => (
              <button
                key={z.id}
                className="zone-list-item"
                aria-pressed={selectedZoneId === z.id}
                onClick={() => focus(z)}
              >
                <span className="zn">{String(i + 1).padStart(2, "0")}</span>
                <span className="zl">{z.name}</span>
                <StatusDot level={z.status} />
              </button>
            ))}
          </div>
        </div>

        {/* drill-down anatomy — organs inside the selected zone */}
        {(() => {
          const selZone = member.zones.find((z) => z.id === selectedZoneId);
          const organs = organsOf(selectedZoneId);
          if (!selZone || organs.length === 0) return null;
          return (
            <div style={{ marginTop: 14 }}>
              <Eyebrow>Internal structures / {selZone.name}</Eyebrow>
              <div style={{ marginTop: 8 }}>
                {organs.map((o) => (
                  <button
                    key={o.id}
                    className="zone-list-item"
                    aria-pressed={selectedOrganId === o.id}
                    onClick={() => focusOrgan(o)}
                  >
                    <span className="zn" style={{ color: "var(--dim)" }}>
                      ├
                    </span>
                    <span className="zl">{o.name}</span>
                    <StatusDot level={selZone.status} />
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <button
          className="callout"
          style={{
            marginTop: 18,
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            textAlign: "left",
            cursor: "pointer",
          }}
          onClick={() => openChat(selectedZoneId)}
        >
          <MessageSquare size={13} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Ask Medic AI about this crew member…
          </span>
        </button>

        <div style={{ marginTop: 16 }}>
          <Disclaimer>
            SIMULATED TELEMETRY · CURATED DATASET · NOT A MEDICAL DEVICE.
            TRIAGE CLASSIFICATIONS ARE ILLUSTRATIVE.
          </Disclaimer>
        </div>
      </div>
    </div>
  );
}
