// P1432 (stage 5): the 오늘 daily loop — the names I hold or watch and their news, the hero's "판단이 바뀌는 조건" tile with
// the next scheduled events, the AI supply-chain visual and one link row to the screens that hold the rest.
// v59.51 (content audit 2026-10-31): 밤사이 핵심, 주요 발표 요약, 다가오는 일정, 오늘 확인할 3가지 and "지난 마감 이후 변화" left
// 오늘 — each repeated a block on 뉴스, 브리핑 or the hero (same pickers, same rows). The links row says where they are.
import { buildMyNames } from '../../domain/briefing/daily-diff.js';
import { buildBriefingSchedule, sp500NameMap } from '../../domain/briefing/schedule.js';
import { EVENT_BRIEFS } from '../../data/event-artifacts.js';
import { usWeekendClosed } from '../../domain/market/market-calendar.js';
import { readMarketRegime } from './market-regime.js';
import { withObjectParticle } from '../../domain/content/korean-particle.js';
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { buildKoreaIndexSeries } from '../../domain/market/regime-scenarios.js';
import { deriveQuotePresentation } from '../../domain/market/quote-presentation.js';
import { formatScreenerPrice, screenerMarket } from '../../domain/screener/market-scope.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { macroReleasesFor } from '../../domain/briefing/macro-releases.js';
function call(root, name, arg, fallback) {
  try { const fn = root?.[name]; return typeof fn === 'function' ? (fn(arg) ?? fallback) : fallback; } catch (_) { return fallback; }
}

const observedMs = (quote) => { const parsed = Date.parse(quote?.observedAt || ''); return Number.isFinite(parsed) ? parsed : Number(quote?.ts); };

// v57.79 (UI review): the 코스피 chip names its basis: a live/delayed quote carries its KST time, and it is used only when
// it is newer than the last completed KRX close and its own previous close agrees with that close (within 5%); otherwise
// the model is that close with its date, or null when there is neither.
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

