// Live user journey: open the deployed site in a real browser and use it the way a reader does — entity pages for many
// tickers (summary, chart, filings), the AI panel with representative questions, and a portfolio built from scratch —
// then print what each screen said so a reviewer can judge the content, not only that it rendered.
//
// The cloud sessions that review this site cannot reach ysnle.github.io or the Workers (egress proxy), so this runs on an
// Actions runner (.github/workflows/live-user-journey.yml) or locally with AIO_LIVE_BASE pointing at a static server.
// It asserts only that each step produced something; judging the content is the reviewer's job. Output: stdout sections
// and _artifacts/live-user-journey/ (text + screenshots, ignored by git).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = String(process.env.AIO_LIVE_BASE || 'https://ysnle.github.io/aio-screener').replace(/\/$/, '');
const OUT = process.env.AIO_JOURNEY_OUT || '_artifacts/live-user-journey';
const TICKERS = String(process.env.AIO_JOURNEY_TICKERS || 'NVDA,AAPL,MSFT,TSLA,PLTR,AMD,SOFI,IONQ,SPY,QQQ,SOXX,005930,000660')
  .split(',').map((value) => value.trim()).filter(Boolean);
const PAGES = String(process.env.AIO_JOURNEY_PAGES || 'ticker,technical,fundamental').split(',').map((value) => value.trim()).filter(Boolean);
const QUESTIONS = (process.env.AIO_JOURNEY_QUESTIONS ? JSON.parse(process.env.AIO_JOURNEY_QUESTIONS) : [
  ['home', '지금 미국 증시 상태를 근거 숫자와 함께 한 문단으로 요약해줘'],
  ['ticker/NVDA', '엔비디아 다음 실적 발표 전에 무엇을 확인해야 해?'],
  ['macro', '이번 주 CPI 발표가 금리와 주식에 어떤 영향을 줄 수 있어?'],
  ['ticker/005930', '삼성전자 지금 차트 추세는 어때?'],
  ['technical/QQQ', 'QQQ와 SOXX 중 최근 한 달 더 약한 쪽은 어디고 이유는 뭐야?'],
]);
const ROUTES = String(process.env.AIO_JOURNEY_ROUTES || 'home,briefing,signal,breadth,sentiment,macro,fxbond,charts,screener,themes,market-news,principles,masters,atlas,guide')
  .split(',').map((value) => value.trim()).filter(Boolean);
const PORTFOLIO = [['AAPL', 10, 180], ['NVDA', 20, 210], ['SOXX', 5, 250], ['005930', 10, 55000]];
const CHAT_TIMEOUT_MS = Number(process.env.AIO_JOURNEY_CHAT_TIMEOUT_MS || 150000);
const SKIP = new Set(String(process.env.AIO_JOURNEY_SKIP || '').split(',').filter(Boolean));

