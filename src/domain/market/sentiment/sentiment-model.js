// The 투자 심리 screen's facts: four indicator cards (공포·탐욕 지수, VIX ÷ 3개월 VIX, AAII 개인 설문, 공포·탐욕 구성 요소
// 순위), each with its value, state word, observation basis, distance to its next published edge and recent change; the tally
// of their state words; and the facts that sit on the other side of the shared 심리 verdict. Pure: the screen
// (src/ui/components/sentiment-board.js) and the AI reading's fact packet (scripts/lib/screen-reading.mjs) read the same
// model. No sentence is assembled here; what the facts mean is the screen's AI reading.
//
// Each card keeps its observation basis against the S&P 500 close: an input that is stale or ahead of the basis is shown
// but excluded from its state, and a missing input never reads as calm or stress.
import { alignInput, alignMarketInputs, alignmentLabel, buildCloseSeries, isUsable } from '../../briefing/market-read.js';
import { RULES } from '../../rules/thresholds.js';
import { fearGreedBand as publishedFearGreedBand } from './metrics.js';
import { computeCompositeFearGreed, shortRankSample } from './composite-fear-greed.js';
import { signedText, readNumber as finite } from '../../shared/number.js';
import { shortDate } from '../../content/date-labels.js';

// AAII published long-run averages (since 1987; https://www.aaii.com/sentimentsurvey): bullish 37.5%, neutral 31.5%, bearish 31.0%.
export const AAII_AVERAGE = Object.freeze({ bull: 37.5, bear: 31.0 });
const EXCLUDED = Object.freeze({ label: '판정 제외', tone: 'unknown' });
// A sentiment level (F&G, AAII) is a level in the neutral tone: greed is not "good" and fear is not "bad".
const LEVEL_TONE = 'neutral';
const signedPp = (value) => `${signedText(value, 1)}%p`;

/** The F&G band on CNN's integer edges (metrics.js), in the neutral level tone. */
export function fearGreedBand(value) {
  if (value == null) return null;
  const band = publishedFearGreedBand(value);
  return band.blocked ? null : { label: band.label, tone: LEVEL_TONE };
}

// CNN's five bands as [from, to) on the shown whole number (the same edges as the screen's position bar).
export function fearGreedEdges() {
  const { extremeFearBelow, fearBelow, greedAbove, extremeGreedAbove } = RULES.fearGreed;
  return [0, extremeFearBelow, fearBelow, greedAbove + 1, extremeGreedAbove + 1, 101];
}
const FG_LABELS = Object.freeze(['극단 공포', '공포', '중립', '탐욕', '극단 탐욕']);

/** The nearer neighbouring band of the shown F&G whole number and how far it is ("극단 공포까지 -1"). */
export function fearGreedDistance(value) {
  if (!Number.isFinite(value)) return '';
  const shown = Math.round(value);
  const edges = fearGreedEdges();
  const at = edges.findIndex((edge, index) => shown >= edge && shown < edges[index + 1]);
  if (at < 0) return '';
  const down = at > 0 ? { label: FG_LABELS[at - 1], gap: edges[at] - 1 - shown } : null;
  const up = at < FG_LABELS.length - 1 ? { label: FG_LABELS[at + 1], gap: edges[at + 1] - shown } : null;
  const near = [down, up].filter(Boolean).sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0];
  return near ? `${near.label}까지 ${signedText(near.gap, 0)}` : '';
}

/**
 * The VIX ÷ 3-month VIX distance, told on its printed two-decimal value: under the calm edge it is the distance to 평탄,
 * between the edges the distance to the inversion edge, at the edge "역전 기준 1.00", over it the margin above.
 */
export function termRatioDistance(ratio) {
  if (!Number.isFinite(ratio)) return '';
  const { invertedRatioAt: edge, calmRatioBelow: calm } = RULES.volatility;
  const at = Number(ratio.toFixed(2));
  const edgeText = edge.toFixed(2);
  if (at < calm) return `평탄 기준 ${calm.toFixed(2)}까지 +${(calm - at).toFixed(2)}`;
  if (at < edge) return `역전 기준 ${edgeText}까지 +${(edge - at).toFixed(2)}`;
  if (at === edge) return `역전 기준 ${edgeText}`;
  return `역전 기준 ${edgeText} 대비 +${(at - edge).toFixed(2)}`;
}

// The change between the n-th last and the last point (the same rule as the chart cards' change line, trend-chart.js).
function pointChange(series, n, unit, digits) {
  const points = series.filter((point) => Number.isFinite(point?.value));
  if (points.length <= n) return null;
  return signedText(points[points.length - 1].value - points[points.length - 1 - n].value, digits, unit);
}

