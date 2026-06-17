import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(scriptDir, '..');
const portArg = Number(process.argv[2] || process.env.PORT || 8765);
const port = Number.isFinite(portArg) && portArg > 0 ? portArg : 8765;
const host = process.argv[3] || process.env.BIND || '127.0.0.1';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf'
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function resolveRequestPath(urlPath) {
  let decoded = '/';
  try { decoded = decodeURIComponent(urlPath.split('?')[0] || '/'); } catch(e) { decoded = '/'; }
  let requested = normalize(decoded.replace(/^\/+/, ''));
  if (!requested || requested === '.') requested = 'index.html';
  let abs = resolve(join(root, requested));
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, 'index.html');
  if (abs !== root && !abs.startsWith(root + sep)) return null;
  return abs;
}

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || '/');
  if (!filePath) return send(res, 403, 'Forbidden');
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return send(res, 404, 'Not found');
  res.writeHead(200, {
    'Content-Type': types[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`AIO local server: http://${host}:${port}/`);
  console.log(`Serving: ${root}`);
  console.log('Stop with Ctrl+C.');
});
