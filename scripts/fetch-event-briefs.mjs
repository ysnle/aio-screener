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
import { pdfText, readableEnglish } from './lib/pdf-text.mjs';
import { createSecClient, requireSecUserAgent, filingIndexUrl } from './lib/sec-edgar.mjs';
import { SEC_TICKERS_URL, submissionsUrl, submissionTextUrl, tickerCikMap, filingRowsWithItems, isResultsFiling, resultsExhibit, looksLikeQuarterlyResults, htmlToText } from './lib/sec-results-filings.mjs';
import { SHARED_AI_MODEL, resolveSharedAiConfig, extractCompletedResponseText, buildSharedWebSearchBody } from './lib/ai-shared-analysis.mjs';
import {
  EVENT_BRIEFS_SCHEMA, MARKET_MOVERS, NEWS_REPORT_DOMAINS, normalizeSourceText, verifyQuotedItems, verifyFreeText, unverifiedNumbers, sourceNumberSet,
  parseDartPreliminaryResults, formatKrw, parseUsdAmount, surprisePct, estimateAiCostUsd, AI_RATE_CARD
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
const MAX_SEARCH_ATTEMPTS = 2;
const FED = 'https://www.federalreserve.gov';

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
  figures: quoted({ metric: { type: 'string', enum: ['revenue', 'eps_diluted', 'operating_income', 'net_income', 'margin', 'other'] } }),
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
    '보고한 핵심 수치(매출, 주당순이익, 영업이익 등), 사업부문별 내용, 회사가 낸 다음 분기·연간 가이던스를 뽑아라.', RULES,
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
    if (figure.metric === 'eps_diluted' && Number.isFinite(Number(estimate.epsEstimate))) {
      const m = String(figure.value).match(/\$?\s*(-?\d+(?:\.\d+)?)/);
      const pct = m ? surprisePct(Number(m[1]), Number(estimate.epsEstimate)) : null;
      if (pct != null) return { ...figure, estimate: { value: Number(estimate.epsEstimate), surprisePct: pct, source: estimate.source || 'Finnhub', basis: 'provider-consensus-reference' } };
    }
    return figure;
  });
  return {
    figures: outFigures.slice(0, 6), segments: segments.kept.map(strip).slice(0, 6), guidance: guidance.kept.map(strip).slice(0, 4),
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
export async function buildEventBriefs({ previous = null, sources, nowMs = Date.now(), fomcDecisions = [], earningsRows = [], earningsSource = null } = {}) {
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
          const changes = verifyQuotedItems(result.json.changes, statement.text);
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
      if (nowMs >= statementAt + PRESSER_AFTER_MS && stage !== 'final' && (brief.callPoints?.transcriptAttempts || 0) < 6) {
        const transcript = await sources.fedTranscript(date);
        const preliminary = transcript ? /\bPRELIMINARY\b/.test(transcript.text.slice(0, 400)) : null;
        if (transcript && transcript.readable && !(stage === 'preliminary' && preliminary)) {
          const result = await runAi(jsonBody(transcriptPrompt(date, transcript.text), 'fomc_transcript', TRANSCRIPT_SCHEMA), 'fomc-transcript');
          const statementText = (await sources.fedStatement(date))?.text || '';
          const checked = result.json ? verifyFreeText((result.json.points || []).map((point) => ({ text: String(point?.text || '').trim(), url: transcript.url })).filter((point) => point.text), `${transcript.text}\n${statementText}`) : { kept: [], dropped: [] };
          brief = { ...brief, ai: result.usage ? [...brief.ai, aiLedger('fomc-transcript', result.usage)] : brief.ai };
          if (checked.kept.length) {
            brief = { ...brief, callPoints: { title: '의장 기자회견', basis: 'transcript', preliminary: !!preliminary, speaker: String(result.json.speaker || '').trim() || null,
              points: checked.kept.slice(0, 6), attempts: brief.callPoints?.attempts || 0, transcriptAttempts: (brief.callPoints?.transcriptAttempts || 0) + 1, done: true,
              searchedAt: nowIso, dropped: checked.dropped, transcriptUrl: transcript.url } };
          } else if (brief.callPoints) brief = { ...brief, callPoints: { ...brief.callPoints, transcriptAttempts: (brief.callPoints.transcriptAttempts || 0) + 1, transcriptUrl: transcript.url } };
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
            done: accepted.points.length > 0, searchedAt: nowIso, dropped: accepted.dropped, transcriptUrl: brief.callPoints?.transcriptUrl || null } };
      }
      brief.status = brief.callPoints?.done ? 'complete' : 'partial';
    } catch (error) { errors.push(`fomc ${date}: ${String(error.message || error).slice(0, 120)}`); status.fomc = 'error'; }
    briefs.set(id, brief);
  }

  // US movers on EDGAR
  const us = MARKET_MOVERS.filter((mover) => mover.market !== 'KR');
  let ciks = null;
  if (sources.secReason) status.sec = sources.secReason;
  else {
    try { ciks = await sources.secTickers(); status.sec = 'ok'; } catch (error) { errors.push(`sec tickers: ${error.message}`); status.sec = 'error'; }
  }
  for (const mover of ciks ? us : []) {
    const cik = ciks.get(mover.sym);
    if (!cik) { errors.push(`sec: no CIK for ${mover.sym}`); continue; }
    try {
      const filings = (await sources.secFilings(cik)).filter((row) => Date.parse(row.acceptedAt || row.filingDate || '') >= nowMs - lookbackMs
        && (mover.foreignIssuer ? row.form === '6-K' : isResultsFiling(row)));
      for (const filing of filings) {
        const id = `earnings-${mover.sym}-${filing.accession}`;
        if (skipped.has(filing.accession)) continue;
        let brief = briefs.get(id);
        if (!brief || brief.status === 'pending') {
          const exhibit = await sources.secExhibit(cik, filing.accession);
          if (!exhibit?.text || (mover.foreignIssuer && !looksLikeQuarterlyResults(exhibit.text))) { skipped.add(filing.accession); continue; }
          const estimate = earningsRows.find((row) => row?.symbol === mover.sym && Math.abs(Date.parse(row.date) - Date.parse(filing.filingDate)) <= 3 * DAY) || null;
          const result = await runAi(jsonBody(earningsPrompt(mover, { kind: `SEC ${filing.form} ${exhibit.type}`, text: exhibit.text }), 'earnings_release', EARNINGS_SCHEMA), `earnings-${mover.sym}`);
          const sourceText = capText(exhibit.text);
          const base = { id, kind: 'earnings', symbol: mover.sym, nameKo: mover.nameKo, eventDate: filing.filingDate, publishedAt: filing.acceptedAt || `${filing.filingDate}T00:00:00Z`,
            source: { kind: 'T1_OFFICIAL', title: `SEC ${filing.form} ${exhibit.type}`, url: exhibit.url, accession: filing.accession, fetchedAt: nowIso, sha256: sha256(exhibit.text) },
            ai: [...(brief?.ai || []), ...(result.usage ? [aiLedger(`earnings-${mover.sym}`, result.usage)] : [])] };
          if (!result.json) { briefs.set(id, { ...base, status: 'pending', aiReason: result.reason }); continue; }
          const sections = assembleEarningsSections(result.json, sourceText, estimate ? { ...estimate, source: earningsSource } : null);
          brief = { ...base, status: 'partial', basis: 'primary-source', headline: safeHeadline(result.json.headline, sourceText, `${mover.nameKo} 실적 발표`),
            figures: sections.figures, details: sections.segments, detailTitle: '사업부문', guidance: sections.guidance, watch: sections.watch, dropped: sections.dropped,
            checkText: sourceText };
        }
        brief = await withCallPoints(brief, { mover, nowMs, nowIso, sourceText: brief.checkText, sources, runAi });
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
        brief = { id, kind: 'earnings', symbol: mover.sym, nameKo: mover.nameKo, eventDate: filing.date, publishedAt: `${filing.date}T00:00:00+09:00`, publishedDateOnly: true,
          source: { kind: 'T1_OFFICIAL', title: `DART ${filing.title}`, url: doc.url, rcpNo: filing.rcpNo, fetchedAt: nowIso, sha256: sha256(doc.text) },
          status: 'partial', basis: 'primary-source', period: parsed.quarter,
          headline: `${parsed.quarter || ''} 잠정 실적${op ? `: 영업이익 ${op.value}(${op.text})` : ''}`.replace(/\s+/g, ' ').trim(),
          figures, details: [], detailTitle: '사업부문', guidance: [], watch: [], dropped: [], firstSeenAt: nowIso,
          checkText: `${doc.text}\n${figures.map((figure) => `${figure.value} ${figure.text}`).join('\n')}`, ai: [] };
      }
      brief = await withCallPoints(brief, { mover, nowMs, nowIso, sourceText: brief.checkText, sources, runAi });
      briefs.set(id, brief);
    } catch (error) { errors.push(`dart ${mover.sym}: ${String(error.message || error).slice(0, 120)}`); status.dart = 'partial-error'; }
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
    // The release text stays only while a call summary is still to be checked against it.
    briefs: kept.map(({ checkText, ...brief }) => ({ ...brief, ...(checkText && brief.status !== 'pending' && !brief.callPoints?.done && (brief.callPoints?.attempts || 0) < MAX_SEARCH_ATTEMPTS ? { checkText } : {}) }))
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
  const artifact = await buildEventBriefs({ previous, sources, nowMs, fomcDecisions: macro?.schedules?.['us-fomc'] || [], earningsRows: calendar?.earnings || [], earningsSource: calendar?.source || null });
  await atomicWriteFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[event-briefs] ${artifact.briefs.length} briefs; status ${JSON.stringify(artifact.status)}; month AI ~$${artifact.costLedger.estimatedUsd}${artifact.errors.length ? `; errors: ${artifact.errors.join(' | ')}` : ''}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[event-briefs] failed: ${error?.stack || error}`); process.exit(1); });
}
