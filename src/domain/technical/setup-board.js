// The setup board: every screener row placed on one ladder — 돌파 대기 ⊂ 베이스 완성 ⊂ 템플릿 통과 ⊂ n/8 — with the
// trend template's own checks (trend-template.js, the chart's definition) read from the row's published distances, the
// reasons a row falls short, its distance to the pivot and its stop width. The aggregates serve three screens: the
// universe counts and opening points (시장 폭), the per-sector counts and the theme 200-day tiles (테마와 섹터), and the
// per-row state (스크리너). Built once per rows array (the screener slice replaces the array on each load).
// A row whose template inputs are not all published has no state: unknown is never counted as unmet.
import { trendTemplateFromDistances } from './trend-template.js';
import { readNumber as finite } from '../shared/number.js';
import { screenerMarket } from '../screener/market-scope.js';
import { normalizeSectorKey, sectorLabel } from '../screener/sector-label.js';
import { nextEarnings } from '../briefing/leader-earnings.js';
import { dateInTimezone } from '../market/session/market-calendar.js';
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';
import { SETUP_STATE_WORDS } from '../content/setup-board-words.js';
import { withSubjectParticle } from '../content/korean-particle.js';

// 돌파 대기: within pivotWithinPct below the pivot and a stop width (the last pullback, pivot to its low) of at most
// maxStopPct. dryVolumeRatio is the producer's own 'volume drying' line (later half of the base ÷ earlier half).
export const SETUP_RULES = Object.freeze({ pivotWithinPct: 5, maxStopPct: 8, dryVolumeRatio: 0.85, earningsWarnDays: 14, nearBandPct: -10, midBandPct: -30 });
export const SETUP_LADDER = Object.freeze(['ready', 'base', 'template', 'partial']);
// Sectors that hold up in a falling market, tagged on the sector bars.
export const DEFENSIVE_SECTORS = Object.freeze(['Healthcare', 'Consumer Defensive', 'Utilities']);

// The last completed close on the VCP pivot's own series. dollarVolume ÷ lastVolume is that raw close (both from the
// same bar in price-factors); a non-USD listing falls back to the valuation close in its own currency. Only the
// percentage is shown — no price is republished.
function lastCloseOf(row) {
  const currency = String(row?.instrumentRef?.currency || row?.currency || '').trim().toUpperCase();
  const dollarVolume = finite(row?.dollarVolume);
  const lastVolume = finite(row?.lastVolume);
  if (currency === 'USD' && !row?.dollarVolumeFx && dollarVolume > 0 && lastVolume > 0) return dollarVolume / lastVolume;
  const valuation = finite(row?._valuationPePrice ?? row?._valuationPbPrice ?? row?._valuationPrice ?? row?.valuationPrice);
  return valuation > 0 ? valuation : null;
}
/** Last close ÷ VCP pivot − 1, %; null without a pivot or a close. */
export function pivotDistancePct(row) {
  const pivot = finite(row?.vcpPivot);
  const close = lastCloseOf(row);
  return pivot > 0 && close > 0 ? (close / pivot - 1) * 100 : null;
}

const benchmarkLabelOf = (row) => (/\.KQ$/i.test(String(row?.sym || row?.symbol || '')) ? 'KOSDAQ' : /\.KS$/i.test(String(row?.sym || row?.symbol || '')) ? 'KOSPI' : 'S&P 500');

/**
 * One row on the ladder: { symbol, state ('ready'|'base'|'template'|'partial'|null), met, unknown, checks, reasons (ids of
 * SETUP_REASON_WORDS), pivotPct, stopPct, depths, volumeRatio, pctSma200 }.
 */
