import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve('.');
const port = 8897;
const server = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, fail) => {
  const timer = setTimeout(ok, 1800);
  server.stdout.on('data', d => { if (String(d).includes('AIO local server')) { clearTimeout(timer); ok(); } });
  server.on('error', fail);
});

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO && window.CHAT_CONTEXTS, { timeout: 30000 });
  const result = await page.evaluate(() => {
    const A = window.AIO;
    const ctx = window.CHAT_CONTEXTS || {};
    const contextRows = Object.keys(ctx).sort().map(id => {
      let text = '', error = '';
      try { text = typeof ctx[id].system === 'function' ? String(ctx[id].system()) : String(ctx[id].system || ''); }
      catch (e) { error = e.message; }
      const splitAt = text.indexOf('【데이터 검증 상태');
      return { id, promptChars: text.length, approxTokens: Math.round(text.length / 4), cacheSplitAt: splitAt, dynamicCharsAfterSplit: splitAt >= 0 ? text.length - splitAt : null, hasSystem: !!text, error, hasFreshness: /fetched|기준일|source|신선|fresh/i.test(text), hasInjectionBoundary: /untrusted|비신뢰|명령으로 취급|prompt injection|프롬프트 인젝션/i.test(text) };
    });
    const validators = {
      wrongLabelFgAsVix: A.assertChatResponseAccuracy('현재 VIX는 49입니다. [Source: CNN · 기준일: 2026-07-12]', []),
      wrongNfpUnit10x: A.assertChatResponseAccuracy('NFP는 570K입니다. [Source: FRED · 기준일: 2026-07-12]', []),
      fakeSourceNearby: A.assertChatEvidenceReferences('현재 VIX는 49입니다. Source: Yahoo · 기준일: 2026-07-12', { tickers: [] }),
      staleTrainingClaim: A.getChatHallucinationAudit('학습 데이터 기준 NVDA는 약 $150입니다.'),
      structurallyPlausibleWrongAnswer: A.assertChatAnswerStructureAudit('결론: 현재 VIX는 49입니다. Source: Yahoo · 기준일: 2026-07-12. Bull 50%, Base 30%, Bear 20%. 액션: 관망.'),
      xssSanitized: !/onerror|<script/i.test(window._aioSafeMD('<img src=x onerror=alert(1)><script>alert(1)</script>'))
    };
    return {
      generatedAt: new Date().toISOString(),
      contextCount: contextRows.length,
      contextRows,
      audits: {
        contexts: A.auditAllChatContexts && A.auditAllChatContexts(),
        consistency: A.getChatContextConsistencyAudit && A.getChatContextConsistencyAudit(),
        functions: A.assertChatFunctionCoverage && A.assertChatFunctionCoverage(),
        dom: A.assertChatPanelDomAudit && A.assertChatPanelDomAudit(),
        stale: A.auditChatContextStaleDates && A.auditChatContextStaleDates()
      },
      validators
    };
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
  server.kill();
}
