// scripts/ci-worker-anthropic-check.mjs — WO-1B (CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md P0-3, P662)
//
// 왜: cloudflare-worker-proxy.js의 POST /anthropic 라우트가 일반 데이터 프록시의 bot-UA 검사·
// rate limit·도메인 allowlist를 전부 우회했고, 호출자 인증도 origin 서버측 강제도 없었으며,
// KV 미바인딩이면 일일 캡이 조용히 무제한으로 새는 구조였다(Codex P0-3). 이 게이트는 그 수정
// (kill switch, 서버측 Origin 강제, 선택적 앱 토큰, /anthropic 전용 레이트리밋, KV fail-closed,
// body 크기 상한)이 실제로 동작하는지 Worker 핸들러를 Node에서 직접 호출해 행동 검증한다 —
// 이 파일은 Node 18+ 네이티브 Request/Response/URL/crypto만으로 실행 가능해 브라우저/Playwright
// 없이도 진짜 동작을 검증할 수 있다(B8/WO-1A의 "정적 계약만" 제약이 여기는 적용되지 않는다).

import worker from '../cloudflare-worker-proxy.js';

const errors = [];
const check = (label, condition, detail) => {
  if (!condition) errors.push(label + (detail !== undefined ? ': got ' + JSON.stringify(detail) : ''));
};

const GOOD_ORIGIN = 'https://ysnle.github.io';

function makeReq({ path, method, headers, body }) {
  return new Request(path || 'https://worker.example/anthropic', {
    method: method || 'POST',
    headers: new Headers(headers || {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function mockKV(initial) {
  const store = new Map(Object.entries(initial || {}));
  return { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } };
}

async function main() {
  check('missing ANTHROPIC_API_KEY -> 503', (await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: {} }), {})).status === 503);

  check('kill switch (ANTHROPIC_KILL_SWITCH=1) -> 503 even with a valid key',
    (await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: {} }), { ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_KILL_SWITCH: '1' })).status === 503);

  check('no Origin header at all (bare curl) -> 403, rejected before reaching upstream',
    (await worker.fetch(makeReq({ body: {} }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV() })).status === 403);

  check('wrong Origin -> 403',
    (await worker.fetch(makeReq({ headers: { Origin: 'https://evil.example.com' }, body: {} }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV() })).status === 403);

  check('AIO_APP_TOKEN configured but header missing -> 403',
    (await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: {} }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV(), AIO_APP_TOKEN: 'secret-123' })).status === 403);

  {
    const res = await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN, 'X-AIO-App-Token': 'secret-123' }, body: { model: 'claude-haiku-4-5', messages: [] } }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV(), AIO_APP_TOKEN: 'secret-123' });
    check('correct Origin + correct app token -> not rejected by any auth/quota gate', ![403, 429, 413, 503].includes(res.status), res.status);
  }
  {
    const res = await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: { model: 'claude-haiku-4-5', messages: [] } }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV() });
    check('AIO_APP_TOKEN unset on the Worker -> no header required (backward compatible with existing deploys)', ![403, 429, 413, 503].includes(res.status), res.status);
  }

  check('no KV bound at all -> fail-closed 503 (v52.47 policy change, not silently unlimited)',
    (await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: {} }), { ANTHROPIC_API_KEY: 'sk-test' })).status === 503);

  {
    const dayKey = 'claude:' + new Date().toISOString().slice(0, 10);
    const res = await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: {} }), { ANTHROPIC_API_KEY: 'sk-test', ANTHROPIC_DAILY_CAP: '5', AIO_QUOTA: mockKV({ [dayKey]: '5' }) });
    check('daily cap already at limit -> 429', res.status === 429);
  }

  {
    const bigText = 'x'.repeat(250 * 1024);
    const res = await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN }, body: { messages: [{ role: 'user', content: bigText }] } }), { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV() });
    check('oversized body (250KB > 200KB cap) -> 413', res.status === 413);
  }

  {
    const env = { ANTHROPIC_API_KEY: 'sk-test', AIO_QUOTA: mockKV() };
    let last;
    for (let i = 0; i < 21; i++) {
      last = await worker.fetch(makeReq({ headers: { Origin: GOOD_ORIGIN, 'cf-connecting-ip': '9.9.9.9-ci-check' }, body: {} }), env);
    }
    check('21st /anthropic request from the same IP within a minute -> 429 (dedicated stricter rate limit, separate from the 300/min data-proxy limit)', last.status === 429);
  }

  {
    const res = await worker.fetch(makeReq({ method: 'OPTIONS', headers: { Origin: GOOD_ORIGIN } }), { ANTHROPIC_API_KEY: 'sk-test', AIO_APP_TOKEN: 'x' });
    check('OPTIONS preflight -> 204, not blocked by any of the new gates', res.status === 204);
    check('CORS Access-Control-Allow-Headers includes the new X-AIO-App-Token header (otherwise browsers block the header before it reaches the Worker)', (res.headers.get('Access-Control-Allow-Headers') || '').includes('X-AIO-App-Token'));
  }

  if (errors.length) {
    console.error('Worker /anthropic security check failed:');
    errors.forEach((e) => console.error(' - ' + e));
    process.exit(1);
  }
  console.log('Worker /anthropic security check OK: kill-switch, server-side Origin enforcement, optional app-token, dedicated rate limit, KV fail-closed, and body-size cap all verified against the real handler.');
  // The mocked Worker requests can leave undici handles alive after the final
  // assertion. CI must terminate after the gate has emitted its result rather
  // than waiting indefinitely on provider-side resources.
  process.exit(0);
}

main();
