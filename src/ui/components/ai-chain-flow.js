import { el } from './dom.js';
import { signedText } from '../../domain/shared/number.js';
import { signedBar } from './signed-bar.js';
import { frameHead, markFrame } from './section-frame.js';
import { aiChainFlow, defensiveContrast, leaderFalls } from '../../domain/briefing/ai-chain-flow.js';
import { fallBars } from './fall-bars.js';
import { foldSummary, markFold } from './indicator-face.js';
import { buildTwRevenueView, signedPct } from '../../domain/briefing/tw-monthly-revenue.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { CONSENSUS_KEY, requestConsensusEstimates } from '../../data/consensus-estimates.js';
import { layerValuation, LAYER_PER_MIN_COVERAGE, LAYER_PER_MIN_MEASURED } from '../../domain/themes/layer-valuation.js';
import { TW_MONTHLY_REVENUE } from '../../data/artifact-registry.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { aiMapRouteParams } from '../../domain/knowledge/ai-map.js';

// Rounded first, so a move under 0.05% reads 0.0% and is flat, never "+0.0%" or "-0.0%".
const tenth = (value) => (value == null ? null : Math.round(value * 10) / 10 || 0);
const signed = (value) => (value == null ? '-' : signedText(value, 1, '%'));
const direction = (value) => { const v = tenth(value); return v == null || v === 0 ? 'flat' : v < 0 ? 'down' : 'up'; };

function sessionLabel(root) {
  const day = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || '';
  const [, m, d] = String(day).split('-').map(Number);
  return m && d ? `${m}/${d} 종가 기준` : '종가 기준';
}

/** 테마: the same block opens the page, above 섹터 회전 (owner 2026-10-30, each screen carries the AI-chain read). */
export function paintThemesAiChain(doc, root) {
  const page = doc?.getElementById('page-themes');
  if (!page) return null;
  return paintAiChain(doc, root, { id: 'themes-ai-chain', frame: 'themes.ai-chain', className: 'aio-section ai-chain', more: false, valuation: true, mapLink: true, place: (host) => {
    host.id = 'themes-ai-chain';
    const head = page.querySelector(':scope > .page-head');
    if (head) head.insertAdjacentElement('afterend', host); else page.prepend(host);
  } });
}

/**
 * v60.50 (owner 2026-11-23): 테마와 섹터 opens with the leaders against the rest — the domain's line (ai-chain-flow.js
 * leaderFalls) and its two bars at the top of the summary card, the member counts in a fold. Hidden until both sides
 * are measured on the screener's US close.
 */
export function paintThemesLeaderFalls(doc, root) {
  const read = doc?.getElementById('rrg-rotation-read');
  if (!read) return null;
  const session = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || null;
  const falls = leaderFalls({ themes: root?.THEME_MAP || [], rows: root?.AIO_ARCH?.getScreenerState?.('rows') || [], session });
  let host = doc.getElementById('themes-leader-falls');
  if (!host) { host = el(doc, 'div', null, 'themes-leader-falls'); host.id = 'themes-leader-falls'; read.before(host); }
  host.hidden = !falls;
  if (!falls) { host.replaceChildren(); return null; }
  const wasOpen = host.querySelector('details')?.open;
  const fold = markFold(el(doc, 'details', null, 'themes-leader-falls__more'), 'method');
  fold.append(foldSummary(doc, 'method', '두 묶음에 든 종목'),
    el(doc, 'p', `주도 테마는 반도체·AI 인프라·광통신 테마의 세부 묶음에 든 미국 종목(${falls.leaders.listed}개 중 고점 기록이 있는 ${falls.leaders.measured}개), 나머지 테마는 다른 테마에만 든 미국 종목(${falls.rest.listed}개 중 ${falls.rest.measured}개)입니다. 각 종목의 52주 종가 고점 대비 하락을 단순 평균했습니다. 포트폴리오 화면의 주도 영역과 같은 종목 묶음입니다.`, 'mk-story__read'));
  if (wasOpen) fold.open = true;
  host.replaceChildren(el(doc, 'p', falls.said.text, 'briefing-read-headline v2-stock-lede'), fallBars(doc, falls.bars, `52주 종가 고점 대비 평균 하락, ${sessionLabel(root)}`), fold);
  return falls;
}

