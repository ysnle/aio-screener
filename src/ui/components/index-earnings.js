// Expertise review 2026-10-19: the S&P 500's own earnings read — revision breadth (are next-year estimates being raised or
// cut), the forward multiple and the equity risk premium against the 10-year real yield — with a per-sector revision line.
// Data owner: src/domain/market/index-earnings.js, built once as the interpretation pipeline's indexEarnings stage so the
// lessons and the AI read the same revision breadth. Conclusion first, then the evidence, then what it means.
import { INDEX_EARNINGS_MIN_WEIGHT_PCT, SECTOR_MIN_MEMBERS } from '../../domain/market/index-earnings.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { GICS_KO } from '../../domain/market/sector-map.js';
import { requestConsensusEstimates, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { el } from './dom.js';
import { gaugeBar } from './macro-board.js'; // a hoisted function declaration, so the macro-board ↔ index-earnings cycle is safe
import { asOfChip } from './section-frame.js';
import { signedText } from '../../domain/shared/number.js';

const pct = (value, digits = 0) => (value == null ? '—' : signedText(value * 100, digits, '%'));
const shortDate = (date) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '');

function headline(model) {
  if (model.breadth == null) return '지수 전체를 말할 만큼 컨센서스가 모이지 않았습니다.';
  const tilt = model.breadth >= 0.1 ? '올리는 쪽이 우세합니다' : model.breadth <= -0.1 ? '내리는 쪽이 우세합니다' : '올림과 내림이 비슷합니다';
  return `최근 4주 애널리스트들은 S&P 500 기업의 앞으로 1년 이익 전망을 ${tilt}.`;
}

// v59.51 (content audit): the face is the plain headline and the revision-breadth gauge; the counts, multiples, risk
// premium, reading, sector split and method sit in one closed fold.
const breadthGauge = (breadth) => ({ label: '전망 상향 우위', value: breadth * 100, min: -50, max: 50, digits: 0, unit: '%',
  clipped: Math.abs(breadth * 100) > 50,
  bands: [{ from: -50, to: -10, tone: 'burden' }, { from: -10, to: 10, tone: 'neutral' }, { from: 10, to: 50, tone: 'favorable' }],
  markers: [{ at: -10, label: '하향 우세' }, { at: 10, label: '상향 우세' }] });

export function renderIndexEarnings({ documentRef: doc, root, store }) {
  const host = doc?.getElementById('index-earnings');
  if (!host || !root) return null;
  if (!root[CONSENSUS_KEY]) {
    requestConsensusEstimates(root, () => renderIndexEarnings({ documentRef: doc, root, store }));
  }
  const model = marketInterpretation(root, { store }).indexEarnings || { available: false, reason: '지수 이익 전망을 계산하지 못했습니다.' };
  const head = el(doc, 'h2', 'S&P 500 이익 전망과 밸류에이션', 'briefing-h2');
  if (!model.available) {
    host.replaceChildren(head, el(doc, 'div', model.reason, 'briefing-empty'));
    return model;
  }
  const basis = `컨센서스 ${model.oldestAsOf && model.oldestAsOf !== model.asOf ? `${shortDate(model.oldestAsOf)}~` : ''}${shortDate(model.asOf)}, 지수 비중 ${shortDate(model.weightsAsOf)}, ${model.members}개 기업(비중 ${model.coveragePct.toFixed(0)}%)`;
  // v58.79 (layout over captions): the consensus date is the heading's chip; weights and coverage are its hover.
  head.append(doc.createTextNode(' '), asOfChip(doc, `컨센서스 ${shortDate(model.asOf)}`, basis));
  const lead = el(doc, 'p', headline(model), 'rates-curve-fact');
  const facts = el(doc, 'ul', null, 'briefing-read-reading');
  const line = (text) => facts.append(el(doc, 'li', text));
  if (model.breadth != null) line(`상향 우위 ${pct(model.breadth)} (수정 건수 기준).`);
  line(`전망 수정 ${model.up.toLocaleString('en-US')}건 상향, ${model.down.toLocaleString('en-US')}건 하향 (기업별로 보면 상향이 많은 곳 ${model.netUp}, 하향이 많은 곳 ${model.netDown}).`);
  if (model.forwardPe != null) line(`선행 PER ${model.forwardPe.toFixed(1)}배 — 향후 4개 분기 컨센서스 이익을 각 종목 직전 종가로 나눠 지수 비중으로 합산(이익수익률 ${(model.earningsYield * 100).toFixed(1)}%).`);
  if (model.growth != null) line(`향후 4개 분기 이익이 직전 4개 분기보다 ${pct(model.growth)} (이익 규모 가중).`);
  if (model.erp != null) line(`주식위험프리미엄 ${model.erp.toFixed(1)}%p — 이익수익률 ${(model.earningsYield * 100).toFixed(1)}%에서 10년 실질금리 ${model.realYield10.toFixed(2)}%${model.realYieldAsOf ? `(${shortDate(model.realYieldAsOf)})` : ''}를 뺀 값.`);
  const reading = el(doc, 'p', null, 'briefing-read-reading');
  reading.append(el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(' 이익 전망 수정의 방향은 지수 이익 추세보다 먼저 움직이는 편이라, 가격보다 펀더멘털 쪽 흐름을 먼저 보여 줍니다. 위험프리미엄이 낮을수록 같은 이익 실망에 주가가 더 크게 반응할 여지가 있고, 실질금리가 오르면 프리미엄이 줄어 밸류에이션 부담이 커집니다. 이 화면에는 아직 과거 기록이 없어 지금 값이 역사적으로 높은지 낮은지는 말하지 않습니다.'));
  const detail = el(doc, 'details', null, 'aio-comp-secondary');
  detail.append(el(doc, 'summary', '숫자와 해석 — 선행 PER, 위험프리미엄, 섹터별'), facts, reading);
  if (model.sectors.length) {
    detail.append(el(doc, 'h3', `섹터별 4주 상향 우위 (구성 기업 ${SECTOR_MIN_MEMBERS}개 이상)`, 'briefing-h3'));
    const list = el(doc, 'ul', null, 'briefing-read-reading');
    for (const row of model.sectors) list.append(el(doc, 'li', `${GICS_KO[row.sector] || row.sector} ${pct(row.revision)} — 상향 ${row.up}, 하향 ${row.down} (${row.members}개 기업)`));
    detail.append(list);
  }
  const parts = [head, lead, model.breadth != null ? gaugeBar(doc, breadthGauge(model.breadth)) : null, detail].filter(Boolean);
  detail.append(el(doc, 'p', `상향 우위 = (상향 건수 − 하향 건수) ÷ (상향 + 하향) — 이익이 몇 % 바뀌었는지가 아니라 수정 방향의 쏠림입니다. 보통주 두 종류(GOOG·GOOGL 등)는 한 기업으로 셉니다. 지수 비중 ${INDEX_EARNINGS_MIN_WEIGHT_PCT}% 이상이 모여야 지수 값을 냅니다. 컨센서스는 조정 EPS 기준 참고값입니다(자료 출처는 아래 데이터 출처 칸).`, 'briefing-empty'));
  host.replaceChildren(...parts);
  return model;
}
