// A globe: a blue ocean ball and seven continents, each continent ONE closed mesh (a slab of land cells that follows the
// sphere: top, bottom and coast walls). The outlines are hand-simplified (a few dozen points per continent), the land is
// sampled on a 2.5 degree grid, so the coasts are blocky on purpose. Nothing is downloaded: the data is in this file.
// `node examples/globe.js` checks the parts and writes examples/globe.scene.json + examples/out/globe.svg.
// y is the polar axis (north up), lon 0 / lat 0 looks to +z, east is +x.

import { writeFileSync } from 'node:fs';
import { validate, renderView, merge, orbit, health } from '../dist/index.js';

const MATERIALS = [
  { name: 'ocean', color: '#2a6fb0', metal: 0, rough: 0.35, alpha: 1, emit: 0, soft: 0 },
  { name: 'north-america', color: '#7dbd62', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'south-america', color: '#d9a24a', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'europe', color: '#c9775e', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'africa', color: '#e2c25c', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'asia', color: '#d46b73', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'oceania', color: '#4fb5a5', metal: 0, rough: 0.85, alpha: 1, emit: 0, soft: 0 },
  { name: 'antarctica', color: '#eef3f7', metal: 0, rough: 0.6, alpha: 1, emit: 0, soft: 0 },
];
const COLOR = Object.fromEntries(MATERIALS.map((m) => [m.name, m.color]));

