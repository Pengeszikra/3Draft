type V3 = [number, number, number];
export declare const LY_PER_PC = 3.26156;
export declare const LY_PER_AU = 0.0000158125074;
export declare const LY_PER_KM: number;
export declare const SUN_RADIUS_LY: number;
export declare const EARTH_RADIUS_LY: number;
/** The sky prototypes: star (a plain sphere, the glow is a sprite), planet (3 % smaller: the planet shader's sphere covers it), ghost (a galaxy's stand-in), hole (a black hole's ball and disc). */
export declare const skyPrototypes: () => Record<string, any>;
export declare const STAR_CLASSES: Record<string, [string, number]>;
export declare const starClass: (spect?: string, temp?: number) => string;
/** a blackbody-ish tint for a temperature (K) */
export declare const starTint: (t: number) => string;
export declare const EXO_RECIPES: [string, any][];
/** a planet's class: size (rock < 1.6 Earth radii, sub < 4, nep < 8, jup) and warmth (lava > 1200 K, hot > 700, warm > 350, temp > 200, cold > 100, froz) */
export declare const exoClass: (rE: number, teq: number) => string;
/** the recipe of a planet of that size and warmth (a variant of its class by the name) */
export declare const exoRecipe: (name: string, rE: number, teq: number) => any;
export declare const SKY_PALETTE: () => any[];
/** what the catalogue can hold, for the docs and the MCP tool's schema */
export declare const SKY_TYPES: readonly ["star", "planet", "moon", "dwarf planet", "exoplanet", "black hole", "galaxy"];
/** equatorial (RA, Dec in degrees, distance in ly) -> the scene's [x, z, -y] */
export declare const skyAt: (raD: number, decD: number, dist: number) => V3;
export interface SkyResult {
    scene: any;
    warnings: string[];
    counts: Record<string, number>;
}
/** A sky catalogue ('3draft-sky') -> a viewer scene. Errors that make an object unusable become warnings (the object is left out). */
export declare const skyScene: (sky: any) => SkyResult;
export {};
