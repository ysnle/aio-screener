// v58.71 (owner 2026-10-23: "평소 우리가 놓칠 수 있는 핵심 주요 정보/데이터들까지 각 채널에서 보내주니까"): the research
// channels carry structured data the digest reduced to a 120-character summary — analyst rating and target-price
// changes, reported quarters against estimates, economic releases against forecasts, and the daily list of what
// Korean retail investors bought in US stocks. These pure extractors read the full text of freshly fetched posts once
// and keep only the numbers, so the screener and the market reading can use them without redistributing the text.
//
import { matchTickers } from './telegram-tickers.mjs';

// A ticker is kept only when the post writes it ($NVDA, (NVDA), [028050], 089890/KQ, 000660.KS) and, for the bracket
// and code forms, the screener universe confirms it; a company named only in Korean prose gets no ticker (no guessing).

const RATING_WORDS = [
  ['buy', /매수|비중\s*확대|시장\s*수익률\s*상회|outperform|overweight|\bbuy\b|strong buy|top pick/i],
  ['sell', /매도|비중\s*축소|시장\s*수익률\s*하회|underperform|underweight|\bsell\b|\breduce\b/i],
  ['hold', /중립|보유|시장\s*수익률|market perform|equal[- ]?weight|neutral|\bhold\b/i]
];
const RATING_TOKEN = String.raw`(?:매수|비중\s*확대|비중\s*축소|시장\s*수익률\s*상회|시장\s*수익률\s*하회|시장\s*수익률|중립|매도|보유|Outperform|Overweight|Underweight|Underperform|Market Perform|Equal[- ]?weight|Neutral|Buy|Sell|Hold|Reduce)`;
const QUOTE = String.raw`['‘’"“”]?`;
const RATING_CHANGE = new RegExp(String.raw`${RATING_TOKEN}${QUOTE}(?:\s*\([^)]{0,20}\))?${QUOTE}\s*(?:에서|→)\s*${QUOTE}${RATING_TOKEN}${QUOTE}(?:\s*\([^)]{0,20}\))?${QUOTE}\s*(?:으로|로)?\s*(상향|하향)|${RATING_TOKEN}${QUOTE}\s*(?:으로|로)\s*(상향|하향)|\b(upgrade[sd]?|downgrade[sd]?)\b`, 'i');

const BROKERS = [
  ['JP Morgan', /JP\s*모건|JPMorgan|J\.?P\.?\s*Morgan|\bJPM\b/i], ['Goldman Sachs', /골드만\s*삭스|Goldman/i],
  ['Morgan Stanley', /모건\s*스탠리|Morgan Stanley/i], ['BofA', /BofA|뱅크\s*오브\s*아메리카|Bank of America|BoA\b/i],
  ['Citi', /\bCiti(?:group)?\b|씨티|(?<!시티즌)시티(?!즌)/i], ['UBS', /\bUBS\b/], ['Jefferies', /제프리스|Jefferies/i],
  ['Barclays', /바클레이즈|Barclays/i], ['Deutsche Bank', /도이치|Deutsche/i], ['Wells Fargo', /웰스\s*파고|Wells Fargo/i],
  ['Bernstein', /번스타인|Bernstein/i], ['Evercore', /에버코어|Evercore/i], ['Rosenblatt', /로젠블랫|Rosenblatt/i],
  ['Cantor Fitzgerald', /캔터|Cantor/i], ['Oppenheimer', /오펜하이머|Oppenheimer/i], ['BMO', /\bBMO\b/],
  ['RBC', /\bRBC\b/], ['Mizuho', /미즈호|Mizuho/i], ['Needham', /니덤|Needham/i], ['KeyBanc', /키뱅크|KeyBanc/i],
  ['Piper Sandler', /파이퍼|Piper/i], ['Raymond James', /레이먼드|Raymond James/i], ['Truist', /트루이스트|Truist/i],
  ['TD Cowen', /TD\s*Cowen|코웬/i], ['Wedbush', /웨드부시|Wedbush/i], ['Citizens', /시티즌스|Citizens/i],
  ['Stifel', /스티펠|Stifel/i], ['Baird', /베어드|Baird/i], ['HSBC', /\bHSBC\b/], ['Macquarie', /맥쿼리|Macquarie/i],
  ['Nomura', /노무라|Nomura/i], ['Daiwa', /다이와|Daiwa/i], ['CLSA', /\bCLSA\b/], ['Loop Capital', /Loop Capital|루프\s*캐피털/i],
  ['Melius', /멜리우스|Melius/i], ['Susquehanna', /서스퀘하나|Susquehanna/i], ['Guggenheim', /구겐하임|Guggenheim/i]
];
const KR_BROKER = /([가-힣A-Za-z]{1,8}(?:투자)?증권)/;

