/**
 * Retro Tele-Bot — COMMON prize (design/AI_Model.jpeg, bottom row).
 * Hand-drawn CRT with knobs and an antenna that changes with the feeling.
 * Per the sheet: no animation, the face image simply switches.
 * Polished: cabinet sheen, phosphor glow, scanlines, vents and standby LED.
 */

import { useId, type ReactNode } from "react";

import type { MascotEmotion } from "@/data/mascots";

const ANTENNA: Record<MascotEmotion, ReactNode> = {
  happy: (
    <>
      <path d="M92 52 L80 18" />
      <circle cx="79" cy="14" r="5" fill="currentColor" />
      <path d="M106 52 C110 34 124 40 120 26 C118 18 128 16 130 22" />
      <circle cx="132" cy="22" r="5" />
    </>
  ),
  serious: (
    <>
      <path d="M92 52 L84 14" />
      <circle cx="83" cy="10" r="5" fill="currentColor" />
      <path d="M106 52 L114 14" />
      <circle cx="115" cy="10" r="5" fill="currentColor" />
    </>
  ),
  thinking: (
    <>
      <path d="M99 52 L99 24" />
      <path d="M86 22 Q99 12 112 22" />
      <path d="M80 14 Q99 0 118 14" />
      <circle cx="128" cy="24" r="4" />
    </>
  ),
  angry: (
    <path d="M76 52 L80 28 L88 38 L94 18 L100 34 L108 16 L112 36 L120 26 L122 52" fill="none" />
  ),
  sad: (
    <>
      <path d="M92 52 C82 30 66 32 62 46" />
      <circle cx="61" cy="50" r="5" fill="currentColor" />
      <path d="M106 52 C116 30 132 32 136 46" />
      <circle cx="137" cy="50" r="5" fill="currentColor" />
    </>
  ),
};

const FACE: Record<MascotEmotion, ReactNode> = {
  happy: (
    <>
      <circle cx="68" cy="108" r="5" fill="currentColor" />
      <circle cx="118" cy="108" r="5" fill="currentColor" />
      <path d="M84 116 Q89 124 93 116 Q97 124 102 116" />
    </>
  ),
  serious: (
    <>
      <circle cx="68" cy="108" r="5" fill="currentColor" />
      <circle cx="118" cy="108" r="5" fill="currentColor" />
      <path d="M86 112 L100 112" />
    </>
  ),
  thinking: (
    <>
      <circle cx="74" cy="110" r="5" fill="currentColor" />
      <circle cx="93" cy="110" r="5" fill="currentColor" />
      <circle cx="112" cy="110" r="5" fill="currentColor" />
    </>
  ),
  angry: (
    <>
      <path d="M58 96 L78 104" />
      <path d="M128 96 L108 104" />
      <circle cx="70" cy="110" r="4" fill="currentColor" />
      <circle cx="116" cy="110" r="4" fill="currentColor" />
      <path d="M93 116 L85 132 L101 132 Z" />
      <path d="M93 121 L93 126" />
    </>
  ),
  sad: (
    <>
      <path d="M60 102 Q60 116 68 116 Q76 116 76 102" />
      <path d="M110 102 Q110 116 118 116 Q126 116 126 102" />
      <path d="M86 122 Q93 112 100 122" />
    </>
  ),
};

export function TvBotSkin({ emotion, size }: { emotion: MascotEmotion; size: number }) {
  const uid = useId();
  const scan = `${uid}-scan`;
  const glow = `${uid}-glow`;
  const sheen = `${uid}-sheen`;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`Retro Tele-Bot, ${emotion}`}
    >
      <defs>
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={glow} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.30" />
          <stop offset="0.7" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
        <pattern id={scan} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="1.4" fill="#fff" opacity="0.10" />
        </pattern>
      </defs>

      {/* floor shadow */}
      <ellipse cx="100" cy="192" rx="62" ry="8" fill="#000" opacity="0.6" stroke="none" />

      {ANTENNA[emotion]}
      {/* antenna mount */}
      <path d="M84 60 Q99 46 114 60" />
      <path d="M88 56 L110 56" strokeWidth={2} />

      {/* cabinet */}
      <rect x="22" y="60" width="164" height="114" rx="22" fill="#0a0d14" />
      <rect x="22" y="60" width="164" height="114" rx="22" fill={`url(#${sheen})`} stroke="none" />
      <path d="M36 174 L40 184 M168 174 L164 184" />
      {/* side vents */}
      <g strokeWidth={2.5} opacity={0.55}>
        <path d="M30 140 L30 156" />
        <path d="M36 140 L36 156" />
        <path d="M42 140 L42 156" />
      </g>

      {/* screen — phosphor glow + scanlines */}
      <rect x="38" y="76" width="112" height="82" rx="18" fill="#000" />
      <rect x="38" y="76" width="112" height="82" rx="18" fill={`url(#${glow})`} stroke="none" />
      <rect x="38" y="76" width="112" height="82" rx="18" fill={`url(#${scan})`} stroke="none" opacity={0.6} />
      <rect x="38" y="76" width="112" height="82" rx="18" />
      {/* glass reflection */}
      <path d="M46 84 Q60 78 84 78 L60 100 Q48 106 46 104 Z" fill="#fff" opacity={0.10} stroke="none" />

      {/* knobs */}
      <circle cx="168" cy="98" r="9" />
      <path d="M168 93 L168 98 L173 101" strokeWidth={2.5} />
      <circle cx="168" cy="126" r="9" />
      <path d="M164 122 L172 130" strokeWidth={2.5} />
      {/* standby LED */}
      <circle cx="168" cy="152" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="168" cy="152" r="6" strokeWidth={1.5} opacity={0.5} />

      <g className="text-state" stroke="currentColor">{FACE[emotion]}</g>
    </svg>
  );
}
