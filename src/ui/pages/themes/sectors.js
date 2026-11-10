// Theme screens: the sector and theme board — day splits, period tabs, Korea close blocks, performance and near-high bars, chips and the board render.
import { selectThemesItems } from '../../../state/selectors/themes.js';
import { themeTeachFor } from '../../components/theme-playbook-view.js';
import { rotationFlow } from '../../../domain/market/story/page-flow.js';
import { krThemeArtifactRead, krThemeLabel } from '../../../domain/themes/kr-themes.js';
import { buildThemeFlow } from '../../../domain/market/regime/market-flow.js';
import { RRG_BORDER_LABEL, RRG_QUADRANT_WORDS } from '../../../domain/themes/rrg.js';
import { rrgRecentReading } from '../../../domain/themes/recent-check.js';
import { readMarketRegime } from '../../components/market-regime.js';
import { marketInterpretation } from '../../../data/selectors/interpretation.js';
import { renderNextSteps } from '../../components/page-flow.js';
import { signedText, directionOf, finiteNumber as finite } from '../../../domain/shared/number.js';
import { screenerRowsState } from '../../../data/shared-artifacts.js';
import { DATA_STATE_CHIPS } from '../../../domain/content/data-state.js';
import { asOfChip } from '../../components/section-frame.js';
import { legacyThemeDetailTarget } from '../../navigation/theme-detail.js';
import { NEAR_HIGH_MIN_MEASURED, NEAR_HIGH_PCT, SECTOR_ETF_GICS, sectorNearHigh } from '../../../domain/themes/near-high.js';
import { dirColor, screenerRowMap } from './shared.js';
import { QUADRANTS, readingOf, zoneKey, activeView, viewItems, shortSession, usCloseSession, krCloseSession, writeSectorCardChip } from './rrg.js';
import { memberRoleParts, memberTable } from './detail.js';

// v59.51 (content audit): 시장 상태's 자금 흐름 named, for the last session, the sub-themes that split inside one theme, the
// members that split inside one sub-theme, and the strongest and weakest sub-themes (market-flow.js buildThemeFlow). They
// are a theme reading, so they live here, in the 지난 거래일 fold beside the S&P 500 map.
export function renderThemeDaySplits({ documentRef, root, store }) {
  const host = documentRef?.getElementById('themes-day-splits');
  if (!host) return;
  const session = usCloseSession(root);
  const flow = session ? buildThemeFlow({ themes: root?.THEME_MAP || [], rows: store?.getState?.()?.screener?.rows || [], session }) : { available: false };
  const lines = flow.available ? [
    ...flow.splitLines.map((text) => `같은 테마 안에서 갈린 세부 테마 — ${text}`),
    ...flow.memberSplitLines.slice(0, 4).map((text) => `같은 세부 테마 안에서 갈린 종목 — ${text}`),
    flow.strongLine, flow.weakLine
  ].filter(Boolean) : [];
  host.hidden = !lines.length;
  // v59.55: the map left this fold (it is open under the verdict), so the fold shows only when there are splits.
  const fold = host.closest?.('details');
  if (fold) fold.hidden = !lines.length;
  if (!lines.length) { host.replaceChildren(); return; }
  const heading = documentRef.createElement('h3');
  heading.className = 'briefing-h2';
  heading.textContent = '테마 안에서 갈린 곳 ';
  heading.append(asOfChip(documentRef, `${shortSession(session)} 종가`, `${shortSession(session)} 미국 종가, 세부 테마 ${flow.groups}개의 하루 등락 중앙값. 한쪽이 오르고 다른 쪽이 내린 폭이 기준을 넘을 때만 갈렸다고 봅니다.`));
  const list = documentRef.createElement('ul');
  list.className = 'thp-why-list';
  for (const text of lines) { const li = documentRef.createElement('li'); li.textContent = text; list.append(li); }
  host.replaceChildren(heading, list);
}

// v57.76: the 섹터 흐름 분석 box (sector-perf-analysis) and its writer are retired — it repeated the 섹터 회전 판정
// sentence and the 1일·1주 bars right above it.

