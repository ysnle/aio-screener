// P1432 (stage 5): the 오늘 daily loop — what changed since the last session, what happened to my
// names, what is scheduled next and which news is about my names — right after the market verdict.
import { buildDailyChanges, buildMyNames } from '../../domain/briefing/daily-diff.js';
import { buildBriefingSchedule, sp500NameMap } from '../../domain/briefing/schedule.js';
import { usWeekendClosed } from '../../domain/market/market-calendar.js';
import { readMarketRegime } from './market-regime.js';
import { emptyState } from './empty-state.js';
import { withObjectParticle } from '../../domain/content/korean-particle.js';
import { el } from './dom.js';
import { asOfChip, frameHead, markFrame } from './section-frame.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { buildKoreaIndexSeries } from '../../domain/market/regime-scenarios.js';
import { deriveQuotePresentation } from '../../domain/market/quote-presentation.js';
import { formatScreenerPrice, screenerMarket } from '../../domain/screener/market-scope.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { pickImportantNews } from '../../domain/briefing/news-picks.js';
import { groupNewsStories } from '../../domain/news/stories.js';
import { selectNewsItems } from '../../state/selectors/news.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { moveNewsList, moveNewsRows } from './market-timeline.js';
import { newsImpactChain, todayChecks } from '../../domain/briefing/event-guide.js';
import { fixKoreanTerms } from '../../domain/briefing/headline-terms.js';
import { macroReleasesFor } from '../../domain/briefing/macro-releases.js';
function call(root, name, arg, fallback) {
  try { const fn = root?.[name]; return typeof fn === 'function' ? (fn(arg) ?? fallback) : fallback; } catch (_) { return fallback; }
}

// v57.79 (UI review): the close tiles and the live strip below showed VIX, 미 10년물, WTI, 달러 and 공포·탐욕 twice with
// different numbers. A tile is now the one place for its measure: it keeps the close-to-close change and, when a live or
// delayed quote is newer than that close, adds a "지금" line on the quote's own basis. The live-strip copy of a measure a
// tile covers ([data-close-measure]) is hidden; a measure without a tile (no comparable close) stays in the strip.
const LIVE_SYMBOL = Object.freeze({ vix: '^VIX', tnx: '^TNX', dxy: 'DX-Y.NYB', wti: 'CL=F' });
const WEEKDAYS = Object.freeze(['일', '월', '화', '수', '목', '금', '토']);
// v58.74 (text audit): the shared sign rule (src/domain/shared/number.js); a zero after rounding carries no sign.
const observedMs = (quote) => { const parsed = Date.parse(quote?.observedAt || ''); return Number.isFinite(parsed) ? parsed : Number(quote?.ts); };
let etDayFormat = null;
function etDate(ms) {
  try { etDayFormat ||= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }); return etDayFormat.format(new Date(ms)); } catch (_) { return null; }
}

// v57.86 (live review): with the shown close given, the 지금 change is measured from it — the provider's own previous close
// (a roll or settlement price) printed WTI -0.75% beside a tile whose close it did not match.
export function liveSinceClose(key, quote, closeDate, closeValue = null) {
  const price = Number(quote?.price);
  const at = observedMs(quote);
  if (!LIVE_SYMBOL[key] || !(price > 0) || !Number.isFinite(at) || !closeDate) return null;
  const day = etDate(at);
  if (!day || day <= closeDate) return null; // the quote is that close (or older): the tile already says it
  const shown = Number(closeValue);
  const base = shown > 0 && price / shown > 0.5 && price / shown < 2 ? shown : null; // a unit mismatch falls back to the provider
  const pct = base ? (price / base - 1) * 100 : Number(quote?.pct);
  const change = !Number.isFinite(pct) ? '' : key === 'tnx' ? signedText(Math.round((base ? price - base : price - price / (1 + pct / 100)) * 100), 0, 'bp') : signedText(pct, 2, '%');
  const value = key === 'tnx' ? `${price.toFixed(2)}%` : price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { text: `지금 ${value}${change ? ` ${change}` : ''}`, pct: Number.isFinite(pct) ? pct : null };
}

// v58.53 개편 v2 (2b): the close comparison is now a folded row under the verdict, so the KPI tiles and the quote row
// stay the visible "now" numbers — nothing is hidden behind a fold the reader has not opened. (Kept as one function so a
// later rule can narrow it again; `covered` is the set of measures the fold compares.)
function syncLiveStrip(doc, covered) {
  for (const node of doc.querySelectorAll('#page-home [data-close-measure]')) { node.hidden = false; node.dataset.closeCompared = covered.has(node.dataset.closeMeasure) ? 'true' : 'false'; }
}

