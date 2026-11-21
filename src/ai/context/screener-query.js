// The chat's screener engine (moved out of js/aio-data.js 2026-10-17, rebuilt v60.41). One structured screen (runScreen) over
// the canonical screener rows with the screener screen's own definitions: the custom conditions (custom-conditions.js),
// the 시가총액 buckets (row-presentation.js CAP_BUCKETS), the condition reader (condition-read.js) and the listing market
// (market-scope.js). The chat's screen tool fills the spec. The sentence reader (the screener's own parser,
// parseConditionText, plus a scope reader for market, size, sector and theme) only tells a screen question from a broad
// "종목 추천해줘" ask, which gets a separate comparison sample (buildDiversifiedRecommendationRows): a day-seeded coverage
// sample, not a rank. Pure apart from screenerInput(root), which reads the page's globals.

import { listingCurrency } from '../../domain/portfolio/fx.js';
import { formatScreenerPrice, screenerMarket, MARKET_LABELS } from '../../domain/screener/market-scope.js';
import { readLiveQuotePrice, readRowNumber, fieldValueForPurpose, SCREENER_FIELD_REGISTRY } from '../../data/contracts/screener.js';
import { keywordHit } from '../../domain/news/keyword-match.js';
import { CUSTOM_CONDITIONS, conditionCoverage, conditionLabel, matchesConditions, normalizeConditions } from '../../domain/screener/custom-conditions.js';
import { parseConditionText } from '../../domain/screener/condition-text-parser.js';
import { CAP_BUCKETS, capBucketOf, capFilterValue, capReading, visibleRank } from '../../domain/screener/row-presentation.js';
import { conditionReader } from '../../domain/screener/condition-read.js';
import { mergeThemeAliases } from '../../domain/screener/theme-aliases.js';
import { consensusView } from '../../domain/fundamental/consensus-read.js';
import { consensusRowFor } from '../../data/consensus-estimates.js';
import { readNumber, signedText } from '../../domain/shared/number.js';

// v59.45 (pipeline review P13-SCREEN-01): a row copied quote.price and dropped its currency, and the prompt put "$" on every
// price, so Samsung read "가격 $70000.00". A quote keeps its own currency (the listing's when the quote declares none; an
// unknown exchange stays unknown) and its observation time.
function quoteFields(sym, ld) {
  const declared = String(ld && ld.currency || '').trim().toUpperCase();
  return {
    price: ld && ld.price != null ? ld.price : null,
    currency: /^[A-Z]{3}$/.test(declared) ? declared : listingCurrency(sym),
    priceObservedAt: (ld && (ld.observedAt || ld.asOf)) || null
  };
}

export const SECTOR_KEYWORDS = Object.freeze({
  'technology':['Technology'], 'tech':['Technology'], '기술':['Technology'], '기술주':['Technology'], 'IT':['Technology'],
  'software':['Technology'], '소프트웨어':['Technology','SW','ERP','IT서비스','IT플랫폼','CNS'],
  'semiconductor':['Technology'], '반도체':['Technology','반도체','반도체장비','반도체소재','파운드리','MLCC'],
  'ai':['Technology','AI'], 'AI':['Technology','AI'],
  'financial':['Financials'], 'financials':['Financials'], '금융':['Financials','금융','보험','핀테크','거래소'],
  'bank':['Financials'], '은행':['Financials','금융'],
  'healthcare':['Healthcare'], 'health':['Healthcare'], '헬스케어':['Healthcare'], '의료':['Healthcare'],
  'biotech':['Healthcare'], '바이오':['Healthcare','바이오','바이오시밀러','보톡스','CDMO','항암제','제약'],
  'pharma':['Healthcare'], '제약':['Healthcare','제약','바이오'],
  'consumer':['Consumer','Consumer Defensive'], '소비재':['Consumer','Consumer Defensive'],
  'energy':['Energy'], '에너지':['Energy'], '원유':['Energy'], '석유':['Energy'],
  'utility':['Utilities'], 'utilities':['Utilities'], '유틸리티':['Utilities'],
  'industrial':['Industrials'], 'industrials':['Industrials'], '산업재':['Industrials'],
  'defense':['Industrials'], '방산':['Industrials','방산','방산지주','방산IT','탄약'],
  'material':['Materials'], 'materials':['Materials'], '소재':['Materials','소재'],
  'realestate':['Real Estate'], '부동산':['Real Estate'],
  'communication':['Communication Services'], '통신':['Communication Services','통신'],
  'etf':['ETF'], 'ETF':['ETF'],
  '2차전지':['2차전지','양극재'], '배터리':['2차전지','양극재'],
  '조선':['조선','조선지주'], '자동차':['자동차','자동차부품','가전/전장','전장'],
  '원전':['원전','원전설계','원전정비','원전기자재'], '전력':['전력기기','전력지주','배전','전선'],
  '로봇':['로봇','산업로봇','서비스로봇','협동로봇'],
  '화장품':['화장품','뷰티브랜드','스킨케어','색조'],
  '게임':['게임','게임/블록체인','엔터','미디어','드라마'],
});

