/**
 * Cap'n Comet — MYTHIC prize. An ORIGINAL 1930s rubber-hose style
 * spacefarer (fishbowl helmet, pie-cut eyes, bulb nose, comet tuft) inspired
 * by the "brand partnering / steamboat whistling" row of design/AI_Model.jpeg
 * without reproducing any third-party character. Thinking = whistling notes.
 * Polished: glass helmet dome with reflection + rivets, stars, inking tones.
 */

import { useId, type ReactNode } from "react";

import type { MascotEmotion } from "@/data/mascots";

function PieEye({ cx, cy, look = 0, lid = 0 }: { cx: number; cy: number; look?: number; lid?: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={10} ry={16} fill="#fff" stroke="none" />
      <ellipse cx={cx + look} cy={cy + 3} rx={6} ry={10} fill="#000" stroke="none" />
      {/* classic pie-cut wedge */}
      <path d={`M${cx + look} ${cy + 3} L${cx + look + 4} ${cy - 6} L${cx + look + 7} ${cy - 1} Z`} fill="#fff" stroke="none" />
      {lid > 0 && <rect x={cx - 11} y={cy - 17} width={22} height={lid} fill="#000" stroke="none" />}
    </g>
  );
}

const EXPR: Record<MascotEmotion, ReactNode> = {
  happy: (
    <>
      <PieEye cx={84} cy={94} look={1} />
      <PieEye cx={116} cy={94} look={1} />
      <path d="M64 126 Q100 168 136 126 Q100 140 64 126 Z" fill="#000" />
      <path d="M88 146 Q100 154 112 146" stroke="#ff6b8b" strokeWidth={5} />
    </>
  ),
  serious: (
    <>
      <path d="M72 72 L94 76" />
      <path d="M106 70 L128 64" />
      <PieEye cx={84} cy={94} lid={6} />
      <PieEye cx={116} cy={94} lid={4} />
      <path d="M80 140 L120 138" />
    </>
  ),
  thinking: (
    <>
      <PieEye cx={84} cy={92} look={3} lid={3} />
      <PieEye cx={116} cy={92} look={3} lid={3} />
      <ellipse cx={108} cy={140} rx={7} ry={6} fill="#000" />
      <g className="mascot-notes" strokeWidth={2.5}>
        <path d="M150 116 L150 96 L162 92 L162 112" />
        <ellipse cx="146" cy="117" rx="5" ry="4" fill="currentColor" />
        <ellipse cx="158" cy="113" rx="5" ry="4" fill="currentColor" />
        <path d="M172 84 L172 68" />
        <ellipse cx="168" cy="85" rx="5" ry="4" fill="currentColor" />
      </g>
    </>
  ),
  angry: (
    <>
      <path d="M68 74 L96 86" strokeWidth={5} />
      <path d="M132 74 L104 86" strokeWidth={5} />
      <PieEye cx={84} cy={98} lid={9} />
      <PieEye cx={116} cy={98} lid={9} />
      <rect x={78} y={134} width={44} height={14} rx={3} fill="#fff" />
      <path d="M89 134 L89 148 M100 134 L100 148 M111 134 L111 148" stroke="#000" strokeWidth={2} />
    </>
  ),
  sad: (
    <>
      <path d="M72 80 L94 72" />
      <path d="M128 80 L106 72" />
      <PieEye cx={84} cy={96} lid={7} />
      <PieEye cx={116} cy={96} lid={7} />
      <path d="M78 146 Q100 128 122 146" />
      <path d="M70 110 Q66 122 70 126 Q74 122 70 110 Z" fill="#7fb3ff" stroke="#7fb3ff" strokeWidth={1.5} />
    </>
  ),
};

const STARS: Array<[number, number, number]> = [
  [42, 70, 1.6], [160, 64, 1.4], [150, 150, 1.8], [56, 156, 1.3], [36, 116, 1.2],
];

export function RubberHoseSkin({ emotion, size }: { emotion: MascotEmotion; size: number }) {
  const uid = useId();
  const glass = `${uid}-glass`;
  const tone = `${uid}-tone`;
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
      aria-label={`Cap'n Comet, ${emotion}`}
    >
      <defs>
        <linearGradient id={glass} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="1" stopColor="#7fb3ff" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id={tone} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* floor shadow */}
      <ellipse cx="100" cy="194" rx="60" ry="7" fill="#000" opacity="0.55" stroke="none" />

      <g className="mascot-bob">
        {/* fishbowl helmet — glass dome, stars, rivets */}
        <circle cx={100} cy={108} r={86} fill="#060a12" stroke="none" />
        <circle cx={100} cy={108} r={86} fill={`url(#${glass})`} stroke="none" />
        {STARS.map(([x, y, r]) => (
          <g key={`${x}-${y}`} stroke="#fff" strokeWidth={1} opacity={0.8}>
            <path d={`M${x - r * 3} ${y} L${x + r * 3} ${y} M${x} ${y - r * 3} L${x} ${y + r * 3}`} />
          </g>
        ))}
        <circle cx={100} cy={108} r={86} className="text-state" stroke="currentColor" strokeWidth={2.5} />
        {/* helmet rim rivets */}
        {[0, 60, 120, 180, 240, 300].map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <circle
              key={deg}
              cx={100 + Math.cos(a) * 86}
              cy={108 + Math.sin(a) * 86}
              r={2.6}
              fill="currentColor"
              className="text-state"
              stroke="none"
            />
          );
        })}
        {/* glass reflection streak */}
        <path d="M40 66 Q52 44 76 34" stroke="#fff" strokeWidth={3.5} opacity={0.75} />
        <path d="M44 80 Q52 60 66 50" stroke="#fff" strokeWidth={1.8} opacity={0.4} />

        {/* comet tuft */}
        <path d="M92 48 Q86 24 104 14 Q98 30 112 26 Q104 38 112 48" fill="currentColor" className="text-state" stroke="currentColor" />

        {/* head — ink + vintage cell shading */}
        <path d="M44 108 C44 62 70 44 100 44 C130 44 156 62 156 108 C156 150 132 176 100 176 C68 176 44 150 44 108 Z" fill="#000" />
        <path d="M44 108 C44 62 70 44 100 44 C130 44 156 62 156 108 C156 150 132 176 100 176 C68 176 44 150 44 108 Z" fill={`url(#${tone})`} stroke="none" />

        {/* cheeks / muzzle */}
        <path d="M58 118 C58 100 76 104 100 104 C124 104 142 100 142 118 C142 150 124 166 100 166 C76 166 58 150 58 118 Z" strokeWidth={2.5} />
        {/* blush dots */}
        <circle cx="66" cy="130" r="2.5" fill="currentColor" stroke="none" opacity={0.5} />
        <circle cx="134" cy="130" r="2.5" fill="currentColor" stroke="none" opacity={0.5} />

        {EXPR[emotion]}

        {/* bulb nose */}
        <ellipse cx={100} cy={118} rx={13} ry={9} fill="currentColor" className="text-state" stroke="#fff" strokeWidth={2} />
        <ellipse cx={96} cy={115} rx="3" ry="2" fill="#fff" stroke="none" />
      </g>
    </svg>
  );
}
