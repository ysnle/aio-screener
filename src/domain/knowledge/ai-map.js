import { isIsoDay } from '../shared/session-date.js';
import { readNumber } from '../shared/number.js';

export const AI_MAPS = Object.freeze([
  Object.freeze({ id: 'value-chain', label: '밸류체인' }),
  Object.freeze({ id: 'datacenter', label: '데이터센터·전력' }),
  Object.freeze({ id: 'capital', label: '자본순환' })
]);
export const AI_MAP_IDS = Object.freeze(AI_MAPS.map((map) => map.id));

/** A value-chain layer number from an address (1–7), or null. */
export function aiMapLayer(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? n : null;
}

/** The address of one AI map (#atlas?mode=aimap&map=…): a layer of the value chain, or one node (a company, a stage). */
export function aiMapRouteParams({ map = null, layer = null, node = null } = {}) {
  return Object.fromEntries(Object.entries({ mode: 'aimap', map: AI_MAP_IDS.includes(map) ? map : null, layer: layer == null ? null : String(layer), node }).filter(([, value]) => value != null && value !== ''));
}

// ── 1. value chain: supply links between the seven layers ─────────────────────────────────────────────────────────

/**
 * The graph's supply edges counted by layer pair. A supply edge runs from the payer to the payee, so the payee is the
 * supplier and the payer the buyer; a link reads supplier layer → buyer layer. An end with no atlas layer (a private AI
 * lab, a company the stories file outside the seven layers) is counted apart, never placed in a layer.
 * @param {object} graph company-graph.v1
 * @param {(symbol:string)=>number|null} layerOf the atlas layer number of a covered company
 */
export function layerSupplyLinks(graph, layerOf) {
  const nodes = graph?.nodes || {};
  const name = (id) => nodes[id]?.name || id;
  const links = new Map();
  const within = new Map();
  const outside = [];
  let total = 0;
  for (const edge of graph?.edges || []) {
    if (edge?.kind !== 'supply') continue;
    total += 1;
    const supplier = edge.to, buyer = edge.from;
    const from = layerOf(supplier), to = layerOf(buyer);
    const pair = { supplier, supplierName: name(supplier), supplierPrivate: !!nodes[supplier]?.private, buyer, buyerName: name(buyer), buyerPrivate: !!nodes[buyer]?.private, said: edge.said || [] };
    if (from == null || to == null) { outside.push(pair); continue; }
    if (from === to) { within.set(from, [...(within.get(from) || []), pair]); continue; }
    const key = `${from}-${to}`;
    const link = links.get(key) || { id: key, from, to, pairs: [] };
    link.pairs.push(pair);
    links.set(key, link);
  }
  const list = [...links.values()].map((link) => ({ ...link, count: link.pairs.length })).sort((a, b) => b.count - a.count || a.from - b.from || a.to - b.to);
  return { links: list, within, outside, total };
}

/** The supply pairs one company is in, as supplier or buyer, with the layer link each belongs to. */
export function companySupplyPairs(view, symbol) {
  const id = String(symbol || '');
  if (!id) return [];
  const all = [
    ...view.links.flatMap((link) => link.pairs.map((pair) => ({ ...pair, link: link.id }))),
    ...[...view.within.entries()].flatMap(([layer, pairs]) => pairs.map((pair) => ({ ...pair, link: `${layer}-${layer}` }))),
    ...view.outside.map((pair) => ({ ...pair, link: null }))
  ];
  return all.filter((pair) => pair.supplier === id || pair.buyer === id);
}

/**
 * The layers are not a chain: a layer supplies any layer above it. Each layer's upward links (to every higher layer it
 * supplies, most relations first) for its card, and the links that run downward apart, for the raw table.
 * @returns {{up: Map<number, object[]>, down: object[]}}
 */
export function layerUpwardSupply(view) {
  const up = new Map();
  const down = [];
  for (const link of view?.links || []) {
    if (link.to < link.from) { down.push(link); continue; }
    up.set(link.from, [...(up.get(link.from) || []), link]);
  }
  for (const links of up.values()) links.sort((a, b) => b.count - a.count || b.to - a.to);
  return { up, down };
}

// ── 2. data-center chain: power → site and building → cooling, servers, network → chips → cloud ───────────────────

