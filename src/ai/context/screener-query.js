// Legacy unification (2026-10-17): the chat's natural-language screener query engine, moved out of js/aio-data.js
// (it came there from js/aio-chat.js in v51.17). The functions are pure: the caller passes the canonical screener rows
// (already ranked by the native screener orchestrator), the live quote map and the keyword aliases. The legacy chat
// keeps calling the same window names, which src/app/compatibility-globals.js binds to these functions.
// Behaviour is unchanged except that no second ranking run happens here: the rows arrive ranked from the screen's own
// run, so the old "rank on demand" fallback (a duplicate of the native ranking) is gone.

import { listingCurrency } from '../../domain/portfolio/fx.js';
import { formatScreenerPrice } from '../../domain/screener/market-scope.js';

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

// v59.45 (P13-SCREEN-02): a missing or zero market cap is unknown, not small. Only a finite positive value meets a size bound.
const knownCap = (mcap) => typeof mcap === 'number' && Number.isFinite(mcap) && mcap > 0;

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

const SECTOR_INTENT_PATTERNS = ['비교','추천','찾아','뽑아','골라','싼','저평가','고평가','성장','배당','수익률','밸류','가치','cheapest','best','top','compare','recommend','undervalued','overvalued','screen','pick','find'];

const rowList = (rows) => (Array.isArray(rows) ? rows : []);

// Longest keyword wins, as before (a "소프트웨어" question is not read as the shorter "IT").
function longestSectorMatch(lower) {
  let matched = null, matchedKey = '';
  Object.keys(SECTOR_KEYWORDS).forEach((kw) => {
    if (lower.indexOf(kw.toLowerCase()) >= 0 && (!matched || kw.length > matchedKey.length)) { matched = SECTOR_KEYWORDS[kw]; matchedKey = kw; }
  });
  return { matched, matchedKey };
}

export function detectSectorQuery(text, { rows = [] } = {}) {
  const lower = String(text || '').toLowerCase();
  if (!SECTOR_INTENT_PATTERNS.some((p) => lower.indexOf(p) >= 0)) return null;
  const { matched, matchedKey } = longestSectorMatch(lower);
  if (!matched) return null;
  const stocks = rowList(rows)
    .filter((s) => matched.some((sec) => s.sector === sec))
    .sort((a, b) => (b.mcap || 0) - (a.mcap || 0)).slice(0, 8);
  return stocks.length > 0 ? { sectorLabel: matchedKey, stocks } : null;
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

export function capBucket(mcap) {
  const v = Number(mcap || 0);
  if (v >= 500) return 'mega';
  if (v >= 100) return 'large';
  if (v >= 10) return 'mid';
  if (v > 0) return 'small';
  return 'unknown';
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
    const rank = (typeof s.rank === 'number') ? s.rank : 50;
    const signalScore = ({ BUY: 18, WATCH: 8, HOLD: 2 })[s.signal] || 0;
    const rsi = Number(s.rsi);
    const rsiScore = Number.isFinite(rsi) ? (rsi >= 35 && rsi <= 62 ? 5 : rsi > 75 ? -12 : rsi < 25 ? -6 : 0) : 0;
    const capScore = Math.min(10, Math.max(0, Math.log10(Math.max(1, Number(s.mcap || 1))) * 2));
    const pct = (ld && ld.pct != null && Number.isFinite(Number(ld.pct))) ? Number(ld.pct) : null;
    const liveScore = pct == null ? 0 : Math.max(-5, Math.min(5, pct));
    const repeatPenalty = recent[s.sym] ? 25 : 0;
    const score = rank + signalScore + rsiScore + capScore + liveScore - repeatPenalty;
    return {
      sym: s.sym, name: s.name, sector: s.sector, signal: s.signal, mcap: s.mcap, rsi: s.rsi,
      rank: (typeof s.rank === 'number' ? s.rank : null), quantSignal: s.quantSignal || null, factorScores: s.factorScores || null,
      ret3m: (typeof s.ret3m === 'number' ? s.ret3m : null), vol: (typeof s.vol === 'number' ? s.vol : null),
      ...quoteFields(s.sym, ld), pct, memo: (s.memo || '').slice(0, 90),
      market: inferTickerMarket(s.sym, s.index), capBucket: capBucket(s.mcap), diversityScore: Math.round(score), repeatPenalty
    };
  }).sort((a, b) => b.diversityScore - a.diversityScore);

  // P626-followup/T825: count the suppressed repeats from the full set, before the non-repeat narrowing below
  // (counting after it always returned 0).
  const recentSuppressed = eligible.filter((r) => r.repeatPenalty > 0).length;
  const nonRepeat = eligible.filter((r) => r.repeatPenalty === 0);
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

