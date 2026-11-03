export declare const name: "3draft";
export declare const version = "26.11.3002";
export type { Vec3, Face, Mesh, Axes, ViewName, ViewSpec, Fit, Camera, Hit, Mark } from './types.js';
export { box, extrude, merge, rotate, bounds, faceNormal, faceCenter } from './mesh.js';
export type { BoxOptions } from './mesh.js';
export { validate } from './check.js';
export { boolean, union, subtract, intersect } from './csg.js';
export type { BooleanOp } from './csg.js';
export type { Validation } from './check.js';
export { extrudeFace, moveVertices } from './edit.js';
export { VIEW_ORDER, makeCamera, orbit, project, ray } from './camera.js';
export { pick, crosshair } from './pick.js';
export { standOn } from './place.js';
export type { StandOptions, Frame } from './place.js';
export { paintOrder } from './order.js';
export type { PaintItem } from './order.js';
export { createGpu, viewProjection, buildVertices, buildInstances, defaultLight, defaultMaterial } from './gpu.js';
export type { Gpu, GpuLight, GpuMaterial, GpuRenderOptions, Instance, Pixels } from './gpu.js';
export { renderView, renderViews, renderSheet } from './svg.js';
export type { RenderOptions } from './svg.js';
export { surfaceOf, DEFAULTS as MATERIAL_DEFAULTS } from './material.js';
export type { Material, Palette, Surface } from './material.js';
export { displayVersion } from './version.js';
export interface Info {
    name: string;
    version: string;
    stage: 'pre-alpha';
    goals: string[];
}
/** Short, machine-readable description of the current state of the package. */
export declare const info: () => Info;
export { initKernel } from './kernel.js';
export type { Kernel } from './kernel.js';
