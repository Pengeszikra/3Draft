import type { Mesh, Vec3, Face } from './types.js';
/** Lines drawn on / off a mesh: pairs of vertex indices. */
export type Wire = [number, number][];
/**
 * Puts a vertex at `point`, which lies on face `face`. On an existing vertex it returns that one; on an edge it is
 * added to both faces that share the edge (no crack); inside the face it splits the face into triangles around it.
 * { mesh, index }
 */
export declare const insertVertex: (mesh: Mesh, face: number, point: Vec3) => {
    mesh: Mesh;
    index: number;
};
/**
 * Cuts the face that holds vertices `a` and `b` (not next to each other) along the line a-b: two convex faces.
 * `cut` is false when no face holds both, or they are already neighbours on every face.
 */
export declare const cutFace: (mesh: Mesh, a: number, b: number) => {
    mesh: Mesh;
    cut: boolean;
};
/** Moves vertex `i` to `to`. Polygons that use it become triangles, so every face stays planar. */
export declare const moveVertex: (mesh: Mesh, i: number, to: Vec3) => Mesh;
/**
 * A face from a closed loop of vertices. It is wound to point away from `awayFrom` (default: the middle of the
 * mesh), which is what a patch closing a gap in a surface wants; 4 or more vertices become a fan of triangles.
 */
export declare const fillLoop: (mesh: Mesh, loop: number[], face?: Partial<Face>, awayFrom?: Vec3) => Mesh;
/** Adds the line a-b (not twice, not a point). */
export declare const addLine: (wire: Wire, a: number, b: number) => Wire;
/**
 * The shortest closed loop of lines through line [a, b], at most `max` vertices: [a, ..., b], or null.
 * Close it with fillLoop.
 */
export declare const findLoop: (wire: Wire, [a, b]: [number, number], max?: number) => number[] | null;
/**
 * The surface point of the mesh nearest to `p`, if it is within `tolerance`: { face, point } (point lies on the face),
 * otherwise null. For placing a point that was drawn near a surface on the surface.
 */
export declare const nearestSurface: (mesh: Mesh, p: Vec3, tolerance: number) => {
    face: number;
    point: Vec3;
} | null;
/**
 * Turns line segments (pairs of points) into wire on the mesh: each end becomes a vertex (an existing one within
 * `tolerance`, a new one on the surface when it is near it, otherwise a free point in the air), each segment a line,
 * and two ends on one face cut that face. Returns the new mesh and wire.
 */
export declare const wireFromSegments: (mesh: Mesh, wire: Wire, segments: [Vec3, Vec3][], tolerance: number) => {
    mesh: Mesh;
    wire: Wire;
};
/**
 * Moves several vertices at once: `moves` is [[index, newPosition], ...]. A polygon whose vertices all moved by the
 * same step (a face dragged as a whole) stays as it is; any other polygon that uses a moved vertex becomes triangles,
 * so every face stays planar.
 */
export declare const moveVertexSet: (mesh: Mesh, moves: [number, Vec3][]) => Mesh;
/**
 * Moves vertices like `moveVertexSet`, but a polygon stays one polygon whenever the move leaves it flat (and facing the
 * same way): a whole face dragged, scaled or stretched, the side of an extrusion. Only a polygon that the move would bend
 * (or flip, or collapse) becomes triangles. This is what the grab / scale / extrude of the editor use.
 */
export declare const reshape: (mesh: Mesh, moves: [number, Vec3][]) => Mesh;
