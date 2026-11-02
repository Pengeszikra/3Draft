// Tiny vec3 helpers on plain [x, y, z] arrays.
// The curried ones (plus, minus, times) are made for pipelines: `b |> minus(a) |> norm`.

import type { Vec3 } from './types.js';

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l ? scale(a, 1 / l) : [0, 0, 0];
};

/** `a |> plus(b)` is a + b. */
export const plus = (b: Vec3) => (a: Vec3): Vec3 => add(a, b);
/** `a |> minus(b)` is a - b. */
export const minus = (b: Vec3) => (a: Vec3): Vec3 => sub(a, b);
/** `a |> times(s)` is a * s. */
export const times = (s: number) => (a: Vec3): Vec3 => scale(a, s);
