# The VR workshop: building with bare hands

A modelling corner in VR, driven only by the hands (the Quest's hand tracking, no controllers), on **VRTSH** (`VRTSH.md`):
each hand always has one function; its icons are on the back of the hand and the other hand's index fingertip chooses one.
Pick **VR workshop** in the scene list (a floor and a workbench), press **VR**, put the controllers down and show your hands.
The bench puts you at it: its front edge is 25 cm in front of where you stand.

## The hands

| Function (icon on the back of the left hand) | What the left hand does with it |
|---|---|
| **8 materials** (a little cube of each: plaster, wood, brick, grass, steel, gold, glass, slate) | **poke** a block with the left index fingertip: the whole block takes that material |
| **grab** (a fist) | a **fist or a pinch** on (or within 4 cm of) an object takes it: it moves and turns with the hand until you let go |
| **cube** | **close the fist and open it**: a 5 cm cube appears there, on the palm's side, in the last material chosen |

The right index fingertip on an icon of the left hand chooses it (and the left one on the right hand's). The chosen function stands bigger over the fingers, tilted toward you (only a sign:
touching it does nothing), with its name and the last thing that happened.

The **right hand** (the left index fingertip chooses on the back of it):

| Function | What the right hand does with it |
|---|---|
| **grab** | the same as the left's |
| **build walls** | 2 × 2 m panels, a finger thick (2 cm), on a grid of 2 × 2 × 2 m cells; you stand in the middle of one. **Aim** with the index straight: **down** = a floor where the ray meets the floor, **up** = a ceiling where it meets the ceiling, **sideways** = a wall of the cell it points into (tip the finger a little down or up to reach farther). Of that cell's sides, the **side walls along the way you face** (a corridor's walls) come first; the wall across your way only when you point nearly straight along it (within 27°). Not on the sides of your own cell. **Curl the other three fingers** (the index still pointing): it is laid there, in the material chosen last. The slot shows as a square: green free, red taken or too close; the floor grid shows round you. The grid's floor is where your feet are (the eyes' height less 1.68 m, for 180 cm); the first panel fixes the grid, until then it goes with you. Up and down a level, the floor and ceiling are the level you are on |
| **erase walls** | aim at a panel (it shows red) and curl the other three fingers |
| **move** | a **fist drawing upright circles**: rolling forward walks forward, backward walks back, as fast as the circles go (a round a second ≈ 1.6 m/s). A **fist moved nearly straight down** lifts you, **straight up** lowers you, as fast as the hand goes (× 1.5). A **flat hand, palm down, fingers straight**: you turn toward where the middle finger points (the farther off, the faster; straight ahead: still) |
| **exit** (a door, in the far corner) | **hold a fist** for 0.7 s: out of VR (the icon fills up red while you hold) |

Every step is one undo (a cube, a move, a paint). When VR ends (and a moment after every change) the scene is saved here as
**vr workshop** (+ scene list, saved scenes), and the view turns to the workpiece.

The hands are drawn as their bones: cream open, teal for a fist or a pinch, orange while holding an object.

## Set aside

- **Carving with the fist** (cutting along the hand's plane with `saw()` while its line shows): some corner cuts left a
  broken solid (a big red face). It is in the history of `app/index.html`.
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
