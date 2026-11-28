// The browser side of the quote change basis (src/domain/market/session/quote-basis.js): it reads the history, its load
// time and the reconciled screener rows from the page, decides each live quote's change basis, and keeps one store of
// the quotes whose basis has not arrived. The store re-applies them through applyLiveQuotes when the history or the
// screener lands, unless a newer quote replaced them.
import { readNumber } from '../domain/shared/number.js';
import { KR_INDEX_HISTORY_FIELD, krIndexCloseRead, krVerifiedDayChange, verifyKrQuoteChange, verifyUsQuoteChange } from '../domain/market/session/quote-basis.js';

// js/aio-data.js parks a batch here while this module is not installed yet.
const PENDING = '_aioQuotePending';

function screenerChange(root, symbol) {
  let rows = [];
  try { rows = root._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const row = rows.find((item) => String(item?.sym || '').toUpperCase() === symbol);
  const pct = row ? readNumber(row.ret1d) : null;
  return pct == null ? null : { pct, sessionDate: row.factorSessionDate };
}

/** The page's inputs for the rule at `now`. */
export function quoteBasisContext(root, now = Date.now()) {
  return { history: root?._aioHistory || [], loadedAt: root?._aioHistoryMeta?.loadedAt ?? null, now,
    health: root?._aioKrPrevCloseHealth || null, screenerChange: (symbol) => screenerChange(root, symbol) };
}

/** A published snapshot quote's day change on the history close before its session, when that is a US index whose
 *  provider pair disagrees with it (a holiday before the session left Yahoo's previous close off the 11/25 VIX close);
 *  null keeps the published pair. */
export function publishedUsChangeOn(root, quote, now = Date.now()) {
  const us = verifyUsQuoteChange({ symbol: quote?.instrumentId, observedAt: quote?.observedAt, regularMarketPreviousClose: quote?.previousValue }, quote?.value, quote?.changePct, quoteBasisContext(root, now));
  return us?.status === 'corrected' ? { pct: us.pct, previousClose: us.prevClose, basis: us.basis } : null;
}
export const verifyKrQuoteOn = (root, q, price, pct, now) => verifyKrQuoteChange(q, price, pct, quoteBasisContext(root, now));
export const krDayChangeOn = (root, now) => (symbol, session, close) => krVerifiedDayChange(symbol, session, close, quoteBasisContext(root, now));
export const krIndexCloseOn = (root, field, now = Date.now()) => krIndexCloseRead(field, root?._aioHistory, { loadedAt: root?._aioHistoryMeta?.loadedAt ?? null, now });

/** The KRX indices of a batch decide whether the provider's KR previous close can be trusted for stocks whose session
 *  the screener has not closed yet: all must agree in one session, and any correction marks it as disagreeing. */
function krHealth(checks, prior, at) {
  if (!checks.length) return prior;
  const session = checks[0].session;
  const allAgree = checks.every((check) => check.session && check.session === session && check.status === 'agree');
  if (!allAgree && !checks.some((check) => check.status === 'corrected')) return prior;
  return { session, status: allAgree ? 'agree' : 'disagree', basisDate: checks[0].basisDate, checkedAt: new Date(at).toISOString() };
}

export function installQuoteBasis(root, { now = () => Date.now() } = {}) {
  const warned = new Set();
  const pending = () => (root[PENDING] ||= {});
  const warnOnce = (symbol, basisDate, providerPrev, text) => {
    const key = `${symbol}|${basisDate}|${providerPrev}`;
    if (warned.has(key)) return;
    warned.add(key);
    root._aioLog?.('warn', 'data', text);
  };

  /** One batch: returns (q, price, providerPct, held) → { quote, pct, kr }, where `held` is the published close the quote
   *  may not replace (PriceStore.heldCloseQuote) and `kr` is the Korean check when the quote is Korean. */
  function batch(quotes, revision, at = now()) {
    const ctx = quoteBasisContext(root, at);
    const indexChecks = (quotes || []).filter((q) => KR_INDEX_HISTORY_FIELD[q?.symbol])
      .map((q) => verifyKrQuoteChange(q, q.regularMarketPrice, q.regularMarketChangePercent, ctx)).filter(Boolean);
    root._aioKrPrevCloseHealth = ctx.health = krHealth(indexChecks, ctx.health, at);
    const checks = (root._aioKrQuoteChecks ||= {});
    return (q, price, providerPct, held) => {
      const kr = verifyKrQuoteChange(q, price, providerPct, ctx);
      if (kr) {
        checks[q.symbol] = { checkedAt: new Date(at).toISOString(), ...kr };
        if (kr.status === 'unverified') pending()[q.symbol] = { quote: q, revision };
        else delete pending()[q.symbol];
        if (kr.status === 'corrected') warnOnce(q.symbol, kr.basisDate, kr.providerPrev, `${q.symbol} 전일종가 불일치 — 제공처 ${kr.providerPrev} 대신 검증 기준(${kr.basisDate})으로 등락률 재계산`);
        return { quote: q, pct: kr.pct, kr };
      }
      if (held) return { quote: held.quote, pct: held.pct, kr: null };
      const us = verifyUsQuoteChange(q, price, providerPct, ctx);
      if (!us) {
        // A US index checked before the history arrived is checked again when it does.
        if (!ctx.history.length && /^\^/.test(q.symbol)) pending()[q.symbol] = { quote: q, revision };
        return { quote: q, pct: providerPct, kr: null };
      }
      delete pending()[q.symbol];
      if (us.status === 'agree') return { quote: q, pct: us.pct, kr: null };
      warnOnce(q.symbol, us.basisDate, us.providerPrev, `${q.symbol} 전일종가 불일치 — 제공처 ${us.providerPrev} 대신 ${us.basisDate} 종가 ${us.prevClose}로 등락률 재계산`);
      return { pct: us.pct, kr: null, quote: { ...q, regularMarketPreviousClose: us.prevClose, chartPreviousClose: us.prevClose,
        regularMarketChange: price - us.prevClose, regularMarketChangePercent: us.pct, changeBasis: us.basis } };
    };
  }

  // A parked quote is re-applied unless a newer quote of that symbol has been applied since (revision null: parked
  // before this module was installed, so nothing was applied).
  function reverify() {
    const store = pending();
    const redo = Object.keys(store).map((symbol) => store[symbol])
      .filter((entry) => entry && (entry.revision == null || root._liveData?.[entry.quote.symbol]?.revision === entry.revision))
      .map((entry) => entry.quote);
    root[PENDING] = {};
    if (redo.length) root.applyLiveQuotes?.(redo);
    // The published snapshot is read on the close history too (publishedUsChangeOn), once the history is here.
    if (root._aioHistory?.length > 0) root._aioReapplyBridgedSnapshot?.();
  }

  root.AIO = root.AIO || {};
  root.AIO.quoteBasis = { batch, published: (quote) => publishedUsChangeOn(root, quote, now()), verifyKr: (q, price, pct) => verifyKrQuoteOn(root, q, price, pct, now()) };
  root.addEventListener?.('aio:historyLoaded', reverify);
  root.document?.addEventListener?.('aio:nativeScreenerReady', reverify);
  reverify();
  return root.AIO.quoteBasis;
}
