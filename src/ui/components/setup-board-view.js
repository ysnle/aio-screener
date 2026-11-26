// The setup board on its three owning screens (technical/setup-board.js): 시장 폭's opening points and count tiles,
// 테마와 섹터's sector bars and theme 200-day tiles, and the 스크리너's state cells and 돌파 대기 cards. Every piece
// renders only from computed inputs; a host with nothing computed stays hidden.
import { el } from './dom.js';
import { buildSetupBoard, setupOf, setupText, setupCandidates, themeTiles, themeMembers, earningsAhead, setupBoardPoints } from '../../domain/technical/setup-board.js';
import { SETUP_STATE_WORDS, SETUP_REASON_WORDS, SETUP_BAND_WORDS, SETUP_BOARD_WORDS as W } from '../../domain/content/setup-board-words.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { EARNINGS_CALENDAR } from '../../data/artifact-registry.js';
import { signedText } from '../../domain/shared/number.js';
import { shortDate } from '../../domain/content/date-labels.js';

const pct = (value, digits = 1) => (value == null ? '—' : signedText(value, digits, '%'));
const calendarOf = (root) => root?.[EARNINGS_CALENDAR.key] || null;

/** Loads the earnings calendar once per max age and repaints when a new copy arrives. */
export function requestSetupCalendar(root, onChange) {
  return refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed) onChange?.(); }).catch(() => {});
}

function hostOf(doc, id) {
  const host = doc?.getElementById?.(id);
  if (host) host.dataset.aioSetupBoardRenderer = 'native';
  return host || null;
}

function show(host, nodes) {
  host.replaceChildren(...nodes);
  host.hidden = !nodes.length;
}

function tile(doc, label, value, note) {
  const box = el(doc, 'div', null, 'setup-tile');
  box.append(el(doc, 'span', label, 'setup-tile__label'), el(doc, 'strong', value, 'setup-tile__value'), el(doc, 'span', note, 'setup-tile__note'));
  return box;
}

// ── 시장 폭 ─────────────────────────────────────────────────────────────

/**
 * 시장 폭: the opening points (#breadth-points) and the three count tiles (#breadth-setup).
 * @param {{ documentRef: Document, root: object, rows: object[], highsLows?: object|null }} input
 */
export function renderBreadthSetup({ documentRef: doc, root, rows, highsLows = null }) {
  const pointsHost = hostOf(doc, 'breadth-points');
  const tilesHost = hostOf(doc, 'breadth-setup');
  if (!pointsHost && !tilesHost) return null;
  const board = buildSetupBoard(rows);
  const ai = (root?.THEME_MAP || []).find((theme) => theme?.id === 'ai_infra') || null;
  const theme = ai ? { id: ai.id, name: ai.nameKr, tiles: themeTiles(board, themeMembers(ai)) } : null;
  if (pointsHost) {
    const points = setupBoardPoints({ highsLows, board, theme, calendar: calendarOf(root) });
    const list = el(doc, 'ul', null, 'setup-points__list');
    list.append(...points.map((point) => el(doc, 'li', point.text, 'setup-points__item')));
    show(pointsHost, points.length ? [el(doc, 'h2', '오늘의 요점', 'setup-points__title'), list] : []);
  }
  if (tilesHost) {
    const counts = board.counts;
    const nodes = [];
    if (counts) {
      const grid = el(doc, 'div', null, 'setup-tiles');
      grid.append(
        tile(doc, W.tiles.template, `${counts.template}`, `${W.tileNotes.template} · ${board.judged}개 중`),
        tile(doc, W.tiles.base, `${counts.base}`, W.tileNotes.base),
        tile(doc, W.tiles.ready, `${counts.ready}`, W.tileNotes.ready)
      );
      nodes.push(el(doc, 'h2', `${W.templateLabel} — ${board.asOf ? `${shortDate(board.asOf)} 종가` : '종가 기준'}`, 'breadth-group-title'), grid);
    }
    show(tilesHost, nodes);
  }
  if (calendarOf(root) == null) requestSetupCalendar(root, () => renderBreadthSetup({ documentRef: doc, root, rows, highsLows }));
  return board;
}

// ── 테마와 섹터 ─────────────────────────────────────────────────────────

function sectorBars(doc, board) {
  const rows = board.sectors.filter((row) => row.template > 0);
  if (!rows.length) return null;
  const max = Math.max(...rows.map((row) => row.template));
  const box = el(doc, 'div', null, 'setup-sectors');
  box.append(el(doc, 'h3', W.sectorTitle, 'setup-block__title'), el(doc, 'p', W.sectorCaption, 'setup-block__caption'));
  for (const row of rows) {
    const line = el(doc, 'div', null, 'setup-sector');
    const name = el(doc, 'span', row.label, 'setup-sector__name');
    if (row.defensive) name.append(el(doc, 'span', W.defensive, 'setup-sector__tag'));
    const track = el(doc, 'span', null, 'setup-sector__track');
    const all = el(doc, 'span', null, 'setup-sector__all');
    all.style.width = `${(row.template / max) * 100}%`;
    const based = el(doc, 'span', null, 'setup-sector__base');
    based.style.width = `${(row.base / max) * 100}%`;
    track.append(all, based);
    line.append(name, track, el(doc, 'span', `${row.base} / ${row.template}`, 'setup-sector__count'));
    line.title = `${row.label}: 판정 ${row.judged}개 중 템플릿 통과 ${row.template}개, 그중 베이스 완성 ${row.base}개`;
    box.append(line);
  }
  return box;
}

