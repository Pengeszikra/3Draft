import type { Face } from './types.js';
export interface Material {
    /** #rrggbb. */
    color: string;
    /** 0 = paint, 1 = metal (reflects the sky and the ground, tinted by the color). */
    metal?: number;
    /** 0 = mirror-like, 1 = matte; widens the highlight. */
    rough?: number;
    /** 1 = solid, 0 = invisible. Blended over what is behind it (WebGPU: a second pass, far to near). */
    alpha?: number;
    /** 0..5: how much the color glows on its own, unlit. Up to 1 it fades from lit to flat colour; above 1 (WebGPU `tonemap`) it is a light source: that many times brighter. */
    emit?: number;
    /** 0..1: soft, skin-like light. The light wraps round the form and a warm, scattered band shows where light turns to shade. */
    soft?: number;
    /** A screen: a page shown on every four-cornered face of this material (the viewer puts an iframe over the picture, warped to the face). The renderers ignore it. */
    url?: string;
}
export type Palette = Record<string, Material>;
/** What a face is made of, all numbers filled in. */
export interface Surface {
    color: string;
    metal: number;
    rough: number;
    alpha: number;
    emit: number;
    soft: number;
}
export declare const EMIT_MAX = 5;
export declare const FALLBACK_COLOR = "#c8c8c8";
export declare const DEFAULTS: {
    readonly metal: 0;
    readonly rough: 0.7;
    readonly alpha: 1;
    readonly emit: 0;
    readonly soft: 0;
};
/** The surface of a face: its palette entry when it names one, else just its color with default properties. */
export declare const surfaceOf: (face: Pick<Face, "color" | "mat">, palette?: Palette) => Surface;
