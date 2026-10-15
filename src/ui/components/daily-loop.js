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
import { buildKoreaIndexSeries } from '../../domain/market/regime-scenarios.js';

function call(root, name, arg, fallback) {
  try { const fn = root?.[name]; return typeof fn === 'function' ? (fn(arg) ?? fallback) : fallback; } catch (_) { return fallback; }
}

// v57.79 (UI review): the close tiles and the live strip below showed VIX, 미 10년물, WTI, 달러 and 공포·탐욕 twice with
// different numbers. A tile is now the one place for its measure: it keeps the close-to-close change and, when a live or
// delayed quote is newer than that close, adds a "지금" line on the quote's own basis. The live-strip copy of a measure a
// tile covers ([data-close-measure]) is hidden; a measure without a tile (no comparable close) stays in the strip.
const LIVE_SYMBOL = Object.freeze({ vix: '^VIX', tnx: '^TNX', dxy: 'DX-Y.NYB', wti: 'CL=F' });
const signedText = (value, digits, unit) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
const observedMs = (quote) => { const parsed = Date.parse(quote?.observedAt || ''); return Number.isFinite(parsed) ? parsed : Number(quote?.ts); };
let etDayFormat = null;
function etDate(ms) {
  try { etDayFormat ||= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }); return etDayFormat.format(new Date(ms)); } catch (_) { return null; }
}

export function liveSinceClose(key, quote, closeDate) {
  const price = Number(quote?.price);
  const at = observedMs(quote);
  if (!LIVE_SYMBOL[key] || !(price > 0) || !Number.isFinite(at) || !closeDate) return null;
  const day = etDate(at);
  if (!day || day <= closeDate) return null; // the quote is that close (or older): the tile already says it
  const pct = Number(quote?.pct);
  const change = !Number.isFinite(pct) ? '' : key === 'tnx' ? signedText(Math.round((price - price / (1 + pct / 100)) * 100), 0, 'bp') : signedText(pct, 2, '%');
  const value = key === 'tnx' ? `${price.toFixed(2)}%` : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { text: `지금 ${value}${change ? ` ${change}` : ''}`, pct: Number.isFinite(pct) ? pct : null };
}

function syncLiveStrip(doc, covered) {
  for (const node of doc.querySelectorAll('#page-home [data-close-measure]')) node.hidden = covered.has(node.dataset.closeMeasure);
}

function renderChanges(doc, host, history, root) {
  const model = buildDailyChanges(history);
  host.replaceChildren(el(doc, 'h2', '지난 마감 이후 변화', 'briefing-h2'));
  host.querySelector('h2').style.flexWrap = 'wrap'; // v57.76: full-width under the verdict, the long note wraps below the title on a phone
  if (!model.available) { syncLiveStrip(doc, new Set()); host.append(emptyState(doc, { title: '비교 대기', reason: model.reason, compact: true })); return model; }
  const gap = Array.isArray(model.missing) && model.missing.length > 0;
  if (gap) host.querySelector('h2').firstChild.textContent = '직전 기록과 달라진 점';
  const note = el(doc, 'span', '', 'briefing-h2-note');
  host.querySelector('h2').append(note);
  host.append(el(doc, 'p', model.headline, 'daily-headline'));
  const grid = el(doc, 'div', null, 'daily-moves');
  let liveShown = false;
  for (const move of model.moves) {
    const cell = el(doc, 'div', null, `daily-move${model.big.includes(move.key) ? ' is-big' : ''}`);
    cell.dataset.measure = move.key;
    cell.append(el(doc, 'span', move.label, 'daily-move-label'), el(doc, 'span', move.text, `daily-move-value ${move.value > 0 ? 'is-up' : move.value < 0 ? 'is-down' : ''}`));
    if (move.level) cell.append(el(doc, 'span', move.level, 'daily-move-level'));
    // P1724: a Korean index is compared on its own KRX sessions; the cell names that pair.
    if (move.market === 'KR') { cell.dataset.market = 'KR'; cell.append(el(doc, 'span', `한국 ${shortDate(move.from)} → ${shortDate(move.to)}`, 'daily-move-level')); }
    const live = liveSinceClose(move.key, root?._liveData?.[LIVE_SYMBOL[move.key]], model.date);
    if (live) {
      const line = el(doc, 'span', live.text, 'daily-move-live');
      line.title = '실시간·지연 시세 · 등락은 그 시세의 직전 종가 대비입니다';
      cell.append(line);
      liveShown = true;
    }
    grid.append(cell);
  }
  // P1725: two completed US closes here; a "지금" line is a live/delayed quote against its own previous close, so the same
  // asset can carry opposite signs on the two lines (WTI +2.06% close to close, -1.92% now). The note says which.
  note.textContent = `미국 종가 ${shortDate(model.prevDate)} → ${shortDate(model.date)}${gap ? ` · ${model.missing.map(shortDate).join('·')} 기록 없음` : ''}${liveShown ? ' · 지금 줄은 그 뒤 실시간·지연 시세' : ''}`;
  host.append(grid);
  syncLiveStrip(doc, new Set(model.moves.map((move) => move.key)));
  // P1724: measures left out are named on one line with why (no previous close, or the latest close is older).
  if (model.notComparedNotes?.length) host.append(el(doc, 'p', `비교 제외: ${model.notComparedNotes.map((item) => `${item.label}(${item.reason})`).join(' · ')}`, 'daily-empty'));
  return model;
}

