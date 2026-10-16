// Market-analysis evidence and validation split out of scripts/fetch-data.mjs (v57.62): the metric/news evidence the
// shared model may cite, the number/direction/admission validator (validator v3), the structured artifact shape, and
// the retain/reuse rules for a previous verified analysis. Pure: no network and no file I/O. fetch-data.mjs imports
// and re-exports them; genMarketAnalysis (the model call) stays in the producer.
import { round } from './producer-math.mjs';
import { LIST_ITEM_BREAK, analysisLevelsAfterLabels, analysisProse, isNonMetricNumber } from './market-analysis-numbers.mjs';
import { sessionDateInMarket } from '../../src/domain/market/session-time.js';
import { buildCloseSeries } from '../../src/domain/briefing/market-read.js';

const MARKET_ANALYSIS_QUOTE_DEFS = [
  { symbol: '^GSPC', metricId: 'market.spx', label: 'SPX', unit: 'index', aliases: ['S&P 500'] },
  { symbol: '^VIX', metricId: 'market.vix', label: 'VIX', unit: 'index', aliases: [] },
  { symbol: '^TNX', metricId: 'market.us10y', label: '10Y', unit: 'index', aliases: ['US 10Y', 'Treasury'] },
  { symbol: 'DX-Y.NYB', metricId: 'market.dxy', label: 'DXY', unit: 'index', aliases: [] },
  { symbol: 'CL=F', metricId: 'market.wti', label: 'WTI', unit: 'USD/barrel', aliases: ['oil'] },
  { symbol: 'GC=F', metricId: 'market.gold', label: 'Gold', unit: 'USD/oz', aliases: [] },
  { symbol: '^KS11', metricId: 'market.kospi', label: 'KOSPI', unit: 'index', aliases: [], zone: 'Asia/Seoul' },
];
// v57.81: the completed-close series in history.json for each quote (see buildCompletedCloseBasis).
const MARKET_ANALYSIS_HISTORY_FIELDS = Object.freeze({ 'market.spx': 'spx', 'market.vix': 'vix', 'market.us10y': 'tnx', 'market.dxy': 'dxy', 'market.wti': 'wti', 'market.gold': 'gold', 'market.kospi': 'kospi' });
const MARKET_ANALYSIS_MACRO_DEFS = [
  { key: 'cpi', metricId: 'macro.cpi', label: 'CPI', unit: 'percent', aliases: [] },
  { key: 'fedRate', metricId: 'macro.fed-rate', label: 'FedRate', unit: 'percent', aliases: ['Fed rate', 'Fed funds'] },
  { key: 'nfp', blsMetricId: 'nonfarmPayroll', metricId: 'macro.nfp-mom', label: 'NFP', unit: 'thousands', aliases: ['nonfarm payroll'] },
];

function _validIsoDate(value) {
  return value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : null;
}

export function buildMarketAnalysisEvidence(data, options = {}) {
  const evidence = [];
  // P1093: the narrative's evidence must be derived from the artifact that actually
  // publishes it. `data.quotes` is stripped by toPublicPayload (P715), so a claim
  // built from it cited a quote plane the published data.json no longer contains —
  // and `MARKET_ANALYSIS_QUOTE_DEFS` duplicated unit/metricId values that disagreed
  // with the canonical snapshot (^TNX was `index` here and `percent` in
  // market-snapshot.json). Prefer the canonical snapshot rows so unit, metricId and
  // evidenceId all resolve inside the published artifact.
  const snapshotQuotes = new Map();
  for (const row of (options.snapshot?.quotes || [])) {
    if (row && row.instrumentId) snapshotQuotes.set(row.instrumentId, row);
  }
  const quotes = new Map((data?.quotes || []).filter(row => row && row.symbol).map(row => [row.symbol, row]));
  for (const def of MARKET_ANALYSIS_QUOTE_DEFS) {
    const canonical = snapshotQuotes.get(def.symbol) || null;
    const row = quotes.get(def.symbol);
    const value = Number(canonical ? canonical.value : row?.regularMarketPrice);
    const asOf = _validIsoDate(canonical ? canonical.observedAt : (row?.observedAt || row?.fetchedAt));
    const source = canonical ? canonical.source : row?.source;
    if (!Number.isFinite(value) || !asOf || !source) continue;
    evidence.push({
      evidenceId: canonical?.evidenceId || `market-analysis:${def.symbol}:${asOf}`,
      metricId: def.metricId,
      canonicalMetricId: canonical?.metricId || null,
      label: def.label,
      value,
      unit: canonical?.unit || def.unit,
      observedAt: asOf,
      collectedAt: data?.meta?.generatedAt || null,
      asOf,
      source,
      sourceTier: row?.sourceTier || 'unknown',
      sourceKind: (canonical ? canonical.sourceKind : row?.sourceKind) || 'market-quote',
      allowedUse: (canonical ? canonical.allowedUse : row?.allowedUse) || 'reference-only',
      // P1372: an intraday delayed value must not be narrated as a close.
      session: canonical?.session || row?.marketState || null,
      status: 'observed',
    });
  }
  const macro = data?.macro || {};
  for (const def of MARKET_ANALYSIS_MACRO_DEFS) {
    const bls = macro._bls?.series?.[def.blsMetricId || def.key];
    const value = Number(macro[def.key]);
    // A BLS series is eligible for the market-standard CPI evidence slot only
    // when its seasonal-adjustment contract matches the slot.  This prevents
    // a legacy SA CUSR payload from masquerading as the NSA release headline.
    const expectedAdjustment = def.key === 'cpi' || def.key === 'coreCpi' ? 'NSA' : null;
    const blsDefinitionMatches = !expectedAdjustment || String(bls?.seasonalAdjustment || '').toUpperCase() === expectedAdjustment;
    const blsMatchesValue = bls?.status === 'ok' && blsDefinitionMatches && Number.isFinite(Number(bls.value)) && Number(bls.value) === value;
    const asOf = _validIsoDate(blsMatchesValue ? bls.observedAt : macro[`_asOf_${def.key}`]);
    const source = blsMatchesValue ? bls.source : (macro._source === 'fred' ? 'FRED' : null);
    if (!Number.isFinite(value) || !asOf || !source) continue;
    evidence.push({
      evidenceId: `market-analysis:${def.metricId}:${asOf}`,
      metricId: def.metricId,
      label: def.label,
      value,
      unit: def.unit,
      observedAt: asOf,
      collectedAt: data?.meta?.generatedAt || null,
      asOf,
      source,
      sourceTier: blsMatchesValue ? (bls.sourceKind || 'T1_OFFICIAL') : 'T1_OFFICIAL',
      sourceKind: blsMatchesValue ? (bls.sourceKind || 'T1_OFFICIAL') : 'T1_OFFICIAL',
      allowedUse: blsMatchesValue ? (bls.allowedUse || 'macro-evidence-with-observation-date') : 'macro-evidence-with-observation-date',
      status: 'observed',
    });
  }
  const fgValue = Number(data?.fearGreed?.score);
  const fgAsOf = _validIsoDate(data?.fearGreed?.asOf);
  if (Number.isFinite(fgValue) && fgAsOf && data?.fearGreed?._source) {
    evidence.push({
      evidenceId: `market-analysis:fear-greed:${fgAsOf}`,
      metricId: 'sentiment.fear-greed',
      label: 'Fear&Greed',
      value: fgValue,
      unit: 'score',
      observedAt: fgAsOf,
      collectedAt: data?.meta?.generatedAt || null,
      asOf: fgAsOf,
      source: data.fearGreed._source,
      sourceTier: 'public-api',
      sourceKind: 'public-api',
      allowedUse: 'reference-only',
      status: 'observed',
    });
  }
  return evidence;
}

// P1585: the first number after a label was taken as the level, so a correct Korean sentence that
// states the move first ("SPX는 0.66% 오른 7,816") failed as metric-value-mismatch on every quote
// and blocked ~70% of market analyses. Within the label's clause, skip change-like numbers (signed,
// %p/bp/포인트, a following up/down verb, or a % on a non-rate level) and compare the first level.
function _analysisNumberAfterLabel(body, labels) {
  const allLabels = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]
    .flatMap(def => [def.label, ...(def.aliases || [])]);
  return analysisLevelsAfterLabels(body, labels, { allLabels })[0] ?? null;
}