// P1444: KR themes from the published screener rows; the summary states what is actually covered.
export function renderKrThemeArtifact({ documentRef, root, store }) {
  const host = documentRef?.getElementById('kr-themes-artifact-read');
  if (!host) return;
  const themeMap = root?.KR_THEME_MAP && typeof root.KR_THEME_MAP === 'object' ? root.KR_THEME_MAP : null;
  if (!themeMap) { host.hidden = true; return; }
  const read = krThemeArtifactRead({ themeMap, rows: store?.getState?.()?.screener?.rows || [] });
  const krClose = krCloseSession(store?.getState?.()?.screener?.rows || []);
  const summary = documentRef.getElementById('kr-themes-summary');
  // v58.80 (first-users bundle 3): before the rows arrive "28개 중 0개" read as a final count.
  const load = (store?.getState?.()?.screener?.rows || []).length ? 'ready' : screenerRowsState(root);
  if (summary) summary.textContent = load === 'ready' ? `한국 테마 (${read.totalThemes}개 중 ${read.coveredThemes}개를 ${krClose ? `${shortSession(krClose)} ` : ''}확정 종가로 비교)` : `한국 테마 (${DATA_STATE_CHIPS[load]})`;
  host.dataset.aioKrThemeArtifactRenderer = 'native';
  host.hidden = false;
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  // v58.79 section frame: the title carries the close as its chip; the shown-rows rule and the click hint are its hover.
  const heading = el('h2', '한국 테마 흐름 ', 'briefing-h2');
  if (krClose) heading.append(asOfChip(documentRef, `${shortSession(krClose)} 종가`, `${shortSession(krClose)} 확정 종가 기준${read.usable.length > 12 ? `, 상위 6개와 하위 6개(전체 ${read.usable.length}개 중)` : ''}, 테마 이름을 누르면 구성 종목의 확정 종가 표가 열림`));
  host.replaceChildren(heading, el('p', read.read, 'flow-lead'));
  const max = Math.max(1, ...read.usable.map((theme) => Math.abs(theme.ret1m)));
  // P1591 (T09/T10): the strongest and the weakest six both show (the reading names the weak ones), and bars
  // grow from a zero line so a loss never looks like a long gain.
  const shown = read.usable.length > 12 ? [...read.usable.slice(0, 6), ...read.usable.slice(-6)] : read.usable;
  for (const theme of shown) {
    const line = el('div', null, 'stock-read-bars');
    const item = el('div', null, 'stock-read-bar-row');
    const track = el('div', null, 'stock-read-track');
    track.style.position = 'relative';
    const direction = directionOf(theme.ret1m, 1);
    const bar = el('div', null, `stock-read-bar is-stock${direction === 'up' ? ' is-up' : direction === 'down' ? ' is-down' : ''}`);
    const half = `${(Math.abs(theme.ret1m) / max * 50).toFixed(1)}%`;
    bar.classList.add('thp-strength-bar');
    bar.style.width = `max(2px, ${half})`;
    bar.style.left = theme.ret1m >= 0 ? '50%' : `calc(50% - ${half})`;
    const zero = el('span', null, 'thp-strength-zero');
    track.append(zero, bar);
    item.append(track, el('span', `1개월 ${signedText(theme.ret1m, 1)}%, 3개월 ${theme.ret3m == null ? '—' : `${signedText(theme.ret3m, 1)}%`}${theme.above50Pct != null ? `, 50일선 위 ${theme.above50Pct}%` : ''}, ${theme.covered}/${theme.members}종목`, 'stock-read-bar-value'));
    // Screen audit 2026-10-20: the Korean theme rows were not clickable, so a Korean theme's detail had no entry here.
    const label = typeof root?.openKrThemeDetail === 'function' ? el('button', theme.label, 'stock-read-bar-label theme-strength-open') : el('span', theme.label, 'stock-read-bar-label');
    if (label.tagName === 'BUTTON') {
      label.type = 'button';
      label.setAttribute('aria-label', `${theme.label} 테마 상세 열기`);
      label.addEventListener('click', () => root.openKrThemeDetail(theme.id));
    }
    line.append(label, item);
    host.append(line);
  }
  syncKrLiveBlocks(documentRef, root); // v58.75
}

export const SECTOR_PERIODS = Object.freeze([['1d', '1일', 'ret1d'], ['1w', '1주', 'ret5d'], ['1m', '1개월', 'ret1m'], ['3m', '3개월', 'ret3m'], ['6m', '6개월', 'ret6m'], ['12m', '12개월', 'ret12m']]);
// v59.70 (X bookmarks #2): one metric tab after the periods — each sector's S&P 500 members within 5% of the 52-week
// closing high (domain/themes/near-high.js). It reads the 11 sectors only, so it is disabled in the other scopes.
export const NEAR_HIGH_TAB = Object.freeze(['near52', '고점 근처']);
// The period tabs replace the static 1일·1주 pair (index.html #sector-perf-tabs) with native buttons.
export function ensureSectorPeriodTabs(documentRef, root, store, route, mode, { nearHighReady = false } = {}) {
  const group = documentRef?.getElementById('sector-perf-tabs');
  if (!group) return;
  if (group.dataset.aioSectorPeriods !== 'native') {
    group.dataset.aioSectorPeriods = 'native';
    group.setAttribute('aria-label', '기간·지표');
    group.replaceChildren(...[...SECTOR_PERIODS, NEAR_HIGH_TAB].map(([key, label]) => {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'news-sort-btn';
      button.dataset.period = key;
      button.textContent = label;
      button.addEventListener('click', () => { root._aioSectorPeriod = key; renderThemePerformanceBars({ documentRef, root, store, route }); });
      return button;
    }));
  }
  group.querySelectorAll('button[data-period]').forEach((button) => {
    const on = button.dataset.period === mode;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', String(on));
    if (button.dataset.period === NEAR_HIGH_TAB[0]) {
      button.disabled = !nearHighReady;
      button.title = nearHighReady ? `S&P 500 구성 종목 중 52주 종가 고점의 ${NEAR_HIGH_PCT}% 안에 있는 종목 비율` : '11섹터 보기에서, S&P 500 구성 종목의 52주 고점 기록이 있을 때';
    }
  });
}

