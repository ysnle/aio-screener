// The AI build-out's funding as one chain instead of scattered figures: what the big spenders invest, whether their
// operating cash covers it, what they borrow, what the debt market charges, what lenders demand, what the hardware
// costs, and the rates and liquidity under all of it. Seven links in that order, each a short list of dated rows —
// automated rows first (SEC cash-flow statements, FRED series), researched rows after (public-data/research-reference.json).
//
// A link's state word comes only from its automated rows, by the rule written in FUNDING_CHAIN_RULES (the fold prints
// it). Researched figures are hand-checked reference values: they are shown and given to the AI reading as dated facts
// but never decide a state (AGENTS.md, researched reference figures), so a link with only researched rows has no state.
// The chain says the rule-decided count and nothing more; the flowing interpretation is the AI reading's job.
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';
import { readNumber } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';
import { RULES } from '../rules/thresholds.js';
import { oasDelta20Bp } from '../briefing/market-read.js';
import { netLiquiditySeries, NET_LIQUIDITY_FLAT_BN } from '../macro/liquidity-growth.js';
import { fedTargetRange } from '../macro/fed-target-range.js';
import { HYPERSCALERS } from '../fundamental/quarterly-cashflow.js';
import { RESEARCH_GROUP_IDS, researchFactLines, researchReference, researchRowSaid } from '../research/reference.js';
import { RESEARCH_WORDS } from '../research/words.js';
import { FUNDING_CHAIN_WORDS as W } from '../content/funding-chain-words.js';

export const FUNDING_CHAIN_RULES = Object.freeze({
  capexYoyPct: 10, // ① twelve-month capex against a year earlier
  capexToOcfPp: 5, // ② capex ÷ operating cash flow against a year earlier, in percentage points
  hyOas20dBp: RULES.credit.widen20dBp, // ④ the credit axis's own 20-session high-yield spread line
  tenYear20dBp: RULES.crossAsset.rate20dBp, // ⑦ the cross-asset 20-session rate line
  netLiquidity4wBn: NET_LIQUIDITY_FLAT_BN // ⑦ the liquidity card's four-week flat band
});

// The researched groups each link reads; the AI input gets every other group through researchFactLines.
const LINK_RESEARCH = Object.freeze({ funding: ['ai-financing'], credit: ['credit-single-name', 'credit-market'], lending: ['bank-lending'], hardware: ['compute-price', 'memory-price'], rates: ['rates-policy'] });
export const FUNDING_CHAIN_RESEARCH_GROUPS = Object.freeze([...new Set(Object.values(LINK_RESEARCH).flat())]);
export const FUNDING_CHAIN_LINK_IDS = Object.freeze(['capex', 'cash', 'funding', 'credit', 'lending', 'hardware', 'rates']);
// The spenders whose free cash flow is read (the neocloud beside the hyperscalers, never inside their total).
const SPENDER_GROUPS = new Set(['hyperscaler', 'neocloud']);
export const FUNDING_FACE_ROWS = 3;

const fig = (subject, measure, asOf, value, unit, label, digits) => claim({ subject, measure, asOf, figures: [{ value, unit, basis: measure, label, ...(digits == null ? {} : { digits }) }] });
const dated = (subject, asOf) => say('{d.date}', { d: claim({ subject, measure: 'funding:asOf', asOf }) });
const autoRow = ({ id, label, value, change = NOTHING, asOf, subject }) => Object.freeze({ kind: 'auto', id, label, value, change, date: dated(subject, asOf), asOf, stale: false, note: '', record: null,
  said: sayJoin([say('{l} {v}', { l: label, v: value }), change], ', ') });
const researchedRow = (row) => Object.freeze({ ...row, kind: 'researched', said: researchRowSaid(row) });
const dayOf = (iso) => String(iso || '').slice(0, 10);

