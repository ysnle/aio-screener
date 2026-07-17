import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const port = 8904;
const baseUrl = `http://127.0.0.1:${port}/index.html`;
const shotsDir = resolve(here, 'screens');
mkdirSync(shotsDir, { recursive: true });

const routes = ['home','signal','breadth','sentiment','briefing','market-news','technical','screener','macro','fxbond','fundamental','themes','portfolio','kr-home','kr-supply','kr-themes','kr-macro','kr-technical','guide'];
const compRoutes = new Set(['home','signal','briefing','breadth','sentiment','technical','macro','fxbond','fundamental','themes','portfolio','market-news','screener']);
const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
};

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const done = () => { if (!ready) { ready = true; resolveServer(child); } };
    child.stdout.on('data', (d) => { if (String(d).includes('AIO local server')) done(); });
    child.stderr.on('data', (d) => process.stderr.write(String(d)));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(done, 1800);
  });
}

function attachNetworkBoundary(page, requestLog) {
  page.on('request', (req) => requestLog.push(req.url()));
  return page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://127.0.0.1:${port}/`)) return route.continue();
    return route.abort();
  });
}

async function waitForApp(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof window.showPage === 'function' && window.AIO_ROUTE_REGISTRY, null, { timeout: 30000 });
  await page.waitForTimeout(1800);
}

async function surfaceAudit(page, viewportName, route) {
  await page.evaluate((id) => window.showPage(id), route);
  await page.waitForTimeout(route.startsWith('kr-') ? 650 : 300);
  const metrics = await page.evaluate(({ route, comp }) => {
    const pageEl = document.getElementById('page-' + route);
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const overflowEls = [];
    if (pageEl) {
      pageEl.querySelectorAll('*').forEach((el) => {
        if (!shown(el) || el.closest('#ai-panel')) return;
        const r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) return;
        if (r.right <= innerWidth + 2 && r.left >= -2) return;
        let p = el.parentElement, scrollOwned = false;
        while (p && p !== pageEl) {
          const pcs = getComputedStyle(p);
          if ((pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth) { scrollOwned = true; break; }
          p = p.parentElement;
        }
        if (!scrollOwned && overflowEls.length < 6) overflowEls.push((el.id ? '#' + el.id : el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0,2).join('.') : el.tagName));
      });
    }
    const text = pageEl ? (pageEl.innerText || '').replace(/\s+/g, ' ').trim() : '';
    const title = pageEl && pageEl.querySelector('.page-title, h1, h2');
    const topbar = document.querySelector('.topbar-actions-right');
    const topRect = topbar && topbar.getBoundingClientRect();
    return {
      route,
      active: !!(pageEl && pageEl.classList.contains('active')),
      title: title ? title.textContent.trim() : '',
      textLength: text.length,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      overflowEls,
      visibleFundamentals: pageEl ? Array.from(pageEl.querySelectorAll('.aio-fund')).filter(shown).length : -1,
      visibleAdvanced: pageEl ? Array.from(pageEl.querySelectorAll('.aio-page-advanced-toggle')).filter(shown).length : -1,
      dashRun: /—\s*—\s*—/.test(text),
      topbarWithinViewport: !topRect || (topRect.left >= -1 && topRect.right <= innerWidth + 1),
      compContract: !comp || (!!pageEl && Array.from(pageEl.querySelectorAll('.aio-fund')).filter(shown).length === 0)
    };
  }, { route, comp: compRoutes.has(route) });
  const path = resolve(shotsDir, `${viewportName}-${route}.png`);
  await page.screenshot({ path, fullPage: false });
  return metrics;
}

