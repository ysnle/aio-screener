// H2-05/WO-1A: deterministic Chromium E2E for the portfolio Vault boundary.
// External data is blocked; this test proves storage/lock behavior only, never
// live quote availability or operator secret configuration.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.CI_PORTFOLIO_PORT || 8894);
const liveBaseUrl = String(process.env.CI_PORTFOLIO_BASE_URL || '').replace(/\/+$/, '');
const isLive = !!liveBaseUrl;
const baseUrl = liveBaseUrl || `http://127.0.0.1:${port}`;
const url = `${baseUrl}/index.html`;
const artifactDir = resolve(root, '_artifacts', isLive ? 'portfolio-vault-live' : 'portfolio-vault');
const localRevision = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version;
const localGitHead = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch (_) { return null; } })();

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

// P1350: invoke the production helper with deferred crypto dependencies, never a substitute helper.
export async function runFinancialSecurityRaceFixtures(api = window._aioFinancialSecurity) {
  const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
  const memory = (initial = {}) => {
    const values = new Map(Object.entries(initial));
    return { writes: 0, getItem(key) { return values.get(key) || null; }, setItem(key, value) { this.writes++; values.set(key, value); }, removeItem(key) { this.writes++; values.delete(key); } };
  };
  const makeVault = () => ({
    _generation: 0, _keyRuntime: {},
    lock() { this._generation++; this._derivedKey = null; this._legacyDerivedKey = null; this._authenticating = false; this._pin = null; this._keyRuntime = {}; },
    isUnlocked() { return !!this._derivedKey && this._authenticating !== true; },
    async deriveKey(pin) { return { pin }; },
    async encrypt(value) { return 'aio_enc::' + value; },
    async decrypt(value) { return value.slice(9); }
  });
  const intercept = (vault, method, at = 1) => {
    const ready = deferred(), release = deferred(), original = vault[method];
    let calls = 0;
    vault[method] = async function(...args) {
      if (++calls === at) { ready.resolve(); await release.promise; }
      return original.apply(this, args);
    };
    return { ready, release };
  };
  const settle = (promise) => promise.then(() => 'unexpected-success', (error) => error.message);
  const outcomes = {};
  for (const [label, method, at, initial] of [
    ['derive-current', 'deriveKey', 1, {}], ['derive-legacy', 'deriveKey', 2, {}],
    ['verify-decrypt', 'decrypt', 1, { aio_vault_salt: btoa(String.fromCharCode(...new Uint8Array(16))), aio_vault_verify_v1: 'aio_enc::AIO Vault authenticated v1' }],
    ['sentinel-encrypt', 'encrypt', 1, {}]
  ]) {
    const vault = makeVault(), storage = memory(initial), stop = intercept(vault, method, at);
    const pending = settle(api.authenticateVault(vault, '2468', { storage, saltStorage: storage }));
    await stop.ready.promise;
    vault.lock(); vault._publicMode = true;
    stop.release.resolve();
    outcomes[label] = await pending === 'vault-operation-cancelled' && !vault.isUnlocked() && vault._pin === null && storage.writes === 0;
  }
  {
    const vault = makeVault(), privateStorage = memory(), publicStorage = memory(), stop = intercept(vault, 'deriveKey');
    const old = settle(api.authenticateVault(vault, '2468', { storage: privateStorage, saltStorage: privateStorage }));
    await stop.ready.promise;
    vault.lock(); vault._publicMode = true;
    await api.authenticateVault(vault, '1357', { storage: publicStorage, saltStorage: publicStorage });
    const publicWrites = publicStorage.writes;
    stop.release.resolve();
    outcomes['superseded-auth-keeps-new-unlock'] = await old === 'vault-operation-cancelled' && vault.isUnlocked() && vault._pin === '1357' && privateStorage.writes === 0 && publicStorage.writes === publicWrites;
  }
  for (const method of ['encrypt', 'decrypt']) {
    const vault = makeVault(), storage = memory({ aio_portfolio_data: '[{"ticker":"AAPL"}]' });
    vault._derivedKey = { pin: '2468' };
    const stop = intercept(vault, method);
    const pending = settle(api.migrateVault(vault, { storage, sensitiveKeys: ['aio_portfolio_data'] }));
    await stop.ready.promise;
    vault.lock(); vault._publicMode = true;
    const writesAtLock = storage.writes;
    stop.release.resolve();
    outcomes['migration-' + method] = await pending === 'vault-operation-cancelled' && storage.writes === writesAtLock && Object.keys(vault._keyRuntime).length === 0;
  }
  {
    const vault = makeVault(), storage = memory({ aio_portfolio_data: 'aio_enc::[]' }), ready = deferred(), release = deferred();
    vault._derivedKey = { pin: '2468' };
    const pending = settle(api.restorePortfolioVault(vault, { storage, readDecrypted: async () => { ready.resolve(); await release.promise; return '[]'; } }));
    await ready.promise;
    vault.lock(); vault._derivedKey = { pin: '1357' }; vault._pin = '1357'; vault._keyRuntime = { newSession: 'keep' };
    release.resolve();
    outcomes['restore-keeps-new-session'] = await pending === 'vault-operation-cancelled' && vault.isUnlocked() && vault._keyRuntime.newSession === 'keep' && !('aio_portfolio_data' in vault._keyRuntime);
  }
  return outcomes;
}

