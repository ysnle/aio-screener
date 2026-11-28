// 테마와 섹터 › AI 공급망: one verdict card — which fall this is (drawdownKind) on top, then three columns: 가격 (the
// layers' one-month medians), 주문 (Taiwan's monthly revenue, the hyperscalers' quarterly
// capex pace) and 자금 (the funding chain), and under them one table per layer: estimates against price, last quarter's
// beats, the PER pair. It paints into the static #themes-ai-chain slot (index.html, the page's AI view) — a lazy chunk
// like the release summaries; the rows and themes are the screener's and the 테마 screen's, already loaded.
import { el } from './dom.js';
import { signedText } from '../../domain/shared/number.js';
import { signedBar } from './signed-bar.js';
import { frameHead, markFrame } from './section-frame.js';
import { aiChainFlow, leaderFalls } from '../../domain/briefing/ai-chain-flow.js';
import { fallBars } from './fall-bars.js';
import { foldSummary, keepOpenFolds, kindFold, markFold } from './indicator-face.js';
import { buildTwRevenueView, signedPct } from '../../domain/briefing/tw-monthly-revenue.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { CONSENSUS_KEY, requestConsensusEstimates } from '../../data/consensus-estimates.js';
import { BIGTECH_CASHFLOW, TW_MONTHLY_REVENUE } from '../../data/artifact-registry.js';
import { bigtechGroupFor } from '../../data/bigtech-cashflow.js';
import { aiDemandRead, aiOrderRows, drawdownKind, DRAWDOWN_WORDS, ORDER_SIDE_WORDS } from '../../domain/briefing/ai-demand-read.js';
import { AI_LAYER_RULES, AI_LAYER_WORDS, aiLayerRead } from '../../domain/themes/ai-layer-read.js';
import { capexPace, hyperscalerQuarters } from '../../domain/themes/ai-capex-quarters.js';
import { CONSENSUS_NET_REVISION_FLOOR, CONSENSUS_PRICE_MOVE_PCT } from '../../domain/fundamental/consensus-read.js';
import { FUNDING_CHAIN_WORDS as W } from '../../domain/content/funding-chain-words.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { aiMapRouteParams } from '../../domain/knowledge/ai-map.js';
import { chainRowNode, fundingChainBlock, fundingChainFor } from './ai-funding-chain.js';

// Rounded first, so a move under 0.05% reads 0.0% and is flat, never "+0.0%" or "-0.0%".
const tenth = (value) => (value == null ? null : Math.round(value * 10) / 10 || 0);
const signed = (value) => (value == null ? '-' : signedText(value, 1, '%'));
const direction = (value) => { const v = tenth(value); return v == null || v === 0 ? 'flat' : v < 0 ? 'down' : 'up'; };
const TONE = Object.freeze({ demand: 'is-burden', funding: 'is-burden', damage: 'is-burden', expected: 'is-neutral', compression: 'is-neutral', confirmed: 'is-favorable' });
const tag = (doc, word, kind) => el(doc, 'span', word, `regime-state ${TONE[kind] || 'is-neutral'}`);
const monthDay = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

function column(doc, title, nodes) {
  const box = el(doc, 'section', null, 'fig ai-chain__col');
  box.append(el(doc, 'h3', title, 'fig__title'), ...nodes.filter(Boolean));
  return box;
}

function layerBars(doc, flow, session) {
  const scale = Math.max(...flow.groups.map((group) => Math.abs(group.ret1m || 0)), 1);
  const chart = el(doc, 'ul', null, 'ai-chain__bars');
  chart.setAttribute('aria-label', `층별 한 달 중앙값, ${monthDay(session)} 종가 기준`);
  for (const group of flow.groups) {
    const li = el(doc, 'li', null, 'ai-chain__row');
    const name = el(doc, 'span', group.name, 'ai-chain__name');
    name.title = `${group.name}, 미국 종목 ${group.measured}/${group.listed}`;
    const month = el(doc, 'span', signed(group.ret1m), 'ai-chain__month');
    month.dataset.direction = direction(group.ret1m);
    const day = el(doc, 'span', signed(group.ret1d), 'ai-chain__day');
    day.dataset.direction = direction(group.ret1d);
    // The shared two-sided bar — a falling layer sits left of the zero line instead of right-anchored.
    li.append(name, signedBar(doc, Number(group.ret1m) || 0, scale), month, day);
    chart.append(li);
  }
  return chart;
}