// v58.75 (persona review): outside Korean hours the live-quote KRX blocks read "시세 미수신", "수집 대기…" and "유효 테마
// 0/28". They hide while no Korean live quote covers any theme (the close-based read above is the view then); the fold
// itself stays only while a theme detail is open in it.
export function krLiveThemeCount(root) {
  try { return root?.AIO?.evaluateKrThemeQuoteCoverage?.(root._liveData || {}, root.KR_THEME_MAP || {})?.validThemeCount || 0; } catch (_) { return 0; }
}
// The legacy KR detail panel is located through the native close-detail host inside it (AG-DOM-WRITER: the panel id
// belongs to js/aio-kr-data.js; this page only reads its display state).
export const krDetailPanelOf = (documentRef) => documentRef?.getElementById('kr-theme-close-detail')?.closest?.('#kr-theme-detail-panel') || null;
export function syncKrLiveBlocks(documentRef, root) {
  const fold = documentRef?.getElementById('kr-themes-live');
  if (!fold) return;
  const live = krLiveThemeCount(root) > 0;
  const body = documentRef.getElementById('kr-themes-live-body');
  if (body) body.hidden = !live;
  const panel = krDetailPanelOf(documentRef);
  const panelOpen = !!panel && panel.style.display !== 'none' && panel.style.display !== '';
  fold.hidden = !live && !panelOpen;
  const summary = fold.querySelector(':scope > summary');
  if (summary) summary.textContent = live ? '장중 실시간 테마 등락 보기, 국내 시세가 들어올 때만 계산' : '한국 테마 상세';
  const liveFold = documentRef.getElementById('kr-theme-live-detail-fold');
  if (liveFold && liveFold.dataset.aioLive !== String(live)) {
    liveFold.dataset.aioLive = String(live);
    liveFold.open = live;
    const label = liveFold.querySelector(':scope > summary');
    if (label) label.textContent = live ? '장중 시세 기준 상세' : '장중 시세 기준 상세 — 지금은 국내 장중 시세가 없어 위 확정 종가 표로 봅니다';
  }
}
// The Korean theme detail's completed-close member table (published screener rows), above the live-quote detail.
export function renderKrCloseDetail({ documentRef, root, store, themeId }) {
  const host = documentRef?.getElementById('kr-theme-close-detail');
  const members = root?.KR_THEME_MAP?.[themeId];
  if (!host) return;
  if (!Array.isArray(members) || !members.length) { host.hidden = true; host.replaceChildren(); return; }
  const screenerRows = screenerRowMap(store);
  const list = members.map((member) => {
    const code = String(member?.code || '');
    const row = screenerRows.get(`${code}.KS`) || screenerRows.get(`${code}.KQ`) || null;
    return { sym: row ? String(row.sym).toUpperCase() : `${code}.KS`, label: root?.KR_STOCK_DB?.[code]?.name || row?.name || code, row };
  });
  const heading = documentRef.createElement('div');
  heading.className = 'thp-detail-heading';
  const covered = list.filter((member) => member.row).length;
  const krClose = krCloseSession(store?.getState?.()?.screener?.rows || []);
  heading.textContent = `${KR_THEME_LABEL_OF(themeId)}, 구성 종목 ${list.length}개 중 확정 종가 기록 ${covered}개`;
  host.replaceChildren(heading);
  if (covered) {
    const teach = themeTeachFor({ root, store, market: 'KR', themeId });
    const table = memberTable(documentRef, root, list, { onSort: () => renderKrCloseDetail({ documentRef, root, store, themeId }), ariaLabel: `한국 ${KR_THEME_LABEL_OF(themeId)} 구성 종목 표`, basisDate: krClose ? `${shortSession(krClose)} 한국 종가 기준` : null, roles: teach?.roles || null });
    const roleFold = memberRoleParts(documentRef, teach, list);
    host.append(table.lead, table.region, table.basis, ...(roleFold ? [roleFold] : []));
  } else {
    const empty = documentRef.createElement('p');
    empty.className = 'thp-detail-empty';
    empty.textContent = '구성 종목의 확정 종가 기록이 아직 없습니다.';
    host.append(empty);
  }
  host.hidden = false;
}
export const KR_THEME_LABEL_OF = (themeId) => krThemeLabel(themeId).split(' / ')[0];