function twRevenue(doc, root, id, repaint) {
  (root.__aioTwRevenueRepaint ||= {})[id] = repaint; // home and 테마 each repaint their own block when a new copy lands
  if (!root.__aioTwRevenueRequested) {
    root.__aioTwRevenueRequested = true;
    const done = (payload, changed) => {
      root.__aioTwRevenueRequested = false;
      root.__aioTwRevenueLoad = payload ? 'loaded' : 'failed';
      if (changed) Object.values(root.__aioTwRevenueRepaint).forEach((fn) => fn());
    };
    refreshSharedArtifact(root, TW_MONTHLY_REVENUE).then(({ payload, changed }) => done(payload, changed)).catch(() => done(root[TW_MONTHLY_REVENUE.key] || null, false));
  }
  const view = buildTwRevenueView(root[TW_MONTHLY_REVENUE.key] || null, { loadState: root.__aioTwRevenueLoad || 'loading' });
  if (view.state !== 'ok') return null;
  const face = el(doc, 'p', view.reading, 'ai-chain__reading ai-chain__tw');
  face.title = `${view.source || '대만증권거래소 월매출'} · 회사가 신고한 월 매출 합계의 1년 전 같은 달 대비 변화`;
  const fold = [el(doc, 'p', `대만 월매출 (${Number(view.month.slice(5, 7))}월, 1년 전 같은 달 대비 · 지난달 대비)`, 'event-brief__sub')];
  for (const group of view.groups) {
    fold.push(el(doc, 'p', `${group.name} ${signedPct(group.yoyPct)} — ${group.members.map((m) => `${m.name} ${signedPct(m.yoyPct)}(지난달 대비 ${signedPct(m.momPct)})`).join(', ')}`, 'ai-chain__member-list'));
  }
  fold.push(el(doc, 'p', '대만 상장사는 매달 10일까지 전월 매출을 공시합니다. 미국 분기 실적보다 먼저 나오는 수요 신호이고, 묶음 값은 회사별 금액을 더해 계산합니다.', 'ai-chain__member-list'));
  return { face, fold };
}