// [lon, lat] outlines, one list of polygons per continent
const LAND = {
  'north-america': [
    [[-168,66],[-163,69],[-156,71],[-141,70],[-125,70],[-110,68],[-96,68],[-93,62],[-94,58.5],[-90,57],[-82,55],[-79,52],[-78,58],[-77,62],[-72,62],[-65,60],[-61,56],[-56,52],[-60,50],[-66,50],[-64,47],[-60,46],[-66,44],[-70,42],[-74,40],[-76,37],[-76,35],[-81,31],[-80,26],[-82,26.5],[-83,29.5],[-85,30],[-89,30],[-94,29.5],[-97,27],[-97.5,22],[-96,19],[-94,18],[-91,19],[-90,21],[-87,21.5],[-88,16],[-84,15.5],[-83,11],[-80,9],[-77.5,8.5],[-79,7.5],[-82,8],[-85.5,10],[-87.5,13],[-92,14.5],[-96,16],[-101,17.5],[-105.5,20],[-105,23],[-109,26],[-112,29],[-115,30],[-117,33],[-120.5,34.5],[-122.5,37.5],[-124,40.5],[-124,46],[-124.5,48.5],[-128,51],[-131,54.5],[-134,58],[-140,60],[-146,60.5],[-152,59],[-158,57],[-164,54.5],[-165,60]],
    [[-73,78],[-60,82],[-30,83.5],[-18,81],[-20,75],[-22,70],[-32,68],[-42,62],[-44,60],[-50,62],[-54,67],[-58,75],[-67,76]],
    [[-115,73],[-100,73],[-85,73],[-80,70],[-90,68.5],[-105,69],[-115,70]], // the arctic islands, in one piece
    [[-85,22],[-80,23],[-74,20],[-78,20],[-85,21.7]], // Cuba
  ],
  'south-america': [
    [[-77.5,8.5],[-72,12],[-65,10.5],[-60,8.5],[-52,5],[-50,0],[-44,-2],[-35,-5],[-35,-9],[-39,-14],[-39,-18],[-41,-22],[-48,-25.5],[-48.5,-28],[-53,-34],[-58,-35],[-57,-38],[-62,-39],[-65,-42],[-65,-46],[-68,-50],[-69,-52.5],[-68,-55],[-72,-54],[-75,-50],[-74,-43],[-73.5,-37],[-71.5,-30],[-70.5,-18],[-76,-14],[-81,-6],[-80,-2],[-80,1],[-78,2.5],[-77,7]],
  ],
  europe: [
    [[-9,37],[-9.5,43],[-2,43.5],[-1.2,46],[-4.5,48.5],[-1.5,48.7],[1.5,50.8],[4,51.8],[7,53.5],[8.5,55],[8.3,57],[10.5,57.7],[10.8,56],[10,54.8],[12,54.2],[14,54],[18,54.8],[21,55.5],[21,57],[24,57.3],[24.3,58.3],[23.5,59.3],[28,59.5],[30,60],[26,60.5],[22,60],[21.5,62],[22,64],[25,65.3],[23.5,66],[21,65],[18,62.5],[17.5,60.5],[19,59.7],[16.5,57.5],[16,56],[13,55.4],[12.5,56.5],[11.5,58.5],[10.5,59.5],[8,58],[5.5,59],[5,61.5],[8,63.5],[12,65.5],[15,68],[19,70],[25,71],[30,70],[33,69.5],[41,67],[44,66.5],[44,68.5],[53,68.5],[60,69],[60,51],[55,50.5],[49.5,46.5],[47,43],[44.5,42],[40,43.5],[37.5,45],[38,47],[35,46.5],[33.5,44.5],[31,46.5],[29.8,45.2],[28.8,43.5],[28,42],[26.5,40.5],[24,40.5],[23,39.2],[24,37.8],[22.8,36.5],[21.5,37],[21,39],[19.5,40.5],[19.3,42],[16,43.5],[13.7,45.6],[12.3,44.8],[13.5,43.5],[16,41.9],[18.5,40.2],[17,39],[16.5,38],[15.7,38],[16.5,39.5],[15.5,40.2],[14,40.8],[12,41.5],[10.5,43],[8.7,44.4],[7.5,43.8],[4,43.3],[3,42],[3.2,41.7],[0.8,41],[-0.3,39.5],[0,38.7],[-1,37.5],[-4.5,36.5],[-6,36.3]],
    [[-5.5,50],[1.5,51],[1.8,52.7],[0,53.5],[-2,55.8],[-2,57.5],[-4,58.6],[-6,57.5],[-5,55.5],[-3,54.5],[-3,53.4],[-4.5,53.3],[-4.5,52],[-5.2,51.7],[-3,51.4]], // Great Britain
    [[-10,52],[-6,52.2],[-6,54.5],[-8,55.2],[-10,54]], // Ireland
    [[-24,65.5],[-18,66.5],[-14,65],[-18,63.5],[-22,63.8]], // Iceland
  ],
  africa: [
    [[-9.5,30.5],[-6,35.8],[10,37.2],[11,33],[20,32],[32,31.3],[32.5,29.5],[36,22],[37.5,18],[39,15.5],[43.2,12],[51.2,11.8],[48,4.5],[41,-1.5],[39,-5],[40.5,-11],[40.5,-15],[35,-19.5],[35.5,-24],[33,-26],[32.5,-28.5],[28,-33],[25,-34],[20,-34.8],[18.4,-34],[16,-28.5],[14,-22],[11.8,-17],[13,-12],[12,-6],[9.5,-1],[9.5,3.5],[6,4.3],[4,6.3],[-2,5],[-8,4.5],[-13,8],[-15,11],[-17,14.7],[-16.5,19],[-17,21],[-13,27.5],[-10,29]],
    [[49.5,-12],[50.5,-15.5],[47,-25],[44,-25],[43.5,-21],[44.5,-16],[47,-14]], // Madagascar
  ],
  asia: [
    [[60,69],[68,72],[73,72.5],[80,73.5],[87,75],[100,77],[105,77.5],[113,74],[127,73.5],[140,72.5],[150,71.5],[160,70],[170,70],[180,68.5],[180,65],[172,64],[166,61],[163,58],[160,54],[156,51],[155.5,57],[157,61.5],[150,59.5],[143,59],[137,54],[141,53],[140,48],[135,43],[131,42.5],[129.5,41],[128,39],[129.5,36],[126.5,34.5],[126,37],[125,39.5],[121,40],[122,37],[119,37],[121.5,32],[122,30],[120,26],[116,22.5],[110,21],[108,21.5],[106,18],[108.5,15],[109,11.5],[105,8.8],[104.5,9],[103,10.5],[101,12.7],[100,13.5],[100,10],[100.3,8],[100.4,6.5],[103.5,4],[104.2,1.5],[103.5,1.3],[101,3],[98.5,8],[98.5,12],[97.5,16.5],[94.5,16],[94,19],[92,22],[89,22],[87,21.5],[85,19.5],[80.5,15.5],[80,10],[77.5,8.2],[76,10.5],[73,17],[72.8,20.5],[70,21],[68.5,23.5],[66.5,25.3],[61.5,25.2],[57,25.7],[56.5,27],[54,26.7],[51,28],[48.5,29.9],[50,27],[51.5,24.5],[54,24],[56,26],[56.5,24.5],[58.5,23.6],[59.8,22.5],[57.8,19],[55,17],[52,16],[49,14],[45,12.8],[43.3,12.7],[42.5,16],[40,21],[38,25],[35,28.5],[34.5,28],[33,28.5],[32.6,30],[34.3,31.2],[35.5,33.8],[36,36.5],[32,36.2],[28,36.7],[27,38],[26.5,39.5],[26.2,40.5],[28,41.2],[29.5,41.2],[35,42],[38,41],[41.5,41.5],[40,43.5],[44.5,42],[47,43],[49.5,46.5],[55,50.5],[60,51]],
    [[130.8,33.8],[132.5,35.5],[136,36.5],[139,38],[140,41.3],[142,40],[142,38],[140.8,35.7],[138,34.7],[135,33.6],[133,34]], // Honshu
    [[140,42],[141.5,45.3],[145,43.5],[142,42]], // Hokkaido
    [[80,9.8],[82,7.5],[81,6],[80,6.5],[79.8,8.5]], // Sri Lanka
    [[95.3,5.6],[98,4],[104,-1.5],[106,-5.8],[102,-4],[98,0]], // Sumatra
    [[109,1.5],[111,2],[115,5],[117,7],[119,5],[117.5,1],[116,-3.5],[113,-3.3],[110,-2.8]], // Borneo
    [[105.3,-6.8],[108,-6.3],[114.4,-7.8],[114.5,-8.5],[106,-7.5]], // Java
    [[119.5,-5.3],[120.5,-2.8],[121.5,1],[125,1.5],[120,0.5],[119.7,-0.5]], // Sulawesi
    [[120.5,18.5],[122.2,18.4],[122,14],[124,13],[121,13.7],[120,15]], // Luzon
    [[122,7],[126.5,7],[126,9.5],[125,9.5],[123,8.5]], // Mindanao
  ],
  oceania: [
    [[114,-22],[114,-26],[115,-34],[118,-35],[123.5,-34],[129,-31.5],[131,-31.5],[135,-34.8],[137,-33],[138,-35.5],[140,-38],[144,-38.5],[147,-38],[150,-37.5],[153,-31],[153.5,-26],[150,-22.5],[146,-19],[145,-15],[143.5,-14],[142.5,-10.8],[141,-13],[140.8,-17.5],[139,-17],[136,-15],[136.8,-12],[132,-11.3],[130,-13],[128,-14.8],[125,-14.5],[123,-17],[121,-19.5],[117,-20.5]],
    [[145,-41],[148,-41],[147.5,-43.5],[145.5,-43]], // Tasmania
    [[172.7,-34.5],[175,-37],[178,-37.7],[176,-39.5],[175,-41.5],[174.8,-39.5],[174,-39],[174.5,-37]], // New Zealand, north
    [[172.7,-40.5],[174,-41.5],[171,-44.5],[168,-46.5],[166.5,-46],[170,-43]], // New Zealand, south
    [[131,-1],[135,-3.3],[138,-1.7],[145,-4],[147.5,-6],[150,-10.5],[147,-10],[144,-7.8],[141,-9],[138,-8],[137.5,-5.5],[133.5,-4]], // New Guinea
  ],
  antarctica: [
    [[-70,-72],[-62,-64],[-57,-63.5],[-60,-67],[-65,-70]], // the peninsula
  ],
};
const LAKES = [[[47,45],[50,46.5],[53,45],[52.5,41],[54,40],[53.8,37],[50,37],[49,38.5],[49.5,40.5],[47.5,42.5]]]; // Caspian Sea

