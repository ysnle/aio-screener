// How large a market fall is against long history. public-data/history.json starts 2025-09-30, so a screen could
// not truthfully say "the largest weekly fall since March 2020" or set a drawdown beside 2020 and 2022. The weekly producer
// (scripts/build-index-longrun.mjs) runs the derivation below over decades of daily closes and publishes the small derived
// tables (public-data/index-longrun.json); a screen joins them with the live window's recent closes through
// readIndexLongrun(). Pure: no fetch, no clock — every date comes in with the closes.
//
// Definitions (all on closing prices, price index, no dividends):
//   drawdown episode — from a running closing high, the lowest close before the high is regained; kept when that trough is
//                      at least `drawdownMinPct` below the high. `regained` is the first close at or above the high (null
//                      while it is not regained). `sessions` counts sessions from the high to the trough.
//   n-session move   — close[t] / close[t - n] - 1, for every session t (overlapping windows; `observations` counts them).
//   tail events      — the moves at least as extreme as the `tailShare` quantile of all windows (worst 2% falls, best 2%
//                      rises), declustered: the most extreme window is kept and every window sharing a session-to-session
//                      return with it is dropped, so one crash week is one event, dated by its last session.
import { isFiniteNumber } from '../../shared/number.js';
import { isIsoDay } from '../../shared/session-date.js';

export const INDEX_LONGRUN_SCHEMA = 'index-longrun.v1';
export const LONGRUN_DEFINITION = Object.freeze({
  drawdownMinPct: 10,
  horizons: Object.freeze([1, 5, 20]),
  tailShare: 0.02,
  // Closes kept up to `through`, so a reader can form a 20-session move across the boundary with live closes.
  recentSessions: 21,
});

const pct = (ratio) => {
  const value = Math.round(ratio * 10000) / 100;
  return Object.is(value, -0) ? 0 : value;
};

/** [[date, close]] or [{ date, close }] → [{ date, close }] ascending by date, one row per date (the last wins). */
export function normalizeCloses(series) {
  const byDate = new Map();
  for (const row of Array.isArray(series) ? series : []) {
    const date = Array.isArray(row) ? row[0] : row?.date;
    const close = Array.isArray(row) ? row[1] : row?.close;
    if (!isIsoDay(date) || !isFiniteNumber(close) || close <= 0) continue;
    byDate.set(date, close);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, close: byDate.get(date) }));
}

/** Every peak-to-trough fall of at least `minPct` from a running closing high, oldest first. */
export function drawdownEpisodes(closes, { minPct = LONGRUN_DEFINITION.drawdownMinPct } = {}) {
  const rows = normalizeCloses(closes);
  const episodes = [];
  if (!rows.length) return episodes;
  let peakIdx = 0;
  let troughIdx = -1;
  const close = (regained) => {
    if (troughIdx < 0) return;
    const ratio = rows[troughIdx].close / rows[peakIdx].close - 1;
    if (ratio * 100 <= -minPct) {
      episodes.push({ peak: rows[peakIdx].date, trough: rows[troughIdx].date, depth: pct(ratio), sessions: troughIdx - peakIdx, regained });
    }
  };
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].close >= rows[peakIdx].close) {
      close(rows[i].date);
      peakIdx = i;
      troughIdx = -1;
    } else if (troughIdx < 0 || rows[i].close < rows[troughIdx].close) {
      troughIdx = i;
    }
  }
  close(null);
  return episodes;
}

/** The running closing high at the last close, and the lowest close since it. */
export function drawdownState(closes) {
  const rows = normalizeCloses(closes);
  if (!rows.length) return null;
  let high = rows[0];
  let trough = rows[0];
  for (const row of rows) {
    if (row.close >= high.close) { high = row; trough = row; } else if (row.close < trough.close) trough = row;
  }
  const last = rows.at(-1);
  return { high: { date: high.date, close: high.close }, trough: { date: trough.date, close: trough.close }, last: { date: last.date, close: last.close },
    depth: pct(last.close / high.close - 1), troughDepth: pct(trough.close / high.close - 1) };
}

/** Every n-session move: { i, date, from, ratio }, i the index of the window's last session. */
export function sessionMoves(closes, horizon) {
  const rows = normalizeCloses(closes);
  const out = [];
  for (let i = horizon; i < rows.length; i += 1) out.push({ i, date: rows[i].date, from: rows[i - horizon].date, ratio: rows[i].close / rows[i - horizon].close - 1 });
  return out;
}

