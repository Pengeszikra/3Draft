// The palette of redneck-wreck's core/materials.ts without textures: name + plain colour parameters.
import { MeshStandardMaterial } from './three-shim.mjs';

const mat = (name, p) => Object.assign(new MeshStandardMaterial(p), { name });
const glow = (name, emissive, emissiveIntensity = 2) => mat(name, { color: 0x111111, emissive, emissiveIntensity, roughness: 0.4 });
const dull = (name, color, roughness, metalness = 0, extra = {}) => mat(name, { color, roughness, metalness, ...extra });

export const makeMaterials = () => ({
  hullYellow: dull('hullYellow', 0xe09a1c, 0.55, 0.25),
  hullDark: dull('hullDark', 0x2d3034, 0.6, 0.55),
  hullRed: dull('hullRed', 0xb8303a, 0.6, 0.3),
  metal: dull('metal', 0x7d838a, 0.35, 0.85),
  darkMetal: dull('darkMetal', 0x26292d, 0.5, 0.7),
  chrome: dull('chrome', 0xd8dde2, 0.15, 1),
  rubber: dull('rubber', 0x151515, 0.9),
  yellowPaint: dull('yellowPaint', 0xe3a21b, 0.5, 0.2),
  hazard: dull('hazard', 0xd9a514, 0.6, 0.2),
  floor: dull('floor', 0x4a4e54, 0.55, 0.7),
  interior: dull('interior', 0x8a9096, 0.7, 0.2),
  ceiling: dull('ceiling', 0x6a7078, 0.8, 0.3),
  glass: dull('glass', 0x9fc9e8, 0.05, 0.1, { transparent: true, opacity: 0.22 }),
  fabric: dull('fabric', 0x3b4f63, 0.95),
  fabricRed: dull('fabricRed', 0x7a2a26, 0.95),
  mattress: dull('mattress', 0xc9c4b8, 1),
  white: dull('white', 0xe8e8e8, 0.6),
  wood: dull('wood', 0x6b5138, 0.8),
  lightStrip: glow('lightStrip', 0xfff2dd, 3),
  lightRed: glow('lightRed', 0xff2a1a, 3),
  lightGreen: glow('lightGreen', 0x2aff4a, 3),
  lightBlue: glow('lightBlue', 0x5fd0ff, 4),
  headlight: glow('headlight', 0xffffff, 6),
  reactorCore: glow('reactorCore', 0x48e8ff, 5),
  container: dull('container', 0x8a5a2a, 0.55, 0.3),
  radiator: dull('radiator', 0x7a5f4a, 0.5, 0.4),
  invisible: mat('invisible', { visible: false }),
  forceField: mat('forceField', { visible: false }),
  stationHull: dull('stationHull', 0x8d939a, 0.6, 0.45),
  stationInner: dull('stationInner', 0x596068, 0.7, 0.4),
  rust: dull('rust', 0x5b3d2c, 0.85, 0.4),
  rock: dull('rock', 0x6b6358, 0.95),
  warmWindow: glow('warmWindow', 0xffc98a, 0.9),
  blueWindow: glow('blueWindow', 0x86b8ff, 0.8),
});

export const screenMaterial = (title, _lines, color = '#43f0c8') => glowHex(`screen`, color);
export const labelMaterial = (_text, _fg, bg) => dull('label', 0xddd6c4, 0.6, 0, bg === 'rgba(0,0,0,0)' ? { visible: false } : {});
export const crateMaterial = (_label, color) => dull(`crate-${color}`, parseInt(String(color).replace('#', ''), 16) || 0x8a6a3a, 0.75, 0.2);
export const buttonsMaterial = () => glowHex('buttons', '#e0c060', 0.6);

function glowHex(name, c, i = 1.2) {
  return glow(name, parseInt(String(c).replace('#', ''), 16) || 0x43f0c8, i);
}
