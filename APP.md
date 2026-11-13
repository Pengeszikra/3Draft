# 3Draft viewer: how to use it

> **Developer handover (read this first if you are the next model or person working here).** Everything below the line is the user manual of the viewer; this block is what you need to *change* it.

## Working on 3Draft: handover

3Draft is a minimalist, AI-first 3D engine (TypeScript, built to plain JS) plus a one-file viewer. It is developed together with two sibling repos by two collaborators (models) taking turns on the same project:

| Repo | Branch | What it is |
|---|---|---|
| `Pengeszikra/3Draft` (this) | `main` | engine `src/*.ts` -> committed `dist/`, viewer `app/index.html`, docs `app/help.md` + this file |
| `Pengeszikra/Spider-Paint` | `master` | static PWA, the viewer re-skinned; loads the engine from jsDelivr pinned to a 3Draft commit. See its `APP.md` |
| `Pengeszikra/five-percent` | `main` | VR competition entry (Meta Start Developer Competition 2026). See its `APP.md` |

The owner is Hungarian and talks to the assistant in Hungarian; code, comments, commit messages and docs are English.

### Layout

- `src/*.ts` engine, one concern per file, a `*.test.ts` beside it: `mesh/vec/types` (data), `edit` (`reshape`, `moveVertexSet`, `extrudeFace`, `outlineOf`), `saw`, `csg` (booleans), `bevel`, `lathe`, `text` (stroke font -> solid letters), `pick` (+ WASM kernel from `kernel/pick.hexaw`), `camera`, `svg`/`gpu`/`gl` renderers, `check` (`validate`, `health`), `material`, `place`, `wire`, `rig` (humanoid skeleton and weights read off a shape, `posed`, `walkPose`: README "Moving a humanoid"; the viewer's pose mode `J` uses it). Everything public is exported from `src/index.ts`.
- `dist/` is **committed** (the viewer and jsDelivr read it). Never edit it by hand; `npm run build` makes it.
- `app/index.html` the whole viewer in one file (inline module script, no bundler). `app/help.md` is the in-app help page (Markdown). `app/serve.js` a localhost static server.
- `examples/` generator scripts and `*.scene.json` scenes; `mcp/` an MCP server that lets an LLM build live in the viewer; `tools/blend` Blender helpers.

### Mesh rules the engine relies on

`{ positions: Vec3[], faces: [{ v: number[], color?, mat? }] }`, y up. Faces are **planar, convex and CCW seen from outside**. A solid is *closed* (every edge used twice, once per direction). `validate(mesh)` reports `closed`, `inside_out`, `nonConvexFaces`; run it on anything you generate. New operations must keep these rules (split non-convex results, keep outward winding, keep `color`/`mat` on the faces they came from).

### Commands

```sh
npm test         # builds, then runs every dist/**/*.test.js (+ examples, mcp, scripts); must be green
npm run build    # src -> dist (scripts/build.mjs); build:check verifies dist is current
npm run bump     # date version YY.M.DNNN into package.json + src/version.ts (once per change shipped)
npm run app      # viewer at http://localhost:5173/app/
```

### The release routine (do this after every change that ships)

1. `npm run bump`, `npm run build`, `npm test`.
2. Commit and push `main`. Commit messages are short and end with the attribution lines your session was given (`Co-Authored-By: ...`, `Claude-Session: ...`).
3. In `Spider-Paint`: `git pull`, `node scripts/sync.mjs ../3draft` (check it prints `Spider Paint <- 3Draft <hash>`), raise `CACHE` in `sw.js` by one, commit, push `master`.
4. If `sync.mjs` stops with `step "..." did not match`, you changed a line the sync rewrites: fix the step in `Spider-Paint/scripts/sync.mjs`, never hand-edit its `index.html`.
5. Document user-visible features in `app/help.md` and a section below; engine API in the README.

### How the viewer is organised (`app/index.html`)

- Camera: `fit`, `gcam`, fly keys, FOV easing (`eyeInScene`). Edit mode: `emode` (`draw|vertex|edge|face|saw|lathe`), `sel {kind, items}` (edges are sorted `[a,b]`, faces keyed by `faceKey`), `editing` is the object being edited; mutate it only through `commit/change/create`, which also push an undo step onto `history`.
- Modal transforms share one state `xf` (`grab|rotate|scale|loop|bevel`): `startXf(kind, extra)` -> `xfUpdate()` on every pointer move/key -> `xfConfirm()` (one `change` + one undo entry) or `xfCancel()`. A new modal tool = a new kind plus a branch in `xfUpdate`. Typed digits give an exact value; `X/Y/Z` lock an axis. Wrap multi-object edits in `asOneStep`.
- Keys are handled in `editKey`; always `preventDefault` for Ctrl combos the browser owns (Ctrl+R/E/B/D).
- A text model carries `text` + `textFrame`; double click re-opens the text box.

### Testing the viewer without a human

Playwright Chromium with software GL works: launch with `--use-gl=swiftshader --enable-unsafe-swiftshader`, open `http://localhost:5173/app/?gl&debug`, blur the focused button (`document.activeElement.blur()`) or shortcuts are swallowed, then drive keys/mouse. `?debug` exposes `window.__3draft` with `state()`, `edit()` (mode, selection size, active `xf`), `objects()`, `meshes()`, `screen(kind, i)` (stage pixel of a face/vertex/edge to click) and `load(scene)`. Press `q` for edit mode, `1/2/3` points/lines/faces, `u` undo. A static server started in one shell call may die before the next: start it and run the test in the same call. Recorded sessions (`?play=<url>`, `rec`/`play` in the console) replay human input, see "Record and play".

### Conventions

- No new runtime dependencies. The engine is dependency-free.
- Prefer exact, small, tested geometry functions in `src/` over logic in the viewer; the viewer only wires UI.
- Do not start roadmap items (play mode, store/assets, physics, walk/drive, extra views, double-sided faces, real-time AI modelling) without the owner confirming.
- Hand-offs: leave the tree committed and pushed, tests green, and say in your last message what changed and what is half done.

---


The viewer is the human side of 3Draft: a person and an AI look at, and edit, the same scene. The engine is described in the [README](README.md); this page is only about the app.

```sh
npm run app     # http://localhost:5173/app/   (repo only, not in the npm package)
```

It is one file, `app/index.html`, plus a dependency-free static server (`app/serve.js`, localhost only). The same page is published as a Claude artifact, where the scene lives in a shared database. When the MCP server serves it, everything the AI builds appears live.

## The view

- **Starting view: WebGPU.** If WebGPU is unavailable, or the GPU device is lost, the app falls back to SVG by itself and says so in the footer (`9` or the `WebGPU` button switches by hand). SVG shows colour and transparency only; WebGPU also shows metal, roughness and emission. **Glow** (`C`) turns the emitting materials (`emit` above 0.05, like `lamp`) into local light sources: nearby emitting faces merge into one light (up to 16, the brightest kept) whose reach grows with the emitting area, and it lights the surfaces around it with a smooth falloff, without shadows. With `light` off only these lights (and the emission itself) show. The old filmic shader path (`tonemap` option) stays in the engine, the console no longer switches it. **Smooth** (`N`) shades faces that meet at less than 40 degrees as one round surface (box corners stay sharp), and **Studio** (`K`) lights the model with a key, a fill and a rim light that follow the camera; both are on at the start (WebGPU view only). The palette's `soft` slider gives a material skin-like light: it wraps round the form, with a warm band where light turns to shade.
- **The drawing fills the stage.** On a desktop it covers the whole area; on a phone it is a little larger than the short side.
- **Drag** rotates, **double click** resets the view, the arrow keys rotate too.
- **The cross** follows the pointer and lies on the surface under it. The cursor is always a cross. On a phone, with no mouse, it aims at the middle.
- **Footer:** yaw, pitch, fly speed, which code answers picking (`pick hexaw` = the WebAssembly kernel), object count, live link, and the face under the cross.

## Keys

| key | does |
| --- | --- |
| `w a s d r f` | fly: forward, left, back, right, up, down. Every press is a speed step; the opposite key slows down. In edit mode these need `Shift` (the plain keys are edit keys) |
| `Space` | stop moving (all speeds to zero) |
| `T` | target the object under the cross (see Target mode); with no target, `T` over empty space targets the nearest object. `Tab` next target (the first one when none), `Esc` let go |
| `/` | show only the object under the cross; again: the whole scene, and the camera flies back to where it was |
| `M` | place a prism on the surface under the cross, or shoot one into empty space. **In isolated mode (`/`) it fires a bullet** instead: a prism that starts at the camera point and flies along the ray through the cursor, so its long axis is always the view direction and you always see its back; if it hits the isolated object it sinks half its length and carves that part out (A − B, the cut is made of the selected material, `U` undoes it); if it misses it flies on to 4 times the camera-to-model distance and vanishes. Only the closed parts of the model are carved; open parts are ignored (see the health check below). A carve never leaves a crack: if the result would not be a closed solid it is retried with a hair's shift, and if that fails too the model stays as it was (the note "left as it was" shows). |
| `Q` | edit mode on the object under the cross (or the target); with neither, a new 1×1×1 m cube of the selected material standing in front of the eye with its base middle as the origin; again: off (see below) |
| `V` | Spider bar (in edit mode: a sketch line, or a saw point in the saw mode): the first `V` remembers a surface point, the second joins the two with a thin prism (a quarter of the base of a placed one) made of the selected material. `V` over empty space forgets the first point |
| `Shift+X`, `Delete` | delete the object under the cross (every mode) |
| `U`, `Backspace` | undo: placing, deleting, painting, booleans and moves, one step at a time |
| `P` | show / hide the material palette |
| `I` | pick material: the material of the face under the cross becomes the selected one |
| `Ctrl` + press (`Cmd` on a Mac) | paint the face under the cross with the selected material (palette must be on) |
| `Ctrl` / `Cmd` + double click | paint the whole object |
| `B` / `B B` | select objects: drag a box / draw a lasso round them (Shift adds, Esc clears); then `G`, `G G`, `R`, `S` move them together (see below) |
| `H` | move gizmo (see below) |
| `E` | edges and points on / off (also the `Edges` button) |
| `C` | glow on / off: emitting materials light their surroundings (also the `Glow` button; WebGPU and WebGL2 views) |
| `N` | smooth shading on / off (the `Smooth` button; on at the start, WebGPU view only) |
| `K` | studio light (key, fill, rim; follows the camera) on / off (the `Studio` button; on at the start, WebGPU view only) |
| `9`, `L` | SVG / WebGPU, turn the light |
| `?` | show / hide these shortcuts under the view (hidden at the start; also the `Keys` button) |

## Clear and example models

- **`Clear`** (footer) removes every object in the scene. It is one undo step: `U` brings them all back.
- **`+ Example…`** (the drop-down in the footer) adds a ready-made model to the scene: the house (the Blender import, 45 objects), the Cessna, the stone bridge or the table. It is placed beside what is already there, on its +x side, and the view frames everything. One `U` removes the whole example again. Examples are normal objects after that: paint, move, boolean and delete them like any other.

## Moving an object: the gizmo (`H`)

There is one gizmo at a time, and `H` cycles through three states:

1. **First `H`**: the gizmo appears on the object under the cross, on the world axes (x red, y green, z blue).
2. **Second `H`**: it turns to the object's own axes. Objects carry no transform, so these come from the shape: y stays up, x and z follow the turn around y that fits the footprint best (an object that already lines up with the world axes looks the same in both states).
3. **Third `H`**: the gizmo goes away.

Drag one of the arrows to slide the object along that axis; the arrow thickens under the pointer. While dragging only the picture changes; one write goes to the database when you let go, and one `U` takes the whole drag back.

## Edit mode: the workbench (`Q`)

Edit mode is a separate place from the fly-through. Put the cross on an object and press `Q`: that object becomes the **active, editable one**. Nothing moves and every other object stays visible. The object's **local origin is the middle of its base** (its lowest point, the centre of x and z); the grid (the x axis red, the z axis blue) lies in the plane under it there, and the camera looks at that point. Distances are in **metres** (no light years). `Q` again leaves: the camera goes back to where it was. `U` inside edit mode stops at the start of the session. `Reset view` / double click frame the active object. Points are drawn as dots (bigger and orange when selected). A plain white label at the top names the object and shows the mode as chips (`sketch (V)`, `points (1)`, `lines (2)`, `faces (3)`, `saw (4)`); its `?` button shows or hides the help (hidden at the start).

Keys in edit mode:

| key | does |
| --- | --- |
| `V` | sketch lines on the surface (any number; marks only, nothing happens yet; `U` takes the last one back). In the saw mode: a saw point |
| `1` `2` `3` | select **points / lines / faces**: click one, `Shift`+click adds one or takes it away, a click on nothing clears. There is no gizmo |
| `A`, `A A` | select everything (in the point, line or face mode); a quick second `A` clears the selection |
| `G` | **grab** the selection: it follows the pointer on the plane that faces the camera. `X`, `Y` or `Z` locks it to that world axis (the same key again lets go); a typed number is exact (`G X 0.25 Enter` = a quarter of a metre along x; `-` flips the sign) |
| `S` | **scale** the selection about its centre. `X`, `Y`, `Z` scales along that world axis only; a typed number is the factor |
| `E` | **extrude** the selected faces (face mode): they are pushed out and then grabbed along their normal (type metres, or move the pointer). Faces that touch each other are extruded one by one for now |
| `4` | the saw (below) |
| `Shift+X`, `Delete` | delete the object under the cross (edit mode carries on with another object on the bench, or ends); plain `X` only locks the axis during G / S |
| `Shift` + `W A S D R F` | fly (the plain keys are edit keys here) |
| `Ctrl` / `Cmd` + click | paint a face |
| `Esc` | forget the saw points or the sketch chain; then back to sketching; then leave edit mode. During a grab / scale / extrude: cancel |

During `G`, `S` and `E` the move is live: **a click or `Enter` confirms, `Esc` or a right click cancels**, and it is one `U` step. Faces stay flat: a polygon stays one polygon whenever the move leaves it flat (a whole face moved, scaled or stretched, the sides of an extrusion); only a face that would be bent becomes triangles.

- **The saw (`4`).** Only in this mode does `V` saw. One cut at a time. `V` puts a point (on a vertex, or on the surface), up to three:
  - **two points** are a line drawn on a face: the saw plane contains the line and stands **square on that face**, so it runs straight into the material and out beyond the ends of the line. Both points must lie on one face.
  - **three points** are a triangle: the saw plane is the plane of the three points (a slanted cut, a mitre).
  - The plane is previewed as an orange outline where it meets the object. `Enter` cuts, `Esc` forgets the points. The cut object is replaced by closed solids (two, or more when the plane splits an odd shape into several pieces), named `prism-xxxx` with a fresh short id each (an object that is not a prism keeps its name plus a short id); the new faces take the material of the face that was sawn (the one the points were put on) and lie exactly in the plane (no kerf, no triangle sprinkles). The pieces stay where they were, on the bench: move them apart with `G`. One `U` puts the original back. You stay in edit mode, on the first piece, so the next cut can follow at once. Only closed solids can be sawn. The engine part is `saw`, `planeThroughLine`, `planeThroughTriangle`, `sectionSegments`.

## Selecting objects (`B`, `B B`) and moving them together

`B` then drag: a box; `B` twice quickly then drag: a lasso. An object is taken when the middle of its bounding box falls inside on the screen; a plain drag replaces the selection, Shift adds; Esc stops the drag, or clears the selection. Selected objects get a teal box (`picked`, ids in the order taken). With a selection, `G` grabs them all, `G G` places them as one (the foot from their common bounding box, opposite where the pointer held one of them; Ctrl+D copies the whole group and the copies become the selection), `R` turns them round the vertical axis through their middle, `S` sizes them from there (`Shift+R` / `Shift+S` still fly); X Y Z and typed numbers as usual. In the code a group is a stand-in object (`groupObj`: one mesh made of all theirs, `members`); `startXf` with `group` keeps each member's place in it, `xfUpdate` moves the points rigidly (`movedRigid`, no reshape) and `spreadGroup` hands the slices back; `xfConfirm` is one undo step for the whole group. `window.__3draft.select(names)` selects by name, for tests.

## Boolean operations (the **bool** button)

Select two objects (`B`, Shift adds the second), then the **bool** button (SYS group): the first one taken is A (orange box), the second B (green box), and a small question asks which operation to run.

| key | operation |
| --- | --- |
| `1` | union |
| `2` | A − B (A is the orange one) |
| `3` | B − A |
| `4` | intersect |
| `5`, `Esc` | cancel |

The result is a new object named like `A-B` and it replaces both operands; `U` brings the two originals back and removes the result. (`O` no longer does this.)

The math is the engine's `boolean(a, b, op)` (README, part 1). Only closed parts are calculated: a part that is not a closed solid (a surface, a box without a bottom) is left out, and a union keeps it as it is. The status line under the picture is the **health check** of the object under the cross: `solid`, `N of M parts closed · K faces open`, or `no closed part`. Each object needs at least one **closed solid with outward faces**; with none, the reason shows in the dialog. With messy data (coincident faces) the result can come out open; the engine's `validate` says so.

## Materials (`P`)

Twelve starting materials: plaster, sand, wood, dark wood, concrete, slate, grass, brick, steel, gold, glass, lamp. Pick one, then `Ctrl`+press (`Cmd` on a Mac) to paint a face or `Ctrl`+double click for the whole object.

**Pick material (`I`, or the `pick` button):** the eyedropper. `I` takes the material of the face under the cross. The `pick` button arms it, and the next click on a surface takes it (`Esc` cancels). The palette opens and that material is selected, so you can read its sliders or paint with it right away. A face that has only a colour selects the material with that colour, or starts a new material from it.

For the selected material there are five sliders (`metal`, `rough`, `alpha`, `soft`, 0 to 1, and `emit`, 0 to 5) and a colour; `+ new` copies it as a new material. A painted face stores the material **name**, so editing a material changes every face made of it.

## Isolating, travelling

`/` hides everything but the object under the cross and frames it. The camera pose from before is remembered and restored when you leave. 
### Target mode

The HUD in the top left corner shows the object under the cross (name, distance, face count) and the target.

- `T` on an object **targets** it: the camera turns to face it and from then on moves on an imaginary sphere round it, always looking at its centre. `A`/`D` swing it sideways, `R`/`F` up and down (speed levels, like everywhere), `W`/`S` change the distance (`W` stops at the object's surface), and dragging the mouse turns it over the same sphere.
- `T` on another object re-targets; `T` on the target or over empty space brings the camera back onto the target. There is no travel: `W` flies there.
- `Tab` switches to the next object (`Shift+Tab`: previous). `Space` only sets the speed to zero. `Esc` lets go, and the camera then stays exactly where it is.

## Phone

Four round buttons cover the main actions: travel, place, delete, and the view mode. Drag rotates; the cross aims at the middle of the screen.

## One object model and the database

Objects that come from outside (the database, the MCP server) and objects made in the app are the same thing: `{ id, name, mesh }`. Painting, deleting, isolating, booleans, moving and undo work on all of them, whoever made them. With the artifact database every change is written back, so the AI sees what the person did.

Collections:

- `objects`: one document per object, `{ name, mesh }`, at most 256 KiB each.
- `palette`: one document per material, `{ color, metal, rough, alpha, emit, order }`.

Undo is a per-session stack in the page; it does not reach back past a reload.

## Two views, two engines: build and store (`7`)

`7` (or the **store** switch) opens the store as a second 3D view on the left, a third of the width; the build keeps the rest. The store is this same page loaded in an iframe with `?store` (`EMBED` in the code): a separate engine with its own objects, undo steps and camera, so no data is copied between the two. The keyboard focus follows the pointer (and a click): over the store the keys go there, over the build they come back; a teal frame marks the focused view. The two talk by `postMessage` (same origin only): `focus`, `store-toggle` (7 in the store closes it) and `brush` (the targeted model, base middle at the origin) and `brush-place` (G G on an object in the store: the model with its foot at the origin and its up turned to +y; the build makes a copy floating under its pointer and starts place mode with it; the old Alt+drag drag-and-drop is gone, its `drag-*` messages are still understood).

**Place mode** (`placing`, an `xf` whose `place` is that state): `G G` outside edit mode (`lastG` keeps the first G's hit; a second G within 450 ms on the same object) turns the grab into it; `footOf(mesh, point, normal)` gives the foot (the bounding box point opposite the grabbed point, along the axis nearest the hit normal) and the up. Phase `float`: grab puts the foot on the pointer's ray at `dist` (`rayPoint`); the pointer's own pick ignores the placed model. A press where the pointer's ray meets nothing of `place.rest` (during a grab) orbits the view as usual (`last` is set, `pointermove` turns instead of updating the grab); otherwise a click (`placeClick`) sticks it (phase `stick`: grab picks `place.rest`, the scene without it, puts the foot on the hit point and turns the step's mesh by `turnBetween(n, hit.normal)`; nothing under the pointer: it slides on the plane through the foot) or unsticks it (float again, `dist` from the eye to the foot); during R / S a click takes the step. Every boundary (`placeCarry`) pushes `{ mesh, foot, n, phase, dist, kind }` on `steps`; `G R S` (`placeStep`) start the next operation from the mesh as it is; `Esc` / right click (`placeUndo`) pops a step, with none left it cancels (`xfCancel` to `orig`; a model made for placing is erased and its create step dropped); `Enter` (`placeDone`) is one `change` from `orig`; `Ctrl+D` (`placeCopy`) keeps it and starts placing a floating copy. `window.__3draft.placeBrush(name, mesh)` does what G G in the store does, `__3draft.place()` reports the state. On the phone layout the store takes the top 38% of the screen.
- The store starts with loose timber stock lying on the floor: `lath`, `board`, `plank`, `beam`, `plywood` (the `wood` material, 2 m long). It lives in this visit only (no db, a fresh stock each time it opens) and has no buttons of its own: you can edit, saw or add to it like any scene.
- In the store: target an object (`T`): it becomes the **model of `M`**, when you press `M` there. In the build, `M` puts a copy of that model down (base middle at the cross, or on the cursor ray over empty space), each press one `U` step. A chip next to the place button names the model; click it to go back to the plain prism.

## Side panels, modals and the help page

The material palette (`P`) and the help page (`?` or the console's ? button) are **vertical side panels** on the right, one at a time (the desktop console lies over their foot); `Esc` or ✕ closes them, and they do not block the view. The keyboard map is the only modal (a link inside the help; a tap on the scrim or `Esc` closes it). The palette has its own colour picker (a saturation / brightness square, a hue slider and a hex field) instead of the browser's, which is unusable on a phone.

## The desktop console

On a desktop window the 3D view fills the whole window. A dark **console** lies over its bottom edge (about two or three lines high, chamfered, with engraved group labels and a few LEDs); the readouts (yaw, pitch, speed, pick, objects, view, live) are one quiet line at the top, the title and version in the corners. The phone / installed-app layout is unchanged.

- **Switches** (edges, view, glow, smooth, studio, freeze) are real toggles; the action buttons are icons (hover for the tooltip); **?** opens the help, the key explainer with every mode and key.
- **Two panels:** the standard console shows `view` (two rows of switches: freeze, view mode, edges, light, palette / store, smooth, studio, glow, edit (red while editing); light off = no lighting, only emission and edges; a switch is blue when on), `scene` (examples, clear). Place, delete and target (M, ⇧X, T) have no console buttons any more: they act on what the pointer is over, so they live on the keys and the phone pad (the old buttons stay in the page, hidden, for the code that updates them); in edit mode these are replaced by an `edit` panel: points / lines / faces / saw (1–4), move / scale / extrude (G S E), delete (⇧X), done (Q). Each button presses its key.
- **Marks in the GPU:** in the WebGPU and WebGL2 views the editor's marks (points, lines, selection, sketch, saw, snap, gizmo axes, the cross) are drawn by the GPU itself (`marks` render option, `buildMarks`: round-capped screen-space segments over the picture), not by an SVG layer. The SVG view still draws them as SVG.
- **Keys are data:** `ACTIONS` (what the program can do) and `KEYMAP` (which key does it) are plain objects, also on `window`; `bindKey('q', 'scene')` rebinds a key, `bindKey('q')` frees it. The console buttons call the actions directly, so they work whatever the keys are. A mode or a user setting can swap `KEYMAP` as a whole.

On the phone layout the console is hidden; the **Exa** menu has a `store` button at its top (the same switch as `B`). If the page script never runs (the engine did not load), a red note appears after 8 seconds instead of a blank view.

## The help page is Markdown

`app/help.md` is the help: edit that file and the side panel follows (no source change; a tiny renderer in the page turns headings, lists, tables, code, bold, italic and links into HTML). Spider-Paint gets a copy of it from `scripts/sync.mjs`.

## Rotate in edit mode (`R`)

`R` turns the selection like `G` and `S` move and scale it: about the middle of the selected **points** or **faces** (a face selection turns about its normal, points about the viewing direction); with a selected **line** that line is the axis, and the other selected parts turn about it (the whole object when the line is all that is selected). `X`, `Y`, `Z` turn it about that world axis through the pivot, a typed number is degrees, the pointer going round the pivot on the screen turns it, click or Enter confirms, Esc cancels. Flying with R needs Shift.

## Editing from inside

`enterEdit` checks whether the eye (`eyeNow()`) is inside the object's bounding box; then `bench.stay` is set and neither `enterEdit` nor `leaveEdit` calls `goTo` (no framing on the way in, no return on the way out).

## Point clouds (the Milky Way)

A scene's `cloud` (and objects with `cloud: <name>` from `cloudProtos`) is drawn by a WebGL2 point layer of its own (`drawCloud`, screen blend over the picture). Each point stays one clean, sharp point at any distance (1.3 to 2.4 px, a little brighter as it comes closer, never a growing blob and never split up); below 1.3 px far away it dims with its area. Only very close (its natural radius over 400 px) does it fade, where the real neighbourhood stars stand.

## Deep sky (the stress test) and galaxies as recipes

`examples/deepsky.js` -> `deepsky.scene.json` (2 MB): the Milky Way's stored cloud (29 650 points, from `milkyway.js`), **1000 galaxies**, **400 black holes**, **3000 stars**. Data: `examples/data/deepsky-data.js`, generated by `examples/data/build-deepsky.mjs` from HYG v4.1 and OpenNGC (both CC BY-SA 4.0; clone the two GitHub repos, the command is in the script head), plus `stars5000.js` and the curated `galaxies.js`.
- Galaxies: the curated nearby list (real distances) first, then the brightest OpenNGC galaxies with a recession velocity over 1000 km/s (distance = v / 70 km/s/Mpc, 47 to 494 Mly), diameter from the major axis, the disc turned by the catalogue axis ratio (inclination) and position angle (`rotFor`; which side faces us is a coin toss). The Hubble type picks the recipe (`recipe`: arm count, pitch, bar, flattening; S0 is a fat lens).
- Black holes: Sagittarius A*, 15 known stellar ones of the Milky Way and LMC X-1 / X-3 (rounded literature positions), and the central black holes of the 382 biggest S/E galaxies (scale 0.0008 of the galaxy radius like Sgr A*, x2 for ellipticals; M87*, M31*, Centaurus A*, M104* by name).
- Stars: the nearest 1000 (HYG) and 2000 notable farther ones (named first, then Bayer / Flamsteed, by brightness; 50 to ~3200 ly). `starObject(row, { boost })` in `stars.js`; `boost` widens the glow of luminous far stars (`0.08·L^0.4` ly).

A scene object may carry **`galaxy`** (a recipe: `kind` S/E/I/D, `seed`, optional `n`, `arms`, `pitch`, `armShare`, `bar`, `b`, `c`, `clumps`) instead of `cloud: <name>`. The engine's `galaxyPoints(recipe)` (`src/galaxy.ts`) samples the same points every time (unit frame, radius 1, disc in x-z). The points come out shuffled (any first part is an even sample). In deepsky every galaxy gets points in proportion to its diameter, as many as the Milky Way's cloud at its size (`30000 · kly / 90`, x0.6 irregular, x0.4 dwarf, 300 to 60 000; Andromeda ~50 700). The viewer samples a galaxy only while it is at least `LIVE_PX` = 12 px on screen (`liveGalaxies`, run from `drawCloud`): the biggest `LIVE_MAX` = 64 within `LIVE_POINTS` = 1.2 M drawn points; below `LIVE_FULL_PX` = 300 px only 1/2 … 1/32 of its points are drawn (each brighter by the square root of the share); new samples up to `LIVE_GEN` = 80 000 points per frame (the rest on the next frames); an LRU cache by recipe of `LIVE_CACHE_POINTS` = 3 M points; drawn from a second buffer of the cloud layer. A point's radius is the Milky Way's (~`LIVE_POINT_LY` = 140 ly for its ~45 000 ly radius) grown in proportion to the galaxy (never below 140 ly), so two galaxies of the same size on screen shine alike; it follows the live instance (`at`, `scale`, `rot`), so a moved galaxy takes its points along. The glow gives way to the points as for `cloud`.

Big-scene measures (found with this test): a solid below `LOD_NONE` = 0.3 px (a galaxy's invisible ghost below `LOD_GHOST` = 4 px) is left out of the merged scene (a one-point mesh stands in; its glow still shows); with more than `LOD_BIG` = 600 instances the levels change at most every `LOD_EVERY` = 150 ms; at most `HOLE_MAX` = 4 holes are traced (the biggest on screen), the rest keep the glow. In a big scene the spheres keep coarser levels (`LOD_STEPS_BIG` = [120, 45, 16, 4] px instead of [60, 22, 8, 3]; coarser shows the 4x2 level as visible diamonds). **Picking runs in a Web Worker** for scenes of `PICK_ASYNC_FACES` = 4000 faces and up (not while editing or placing, where the hit must be exact in the same frame): the worker is made from a Blob (`PICK_WORKER_SRC`) that imports the engine from `ENGINE_URL` (Spider-Paint's sync rewrites it to the jsDelivr URL) and runs the HEXAW kernel there; the main thread transfers the flat merged scene when it changes and asks the pointer's ray each frame (one question in flight, the newest wins, the answer used one frame later). An answer for an older scene is kept for an object whose mesh is unchanged (its face index is moved by the owner tables of the versions). Errors are caught in the worker and posted back: kept in `picker.errors` (last 20; `__3draft.picker()`), logged as `[pick worker] …`, and the pick label shows `⚠n`; a crashed or hung worker (`PICK_HANG_MS` = 5000) is restarted up to three times, then picking falls back to the main thread. `?nopickworker` turns it off; `__3draft.pickFault()` sends a broken question to test the error path. `ballOf` of an instance left out of the scene uses its `at` and core size, so T on it frames it right.
`__3draft.sky()` (debug) reports live galaxies, points, cache, traced holes, the last frame's CPU ms, rebuild count and the scene's faces. The remaining cost is the rebuild itself (the whole scene merged, uploaded and triangulated again when levels change, ~25 ms with ~28 000 faces near the Sun); GPU instancing of the prototypes would remove it.

## Aiming: by the middle for far space objects, `pickable: false`

Two halves (`aimAt`, `pickTarget`, the pick block of the frame):
- **Not aimed at (O).** An object with `pickable: false` is left out of the pick scene (`pickTarget`: the merged scene without those objects and without the galaxies' stand-ins, with a face map back to the scene; the object being edited is always in). The pointer sees through it, so you can model inside a clear block (water, jelly). O toggles it on the selection, the target or the object under the cross; Shift+O makes every object aimable again; one undo step; saved in the scene file and the db doc (`pickable: false`).
- **By the middle.** An instance with a glow (star, black hole, galaxy) is aimed at by how near its projected middle is to the pointer, not by its surface. Stars and black holes: a circle of `PICK_MIN` = 5 px, growing with the solid (2x its radius on screen) up to `PICK_MAX` = 16 px; from `PICK_SOLID` = 14 px on screen the surface is aimed at as for any model (the hole's disc is never in the mesh). Galaxies: a circle of their own size on screen (at least 5 px) up to `PICK_GALAXY_SHARE` = 1/4 of the screen; bigger, they are not aimed at, so the pointer reaches their black hole. A star or hole in front of a galaxy wins over it; one inside it (its own black hole) does not while the galaxy can be aimed at. The aimed object becomes `aim` ({ obj, point = its middle, normal = to the eye, face −1, px, depth }) and `hit` is null then (no surface work through it); a surface hit in front of the middle wins. `hitObj()` is what every targeting user reads (T, Tab, G, Q, X, H, /, the HUD); surface work (paint, shoot, spider, edit snapping, the cross) still reads `hit`. Four short 45° ticks in the corners of the aim circle mark it (GPU marks, `cursor`). Galaxy ghosts are now never in the scene at all. Debug: `__3draft.aim()`, `__3draft.under()`, `__3draft.locked()`.

## Tab order

`nextTarget` cycles a round taken by `tabOrder` when the round starts (no target, or a target not in the round, e.g. set by T): the objects in the field of view first, by screen distance from the middle, then the others by distance from the eye. The round is kept while Tab goes on (turning onto a target does not reshuffle it); the first Tab of a round takes the first object (skipping the current target). Tab with no target starts a round too (it no longer falls back to T's nearest object).

## Start scene and the flight readout

The page starts with the **deep sky** scene (start next to the Sun, `SUN_START` from `stars.js`, shared by stars, stars-plain, milkyway and deepsky; the Milky Way's outside view is still exported as `start` from milkyway.js) (`startScene`, loaded right after the first frame; `?empty` starts empty; `?play`, `?show` and an artifact keep their own start). Leaving the page does not ask while the starting scene is untouched. The flight readout (top right) has, under the set speed, a line `v⃗ … · ω …°/s`: the eye's measured speed in space (every cause: levels, cruise, orbit swing, gravity) and how fast the view turns, from `measureMotion` once a frame (smoothed, reset after a 0.5 s pause). Note: `stepFly` caps a frame's step at 50 ms, so at a low frame rate the measured speed is below the set one (it shows what really happens).

## Space scale: the starship camera

`space()` = the **vehicle** is `'starship'` and not editing. The vehicle (`vehicle`, `setVehicle`) is chosen in the select next to the scene list (– / starship / car) or comes from the scene file's `vehicle` field (the star scenes have `vehicle: 'starship'`; saved scenes keep it); a scene loaded alone without the field gets a guess (a point cloud or 50+ glowing instances: starship); clearing the scene sets none. Leaving the starship ends orbit, gravity, steering, cruise and the braking program. The HUD's light years follow the starship too (before: 100+ objects with a Sun). Then the camera is a starship: only its own speed (the fly levels) moves it. T / Tab (`lookAt`) do not glide or stop: they enter fly mode, keep the speed levels and start `steer` ({ all: true }); `steerTo` (from `stepFly`) turns yaw / pitch towards the target at `STEER_RATE` = 3/s round the eye (the pivot is re-placed FLY_DIST ahead, so the eye never jumps). After the first turn it steers only while the target is within `STEER_AHEAD` = 80° of the heading, and once the target is behind while flying forward (e.g. the pilot took the stick and flew past) the target is let go (`letGo`, the speed stays). In space the target is marked with the same four 45° ticks as the aim (`ticksAt`, round its ball on screen; short ticks of 4–12 px), not the box bracket. W/S/A/D/R/F stay speed levels with a target too; a drag stops the steering; Esc lets go but keeps the speed (outside space it still stops). **Braking program** (`brake`, from `stepFly` while locked in space): closing in on the target, `throttle` (a factor on the levels' speed) is eased down (`BRAKE_RATE` = 4/s) so the ship is at least `BRAKE_S` = 2 s from its stopping point at its speed, hard-capped at `BRAKE_HARD` = 0.6 s; the last stretch goes no slower than `BRAKE_MIN` = 0.5 ly/s or four times the distance left per second, and at `BRAKE_HOLD` = 1.05 radii from the target's middle (at its surface: a star's ball, a galaxy's bounding sphere; like the old approach's STOP; `arrive`) the ship stands: levels, throttle, cruise to rest. It never flies through the target. It stays on while there is a target: a speed key (W/S/A/D/R/F) only sets throttle 1 and the program brakes from there, so with a target the ship never flies into or through it (also after arriving); Esc lets the target go (then free flight); Space resets it. The HUD shows the set speed (levels × throttle + cruise). A double click (normally `reset`, the whole-scene framing, which in a star map throws the ship light years away) targets instead (`travelTo`). The lens is fixed at `SPACE_FOV` = 60° (no easing between the fly and target lenses). `__3draft.flight()` (debug) reports it. Outside space scale the old target orbit (`stepTarget`, sphere round the target, W approaches and stops at STOP radii) is unchanged.

## Space orbit and gravity mode (0 / ö)

`toggleOrbit` (action `orbit`, keys `0` and `ö`), only in space. Note: the camera helper imported from the engine as `orbit` is renamed `orbitView` / `orbit_` in the viewer; `orbit` is the state here.
- **With a target:** `orbit = { phase: 'brake' }`: the ship brakes hard (`ORBIT_BRAKE` = 6/s on the throttle and the cruise) while it keeps turning onto the target; at a standstill `'arm'`: ORBIT blinks under the speed for `ORBIT_ARM_MS` = 1 s; then `'on'`: the old target orbit (`stepTarget`: fit centred on the target, the eye where it is; W/S distance, A/D R/F swing). The target's four ticks turn UV green (`ORBIT_GREEN`) and turn 90° round their own middles (tangential) in 0.6 s. 0 again leaves: a swing (A/D R/F levels) is turned into `cruise` (ly/s in the ship's frame: right = swing speed × distance, up likewise) and gravity mode starts round the target's middle; without a swing the ship just stands.
- **Without a target:** no braking; the nearest object in view (`tabOrder` filtered to the view, nearest to the eye) becomes the gravity origin and the ship's own velocity swings it (`startGravity`; nothing happens without a speed across the radius). 0 with gravity and no target lets the gravity go.
- **Gravity mode** (`gravity = { origin, n, name }`, `stepGravity`): the heading turns round the orbit normal n at ω = (velocity along the orbit, `n × r`) / r (`turnHeading`, Rodrigues, the eye fixed); the velocity (levels × throttle + cruise) is in the ship's frame, so it turns with the heading: the ship circles at the same speed. Only the velocity along the orbit feeds it: slowing that part (S, the opposite A/D, or a T/Tab turn that points the speed elsewhere; a turn may also feed it) lowers ω, and at zero (or reversed) gravity ends and the ship flies straight on. HUD: `GRAVITY · <origin>`.
- **Space** ends orbit and gravity and stops (`stop` clears cruise too); Esc / letting go of the target ends the orbit (back to flying); T / Tab leave the orbit (the starship turns). `__3draft.flight()` reports orbit, gravity, cruise.

## The car (vehicle 'car')

`drive()` = vehicle `'car'` and not editing; `stepCar` runs instead of the fly step (`stepFly`). 1 unit = 1 metre. The car (`car = { p, heading, v, steer, throttle, … }`, started from where the eye is when the vehicle is chosen: the ground under the eye) keeps to the ground: `groundAt` finds the highest not-steep triangle under the car (a grid over x-z of `pickTarget().mesh`'s triangles, `buildGround`, built once per scene; walls with |n_y| < 0.1 left out; triangles over more than 1024 cells in a list looked at always; no kernel: a big map does not fit its memory) below a probe `CAR_STEP` = 1.5 m above the car, so it climbs slopes and kerbs and drives under roofs; houses are not hit. Speed: throttle > 0 accelerates `CAR_ACCEL` = 3.5 m/s² × throttle × (1 − v / `CAR_TOP`), so never above 50 m/s; throttle < 0 brakes `CAR_BRAKE` = 9 m/s² × |throttle|; at zero throttle the speed stays (no drag; the let-go gas springs to zero, so the car cruises); no reverse yet. Turn: bicycle model, wheelbase `CAR_BASE` = 2.7 m, wheels up to `CAR_STEER` = 0.6 rad, but at speed less: full lock is limited so a turn never asks more than `CAR_GRIP` = 6 m/s² sideways (tan δ ≤ grip · base / v²: at 100 km/h about 1.2°), so the same wheel position steers gentler the faster you go and the car does not spin. A Mac trackpad's momentum (wheel events going on after the fingers lift, ever smaller) is not taken as the hand: after `MOMENTUM_RUN` = 4 shrinking deltas in a row on an axis that axis counts as let go (`padRun`). The eye is `CAR_EYE` = 1.3 m above the ground, looking along the heading; a drag looks round (`lookYaw`, `lookPitch`; it does not steer), and when the button is let go (`carLookHeld`) the look turns back to straight ahead (`CAR_LOOK_BACK` = 0.4 s, `CAR_LOOK_PITCH` = −0.05 rad). The fly keys do nothing in the car.
Controls (sensitivity and spring-back set by the four sliders of the drive group, `carTune`, kept in localStorage `3draft.carTune`: trackpad pixels for full lock (280, slider 50–550; half below `CAR_SLOW` = 10 km/h, `steerGain`), for full gas / full brake (750, slider 100–1400), and the seconds the let-go wheel (0.45) and the let-go gas / brake (0.05) take to come back to ~5 %; these defaults were tuned by hand on a Mac trackpad; beside a slider only its unit, the value in its tooltip; a touch-screen finger pixel counts `CAR_TOUCH` = 1.67), neither held all the time: a trackpad's two-finger swipe (`wheel` events, taken on the window in the capture phase, so the pointer may be anywhere but over a list, a text box, the side panel or the palette; the steering-wheel gauge flashes green when one arrives: deltaX the wheel, deltaY the throttle; with natural scrolling fingers right = right, fingers up = more gas) or two fingers on a touch screen (capture-phase pointer handlers: the fingers' mean move; the wheel is held while both are down). The steering wheel stays where it is while held (a wheel event within `CAR_HOLD_MS` = 200 ms, or two touching fingers) and turns back to the middle after; down past zero the throttle brakes; let go, the gas and the brake come back to zero. HUD: km/h, wheel angle, gas. The **drive** gauges after sys in the console: a steering wheel turned 3× the wheels' angle, a throttle bar (green up, red down = brake), the numbers; dimmed unless the vehicle is the car; "brake n%" in red. While driving (`drive()`), `body.car` hides the sys group. Debug: `__3draft.flight().car`. (A 160 000-face terrain: the grid builds in about a second, a frame stays a few ms.) The main-thread kernel pick of the pointer falls back to the JS pick for good if the kernel runs out of memory (`kernelFull`). Meant as the test of the coming VR controls.

## WebXR (immersive-vr), first step

The **xr** group in the console (after drive): **enter VR** / exit VR and a note (the buttons pressed, the right stick's axes). `toggleXr`: needs `navigator.xr` (on a Mac: the Meta Immersive Web Emulator Chrome extension) and `isSessionSupported('immersive-vr')`; switches to the WebGL2 view if needed (`setMode('gl')`; the mode before is given back at the end), `requestSession('immersive-vr', { optionalFeatures: ['local-floor'] })`, `makeXRCompatible`, an `XRWebGLLayer` from the WebGL2 renderer's context (`Gpu.context`, new), `depthNear` 0.05, `depthFar` 1e5, a `'local'` reference space. From then on the session's `requestAnimationFrame` runs everything (`xrFrame`; the window's `redraw` does nothing while `xrState.session`): the controllers, one `drawFrame` (moves, the desktop picture, which leaves the renderer's arguments in `xrArgs`), then each XR view: `gpu.render(scene, view, { ...xrArgs.opts, xr: { framebuffer, viewport, projection, view, eye } })`.
- Engine: `GpuRenderOptions.xr` (`GpuXrEye`, WebGL2 renderer): draws into the given framebuffer and viewport (scissored, so the eyes clear only their own part), with vp = projection × view (`mul4`, exported), the camera axes from the view matrix's rows and `eye` for the lighting / glass sort; the canvas keeps its size; marks are not drawn.
- The rig: scene point = rotY(−yaw) · headset point + origin; origin = the eye of the scene (`eyeNow()`; in the car its driver's eye), yaw = the view's yaw (the car's heading). The head moves only the view; the eye's scene position goes to the renderer. 1 headset metre = 1 scene unit.
- Controllers (`xrPads`): any pressed button tints the sky green for 150 ms, shows in the note (`r0` = right hand, button 0) and is logged (`[xr] pressed`, `[xr] select`). The right stick drives the car (`xrDrive`, xr-standard axes 2 / 3, dead zone 0.15): sideways turns the wheel at `XR_STEER_RATE` = 1.5 full locks per second (held while deflected, back to the middle when let go, `carTune.steerBack`); up / down changes the gas at `XR_GAS_RATE` = 0.8 per second, and it stays where it is with the stick in the middle (`car.gasLatch`; the trackpad's gas still springs back).
- Not in the headset yet: the glow sprites, the point cloud, the black-hole tracer (their own canvases), the HUD and marks. Tested with a fake `navigator.xr` (two eyes side by side, head yaw, a right controller): both eyes drawn, the view turns with the head, a button tints the sky, the stick drives the car, the end gives the desktop view back. `__3draft.xr()` (debug).

## The black hole

An instance whose `core` material is `bh-core` (Sagittarius A* in the Milky Way and the stars scenes) is drawn by a small ray tracer on its own WebGL2 layer (`drawHoles`, premultiplied alpha over the picture): per pixel a ray from the eye, in the hole's units (the ball's radius = the horizon = 1), bends with the cheap Schwarzschild step `v -= 1.5·h²·p / r⁵ · dt` (up to 150 steps, within `HOLE_REACH` = 15 radii); a ray into the black ball (`HOLE_CORE` = 2.75 radii, out to the disc's inner edge; the bending stays that of a horizon of 1) is the shadow, a crossing of the disc plane (axis from `rot`, `holeAxis`) within `HOLE_DISC` = [2.85, 13] radii adds the disc (Gargantua-like: wide and thin, clumpy gas from value-noise fbm sheared along the orbit, bluish-white inside to warm white outside, as hot gas really looks; a Doppler factor makes the approaching side brighter and bluer, the receding side dimmer and redder), a ray that grazed the photon sphere (1.5) adds the photon ring. Cost: only the square round the hole is computed (scissor), at half resolution, and nothing below 6 px (the glow sprite stays then; above it the glow is skipped). The layer lies under the star cloud (which is screen-blended over it, so stars in front of the hole still show); the cloud shader hides its points that are farther than the hole and inside its shadow on screen (`uHole`: `HOLE_SHADOW` = 3.7 horizon radii). The prototype's flat disc is taken out of the mesh (`applyLod`), the black ball stays for picking and targeting. Static (no animation), so it costs nothing while the view stands still. The glow layer hides glows behind a hole inside its shadow (`HOLE_SHADOW` horizon radii on screen, a soft rim; `drawGlow`'s `shade`), as the cloud shader hides points there. The hole's centre is passed eye-relative (doubles on the CPU), so a hole 50 million light years away keeps its precision; the gas noise is periodic round the disc (`pfbm`), so there is no seam.

## Zoom

The wheel on the stage sets `zoomGoal` (×0.25 to ×30; a pinch, a wheel with Ctrl, goes faster; the page itself never zooms); `zoomNow` eases to it in `draw`, and the lens is `2·atan(tan(fovNow / 2) / zoomNow)` in `shown_fit.fov`, so picking, the instances' level of detail and the skeleton's size all follow. The cross is divided by the zoom (same size on screen). `=` / `ó` (`resetZoom`) sets the goal back to 1. A wheel event whose `deltaX` outweighs its `deltaY` is a sideways one: `orbitPointer(angle)` turns the whole camera rig round the vertical line through `hit.point` (the surface under the cursor; `fit.center` over empty space): `fit.center` is rotated round that line and `yaw` grows by the same angle, so the pointed point stays where it is on screen. During a bevel the wheel still sets its segments. `__3draft.state().zoom` reports it.

## Loader

`withLoader(label, run)` shows `#loader` (a CSS-turned ring and `loading <name>…`) over the stage, waits two animation frames so it is painted before the heavy part, runs `run`, and hides it when the outermost one ends (nested calls are counted). `loadScene` and `addExample` use it, so every way in (the list, file ↑, saved scenes, the starting scene, `?ply`) shows it; not in a scene screen (`SHOW`).

## Leaving by accident

Outside the store and the scene screens (`!EMBED && !SHOW`): `beforeunload` asks when there are objects or undo steps (`history`, the undo list, shadows `window.history`, hence `window.history.pushState`); a `{ stay: true }` history entry is pushed at start and again on every `popstate`, so the first back only shows "back again to leave" (`noteObj`) and a second one within 2 s really goes back; `overscroll-behavior: none` on `html, body` stops the trackpad's back swipe.

## Bevel (edit mode, `Ctrl+B`)
Select lines (`2`), Ctrl+B: modal like `G`. The pointer's distance from where it started is the width (a typed number is metres), the wheel or ArrowUp/ArrowDown the segments (1-16). `bevel(mesh, lines, width, segments)` (`src/bevel.ts`) turns each line shared by two faces into a strip of `segments` quads along a quadratic profile, fills corners (a point with one untouched face is cut off, otherwise a patch), and holds the width back at 0.45 of the shortest slide; it returns `{ mesh, remap, width }` and throws if the surface is open round a line's ends. `Enter` confirms (one undo step), `Esc` cancels.

## Loop cut (edit mode, `Ctrl+R`)

Select a line (`2`), press Ctrl+R: every four-sided face on the ring through that line splits in two, with new points on the ring's lines. It is modal like `G`: type a number for the count of cuts (default 1), move the pointer along the line to slide the cuts (clamped inside the faces), `Enter` confirms, `Esc` cancels. The new loop stays selected, so `G`/`S` act on it at once. Undo restores the mesh.

## Fill (edit mode, `F`)

`B` / `B B` in edit mode use the same box / lasso (`startSelect`, `endSelect`): with `editing` set, `endSelect` selects in the current `emode` (points whose projection is inside, lines with both ends inside, faces whose middle is inside; no occlusion test), Shift adding to `sel`.

`M` (`mirrorWait`, then optional `-`, then `X Y Z`: `startMirror(k, neg)`) is an `xf` of kind `mirror` (`xf.mirror = { k, neg, d0, d, faces, wire }`): the faces whose points are all selected (and the selected lines) are first cut at the plane (`mirrorPreview` clips each selected face against it, Sutherland-Hodgman, new points on the plane shared per edge; lines too, so nothing reaches over it) and the kept part is copied across `coord k = d` (reversed, so it faces out; points on the plane are shared by both halves, so the seam is closed before any welding), `d` starts at the selection's max (min with `-`) along the axis and follows `axisDistance` or a typed shift (`mirrorPreview`). `Enter` runs `mirrorWeld` in `xfConfirm`: points within a millionth of the size become one, faces with the same point set (back to back on the plane) are dropped, unused points go, `mergeFlat` (engine, exported from `src/text.ts`, with an `edge` filter) joins coplanar pairs whose shared edges lie on the plane, and points left straight in the middle of a side on the plane are dropped; the bar reports welded / gone / joined and `validate`'s closed. The plane is drawn as a magenta square mark.

`Alt+N` (`flipNormals`, matched on `e.code === 'KeyN'` because Option+N types a character on a Mac) reverses the winding of the selected faces, or of every face when none is selected: the faces then face the other side (a screen shows on the side its winding faces). One `U` step.

`F` makes one new face of the selected **points** (or the points of the selected **lines**): they are ordered round their middle in their own plane, the face is wound so that it faces away from the middle of the object, and it takes the material of a neighbouring face (else the palette's). It closes a hole in a solid. It needs three or more points that do not lie on a line. One `U` step. Flying down with F needs Shift.

Concave outlines (an L, a V, a star) are filled too: the lines are **followed** instead of the points being ordered by angle (`outlineOf` in `src/wire.ts`). The selected lines, or for selected points the open lines of the mesh between them, make a graph; the walk starts at the outermost point and at a junction goes on where the direction turns least (the tangent rule of Rustroke's fill). With no closed walk it falls back to the angle order, which is right for any convex outline. A face may be concave: every consumer (the GPU / WebGL vertex list, the kernel's pick triangles, `pick`, `nearestSurface`, the faces `moveVertex` / `reshape` split) cuts it with `triangulate` (`src/triangulate.ts`): a fan for a convex polygon, ear clipping for a concave one, so no triangle lies outside the outline.

## Object grab, duplicate, delete (every mode)

`G` outside edit mode grabs the whole target (`T`) or the object under the cross, with the same `X`/`Y`/`Z` axis locks and typed metres as in edit mode (the same modal code, `startXf` with an `obj`). `Ctrl+D` makes a copy as a new model (not an instance; also from edit mode, which it leaves) and grabs it at once; Esc leaves the copy where the original is. Delete is `Shift+X` (or `Delete`) in every mode; plain `X` only locks the axis during a grab, scale or rotate.

## Extrude points and lines, build the sketch (edit mode)

`E` extrudes whatever is selected and grabs it at once (`startXf` with `wire0` / `fixFaces`): a point (`1`) becomes a line (a new point joined to it by a sketch line, `wire`), a line (`2`) becomes a four-sided face whose new line is selected, so `E` again goes on; neighbours in the selection share their new points. The face turns to show its front to the camera while you pull. Undo restores mesh and lines in one step.

Key `5` is the sketch mode (`emode` `draw`). `V` draws lines on the surface (`obj.lines`); `Enter` (or `5` again) turns them into the mesh. Lines that follow on from each other form a chain. A chain of four or more points whose last point is within a third of the mean stroke of its first (or exactly on it) is closed: it becomes a face, wound away from the middle of the object, in the current material, reusing the vertices that already exist at its points. Any other chain becomes `wire` lines. The faces are selected afterwards.

## Smooth shading follows the material's soft

The Smooth switch (`N`) rounds the shading of shallow folds (up to 40°), but only where the materials allow it: a face's `soft` of 0 keeps all its edges hard, `soft` 0.5 and above allows the whole 40°, between them the angle grows in step (`cornerNormals(mesh, crease, soft)`); between two faces the harder one rules.

## Delete in edit mode

`Shift+X` with a selection deletes only that (`deleteSelection`): points go with the faces and lines that use them (and are removed from the vertex list), a line goes with the faces on it, a face goes alone. One undo step. With nothing selected it deletes the object under the cross, as everywhere.

## Sketch faces and paint, refined

The faces `5` builds are put a hair (0.4% of the object's radius) above the surface, outward, with new points of their own, and take the selected material. Ctrl (Cmd) + press paints a face; two presses within 450 ms paint the whole model (counted in `pointerdown`, because a Ctrl+click on a Mac is a right click and never sends `dblclick`).

## Paint by hovering (Alt+Ctrl)

With the palette open, holding `Alt`+`Ctrl` (`Cmd` on a Mac) paints every face the pointer passes over with the selected material, no click needed, in edit mode as well (`scrub`, driven by the hit of each frame). One stroke, until Alt or Ctrl is let go, is one undo step.

## Record and play

`rec` / `play` in the console (sys group): a recording is JSON `{ format: '3draft-recording', version: 1, seed, view: [w, h], start: { materials, current, toggles }, duration, events: [{ t, e, ... }] }`. Events are the trusted `pointerdown/move/up/cancel`, `keydown/up`, `wheel`, `click`, `dblclick`, `contextmenu`, `input`, `change` (target as a CSS path, pointer positions in window pixels, modifiers `c s a m`). Mouse moves are thinned to ~12 ms, the newest dropped one is kept before the next other event.

Play clears the scene (and the undo history), restores the palette and switches, seeds `Math.random`, then dispatches synthetic events at their times (gaps over 3 s cut, a frame is let to draw between a move and the next key so the cross is known). Pointer capture is faked while playing and real input is blocked. Prisms still flying in are waited for. The saved palette is not written during a play.

API: `rec.start()`, `rec.stop()` → recording, `rec.play(data, { speed, cap })` → `{ done, total, stopped }`, `rec.stopPlay()`, `rec.scene()` (fingerprint), `rec.last`, `?play=<url>`.

## Saw and boolean with concave and loose shells

`saw` cuts a model of several shells shell by shell: every closed shell is sawn on its own, a shell the plane misses (or one that is not closed) goes whole to the side its middle is on; it still throws when there is no closed shell at all. The BSP of `boolean` / `saw` takes a concave face as the triangles of its ear clipping (`polysOf` in `src/csg.ts`). `E` on a free face (a sketch outline: none of its lines is shared with another face) keeps the old face as a reversed back, so what is pulled out is a closed shell that can be sawn.

## Console layout, edge lines, palette

Every console group hangs from the same top line; `view` is first, so it stays put when edit mode swaps `make` and `scene` for `edit`. `edit` (1 2 3 4 5 Q / G S R E F ⇧X), `view` (freeze, view, edges, light, palette / store, smooth, studio, glow) and `sys` (undo, reset, zen, help / rec, play) are two rows each (`.grp.rows` with `.row`). `light` is a switch: every press (or `L`) turns the sun a step of 45°, it is on while the sun is turned from its start. `rec` is red.

`edges` (the E switch) works in the GPU views too: `render({ edges: true })` draws the face edges (`buildEdges` / `sceneEdges` in `src/gpu.ts`, each vertex pair once, cached per part, none above 300 000 faces) as 1-pixel `line-list` / `gl.LINES` after the solid faces, dark at 40% alpha, depth tested with a hair of nudge towards the eye so a line wins against the face it lies on.

With the palette open (`body.pal`, desktop) the view, the top line and the console get narrower by the width of the panel (`--palR`) instead of staying behind it; on the phone layout the panel still covers the view.

## Screen material

A material with an `url` (the palette's url field; the built-in `monitor` has one) is a screen: on every four-cornered face made of it the page runs in an iframe. The iframe is a DOM layer over the picture (`#screens`), warped onto the face with a CSS `matrix3d` (a perspective map of the face's four corners, up is the world up, the face's own up when it lies flat). In the WebGPU / WebGL2 view the page sits behind the 3D picture, and the picture is see-through exactly where the screen face shows (a hole the GPU punches with the depth test), so whatever stands in front of the screen hides it, pixel for pixel; the page is still a live page (scripts, scrolling). Limits: no light on it, it does not show in a VR view (in the SVG view it lies over the picture, unhidden), faces seen from behind or behind the eye are hidden, at most 6 screens at once, the pointer goes through it until you take control of it (below), and sites that forbid framing (X-Frame-Options, CSP) stay blank. Only http(s) addresses are taken. Faces with another number of corners are plain surfaces. **Control:** double-click a screen and the page gets the pointer and the keys; the camera stays where it is. A `network` module appears after `sys` in the console: `exit`, an on / off switch (off blanks that screen, the monitor stays dark) and the page address, a link that opens it in a new tab. A press outside the page, `exit` or Esc (when the focus is not inside the page) gives the control back to the 3D view.

**Page screens behind the canvas:** in a GPU view `#screens` has `z-index: -1` inside the isolated `#frame` (`.ctl`, while a page has the control: in front), both renderers' canvases are premultiplied-alpha, and `sceneScreens()` adds `{ corners, hole: true }` for the same faces `drawScreens` gives iframes (first 6 page faces, not off, facing, in front of the eye; `screenKey`); the engine draws a hole as a depth-tested quad writing transparent pixels (`fsh` / `GL_FRAG_HOLE`).

**Scene screen** (`material.scene`): a `.json` address in the url field (`sceneAddr`) is stored as `scene`. In a GPU view `sceneScreens()` (called once per frame, before the render) finds the four-cornered faces of such materials, gives each scene file a *spot* (`sceneSpots`: its own `createGl` on a canvas not in the page, the merged meshes and palette of the file, framed at 0.7 of the bounding radius) and renders it square (`SCREEN_PX`, turning by `SHOW_SPIN`), framed wider for a wide face; the main renderer gets `screens: [{ corners, source: spot.canvas, uv }]` (engine: `GpuScreen`, a textured quad depth tested like a face, unlit; corners from `screenCorners`, moved a hair along the normal). A scene used on several faces is drawn once per frame; while any is shown the view keeps redrawing. In the SVG view `drawScreens` falls back to the iframe player: `showUrl(scene)` = this page with `?show=<absolute address>`; with `SHOW` set the page is `body.zen.show`, fetches the file, `loadScene(data, true)`, forces `applyView({ light: true, edges: false })`, frames `overview()` at 0.8 and turns `yaw` by `SHOW_SPIN` in `draw`; it skips the starting scene, the shared database, the live link, `?ply` and scene screens. `window.__3draft.open(data)` loads a scene file the way `file ↑` does, `__3draft.screens()` reports the backend, iframes and spots.

## Saving scenes

The `scene` panel has one list for adding a scene: the examples, and under `saved here` what was saved in this browser. Choosing an entry loads it: with the `merge` switch on (the default, remembered) it is added next to what is there, with `merge` off the scene is cleared first and the loaded one stands alone (U twice brings the old one back: the load, then the clear). It holds for the examples and `file ↑` too. Below the list: a name box and **save** (stores the whole scene under that name in this browser's local storage; an empty name gets a dated one), **file ↓** (downloads it as `name.json`), **file ↑** (adds a scene from a `.json` file) and **✕** (forgets the saved scene whose name is in the box). A scene file is `{ format: "3draft-scene", version: 1, name, palette: [the materials its faces use], objects: [{ name, mesh, wire? }] }`, the same shape as an example scene. Materials the palette lacks come along (screens keep their url). Not saved: the camera, the point clouds and flying prisms; instanced objects (the stars) are saved as the meshes they have at that moment. Local storage is per browser and per address, and about 5 MB; for anything bigger use the file.

**View in the scene file.** A scene is saved with its view: `view: { render, edges, light, glow, smooth, studio, cam }` (the view switches and the camera; `render` is the renderer, `webgpu`, `webgl2` or `svg`: a missing WebGPU falls back to WebGL2, the installed app stays on the GPU). Freeze, store, palette and edit are about the work, not the look, and are not saved. It is applied when the scene stands alone (`merge` off, or nothing was in the scene); a merged scene keeps the view you have. The edges start off.

**`?ply=name`** opens the scene saved here under that name at once, alone, with its view, in zen. Without such a saved scene the page starts as usual.

## Text
Edit mode, a face selected (3), **T**: asks for the words and makes a new model out of them (`text-xxxx`), standing out of the face in the active material. The face gives the lower-left start corner, the reading direction (world up on the face; on a floor: away from the viewer) and the letter height. The font is `src/text.ts`: data, poly-lines on a 2 × 4 grid, every stroke a bar; stroke and depth are 20 % of the letter height. The model carries `text` and `textFrame` (saved in scenes), and T on a text model fixes the words in place. The engine exports `textMesh`, `faceFrame`, `GLYPHS`.

## Lathe
Edit mode, a face selected, **6**: the face's plane (its `faceFrame`) is the drawing board, its bottom line the axis. V puts contour points, Enter asks for the segments (>= 4, Enter on its own = 7) and `lathe(contour, frame, segments, { mat, color })` (`src/lathe.ts`) turns the `[u, r]` contour round the axis into one closed mesh with outward faces; a tip on the axis is a point, an end off it gets a disc. The result is a new model.

## Pose mode (`J`)

`J` on the object under the cross (or the target) starts pose mode (`enterPose`): `figureOf` takes that object as the body and adds the objects lying inside its box (padded by 12% of its height) as what it wears, `humanoidRig` reads the skeleton and weights off those meshes (a refusal is shown as a note, `hintPose`), and `posing = { objs, bind, rig, name, anim, phase, joints }` holds the mode. `showPose(pose)` stores the pose, its lift (`poseLift`, so the lowest point stays on the floor), the bone matrices (`boneMatrices`) and the joints. In a GPU view (`skinned()`) the figure is a **GPU skin**: the objects keep their bind meshes, `rebuild` leaves them out of the scene, and the renderer gets `skin: skinNow()` (bind meshes, `rig.skin`, bones), so a walk frame only uploads the 15 matrices. In the SVG view `posedMesh(i)` bends the meshes on the CPU (`posed`) and puts them on the objects. Switching the view (or losing the GPU) re-runs `showPose`. The skeleton marks scale with the figure's height on screen (`rigPixels`: joint dots 2-6 px, bones 0.75-2 px) and are not drawn under `RIG_HIDE_PX` (180 CSS px). It is a preview like a grab, nothing is written; while skinned the cross does not hit the figure (it is not in the picked scene). `poseKey` runs before every other key while the mode is on: `1`-`5` the ready poses (`HUMANOID_POSES`), `6` / `7` walk / run (`poseTick`, a `requestAnimationFrame` loop over `walkPose`, held by freeze), `Enter` keeps (`leavePose(true)`: the CPU bends the meshes once with `posed`, then one `change` per object inside `asOneStep`, so one undo step), `J` / `Esc` leaves and restores the bind meshes; the keys that would change the figure (`Q G M O V H U Shift+X`) are held back with a note. The skeleton is two marks (`bones`, `joints`). The console's `pose` group (`.only-pose`, shown by `body.posing`) presses the same keys. `window.__3draft.pose()` / `.hint()` are the test hooks. Not there yet: the phone pad has no pose buttons, joints cannot be turned by hand, a walk does not travel, and a pose is not saved in a scene other than as the kept shape.
