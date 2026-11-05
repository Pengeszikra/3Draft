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
| `T` | fly to the object under the cross. Over nothing, or when too close or inside a model: out to the nearest object |
| `/` | show only the object under the cross; again: the whole scene, and the camera flies back to where it was |
| `M` | place a prism on the surface under the cross, or shoot one into empty space. **In isolated mode (`/`) it fires a bullet** instead: a prism that starts at the camera point and flies along the ray through the cursor, so its long axis is always the view direction and you always see its back; if it hits the isolated object it sinks half its length and carves that part out (A − B, the cut is made of the selected material, `U` undoes it); if it misses it flies on to 4 times the camera-to-model distance and vanishes. Only the closed parts of the model are carved; open parts are ignored (see the health check below). A carve never leaves a crack: if the result would not be a closed solid it is retried with a hair's shift, and if that fails too the model stays as it was (the note "left as it was" shows). |
| `Tab` | edit mode on the object under the cross / off (see below) |
| `V` | Spider bar (in edit mode: draw a line): the first `V` remembers a surface point, the second joins the two with a thin prism (a quarter of the base of a placed one) made of the selected material. `V` over empty space forgets the first point |
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

## Edit mode: drawing on a model (`Tab`)

The idea: there is a base model, and you refine or extend it by drawing lines on it. Put the cross on an object and press `Tab`. A red bar at the top says which object is being edited. Its vertices show as small grey crosses.

- **`V` draws a line.** The first `V` takes a point, the next `V` joins it to the new one, and the chain goes on from there. A point is either an existing vertex (the pointer **snaps** to vertices; a white cross shows which) or a new vertex put on the surface under the cross. On a face it splits the face into triangles, on an edge it goes into both faces, so the surface never cracks.
- **Two points on one face cut it.** The line becomes a real edge of the mesh: the surface gets detail exactly where you drew.
- **Points in the air extend the model.** With a line in progress, `V` over empty space puts the next point on the plane that faces the camera through the last point. So you can draw a new part out from the model, and lines that end on existing vertices are attached to it.
- **`Enter` closes a loop into a face.** The shortest closed loop (up to 8 lines) through the last line becomes a face with the selected material, wound away from the middle of the object. A loop of 4 or more becomes triangles, so faces stay flat.
- **Nothing moves by default** (and never while you draw with `V`). Moving is Blender-style, with a key per mode, and every drag is one `U` step:
  - `1` **move points:** hover a vertex (white cross), drag it.
  - `2` **move lines:** hover an edge or a line (white), drag it; both ends move.
  - `3` **move faces:** hover a face (white outline), drag it; all its vertices move together and the face stays flat.
  - The drag slides in the plane that faces the camera. A selected point, line or face (orange) also gets a gizmo: drag an arrow to move along one axis. Everything that uses the moved vertices follows: lines, faces and the base surface, so this is how you reshape the original model. A polygon that gets only some of its vertices moved turns into triangles.
  - `V` goes back to drawing (and drops the selection); `Esc` does the same.
- **`B` turns the spider bars into lines.** The prisms made with `V` in object mode (they are objects named `bar`) become lines on the edited object: each end snaps to a vertex that is close, or is put on the surface if it is near it, or stays a free point. The bars are removed (one `U` brings them back). So a plan sketched as bars can be worked on as a wire.
- **`X`** removes the lines at the selected point or line (or the last line); the points stay. `U` undoes every step, one key press at a time.
- **`Esc`** stops the line you are drawing; then it leaves a move mode back to drawing; then it leaves edit mode (so does `Tab`). The lines are only shown in edit mode.

The lines live next to the mesh as `wire: [[a, b], ...]` (vertex pairs) in the object's document, so the AI sees them too. The geometry is in the engine (README part 1): `insertVertex`, `cutFace`, `moveVertex`, `moveVertexSet`, `fillLoop`, `addLine`, `findLoop`.

Limits for now: a face made from a non-flat or non-convex loop is only as good as its triangle fan, there is no mirror yet, and the lines are not deformation weights (a surface does not bend around a moved vertex, it just follows the vertices that are in the mesh).

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

`/` hides everything but the object under the cross and frames it. The camera pose from before is remembered and restored when you leave. `T` flies the camera to the object under the cross (nothing under it: out to the nearest object, which also gets you out of a model you are inside).

## Phone

Four round buttons cover the main actions: travel, place, delete, and the view mode. Drag rotates; the cross aims at the middle of the screen.

## One object model and the database

Objects that come from outside (the database, the MCP server) and objects made in the app are the same thing: `{ id, name, mesh }`. Painting, deleting, isolating, booleans, moving and undo work on all of them, whoever made them. With the artifact database every change is written back, so the AI sees what the person did.

Collections:

- `objects`: one document per object, `{ name, mesh }`, at most 256 KiB each.
- `palette`: one document per material, `{ color, metal, rough, alpha, emit, order }`.

Undo is a per-session stack in the page; it does not reach back past a reload.
