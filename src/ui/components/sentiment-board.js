// P1396 (owner review 2026-10-02): 투자 심리 = five equal indicator cards (state, change, trend where
// a history exists) and one synthesis that separates price-driven fear from credit/volatility
// stress. Replaces the gauge layout, the 'SOURCE 확인 대기'/'판정 보류' badges, the sourceless SKEW
// card and the composite paragraph that still quoted the retired 0-100 score.
import { buildCloseSeries } from '../../domain/briefing/market-read.js';
import { collectMarketInputs } from './briefing-read.js';
import { createTrendChart, seriesChange } from './trend-chart.js';

// AAII published long-run averages (since 1987): bullish 37.5%, neutral 31.5%, bearish 31.0%.
const AAII_AVERAGE = Object.freeze({ bull: 37.5, bear: 31.0 });

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

export function fearGreedBand(value) {
  if (value == null) return null;
  return value < 25 ? { label: '극단적 공포', tone: 'burden' } : value < 45 ? { label: '공포', tone: 'burden' }
    : value <= 55 ? { label: '중립', tone: 'neutral' } : value < 75 ? { label: '탐욕', tone: 'favorable' } : { label: '극단적 탐욕', tone: 'burden' };
}

export function buildSentimentModel({ history = [], credit = {}, snapshot = {} } = {}) {
  const fgSeries = buildCloseSeries(history, 'fg').slice(-126);
  const vix = buildCloseSeries(history, 'vix');
  const vix3m = new Map(buildCloseSeries(history, 'vix3m').map((point) => [point.date, point.value]));
  const ratioSeries = vix.filter((point) => vix3m.get(point.date)).map((point) => ({ date: point.date, value: point.value / vix3m.get(point.date) })).slice(-126);
  const fg = fgSeries.length ? fgSeries[fgSeries.length - 1].value : finite(credit.fg);
  const ratio = ratioSeries.length ? ratioSeries[ratioSeries.length - 1].value : null;
  const hyBp = finite(credit.hyBp);
  const hy5 = finite(credit.hyDelta5Bp);
  const pcr = finite(credit.pcr);
  const bear = finite(snapshot.aaiiBear);
  const bull = finite(snapshot.aaiiBull);
  const fgBand = fearGreedBand(fg);
  const cards = [
    { id: 'fg', title: 'CNN 공포·탐욕 지수', value: fg == null ? '—' : String(Math.round(fg)), state: fgBand, series: fgSeries, refLines: [25, 50, 75], domain: [0, 100], format: (value) => value.toFixed(0),
      change: [[1, '전일'], [5, '5일'], [20, '20일']].map(([n, label]) => { const v = seriesChange(fgSeries, n, '', 0); return v ? `${label} ${v}` : null; }).filter(Boolean).join(' · '),
      note: 'VIX·풋콜·정크본드 수요·시장 폭·모멘텀 등 7개 지표를 합친 지수 — 다른 지표와 겹치므로 단독 판단에 쓰지 않음' },
    { id: 'term', title: 'VIX 기간 구조 (VIX ÷ 3개월 VIX)', value: ratio == null ? '—' : ratio.toFixed(2),
      state: ratio == null ? null : ratio >= 1 ? { label: '역전 · 단기 스트레스', tone: 'burden' } : ratio >= 0.95 ? { label: '평탄', tone: 'neutral' } : { label: '정상', tone: 'favorable' },
      series: ratioSeries, refLines: [1], format: (value) => value.toFixed(2), change: seriesChange(ratioSeries, 5, '', 2) ? `5일 ${seriesChange(ratioSeries, 5, '', 2)}` : '',
      note: '1 미만이면 단기 공포가 중기보다 작은 정상 상태, 1을 넘으면 당장의 충격을 크게 반영하는 역전' },
    { id: 'hy', title: 'HY 신용 스프레드', value: hyBp == null ? '—' : `${Math.round(hyBp)}bp`,
      // Same bands as the 시장 상태 credit axis (P1392): < 350bp calm, 350-450 watch, >= 450 stress.
      state: hyBp == null ? null : hyBp >= 450 || (hy5 != null && hy5 >= 25) ? { label: '신용 스트레스', tone: 'burden' } : hyBp >= 350 ? { label: '경계', tone: 'neutral' } : { label: '안정', tone: 'favorable' },
      change: hy5 == null ? '' : `5일 ${hy5 >= 0 ? '+' : ''}${Math.round(hy5)}bp`, note: '고위험 회사채가 국채보다 더 받는 금리 — 돈을 빌리기 어려워질수록 커짐' },
    { id: 'pcr', title: '풋/콜 비율', value: pcr == null ? '—' : pcr.toFixed(2),
      state: pcr == null ? null : pcr > 1 ? { label: '헤지 수요 높음', tone: 'burden' } : pcr < 0.7 ? { label: '낙관 (콜 우위)', tone: 'favorable' } : { label: '중립', tone: 'neutral' },
      change: '', note: 'CBOE 전체 기준 — 하락에 대비하는 풋옵션 거래가 콜옵션보다 얼마나 많은지 — 높을수록 방어적' },
    { id: 'aaii', title: 'AAII 개인 설문', value: bear == null ? '—' : `약세 ${bear.toFixed(1)}%`,
      state: bear == null ? null : bear >= 45 ? { label: '비관 강함', tone: 'burden' } : bull != null && bull >= 50 ? { label: '낙관 강함', tone: 'favorable' } : { label: '보통', tone: 'neutral' },
      change: bull == null ? '' : `강세 ${bull.toFixed(1)}% · 장기 평균 강세 ${AAII_AVERAGE.bull}% / 약세 ${AAII_AVERAGE.bear}%`,
      note: '주간 발표 — 개인 투자자의 6개월 전망 설문 — 극단값은 과열·과매도 참고로만 봄' }
  ];
  // Synthesis: is the fear in prices only, or also in credit and volatility structure?
  const fearful = (fg != null && fg < 45) || (bear != null && bear >= 45);
  const greedy = fg != null && fg > 75 && (pcr == null || pcr < 0.7);
  const creditCalm = hyBp != null && hyBp < 400 && (hy5 == null || hy5 < 25);
  const volCalm = ratio != null && ratio < 1;
  const parts = [fg != null ? `F&G ${Math.round(fg)}` : null, bear != null ? `AAII 약세 ${bear.toFixed(1)}%` : null].filter(Boolean).join(' · ');
  let synthesis = '심리 지표가 한쪽으로 치우치지 않은 상태입니다.';
  if (fearful && creditCalm && volCalm) synthesis = `심리 지표(${parts})는 공포인데 신용(${Math.round(hyBp)}bp)과 변동성 구조(${ratio.toFixed(2)})는 안정 — 가격·시장 폭 약세에서 나온 공포이고, 신용·변동성 스트레스로는 번지지 않았습니다.`;
  else if (fearful && (!creditCalm || !volCalm)) synthesis = `심리(${parts})와 함께 ${!creditCalm ? '신용 스프레드' : '변동성 구조'}도 악화 — 위험 회피가 가격을 넘어 퍼진 상태입니다.`;
  else if (greedy) synthesis = `낙관이 강하고(F&G ${Math.round(fg)}) 헤지 수요가 낮음 — 충격에 대비가 얇은 배치입니다.`;
  const asOf = fgSeries.length ? fgSeries[fgSeries.length - 1].date : null;
  return { asOf, cards, synthesis, aaiiNote: bear != null && bear >= 45 ? `AAII 약세 응답 ${bear.toFixed(1)}%는 장기 평균(${AAII_AVERAGE.bear}%)보다 크게 높음 — 개인 투자자 비관이 강한 편입니다.` : null };
}

