import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ROUTE_IDS } from '../src/app/routes.js';

const label = process.argv[2] || 'sample';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid sample label');
const origin = 'http://127.0.0.1:8917';
const server = spawn(process.execPath, ['scripts/start-local-node.mjs', '8917'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  server.stdout.on('data', chunk => { if (String(chunk).includes('AIO local server')) resolve(); });
  server.on('error', reject);
  server.on('exit', code => reject(new Error(`server exited ${code}`)));
});
let browser;
function summarizeProfile(profile) {
  const totals = new Map();
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  for (let i = 0; i < (profile.samples || []).length; i++) {
    const frame = nodes.get(profile.samples[i])?.callFrame;
    const key = `${frame?.functionName || '(anonymous)'} ${frame?.url || ''}:${(frame?.lineNumber || 0) + 1}`;
    totals.set(key, (totals.get(key) || 0) + (profile.timeDeltas?.[i] || 0) / 1000);
  }
  return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 60);
}
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.addInitScript(() => {
    window.__perfTasks = [];
    new PerformanceObserver(list => window.__perfTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.start');
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.AIO_ARCH && !!window.__AIO_ARCH_RUNTIME__);
  await page.waitForTimeout(7000);
  const { profile: bootProfile } = await cdp.send('Profiler.stop');
  const boot = await page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, tasks: window.__perfTasks, resources: performance.getEntriesByType('resource').filter(e => e.name.startsWith(location.origin)).map(e => ({ path: new URL(e.name).pathname, bytes: e.decodedBodySize })) }));
  const routes = [];
  await cdp.send('Profiler.start');
  for (const route of ROUTE_IDS) {
    const result = await page.evaluate(async route => {
      const start = performance.now();
      window.showPage(route);
      const syncMs = performance.now() - start;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { route, syncMs, paintMs: performance.now() - start };
    }, route);
    await page.waitForTimeout(350);
    Object.assign(result, await page.evaluate(route => {
      const page = document.getElementById(`page-${route}`);
      return { nodes: page?.getElementsByTagName('*').length, module: page?.dataset.aioRouteModuleState, active: page?.classList.contains('active') };
    }, route));
    routes.push(result);
  }
  const { profile } = await cdp.send('Profiler.stop');
  const cpuSelfMs = summarizeProfile(profile);
  await page.evaluate(() => window.showPage('screener'));
  await page.waitForTimeout(500);
  const unrelatedDispatch = await page.evaluate(() => {
    const observer = new MutationObserver(() => {});
    observer.observe(document.getElementById('page-screener'), { subtree: true, childList: true, attributes: true, characterData: true });
    const start = performance.now();
    for (let i = 0; i < 10; i++) window.AIO_ARCH.ingestSentiment({});
    const ms = performance.now() - start;
    const mutations = observer.takeRecords().length;
    observer.disconnect();
    return { ms, mutations };
  });
  const result = { label, environment: { browser: browser.version(), externalNetwork: 'aborted', viewport: '1440x900' }, boot, routes, unrelatedDispatch, cpuSelfMs, bootCpuSelfMs: summarizeProfile(bootProfile) };
  mkdirSync('_artifacts/performance-hunt-20260906', { recursive: true });
  writeFileSync(`_artifacts/performance-hunt-20260906/${label}.cpuprofile`, JSON.stringify(bootProfile));
  writeFileSync(`_artifacts/performance-hunt-20260906/${label}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ label, routes, unrelatedDispatch }, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
