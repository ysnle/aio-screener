// the chat saw the official macro releases (CPI, PCE, payrolls, the Fed range, the 2-year,
// real yield, breakeven) only as prose in the DOMAIN block, with no evidence row. The claim registry rule then told the model
// to say "확인 필요" for a number it had been given, and the publication gate stripped any sentence that used one. These are
// the same values the 매크로 / 금리와 환율 screens print, published as typed reference rows: the published data.json macro
// block (BLS/BEA/Treasury/FRED via the producer) and the core PCE pace from macro-history.json on calendar months
// (the screen's annualised3m / yoySeries). Monthly rows carry their reference month as asOf; daily rows their own date.
// A curve spread is published only when it and both legs share one date (the screen's P18-CURVE-01 rule).
import { annualised3m, seriesOf } from '../../domain/macro/macro-read.js';
import { isFiniteNumber as finite, readNumber } from '../../domain/shared/number.js';
import { isoDay } from '../../domain/shared/session-date.js';

export const MACRO_RELEASE_SOURCE = 'macro-release';
export const MACRO_RELEASE_VERSION = 'macro-release-evidence.v1';

const isDay = (value) => isoDay(String(value || '').slice(0, 10)) != null;
const day = (value) => String(value || '').slice(0, 10);
const round = (value, digits) => Number(Number(value).toFixed(digits));
// A value the producer could not refresh is not published as current evidence.
const unusableFreshness = /\b(?:stale|fallback|missing|failed|carried|seed)/i;

// field: data.json macro key; period 'month' rows name the reference month, 'day' rows the observation date.
const RELEASES = Object.freeze([
  { field: 'cpi', metric: 'macro.cpi_yoy', entity: 'US_CPI', label: 'CPI 전년 대비', unit: 'percent', digits: 1, period: 'month' },
  { field: 'coreCpi', metric: 'macro.core_cpi_yoy', entity: 'US_CORE_CPI', label: '근원 CPI 전년 대비', unit: 'percent', digits: 1, period: 'month' },
  { field: 'pce', metric: 'macro.pce_yoy', entity: 'US_PCE', label: 'PCE 물가 전년 대비', unit: 'percent', digits: 1, period: 'month' },
  { field: 'corePce', metric: 'macro.core_pce_yoy', entity: 'US_CORE_PCE', label: '근원 PCE 전년 대비', unit: 'percent', digits: 1, period: 'month' },
  { field: 'unemployment', metric: 'macro.unemployment', entity: 'US_UNRATE', label: '실업률', unit: 'percent', digits: 1, period: 'month' },
  { field: 'nfp', metric: 'macro.nfp_change', entity: 'US_NFP', label: '비농업 고용 전월 대비 증감(천 명)', unit: 'thousands', digits: 0, period: 'month' },
  { field: 'usWageGrowth', metric: 'macro.ahe_yoy', entity: 'US_AHE', label: '시간당 임금 전년 대비', unit: 'percent', digits: 1, period: 'month' },
  { field: 'fedTargetLower', metric: 'macro.fed_target_lower', entity: 'FED_TARGET', label: '연준 기준금리 목표 하단', unit: 'percent', digits: 2, period: 'day' },
  { field: 'fedTargetUpper', metric: 'macro.fed_target_upper', entity: 'FED_TARGET', label: '연준 기준금리 목표 상단', unit: 'percent', digits: 2, period: 'day' },
  { field: 'dgs2', metric: 'macro.us2y', entity: 'US2Y', label: '미 2년물 금리(공식 국채 곡선)', unit: 'percent', digits: 2, period: 'day' },
  { field: 'realYield10', metric: 'macro.real10y', entity: 'US10Y_REAL', label: '미 10년 실질금리(TIPS)', unit: 'percent', digits: 2, period: 'day' },
  { field: 'breakeven10', metric: 'macro.breakeven10', entity: 'US10Y_BREAKEVEN', label: '미 10년 기대인플레이션', unit: 'percent', digits: 2, period: 'day' }
]);

function row({ metric, entity, label, value, unit, asOf, period, origin }) {
  return Object.freeze({
    evidenceId: `ev-macro-${metric.replace(/^macro\./, '').replace(/[^a-z0-9]+/gi, '-')}-${asOf}`,
    metric, entity, label, value, unit, scale: 'raw',
    asOf, observedAt: asOf, period, market: 'US',
    source: MACRO_RELEASE_SOURCE, sourceKind: 'SNAPSHOT', originSource: origin || null, status: 'reference', allowedUse: 'reference', currentSensitive: true,
    version: MACRO_RELEASE_VERSION
  });
}

function monthBefore(series, date, months) {
  const [y, m] = String(date).split('-').map(Number);
  const key = new Date(Date.UTC(y, m - 1 - months, 1)).toISOString().slice(0, 7);
  return series.find((point) => point.date.slice(0, 7) === key) || null;
}

