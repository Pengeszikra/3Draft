import type { Mesh } from './types.js';
export interface Validation {
    vertices: number;
    faces: number;
    /** Every edge is shared by two faces, wound consistently. */
    closed: boolean;
    openEdges: number;
    /** Signed volume; null unless closed. */
    volume: number | null;
    /** Closed, but the faces point inward. */
    inside_out: boolean;
    degenerateFaces: number[];
    nonPlanarFaces: number[];
    nonConvexFaces: number[];
    ok: boolean;
    /** Plain-text findings. */
    notes: string[];
}
/**
 * { vertices, faces, closed, openEdges, volume, inside_out, degenerateFaces,
 *   nonPlanarFaces, nonConvexFaces, ok, notes }
 * `volume` and `inside_out` only mean something for a closed mesh.
 */
export declare const validate: (mesh: Mesh) => Validation;
