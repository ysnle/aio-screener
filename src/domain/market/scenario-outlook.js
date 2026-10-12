// P1633: what each market path would mean for the reader — likelihood from the current conditions,
// the choices that tend to fare better on that path (opportunity cost), and what to check, watch
// and ignore. Owner decision 2026-10-12: describe possibilities and opportunity cost, never trade
// instructions (no specific price, size or timing). Likelihood is a count of met rule conditions,
// not a calibrated probability, and no percentage is invented.
import { RULES } from '../rules/thresholds.js';

export const SCENARIO_OUTLOOK_VERSION = 'scenario-outlook.v1';

export const SECTOR_ETF_LABELS = Object.freeze({
  XLK: '기술', XLC: '통신서비스', XLY: '임의소비재', XLF: '금융', XLI: '산업재', XLB: '원자재', XLE: '에너지',
  XLV: '헬스케어', XLP: '필수소비재', XLU: '유틸리티', XLRE: '리츠/부동산'
});
const DEFENSIVE = new Set(['XLV', 'XLP', 'XLU']);

const join = (items) => items.filter(Boolean).join(' · ');
const likelihoodOf = (met, total, confirmed) => confirmed ? '높음' : met / total >= 0.5 ? '중간' : '낮음';

/**
 * @param {object} input
 * @param {object} input.scenarios buildMarketScenarios() result
 * @param {object} input.regime buildMarketRegime() result
 * @param {{symbol:string,label:string,quadrant:string}[]} [input.sectors] produced RRG rows (current session only)
 * @param {{name:string,ret3m:number}[]} [input.themes] US sub-theme strength, strongest first
 */
