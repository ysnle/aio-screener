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
    // run the actual test suite the same way ci-headless-tests.mjs does, THEN check DOM state
    await page.evaluate(async () => {
      await window.AIO.loadTests();
      return window.AIO.runTests();
    });
    const html = await page.evaluate(() => {
      const el = document.getElementById('macro-storyline');
      return el ? el.innerHTML : '(element not found)';
    });
    console.log('=== #macro-storyline innerHTML AFTER full test run ===');
    console.log(html);
  } finally {
    await browser.close();
    server.kill();
  }
  process.exit(0);
}

main();
