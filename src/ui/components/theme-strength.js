// P1417: the 테마 screen's daily "what changed" — sub-theme relative strength from the published
// screener returns (no live quotes needed), and the AI capital-spending flow linked to those themes.
import { themeStrengthLead } from '../../domain/market/page-flow.js';
import { sectionLead } from './page-flow.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { buildGroupStrength, GROUP_WINDOWS } from '../../domain/themes/group-strength.js';
import { latestCompletedUsSession } from '../../domain/market/market-calendar.js';
import { AI_CAPEX_FLOW, AI_BOTTLENECK_LEAD_TIMES } from '../../domain/themes/ai-capex-flow.js';
import { el } from './dom.js';
import { attachScrollCue } from './scroll-cue.js';
import { shortDate } from '../../domain/content/date-labels.js';

const SESSIONS = Object.freeze({ ret1m: 21, ret3m: 63, ret6m: 126 });
// Audit 19: rank movement words, kept apart from the playbook's stage words (주도·조정·반등·약세).
const DIRECTION = Object.freeze({ improving: ['최근 강해짐', 'favorable'], steady: ['큰 변화 없음', 'neutral'], weakening: ['최근 식음', 'burden'] });

const pct = (value, digits = 1) => (value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`);

// S&P 500 return over the same number of sessions, on the close basis (P1399).
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
    const us = /^\d{4}-\d{2}-\d{2}$/.test(sessions.US || '') ? sessions.US : null;

    if (us) {
      // X03 (2026-10-13): the date alone does not say whether the ranking may be read as today's leaders.
      const expected = latestCompletedUsSession(Date.now(), { requirePrevious: false })?.date || null;
      return expected && us < expected
        ? { label: `${shortDate(us)} 미국 종가 기준(최신 거래일 ${shortDate(expected)} 반영 전 — 지금의 주도가 아닌 기준일 참고 순위)`, stale: true }
        : { label: `${shortDate(us)} 미국 종가 기준` };
    }
  }
  // Without per-market dates, the completed US close of the shared history is the basis (the same date the
  // S&P 500 comparison in this line uses); the bar start is the last resort.
  const usClose = closeBasis(history);
  if (usClose) return { label: `${shortDate(usClose)} 미국 종가 기준` };
  const dates = rows.map((row) => String(row?.factorObservedAt || '').slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return dates.length ? { label: `${shortDate(dates[dates.length - 1])} 종가 기준` } : null;
}

function renderStrength(doc, root, host, model, basis, onSort, expanded, onToggle, onCompare) {
  host.replaceChildren();
  const head = el(doc, 'div', null, 'theme-strength-head');
  head.append(el(doc, 'h2', '미국 세부 테마 상대강도 순위', 'briefing-h2'));
  const controls = el(doc, 'div', null, 'theme-strength-controls');
  for (const [key, label] of Object.entries(GROUP_WINDOWS)) {
    const button = el(doc, 'button', label, `theme-strength-tab${model.sortKey === key ? ' is-active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-pressed', model.sortKey === key ? 'true' : 'false');
    button.addEventListener('click', () => onSort(key));
    controls.append(button);
  }
  head.append(controls);
  host.append(head);
  // P1431: what the order says, beyond the order — momentum moving and leaders cooling.
  // P1681 (X03 follow-up): on a stale basis the table stays as a dated reference, but the "now leading/improving"
  // reading is held — the same admission the US screener applies when it holds its ranks.
  const lead = basis?.stale ? '최신 거래일 종가가 아직 반영되지 않아 지금의 주도·개선 판단은 보류합니다. 아래 순위와 방향은 기준일 시점의 참고 값입니다.' : themeStrengthLead(model);
  if (lead) host.append(sectionLead(doc, lead));
  host.append(el(doc, 'p', `${basis ? basis.label : '스크리너 수익률 수신 대기'}, 구성 종목 ${model.windowLabel} 수익률의 중앙값으로 순위, S&P 500 ${model.windowLabel} ${pct(model.benchmark)}, 1주 = 최근 5거래일, 순위 변화: 1개월 순위가 3개월 순위보다 크게 오르면 '최근 강해짐', 크게 밀리면 '최근 식음'`, 'theme-strength-basis'));
  if (!model.groups.length) { host.append(el(doc, 'p', '스크리너 수익률이 들어오면 순위가 표시됩니다.', 'briefing-empty')); return; }
  const table = el(doc, 'table', null, 'theme-strength-table');
  const thead = el(doc, 'thead');
  const hr = el(doc, 'tr');
  // v57.55 review (S2/E3): without the S&P 500 return every 'S&P 대비' cell was '—'; the column is left out until it has values.
  const showVs = model.groups.some((group) => Number.isFinite(group.vsBenchmark));
  // v57.81 (audit): the 1주 column (5-session median) sits beside the month so a rank gain during a sharp week shows.
  const labels = ['순위', '세부 테마', '1주', '1개월', '3개월', '6개월', ...(showVs ? ['S&P 대비'] : []), '50일선 위', '순위 변화(3개월→1개월)', '구성 종목 전체'];
  labels.forEach((label) => hr.append(el(doc, 'th', label)));
  thead.append(hr);
  const tbody = el(doc, 'tbody');
  const visible = expanded ? model.groups : model.groups.slice(0, 15);
  for (const group of visible) {
    const tr = el(doc, 'tr');
    tr.dataset.group = group.id;
    // v57.50 D15: a group with fewer than 4 measured members is a reference row, not a ranked one.
    tr.append(el(doc, 'td', group.rank == null ? (group.smallSample ? '참고' : '—') : String(group.rank), 'is-rank'));
    const nameCell = el(doc, 'td');
    nameCell.append(el(doc, 'span', group.name, 'theme-strength-name'), el(doc, 'span', ` ${group.themeName}, ${group.listed}종목${group.members !== group.listed ? ` (수익률 ${group.members}개)` : ''}${group.smallSample ? `, 표본 ${group.members}종목, 참고` : ''}`, 'theme-strength-theme'));
    // v57.79 (375 review): the full-width '종목끼리 비교' button wrapped under the name and doubled every row's height;
    // a compact inline '비교' keeps the row one line taller at most, and its accessible name keeps the full action.
    const compare = el(doc, 'button', '비교', 'theme-strength-compare'); compare.type = 'button';
    compare.setAttribute('aria-label', `${group.name} 구성 종목끼리 비교`);
    compare.dataset.compareGroup = group.id;
    if (root._aioThemeMemberGroup === group.id) compare.setAttribute('aria-controls', `theme-members-${visible.indexOf(group)}`);
    compare.setAttribute('aria-expanded', String(root._aioThemeMemberGroup === group.id));
    compare.addEventListener('click', () => onCompare(group.id)); nameCell.append(compare);
    tr.append(nameCell);
    // v57.81: a week that fell beyond the group's typical weekly move (group.recent, recent-check.js) is said in the title.
    const week = el(doc, 'td', pct(group.ret5d ?? null), `is-num${group.ret5d == null ? '' : group.ret5d >= 0 ? ' is-up' : ' is-down'}`);
    if (group.recent?.broken) { week.title = '평소 1주 움직임의 2배를 넘는 하락'; week.dataset.recentBreak = 'true'; }
    tr.append(week);
    for (const key of ['ret1m', 'ret3m', 'ret6m']) tr.append(el(doc, 'td', pct(group[key]), `is-num${key === model.sortKey ? ' is-sorted' : ''}${group[key] >= 0 ? ' is-up' : ' is-down'}`));
    if (showVs) tr.append(el(doc, 'td', group.vsBenchmark == null ? '—' : `${pct(group.vsBenchmark)}p`, `is-num${group.vsBenchmark >= 0 ? ' is-up' : ' is-down'}`));
    tr.append(el(doc, 'td', group.above50Pct == null ? '—' : `${group.above50Pct}%`, 'is-num'));
    const dir = DIRECTION[group.direction];
    const dirCell = el(doc, 'td');
    if (dir) dirCell.append(el(doc, 'span', dir[0], `regime-state is-${dir[1]}`));
    tr.append(dirCell);
    const leaderCell = el(doc, 'td');
    const constituents = el(doc, 'div', null, 'theme-strength-constituents');
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
    if (root._aioThemeMemberGroup === group.id) {
      const detailRow = el(doc, 'tr'), detailCell = el(doc, 'td'); detailCell.colSpan = showVs ? 10 : 9; detailCell.className = 'theme-member-detail'; detailRow.id = `theme-members-${visible.indexOf(group)}`;
      detailCell.append(el(doc, 'p', `${group.name} 안의 ${model.windowLabel} 수익률 비교, ${group.basis ? `${group.basis} 종가 기준` : '기준일 불일치/미확인으로 순위·중앙값 비교 보류'}, 선두는 이 기간 수익률 순위입니다.`, 'theme-strength-basis'));
      const available = group.rankedMembers.filter((member) => member.rank != null);
      if (available.length) {
        const leaders = available.filter((member) => member.rank === 1).map((member) => member.sym).join(', ');
        const tail = available.filter((member) => member[model.sortKey] === available.at(-1)[model.sortKey]).map((member) => member.sym).join(', ');
        detailCell.append(el(doc, 'p', `${model.windowLabel} 선두 ${leaders}, 후행 ${tail}, 수익률 표본 ${available.length}/${group.listed}개`, 'theme-strength-basis'));
      }
      const memberTable = el(doc, 'table', null, 'theme-member-table'), memberHead = el(doc, 'thead'), heading = el(doc, 'tr');
      ['그룹 내 순위', '종목', '종가 기준일', '1개월', '3개월', '6개월', 'S&P 대비', '테마 중앙값 대비', '50일선 거리'].forEach((label) => heading.append(el(doc, 'th', label)));
      memberHead.append(heading); const memberBody = el(doc, 'tbody');
      for (const member of group.rankedMembers) {
        const row = el(doc, 'tr'); row.append(el(doc, 'td', member.rank == null ? member[model.sortKey] == null ? '자료 없음' : '비교 보류' : String(member.rank)));
        const cell = el(doc, 'td'), button = el(doc, 'button', member.sym, 'breadth-drill-symbol'); button.type = 'button'; button.title = member.name;
        button.addEventListener('click', () => root?.showTicker?.(member.sym)); cell.append(button); row.append(cell);
        row.append(el(doc, 'td', member.basis || '미확인'));
        for (const key of ['ret1m', 'ret3m', 'ret6m']) row.append(el(doc, 'td', pct(member[key]), 'is-num'));
        row.append(el(doc, 'td', member.vsBenchmark == null ? '—' : `${pct(member.vsBenchmark)}p`, 'is-num'));
        row.append(el(doc, 'td', !group.comparisonAligned || member[model.sortKey] == null ? '—' : `${pct(member[model.sortKey] - group[model.sortKey])}p`, 'is-num'));
        row.append(el(doc, 'td', pct(member.pctSma50), 'is-num')); memberBody.append(row);
      }
      memberTable.append(memberHead, memberBody); detailCell.append(memberTable); detailRow.append(detailCell); tbody.append(detailRow);
    }
  }
  table.append(thead, tbody);
  const scroll = el(doc, 'div', null, 'aio-table-scroll'); // v57.55 cleanup: on a phone the 9-column table ran past the screen with no way to scroll
  scroll.append(table);
  // v57.79 (375 review): the 6개월 column was cut at the screen edge with nothing saying the table scrolls. A shaded edge
  // appears on whichever side has more columns, and the region is a keyboard stop with its own name.
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', '세부 테마 상대강도 순위 표, 가로 스크롤');
  scroll.tabIndex = 0;
  const frame = el(doc, 'div', null, 'theme-strength-scroll');
  frame.append(scroll);
  host._aioScrollEdges?.disconnect?.();
  host.append(frame);
  host._aioScrollEdges = attachScrollCue(scroll, { frame, root }); // v57.81: shared helper (scroll-cue.js)
  const footer = el(doc, 'div', null, 'theme-strength-footer');
  if (model.groups.length > 15) {
    const more = el(doc, 'button', expanded ? '상위 15개만 보기' : `전체 ${model.groups.length}개 보기`, 'theme-strength-more');
    more.type = 'button';
    more.addEventListener('click', onToggle);
    footer.append(more);
  }
  if (model.excluded.length) footer.append(el(doc, 'span', `수익률이 있는 구성 종목이 3개 미만인 ${model.excluded.length}개 세부 테마는 순위에서 제외`, 'theme-strength-theme'));
  const reference = model.groups.filter((group) => group.smallSample).length;
  if (reference) footer.append(el(doc, 'span', `, 3종목 세부 테마 ${reference}개는 중앙값이 한 종목에 크게 흔들려 순위 없이 '참고'로 표시`, 'theme-strength-theme'));
  host.append(footer);
  if (model.excluded.length) {
    const excluded = el(doc, 'details', null, 'theme-strength-unranked');
    excluded.append(el(doc, 'summary', '순위 밖 테마의 전체 구성 보기'));
    for (const group of model.excluded) {
      const line = el(doc, 'div'); line.append(el(doc, 'p', `${group.themeName} / ${group.name}, 전체 ${group.listed}개 중 수익률 ${group.members}개`, 'theme-strength-basis'));
      const symbols = el(doc, 'div', null, 'theme-strength-constituents');
      for (const symbol of group.constituents) {
        const button = el(doc, 'button', symbol, 'breadth-drill-symbol'); button.type = 'button';
        button.addEventListener('click', () => root?.showTicker?.(symbol)); symbols.append(button);
      }
      line.append(symbols); excluded.append(line);
    }
    host.append(excluded);
  }
}

