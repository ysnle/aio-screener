// P1432 (stage 5): the 오늘 daily loop — what changed since the last session, what happened to my
// names, what is scheduled next and which news is about my names — right after the market verdict.
import { buildDailyChanges, buildMyNames } from '../../domain/briefing/daily-diff.js';
import { buildBriefingSchedule } from '../../domain/briefing/schedule.js';
import { readMarketRegime } from './market-regime.js';
import { emptyState } from './empty-state.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

function call(root, name, arg, fallback) {
  try { const fn = root?.[name]; return typeof fn === 'function' ? (fn(arg) ?? fallback) : fallback; } catch (_) { return fallback; }
}

function renderChanges(doc, host, history) {
  const model = buildDailyChanges(history);
  host.replaceChildren(el(doc, 'h2', '어제와 달라진 점', 'briefing-h2'));
  if (!model.available) { host.append(emptyState(doc, { title: '비교 대기', reason: model.reason, compact: true })); return model; }
  host.querySelector('h2').append(el(doc, 'span', `${shortDate(model.prevDate)} → ${shortDate(model.date)} 종가`, 'briefing-h2-note'));
  host.append(el(doc, 'p', model.headline, 'daily-headline'));
  const grid = el(doc, 'div', null, 'daily-moves');
  for (const move of model.moves) {
    const cell = el(doc, 'div', null, `daily-move${model.big.includes(move.key) ? ' is-big' : ''}`);
    cell.dataset.measure = move.key;
    cell.append(el(doc, 'span', move.label, 'daily-move-label'), el(doc, 'span', move.text, `daily-move-value ${move.value > 0 ? 'is-up' : move.value < 0 ? 'is-down' : ''}`));
    if (move.level) cell.append(el(doc, 'span', move.level, 'daily-move-level'));
    grid.append(cell);
  }
  host.append(grid);
  return model;
}

function renderMyNames(doc, host, root, store) {
  const state = store?.getState?.() || {};
  const holdings = Array.isArray(state?.portfolio?.holdings) ? state.portfolio.holdings : [];
  const symbols = call(root, '_aioWatchlistGet', undefined, []);
  const rows = call(root, '_aioGetCanonicalScreenerRows', undefined, []);
  const breadthState = readMarketRegime(root)?.axes?.find((axis) => axis.id === 'breadth')?.state || null;
  const model = buildMyNames({ symbols, rows, live: root?._liveData || {}, holdings, breadthState });
  host.replaceChildren(el(doc, 'h2', '내 종목', 'briefing-h2'));
  if (!model.names.length) {
    host.append(emptyState(doc, { title: '관심·보유 종목이 없습니다', reason: '스크리너나 종목 화면에서 ☆로 추가한 종목이 여기에서 매일 정리됩니다.', compact: true }));
    return model;
  }
  if (model.summary) host.append(el(doc, 'p', model.summary, 'daily-headline'));
  const list = el(doc, 'ul', null, 'daily-names');
  for (const row of model.names.slice(0, 8)) {
    const li = el(doc, 'li', null, 'daily-name');
    const button = el(doc, 'button', row.symbol, 'daily-name-symbol');
    button.type = 'button';
    button.dataset.action = 'showTicker';
    button.dataset.arg = row.symbol;
    li.append(button, el(doc, 'span', `${row.name || ''}${row.held ? ' · 보유' : ''}`, 'daily-name-name'));
    li.append(el(doc, 'span', row.dayPct == null ? '' : `${row.dayPct >= 0 ? '+' : ''}${row.dayPct.toFixed(2)}%`, `daily-name-day ${row.dayPct > 0 ? 'is-up' : row.dayPct < 0 ? 'is-down' : ''}`));
    li.append(el(doc, 'span', row.notes.join(' · ') || '팩터 기록 없음', 'daily-name-notes'));
    list.append(li);
  }
  host.append(list);
  return model;
}