function renderChanges(doc, section, history, root) {
  let host = section;
  const model = buildDailyChanges(history);
  // v58.53 개편 v2 (2b): one disclosure row right under the verdict — the title and the one-line change read stay on
  // the row; the tiles open beneath it. The open state survives the frequent re-render (live quotes, history).
  const wasOpen = !!host.querySelector(':scope > details')?.open;
  const fold = el(doc, 'details', null, 'sx-disclosure home-changes');
  fold.open = wasOpen;
  const summary = el(doc, 'summary', null, 'home-changes-row');
  const heading = el(doc, 'h2', '지난 마감 이후 변화', 'briefing-h2 home-changes-title');
  summary.append(heading);
  fold.append(summary);
  host.replaceChildren(fold);
  // First-users run 4 (phone #1): before the history file arrives the row said there was no record ("기록이 없습니다").
  const reason = !(Array.isArray(history) && history.length) ? '종가 기록을 불러오는 중입니다.' : model.reason;
  if (!model.available) { syncLiveStrip(doc, new Set()); summary.append(el(doc, 'span', reason || '비교 대기', 'home-changes-lead')); fold.append(emptyState(doc, { title: '비교 대기', reason, compact: true })); return model; }
  const gap = Array.isArray(model.missing) && model.missing.length > 0;
  if (gap) heading.textContent = '직전 기록과 달라진 점';
  // v58.79 section frame: the compared closes are the row's as-of chip; a missing day and the live line are its hover.
  const note = asOfChip(doc, '');
  note.classList.add('home-changes-asof');
  summary.append(el(doc, 'span', model.headline, 'home-changes-lead daily-headline'), note);
  const body = el(doc, 'div', null, 'home-changes-body');
  fold.append(body);
  host = body;
  const grid = el(doc, 'div', null, 'daily-moves');
  let liveShown = false;
  for (const move of model.moves) {
    const cell = el(doc, 'div', null, `daily-move${model.big.includes(move.key) ? ' is-big' : ''}`);
    cell.dataset.measure = move.key;
    cell.append(el(doc, 'span', move.label, 'daily-move-label'), el(doc, 'span', move.text, `daily-move-value ${move.text.startsWith('+') ? 'is-up' : move.text.startsWith('-') ? 'is-down' : ''}`)); // v59.45 (R1-05): the printed sign
    if (move.level) cell.append(el(doc, 'span', move.level, 'daily-move-level'));
    // P1724: a Korean index is compared on its own KRX sessions; the cell names that pair.
    if (move.market === 'KR') { cell.dataset.market = 'KR'; cell.append(el(doc, 'span', `한국 ${shortDate(move.from)} → ${shortDate(move.to)}`, 'daily-move-level')); }
    const live = liveSinceClose(move.key, root?._liveData?.[LIVE_SYMBOL[move.key]], model.date, move.close);
    if (live) {
      const line = el(doc, 'span', live.text, 'daily-move-live');
      line.title = '실시간·지연 시세, 등락은 이 칸의 마지막 종가 대비입니다';
      cell.append(line);
      liveShown = true;
    }
    grid.append(cell);
  }
  // P1725: two completed US closes here; a "지금" line is a live/delayed quote measured from the tile's last close (v57.86), so
  // the same asset can still carry opposite signs on the two lines (WTI +2.06% close to close, -1.92% now). The note says which.
  note.textContent = `${shortDate(model.prevDate)} → ${shortDate(model.date)}`;
  note.title = `미국 종가 ${shortDate(model.prevDate)} → ${shortDate(model.date)}${gap ? `, ${model.missing.map(shortDate).join('·')} 기록 없음` : ''}${liveShown ? ', "지금"은 실시간·지연 시세' : ''}`;
  host.append(grid);
  syncLiveStrip(doc, new Set(model.moves.map((move) => move.key)));
  // P1724: measures left out are named on one line with why (no previous close, or the latest close is older).
  if (model.notComparedNotes?.length) host.append(el(doc, 'p', `비교 제외: ${model.notComparedNotes.map((item) => `${item.label}(${item.reason})`).join(', ')}`, 'daily-empty'));
  return model;
}

