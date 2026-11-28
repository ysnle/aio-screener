// The 테마 screen's daily "what changed" — sub-theme relative strength from the published
// screener returns (no live quotes needed). The AI capex split is 산업 지도's (pages/atlas.js), not this screen's.
import { themeStrengthLead } from '../../domain/market/story/page-flow.js';
import { sectionLead } from './page-flow.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { buildGroupStrength, directionLabel, GROUP_WINDOWS, STRENGTH_TABS } from '../../domain/themes/group-strength.js';
import { latestCompletedUsSession } from '../../domain/market/session/market-calendar.js';
import { el } from './dom.js';
import { sessionChipText } from './session-lag.js';
import { asOfChip, closeChipText, markFrame } from './section-frame.js';
import { attachScrollCue } from './scroll-cue.js';
import { rankMoves } from './figures.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { screenerRowsState } from '../../data/shared-artifacts.js';
import { dataStateText } from '../../domain/content/data-state.js';
import { isIsoDay } from '../../domain/shared/session-date.js';

const SESSIONS = Object.freeze({ ret1d: 1, ret5d: 5, ret10d: 10, ret1m: 21, ret3m: 63, ret6m: 126 });
// Audit 19: rank movement words, kept apart from the playbook's stage words (주도·조정·반등·약세).
const DIRECTION = Object.freeze({ improving: ['최근 강해짐', 'favorable'], steady: ['큰 변화 없음', 'neutral'], weakening: ['최근 식음', 'burden'] });

const pct = (value, digits = 1) => (value == null ? '—' : signedText(value, digits, '%'));

// S&P 500 return over the same number of sessions, on the close basis.
export function benchmarkReturns(history = []) {
  const spx = buildCloseSeries(history, 'spx', { through: closeBasis(history) });
  const last = spx[spx.length - 1];
  const out = { asOf: last?.date || null };
  for (const [key, n] of Object.entries(SESSIONS)) {
    const then = spx.length > n ? spx[spx.length - 1 - n] : null;
    out[key] = last && then ? (last.value / then.value - 1) * 100 : null;
  }
  return out;
}

// Codex browser audit H24: factorObservedAt is a bar start (the Korean session's 10/7 00:00 UTC), so during
// the US session it printed "10/7 종가 기준" for US closes of 10/6. The basis is the completed session date
// per market; the bar start is only a fallback for artifacts without per-market dates.
export function basisOf(rows, metadata = null, history = []) {
  const sessions = metadata?.factorSessionDateByMarket;
  if (sessions && typeof sessions === 'object') {
    const us = isIsoDay(sessions.US || '') ? sessions.US : null;

    if (us) {
      // X03: the date alone does not say whether the ranking may be read as today's leaders.
      const expected = latestCompletedUsSession(Date.now(), { requirePrevious: false })?.date || null;
      return expected && us < expected
        ? { label: `${shortDate(us)} 미국 종가 기준(최신 거래일 ${shortDate(expected)} 반영 전 — 지금의 주도가 아닌 기준일 참고 순위)`, stale: true, chip: sessionChipText(us, expected) }
        : { label: `${shortDate(us)} 미국 종가 기준`, chip: sessionChipText(us, '') };
    }
  }
  // Without per-market dates, the completed US close of the shared history is the basis (the same date the
  // S&P 500 comparison in this line uses); the bar start is the last resort.
  const usClose = closeBasis(history);
  if (usClose) return { label: `${shortDate(usClose)} 미국 종가 기준` };
  const dates = rows.map((row) => String(row?.factorObservedAt || '').slice(0, 10)).filter((date) => isIsoDay(date)).sort();
  return dates.length ? { label: `${shortDate(dates[dates.length - 1])} 종가 기준` } : null;
}

// v59.70 (theme-sector, owner: "which theme led the day and the week, at a glance"): the face is one ranked bar list for
// the chosen window (1일·1주·1개월·3개월). A row opens its members: each member's bar, its gap to the sub-theme median and
// its share of the equal-weight average (return ÷ measured members). The multi-column table moved into a fold.
const dirClass = (value) => ({ up: ' is-up', down: ' is-down' }[directionOf(value)] || '');
function rankBar(doc, value, max) {
  const track = el(doc, 'span', null, 'tsr-track');
  track.append(el(doc, 'span', null, 'tsr-zero'));
  if (value != null) {
    const bar = el(doc, 'span', null, `tsr-bar${dirClass(value)}`);
    const width = `${Math.min(50, Math.abs(value) / max * 50).toFixed(1)}%`;
    bar.style.width = width;
    bar.style.left = value >= 0 ? '50%' : `calc(50% - ${width})`;
    track.append(bar);
  }
  return track;
}