// ── ① 투자 ────────────────────────────────────────────────────────────────
function capexLink(group) {
  if (!group?.complete) return { rows: [], state: null };
  const asOf = group.endRange?.[1] || null;
  const subject = 'funding:hyperscalers';
  const yoy = readNumber(group.capexYoyPct);
  const rows = [autoRow({ id: 'capex-ttm', subject, asOf, label: `빅테크 ${group.members.length}개사 설비투자(최근 4분기)`,
    value: say('{v}', { v: fig(subject, 'capexTtm', asOf, group.capex, 'usd', '설비투자') }),
    change: yoy == null ? NOTHING : say('1년 전 대비 {y}', { y: fig(subject, 'capexYoy', asOf, yoy, 'pct', '1년 전 대비', 1) }) })];
  const R = FUNDING_CHAIN_RULES.capexYoyPct;
  return { rows, state: yoy == null ? null : yoy > R ? 'tighter' : yoy < -R ? 'easier' : 'flat' };
}

// ── ② 현금 ────────────────────────────────────────────────────────────────
function negativesSaid(list, pick, measure) {
  return sayJoin(list.map((row) => say('{s} {v}', { s: row.symbol, v: fig(`funding:${row.symbol}`, measure, pick(row).end, pick(row).fcf, 'usd', `${row.symbol} 잉여현금흐름`) })), ' · ');
}
function cashLink(group, issuers) {
  const rows = [];
  let state = null;
  if (group?.complete && Number.isFinite(group.capexToOcfPct)) {
    const asOf = group.endRange?.[1] || null;
    const subject = 'funding:hyperscalers';
    const then = readNumber(group.yearAgo?.capexToOcfPct);
    const ocfThen = readNumber(group.yearAgo?.ocf);
    const ocfYoy = ocfThen > 0 && Number.isFinite(group.ocf) ? (group.ocf / ocfThen - 1) * 100 : null;
    rows.push(autoRow({ id: 'capex-to-ocf', subject, asOf, label: `설비투자 ÷ 영업현금흐름(${group.members.length}개사 합계)`,
      value: say('{v}', { v: fig(subject, 'capexToOcf', asOf, group.capexToOcfPct, 'share', '설비투자 ÷ 영업현금흐름', 1) }),
      // The ratio falls only when operating cash grows faster than capex (the row above carries capex's own change).
      change: then == null ? NOTHING : sayJoin([say('1년 전 {w}', { w: fig(subject, 'capexToOcfYearAgo', asOf, then, 'share', '1년 전', 1) }),
        ocfYoy == null ? NOTHING : say('영업현금흐름 1년 전 대비 {o}', { o: fig(subject, 'ocfYoy', asOf, ocfYoy, 'pct', '영업현금흐름 1년 전 대비', 1) })], ', ') }));
    if (then != null) {
      const moved = group.capexToOcfPct - then, R = FUNDING_CHAIN_RULES.capexToOcfPp;
      state = moved >= R ? 'tighter' : moved <= -R ? 'easier' : 'flat';
    }
  }
  const spenders = (issuers || []).filter((row) => SPENDER_GROUPS.has(row?.group) && Array.isArray(row.quarters));
  const hyperscalers = spenders.filter((row) => HYPERSCALERS.includes(row.symbol));
  const lastQ = (row) => row.quarters.at(-1);
  const quarterNegative = hyperscalers.filter((row) => Number.isFinite(lastQ(row)?.fcf) && lastQ(row).fcf < 0);
  if (quarterNegative.length) {
    const asOf = quarterNegative.map((row) => lastQ(row).end).sort().at(-1);
    rows.push(autoRow({ id: 'fcf-negative-quarter', subject: 'funding:fcf-quarter', asOf, label: '잉여현금흐름 마이너스(최근 분기)', value: negativesSaid(quarterNegative, lastQ, 'fcfQuarter') }));
  }
  // The neocloud reads beside the hyperscalers once its filings are in the artifact.
  for (const row of spenders.filter((issuer) => issuer.group === 'neocloud' && issuer.ttm)) {
    const subject = `funding:${row.symbol}`;
    const ratio = row.ttm.ocf > 0 ? readNumber(row.ttm.capexToOcfPct) : null;
    rows.push(autoRow({ id: `fcf-${row.symbol.toLowerCase()}`, subject, asOf: row.ttm.end, label: `${row.nameKo || row.symbol} 잉여현금흐름(최근 4분기)`,
      value: say('{v}', { v: fig(subject, 'fcfTtm', row.ttm.end, row.ttm.fcf, 'usd', '잉여현금흐름') }),
      change: ratio == null ? NOTHING : say('설비투자 ÷ 영업현금흐름 {r}', { r: fig(subject, 'capexToOcf', row.ttm.end, ratio, 'share', '설비투자 ÷ 영업현금흐름', 1) }) }));
  }
  const ttmNegative = hyperscalers.filter((row) => Number.isFinite(row.ttm?.fcf) && row.ttm.fcf < 0);
  if (ttmNegative.length) {
    const asOf = ttmNegative.map((row) => row.ttm.end).sort().at(-1);
    rows.push(autoRow({ id: 'fcf-negative-ttm', subject: 'funding:fcf-ttm', asOf, label: '잉여현금흐름 마이너스(최근 4분기)', value: negativesSaid(ttmNegative, (row) => row.ttm, 'fcfTtm') }));
  }
  if (group?.complete) {
    const asOf = group.endRange?.[1] || null;
    const subject = 'funding:hyperscalers';
    rows.push(autoRow({ id: 'fcf-group', subject, asOf, label: `잉여현금흐름(${group.members.length}개사 합계, 최근 4분기)`,
      value: say('{v}', { v: fig(subject, 'fcfTtm', asOf, group.fcf, 'usd', '잉여현금흐름') }),
      change: Number.isFinite(group.yearAgo?.fcf) ? say('1년 전 {w}', { w: fig(subject, 'fcfTtmYearAgo', asOf, group.yearAgo.fcf, 'usd', '1년 전') }) : NOTHING }));
  }
  return { rows, state };
}

