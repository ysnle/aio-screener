// H2-05/WO-1A: deterministic Chromium E2E for the portfolio Vault boundary.
// External data is blocked; this test proves storage/lock behavior only, never
// live quote availability or operator secret configuration.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_PORTFOLIO_PORT || 8894);
const url = `http://127.0.0.1:${port}/index.html`;
const artifactDir = resolve(root, '_artifacts', 'portfolio-vault');

function startServer() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    const onReady = () => { if (!ready) { ready = true; resolvePromise(child); } };
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('AIO local server')) onReady(); });
    child.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(onReady, 2000);
  });
}

async function main() {
  mkdirSync(artifactDir, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch();
  const report = { checks: [], errors: [], scope: 'local Chromium, external network blocked' };
  const check = (id, ok, detail) => report.checks.push({ id, ok: !!ok, detail: detail || '' });
  try {
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.AIO === 'object' && typeof window.AIO.loadTests === 'function', { timeout: 30000 });
    const capability = await page.evaluate(() => ({
      get: typeof window.getPortfolioData,
      lock: typeof window.isPortfolioLocked,
      unlock: typeof window.unlockPortfolio,
      vault: typeof _AioVault,
      page: typeof window.showPage,
    }));
    if (capability.get !== 'function' || capability.lock !== 'function' || capability.unlock !== 'function' || capability.vault !== 'object') throw new Error('portfolio E2E capability missing: ' + JSON.stringify(capability));

    const first = await page.evaluate(async () => {
      localStorage.clear();
      sessionStorage.clear();
      _AioVault.lock();
      window.showPage('portfolio');
      const initialUnlocked = !window.isPortfolioLocked();
      window.savePortfolioData([{ sym: 'AIO_TEST', qty: 2, cost: 100, target: 120, memo: 'fixture' }]);
      const beforePin = localStorage.getItem('aio_portfolio_data') || '';
      document.getElementById('pf-pin-input').value = '2468';
      await window.unlockPortfolio();
      await new Promise((r) => setTimeout(r, 80));
      const encrypted = localStorage.getItem('aio_portfolio_data') || '';
      const afterPin = { initialUnlocked, encrypted: encrypted.startsWith('aio_enc::'), hasSalt: !!localStorage.getItem('aio_vault_salt'), beforePinPlain: beforePin.startsWith('['), storedLength: encrypted.length };
      _AioVault.lock();
      window.showPage('portfolio');
      const lockedAfterLock = window.isPortfolioLocked();
      document.getElementById('pf-pin-input').value = '0000';
      await window.unlockPortfolio();
      const wrongPinRejected = !_AioVault.isUnlocked() && window.isPortfolioLocked();
      document.getElementById('pf-pin-input').value = '2468';
      await window.unlockPortfolio();
      const correctPinRestored = _AioVault.isUnlocked() && window.getPortfolioData().length === 1;
      return { afterPin, lockedAfterLock, wrongPinRejected, correctPinRestored };
    });
    check('PFE2-01 new_user_no_pin', first.afterPin.initialUnlocked, JSON.stringify(first));
    check('PFE2-02 pin_encrypts_storage', first.afterPin.encrypted && first.afterPin.hasSalt && first.afterPin.beforePinPlain, JSON.stringify(first.afterPin));
    check('PFE2-03 lock_and_wrong_pin_rejected', first.lockedAfterLock && first.wrongPinRejected, JSON.stringify(first));
    check('PFE2-04 correct_pin_restores_data', first.correctPinRestored, JSON.stringify(first));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.getPortfolioData === 'function' && typeof window.isPortfolioLocked === 'function', { timeout: 30000 });
    const reloadLocked = await page.evaluate(() => { window.showPage('portfolio'); return window.isPortfolioLocked() && (document.getElementById('pf-lock-screen') || {}).style?.display !== 'none'; });
    check('PFE2-05 reload_requires_unlock', reloadLocked, String(reloadLocked));

    const migration = await page.evaluate(async () => {
      _AioVault.lock();
      localStorage.clear();
      localStorage.setItem('aio_portfolio_data', JSON.stringify([{ sym: 'LEGACY', qty: 1, cost: 50, memo: 'legacy' }]));
      window.showPage('portfolio');
      document.getElementById('pf-pin-input').value = '1357';
      await window.unlockPortfolio();
      await new Promise((r) => setTimeout(r, 80));
      const raw = localStorage.getItem('aio_portfolio_data') || '';
      return { encrypted: raw.startsWith('aio_enc::'), legacyPinRemoved: !localStorage.getItem('aio_portfolio_pin'), dataRestored: window.getPortfolioData().length === 1 };
    });
    check('PFE2-06 legacy_plaintext_migrates', migration.encrypted && migration.legacyPinRemoved && migration.dataRestored, JSON.stringify(migration));

    const boundary = await page.evaluate(() => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      _AioVault.lock();
      window.savePortfolioData([{ sym: 'XSS', qty: 1, cost: 10, memo: '<img src=x onerror=alert(1)>' }]);
      window.showPortfolioMain();
      const raw = localStorage.getItem('aio_portfolio_data') || '';
      const html = document.getElementById('pf-main')?.innerHTML || '';
      const parsed = JSON.parse(raw);
      return { optOutPlain: raw.startsWith('['), rawRoundTrip: parsed[0]?.memo === '<img src=x onerror=alert(1)>', domHasExecutableHandler: document.querySelectorAll('#pf-main img,[onerror]').length > 0, escapedTextVisible: html.includes('&lt;img') };
    });
    check('PFE2-07 opt_out_is_explicit_plaintext', boundary.optOutPlain && boundary.rawRoundTrip, JSON.stringify(boundary));
    check('PFE2-08 portfolio_input_boundary', !boundary.domHasExecutableHandler && boundary.escapedTextVisible, JSON.stringify(boundary));
    report.page = await page.evaluate(() => ({ encryptedMarker: localStorage.getItem('aio_portfolio_data')?.slice(0, 9), optOut: localStorage.getItem('aio_portfolio_vault_optout') }));
  } catch (error) {
    report.errors.push(String(error && error.stack || error));
  } finally {
    writeFileSync(resolve(artifactDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    await browser.close();
    server.kill();
  }
  const failed = report.checks.filter((item) => !item.ok);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length || failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
