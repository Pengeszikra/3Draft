# VRTSH, "ViRTuSH": The Solution is at Hand

A UI for VR with bare hands (WebXR hand tracking), in the engine as `src/vrtsh.ts` (exported from `3draft`), so any
program can use it.

## The idea

- **Each hand always has one function**, whatever the wearer is doing or whoever they are playing. Whatever the hand does
  (a fist, a pinch, a poke, opening the fist) means that function.
- **On the back of each hand** sit the icons of the functions it can take. **The other hand's index fingertip** pokes one to
  choose it.
- **The chosen function** stands in front of the back of the hand, over the fingers, bigger, tilted toward the eyes, with
  its name. It is only a sign: touching it does nothing.

VRTSH reads the hands, keeps the choice, recognises the gestures and lays the icons out. What a function *does* is up to
the program: VRTSH knows nothing of a scene or a renderer. Everything is in the room's reference space (metres, y up).

## Use

```js
import { createTsh, readHands, TSH_BONES } from '3draft';

const tsh = createTsh({
  left: [{ id: 'grab', kind: 'grab' }, { id: 'cube', kind: 'cube' }, { id: 'exit', kind: 'exit' }],
  right: [{ id: 'grab', kind: 'grab' }], // one function: no icons
});

// every XR frame
const hands = readHands(session, frame, refSpace); // { left?, right? }: joints by WebXR name, the wrist's pose
const st = tsh.update(hands, viewerPose.transform.matrix, performance.now());
st.left.fn;     // the left hand's function now
st.left.g;      // its gestures: fist, pinch, point, aim, click, palm, back, forward, rayFrom, rayDir, fistFor (s)
st.left.icons;  // what to draw: { fn, at, x, y, z, size, chosen, hover, big? } (the frame faces the viewer)
st.events;      // { type: 'choose' | 'fistClose' | 'fistOpen' (at, heldFor) | 'clickDown' | 'pointStart', side, ... }
```

`TSH_BONES` lists the joint chains to draw a hand with. `tsh.choose(side, id)`, `tsh.setFunctions(side, list)` and
`tsh.fn(side)` change or read the choice.

## Gestures

- **Fist:** the fingertips' mean distance to the wrist against the knuckles' (open ≈ 1.9; closed below 1.1, open again
  above 1.35).
- **Pinch:** thumb and index tips within 1.8 cm (let go at 3.5 cm).
- **Aim:** the index straight (> 1.7), whatever the others do. **Pointing:** the index straight with the other three curled
  (< 1.15); its start is the `pointStart` event ("this one"). **Click:** while pointing, the thumb's tip within 3 cm of the
  middle finger.
- **The back of the hand:** (index metacarpal − wrist) × (pinky metacarpal − wrist), turned round for the right hand
  (the hands are mirrored). The palm's middle, the back and the pointing ray are smoothed against the tracking's tremble;
  a jump of more than 3 cm is taken at once.

## Layout

The icons hang on the **wrist's tracked pose only**: the back of the hand, the way the fingers point and the palm's middle
are learnt in the wrist's own frame (from the open hand, averaged slowly: they are the hand's shape) and carried by the
wrist. Another hand coming near, which can shake the finger joints' tracking, does not turn or shift them, and nothing
depends on the head.

The icons sit in a grid over the back of the hand (4 columns of 2.4 cm cells, 1.8 cm over the skin). The chosen one is 5 cm, 10 cm
out along the fingers from the palm's middle and 4.5 cm over them, leaning back 40° toward the wrist (toward you when the
hand is held up); the choosing never looks at it. A fingertip within 1.3 cm of an icon's middle chooses
it, once, until the finger moves 2.6 cm away. A function can ask for its cell (`slot`, row by row; −1 = the last cell of
the last row, a corner out of the way); the others fill the free cells in order.

## In Spider Paint (the VR workshop)

The first use is a left-hand test in the VR workshop scene (`VR-WORKSHOP.md`): the left hand takes 8 materials (shown as
little cubes of the material, so glass looks like glass), grab and cube; the right hand has grab, and exit in the far
corner of its grid.
