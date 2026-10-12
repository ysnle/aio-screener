// P1624: one route-owned, identity-checked public chart response supplies quote and history.
import { canonicalEpochMs } from '../chart/contract.js';

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const positive = value => finite(value) > 0 ? value : null;
const caches = new WeakMap();
const symbolOf = value => String(value || '').trim().toUpperCase();
const dateAt = (ms, zone) => new Date(ms).toLocaleDateString('en-CA', { timeZone: zone });

export function normalizeSummaryChart(payload, symbol, { nowMs = Date.now() } = {}) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const id = symbolOf(symbol);
  if (!id || symbolOf(meta?.symbol) !== id || payload?.chart?.error) return null;
  const points = result.indicators?.quote?.[0] || {};
  const zone = meta.exchangeTimezoneName || (/\.(KS|KQ)$/.test(id) ? 'Asia/Seoul' : 'America/New_York');
  let today;
  try { today = dateAt(nowMs, zone); } catch (_) { return null; }
  const regularEnd = canonicalEpochMs(meta.currentTradingPeriod?.regular?.end);
  const closesToday = regularEnd != null && regularEnd + 20 * 60 * 1000 <= nowMs && dateAt(regularEnd, zone) === today;
  const byDate = new Map();
  (Array.isArray(result.timestamp) ? result.timestamp : []).forEach((stamp, index) => {
    const epochMs = canonicalEpochMs(stamp);
    const close = positive(points.close?.[index]);
    if (epochMs == null || epochMs > nowMs || close == null) return;
    const date = dateAt(epochMs, zone);
    // Daily bars are timestamped at their opening. Today's unfinished bar is not a completed close.
    if (date === today && !closesToday) return;
    byDate.set(date, { time: date, date, epochMs, open: positive(points.open?.[index]),
      high: positive(points.high?.[index]), low: positive(points.low?.[index]), close,
      volume: finite(points.volume?.[index]), source: 'Yahoo Finance daily chart', provisional: false });
  });
  const history = [...byDate.values()].sort((a, b) => a.epochMs - b.epochMs);
  const quoteMs = canonicalEpochMs(meta.regularMarketTime);
  const regularPrice = positive(meta.regularMarketPrice);
  const validQuote = regularPrice != null && quoteMs != null && quoteMs <= nowMs;
  const last = history.at(-1);
  const price = validQuote ? regularPrice : last?.close ?? null;
  const quoteDate = validQuote ? dateAt(quoteMs, zone) : null;
  const previousClose = validQuote ? positive(meta.regularMarketPreviousClose) ?? history.findLast(bar => bar.date < quoteDate)?.close ?? null
    : history.at(-2)?.close ?? null;
  const observedAt = validQuote ? new Date(quoteMs).toISOString() : last?.date ?? null;
  const valueBasis = validQuote ? 'regular-market-observation' : 'completed-daily-close';
  if (price == null && history.length < 2) return null;
  const quote = price == null ? null : { price, pct: previousClose > 0 ? (price / previousClose - 1) * 100 : null,
    previousClose, regularMarketPreviousClose: previousClose, currency: typeof meta.currency === 'string' ? meta.currency : null,
    observedAt, fetchedAt: new Date(nowMs).toISOString(), source: 'public:yahoo-chart', sourceKind: 'T3_PUBLIC_DELAYED',
    allowedUse: 'reference', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', quality: { status: 'REFERENCE', decisionUse: false },
    changeBasis: previousClose == null ? 'unknown' : 'previous-regular-close', valueBasis,
    revisionId: `${id}:${observedAt}:${price}` };
  return { symbol: id, name: meta.longName || meta.shortName || id, currency: meta.currency || null,
    exchange: meta.exchangeName || null, instrumentType: meta.instrumentType || null,
    previousClose, high52: positive(meta.fiftyTwoWeekHigh), low52: positive(meta.fiftyTwoWeekLow),
    quote, history, sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(id)}/history/` };
}

export function createSummaryHydrator({ root = globalThis, now = () => Date.now(), onReady = () => {}, onStatus = () => {} } = {}) {
  if (!caches.has(root)) caches.set(root, new Map());
  const cache = caches.get(root);
  let current = '';
  let controller = null;
  let disposed = false;
  let revision = 0;
  const apply = data => {
    root._aioEntitySummaries ||= {};
    root._aioEntitySummaries[data.symbol] = data;
    root._tickerHistory ||= {};
    root._tickerHistory[data.symbol] = data.history;
    if (data.quote) {
      root._liveData ||= {};
      const existing = root._liveData[data.symbol];
      const oldAt = canonicalEpochMs(existing?.quoteEnvelope?.observedAt ?? existing?.observedAt);
      const nextAt = canonicalEpochMs(data.quote.observedAt);
      if (!existing || positive(existing.price) == null || oldAt == null || nextAt >= oldAt) {
        root._liveData[data.symbol] = { ...existing, ...data.quote, quoteEnvelope: { ...data.quote } };
      }
    }
    onReady(data);
  };
  return {
    ensure(symbol) {
      const id = symbolOf(symbol);
      const saved = cache.get(id);
      const fresh = saved && now() - saved.at < (saved.data ? 300000 : 30000);
      if (disposed || (id === current && (controller || fresh))) return;
      current = id;
      const token = ++revision;
      controller?.abort();
      controller = null;
      if (!id || !/^[A-Z0-9.^=\-]{1,24}$/.test(id)) return;
      if (fresh) {
        if (saved.data) { apply(saved.data); onStatus('ready', id); }
        else onStatus('unavailable', id);
        return;
      }
      controller = new AbortController();
      const signal = controller.signal;
      onStatus('loading', id);
      // Reuse the established public transport/provider; its optional signal owns physical cancellation.
      Promise.resolve().then(() => typeof root._aioFetchYahooChartData === 'function'
        ? root._aioFetchYahooChartData(id, '1y', '1d', { signal }) : null)
        .then(response => {
          if (disposed || signal.aborted || token !== revision) return;
          controller = null;
          const payload = response ? { chart: { result: [{ meta: response.meta,
            timestamp: response.timestamps, indicators: { quote: [{ close: response.closes,
              open: response.opens, high: response.highs, low: response.lows, volume: response.volumes }] } }] } } : null;
          const data = normalizeSummaryChart(payload, id, { nowMs: now() });
          cache.delete(id);
          cache.set(id, { at: now(), data });
          while (cache.size > 20) cache.delete(cache.keys().next().value);
          if (data) apply(data);
          onStatus(data ? 'ready' : 'unavailable', id);
        }).catch(() => {
          if (disposed || signal.aborted || token !== revision) return;
          controller = null;
          cache.set(id, { at: now(), data: null });
          while (cache.size > 20) cache.delete(cache.keys().next().value);
          onStatus('unavailable', id);
        });
    },
    dispose() { disposed = true; revision++; controller?.abort(); }
  };
}