// T03/T08 (v57.48 review, 2026-10-13): a verified analysis opened "유가 -6.40%인 코스피는 장중 하락" (-6.40% was
// KOSPI's move) and "금리 -0.08%" (a relative change of the yield, read as -8bp). The validator compared only the
// level after an English label, so Korean names and % moves were never checked. Every mention — English label or the
// Korean name the model actually writes — now has its % move checked against that metric's own changePct, a rate may
// move only in bp, and an in-session value must be written as 장중 with its time.
// v57.69: thresholds for the large-move rules in validateMarketAnalysisText (percent change vs the previous close).
export const KOREA_MOVE_MENTION_PCT = 3;
export const LARGE_MOVE_ATTRIBUTION_PCT = 1;
export const MARKET_ANALYSIS_CLOSED_SESSIONS = Object.freeze(['MARKET_CLOSED', 'CLOSED_CURRENT', 'COMPLETED', 'CLOSED', 'REGULAR']);
const MARKET_ANALYSIS_MENTIONS = Object.freeze({
  'market.spx': ['S&P\\s?500', 'SPX', 'S&P', '에스앤피\\s?(?:오백|500)'],
  'market.vix': ['VIX', '변동성\\s?지수', '공포\\s?지수'],
  'market.us10y': ['US 10Y', '10Y', 'Treasury', '(?:미(?:국)?\\s?)?(?:10년물|10년\\s?국채|국채\\s?10년물?)(?:\\s?(?:금리|수익률))?',
    // review: a bare 금리 is the 10-year only when no other tenor/kind qualifies it (2년물·실질·정책·기준 금리 are other series).
    '(?<![가-힣])(?<!(?:\\d\\s?(?:년물|년|개월물|개월)|실질|정책|기준|단기|장기|명목|모기지|대출|예금|회사채)\\s?)금리'],
  'market.dxy': ['DXY', '달러\\s?(?:지수|인덱스)'],
  'market.wti': ['WTI', 'oil', '(?<![가-힣])유가', '(?<![가-힣])원유'],
  'market.gold': ['Gold', '(?<![가-힣])금(?:값|\\s?가격|\\s?선물)?(?=[은는이가을를도의과와·,\\s]|$)'],
  'market.kospi': ['KOSPI', '코스피(?!\\s?200)'],
});
const MARKET_ANALYSIS_MENTION_ENTRIES = Object.entries(MARKET_ANALYSIS_MENTIONS).flatMap(([metricId, patterns]) => patterns.map((source) => {
  const latin = /^[A-Za-z]/.test(source);
  return { metricId, latin, source: latin ? `(?<![A-Za-z0-9_.:-])${source}(?![A-Za-z0-9_.:-])` : source };
}));
const MARKET_ANALYSIS_MENTION_RE = new RegExp(MARKET_ANALYSIS_MENTION_ENTRIES.map((entry) => `(${entry.source})`).join('|'), 'gi');

/** Every metric mention with the clause that belongs to it (up to the next mention or the sentence end). */
export function analysisMetricMentions(text) {
  const body = String(text || '').replace(/https?:\/\/\S+/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  const hits = [...body.matchAll(MARKET_ANALYSIS_MENTION_RE)].map((match) => {
    const entry = MARKET_ANALYSIS_MENTION_ENTRIES[match.slice(1).findIndex((group) => group !== undefined)];
    return { metricId: entry.metricId, latin: entry.latin, start: match.index, end: match.index + match[0].length };
  });
  return hits.map((hit, index) => {
    const stop = Math.min(hit.end + 60, hits[index + 1]?.start ?? Infinity);
    const clause = body.slice(hit.end, stop).split(/(?<!\d)[.。](?!\d)|\n|[;；]/)[0];
    const sentenceStart = Math.max(body.lastIndexOf('.', hit.start), body.lastIndexOf('\n', hit.start), body.lastIndexOf('。', hit.start)) + 1;
    const sentenceEnd = body.slice(hit.end).search(/(?<!\d)[.。](?!\d)|\n/);
    return { ...hit, clause, sentence: body.slice(sentenceStart, sentenceEnd < 0 ? body.length : hit.end + sentenceEnd) };
  });
}

const ANALYSIS_UP = /(?:상승|오른|올라|올랐|급등|반등|강세|높아|뛴|확대)/;
const ANALYSIS_DOWN = /(?:하락|내린|내려|내렸|떨어|급락|약세|낮아|빠진|축소)/;

// v57.81 (10/15 07:52 run): VIX's row turned AFTER_HOURS (17.52, +3.85% against 16.87). The prompt keeps in-session rows
// out and REGIME_CONTEXT shows the 10/14 completed close (VIX 16.87, +10.48%), yet the validator compared "VIX +10.48%"
// with the in-session +3.85% — a different session than the one the model was given. For an in-session row the last
// completed close and its own one-session change are an accepted basis too (no 장중 label needed for them). The close
// comes from history.json, one value per market session date: the 10/15 history row repeats the 10/14 US closes
// (cycleEnd 10/14), so "the last two rows" would give a 0% change.
export function buildCompletedCloseBasis(metricEvidence = [], history = []) {
  const basis = new Map();
  const rows = Array.isArray(history) ? history : [];
  if (!rows.length) return basis;
  for (const row of Array.isArray(metricEvidence) ? metricEvidence : []) {
    if (!row?.session || MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session)) continue;
    const field = MARKET_ANALYSIS_HISTORY_FIELDS[row.metricId];
    if (!field) continue;
    const zone = MARKET_ANALYSIS_QUOTE_DEFS.find((def) => def.metricId === row.metricId)?.zone || 'America/New_York';
    const today = sessionDateInMarket(row.observedAt, zone);
    const byDay = new Map();
    for (const entry of rows) {
      const value = Number(entry?.[field]);
      const at = entry?.fieldMeta?.[field]?.observedAt || null;
      const day = at ? sessionDateInMarket(at, zone) : null;
      if (!Number.isFinite(value) || !day || (today && day >= today)) continue;
      const kept = byDay.get(day);
      if (!kept || Date.parse(at) > Date.parse(kept.at)) byDay.set(day, { value, at });
    }
    const days = [...byDay.keys()].sort();
    if (days.length < 2) continue;
    const close = byDay.get(days[days.length - 1]);
    const prior = byDay.get(days[days.length - 2]);
    if (!(prior.value > 0)) continue;
    basis.set(row.evidenceId, { value: close.value, changePct: (close.value / prior.value - 1) * 100, sessionDate: days[days.length - 1] });
  }
  return basis;
}

/** % moves, bp moves and Korean-name levels checked against each metric's own evidence. */
export function validateAnalysisMetricMentions(text, metricEvidence = [], changes = new Map(), { context = '', closedBasis = new Map() } = {}) {
  const issues = [];
  const supported = (digits) => !!context && context.includes(digits);
  for (const mention of analysisMetricMentions(text)) {
    const row = metricEvidence.find((item) => item.metricId === mention.metricId);
    if (!row) continue;
    const rate = row.unit === 'percent';
    const level = Number(row.value);
    const changePct = changes.get(row.evidenceId);
    const toBp = (value, pct) => (Number.isFinite(pct) ? (value - value / (1 + pct / 100)) * 100 : null);
    const bpChange = rate ? toBp(level, changePct) : null;
    const inSession = !!row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session);
    const closed = inSession ? closedBasis.get(row.evidenceId) || null : null;
    const closedBp = rate && closed ? toBp(closed.value, closed.changePct) : null;
    let usedIntraday = false;
    let levelSeen = false;
    let previousEnd = -1;
    for (const match of mention.clause.matchAll(/([+\-−±]?)(\d[\d,]*(?:\.\d+)?)\s*(%포인트|%p|bps|bp|포인트|%)?/gi)) {
      const [, sign, digits, suffix = ''] = match;
      const after = mention.clause.slice(match.index + match[0].length, match.index + match[0].length + 14);
      // P1719: one date/time/count rule shared with the label-level reader (10월·오후 3시 are not levels).
      if (isNonMetricNumber(mention.clause, match.index, match[0].length) || /^(?:%p|%포인트|포인트)$/i.test(suffix)) continue;
      // review: a multi-period move ("20일 동안 8.2% 하락") or a share ("40%를 차지") is not the one-session change.
      const before = mention.clause.slice(Math.max(0, match.index - 16), match.index);
      if (/(?:\d\s?(?:일|주|개월|년|거래일|세션)|연초|연간|올해|분기|월간|주간)[^\d]{0,8}$/.test(before) || /^\s*(?:를|을|의|가|이)?\s*(?:차지|비중|비율|확률|가능성|점유)/.test(after)) continue;
      // v57.81: "변동성지수 +10.48%, 미국 주가지수 -1.11%" — the number after a list comma belongs to the next item.
      if (previousEnd >= 0 && LIST_ITEM_BREAK.test(mention.clause.slice(previousEnd, match.index))) break;
      previousEnd = match.index + match[0].length;
      const magnitude = Number(digits.replace(/,/g, ''));
      if (!Number.isFinite(magnitude)) continue;
      const direction = sign === '-' || sign === '−' ? -1 : sign === '+' ? 1 : ANALYSIS_DOWN.test(after) ? -1 : ANALYSIS_UP.test(after) ? 1 : 0;
      const moved = direction !== 0;
      const stated = direction ? direction * magnitude : magnitude;
      const plain = digits.replace(/,/g, '');
      if (/^bps?$/i.test(suffix)) {
        const bpGap = (bp) => (bp == null ? Infinity : direction ? Math.abs(stated - bp) : Math.abs(magnitude - Math.abs(bp)));
        const bpOk = (bp) => bpGap(bp) <= Math.max(1, Math.abs(bp) * 0.25);
        if (rate && bpChange != null && !bpOk(bpChange) && !(closedBp != null && bpOk(closedBp)) && !supported(plain)) issues.push(`metric-change-mismatch:${row.metricId}`);
        continue;
      }
      if (suffix === '%') {
        if (rate) {
          if (moved) issues.push(`rate-change-not-bp:${row.metricId}`);
          else if (!mention.latin && Math.abs(magnitude - level) > 0.15 && !(closed && Math.abs(magnitude - closed.value) <= 0.15) && !supported(plain)) issues.push(`metric-value-mismatch:${row.metricId}`);
          continue;
        }
        if (!Number.isFinite(changePct) && !closed) continue;
        // v57.50 (live 10/13): KOSPI fell 5.46% and the commentary was blocked for "5% 이상 급락", the wording of the
        // news it cited. A bound ("N% 이상/넘게") holds when the move reaches N; an approximation ("약·거의 N%",
        // "N% 가까이/안팎/가량") holds within max(0.5, 10%) of N. The direction must still agree when one is stated.
        const bound = /^\s*(?:이상|넘게|넘는|넘어|초과|웃도)/.test(after);
        const approx = /(?:약|거의|대략|무려)\s*$/.test(before) || /^\s*(?:가까이|가량|안팎|내외|정도|근처)/.test(after);
        const movesLike = (pct) => {
          if (!Number.isFinite(pct)) return false;
          const sameWay = !direction || Math.sign(pct) === direction || pct === 0;
          return bound ? sameWay && Math.abs(pct) >= magnitude - 0.15
            : approx ? sameWay && Math.abs(Math.abs(pct) - magnitude) <= Math.max(0.5, magnitude * 0.1)
              : direction ? Math.abs(stated - pct) <= 0.15 : Math.abs(magnitude - Math.abs(pct)) <= 0.15;
        };
        if (movesLike(changePct)) usedIntraday = usedIntraday || inSession;
        else if (!(closed && movesLike(closed.changePct)) && !supported(plain)) issues.push(`metric-change-mismatch:${row.metricId}`);
        continue;
      }
      if (moved || levelSeen) continue;
      levelSeen = true;
      const tolerance = Math.max(rate ? 0.15 : 0.5, Math.abs(level) * 0.02);
      if (Math.abs(magnitude - level) <= tolerance) usedIntraday = usedIntraday || inSession;
      else if (!(closed && Math.abs(magnitude - closed.value) <= Math.max(rate ? 0.15 : 0.5, Math.abs(closed.value) * 0.02)) && !mention.latin && !supported(plain)) issues.push(`metric-value-mismatch:${row.metricId}`);
    }
    if (usedIntraday && !(/장중/.test(mention.sentence) && /\d{1,2}:\d{2}|\d{1,2}시(?:\s?\d{1,2}분)?/.test(mention.sentence))) issues.push(`intraday-time-missing:${row.metricId}`);
  }
  return [...new Set(issues)];
}