const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const CONTINENTS = ['europe', 'north-america', 'south-america', 'africa', 'asia', 'oceania', 'antarctica']; // Europe first: it wins on its border
const owner = (lon, lat) => {
  if (lat <= -72) return 'antarctica';
  if (LAKES.some((l) => inside(l, lon, lat))) return null;
  for (const name of CONTINENTS) if (LAND[name].some((p) => inside(p, lon, lat))) return name;
  return null;
};

const STEP = 2.5;
const NX = 360 / STEP; // lon cells
const NY = 180 / STEP; // lat cells
const R_BOTTOM = 0.97;
const R_TOP = 1.035;
const grid = Array.from({ length: NX }, (_, i) => Array.from({ length: NY }, (_, j) => owner(-180 + (i + 0.5) * STEP, -90 + (j + 0.5) * STEP)));
// Two cells that touch only at a corner would make a pinched, non-manifold solid: fill the gap (or, if another
// continent owns it, drop one of the two cells).
for (let again = true, guard = 0; again && guard < 20; guard++) {
  again = false;
  const g = (i, j) => (j < 0 || j >= NY ? undefined : grid[((i % NX) + NX) % NX][j]);
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NY; j++) {
      const a = g(i, j);
      if (!a) continue;
      for (const di of [1, -1]) {
        if (g(i + di, j + 1) !== a || g(i + di, j) === a || g(i, j + 1) === a) continue;
        again = true;
        if (!g(i + di, j)) grid[(((i + di) % NX) + NX) % NX][j] = a;
        else if (!g(i, j + 1)) grid[i][j + 1] = a;
        else grid[(((i + di) % NX) + NX) % NX][j + 1] = null;
      }
    }
}

/** A node of the lon/lat grid on a sphere of radius r (lon 0 looks to +z, east is +x, north is +y). */
const node = (i, j, r) => {
  const lon = ((-180 + i * STEP) * Math.PI) / 180;
  const lat = ((-90 + j * STEP) * Math.PI) / 180;
  return [r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon)];
};

