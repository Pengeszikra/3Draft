// Materials are data. A palette is a plain object { name: Material }; a face points at an entry by name
// (`face.mat`) and keeps its own `color` as a fallback, so a mesh still looks right without the palette.
// One shader draws all of them; the numbers below are the only knobs.

import type { Face } from './types.js';

export interface Material {
  /** #rrggbb. */
  color: string;
  /** 0 = paint, 1 = metal (reflects the sky and the ground, tinted by the color). */
  metal?: number;
  /** 0 = mirror-like, 1 = matte; widens the highlight. */
  rough?: number;
  /** 1 = solid, 0 = invisible. Drawn with alpha-to-coverage: one pass, no sorting. */
  alpha?: number;
  /** 0..5: how much the color glows on its own, unlit. Up to 1 it fades from lit to flat colour; above 1 (WebGPU `tonemap`) it is a light source: that many times brighter. */
  emit?: number;
}
export type Palette = Record<string, Material>;

/** What a face is made of, all numbers filled in. */
export interface Surface {
  color: string;
  metal: number;
  rough: number;
  alpha: number;
  emit: number;
}

const clamp = (n: unknown, fallback: number, max = 1): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : fallback);
export const EMIT_MAX = 5;

export const FALLBACK_COLOR = '#c8c8c8';
export const DEFAULTS = { metal: 0, rough: 0.7, alpha: 1, emit: 0 } as const;

/** The surface of a face: its palette entry when it names one, else just its color with default properties. */
export const surfaceOf = (face: Pick<Face, 'color' | 'mat'>, palette?: Palette): Surface => {
  const m = face.mat !== undefined ? palette?.[face.mat] : undefined;
  return {
    color: m?.color ?? face.color ?? FALLBACK_COLOR,
    metal: clamp(m?.metal, DEFAULTS.metal),
    rough: clamp(m?.rough, DEFAULTS.rough),
    alpha: clamp(m?.alpha, DEFAULTS.alpha),
    emit: clamp(m?.emit, DEFAULTS.emit, EMIT_MAX),
  };
};