// M06: typed admission for the claims the prompt forbids or the evidence can disprove. These are blocking issues.
const ANALYSIS_TRADE_INSTRUCTION = /(?:매수|매도|매집|손절|익절|진입|청산)(?:하세요|하십시오|해라|하라|할\s*때입니다|하시길)|(?:사세요|파세요|사라|팔아라|담으세요|비중을\s*(?:늘리|줄이)세요)|목표\s*가(?:는|를)?\s*\$?\d|\b(?:buy|sell)\s+now\b/i;
const ANALYSIS_PROBABILITY = /\d+(?:\.\d+)?\s*%\s*(?:의\s*)?(?:확률|가능성|승률)|(?:확률|가능성|승률)(?:은|이|는|로|이\s*약)?\s*(?:약\s*)?\d+(?:\.\d+)?\s*%/;
export function validateAnalysisAdmission(body, { changes = new Map(), context = '' } = {}) {
  const issues = [];
  if (ANALYSIS_TRADE_INSTRUCTION.test(body)) issues.push('trade-instruction');
  if (ANALYSIS_PROBABILITY.test(body)) issues.push('probability-claim');
  // v57.75: likelihood in words ("반등 가능성이 높습니다") and past frequency without a sample size ("과거엔 대부분 반등")
  // are the same claims without the evidence the owner's rule asks for (conditions n/m, frequency with n).
  for (const sentence of body.replace(/\[[^\]]*\]/g, '').split(/(?<=[.?!。])\s+|\n+/)) {
    if (/(?:가능성|확률)(?:이|은|도)?\s?(?:높|낮|크|작|커|적)/.test(sentence) && !/\d+\s*\/\s*\d+/.test(sentence)) issues.push('likelihood-qualitative');
    if (/과거/.test(sentence) && /대부분|대체로|자주|흔히/.test(sentence) && !/\d+\s*(?:번|회|건|차례)|표본/.test(sentence)) issues.push('frequency-without-sample');
  }
  // Condition counts must be well-formed and, when a regime context was supplied, appear in it.
  for (const match of body.matchAll(/(\d+)\s*\/\s*(\d+)\s*(?:개)?\s*(?:조건|충족)|(?:조건|부합|충족)\s*(\d+)\s*\/\s*(\d+)/g)) { // T06: "현재 조건 충족 n/m" (v57.72 wording; 부합 kept for older text)
    const met = Number(match[1] ?? match[3]); const total = Number(match[2] ?? match[4]);
    if (!(total > 0) || met > total || total > 10) issues.push('condition-count-invalid');
    else if (context && !new RegExp(String.raw`(?:조건\s*${met}\s*/\s*${total}|${met}\s*/\s*${total})`).test(context)) issues.push('condition-count-unsupported');
  }
  // Day-over-day change: a stated "변화/상승/하락 x%" near a label must match the evidence change within 0.15%p.
  for (const match of body.matchAll(/(?:변화율|등락률|상승률|하락률|변화|등락)\s*(?:은|는|이|가|률은)?\s*([+\-−]?\d+(?:\.\d+)?)\s*%/g)) {
    const stated = Number(match[1].replace('−', '-'));
    if (Math.abs(stated) > 25) { issues.push('change-implausible'); continue; }
    // A multi-day change quoted from the regime context (e.g. 20일 변화) is supported by that context.
    const inContext = context && context.includes(String(Math.abs(stated)));
    if (changes.size && !inContext && ![...changes.values()].some((value) => Math.abs(Math.abs(value) - Math.abs(stated)) <= 0.15)) issues.push('change-unsupported');
  }
  return [...new Set(issues)];
}

function analysisContextHasNumber(context, value) {
  if (!context || !Number.isFinite(value)) return false;
  const forms = new Set([String(value), value.toLocaleString('en-US', { maximumFractionDigits: 6 })]);
  return [...forms].some((form) => new RegExp(`(?<![\\d.,-])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`).test(context));
}

const ANALYSIS_REFERENCE_LEVEL = /^\s*[(（]?\s*(?:\d+\s*일\s*(?:선|이동평균|평균)|이동평균|이평|고점|저점|평균|전일|직전|지지|저항|대비|52주)/;
export function analysisNumberMarkedAsReference(body, value) {
  const forms = new Set([String(value), Number(value).toLocaleString('en-US', { maximumFractionDigits: 6 })]);
  const text = String(body || '');
  for (const form of forms) {
    const pattern = new RegExp(`(?<![\\d.,-])${form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`, 'g');
    let match;
    while ((match = pattern.exec(text))) {
      const before = text.slice(Math.max(0, match.index - 16), match.index);
      if (/(?:일선|이동평균|이평|고점|저점|평균|전일|직전|지지|저항|52주)\s*$|(?:일선|이동평균|고점|저점)\D{0,6}$/.test(before)) return true;
      if (ANALYSIS_REFERENCE_LEVEL.test(text.slice(match.index + match[0].length))) return true;
    }
  }
  return false;
}

// v57.81: a reading attributes a cause when one clause names the news it rests on and does not refuse it in the same
// clause. The prompt asks for a hedge ("가능한 해석 중 하나"), and a hedge after a comma or 지만 ("…가 배경으로 거론됐지만,
// 확정 원인은 확인되지 않았다") is not a refusal of the clause that attributes. "속보"·"뉴스" are the prompt's own labels for
// the post-08:00 headlines. A bare refusal ("보도만으로는 원인을 단정할 수 없다") still does not count (v57.75).
const ATTRIBUTION_MARKER = /헤드라인|보도|기사|언론|속보|뉴스|according to|headline|reported/i;
const ATTRIBUTION_REFUSAL = /단정할\s?수\s?없|알\s?수\s?없|확인되지\s?않/;
export function analysisAttributesCause(body) {
  return String(body || '').replace(/\[[^\]]*\]/g, '').split(/(?<=[.?!。])\s+|\n+/)
    .some((sentence) => sentence.split(/[,，;；]|(?<=지만|으나|는데|면서)\s/)
      .some((clause) => ATTRIBUTION_MARKER.test(clause) && !ATTRIBUTION_REFUSAL.test(clause)));
}

