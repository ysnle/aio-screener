// 산업 지도 › AI 지도 (owner 2026-11-19): one document with three maps — 밸류체인 (the seven layers as cards, each naming
// the higher layers it supplies; downward links in the raw table), 데이터센터·전력 (power to cloud in five stages
// on the shared node graph, src/ui/components/node-graph.js) and 자본순환 (one company in focus: the money coming in, the
// commitments going out, and the companies on both sides). Folds are only the raw table, the method and the sources
// (indicator-face.js kindFold). The data comes shaped from src/domain/knowledge/ai-map.js; nothing here computes a figure
// or writes a reading. Controls carry data-atlas-action (atlas.js owns the state and the address); company chips open the
// 종목 screen through the shared showTicker action, as the layer card does.
import { el } from './research-shell.js';
import { createNodeGraph, columnPositions } from '../components/node-graph.js';
import { kindFold } from '../components/indicator-face.js';
import { applySafeExternalLink } from './safe-external-link.js';
import { AI_MAPS, CAPITAL_EDGE_KINDS, CAPITAL_ROLE_WORDS, CAPITAL_STALE_DAYS, REPORT_STATUS, capitalCompanies, capitalFocus, companySupplyPairs, layerUpwardSupply } from '../../domain/knowledge/ai-map.js';
import { moneyText } from '../../domain/entity/company-story.js';
import { usdKoreanText } from '../../domain/shared/number.js';

const FIELD_WORD = Object.freeze({ customers: '고객 목록', sellsTo: 'AI 사슬의 판매처', moneyFlow: '돈의 흐름', make: '생산·협력', dependsOn: 'AI 사슬의 의존처' });

function action(doc, tag, className, text, name, value, { pressed = null } = {}) {
  const node = el(doc, tag, className, text);
  if (tag === 'button') node.type = 'button';
  node.dataset.atlasAction = name;
  if (value != null) node.dataset.atlasValue = String(value);
  if (pressed != null) node.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  return node;
}

function tickerChip(doc, symbol, label, title) {
  const chip = el(doc, 'button', 'sx-chip sx-chip--sm nmap-ticker', label);
  chip.type = 'button';
  chip.dataset.action = 'showTicker';
  chip.dataset.arg = symbol;
  chip.title = title;
  chip.setAttribute('aria-label', title);
  return chip;
}

// A company in a pair: a listed company opens its 종목 screen; a private one is plain text.
function companyName(doc, symbol, name, isPrivate, said) {
  const hover = (said || []).map((s) => `${s.by} 이야기(${FIELD_WORD[s.field] || s.field}): ${s.text}`).join('\n');
  if (isPrivate) { const span = el(doc, 'span', 'nmap-company is-private', name); if (hover) span.title = hover; return span; }
  return tickerChip(doc, symbol, name, `${name} (${symbol}), 종목 개요 열기${hover ? `\n${hover}` : ''}`);
}

function mapTabs(doc, maps, current) {
  const row = el(doc, 'div', 'sx-seg nmap-tabs');
  row.setAttribute('role', 'tablist');
  row.setAttribute('aria-label', 'AI 지도 종류');
  for (const map of maps) {
    const tab = action(doc, 'button', `nmap-tab${map.id === current ? ' is-active' : ''}`, map.label, 'ai-map', map.id);
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(map.id === current));
    tab.setAttribute('aria-controls', `ai-map-${map.id}`);
    row.appendChild(tab);
  }
  return row;
}

function sourceList(doc, rows) {
  const list = el(doc, 'ul', 'nmap-sources');
  for (const row of rows.filter(Boolean)) {
    const item = el(doc, 'li');
    if (row.url) { const link = el(doc, 'a', 'nmap-source-link', row.label); applySafeExternalLink(link, row.url); item.appendChild(link); } else item.textContent = row.label;
    if (row.note) item.appendChild(el(doc, 'span', 'nmap-source-note', ` ${row.note}`));
    list.appendChild(item);
  }
  return list;
}

// ── 1. 밸류체인 ─────────────────────────────────────────────────────────────────────────────────────────────────────

