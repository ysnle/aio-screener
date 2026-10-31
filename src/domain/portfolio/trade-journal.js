// v58.52 (owner 2026-10-20): the trade journal. The reader records each buy and sell with the reason it was made; this
// module turns that record into realised results (FIFO lots per symbol and currency), the reader's own statistics, and
// factual mirrors against the rules the reader declared. It never tells the reader what to buy or sell (AGENTS: no
// personal trade instructions) — every line is a measurement of the reader's own record or a gap against the reader's
// own rule, with the sample size beside it.
import { readNumber as finite } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';

export const TRADE_JOURNAL_VERSION = 1;
export const TRADE_REASONS = Object.freeze({
  trend: '추세 추종', breakout: '돌파', pullback: '눌림 매수', value: '가치·저평가', earnings: '실적·이벤트',
  theme: '테마·뉴스', rebalance: '비중 조절', stop: '손절', target: '목표가 도달', other: '기타'
});
export const TRADE_MOODS = Object.freeze({ plan: '계획대로', fomo: '놓칠까 봐', fear: '불안·공포', revenge: '만회하려고', bored: '습관·지루함' });
// Fewer closed trades than this and a rate is shown as a count, not as a tendency.
export const MIN_SAMPLE = 10;
const DAY_MS = 86400000;

// v59.45 (PASS27 P27-IMPORT-01 class): Date.parse rolls 2026-02-30 over to 3/2, so the shape check alone kept a day that
// does not exist. A calendar date is a YYYY-MM-DD string that survives the round trip; the ledger and the account
// performance check use the same helper.
export function calendarDate(value) {
  const text = String(value == null ? '' : value).trim();
  if (!isIsoDay(text)) return null;
  const ms = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === text ? text : null;
}
const isoDate = calendarDate;
const symbolOf = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, '');
const SUPPORTED_CURRENCY = /^(USD|KRW|JPY|EUR|GBP|HKD|TWD|CNY)$/;
const currencyOf = (symbol, value) => (SUPPORTED_CURRENCY.test(String(value || '').trim().toUpperCase()) ? String(value).trim().toUpperCase() : /\.(KS|KQ)$/.test(symbol) || /^\d{6}$/.test(symbol) ? 'KRW' : 'USD');

