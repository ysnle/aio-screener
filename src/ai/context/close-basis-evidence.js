// v57.48 expert review #7 (2026-10-13): the AI saw the screen's close-basis readings only as prompt prose, and the
// one typed VIX/^TNX evidence it had (the live decision bundle) was `stale` after the bell, so every current number
// in an answer was dropped and the reply opened with "최신 수치의 근거를 확인하지 못했습니다". The completed closes the
// screen reads are published here as typed reference evidence: fixed metric ids, the real close date as `asOf`, one
// source ('close-basis'), so a claim can bind to exactly the value the user sees. Live rows stay live; a stale live
// row is pointed at its close-basis substitute instead of being silently relabelled.
import { alignMarketInputs, buildCloseSeries } from '../../domain/briefing/market-read.js';
import { countOpenSessionsBetween, latestCompletedUsSession } from '../../domain/market/market-calendar.js';

export const CLOSE_BASIS_SOURCE = 'close-basis';
export const CLOSE_BASIS_VERSION = 'close-basis-evidence.v1';

// `change`: 'pct' publishes a one-session % change row, 'bp' a basis-point change row (rates never move in %).
const METRICS = Object.freeze([
  { field: 'spx', metric: 'close.spx', entity: 'SPX', label: 'S&P 500 종가', unit: 'index', digits: 2, change: 'pct', symbols: ['^GSPC', 'SPX'] },
  { field: 'nasdaq', metric: 'close.nasdaq', entity: 'NASDAQ', label: '나스닥 종합 종가', unit: 'index', digits: 2, change: 'pct', symbols: ['^IXIC'] },
  { field: 'vix', metric: 'close.vix', entity: 'VIX', label: 'VIX 종가', unit: 'index', digits: 2, change: 'pct', symbols: ['^VIX', 'VIX'] },
  { field: 'tnx', metric: 'close.us10y', entity: 'US10Y', label: '미 10년물 금리 종가', unit: 'percent', digits: 3, change: 'bp', symbols: ['^TNX', 'US10Y'] },
  { field: 'dxy', metric: 'close.dxy', entity: 'DXY', label: '달러 인덱스 종가', unit: 'index', digits: 2, change: null, symbols: ['DX-Y.NYB', 'DXY'] },
  { field: 'wti', metric: 'close.wti', entity: 'WTI', label: 'WTI 종가', unit: 'usd_per_barrel', digits: 2, change: null, symbols: ['CL=F', 'WTI'] },
  { field: 'gold', metric: 'close.gold', entity: 'GOLD', label: '금 종가', unit: 'usd_per_ounce', digits: 1, change: null, symbols: ['GC=F'] },
  { field: 'kospi', metric: 'close.kospi', entity: 'KOSPI', label: '코스피 종가', unit: 'index', digits: 2, change: 'pct', symbols: ['^KS11', 'KOSPI'] },
  { field: 'usdkrw', metric: 'close.usdkrw', entity: 'USDKRW', label: '원/달러 종가', unit: 'krw_per_usd', digits: 2, change: null, symbols: ['KRW=X', 'USDKRW'] }
]);

const round = (value, digits) => Number(Number(value).toFixed(digits));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);

function row({ metric, entity, label, value, unit, date, observedAt, basis, alignment, market }) {
  return Object.freeze({
    evidenceId: `ev-close-${metric.replace(/^close\./, '').replace(/[^a-z0-9]+/gi, '-')}-${date}`,
    metric, entity, label, value, unit, scale: 'raw',
    asOf: date, observedAt: observedAt || date, basisDate: basis || null, alignment: alignment || null, market: market || 'US',
    source: CLOSE_BASIS_SOURCE, sourceKind: 'SNAPSHOT', status: 'reference', allowedUse: 'reference', currentSensitive: true,
    version: CLOSE_BASIS_VERSION
  });
}

