// Owner 2026-10-25: the 맞춤 profile also learns from use — screens opened, the topics of completed questions, and the
// tickers and themes the app itself resolved — only after the reader turns it on, only on this device.
// What is stored is counts, never question text. Counts fade with a two-week half-life, so a changed interest moves the
// summary. The summary fills only fields the reader has not set (src/ai/session/user-profile.js: a chosen setting
// always wins), and like the profile it adapts explanation only (R724): no pick, size, timing or suitability verdict.
export const LEARN_KEY = 'aio_ai_learned_v1';
export const LEARN_CONSENT_KEY = 'aio_ai_learn_enabled'; // '1' on · missing/'0' off
export const LEARN_SCHEMA = 'aio-ai-learned.v1';
export const HALF_LIFE_DAYS = 14;
export const LIMITS = Object.freeze({ perBucket: 24, tickers: 5, themes: 5, minQuestionsForLevel: 5, minWeightForLens: 2 });

const DAY = 86400000;
const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };

// A screen counts toward the lens it is built around; the market-state screens name no single lens.
export const SCREEN_LENS = Object.freeze({
  technical: 'chart', ticker: 'chart', fundamental: 'fundamental', screener: 'fundamental', 'market-news': 'news',
  themes: 'theme', 'theme-detail': 'theme', atlas: 'theme', macro: 'macro', fxbond: 'macro', briefing: 'macro', portfolio: 'portfolio'
});
// Question topics: whole words a question about that lens uses. A question can count toward several lenses.
const TOPIC_RULES = Object.freeze([
  ['chart', /차트|이동평균|이평|RSI|MACD|지지선|저항선|추세|돌파|거래량|캔들|눌림|패턴/i],
  ['fundamental', /PER|PBR|EPS|ROE|매출|영업이익|순이익|이익률|현금흐름|밸류에이션|재무|실적|가이던스|부채/i],
  ['news', /뉴스|기사|보도|발표했|헤드라인|이벤트|일정/],
  ['theme', /테마|산업|업종|섹터|공급망|밸류체인|반도체|전력|데이터센터/],
  ['macro', /금리|CPI|PCE|물가|환율|달러|연준|FOMC|국채|고용|경기|한국은행|유가/i],
  ['portfolio', /포트폴리오|분산|리밸런싱|낙폭|변동성|상관|헤지|자산배분/]
]);
// A definition question ("PER이 뭐야?", "~란?") is a sign the reader wants terms explained; nothing infers expertise.
const DEFINITION_QUESTION = /(?:뭐야|뭔가요|뭐예요|무엇인가요|무슨\s*뜻|뜻이\s*뭐|란\s*\?|이란\s*\?|개념|쉽게\s*설명)/;
const TICKER = /^[A-Z][A-Z0-9.\-]{0,9}$|^\d{6}$/;
const THEME = /^[a-z0-9][a-z0-9_-]{1,40}$/;

export function learningEnabled(storage) { return safe(() => storage.getItem(LEARN_CONSENT_KEY), null) === '1'; }
export function setLearning(storage, on) {
  safe(() => storage.setItem(LEARN_CONSENT_KEY, on ? '1' : '0'));
  if (!on) safe(() => storage.removeItem(LEARN_KEY));
}
export function clearLearned(storage) { safe(() => storage.removeItem(LEARN_KEY)); }

const empty = () => ({ schemaVersion: LEARN_SCHEMA, since: null, lenses: {}, screens: {}, tickers: {}, themes: {}, labels: {}, questions: { total: 0, definition: 0, at: null } });
export function loadLearned(storage) {
  const raw = safe(() => JSON.parse(storage.getItem(LEARN_KEY) || 'null'), null);
  if (!raw || raw.schemaVersion !== LEARN_SCHEMA) return empty();
  const base = empty();
  for (const bucket of ['lenses', 'screens', 'tickers', 'themes', 'labels']) base[bucket] = raw[bucket] && typeof raw[bucket] === 'object' ? raw[bucket] : {};
  base.since = Number.isFinite(raw.since) ? raw.since : null;
  base.questions = { ...base.questions, ...(raw.questions || {}) };
  return base;
}