const PER_TICKS = Object.freeze([5, 10, 20, 50, 100, 200]);
function layerPerFold(doc, root, repaint) {
  const consensus = root?.[CONSENSUS_KEY] || null;
  if (!consensus) { requestConsensusEstimates(root, repaint); return null; }
  const view = layerValuation({ themes: root?.THEME_MAP || [], rows: root?.AIO_ARCH?.getScreenerState?.('rows') || [], consensus });
  if (!view.layers.length) return null;
  const values = view.layers.flatMap((layer) => [layer.trailingPe, layer.forwardPe]);
  const lo = Math.log10(Math.max(1, Math.min(...values) * 0.85));
  const hi = Math.log10(Math.max(...values) * 1.15);
  const at = (value) => `${((Math.log10(value) - lo) / (hi - lo) * 100).toFixed(2)}%`;
  const times = (value) => `${value.toFixed(1)}배`;
  const fold = el(doc, 'details', null, 'ai-chain__members ai-chain-per');
  fold.append(el(doc, 'summary', '층별 PER, 지난 4분기에서 다음 4분기로'));
  const list = el(doc, 'ul', null, 'ai-chain-per__rows');
  list.setAttribute('aria-label', `층별 PER 중앙값, 지난 4분기 컨센서스 EPS 기준과 다음 4분기 기준, 로그 축`);
  for (const layer of view.layers) {
    const li = el(doc, 'li', null, 'ai-chain-per__row');
    const track = el(doc, 'span', null, 'ai-chain-per__track');
    const [left, right] = [layer.trailingPe, layer.forwardPe].sort((a, b) => a - b);
    const line = el(doc, 'span', null, 'ai-chain-per__line');
    line.style.left = at(left);
    line.style.width = `calc(${at(right)} - ${at(left)})`;
    const trailing = el(doc, 'span', null, 'ai-chain-per__dot ai-chain-per__dot--trailing');
    trailing.style.left = at(layer.trailingPe);
    const forward = el(doc, 'span', null, 'ai-chain-per__dot ai-chain-per__dot--forward');
    forward.style.left = at(layer.forwardPe);
    track.append(line, trailing, forward);
    const label = `${layer.name}: 지난 4분기 ${times(layer.trailingPe)} → 다음 4분기 ${times(layer.forwardPe)}, ${layer.measured}/${layer.listed}종목${layer.lossMakers.length ? `, 적자 ${layer.lossMakers.length}종목 제외` : ''}`;
    li.title = `${label} (${layer.members.map((m) => `${m.sym} ${times(m.trailingPe)}→${times(m.forwardPe)}`).join(', ')}${layer.lossMakers.length ? `; 적자 ${layer.lossMakers.join(', ')}` : ''})`;
    li.setAttribute('aria-label', label);
    li.append(el(doc, 'span', layer.name, 'ai-chain-per__name'), track, el(doc, 'span', `${times(layer.trailingPe)} → ${times(layer.forwardPe)}`, 'ai-chain-per__value'));
    list.append(li);
  }
  const axis = el(doc, 'div', null, 'ai-chain-per__axis');
  axis.setAttribute('aria-hidden', 'true');
  const axisTrack = el(doc, 'span', null, 'ai-chain-per__track');
  for (const tick of PER_TICKS) {
    if (Math.log10(tick) < lo || Math.log10(tick) > hi) continue;
    const mark = el(doc, 'span', `${tick}`, 'ai-chain-per__tick');
    mark.style.left = at(tick);
    axisTrack.append(mark);
  }
  axis.append(el(doc, 'span', '', 'ai-chain-per__name'), axisTrack, el(doc, 'span', '배', 'ai-chain-per__value'));
  const day = String(view.asOf || '').slice(5, 10).split('-').map(Number);
  // The medians speak for the profitable members only; the face says how many loss-makers that leaves out.
  const losses = new Set(view.layers.flatMap((layer) => layer.lossMakers)).size;
  const legend = el(doc, 'p', `빈 점 지난 4분기 · 찬 점 다음 4분기 · 컨센서스 EPS${day[0] && day[1] ? ` ${day[0]}/${day[1]}` : ''} · 로그 축${losses ? ` · 적자 ${losses}종목 제외` : ''}`, 'ai-chain__scale');
  if (view.hidden.length) {
    legend.title = `표시하지 않은 층(양의 EPS 두 기간과 종가가 있는 종목이 ${LAYER_PER_MIN_MEASURED}개 미만이거나 상장 종목의 ${Math.round(LAYER_PER_MIN_COVERAGE * 100)}% 미만): ${view.hidden.map((layer) => `${layer.name} ${layer.measured}/${layer.listed}`).join(', ')}`;
  }
  fold.append(legend, list, axis);
  return fold;
}

