import type { Mesh } from './types.js';
export type BooleanOp = 'union' | 'subtract' | 'intersect';
/**
 * Boolean of two closed solids (outward CCW faces): 'union', 'subtract' (a minus b) or 'intersect'.
 * Throws with a reason when an input is open or inside out.
 */
export declare const boolean: (a: Mesh, b: Mesh, op: BooleanOp) => Mesh;
export declare const union: (a: Mesh, b: Mesh) => Mesh;
export declare const subtract: (a: Mesh, b: Mesh) => Mesh;
export declare const intersect: (a: Mesh, b: Mesh) => Mesh;
