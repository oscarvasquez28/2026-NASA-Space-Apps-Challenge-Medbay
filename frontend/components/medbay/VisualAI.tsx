"use client";

/**
 * Visual AI Model (spec §7).
 *  - The mascot reacts to the emotional tone of the conversation.
 *  - Yellow NEW SKIN star → ◀ ▶ arrows to switch owned skins; seen skins
 *    clear the star.
 *  - Clicking the model opens the AI panel: last reply, suggested FAQs and a
 *    text field with microphone + send arrow. In `floating` mode the panel is
 *    a draggable overlay window (drag its header) so it never consumes stage
 *    layout; the offline-LLM and TTS toggles live in the window header.
 * Conversation state is shared (companion store) with /medic.
 */

import { ChevronLeft, ChevronRight, GripHorizontal, Square, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import ReactMarkdown from "react-markdown";

import { ArrowIcon, LocalLlmIcon, MicrophoneIcon, NewSkinIcon, TtsIcon } from "@/components/icons/medbay";
import { MascotStage } from "@/components/mascot/MascotStage";
import { Eyebrow, StatusDot } from "@/components/ui/primitives";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { mascotDef, type MascotSkinId } from "@/data/mascots";
import { useAICompanion } from "@/hooks/useAICompanion";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useMascotEmotion } from "@/hooks/useMascotEmotion";
import { useSpeech } from "@/hooks/useSpeech";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { extrasOf, unseenMascots, useUserStore } from "@/stores/user-store";
import { useOptionalViewerApi } from "@/stores/viewer-store";
import type { BodyZone, CrewMember } from "@/types/health";

export const AI_TAGLINE =
  "As I talk to you, my words appear here, so that you can understand me even if you can't hear.";

