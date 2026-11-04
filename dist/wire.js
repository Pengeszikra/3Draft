// Drawing on a mesh: put a vertex on a surface, cut a face along a line between two vertices,
// move a vertex, close a loop of lines into a face. The wire is a list of [a, b] vertex pairs next to the mesh:
// its ends are ordinary mesh vertices, so moving a vertex moves every line (and every face) that uses it.
// Faces stay convex and planar: a vertex placed inside a face splits it into triangles, a cut splits a convex
// polygon into two convex ones, and a moved vertex turns the polygons it touches into triangles.
import { sub, add, scale, dot, len } from './vec.js';
import { faceNormal, bounds } from './mesh.js';
const sizeOf = (mesh) => bounds(mesh).radius || 1;
/** Distance from `p` to the segment a-b, and where along it (0..1). */
const toSegment = (p, a, b) => {
    const ab = sub(b, a);
    const l2 = dot(ab, ab) || 1;
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
    return { distance: len(sub(p, add(a, scale(ab, t)))), t };
};
const withFaces = (mesh, faces, positions = mesh.positions) => ({ ...mesh, positions, faces });
/**
 * Puts a vertex at `point`, which lies on face `face`. On an existing vertex it returns that one; on an edge it is
 * added to both faces that share the edge (no crack); inside the face it splits the face into triangles around it.
 * { mesh, index }
 */
export const insertVertex = (mesh, face, point) => {
    const eps = 1e-6 * sizeOf(mesh);
    const f = mesh.faces[face];
    const { positions } = mesh;
    for (const v of f.v)
        if (len(sub(positions[v], point)) <= eps * 10)
            return { mesh, index: v };
    const index = positions.length;
    const next = [...positions, point];
    const m = f.v.length;
    for (let j = 0; j < m; j++) {
        const a = f.v[j];
        const b = f.v[(j + 1) % m];
        if (toSegment(point, positions[a], positions[b]).distance > eps * 10)
            continue;
        // on the edge a-b: every face holding that edge (same positions, either direction) gets the new vertex
        const faces = mesh.faces.map((g, gi) => {
            const n = g.v.length;
            for (let k = 0; k < n; k++) {
                const p = positions[g.v[k]];
                const q = positions[g.v[(k + 1) % n]];
                const same = (len(sub(p, positions[a])) <= eps && len(sub(q, positions[b])) <= eps) || (len(sub(p, positions[b])) <= eps && len(sub(q, positions[a])) <= eps);
                if (same)
                    return { ...g, v: [...g.v.slice(0, k + 1), index, ...g.v.slice(k + 1)] };
            }
            return gi === face ? g : g;
        });
        return { mesh: withFaces(mesh, faces, next), index };
    }
    // inside: a fan of triangles around the new vertex, same side as the face
    const fan = f.v.map((v, j) => ({ ...f, v: [v, f.v[(j + 1) % m], index] }));
    return { mesh: withFaces(mesh, [...mesh.faces.slice(0, face), ...fan, ...mesh.faces.slice(face + 1)], next), index };
};
/**
 * Cuts the face that holds vertices `a` and `b` (not next to each other) along the line a-b: two convex faces.
 * `cut` is false when no face holds both, or they are already neighbours on every face.
 */
export const cutFace = (mesh, a, b) => {
    for (let fi = 0; fi < mesh.faces.length; fi++) {
        const f = mesh.faces[fi];
        const ia = f.v.indexOf(a);
        const ib = f.v.indexOf(b);
        if (ia < 0 || ib < 0)
            continue;
        const m = f.v.length;
        if ((ia - ib + m) % m === 1 || (ib - ia + m) % m === 1)
            continue;
        const walk = (from, to) => {
            const out = [f.v[from]];
            for (let k = from; k !== to;) {
                k = (k + 1) % m;
                out.push(f.v[k]);
            }
            return out;
        };
        const faces = [...mesh.faces.slice(0, fi), { ...f, v: walk(ia, ib) }, { ...f, v: walk(ib, ia) }, ...mesh.faces.slice(fi + 1)];
        return { mesh: withFaces(mesh, faces), cut: true };
    }
    return { mesh, cut: false };
};
/** Moves vertex `i` to `to`. Polygons that use it become triangles, so every face stays planar. */
export const moveVertex = (mesh, i, to) => {
    const positions = mesh.positions.map((p, k) => (k === i ? to : p));
    const faces = [];
    for (const f of mesh.faces) {
        if (f.v.length <= 3 || !f.v.includes(i))
            faces.push(f);
        else
            for (let j = 1; j < f.v.length - 1; j++)
                faces.push({ ...f, v: [f.v[0], f.v[j], f.v[j + 1]] });
    }
    return withFaces(mesh, faces, positions);
};
/**
 * A face from a closed loop of vertices. It is wound to point away from `awayFrom` (default: the middle of the
 * mesh), which is what a patch closing a gap in a surface wants; 4 or more vertices become a fan of triangles.
 */
