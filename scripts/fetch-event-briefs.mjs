#!/usr/bin/env node
// v59.43 (owner audit 2026-10-28): briefs for the market's biggest scheduled events, written to
// public-data/event-briefs.json by .github/workflows/event-briefs.yml (producers run only in Actions; locally this runs
// only with --fixture and --out).
//
// Events and sources (primary first):
// - FOMC decision: the statement on federalreserve.gov (and the previous statement, for the wording changes). The chair's
//   press conference is summarised from reports first (basis 'news-report'); the Fed's transcript link is attached
//   once it appears. The transcript is a PDF and is not parsed, so the summary keeps its report basis.
// - Earnings of the fixed mover list (src/domain/briefing/event-briefs.js MARKET_MOVERS): US issuers from the 8-K
//   Item 2.02 Ex.99.1 (6-K exhibit for TSMC) on EDGAR; Korean issuers from the DART 연결재무제표기준영업(잠정)실적 공정공시,
//   whose table is parsed directly. The call is summarised from the issuer's pages and wires (basis 'news-report').
//
// The shared Worker AI (gpt-6-luna) writes the Korean summary as structured items, each with the source sentence it
// came from. An item whose quote is not in the fetched source, or whose figure is not in its quote, is dropped; a call
// or press-conference point whose figure is not in the fetched source is dropped. Each brief records its AI usage and
// estimated cost on the Worker rate card; a brief costs about $0.003 without search and $0.015-0.02 with one search.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { loadThemeMaps } from './build-scenario-state.mjs';
import { pdfText, readableEnglish } from './lib/pdf-text.mjs';
import { createSecClient, requireSecUserAgent, filingIndexUrl } from './lib/sec-edgar.mjs';
import { SEC_TICKERS_URL, submissionsUrl, submissionTextUrl, tickerCikMap, filingRowsWithItems, isResultsFiling, resultsExhibit, looksLikeQuarterlyResults, htmlToText } from './lib/sec-results-filings.mjs';
import { SHARED_AI_MODEL, resolveSharedAiConfig, extractCompletedResponseText, buildSharedWebSearchBody } from './lib/ai-shared-analysis.mjs';
import {
  EVENT_BRIEFS_SCHEMA, MARKET_MOVERS, NEWS_REPORT_DOMAINS, REACTION_REPORT_DOMAINS, isNoReasonText, onReportDomain, normalizeSourceText, verifyQuotedItems, verifyFreeText, unverifiedNumbers, sourceNumberSet,
  parseDartPreliminaryResults, formatKrw, parseUsdAmount, parseUsdPerShare, surprisePct, estimateAiCostUsd, AI_RATE_CARD,
  MOVER_BY_SYMBOL, briefHeadline, releaseSession, earningsReaction, reactionPct, CALL_SEARCH_MAX_ATTEMPTS
} from '../src/domain/briefing/event-briefs.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public-data/event-briefs.json');
const DAY = 86400000;
const RETAIN_DAYS = 120;
const FIRST_RUN_LOOKBACK_DAYS = 12; // the first run (2026-10-29) reaches back to 10/18, so META's 10/21 report is in
const LOOKBACK_DAYS = 4;
const SOURCE_CHAR_CAP = 60000;
const CALL_SEARCH_AFTER_MS = 2 * 3600000; // the call starts ~1.5 h after an after-close release
const PRESSER_AFTER_MS = 105 * 60000; // 14:30 ET start, about an hour long
const MAX_SEARCH_ATTEMPTS = CALL_SEARCH_MAX_ATTEMPTS; // shared with the screen, which says "not found" after the last try
const FED = 'https://www.federalreserve.gov';

const REACTION_DAYS = 12; // closes are followed until five sessions have traded on the report
const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart';

// v59.44 (owner 2026-10-30, "AI/반도체/DC 관련 종목들 대폭 확장"): every US member of the 테마 screen's AI-chain themes,
// and these AI-power and data-center groups of other themes, has its report summarised beside the story names.
export const AI_EARNINGS_THEMES = Object.freeze(['semiconductor', 'ai_infra', 'photonics', 'software']);
export const AI_EARNINGS_SUBTHEMES = Object.freeze(['원전/독립발전', '원전 연료/설비', '수소/연료전지/ESS', '데이터센터', '채굴/AI 호스팅']);

/**
 * v59.44 (owner 2026-10-29/30): the researched company-story names (US) and the AI-chain theme members outside
 * MARKET_MOVERS, as movers whose release is summarised without a call search. The Korean name comes from the shared
 * ticker-name table in js/aio-core.js (AIO_TICKER_NAME_REGISTRY), else the filed English name; a theme-only member
 * carries the layer 'ai-chain'.
 */
export function extendedMovers(index, coreText = '', { themes = [], universe = [] } = {}) {
  const kr = {};
  for (const m of String(coreText).matchAll(/'([A-Z0-9.-]+)':\s*\{ en: '[^']+',\s*kr: '([^']+)'/g)) kr[m[1]] ||= m[2];
  const nameOf = Object.fromEntries((Array.isArray(universe) ? universe : []).filter((row) => row?.sym).map((row) => [row.sym, row.name]));
  const short = (name) => String(name || '').replace(/,?\s+(Inc\.?|Incorporated|Corporation|Corp\.?|Holdings?( Co)?|Group Holding Ltd|Ltd\.?|plc|N\.V\.|Co\.?)$/i, '').trim();
  const out = new Map();
  for (const row of Array.isArray(index?.profiles) ? index.profiles : []) {
    if (row?.symbol && !/\.K[SQ]$/.test(row.symbol) && !MOVER_BY_SYMBOL[row.symbol]) out.set(row.symbol, { sym: row.symbol, layer: row.layer || null, name: row.name });
  }
  for (const theme of Array.isArray(themes) ? themes : []) {
    for (const sub of theme?.subThemes || []) {
      if (!AI_EARNINGS_THEMES.includes(theme.id) && !AI_EARNINGS_SUBTHEMES.includes(sub.name)) continue;
      for (const sym of sub.tickers || []) {
        // Theme lists hold ETFs (IBIT, BITO) and foreign lines; only a universe stock with a name joins.
        if (out.has(sym) || MOVER_BY_SYMBOL[sym] || /\.K[SQ]$/.test(sym) || !nameOf[sym]) continue;
        out.set(sym, { sym, layer: 'ai-chain', name: nameOf[sym] });
      }
    }
  }
  return [...out.values()].map((row) => Object.freeze({ sym: row.sym, tier: 2, extended: true, layer: row.layer, nameKo: kr[row.sym] || short(row.name || row.sym), irDomains: [] }));
}

const sha256 = (text) => createHash('sha256').update(String(text)).digest('hex');
const ymdOf = (date) => String(date).replace(/-/g, '');

// ---- clocks -------------------------------------------------------------------------------------------------------
function etWallClockMs(date, hour, minute) {
  const [y, m, d] = String(date).split('-').map(Number);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false });
  for (const offset of [4, 5]) {
    const ms = Date.UTC(y, m - 1, d, hour + offset, minute);
    if (Number(fmt.format(new Date(ms))) % 24 === hour) return ms;
  }
  return Date.UTC(y, m - 1, d, hour + 4, minute);
}
const kstDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);

