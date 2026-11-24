import type { Mesh, Vec3 } from './types.js';
/**
 * Extrude a face: it is replaced (same index) by a copy moved `distance` along its
 * normal and scaled by `scale` about its center, and one quad per edge joins the two.
 *   distance > 0, scale 1      a prism out of the face
 *   distance > 0, scale < 1    a taper (roof, spire, frustum)
 *   distance 0,   scale < 1    an inset (a panel, a window frame)
 *   distance < 0               a dent into the solid (a niche, a door recess)
 * The new quads are appended after the existing faces. Their surface (and the cap's): `mat`, a palette material;
 * else `color`, a plain colour (no material); else the face's own material and colour.
 * Returns { mesh, cap, sides } with the index of the cap face and the new quad indices.
 */
export declare const extrudeFace: (mesh: Mesh, index: number, { distance, scale, color, mat }?: {
    distance?: number;
    scale?: number;
    color?: string;
    mat?: string;
}) => {
    mesh: Mesh;
    cap: number;
    sides: number[];
};
/** Move the vertices at `indices` by `delta` [dx, dy, dz]. Faces keep their vertices, so faces may stop being planar: check with validate(). */
export declare const moveVertices: (mesh: Mesh, indices: number[], delta: Vec3) => Mesh;
