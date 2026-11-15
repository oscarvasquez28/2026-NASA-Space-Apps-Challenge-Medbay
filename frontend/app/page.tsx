"use client";

/**
 * / — Lab home: hero with auto-rotating 3D astronaut, spec strip, crew
 * preview gallery, lab philosophy, mission journey, honesty endnote.
 */

import { Activity, Brain, Eye, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  Disclaimer,
  Eyebrow,
  StatusDot,
} from "@/components/ui/primitives";
import { ModelViewport } from "@/components/three/model-viewport";
import {
  GalleryPreview,
  SharedGallery,
} from "@/components/three/shared-gallery";
import { ViewerProvider } from "@/stores/viewer-store";
import { ChecklistWidget } from "@/components/widgets/ChecklistWidget";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useCrew } from "@/hooks/useCrew";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useProvider } from "@/hooks/useProvider";
import { useAppStore } from "@/stores/app-store";
import { DEFAULT_CREW_ID, getCrewMember } from "@/data/crew";

const JOURNEY = [
  { n: "01", t: "Ingest", d: "Suit + biomonitor telemetry streams into the lab." },
  { n: "02", t: "Triage", d: "Deterministic engine classifies zones — no uplink required." },
  { n: "03", t: "Inspect", d: "Click the body. Read the region. Watch the flags." },
  { n: "04", t: "Advise", d: "The companion explains — and points at the zone." },
];

