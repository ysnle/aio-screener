// Market-analysis evidence and validation split out of scripts/fetch-data.mjs (v57.62): the metric/news evidence the
// shared model may cite, the number/direction/admission validator (validator v3), the structured artifact shape, and
// the retain/reuse rules for a previous verified analysis. Pure: no network and no file I/O. fetch-data.mjs imports
// and re-exports them; genMarketAnalysis (the model call) stays in the producer.
import { round } from './producer-math.mjs';
import { analysisLevelsAfterLabels, analysisProse, isNonMetricNumber } from './market-analysis-numbers.mjs';

const MARKET_ANALYSIS_QUOTE_DEFS = [
  { symbol: '^GSPC', metricId: 'market.spx', label: 'SPX', unit: 'index', aliases: ['S&P 500'] },
  { symbol: '^VIX', metricId: 'market.vix', label: 'VIX', unit: 'index', aliases: [] },
  { symbol: '^TNX', metricId: 'market.us10y', label: '10Y', unit: 'index', aliases: ['US 10Y', 'Treasury'] },
  { symbol: 'DX-Y.NYB', metricId: 'market.dxy', label: 'DXY', unit: 'index', aliases: [] },
  { symbol: 'CL=F', metricId: 'market.wti', label: 'WTI', unit: 'USD/barrel', aliases: ['oil'] },
  { symbol: 'GC=F', metricId: 'market.gold', label: 'Gold', unit: 'USD/oz', aliases: [] },
  { symbol: '^KS11', metricId: 'market.kospi', label: 'KOSPI', unit: 'index', aliases: [] },
];
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
/** % moves, bp moves and Korean-name levels checked against each metric's own evidence. */
export function validateAnalysisMetricMentions(text, metricEvidence = [], changes = new Map(), { context = '' } = {}) {
  const issues = [];
  const supported = (digits) => !!context && context.includes(digits);
  for (const mention of analysisMetricMentions(text)) {
    const row = metricEvidence.find((item) => item.metricId === mention.metricId);
    if (!row) continue;
    const rate = row.unit === 'percent';
    const level = Number(row.value);
    const changePct = changes.get(row.evidenceId);
    const bpChange = rate && Number.isFinite(changePct) ? (level - level / (1 + changePct / 100)) * 100 : null;
    const inSession = !!row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session);
    let usedIntraday = false;
    let levelSeen = false;
    for (const match of mention.clause.matchAll(/([+\-−±]?)(\d[\d,]*(?:\.\d+)?)\s*(%포인트|%p|bps|bp|포인트|%)?/gi)) {
      const [, sign, digits, suffix = ''] = match;
      const after = mention.clause.slice(match.index + match[0].length, match.index + match[0].length + 14);
      // P1719: one date/time/count rule shared with the label-level reader (10월·오후 3시 are not levels).
      if (isNonMetricNumber(mention.clause, match.index, match[0].length) || /^(?:%p|%포인트|포인트)$/i.test(suffix)) continue;
      // review: a multi-period move ("20일 동안 8.2% 하락") or a share ("40%를 차지") is not the one-session change.
      const before = mention.clause.slice(Math.max(0, match.index - 16), match.index);
      if (/(?:\d\s?(?:일|주|개월|년|거래일|세션)|연초|연간|올해|분기|월간|주간)[^\d]{0,8}$/.test(before) || /^\s*(?:를|을|의|가|이)?\s*(?:차지|비중|비율|확률|가능성|점유)/.test(after)) continue;
      const magnitude = Number(digits.replace(/,/g, ''));
      if (!Number.isFinite(magnitude)) continue;
      const direction = sign === '-' || sign === '−' ? -1 : sign === '+' ? 1 : ANALYSIS_DOWN.test(after) ? -1 : ANALYSIS_UP.test(after) ? 1 : 0;
      const moved = direction !== 0;
      const stated = direction ? direction * magnitude : magnitude;
      const plain = digits.replace(/,/g, '');
      if (/^bps?$/i.test(suffix)) {
        const gap = direction ? Math.abs(stated - bpChange) : Math.abs(magnitude - Math.abs(bpChange));
        if (rate && bpChange != null && gap > Math.max(1, Math.abs(bpChange) * 0.25) && !supported(plain)) issues.push(`metric-change-mismatch:${row.metricId}`);
        continue;
      }
      if (suffix === '%') {
        if (rate) {
          if (moved) issues.push(`rate-change-not-bp:${row.metricId}`);
          else if (!mention.latin && Math.abs(magnitude - level) > 0.15 && !supported(plain)) issues.push(`metric-value-mismatch:${row.metricId}`);
          continue;
        }
        if (!Number.isFinite(changePct)) continue;
        // v57.50 (live 10/13): KOSPI fell 5.46% and the commentary was blocked for "5% 이상 급락", the wording of the
        // news it cited. A bound ("N% 이상/넘게") holds when the move reaches N; an approximation ("약·거의 N%",
        // "N% 가까이/안팎/가량") holds within max(0.5, 10%) of N. The direction must still agree when one is stated.
        const bound = /^\s*(?:이상|넘게|넘는|넘어|초과|웃도)/.test(after);
        const approx = /(?:약|거의|대략|무려)\s*$/.test(before) || /^\s*(?:가까이|가량|안팎|내외|정도|근처)/.test(after);
        const sameWay = !direction || Math.sign(changePct) === direction || changePct === 0;
        const matches = bound ? sameWay && Math.abs(changePct) >= magnitude - 0.15
          : approx ? sameWay && Math.abs(Math.abs(changePct) - magnitude) <= Math.max(0.5, magnitude * 0.1)
            : direction ? Math.abs(stated - changePct) <= 0.15 : Math.abs(magnitude - Math.abs(changePct)) <= 0.15;
        if (matches) usedIntraday = usedIntraday || inSession;
        else if (!supported(plain)) issues.push(`metric-change-mismatch:${row.metricId}`);
        continue;
      }
      if (moved || levelSeen) continue;
      levelSeen = true;
      const tolerance = Math.max(rate ? 0.15 : 0.5, Math.abs(level) * 0.02);
      if (Math.abs(magnitude - level) <= tolerance) usedIntraday = usedIntraday || inSession;
      else if (!mention.latin && !supported(plain)) issues.push(`metric-value-mismatch:${row.metricId}`);
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
  // Condition counts must be well-formed and, when a regime context was supplied, appear in it.
  for (const match of body.matchAll(/(\d+)\s*\/\s*(\d+)\s*(?:개)?\s*(?:조건|충족)|(?:조건|부합)\s*(\d+)\s*\/\s*(\d+)/g)) { // T06: "현재 조건 부합 n/m"
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

export function validateMarketAnalysisText(text, data, snapshot = null, { context = '' } = {}) {
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
    if (label && new RegExp(`${label}(?:(?![.。,]\\s|\\n|이고|이며|[A-Z]{2,}).){0,40}(?:마감|종가|closed|closing|close at)`).test(body)) issues.push(`session-wording-mismatch:${row.metricId}`);
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
    const tolerance = Math.max(row.unit === 'percent' ? 0.15 : 0.5, Math.abs(Number(row.value)) * 0.02); // P1585: 5% let SPX 7,500 pass for 7,816
    // P1719: the same context exception as validateAnalysisMetricMentions (a value quoted from REGIME_CONTEXT), bounded to
    // a whole number so "10" does not pass because "100" or "2026-10" appears somewhere in the context.
    // Review: the exception also needs the text to mark the number as a reference level (moving average, high, prior
    // close …) so a context value written as the current level ("S&P 500 7,650") is still blocked.
    const referenced = (mentioned) => analysisContextHasNumber(context, mentioned) && analysisNumberMarkedAsReference(body, mentioned);
    if (levels.some(mentioned => Math.abs(mentioned - Number(row.value)) > tolerance && !referenced(mentioned))) issues.push(`metric-value-mismatch:${def.metricId}`);
  }
  // T03/T08: % moves against each metric's own changePct, rates in bp only, Korean metric names, 장중 + time for in-session values.
  issues.push(...validateAnalysisMetricMentions(body, metricEvidence, changes, { context }));
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
  if (causalClaim && causalEvidence.length === 0) {
    const attributed = /헤드라인|보도|기사|언론|according to|headline|reported/i.test(body);
    if (headlineContext.length === 0) warnings.push('causal-evidence-missing');
    else if (!attributed) warnings.push('causal-attribution-missing');
  }
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

// P1719: what the validator blocked, in terms the model can act on — the issue, the metric's evidence value and change,
// and the level the validator read after the label. Appended once to the retry prompt.
export function describeMarketAnalysisIssues(text, issues = [], metricEvidence = [], changes = new Map()) {
  const defs = [...MARKET_ANALYSIS_QUOTE_DEFS, ...MARKET_ANALYSIS_MACRO_DEFS];
  const allLabels = defs.flatMap((def) => [def.label, ...(def.aliases || [])]);
  return [...new Set(issues)].slice(0, 8).map((issue) => {
    const metricId = String(issue).split(':')[1] || '';
    const row = metricEvidence.find((item) => item.metricId === metricId);
    if (!row) return `- ${issue}`;
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
export function retainVerifiedMarketAnalysis(previous, { reason, nowMs = Date.now() } = {}) {
  if (!previous || previous.status !== 'verified' || previous.semanticStatus !== 'verified') return null;
  if (Array.isArray(previous.semanticIssues) && previous.semanticIssues.length) return null;
  const generatedMs = Date.parse(previous.generatedAt || '');
  if (!Number.isFinite(generatedMs) || generatedMs > nowMs + 5 * 60000 || nowMs - generatedMs > MARKET_ANALYSIS_RETAIN_MAX_MS) return null;
  return {
    ...previous,
    retained: { at: new Date(nowMs).toISOString(), from: previous.generatedAt, reason: String(reason || 'analysis-blocked').slice(0, 300), maxAgeHours: 12 },
  };
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