// The self-computed components beside CNN's index: no 0-100 average and no 공포~탐욕 band — each component's one-year
// percentile side by side, a component without an observation reads '자료 부족'.
const SPREAD_WIDE_AT = 50; // half the percentile scale: the components point in clearly different directions
export function componentText(row) {
  if (row.status === 'ok') return `${row.label} ${Math.round(row.score)}`;
  if (row.status === 'stale') return `${row.label} 오래됨${row.asOf ? `(${shortDate(row.asOf)} 관측)` : ''}`;
  // What is short is the record the 1-year percentile needs, not today's value.
  return Number.isFinite(row.observations) && row.needed ? `${row.label} 기록 부족(${row.needed}일 중 ${row.observations}일)` : `${row.label} 자료 부족`;
}
function compositeCard(composite) {
  const spread = composite.spread;
  const shown = composite.status !== 'withheld' && spread;
  const shortSample = shortRankSample(composite.components);
  const ready = `요소 ${composite.componentsReady}/${composite.componentsTotal} 반영`;
  return {
    id: 'composite', title: '공포·탐욕 구성 요소 순위 (참고)',
    value: shown ? `최저 ${spread.low.label} ${Math.round(spread.low.score)}, 최고 ${spread.high.label} ${Math.round(spread.high.score)}` : '—',
    basis: composite.asOf ? `${shortDate(composite.asOf)}, ${ready}` : ready,
    basisStatus: shown ? 'aligned' : 'missing',
    state: shown && spread.gap >= SPREAD_WIDE_AT ? { label: '요소 간 차이 큼', tone: LEVEL_TONE } : null,
    change: composite.components.map(componentText).join(', '),
    components: composite.components.map((row) => [row.label, componentText(row).slice(row.label.length + 1)]),
    // Every component is named, including the ones without data, so a partial set is not read as CNN's seven.
    note: `${composite.componentsReady ?? 7}개 요소의 ${shortSample != null ? `최근 ${shortSample}거래일(짧은 요소 기준)` : '1년'} 백분위를 나란히 놓은 참고값으로, 공포·탐욕 지수 값과 다릅니다`,
    rules: `요소마다 최근 1년(기록이 더 짧으면 있는 기간) 백분위로 바꾸며 높을수록 낙관 쪽입니다(높을수록 불안한 변동성·정크본드 같은 요소는 뒤집어 계산). 한 점수로 평균하거나 공포·탐욕 구간을 붙이지 않고, 계산되는 요소가 4개 미만이면 표시하지 않습니다. 최저·최고 요소의 차이가 ${SPREAD_WIDE_AT} 이상이면 '요소 간 차이 큼'입니다.`
  };
}

/**
 * @param {object} input  the shared market input (src/domain/market/interpretation/inputs.js regimeMarketInput):
 *   history, credit (fg, aaiiAsOf), rates, macroHistory, now and aaii ({ bullish, bearish, observedAt } or null)
 * @returns {{ asOf, mixed, cards, tally }}
 */