// v57.79 (UI review): the 코스피 chip in the live strip showed "코스피 현재 5,498.42 -8.49%" with no time beside the
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
    ? '코스피 실시간·지연 시세(한국 시간), 등락은 직전 한국 종가 대비, 위 한국장 줄은 마감 종가 기준입니다'
    : '한국 정규장 확정 종가, 등락은 그 전 거래일 종가 대비';
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
  // v58.53 개편 v2 (2b): a card head (title + count) and one row per name: symbol and name, the notes under them, the
  // last quote and the day's change as a capsule (coloured only when the quote is current, P1579).
  const head = frameHead(doc, { title: '내 종목', titleClass: 'briefing-h2', asOf: model.names.length ? `${model.names.length}개` : '' });
  head.classList.add('daily-card-head');
  markFrame(host, 'home.my-names');
  host.replaceChildren(head);
  host.dataset.empty = model.names.length ? 'false' : 'true';
  if (!model.names.length) {
    // v57.79: words, not the star glyph (the screener button is titled 워치리스트에 추가).
    // first-users run-3 N#15: the one button led to the screener, but a reader with a stock in mind wanted to add it.
    host.append(emptyState(doc, { title: '관심·보유 종목이 없습니다', compact: true, primary: true,
      next: '가진 종목은 포트폴리오에서 추가하고, 지켜볼 종목은 종목 화면이나 스크리너에서 관심 종목에 넣습니다.',
      action: typeof root?.showPage === 'function' ? { label: '포트폴리오에서 추가', onClick: () => root.showPage('portfolio') } : null }));
    return model;
  }
  if (model.summary) host.append(el(doc, 'p', model.summary, 'daily-headline'));
  const rowBySymbol = new Map((Array.isArray(rows) ? rows : []).map((entry) => [String(entry?.sym || entry?.symbol || '').toUpperCase(), entry]));
  const list = el(doc, 'ul', null, 'daily-names');
  for (const row of model.names.slice(0, 8)) {
    const li = el(doc, 'li', null, 'daily-name');
    const button = el(doc, 'button', row.symbol, 'daily-name-symbol');
    button.type = 'button';
    button.dataset.action = 'showTicker';
    button.dataset.arg = row.symbol;
    li.append(button, el(doc, 'span', `${row.name || ''}${row.held ? ', 보유' : ''}`, 'daily-name-name'));
    li.append(namePrice(doc, row.symbol, root?._liveData?.[row.symbol], rowBySymbol.get(row.symbol)));
    li.append(el(doc, 'span', row.dayPct == null ? '' : `${signedText(row.dayPct, 2)}%`, `daily-name-day ${row.daySignalled ? ({ up: 'is-up', down: 'is-down' }[directionOf(row.dayPct, 2)] || '') : ''}`));
    li.append(el(doc, 'span', row.notes.join(', ') || '지표 기록 없음', 'daily-name-notes'));
    list.append(li);
  }
  host.append(list);
  // Codex audit F25 (2026-10-15): more than eight names were cut silently; the count and the way to the rest are said.
  if (model.names.length > 8) {
    const more = el(doc, 'button', `전체 ${model.names.length}개 중 8개 표시, 나머지는 스크리너의 내 워치리스트에서 →`, 'flow-next-link');
    more.type = 'button';
    more.addEventListener('click', () => {
      root?.showPage?.('screener');
      const only = doc.getElementById('scr-watchlist-only');
      if (only && !only.checked) { only.checked = true; only.dispatchEvent(new root.Event('change', { bubbles: true })); }
    });
    host.append(more);
  }
  return model;
}

