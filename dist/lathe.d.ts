import type { Mesh, Vec3 } from './types.js';
export interface LatheFrame {
    /** A point of the axis. */
    origin: Vec3;
    /** The axis direction, the direction of r = 1 in the plane, and the plane's normal (right × up = normal). */
    right: Vec3;
    up: Vec3;
    normal: Vec3;
}
export declare const lathe: (contour: [number, number][], frame: LatheFrame, segments?: number, { mat, color }?: {
    mat?: string;
    color?: string;
}) => Mesh;