export function buildSentimentModel({ history = [], credit = {}, rates = {}, macroHistory = null, aaii = null, now = undefined } = {}) {
  const { basis, c, alignments, fgSeries: fgAll } = alignMarketInputs({ history, credit, rates, macroHistory, ...(now === undefined ? {} : { now }) });
  const fgSeries = fgAll.slice(-126);
  const vix = buildCloseSeries(history, 'vix', { through: basis });
  const vix3m = new Map(buildCloseSeries(history, 'vix3m', { through: basis }).map((point) => [point.date, point.value]));
  const ratioSeries = vix.filter((point) => vix3m.get(point.date)).map((point) => ({ date: point.date, value: point.value / vix3m.get(point.date) })).slice(-126);
  const ratioLast = ratioSeries[ratioSeries.length - 1] || null;
  const ratioAlign = alignInput(ratioLast?.date, basis);
  // VIX is a 30-day annualised implied volatility, so VIX ÷ √252 is the S&P 500's implied one-standard-deviation daily
  // move — a yardstick for the day's change, not a forecast.
  const vixAtRatio = ratioLast ? vix.find((point) => point.date === ratioLast.date)?.value ?? null : null;
  const impliedDaily = vixAtRatio == null ? '' : `VIX ${vixAtRatio.toFixed(2)} → S&P 500 하루 약 ±${(vixAtRatio / Math.sqrt(252)).toFixed(1)}% (1표준편차·정규 가정)`;
  const aaiiAsOf = credit.aaiiAsOf || aaii?.observedAt || null;
  const aaiiAlign = alignInput(aaiiAsOf, basis, 7); // weekly survey
  // Display values (shown even when excluded) and judged values (usable only).
  const shown = {
    fg: fgSeries.length ? fgSeries[fgSeries.length - 1].value : finite(credit.fg),
    ratio: ratioLast?.value ?? null,
    bear: finite(aaii?.bearish), bull: finite(aaii?.bullish)
  };
  const fg = c.fg;
  const ratio = isUsable(ratioAlign) ? shown.ratio : null;
  const bear = isUsable(aaiiAlign) ? shown.bear : null;
  const bull = bear == null ? null : shown.bull;
  const judged = (value, state) => value == null ? (state === undefined ? null : EXCLUDED) : state;
  const fgBand = fearGreedBand(fg);
  // The change is taken between the shown whole numbers (43 → 47 reads +4), the same rule as the home card, and says
  // what it is measured against ('전일 0' read as a previous value of 0).
  const fgChange = [[1, '전일'], [5, '5일 전'], [20, '20일 전']].map(([n, label]) => { const v = pointChange(fgSeries.map((point) => ({ ...point, value: Math.round(point.value) })), n, '', 0); return v ? `${label} 대비 ${/^[+-]?0$/.test(v) ? '변화 없음' : v}` : null; }).filter(Boolean).join(', ');
  const { calmRatioBelow, invertedRatioAt } = RULES.volatility;
  const { extremeFearBelow, fearBelow, greedAbove, extremeGreedAbove } = RULES.fearGreed;
  const ratio5 = pointChange(ratioSeries, 5, '', 2);
  const cards = [
    { id: 'fg', title: '공포·탐욕 지수 (F&G)', value: shown.fg == null ? '—' : String(Math.round(shown.fg)), basis: alignmentLabel(alignments.fg), basisStatus: alignments.fg.status,
      state: shown.fg == null ? null : judged(fg, fgBand), series: fgSeries, refLines: [25, 50, 75], domain: [0, 100], format: (value) => value.toFixed(0),
      distance: shown.fg == null ? '' : fearGreedDistance(shown.fg),
      change: fgChange ? `${fgChange} (확정 종가 기준)` : '',
      flip: `${extremeFearBelow} 미만 극단 공포, ${fearBelow} 미만 공포, ${greedAbove} 초과 탐욕, ${extremeGreedAbove} 초과 극단 탐욕`,
      note: 'VIX·정크본드 수요·시장 폭·모멘텀 등 7개 지표를 합친 지수 — 다른 지표와 겹치므로 단독 판단에 쓰지 않음' },
    { id: 'term', title: '단기 불안 비율 (VIX ÷ 3개월 VIX)', value: shown.ratio == null ? '—' : shown.ratio.toFixed(2), basis: alignmentLabel(ratioAlign), basisStatus: ratioAlign.status,
      state: shown.ratio == null ? null : judged(ratio, ratio >= invertedRatioAt ? { label: '역전, 단기 불안', tone: 'burden' } : ratio >= calmRatioBelow ? { label: '평탄', tone: 'neutral' } : { label: '정상', tone: 'favorable' }),
      series: ratioSeries, refLines: [invertedRatioAt], format: (value) => value.toFixed(2),
      distance: shown.ratio == null ? '' : termRatioDistance(shown.ratio),
      change: [ratio5 ? `5일 ${ratio5}` : '', impliedDaily].filter(Boolean).join(', '),
      flip: `${calmRatioBelow.toFixed(2)} 미만 정상, ${calmRatioBelow.toFixed(2)}~${invertedRatioAt.toFixed(2)} 평탄, ${invertedRatioAt.toFixed(2)} 이상 역전`,
      note: '1 미만이면 단기 공포가 중기보다 작은 정상 상태, 1을 넘으면 당장의 충격을 크게 반영하는 역전' },
    // The high-yield spread is read on the 시장 상태 credit axis (one copy of the number and its verdict); the put/call card
    // left because Cboe's terms allow neither automated collection nor republication.
    { id: 'aaii', title: 'AAII 개인 설문', value: shown.bear == null ? '—' : `약세 ${shown.bear.toFixed(1)}%`, basis: aaiiAsOf ? `주간 설문, ${alignmentLabel(aaiiAlign)}` : '미수신', basisStatus: isUsable(aaiiAlign) ? 'aligned' : aaiiAlign.status,
      // No sourced 45% '비관' cut-off exists, so the state is the distance from AAII's published long-run average.
      state: shown.bear == null ? null : judged(bear, { label: `약세 장기 평균 대비 ${signedPp(bear - AAII_AVERAGE.bear)}`, tone: LEVEL_TONE }),
      distance: '',
      change: shown.bull == null ? '' : `강세 ${shown.bull.toFixed(1)}%${bull != null ? ` (평균 대비 ${signedPp(bull - AAII_AVERAGE.bull)})` : ''}, 장기 평균 강세 ${AAII_AVERAGE.bull.toFixed(1)}% / 약세 ${AAII_AVERAGE.bear.toFixed(1)}%`,
      bearGap: bear == null ? null : bear - AAII_AVERAGE.bear,
      surveyDate: aaiiAsOf ? String(aaiiAsOf).slice(0, 10) : null,
      // The three answers as one bar; 중립 is the rest of the 100%.
      parts: shown.bear == null || shown.bull == null ? null : [['강세', shown.bull], ['중립', Math.max(0, 100 - shown.bull - shown.bear)], ['약세', shown.bear]].map(([label, value]) => ({ label, value, text: `${value.toFixed(1)}%` })),
      note: '주간 발표 — 개인 투자자의 6개월 전망 설문 — 공포·탐욕 구간을 정하지 않고 장기 평균과의 차이로만 읽음' },
    // Ranked through the board's shared close basis, like every other card.
    compositeCard(computeCompositeFearGreed({
      history: basis ? history.filter((row) => row?.date && row.date <= basis) : history,
      macroHistory: basis && macroHistory?.series ? { ...macroHistory, series: Object.fromEntries(Object.entries(macroHistory.series).map(([key, value]) => [key, { ...value, observations: (value?.observations || []).filter((row) => String(Array.isArray(row) ? row[0] : row?.date) <= basis) }])) } : macroHistory
    }))
  ];
  const mixed = cards.filter((card) => card.value !== '—' && card.basisStatus !== 'aligned').map((card) => card.title);
  // The tally: each measured card's short title, value and state word — no reading is built from them.
  const tally = cards.filter((card) => card.value !== '—' && card.id !== 'composite').map((card) => {
    if (card.id === 'aaii') return `AAII ${card.value}${card.state === EXCLUDED ? ` ${EXCLUDED.label}` : card.bearGap != null ? `(장기 평균 대비 ${signedPp(card.bearGap)})` : ''}`;
    return `${card.title.replace(/ \(.*\)$/, '')} ${card.value}${card.state ? ` ${card.state.label}` : ''}`;
  });
  return { asOf: basis, mixed, cards, tally };
}

