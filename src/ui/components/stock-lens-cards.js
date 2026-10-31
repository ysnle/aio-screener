// v58.75 (owner 2026-10-24, '고르는 법' layer B): the stock page blocks that teach how an expert reads this company — the market
// link and the memo/watch entry at the top of 종목 요약, strengths and weaknesses against named theme peers with the
// '계속 볼 것' list, and on 재무 공시 the business lens, the thesis template and the favourable/unfavourable situations.
// Loaded with the entity route and the lazy analysis cards (never the boot set). Readings come from
// src/domain/fundamental/stock-lens.js; this file gathers the page's existing inputs and draws them.
import { el } from './dom.js';
import { parseFiscalHistory } from './fiscal-read.js';
import { readMarketRegime } from './market-regime.js';
import { reconcileFiscalHistory, isLendingFinancial } from '../../domain/fundamental/fiscal-read.js';
import { parseQuarterHistory, buildQuarterRead } from '../../domain/fundamental/quarter-read.js';
import { buildTrailingYearRead, buildEarningsSchedule, buildMarginCashRead, buildThemePeers, buildRdRead, buildSurpriseRead, reverseDcfInputs, impliedGrowth, REVERSE_DCF_DEFAULTS } from '../../domain/fundamental/analysis-read.js';
import { lensIdFor, buildLensRead, buildPeerStrengths, buildSituationRead, buildThesisFrame, buildWatchList, buildMarketLink, dailyBeta } from '../../domain/fundamental/stock-lens.js';
import { themeStagesFor, themeMarketOf } from '../../domain/scenarios/theme-stage.js';
import { themeProfile } from '../../domain/scenarios/exposures.js';
import { koreanThemeGroups } from '../../domain/market/korea-participation.js';
import { buildCloseSeries } from '../../domain/market/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../../domain/market/market-windows.js';
import { signedText } from '../../domain/shared/number.js';
import { sharedArtifactState } from '../../data/shared-artifacts.js';
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';

const CALENDAR_KEY = '_aioEarningsCalendarArtifact';
const consensusOf = (root, sym) => root?._aioConsensusEstimates?.rows?.[String(sym || '').toUpperCase()] || null;
const isoOf = (bar) => { const ms = Number(bar?.epochMs ?? bar?.time); return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : String(bar?.date || '').slice(0, 10); };

