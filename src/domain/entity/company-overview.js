// 종목 개요 (owner 2026-11-19: "이 회사는 무엇으로 돈을 벌고 산업의 어디에 있는가"): the facts the overview lays out —
// where the company sits in the AI value chain (the layer of the map, the customers and suppliers the company stories
// name, the capital flows it is a party to) and the few figures that say whether it makes money. Every value comes from a
// record the repo already holds (company-profiles graph, atlas capital flows, SEC/DART filings, the company story's own
// dated earnings); a missing value is reported missing, never estimated. Words are fixed state words, never a reading.
import { readNumber, signedText, usdKoreanText } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';
import { atlasLayerOf } from '../knowledge/value-chain-layers.js';
import { CAPITAL_EDGE_KINDS, REPORT_STATUS, capitalFlowsView } from '../knowledge/ai-map.js';
import { companyNeighbourhood } from './company-graph.js';
import { layerLabel, moneyText, pctText } from './company-story.js';
import { buildTrailingYearRead } from '../fundamental/trailing-year.js';
import { FISCAL_FLAT_BAND } from '../fundamental/fiscal-read.js';
import { fiscalYearLabel } from '../fundamental/period.js';

const ymd = (iso) => (hasLeadingIsoDay(iso) ? `${String(iso).slice(0, 4)}.${Number(String(iso).slice(5, 7))}.${Number(String(iso).slice(8, 10))}` : '');

// ── 밸류체인 안의 자리 ─────────────────────────────────────────────────────────────────────────────────────────────────

// `what`: what the money pays for, as the first story that says it words it (company-graph.js); a graph written before
// the field existed, or a link named only in a customer or partner line, has none.
const party = (row) => ({ symbol: row.private ? null : row.symbol, name: row.private ? row.name : row.name || row.symbol, said: row.said || [], both: !!row.both,
  what: (row.said || []).find((s) => s?.what)?.what || null });