function tileGrid(doc, model) {
  const grid = el(doc, 'div', null, 'setup-grid');
  for (const tile of model.tiles) {
    const cell = el(doc, 'div', null, `setup-grid__tile is-${tile.band}`);
    cell.append(el(doc, 'span', tile.symbol, 'setup-grid__sym'), el(doc, 'span', pct(tile.pctSma200), 'setup-grid__pct'));
    cell.title = `${tile.symbol} 200일선 대비 ${pct(tile.pctSma200)} · ${SETUP_BAND_WORDS[tile.band]}`;
    grid.append(cell);
  }
  return grid;
}

// Themes with at least eight measured members can be chosen; AI 인프라 first.
const MIN_GRID_MEMBERS = 8;

/**
 * 테마와 섹터: the sector bars and one theme's 200-day tile grid (#themes-setup-board).
 * @param {{ documentRef: Document, root: object, rows: object[] }} input
 */
export function renderThemesSetup({ documentRef: doc, root, rows }) {
  const host = hostOf(doc, 'themes-setup-board');
  if (!host) return null;
  const board = buildSetupBoard(rows);
  const themes = (root?.THEME_MAP || []).map((theme) => ({ theme, model: themeTiles(board, themeMembers(theme)) })).filter((item) => item.model.measured >= MIN_GRID_MEMBERS);
  themes.sort((a, b) => (a.theme.id === 'ai_infra' ? -1 : b.theme.id === 'ai_infra' ? 1 : 0));
  const nodes = [];
  const bars = sectorBars(doc, board);
  if (bars) nodes.push(bars);
  const chosen = themes.find((item) => item.theme.id === root._aioSetupTheme) || themes[0] || null;
  if (chosen) {
    const box = el(doc, 'div', null, 'setup-theme');
    const head = el(doc, 'div', null, 'setup-theme__head');
    const select = el(doc, 'select', null, 'setup-theme__pick');
    select.setAttribute('aria-label', '테마 선택');
    for (const { theme, model } of themes) {
      const option = el(doc, 'option', `${theme.nameKr} ${model.measured}종목`);
      option.value = theme.id;
      option.selected = theme.id === chosen.theme.id;
      select.append(option);
    }
    select.addEventListener('change', () => { root._aioSetupTheme = select.value; renderThemesSetup({ documentRef: doc, root, rows }); doc.querySelector('.setup-theme__pick')?.focus(); });
    head.append(el(doc, 'h3', W.themeTitle, 'setup-block__title'), select);
    const m = chosen.model;
    const summary = `200일선 위 ${m.above}개 · -10% 이내 ${m.near}개${m.template != null ? ` · 템플릿 통과 ${m.template}개` : ''}`;
    box.append(head, el(doc, 'p', `${W.themeCaption} — ${summary}`, 'setup-block__caption'), tileGrid(doc, m));
    nodes.push(box);
  }
  show(host, nodes);
  return board;
}

// ── 스크리너 ───────────────────────────────────────────────────────────

export const SETUP_COLUMN_KEYS = new Set(['setupState', 'contractions', 'setupReasons', 'earningsAhead']);

function statePill(doc, setup) {
  const word = SETUP_STATE_WORDS[setup.state] || `${setup.met}/8`;
  const node = el(doc, 'span', word, `setup-pill is-${setup.state}`);
  node.title = setupText(setup);
  return node;
}

const depthsText = (setup) => (setup.depths?.length ? `${setup.depths.map((depth) => Math.round(depth)).join(' → ')}%` : null);

/** A cell of the 후보 상태 columns, or null for any other key. */
export function setupColumnContent(doc, row, key, { root = globalThis } = {}) {
  if (!SETUP_COLUMN_KEYS.has(key)) return null;
  const setup = setupOf(row);
  const muted = (text, title) => { const node = el(doc, 'span', text, 'setup-cell is-muted'); if (title) node.title = title; return node; };
  if (key === 'setupState') return setup.state ? statePill(doc, setup) : muted('—', W.waiting);
  if (key === 'contractions') {
    const text = depthsText(setup);
    if (!text) return muted('—', '유효한 수축 구조가 없거나 자료 수집 중');
    const node = el(doc, 'span', text, 'setup-cell');
    node.title = `수축 폭(오래된 순)${setup.volumeRatio != null ? `, 베이스 후반 거래량 ${setup.volumeRatio.toFixed(2)}배` : ''}`;
    return node;
  }
  if (key === 'setupReasons') {
    if (!setup.state) return muted('—', W.waiting);
    return setup.reasons.length ? el(doc, 'span', setup.reasons.map((id) => SETUP_REASON_WORDS[id]).join(', '), 'setup-cell setup-reasons') : muted('—');
  }
  const next = earningsAhead(calendarOf(root), row?.sym || row?.symbol);
  if (!next) return muted('—', '실적 일정 자료에 다음 발표가 없음');
  const node = el(doc, 'span', `${shortDate(next.date)} D-${next.days}`, `setup-cell${next.soon ? ' setup-earnings is-soon' : ''}`);
  node.title = `다음 실적 발표 ${next.date}`;
  return node;
}