// Code review (v58.53): the row's price follows the same freshness rule as its change capsule (P1579) — a current or
// delayed quote shows as is; an older quote shows with its observation date (amber, never as today's number); no
// usable quote shows nothing. One price notation with the screener (formatScreenerPrice: ₩ whole won, $ two decimals).
function namePrice(doc, symbol, quote, screenerRow = null) {
  const price = Number(quote?.price);
  const node = el(doc, 'span', '', 'daily-name-price');
  if (!(price > 0)) return node;
  const presentation = deriveQuotePresentation(quote, { symbol });
  const currency = quote?.currency || screenerRow?.currency || (screenerMarket(screenerRow || { sym: symbol }) === 'KR' ? 'KRW' : 'USD');
  const text = formatScreenerPrice(price, currency);
  if (['current', 'delayed'].includes(presentation?.displayState)) { node.textContent = text; return node; }
  const observed = presentation?.observedAt || (Number.isFinite(observedMs(quote)) ? new Date(observedMs(quote)).toISOString() : null);
  if (!observed || presentation?.displayState === 'disputed') return node;
  node.textContent = text;
  node.append(el(doc, 'span', `${shortDate(String(observed).slice(0, 10))} 값`, 'daily-name-price-date'));
  node.classList.add('is-stale');
  node.title = '최근 시세가 아니라 마지막으로 받은 값입니다';
  return node;
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
  // v58.74 (audit): on a weekend three days reached only Monday's minor reports (VZ, WELL); five reach the next week's
  // Wednesday, where the election, FOMC and the largest reports sit.
  const days = usWeekendClosed() ? 5 : 3;
  const fullSchedule = buildBriefingSchedule({
    fomcDecisions: Array.isArray(root.AIO_MACRO_OFFICIAL_SCHEDULES?.['us-fomc']) ? root.AIO_MACRO_OFFICIAL_SCHEDULES['us-fomc'] : [],
    releases: root.AIO_MACRO_CALENDAR?.releases || {},
    snapshot: root.DATA_SNAPSHOT || {},
    // P1737: one Fed-range answer (producer -> FRED -> manual within its window; null once the manual value expired).
    policyRange: typeof root.AIO?.getFedPolicyRange === 'function' ? root.AIO.getFedPolicyRange()?.range || null : root.AIO_EVENT_FRESHNESS_REGISTRY?.fomc?.policyRange || null,
    earnings: root._aioEarningsSnapshot?.earnings || [],
    earningsMeta: root._aioEarningsSnapshot || {},
    names: homeNames(root),
    nowMs: Date.now(),
    days,
    maxEarnings: 4
  });
  const schedule = fullSchedule.filter((row) => !row.passed);
  // v58.79 section frame: each row carries its own KST time, so the head keeps only the window as its chip.
  const head = frameHead(doc, { title: '다가오는 일정', titleClass: 'briefing-h2', asOf: `${days}일`, asOfDetail: `앞으로 ${days}일, 한국 시간` });
  head.classList.add('daily-card-head');
  markFrame(host, 'home.schedule');
  host.replaceChildren(head);
  // Codex audit F26 (2026-10-15): "없습니다" only when the calendars were actually read — a missing macro calendar or an
  // earnings calendar still loading/failed is said as such, not merged into the empty sentence.
  const macroKnown = !!root.AIO_MACRO_CALENDAR?.releases && Object.keys(root.AIO_MACRO_CALENDAR.releases).length > 0;
  const earningsKnown = !!root._aioEarningsSnapshot;
  if (!schedule.length) {
    host.append(el(doc, 'p', !macroKnown ? '발표 일정 자료를 아직 받지 못했습니다. 잠시 뒤 다시 확인합니다.'
      : earningsKnown ? `${days}일 안에 예정된 주요 발표가 없습니다.` : `${days}일 안에 예정된 주요 경제 발표가 없습니다. 실적 발표 일정은 아직 받는 중입니다.`, 'daily-empty'));
    return fullSchedule;
  }
  const list = el(doc, 'ul', null, 'daily-schedule');
  // v59.42: a major registered event (the US midterm) listed by its lead window keeps a place among the five rows.
  const shown = schedule.slice(0, 5);
  for (const row of schedule.slice(5)) if (row.major && !shown.some((item) => item.major)) shown.splice(shown.length - 1, 1, row);
  for (const row of shown) {
    const li = el(doc, 'li', null, `daily-event${row.today ? ' is-today' : ''}`);
    // v58.53 개편 v2 (2b): a date tile (KST weekday + day) leads the row; the full time stays on the row's second line.
    const day = Number.isFinite(row.atMs) ? new Date(row.atMs + 9 * 3600000) : null;
    if (day) {
      const tile = el(doc, 'span', null, 'daily-event-date');
      tile.setAttribute('aria-hidden', 'true');
      tile.append(el(doc, 'span', row.today ? '오늘' : WEEKDAYS[day.getUTCDay()], 'daily-event-dow'), el(doc, 'b', String(day.getUTCDate()), 'daily-event-day'));
      li.append(tile);
    }
    li.append(el(doc, 'span', row.label, 'daily-event-label'), el(doc, 'span', row.when, 'daily-event-when'));
    if (row.sourceTitle) li.title = row.sourceTitle;
    // UI review 2026-10-18: an earnings row's note ("장 전") repeated its own time column; only a note that adds something shows.
    if (row.why && !String(row.when || '').includes(row.why)) li.append(el(doc, 'span', row.why, 'daily-event-why'));
    list.append(li);
  }
  host.append(list);
  // v58.52: the S&P-weight cut and the five-row list both leave reports out; the count says so.
  const hidden = (fullSchedule.omittedEarnings || 0) + Math.max(0, schedule.length - 5);
  // v58.79: the left-out count rides on the one link instead of a sentence above it.
  const more = el(doc, 'button', hidden > 0 ? `7일 일정 ${hidden}건 더 → 브리핑` : '7일 일정과 시장 해석 → 브리핑', 'flow-next-link daily-card-more');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'briefing';
  host.append(more);
  return fullSchedule;
}