export function renderThemePerformanceBars({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('sector-perf-bars');
  if (!host) return;
  host.dataset.aioThemePerformanceBarsRenderer = 'native';
  const view = activeView(root); // v59.70: the card's one scope control (11섹터 · 세부 업종 · 전체) drives the bars too
  // v58.75 (persona review): Koyfin/Finviz-style period tabs. 1일·1주 stay the rotation artifact's session returns
  // (dailyPct/weeklyPct); 1·3·6·12개월 are the published screener's ETF returns (ret1m…ret12m). Each bar carries its gap to
  // SPY over the same window; an ETF the screener does not carry reads '—'. No YTD field is published, so no YTD tab.
  const screenerRows = screenerRowMap(store);
  const allItems = selectThemesItems(store?.getState?.() || {});
  const hasLong = allItems.some((item) => finite(screenerRows.get(String(item?.symbol || item?.id || '').toUpperCase())?.ret1m) != null);
  // v59.70 (owner: a week over 15 sessions): 1주 first when the rotation artifact carries it, else 1개월, else the day.
  const hasWeek = allItems.some((item) => finite(item?.weeklyPct) != null);
  const nearHigh = view === 'sectors' ? nearHighOf(store) : null;
  const nearHighReady = !!nearHigh && Object.values(nearHigh.bySector).some((row) => row.share != null);
  if (root?._aioSectorPeriod === NEAR_HIGH_TAB[0] && nearHighReady) {
    ensureSectorPeriodTabs(documentRef, root, store, route, NEAR_HIGH_TAB[0], { nearHighReady });
    renderNearHighBars(documentRef, root, host, viewItems(allItems, 'sectors'), nearHigh);
    return;
  }
  const mode = SECTOR_PERIODS.some(([key]) => key === root?._aioSectorPeriod) ? root._aioSectorPeriod : hasWeek ? '1w' : hasLong ? '1m' : '1d';
  const period = SECTOR_PERIODS.find(([key]) => key === mode);
  ensureSectorPeriodTabs(documentRef, root, store, route, mode, { nearHighReady });
  if (host.dataset.metric) { delete host.dataset.metric; delete host.dataset.session; writeSectorCardChip(documentRef, root); }
  const valueOf = (symbol, item) => {
    if (mode === '1d') return finite(item?.pct);
    if (mode === '1w') return finite(item?.weeklyPct);
    return finite(screenerRows.get(symbol.toUpperCase())?.[period[2]]);
  };
  // SPY over the same window: the screener's SPY row, only when it closed on the rotation's session.
  const spyRow = screenerRows.get('SPY');
  const close = usCloseSession(root);
  const spySame = spyRow && (!close || String(spyRow.factorSessionDate || '').slice(0, 10) === close);
  const spy = spySame ? finite(spyRow[{ '1d': 'ret1d', '1w': 'ret5d' }[mode] || period[2]]) : null;
  const rows = viewItems(allItems, view)
    .map((item) => {
      const symbol = String(item?.symbol || item?.id || '');
      const pct = valueOf(symbol, item);
      return {
        symbol,
        label: themeItemLabel(root, item),
        pct,
        vsSpy: pct != null && spy != null ? pct - spy : null,
        // v57.84: the bar badge reads the same banded zone as the scatter — a point within ±band of 100 is 경계 here too.
        quadrant: zoneKey(root, item) || 'neutral'
      };
    })
    .filter((row) => row.symbol)
    .sort((a, b) => {
      if (a.pct == null && b.pct == null) return a.symbol.localeCompare(b.symbol);
      if (a.pct == null) return 1;
      if (b.pct == null) return -1;
      return b.pct - a.pct;
    });
  host.replaceChildren();
  // v59.70: the hero names the 11 sectors' ends over the same period the bars show (default 1주), on every period change.
  const sectorRows = view === 'sectors' ? rows : viewItems(allItems, 'sectors').map((item) => { const symbol = String(item?.symbol || item?.id || ''); return { label: themeItemLabel(root, item), pct: valueOf(symbol, item) }; });
  writeSectorHero(documentRef, root, sectorRows, period[1]);
  // v59.51: the bars are the verdict card's second tab, so with no return yet the tab says so instead of hiding a section.
  if (!rows.length || !rows.some((row) => row.pct != null)) {
    const empty = documentRef.createElement('div');
    empty.textContent = '섹터 성과 데이터 수신 대기';
    empty.className = 'thp-perf-empty';
    host.appendChild(empty);
    return;
  }
  const maxAbs = Math.max(0.5, ...rows.map((row) => Math.abs(row.pct ?? 0)));
  // v58.79 (layout over captions): the close date is the card head's chip; the column rule (right %p = SPY over the same
  // period, — = no value) is the bars' hover.
  host.title = `${period[1]} 수익률${close ? `, ${shortSession(close)} 미국 종가 기준` : ''}${spy != null ? `, 오른쪽 %p = 같은 기간 SPY(${signedText(spy, 2)}%) 대비` : ', SPY 같은 기간 값 대기'}, 값이 없는 섹터는 —, 오른쪽 끝 = 약 50거래일 회전 단계`;
  const colors = { Leading: 'var(--data-green)', Improving: 'var(--text-secondary)', Weakening: 'var(--text-secondary)', Lagging: 'var(--data-amber)' }; // v58.53: the scatter's quadrant colours
  rows.forEach((row) => {
    const line = documentRef.createElement('div');
    line.dataset.themePerformanceRow = row.symbol;
    line.className = 'thp-perf-row';
    const symbol = documentRef.createElement('span');
    symbol.textContent = row.symbol;
    symbol.className = 'thp-perf-symbol';
    const label = documentRef.createElement('span');
    label.textContent = row.label;
    label.className = 'thp-perf-label';
    const track = documentRef.createElement('span');
    track.className = 'thp-perf-track';
    const zero = documentRef.createElement('span');
    zero.className = 'thp-perf-zero';
    track.appendChild(zero);
    if (row.pct != null) {
      const bar = documentRef.createElement('span');
      const width = `${Math.abs(row.pct) / maxAbs * 45}%`;
      bar.className = `thp-perf-bar ${row.pct >= 0 ? 'thp-perf-bar--up' : 'thp-perf-bar--down'}`;
      bar.style.marginLeft = row.pct >= 0 ? '50%' : `calc(50% - ${width})`;
      bar.style.width = width;
      track.appendChild(bar);
    }
    const value = documentRef.createElement('span');
    value.textContent = row.pct == null ? '—' : `${signedText(row.pct, mode === '1d' || mode === '1w' ? 2 : 1)}%`;
    value.className = 'thp-perf-value';
    value.style.color = dirColor(row.pct, mode === '1d' || mode === '1w' ? 2 : 1); // P2115: colour follows the printed digits
    const vsSpy = documentRef.createElement('span');
    vsSpy.textContent = row.vsSpy == null ? '' : `${signedText(row.vsSpy, 1)}%p`;
    vsSpy.className = 'thp-perf-vs';
    if (row.vsSpy != null) vsSpy.title = `${period[1]} SPY 대비 ${signedText(row.vsSpy, 2)}%p`;
    const badge = documentRef.createElement('span');
    // v58.80 first-users run-2 (F12): "선도" beside the day's worst move read as a contradiction; the badge is the ~50-session
    // rotation stage, not this period's move, so it says so.
    const quadrantWord = RRG_QUADRANT_WORDS[row.quadrant];
    badge.textContent = row.pct == null ? '대기' : (row.quadrant === 'Border' ? RRG_BORDER_LABEL : quadrantWord ? `50일 ${quadrantWord}` : '중립');
    if (quadrantWord) badge.title = `약 50거래일 상대강도 회전 단계 — 위 막대(${period[1]})와 다른 기간입니다`;
    badge.className = 'thp-perf-badge';
    badge.style.color = row.pct == null ? 'var(--text-muted)' : colors[row.quadrant] || 'var(--text-muted)';
    line.append(symbol, label, track, value, vsSpy, badge);
    host.appendChild(line);
  });
}

export function nearHighOf(store) {
  const screener = store?.getState?.()?.screener;
  const block = screener?.metadata?.indexWeights;
  if (!Array.isArray(block?.rows)) return null;
  const session = screener?.metadata?.factorSessionDateByMarket?.US || null;
  return { ...sectorNearHigh({ weights: block, rows: screener?.rows || [], session }), session };
}

// The 11 sectors by the share of their S&P 500 members within 5% of the 52-week closing high: a one-sided bar from 0 to
// 100%, the count beside it, and the hero line naming the ends.
export function renderNearHighBars(documentRef, root, host, items, nearHigh) {
  host.replaceChildren();
  host.dataset.metric = NEAR_HIGH_TAB[0];
  if (nearHigh.session) host.dataset.session = nearHigh.session; else delete host.dataset.session;
  const session = nearHigh.session; // the screener's US factor session the values were measured on, not the rotation's
  const rows = items.map((item) => {
    const symbol = String(item?.symbol || item?.id || '').toUpperCase();
    const bucket = nearHigh.bySector[SECTOR_ETF_GICS[symbol]] || null;
    return { symbol, label: themeItemLabel(root, item), bucket, share: bucket?.share ?? null };
  }).filter((row) => SECTOR_ETF_GICS[row.symbol])
    .sort((a, b) => (b.share ?? -1) - (a.share ?? -1) || a.symbol.localeCompare(b.symbol));
  host.title = `S&P 500 구성 종목 중 52주 종가 고점의 ${NEAR_HIGH_PCT}% 안 비율${session ? `, ${shortSession(session)} 종가 기준` : ''}. 오른쪽은 해당 종목 수 / 측정 종목 수, 측정 ${NEAR_HIGH_MIN_MEASURED}종목 미만은 —`;
  for (const row of rows) {
    const line = documentRef.createElement('div');
    line.dataset.themePerformanceRow = row.symbol;
    line.className = 'thp-perf-row';
    const symbol = documentRef.createElement('span');
    symbol.textContent = row.symbol;
    symbol.className = 'thp-perf-symbol';
    const label = documentRef.createElement('span');
    label.textContent = row.label;
    label.className = 'thp-perf-label';
    const track = documentRef.createElement('span');
    track.className = 'thp-perf-track';
    if (row.share != null) {
      const bar = documentRef.createElement('span');
      bar.className = 'thp-perf-bar thp-perf-bar--share';
      bar.style.width = `${row.share}%`;
      track.appendChild(bar);
    }
    const value = documentRef.createElement('span');
    value.textContent = row.share == null ? '—' : `${row.share}%`;
    value.className = 'thp-perf-value';
    const count = documentRef.createElement('span');
    count.textContent = row.bucket ? `${row.bucket.near}/${row.bucket.measured}` : '';
    count.className = 'thp-perf-vs';
    if (row.bucket) count.title = `${row.label}: 52주 고점 ${NEAR_HIGH_PCT}% 안 ${row.bucket.near}종목 / 측정 ${row.bucket.measured}종목 (구성 ${row.bucket.listed}종목)`;
    line.setAttribute('aria-label', `${row.label} ${row.share == null ? '측정 부족' : `${row.share}%, ${row.bucket.near}/${row.bucket.measured}종목`}`);
    line.append(symbol, label, track, value, count);
    host.appendChild(line);
  }
  const read = documentRef.getElementById('rrg-rotation-read');
  const ranked = rows.filter((row) => row.share != null);
  if (read && ranked.length >= 6) {
    const name = (list) => list.map((row) => `${row.label} ${row.share}%`).join(', ');
    const total = nearHigh.total.share;
    read.textContent = `${session ? `${shortSession(session)} 종가, ` : ''}52주 고점 ${NEAR_HIGH_PCT}% 안 종목 비율은 ${name(ranked.slice(0, 3))}가 높고 ${name(ranked.slice(-2).reverse())}가 낮습니다${total != null ? `(S&P 500 전체 ${total}%)` : ''}.`;
    read.dataset.sectorMoves = NEAR_HIGH_TAB[1];
  }
  writeSectorCardChip(documentRef, root);
}

export function themeDefinitionOf(root, item) {
  const symbol = String(item?.symbol || item?.id || '').trim().toUpperCase();
  const catalog = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  return catalog.find((entry) => (
    String(entry?.id || '').trim() === String(item?.id || '').trim()
    || String(entry?.etf || '').trim().toUpperCase() === symbol
    || String(entry?.compositeBase || '').trim().toUpperCase() === symbol
  )) || null;
}

export function resolveThemeDetailId(root, item) {
  const theme = themeDefinitionOf(root, item);
  return theme?.id ? String(theme.id) : null;
}

// "11/2까지 1주, 강한 섹터는 …, 약한 섹터는 …입니다." — the 11 sectors over the bars' period. Without values the
// ~50-session rotation reading stays the hero (renderThemes) and its copy under the scatter hides.
export function writeSectorHero(documentRef, root, rows, periodLabel) {
  const read = documentRef.getElementById('rrg-rotation-read');
  const detail = documentRef.getElementById('rrg-rotation-detail');
  if (!read) return;
  const list = rows.filter((row) => finite(row.pct) != null).sort((a, b) => b.pct - a.pct);
  if (list.length < 6) { delete read.dataset.sectorMoves; if (detail) detail.hidden = true; return; }
  const close = usCloseSession(root);
  const name = (part) => part.map((row) => `${row.label} ${signedText(row.pct, 1)}%`).join(', ');
  const up = list.filter((row) => directionOf(row.pct, 1) === 'up').slice(0, 3), down = list.filter((row) => directionOf(row.pct, 1) === 'down').slice(-2).reverse();
  const body = up.length && down.length ? `강한 섹터는 ${name(up)}, 약한 섹터는 ${name(down)}입니다.`
    : up.length ? `${list.length}개 섹터가 대부분 올랐고 ${name(up)}가 앞섰습니다.` : `${list.length}개 섹터가 대부분 내렸고 ${name(list.slice(-3).reverse())}가 가장 약했습니다.`;
  // 1일·1주 sit on the rotation artifact's session; the longer windows are the screener's own close (no shared date).
  read.textContent = `${close && (periodLabel === '1일' || periodLabel === '1주') ? `${shortSession(close)}까지 ` : ''}${periodLabel}, ${body}`;
  read.dataset.sectorMoves = periodLabel;
  if (detail) detail.hidden = !detail.textContent;
}

export function themeItemLabel(root, item) {
  const theme = themeDefinitionOf(root, item);
  return String(theme?.nameKr || theme?.name || item?.label || item?.symbol || item?.id || '').trim();
}

export function themeDetailDeepLink(hash, root) {
  // v59.70: one parser with the boot route (src/ui/navigation/theme-detail.js); a retired id opens the plain list.
  const ids = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP.map((theme) => String(theme?.id || '')) : null;
  return legacyThemeDetailTarget(hash, ids);
}

export function createChip(documentRef, item, root) {
  const detailId = resolveThemeDetailId(root, item);
  const chip = documentRef.createElement(detailId ? 'button' : 'span');
  const pct = finite(item?.pct);
  const symbol = String(item?.symbol || item?.id || '');
  const label = themeItemLabel(root, item) || symbol;
  chip.dataset.themeSymbol = symbol;
  // LC-54: 상세 제공 여부를 데이터 계약으로 드러낸다 — 읽기 전용 칩과 상세 버튼이
  // 같은 외형이면 사용자가 눌러도 아무 일도 없는 이유를 알 수 없다.
  chip.dataset.detailAvailability = detailId ? 'available' : 'summary-only';
  // P1505: the quadrant says where a sector stands on relative strength; the period return is a separate number.
  // Only the return is coloured, so a lagging sector that rose today no longer reads as a green chip in 후행.
  chip.textContent = `${symbol} ${label}`;
  if (pct != null) {
    const change = documentRef.createElement('span');
    change.textContent = ` ${signedText(pct, 2)}%`;
    change.style.color = dirColor(pct, 2);
    chip.append(change);
  }
  // v57.81: a 경계 chip names the quadrants it sits between; a chip whose last five sessions of relative strength ran
  // against its quadrant says so (rrgRecentReading), so 선도 is never read as "still strengthening" during a break.
  const reading = item?.rrgReading || null;
  if (reading?.border || reading?.reversal) {
    chip.dataset.rrgReading = reading.label;
    const note = documentRef.createElement('span');
    note.textContent = `${reading.border ? `, ${reading.between} 사이` : ''}${item.recentReversal ? `, 최근 5거래일 ${item.recentReversal}` : ''}`;
    note.style.color = 'var(--text-secondary)';
    chip.append(note);
  }
  chip.className = detailId ? 'thp-chip thp-chip--detail' : 'thp-chip'; // v57.77 (a11y): the dashed border marks summary-only; opacity dropped the % below 4.5:1
  if (detailId) {
    chip.type = 'button';
    chip.dataset.action = 'showThemeDetail';
    chip.dataset.arg = detailId;
    chip.dataset.passEl = '1';
    chip.setAttribute('aria-label', `${chip.textContent} — 테마 상세 열기`); // v57.77 (a11y 2.5.3): the name starts with the visible text
    chip.title = '테마 상세 열기';
  } else {
    // Codex browser audit H23: the leading sector (e.g. XLK) ended the "which sector → why → which company" path.
    // A summary-only sector now takes the reader to the sub-theme ranking, where its themes and names are listed.
    chip.setAttribute('role', 'button');
    chip.tabIndex = 0;
    chip.style.cursor = 'pointer';
    chip.setAttribute('aria-label', `${chip.textContent} — 상세 패널 없음, 세부 테마 순위로 이동`);
    chip.title = '이 업종 자체의 상세 패널은 없습니다 — 눌러서 아래 세부 테마 순위에서 관련 테마와 대표 종목을 확인합니다.';
    const jump = () => documentRef.getElementById('theme-strength-board')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    chip.addEventListener('click', jump);
    chip.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); jump(); } });
  }
  return chip;
}

