// The demo target shared by the example script and the viewer app.

import { box, merge } from '../src/index.js';

/** The table leg: a square base and a height. The viewer's prisms use the same base and color. */
export const LEG = { base: 0.15, height: 0.85, color: '#8a6a4a' };

const TOP_FACE = 4; // box face order: +z, -z, +x, -x, +y, -y

// The legs are glued under the slab, so their top face is an interior face that
// never shows from outside. It is left out of the model.
const leg = (x, z) => {
  const b = box({ size: [LEG.base, LEG.height, LEG.base], at: [x, LEG.height / 2, z], color: LEG.color });
  return { ...b, faces: b.faces.filter((_, i) => i !== TOP_FACE) };
};

const top = box({ size: [2, 0.15, 1.2], at: [0, 0.925, 0], color: '#c8a27a' });
const legs = [-0.85, 0.85].flatMap((x) => [-0.45, 0.45].map((z) => leg(x, z)));

export const table = merge(top, ...legs);
