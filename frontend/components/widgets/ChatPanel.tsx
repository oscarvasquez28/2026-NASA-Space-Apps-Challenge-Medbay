"use client";

/**
 * ChatPanel — AI companion widget (module D). Reused as the explorer drawer
 * and as the /medic page panel.
 *
 * Connects to POST /api/v1/ai/chat (with RAG citations, multimodal image
 * attachments, force_offline toggle, view_mode, include_voice) and
 * POST /api/v1/ai/tts (waveform + real-time mouth viseme playback).
 */

import {
  Activity,
  AlertTriangle,
  Brain,
  Camera,
  Crosshair,
  HeartPulse,
  Rocket,
  RotateCcw,
  SendHorizontal,
  ShieldCheck,
  Square,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Disclaimer, Eyebrow } from "@/components/ui/primitives";
import { useAICompanion } from "@/hooks/useAICompanion";
import { useSpeech } from "@/hooks/useSpeech";
import {
  fileToRawBase64,
  SAMPLE_DIAGNOSTIC_PNG_BASE64,
} from "@/lib/sample-media";
import { useAppStore } from "@/stores/app-store";
import { useViewerApi, useViewerStore } from "@/stores/viewer-store";
import type { BackendStatus, BodyZone, CrewMember, ZoneId } from "@/types/health";

interface FastAction {
  icon: typeof Activity;
  label: string;
  prompt: string;
  forceOffline?: boolean;
  attachSampleImage?: boolean;
}

const FAST_ACTIONS: FastAction[] = [
  {
    icon: Brain,
    label: "#20 SANS vision & CO2",
    prompt:
      "What is happening to my vision and cabin CO2? Should I adjust exertion?",
  },
  {
    icon: Rocket,
    label: "#21 EVA hypoxia risk",
    prompt:
      "Evaluate EVA cardiorespiratory decompression bends risk and hypoxic threshold telemetry.",
  },
  {
    icon: Camera,
    label: "#22 Offline rash scan",
    prompt:
      "I notice a skin rash lesion after solar particle exposure. Perform offline multimodal triage.",
    forceOffline: true,
    attachSampleImage: true,
  },
  {
    icon: AlertTriangle,
    label: "Critical zones",
    prompt: "Which anatomical zones are critical or caution right now?",
  },
  {
    icon: ShieldCheck,
    label: "Countermeasures",
    prompt: "What clinical countermeasures apply to my current risks?",
  },
  {
    icon: HeartPulse,
    label: "Cardiac & blood pressure",
    prompt: "Summarize my cardiovascular chest vitals and readouts.",
  },
  {
    icon: Crosshair,
    label: "Selected zone brief",
    prompt: "Tell me about the selected anatomical zone",
  },
];

