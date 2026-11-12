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
- **WebGPU** draws the same scene through the same camera (`viewProjection` is tested to hit the same pixels as `project`), with one shader, one light, real alpha blending (see-through faces in a second pass, sorted far to near) and instancing.
- Cameras: `front`, `side`, `top` (orthographic) and `persp`; `orbit({ yaw, pitch })` is a turntable; any `{ dir, up, ortho }` works.
- Faces are painter-sorted with plane tests; interpenetrating solids can show artifacts, hidden edges are not drawn, back-face culling assumes closed CCW meshes.

### Materials

The palette is data: `{ name: { color, metal, rough, alpha, emit } }`. A face points at an entry with `face.mat`; its `color` stays as the fallback. Editing an entry changes every face made of it.

| field | meaning | drawn as |
|---|---|---|
| `metal` 0..1 | paint ... metal | reflects sky and ground, tinted; strong highlight |
| `rough` 0..1 | mirror ... matte | widens the highlight, blurs the reflection |
| `alpha` 1..0 | solid ... invisible | blended in a second pass, far to near (SVG: `fill-opacity`, and a see-through face hides nothing) |
| `soft` 0..1 | hard ... soft | skin-like light: it wraps round the form, and a warm scattered band shows where light turns to shade (WebGPU) |
| `emit` 0..5 | lit ... glowing | up to 1 the colour fades to unshaded; above 1 (with `tonemap`) it is a light source, that many times brighter |

Pass the palette to the renderers: `renderView(mesh, view, { palette })`, `gpu.render(mesh, view, { palette })` (a new object when an entry changes). SVG shows colour and alpha only.

`gpu.render(mesh, view, { tonemap: true })` switches on a filmic look: lighting in linear colour, HDR light, Fresnel on the edges, ACES tone mapping, and `emit` that really glows above white (`tonemap: { exposure, emit }` to tune; off by default, so the plain look stays the same).

`smooth: true` (or a crease angle in degrees, default 40) shades by corner normals: faces that meet at a shallow angle share their normals, so a faceted surface looks round, and a 90 degree box corner stays sharp (`cornerNormals(mesh, degrees)` is the pure helper). `studio: true` replaces the single sun with three lights that follow the camera: key (upper left), fill (right, softer) and a rim light from behind that edges the shape (`studio: { fill, rim }` to tune). Both are off by default.

### Surfaces, picking, editing