// ── ④ 신용 가격 ───────────────────────────────────────────────────────────
// Effective yields first (what a borrower pays; they appear once the producer publishes them), then the spreads.
const CREDIT_SERIES = Object.freeze([
  ['hyYield', '하이일드 채권 금리'], ['cccYield', 'CCC 채권 금리'], ['igYield', '투자등급 채권 금리'],
  ['hyOas', '하이일드 스프레드'], ['cccOas', 'CCC 스프레드'], ['igOas', '투자등급 스프레드']
]);
function seriesRow(macroHistory, id, label) {
  const read = oasDelta20Bp(macroHistory, id);
  if (!read) return null;
  const subject = `funding:${id}`;
  return autoRow({ id, subject, asOf: read.date, label,
    value: say('{v}', { v: fig(subject, 'level', read.date, read.level, 'rate', label, 2) }),
    change: say('20거래일 {c}', { c: fig(subject, 'change20d', read.date, read.value, 'bp', '20거래일 변화', 0) }) });
}
function creditLink(macroHistory) {
  const rows = CREDIT_SERIES.map(([id, label]) => seriesRow(macroHistory, id, label)).filter(Boolean);
  const hy = oasDelta20Bp(macroHistory, 'hyOas');
  const R = FUNDING_CHAIN_RULES.hyOas20dBp;
  return { rows, state: hy ? (hy.value >= R ? 'tighter' : hy.value <= -R ? 'easier' : 'flat') : null };
}

// ── ⑦ 금리·유동성 ─────────────────────────────────────────────────────────
const observations = (macroHistory, id) => (macroHistory?.series?.[id]?.observations || [])
  .map(([date, value]) => ({ date: dayOf(date), value: readNumber(value) })).filter((row) => isIsoDay(row.date) && row.value != null);
