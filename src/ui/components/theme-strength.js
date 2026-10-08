// P1417: the 테마 screen's daily "what changed" — sub-theme relative strength from the published
// screener returns (no live quotes needed), and the AI capital-spending flow linked to those themes.
import { themeStrengthLead } from '../../domain/market/page-flow.js';
import { sectionLead } from './page-flow.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { buildGroupStrength, GROUP_WINDOWS } from '../../domain/themes/group-strength.js';
import { AI_CAPEX_FLOW, AI_BOTTLENECK_LEAD_TIMES } from '../../domain/themes/ai-capex-flow.js';

const SESSIONS = Object.freeze({ ret1m: 21, ret3m: 63, ret6m: 126 });
const DIRECTION = Object.freeze({ improving: ['개선', 'favorable'], steady: ['유지', 'neutral'], weakening: ['약화', 'burden'] });

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const pct = (value, digits = 1) => (value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`);

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

// S&P 500 return over the same number of sessions, on the close basis (P1399).
export function benchmarkReturns(history = []) {
  const spx = buildCloseSeries(history, 'spx', { through: closeBasis(history) });
  const last = spx[spx.length - 1];
  const out = {};
  for (const [key, n] of Object.entries(SESSIONS)) {
    const then = spx.length > n ? spx[spx.length - 1 - n] : null;
    out[key] = last && then ? (last.value / then.value - 1) * 100 : null;
  }
  return out;
}

// Codex browser audit H24: factorObservedAt is a bar start (the Korean session's 10/7 00:00 UTC), so during
// the US session it printed "10/7 종가 기준" for US closes of 10/6. The basis is the completed session date
// per market; the bar start is only a fallback for artifacts without per-market dates.
function basisOf(rows, metadata = null, history = []) {
  const sessions = metadata?.factorSessionDateByMarket;
  if (sessions && typeof sessions === 'object') {
    const us = /^d{4}-d{2}-d{2}$/.test(sessions.US || '') ? sessions.US : null;
    const kr = /^d{4}-d{2}-d{2}$/.test(sessions.KR || '') ? sessions.KR : null;
    if (us && kr && us !== kr) return { label: `미국 ${shortDate(us)} · 한국 ${shortDate(kr)} 종가 기준` };
    if (us || kr) return { label: `${shortDate(us || kr)} 종가 기준` };
  }
  // Without per-market dates, the completed US close of the shared history is the basis (the same date the
  // S&P 500 comparison in this line uses); the bar start is the last resort.
  const usClose = closeBasis(history);
  if (usClose) return { label: `${shortDate(usClose)} 미국 종가 기준` };
  const dates = rows.map((row) => String(row?.factorObservedAt || '').slice(0, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  return dates.length ? { label: `${shortDate(dates[dates.length - 1])} 종가 기준` } : null;
}

function renderStrength(doc, root, host, model, basis, onSort, expanded, onToggle) {
  host.replaceChildren();
  const head = el(doc, 'div', null, 'theme-strength-head');
  head.append(el(doc, 'h2', '하위 테마 상대강도 순위', 'briefing-h2'));
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
  const lead = themeStrengthLead(model);
  if (lead) host.append(sectionLead(doc, lead));
  host.append(el(doc, 'p', `${basis ? basis.label : '스크리너 수익률 수신 대기'} · 구성 종목 ${model.windowLabel} 수익률의 중앙값으로 순위 · S&P 500 ${model.windowLabel} ${pct(model.benchmark)} · 방향은 1개월 순위와 3개월 순위 비교(1개월이 크게 앞서면 개선)`, 'theme-strength-basis'));
  if (!model.groups.length) { host.append(el(doc, 'p', '스크리너 수익률이 들어오면 순위가 표시됩니다.', 'briefing-empty')); return; }
  const table = el(doc, 'table', null, 'theme-strength-table');
  const thead = el(doc, 'thead');
  const hr = el(doc, 'tr');
  ['순위', '하위 테마', '1개월', '3개월', '6개월', 'S&P 대비', '50일선 위', '방향', '대표 종목'].forEach((label) => hr.append(el(doc, 'th', label)));
  thead.append(hr);
  const tbody = el(doc, 'tbody');
  const visible = expanded ? model.groups : model.groups.slice(0, 15);
  for (const group of visible) {
    const tr = el(doc, 'tr');
    tr.dataset.group = group.id;
    tr.append(el(doc, 'td', group.rank == null ? '—' : String(group.rank), 'is-rank'));
    const nameCell = el(doc, 'td');
    nameCell.append(el(doc, 'span', group.name, 'theme-strength-name'), el(doc, 'span', ` ${group.themeName} · ${group.members}종목`, 'theme-strength-theme'));
    tr.append(nameCell);
    for (const key of ['ret1m', 'ret3m', 'ret6m']) tr.append(el(doc, 'td', pct(group[key]), `is-num${key === model.sortKey ? ' is-sorted' : ''}${group[key] >= 0 ? ' is-up' : ' is-down'}`));
    tr.append(el(doc, 'td', pct(group.vsBenchmark), `is-num${group.vsBenchmark >= 0 ? ' is-up' : ' is-down'}`));
    tr.append(el(doc, 'td', group.above50Pct == null ? '—' : `${group.above50Pct}%`, 'is-num'));
    const dir = DIRECTION[group.direction];
    const dirCell = el(doc, 'td');
    if (dir) dirCell.append(el(doc, 'span', dir[0], `regime-state is-${dir[1]}`));
    tr.append(dirCell);
    const leaderCell = el(doc, 'td');
    if (group.leader) {
      const button = el(doc, 'button', group.leader.sym, 'breadth-drill-symbol');
      button.type = 'button';
      button.title = group.leader.name;
      button.addEventListener('click', () => { if (typeof root?.showTicker === 'function') root.showTicker(group.leader.sym); });
      leaderCell.append(button, el(doc, 'span', ` ${pct(group.leader.value, 0)}`, 'theme-strength-theme'));
    }
    tr.append(leaderCell);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  host.append(table);
  const footer = el(doc, 'div', null, 'theme-strength-footer');
  if (model.groups.length > 15) {
    const more = el(doc, 'button', expanded ? '상위 15개만 보기' : `전체 ${model.groups.length}개 보기`, 'theme-strength-more');
    more.type = 'button';
    more.addEventListener('click', onToggle);
    footer.append(more);
  }
  if (model.excluded.length) footer.append(el(doc, 'span', `수익률이 있는 구성 종목이 3개 미만인 ${model.excluded.length}개 하위 테마는 순위에서 제외`, 'theme-strength-theme'));
  host.append(footer);
}

function renderCapexFlow(doc, root, host, model) {
  host.replaceChildren();
  host.append(el(doc, 'h2', AI_CAPEX_FLOW.title, 'briefing-h2'));
  host.append(el(doc, 'p', `${AI_CAPEX_FLOW.source} · 참고 자료(현재 신호 아님) · 각 층의 관련 테마 수익률은 위 순위와 같은 ${model.windowLabel} 기준`, 'theme-strength-basis'));
  const bar = el(doc, 'div', null, 'capex-flow-bar');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', AI_CAPEX_FLOW.layers.map((layer) => `${layer.label} ${layer.share}`).join(', '));
  for (const layer of AI_CAPEX_FLOW.layers) {
    const seg = el(doc, 'div', `${layer.label} ${layer.share}`, `capex-flow-seg is-${layer.id}`);
    seg.style.flexBasis = `${layer.share}%`;
    bar.append(seg);
  }
  host.append(bar);
  const grid = el(doc, 'div', null, 'capex-flow-grid');
  for (const layer of AI_CAPEX_FLOW.layers) {
    const card = el(doc, 'section', null, 'capex-flow-card');
    card.dataset.layer = layer.id;
    const head = el(doc, 'div', null, 'trend-card-head');
    head.append(el(doc, 'h3', layer.label, 'trend-card-title'), el(doc, 'span', `$${layer.share}`, 'trend-card-value'));
    card.append(head, el(doc, 'p', layer.parts, 'trend-card-note'));
    const links = el(doc, 'div', null, 'capex-flow-themes');
    for (const themeId of layer.themes) {
      const theme = model.themes?.[themeId];
      if (!theme) continue;
      const button = el(doc, 'button', `${theme.name} ${pct(theme.value)}`, 'capex-flow-theme');
      button.type = 'button';
      button.addEventListener('click', () => { if (typeof root?.showThemeDetail === 'function') root.showThemeDetail(themeId); });
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
        fill.style.left = `${row.weeks[0] / 420 * 100}%`;
        fill.style.width = `${Math.max(2, (row.weeks[1] - row.weeks[0]) / 420 * 100)}%`;
        meter.append(fill);
        li.append(el(doc, 'span', row.item, 'capex-flow-item'), meter, el(doc, 'span', `${row.weeks[0]}~${row.weeks[1]}주${row.balanced ? ' · 원활' : ''}`, 'capex-flow-weeks'));
        list.append(li);
      }
      card.append(list);
    }
    grid.append(card);
  }
  host.append(grid);
  host.append(el(doc, 'p', `리드타임: ${AI_BOTTLENECK_LEAD_TIMES.source} — ${AI_BOTTLENECK_LEAD_TIMES.note}`, 'theme-strength-basis'));
}

export function renderThemeStrength({ documentRef: doc, root, store }) {
  const strengthHost = doc?.getElementById('theme-strength-board');
  const flowHost = doc?.getElementById('ai-capex-flow');
  if (!strengthHost && !flowHost) return null;
  const rows = store?.getState?.()?.screener?.rows || [];
  const sortKey = root._aioThemeStrengthSort || 'ret3m';
  const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey, benchmark: benchmarkReturns(root?._aioHistory || []) });
  const rerender = () => renderThemeStrength({ documentRef: doc, root, store });
  if (strengthHost) {
    renderStrength(doc, root, strengthHost, model, basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []), (key) => { root._aioThemeStrengthSort = key; rerender(); }, !!root._aioThemeStrengthExpanded, () => { root._aioThemeStrengthExpanded = !root._aioThemeStrengthExpanded; rerender(); });
    strengthHost.dataset.aioThemeStrengthRenderer = 'native';
  }
  if (flowHost) { renderCapexFlow(doc, root, flowHost, model); flowHost.dataset.aioCapexFlowRenderer = 'native'; }
  return model;
}
