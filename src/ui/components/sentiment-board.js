// 투자 심리: the shared 심리 verdict (시장 상태's reference row) with its 판정 사유, the tally of the indicators' state words, the
// facts on the other side of the verdict, the AI reading, then one row per indicator (value, state word, distance to its
// next edge, two short lines) and the dated charts. Nothing on the face folds; the observations behind the rows are the
// raw-table fold #sentiment-raw, every indicator's definition, edges and principle the method fold #sentiment-method, the
// providers the page's 데이터 출처 fold (page-sources.js). The cards are built in src/domain/market/sentiment/sentiment-model.js.
import { principleLink } from './principle-link.js';
import { buildCloseSeries } from '../../domain/briefing/market-read.js';
import { vixBandRecord, vixBandLedeSaid, vixBandLedeMethod } from '../../domain/market/signal/vix-band-record.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { STRESS_OUTCOMES } from '../../data/artifact-registry.js';
import { AXIS_LABELS } from '../../domain/market/interpretation/concepts.js';
import { buildSentimentModel, sentimentCounter } from '../../domain/market/sentiment/sentiment-model.js';
import { fearGreedBand as publishedFearGreedBand } from '../../domain/market/sentiment/metrics.js';
import { createTrendChart } from './trend-chart.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { renderNextSteps } from './page-flow.js';
import { el } from './dom.js';
import { gaugeBar } from './gauge-bar.js';
import { partsBar } from './figures.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { BOTTOM_WATCH_WORDS } from '../../domain/content/rebound-words.js';
import { historyWaitText } from './data-state.js';
import { indicatorRow, kindFold, rawTable, setFoldBody } from './indicator-face.js';
import { renderScreenReading } from './screen-reading.js';
import { temperatureMethodNodes } from './market-temperature.js';

const CHIP_TONE = Object.freeze({ favorable: 'good', burden: 'warn', neutral: 'neutral', unknown: 'neutral' });
const shortTitle = (card) => card.title.replace(/ \(.*\)$/, '');

function cardRow(doc, card) {
  const row = indicatorRow(doc, { title: card.title, stateLabel: card.state?.label || (card.value === '—' ? '관측 없음' : '참고'), tone: CHIP_TONE[card.state?.tone] || 'neutral',
    value: card.value === '—' ? '' : card.value, distance: card.distance || '', lines: [['change', card.change], ['flip', card.flip]] });
  row.dataset.metric = card.id;
  if (card.value !== '—' && card.basis) row.children[0].append(el(doc, 'span', card.basis, `basis-chip${card.basisStatus === 'aligned' ? '' : ' is-off'}`));
  const parts = card.parts ? partsBar(doc, card.parts, { title: '응답 비율', share: false, ends: true }) : null;
  if (parts) row.children[1].append(parts);
  return row;
}

// The raw table: each card's observation date and the numbers its row does not print, the 심리 verdict's components,
// and the bottom-watch tally (the conditions the 시장 상태 contrarian check counts) as conditions with their values.
function rawGroups(doc, model, axis, bottomWatch) {
  const groups = [];
  // A group whose rows are all empty (an indicator with no observation yet) is not drawn: it was a titled empty box.
  const group = (title, rows, key) => {
    if (!rows.some(([, value]) => value != null && value !== '')) return null;
    const box = el(doc, 'section', null, 'ind-raw-group');
    box.dataset.rawMetric = key;
    box.append(el(doc, 'h3', title, 'ind-raw-group__title'), rawTable(doc, rows, title));
    return box;
  };
  if (axis) groups.push(group(`심리 · ${axis.stateLabel}`, [...axis.evidence, ['판정이 바뀌는 조건', axis.flip]], 'sentiment-axis'));
  for (const card of model.cards) {
    const rows = [['관측일', card.basis], ['상태', card.state?.label || ''], ['변화', card.change]];
    if (card.id === 'aaii' && card.parts) rows.push(...card.parts.map((part) => [`${part.label} 응답`, part.text]), ['설문 주', card.surveyDate || '']);
    if (card.id === 'composite') rows.push(...(card.components || []));
    groups.push(group(card.title, rows, card.id));
  }
  if (bottomWatch?.exhaustion?.length) {
    const rows = [
      ['매도 소진 조건', `${bottomWatch.exhaustionMet}/${bottomWatch.exhaustion.length}`], ...bottomWatch.exhaustion.map((item) => [`${item.ok ? '충족' : '미충족'} · ${item.label}`, item.value]),
      ['회복 확인 조건', `${bottomWatch.confirmationMet}/${bottomWatch.confirmation.length}`], ...bottomWatch.confirmation.map((item) => [`${item.ok ? '충족' : '미충족'} · ${item.label}`, item.value])
    ];
    groups.push(group(`${BOTTOM_WATCH_WORDS.label} (시장 상태와 같은 집계)`, rows, 'bottom-watch'));
  }
  if (model.mixed.length) groups.push(group('기준일과 다른 관측', [['지표', model.mixed.join(', ')]], 'mixed'));
  return groups.filter(Boolean);
}