/** Typed reference rows for the completed closes the screen reads (same alignment rules as the regime board). */
export function buildCloseBasisEvidence(input = {}) {
  let aligned;
  try { aligned = alignMarketInputs(input); } catch (_) { return []; }
  const { basis, s, c, alignments } = aligned;
  if (!basis || !s?.spx) return [];
  // M05 parity (P1688 review): the regime board holds its verdict when the basis is more than two sessions behind the
  // latest completed US session; the AI must not publish that same old close as confirmed evidence.
  const nowMs = Number(input.now);
  const latest = Number.isFinite(nowMs) ? latestCompletedUsSession(nowMs, { requirePrevious: false })?.date || null : null;
  if (latest && latest > basis && countOpenSessionsBetween(basis, latest, 'US') > 2) return [];
  const out = [];
  for (const def of METRICS) {
    const stat = s[def.field];
    if (!stat || !finite(stat.value)) continue;
    const provenance = buildCloseSeries(input.history, def.field, { through: stat.date, includeProvenance: true }).at(-1);
    const shared = { entity: def.entity, date: stat.date, observedAt: provenance?.date === stat.date ? provenance.observedAt : stat.date, basis, alignment: alignments?.[def.field]?.status || null, market: def.field === 'kospi' ? 'KR' : 'US' };
    out.push(row({ ...shared, metric: def.metric, label: def.label, value: round(stat.value, def.digits), unit: def.unit }));
    if (def.change === 'pct' && finite(stat.d1) && stat.d1 !== 0) {
      out.push(row({ ...shared, metric: `${def.metric}.chg1d`, label: `${def.label.replace(/ 종가$/, '')} 1거래일 변화`, value: round((stat.value / stat.d1 - 1) * 100, 2), unit: 'percent' }));
    } else if (def.change === 'bp' && finite(stat.d1)) {
      out.push(row({ ...shared, metric: `${def.metric}.chg1d`, label: `${def.label.replace(/ 종가$/, '')} 1거래일 변화`, value: round((stat.value - stat.d1) * 100, 1), unit: 'bp' }));
    }
  }
  if (finite(c?.hyBp) && alignments?.hy?.date) {
    out.push(row({ metric: 'close.hy_oas', entity: 'HY_OAS', label: '하이일드 스프레드', value: round(c.hyBp, 0), unit: 'bp', date: alignments.hy.date, observedAt: input.credit?.hyAsOf || alignments.hy.date, basis, alignment: alignments.hy.status, market: 'US' }));
  }
  return Object.freeze(out);
}

/** The close-basis row that stands in for a live symbol (used when the live row is stale). */
export function closeBasisSubstituteFor(symbol, rows = []) {
  const key = String(symbol || '').toUpperCase();
  const def = METRICS.find((item) => item.symbols.some((candidate) => candidate.toUpperCase() === key));
  return def ? (rows || []).find((item) => item.metric === def.metric) || null : null;
}

const UNIT_TEXT = Object.freeze({ index: '', percent: '%', bp: 'bp', usd_per_barrel: '달러', usd_per_ounce: '달러', krw_per_usd: '원' });

/** One prompt block that names each close value with its date and evidence id. */
export function renderCloseBasisEvidenceContext(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return '';
  return ['Close-basis evidence (completed closes; cite these with their evidenceId, value, unit, asOf and source="close-basis"):',
    ...list.map((item) => `- ${item.label} ${item.value}${UNIT_TEXT[item.unit] ?? ''} · ${item.asOf} 종가 · evidenceId=${item.evidenceId}`)].join('\n');
}

/** A cached reader so streaming partial renders do not rebuild the close series on every chunk. */
export function createCloseBasisEvidenceReader(readInput, { ttlMs = 60000, now = () => Date.now() } = {}) {
  let cache = null;
  return () => {
    let input;
    try { input = readInput(); } catch (_) { return []; }
    const history = input?.history;
    const key = [Array.isArray(history) ? history.length : 0, input?.credit?.hyBp ?? '', input?.credit?.hyAsOf ?? ''].join('|');
    const at = now();
    if (cache && cache.history === history && cache.key === key && at - cache.at < ttlMs) return cache.rows;
    const rows = buildCloseBasisEvidence(input);
    cache = { history, key, at, rows };
    return rows;
  };
}
