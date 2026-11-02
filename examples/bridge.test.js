import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../dist/index.js';
import { createScene } from '../mcp/scene.js';
import { bridgeObjects } from './bridge.js';

test('every part of the bridge is a valid closed shell', () => {
  const objects = bridgeObjects();
  assert.equal(objects.length, 50);
  assert.equal(new Set(objects.map((o) => o.name)).size, 50, 'names are unique');
  for (const o of objects) assert.ok(validate(o.mesh).ok, `${o.name}: ${validate(o.mesh).notes}`);
});

test('the saved scene file matches the builder and the MCP server can import it', () => {
  const saved = JSON.parse(readFileSync(new URL('./bridge.scene.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved.objects, JSON.parse(JSON.stringify(bridgeObjects())), 'run `node examples/bridge.js` to refresh the file');
  const scene = createScene();
  const r = scene.call('import', { path: 'examples/bridge.scene.json' });
  assert.ok(!r.isError, r.text);
  assert.equal(scene.data().objects.length, 50);
});
