// A galaxy as a recipe instead of a stored point set: a few numbers (kind, seed, shape) from which the same points are sampled
// every time, on the fly, when the viewer needs them (the galaxy is big enough on screen). The frame is the unit one: radius 1,
// the disc in the x-z plane (normal = y). Every point stands for millions of stars.
const BLUE = [170, 195, 255], WHITE = [255, 240, 225], GOLD = [255, 205, 140], RED = [255, 170, 105], PINK = [255, 190, 215];
const DEFAULT_N = { S: 1800, E: 1400, I: 700, D: 350 };
export const galaxyPoints = (g) => {
    let seed = (Math.abs(Math.floor(g.seed)) % 2147483646) + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const expo = (s) => -s * Math.log(1 - rnd());
    const mix = (a, b, t) => ((Math.round(a[0] + (b[0] - a[0]) * t) << 16) | (Math.round(a[1] + (b[1] - a[1]) * t) << 8) | Math.round(a[2] + (b[2] - a[2]) * t)) >>> 0;
    const n = Math.max(1, Math.round(g.n ?? DEFAULT_N[g.kind]));
    const out = { n, p: new Float32Array(n * 3), r: new Float32Array(n), c: new Uint32Array(n), l: new Float32Array(n) };
    let i = 0;
    const add = (x, y, z, r, c, l) => {
        if (i >= n)
            return;
        out.p[3 * i] = x;
        out.p[3 * i + 1] = y;
        out.p[3 * i + 2] = z;
        out.r[i] = r;
        out.c[i] = c;
        out.l[i] = l;
        i++;
    };
    const inside = (x, y, z) => x * x + y * y + z * z <= 1;
    let guard = n * 50; // rejection sampling never loops forever
    if (g.kind === 'S') {
        const arms = Math.max(1, Math.round(g.arms ?? 2));
        const tan = Math.tan((((g.pitch ?? 17) * Math.PI) / 180));
        const share = g.armShare ?? 0.6;
        const bar = g.bar ?? 0;
        const bulge = Math.round(n * 0.16);
        const barN = bar > 0 ? Math.round(n * 0.08) : 0;
        while (i < bulge && guard--)
            add(gauss() * 0.1, gauss() * 0.06, gauss() * 0.1, 0.04, mix(GOLD, RED, rnd() * 0.5), 1.4);
        while (i < bulge + barN && guard--)
            add((rnd() * 2 - 1) * bar, gauss() * 0.03, gauss() * bar * 0.18, 0.04, mix(GOLD, WHITE, rnd() * 0.4), 1.2);
        const r0 = Math.max(0.2, bar || 0.35); // the arms start at the end of the bar
        while (i < n && guard--) {
            const r = 0.06 + expo(0.3);
            if (r > 1)
                continue;
            const y = gauss() * 0.02;
            if (rnd() < share && r > r0 * 0.6) {
                const k = Math.floor(rnd() * arms);
                const th = Math.log(r / r0) / tan + (k * 2 * Math.PI) / arms + (gauss() * (0.04 + 0.07 * r)) / r;
                add(r * Math.cos(th), y, r * Math.sin(th), 0.035, rnd() < 0.55 ? mix(BLUE, WHITE, rnd() * 0.5) : mix(WHITE, GOLD, rnd() * 0.5), 1.1);
            }
            else {
                const th = rnd() * 2 * Math.PI;
                add(r * Math.cos(th), y, r * Math.sin(th), 0.037, mix(WHITE, GOLD, rnd() * 0.7), 0.8);
            }
        }
    }
    else if (g.kind === 'E') {
        const b = g.b ?? 0.8, c = g.c ?? 0.9;
        while (i < n && guard--) {
            const u = Math.max(rnd() ** (1 / 3), 1e-3);
            const s = 0.3 / Math.sqrt(Math.max(1e-6, u ** -2 - 1)); // the radius of a Plummer sphere (scale 0.3)
            if (s > 1)
                continue;
            const v = [gauss(), gauss(), gauss()], l = Math.hypot(v[0], v[1], v[2]) || 1;
            add((v[0] / l) * s, (v[1] / l) * s * b, (v[2] / l) * s * c, 0.04, mix(GOLD, RED, rnd() * 0.7), 1);
        }
    }
    else if (g.kind === 'I') {
        const clumps = Math.max(1, Math.round(g.clumps ?? 6));
        const centres = Array.from({ length: clumps }, () => [gauss() * 0.3, gauss() * 0.08, gauss() * 0.3, 0.07 + rnd() * 0.12]);
        while (i < n && guard--) {
            const [cx, cy, cz, s] = centres[Math.floor(rnd() * clumps)];
            const x = cx + gauss() * s, y = cy + gauss() * s * 0.5, z = cz + gauss() * s;
            if (!inside(x, y, z))
                continue;
            add(x, y, z, 0.05, rnd() < 0.2 ? mix(PINK, WHITE, rnd()) : mix(BLUE, WHITE, rnd() * 0.6), 1);
        }
    }
    else {
        while (i < n && guard--) {
            const x = gauss() * 0.28, y = gauss() * 0.22, z = gauss() * 0.28;
            if (!inside(x, y, z))
                continue;
            add(x, y, z, 0.07, mix(WHITE, GOLD, rnd()), 0.7);
        }
    }
    if (i < n)
        return { n: i, p: out.p.slice(0, 3 * i), r: out.r.slice(0, i), c: out.c.slice(0, i), l: out.l.slice(0, i) };
    return out;
};
