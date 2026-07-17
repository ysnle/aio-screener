import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const baseUrl = process.env.AIO_AUDIT_URL || 'https://ysnle.github.io/aio-screener/index.html?qa=v5289-human';
const outDir = resolve(process.env.AIO_AUDIT_OUT || '_artifacts/live-human-ux-v5289');
const routes = [
  'home', 'signal', 'breadth', 'sentiment', 'briefing', 'market-news',
  'technical', 'screener', 'portfolio', 'themes', 'macro', 'fxbond',
  'fundamental', 'kr-home', 'kr-supply', 'kr-themes', 'kr-macro',
  'kr-technical', 'guide'
];
const viewports = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true }
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  productSurfaceContract: { primaryPages: 19, overlaySurfaces: 1, total: 20 },
  viewports: {},
  journeys: {},
  errors: []
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function auditSurface(page, route, viewport) {
  await page.evaluate((id) => window.showPage(id, null), route);
  await page.waitForFunction((id) => {
    const el = document.getElementById('page-' + id);
    return !!el && el.classList.contains('active');
  }, route, { timeout: 8000 });
  await page.waitForTimeout(route === 'fundamental' ? 3500 : 900);
  await page.evaluate(() => scrollTo(0, 0));

  const metrics = await page.evaluate(({ id, foldHeight }) => {
    const root = document.getElementById('page-' + id);
    const visible = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) !== 0 && r.width > 0 && r.height > 0;
    };
    const text = (root.innerText || '').replace(/\s+/g, ' ').trim();
    const visibleEls = [...root.querySelectorAll('*')].filter(visible);
    const controls = [...root.querySelectorAll('button,a[href],input,select,textarea,[role="button"]')].filter(visible);
    const nameOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.value || '').trim();
    const headings = [...root.querySelectorAll('h1,h2,h3,h4,.page-title')].filter(visible)
      .map((el) => ({ level: el.tagName.toLowerCase(), text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120) }))
      .filter((x) => x.text);
    const headingCounts = new Map();
    for (const h of headings) headingCounts.set(h.text, (headingCounts.get(h.text) || 0) + 1);
    const duplicateHeadings = [...headingCounts.entries()].filter(([, count]) => count > 1).map(([label, count]) => ({ label, count }));
    const placeholders = text.match(/(?:^|\s)(?:—|--|null|undefined|NaN|\[object Object\])(?:\s|$)/g) || [];
    const developerTerms = text.match(/PUBLIC STATUS|pipeline|internal route|runtime audit|developer mode|디버그|파이프라인 OK/gi) || [];
    const smallText = visibleEls.filter((el) => parseFloat(getComputedStyle(el).fontSize || '99') < 11);
    const smallTargets = controls.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width < 32 || r.height < 32;
    });
    const foldEls = visibleEls.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.top < foldHeight && r.bottom > 0;
    });
    const foldText = [...new Set(foldEls.map((el) => (el.children.length ? '' : (el.textContent || '').trim())).filter(Boolean))].join(' ').replace(/\s+/g, ' ').trim();
    const canvases = [...root.querySelectorAll('canvas')].filter(visible).map((cv) => ({
      id: cv.id || '', width: cv.clientWidth, height: cv.clientHeight,
      zero: !cv.clientWidth || !cv.clientHeight || !cv.width || !cv.height
    }));
    const iframes = [...root.querySelectorAll('iframe')].filter(visible).map((el) => ({ title: el.title || '', width: el.clientWidth, height: el.clientHeight }));
    const sections = [...root.children].filter(visible).map((el) => ({
      id: el.id || '',
      cls: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
      label: ((el.querySelector('h1,h2,h3,h4,.section-title') || el).innerText || '').replace(/\s+/g, ' ').trim().slice(0, 100),
      height: Math.round(el.getBoundingClientRect().height)
    }));
    const details = [...root.querySelectorAll('details')].filter(visible);
    const rect = root.getBoundingClientRect();
    const doc = document.documentElement;
    return {
      route: id,
      pageTitle: headings[0]?.text || '',
      headings,
      duplicateHeadings,
      sections,
      textLength: text.length,
      foldTextLength: foldText.length,
      pageHeight: root.scrollHeight,
      rootWidth: Math.round(rect.width),
      documentOverflowX: Math.max(0, doc.scrollWidth - doc.clientWidth),
      controls: controls.length,
      namelessControls: controls.filter((el) => !nameOf(el)).slice(0, 8).map((el) => el.outerHTML.slice(0, 180)),
      smallTargets: smallTargets.slice(0, 12).map((el) => ({ name: nameOf(el).slice(0, 80), width: Math.round(el.getBoundingClientRect().width), height: Math.round(el.getBoundingClientRect().height) })),
      smallText: smallText.slice(0, 12).map((el) => ({ text: (el.textContent || '').trim().slice(0, 80), size: getComputedStyle(el).fontSize })),
      placeholderCount: placeholders.length,
      developerTermCount: developerTerms.length,
      openDetails: details.filter((el) => el.open).length,
      collapsedDetails: details.filter((el) => !el.open).length,
      canvases,
      iframes,
      visibleImages: [...root.querySelectorAll('img')].filter(visible).length,
      brokenImages: [...root.querySelectorAll('img')].filter((img) => visible(img) && img.complete && !img.naturalWidth).length
    };
  }, { id: route, foldHeight: viewport.height });

  const screenshotPath = resolve(outDir, `${viewport.name}-${String(routes.indexOf(route) + 1).padStart(2, '0')}-${route}.jpg`);
  const bytes = await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 78, fullPage: false, animations: 'disabled' });
  metrics.screenshot = screenshotPath;
  metrics._image = bytes.toString('base64');
  return metrics;
}