function memberPanel(doc, root, group, model) {
  const key = model.sortKey;
  const panel = el(doc, 'div', null, 'tsr-members');
  const measured = group.rankedMembers.filter((member) => member.included && member[key] != null);
  const mean = measured.length ? measured.reduce((sum, member) => sum + member[key], 0) / measured.length : null;
  panel.append(el(doc, 'p', `${model.windowLabel} 중앙값 ${pct(group[key])}, 동일가중 평균 ${pct(mean)}, 수익률 ${measured.length}/${group.listed}종목${group.basis ? `, ${shortDate(group.basis)} 종가` : ''}`, 'tsr-members__lead'));
  const max = Math.max(0.5, ...measured.map((member) => Math.abs(member[key])));
  const table = el(doc, 'table', null, 'theme-member-table tsr-member-table');
  const head = el(doc, 'thead'), hr = el(doc, 'tr');
  for (const [label, title] of [['종목'], [model.windowLabel], [''], ['중앙값 대비', '이 종목 수익률 − 세부 테마 중앙값'], ['기여', '동일가중 평균에서 이 종목의 몫 = 수익률 ÷ 수익률이 있는 종목 수']]) {
    const th = el(doc, 'th', label);
    if (title) th.title = title;
    hr.append(th);
  }
  head.append(hr);
  const body = el(doc, 'tbody');
  for (const member of group.rankedMembers) {
    const tr = el(doc, 'tr');
    const value = member.included ? member[key] : null;
    const symbol = el(doc, 'td'), button = el(doc, 'button', member.sym, 'breadth-drill-symbol');
    button.type = 'button';
    button.title = member.name || member.sym;
    button.addEventListener('click', () => root?.showTicker?.(member.sym));
    symbol.append(button);
    const bar = el(doc, 'td', null, 'tsr-member-bar');
    bar.append(rankBar(doc, value, max));
    tr.append(symbol, el(doc, 'td', value == null ? '—' : pct(value), `is-num${dirClass(value)}`), bar);
    const gap = value != null && group.comparisonAligned && group[key] != null ? value - group[key] : null;
    tr.append(el(doc, 'td', gap == null ? '—' : `${pct(gap)}p`, `is-num${dirClass(gap)}`));
    const share = value != null && measured.length ? value / measured.length : null;
    tr.append(el(doc, 'td', share == null ? '—' : `${pct(share, 2)}p`, `is-num${dirClass(share)}`));
    body.append(tr);
  }
  table.append(head, body);
  panel.append(table);
  return panel;
}

