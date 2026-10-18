// P1734: automated official-reference lane (replaces the operator WebSearch snapshot).
// Stage 1 asks the shared Worker's hosted search for a candidate {value, date, sourceUrl}.
// Stage 2 fetches that sourceUrl itself (https + official allowed domain only) and publishes a value
// only when the page text contains the value and its date. A model answer that the page does not
// confirm is never published: the previous verified value is kept and marked stale, or the item stays
// unverified/unavailable with a reason. Every network call is injected (fetchImpl/requestImpl) so the
// fixture gate exercises the real functions without AI calls or official-site traffic.
import { requestSharedWebSearch, resolveSharedAiConfig } from './ai-shared-analysis.mjs';

export const OFFICIAL_REFERENCES_SCHEMA = 'official-web-references.v2';
export const OFFICIAL_REFERENCE_STATUSES = Object.freeze(['verified', 'stale', 'unverified', 'unavailable']);
export const LANE_POLICY = Object.freeze({
  monthlyCallCap: 40, // hard lane cap; the Worker's $20 monthly authority still meters every call
  dailyCallCap: 6, // per KST day across items, counted in the cache-backed ledger
  dueRetryDays: 7, // after nextExpectedAt, retry at most once per KST day for this many days
  overdueRecheckDays: 3, // then every N days until the release appears
  idleRecheckDays: 30, // nothing due and the next release is known
  unknownRecheckDays: 7, // nothing due and the next release is unknown
  heartbeatHours: 12, // rewrite checkedAt at least this often so lineage sees a live lane
});
const DAY = 86400000;
const QUOTE_MAX = 200;
const USER_AGENT = 'Mozilla/5.0 (compatible; AIO-official-reference-verifier/1.0; +https://ysnle.github.io/aio-screener/)';

const nullableNumber = { type: ['number', 'null'] };
const nullableString = { type: ['string', 'null'] };
const strictSchema = (properties) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const CORE = { found: { type: 'boolean' }, value: nullableNumber, date: nullableString, sourceUrl: nullableString, quote: nullableString };

export const OFFICIAL_REFERENCE_ITEMS = Object.freeze({
  bokBaseRate: Object.freeze({
    source: '한국은행 기준금리 추이 · 통화정책방향 결정회의 일정', sourceKind: 'official-primary',
    allowedDomains: Object.freeze(['bok.or.kr']), maxToolCalls: 2, unavailableBackoffDays: 3, graceDays: 1, maxObservationAgeDays: null,
    hintUrls: Object.freeze(['https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643',
      'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755']),
    schema: strictSchema({ ...CORE, nextMeeting: nullableString, nextMeetingSourceUrl: nullableString }),
    ask: (today) => `오늘은 ${today}(KST)이다. 한국은행 공식 누리집에서 (1) 현재 한국은행 기준금리(%)와 그 금리가 적용되기 시작한 가장 최근 변경일, (2) 오늘 이후 가장 가까운 통화정책방향 결정회의(금리 결정) 날짜를 찾아라. value=기준금리 숫자, date=최근 변경일(YYYY-MM-DD), sourceUrl=그 금리와 변경일이 본문에 함께 보이는 페이지, nextMeeting=다음 결정회의 날짜(YYYY-MM-DD), nextMeetingSourceUrl=그 날짜가 본문에 보이는 일정 페이지.`,
  }),
  krCpi: Object.freeze({
    source: '소비자물가동향 보도자료', sourceKind: 'official-primary',
    // 국가데이터처(구 통계청) serves the same press board on mods.go.kr and kostat.go.kr (checked 2026-10-13).
    allowedDomains: Object.freeze(['mods.go.kr', 'kostat.go.kr', 'korea.kr']), maxToolCalls: 1, unavailableBackoffDays: 3, graceDays: 3, maxObservationAgeDays: 75,
    hintUrls: Object.freeze(['https://kostat.go.kr/board.es?mid=a10301010000&bid=245']),
    schema: strictSchema({ ...CORE, period: nullableString }),
    ask: (today) => `오늘은 ${today}(KST)이다. 가장 최근에 공표된 한국 소비자물가동향 보도자료에서 소비자물가지수의 전년동월대비 상승률(%)을 찾아라. value=상승률 숫자(하락이면 음수), period=대상 월(YYYY-MM), date=보도자료 공표일(YYYY-MM-DD), sourceUrl=그 수치와 공표일이 본문에 보이는 보도자료 페이지.`,
  }),
  // v57.81 (checked 2026-10-15): the lane returned model-not-found because no search index holds the release.
  // customs.go.kr robots.txt disallows /*/na/ntt/ for Googlebot/Yeti/Daum/Bingbot and the press board opens each
  // post only through a JS POST form keyed by data-id + data-url, so search can neither crawl nor link the post.
  // korea.kr republishes it, but its body sits in a docViewer iframe (figures only in meta tags), so the page
  // check fails there; motie.go.kr now 301s to motir.go.kr. The lane therefore reads the official board list
  // itself (no AI), resolves the newest "수출입 현황 [잠정치]" post to its GET-able detail URL, and hands that
  // exact URL to the model; the model only opens it, and the page check below still decides what is published.
  krExports: Object.freeze({
    source: '수출입 현황 잠정치 · 수출입동향', sourceKind: 'official-primary',
    allowedDomains: Object.freeze(['customs.go.kr', 'motir.go.kr', 'motie.go.kr']), maxToolCalls: 2, unavailableBackoffDays: 3, graceDays: 3, maxObservationAgeDays: 45,
    hintUrls: Object.freeze(['https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?mi=2891&bbsId=1362']),
    resolveHints: (options) => resolveCustomsReleaseHint(options),
    schema: strictSchema({ ...CORE, exportsBillionUsd: nullableNumber, periodStart: nullableString, periodEnd: nullableString }),
    ask: (today) => `오늘은 ${today}(KST)이다. 관세청 보도자료 "YYYY년 M월 1일 ~ M월 10일(또는 20일) 수출입 현황 [잠정치]" 또는 월간 "YYYY년 M월 수출입 현황 [잠정치]" 중 가장 최근 공표본의 본문에서 수출 전년동기대비 증감률(%)과 수출액(억 달러를 10억 달러 단위로 환산, 예: 298억 달러=29.8)을 찾아라. value=수출 증감률 숫자, exportsBillionUsd=수출액(10억 달러), periodStart/periodEnd=집계 기간(YYYY-MM-DD), date=공표일(YYYY-MM-DD), sourceUrl=그 수치와 공표일이 본문에 보이는 공식 페이지.`,
  }),
  // Retired 2026-10-13 (coordinator): the public page shows the number only inside a dateless, three-month-delayed
  // iframe, so it can never be page-verified. Kept in the schema as unavailable/retired-unverifiable; never called.
  naaim: Object.freeze({
    retired: 'retired-unverifiable',
    source: 'NAAIM Exposure Index', sourceKind: 'publisher-public-web',
    allowedDomains: Object.freeze(['naaim.org']), maxToolCalls: 1, unavailableBackoffDays: 30, graceDays: 3, maxObservationAgeDays: 21,
    hintUrls: Object.freeze(['https://naaim.org/programs/naaim-exposure-index/']),
    schema: strictSchema(CORE),
    ask: (today) => `Today is ${today} (KST). Find the latest publicly displayed NAAIM Exposure Index reading on the official NAAIM site. value=the index number, date=the survey date (YYYY-MM-DD), sourceUrl=the official page whose body text shows that number and date.`,
  }),
});
export const OFFICIAL_REFERENCE_IDS = Object.freeze(Object.keys(OFFICIAL_REFERENCE_ITEMS));
const VALUE_FIELDS = Object.freeze({
  bokBaseRate: ['value', 'unit', 'effectiveDate', 'nextMeeting', 'nextMeetingSourceUrl', 'nextMeetingStatus'],
  krCpi: ['yoy', 'unit', 'period', 'publishedAt'],
  krExports: ['exportsYoyPct', 'exportsBillionUsd', 'period', 'periodLabel', 'publishedAt'],
  naaim: ['exposure', 'observedAt'],
});

