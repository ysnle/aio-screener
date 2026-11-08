// v59.74 (owner 2026-11-07 '돈과 기술이 어떻게/어디서 흐르는지'): one graph over every researched company story. Each
// story names its buyers (sell.customers, aiChain.sellsTo), the hops of its money flow (moneyFlow.steps: who pays whom),
// its partners (make.partners, aiChain.dependsOn: suppliers, co-developers or investors, money either way) and its
// rivals (competition.arenas). An edge exists only where a story names another covered company
// by an exact registered name (company-aliases.js), and it keeps the sentence that said so and whose story said it.
// Amounts on the nodes are the stories' own figures with their period (revenue, capex); nothing is summed across
// periods or estimated. scripts/sync-company-profiles.mjs writes the result to public-data/company-profiles/graph.json.
import { companiesNamedIn, PRIVATE_NODES, COMPANY_ALIASES } from './company-aliases.js';
import { readNumber } from '../shared/number.js';

export const COMPANY_GRAPH_SCHEMA = 'company-graph.v1';
// The subject of a list line: the part before ' - ', ' — ' or ': '.
const head = (line) => String(line || '').split(/\s+[-—–]\s+|:\s/)[0];
const clip = (text, max = 160) => { const s = String(text || '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };

/** A short display name: the Korean name for a Korean listing, otherwise the English name without its legal suffix. */
// Names the stories write long or formally that a reader knows by a short form.
const DISPLAY_NAME = Object.freeze({ TSM: 'TSMC', SPCX: 'SpaceX', HPE: 'HPE', AMZN: 'Amazon', 'BRK-B': 'Berkshire Hathaway', XOM: 'ExxonMobil', IBM: 'IBM', NU: 'Nubank', VRT: 'Vertiv', GFS: 'GlobalFoundries', UMC: 'UMC' });
const SUFFIX = /,?\s+(&\s*Co\.?|&|Inc\.?|Incorporated|Corporation|Corp\.?|Co\.,? Ltd\.?|Co\.|Company Limited|Company|Limited|Ltd\.?|\bplc|N\.V\.|S\.A\.|Holdings?|Holding|\bGroup|International|Technologies|Technology Solutions|\.com|\bCo)$/i;
export function shortCompanyName(story) {
  const symbol = String(story?.symbol || '');
  if (DISPLAY_NAME[symbol]) return DISPLAY_NAME[symbol];
  const name = String(story?.name || symbol);
  // A Korean listing reads by its registered Korean name ('SK하이닉스').
  const korean = (COMPANY_ALIASES[symbol] || []).find((alias) => /[가-힣]/.test(alias));
  if (/\.K[SQ]$/.test(symbol) && korean) return korean;
  let short = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/^The\s+/, '').replace(/\s+/g, ' ').trim();
  // Strip legal and generic tails one at a time, keeping at least one word ('Eli Lilly and Company' → 'Eli Lilly').
  for (let i = 0; i < 4; i += 1) { const next = short.replace(SUFFIX, '').replace(/\s+and$/i, '').trim(); if (!next || next === short) break; short = next; }
  return short || symbol;
}

function capexOf(story) {
  const item = (story?.useOfCash?.items || []).find((x) => x?.use === 'capex' && readNumber(x.value) != null);
  return item ? { value: Number(item.value), unit: item.unit, period: story.useOfCash?.period || null } : null;
}

/**
 * @param {Array<object>} stories researched company stories (public-data/company-profiles/<SYMBOL>.json)
 * @returns {{schemaVersion:string, nodes:Object<string,object>, edges:Array<object>}}
 */
export function buildCompanyGraph(stories) {
  const list = (Array.isArray(stories) ? stories : []).filter((s) => s?.symbol).sort((a, b) => a.symbol.localeCompare(b.symbol));
  const covered = new Set(list.map((s) => s.symbol));
  const nodes = {};
  for (const story of list) {
    const e = story.earnings || {};
    nodes[story.symbol] = {
      name: shortCompanyName(story), layer: story.aiChain?.layer || null, researchedAt: story.researchedAt || null,
      revenue: e.revenue && readNumber(e.revenue.value) != null ? { value: readNumber(e.revenue.value), unit: e.revenue.unit, period: e.period || null } : null,
      capex: capexOf(story)
    };
  }
  for (const [id, names] of Object.entries(PRIVATE_NODES)) nodes[id] = { name: names[0], private: true };
  const known = (id) => covered.has(id) || id in PRIVATE_NODES;
  const edges = new Map();
  const add = (kind, a, b, by, field, text) => {
    if (a === b || !known(a) || !known(b)) return;
    // A supply edge runs from the payer to the payee; a partner or rival pair is one edge whichever story names it.
    const [x, y] = kind === 'supply' ? [a, b] : [a, b].sort();
    const key = `${kind}|${x}|${y}`;
    const edge = edges.get(key) || { kind, from: x, to: y, said: [] };
    if (!edge.said.some((s) => s.by === by && s.field === field)) edge.said.push({ by, field, text: clip(text) });
    edges.set(key, edge);
  };
  for (const story of list) {
    const self = story.symbol;
    const others = (text) => companiesNamedIn(text).filter((id) => id !== self);
    // A partner line ('TSMC - 웨이퍼 생산', 'NVIDIA - 20억 달러 투자, 다년 구매약정') says who works with whom, and the money can
    // run either way (a supplier, a co-developer, an investor), so it is its own kind and the sentence is kept with it.
    // A customer line names its customer before the dash; a company named after it is a product ('… NVIDIA GPU로 운영').
    for (const line of story.make?.partners || []) for (const id of others(head(line))) add('partner', self, id, self, 'make', line);
    for (const line of story.aiChain?.dependsOn || []) for (const id of others(head(line))) add('partner', self, id, self, 'dependsOn', line);
    for (const line of story.sell?.customers || []) for (const id of others(head(line))) add('supply', id, self, self, 'customers', line);
    for (const line of story.aiChain?.sellsTo || []) for (const id of others(head(line))) add('supply', id, self, self, 'sellsTo', line);
    for (const arena of story.competition?.arenas || []) for (const line of arena?.rivals || []) for (const id of others(line)) add('rival', self, id, self, 'rivals', `${arena.arena}: ${line}`);
    for (const hop of story.moneyFlow?.steps || []) {
      const payers = companiesNamedIn(hop?.from), payees = companiesNamedIn(hop?.to);
      // A hop that names this company on one side and itself on neither still says who pays whom; very wide hops
      // ('하이퍼스케일러 (MSFT, GOOGL, AMZN, META)' → three suppliers) are kept up to twelve pairs.
      const pairs = payers.flatMap((p) => payees.map((q) => [p, q])).slice(0, 12);
      for (const [p, q] of pairs) add('supply', p, q, self, 'moneyFlow', `${hop.from} → ${hop.to}: ${hop.what || ''}`);
    }
  }
  // A partnership already stated as money in either direction adds nothing.
  for (const [key, edge] of edges) if (edge.kind === 'partner' && (edges.has(`supply|${edge.from}|${edge.to}`) || edges.has(`supply|${edge.to}|${edge.from}`))) edges.delete(key);
  const order = { supply: 0, partner: 1, rival: 2 };
  return { schemaVersion: COMPANY_GRAPH_SCHEMA, nodes, edges: [...edges.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)) };
}

