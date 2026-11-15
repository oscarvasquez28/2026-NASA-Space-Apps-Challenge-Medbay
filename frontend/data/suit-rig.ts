/**
 * EVA-suit skeleton rig (model-local, metres, floor at y = 0, model faces
 * +z so patient-left is +x). Shared by the suit geometry and the organ
 * atlas so internal anatomy (biceps, forearm skin sample, femurs) always
 * sits inside the limb shells that wrap it.
 */

import type { Vec3 } from "@/types/health";

export type Side = 1 | -1;

/** Shoulder bearing centre — arms hang from here along their local −y. */
export const SHOULDER: Vec3 = [0.2, 1.31, 0];
/** Arm abduction (rad): hands swing slightly out from the hips. */
export const ARM_ABDUCTION = 0.15;
/** Hip joint lateral offset — legs are built around x = ±HIP_X. */
export const HIP_X = 0.095;

/** Arm part transform (position + rotation) for a side. */
export function armTransform(side: Side): { position: Vec3; rotation: Vec3 } {
  return {
    position: [side * SHOULDER[0], SHOULDER[1], SHOULDER[2]],
    rotation: [0, 0, side * ARM_ABDUCTION],
  };
}

/** Arm-local point (y down the limb, z forward) → model-local position. */
export function armPoint(side: Side, y: number, z = 0): Vec3 {
  const a = side * ARM_ABDUCTION;
  return [
    side * SHOULDER[0] - y * Math.sin(a),
    SHOULDER[1] + y * Math.cos(a),
    SHOULDER[2] + z,
  ];
}