// A 20-session line from the published daily returns, ending at the last close, with the pivot and stop lines.
function miniChart(doc, rets, setup) {
  if (!Array.isArray(rets) || rets.length < 10 || rets.some((value) => value == null) || setup.pivotPct == null) return null;
  const levels = [1];
  for (let i = rets.length - 1; i > 0; i -= 1) levels.unshift(levels[0] / (1 + rets[i] / 100));
  const pivot = 1 / (1 + setup.pivotPct / 100);
  const stop = setup.stopPct != null ? pivot * (1 - setup.stopPct / 100) : null;
  const all = [...levels, pivot, ...(stop != null ? [stop] : [])];
  const lo = Math.min(...all); const hi = Math.max(...all);
  const w = 140; const h = 44;
  const y = (value) => (hi === lo ? h / 2 : h - 2 - ((value - lo) / (hi - lo)) * (h - 4));
  const x = (index) => (index / (levels.length - 1)) * w;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('class', 'setup-card__chart');
  svg.setAttribute('aria-hidden', 'true');
  const line = (y0, cls) => { const node = doc.createElementNS(NS, 'line'); node.setAttribute('x1', '0'); node.setAttribute('x2', String(w)); node.setAttribute('y1', y0.toFixed(1)); node.setAttribute('y2', y0.toFixed(1)); node.setAttribute('class', cls); svg.append(node); };
  line(y(pivot), 'setup-card__pivot');
  if (stop != null) line(y(stop), 'setup-card__stop');
  const path = doc.createElementNS(NS, 'path');
  path.setAttribute('d', levels.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' '));
  path.setAttribute('class', 'setup-card__line');
  svg.append(path);
  return svg;
}

/**
 * 스크리너: the 돌파 대기 cards (#scr-setup-cards), nearest the pivot first.
 * @param {{ documentRef: Document, root: object, rows: object[], rsPercentiles?: Map, onOpen?: (symbol:string) => void }} input
 */
export function renderSetupCards({ documentRef: doc, root, rows, rsPercentiles = null, onOpen = null }) {
  const host = hostOf(doc, 'scr-setup-cards');
  if (!host) return null;
  const board = buildSetupBoard(rows);
  const ready = setupCandidates(board, 'ready').slice(0, 6);
  const bySymbol = new Map((rows || []).map((row) => [String(row?.sym || row?.symbol || '').toUpperCase(), row]));
  const calendar = calendarOf(root);
  const cards = ready.map((setup) => {
    const row = bySymbol.get(setup.symbol);
    const card = el(doc, onOpen ? 'button' : 'div', null, 'setup-card');
    if (onOpen) { card.type = 'button'; card.addEventListener('click', () => onOpen(setup.symbol)); }
    const head = el(doc, 'div', null, 'setup-card__head');
    head.append(el(doc, 'strong', setup.symbol, 'setup-card__sym'), el(doc, 'span', row?.industry || row?.sector || '', 'setup-card__industry'));
    card.append(head);
    const chart = miniChart(doc, row?.rets, setup);
    if (chart) card.append(chart);
    const facts = el(doc, 'dl', null, 'setup-card__facts');
    const fact = (label, value, className = null) => { if (value == null) return; facts.append(el(doc, 'dt', label), el(doc, 'dd', value, className)); };
    fact(W.pivot, pct(setup.pivotPct));
    fact(W.stop, setup.stopPct != null ? pct(-setup.stopPct) : null);
    const rs = rsPercentiles?.get?.(setup.symbol)?.rs6m;
    fact('RS', rs != null ? String(rs) : null);
    fact(W.contractions, depthsText(setup));
    fact(W.volume, setup.volumeRatio != null ? `${setup.volumeRatio.toFixed(2)}배` : null);
    const next = earningsAhead(calendar, setup.symbol);
    fact(W.earnings, next ? `${shortDate(next.date)} D-${next.days}` : null, next?.soon ? 'setup-earnings is-soon' : null);
    card.append(facts);
    return card;
  });
  const nodes = cards.length ? [el(doc, 'h2', `${W.candidatesTitle} ${cards.length}`, 'setup-block__title'), el(doc, 'p', W.candidatesCaption, 'setup-block__caption'), (() => { const list = el(doc, 'div', null, 'setup-cards'); list.append(...cards); return list; })()] : [];
  show(host, nodes);
  if (calendar == null && cards.length) requestSetupCalendar(root, () => renderSetupCards({ documentRef: doc, root, rows, rsPercentiles, onOpen }));
  return ready;
}