export function rowSetup(row) {
  const ret6m = finite(row?.ret6m);
  const bench = finite(row?.rsBenchmarkRet6m);
  const checks = trendTemplateFromDistances({
    pctSma50: finite(row?.pctSma50), pctSma150: finite(row?.pctSma150), pctSma200: finite(row?.pctSma200),
    sma200Rise21Pct: finite(row?.sma200Rise21Pct), pctFrom52wLow: finite(row?.pctFrom52wLow), pctFrom52wHigh: finite(row?.pctFrom52wHigh),
    rs6m: ret6m != null && bench != null ? ret6m - bench : null
  }, { benchmarkLabel: benchmarkLabelOf(row) });
  const met = checks.filter((check) => check.ok === true).length;
  const unknown = checks.filter((check) => check.ok == null).length;
  const depths = Array.isArray(row?.vcpDepths) && row.vcpDepths.length ? row.vcpDepths.filter((depth) => finite(depth) != null) : null;
  const stopPct = depths?.length ? depths[depths.length - 1] : null;
  const volumeRatio = finite(row?.vcpVolumeRatio);
  const pivotPct = pivotDistancePct(row);
  const base = { symbol: String(row?.sym || row?.symbol || '').toUpperCase(), met, unknown, checks, pivotPct, stopPct, depths, volumeRatio, pctSma200: finite(row?.pctSma200) };
  if (unknown) return Object.freeze({ ...base, state: null, reasons: Object.freeze(checks.filter((check) => check.ok === false).map((check) => check.id)) });
  const reasons = checks.filter((check) => check.ok === false).map((check) => check.id);
  let state = 'partial';
  if (met === checks.length) {
    state = 'template';
    if (finite(row?.vcpPivot) == null) reasons.push('noBase');
    else if (pivotPct != null && pivotPct > 0) reasons.push('abovePivot');
    else if (pivotPct != null) {
      state = 'base';
      if (pivotPct < -SETUP_RULES.pivotWithinPct) reasons.push('farFromPivot');
      if (stopPct != null && stopPct > SETUP_RULES.maxStopPct) reasons.push('stopWide');
      if (!reasons.length && stopPct != null) state = 'ready';
    }
    if (volumeRatio != null && volumeRatio >= SETUP_RULES.dryVolumeRatio) reasons.push('volumeNotDry');
  }
  return Object.freeze({ ...base, state, reasons: Object.freeze(reasons) });
}

// Screener rows are replaced, never edited in place, so a row object's setup is computed once.
const rowSetups = new WeakMap();
/** rowSetup, once per row object. */
export function setupOf(row) {
  if (!row || typeof row !== 'object') return rowSetup(row);
  if (!rowSetups.has(row)) rowSetups.set(row, rowSetup(row));
  return rowSetups.get(row);
}
/** A sort value for the ladder: higher rungs first, then more checks met; null without a state. */
export function setupSortValue(row) {
  const setup = setupOf(row);
  return setup.state ? (SETUP_LADDER.length - SETUP_LADDER.indexOf(setup.state)) * 10 + setup.met : null;
}

/** The 200-day band of a row: 'template' (the whole template met), 'near' / 'mid' / 'far' by its 200-day distance. */
export function bandOf(setup) {
  if (!setup || setup.pctSma200 == null) return null;
  if (['ready', 'base', 'template'].includes(setup.state)) return 'template';
  return setup.pctSma200 >= SETUP_RULES.nearBandPct ? 'near' : setup.pctSma200 >= SETUP_RULES.midBandPct ? 'mid' : 'far';
}