const rowList = (rows) => (Array.isArray(rows) ? rows : []);
const symbolOf = (row) => String(row?.sym || row?.symbol || '').toUpperCase();

// Longest keyword wins, as before (a "소프트웨어" question is not read as the shorter "IT").
function longestSectorMatch(text) {
  const lower = String(text || '').toLowerCase();
  let matched = null, matchedKey = '';
  Object.keys(SECTOR_KEYWORDS).forEach((kw) => {
    // The acronym IT is meaningful as typed, unlike the lowercase English pronoun.
    if (kw === 'IT' && !/\bIT\b/.test(String(text))) return;
    if (keywordHit(lower, kw) && (!matched || kw.length > matchedKey.length)) { matched = SECTOR_KEYWORDS[kw]; matchedKey = kw; }
  });
  return { matched, matchedKey };
}

export function isBroadRecommendationQuery(query) {
  const q = String(query || '').toLowerCase();
  if (!q) return false;
  return /(종목\s*)?(추천|골라|뽑아|찾아줘|아이디어|후보|리스트)|recommend|stock\s*ideas?|top\s*picks?|best\s*stocks?|pick\s*stocks?/i.test(q);
}

export function inferTickerMarket(sym, index) {
  const s = String(sym || '');
  if (/\.KS$|\.KQ$/.test(s)) return 'KR';
  if (/\.T$/.test(s)) return 'Japan';
  if (/\.TW$/.test(s)) return 'Taiwan';
  if (/\.HK$/.test(s)) return 'Hong Kong';
  if (/ADR/i.test(index || '')) return 'ADR';
  return 'US';
}

export function extractRecentRecommendationTickers(messages, { rows = [] } = {}) {
  try {
    const known = {};
    rowList(rows).forEach((s) => { if (s && s.sym) known[s.sym] = true; });
    const out = {};
    (messages || []).slice(-8).forEach((m) => {
      const text = String((m && m.content) || '');
      const hits = text.match(/\b[A-Z][A-Z0-9.-]{1,9}(?:\.(?:KS|KQ|T|TW|HK))?\b|\b\d{6}\.(?:KS|KQ)\b/g) || [];
      hits.forEach((t) => { if (known[t]) out[t] = true; });
    });
    return Object.keys(out);
  } catch (_) { return []; }
}