// v57.81 (owner 2026-10-15): the published reading said 「미국은 인공지능 인프라·반도체가 거시 부담에도 주도」 the week the
// Nasdaq-100 fell 3.9% in five sessions and the Russell 2000 slipped under its 200-day line. While the regime context
// carries the leadership-break flag (regime-scenarios renderMarketScenarioContext), a sentence saying semis/AI lead is
// rejected unless it names the recent drop. Narrow on purpose: quoted titles and conditional sentences are not claims.
export const LEADERSHIP_BREAK_FLAG = /주도 영역 이탈\(leadershipBreak\): (?:예|확산 미확인)/; // v57.83: weak leaders count too
const LEADER_SUBJECT = /반도체|인공지능|(?<![A-Za-z])AI(?![A-Za-z])|빅테크|대형 기술주/;
const LEADS_CLAIM = /주도|이끌|이끄|견인|앞장/;
const LEADER_DROP_NAMED = /하락|급락|약세|밀리|밀려|밀렸|떨어|꺾이|꺾여|꺾였|조정|낙폭|약해|부진|이탈|[-−]\s?\d/;
const LEADER_CONDITIONAL = /(?:하면|한다면|할\s?경우|는지|인지|일지|할지)/;
export function leadershipClaimIssues(body, { context = '', leadershipBreak = LEADERSHIP_BREAK_FLAG.test(String(context || '')) } = {}) {
  if (!leadershipBreak) return [];
  const asserted = String(body || '').replace(/\[[^\]]*\]|「[^」]*」|'[^']*'|"[^"]*"/g, '');
  const claim = asserted.split(/(?<=[.?!。])\s+|\n+/).some((sentence) => LEADER_SUBJECT.test(sentence) && LEADS_CLAIM.test(sentence)
    && !LEADER_DROP_NAMED.test(sentence) && !LEADER_CONDITIONAL.test(sentence));
  return claim ? ['leadership-claim-during-break'] : [];
}

// v57.81 (portfolio/KR audit): the reading said "신용 스프레드 확대가 부담" while the packet's credit axis was 중립. A state
// word for an axis must match the axis state the packet (REGIME_CONTEXT "id: state — …" lines) carries; conditional and
// quoted sentences are not claims. Only 양호/안정 and 부담 are checked — plain descriptions ("낮지만") are left alone.
const AXIS_CLAIMS = Object.freeze([
  ['credit', /(?:신용|스프레드|하이일드|HY)[^.。\n,]{0,14}?(부담|스트레스|안정|양호)/],
  ['trend', /추세(?:는|가|도)?\s?(양호|부담)/],
  ['volatility', /변동성(?:은|이|도)?\s?(?:지표\s?)?(안정|양호|부담)/],
  ['rates', /(?:장기)?금리(?:는|가|도)?\s?(?:상승이\s?)?(양호|부담)/],
  ['breadth', /시장\s?폭(?:은|이|도)?\s?(양호|부담)/]
]);
const CLAIM_STATE = Object.freeze({ 부담: 'burden', 스트레스: 'burden', 안정: 'favorable', 양호: 'favorable' });
const CLAIM_CONDITIONAL = /(?:하면|한다면|할\s?경우|된다면|되면|는지|인지|수\s?있|지\s?않|아니)/;
export function packetAxisStates(context = '') {
  const states = {};
  for (const match of String(context || '').matchAll(/^(trend|breadth|volatility|rates|credit|commodities|korea): (favorable|neutral|burden|unknown)\b/gm)) states[match[1]] = match[2];
  return states;
}
export function axisStateClaimIssues(body, { context = '' } = {}) {
  const states = packetAxisStates(context);
  if (!Object.keys(states).length) return [];
  const asserted = String(body || '').replace(/\[[^\]]*\]|「[^」]*」|'[^']*'|"[^"]*"/g, '');
  const issues = [];
  for (const sentence of asserted.split(/(?<=[.?!。])\s+|\n+/)) {
    if (CLAIM_CONDITIONAL.test(sentence)) continue;
    for (const [axis, pattern] of AXIS_CLAIMS) {
      const claimed = CLAIM_STATE[sentence.match(pattern)?.[1]];
      if (claimed && states[axis] && states[axis] !== 'unknown' && states[axis] !== claimed) issues.push(`axis-state-contradiction:${axis}`);
    }
  }
  return [...new Set(issues)];
}

// v57.81: a sentence that sets the Korean and US markets side by side while their latest closes are different sessions
// (KOSPI 10/15 vs S&P 500 10/14) names both dates ("10/15", "10월 15일").
const KR_MARKET = /코스피|코스닥|KOSPI|KOSDAQ|한국\s?증시/i;
const US_MARKET = /S&P|에스앤피|나스닥|다우|미국\s?(?:증시|주식|지수|주가)|뉴욕\s?증시/i;
const dateForms = (iso) => {
  const [, m, d] = String(iso || '').split('-').map(Number);
  return m && d ? [`${m}/${d}`, `${m}월 ${d}일`, `${m}월${d}일`] : [];
};
export function crossMarketDateIssues(body, { krDate = null, usDate = null } = {}) {
  if (!krDate || !usDate || krDate === usDate) return [];
  const asserted = String(body || '').replace(/\[[^\]]*\]/g, '');
  const missing = asserted.split(/(?<=[.?!。])\s+|\n+/).some((sentence) => KR_MARKET.test(sentence) && US_MARKET.test(sentence) && /\d/.test(sentence)
    && !(dateForms(krDate).some((form) => sentence.includes(form)) && dateForms(usDate).some((form) => sentence.includes(form))));
  return missing ? ['cross-market-session-dates-missing'] : [];
}

// v57.81 (themes audit): a theme or sector the packet itself shows down 3% or more over five sessions is not called
// "주도" unless the sentence names that drop. Five-session returns come from the packet only: the sector rotation rows
// (data.rotationHistory weeklyPct) and theme lines carrying "5거래일 x%" (theme-playbook.js context, rotation text).
export const THEME_LEAD_DROP_PCT = -3;
const SECTOR_ETF_WORDS = Object.freeze({
  SMH: ['반도체'], XLK: ['기술주', '정보기술', '기술 섹터', '기술 업종'], IGV: ['소프트웨어'], XLE: ['에너지'], XLF: ['금융'], XLV: ['헬스케어'],
  XLI: ['산업재'], XLY: ['임의소비재', '경기소비재'], XLP: ['필수소비재'], XLU: ['유틸리티'], XLB: ['소재'], XLRE: ['부동산', '리츠'], XLC: ['통신서비스']
});
function packetFiveSessionMoves({ context = '', data = null } = {}) {
  const moves = [];
  for (const [symbol, row] of Object.entries(data?.rotationHistory?.items || {})) {
    const value = Number(row?.weeklyPct);
    if (row && row.weeklyPct != null && Number.isFinite(value)) moves.push({ names: [symbol, ...(SECTOR_ETF_WORDS[symbol] || [])], value });
  }
  const text = String(context || '');
  const add = (label, raw) => {
    const value = Number(String(raw).replace('−', '-'));
    if (!Number.isFinite(value)) return;
    const names = String(label).split('/').map((part) => part.trim()).filter((part) => part.length >= 2);
    moves.push({ names: [...names, ...names.filter((name) => /(?<![A-Za-z])AI(?![A-Za-z])/.test(name)).map((name) => name.replace(/(?<![A-Za-z])AI(?![A-Za-z])/, '인공지능'))], value });
  };
  for (const match of text.matchAll(/^- \[(?:US|KR)\] ([^:\n]+): [^\n]*?5거래일 ([+\-−]?\d+(?:\.\d+)?)%/gm)) add(match[1], match[2]);
  // "강한 쪽 광통신/포토닉스(+4.8%, 5거래일 -13.8%)": the name is the last word (or two, for "AI 인프라/…") before "(".
  for (const match of text.matchAll(/([가-힣A-Za-z0-9/ ]{2,40})\([^()\n]*?5거래일 ([+\-−]?\d+(?:\.\d+)?)%/g)) {
    const words = match[1].trim().split(/\s+/);
    add(words.at(-1), match[2]);
    if (words.length >= 2 && /^[A-Za-z]{1,4}$/.test(words.at(-2))) add(words.slice(-2).join(' '), match[2]); // "AI 인프라/…"
  }
  return moves;
}
const THEME_LEAD_CONDITIONAL = /(?:다면|하면|되면|할\s?경우|는지|인지|일지|할지)/;
export function themeLeadClaimIssues(body, { context = '', data = null } = {}) {
  const dropped = packetFiveSessionMoves({ context, data }).filter((move) => move.value <= THEME_LEAD_DROP_PCT);
  if (!dropped.length) return [];
  const asserted = String(body || '').replace(/\[[^\]]*\]|「[^」]*」|'[^']*'|"[^"]*"/g, '');
  const issues = [];
  for (const sentence of asserted.split(/(?<=[.?!。])\s+|\n+/)) {
    if (!LEADS_CLAIM.test(sentence) || LEADER_DROP_NAMED.test(sentence) || THEME_LEAD_CONDITIONAL.test(sentence)) continue;
    for (const move of dropped) {
      const name = move.names.find((word) => sentence.includes(word));
      if (name) issues.push(`theme-lead-claim-after-5d-drop:${name}`);
    }
  }
  return [...new Set(issues)];
}

