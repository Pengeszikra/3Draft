import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('./server.js', import.meta.url));

const start = () => {
  const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, '3DRAFT_LIVE': '0' } });
  const lines = [];
  const waiting = [];
  createInterface({ input: child.stdout }).on('line', (l) => {
    const msg = JSON.parse(l); // stdout must carry JSON only
    const w = waiting.shift();
    if (w) w(msg);
    else lines.push(msg);
  });
  const next = () => (lines.length ? Promise.resolve(lines.shift()) : new Promise((r) => waiting.push(r)));
  const send = (obj) => child.stdin.write(`${typeof obj === 'string' ? obj : JSON.stringify(obj)}\n`);
  const rpc = async (id, method, params) => {
    send({ jsonrpc: '2.0', id, method, params });
    return next();
  };
  return { child, send, rpc, next, close: () => child.kill() };
};

test('handshake, tool list, a modelling session over stdio', async () => {
  const s = start();
  try {
    const init = await s.rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } });
    assert.equal(init.id, 1);
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.deepEqual(init.result.capabilities, { tools: {} });
    assert.equal(init.result.serverInfo.name, '3draft');
    assert.match(init.result.instructions, /render/);

    s.send({ jsonrpc: '2.0', method: 'notifications/initialized' }); // no reply expected

    const listed = await s.rpc(2, 'tools/list');
    const names = listed.result.tools.map((t) => t.name);
    for (const n of ['add_box', 'add_extrusion', 'add_mesh', 'transform', 'render', 'pick', 'inspect']) assert.ok(names.includes(n), n);

    const added = await s.rpc(3, 'tools/call', { name: 'add_box', arguments: { name: 'cube', at: [0, 0.5, 0] } });
    assert.equal(added.result.isError, undefined);
    assert.equal(JSON.parse(added.result.content[0].text).name, 'cube');

    const svg = await s.rpc(4, 'tools/call', { name: 'render', arguments: { view: 'front', size: 120 } });
    assert.equal(svg.result.content[0].type, 'text');
    assert.match(svg.result.content[0].text, /^<svg .*data-view="front"/s);

    const bad = await s.rpc(5, 'tools/call', { name: 'add_box', arguments: { name: 'cube' } });
    assert.equal(bad.result.isError, true);
    assert.match(bad.result.content[0].text, /already exists/);
  } finally {
    s.close();
  }
});

test('protocol errors: unknown method, bad JSON, bad request, ping, unknown version', async () => {
  const s = start();
  try {
    assert.equal((await s.rpc(1, 'nope/nope')).error.code, -32601);
    s.send('{not json');
    assert.equal((await s.next()).error.code, -32700);
    s.send({ jsonrpc: '2.0', id: 7 });
    const invalid = await s.next();
    assert.equal(invalid.error.code, -32600);
    assert.equal(invalid.id, 7);
    assert.deepEqual((await s.rpc(2, 'ping')).result, {});
    assert.equal((await s.rpc(3, 'tools/call', {})).error.code, -32602);
    const init = await s.rpc(4, 'initialize', { protocolVersion: '1999-01-01' });
    assert.equal(init.result.protocolVersion, '2025-06-18', 'offers its newest version');
  } finally {
    s.close();
  }
});
