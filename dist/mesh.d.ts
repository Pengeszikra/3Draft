import type { Axes, Mesh, Vec3 } from './types.js';
export interface BoxOptions {
    size?: Vec3;
    at?: Vec3;
    color?: string;
    /** Orthonormal local x/y/z axes (default: the world axes). */
    axes?: Axes;
}
/** Box: 8 points, 12 edges, 6 quad faces. Axis-aligned unless `axes` turns it. */
export declare const box: ({ size, at, color, axes }?: BoxOptions) => Mesh;
/** Concatenate meshes into one, re-indexing the faces. */
export declare const merge: (...meshes: Mesh[]) => Mesh;
/** Bounding box center and bounding sphere radius around that center. */
export declare const bounds: (mesh: Mesh) => {
    center: Vec3;
    radius: number;
};
/**
 * Turntable rotation: yaw around Y first, then pitch around X (radians),
 * both around `center` (default: bounding-box center). Faces are shared.
 */
export declare const rotate: (mesh: Mesh, { yaw, pitch }?: {
    yaw?: number;
    pitch?: number;
}, center?: Vec3) => Mesh;
/** Face normal (not normalized) by Newell's method; points CCW => outward. */
export declare const faceNormal: (pts: Vec3[]) => Vec3;
/** Mean of the face points. */
export declare const faceCenter: (pts: Vec3[]) => Vec3;
/**
 * Prism from a convex footprint: `polygon` is [[x, z], ...] on the ground plane (any
 * winding), it is extruded up from `y` by `height`. Faces: top, bottom, then one
 * quad per footprint edge, all CCW from outside.
 */
export declare const extrude: ({ polygon, height, y, color }: {
    polygon: [number, number][];
    height?: number;
    y?: number;
    color?: string;
}) => Mesh;