// ---- sources (live or fixture) --------------------------------------------------------------------------------------
function liveSources({ env, fetchImpl = fetch }) {
  let sec = null;
  let secReason = null;
  try { sec = createSecClient({ userAgent: requireSecUserAgent(env), fetchFn: fetchImpl }); } catch { secReason = 'operator_configuration_required: SEC_USER_AGENT'; }
  const get = async (url, { as = 'text', decode = 'utf-8', headers = {} } = {}) => {
    const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener/1.0)', ...headers }, signal: AbortSignal.timeout(30000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status} ${new URL(url).host}`);
    if (as === 'head') return true;
    return decode === 'utf-8' ? response.text() : new TextDecoder(decode).decode(await response.arrayBuffer());
  };
  const dartPace = (() => { let last = 0; return async () => { const wait = last + 600 - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); last = Date.now(); }; })();
  return {
    secReason,
    async fedStatement(date) {
      const url = `${FED}/newsevents/pressreleases/monetary${ymdOf(date)}a.htm`;
      const html = await get(url);
      if (!html) return null;
      const article = (html.match(/<div[^>]+id="article"[\s\S]*?(?=<div[^>]+id="lastUpdate"|<footer)/i) || [html])[0];
      return { url, text: htmlToText(article) };
    },
    async fedTranscript(date) {
      const url = `${FED}/mediacenter/files/FOMCpresconf${ymdOf(date)}.pdf`;
      const response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener/1.0)' }, signal: AbortSignal.timeout(40000) });
      if (!response.ok) return null;
      const text = pdfText(Buffer.from(await response.arrayBuffer()));
      return { url, text, readable: readableEnglish(text) };
    },
    async secTickers() { return sec ? tickerCikMap(await sec.json(SEC_TICKERS_URL)) : null; },
    async secFilings(cik) { return sec ? filingRowsWithItems(await sec.json(submissionsUrl(cik))) : []; },
    async secExhibit(cik, accession) {
      if (!sec) return null;
      const exhibit = resultsExhibit(await sec.text(submissionTextUrl(cik, accession)));
      return exhibit ? { type: exhibit.type, url: `${filingIndexUrl(cik, accession)}`, text: htmlToText(exhibit.text) } : null;
    },
    async dartList(corpCode, fromDate, toDate) {
      await dartPace();
      const body = new URLSearchParams({ currentPage: '1', maxResults: '30', maxLinks: '10', sort: 'date', series: 'desc', textCrpCik: corpCode, startDate: ymdOf(fromDate), endDate: ymdOf(toDate), finalReport: 'recent' });
      const response = await fetchImpl('https://dart.fss.or.kr/dsab007/detailSearch.ax', { method: 'POST', body, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener/1.0)', Referer: 'https://dart.fss.or.kr/dsab007/main.do', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`DART list HTTP ${response.status}`);
      const html = await response.text();
      const rows = [];
      for (const m of html.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
        const rcp = m[0].match(/rcpNo=(\d{14})/);
        const title = m[0].match(/title="([^"]+?) 공시뷰어 새창"/);
        const company = m[0].match(/openCorpInfoNew\('(\d{8})'/);
        const date = m[0].match(/(\d{4})\.(\d{2})\.(\d{2})/);
        if (rcp && title) rows.push({ rcpNo: rcp[1], title: title[1].trim(), corpCode: company?.[1] || null, date: date ? `${date[1]}-${date[2]}-${date[3]}` : null });
      }
      return rows;
    },
    async dartDocument(rcpNo) {
      await dartPace();
      const main = await get(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`);
      const view = main && main.match(/viewDoc\("(\d+)",\s*"(\d+)",\s*"(\d+)",\s*"(\d+)",\s*"(\d+)",\s*"([A-Za-z0-9.]+)"/);
      if (!view) return null;
      await dartPace();
      const html = await get(`https://dart.fss.or.kr/report/viewer.do?rcpNo=${view[1]}&dcmNo=${view[2]}&eleId=${view[3]}&offset=${view[4]}&length=${view[5]}&dtd=${view[6]}`, { decode: 'euc-kr' });
      return html ? { url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`, text: htmlToText(html) } : null;
    },
    // Daily closes in exchange dates, and the latest trade (extended hours included) while no session has closed since.
    async prices(symbol, { extended = false } = {}) {
      const read = async (query) => {
        const text = await get(`${YAHOO}/${encodeURIComponent(symbol)}?${query}`);
        return text ? JSON.parse(text)?.chart?.result?.[0] || null : null;
      };
      const daily = await read('range=1mo&interval=1d&includePrePost=false');
      if (!daily) return null;
      const zone = daily.meta?.exchangeTimezoneName || 'America/New_York';
      const dateOf = (sec) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(sec * 1000));
      const closes = daily.indicators?.quote?.[0]?.close || [];
      // While the regular session is open, its daily bar is a live price, not a close: it is left out.
      const regular = daily.meta?.currentTradingPeriod?.regular;
      const nowSec = Date.now() / 1000;
      const openDay = regular && nowSec >= regular.start && nowSec < regular.end ? dateOf(regular.start) : null;
      const bars = (daily.timestamp || []).map((sec, i) => ({ date: dateOf(sec), close: closes[i] })).filter((row) => Number(row.close) > 0 && row.date !== openDay);
      let last = null;
      if (extended) {
        const intraday = await read('range=1d&interval=5m&includePrePost=true');
        const times = intraday?.timestamp || [];
        const prices = intraday?.indicators?.quote?.[0]?.close || [];
        for (let i = times.length - 1; i >= 0; i -= 1) if (Number(prices[i]) > 0) { last = { price: prices[i], atMs: times[i] * 1000 }; break; }
      }
      return { bars, extended: last };
    },
    async ai(body, purpose) {
      const config = resolveSharedAiConfig(env);
      if (!config) return { reason: 'shared-ai-not-configured' };
      try {
        const run = String(env.GITHUB_RUN_ID || 'local').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40);
        const response = await fetchImpl(config.url, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(125000),
          headers: { 'Content-Type': 'application/json', 'X-AIO-Automation-Token': config.token, 'X-AIO-Idempotency-Key': `event-brief-${purpose}-${run}-${Date.now().toString(36)}`.slice(0, 120) },
          body: JSON.stringify(body)
        });
        if (!response.ok) return { reason: `provider-http-${response.status}` };
        return parseAiPayload(await response.json());
      } catch (error) { return { reason: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error' }; }
    }
  };
}

export async function fixtureSources(dir) {
  const manifest = JSON.parse(await readFile(resolve(dir, 'fixture.json'), 'utf8'));
  const file = async (name) => (name ? readFile(resolve(dir, name), 'utf8') : null);
  return {
    manifest,
    secReason: manifest.secTickers ? null : 'operator_configuration_required: SEC_USER_AGENT',
    async fedStatement(date) { const name = manifest.fed?.[ymdOf(date)]; return name ? { url: `${FED}/newsevents/pressreleases/monetary${ymdOf(date)}a.htm`, text: await file(name) } : null; },
    async fedTranscript(date) {
      const name = manifest.fedTranscript?.[ymdOf(date)];
      if (!name) return null;
      const text = await file(name);
      return { url: `${FED}/mediacenter/files/FOMCpresconf${ymdOf(date)}.pdf`, text, readable: readableEnglish(text, { minChars: 200 }) };
    },
    async secTickers() { return manifest.secTickers ? new Map(Object.entries(manifest.secTickers)) : null; },
    async secFilings(cik) { return manifest.secFilings?.[String(cik)] || []; },
    async secExhibit(cik, accession) { const name = manifest.secExhibits?.[accession]; return name ? { type: 'EX-99.1', url: filingIndexUrl(cik, accession), text: await file(name) } : null; },
    async dartList(corpCode) { return manifest.dartLists?.[corpCode] || []; },
    async dartDocument(rcpNo) { const name = manifest.dartDocs?.[rcpNo]; return name ? { url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rcpNo}`, text: await file(name) } : null; },
    async prices(symbol) { return manifest.prices?.[symbol] || null; },
    async ai(_body, purpose) { const payload = manifest.ai?.[purpose]; return payload ? parseAiPayload(payload) : { reason: 'fixture-missing' }; }
  };
}

