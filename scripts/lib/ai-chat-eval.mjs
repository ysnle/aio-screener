// scripts/lib/ai-chat-eval.mjs — v60.41: the AI chat question set (architecture/ai-chat-question-set.json), its figure and
// screen resolvers, and the scoring of one answer. Shared by scripts/ai-chat-eval.mjs (asks the real chat in a browser)
// and scripts/ci-ai-chat-question-set-check.mjs (validates the set against the committed data, no model call).
//
// Figures are never written into the set: each one names a resolver that reads the app's own published data at run time
// (the run reads the files the page it asks is served with), because the data changes every session.
// Screens (rowsFromScreen) are evaluated with the screener's own condition code (custom-conditions.js) and size rule
// (capFilterValue) over public-data/screener.json rows (data[symbol] merged over rowDefaults) and the universe identity.
import vm from 'node:vm';
import { readHistoryRows } from '../../src/domain/market/indices/history-rows.js';
import { buildCloseSeries } from '../../src/domain/market/session/close-series.js';
import { CUSTOM_CONDITIONS, availableConditionIds, matchesConditions, normalizeConditions } from '../../src/domain/screener/custom-conditions.js';
import { stampDay } from '../../src/domain/shared/session-date.js';
import { capFilterValue } from '../../src/domain/screener/row-presentation.js';
import { screenerMarket } from '../../src/domain/screener/market-scope.js';
import { expandShardRows } from '../../src/data/screener-extended.js';
import { referenceMarketCapFrom } from '../../src/data/providers/screener.js';

export const SET_PATH = 'architecture/ai-chat-question-set.json';
export const SET_SCHEMA = 'aio-ai-chat-question-set.v1';
export const REPORT_SCHEMA = 'aio-ai-chat-eval-report.v1';
export const TASK_IDS = Object.freeze(['market-state', 'money-flow', 'screen', 'company', 'holdings']);
// The situations the owner listed; each needs at least two questions.
export const REQUIRED_SITUATIONS = Object.freeze([
  'closed-market', 'intraday', 'korea', 'etf', 'out-of-universe', 'korean-name', 'compare', 'follow-up', 'vague', 'definition',
  'on-screen-number', 'macro-release', 'web-cause', 'earnings', 'dividend', 'valuation', 'technical', 'scenario-history',
  'buy-sell', 'portfolio-no-consent', 'off-topic', 'false-premise', 'table', 'very-short', 'very-long', 'typo-ticker'
]);
export const EXPECTS = Object.freeze(['answer', 'conditional-guidance', 'consent-prompt', 'polite-decline']);
export const WHEN = Object.freeze(['any', 'us-open', 'us-closed']);
export const CHECK_KEYS = Object.freeze(['mustNotContain', 'figures', 'mustMention', 'rowsFromScreen', 'maxSeconds', 'format', 'minLinks']);
export const QUESTION_MAX_CHARS = 1000; // #ai-panel-inp maxlength (index.html)
export const MIN_PER_TAG = 2;
// Conditions whose fields the screener artifact does not carry (consensus file, SEC cash file, channel signals).
const ARTIFACT_FIELDS_ONLY = (template) => !template.source && !template.id.startsWith('tg-') && !template.fields.includes('fwdPe');
export const SCREEN_CONDITION_IDS = Object.freeze(CUSTOM_CONDITIONS.filter(ARTIFACT_FIELDS_ONLY).map((item) => item.id));
const SIZE_BUCKETS = Object.freeze(['MEGA', 'LARGE', 'MID', 'SMALL']);

// ── data ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// loader(path) returns the text of a repo-relative path (public-data/…, js/aio-pages.js, js/aio-kr-data.js).
export const DATA_FILES = Object.freeze(['public-data/history.json', 'public-data/screener.json', 'public-data/screener-universe.json',
  'public-data/data.json', 'js/aio-pages.js', 'js/aio-kr-data.js']);

