// Tiny static server for the viewer (no dependencies).
// Usage: npm run app   ->  http://localhost:5173/app/   (PORT=1234 to change)
// Serves only app/, dist/ and examples/, and only on 127.0.0.1.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The viewer pages this server has (name -> path); the MCP live link reports them. */
export const VIEWERS = { '3draft': '/app/' };

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowed = new Set(['app', 'dist', 'examples']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
};

// Only answer requests addressed to the loopback host (blocks DNS rebinding).
const localHost = (req) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '');

/**
 * The viewer's static server. `extra(req, res, pathname)` may answer a request first
 * (return true when it did), e.g. the live scene endpoints of the MCP server.
 */
export const createViewerServer = (extra) =>
  createServer(async (req, res) => {
  try {
    if (!localHost(req)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (extra?.(req, res, path)) return;
    if (path === '/') {
      res.writeHead(302, { location: '/app/' });
      return res.end();
    }
    if (!path.endsWith('/') && !extname(path)) {
      // a folder without its trailing slash (/app): send the browser to the folder so relative paths work
      const dir = resolve(join(root, normalize(path)));
      const top = relative(root, dir).split(sep)[0];
      if (allowed.has(top) && (await stat(dir).catch(() => null))?.isDirectory()) {
        res.writeHead(302, { location: `${path}/` });
        return res.end();
      }
    }
    if (path.endsWith('/')) path += 'index.html';
    const file = resolve(join(root, normalize(path)));
    const rel = relative(root, file);
    if (rel.startsWith('..') || !allowed.has(rel.split(sep)[0])) {
      res.writeHead(404);
      return res.end('not found');
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 5173;
  createViewerServer().listen(port, '127.0.0.1', () => {
    console.log(`3Draft viewer: http://localhost:${port}/app/`);
  });
}