// v58.75 (persona review): a news reader opens 오늘 for what happened overnight. One block heads the daily loop: the news
// screen's top three event clusters (pickImportantNews over the same 24h window and grouping, so both screens agree) with
// their publication times, then — when any exist — the same-day headlines that named a stock or theme 오늘 lists as a
// mover (moveNewsRows), then one link to the news screen. No picked story and no matched mover, no block.
let overnightMemo = { items: null, at: 0, picked: [] };
function overnightPicks(root, items, nowMs) {
  if (overnightMemo.items === items && nowMs - overnightMemo.at < 60000) return overnightMemo.picked;
  let picked = [];
  try {
    const model = root?.AIO?.buildNewsSurfaceModel?.('market-news', items, { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode: 'score', nowMs });
    picked = pickImportantNews(groupNewsStories(model?.eligibleItems || model?.items || []), 3);
  } catch (_) { picked = []; }
  overnightMemo = { items, at: nowMs, picked };
  return picked;
}
const kstClock = (ms) => { const d = new Date(ms + 9 * 3600000); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

function renderOvernight(doc, loop, root, store) {
  let host = doc.getElementById('home-overnight');
  const nowMs = Date.now();
  const picked = overnightPicks(root, selectNewsItems(store?.getState?.() || {}), nowMs);
  let moves = [];
  let xr = null;
  try { const interpretation = marketInterpretation(root); xr = interpretation.crossroads; moves = moveNewsRows(root, store, interpretation.flow).filter((row) => row.headline); } catch (_) { moves = []; }
  if (!picked.length && !moves.length) { if (host) host.hidden = true; return; }
  if (!host) {
    host = el(doc, 'section', null, 'daily-block');
    host.id = 'home-overnight';
    host.setAttribute('aria-labelledby', 'home-overnight-title');
    loop.prepend(host);
  }
  host.hidden = false;
  // v58.79 section frame: the times are Korean clock times like every time on 오늘; grouping is the list's own rule.
  const head = frameHead(doc, { title: picked.length ? `밤사이 핵심 ${picked.length}건` : '움직인 종목의 같은 날 보도', titleId: 'home-overnight-title', titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  head.title = '같은 사건은 한 건으로 묶고, 시각은 한국 시간';
  markFrame(host, 'home.overnight');
  const nodes = [head];
  const untranslated = [];
  if (picked.length) {
    const list = el(doc, 'ul', null, 'daily-news');
    for (const item of picked) {
      const li = el(doc, 'li', null, 'daily-news-item');
      const ms = Date.parse(item?.publishedAt || item?.pubDate || '');
      li.append(el(doc, 'span', Number.isFinite(ms) ? kstClock(ms) : '', 'daily-news-symbol'));
      const shown = call(root, 'getDisplayTitle', item, '') || item?.title || '제목 없음';
      // The producer's translation (titleKo) stands in when the browser has none cached yet.
      const text = fixKoreanTerms(item?.title, !/[가-힣]/.test(shown) && /[가-힣]/.test(item?.titleKo || '') ? item.titleKo : shown);
      const related = Array.isArray(item?.storyArticles) && item.storyArticles.length > 1 ? `, 관련 기사 ${item.storyArticles.length}건` : '';
      const link = String(item?.link || item?.url || '');
      const node = el(doc, /^https?:\/\//.test(link) ? 'a' : 'span', `${text}${related}`, 'daily-news-link');
      if (node.tagName === 'A') { node.href = link; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
      node.title = [item?.source, item?.title !== text ? item?.title : null].filter(Boolean).join(', ');
      if (!/[가-힣]/.test(text) && item?.title) untranslated.push([item, node, related]);
      // v58.75 ('고르는 법' E1): a story whose words are a live scenario's subject carries its chain in one small line.
      const chain = newsImpactChain(`${item?.title || ''} ${text}`, xr);
      if (chain) {
        const box = el(doc, 'span', null, 'daily-news-body');
        box.append(node, el(doc, 'span', chain.text, 'daily-news-chain'));
        li.append(box);
      } else li.append(node);
      list.append(li);
    }
    nodes.push(list);
  }
  const moveList = moves.length ? moveNewsList(doc, root, moves, { max: 3, listClass: 'daily-news', timeClass: 'daily-news-symbol', titleClass: 'daily-news-link' }) : null;
  if (moveList) {
    for (const li of moveList.children) li.className = 'daily-news-item';
    // v58.79: a sub-heading, not a caption; that a same-day story is not a confirmed cause stays in its hover.
    const sub = el(doc, 'h3', '움직인 종목과 같은 날 보도', 'daily-headline daily-subhead');
    sub.title = '움직인 종목·테마와 같은 날 나온 보도이며, 원인을 확정하지는 않습니다';
    nodes.push(sub, moveList);
  }
  const more = el(doc, 'button', '전체 뉴스와 채널 소식 → 뉴스', 'flow-next-link daily-card-more');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'market-news';
  nodes.push(more);
  host.replaceChildren(...nodes);
  requestOvernightTranslation(root, untranslated);
}

// v58.75 (persona review): the news page asks the shared translator for its English headlines; 밤사이 핵심 showed the
// same story in English when the home screen was opened first. The same request (autoTranslateNews, deferred during
// boot) runs once per headline and the line is swapped in place when a Korean title arrives.
const overnightAsked = new Set();
function requestOvernightTranslation(root, rows) {
  const pending = rows.filter(([item]) => !overnightAsked.has(item.title));
  if (!pending.length || typeof root?.autoTranslateNews !== 'function') return;
  for (const [item] of pending) overnightAsked.add(item.title);
  let job;
  try { job = root.autoTranslateNews(pending.map(([item]) => item)); } catch (_) { return; }
  Promise.resolve(job).then(() => {
    for (const [item, node, related] of pending) {
      const shown = call(root, 'getDisplayTitle', item, '');
      if (node.isConnected && /[가-힣]/.test(shown)) node.textContent = `${fixKoreanTerms(item.title, shown)}${related}`;
    }
  }).catch(() => {});
}

// v58.75 ('고르는 법' E4): 오늘 확인할 3가지 — the nearest flip condition (the hero tile's first row), the release or report
// due within 36 hours, and what would confirm the lead scenario, read from the models the page already built
// (src/domain/briefing/event-guide.js todayChecks). It sits beside 밤사이 핵심; nothing to check, no block.
function flipCheck(regime) {
  const row = heroFlipRows(regime, 1)[0];
  if (!row) return null;
  const d = row.distance;
  if (!d) return { text: `${row.title} ${row.stateLabel}: ${row.flip}`, sub: null };
  const lead = d.parts ? `${d.parts.subject} ${d.parts.mark} ${d.parts.verb}` : d.condition;
  return { text: `${lead} ${row.title} → ${d.towardLabel}`, sub: [`남은 거리 ${d.text}`, d.sessions != null ? `보통 하루 움직임의 ${d.sessions}배` : null].filter(Boolean).join(', ') };
}
function renderTodayChecks(doc, loop, root, regime, schedule) {
  let host = doc.getElementById('home-checks');
  let xr = null;
  try { xr = marketInterpretation(root).crossroads; } catch (_) { xr = null; }
  const rows = todayChecks({ flip: flipCheck(regime), schedule, xr, nowMs: Date.now() });
  if (!rows.length) { if (host) host.hidden = true; return; }
  if (!host) {
    host = el(doc, 'section', null, 'daily-block');
    host.id = 'home-checks';
    host.setAttribute('aria-labelledby', 'home-checks-title');
    // v59.44 (owner 2026-10-30): after the schedule (and the AI-chain block when it is painted), before 내 종목.
    const anchor = doc.getElementById('home-ai-chain') || doc.getElementById('home-schedule');
    if (anchor?.parentElement === loop) anchor.after(host); else loop.append(host);
  }
  host.hidden = false;
  const head = frameHead(doc, { title: `오늘 확인할 ${rows.length}가지`, titleId: 'home-checks-title', titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  markFrame(host, 'home.checks');
  const list = el(doc, 'ol', null, 'home-checks');
  for (const row of rows) {
    const li = el(doc, 'li', null, 'home-check');
    li.dataset.kind = row.kind;
    li.append(el(doc, 'span', row.label, 'home-check-label'), el(doc, 'span', row.text, 'home-check-text'));
    if (row.sub) li.append(el(doc, 'span', row.sub, 'home-check-sub'));
    list.append(li);
  }
  host.replaceChildren(head, list);
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

// v58.53 개편 v2 (2b): the hero's right tile — "판단이 바뀌는 조건".
// v58.55 (owner 2026-10-20): each US axis now carries the distance to its nearest flip (regime axis.flipDistance, computed
// by the axis rule itself in market-read.js). The tile lists the three axes nearest to changing — the distance divided by
// the indicator's average daily move over 20 sessions, smallest first ("가까운 순") — each as one short line with the
// distance chip; a distance that still needs a condition no number measures ranks after the measured ones. The full rule
// sentences sit in a fold under the list. Without any distance (data missing) the tile falls back to the v58.53 order:
// one-sided axes first, full rule sentence, board order. The Korea FX reference stays out (outside the US tally).
const FLIP_ORDER = Object.freeze({ burden: 0, favorable: 1, neutral: 2 });
const FLIP_MARK = Object.freeze({ burden: ['↑', 'is-up', '나아지는 조건'], favorable: ['↓', 'is-down', '약해지는 조건'], neutral: ['↑↓', 'is-both', '양쪽 조건'] });
const DISTANCE_MARK = Object.freeze({ improve: ['↑', 'is-up', '나아지는 쪽'], worsen: ['↓', 'is-down', '약해지는 쪽'] });
export function heroFlipRows(regime, limit = 3) {
  if (!regime?.available || !Array.isArray(regime.axes)) return [];
  const us = regime.axes.map((axis, index) => ({ axis, index })).filter(({ axis }) => axis.id !== 'korea' && axis.state in FLIP_ORDER);
  const measured = us.filter(({ axis }) => axis.flipDistance && axis.flipDistance.text);
  const rank = ({ axis }) => [axis.flipDistance.needsMore ? 1 : 0, axis.flipDistance.sessions ?? Infinity];
  const near = measured
    .sort((a, b) => { const [a1, a2] = rank(a), [b1, b2] = rank(b); return a1 - b1 || a2 - b2 || a.index - b.index; })
    .slice(0, limit)
    .map(({ axis }) => ({ id: axis.id, title: axis.title, state: axis.state, stateLabel: axis.stateLabel, flip: axis.flip ? String(axis.flip) : '', distance: axis.flipDistance }));
  // v58.55 review: the slots measured axes leave are filled in the v58.53 order (one-sided first, board order) with the
  // full rule sentence, marked 거리 계산 불가 — an axis without a distance is not dropped from the tile.
  const rest = us
    .filter(({ axis }) => axis.flip && !near.some((row) => row.id === axis.id))
    .sort((a, b) => FLIP_ORDER[a.axis.state] - FLIP_ORDER[b.axis.state] || a.index - b.index)
    .slice(0, Math.max(0, limit - near.length))
    .map(({ axis }) => ({ id: axis.id, title: axis.title, state: axis.state, stateLabel: axis.stateLabel, flip: String(axis.flip), distance: null, unmeasured: near.length > 0 }));
  return [...near, ...rest];
}

function flipDistanceLine(doc, row) {
  const d = row.distance;
  const text = el(doc, 'span', null, 'home-flip-text');
  const parts = d.parts || null;
  if (parts) text.append(doc.createTextNode(`${parts.subject} `), el(doc, 'b', parts.mark, 'home-flip-num'), doc.createTextNode(` ${parts.verb} `));
  else text.append(doc.createTextNode(`${d.condition} `));
  text.append(el(doc, 'b', `${row.title} → ${d.towardLabel}`, 'home-flip-axis'));
  for (const item of d.also || []) text.append(el(doc, 'span', `함께 필요, ${item.condition}${item.text ? ` (${item.text})` : ''}`, 'home-flip-also'));
  return text;
}

function renderHeroFlips(doc, regime) {
  const tile = doc.getElementById('home-hero-flips');
  if (!tile) return;
  const rows = heroFlipRows(regime);
  tile.hidden = !rows.length;
  if (!rows.length) { tile.replaceChildren(); return; }
  const measured = rows.some((row) => row.distance);
  const head = el(doc, 'div', null, 'home-flips-head');
  const title = el(doc, 'h2', '판단이 바뀌는 조건', 'sx-kicker home-flips-title');
  title.id = 'home-hero-flips-title';
  head.append(title);
  // v58.56 (re-audit #23): the distances are measured from the last US close, not the live quotes beside the tile.
  // v58.79 (layout over captions): the page subtitle carries that close and the list's order is visible, so the
  // "종가 기준, 가까운 순" line became the title's hover; each chip's hover still names its close.
  if (measured) title.title = `거리는 ${regime.asOf ? `${shortDate(regime.asOf)} ` : '마지막 '}미국 종가로 잽니다(실시간 시세 아님), 조건까지 남은 거리를 그 지표의 최근 20거래일 평균 하루 변동폭으로 나눠, 작은 순서로 3개를 보여줍니다`;
  const list = el(doc, 'ul', null, 'home-flips');
  for (const row of rows) {
    const li = el(doc, 'li', null, 'home-flip');
    li.dataset.axis = row.id;
    if (row.distance) {
      const [mark, tone, words] = DISTANCE_MARK[row.distance.direction] || DISTANCE_MARK.worsen;
      const badge = el(doc, 'span', mark, `home-flip-mark ${tone}`);
      badge.setAttribute('aria-label', `${row.title} ${row.stateLabel} → ${row.distance.towardLabel}, ${words}`);
      const chip = el(doc, 'span', row.distance.text, 'home-flip-chip');
      chip.title = `${regime.asOf ? `${shortDate(regime.asOf)} ` : ''}종가 기준, 지금 ${row.title} ${row.stateLabel}, 기준까지 ${row.distance.text}${row.distance.sessions != null ? `, 최근 20거래일 평균 하루 변동폭의 ${row.distance.sessions}배` : ''}${row.distance.needsMore ? ', 숫자로 잴 수 없는 조건이 함께 필요' : ''}`;
      li.dataset.direction = row.distance.direction;
      // v58.75 (persona review): the "how far in ordinary days" measure lived only in the hover (no way to see it on a
      // phone); it sits under the chip in small type.
      const dist = el(doc, 'span', null, 'home-flip-dist');
      dist.append(chip);
      // v58.80 (first-users bundle 2): "-1.8%p / 평소 하루 변동의 0.9배" did not say what either number measured.
      chip.textContent = `남은 거리 ${row.distance.text}`;
      if (row.distance.sessions != null) dist.append(el(doc, 'span', `보통 하루 움직임의 ${row.distance.sessions}배`, 'home-flip-sessions'));
      li.append(badge, flipDistanceLine(doc, row), dist);
    } else {
      const [mark, tone, words] = FLIP_MARK[row.state];
      const badge = el(doc, 'span', mark, `home-flip-mark ${tone}`);
      badge.setAttribute('aria-label', `${row.title} ${row.stateLabel} — ${words}`);
      const text = el(doc, 'span', null, 'home-flip-text');
      text.append(el(doc, 'b', `${row.title} ${row.stateLabel}`, 'home-flip-axis'), doc.createTextNode(` ${row.flip}`));
      li.append(badge, text);
      if (row.unmeasured) {
        li.dataset.unmeasured = 'true';
        const none = el(doc, 'span', '거리 계산 불가', 'home-flip-none');
        none.title = '이 지표는 기준까지의 거리를 계산할 입력이 없어 조건 문장만 보여줍니다';
        li.append(none);
      }
    }
    list.append(li);
  }
  const nodes = [head, list];
  // The full rule of each listed axis (every condition, both directions), one level down.
  const full = rows.filter((row) => row.distance && row.flip);
  if (full.length) {
    const fold = el(doc, 'details', null, 'sx-disclosure home-flips-full');
    fold.append(el(doc, 'summary', '전체 조건 보기', 'home-flips-full-summary'));
    const rules = el(doc, 'dl', null, 'home-flips-rules');
    for (const row of full) rules.append(el(doc, 'dt', `${row.title} ${row.stateLabel}`), el(doc, 'dd', row.flip));
    fold.append(rules);
    nodes.push(fold);
  }
  // v58.79: the "6개 축 근거 자세히" link left — the hero's 6개 축 근거 fold and the participation card's row lead there.
  tile.replaceChildren(...nodes);
}

// v58.53 개편 v2 (2b): 오늘 is the 3-second/30-second summary. The forward block (#home-outlook anchor + #home-crossroads)
// and today's guide (#home-guide) that market-regime.js renders after the close comparison are moved, in their order,
// into the one fold at the end of the page. Once inside, renderCrossroadsCompact keeps its box in place and
// renderHomeGuide re-anchors after the crossroads box, so they stay together in the fold.
function foldHomeDepth(doc) {
  const body = doc.getElementById('home-depth-body');
  if (!body) return;
  for (const id of ['home-outlook', 'home-crossroads', 'home-guide']) {
    const node = doc.getElementById(id);
    if (node && node.parentElement !== body) body.append(node);
  }
  const fold = doc.getElementById('home-depth-fold');
  if (fold) fold.hidden = ![...body.children].some((node) => !node.hidden);
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
  // v58.53 개편 v2 (2b/5a): the sector bars moved to 브리핑 (P1641's "섹터 하루 등락"); 오늘 stays the short summary.
  doc.getElementById('home-sector-moves')?.remove();
  renderHeroFlips(doc, regime || readMarketRegime(root));
  foldHomeDepth(doc);
  const names = parts.names ? renderMyNames(doc, parts.names, root, store, regime) : null;
  const schedule = parts.schedule ? renderSchedule(doc, parts.schedule, root) : [];
  if (parts.news) renderMyNews(doc, parts.news, root, store, names?.names || []);
  renderOvernight(doc, host, root, store); // v58.75 (persona review)
  // v59.42: FOMC and mover earnings briefs (a lazy chunk: the block and its artifact are not part of the boot set).
  // v59.44: the macro releases are read here, in the boot set where the macro board already is, so the lazy chunk does
  // not pull indicators.js into a new shared chunk.
  const macro = () => macroReleasesFor(root);
  import('./event-briefs.js').then(({ paintHomeBriefs }) => {
    const repaint = () => { if (doc.getElementById('page-home')?.classList?.contains('active')) paintHomeBriefs(doc, root, host, null, macro()); };
    paintHomeBriefs(doc, root, host, repaint, macro());
  }).catch(() => {});
  // v59.44: the AI supply chain by group (a lazy chunk), ahead of the release summaries.
  import('./ai-chain-flow.js').then(({ paintHomeAiChain }) => paintHomeAiChain(doc, root, host)).catch(() => {});
  renderTodayChecks(doc, host, root, regime || readMarketRegime(root), schedule); // v58.75 ('고르는 법' E4)
  host.dataset.aioDailyLoopRenderer = 'native';
  return { changes, names };
}