export function parseAiPayload(payload) {
  const text = extractCompletedResponseText(payload);
  const usage = { inputTokens: Number(payload?.usage?.input_tokens) || 0, outputTokens: Number(payload?.usage?.output_tokens) || 0,
    searchCalls: Array.isArray(payload?.output) ? payload.output.filter((item) => item?.type === 'web_search_call').length : 0 };
  if (!text) return { reason: 'provider-response-incomplete', usage };
  try { return { json: JSON.parse(text), usage }; } catch { return { reason: 'provider-json-invalid', usage }; }
}

// ---- AI request bodies -----------------------------------------------------------------------------------------------
const STR = { type: 'string' };
const quoted = (extra = {}) => ({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'value', 'text', 'quote', ...Object.keys(extra)], properties: { label: STR, value: STR, text: STR, quote: STR, ...extra } } });
export const EARNINGS_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'figures', 'segments', 'guidance', 'watch'], properties: {
  headline: STR,
  figures: quoted({ metric: { type: 'string', enum: ['revenue', 'eps_diluted', 'operating_income', 'net_income', 'margin', 'capex', 'free_cash_flow', 'operating_cash_flow', 'other'] } }),
  segments: quoted(), guidance: quoted(), watch: { type: 'array', items: STR } } };
export const FOMC_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'figures', 'changes', 'dissents', 'watch'], properties: {
  headline: STR, figures: quoted({ metric: { type: 'string', enum: ['policy_rate_range', 'vote', 'balance_sheet', 'other'] } }), changes: quoted(), dissents: quoted(), watch: { type: 'array', items: STR } } };
export const POINTS_SCHEMA = { type: 'object', additionalProperties: false, required: ['speaker', 'points'], properties: { speaker: STR,
  points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'url'], properties: { text: STR, url: STR } } } } };

const RULES = [
  '규칙: 한국어로 짧게 쓴다. 매매 지시·목표가·예측 확률을 쓰지 않는다.',
  '각 항목의 quote에는 원문 문장을 한 글자도 바꾸지 않고 그대로 옮긴다. value에는 원문 표기 그대로의 숫자와 단위를 쓴다(환산·반올림 금지).',
  'label·text·headline에 숫자를 쓸 때는 원문에 그대로 있는 숫자만 쓴다. 원문에 없는 숫자(계산한 증감률, 환산 금액)는 쓰지 않는다.',
  'watch는 다음에 확인할 일(다음 발표, 지표, 조건)을 숫자 없이 한 줄씩 쓴다.'
].join('\n');

function jsonBody(prompt, schemaName, schema) {
  return { model: SHARED_AI_MODEL, input: [{ role: 'user', content: prompt }], max_output_tokens: 2500, reasoning: { effort: 'low' }, store: false, stream: false,
    text: { format: { type: 'json_schema', name: schemaName, schema, strict: true } } };
}

const capText = (text) => normalizeSourceText(text).slice(0, SOURCE_CHAR_CAP);

export function earningsPrompt(mover, source) {
  return [`아래는 ${mover.nameKo}(${mover.sym})의 실적 발표 원문(${source.kind})이다.`,
    '보고한 핵심 수치(매출, 주당순이익, 영업이익 등), 사업부문별 내용, 회사가 낸 다음 분기·연간 가이던스를 뽑아라.',
    // v59.44 (X bookmarks 10/30: GOOGL fell on negative free cash flow, AMZN on capex): the cash lines, when stated.
    '원문에 설비투자(capex, 유형자산 취득), 잉여현금흐름, 영업현금흐름이 있으면 figures에 각각 capex·free_cash_flow·operating_cash_flow로 넣어라.', RULES,
    '', '--- 원문 시작 ---', capText(source.text), '--- 원문 끝 ---'].join('\n');
}

export function fomcPrompt(date, current, previous) {
  return [`아래는 ${date} FOMC 성명 원문과 직전 성명이다.`,
    '결정(정책금리 범위), 표결, 직전 성명 대비 바뀐 문구(changes: quote는 이번 성명 문장), 반대 의견(dissents)을 뽑아라.', RULES,
    '', '--- 이번 성명 ---', capText(current), '--- 직전 성명 ---', capText(previous || '(없음)'), '--- 끝 ---'].join('\n');
}

export const TRANSCRIPT_SCHEMA = { type: 'object', additionalProperties: false, required: ['speaker', 'points'], properties: { speaker: STR,
  points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: STR } } } } };

export function transcriptPrompt(date, text) {
  return [`아래는 ${date} FOMC 기자회견 녹취록(연준 공개 PDF에서 추출한 텍스트)이다.`,
    '의장이 한 핵심 발언(금리 경로, 물가·고용 판단, 대차대조표, 질의응답 쟁점)을 한국어 한 줄씩 3~6개로 정리하라. speaker에는 의장 이름을 쓴다.', RULES,
    '', '--- 녹취록 ---', capText(text), '--- 끝 ---'].join('\n');
}

export function presserPrompt(date) {
  return `${date} FOMC 기자회견에서 연준 의장이 한 핵심 발언(금리 경로, 물가·고용 판단, 대차대조표, 질의응답의 쟁점)을 보도와 연준 자료에서 찾아 한국어 한 줄씩 3~6개로 정리하라. 각 줄에 근거 기사 url을 붙인다. speaker에는 의장 이름을 쓴다. 숫자는 보도에 그대로 있는 것만 쓴다. 매매 지시는 쓰지 않는다.`;
}

export function callPrompt(mover, eventDate) {
  return `${mover.nameKo}(${mover.sym})의 ${eventDate} 실적 발표 컨퍼런스콜에서 경영진이 강조한 점(수요, 투자, 마진, 가이던스 설명, 질의응답 쟁점)을 회사 자료와 보도에서 찾아 한국어 한 줄씩 3~6개로 정리하라. 각 줄에 근거 url을 붙인다. speaker에는 발언한 경영진을 쓴다(모르면 빈 문자열). 숫자는 자료에 그대로 있는 것만 쓴다. 매매 지시는 쓰지 않는다.`;
}

// v59.44 (owner 2026-10-30, "왜 빠졌는지 알아야 대응이라도"): why the stock moved after the report, as reported. The
// figures are on the brief already, so the reasons are written without numbers (a line with an unchecked number drops).
export const REASONS_SCHEMA = { type: 'object', additionalProperties: false, required: ['reasons'], properties: {
  reasons: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'url'], properties: { text: STR, url: STR } } } } };
export function reasonsPrompt(brief) {
  const move = reactionPct(brief);
  const direction = move == null ? '움직인' : move < 0 ? '하락한' : '상승한';
  return `${brief.nameKo}(${brief.symbol}) 주가가 ${brief.eventDate} 실적 발표 뒤 ${direction} 이유로 보도된 내용(가이던스와 시장 기대의 차이, 마진, 설비투자·현금흐름, 수요 설명, 경영진 발언)을 보도와 회사 자료에서 찾아 한국어 한 줄씩 2~4개로 정리하라. 각 줄에 근거 기사 url을 붙인다. 숫자는 쓰지 않는다(수치는 따로 싣는다). 보도에 없는 추측이나 매매 지시는 쓰지 않는다. 회사 보도자료만으로 주가 반응을 설명하지 말고, 이유를 다룬 보도를 찾지 못하면 빈 배열을 돌려준다.`;
}