async function glossaryAudit(page, viewportName) {
  await page.evaluate(() => window.openGlossary());
  await page.waitForTimeout(150);
  const metrics = await page.evaluate(() => {
    const modal = document.getElementById('glossary-modal');
    const body = document.getElementById('glossary-body');
    const r = modal && modal.getBoundingClientRect();
    return {
      route: 'glossary',
      active: !!modal && getComputedStyle(modal).display !== 'none',
      title: '투자 용어사전',
      textLength: body ? body.innerText.trim().length : 0,
      itemCount: body ? body.querySelectorAll('.aio-glossary-item').length : 0,
      documentOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      overflowEls: [],
      visibleFundamentals: 0,
      visibleAdvanced: 0,
      dashRun: false,
      topbarWithinViewport: !r || r.right <= innerWidth + 1,
      compContract: true
    };
  });
  await page.screenshot({ path: resolve(shotsDir, `${viewportName}-glossary.png`), fullPage: false });
  await page.evaluate(() => {
    if (typeof window._aioCloseGlossary === 'function') window._aioCloseGlossary();
    else document.getElementById('glossary-modal').style.display = 'none';
  });
  return metrics;
}

async function createContactSheet(browser, viewportName, routeGroup, suffix) {
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const cells = routeGroup.map((route) => {
    const src = `http://127.0.0.1:${port}/_artifacts/live-human-ux-v5290/screens/${viewportName}-${route}.png`;
    return `<figure><figcaption>${viewportName} · ${route}</figcaption><img src="${src}"></figure>`;
  }).join('');
  await sheet.setContent(`<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#d8d2c8;font-family:Arial,sans-serif}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}figure{margin:0;background:#fff;padding:6px;box-shadow:0 1px 4px #888}figcaption{font-size:14px;font-weight:700;padding:3px 2px 7px}img{display:block;width:100%;height:auto;object-fit:contain;object-position:top;border:1px solid #bbb}</style><div class="grid">${cells}</div>`);
  await sheet.waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0));
  await sheet.screenshot({ path: resolve(here, `contact-${viewportName}-${suffix}.png`), fullPage: true });
  await sheet.close();
}

