// v59.43 (owner audit 2026-10-28): the market's biggest scheduled events — the FOMC decision and the earnings of a fixed
// market-mover list — each get a short brief built in Actions (scripts/fetch-event-briefs.mjs) from the primary source:
// the Fed statement, the company's 8-K/6-K Ex.99.1 on EDGAR, the DART 공정공시. This module is shared by the producer
// and the screens: the mover list, the number check that drops any figure the fetched source text does not contain,
// the DART preliminary-results table parser, and the selectors 오늘 and 종목 read.

export const EVENT_BRIEFS_SCHEMA = 'event-briefs.v1';

// The fixed list (owner 2026-10-28). `newsNames` are the exact names a headline uses (src/domain/market/move-attribution.js
// matches them by the shared keyword rule). `irDomains` limit the call-summary search to the company's own pages plus wires.
// CIKs are not listed: the producer resolves them from SEC company_tickers.json by exact ticker. Korean names resolve
// through DART by corp code, and the producer checks the filing names the same company before using it.
export const MARKET_MOVERS = Object.freeze([
  { sym: 'MSFT', nameKo: '마이크로소프트', newsNames: ['Microsoft'], irDomains: ['microsoft.com'] },
  { sym: 'GOOGL', nameKo: '알파벳', newsNames: ['Alphabet', 'Google'], irDomains: ['abc.xyz'] },
  { sym: 'AMZN', nameKo: '아마존', newsNames: ['Amazon'], irDomains: ['aboutamazon.com', 'amazon.com'] },
  { sym: 'META', nameKo: '메타', newsNames: ['Meta Platforms', 'Meta'], irDomains: ['atmeta.com', 'meta.com'] },
  { sym: 'AAPL', nameKo: '애플', newsNames: ['Apple'], irDomains: ['apple.com'] },
  { sym: 'NVDA', nameKo: '엔비디아', newsNames: ['Nvidia'], irDomains: ['nvidia.com'] },
  { sym: 'AVGO', nameKo: '브로드컴', newsNames: ['Broadcom'], irDomains: ['broadcom.com'] },
  { sym: 'TSM', nameKo: 'TSMC', newsNames: ['TSMC'], irDomains: ['tsmc.com'], foreignIssuer: true },
  { sym: 'ORCL', nameKo: '오라클', newsNames: ['Oracle'], irDomains: ['oracle.com'] },
  { sym: 'TSLA', nameKo: '테슬라', newsNames: ['Tesla'], irDomains: ['tesla.com'] },
  { sym: 'MU', nameKo: '마이크론', newsNames: ['Micron'], irDomains: ['micron.com'] },
  // v59.43 (owner 2026-10-29): ServiceNow's report moves enterprise-software names the same way the hyperscalers move AI hardware.
  { sym: 'NOW', nameKo: '서비스나우', newsNames: ['ServiceNow'], irDomains: ['servicenow.com'] },
  { sym: '000660.KS', nameKo: 'SK하이닉스', market: 'KR', dartCorpCode: '00164779', dartName: 'SK하이닉스', newsNames: ['SK Hynix', 'SK하이닉스', '하이닉스'], irDomains: ['skhynix.com'] },
  { sym: '005930.KS', nameKo: '삼성전자', market: 'KR', dartCorpCode: '00126380', dartName: '삼성전자', newsNames: ['Samsung Electronics', '삼성전자'], irDomains: ['samsung.com'] }
].map(Object.freeze));

export const MOVER_BY_SYMBOL = Object.freeze(Object.fromEntries(MARKET_MOVERS.map((row) => [row.sym, row])));