// A capital amount in the reader's units: billions of dollars as 억·조 달러, gigawatts as GW.
function capitalAmount(edge) {
  const amount = readNumber(edge?.amount);
  if (amount == null) return null;
  if (edge.unit === 'usd-bn') return moneyText(amount, 'USD bn');
  if (edge.unit === 'gw') return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}GW`;
  return null;
}

/**
 * The company's place: the map layer its story layer sits in (or none), the companies it sells to and buys from as the
 * stories name them, its partners and rivals, and the capital flows it is a party to (payer, payee or a guarantee's
 * obligor). `inMap` is false only when the company has neither a layer nor a capital flow — the section is then one line.
 * @param {{ symbol: string, story?: object|null, graph?: object|null, capital?: object|null, today?: string }} input
 */
export function companyPlace({ symbol, story = null, graph = null, capital = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const id = String(symbol || '').toUpperCase();
  const node = graph?.nodes?.[id] || null;
  const storyLayer = node?.layer || story?.aiChain?.layer || null;
  const layer = atlasLayerOf(storyLayer);
  const near = graph ? companyNeighbourhood(graph, id) : null;
  const view = capital ? capitalFlowsView(capital, { today }) : null;
  const names = new Map((view?.nodes || []).map((item) => [item.id, item]));
  const nameOf = (nodeId) => names.get(nodeId)?.name || String(nodeId || '').replace(/^@/, '');
  const capitalRows = (view?.edges || []).filter((edge) => edge.from === id || edge.to === id || edge.onBehalfOf === id).map((edge) => {
    const direction = edge.from === id ? 'out' : 'in';
    const other = direction === 'out' ? edge.to : edge.from;
    return {
      id: edge.id, direction, kind: CAPITAL_EDGE_KINDS[edge.kind] || edge.kind,
      counterparty: { id: other, name: nameOf(other), symbol: names.get(other)?.listed ? other : null },
      onBehalfOf: edge.kind === 'guarantee' && edge.onBehalfOf && edge.onBehalfOf !== id ? nameOf(edge.onBehalfOf) : null,
      amount: capitalAmount(edge), amountBasis: edge.amountBasis || null,
      announced: edge.announced, dateBasis: edge.dateBasis || null,
      reported: edge.sourceKind === 'report' || edge.status === REPORT_STATUS, status: edge.status || null,
      what: edge.what || '', sources: edge.sources || []
    };
  }).sort((a, b) => String(b.announced).localeCompare(String(a.announced)));
  const rows = (list) => (list || []).map(party);
  return {
    symbol: id, inMap: !!layer || capitalRows.length > 0,
    layer, storyLayer, storyLayerLabel: layerLabel(storyLayer), position: story?.aiChain?.position || null,
    customers: rows(near?.buyers), suppliers: rows(near?.suppliers), partners: rows(near?.partners), rivals: rows(near?.rivals),
    capital: capitalRows, capitalReviewedAt: view?.reviewedAt || null
  };
}

// ── 재무 한눈에 ──────────────────────────────────────────────────────────────────────────────────────────────────────

const growthState = (value) => (Math.abs(value) < FISCAL_FLAT_BAND ? '보합' : value > 0 ? '증가' : '감소');
const growthTone = (value) => (Math.abs(value) < FISCAL_FLAT_BAND ? 'neutral' : value > 0 ? 'good' : 'warn');
const profitState = (value) => (value > 0 ? '흑자' : value < 0 ? '적자' : '손익 0');
const profitTone = (value) => (value > 0 ? 'good' : value < 0 ? 'warn' : 'neutral');
const pct = (value) => `${Number(value).toFixed(1)}%`;

/**
 * The few figures that answer "does it make money", each a number with a fixed state word and the period it covers.
 * US listings read the SEC record (the latest four filed quarters when they end after the fiscal year, else the fiscal
 * year), Korean listings the DART annual accounts, and either falls back to the company story's own dated earnings when
 * no filing figure is loaded. `financial` (banks, insurers) leaves out free cash flow and net cash, which do not read for
 * them. Returns { rows, basis, source } — rows empty when nothing is known.
 */
export function moneyGlance({ symbol, fundamentals = null, quarters = [], marginCash = null, kr = null, story = null, financial = false } = {}) {
  const id = String(symbol || '').toUpperCase();
  const rows = [];
  const own = fundamentals && String(fundamentals.symbol || id).toUpperCase() === id ? fundamentals : null;
  const fy = String(own?.fiscalPeriodEnd || own?.observedAt || '').slice(0, 10);
  const fyLabel = fiscalYearLabel(fy) || (fy ? fy.slice(0, 4) : '');
  const ttm = buildTrailingYearRead(Array.isArray(quarters) ? quarters : []);
  const useTtm = !!ttm && (!fy || ttm.through > fy);
  const through = ttm ? `${ymd(ttm.through)}까지 4개 분기` : '';
  const growth = useTtm && ttm.revenueYoy != null ? ttm.revenueYoy : readNumber(own?.revGrowth);
  const margin = useTtm && ttm.margin != null ? ttm.margin : readNumber(own?.margin);
  if (growth != null) rows.push({ id: 'growth', title: '매출 성장', state: growthState(growth), tone: growthTone(growth), value: signedText(growth, 1, '%'),
    lines: [['period', useTtm && ttm.revenueYoy != null ? `${through}, 1년 전 같은 기간 대비${ttm.revenue != null ? `, 매출 ${usdKoreanText(ttm.revenue)}` : ''}` : `${fyLabel} 회계연도, 전년 대비`]] });
  if (margin != null) rows.push({ id: 'margin', title: '순이익률', state: profitState(margin), tone: profitTone(margin), value: pct(margin),
    lines: [['period', useTtm && ttm.margin != null ? `${through}${ttm.netIncome != null ? `, 순이익 ${usdKoreanText(ttm.netIncome)}` : ''}` : `${fyLabel} 회계연도`]] });
  if (!financial && marginCash?.state === 'ready') {
    const fcf = readNumber(marginCash.capital?.fcf);
    if (fcf != null) rows.push({ id: 'fcf', title: '잉여현금흐름', state: fcf > 0 ? '플러스' : fcf < 0 ? '마이너스' : '0', tone: profitTone(fcf), value: usdKoreanText(fcf),
      lines: [['period', `${marginCash.label} 회계연도, 영업현금흐름 − 설비투자`]] });
    const cash = marginCash.cash;
    if (cash?.liquid != null) {
      const net = readNumber(cash.net);
      rows.push({ id: 'net-cash', title: '현금과 부채', state: net == null ? '계산 보류' : net >= 0 ? '순현금' : '순부채', tone: net == null ? 'neutral' : net >= 0 ? 'good' : 'warn',
        value: net == null ? usdKoreanText(cash.liquid) : usdKoreanText(Math.abs(net)),
        lines: [['period', `${marginCash.label} 말, ${cash.shortTermInvestments != null ? '현금·단기투자' : '현금성 자산'} ${usdKoreanText(cash.liquid)}, ${cash.debtBasis === 'lease-inclusive' ? '장기부채(리스 포함)' : '장기부채'} ${cash.debt == null ? '자료 없음' : usdKoreanText(cash.debt)}`],
          ...(net == null && cash.investmentsMissing ? [['period', '전년에 있던 단기투자가 이번 연도 수집본에 없어 순현금을 계산하지 않음']] : [])] });
    }
  }
  if (rows.length) return { rows, source: 'sec', basis: useTtm ? through : fyLabel ? `${fyLabel} 회계연도` : '' };
  // Korean listings: the DART annual accounts (kr-fundamentals.json), the filing's own KRW figures.
  if (kr?.points?.length) {
    for (const point of kr.points) {
      const value = readNumber(point.value);
      if (point.id === 'growth' && value != null) rows.push({ id: 'growth', title: '매출 성장', state: growthState(value), tone: growthTone(value), value: signedText(value, 1, '%'), lines: [['period', point.text]] });
      else if (point.id === 'margin' && value != null) rows.push({ id: 'margin', title: '영업이익률', state: profitState(value), tone: profitTone(value), value: pct(value), lines: [['period', point.text]] });
      else if (point.id === 'debt' && value != null) rows.push({ id: 'debt', title: '부채비율', state: value <= 100 ? '자본 이하' : '자본 초과', tone: 'neutral', value: `${value.toFixed(0)}%`, lines: [['period', point.text]] });
    }
    if (rows.length) return { rows, source: 'dart', basis: kr.basisLines?.[0] || '' };
  }
  // The company story's own earnings (a dated company report, named as such).
  const e = story?.earnings || null;
  if (e) {
    const period = String(e.period || '').replace(/\s*\(.*$/, '').trim();
    const yoy = readNumber(e.revenue?.yoy);
    const revenue = e.revenue ? moneyText(e.revenue.value, e.revenue.unit) : null;
    if (yoy != null) rows.push({ id: 'growth', title: '매출 성장', state: growthState(yoy), tone: growthTone(yoy), value: signedText(yoy, 1, '%'),
      lines: [['period', `${period}, ${e.basis === 'quarter' ? '1년 전 같은 분기 대비' : '전년 대비'}${revenue ? `, 매출 ${revenue}` : ''}`]] });
    else if (revenue) rows.push({ id: 'revenue', title: '매출', state: '공시', tone: 'neutral', value: revenue, lines: [['period', period]] });
    const op = readNumber(e.operatingMargin);
    if (op != null) rows.push({ id: 'margin', title: '영업이익률', state: profitState(op), tone: profitTone(op), value: pctText(op), lines: [['period', period]] });
    const fcf = readNumber(e.freeCashFlow?.value);
    if (fcf != null) rows.push({ id: 'fcf', title: '잉여현금흐름', state: fcf > 0 ? '플러스' : fcf < 0 ? '마이너스' : '0', tone: profitTone(fcf), value: moneyText(fcf, e.freeCashFlow.unit), lines: [['period', period]] });
    if (rows.length) return { rows, source: 'story', basis: period };
  }
  return { rows: [], source: null, basis: '' };
}
