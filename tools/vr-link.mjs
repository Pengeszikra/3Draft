#!/usr/bin/env node
// The VR link: a small WebSocket server for Spider Paint's VR workshop (VR-WORKSHOP.md, "The VR tape"). No dependencies.
//
//   node tools/vr-link.mjs [--port 8787] [--dir vr-recordings]
//     The headset's page (opened with ?vrlink=ws://localhost:8787) sends every workshop frame here. Each VR session is written
//     to <dir>/vr-<time>.jsonl (one message a line) and, when it ends, also as <dir>/vr-<time>.vr.json (a recording that
//     play in Spider Paint opens). Every page opened with ?vrwatch=ws://localhost:8787 gets the frames live and plays them.
//
//   node tools/vr-link.mjs play <file.vr.json | file.jsonl> [--port 8787] [--loop]
//     Plays a saved session to the watching pages in its own time (no headset needed).
//
// The headset reaches this computer's localhost through adb: connect the Quest (USB, or wireless adb) and run
//   adb reverse tcp:8787 tcp:8787
// then the headset's ws://localhost:8787 is this server. (A plain ws:// to another address is refused by the browser on an
// https page; localhost is allowed.)

import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, createWriteStream, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const port = Number(opt('port', 8787));
const dir = opt('dir', 'vr-recordings');
const playFile = args[0] === 'play' ? args[1] : null;
const loop = args.includes('--loop');

// ---- a minimal WebSocket (RFC 6455): text messages, ping / pong, close
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const encode = (text) => {
  const data = Buffer.from(text);
  const n = data.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([head, data]);
};
const clients = new Set(); // { socket, role }
const sendTo = (c, text) => {
  if (!c.socket.destroyed) c.socket.write(encode(text));
};
const watchers = () => [...clients].filter((c) => c.role !== 'headset');

const accept = (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const acceptKey = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${acceptKey}`, '', ''].join('\r\n'));
  const c = { socket, role: 'watcher', buf: Buffer.alloc(0), parts: [] };
  clients.add(c);
  socket.on('data', (chunk) => {
    c.buf = Buffer.concat([c.buf, chunk]);
    for (;;) {
      if (c.buf.length < 2) return;
      const b0 = c.buf[0], b1 = c.buf[1];
      const fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let n = b1 & 0x7f, off = 2;
      if (n === 126) {
        if (c.buf.length < 4) return;
        n = c.buf.readUInt16BE(2);
        off = 4;
      } else if (n === 127) {
        if (c.buf.length < 10) return;
        n = Number(c.buf.readBigUInt64BE(2));
        off = 10;
      }
      const maskAt = off;
      if (masked) off += 4;
      if (c.buf.length < off + n) return;
      let payload = c.buf.subarray(off, off + n);
      if (masked) {
        const mask = c.buf.subarray(maskAt, maskAt + 4);
        payload = Buffer.from(payload.map((x, i) => x ^ mask[i & 3]));
      }
      c.buf = c.buf.subarray(off + n);
      if (op === 0x8) return void socket.end(Buffer.from([0x88, 0]));
      if (op === 0x9) {
        socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]));
        continue;
      }
      if (op === 0x1 || op === 0x0) {
        c.parts.push(payload);
        if (fin) {
          const text = Buffer.concat(c.parts).toString('utf8');
          c.parts = [];
          message(c, text);
        }
      }
    }
  });
  const gone = () => clients.delete(c);
  socket.on('close', gone);
  socket.on('error', gone);
};

// ---- the headset's session: to the watchers and to a file
let file = null, fileName = null, lines = 0;
let session = []; // the session's messages so far: a watcher that comes late gets them first, to catch up
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const openFile = () => {
  mkdirSync(dir, { recursive: true });
  fileName = join(dir, `vr-${stamp()}`);
  file = createWriteStream(`${fileName}.jsonl`);
  lines = 0;
  console.log(`recording to ${fileName}.jsonl`);
};
const closeFile = () => {
  if (!file) return;
  const name = fileName;
  file.end(() => {
    // the session as one recording that Spider Paint's play opens
    try {
      writeFileSync(`${name}.vr.json`, JSON.stringify(toRecording(readFileSync(`${name}.jsonl`, 'utf8'))));
      console.log(`saved ${name}.vr.json (${lines} lines)`);
    } catch (err) {
      console.log(`could not write ${name}.vr.json: ${err.message}`);
    }
  });
  file = null;
};
const toRecording = (text) => {
  const msgs = text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const start = msgs.find((m) => m.type === 'start');
  if (!start) throw new Error('no start in it');
  const { type, ...head } = start;
  const frames = msgs.filter((m) => m.type === 'f').map(({ type: _t, ...f }) => f);
  return { ...head, duration: frames.length ? frames[frames.length - 1].t : 0, frames };
};
const message = (c, text) => {
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return;
  }
  if (m.type === 'hello') {
    c.role = m.role === 'headset' ? 'headset' : 'watcher';
    console.log(`${c.role} connected${m.ua ? ` (${m.ua.slice(0, 60)})` : ''}`);
    if (c.role === 'watcher') for (const line of session) sendTo(c, line);
    return;
  }
  if (c.role !== 'headset') return;
  if (m.type === 'start') {
    closeFile();
    openFile();
    session = [];
    console.log(`session started: ${m.scene?.objects?.length ?? 0} objects`);
  }
  if (file) (file.write(`${text}\n`), lines++);
  if (m.type === 'start' || m.type === 'f') session.push(text);
  for (const w of watchers()) sendTo(w, text);
  if (m.type === 'rec') console.log(m.on ? 'the headset is recording' : 'the headset stopped recording');
  if (m.type === 'end') (console.log('session ended'), closeFile(), (session = []));
};

// ---- playing a saved session to the watchers
const playSaved = async (path) => {
  const text = readFileSync(path, 'utf8');
  const rec = path.endsWith('.jsonl') ? toRecording(text) : JSON.parse(text);
  const { frames, ...head } = rec;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  do {
    while (!watchers().length) await wait(500);
    console.log(`playing ${path}: ${frames.length} frames, ${Math.round((rec.duration ?? 0) / 1000)} s`);
    for (const w of watchers()) sendTo(w, JSON.stringify({ ...head, type: 'start' }));
    await wait(1500); // (the watching page loads the scene)
    const t0 = Date.now();
    for (const f of frames) {
      const due = f.t - (Date.now() - t0);
      if (due > 0) await wait(due);
      const line = JSON.stringify({ type: 'f', ...f });
      for (const w of watchers()) sendTo(w, line);
    }
    for (const w of watchers()) sendTo(w, JSON.stringify({ type: 'end' }));
    await wait(1000);
  } while (loop);
};

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(`3Draft VR link\n${[...clients].map((c) => c.role).join(', ') || 'nobody connected'}\n${file ? `recording to ${fileName}.jsonl` : ''}\n`);
});
server.on('upgrade', accept);
server.listen(port, () => {
  console.log(`VR link on ws://localhost:${port}`);
  console.log('  headset: open Spider Paint with ?vrlink=ws://localhost:' + port + '  (and run: adb reverse tcp:' + port + ' tcp:' + port + ')');
  console.log('  desktop: open Spider Paint with ?vrwatch=ws://localhost:' + port);
  if (playFile) playSaved(playFile).then(() => !loop && setTimeout(() => process.exit(0), 500));
});
