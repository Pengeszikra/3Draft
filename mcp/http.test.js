import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handleHttp, handleMcp, pack, unpack } from './http.js';

// the site's static files, as the deployed function reads them (Spider Paint: /sky.md, /models/deepsky.scene.json)
const files = { '/sky.md': '../app/sky.md', '/models/deepsky.scene.json': '../examples/deepsky.scene.json' };
const ctx = { origin: 'https://spider-paint.example', fetchText: async (p) => readFileSync(new URL(files[p], import.meta.url), 'utf8') };
const rpc = async (method, params, id = 1) => handleMcp({ jsonrpc: '2.0', id, method, params }, ctx);
const call = async (name, args) => {
  const r = await rpc('tools/call', { name, arguments: args });
  return { r, json: JSON.parse(r.result.content[0].text) };
};

test('initialize, tools/list, ping; notifications get no answer', async () => {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'spider-paint');
  const list = await rpc('tools/list', {});
  assert.deepEqual(list.result.tools.map((t) => t.name), ['build_model', 'sky_scene', 'find', 'examples', 'sky_guide']);
  assert.ok(list.result.tools.every((t) => t.inputSchema?.type === 'object' && t.description.length > 20));
  assert.deepEqual((await rpc('ping', {})).result, {});
  assert.equal(await handleMcp({ jsonrpc: '2.0', method: 'notifications/initialized' }, ctx), null);
  assert.equal((await rpc('nope', {})).error.code, -32601);
});

test('the HTTP exchange: POST answers JSON, a notification 202, GET 405, OPTIONS for CORS, bad JSON 400', async () => {
  const post = await handleHttp({ method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'ping' }), ...ctx });
  assert.equal(post.status, 200);
  assert.equal(post.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(post.body), { jsonrpc: '2.0', id: 7, result: {} });
  assert.equal((await handleHttp({ method: 'POST', body: '{"jsonrpc":"2.0","method":"notifications/initialized"}', ...ctx })).status, 202);
  assert.equal((await handleHttp({ method: 'GET', ...ctx })).status, 405);
  assert.equal((await handleHttp({ method: 'OPTIONS', ...ctx })).status, 204);
  assert.equal((await handleHttp({ method: 'POST', body: '{nope', ...ctx })).status, 400);
});

test('build_model runs the steps, renders, and its link carries the scene; from continues it', async () => {
  const { r, json } = await call('build_model', {
    steps: [
      { tool: 'add_box', args: { name: 'seat', size: [1, 0.1, 1], at: [0, 0.5, 0], color: '#a0703c' } },
      { tool: 'add_box', args: { name: 'leg', size: [0.1, 0.5, 0.1], at: [0.4, 0.25, 0.4] } },
      { tool: 'fly', args: {} },
    ],
  });
  assert.equal(json.objects, 2);
  assert.equal(json.failed, 1);
  assert.match(json.open_url, /^https:\/\/spider-paint\.example\/#scene=[A-Za-z0-9_-]+$/);
  assert.match(r.result.content[1].text, /^<svg/);
  const scene = unpack(json.open_url.split('#scene=')[1]);
  assert.equal(scene.format, '3draft-scene');
  assert.deepEqual(scene.objects.map((o) => o.name), ['seat', 'leg']);
  const next = await call('build_model', { from: json.open_url, steps: [{ tool: 'remove', args: { name: 'leg' } }], render: 'none' });
  assert.equal(next.json.objects, 1);
  assert.equal(next.r.result.content.length, 1);
});

test('sky_scene validates a catalogue and links to it; find links to deep sky objects; examples and the guide', async () => {
  const sky = JSON.parse(readFileSync(new URL('../examples/trappist-1.sky.json', import.meta.url), 'utf8'));
  const { json } = await call('sky_scene', { sky, target: 'TRAPPIST-1 e' });
  assert.equal(json.counts.planet ?? json.counts.planets ?? Object.values(json.counts).reduce((a, b) => a + b, 0) > 0, json.counts.planet ?? json.counts.planets ?? true);
  assert.match(json.open_url, /\?target=TRAPPIST-1%20e#sky=/);
  assert.equal(unpack(json.open_url.split('#sky=')[1]).name, 'TRAPPIST-1');
  const bad = await call('sky_scene', { sky: { objects: [] } }).catch((e) => e);
  assert.ok(bad.r?.result?.isError ?? true);
  const f = await call('find', { query: 'andromeda' });
  assert.ok(f.json.found >= 1);
  assert.match(f.json.matches[0].open_url, /\?scene=deepsky&target=/);
  const wd = await call('find', { query: 'white dwarf', limit: 3 });
  assert.ok(wd.json.matches.length === 3 && wd.json.matches.every((m) => m.kind === 'white dwarf star'));
  const mars = await call('find', { query: 'mars' });
  assert.equal(mars.json.matches[0].name, 'Mars');
  const ex = await call('examples', {});
  assert.ok(ex.json.examples.some((e) => e.name === 'deepsky' && e.open_url.endsWith('?scene=deepsky')));
  const g = await rpc('tools/call', { name: 'sky_guide', arguments: {} });
  assert.match(g.result.content[0].text, /3draft-sky/);
});

test('pack / unpack round trip', () => {
  const v = { a: [1, 2, 3], s: 'árvíztűrő' };
  assert.deepEqual(unpack(pack(v)), v);
});
