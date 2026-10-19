// Expertise review 2026-10-19: the S&P 500's own earnings read — revision breadth (are next-year estimates being raised or
// cut), the forward multiple and the equity risk premium against the 10-year real yield — with a per-sector revision line.
// Data owner: src/domain/market/index-earnings.js. Conclusion first, then the evidence, then what it means.
import { buildIndexEarnings, INDEX_EARNINGS_MIN_WEIGHT_PCT, SECTOR_MIN_MEMBERS } from '../../domain/market/index-earnings.js';
import { GICS_KO } from '../../domain/market/sector-map.js';
import { requestConsensusEstimates, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { el } from './dom.js';

const pct = (value, digits = 0) => (value == null ? '—' : `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(digits)}%`);
const shortDate = (date) => (date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : '');

function headline(model) {
  if (model.breadth == null) return '지수 전체를 말할 만큼 컨센서스가 모이지 않았습니다.';
  const tilt = model.breadth >= 0.1 ? '올리는 쪽이 우세합니다' : model.breadth <= -0.1 ? '내리는 쪽이 우세합니다' : '올림과 내림이 비슷합니다';
  return `최근 4주 애널리스트들은 S&P 500 기업의 향후 4개 분기 이익 전망을 ${tilt} (상향 우위 ${pct(model.breadth)}, 수정 건수 기준).`;
}

export function renderIndexEarnings({ documentRef: doc, root, store }) {
  let host = doc?.getElementById('index-earnings');
  const map = doc?.getElementById('sector-map');
  if (!host && map) { // placed right after the S&P 500 map, which already carries the same weights and closes
    host = el(doc, 'section', null, 'aio-section index-earnings');
    host.id = 'index-earnings';
    host.setAttribute('aria-label', 'S&P 500 이익 전망과 밸류에이션');
    map.after(host);
  }
  if (!host || !root) return null;
  if (!root[CONSENSUS_KEY]) {
    requestConsensusEstimates(root, () => renderIndexEarnings({ documentRef: doc, root, store }));
  }
  let rows = [];
  let weights = null;
  try {
    const screener = store?.getState?.()?.screener;
    rows = screener?.rows || root._aioGetCanonicalScreenerRows?.() || [];
    weights = screener?.metadata?.indexWeights || null;
  } catch (_) { rows = []; }
  const macro = root._aioServerMacro || {};
  const model = buildIndexEarnings({ rows, weights, consensus: root[CONSENSUS_KEY], realYield10: macro.realYield10, realYieldAsOf: macro._asOf_realYield10 || null });
  const head = el(doc, 'h2', 'S&P 500 이익 전망과 밸류에이션', 'briefing-h2');
  if (!model.available) {
    host.replaceChildren(head, el(doc, 'div', model.reason, 'briefing-empty'));
    return model;
  }
  const basis = `컨센서스 ${model.oldestAsOf && model.oldestAsOf !== model.asOf ? `${shortDate(model.oldestAsOf)}~` : ''}${shortDate(model.asOf)} · 지수 비중 ${shortDate(model.weightsAsOf)} · ${model.members}개 기업(비중 ${model.coveragePct.toFixed(0)}%)`;
  head.append(el(doc, 'span', basis, 'briefing-h2-note'));
  const lead = el(doc, 'p', headline(model), 'rates-curve-fact');
  const facts = el(doc, 'ul', null, 'briefing-read-reading');
  const line = (text) => facts.append(el(doc, 'li', text));
  line(`전망 수정 ${model.up.toLocaleString('en-US')}건 상향 · ${model.down.toLocaleString('en-US')}건 하향 (기업별로 보면 상향이 많은 곳 ${model.netUp}, 하향이 많은 곳 ${model.netDown}).`);
  if (model.forwardPe != null) line(`선행 PER ${model.forwardPe.toFixed(1)}배 — 향후 4개 분기 컨센서스 이익을 각 종목 직전 종가로 나눠 지수 비중으로 합산(이익수익률 ${(model.earningsYield * 100).toFixed(1)}%).`);
  if (model.growth != null) line(`향후 4개 분기 이익이 직전 4개 분기보다 ${pct(model.growth)} (이익 규모 가중).`);
  if (model.erp != null) line(`주식위험프리미엄 ${model.erp.toFixed(1)}%p — 이익수익률 ${(model.earningsYield * 100).toFixed(1)}%에서 10년 실질금리 ${model.realYield10.toFixed(2)}%${model.realYieldAsOf ? `(${shortDate(model.realYieldAsOf)})` : ''}를 뺀 값.`);
  const reading = el(doc, 'p', null, 'briefing-read-reading');
  reading.append(el(doc, 'span', '해석', 'briefing-hypothesis-tag'), doc.createTextNode(' 이익 전망 수정의 방향은 지수 이익 추세보다 먼저 움직이는 편이라, 가격보다 펀더멘털 쪽 흐름을 먼저 보여 줍니다. 위험프리미엄이 낮을수록 같은 이익 실망에 주가가 더 크게 반응할 여지가 있고, 실질금리가 오르면 프리미엄이 줄어 밸류에이션 부담이 커집니다. 이 화면에는 아직 과거 기록이 없어 지금 값이 역사적으로 높은지 낮은지는 말하지 않습니다.'));
  const parts = [head, lead, facts, reading];
  if (model.sectors.length) {
    const fold = el(doc, 'details', null, 'aio-comp-secondary');
    fold.append(el(doc, 'summary', `섹터별 4주 상향 우위 (구성 기업 ${SECTOR_MIN_MEMBERS}개 이상)`));
    const list = el(doc, 'ul', null, 'briefing-read-reading');
    for (const row of model.sectors) list.append(el(doc, 'li', `${GICS_KO[row.sector] || row.sector} ${pct(row.revision)} — 상향 ${row.up} · 하향 ${row.down} (${row.members}개 기업)`));
    fold.append(list);
    parts.push(fold);
  }
  parts.push(el(doc, 'p', `상향 우위 = (상향 건수 − 하향 건수) ÷ (상향 + 하향) — 이익이 몇 % 바뀌었는지가 아니라 수정 방향의 쏠림입니다. 보통주 두 종류(GOOG·GOOGL 등)는 한 기업으로 셉니다. 지수 비중 ${INDEX_EARNINGS_MIN_WEIGHT_PCT}% 이상이 모여야 지수 값을 냅니다. 출처: Nasdaq·Zacks 컨센서스(조정 EPS 기준, 참고용), iShares IVV 보유 비중, FRED DFII10.`, 'briefing-empty'));
  host.replaceChildren(...parts);
  return model;
}