// v58.53 개편 v2 (3f): the five strongest ranked sub-themes beside the sector scatter — the same model, window and rank
// as the table below (no second computation), with the rank-movement word and a link down to the full table.
const DIRECTION_CHIP = Object.freeze({ improving: 'sx-chip--good', steady: 'sx-chip--neutral', weakening: 'sx-chip--warn' });
function renderTopSubthemes(doc, host, model, basis) {
  const top = model.groups.filter((group) => group.rank != null && Number.isFinite(group[model.sortKey])).slice(0, 5);
  host.hidden = !top.length;
  host.replaceChildren();
  if (!top.length) return;
  const head = el(doc, 'div', null, 'sx-card__head');
  head.append(el(doc, 'h3', '세부 테마 상위', 'sx-card__title'), el(doc, 'span', `${model.windowLabel} 중앙값 순`, 'sx-card__meta'));
  host.append(head);
  if (basis?.stale) host.append(el(doc, 'p', basis.label, 'sx-chip sx-chip--date v2-themes-top__stale'));
  const list = el(doc, 'ol', null, 'v2-themes-top__list');
  for (const group of top) {
    const li = el(doc, 'li', null, 'v2-themes-top__row');
    li.dataset.group = group.id;
    const name = el(doc, 'span', null, 'v2-themes-top__name');
    name.append(el(doc, 'b', group.name), el(doc, 'span', `${group.themeName}, ${group.listed}종목`, 'v2-themes-top__theme'));
    const dir = DIRECTION[group.direction];
    li.append(el(doc, 'span', String(group.rank), 'v2-themes-top__rank'), name,
      dir && !basis?.stale ? el(doc, 'span', dir[0], `sx-chip sx-chip--sm ${DIRECTION_CHIP[group.direction] || 'sx-chip--neutral'}`) : el(doc, 'span', ''),
      el(doc, 'b', pct(group[model.sortKey]), `v2-themes-top__value ${group[model.sortKey] >= 0 ? 'is-up' : 'is-down'}`));
    list.append(li);
  }
  host.append(list);
  const more = el(doc, 'button', `전체 ${model.groups.length}개 순위와 구성 종목`, 'sx-row');
  more.type = 'button';
  more.append(el(doc, 'span', `S&P 500 ${model.windowLabel} ${pct(model.benchmark)}`, 'sx-row__meta'));
  more.addEventListener('click', () => doc.getElementById('theme-strength-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  host.append(more);
}

// A whole theme's value = the median of its sub-theme medians on the newest common session (the playbook's method in
// src/domain/scenarios/theme-playbook.js), so the same theme never shows two different 3-month numbers on one page.
function themeGroupValues(model, themeId) {
  const values = (model.groups || []).filter((group) => group.themeId === themeId && group.current !== false && Number.isFinite(group[model.sortKey])).map((group) => group[model.sortKey]).sort((a, b) => a - b);
  if (!values.length) return { value: null, count: 0 };
  const mid = Math.floor(values.length / 2);
  return { value: values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2, count: values.length };
}

function renderCapexFlow(doc, root, host, model) {
  host.replaceChildren();
  host.append(el(doc, 'h2', AI_CAPEX_FLOW.title, 'briefing-h2'));
  // Expert review M20: the provider names sit in the hover title (and the page's folded 데이터 출처), the body keeps the date.
  // v57.79: the split is a published, dated research estimate (see ai-capex-flow.js `source`), so it is labelled as a
  // cited reference with its date — never as an AIO estimate.
  const basisLine = el(doc, 'p', `${AI_CAPEX_FLOW.asOf} 공개 리서치 인용 배분, 참고 자료(현재 신호 아님), 각 층의 관련 테마 수익률은 위 순위와 같은 ${model.windowLabel} 기준, 테마 값은 세부 테마 중앙값의 중앙값(테마 시나리오와 같은 방식)`, 'theme-strength-basis');
  basisLine.title = `출처: ${AI_CAPEX_FLOW.source}`;
  host.append(basisLine);
  const bar = el(doc, 'div', null, 'capex-flow-bar');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', AI_CAPEX_FLOW.layers.map((layer) => `${layer.label} ${layer.share}`).join(', '));
  // v57.79 (375 review): '네트워크 15', '냉각 7.5' were cut inside 7.5%-wide segments. The bar carries short labels only
  // (hidden on a phone), and the values sit in one legend line under it.
  const key = el(doc, 'p', null, 'capex-flow-legend');
  for (const layer of AI_CAPEX_FLOW.layers) {
    const seg = el(doc, 'div', null, `capex-flow-seg is-${layer.id}`);
    if (layer.share >= 10) seg.append(el(doc, 'span', layer.label, 'capex-flow-seg-label'));
    seg.style.flexBasis = `${layer.share}%`;
    bar.append(seg);
    const item = el(doc, 'span', null, 'capex-flow-key');
    item.append(el(doc, 'span', null, `capex-flow-swatch is-${layer.id}`), doc.createTextNode(`${layer.label} $${layer.share}`));
    key.append(item);
  }
  host.append(bar, key);
  const grid = el(doc, 'div', null, 'capex-flow-grid');
  // P1599 (F105/T08): one shared week axis for every card, derived from the data and stated on screen.
  const maxWeeks = Math.max(1, ...AI_BOTTLENECK_LEAD_TIMES.rows.map((row) => Number(row.weeks?.[1]) || 0));
  for (const layer of AI_CAPEX_FLOW.layers) {
    const card = el(doc, 'section', null, 'capex-flow-card');
    card.dataset.layer = layer.id;
    const head = el(doc, 'div', null, 'trend-card-head');
    // Live review 2026-10-14: the number is a share of a hypothetical 100달러 of AI capex (an estimate), not a spend or a
    // growth rate — the value and the note both say so.
    const value = el(doc, 'span', `$${layer.share} / $100`, 'trend-card-value');
    value.title = `AI 설비투자 100달러 중 ${layer.label}에 가는 몫 (${AI_CAPEX_FLOW.asOf} 공개 리서치 인용)`;
    head.append(el(doc, 'h3', layer.label, 'trend-card-title'), value);
    card.append(head, el(doc, 'p', `100달러 중 인용 배분, ${layer.parts}`, 'trend-card-note'));
    const links = el(doc, 'div', null, 'capex-flow-themes');
    for (const themeId of layer.themes) {
      const theme = model.themes?.[themeId];
      if (!theme) continue;
      // Audit 16: one method with the 테마 시나리오 cards — the median of the sub-theme medians on the latest session.
      const subs = themeGroupValues(model, themeId);
      const button = el(doc, 'button', `${theme.name} ${subs.value == null ? '비교 보류' : pct(subs.value)}`, 'capex-flow-theme');
      button.type = 'button';
      button.title = subs.value == null ? '같은 종가 기준일의 세부 테마 중앙값이 없어 비교를 보류합니다' : `세부 테마 ${subs.count}개의 대표값(중앙값) (테마 시나리오 카드와 같은 방식)`;
      button.addEventListener('click', () => { if (typeof root?.showThemeDetail === 'function') root.showThemeDetail(themeId); });
      links.append(button);
    }
    // M10: a layer can name one sub-theme (전력장비/그리드) instead of a whole theme.
    for (const groupId of layer.groups || []) {
      const group = model.groups?.find((row) => row.id === groupId);
      if (!group) continue;
      const button = el(doc, 'button', `${group.name} ${group[model.sortKey] == null ? '비교 보류' : pct(group[model.sortKey])}`, 'capex-flow-theme');
      button.type = 'button';
      if (group[model.sortKey] == null) button.title = '구성 종목의 종가 기준일이 달라 중앙값 비교를 보류합니다';
      button.addEventListener('click', () => { if (typeof root?.showThemeDetail === 'function') root.showThemeDetail(group.themeId); });
      links.append(button);
    }
    card.append(links);
    const waits = AI_BOTTLENECK_LEAD_TIMES.rows.filter((row) => row.layer === layer.id);
    if (waits.length) {
      const list = el(doc, 'ul', null, 'capex-flow-waits');
      for (const row of waits) {
        const li = el(doc, 'li', null, row.balanced ? 'is-balanced' : '');
        const meter = el(doc, 'span', null, 'capex-flow-meter');
        const fill = el(doc, 'span', null, 'capex-flow-meter-fill');
        fill.style.left = `${row.weeks[0] / maxWeeks * 100}%`;
        fill.style.width = `${Math.max(2, (row.weeks[1] - row.weeks[0]) / maxWeeks * 100)}%`;
        meter.title = `${row.item} 납기 ${row.weeks[0]}~${row.weeks[1]}주 (공통 축 0~${maxWeeks}주)`;
        meter.append(fill);
        li.append(el(doc, 'span', row.item, 'capex-flow-item'), meter, el(doc, 'span', `${row.weeks[0]}~${row.weeks[1]}주${row.balanced ? ', 원활' : ''}`, 'capex-flow-weeks'));
        list.append(li);
      }
      card.append(list);
    }
    grid.append(card);
  }
  host.append(el(doc, 'p', `각 카드 아래 막대는 관련 부품·장비의 납기 범위(최소~최대)입니다. 모든 카드가 같은 0~${maxWeeks}주 축이라 길이를 서로 비교할 수 있습니다.`, 'theme-strength-basis'));
  host.append(grid);
  const leadLine = el(doc, 'p', `납기: ${AI_BOTTLENECK_LEAD_TIMES.asOf} 기준 — ${AI_BOTTLENECK_LEAD_TIMES.note}`, 'theme-strength-basis');
  leadLine.title = `출처: ${AI_BOTTLENECK_LEAD_TIMES.source}`;
  host.append(leadLine);
}

export function renderThemeStrength({ documentRef: doc, root, store }) {
  const strengthHost = doc?.getElementById('theme-strength-board');
  const flowHost = doc?.getElementById('ai-capex-flow');
  if (!strengthHost && !flowHost) return null;
  const rows = store?.getState?.()?.screener?.rows || [];
  const focusedGroup = strengthHost?.contains(doc.activeElement) ? doc.activeElement?.dataset?.compareGroup : null;
  const sortKey = root._aioThemeStrengthSort || 'ret3m';
  const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey, benchmark: benchmarkReturns(root?._aioHistory || []) });
  const rerender = () => renderThemeStrength({ documentRef: doc, root, store });
  if (strengthHost) {
    renderStrength(doc, root, strengthHost, model, basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []), (key) => { root._aioThemeStrengthSort = key; rerender(); }, !!root._aioThemeStrengthExpanded, () => { root._aioThemeStrengthExpanded = !root._aioThemeStrengthExpanded; rerender(); }, (id) => { root._aioThemeMemberGroup = root._aioThemeMemberGroup === id ? null : id; rerender(); [...strengthHost.querySelectorAll('[data-compare-group]')].find((button) => button.dataset.compareGroup === id)?.focus(); });
    strengthHost.dataset.aioThemeStrengthRenderer = 'native';
    const topHost = doc.getElementById('themes-top-subthemes');
    if (topHost) renderTopSubthemes(doc, topHost, model, basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []));
    if(focusedGroup) [...strengthHost.querySelectorAll('[data-compare-group]')].find(button=>button.dataset.compareGroup===focusedGroup)?.focus({preventScroll:true}); // P1622 preserve comparison focus across async data repaint too.
  }
  if (flowHost) { renderCapexFlow(doc, root, flowHost, model); flowHost.dataset.aioCapexFlowRenderer = 'native'; }
  return model;
}