function paintAiChain(doc, root, { id, frame, className, more: withLink, place, limit = Infinity, valuation = false, mapLink = false }) {
  const rows = root?.AIO_ARCH?.getScreenerState?.('rows') || [];
  const session = root?.AIO_ARCH?.getScreenerState?.('metadata.factorSessionDateByMarket')?.US || null;
  const flow = aiChainFlow({ themes: root?.THEME_MAP || [], rows, session });
  let host = doc.getElementById(id);
  if (!flow.groups.length) { if (host) host.hidden = true; return flow; }
  if (!host) {
    host = el(doc, 'section', null, className);
    host.setAttribute('aria-labelledby', `${id}-title`);
    place(host);
  }
  const head = frameHead(doc, { title: 'AI 공급망 흐름', titleId: `${id}-title`, titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  head.title = '테마 화면의 반도체·AI 인프라·광통신 묶음별 미국 종목 중앙값입니다. 막대는 한 달, 숫자는 지난 거래일';
  markFrame(host, frame);
  const scale = Math.max(...flow.groups.map((group) => Math.abs(group.ret1m || 0)), 1);
  const barList = (groups) => {
    const chart = el(doc, 'ul', null, 'ai-chain__bars');
    chart.setAttribute('aria-label', `묶음별 한 달 중앙값, ${sessionLabel(root)}`);
    for (const group of groups) {
      const li = el(doc, 'li', null, 'ai-chain__row');
      const day = el(doc, 'span', signed(group.ret1d), 'ai-chain__day');
      day.dataset.direction = direction(group.ret1d);
      const name = el(doc, 'span', group.name, 'ai-chain__name');
      name.title = group.name;
      li.append(name, signedBar(doc, Number(group.ret1m) || 0, scale), el(doc, 'span', signed(group.ret1m), 'ai-chain__month'), day);
      li.children[2].dataset.direction = direction(group.ret1m);
      chart.append(li);
    }
    return chart;
  };
  // The face shows the `limit` largest one-month moves (by size, either direction); the rest open in the fold.
  const ranked = Number.isFinite(limit) ? [...flow.groups].sort((a, b) => Math.abs(b.ret1m || 0) - Math.abs(a.ret1m || 0)) : flow.groups;
  const shown = new Set(ranked.slice(0, limit));
  const chart = barList(flow.groups.filter((group) => shown.has(group)));
  const others = flow.groups.filter((group) => !shown.has(group));
  const legend = el(doc, 'p', `막대 1개월 · 숫자 1일 · ${sessionLabel(root)}`, 'ai-chain__scale');
  const contrast = defensiveContrast(root?._serverDataMeta?.rotationHistory || null);
  const fullReading = contrast ? `${flow.reading} ${contrast}` : flow.reading;
  // Face: the reading's first sentence (the count of groups that fell); the full reading leads the fold.
  const faceReading = Number.isFinite(limit) ? (String(flow.reading).match(/^.*?다\.(?=\s|$)/)?.[0] || flow.reading) : fullReading;
  const wasOpen = !!host.querySelector(':scope > details:not(.ai-chain-per)')?.open;
  const fold = el(doc, 'details', null, 'ai-chain__members');
  fold.open = wasOpen || !Number.isFinite(limit); // on 테마 the members are the AI 공급망 view's content
  if (!Number.isFinite(limit)) fold.dataset.viewOpen = '';
  fold.append(el(doc, 'summary', Number.isFinite(limit) ? `전체 ${flow.groups.length}개 묶음과 종목` : '묶음별 종목 보기'));
  if (Number.isFinite(limit)) {
    fold.append(el(doc, 'p', fullReading, 'ai-chain__reading'));
    if (others.length) fold.append(barList(others));
  }
  // Taiwan's monthly revenue opens the member lists: a short block, read before the long US lists.
  // One repaint for every late arrival (Taiwan revenue, consensus): it carries every option of this paint. The Taiwan
  // callback dropped `valuation`, so revenue landing after the PER fold removed the fold and its rows.
  const repaint = () => paintAiChain(doc, root, { id, frame, className, more: withLink, place, limit, mapLink, valuation });
  const tw = twRevenue(doc, root, id, repaint);
  if (tw) fold.append(...tw.fold);
  const perFold = valuation ? layerPerFold(doc, root, repaint) : null;
  if (perFold) perFold.open = !!host.querySelector(':scope > details.ai-chain-per')?.open;
  if (!Number.isFinite(limit)) fold.append(el(doc, 'p', '종목 옆 숫자는 한 달 수익률, 괄호 안은 지난 거래일입니다.', 'ai-chain__member-list'));
  for (const group of flow.groups) {
    fold.append(el(doc, 'p', group.name, 'event-brief__sub'),
      el(doc, 'p', group.members.map((member) => `${member.sym} ${signed(member.ret1m)}(${signed(member.ret1d)})`).join(', '), 'ai-chain__member-list'));
  }
  const more = el(doc, 'button', '테마별 흐름 → 테마와 섹터', 'flow-next-link daily-card-more');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'themes';
  // 테마 › AI 공급망: the whole map of the build-out (layers, data-center chain, capital flows) is 산업 지도's AI 지도.
  const atlasMap = mapLink ? el(doc, 'button', 'AI 지도 보기 → 산업 지도', 'flow-next-link daily-card-more ai-chain__map-link') : null;
  if (atlasMap) { atlasMap.type = 'button'; atlasMap.addEventListener('click', () => navigateKnowledgeRoute({ root, page: 'atlas', params: aiMapRouteParams() })); }
  host.replaceChildren(head, el(doc, 'p', faceReading, 'ai-chain__reading'), legend, chart, ...(tw ? [tw.face] : []), fold, ...(perFold ? [perFold] : []), ...(withLink ? [more] : []), ...(atlasMap ? [atlasMap] : []));
  host.hidden = false;
  return flow;
}