// The literal assigned to `name` (THEME_MAP = [...], KR_THEME_MAP = {...}) in the checkout source or the minified Pages
// bundle: find the assignment, scan to the matching bracket (strings skipped), evaluate the literal alone.
function literal(source, name) {
  const head = new RegExp(`(?<![A-Za-z0-9_$])${name}\\s*=\\s*([\\[{])`).exec(source);
  if (!head) return null;
  const start = head.index + head[0].length - 1;
  let depth = 0;
  let quote = null;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) { if (ch === '\\') i += 1; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '/' && source[i + 1] === '/') i = source.indexOf('\n', i) < 0 ? source.length : source.indexOf('\n', i);
    else if (ch === '/' && source[i + 1] === '*') i = source.indexOf('*/', i + 2) < 0 ? source.length : source.indexOf('*/', i + 2) + 1;
    else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try { return vm.runInNewContext(`(${source.slice(start, i + 1)})`, {}, { timeout: 1000 }); } catch { return null; }
      }
    }
  }
  return null;
}

export async function loadEvalData(loader) {
  const json = async (file) => JSON.parse(await loader(file));
  const [historyRaw, screener, universe, data, pagesJs, krJs] = await Promise.all([
    json(DATA_FILES[0]), json(DATA_FILES[1]), json(DATA_FILES[2]), json(DATA_FILES[3]), loader(DATA_FILES[4]), loader(DATA_FILES[5])
  ]);
  const identity = new Map((universe.universe || []).map((row) => [row.sym, row]));
  const expanded = expandShardRows(screener);
  const rows = Object.entries(expanded).map(([sym, row]) => {
    const merged = { ...(identity.get(sym) || {}), ...row, sym };
    merged.referenceMarketCap = referenceMarketCapFrom(merged, merged.currency);
    return merged;
  });
  const usThemes = literal(pagesJs, 'THEME_MAP') || [];
  const krThemeMap = literal(krJs, 'KR_THEME_MAP') || {};
  return {
    history: readHistoryRows(historyRaw), rows, rowBySym: new Map(rows.map((row) => [row.sym, row])), identity,
    data, usThemes, krThemeMap, screenerAsOf: screener.asOf || null
  };
}

// ── figure resolvers ──────────────────────────────────────────────────────────────────────────────────────────────────
// Each returns { value, kind: 'number'|'date', basis } or throws with the reason it cannot resolve.
const lastTwo = (data, field) => {
  const series = buildCloseSeries(data.history, field);
  if (series.length < 2) throw new Error(`history ${field}: fewer than two completed sessions`);
  return series.slice(-2);
};
const pathValue = (root, path) => path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), root);

export const RESOLVERS = Object.freeze({
  'history.close': (data, field) => { const [, last] = lastTwo(data, field); return { value: last.value, kind: 'number', basis: `${field} close ${last.date}` }; },
  'history.dayChangePct': (data, field) => {
    const [prev, last] = lastTwo(data, field);
    return { value: Math.round(((last.value / prev.value) - 1) * 10000) / 100, kind: 'number', basis: `${field} ${prev.date}→${last.date}` };
  },
  'screener.field': (data, arg) => {
    const match = arg.match(/^([A-Z0-9-]+(?:\.K[SQ])?)\.([A-Za-z0-9]+)$/);
    if (!match) throw new Error(`screener.field needs SYMBOL.key, got ${arg}`);
    const row = data.rowBySym.get(match[1]);
    if (!row) throw new Error(`screener row ${match[1]} missing`);
    const value = row[match[2]];
    if (stampDay(value)) return { value: stampDay(value), kind: 'date', basis: `screener ${match[1]}.${match[2]}` };
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`screener ${match[1]}.${match[2]} is not a number (${JSON.stringify(value)})`);
    return { value, kind: 'number', basis: `screener ${match[1]}.${match[2]} (${row.factorSessionDate || data.screenerAsOf || 'artifact'})` };
  },
  'data.path': (data, path) => {
    const value = pathValue(data.data, path);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`data.json ${path} is not a number (${JSON.stringify(value)})`);
    return { value, kind: 'number', basis: `data.json ${path}` };
  }
});

export function parseResolver(spec) {
  const match = String(spec || '').match(/^([a-zA-Z]+\.[a-zA-Z]+):(.+)$/);
  if (!match || !RESOLVERS[match[1]]) return null;
  return { name: match[1], arg: match[2] };
}