export function validateMarketAnalysisText(text, data, snapshot = null, { context = '', history = [] } = {}) {
  const issues = [];
  // P1122: `warnings` never withholds the analysis; it names what the reader must treat
  // carefully. Blocking is reserved for claims that can be wrong (values, units, scale).
  const warnings = [];
  const value = Number(data?.macro?.nfp);
  const body = String(text || '').trim();
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  if (!body) issues.push('empty');
  if (metricEvidence.length < 2) issues.push('metric-evidence-insufficient');
  const changes = new Map((snapshot?.quotes || []).filter(row => row?.evidenceId && Number.isFinite(Number(row.changePct))).map(row => [row.evidenceId, Number(row.changePct)]));
  const closedBasis = buildCompletedCloseBasis(metricEvidence, history);
  const levelTolerance = (unit, value) => Math.max(unit === 'percent' ? 0.15 : 0.5, Math.abs(Number(value)) * 0.02);
  issues.push(...validateAnalysisAdmission(body, { changes, context }));
  // P1372: "a concise Korean market analysis" produced an English analysis *of the Korean
  // market*. The product is Korean; English prose is not publishable.
  // P1585: count prose only — the prompt asks for evidence ids, and tickers (SPX, VIX, DXY, WTI)
  // are Latin by nature, so a Korean answer that cites them was read as English.
  const allMetricLabels = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]
    .flatMap(def => [def.label, ...(def.aliases || [])]);
  // P1594: remove known metric labels, not arbitrary uppercase English sentences.
  const prose = analysisProse(body, allMetricLabels);
  const hangul = (prose.match(/[가-힣]/g) || []).length;
  const latin = (prose.match(/[A-Za-z]/g) || []).length;
  if (body && latin >= 30 && hangul < latin * 0.6) issues.push('language-not-korean');
  for (const row of metricEvidence) {
    if (!row.session || MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session)) continue;
    const label = String(row.label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wording = label ? body.match(new RegExp(`${label}((?:(?![.。,]\\s|\\n|이고|이며|[A-Z]{2,}).){0,40})(?:마감|종가|closed|closing|close at)`)) : null;
    if (!wording) continue;
    // v57.81: "종가" is right when the number it qualifies is the last completed close (or its change), not the in-session value.
    const closed = closedBasis.get(row.evidenceId);
    const tail = body.slice(wording.index + wording[0].length, wording.index + wording[0].length + 16).split(/[,，;；\n]|(?<!\d)[.。](?!\d)/)[0]; // "10/14 종가 16.87"
    const quotesClose = closed && [...`${wording[1]} ${tail}`.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((match) => Number(match[0].replace(/,/g, '')))
      .some((number) => Math.abs(number - closed.value) <= levelTolerance(row.unit, closed.value) || Math.abs(number - Math.abs(closed.changePct)) <= 0.15);
    if (!quotesClose) issues.push(`session-wording-mismatch:${row.metricId}`);
  }
  // Proximity is an ambiguity signal, not a false number: a correct sentence that lists
  // VIX and Fear & Greed together is not a fabrication. The precise guard is
  // `metric-value-mismatch`, which compares the stated number with its own evidence row.
  if (/(?:VIX[\s\S]{0,60}(?:Fear\s*&?\s*Greed|fear\s+and\s+greed)|(?:Fear\s*&?\s*Greed|fear\s+and\s+greed)[\s\S]{0,60}VIX)/i.test(body)) {
    warnings.push('metric-identity-proximity:vix-vs-fear-greed');
  }
  for (const def of [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS]) {
    const row = metricEvidence.find(item => item.metricId === def.metricId);
    if (!row) continue;
    const levels = analysisLevelsAfterLabels(body, [def.label, ...(def.aliases || [])], { allLabels: allMetricLabels, unit: row.unit });
    // Tolerance follows the unit the evidence actually carries (canonical snapshot
    // unit when available), not the duplicated def table.
    const tolerance = levelTolerance(row.unit, row.value); // P1585: 5% let SPX 7,500 pass for 7,816
    // P1719: the same context exception as validateAnalysisMetricMentions (a value quoted from REGIME_CONTEXT), bounded to
    // a whole number so "10" does not pass because "100" or "2026-10" appears somewhere in the context.
    // Review: the exception also needs the text to mark the number as a reference level (moving average, high, prior
    // close …) so a context value written as the current level ("S&P 500 7,650") is still blocked.
    const referenced = (mentioned) => analysisContextHasNumber(context, mentioned) && analysisNumberMarkedAsReference(body, mentioned);
    // v57.81: an in-session row also accepts its last completed close (buildCompletedCloseBasis).
    const closed = closedBasis.get(row.evidenceId);
    const atClose = (mentioned) => !!closed && Math.abs(mentioned - closed.value) <= levelTolerance(row.unit, closed.value);
    if (levels.some(mentioned => Math.abs(mentioned - Number(row.value)) > tolerance && !atClose(mentioned) && !referenced(mentioned))) issues.push(`metric-value-mismatch:${def.metricId}`);
  }
  // T03/T08: % moves against each metric's own changePct, rates in bp only, Korean metric names, 장중 + time for in-session values.
  issues.push(...validateAnalysisMetricMentions(body, metricEvidence, changes, { context, closedBasis }));
  // PAYEMS delta is stored in thousands. A model may mention NFP without a
  // number, but if it writes one, reject the known 10x forms before publish.
  if (Number.isFinite(value) && /NFP|nonfarm|비농업|고용/i.test(body)) {
    const abs = Math.abs(value);
    const fmt = (n) => String(Math.round(n * 100) / 100).replace(/\.0+$/, '');
    const wrongTenThousand = new RegExp(`\\b${fmt(abs)}\\s*만(?:명)?`, 'i');
    const wrongThousands = new RegExp(`\\b${fmt(abs * 10)}\\s*(?:천|k)\\b`, 'i');
    const wrongPersons = new RegExp(`\\b${fmt(abs * 10000).replace('.', '[.,]?')}\\s*명?\\b`, 'i');
    if (wrongTenThousand.test(body) || wrongThousands.test(body) || wrongPersons.test(body)) {
      issues.push('nfp-scale-mismatch');
    }
  }
  const nfpMention = _analysisNumberAfterLabel(body, ['NFP', 'nonfarm payroll']);
  if (Number.isFinite(value) && Number.isFinite(nfpMention) && Math.abs(nfpMention) > Math.max(1, Math.abs(value)) * 100) {
    issues.push('nfp-scale-mismatch');
  }
  // P1139/QA-EXHAUST-80: the causal detector was an English word list, so Korean causal prose
  // ("금리 우려 때문입니다") was never recognised as causal and the attribution disclosure below
  // could not fire for the language most of this product's narrative is written in. The Korean
  // branch is a separate regex on purpose: `\b` is ASCII-anchored and never matches around Hangul,
  // so wrapping both languages in one `\b(?:…)\b` would silently disable the Korean half.
  const causalClaimEn = /\b(?:because|due to|driven by|led by|after|following|amid|risk|supports?|weakened|strengthened)\b/i
    .test(body);
  const causalClaimKo = /(?:때문|원인|이유|영향|배경|여파|기인|인해|인한|따른|우려|주도|견인)/.test(body);
  const causalClaim = causalClaimEn || causalClaimKo;
  // P1122: article-level causal evidence is impossible under the declared headline-only
  // rights policy, so its absence is a disclosure, not a refusal. What IS required is
  // attribution — a causal sentence must name the headline it rests on. The value and
  // NFP-scale fabrication checks above stay blocking.
  const causalEvidence = buildMarketAnalysisNewsEvidence(data);
  const headlineContext = buildMarketAnalysisHeadlineContext(data);
  // v57.69 (2026-10-15 crash audit): on 10/14 (S&P 500 -1.11%, KOSPI -5%) the published reading carried no cause at all
  // while the retained headlines named hot CPI and AI selling. On a large move with headlines available, an
  // unattributed reading is blocked (the retry is told to name the headline); on a quiet day it stays a disclosure.
  const largeMove = metricEvidence.some((row) => {
    const move = changes.get(row.evidenceId);
    if (row.metricId !== 'market.spx' && row.metricId !== 'market.kospi') return false; // equity indices only (a 1% VIX move is noise)
    return Number.isFinite(move) && Math.abs(move) >= (row.metricId === 'market.kospi' ? KOREA_MOVE_MENTION_PCT : LARGE_MOVE_ATTRIBUTION_PCT);
  });
  // v57.75 (AI pipeline audit): the check read the raw body, so a citation id ("[headline:...]") counted as attribution and
  // a sentence that refused to name any cause ("원인으로 단정할 수 없습니다") passed on a −7.8% KOSPI day. It now reads the
  // prose without citation brackets and needs one attributing sentence that is not a refusal.
  const attributed = analysisAttributesCause(body);
  if (largeMove && headlineContext.length > 0 && !attributed) issues.push('causal-attribution-missing');
  else if (causalClaim && causalEvidence.length === 0) {
    if (headlineContext.length === 0) warnings.push('causal-evidence-missing');
    else if (!attributed) warnings.push('causal-attribution-missing');
  }
  // v57.69: the reading said 장기금리 하락은 "물가 둔화 경로와 일치" the day CPI rose 3.4% → 3.7%. With headline or core
  // CPI rising, an assertion that inflation is easing is blocked; scenario titles in 「」 and conditionals are not assertions.
  const macroNow = data?.macro || {};
  const inflationRising = Number(macroNow.cpiDelta) > 0 || Number(macroNow.coreCpiDelta) > 0;
  const asserted = body.replace(/「[^」]*」|'[^']*'|"[^"]*"/g, '');
  if (inflationRising && /물가\s?둔화\s?(?:경로|흐름|추세|신호)|물가(?:가|는)?\s?(?:둔화|안정|완화)(?:되고|하고)\s?있|인플레이션(?:이|은)?\s?(?:둔화|완화)(?:되고|하고)\s?있|디스인플레이션\s?(?:경로|흐름|진행)/.test(asserted)) {
    issues.push('inflation-direction-contradicts-evidence');
  }
  // v57.81: while REGIME_CONTEXT carries the leadership break, "semis/AI lead" needs the recent drop in the same sentence.
  issues.push(...leadershipClaimIssues(body, { context }));
  // v57.81: axis state words follow the packet; a Korea-vs-US comparison across different sessions carries both dates.
  issues.push(...axisStateClaimIssues(body, { context }));
  const krDate = buildCloseSeries(history, 'kospi').at(-1)?.date || null;
  const usDate = buildCloseSeries(history, 'spx').at(-1)?.date || null;
  issues.push(...crossMarketDateIssues(body, { krDate, usDate }));
  // v57.81 (themes audit): no "주도" for a theme/sector the packet shows down 3% or more over five sessions.
  issues.push(...themeLeadClaimIssues(body, { context, data }));
  // v57.69: a KOSPI move of 3% or more (in session or closed) is named — the Korean readers' first question on 10/15.
  if (metricEvidence.some((row) => row.metricId === 'market.kospi' && Math.abs(changes.get(row.evidenceId)) >= KOREA_MOVE_MENTION_PCT)
    && !/코스피|코스닥|KOSPI|KOSDAQ/i.test(body)) issues.push('korea-move-unaddressed');
  issues.push(...priorSessionMoveIssues(body, { context }));
  issues.push(...noLeadIssues(body, { context }));
  return {
    ok: issues.length === 0,
    issues: Array.from(new Set(issues)),
    warnings: Array.from(new Set(warnings)),
    metricEvidence,
    causalEvidenceCount: causalEvidence.length,
    headlineCount: headlineContext.length,
  };
}

