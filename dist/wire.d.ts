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