// Which atlas nodes, guide nodes and reference rows belong to each stage. The grouping is structural (where a part sits
// on the way from a power plant to a cloud service), as VALUE_CHAIN_LAYERS is; no stage is ranked.
export const DATACENTER_STAGES = Object.freeze([
  Object.freeze({ id: 'power', label: '전력', atlasNodes: ['power-generation', 'power-transmission', 'power-interconnection', 'power-transformer', 'power-it-load'], guideNodes: ['generation-grid', 'substation-distribution'], capex: ['power'], leadLayer: 'power' }),
  Object.freeze({ id: 'site', label: '데이터센터 부지·건설', atlasNodes: ['aidc-pue'], guideNodes: ['construction-electrical'], capex: ['facility'], leadLayer: null }),
  Object.freeze({ id: 'cooling-server', label: '냉각·서버·네트워크', atlasNodes: ['aidc-rack-density', 'aidc-liquid-cooling', 'aidc-thermal-design', 'aidc-server-platform', 'network-fabric'], guideNodes: ['thermal', 'optical-network'], capex: ['cooling', 'network'], leadLayer: 'network' }),
  Object.freeze({ id: 'chip', label: '칩', atlasNodes: ['compute-gpu', 'compute-asic', 'memory-dram-hbm', 'package-2-5d'], guideNodes: ['rack-system'], capex: ['semis'], leadLayer: 'semis' }),
  Object.freeze({ id: 'cloud', label: '클라우드', atlasNodes: ['cloud-hyperscaler', 'cloud-ai-service', 'cloud-commitments'], guideNodes: ['demand-offtake'], capex: [], leadLayer: null, bigtech: true })
]);
export const DATACENTER_GUIDE_ID = 'ai-datacenter-gigawatt-to-token';

/**
 * The five stages with what each holds, and the links between stages read off the guide's own edges (an edge whose ends
 * sit in two stages becomes that stage link, with the guide's label). Rows that are missing are left out, never filled.
 */
export function datacenterChain({ coverage = null, guide = null, capexFlow = null, leadTimes = null, bigtech = null } = {}) {
  const nodeById = new Map((coverage?.nodes || []).map((node) => [node.nodeId, node]));
  const guideNodeById = new Map((guide?.nodes || []).map((node) => [node.id, node]));
  const stageOfGuideNode = new Map(DATACENTER_STAGES.flatMap((stage) => stage.guideNodes.map((id) => [id, stage.id])));
  const capexById = new Map((capexFlow?.layers || []).map((layer) => [layer.id, layer]));
  const hyperscalers = bigtech?.hyperscalers || null;
  const stages = DATACENTER_STAGES.map((stage) => ({
    id: stage.id,
    label: stage.label,
    atlasNodes: stage.atlasNodes.filter((id) => nodeById.has(id)),
    guideNodes: stage.guideNodes.map((id) => guideNodeById.get(id)).filter(Boolean).map((node) => ({ id: node.id, label: node.label })),
    capex: stage.capex.map((id) => capexById.get(id)).filter(Boolean).map((layer) => ({ id: layer.id, label: layer.label, share: layer.share, parts: layer.parts })),
    leadTimes: stage.leadLayer ? (leadTimes?.rows || []).filter((row) => row.layer === stage.leadLayer).map((row) => ({ item: row.item, weeks: row.weeks })) : [],
    bigtech: stage.bigtech && hyperscalers && readNumber(hyperscalers.capex) != null ? {
      members: hyperscalers.members || [], capex: readNumber(hyperscalers.capex), ocf: readNumber(hyperscalers.ocf), fcf: readNumber(hyperscalers.fcf),
      capexToOcfPct: readNumber(hyperscalers.capexToOcfPct), endRange: hyperscalers.endRange || null, complete: hyperscalers.complete === true
    } : null
  }));
  const links = [];
  const seen = new Set();
  for (const edge of guide?.edges || []) {
    const from = stageOfGuideNode.get(edge.from), to = stageOfGuideNode.get(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ from, to, label: edge.label, criticality: edge.criticality || null });
  }
  return { stages, links, guideAsOf: guide?.asOf || null, capexAsOf: capexFlow?.asOf || null, capexSource: capexFlow?.source || null, leadAsOf: leadTimes?.asOf || null, leadSource: leadTimes?.source || null, bigtechSource: bigtech?.source || null };
}

// ── 3. capital flows: who funds, buys from or commits to whom ─────────────────────────────────────────────────────