async function auditGlossary(page, viewport) {
  await page.evaluate(() => window.openGlossary());
  await page.waitForFunction(() => {
    const modal = document.getElementById('glossary-modal');
    return modal && getComputedStyle(modal).display !== 'none';
  });
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => {
    const modal = document.getElementById('glossary-modal');
    const visible = (el) => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const controls = [...modal.querySelectorAll('button,input,[role="button"]')].filter(visible);
    return {
      route: 'glossary',
      pageTitle: (modal.querySelector('h1,h2,h3')?.textContent || '').trim(),
      terms: modal.querySelectorAll('.aio-glossary-item').length,
      textLength: (modal.innerText || '').replace(/\s+/g, ' ').trim().length,
      controls: controls.length,
      namelessControls: controls.filter((el) => !(el.getAttribute('aria-label') || el.title || el.textContent || el.value || '').trim()).length,
      documentOverflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      modalWidth: Math.round(modal.getBoundingClientRect().width),
      modalHeight: Math.round(modal.getBoundingClientRect().height)
    };
  });
  const screenshotPath = resolve(outDir, `${viewport.name}-20-glossary.jpg`);
  const bytes = await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 78, fullPage: false, animations: 'disabled' });
  metrics.screenshot = screenshotPath;
  metrics._image = bytes.toString('base64');
  await page.keyboard.press('Escape');
  return metrics;
}

async function makeContactSheets(viewportName, surfaces) {
  const chunks = viewportName === 'mobile' ? [surfaces.slice(0, 10), surfaces.slice(10)] : [surfaces];
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const items = chunks[chunkIndex];
    const contact = await browser.newPage({ viewport: { width: 1440, height: viewportName === 'mobile' ? 1760 : 1380 } });
    const html = `<!doctype html><meta charset="utf-8"><style>
      *{box-sizing:border-box} body{margin:0;padding:18px;background:#dedbd2;color:#272822;font:13px system-ui}
      .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#fff;border:1px solid #aaa;padding:7px;overflow:hidden}
      .label{font-weight:700;margin-bottom:5px}.shot{width:100%;height:${viewportName === 'mobile' ? '580px' : '205px'};object-fit:cover;object-position:top;border:1px solid #ddd;display:block}
    </style><div class="grid">${items.map((item) => `<div class="card"><div class="label">${item.route} · ${item.pageTitle}</div><img class="shot" src="data:image/jpeg;base64,${item._image}"></div>`).join('')}</div>`;
    await contact.setContent(html, { waitUntil: 'load' });
    const path = resolve(outDir, `${viewportName}-contact-${chunkIndex + 1}.png`);
    await contact.screenshot({ path, fullPage: true });
    await contact.close();
  }
}

