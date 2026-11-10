// P1432 (stage 5): the 오늘 daily loop — the names I hold or watch and their news, the hero's "판단이 바뀌는 조건" tile with
// the next scheduled events, the AI supply-chain visual and one link row to the screens that hold the rest.
// v59.51 (content audit 2026-10-31): 밤사이 핵심, 주요 발표 요약, 다가오는 일정, 오늘 확인할 3가지 and "지난 마감 이후 변화" left
// 오늘 — each repeated a block on 뉴스, 브리핑 or the hero (same pickers, same rows). The links row says where they are.
import { buildMyNames } from '../../domain/briefing/daily-diff.js';
import { readMarketRegime } from './market-regime.js';
import { withObjectParticle } from '../../domain/content/korean-particle.js';
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { buildKoreaIndexSeries } from '../../domain/market/regime/regime-scenarios.js';
import { deriveQuotePresentation } from '../../domain/market/session/quote-presentation.js';
import { formatScreenerPrice, screenerMarket } from '../../domain/screener/market-scope.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
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
    const direction = directionOf(model.pct, 2);
    if (model.pct != null) change.classList.add(...(direction === 'up' ? ['pos', 'a11y-up'] : direction === 'down' ? ['neg', 'a11y-dn'] : ['a11y-hold']));
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
  const current = regime || readMarketRegime(root);
  renderKoreaQuote(doc, root);
  // v59.68 (owner 2026-11-03, 홈 = prices, stocks, news): the flip conditions and next events (시장 상태, 브리핑 own them),
  // the AI supply chain (테마와 섹터) and the link row left 오늘.
  const namesHost = doc.getElementById('home-my-names');
  const names = namesHost ? renderMyNames(doc, namesHost, root, store, current) : null;
  const newsHost = doc.getElementById('home-my-news');
  if (newsHost) renderMyNews(doc, newsHost, root, store, names?.names || []);
  // v59.67 (phase 5): 오늘의 핵심 — the day's top stories, movers and headlines (a lazy chunk; market-day.json loads on first use).
  import('./home-day.js').then(({ renderHomeDay }) => renderHomeDay({ documentRef: doc, root, store })).catch(() => {});
  host.dataset.aioDailyLoopRenderer = 'native';
  return { names };
}