export const CAPITAL_FLOWS_SCHEMA = 'ai-capital-flows.v1';
export const CAPITAL_STALE_DAYS = 180;
// Each kind is told apart by its line (ai-map.css) and its word, never by colour alone.
export const CAPITAL_EDGE_KINDS = Object.freeze({
  equity: '지분 투자', debt: '대출·채권', guarantee: '보증', purchase: '구매 약정', 'cloud-commit': '클라우드 사용 약정', supply: '공급', lease: '임대'
});
export const CAPITAL_SOURCE_KINDS = Object.freeze({ filing: '공시', company: '회사 발표', report: '보도' });
// An edge only reports carry says so in its status; a filed or company-announced edge keeps the status it was given.
export const REPORT_STATUS = '보도';
// The map shows roles and dated deals; these words would turn it into a call on who gains or what to trade.
export const CAPITAL_BANNED_WORDS = Object.freeze(['수혜', '최대 수혜', '유망', '추천', '매수', '매도', '목표가', '호재', '악재', '저평가', '고평가', '급등', '폭락', '대박', '강력 추천', '사야', '팔아야']);

const isHttps = (url) => /^https:\/\/[^\s/]+\.[^\s]+/.test(String(url || ''));
const day = (value) => (isIsoDay(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : null);

/** Days from `from` to `to` (YYYY-MM-DD each), or null. */
export function daysBetween(from, to) {
  const a = Date.parse(`${day(from)}T00:00:00Z`), b = Date.parse(`${day(to)}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : null;
}

/** Whether a reviewed date is past the review window on `today`: the map then says 기준일 지남 (never a failure). */
export const capitalFlowsStale = (reviewedAt, today) => { const age = daysBetween(reviewedAt, today); return age != null && age > CAPITAL_STALE_DAYS; };

/** Problems with one edge that keep it off the map (and fail the contract gate). */
export function capitalEdgeProblems(edge, nodeIds) {
  const problems = [];
  const id = edge?.id || '(no id)';
  if (!edge?.id) problems.push(`edge without id`);
  if (!nodeIds.has(edge?.from)) problems.push(`${id}: from '${edge?.from}' is not a node`);
  if (!nodeIds.has(edge?.to)) problems.push(`${id}: to '${edge?.to}' is not a node`);
  if (!CAPITAL_EDGE_KINDS[edge?.kind]) problems.push(`${id}: kind '${edge?.kind}' is not one of ${Object.keys(CAPITAL_EDGE_KINDS).join('|')}`);
  if (!CAPITAL_SOURCE_KINDS[edge?.sourceKind]) problems.push(`${id}: sourceKind '${edge?.sourceKind}' is not filing|company|report`);
  if (edge?.sourceKind && edge.sourceKind !== 'filing' && edge.sourceKind !== 'company' && edge.status !== REPORT_STATUS) problems.push(`${id}: a ${edge.sourceKind} edge must have status '${REPORT_STATUS}'`);
  if (!String(edge?.what || '').trim()) problems.push(`${id}: what is empty`);
  if (!day(edge?.announced)) problems.push(`${id}: announced is not a date`);
  const sources = Array.isArray(edge?.sources) ? edge.sources : [];
  if (!sources.length) problems.push(`${id}: no source`);
  sources.forEach((source, index) => {
    if (!isHttps(source?.url)) problems.push(`${id}: source ${index + 1} url is not https`);
    if (!day(source?.date)) problems.push(`${id}: source ${index + 1} has no date`);
    if (!String(source?.publisher || '').trim()) problems.push(`${id}: source ${index + 1} has no publisher`);
  });
  if (edge?.amount != null) {
    if (readNumber(edge.amount) == null) problems.push(`${id}: amount is not a number`);
    if (!String(edge.unit || '').trim()) problems.push(`${id}: amount without unit`);
    if (!String(edge.amountBasis || '').trim()) problems.push(`${id}: amount without amountBasis`);
  }
  return problems;
}

/** Words the map must not carry, in any reader-facing text of the file. */
export function capitalBannedWordHits(doc) {
  const texts = [doc?.boundary, ...(doc?.nodes || []).flatMap((node) => [node?.name, node?.role]), ...(doc?.edges || []).flatMap((edge) => [edge?.what, edge?.amountBasis, edge?.status])];
  return texts.filter(Boolean).flatMap((text) => CAPITAL_BANNED_WORDS.filter((word) => String(text).includes(word)).map((word) => `'${word}' in "${String(text).slice(0, 60)}"`));
}

/**
 * The map's data: only edges without problems, the nodes they touch, and whether the review date is past its review window
 * null when there is nothing to draw (no file, another schema, no drawable edge) — the map is then left out, not shown empty.
 */
export function capitalFlowsView(doc, { today } = {}) {
  if (!doc || doc.schemaVersion !== CAPITAL_FLOWS_SCHEMA) return null;
  const nodes = (doc.nodes || []).filter((node) => node?.id);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = (doc.edges || []).filter((edge) => !capitalEdgeProblems(edge, nodeIds).length);
  if (!edges.length) return null;
  const used = new Set(edges.flatMap((edge) => [edge.from, edge.to, guaranteeFor(edge)]).filter((id) => nodeIds.has(id)));
  return {
    reviewedAt: day(doc.reviewedAt),
    boundary: String(doc.boundary || ''),
    stale: capitalFlowsStale(doc.reviewedAt, today),
    nodes: nodes.filter((node) => used.has(node.id)).map((node) => ({ id: node.id, name: node.name || node.id, listed: node.listed === true && !String(node.id).startsWith('@'), role: node.role || '' })),
    edges,
    dropped: (doc.edges || []).length - edges.length
  };
}

// The file's role codes in the reader's words.
export const CAPITAL_ROLE_WORDS = Object.freeze({ chips: '칩', foundry: '파운드리', cloud: '클라우드', models: 'AI 모델', neocloud: '네오클라우드', datacenter: '데이터센터', power: '전력', capital: '자본' });

// A guarantee's obligor (the tenant or borrower it covers): from is the guarantor, to the landlord or lender guaranteed.
const guaranteeFor = (edge) => (edge?.kind === 'guarantee' && edge.onBehalfOf ? edge.onBehalfOf : null);
const isIncoming = (edge, id) => edge.to === id || guaranteeFor(edge) === id;

/** Each company with how many deals it is in (as payer, payee or a guarantee's obligor), most first. */
export function capitalCompanies(view) {
  const edges = view?.edges || [];
  return (view?.nodes || [])
    .map((node) => ({ ...node, count: edges.filter((edge) => edge.from === node.id || isIncoming(edge, node.id)).length }))
    .filter((node) => node.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// Dollar amounts first, largest first; amounts in GW or with no amount after them, newest first.
const inDollars = (edge) => edge.unit === 'usd-bn' && readNumber(edge.amount) != null;
const byAmount = (a, b) => (inDollars(b.edge) - inDollars(a.edge)) || (inDollars(a.edge) ? readNumber(b.edge.amount) - readNumber(a.edge.amount) : 0) || String(b.edge.announced).localeCompare(String(a.edge.announced));

/**
 * One company in focus: 들어오는 돈 (deals whose payee is the company, and guarantees given for it) and 나가는 약정 (deals it
 * pays or commits), each row with its counterparty, the guarantee's other party when there is one, a bar share within its
 * column (dollar amounts only, never summed across bases) and whether the counterparty sits on both sides. The companies
 * on both sides are the circulation around the focus; the module names them and states nothing about them.
 * @returns {{focus:object, incoming:object[], outgoing:object[], bothSides:object[]}|null}
 */
export function capitalFocus(view, focusId) {
  const companies = capitalCompanies(view);
  const focus = companies.find((node) => node.id === focusId) || companies[0];
  if (!focus) return null;
  const nodeById = new Map((view.nodes || []).map((node) => [node.id, node]));
  const party = (id) => nodeById.get(id) || { id, name: id, listed: false };
  const side = (pick, counterpartyOf) => {
    const rows = view.edges.filter(pick).map((edge) => {
      const counterparty = party(counterpartyOf(edge));
      const obligor = guaranteeFor(edge);
      // A guarantee seen from its obligor names the landlord or lender guaranteed; seen from that landlord, the obligor.
      const other = obligor && obligor !== focus.id ? { role: 'obligor', node: party(obligor) } : obligor && edge.to !== focus.id ? { role: 'beneficiary', node: party(edge.to) } : null;
      return { edge, counterparty, other };
    }).sort(byAmount);
    const max = Math.max(0, ...rows.filter((row) => inDollars(row.edge)).map((row) => readNumber(row.edge.amount)));
    return rows.map((row) => ({ ...row, share: inDollars(row.edge) && max > 0 ? readNumber(row.edge.amount) / max : null }));
  };
  const incoming = side((edge) => isIncoming(edge, focus.id) && edge.from !== focus.id, (edge) => edge.from);
  const outgoing = side((edge) => edge.from === focus.id, (edge) => edge.to);
  const outIds = new Set(outgoing.map((row) => row.counterparty.id));
  const both = new Set(incoming.map((row) => row.counterparty.id).filter((id) => outIds.has(id)));
  const mark = (rows) => rows.map((row) => ({ ...row, bothSides: both.has(row.counterparty.id) }));
  return { focus, incoming: mark(incoming), outgoing: mark(outgoing), bothSides: companies.filter((node) => both.has(node.id)) };
}