// ---------- small pure helpers ----------
export const kstDate = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const isoDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const isoMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const dayMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const lastDayOfMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const withCommas = (form) => { const [int, frac] = form.split('.'); const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ','); return frac === undefined ? grouped : `${grouped}.${frac}`; };

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', sim: '∼', ndash: '–', mdash: '—', percnt: '%' };
function decodeEntity(match, body) {
  if (body[0] === '#') {
    const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
  }
  return ENTITIES[body.toLowerCase()] ?? match;
}

// Visible text plus a whitespace-free copy: official boards render "298 억 달러" / "13 일 ," with spaces.
// Whitespace between two digits becomes "|" so separate cells ("2.50 2024", "19,385 354,050") never fuse.
export function pageText(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, decodeEntity).replace(/\s+/g, ' ').trim();
  const map = [];
  let compact = '';
  for (let i = 0; i < text.length; i += 1) {
    if (!/\s/.test(text[i])) { compact += text[i]; map.push(i); continue; }
    if (/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) { compact += '|'; map.push(i); }
  }
  return { text, compact, map };
}

// Spelling variants of one number as it may be printed on an official page.
export function numberRegExps(value, { scales = [] } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return [];
  const abs = Math.abs(n);
  const forms = new Set([String(abs)]);
  for (const digits of [1, 2]) { const fixed = abs.toFixed(digits); if (Number(fixed) === abs) forms.add(fixed); }
  for (const form of [...forms]) if (abs >= 1000) forms.add(withCommas(form));
  const scaled = [];
  for (const { factor, suffix } of scales) {
    const v = abs * factor;
    if (Math.abs(v - Math.round(v)) < 1e-6) { const int = String(Math.round(v)); scaled.push(`${escapeRegExp(int)}${escapeRegExp(suffix)}`); if (Math.round(v) >= 1000) scaled.push(`${escapeRegExp(withCommas(int))}${escapeRegExp(suffix)}`); }
  }
  const sign = n < 0 ? '(?:-|−|△|▽)' : '';
  const before = n < 0 ? '(?<![\\d.,])' : '(?<![\\d.,\\-−△▽])';
  const plain = [...forms].map(escapeRegExp).map((form) => new RegExp(`${before}${sign}${form}(?![\\d]|[.,]\\d)`, 'g'));
  return [...plain, ...scaled.map((form) => new RegExp(`${before}${sign}${form}`, 'g'))];
}

const MONTH_NAMES = ['Jan(?:uary)?', 'Feb(?:ruary)?', 'Mar(?:ch)?', 'Apr(?:il)?', 'May', 'June?', 'July?', 'Aug(?:ust)?', 'Sep(?:t(?:ember)?)?', 'Oct(?:ober)?', 'Nov(?:ember)?', 'Dec(?:ember)?'];
export function dateRegExps(iso, { allowYearless = false } = {}) {
  if (!isoDay(iso)) return [];
  const [y, m, d] = iso.split('-').map(Number);
  const list = [new RegExp(`(?<!\\d)${y}(?:년|[.\\-/|])?0?${m}(?:월|[.\\-/])0?${d}(?!\\d)`, 'g'),
    new RegExp(`(?<!\\d)0?${m}/0?${d}/(?:${y}|${y % 100})(?!\\d)`, 'g'),
    new RegExp(`(?<![A-Za-z])${MONTH_NAMES[m - 1]}\\.?0?${d}(?:st|nd|rd|th)?,?${y}(?!\\d)`, 'gi')];
  if (allowYearless) list.push(new RegExp(`(?<![\\d.])0?${m}월0?${d}일`, 'g'));
  return list;
}