const moreExtreme = (side) => (side === 'fall' ? (a, b) => a.ratio - b.ratio : (a, b) => b.ratio - a.ratio);
const atLeast = (side, value, cut) => (side === 'fall' ? value <= cut : value >= cut);

/**
 * Most extreme first; drops every window that shares a session-to-session return with a kept one (|i - j| < horizon).
 * Ties keep the earlier one.
 */
export function declusterMoves(moves, horizon, side) {
  const order = moves.slice().sort((a, b) => moreExtreme(side)(a, b) || a.date.localeCompare(b.date));
  const blocked = new Set();
  const kept = [];
  for (const move of order) {
    if (blocked.has(move.i)) continue;
    kept.push(move);
    for (let j = move.i - horizon + 1; j <= move.i + horizon - 1; j += 1) blocked.add(j);
  }
  return kept;
}

/**
 * One horizon's table: { observations, cutFall, cutRise, falls: [[date, pct]], rises: [[date, pct]] }, rows most extreme
 * first. Rows are [date, pct] pairs: the one-session tails alone hold ~2,200 rows, which as objects made the file 129 KB.
 */
export function moveTable(closes, horizon, { tailShare = LONGRUN_DEFINITION.tailShare } = {}) {
  const moves = sessionMoves(closes, horizon);
  const n = moves.length;
  if (!n) return { observations: 0, cutFall: null, cutRise: null, falls: [], rises: [] };
  const k = Math.max(1, Math.ceil(n * tailShare));
  const table = { observations: n };
  for (const side of ['fall', 'rise']) {
    const sorted = moves.slice().sort(moreExtreme(side));
    const cut = sorted[k - 1].ratio;
    const tail = moves.filter((move) => atLeast(side, move.ratio, cut));
    table[side === 'fall' ? 'cutFall' : 'cutRise'] = pct(cut);
    table[side === 'fall' ? 'falls' : 'rises'] = declusterMoves(tail, horizon, side).map((move) => [move.date, pct(move.ratio)]);
  }
  return table;
}

/** The published body for one index (everything but its symbol). */
export function summarizeIndexHistory(closes, definition = LONGRUN_DEFINITION) {
  const rows = normalizeCloses(closes);
  if (rows.length <= Math.max(...definition.horizons)) return null;
  const state = drawdownState(rows);
  return {
    from: rows[0].date,
    through: rows.at(-1).date,
    sessions: rows.length,
    high: state.high,
    drawdown: { depth: state.depth, trough: state.trough, troughDepth: state.troughDepth },
    recent: rows.slice(-definition.recentSessions).map((row) => [row.date, row.close]),
    drawdowns: drawdownEpisodes(rows, { minPct: definition.drawdownMinPct }),
    moves: Object.fromEntries(definition.horizons.map((horizon) => [String(horizon), moveTable(rows, horizon, { tailShare: definition.tailShare })])),
  };
}

/**
 * Reader for screens and AI: the long-run standing of the current move and drawdown of one index.
 *
 * @param {object} artifact public-data/index-longrun.json
 * @param {object} options
 * @param {string} options.index 'spx' | 'ndx' | 'sox' | 'kospi' (history.json field names)
 * @param {number} options.horizon 1 | 5 | 20 sessions
 * @param {Array<[string, number]|{date: string, close: number}>} [options.recent] completed closes of the live window
 *        (history.json); only sessions after the artifact's `through` are used, so a longer series is fine.
 * @returns {null | {
 *   index: string, horizon: number, from: string, through: string, liveThrough: string,
 *   move: null | {
 *     date: string,          // last session of the current window
 *     from: string,          // the session the window starts from (its close is the base)
 *     pct: number,           // the current n-session move, % (2 dp)
 *     side: 'fall' | 'rise',
 *     inTail: boolean,       // at least as extreme as the long-run tail cut; rank and since are null when false
 *     cut: number,           // the tail cut for this side, % (worst/best `tailShare` of all windows)
 *     rank: number | null,   // 1 = the largest such move since `from` among separate (declustered) events, the current included
 *     events: number | null, // separate tail events on record before the current window
 *     observations: number,  // all n-session windows on record (the base for a share)
 *     since: null | { date: string, pct: number },  // the most recent earlier event at least as large; null with rank 1
 *   },
 *   drawdown: null | {
 *     high: { date: string, close: number },     // running closing high
 *     date: string, close: number,                // the last close
 *     depth: number,                              // % below the high now (0 at a new high)
 *     trough: { date: string, close: number, depth: number }, // lowest close since the high
 *     sessions: number | null, // sessions from the high to that trough (null when the window cannot count them)
 *     inRange: boolean,      // depth is at least drawdownMinPct; since/comparable are complete only then
 *     comparable: Array<{ peak: string, trough: string, depth: number, sessions: number, regained: string | null }>,
 *                            // past episodes (not the current one) at least as deep as `depth`, newest first
 *     past: number,          // every past episode on record (not the current one)
 *     since: null | { peak: string, trough: string, depth: number }, // the newest comparable episode
 *   },
 * }}
 * Live-window tail events are declustered among themselves only; one that overlaps a published event can count twice.
 */