async function main() {
  mkdirSync(artifactDir, { recursive: true });
  const server = isLive ? null : await startServer();
  const browser = await chromium.launch();
  const report = {
    schemaVersion: 'aio-portfolio-vault-evidence.v1',
    observedAt: new Date().toISOString(),
    appRevision: isLive ? null : localRevision,
    gitHead: isLive ? null : localGitHead,
    checks: [], errors: [],
    scope: isLive ? `live Chromium, ${baseUrl}, external network allowed` : 'local Chromium, external network blocked'
  };
  const check = (id, ok, detail) => report.checks.push({ id, ok: !!ok, detail: detail || '' });
  // P1277: the artifact itself must identify the tested source or served revision.
  check('P1277 evidence revision bound', !!report.appRevision || isLive, 'local appRevision and gitHead are required');
  if (!isLive) check('P1277 local source SHA bound', !!report.gitHead, 'git rev-parse HEAD');
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    if (!isLive) {
      await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (isLive) report.appRevision = await page.evaluate(async () => {
      try { const response = await fetch('./version.json', { cache: 'no-store' }); return response.ok ? (await response.json()).version || null : null; }
      catch (_) { return null; }
    });
    if (isLive) check('P1277 live served revision bound', !!report.appRevision, 'live /version.json');
    await page.waitForFunction(() => typeof window.AIO === 'object' && typeof window.AIO.loadTests === 'function', { timeout: 30000 });
    // P1350: test the production bridge, never inject a substitute implementation.
    await page.waitForFunction(() => typeof window._aioFinancialSecurity?.authenticateVault === 'function', { timeout: 30000 });
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

    const kdfMigration = await page.evaluate(async () => {
      document.getElementById('pf-pin-input').value = '2468';
      await window.unlockPortfolio();
      const legacyKey = await _AioVault.deriveKey('2468', _AioVault._salt, 100000);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = 'legacy-kdf-fixture';
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, legacyKey, new TextEncoder().encode(plaintext));
      const payload = new Uint8Array(12 + 16 + encrypted.byteLength);
      payload.set(iv, 0);
      payload.set(_AioVault._salt, 12);
      payload.set(new Uint8Array(encrypted), 28);
      localStorage.setItem('aio_claude_api_key', 'aio_enc::' + btoa(String.fromCharCode.apply(null, payload)));
      _AioVault.lock();
      window.showPage('portfolio');
      document.getElementById('pf-pin-input').value = '2468';
      await window.unlockPortfolio();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const raw = localStorage.getItem('aio_claude_api_key') || '';
      const decoded = raw.startsWith('aio_enc::') ? atob(raw.slice(9)) : '';
      return {
        legacyValueRestored: _AioVault._keyRuntime?.aio_claude_api_key === plaintext,
        reencryptedV2: decoded.charCodeAt(0) === 0x41 && decoded.charCodeAt(1) === 0x49 && decoded.charCodeAt(2) === 0x4f && decoded.charCodeAt(3) === 2,
        decryptVersion: _AioVault._lastDecryptVersion
      };
    });
    check('PFE2-09 legacy_kdf_decrypts_and_reencrypts_v2', kdfMigration.legacyValueRestored && kdfMigration.reencryptedV2, JSON.stringify(kdfMigration));

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
      const text = document.getElementById('pf-main')?.textContent || '';
      const parsed = JSON.parse(raw);
      return { optOutPlain: raw.startsWith('['), rawRoundTrip: parsed[0]?.memo === '<img src=x onerror=alert(1)>', domHasExecutableHandler: document.querySelectorAll('#pf-main img,[onerror]').length > 0, escapedTextVisible: text.includes('<img src=x onerror=alert(1)>') };
    });
    check('PFE2-07 opt_out_is_explicit_plaintext', boundary.optOutPlain && boundary.rawRoundTrip, JSON.stringify(boundary));
    check('PFE2-08 portfolio_input_boundary', !boundary.domHasExecutableHandler && boundary.escapedTextVisible, JSON.stringify(boundary));

    // P1176 (22 PFR01/PFR06): an empty target field used to be serialized as 0, and the native
    // cell then rendered $0.00 with a -100% potential return. An unset target must stay unset end
    // to end, while a real target must still render as an amount — the second half is the control
    // that keeps this check from passing on an always-empty table.
    const targetSemantics = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      _AioVault.lock();
      localStorage.removeItem('aio_portfolio_data');
      window.showPage('portfolio');
      const fill = (ticker, cost, target) => {
        document.getElementById('pf-add-ticker').value = ticker;
        document.getElementById('pf-add-qty').value = '1';
        document.getElementById('pf-add-cost').value = String(cost);
        document.getElementById('pf-add-target').value = target;
        window.addPortfolioPosition();
      };
      fill('AAPL', 90, '');
      fill('MSFT', 90, '150');
      const cell = (ticker) => (document.querySelector(`#pf-positions-tbody tr[data-arg="${ticker}"] td[headers="pf-th-target"]`)?.textContent || '').trim();
      const started = Date.now();
      while (Date.now() - started < 3000 && !(cell('AAPL') && cell('MSFT'))) await new Promise((resolve) => setTimeout(resolve, 50));
      const stored = window.getPortfolioData();
      const storedTarget = (ticker) => (stored.find((row) => String(row.ticker || row.sym || '').toUpperCase() === ticker) || {}).target;
      return {
        unsetStored: storedTarget('AAPL'),
        unsetCell: cell('AAPL'),
        setStored: storedTarget('MSFT'),
        setCell: cell('MSFT')
      };
    });
    check('PFR-01 unset_target_stays_unset (P1176)', targetSemantics.unsetStored === null, JSON.stringify(targetSemantics));
    check('PFR-01 unset_target_not_rendered_as_zero (P1176)', targetSemantics.unsetCell === '미설정' && !/\$0\.00|-100/.test(targetSemantics.unsetCell), JSON.stringify(targetSemantics));
    check('PFR-01 real_target_still_renders_amount (P1176)', targetSemantics.setStored === 150 && /^\$150/.test(targetSemantics.setCell), JSON.stringify(targetSemantics));

    // E3/P1181 (11 P11-01): durable acknowledgement — 메모리 반영과 영구 저장은 다른 사건이다.
    // persist가 거부되면 ack는 실패로 돌아야 하며(거짓 완료 금지), 저장 경로는 성공 ack를 양성 대조로 남긴다.
    const durableAck = await page.evaluate(async () => {
      // P1350: this fixture tests quota failure on an unprotected repository, not a locked Vault.
      localStorage.clear(); _AioVault.lock();
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      const originalSafeLS = window.safeLS;
      let failureAck = null;
      let memoryRow = false;
      localStorage.removeItem('aio_portfolio_vault_optout');
      window.safeLS = () => Promise.reject(new Error('fixture-persist-rejected'));
      try {
        failureAck = await window.savePortfolioData([{ ticker: 'ACKT', qty: 1, cost: 10, memo: 'ack-fixture' }]);
        // optout을 되살리기 전에 읽는다 — 되살린 뒤면 getPortfolioData가 메모리 캐시 대신
        // (safeLS가 거부했으므로 ACKT가 없는) legacy 저장 경로를 읽는다.
        memoryRow = window.getPortfolioData().some((row) => String(row.ticker || row.sym || '').toUpperCase() === 'ACKT');
      } finally {
        window.safeLS = originalSafeLS;
        localStorage.setItem('aio_portfolio_vault_optout', '1');
      }
      const successAck = await window.savePortfolioData([{ ticker: 'ACKT', qty: 1, cost: 10, memo: 'ack-fixture' }]);
      const durableRow = (localStorage.getItem('aio_portfolio_data') || '').includes('ACKT');
      return { failureAck, memoryRow, successAck, durableRow };
    });
    check('PFE2-10 durable_ack_reports_persist_failure (P1181)',
      durableAck.failureAck?.ok === false && durableAck.failureAck?.durable === false
      && durableAck.failureAck?.memoryApplied === true && durableAck.memoryRow === true,
      JSON.stringify(durableAck));
    check('PFE2-11 durable_ack_positive_control (P1181)',
      durableAck.successAck?.ok === true && durableAck.successAck?.durable === true && durableAck.durableRow === true,
      JSON.stringify(durableAck));

    // E3/P1187 (11 P11-02): 통화를 선언할 writer가 없어 선언은 import로만 들어왔고, 수정 경로는 객체를
    // 통째로 교체해 그 선언을 지웠다. 폼 선언이 저장까지 흐르고, 빈 선언은 미선언(null)로 남으며,
    // 형식이 틀린 선언은 저장되지 않는 것을 고정한다. 6자리 코드는 티커 검증을 항상 통과하므로
    // 거부가 통화 검증에서만 일어났다는 것이 판별 가능하다.
    const currencyWriter = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      _AioVault.lock();
      localStorage.removeItem('aio_portfolio_data');
      window.showPage('portfolio');
      const fill = (ticker, costCurrency) => {
        document.getElementById('pf-add-ticker').value = ticker;
        document.getElementById('pf-add-qty').value = '1';
        document.getElementById('pf-add-cost').value = '90';
        document.getElementById('pf-add-target').value = '';
        document.getElementById('pf-add-memo').value = '';
        document.getElementById('pf-add-cost-currency').value = costCurrency;
        return window.addPortfolioPosition();
      };
      await fill('005930', 'krw');
      await fill('000660', '');
      const stored = window.getPortfolioData();
      const row = (ticker) => stored.find((entry) => String(entry.ticker || entry.sym || '').toUpperCase() === ticker) || {};
      const beforeInvalid = window.getPortfolioData().length;
      await fill('068270', 'US');
      const afterInvalid = window.getPortfolioData();
      return {
        declared: row('005930').costCurrency ?? null,
        undeclared: row('000660').costCurrency ?? null,
        invalidRejected: afterInvalid.length === beforeInvalid && !afterInvalid.some((entry) => entry.costCurrency === 'US')
      };
    });
    check('PFE2-12 cost_currency_writer_round_trip (P1187)',
      currencyWriter.declared === 'KRW' && currencyWriter.undeclared === null && currencyWriter.invalidRejected,
      JSON.stringify(currencyWriter));

    // E3/P1187 (11 P11-01): 가져오기·전체 삭제 경로는 savePortfolioData의 반환을 버려 persist가
    // 거부돼도 완료를 말했다. 두 경로 모두 실패 ack에서 성공 문구를 내지 않아야 한다.
    const ackPaths = await page.evaluate(async () => {
      const originalSafeLS = window.safeLS;
      const originalToast = window.showToast;
      const toasts = [];
      window.showToast = (msg) => { toasts.push(String(msg)); };
      const modal = document.getElementById('aio-confirm-modal');
      const settle = async (action) => {
        toasts.length = 0;
        const preModalHidden = modal.style.display !== 'flex';
        localStorage.setItem('aio_portfolio_vault_optout', '1');
        window.safeLS = originalSafeLS;
        action();
        let started = Date.now();
        while (Date.now() - started < 2000 && modal.style.display !== 'flex') await new Promise((r) => setTimeout(r, 20));
        const modalShown = modal.style.display === 'flex';
        localStorage.removeItem('aio_portfolio_vault_optout'); // force the safeLS (Vault) path
        window.safeLS = () => Promise.reject(new Error('fixture-persist-rejected'));
        document.getElementById('aio-confirm-ok').click();
        started = Date.now();
        while (Date.now() - started < 2000 && !toasts.length) await new Promise((r) => setTimeout(r, 20));
        return { preModalHidden, modalShown, messages: [...toasts] };
      };
      let importResult;
      let clearResult;
      try {
        const file = new File([JSON.stringify([{ ticker: '005930', qty: 1, cost: 10 }])], 'p.json', { type: 'application/json' });
        importResult = await settle(() => window.importPortfolio({ target: { files: [file] } }));
        clearResult = await settle(() => window.clearAllPositions());
      } finally {
        window.safeLS = originalSafeLS;
        window.showToast = originalToast;
        localStorage.setItem('aio_portfolio_vault_optout', '1');
      }
      return { importResult, clearResult };
    });
    check('PFE2-13 import_does_not_claim_completion_on_persist_failure (P1187)',
      ackPaths.importResult?.preModalHidden === true && ackPaths.importResult?.modalShown === true
      && ackPaths.importResult?.messages.length === 1
      && /영구 저장 실패/.test(ackPaths.importResult.messages[0])
      && /가져오기가 확정되지 않았습니다/.test(ackPaths.importResult.messages[0])
      && !/가져오기 완료/.test(ackPaths.importResult.messages[0]),
      JSON.stringify(ackPaths.importResult));
    check('PFE2-14 clear_all_does_not_claim_completion_on_persist_failure (P1187)',
      ackPaths.clearResult?.preModalHidden === true && ackPaths.clearResult?.modalShown === true
      && ackPaths.clearResult?.messages.length === 1
      && /전체 삭제가 확정되지 않았습니다/.test(ackPaths.clearResult.messages[0]),
      JSON.stringify(ackPaths.clearResult));

    // E3/E4/P1188 (11 P11-02): 계좌·현금 통화와 현금 수익률·RF는 폼이 쓰는 입력이다. 선언이
    // 저장 키로 흐르고, 무효 형식은 조용히 남지 않고 지워지는 것을 실브라우저에서 고정한다.
    const assumptionWriter = await page.evaluate(() => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      window.showPage('portfolio');
      const set = (id, value) => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.value = value;
        window.savePortfolioAssumption(id, el.value);
        return true;
      };
      const present = set('pf-cash-currency-input', 'krw') && set('pf-base-currency-input', 'USD')
        && set('pf-rf-input', '3') && set('pf-cash-return-input', '4');
      const read = (key) => localStorage.getItem(key);
      const declared = {
        cashCurrency: read('aio_portfolio_cash_currency'),
        baseCurrency: read('aio_portfolio_base_currency'),
        rf: read('aio_portfolio_rf'),
        cashReturn: read('aio_portfolio_cash_return')
      };
      set('pf-cash-currency-input', 'US'); // invalid → the declaration must not survive
      const invalidRemoved = read('aio_portfolio_cash_currency') === null;
      return { present, declared, invalidRemoved };
    });
    check('PFE2-15 assumption_writer_declares_and_rejects (P1188)',
      assumptionWriter.present === true && assumptionWriter.declared.cashCurrency === 'KRW'
      && assumptionWriter.declared.baseCurrency === 'USD' && assumptionWriter.declared.rf === '3'
      && assumptionWriter.declared.cashReturn === '4' && assumptionWriter.invalidRemoved === true,
      JSON.stringify(assumptionWriter));

    // E4/P1191: 계좌 원장이 폼 → Vault 경로 저장 → TWR/MWR 계약을 실제 브라우저에서 통과하는지.
    const ledgerFlow = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      window.showPage('portfolio');
      const ids = ['pf-ledger-section', 'pf-ledger-flow-timing', 'pf-ledger-date', 'pf-ledger-amount', 'pf-ledger-valuation-date', 'pf-ledger-valuation-amount', 'pf-ledger-list'];
      const present = ids.every((id) => !!document.getElementById(id));
      const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
      setValue('pf-ledger-date', '2026-06-30');
      setValue('pf-ledger-amount', '50');
      await window._aioAddLedgerEntry();
      setValue('pf-ledger-valuation-date', '2026-01-01');
      setValue('pf-ledger-valuation-amount', '100');
      await window._aioAddLedgerValuation();
      setValue('pf-ledger-valuation-date', '2027-01-01');
      setValue('pf-ledger-valuation-amount', '160');
      await window._aioAddLedgerValuation();
      const boxes = Array.from(document.querySelectorAll('#pf-ledger-coverage input[type="checkbox"]'));
      for (const box of boxes) { box.checked = true; await window._aioSetLedgerCoverage(box); }
      const ledger = window.getPortfolioLedger();
      const listRows = document.querySelectorAll('#pf-ledger-list > div').length;
      const perf = window._pfAssessAccountPerformance({ ledger: { ...ledger, currency: 'USD' } });
      // 음성 대조: 포함 범위를 하나 빼면 같은 원장이 자기 사유로 보류된다.
      boxes[0].checked = false;
      await window._aioSetLedgerCoverage(boxes[0]);
      const held = window._pfAssessAccountPerformance({ ledger: { ...window.getPortfolioLedger(), currency: 'USD' } });
      return {
        present, coverageBoxes: boxes.length, listRows,
        transactions: ledger?.transactions?.length || 0, valuations: ledger?.valuations?.length || 0,
        status: perf.status, twr: perf.twr, mwr: perf.mwr,
        heldStatus: held.status, heldCode: held.code
      };
    });
    check('PFE2-16 ledger_input_feeds_account_performance (P1191)',
      ledgerFlow.present === true && ledgerFlow.coverageBoxes === 6 && ledgerFlow.listRows === 3
      && ledgerFlow.transactions === 1 && ledgerFlow.valuations === 2
      && ledgerFlow.status === 'ready' && Math.abs(ledgerFlow.twr - 0.10) < 1e-9 && ledgerFlow.mwr != null
      && ledgerFlow.heldStatus === 'blocked' && ledgerFlow.heldCode === 'account-input-incomplete',
      JSON.stringify(ledgerFlow));

    // E3/E4/P1191: 선언한 통화·수익률·RF·원장이 실제 화면에 그려지는지. 네트워크 경계(시세·차트)만
    // 스텁하고, 나머지 경로(폼 선언 → reader → provider → surface/패널)는 실코드로 돌린다.
    const rendered = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 100, currency: 'USD', costCurrency: 'USD', sector: 'Tech', targetWeight: 50 },
        { ticker: 'BBB', qty: 5, cost: 200, currency: 'USD', costCurrency: 'USD', sector: 'Health', targetWeight: 50 }
      ]));
      localStorage.setItem('aio_portfolio_cash', '5000');
      localStorage.setItem('aio_portfolio_base_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_return', '4');
      localStorage.setItem('aio_portfolio_rf', '3');
      await window.savePortfolioLedger({
        currency: 'USD', dayCount: 'actual-365', flowTiming: 'end-of-period',
        coverage: { trades: true, 'deposits-withdrawals': true, 'dividends-splits': true, 'fees-taxes': true, fx: true, 'valuation-cuts': true },
        transactions: [{ date: '2026-06-30', kind: 'deposit', amount: 50 }],
        valuations: [{ date: '2026-01-01', amount: 100 }, { date: '2027-01-01', amount: 160 }]
      });
      const start = Date.UTC(2026, 6, 1);
      const stamps = Array.from({ length: 40 }, (_, i) => start + i * 86400000);
      const series = (fn) => ({ timestamps: stamps, adjustedCloses: stamps.map((_, i) => fn(i)), backtestEligible: true });
      window._fetchYahooChartData = async (symbol) => (symbol === 'AAA'
        ? series((i) => 100 + Math.sin(i / 3) * 4 + i * 0.5)
        : series((i) => 100 + Math.cos(i / 4) * 3 + i * 0.2));
      window._aioDecisionMetric = (symbol) => ({ allowedUse: true, value: symbol === 'AAA' ? 150 : 210, ts: Date.UTC(2026, 7, 10), source: 'fixture' });
      window.showPage('portfolio');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await window.refreshPortfolioRisk();
      await new Promise((resolve) => setTimeout(resolve, 80));
      // 네이티브 포트폴리오 표면은 라우트 마운트 때 계산된다 — 선언을 바꾼 뒤 다시 마운트해
      // 통화 주석이 새 선언을 읽게 한다(값을 바꾸는 것이 아니라 다시 그리게 하는 것).
      window.showPage('home');
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.showPage('portfolio');
      await new Promise((resolve) => setTimeout(resolve, 120));
      return {
        currencyNote: (document.getElementById('pf-currency-note') || {}).textContent || '',
        riskHtml: (document.getElementById('pf-risk-metrics') || {}).innerHTML || ''
      };
    });
    check('PFE2-17 declared_currency_and_performance_render (P1188/P1191)',
      rendered.currencyNote.includes('통화 USD')
      && /실제 계좌 성과 TWR \+10\.00%/.test(rendered.riskHtml)
      && /MWR \+8\.\d\d%/.test(rendered.riskHtml)
      && /USD · end-of-period · \d+기간/.test(rendered.riskHtml)
      && /계좌 전체/.test(rendered.riskHtml)
      && /RF 입력/.test(rendered.riskHtml)
      && /snapshot pfcomp-/.test(rendered.riskHtml)
      && !/현금 보류/.test(rendered.riskHtml),
      JSON.stringify({ currencyNote: rendered.currencyNote, riskHtml: rendered.riskHtml.slice(0, 700) }));

    // E4/P1193 + E3/P1181: 측정 경로를 전략으로 선언하면 패널이 그 경로와 목표비중·sleeve 분모를
    // 게시해야 하고, 통화가 혼합/원가 불일치면 네이티브 주석이 그 보류를 말해야 한다.
    const declaredStates = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      window.savePortfolioAssumption('pf-exposure-path-input', 'fixed_target_weight_strategy');
      window.savePortfolioAssumption('pf-rebalance-policy-input', 'monthly');
      await new Promise((resolve) => setTimeout(resolve, 40));
      await window.refreshPortfolioRisk();
      await new Promise((resolve) => setTimeout(resolve, 60));
      const strategyHtml = (document.getElementById('pf-risk-metrics') || {}).innerHTML || '';
      window.savePortfolioAssumption('pf-exposure-path-input', 'current_composition_retrospective');
      const positions = JSON.parse(localStorage.getItem('aio_portfolio_data'));
      positions[1].currency = 'KRW';       // 기준 통화와 다른 보유 통화 → 혼합
      positions[0].costCurrency = 'KRW';   // 원가 통화와 시세 통화 불일치 → P&L 보류
      localStorage.setItem('aio_portfolio_data', JSON.stringify(positions));
      window.showPage('home');
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.showPage('portfolio');
      await new Promise((resolve) => setTimeout(resolve, 140));
      return {
        strategyHtml,
        mixedNote: (document.getElementById('pf-currency-note') || {}).textContent || '',
        declaredPath: localStorage.getItem('aio_portfolio_risk_path')
      };
    });
    check('PFE2-18 strategy_path_and_currency_holds_render (P1193/P1181)',
      /고정 목표비중 전략/.test(declaredStates.strategyHtml)
      && /목표 AAA 50\.0%\/BBB 50\.0%/.test(declaredStates.strategyHtml)
      && /invested_sleeve\(주식 부분\)/.test(declaredStates.strategyHtml)
      && /전략 경로의 계좌 범위 미선언/.test(declaredStates.strategyHtml)
      && declaredStates.declaredPath === 'current_composition_retrospective'
      && declaredStates.mixedNote.includes('통화 혼합')
      && declaredStates.mixedNote.includes('환산 없어 합계 보류')
      && declaredStates.mixedNote.includes('원가/시세 불일치'),
      JSON.stringify({ strategyHtml: (declaredStates.strategyHtml || '').slice(0, 600), mixedNote: declaredStates.mixedNote, declaredPath: declaredStates.declaredPath }));

    // E3/P1194: 선언한 FX leg가 저장되고, 그 leg로 혼합 통화 합계가 실제로 환산되며, 지우면 다시
    // 보류로 돌아가는지(양성·음성 대조)를 실브라우저에서 확인한다.
    const fxFlow = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 100, currency: 'USD', costCurrency: 'USD', sector: 'Tech', targetWeight: 50 },
        { ticker: 'BBB', qty: 10, cost: 10000, currency: 'KRW', costCurrency: 'KRW', sector: 'Health', targetWeight: 50 }
      ]));
      localStorage.setItem('aio_portfolio_cash', '0');
      localStorage.setItem('aio_portfolio_base_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_currency', 'USD');
      const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
      setValue('pf-fx-from', 'USD');
      setValue('pf-fx-to', 'KRW');
      setValue('pf-fx-rate', '1350');
      setValue('pf-fx-date', new Date().toISOString().slice(0, 10));
      await window._aioAddFxLeg();
      const stored = window.getPortfolioFxLegs();
      const listed = document.querySelectorAll('#pf-fx-list > div').length;
      const remount = async () => {
        window.showPage('home');
        await new Promise((resolve) => setTimeout(resolve, 60));
        window.showPage('portfolio');
        await new Promise((resolve) => setTimeout(resolve, 170));
        return (document.getElementById('pf-currency-note') || {}).textContent || '';
      };
      const convertedNote = await remount();
      const removed = await window._aioRemoveFxLeg(0);
      const heldNote = await remount();
      return { stored, listed, convertedNote, heldNote, removedOk: removed.ok === true, remaining: window.getPortfolioFxLegs().length };
    });
    check('PFE2-19 declared_fx_leg_converts_and_reverts (P1194)',
      fxFlow.removedOk === true && fxFlow.listed === 1 && fxFlow.remaining === 0
      && fxFlow.stored.length === 1 && fxFlow.stored[0].from === 'USD' && fxFlow.stored[0].to === 'KRW' && fxFlow.stored[0].rate === 1350
      && fxFlow.convertedNote.includes('통화 환산(선언 rate) → USD')
      && fxFlow.heldNote.includes('통화 혼합') && fxFlow.heldNote.includes('환산 없어 합계 보류'),
      JSON.stringify(fxFlow));

    // E3/P1196: 원가 통화가 시세 통화와 다른 보유는 환산 근거가 없으면 P&L을 만들 수 없지만,
    // leg를 선언하면 두 축이 같은 기준 통화가 되어 P&L이 성립한다(양성·음성 대조).
    const costAxisFlow = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      localStorage.setItem('aio_portfolio_fx_legs', '[]');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 15000, price: 200, currency: 'USD', costCurrency: 'KRW', sector: 'Tech' }
      ]));
      localStorage.setItem('aio_portfolio_cash', '0');
      localStorage.setItem('aio_portfolio_base_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_currency', 'USD');
      // 시세는 앱이 실제로 읽는 런타임 입력(window._liveData)으로 넣는다 — 별도 경로를 만들지 않는다.
      const quote = { price: 200, observedAt: new Date().toISOString(), source: 'e2e-fixture', sourceKind: 'delayed' };
      const remount = async () => {
        window._liveData = { AAA: { ...quote, observedAt: new Date().toISOString() } };
        window.showPage('home');
        await new Promise((resolve) => setTimeout(resolve, 60));
        window.showPage('portfolio');
        await new Promise((resolve) => setTimeout(resolve, 170));
        return {
          note: (document.getElementById('pf-currency-note') || {}).textContent || '',
          pnl: (document.getElementById('pf-total-pnl') || {}).textContent || ''
        };
      };
      const held = await remount();
      const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value; };
      setValue('pf-fx-from', 'KRW');
      setValue('pf-fx-to', 'USD');
      setValue('pf-fx-rate', String(1 / 1350));
      setValue('pf-fx-date', new Date().toISOString().slice(0, 10));
      await window._aioAddFxLeg();
      const converted = await remount();
      return { held, converted, legs: window.getPortfolioFxLegs().length };
    });
    check('PFE2-20 declared_leg_enables_cost_axis_pnl (P1196)',
      costAxisFlow.legs === 1
      && costAxisFlow.held.note.includes('원가/시세 불일치 — P&L 보류') && costAxisFlow.held.pnl.trim() === '—'
      && costAxisFlow.converted.note.includes('원가/시세 불일치 — 선언 rate로 환산')
      && costAxisFlow.converted.pnl.trim() !== '—' && costAxisFlow.converted.pnl.includes('1,88'),
      JSON.stringify(costAxisFlow));

    // P1198: 셸은 선언되지 않은 정책을 지어내지 않는다 — 전략 경로에서 정책을 지우면 'daily로 돌았다'가
    // 아니라 엔진이 보류해야 하고, 패널은 선언/적용/미선언을 구분해 말해야 한다(양성·음성 대조).
    const policyDeclarationFlow = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Tech', targetWeight: 50 },
        { ticker: 'BBB', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Health', targetWeight: 50 }
      ]));
      localStorage.setItem('aio_portfolio_cash', '0');
      localStorage.setItem('aio_portfolio_base_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_currency', 'USD');
      const remount = async () => {
        window.showPage('home');
        await new Promise((resolve) => setTimeout(resolve, 60));
        window.showPage('portfolio');
        await new Promise((resolve) => setTimeout(resolve, 180));
        return (document.getElementById('pf-risk-panel') || document.getElementById('pf-analysis-status') || {}).textContent || '';
      };
      // (1) 회고 경로 + 정책 선언 → 선언된 정책은 '미사용'으로 표시된다.
      window.savePortfolioAssumption('pf-exposure-path-input', 'current_composition_retrospective');
      window.savePortfolioAssumption('pf-rebalance-policy-input', 'monthly');
      const retrospective = await remount();
      // (2) 전략 경로 + 정책 삭제 → 지어낸 기본값이 아니라 보류여야 한다.
      window.savePortfolioAssumption('pf-exposure-path-input', 'fixed_target_weight_strategy');
      localStorage.removeItem('aio_portfolio_rebalance_policy');
      const strategyUndeclared = await remount();
      // (3) 정책을 다시 선언하면 전략 경로가 성립한다.
      window.savePortfolioAssumption('pf-rebalance-policy-input', 'monthly');
      const strategyDeclared = await remount();
      return { retrospective, strategyUndeclared, strategyDeclared };
    });
    check('PFE2-21 undeclared_policy_is_never_invented (P1198)',
      policyDeclarationFlow.retrospective.includes('rebalance monthly(미사용)')
      && !policyDeclarationFlow.retrospective.includes('rebalance daily')
      && policyDeclarationFlow.strategyUndeclared.includes('rebalance-policy-required')
      && !policyDeclarationFlow.strategyUndeclared.includes('rebalance daily(미사용)')
      && policyDeclarationFlow.strategyDeclared.includes('고정 목표비중 전략')
      && policyDeclarationFlow.strategyDeclared.includes('rebalance monthly'),
      JSON.stringify({ retrospective: policyDeclarationFlow.retrospective.slice(0, 400), undeclared: policyDeclarationFlow.strategyUndeclared.slice(0, 400), declared: policyDeclarationFlow.strategyDeclared.slice(0, 400) }));

    // P1200/P1201: 현금 몫이 계좌 범위를 선언하는지(양성·음성 대조)와, 회고 경로에서 정책 셀렉터가
    // 비활성으로 그 사실을 드러내는지를 실브라우저에서 확인한다.
    const strategyCashFlow = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Tech', targetWeight: 40 },
        { ticker: 'BBB', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Health', targetWeight: 40 }
      ]));
      localStorage.setItem('aio_portfolio_cash', '0');
      localStorage.setItem('aio_portfolio_base_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_return', '3.65');
      const remount = async () => {
        window.showPage('home');
        await new Promise((resolve) => setTimeout(resolve, 60));
        window.showPage('portfolio');
        await new Promise((resolve) => setTimeout(resolve, 180));
        return {
          panel: (document.getElementById('pf-risk-metrics') || {}).textContent || '',
          policyDisabled: (document.getElementById('pf-rebalance-policy-input') || {}).disabled === true
        };
      };
      window.savePortfolioAssumption('pf-rebalance-policy-input', 'monthly');
      window.savePortfolioAssumption('pf-exposure-path-input', 'fixed_target_weight_strategy');
      const partial = await remount();
      // 초과 배분(120%)은 여전히 무효다 — 현금 몫이 아니라 잘못된 선언이다.
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Tech', targetWeight: 70 },
        { ticker: 'BBB', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Health', targetWeight: 50 }
      ]));
      const over = await remount();
      window.savePortfolioAssumption('pf-exposure-path-input', 'current_composition_retrospective');
      const retrospective = await remount();
      return { partial, over, retrospective };
    });
    check('PFE2-22 strategy_cash_share_and_inert_policy_ux (P1200/P1201)',
      strategyCashFlow.partial.panel.includes('현금 20.0%') && !strategyCashFlow.partial.panel.includes('strategy-target-weights-invalid')
      && strategyCashFlow.partial.policyDisabled === false
      && strategyCashFlow.over.panel.includes('strategy-target-weights-invalid')
      && strategyCashFlow.retrospective.policyDisabled === true
      && strategyCashFlow.retrospective.panel.includes('rebalance monthly(미사용)'),
      JSON.stringify({ partial: strategyCashFlow.partial.panel.slice(0, 300), over: strategyCashFlow.over.panel.slice(0, 200), retrospective: { panel: strategyCashFlow.retrospective.panel.slice(0, 200), disabled: strategyCashFlow.retrospective.policyDisabled } }));

    // P1202: VaR `certified` 렌더 상태를 실측한다 — 판정 자체는 ESM fixture가 고정했지만(P1190),
    // 긴 표본에서 랩 행이 실제로 '인증'을 그리는지는 브라우저에서 본 적이 없었다. 짧은 표본은 '인증 보류'로
    // 남아야 한다(양성·음성 대조).
    const varCertFlow = await page.evaluate(async () => {
      localStorage.setItem('aio_portfolio_vault_optout', '1');
      localStorage.setItem('aio_portfolio_data', JSON.stringify([
        { ticker: 'AAA', qty: 10, cost: 100, price: 150, currency: 'USD', sector: 'Tech', targetWeight: 100 }
      ]));
      localStorage.setItem('aio_portfolio_cash', '0');
      localStorage.setItem('aio_portfolio_base_currency', 'USD');
      localStorage.setItem('aio_portfolio_cash_currency', 'USD');
      // 인증 임계(표본 36·꼬리 3·상대 밴드 0.75·민감도 0.5)를 통과하려면 꼬리 구조가 **모든 창에서
      // 같아야** 한다 — 매끄러운 단조 시계열은 분산이 없어 밴드가 폭발했고, 난수 분포는 최근 절반의
      // VaR가 표본 전체와 어긋나 민감도가 초과했다(둘 다 확인 후). 6개월 주기(상승 5·하락 1)면
      // 표본 전체·최근 절반·최악 제거·근사 순위가 같은 꼬리를 본다.
      const monthlyStamps = (count) => Array.from({ length: count + 1 }, (_, i) => Date.UTC(2019 + Math.floor(i / 12), i % 12, 28));
      const cycleReturn = (index) => (index % 6 === 5 ? -0.06 : 0.015);
      const seriesFrom = (count) => {
        const closes = [100];
        for (let i = 0; i < count; i += 1) closes.push(closes[i] * (1 + cycleReturn(i)));
        const stamps = monthlyStamps(count);
        return { timestamps: stamps, closes, adjustedCloses: closes, backtestEligible: true, backtestPriceBasis: 'adjusted-close' };
      };
      const runLab = async (count) => {
        window._fetchYahooChartData = async () => seriesFrom(count);
        window.showPage('home');
        await new Promise((resolve) => setTimeout(resolve, 60));
        window.showPage('portfolio');
        await new Promise((resolve) => setTimeout(resolve, 120));
        await window.runPortfolioBacktestLab();
        await new Promise((resolve) => setTimeout(resolve, 60));
        const model = window._lastPortfolioBacktestLab && window._lastPortfolioBacktestLab.model;
        const cert = model && model.performance ? model.performance.varCertification : null;
        return {
          label: cert && typeof window._aioBtVarCertLabel === 'function' ? window._aioBtVarCertLabel(cert) : null,
          certification: cert ? cert.certification : null,
          sampleN: cert ? cert.sampleN : null,
          reasons: cert ? cert.certificationReasons : null
        };
      };
      const long = await runLab(72);
      const short = await runLab(13);
      return { long, short };
    });
    check('PFE2-23 var_certification_render_states (P1203)',
      varCertFlow.long.certification === 'certified' && varCertFlow.long.sampleN >= 36 && varCertFlow.long.label === '인증'
      && varCertFlow.short.certification === 'held' && String(varCertFlow.short.label).startsWith('인증 보류'),
      JSON.stringify({ long: varCertFlow.long, short: varCertFlow.short }));
    const races = await page.evaluate(runFinancialSecurityRaceFixtures);
    for (const [name, ok] of Object.entries(races)) check('P1350 cancelled Vault operation ' + name, ok, JSON.stringify(races));
    const security = await page.evaluate(async () => {
      localStorage.clear(); sessionStorage.clear(); _AioVault.lock(); _AioVault._publicMode = false;
      const keys = ['aio_portfolio_data', 'aio_portfolio_ledger', 'aio_portfolio_fx_legs'];
      const values = [JSON.stringify([{ticker:'AAPL',qty:2,cost:100,costCurrency:'USD'}]), JSON.stringify({transactions:[{amount:321}],valuations:[]}), JSON.stringify([{from:'USD',to:'KRW',rate:1400}])];
      keys.forEach((key, index) => localStorage.setItem(key, values[index]));
      localStorage.setItem('aio_claude_api_key','sk-ant-fixture-credential-only');
      await _AioVault.unlock('2468'); await _migrateToEncrypted(); await _restoreDecryptedKeys();
      const migrated = keys.every((key) => localStorage.getItem(key).startsWith('aio_enc::'));
      const sentinel = localStorage.getItem('aio_vault_verify_v1');
      const keyBackup = window._aioCollectKeySnapshot();
      const backupSeparated = !keys.some((key) => key in keyBackup) && keyBackup.aio_claude_api_key === 'sk-ant-fixture-credential-only';
      const stored = keys.map((key) => localStorage.getItem(key));
      _AioVault.lock();
      let rejected = false, overwriteRejected = false;
      try { await _AioVault.unlock('0000'); } catch (_) { rejected = true; }
      try { await safeLS(keys[1], 'overwrite'); } catch (_) { overwriteRejected = true; }
      const wrongSafe = rejected && overwriteRejected && !_AioVault.isUnlocked() && keys.every((key,index) => localStorage.getItem(key) === stored[index]) && window.getPortfolioData().length === 0 && window.getPortfolioLedger() === null;
      await _AioVault.unlock('2468'); await _restoreDecryptedKeys();
      const restored = keys.every((key,index) => _AioVault._keyRuntime[key] === values[index]);
      const originalConfirm = window.showConfirmModal;
      window.showConfirmModal = async (_title,_message,confirm) => { await confirm(); };
      try { window.resetPortfolioPin(); } finally { window.showConfirmModal = originalConfirm; }
      await new Promise((resolve) => setTimeout(resolve,150));
      const reset = keys.every((key,index) => localStorage.getItem(key) === values[index]) && localStorage.getItem('aio_portfolio_vault_optout') === '1' && localStorage.getItem('aio_claude_api_key').startsWith('aio_enc::') && localStorage.getItem('aio_vault_verify_v1') === sentinel;
      localStorage.removeItem('aio_portfolio_vault_optout');
      await _AioVault.unlock('2468'); await _migrateToEncrypted(); await _restoreDecryptedKeys();
      const reprotected = keys.every((key) => localStorage.getItem(key).startsWith('aio_enc::'));
      _AioVault.lock(); localStorage.removeItem('aio_vault_verify_v1');
      await _AioVault.unlock('2468');
      const legacySentinel = !!localStorage.getItem('aio_vault_verify_v1');
      // P1350: salt-only legacy state cannot establish whether a supplied PIN is correct.
      _AioVault.lock(); localStorage.clear(); localStorage.setItem('aio_vault_salt',btoa(String.fromCharCode(...new Uint8Array(16))));
      let saltOnly = false;
      try { await _AioVault.unlock('2468'); } catch (error) { saltOnly = error.message === 'vault-auth-evidence-missing' && !_AioVault.isUnlocked(); }
      // P1350: switching to public-PC session storage never reuses private-origin caches.
      localStorage.clear(); await _AioVault.unlock('2468'); await safeLS('aio_portfolio_data',values[0]); _AioVault._keyRuntime.aio_portfolio_data=values[0];
      const privateStored = localStorage.getItem('aio_portfolio_data');
      window._aioVaultPublicMode({checked:true});
      const publicIsolated = _AioVault._publicMode && !_AioVault.isUnlocked() && window.getPortfolioData().length === 0;
      await _AioVault.unlock('1357'); await safeLS('aio_portfolio_data','[]');
      const publicStored = sessionStorage.getItem('aio_portfolio_data')?.startsWith('aio_enc::') && localStorage.getItem('aio_portfolio_data') === privateStored;
      const privateBeforeOptout = keys.map((key) => localStorage.getItem(key));
      const publicConfirm = window.showConfirmModal;
      window.showConfirmModal = async (_title,_message,confirm) => { await confirm(); };
      try { window.resetPortfolioPin(); } finally { window.showConfirmModal = publicConfirm; }
      await new Promise((resolve) => setTimeout(resolve,150));
      const publicPositions = JSON.stringify([{ticker:'AAPL',qty:777,cost:100,costCurrency:'USD'}]);
      const publicLedger = {transactions:[{amount:999}],valuations:[]}, publicFx = [{from:'USD',to:'KRW',rate:1400}];
      const publicAcks = await Promise.all([window.savePortfolioData(JSON.parse(publicPositions)),window.savePortfolioLedger(publicLedger),window.savePortfolioFxLegs(publicFx)]);
      const publicOptout = publicAcks.every((ack) => ack.ok === true) && sessionStorage.getItem('aio_portfolio_vault_optout') === '1'
        && sessionStorage.getItem(keys[0]) === publicPositions && sessionStorage.getItem(keys[1]) === JSON.stringify(publicLedger) && sessionStorage.getItem(keys[2]) === JSON.stringify(publicFx)
        && keys.every((key,index) => localStorage.getItem(key) === privateBeforeOptout[index]);
      window._aioVaultPublicMode({checked:false});
      localStorage.clear(); sessionStorage.clear();
      await _AioVault.unlock('2468'); await safeLS('aio_claude_api_key','sk-ant-only-fixture'); _AioVault.lock();
      let keyOnlyRejected=false;
      try { await _AioVault.unlock('0000'); } catch (_) { keyOnlyRejected=!_AioVault.isUnlocked(); }
      await _AioVault.unlock('2468');
      keys.forEach((key,index)=>localStorage.setItem(key,values[index]));
      const originalSet=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){ if(key===keys[2] && String(value).startsWith('aio_enc::')) throw new DOMException('quota','QuotaExceededError'); return originalSet.call(this,key,value); };
      let rollback=false;
      try { await _migrateToEncrypted(); } catch (_) { rollback=keys.every((key,index)=>localStorage.getItem(key)===values[index]) && !_AioVault.isUnlocked(); }
      finally { Storage.prototype.setItem=originalSet; }
      await _AioVault.unlock('2468'); await _migrateToEncrypted();
      return { migrated, backupSeparated, wrongSafe, restored, reset, reprotected, legacySentinel, saltOnly, publicIsolated, publicStored, publicOptout, keyOnlyRejected, rollback };
    });
    check('P1350 financial_three_section_encryption',security.migrated,JSON.stringify(security));
    check('P1350 key_backup_excludes_personal_sections',security.backupSeparated,JSON.stringify(security));
    check('P1350 wrong_pin_no_plaintext_overwrite',security.wrongSafe,JSON.stringify(security));
    check('P1350 financial_cache_restore_after_lock',security.restored,JSON.stringify(security));
    check('P1350 reset_and_reprotect_preserve_credentials',security.reset && security.reprotected,JSON.stringify(security));
    check('P1350 legacy_auth_and_salt_only_fail_closed',security.legacySentinel && security.saltOnly,JSON.stringify(security));
    check('P1350 public_pc_storage_isolation',security.publicIsolated && security.publicStored,JSON.stringify(security));
    check('P1350 public_pc_optout_financial_writers_preserve_private_storage',security.publicOptout,JSON.stringify(security));
    check('P1350 credential_only_vault_authenticates_pin',security.keyOnlyRejected,JSON.stringify(security));
    check('P1350 migration_failure_restores_original_sections',security.rollback,JSON.stringify(security));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof window._aioFinancialSecurity?.authenticateVault==='function' && typeof window.unlockPortfolio==='function',{timeout:30000});
    const financialReload=await page.evaluate(async()=>{ document.getElementById('pf-pin-input').value='2468'; await window.unlockPortfolio(); return window.getPortfolioData()[0]?.ticker==='AAPL' && window.getPortfolioLedger()?.transactions?.[0]?.amount===321 && window.getPortfolioFxLegs()[0]?.rate===1400; });
    check('P1350 financial_three_sections_restore_after_reload',financialReload,String(financialReload));

    const aiPrivacy = await page.evaluate(() => {
      localStorage.clear(); sessionStorage.clear(); _AioVault.lock();
      const now = new Date().toISOString();
      const rows = [{ticker:'AAPL',qty:2,cost:100,costCurrency:'USD'},{ticker:'MSFT',qty:1,cost:200,costCurrency:'USD'}];
      const partial = window.AIO.redactPortfolioForAI(rows,{liveData:{AAPL:{price:150,currency:'USD',observedAt:now},MSFT:{price:null,currency:'USD',observedAt:now}}});
      const full = window.AIO.redactPortfolioForAI(rows,{liveData:{AAPL:{price:150,currency:'USD',observedAt:now},MSFT:{price:300,currency:'USD',observedAt:now}}});
      const mixed = window.AIO.redactPortfolioForAI(rows,{liveData:{AAPL:{price:150,currency:'USD',observedAt:now},MSFT:{price:300,currency:'KRW',observedAt:now}}});
      const stale = window.AIO.redactPortfolioForAI(rows,{liveData:{AAPL:{price:150,currency:'USD',observedAt:'2020-01-01T12:00:00Z'},MSFT:{price:300,currency:'USD',observedAt:'2020-01-01T12:00:00Z'}}});
      const invalidCalendar = window.AIO.redactPortfolioForAI(rows,{now:Date.parse('2026-03-02T12:00:00Z'),liveData:{AAPL:{price:150,currency:'USD',observedAt:'2026-02-30T12:00:00Z'},MSFT:{price:300,currency:'USD',observedAt:'2026-02-30T12:00:00Z'}}});
      localStorage.setItem('aio_portfolio_data',JSON.stringify(rows));
      localStorage.setItem('aio_portfolio_journal_v1',JSON.stringify([{ts:Date.now(),date:now,note:'RECENT_EXPLICIT_NOTE'}]));
      const note = document.getElementById('pf-journal-note'); note.value='CURRENT_EXPLICIT_NOTE';
      window.AIO.setPortfolioAIConsent(true); window.AIO.setPortfolioJournalAIConsent(false);
      const deniedJournal = !_aioBuildPortfolioActionPrompt('journal').includes('EXPLICIT_NOTE');
      window.AIO.setPortfolioJournalAIConsent(true);
      const normal = _aioBuildPortfolioActionPrompt('overview') + _aioBuildPortfolioActionPrompt('rebalance');
      const journal = _aioBuildPortfolioActionPrompt('journal');
      const noUnexpectedNotes = !normal.includes('EXPLICIT_NOTE') && deniedJournal && journal.includes('CURRENT_EXPLICIT_NOTE') && journal.includes('RECENT_EXPLICIT_NOTE');
      const preview = window.AIO.getPortfolioAIPrivacyPreview(rows,{includeJournal:true});
      window.AIO.setPortfolioAIConsent(false);
      const revoked = !window.AIO.hasPortfolioJournalAIConsent();
      const originalSet = Storage.prototype.setItem, originalToast = window.showToast, toasts=[];
      window.showToast=(value)=>toasts.push(String(value));
      Storage.prototype.setItem=function(key,value){ if(key==='aio_portfolio_journal_v1') throw new DOMException('quota','QuotaExceededError'); return originalSet.call(this,key,value); };
      let ack;
      try { ack=window._aioSavePortfolioJournal(); } finally { Storage.prototype.setItem=originalSet; window.showToast=originalToast; }
      const journalSuccess=window._aioSavePortfolioJournal()?.ok===true;
      return {partial,full,mixed,stale,invalidCalendar,noUnexpectedNotes,preview,revoked,journalFailure:ack?.ok===false && !toasts.some((value)=>value.includes('저장 완료')),journalSuccess};
    });
    check('P1350 AI_missing_price_keeps_unknown',aiPrivacy.partial.every((row)=>row.allocationPct===null) && aiPrivacy.partial[1].returnPct===null,JSON.stringify(aiPrivacy.partial));
    check('P1350 AI_matching_current_valuation_positive_control',aiPrivacy.full.every((row)=>row.allocationPct===50 && row.returnPct===50),JSON.stringify(aiPrivacy.full));
    check('P1350 AI_currency_mismatch_holds_weights',aiPrivacy.mixed.every((row)=>row.allocationPct===null),JSON.stringify(aiPrivacy.mixed));
    check('P1350 AI_identical_stale_dates_hold_valuation',aiPrivacy.stale.every((row)=>row.allocationPct===null && row.returnPct===null),JSON.stringify(aiPrivacy.stale));
    check('P1350 AI_calendar_rollover_is_not_an_observation',aiPrivacy.invalidCalendar.every((row)=>row.allocationPct===null && row.returnPct===null),JSON.stringify(aiPrivacy.invalidCalendar));
    check('P1350 journal_separate_consent_and_preview',aiPrivacy.noUnexpectedNotes && aiPrivacy.preview.noteIncluded && aiPrivacy.preview.fields.includes('currentJournal') && aiPrivacy.revoked,JSON.stringify(aiPrivacy));
    check('P1350 journal_storage_failure_is_not_success',aiPrivacy.journalFailure,JSON.stringify(aiPrivacy));
    check('P1350 journal_storage_success_positive_control',aiPrivacy.journalSuccess,JSON.stringify(aiPrivacy));
    report.page = await page.evaluate(() => ({ encryptedMarker: localStorage.getItem('aio_portfolio_data')?.slice(0, 9), optOut: localStorage.getItem('aio_portfolio_vault_optout') }));
  } catch (error) {
    report.errors.push(String(error && error.stack || error));
  } finally {
    writeFileSync(resolve(artifactDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    await browser.close();
    if (server) server.kill();
  }
  const failed = report.checks.filter((item) => !item.ok);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length || failed.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
}