function ratesLink(macroHistory) {
  const rows = [];
  const votes = [];
  const ten = oasDelta20Bp(macroHistory, 'dgs10');
  if (ten) {
    const row = seriesRow(macroHistory, 'dgs10', '미국 10년 국채 금리');
    rows.push(row);
    const R = FUNDING_CHAIN_RULES.tenYear20dBp;
    votes.push(ten.value >= R ? 'tighter' : ten.value <= -R ? 'easier' : 'flat');
  }
  const upper = observations(macroHistory, 'fedTargetUpper').at(-1), lower = observations(macroHistory, 'fedTargetLower').at(-1);
  const target = upper && lower ? fedTargetRange(lower.value, upper.value, lower.date, upper.date) : null;
  if (target) {
    const subject = 'funding:fedTarget';
    rows.push(autoRow({ id: 'fed-target', subject, asOf: target.asOf, label: '연준 기준금리 목표 범위',
      value: say('{v.range}', { v: claim({ subject, measure: 'fedTarget', asOf: target.asOf, figures: [{ value: target.lower, unit: 'rate', basis: 'lower', label: '하단' }, { value: target.upper, unit: 'rate', basis: 'upper', label: '상단' }] }) }) }));
  }
  const net = netLiquiditySeries(macroHistory);
  const last = net.at(-1);
  if (last) {
    const cutoff = new Date(Date.parse(`${last.date}T00:00:00Z`) - 28 * 86400000).toISOString().slice(0, 10);
    const then = [...net].reverse().find((row) => row.date <= cutoff) || null;
    const subject = 'funding:netLiquidity';
    const delta = then ? last.value - then.value : null; // USD billions
    rows.push(autoRow({ id: 'net-liquidity', subject, asOf: last.date, label: '순유동성(연준 자산 − TGA − 역레포)',
      value: say('{v}', { v: fig(subject, 'level', last.date, last.value * 1e9, 'usd', '순유동성') }),
      change: delta == null ? NOTHING : say('4주 {c}', { c: fig(subject, 'change4w', last.date, delta * 1e9, 'usdChange', '4주 변화') }) }));
    if (delta != null) { const R = FUNDING_CHAIN_RULES.netLiquidity4wBn; votes.push(delta <= -R ? 'tighter' : delta >= R ? 'easier' : 'flat'); }
  }
  const tighter = votes.includes('tighter'), easier = votes.includes('easier');
  return { rows, state: !votes.length ? null : tighter && easier ? 'mixed' : tighter ? 'tighter' : easier ? 'easier' : 'flat' };
}

const RULE_TEXT = Object.freeze({
  capex: () => `설비투자 최근 4분기 합계가 1년 전보다 ${FUNDING_CHAIN_RULES.capexYoyPct}% 넘게 늘면 ${W.states.tighter}, ${FUNDING_CHAIN_RULES.capexYoyPct}% 넘게 줄면 ${W.states.easier}`,
  cash: () => `설비투자 ÷ 영업현금흐름이 1년 전보다 ${FUNDING_CHAIN_RULES.capexToOcfPp}%p 이상 오르면 ${W.states.tighter}, ${FUNDING_CHAIN_RULES.capexToOcfPp}%p 이상 내리면 ${W.states.easier}`,
  credit: () => `하이일드 스프레드 20거래일 변화가 +${FUNDING_CHAIN_RULES.hyOas20dBp}bp 이상이면 ${W.states.tighter}, -${FUNDING_CHAIN_RULES.hyOas20dBp}bp 이하이면 ${W.states.easier}(신용 축과 같은 선)`,
  rates: () => `10년 국채 금리 20거래일 ±${FUNDING_CHAIN_RULES.tenYear20dBp}bp, 순유동성 4주 ±${(FUNDING_CHAIN_RULES.netLiquidity4wBn * 10).toLocaleString('en-US')}억 달러를 넘는 쪽으로 판정(금리 상승·유동성 감소가 ${W.states.tighter}, 둘이 반대면 ${W.states.mixed})`
});

/** Which rows face the link: automated first, leaving room for the researched rows the link exists to show. */
function faceRows(auto, researched) {
  const autoCap = researched.length >= 2 ? 1 : researched.length ? 2 : FUNDING_FACE_ROWS;
  const autoShown = auto.slice(0, autoCap);
  return [...autoShown, ...researched.slice(0, FUNDING_FACE_ROWS - autoShown.length)];
}

/**
 * The chain: { links: [{ id, n, title, rows, face, state, stateWord, rule, empty }], said, ruleLines, sources, researchState }.
 * @param {object} input
 * @param {object} [input.cashflow]     public-data/bigtech-cashflow.json, already judged usable by the caller (else null)
 * @param {object} [input.macroHistory] public-data/macro-history.json
 * @param {object} [input.research]     public-data/research-reference.json
 */
