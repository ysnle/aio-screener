// v48.8/v48.9: daily call counters for the free provider tiers (localStorage aio_quota_{provider}, reset each UTC day);
// a warning at 80% and a skip notice at the limit. P1422: a local counter does not see another browser or application,
// so the shared atomic quota (window.AIO.tryAcquireAIQuota) answers first when it handles the provider. Moved
// unchanged from js/aio-chat.js (roadmap item 11, layer 1 채팅); window._bumpApiCounter/_isQuotaExceeded keep the names.
export const QUOTA_LIMITS = {
  fmp: { daily: 250, label: 'FMP 재무제표' },
  twelveData: { daily: 800, label: 'Twelve Data 지표' },
  alphaVantage: { daily: 25, label: 'Alpha Vantage breadth' },
  newsdata: { daily: 200, label: 'NewsData.io 뉴스' },
  rss2json: { daily: 10000, label: 'rss2json' }
};

const log = (root, level, msg) => { if (typeof root._aioLog === 'function') root._aioLog(level, 'fetch', msg); };

export function bumpApiCounter(providerKey, root = globalThis) {
  try {
    const lim = QUOTA_LIMITS[providerKey];
    if (!lim) return 0;
    if (root.AIO && typeof root.AIO.tryAcquireAIQuota === 'function') {
      const atomicQuota = root.AIO.tryAcquireAIQuota(providerKey, lim.daily);
      if (atomicQuota && atomicQuota.handled) {
        if (!atomicQuota.allowed) log(root, 'error', `${lim.label} 일일 한도 도달 또는 quota lock — ${providerKey} 호출 스킵`);
        return atomicQuota.count;
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const lsKey = `aio_quota_${providerKey}`;
    const raw = root.localStorage.getItem(lsKey);
    let q = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (q.date !== today) q = { date: today, count: 0 };
    q.count = (q.count || 0) + 1;
    root.localStorage.setItem(lsKey, JSON.stringify(q));
    const warnAt = Math.floor(lim.daily * 0.8);
    if (q.count === warnAt) log(root, 'warn', `${lim.label} 일일 한도(${lim.daily}) 80% 도달 — 남은 ${lim.daily - q.count}회`);
    if (q.count >= lim.daily) log(root, 'error', `${lim.label} 일일 한도 도달! ${providerKey} 호출 스킵 — 24h 후 리셋`);
    return q.count;
  } catch (_) { return 0; }
}

export function isQuotaExceeded(providerKey, root = globalThis) {
  try {
    const lim = QUOTA_LIMITS[providerKey];
    if (!lim) return false;
    const raw = root.localStorage.getItem(`aio_quota_${providerKey}`);
    if (!raw) return false;
    const q = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    return q.date === today && q.count >= lim.daily;
  } catch (_) { return false; }
}