function plain(md: string) {
  return md.replace(/[*_`#>]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\s+/g, " ").trim();
}

type RecognitionCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface VisualAIProps {
  member?: CrewMember | null;
  /** stage = compact corner box; dock = panel always open (dashboard); hero = large, no chat. */
  variant?: "stage" | "dock" | "hero";
  /** Overlay the chat as a draggable floating window instead of inline panel. */
  floating?: boolean;
  size?: number;
  faqs?: string[];
  contextZone?: BodyZone | null;
  className?: string;
  /** Hide the caption next to the box (e.g. tiny layouts). */
  caption?: boolean;
}

export function VisualAI({
  member,
  variant = "stage",
  floating = false,
  size = 150,
  faqs = [],
  contextZone,
  className,
  caption = true,
}: VisualAIProps) {
  const { activeUser } = useCheckIn();
  const extrasMap = useUserStore((s) => s.extras);
  const equipMascot = useUserStore((s) => s.equipMascot);
  const markMascotSeen = useUserStore((s) => s.markMascotSeen);
  const extras = extrasOf(extrasMap, activeUser?.id);
  const unseen = unseenMascots(extras);

  const forceOffline = useAppStore((s) => s.forceOffline);
  const setForceOffline = useAppStore((s) => s.setForceOffline);
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const setTtsEnabled = useAppStore((s) => s.setTtsEnabled);

  const crewId = member?.id ?? activeUser?.astronautId;
  const { messages, thinking, error, send, cancel } = useAICompanion(crewId);
  const emotion = useMascotEmotion();
  const speech = useSpeech();
  const viewer = useOptionalViewerApi();

  const [open, setOpen] = useState(variant === "dock");
  const [browsing, setBrowsing] = useState(false);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<InstanceType<RecognitionCtor> | null>(null);

  // Floating window: translate offset from the bottom-right anchor + drag state.
  const hostRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0 });

  const lastReply = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const panelOpen = variant === "dock" || (open && variant !== "hero");
  const skin: MascotSkinId = extras.equippedMascot;

  const submit = (text: string) => {
    const prompt = text.trim();
    if (!prompt || !crewId) return;
    setDraft("");
    void send(
      prompt,
      contextZone?.id ?? null,
      (r) => {
        const focus = r.actions.find((a) => a.type === "focus");
        if (focus && viewer && member) {
          const z = member.zones.find((x) => x.id === focus.zoneId);
          if (z) viewer.getState().focus(z);
        }
        if (!ttsEnabled) return;
        void speech.speak(r.message, {
          preloadedResponse: r.voicePayload ?? undefined,
          forceOffline: r.offlineMode ?? forceOffline,
          astronautId: crewId,
        });
      },
      { forceOffline, includeVoice: ttsEnabled },
    );
  };

  const cycle = (dir: 1 | -1) => {
    if (!activeUser) return;
    const owned = extras.mascotSkins;
    const next = owned[(owned.indexOf(skin) + dir + owned.length) % owned.length];
    equipMascot(activeUser.id, next);
    markMascotSeen(activeUser.id, next);
  };

  // Viewing a skin while browsing marks it seen (the star disappears once all are seen).
  useEffect(() => {
    if (browsing && activeUser) markMascotSeen(activeUser.id, skin);
  }, [browsing, skin, activeUser, markMascotSeen]);

  const onDragStart = (e: ReactPointerEvent<HTMLElement>) => {
    dragStart.current = { px: e.clientX, py: e.clientY, x: drag.x, y: drag.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLElement>) => {
    const start = dragStart.current;
    const win = winRef.current;
    const host = hostRef.current;
    if (!start || !win || !host) return;
    const hostRect = host.getBoundingClientRect();
    const winRect = win.getBoundingClientRect();
    const baseLeft = winRect.left - drag.x;
    const baseTop = winRect.top - drag.y;
    const wantedX = start.x + (e.clientX - start.px);
    const wantedY = start.y + (e.clientY - start.py);
    const clampedLeft = Math.min(
      Math.max(baseLeft + wantedX, hostRect.left + 6),
      hostRect.right - winRect.width - 6,
    );
    const clampedTop = Math.min(
      Math.max(baseTop + wantedY, hostRect.top + 6),
      hostRect.bottom - winRect.height - 6,
    );
    setDrag({ x: clampedLeft - baseLeft, y: clampedTop - baseTop });
  };
  const onDragEnd = () => {
    dragStart.current = null;
  };

  const toggleMic = () => {
    const Rec = getRecognition();
    if (!Rec) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? "";
      if (t) submit(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const captionText = thinking
    ? "Thinking…"
    : error
      ? error
      : lastReply
        ? plain(lastReply.text).slice(0, 220) + (plain(lastReply.text).length > 220 ? "…" : "")
        : AI_TAGLINE;

  const box = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {unseen.length > 0 && variant !== "hero" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setBrowsing((b) => !b)}
              className="absolute -left-9 -top-9 z-10 grid size-9 place-items-center bg-risk text-black"
              aria-label="New skins available"
            >
              <NewSkinIcon size={22} style={{ color: "#000" }} />
            </button>
          </TooltipTrigger>
          <TooltipContent>New skin available — browse your Visual AI skins</TooltipContent>
        </Tooltip>
      )}
      <button
        type="button"
        onClick={() => variant !== "hero" && setOpen((o) => !o)}
        className={cn(
          "grid size-full place-items-center transition-all",
          variant === "hero"
            ? ""
            : cn(
                "medbay-surface",
                panelOpen
                  ? "medbay-surface-state shadow-[0_0_22px_var(--accent-soft)]"
                  : "hover:border-highlight/60 hover:shadow-[0_0_18px_var(--accent-soft)]",
              ),
        )}
        aria-label={`${mascotDef(skin).name} — ${panelOpen ? "close" : "open"} Visual AI panel`}
        aria-expanded={panelOpen}
      >
        <MascotStage skin={skin} emotion={emotion} size={Math.round(size * 0.86)} />
      </button>
      {browsing && extras.mascotSkins.length > 1 && (
        <div className="absolute inset-x-0 -bottom-8 flex items-center justify-between">
          <button type="button" onClick={() => cycle(-1)} aria-label="Previous skin" className="hover:text-state">
            <ChevronLeft size={22} />
          </button>
          <span className="medbay-micro">{mascotDef(skin).name}</span>
          <button type="button" onClick={() => cycle(1)} aria-label="Next skin" className="hover:text-state">
            <ChevronRight size={22} />
          </button>
        </div>
      )}
    </div>
  );

  if (variant === "hero") {
    return <div className={className}>{box}</div>;
  }

  const chatBody = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2" role="log" aria-live="polite">
        {lastReply ? (
          <div className="md-body text-[12px] leading-snug">
            <ReactMarkdown>{lastReply.text}</ReactMarkdown>
          </div>
        ) : (
          <p className="medbay-copy text-[11px]">{thinking ? "Thinking…" : AI_TAGLINE}</p>
        )}
        {thinking && lastReply && <p className="medbay-micro mt-2 text-state">Thinking…</p>}
        {error && <p className="medbay-micro mt-2 text-critical">{error}</p>}
        <div className="mt-2 flex flex-col items-end gap-1 pb-2">
          {faqs.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              disabled={thinking}
              className="medbay-copy max-w-full truncate border border-input bg-black/50 px-2 py-1 text-right text-[11px] text-state/90 transition-colors hover:border-state hover:text-state disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
      <form
        className="flex items-center gap-2 border-t border-input px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        {getRecognition() && (
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={listening}
            aria-label="Voice input"
            className={cn("shrink-0", listening ? "text-state" : "text-foreground/80 hover:text-state")}
          >
            <MicrophoneIcon size={20} />
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={listening ? "Listening…" : "Ask me anything..."}
          aria-label="Ask the Visual AI"
          maxLength={1600}
          className="medbay-copy min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground/50"
        />
        {thinking ? (
          <button type="button" onClick={cancel} aria-label="Cancel" className="shrink-0 hover:text-state">
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim()} aria-label="Send" className="shrink-0 hover:text-state disabled:opacity-40">
            <ArrowIcon size={20} style={{ transform: "rotate(180deg)" }} />
          </button>
        )}
      </form>
      <div className="flex items-center justify-between border-t border-input px-3 py-1">
        <span className="medbay-micro text-foreground/50">
          {lastReply?.response?.providerUsed ?? (forceOffline ? "local fallback" : "hybrid router")}
        </span>
        <Link href="/medic" className="medbay-micro text-foreground/60 hover:text-state">
          Full conversation →
        </Link>
      </div>
    </>
  );

  const toggles = (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setForceOffline(!forceOffline)}
            aria-pressed={forceOffline}
            aria-label="Force AI offline"
            className={cn(
              "grid size-8 place-items-center border transition-colors",
              forceOffline ? "border-state bg-state text-white" : "border-input bg-black/60 hover:border-state",
            )}
          >
            <LocalLlmIcon size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent>{forceOffline ? "AI forced offline — local fallback LLM" : "Force the AI offline (local fallback LLM)"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => {
              if (ttsEnabled) speech.cancel();
              setTtsEnabled(!ttsEnabled);
            }}
            aria-pressed={ttsEnabled}
            aria-label="Text to speech"
            className={cn(
              "grid size-8 place-items-center border transition-colors",
              ttsEnabled ? "border-state bg-state text-white" : "border-input bg-black/60 hover:border-state",
            )}
          >
            <TtsIcon size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Text-to-speech {ttsEnabled ? "on" : "off"}</TooltipContent>
      </Tooltip>
    </>
  );

  const panelHeader = (
    <>
      <Eyebrow>AI COMPANION</Eyebrow>
      <StatusDot level={forceOffline ? "OFFLINE" : "NOMINAL"} />
      <span className="micro ml-auto text-[8px] text-[var(--dim)]">
        {forceOffline ? "LOCAL SIM" : "HYBRID ROUTER"}
      </span>
    </>
  );

  /* ------- floating overlay: mascot anchors bottom-right, window drags ------- */
  if (floating) {
    return (
      <div ref={hostRef} className={cn("pointer-events-none absolute inset-0 z-20", className)}>
        {open && (
          <div
            ref={winRef}
            className="medbay-floatwin medbay-float-in pointer-events-auto absolute flex h-[min(46vh,340px)] w-[min(92%,400px)] flex-col"
            style={{
              right: 12,
              bottom: size + 30,
              // never let the window spill past the top of the stage
              maxHeight: `calc(100% - ${size + 44}px)`,
              transform: `translate(${drag.x}px, ${drag.y}px)`,
            }}
          >
            <div
              role="button"
              aria-label="Drag the Visual AI window"
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-input px-3 py-1.5 active:cursor-grabbing"
            >
              <GripHorizontal size={13} className="shrink-0 text-foreground/40" aria-hidden />
              {panelHeader}
              <span onPointerDown={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                {toggles}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Visual AI"
                  className="grid size-8 place-items-center border border-input bg-black/60 transition-colors hover:border-critical hover:text-critical"
                >
                  <X size={15} />
                </button>
              </span>
            </div>
            {chatBody}
          </div>
        )}
        <div className="pointer-events-auto absolute bottom-3 right-3">{box}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-end gap-3", className)}>
      {panelOpen ? (
        <div
          className={cn(
            "medbay-surface flex min-w-0 flex-1 flex-col",
            variant === "dock" ? "h-full" : "h-[min(46vh,320px)] w-[min(40vw,440px)]",
          )}
        >
          <div className="flex items-center gap-3 border-b border-input px-3 py-1.5">
            {panelHeader}
            <span className="flex items-center gap-1.5">{toggles}</span>
          </div>
          {chatBody}
        </div>
      ) : (
        caption && (
          <p className="medbay-copy mb-1 max-w-[440px] text-right text-[11px] leading-snug" aria-live="polite">
            {captionText}
          </p>
        )
      )}
      {box}
    </div>
  );
}