export default function LabHome() {
  const provider = useProvider();
  const { activeUser } = useCheckIn();
  const { crew, loading } = useCrew();
  const { profile } = useLocationContext();
  const viewMode = useAppStore((s) => s.viewMode);
  const activeGamificationId = activeUser?.astronautId ?? DEFAULT_CREW_ID;
  const hero =
    crew.find((c) => c.id === DEFAULT_CREW_ID) ??
    crew[0] ??
    getCrewMember(DEFAULT_CREW_ID)!;
  const flagged = hero.zones.filter((z) => z.status !== "NOMINAL").length;

  return (
    <SharedGallery>
      {/* ------------------------------ hero ------------------------------ */}
      <section className="hero">
        <div className="hero-copy">
          <Eyebrow>MED.001 / EXPLORE MODE</Eyebrow>
          <h1>
            Health lab<br />for crews<sup>®</sup>
          </h1>
          <p className="hero-sub">
            An interactive digital lab for astronaut physiology — orbit a
            procedural body, click its zones, read triage status, and ask the
            companion that points at what it describes.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href={`/crew/${DEFAULT_CREW_ID}`} className="btn btn-primary">
              Enter monitor →
            </Link>
            <Link href="/crew" className="btn">
              Crew roster
            </Link>
          </div>
          <div
            className="micro-8"
            style={{ display: "flex", gap: 14, marginTop: 6 }}
          >
            <span>6 MONITORED ZONES</span>
            <span>PROCEDURAL 3D</span>
            <span>OFFLINE-FIRST TRIAGE</span>
          </div>
        </div>

        <div className="hero-canvas-wrap">
          <ViewerProvider>
            <ModelViewport zones={hero.zones}>
              <div className="viewer-scene-meta">EVA SUIT · TURNTABLE</div>
              <div className="viewer-bottom-left">drag to orbit</div>
            </ModelViewport>
          </ViewerProvider>
          <div className="scanner-line" aria-hidden />
          <div className="hero-callout callout-line" style={{ top: "16%", right: "10%" }}>
            helmet enclosure
            <br />
            <span style={{ color: "var(--dim)" }}>zone 01 / head-neuro</span>
          </div>
          <div className="hero-callout callout-line" style={{ bottom: "26%", left: "6%" }}>
            monitored zones
            <br />
            <span style={{ color: "var(--dim)" }}>
              {hero.zones.length} active · {flagged} flagged
            </span>
          </div>
        </div>
      </section>

      {/* --------------------------- spec strip --------------------------- */}
      <section className="hero-data-strip" aria-label="Mission metrics">
        {[
          { l: "CREW ON BOARD", v: String(crew.length || 4).padStart(2, "0"), u: "AST" },
          { l: "ENVIRONMENT", v: String(profile.gravityG ?? 0), u: "g" },
          { l: "ZONES MONITORED", v: String(hero.zones.length).padStart(2, "0"), u: "CH" },
          { l: "COMM LATENCY", v: String(profile.commLatencySec), u: "s" },
          {
            l: "LINK MODE",
            v:
              provider?.kind === "rest"
                ? profile.offlineFallbackActive
                  ? "LOCAL"
                  : "LIVE"
                : "SIM",
            u: "",
          },
        ].map((c) => (
          <div key={c.l} className="cell">
            <div className="micro-8">{c.l}</div>
            <div className="v">
              {c.v}
              <small>{c.u}</small>
            </div>
          </div>
        ))}
      </section>

      {/* ------------------------- crew discovery ------------------------- */}
      <section style={{ padding: "34px 40px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <Eyebrow>Discovery / crew</Eyebrow>
          <span className="micro-8" style={{ marginLeft: "auto" }}>
            {loading ? "…" : `${crew.length} MEMBERS`}
          </span>
        </div>
        <div className="crew-grid" style={{ marginTop: 18 }}>
          {crew.slice(0, 3).map((c) => {
            const worst = [...c.zones].sort(
              (a, b) =>
                ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"].indexOf(b.status) -
                ["NOMINAL", "CAUTION", "URGENT", "CRITICAL"].indexOf(a.status),
            )[0];
            return (
              <Link
                key={c.id}
                href={`/crew/${c.id}`}
                className="card crew-card"
                style={{ display: "block" }}
              >
                <div className="preview-box">
                  <GalleryPreview zones={c.zones} spin={false} />
                  <div
                    className="micro-8"
                    style={{ position: "absolute", top: 8, left: 10, zIndex: 6 }}
                  >
                    {c.id}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 10,
                      zIndex: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <StatusDot level={worst.status} />
                  </div>
                </div>
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    <span className="micro-8">{c.callsign}</span>
                  </div>
                  <div className="micro-8" style={{ marginTop: 5 }}>
                    {c.role} · RDY {c.readiness.score}
                  </div>
                  <div
                    className="micro-8"
                    style={{ marginTop: 8, color: "var(--accent)" }}
                  >
                    EXPLORE →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ------------------------ checklist widget ------------------------ */}
      <section style={{ padding: "0 40px 34px" }}>
        <ChecklistWidget crewId={activeGamificationId} />
      </section>

      {/* -------------------------- philosophy --------------------------- */}
      <section
        style={{
          padding: "34px 40px",
          borderTop: "1px solid var(--line)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 24,
        }}
      >
        {[
          {
            icon: Eye,
            t: "Understand. Not just observe.",
            d: "Every zone on the body links to live readings — click anatomy, get physiology.",
          },
          {
            icon: Activity,
            t: "Offline-first triage.",
            d: "Deterministic rules classify severity without Earth uplink. Always available.",
          },
          {
            icon: Brain,
            t: "A companion that points.",
            d: "The copilot answers and moves the camera to the region it is describing.",
          },
          {
            icon: ShieldCheck,
            t: "Honest by design.",
            d: "Everything is simulated and labeled. No silent thresholds, no fake certainty.",
          },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t}>
            <Icon size={16} style={{ color: "var(--accent)" }} />
            <h3 style={{ fontSize: 14, fontWeight: 500, marginTop: 10 }}>{t}</h3>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.8 }}>
              {d}
            </p>
          </div>
        ))}
      </section>

      {/* ------------------------- mission journey ------------------------ */}
      <section style={{ padding: "34px 40px", borderTop: "1px solid var(--line)" }}>
        <Eyebrow>Pipeline / how it works</Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 0,
            marginTop: 18,
            border: "1px solid var(--line)",
            borderRadius: 4,
          }}
        >
          {JOURNEY.map((s, i) => (
            <div
              key={s.n}
              style={{
                padding: "16px 18px",
                borderRight: i < JOURNEY.length - 1 ? "1px solid var(--line)" : "none",
              }}
            >
              <div className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>
                {s.n}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>{s.t}</div>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.7 }}>
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div style={{ padding: "0 40px 34px", textAlign: "center" }}>
        <Disclaimer>
          BUILT FOR CURIOSITY. ENGINEERED FOR UNDERSTANDING. ·{" "}
          {viewMode === "technical" ? "TECHNICAL VIEW" : "HIGH-LEVEL VIEW"}
        </Disclaimer>
      </div>
    </SharedGallery>
  );
}