function valueChainMap(doc, { layers, playersOf, supply, selection }) {
  const section = el(doc, 'section', 'nmap nmap--chain');
  section.id = 'ai-map-value-chain';
  const byN = new Map(layers.map((layer) => [layer.n, layer]));
  const layerName = (n) => `${n}층 ${byN.get(n)?.title || ''}`.trim();
  const { up, down } = layerUpwardSupply(supply);
  const clear = () => action(doc, 'button', 'nmap-clear', '닫기', 'ai-map-clear', 'value-chain');
  const pairList = (pairs) => {
    const list = el(doc, 'ul', 'nmap-pairs');
    for (const pair of pairs) {
      const row = el(doc, 'li', 'nmap-pair');
      row.append(companyName(doc, pair.supplier, pair.supplierName, pair.supplierPrivate, pair.said), el(doc, 'span', 'nmap-pair-arrow', '→'), companyName(doc, pair.buyer, pair.buyerName, pair.buyerPrivate, pair.said));
      list.appendChild(row);
    }
    return list;
  };
  const detail = (title, sub, ...body) => {
    const box = el(doc, 'div', 'nmap-detail');
    box.setAttribute('aria-live', 'polite');
    box.append(el(doc, 'h3', 'af-section nmap-detail-title', title));
    if (sub) box.appendChild(el(doc, 'p', 'nmap-detail-sub', sub));
    box.append(...body.filter(Boolean), clear());
    return box;
  };
  const linkDetail = (link) => detail(`${layerName(link.from)} → ${layerName(link.to)}, ${link.count}건`, '공급하는 곳 → 사는 곳', pairList(link.pairs));
  const playerChip = (player) => (player.symbol ? tickerChip(doc, player.symbol, player.label, `${player.name}${player.note ? ` (${player.note})` : ''}, 종목 개요 열기`) : Object.assign(el(doc, 'span', 'sx-chip sx-chip--sm nmap-company is-private', player.label), { title: player.note ? `${player.name}, ${player.note}` : player.name }));

  if (selection.node) {
    const pairs = companySupplyPairs(supply, selection.node);
    const name = pairs[0] ? (pairs[0].supplier === selection.node ? pairs[0].supplierName : pairs[0].buyerName) : selection.node;
    section.appendChild(detail(`${name}, 공급 관계 ${pairs.length}건`, pairs.length ? '공급하는 곳 → 사는 곳' : '조사한 회사 스토리에 이 회사가 낀 공급 문장 없음', pairs.length ? pairList(pairs) : null));
  }
  section.appendChild(el(doc, 'p', 'nmap-legend', '아래층이 위층에 공급합니다. 공급하는 곳의 숫자는 회사 스토리에 적힌 공급 관계 수.'));

  // Layer 7 on top; each card names every higher layer it supplies, and a picked one opens its pairs under the card.
  const stack = el(doc, 'ol', 'nmap-stack');
  stack.setAttribute('aria-label', 'AI 밸류체인 7개 층, 위가 7층');
  [...layers].sort((a, b) => b.n - a.n).forEach((layer) => {
    const item = el(doc, 'li', `nmap-layer-item${selection.layer === layer.n ? ' is-selected' : ''}`);
    const card = el(doc, 'div', 'nmap-layer');
    const open = action(doc, 'button', 'nmap-layer-open', null, 'ai-map-layer', layer.n, { pressed: selection.layer === layer.n });
    open.append(el(doc, 'span', 'nmap-layer-n', String(layer.n)), el(doc, 'b', 'nmap-layer-name', layer.title), el(doc, 'span', 'nmap-layer-desc', layer.desc));
    open.setAttribute('aria-label', `${layerName(layer.n)}, ${layer.desc}, 회사 보기`);
    card.appendChild(open);
    const players = playersOf(layer);
    const chips = el(doc, 'div', 'nmap-layer-chips');
    players.filter((player) => player.symbol).slice(0, 5).forEach((player) => chips.appendChild(playerChip(player)));
    if (players.length > 5) chips.appendChild(el(doc, 'span', 'nmap-layer-more', `외 ${players.length - 5}곳`));
    if (chips.childElementCount) card.appendChild(chips);
    const targets = up.get(layer.n) || [];
    if (targets.length) {
      const line = el(doc, 'p', 'nmap-supplies');
      line.appendChild(el(doc, 'span', 'nmap-supplies-label', '공급하는 곳'));
      targets.forEach((link) => {
        const b = action(doc, 'button', 'nmap-supplies-open', `${byN.get(link.to)?.title || `${link.to}층`} ${link.count}건`, 'ai-map-link', link.id, { pressed: selection.link === link.id });
        b.setAttribute('aria-label', `${layerName(link.from)} → ${layerName(link.to)} 공급 관계 ${link.count}건, 회사 쌍 보기`);
        line.appendChild(b);
      });
      card.appendChild(line);
    }
    item.appendChild(card);
    const picked = targets.find((link) => link.id === selection.link);
    if (picked) item.appendChild(linkDetail(picked));
    if (selection.layer === layer.n) {
      const inner = supply.within.get(layer.n) || [];
      const all = el(doc, 'div', 'nmap-layer-chips');
      players.forEach((player) => all.appendChild(playerChip(player)));
      item.appendChild(detail(layerName(layer.n), layer.desc, players.length ? all : null, inner.length ? el(doc, 'p', 'nmap-detail-sub', `층 안 공급 관계 ${inner.length}건`) : null, inner.length ? pairList(inner) : null));
    }
    stack.appendChild(item);
  });
  section.appendChild(stack);

  const downLink = down.find((link) => link.id === selection.link);
  if (downLink) section.appendChild(linkDetail(downLink));
  const table = el(doc, 'table', 'nmap-table');
  const headRow = el(doc, 'tr');
  ['공급하는 층', '사는 층', '건수'].forEach((label) => headRow.appendChild(el(doc, 'th', null, label)));
  const thead = el(doc, 'thead');
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = el(doc, 'tbody');
  down.forEach((link) => {
    const tr = el(doc, 'tr');
    const count = el(doc, 'td');
    count.appendChild(action(doc, 'button', 'nmap-table-open', `${link.count}건`, 'ai-map-link', link.id, { pressed: selection.link === link.id }));
    tr.append(el(doc, 'td', null, layerName(link.from)), el(doc, 'td', null, layerName(link.to)), count);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  const withinCount = [...supply.within.values()].reduce((sum, pairs) => sum + pairs.length, 0);
  const downCount = down.reduce((sum, link) => sum + link.count, 0);
  const upCount = [...up.values()].flat().reduce((sum, link) => sum + link.count, 0);
  section.append(
    kindFold(doc, 'raw-table', `아래층으로 가는 공급 ${downCount}건`, [table]),
    kindFold(doc, 'method', '공급 관계를 센 방법', [el(doc, 'p', 'nmap-fold-copy', `조사한 회사 스토리(무엇을 하는 회사 탭)의 고객·판매처·돈의 흐름 문장이 다른 조사 기업을 정확한 이름으로 부를 때 생기는 공급 관계(전체 ${supply.total}건)를 공급하는 회사의 층에서 사는 회사의 층으로 셉니다. 위층으로 가는 ${upCount}건은 공급하는 층의 카드에, 아래층으로 가는 ${downCount}건은 원자료 표에 둡니다. 같은 층 안 ${withinCount}건은 그 층을 누르면 보이고, 한쪽이 일곱 층 밖(비상장 AI 연구소, AI를 쓰는 기업 등)인 ${supply.outside.length}건은 세지 않습니다. 문장 하나가 관계 하나이며 거래 금액이나 크기를 뜻하지 않습니다. 각 관계의 원문 문장은 회사 이름에 마우스를 올리면 보입니다.`)])
  );
  return section;
}

// ── 2. 데이터센터·전력 ─────────────────────────────────────────────────────────────────────────────────────────────

function datacenterMap(doc, { chain, nodeLabel, selection }) {
  const section = el(doc, 'section', 'nmap nmap--dc');
  section.id = 'ai-map-datacenter';
  const stages = chain.stages;
  const selected = stages.find((stage) => stage.id === selection.node) || stages[0];
  // One column, power at the top: the stage names and the guide's link names both stay readable at any width.
  const positions = columnPositions([stages.map((stage) => stage.id)], { left: 30, right: 30, top: 0, bottom: 100 });
  const edges = chain.links.map((link) => ({ from: link.from, to: link.to, arrow: true, label: link.label, active: link.from === selected.id || link.to === selected.id, className: link.criticality === 'conditional' ? 'is-conditional' : '', title: `${stages.find((s) => s.id === link.from)?.label} → ${stages.find((s) => s.id === link.to)?.label}: ${link.label}` }));
  const share = (stage) => stage.capex.reduce((sum, layer) => sum + (Number(layer.share) || 0), 0);
  const graph = createNodeGraph(doc, {
    nodes: stages, edges, positions, width: 1000, height: 720, prefix: 'nmap', selectedId: selected.id, trim: { x: 20, y: 4.5 },
    label: `데이터센터·전력 사슬 ${stages.length}단계, ${stages.map((stage) => stage.label).join(' → ')}. 아래 목록에 같은 내용이 있습니다.`,
    nodeClass: () => 'nmap-node--stage',
    renderNode: (stage) => {
      const b = action(doc, 'button', 'nmap-stage-open', null, 'ai-map-node', stage.id, { pressed: stage.id === selected.id });
      b.appendChild(el(doc, 'b', 'nmap-stage-name', stage.label));
      if (share(stage)) b.appendChild(el(doc, 'span', 'nmap-stage-share', `100달러 중 ${share(stage)}`));
      return b;
    }
  });
  const legend = el(doc, 'p', 'nmap-legend');
  legend.append(el(doc, 'span', 'nmap-key', '화살표, 전력에서 서비스 쪽'), el(doc, 'span', 'nmap-key', `100달러 중, AI 설비투자 분배 참고 자료(${chain.capexAsOf || '기준일 미상'})`));
  section.append(legend, graph);

  const list = el(doc, 'ol', 'nmap-rows nmap-rows--stages nmap-only-list');
  stages.forEach((stage, index) => {
    const row = el(doc, 'li', `nmap-row${stage.id === selected.id ? ' is-active' : ''}`);
    const b = action(doc, 'button', 'nmap-row-open', null, 'ai-map-node', stage.id, { pressed: stage.id === selected.id });
    b.append(el(doc, 'span', 'nmap-row-n', String(index + 1)), el(doc, 'b', 'nmap-row-from', stage.label));
    if (share(stage)) b.appendChild(el(doc, 'span', 'nmap-row-count', `100달러 중 ${share(stage)}`));
    row.appendChild(b);
    const next = chain.links.find((link) => link.from === stage.id);
    if (next) row.appendChild(el(doc, 'span', 'nmap-row-next', `→ ${next.label}`));
    list.appendChild(row);
  });
  section.appendChild(list);

  const detail = el(doc, 'div', 'nmap-detail');
  detail.setAttribute('aria-live', 'polite');
  detail.appendChild(el(doc, 'h3', 'af-section nmap-detail-title', selected.label));
  if (selected.atlasNodes.length) {
    const parts = el(doc, 'div', 'nmap-parts');
    selected.atlasNodes.forEach((id) => parts.appendChild(action(doc, 'button', 'nmap-part', nodeLabel(id), 'domain-node', id)));
    detail.append(el(doc, 'p', 'nmap-detail-sub', '산업 지도의 세부 영역'), parts);
  }
  if (selected.capex.length) {
    const rows = el(doc, 'ul', 'nmap-facts');
    selected.capex.forEach((layer) => { const li = el(doc, 'li'); li.append(el(doc, 'b', null, `${layer.label} ${layer.share}`), el(doc, 'span', 'nmap-fact-note', layer.parts)); rows.appendChild(li); });
    const head = el(doc, 'p', 'nmap-detail-sub', `AI 설비투자 100달러 중, 참고 자료 ${chain.capexAsOf || ''}`.trim());
    if (chain.capexSource) head.title = chain.capexSource;
    detail.append(head, rows);
  }
  if (selected.leadTimes.length) {
    const rows = el(doc, 'ul', 'nmap-facts nmap-facts--lead');
    selected.leadTimes.forEach((row) => { const li = el(doc, 'li'); li.append(el(doc, 'b', null, row.item), el(doc, 'span', 'nmap-fact-note', `${row.weeks[0]}~${row.weeks[1]}주`)); rows.appendChild(li); });
    const head = el(doc, 'p', 'nmap-detail-sub', `납기, 참고 자료 ${chain.leadAsOf || ''}`.trim());
    if (chain.leadSource) head.title = chain.leadSource;
    detail.append(head, rows);
  }
  if (selected.bigtech) {
    const b = selected.bigtech;
    const rows = el(doc, 'ul', 'nmap-facts');
    [['설비투자', usdKoreanText(b.capex)], ['영업현금흐름', usdKoreanText(b.ocf)], ['잉여현금흐름', usdKoreanText(b.fcf)], ['설비투자 ÷ 영업현금흐름', b.capexToOcfPct == null ? null : `${b.capexToOcfPct}%`]]
      .filter(([, value]) => value && value !== '—').forEach(([label, value]) => { const li = el(doc, 'li'); li.append(el(doc, 'b', null, label), el(doc, 'span', 'nmap-fact-note', value)); rows.appendChild(li); });
    const range = b.endRange?.length === 2 ? (b.endRange[0] === b.endRange[1] ? b.endRange[0] : `${b.endRange[0]}~${b.endRange[1]}`) : '';
    const head = el(doc, 'p', 'nmap-detail-sub', `빅테크 ${b.members.length}개사 최근 4분기 합계, 분기 말 ${range}`);
    head.title = `${b.members.join(', ')}${chain.bigtechSource ? ` · ${chain.bigtechSource}` : ''}`;
    detail.append(head, rows);
  }
  if (selected.guideNodes.length) detail.append(el(doc, 'p', 'nmap-detail-sub', `전력(GW)에서 토큰까지, ${selected.guideNodes.map((node) => node.label).join(', ')}`));
  section.appendChild(detail);
  section.append(
    kindFold(doc, 'method', '단계 나누기', [el(doc, 'p', 'nmap-fold-copy', '다섯 단계는 관계 가이드 "전력(GW)에서 토큰까지"의 일곱 개념과 산업 지도의 전력·데이터센터·연산·클라우드 세부 영역을 전력 공급에서 서비스까지의 위치로 묶은 것입니다. 단계 사이 화살표의 이름은 가이드의 연결 이름이고, 100달러 분배와 납기는 날짜가 있는 참고 자료이며 지금 값이 아닙니다.')]),
    kindFold(doc, 'sources', '참고 자료', [sourceList(doc, [
      chain.capexSource ? { label: chain.capexSource } : null,
      chain.leadSource ? { label: chain.leadSource } : null,
      chain.bigtechSource ? { label: `빅테크 현금흐름: ${chain.bigtechSource}` } : null,
      { label: `관계 가이드 전력(GW)에서 토큰까지${chain.guideAsOf ? `, ${chain.guideAsOf}` : ''}: 미 에너지부 데이터센터 자료 외` }
    ])])
  );
  return section;
}

// ── 3. 자본순환 ─────────────────────────────────────────────────────────────────────────────────────────────────────

function amountText(edge) {
  if (edge.amount == null) return null;
  if (edge.unit === 'gw') return `${edge.amount}GW`;
  return moneyText(edge.amount, edge.unit) || `${edge.amount} ${edge.unit}`;
}

// One deal as seen from the focus: who is on the other end (a button that puts them in focus), the figure as stated, a bar
// within its column for a dollar figure, then the kind, the guarantee's other party, status and date, and the basis.
function flowRow(doc, { edge, counterparty, other, share, bothSides }) {
  const report = edge.sourceKind === 'report';
  const item = el(doc, 'li', `nmap-flow${report ? ' is-report' : ''}${bothSides ? ' is-both' : ''}`);
  item.dataset.edgeId = edge.id;
  item.title = edge.what;
  const head = el(doc, 'p', 'nmap-flow-head');
  const who = action(doc, 'button', 'nmap-flow-who', counterparty.name, 'ai-map-node', counterparty.id);
  who.setAttribute('aria-label', `${counterparty.name}${counterparty.listed ? '' : ', 비상장'}, 이 회사 중심으로 보기`);
  head.appendChild(who);
  if (bothSides) head.appendChild(el(doc, 'span', 'nmap-both', '양쪽에 있음'));
  head.appendChild(el(doc, 'b', 'nmap-flow-amount', amountText(edge) || '금액 없음'));
  item.appendChild(head);
  if (share != null) {
    const bar = el(doc, 'span', 'nmap-bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = el(doc, 'span', 'nmap-bar-fill');
    fill.style.width = `${Math.max(1, share * 100).toFixed(1)}%`;
    bar.appendChild(fill);
    item.appendChild(bar);
  }
  const meta = el(doc, 'p', 'nmap-flow-meta');
  const otherText = other ? `${other.role === 'obligor' ? '의무를 지는 곳' : '받는 곳'} ${other.node.name}` : null;
  meta.appendChild(el(doc, 'span', 'nmap-flow-kind', [CAPITAL_EDGE_KINDS[edge.kind], otherText].filter(Boolean).join(', ')));
  if (report) meta.appendChild(el(doc, 'span', 'sx-chip sx-chip--sm nmap-report', REPORT_STATUS));
  meta.appendChild(el(doc, 'span', null, [report ? null : edge.status, edge.announced].filter(Boolean).join(' · ')));
  if (edge.dateBasis) meta.lastChild.title = edge.dateBasis;
  item.appendChild(meta);
  if (edge.amountBasis) item.appendChild(el(doc, 'p', 'nmap-flow-basis', edge.amountBasis));
  return item;
}

function flowColumn(doc, className, title, rows, empty) {
  const col = el(doc, 'div', `nmap-col ${className}`);
  col.appendChild(el(doc, 'h3', 'af-section nmap-col-title', `${title} ${rows.length}건`));
  if (!rows.length) { col.appendChild(el(doc, 'p', 'nmap-detail-sub', empty)); return col; }
  const list = el(doc, 'ul', 'nmap-flows');
  rows.forEach((row) => list.appendChild(flowRow(doc, row)));
  col.appendChild(list);
  return col;
}

function capitalMap(doc, { capital, selection }) {
  const section = el(doc, 'section', 'nmap nmap--capital');
  section.id = 'ai-map-capital';
  const view = capitalFocus(capital, selection.node);
  const head = el(doc, 'div', 'nmap-capital-head');
  head.appendChild(el(doc, 'span', 'nmap-asof', `기준일 ${capital.reviewedAt || '미상'}`));
  if (capital.stale) head.appendChild(el(doc, 'span', 'sx-chip sx-chip--sm sx-chip--warn nmap-stale', '기준일 지남'));
  if (capital.boundary) head.appendChild(el(doc, 'p', 'nmap-boundary', capital.boundary));
  section.appendChild(head);

  const picker = el(doc, 'div', 'nmap-parts nmap-picker');
  picker.setAttribute('role', 'group');
  picker.setAttribute('aria-label', '가운데 둘 회사, 거래가 많은 순');
  capitalCompanies(capital).forEach((node) => picker.appendChild(action(doc, 'button', `nmap-part${node.id === view.focus.id ? ' is-active' : ''}`, `${node.name} ${node.count}`, 'ai-map-node', node.id, { pressed: node.id === view.focus.id })));
  section.append(el(doc, 'p', 'nmap-detail-sub', '가운데 둘 회사, 숫자는 거래 수'), picker);

  const { focus, incoming, outgoing, bothSides } = view;
  section.appendChild(el(doc, 'p', 'nmap-both-line', bothSides.length
    ? `들어오는 돈과 나가는 약정 양쪽에 있는 회사 ${bothSides.length}곳: ${bothSides.map((node) => node.name).join(', ')}`
    : '들어오는 돈과 나가는 약정 양쪽에 있는 회사 없음'));

  const centre = el(doc, 'div', 'nmap-col nmap-col--focus');
  centre.setAttribute('aria-live', 'polite');
  centre.appendChild(el(doc, 'h3', 'af-section nmap-focus-name', focus.name));
  centre.appendChild(el(doc, 'p', 'nmap-detail-sub', [CAPITAL_ROLE_WORDS[focus.role] || focus.role, focus.listed ? focus.id : '비상장'].filter(Boolean).join(' · ')));
  if (focus.listed) centre.appendChild(tickerChip(doc, focus.id, '종목 보기', `${focus.name} (${focus.id}), 종목 개요 열기`));
  const grid = el(doc, 'div', 'nmap-flowgrid');
  grid.append(
    flowColumn(doc, 'nmap-col--in', '들어오는 돈', incoming, '이 회사로 들어오는 투자·대출·보증 없음'),
    centre,
    flowColumn(doc, 'nmap-col--out', '나가는 약정', outgoing, '이 회사가 내는 투자·약정 없음')
  );
  section.appendChild(grid);

  const seen = new Set();
  const sources = [...incoming, ...outgoing].flatMap(({ edge }) => (edge.sources || []).map((source) => ({ label: `${source.publisher}${source.title ? `, ${source.title}` : ''}`, url: source.url, note: `${source.date}${edge.sourceKind === 'report' ? `, ${REPORT_STATUS}` : ''}` })))
    .filter((source) => source.url && !seen.has(source.url) && seen.add(source.url));
  section.appendChild(kindFold(doc, 'sources', `${focus.name} 거래 출처 ${sources.length}건`, [
    el(doc, 'p', 'nmap-fold-copy', `날짜와 출처가 있는 투자·대출·보증·구매 약정·클라우드 사용 약정·임대만 싣고, 공시나 회사 발표 없이 보도만 있는 거래는 '${REPORT_STATUS}'로 표시합니다. 금액은 발표된 기준(집행액, 상한, 최소 약정 등) 그대로이며 기준이 달라 더하지 않습니다. 막대는 같은 열의 달러 금액끼리 비교한 길이입니다. 검토일이 ${CAPITAL_STALE_DAYS}일을 넘으면 기준일 지남이 붙습니다.${capital.dropped ? ` 출처·날짜가 모자란 ${capital.dropped}건은 싣지 않았습니다.` : ''}`),
    sourceList(doc, sources)
  ]));
  return section;
}

/**
 * The AI 지도 document. `data.capital` is capitalFlowsView(...) or null (the map is then not offered); `data.supply` is
 * layerSupplyLinks(...) or null while the company graph loads.
 */
export function renderAiMap(doc, { selection, data }) {
  const article = el(doc, 'article', 'af-article nmap-article');
  const maps = AI_MAPS.filter((map) => map.id !== 'capital' || data.capital);
  const current = maps.some((map) => map.id === selection.map) ? selection.map : maps[0].id;
  article.dataset.atlasAiMap = current;
  article.append(el(doc, 'p', 'af-kicker', 'AI 지도'), el(doc, 'h2', 'af-issue', maps.find((map) => map.id === current).label), mapTabs(doc, maps, current));
  if (current === 'value-chain') {
    if (!data.supply || !data.layers?.length) article.appendChild(el(doc, 'p', 'rl-copy', data.failed ? '회사 연결 자료를 불러오지 못했습니다.' : '불러오는 중입니다.'));
    else article.appendChild(valueChainMap(doc, { layers: data.layers, playersOf: data.playersOf, supply: data.supply, selection }));
  } else if (current === 'datacenter') {
    if (!data.chain) article.appendChild(el(doc, 'p', 'rl-copy', '불러오는 중입니다.'));
    else article.appendChild(datacenterMap(doc, { chain: data.chain, nodeLabel: data.nodeLabel, selection }));
  } else article.appendChild(capitalMap(doc, { capital: data.capital, selection }));
  article.appendChild(el(doc, 'p', 'nmap-note', '기업은 역할 예시, 추천 아님'));
  return article;
}