// Wires and business news allowed beside the issuer's own pages when a call or press conference is summarised from
// reports (the transcript comes later or never as free text).
export const NEWS_REPORT_DOMAINS = Object.freeze(['reuters.com', 'apnews.com', 'cnbc.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'marketwatch.com', 'yna.co.kr']);

// ---- the number check ---------------------------------------------------------------------------------------------
// A figure counts as present when its digits (commas dropped) stand as a whole number in the source. Quarter ordinals
// (Q3, 3분기) are words, not figures, and are not checked.
const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;
const ORDINAL_RE = /(?:\bQ[1-4]\b|[1-4]\s*분기|\b[1-4](?:st|nd|rd|th)\b|\bFY\s?\d{2,4}\b|\bH[12]\b|[12]\s*반기)/gi;

export function normalizeSourceText(text) {
  return String(text ?? '')
    .replace(/[‘’‛′]/g, "'").replace(/[“”″]/g, '"').replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** The numeric tokens of `text` (commas removed), quarter ordinals skipped. */
export function numberTokens(text) {
  const cleaned = String(text ?? '').replace(ORDINAL_RE, ' ');
  return [...cleaned.matchAll(NUMBER_RE)].map((m) => m[0].replace(/,/g, '').replace(/\.$/, '')).filter((token) => token !== '');
}

/** An index of the source's numbers for repeated checks. */
export function sourceNumberSet(sourceText) {
  return new Set(numberTokens(normalizeSourceText(sourceText)).flatMap((token) => {
    // "104.60" also stands for "104.6"; "3.50" for "3.5".
    const out = [token];
    if (/\.\d*0$/.test(token)) out.push(token.replace(/0+$/, '').replace(/\.$/, ''));
    return out;
  }));
}

/** The tokens of `text` the source does not contain. Empty = every figure is in the source. */
export function unverifiedNumbers(text, numbers) {
  return numberTokens(text).filter((token) => !numbers.has(token) && !numbers.has(token.replace(/\.0+$/, '')));
}

const squash = (text) => normalizeSourceText(text).toLowerCase();

/**
 * Keeps an AI item only when its quote is found in the source and every figure in its text appears in that quote and in
 * the source. Returns { kept, dropped } with the drop reason for the ledger.
 */
export function verifyQuotedItems(items, sourceText, { textKeys = ['label', 'value', 'text'] } = {}) {
  const source = squash(sourceText);
  const numbers = sourceNumberSet(sourceText);
  const kept = [];
  const dropped = [];
  for (const item of Array.isArray(items) ? items : []) {
    const quote = String(item?.quote || '');
    const body = textKeys.map((key) => item?.[key]).filter((value) => typeof value === 'string').join(' ');
    if (!quote || !source.includes(squash(quote))) { dropped.push({ reason: 'quote-not-in-source', text: body.slice(0, 120) }); continue; }
    const quoteNumbers = sourceNumberSet(quote);
    const missing = unverifiedNumbers(body, numbers).concat(numberTokens(body).filter((token) => !quoteNumbers.has(token) && !quoteNumbers.has(token.replace(/\.0+$/, ''))));
    if (missing.length) { dropped.push({ reason: 'number-not-in-source', numbers: [...new Set(missing)].slice(0, 6), text: body.slice(0, 120) }); continue; }
    kept.push(item);
  }
  return { kept, dropped };
}

/** Free text (a call or press-conference point) is kept only when each figure appears in the fetched source. */
export function verifyFreeText(points, sourceText) {
  const numbers = sourceNumberSet(sourceText);
  const kept = [];
  const dropped = [];
  for (const point of Array.isArray(points) ? points : []) {
    const missing = unverifiedNumbers(point?.text, numbers);
    if (missing.length) dropped.push({ reason: 'number-not-in-source', numbers: [...new Set(missing)].slice(0, 6), text: String(point?.text || '').slice(0, 120) });
    else kept.push(point);
  }
  return { kept, dropped };
}

// ---- DART 연결재무제표기준영업(잠정)실적(공정공시) ---------------------------------------------------------------------
// The filing is a fixed form: unit line ("단위 : 백만원, %"), then per account a 당해실적 row with current, previous
// quarter, QoQ %, (turn flag), year-ago, YoY %. Parsed directly — no AI touches these numbers.
const DART_ACCOUNTS = Object.freeze([['revenue', '매출액'], ['operatingIncome', '영업이익'], ['pretaxIncome', '법인세비용차감전계속사업이익'], ['netIncome', '당기순이익']]);
const DART_UNITS = Object.freeze({ '원': 1, '천원': 1e3, '백만원': 1e6, '십억원': 1e9, '억원': 1e8 });

export function parseDartPreliminaryResults(text) {
  const t = normalizeSourceText(text);
  const unitLabel = (t.match(/단위\s*:\s*(백만원|천원|십억원|억원|원)/) || [])[1] || null;
  const period = t.match(/당기실적\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  const quarterLabel = (t.match(/\((\d{4})년\s*([1-4])분기\)/) || []).slice(1);
  if (!unitLabel || !period) return null;
  const num = (value) => (value == null || value === '-' ? null : Number(String(value).replace(/,/g, '')));
  const accounts = {};
  for (const [key, name] of DART_ACCOUNTS) {
    // "매출액 당해실적 104,615,483 79,318,746 31.9 - 24,448,929 327.9 -"
    const re = new RegExp(`(?:^|\\s)${name}\\s+당해실적\\s+(-?[\\d,]+)\\s+(-?[\\d,]+|-)\\s+(-?[\\d.]+|-)\\s+(\\S+)\\s+(-?[\\d,]+|-)\\s+(-?[\\d.]+|-)`);
    const m = t.match(re);
    if (!m) continue;
    accounts[key] = { label: name, current: num(m[1]), previous: num(m[2]), qoqPct: num(m[3]), yearAgo: num(m[5]), yoyPct: num(m[6]), raw: m[0].trim() };
  }
  if (!accounts.revenue && !accounts.operatingIncome) return null;
  return { unitLabel, unit: DART_UNITS[unitLabel], periodStart: period[1], periodEnd: period[2], quarter: quarterLabel.length ? `${quarterLabel[0]}년 ${quarterLabel[1]}분기` : null, accounts };
}

/** 104,615,483 백만원 → "104.62조원" (a unit conversion of the filed figure; the raw figure stays in `raw`). */
export function formatKrw(value, unit = 1) {
  const won = Number(value) * unit;
  if (!Number.isFinite(won)) return null;
  const abs = Math.abs(won);
  const sign = won < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}조원`;
  if (abs >= 1e8) return `${sign}${Math.round(abs / 1e8).toLocaleString('en-US')}억원`;
  return `${sign}${Math.round(abs).toLocaleString('en-US')}원`;
}

// ---- vs expectations -------------------------------------------------------------------------------------------------
// A reported figure is compared with the provider estimate only when its text parses to one amount.
export function parseUsdAmount(value) {
  const m = String(value ?? '').replace(/,/g, '').match(/\$\s*(\d+(?:\.\d+)?)\s*(trillion|billion|million|thousand)?/i);
  if (!m) return null;
  const scale = { trillion: 1e12, billion: 1e9, million: 1e6, thousand: 1e3 }[String(m[2] || '').toLowerCase()] || 1;
  return Number(m[1]) * scale;
}

export function surprisePct(actual, estimate) {
  if (!Number.isFinite(actual) || !Number.isFinite(estimate) || estimate === 0) return null;
  return Math.round(((actual - estimate) / Math.abs(estimate)) * 1000) / 10;
}

// ---- cost ------------------------------------------------------------------------------------------------------------
// The shared Worker's rate card (worker/openai-budget.mjs): input $0.1375/M, output $0.55/M, $0.011 per search call.
export const AI_RATE_CARD = Object.freeze({ inputUsdPerToken: 0.1375e-6, outputUsdPerToken: 0.55e-6, searchUsdPerCall: 0.011 });
export function estimateAiCostUsd({ inputTokens = 0, outputTokens = 0, searchCalls = 0 } = {}) {
  const usd = inputTokens * AI_RATE_CARD.inputUsdPerToken + outputTokens * AI_RATE_CARD.outputUsdPerToken + searchCalls * AI_RATE_CARD.searchUsdPerCall;
  return Math.round(usd * 1e5) / 1e5;
}

// ---- selectors for 오늘 and 종목 --------------------------------------------------------------------------------------
const DAY = 86400000;
const briefsOf = (artifact) => (artifact?.schemaVersion === EVENT_BRIEFS_SCHEMA && Array.isArray(artifact.briefs) ? artifact.briefs : []);
const publishedMs = (brief) => Date.parse(brief?.publishedAt || brief?.eventDate || '') || 0;

/** The briefs 오늘 lists: published within `days`, newest first. */
export function recentBriefs(artifact, { nowMs = Date.now(), days = 3, limit = 4 } = {}) {
  return briefsOf(artifact).filter((brief) => brief.status !== 'pending' && publishedMs(brief) <= nowMs + 3600000 && nowMs - publishedMs(brief) <= days * DAY)
    .sort((a, b) => publishedMs(b) - publishedMs(a)).slice(0, limit);
}

/** The latest brief for one symbol (종목 page), within ~one quarter. */
export function latestBriefFor(artifact, symbol, { nowMs = Date.now(), days = 100 } = {}) {
  const key = String(symbol || '').toUpperCase();
  return briefsOf(artifact).filter((brief) => String(brief.symbol || '').toUpperCase() === key && nowMs - publishedMs(brief) <= days * DAY)
    .sort((a, b) => publishedMs(b) - publishedMs(a))[0] || null;
}

export const BRIEF_BASIS_WORDS = Object.freeze({
  'primary-source': '원문 공시 기준',
  'news-report': '보도 기준(녹취록 확인 전)',
  'transcript': '녹취록 기준',
  'pending': '아직 정리 전'
});
