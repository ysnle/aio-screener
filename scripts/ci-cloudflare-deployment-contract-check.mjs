import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const proxyToml = read('worker/wrangler.proxy.toml');
const dataToml = read('worker/wrangler.example.toml');
const proxyWorkflow = read('.github/workflows/deploy-ai-proxy.yml');
const dataWorkflow = read('.github/workflows/deploy-data-plane.yml');
const worker = read('cloudflare-worker-proxy.js');
const errors = [];
const check = (label, ok) => { if (!ok) errors.push(label); };

for (const [name, toml] of [['proxy', proxyToml], ['data-plane', dataToml]]) {
  check(`${name} enables Workers Logs`, /\[observability\][\s\S]*?enabled\s*=\s*true/.test(toml));
  check(`${name} declares a bounded sampling rate`, /head_sampling_rate\s*=\s*(?:0(?:\.\d+)?|1(?:\.0+)?)/.test(toml));
}
check('proxy health exposes its deployment revision', /AIO_APP_REVISION/.test(proxyToml) && /env\.AIO_APP_REVISION/.test(worker));
check('both Workers expose an exact deployment source SHA', [proxyToml, dataToml].every((toml) => /AIO_SOURCE_SHA/.test(toml)) && /env\.AIO_SOURCE_SHA/.test(worker) && /sourceSha:\s*env\?\.AIO_SOURCE_SHA/.test(read('worker/data-plane.js')));
for (const [name, workflow] of [['proxy', proxyWorkflow], ['data-plane', dataWorkflow]]) {
  check(`${name} deployment is manual`, /workflow_dispatch/.test(workflow));
  check(`${name} deployment has concurrency ownership`, /concurrency:[\s\S]*?cancel-in-progress:\s*false/.test(workflow));
  check(`${name} Wrangler is exact-versioned`, /wrangler@\d+\.\d+\.\d+/.test(workflow));
  check(`${name} deployment runs source contracts first`, /qa-runner\.mjs\s+--group\s+cloudflare\s+--no-cache/.test(workflow));
  check(`${name} deployment verifies live health`, /health/.test(workflow) && /curl/.test(workflow));
  // P1159: this gate used to accept any exact wrangler pin without checking the runtime it needs.
  // A version unification that looked purely cosmetic then failed the fast-plane deploy with
  // "Wrangler requires at least Node.js v22.0.0. You are using v20.20.2" — the old 4.44.0 pin was
  // load-bearing for Node 20, not a stale preference. Read both numbers, not just their shape.
  const wranglerPin = workflow.match(/wrangler@(\d+)\.(\d+)\.(\d+)/);
  const nodeVersion = workflow.match(/node-version:\s*'(\d+)'/);
  check(`P1159 ${name} deploy runs Wrangler on Node >= 22`, !!wranglerPin && !!nodeVersion && Number(nodeVersion[1]) >= 22);
  check(`${name} deployment renders and verifies GITHUB_SHA`, /GITHUB_SHA/.test(workflow) && /sourceSha/.test(workflow));
}

if (errors.length) {
  console.error('Cloudflare deployment contract failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log('Cloudflare deployment contract OK: manual authority, source gate, exact Wrangler, observability and post-deploy health.');