/** Typed reference rows for the official macro releases and daily rates the 매크로 screens print. */
export function buildMacroReleaseEvidence({ macro = null, macroHistory = null, now = Date.now() } = {}) {
  if (!macro || typeof macro !== 'object') return Object.freeze([]);
  const nowMs = readNumber(now) ?? Date.now();
  const out = [];
  const usable = (field) => !unusableFreshness.test(String(macro[`_freshness_${field}`] || ''));
  for (const def of RELEASES) {
    const value = finite(macro[def.field]) ? Number(macro[def.field]) : null;
    const asOf = day(macro[`_asOf_${def.field}`]);
    if (value == null || !isDay(asOf) || Date.parse(asOf) > nowMs || !usable(def.field)) continue;
    const label = def.period === 'month' ? `${def.label} (${asOf.slice(0, 7)} 기준월)` : def.label;
    out.push(row({ ...def, label, value: round(value, def.digits), asOf, origin: macro[`_source_${def.field}`] }));
  }
  // Core PCE pace on calendar months (the 매크로 물가 chapter and the quadrant read these), when the history reaches the
  // published month — an older history month is not presented as the same release.
  const corePce = seriesOf(macroHistory, 'corePceIndex');
  const last = corePce.at(-1);
  const corePceAsOf = day(macro._asOf_corePce);
  // A series the producer could not refresh (series.stale) or a core PCE marked stale on the release block is not current
  // evidence for its derived rows either.
  const corePceFresh = macroHistory?.series?.corePceIndex?.stale !== true && usable('corePce');
  if (last && corePceFresh && (!isDay(corePceAsOf) || last.date.slice(0, 7) >= corePceAsOf.slice(0, 7)) && Date.parse(last.date) <= nowMs) {
    const pace = annualised3m(corePce);
    if (pace) out.push(row({ metric: 'macro.core_pce_3m_ann', entity: 'US_CORE_PCE', label: `근원 PCE 3개월 연율 (${last.date.slice(0, 7)} 기준월)`, value: round(pace.value, 1), unit: 'percent', asOf: last.date, period: 'month', origin: macroHistory?.series?.corePceIndex?.id || 'FRED' }));
    const prev = monthBefore(corePce, last.date, 1);
    if (prev && prev.value) out.push(row({ metric: 'macro.core_pce_mom', entity: 'US_CORE_PCE', label: `근원 PCE 전월 대비 (${last.date.slice(0, 7)} 기준월)`, value: round((last.value / prev.value - 1) * 100, 2), unit: 'percent', asOf: last.date, period: 'month', origin: macroHistory?.series?.corePceIndex?.id || 'FRED' }));
  }
  // 10년 − 2년 on one date only: a spread older or newer than either leg is not the curve the screen draws.
  const spread = finite(macro.t10y2y) ? Number(macro.t10y2y) : null;
  const spreadDay = day(macro._asOf_t10y2y);
  // A spread or a leg the producer kept from an earlier run (stale/carried freshness) is not current evidence either.
  const curveFresh = ['t10y2y', 'dgs2', 'dgs10'].every(usable);
  if (spread != null && curveFresh && isDay(spreadDay) && spreadDay === day(macro._asOf_dgs2) && spreadDay === day(macro._asOf_dgs10) && Date.parse(spreadDay) <= nowMs) {
    out.push(row({ metric: 'macro.curve_2s10s', entity: 'UST_2S10S', label: '미 국채 10년−2년 금리차(공식 곡선, 같은 날)', value: round(spread * 100, 0), unit: 'bp', asOf: spreadDay, period: 'day', origin: macro._source_t10y2y }));
  }
  return Object.freeze(out);
}

const UNIT_TEXT = Object.freeze({ percent: '%', bp: 'bp', thousands: '천 명' });

/** One prompt block naming each release value with its reference month or date and evidence id. */
export function renderMacroReleaseEvidenceContext(rows = []) {
  const list = (Array.isArray(rows) ? rows : []).filter((item) => item?.source === MACRO_RELEASE_SOURCE);
  if (!list.length) return '';
  return ['Macro release evidence (the values the 매크로 / 금리와 환율 screens show; cite with evidenceId, value, unit, asOf and source="macro-release"; a monthly row\'s asOf is its reference month, not the release day):',
    ...list.map((item) => `- ${item.label} ${item.value}${UNIT_TEXT[item.unit] ?? ''}${item.period === 'month' ? '' : ` · ${item.asOf} 관측`} · evidenceId=${item.evidenceId}`)].join('\n');
}

/** A cached reader keyed on the published macro block and macro-history generation. */
export function createMacroReleaseEvidenceReader(readInput, { now = () => Date.now() } = {}) {
  let cache = null;
  return () => {
    let input;
    try { input = readInput() || {}; } catch (_) { return Object.freeze([]); }
    const macro = input.macro || null;
    const generated = input.macroHistory?.generatedAt || '';
    const at = now();
    const dayKey = new Date(at).toISOString().slice(0, 10);
    if (cache && cache.macro === macro && cache.generated === generated && cache.day === dayKey) return cache.rows;
    let rows;
    try { rows = buildMacroReleaseEvidence({ macro, macroHistory: input.macroHistory || null, now: at }); } catch (_) { rows = Object.freeze([]); }
    cache = { macro, generated, day: dayKey, rows };
    return rows;
  };
}
