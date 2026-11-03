// Materials are data. A palette is a plain object { name: Material }; a face points at an entry by name
// (`face.mat`) and keeps its own `color` as a fallback, so a mesh still looks right without the palette.
// One shader draws all of them; the numbers below are the only knobs.
const clamp01 = (n, fallback) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback);
export const FALLBACK_COLOR = '#c8c8c8';
export const DEFAULTS = { metal: 0, rough: 0.7, alpha: 1, emit: 0 };
/** The surface of a face: its palette entry when it names one, else just its color with default properties. */
export const surfaceOf = (face, palette) => {
    const m = face.mat !== undefined ? palette?.[face.mat] : undefined;
    return {
        color: m?.color ?? face.color ?? FALLBACK_COLOR,
        metal: clamp01(m?.metal, DEFAULTS.metal),
        rough: clamp01(m?.rough, DEFAULTS.rough),
        alpha: clamp01(m?.alpha, DEFAULTS.alpha),
        emit: clamp01(m?.emit, DEFAULTS.emit),
    };
};