const server = await startServer();
const browser = await chromium.launch();
const result = { version: 'v52.90', scope: '19 menu routes + glossary overlay = 20 user surfaces', surfaces: {}, journeys: {}, pageErrors: [], assertions: [] };
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const page = await browser.newPage({ viewport });
    const requests = [];
    await attachNetworkBoundary(page, requests);
    page.on('pageerror', (err) => result.pageErrors.push(`${viewportName}: ${err.message}`));
    await waitForApp(page);
    result.surfaces[viewportName] = [];
    for (const route of routes) result.surfaces[viewportName].push(await surfaceAudit(page, viewportName, route));
    result.surfaces[viewportName].push(await glossaryAudit(page, viewportName));
    await page.close();
  }

  const statePage = await browser.newPage({ viewport: viewports.desktop });
  const stateRequests = [];
  await attachNetworkBoundary(statePage, stateRequests);
  statePage.on('pageerror', (err) => result.pageErrors.push(`journey: ${err.message}`));
  await waitForApp(statePage);

  result.journeys.fundamentalTimeout = await statePage.evaluate(async () => {
    window.showPage('fundamental');
    const input = document.getElementById('fund-search-input');
    input.value = 'QA90';
    delete window._fundCache.QA90;
    window.dynamicTickerLookup = () => new Promise(() => {});
    window.fetchSECFilings = () => new Promise(() => {});
    window.fetchSECFinancials = () => new Promise(() => {});
    if (window.AIO) window.AIO.fetchQuarterlyFinancials = () => Promise.resolve({ available: false, ticker: 'QA90', reason: 'qa-timeout' });
    const start = performance.now();
    await window.fundamentalSearch();
    const elapsedMs = Math.round(performance.now() - start);
    const progress = (document.getElementById('fund-rpt-progress') || {}).innerText || '';
    return { elapsedMs, reportVisible: getComputedStyle(document.getElementById('fund-report-container')).display !== 'none', partialMessage: /응답 없음|시간 제한|부분 데이터/.test(progress), sources: (window._fundAnalysisData && window._fundAnalysisData.sources || []).length };
  });
  await statePage.screenshot({ path: resolve(shotsDir, 'state-fundamental-timeout.png'), fullPage: false });

  result.journeys.newsCacheAndMore = await statePage.evaluate(() => {
    window.showPage('market-news');
    const now = Date.now() - 12 * 60 * 60 * 1000;
    const rows = Array.from({ length: 25 }, (_, i) => ({ title: `테스트 시장 뉴스 ${i + 1} 반도체 실적 개선`, ko_title: `테스트 시장 뉴스 ${i + 1} 반도체 실적 개선`, source: `검증소스${(i % 3) + 1}`, pubDate: new Date(now - i * 60000).toISOString(), topic: 'semi', country: 'us', tier: 1, score: 65, desc: '' }));
    window._allNewsItems = rows;
    window._aioNewsVisibleLimit = 12;
    window.renderFeed(rows);
    window._aioUpdateNewsSummaryFromItems(rows, { kind: 'server-cache', generatedAt: new Date().toISOString() });
    const before = document.querySelectorAll('#live-news-feed .news-item-card').length;
    const wrap = document.getElementById('news-load-more-wrap');
    const owner = !!(wrap && wrap.closest('#page-market-news') && wrap.previousElementSibling && wrap.previousElementSibling.id === 'live-news-feed');
    window._aioNewsLoadMore();
    const after = document.querySelectorAll('#live-news-feed .news-item-card').length;
    return { before, after, owner, summary: document.getElementById('news-24h-count').textContent, sourceState: document.getElementById('last-fetch-time').textContent };
  });
  await statePage.screenshot({ path: resolve(shotsDir, 'state-news-load-more.png'), fullPage: false });

  result.journeys.aiFocus = await statePage.evaluate(() => {
    const panel = document.getElementById('ai-panel');
    const button = document.getElementById('topbar-ai-btn');
    if (panel.classList.contains('open')) window.toggleAIPanel();
    const closed = panel.hasAttribute('inert') && panel.getAttribute('aria-hidden') === 'true' && button.getAttribute('aria-expanded') === 'false';
    window.toggleAIPanel();
    const open = !panel.hasAttribute('inert') && panel.getAttribute('aria-hidden') === 'false' && button.getAttribute('aria-expanded') === 'true';
    window.toggleAIPanel();
    return { closed, open, reclosed: panel.hasAttribute('inert'), focusReturned: document.activeElement === button };
  });

  result.journeys.krThemeDensity = await statePage.evaluate(() => {
    window.showPage('kr-themes');
    if (typeof window.renderKrThemeCards === 'function') window.renderKrThemeCards();
    if (typeof window.initKoreaThemes === 'function') window.initKoreaThemes();
    const cards = Array.from(document.querySelectorAll('#kr-theme-container .kr-theme-card'));
    const defaultVisibleCards = cards.filter((card) => getComputedStyle(card).display !== 'none').length;
    const perCard = cards.map((card) => ({ pills: card.querySelectorAll(':scope > .kr-theme-tickers > .kr-ticker-pill').length, memo: (card.querySelector('.kr-theme-catalyst') || {}).textContent?.length || 0, hasMore: !!card.querySelector('.kr-theme-card-more') }));
    return { cards: cards.length, defaultVisibleCards, maxPills: Math.max(0, ...perCard.map((r) => r.pills)), maxMemo: Math.max(0, ...perCard.map((r) => r.memo)), cardsWithMore: perCard.filter((r) => r.hasMore).length };
  });
  await statePage.screenshot({ path: resolve(shotsDir, 'state-kr-theme-density.png'), fullPage: false });

  const reqStart = stateRequests.length;
  result.journeys.krSupplyFailure = await statePage.evaluate(async () => {
    window._krSupplyFetchState = { inFlight: false, lastAttempt: 0, ok: false };
    window._krInvestorCircuit = { failUntil: 0, attempts: 0 };
    window._krInvestorFetchState = { inFlight: false, lastAttempt: 0 };
    await Promise.all([window.fetchKrSupplyData(), window.fetchKrInvestorTop10(), window.fetchKrInvestorTop10()]);
    window.showPage('kr-supply');
    const text = (document.getElementById('kr-supply-analysis-text') || {}).innerText || '';
    return { duplicateNotices: document.querySelectorAll('.kr-supply-fallback-notice').length, singleFailureOwner: /수급 원천 미수신|수신 실패|정적 스냅샷/.test(text), dateState: (document.getElementById('kr-investor-top10-date') || {}).textContent || '' };
  });
  const krRequests = stateRequests.slice(reqStart).filter((url) => {
    let decoded = url;
    try { decoded = decodeURIComponent(url); } catch (_) {}
    return /m\.stock\.naver\.com\/api\/(stock\/[^/]+\/trend|index\/[^/]+\/trend)/i.test(decoded);
  });
  result.journeys.krSupplyFailure.requestCount = krRequests.length;
  await statePage.screenshot({ path: resolve(shotsDir, 'state-kr-supply-failure.png'), fullPage: false });

  result.journeys.portfolioEmptyPopulated = await statePage.evaluate(() => {
    window.showPage('portfolio');
    window.savePortfolioData([]);
    window.renderPortfolio();
    const risk = document.getElementById('pf-risk-section');
    const empty = { cta: !!document.querySelector('.pf-empty-state [data-action="_aioTogglePortfolioEntry"]'), riskHidden: risk.hidden, rowCount: document.querySelectorAll('#pf-positions-tbody tr').length };
    window.savePortfolioData([{ ticker: 'AAPL', qty: 2, cost: 100, memo: 'QA' }]);
    window.renderPortfolio();
    const populated = { riskRestored: !risk.hidden, holdingRows: document.querySelectorAll('#pf-positions-tbody tr[data-arg="AAPL"]').length };
    window.savePortfolioData([]);
    window.renderPortfolio();
    return { empty, populated };
  });
  await statePage.screenshot({ path: resolve(shotsDir, 'state-portfolio-empty.png'), fullPage: false });

  result.journeys.briefingTitle = await statePage.evaluate(() => {
    window.showPage('briefing');
    const fallback = window.getDisplayTitle({ title: 'Federal Reserve keeps rates unchanged amid inflation concern', source: 'Reuters', topic: 'macro', country: 'us' });
    const html = typeof window._renderBriefingBullet === 'function' ? window._renderBriefingBullet({ title: 'Federal Reserve keeps rates unchanged amid inflation concern', source: 'Reuters', topic: 'macro', country: 'us', score: 70, pubDate: new Date().toISOString() }, 0) : '';
    window._allNewsItems = [{ title: 'Federal Reserve keeps rates unchanged amid inflation concern', source: 'Reuters', topic: 'macro', country: 'us', score: 70, pubDate: new Date().toISOString() }];
    if (typeof window._aioRenderBriefingMarketAnalysis === 'function') window._aioRenderBriefingMarketAnalysis();
    const drivers = (document.getElementById('briefing-drivers-list') || {}).innerText || '';
    return { fallback, hasKorean: /[가-힣]/.test(fallback), usesSafeClass: /briefing-news-title/.test(html), rawEnglishVisible: /Federal Reserve keeps rates unchanged/.test(html) || /Federal Reserve keeps rates unchanged/.test(drivers), driverKorean: /[가-힣]/.test(drivers) };
  });
  await statePage.screenshot({ path: resolve(shotsDir, 'state-briefing-korean-title.png'), fullPage: false });

  await statePage.close();

  const allSurfaces = Object.values(result.surfaces).flat();
  result.assertions = [
    { id: 'SURFACE-40', ok: allSurfaces.length === 40, detail: allSurfaces.length },
    { id: 'SURFACE-ACTIVE', ok: allSurfaces.every((r) => r.active), detail: allSurfaces.filter((r) => !r.active).map((r) => r.route) },
    { id: 'SURFACE-OVERFLOW', ok: allSurfaces.every((r) => r.documentOverflow === 0), detail: allSurfaces.filter((r) => r.documentOverflow || r.overflowEls.length).map((r) => ({ route: r.route, overflow: r.documentOverflow, viewportEdgeObservations: r.overflowEls })) },
    { id: 'SURFACE-CONTENT', ok: allSurfaces.every((r) => r.textLength > 80), detail: allSurfaces.filter((r) => r.textLength <= 80).map((r) => r.route) },
    { id: 'COMP-NO-LEGACY', ok: allSurfaces.every((r) => r.compContract), detail: allSurfaces.filter((r) => !r.compContract).map((r) => r.route) },
    { id: 'MOBILE-TOPBAR', ok: result.surfaces.mobile.every((r) => r.topbarWithinViewport), detail: result.surfaces.mobile.filter((r) => !r.topbarWithinViewport).map((r) => r.route) },
    { id: 'FUND-TIMEOUT', ok: result.journeys.fundamentalTimeout.elapsedMs <= 8500 && result.journeys.fundamentalTimeout.reportVisible && result.journeys.fundamentalTimeout.partialMessage, detail: result.journeys.fundamentalTimeout },
    { id: 'NEWS-STATE-MORE', ok: result.journeys.newsCacheAndMore.before === 12 && result.journeys.newsCacheAndMore.after === 24 && result.journeys.newsCacheAndMore.owner && result.journeys.newsCacheAndMore.summary === '25건' && /서버 캐시/.test(result.journeys.newsCacheAndMore.sourceState), detail: result.journeys.newsCacheAndMore },
    { id: 'AI-FOCUS', ok: Object.values(result.journeys.aiFocus).every(Boolean), detail: result.journeys.aiFocus },
    { id: 'KR-THEME-DENSITY', ok: result.journeys.krThemeDensity.defaultVisibleCards === 3 && result.journeys.krThemeDensity.maxPills <= 5 && result.journeys.krThemeDensity.maxMemo <= 261, detail: result.journeys.krThemeDensity },
    { id: 'KR-SUPPLY-FAILURE', ok: result.journeys.krSupplyFailure.duplicateNotices === 0 && result.journeys.krSupplyFailure.singleFailureOwner && result.journeys.krSupplyFailure.requestCount <= 60, detail: result.journeys.krSupplyFailure },
    { id: 'PORTFOLIO-STATES', ok: result.journeys.portfolioEmptyPopulated.empty.cta && result.journeys.portfolioEmptyPopulated.empty.riskHidden && result.journeys.portfolioEmptyPopulated.populated.riskRestored && result.journeys.portfolioEmptyPopulated.populated.holdingRows === 1, detail: result.journeys.portfolioEmptyPopulated },
    { id: 'BRIEFING-TITLE', ok: result.journeys.briefingTitle.hasKorean && result.journeys.briefingTitle.driverKorean && result.journeys.briefingTitle.usesSafeClass && !result.journeys.briefingTitle.rawEnglishVisible, detail: result.journeys.briefingTitle },
    { id: 'PAGEERROR', ok: result.pageErrors.length === 0, detail: result.pageErrors }
  ];

  await createContactSheet(browser, 'desktop', [...routes.slice(0, 10)], 'a');
  await createContactSheet(browser, 'desktop', [...routes.slice(10), 'glossary'], 'b');
  await createContactSheet(browser, 'mobile', [...routes.slice(0, 10)], 'a');
  await createContactSheet(browser, 'mobile', [...routes.slice(10), 'glossary'], 'b');

  writeFileSync(resolve(here, 'second-pass-v5290.json'), JSON.stringify(result, null, 2));
  const failures = result.assertions.filter((row) => !row.ok);
  console.log(JSON.stringify({ assertions: result.assertions, pageErrors: result.pageErrors }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
