// The HEXAW kernel: ray picking in WebAssembly written in HEXAW (kernel/pick.hexaw).
// The mesh is copied into the kernel's linear memory once, as long as it is the same object,
// then every pick is one call that walks all triangles. Same answers as pick() in pick.js.

import { add, dot, norm, scale } from './vec.js';
import { faceNormal } from './mesh.js';
import { ray } from './camera.js';
import { KERNEL_BYTES } from './kernel-bytes.js';

const POS = 64; // vertices start here, 24 bytes each (f64 x y z)

const decode = (b64) => {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const s = atob(b64);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};

/**
 * Starts the kernel. Resolves a picker { pick(mesh, cam, x, y, options), loaded } or rejects when
 * WebAssembly is not available.
 */
export const initKernel = async () => {
  if (typeof WebAssembly === 'undefined') throw new Error('WebAssembly is not available');
  const { instance } = await WebAssembly.instantiate(decode(KERNEL_BYTES));
  const { pick: kPick, setf, seti, getf, grow, size } = instance.exports;

  let uploaded = null; // the mesh now in the kernel's memory
  let triBase = 0;
  let triCount = 0;

  const upload = (mesh) => {
    const nv = mesh.positions.length;
    let nt = 0;
    for (const f of mesh.faces) nt += Math.max(0, f.v.length - 2);
    triBase = (POS + nv * 24 + 7) & ~7;
    const need = Math.ceil((triBase + nt * 16 + 8) / 65536);
    if (need > size()) grow(need - size());
    for (let i = 0; i < nv; i++) {
      const p = mesh.positions[i];
      setf(POS + i * 24, p[0]);
      setf(POS + i * 24 + 8, p[1]);
      setf(POS + i * 24 + 16, p[2]);
    }
    // faces are fanned into triangles (v0, vj, vj+1), each remembering its face number
    let at = triBase;
    mesh.faces.forEach((f, face) => {
      for (let j = 1; j < f.v.length - 1; j++) {
        seti(at, f.v[0]);
        seti(at + 4, f.v[j]);
        seti(at + 8, f.v[j + 1]);
        seti(at + 12, face);
        at += 16;
      }
    });
    triCount = nt;
    uploaded = mesh;
  };

  /**
   * The nearest surface under panel pixel (x, y), or null: the same result as pick() in pick.js,
   * { face, distance, point, normal, front, color }.
   */
  const pick = (mesh, cam, x, y, { cull = true } = {}) => {
    if (mesh !== uploaded) upload(mesh);
    const { origin: o, dir: d } = ray(cam, x, y);
    const face = kPick(o[0], o[1], o[2], d[0], d[1], d[2], POS, triBase, triCount, cull ? 1 : 0);
    if (face < 0) return null;
    const distance = getf(0);
    const f = mesh.faces[face];
    const outward = norm(faceNormal(f.v.map((k) => mesh.positions[k])));
    const front = dot(outward, d) < 0;
    return {
      face,
      distance,
      point: add(o, scale(d, distance)),
      normal: front ? outward : scale(outward, -1),
      front,
      color: f.color,
    };
  };

  return { pick, get loaded() { return uploaded; }, instance };
};
