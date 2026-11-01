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

### Surfaces: what is under the cursor

The engine senses surfaces, not just pixels. `pick` casts a real ray from a
screen pixel into the geometry and returns the face, the hit point, the
surface normal and the distance. `crosshair` builds a target cross that lies
flat on that surface (perpendicular to its normal), aligned to the face, so it
turns with the object. Marks are drawn on top by `renderView`.

```js
import { makeCamera, pick, crosshair, renderView } from '3draft';

const cam = makeCamera('persp', mesh, 400);
const hit = pick(mesh, cam, x, y); // { face, point, normal, distance, color } or null

const marks = hit ? [{ name: 'cursor', lines: crosshair(mesh, hit, 0.08) }] : [];
const svg = renderView(mesh, 'persp', { marks });
```

Picking uses the geometry, not the painter's drawing order, so it stays exact
where the drawing has artifacts. `ray(cam, x, y)` is the inverse of
`project`. The viewer shows the cross under the pointer and reads out the face
and its object-space normal.

Any camera works: `renderView(mesh, { dir, up, ortho, name })` takes a custom
view, `rotate(mesh, { yaw, pitch })` turns the mesh, and `{ fit: bounds(mesh) }`
keeps the framing fixed while it moves.

### Placing things

`orbit({ yaw, pitch })` is a turntable as a camera, so the scene stays in object
space and picks stay valid. `standOn(mesh, hit, { base, height, color })`
returns a prism standing on the picked surface along its normal (height
defaults to 3 x base). In the viewer, Space puts one down under the cross and
Backspace takes the last one back. Over empty space Space shoots the prism out along the cursor ray to a random distance, animated. The viewer starts empty (no table) and lays out only what you place. D deletes the prism under the cross. H toggles edges and points. Prisms get a random wood brown.

### WebGPU view

`createGpu(canvas)` returns a WebGPU renderer that draws the same scene through
the same camera as the SVG renderer, so picking, framing and the cross marks stay
valid. Faces are flat colored (the face color is the albedo) and lit by one
material (`ambient`, `diffuse`, `specular`, `shininess`) and one global light
(hemisphere ambient plus one directional light):

```js
import { createGpu, orbit } from '3draft';
const gpu = await createGpu(canvas);          // rejects when WebGPU is missing
gpu.render(mesh, orbit({ yaw, pitch }), {
  size: 600,                                  // CSS px; the canvas is made size x size x dpr
  fit,                                        // keep the framing fixed, as with SVG
  light: { direction: [0.5, 0.8, 0.6] },
  material: { diffuse: 0.8 },
});
```

`viewProjection(camera)` is the matrix behind it; it is unit tested to land every
point on the same pixel as `project()`. `gpu.pixels(...)` draws the same frame
offscreen and reads it back as RGBA.

### MCP server: let an AI build the models

`mcp/server.js` is an MCP server (stdio, no dependencies) that holds a scene of
named objects and edits it through tool calls. The AI looks at the SVG preview,
fixes what is wrong and renders again, so it never needs a screenshot.

```sh
# Claude Code
claude mcp add 3draft -- node /absolute/path/to/3Draft/mcp/server.js
```

```json
{ "mcpServers": { "3draft": { "command": "node", "args": ["/absolute/path/to/3Draft/mcp/server.js"] } } }
```

(that JSON goes into `claude_desktop_config.json` for Claude Desktop.)

**Live viewer.** The same process serves the viewer and pushes every change to it
(Server-Sent Events). Ask the AI for the `viewer` tool's URL (default
`http://localhost:5173/app/`, next free port if that is taken, `3DRAFT_PORT` to
change it, `3DRAFT_LIVE=0` to turn it off), open it in a browser and watch the
model grow while the AI builds. The view re-frames to the scene; the objects are
read-only in the viewer, but you can still rotate, switch to WebGPU, and place or
delete your own prisms on top. Loopback only, other `Host` headers are refused.

| tool | what it does |
| --- | --- |
| `add_box`, `add_extrusion`, `add_mesh` | boxes, prisms from a convex footprint, raw faces |
| `transform`, `recolor`, `remove`, `clear` | scale / rotate Y / move, colors, deleting |
| `list`, `inspect` | objects and bounds; closed shell, winding, planar and convex faces, as text notes |
| `render` | SVG: a 2x2 sheet (front, side, top, persp) or one view, also `orbit` with yaw/pitch |
| `pick` | pixel of a render -> object, face, 3D point, normal |
| `export`, `import` | scene as JSON, optionally a `.json` file under the working directory |
| `viewer` | URL of the live viewer |

Y is up, the ground is y = 0, faces are counter-clockwise seen from outside.
Everything is deterministic, so the same calls give the same SVG.

### Known limitations

- Faces are painter-sorted with plane tests (Newell-Sancha style), which is
  exact for solids that touch or stand on each other. Interpenetrating solids
  and cyclic overlaps fall back to center depth and can show artifacts; a
  face-splitting pass is planned.
- Edges are the polygon outlines, so hidden edges are not drawn.
- Back-face culling assumes closed meshes with CCW faces seen from outside.

## Viewer app (repo only, not part of the npm package)

```sh
npm run app     # http://localhost:5173/app/
```

Drag to rotate the view, double click to reset. G switches between the SVG and the WebGPU view, L turns the light (WebGPU). A
target cross follows the pointer and lies on the surface under it. It is a
single `app/index.html` plus a dependency-free static server
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
