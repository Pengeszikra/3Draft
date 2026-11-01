# 3Draft

Minimalist AI first 3D engine.

> Status: **pre-alpha**. The `0.0.x` releases reserve the package name and
> pin down the direction; the engine itself is built step by step in this repo.

```sh
npm install 3draft
```

## Usage (v0.1: points, edges, flat faces, SVG)

```js
import { writeFileSync } from 'node:fs';
import { box, merge, renderSheet, renderViews } from '3draft';

const table = merge(
  box({ size: [2, 0.15, 1.2], at: [0, 0.925, 0], color: '#c8a27a' }),
  box({ size: [0.15, 0.85, 0.15], at: [-0.85, 0.425, -0.45], color: '#8a6a4a' }),
  // ...more legs
);

writeFileSync('table.svg', renderSheet(table)); // 2x2 sheet

for (const { name, svg } of renderViews(table)) {
  // one after another: 'front', 'side', 'top', 'persp'
  writeFileSync(`table.${name}.svg`, svg);
}
```

`npm run example` writes the table above to `examples/out/`:

![table sheet](examples/out/table.sheet.svg)

Views: `front` (eye on +z), `side` (eye on +x), `top` (eye on +y), all
orthographic with the same scale, and a perspective `persp` view. Every
`<polygon>` carries `data-face` and `data-depth`, every `<circle>` carries
`data-v`, so the output can be inspected as plain text.

Any camera works: `renderView(mesh, { dir, up, ortho, name })` takes a custom
view, `rotate(mesh, { yaw, pitch })` turns the mesh, and `{ fit: bounds(mesh) }`
keeps the framing fixed while it moves.

### Known limitations

- Faces are painter-sorted by their center depth. Solids that touch or
  interpenetrate can show artifacts, so leave interior/contact faces out of the
  model (the demo table legs have no top face). A z-buffer or face-splitting
  pass is planned.
- Edges are the polygon outlines, so hidden edges are not drawn.
- Back-face culling assumes closed meshes with CCW faces seen from outside.

## Viewer app (repo only, not part of the npm package)

```sh
npm run app     # http://localhost:5173/app/
```

Drag to rotate the table in front of the camera, double click to reset. It is
a single `app/index.html` plus a dependency-free static server
(`app/serve.js`, localhost only, serves `app/`, `src/` and `examples/`).

## Versioning

Date based, written `YY.MM.DD.NNN`. npm needs valid semver (three numbers, no
leading zeros), so the published form is `YY.M.DNNN` where the last number is
day * 1000 + build:

| readable       | package version |
| -------------- | --------------- |
| `26.11.01.001` | `26.11.1001`    |
| `26.11.01.002` | `26.11.1002`    |
| `26.11.15.012` | `26.11.15012`   |

`npm run bump` sets the next version for today's date in `package.json` and
`src/index.js` (`node scripts/bump.js --dry` only prints it).

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
