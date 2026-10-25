// P1396 (owner review 2026-10-02): 투자 심리 = five equal indicator cards (state, change, trend where
// a history exists) and one synthesis that separates price-driven fear from credit/volatility
// stress. Replaces the gauge layout, the 'SOURCE 확인 대기'/'판정 보류' badges, the sourceless SKEW
// card and the composite paragraph that still quoted the retired 0-100 score.
// P1399 (Codex review 2026-10-03): each card carries one basis chip (its own observation date
// against the S&P 500 close basis); an input that is stale or ahead of the basis is shown but
// excluded from the state and the synthesis, and a missing input never reads as calm or stress.
import { deepDiveFold } from './deep-dive.js';
import { SENTIMENT_DEEP_DIVES } from '../../domain/content/axis-deep-dives.js';
import { alignInput, alignMarketInputs, alignmentLabel, buildCloseSeries, creditState, isUsable } from '../../domain/briefing/market-read.js';
import { createTrendChart, seriesChange } from './trend-chart.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { fearGreedBand as publishedFearGreedBand } from '../../domain/sentiment/metrics.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { sentimentFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { computeCompositeFearGreed } from '../../domain/sentiment/composite-fear-greed.js';
import { el } from './dom.js';
import { noteFold } from './section-frame.js';
import { splitReading } from './market-regime.js';
import { signedText } from '../../domain/shared/number.js';
import { shortDate } from '../../domain/content/date-labels.js';

// AAII published long-run averages (since 1987; https://www.aaii.com/sentimentsurvey): bullish 37.5%, neutral 31.5%, bearish 31.0%.
const AAII_AVERAGE = Object.freeze({ bull: 37.5, bear: 31.0 });
const EXCLUDED = Object.freeze({ label: '판정 제외', tone: 'unknown' });

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

// P1534: the band comes from the one domain function (CNN integer edges).
// v57.50 D19 (coordinator decision): a sentiment level (F&G, put/call, AAII) is shown as a level in the neutral tone —
// greed or call-heavy trading is not "good" (green) and fear is not "bad" (red). Only the credit card keeps its tone.
const LEVEL_TONE = 'neutral';
export function fearGreedBand(value) {
  if (value == null) return null;
  const band = publishedFearGreedBand(value);
  return band.blocked ? null : { label: band.label, tone: LEVEL_TONE };
}
const signedPp = (value) => `${signedText(value, 1)}%p`;
// v57.50 C02: the HY card label comes from the one creditState() judgement (market-read), not a second set of edges.
// v57.54 audit (4): the card shows the axis's own word (양호/중립/부담) — '경계' here beside '중립' on 오늘·시장 상태 read as
// two verdicts for one creditState().
const CREDIT_LABEL = Object.freeze({ favorable: { label: '양호', tone: 'favorable' }, neutral: { label: '중립', tone: 'neutral' }, burden: { label: '부담', tone: 'burden' } });

export function buildSentimentModel({ history = [], credit = {}, rates = {}, snapshot = {}, macroHistory = null } = {}) {
  const { basis, c, alignments, fgSeries: fgAll } = alignMarketInputs({ history, credit, rates, macroHistory }); // T05: macroHistory gives the 20-session HY change
  const fgSeries = fgAll.slice(-126);
  // Audit 2026-10-14: the HY card gets the same six-month trend as the other charted cards (official OAS, percent -> bp).
  const hySeries = (macroHistory?.series?.hyOas?.observations || []).map((row) => ({ date: String(Array.isArray(row) ? row[0] : row?.date || '').slice(0, 10), value: finite(Array.isArray(row) ? row[1] : row?.value) }))
    .filter((point) => point.value != null && /^\d{4}-\d{2}-\d{2}$/.test(point.date) && (!basis || point.date <= basis)).map((point) => ({ date: point.date, value: point.value * 100 })).slice(-126);
  const vix = buildCloseSeries(history, 'vix', { through: basis });
  const vix3m = new Map(buildCloseSeries(history, 'vix3m', { through: basis }).map((point) => [point.date, point.value]));
  const ratioSeries = vix.filter((point) => vix3m.get(point.date)).map((point) => ({ date: point.date, value: point.value / vix3m.get(point.date) })).slice(-126);
  const ratioLast = ratioSeries[ratioSeries.length - 1] || null;
  const ratioAlign = alignInput(ratioLast?.date, basis);
  // 2026-10-18 bookmarks (volatility-base-rates): VIX is a 30-day annualised implied volatility, so VIX ÷ √252 is the
  // S&P 500's implied one-standard-deviation daily move — a yardstick for the day's change, not a forecast.
  const vixAtRatio = ratioLast ? vix.find((point) => point.date === ratioLast.date)?.value ?? null : null;
  const impliedDaily = vixAtRatio == null ? '' : `VIX ${vixAtRatio.toFixed(1)} → S&P 500 하루 약 ±${(vixAtRatio / Math.sqrt(252)).toFixed(1)}% (1표준편차·정규 가정)`;
  const aaiiAlign = alignInput(credit.aaiiAsOf, basis, 7); // weekly survey
  // Display values (shown even when excluded) and judged values (usable only).
  const shown = {
    fg: fgSeries.length ? fgSeries[fgSeries.length - 1].value : finite(credit.fg),
    ratio: ratioLast?.value ?? null,
    hyBp: finite(credit.hyBp), hy5: finite(credit.hyDelta5Bp), pcr: finite(credit.pcr),
    bear: finite(snapshot.aaiiBear), bull: finite(snapshot.aaiiBull)
  };
  const fg = c.fg;
  const ratio = isUsable(ratioAlign) ? shown.ratio : null;
  const { hyBp, hy5, hy20, pcr, hy20Stress } = c;
  const credit_ = creditState({ hyBp, hy5, hy20, pcr, hy20Stress }); // v57.81: the same 20-session record test as the axis
  const bear = isUsable(aaiiAlign) ? shown.bear : null;
  const bull = bear == null ? null : shown.bull;
  const judged = (value, state) => value == null ? (state === undefined ? null : EXCLUDED) : state;
  const fgBand = fearGreedBand(fg);
  const fgChange = [[1, '전일'], [5, '5일'], [20, '20일']].map(([n, label]) => { const v = seriesChange(fgSeries.map((point) => ({ ...point, value: Math.round(point.value) })), n, '', 0); return v ? `${label} ${v}` : null; }).filter(Boolean).join(', ');
  const cards = [
    { id: 'fg', title: '공포·탐욕 지수 (F&G)', value: shown.fg == null ? '—' : String(Math.round(shown.fg)), basis: alignmentLabel(alignments.fg), basisStatus: alignments.fg.status,
      state: shown.fg == null ? null : judged(fg, fgBand), series: fgSeries, refLines: [25, 50, 75], domain: [0, 100], format: (value) => value.toFixed(0),
      // P1508: the change is taken between the shown whole numbers (43 → 47 reads +4), the same rule as the home card;
      // rounding the raw difference gave +3 on one screen and +4 on the other for the same day.
      change: fgChange ? `${fgChange} (확정 종가 기준)` : '',
      note: 'VIX·풋콜·정크본드 수요·시장 폭·모멘텀 등 7개 지표를 합친 지수 — 다른 지표와 겹치므로 단독 판단에 쓰지 않음' },
    { id: 'term', title: '단기 불안 비율 (VIX ÷ 3개월 VIX)', value: shown.ratio == null ? '—' : shown.ratio.toFixed(2), basis: alignmentLabel(ratioAlign), basisStatus: ratioAlign.status,
      state: shown.ratio == null ? null : judged(ratio, ratio >= RULES.volatility.invertedRatioAt ? { label: '역전, 단기 불안', tone: 'burden' } : ratio >= RULES.volatility.calmRatioBelow ? { label: '평탄', tone: 'neutral' } : { label: '정상', tone: 'favorable' }),
      series: ratioSeries, refLines: [RULES.volatility.invertedRatioAt], format: (value) => value.toFixed(2), change: [seriesChange(ratioSeries, 5, '', 2) ? `5일 ${seriesChange(ratioSeries, 5, '', 2)}` : '', impliedDaily].filter(Boolean).join(', '),
      note: '1 미만이면 단기 공포가 중기보다 작은 정상 상태, 1을 넘으면 당장의 충격을 크게 반영하는 역전' },
    { id: 'hy', title: '하이일드 스프레드', series: hySeries, refLines: [RULES.credit.tightBelowBp, RULES.credit.stressAtBp], format: (value) => `${Math.round(value)}bp`, value: shown.hyBp == null ? '—' : `${Math.round(shown.hyBp)}bp`, basis: alignmentLabel(alignments.hy), basisStatus: alignments.hy.status,
      // v57.50 C02: the same creditState() as the 시장 상태 credit axis and the briefing (one judgement, one set of edges).
      state: shown.hyBp == null ? null : judged(hyBp, CREDIT_LABEL[credit_] || EXCLUDED),
      change: [shown.hy5 == null ? null : `5일 ${shown.hy5 >= 0 ? '+' : ''}${Math.round(shown.hy5)}bp`, hy20 == null ? null : `20거래일 ${hy20 >= 0 ? '+' : ''}${Math.round(hy20)}bp`].filter(Boolean).join(', '),
      // v57.77: the card keeps one line; the edges move into the card's folded explanation (rules).
      note: '신용등급이 낮은 회사채가 국채보다 더 받는 금리 — 돈 빌리기가 어려워질수록 커지며, 시장 상태 신용 지표와 같은 판정',
      rules: `${RULES.credit.stressAtBp}bp 이상이거나 5일 사이 +${RULES.credit.widen5dBp}bp 이상 벌어지거나 20거래일 확대 폭이 자체 기록 상위 ${100 - RULES.credit.stress20dPct}%면 부담(20거래일 확대가 +${RULES.credit.widen20dBp}bp 아래로 줄 때까지 유지), ${RULES.credit.tightBelowBp}bp 미만이면서 5일 확대가 없고 20거래일 확대가 +${RULES.credit.widen20dBp}bp 미만이며 풋/콜이 ${RULES.credit.putCallHedgeAt} 미만일 때만 양호, 그 밖은 중립입니다. 시장 상태의 '신용과 위험선호' 지표와 같은 판정입니다.` },
    { id: 'pcr', title: '풋/콜 비율', value: shown.pcr == null ? '—' : shown.pcr.toFixed(2), basis: alignmentLabel(alignments.pcr), basisStatus: alignments.pcr.status,
      // T10: the card reads the same RULES edges as the credit axis (1.1 hedging, below 0.7 optimism). D19: level only, neutral tone.
      state: shown.pcr == null ? null : judged(pcr, pcr >= RULES.credit.putCallHedgeAt ? { label: '하락 대비 수요 높음', tone: LEVEL_TONE } : pcr < RULES.credit.putCallOptimismBelow ? { label: '콜 우위 (낙관 쪽)', tone: LEVEL_TONE } : { label: '중립', tone: LEVEL_TONE }),
      change: '', note: `미국 상장 옵션 전체에서 하락에 대비하는 풋옵션 거래가 콜옵션보다 얼마나 많은지 — 높을수록 방어적, ${RULES.credit.putCallHedgeAt} 이상 헤지 수요 높음, ${RULES.credit.putCallOptimismBelow} 미만 낙관` },
    { id: 'aaii', title: 'AAII 개인 설문', value: shown.bear == null ? '—' : `약세 ${shown.bear.toFixed(1)}%`, basis: credit.aaiiAsOf ? `${alignmentLabel(aaiiAlign)} 주간` : '미수신', basisStatus: isUsable(aaiiAlign) ? 'aligned' : aaiiAlign.status,
      // v57.50 D24/C04: no sourced 45% '비관' cut-off exists, so the state is the distance from AAII's published long-run average.
      state: shown.bear == null ? null : judged(bear, { label: `약세 장기 평균 대비 ${signedPp(bear - AAII_AVERAGE.bear)}`, tone: LEVEL_TONE }),
      change: shown.bull == null ? '' : `강세 ${shown.bull.toFixed(1)}%${bull != null ? ` (평균 대비 ${signedPp(bull - AAII_AVERAGE.bull)})` : ''}, 장기 평균 강세 ${AAII_AVERAGE.bull.toFixed(1)}% / 약세 ${AAII_AVERAGE.bear.toFixed(1)}%`,
      note: '주간 발표 — 개인 투자자의 6개월 전망 설문 — 공포·탐욕 구간을 정하지 않고 장기 평균과의 차이로만 읽음' },
    // Ranked through the board's shared close basis, like every other card.
    compositeCard(computeCompositeFearGreed({
      history: basis ? history.filter((row) => row?.date && row.date <= basis) : history,
      macroHistory: basis && macroHistory?.series ? { ...macroHistory, series: Object.fromEntries(Object.entries(macroHistory.series).map(([key, value]) => [key, { ...value, observations: (value?.observations || []).filter((row) => String(Array.isArray(row) ? row[0] : row?.date) <= basis) }])) } : macroHistory
    }))
  ];
  // Synthesis: is the fear in prices only, or also in credit and volatility structure? Each side
  // is claimed only when it was measured.
  const moodKnown = fg != null || bear != null;
  // Codex browser audit H11: each indicator keeps its own reading. v57.50 D24/C04: AAII has no sourced '공포' cut-off
  // (the old 45% was unsourced), so only the F&G band (CNN's published edges) names fear; AAII is read against its average.
  const fgFear = Boolean(fgBand && fgBand.label.includes('공포'));
  const fearful = fgFear;
  // P1428: greed needs a measured put/call; a missing one is '미확인', never 'low hedging'.
  const greedy = fg != null && fg > RULES.fearGreed.extremeGreedAbove;
  const hedgeLow = pcr != null && pcr < RULES.credit.putCallOptimismBelow;
  const creditKnown = hyBp != null;
  // v57.50 C02: calm/stress come from the one creditState() (market-read) — no second set of edges here.
  const creditCalm = credit_ === 'favorable';
  const creditStress = credit_ === 'burden';
  const volKnown = ratio != null;
  const volCalm = volKnown && ratio < RULES.volatility.calmRatioBelow; // v57.84: the card and the axis call 0.95–1 flat, not calm
  const fearSource = fgFear ? `F&G ${Math.round(fg)}(${fgBand.label})` : '';
  const aaiiLine = bear != null ? `AAII 약세 응답 ${bear.toFixed(1)}%는 장기 평균(${AAII_AVERAGE.bear.toFixed(1)}%)보다 ${signedPp(bear - AAII_AVERAGE.bear)}입니다.` : null;
  let synthesis;
  if (!moodKnown) synthesis = '기준일에 맞는 심리 지표(F&G·AAII)가 없어 종합 판단을 보류합니다.';
  else if (fearful && creditCalm && volCalm) synthesis = `${fearSource}는 비관 쪽인데 신용(${Math.round(hyBp)}bp)과 변동성 구조(${ratio.toFixed(2)})는 안정 — 비관이 심리 지표에 머물러 있고 신용·변동성 스트레스로는 번지지 않았습니다.`;
  else if (fearful && (creditStress || (volKnown && !volCalm))) // v58.74 (text audit): one sentence held three nested parentheses; the mood, the spread and the volatility curve each get one.
    synthesis = [`${fearSource}로 비관 쪽입니다.`,
      creditStress ? `하이일드 스프레드도 ${Math.round(hyBp)}bp로${hy20Stress && hy20 != null ? ` 20거래일 ${signedText(hy20, 0, 'bp')},` : ''}${hy5 != null ? ` 5일 ${signedText(hy5, 0, 'bp')}` : ''} ${hyBp < RULES.credit.tightBelowBp ? `넓어졌습니다(수준은 ${RULES.credit.tightBelowBp}bp 아래).` : '스트레스 구간입니다.'}` : null,
      volKnown && !volCalm ? (ratio >= RULES.volatility.invertedRatioAt ? `VIX가 3개월 VIX보다 높아 변동성 구조가 역전됐습니다(${ratio.toFixed(2)}).` : `VIX와 3개월 VIX의 차이가 역전 기준(${RULES.volatility.invertedRatioAt}) 가까이 좁혀졌습니다(${ratio.toFixed(2)}).`) : null,
      '비관이 심리 지표를 넘어 자금 시장으로 퍼지는 모습입니다.'].filter(Boolean).join(' ');
  else if (fearful && creditKnown && volKnown) synthesis = `${fearSource}는 비관 쪽이고 신용 스프레드(${Math.round(hyBp)}bp${hy20 != null ? `, 20거래일 ${hy20 >= 0 ? '+' : ''}${Math.round(hy20)}bp` : ''})는 중립(양호 조건 미충족)입니다 — 비관이 신용으로 번지는지 확인할 단계입니다.`;
  else if (fearful) synthesis =`${fearSource}는 비관 쪽이지만 ${[!creditKnown ? '신용 스프레드' : null, !volKnown ? '변동성 구조' : null].filter(Boolean).join('·')} 자료가 기준일에 없어 비관이 번졌는지 확인하지 못했습니다.`;
  else if (greedy) synthesis = hedgeLow ? `낙관이 강하고(F&G ${Math.round(fg)}) 헤지 수요가 낮음(풋/콜 ${pcr.toFixed(2)}) — 충격 대비가 약한 상태입니다.` : `낙관이 강합니다(F&G ${Math.round(fg)}). 풋/콜 비율이 ${pcr == null ? '없어 헤지 수요는 확인하지 못했습니다' : `${pcr.toFixed(2)}로 헤지 수요가 낮지는 않습니다`}.`;
  else if (fgBand) synthesis = `F&G는 ${Math.round(fg)}(${fgBand.label}) — 한쪽으로 치우치지 않은 상태입니다.`;
  else synthesis = 'F&G가 기준일에 없어 가격 쪽 심리는 판단하지 않고, 개인 설문만 아래에 적습니다.';
  // Audit 2026-10-14: the summary carries the direction of the mood (F&G over 20 sessions), and the AAII reading joins the
  // same paragraph instead of a separate footnote — one reading, level then direction then the survey.
  const fgThen = fgSeries.length > 20 ? fgSeries[fgSeries.length - 21].value : null;
  const fg20 = fg != null && fgThen != null ? Math.round(fg) - Math.round(fgThen) : null;
  const direction = fg20 == null ? '' : Math.abs(fg20) < 5 ? ` F&G는 20거래일 전과 비슷한 수준(${fg20 >= 0 ? '+' : ''}${fg20})입니다.`
    : ` F&G는 20거래일 전보다 ${Math.abs(fg20)} ${fg20 < 0 ? '낮아져 비관' : '높아져 낙관'} 쪽으로 움직였습니다.`;
  // v57.70 (2026-10-15 audit): "낙관 쪽으로 움직이는 중" on a day F&G fell 12 — a 5-point or larger last move against the
  // 20-session direction is said beside it.
  const fgPrev = fgSeries.length >= 2 ? fgSeries[fgSeries.length - 2].value : null;
  const fg1 = fg != null && fgPrev != null ? Math.round(fg) - Math.round(fgPrev) : null;
  // v57.81 (audit 2026-10-15): F&G 44 -> 30 on 10/14 (1일 -14, 5일 -12) read "20거래일 전과 비슷한 수준(+3)". A one- or
  // five-session move of RULES.sentiment.namedMovePt or more is always named.
  const fgBack5 = fgSeries.length >= 6 ? fgSeries[fgSeries.length - 6].value : null;
  const fg5 = fg != null && fgBack5 != null ? Math.round(fg) - Math.round(fgBack5) : null;
  const named = RULES.sentiment.namedMovePt;
  const bigMove = fg1 != null && Math.abs(fg1) >= named ? ['직전 기록', fg1] : fg5 != null && Math.abs(fg5) >= named ? ['5거래일 전', fg5] : null;
  const against = (move) => fg20 != null && Math.abs(fg20) >= 5 && Math.sign(move) !== Math.sign(fg20);
  const turn = bigMove ? ` ${against(bigMove[1]) ? '다만 ' : ''}${bigMove[0]}보다 ${Math.abs(bigMove[1])} ${bigMove[1] < 0 ? '낮아져' : '높아져'} ${against(bigMove[1]) ? '최근 움직임은 반대 방향입니다' : `최근 ${bigMove[1] < 0 ? '비관' : '낙관'} 쪽으로 크게 움직였습니다`}.`
    : fg1 != null && fg20 != null && Math.abs(fg1) >= 5 && against(fg1)
      ? ` 다만 직전 기록보다 ${Math.abs(fg1)} ${fg1 < 0 ? '낮아져' : '높아져'} 최근 움직임은 반대 방향입니다.` : '';
  if (moodKnown) synthesis = `${synthesis}${direction}${turn}${aaiiLine ? ` ${aaiiLine}` : ''}`;
  // v57.54 audit (10): the first mention spells the index out; later ones keep the short name.
  if (moodKnown) synthesis = synthesis.replace(/F&G/, '공포·탐욕 지수(F&G)');
  const mixed = cards.filter((card) => card.value !== '—' && card.basisStatus !== 'aligned').map((card) => card.title);
  return { asOf: basis, mixed, cards, synthesis };
}

// P1586: the self-computed components sit beside CNN's index as a reference. v57.50 D02 (coordinator decision): no
// 0-100 average and no 공포~탐욕 band — each component's one-year percentile is listed side by side, a component
// without an observation reads '자료 부족', and one line names the lowest and highest component.
const SPREAD_WIDE_AT = 50; // half the percentile scale: the components point in clearly different directions
function componentText(row) {
  if (row.status === 'ok') return `${row.label} ${Math.round(row.score)}`;
  if (row.status === 'stale') return `${row.label} 오래됨${row.asOf ? `(${shortDate(row.asOf)} 관측)` : ''}`;
  // v57.70 (2026-10-15 audit): "풋·콜 비율 자료 부족(기록 0/60일)" sat beside a put/call card showing 0.83 — what is short
  // is the record the 1-year percentile needs, not today's value.
  return Number.isFinite(row.observations) && row.needed ? `${row.label} 기록 부족(${row.needed}일 중 ${row.observations}일)` : `${row.label} 자료 부족`;
}
function compositeCard(composite) {
  const spread = composite.spread;
  const shown = composite.status !== 'withheld' && spread;
  const spreadLine = shown ? `요소 간 차이${spread.gap >= SPREAD_WIDE_AT ? ' 큼' : ''}: 최저 ${spread.low.label} ${Math.round(spread.low.score)}, 최고 ${spread.high.label} ${Math.round(spread.high.score)}` : '';
  return {
    id: 'composite', title: '공포·탐욕 구성 요소 순위 (참고)', value: shown ? `${Math.round(spread.low.score)}~${Math.round(spread.high.score)}` : '—',
    basis: composite.asOf ? `${shortDate(composite.asOf)} 기준, ${composite.componentsTotal}개 중 ${composite.componentsReady}개 반영` : `${composite.componentsTotal}개 중 ${composite.componentsReady}개 반영`,
    basisStatus: shown ? 'aligned' : 'missing',
    state: shown && spread.gap >= SPREAD_WIDE_AT ? { label: '요소 간 차이 큼', tone: LEVEL_TONE } : null,
    change: composite.components.map(componentText).join(', '),
    // P1593 (F97): every component is named, including the ones without data, so a partial set is not read as CNN's seven.
    // v57.77: one line on the card; how the percentiles are built and when the card is withheld sit in the fold (rules).
    note: `${spreadLine ? `${spreadLine}, ` : ''}${composite.componentsReady ?? 7}개 요소의 1년 백분위를 나란히 놓은 참고값으로, 공포·탐욕 지수 값과 다릅니다`,
    rules: '요소마다 최근 1년 백분위로 바꾸며 높을수록 낙관 쪽입니다(변동성·풋/콜·정크본드는 뒤집어 계산). 한 점수로 평균하거나 공포·탐욕 구간을 붙이지 않고, 계산되는 요소가 4개 미만이면 표시하지 않습니다.'
  };
}
export function renderSentimentBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-sentiment');
  if (!page) return null;
  const { inputs, regime } = marketInterpretation(root); // owner 2026-10-19: the shared regime, same as 시장 상태
  const model = buildSentimentModel({ ...inputs, snapshot: root.DATA_SNAPSHOT || {}, macroHistory: root._aioMacroHistory || null });
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('sentiment-basis', model.asOf ? `${shortDate(model.asOf)} 미국 종가 기준${model.mixed.length ? ', 날짜가 다른 지표는 카드에 표시' : ''}` : '기록을 불러오는 중입니다.');
  // v58.53 개편 v2 (5d): the hero keeps the synthesis's first sentences (the rest folds) beside the F&G position bar.
  // v58.74 (text audit 시장 상태 C4): fear read the contrarian way — the bottom-watch tally the 원칙 card quotes, so a low F&G is
  // not taken as a bottom signal on its own.
  const bw = regime?.bottomWatch;
  const tallyOf = (met, list) => `${met}/${list.length}`;
  const contrarian = !bw || !/공포/.test(model.synthesis) ? ''
    : bw.exhaustionMet >= 2 && bw.confirmationMet >= 2 ? ` 역발상으로 보면 매도 소진(${tallyOf(bw.exhaustionMet, bw.exhaustion)})과 회복 확인(${tallyOf(bw.confirmationMet, bw.confirmation)})이 함께 보여, 공포가 바닥 근처 신호로 쓰일 수 있는 구간입니다. 다음 종가로 확인합니다.`
      : bw.exhaustionMet >= 2 ? ` 역발상으로 보면 매도 소진 신호는 ${tallyOf(bw.exhaustionMet, bw.exhaustion)}로 쌓였지만 회복 확인은 ${tallyOf(bw.confirmationMet, bw.confirmation)}라, 공포 자체를 바닥 근거로 읽기는 이릅니다.`
        : ` 역발상으로 보면 매도 소진 신호도 ${tallyOf(bw.exhaustionMet, bw.exhaustion)}로 적어, 공포가 깊어도 투매가 끝났다고 보기는 이릅니다.`;
  const { lead: synthLead, rest: synthRest } = splitReading(`${model.synthesis}${contrarian}`);
  set('sentiment-synthesis', synthLead);
  const more = doc.getElementById('sentiment-synthesis-more');
  if (more) { more.hidden = !synthRest; const body = more.querySelector('p'); if (body) body.textContent = synthRest; }
  renderFearGreedGauge(doc, model.cards.find((card) => card.id === 'fg'));
  // P1431: tie the synthesis back to the 시장 상태 axes that use the same numbers.
  const flow = sentimentFlow({ model, regime });
  set('sentiment-bridge', flow.bridge);
  renderNextSteps(doc, doc.getElementById('sentiment-next'), flow.next);
  // Charted cards share one row and the value-only cards another, so card heights match.
  const grids = { chart: doc.getElementById('sentiment-card-grid'), mini: doc.getElementById('sentiment-mini-grid') };
  const charted = model.cards.filter((card) => card.series);
  const range = sharedRange(charted.map((card) => card.series));
  for (const [kind, grid] of Object.entries(grids)) {
    if (!grid) continue;
    grid.replaceChildren(...model.cards.filter((card) => (kind === 'chart') === !!card.series).map((card) => {
      const box = el(doc, 'section', null, 'trend-card');
      box.dataset.metric = card.id;
      const head = el(doc, 'div', null, 'trend-card-head');
      head.append(el(doc, 'h3', card.title, 'trend-card-title'), el(doc, 'span', card.value, 'trend-card-value'));
      box.append(head);
      const tags = el(doc, 'div', null, 'trend-card-tags');
      if (card.state) tags.append(el(doc, 'span', card.state.label, `regime-state is-${card.state.tone} sx-chip sx-chip--sm sx-chip--${CHIP_TONE[card.state.tone] || 'neutral'}`));
      if (card.value !== '—') tags.append(el(doc, 'span', card.basis, 'basis-chip'));
      box.append(tags);
      if (card.change) box.append(el(doc, 'div', card.change, 'trend-card-change'));
      if (card.series) box.append(createTrendChart(doc, { series: card.series, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }));
      // v57.77: providers moved from the hover (unreachable on a phone) to the page's 데이터 출처 fold (page-sources.js).
      // v58.79 (layout over captions): the card's how-to-read note opens with its deep-dive fold instead of sitting under
      // every chart; a card without a deep dive keeps it in a small "설명" fold.
      const rules = [...(card.note ? [el(doc, 'p', card.note)] : []), ...(card.rules ? [el(doc, 'h4', '판정 기준'), el(doc, 'p', card.rules)] : [])];
      const fold = deepDiveFold(doc, root, card.title.replace(/ \(.*\)$/, ''), SENTIMENT_DEEP_DIVES[card.id], rules); // P1660
      if (fold) box.append(fold);
      else { const note = noteFold(doc, card.note); if (note) box.append(note); }
      return box;
    }));
  }
  page.dataset.aioSentimentBoardRenderer = 'native';
  return model;
}

