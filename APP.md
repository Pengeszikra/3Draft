# 3Draft viewer: how to use it

The viewer is the human side of 3Draft: a person and an AI look at, and edit, the same scene. The engine is described in the [README](README.md); this page is only about the app.

```sh
npm run app     # http://localhost:5173/app/   (repo only, not in the npm package)
```

It is one file, `app/index.html`, plus a dependency-free static server (`app/serve.js`, localhost only). The same page is published as a Claude artifact, where the scene lives in a shared database. When the MCP server serves it, everything the AI builds appears live.

## The view

- **Starting view: WebGPU.** If WebGPU is unavailable, or the GPU device is lost, the app falls back to SVG by itself and says so in the footer (`G` or the `WebGPU` button switches by hand). SVG shows colour and transparency only; WebGPU also shows metal, roughness and emission. The **filmic look** (`C`) adds linear light, Fresnel and tone mapping, so highlights roll off softly and `lamp`-like materials glow; switch it off for the plain flat look. **Smooth** (`N`) shades faces that meet at less than 40 degrees as one round surface (box corners stay sharp), and **Studio** (`K`) lights the model with a key, a fill and a rim light that follow the camera; both are on at the start (WebGPU view only). The palette's `soft` slider gives a material skin-like light: it wraps round the form, with a warm band where light turns to shade.
- **The drawing fills the stage.** On a desktop it covers the whole area; on a phone it is a little larger than the short side.
- **Drag** rotates, **double click** resets the view, the arrow keys rotate too.
- **The cross** follows the pointer and lies on the surface under it. The cursor is always a cross. On a phone, with no mouse, it aims at the middle.
- **Footer:** yaw, pitch, fly speed, which code answers picking (`pick hexaw` = the WebAssembly kernel), object count, live link, and the face under the cross.

## Keys

| key | does |
| --- | --- |
| `w a s d r f` | fly: forward, left, back, right, up, down. Every press is a speed step; the opposite key slows down |
| `Space` | stop moving (all speeds to zero) |
| `T` | target the object under the cross (see Target mode); with no target, `T` over empty space targets the nearest object. `Tab` next target (the first one when none), `Esc` let go |
| `/` | show only the object under the cross; again: the whole scene, and the camera flies back to where it was |
| `M` | place a prism on the surface under the cross, or shoot one into empty space. **In isolated mode (`/`) it fires a bullet** instead: a prism that starts at the camera point and flies along the ray through the cursor, so its long axis is always the view direction and you always see its back; if it hits the isolated object it sinks half its length and carves that part out (A − B, the cut is made of the selected material, `U` undoes it); if it misses it flies on to 4 times the camera-to-model distance and vanishes. Only the closed parts of the model are carved; open parts are ignored (see the health check below). A carve never leaves a crack: if the result would not be a closed solid it is retried with a hair's shift, and if that fails too the model stays as it was (the note "left as it was" shows). |
| `Q` | edit mode on the object under the cross / off (see below) |
| `V` | Spider bar (in edit mode: a sketch line, or a saw point in the saw mode): the first `V` remembers a surface point, the second joins the two with a thin prism (a quarter of the base of a placed one) made of the selected material. `V` over empty space forgets the first point |
| `X`, `Delete` | delete the object under the cross |
| `U`, `Backspace` | undo: placing, deleting, painting, booleans and moves, one step at a time |
| `P` | show / hide the material palette |
| `I` | pick material: the material of the face under the cross becomes the selected one |
| `Shift` + press | paint the face under the cross with the selected material (palette must be on) |
| `Shift` + double click | paint the whole object |
| `O` | boolean (see below) |
| `H` | move gizmo (see below) |
| `E` | edges and points on / off (also the `Edges` button) |
| `C` | filmic look on / off (also the `Filmic` button; on at the start, WebGPU view only) |
| `N` | smooth shading on / off (the `Smooth` button; on at the start, WebGPU view only) |
| `K` | studio light (key, fill, rim; follows the camera) on / off (the `Studio` button; on at the start, WebGPU view only) |
| `G`, `L` | SVG / WebGPU, turn the light |
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

## Edit mode: sawing and shaping a model (`Q`)

The idea: there is a base model, and you work on it like a piece of stock on the bench. Put the cross on an object and press `Q`. A red bar at the top says which object is being edited and in which mode; its `?` button shows or hides the edit help (hidden at the start). Its vertices show as small grey crosses.

- **Sketch lines (the mode you start in).** `V` puts a point (a vertex the pointer snaps to, or a spot on the surface); the next `V` draws a line from the last point to the new one, and the chain goes on. Any number of lines. They are only marks for now: the mesh does not change, they are not saved, and one `U` takes the last one back. `Esc` ends the chain.
- **The saw (`4`).** Only in this mode does `V` saw. One cut at a time. `V` puts a point (on a vertex, or on the surface), up to three:
  - **two points** are a line drawn on a face: the saw plane contains the line and stands **square on that face**, so it runs straight into the material and out beyond the ends of the line. Both points must lie on one face.
  - **three points** are a triangle: the saw plane is the plane of the three points (a slanted cut, a mitre).
  - The plane is previewed as an orange outline where it meets the object. `Enter` cuts, `Esc` forgets the points. The cut object is replaced by closed solids (two, or more when the plane splits an odd shape into several pieces), named `prism-xxxx` with a fresh short id each (an object that is not a prism keeps its name plus a short id); the two new faces take the material of the face that was sawn (the one the points were put on) and lie exactly in the plane (no kerf, no triangle sprinkles). The pieces stay where they were: move them apart with `H`. One `U` puts the original back. You stay in edit mode, on the first piece, so the next cut can follow at once (`Q` leaves; the cross over another piece and `Q` edits that one). Only closed solids can be sawn. The engine part is `saw`, `planeThroughLine`, `planeThroughTriangle`, `sectionSegments`.
- **Nothing moves by default** (and never while you sketch or saw). Moving is Blender-style, with a key per mode, and every drag is one `U` step:
  - `1` **move points:** hover a vertex (white cross), drag it.
  - `2` **move lines:** hover an edge (white), drag it; both ends move.
  - `3` **move faces:** hover a face (white outline), drag it; all its vertices move together and the face stays flat.
  - The drag slides in the plane that faces the camera. A selected point, line or face (orange) also gets a gizmo: drag an arrow to move along one axis. Everything that uses the moved vertices follows. A polygon that gets only some of its vertices moved turns into triangles.
  - `V` goes back to sketching (and drops the selection); `Esc` does the same.
- **`Esc`** forgets the saw points or ends the sketch chain; then leaves the saw or a move mode back to sketching; then leaves edit mode (so does `Q`). `X` deletes the object under the cross, as outside edit mode.

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

Twelve starting materials: plaster, sand, wood, dark wood, concrete, slate, grass, brick, steel, gold, glass, lamp. Pick one, then `Shift`+press to paint a face or `Shift`+double click for the whole object.

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