/** A calendar row that already carries actuals, shown before the filing is summarised (basis 'provider'). */
export function provisionalBrief(row, mover, { source = null, sourceUrl = null } = {}) {
  const at = row.hour === 'bmo' ? etWallClockMs(row.date, 7, 0) : row.hour === 'amc' ? etWallClockMs(row.date, 16, 5) : etWallClockMs(row.date, 12, 0);
  const figures = [];
  // v59.45 (pipeline review P21-PROVISIONAL-01): a numeric string from the provider is a number; '' and null stay missing.
  const num = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
  const revenueActual = num(row.revenueActual), epsActual = num(row.epsActual);
  const vs = (actual, estimate) => (Number.isFinite(actual) && num(estimate) != null && num(estimate) !== 0 ? { value: num(estimate), surprisePct: surprisePct(actual, num(estimate)), source: source || 'Finnhub', basis: 'provider-consensus-reference' } : null);
  if (revenueActual != null) {
    const estimate = vs(revenueActual, row.revenueEstimate);
    figures.push({ metric: 'revenue', label: '매출', value: `$${(revenueActual / 1e9).toFixed(2)} billion`, text: '', ...(estimate ? { estimate } : {}) });
  }
  if (epsActual != null) {
    const estimate = vs(epsActual, row.epsEstimate);
    figures.push({ metric: 'eps_diluted', label: '주당순이익(제공처 기준)', value: `$${epsActual}`, text: '', ...(estimate ? { estimate } : {}) });
  }
  return { id: `calendar-${mover.sym}-${row.date}`, kind: 'earnings', status: 'provisional', basis: 'provider', symbol: mover.sym, nameKo: mover.nameKo, tier: mover.tier,
    ...(mover.layer ? { layer: mover.layer } : {}), eventDate: row.date, publishedAt: new Date(at).toISOString(),
    // No report hour: before or after the close is unknown, so no session can be named for the price (reviewer, v59.44).
    ...(row.hour === 'bmo' || row.hour === 'amc' ? {} : { timing: 'unknown' }),
    headline: `${mover.nameKo} 실적 발표: 원문 요약 정리 중`, figures, details: [], guidance: [], watch: [], dropped: [], ai: [],
    source: { kind: 'PROVIDER', title: `${source || 'Finnhub'} 실적 집계`, url: sourceUrl } };
}

// ---- brief assembly ------------------------------------------------------------------------------------------------
let ledgerAt = null;
function aiLedger(purpose, usage) {
  return { purpose, at: ledgerAt || new Date().toISOString(), ...usage, estimatedUsd: estimateAiCostUsd(usage) };
}

function urlAllowed(url, domains) {
  try { const host = new URL(url).hostname.toLowerCase(); return domains.some((domain) => host === domain || host.endsWith(`.${domain}`)); } catch { return false; }
}

/** Search points: url on an allowed domain, every figure in the fetched primary source. */
export function acceptPoints(json, { sourceText, domains }) {
  const points = (Array.isArray(json?.points) ? json.points : []).map((point) => ({ text: String(point?.text || '').trim(), url: String(point?.url || '').trim() })).filter((point) => point.text);
  const offDomain = points.filter((point) => !urlAllowed(point.url, domains));
  const { kept, dropped } = verifyFreeText(points.filter((point) => urlAllowed(point.url, domains)), sourceText);
  return { points: kept.slice(0, 6), dropped: [...dropped, ...offDomain.map((point) => ({ reason: 'url-not-allowed', text: point.text.slice(0, 120) }))], speaker: String(json?.speaker || '').trim() || null };
}

function safeWatch(list, sourceText) {
  const numbers = sourceNumberSet(sourceText);
  return (Array.isArray(list) ? list : []).map((text) => String(text || '').trim()).filter((text) => text && !unverifiedNumbers(text, numbers).length).slice(0, 4);
}

function safeHeadline(text, sourceText, fallback) {
  const value = String(text || '').trim();
  return value && !unverifiedNumbers(value, sourceNumberSet(sourceText)).length ? value : fallback;
}

// P2138: the provider's EPS consensus is on the adjusted basis, so a figure labelled GAAP is not compared with it
// (ServiceNow's GAAP $0.27 read "예상 대비 -73.9%").
// v59.45 (pipeline review P21-EPS-01): when the label and text name no basis, the quote decides — a quote that names
// GAAP (alone, or beside the non-GAAP figure so the line read is not certain) is not compared with the adjusted consensus.
const NON_GAAP_RE = /non-?GAAP|비\s*GAAP|조정(?!\s*전)|adjusted/i;
export function isGaapOnlyFigure(figure) {
  const text = `${figure?.label || ''} ${figure?.text || ''}`;
  if (/GAAP/i.test(text) && !NON_GAAP_RE.test(text)) return true;
  if (NON_GAAP_RE.test(text)) return false;
  return /\bGAAP\b/i.test(String(figure?.quote || '').replace(/non-?GAAP/gi, ' '));
}

export const CASH_METRICS = Object.freeze(['capex', 'free_cash_flow', 'operating_cash_flow']);

/** The AI earnings extraction, checked. `estimate` is the provider calendar row (reference). */
export function assembleEarningsSections(json, sourceText, estimate = null) {
  const figures = verifyQuotedItems(json?.figures, sourceText);
  const segments = verifyQuotedItems(json?.segments, sourceText);
  const guidance = verifyQuotedItems(json?.guidance, sourceText);
  const strip = ({ quote, ...rest }) => ({ ...rest, quote });
  const outFigures = figures.kept.map(strip).map((figure) => {
    if (!estimate) return figure;
    if (figure.metric === 'revenue' && Number.isFinite(Number(estimate.revenueEstimate))) {
      const actual = parseUsdAmount(figure.value);
      const pct = surprisePct(actual, Number(estimate.revenueEstimate));
      if (pct != null) return { ...figure, estimate: { value: Number(estimate.revenueEstimate), surprisePct: pct, source: estimate.source || 'Finnhub', basis: 'provider-consensus-reference' } };
    }
    if (figure.metric === 'eps_diluted' && Number.isFinite(Number(estimate.epsEstimate)) && !isGaapOnlyFigure(figure)) {
      // v59.45 (P21-AMOUNT-01): one per-share amount, its sign kept ("$(0.12)" is a loss), or no comparison.
      const actual = parseUsdPerShare(figure.value);
      const pct = actual != null ? surprisePct(actual, Number(estimate.epsEstimate)) : null;
      if (pct != null) return { ...figure, estimate: { value: Number(estimate.epsEstimate), surprisePct: pct, source: estimate.source || 'Finnhub', basis: 'provider-consensus-reference' } };
    }
    return figure;
  });
  // The cash lines (at most two) survive the cap of six, so a capex-heavy quarter keeps what the market priced.
  const cash = outFigures.filter((figure) => CASH_METRICS.includes(figure.metric)).slice(0, 2);
  return {
    figures: [...outFigures.filter((figure) => !CASH_METRICS.includes(figure.metric)).slice(0, 6 - cash.length), ...cash], segments: segments.kept.map(strip).slice(0, 6), guidance: guidance.kept.map(strip).slice(0, 4),
    watch: safeWatch(json?.watch, sourceText),
    dropped: [...figures.dropped, ...segments.dropped, ...guidance.dropped]
  };
}

/** The DART table → figures (direct parse) and the text the call-point check reads (raw + its unit conversions). */
export function dartFigures(parsed) {
  const figures = [];
  for (const [key, metric] of [['revenue', 'revenue'], ['operatingIncome', 'operating_income'], ['netIncome', 'net_income']]) {
    const row = parsed.accounts[key];
    if (!row || row.current == null) continue;
    const value = formatKrw(row.current, parsed.unit);
    const parts = [row.qoqPct != null ? `전분기 대비 ${row.qoqPct > 0 ? '+' : ''}${row.qoqPct}%` : null, row.yoyPct != null ? `전년 대비 ${row.yoyPct > 0 ? '+' : ''}${row.yoyPct}%` : null].filter(Boolean);
    figures.push({ metric, label: row.label, value, text: parts.join(', '), quote: row.raw, derived: `${row.current.toLocaleString('en-US')} ${parsed.unitLabel} 환산` });
  }
  return figures;
}

function previousDecision(decisions, date) {
  return [...decisions].filter((d) => d < date).sort().pop() || null;
}

