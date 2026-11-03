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
Backspace takes the last one back. Over empty space Space shoots the prism out under the cursor to a random distance, animated, flying exactly along the camera axis (it lies along that axis like a bullet). The viewer starts empty (no table) and lays out only what you place. X deletes the object under the cross, whoever made it. Loaded objects (db, MCP) and objects made in the viewer are the same kind of thing, `{ id, name, mesh }`: with the artifact `db` every prism, bar, paint stroke and delete is written to the shared collection, so the AI sees what a person makes in the same way a person sees what the AI makes.  V is the Spider bar: the first V remembers the surface point under the cross, the second joins the two points with a thin prism (half the base of a shot prism, a darker brown); V over empty space forgets a pending first point. T flies the camera straight to the front of the object under the cross without turning it; T over nothing sets the speed to zero. W A S D R F fly: every press is a speed step along that axis (the speed grows faster than the level: 1, 2.7, 5.6, 9.9 ...) (w w w = speed 3 forward, s s s brings it back to a stop), R and F go up and down. `/` keeps only the model under the cross in the picture and frames it; `/` again brings the whole scene back. P opens the material palette: with it on, Shift+press paints the face under the cross, Shift+double click paints the whole model (a placed prism takes the colour as one piece). The cursor is always a cross. H toggles edges and points. T flies the camera, animated, to the object under the cross and in front of the surface you point at (the whole scene is framed again when T is pressed over nothing, or with Reset view). Prisms get a random wood brown. On a phone or tablet the stage fills the screen with no text: drag orbits, and four round translucent buttons do T, Space, D and the SVG/WebGPU switch (the cross starts in the middle and stays where you last touched).

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
| `get_mesh`, `extrude_face`, `move_vertices` | shape an object: push, taper, inset or dent a face, move vertices |
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

## TypeScript and the `|>` pipeline operator

The engine is written in TypeScript (`src/*.ts`) with the F# style pipeline operator, `value |> fn`
(see [Pipeline operator great again](https://dev.to/pengeszikra/pipeline-operator-great-again-1cbn)).
Neither `tsc` nor Node understands `|>` yet, so `npm run build` (`scripts/build.mjs`) first rewrites
every `|>` into plain calls (`scripts/pipe.mjs`, `a |> f |> g(1)` becomes `g(1)(f(a))`) and then lets the
TypeScript compiler type check and emit `dist/*.js` and `dist/*.d.ts`.

```ts
const t1 = mesh.positions[b] |> minus(mesh.positions[a]) |> norm;   // the right side is a function
const dir = spec.dir |> norm |> times(dist) |> plus(center);          // curried helpers: plus, minus, times
```

- The right side must evaluate to a function; put an arrow function in parentheses: `x |> ((v) => v + 1)`.
- `|>` binds like `>>>` while it is parsed, so wrap a pipeline in parentheses next to `+`, `-` and friends.
- `dist/` is committed: the viewer, the examples, the MCP server and the npm package use the built JavaScript, so a
  clone runs without a build. `npm run build:check` fails when `dist/` is out of date, `npm test` builds first.
- The compiler is a dev dependency (`typescript`); `TYPESCRIPT=/path/to/typescript.js` points the build at another copy.

## Develop

```bash
npm run build        # src/*.ts -> dist/ (|> desugared, type checked)
npm test             # builds, then runs every test (dist, examples, mcp, scripts)
npm run build:check  # fails when dist/ is out of date
npm run kernel       # re-assemble kernel/pick.hexaw (needs the hexaw repo next to this one)
npm run app          # the viewer, http://localhost:5173/app/
```

Edit `src/*.ts`, never `dist/`: it is generated and committed so that a clone runs without a build.

## Viewer app (repo only, not part of the npm package)

```sh
npm run app     # http://localhost:5173/app/
```

Drag to rotate the view, double click to reset. A target cross follows the pointer and lies on the surface under it.

| key | does |
| --- | --- |
| `w a s d r f` | fly: forward, left, back, right, up, down; every press is a speed step (an accelerating curve), the opposite key slows down |
| `/` | only the model under the cross; again: the whole scene |
| `P` | show / hide the material palette; `Shift`+press paints a face, `Shift`+double click the whole model |
| `Space` | place a prism on the surface (or shoot one into empty space) |
| `V` | Spider bar: two surface points joined by a thin brown prism; `V` over empty space forgets the first point |
| `T` | travel to the target (a straight flight); `T` over nothing stops and zeroes the speed |
| `X`, `Backspace` | delete the prism under the cross, undo |
| `H`, `G`, `L` | edges, SVG / WebGPU view, light |

On a phone the four round buttons do the same. The viewer picks with the HEXAW kernel (the footer shows `pick hexaw`). It is a
single `app/index.html` plus a dependency-free static server
(`app/serve.js`, localhost only, serves `app/`, `dist/` and `examples/`).

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
`src/index.ts` (`node scripts/bump.js --dry` only prints it).

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

## Examples

- `examples/table.js`: the table demo (`npm run example`).
- `examples/bridge.js`: a stone arch bridge of 50 named objects (`npm run bridge`). It writes `examples/bridge.scene.json`, a scene file you can load with the MCP `import` tool (`path: "examples/bridge.scene.json"`).
- `examples/cessna.js`: a small Cessna as ONE mesh with 9 face colours (single flat material, colour per face): lofted closed parts (fuselage, high wing, tail, struts, gear, spinner, propeller) merged into one mesh. `node examples/cessna.js` checks it and writes `examples/cessna.scene.json` (one object, loadable with the MCP `import` tool) and `examples/out/cessna.svg`.

## HEXAW kernel

The picking hot loop (ray against every triangle, Moller-Trumbore, the same arithmetic as `src/pick.ts`) is also written in
[HEXAW](https://github.com/Pengeszikra/hexaw), the byte-visible WebAssembly assembly dialect:

- `kernel/pick.hexaw` is the source (569 bytes of WebAssembly once assembled).
- `npm run kernel` assembles it with `hexaw-core.js` (found through `HEXAW_CORE`, a checkout next to this repo, or the `hexaw` package) and writes `src/kernel-bytes.ts`, the module as base64 (then `npm run build` carries it into `dist/`). The engine needs neither HEXAW nor a file fetch at runtime. `node scripts/build-kernel.mjs --check` fails when the generated file is out of date.
- `initKernel()` starts it; `kernel.pick(mesh, camera, x, y)` returns exactly what `pick()` returns. The mesh is copied into the kernel's linear memory once for as long as it is the same object.
- The viewer uses the kernel as soon as it has started (the footer shows `pick hexaw`), and plain `pick()` before that.
- Measured on 1200 prisms (7200 faces): 1.7 ms per pick in JavaScript, 0.14 ms with the kernel.

The kernel exports its linear memory (`EXPM "memory"`, needs hexaw with JS-compatible memory), so the mesh is written straight into it with `Float64Array` / `Int32Array` views and the distance is read back from address 0; the former `setf`/`seti`/`getf`/`grow`/`size` helper functions are gone.

### Sending only what is seen (`occlude`)

`renderView(mesh, view, { occlude: true })` paints the faces into a small depth buffer first and sends only the faces and points that own a pixel. On the 5000-face house this is 2793 -> about 680 polygons and 802 KB -> 175 KB with the same picture (about 0.05% of the pixels differ), and about 40% less time because the painter's order only sorts the visible faces. The viewer uses it. It is off by default so that existing output stays byte for byte the same.
