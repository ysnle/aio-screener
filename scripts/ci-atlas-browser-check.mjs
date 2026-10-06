import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Atlas browser contract (2026-10-05 리서치 라이브러리 · 산업·밸류체인): the contents column holds the industry map
// (19 domains → 95 nodes), AI 기초 by layer and the relationship guides; the document reads as lead → value flow →
// body → misreading; the right column shows typed relations and related notes. Pinned here: the domain landing,
// deep links and URL sync, the lazy reading text, F0 modules, hidden process modules, the relationship-guide
// document, unified search, explicit failure with retry and the absence of internal copy.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.AIO_ATLAS_PORT || 8904);
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const INTERNAL_COPY = /REVIEWED_CANDIDATE|REFERENCE_CONNECTED|PS-\d+|TG-C\d+|출처|source seed|텔레그램|근거·경계 보기|검토된 참고|최신성 검증 경계/;

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const readyOnce = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (data) => { if (String(data).includes('AIO local server')) readyOnce(); });
    child.stderr.on('data', (data) => process.stderr.write(`[atlas-browser/server] ${data}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(readyOnce, 2000);
  });
}

async function openApp(page, query = '') {
  await page.goto(`${baseUrl}${query}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.AIO_ARCH === 'object' && typeof window.AIO_ARCH.navigate === 'function', { timeout: 30000 });
  const disclaimerButton = page.locator('#aio-first-visit-disclaimer button');
  if (await disclaimerButton.count()) await disclaimerButton.click();
}