// ---- the run -------------------------------------------------------------------------------------------------------
export async function buildEventBriefs({ previous = null, sources, nowMs = Date.now(), fomcDecisions = [], earningsRows = [], earningsSource = null, earningsSourceUrl = null, extended = [] } = {}) {
  const briefs = new Map((previous?.schemaVersion === EVENT_BRIEFS_SCHEMA && Array.isArray(previous.briefs) ? previous.briefs : []).map((brief) => [brief.id, brief]));
  const skipped = new Set(Array.isArray(previous?.skippedFilings) ? previous.skippedFilings : []);
  const firstRun = !previous?.generatedAt;
  const lookbackMs = (firstRun ? FIRST_RUN_LOOKBACK_DAYS : LOOKBACK_DAYS) * DAY;
  const status = { fomc: 'idle', sec: 'idle', dart: 'idle', ai: 'idle' };
  const errors = [];
  const nowIso = new Date(nowMs).toISOString();
  ledgerAt = nowIso;
  let aiReason = null;
  const runAi = async (body, purpose) => {
    const result = await sources.ai(body, purpose);
    if (result.reason) { aiReason = result.reason; status.ai = result.reason; }
    else status.ai = 'ok';
    return result;
  };

  // FOMC
  for (const date of fomcDecisions) {
    const statementAt = etWallClockMs(date, 14, 0);
    // A new brief within 3 days of the decision; an existing one keeps checking for the final transcript for 10 days.
    const id = `fomc-${date}`;
    if (nowMs < statementAt || nowMs - statementAt > (briefs.has(id) ? 10 : 3) * DAY) continue;
    let brief = briefs.get(id) || { id, kind: 'fomc', symbol: null, nameKo: 'FOMC', eventDate: date, publishedAt: new Date(statementAt).toISOString(), status: 'pending', ai: [] };
    try {
      if (!brief.source || brief.status === 'pending') {
        const statement = await sources.fedStatement(date);
        if (!statement?.text) { status.fomc = 'statement-not-yet-published'; briefs.set(id, brief); continue; }
        const prevDate = previousDecision(fomcDecisions, date);
        const prev = prevDate ? await sources.fedStatement(prevDate) : null;
        const verifyText = `${statement.text}\n${prev?.text || ''}`;
        const result = await runAi(jsonBody(fomcPrompt(date, statement.text, prev?.text), 'fomc_statement', FOMC_SCHEMA), 'fomc-statement');
        brief = { ...brief, source: { kind: 'T1_OFFICIAL', title: 'FOMC statement (federalreserve.gov)', url: statement.url, fetchedAt: nowIso, sha256: sha256(statement.text) },
          previousSource: prev ? { url: prev.url, date: prevDate } : null };
        if (result.json) {
          const figures = verifyQuotedItems(result.json.figures, statement.text);
          const changesChecked = verifyQuotedItems(result.json.changes, statement.text);
          // v59.45 (pipeline review P21-LIFECYCLE-01): a "changed" sentence must not stand word for word in the previous statement.
          const previousText = prev?.text ? normalizeSourceText(prev.text).toLowerCase() : '';
          const unchanged = previousText ? changesChecked.kept.filter((item) => previousText.includes(normalizeSourceText(item.quote).toLowerCase())) : [];
          const changes = { kept: changesChecked.kept.filter((item) => !unchanged.includes(item)),
            dropped: [...changesChecked.dropped, ...unchanged.map((item) => ({ reason: 'quote-also-in-previous-statement', text: String(item.text || item.label || '').slice(0, 120) }))] };
          const dissents = verifyQuotedItems(result.json.dissents, statement.text);
          brief = { ...brief, status: 'partial', basis: 'primary-source',
            headline: safeHeadline(result.json.headline, verifyText, `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} FOMC 결정`),
            figures: figures.kept.slice(0, 4), details: changes.kept.slice(0, 5), detailTitle: '직전 성명 대비 바뀐 문구', dissents: dissents.kept.slice(0, 3),
            watch: safeWatch(result.json.watch, verifyText), dropped: [...figures.dropped, ...changes.dropped, ...dissents.dropped],
            ai: [...brief.ai, aiLedger('fomc-statement', result.usage)] };
        } else {
          brief = { ...brief, status: 'pending', aiReason: result.reason, ai: result.usage ? [...brief.ai, aiLedger('fomc-statement', result.usage)] : brief.ai };
          briefs.set(id, brief);
          continue;
        }
      }
      status.fomc = 'statement-ok';
      // The Fed's transcript (preliminary the same day, final later) replaces a report-based summary once it reads as text.
      const stage = brief.callPoints?.basis === 'transcript' ? (brief.callPoints.preliminary ? 'preliminary' : 'final') : null;
      // v59.45 (pipeline review P21-LIFECYCLE-01): the transcript summary count lives on the brief, so a try before any
      // call points exist, or a report-based search that rebuilds callPoints, does not reset it (at most six AI tries).
      const transcriptTries = () => Math.max(brief.transcriptAttempts || 0, brief.callPoints?.transcriptAttempts || 0);
      if (nowMs >= statementAt + PRESSER_AFTER_MS && stage !== 'final' && transcriptTries() < 6) {
        const transcript = await sources.fedTranscript(date);
        const preliminary = transcript ? /\bPRELIMINARY\b/.test(transcript.text.slice(0, 400)) : null;
        if (transcript && transcript.readable && !(stage === 'preliminary' && preliminary)) {
          const result = await runAi(jsonBody(transcriptPrompt(date, transcript.text), 'fomc_transcript', TRANSCRIPT_SCHEMA), 'fomc-transcript');
          const statementText = (await sources.fedStatement(date))?.text || '';
          const checked = result.json ? verifyFreeText((result.json.points || []).map((point) => ({ text: String(point?.text || '').trim(), url: transcript.url })).filter((point) => point.text), `${transcript.text}\n${statementText}`) : { kept: [], dropped: [] };
          const tries = transcriptTries() + 1;
          brief = { ...brief, transcriptAttempts: tries, ai: result.usage ? [...brief.ai, aiLedger('fomc-transcript', result.usage)] : brief.ai };
          if (checked.kept.length) {
            brief = { ...brief, callPoints: { title: '의장 기자회견', basis: 'transcript', preliminary: !!preliminary, speaker: String(result.json.speaker || '').trim() || null,
              points: checked.kept.slice(0, 6), attempts: brief.callPoints?.attempts || 0, transcriptAttempts: tries, done: true,
              searchedAt: nowIso, dropped: checked.dropped, transcriptUrl: transcript.url } };
          } else if (brief.callPoints) brief = { ...brief, callPoints: { ...brief.callPoints, transcriptAttempts: tries, transcriptUrl: transcript.url } };
        } else if (transcript && brief.callPoints && !brief.callPoints.transcriptUrl) brief = { ...brief, callPoints: { ...brief.callPoints, transcriptUrl: transcript.url } };
      }
      if (!brief.callPoints?.done && nowMs >= statementAt + PRESSER_AFTER_MS && (brief.callPoints?.attempts || 0) < MAX_SEARCH_ATTEMPTS) {
        const domains = ['federalreserve.gov', ...NEWS_REPORT_DOMAINS];
        const body = buildSharedWebSearchBody(presserPrompt(date), { allowedDomains: domains, schemaName: 'fomc_presser', schema: POINTS_SCHEMA, maxToolCalls: 1, maxOutputTokens: 1500 });
        const result = await runAi(body, 'fomc-presser');
        const statementText = brief.source ? (await sources.fedStatement(date))?.text || '' : '';
        const accepted = result.json ? acceptPoints(result.json, { sourceText: statementText, domains }) : { points: [], dropped: [], speaker: null };
        brief = { ...brief, ai: result.usage ? [...brief.ai, aiLedger('fomc-presser', result.usage)] : brief.ai,
          callPoints: { title: '의장 기자회견', basis: 'news-report', speaker: accepted.speaker, points: accepted.points, attempts: (brief.callPoints?.attempts || 0) + 1,
            done: accepted.points.length > 0, searchedAt: nowIso, dropped: accepted.dropped, transcriptUrl: brief.callPoints?.transcriptUrl || null,
            ...(transcriptTries() ? { transcriptAttempts: transcriptTries() } : {}) } };
      }
      brief.status = brief.callPoints?.done ? 'complete' : 'partial';
    } catch (error) { errors.push(`fomc ${date}: ${String(error.message || error).slice(0, 120)}`); status.fomc = 'error'; }
    briefs.set(id, brief);
  }

  // US movers on EDGAR
  // A story name is looked up on EDGAR only when the earnings calendar has its report in the window (or its brief is
  // still pending), so ~90 extra names do not each cost a submissions request every 20 minutes. A name stays watched for
  // the lookback after its calendar day (the artifact keeps the list), so a Friday report is still found after the
  // calendar has rolled to the next week.
  const watch = Object.fromEntries(Object.entries(previous?.reportWatch || {}).filter(([, until]) => Date.parse(until) >= nowMs));
  for (const row of earningsRows) {
    const day = Date.parse(row?.date || '');
    if (!row?.symbol || !Number.isFinite(day) || Math.abs(day - nowMs) > lookbackMs + DAY) continue;
    const until = new Date(day + LOOKBACK_DAYS * DAY + DAY).toISOString();
    if (!watch[row.symbol] || watch[row.symbol] < until) watch[row.symbol] = until;
  }
  const dueSymbols = new Set([...Object.keys(watch), ...[...briefs.values()].filter((brief) => brief.status === 'pending').map((brief) => brief.symbol)]);
  const us = [...MARKET_MOVERS.filter((mover) => mover.market !== 'KR'), ...extended.filter((mover) => dueSymbols.has(mover.sym))];
  let ciks = null;
  if (sources.secReason) status.sec = sources.secReason;
  else {
    try { ciks = await sources.secTickers(); status.sec = 'ok'; } catch (error) { errors.push(`sec tickers: ${error.message}`); status.sec = 'error'; }
  }
  for (const mover of ciks ? us : []) {
    const cik = ciks.get(mover.sym);
    if (!cik) { if (!mover.extended) errors.push(`sec: no CIK for ${mover.sym}`); continue; }
    try {
      const filings = (await sources.secFilings(cik)).filter((row) => Date.parse(row.acceptedAt || row.filingDate || '') >= nowMs - lookbackMs
        // v59.44: a story name may be a foreign filer (ASML, ARM, CAMT) with no 8-K; its 6-K counts once it reads like results.
        && (mover.foreignIssuer ? row.form === '6-K' : isResultsFiling(row) || (mover.extended && row.form === '6-K')));
      for (const filing of filings) {
        const id = `earnings-${mover.sym}-${filing.accession}`;
        if (skipped.has(filing.accession)) continue;
        let brief = briefs.get(id);
        if (!brief || brief.status === 'pending') {
          const exhibit = await sources.secExhibit(cik, filing.accession);
          if (!exhibit?.text || (filing.form === '6-K' && !looksLikeQuarterlyResults(exhibit.text))) { skipped.add(filing.accession); continue; }
          const estimate = earningsRows.find((row) => row?.symbol === mover.sym && Math.abs(Date.parse(row.date) - Date.parse(filing.filingDate)) <= 3 * DAY) || null;
          const result = await runAi(jsonBody(earningsPrompt(mover, { kind: `SEC ${filing.form} ${exhibit.type}`, text: exhibit.text }), 'earnings_release', EARNINGS_SCHEMA), `earnings-${mover.sym}`);
          const sourceText = capText(exhibit.text);
          const base = { id, kind: 'earnings', symbol: mover.sym, nameKo: mover.nameKo, tier: mover.tier, ...(mover.extended ? { scope: 'release', layer: mover.layer } : {}), eventDate: filing.filingDate, publishedAt: filing.acceptedAt || `${filing.filingDate}T00:00:00Z`,
            // v59.45 (P21-TIME-01): without EDGAR's acceptance time only the filed date is known (not "00:00 UTC").
            ...(filing.acceptedAt ? {} : { publishedDateOnly: true }),
            source: { kind: 'T1_OFFICIAL', title: `SEC ${filing.form} ${exhibit.type}`, url: exhibit.url, accession: filing.accession, fetchedAt: nowIso, sha256: sha256(exhibit.text) },
            ai: [...(brief?.ai || []), ...(result.usage ? [aiLedger(`earnings-${mover.sym}`, result.usage)] : [])] };
          if (!result.json) { briefs.set(id, { ...base, status: 'pending', aiReason: result.reason }); continue; }
          const sections = assembleEarningsSections(result.json, sourceText, estimate ? { ...estimate, source: earningsSource } : null);
          brief = { ...base, status: 'partial', basis: 'primary-source', headline: briefHeadline(result.json.headline, { nameKo: mover.nameKo, figures: sections.figures, sourceNumbers: sourceNumberSet(sourceText) }),
            figures: sections.figures, details: sections.segments, detailTitle: '사업부문', guidance: sections.guidance, watch: sections.watch, dropped: sections.dropped,
            checkText: sourceText };
        }
        // A story name's release is summarised without a call search (tier 2, owner 2026-10-29).
        if (mover.extended) brief = brief.status === 'pending' ? brief : { ...brief, status: 'complete' };
        else brief = await withCallPoints(brief, { mover, nowMs, nowIso, sourceText: brief.checkText, sources, runAi });
        briefs.set(id, brief);
      }
    } catch (error) { errors.push(`sec ${mover.sym}: ${String(error.message || error).slice(0, 120)}`); status.sec = 'partial-error'; }
  }

  // Korean movers on DART (public viewer, no key)
  status.dart = 'ok';
  for (const mover of MARKET_MOVERS.filter((row) => row.market === 'KR')) {
    try {
      const list = await sources.dartList(mover.dartCorpCode, kstDate(nowMs - lookbackMs), kstDate(nowMs));
      // The newest filing (a [기재정정] correction replaces the original), and only for the same company.
      const filing = list.filter((row) => /영업\(잠정\)실적/.test(row.title) && row.corpCode === mover.dartCorpCode).sort((a, b) => b.rcpNo.localeCompare(a.rcpNo))[0];
      if (!filing) continue;
      const id = `earnings-${mover.sym}-${filing.rcpNo}`;
      let brief = briefs.get(id);
      if (!brief) {
        const doc = await sources.dartDocument(filing.rcpNo);
        const parsed = doc ? parseDartPreliminaryResults(doc.text) : null;
        if (!parsed || !normalizeSourceText(doc.text).includes(mover.dartName)) { errors.push(`dart ${mover.sym}: ${filing.rcpNo} not parsed`); continue; }
        const figures = dartFigures(parsed);
        const op = figures.find((figure) => figure.metric === 'operating_income');
        brief = { id, kind: 'earnings', symbol: mover.sym, nameKo: mover.nameKo, tier: mover.tier, eventDate: filing.date, publishedAt: `${filing.date}T00:00:00+09:00`, publishedDateOnly: true,
          source: { kind: 'T1_OFFICIAL', title: `DART ${filing.title}`, url: doc.url, rcpNo: filing.rcpNo, fetchedAt: nowIso, sha256: sha256(doc.text) },
          status: 'partial', basis: 'primary-source', period: parsed.quarter,
          headline: `${parsed.quarter || ''} 잠정 실적${op ? `: 영업이익 ${op.value}(${op.text})` : ''}`.replace(/\s+/g, ' ').trim(),
          figures, details: [], detailTitle: '사업부문', guidance: [], watch: [], dropped: [], firstSeenAt: nowIso,
          checkText: `${doc.text}\n${figures.map((figure) => `${figure.value} ${figure.text}`).join('\n')}`, ai: [] };
      }
      // v59.45 (pipeline review P21-LIFECYCLE-01): a [기재정정] of the same quarter replaces the earlier filing's brief instead
      // of standing beside it; the price follow-up (a price fact) carries over, the summary is the new filing's.
      for (const [otherId, other] of briefs) {
        if (!brief.period || otherId === id || other.symbol !== mover.sym || !other.source?.rcpNo || other.source.rcpNo >= filing.rcpNo || other.period !== brief.period) continue;
        briefs.delete(otherId);
        brief = { ...brief, supersedes: otherId, reaction: brief.reaction || other.reaction };
      }
      brief = await withCallPoints(brief, { mover, nowMs, nowIso, sourceText: brief.checkText, sources, runAi });
      briefs.set(id, brief);
    } catch (error) { errors.push(`dart ${mover.sym}: ${String(error.message || error).slice(0, 120)}`); status.dart = 'partial-error'; }
  }

  // v59.44 (owner 2026-10-30, "근거를 못 찾아서 걍 빠지면 이것도 문제"): a report the calendar already shows with actuals is
  // on 오늘 before its filing is summarised (basis 'provider'); the filing's brief replaces it and keeps its price and reasons.
  const listed = new Map([...MARKET_MOVERS.filter((mover) => mover.market !== 'KR'), ...extended].map((mover) => [mover.sym, mover]));
  const summaryOf = (sym, date) => [...briefs.values()].find((brief) => brief.symbol === sym && brief.status !== 'provisional' && brief.status !== 'pending'
    && Math.abs((Date.parse(brief.publishedAt) || 0) - Date.parse(date)) <= 4 * DAY);
  for (const [id, brief] of briefs) {
    const real = brief.status === 'provisional' ? summaryOf(brief.symbol, brief.eventDate) : null;
    if (!real) continue;
    briefs.delete(id);
    briefs.set(real.id, { ...real, reaction: real.reaction || brief.reaction, reasons: real.reasons || brief.reasons });
  }
  for (const row of earningsRows) {
    const mover = listed.get(row?.symbol);
    // v59.45: a calendar date after today cannot carry a reported result yet (a provider row ahead of time is not a report).
    if (!mover || (row.epsActual == null && row.revenueActual == null) || nowMs - Date.parse(row.date) > lookbackMs + DAY || Date.parse(row.date) - nowMs > DAY || summaryOf(row.symbol, row.date)) continue;
    const id = `calendar-${mover.sym}-${row.date}`;
    // v59.45 (pipeline review P21-PROVISIONAL-01): the provider's figures can still change before the filing is summarised;
    // each run rebuilds them from the latest row and keeps the price follow-up and reasons already gathered.
    const prior = briefs.get(id);
    const fresh = provisionalBrief(row, mover, { source: earningsSource, sourceUrl: earningsSourceUrl });
    if (!prior) briefs.set(id, fresh);
    else if (prior.status === 'provisional' && JSON.stringify(prior.figures) !== JSON.stringify(fresh.figures)) {
      briefs.set(id, { ...prior, figures: fresh.figures, headline: fresh.headline, source: fresh.source, providerRevisedAt: nowIso });
    }
  }

  // P2137: a headline copied in English from the release, or the bare "실적 발표", is rebuilt from the checked figures.
  // v59.45 (pipeline review P21-AMOUNT-01/EPS-01): a stored comparison is re-read with the current parser — a unitless table
  // figure ("$1,902,418", "$ 173.0") or "$12.1B" printed -99.9% / -100% against the consensus.
  const recompared = (figure, actual) => {
    if (actual == null) return (({ estimate, ...rest }) => rest)(figure);
    const pct = surprisePct(actual, Number(figure.estimate.value));
    return pct == null ? (({ estimate, ...rest }) => rest)(figure) : pct === figure.estimate.surprisePct ? figure : { ...figure, estimate: { ...figure.estimate, surprisePct: pct } };
  };
  for (const [id, brief] of briefs) {
    // The DART table is read from the filing (its headline is built from it); a date-only SEC brief is rechecked too.
    if (brief.kind !== 'earnings' || !brief.headline || brief.source?.rcpNo) continue;
    const headline = briefHeadline(brief.headline, { nameKo: brief.nameKo, figures: brief.figures || [] });
    const figures = (brief.figures || []).map((figure) => {
      if (!figure.estimate || (figure.estimate.basis && figure.estimate.basis !== 'provider-consensus-reference') || brief.status === 'provisional') return figure;
      if (figure.metric === 'eps_diluted') return isGaapOnlyFigure(figure) ? (({ estimate, ...rest }) => rest)(figure) : recompared(figure, parseUsdPerShare(figure.value));
      if (figure.metric === 'revenue') return recompared(figure, parseUsdAmount(figure.value));
      return figure;
    });
    if (headline !== brief.headline || figures.some((figure, i) => figure !== brief.figures[i])) briefs.set(id, { ...brief, headline, figures });
  }

  // v59.44: closes around each recent report (and the latest trade until a session has closed on it), until settled.
  status.prices = 'idle';
  for (const [id, brief] of briefs) {
    if (brief.kind !== 'earnings' || brief.status === 'pending' || brief.timing === 'unknown' || brief.reaction?.settled || nowMs - (Date.parse(brief.publishedAt) || 0) > REACTION_DAYS * DAY || typeof sources.prices !== 'function') continue;
    const market = /\.K[SQ]$/.test(brief.symbol) ? 'KR' : 'US';
    const session = releaseSession(brief.publishedAt, { market, dateOnly: !!brief.publishedDateOnly });
    try {
      const quote = await sources.prices(brief.symbol, { extended: market === 'US' && !(brief.reaction?.sessions > 0) });
      const reaction = quote ? earningsReaction(quote.bars, session, { extended: quote.extended, releaseMs: Date.parse(brief.publishedAt) }) : null;
      // v59.45 (pipeline review P21-WORKFLOW-01): an unchanged reaction keeps its checkedAt, so a re-check alone is not a
      // commit (the workflow skips a file whose only change is generatedAt).
      const same = reaction && brief.reaction && JSON.stringify({ ...brief.reaction, checkedAt: null }) === JSON.stringify({ ...reaction, checkedAt: null });
      if (reaction && !same) briefs.set(id, { ...brief, reaction: { ...reaction, checkedAt: nowIso } });
      if (reaction && status.prices !== 'partial-error') status.prices = 'ok';
    } catch (error) { errors.push(`prices ${brief.symbol}: ${String(error.message || error).slice(0, 120)}`); status.prices = 'partial-error'; }
  }

  // v59.44: why it moved, once the price has answered (one search per brief, at most two tries, an hour after release).
  // A move that reverses after the search (after-hours down, first session up) is searched once more, so the reasons
  // never explain the opposite of the price beside them.
  const sign = (brief) => Math.sign(reactionPct(brief) ?? 0);
  for (const [id, stored] of briefs) {
    // A stored line that only says nothing was found, or that came from outside the current outlets, is dropped; with none
    // left the brief is searched once more.
    const cleanPoints = (stored.reasons?.points || []).filter((point) => !isNoReasonText(point.text) && onReportDomain(point.url));
    const brief = stored.reasons && cleanPoints.length !== stored.reasons.points.length
      ? { ...stored, reasons: { ...stored.reasons, points: cleanPoints, done: cleanPoints.length > 0 } } : stored;
    if (brief !== stored) briefs.set(id, brief);
    const reversed = !!brief.reasons?.done && !brief.reasons.redone && Number.isFinite(brief.reasons.direction) && sign(brief) !== 0 && sign(brief) !== brief.reasons.direction;
    if (brief.kind !== 'earnings' || brief.status === 'pending' || !brief.reaction || (!reversed && (brief.reasons?.done || (brief.reasons?.attempts || 0) >= MAX_SEARCH_ATTEMPTS))) continue;
    const published = Date.parse(brief.publishedAt) || 0;
    if (nowMs - published > 4 * DAY || nowMs < published + 3600000) continue;
    const mover = listed.get(brief.symbol) || MOVER_BY_SYMBOL[brief.symbol] || { irDomains: [] };
    const domains = REACTION_REPORT_DOMAINS;
    const known = [brief.checkText || '', ...['figures', 'details', 'guidance'].flatMap((key) => (brief[key] || []).map((item) => `${item.label || ''} ${item.value || ''} ${item.text || ''} ${item.quote || ''}`))].join('\n');
    const result = await runAi(buildSharedWebSearchBody(reasonsPrompt(brief), { allowedDomains: domains, schemaName: 'earnings_reasons', schema: REASONS_SCHEMA, maxToolCalls: 2, maxOutputTokens: 1200 }), `reasons-${brief.symbol}`);
    const checked = result.json ? acceptPoints({ points: result.json.reasons }, { sourceText: known, domains }) : { points: [], dropped: [] };
    const accepted = { points: checked.points.filter((point) => !isNoReasonText(point.text)),
      dropped: [...checked.dropped, ...checked.points.filter((point) => isNoReasonText(point.text)).map((point) => ({ reason: 'no-reason-found', text: point.text }))] };
    briefs.set(id, { ...brief, reasons: { basis: 'news-report', points: accepted.points.slice(0, 4), done: accepted.points.length > 0 || reversed, attempts: (brief.reasons?.attempts || 0) + 1, searchedAt: nowIso, dropped: accepted.dropped,
      direction: sign(brief), ...(reversed || brief.reasons?.redone ? { redone: true } : {}) },
      ai: [...(brief.ai || []), ...(result.usage ? [aiLedger(`reasons-${brief.symbol}`, result.usage)] : [])] });
  }

  // Keep the window; newest first.
  const kept = [...briefs.values()].filter((brief) => nowMs - (Date.parse(brief.publishedAt) || 0) <= RETAIN_DAYS * DAY)
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  const month = nowIso.slice(0, 7);
  const monthEntries = kept.flatMap((brief) => brief.ai || []).filter((entry) => entry.at ? entry.at.startsWith(month) : true);
  return {
    schemaVersion: EVENT_BRIEFS_SCHEMA,
    generatedAt: nowIso,
    producer: 'scripts/fetch-event-briefs.mjs',
    cadence: 'every 20 minutes (.github/workflows/event-briefs.yml); AI runs only for a new source document or a pending call summary',
    sourceKind: 'T1_OFFICIAL',
    allowedUse: 'reference',
    basis: 'Primary sources: federalreserve.gov statements, SEC EDGAR 8-K/6-K Ex.99, DART 공정공시. Call and press-conference points are report-based until a transcript is available. Figures not found in the fetched source are dropped.',
    status, aiReason, errors: errors.slice(0, 20),
    costLedger: { month, requests: monthEntries.length, estimatedUsd: Math.round(monthEntries.reduce((sum, entry) => sum + (entry.estimatedUsd || 0), 0) * 1e4) / 1e4,
      rateCard: AI_RATE_CARD, perBriefEstimateUsd: { withoutSearch: 0.003, withOneSearch: 0.018 } },
    skippedFilings: [...skipped].slice(-200),
    reportWatch: Object.fromEntries(Object.entries(watch).filter(([sym]) => extended.some((mover) => mover.sym === sym))),
    // The release text stays only while a call summary is still to be checked against it.
    // A release-only brief (story names) has no call summary to check, so its release text is not kept.
    briefs: kept.map(({ checkText, ...brief }) => ({ ...brief, ...(checkText && brief.status !== 'pending' && brief.scope !== 'release' && !brief.callPoints?.done && (brief.callPoints?.attempts || 0) < MAX_SEARCH_ATTEMPTS ? { checkText } : {}) }))
  };
}