// A stored weight decays from the time it was last touched; adding brings it to now first.
const faded = (row, now) => (row && Number.isFinite(row.w) && Number.isFinite(row.t) ? row.w * 0.5 ** (Math.max(0, now - row.t) / (HALF_LIFE_DAYS * DAY)) : 0);
function bump(bucket, key, now, by = 1) {
  bucket[key] = { w: faded(bucket[key], now) + by, t: now };
  const keys = Object.keys(bucket);
  if (keys.length > LIMITS.perBucket) {
    keys.sort((a, b) => faded(bucket[a], now) - faded(bucket[b], now)).slice(0, keys.length - LIMITS.perBucket).forEach((k) => delete bucket[k]);
  }
}
function save(storage, learned) { safe(() => storage.setItem(LEARN_KEY, JSON.stringify(learned))); return learned; }

/** Records one event when learning is on; otherwise stores nothing. kind: 'screen' | 'question' | 'ticker' | 'theme'. */
export function recordUsage(storage, event, now = Date.now()) {
  if (!learningEnabled(storage) || !event) return null;
  const learned = loadLearned(storage);
  if (!learned.since) learned.since = now;
  if (event.kind === 'screen' && typeof event.route === 'string') {
    bump(learned.screens, event.route, now);
    if (SCREEN_LENS[event.route]) bump(learned.lenses, SCREEN_LENS[event.route], now, 0.5);
  } else if (event.kind === 'question') {
    const text = String(event.text || '');
    for (const [lens, rule] of TOPIC_RULES) if (rule.test(text)) bump(learned.lenses, lens, now);
    const q = learned.questions;
    // The definition share fades with the questions it counts, so it follows recent questions.
    const keep = q.at ? 0.5 ** (Math.max(0, now - q.at) / (HALF_LIFE_DAYS * DAY)) : 1;
    q.total = q.total * keep + 1;
    q.definition = q.definition * keep + (DEFINITION_QUESTION.test(text) ? 1 : 0);
    q.at = now;
  } else if (event.kind === 'ticker' && TICKER.test(String(event.id || ''))) {
    bump(learned.tickers, String(event.id), now);
  } else if (event.kind === 'theme' && THEME.test(String(event.id || ''))) {
    bump(learned.themes, String(event.id), now);
    const label = String(event.label || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 30);
    if (label) learned.labels[String(event.id)] = label;
    for (const id of Object.keys(learned.labels)) if (!learned.themes[id]) delete learned.labels[id];
  } else {
    return null;
  }
  return save(storage, learned);
}

const top = (bucket, n, now, min = 0) => Object.keys(bucket || {})
  .map((key) => [key, faded(bucket[key], now)]).filter(([, w]) => w >= min)
  .sort((a, b) => b[1] - a[1]).slice(0, n);

/** What the panel shows and what the AI receives: the leading lenses, a definition-question signal, tickers, themes. */
export function summarizeLearned(learned, now = Date.now()) {
  const l = learned || empty();
  const lenses = top(l.lenses, 3, now, LIMITS.minWeightForLens).map(([id]) => id);
  const q = l.questions || {};
  const keep = q.at ? 0.5 ** (Math.max(0, now - q.at) / (HALF_LIFE_DAYS * DAY)) : 0;
  const total = (q.total || 0) * keep, definition = (q.definition || 0) * keep;
  const definitionShare = total >= LIMITS.minQuestionsForLevel ? definition / total : null;
  const themes = top(l.themes, LIMITS.themes, now, 0.5).map(([id]) => id);
  return {
    lenses,
    screens: top(l.screens, 3, now, 0.5).map(([id]) => id),
    tickers: top(l.tickers, LIMITS.tickers, now, 0.5).map(([id]) => id),
    themes,
    themeLabels: themes.map((id) => (l.labels || {})[id] || id),
    questions: Math.round(total),
    definitionShare,
    since: l.since,
    empty: !lenses.length && !Object.keys(l.screens || {}).length && !Object.keys(l.tickers || {}).length && !Object.keys(l.themes || {}).length && !total
  };
}