mkdirSync(OUT, { recursive: true });
const problems = [];
const section = (title, body) => {
  const text = `\n===== ${title}\n${String(body || '').trim()}\n`;
  process.stdout.write(text);
  return text;
};
const fileName = (value) => value.replace(/[^A-Za-z0-9가-힣_-]+/g, '_');
const visiblePageText = (page) => page.evaluate(() => {
  const el = [...document.querySelectorAll('[id^="page-"]')].find((node) => node.offsetParent !== null);
  return { id: el?.id || null, text: (el?.innerText || '').replace(/\n{3,}/g, '\n\n') };
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Seoul', locale: 'ko-KR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror ${error.message.slice(0, 200)}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console ${message.text().slice(0, 200)}`); });
const flushErrors = (label) => {
  const unique = [...new Set(errors.splice(0))];
  if (unique.length) section(`${label} — browser errors`, unique.join('\n'));
};

async function open(hash, waitMs = 9000) {
  await page.goto(`${BASE}/index.html#${hash}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(waitMs);
}

try {
  await open('home', 8000);
  const version = await page.evaluate(() => window.APP_VERSION || document.title || null);
  section('version', `${version} @ ${BASE} · ${new Date().toISOString()}`);

  if (!SKIP.has('routes')) {
    for (const route of ROUTES) {
      await open(route, route === 'charts' ? 12000 : 8000);
      const { id, text } = await visiblePageText(page);
      if (!text || text.length < 200) problems.push(`#${route}: page text ${text?.length || 0} chars`);
      writeFileSync(`${OUT}/route-${fileName(route)}.txt`, text);
      await page.screenshot({ path: `${OUT}/route-${fileName(route)}.png` }).catch(() => {});
      section(`#${route} (${id})`, text.slice(0, Number(process.env.AIO_JOURNEY_TEXT_LIMIT || 5000)));
      flushErrors(`#${route}`);
    }
  }

  if (!SKIP.has('pages')) {
    for (const ticker of TICKERS) {
      for (const route of PAGES) {
        const hash = `${route}/${ticker}`;
        // the chart page draws after the quote and bars arrive; give it longer and wait for a canvas
        await open(hash, route === 'technical' ? 6000 : 7000);
        if (route === 'technical') await page.waitForSelector('#page-technical canvas', { timeout: 20000 }).catch(() => problems.push(`${hash}: no chart canvas`));
        await page.waitForTimeout(route === 'technical' ? 3000 : 0);
        const { id, text } = await visiblePageText(page);
        if (!text || text.length < 200) problems.push(`${hash}: page text ${text?.length || 0} chars`);
        writeFileSync(`${OUT}/${fileName(hash)}.txt`, text);
        await page.screenshot({ path: `${OUT}/${fileName(hash)}.png` }).catch(() => {});
        section(`${hash} (${id})`, text.slice(0, Number(process.env.AIO_JOURNEY_TEXT_LIMIT || 5000)));
        flushErrors(hash);
      }
    }
  }

  if (!SKIP.has('chat')) {
    for (const [hash, question] of QUESTIONS) {
      await open(hash, 6000);
      const opened = await page.evaluate(() => {
        const panel = document.getElementById('ai-panel');
        if (panel && panel.offsetParent !== null) return true;
        const button = document.getElementById('topbar-ai-btn');
        if (!button) return false;
        button.click();
        return true;
      });
      if (!opened) { problems.push(`chat ${hash}: no AI button`); continue; }
      await page.waitForSelector('#ai-panel-inp', { state: 'visible', timeout: 15000 }).catch(() => {});
      const before = await page.evaluate(() => document.getElementById('ai-panel-msgs')?.children.length || 0);
      await page.fill('#ai-panel-inp', question).catch(() => problems.push(`chat ${hash}: input not fillable`));
      await page.click('#ai-panel-btn').catch(() => problems.push(`chat ${hash}: send not clickable`));
      const started = Date.now();
      let answer = '';
      let last = '';
      let stableFor = 0;
      while (Date.now() - started < CHAT_TIMEOUT_MS) {
        await page.waitForTimeout(3000);
        const state = await page.evaluate((count) => {
          const box = document.getElementById('ai-panel-msgs');
          const rows = box ? [...box.children].slice(count) : [];
          return { loading: !!document.getElementById('ai-panel-loading'), streaming: !!document.getElementById('ai-panel-streaming')?.offsetParent,
            text: rows.map((row) => row.innerText.trim()).filter(Boolean).join('\n---\n') };
        }, before);
        answer = state.text;
        stableFor = !state.loading && answer && answer === last ? stableFor + 1 : 0;
        last = answer;
        if (stableFor >= 2) break;
      }
      const seconds = Math.round((Date.now() - started) / 1000);
      if (!answer || answer.length < 80) problems.push(`chat ${hash}: answer ${answer.length} chars after ${seconds}s`);
      writeFileSync(`${OUT}/chat-${fileName(hash)}.txt`, `Q: ${question}\n\n${answer}`);
      section(`chat on #${hash} (${seconds}s) Q: ${question}`, answer);
      flushErrors(`chat ${hash}`);
    }
  }

  if (!SKIP.has('portfolio')) {
    await open('portfolio', 6000);
    // the empty state offers a preview of a sample portfolio first; read it as a new user would, then build a real one
    const preview = await page.$('#page-portfolio button:has-text("예시로 미리 보기") >> visible=true');
    if (preview) {
      await preview.click();
      await page.waitForTimeout(5000);
      const { text } = await visiblePageText(page);
      writeFileSync(`${OUT}/portfolio-preview.txt`, text);
      section('portfolio sample preview', text.slice(0, 8000));
      await open('portfolio', 5000);
    }
    const locked = await page.evaluate(() => !!document.getElementById('pf-pin-input')?.offsetParent);
    if (locked) problems.push('portfolio: a PIN lock screen on a fresh profile');
    else {
      for (const [ticker, qty, cost] of PORTFOLIO) {
        await page.evaluate(() => window._aioTogglePortfolioEntry?.(true));
        await page.waitForTimeout(500);
        await page.fill('#pf-add-ticker', ticker);
        await page.fill('#pf-add-qty', String(qty));
        await page.fill('#pf-add-cost', String(cost));
        await page.click('[data-action="addPortfolioPosition"]');
        await page.waitForTimeout(2500);
      }
      await page.fill('#pf-cash-krw-input', '1000000').catch(() => {});
      await page.dispatchEvent('#pf-cash-krw-input', 'change').catch(() => {});
      await page.fill('#pf-cash-usd-input', '2000').catch(() => {});
      await page.dispatchEvent('#pf-cash-usd-input', 'change').catch(() => {});
      await page.click('[data-action="refreshPortfolioPrices"]').catch(() => {});
      await page.waitForTimeout(12000);
      const { text } = await visiblePageText(page);
      writeFileSync(`${OUT}/portfolio.txt`, text);
      await page.screenshot({ path: `${OUT}/portfolio.png`, fullPage: true }).catch(() => {});
      section('portfolio after adding AAPL 10@180, NVDA 20@210, SOXX 5@250, 005930 10@55000, cash ₩1,000,000 + $2,000', text.slice(0, 12000));
      const holdings = await page.evaluate(() => {
        try { return JSON.stringify(window.AIO?.portfolio?.positions || window._aioPortfolioPositions || null); } catch (_) { return null; }
      });
      if (holdings) section('portfolio state', holdings);
      flushErrors('portfolio');
    }
  }
} finally {
  await browser.close();
}

section('problems', problems.length ? problems.join('\n') : 'none');
process.exitCode = problems.length ? 1 : 0;
