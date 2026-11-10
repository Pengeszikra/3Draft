import type { Vec3 } from './types.js';
export type Tri = [number, number, number];
/** Indices into `pts`, three per triangle, `pts.length - 2` triangles. */
export declare const triangulate: (pts: Vec3[]) => Tri[];
