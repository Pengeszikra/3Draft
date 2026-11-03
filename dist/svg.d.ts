import type { Palette } from './material.js';
import type { Fit, Mark, Mesh, ViewName, ViewSpec } from './types.js';
export interface RenderOptions {
    /** Panel size in px (default 400). */
    size?: number;
    /** Drop back-facing faces (default true). */
    cull?: boolean;
    /** Draw the vertices as circles (default true). */
    points?: boolean;
    /**
     * Send only what can be seen (default false). Faces are first painted into a small id buffer, far to
     * near; a face none of whose pixels survives is covered by nearer ones and is left out, and so is a
     * point no visible face reaches. The picture stays the same, the SVG gets much smaller.
     */
    occlude?: boolean;
    /** Named materials (`face.mat`). The SVG shows their color and alpha; metal, rough and emit are for the GPU view. */
    palette?: Palette;
    stroke?: string;
    pointColor?: string;
    background?: string;
    /** Keep the camera target/framing fixed while the mesh moves. */
    fit?: Fit;
    /** 3D polylines drawn on top, e.g. the surface cursor. */
    marks?: Mark[];
}
/**
 * One standalone SVG for a single view: 'front' | 'side' | 'top' | 'persp',
 * or a custom { dir, up, ortho, name? } spec.
 */
export declare const renderView: (mesh: Mesh, view: ViewName | ViewSpec, opts?: RenderOptions) => string;
/** The four views one after another: [{ name, svg }, ...]. */
export declare const renderViews: (mesh: Mesh, opts?: RenderOptions) => {
    name: ViewName;
    svg: string;
}[];
/** All four views on one 2x2 sheet: front, side / top, persp. */
export declare const renderSheet: (mesh: Mesh, opts?: RenderOptions) => string;