export function runScreenerQuery(query, { rows = [], live = {}, aliases = {}, recentTickers = [] } = {}) {
  try {
    const db = rowList(rows);
    if (!db.length) return null;
    const q = String(query || '').toLowerCase();
    const crit = {}, labels = [];

    if (/매수\s*(시그널|종목)?|buy\b|사야|살\s*만|저평가\s*매수/.test(q)) crit.signal = 'BUY';
    else if (/관망|watch\b/.test(q)) crit.signal = 'WATCH';
    else if (/매도|sell\b|팔\s*/.test(q)) crit.signal = 'SELL';
    else if (/보유|hold\b/.test(q)) crit.signal = 'HOLD';
    if (crit.signal) labels.push('시그널=' + crit.signal);

    // v59.45 (pipeline review P13-SCREEN-03): "미만/below" and "이하" were one inclusive bound (and "초과/over" one with
    // "이상"), so "rsi 30 미만" kept RSI 30. Each bound keeps whether its end is included; a range "30 이상 70 미만" reads both ends.
    const bound = (value, op) => ({ value: +value, inclusive: /^(?:이하|이상|<=|>=)$/.test(op) });
    const range = q.match(/rsi\s*(\d{1,3})\s*(이상|초과)\s*[~,-]?\s*(\d{1,3})\s*(이하|미만)/);
    const underAfter = q.match(/rsi\s*(\d{1,3})\s*(이하|미만|under|below|아래|<=?)/), underBefore = q.match(/(이하|미만|under|below)\s*rsi\s*(\d{1,3})/);
    const overAfter = q.match(/rsi\s*(\d{1,3})\s*(이상|초과|over|above|위|>=?)/), overBefore = q.match(/(이상|초과|over|above)\s*rsi\s*(\d{1,3})/);
    const rsiUnder = range ? bound(range[3], range[4]) : underAfter ? bound(underAfter[1], underAfter[2]) : underBefore ? bound(underBefore[2], underBefore[1]) : null;
    const rsiOver = range ? bound(range[1], range[2]) : overAfter ? bound(overAfter[1], overAfter[2]) : overBefore ? bound(overBefore[2], overBefore[1]) : null;
    if (rsiUnder) { crit.rsiMax = rsiUnder.value; crit.rsiMaxInclusive = rsiUnder.inclusive; labels.push((rsiUnder.inclusive ? 'RSI≤' : 'RSI<') + crit.rsiMax); }
    if (rsiOver)  { crit.rsiMin = rsiOver.value; crit.rsiMinInclusive = rsiOver.inclusive; labels.push((rsiOver.inclusive ? 'RSI≥' : 'RSI>') + crit.rsiMin); }
    if (crit.rsiMax == null && crit.rsiMin == null) {
      if (/과매도|oversold|침체\s*구간/.test(q)) { crit.rsiMax = 35; labels.push('과매도(RSI≤35)'); }
      else if (/과매수|과열|overbought/.test(q)) { crit.rsiMin = 65; labels.push('과매수(RSI≥65)'); }
    }

    if (/메가캡|mega\s*-?cap/.test(q)) { crit.mcapMin = 500; labels.push('메가캡(≥$500B)'); }
    else if (/대형주|large\s*-?cap/.test(q)) { crit.mcapMin = 100; labels.push('대형주(≥$100B)'); }
    else if (/중형주|mid\s*-?cap/.test(q)) { crit.mcapMin = 10; crit.mcapMax = 100; labels.push('중형주($10~100B)'); }
    else if (/소형주|small\s*-?cap/.test(q)) { crit.mcapMax = 10; labels.push('소형주(<$10B)'); }

    const { matched: matchedSector, matchedKey: secKey } = longestSectorMatch(q);

    let themeTickers = null, themeKey = '';
    const aliasMap = aliases && typeof aliases === 'object' ? aliases : {};
    Object.keys(aliasMap).forEach((kw) => {
      if (q.indexOf(kw.toLowerCase()) >= 0 && Array.isArray(aliasMap[kw]) && (!themeTickers || kw.length > themeKey.length)) { themeTickers = aliasMap[kw]; themeKey = kw; }
    });
    if (themeTickers && themeTickers.length && themeKey.length >= secKey.length) {
      crit.themeSet = {}; themeTickers.forEach((t) => { crit.themeSet[t] = true; }); labels.push('테마=' + themeKey);
    } else if (matchedSector) { crit.sectors = matchedSector; labels.push('섹터=' + secKey); }

    if (/s&p|sp\s*500|에스앤피/.test(q)) { crit.index = 'SP500'; labels.push('S&P500'); }
    else if (/다우|dow\b/.test(q)) { crit.index = 'DOW30'; labels.push('다우30'); }
    else if (/나스닥|nasdaq/.test(q)) { crit.index = 'NASDAQ'; labels.push('나스닥'); }

    if (/급등|상승\s*(종목|률)?|오른|gainer|올라/.test(q)) { crit.dir = 'up'; labels.push('상승 종목'); }
    else if (/급락|하락\s*(종목|률)?|내린|loser|떨어/.test(q)) { crit.dir = 'down'; labels.push('하락 종목'); }

    if (/퀀트|quant|팩터|factor|랭킹|순위|우량|상위\s*종목|best\b|top\s*\d*/.test(q)) { crit.byRank = true; labels.push('퀀트 랭킹순'); }

    const isBroadRecommendation = isBroadRecommendationQuery(q);
    const onlyGenericRank = crit.byRank && labels.length === 1 && !crit.signal && crit.rsiMax == null && crit.rsiMin == null &&
      crit.mcapMin == null && crit.mcapMax == null && !crit.sectors && !crit.themeSet && !crit.index && !crit.dir;
    if (isBroadRecommendation && (labels.length === 0 || onlyGenericRank)) {
      const diversified = buildDiversifiedRecommendationRows(db, live || {}, { recentTickers });
      return { matched: true, mode: 'diversified-recommendation',
        criteria: onlyGenericRank ? ['균형 추천 후보', '퀀트 랭킹 참고'] : ['균형 추천 후보'],
        rows: diversified.rows, totalMatched: diversified.totalMatched, diversity: diversified.diversity, recentSuppressed: diversified.recentSuppressed };
    }

    if (labels.length === 0) return null;

    const quotes = live || {};
    let mcapUnknown = 0;
    const matchedRows = db.filter((s) => {
      if (crit.signal && s.signal !== crit.signal) return false;
      const rsi = typeof s.rsi === 'number' && Number.isFinite(s.rsi) ? s.rsi : null;
      if (crit.rsiMax != null && !(rsi != null && (crit.rsiMaxInclusive !== false ? rsi <= crit.rsiMax : rsi < crit.rsiMax))) return false;
      if (crit.rsiMin != null && !(rsi != null && (crit.rsiMinInclusive !== false ? rsi >= crit.rsiMin : rsi > crit.rsiMin))) return false;
      if ((crit.mcapMin != null || crit.mcapMax != null) && !knownCap(s.mcap)) { mcapUnknown += 1; return false; }
      if (crit.mcapMin != null && !(s.mcap >= crit.mcapMin)) return false;
      if (crit.mcapMax != null && !(s.mcap < crit.mcapMax)) return false;
      if (crit.sectors && !crit.sectors.some((sec) => s.sector === sec)) return false;
      if (crit.index && s.index !== crit.index) return false;
      if (crit.themeSet && !crit.themeSet[s.sym]) return false;
      if (crit.dir) {
        const ldp = quotes[s.sym]; const pct = (ldp && ldp.pct != null) ? ldp.pct : null;
        if (pct == null) return false;
        if (crit.dir === 'up' && !(pct > 0)) return false;
        if (crit.dir === 'down' && !(pct < 0)) return false;
      }
      return true;
    }).map((s) => {
      const ld = quotes[s.sym] || {};
      return { sym: s.sym, name: s.name, sector: s.sector, signal: s.signal, mcap: s.mcap, rsi: s.rsi,
        rank: (typeof s.rank === 'number' ? s.rank : null), quantSignal: s.quantSignal || null, factorScores: s.factorScores || null,
        ret3m: (typeof s.ret3m === 'number' ? s.ret3m : null), vol: (typeof s.vol === 'number' ? s.vol : null),
        ...quoteFields(s.sym, ld), pct: ld.pct != null ? ld.pct : null, memo: (s.memo || '').slice(0, 90),
        // 2026-10-13 news audit N02: only a memo whose headline names this issuer (producer newsMemoVerified) reaches
        // the AI as this stock's news; an unverified memo was another company's story about 1 time in 5.
        newsMemo: s.newsMemoVerified === true ? (s.newsMemo || '').slice(0, 200) : '' };
    });

    matchedRows.sort((a, b) => {
      if (crit.byRank) return (b.rank == null ? -1 : b.rank) - (a.rank == null ? -1 : a.rank);
      if (crit.dir === 'up') return (b.pct == null ? -999 : b.pct) - (a.pct == null ? -999 : a.pct);
      if (crit.dir === 'down') return (a.pct == null ? 999 : a.pct) - (b.pct == null ? 999 : b.pct);
      if (crit.rsiMax != null) return (a.rsi == null ? 999 : a.rsi) - (b.rsi == null ? 999 : b.rsi);
      if (crit.rsiMin != null) return (b.rsi == null ? -999 : b.rsi) - (a.rsi == null ? -999 : a.rsi);
      if (a.rank != null && b.rank != null) return b.rank - a.rank;
      return (b.mcap || 0) - (a.mcap || 0);
    });

    return { matched: true, criteria: labels, rows: matchedRows.slice(0, 12), totalMatched: matchedRows.length, mcapUnknown };
  } catch (_) { return null; }
}