function detailTable(doc, root, model, ordered) {
  const table = el(doc, 'table', null, 'theme-strength-table');
  const thead = el(doc, 'thead');
  const hr = el(doc, 'tr');
  // Without the S&P 500 return every 'S&P 대비' cell was '—'; the column is left out until it has values.
  const showVs = model.groups.some((group) => Number.isFinite(group.vsBenchmark));
  const labels = ['순위', '세부 테마', '1일', '1주', '2주', '1개월', '3개월', ...(showVs ? ['S&P 대비'] : []), '50일선 위', '순위 변화(3개월→1개월)', '구성 종목 전체'];
  labels.forEach((label) => hr.append(el(doc, 'th', label)));
  thead.append(hr);
  const tbody = el(doc, 'tbody');
  for (const group of ordered) {
    const tr = el(doc, 'tr');
    tr.dataset.group = group.id;
    // A group with fewer than 4 measured members is a reference row, not a ranked one.
    tr.append(el(doc, 'td', group.rank == null ? (group.smallSample ? '참고' : '—') : String(group.rank), 'is-rank'));
    const nameCell = el(doc, 'td');
    nameCell.append(el(doc, 'span', group.name, 'theme-strength-name'), el(doc, 'span', ` ${group.themeName}, ${group.listed}종목${group.members !== group.listed ? ` (수익률 ${group.members}개)` : ''}${group.smallSample ? `, 표본 ${group.members}종목, 참고` : ''}`, 'theme-strength-theme'));
    tr.append(nameCell);
    for (const key of ['ret1d', 'ret5d', 'ret10d', 'ret1m', 'ret3m']) {
      const cell = el(doc, 'td', pct(group[key] ?? null), `is-num${key === model.sortKey ? ' is-sorted' : ''}${dirClass(group[key])}${key === 'ret3m' ? ' is-quiet' : ''}`);
      // A week that fell beyond the group's typical weekly move (group.recent, recent-check.js) is said in the title.
      if (key === 'ret5d' && group.recent?.broken) { cell.title = '평소 1주 움직임의 2배를 넘는 하락'; cell.dataset.recentBreak = 'true'; }
      tr.append(cell);
    }
    if (showVs) tr.append(el(doc, 'td', group.vsBenchmark == null ? '—' : `${pct(group.vsBenchmark)}p`, `is-num${dirClass(group.vsBenchmark)}`));
    tr.append(el(doc, 'td', group.above50Pct == null ? '—' : `${group.above50Pct}%`, 'is-num'));
    const dir = DIRECTION[group.direction];
    const dirCell = el(doc, 'td');
    if (dir) dirCell.append(el(doc, 'span', directionLabel(group), `regime-state is-${directionLabel(group) === dir[0] ? dir[1] : 'neutral'}`));
    tr.append(dirCell);
    const leaderCell = el(doc, 'td');
    const constituents = el(doc, 'div', null, 'theme-strength-constituents');
    constituents.dataset.roving = ''; // one tab stop per row; arrows move between its tickers (behaviors/roving.js)
    for (const member of group.constituents) {
      const button = el(doc, 'button', member.sym, 'breadth-drill-symbol');
      button.type = 'button';
      button.title = `${member.name || member.sym}${member.included ? '' : ', 선택 기간 수익률 없음'}`;
      button.addEventListener('click', () => { if (typeof root?.showTicker === 'function') root.showTicker(member.sym); });
      constituents.append(button);
    }
    leaderCell.append(constituents);
    tr.append(leaderCell);
    // v57.91 (phone audit): under 600px each row becomes a card (responsive.css); every value carries its column name.
    [...tr.children].forEach((cell, index) => { if (labels[index]) cell.dataset.label = labels[index].replace('(3개월→1개월)', ''); });
    tbody.append(tr);
  }
  table.append(thead, tbody);
  const scroll = el(doc, 'div', null, 'aio-table-scroll'); // Cleanup: on a phone the table ran past the screen with no way to scroll
  scroll.append(table);
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', '세부 테마 상대강도 순위 표, 가로 스크롤');
  scroll.tabIndex = 0;
  const frame = el(doc, 'div', null, 'theme-strength-scroll');
  frame.append(scroll);
  return { frame, scroll };
}

// The five sub-themes whose rank rose most from the 3-month to the 1-month ranking, and the five that fell most.
function rankMoveFigure(doc, ranked) {
  const moved = ranked.filter((group) => group.rank1m != null && group.rank3m != null && group.direction && group.direction !== 'steady');
  const by = (sign) => moved.filter((group) => Math.sign(group.rank3m - group.rank1m) === sign).sort((a, b) => Math.abs(b.rank3m - b.rank1m) - Math.abs(a.rank3m - a.rank1m)).slice(0, 5);
  const items = [...by(1), ...by(-1)].map((group) => ({ label: group.name, from: group.rank3m, to: group.rank1m }));
  const total = Math.max(...ranked.map((group) => Math.max(group.rank1m ?? 0, group.rank3m ?? 0)));
  return rankMoves(doc, items, { title: '순위가 크게 바뀐 테마 (3개월 순위 → 1개월 순위, 3개월에는 최근 1개월이 들어 있음)', total, fromLabel: '3개월', toLabel: '1개월' });
}

