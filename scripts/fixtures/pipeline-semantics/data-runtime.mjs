// scripts/fixtures/pipeline-semantics/data-runtime.mjs — v59.45 pipeline review regressions (browser data runtime)
import assert from 'node:assert/strict';

async function scheduler(load) {
  const { installRefreshScheduler } = await load('src/app/refresh-scheduler.js');
  const win = { AIO: {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, setTimeout, clearTimeout };
  // The classic task table binds these by bare global name at install time; the cases replace cfg.fn afterwards.
  // Stubs are removed right after install so other areas in the same process never see a fake DOM.
  const stubs = { document: { addEventListener() {}, removeEventListener() {}, querySelector: () => null, getElementById: () => null, hidden: false } };
  for (const name of ['fetchBreadthData', 'fetchAllFredData', 'fetchSentimentHistory']) stubs[name] = async () => undefined;
  const added = Object.keys(stubs).filter((name) => !(name in globalThis));
  for (const name of added) globalThis[name] = stubs[name];
  try { installRefreshScheduler(win); } finally { for (const name of added) delete globalThis[name]; }
  return win;
}

export const cases = [
  { id: 'R2-01', name: 'an all-rejected allSettled refresh is a failure without a success time', run: async ({ load }) => {
      const win = await scheduler(load);
      const cfg = win.REFRESH_SCHEDULE.sentiment;
      cfg.fn = () => Promise.allSettled([Promise.reject(new Error('a')), Promise.reject(new Error('b'))]);
      const out = await win._runScheduledTask('sentiment', cfg, false, {});
      assert.equal(out.ok, false);
      assert.equal(cfg._status, 'failed');
      assert.ok(!cfg._lastSuccessfulAt, 'no success time is stamped');
  } },
  { id: 'R2-01', name: 'a half-rejected allSettled refresh reports 50% coverage', run: async ({ load }) => {
      const win = await scheduler(load);
      const cfg = win.REFRESH_SCHEDULE.sentiment;
      cfg.fn = () => Promise.allSettled([Promise.resolve(1), Promise.reject(new Error('b'))]);
      await win._runScheduledTask('sentiment', cfg, false, {});
      assert.equal(cfg._status, 'partial');
      assert.equal(cfg._coverage, 50);
  } },
  { id: 'R2-01', name: 'a task that returns null (unavailable or retired) stays missing', run: async ({ load }) => {
      const win = await scheduler(load);
      const cfg = win.REFRESH_SCHEDULE.fred;
      cfg.fn = async () => null;
      const out = await win._runScheduledTask('fred', cfg, false, {});
      assert.equal(out.ok, false);
      assert.equal(cfg._status, 'missing');
      assert.ok(!cfg._lastSuccessfulAt);
  } },
  { id: 'R2-02', name: 'a Telegram channel slug survives news normalization', run: async ({ load }) => {
      const { normalizeNews } = await load('src/data/normalize/news.js');
      const out = normalizeNews({ items: [{ title: 'x', link: 'https://t.me/fastdesk/1', _tgChannel: 'fastdesk' }, { title: 'y', link: 'https://example.com/a' }] });
      assert.equal(out.items[0]._tgChannel, 'fastdesk');
      assert.equal(out.items[1]._tgChannel, false);
  } },
  { id: 'R2-04', name: 'a comma-formatted consensus target parses as the full number', run: async ({ load }) => {
      const { installNaverUsCollector } = await load('src/data/providers/naver-us.js');
      const win = {};
      installNaverUsCollector(win);
      const json = (body) => Promise.resolve({ ok: true, json: async () => body });
      const had = 'fetchViaProxy' in globalThis;
      globalThis.fetchViaProxy = (url) => url.endsWith('/integration')
        ? json({ consensusInfo: { priceTargetMean: '1,105.20', priceTargetHigh: '1,300.00', priceTargetLow: '900', recommMean: '4.1' } })
        : json(null);
      try {
        const out = await win.fetchNaverUSData('COST', false);
        assert.equal(out.consensus.targetMean, 1105.2);
        assert.equal(out.consensus.targetHigh, 1300);
        assert.equal(out.consensus.targetLow, 900);
      } finally { if (!had) delete globalThis.fetchViaProxy; }
  } },
];