export function formatScreenerResultPrompt(result, { rankAsOf = null } = {}) {
  if (!result || !result.matched || !result.rows || !result.rows.length) return '';
  const fmt = (v, d) => (v != null && !isNaN(v) ? Number(v).toFixed(d || 1) : 'N/A');
  const signedPct = (v) => (v != null && !isNaN(v) ? (v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : 'N/A');
  // AIQ-P0-06: never replace producer observation time with browser generation time.
  const ts = result.observedAt || result.asOf || rankAsOf || '관측시각 미확인';
  const lines = [];
  const isDiversified = result.mode === 'diversified-recommendation';
  lines.push('═══════════════════════════════════════════════════');
  lines.push(isDiversified ? '【균형 추천 후보 — AIO 종목 DB 분산 샘플링】' : '【스크리너 결과 — AIO 종목 DB 실시간 필터링】');
  lines.push('조건: ' + result.criteria.join(' · ') + ' | 매칭 ' + result.totalMatched + '종목 (상위 ' + result.rows.length + ' 표시)' + (result.mcapUnknown ? ' · 시총 확인 안 됨 ' + result.mcapUnknown + '종목은 크기 조건을 판정하지 못해 제외' : ''));
  lines.push('출처: AIO SCREENER_DB(기관 메모·시그널) × 멀티팩터 퀀트 랭크 × 실시간 시세(_liveData) · 생산자 관측시각 ' + ts);
  const fAsOf = rankAsOf ? String(rankAsOf).slice(0, 10) : null;
  lines.push('퀀트 백분위(같은 조건 종목 중 위치, 100점 만점이 아님) = 섹터 상대 멀티팩터: 모멘텀(1/3/6M 수익률)·추세(SMA50/200 대비)·저변동(연율 변동성↓)·사이즈. ' + (fAsOf ? '팩터 기준일 ' + fAsOf : '팩터 데이터 대기 — 시그널/메모는 editorial(애널리스트 노트)') + '.');
  if (isDiversified) {
    const dv = result.diversity || {};
    lines.push('분산 설계: 섹터 ' + (dv.sectorCount || '?') + '개 · 시장/지역 ' + (dv.marketCount || '?') + '개 · 시총 버킷 ' + (dv.capBucketCount || '?') + '개. 최근 대화 반복 티커는 점수 감점: ' + (result.recentSuppressed || 0) + '개.');
    lines.push('이 목록은 넓은 "종목 추천" 질문에서 특정 섹터/기업으로 과도하게 수렴하지 않도록 만든 후보군이다. 최종 답변은 이 후보군에서 3~5개만 골라야 하며, 같은 섹터·테마는 최대 2개까지만 선택하라.');
  } else {
    lines.push('이 목록은 앱 내부 종목 DB를 실제 필터링·랭킹한 결과다. 학습 데이터로 종목을 추가하거나 임의 변경하지 말고 아래 목록만 사용하라.');
  }
  lines.push('═══════════════════════════════════════════════════');
  result.rows.forEach((r, i) => {
    const rankStr = (r.rank != null) ? ('퀀트 백분위 ' + r.rank + '(' + (r.quantSignal || '') + ')') : '퀀트 N/A';
    const fsStr = r.factorScores ? (' [모멘텀' + r.factorScores.momentum + '·추세' + r.factorScores.trend + '·저변동' + r.factorScores.lowvol + ']') : '';
    const divStr = isDiversified ? (' · ' + (r.market || 'US') + '/' + (r.capBucket || 'unknown') + ' · 분산점수 ' + (r.diversityScore != null ? r.diversityScore : 'N/A')) : '';
    lines.push((i + 1) + '. ' + r.sym + ' (' + r.name + ') · ' + r.sector + divStr + ' · ' + rankStr + fsStr +
      ' · 시그널(editorial) ' + r.signal + ' · 시총 ' + (r.mcap ? '$' + r.mcap + 'B' : 'N/A') + ' · RSI ' + fmt(r.rsi, 0) +
      ' · 3M ' + signedPct(r.ret3m) + ' · 가격 ' + (r.price != null && Number.isFinite(Number(r.price)) ? formatScreenerPrice(Number(r.price), r.currency || null) + (r.priceObservedAt ? ' (관측 ' + r.priceObservedAt + ')' : '') : 'N/A') + ' (' + signedPct(r.pct) + ')');
    if (r.memo) lines.push('   메모: ' + r.memo);
    if (r.newsMemo) lines.push('   최신뉴스(제목만, 발행 주체 확인됨): ' + r.newsMemo);
  });
  lines.push('');
  if (isDiversified) {
    lines.push('답변 지침: (1) 먼저 "후보군을 넓게 분산해 봤다"고 밝히고 (2) 성장/퀄리티/방어/경기민감/한국·글로벌 중 최소 3개 관점으로 3~5개를 선택 (3) 제외·보류 후보 2~3개와 이유 제시 (4) 사용자가 공격형/방어형/한국주 선호를 밝히면 다음 답변에서 재랭킹하겠다고 안내. CEG·전력·AVGO·AI 반도체 같은 기존 강한 테마가 포함돼도 자동 1순위로 두지 말고, 비AI/비전력 대안과 비교해 상대 우위가 있을 때만 선택하라. 후보와 수치 근거는 후보군 안에서 제시하되, 사용자가 더 넓은 탐색을 원하면 어떤 조건(시장·섹터·시총·위험도)으로 SCREENER_DB를 다시 펼치면 되는지 안내하라.');
  } else {
    lines.push('답변 지침: 위 목록을 사용자 조건에 맞춰 (1) 퀀트 랭크 기준 순위/표 (2) 상위 종목 선정 이유(어느 팩터가 강한지) (3) 주의·제외 사유 (4) 다음 행동 순으로 해설. 퀀트 랭크(객관·데이터)와 시그널/메모(editorial·애널리스트)를 구분해 설명하라. 가격은 위 값 그대로 인용하고 (기준시각) 괄호를 붙여라. 목록에 없는 종목을 새로 만들지 마라.');
  }
  return '\n\n' + lines.join('\n') + '\n';
}

// E2/S-E (P1239): the general and unified chats share one sequence — recent-ticker extraction, query, prompt.
export function buildScreenerAiContext(query, messages, { rows = [], live = {}, aliases = {}, rankAsOf = null, logger = null } = {}) {
  let result = null;
  try {
    const recentTickers = extractRecentRecommendationTickers(messages, { rows });
    result = runScreenerQuery(query, { rows, live, aliases, recentTickers });
    if (!(result && result.matched)) return { result: result || null, prompt: '' };
    return { result, prompt: formatScreenerResultPrompt(result, { rankAsOf }) || '' };
  } catch (e) {
    if (typeof logger === 'function') logger(e);
    return { result, prompt: '' };
  }
}