const indexesOf = (compact, regexps) => regexps.flatMap((re) => [...compact.matchAll(re)].map((match) => match.index));

function closestPair(valueIdx, dateIdx) {
  let best = null;
  for (const v of valueIdx) for (const d of dateIdx) { const gap = Math.abs(v - d); if (!best || gap < best.gap) best = { v, d, gap }; }
  return best;
}

function excerpt(page, compactIndex) {
  const at = page.map[Math.min(compactIndex, page.map.length - 1)] ?? 0;
  let start = Math.max(0, at - 70);
  let quote = page.text.slice(start, start + QUOTE_MAX).trim();
  if (quote.length > QUOTE_MAX) quote = quote.slice(0, QUOTE_MAX);
  return quote;
}

export function officialUrl(raw, domains) {
  let url;
  try { url = new URL(String(raw || '')); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null;
  const host = url.hostname.toLowerCase();
  if (!domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return null;
  url.hash = '';
  return url;
}

function decodeBody(buffer, contentType) {
  const head = new TextDecoder('utf-8').decode(buffer.slice(0, 4096));
  const charset = (/charset=["']?([\w-]+)/i.exec(contentType || '') || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1] || 'utf-8';
  try { return new TextDecoder(charset.toLowerCase()).decode(buffer); } catch { return new TextDecoder('utf-8').decode(buffer); }
}

// Reads at most maxBytes; a stream is cancelled as soon as it passes the bound.
async function readBounded(response, maxBytes) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.byteLength > maxBytes ? null : buffer;
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel('official page byte limit'); } catch {} return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

export const MAX_REDIRECT_HOPS = 3;
const fetchErrorDetail = (error) => String(error?.cause?.code || error?.code || error?.cause?.name || error?.name || '').replace(/[^\w.-]/g, '').slice(0, 48) || null;

// redirect:'manual' so every hop is re-checked against the official allowlist before it is requested.
export async function fetchOfficialPage(raw, domains, { fetchImpl = fetch, timeoutMs = 20000, maxBytes = 4 * 1024 * 1024, cache = null } = {}) {
  const url = officialUrl(raw, domains);
  if (!url) return { ok: false, reason: 'source-url-not-official' };
  if (cache?.has(url.href)) return cache.get(url.href);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let result;
  try {
    let current = url;
    let response = null;
    for (let hop = 0; ; hop += 1) {
      response = await fetchImpl(current.href, { method: 'GET', redirect: 'manual', signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9', 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5' } });
      if (!(response.status >= 300 && response.status < 400)) break;
      const location = response.headers?.get?.('location');
      let next = null;
      try { next = location ? officialUrl(new URL(location, current).href, domains) : null; } catch { next = null; }
      try { await response.body?.cancel?.(); } catch {}
      if (!next) { result = { ok: false, reason: 'source-redirect-not-official' }; break; }
      if (hop + 1 > MAX_REDIRECT_HOPS) { result = { ok: false, reason: 'source-too-many-redirects' }; break; }
      current = next;
    }
    if (!result) {
      const type = response.headers?.get?.('content-type') || '';
      const declared = Number(response.headers?.get?.('content-length'));
      if (!response.ok) result = { ok: false, reason: `source-http-${response.status}` };
      else if (type && !/text\/html|text\/plain|application\/xhtml/i.test(type)) result = { ok: false, reason: 'source-not-html' };
      else if (Number.isFinite(declared) && declared > maxBytes) result = { ok: false, reason: 'source-too-large' };
      else {
        const buffer = await readBounded(response, maxBytes);
        const html = buffer ? decodeBody(buffer, type) : '';
        result = !buffer ? { ok: false, reason: 'source-too-large' } : { ok: true, url: current.href, html, ...pageText(html) };
      }
    }
  } catch (error) {
    // The network cause (TLS chain, reset, DNS) only goes to the run log, so a failing lane can be diagnosed.
    result = { ok: false, reason: error?.name === 'AbortError' ? 'source-timeout' : 'source-fetch-failed', detail: fetchErrorDetail(error) };
  } finally { clearTimeout(timer); }
  cache?.set(url.href, result);
  return result;
}

// v57.81: the customs press board links each post as <a data-id="<nttSn>" data-url="<nttSnUrl>" title="...">
// submitted by POST; the same detail page answers a GET carrying both keys (checked 2026-10-15). Only the
// newest preliminary-figure post is resolved (확정치 and 운송비용 posts are other releases). Returns [] on any
// miss, so the lane falls back to the static hints and the page check is unchanged.
export const CUSTOMS_PRESS_BOARD = 'https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?mi=2891&bbsId=1362';
const CUSTOMS_RELEASE_TITLE = /수출입\s*현황\s*\[잠정치\]/;
export function customsReleaseLinks(html) {
  const attr = (tag, name) => (new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag) || [])[1] ?? null;
  return [...String(html || '').matchAll(/<a\b[^>]*\bdata-id\s*=\s*"\d+"[^>]*>/gi)].map((match) => ({
    nttSn: attr(match[0], 'data-id'), nttSnUrl: attr(match[0], 'data-url'), title: (attr(match[0], 'title') || '').replace(/\s+/g, ' ').trim(),
  })).filter((row) => /^\d{1,12}$/.test(row.nttSn || '') && /^[0-9a-f]{16,64}$/i.test(row.nttSnUrl || '') && CUSTOMS_RELEASE_TITLE.test(row.title))
    .sort((a, b) => Number(b.nttSn) - Number(a.nttSn))
    .map((row) => ({ title: row.title,
      url: `https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?mi=2891&bbsId=1362&nttSn=${row.nttSn}&nttSnUrl=${row.nttSnUrl.toLowerCase()}` }));
}
async function resolveCustomsReleaseHint({ fetchImpl = fetch, cache = null } = {}) {
  const board = await fetchOfficialPage(CUSTOMS_PRESS_BOARD, ['customs.go.kr'], { fetchImpl, cache });
  return board.ok ? customsReleaseLinks(board.html).slice(0, 1) : [];
}

// The label printed closest before a value must be the asked-for one: a swapped import growth, month-on-month
// rate or semiconductor amount sits behind a rival label ("수입", "전월대비", "반도체") and is refused.
function lastIndex(text, pattern) {
  let at = -1;
  for (const match of text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))) at = match.index;
  return at;
}
const labelled = (compact, index, anchors) => anchors.every(({ target, rivals, lookback = 80 }) => {
  const before = compact.slice(Math.max(0, index - lookback), index);
  const own = lastIndex(before, target);
  return own >= 0 && own > lastIndex(before, rivals);
});

