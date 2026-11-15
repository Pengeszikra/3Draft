import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeBuildDocument, constructionAt, constructionIndexAtTime, cameraAt, narrationAt, animationAt, animationSkin, sceneAt, FORMAT } from '../app/story.js';

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

const animated = () => {
  const d=structuredClone(doc),name=d.tracks.construction.steps[0].changes[0].object.name;
  d.tracks.animation={timesMs:[0,9000],channels:[{id:'body',matrices:[[1,0,0,0,0,1,0,0,0,0,1,0],[1,0,0,9,0,1,0,0,0,0,1,0]]}],bindings:[{object:name,channel:'body'}]};
  return d;
};
test('animation interpolates independently of construction, holds endpoints, and seeks deterministically',()=>{
  const d=normalizeBuildDocument(animated()),a=animationAt(d,1000);
  assert.equal(a[3],1);assert.equal(animationAt(d,-100)[3],0);assert.equal(animationAt(d,10000)[3],9);
  assert.equal(animationAt(d,4500)[3],4.5);assert.deepEqual(animationAt(d,1000),a);
  const base=constructionAt(d,1000),moved=sceneAt(d,1000);
  assert.equal(moved[0].mesh.positions[0][0],base[0].mesh.positions[0][0]+1);
  const skin=animationSkin(d,base);assert.equal(skin.meshes[0],base[0].mesh);assert.deepEqual(skin.weights[0][0],[[0,1]]);
  d.tracks.camera.keyframes=[];d.tracks.narration.cues=[];assert.deepEqual(animationAt(d,1000),a);
});
test('animation validates references, finite matrices, timeline ordering and skin influences',()=>{
  for(const mutate of [
    d=>{d.tracks.animation.channels[0].matrices[0][0]=NaN},
    d=>{d.tracks.animation.timesMs=[9000,0]},
    d=>{d.tracks.animation.bindings[0].channel='missing'},
    d=>{d.tracks.animation.bindings[0].object='missing'},
    d=>{d.tracks.animation.channels[0].matrices.pop()},
    d=>{d.tracks.animation.bindings.push(d.tracks.animation.bindings[0])},
    d=>{delete d.tracks.animation.bindings[0].channel;d.tracks.animation.bindings[0].weights=[]}
  ]){const d=animated();mutate(d);assert.throws(()=>normalizeBuildDocument(d));}
});
test('recorded camera lenses and bank interpolate and remain optional in existing stories',()=>{
  const d=structuredClone(doc),c=d.tracks.camera;
  c.initialPose={eye:[0,0,0],yaw:0,pitch:0,roll:0,fov:40};
  c.keyframes=[{id:'lens',timeMs:2000,transition:'linear',pose:{eye:[1,0,0],yaw:10,pitch:5,roll:20,fov:80}}];
  normalizeBuildDocument(d);assert.equal(cameraAt(d,1000).fov,60);assert.equal(cameraAt(d,1000).roll,10);
  c.keyframes[0].pose.fov=180;assert.throws(()=>normalizeBuildDocument(d),/fov/);
});

test('emission samples interpolate independently, reset omitted channels, and validate their clock',()=>{
  const raw=animated();raw.tracks.animation.channels[0].emission=[0,2];
  const d=normalizeBuildDocument(raw),emission=new Float32Array(64).fill(99);
  animationAt(d,4500,undefined,emission);assert.equal(emission[0],1);assert.equal(emission[1],1);
  animationAt(d,9000,undefined,emission);assert.equal(emission[0],2);
  animationAt(d,0,undefined,emission);assert.equal(emission[0],0);
  for(const values of [[1],[-1,1],[NaN,1]]){const invalid=structuredClone(raw);invalid.tracks.animation.channels[0].emission=values;assert.throws(()=>normalizeBuildDocument(invalid));}
});
