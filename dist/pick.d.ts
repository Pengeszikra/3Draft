import type { Camera, Hit, Mesh, Vec3 } from './types.js';
/**
 * The nearest surface under panel pixel (x, y), or null.
 * { face, distance, point, normal, front, color }
 * `normal` is a unit vector facing the camera; `front` tells whether the face
 * itself faces the camera (always true while `cull` is on). Faces are assumed
 * convex and planar.
 */
export declare const pick: (mesh: Mesh, cam: Camera, x: number, y: number, { cull }?: {
    cull?: boolean;
}) => Hit | null;
/**
 * A target cross lying flat on the picked surface (perpendicular to its
 * normal): four arms with a gap in the middle and a ring, as 3D polylines.
 * It is aligned to the first edge of the face, so it turns with the object.
 * `radius` is the ring radius in world units.
 */
export declare const crosshair: (mesh: Mesh, hit: Hit, radius?: number) => Vec3[][];
