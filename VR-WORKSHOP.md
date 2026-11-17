# The VR workshop: building with bare hands

A modelling corner in VR, driven only by the hands (the Quest's hand tracking, no controllers), on **VRTSH** (`VRTSH.md`):
each hand always has one function; its icons are on the back of the hand and the other hand's index fingertip chooses one.
Pick **VR workshop** in the scene list (a floor and a workbench), press **VR**, put the controllers down and show your hands.
The bench puts you at it: its front edge is 25 cm in front of where you stand.

## The hands

| Function (icon on the back of the left hand) | What the left hand does with it |
|---|---|
| **8 materials** (a little cube of each, all real materials: wood, brick, blue lacquer, steel, copper, gold, glass, ruby glass) | **poke** a block with the left index fingertip: the whole block takes that material |
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
| **type** (two-handed) | first a point on a surface: the right hand aims at it, a left pinch takes it. Then a **ring of keys** stands round you at hand height: the most used letters in front, the rarer ones farther round (alternately right and left), digits and signs after them, **esc** and **exit** at the back; **space**, **del** and **enter** near the front. A **fingertip on a key** types it; a **left pinch moved sideways** turns the ring. The words stand out of the surface at the point (8 cm letters, the material chosen last); what you have typed shows over the front of the ring. **enter** a new line, **del** the last letter, **esc** the words go (take a new point), **exit** the words stay and both hands get back their own functions |
| **move** | on the ground: a **fist drawing upright circles**: rolling forward walks forward, backward walks back, as fast as the circles go (a round a second ≈ 1.6 m/s). An **upright hand** (in a wall's plane, fingers straight and together, like a blade): you turn toward where it points (the farther off, the faster; straight ahead: still) |
| **fly** | the same as move, and up and down too: a **fist moved nearly straight down** lifts you, **straight up** lowers you, as fast as the hand goes (× 1.5) |
| **record** (a red dot) | **hold a fist** for 0.7 s: recording starts (the label shows ● rec and the time); again: it stops and the recording is downloaded as a `.vr.json` file |
| **exit** (a door, in the far corner) | **hold a fist** for 0.7 s: out of VR (the icon fills up red while you hold) |

Every step is one undo (a cube, a move, a paint). When VR ends (and a moment after every change) the scene is saved here as
**vr workshop** (+ scene list, saved scenes), and the view turns to the workpiece.

The hands are drawn as their bones: cream open, teal for a fist or a pinch, orange while holding an object.

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
