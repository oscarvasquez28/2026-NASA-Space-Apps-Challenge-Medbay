"use client";

/**
 * ChatPanel — AI companion widget (module D). Reused as the explorer drawer
 * and as the /medic page panel.
 *
 * Consumes AssistantResponse contracts { message, referencedZoneIds,
 * actions:[{type:"focus",zoneId}], insights, assumptions, mode } from the
 * provider — zone chips and insights drive the same focus pipeline as the
 * 3D viewport. TTS slot reserved via useSpeech() (stub).
 */

import {
  Activity,
  AlertTriangle,
  Brain,
  Crosshair,
  HeartPulse,
  Moon,
  Rocket,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Disclaimer, Eyebrow } from "@/components/ui/primitives";
import { useAICompanion } from "@/hooks/useAICompanion";
import { useSpeech } from "@/hooks/useSpeech";
import { useAppStore } from "@/stores/app-store";
import { useViewerApi, useViewerStore } from "@/stores/viewer-store";
import type { BodyZone, CrewMember, ZoneId } from "@/types/health";

const FAST_ACTIONS = [
  { icon: Activity, label: "Explain my status", prompt: "Explain my current status" },
  { icon: AlertTriangle, label: "Critical zones", prompt: "Which zones are critical right now?" },
  { icon: Rocket, label: "EVA prep", prompt: "Am I ready for EVA? Run me through prep." },
  { icon: Moon, label: "Sleep & stress", prompt: "How is my sleep and stress profile?" },
  { icon: ShieldCheck, label: "Countermeasures", prompt: "What countermeasures apply to my risks?" },
  { icon: HeartPulse, label: "Heart status", prompt: "How is my heart doing?" },
  { icon: Crosshair, label: "Ask about selected zone", prompt: "Tell me about the selected zone" },
];

interface ChatPanelProps {
  member: CrewMember;
  /** When rendered inside a viewer workspace, focus drives the 3D camera. */
  contextZone?: BodyZone | null;
  onCloseContext?: () => void;
  onClose?: () => void;
}

export function ChatPanel({
  member,
  contextZone,
  onCloseContext,
  onClose,
}: ChatPanelProps) {
  const { messages, thinking, error, send, cancel, reset } =
    useAICompanion(member.id);
  const viewMode = useAppStore((s) => s.viewMode);
  const speech = useSpeech();
  const viewerApi = useViewerApi();
  const selectedZoneId = useViewerStore((s) => s.selectedZoneId);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const focusZone = (zoneId: ZoneId) => {
    const z = member.zones.find((x) => x.id === zoneId);
    if (z) viewerApi.getState().focus(z);
  };

  const submit = (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    setDraft("");
    void send(prompt, contextZone?.id ?? null, (response) => {
      // Assistant "points at" the zone it describes.
      const action = response.actions.find((a) => a.type === "focus");
      if (action) focusZone(action.zoneId);
      if (speech.available) speech.speak(response.message);
    });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  const ctxZone =
    contextZone ?? member.zones.find((z) => z.id === selectedZoneId) ?? null;

  return (
    <div className="chat-shell">
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ flex: 1 }}>
          <Eyebrow>ASTROLAB / MEDIC</Eyebrow>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
            Clinical copilot.
          </div>
        </div>
        <button className="btn" onClick={reset} aria-label="New conversation">
          <RotateCcw size={11} />
        </button>
        {onClose && (
          <button className="btn" onClick={onClose} aria-label="Close chat">
            <X size={11} />
          </button>
        )}
      </div>

      {/* context strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <span className="micro-8">{member.callsign} · {member.id}</span>
        <span className="micro-8" style={{ marginLeft: "auto" }}>
          LOCAL SIMULATION{speech.available ? "" : " · TTS STUB"}
        </span>
      </div>

      {ctxZone && (
        <div style={{ padding: "8px 14px 0" }}>
          <span className="context-pill">
            <Brain size={10} />
            Focused: {ctxZone.name}
            {onCloseContext && (
              <button
                aria-label="Clear zone context"
                onClick={onCloseContext}
                style={{ color: "inherit", display: "grid" }}
              >
                <X size={10} />
              </button>
            )}
          </span>
        </div>
      )}

      {/* conversation */}
      <div className="chat-scroll" ref={scrollRef} role="log" aria-live="polite">
        {messages.length === 0 && !thinking && (
          <div>
            <Eyebrow>Assistant ready</Eyebrow>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.8 }}>
              From telemetry to understanding. Ask about zones, readiness,
              EVA prep or countermeasures — I&apos;ll point at what I describe.
            </p>
            <div className="fast-actions">
              {FAST_ACTIONS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  className="fast-action"
                  onClick={() =>
                    submit(
                      label === "Ask about selected zone" && ctxZone
                        ? `Tell me about ${ctxZone.name}`
                        : prompt,
                    )
                  }
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            {m.contextZoneId && (
              <div className="ctx">ctx: {m.contextZoneId}</div>
            )}
            <div>{m.text}</div>

            {m.response && m.response.referencedZoneIds.length > 0 && (
              <div>
                {m.response.referencedZoneIds.map((id) => {
                  const z = member.zones.find((x) => x.id === id);
                  if (!z) return null;
                  const focused = selectedZoneId === id;
                  return (
                    <button
                      key={id}
                      className={`zone-ref-chip${focused ? " focused" : ""}`}
                      onClick={() => focusZone(id)}
                    >
                      {focused ? "✓ " : ""}
                      {z.name}
                    </button>
                  );
                })}
              </div>
            )}

            {viewMode === "technical" &&
              m.response &&
              m.response.insights.map((ins) => (
                <div key={ins.title} className="insight-card">
                  <div className="ic-cat">{ins.category}</div>
                  <div className="ic-title">{ins.title}</div>
                  <div className="ic-desc">{ins.description}</div>
                  {ins.zoneId && (
                    <button
                      className="zone-ref-chip"
                      onClick={() => focusZone(ins.zoneId!)}
                    >
                      Locate on model
                    </button>
                  )}
                </div>
              ))}

            {m.response && m.response.assumptions.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="micro-8" style={{ cursor: "pointer" }}>
                  ASSUMPTIONS &amp; LIMITS · mode: {m.response.mode}
                </summary>
                <ul
                  style={{
                    margin: "6px 0 0",
                    paddingLeft: 16,
                    color: "var(--dim)",
                    fontSize: 10,
                  }}
                >
                  {m.response.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}

        {thinking && (
          <div className="chat-msg assistant" role="status">
            <span className="thinking" aria-hidden>
              <i /><i /><i />
            </span>
            <button
              className="micro-8"
              style={{ marginLeft: 10, color: "var(--dim)" }}
              onClick={cancel}
            >
              CANCEL
            </button>
          </div>
        )}

        {error && (
          <div className="chat-msg assistant" role="alert" style={{ borderColor: "var(--status-critical)" }}>
            {error}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="chat-composer">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
          placeholder={
            ctxZone ? `Ask about ${ctxZone.name}…` : "Ask the companion…"
          }
          maxLength={1600}
          aria-label="Message the clinical copilot"
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <Disclaimer>SIMULATED AI · CURATED MEDICAL KNOWLEDGE</Disclaimer>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-primary"
            disabled={!draft.trim() || thinking}
            onClick={() => submit(draft)}
            aria-label="Send message"
          >
            <SendHorizontal size={11} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
