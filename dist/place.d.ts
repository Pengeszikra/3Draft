import type { Axes, Hit, Mesh, Vec3 } from './types.js';
export interface StandOptions {
    /** Square base edge (default 0.15). */
    base?: number;
    /** Height (default 3 x base). */
    height?: number;
    color?: string;
}
/** Where and how an instanced renderer draws the prism. */
export interface Frame {
    size: Vec3;
    at: Vec3;
    axes: Axes;
}
/**
 * A square prism standing on the picked surface: its base lies on the surface,
 * centered at the hit point, and it rises along the surface normal. Its sides
 * line up with the first edge of the face. The height is `3 * base` unless given.
 * Returns a new mesh; merge() it into the scene.
 */
export declare const standOn: (mesh: Mesh, hit: Hit, { base, height, color }?: StandOptions) => Mesh & {
    frame: Frame;
};