/** Every input the blocks read, from what the page already loaded (no fetch here). */
export function stockLensContext(root, symbol, { fundamentals = null, bars = null } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  // The issuer's SEC record seen on the page, kept for the AI reader (window._aioStockLensFor) and the memo template.
  if (fundamentals && root && String(fundamentals.symbol || sym).toUpperCase() === sym) (root.__aioLensFundamentals ||= {})[sym] = fundamentals;
  let rows = [];
  try { rows = root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const row = rows.find((item) => item?.sym === sym) || null;
  const market = themeMarketOf(sym);
  const themes = market === 'KR' ? koreanThemeGroups(root?.KR_THEME_MAP || {}, rows) : (Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []);
  const fiscal = root?._aioSecFiscalHistory || null;
  const own = fundamentals && String(fundamentals.symbol || sym).toUpperCase() === sym ? fundamentals : null;
  const seriesFor = (s) => (fiscal?.[s] ? reconcileFiscalHistory(parseFiscalHistory(fiscal[s]), s === sym ? own : null, s) : null);
  const history = seriesFor(sym) || [];
  const quarters = root?._aioSecQuarterHistory?.[sym] ? parseQuarterHistory(root._aioSecQuarterHistory[sym]) : [];
  const consensus = consensusOf(root, sym);
  const peers = buildThemePeers({ symbol: sym, themes, rows, seriesFor, consensusFor: (s) => consensusOf(root, s) });
  const memberIds = themes.filter((theme) => (theme.leaders || []).includes(sym) || (theme.subThemes || []).some((sub) => (sub.tickers || []).includes(sym))).map((theme) => theme.id);
  const themeIds = [...new Set([peers?.themeId, ...memberIds].filter(Boolean))];
  const themeList = themeIds.map((id) => ({ id, label: themes.find((theme) => theme.id === id)?.nameKr || id }));
  const stages = themeStagesFor(root, { symbol: sym, themeIds });
  const stage = stages.find((item) => item.id === themeIds[0]) || stages[0] || null;
  const scenario = root?._aioScenarioState || null;
  let regime = null;
  try { regime = readMarketRegime(root); } catch (_) { regime = null; }
  const spx = buildCloseSeries(root?._aioHistory || [], 'spx');
  const barsIn = (Array.isArray(bars) && bars.length ? bars : root?._aioEntitySummaries?.[sym]?.history || []).map((bar) => ({ date: isoOf(bar), close: bar?.close }));
  const beta = market === 'US' ? dailyBeta(barsIn, spx) : null;
  // v58.80 run-5 (skeptic #11): the stock's 3-month return is an adjusted close (dividends in), so its benchmark is SPY's
  // adjusted return from the same factor session — the basis the 지수 대비 card above already uses (F10). Without that row
  // the S&P 500 index window (MARKET_WINDOWS.quarter) stands in and is named as the index.
  const spyRow = market === 'US' && sym !== 'SPY' ? rows.find((item) => item?.sym === 'SPY' && item.factorSessionDate && item.factorSessionDate === row?.factorSessionDate && Number.isFinite(Number(item.ret3m))) : null;
  const benchmark = spyRow ? { pct: Number(spyRow.ret3m), label: 'S&P 500(SPY, 배당 포함)' } : { pct: closeChange(root?._aioHistory || [], 'spx', MARKET_WINDOWS.quarter)?.pct ?? null, label: 'S&P 500 지수' };
  const sicCode = String(root?._aioSecIssuerSic?.[sym] || '').split('|')[0] || null;
  const lens = lensIdFor({ sic: sicCode, themeIds, sector: row?.sector || null });
  const trailing = buildTrailingYearRead(quarters);
  const quarterRead = quarters.length >= 2 ? buildQuarterRead(quarters) : null;
  const marginCash = history.length ? buildMarginCashRead(history) : null;
  const schedule = market === 'US' ? buildEarningsSchedule({ symbol: sym, calendar: root?.[CALENDAR_KEY], consensus, calendarState: sharedArtifactState(root, CALENDAR_KEY) }) : null;
  const levels = typeof root?._aioPriceLevelsFor === 'function' ? root._aioPriceLevelsFor(sym) : null;
  const financial = isLendingFinancial(sym, row?.sector);
  const close = Number(row?._valuationPrice ?? row?.valuationPrice) > 0 && hasLeadingIsoDay(String(row?.factorSessionDate || '')) ? { value: Number(row._valuationPrice ?? row.valuationPrice), date: String(row.factorSessionDate).slice(0, 10) } : null;
  const inputs = history.length ? reverseDcfInputs({ history, fundamentals: own, close, financial }) : null;
  const implied = inputs?.state === 'ready' ? impliedGrowth({ fcf: inputs.fcf, marketValue: inputs.marketValue, discountRate: REVERSE_DCF_DEFAULTS.discountRate, terminalGrowth: REVERSE_DCF_DEFAULTS.terminalGrowth }) : inputs ? { state: inputs.state } : null;
  const strengths = peers ? buildPeerStrengths(peers.rows) : null;
  const pe = strengths?.facts?.find((fact) => fact.id === 'fwdPe');
  const situation = buildSituationRead({ themes: themeList, market, scenario, beta });
  const tags = themeIds.flatMap((id) => themeProfile(market, id)?.tags || []);
  return {
    sym, market, row, history, peers, strengths, stage, themeList, situation, schedule, levels, consensus, trailing,
    lensRead: history.length ? buildLensRead({ lens, history, trailing, quarterRead, marginCash, rd: buildRdRead(history), consensus, surprise: buildSurpriseRead(consensus) }) : null,
    thesis: history.length ? buildThesisFrame({ implied, trailing, marginCash, consensus, schedule, levels, peerPe: pe ? { value: pe.value, median: pe.median } : null, situation }) : null,
    watch: buildWatchList({ schedule, consensus, trailing, row, stage, levels, benchmarkRet3m: benchmark.pct, benchmarkLabel: benchmark.label }),
    link: buildMarketLink({ regime, scenario, stage, themeLabel: themeList[0]?.label || null, tags })
  };
}

/** window._aioStockLensFor(sym): the same readings as plain data for the AI panel (null without a symbol). */
export function installStockLensGlobal(root) {
  if (!root || typeof root._aioStockLensFor === 'function') return;
  root._aioStockLensFor = (symbol) => {
    const sym = String(symbol || root?._currentTickerId || '').trim().toUpperCase();
    if (!sym) return null;
    const ctx = stockLensContext(root, sym, { fundamentals: root.__aioLensFundamentals?.[sym] || null });
    if (!ctx) return null;
    return {
      symbol: sym, marketLink: ctx.link?.text || null,
      lens: ctx.lensRead ? { name: ctx.lensRead.label, basis: ctx.lensRead.basis, metrics: ctx.lensRead.rows.map((row) => ({ metric: row.label, value: row.value || '미확인', trend: row.trend, why: row.why })) } : null,
      strengths: ctx.strengths?.strengths.map((fact) => fact.text) || [], weaknesses: ctx.strengths?.weaknesses.map((fact) => fact.text) || [],
      peers: ctx.peers ? { theme: ctx.peers.themeName, symbols: ctx.peers.rows.slice(1).map((row) => row.sym) } : null,
      situation: ctx.situation ? { favour: ctx.situation.favour, burden: ctx.situation.burden, now: ctx.situation.now, beta: ctx.situation.beta?.value ?? null } : null,
      thesis: ctx.thesis ? { priced: ctx.thesis.priced, conditions: ctx.thesis.conditions, checks: ctx.thesis.checks, breaks: ctx.thesis.breaks, paths: ctx.thesis.paths } : null,
      watch: ctx.watch.map((item) => `${item.label}: ${item.now}`),
      note: '사실·조건·충족 개수이며 매수·매도·가격·비중 판단이 아님'
    };
  };
}

function cardHead(doc, title, meta) {
  const head = el(doc, 'div', null, 'sx-card__head');
  head.append(el(doc, 'h3', title, 'sx-card__title'));
  if (meta) head.append(el(doc, 'span', meta, 'sx-card__meta'));
  return head;
}
function fold(doc, summary, lines) {
  const box = el(doc, 'details', null, 'sx-disclosure v2-analysis-principle');
  box.append(el(doc, 'summary', summary));
  const body = el(doc, 'div', null, 'sx-disclosure__body');
  for (const [label, text] of lines.filter((line) => line && line[1])) {
    const card = el(doc, 'div', null, 'sx-disclosure__card');
    card.append(el(doc, 'span', label, 'sx-disclosure__label'), el(doc, 'p', text, 'sx-disclosure__text'));
    body.append(card);
  }
  box.append(body);
  return box;
}
const list = (doc, items, className = 'v2-lens-list') => { const ul = el(doc, 'ul', null, className); for (const text of items) ul.append(el(doc, 'li', text)); return ul; };
// v58.75 (persona review): long lists show the first three and fold the rest (the burden side can name seven branches).
const shortList = (doc, items, keep = 3) => {
  const box = el(doc, 'div', null, 'v2-lens-short');
  box.append(list(doc, items.slice(0, keep)));
  if (items.length > keep) {
    const more = el(doc, 'details', null, 'v2-lens-more');
    more.append(el(doc, 'summary', `나머지 ${items.length - keep}개 보기`), list(doc, items.slice(keep)));
    box.append(more);
  }
  return box;
};

// The memo entry (existing '이 종목의 메모, 당시 근거 저장' panel): open it, scroll to it and, when the draft is empty, start it
// with the thesis template so the reader writes their own conditions.
export function openThesisMemo(doc, root, template = '') {
  const go = () => {
    const panel = doc.querySelector?.('#page-ticker [data-research-snapshots="stock"]');
    if (!panel) return false;
    panel.open = true;
    const note = panel.querySelector('textarea');
    if (note && !note.value && template) note.value = template.slice(0, 2000);
    panel.scrollIntoView?.({ block: 'center' });
    note?.focus?.();
    return true;
  };
  if (doc.getElementById?.('page-ticker')?.classList?.contains('active')) { go(); return; }
  root?.showPage?.('ticker');
  setTimeout(go, 400);
}
export function thesisTemplate(ctx) {
  const t = ctx?.thesis;
  if (!t) return '';
  return [`내 논지(${ctx.sym}):`, t.priced ? `가격이 가정하는 것 — ${t.priced}` : null, ...t.conditions.map((c) => `맞으려면 — ${c}`), ...t.breaks.slice(0, 3).map((b) => `깨짐 신호 — ${b}`)].filter(Boolean).join('\n');
}

// ── 종목 요약 top: the market link line, memo and watchlist entries ──────────────────────────────────────────────────────
export function renderStockContext(doc, root, host, ctx) {
  if (!ctx) { host.hidden = true; host.replaceChildren(); return; }
  host.replaceChildren();
  if (ctx.link) {
    const line = el(doc, 'p', ctx.link.text, `v2-stock-context__line${ctx.link.wind === '부담' ? ' is-burden' : ctx.link.wind === '수혜' ? ' is-favorable' : ''}`);
    host.append(line);
  }
  const actions = el(doc, 'div', null, 'v2-stock-context__actions');
  const memo = el(doc, 'button', '내 논지·메모 저장', 'aio-btn-table');
  memo.type = 'button';
  memo.addEventListener('click', () => openThesisMemo(doc, root, thesisTemplate(stockLensContext(root, ctx.sym, { fundamentals: root.__aioLensFundamentals?.[ctx.sym] || null }))));
  actions.append(memo);
  if (typeof root?._aioWLToggle === 'function') {
    // v58.80 (first-users run-3 B15): the button never changed state; it now says whether the stock is in a 관심 종목
    // list and toggles through the one watchlist store (the toast names the list it went to).
    const watch = el(doc, 'button', '', 'aio-btn-table');
    watch.type = 'button';
    const paint = () => {
      const held = (root._aioWatchlistGet?.() || []).includes(ctx.sym);
      watch.textContent = held ? '관심 종목에서 빼기' : '관심 종목에 추가';
      watch.setAttribute('aria-pressed', held ? 'true' : 'false');
    };
    paint();
    watch.addEventListener('click', () => { root._aioWLToggle(ctx.sym); paint(); });
    actions.append(watch);
  }
  host.append(actions);
  host.hidden = false;
}

// ── 종목 요약: strengths/weaknesses against named peers + what to keep watching ─────────────────────────────────────────
function factRow(doc, fact, tone) {
  const li = el(doc, 'li', null, `stock-read-point is-${tone}`);
  const bar = el(doc, 'div', null, 'stock-read-track');
  const fill = el(doc, 'div', null, `stock-read-bar is-${tone}`);
  fill.style.width = `${Math.max(4, (1 - fact.side) * 100).toFixed(1)}%`;
  bar.append(fill);
  bar.title = `동종 ${fact.n}곳 중 ${fact.rank}위 (막대가 길수록 동종 안에서 앞쪽)`;
  li.append(el(doc, 'span', fact.label, 'stock-read-point-title'), el(doc, 'span', fact.text, 'stock-read-point-text'), bar);
  return li;
}
export function renderStockStrengths(doc, host, ctx) {
  const pair = el(doc, 'div', null, 'v2-stock-pair');
  const s = ctx?.strengths;
  if (s && (s.strengths.length || s.weaknesses.length)) {
    const card = el(doc, 'div', null, 'sx-card v2-stock-card v2-peer-strengths');
    card.append(cardHead(doc, '같은 테마 안에서 강한 점과 약한 점', `${ctx.peers.themeName}, 동종 ${s.peers}곳`));
    if (s.strengths.length) { card.append(el(doc, 'p', '강한 점', 'stock-read-vis-title')); const ul = el(doc, 'ul', null, 'stock-read-points'); s.strengths.forEach((fact) => ul.append(factRow(doc, fact, 'favorable'))); card.append(ul); }
    if (s.weaknesses.length) { card.append(el(doc, 'p', '약한 점', 'stock-read-vis-title')); const ul = el(doc, 'ul', null, 'stock-read-points'); s.weaknesses.forEach((fact) => ul.append(factRow(doc, fact, 'burden'))); card.append(ul); }
    card.append(fold(doc, '비교 기준', [['동종', `${ctx.peers.themeName}의 같은 하위 테마 기업부터 테마 대표 기업까지 SEC 연간 공시가 있는 ${s.peers}곳: ${ctx.peers.rows.slice(1).map((row) => row.sym).join(', ')}.`],
      ['읽는 법', '각 지표에서 동종 안 순위와 중앙값을 사실로 적었습니다. 강점·약점은 중앙값보다 앞·뒤인 지표 중 차이가 큰 순서이며, 등급이나 매수 판단이 아닙니다. Forward PER은 낮을수록 이익 대비 가격 부담이 가벼운 쪽으로 읽습니다.'],
      ['한계', '회계연도 마감 시점이 회사마다 다르고, 테마는 AIO의 투자 분류라 사업 구성이 같지 않습니다. 재무 공시 화면의 동종 표에서 숫자를 확인합니다.']]));
    pair.append(card);
  }
  if (ctx?.watch?.length) {
    const card = el(doc, 'div', null, 'sx-card v2-stock-card v2-stock-watch');
    card.append(cardHead(doc, '이 종목에서 계속 볼 것', `${ctx.watch.length}가지`));
    const ul = el(doc, 'ul', null, 'stock-read-points');
    for (const item of ctx.watch) {
      const li = el(doc, 'li', null, 'stock-read-point is-neutral');
      li.append(el(doc, 'span', item.label, 'stock-read-point-title'), el(doc, 'span', `${item.now} — ${item.why}`, 'stock-read-point-text'));
      ul.append(li);
    }
    card.append(ul);
    pair.append(card);
  }
  host.replaceChildren(...(pair.childElementCount ? [pair] : []));
  host.hidden = !pair.childElementCount;
}

// ── 재무 공시: the lens, the thesis template, favourable/unfavourable situations ─────────────────────────────────────────
export function lensCard(doc, read) {
  if (!read) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-stock-lens');
  card.dataset.analysis = 'lens';
  card.append(cardHead(doc, `이 기업을 보는 렌즈, ${read.label}`, `${read.rows.length}개 중 ${read.known}개 확인`));
  card.append(el(doc, 'p', read.why, 'v2-analysis-lede'));
  const region = el(doc, 'div', null, 'fiscal-table-scroll');
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', '렌즈 지표표, 가로 스크롤');
  const table = el(doc, 'table', null, 'fiscal-amount-table');
  table.append(el(doc, 'caption', '추적할 지표, 이 기업의 값과 방향, 미확인은 이 화면 공시 수집본에 없는 항목'));
  const head = el(doc, 'thead'); const hr = el(doc, 'tr');
  for (const label of ['지표', '이 기업', '방향', '왜 보는가']) { const th = el(doc, 'th', label); th.scope = 'col'; hr.append(th); }
  head.append(hr); table.append(head);
  const body = el(doc, 'tbody');
  for (const row of read.rows) {
    const tr = el(doc, 'tr');
    const th = el(doc, 'th', row.label); th.scope = 'row';
    tr.append(th, el(doc, 'td', row.value || '미확인', row.value ? null : 'is-muted'), el(doc, 'td', row.trend || '—'), el(doc, 'td', row.value ? row.why : `${row.why} 확인처: ${row.check}`));
    body.append(tr);
  }
  table.append(body); region.append(table); card.append(region);
  card.append(el(doc, 'p', `렌즈 선택 기준: ${read.basis}. 업종마다 정상 수준이 달라, 값은 같은 업종 안에서 비교합니다.`, 'theme-strength-basis'));
  return card;
}

export function thesisCard(doc, root, ctx) {
  const t = ctx?.thesis;
  if (!t) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-thesis');
  card.dataset.analysis = 'thesis';
  card.append(cardHead(doc, '투자 논지 틀', '내 논지를 세우는 칸, 앱의 결론 아님'));
  if (t.priced) card.append(el(doc, 'p', t.priced, 'v2-analysis-lede'));
  if (t.impliedPct != null && t.ttm != null) {
    const bars = el(doc, 'div', null, 'v2-thesis-bars');
    const top = Math.max(Math.abs(t.impliedPct), Math.abs(t.ttm), 1);
    for (const [label, value] of [['가격이 가정한 성장(연)', t.impliedPct], ['최근 4개 분기 매출 성장', t.ttm]]) {
      const line = el(doc, 'div', null, 'stock-read-bars');
      line.append(el(doc, 'span', label, 'stock-read-bar-label'));
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      const track = el(doc, 'div', null, 'stock-read-track');
      const fill = el(doc, 'div', null, `stock-read-bar is-${value < 0 ? 'burden' : 'neutral'}`);
      fill.style.width = `${Math.max(2, Math.abs(value) / top * 100).toFixed(1)}%`;
      track.append(fill);
      item.append(track, el(doc, 'span', signedText(value, 1, '%'), 'stock-read-bar-value'));
      line.append(item); bars.append(line);
    }
    card.append(bars);
  }
  const grid = el(doc, 'div', null, 'v2-thesis-grid');
  const block = (title, items) => { if (!items.length) return; const box = el(doc, 'div', null, 'v2-thesis-block'); box.append(el(doc, 'p', title, 'stock-read-vis-title'), list(doc, items)); grid.append(box); };
  block(`논지가 맞으려면 (${t.conditions.length}가지)`, t.conditions);
  block('확인 일정', t.checks);
  block('논지가 틀렸다는 신호', t.breaks);
  card.append(grid);
  card.append(fold(doc, '수익까지 이어지는 두 경로, 성립과 깨짐', t.paths.flatMap((path) => [[`${path.label}, 성립`, path.holds], [`${path.label}, 깨짐`, path.fails]])));
  const save = el(doc, 'button', '이 틀로 내 논지 메모 시작', 'aio-btn-table');
  save.type = 'button';
  save.addEventListener('click', () => openThesisMemo(doc, root, thesisTemplate(ctx)));
  card.append(save, el(doc, 'p', '가격·확률은 제시하지 않습니다. 조건과 신호는 이 화면의 공시·컨센서스·차트 값으로 만든 확인 목록입니다.', 'theme-strength-basis'));
  return card;
}

export function situationCard(doc, ctx) {
  const s = ctx?.situation;
  if (!s || (!s.favour.length && !s.burden.length)) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-situation');
  card.dataset.analysis = 'situation';
  card.append(cardHead(doc, '유리한 환경과 불리한 환경', s.themes.map((theme) => theme.label).join(', ')));
  if (s.now) card.append(el(doc, 'p', s.now, 'v2-analysis-lede'));
  const pair = el(doc, 'div', null, 'v2-thesis-grid is-pair');
  const leadFirst = (items) => (s.lead?.title && items.includes(s.lead.title) ? [s.lead.title, ...items.filter((item) => item !== s.lead.title)] : items);
  if (s.favour.length) { const box = el(doc, 'div', null, 'v2-thesis-block is-favorable'); box.append(el(doc, 'p', `이런 환경에서 유리 (${s.favour.length})`, 'stock-read-vis-title'), shortList(doc, leadFirst(s.favour))); pair.append(box); }
  if (s.burden.length) { const box = el(doc, 'div', null, 'v2-thesis-block is-burden'); box.append(el(doc, 'p', `이런 환경에서 불리 (${s.burden.length})`, 'stock-read-vis-title'), shortList(doc, leadFirst(s.burden))); pair.append(box); }
  card.append(pair);
  if (s.beta) card.append(el(doc, 'p', `시장 대비 민감도(베타) ${s.beta.value.toFixed(2)} — 최근 ${s.beta.sessions}거래일 일간 수익률을 S&P 500과 비교한 값으로, 1보다 크면 시장이 움직일 때 더 크게 움직였다는 뜻입니다.`, 'theme-strength-basis'));
  card.append(fold(doc, '근거, 테마의 노출과 논지', [['노출', `${s.tags.join(', ')} — 이 노출이 각 거시 시나리오에서 순풍인지 역풍인지로 나눴습니다(시나리오별 수혜·부담 규칙).`],
    ...s.themes.map((theme) => [`${theme.label} 논지`, `${theme.thesis}. 깨지는 조건: ${theme.breaks.join(', ')}.`])]));
  return card;
}