// The method: what each indicator measures and its rule, the link to its principle in the research library, the two
// reference indicators' place against the six 시장 상태 indicators, and the price temperature's rules.
// The VIX-band record at the verdict's completed VIX close (the same close 시장 상태's risk line reads).
function fearRecord(root, inputs, regime) {
  const vix = regime?.asOf ? buildCloseSeries(inputs?.history, 'vix', { through: regime.asOf }).at(-1) : null;
  return vix?.date === regime.asOf ? vixBandRecord(root?.[STRESS_OUTCOMES.key] || null, vix.value) : null;
}

function methodBody(doc, root, model, record = null) {
  const nodes = [el(doc, 'p', `공포·탐욕 지수와 AAII는 시장 상태 6개 지표의 양호·중립·부담 합계에 넣지 않는 참고 지표입니다. 하이일드 스프레드는 시장 상태 '${AXIS_LABELS.credit}', VIX ÷ 3개월 VIX는 '${AXIS_LABELS.volatility}' 지표의 근거로 쓰입니다. 숫자는 모두 직전 미국장 종가 기준입니다.`, 'ind-method__lead')];
  const lede = vixBandLedeMethod(record);
  if (lede) nodes.push(el(doc, 'p', lede, 'ind-method__lead'));
  for (const card of model.cards) {
    const box = el(doc, 'section', null, 'ind-method');
    box.dataset.methodMetric = card.id;
    box.append(el(doc, 'h3', card.title, 'ind-method__title'));
    if (card.note) box.append(el(doc, 'p', card.note, 'ind-method__text'));
    if (card.rules) box.append(el(doc, 'p', `판정 기준: ${card.rules}`, 'ind-method__text'));
    const link = principleLink(doc, root, card.id, shortTitle(card));
    if (link) box.append(link);
    nodes.push(box);
  }
  nodes.push(...temperatureMethodNodes(doc, root));
  return nodes;
}

function chartCard(doc, card, range) {
  const box = el(doc, 'section', null, 'trend-card');
  box.dataset.metric = card.id;
  box.append(el(doc, 'h3', card.title, 'trend-card-title'), createTrendChart(doc, { series: card.series, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }));
  return box;
}

function paintCounter(doc, counter) {
  const node = doc.getElementById('sentiment-counter');
  if (!node) return;
  if (!counter) { node.replaceChildren(); node.hidden = true; return; }
  node.replaceChildren(el(doc, 'span', counter.kind === 'opposite' ? '반대 근거' : '같은 쪽이 아닌 지표', 'mk-hero__counter-label'), el(doc, 'span', counter.items.join(' · '), 'mk-hero__counter-text'));
  node.hidden = false;
}

