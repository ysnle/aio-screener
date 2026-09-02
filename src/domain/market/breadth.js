// Fable-advisor design (2026-07-21, P746 breadth-stage-summary follow-up, second consult).
// The client receives today's AIO-universe breadth plus, after the screener producer has completed,
// a durable daily AIO-universe history in public-data/history.json. The caller may therefore pass a
// same-universe historical delta; a device-persisted one-cycle delta remains a fallback. This is
// still not official exchange A/D data and must not be called McClellan or an exchange-wide breadth
// stage. The model classifies participation LEVEL and DIRECTION only, and never fabricates either
// when the required same-universe observations are absent.
export const BREADTH_PARTICIPATION_MODEL_VERSION = 'breadth-participation.v1';

export const BREADTH_REFERENCE_LENS = Object.freeze({
  id: 'breadth-leadership-positioning-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  dimensions: Object.freeze([
    Object.freeze({ id: 'participation', label: '참여폭', question: '같은 유니버스의 5/20/50일선 위 비율이 상승·하락·정체인가?' }),
    Object.freeze({ id: 'leadership', label: '리더십 확산', question: '신고가·상대강도·거래량이 소수 종목에 집중되는가, 폭넓게 확산되는가?' }),
    Object.freeze({ id: 'extreme-moves', label: '극단 이동', question: '한 달 ±큰 변동 종목 수가 과열·질서 있는 조정·강제청산 중 무엇을 시사하는가?' }),
    Object.freeze({ id: 'positioning', label: '포지셔닝', question: '심리·가격 방향과 별개로 레버리지·숏커버·기관 흐름이 어떤 압력을 만드는가?' }),
    Object.freeze({ id: 'index-confirmation', label: '지수 확인', question: '시가총액가중 지수의 안정이 동일가중·소형주·섹터 breadth와 함께 나타나는가?' }),
    Object.freeze({ id: 'event-risk', label: '이벤트 리스크', question: '실적 발표 전후의 갭·거래량·가격 수용이 추세 확인 또는 무효화를 제공하는가?' })
  ]),
  rule: 'AIO 유니버스 breadth는 거래소 전체 breadth나 McClellan이 아니며, 극단 이동·포지셔닝 수치는 동일 유니버스와 관측일이 연결되기 전 현재 신호로 승격하지 않습니다.'
});

// 2026-08-30 supplied-chart integration. This is a reference protocol for
// comparing a chart claim with aligned time series; it is intentionally not a
// new score, market-regime classifier, or current index call.
export const MARKET_CONFIRMATION_REFERENCE = Object.freeze({
  id: 'market-confirmation-rotation-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  sequence: Object.freeze([
    Object.freeze({ id: 'observation', label: '관찰 사실', checks: '기준일·세션·종가·거래량·관측창' }),
    Object.freeze({ id: 'cross-index', label: '교차 지수', checks: 'cap-weighted ↔ equal-weight·small-cap·섹터 상대강도' }),
    Object.freeze({ id: 'trend-structure', label: '추세 구조', checks: '고점/저점·5/20/50/200일선 위치와 기울기·지지/저항' }),
    Object.freeze({ id: 'participation', label: '참여·수급', checks: 'breadth·신고가/신저가·거래량·VIX/credit·short-cover 구분' }),
    Object.freeze({ id: 'event', label: '이벤트 확인', checks: '실적 전후 갭·가격 수용·다음 관찰창·무효화' })
  ]),
  timeSeries: Object.freeze([
    Object.freeze({ id: 'reaction', window: '1~5 trading sessions', purpose: '이벤트 반응·갭·거래량·가격 수용' }),
    Object.freeze({ id: 'swing', window: '20~60 trading sessions', purpose: '추세 지속·상대강도·breadth 확산/축소' }),
    Object.freeze({ id: 'trend', window: '50~200 trading sessions', purpose: '중기 구조·이동평균 기울기·지수 확인' }),
    Object.freeze({ id: 'event-window', window: 'earnings/macro event window', purpose: '예상·실제·서프라이즈·가격/거래량 반응의 시간 정렬' })
  ]),
  boundary: '차트 패턴·소수 대형주 지지·하루 반등은 시장 전체 확인이나 매매 신호가 아닙니다. 동일 유니버스와 기준일이 연결된 관측값만 현재 판정에 사용합니다.'
});

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {object} input
 * @param {number|null} input.sma20   % of universe above 20-day SMA (today)
 * @param {number|null} input.sma50   % of universe above 50-day SMA (today)
 * @param {number|null} input.sma20Delta  today's sma20 minus the last persisted reading, in pp (primary direction signal)
 * @param {number|null} input.sma5Delta   today's sma5 minus the last persisted reading, in pp (used only when sma20Delta is unavailable)
 */
export function classifyBreadthParticipation({ sma20 = null, sma50 = null, sma20Delta = null, sma5Delta = null } = {}) {
  const s20 = finite(sma20);
  const s50 = finite(sma50);
  if (s20 == null || s50 == null || s20 < 0 || s20 > 100 || s50 < 0 || s50 > 100) {
    return Object.freeze({ modelVersion: BREADTH_PARTICIPATION_MODEL_VERSION, available: false, level: null, direction: null, inputs: Object.freeze({ sma20: s20, sma50: s50, sma20Delta: null, sma5Delta: null }) });
  }
  const level = (s20 >= 60 && s50 >= 55) ? 'broad'
    : (s20 <= 35 || (s20 < 50 && s50 < 45)) ? 'narrow'
    : 'neutral';
  const d20 = finite(sma20Delta);
  const d5 = finite(sma5Delta);
  const primaryDelta = d20 != null ? d20 : d5;
  const direction = primaryDelta == null ? null : primaryDelta > 2 ? 'rising' : primaryDelta < -2 ? 'falling' : 'flat';
  return Object.freeze({
    modelVersion: BREADTH_PARTICIPATION_MODEL_VERSION,
    available: true,
    level,
    direction,
    inputs: Object.freeze({ sma20: s20, sma50: s50, sma20Delta: d20, sma5Delta: d5 })
  });
}
