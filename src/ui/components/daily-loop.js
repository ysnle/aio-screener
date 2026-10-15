// P1432 (stage 5): the 오늘 daily loop — what changed since the last session, what happened to my
// names, what is scheduled next and which news is about my names — right after the market verdict.
import { buildDailyChanges, buildMyNames } from '../../domain/briefing/daily-diff.js';
import { buildBriefingSchedule, sp500NameMap } from '../../domain/briefing/schedule.js';
import { readMarketRegime } from './market-regime.js';
import { renderSectorMoves } from './sector-moves.js';
import { emptyState } from './empty-state.js';
import { withObjectParticle } from '../../domain/content/korean-particle.js';
import { el } from './dom.js';
import { shortDate } from '../../domain/content/date-labels.js';

function call(root, name, arg, fallback) {
  try { const fn = root?.[name]; return typeof fn === 'function' ? (fn(arg) ?? fallback) : fallback; } catch (_) { return fallback; }
}

function renderChanges(doc, host, history) {
  const model = buildDailyChanges(history);
  host.replaceChildren(el(doc, 'h2', '지난 마감 이후 변화', 'briefing-h2'));
  host.querySelector('h2').style.flexWrap = 'wrap'; // v57.76: full-width under the verdict, the long note wraps below the title on a phone
  if (!model.available) { host.append(emptyState(doc, { title: '비교 대기', reason: model.reason, compact: true })); return model; }
  const gap = Array.isArray(model.missing) && model.missing.length > 0;
  if (gap) host.querySelector('h2').firstChild.textContent = '직전 기록과 달라진 점';
  // P1725: the live strip shows live/delayed quotes against each quote's own previous close; this block compares two
  // completed US closes, so the same asset can carry opposite signs (WTI +2.06% here, -1.92% live). The note says which.
  // v57.76: this block now sits directly under the verdict, above the live strip.
  host.querySelector('h2').append(el(doc, 'span', `미국 종가 ${shortDate(model.prevDate)} → ${shortDate(model.date)}${gap ? ` · ${model.missing.map(shortDate).join('·')} 기록 없음` : ''} · 아래 실시간 시세의 등락과 기간이 다릅니다`, 'briefing-h2-note'));
  host.append(el(doc, 'p', model.headline, 'daily-headline'));
  const grid = el(doc, 'div', null, 'daily-moves');
  for (const move of model.moves) {
    const cell = el(doc, 'div', null, `daily-move${model.big.includes(move.key) ? ' is-big' : ''}`);
    cell.dataset.measure = move.key;
    cell.append(el(doc, 'span', move.label, 'daily-move-label'), el(doc, 'span', move.text, `daily-move-value ${move.value > 0 ? 'is-up' : move.value < 0 ? 'is-down' : ''}`));
    if (move.level) cell.append(el(doc, 'span', move.level, 'daily-move-level'));
    // P1724: a Korean index is compared on its own KRX sessions; the cell names that pair.
    if (move.market === 'KR') { cell.dataset.market = 'KR'; cell.append(el(doc, 'span', `한국 ${shortDate(move.from)} → ${shortDate(move.to)}`, 'daily-move-level')); }
    grid.append(cell);
  }
  host.append(grid);
  // P1724: measures left out are named on one line with why (no previous close, or the latest close is older).
  if (model.notComparedNotes?.length) host.append(el(doc, 'p', `비교 제외: ${model.notComparedNotes.map((item) => `${item.label}(${item.reason})`).join(' · ')}`, 'daily-empty'));
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
    li.append(el(doc, 'span', row.dayPct == null ? '' : `${row.dayPct >= 0 ? '+' : ''}${row.dayPct.toFixed(2)}%`, `daily-name-day ${row.daySignalled ? (row.dayPct > 0 ? 'is-up' : row.dayPct < 0 ? 'is-down' : '') : ''}`));
    li.append(el(doc, 'span', row.notes.join(' · ') || '지표 기록 없음', 'daily-name-notes'));
    list.append(li);
  }
  host.append(list);
  return model;
}

// T16 (expert review 2026-10-13): the home schedule passed names: {} so every earnings row was filtered out, and it
// never loaded the calendar. It now uses the briefing's S&P 500 name list and requests the calendar once itself.
function homeNames(root) {
  if (root._aioSp500Names) return root._aioSp500Names;
  const names = sp500NameMap(root.SCREENER_DB);
  if (Object.keys(names).length) root._aioSp500Names = names;
  return names;
}

function requestEarnings(doc, host, root) {
  const nowMs = Date.now();
  if (root._aioEarningsSnapshot || typeof root._fetchEarningsCalendarSnapshot !== 'function' || root._aioBriefingEarningsRequested || nowMs - (Number(root._aioBriefingEarningsRequestedAt) || 0) < 60000) return;
  root._aioBriefingEarningsRequested = true;
  root._aioBriefingEarningsRequestedAt = nowMs;
  Promise.resolve(root._fetchEarningsCalendarSnapshot()).then((snap) => { if (snap && !root._aioEarningsSnapshot) root._aioEarningsSnapshot = snap; }).catch(() => {}).finally(() => {
    root._aioBriefingEarningsRequested = false;
    if (root._aioEarningsSnapshot && host.isConnected !== false && doc.getElementById('page-home')?.classList?.contains('active')) renderSchedule(doc, host, root);
  });
}

function renderSchedule(doc, host, root) {
  requestEarnings(doc, host, root);
  const schedule = buildBriefingSchedule({
    fomcDecisions: Array.isArray(root.AIO_MACRO_OFFICIAL_SCHEDULES?.['us-fomc']) ? root.AIO_MACRO_OFFICIAL_SCHEDULES['us-fomc'] : [],
    releases: root.AIO_MACRO_CALENDAR?.releases || {},
    snapshot: root.DATA_SNAPSHOT || {},
    // P1737: one Fed-range answer (producer -> FRED -> manual within its window; null once the manual value expired).
    policyRange: typeof root.AIO?.getFedPolicyRange === 'function' ? root.AIO.getFedPolicyRange()?.range || null : root.AIO_EVENT_FRESHNESS_REGISTRY?.fomc?.policyRange || null,
    earnings: root._aioEarningsSnapshot?.earnings || [],
    earningsMeta: root._aioEarningsSnapshot || {},
    names: homeNames(root),
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
    if (row.sourceTitle) li.title = row.sourceTitle;
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
  if (!mine.length) { host.append(el(doc, 'p', `최근 뉴스에 ${withObjectParticle(`${[...symbols].slice(0, 4).join('·')}${symbols.size > 4 ? ' 등' : ''}`)} 다룬 기사가 없습니다.`, 'daily-empty')); return; }
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
  renderSectorMoves({ documentRef: doc, root, anchor: host }); // P1641: after the daily loop grid
  const names = parts.names ? renderMyNames(doc, parts.names, root, store) : null;
  if (parts.schedule) renderSchedule(doc, parts.schedule, root);
  if (parts.news) renderMyNews(doc, parts.news, root, store, names?.names || []);
  host.dataset.aioDailyLoopRenderer = 'native';
  return { changes, names };
}