function renderStrength(doc, root, host, model, basis, onSort, expanded, onToggle, onCompare, onOrder) {
  host.replaceChildren();
  // Section frame: title, the close as its chip (the full basis is the chip's hover), the period/order controls.
  const head = el(doc, 'div', null, 'theme-strength-head aio-frame-head');
  markFrame(host, 'themes.ranking');
  head.append(el(doc, 'h2', '세부 테마 순위', 'briefing-h2'));
  const controls = el(doc, 'div', null, 'theme-strength-controls aio-frame-actions');
  // The order flips to read the weakest first; ranks keep their numbers.
  const weakestFirst = root._aioThemeStrengthOrder === 'asc';
  const tabs = (label, entries, active, onPick) => {
    const group = el(doc, 'div', null, 'theme-strength-periods');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    for (const [value, text, disabled] of entries) {
      const button = el(doc, 'button', text, `news-sort-btn theme-strength-tab${value === active ? ' is-active active' : ''}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(value === active));
      if (disabled) { button.disabled = true; button.title = '이 기간 수익률이 아직 없습니다'; }
      button.addEventListener('click', () => onPick(value));
      group.append(button);
    }
    return group;
  };
  const hasKey = (key) => model.groups.some((group) => group[key] != null) || key === model.sortKey;
  controls.append(tabs('순위 기간', STRENGTH_TABS.map((key) => [key, GROUP_WINDOWS[key], !hasKey(key)]), model.sortKey, onSort),
    tabs('정렬 방향', [['desc', '강한 순'], ['asc', '약한 순']], weakestFirst ? 'asc' : 'desc', onOrder));
  const basisText = `${basis ? basis.label : '스크리너 수익률 수신 대기'}, 구성 종목 ${model.windowLabel} 수익률의 중앙값으로 순위(${weakestFirst ? '약한 순' : '강한 순'}), S&P 500 ${model.windowLabel} ${pct(model.benchmark)}`;
  if (basis) head.append(asOfChip(doc, basis.chip || closeChipText(basis.label), basisText)); // One lag label (session-lag.js)
  head.append(controls);
  host.append(head);
  // On a stale basis the list stays as a dated reference and the "now leading" reading is held.
  const lead = basis?.stale ? '최신 거래일 종가가 아직 반영되지 않아 지금의 주도·개선 판단은 보류합니다. 아래 순위는 기준일 시점의 참고 값입니다.' : themeStrengthLead(model, { stages: root?.__aioThemePlaybook?.themes || null });
  // The reading is about the strong side; with the list flipped it says so.
  if (lead) host.append(sectionLead(doc, weakestFirst && !basis?.stale ? `강한 순으로 보면, ${lead}` : lead));
  if (!model.groups.length) { const load = screenerRowsState(root); host.append(el(doc, 'p', load === 'ready' ? '이 보기에서 비교할 테마 수익률이 없습니다.' : `${dataStateText(load, '스크리너 수익률')}.`, 'briefing-empty')); return; } // Bundle 3
  // Ranked rows flip with the order; reference rows (small samples, no rank) stay after them either way.
  const ranked = model.groups.filter((group) => group.rank != null);
  const ordered = [...(weakestFirst ? [...ranked].reverse() : ranked), ...model.groups.filter((group) => group.rank == null)];
  const visible = expanded ? ordered : ordered.slice(0, 10);
  const key = model.sortKey;
  const max = Math.max(0.5, ...visible.map((group) => Math.abs(group[key] ?? 0)));
  const list = el(doc, 'ol', null, 'tsr-list');
  list.setAttribute('aria-label', `세부 테마 ${model.windowLabel} 수익률 순위`);
  visible.forEach((group, index) => {
    const li = el(doc, 'li', null, 'tsr-item');
    li.dataset.group = group.id;
    const open = root._aioThemeMemberGroup === group.id;
    const row = el(doc, 'button', null, 'tsr-row');
    row.type = 'button';
    row.dataset.compareGroup = group.id;
    row.setAttribute('aria-expanded', String(open));
    row.setAttribute('aria-label', `${group.rank ?? '참고'} ${group.name}, ${group.themeName}, ${model.windowLabel} ${pct(group[key] ?? null)}, 구성 종목 비교 ${open ? '닫기' : '열기'}`);
    const name = el(doc, 'span', null, 'tsr-name');
    name.append(el(doc, 'b', group.name), el(doc, 'span', `${group.themeName}, ${group.listed}종목`, 'tsr-theme'));
    row.append(el(doc, 'span', group.rank == null ? '참고' : String(group.rank), 'tsr-rank'), name, rankBar(doc, group[key] ?? null, max),
      el(doc, 'span', pct(group[key] ?? null), `tsr-value${dirClass(group[key])}`));
    row.addEventListener('click', () => onCompare(group.id));
    li.append(row);
    if (open) {
      const panel = memberPanel(doc, root, group, model);
      panel.id = `theme-members-${index}`;
      row.setAttribute('aria-controls', panel.id);
      li.append(panel);
    }
    list.append(li);
  });
  host.append(list);
  const footer = el(doc, 'div', null, 'theme-strength-footer');
  if (model.groups.length > 10) {
    const more = el(doc, 'button', expanded ? (weakestFirst ? '하위 10개만' : '상위 10개만') : `세부 테마 전체 ${model.groups.length}개`, 'news-sort-btn theme-strength-more');
    more.type = 'button';
    more.addEventListener('click', onToggle);
    footer.append(more);
  }
  host.append(footer);
  const moves = rankMoveFigure(doc, ranked);
  if (moves) host.append(moves);
  // The full multi-window table is fold depth (expert view): every window, S&P gap, 50일선, rank movement, constituents.
  const fold = el(doc, 'details', null, 'sx-disclosure theme-strength-table-fold');
  fold.open = true; // the table is the 테마 순위 view's content (page-views.css)
  fold.dataset.viewOpen = '';
  fold.append(el(doc, 'summary', '기간별 표와 순위 변화'));
  const { frame, scroll } = detailTable(doc, root, model, visible); // the same rows as the bars above; '전체' widens both
  host._aioScrollEdges?.disconnect?.();
  fold.append(frame);
  host.append(fold);
  host._aioScrollEdges = attachScrollCue(scroll, { frame, root }); // Shared helper (scroll-cue.js)
  // v59.55 (alignment pass): why some sub-themes have no rank is fold depth, not a face footnote.
  const reference = model.groups.filter((group) => group.smallSample).length;
  if (model.excluded.length || reference) {
    const excluded = el(doc, 'details', null, 'theme-strength-unranked');
    excluded.append(el(doc, 'summary', model.excluded.length ? '순위 밖·참고 테마와 그 이유' : '참고 테마와 그 이유'));
    if (model.excluded.length) excluded.append(el(doc, 'p', `수익률이 있는 구성 종목이 3개 미만인 ${model.excluded.length}개 세부 테마는 순위에서 뺐습니다.`, 'theme-strength-basis'));
    if (reference) excluded.append(el(doc, 'p', `3종목 세부 테마 ${reference}개는 중앙값이 한 종목에 크게 흔들려 순위 없이 '참고'로 표시합니다.`, 'theme-strength-basis'));
    for (const group of model.excluded) {
      const line = el(doc, 'div'); line.append(el(doc, 'p', `${group.themeName} / ${group.name}, 전체 ${group.listed}개 중 수익률 ${group.members}개`, 'theme-strength-basis'));
      const symbols = el(doc, 'div', null, 'theme-strength-constituents');
      symbols.dataset.roving = '';
      for (const symbol of group.constituents) {
        const button = el(doc, 'button', symbol, 'breadth-drill-symbol'); button.type = 'button';
        button.addEventListener('click', () => root?.showTicker?.(symbol)); symbols.append(button);
      }
      line.append(symbols); excluded.append(line);
    }
    host.append(excluded);
  }
}

// 개편 v2 (3f): the five strongest ranked sub-themes beside the sector scatter — the same model, window and rank
// as the table below (no second computation), with the rank-movement word and a link down to the full table.
const DIRECTION_CHIP = Object.freeze({ improving: 'sx-chip--good', steady: 'sx-chip--neutral', weakening: 'sx-chip--warn' });
function renderTopSubthemes(doc, host, model, basis) {
  const top = model.groups.filter((group) => group.rank != null && Number.isFinite(group[model.sortKey])).slice(0, 5);
  host.hidden = !top.length;
  host.replaceChildren();
  if (!top.length) return;
  const head = el(doc, 'div', null, 'sx-card__head');
  // The order is visible (rank numbers); "N 중앙값 순" became the title's hover.
  const title = el(doc, 'h3', `세부 테마 상위, ${model.windowLabel}`, 'sx-card__title');
  title.title = `구성 종목 ${model.windowLabel} 수익률 중앙값 순`;
  head.append(title);
  // A stale basis is a short chip (the full sentence is its hover), not a banner over the list.
  if (basis?.stale) { const chip = el(doc, 'span', basis.chip, 'sx-chip sx-chip--date v2-themes-top__stale'); chip.title = basis.label; head.append(chip); }
  host.append(head);
  const list = el(doc, 'ol', null, 'v2-themes-top__list');
  for (const group of top) {
    const li = el(doc, 'li', null, 'v2-themes-top__row');
    li.dataset.group = group.id;
    const name = el(doc, 'span', null, 'v2-themes-top__name');
    name.append(el(doc, 'b', group.name), el(doc, 'span', `${group.themeName}, ${group.listed}종목`, 'v2-themes-top__theme'));
    const dir = DIRECTION[group.direction];
    // v59.70 (re-review N1): no placeholder for a missing chip — a class-less span took the phone's third column and
    // pushed the value into a 20px cell. The value sits in the last column by CSS, whatever cells precede it.
    li.append(el(doc, 'span', String(group.rank), 'v2-themes-top__rank'), name);
    if (dir && !basis?.stale) li.append(el(doc, 'span', directionLabel(group, { short: true }), `sx-chip sx-chip--sm ${directionLabel(group) === dir[0] ? DIRECTION_CHIP[group.direction] || 'sx-chip--neutral' : 'sx-chip--neutral'}`));
    li.append(el(doc, 'b', pct(group[model.sortKey]), `v2-themes-top__value ${({ up: 'is-up', down: 'is-down' }[directionOf(group[model.sortKey])] || '')}`));
    list.append(li);
  }
  host.append(list);
  const more = el(doc, 'button', `세부 테마 전체 ${model.groups.length}개 순위와 구성 종목`, 'sx-row');
  more.type = 'button';
  more.append(el(doc, 'span', `S&P 500 ${model.windowLabel} ${pct(model.benchmark)}`, 'sx-row__meta'));
  more.addEventListener('click', () => doc.getElementById('theme-strength-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  host.append(more);
}

export function renderThemeStrength({ documentRef: doc, root, store }) {
  const strengthHost = doc?.getElementById('theme-strength-board');
  if (!strengthHost) return null;
  const rows = store?.getState?.()?.screener?.rows || [];
  const focusedGroup = strengthHost?.contains(doc.activeElement) ? doc.activeElement?.dataset?.compareGroup : null;
  // v59.70 (owner: a week over 15 sessions): 1주 leads, the same window as the sector bars and the hero; 1개월 stands in
  // while the screener carries no five-session returns.
  const chosen = STRENGTH_TABS.includes(root._aioThemeStrengthSort) ? root._aioThemeStrengthSort : null;
  const build = (sortKey) => buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey, benchmark: benchmarkReturns(root?._aioHistory || []) });
  let model = build(chosen || 'ret5d');
  if (!chosen && !model.groups.some((group) => group.ret5d != null)) model = build('ret1m');
  const rerender = () => renderThemeStrength({ documentRef: doc, root, store });
  renderStrength(doc, root, strengthHost, model, basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []), (key) => { root._aioThemeStrengthSort = key; rerender(); }, !!root._aioThemeStrengthExpanded, () => { root._aioThemeStrengthExpanded = !root._aioThemeStrengthExpanded; rerender(); }, (id) => { root._aioThemeMemberGroup = root._aioThemeMemberGroup === id ? null : id; rerender(); [...strengthHost.querySelectorAll('[data-compare-group]')].find((button) => button.dataset.compareGroup === id)?.focus(); }, (value) => { root._aioThemeStrengthOrder = value; rerender(); });
  strengthHost.dataset.aioThemeStrengthRenderer = 'native';
  const topHost = doc.getElementById('themes-top-subthemes');
  if (topHost) renderTopSubthemes(doc, topHost, model, basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []));
  if (focusedGroup) [...strengthHost.querySelectorAll('[data-compare-group]')].find((button) => button.dataset.compareGroup === focusedGroup)?.focus({ preventScroll: true }); // preserve comparison focus across an async data repaint
  return model;
}