export function renderThemes({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const container = documentRef?.getElementById('rrg-quadrant-cards');
  if (!container) return;
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const groups = new Map(QUADRANTS.map((quadrant) => [quadrant.key, []]));
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || 'unknown');
    if (groups.has(quadrant) && quadrant !== 'Border' && finite(item?.rsRatio) != null && finite(item?.rsMomentum) != null) {
      // v57.81: the neutral band (경계) and the five-session reversal travel with the item to the chip and the verdict line.
      const reading = readingOf(root, item);
      const reversal = reading?.reversal ? `상대강도 ${signedText(reading.check.change, 1)}% ${reading.reversal === 'fell' ? '반락' : '반등'}` : null;
      groups.get(reading?.border ? 'Border' : (reading?.quadrant || quadrant)).push({ ...item, rrgReading: reading, recentReversal: reversal });
    }
  });
  groups.forEach((group) => group.sort((a, b) => (finite(b?.pct) ?? -Infinity) - (finite(a?.pct) ?? -Infinity)));
  const classifiedCount = [...groups.values()].reduce((count, group) => count + group.length, 0);
  container.replaceChildren();
  // LC-54: 한 눈에 상세 제공/요약 전용 범위를 말한다 — 점선 칩은 상세가 없다.
  const detailCount = items.filter((item) => resolveThemeDetailId(root, item)).length;
  const legend = documentRef.createElement('div');
  legend.dataset.themeDetailLegend = 'true';
  // Codex browser audit H22: the quadrant and the chip return answer different windows; the legend says which.
  // v57.76: the quadrant definition is the fold's method note (rrg-method-note); the legend keeps only the chip facts.
  legend.textContent = `칩 옆 % = 1일 등락률로, 사분면(가로 50일 평균 대비, 세로 10거래일 전 대비)과 별개라 후행 섹터가 그날은 올랐을 수 있습니다. '최근 5거래일 상대강도'는 그 주 움직임이 평소 1주 움직임의 2배를 넘게 사분면과 반대일 때만 붙습니다. 실선 칩 ${detailCount}개는 테마 상세, 점선 칩 ${Math.max(0, items.length - detailCount)}개는 세부 테마 순위로 연결됩니다.`;
  legend.className = 'thp-quadrant-legend';
  if (classifiedCount) container.appendChild(legend); // P1591 (T01): no quadrant legend over an empty quadrant area
  const appendUnclassified = () => {
    const pending = items.filter((item) => !groups.has(String(item?.quadrant || 'unknown')) || String(item?.quadrant) === 'Border' || finite(item?.rsRatio) == null || finite(item?.rsMomentum) == null);
    if (!pending.length) return;
    const catalog = documentRef.createElement('section');
    catalog.className = 'thp-quadrant-catalog';
    catalog.setAttribute('aria-label', '회전 지표 미수신 테마 목록');
    pending.forEach((item) => catalog.appendChild(createChip(documentRef, item, root)));
    container.appendChild(catalog);
  };
  // v57.54 audit (2): with no sector judged, the page shows one status line (the verdict) instead of empty quadrants and
  // hides the dead view tabs. The sector chips stay as a flat row: they are the page's entry to each theme's detail.
  // v57.76: the scatter (rrg-chart-block) is the section's visual and hides with nothing to plot; the chips then sit in
  // the fold, opened once so the entry stays visible (a reader's own close is kept), and closed again once quadrants exist.
  const chartBlock = documentRef.getElementById('rrg-chart-block');
  const fold = documentRef.getElementById('rrg-quadrant-fold');
  const foldSummary = fold?.querySelector?.('summary');
  const viewTabs = documentRef.getElementById('rrg-view-tabs');
  if (!classifiedCount) {
    if (chartBlock) chartBlock.hidden = true;
    if (foldSummary) foldSummary.textContent = '섹터 목록, 상대강도 판정 전';
    if (fold && !fold.dataset.aioAutoOpened) { fold.open = true; fold.dataset.aioAutoOpened = 'true'; }
    appendUnclassified();
    if (viewTabs) viewTabs.hidden = false; // v59.70: the scope also drives the bars, so it stays without a judged sector
    const read = documentRef.getElementById('rrg-rotation-read');
    const close = usCloseSession(root);
    if (read) read.textContent = `섹터 회전은 최신 확정 종가의 상대강도 기록이 들어오면 표시합니다${close ? ` (지금 기록은 ${shortSession(close)} 종가까지)` : ''} — 그 전에는 아래 S&P 500 지도와 세부 테마 순위로 읽습니다.`;
    return;
  }
  if (chartBlock) chartBlock.hidden = false;
  if (foldSummary) foldSummary.textContent = '사분면별 섹터';
  if (fold?.dataset.aioAutoOpened) { fold.open = false; delete fold.dataset.aioAutoOpened; }
  if (viewTabs) viewTabs.hidden = false;

  QUADRANTS.forEach((quadrant) => {
    if (quadrant.optional && !(groups.get(quadrant.key) || []).length) return; // 경계 card only when something sits on the band
    const card = documentRef.createElement('section');
    card.dataset.themeQuadrant = quadrant.key;
    card.className = 'thp-quadrant-card';
    const heading = documentRef.createElement('div');
    heading.textContent = quadrant.label;
    heading.className = 'thp-quadrant-heading';
    const note = documentRef.createElement('div');
    note.textContent = quadrant.note;
    note.className = 'thp-quadrant-note';
    card.append(heading, note);
    const chips = documentRef.createElement('div');
    chips.className = 'thp-quadrant-chips';
    const group = groups.get(quadrant.key) || [];
    if (group.length) group.forEach((item) => chips.appendChild(createChip(documentRef, item, root)));
    else {
      const empty = documentRef.createElement('span');
      empty.textContent = '해당 섹터 없음';
      empty.className = 'thp-quadrant-empty';
      chips.appendChild(empty);
    }
    card.appendChild(chips);
    container.appendChild(card);
  });
  appendUnclassified();
  // P1431: one reading of all four quadrants, tied to the 시장 상태 breadth axis.
  let revisions = null;
  try { revisions = marketInterpretation(root, { store }).indexEarnings?.sectors || null; } catch (_) { revisions = null; }
  const flow = rotationFlow({ groups: Object.fromEntries(groups), regime: readMarketRegime(root), revisions });
  // v59.70 (theme-sector, owner: "which sector led the day and the week"): the hero names the day's and the week's ends
  // of the 11 sectors; the ~50-session rotation reading sits under the scatter (회전 view). Without session returns the
  // rotation reading stays the hero, as before.
  const read = documentRef.getElementById('rrg-rotation-read');
  const detail = documentRef.getElementById('rrg-rotation-detail');
  if (read && !read.dataset.sectorMoves) read.textContent = flow.read; // the bars renderer writes the period line over it
  if (detail) { detail.textContent = flow.read; detail.hidden = !read?.dataset.sectorMoves; }
  renderNextSteps(documentRef, documentRef.getElementById('themes-next'), flow.next);
}
