export type GalaxyKind = 'S' | 'E' | 'I' | 'D';
export interface GalaxyRecipe {
    /** S spiral, E elliptical / lenticular, I irregular, D dwarf spheroidal */
    kind: GalaxyKind;
    /** the sampling seed: the same seed always gives the same galaxy */
    seed: number;
    /** how many points (default by kind: S 1800, E 1400, I 700, D 350) */
    n?: number;
    /** spiral: number of arms (2), pitch angle in degrees (17), share of the disc in the arms (0.6), a bar (0) as a share of the radius */
    arms?: number;
    pitch?: number;
    armShare?: number;
    bar?: number;
    /** elliptical: axis ratios of y and z to x (0.8, 0.9) */
    b?: number;
    c?: number;
    /** irregular: number of star-forming clumps (6) */
    clumps?: number;
}
/** points in the unit frame: positions (3 per point), radii, colours 0xRRGGBB, brightness (1 = normal); in random order */
export interface GalaxyPoints {
    n: number;
    p: Float32Array;
    r: Float32Array;
    c: Uint32Array;
    l: Float32Array;
}
export declare const galaxyPoints: (g: GalaxyRecipe) => GalaxyPoints;