/** How many of a period make a year: a quarter 4, a half 2, nine months 4/3, anything else (a fiscal year, TTM) 1. */
export function periodYearFactor(period) {
  const p = String(period || '');
  // Hangul terms take no \b: a word boundary never falls between two Hangul syllables (상반기).
  if (/\b(9M|nine months|1~3Q)(?![A-Za-z])|1~3분기|9개월|1~9월/i.test(p)) return 4 / 3;
  if (/\b(H[12]|[12]H|6M|six months|half)(?![A-Za-z])|6개월|반기|1~6월/i.test(p)) return 2;
  if (/\bQ[1-4]\b|\b[1-4]Q\d{2}\b|\bquarter\b|3개월|분기/i.test(p) && !/누적|누계|\byear-to-date\b|\bYTD\b/i.test(p)) return 4;
  return 1;
}

/**
 * One company's neighbourhood: who pays it (buyers), whom it pays (suppliers), whom it works with (partners, money
 * either way) and who it competes with. A link stated in both
 * companies' stories is marked `both`. Buyers and suppliers are ordered by how many stories state the link, then by size.
 */
export function companyNeighbourhood(graph, symbol) {
  const id = String(symbol || '').toUpperCase();
  const nodes = graph?.nodes || {};
  if (!nodes[id]) return null;
  // The order compares a yearly size, so one quarter's capex does not rank below a smaller buyer's nine-month or
  // fiscal-year total. The amount shown keeps its own period.
  const scale = (amount) => { if (!amount) return 0; const v = Number(amount.value); const u = String(amount.unit || ''); return periodYearFactor(amount.period) * (/KRW/.test(u) ? v / 1400 * (/tn/.test(u) ? 1000 : 1) : /tn/.test(u) ? v * 1000 : /mn/.test(u) ? v / 1000 : v); };
  const row = (other, edge) => ({ symbol: other, ...nodes[other], said: edge.said, both: edge.said.some((s) => s.by === other) && edge.said.some((s) => s.by === id) });
  const buyers = [], suppliers = [], rivals = [], partners = [];
  for (const edge of graph.edges || []) {
    if (edge.kind === 'supply' && edge.to === id) buyers.push(row(edge.from, edge));
    else if (edge.kind === 'supply' && edge.from === id) suppliers.push(row(edge.to, edge));
    else if (edge.kind === 'partner' && (edge.from === id || edge.to === id)) partners.push(row(edge.from === id ? edge.to : edge.from, edge));
    else if (edge.kind === 'rival' && (edge.from === id || edge.to === id)) rivals.push(row(edge.from === id ? edge.to : edge.from, edge));
  }
  const rank = (key) => (a, b) => (b.both - a.both) || (b.said.length - a.said.length) || (scale(b[key]) - scale(a[key])) || a.symbol.localeCompare(b.symbol);
  // A partner this company's own story names comes before one only the other story names (a customer that calls the
  // company an AI partner does not lead its supplier list).
  const own = (r) => (r.said.some((s) => s.by === id) ? 1 : 0);
  buyers.sort(rank('capex')); suppliers.sort(rank('revenue')); rivals.sort(rank('revenue'));
  partners.sort((a, b) => (own(b) - own(a)) || rank('revenue')(a, b));
  return { symbol: id, node: nodes[id], buyers, suppliers, partners, rivals };
}