// The PER pair on one log axis shared by every row of the table: hollow dot the last four quarters, filled the next four.
function perCell(doc, per, axis) {
  const cell = el(doc, 'td', null, 'is-num');
  if (!per) { cell.textContent = '—'; return cell; }
  const at = (value) => `${((Math.log10(value) - axis.lo) / (axis.hi - axis.lo) * 100).toFixed(2)}%`;
  const track = el(doc, 'span', null, 'ai-chain-per__track'); // sized in themes-page.css
  track.setAttribute('aria-hidden', 'true');
  const [left, right] = [per.trailingPe, per.forwardPe].sort((a, b) => a - b);
  const line = el(doc, 'span', null, 'ai-chain-per__line');
  line.style.left = at(left);
  line.style.width = `calc(${at(right)} - ${at(left)})`;
  const trailing = el(doc, 'span', null, 'ai-chain-per__dot ai-chain-per__dot--trailing');
  trailing.style.left = at(per.trailingPe);
  const forward = el(doc, 'span', null, 'ai-chain-per__dot ai-chain-per__dot--forward');
  forward.style.left = at(per.forwardPe);
  track.append(line, trailing, forward);
  cell.title = `${per.measured}/${per.listed}종목${per.lossMakers.length ? `, 적자 ${per.lossMakers.join(', ')} 제외` : ''}`;
  cell.append(track, doc.createTextNode(` ${per.trailingPe.toFixed(1)}배 → ${per.forwardPe.toFixed(1)}배`));
  return cell;
}

function layerTable(doc, read) {
  const pers = read.layers.map((layer) => layer.per).filter(Boolean);
  const values = pers.flatMap((per) => [per.trailingPe, per.forwardPe]);
  const axis = values.length ? { lo: Math.log10(Math.max(1, Math.min(...values) * 0.85)), hi: Math.log10(Math.max(...values) * 1.15) } : null;
  const labels = ['층', '추정치 4주(상향·하향 종목)', '주가 대 추정치', '최근 분기 추정 상회', '실적 대 기대', 'PER 지난 → 다음 4분기'];
  const table = el(doc, 'table', null, 'ai-chain__layers');
  const head = el(doc, 'thead'), hr = el(doc, 'tr');
  labels.forEach((label) => hr.append(el(doc, 'th', label)));
  head.append(hr);
  const body = el(doc, 'tbody');
  for (const layer of read.layers) {
    const tr = el(doc, 'tr');
    tr.dataset.layer = layer.id;
    const word = (kind) => { const td = el(doc, 'td'); if (kind) td.append(tag(doc, AI_LAYER_WORDS[kind], kind)); return td; };
    const rev = layer.revisions;
    const beats = layer.beats;
    tr.append(el(doc, 'td', layer.name),
      el(doc, 'td', rev.measured ? `${rev.up} · ${rev.down} / ${rev.measured}` : '—', 'is-num'), word(layer.tag),
      el(doc, 'td', beats.measured ? `${beats.beat}/${beats.measured}` : '—', 'is-num'), word(layer.beatTag),
      axis ? perCell(doc, layer.per, axis) : el(doc, 'td', '—', 'is-num'));
    [...tr.children].forEach((cell, index) => { cell.dataset.label = labels[index]; });
    body.append(tr);
  }
  table.append(head, body);
  const scroll = el(doc, 'div', null, 'aio-table-scroll');
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', '층별 추정치·실적·PER 표, 가로 스크롤');
  scroll.tabIndex = 0;
  scroll.append(table);
  const quarter = read.layers.map((layer) => layer.beats.quarter).filter(Boolean).sort().at(-1);
  const legend = el(doc, 'p', `컨센서스 ${monthDay(read.asOf)}${quarter ? ` · 최근 분기 ${Number(quarter.slice(5, 7))}월 끝까지` : ''} · PER 빈 점 지난 4분기, 찬 점 다음 4분기, 로그 축`, 'ai-chain__scale');
  return [legend, scroll];
}

