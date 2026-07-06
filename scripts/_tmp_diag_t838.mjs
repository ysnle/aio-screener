import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const root = 'C:/Projects/AIO';
const PORT = 8899;
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let started = false;
    const onReady = () => { if (!started) { started = true; resolvePromise(child); } };
    child.stdout.on('data', (d) => { if (String(d).includes('AIO local server')) onReady(); });
    child.stderr.on('data', () => {});
    child.on('error', reject);
    setTimeout(onReady, 2000);
  });
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
      return route.abort();
    });
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.AIO === 'object', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const result = await page.evaluate(() => {
      const ctx = window.CHAT_CONTEXTS || {};
      let screenerText = '', screenerErr = null, tickerText = '', tickerErr = null;
      try { screenerText = ctx.screener && typeof ctx.screener.system === 'function' ? ctx.screener.system() : '(no fn)'; } catch (e) { screenerErr = e.message; }
      try { tickerText = ctx.ticker && typeof ctx.ticker.system === 'function' ? ctx.ticker.system() : '(no fn)'; } catch (e) { tickerErr = e.message; }
      return {
        screenerErr, tickerErr,
        screenerMatches: /스크리너 후보|단일 종목/.test(screenerText),
        tickerMatches: /종목 cockpit|데이터 신뢰도/.test(tickerText),
        screenerTextLen: screenerText.length,
        tickerTextLen: tickerText.length,
        screenerTextSample: String(screenerText).slice(0, 200),
        tickerTextSample: String(tickerText).slice(0, 200)
      };
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    server.kill();
  }
  process.exit(0);
}

main();
