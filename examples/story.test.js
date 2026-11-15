import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeBuildDocument, constructionAt, constructionIndexAtTime, cameraAt, narrationAt, FORMAT } from '../app/story.js';

// the viewer's story mode (app/story.js, Spider Build v2) with the small example in the + scene list
const doc = normalizeBuildDocument(JSON.parse(readFileSync(new URL('./spider-build-example.build.json', import.meta.url), 'utf8')));

test('a story file: validated, its construction replays to every moment, back and forth', () => {
  assert.equal(doc.format, FORMAT);
  const steps = doc.tracks.construction.steps;
  assert.equal(constructionIndexAtTime(doc, 0), 0);
  assert.equal(constructionIndexAtTime(doc, doc.timeline.durationMs), steps.length);
  assert.equal(constructionAt(doc, steps[0].timeMs).length, 1); // the block is put
  const moved = constructionAt(doc, steps[1].timeMs)[0];
  assert.notDeepEqual(moved.mesh.positions, constructionAt(doc, steps[0].timeMs)[0].mesh.positions); // then moved
  assert.equal(constructionAt(doc, doc.timeline.durationMs).length, 0); // and removed
  assert.equal(constructionAt(doc, steps[0].timeMs).length, 1); // seeking back brings it again
});

test('a story file: the camera and the narration of a moment', () => {
  const c = cameraAt(doc, 3000);
  assert.equal(c.eye.length, 3);
  assert.ok(Number.isFinite(c.yaw) && Number.isFinite(c.pitch));
  assert.ok(narrationAt(doc, 1000).length >= 1);
  assert.throws(() => normalizeBuildDocument({ format: FORMAT, version: 3 }));
});
