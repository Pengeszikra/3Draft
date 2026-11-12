import type { Palette } from './material.js';
import type { Axes, Camera, Fit, Mark, Mesh, Vec3, ViewName, ViewSpec } from './types.js';
type Handle = any;
export interface GpuLight {
    /** Direction towards the light, world space. */
    direction?: Vec3;
    /** Hemisphere ambient colors (rgb 0..1): up and down. */
    sky?: Vec3;
    ground?: Vec3;
}
export interface GpuMaterial {
    ambient?: number;
    diffuse?: number;
    specular?: number;
    shininess?: number;
}
export interface GpuRenderOptions {
    /** CSS pixels, the canvas becomes size x size (times dpr in device pixels). */
    size?: number;
    fit?: Fit;
    /** Clear color, rgb 0..1. */
    background?: Vec3;
    light?: GpuLight;
    material?: GpuMaterial;
    /** Named materials the faces point at (`face.mat`); pass a new object when an entry changes. */
    palette?: Palette;
    dpr?: number;
    /**
     * The separate meshes `mesh` was merged from (a scene made of objects). When given, their vertices are built once per part
     * and kept while the part (the same Mesh object), the palette and the smoothing stay the same, so adding or changing one
     * object does not rebuild the others. `mesh` must still be their merge (it is used for the camera).
     */
    parts?: Mesh[];
    /** Many copies of one prototype mesh (modelled around the origin), drawn after `mesh`. */
    instances?: {
        mesh: Mesh;
        data: Float32Array;
    };
    /**
     * Filmic look: lighting in linear colour, HDR light and emission, Fresnel on the edges, ACES tone mapping.
     * `true` for the defaults or { exposure = 1, emit = 2 } (emit: brightness of one unit of material `emit`, which goes up to 5).
     * Off by default (the plain flat look).
     */
    tonemap?: boolean | {
        exposure?: number;
        emit?: number;
    };
    /**
     * Smooth shading: faces that meet at an angle smaller than this (degrees; `true` = 40) share their normals, so a curved
     * surface made of flat faces looks round and sharper corners stay crisp. Off by default (every face flat).
     */
    smooth?: boolean | number;
    /**
     * Studio light: three lights that follow the camera instead of one fixed sun: a key light (upper left), a fill light
     * (right, softer) and a rim light from behind that edges the shape. Off by default.
     */
    studio?: boolean | {
        fill?: number;
        rim?: number;
    };
    /** Thin (1 pixel) dark lines along the edges of every face, hidden where the surface is. Off by default. */
    edges?: boolean;
    /** No lighting at all: a surface shows only its emission (flat colour times emit); lines and marks still draw. Off by default. */
    unlit?: boolean;
    /** Glow: emitting materials light their surroundings as local lights (no shadows), up to 16 at a time. Off by default. */
    glow?: boolean;
    /**
     * A skinned figure, bent on the GPU: `meshes` in their bind pose (built and uploaded once while they stay the same Mesh
     * objects), `weights[m][i]` the joints of vertex i of mesh m (a rig's `skin`; the four strongest are used) and `bones`
     * the joint moves of this frame (boneMatrices(): 12 floats per joint, at most MAX_BONES joints). Only `bones` changes
     * from frame to frame. Drawn after `mesh`; it takes no part in the edges, the glow lights or the camera's fit.
     */
    skin?: GpuSkin;
    /**
     * Pictures on four-cornered faces (a scene played on a face): each `source` (a canvas, e.g. another renderer's) is copied
     * into a texture every frame and drawn on the quad `corners` (top left, top right, bottom right, bottom left), depth tested
     * against the scene like any face, unlit (it is a display). `uv` = [u0, v0, u1, v1] picks the part of the picture to show
     * (v = 0 is its top). Put the quad a hair in front of its face so it does not fight it.
     */
    screens?: GpuScreen[];
    /** Thick lines and points on top of everything (selections, the cursor, handles): world-space polylines drawn by the GPU with round caps. */
    marks?: Mark[];
}
/** See GpuRenderOptions.screens. */
export interface GpuScreen {
    corners: [Vec3, Vec3, Vec3, Vec3];
    source: any;
    uv?: [number, number, number, number];
}
/** Floats per screen vertex: position, then u v. */
export declare const SCREEN_FLOATS = 5;
/** The two triangles of every screen quad (SCREEN_FLOATS per vertex), in `screens` order. */
export declare const buildScreenQuads: (screens: GpuScreen[]) => Float32Array;
/** See GpuRenderOptions.skin. */
export interface GpuSkin {
    meshes: Mesh[];
    weights: [joint: number, weight: number][][][];
    bones: Float32Array;
}
/** The most joints a GPU skin can have. */
export declare const MAX_BONES = 64;
/** Floats per skinned vertex: the 14 of buildVertices, then four joints and their four weights. */
export declare const SKIN_FLOATS = 22;
/** One copy of a prototype: its position, orthonormal frame and color. */
export interface Instance {
    at: Vec3;
    axes: Axes;
    color?: string;
}
export interface Pixels {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}
export interface Gpu {
    render(mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): void;
    /** Same frame, drawn offscreen and read back as RGBA (tests, thumbnails). */
    pixels(mesh: Mesh, view: ViewName | ViewSpec, options?: GpuRenderOptions): Promise<Pixels>;
    destroy(): void;
    device: Handle;
    adapter: Handle;
}
/** Floats of one mark segment: a (xyz), b (xyz), colour (rgba), width in CSS pixels, one spare. */
export declare const MARK_FLOATS = 12;
/** One instance per segment of every polyline of every mark (a zero-length segment is a round point). */
export declare const buildMarks: (marks: Mark[]) => Float32Array;
/** Line-list endpoints (x y z, x y z) of every edge of every face, each pair of vertices once. */
export declare const buildEdges: (mesh: Mesh) => Float32Array;
/** The edge lines of a scene: of its parts (kept while a part stays the same Mesh) or of the whole mesh. Empty when the scene is huge. */
export declare const sceneEdges: (mesh: Mesh, parts?: Mesh[]) => Float32Array;
/** Floats of one glow light: position (3), reach (1), colour times intensity (3), spare (1). */
export declare const LIGHT_FLOATS = 8;
export declare const MAX_LIGHTS = 16;
/**
 * Glow: the emitting faces of a scene act as local light sources. Faces close to each other (one cell of a grid) merge into
 * one light at their weighted centre; the brightest MAX_LIGHTS stay. Each light has a reach that grows with the emitting area.
 * Float32Array, LIGHT_FLOATS per light.
 */