const continent = (name) => {
  const positions = [];
  const ids = new Map();
  const at = (i, j, r) => {
    i = ((i % NX) + NX) % NX;
    // the poles are one point, however many longitudes meet there
    const key = j === 0 || j === NY ? `${j}|${r}` : `${i}|${j}|${r}`;
    if (!ids.has(key)) (ids.set(key, positions.length), positions.push(node(i, j, r)));
    return ids.get(key);
  };
  const faces = [];
  const tri = (a, b, c) => {
    if (a !== b && b !== c && a !== c) faces.push({ v: [a, b, c], mat: name, color: COLOR[name] });
  };
  const quad = (a, b, c, d) => (tri(a, b, c), tri(a, c, d));
  const mine = (i, j) => j >= 0 && j < NY && grid[((i % NX) + NX) % NX][j] === name;
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NY; j++) {
      if (!mine(i, j)) continue;
      const T = (a, b) => at(i + a, j + b, R_TOP);
      const B = (a, b) => at(i + a, j + b, R_BOTTOM);
      quad(T(0, 0), T(1, 0), T(1, 1), T(0, 1)); // the surface, seen from outside it turns counter-clockwise
      quad(B(0, 0), B(0, 1), B(1, 1), B(1, 0)); // the underside, the other way round
      if (!mine(i - 1, j)) quad(T(0, 0), T(0, 1), B(0, 1), B(0, 0)); // west coast
      if (!mine(i + 1, j)) quad(T(1, 1), T(1, 0), B(1, 0), B(1, 1)); // east coast
      if (!mine(i, j - 1)) quad(T(1, 0), T(0, 0), B(0, 0), B(1, 0)); // south coast
      if (!mine(i, j + 1)) quad(T(0, 1), T(1, 1), B(1, 1), B(0, 1)); // north coast
    }
  return { positions, faces };
};

const ocean = () => {
  const SEG = 48;
  const RINGS = 24;
  const positions = [[0, 1, 0]];
  for (let i = 1; i < RINGS; i++)
    for (let j = 0; j < SEG; j++) {
      const th = (Math.PI * i) / RINGS;
      const ph = (2 * Math.PI * j) / SEG;
      positions.push([Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)]);
    }
  positions.push([0, -1, 0]);
  const faces = [];
  const f = (a, b, c) => faces.push({ v: [a, b, c], mat: 'ocean', color: COLOR.ocean });
  const R = (i, j) => 1 + (i - 1) * SEG + (j % SEG);
  for (let j = 0; j < SEG; j++) f(0, R(1, j), R(1, j + 1));
  for (let i = 1; i < RINGS - 1; i++)
    for (let j = 0; j < SEG; j++) (f(R(i, j), R(i + 1, j + 1), R(i, j + 1)), f(R(i, j), R(i + 1, j), R(i + 1, j + 1)));
  for (let j = 0; j < SEG; j++) f(R(RINGS - 1, j), positions.length - 1, R(RINGS - 1, j + 1));
  return { positions, faces };
};
// the ball sits a hair under the land's underside, so nothing of it shows through
const scaled = (m, k) => ({ ...m, positions: m.positions.map((p) => p.map((c) => c * k)) });

export const globe = () => {
  const NAMES = { europe: 'Europe', 'north-america': 'North America', 'south-america': 'South America', africa: 'Africa', asia: 'Asia', oceania: 'Oceania', antarctica: 'Antarctica' };
  return {
    palette: MATERIALS,
    objects: [{ name: 'Ocean', mesh: scaled(ocean(), 1.0) }, ...['north-america', 'south-america', 'europe', 'africa', 'asia', 'oceania', 'antarctica'].map((n) => ({ name: NAMES[n], mesh: continent(n) }))],
  };
};

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const { palette, objects } = globe();
  let total = 0;
  for (const o of objects) {
    const v = validate(o.mesh);
    const h = health(o.mesh);
    total += o.mesh.faces.length;
    console.log(o.name.padEnd(14), String(o.mesh.faces.length).padStart(6), 'faces', v.ok ? 'valid' : v.notes.slice(0, 3), h.allSolid ? 'closed solid' : `open: ${h.skippedFaces} faces`);
  }
  console.log('total faces', total);
  writeFileSync(new URL('./globe.scene.json', import.meta.url), JSON.stringify({ format: '3draft-scene', version: 1, palette, objects }));
  const all = merge(...objects.map((o) => o.mesh));
  const pal = Object.fromEntries(palette.map(({ name, ...m }) => [name, m]));
  for (const [file, yaw] of [['globe', -0.5], ['globe-east', 1.1]]) {
    writeFileSync(new URL(`./out/${file}.svg`, import.meta.url), renderView(all, orbit({ yaw, pitch: 0.35 }), { size: 900, points: false, palette: pal, occlude: true }));
  }
}