// v59.54: the sample order is a hash of the symbol and the day, not alphabetical order, which handed every broad question
// the same first names in each sector. It carries no score: the same day and rows give the same sample whatever the rank
// or input order, and the next day draws another one.
function sampleOrder(sym, day) {
  let hash = 2166136261;
  for (const ch of `${day}|${sym}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return hash >>> 0;
}

// A coverage sample for comparison, not a recommendation model: a day-seeded order, names not already discussed first;
// never invent a rating. The size bucket is the screener filter's (unknown size stays unknown).
export function buildDiversifiedRecommendationRows(rows, live, opts) {
  opts = opts || {}; live = live || {};
  const recent = {};
  (opts.recentTickers || []).forEach((t) => { recent[t] = true; });
  const seen = {};
  let eligible = rowList(rows).filter((s) => {
    if (!s || !s.sym || seen[s.sym]) return false;
    seen[s.sym] = true;
    if (s.signal === 'SELL') return false;
    if (s.sector === 'ETF') return false;
    if (/^\^|=|-USD$/i.test(s.sym)) return false;
    return true;
  }).map((s) => {
    const ld = live[s.sym] || {};
    const pct = (ld && ld.pct != null && Number.isFinite(Number(ld.pct))) ? Number(ld.pct) : null;
    return {
      sym: s.sym, name: s.name, sector: s.sector, signal: s.signal, mcap: s.mcap, rsi: s.rsi,
      fieldReadiness: s.fieldReadiness, factorSessionDate: s.factorSessionDate,
      rank: (typeof s.rank === 'number' ? s.rank : null), quantSignal: s.quantSignal || null, factorScores: s.factorScores || null,
      ret3m: (typeof s.ret3m === 'number' ? s.ret3m : null), vol: (typeof s.vol === 'number' ? s.vol : null),
      ...quoteFields(s.sym, ld), pct, memo: (s.memo || '').slice(0, 90),
      market: inferTickerMarket(s.sym, s.index), capBucket: capBucketOf(s) || 'unknown', repeated: !!recent[s.sym]
    };
  });
  const day = opts.sampleDay || new Date().toISOString().slice(0, 10);
  eligible.sort((a, b) => Number(a.repeated) - Number(b.repeated) || sampleOrder(a.sym, day) - sampleOrder(b.sym, day) || a.sym.localeCompare(b.sym, 'en'));

  // P626-followup/T825: count the suppressed repeats from the full set, before the non-repeat narrowing below
  // (counting after it always returned 0).
  const recentSuppressed = eligible.filter((r) => r.repeated).length;
  const nonRepeat = eligible.filter((r) => !r.repeated);
  if (nonRepeat.length >= 20) eligible = nonRepeat;

  function pickRows(sectorLimit, marketLimit, maxRows) {
    const picked = [], secCount = {}, marketCount = {};
    eligible.forEach((r) => {
      if (picked.length >= maxRows) return;
      const sec = r.sector || 'Unknown', mkt = r.market || 'US';
      if ((secCount[sec] || 0) >= sectorLimit) return;
      if ((marketCount[mkt] || 0) >= (marketLimit[mkt] || marketLimit._default || maxRows)) return;
      picked.push(r);
      secCount[sec] = (secCount[sec] || 0) + 1;
      marketCount[mkt] = (marketCount[mkt] || 0) + 1;
    });
    return { rows: picked, secCount, marketCount };
  }

  let first = pickRows(2, { US: 7, KR: 5, Japan: 2, Taiwan: 2, 'Hong Kong': 2, ADR: 2, _default: 3 }, 16);
  if (first.rows.length < 12) first = pickRows(3, { US: 10, KR: 7, Japan: 3, Taiwan: 3, 'Hong Kong': 3, ADR: 3, _default: 4 }, 16);
  const sectors = {}, markets = {}, capBuckets = {};
  first.rows.forEach((r) => {
    sectors[r.sector || 'Unknown'] = true;
    markets[r.market || 'US'] = true;
    capBuckets[r.capBucket || 'unknown'] = true;
  });
  return {
    rows: first.rows, totalMatched: eligible.length, recentSuppressed,
    diversity: { sectorCount: Object.keys(sectors).length, marketCount: Object.keys(markets).length, capBucketCount: Object.keys(capBuckets).length }
  };
}

// ── The structured screen ──────────────────────────────────────────────────────────────────────────────────────────────

export const SCREEN_MARKETS = Object.freeze(['US', 'KR']);
export const SCREEN_LIMIT = 12;
// Sort fields: published numbers a reader orders a list by. 시총 is the size the 시가총액 filter reads, 백분위 the rank the
// table shows; the rest read through the condition reader (calculation readiness).
export const SCREEN_SORTS = Object.freeze({
  marketCap: '시가총액', rank: '백분위', pe: 'PER', pb: 'PBR', roe: 'ROE', margin: '순이익률', revGrowth: '매출 성장률',
  dividendYieldPct: '배당수익률', ret1m: '1개월 수익률', ret3m: '3개월 수익률', ret6m: '6개월 수익률', rsi: 'RSI', pctFrom52wHigh: '52주 고점 대비'
});
const SORT_READERS = Object.freeze({ marketCap: (row) => capFilterValue(row), rank: (row) => visibleRank(row) });
// The numbers every result row carries (beside the values of the conditions used).
const FACT_KEYS = Object.freeze(['pe', 'ret1m', 'ret3m', 'rsi', 'dividendYieldPct', 'pctFrom52wHigh']);
// A screen of named stocks carries the rest of the row the 종목 screen shows.
const DETAIL_KEYS = Object.freeze({ pb: 'PBR', roe: 'ROE(최근 회계연도)', margin: '순이익률', revGrowth: '매출 성장률(최근 4개 분기)', ret5d: '5거래일', ret6m: '6개월', pctSma50: '50일선 대비', pctSma200: '200일선 대비' });
const DETAIL_PERCENT = new Set(['roe', 'margin', 'revGrowth']);
export const SCREEN_SYMBOL_LIMIT = 6;
const FIELD_ID_BY_ROW_KEY = new Map(SCREENER_FIELD_REGISTRY.fields.map((definition) => [definition.rowKey, definition.fieldId]));
const CONDITION_BY_ID = new Map(CUSTOM_CONDITIONS.map((item) => [item.id, item]));

const sizeLabel = (sizes) => sizes.map((size) => CAP_BUCKETS[size]).join('·');

function resolveSector(word, marketRowsList) {
  const text = String(word || '').trim();
  if (!text) return { sectors: null };
  const present = [...new Set(marketRowsList.map((row) => row.sector).filter(Boolean))];
  const keyword = Object.keys(SECTOR_KEYWORDS).find((key) => key.toLowerCase() === text.toLowerCase());
  const wanted = keyword ? SECTOR_KEYWORDS[keyword] : present.filter((sector) => sector.toLowerCase() === text.toLowerCase());
  const sectors = wanted.filter((sector) => present.includes(sector));
  return sectors.length ? { sectors, label: sectors.length === 1 && sectors[0] === text ? text : `${text}(${sectors.join('·')})` } : { error: `섹터 "${text.slice(0, 40)}"를 찾지 못했습니다. 이 시장의 섹터: ${present.sort().join(', ')}` };
}

function resolveTheme(word, aliases) {
  const text = String(word || '').trim().toLowerCase();
  if (!text) return { members: null };
  const list = aliases[text] || aliases[text.replace(/\s+/g, '')];
  if (Array.isArray(list) && list.length) return { members: new Set(list.map((symbol) => String(symbol || '').toUpperCase())), label: String(word).trim() };
  return { error: `테마 "${String(word).slice(0, 40)}"를 찾지 못했습니다. 테마 이름 예: ${Object.keys(aliases).filter((key) => /[가-힣]/.test(key)).slice(0, 24).join(', ')}` };
}

const inIndex = (row, index) => row.index === index || (Array.isArray(row.membership) && row.membership.includes(index));
function resolveIndex(word, marketRowsList) {
  const index = String(word || '').trim().toUpperCase();
  if (!index) return { index: null };
  if (marketRowsList.some((row) => inIndex(row, index))) return { index };
  const present = [...new Set(marketRowsList.flatMap((row) => [row.index, ...(Array.isArray(row.membership) ? row.membership : [])]).filter(Boolean))];
  return { error: `지수 "${index.slice(0, 20)}"에 속한 종목이 이 시장에 없습니다. 가능한 값: ${present.sort().join(', ')}` };
}

/** The spec with every field checked: unknown ids dropped, the limit clamped, the defaults filled. */
export function normalizeScreenSpec(spec = {}) {
  const limit = Math.round(Number(spec.limit));
  return {
    market: SCREEN_MARKETS.includes(spec.market) ? spec.market : 'US',
    symbols: [...new Set((Array.isArray(spec.symbols) ? spec.symbols : []).map((sym) => String(sym || '').trim().toUpperCase()).filter(Boolean))].slice(0, SCREEN_SYMBOL_LIMIT),
    sizes: [...new Set((Array.isArray(spec.sizes) ? spec.sizes : []).filter((size) => CAP_BUCKETS[size]))],
    sector: typeof spec.sector === 'string' && spec.sector.trim() ? spec.sector.trim().slice(0, 60) : null,
    theme: typeof spec.theme === 'string' && spec.theme.trim() ? spec.theme.trim().slice(0, 60) : null,
    index: typeof spec.index === 'string' && spec.index.trim() ? spec.index.trim().slice(0, 20) : null,
    conditions: normalizeConditions(Array.isArray(spec.conditions) ? spec.conditions : []),
    sort: SCREEN_SORTS[spec.sort] ? spec.sort : 'marketCap',
    order: spec.order === 'asc' ? 'asc' : 'desc',
    limit: Number.isFinite(limit) ? Math.min(SCREEN_LIMIT, Math.max(1, limit)) : SCREEN_LIMIT
  };
}

// What one result row carries: identity, size with its basis, the standard facts, every used condition's own fields, the
// live quote in its own currency and the verified headline.
function screenRowFacts(row, conditions, read, live, detail = false) {
  const quote = live[row.sym] || {};
  const facts = Object.fromEntries(FACT_KEYS.map((key) => [key, read(row, key)]));
  // A value the table shows but the readiness contract keeps out of calculation (STALE, LAST_GOOD, CONFLICT) is named as
  // reference only, never used as the value.
  const reference = FACT_KEYS.filter((key) => facts[key] == null && FIELD_ID_BY_ROW_KEY.has(key) && row.fieldReadiness)
    .map((key) => [key, fieldValueForPurpose(row, FIELD_ID_BY_ROW_KEY.get(key), 'display'), row.fieldReadiness.fields?.[FIELD_ID_BY_ROW_KEY.get(key)]?.status])
    .filter(([, value, status]) => value != null && ['STALE', 'LAST_GOOD', 'CONFLICT'].includes(status));
  const conditionValues = conditions.map((condition) => ({ id: condition.id, values: Object.fromEntries((CONDITION_BY_ID.get(condition.id)?.fields || []).filter((key) => !FACT_KEYS.includes(key)).map((key) => [key, read(row, key)])) }))
    .filter((entry) => Object.keys(entry.values).length);
  return {
    sym: row.sym, name: row.name || row.sym, sector: row.sector || null, market: screenerMarket(row),
    cap: capReading(row), capBucket: capBucketOf(row), ...facts, rank: visibleRank(row), factorSessionDate: row.factorSessionDate || null,
    reference: reference.map(([key, value, status]) => ({ key, value, status })), conditionValues,
    detail: detail ? Object.fromEntries(Object.keys(DETAIL_KEYS).map((key) => [key, read(row, key)]).filter(([, value]) => readNumber(value) != null)) : null,
    ...quoteFields(row.sym, quote), pct: readNumber(quote.pct),
    // 2026-10-13 news audit N02: only a memo whose headline names this issuer (producer newsMemoVerified) reaches the AI as
    // this stock's news; an unverified memo was another company's story about 1 time in 5.
    newsMemo: row.newsMemoVerified === true ? String(row.newsMemo || '').slice(0, 200) : ''
  };
}

/**
 * Runs one screen. Returns { matched: true, mode: 'conditions', spec, criteria, rows, totalMatched, steps, coverage,
 * sizeUnknown, sizeUnavailable } or { matched: false, error } when a scope word names nothing in the market.
 * coverage: per condition { id, label, pass, withData } over the scoped rows, so a 0 can say which condition removed
 * everything or lacks data.
 */
export function runScreen(rawSpec = {}, { rows = [], live = {}, aliases = {}, read = conditionReader() } = {}) {
  const spec = normalizeScreenSpec(rawSpec);
  const quotes = live || {};
  // Named stocks are read from both markets and replace the market, size, sector, theme and index scope.
  const named = spec.symbols.length > 0;
  const marketList = rowList(rows).filter((row) => row && row.sym && (named ? spec.symbols.includes(symbolOf(row)) : screenerMarket(row) === spec.market));
  const sector = named ? {} : resolveSector(spec.sector, marketList);
  const theme = named ? {} : resolveTheme(spec.theme, aliases && typeof aliases === 'object' ? aliases : {});
  const index = named ? {} : resolveIndex(spec.index, marketList);
  const error = [sector, theme, index].find((part) => part.error)?.error;
  if (error) return { matched: false, spec, error };

  const missing = named ? spec.symbols.filter((sym) => !marketList.some((row) => symbolOf(row) === sym)) : [];
  const criteria = [named ? `지정 종목 ${spec.symbols.join(', ')}` : `시장 ${MARKET_LABELS[spec.market]}`];
  const steps = [{ label: named ? '지정 종목' : `${MARKET_LABELS[spec.market]} 종목`, count: marketList.length }];
  let scope = marketList;
  const narrow = (label, keep) => { scope = scope.filter(keep); steps.push({ label, count: scope.length }); criteria.push(label); };
  // P13-SCREEN-02: a missing or zero size is unknown, not small — it meets no bucket and is counted apart.
  let sizeUnknown = 0;
  const sizeUnavailable = !named && spec.sizes.length > 0 && !marketList.some((row) => capFilterValue(row) != null);
  if (spec.sizes.length && !named) {
    sizeUnknown = scope.filter((row) => capBucketOf(row) == null).length;
    narrow(`크기 ${sizeLabel(spec.sizes)}`, (row) => spec.sizes.includes(capBucketOf(row)));
  }
  if (sector.sectors) narrow(`섹터 ${sector.label}`, (row) => sector.sectors.includes(row.sector));
  if (theme.members) narrow(`테마 ${theme.label}`, (row) => theme.members.has(symbolOf(row)));
  if (index.index) narrow(`지수 ${index.index}`, (row) => inIndex(row, index.index));

  const coverage = conditionCoverage(scope, spec.conditions, read).map((count, i) => ({ ...count, label: conditionLabel(spec.conditions[i]) }));
  spec.conditions.forEach((condition) => criteria.push(conditionLabel(condition)));
  const sortRead = SORT_READERS[spec.sort] || ((row) => read(row, spec.sort));
  const matched = scope.filter((row) => matchesConditions(row, spec.conditions, read))
    .map((row) => ({ row, key: sortRead(row) }))
    .sort((a, b) => {
      const absentA = readNumber(a.key) == null, absentB = readNumber(b.key) == null;
      if (absentA || absentB) return absentA === absentB ? symbolOf(a.row).localeCompare(symbolOf(b.row), 'en') : absentA ? 1 : -1;
      return (spec.order === 'asc' ? a.key - b.key : b.key - a.key) || symbolOf(a.row).localeCompare(symbolOf(b.row), 'en');
    });
  return {
    matched: true, mode: 'conditions', spec, criteria, steps, coverage, sizeUnknown, sizeUnavailable, missing,
    totalMatched: matched.length, scopeCount: scope.length,
    rows: matched.slice(0, spec.limit).map(({ row }) => screenRowFacts(row, spec.conditions, read, quotes, named))
  };
}

/** Why a screen returned nothing, named from its steps and coverage (null when it returned rows). */
export function screenZeroReason(result) {
  if (!result?.matched || result.totalMatched > 0) return null;
  if (result.sizeUnavailable) return `${MARKET_LABELS[result.spec.market]} 종목에는 시가총액 자료가 없어 크기 조건을 판정할 수 없습니다.`;
  const emptyStep = result.steps.find((step) => step.count === 0);
  if (emptyStep) return `${emptyStep.label}에서 남은 종목이 0개입니다.`;
  const noData = result.coverage.filter((entry) => entry.withData === 0);
  if (noData.length) return `자료 없음: ${noData.map((entry) => entry.label).join(', ')} — 이 범위 종목 중 값이 있는 종목이 없습니다.`;
  const blocking = result.coverage.filter((entry) => entry.pass === 0);
  if (blocking.length) return `통과 0: ${blocking.map((entry) => `${entry.label}(자료 있는 ${entry.withData}종목 중 0)`).join(', ')}.`;
  return '조건마다 통과한 종목은 있지만 모든 조건을 함께 만족하는 종목은 없습니다.';
}

const fixed = (value, digits = 1) => (readNumber(value) != null ? readNumber(value).toFixed(digits) : '미확인');
const signed = (value, digits = 1) => (readNumber(value) != null ? signedText(readNumber(value), digits, '%') : '미확인');
const capText = (row) => (row.cap ? `$${fixed(row.cap.billions, 1)}B(${row.cap.basis === 'live' ? '시세 기준' : 'SEC 주식 수×종가 참고'})` : '미확인');

/** The result as the text the model reads: criteria, counts, coverage, one compact line per row with its dated basis. */
export function formatScreenResult(result) {
  if (!result?.matched) return '';
  const lines = ['【스크리너 조건 검색 — 스크리너 화면과 같은 조건 정의로 앱 종목 DB를 거른 결과】'];
  lines.push(`조건: ${result.criteria.join(' · ')}`);
  lines.push(`정렬: ${SCREEN_SORTS[result.spec.sort]} ${result.spec.order === 'asc' ? '낮은 순' : '높은 순'} · 일치 ${result.totalMatched}종목${result.totalMatched ? ` 중 ${result.rows.length}종목 표시` : ''} (범위 ${result.steps.map((step) => `${step.label} ${step.count}`).join(' → ')})`);
  if (result.coverage.length) lines.push(`조건별 통과(범위 ${result.scopeCount}종목 중 자료 있는 종목 기준): ${result.coverage.map((entry) => `${entry.label} ${entry.pass}/${entry.withData}`).join(' · ')}`);
  if (result.sizeUnknown) lines.push(`시가총액을 확인하지 못한 ${result.sizeUnknown}종목은 크기 조건에서 제외했습니다(작은 종목으로 보지 않음).`);
  if (result.missing?.length) lines.push(`종목 DB에 없는 종목: ${result.missing.join(', ')}`);
  const zero = screenZeroReason(result);
  if (zero) lines.push(`결과 없음: ${zero}`);
  // `fact` is a screenRowFacts entry: its numbers were already read through the condition reader.
  result.rows.forEach((fact, i) => {
    const live = readLiveQuotePrice(fact);
    const parts = [`${i + 1}. ${fact.sym} (${fact.name})`, fact.sector || '섹터 미확인', `시총 ${capText(fact)}`, `PER ${fixed(fact.pe)}`, `1개월 ${signed(fact.ret1m)}`, `3개월 ${signed(fact.ret3m)}`,
      `RSI ${fixed(fact.rsi, 0)}`, `배당수익률 ${fact.dividendYieldPct == null ? '미확인' : `${fixed(fact.dividendYieldPct, 2)}%`}`, `52주 고점 대비 ${signed(fact.pctFrom52wHigh)}`];
    if (fact.rank != null) parts.push(`백분위 ${fact.rank}`);
    if (live) parts.push(`가격 ${formatScreenerPrice(live.price, fact.currency || null)}${live.observedAt ? ` (관측 ${live.observedAt})` : ''}${fact.pct != null ? ` ${signed(fact.pct, 2)}` : ''}`);
    if (fact.detail) for (const [key, value] of Object.entries(fact.detail)) parts.push(`${DETAIL_KEYS[key]} ${DETAIL_PERCENT.has(key) ? `${fixed(value)}%` : key === 'pb' ? fixed(value) : signed(value)}`);
    parts.push(`팩터 기준일 ${fact.factorSessionDate || '미확인'}`);
    lines.push(parts.join(' · '));
    if (fact.conditionValues.length) lines.push(`   조건 값: ${fact.conditionValues.map((used) => `${used.id} ${Object.entries(used.values).map(([key, value]) => `${key}=${Array.isArray(value) ? value.length : typeof value === 'number' ? Number(value.toFixed(2)) : value ?? '미확인'}`).join(', ')}`).join(' · ')}`);
    if (fact.reference.length) lines.push(`   조건 계산에 쓰지 않는 참고 값: ${fact.reference.map((held) => `${held.key} ${fixed(held.value)}(${held.status})`).join(', ')}`);
    if (fact.newsMemo) lines.push(`   최신뉴스(제목만, 발행 주체 확인됨): ${fact.newsMemo}`);
  });
  lines.push('답변 지침: 이 목록은 스크리너 조건을 그대로 적용한 결과다. 목록 밖 종목을 더하지 말고, 조건을 충족한 근거(위 값)와 미확인 항목을 함께 말하라. 백분위는 같은 모델 안의 상대 위치이며 매수 순위가 아니다. 가격은 위 값 그대로 기준시각과 함께 인용하라.');
  return lines.join('\n');
}

// ── The sentence path (turns without tools) ────────────────────────────────────────────────────────────────────────────

const KR_MARKET_WORDS = /한국|국내|코스피|코스닥|kospi|kosdaq/i;
// Size words map onto the filter's buckets; "대형주" is read as large and up (a reader asking for 대형주 means Apple too).
const SIZE_WORDS = Object.freeze([
  [/초대형|메가\s*-?캡|mega\s*-?cap/i, ['MEGA']],
  [/대형주?|large\s*-?cap/i, ['MEGA', 'LARGE']],
  [/중형주?|mid\s*-?cap/i, ['MID']],
  [/소형주?|small\s*-?cap/i, ['SMALL']]
]);

/** A sentence → a screen spec: the screener's own condition parser plus market, size, sector and theme words; null without any. */
export function readScreenSentence(text, { aliases = {} } = {}) {
  const sentence = String(text || '');
  const parsed = parseConditionText(sentence);
  // The screener applies nothing when a sentence asks for OR or an inverted bound; the chat does not guess either.
  if (parsed.unsupported?.length) return null;
  const sizes = SIZE_WORDS.find(([pattern]) => pattern.test(sentence))?.[1] || [];
  const { matched: sectorMatch, matchedKey } = longestSectorMatch(sentence);
  const lower = sentence.toLowerCase();
  let themeKey = '';
  Object.keys(aliases || {}).forEach((key) => { if (Array.isArray(aliases[key]) && keywordHit(lower, key) && key.length > themeKey.length) themeKey = key; });
  const useTheme = themeKey && themeKey.length >= matchedKey.length;
  const spec = {
    market: KR_MARKET_WORDS.test(sentence) ? 'KR' : 'US',
    sizes, sector: !useTheme && sectorMatch ? matchedKey : null, theme: useTheme ? themeKey : null, index: null,
    conditions: parsed.conditions, sort: 'marketCap', order: 'desc', limit: SCREEN_LIMIT
  };
  return spec.conditions.length || spec.sizes.length || spec.sector || spec.theme ? spec : null;
}

/** The page's screener inputs: canonical rows, live quotes, keyword plus THEME_MAP aliases, the condition reader. */
export function screenerInput(root = globalThis, { now = Date.now() } = {}) {
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  return {
    rows,
    live: root?._liveData || {},
    aliases: mergeThemeAliases(root?.SCR_KEYWORD_ALIASES || {}, Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []),
    read: conditionReader({
      forwardPe: (row) => consensusView(row, consensusRowFor(root, row?.sym || row?.symbol), { now })?.fwdPe ?? null,
      cashMetrics: (symbol) => root?._aioScreenerCash?.map?.get(symbol),
      channelSignals: () => root?.AIO_TELEGRAM_SIGNALS
    }),
    rankAsOf: typeof root?.AIO?.screenerFactorAsOf === 'function' ? root.AIO.screenerFactorAsOf() : null
  };
}

// ── The broad comparison sample prompt ─────────────────────────────────────────────────────────────────────────────────

export function formatComparisonSample(result, { rankAsOf = null } = {}) {
  if (!result || result.mode !== 'diversified-recommendation' || !result.rows || !result.rows.length) return '';
  const fmt = (v, d) => (v != null && !isNaN(v) ? Number(v).toFixed(d || 1) : 'N/A');
  const signedPct = (v) => (v != null && !isNaN(v) ? signedText(Number(v), 2, '%') : 'N/A');
  // AIQ-P0-06: never replace producer observation time with browser generation time.
  const ts = result.observedAt || result.asOf || rankAsOf || '관측시각 미확인';
  const lines = [];
  lines.push('【종목 비교 표본 — AIO 종목 DB 분산 샘플링】');
  lines.push('조건: ' + result.criteria.join(' · ') + ' | 대상 ' + result.totalMatched + '종목 (표본 ' + result.rows.length + ')');
  lines.push('출처: AIO 종목 DB × 멀티팩터 퀀트 랭크 × 실시간 시세 · 생산자 관측시각 ' + ts);
  const dv = result.diversity || {};
  lines.push('비교 범위: 섹터 ' + (dv.sectorCount || '?') + '개 · 시장/지역 ' + (dv.marketCount || '?') + '개 · 시총 구간 ' + (dv.capBucketCount || '?') + '개. 최근 대화에서 다룬 ' + (result.recentSuppressed || 0) + '개 종목은 뒤로 미뤘다.');
  lines.push('이 목록은 날짜별로 섞은 순서에서 섹터·시장별 표시 수를 제한한 비교 표본이며 매력도나 투자 우선순위가 아니다. 전체 시장을 대표하는 통계 표본도 아니다. 종목을 대신 고르지 말고 비교 기준, 충족한 조건과 미확인 항목을 설명하라.');
  // v59.46 boundary contract: the result rows' numbers are read through the screener readiness contract.
  const value = (row, key) => readRowNumber(row, key, 'display');
  result.rows.forEach((r, i) => {
    const live = readLiveQuotePrice(r);
    const rankStr = (r.rank != null) ? ('퀀트 백분위 ' + r.rank + '(' + (r.quantSignal || '') + ')') : '퀀트 N/A';
    lines.push((i + 1) + '. ' + r.sym + ' (' + r.name + ') · ' + r.sector + ' · ' + (r.market || 'US') + '/' + (CAP_BUCKETS[r.capBucket] || '시총 미확인') + ' · ' + rankStr +
      ' · RSI ' + fmt(value(r, 'rsi'), 0) + ' · 3M ' + signedPct(value(r, 'ret3m')) + ' · 가격 ' + (live ? formatScreenerPrice(live.price, r.currency || null) + (live.observedAt ? ' (관측 ' + live.observedAt + ')' : '') : 'N/A') + ' (' + signedPct(r.pct) + ')');
    if (r.factorSessionDate) lines.push('   팩터 기준일: ' + r.factorSessionDate);
    if (r.memo) lines.push('   메모: ' + r.memo);
  });
  lines.push('');
  lines.push('답변 지침: 표본의 범위와 한계를 먼저 밝히고, 성장·현금흐름·가격 추세·위험·시장별 차이 등 비교할 기준을 설명하라. 제공된 수치로 확인되는 차이와 부족한 근거를 함께 보여라. 매수할 종목이나 최종 후보를 선정하지 말고, 사용자가 시장·섹터·시총·위험 조건을 정해 같은 기준으로 비교하도록 안내하라.');
  return '\n\n' + lines.join('\n') + '\n';
}

/**
 * E2/S-E (P1239): the chat's injected screener block. A broad ask with no screen cue gets the comparison sample; a
 * sentence with screen cues gets nothing here, because the model fills the screen tool's structured spec itself.
 */
export function buildScreenerAiContext(query, messages, { rows = [], live = {}, aliases = {}, rankAsOf = null, logger = null } = {}) {
  let result = null;
  try {
    if (readScreenSentence(query, { aliases }) || !isBroadRecommendationQuery(query)) return { result: null, prompt: '' };
    const recentTickers = extractRecentRecommendationTickers(messages, { rows });
    const sample = buildDiversifiedRecommendationRows(rows, live, { recentTickers });
    result = { matched: true, mode: 'diversified-recommendation', purpose: 'comparison', criteria: ['분산 비교 표본'], ...sample };
    return { result, prompt: formatComparisonSample(result, { rankAsOf }) };
  } catch (e) {
    if (typeof logger === 'function') logger(e);
    return { result, prompt: '' };
  }
}
