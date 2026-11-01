// 3Draft: minimalist AI first 3D engine.
// Early placeholder release: the real engine (palette-texture meshes,
// WASM core, WebGPU/WebGL2 renderer, SVG preview) is built on top of this.

export const name = '3draft';
export const version = '0.0.1';

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
