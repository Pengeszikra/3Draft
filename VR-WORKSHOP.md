# The VR workshop: carving with bare hands

A modelling corner in VR, driven only by the hands (the Quest's hand tracking, no controllers). Pick **VR workshop** in the
scene list (a floor and a workbench; you stand at the bench), press **VR**, put the controllers down and show your hands.

## What the hands do

| Gesture | What happens |
|---|---|
| Fingertip on a key of the **panel** | the panel floats left of you, a little below the eyes: CUBE, UNDO, DELETE, EXIT VR and the palette |
| **CUBE** | a 15 cm block appears in front of you, in the selected material |
| A **colour** of the palette | paints the workpiece; new blocks and new cut faces take it too |
| **Left fist or pinch** on (or within 4 cm of) an object | takes it: it moves and turns with your hand until you let go |
| **Left pinch in the air** (not on an object) | turns the sculpture (the workpiece) round its middle: sideways = a turntable round the upright axis, up / down = tips it toward you; 10 cm of the hand = a half turn; pinch again to turn on |
| **Right hand pointing** (index out, the others curled) | a ray from the index finger, a cross where it lands on an object |
| Pointing + **thumb tucked** to the middle finger | **V**: a saw point where the ray lands. 2 points on one object: the cut along their line, square to the face; 3: their plane. V on two different objects: a bar between the two points |
| **Right fist** in an object | carves, all the time it is in: along the plane of the hand through the middle of the fist, it takes away what the hand has come through (held still it waits; turning back out does not cut). The plane shows on the object: orange near it, red inside. With V points on the object the first touch cuts their plane at once. One fist = one undo step |
| **UNDO** | takes back the last step (a cut, a move, a paint, a new block) |
| **DELETE** | removes the workpiece (the last block made, held or cut) |

The bench puts you at it: its front edge is 25 cm in front of where you stand. CUBE puts the blocks on the bench. When VR ends
(and a moment after every change) the scene is saved here as **vr workshop** (+ scene list, saved scenes), and the view turns to
the workpiece.

The hands are drawn as their bones: cream open, teal for a pinch or the left fist, orange for the right fist (the saw, with a
24 × 14 cm frame in the hand's plane), red while the saw is inside an object.

## How it works

- The session asks for `hand-tracking` (optional). Each frame the 25 joints of each hand are read with `frame.getJointPose`
  in the room's reference space (metres).
- **Fist:** the fingertips' mean distance to the wrist, against the knuckles' (open ≈ 1.9, fist < 1.1, let go above 1.35).
  **Pinch:** thumb and index tips closer than 1.8 cm (let go at 3.5 cm).
- **Turning:** a pinch in the air takes the workpiece's points into the room's frame and turns them about its middle:
  `Ry(10π·dx) · Rx(−10π·dy)`.
- **Holding:** at the grab the object's points are taken into the room's frame; every frame they are carried by
  `wrist(now) · wrist(grab)⁻¹` and put back into the scene. One undo step per hold.
- **Carving:** while the palm's centre is in an object and has moved 2 mm since the last cut (at most every 30 ms), the
  object is cut by the palm's plane through it (the normal from the middle metacarpal's frame, smoothed against the
  tracking's tremble, turned to face the way the hand moves). `saw()` splits the mesh into closed solids; the biggest stays,
  but only when it lies ahead of the hand (else nothing is cut, so pulling the fist back out leaves the work alone). Cutting a convex block by planes keeps it convex, so "inside" is "behind every face plane" and the
  pointing ray's hit is the plane test of a convex body; all of it is a few microseconds for a block, so no worker is needed.
- **Pointing:** the index's tip over its knuckle against the wrist (straight > 1.7) with the other three curled (< 1.15);
  the click is the thumb's tip within 3 cm of the middle finger.
- **The room and the scene:** on the ground the room's floor is the scene's floor (y = 0) under the eye, so the bench stands
  where it should. Only loose objects up to 1.5 m across can be taken or cut (not the floor or the bench).
- Code: `xrHandsNow`, `xrGestures`, `xrWorkshop`, `xrWorkshopDraw` in `app/index.html`; the scene is `examples/workshop.js`.
