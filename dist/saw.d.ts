import type { Mesh, Vec3 } from './types.js';
/** A plane: a point on it and the unit normal. `front` is the side the normal points to. */
export interface CutPlane {
    point: Vec3;
    n: Vec3;
}
export interface Sawn {
    /** Closed pieces on the normal's side of the plane. */
    front: Mesh[];
    /** Closed pieces on the other side. */
    back: Mesh[];
}
/**
 * The plane a drawn line gives: it contains the line and stands square on the face the line was drawn on
 * (`faceNormal`), so it runs straight into the material and out beyond the ends of the line.
 */
export declare const planeThroughLine: (a: Vec3, b: Vec3, faceNormal: Vec3) => CutPlane;
/** The plane through three points. Throws when they lie on one line. */
export declare const planeThroughTriangle: (a: Vec3, b: Vec3, c: Vec3) => CutPlane;
/**
 * Saw `mesh` along `plane`. `mat` / `color` is the material of the two new faces (the cut surface).
 * Throws when the mesh is not a closed solid, or when the plane does not go through it.
 */
export declare const saw: (mesh: Mesh, plane: CutPlane, opts?: {
    color?: string;
    mat?: string;
}) => Sawn;
/** Where the plane meets the faces of the mesh: line segments for the preview of a cut. */
export declare const sectionSegments: (mesh: Mesh, plane: CutPlane) => [Vec3, Vec3][];
