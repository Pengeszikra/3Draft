import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createScene } from './scene.js';
import { startLive } from './live.js';

const get = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body, type: res.headers['content-type'] }));
    }).on('error', reject);
  });

/** Opens /events and collects the `scene` events as they arrive. */
const listen = (base) => {
  const events = [];
  const waiters = [];
  let buf = '';
  const req = http.get(`${base}/events`, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = block.split('\n').find((l) => l.startsWith('data: '));
        if (block.includes('event: scene') && data) {
          const ev = JSON.parse(data.slice(6));
          events.push(ev);
          waiters.splice(0).forEach((w) => w());
        }
      }
    });
  });
  const next = async (n) => {
    while (events.length < n) await new Promise((r) => waiters.push(r));
    return events[n - 1];
  };
  return { next, events, close: () => req.destroy() };
};

test('the viewer gets the scene on connect and after every change', async () => {
  const scene = createScene();
  const live = await startLive(scene, { port: 0 });
  const base = `http://127.0.0.1:${live.port}`;
  try {
    assert.match(live.url, /^http:\/\/localhost:\d+\/app\/$/);

    const first = await get(`${base}/scene`);
    assert.equal(first.status, 200);
    assert.deepEqual(JSON.parse(first.body).objects, []);

    const feed = listen(base);
    const hello = await feed.next(1);
    assert.equal(hello.format, '3draft-scene');
    assert.deepEqual(hello.objects, []);
    assert.equal(live.clients(), 1);

    scene.call('add_box', { name: 'cube', at: [0, 0.5, 0], color: '#336699' });
    const added = await feed.next(2);
    assert.equal(added.objects.length, 1);
    assert.equal(added.objects[0].name, 'cube');
    assert.equal(added.objects[0].mesh.faces[0].color, '#336699');
    assert.ok(added.rev > hello.rev);

    scene.call('render', {}); // reading changes nothing, so nothing is pushed
    scene.call('add_box', { name: 'cube' }); // a failed call neither
    scene.call('transform', { name: 'cube', move: [1, 0, 0] });
    const moved = await feed.next(3);
    assert.equal(feed.events.length, 3, 'only successful changes are pushed');
    assert.equal(moved.objects[0].mesh.positions[0][0], 0.5);

    scene.call('clear');
    assert.deepEqual((await feed.next(4)).objects, []);
    feed.close();
  } finally {
    await live.close();
  }
});

test('the viewer files are served, anything else is not', async () => {
  const live = await startLive(createScene(), { port: 0 });
  const base = `http://127.0.0.1:${live.port}`;
  try {
    const page = await get(`${base}/app/`);
    assert.equal(page.status, 200);
    assert.match(page.body, /3Draft/);
    const bare = await new Promise((resolve) => http.get(`${base}/app`, (res) => { res.resume(); resolve(res); }));
    assert.equal(bare.statusCode, 302, '/app without the slash redirects to /app/');
    assert.equal(bare.headers.location, '/app/');
    assert.equal((await get(`${base}/src/index.js`)).status, 200);
    assert.equal((await get(`${base}/package.json`)).status, 404);
    assert.equal((await get(`${base}/mcp/scene.js`)).status, 404);
    assert.equal((await get(`${base}/..%2fpackage.json`)).status, 404);
    assert.equal((await get(`${base}/scene`, { host: 'evil.example' })).status, 403, 'DNS rebinding is refused');
  } finally {
    await live.close();
  }
});

test('the viewer tool reports the URL, and a taken port moves on to the next one', async () => {
  const scene = createScene();
  assert.equal(JSON.parse(scene.call('viewer').text).url, null);
  const a = await startLive(scene, { port: 0 });
  scene.info.live = a;
  const b = await startLive(createScene(), { port: a.port, tries: 5 });
  try {
    assert.ok(b.port > a.port && b.port < a.port + 5);
    const r = JSON.parse(scene.call('viewer').text);
    assert.equal(r.url, a.url);
    assert.equal(r.open_tabs, 0);
  } finally {
    await a.close();
    await b.close();
  }
});

test('gives up cleanly when no port is free', async () => {
  const a = await startLive(createScene(), { port: 0 });
  try {
    assert.equal(await startLive(createScene(), { port: a.port, tries: 1 }), null);
  } finally {
    await a.close();
  }
});