export const fillLoop = (mesh, loop, face = {}, awayFrom = bounds(mesh).center) => {
    if (loop.length < 3)
        return mesh;
    const pts = loop.map((v) => mesh.positions[v]);
    const centre = scale(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);
    const ordered = dot(faceNormal(pts), sub(centre, awayFrom)) >= 0 ? loop : [...loop].reverse();
    const out = [];
    for (let j = 1; j < ordered.length - 1; j++)
        out.push({ ...face, v: [ordered[0], ordered[j], ordered[j + 1]] });
    return withFaces(mesh, [...mesh.faces, ...out]);
};
/** Adds the line a-b (not twice, not a point). */
export const addLine = (wire, a, b) => (a === b || wire.some(([p, q]) => (p === a && q === b) || (p === b && q === a)) ? wire : [...wire, [a, b]]);
/**
 * The shortest closed loop of lines through line [a, b], at most `max` vertices: [a, ..., b], or null.
 * Close it with fillLoop.
 */
export const findLoop = (wire, [a, b], max = 8) => {
    const near = new Map();
    for (const [p, q] of wire) {
        if ((p === a && q === b) || (p === b && q === a))
            continue; // not through the line itself
        near.set(p, [...(near.get(p) ?? []), q]);
        near.set(q, [...(near.get(q) ?? []), p]);
    }
    const from = new Map([[a, -1]]);
    const queue = [a];
    for (let head = 0; head < queue.length; head++) {
        const v = queue[head];
        if (v === b)
            break;
        for (const w of near.get(v) ?? [])
            if (!from.has(w))
                (from.set(w, v), queue.push(w));
    }
    if (!from.has(b))
        return null;
    const path = [];
    for (let v = b; v !== -1; v = from.get(v))
        path.unshift(v);
    return path.length <= max ? path : null;
};
/** The point of triangle a-b-c closest to p (Ericson, Real-Time Collision Detection). */
const closestOnTriangle = (p, a, b, c) => {
    const ab = sub(b, a);
    const ac = sub(c, a);
    const ap = sub(p, a);
    const d1 = dot(ab, ap);
    const d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0)
        return a;
    const bp = sub(p, b);
    const d3 = dot(ab, bp);
    const d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3)
        return b;
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0)
        return add(a, scale(ab, d1 / (d1 - d3)));
    const cp = sub(p, c);
    const d5 = dot(ab, cp);
    const d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6)
        return c;
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0)
        return add(a, scale(ac, d2 / (d2 - d6)));
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0)
        return add(b, scale(sub(c, b), (d4 - d3) / (d4 - d3 + (d5 - d6))));
    const denom = 1 / (va + vb + vc);
    return add(a, add(scale(ab, vb * denom), scale(ac, vc * denom)));
};
/**
 * The surface point of the mesh nearest to `p`, if it is within `tolerance`: { face, point } (point lies on the face),
 * otherwise null. For placing a point that was drawn near a surface on the surface.
 */
export const nearestSurface = (mesh, p, tolerance) => {
    let best = null;
    mesh.faces.forEach((f, face) => {
        const pts = f.v.map((v) => mesh.positions[v]);
        for (let j = 1; j < pts.length - 1; j++) {
            const q = closestOnTriangle(p, pts[0], pts[j], pts[j + 1]);
            const d = len(sub(q, p));
            if (d <= tolerance && (!best || d < best.d))
                best = { face, point: q, d };
        }
    });
    return best ? { face: best.face, point: best.point } : null;
};
/**
 * Turns line segments (pairs of points) into wire on the mesh: each end becomes a vertex (an existing one within
 * `tolerance`, a new one on the surface when it is near it, otherwise a free point in the air), each segment a line,
 * and two ends on one face cut that face. Returns the new mesh and wire.
 */
export const wireFromSegments = (mesh, wire, segments, tolerance) => {
    let m = mesh;
    let w = wire;
    const vertexAt = (p) => {
        const near = m.positions.findIndex((q) => len(sub(q, p)) <= tolerance);
        if (near >= 0)
            return near;
        const s = nearestSurface(m, p, tolerance);
        if (s) {
            const r = insertVertex(m, s.face, s.point);
            m = r.mesh;
            return r.index;
        }
        m = { ...m, positions: [...m.positions, p] };
        return m.positions.length - 1;
    };
    for (const [a, b] of segments) {
        const ia = vertexAt(a);
        const ib = vertexAt(b);
        if (ia === ib)
            continue;
        w = addLine(w, ia, ib);
        m = cutFace(m, ia, ib).mesh;
    }
    return { mesh: m, wire: w };
};
/**
 * Moves several vertices at once: `moves` is [[index, newPosition], ...]. A polygon whose vertices all moved by the
 * same step (a face dragged as a whole) stays as it is; any other polygon that uses a moved vertex becomes triangles,
 * so every face stays planar.
 */
export const moveVertexSet = (mesh, moves) => {
    const to = new Map(moves);
    const positions = mesh.positions.map((p, k) => to.get(k) ?? p);
    const step = (v) => sub(positions[v], mesh.positions[v]);
    const faces = [];
    for (const f of mesh.faces) {
        if (f.v.length <= 3 || !f.v.some((v) => to.has(v))) {
            faces.push(f);
            continue;
        }
        const first = step(f.v[0]);
        const rigid = f.v.every((v) => len(sub(step(v), first)) < 1e-9 * (bounds(mesh).radius || 1));
        if (rigid)
            faces.push(f);
        else
            for (let j = 1; j < f.v.length - 1; j++)
                faces.push({ ...f, v: [f.v[0], f.v[j], f.v[j + 1]] });
    }
    return withFaces(mesh, faces, positions);
};
