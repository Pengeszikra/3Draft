# The VR workshop: building with bare hands

A modelling corner in VR, driven only by the hands (the Quest's hand tracking, no controllers). Pick **VR workshop** in the
scene list (a floor and a workbench), press **VR**, put the controllers down and show your hands. The bench puts you at it:
its front edge is 25 cm in front of where you stand.

## What the hands do

| Gesture | What happens |
|---|---|
| **Both hands together**, then **pulled apart** | a block between them: the two palms are its opposite corners (in the frame you face). It grows and shrinks with the hands; **hold them still** for half a second and it stays. Hands back together before that: it is gone. Its size shows on the panel |
| **Fist or pinch** on (or within 4 cm of) an object, **either hand** | takes it: it moves and turns with that hand until you let go. Each hand can hold its own object |
| **The back of the left hand** turned to the eyes | the palette, 2 cm above the hand. The **right index fingertip** on a colour **picks** it |
| **Right hand pointing** (index out, the others curled) | a ray from the index finger, a cross where it lands on an object |
| Pointing + **thumb tucked** to the middle finger (**click**) | paints the face the ray lands on with the picked colour; a **second click** on the same object at once paints all of it |
| Fingertip on a key of the **panel** (left of you, below the eyes) | **CUBE** (a 15 cm block on the bench), **UNDO**, **DELETE** (the workpiece: the last block made, held or painted), **EXIT VR** |

Every step is one undo: a block, a move, a paint. When VR ends (and a moment after every change) the scene is saved here as
**vr workshop** (+ scene list, saved scenes), and the view turns to the workpiece.

The hands are drawn as their bones: cream open, teal for a fist or a pinch, orange while holding an object, light green while
the two hands are together (a block is ready to be pulled out).

Carving with the fist (cutting along the hand's plane) is set aside for now: it is in the history of `app/index.html`
(`xrWorkshop`, the "carving" commits) and its notes are below.

## How it works

- The session asks for `hand-tracking` (optional). Each frame the 25 joints of each hand are read with `frame.getJointPose`
  in the room's reference space (metres).
- **Fist:** the fingertips' mean distance to the wrist, against the knuckles' (open ≈ 1.9, fist < 1.1, let go above 1.35).
  **Pinch:** thumb and index tips closer than 1.8 cm (let go at 3.5 cm). **Pointing:** the index straight (> 1.7) with the
  other three curled (< 1.15); the click is the thumb's tip within 3 cm of the middle finger. The palm's middle, its normal
  (from the middle metacarpal's frame) and the pointing ray are smoothed against the tracking's tremble; a jump over 3 cm is
  taken at once.
- **A block:** the palms closer than 7 cm with open hands arm it; past 10 cm the block is made (the palms are its corners in
  the frame of the head's flat forward, at least 2 cm each way) and changed every frame; both palms slower than 6 cm/s for
  0.45 s end it.
- **Holding:** at the grab the object's points are taken into the room's frame; every frame they are carried by
  `wrist(now) · wrist(grab)⁻¹` and put back into the scene.
- **The palette:** a 6-column board of 2 cm cells in the plane of the left hand, on the side turned to the eyes (shown only
  when that side faces them). **Painting:** the pointing ray against the objects (the plane test of a convex body), the
  face it enters by.
- **The room and the scene:** on the ground the room's floor is the scene's floor (y = 0); a bench anchors the room to it.
  Only loose objects up to 1.5 m across can be taken or painted (not the floor or the bench).
- **Carving (set aside):** the hand's plane through the fist, cut with `saw()` while the cut line shows; the biggest piece
  stays when it lies ahead of the hand. Some corner cuts left a broken solid (a big red face), which is why it is off.
- Code: `xrHandsNow`, `xrGestures`, `xrWorkshop`, `xrWorkshopDraw` in `app/index.html`; the scene is `examples/workshop.js`.