async function withCallPoints(brief, { mover, nowMs, nowIso, sourceText, sources, runAi }) {
  if (!brief || brief.status === 'pending' || brief.callPoints?.done || (brief.callPoints?.attempts || 0) >= MAX_SEARCH_ATTEMPTS) return brief;
  const releasedMs = Date.parse(brief.firstSeenAt || brief.publishedAt) || nowMs;
  if (nowMs < releasedMs + CALL_SEARCH_AFTER_MS) return brief;
  const domains = [...mover.irDomains, ...NEWS_REPORT_DOMAINS];
  const body = buildSharedWebSearchBody(callPrompt(mover, brief.eventDate), { allowedDomains: domains, schemaName: 'earnings_call', schema: POINTS_SCHEMA, maxToolCalls: 1, maxOutputTokens: 1500 });
  const result = await runAi(body, `call-${mover.sym}`);
  // The call's figures are checked against the fetched release, kept on the brief until the call summary is settled.
  const checkText = sourceText || '';
  const accepted = result.json ? acceptPoints(result.json, { sourceText: checkText, domains }) : { points: [], dropped: [], speaker: null };
  const callPoints = { title: '컨퍼런스콜 핵심', basis: 'news-report', speaker: accepted.speaker, points: accepted.points, attempts: (brief.callPoints?.attempts || 0) + 1,
    done: accepted.points.length > 0, searchedAt: nowIso, dropped: accepted.dropped };
  return { ...brief, callPoints, status: callPoints.done ? 'complete' : 'partial', ai: [...(brief.ai || []), ...(result.usage ? [aiLedger(`call-${mover.sym}`, result.usage)] : [])] };
}