export declare const sceneLights: (mesh: Mesh, parts?: Mesh[], palette?: Palette) => Float32Array;
/**
 * Column-major 4x4 matrix (for WebGPU, z in 0..1) that maps world points exactly
 * like camera.project(): the same pixels, plus a depth between near and far.
 */
export declare const viewProjection: (cam: Camera, near?: number, far?: number) => Float32Array;
/**
 * Near plane for a scene seen from `cam`: the usual 0.03, unless everything is very far (a galaxy seen from outside, the
 * nearest point thousands of units away), where a near plane that close would leave no depth precision at all.
 */
export declare const nearPlane: (cam: Camera, mesh: {
    positions: Vec3[];
}) => number;
/**
 * Smooth shading: a normal for every corner of every face. The faces that meet at a point (welded by position, so a
 * crack in the indices does not break it) are averaged, weighted by area, but only those within `crease` degrees of
 * this face: a 90 degree box corner stays sharp, a faceted fuselage becomes round.
 */
export declare const cornerNormals: (mesh: Mesh, crease: number, soft?: number[]) => Vec3[][];
/**
 * Triangle list for the GPU: face normals (flat, or smoothed with `smooth` degrees), face colors and materials.
 * Float32Array, 14 floats per vertex.
 */
export declare const buildVertices: (mesh: Mesh, palette?: Palette, { smooth }?: {
    smooth?: number;
}) => Float32Array;
/**
 * Triangle list of a skinned figure in its bind pose: buildVertices' 14 floats per vertex, then the indices of its four
 * strongest joints and their weights (summing to 1). The shader moves each vertex by its joints' bone matrices.
 */
export declare const buildSkinVertices: (meshes: Mesh[], weights: [number, number][][][], palette?: Palette, { smooth }?: {
    smooth?: number;
}) => Float32Array;
/** Splits a triangle list into the opaque triangles and the see-through ones (alpha < 1, float 11 of a vertex). */
export declare const splitGlass: (all: Float32Array, floats: number) => {
    solid: Float32Array;
    glass: Float32Array;
};
/** A skin's vertices, kept while its meshes, palette and smoothing stay the same. */
export declare const skinCache: () => (skin: GpuSkin, palette: Palette | undefined, crease: number) => {
    solid: Float32Array;
    glass: Float32Array;
    fresh: boolean;
};
/**
 * Per-instance data for drawInstances: one entry { at, axes: [ex, ey, ez], color } per copy of a
 * prototype mesh (modelled around the origin). Float32Array, 15 floats per instance.
 */
export declare const buildInstances: (items: Instance[]) => Float32Array;
export declare const defaultLight: Required<GpuLight>;
export declare const defaultMaterial: Required<GpuMaterial>;
/**
 * Sets up WebGPU on a canvas. Rejects when WebGPU is not available.
 * Returns { render(mesh, view, options), destroy() }.
 * render options: size (CSS px, the canvas is made size x size), fit, instances { mesh, data } (many copies of one
 * prototype mesh, data from buildInstances; drawn after the mesh), background [r,g,b] 0..1,
 * light { direction, sky, ground }, material { ambient, diffuse, specular, shininess }, dpr.
 */
export declare const createGpu: (canvas: HTMLCanvasElement, { sampleCount, onError }?: {
    sampleCount?: number;
    onError?: (message: string) => void;
}) => Promise<Gpu>;
export {};
