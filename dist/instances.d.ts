import type { Mesh, Vec3 } from './types.js';
export interface Prototype {
    lods: Mesh[];
}
export interface Placement {
    at: Vec3;
    /** Size of the instance; a record scales each slot on its own ('*' is the default), e.g. a star core and its halo. */
    scale: number | Record<string, number>;
    /** Slot -> palette name. */
    mats?: Record<string, string>;
    /** Turn of the instance about its own centre: [tilt about x, turn about y] in radians (a galaxy disc seen from any side). */
    rot?: [number, number];
    /** Colour of every face (a tint on top of the material). */
    color?: string;
}
/** A copy of the prototype mesh, scaled, moved and given its materials. Slots must not share vertices when scaled apart. */
export declare const instantiate: (proto: Mesh, p: Placement) => Mesh;
/** Which level of detail to draw for something that is `px` pixels across (its radius); `limits` are the pixel sizes where the next finer level starts. */
export declare const lodLevel: (px: number, levels: number, limits?: readonly number[]) => number;
