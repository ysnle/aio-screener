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
import { collectMarketInputs } from './briefing-read.js';
import { createTrendChart, seriesChange } from './trend-chart.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { fearGreedBand as publishedFearGreedBand } from '../../domain/sentiment/metrics.js';
import { buildMarketRegime } from '../../domain/briefing/market-read.js';
import { sentimentFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from './page-flow.js';
import { computeCompositeFearGreed } from '../../domain/sentiment/composite-fear-greed.js';

// AAII published long-run averages (since 1987; https://www.aaii.com/sentimentsurvey): bullish 37.5%, neutral 31.5%, bearish 31.0%.
const AAII_AVERAGE = Object.freeze({ bull: 37.5, bear: 31.0 });
const EXCLUDED = Object.freeze({ label: '판정 제외', tone: 'unknown' });

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
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
const signedPp = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%p`;
// v57.50 C02: the HY card label comes from the one creditState() judgement (market-read), not a second set of edges.
const CREDIT_LABEL = Object.freeze({ favorable: { label: '안정', tone: 'favorable' }, neutral: { label: '경계', tone: 'neutral' }, burden: { label: '신용 스트레스', tone: 'burden' } });

export function buildSentimentModel({ history = [], credit = {}, rates = {}, snapshot = {}, macroHistory = null } = {}) {
  const { basis, c, alignments, fgSeries: fgAll } = alignMarketInputs({ history, credit, rates, macroHistory }); // T05: macroHistory gives the 20-session HY change
  const fgSeries = fgAll.slice(-126);
  const vix = buildCloseSeries(history, 'vix', { through: basis });
  const vix3m = new Map(buildCloseSeries(history, 'vix3m', { through: basis }).map((point) => [point.date, point.value]));
  const ratioSeries = vix.filter((point) => vix3m.get(point.date)).map((point) => ({ date: point.date, value: point.value / vix3m.get(point.date) })).slice(-126);
  const ratioLast = ratioSeries[ratioSeries.length - 1] || null;
  const ratioAlign = alignInput(ratioLast?.date, basis);
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
  const { hyBp, hy5, hy20, pcr } = c;
  const credit_ = creditState({ hyBp, hy5, hy20, pcr });
  const bear = isUsable(aaiiAlign) ? shown.bear : null;
  const bull = bear == null ? null : shown.bull;
  const judged = (value, state) => value == null ? (state === undefined ? null : EXCLUDED) : state;
  const fgBand = fearGreedBand(fg);
  const fgChange = [[1, '전일'], [5, '5일'], [20, '20일']].map(([n, label]) => { const v = seriesChange(fgSeries.map((point) => ({ ...point, value: Math.round(point.value) })), n, '', 0); return v ? `${label} ${v}` : null; }).filter(Boolean).join(' · ');
  const cards = [
    { id: 'fg', title: 'CNN 공포·탐욕 지수', value: shown.fg == null ? '—' : String(Math.round(shown.fg)), basis: alignmentLabel(alignments.fg), basisStatus: alignments.fg.status,
      state: shown.fg == null ? null : judged(fg, fgBand), series: fgSeries, refLines: [25, 50, 75], domain: [0, 100], format: (value) => value.toFixed(0),
      // P1508: the change is taken between the shown whole numbers (43 → 47 reads +4), the same rule as the home card;
      // rounding the raw difference gave +3 on one screen and +4 on the other for the same day.
      change: fgChange ? `${fgChange} (완료 종가 기준)` : '',
      note: 'VIX·풋콜·정크본드 수요·시장 폭·모멘텀 등 7개 지표를 합친 지수 — 다른 지표와 겹치므로 단독 판단에 쓰지 않음' },
    { id: 'term', title: 'VIX 기간 구조 (VIX ÷ 3개월 VIX)', value: shown.ratio == null ? '—' : shown.ratio.toFixed(2), basis: alignmentLabel(ratioAlign), basisStatus: ratioAlign.status,
      state: shown.ratio == null ? null : judged(ratio, ratio >= 1 ? { label: '역전 · 단기 스트레스', tone: 'burden' } : ratio >= 0.95 ? { label: '평탄', tone: 'neutral' } : { label: '정상', tone: 'favorable' }),
      series: ratioSeries, refLines: [1], format: (value) => value.toFixed(2), change: seriesChange(ratioSeries, 5, '', 2) ? `5일 ${seriesChange(ratioSeries, 5, '', 2)}` : '',
      note: '1 미만이면 단기 공포가 중기보다 작은 정상 상태, 1을 넘으면 당장의 충격을 크게 반영하는 역전' },
    { id: 'hy', title: 'HY 신용 스프레드', value: shown.hyBp == null ? '—' : `${Math.round(shown.hyBp)}bp`, basis: alignmentLabel(alignments.hy), basisStatus: alignments.hy.status,
      // v57.50 C02: the same creditState() as the 시장 상태 credit axis and the briefing (one judgement, one set of edges).
      state: shown.hyBp == null ? null : judged(hyBp, CREDIT_LABEL[credit_] || EXCLUDED),
      change: [shown.hy5 == null ? null : `5일 ${shown.hy5 >= 0 ? '+' : ''}${Math.round(shown.hy5)}bp`, hy20 == null ? null : `20거래일 ${hy20 >= 0 ? '+' : ''}${Math.round(hy20)}bp`].filter(Boolean).join(' · '), note: `고위험 회사채가 국채보다 더 받는 금리 — 돈을 빌리기 어려워질수록 커짐 · ${RULES.credit.stressAtBp}bp 이상 또는 5일 +${RULES.credit.widen5dBp}bp 이상이면 스트레스, ${RULES.credit.tightBelowBp}bp 미만이면서 5일 확대 없음·20거래일 +${RULES.credit.widen20dBp}bp 미만·풋/콜 ${RULES.credit.putCallHedgeAt} 미만일 때만 안정, 그 밖은 경계` },
    { id: 'pcr', title: '풋/콜 비율', value: shown.pcr == null ? '—' : shown.pcr.toFixed(2), basis: alignmentLabel(alignments.pcr), basisStatus: alignments.pcr.status,
      // T10: the card reads the same RULES edges as the credit axis (1.1 hedging, below 0.7 optimism). D19: level only, neutral tone.
      state: shown.pcr == null ? null : judged(pcr, pcr >= RULES.credit.putCallHedgeAt ? { label: '헤지 수요 높음', tone: LEVEL_TONE } : pcr < RULES.credit.putCallOptimismBelow ? { label: '콜 우위 (낙관 쪽)', tone: LEVEL_TONE } : { label: '중립', tone: LEVEL_TONE }),
      change: '', source: 'CBOE 전체 옵션 풋/콜 비율', note: `미국 상장 옵션 전체에서 하락에 대비하는 풋옵션 거래가 콜옵션보다 얼마나 많은지 — 높을수록 방어적 · ${RULES.credit.putCallHedgeAt} 이상 헤지 수요 높음, ${RULES.credit.putCallOptimismBelow} 미만 낙관` },
    { id: 'aaii', title: 'AAII 개인 설문', value: shown.bear == null ? '—' : `약세 ${shown.bear.toFixed(1)}%`, basis: credit.aaiiAsOf ? `${alignmentLabel(aaiiAlign)} 주간` : '미수신', basisStatus: isUsable(aaiiAlign) ? 'aligned' : aaiiAlign.status,
      // v57.50 D24/C04: no sourced 45% '비관' cut-off exists, so the state is the distance from AAII's published long-run average.
      state: shown.bear == null ? null : judged(bear, { label: `약세 장기 평균 대비 ${signedPp(bear - AAII_AVERAGE.bear)}`, tone: LEVEL_TONE }),
      change: shown.bull == null ? '' : `강세 ${shown.bull.toFixed(1)}%${bull != null ? ` (평균 대비 ${signedPp(bull - AAII_AVERAGE.bull)})` : ''} · 장기 평균 강세 ${AAII_AVERAGE.bull.toFixed(1)}% / 약세 ${AAII_AVERAGE.bear.toFixed(1)}%`,
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
  const volCalm = volKnown && ratio < 1;
  const fearSource = fgFear ? `F&G(${Math.round(fg)}, ${fgBand.label})` : '';
  const aaiiLine = bear != null ? `AAII 약세 응답 ${bear.toFixed(1)}%는 장기 평균(${AAII_AVERAGE.bear.toFixed(1)}%)보다 ${signedPp(bear - AAII_AVERAGE.bear)}입니다.` : null;
  let synthesis;
  if (!moodKnown) synthesis = '기준일에 맞는 심리 지표(F&G·AAII)가 없어 종합 판단을 보류합니다.';
  else if (fearful && creditCalm && volCalm) synthesis = `${fearSource}는 비관 쪽인데 신용(${Math.round(hyBp)}bp)과 변동성 구조(${ratio.toFixed(2)})는 안정 — 비관이 심리 지표에 머물러 있고 신용·변동성 스트레스로는 번지지 않았습니다.`;
  else if (fearful && (creditStress || (volKnown && !volCalm))) synthesis = `${fearSource}의 비관과 함께 ${[creditStress ? `신용 스프레드(${Math.round(hyBp)}bp${hy5 != null ? `, 5일 ${hy5 >= 0 ? '+' : ''}${Math.round(hy5)}bp` : ''})도 스트레스 구간` : null, volKnown && !volCalm ? `변동성 구조도 역전(${ratio.toFixed(2)})` : null].filter(Boolean).join(', ')} — 위험 회피가 심리 지표를 넘어 퍼지고 있습니다.`;
  else if (fearful && creditKnown && volKnown) synthesis = `${fearSource}는 비관 쪽이고 신용 스프레드(${Math.round(hyBp)}bp${hy20 != null ? `, 20거래일 ${hy20 >= 0 ? '+' : ''}${Math.round(hy20)}bp` : ''})는 경계 구간입니다 — 비관이 신용으로 번지는지 확인할 단계입니다.`;
  else if (fearful) synthesis =`${fearSource}는 비관 쪽이지만 ${[!creditKnown ? '신용 스프레드' : null, !volKnown ? '변동성 구조' : null].filter(Boolean).join('·')} 자료가 기준일에 없어 비관이 번졌는지 확인하지 못했습니다.`;
  else if (greedy) synthesis = hedgeLow ? `낙관이 강하고(F&G ${Math.round(fg)}) 헤지 수요가 낮음(풋/콜 ${pcr.toFixed(2)}) — 충격에 대비가 얇은 배치입니다.` : `낙관이 강합니다(F&G ${Math.round(fg)}). 풋/콜 비율이 ${pcr == null ? '없어 헤지 수요는 확인하지 못했습니다' : `${pcr.toFixed(2)}로 헤지 수요가 낮지는 않습니다`}.`;
  else if (fgBand) synthesis = `F&G ${Math.round(fg)}(${fgBand.label})는 한쪽으로 치우치지 않은 상태입니다.`;
  else synthesis = 'F&G가 기준일에 없어 가격 쪽 심리는 판단하지 않고, 개인 설문만 아래에 적습니다.';
  const mixed = cards.filter((card) => card.value !== '—' && card.basisStatus !== 'aligned').map((card) => card.title);
  return { asOf: basis, mixed, cards, synthesis, aaiiNote: aaiiLine };
}

// P1586: the self-computed components sit beside CNN's index as a reference. v57.50 D02 (coordinator decision): no
// 0-100 average and no 공포~탐욕 band — each component's one-year percentile is listed side by side, a component
// without an observation reads '자료 부족', and one line names the lowest and highest component.
const SPREAD_WIDE_AT = 50; // half the percentile scale: the components point in clearly different directions
function componentText(row) {
  if (row.status === 'ok') return `${row.label} ${Math.round(row.score)}`;
  if (row.status === 'stale') return `${row.label} 오래됨${row.asOf ? `(${shortDate(row.asOf)} 관측)` : ''}`;
  return `${row.label} 자료 부족${Number.isFinite(row.observations) && row.needed ? `(기록 ${row.observations}/${row.needed}일)` : ''}`;
}
function compositeCard(composite) {
  const spread = composite.spread;
  const shown = composite.status !== 'withheld' && spread;
  const spreadLine = shown ? `요소 간 차이${spread.gap >= SPREAD_WIDE_AT ? ' 큼' : ''}: 최저 ${spread.low.label} ${Math.round(spread.low.score)}, 최고 ${spread.high.label} ${Math.round(spread.high.score)}` : '';
  return {
    id: 'composite', title: '심리 구성 요소 백분위 (참고)', value: shown ? `${Math.round(spread.low.score)}~${Math.round(spread.high.score)}` : '—',
    basis: composite.asOf ? `${shortDate(composite.asOf)} 기준 · 요소 ${composite.componentsReady}/${composite.componentsTotal}` : `요소 ${composite.componentsReady}/${composite.componentsTotal}`,
    basisStatus: shown ? 'aligned' : 'missing',
    state: shown && spread.gap >= SPREAD_WIDE_AT ? { label: '요소 간 차이 큼', tone: LEVEL_TONE } : null,
    change: composite.components.map(componentText).join(' · '),
    // P1593 (F97): every component is named, including the ones without data, so a partial set is not read as CNN's seven.
    note: `${spreadLine ? `${spreadLine}. ` : ''}CNN 지수의 7개 요소를 공개 자료로 각각 최근 1년 백분위(높을수록 낙관 쪽, 변동성·풋/콜·정크본드는 뒤집어 계산)로 나란히 놓았습니다. 한 점수로 평균하거나 공포·탐욕 구간을 붙이지 않으며 CNN 값과 같지 않습니다. 계산되는 요소가 4개 미만이면 표시하지 않습니다.`
  };
}
export function renderSentimentBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-sentiment');
  if (!page) return null;
  const inputs = collectMarketInputs(root);
  const model = buildSentimentModel({ ...inputs, snapshot: root.DATA_SNAPSHOT || {}, macroHistory: root._aioMacroHistory || null });
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('sentiment-basis', model.asOf ? `${shortDate(model.asOf)} 미국 종가 기준${model.mixed.length ? ' · 날짜가 다른 지표는 카드에 표시' : ''} · 공포·탐욕, 변동성 구조, 신용, 옵션, 개인 설문` : '기록을 불러오는 중입니다.');
  set('sentiment-synthesis', model.synthesis);
  set('sentiment-aaii-note', model.aaiiNote || '');
  // P1431: tie the synthesis back to the 시장 상태 axes that use the same numbers.
  const flow = sentimentFlow({ model, regime: buildMarketRegime({ ...inputs, macroHistory: root._aioMacroHistory || null }) });
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
      if (card.state) tags.append(el(doc, 'span', card.state.label, `regime-state is-${card.state.tone}`));
      if (card.value !== '—') tags.append(el(doc, 'span', card.basis, 'basis-chip'));
      box.append(tags);
      if (card.change) box.append(el(doc, 'div', card.change, 'trend-card-change'));
      if (card.series) box.append(createTrendChart(doc, { series: card.series, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null, range }));
      box.append(el(doc, 'p', card.note, 'trend-card-note'));
      if (card.source) box.title = card.source; // T22: provider names in the hover
      const fold = deepDiveFold(doc, root, card.title.replace(/ \(.*\)$/, ''), SENTIMENT_DEEP_DIVES[card.id]); // P1660
      if (fold) box.append(fold);
      return box;
    }));
  }
  page.dataset.aioSentimentBoardRenderer = 'native';
  return model;
}

// One date range for charts compared side by side: the earliest start to the latest end.
export function sharedRange(seriesList) {
  const dates = seriesList.flatMap((series) => series.length ? [series[0].date, series[series.length - 1].date] : []).sort();
  return dates.length ? [dates[0], dates[dates.length - 1]] : null;
}