// AI commentary shares the Worker budget with chat and translation (P1421).

const MARKET_ANALYSIS_NEWS_HEADLINE_DEPTHS = new Set(['', 'headline', 'headline-only', 'title-only', 'snippet']);

// P1119 (S9): the news pipeline retains feed headlines and links only. Preserving
// publisher excerpts was rejected on source-rights grounds, so article-level causal
// evidence is never available. P1122 keeps that rights boundary but stops treating its
// absence as a reason to withhold the narrative: directional/causal prose is published
// from the retained headlines plus typed metrics, with explicit attribution and a
// disclosure, instead of being dropped for a body we deliberately never keep.
export const MARKET_ANALYSIS_NEWS_CONTENT_POLICY = Object.freeze({
  schemaVersion: 'news-content-policy.v1',
  retainedDepth: 'headline-only',
  excerptRetention: 'not-permitted-source-rights',
  causalNarrative: 'headline-attributed-with-disclosure',
  rationale: 'RSS feeds grant headline/link reuse only; article bodies are never redistributed. Directional and causal commentary is published from retained headlines and typed metrics with explicit attribution, never as an unsourced assertion.',
});

// Only rows with an explicit non-headline content contract and substantive
// text may support causal/AI market analysis.  RSS title rows deliberately
// remain usable by currentness/discovery surfaces but fail closed here.
// Under MARKET_ANALYSIS_NEWS_CONTENT_POLICY no producer lane sets a non-headline
// depth, so this predicate returns false for every published row by design.
export function isMarketAnalysisNewsEligible(row) {
  const depth = String(row?.contentDepth || '').trim().toLowerCase().replace(/_/g, '-');
  if (MARKET_ANALYSIS_NEWS_HEADLINE_DEPTHS.has(depth)) return false;
  const body = String(row?.content || row?.body || row?.description || row?.summary || row?.excerpt || row?.desc || '').trim();
  return body.length >= 40;
}