const atLeast = (state, floor) => SETUP_LADDER.indexOf(state) >= 0 && SETUP_LADDER.indexOf(state) <= SETUP_LADDER.indexOf(floor);
const sessionOf = (rows) => {
  const tally = new Map();
  for (const row of rows) if (row?.factorSessionDate) tally.set(row.factorSessionDate, (tally.get(row.factorSessionDate) || 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] || null;
};

const boards = new WeakMap();
/**
 * The board for the US rows of one screener load: { asOf, bySymbol: Map(symbol → setup), judged, counts: { template,
 * base, ready } (null when no row could be judged), sectors: [{ sector, label, judged, template, base, defensive }] }.
 * ETFs and rows the ranking excludes are left out.
 */
export function buildSetupBoard(rows) {
  if (!Array.isArray(rows)) return buildSetupBoard([]);
  if (boards.has(rows)) return boards.get(rows);
  const bySymbol = new Map();
  const listed = [];
  for (const row of rows) {
    if (!row || row.populationExclusion || screenerMarket(row) !== 'US') continue;
    const sector = normalizeSectorKey(row.sector);
    if (sector === 'ETF') continue;
    const setup = setupOf(row);
    if (!setup.symbol) continue;
    bySymbol.set(setup.symbol, setup);
    listed.push({ row, setup, sector });
  }
  const judged = listed.filter((item) => item.setup.state);
  const count = (list, floor) => list.filter((item) => atLeast(item.setup.state, floor)).length;
  const counts = judged.length ? Object.freeze({ template: count(judged, 'template'), base: count(judged, 'base'), ready: count(judged, 'ready') }) : null;
  const bySector = new Map();
  for (const item of judged) {
    if (!item.sector) continue;
    if (!bySector.has(item.sector)) bySector.set(item.sector, []);
    bySector.get(item.sector).push(item);
  }
  const sectors = [...bySector.entries()].map(([sector, list]) => Object.freeze({
    sector, label: sectorLabel(sector), judged: list.length, template: count(list, 'template'), base: count(list, 'base'), defensive: DEFENSIVE_SECTORS.includes(sector)
  })).sort((a, b) => b.template - a.template || b.base - a.base || a.label.localeCompare(b.label));
  const board = Object.freeze({ asOf: sessionOf(listed.map((item) => item.row)), bySymbol, listed: listed.length, judged: judged.length, counts, sectors: Object.freeze(sectors) });
  boards.set(rows, board);
  return board;
}

/** The rows of a state floor ('ready' | 'base' | 'template'), nearest the pivot first. */
export function setupCandidates(board, floor = 'ready') {
  return [...(board?.bySymbol?.values() || [])].filter((setup) => atLeast(setup.state, floor))
    .sort((a, b) => (b.pivotPct ?? -Infinity) - (a.pivotPct ?? -Infinity) || a.symbol.localeCompare(b.symbol));
}

/**
 * A theme's tiles: { listed, measured, template (null when no member could be judged), near, tiles: [{ symbol, pctSma200,
 * band, state }] strongest first, recovering: the members below the 200-day line nearest it (at most 4) }.
 */
export function themeTiles(board, tickers = []) {
  const symbols = [...new Set((tickers || []).map((sym) => String(sym).toUpperCase()))];
  const tiles = symbols.map((symbol) => board?.bySymbol?.get(symbol)).filter((setup) => setup && setup.pctSma200 != null)
    .map((setup) => Object.freeze({ symbol: setup.symbol, pctSma200: setup.pctSma200, band: bandOf(setup), state: setup.state }))
    .sort((a, b) => (a.band === 'template') !== (b.band === 'template') ? (a.band === 'template' ? -1 : 1) : b.pctSma200 - a.pctSma200);
  const judged = tiles.filter((tile) => tile.state);
  const recovering = tiles.filter((tile) => tile.pctSma200 < 0 && tile.pctSma200 >= SETUP_RULES.nearBandPct).sort((a, b) => b.pctSma200 - a.pctSma200).slice(0, 4);
  return Object.freeze({
    listed: symbols.length, measured: tiles.length,
    template: judged.length ? judged.filter((tile) => tile.band === 'template').length : null,
    above: tiles.filter((tile) => tile.pctSma200 >= 0).length,
    near: tiles.filter((tile) => tile.pctSma200 < 0 && tile.pctSma200 >= SETUP_RULES.nearBandPct).length,
    tiles: Object.freeze(tiles), recovering: Object.freeze(recovering)
  });
}

/** A theme's members: the union of its sub-theme tickers (THEME_MAP shape). */
export function themeMembers(theme) {
  return [...new Set((theme?.subThemes || []).flatMap((sub) => sub?.tickers || []).map((sym) => String(sym).toUpperCase()))];
}

/** Calendar days to a row's next report ({ date, days }), or null when the calendar has none ahead. */
export function earningsAhead(calendar, symbol, { nowMs = Date.now() } = {}) {
  const next = nextEarnings(calendar, symbol, { nowMs });
  const today = dateInTimezone(nowMs, 'America/New_York');
  if (!next || !today) return null;
  const days = Math.round((Date.parse(`${next.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return days >= 0 ? Object.freeze({ date: next.date, days, soon: days <= SETUP_RULES.earningsWarnDays }) : null;
}

const countClaim = (subject, measure, asOf, value, label) => claim({ subject, measure, asOf, figures: [{ value, unit: 'count', basis: measure, label }] });

/**
 * The opening points of 시장 폭, each from computed inputs and dropped when they are missing:
 * highs/lows { newHighs, newLows, asOf }, the board, a theme { name, tiles } and the earnings calendar.
 * @returns {Array<{text:string, claims:object[]}>}
 */
export function setupBoardPoints({ highsLows = null, board = null, theme = null, calendar = null, nowMs = Date.now() } = {}) {
  const points = [];
  const asOf = board?.asOf || null;
  if (highsLows && finite(highsLows.newHighs) != null && finite(highsLows.newLows) != null) {
    points.push(say('52주 신고가 {h}, 신저가 {l}', {
      h: countClaim('us-breadth', 'newHighs', highsLows.asOf, highsLows.newHighs, '52주 신고가'),
      l: countClaim('us-breadth', 'newLows', highsLows.asOf, highsLows.newLows, '52주 신저가')
    }));
  }
  if (board?.counts) {
    const { template, base, ready } = board.counts;
    const lead = board.sectors.filter((row) => row.base > 0).sort((a, b) => b.base - a.base)[0] || null;
    points.push(sayJoin([
      say('추세 템플릿 통과 {t}, 그중 베이스 완성 {b}', { t: countClaim('us-screener', 'templatePass', asOf, template, '템플릿 통과'), b: countClaim('us-screener', 'templateBase', asOf, base, '베이스 완성') }),
      lead && base > 1 ? say('{s} {n}로 가장 많음', { s: withSubjectParticle(lead.label), n: countClaim(`sector:${lead.sector}`, 'templateBase', asOf, lead.base, '베이스 완성') }) : NOTHING
    ], ' — '));
    if (ready > 0) points.push(say('{w} {r} — 시장이 돌아설 때 먼저 볼 후보', { w: SETUP_STATE_WORDS.ready, r: countClaim('us-screener', 'setupReady', asOf, ready, SETUP_STATE_WORDS.ready) }));
  }
  if (theme?.tiles?.measured >= 8) {
    const t = theme.tiles;
    points.push(sayJoin([
      say('{name} {m} 중 200일선 위 {a}', { name: theme.name, m: countClaim(`theme:${theme.id}`, 'measured', asOf, t.measured, '종목'), a: countClaim(`theme:${theme.id}`, 'above200', asOf, t.above, '200일선 위') }),
      t.template != null ? say('템플릿 통과 {p}', { p: countClaim(`theme:${theme.id}`, 'templatePass', asOf, t.template, '템플릿 통과') }) : NOTHING,
      t.recovering.length ? say('200일선에 가장 가까운 종목 {list}', { list: t.recovering.map((tile) => tile.symbol).join(', ') }) : NOTHING
    ], ', '));
  }
  if (board && calendar) {
    const soon = setupCandidates(board, 'base').map((setup) => ({ setup, next: earningsAhead(calendar, setup.symbol, { nowMs }) })).filter((item) => item.next?.soon)
      .sort((a, b) => a.next.days - b.next.days).slice(0, 3);
    if (soon.length) points.push(sayJoin(soon.map(({ setup, next }) => say('{s} 실적 D-{d}', { s: setup.symbol, d: claim({ subject: `stock:${setup.symbol}`, measure: 'daysToEarnings', asOf: next.date, figures: [{ value: next.days, unit: 'level', digits: 0, basis: 'calendar-days', label: '실적까지 일수' }] }) })), ', '));
  }
  return points.filter((point) => point.text);
}
