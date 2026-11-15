"use client";

/**
 * Pulse Orb — default Visual AI Model. A shaded sphere with layered
 * Siri-style sine waves; amplitude follows the live TTS signal, colour and
 * motion follow the emotion.
 */

import { useCallback, useRef } from "react";

import type { MascotEmotion } from "@/data/mascots";
import { useMascotLoop } from "./useMascotLoop";

const PARAMS: Record<MascotEmotion, { amp: number; speed: number; freq: number; tint?: string; sag: number }> = {
  happy: { amp: 0.34, speed: 1.5, freq: 1.6, sag: 0 },
  serious: { amp: 0.14, speed: 0.7, freq: 1.2, sag: 0 },
  thinking: { amp: 0.22, speed: 2.4, freq: 2.6, sag: 0 },
  angry: { amp: 0.5, speed: 3.2, freq: 3.4, tint: "#ff2a2a", sag: 0 },
  sad: { amp: 0.12, speed: 0.45, freq: 0.9, tint: "#5b7cff", sag: 0.14 },
};

function readColor(el: HTMLElement | null, fallback: string) {
  if (!el) return fallback;
  const v = getComputedStyle(el).color;
  return v || fallback;
}

export function OrbSkin({ emotion, size }: { emotion: MascotEmotion; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef<{ at: number; c: string }>({ at: -1, c: "#9f00e0" });

  const draw = useCallback(
    (t: number, level: number) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const px = Math.round(size * dpr);
      if (cv.width !== px) {
        cv.width = px;
        cv.height = px;
      }
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const p = PARAMS[emotion];
      if (t - colorRef.current.at > 1 || colorRef.current.at < 0) {
        colorRef.current = { at: t, c: readColor(cv, "#9f00e0") };
      }
      const base = p.tint ?? colorRef.current.c;
      const W = px;
      const R = W * 0.4;
      const cx = W / 2;
      const cy = W / 2;
      ctx.clearRect(0, 0, W, W);

      // contact shadow — grounds the orb
      ctx.save();
      ctx.translate(cx, cy + R * 1.18);
      ctx.scale(1, 0.22);
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
      shadow.addColorStop(0, "rgba(0,0,0,0.75)");
      shadow.addColorStop(1, "transparent");
      ctx.fillStyle = shadow;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();

      // breathing halo + slow chromatic rim pulse
      const breathe = 1 + Math.sin(t * 1.2) * 0.03 + level * 0.15;
      const halo = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.35 * breathe);
      halo.addColorStop(0, base);
      halo.addColorStop(0.55, "rgba(120,60,255,0.25)");
      halo.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.22 + level * 0.4;
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, W);
      ctx.globalAlpha = 1;

      // orbit ring with two travelling particles
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.36);
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.24, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
      for (const s of [0.6, 1.6]) {
        const a = t * s + (s * 10) % (Math.PI * 2);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 1.24, Math.sin(a) * R * 1.24, 2.2 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
      }
      ctx.restore();

      // sphere body — deep glass shading
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.42, R * 0.04, cx, cy, R);
      body.addColorStop(0, "rgba(255,255,255,0.75)");
      body.addColorStop(0.3, base);
      body.addColorStop(0.85, "#050208");
      body.addColorStop(1, "#000");
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();

      // inner core luminosity behind the waves
      const core = ctx.createRadialGradient(cx, cy + p.sag * R, 0, cx, cy + p.sag * R, R * 0.75);
      core.addColorStop(0, "rgba(255,255,255,0.30)");
      core.addColorStop(0.5, base);
      core.addColorStop(1, "transparent");
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = 0.25 + level * 0.3;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, W, W);
      ctx.restore();

      // waves, clipped to the sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      const amp = (p.amp + level * 0.55) * R;
      const layers = [
        { k: 1, ph: 0, a: 1, w: 2.4 },
        { k: 1.7, ph: 2.1, a: 0.65, w: 1.6 },
        { k: 2.6, ph: 4.2, a: 0.4, w: 1.1 },
      ];
      for (const L of layers) {
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = -1 + (2 * i) / 80;
          const env = Math.pow(1 - x * x, 2); // pinch at the edges like Siri
          const s =
            emotion === "angry"
              ? Math.abs(Math.sin(x * p.freq * L.k * Math.PI + t * p.speed + L.ph)) * 2 - 1
              : Math.sin(x * p.freq * L.k * Math.PI + t * p.speed + L.ph);
          const y = cy + p.sag * R + s * amp * L.a * env;
          const X = cx + x * R;
          if (i === 0) ctx.moveTo(X, y);
          else ctx.lineTo(X, y);
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.5 * L.a})`;
        ctx.lineWidth = L.w * dpr;
        ctx.stroke();
      }
      // thinking: orbiting glints
      if (emotion === "thinking") {
        for (let i = 0; i < 3; i++) {
          const a = t * 2 + (i * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.25, 3 * dpr, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.fill();
        }
      }
      ctx.restore();

      // specular highlight — product-render shine, upper-left
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      const spec = ctx.createRadialGradient(
        cx - R * 0.38, cy - R * 0.45, 0,
        cx - R * 0.38, cy - R * 0.45, R * 0.42,
      );
      spec.addColorStop(0, "rgba(255,255,255,0.5)");
      spec.addColorStop(0.6, "rgba(255,255,255,0.08)");
      spec.addColorStop(1, "transparent");
      ctx.fillStyle = spec;
      ctx.fillRect(0, 0, W, W);
      // crescent lens arc on the lit side
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.86, -2.2, -0.6);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.6 * dpr;
      ctx.stroke();
      ctx.restore();

      // rim — bright edge + faint outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R + 3 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
    },
    [emotion, size],
  );

  useMascotLoop(draw);

  return (
    <canvas
      ref={canvasRef}
      className="text-state"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Pulse Orb, ${emotion}`}
    />
  );
}
