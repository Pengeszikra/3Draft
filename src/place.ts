// Putting things down on surfaces.

import { cross, norm, plus, minus, times } from './vec.js';
import { box } from './mesh.js';
import type { Axes, Hit, Mesh, Vec3 } from './types.js';

export interface StandOptions {
  /** Square base edge (default 0.15). */
  base?: number;
  /** Height (default 3 x base). */
  height?: number;
  color?: string;
}

/** Where and how an instanced renderer draws the prism. */
export interface Frame {
  size: Vec3;
  at: Vec3;
  axes: Axes;
}

/**
 * A square prism standing on the picked surface: its base lies on the surface,
 * centered at the hit point, and it rises along the surface normal. Its sides
 * line up with the first edge of the face. The height is `3 * base` unless given.
 * Returns a new mesh; merge() it into the scene.
 */
export const standOn = (mesh: Mesh, hit: Hit, { base = 0.15, height = 3 * base, color = '#c8c8c8' }: StandOptions = {}): Mesh & { frame: Frame } => {
  const [a, b] = mesh.faces[hit.face].v;
  const ex = mesh.positions[b] |> minus(mesh.positions[a]) |> norm;
  const ey = hit.normal;
  const ez = cross(ex, ey);
  const frame: Frame = { size: [base, height, base], at: ey |> times(height / 2) |> plus(hit.point), axes: [ex, ey, ez] };
  return { ...box({ ...frame, color }), frame }; // frame: what an instanced renderer needs
};
