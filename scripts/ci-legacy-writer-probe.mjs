// v59.70 L0 (legacy core wave 2): which classic js/aio-*.js functions still write into each route's page, measured in a
// real browser. Text/HTML setters and node insertion are wrapped; a write inside a .page is attributed to the first
// script frame on the stack (a classic file, an index.html inline block, or src/**). The allowlist
// (architecture/legacy-writer-allowlist.json) is the set of `file function` pairs per route measured when it was written;
// it only shrinks. A new legacy writer on a route fails here: the writer belongs in src/ (native) instead.
//   node scripts/ci-legacy-writer-probe.mjs            check against the allowlist
//   node scripts/ci-legacy-writer-probe.mjs --write    re-measure and record (only after moving writers out)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowPath = path.join(repo, 'architecture/legacy-writer-allowlist.json');
const write = process.argv.includes('--write');
const routes = JSON.parse(fs.readFileSync(path.join(repo, 'architecture/route-owners.json'), 'utf8')).routes;
const ROUTES = Object.keys(routes).filter((route) => route !== 'theme-detail');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(repo, url === '/' ? 'index.html' : url);
  if (!file.startsWith(repo)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
});
const port = Number(process.env.AIO_LEGACY_WRITER_PORT || 8967);
await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const measured = {};
try {
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { try { localStorage.setItem('aio_disclaimer_ack_v1', '1'); } catch (_) { /* storage blocked */ } });
    const page = await context.newPage();
    await page.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.continue() : r.abort()));
    await page.addInitScript(() => {
      const log = (window.__aioWrites = []);
      const who = () => {
        for (const line of String(new Error().stack || '').split('\n').slice(3)) {
          const match = /(\/js\/aio-[a-z-]+\.js|\/index\.html|\/src\/[^:?)]+)/.exec(line);
          if (match) return { file: match[1], fn: (/at ([^ (]+) \(/.exec(line) || [])[1] || '?' };
        }
        return null;
      };
      const note = (node) => {
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        const owner = el?.closest?.('.page');
        if (!owner) return;
        const writer = who();
        if (writer) log.push({ page: owner.id, ...writer });
      };
      const wrapSetter = (proto, prop) => {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc?.set) Object.defineProperty(proto, prop, { ...desc, set(value) { note(this); return desc.set.call(this, value); } });
      };
      wrapSetter(Node.prototype, 'textContent');
      wrapSetter(Element.prototype, 'innerHTML');
      wrapSetter(HTMLElement.prototype, 'innerText');
      for (const [proto, name] of [[Node.prototype, 'appendChild'], [Node.prototype, 'insertBefore'], [Element.prototype, 'replaceChildren'], [Element.prototype, 'append'], [Element.prototype, 'insertAdjacentHTML']]) {
        const original = proto[name];
        proto[name] = function (...args) { note(this); return original.apply(this, args); };
      }
    });
    await page.goto(`${origin}/index.html#${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6500);
    const writes = await page.evaluate(() => window.__aioWrites);
    const legacy = new Set(writes.filter((w) => w.page === `page-${route}` && w.file.startsWith('/js/')).map((w) => `${w.file.replace('/js/', '')} ${w.fn}`));
    measured[route] = [...legacy].sort();
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (write) {
  const doc = {
    schemaVersion: 'legacy-writer-allowlist-v1',
    measuredBy: 'scripts/ci-legacy-writer-probe.mjs',
    rule: 'Classic js/aio-*.js functions that still write into a route page (text/HTML setters, node insertion) at boot, desktop 1440. Only shrinks: a new legacy writer belongs in src/.',
    routes: measured
  };
  fs.writeFileSync(allowPath, JSON.stringify(doc, null, 2) + '\n');
  console.log(`[legacy-writer-probe] recorded ${Object.values(measured).reduce((t, list) => t + list.length, 0)} legacy writers over ${ROUTES.length} routes`);
  process.exit(0);
}
const allow = JSON.parse(fs.readFileSync(allowPath, 'utf8')).routes || {};
const failures = [];
const shrunk = [];
for (const route of ROUTES) {
  const allowed = new Set(allow[route] || []);
  for (const key of measured[route]) if (!allowed.has(key)) failures.push(`${route}: new legacy writer ${key}`);
  for (const key of allowed) if (!measured[route].includes(key)) shrunk.push(`${route}: ${key}`);
}
if (shrunk.length) console.log(`[legacy-writer-probe] ${shrunk.length} allowlisted writer(s) no longer write; run with --write to tighten:\n - ${shrunk.join('\n - ')}`);
if (failures.length) {
  console.error(`[legacy-writer-probe] FAIL\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`[legacy-writer-probe] PASS ${Object.values(measured).reduce((t, list) => t + list.length, 0)} legacy writers, none new`);
