# 3Draft

Minimalist AI first 3D engine.

> Status: **pre-alpha**. The `0.0.x` releases reserve the package name and
> pin down the direction; the engine itself is built step by step in this repo.

```sh
npm install 3draft
```

```js
import { info } from '3draft';

console.log(info());
```

## Idea

- **One material, one palette texture.** Every face's UV points at a single
  texel of a small palette texture, so a whole scene is one pipeline, one bind
  group and instanced draw calls.
- **Thin WASM core.** Transforms, culling and animation live in a WASM module
  (HEXAW and/or Rust) behind a small, documented ABI. JS only uploads buffers.
- **WebGPU first, WebGL2 fallback** behind a minimal `Renderer` interface.
- **AI first.** A deterministic SVG preview and structured `inspect` reports
  (plus an MCP server) let an AI build and verify models from text.

## Roadmap

1. ABI description + reference JS kernel + spinning instanced cube
2. SVG/PNG preview renderer and MCP `render` / `inspect`
3. Text modelling language + palette/UV validator
4. HEXAW kernel next to the JS reference, with differential tests
5. Rust core only if the logic outgrows HEXAW

## License

MIT