export function buildMarketAnalysisNewsEvidence(data) {
  const rows = Array.isArray(data?.news) ? data.news : [];
  const clusters = new Set();
  return rows
    .filter(row => row && row.title && row.source && row.link && _validIsoDate(row.eventTime || row.pubDate) && isMarketAnalysisNewsEligible(row))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .map(row => {
      const observedAt = _validIsoDate(row.eventTime || row.pubDate);
      const clusterId = String(row.independenceKey || row.source || row.topic || 'unknown').toLowerCase();
      if (clusters.has(clusterId)) return null;
      clusters.add(clusterId);
      return {
        evidenceId: `news:${row.link}:${observedAt}`,
        clusterId,
        title: String(row.title).slice(0, 240),
        source: row.source,
        sourceKind: row.sourceKind || 'news-feed',
        contentDepth: String(row.contentDepth || '').trim(),
        evidenceBasis: 'article-content-or-excerpt',
        observedAt,
        collectedAt: data?.meta?.generatedAt || null,
        link: row.link,
        allowedUse: 'causal-reference',
        status: 'observed',
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

// P1122: retained headlines are not causal evidence, but they are the news material the
// narrative is allowed to cite by name ("헤드라인에 따르면 …"). Keeping them separate from
// `newsEvidence` preserves the rights boundary while giving the model something real to
// attribute instead of forcing an observation-only summary.
export function buildMarketAnalysisHeadlineContext(data) {
  const rows = Array.isArray(data?.news) ? data.news : [];
  const seen = new Set();
  return rows
    .filter(row => row && row.title && row.source && _validIsoDate(row.eventTime || row.pubDate))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .filter(row => {
      const key = String(row.link || row.title).slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map(row => {
      const observedAt = _validIsoDate(row.eventTime || row.pubDate);
      return {
        evidenceId: `headline:${row.link || row.title}:${observedAt}`,
        title: String(row.title).slice(0, 240),
        source: row.source,
        contentDepth: 'headline-only',
        evidenceBasis: 'headline-title',
        observedAt,
        link: row.link || null,
        allowedUse: 'reference',
        status: 'observed',
      };
    });
}

function _marketAnalysisSummary(text) {
  // P1372: a markdown heading ("# ... Analysis") is not analysis text and must not become the one-liner.
  return String(text || '').trim().split(/\n+/).map(line => line.trim()).filter((line) => line && !/^#{1,6}\s/.test(line)).join('\n').slice(0, 2400);
}

function _marketAnalysisOneLine(summary) {
  return String(summary || '').split(/\n+/).map(line => line.trim()).filter(Boolean)[0] || '';
}

export function buildStructuredMarketAnalysis({ data, text, model, status, reason, metricEvidence, newsEvidence, semantic }) {
  const evidenceIds = [...metricEvidence, ...newsEvidence].map(row => row.evidenceId);
  const summary = _marketAnalysisSummary(text);
  const oneLine = _marketAnalysisOneLine(summary);
  const claims = summary ? [{
    id: 'market-summary-1',
    text: summary,
    claimType: 'summary',
    evidenceIds,
    status: status === 'verified' ? 'validated' : 'blocked',
  }] : [];
  return {
    schemaVersion: 'market-analysis.v2',
    status,
    reason: status === 'verified' ? null : reason || 'analysis-unavailable',
    summary,
    full: summary,
    oneLine,
    regime: { label: status === 'verified' ? 'MODEL_SUMMARY' : 'UNKNOWN', status, evidenceIds: metricEvidence.map(row => row.evidenceId) },
    drivers: status === 'verified' ? [{ label: 'validated summary drivers', evidenceIds }] : [],
    risks: status === 'verified' ? [{ label: 'validated summary risks', evidenceIds }] : [],
    watch: [{ label: status === 'verified' ? 'monitor cited evidence' : 'await validated market analysis', evidenceIds }],
    claims,
    evidenceIds,
    generatedAt: new Date().toISOString(),
    model: model || 'none',
    validatorVersion: 'market-analysis-validator.v3',
    semanticStatus: semantic?.ok && status === 'verified' ? 'verified' : 'blocked',
    semanticIssues: semantic?.issues || [reason || 'analysis-unavailable'],
    metricEvidence,
    newsEvidence,
    headlineContext: buildMarketAnalysisHeadlineContext(data),
    causalEvidenceCount: semantic?.causalEvidenceCount || 0,
    semanticWarnings: semantic?.warnings || [],
    newsContentPolicy: MARKET_ANALYSIS_NEWS_CONTENT_POLICY,
    // P1122: the narrative is published, but the reader is told what it may and may not
    // rest on and who owns the decision.
    disclosure: status === 'verified'
      ? '헤드라인 제목과 검증된 지표만 사용했습니다. 기사 본문은 출처 권리상 사용하지 않으므로 인과·방향 서술은 헤드라인 귀속 기반의 참고 해석이며, 최종 판단과 책임은 사용자에게 있습니다.'
      : null,
    reason: reason || null,
  };
}

// v57.87: REGIME_CONTEXT names a completed close that moved 3% in a session or 8% over five (priorSessionMoveLines);
// the reading names that index with the close's date. A text about the next session's rebound alone left out the crash.
export function priorSessionMoveIssues(body, { context = '' } = {}) {
  const line = String(context || '').match(/^직전 완료 세션의 큰 움직임: ([^\n]*?) — /m);
  if (!line) return [];
  const text = String(body || '');
  for (const match of line[1].matchAll(/(S&P 500|코스피|WTI) (\d{1,2}\/\d{1,2}) 종가/g)) {
    const name = match[1] === '코스피' ? /코스피|KOSPI/i : match[1] === 'WTI' ? /WTI|서부\s?텍사스유|유가/i : /S&P\s?500|S&P|에스앤피/i;
    if (!name.test(text) || !new RegExp(String.raw`(?<![\d/])${match[2].replace('/', '\\/')}(?!\d)`).test(text)) return ['prior-session-move-omitted'];
  }
  return [];
}

// v57.87 (10/16 audit): the screen said no flow and no central scenario qualified ("보기 이릅니다", "중심 시나리오를
// 정하지 않습니다") while the reading named 「소수 종목 주도」 as the closest flow and a favoured choice. When the context holds
// that verdict, the reading carries it in its own words.
export function noLeadIssues(body, { context = '' } = {}) {
  if (!/보기 이릅니다|중심 시나리오를 정하지 않습니다/.test(String(context || ''))) return [];
  return /이르|이릅|정하지 않|중심\s?(?:흐름|시나리오)(?:이|가|은|는)?\s?없|핵심 조건(?:이|은|는)?\s?(?:미충족|갖춰지지|충족되지)|판단을 보류/.test(String(body || '')) ? [] : ['no-lead-overstated'];
}

// v57.69: retry guidance for the rules that carry no metric id.
const MARKET_ANALYSIS_ISSUE_HELP = Object.freeze({
  'causal-attribution-missing': 'the market moved sharply; name at least one HEADLINE_CONTEXT headline as the reported cause ("헤드라인에 따르면 …", "… 보도") and keep it one reading among alternatives',
  'inflation-direction-contradicts-evidence': 'CPI or core CPI rose in the latest release; do not describe inflation as easing — describe the rate move without an inflation-easing claim',
  'korea-move-unaddressed': 'KOSPI moved 3% or more; add one line on it with its change (장중이면 "장중 HH:MM KST 기준")',
  'no-lead-overstated': 'REGIME_CONTEXT says no flow or central scenario qualifies yet; say so first ("아직 중심 흐름·시나리오를 정하기 이르다"), mention the best-matching one only with "핵심 조건 미충족", and do not name a favoured choice',
  'prior-session-move-omitted': 'REGIME_CONTEXT lists a large completed-close move (직전 완료 세션의 큰 움직임); name that index with its close date (M/D) and change in one of the first two lines, separately from any in-session move',
  'axis-state-contradiction': 'a state word (양호/안정/부담) contradicts the axis state in REGIME_CONTEXT; use the packet state for that axis',
  'cross-market-session-dates-missing': 'KOSPI and the US index closed on different sessions; name both dates (M/D) in the sentence that compares them',
  'theme-lead-claim-after-5d-drop': 'the packet shows that theme or sector down 3% or more over the last five sessions; do not say it leads (주도) — name its five-session drop in that sentence or describe it as a longer-window lead under pressure',
  'leadership-claim-during-break': 'REGIME_CONTEXT says 주도 영역 이탈(leadershipBreak): 예; do not say semiconductors/AI lead — name the recent drop of the leaders (나스닥 100 5거래일 변화) and the Russell 2000 against its 200-day line in that sentence'
});

// P1719: what the validator blocked, in terms the model can act on — the issue, the metric's evidence value and change,
// and the level the validator read after the label. Appended once to the retry prompt.
export function describeMarketAnalysisIssues(text, issues = [], metricEvidence = [], changes = new Map()) {
  const defs = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS];
  const allLabels = defs.flatMap((def) => [def.label, ...(def.aliases || [])]);
  return [...new Set(issues)].slice(0, 8).map((issue) => {
    const metricId = String(issue).split(':')[1] || '';
    const row = metricEvidence.find((item) => item.metricId === metricId);
    const help = MARKET_ANALYSIS_ISSUE_HELP[issue] || MARKET_ANALYSIS_ISSUE_HELP[String(issue).split(':')[0]]; // v57.81: axis-keyed issues
    if (!row) return `- ${issue}${help ? `: ${help}` : ''}`;
    const def = defs.find((item) => item.metricId === metricId);
    const read = def ? analysisLevelsAfterLabels(text, [def.label, ...(def.aliases || [])], { allLabels, unit: row.unit }) : [];
    const change = changes.get(row.evidenceId);
    const changeText = Number.isFinite(change)
      ? (row.unit === 'percent' ? `, change ${((row.value - row.value / (1 + change / 100)) * 100).toFixed(1)}bp` : `, change ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`)
      : '';
    return `- ${issue}: evidence ${row.label}=${row.value} ${row.unit}${changeText} (${row.evidenceId})${read.length ? `; the text was read as ${read.join(', ')}` : ''}`;
  }).join('\n');
}

export const MARKET_ANALYSIS_RETAIN_MAX_MS = 12 * 3600000;
// P1719 (coordinator decision 2026-10-13): when the retry is also blocked, the previous verified analysis is kept for up
// to 12 hours from its own generatedAt. It keeps status/semanticStatus 'verified' (every consumer — client sink,
// meta.marketAnalysisOk, operations status — reads those) and carries `retained` so a surface can say
// "HH:MM 기준 직전 검증본". Older than 12 hours, or never verified, falls through to the blocked fallback.
// v57.75 (AI pipeline audit): a calm overnight reading survived a −7.8% KOSPI session because the retained text was
// never re-checked against this run's data. `revalidate(summary)` (this run's validator) must pass before retaining.
// v57.81 (10/15 crash day): the 05:52Z verified reading said "코스피 장중 14:31 KST 기준 -8.28%". Three minutes later KOSPI
// stood at -8.49%, so re-checking that time-stamped sentence against the new tick failed (metric-change-mismatch:kospi),
// the reading was dropped, and the blocked fallback replaced it; every later run then had no verified reading to keep.
// A retained reading is shown with its own time ("HH:MM 기준 직전 검증본"), so a value/change it quoted for an observation
// that has since been replaced is not an error while the market has moved less than a large move since then (1% for
// the equity indices, 3% otherwise). Every other rule (KOSPI move named, cause attributed, inflation direction) still
// re-runs on this run's data.
export const MARKET_ANALYSIS_RETAIN_DRIFT_PCT = Object.freeze({ equity: LARGE_MOVE_ATTRIBUTION_PCT, other: 3 });
export function retainedReadingIssues(previous, result) {
  const then = new Map((Array.isArray(previous?.metricEvidence) ? previous.metricEvidence : []).map((row) => [row?.metricId, row]));
  const now = new Map((Array.isArray(result?.metricEvidence) ? result.metricEvidence : []).map((row) => [row?.metricId, row]));
  return (Array.isArray(result?.issues) ? result.issues : []).filter((issue) => {
    const metricId = /^metric-(?:value|change)-mismatch:(.+)$/.exec(String(issue))?.[1];
    const before = metricId ? then.get(metricId) : null;
    const after = metricId ? now.get(metricId) : null;
    if (!before || !after || before.evidenceId === after.evidenceId) return true;
    const moved = Math.abs(Number(after.value) / Number(before.value) - 1) * 100;
    const limit = metricId === 'market.spx' || metricId === 'market.kospi' ? MARKET_ANALYSIS_RETAIN_DRIFT_PCT.equity : MARKET_ANALYSIS_RETAIN_DRIFT_PCT.other;
    return !(Number.isFinite(moved) && moved < limit);
  });
}

// v57.81: a blocked run carries the last verified reading as `lastVerified`, so one blocked run does not lose it for the
// runs after it. `revalidate(summary)` may return a boolean or this run's validator result (drift-filtered above).
export function retainVerifiedMarketAnalysis(previous, { reason, nowMs = Date.now(), revalidate = null } = {}) {
  const candidate = previous?.status === 'verified' ? previous : previous?.lastVerified || null;
  if (!candidate || candidate.status !== 'verified' || candidate.semanticStatus !== 'verified') return null;
  if (Array.isArray(candidate.semanticIssues) && candidate.semanticIssues.length) return null;
  const generatedMs = Date.parse(candidate.generatedAt || '');
  if (!Number.isFinite(generatedMs) || generatedMs > nowMs + 5 * 60000 || nowMs - generatedMs > MARKET_ANALYSIS_RETAIN_MAX_MS) return null;
  if (typeof revalidate === 'function') {
    const result = revalidate(String(candidate.full || candidate.summary || ''));
    if (!result || (typeof result === 'object' && retainedReadingIssues(candidate, result).length)) return null;
  }
  const { lastVerified: _lastVerified, sentence: _sentence, ...reading } = candidate;
  return {
    ...reading,
    retained: { at: new Date(nowMs).toISOString(), from: candidate.generatedAt, reason: String(reason || 'analysis-blocked').slice(0, 300), maxAgeHours: 12 },
  };
}

// v57.81: what a blocked artifact keeps for the next run — the verified reading itself, never a chain of them.
export function lastVerifiedMarketAnalysis(previous, nowMs = Date.now()) {
  const candidate = previous?.status === 'verified' ? previous : previous?.lastVerified || null;
  if (!candidate || candidate.status !== 'verified' || candidate.semanticStatus !== 'verified') return null;
  const generatedMs = Date.parse(candidate.generatedAt || '');
  if (!Number.isFinite(generatedMs) || nowMs - generatedMs > MARKET_ANALYSIS_RETAIN_MAX_MS) return null;
  const { lastVerified: _lastVerified, retained: _retained, sentence: _sentence, ...reading } = candidate;
  return reading;
}

// v57.81: the blocked fallback was "SPX=7718.94 index (2026-10-14T20:36:08.000Z)" — a code label and an ISO timestamp on a
// reader's surface. It now names each value in Korean with its session ("10/14 종가", "10/15 14:44 장중").
const MARKET_ANALYSIS_PLAIN_NAMES = Object.freeze({
  'market.spx': 'S&P 500', 'market.vix': 'VIX(변동성 지수)', 'market.us10y': '미국 10년물 금리', 'market.dxy': '달러 지수',
  'market.wti': 'WTI 유가', 'market.gold': '금', 'market.kospi': '코스피', 'macro.cpi': '미국 소비자물가(전년비)',
  'macro.fed-rate': '미국 기준금리', 'macro.nfp-mom': '미국 비농업 고용 증감', 'sentiment.fear-greed': '공포·탐욕 지수'
});
const _plainNumber = (value, unit) => {
  const text = Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (unit === 'percent') return `${text}%`;
  if (unit === 'thousands') return `${text}천 명`;
  if (unit === 'USD/barrel' || unit === 'USD/oz') return `${text}달러`;
  if (unit === 'score') return `${text}점`;
  return text;
};
const _partsIn = (iso, zone) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { md: `${Number(parts.month)}/${Number(parts.day)}`, hm: `${parts.hour}:${parts.minute}` };
};
export function plainMarketObservation(row) {
  const name = MARKET_ANALYSIS_PLAIN_NAMES[row?.metricId] || null;
  const ms = Date.parse(row?.observedAt || '');
  if (!name || !Number.isFinite(Number(row?.value)) || !Number.isFinite(ms)) return null;
  const value = _plainNumber(row.value, row.unit);
  if (/^macro\./.test(row.metricId)) {
    const month = new Date(ms).getUTCMonth() + 1;
    return `${name} ${value}(${month}월 기준)`;
  }
  if (row.metricId === 'sentiment.fear-greed') return `${name} ${value}(${_partsIn(row.observedAt, 'Asia/Seoul').md} 기준)`;
  const zone = MARKET_ANALYSIS_QUOTE_DEFS.find((def) => def.metricId === row.metricId)?.zone || 'America/New_York';
  if (!row.session || MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session)) return `${name} ${value}(${_partsIn(row.observedAt, zone).md} 종가)`;
  const kst = _partsIn(row.observedAt, 'Asia/Seoul');
  return `${name} ${value}(${kst.md} ${kst.hm} 장중)`;
}
export function plainMarketFallbackSummary(metricEvidence = []) {
  const observed = (Array.isArray(metricEvidence) ? metricEvidence : []).map(plainMarketObservation).filter(Boolean).slice(0, 4).join(' · ');
  return observed
    ? `이번 갱신의 시장 해석이 자동 검증을 통과하지 못해 확인된 지표만 보여 드립니다 — ${observed}. 해석은 다음 갱신에서 검증되면 다시 표시됩니다.`
    : '이번 갱신에는 확인된 지표가 부족해 시장 해석을 보류합니다.';
}

// Every 30-minute refresh used to call the model even when nothing it reads had moved (nights, weekends). A verified,
// un-flagged previous analysis under 12 h old whose metric/news evidence ids and headline ids equal this run's is
// reused as-is (its generatedAt keeps aging, so it still expires at 12 h). Anything else calls as before.

export function reusableMarketAnalysis(previous, { metricEvidence = [], newsEvidence = [], headlineContext = [], nowMs = Date.now() } = {}) {
  if (!previous || previous.status !== 'verified' || previous.semanticStatus !== 'verified') return null;
  if (Array.isArray(previous.semanticIssues) && previous.semanticIssues.length) return null;
  const generatedMs = Date.parse(previous.generatedAt || '');
  if (!Number.isFinite(generatedMs) || generatedMs > nowMs + 5 * 60000 || nowMs - generatedMs >= MARKET_ANALYSIS_RETAIN_MAX_MS) return null;
  const idSet = (rows) => JSON.stringify([...new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.evidenceId || '')))].sort());
  if (!Array.isArray(previous.metricEvidence) || !previous.metricEvidence.length) return null;
  if (idSet(previous.metricEvidence) !== idSet(metricEvidence)) return null;
  if (idSet(previous.newsEvidence) !== idSet(newsEvidence)) return null;
  if (idSet(previous.headlineContext) !== idSet(headlineContext)) return null;
  return previous;
}

// v57.71 (owner 2026-10-15): the home's operator note becomes "오늘의 한 문장" — one sentence that names the market's
// tension of the day ("오늘의 하락이 기회인가, 서사의 끝을 알리는 신호인가"). The same model call writes it on its last
// line; it carries no number, ticker or trade instruction, and it is fixed once per day from the 08:00 KST cycle so it
// does not change every 30-minute refresh.
export const MARKET_SENTENCE_LABEL = '오늘의 한 문장:';
// v57.75: the model sometimes wrote "**오늘의 한 문장:**", "오늘의 한 문장 :" or put the sentence on the next line;
// the strict prefix match missed those and the label leaked into the reading body.
const SENTENCE_LABEL_LINE = /^\s*(?:[-*]\s*)?(?:\*\*|__)?\s*오늘의\s*한\s*문장\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*/;
export function splitMarketSentence(text) {
  const lines = String(text || '').split('\n');
  const index = lines.findIndex((line) => SENTENCE_LABEL_LINE.test(line));
  if (index < 0) return { body: String(text || ''), sentence: null };
  let sentence = lines[index].replace(SENTENCE_LABEL_LINE, '').trim();
  const drop = new Set([index]);
  if (!sentence && index + 1 < lines.length && lines[index + 1].trim()) { sentence = lines[index + 1].trim(); drop.add(index + 1); }
  sentence = sentence.replace(/^(?:\*\*|__)|(?:\*\*|__)$/g, '').trim().replace(/^["“'「]|["”'」]$/g, '').trim();
  return { body: lines.filter((_, i) => !drop.has(i)).join('\n').trim(), sentence: sentence || null };
}
const SENTENCE_INSTRUCTION = /(?:사세요|사라|사야|매수|매도|팔아|팔세요|담아|담을|담으세요|들어가라|들어가세요|비중을\s?(?:늘|줄)|추천|확실히|반드시\s?오른|보장)/;
// v57.75: the sentence names no company or index (the card sits above every market), states no likelihood or certainty
// and no policy rescue, and cannot assert easing inflation while CPI is rising.
const SENTENCE_NAMES = /코스피|코스닥|나스닥|다우|에스앤피|S&P|엔비디아|삼성|하이닉스|애플|테슬라|마이크로소프트|알파벳|구글|아마존|메타|브로드컴|TSMC|코어위브/i;
const SENTENCE_CERTAINTY = /가능성|확률|틀림없|분명히|바닥은\s?이미|반등만|받쳐\s?줄|떠받칠|두려워할\s?필요/;
export function validateMarketSentence(sentence, { inflationRising = false } = {}) {
  const text = String(sentence || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 12 || text.length > 90 || !/[가-힣]/.test(text)) return null;
  if (/[0-9%$₩]/.test(text) || /\p{Extended_Pictographic}/u.test(text) || SENTENCE_INSTRUCTION.test(text)) return null;
  // Latin tickers in any case ("nvda", "Nvda") except the word AI.
  if ((text.match(/\b[A-Za-z]{2,5}\b/g) || []).some((word) => word.toUpperCase() !== 'AI')) return null;
  if (SENTENCE_NAMES.test(text) || SENTENCE_CERTAINTY.test(text)) return null;
  if (inflationRising && /물가(?:가|는)?\s?(?:둔화|안정|잡히|꺾|내려)/.test(text) && !/(?:면|라면|다면|는지|ㄹ지|을지|까)[\s?？]*$|인가|일까/.test(text)) return null;
  if ((text.match(/[.?!。？！]/g) || []).length > 2) return null;
  return text;
}
export const marketSentenceDay = (nowMs) => new Date(nowMs + 3600000).toISOString().slice(0, 10); // KST date of (now - 08:00)
// v57.75: the sentence was fixed at the first run after 08:00 KST, before the Korean session — a KOSPI crash at 10:00
// could never change it. A large move (KOSPI 3% or S&P 500 1%, see largeMove) allows one same-day replacement.
export function dailyMarketSentence({ candidate = null, previous = null, nowMs = Date.now(), largeMove = false, inflationRising = false } = {}) {
  const day = marketSentenceDay(nowMs);
  const sameDay = previous?.day === day && previous?.text;
  if (sameDay && !(largeMove && !previous.replaced)) return previous;
  const text = validateMarketSentence(candidate, { inflationRising });
  if (text) return { text, day, generatedAt: new Date(nowMs).toISOString(), source: 'shared-model', ...(sameDay ? { replaced: true } : {}) };
  return previous?.text ? previous : null;
}