export function renderSentimentBoard({ documentRef: doc, root }) {
  const page = doc?.getElementById('page-sentiment');
  if (!page) return null;
  const inputs = collectMarketInputs(root);
  const model = buildSentimentModel({ history: inputs.history, credit: inputs.credit, snapshot: root.DATA_SNAPSHOT || {} });
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  set('sentiment-basis', model.asOf ? `${shortDate(model.asOf)} 기준 · 공포·탐욕, 변동성 구조, 신용, 옵션, 개인 설문` : '기록을 불러오는 중입니다.');
  set('sentiment-synthesis', model.synthesis);
  set('sentiment-aaii-note', model.aaiiNote || '');
  // Charted cards share one row and the value-only cards another, so card heights match.
  const grids = { chart: doc.getElementById('sentiment-card-grid'), mini: doc.getElementById('sentiment-mini-grid') };
  for (const [kind, grid] of Object.entries(grids)) {
    if (!grid) continue;
    grid.replaceChildren(...model.cards.filter((card) => (kind === 'chart') === !!card.series).map((card) => {
      const box = el(doc, 'section', null, 'trend-card');
      box.dataset.metric = card.id;
      const head = el(doc, 'div', null, 'trend-card-head');
      head.append(el(doc, 'h3', card.title, 'trend-card-title'), el(doc, 'span', card.value, 'trend-card-value'));
      box.append(head);
      if (card.state) box.append(el(doc, 'span', card.state.label, `regime-state is-${card.state.tone}`));
      if (card.change) box.append(el(doc, 'div', card.change, 'trend-card-change'));
      if (card.series) box.append(createTrendChart(doc, { series: card.series, refLines: card.refLines, format: card.format, label: card.title, domain: card.domain || null }));
      box.append(el(doc, 'p', card.note, 'trend-card-note'));
      return box;
    }));
  }
  page.dataset.aioSentimentBoardRenderer = 'native';
  return model;
}
