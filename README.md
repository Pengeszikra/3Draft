# 3Draft

Minimalist AI first 3D engine.

> Status: **pre-alpha**. The engine is built step by step in this repo.

```sh
npm install 3draft
```

The README has three parts: [1. the engine](#1-the-engine), [2. the viewer app](#2-the-viewer-app) and [3. how the engine and an LLM work together](#3-engine-and-llm).

---

## 1. The engine

A model is plain data, so a human, a program and an LLM can all read and write it:

```js
const mesh = {
  positions: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], // Vec3[], y is up
  faces: [{ v: [0, 1, 2, 3], color: '#c8a27a', mat: 'wood' }], // CCW seen from outside, planar, convex
};
```

A scene is a list of objects `{ id, name, mesh }`. One mesh can hold many differently coloured faces (`examples/cessna.js` is one mesh with 9 colours).

### Rendering

```js
import { box, merge, renderSheet, renderView, orbit, createGpu } from '3draft';

const table = merge(
  box({ size: [2, 0.15, 1.2], at: [0, 0.925, 0], color: '#c8a27a' }),
  box({ size: [0.15, 0.85, 0.15], at: [-0.85, 0.425, -0.45], color: '#8a6a4a' }),
);
renderSheet(table);                           // SVG: front, side, top, persp on one sheet
renderView(table, 'persp', { occlude: true }); // one view, only what is seen
const gpu = await createGpu(canvas);          // WebGPU, same camera, same pixels
gpu.render(table, orbit({ yaw: -0.6, pitch: 0.45 }), { size: 600 });
```

![table sheet](examples/out/table.sheet.svg)

- **SVG** is the deterministic preview (the same calls give the same text). Every `<polygon>` has `data-face` and `data-depth`, every `<circle>` has `data-v`. `occlude: true` paints into a small depth buffer first and sends only the faces and points that are seen (on the 5000-face house: 2793 -> about 680 polygons, 802 KB -> 175 KB, same picture).
- **WebGPU** draws the same scene through the same camera (`viewProjection` is tested to hit the same pixels as `project`), with one shader, one light, alpha-to-coverage transparency and instancing.
- Cameras: `front`, `side`, `top` (orthographic) and `persp`; `orbit({ yaw, pitch })` is a turntable; any `{ dir, up, ortho }` works.
- Faces are painter-sorted with plane tests; interpenetrating solids can show artifacts, hidden edges are not drawn, back-face culling assumes closed CCW meshes.

### Materials

The palette is data: `{ name: { color, metal, rough, alpha, emit } }`. A face points at an entry with `face.mat`; its `color` stays as the fallback. Editing an entry changes every face made of it.

| field | meaning | drawn as |
|---|---|---|
| `metal` 0..1 | paint ... metal | reflects sky and ground, tinted; strong highlight |
| `rough` 0..1 | mirror ... matte | widens the highlight, blurs the reflection |
| `alpha` 1..0 | solid ... invisible | alpha-to-coverage, one pass, no sorting (SVG: `fill-opacity`, and a see-through face hides nothing) |
| `emit` 0..1 | lit ... glowing | the colour shows unshaded |

Pass the palette to the renderers: `renderView(mesh, view, { palette })`, `gpu.render(mesh, view, { palette })` (a new object when an entry changes). SVG shows colour and alpha only.

### Surfaces, picking, editing

- `pick(mesh, camera, x, y)` casts a real ray: face, point, normal, distance. `ray` is the inverse of `project`; `crosshair` builds a cross lying on the surface; `standOn` returns a prism standing on a picked surface.
- `validate(mesh)` returns text notes: closed shell, winding, planar and convex faces. `extrudeFace`, `moveVertices`, `extrude`, `rotate`, `merge`, `bounds` shape meshes.
- **HEXAW kernel.** The picking hot loop is also written in [HEXAW](https://github.com/Pengeszikra/hexaw) (`kernel/pick.hexaw`, 569 bytes of WebAssembly). `initKernel()` starts it; `kernel.pick` returns exactly what `pick` returns, 0.14 ms instead of 1.7 ms on 7200 faces. The module is embedded as base64 (`src/kernel-bytes.ts`), so the engine needs neither HEXAW nor a fetch at runtime. `npm run kernel` re-assembles it.

### TypeScript and `|>`

The source is TypeScript (`src/*.ts`) with the F# style pipeline operator, `value |> fn` ([why](https://dev.to/pengeszikra/pipeline-operator-great-again-1cbn)). `npm run build` rewrites every `|>` into plain calls (`scripts/pipe.mjs`: `a |> f |> g(1)` becomes `g(1)(f(a))`) and lets `tsc` check and emit `dist/`, which is committed, so a clone runs without a build.

```ts
const dir = spec.dir |> norm |> times(dist) |> plus(center); // the right side is a function
```

Put arrow functions in parentheses (`x |> ((v) => v + 1)`) and wrap a pipeline in parentheses next to `+` and `-`.

---

## 2. The viewer app

```sh
npm run app     # http://localhost:5173/app/   (repo only, not in the npm package)
```

A single `app/index.html` plus a dependency-free static server (`app/serve.js`, localhost only). It is also published as a Claude artifact whose shared database is the scene. Drag rotates, double click resets, a target cross follows the pointer and lies on the surface under it. The cursor is always a cross.

**One object model.** Objects loaded from outside (the db, the MCP server) and objects made in the viewer are the same thing, `{ id, name, mesh }`: painting, deleting, isolating and undo work on all of them, whoever made them. With the artifact `db` every create, paint and delete is written back, so the AI sees what a person makes.

| key | does |
| --- | --- |
| `w a s d r f` | fly: forward, left, back, right, up, down; every press is a speed step, the opposite key slows down |
| `M` | place a prism on the surface (or shoot one into empty space) |
| `Space` | stop moving (all speeds to zero) |
| `V` | Spider bar: two surface points joined by a thin prism |
| `X`, `Backspace` | delete the object under the cross, undo |
| `/` | only the object under the cross; again: the whole scene |
| `P` | show / hide the materials; `Shift`+press paints a face, `Shift`+double click the whole object |
| `T` | fly to the object under the cross; over nothing, or when too close or inside a model: out to the nearest object |
| `H`, `G`, `L` | edges and points, SVG / WebGPU view, light |

**Materials (P).** Twelve starting materials (plaster, sand, wood, dark wood, concrete, slate, grass, brick, steel, gold, glass, lamp), four sliders (`metal`, `rough`, `alpha`, `emit`) and a colour for the selected one, `+ new` copies it. A painted face stores the material name, so editing a material changes every face made of it.

**Database layout** (artifact `db`): collection `objects` (one document per object: `{ name, mesh }`, at most 256 KiB each) and collection `palette` (one document per material: `{ color, metal, rough, alpha, emit, order }`).

The viewer sends the SVG through `occlude`, picks with the HEXAW kernel (footer: `pick hexaw`), and on a phone shows four round buttons for the main actions.

---

## 3. Engine and LLM

The engine is small enough to read whole (about 2000 lines) and everything it works with is text: meshes, palettes and scenes are JSON, previews are SVG, reports are sentences. That is the interface for an LLM:

- **Look.** The LLM renders a model to SVG and reads it (or the numbers in it), without a screenshot. `occlude` keeps the text small.
- **Check.** `validate` / `inspect` say in words what is wrong (open shell, inside-out faces, a non-planar face, which one), so the next edit is targeted.
- **Edit.** The same data goes back in: write documents, call tools, render again. Output is deterministic, so a change in the picture is a change in the model.
- **MCP server.** `mcp/server.js` (stdio, no dependencies) holds a scene of named objects and exposes it as tools: `add_box`, `add_extrusion`, `add_mesh`, `transform`, `recolor`, `remove`, `clear`, `get_mesh`, `extrude_face`, `move_vertices`, `list`, `inspect`, `render`, `pick`, `export`, `import`, `viewer`. It also serves the viewer and pushes every change to it, so a person watches the model grow. `claude mcp add 3draft -- node /absolute/path/to/3Draft/mcp/server.js`
- **Shared database.** In the artifact, the LLM and the person edit the same `objects` and `palette` collections, so either side can start from what the other made.

Y is up, the ground is y = 0, faces are counter-clockwise seen from outside.

Examples: `examples/table.js`, `examples/bridge.js` (50 named objects), `examples/cessna.js` (one mesh, 9 colours), and `examples/house.js` (a house converted from Blender with `tools/blend/`, 45 objects, approximate colours).

---

## Develop, version, license

```bash
npm run build        # src/*.ts -> dist/ (|> desugared, type checked)
npm test             # builds, then runs every test
npm run build:check  # fails when dist/ is out of date
npm run app          # the viewer
```

Edit `src/*.ts`, never `dist/`. Versions are date based, `YY.MM.DD.NNN`, published as semver `YY.M.DNNN` (`26.11.01.002` is `26.11.1002`); `npm run bump` sets the next one.

MIT
