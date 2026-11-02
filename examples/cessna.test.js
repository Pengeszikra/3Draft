import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, bounds } from '../src/index.js';
import { createScene } from '../mcp/scene.js';
import { cessna } from './cessna.js';

test('the Cessna is one valid mesh with several face colours', () => {
  const m = cessna();
  const v = validate(m);
  assert.ok(v.ok, v.notes);
  assert.ok(new Set(m.faces.map((f) => f.color)).size >= 8);
  const lowest = Math.min(...m.positions.map((p) => p[1]));
  assert.ok(Math.abs(lowest) < 0.01, 'the wheels touch y = 0');
});

test('the saved scene is one object and the MCP server can import it', () => {
  const saved = JSON.parse(readFileSync(new URL('./cessna.scene.json', import.meta.url), 'utf8'));
  assert.equal(saved.objects.length, 1);
  assert.deepEqual(saved.objects[0].mesh, JSON.parse(JSON.stringify(cessna())), 'run `node examples/cessna.js` to refresh the file');
  const scene = createScene();
  const r = scene.call('import', { path: 'examples/cessna.scene.json' });
  assert.ok(!r.isError, r.text);
  assert.equal(scene.data().objects.length, 1);
});
