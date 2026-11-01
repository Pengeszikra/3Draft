// The live link: the MCP process also serves the viewer and pushes the scene to it.
//   GET /app/      the viewer (same files as `npm run app`)
//   GET /scene     the scene as JSON
//   GET /events    Server-Sent Events: a `scene` event on connect and after every change
// Loopback only. The viewer in the browser is read-only, the AI edits through MCP.

import { createViewerServer } from '../app/serve.js';

/**
 * Starts the server on `port` (0 = any free port); when it is taken, tries the next
 * `tries` ports. Resolves { url, port, clients(), close() }, or null when none was free.
 */
export const startLive = async (scene, { port = 5173, tries = 10 } = {}) => {
  const clients = new Set();
  const send = (res) => res.write(`event: scene\ndata: ${JSON.stringify(scene.data())}\n\n`);

  const extra = (req, res, path) => {
    if (req.method !== 'GET') return false;
    if (path === '/scene') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      res.end(JSON.stringify(scene.data()));
      return true;
    }
    if (path === '/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' });
      res.write('retry: 1000\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      send(res);
      return true;
    }
    return false;
  };

  const unsubscribe = scene.subscribe(() => clients.forEach(send));
  const ping = setInterval(() => clients.forEach((res) => res.write(': ping\n\n')), 20000);
  ping.unref();

  for (let i = 0; i < tries; i++) {
    const p = port === 0 ? 0 : port + i;
    const server = createViewerServer(extra);
    const ok = await new Promise((resolve) => {
      server.once('error', () => resolve(false));
      server.listen(p, '127.0.0.1', () => resolve(true));
    });
    if (!ok) continue;
    const bound = server.address().port;
    return {
      url: `http://localhost:${bound}/app/`,
      port: bound,
      clients: () => clients.size,
      close: () => {
        unsubscribe();
        clearInterval(ping);
        clients.forEach((res) => res.end());
        server.closeAllConnections?.();
        return new Promise((r) => server.close(r));
      },
    };
  }
  unsubscribe();
  clearInterval(ping);
  return null;
};
