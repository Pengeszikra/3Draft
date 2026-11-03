import type { Palette } from './material.js';
import type { Axes, Camera, Fit, Mesh, Vec3, ViewName, ViewSpec } from './types.js';
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
    /** Many copies of one prototype mesh (modelled around the origin), drawn after `mesh`. */
    instances?: {
        mesh: Mesh;
        data: Float32Array;
    };
}
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
/**
 * Column-major 4x4 matrix (for WebGPU, z in 0..1) that maps world points exactly
 * like camera.project(): the same pixels, plus a depth between near and far.
 */
export declare const viewProjection: (cam: Camera, near?: number, far?: number) => Float32Array;
/** Triangle list for the GPU: flat face normals, face colors and materials. Float32Array, 13 floats per vertex. */
export declare const buildVertices: (mesh: Mesh, palette?: Palette) => Float32Array;
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
export declare const createGpu: (canvas: HTMLCanvasElement, { sampleCount }?: {
    sampleCount?: number;
}) => Promise<Gpu>;
export {};