function memberFold(doc, flow, tw) {
  const body = [];
  for (const group of flow.groups) {
    body.push(el(doc, 'p', `${group.name} (한 달, 괄호 안 지난 거래일)`, 'event-brief__sub'),
      el(doc, 'p', group.members.map((member) => `${member.sym} ${signed(member.ret1m)}(${signed(member.ret1d)})`).join(', '), 'ai-chain__member-list'));
  }
  if (tw) {
    body.push(el(doc, 'p', `대만 월매출 (${Number(tw.month.slice(5, 7))}월, 1년 전 같은 달 대비 · 지난달 대비)`, 'event-brief__sub'));
    for (const group of tw.groups) body.push(el(doc, 'p', `${group.name} ${signedPct(group.yoyPct)} — ${group.members.map((m) => `${m.name} ${signedPct(m.yoyPct)}(${signedPct(m.momPct)})`).join(', ')}`, 'ai-chain__member-list'));
  }
  return kindFold(doc, 'raw-table', '층별 종목과 대만 회사별 매출', body);
}

function methodFold(doc) {
  const p = (text) => el(doc, 'p', text, 'ai-chain__member-list');
  return kindFold(doc, 'method', '하락 판정과 층별 판정', [
    p(`어떤 하락인가: 대만 월매출과 빅테크 설비투자(최근 4분기)가 모두 1년 전보다 늘고 층의 절반 넘게 한 달 새 내렸는데 자금 사슬의 ${W.links.credit}·${W.links.rates} 고리 중 하나라도 ${W.states.tighter}이면 ${DRAWDOWN_WORDS.funding}, 둘 다 아니면 ${DRAWDOWN_WORDS.price}. 주문 숫자 하나라도 1년 전보다 줄면 자금과 관계없이 ${DRAWDOWN_WORDS.demand}.`),
    p('GPU 임대료는 조사값이라 이 판정에 넣지 않고 자금 사슬 장비 가격 고리에 날짜와 함께 둡니다.'),
    p(`주가 대 추정치: 종목마다 4주 상향 − 하향 건수가 ${CONSENSUS_NET_REVISION_FLOOR}건 이상이면 그 방향으로 세고, 층의 한 달 중앙값이 -${CONSENSUS_PRICE_MOVE_PCT}% 이하일 때 상향 종목이 많으면 ${AI_LAYER_WORDS.compression}, 하향 종목이 많으면 ${AI_LAYER_WORDS.damage}. 측정 종목이 ${AI_LAYER_RULES.minMeasured}개 미만이면 판정하지 않습니다.`),
    p(`실적 대 기대: 최근 분기(층에서 가장 늦은 분기 끝과 ${AI_LAYER_RULES.sameCycleMonths}개월 안) 실적이 추정을 넘은 종목이 ${AI_LAYER_RULES.beatMajorityPct}%를 넘으면 ${AI_LAYER_WORDS.confirmed}, 넘지 못했는데 추정치 상향 종목이 많으면 ${AI_LAYER_WORDS.expected}. 그 분기를 아직 발표하지 않은 종목은 분모에서 뺍니다.`)
  ]);
}

/** 테마와 섹터 › 요약 opens with the leaders against the rest: the line (leaderFalls) and its two bars above the rotation
 * read, the member counts in a fold. Hidden until both sides are measured on the screener's US close. */
export function paintThemesLeaderFalls(doc, root) {
  const read = doc?.getElementById('rrg-rotation-read');
  if (!read) return null;
  const session = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || null;
  const falls = leaderFalls({ themes: root?.THEME_MAP || [], rows: root?.AIO_ARCH?.getScreenerState?.('rows') || [], session });
  let host = doc.getElementById('themes-leader-falls');
  if (!host) { host = el(doc, 'div', null, 'themes-leader-falls'); host.id = 'themes-leader-falls'; read.before(host); }
  host.hidden = !falls;
  if (!falls) { host.replaceChildren(); return null; }
  const reopen = keepOpenFolds(host);
  const fold = markFold(el(doc, 'details', null, 'themes-leader-falls__more'), 'method');
  fold.append(foldSummary(doc, 'method', '두 묶음에 든 종목'),
    el(doc, 'p', `주도 테마 미국 종목 ${falls.leaders.measured}/${falls.leaders.listed}개, 나머지 테마 미국 종목 ${falls.rest.measured}/${falls.rest.listed}개 (고점 기록이 있는 종목 / 묶음 전체)`, 'ai-chain__member-list'));
  host.replaceChildren(el(doc, 'p', falls.said.text, 'briefing-read-headline v2-stock-lede'), fallBars(doc, falls.bars, `52주 종가 고점 대비 평균 하락, ${session ? `${monthDay(session)} 종가` : ''}`), fold);
  reopen();
  return falls;
}

