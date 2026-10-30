// v59.43 (owner audit 2026-10-28): the market's biggest scheduled events — the FOMC decision and the earnings of a fixed
// market-mover list — each get a short brief built in Actions (scripts/fetch-event-briefs.mjs) from the primary source:
// the Fed statement, the company's 8-K/6-K Ex.99.1 on EDGAR, the DART 공정공시. This module is shared by the producer
// and the screens: the mover list, the number check that drops any figure the fetched source text does not contain,
// the DART preliminary-results table parser, and the selectors 오늘 and 종목 read.

export const EVENT_BRIEFS_SCHEMA = 'event-briefs.v1';

import { MARKET_MOVERS, MOVER_BY_SYMBOL } from './market-movers.js';

export { MARKET_MOVERS, MOVER_BY_SYMBOL };

/** 1 = shown in full on 오늘 (FOMC, the core movers); 2 = one line (other movers and the story names). */
// v59.44 (owner 2026-10-30, "현재 AI 시장에서 중요한 종목"): weight comes from where a name sits on the AI chain and how
// hard the market took its report, not from its index weight. The company-story layers outside the chain are folded.
export const NON_AI_LAYERS = Object.freeze(['ai-adopter', 'ai-exposed', 'limited']);
export const MARKET_MOVING_PCT = 8; // a post-report move this large puts an AI-chain name on the face as a card

/** The move after the report: the latest trade before any session closed on it, else the first session's close. */
export function reactionPct(brief) {
  const reaction = brief?.reaction;
  const value = reaction?.basis === 'latest-trade' ? reaction.extendedPct : reaction?.firstPct;
  return Number.isFinite(value) ? value : null;
}

/**
 * 1 = a card (FOMC, the core movers, an AI-chain name that moved MARKET_MOVING_PCT or more); 2 = a line with its summary
 * folded (the other AI-chain names and listed movers); 3 = only in the 30-day fold (story names outside the AI chain).
 */
export function briefTier(brief) {
  if (brief?.kind === 'fomc') return 1;
  if (Number(brief?.tier) === 1 || MOVER_BY_SYMBOL[brief?.symbol]?.tier === 1) return 1;
  if (!MOVER_BY_SYMBOL[brief?.symbol] && NON_AI_LAYERS.includes(brief?.layer)) return 3;
  return Math.abs(reactionPct(brief) ?? 0) >= MARKET_MOVING_PCT ? 1 : 2;
}