export function aiFundingChain({ cashflow = null, macroHistory = null, research = null, nowMs = Date.now(), researchLoadState = 'loading' } = {}) {
  const view = (groups) => researchReference(research, { nowMs, groups, loadState: researchLoadState });
  const researched = (id) => (LINK_RESEARCH[id] ? view(LINK_RESEARCH[id]).rows.map(researchedRow) : []);
  const auto = {
    capex: capexLink(cashflow?.hyperscalers),
    cash: cashLink(cashflow?.hyperscalers, cashflow?.issuers),
    credit: creditLink(macroHistory),
    rates: ratesLink(macroHistory)
  };
  const links = FUNDING_CHAIN_LINK_IDS.map((id, index) => {
    const autoRows = auto[id]?.rows || [];
    const researchRows = researched(id);
    // Only automated rows decide a state; a link without one has none, whatever its researched rows say.
    const state = autoRows.length ? auto[id]?.state ?? null : null;
    const rows = [...autoRows, ...researchRows];
    return Object.freeze({ id, n: index + 1, title: W.links[id], rows, face: faceRows(autoRows, researchRows), state, stateWord: state ? W.states[state] : null,
      rule: state && RULE_TEXT[id] ? RULE_TEXT[id]() : null, empty: !rows.length });
  });
  const judged = links.filter((link) => link.state);
  const count = (value, label) => fig('funding:chain', label, null, value, 'count', label);
  const tighter = judged.filter((link) => link.state === 'tighter').length, easier = judged.filter((link) => link.state === 'easier').length;
  const said = judged.length ? sayJoin([
    say(`${W.auto} 고리 {n} 중 {t} ${W.states.tighter}`, { n: count(judged.length, '판정 고리'), t: count(tighter, W.states.tighter) }),
    easier ? say(`{e} ${W.states.easier}`, { e: count(easier, W.states.easier) }) : NOTHING
  ], ', ') : NOTHING;
  const sources = [...new Map(links.flatMap((link) => link.rows).filter((row) => row.kind === 'researched' && row.sourceUrl).map((row) => [row.sourceUrl, { name: row.sourceName || row.sourceUrl, url: row.sourceUrl }])).values()];
  return Object.freeze({ links, said, ruleLines: links.filter((link) => link.rule).map((link) => `${link.n}. ${link.title}: ${link.rule}`), sources,
    researchState: research ? 'loaded' : researchLoadState });
}

/**
 * The chain as dated fact lines for the AI market-reading input: one line for the rule-decided count, then one per row
 * in chain order, each with its link, its kind (automated or researched) and its own date. Pure; '' rows dropped.
 */
export function fundingChainFactLines(input = {}) {
  const chain = aiFundingChain({ researchLoadState: 'failed', ...input });
  const rows = chain.links.flatMap((link) => link.rows.map((row) => {
    const basis = row.kind === 'researched'
      ? `${RESEARCH_WORDS.factLead}, ${RESEARCH_WORDS.factBasis}${row.stale ? `, ${RESEARCH_WORDS.stale}` : ''}`
      : `${W.auto}${link.stateWord ? `, 고리 상태 ${link.stateWord}` : ''}`;
    return `${W.title} ${link.n}.${link.title}(${basis}; 기준일 ${row.asOf}): ${row.said.text}${row.note ? ` — ${row.note}` : ''}`;
  }));
  if (!rows.length) return [];
  return [...(chain.said.text ? [`${W.title}(규칙 판정, 자동 집계 고리만): ${chain.said.text}`] : []), ...rows];
}

/**
 * The AI market reading's researched input: the chain's lines, then the researched rows of every group the chain does
 * not carry (fund flows), so no researched row reaches the reading twice.
 */
export function marketReadingFundingLines({ research = null, ...input } = {}) {
  const others = RESEARCH_GROUP_IDS.filter((id) => !FUNDING_CHAIN_RESEARCH_GROUPS.includes(id));
  return [...fundingChainFactLines({ research, ...input }), ...researchFactLines(research, { nowMs: input.nowMs ?? Date.now(), groups: others })];
}