/**
 * The facts on the other side of the shared 심리 verdict (regime.watchAxes 'sentiment'): with fear (부담) the measures that
 * do not show stress — VIX ÷ 3개월 VIX 정상, the 시장 상태 credit axis 양호, AAII bears under their average; with greed
 * (과열 쪽 쏠림) the ones that do. None on the other side → the measures that sit between (평탄, credit 중립), as a second
 * kind. Facts only: a title, its state word and its value.
 */
export function sentimentCounter({ model = null, regime = null } = {}) {
  const axis = (regime?.watchAxes || []).find((row) => row.id === 'sentiment');
  if (!axis || axis.state === 'unknown') return null;
  const reason = (axis.evidence || []).find(([label]) => label === '판정 사유')?.[1] || '';
  const lean = axis.state === 'burden' ? 'fear' : /^과열 쪽 쏠림/.test(reason) ? 'greed' : null;
  if (!lean) return null;
  const card = (id) => (model?.cards || []).find((row) => row.id === id) || null;
  const credit = (regime?.axes || []).find((row) => row.id === 'credit');
  const hy = (credit?.evidence || []).find(([label]) => label === '하이일드 스프레드')?.[1];
  const items = [];
  const term = card('term');
  if (term?.state && term.state !== EXCLUDED) items.push({ side: term.state.tone === 'neutral' ? 'between' : (term.state.tone === 'favorable') === (lean === 'fear') ? 'opposite' : 'same', text: `${term.title.replace(/ \(.*\)$/, '')} ${term.value} ${term.state.label}` });
  if (credit && credit.state !== 'unknown') items.push({ side: credit.state === 'neutral' ? 'between' : (credit.state === 'favorable') === (lean === 'fear') ? 'opposite' : 'same', text: `${credit.title} ${credit.stateLabel}${hy ? `, 하이일드 스프레드 ${String(hy).replace(/\s*\(.*$/, '')}` : ''}` });
  const aaiiCard = card('aaii');
  if (aaiiCard?.bearGap != null && Math.abs(aaiiCard.bearGap) >= 0.05) items.push({ side: (aaiiCard.bearGap < 0) === (lean === 'fear') ? 'opposite' : 'same', text: `AAII ${aaiiCard.value}, 장기 평균 대비 ${signedPp(aaiiCard.bearGap)}` });
  const opposite = items.filter((item) => item.side === 'opposite');
  if (opposite.length) return { kind: 'opposite', lean, items: opposite.map((item) => item.text) };
  const between = items.filter((item) => item.side === 'between');
  return between.length ? { kind: 'between', lean, items: between.map((item) => item.text) } : null;
}