- `pick(mesh, camera, x, y)` casts a real ray: face, point, normal, distance. `ray` is the inverse of `project`; `crosshair` builds a cross lying on the surface; `standOn` returns a prism standing on a picked surface.
- `validate(mesh)` returns text notes: closed shell, winding, planar and convex faces. `extrudeFace`, `moveVertices`, `extrude`, `rotate`, `merge`, `bounds` shape meshes.
- `boolean(a, b, op)` (also `union`, `subtract`, `intersect`) is solid modelling on BSP trees: faces are split by planes, so the result stays convex and planar. Both operands must be closed with outward faces; an open shell (a wall without thickness) is refused with the reason. With `{ strict: false }` the parts that are not closed solids are left out of the calculation instead (a union keeps them as they are, a subtract keeps those of `a`); `health(mesh)` is the check behind it: the connected parts, which are closed, and how many faces a boolean can work with. Face colours and materials are kept; cut faces take the colour of the cutting solid. The result is welded and T-junctions are repaired. A solid stays a solid: a result that is not a closed, consistently wound solid (numerical trouble with coincident faces) is thrown away and the operation is repeated with the second operand nudged by a tiny amount; if no try is sound it throws and the caller keeps the original.
- **Drawing on a mesh** (`wire.ts`): `insertVertex(mesh, face, point)` puts a vertex on a surface (inside a face it makes a triangle fan, on an edge it joins both faces), `cutFace(mesh, a, b)` cuts a face along a line between two of its vertices, `moveVertex(mesh, i, to)` moves one (polygons that use it become triangles, so faces stay planar), `fillLoop(mesh, loop)` closes a loop of vertices into a face, `addLine` and `findLoop` keep the wire (a list of vertex pairs). These are what the viewer's edit mode (`Q`, see [APP.md](APP.md)) uses.
- **HEXAW kernel.** The picking hot loop is also written in [HEXAW](https://github.com/Pengeszikra/hexaw) (`kernel/pick.hexaw`, 569 bytes of WebAssembly). `initKernel()` starts it; `kernel.pick` returns exactly what `pick` returns, 0.14 ms instead of 1.7 ms on 7200 faces. The module is embedded as base64 (`src/kernel-bytes.ts`), so the engine needs neither HEXAW nor a fetch at runtime. `npm run kernel` re-assembles it.

### Moving a humanoid

```js
import { humanoidRig, posed, walkPose, HUMANOID_POSES } from '3draft';

const meshes = scene.objects.map((o) => o.mesh);          // the body, and whatever he wears
const rig = humanoidRig(meshes);                            // { joints, skin }: read off the shape, nothing is stored in the model
const frame = posed(meshes, rig, walkPose(0.25), { ground: true }); // the same meshes, moved
const sitting = posed(meshes, rig, HUMANOID_POSES.sit, { ground: true });
const custom = posed(meshes, rig, { shoulderL: [0, 0, 1.2], elbowL: [-0.8, 0, 0], head: [0.2, 0.3, 0] });
```

- **The figure.** It stands on two feet that are parts of one mesh, looks to +z, and its arms hang apart from the trunk (a relaxed or A pose; a T pose is not understood). `humanoidRig` finds the crotch (the highest level under which the legs are still two pieces), the armpits (the same for the arms) and the neck (the narrowest level above the shoulders), and puts 15 joints there: `root`, `spine`, `head`, and per side (`L` is +x, his left) `shoulder`, `elbow`, `wrist`, `hip`, `knee`, `ankle`. It throws with the reason when it finds no figure.
- **Weights.** Every vertex gets `[[joint, share], ...]`: it follows the bone of its limb, blended over a short band at each joint. Other meshes and loose shells (hair, a hat, a watch) take the weights of the nearest point of the body. Because all of this is read off the shape, a figure edited by hand, or made by somebody else, moves without anyone rigging it.
- **A pose** is `{ jointName: [rx, ry, rz] }` in radians, relative to the bind pose, applied x, y, z in the parent's space. For hanging limbs: hip x < 0 swings the leg forward, knee x > 0 bends it, elbow x < 0 bends it, head x > 0 nods, `shoulderL` z > 0 / `shoulderR` z < 0 lifts the arm. `posed` only moves the points: faces keep their order, colour and material, and a face that the move bends (or folds) becomes triangles, so the result is still planar, convex and closed. `{ ground: true }` keeps the lowest point on the floor, `{ move }` shifts the figure. `posedJoints` gives the joint positions in a pose.
- **On the GPU.** For animation the bending is done by the GPU: pass the bind meshes once and only the joints' matrices per frame. `boneMatrices(rig, pose, { move })` gives 12 floats per joint (the same moves as `posed`), `poseLift(meshes, rig, pose)` the lift that `ground: true` would make, without building the meshes:

  ```js
  const lift = poseLift(meshes, rig, pose);
  gpu.render(scene, view, { fit, skin: { meshes, weights: rig.skin, bones: boneMatrices(rig, pose, { move: [0, lift, 0] }) } });
  ```

  Both renderers (`createGpu`, `createGl`) take `skin`: its vertices are built and uploaded once while the meshes stay the same objects, the shader moves every vertex by its four strongest joints (at most `MAX_BONES` = 64). Use `posed` when you need the bent meshes themselves (to keep a pose, to pick, for the SVG view).

**Pictures on faces.** Both renderers also take `screens: [{ corners: [tl, tr, br, bl], source: canvas, uv? }]`: every frame each canvas (another renderer's, a 2D canvas, an image bitmap) is copied into a texture and drawn on that quad, unlit and depth tested against the scene, so things in front hide it. The viewer uses it to play a scene on a face (a material's `scene`).
- **Ready poses:** `HUMANOID_POSES` (`bind`, `tpose`, `wave`, `sit`, `phone`) and `walkPose(t, { stride, run })`, one frame of a walk or run on the spot, `t` from 0 to 1.

`examples/betterman.js` moves the figure of `examples/betterman.scene.json` (one body mesh with per-face materials, the hair as a second object) and writes a pose sheet and a walk flip book to `examples/out/`.

Limits for now: the weights are per mesh as loaded, so recompute the rig after an edit; the walk is on the spot and the feet slide; hands have no fingers of their own. In the viewer this is pose mode (`J`, see [APP.md](APP.md)).

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

A single `app/index.html` plus a dependency-free static server. Person and AI work on the same scene: objects loaded from outside and objects made in the viewer are one model, `{ id, name, mesh }`. WebGPU view with an SVG fallback, a cross cursor on the surface, flying, materials, booleans, a move gizmo, isolate, travel, undo. It is also published as a Claude artifact whose shared database is the scene.

**How to use it, all keys and the database layout: [APP.md](APP.md).**

### Keys

**Moving and looking**

| Key | What it does |
|---|---|
| drag | turns the view (in target mode: moves the camera over the sphere round the target) |
| arrow keys | turn the view in steps |
| `W` / `S` | forward / back: speed levels, every press is one step more or less |
| `A` / `D` | left / right (speed levels) |
| `R` / `F` | up / down (speed levels) |
| `Space` | speed to zero (the target stays) |
| `/` | show only the model under the cross; again: the whole scene |

**Target mode**

| Key | What it does |
|---|---|
| `T` | target the object under the cross; with a target: another object re-targets, the target itself or empty space brings the camera back onto it; with no target over empty space: the nearest object |
| `Tab` / `Shift+Tab` | next / previous target (the first one when there is none) |
| `Esc` | let go; the camera stays where it is |
| `A D R F`, `W S`, drag | swing round the target, closer or farther (`W` stops at the surface) |

**Editing and objects**

| Key | What it does |
|---|---|
| `Q` | edit mode on / off |
| `V` | spider bar between two points; in edit mode: draw a line |
| `Enter` | edit mode: close a loop into a face |
| `B` | edit mode: turn the old `V` bars into lines |
| `1` / `2` / `3` | edit mode: move points / lines / faces |
| `M` | put a prism down; in isolated mode: shoot it (it carves) |
| `O` | boolean: mark two objects, then pick the operation |
| `X` | delete the object under the cross |
| `H` | move gizmo: 1st world axes, 2nd own axes, 3rd off |
| `J` | pose mode on a figure: `1`-`5` poses, `6` walk, `7` run, `Enter` keeps, `J` / `Esc` leaves |
| `U` / `Backspace` | undo |

**Material and look**

| Key | What it does |
|---|---|
| `P` | material palette (Shift+click paints a face, Shift+double click the whole object) |
| `I` | pick the material under the cross |
| `G` | SVG / WebGPU view |
| `C` | filmic look |
| `N` | smooth shading |
| `K` | studio light |
| `L` | turn the light |
| `E` | edges and points on / off |
| `?` | show / hide the key hints |

In edit mode `Esc` first stops the line being drawn, then leaves a move mode, then leaves edit mode (and keeps the target).

---

## 3. Engine and LLM

The engine is small enough to read whole (about 2000 lines) and everything it works with is text: meshes, palettes and scenes are JSON, previews are SVG, reports are sentences. That is the interface for an LLM:

- **Look.** The LLM renders a model to SVG and reads it (or the numbers in it), without a screenshot. `occlude` keeps the text small.
- **Check.** `validate` / `inspect` say in words what is wrong (open shell, inside-out faces, a non-planar face, which one), so the next edit is targeted.
- **Edit.** The same data goes back in: write documents, call tools, render again. Output is deterministic, so a change in the picture is a change in the model.
- **MCP server.** `mcp/server.js` (stdio, no dependencies) holds a scene of named objects and exposes it as tools: `add_box`, `add_extrusion`, `add_mesh`, `transform`, `boolean`, `recolor`, `remove`, `clear`, `get_mesh`, `extrude_face`, `move_vertices`, `list`, `inspect`, `render`, `pick`, `export`, `import`, `viewer`. It also serves the viewer and pushes every change to it, so a person watches the model grow. `claude mcp add 3draft -- node /absolute/path/to/3Draft/mcp/server.js`
- **Shared database.** In the artifact, the LLM and the person edit the same `objects` and `palette` collections, so either side can start from what the other made.

Y is up, the ground is y = 0, faces are counter-clockwise seen from outside.

Examples: `examples/table.js`, `examples/bridge.js` (50 named objects), `examples/cessna.js` (one mesh, 9 colours), and `examples/head.js` (a stylized head: 7 objects with their own palette, soft skin; try N and K), `examples/globe.js` (a globe: an ocean ball and seven continents, each one closed mesh), and `examples/house.js` (a house converted from Blender with `tools/blend/`, 45 objects, approximate colours), and `examples/betterman.js` (a low poly man that walks: see Moving a humanoid).

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


## UI

The viewer has a control-panel look (black ground, cream/teal/red keycaps). **?** (or the Keys button) opens an interactive key explainer: hover or tap a key to read what it does (always / target / isolated / edit mode), press a real key to see it light up, **run this key** performs it. **Z** (or Zen) hides everything but the model; Z or Esc brings the UI back. The layout is responsive and never leaves the screen.
