export type GalaxyKind = 'S' | 'E' | 'I' | 'D' | 'P';
export interface GalaxyRecipe {
    /** S spiral, E elliptical / lenticular, I irregular, D dwarf spheroidal, P an interacting pair (see below) */
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
    /**
     * P, an interacting pair, one moment of it (a restricted N-body run after Toomre & Toomre 1972): two softened point masses on a
     * parabolic (ecc 1, the default) or bound (ecc < 1, started at the far end) orbit, each with a disc of test particles (or, kind2
     * 'E', a round cloud) that feel only the two masses; tails, bridges and warped discs come out by themselves. ratio: the second
     * mass over the first; peri: the closest approach (disc radius of the first = 1); size2: the second's radius (√ratio); incl1 /
     * incl2: the discs' tilt to the orbit plane (degrees, over 90 retrograde), node1 / node2: their turn round its normal; time: since
     * the closest approach (bound: since the start), in units where the first's disc edge takes 2π to go round; share2: the
     * second's part of the points; first: false leaves the first's particles out (a stream round a host drawn elsewhere), and then
     * the frame is centred on the first mass. The result is scaled into the unit ball (its 99th percentile at 1).
     */
    ratio?: number;
    peri?: number;
    size2?: number;
    incl1?: number;
    incl2?: number;
    node1?: number;
    node2?: number;
    time?: number;
    ecc?: number;
    share2?: number;
    kind2?: 'S' | 'E';
    first?: boolean;
    /** P: a drag between the two masses near each other (dynamical friction; 0 none): with it they sink together and merge */
    merge?: number;
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