async function runJourneys(page, viewport) {
  const results = {};
  const run = async (name, fn) => {
    try { results[name] = { pass: true, ...(await fn()) }; }
    catch (error) { results[name] = { pass: false, error: String(error?.message || error) }; }
  };

  await run('history-back-forward', async () => {
    await page.evaluate(() => window.showPage('signal', null));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.showPage('macro', null));
    await page.waitForTimeout(200);
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);
    const active = await page.locator('.page.active').getAttribute('id');
    return { active };
  });

  await run('guide-search-and-open', async () => {
    await page.evaluate(() => window.showPage('guide', null));
    const input = page.locator('#guide-search, input[placeholder*="검색"]').first();
    await input.fill('포트폴리오');
    await page.waitForTimeout(200);
    const visibleChapters = await page.locator('#page-guide details:visible').count();
    const openChapters = await page.locator('#page-guide details[open]:visible').count();
    return { visibleChapters, openChapters };
  });

  await run('glossary-search-close', async () => {
    await page.evaluate(() => window.openGlossary());
    const input = page.locator('#glossary-search');
    await input.fill('RSI');
    await page.waitForTimeout(150);
    const visibleTerms = await page.locator('#glossary-modal .aio-glossary-item:visible').count();
    await page.keyboard.press('Escape');
    const hidden = await page.locator('#glossary-modal').evaluate((el) => getComputedStyle(el).display === 'none');
    return { visibleTerms, hidden };
  });

  await run('portfolio-add-disclosure', async () => {
    await page.evaluate(() => window.showPage('portfolio', null));
    const button = page.getByRole('button', { name: /종목 추가/ }).first();
    await button.click();
    await page.waitForTimeout(120);
    const visibleInputs = await page.locator('#page-portfolio input:visible').count();
    await page.keyboard.press('Escape');
    return { visibleInputs };
  });

  await run('progressive-disclosure', async () => {
    const checks = {};
    for (const route of ['market-news', 'screener', 'kr-themes']) {
      await page.evaluate((id) => window.showPage(id, null), route);
      await page.waitForTimeout(250);
      const before = await page.locator(`#page-${route}`).evaluate((el) => el.scrollHeight);
      const more = page.locator(`#page-${route} button:visible`).filter({ hasText: /더 보기|전체 보기|더보기/ }).first();
      const exists = await more.count();
      if (exists) await more.click();
      await page.waitForTimeout(180);
      const after = await page.locator(`#page-${route}`).evaluate((el) => el.scrollHeight);
      checks[route] = { controlFound: !!exists, before, after, expanded: after >= before };
    }
    return checks;
  });

  await run('keyboard-focus', async () => {
    await page.evaluate(() => window.showPage('home', null));
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    const samples = [];
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      const sample = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return null;
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          name: (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.value || '').trim().slice(0, 80),
          visible: r.width > 0 && r.height > 0,
          outline: cs.outlineStyle,
          boxShadow: cs.boxShadow
        };
      });
      if (sample) samples.push(sample);
    }
    return { samples, nameless: samples.filter((x) => !x.name).length, invisible: samples.filter((x) => !x.visible).length };
  });

  if (viewport.mobile) {
    await run('mobile-menu', async () => {
      await page.evaluate(() => window.showPage('home', null));
      const toggle = page.locator('button[aria-label*="메뉴"],button[aria-label*="사이드"],#mobile-menu-btn,.mobile-menu-btn').first();
      const exists = await toggle.count();
      if (exists) await toggle.click();
      await page.waitForTimeout(150);
      const sidebarVisible = await page.locator('.sidebar').evaluate((el) => {
        const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.right > 0;
      });
      return { controlFound: !!exists, sidebarVisible };
    });
  }
  return results;
}

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push({ kind: 'pageerror', message: String(error?.message || error) }));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource|ERR_FAILED|TG .*실패|AIO:api/.test(message.text())) {
      runtimeErrors.push({ kind: 'console', message: message.text().slice(0, 400) });
    }
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => typeof window.showPage === 'function' && typeof window.openGlossary === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const liveVersion = await page.evaluate(async () => {
    const response = await fetch(`./version.json?humanqa=${Date.now()}`, { cache: 'no-store' });
    return response.json();
  });
  const surfaces = [];
  for (const route of routes) surfaces.push(await auditSurface(page, route, viewport));
  surfaces.push(await auditGlossary(page, viewport));
  await makeContactSheets(viewport.name, surfaces);
  const journeys = await runJourneys(page, viewport);
  report.viewports[viewport.name] = {
    viewport,
    liveVersion,
    runtimeErrors,
    surfaces: surfaces.map(({ _image, ...surface }) => surface)
  };
  report.journeys[viewport.name] = journeys;
  report.errors.push(...runtimeErrors.map((error) => ({ viewport: viewport.name, ...error })));
  await context.close();
}

writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  generatedAt: report.generatedAt,
  versions: Object.fromEntries(Object.entries(report.viewports).map(([key, value]) => [key, value.liveVersion.version])),
  errors: report.errors,
  routes: routes.length,
  surfacesPerViewport: 20,
  desktop: report.viewports.desktop.surfaces.map((s) => ({ route: s.route, height: s.pageHeight ?? s.modalHeight, text: s.textLength, foldText: s.foldTextLength ?? null, overflow: s.documentOverflowX, placeholders: s.placeholderCount ?? 0, duplicateHeadings: s.duplicateHeadings?.length ?? 0, smallText: s.smallText?.length ?? 0, smallTargets: s.smallTargets?.length ?? 0 })),
  mobile: report.viewports.mobile.surfaces.map((s) => ({ route: s.route, height: s.pageHeight ?? s.modalHeight, text: s.textLength, foldText: s.foldTextLength ?? null, overflow: s.documentOverflowX, placeholders: s.placeholderCount ?? 0, duplicateHeadings: s.duplicateHeadings?.length ?? 0, smallText: s.smallText?.length ?? 0, smallTargets: s.smallTargets?.length ?? 0 })),
  journeys: report.journeys
}, null, 2));
await browser.close();