/** 테마 › AI 공급망: the card in its static slot; null without the slot, the flow when painted. */
export function paintThemesAiChain(doc, root) {
  const host = doc?.getElementById('themes-ai-chain');
  if (!host) return null;
  const rows = root?.AIO_ARCH?.getScreenerState?.('rows') || [];
  const session = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || null;
  const themes = root?.THEME_MAP || [];
  const flow = aiChainFlow({ themes, rows, session });
  if (!flow.groups.length) { host.hidden = true; return flow; }
  // Every late artifact (Taiwan revenue, cash flow, consensus, the chain's three) repaints the whole card once.
  const repaint = () => paintThemesAiChain(doc, root);
  for (const artifact of [TW_MONTHLY_REVENUE, BIGTECH_CASHFLOW]) refreshSharedArtifact(root, artifact).then(({ changed } = {}) => { if (changed) repaint(); }).catch(() => {});
  if (!root?.[CONSENSUS_KEY]) requestConsensusEstimates(root, repaint);
  const twView = buildTwRevenueView(root[TW_MONTHLY_REVENUE.key] || null, { loadState: root[TW_MONTHLY_REVENUE.key] ? 'loaded' : 'loading' });
  const tw = twView.state === 'ok' ? twView : null;
  const capex = bigtechGroupFor(root);
  const chain = fundingChainFor(root, { request: repaint });
  const demand = aiDemandRead({ flow, tw, capex, session });
  const kind = drawdownKind({ demand, chain });
  const pace = capex ? capexPace(hyperscalerQuarters(root[BIGTECH_CASHFLOW.key]?.issuers)) : null;
  const layers = root?.[CONSENSUS_KEY] ? aiLayerRead({ themes, rows, consensus: root[CONSENSUS_KEY], flow }) : { layers: [] };

  const reopen = keepOpenFolds(host);
  markFrame(host, 'themes.ai-chain');
  const head = frameHead(doc, { title: 'AI 공급망: 가격 · 주문 · 자금', titleId: 'themes-ai-chain-title', titleClass: 'briefing-h2', asOf: session ? `${monthDay(session)} 종가` : '' });
  head.classList.add('daily-card-head');
  const verdict = kind ? el(doc, 'p', null, 'briefing-read-headline ai-chain__verdict') : null;
  if (verdict) {
    verdict.append(tag(doc, kind.word, kind.kind));
    const link = (id) => chain.links.find((item) => item.id === id);
    const parts = [ORDER_SIDE_WORDS[kind.side], `한 달 하락 층 ${flow.down1m}/${flow.groups.length}`,
      ...kind.judged.map((id) => `${W.links[id]} ${link(id).stateWord}`)];
    verdict.append(doc.createTextNode(` ${parts.join(' · ')}`));
  }
  const price = column(doc, '가격', [
    el(doc, 'p', '층별 막대 1개월 · 숫자 1일', 'ai-chain__scale'), layerBars(doc, flow, session)]);
  const orderRows = aiOrderRows({ tw, pace });
  const orders = column(doc, '주문', orderRows.length ? [(() => { const ul = el(doc, 'ul', null, 'funding-chain__rows'); ul.append(...orderRows.map((row) => chainRowNode(doc, row))); return ul; })(),
    el(doc, 'p', `빅테크 설비투자 최근 4분기 합계는 ${W.title} 1번 고리`, 'ai-chain__scale')] : [el(doc, 'p', W.none, 'funding-chain__none')]);
  const funding = column(doc, '자금', [fundingChainBlock(doc, chain, { id: 'themes-ai-chain-funding' }) || el(doc, 'p', W.none, 'funding-chain__none')]);
  const grid = el(doc, 'div', null, 'fig-group ai-chain__grid');
  grid.append(price, orders, funding);
  const atlasMap = el(doc, 'button', 'AI 지도 보기 → 산업 지도', 'flow-next-link daily-card-more ai-chain__map-link');
  atlasMap.type = 'button';
  atlasMap.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'atlas', params: aiMapRouteParams() }));
  host.replaceChildren(head, ...(verdict ? [verdict] : []), grid, ...(layers.layers.length ? layerTable(doc, layers) : []), memberFold(doc, flow, tw), methodFold(doc), atlasMap);
  reopen();
  host.hidden = false;
  return flow;
}