export function resolveFigure(figure, data) {
  const parsed = parseResolver(figure.resolver);
  if (!parsed) throw new Error(`unknown resolver ${figure.resolver}`);
  return RESOLVERS[parsed.name](data, parsed.arg);
}

// ── screens ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const plainRead = (row, key) => row?.[key];
function sizeOf(row) {
  const cap = capFilterValue(row);
  if (cap == null) return null;
  return cap >= 1000 ? 'MEGA' : cap >= 10 ? 'LARGE' : cap >= 2 ? 'MID' : 'SMALL'; // src/ui/pages/screener/filters.js buckets
}
function themeMembers(data, theme) {
  if (theme.startsWith('kr:')) {
    const list = data.krThemeMap[theme.slice(3)];
    if (!Array.isArray(list)) return null;
    const codes = new Set(list.map((item) => item.code));
    return new Set(data.rows.filter((row) => codes.has(String(row.sym).replace(/\.K[SQ]$/, ''))).map((row) => row.sym));
  }
  const def = data.usThemes.find((item) => item.id === theme);
  if (!def) return null;
  return new Set([...(def.leaders || []), ...(def.subThemes || []).flatMap((sub) => sub.tickers || [])]);
}

/** The rows a screen spec keeps: { symbols (all matches, sorted), top (first `limit`) }. Throws on an invalid spec. */
export function resolveScreen(spec, data) {
  const conditions = normalizeConditions(spec.conditions || []);
  if ((spec.conditions || []).length !== conditions.length) throw new Error(`unknown or duplicate condition in ${JSON.stringify(spec.conditions)}`);
  const unsupported = conditions.filter((condition) => !SCREEN_CONDITION_IDS.includes(condition.id));
  if (unsupported.length) throw new Error(`conditions read files outside the screener artifact: ${unsupported.map((c) => c.id).join(', ')}`);
  const sizes = spec.size == null ? null : [].concat(spec.size);
  if (sizes && sizes.some((size) => !SIZE_BUCKETS.includes(size))) throw new Error(`size must be one of ${SIZE_BUCKETS.join('/')}`);
  const members = spec.theme ? themeMembers(data, spec.theme) : null;
  if (spec.theme && !members) throw new Error(`theme ${spec.theme} not in THEME_MAP / KR_THEME_MAP`);
  const market = spec.market || 'US';
  const kept = data.rows.filter((row) => {
    if (screenerMarket(row) !== market) return false;
    if (spec.index && row.index !== spec.index && !(Array.isArray(row.membership) && row.membership.includes(spec.index))) return false;
    if (spec.sector && row.sector !== spec.sector) return false;
    if (sizes && !sizes.includes(sizeOf(row))) return false;
    if (members && !members.has(row.sym)) return false;
    return matchesConditions(row, conditions, plainRead);
  });
  if (spec.sort) {
    const { key, dir = 'desc' } = spec.sort;
    kept.sort((a, b) => ((Number(a[key]) || 0) - (Number(b[key]) || 0)) * (dir === 'asc' ? 1 : -1));
  }
  const symbols = kept.map((row) => row.sym);
  return { symbols, top: symbols.slice(0, spec.limit || 10) };
}

/** Condition ids no committed row can be judged on (a screen built on them can never match). */
export function unjudgeableConditions(spec, data) {
  const available = availableConditionIds(data.rows, plainRead);
  return (spec.conditions || []).map((c) => c.id).filter((id) => !available.has(id));
}

