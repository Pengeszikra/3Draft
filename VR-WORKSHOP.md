# The VR workshop: building with bare hands

A modelling corner in VR, driven only by the hands (the Quest's hand tracking, no controllers), on **VRTSH** (`VRTSH.md`):
each hand always has one function; its icons are on the back of the hand and the other hand's index fingertip chooses one.
Pick **VR workshop** in the scene list (a floor, a workbench, the LARK-4C lander 10 m ahead, the deep sky far behind it all), press **VR**, put the controllers down and show your hands.
The bench puts you at it: its front edge is 25 cm in front of where you stand.

## The hands

| Function (icon on the back of the left hand) | What the left hand does with it |
|---|---|
| **8 materials** (a little cube of each, all real materials: wood, brick, blue lacquer, steel, copper, gold, glass, ruby glass) | **poke** an object with the left index fingertip: the whole of it takes that material (blocks, walls, letters, the Lark's parts) |
| **grab** (a fist) | a **fist or a pinch** on (or within 4 cm of) an object takes it: it moves and turns with the hand until you let go |
| **block between the hands** (two-handed) | put the two open hands together, pull them apart: a block grows between them (the palms its opposite corners, in the frame you face); as soon as the hands nearly stop (both slower than 12 cm/s for a quarter second) it stays. Hands back together before that: it is gone |
| **cube** | **close the fist and open it**: a 5 cm cube appears there, on the palm's side, in the last material chosen |

**Two-handed skills** (build walls, erase walls, type, block): chosen on either hand, they take the other hand too; choosing anything
else (or exit on the keyboard) gives the other hand back its own function.

The right index fingertip on an icon of the left hand chooses it (and the left one on the right hand's). The icons hang on
the wrist's tracked pose only, so the other hand coming near does not turn them. The chosen function stands bigger over the fingers, tilted toward you (only a sign:
touching it does nothing), with its name and the last thing that happened.

The **right hand** (the left index fingertip chooses on the back of it):

| Function | What the right hand does with it |
|---|---|
| **grab** | the same as the left's |
| **build walls** (two-handed) | 2 × 2 m panels, a finger thick (2 cm), on a grid of 2 × 2 × 2 m cells; you stand in the middle of one. The **right hand aims** with the index straight, a **left pinch lays** the panel there, in the material chosen last. Which slot: the ray's part along each kind, weighted, the biggest wins, in this order: the **side walls along the way you face**, the **floor**, the **ceiling**, the **wall across your way**. A wall goes on the near side of the cell where the ray meets the floor or the ceiling (tip the finger to reach farther); not on the sides of your own cell. The slot shows as a square: green free, red taken or too close; the floor grid shows round you. The grid's floor is where your feet are (the eyes' height less 1.68 m, for 180 cm); the first panel fixes the grid |
| **erase walls** (two-handed) | the right hand aims at a panel (it shows red), a left pinch erases it |
| **saw** | a **fist**: its blade is the plane of the hand through the middle of the fist. Where it meets an object (the fist within 12 cm of it) the cut line shows red and it cuts there at once (the bigger piece stays); moving on it keeps cutting, taking away what the hand has come through. One fist = one undo step; a cut that would leave a broken solid is not made |
| **type** (two-handed) | first a point on a surface: the right hand aims at it, a left pinch takes it. Then a **plain keyboard** (QWERTZ, as in Hungary: digits and del, Q–P and +, A–L and enter, Y–M and , . - /, then esc, ? !, a wide space, : ' _ and exit) lies in front of you at hand height, tilted toward you. A **fingertip on a key** types it. The words stand out of the surface at the point (8 cm letters, the material chosen last); what you have typed shows over the keyboard. **enter** a new line, **del** the last letter, **esc** the words go (take a new point), **exit** the words stay and both hands get back their own functions |
| **move** | on the ground: a **fist drawing upright circles**: rolling forward walks forward, backward walks back, as fast as the circles go (a round a second ≈ 1.6 m/s). An **upright hand** (in a wall's plane, fingers straight and together, like a blade): you turn toward where it points (the farther off, the faster; straight ahead: still) |
| **fly** | the same as move, and up and down too: a **fist moved nearly straight down** lifts you, **straight up** lowers you, as fast as the hand goes (× 1.5) |
| **debug** (a bug) | **hold a fist** for 0.7 s: a debug report goes to the online store (`debug/`, no key needed): a quarter-size picture of the left eye and the state (the rig, the pilot, the ship, the objects and render parts round the eye, the log). Read them with `/api/store?debug=list` and `?debug=<name>`. (It took the record function's place; recording is still the sys group's rec / play on the desktop.) |
| **exit** (a door, in the far corner) | **hold a fist** for 0.7 s: out of VR (the icon fills up red while you hold) |

Every step is one undo (a cube, a move, a paint). When VR ends (and a moment after every change) the scene is saved here as
**vr workshop** (+ scene list, saved scenes), and the view turns to the workpiece.

The hands are drawn as their bones: cream open, teal for a fist or a pinch, orange while holding an object.

## The starship: flying with bare hands (Lark in the Deep Sky)

Open **Lark in the Deep Sky** (+ scene → games, `game:lark`): `examples/lark.game.json`, the LARK-4 lander
(`examples/lark-4.scene.json`) as the starship, in `examples/deepsky-lark.scene.json`, a copy of the Deep Sky that this game
will grow on. On the desktop the Lark is drawn over the universe from its left pilot seat (C: walk on board).

In VR, in flight, **the whole workshop is on board**: every VRTSH function works in the ship's cabin, in metres, while the
universe goes by outside, and the left hand gets one more, last in its grid: **ship** (two-handed). Take it like any other
function (poke its icon); choosing anything else puts it down, and the ship **keeps its speed and its course**: the starship
flies on to its target while you stand up and do something else on board (there is no jump or teleport in the game, only
a very fast starship).

**On board (the cabin).** The ship's objects (the LARK-4's parts) are the workshop's scene in flight: you can paint, grab,
saw them, build walls, type, make cubes and blocks, all in the ship's own frame (metres), drawn round you by the ship's
renderer. Walking in your room walks you in the ship; **move** and **fly** take you farther (the cabin rig), and turning
with them turns the universe with the ship, so the nose and the sky ahead stay together. What you make or change is in the
ship (the desktop's bridge view shows it too); it is not saved yet when the game ends. In a star map without a ship the
tools that make things in metres are left out (there the unit is the light year), and the material icons are flat swatches
in space.

With the ship function:

| Gesture | Does |
|---|---|
| **left fist**, tilted left / right like a joystick | the ship turns left / right in its own horizontal plane (yaw; up to 0.7 rad/s at 26° tilt) |
| **right fist held flat** (back of the hand up), pushed ahead | **W**: the throttle (smooth within speed level ±1, then the exponential steps; 3 cm dead zone, full at 12 cm) |
| the same, pulled back | **S** |
| **right index aims, left pinch** | **T**: the target is what the right hand points at (the ray turns gold on an object, its name beside it); pointing at nothing: the target ahead |

**The dashboard** comes with the controls: it appears when you take the ship function and is gone when you put it down.
Take the controls somewhere else in the ship and it appears there, in front of you (40 cm ahead of your eyes, 36 cm lower,
tilted to you), like a desk in an open office: the experimental starship's controls are wireless, so UP's engineers made it
so for the tests. It is a **hologram** (a see-through cyan slab, 50 × 17 × 3.5 cm, glowing edges, scan lines and a sweeping
line of light); **take it with a pinch or a fist** (whatever the hand's function: it turns amber while carried) and put it
where you like; the other tools (paint, saw, grab…) do not touch it. On its face:

- the keys **space** (stop), **esc** (free the target), **tab** (next target), **0** (orbit), **[** and **]** (roll, while
  the fingertip stays on the key): poke them with an index fingertip;
- **⌕ find**: opens the dashboard's own keyboard (QWERTZ, as light, in the dashboard's plane above it; there is no system
  keyboard inside an immersive VR session). Type a name with a fingertip: the line under the keys shows what is typed and
  what it would find (the desktop's Enter search: case and accents do not matter, kinds like `black hole` too); **enter**
  targets it (and closes the keyboard), **del** takes the last letter, **esc** / **exit** close it. (The sky FOV slider is
  gone: the headset's own field of view is right.)

**The target in the headset:** four ticks round it on the sky (as wide as it looks, at least 1°), gold; green and turned
45° while orbiting it, as on the screen.

**The cockpit:** the game's ship is drawn round you in metres, over the sky: its helm eye (`helm.eye`, the left pilot seat
of the Lark) is where your eyes were when the flight began, its nose ahead (the room's −z, the way the rig turns the
universe with the ship). A second renderer on the same WebGL2 context draws it; it clears only the depth
(`xr.overlay` in `GpuXrEye`). The flight readout stays in view.

## The VR tape: recording, playing, the live link

What is recorded is exactly what the workshop gets each frame: the head's pose and the 25 joints of each hand (in the room,
0.1 mm), with the start (the scene, where the room lies in the scene, each hand's function, the material). Playing feeds the
same frames to the same workshop code, so the scene is built again as the hands did it; the desktop camera follows the
recorded head (a little behind and above it) and a ghost shows the hands, the head and the icons.

- **Record** in VR with the right hand's record function; the file is downloaded (`vr-<time>.vr.json`).
- **Play**: the sys **play** button opens a `.vr.json` too (or `vrrec.play(recording)` in code).
- **The live link** to your own computer, with `tools/vr-link.mjs` (in the 3Draft repo, no dependencies):
  1. on the computer: `node tools/vr-link.mjs` (a WebSocket server on port 8787; sessions are saved to `vr-recordings/`
     as `.jsonl` and, when a session ends, as `.vr.json`);
  2. connect the Quest (USB, or wireless adb) and run `adb reverse tcp:8787 tcp:8787`, so the headset's `localhost:8787`
     is the computer (an https page may open `ws://localhost`, not a plain `ws://` to another address);
  3. in the headset open Spider Paint once with `?vrlink=ws://localhost:8787` (it is remembered; `?vrlink=` alone forgets
     it): from then on every workshop session is sent;
  4. on the computer open Spider Paint with `?vrwatch=ws://localhost:8787`: it plays what the headset does, live (a page that
     comes late catches up from the session's start);
  5. `node tools/vr-link.mjs play vr-recordings/<file>.vr.json` plays a saved session to the watching pages again.

## Set aside

- **The floating panel, the palette on the hand, pointing and clicking to paint a face, two hands pulled apart into a
  block:** replaced by the VRTSH functions; in the history too.

## How it works

- Hands, gestures, icon layout and choosing: `src/vrtsh.ts` (`readHands`, `createTsh`).
- The workshop's functions: `xrWorkshop` in `app/index.html`. A poke is the index fingertip inside a block (blocks cut by
  planes are convex, so "inside" is "behind every face plane"); a cube is the `fistOpen` event; exit is `fistFor`.
- The material icons are real little meshes drawn with the scene that frame (one more part for the renderer), so their
  colour and transparency are the material's own; the other icons are canvas pictures on quads.
- **The sky behind:** a scene's `backdrop: 'deepsky'` puts the deep sky's stars, galaxies and glowing cloud 400 m out round
  you in the headset, fixed in the scene's directions (they turn with the near scene when you turn); only to look at: no
  objects, no targets. Drawn after the scene with the depth test on.
- **What a hand may take, paint or cut:** every loose object of any size, the Lark's parts too (not the floor or the bench).
  A point is on an object by its box (kept per mesh), and for a simple solid (up to 14 faces: blocks, panels, carved blocks)
  behind every face plane; a complex one (letters, a ship's part) counts by its box.
- **The room and the scene:** on the ground the room's floor is the scene's floor (y = 0); a bench anchors the room to it,
  until you move: walking and turning keep the rig where they left you (`xrState.walk`, back to the start when VR ends).
- **The grid:** an origin (a cell's middle on the floor) and its axes; found again from the first panel there is. A slot is a
  panel's middle in grid units and the axis it is thin along. Erasing tests the ray against the panels (convex boxes).
- **Walking:** the fist's places of the last 0.8 s in the upright plane of the way you face; their angle round their middle
  (rolling forward: it falls) over the time is the speed, 0.25 m per radian. **Turning:** the middle finger's flat direction
  against the head's, a dead zone of 11°, 1.6 rad/s per radian beyond it, about the head. **Up and down:** the fist's
  speed (smoothed) when it is upright (across < half of it) and the hand is not circling (a circle must be round: its
  spread one way at least 35 % of the other).
  Only loose objects up to 1.5 m across can be taken or painted (not the floor or the bench).