export function buildScenarioOutlook({ scenarios, regime, sectors = [], themes = [] } = {}) {
  if (!scenarios?.available || !regime?.available) return { available: false, version: SCENARIO_OUTLOOK_VERSION, items: [] };
  const state = Object.fromEntries((regime.axes || []).map((axis) => [axis.id, axis.state]));
  const calm = (id) => state[id] && state[id] !== 'burden' && state[id] !== 'unknown';
  const leading = sectors.filter((row) => row.quadrant === 'Leading').map((row) => row.label);
  const improving = sectors.filter((row) => row.quadrant === 'Improving').map((row) => row.label);
  const defensiveHolding = sectors.filter((row) => DEFENSIVE.has(row.symbol) && (row.quadrant === 'Leading' || row.quadrant === 'Improving' || row.quadrant === 'Weakening')).map((row) => row.label);
  const topThemes = themes.slice(0, 3).map((row) => row.name);
  const sectorNote = sectors.length ? '' : ' (섹터 회전 자료가 현재 세션 기준으로 없어 섹터 이름은 표시하지 않습니다)';
  const checks = {
    expansion: [['추세 우호', state.trend === 'favorable'], [`시장 폭 우호(50·200일선 위 ${RULES.breadth.broadAtLeast}% 이상)`, state.breadth === 'favorable'], ['신용 안정', calm('credit')], ['변동성 안정', calm('volatility')]],
    concentration: [['추세 우호', state.trend === 'favorable'], [`시장 폭 부담(${RULES.breadth.weakBelow}% 미만)`, state.breadth === 'burden'], ['신용 안정', calm('credit')], ['변동성 안정', calm('volatility')]],
    weakness: [['추세 부담', state.trend === 'burden'], ['시장 폭 부담', state.breadth === 'burden'], ['신용 또는 변동성 부담', state.credit === 'burden' || state.volatility === 'burden']]
  };
  const guide = {
    expansion: {
      posture: '이 흐름이 맞다면 현금을 오래 들고 있는 기회비용이 커질 가능성이 높습니다. 상승이 다수 종목으로 퍼지는 국면에서는 그동안 뒤처졌던 업종과 중소형주가 따라올 여지가 상대적으로 큽니다.',
      opportunity: improving.length || leading.length ? `${improving.length ? `섹터 회전에서 개선 중: ${join(improving)}` : '개선 중인 섹터는 아직 없음'} · 선도: ${join(leading) || '없음'}` : `확산이 확인되면 후행 업종의 개선 여부를 섹터 회전에서 확인합니다${sectorNote}.`,
      check: ['50일선·200일선 위 종목 비율이 함께 60% 이상을 유지하는지', '52주 신고가 종목이 신저가보다 꾸준히 많은지', '러셀 2000이 S&P 500을 따라오거나 앞서는지'],
      caution: ['20일선 위 비율만 오르고 50일선 비율이 따라오지 않으면 확산이라고 보기 이릅니다.', 'HY 스프레드가 다시 넓어지면 회복의 근거가 약해집니다.'],
      ignore: ['VIX의 하루 등락', '지수 하루 하락 — 참여 비율이 유지되면 추세 판단을 바꿀 근거가 아닙니다.']
    },
    concentration: {
      posture: '지수를 끌어올리는 소수 주도 영역에 노출이 전혀 없으면 기회비용이 생길 가능성이 높습니다. 동시에 주도 영역이 꺾일 때 지수 전체가 흔들릴 가능성도 커지므로, 새로 늘릴 때는 이미 이동평균에서 멀리 오른 종목보다 기준선 가까이에 있는 종목이 상대적으로 유리할 가능성이 높습니다.',
      opportunity: leading.length || topThemes.length ? `현재 주도: ${join([join(leading) && `섹터 ${join(leading)}`, topThemes.length && `3개월 상위 테마 ${join(topThemes)}`])}` : `주도 섹터·테마는 테마 화면에서 확인합니다${sectorNote}.`,
      check: ['주도 섹터의 상대강도가 유지되는지(선도 → 약화로 바뀌는지)', '지수 고점과 50일선 위 종목 비율의 괴리가 줄어드는지', '분배일(거래량 실린 하락일)이 늘어나는지'],
      caution: ['분배일이 누적되고 신저가 종목이 늘면 집중 장세가 끝나 갈 가능성이 커집니다.', '주도 종목 한두 개의 실적 실망이 지수 전체를 흔들 수 있습니다.'],
      ignore: ['후행 업종의 하루 반등 — 참여 비율이 넓어지기 전에는 흐름 전환으로 읽지 않습니다.', '지수 신고가 자체 — 참여가 좁으면 시장 전체가 강하다는 뜻이 아닙니다.']
    },
    weakness: {
      posture: '이 흐름이 맞다면 현금·단기채 비중을 확보해 두는 쪽이 손실을 줄이고 다음 기회를 살 여력을 남길 가능성이 높습니다. 새로 매수할 때는 지수의 50일선 회복과 시장 폭 개선이 확인될 때까지 기다리는 쪽이 기회비용보다 위험 관리 측면에서 유리할 가능성이 높습니다.',
      opportunity: defensiveHolding.length ? `상대적으로 버티는 방어 섹터: ${join(defensiveHolding)}` : `방어 섹터(헬스케어·필수소비재·유틸리티)의 상대강도를 섹터 회전에서 확인합니다${sectorNote}.`,
      check: ['HY 스프레드 확대가 멈추는지', 'VIX 기간 구조 역전(1 이상)이 풀리는지', 'S&P 500이 200일선을 되찾는지'],
      caution: ['급락 직후 하루 반등은 추세 회복이 아닐 가능성이 높습니다.', '"많이 빠져서 싸다"는 것은 추세 회복의 근거가 아닙니다.'],
      ignore: ['단기 과매도 지표 하나만의 신호', '하루짜리 정책·뉴스 헤드라인']
    }
  };
  const items = scenarios.scenarios.map((scenario) => {
    const list = checks[scenario.id] || [];
    const met = list.filter(([, ok]) => ok).length;
    const level = scenario.held ? '판단 보류' : likelihoodOf(met, list.length, scenario.confirmed);
    return { id: scenario.id, title: scenario.title, likelihood: level, met, total: list.length,
      basis: list.map(([label, ok]) => `${label} ${ok ? '충족' : '미충족'}`).join(' · '), ...guide[scenario.id] };
  });
  const order = { 높음: 3, 중간: 2, 낮음: 1, '판단 보류': 0 };
  const lead = [...items].sort((a, b) => order[b.likelihood] - order[a.likelihood] || b.met / b.total - a.met / a.total)[0];
  const headline = scenarios.held ? '필요한 관측이 없어 지금 어느 흐름에 가까운지 판단을 보류합니다.'
    : `지금 조건에 가장 가까운 흐름은 '${lead.title}'(개연성 ${lead.likelihood}, 조건 ${lead.met}/${lead.total})입니다.`;
  return { available: true, version: SCENARIO_OUTLOOK_VERSION, asOf: scenarios.asOf, headline, leadId: lead?.id || null, items };
}

export function renderScenarioOutlookContext(outlook) {
  if (!outlook?.available) return '';
  return `${outlook.asOf} 완료 종가 기준 시나리오 개연성(규칙 충족 수, 보정된 확률 아님). ${outlook.headline}\n`
    + outlook.items.map((item) => `${item.title}: 개연성 ${item.likelihood} (${item.basis}). 가능성: ${item.posture} 기회: ${item.opportunity} 확인: ${item.check.join('; ')} 조심: ${item.caution.join(' ')} 넘겨도 됨: ${item.ignore.join('; ')}`).join('\n')
    + '\n매매 지시(가격·수량·시점)는 하지 않고 가능성과 기회비용으로만 설명할 것.';
}