export function renderSentimentBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-sentiment');
  if (!page) return null;
  const { inputs, regime } = marketInterpretation(root); // the shared regime, same as 시장 상태
  const model = buildSentimentModel(inputs);
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('sentiment-basis', model.asOf ? `${shortDate(model.asOf)} 미국 종가 기준` : historyWaitText(root));
  // The verdict is the shared 심리 reference row of 시장 상태 (regime.watchAxes), with its 판정 사유 row.
  const axis = (regime?.watchAxes || []).find((row) => row.id === 'sentiment' && row.observed !== false) || null;
  const state = doc.getElementById('sentiment-state');
  if (state) {
    state.textContent = axis?.stateLabel || '판정 대기';
    state.className = `regime-state is-${axis?.state || 'unknown'} sx-chip sx-chip--sm sx-chip--${CHIP_TONE[axis?.state] || 'neutral'}`;
  }
  // The hero line says what days at today's fear level were followed by (the VIX-band record,
  // vix-band-record.js vixBandLedeSaid); the axis's 판정 사유 row, the label-only line it replaces, stays in the raw table.
  if (!root?.[STRESS_OUTCOMES.key]) refreshSharedArtifact(root, STRESS_OUTCOMES).then(({ changed } = {}) => { if (changed) renderSentimentBoard({ documentRef: doc, root }); }).catch(() => {});
  set('sentiment-read', vixBandLedeSaid(fearRecord(root, inputs, regime)).text);
  set('sentiment-synthesis', model.tally.length ? model.tally.join(' · ') : '기준일에 맞는 심리 지표 관측 없음');
  paintCounter(doc, sentimentCounter({ model, regime }));
  renderFearGreedGauge(doc, model.cards.find((card) => card.id === 'fg'));
  renderScreenReading({ documentRef: doc, root, screen: 'sentiment', shownBasis: model.asOf || null });
  renderNextSteps(doc, doc.getElementById('sentiment-next'));
  const board = doc.getElementById('sentiment-card-grid');
  if (board) board.replaceChildren(...model.cards.map((card) => cardRow(doc, card)));
  let raw = doc.getElementById('sentiment-raw');
  if (!raw && board) { raw = kindFold(doc, 'raw-table', '지표별 관측값 전체'); raw.id = 'sentiment-raw'; board.insertAdjacentElement('afterend', raw); }
  if (raw) { setFoldBody(raw, rawGroups(doc, model, axis, regime?.bottomWatch || null)); raw.hidden = !model.asOf; }
  const charts = doc.getElementById('sentiment-chart-grid');
  if (charts) {
    const charted = model.cards.filter((card) => card.series?.length);
    const range = sharedRange(charted.map((card) => card.series));
    charts.replaceChildren(...charted.map((card) => chartCard(doc, card, range)));
    charts.closest('section')?.toggleAttribute('hidden', !charted.length);
  }
  let method = doc.getElementById('sentiment-method');
  if (!method) {
    method = kindFold(doc, 'method', '지표별 정의와 판정 기준', () => { const now = marketInterpretation(root); return methodBody(doc, root, buildSentimentModel(now.inputs), fearRecord(root, now.inputs, now.regime)); });
    method.id = 'sentiment-method';
    const next = doc.getElementById('sentiment-next');
    if (next) next.insertAdjacentElement('beforebegin', method); else page.append(method);
  }
  page.dataset.aioSentimentBoardRenderer = 'native';
  return model;
}

// Where today's F&G sits on CNN's five published bands (the same edges as fearGreedBand). A level, not a verdict — every
// band is the neutral ink tone and only the band holding today's value is darker.
function renderFearGreedGauge(doc, card) {
  const gauge = doc.getElementById('sentiment-gauge');
  if (!gauge) return;
  const value = card?.series?.at(-1)?.value;
  if (!Number.isFinite(value) || card.value === '—') { gauge.hidden = true; gauge.replaceChildren(); return; }
  const { extremeFearBelow, fearBelow, greedAbove, extremeGreedAbove } = RULES.fearGreed;
  const edges = [0, extremeFearBelow, fearBelow, greedAbove + 1, extremeGreedAbove + 1, 100];
  const labels = ['극단 공포', '공포', '중립', '탐욕', '극단 탐욕'];
  const shown = Math.round(value);
  // The highlighted band is the one fearGreedBand gives the same raw value, so the bar and the row's chip always agree.
  const bandLabel = publishedFearGreedBand(value).label;
  const bar = gaugeBar(doc, { label: '공포·탐욕 지수', min: 0, max: 100, value: Math.max(0, Math.min(100, value)), digits: 0, unit: '', caption: false,
    bands: labels.map((name, index) => ({ from: edges[index], to: edges[index + 1], tone: 'neutral', name, active: name === bandLabel })) });
  bar.querySelector('svg')?.setAttribute('aria-label', `공포·탐욕 지수 ${shown} — ${bandLabel} 구간 (${card.basis})`);
  gauge.removeAttribute('role');
  gauge.replaceChildren(bar);
  gauge.hidden = false;
}

// One date range for charts compared side by side: the earliest start to the latest end.
export function sharedRange(seriesList) {
  const dates = seriesList.flatMap((series) => series.length ? [series[0].date, series[series.length - 1].date] : []).sort();
  return dates.length ? [dates[0], dates[dates.length - 1]] : null;
}