export function readIndexLongrun(artifact, { index, horizon, recent = [] } = {}) {
  const body = artifact?.indexes?.[index];
  if (!body || !Array.isArray(body.recent)) return null;
  const live = normalizeCloses(recent).filter((row) => row.date > body.through);
  const series = [...normalizeCloses(body.recent), ...live];
  const last = series.at(-1);
  const result = { index, horizon, from: body.from, through: body.through, liveThrough: last?.date || body.through, move: null, drawdown: null };

  const table = body.moves?.[String(horizon)];
  if (table && series.length > horizon) {
    const all = sessionMoves(series, horizon);
    const current = all.at(-1);
    const value = pct(current.ratio);
    const side = value < 0 ? 'fall' : 'rise';
    const cut = side === 'fall' ? table.cutFall : table.cutRise;
    const inTail = isFiniteNumber(cut) && atLeast(side, value, cut);
    const move = { date: current.date, from: current.from, pct: value, side, inTail, cut, rank: null, events: null, observations: table.observations, since: null };
    if (inTail) {
      const baseIdx = current.i - horizon;
      const liveTail = all.filter((m) => m.date > body.through && m.i <= baseIdx && atLeast(side, pct(m.ratio), cut));
      const earlier = [
        ...(side === 'fall' ? table.falls : table.rises).map(([date, value]) => ({ date, pct: value })).filter((event) => event.date <= current.from),
        ...declusterMoves(liveTail, horizon, side).map((m) => ({ date: m.date, pct: pct(m.ratio) })),
      ];
      const larger = earlier.filter((event) => (side === 'fall' ? event.pct < value : event.pct > value));
      const asLarge = earlier.filter((event) => atLeast(side, event.pct, value)).sort((a, b) => b.date.localeCompare(a.date));
      move.rank = larger.length + 1;
      move.events = earlier.length;
      move.since = asLarge[0] ? { date: asLarge[0].date, pct: asLarge[0].pct } : null;
    }
    result.move = move;
  }

  if (body.high && body.drawdown?.trough) {
    let high = { ...body.high };
    let trough = { ...body.drawdown.trough };
    // Sessions from the high to the trough. The published open episode carries them while its trough is the
    // published trough; a live trough adds the sessions after the old one (both inside `series`); a live high restarts.
    const open = (body.drawdowns || []).find((episode) => episode.peak === high.date && !episode.regained);
    let sessions = open && open.trough === trough.date ? open.sessions : high.date === trough.date ? 0 : null;
    const at = (date) => series.findIndex((row) => row.date === date);
    let highAt = at(high.date), troughAt = at(trough.date);
    for (const row of live) {
      const pos = at(row.date);
      if (row.close >= high.close) { high = { date: row.date, close: row.close }; trough = { date: row.date, close: row.close }; sessions = 0; highAt = pos; troughAt = pos; } else if (row.close < trough.close) {
        trough = { date: row.date, close: row.close };
        sessions = highAt >= 0 ? pos - highAt : sessions != null && troughAt >= 0 ? sessions + pos - troughAt : null;
        troughAt = pos;
      }
    }
    const end = live.at(-1) || { date: body.through, close: series.at(-1)?.close };
    const depth = pct(end.close / high.close - 1);
    const minPct = artifact?.definition?.drawdownMinPct ?? LONGRUN_DEFINITION.drawdownMinPct;
    const comparable = (body.drawdowns || [])
      .filter((episode) => episode.peak !== high.date && episode.depth <= depth)
      .sort((a, b) => b.trough.localeCompare(a.trough));
    result.drawdown = {
      high, date: end.date, close: end.close, depth,
      trough: { ...trough, depth: pct(trough.close / high.close - 1) },
      sessions,
      inRange: depth <= -minPct,
      comparable,
      // Every past episode on record (the current one excluded) — the base the comparable ones rank within.
      past: (body.drawdowns || []).filter((episode) => episode.peak !== high.date).length,
      since:comparable[0] ? { peak: comparable[0].peak, trough: comparable[0].trough, depth: comparable[0].depth } : null,
    };
  }
  return result;
}
