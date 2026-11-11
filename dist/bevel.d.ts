import type { Mesh } from './types.js';
export interface BevelResult {
    mesh: Mesh;
    /** old point index -> new point index (points that no longer exist are missing). */
    remap: Map<number, number>;
    /** The width actually used: it is held back where the faces are too small for the asked one. */
    width: number;
    /** Number of lines beveled. */
    lines: number;
}
export declare const bevel: (mesh: Mesh, lines: [number, number][], width: number, segments?: number) => BevelResult;