const VISEME_SHAPES = ["rest", "A", "E", "I", "O", "U", "M"] as const;

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
  const [forceOffline, setForceOffline] = useState(false);
  const [includeVoice, setIncludeVoice] = useState(false);
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(
    null,
  );
  const [attachedImageName, setAttachedImageName] = useState<string | null>(
    null,
  );

  const [voiceConsoleOpen, setVoiceConsoleOpen] = useState(false);
  const [ttsText, setTtsText] = useState(
    "Caution: cabin CO2 rising and mild SANS visual shift detected.",
  );
  const [ttsSeverity, setTtsSeverity] = useState<BackendStatus>("caution");
  const [ttsOffline, setTtsOffline] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const focusZone = (zoneId: ZoneId) => {
    const z = member.zones.find((x) => x.id === zoneId);
    if (z) viewerApi.getState().focus(z);
  };

  const submit = (
    text: string,
    overrideOpts?: {
      forceOffline?: boolean;
      diagnosticImageBase64?: string | null;
    },
  ) => {
    const prompt = text.trim();
    if (!prompt) return;
    const offline = overrideOpts?.forceOffline ?? forceOffline;
    const img =
      overrideOpts?.diagnosticImageBase64 !== undefined
        ? overrideOpts.diagnosticImageBase64
        : attachedImageBase64;
    if (overrideOpts?.forceOffline !== undefined) {
      setForceOffline(overrideOpts.forceOffline);
    }
    setDraft("");
    setAttachedImageBase64(null);
    setAttachedImageName(null);

    void send(
      prompt,
      contextZone?.id ?? null,
      (response) => {
        const action = response.actions.find((a) => a.type === "focus");
        if (action) focusZone(action.zoneId);
        if (response.voicePayload) {
          void speech.speak(response.message, {
            preloadedResponse: response.voicePayload,
            astronautId: member.id,
          });
        }
      },
      {
        forceOffline: offline,
        includeVoice,
        diagnosticImageBase64: img,
      },
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, thinking]);

  const ctxZone =
    contextZone ?? member.zones.find((z) => z.id === selectedZoneId) ?? null;

  const technical = viewMode === "technical";

  return (
    <div className="chat-shell">
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow>ASTROLAB / MEDIC + RAG + VOICE</Eyebrow>
          <div style={{ fontSize: 14, fontWeight: 500, marginTop: 4 }}>
            Clinical copilot.
          </div>
        </div>
        <button
          className="btn"
          aria-pressed={voiceConsoleOpen}
          onClick={() => setVoiceConsoleOpen((v) => !v)}
          title="Voice TTS & Viseme Console (POST /api/v1/ai/tts)"
        >
          <Volume2 size={11} />
          TTS
        </button>
        <button className="btn" onClick={reset} aria-label="New conversation">
          <RotateCcw size={11} />
        </button>
        {onClose && (
          <button className="btn" onClick={onClose} aria-label="Close chat">
            <X size={11} />
          </button>
        )}
      </div>

      {/* context + routing controls strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 14px",
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <span className="micro-8">
          {member.callsign} · {member.id}
        </span>
        <label
          className="micro-8"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={forceOffline}
            onChange={(e) => setForceOffline(e.target.checked)}
          />
          FORCE OFFLINE
        </label>
        <label
          className="micro-8"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={includeVoice}
            onChange={(e) => setIncludeVoice(e.target.checked)}
          />
          AUTO TTS
        </label>
        <span
          className="micro-8"
          style={{
            marginLeft: "auto",
            color: speech.speaking ? "var(--accent)" : "var(--dim)",
          }}
        >
          {speech.speaking
            ? `SPEAKING · VISEME [${speech.activeViseme}]`
            : `TTS ${speech.mode.toUpperCase()}`}
        </span>
      </div>

      {/* Voice TTS & Viseme Console (Postman #23, #23.2, #24) */}
      {voiceConsoleOpen && (
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--line)",
            background: "rgba(15, 23, 42, 0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Eyebrow>Voice TTS & Lip-Sync Viseme Test (#23 / #24)</Eyebrow>
            <span style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 3 }}>
              {VISEME_SHAPES.map((v) => (
                <span
                  key={v}
                  className="micro-8"
                  style={{
                    padding: "2px 5px",
                    border: "1px solid var(--line)",
                    borderRadius: 3,
                    background:
                      speech.activeViseme === v ? "var(--accent)" : "transparent",
                    color: speech.activeViseme === v ? "#060911" : "var(--dim)",
                    fontWeight: speech.activeViseme === v ? 700 : 400,
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            <button
              className="camera-preset"
              onClick={() => {
                const txt =
                  "Caution: SANS ocular drift and elevated CO2 logged. Begin self-exam.";
                setTtsText(txt);
                setTtsSeverity("caution");
                setTtsOffline(true);
                void speech.speak(txt, {
                  severity: "caution",
                  forceOffline: true,
                  astronautId: member.id,
                });
              }}
            >
              #23 Offline Caution
            </button>
            <button
              className="camera-preset"
              onClick={() => {
                const txt =
                  "Nominal telemetry confirmed. Daily orbital exercise target met.";
                setTtsText(txt);
                setTtsSeverity("nominal");
                setTtsOffline(false);
                void speech.speak(txt, {
                  severity: "nominal",
                  forceOffline: false,
                  astronautId: member.id,
                });
              }}
            >
              #23.2 Online Voice
            </button>
            <button
              className="camera-preset"
              onClick={() => {
                const txt =
                  "CRITICAL ALERT: Suit pressure below 29.6 kilopascals and SpO2 critical. Abort EVA now.";
                setTtsText(txt);
                setTtsSeverity("critical");
                setTtsOffline(true);
                void speech.speak(txt, {
                  severity: "critical",
                  forceOffline: true,
                  astronautId: member.id,
                });
              }}
            >
              #24 Critical Emergency
            </button>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              style={{ flex: 1, minWidth: 160 }}
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              aria-label="TTS announcement text"
            />
            <select
              className="ctx-select"
              value={ttsSeverity}
              aria-label="TTS severity"
              onChange={(e) => setTtsSeverity(e.target.value as BackendStatus)}
            >
              <option value="nominal">nominal</option>
              <option value="caution">caution</option>
              <option value="critical">critical</option>
            </select>
            <label className="micro-8" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <input
                type="checkbox"
                checked={ttsOffline}
                onChange={(e) => setTtsOffline(e.target.checked)}
              />
              Offline
            </label>
            {speech.speaking ? (
              <button className="btn" onClick={() => speech.cancel()}>
                <Square size={10} /> Stop
              </button>
            ) : (
              <button
                className="btn btn-primary"
                disabled={speech.loading || !ttsText.trim()}
                onClick={() =>
                  void speech.speak(ttsText, {
                    severity: ttsSeverity,
                    forceOffline: ttsOffline,
                    astronautId: member.id,
                  })
                }
              >
                <Volume2 size={10} />
                {speech.loading ? "Synth…" : "Speak"}
              </button>
            )}
          </div>

          {speech.lastResponse && (
            <div className="micro-8" style={{ marginTop: 6, color: "var(--muted)" }}>
              {speech.lastResponse.provider_used} · {speech.lastResponse.mime_type} ·{" "}
              {speech.lastResponse.duration_ms}ms ·{" "}
              {speech.lastResponse.viseme_cues.length} viseme cues ·{" "}
              {speech.lastResponse.offline_mode ? "offline synth" : "cloud relay"}
            </div>
          )}
          {speech.error && (
            <div className="micro-8" style={{ marginTop: 4, color: "var(--status-critical)" }}>
              {speech.error}
            </div>
          )}
        </div>
      )}

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
              Hybrid Gemini / Ollama MedGemma / Offline RAG clinical copilot.
              Ask about symptoms, telemetry anomalies, or attach a diagnostic scan.
            </p>
            <div className="fast-actions">
              {FAST_ACTIONS.map((fa) => {
                const Icon = fa.icon;
                return (
                  <button
                    key={fa.label}
                    className="fast-action"
                    onClick={() =>
                      submit(
                        fa.label === "Selected zone brief" && ctxZone
                          ? `Tell me about ${ctxZone.name}`
                          : fa.prompt,
                        {
                          forceOffline: fa.forceOffline,
                          diagnosticImageBase64: fa.attachSampleImage
                            ? SAMPLE_DIAGNOSTIC_PNG_BASE64
                            : undefined,
                        },
                      )
                    }
                  >
                    <Icon size={13} />
                    {fa.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {m.contextZoneId && (
                <span className="ctx">ctx: {m.contextZoneId}</span>
              )}
              {m.hasImage && (
                <span className="micro-8" style={{ color: "var(--accent)" }}>
                  📷 IMAGE ATTACHED
                </span>
              )}
              {m.role === "assistant" && (
                <button
                  className="micro-8"
                  style={{
                    marginLeft: "auto",
                    color: "var(--accent)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                  onClick={() =>
                    speech.speaking
                      ? speech.cancel()
                      : void speech.speak(m.text, {
                          preloadedResponse: m.response?.voicePayload ?? undefined,
                          forceOffline: m.response?.offlineMode ?? forceOffline,
                          astronautId: member.id,
                        })
                  }
                >
                  {speech.speaking ? <Square size={9} /> : <Volume2 size={9} />}
                  SPEAK
                </button>
              )}
            </div>

            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>

            {m.response && m.response.recommendedActions && m.response.recommendedActions.length > 0 && (
              <ul
                style={{
                  margin: "8px 0 0",
                  paddingLeft: 16,
                  fontSize: 11,
                  color: "var(--status-nominal)",
                }}
              >
                {m.response.recommendedActions.map((act) => (
                  <li key={act}>{act}</li>
                ))}
              </ul>
            )}

            {m.response && m.response.referencedZoneIds.length > 0 && (
              <div style={{ marginTop: 6 }}>
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

            {m.response &&
              m.response.retrievedKnowledge &&
              m.response.retrievedKnowledge.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {m.response.retrievedKnowledge.map((doc) => (
                    <div key={doc.chunk_key} className="insight-card">
                      <div className="ic-cat">
                        {doc.category} · score {(doc.similarity_score ?? doc.score).toFixed(2)}
                      </div>
                      <div className="ic-title">{doc.title}</div>
                      <div className="ic-desc">
                        {technical ? doc.content_technical : doc.content_high_level}
                      </div>
                      <div className="micro-8" style={{ marginTop: 4, color: "var(--dim)" }}>
                        SRC: {doc.source_reference}
                      </div>
                    </div>
                  ))}
                </div>
              )}

            {m.response && m.response.assumptions.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="micro-8" style={{ cursor: "pointer" }}>
                  ROUTING &amp; LIMITS ·{" "}
                  {m.response.providerUsed ?? m.response.mode}
                  {m.response.triageTier ? ` · ${m.response.triageTier}` : ""}
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
          <div
            className="chat-msg assistant"
            role="alert"
            style={{ borderColor: "var(--status-critical)" }}
          >
            {error}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="chat-composer">
        {attachedImageBase64 && (
          <div
            className="micro-8"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
              color: "var(--accent)",
            }}
          >
            <span>ATTACHED: {attachedImageName ?? "diagnostic-scan.png"}</span>
            <button
              onClick={() => {
                setAttachedImageBase64(null);
                setAttachedImageName(null);
                if (imgInputRef.current) imgInputRef.current.value = "";
              }}
              aria-label="Remove attached image"
            >
              ×
            </button>
          </div>
        )}

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
            ctxZone ? `Ask about ${ctxZone.name}…` : "Ask the clinical copilot…"
          }
          maxLength={1600}
          aria-label="Message the clinical copilot"
        />
        <input
          ref={imgInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void fileToRawBase64(file).then((b64) => {
              setAttachedImageBase64(b64);
              setAttachedImageName(file.name);
            });
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => imgInputRef.current?.click()}
            title="Attach clinical scan image"
          >
            <Camera size={11} />
            Image
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setAttachedImageBase64(SAMPLE_DIAGNOSTIC_PNG_BASE64);
              setAttachedImageName("sample-rash-scan.png (#22)");
            }}
            title="Attach valid sample PNG for multimodal test #22"
          >
            Sample PNG
          </button>
          <Disclaimer>HYBRID CLINICAL ROUTER + RAG</Disclaimer>
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