// ---- CLI -----------------------------------------------------------------------------------------------------------
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } }

async function main() {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const fixtureDir = arg('--fixture');
  const outPath = arg('--out') ? resolve(arg('--out')) : OUT;
  if (outPath === OUT && process.env.GITHUB_ACTIONS !== 'true') {
    console.error('[event-briefs] producers run only in GitHub Actions; locally pass --fixture <dir> --out <file>');
    process.exit(2);
  }
  if (!fixtureDir && process.env.GITHUB_ACTIONS !== 'true') {
    console.error('[event-briefs] live sources are read only in GitHub Actions; locally pass --fixture <dir>');
    process.exit(2);
  }
  const sources = fixtureDir ? await fixtureSources(resolve(fixtureDir)) : liveSources({ env: process.env });
  const nowMs = Date.parse(arg('--now') || sources.manifest?.now || '') || Date.now();
  const macro = sources.manifest?.macroCalendar ? { schedules: sources.manifest.macroCalendar } : await readJson(resolve(ROOT, 'public-data/macro-calendar.json'));
  const calendar = sources.manifest?.earnings ? { earnings: sources.manifest.earnings, source: 'Finnhub (fixture)' } : await readJson(resolve(ROOT, 'public-data/earnings-calendar.json'));
  const previous = fixtureDir ? (sources.manifest.previous || null) : await readJson(OUT);
  const extended = sources.manifest ? extendedMovers(sources.manifest.companyProfiles || null, sources.manifest.coreText || '')
    : extendedMovers(await readJson(resolve(ROOT, 'public-data/company-profiles/index.json')), await readFile(resolve(ROOT, 'js/aio-core.js'), 'utf8').catch(() => ''),
      { themes: loadThemeMaps(ROOT).usThemes, universe: (await readJson(resolve(ROOT, 'public-data/screener-universe.json')))?.universe || [] });
  const artifact = await buildEventBriefs({ previous, sources, nowMs, fomcDecisions: macro?.schedules?.['us-fomc'] || [], earningsRows: calendar?.earnings || [], earningsSource: calendar?.source || null, earningsSourceUrl: calendar?.sourceUrl || null, extended });
  await atomicWriteFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[event-briefs] ${artifact.briefs.length} briefs; status ${JSON.stringify(artifact.status)}; month AI ~$${artifact.costLedger.estimatedUsd}${artifact.errors.length ? `; errors: ${artifact.errors.join(' | ')}` : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[event-briefs] failed: ${error?.stack || error}`); process.exit(1); });
}