const CURRENCY_UNIT = String.raw`(?:달러|유로|엔|위안|원|USD|EUR|JPY)`;
// 78,000원 · 5.5만원 · 9만4400원 · 6만 원 · 300만원 · $310 · 1,200달러 · 275유로 · 77,000(으로)
const PRICE = new RegExp(String.raw`\$\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?만\s?(\d{1,4})?\s?원|(\d[\d,]*(?:\.\d+)?)\s?(${CURRENCY_UNIT})|(\d{1,3}(?:,\d{3})+|\d{4,})(?=\s*(?:으로|로)\s)`, 'g');
const TARGET_WORD = /목표\s*주가|목표가|\bTP\b|price target|\bPT\b/i;

const num = (text) => {
  const value = Number(String(text).replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
};
const CURRENCY_OF = { 달러: 'USD', USD: 'USD', 유로: 'EUR', EUR: 'EUR', 엔: 'JPY', JPY: 'JPY', 위안: 'CNY', 원: 'KRW' };

/** Prices in reading order: { value, currency, index, end }. */
export function readPrices(text) {
  const out = [];
  for (const m of String(text || '').matchAll(PRICE)) {
    let value = null;
    let currency = null;
    if (m[1] != null) { value = num(m[1]); currency = 'USD'; }
    else if (m[2] != null) { value = num(m[2]) * 10000 + (m[3] ? Number(m[3]) : 0); currency = 'KRW'; }
    else if (m[4] != null) { value = num(m[4]); currency = CURRENCY_OF[m[5]] || null; }
    else if (m[6] != null) { value = num(m[6]); currency = null; }
    if (value != null && value > 0) out.push({ value, currency, index: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** A lookup over the screener universe: symbols (upper case) and Korean six-digit codes. */
export function buildUniverseIndex(rows = []) {
  const symbols = new Set();
  const krByCode = new Map();
  const krByName = new Map();
  const usByName = new Map();
  for (const row of rows) {
    const sym = String(row?.sym || '').toUpperCase();
    if (!sym) continue;
    symbols.add(sym);
    const code = sym.match(/^(\d{6})\.K[SQ]$/)?.[1];
    if (code) { krByCode.set(code, sym); if (row.name) krByName.set(String(row.name), sym); }
    else if (row.name) usByName.set(String(row.name), sym);
  }
  return { symbols, krByCode, krByName, usByName };
}

/** Tickers the text itself writes, confirmed against the universe (the $ form is explicit enough on its own). */
export function writtenTickers(text, universe) {
  const raw = String(text || '');
  const out = [];
  const add = (sym) => { if (sym && !out.includes(sym)) out.push(sym); };
  for (const m of raw.matchAll(/\$\s?([A-Z]{1,5}(?:\.[A-Z])?)\b/g)) add(m[1]);
  for (const m of raw.matchAll(/(?:NASDAQ|NYSE|나스닥|뉴욕증권거래소)\s*:\s*([A-Z]{1,5})\b/g)) add(m[1]);
  // Two letters at least: "(E)" marks an estimate year far more often than it names Eni.
  for (const m of raw.matchAll(/[(（]\s*([A-Z]{2,5})\s*[)）]/g)) if (universe?.symbols?.has(m[1])) add(m[1]);
  for (const m of raw.matchAll(/(?<!\d)(\d{6})(?:\.(KS|KQ)|\s*\/\s*(KS|KQ|KOSPI|KOSDAQ)|(?=\]))/g)) {
    const known = universe?.krByCode?.get(m[1]);
    const suffix = m[2] || (m[3] ? (/KQ|KOSDAQ/.test(m[3]) ? 'KQ' : 'KS') : null);
    add(known || (suffix ? `${m[1]}.${suffix}` : null));
  }
  return out;
}

// A title line that writes no ticker may still open with a company the curated table (telegram-tickers.mjs) or the
// Korean universe knows by its exact name ("▶️ 삼성E&A: …", "261020_SK Hynix 3Q26 Preview"). Only the subject
// position counts: '"비나텍, 블룸에너지발 수주 확대"' names Bloom Energy as the customer, not the company rated.
function namedTicker(text, universe) {
  const head = String(text || '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/^\d{6}_/, '')
    .replace(/^[^)\]"“]{1,24}[)\]]\s*/, '').replace(/^[^\p{L}\p{N}]+/u, '');
  // "미즈호, 알파벳 투자의견 …": a leading broker name is the source, the company follows it.
  const parts = head.split(/[,:;：·…(\[]/);
  const subject = parts.length > 1 && parts[0].length <= 16 && brokerOf(parts[0]) ? parts[1] : parts[0];
  const found = matchTickers(subject).filter((sym) => universe?.symbols?.has(sym));
  // The name must end where a word ends (a Korean particle may follow): "삼성E&A:", "IBM 2026년", "삼성전자는".
  const startsWithName = (name) => name.length >= 3 && head.startsWith(name) && !/^[\p{L}\p{N}&]/u.test(head.slice(name.length).replace(/^[은는이가의와과를을도에]/, ''));
  for (const [name, sym] of [...(universe?.krByName || []), ...(universe?.usByName || [])]) {
    if (startsWithName(name) && !found.includes(sym)) found.push(sym);
  }
  return found.length === 1 ? found[0] : null;
}

function brokerOf(text) {
  for (const [name, re] of BROKERS) if (re.test(text)) return name;
  return String(text || '').match(KR_BROKER)?.[1] || null;
}

// Premarket mover lists write one stock per block: "CRWV (+6.71%)" then the reason on the next line.
const MOVER_LINE = /^([A-Z]{1,5}(?:\.[A-Z])?)\s*\(([+-]?\d+(?:\.\d+)?)%\)$/;
const moverTicker = (line, universe) => {
  const sym = line.match(MOVER_LINE)?.[1];
  return sym && universe?.symbols?.has(sym) ? sym : null;
};
// After a change ("'시장수익률'에서 '시장수익률 상회'로 상향") the rating is the one it moved to; otherwise the words next to
// 투자의견, then next to 의견/등급, then the whole line.
const ratingOf = (text) => {
  const raw = String(text || '');
  const change = raw.match(RATING_CHANGE)?.[0];
  const candidates = [change ? change.split(/에서|→/).pop() : null, raw.match(/투자\s*의견[^,.;\n]{0,40}/)?.[0],
    raw.match(/[^,.;\n]{0,24}(?:의견|등급)[^,.;\n]{0,20}/)?.[0], raw];
  for (const scoped of candidates.filter(Boolean)) {
    for (const [rating, re] of RATING_WORDS) if (re.test(scoped)) return rating;
  }
  return null;
};

function targetChange(segment) {
  const at = segment.search(TARGET_WORD);
  if (at < 0) return null;
  const tail = segment.slice(at);
  const prices = readPrices(tail).filter((p) => !/^\s*(?:상향|하향)한/.test(tail.slice(p.end, p.end + 6)));
  if (!prices.length) return null;
  let from = null;
  let to = null;
  const first = prices[0];
  const second = prices[1];
  const between = second ? tail.slice(first.end, second.index) : '';
  const afterSecond = second ? tail.slice(second.end, second.end + 6) : '';
  if (second && /^\s*(?:에서|→|->|~?\s*to)\s*$/i.test(between)) { from = first; to = second; }
  else if (second && /^\s*\(?\s*(?:기존|종전|from)\s*$/i.test(between) && /^\s*\)?/.test(afterSecond)) { to = first; from = second; }
  else to = first;
  if (first.index > 40) return null;
  const currency = to.currency || from?.currency || null;
  const after = tail.slice(to.end, to.end + 24);
  let direction = 'set';
  if (from && to.value > from.value) direction = 'raise';
  else if (from && to.value < from.value) direction = 'cut';
  else if (from && to.value === from.value) direction = 'hold';
  else if (/^[^.\n]{0,12}(?:상향|올렸|높였|raise)/i.test(after)) direction = 'raise';
  else if (/^[^.\n]{0,12}(?:하향|낮췄|내렸|cut|lower)/i.test(after)) direction = 'cut';
  else if (/^[^.\n]{0,12}(?:유지|재확인|reiterat|maintain)/i.test(after)) direction = 'hold';
  else if (/개시|initiat|신규\s*커버/i.test(segment)) direction = 'initiate';
  return { ptFrom: from ? from.value : null, ptTo: to.value, currency, direction };
}

/**
 * Analyst target-price and rating actions. Each line (or bullet) is read alone; a line without a written ticker takes
 * the ticker of the post's title line or of the nearest preceding title in a list post ("<삼성E&A[028050] …>").
 */
export function extractAnalystActions(text, { universe, date, postId } = {}) {
  const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const out = [];
  const seen = new Set();
  let context = null;
  let contextBroker = null;
  lines.forEach((line, index) => {
    const own = writtenTickers(line, universe);
    // Title lines: the post's first line, each "<종목[코드] 제목>" heading of a list post and each mover line set the context.
    if (MOVER_LINE.test(line)) { context = moverTicker(line, universe); return; }
    if (index === 0 || /^[<【▶►]/.test(line)) {
      context = own.length === 1 ? own[0] : own.length === 0 ? namedTicker(line, universe) : null;
      contextBroker = brokerOf(line) || (index === 0 ? null : contextBroker);
    } else if (line.length <= 30 && !TARGET_WORD.test(line) && brokerOf(line)) contextBroker = brokerOf(line); // "iM증권 배세호"
    if (!TARGET_WORD.test(line)) return;
    const ticker = own.length === 1 ? own[0] : own.length === 0 ? context : null;
    if (!ticker) return;
    const change = targetChange(line);
    if (!change) return;
    const currency = change.currency || (/\.K[SQ]$/.test(ticker) ? 'KRW' : null);
    if (!currency) return;
    const ratingChange = line.match(RATING_CHANGE);
    const ratingAction = ratingChange ? (/상향|upgrade/i.test(ratingChange[0]) ? 'upgrade' : 'downgrade') : null;
    const broker = brokerOf(line) || contextBroker;
    const key = `pt|${ticker}|${broker || '-'}|${date || ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind: 'pt', key, ticker, broker, ...change, currency, rating: ratingOf(line), ratingAction, date: date || null, post: postId || null });
  });
  return out;
}

const VERDICT = { 상회: 'beat', 하회: 'miss', 부합: 'inline', 웃돌: 'beat', 밑돌: 'miss' };
const verdictOf = (text) => {
  const m = String(text || '').match(/상회|하회|부합|웃돌|밑돌/);
  return m ? VERDICT[m[0]] : null;
};
function lineMetric(lines, label) {
  const line = lines.find((l) => label.test(l) && /예상|컨센서스|추정/.test(l));
  if (!line) return null;
  const est = line.match(/(?:예상|컨센서스|추정)(?:치)?\s*:?\s*([^)·,]*?)\s*(상회|하회|부합)/);
  const verdict = verdictOf(est ? est[2] : line);
  return verdict ? { verdict } : null;
}

/** A mover line's reason ("EPS 예상치를 $0.07 상회했으나 매출은 예상치 하회.") read as a reported quarter. */
function moverEarnings(lines, { universe, date, postId }) {
  const out = [];
  lines.forEach((line, index) => {
    const ticker = moverTicker(line, universe);
    const reason = ticker ? lines[index + 1] || '' : '';
    if (!ticker || !/예상치|컨센서스/.test(reason)) return;
    // A decimal point ("$0.07") is not the end of the clause.
    const eps = reason.match(/EPS(?:[^,.]|\.\d)*?(상회|하회|부합)/)?.[1];
    const revenue = reason.match(/매출(?:[^,.]|\.\d)*?(상회|하회|부합)/)?.[1];
    if (!eps && !revenue) return;
    const guidance = /(?:가이던스|전망)[^.]{0,12}상향/.test(reason) ? 'raise' : /(?:가이던스|전망)[^.]{0,12}하향/.test(reason) ? 'cut' : null;
    out.push({ kind: 'earnings', key: `earnings|${ticker}|${date || ''}`, ticker, name: null, quarter: null, revenue: revenue ? VERDICT[revenue] : null, eps: eps ? VERDICT[eps] : null, guidance, date: date || null, post: postId || null });
  });
  return out;
}

/**
 * Reported quarters: "<회사>(TICK) … 실적 발표" with "매출 … (예상 … 상회)" and "EPS … (예상 … 하회)" lines. Previews
 * ("~할 것으로 예상합니다", "프리뷰") are not results and are skipped.
 */
export function extractEarnings(text, { universe, date, postId } = {}) {
  const raw = String(text || '');
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const title = lines[0] || '';
  const movers = moverEarnings(lines, { universe, date, postId });
  if (movers.length) return movers;
  if (!/실적\s*(?:발표|공개)?|results|reported/i.test(title) || /프리뷰|preview|예정|앞두고/i.test(title)) return [];
  const revenue = lineMetric(lines, /^[•ㆍ\-*\s]*(?:총\s*)?(?:매출(?:액)?|revenue|sales)(?:\s*[:：]|\s+\$?\d)/i);
  const eps = lineMetric(lines, /^[•ㆍ\-*\s]*(?:조정|희석|non-gaap|adjusted)?\s*(?:주당\s*순이익|EPS)/i);
  if (!revenue && !eps) return [];
  const written = writtenTickers(title, universe);
  const tickers = written.length ? written : [namedTicker(title, universe)].filter(Boolean);
  // "에르메스의 2026년 …": the possessive after the name is not part of it (only 의 — 스포티파이 ends in 이).
  const name = title.replace(/[(（][^)）]*[)）]/g, '').split(/,|\s+\d{4}년|\s+[1-4]분기|\s+실적/)[0].trim().slice(0, 40)
    .replace(/(?<=[가-힣]{2})의$/, '') || null;
  const guidance = /가이던스[^.\n]{0,12}(?:상향|높)/.test(raw) ? 'raise' : /가이던스[^.\n]{0,12}(?:하향|낮)/.test(raw) ? 'cut' : null;
  const period = title.match(/(\d{4})년\s*([1-4])분기|([1-4])Q\s?(\d{2})|F([1-4])Q(\d{2})/);
  const quarter = period ? (period[1] ? `${period[1]}Q${period[2]}` : period[3] ? `20${period[4]}Q${period[3]}` : `FY${period[6]}Q${period[5]}`) : null;
  const ticker = tickers.length === 1 ? tickers[0] : null;
  return [{ kind: 'earnings', key: `earnings|${ticker || name}|${date || quarter || ''}`, ticker, name, quarter, revenue: revenue?.verdict || null, eps: eps?.verdict || null, guidance, date: date || null, post: postId || null }];
}

const RELEASE_VALUE = String.raw`(-?[\d,]*\.?\d+)\s*(%|건|K|M|B|만|억|bp)?`;
/** Economic releases written as 실제치/예상치/이전치 (Actual/Forecast/Previous). */
export function extractMacroReleases(text, { date, postId } = {}) {
  const raw = String(text || '');
  const out = [];
  const re = new RegExp(String.raw`([^\n]{2,60})\n(?:\(([^)\n]{2,60})\)\n)?[ㆍ•\-*\s]*실제치(?:\s*\(Actual\))?\s*[:：]\s*${RELEASE_VALUE}[^\n]*\n[ㆍ•\-*\s]*예상치(?:\s*\(Forecast\))?\s*[:：]\s*${RELEASE_VALUE}[^\n]*(?:\n[ㆍ•\-*\s]*이전치(?:\s*\(Previous\))?\s*[:：]\s*${RELEASE_VALUE})?`, 'g');
  for (const m of raw.matchAll(re)) {
    const name = m[1].replace(/[^\p{L}\p{N}\s()%·/.-]/gu, '').trim();
    const actual = num(m[3]);
    const forecast = num(m[5]);
    if (!name || actual == null || forecast == null) continue;
    const previous = m[7] != null ? num(m[7]) : null;
    const unit = m[4] || m[6] || null;
    out.push({ kind: 'macro', key: `macro|${(m[2] || name).trim()}|${date || ''}`, name, nameEn: m[2]?.trim() || null, actual, forecast, previous, unit, surprise: Number((actual - forecast).toFixed(4)), date: date || null, post: postId || null });
  }
  return out;
}

const LEVERAGED_LONG = /\b(?:BULL|ULTRA(?!SHORT)|ULTRAPRO(?!\s*SHORT)|[23]X(?!.*\bBEAR\b)|LEVERAGED|DAILY\b.*\bBULL)\b/i;
const INVERSE = /\b(?:BEAR|ULTRASHORT|SHORT|INVERSE)\b/i;
/** "YYYY년 M월 D일 서학개미 순매수 미국 주식 TOP 50" — ranks, names and shares; no ticker is inferred from a name. */
export function extractRetailFlows(text, { postId } = {}) {
  const raw = String(text || '');
  const head = raw.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*서학개미\s*(순매수|순매도)/);
  if (!head) return [];
  const rows = [];
  for (const m of raw.matchAll(/(\d{1,2})위\s*[:：]\s*([^\n(]+?)\s*\((-?\d+(?:\.\d+)?)%\)/g)) {
    const name = m[2].replace(/\s+(?:SPLR|SOFF|CHAN)\s+\d+\s+US[0-9A-Z]{10}$/, '').trim();
    rows.push({ rank: Number(m[1]), name, share: Number(m[3]), leveraged: LEVERAGED_LONG.test(name) && !INVERSE.test(name), inverse: INVERSE.test(name) });
  }
  if (!rows.length) return [];
  const sessionDate = `${head[1]}-${head[2].padStart(2, '0')}-${head[3].padStart(2, '0')}`;
  const share = (pick) => Number(rows.filter(pick).reduce((sum, row) => sum + row.share, 0).toFixed(2));
  return [{ kind: 'retail', key: `retail|${head[4]}|${sessionDate}`, side: head[4] === '순매수' ? 'buy' : 'sell', date: sessionDate, top: rows.slice(0, 10), leveragedLongShare: share((row) => row.leveraged), inverseShare: share((row) => row.inverse), top10Share: share((row) => row.rank <= 10), post: postId || null }];
}

/** Every signal one post carries. */
export function extractPostSignals(post, universe) {
  const text = String(post?.text || '');
  if (!text) return [];
  const meta = { universe, date: post.localDateKst || String(post.datetime || '').slice(0, 10) || null, postId: post.id || null };
  return [...extractAnalystActions(text, meta), ...extractEarnings(text, meta), ...extractMacroReleases(text, meta), ...extractRetailFlows(text, meta)];
}

/** true when a post carries numbers worth keeping in the reading lists (selection floor, not a rank). */
export function isDataPost(signals) {
  return Array.isArray(signals) && signals.length > 0;
}

/**
 * New signals win over carried ones with the same key; signals older than the window are dropped. Each kind keeps a
 * bounded count, newest first, so the digest cannot grow without limit.
 */
export const SIGNAL_LIMITS = Object.freeze({ pt: 240, earnings: 120, macro: 60, retail: 10 });
export function mergeSignals(previous = [], fresh = [], { sinceDate } = {}) {
  const byKey = new Map();
  for (const signal of [...(Array.isArray(previous) ? previous : []), ...fresh]) {
    if (!signal?.key || !SIGNAL_LIMITS[signal.kind]) continue;
    if (sinceDate && String(signal.date || '') < sinceDate) continue;
    byKey.set(signal.key, signal);
  }
  // One report relayed on two days or by two channels ("JP모건 SPCX $240 → $500" on 10/21 and 10/22) is one action:
  // the same ticker, broker and prices keep the first date. Without this a tally counted it as two brokers.
  const firstSeen = new Map();
  for (const signal of [...byKey.values()].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))) {
    if (signal.kind !== 'pt') continue;
    const same = `${signal.ticker}|${signal.broker || '-'}|${signal.ptFrom ?? '-'}|${signal.ptTo}|${signal.currency}`;
    if (firstSeen.has(same)) byKey.delete(signal.key);
    else firstSeen.set(same, signal.key);
  }
  const out = [];
  for (const kind of Object.keys(SIGNAL_LIMITS)) {
    out.push(...[...byKey.values()].filter((signal) => signal.kind === kind)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, SIGNAL_LIMITS[kind]));
  }
  return out;
}