const server = await startServer();
const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error' && !/ERR_FAILED|favicon|AIO:api|proxy-primary/i.test(message.text())) errors.push(message.text()); });
};
const local = (page) => page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
const article = (page) => page.evaluate(() => {
  const node = document.querySelector('#page-atlas .rl-main .af-article');
  return { node: node?.dataset.atlasNode || null, domain: node?.dataset.atlasDomain || null, module: node?.dataset.atlasModule || null, guide: node?.dataset.atlasRelationshipGuide || null, lead: node?.querySelector('.af-lead')?.textContent || '', paragraphs: node?.querySelectorAll('.af-prose p').length || 0, twist: node?.querySelector('.af-twist')?.textContent || '', text: node?.textContent || '' };
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  await local(page);
  await openApp(page);
  await page.evaluate(() => window.AIO_ARCH.navigate('atlas'));

  // Landing: the first domain overview with its reading text.
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-main .af-article[data-atlas-domain]') && document.querySelector('#page-atlas .rl-main .af-article .af-twist'));
  const landing = await page.evaluate(() => {
    const host = document.getElementById('page-atlas');
    return {
      shell: Boolean(host.querySelector('.rl-nav') && host.querySelector('.rl-main') && host.querySelector('.rl-aside')),
      title: host.querySelector('.rl-title')?.textContent || '',
      domains: host.querySelectorAll('.rl-nav [data-atlas-action="domain"]').length,
      sections: [...host.querySelectorAll('.rl-nav [data-atlas-action="section"]')].map((node) => node.dataset.atlasValue),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2
    };
  });
  const landingDoc = await article(page);
  if (!landing.shell || landing.title !== '산업·밸류체인' || landing.domains !== 19 || landing.sections.join(',') !== 'taxonomy,foundations,relationships' || landing.overflow || landingDoc.domain !== 'domain-cloud-platform' || landingDoc.lead.length < 80 || landingDoc.paragraphs < 2) throw new Error(`atlas landing incomplete: ${JSON.stringify({ landing, landingDoc })}`);
  if (INTERNAL_COPY.test(landingDoc.text)) throw new Error('domain overview shows internal/source copy');

  // Node: open a domain, then a node; reading text loads lazily and the URL follows the selection.
  await page.locator('#page-atlas .rl-nav [data-atlas-action="domain"][data-atlas-value="domain-power-grid"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-main .af-article')?.dataset.atlasDomain === 'domain-power-grid');
  await page.locator('#page-atlas .rl-nav [data-atlas-action="domain-node"][data-atlas-value="power-transformer"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-main .af-article')?.dataset.atlasNode === 'power-transformer' && document.querySelector('#page-atlas .rl-main .af-article .af-twist'));
  const nodeDoc = await article(page);
  const nodeAside = await page.evaluate(() => [...document.querySelectorAll('#page-atlas .rl-aside .rl-aside-title, #page-atlas .rl-aside h3, #page-atlas .rl-aside strong')].map((node) => node.textContent).join(' | '));
  const nodeUrl = new URL(page.url()).searchParams;
  if (nodeDoc.lead.length < 80 || nodeDoc.paragraphs < 2 || !nodeDoc.text.includes('가치가 흘러가는 길') || nodeUrl.get('node') !== 'power-transformer' || nodeUrl.get('domain') !== 'domain-power-grid' || !/연결/.test(nodeAside)) throw new Error(`industry node document incomplete: ${JSON.stringify({ nodeDoc: { ...nodeDoc, text: undefined }, nodeAside, url: page.url() })}`);
  if (INTERNAL_COPY.test(nodeDoc.text)) throw new Error('industry node shows internal/source copy');

  // AI 기초: F0 modules read, process modules are not listed, every module appears once.
  await page.locator('#page-atlas .rl-nav [data-atlas-action="section"][data-atlas-value="foundations"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .rl-nav [data-atlas-action="module"]').length > 40);
  const modules = await page.evaluate(() => [...document.querySelectorAll('#page-atlas .rl-nav [data-atlas-action="module"]')].map((node) => node.dataset.atlasValue));
  if (new Set(modules).size !== modules.length || modules.includes('claim-source-as-of') || modules.includes('human-review') || !modules.includes('problem-and-ability')) throw new Error(`AI foundation contents drifted: ${modules.length} modules`);
  await page.locator('#page-atlas .rl-nav [data-atlas-action="module"][data-atlas-value="problem-and-ability"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-main .af-article')?.dataset.atlasModule === 'problem-and-ability' && document.querySelector('#page-atlas .rl-main .af-article .af-twist'));
  const moduleDoc = await article(page);
  if (moduleDoc.lead.length < 80 || moduleDoc.paragraphs < 2 || /불러오는 중/.test(moduleDoc.text)) throw new Error('F0 module has no reading text');

  // Relationship guide document: stages, the open concept, typed links in words.
  await page.locator('#page-atlas .rl-nav [data-atlas-action="section"][data-atlas-value="relationships"]').click();
  await page.waitForFunction(() => document.querySelectorAll('#page-atlas .rl-nav [data-atlas-action="relationship-guide"]').length === 5);
  await page.locator('#page-atlas .rl-nav [data-atlas-action="relationship-guide"][data-atlas-value="nand-inference-fcf"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-main .af-article')?.dataset.atlasRelationshipGuide === 'nand-inference-fcf');
  await page.locator('#page-atlas .rl-main [data-atlas-action="relationship-node"][data-atlas-value="kv-cache"]').click();
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-main [data-atlas-action="relationship-node"][data-atlas-value="kv-cache"]')?.getAttribute('aria-pressed') === 'true');
  const guideDoc = await article(page);
  if (!guideDoc.text.includes('단계별로 보면') || !guideDoc.text.includes('이 개념의 연결') || INTERNAL_COPY.test(guideDoc.text) || await page.locator('#page-atlas .rl-main .atlas-relationship-guide').count()) throw new Error('relationship guide document incomplete or still embeds the old guide list');

  // Unified search.
  const search = page.locator('#page-atlas .rl-search input');
  await search.fill('포토닉스');
  await page.waitForFunction(() => document.querySelector('#page-atlas .rl-results [data-research-result="atlas:network-silicon-photonics"]'));
  await search.fill('');

  // Deep links on a fresh load.
  const deep = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(deep);
  await local(deep);
  for (const [query, check] of [
    ['?mode=taxonomy&domain=domain-memory-storage&view=domain#atlas', (doc) => doc.domain === 'domain-memory-storage'],
    ['?node=memory-dram-hbm#atlas', (doc) => doc.node === 'memory-dram-hbm'],
    ['?mode=foundations&chapter=F3&lesson=kv-cache#atlas', (doc) => doc.module === 'kv-cache'],
    ['?mode=relationships&guide=cpo-supply-map#atlas', (doc) => doc.guide === 'cpo-supply-map']
  ]) {
    await openApp(deep, query);
    await deep.waitForFunction(() => document.querySelector('#page-atlas .rl-main .af-article .af-issue'), null, { timeout: 15000 });
    await deep.waitForTimeout(300);
    const doc = await article(deep);
    if (!check(doc)) throw new Error(`deep link ${query} opened ${JSON.stringify({ node: doc.node, domain: doc.domain, module: doc.module, guide: doc.guide })}`);
  }
  if (new URL(deep.url()).searchParams.get('guide') !== 'cpo-supply-map') throw new Error('relationship deep link was not kept in the URL');

  // A failed industry-map load ends in a stated failure with a working retry.
  await deep.route('**/public-data/atlas/source-packets.json', (route) => route.abort());
  await openApp(deep, '?mode=taxonomy#atlas');
  await deep.waitForFunction(() => document.querySelector('#page-atlas .atlas-capability-errors[role="alert"] [data-atlas-action="retry-capability"]'), null, { timeout: 15000 });
  await deep.unroute('**/public-data/atlas/source-packets.json');
  await deep.locator('#page-atlas .atlas-capability-errors [data-atlas-action="retry-capability"]').first().click();
  await deep.waitForFunction(() => document.querySelectorAll('#page-atlas .rl-nav [data-atlas-action="domain"]').length === 19, null, { timeout: 15000 });
  await deep.close();

  if (errors.filter((text) => !/source-packets/.test(text)).length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ok: true, route: 'atlas', landing, modules: modules.length, nodeUrl: Object.fromEntries(nodeUrl) }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, errors: [...errors, String(error?.stack || error)] }));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
