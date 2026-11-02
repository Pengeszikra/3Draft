import type { Vec3 } from './types.js';
export interface ScreenPoint {
    x: number;
    y: number;
}
/** One projected face: see paintOrder(). */
export interface PaintItem {
    i: number;
    world: Vec3[];
    screen: ScreenPoint[];
    n: Vec3;
    p: Vec3;
    eye: 1 | -1;
    depth: number;
}
/**
 * Items need: { i, world, screen, n, p, eye, depth }
 *   world  face points in world space      screen  the same, projected { x, y }
 *   n, p   unit normal and a point on it   eye     +1 if the face faces the camera, else -1
 *   depth  mean depth, used for ties       i       face index, used for ties
 */
export declare const paintOrder: <T extends PaintItem>(items: T[]) => T[];
