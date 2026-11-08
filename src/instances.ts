// Prototypes and instances. A PROTOTYPE is a list of meshes of the same thing in decreasing detail (level of detail:
// lods[0] is the finest), all of unit size and centred on the origin, with material SLOTS in `Face.mat` ('core', 'halo'...).
// An INSTANCE is the prototype placed with a position, a size (one number, or one per slot) and its own slot -> palette
// map, so a scene file stores the shape once and one short record per star. The detail used on screen follows the size
// the thing has in pixels, so a far star costs a few faces and a near one a few dozen.

import type { Face, Mesh, Vec3 } from './types.js';

export interface Prototype {
  lods: Mesh[];
}

export interface Placement {
  at: Vec3;
  /** Size of the instance; a record scales each slot on its own ('*' is the default), e.g. a star core and its halo. */
  scale: number | Record<string, number>;
  /** Slot -> palette name. */
  mats?: Record<string, string>;
  /** Colour of every face (a tint on top of the material). */
  color?: string;
}

/** A copy of the prototype mesh, scaled, moved and given its materials. Slots must not share vertices when scaled apart. */
export const instantiate = (proto: Mesh, p: Placement): Mesh => {
  const slotOf: string[] = [];
  for (const f of proto.faces) for (const i of f.v) slotOf[i] ??= f.mat ?? '';
  const size = (slot: string): number => (typeof p.scale === 'number' ? p.scale : (p.scale[slot] ?? p.scale['*'] ?? 1));
  const positions = proto.positions.map((q, i): Vec3 => {
    const k = size(slotOf[i] ?? '');
    return [q[0] * k + p.at[0], q[1] * k + p.at[1], q[2] * k + p.at[2]];
  });
  const faces = proto.faces.map((f): Face => {
    const out: Face = { v: f.v };
    const mat = f.mat === undefined ? undefined : (p.mats?.[f.mat] ?? f.mat);
    if (mat !== undefined) out.mat = mat;
    const color = p.color ?? f.color;
    if (color !== undefined) out.color = color;
    return out;
  });
  return { positions, faces };
};

/** Which level of detail to draw for something that is `px` pixels across (its radius); `limits` are the pixel sizes where the next finer level starts. */
export const lodLevel = (px: number, levels: number, limits: readonly number[] = [36, 12, 4]): number => {
  let level = 0;
  while (level < levels - 1 && level < limits.length && px < limits[level]!) level++;
  return level;
};
