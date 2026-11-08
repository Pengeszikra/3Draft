// 3Draft: minimalist AI first 3D engine.
// Current stage: points, edges and flat faces rendered to deterministic SVG
// from four fixed cameras, plus surface picking (point, normal, distance) and
// a target cross that lies on the surface under the cursor. No textures, no
// shading yet.

export const name = '3draft' as const;
export const version = '26.11.5001';

export type { Vec3, Face, Mesh, Axes, ViewName, ViewSpec, Fit, Camera, Hit, Mark } from './types.js';
export { box, extrude, merge, rotate, bounds, faceNormal, faceCenter } from './mesh.js';
export type { BoxOptions } from './mesh.js';
export { validate } from './check.js';
export { boolean, union, subtract, intersect, health } from './csg.js';
export type { BooleanOp, Health, Part } from './csg.js';
export type { Validation } from './check.js';
export { extrudeFace, moveVertices } from './edit.js';
export { VIEW_ORDER, makeCamera, orbit, project, ray } from './camera.js';
export { pick, crosshair } from './pick.js';
export { instantiate, lodLevel } from './instances.js';
export type { Prototype, Placement } from './instances.js';
export { standOn } from './place.js';
export type { StandOptions, Frame } from './place.js';
export { paintOrder } from './order.js';
export type { PaintItem } from './order.js';
export { createGpu, viewProjection, buildVertices, cornerNormals, buildInstances, defaultLight, defaultMaterial } from './gpu.js';
export { createGl } from './gl.js';
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
export const info = (): Info => ({
  name,
  version,
  stage: 'pre-alpha',
  goals: [
    'single palette texture, UVs point at one texel per face',
    'WASM core (HEXAW / Rust) behind a thin ABI',
    'WebGPU renderer with WebGL2 fallback',
    'deterministic SVG preview for AI feedback loops',
  ],
});
export { initKernel } from './kernel.js';
export type { Kernel } from './kernel.js';
export { insertVertex, cutFace, moveVertex, fillLoop, addLine, findLoop, nearestSurface, wireFromSegments, moveVertexSet } from './wire.js';
export type { Wire } from './wire.js';
