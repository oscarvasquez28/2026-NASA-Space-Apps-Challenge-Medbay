"use client";

/**
 * Waveform Cat — RARE prize (design/AI_Model.jpeg, middle row).
 * Its fur is an audio waveform: two counter-rotating spiky rings around the
 * face are rebuilt every frame from layered sines + the live TTS amplitude.
 * Polished: gradient fur, inner ears, whiskers and a phosphor glow face.
 */

import { useCallback, useId, useRef, type ReactNode } from "react";

import type { MascotEmotion } from "@/data/mascots";
import { useMascotLoop } from "./useMascotLoop";

const CX = 100;
const CY = 112;
const R = 52;
const SPIKES = 72;

const FACE: Record<MascotEmotion, ReactNode> = {
  happy: (
    <>
      <circle cx="82" cy="106" r="4" fill="currentColor" />
      <circle cx="118" cy="106" r="4" fill="currentColor" />
      <path d="M88 122 Q94 130 100 122 Q106 130 112 122" />
    </>
  ),
  serious: (
    <>
      <circle cx="82" cy="106" r="4" fill="currentColor" />
      <circle cx="118" cy="106" r="4" fill="currentColor" />
      <path d="M94 118 L106 128 M106 118 L94 128" />
    </>
  ),
  thinking: (
    <>
      <circle cx="82" cy="106" r="11" />
      <circle cx="82" cy="106" r="3" fill="currentColor" />
      <path d="M72 116 L66 140" strokeWidth={2} />
      <path d="M112 106 Q118 100 124 106" />
      <path d="M96 122 L104 128 L96 132" />
    </>
  ),
  angry: (
    <>
      <path d="M72 96 L90 104" />
      <path d="M128 96 L110 104" />
      <circle cx="84" cy="108" r="3.5" fill="currentColor" />
      <circle cx="116" cy="108" r="3.5" fill="currentColor" />
      <path d="M92 128 L100 122 L108 128" />
    </>
  ),
  sad: (
    <>
      <path d="M72 104 Q82 110 90 102" />
      <path d="M110 102 Q118 110 128 104" />
      <path d="M92 128 Q100 120 108 128" />
      <path d="M100 120 L100 124" strokeWidth={2} />
    </>
  ),
};

const MOOD: Record<MascotEmotion, { amp: number; speed: number }> = {
  happy: { amp: 7, speed: 2 },
  serious: { amp: 3.5, speed: 0.8 },
  thinking: { amp: 5, speed: 3 },
  angry: { amp: 11, speed: 4.5 },
  sad: { amp: 2.5, speed: 0.5 },
};

function furPath(t: number, level: number, emotion: MascotEmotion, radius: number, dir: 1 | -1) {
  const m = MOOD[emotion];
  let d = "";
  for (let i = 0; i <= SPIKES; i++) {
    const a = (i / SPIKES) * Math.PI * 2;
    const wave =
      Math.sin(a * 6 * dir + t * m.speed) * 0.5 +
      Math.sin(a * 11 * dir - t * m.speed * 1.3) * 0.3 +
      Math.sin(a * 17 + t * m.speed * 0.7) * 0.2;
    const spike = i % 2 === 0 ? 1 : 0.35;
    const r = radius + spike * (6 + m.amp * (0.5 + 0.5 * wave) + level * 18 * Math.abs(wave));
    d += `${i === 0 ? "M" : "L"}${(CX + Math.cos(a) * r).toFixed(1)} ${(CY + Math.sin(a) * r).toFixed(1)} `;
  }
  return d + "Z";
}

export function WaveCatSkin({ emotion, size }: { emotion: MascotEmotion; size: number }) {
  const furRef = useRef<SVGPathElement>(null);
  const fur2Ref = useRef<SVGPathElement>(null);
  const uid = useId();
  const glow = `${uid}-glow`;
  const draw = useCallback(
    (t: number, level: number) => {
      furRef.current?.setAttribute("d", furPath(t, level, emotion, R, 1));
      fur2Ref.current?.setAttribute("d", furPath(t * 0.8, level * 0.6, emotion, R - 10, -1));
    },
    [emotion],
  );
  useMascotLoop(draw);

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`Waveform Cat, ${emotion}`}
    >
      <defs>
        <radialGradient id={glow} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="0.75" stopColor="currentColor" stopOpacity="0.08" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* floor shadow */}
      <ellipse cx="100" cy="192" rx="58" ry="8" fill="#000" opacity="0.6" stroke="none" />

      {/* ears — outer stroke + inner detail */}
      <path d="M58 82 L52 30 L92 62" />
      <path d="M142 82 L148 30 L108 62" />
      <path d="M62 72 L58 44 L82 62" strokeWidth={2} opacity={0.6} />
      <path d="M138 72 L142 44 L118 62" strokeWidth={2} opacity={0.6} />

      {/* secondary counter-rotating fur ring */}
      <path
        ref={fur2Ref}
        d={furPath(0, 0, emotion, R - 10, -1)}
        stroke="currentColor"
        strokeWidth={1.8}
        opacity={0.4}
      />
      {/* primary fur ring */}
      <path
        ref={furRef}
        d={furPath(0, 0, emotion, R, 1)}
        className="text-state"
        stroke="currentColor"
        strokeWidth={2.5}
      />

      {/* head — phosphor glow face */}
      <circle cx={CX} cy={CY} r={R - 4} fill={`url(#${glow})`} stroke="none" />
      <circle cx={CX} cy={CY} r={R - 4} stroke="currentColor" strokeWidth={2} />

      {/* whiskers */}
      <g strokeWidth={1.6} opacity={0.7}>
        <path d="M50 118 L34 114" />
        <path d="M50 124 L36 126" />
        <path d="M150 118 L166 114" />
        <path d="M150 124 L164 126" />
      </g>

      <g>{FACE[emotion]}</g>
    </svg>
  );
}