// Signed rates: "5.2% 감소" is -5.2. A bare magnitude followed by a decline word never confirms a positive
// value, and a negative value is confirmed by an explicit sign or by its magnitude followed by the decline word.
const DECLINE = /감소|하락|줄/;
function valueMatches(compact, value, { scales = [], signed = false } = {}) {
  const hits = (regexps) => regexps.flatMap((re) => [...compact.matchAll(re)].map((match) => ({ index: match.index, end: match.index + match[0].length })));
  const tail = (end) => compact.slice(end, end + 15).split(/\d/)[0];
  const n = Number(value);
  if (!signed || n === 0) return hits(numberRegExps(value, { scales })).map((hit) => hit.index);
  if (n > 0) return hits(numberRegExps(n, { scales })).filter((hit) => !DECLINE.test(tail(hit.end))).map((hit) => hit.index);
  const explicit = hits(numberRegExps(n, { scales })).filter((hit) => !DECLINE.test(tail(hit.end)));
  const worded = hits(numberRegExps(-n, { scales })).filter((hit) => /^%?(?:p|포인트)?(?:감소|하락|줄)/.test(tail(hit.end)));
  return [...explicit, ...worded].map((hit) => hit.index);
}

// The period printed nearest before a value must be the asked-for month: in a trend table ("2026.8 2.1 /
// 2026.9 2.9") the neighbouring month's figure is refused instead of passing on a page-wide period match.
const MONTH_TOKEN = /(?<!\d)(?:(\d{4})(?:년|[.\-/]))?(\d{1,2})월|(?<![\d.])(\d{4})[.\-/](\d{1,2})(?!\d)|\((\d{1,2})\.\d{1,2}\./g;
function periodBeforeValue(compact, index, { y, m, lookback = 80 }) {
  const before = compact.slice(Math.max(0, index - lookback), index);
  let last = null;
  for (const match of before.matchAll(MONTH_TOKEN)) last = match;
  if (!last) return 'period-not-near-value';
  const year = last[1] || last[3] || null;
  const month = Number(last[2] || last[4] || last[5]);
  return month === m && (!year || Number(year) === y) ? null : 'value-period-mismatch';
}

// Value and date must both appear, close together, on the fetched official page.
function confirmOnPage(page, { value, date, scales, window, allowYearless = false, anchors = [], signed = false, period = null }) {
  const found = valueMatches(page.compact, value, { scales, signed });
  if (!found.length) return { ok: false, reason: 'value-not-on-page' };
  const labelledIdx = found.filter((index) => labelled(page.compact, index, anchors));
  if (!labelledIdx.length) return { ok: false, reason: 'value-label-mismatch' };
  const periodReasons = period ? labelledIdx.map((index) => periodBeforeValue(page.compact, index, period)) : [];
  const valueIdx = period ? labelledIdx.filter((_, i) => periodReasons[i] === null) : labelledIdx;
  if (!valueIdx.length) return { ok: false, reason: periodReasons.includes('value-period-mismatch') ? 'value-period-mismatch' : 'period-not-near-value' };
  const dateIdx = indexesOf(page.compact, dateRegExps(date, { allowYearless }));
  if (!dateIdx.length) return { ok: false, reason: 'date-not-on-page' };
  const pair = closestPair(valueIdx, dateIdx);
  if (pair.gap > window) return { ok: false, reason: 'value-date-not-adjacent' };
  return { ok: true, quote: excerpt(page, pair.v) };
}

const CPI_SUBJECT = { target: /소비자물가/, rivals: /생활물가|근원|신선식품|농축수산물|공업제품|서비스|식료품|에너지|외식/ };
const EXPORT_SUBJECT = { target: /수출/, rivals: /수입|무역수지|반도체|자동차|승용차|일평균|선박|석유제품/ };
const YOY_BASIS = { target: /전년동월|전년동기|전년대비|전년비/, rivals: /전월대비|전월비|전기대비/ };
const inRange = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;

// ---------- item verifiers (candidate -> published fields, or a reason) ----------
const VERIFIERS = {
  async bokBaseRate(c, ctx) {
    if (!inRange(c.value, 0, 10) || Math.abs(c.value * 100 - Math.round(c.value * 100)) > 1e-6 || Math.round(c.value * 100) % 25 !== 0) return { ok: false, reason: 'value-out-of-range' };
    if (ctx.previous?.effectiveDate && c.date < ctx.previous.effectiveDate) return { ok: false, reason: 'older-than-previous' };
    const page = await ctx.page(c.sourceUrl);
    if (!page.ok) return page;
    // Bind value and date to the same table row ("2026 08월 27일 3.00"); nearby rows hold other rates, so
    // proximity alone is not proof. A page without that row layout fails closed.
    const rows = [...page.compact.matchAll(/(?<!\d)(\d{4})\|?(\d{2})월(\d{2})일\|?(\d{1,2}\.\d{2})(?!\d)/g)]
      .map((match) => ({ date: `${match[1]}-${match[2]}-${match[3]}`, rate: Number(match[4]), index: match.index }));
    if (!rows.length) return { ok: false, reason: 'rate-table-not-on-page' };
    const row = rows.find((entry) => entry.date === c.date);
    if (!row) return { ok: false, reason: 'date-not-on-page' };
    if (Math.abs(row.rate - c.value) > 1e-9) return { ok: false, reason: 'value-not-in-date-row' };
    // The table lists the newest change first; a newer row means the candidate is not the current rate.
    if (rows.some((entry) => entry.date > c.date)) return { ok: false, reason: 'newer-observation-on-page' };
    const hit = { ok: true, quote: excerpt(page, row.index) };
    let meeting = { nextMeeting: null, nextMeetingSourceUrl: null, nextMeetingStatus: 'unverified' };
    const horizon = dayMs(ctx.today) + 120 * DAY;
    if (isoDay(c.nextMeeting) && c.nextMeeting >= ctx.today && dayMs(c.nextMeeting) <= horizon) {
      const schedule = await ctx.page(c.nextMeetingSourceUrl);
      const [y] = c.nextMeeting.split('-');
      if (schedule.ok && schedule.compact.includes(y) && indexesOf(schedule.compact, dateRegExps(c.nextMeeting, { allowYearless: true })).length) {
        meeting = { nextMeeting: c.nextMeeting, nextMeetingSourceUrl: schedule.url, nextMeetingStatus: 'verified' };
      }
    }
    if (meeting.nextMeetingStatus !== 'verified' && ctx.previous?.nextMeetingStatus === 'verified' && ctx.previous.nextMeeting >= ctx.today) {
      meeting = { nextMeeting: ctx.previous.nextMeeting, nextMeetingSourceUrl: ctx.previous.nextMeetingSourceUrl, nextMeetingStatus: 'verified' };
    }
    return { ok: true, sourceUrl: page.url, verifiedQuote: hit.quote, observation: c.date,
      fields: { value: c.value, unit: '%', effectiveDate: c.date, ...meeting } };
  },
  async krCpi(c, ctx) {
    if (!inRange(c.value, -5, 20)) return { ok: false, reason: 'value-out-of-range' };
    if (!isoMonth(c.period)) return { ok: false, reason: 'period-invalid' };
    const [y, m] = c.period.split('-').map(Number);
    const periodEnd = Date.UTC(y, m - 1, lastDayOfMonth(y, m));
    if (dayMs(c.date) <= periodEnd || dayMs(c.date) > periodEnd + 45 * DAY) return { ok: false, reason: 'period-date-inconsistent' };
    if (ctx.previous?.period && c.period < ctx.previous.period) return { ok: false, reason: 'older-than-previous' };
    const page = await ctx.page(c.sourceUrl);
    if (!page.ok) return page;
    if (!new RegExp(`(?<!\\d)${y}(?:년|[.\\-/])0?${m}(?:월|(?!\\d))`).test(page.compact)) return { ok: false, reason: 'period-not-on-page' };
    const hit = confirmOnPage(page, { value: c.value, date: c.date, window: 2000, anchors: [CPI_SUBJECT, YOY_BASIS], signed: true, period: { y, m, lookback: 60 } });
    if (!hit.ok) return hit;
    return { ok: true, sourceUrl: page.url, verifiedQuote: hit.quote, observation: `${c.period}-${String(lastDayOfMonth(y, m)).padStart(2, '0')}`,
      fields: { yoy: c.value, unit: '%', period: c.period, publishedAt: c.date } };
  },
  async krExports(c, ctx) {
    if (!inRange(c.value, -90, 400) || !inRange(c.exportsBillionUsd, 0.1, 2000)) return { ok: false, reason: 'value-out-of-range' };
    if (!isoDay(c.periodStart) || !isoDay(c.periodEnd) || !c.periodStart.endsWith('-01') || c.periodStart.slice(0, 7) !== c.periodEnd.slice(0, 7)) return { ok: false, reason: 'period-invalid' };
    const [y, m, endDay] = c.periodEnd.split('-').map(Number);
    const fullMonth = endDay === lastDayOfMonth(y, m);
    if (![10, 20].includes(endDay) && !fullMonth) return { ok: false, reason: 'period-invalid' };
    if (dayMs(c.date) <= dayMs(c.periodEnd) || dayMs(c.date) > dayMs(c.periodEnd) + 20 * DAY) return { ok: false, reason: 'period-date-inconsistent' };
    if (ctx.previous?.period && c.periodEnd < ctx.previous.period.split('..')[1]) return { ok: false, reason: 'older-than-previous' };
    const page = await ctx.page(c.sourceUrl);
    if (!page.ok) return page;
    const partial = new RegExp(`(?<!\\d)${m}월0?1일[~∼\\-–]+(?:${m}월)?${endDay}일|\\(${m}\\.0?1\\.?[~∼\\-–]+(?:${m}\\.)?${endDay}\\.?\\)`);
    const monthly = new RegExp(`(?<!\\d)${y}(?:년|[.\\-/])0?${m}(?:월|(?!\\d))`);
    if (!(fullMonth ? monthly : partial).test(page.compact)) return { ok: false, reason: 'period-not-on-page' };
    const hit = confirmOnPage(page, { value: c.value, date: c.date, window: 2000, anchors: [EXPORT_SUBJECT, YOY_BASIS], signed: true, period: { y, m, lookback: 80 } });
    if (!hit.ok) return hit;
    const amount = confirmOnPage(page, { value: c.exportsBillionUsd, date: c.date, window: 2000, scales: [{ factor: 10, suffix: '억' }], anchors: [EXPORT_SUBJECT], period: { y, m, lookback: 80 } });
    if (!amount.ok) return { ok: false, reason: `amount-${amount.reason}` };
    const mm = String(m).padStart(2, '0');
    return { ok: true, sourceUrl: page.url, verifiedQuote: hit.quote, observation: c.periodEnd,
      fields: { exportsYoyPct: c.value, exportsBillionUsd: c.exportsBillionUsd, period: `${c.periodStart}..${c.periodEnd}`,
        periodLabel: fullMonth ? `${y}-${mm}` : `${c.periodStart}~${String(endDay).padStart(2, '0')}`, publishedAt: c.date } };
  },
  async naaim(c, ctx) {
    if (!inRange(c.value, -200, 200)) return { ok: false, reason: 'value-out-of-range' };
    if (ctx.previous?.observedAt && c.date < ctx.previous.observedAt) return { ok: false, reason: 'older-than-previous' };
    const page = await ctx.page(c.sourceUrl);
    if (!page.ok) return page;
    const hit = confirmOnPage(page, { value: c.value, date: c.date, window: 2000 });
    if (!hit.ok) return hit;
    return { ok: true, sourceUrl: page.url, verifiedQuote: hit.quote, observation: c.date, fields: { exposure: c.value, observedAt: c.date } };
  },
};

export async function verifyCandidate(id, candidate, { fetchImpl = fetch, now = Date.now(), previous = null, cache = new Map() } = {}) {
  const def = OFFICIAL_REFERENCE_ITEMS[id];
  if (!def) return { ok: false, reason: 'unknown-item' };
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { ok: false, reason: 'model-json-invalid' };
  if (candidate.found !== true) return { ok: false, reason: 'model-not-found' };
  const today = kstDate(now);
  if (!isoDay(candidate.date)) return { ok: false, reason: 'date-invalid' };
  if (candidate.date > today) return { ok: false, reason: 'date-in-future' };
  if (!officialUrl(candidate.sourceUrl, def.allowedDomains)) return { ok: false, reason: 'source-url-not-official' };
  const previousVerified = previous && previous.verifiedAt ? previous : null;
  const page = (url) => fetchOfficialPage(url, def.allowedDomains, { fetchImpl, cache });
  try {
    return await VERIFIERS[id](candidate, { today, now, previous: previousVerified, page });
  } catch {
    return { ok: false, reason: 'verifier-error' };
  }
}

// ---------- scheduling, expiry and artifact assembly ----------
export function nextExpectedAt(id, fields) {
  if (!fields) return null;
  if (id === 'bokBaseRate') return fields.nextMeetingStatus === 'verified' && isoDay(fields.nextMeeting) ? `${fields.nextMeeting}T02:00:00.000Z` : null;
  if (id === 'krCpi' && isoMonth(fields.period)) { const [y, m] = fields.period.split('-').map(Number); return new Date(Date.UTC(y, m + 1, 2)).toISOString(); } // month after the next period, day 2
  if (id === 'krExports' && typeof fields.period === 'string') {
    const end = fields.period.split('..')[1];
    if (!isoDay(end)) return null;
    const [y, m, d] = end.split('-').map(Number);
    if (d === 10) return new Date(Date.UTC(y, m - 1, 21)).toISOString();
    if (d === 20) return new Date(Date.UTC(y, m, 1)).toISOString();
    return new Date(Date.UTC(y, m, 11)).toISOString();
  }
  if (id === 'naaim' && isoDay(fields.observedAt)) return new Date(dayMs(fields.observedAt) + 8 * DAY).toISOString();
  return null;
}

export function emptyReference(id) {
  const def = OFFICIAL_REFERENCE_ITEMS[id];
  const fields = Object.fromEntries(VALUE_FIELDS[id].map((key) => [key, null]));
  return { status: 'unavailable', reason: 'not-yet-checked', ...fields, sourceUrl: null, verifiedQuote: null, checkedAt: null, verifiedAt: null,
    nextExpectedAt: null, lastAttemptOk: null, observation: null, source: def.source, sourceKind: def.sourceKind, allowedUse: 'reference-only' };
}

// Status from evidence age alone (runs every cycle, no AI): a verified value past its next release is stale.
export function classifyReference(id, item, now) {
  const def = OFFICIAL_REFERENCE_ITEMS[id];
  if (!item || !item.verifiedAt) return item;
  const next = Date.parse(item.nextExpectedAt || '');
  const tooLate = Number.isFinite(next) && now > next + def.graceDays * DAY;
  const tooOld = def.maxObservationAgeDays != null && isoDay(item.observation) && now - dayMs(item.observation) > def.maxObservationAgeDays * DAY;
  if (item.status === 'verified' && (tooLate || tooOld)) return { ...item, status: 'stale', reason: item.reason || (tooLate ? 'next-release-not-verified' : 'observation-older-than-max-age') };
  return item;
}

export function dueDecision(id, item, now, policy = LANE_POLICY) {
  const def = OFFICIAL_REFERENCE_ITEMS[id];
  const last = Date.parse(item?.checkedAt || '');
  if (!Number.isFinite(last)) return { due: true, reason: 'never-checked' };
  if (kstDate(last) === kstDate(now)) return { due: false, reason: 'checked-today' };
  const ageDays = (now - last) / DAY;
  if (!item.verifiedAt || item.lastAttemptOk === false) {
    const next = Date.parse(item.nextExpectedAt || '');
    if (item.verifiedAt && Number.isFinite(next) && now >= next && (now - next) / DAY <= policy.dueRetryDays) return { due: true, reason: 'release-due' };
    return ageDays >= def.unavailableBackoffDays ? { due: true, reason: 'retry-after-backoff' } : { due: false, reason: 'backoff' };
  }
  const next = Date.parse(item.nextExpectedAt || '');
  if (Number.isFinite(next) && now >= next) {
    if ((now - next) / DAY <= policy.dueRetryDays) return { due: true, reason: 'release-due' };
    return ageDays >= policy.overdueRecheckDays ? { due: true, reason: 'release-overdue' } : { due: false, reason: 'overdue-backoff' };
  }
  const idle = Number.isFinite(next) ? policy.idleRecheckDays : policy.unknownRecheckDays;
  return ageDays >= idle ? { due: true, reason: 'idle-recheck' } : { due: false, reason: 'not-due' };
}

export function buildSearchPrompt(id, now, resolved = []) {
  const def = OFFICIAL_REFERENCE_ITEMS[id];
  const direct = resolved.filter((row) => officialUrl(row?.url, def.allowedDomains));
  return [def.ask(kstDate(now)),
    ...direct.map((row) => `The newest official release "${row.title}" is at ${row.url} . Search indexes do not hold this page: open that exact URL first and return it as sourceUrl.`),
    `Use only these official domains: ${def.allowedDomains.join(', ')}. Useful starting pages: ${def.hintUrls.join(' , ')}.`,
    'Copy numbers and dates exactly as the page shows them; never estimate, average, or use news or secondary sites.',
    'Return found=false with every other field null when the official page does not show the value. The value will be re-checked against the page text and discarded if absent.'].join('\n');
}

const AI_UNAVAILABLE = new Set(['shared-ai-not-configured', 'provider-timeout', 'provider-error', 'provider-response-incomplete', 'search-request-invalid', 'model-not-found']);

function failedReference(id, previous, reason, attemptAt) {
  if (previous?.verifiedAt) return { ...previous, status: 'stale', reason, checkedAt: attemptAt, lastAttemptOk: false };
  const base = emptyReference(id);
  return { ...base, status: AI_UNAVAILABLE.has(reason) || /^provider-http-/.test(reason) ? 'unavailable' : 'unverified', reason, checkedAt: attemptAt, lastAttemptOk: false };
}

export async function refreshReference(id, previous, { now, env, fetchImpl = fetch, requestImpl = requestSharedWebSearch, cache = new Map() }) {
  const def = OFFICIAL_REFERENCE_ITEMS[id];
  const attemptAt = new Date(now).toISOString();
  let resolved = [];
  if (def.resolveHints) { try { resolved = await def.resolveHints({ fetchImpl, cache }); } catch { resolved = []; } }
  const result = await requestImpl(buildSearchPrompt(id, now, resolved), { env, fetchImpl, purpose: `official-ref-${id}`,
    allowedDomains: [...def.allowedDomains], schemaName: `aio_official_${id}`, schema: def.schema, maxToolCalls: def.maxToolCalls });
  if (!result?.text) return { item: failedReference(id, previous, result?.reason || 'provider-response-incomplete', attemptAt), reason: result?.reason };
  let candidate;
  try { candidate = JSON.parse(result.text); } catch { return { item: failedReference(id, previous, 'model-json-invalid', attemptAt), reason: 'model-json-invalid' }; }
  const verified = await verifyCandidate(id, candidate, { fetchImpl, now, previous, cache });
  if (!verified.ok) return { item: failedReference(id, previous, verified.reason, attemptAt), reason: verified.reason,
    detail: [def.resolveHints && !resolved.length ? 'hint-unresolved' : null, verified.detail].filter(Boolean).join(', ') || null };
  const item = { ...emptyReference(id), ...verified.fields, status: 'verified', reason: null, sourceUrl: verified.sourceUrl,
    verifiedQuote: String(verified.verifiedQuote || '').slice(0, QUOTE_MAX), checkedAt: attemptAt, verifiedAt: attemptAt, lastAttemptOk: true,
    observation: verified.observation, nextExpectedAt: nextExpectedAt(id, verified.fields) };
  return { item: classifyReference(id, item, now), reason: null };
}

const monthKey = (ms) => new Date(ms).toISOString().slice(0, 7);
function capFrom(env) {
  const raw = String(env?.OFFICIAL_REF_MONTHLY_CALL_CAP ?? LANE_POLICY.monthlyCallCap);
  return /^\d{1,3}$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 150 ? Number(raw) : LANE_POLICY.monthlyCallCap;
}

// P1734: the call ledger survives runs whose data commit never landed (fetch/promotion failure, push race), via the
// Actions cache in refresh-data.yml. Counters and per-item attempt times take the larger/later of ledger and artifact.
export const OFFICIAL_REF_LEDGER_SCHEMA = 'official-ref-ledger.v1';
const safeCount = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
export function mergeLedger(ledger, prior, now) {
  const month = monthKey(now);
  const day = kstDate(now);
  const valid = ledger && ledger.schemaVersion === OFFICIAL_REF_LEDGER_SCHEMA ? ledger : null;
  const ledgerMonth = valid?.month === month ? safeCount(valid.callsThisMonth) : 0;
  const artifactMonth = prior?.lane?.month === month ? safeCount(prior.lane.callsThisMonth) : 0;
  const ledgerDay = valid?.days && typeof valid.days === 'object' ? safeCount(valid.days[day]) : 0;
  const artifactDay = prior?.lane?.day === day ? safeCount(prior.lane.callsToday) : 0;
  const attempts = {};
  for (const id of OFFICIAL_REFERENCE_IDS) {
    const times = [valid?.items?.[id]?.lastAttemptAt, prior?.items?.[id]?.checkedAt].map((value) => Date.parse(value || '')).filter(Number.isFinite);
    if (times.length) attempts[id] = new Date(Math.max(...times)).toISOString();
  }
  return { schemaVersion: OFFICIAL_REF_LEDGER_SCHEMA, month, callsThisMonth: Math.max(ledgerMonth, artifactMonth),
    days: { [day]: Math.max(ledgerDay, artifactDay) }, items: Object.fromEntries(Object.entries(attempts).map(([id, at]) => [id, { lastAttemptAt: at }])) };
}

export async function refreshOfficialReferences({ previous = null, ledger: restoredLedger = null, persistLedger = null, now = Date.now(), env = process.env, fetchImpl = fetch, requestImpl = requestSharedWebSearch, policy = LANE_POLICY } = {}) {
  const prior = previous && previous.schemaVersion === OFFICIAL_REFERENCES_SCHEMA && previous.items && typeof previous.items === 'object' ? previous : null;
  const month = monthKey(now);
  const day = kstDate(now);
  const cap = capFrom(env);
  const ledger = mergeLedger(restoredLedger, prior, now);
  let calls = ledger.callsThisMonth;
  const aiConfigured = !!resolveSharedAiConfig(env);
  const items = {};
  const decisions = {};
  const cache = new Map();
  let runCalls = 0;
  for (const id of OFFICIAL_REFERENCE_IDS) {
    if (OFFICIAL_REFERENCE_ITEMS[id].retired) {
      items[id] = { ...emptyReference(id), reason: OFFICIAL_REFERENCE_ITEMS[id].retired };
      decisions[id] = OFFICIAL_REFERENCE_ITEMS[id].retired;
      continue;
    }
    const before = prior?.items?.[id] ? { ...emptyReference(id), ...prior.items[id] } : emptyReference(id);
    // Schedule from the latest known attempt, even one whose artifact was never committed.
    const lastAttemptAt = ledger.items[id]?.lastAttemptAt || before.checkedAt;
    const decision = dueDecision(id, { ...before, checkedAt: lastAttemptAt }, now, policy);
    if (!decision.due) { items[id] = classifyReference(id, before, now); decisions[id] = decision.reason; continue; }
    if (!aiConfigured) { items[id] = classifyReference(id, before, now); decisions[id] = 'shared-ai-not-configured'; continue; }
    if (calls >= cap) { items[id] = classifyReference(id, before, now); decisions[id] = 'monthly-call-cap'; continue; }
    if (ledger.days[day] >= policy.dailyCallCap) { items[id] = classifyReference(id, before, now); decisions[id] = 'daily-call-cap'; continue; }
    calls += 1; runCalls += 1;
    // Record the attempt before spending, so a crash or a lost commit still counts it.
    ledger.callsThisMonth = calls;
    ledger.days[day] += 1;
    ledger.items[id] = { lastAttemptAt: new Date(now).toISOString() };
    if (persistLedger) persistLedger(ledger);
    const { item, reason, detail } = await refreshReference(id, before, { now, env, fetchImpl, requestImpl, cache });
    items[id] = item;
    decisions[id] = reason ? `failed:${reason}${detail ? ` (${detail})` : ''}` : `verified:${decision.reason}`;
  }
  const nowIso = new Date(now).toISOString();
  const lane = { month, callsThisMonth: calls, monthlyCallCap: cap, day, callsToday: ledger.days[day], dailyCallCap: policy.dailyCallCap,
    lastRunCalls: runCalls, aiConfigured, policy: 'official-page-verified; model candidates are never published' };
  const changed = !prior || JSON.stringify(prior.items) !== JSON.stringify(items) || prior.lane?.month !== month || prior.lane?.callsThisMonth !== calls
    || prior.lane?.day !== day || prior.lane?.callsToday !== ledger.days[day] || prior.lane?.aiConfigured !== aiConfigured;
  const heartbeatDue = !prior || !(now - Date.parse(prior.checkedAt || '') < policy.heartbeatHours * 3600000);
  const artifact = { schemaVersion: OFFICIAL_REFERENCES_SCHEMA, checkedAt: changed || heartbeatDue ? nowIso : prior.checkedAt, lane, items };
  return { artifact, write: changed || heartbeatDue, decisions, ledger };
}

// Shared by the producer (refuses to write) and the gate (refuses to pass).
export function validateOfficialReferences(artifact, { now = Date.now() } = {}) {
  const problems = [];
  if (!artifact || artifact.schemaVersion !== OFFICIAL_REFERENCES_SCHEMA) return ['schemaVersion'];
  const checked = Date.parse(artifact.checkedAt || '');
  if (!Number.isFinite(checked) || checked > now + 5 * 60000) problems.push('checkedAt');
  for (const id of OFFICIAL_REFERENCE_IDS) {
    const item = artifact.items?.[id];
    const def = OFFICIAL_REFERENCE_ITEMS[id];
    if (!item) { problems.push(`${id}:missing`); continue; }
    if (def.retired && (item.status !== 'unavailable' || item.reason !== def.retired)) problems.push(`${id}:retired-item-published`);
    if (!OFFICIAL_REFERENCE_STATUSES.includes(item.status)) problems.push(`${id}:status`);
    for (const key of ['sourceUrl', 'verifiedQuote', 'checkedAt', 'nextExpectedAt']) if (!(key in item)) problems.push(`${id}:${key}-field`);
    if (item.verifiedQuote != null && (typeof item.verifiedQuote !== 'string' || item.verifiedQuote.length > QUOTE_MAX)) problems.push(`${id}:verifiedQuote`);
    const hasValues = VALUE_FIELDS[id].filter((key) => !['unit', 'nextMeetingStatus'].includes(key)).some((key) => item[key] != null);
    if (['verified', 'stale'].includes(item.status) || hasValues) {
      if (!item.verifiedAt || !officialUrl(item.sourceUrl, def.allowedDomains) || !item.verifiedQuote) problems.push(`${id}:unverified-value-published`);
    }
    if (['unverified', 'unavailable'].includes(item.status) && hasValues) problems.push(`${id}:values-without-verification`);
    if (item.nextMeetingStatus === 'verified' && !officialUrl(item.nextMeetingSourceUrl, def.allowedDomains)) problems.push(`${id}:nextMeetingSourceUrl`);
  }
  return problems;
}
