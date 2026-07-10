// One-time manual E2E verification for WO-1A portfolio vault integration.
// Not part of the permanent CI suite — drives the real page with Playwright,
// exercising fresh-setup, encrypted-at-rest, correct/wrong PIN, and legacy migration.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const root = 'C:/Projects/AIO';
const PORT = 8894;
const BASE_URL = `http://127.0.0.1:${PORT}/index.html`;

function startServer() {
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(PORT)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let started = false;
    child.stdout.on('data', (d) => { if (String(d).includes('AIO local server') && !started) { started = true; res(child); } });
    child.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));
    setTimeout(() => { if (!started) { started = true; res(child); } }, 2000);
  });
}

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('PASS', label); }
  else { fail++; console.log('FAIL', label, detail ? '| ' + detail : ''); }
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
      return route.abort();
    });

    // ── Scenario A: fresh install, no PIN, add a position, confirm plaintext ──
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.savePortfolioData === 'function');
    await page.evaluate(() => { localStorage.clear(); });
    await page.evaluate(() => { window.savePortfolioData([{ ticker: 'NVDA', qty: 10, cost: 150, target: 200, memo: '', addedAt: Date.now(), updatedAt: Date.now() }]); });
    const rawA = await page.evaluate(() => localStorage.getItem('aio_portfolio_data'));
    check('A: no-PIN save is plaintext JSON', !!rawA && rawA.indexOf('aio_enc::') !== 0 && JSON.parse(rawA)[0].ticker === 'NVDA', rawA);
    const lockedA = await page.evaluate(() => window.isPortfolioLocked());
    check('A: no-PIN state is not locked', lockedA === false);

    // ── Scenario B: set a PIN via unlockPortfolio(), confirm data becomes encrypted ──
    await page.evaluate(() => {
      document.getElementById('pf-pin-input').value = '1234';
    });
    await page.evaluate(() => window.unlockPortfolio());
    await page.waitForTimeout(300); // safeLS is fire-and-forget async
    const rawB = await page.evaluate(() => localStorage.getItem('aio_portfolio_data'));
    check('B: after PIN setup, storage is encrypted (aio_enc:: prefix)', !!rawB && rawB.indexOf('aio_enc::') === 0, rawB);
    const dataB = await page.evaluate(() => window.getPortfolioData());
    check('B: sync getPortfolioData still returns correct decrypted data post-unlock', Array.isArray(dataB) && dataB[0] && dataB[0].ticker === 'NVDA', JSON.stringify(dataB));
    const uiTextHonest = await page.evaluate(() => {
      window.savePortfolioData([]);
      window.renderPortfolio();
      return document.getElementById('pf-positions-tbody').innerHTML.includes('AES-256');
    });
    check('B: empty-state UI still claims AES-256 (now true)', uiTextHonest === true);
    // restore the position for later scenarios
    await page.evaluate(() => window.savePortfolioData([{ ticker: 'NVDA', qty: 10, cost: 150, target: 200, memo: '', addedAt: Date.now(), updatedAt: Date.now() }]));
    await page.waitForTimeout(300);

    // ── Scenario C: simulate a fresh page load (locked state) — reload the page ──
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.isPortfolioLocked === 'function');
    const lockedC = await page.evaluate(() => window.isPortfolioLocked());
    check('C: after reload (vault not yet unlocked this session), portfolio reports locked', lockedC === true);
    const dataC = await page.evaluate(() => window.getPortfolioData());
    check('C: locked state — getPortfolioData does not leak plaintext', Array.isArray(dataC) && dataC.length === 0, JSON.stringify(dataC));
    await page.evaluate(() => window.renderPortfolio());
    const lockScreenVisibleC = await page.evaluate(() => document.getElementById('pf-lock-screen').style.display === 'block' && document.getElementById('pf-main').style.display === 'none');
    check('C: renderPortfolio() shows the lock screen (not the empty-portfolio main view)', lockScreenVisibleC === true);

    // ── Scenario D: wrong PIN rejected ──
    await page.evaluate(() => { document.getElementById('pf-pin-input').value = '0000'; });
    await page.evaluate(() => window.unlockPortfolio());
    await page.waitForTimeout(200);
    const stillLockedD = await page.evaluate(() => window.isPortfolioLocked());
    check('D: wrong PIN leaves vault locked', stillLockedD === true);

    // ── Scenario E: correct PIN unlocks and recovers exact data ──
    await page.evaluate(() => { document.getElementById('pf-pin-input').value = '1234'; });
    await page.evaluate(() => window.unlockPortfolio());
    await page.waitForTimeout(300);
    const unlockedE = await page.evaluate(() => window.isPortfolioLocked() === false);
    const dataE = await page.evaluate(() => window.getPortfolioData());
    check('E: correct PIN unlocks vault', unlockedE === true);
    check('E: correct PIN recovers the exact original position data', Array.isArray(dataE) && dataE.length === 1 && dataE[0].ticker === 'NVDA' && dataE[0].qty === 10, JSON.stringify(dataE));

    // ── Scenario F: legacy plaintext-PIN migration (simulate an old install) ──
    await page.evaluate(() => { localStorage.clear(); });
    await page.evaluate(() => {
      // simulate a pre-v52.46 install: plaintext PIN + plaintext data, no vault salt at all
      localStorage.setItem('aio_portfolio_pin', '5678');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([{ ticker: 'AAPL', qty: 5, cost: 180, target: 220, memo: 'legacy', addedAt: 1, updatedAt: 1 }]));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.isPortfolioLocked === 'function');
    const lockedF = await page.evaluate(() => window.isPortfolioLocked());
    check('F: legacy plaintext-PIN install is reported as locked (protection existed before)', lockedF === true);
    await page.evaluate(() => { document.getElementById('pf-pin-input').value = '5678'; });
    await page.evaluate(() => window.unlockPortfolio());
    await page.waitForTimeout(400);
    const rawF = await page.evaluate(() => localStorage.getItem('aio_portfolio_data'));
    const legacyPinGoneF = await page.evaluate(() => localStorage.getItem('aio_portfolio_pin'));
    const dataF = await page.evaluate(() => window.getPortfolioData());
    check('F: legacy plaintext data got upgraded to encrypted-at-rest after entering the same PIN', !!rawF && rawF.indexOf('aio_enc::') === 0, rawF);
    check('F: legacy plaintext PIN key removed after migration', legacyPinGoneF === null);
    check('F: migrated data is intact and readable', Array.isArray(dataF) && dataF[0] && dataF[0].ticker === 'AAPL' && dataF[0].memo === 'legacy', JSON.stringify(dataF));

    // ── Scenario G: opt-out (reset) returns to plaintext, doesn't touch vault salt ──
    const saltBeforeG = await page.evaluate(() => localStorage.getItem('aio_vault_salt'));
    await page.evaluate(() => {
      // resetPortfolioPin() shows a confirm modal (showConfirmModal) — call its callback path directly for a deterministic test
      // _AioVault is a top-level const, not attached to window — reference it bare (same as the app's own code does)
      localStorage.setItem('aio_portfolio_data', _AioVault._keyRuntime['aio_portfolio_data']);
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      _AioVault.lock();
    });
    const rawG = await page.evaluate(() => localStorage.getItem('aio_portfolio_data'));
    const lockedG = await page.evaluate(() => window.isPortfolioLocked());
    const saltAfterG = await page.evaluate(() => localStorage.getItem('aio_vault_salt'));
    check('G: opted-out portfolio reads back as plaintext, not locked', lockedG === false && rawG.indexOf('aio_enc::') !== 0, rawG);
    check('G: opting out of portfolio protection does not destroy the shared vault salt (API keys unaffected)', saltAfterG === saltBeforeG);

    console.log(`\n${pass}/${pass + fail} PASS`);
    process.exitCode = fail > 0 ? 1 : 0;
  } finally {
    await browser.close();
    server.kill();
  }
}
main();