/** One trade as entered → a stored trade, or { error } naming the first invalid field. */
export function normalizeTrade(input = {}, { idOf = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` } = {}) {
  const symbol = symbolOf(input.symbol);
  const date = isoDate(input.date);
  const side = input.side === 'sell' ? 'sell' : input.side === 'buy' ? 'buy' : null;
  const qty = finite(input.qty);
  const price = finite(input.price);
  // v59.45 (PASS22): an empty fee is 0, but a fee that was written and cannot be read is an error, not a free trade; a
  // written currency outside the supported codes is an error, not USD.
  const feeGiven = input.fee != null && String(input.fee).trim() !== '';
  const fee = feeGiven ? finite(input.fee) : 0;
  const currencyGiven = input.currency != null && String(input.currency).trim() !== '';
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) return { error: 'symbol' };
  if (!date) return { error: 'date' };
  if (!side) return { error: 'side' };
  if (!(qty > 0)) return { error: 'qty' };
  if (!(price > 0)) return { error: 'price' };
  if (fee == null || fee < 0) return { error: 'fee' };
  if (currencyGiven && !SUPPORTED_CURRENCY.test(String(input.currency).trim().toUpperCase())) return { error: 'currency' };
  const stop = finite(input.stop);
  const target = finite(input.target);
  return {
    id: String(input.id || idOf()), date, symbol, side, qty, price, fee, currency: currencyOf(symbol, input.currency),
    reason: Object.hasOwn(TRADE_REASONS, input.reason) ? input.reason : 'other',
    mood: Object.hasOwn(TRADE_MOODS, input.mood) ? input.mood : null,
    stop: stop > 0 ? stop : null, target: target > 0 ? target : null,
    note: String(input.note || '').slice(0, 500)
  };
}

/** Stored value (any shape) → { version, trades, rules }; invalid trades are dropped, never repaired. */
export function normalizeJournal(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const trades = (Array.isArray(value.trades) ? value.trades : []).map((trade) => normalizeTrade(trade, { idOf: () => `t${Math.random().toString(36).slice(2, 10)}` })).filter((trade) => !trade.error);
  return { version: TRADE_JOURNAL_VERSION, trades: trades.sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1)), rules: normalizeRules(value.rules) };
}

/** The reader's own rules. Each is optional; an empty rule checks nothing. */
export function normalizeRules(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const pct = (field, max) => { const n = finite(value[field]); return n != null && n > 0 && n <= max ? n : null; };
  const count = finite(value.maxPositions);
  return { maxPositionPct: pct('maxPositionPct', 100), minCashPct: pct('minCashPct', 100), stopLossPct: pct('stopLossPct', 90), maxPositions: count != null && count >= 1 && count <= 200 ? Math.round(count) : null };
}

/** FIFO matching per symbol and currency → closed lots and what is still open. A sell larger than the open quantity is
 * matched as far as it goes and the rest is reported as unmatched (a buy recorded before the journal started). */
export function realizeTrades(trades = []) {
  const queues = new Map();
  const closed = [];
  const unmatched = [];
  for (const trade of [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.side === b.side ? 0 : a.side === 'buy' ? -1 : 1))) {
    const key = `${trade.symbol}|${trade.currency}`;
    if (!queues.has(key)) queues.set(key, []);
    const queue = queues.get(key);
    if (trade.side === 'buy') { queue.push({ ...trade, left: trade.qty }); continue; }
    let left = trade.qty;
    while (left > 1e-12 && queue.length) {
      const lot = queue[0];
      const qty = Math.min(left, lot.left);
      const buyFee = lot.fee * (qty / lot.qty);
      const sellFee = trade.fee * (qty / trade.qty);
      const cost = lot.price * qty + buyFee;
      const proceeds = trade.price * qty - sellFee;
      const holdDays = Math.max(0, Math.round((Date.parse(`${trade.date}T00:00:00Z`) - Date.parse(`${lot.date}T00:00:00Z`)) / DAY_MS));
      closed.push({ symbol: trade.symbol, currency: trade.currency, qty, openDate: lot.date, closeDate: trade.date, buyPrice: lot.price, sellPrice: trade.price,
        pnl: proceeds - cost, pnlPct: (proceeds / cost - 1) * 100, holdDays, entryReason: lot.reason, exitReason: trade.reason, entryMood: lot.mood, stop: lot.stop, target: lot.target, buyId: lot.id, sellId: trade.id });
      lot.left -= qty;
      left -= qty;
      if (lot.left <= 1e-12) queue.shift();
    }
    if (left > 1e-12) unmatched.push({ ...trade, qty: left });
  }
  const open = [...queues.values()].flat().filter((lot) => lot.left > 1e-12).map((lot) => ({ ...lot, qty: lot.left }));
  return { closed, open, unmatched };
}

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
const median = (values) => { if (!values.length) return null; const s = [...values].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Statistics of closed lots: rates in %, money per currency (never summed across currencies). */
export function journalStats(closed = []) {
  const wins = closed.filter((row) => row.pnl > 0);
  const losses = closed.filter((row) => row.pnl <= 0);
  const avgWin = mean(wins.map((row) => row.pnlPct));
  const avgLoss = mean(losses.map((row) => row.pnlPct));
  const pnlByCurrency = {};
  for (const row of closed) pnlByCurrency[row.currency] = (pnlByCurrency[row.currency] || 0) + row.pnl;
  const byReason = Object.entries(closed.reduce((map, row) => { (map[row.entryReason] ||= []).push(row); return map; }, {}))
    .map(([reason, rows]) => ({ reason, label: TRADE_REASONS[reason] || reason, n: rows.length, wins: rows.filter((row) => row.pnl > 0).length, avgPct: mean(rows.map((row) => row.pnlPct)) }))
    .sort((a, b) => b.n - a.n);
  const byMood = Object.entries(closed.filter((row) => row.entryMood).reduce((map, row) => { (map[row.entryMood] ||= []).push(row); return map; }, {}))
    .map(([mood, rows]) => ({ mood, label: TRADE_MOODS[mood] || mood, n: rows.length, wins: rows.filter((row) => row.pnl > 0).length, avgPct: mean(rows.map((row) => row.pnlPct)) }));
  // v58.75 (persona review, spec F6): stop adherence on the reader's own record — of the closed lots bought with a stop price,
  // how many were sold at or above that stop (a sale below it went past the plan; a gap or slippage also counts as below).
  const withStop = closed.filter((row) => Number.isFinite(row.stop) && row.stop > 0);
  const stopKept = { n: withStop.length, kept: withStop.filter((row) => row.sellPrice >= row.stop).length };
  return {
    stopKept,
    n: closed.length, wins: wins.length, losses: losses.length,
    winRate: closed.length ? wins.length / closed.length * 100 : null,
    avgWinPct: avgWin, avgLossPct: avgLoss,
    payoff: avgWin != null && avgLoss != null && avgLoss < 0 ? avgWin / Math.abs(avgLoss) : null,
    expectancyPct: mean(closed.map((row) => row.pnlPct)),
    holdWinDays: median(wins.map((row) => row.holdDays)), holdLossDays: median(losses.map((row) => row.holdDays)),
    worst: closed.reduce((low, row) => (!low || row.pnlPct < low.pnlPct ? row : low), null),
    best: closed.reduce((high, row) => (!high || row.pnlPct > high.pnlPct ? row : high), null),
    pnlByCurrency, byReason, byMood
  };
}

/** Observations about the reader's own record. Each names its evidence; below MIN_SAMPLE it says the sample is small. */
export function journalReview(closed = [], rules = {}) {
  const stats = journalStats(closed);
  const notes = [];
  const small = stats.n < MIN_SAMPLE;
  const r = normalizeRules(rules);
  const fmt = (value, digits = 1) => (value == null ? '—' : value.toFixed(digits));
  if (!stats.n) return { stats, notes, small: true };
  if (stats.holdWinDays != null && stats.holdLossDays != null && stats.holdLossDays >= Math.max(5, stats.holdWinDays * 1.5)) {
    notes.push({ id: 'hold-losers', tone: 'burden', text: `손실 거래의 보유 기간 중앙값(${stats.holdLossDays}일)이 이익 거래(${stats.holdWinDays}일)의 ${fmt(stats.holdLossDays / Math.max(1, stats.holdWinDays))}배입니다 — 이익은 빨리 확정하고 손실은 오래 들고 가는 기록입니다.` });
  }
  if (stats.payoff != null && stats.payoff < 1) {
    notes.push({ id: 'payoff', tone: 'burden', text: `평균 이익 ${fmt(stats.avgWinPct)}%, 평균 손실 ${fmt(stats.avgLossPct)}%로 손익비가 ${fmt(stats.payoff, 2)}입니다. 이 손익비에서 본전이 되려면 승률이 ${fmt(100 / (1 + stats.payoff), 0)}% 이상이어야 하는데, 기록된 승률은 ${fmt(stats.winRate, 0)}%입니다.` });
  } else if (stats.payoff != null) {
    notes.push({ id: 'payoff', tone: 'neutral', text: `평균 이익 ${fmt(stats.avgWinPct)}%, 평균 손실 ${fmt(stats.avgLossPct)}% (손익비 ${fmt(stats.payoff, 2)}), 승률 ${fmt(stats.winRate, 0)}% — 본전 승률은 ${fmt(100 / (1 + stats.payoff), 0)}%입니다.` });
  }
  if (r.stopLossPct != null) {
    const beyond = closed.filter((row) => row.pnlPct <= -r.stopLossPct * 1.2);
    if (beyond.length) notes.push({ id: 'stop-breach', tone: 'burden', text: `내 손절 원칙(-${fmt(r.stopLossPct, 0)}%)보다 20% 이상 깊게 끝난 거래가 ${beyond.length}건입니다(가장 깊은 ${beyond.reduce((a, b) => (a.pnlPct < b.pnlPct ? a : b)).symbol} ${fmt(Math.min(...beyond.map((row) => row.pnlPct)))}%).` });
  }
  const withoutStop = closed.filter((row) => row.stop == null).length;
  if (withoutStop / stats.n >= 0.5) notes.push({ id: 'no-plan', tone: 'neutral', text: `끝난 거래 ${stats.n}건 중 ${withoutStop}건은 매수할 때 손절 가격을 적지 않았습니다 — 들어갈 때 나올 가격을 함께 적으면 나중에 계획과 실제를 비교할 수 있습니다.` });
  const fomo = stats.byMood.find((row) => row.mood === 'fomo' || row.mood === 'revenge');
  const planned = stats.byMood.find((row) => row.mood === 'plan');
  if (fomo && planned && fomo.n >= 3 && planned.n >= 3 && fomo.avgPct < planned.avgPct) {
    notes.push({ id: 'mood', tone: 'burden', text: `'${fomo.label}' 매수 ${fomo.n}건의 평균 결과 ${fmt(fomo.avgPct)}%, '계획대로' ${planned.n}건은 ${fmt(planned.avgPct)}%입니다.` });
  }
  const strong = stats.byReason.filter((row) => row.n >= 3);
  if (strong.length >= 2) {
    const best = strong.reduce((a, b) => (a.avgPct > b.avgPct ? a : b));
    const worst = strong.reduce((a, b) => (a.avgPct < b.avgPct ? a : b));
    if (best.reason !== worst.reason) notes.push({ id: 'reason', tone: 'neutral', text: `매수 이유별로는 '${best.label}'(${best.n}건, 평균 ${fmt(best.avgPct)}%)가 가장 좋았고 '${worst.label}'(${worst.n}건, 평균 ${fmt(worst.avgPct)}%)가 가장 나빴습니다.` });
  }
  if (small) notes.push({ id: 'sample', tone: 'neutral', text: `끝난 거래가 ${stats.n}건이라 위 비율은 경향이 아니라 지금까지의 기록입니다(${MIN_SAMPLE}건 이상부터 경향으로 읽습니다).` });
  return { stats, notes, small };
}

/** The reader's rules against the current book (weights in % of total assets incl. cash). Factual gaps only. */
export function rulesMirror(rules = {}, { weights = [], cashPct = null, losses = [], holdingCount = null } = {}) {
  const r = normalizeRules(rules);
  const rows = [];
  if (r.maxPositionPct != null) {
    const over = weights.filter((row) => row.pct > r.maxPositionPct);
    rows.push({ id: 'max-position', label: `한 종목 최대 ${r.maxPositionPct}%`, ok: weights.length ? over.length === 0 : null,
      text: !weights.length ? '평가액이 있는 보유 종목이 없습니다' : over.length ? `넘은 종목 ${over.map((row) => `${row.symbol} ${row.pct.toFixed(1)}%`).join(', ')}` : `가장 큰 종목 ${weights.reduce((a, b) => (a.pct > b.pct ? a : b)).symbol} ${Math.max(...weights.map((row) => row.pct)).toFixed(1)}%` });
  }
  if (r.minCashPct != null) rows.push({ id: 'min-cash', label: `현금 최소 ${r.minCashPct}%`, ok: cashPct == null ? null : cashPct >= r.minCashPct, text: cashPct == null ? '현금이 입력되지 않았습니다' : `지금 현금 ${cashPct.toFixed(1)}%` });
  if (r.maxPositions != null) { const count = holdingCount ?? weights.length; rows.push({ id: 'max-positions', label: `보유 종목 최대 ${r.maxPositions}개`, ok: count <= r.maxPositions, text: `지금 ${count}개` }); }
  if (r.stopLossPct != null) {
    const deep = losses.filter((row) => row.pnlPct <= -r.stopLossPct);
    rows.push({ id: 'stop-loss', label: `손절 -${r.stopLossPct}%`, ok: losses.length ? deep.length === 0 : null,
      text: !losses.length ? '평가 손익이 있는 보유 종목이 없습니다' : deep.length ? `원칙보다 깊은 평가 손실 ${deep.map((row) => `${row.symbol} ${row.pnlPct.toFixed(1)}%`).join(', ')}` : '원칙보다 깊은 평가 손실 없음' });
  }
  return rows;
}
