import type { Camera, Fit, Mesh, Vec3, ViewName, ViewSpec } from './types.js';
export declare const VIEW_ORDER: readonly ViewName[];
/**
 * `fit` = { center, radius, dist? } overrides the target and framing (perspective views only use `dist`). Use it when the
 * mesh moves (e.g. rotates) so the camera keeps looking at the same spot.
 */
export declare const makeCamera: (view: ViewName | ViewSpec, mesh: Mesh, size: number, fit?: Fit) => Camera;
/**
 * Turntable rotation as a camera: the view you get from rotate(mesh, { yaw, pitch })
 * with a fixed camera, but the mesh stays where it is. Picks and marks are then
 * in object space.
 */
export declare const orbit: ({ yaw, pitch, ortho, name }?: {
    yaw?: number;
    pitch?: number;
    ortho?: boolean;
    name?: string;
}) => ViewSpec;
/** Ray through panel pixel (x, y), the inverse of project(): { origin, dir } in world space, dir is a unit vector. */
export declare const ray: (cam: Camera, x: number, y: number) => {
    origin: Vec3;
    dir: Vec3;
};
/** World point -> { x, y } in panel pixels (y down) and depth along the view direction. */
export declare const project: (cam: Camera, p: Vec3) => {
    x: number;
    y: number;
    depth: number;
};
