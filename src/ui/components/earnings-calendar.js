// Roadmap item 11 (legacy decomposition, 종목 · 실적 일정): the weekly earnings calendar (#earnings-calendar-body and its
// #earn-cal-status line) moved here from js/aio-pages.js (loadEarningsCalendar, _aioEarnCalWeekShift and the
// _aioEarnCalWeekOffset state, _aioNyDate, _aioEarningsWeekDays, _renderEarningsCalendarWeekly, _renderEarnSection).
// Output is unchanged except that the Before Open / After Close box colours come from classes in
// src/ui/styles/legacy-pages.css instead of inline styles. The stored snapshot is read through
// src/data/earnings-calendar-snapshot.js; the page-entry trigger stays in js/aio-pages.js (initFundamentalLegacyWidgets).
import { dateInTimezone } from '../../domain/market/market-calendar.js';
import { fetchEarningsCalendarSnapshot } from '../../data/earnings-calendar-snapshot.js';

const DAY_MS = 86400000;
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_VISIBLE = 9; // per section

// v58.63 (architecture audit A04): earnings dates are US exchange calendar dates, so "today" is the New York date.
export function earningsNyDate(now) {
  const ms = now instanceof Date ? now.getTime() : Number(now);
  return dateInTimezone(ms, 'America/New_York') || new Date(ms).toISOString().slice(0, 10);
}

// Mon~Fri of the week, shifted by weekOffset weeks. Same window rule as scripts/fetch-earnings-calendar.mjs: a weekend
// opens the coming week.
export function earningsWeekDays(now, weekOffset) {
  const [y, m, d] = earningsNyDate(now).split('-').map(Number);
  const base = Date.UTC(y, m - 1, d);
  const dow = new Date(base).getUTCDay();
  const monday = base + ((dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow) + (weekOffset || 0) * 7) * DAY_MS;
  return Array.from({ length: 5 }, (_, i) => new Date(monday + i * DAY_MS).toISOString().slice(0, 10));
}

const hourOf = (e) => (e.hour || '').toLowerCase();

function sessionHtml(label, tone, items, esc) {
  let html = `<div class="pgl-ec-sess is-${tone}">`;
  html += `<div class="pgl-ec-sess-t"> ${label}</div>`;
  html += '<div class="pgl-ec-syms">';
  items.slice(0, MAX_VISIBLE).forEach((e) => {
    const sym = e.symbol || '?';
    const epsEst = e.epsEstimate != null ? `$${parseFloat(e.epsEstimate).toFixed(2)}` : '';
    // v57.81: the third-party logo hotlink is gone; the ticker text is the card face.
    html += `<div class="aio-earn-card pgl-ec-sym" data-action="_aioNewsTickerClick" data-arg="${esc(sym)}" role="button" tabindex="0" title="${esc(`${sym} 어닝 ${epsEst}`)}">`;
    html += `<span class="pgl-ec-sym-t">${esc(sym)}</span>`;
    html += '</div>';
  });
  if (items.length > MAX_VISIBLE) html += `<div class="pgl-ec-more">+${items.length - MAX_VISIBLE}</div>`;
  html += '</div></div>';
  return html;
}

