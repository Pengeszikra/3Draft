// 3Draft: minimalist AI first 3D engine.
// Current stage: points, edges and flat faces rendered to deterministic SVG
// from four fixed cameras. No textures, no shading yet.

export const name = '3draft';
export const version = '26.11.1001';

export { box, merge, rotate, bounds, faceNormal, faceCenter } from './mesh.js';
export { VIEW_ORDER, makeCamera, project } from './camera.js';
export { renderView, renderViews, renderSheet } from './svg.js';

/** Short, machine-readable description of the current state of the package. */
export const info = () => ({
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
