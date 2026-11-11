# 3Draft viewer: how to use it

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
| `O` | boolean (see below) |
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

## Boolean operations (`O`)

Press `O` over an object: it gets an orange box. Press `O` over another one (green box): a small question asks which operation to run.

| key | operation |
| --- | --- |
| `1` | union |
| `2` | A − B (A is the orange one) |
| `3` | B − A |
| `4` | intersect |
| `5`, `Esc` | cancel |

The result is a new object named like `A-B` and it replaces both operands; `U` brings the two originals back and removes the result. `O` over empty space forgets a marked object.

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

`7` (or the **store** switch) opens the store as a second 3D view on the left, a third of the width; the build keeps the rest. The store is this same page loaded in an iframe with `?store` (`EMBED` in the code): a separate engine with its own objects, undo steps and camera, so no data is copied between the two. The keyboard focus follows the pointer (and a click): over the store the keys go there, over the build they come back; a teal frame marks the focused view. The two talk by `postMessage` (same origin only): `focus`, `store-toggle` (7 in the store closes it) and `brush` (the targeted model, base middle at the origin) and `drag-start` / `drag-move` / `drag-end` / `drag-cancel` (drag and drop: Alt+press an object in the store; the pointer is captured, so it can leave the pane; the build moves its cursor to the pointer and, on `drag-end` over its own area, puts a copy down on the surface under it: the grabbed point projected to the floor (y = 0) of the store is the origin of the new object, put on the hit point; the store freezes while it is carried; the model's up turned to the surface normal by the shortest turn). On the phone layout the store takes the top 38% of the screen.
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

## Loop cut (edit mode, `Ctrl+R`)

Select a line (`2`), press Ctrl+R: every four-sided face on the ring through that line splits in two, with new points on the ring's lines. It is modal like `G`: type a number for the count of cuts (default 1), move the pointer along the line to slide the cuts (clamped inside the faces), `Enter` confirms, `Esc` cancels. The new loop stays selected, so `G`/`S` act on it at once. Undo restores the mesh.

## Fill (edit mode, `F`)

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

A material with an `url` (the palette's url field; the built-in `monitor` has one) is a screen: on every four-cornered face made of it the page runs in an iframe. The iframe is a DOM layer over the picture (`#screens`), warped onto the face with a CSS `matrix3d` (a perspective map of the face's four corners, up is the world up, the face's own up when it lies flat). Limits: it is not part of the 3D picture (no depth against other objects, so something standing in front does not hide it, and no light), it does not show in a VR view, faces seen from behind or behind the eye are hidden, at most 6 screens at once, the pointer goes through it until you take control of it (below), and sites that forbid framing (X-Frame-Options, CSP) stay blank. Only http(s) addresses are taken. Faces with another number of corners are plain surfaces. **Control:** double-click a screen and the page gets the pointer and the keys; the camera stays where it is. A `network` module appears after `sys` in the console: `exit`, an on / off switch (off blanks that screen, the monitor stays dark) and the page address, a link that opens it in a new tab. A press outside the page, `exit` or Esc (when the focus is not inside the page) gives the control back to the 3D view.

## Saving scenes

The `scene` panel has one list for adding a scene: the examples, and under `saved here` what was saved in this browser. Choosing an entry adds it next to what is there (like the examples; `clear` first to start from it). Below the list: a name box and **save** (stores the whole scene under that name in this browser's local storage; an empty name gets a dated one), **file ↓** (downloads it as `name.json`), **file ↑** (adds a scene from a `.json` file) and **✕** (forgets the saved scene whose name is in the box). A scene file is `{ format: "3draft-scene", version: 1, name, palette: [the materials its faces use], objects: [{ name, mesh, wire? }] }`, the same shape as an example scene. Materials the palette lacks come along (screens keep their url). Not saved: the camera, the point clouds and flying prisms; instanced objects (the stars) are saved as the meshes they have at that moment. Local storage is per browser and per address, and about 5 MB; for anything bigger use the file.
