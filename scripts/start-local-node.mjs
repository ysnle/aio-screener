import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const root = resolve(scriptDir, '..');
const portArg = Number(process.argv[2] || process.env.PORT || 8765);
// 0 asks the OS for a free port (browser gates, scripts/lib/browser-gate.mjs); the ready line names the one it got.
const port = Number.isFinite(portArg) && portArg >= 0 ? portArg : 8765;
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

// v59.70 (2nd batch A): two optional overlays, both off by default.
//   AIO_SERVE_ROOT          serve the code from another directory (a staged Pages bundle, scripts/ci-boot-interaction-check.mjs);
//                           public-data/ then comes from this repository, minus the paths the Pages deploy leaves out.
//   AIO_BROWSER_DATA_ROOT   a directory whose files replace public-data/<same path> (scripts/browser-data-fixture.mjs);
//                           a path the overlay does not have falls through to the normal file.
const codeRoot = process.env.AIO_SERVE_ROOT ? resolve(process.env.AIO_SERVE_ROOT) : root;
const dataOverlay = process.env.AIO_BROWSER_DATA_ROOT ? resolve(process.env.AIO_BROWSER_DATA_ROOT) : null;
const deployExcludes = codeRoot === root ? [] : (await import('./lib/pages-bundle-config.mjs')).PAGES_DATA_EXCLUDES;

function inside(base, abs) {
  return abs === base || abs.startsWith(base + sep);
}

function resolveRequestPath(urlPath) {
  let decoded = '/';
  try { decoded = decodeURIComponent(urlPath.split('?')[0] || '/'); } catch(e) { decoded = '/'; }
  let requested = normalize(decoded.replace(/^\/+/, ''));
  if (!requested || requested === '.') requested = 'index.html';
  const dataPath = requested.split(sep).join('/').startsWith('public-data/') ? requested.slice('public-data/'.length).split(sep).join('/') : null;
  if (dataPath != null && dataOverlay) {
    const overlaid = resolve(join(dataOverlay, dataPath));
    if (!inside(dataOverlay, overlaid)) return null;
    if (existsSync(overlaid) && statSync(overlaid).isFile()) return overlaid;
  }
  let base = codeRoot;
  if (dataPath != null && codeRoot !== root) {
    if (deployExcludes.some((entry) => entry.endsWith('/') ? dataPath.startsWith(entry) : dataPath === entry)) return join(codeRoot, '.not-deployed');
    if (!existsSync(join(codeRoot, requested))) base = root;
  }
  let abs = resolve(join(base, requested));
  if (existsSync(abs) && statSync(abs).isDirectory()) abs = join(abs, 'index.html');
  if (!inside(base, abs)) return null;
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
  console.log(`AIO local server: http://${host}:${server.address().port}/`);
  console.log(`Serving: ${codeRoot}${codeRoot !== root ? ` (public-data from ${root})` : ''}${dataOverlay ? ` (data overlay ${dataOverlay})` : ''}`);
  console.log('Stop with Ctrl+C.');
});