// ── answer reading ────────────────────────────────────────────────────────────────────────────────────────────────────
const UNIT = { 조: 1e12, 억: 1e8, 만: 1e4, 천: 1e3 };
/** Every number written in the text (commas, decimals, a sign, Korean 조/억/만/천 units, '−'). */
export function numbersIn(text) {
  const out = [];
  const re = /([-+−]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(조|억|만|천)?/g;
  for (const match of String(text || '').matchAll(re)) {
    let value = Number(match[2].replace(/,/g, '')) * (match[3] ? UNIT[match[3]] : 1);
    if (match[1] === '-' || match[1] === '−') value = -value;
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}
export function figureFound(figure, resolved, text) {
  if (resolved.kind === 'date') {
    const [y, m, d] = resolved.value.split('-').map(Number);
    const forms = [resolved.value, `${m}월 ${d}일`, `${m}월${d}일`, `${m}/${d}`, `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`, `${m}.${d}`, `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`];
    const hit = forms.find((form) => new RegExp(`(^|[^0-9])${form.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^0-9])`).test(text));
    return { ok: !!hit, seen: hit || null };
  }
  const tol = figure.tolerance?.abs ?? (figure.tolerance?.pct != null ? Math.abs(resolved.value) * figure.tolerance.pct / 100 : Math.max(0.05, Math.abs(resolved.value) * 0.005));
  const target = figure.sign === 'exact' ? resolved.value : Math.abs(resolved.value);
  const nums = numbersIn(text);
  const hit = nums.find((n) => Math.abs((figure.sign === 'exact' ? n : Math.abs(n)) - target) <= tol + 1e-9);
  return { ok: hit !== undefined, seen: hit ?? null, tolerance: tol };
}

// Upper-case words that are never read as tickers in an answer (indicators, units, institutions).
const NOT_TICKERS = new Set(['AI', 'ETF', 'PER', 'PBR', 'ROE', 'ROA', 'EPS', 'RSI', 'MACD', 'SMA', 'EMA', 'ADR', 'ATR', 'VIX', 'CPI', 'PCE', 'PPI', 'GDP',
  'FOMC', 'FED', 'US', 'USA', 'KR', 'KRW', 'USD', 'CEO', 'CFO', 'IPO', 'TTM', 'YOY', 'QOQ', 'FY', 'Q1', 'Q2', 'Q3', 'Q4', 'FCF', 'OCF', 'SEC', 'NYSE',
  'NASDAQ', 'KOSPI', 'KOSDAQ', 'S&P', 'SP', 'DXY', 'WTI', 'VCP', 'ADX', 'GPU', 'HBM', 'IT', 'OK', 'PM', 'AM', 'ET', 'KST', 'UTC', 'NO', 'ON', 'ALL', 'NOW', 'LOW', 'KEY', 'BIG', 'ANY', 'TOP']);
/** Universe symbols named in the text: upper-case tickers, six-digit Korean codes and Korean company names. */
export function symbolsIn(text, data) {
  const found = new Set();
  const source = String(text || '');
  for (const match of source.matchAll(/(?<![A-Za-z0-9.&])([A-Z][A-Z0-9]{1,4}(?:\.[A-Z]{1,2})?)(?![A-Za-z0-9&])/g)) {
    const token = match[1];
    if (NOT_TICKERS.has(token)) continue;
    if (data.identity.has(token) || data.rowBySym.has(token)) found.add(token);
  }
  for (const match of source.matchAll(/(?<!\d)(\d{6})(?!\d)/g)) {
    for (const suffix of ['.KS', '.KQ']) if (data.rowBySym.has(match[1] + suffix)) found.add(match[1] + suffix);
  }
  for (const row of data.rows) {
    if (/\.K[SQ]$/.test(row.sym) && /[가-힣]/.test(row.name || '') && String(row.name).length >= 2 && source.includes(row.name)) found.add(row.sym);
  }
  return [...found];
}

// ── set validation ────────────────────────────────────────────────────────────────────────────────────────────────────
/** Structural problems of the set (no data needed). `routes`: the app's route ids (architecture/route-owners.json). */
export function validateSet(set, { routes = [] } = {}) {
  const errors = [];
  const err = (message) => errors.push(message);
  if (set?.schemaVersion !== SET_SCHEMA) err(`schemaVersion must be ${SET_SCHEMA}`);
  const taskIds = new Set((set?.tasks || []).map((task) => task.id));
  const situationIds = new Set((set?.situations || []).map((item) => item.id));
  TASK_IDS.forEach((id) => { if (!taskIds.has(id)) err(`task ${id} is not declared`); });
  REQUIRED_SITUATIONS.forEach((id) => { if (!situationIds.has(id)) err(`situation ${id} is not declared`); });
  for (const entry of set?.defaults?.mustNotContain || []) if (!patternOk(entry)) err(`defaults.mustNotContain entry ${JSON.stringify(entry)} is not a string or {regex}`);
  const questions = Array.isArray(set?.questions) ? set.questions : [];
  if (questions.length < 45 || questions.length > 60) err(`question count ${questions.length} is outside 45-60`);
  const seen = new Set();
  for (const q of questions) {
    const at = `question ${q?.id || '(no id)'}`;
    if (!q?.id || !/^[a-z0-9-]+$/.test(q.id)) err(`${at}: id must be lower-case kebab`);
    if (seen.has(q?.id)) err(`${at}: duplicate id`);
    seen.add(q?.id);
    if (!Array.isArray(q.tasks) || !q.tasks.length) err(`${at}: tasks[] required`);
    (q.tasks || []).forEach((id) => { if (!taskIds.has(id)) err(`${at}: unknown task ${id}`); });
    (q.situations || []).forEach((id) => { if (!situationIds.has(id)) err(`${at}: unknown situation ${id}`); });
    const route = String(q.screen || '').match(/^#([a-z-]+)/)?.[1];
    if (!route || (routes.length && !routes.includes(route))) err(`${at}: screen ${q.screen} is not a route (#<route>[?sym=…])`);
    const turns = q.turns || (q.question ? [q.question] : []);
    if (!turns.length || (q.turns && q.question)) err(`${at}: exactly one of question or turns[] is required`);
    turns.forEach((text, index) => { if (typeof text !== 'string' || !text.trim() || text.length > QUESTION_MAX_CHARS) err(`${at}: turn ${index + 1} must be 1-${QUESTION_MAX_CHARS} characters`); });
    if (!EXPECTS.includes(q.expect)) err(`${at}: expect must be one of ${EXPECTS.join('/')}`);
    if (q.when != null && !WHEN.includes(q.when)) err(`${at}: when must be one of ${WHEN.join('/')}`);
    if (typeof q.manual !== 'string' || q.manual.length < 8) err(`${at}: manual note required`);
    const checks = q.checks || {};
    Object.keys(checks).forEach((key) => { if (!CHECK_KEYS.includes(key)) err(`${at}: unknown check ${key}`); });
    (checks.mustNotContain || []).forEach((entry) => { if (!patternOk(entry)) err(`${at}: mustNotContain entry is not a string or {regex}`); });
    (q.allow || []).forEach((text) => { if (typeof text !== 'string') err(`${at}: allow[] holds strings`); });
    (checks.figures || []).forEach((figure) => {
      if (!parseResolver(figure.resolver)) err(`${at}: unknown resolver ${figure.resolver}`);
      if (figure.sign != null && !['any', 'exact'].includes(figure.sign)) err(`${at}: figure sign must be any|exact`);
      if (figure.tolerance != null && !(Number.isFinite(figure.tolerance.abs) || Number.isFinite(figure.tolerance.pct))) err(`${at}: tolerance needs abs or pct`);
    });
    (checks.mustMention || []).forEach((group) => { if (!Array.isArray(group) || !group.length || group.some((word) => typeof word !== 'string' || !word)) err(`${at}: mustMention holds non-empty any-of groups`); });
    if (checks.rowsFromScreen) {
      const spec = checks.rowsFromScreen;
      if (!Number.isInteger(spec.minNamed) || spec.minNamed < 0) err(`${at}: rowsFromScreen.minNamed must be an integer >= 0`);
      (spec.conditions || []).forEach((c) => { if (!SCREEN_CONDITION_IDS.includes(c.id)) err(`${at}: condition ${c.id} is not evaluable from the screener artifact`); });
    }
    const max = checks.maxSeconds || {};
    ['firstText', 'full'].forEach((key) => { if (max[key] != null && !(max[key] > 0)) err(`${at}: maxSeconds.${key} must be positive`); });
    if (checks.format != null && checks.format !== 'table') err(`${at}: format must be "table"`);
    if (checks.minLinks != null && !(Number.isInteger(checks.minLinks) && checks.minLinks >= 1)) err(`${at}: minLinks must be a positive integer`);
  }
  return errors;
}
function patternOk(entry) {
  if (typeof entry === 'string') return entry.length > 0;
  if (!entry || typeof entry.regex !== 'string') return false;
  try { new RegExp(entry.regex); return true; } catch { return false; }
}

/** tag → number of questions, for every declared task and situation. */
export function coverage(set) {
  const count = {};
  for (const task of set.tasks || []) count[`task:${task.id}`] = 0;
  for (const item of set.situations || []) count[`situation:${item.id}`] = 0;
  for (const q of set.questions || []) {
    (q.tasks || []).forEach((id) => { count[`task:${id}`] = (count[`task:${id}`] || 0) + 1; });
    (q.situations || []).forEach((id) => { count[`situation:${id}`] = (count[`situation:${id}`] || 0) + 1; });
  }
  return count;
}

/** Resolves every figure and screen of the given questions; returns { resolved: {id: {...}}, errors: [] }. */
export function resolveQuestions(questions, data) {
  const resolved = {};
  const errors = [];
  for (const q of questions) {
    const figures = (q.checks?.figures || []).map((figure) => {
      try { return { ...figure, resolved: resolveFigure(figure, data) }; } catch (error) {
        if (!figure.optional) errors.push(`${q.id}: ${figure.resolver}: ${error.message}`);
        return { ...figure, resolved: null, error: error.message };
      }
    });
    let screen = null;
    if (q.checks?.rowsFromScreen) {
      try {
        const blind = unjudgeableConditions(q.checks.rowsFromScreen, data);
        if (blind.length) throw new Error(`no committed row carries the data for ${blind.join(', ')}`);
        screen = resolveScreen(q.checks.rowsFromScreen, data);
      } catch (error) { errors.push(`${q.id}: rowsFromScreen: ${error.message}`); screen = { error: error.message }; }
    }
    resolved[q.id] = { figures, screen };
  }
  return { resolved, errors };
}

// ── scoring ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const hasPattern = (text, entry) => (typeof entry === 'string' ? text.includes(entry) : new RegExp(entry.regex, entry.flags || '').test(text));
const patternLabel = (entry) => (typeof entry === 'string' ? entry : entry.label || `/${entry.regex}/`);
const HARD_ORDER = /(지금\s*(당장\s*)?(사세요|매수하세요|파세요|매도하세요|사야\s*합니다|팔아야\s*합니다))|무조건\s*(사|팔|매수|매도)/;
const CONDITION_WORDS = /(면|경우|조건|시나리오|이탈|돌파|분할|구간|손절|기준선|확인되면|지지|저항)/;
const REFUSAL_ONLY = /(답변할 수 없|제공할 수 없|드릴 수 없|말씀드리기 어렵|조언할 수 없)/;

/**
 * Scores one recorded answer. `rec`: { turns: [{ answer, html, links, chips, statusLines, firstTextMs, totalMs, error }] }.
 * Returns checks: [{ check, ok, detail }] (ok null = not scored).
 */
export function scoreAnswer(q, rec, resolvedEntry, set, data) {
  const checks = [];
  const add = (check, ok, detail) => checks.push({ check, ok, detail });
  const last = rec.turns[rec.turns.length - 1] || {};
  const text = String(last.answer || '');
  const allow = new Set(q.allow || []);
  if (!text.trim()) add('answer present', false, last.error || 'no answer text');
  const banned = [...(set.defaults?.mustNotContain || []), ...(q.checks?.mustNotContain || [])].filter((entry) => !allow.has(patternLabel(entry)) && !(typeof entry === 'string' && allow.has(entry)));
  rec.turns.forEach((turn, index) => {
    const hits = banned.filter((entry) => hasPattern(String(turn.answer || ''), entry)).map(patternLabel);
    add(`mustNotContain${rec.turns.length > 1 ? ` (turn ${index + 1})` : ''}`, hits.length === 0, hits.length ? `found: ${hits.join(' | ')}` : 'clean');
  });
  for (const figure of resolvedEntry?.figures || []) {
    if (!figure.resolved) { add(`figure ${figure.resolver}`, null, `not resolved at run time: ${figure.error}`); continue; }
    const found = figureFound(figure, figure.resolved, text);
    add(`figure ${figure.resolver}`, found.ok, `expected ${figure.resolved.value}${found.tolerance != null ? ` ±${Math.round(found.tolerance * 1000) / 1000}` : ''} (${figure.resolved.basis}); ${found.ok ? `saw ${found.seen}` : 'not stated'}`);
  }
  for (const group of q.checks?.mustMention || []) {
    const hit = group.find((word) => text.toLowerCase().includes(word.toLowerCase()));
    add(`mustMention [${group.join(' | ')}]`, !!hit, hit ? `saw "${hit}"` : 'none of the words');
  }
  if (q.checks?.rowsFromScreen) {
    const spec = q.checks.rowsFromScreen;
    const screen = resolvedEntry?.screen;
    if (!screen || screen.error) add('rowsFromScreen', null, `screen not resolved: ${screen?.error || 'missing'}`);
    else {
      const ignore = new Set(spec.ignore || []);
      const named = symbolsIn(text, data).filter((sym) => !ignore.has(sym));
      const set = new Set(screen.symbols);
      const inside = named.filter((sym) => set.has(sym));
      const outside = named.filter((sym) => !set.has(sym));
      const okOutside = outside.length <= (spec.maxOutside || 0);
      const emptyOk = screen.symbols.length === 0 && /없/.test(text);
      const ok = okOutside && (inside.length >= spec.minNamed || emptyOk);
      add('rowsFromScreen', ok, `screen ${screen.symbols.length} rows (top ${screen.top.slice(0, 8).join(', ') || 'none'}); named in set ${inside.join(', ') || 'none'}; outside ${outside.join(', ') || 'none'}; need >= ${spec.minNamed}`);
    }
  }
  const max = { ...(set.defaults?.maxSeconds || {}), ...(q.checks?.maxSeconds || {}) };
  if (max.firstText != null) {
    const worst = Math.max(...rec.turns.map((turn) => (turn.firstTextMs == null ? Infinity : turn.firstTextMs)));
    add(`firstText <= ${max.firstText}s`, worst <= max.firstText * 1000, worst === Infinity ? 'no visible text' : `${(worst / 1000).toFixed(1)}s`);
  }
  if (max.full != null) {
    const worst = Math.max(...rec.turns.map((turn) => (turn.totalMs == null ? Infinity : turn.totalMs)));
    add(`full <= ${max.full}s`, worst <= max.full * 1000, worst === Infinity ? 'did not finish' : `${(worst / 1000).toFixed(1)}s`);
  }
  if (q.checks?.format === 'table') add('format table', /<table[\s>]/i.test(last.html || ''), /<table[\s>]/i.test(last.html || '') ? 'table rendered' : 'no <table> in the answer');
  if (q.checks?.minLinks) add(`links >= ${q.checks.minLinks}`, (last.links || []).length >= q.checks.minLinks, `${(last.links || []).length} links`);
  if (q.expect === 'conditional-guidance') {
    const order = HARD_ORDER.test(text);
    const conditional = CONDITION_WORDS.test(text);
    const refusal = REFUSAL_ONLY.test(text) && !conditional;
    add('expect conditional-guidance', !order && conditional && !refusal && text.length >= 80, order ? 'hard order phrase' : refusal ? 'refused without conditions' : conditional ? 'conditions given' : 'no condition words');
  } else if (q.expect === 'consent-prompt') {
    add('expect consent-prompt', /동의/.test(text), /동의/.test(text) ? 'asks for consent' : 'no consent request');
  } else if (q.expect === 'polite-decline') {
    add('expect polite-decline', text.length > 0 && text.length < 900 && /(투자|시장|종목|주식|금융)/.test(text), `length ${text.length}`);
  } else {
    add('expect answer', text.trim().length >= 40 && !/^\s*(AI (도우미 )?안전 모드)/.test(text), `length ${text.trim().length}`);
  }
  return checks;
}