// v59.51: the chip shows only a live KOSPI quote — the completed KRX close is the hero's Korea line, so a close chip was the
// third 코스피 on the page.
function renderKoreaQuote(doc, root) {
  const chip = doc.getElementById('home-kospi-chip');
  if (!chip) return null;
  const model = koreaQuoteChip({ live: root?._liveData?.['^KS11'] || null, closes: buildKoreaIndexSeries(root?._aioHistory || [], 'kospi') });
  chip.hidden = model?.basis !== 'live';
  if (chip.hidden) return model;
  const [, month, day] = model.date.split('-').map(Number);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('home-kospi-label', `코스피 ${month}/${day} ${model.time}${model.delayed ? ' 지연' : ''}`);
  set('home-kospi-value', model.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const change = set('home-kospi-chg', model.pct == null ? '' : signedText(model.pct, 2, '%'));
  if (change) {
    change.classList.remove('pos', 'neg', 'a11y-up', 'a11y-dn', 'a11y-hold');
    if (model.pct != null) change.classList.add(model.pct >= 0 ? 'pos' : 'neg', model.pct > 0 ? 'a11y-up' : model.pct < 0 ? 'a11y-dn' : 'a11y-hold');
  }
  chip.title = '코스피 실시간·지연 시세(한국 시간), 등락은 직전 한국 종가 대비, 위 한국 줄은 마감 종가 기준입니다';
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
  const head = frameHead(doc, { title: '내 종목', titleClass: 'briefing-h2', asOf: model.names.length ? `${model.names.length}개` : '' });
  head.classList.add('daily-card-head');
  markFrame(host, 'home.my-names');
  host.replaceChildren(head);
  host.dataset.empty = model.names.length ? 'false' : 'true';
  if (!model.names.length) {
    // v59.51 (content audit): an empty list is one action, not a sentence about two screens.
    const add = el(doc, 'button', '관심·보유 종목 추가 → 포트폴리오', 'flow-next-link daily-card-more');
    add.type = 'button';
    add.dataset.action = 'showPage';
    add.dataset.arg = 'portfolio';
    host.append(add);
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

// T16 (expert review 2026-10-13): the schedule uses the briefing's S&P 500 name list and requests the calendar once itself.
function homeNames(root) {
  if (root._aioSp500Names) return root._aioSp500Names;
  const names = sp500NameMap(root.SCREENER_DB);
  if (Object.keys(names).length) root._aioSp500Names = names;
  return names;
}

function requestEarnings(doc, root, repaint) {
  const nowMs = Date.now();
  if (root._aioEarningsSnapshot || typeof root._fetchEarningsCalendarSnapshot !== 'function' || root._aioBriefingEarningsRequested || nowMs - (Number(root._aioBriefingEarningsRequestedAt) || 0) < 60000) return;
  root._aioBriefingEarningsRequested = true;
  root._aioBriefingEarningsRequestedAt = nowMs;
  Promise.resolve(root._fetchEarningsCalendarSnapshot()).then((snap) => { if (snap && !root._aioEarningsSnapshot) root._aioEarningsSnapshot = snap; }).catch(() => {}).finally(() => {
    root._aioBriefingEarningsRequested = false;
    if (root._aioEarningsSnapshot && doc.getElementById('page-home')?.classList?.contains('active')) repaint();
  });
}

// v59.51 (content audit): the next one or two scheduled events (the same buildBriefingSchedule rows 브리핑 lists for 7 days).
function nextEvents(doc, root, repaint, limit = 2) {
  requestEarnings(doc, root, repaint);
  // v58.74 (audit): on a weekend three days reached only Monday's minor reports; five reach the next week's Wednesday.
  const days = usWeekendClosed() ? 5 : 3;
  const rows = buildBriefingSchedule({
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
  }).filter((row) => !row.passed);
  // v59.42: a major registered event (the US midterm) keeps a place among the shown rows.
  const shown = rows.slice(0, limit);
  const major = rows.slice(limit).find((row) => row.major);
  if (major && !shown.some((row) => row.major)) shown.splice(shown.length - 1, 1, major);
  return shown;
}

// v58.53 개편 v2 (2b): the hero's right tile — "판단이 바뀌는 조건".
// v58.55 (owner 2026-10-20): each US axis carries the distance to its nearest flip (regime axis.flipDistance). The tile
// lists the three axes nearest to changing — the distance divided by the indicator's average daily move over 20
// sessions, smallest first; a distance that still needs a condition no number measures ranks after the measured ones.
// Without any distance the tile falls back to the v58.53 order: one-sided axes first, full rule sentence, board order.
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
  // v58.55 review: the slots measured axes leave are filled in the v58.53 order with the full rule sentence.
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

// v59.51 (two layers): the face of each row is the condition sentence and its distance; how far that is in ordinary daily
// moves, every condition of the axis and the full rule open in "전체 조건과 거리". The next one or two scheduled events
// close the tile (what could move the numbers), with the 7-day list one link away on 브리핑.
function renderHeroFlips(doc, root, regime, events) {
  const tile = doc.getElementById('home-hero-flips');
  if (!tile) return;
  const rows = heroFlipRows(regime);
  tile.hidden = !rows.length && !events.length;
  if (tile.hidden) { tile.replaceChildren(); return; }
  const measured = rows.some((row) => row.distance);
  const head = el(doc, 'div', null, 'home-flips-head');
  const title = el(doc, 'h2', '판단이 바뀌는 조건', 'sx-kicker home-flips-title');
  title.id = 'home-hero-flips-title';
  head.append(title);
  // v58.56 (re-audit #23): the distances are measured from the last US close, not the live quotes.
  if (measured) title.title = `거리는 ${regime.asOf ? `${shortDate(regime.asOf)} ` : '마지막 '}미국 종가로 잽니다(실시간 시세 아님), 조건까지 남은 거리를 그 지표의 최근 20거래일 평균 하루 변동폭으로 나눠, 작은 순서로 3개를 보여줍니다`;
  const list = el(doc, 'ul', null, 'home-flips');
  for (const row of rows) {
    const li = el(doc, 'li', null, 'home-flip');
    li.dataset.axis = row.id;
    if (row.distance) {
      const [mark, tone, words] = DISTANCE_MARK[row.distance.direction] || DISTANCE_MARK.worsen;
      const badge = el(doc, 'span', mark, `home-flip-mark ${tone}`);
      badge.setAttribute('aria-label', `${row.title} ${row.stateLabel} → ${row.distance.towardLabel}, ${words}`);
      const chip = el(doc, 'span', `남은 거리 ${row.distance.text}`, 'home-flip-chip');
      chip.title = `${regime.asOf ? `${shortDate(regime.asOf)} ` : ''}종가 기준, 지금 ${row.title} ${row.stateLabel}, 기준까지 ${row.distance.text}${row.distance.sessions != null ? `, 최근 20거래일 평균 하루 변동폭의 ${row.distance.sessions}배` : ''}${row.distance.needsMore ? ', 숫자로 잴 수 없는 조건이 함께 필요' : ''}`;
      li.dataset.direction = row.distance.direction;
      const dist = el(doc, 'span', null, 'home-flip-dist');
      dist.append(chip);
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
  const nodes = [head, ...(rows.length ? [list] : [])];
  // Expert layer: each listed axis's distance in ordinary daily moves and its full rule (every condition, both directions).
  const full = rows.filter((row) => row.distance && row.flip);
  if (full.length) {
    const wasOpen = !!tile.querySelector(':scope > .home-flips-full')?.open;
    const fold = el(doc, 'details', null, 'sx-disclosure home-flips-full');
    fold.open = wasOpen;
    fold.append(el(doc, 'summary', '전체 조건과 거리', 'home-flips-full-summary'));
    const rules = el(doc, 'dl', null, 'home-flips-rules');
    for (const row of full) {
      rules.append(el(doc, 'dt', `${row.title} ${row.stateLabel}`), el(doc, 'dd', `${row.distance.sessions != null ? `기준까지 ${row.distance.text}, 최근 20거래일 평균 하루 변동폭의 ${row.distance.sessions}배. ` : ''}${row.flip}`));
    }
    fold.append(rules);
    nodes.push(fold);
  }
  if (events.length) {
    const sub = el(doc, 'h3', '다음 일정', 'sx-kicker home-flips-title home-flips-next-title');
    sub.title = '한국 시간';
    const next = el(doc, 'ul', null, 'home-flips-next');
    for (const row of events) {
      const li = el(doc, 'li', null, `home-flips-event${row.today ? ' is-today' : ''}`);
      li.append(el(doc, 'span', row.when, 'home-flips-event-when'), el(doc, 'span', row.label, 'home-flips-event-label'));
      if (row.sourceTitle) li.title = row.sourceTitle;
      next.append(li);
    }
    const more = el(doc, 'button', '7일 일정 → 브리핑', 'flow-next-link');
    more.type = 'button';
    more.dataset.action = 'showPage';
    more.dataset.arg = 'briefing';
    nodes.push(sub, next, more);
  }
  tile.replaceChildren(...nodes);
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

// v59.51 (content audit): the blocks that left 오늘, one tap away — the overnight news and the release write-ups (뉴스
// paints both, paintNewsBriefs), and the forward scenarios with today's guide (시장 상태, in one fold there).
function renderHomeLinks(doc, root) {
  const nav = doc.getElementById('home-next');
  if (!nav) return;
  const news = el(doc, 'button', '밤사이 뉴스와 발표 요약 → 뉴스', 'flow-next-link');
  news.type = 'button';
  news.dataset.action = 'showPage';
  news.dataset.arg = 'market-news';
  // The count reads the same tiers 뉴스 paints (a lazy chunk, as the write-ups were: not part of the boot set).
  const macro = macroReleasesFor(root).length;
  import('../../domain/briefing/event-briefs.js').then(({ homeBriefTiers }) => {
    const tiers = homeBriefTiers(root?.[EVENT_BRIEFS.key] || null, { nowMs: Date.now() });
    const count = tiers.core.length + tiers.notable.length + macro;
    if (count && news.isConnected) news.textContent = `밤사이 뉴스와 발표 요약 ${count}건 → 뉴스`;
  }).catch(() => {});
  const depth = el(doc, 'button', '다음 발표에 달린 시나리오와 오늘의 가이드 → 시장 상태', 'flow-next-link');
  depth.type = 'button';
  depth.addEventListener('click', () => {
    root?.showPage?.('signal');
    let tries = 0;
    const land = () => {
      const fold = doc.getElementById('regime-depth-fold');
      if (!fold?.querySelector('#signal-crossroads, #home-guide')) { if ((tries += 1) < 30) setTimeout(land, 100); return; }
      fold.open = true;
      fold.scrollIntoView?.({ block: 'start' });
    };
    setTimeout(land, 60);
  });
  nav.replaceChildren(news, depth);
  nav.hidden = false;
}

// v57.78 perf: `regime` is the one home already computed this render (renderHomeRegime returns it); without it the
// loop reads the regime itself, so a caller that renders the loop alone sees the same breadth state.
export function renderDailyLoop({ documentRef: doc, root, store, regime = null }) {
  const host = doc?.getElementById('home-daily-loop');
  if (!host) return null;
  const current = regime || readMarketRegime(root);
  renderKoreaQuote(doc, root);
  const repaint = () => renderHeroFlips(doc, root, current, nextEvents(doc, root, () => {}));
  renderHeroFlips(doc, root, current, nextEvents(doc, root, repaint));
  const namesHost = doc.getElementById('home-my-names');
  const names = namesHost ? renderMyNames(doc, namesHost, root, store, current) : null;
  const newsHost = doc.getElementById('home-my-news');
  if (newsHost) renderMyNews(doc, newsHost, root, store, names?.names || []);
  renderHomeLinks(doc, root);
  // v59.44 (owner 2026-10-30): the AI supply chain by group (a lazy chunk) — the leaders' visual under the verdict.
  import('./ai-chain-flow.js').then(({ paintHomeAiChain }) => paintHomeAiChain(doc, root)).catch(() => {});
  host.dataset.aioDailyLoopRenderer = 'native';
  return { names };
}
