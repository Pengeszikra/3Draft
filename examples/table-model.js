// The demo target shared by the example script and the viewer app.

import { box, merge } from '../src/index.js';

const TOP_FACE = 4; // box face order: +z, -z, +x, -x, +y, -y

// The legs are glued under the slab, so their top face is an interior face that
// never shows from outside. The painter's algorithm cannot tell, and would
// draw it on top of the slab, so the model simply leaves it out.
const leg = (x, z) => {
  const b = box({ size: [0.15, 0.85, 0.15], at: [x, 0.425, z], color: '#8a6a4a' });
  return { ...b, faces: b.faces.filter((_, i) => i !== TOP_FACE) };
};

const top = box({ size: [2, 0.15, 1.2], at: [0, 0.925, 0], color: '#c8a27a' });
const legs = [-0.85, 0.85].flatMap((x) => [-0.45, 0.45].map((z) => leg(x, z)));

export const table = merge(top, ...legs);