// v48.56: weekly layout — one column per weekday, IPOs first, then Before Open and After Close.
export function earningsWeekHtml(earnings, ipos, week, { now = new Date(), esc = (v) => String(v) } = {}) {
  const sorted = earnings.slice().sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? 1 : -1;
    const tA = hourOf(a), tB = hourOf(b);
    if (tA !== tB) return tA === 'bmo' ? -1 : 1;
    return (b.marketCap || 0) - (a.marketCap || 0);
  });
  const todayYmd = earningsNyDate(now);
  let html = '';
  week.slice(0, 5).forEach((ymd) => {
    const date = new Date(`${ymd}T00:00:00Z`);
    const dayEarn = sorted.filter((e) => e.date === ymd);
    const bmo = dayEarn.filter((e) => hourOf(e) === 'bmo');
    const amc = dayEarn.filter((e) => hourOf(e) === 'amc');
    const dayIpos = ipos.filter((p) => p.date === ymd);
    const isToday = todayYmd === ymd;
    html += '<div class="aio-earn-day pgl-ec-day">';
    html += `<div class="pgl-ec-dayhd${isToday ? ' is-today' : ''}">${DAY_LABELS[date.getUTCDay()]} ${date.getUTCDate()}${isToday ? ', 오늘' : ''}</div>`;
    if (dayIpos.length > 0) {
      html += '<div class="pgl-ec-ipo">';
      html += `<div class="pgl-ec-ipo-t">IPO, ${dayIpos.length}건</div>`;
      dayIpos.slice(0, 3).forEach((p) => {
        html += `<div class="pgl-ec-ipo-sym">${esc(p.symbol || '?')} <span class="pgl-note">${esc((p.name || '').slice(0, 18))}</span></div>`;
      });
      if (dayIpos.length > 3) html += `<div class="pgl-note">+${dayIpos.length - 3}</div>`;
      html += '</div>';
    }
    if (bmo.length > 0) html += sessionHtml('Before Open', 'bmo', bmo, esc);
    if (amc.length > 0) html += sessionHtml('After Close', 'amc', amc, esc);
    if (!bmo.length && !amc.length && !dayIpos.length) html += '<div class="pgl-ec-none">(발표 없음)</div>';
    html += '</div>';
  });
  return html;
}

export function createEarningsCalendar({ root = globalThis, documentRef = root.document } = {}) {
  let weekOffset = 0;
  const esc = (value) => (typeof root.escHtml === 'function' ? root.escHtml(value) : String(value));
  const log = (msg) => { if (typeof root._aioLog === 'function') root._aioLog('warn', 'fetch', msg); };

  async function load() {
    const body = documentRef.getElementById('earnings-calendar-body');
    if (!body) return;
    const week = earningsWeekDays(new Date(), weekOffset);
    const fromStr = week[0];
    const toStr = week[4];
    body.innerHTML = `<div class="pgl-ec-msg is-wait"><span class="aio-spinner pgl-ec-spin"></span>어닝 캘린더 요청 중… (${fromStr} ~ ${toStr})</div>`;
    // v57.76: personal API keys are retired; the stored public-data snapshot is the only source.
    try {
      const snapshot = await fetchEarningsCalendarSnapshot({ root });
      const status = documentRef.getElementById('earn-cal-status');
      if (snapshot && (snapshot.earnings.length > 0 || snapshot.ipos.length > 0)) {
        body.innerHTML = earningsWeekHtml(snapshot.earnings, snapshot.ipos, week, { esc });
        if (status) {
          status.textContent = `${snapshot.earnings.length}건 어닝 + ${snapshot.ipos.length}IPO, ${fromStr.slice(5)}~${toStr.slice(5)}`
            + ` (저장 스냅샷 ${String(snapshot.weekStart || '—').slice(5)}~${String(snapshot.weekEnd || '—').slice(5)})`;
          // Most listed large caps do not report in a given week, so the gap list is hover context only.
          status.title = snapshot.unconfirmed.length ? `이 목록에 없는 대형주(이번 주 발표가 없거나 공급자 목록에서 빠졌을 수 있음 — 날짜는 추정하지 않음): ${snapshot.unconfirmed.join(', ')}` : '';
        }
        return;
      }
      body.innerHTML = '<div class="pgl-ec-msg is-empty">이번 주 실적 발표 일정을 아직 받지 못했습니다. 다음 자동 갱신 때 다시 표시됩니다.</div>';
      if (status) status.textContent = '일정 없음';
    } catch (e) {
      log(`earnings calendar error: ${e.message}`);
      body.innerHTML = '<div class="pgl-ec-msg">실적 발표 일정을 불러오지 못했습니다</div>';
    }
  }

  // v48.56: 이전 / 이번주 / 다음 (data-action="_aioEarnCalWeekShift" data-arg="-1|0|1").
  function shiftWeek(offset) {
    weekOffset = parseInt(offset, 10) || 0;
    return load();
  }

  return { load, shiftWeek, get weekOffset() { return weekOffset; } };
}
