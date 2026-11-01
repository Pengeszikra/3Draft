// Tiny static server for the viewer (no dependencies).
// Usage: npm run app   ->  http://localhost:5173/app/   (PORT=1234 to change)
// Serves only app/, src/ and examples/, and only on 127.0.0.1.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const allowed = new Set(['app', 'src', 'examples']);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path === '/') {
      res.writeHead(302, { location: '/app/' });
      return res.end();
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

server.listen(port, '127.0.0.1', () => {
  console.log(`3Draft viewer: http://localhost:${port}/app/`);
});