// v57.79 (UI review): the 코스피 chip in the live strip showed "코스피 현재 5,498.42 −8.49%" with no time beside the
// "한국장 10/14 마감 · 코스피 6,008.81" line. The chip now names its basis: a live/delayed quote carries its KST time, and
// it is used only when it is newer than the last completed KRX close and its own previous close agrees with that close
// (within 5%); otherwise the chip shows that close with its date, or hides when there is neither.
export const KR_CHIP_GUARD_PCT = 5;
const kstParts = (ms) => { const iso = new Date(ms + 9 * 3600000).toISOString(); return { date: iso.slice(0, 10), time: iso.slice(11, 16) }; };
export function koreaQuoteChip({ live = null, closes = [] } = {}) {
  const last = closes.at(-1) || null;
  const prev = closes.at(-2) || null;
  const closeChip = (reason) => last ? { basis: 'close', reason, date: last.date, value: last.value, pct: prev?.value > 0 ? (last.value / prev.value - 1) * 100 : null } : null;
  const price = Number(live?.price);
  const at = observedMs(live);
  if (!(price > 0) || !Number.isFinite(at)) return closeChip('no-live');
  const when = kstParts(at);
  if (last && when.date < last.date) return closeChip('live-older');
  if (last && when.date === last.date) return closeChip('session-closed');
  const pct = Number(live?.pct);
  const livePrev = Number(live?.regularMarketPreviousClose) > 0 ? Number(live.regularMarketPreviousClose) : Number.isFinite(pct) ? price / (1 + pct / 100) : null;
  const off = (a, b) => Math.abs(a / b - 1) * 100 > KR_CHIP_GUARD_PCT;
  if (last && (livePrev ? off(livePrev, last.value) : off(price, last.value))) return closeChip('live-disagrees');
  return { basis: 'live', reason: 'live', date: when.date, time: when.time, value: price, pct: Number.isFinite(pct) ? pct : null, delayed: /DELAYED/i.test(String(live?.marketState || live?.session || '')) };
}

function renderKoreaQuote(doc, root) {
  const chip = doc.getElementById('home-kospi-chip');
  if (!chip) return null;
  const model = koreaQuoteChip({ live: root?._liveData?.['^KS11'] || null, closes: buildKoreaIndexSeries(root?._aioHistory || [], 'kospi') });
  chip.hidden = !model;
  if (!model) return null;
  const [, month, day] = model.date.split('-').map(Number);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('home-kospi-label', model.basis === 'live' ? `코스피 ${month}/${day} ${model.time}${model.delayed ? ' 지연' : ''}` : `코스피 ${month}/${day} 종가`);
  set('home-kospi-value', model.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const change = set('home-kospi-chg', model.pct == null ? '' : signedText(model.pct, 2, '%'));
  if (change) {
    change.classList.remove('pos', 'neg', 'a11y-up', 'a11y-dn', 'a11y-hold');
    if (model.pct != null) change.classList.add(model.pct >= 0 ? 'pos' : 'neg', model.pct > 0 ? 'a11y-up' : model.pct < 0 ? 'a11y-dn' : 'a11y-hold');
  }
  chip.title = model.basis === 'live'
    ? '코스피 실시간·지연 시세(한국 시간) · 등락은 직전 한국 종가 대비 · 위 한국장 줄은 마감 종가 기준입니다'
    : '한국 정규장 확정 종가 · 등락은 그 전 거래일 종가 대비';
  chip.dataset.basis = model.basis;
  chip.dataset.reason = model.reason;
  return model;
}

function renderMyNames(doc, host, root, store, regime = null) {
  const state = store?.getState?.() || {};
  const holdings = Array.isArray(state?.portfolio?.holdings) ? state.portfolio.holdings : [];
  const symbols = call(root, '_aioWatchlistGet', undefined, []);
  const storeRows = state?.screener?.rows;
  const rows = Array.isArray(storeRows) && storeRows.length ? storeRows : call(root, '_aioGetCanonicalScreenerRows', undefined, []);
  const breadthState = (regime || readMarketRegime(root))?.axes?.find((axis) => axis.id === 'breadth')?.state || null;
  const model = buildMyNames({ symbols, rows, live: root?._liveData || {}, holdings, breadthState });
  host.replaceChildren(el(doc, 'h2', '내 종목', 'briefing-h2'));
  if (!model.names.length) {
    // v57.79: words, not the star glyph (the screener button is titled 워치리스트에 추가).
    host.append(emptyState(doc, { title: '관심·보유 종목이 없습니다', reason: '스크리너나 종목 화면에서 관심 종목(워치리스트)에 추가한 종목이 여기에서 매일 정리됩니다.', compact: true }));
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

// v57.78 perf: `regime` is the one home already computed this render (renderHomeRegime returns it); without it the
// loop reads the regime itself, so a caller that renders the loop alone sees the same breadth state.
export function renderDailyLoop({ documentRef: doc, root, store, regime = null }) {
  const host = doc?.getElementById('home-daily-loop');
  if (!host) return null;
  const parts = {
    changes: doc.getElementById('home-daily-changes'),
    names: doc.getElementById('home-my-names'),
    schedule: doc.getElementById('home-schedule'),
    news: doc.getElementById('home-my-news')
  };
  const changes = parts.changes ? renderChanges(doc, parts.changes, root?._aioHistory || [], root) : null;
  renderKoreaQuote(doc, root); // v57.79: the live-strip 코스피 chip names its basis
  renderSectorMoves({ documentRef: doc, root, anchor: host }); // P1641: after the daily loop grid
  const names = parts.names ? renderMyNames(doc, parts.names, root, store, regime) : null;
  if (parts.schedule) renderSchedule(doc, parts.schedule, root);
  if (parts.news) renderMyNews(doc, parts.news, root, store, names?.names || []);
  host.dataset.aioDailyLoopRenderer = 'native';
  return { changes, names };
}