// Wires and business news allowed beside the issuer's own pages when a call or press conference is summarised from
// reports (the transcript comes later or never as free text).
export const NEWS_REPORT_DOMAINS = Object.freeze(['reuters.com', 'apnews.com', 'cnbc.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'marketwatch.com', 'yna.co.kr']);
// v59.44 (first live run: 3 of 4 searches found nothing behind the paywalled wires): why a stock moved is also read
// from open market desks and the Korean economic press (ten domains, the search body's limit). Company IR is left out:
// a release does not report the reaction.
export const REACTION_REPORT_DOMAINS = Object.freeze(['reuters.com', 'apnews.com', 'cnbc.com', 'marketwatch.com', 'finance.yahoo.com', 'investing.com',
  'barrons.com', 'yna.co.kr', 'hankyung.com', 'mk.co.kr']);
// A line that only says the reason was not found is not a reason.
export const isNoReasonText = (text) => /(찾지 못|확인하지 못|확인할 근거|뒷받침되지 않|확인되지 않|알 수 없|정리할 수 없|근거가 없|확인해 ?주지)/.test(String(text || ''));
// v59.44 (10/30 live data): a reason stored before the outlet list changed can point at the company's own IR page or a
// paywalled outlet ("회사 자료는 … 확인해 주지는 않습니다"); a stored reason is kept only from the current outlets.
export function onReportDomain(url, domains = REACTION_REPORT_DOMAINS) {
  let host = '';
  try { host = new URL(String(url || '')).hostname.toLowerCase(); } catch { return false; }
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

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
// Samsung files in 조원 with decimals ("195.25"); the table was read as integers in 백만원 only (P2136).
const DART_UNITS = Object.freeze({ '원': 1, '천원': 1e3, '백만원': 1e6, '십억원': 1e9, '억원': 1e8, '조원': 1e12 });
const DART_AMOUNT = '-?[\\d,]+(?:\\.\\d+)?';

export function parseDartPreliminaryResults(text) {
  const t = normalizeSourceText(text);
  const unitLabel = (t.match(/단위\s*:\s*(백만원|천원|십억원|조원|억원|원)/) || [])[1] || null;
  const period = t.match(/당기실적\s*(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
  // Samsung heads the columns "(26.3Q) (26.2Q)": the first is the current quarter.
  const short = t.match(/\(\s*'?(\d{2})\.([1-4])Q\s*\)/);
  const quarterLabel = short ? [`20${short[1]}`, short[2]] : (t.match(/\((\d{4})년\s*([1-4])분기\)/) || []).slice(1);
  if (!unitLabel || !period) return null;
  const num = (value) => (value == null || value === '-' ? null : Number(String(value).replace(/,/g, '')));
  const accounts = {};
  for (const [key, name] of DART_ACCOUNTS) {
    // "매출액 당해실적 104,615,483 79,318,746 31.9 - 24,448,929 327.9 -"
    const re = new RegExp(`(?:^|\\s)${name}\\s+당해실적\\s+(${DART_AMOUNT})\\s+(${DART_AMOUNT}|-)\\s+(-?[\\d.]+|-)\\s+(\\S+)\\s+(${DART_AMOUNT}|-)\\s+(-?[\\d.]+|-)`);
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

/**
 * v59.44: 오늘 by weight. `core` = tier 1 of the last three days, in full; `notable` = tier 2 of the last five days, one line
 * each; `rest` = every other brief of the last 30 days, folded, so nothing published is out of reach.
 */
export function homeBriefTiers(artifact, { nowMs = Date.now(), coreLimit = 4, notableLimit = 8, restLimit = 24 } = {}) {
  const live = briefsOf(artifact).filter((brief) => brief.status !== 'pending' && publishedMs(brief) <= nowMs + 3600000)
    .sort((a, b) => publishedMs(b) - publishedMs(a));
  const within = (brief, days) => nowMs - publishedMs(brief) <= days * DAY;
  // v59.44 (first live earnings week: 17 tier-1 lines): FOMC first; then the listed core names and moves of 15% or more,
  // newest first (INTC -23% after hours ahead of a two-day-old GOOGL); then the other tier-1 reports by the size of the move.
  const rank = (brief) => (brief.kind === 'fomc' ? 0
    : Number(brief.tier) === 1 || MOVER_BY_SYMBOL[brief.symbol]?.tier === 1 || Math.abs(reactionPct(brief) ?? 0) >= 15 ? 1 : 2);
  const tier1 = live.filter((brief) => briefTier(brief) === 1 && within(brief, 3))
    .sort((a, b) => (rank(a) - rank(b)) || (rank(a) === 2 ? Math.abs(reactionPct(b) ?? 0) - Math.abs(reactionPct(a) ?? 0) : 0) || (publishedMs(b) - publishedMs(a)));
  const core = tier1.slice(0, coreLimit);
  // A tier-1 report past the card limit stays on the face as a line, ahead of tier 2; the face holds notableLimit lines.
  const notable = [...tier1.slice(coreLimit), ...live.filter((brief) => briefTier(brief) === 2 && within(brief, 5))].slice(0, notableLimit);
  const shown = new Set([...core, ...notable]);
  const rest = live.filter((brief) => !shown.has(brief) && within(brief, 30));
  return { core, notable, rest: rest.slice(0, restLimit), restTotal: rest.length };
}

// ---- the price after the report ----------------------------------------------------------------------------------
const EXCHANGE_ZONE = Object.freeze({ US: ['America/New_York', 16], KR: ['Asia/Seoul', 15.5] });

/** The exchange date of a release and whether it came after that day's close (a date-only filing counts as before). */
export function releaseSession(publishedAt, { market = 'US', dateOnly = false } = {}) {
  const ms = Date.parse(publishedAt || '');
  if (!Number.isFinite(ms)) return null;
  const [zone, closeHour] = EXCHANGE_ZONE[market] || EXCHANGE_ZONE.US;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour) + Number(parts.minute) / 60;
  return { releaseDate: `${parts.year}-${parts.month}-${parts.day}`, afterClose: !dateOnly && hour >= closeHour };
}

const pctOf = (close, base) => Math.round((close / base - 1) * 1000) / 10;

/**
 * Closes around a report: the last close before it, the first session that could trade on it, and the latest close.
 * `bars` are daily [{ date: 'YYYY-MM-DD', close }] in exchange dates. Settled once five sessions have traded on it.
 */
export function earningsReaction(bars, session, { settleSessions = 5, extended = null, releaseMs = null } = {}) {
  if (!session?.releaseDate) return null;
  const rows = (Array.isArray(bars) ? bars : []).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row?.date || '') && Number(row.close) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const beforeOrOn = (row) => (session.afterClose ? row.date <= session.releaseDate : row.date < session.releaseDate);
  const base = rows.filter(beforeOrOn).at(-1);
  const after = rows.filter((row) => !beforeOrOn(row));
  if (!base) return null;
  // Until a regular session after the report has closed, the latest trade (extended hours or a session still open) is all
  // there is (owner 2026-10-30).
  if (!after.length) {
    const atMs = Number(extended?.atMs);
    if (!(Number(extended?.price) > 0) || !Number.isFinite(atMs) || (Number.isFinite(releaseMs) && atMs < releaseMs)) return null;
    return { basis: 'latest-trade', baseDate: base.date, baseClose: base.close, extendedPct: pctOf(extended.price, base.close), extendedAt: new Date(atMs).toISOString(), sessions: 0, settled: false };
  }
  const first = after[0];
  const latest = after.at(-1);
  return { basis: 'close', baseDate: base.date, baseClose: base.close, firstDate: first.date, firstPct: pctOf(first.close, base.close),
    latestDate: latest.date, latestPct: pctOf(latest.close, base.close), sessions: after.length, settled: after.length >= settleSessions };
}

/** "발표 후 첫 거래일 -7.9%, 3거래일 누적 -5.1%" or "발표 후 최근 체결가 -21.0%(직전 종가 대비)" — prices only. */
export function reactionText(reaction) {
  const signedPct = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  if (reaction?.basis === 'latest-trade' && Number.isFinite(reaction.extendedPct)) return `발표 후 최근 체결가 ${signedPct(reaction.extendedPct)}(직전 종가 대비)`;
  if (!reaction || !Number.isFinite(reaction.firstPct)) return null;
  const first = `발표 후 첫 거래일 ${signedPct(reaction.firstPct)}`;
  if (!(reaction.sessions > 1)) return first;
  // v59.44 (X bookmarks 10/30, "3-day rule"): from the third session on, whether the move kept going after the first day
  // or gave part of it back — the path, not a buy or sell signal.
  const gap = reaction.latestPct - reaction.firstPct;
  const path = reaction.sessions >= 3 && Math.abs(reaction.firstPct) >= 3 && Math.abs(gap) >= 1
    ? (Math.sign(gap) === Math.sign(reaction.firstPct) ? `, 첫날 뒤에도 더 ${reaction.firstPct < 0 ? '내림' : '오름'}` : `, 첫날 ${reaction.firstPct < 0 ? '낙폭' : '상승'} 일부 되돌림`) : '';
  return `${first}, ${reaction.sessions}거래일 누적 ${signedPct(reaction.latestPct)}${path}`;
}

// ---- headline --------------------------------------------------------------------------------------------------------
/**
 * A Korean headline, or one built from the first checked figure. An English title copied from the release, or a line
 * with a figure the source does not hold, is replaced (P2137: GOOGL showed its English press-release title and MSFT the
 * bare "실적 발표").
 */
export function briefHeadline(text, { nameKo, figures = [], sourceNumbers = null } = {}) {
  const value = String(text || '').trim();
  const generic = `${nameKo} 실적 발표`;
  // v59.44 (first live run): a release title left in English inside a Korean line ("Fiscal First Quarter 2027 실적
  // 발표") or an amount kept in the filing's thousands ("$1,902,418천") is rebuilt from the figures as well.
  const english = /[A-Za-z]{2,}(?:[\s-]+[A-Za-z]{2,}){2,}/.test(value);
  const rawUnit = /\$[\d,]+\s*천/.test(value);
  if (value && /[가-힣]/.test(value) && value !== generic && !english && !rawUnit && (!sourceNumbers || !unverifiedNumbers(value, sourceNumbers).length)) return value;
  const lead = figures.find((figure) => figure?.metric === 'revenue') || figures[0];
  return lead?.value ? `${nameKo} 실적: ${String(lead.label || '').trim()} ${lead.value}`.replace(/\s+/g, ' ').trim() : generic;
}

export const BRIEF_BASIS_WORDS = Object.freeze({
  'primary-source': '원문 공시 기준',
  'news-report': '보도 기준(녹취록 확인 전)',
  'transcript': '녹취록 기준',
  'pending': '아직 정리 전',
  'provider': '제공처 집계, 원문 확인 전'
});
