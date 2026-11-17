# The VR workshop: building with bare hands

A modelling corner in VR, driven only by the hands (the Quest's hand tracking, no controllers), on **VRTSH** (`VRTSH.md`):
each hand always has one function; its icons are on the back of the hand and the other hand's index fingertip chooses one.
Pick **VR workshop** in the scene list (a floor and a workbench), press **VR**, put the controllers down and show your hands.
The bench puts you at it: its front edge is 25 cm in front of where you stand.

## The hands

| Function (icon on the back of the left hand) | What the left hand does with it |
|---|---|
| **8 materials** (a little cube of each material) | **poke** a block with the left index fingertip: the whole block takes that material |
| **grab** (a fist) | a **fist or a pinch** on (or within 4 cm of) an object takes it: it moves and turns with the hand until you let go |
| **cube** | **close the fist and open it**: a 5 cm cube appears there, on the palm's side, in the last material chosen |

The right index fingertip on an icon of the left hand chooses it (and the left one on the right hand's). The chosen function stands bigger in front of the back of the hand, tilted
toward you, with its name and the last thing that happened.

The **right hand** has two: **grab** (the same as the left's) and **exit** (a door), in the far corner of its grid, away from
the middle: choose it with the left index fingertip, then **hold a right fist** for 0.7 s to leave VR (the icon fills up red
while you hold).

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
- **The room and the scene:** on the ground the room's floor is the scene's floor (y = 0); a bench anchors the room to it.
  Only loose objects up to 1.5 m across can be taken or painted (not the floor or the bench).