function renderSchedule(doc, host, root) {
  const schedule = buildBriefingSchedule({
    releases: root.AIO_MACRO_CALENDAR?.releases || {},
    snapshot: root.DATA_SNAPSHOT || {},
    policyRange: root.AIO_EVENT_FRESHNESS_REGISTRY?.fomc?.policyRange || null,
    earnings: root._aioEarningsSnapshot?.earnings || [],
    names: {},
    nowMs: Date.now(),
    days: 3,
    maxEarnings: 3
  }).filter((row) => !row.passed);
  host.replaceChildren(el(doc, 'h2', '다가오는 일정', 'briefing-h2'));
  host.querySelector('h2').append(el(doc, 'span', '3일 · 한국 시간', 'briefing-h2-note'));
  if (!schedule.length) { host.append(el(doc, 'p', '3일 안에 예정된 주요 발표가 없습니다.', 'daily-empty')); return; }
  const list = el(doc, 'ul', null, 'daily-schedule');
  for (const row of schedule.slice(0, 5)) {
    const li = el(doc, 'li', null, `daily-event${row.today ? ' is-today' : ''}`);
    li.append(el(doc, 'span', row.when, 'daily-event-when'), el(doc, 'span', row.label, 'daily-event-label'));
    if (row.why) li.append(el(doc, 'span', row.why, 'daily-event-why'));
    list.append(li);
  }
  host.append(list);
  const more = el(doc, 'button', '7일 일정과 시장 해석 → 브리핑', 'flow-next-link');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'briefing';
  host.append(more);
}

function renderMyNews(doc, host, root, store, names) {
  const symbols = new Set((names || []).map((row) => row.symbol));
  host.replaceChildren(el(doc, 'h2', '내 종목 뉴스', 'briefing-h2'));
  if (!symbols.size) { host.hidden = true; return; }
  host.hidden = false;
  const items = Array.isArray(store?.getState?.()?.news?.items) ? store.getState().news.items : [];
  const mine = [];
  for (const item of items) {
    const tickers = call(root, 'getDisplayTickers', item, []);
    const hit = (Array.isArray(tickers) ? tickers : []).map((tag) => String(tag).replace(/^\$/, '').toUpperCase()).find((symbol) => symbols.has(symbol));
    if (hit) mine.push({ item, symbol: hit });
    if (mine.length >= 5) break;
  }
  if (!mine.length) { host.append(el(doc, 'p', `최근 뉴스에 ${[...symbols].slice(0, 4).join('·')}${symbols.size > 4 ? ' 등' : ''}을 다룬 기사가 없습니다.`, 'daily-empty')); return; }
  const list = el(doc, 'ul', null, 'daily-news');
  for (const { item, symbol } of mine) {
    const li = el(doc, 'li', null, 'daily-news-item');
    li.append(el(doc, 'span', symbol, 'daily-news-symbol'));
    const title = call(root, 'getDisplayTitle', item, '') || item?.title || '제목 없음';
    const link = String(item?.link || item?.url || '');
    if (/^https?:\/\//.test(link)) {
      const anchor = el(doc, 'a', title, 'daily-news-link');
      anchor.href = link;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      li.append(anchor);
    } else li.append(el(doc, 'span', title, 'daily-news-link'));
    list.append(li);
  }
  host.append(list);
}

export function renderDailyLoop({ documentRef: doc, root, store }) {
  const host = doc?.getElementById('home-daily-loop');
  if (!host) return null;
  const parts = {
    changes: doc.getElementById('home-daily-changes'),
    names: doc.getElementById('home-my-names'),
    schedule: doc.getElementById('home-schedule'),
    news: doc.getElementById('home-my-news')
  };
  const changes = parts.changes ? renderChanges(doc, parts.changes, root?._aioHistory || []) : null;
  const names = parts.names ? renderMyNames(doc, parts.names, root, store) : null;
  if (parts.schedule) renderSchedule(doc, parts.schedule, root);
  if (parts.news) renderMyNews(doc, parts.news, root, store, names?.names || []);
  host.dataset.aioDailyLoopRenderer = 'native';
  return { changes, names };
}
