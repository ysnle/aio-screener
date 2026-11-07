// v59.74 (owner 2026-11-07 '돈과 기술이 어떻게/어디서 흐르는지'): the parts of a company story that look past the company
// itself. (1) 쟁점: the one issue the stock turns on, the reading that it holds and the reading that it breaks, and the
// dated facts that decide it. (2) 돈과 기술의 흐름: who pays this company and whom it pays, from every researched story
// that names the other (public-data/company-profiles/graph.json), with each side's own figure and period, the partners
// and rivals, and where it sits in the AI build-out. (3) 잘 안 보이는 구조. (4) 이 업종이 돌아가는 방식: the 산업 지도
// reading for its industry. All text comes from the stories and the library; this file only lays it out.
import { companyNeighbourhood } from '../../domain/entity/company-graph.js';
import { CHAIN_ORDER, industryFor } from '../../domain/entity/industry-links.js';
import { layerLabel, moneyText } from '../../domain/entity/company-story.js';

const has = (value) => value != null && value !== '' && !(Array.isArray(value) && !value.length);
function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
// A period label short enough for a chip: 'FY2026 (ended 2026-01-25)' → 'FY2026'.
const shortPeriod = (period) => String(period || '').replace(/\s*\(.*$/, '').replace(/,.*$/, '').trim();
const FIELD_WORD = Object.freeze({ customers: '고객 목록', sellsTo: 'AI 사슬의 판매처', moneyFlow: '돈의 흐름', make: '생산·협력', dependsOn: 'AI 사슬의 의존처', rivals: '경쟁' });

function chip(doc, row, figure, openTicker) {
  const isPrivate = !!row.private;
  const node = el(doc, isPrivate || typeof openTicker !== 'function' ? 'span' : 'button', null, `company-flow-chip${row.both ? ' is-both' : ''}${isPrivate ? ' is-private' : ''}`);
  if (node.tagName === 'BUTTON') { node.type = 'button'; node.addEventListener('click', () => openTicker(row.symbol)); }
  node.append(el(doc, 'b', isPrivate ? row.name : row.symbol));
  if (!isPrivate && row.name && row.name !== row.symbol) node.append(el(doc, 'span', row.name, 'company-flow-chip__name'));
  if (figure) node.append(el(doc, 'span', figure, 'company-flow-chip__fig'));
  const said = (row.said || []).map((s) => `${s.by === row.symbol ? `${row.symbol} 이야기` : '이 회사 이야기'}(${FIELD_WORD[s.field] || s.field}): ${s.text}`).join('\n');
  node.title = said;
  node.setAttribute('aria-label', `${isPrivate ? row.name : `${row.name} (${row.symbol})`}${figure ? `, ${figure}` : ''}${row.both ? ', 두 회사 이야기에 모두 나옴' : ''}`);
  return node;
}

// A buyer's capex is its spending power only where building is the business (capex at least a tenth of revenue in the
// same currency); otherwise its revenue is the size that matters.
const sameCurrency = (a, b) => String(a?.unit || '').slice(0, 3) === String(b?.unit || '').slice(0, 3);
const capexHeavy = (row) => row.capex && Number(row.capex.value) > 0 && (!row.revenue || !sameCurrency(row.capex, row.revenue)
  || Number(row.capex.value) * (/tn/.test(row.capex.unit) ? 1000 : /mn/.test(row.capex.unit) ? 0.001 : 1) >= 0.1 * Number(row.revenue.value) * (/tn/.test(row.revenue.unit) ? 1000 : /mn/.test(row.revenue.unit) ? 0.001 : 1));
const buyerFigure = (row) => (capexHeavy(row) ? capexFigure(row) : revenueFigure(row));
const capexFigure = (row) => (row.capex && Number(row.capex.value) > 0 ? `설비투자 ${moneyText(row.capex.value, row.capex.unit)}${row.capex.period ? ` (${shortPeriod(row.capex.period)})` : ''}` : null);
const revenueFigure = (row) => (row.revenue && Number(row.revenue.value) > 0 ? `매출 ${moneyText(row.revenue.value, row.revenue.unit)}${row.revenue.period ? ` (${shortPeriod(row.revenue.period)})` : ''}` : null);

function column(doc, title, note, rows, figureOf, openTicker, limit = 6) {
  const col = el(doc, 'div', null, 'company-flow-col');
  col.append(el(doc, 'h4', title, 'company-flow-col__title'));
  if (note) col.append(el(doc, 'p', note, 'company-flow-col__note'));
  const list = el(doc, 'div', null, 'company-flow-chips');
  if (!rows.length) list.append(el(doc, 'span', '다른 조사 기업과 이어진 곳 없음', 'company-flow-empty'));
  for (const row of rows.slice(0, limit)) list.append(chip(doc, row, figureOf(row), openTicker));
  if (rows.length > limit) list.append(el(doc, 'span', `외 ${rows.length - limit}곳`, 'company-flow-more'));
  col.append(list);
  return col;
}

/** 쟁점: the issue, the two readings with their basis, and what decides it. Returns null for a story without one. */
export function renderDebate(doc, profile) {
  const d = profile?.debate;
  if (!d?.question) return null;
  const box = el(doc, 'section', null, 'company-debate');
  box.setAttribute('aria-label', '핵심 쟁점');
  const head = el(doc, 'div', null, 'company-debate__head');
  head.append(el(doc, 'span', '핵심 쟁점', 'company-debate__label'), el(doc, 'p', d.question, 'company-debate__q'));
  box.append(head);
  const sides = el(doc, 'div', null, 'company-debate__sides');
  for (const [key, label] of [['bull', '이야기가 유지된다는 읽기'], ['bear', '이야기가 깨진다는 읽기']]) {
    if (!d[key]?.text) continue;
    const side = el(doc, 'div', null, `company-debate__side company-debate__side--${key}`);
    side.append(el(doc, 'h4', label), el(doc, 'p', d[key].text));
    sides.append(side);
  }
  box.append(sides);
  if (has(d.decides)) {
    const decide = el(doc, 'ol', null, 'company-debate__decides');
    decide.setAttribute('aria-label', '판가름할 것');
    for (const item of d.decides) { const li = el(doc, 'li'); li.append(el(doc, 'strong', item.when), doc.createTextNode(` ${item.what}`)); decide.append(li); }
    box.append(el(doc, 'h4', '판가름할 것', 'company-debate__sub'), decide);
  }
  box.append(el(doc, 'p', `${profile.researchedAt ? `${profile.researchedAt} 조사한 ` : ''}회사 공시·발표 자료에 근거한 두 읽기이며, 어느 쪽이 맞다는 판단이나 매매 의견이 아닙니다. 근거 자료는 아래 '근거 자료'에 있습니다.`, 'company-story-small'));
  return box;
}

/** 잘 안 보이는 구조: one closed fold per item, the title on its face. */
export function renderUnderTheHood(doc, profile) {
  const items = Array.isArray(profile?.underTheHood) ? profile.underTheHood.filter((x) => x?.title && x?.text) : [];
  if (!items.length) return null;
  const box = el(doc, 'section', null, 'company-hood');
  box.setAttribute('aria-label', '잘 안 보이는 구조');
  box.append(el(doc, 'h3', '숫자 뒤의 구조', 'company-story-h3'));
  for (const item of items) {
    const fold = el(doc, 'details', null, 'company-hood__item');
    fold.append(el(doc, 'summary', item.title), el(doc, 'p', item.text));
    box.append(fold);
  }
  return box;
}

/** The AI build-out as a strip: this company's layer marked, and how many linked companies sit in each layer. */
function chainStrip(doc, layer, near, graph) {
  if (!CHAIN_ORDER.includes(layer)) return null;
  const counts = {};
  for (const row of [...near.buyers, ...near.suppliers, ...near.partners]) {
    const l = graph.nodes?.[row.symbol]?.layer;
    if (l) counts[l] = (counts[l] || 0) + 1;
  }
  const strip = el(doc, 'ol', null, 'company-chain');
  strip.setAttribute('aria-label', `AI 인프라 사슬에서의 위치: ${layerLabel(layer)}`);
  for (const id of CHAIN_ORDER) {
    const li = el(doc, 'li', null, `company-chain__step${id === layer ? ' is-here' : ''}${counts[id] ? ' is-linked' : ''}`);
    li.append(el(doc, 'span', layerLabel(id), 'company-chain__name'));
    if (id === layer) li.append(el(doc, 'span', '이 회사', 'company-chain__count'));
    else if (counts[id]) li.append(el(doc, 'span', `연결 ${counts[id]}`, 'company-chain__count'));
    if (id === layer) li.setAttribute('aria-current', 'true');
    strip.append(li);
  }
  return strip;
}

/** 돈과 기술의 흐름: buyers → company → suppliers, partners and rivals, the chain strip and the link basis. */
export function renderCompanyFlow(doc, profile, graph, openTicker = null) {
  const near = graph ? companyNeighbourhood(graph, profile?.symbol) : null;
  if (!near) return null;
  const box = el(doc, 'section', null, 'company-flow');
  box.setAttribute('aria-label', '돈과 기술의 흐름');
  box.append(el(doc, 'h3', near.buyers.length || near.suppliers.length ? '돈과 기술의 흐름' : '함께 일하고 겨루는 기업', 'company-story-h3'));
  const map = el(doc, 'div', null, 'company-flow-map');
  const centre = el(doc, 'div', null, 'company-flow-centre');
  centre.append(el(doc, 'b', profile.symbol), el(doc, 'span', near.node.name, 'company-flow-chip__name'));
  const own = [revenueFigure({ revenue: near.node.revenue }), capexFigure({ capex: near.node.capex })].filter(Boolean);
  for (const line of own) centre.append(el(doc, 'span', line, 'company-flow-chip__fig'));
  map.append(
    column(doc, '돈을 내는 쪽', '이 회사에 돈을 주는 곳', near.buyers, buyerFigure, openTicker),
    el(doc, 'span', '→', 'company-flow-arrow'), centre, el(doc, 'span', '→', 'company-flow-arrow'),
    column(doc, '돈을 받는 쪽', '이 회사가 돈을 주는 곳', near.suppliers, revenueFigure, openTicker)
  );
  map.setAttribute('role', 'group');
  map.setAttribute('aria-label', `돈의 방향: 고객 ${near.buyers.length}곳 → ${profile.symbol} → 공급처 ${near.suppliers.length}곳`);
  // A company no other story pays or is paid by (a bank, a consumer brand) has no money map, only its partners and rivals.
  if (near.buyers.length || near.suppliers.length) box.append(el(doc, 'p', '돈은 왼쪽에서 오른쪽으로, 제품과 기술은 오른쪽에서 왼쪽으로 흐릅니다. 진한 테두리는 두 회사 이야기에 모두 적힌 연결입니다.', 'company-flow-legend'), map);
  const strip = chainStrip(doc, profile.aiChain?.layer, near, graph);
  if (strip) box.append(strip);
  if (!near.buyers.length && !near.suppliers.length && !near.partners.length && !near.rivals.length) return null;
  // Partners and rivals are the second ring: one closed fold, so the money path stays the visual.
  if (near.partners.length || near.rivals.length) {
    const ring = el(doc, 'details', null, 'company-story-fold company-flow-ring');
    ring.append(el(doc, 'summary', [near.partners.length ? `함께 일하는 곳 ${near.partners.length}` : null, near.rivals.length ? `겨루는 곳 ${near.rivals.length}` : null].filter(Boolean).join(', ')));
    const side = el(doc, 'div', null, 'company-flow-side');
    if (near.partners.length) side.append(column(doc, '함께 일하는 곳', '생산·공동 개발·지분 투자, 돈은 양쪽으로', near.partners, revenueFigure, openTicker, 12));
    if (near.rivals.length) side.append(column(doc, '겨루는 곳', '같은 시장에서 고객을 두고 다투는 곳', near.rivals, revenueFigure, openTicker, 12));
    ring.append(side);
    box.append(ring);
  }
  // The basis of every link, in one closed fold: whose story said it and the sentence.
  const all = [['돈을 내는 쪽', near.buyers], ['돈을 받는 쪽', near.suppliers], ['함께 일하는 곳', near.partners], ['겨루는 곳', near.rivals]];
  const total = all.reduce((n, [, rows]) => n + rows.length, 0);
  if (total) {
    const fold = el(doc, 'details', null, 'company-story-fold company-flow-basis');
    fold.append(el(doc, 'summary', `연결 근거 ${total}건, 어느 회사 이야기의 어떤 문장인지`));
    for (const [title, rows] of all) {
      if (!rows.length) continue;
      fold.append(el(doc, 'h4', title));
      const ul = el(doc, 'ul');
      for (const row of rows) for (const s of row.said || []) ul.append(el(doc, 'li', `${row.private ? row.name : row.symbol} — ${s.by === profile.symbol ? '이 회사' : s.by} 이야기(${FIELD_WORD[s.field] || s.field}): ${s.text}`));
      fold.append(ul);
    }
    fold.append(el(doc, 'p', '각 회사 이야기에 이름이 정확히 적힌 연결만 잇고, 이름이 없거나 다른 표기인 회사는 잇지 않습니다. 금액은 그 회사 이야기의 기간 그대로이며 서로 더하거나 기간을 맞추지 않았습니다.', 'company-story-small'));
    box.append(fold);
  }
  return box;
}

/** 이 업종이 돌아가는 방식: the 산업 지도 domain reading (lead, body, twist) and its two closest nodes' twists. */
export function renderIndustryFold(doc, profile, industry, openLibrary = null) {
  const link = industryFor(profile);
  const domain = link && industry?.domains?.[link.domain];
  if (!domain) return null;
  const fold = el(doc, 'details', null, 'company-story-fold company-industry');
  fold.append(el(doc, 'summary', '이 업종이 돌아가는 방식, 돈을 버는 구조와 흔한 착시'));
  if (domain.lead) fold.append(el(doc, 'p', domain.lead, 'company-industry__lead'));
  for (const line of domain.body || []) fold.append(el(doc, 'p', line));
  if (domain.twist) { fold.append(el(doc, 'h4', '흔한 착시')); fold.append(el(doc, 'p', domain.twist)); }
  for (const id of link.nodes) {
    const node = industry.nodes?.[id];
    if (!node?.lead) continue;
    fold.append(el(doc, 'h4', node.lead.split(/(?<=[.다])\s/)[0]));
    if (node.body?.[0]) fold.append(el(doc, 'p', node.body[0]));
    if (node.twist) fold.append(el(doc, 'p', node.twist, 'company-industry__twist'));
  }
  if (typeof openLibrary === 'function') {
    const button = el(doc, 'button', '리서치 라이브러리 산업 지도에서 전체 보기', 'aio-btn-table company-industry__open');
    button.type = 'button';
    button.addEventListener('click', () => openLibrary(link.domain));
    fold.append(button);
  }
  return fold;
}
