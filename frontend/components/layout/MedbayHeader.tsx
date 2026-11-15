"use client";

/**
 * MEDBAY header (spec §3, §9, §10): angled logo plate, headline slot,
 * DB (technical) + camera icons, ASTRONAUT ↔ TECHNICAL view toggle,
 * navigation menu and the LLM status icon (cloud ↔ local server).
 */

import {
  Activity,
  ClipboardList,
  GitCompare,
  Home,
  Menu,
  ScanFace,
  Search,
  Settings,
  Stethoscope,
  Users,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { CameraIcon, CloudLlmIcon, LocalLlmIcon } from "@/components/icons/medbay";
import { EvidenceDialog } from "@/components/medbay/EvidenceDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HEALTH_LABEL } from "@/hooks/useHealthState";
import { useCheckIn } from "@/hooks/useCheckIn";
import { useLlmStatus } from "@/hooks/useLlmStatus";
import { useLocationTheme } from "@/hooks/useLocationTheme";
import { cn } from "@/lib/utils";
import { useAppStore, type HealthState } from "@/stores/app-store";
import { useHeaderStore, type Headline, type HeadlineTone } from "@/stores/header-store";
import { MedbayLogo } from "./MedbayLogo";

const PLATE_W = 300;
const BAND_H = 36;
const HEADER_H = 96;
const SLANT = 46;

const SCREEN0 = ["/checkin", "/register"];

const TONE: Record<HeadlineTone, string> = {
  default: "text-foreground",
  state: "text-state",
  highlight: "text-highlight",
  risk: "text-risk",
  critical: "text-critical",
};

export function MedbayHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { chosen } = useLocationTheme();
  const headline = useHeaderStore((s) => s.headline);
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const health = useAppStore((s) => s.subjectHealth);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const { activeUser } = useCheckIn();
  const llm = useLlmStatus();
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const screen0 = SCREEN0.some((p) => pathname.startsWith(p));
  const technical = viewMode === "technical";
  const isMedic = activeUser?.role === "medic";

  const fallback: Headline = technical
    ? {
        title: "Overview",
        sub: HEALTH_LABEL[health],
        titleTone: "state",
        subTone: health === "critical" ? "critical" : "default",
      }
    : { title: HEALTH_LABEL[health] };
  const h: Headline | null = headline ?? (screen0 ? null : fallback);

  const LlmIcon = llm.local ? LocalLlmIcon : CloudLlmIcon;

  return (
    <header className="medbay-header relative z-40 shrink-0" style={{ height: HEADER_H }}>
      {/* decorative band + angled plate */}
      <div
        aria-hidden
        className="absolute right-0 top-0 border-b border-highlight"
        style={{
          left: PLATE_W + SLANT - 1,
          height: BAND_H,
          background: "var(--header-tint)",
          boxShadow: "0 1px 14px color-mix(in srgb, var(--highlight) 45%, transparent)",
        }}
      />
      <svg
        aria-hidden
        className="absolute left-0 top-0"
        width={PLATE_W + SLANT}
        height={HEADER_H}
        viewBox={`0 0 ${PLATE_W + SLANT} ${HEADER_H}`}
      >
        <polygon
          points={`0,0 ${PLATE_W + SLANT},0 ${PLATE_W + SLANT},${BAND_H} ${PLATE_W},${HEADER_H - 1} 0,${HEADER_H - 1}`}
          fill="var(--header-tint)"
        />
        <polyline
          points={`0,${HEADER_H - 1} ${PLATE_W},${HEADER_H - 1} ${PLATE_W + SLANT},${BAND_H - 0.5}`}
          fill="none"
          stroke="var(--highlight)"
          strokeWidth={1.5}
        />
      </svg>

      <div className="relative flex h-full gap-5 pr-6">
        <Link
          href="/"
          className="flex shrink-0 items-center pl-8"
          style={{ width: PLATE_W }}
          aria-label="MEDBAY home"
        >
          <MedbayLogo location={chosen} size={36} />
        </Link>

        {/* headline + controls live below the accent band line (top BAND_H px) */}
        <div
          className="flex min-w-0 flex-1 items-center gap-5"
          style={{ paddingTop: BAND_H }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-6 pl-10">
          {h?.lead && (
            <div className="flex items-center gap-3">
              <span className="block size-8 shrink-0 overflow-hidden bg-state">
                {h.lead.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={h.lead.photo} alt="" className="size-full object-cover" />
                )}
              </span>
              <span className="medbay-display truncate text-xl">{h.lead.name}</span>
              <span className="medbay-display text-xl">|</span>
            </div>
          )}
          {h && (
            <div className="min-w-0" aria-live="polite">
              <div
                className={cn(
                  "medbay-display truncate text-[26px] leading-none",
                  TONE[h.titleTone ?? "default"],
                )}
              >
                {h.title}
              </div>
              {h.sub && (
                <div
                  className={cn(
                    "medbay-display mt-1 truncate text-[22px] leading-none",
                    TONE[h.subTone ?? "default"],
                  )}
                >
                  {h.sub}
                </div>
              )}
            </div>
          )}
          </div>

          {!screen0 && (
            <div className="flex shrink-0 items-center gap-3">
              {technical && isMedic && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="icon"
                      size="icon"
                      data-active={pathname.startsWith("/medic")}
                      onClick={() => router.push("/medic")}
                      aria-label="Emergency protocol database"
                      className="font-display text-[11px] font-bold"
                    >
                      DB
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Emergency protocol library</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="icon"
                    size="icon"
                    data-active={evidenceOpen}
                    onClick={() => setEvidenceOpen(true)}
                    aria-label="Evidence photos"
                  >
                    <CameraIcon size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Evidence photos — upload or take a picture of a symptom</TooltipContent>
              </Tooltip>
            </div>
          )}

          {!screen0 && <ViewToggle technical={technical} isMedic={isMedic} onToggle={() => setViewMode(technical ? "high_level" : "technical")} />}

        <div className="flex shrink-0 items-center gap-3">
          {!screen0 && <StatusLed health={health} />}
          {!screen0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="icon" size="icon" aria-label="Navigation menu">
                  <Menu size={19} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>MEDBAY / {technical ? "technical" : "astronaut"}</DropdownMenuLabel>
                <NavItem href="/" icon={Home} label="Overview" />
                <NavItem href="/checkin" icon={ScanFace} label="Check-in" />
                <NavItem href="/telemetry" icon={Activity} label="Vitals & trends" />
                <NavItem href="/log" icon={ClipboardList} label="Log vitals" />
                {isMedic && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Medical professional</DropdownMenuLabel>
                    <NavItem href="/crew" icon={Users} label="Crew list" />
                    <NavItem href="/compare" icon={GitCompare} label="Compare crew" />
                    <NavItem href="/medic" icon={Stethoscope} label="Protocol DB" />
                    <NavItem href="/users" icon={UsersRound} label="Operators" />
                  </>
                )}
                <DropdownMenuSeparator />
                <NavItem href="/settings" icon={Settings} label="Settings" />
                <DropdownMenuItem onSelect={() => setCommandOpen(true)}>
                  <Search /> Search · ⌘K
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="grid size-9 place-items-center border border-input bg-black/60 text-highlight transition-colors hover:border-highlight"
                aria-label={llm.label}
              >
                <LlmIcon size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end">
              {llm.label}
              {llm.provider ? ` · ${llm.provider}` : ""}
            </TooltipContent>
          </Tooltip>
          </div>
        </div>
      </div>

      <EvidenceDialog open={evidenceOpen} onOpenChange={setEvidenceOpen} />
    </header>
  );
}

const LED_COLOR: Record<HealthState, string> = {
  healthy: "var(--medbay-healthy)",
  risk: "var(--medbay-risk)",
  critical: "var(--medbay-critical)",
};

/** Subject health indicator — pulses while the subject is in critical state. */
function StatusLed({ health }: { health: HealthState }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="relative grid size-9 place-items-center border border-input bg-black/60"
          aria-label={`Subject status: ${HEALTH_LABEL[health]}`}
        >
          <span
            className={cn("block size-2 rounded-full", health === "critical" && "animate-pulse")}
            style={{ background: LED_COLOR[health], boxShadow: `0 0 8px ${LED_COLOR[health]}` }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">Subject status: {HEALTH_LABEL[health]}</TooltipContent>
    </Tooltip>
  );
}

function NavItem({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) {
  return (
    <DropdownMenuItem asChild>
      <Link href={href}>
        <Icon /> {label}
      </Link>
    </DropdownMenuItem>
  );
}

function ViewToggle({
  technical,
  isMedic,
  onToggle,
}: {
  technical: boolean;
  isMedic: boolean;
  onToggle: () => void;
}) {
  const title = technical ? "Technical view" : "Astronaut view";
  const action = technical ? "I'm not a professional" : "I'm a medical professional";
  const tip = !isMedic
    ? "Technical view is only for medical professionals appointed by other medical professionals."
    : technical
      ? "Return to the simple astronaut view. You can switch back at any time."
      : "Enter the technical view with more specifications (extra vitals, crew list, protocol DB). You can switch back at any time.";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={isMedic ? onToggle : undefined}
          aria-disabled={!isMedic}
          className="group hidden shrink-0 flex-col items-center gap-1.5 border border-input bg-black/60 px-4 py-2 text-center transition-colors hover:border-highlight md:flex"
        >
          <span className="medbay-display text-[15px] leading-none transition-colors group-hover:text-highlight">
            {title}
          </span>
          <span className="medbay-micro flex items-center gap-1.5 text-[9px] text-foreground/60 transition-colors group-hover:text-highlight">
            <span
              className={cn("block size-1.5 rounded-full", technical ? "bg-highlight" : "bg-foreground/40")}
              aria-hidden
            />
            {action}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tip}</TooltipContent>
    </Tooltip>
  );
}
