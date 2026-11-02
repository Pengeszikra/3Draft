import type { Mesh, Vec3 } from './types.js';
/**
 * Extrude a face: it is replaced (same index) by a copy moved `distance` along its
 * normal and scaled by `scale` about its center, and one quad per edge joins the two.
 *   distance > 0, scale 1      a prism out of the face
 *   distance > 0, scale < 1    a taper (roof, spire, frustum)
 *   distance 0,   scale < 1    an inset (a panel, a window frame)
 *   distance < 0               a dent into the solid (a niche, a door recess)
 * The new quads are appended after the existing faces; `color` recolors the cap and
 * the quads, otherwise they keep the face color.
 * Returns { mesh, cap, sides } with the index of the cap face and the new quad indices.
 */
export declare const extrudeFace: (mesh: Mesh, index: number, { distance, scale, color }?: {
    distance?: number;
    scale?: number;
    color?: string;
}) => {
    mesh: Mesh;
    cap: number;
    sides: number[];
};
/** Move the vertices at `indices` by `delta` [dx, dy, dz]. Faces keep their vertices, so faces may stop being planar: check with validate(). */
export declare const moveVertices: (mesh: Mesh, indices: number[], delta: Vec3) => Mesh;
