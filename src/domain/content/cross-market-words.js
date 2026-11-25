// The opening's cross-market rows (src/domain/market/story/cross-market.js): what each check's state means for stocks
// now, one short clause per (check, state). The state itself is the 시장 상태 axis's (or, for the dollar, the axis's dollar
// leg); these words only say what that state does to the story, so they never decide anything. No definitions, no
// source names: the reader already sees the figure beside the clause.

/** The rows' names, in the order the opening says them. */
export const CROSS_MARKET_LABELS = Object.freeze({ credit: '신용', dollar: '달러', volatility: '변동성', breadth: '시장 폭', rates: '금리' });

/** (check, state) → the clause. `growthScare`: the rates axis held at 중립 because stocks fell with the 10-year. */
export const CROSS_MARKET_MEANING = Object.freeze({
  credit: Object.freeze({
    favorable: '기업 자금 사정이 안정적이라 주가 하락이 신용 문제로 번지지 않은 상태',
    neutral: '기업 자금 사정은 아직 버티는 중이며, 스프레드가 더 벌어지면 하락이 깊어질 수 있는 상태',
    burden: '기업이 돈 빌리는 값이 높거나 빠르게 오르는 중이라, 주식 하락이 자금 걱정으로 번질 수 있는 상태',
    unknown: '오늘 판단할 스프레드 관측이 없는 상태'
  }),
  dollar: Object.freeze({
    favorable: '달러가 약해지는 중이라 해외 매출이 큰 대형주와 신흥국 자금에 숨통이 트이는 쪽',
    neutral: '달러가 한쪽으로 크게 움직이지 않아 주식에 보태지도 덜지도 않는 상태',
    burden: '달러가 빠르게 강해지는 중이라 세계 돈줄이 조여 위험자산에 부담이 되는 쪽',
    unknown: '오늘 판단할 달러 종가가 없는 상태'
  }),
  volatility: Object.freeze({
    favorable: '옵션 시장이 큰 흔들림을 예상하지 않는 상태',
    neutral: '흔들림이 공포 구간은 아니지만 안심할 만큼 낮지도 않은 상태',
    burden: '옵션 시장이 큰 흔들림에 대비하는 중이라, 이 값이 먼저 내려와야 반등이 이어질 수 있음',
    unknown: '오늘 판단할 변동성 종가가 없는 상태'
  }),
  breadth: Object.freeze({
    favorable: '대부분 종목이 추세선 위라 지수 움직임이 넓게 받쳐지는 상태',
    neutral: '추세선 위 종목이 절반 안팎이라, 지수 움직임이 시장 전체로 퍼졌다고 보기 어려움',
    burden: '추세선 위 종목이 적어, 하락이 시장 전체로 번졌거나 소수 종목만 지수를 받치는 상태',
    unknown: '오늘 판단할 시장 폭 자료가 없는 상태'
  }),
  rates: Object.freeze({
    favorable: '10년 금리가 내려 주식 할인율 부담이 줄어드는 중',
    neutral: '10년 금리가 주식에 큰 부담을 더하지 않는 상태',
    growthScare: '10년 금리는 내렸지만 주가도 함께 빠져, 할인율 안도보다 성장 걱정 쪽',
    burden: '10년 금리가 빠르게 오르거나 높아 성장주 밸류에이션에 부담',
    unknown: '오늘 판단할 10년 금리 종가가 없는 상태'
  })
});

/** The rates row's second line: where the 2-year prices the policy path, labelled with its lean word. */
export const CROSS_MARKET_PATH_LABEL = '금리 경로';

/** Where the 2-year prices the policy path against the target midpoint (the policy axis's line), as a tag. */
export const POLICY_LEAN_WORDS = Object.freeze({ hike: '인상 반영', hold: '동결 부근', cut: '인하 반영' });

/**
 * (lean, the gap's move over about a month) → the clause: `down` the gap fell (toward cuts), `up` it rose, `flat` neither.
 * The 2-year carries term and risk premia, so the words say where the price leans, never a count of moves.
 */
export const POLICY_PATH_MEANING = Object.freeze({
  hike: Object.freeze({
    down: '인상 반영이 줄어드는 중이라, 물가가 식는 발표가 이어지면 인상 가격이 빠지고 인하 기대로 넘어갈 수 있음',
    flat: '시장은 아직 추가 인상 쪽을 가격에 두고 있어, 물가가 식는 발표가 나와야 이 부담이 풀림',
    up: '인상 반영이 커지는 중이라, 물가 발표가 뜨거우면 할인율 부담이 더해짐'
  }),
  hold: Object.freeze({
    down: '동결 부근에서 인하 쪽으로 기우는 중이라, 물가가 식으면 인하 기대가 커질 수 있음',
    flat: '동결 쪽을 가격에 둔 상태라, 다음 물가 발표가 방향을 정함',
    up: '동결 부근에서 인상 쪽으로 기우는 중이라, 물가가 뜨거우면 인상 가격이 다시 붙을 수 있음'
  }),
  cut: Object.freeze({
    down: '인하 기대가 커지는 중이며, 그 이유가 물가 안도인지 성장 걱정인지에 따라 주식에 주는 뜻이 달라짐',
    flat: '인하 기대를 가격에 둔 상태라, 물가가 다시 오르면 이 기대가 먼저 흔들림',
    up: '인하 기대가 줄어드는 중이라, 물가가 뜨거우면 할인율 부담이 돌아옴'
  })
});

/** The rebound's check mark beside a row (rebound-quality.js), named by the low it counts from. */
export const CROSS_MARKET_SINCE_LOW = '저점 뒤';