const CHIP_TONE = Object.freeze({ favorable: 'good', burden: 'warn', neutral: 'neutral', unknown: 'neutral' });

// v58.53 개편 v2 (5d): where today's F&G sits on CNN's five published bands (the same edges as fearGreedBand). A level, not
// a verdict — every band is the neutral ink tone and only the band holding today's value is darker.
function renderFearGreedGauge(doc, card) {
  const gauge = doc.getElementById('sentiment-gauge');
  if (!gauge) return;
  const value = card?.series?.at(-1)?.value;
  if (!Number.isFinite(value) || card.value === '—') { gauge.hidden = true; gauge.replaceChildren(); return; }
  const { extremeFearBelow, fearBelow, greedAbove, extremeGreedAbove } = RULES.fearGreed;
  const edges = [0, extremeFearBelow, fearBelow, greedAbove + 1, extremeGreedAbove + 1, 100];
  const labels = ['극단 공포', '공포', '중립', '탐욕', '극단 탐욕'];
  const shown = Math.round(value);
  // The highlighted band is the one fearGreedBand gives the same raw value, so the bar and the card's chip always agree.
  const bandLabel = publishedFearGreedBand(value).label;
  const bar = el(doc, 'div', null, 'mk-fg-gauge__bar');
  bar.setAttribute('aria-hidden', 'true');
  const legend = el(doc, 'div', null, 'mk-fg-gauge__labels');
  labels.forEach((label, index) => {
    const active = label === bandLabel;
    const seg = el(doc, 'span', null, `mk-fg-gauge__seg${active ? ' is-active' : ''}`);
    seg.style.setProperty('--w', String(edges[index + 1] - edges[index]));
    bar.append(seg);
    const name = el(doc, 'span', label, active ? 'is-active' : '');
    name.style.setProperty('--w', String(edges[index + 1] - edges[index]));
    legend.append(name);
  });
  const marker = el(doc, 'span', `▲ ${shown}`, 'mk-fg-gauge__marker');
  marker.style.setProperty('--at', `${Math.max(0, Math.min(100, value))}%`);
  const track = el(doc, 'div', null, 'mk-fg-gauge__track');
  track.append(marker);
  gauge.setAttribute('role', 'img');
  gauge.setAttribute('aria-label', `공포·탐욕 지수 ${shown} — ${bandLabel} 구간 (${card.basis})`);
  gauge.replaceChildren(bar, track, legend);
  gauge.hidden = false;
}

// One date range for charts compared side by side: the earliest start to the latest end.
export function sharedRange(seriesList) {
  const dates = seriesList.flatMap((series) => series.length ? [series[0].date, series[series.length - 1].date] : []).sort();
  return dates.length ? [dates[0], dates[dates.length - 1]] : null;
}
