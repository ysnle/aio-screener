import fs from 'node:fs';

const source = fs.readFileSync('sw.js', 'utf8');
const fail = (message) => { throw new Error(`[sw-cache-policy] ${message}`); };
const block = source.match(/const CRITICAL_SHELL_ASSETS = \[([\s\S]*?)\n\];/)?.[1] || '';
const critical = [...block.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
if (!critical.length || critical.length > 12) fail(`critical precache count must be 1..12, got ${critical.length}`);
if (critical.some((asset) => /^https?:\/\//.test(asset))) fail('external CDN assets must not block service-worker install');
for (const required of ['./', './index.html', './version.json', './src/app/bootstrap.js']) {
  if (!critical.includes(required)) fail(`critical asset missing: ${required}`);
}
const installBlock = source.slice(source.indexOf("self.addEventListener('install'"), source.indexOf("self.addEventListener('activate'"));
if (!/cache\.addAll\(CRITICAL_SHELL_ASSETS\)/.test(installBlock)) fail('critical assets are not installed atomically');
if (/Promise\.allSettled|PUBLISHED_RUNTIME_ASSETS/.test(installBlock)) fail('install path still fans out to the full runtime registry or hides partial failures');
if (!/RUNTIME_SHELL_PATH_RE/.test(source) || !/isRuntimeShell/.test(source)) fail('requested js/src modules are not runtime cached');
console.log(`Service-worker cache policy OK: ${critical.length} critical assets; route modules are request-driven.`);
