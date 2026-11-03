// Boolean operations on closed solids: union, subtract (a - b) and intersect.
// A BSP tree per solid (after Evan Wallace's csg.js): polygons are cut by the planes of the other solid
// and the pieces inside or outside are kept, so every result face stays planar and convex, which is what
// the rest of the engine assumes. The result is welded and its T-junctions are closed, so it is a closed
// solid again and can go into the next boolean. Faces keep the color and material of the face they came from;
// a face cut into a solid by the other one takes the color of the cutting face.
import { sub, dot, cross, len } from './vec.js';
import { faceNormal, bounds } from './mesh.js';
import { validate } from './check.js';
let EPS = 1e-6; // set per operation, relative to the size of the two solids
const unit = (v) => {
    const l = len(v) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
};
const polysOf = (mesh) => mesh.faces.flatMap((f) => {
    const pts = f.v.map((k) => mesh.positions[k]);
    const n = unit(faceNormal(pts));
    return len(faceNormal(pts)) < 1e-12 ? [] : [{ pts, n, w: dot(n, pts[0]), color: f.color, mat: f.mat }];
});
const flip = (p) => ({ ...p, pts: [...p.pts].reverse(), n: [-p.n[0], -p.n[1], -p.n[2]], w: -p.w });
/** Cuts `p` by the plane into the four buckets. */
const splitPoly = (plane, p, cf, cb, front, back) => {
    const COPLANAR = 0;
    const FRONT = 1;
    const BACK = 2;
    const SPANNING = 3;
    let type = 0;
    const types = p.pts.map((q) => {
        const t = dot(plane.n, q) - plane.w;
        const k = t < -EPS ? BACK : t > EPS ? FRONT : COPLANAR;
        type |= k;
        return k;
    });
    if (type === COPLANAR)
        (dot(plane.n, p.n) > 0 ? cf : cb).push(p);
    else if (type === FRONT)
        front.push(p);
    else if (type === BACK)
        back.push(p);
    else if (type === SPANNING) {
        const f = [];
        const b = [];
        for (let i = 0; i < p.pts.length; i++) {
            const j = (i + 1) % p.pts.length;
            const ti = types[i];
            const tj = types[j];
            const vi = p.pts[i];
            const vj = p.pts[j];
            if (ti !== BACK)
                f.push(vi);
            if (ti !== FRONT)
                b.push(vi);
            if ((ti | tj) === SPANNING) {
                const t = (plane.w - dot(plane.n, vi)) / dot(plane.n, sub(vj, vi));
                const v = [vi[0] + (vj[0] - vi[0]) * t, vi[1] + (vj[1] - vi[1]) * t, vi[2] + (vj[2] - vi[2]) * t];
                f.push(v);
                b.push(v);
            }
        }
        if (f.length >= 3)
            front.push({ ...p, pts: f });
        if (b.length >= 3)
            back.push({ ...p, pts: b });
    }
};
const build = (node, polys) => {
    if (!polys.length)
        return;
    if (!node.plane)
        node.plane = { n: polys[0].n, w: polys[0].w };
    const front = [];
    const back = [];
    for (const p of polys)
        splitPoly(node.plane, p, node.polys, node.polys, front, back);
    if (front.length)
        build((node.front ??= { plane: null, front: null, back: null, polys: [] }), front);
    if (back.length)
        build((node.back ??= { plane: null, front: null, back: null, polys: [] }), back);
};
const tree = (polys) => {
    const node = { plane: null, front: null, back: null, polys: [] };
    build(node, polys);
    return node;
};
const invert = (node) => {
    node.polys = node.polys.map(flip);
    if (node.plane)
        node.plane = { n: [-node.plane.n[0], -node.plane.n[1], -node.plane.n[2]], w: -node.plane.w };
    invert0(node);
};
const invert0 = (node) => {
    if (node.front)
        invert(node.front);
    if (node.back)
        invert(node.back);
    [node.front, node.back] = [node.back, node.front];
};
/** The parts of `polys` that are outside the solid of `node`. */
const clipPolys = (node, polys) => {
    if (!node.plane)
        return [...polys];
    let front = [];
    let back = [];
    for (const p of polys)
        splitPoly(node.plane, p, front, back, front, back);
    front = node.front ? clipPolys(node.front, front) : front;
    back = node.back ? clipPolys(node.back, back) : [];
    return [...front, ...back];
};
const clipTo = (node, other) => {
    node.polys = clipPolys(other, node.polys);
    if (node.front)
        clipTo(node.front, other);
    if (node.back)
        clipTo(node.back, other);
};
const all = (node) => [...node.polys, ...(node.front ? all(node.front) : []), ...(node.back ? all(node.back) : [])];
/** Polygons to a welded mesh: shared vertices, no sliver faces, T-junctions closed. */
const toMesh = (polys, scale) => {
    const cell = scale * 1e-5;
    const ids = new Map();
    const positions = [];
    const weld = (p) => {
        // look in the neighbouring cells too, so a point on a cell border still finds its twin
        const base = p.map((c) => Math.round(c / cell));
        for (let dx = -1; dx <= 1; dx++)
            for (let dy = -1; dy <= 1; dy++)
                for (let dz = -1; dz <= 1; dz++) {
                    const hit = ids.get(`${base[0] + dx},${base[1] + dy},${base[2] + dz}`);
                    if (hit !== undefined && len(sub(positions[hit], p)) <= cell * 1.5)
                        return hit;
                }
        ids.set(base.join(','), positions.length);
        positions.push(p);
        return positions.length - 1;
    };
    let faces = polys.flatMap((p) => {
        const v = [];
        for (const q of p.pts) {
            const k = weld(q);
            if (v[v.length - 1] !== k)
                v.push(k);
        }
        if (v.length > 1 && v[0] === v[v.length - 1])
            v.pop();
        if (v.length < 3)
            return [];
        const n = faceNormal(v.map((k) => positions[k]));
        return len(n) < 1e-9 * scale * scale ? [] : [{ v, color: p.color, mat: p.mat }];
    });
    // T-junctions: a vertex lying on the edge of a neighbouring face gets inserted into that edge
    const used = new Set(faces.flatMap((f) => f.v));
    const verts = [...used];
    if (verts.length * faces.length < 6e7) {
        const tol = scale * 1e-5 * 3;
        faces = faces.map((f) => {
            const out = [];
            for (let i = 0; i < f.v.length; i++) {
                const a = f.v[i];
                const b = f.v[(i + 1) % f.v.length];
                out.push(a);
                const pa = positions[a];
                const pb = positions[b];
                const d = sub(pb, pa);
                const dl = len(d);
                if (dl < tol * 4)
                    continue;
                const on = [];
                for (const k of verts) {
                    if (k === a || k === b)
                        continue;
                    const pk = positions[k];
                    const t = dot(sub(pk, pa), d) / (dl * dl);
                    if (t <= 0 || t >= 1)
                        continue;
                    if (len(cross(sub(pk, pa), d)) / dl <= tol)
                        on.push({ t, k });
                }
                on.sort((x, y) => x.t - y.t);
                for (const { k } of on)
                    out.push(k);
            }
            return { ...f, v: out };
        });
    }
    return { positions, faces };
};
const closedSolid = (name, m) => {
    const v = validate(m);
    if (!v.closed)
        throw new Error(`boolean needs closed solids: ${name} has ${v.openEdges} open edge(s)`);
    if (v.inside_out)
        throw new Error(`boolean needs outward faces: ${name} is inside out`);
};
/**
 * Boolean of two closed solids (outward CCW faces): 'union', 'subtract' (a minus b) or 'intersect'.
 * Throws with a reason when an input is open or inside out.
 */
export const boolean = (a, b, op) => {
    closedSolid('a', a);
    closedSolid('b', b);
    const sa = bounds(a);
    const sb = bounds(b);
    const scale = Math.max(sa.radius, sb.radius, 1e-9) * 2 + len(sub(sa.center, sb.center));
    EPS = scale * 1e-9 * 1000;
    const A = tree(polysOf(a));
    const B = tree(polysOf(b));
    if (op === 'union') {
        clipTo(A, B);
        clipTo(B, A);
        invert(B);
        clipTo(B, A);
        invert(B);
        build(A, all(B));
    }
    else if (op === 'subtract') {
        invert(A);
        clipTo(A, B);
        clipTo(B, A);
        invert(B);
        clipTo(B, A);
        invert(B);
        build(A, all(B));
        invert(A);
    }
    else {
        invert(A);
        clipTo(B, A);
        invert(B);
        clipTo(A, B);
        clipTo(B, A);
        build(A, all(B));
        invert(A);
    }
    return toMesh(all(A), scale);
};
export const union = (a, b) => boolean(a, b, 'union');
export const subtract = (a, b) => boolean(a, b, 'subtract');
export const intersect = (a, b) => boolean(a, b, 'intersect');
