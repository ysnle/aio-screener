// A supplied investment manuscript is projected into reusable concepts rather
// than replayed verbatim. The pack keeps the durable reasoning spine,
// page cross-links, observables, and failure boundaries; it never carries the
// manuscript title, author identity, or raw external-post references.

import { compareStableText } from './order.js';

export const INTEGRATED_MARKET_AI_FRAMEWORK_PACK_VERSION = 'integrated-market-ai-framework-pack.v1';

const clean = (value) => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
const unique = (values) => [...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))];

const definitions = [
  {
    id: 'real-vs-nominal-purchasing-power', page: 'principles', title: '명목값과 구매력의 분리',
    aliases: ['실질수익률', '실질 구매력', 'nominal vs real', 'purchasing power'],
    linkedConceptIds: ['principles:money-purchasing-power', 'principles:inflation-deflation'],
    definition: '명목 금액의 증가는 실제로 살 수 있는 양의 증가와 다를 수 있으므로, 가격·세금·지출 바구니를 반영한 실질 변화를 따로 계산한다.',
    mechanism: '명목 소득·자산수익률에서 개인 또는 경제의 물가와 비용을 빼면 구매력 변화가 드러난다. 평균 물가와 개인의 소비 바구니가 다르면 체감 결과도 달라진다.',
    observables: ['명목소득·명목수익률', '물가·주거비·세금', '실질임금·실질수익률'],
    confirmation: '명목 변화가 가격 상승을 따라잡았는지와 세후·비용후 구매력이 실제로 늘었는지를 같은 기간으로 비교한다.',
    invalidation: '명목값만으로 생활수준이나 투자 성과가 좋아졌다고 결론내리거나, 한 품목의 가격 변화를 전체 물가로 대체하면 이 프레임을 적용하지 않는다.',
    counterclaim: '물가가 올라도 생산성·임금·현금흐름이 더 빠르게 개선되는 구간에서는 실질 결과가 좋아질 수 있다.',
    question: '이 숫자는 명목·실질·세후·상대수익률 중 어느 기준이며, 적용한 비용 바구니는 무엇인가?',
    visualization: '명목 변화 − 물가·세금·비용 → 실질 구매력',
    route: { id: 'macro', metric: '실질 구매력·물가 전달', timeframe: '월간~연간' }
  },
  {
    id: 'inflation-expectations-transmission', page: 'principles', title: '물가의 관성과 기대 전달',
    aliases: ['기대 인플레이션', '물가 관성', '수요 파괴', 'inflation expectations'],
    linkedConceptIds: ['principles:inflation-deflation', 'principles:interest-central-bank'],
    definition: '인플레이션은 한 번의 가격 충격이 아니라 기대·임금·가격설정·수요가 서로 강화하는 전달 과정으로 읽어야 한다.',
    mechanism: '공급 또는 수요 충격이 가격을 올리면 사람과 기업의 기대가 임금·계약·판가에 반영되고, 실질 구매력이 약해져 수요가 줄 때까지 관성이 이어질 수 있다.',
    observables: ['기대물가', '임금·서비스 가격', '수요·마진·소비량'],
    confirmation: '가격 상승이 일회성 상대가격 변화인지, 임금·기대·서비스 물가로 확산되는지 시계열로 분리한다.',
    invalidation: '모든 물가 상승을 통화량 하나로 설명하거나 정책금리의 즉시 효과를 가정하면 전달 시차와 공급 요인을 놓친다.',
    counterclaim: '공급 충격이 해소되고 기대가 안정되면 높은 물가상승률이 빠르게 둔화할 수 있다.',
    question: '현재 물가 변화의 첫 고리는 수요·공급·환율·기대 중 어디이며, 다음 전달 고리는 무엇인가?',
    visualization: '충격 → 기대·임금·가격 → 실질수요·마진 → 정책 반응',
    route: { id: 'macro', metric: '물가·기대·수요 전달', timeframe: '월간~분기' }
  },
  {
    id: 'rates-as-time-and-money-price', page: 'principles', title: '금리는 시간과 자금의 가격',
    aliases: ['금리의 본질', '시간의 가격', '돈의 가격', 'discount rate'],
    linkedConceptIds: ['principles:interest-central-bank', 'principles:bonds-dollar-currency'],
    definition: '금리는 현재 자금과 미래 현금흐름을 교환하는 가격이며, 시간가치뿐 아니라 위험·유동성·인플레이션·기간 불확실성을 포함한다.',
    mechanism: '할인율이 오르면 먼 미래 현금흐름의 현재가치와 차입 프로젝트의 채택 가능성이 낮아진다. 정책금리와 실제 조달금리는 신용스프레드·기간 프리미엄에 따라 다를 수 있다.',
    observables: ['정책금리·시장금리', '실질금리·기대물가', '신용스프레드·기간 프리미엄'],
    confirmation: '같은 금리 변화가 현금흐름 기간·차입 구조·신용등급별로 어떻게 다른 영향을 주었는지 비교한다.',
    invalidation: '금리 상승을 모든 주식의 하락으로, 금리 인하를 모든 자금비용의 즉시 하락으로 해석하면 이익·신용·기대의 반대 경로를 빠뜨린다.',
    counterclaim: '금리 상승이 성장·생산성·이익 기대의 개선에서 왔다면 일부 자산은 할인율 부담보다 현금흐름 개선이 클 수 있다.',
    question: '이 금리는 시간가치·기대물가·신용·유동성·기간 위험 중 무엇을 반영하는가?',
    visualization: '현재 자금 ↔ 미래 현금흐름 → 할인율·조달비용',
    route: { id: 'fxbond', metric: '실질금리·시장금리·스프레드', timeframe: '일간~분기' }
  },
  {
    id: 'liquidity-credit-risk-appetite', page: 'principles', title: '유동성은 돈보다 넓은 금융조건',
    aliases: ['유동성', '신용 여력', '위험선호', 'liquidity'],
    linkedConceptIds: ['principles:credit-banks-debt', 'principles:cycles-allocation'],
    definition: '유동성은 현금량 하나가 아니라 결제 가능한 돈, 신용 여력, 담보, 시장의 위험 감수 의향이 함께 작동하는 상태다.',
    mechanism: '신용이 열리고 담보가 안정되면 같은 현금으로 더 많은 자산을 보유할 수 있어 밸류에이션과 위험선호가 확장된다. 반대로 스프레드·마진·대출기준이 악화되면 돈이 있어도 거래가 얼어붙는다.',
    observables: ['신용스프레드·대출기준', '담보·마진 조건', '위험자산 폭·시장 깊이'],
    confirmation: '통화·준비금, 은행대출, 비은행 자금, 담보와 시장 breadth를 서로 다른 층으로 관찰한다.',
    invalidation: '통화량 증가만으로 실물지출과 위험자산 상승을 단정하거나, 좁은 대형주 상승을 전체 유동성 개선으로 대체하면 실패한다.',
    counterclaim: '신용이 약해도 현금흐름이 강하고 부채가 낮은 기업은 상대적으로 방어력을 보일 수 있다.',
    question: '현재 시장을 움직이는 것은 현금·신용·담보·위험선호 중 어느 층이며, 그 층의 반전 조건은 무엇인가?',
    visualization: '돈 + 신용 + 담보 + 위험선호 → 금융조건 → 자산배분',
    route: { id: 'macro', metric: '신용·유동성·breadth', timeframe: '일간~분기' }
  },
  {
    id: 'qe-qt-financial-conditions', page: 'principles', title: 'QE·QT는 금융조건의 조정',
    aliases: ['QE', 'QT', '중앙은행 대차대조표', 'financial conditions'],
    linkedConceptIds: ['principles:interest-central-bank', 'principles:credit-banks-debt'],
    definition: '자산매입·축소는 사람에게 현금을 직접 나눠주는 행위라기보다 준비금·포트폴리오 구성·담보·기간 프리미엄을 조정하는 금융조건 변화다.',
    mechanism: '중앙은행 대차대조표의 자산과 부채 구성이 바뀌어도 은행의 대출심사와 차입자의 수요가 따라오지 않으면 실물신용으로 동일하게 전달되지 않는다.',
    observables: ['대차대조표 구성', '준비금·단기자금', '대출·채권·위험자산 조건'],
    confirmation: '매입·축소의 발표가 실제 시장금리·신용·대출·지출 중 어디까지 변했는지 전파 단계를 확인한다.',
    invalidation: '대차대조표 크기만으로 경제 전체에 유동성이 풀렸다고 말하거나, 정책 수단과 정책 효과를 동일시하면 실패한다.',
    counterclaim: '시장 신뢰와 재정·신용 조건이 함께 움직이면 같은 대차대조표 변화가 더 큰 자산가격 효과를 만들 수 있다.',
    question: '정책 수단의 변화가 준비금·신용·위험선호·실물지출 중 어디까지 도달했는가?',
    visualization: '중앙은행 자산 → 준비금·기간 프리미엄 → 신용·포트폴리오 → 지출',
    route: { id: 'macro', metric: '정책·금융조건 전달', timeframe: '주간~분기' }
  },
  {
    id: 'yield-decomposition-and-curve-cause', page: 'principles', title: '수익률곡선은 모양보다 원인',
    aliases: ['수익률곡선', '장단기 금리', '기간 프리미엄', 'term premium'],
    linkedConceptIds: ['principles:bonds-dollar-currency', 'principles:interest-central-bank'],
    definition: '장기 국채금리는 기대 실질금리·기대 인플레이션·기간 프리미엄의 합으로 분해해 읽어야 하며, 곡선의 모양만으로 경기 결론을 내리지 않는다.',
    mechanism: '단기 구간은 정책 기대에 민감하고 장기 구간은 성장·물가·재정 공급·해외수요·기간 프리미엄에 민감하다. 같은 스티프닝도 경기회복과 재정 리스크를 구분해야 한다.',
    observables: ['2년·10년 등 만기별 금리', '실질금리·기대물가', '국채 공급·해외수요·경매'],
    confirmation: '곡선 변화가 정책 기대 변화인지 장기 공급·물가·기간 프리미엄 변화인지 원인별로 분해한다.',
    invalidation: '역전은 자동으로 경기침체, 스티프닝은 자동으로 경기회복이라고 고정하면 원인과 시차를 놓친다.',
    counterclaim: '제도·국가·시점에 따라 같은 곡선 신호가 다른 결과를 가질 수 있다.',
    question: '이번 곡선 변화의 주된 변수는 기대금리·실질성장·물가·공급·기간 프리미엄 중 무엇인가?',
    visualization: '장기금리 = 기대 실질금리 + 기대물가 + 기간 프리미엄',
    route: { id: 'fxbond', metric: '수익률곡선·기간 프리미엄', timeframe: '일간~10년' }
  },
  {
    id: 'collateral-trust-feedback', page: 'principles', title: '담보와 신뢰의 피드백',
    aliases: ['담보', '금융 신뢰', '마진콜', 'collateral feedback'],
    linkedConceptIds: ['principles:credit-banks-debt', 'principles:bonds-dollar-currency'],
    definition: '금융은 계약과 신뢰의 네트워크이며, 담보가격 하락은 마진·강제매도·신용회수를 통해 가격 하락을 증폭할 수 있다.',
    mechanism: '담보가치가 낮아지면 추가 증거금이나 자산 매도가 요구되고, 매도는 다시 담보가치를 낮춘다. 유동성 문제와 장기 지급능력 문제는 별도로 진단해야 한다.',
    observables: ['담보가격·헤어컷', '마진·대출기준', '자금시장·강제매도·신용손실'],
    confirmation: '충격의 첫 고리가 가격·현금조달·담보·만기 중 어디인지와 손실의 금융기관 자본 전이 경로를 확인한다.',
    invalidation: '가격 하락 하나만으로 지급불능을 선언하거나, 장기적으로 건전한 자산과 단기 유동성 문제를 구분하지 않으면 실패한다.',
    counterclaim: '충분한 현금 버퍼·만기 분산·중앙청산·대응 가능한 담보는 피드백을 완충한다.',
    question: '이 충격은 유동성·담보·지급능력 중 어느 문제이며, 강제매도를 유발할 계약 조건은 무엇인가?',
    visualization: '담보 하락 → 마진·회수 → 강제매도 → 가격·신뢰 추가 하락',
    route: { id: 'fxbond', metric: '담보·신용·금융스트레스', timeframe: '일간~분기' }
  },
  {
    id: 'leverage-survival-optionality', page: 'principles', title: '레버리지는 생존과 선택권의 문제',
    aliases: ['레버리지', '포지션 사이징', '생존 우선', 'survival optionality'],
    linkedConceptIds: ['principles:investment-risk', 'principles:credit-banks-debt'],
    definition: '레버리지는 수익률을 확대하는 도구이지만, 잘못된 가설을 기다릴 시간과 다음 선택권을 함께 줄인다.',
    mechanism: '고정 이자·원금·담보 요구가 변동하는 영업현금흐름 위에 놓이면 작은 실적 변화가 자기자본과 청산 가능성을 크게 바꾼다.',
    observables: ['이자보상배율·순부채', '만기·담보·마진', '최대손실·현금버퍼'],
    confirmation: '기본 시나리오가 틀렸을 때도 포지션과 자금구조가 버틸 수 있는지 먼저 계산한다.',
    invalidation: '높은 ROE나 과거 수익률을 운용 능력으로만 해석하고 부채가 만든 확대 효과를 분리하지 않으면 실패한다.',
    counterclaim: '현금흐름이 안정적이고 만기가 분산된 레버리지는 자본비용을 낮추면서 생산적 투자를 지원할 수 있다.',
    question: '매출·마진·금리가 불리하게 움직여도 강제매도 없이 가설을 검증할 시간이 남는가?',
    visualization: '영업현금흐름 ↔ 고정상환·담보 → 자기자본·선택권',
    route: { id: 'portfolio', metric: '낙폭·비중·상관·현금', timeframe: '월간~연간' }
  },
  {
    id: 'price-value-expectation-gap', page: 'principles', title: '가격·가치·기대의 간격',
    aliases: ['가격과 가치', '실적 서프라이즈', '기대 대비', 'price value expectations'],
    linkedConceptIds: ['principles:company-stock-valuation', 'principles:market-price-discovery'],
    definition: '좋은 산업·좋은 기업·좋은 주식·좋은 매수가격은 서로 다른 판단이며, 가격은 절대 실적보다 기대 대비 변화를 반영한다.',
    mechanism: '실적과 가이던스가 좋아도 이미 더 높은 기대가 가격에 반영돼 있으면 주가는 하락할 수 있다. 가격과 가치의 간격은 할인율·성장률·확률의 함수다.',
    observables: ['컨센서스·가이던스·추정치 수정', 'FCF·마진·성장 질', '멀티플·할인율·가격 반응'],
    confirmation: '실제 결과, 사전 기대, 다음 기간의 수정 방향을 같은 기준으로 비교한다.',
    invalidation: '좋은 뉴스=상승, 나쁜 뉴스=하락이라는 단순 규칙이나 산업 성장=주주수익이라는 등식을 적용하면 실패한다.',
    counterclaim: '강한 이익·주문·현금흐름 개선이 계속 기대를 갱신하면 높은 가격도 추세로 유지될 수 있다.',
    question: '현재 가격에는 어떤 성장·마진·금리 기대가 이미 포함돼 있으며, 그 기대를 바꿀 새 정보는 무엇인가?',
    visualization: '실제 결과 − 가격에 반영된 기대 → 서프라이즈·재평가',
    route: { id: 'fundamental', metric: '기대·실적·밸류에이션', timeframe: '분기~다년' }
  },
  {
    id: 'roic-cost-capital-fcf', page: 'principles', title: '성장보다 ROIC와 현금흐름',
    aliases: ['ROIC', '자본비용', 'FCF', '성장 질'],
    linkedConceptIds: ['principles:company-stock-valuation', 'principles:industry-value-chain'],
    definition: '성장은 자본을 얼마나 더 투입했는지와 그 자본이 비용을 웃도는 현금수익을 만드는지를 함께 볼 때 경제적 가치가 된다.',
    mechanism: '가격·물량·마진·가동률·재투자를 연결해 ROIC와 FCF를 계산하면 외형 성장과 주주가치 창출을 분리할 수 있다.',
    observables: ['매출 성장·가격·물량', '영업마진·CAPEX·운전자본', 'ROIC·WACC·FCF'],
    confirmation: '추가 자본 1단위가 비용을 초과하는 현금흐름을 만들고, 그 수익성이 경쟁 진입 뒤에도 유지되는지 확인한다.',
    invalidation: '매출·사용자·CAPEX 증가만으로 기업가치를 확정하거나 회계이익을 현금흐름으로 대체하면 실패한다.',
    counterclaim: '초기 투자가 크더라도 높은 진입장벽과 가동률 상승이 자본수익률을 후행적으로 끌어올릴 수 있다.',
    question: '이 성장의 추가 자본은 언제 어떤 현금흐름으로 회수되며, 그 수익률은 자본비용을 넘는가?',
    visualization: '수요·가격·마진·CAPEX → FCF·ROIC ↔ 자본비용',
    route: { id: 'fundamental', metric: 'ROIC·FCF·자본비용', timeframe: '분기~다년' }
  },
  {
    id: 'cash-as-opportunity-cost', page: 'principles', title: '현금은 대기자산이 아니라 선택권',
    aliases: ['현금의 역할', '기회비용', 'cash option', 'opportunity cost'],
    linkedConceptIds: ['principles:investment-risk', 'principles:company-stock-valuation'],
    definition: '현금은 수익률이 없는 잔여물이 아니라 미래의 더 나은 기회와 손실 회피를 살 수 있는 선택권이며, 보유에도 기회비용이 있다.',
    mechanism: '현금의 역할은 투자 기간·실질금리·변동성·필요한 지출과 비교해야 한다. 모든 자금을 즉시 투자하면 가격·리스크·현금흐름이 불리할 때 선택권을 잃는다.',
    observables: ['현금의 실질수익률', '예상수익·변동성·낙폭', '필요지출·투자기간·재진입 조건'],
    confirmation: '현금 보유와 투자 보유의 기회비용을 세후·실질·위험조정 기준으로 비교한다.',
    invalidation: '현금은 항상 나쁘거나 항상 안전하다고 일반화하고, 개인의 시간축과 유동성 수요를 제거하면 실패한다.',
    counterclaim: '장기 투자에서 충분히 높은 기대수익과 감내 가능한 변동성이 있다면 과도한 현금은 복리를 훼손할 수 있다.',
    question: '이 현금은 어떤 지출·위험·재진입 기회를 보장하며, 그 옵션의 가격은 얼마인가?',
    visualization: '현금 → 생존·대기·재진입 선택권 ↔ 기대수익·기회비용',
    route: { id: 'portfolio', metric: '현금·비중·기회비용', timeframe: '월간~연간' }
  },
  {
    id: 'risk-driver-diversification-and-compounding', page: 'principles', title: '종목 수가 아닌 위험요인 분산',
    aliases: ['위험요인 분산', '손실의 비대칭성', '복리와 손실', 'risk factor diversification'],
    linkedConceptIds: ['principles:investment-risk', 'principles:cycles-allocation'],
    definition: '분산은 종목 개수가 아니라 금리·경기·환율·신용·공급망처럼 손실을 만드는 공통 요인을 나누는 설계다.',
    mechanism: '큰 손실은 같은 위험요인에 노출된 자산의 상관관계를 높이고 복리 기반을 훼손한다. 포지션 크기·현금·상관·최대낙폭을 함께 설계해야 한다.',
    observables: ['위험요인별 노출', '위기 시 상관·유동성', '최대낙폭·회복기간·재투자 가능성'],
    confirmation: '평상시 상관뿐 아니라 스트레스 구간의 동조화와 포지션별 손실 기여도를 점검한다.',
    invalidation: '보유 종목이 많다는 이유로 분산됐다고 가정하거나, 손실률과 회복에 필요한 수익률의 비대칭을 무시하면 실패한다.',
    counterclaim: '위험요인이 충분히 다르고 현금흐름이 분리된 집중은 무작위 다분산보다 효율적일 수 있다.',
    question: '같은 충격이 왔을 때 무엇이 동시에 무너지는가, 그리고 포트폴리오가 다음 기회를 남기는가?',
    visualization: '위험요인 → 상관·낙폭 → 생존 → 복리 재개',
    route: { id: 'portfolio', metric: '위험요인·상관·낙폭', timeframe: '월간~연간' }
  },
  {
    id: 'agent-workflow-productivity', page: 'atlas', title: '챗봇에서 에이전트로: 생산성의 단위',
    aliases: ['에이전트', '디지털 노동', '업무 자동화', 'agent workflow productivity'],
    linkedConceptIds: ['atlas:application-finance', 'atlas:application-manufacturing', 'atlas:application-roi-payer'],
    definition: 'AI의 경제적 단위는 답변 한 번이 아니라 목표 설정부터 도구 사용·검증·완료까지 이어지는 업무 workflow가 될 수 있다.',
    mechanism: '단순 생성은 부분 시간을 줄이지만, 에이전트는 데이터·권한·도구·예외처리와 책임 구조를 포함한 전체 업무 단위를 바꾼다. 생산성 효과는 모델 성능만이 아니라 도입·검증 비용에서 결정된다.',
    observables: ['업무 완료율·처리시간', '오류·사람 개입·보안 비용', '인건비·매출·도입률'],
    confirmation: '시연이나 benchmark가 아니라 기존 workflow 대비 실제 처리량·오류·비용·책임 구조의 변화를 측정한다.',
    invalidation: '모델이 여러 단계를 수행한다는 사실을 곧바로 경제 전체의 생산성이나 인력 대체로 확대하면 실패한다.',
    counterclaim: '예외처리·보안·감독 비용이 크면 자동화율이 높아도 순생산성은 낮거나 도입이 지연될 수 있다.',
    question: 'AI가 대체·보완하는 업무 단위는 무엇이며, 사람 검토와 운영비를 뺀 순효과는 얼마인가?',
    visualization: '목표 → 도구·데이터 → 다단계 실행 → 검증·인계 → 업무 단위 생산성',
    route: { id: 'fundamental', metric: 'workflow·생산성·인건비', timeframe: '분기~다년' }
  },
  {
    id: 'inference-economics-and-rebound', page: 'atlas', title: '학습에서 추론으로: 효율과 수요의 반동',
    aliases: ['추론 경제성', '추론 비용', '제번스의 역설', 'inference economics'],
    linkedConceptIds: ['atlas:compute-gpu', 'atlas:compute-asic', 'atlas:economics-revenue-model', 'atlas:power-it-load'],
    definition: 'AI 서비스가 확장될수록 일회성 학습보다 요청·작업·로봇 판단마다 반복되는 추론 비용과 처리 단가가 중요해진다.',
    mechanism: '전용칩·모델 경량화·소프트웨어 최적화가 작업당 비용을 낮추면 마진이 좋아질 수 있지만, 가격 하락이 사용량을 폭발시켜 총 컴퓨트·전력 수요를 오히려 늘릴 수 있다.',
    observables: ['요청·작업당 비용·전력', '모델 가격·사용량·지연', 'ASIC·TPU·NPU와 GPU의 workload 적합성'],
    confirmation: '성능 순위보다 동일한 결과를 만드는 작업당 원가·전력·가동률과 가격 인하 뒤 총사용량을 확인한다.',
    invalidation: '추론 단가 하락을 인프라 수요 감소로, 최고 benchmark를 서비스 경제성으로 바로 치환하면 실패한다.',
    counterclaim: '가격 탄력성이 낮거나 사용량이 포화되면 효율 개선이 총수요 확대가 아니라 전력·비용 절감으로 남을 수 있다.',
    question: '이 효율 개선은 단위 마진을 높이는가, 아니면 더 큰 사용량을 불러 총자원 수요를 키우는가?',
    visualization: '모델·칩 효율 → 작업당 비용 하락 → 가격·사용량 변화 → 총수요·마진',
    route: { id: 'fundamental', metric: '추론 원가·사용량·마진', timeframe: '분기~다년' }
  },
  {
    id: 'system-throughput-and-data-movement', page: 'atlas', title: 'GPU가 아닌 시스템 처리량',
    aliases: ['메모리 병목', '데이터 이동', 'HBM 대역폭', '시스템 경쟁'],
    linkedConceptIds: ['atlas:memory-dram-hbm', 'atlas:network-fabric', 'atlas:network-optical-module', 'atlas:compute-interconnect'],
    definition: 'AI 시스템의 성능과 비용은 계산 칩 하나가 아니라 계산·메모리·인터커넥트·네트워크·스토리지·소프트웨어가 함께 만드는 처리량이다.',
    mechanism: '파라미터·KV cache·에이전트 상태를 제때 이동하지 못하면 가속기가 유휴 상태가 되고, 대역폭·지연·전력·패키징 제약이 전체 가동률과 추론 단가를 결정한다.',
    observables: ['메모리 용량·대역폭·사용률', '서버·랙 간 지연·통신', '가속기 유휴·처리량·전력당 성능'],
    confirmation: '부품의 사양보다 실제 workload에서 병목이 계산·메모리·통신·스토리지 중 어디인지와 다음 제약으로의 이동을 확인한다.',
    invalidation: 'GPU 공급량이나 FLOPS만으로 서비스 capacity와 기업의 가격결정력을 추정하면 실패한다.',
    counterclaim: '모델 구조·batching·압축·소프트웨어 최적화가 하드웨어 증설 없이 유효 처리량을 크게 높일 수 있다.',
    question: '비싼 가속기가 놀고 있지 않게 만드는 가장 좁은 제약은 무엇이며, 그 제약은 얼마나 대체 가능한가?',
    visualization: 'workload → compute·memory·network·storage → 유효 처리량·추론 원가',
    route: { id: 'themes', metric: 'HBM·네트워크·시스템 처리량', timeframe: '분기~다년' }
  },
  {
    id: 'power-as-compute-input', page: 'atlas', title: '전력은 컴퓨트의 외부 조건이 아니다',
    aliases: ['전력의 전략자원화', '전력과 컴퓨트', '변압기 병목', 'power as compute'],
    linkedConceptIds: ['atlas:power-it-load', 'atlas:power-generation', 'atlas:power-transmission', 'atlas:power-transformer'],
    definition: 'AI 데이터센터에서 전력·냉각·변전·송전·접속은 장비 바깥의 비용이 아니라 실제로 가동 가능한 컴퓨트의 일부다.',
    mechanism: '서버를 확보해도 전력 인입·변압기·스위치기어·냉각·계통 접속이 없으면 처리량이 발생하지 않는다. 전력의 위치·계약기간·품질·리드타임이 입지와 자본배분을 바꾼다.',
    observables: ['IT load·PUE·열밀도', '발전·송전·변압기·접속 대기', '전력계약·가동 용량·냉각비'],
    confirmation: '전력 수요 전망을 서버 수가 아니라 지역별 접속 가능 용량·공사 일정·가동률·단위당 전력으로 검증한다.',
    invalidation: '데이터센터 발표나 서버 구매를 즉시 서비스 capacity로 환산하고 전력망·냉각 제약을 생략하면 실패한다.',
    counterclaim: '효율 개선·부하 이동·현장 발전·저장·기존 유휴 전력은 같은 장비에서 더 많은 유효 compute를 만들 수 있다.',
    question: '이 프로젝트의 실제 병목은 칩인가, 전력·냉각·변압기·접속인가?',
    visualization: '가속기 → IT load·열 → 냉각·배전·계통 → 가동 가능한 compute',
    route: { id: 'themes', metric: '전력·냉각·계통·가동 용량', timeframe: '분기~다년' }
  },
  {
    id: 'ai-capex-financing-and-credit', page: 'atlas', title: 'AI CAPEX와 신용시장',
    aliases: ['AI 자금조달', '회사채와 AI', '고객 선급금', 'AI capex financing'],
    linkedConceptIds: ['atlas:economics-capex', 'atlas:economics-fcf', 'atlas:economics-roic', 'principles:credit-banks-debt'],
    definition: 'AI 인프라 투자는 기업의 보유 현금만이 아니라 회사채·고객 선급금·장비 금융·프로젝트 금융·사모신용을 통해 자본시장과 연결된다.',
    mechanism: '투자 규모가 커질수록 자산을 누가 보유하고, 누가 먼저 돈을 내며, 만기·금리·담보·사용량 위험을 누가 부담하는지가 사업의 현금흐름과 금융안정을 결정한다.',
    observables: ['CAPEX·부채·이자비용', '회사채 스프레드·만기·담보', '고객 선급금·리스·프로젝트 금융·FCF'],
    confirmation: 'CAPEX를 매출의 선행지표로 쓰기 전에 자금 출처·상환 현금흐름·자산 수명·재융자 위험을 함께 확인한다.',
    invalidation: '투자액이나 백로그를 주주가치로 바로 환산하고 조달비용·선급금의 조건·부채 만기를 숨기면 실패한다.',
    counterclaim: '장기 계약·고객 선급금·높은 가동률이 자산의 현금 회수를 보장하면 외부 자금이 성장 속도를 높일 수 있다.',
    question: '이 CAPEX의 비용·자산·신용위험은 누가 부담하고, 자본비용보다 높은 현금수익으로 언제 회수되는가?',
    visualization: 'CAPEX → 현금·채권·선급금·프로젝트 금융 → 자산·사용량 → FCF·상환',
    route: { id: 'fxbond', metric: 'AI CAPEX·회사채·신용스프레드', timeframe: '분기~다년' }
  },
  {
    id: 'ai-moat-strength-or-erosion', page: 'atlas', title: 'AI는 해자를 강화하기도 없애기도 한다',
    aliases: ['AI 해자', '해자 훼손', 'SaaS 대체', 'AI moat erosion'],
    linkedConceptIds: ['atlas:economics-revenue-model', 'atlas:application-finance', 'atlas:application-manufacturing', 'atlas:future-uncertainty-gate'],
    definition: 'AI와 기업의 관계는 인프라를 파는 기업, 기존 제품의 가치를 높이는 기업, 기존 가격과 사용자를 빼앗길 기업으로 나누어 읽어야 한다.',
    mechanism: '모델의 범용화와 가격 하락은 소프트웨어 기능의 차별성을 약화시킬 수 있지만, 데이터·workflow·배포·신뢰·규제·현장 통합은 해자를 강화할 수도 있다.',
    observables: ['고객 유지·사용량·가격', '기능 대체·경쟁 제품·마진', '데이터·workflow·배포·통합 비용'],
    confirmation: 'AI 도입 뒤 고객이 더 오래 머무르고 더 많이 지불하는지, 또는 기존 기능의 가격·시간·마진이 잠식되는지 확인한다.',
    invalidation: 'AI라는 테마만으로 모든 소프트웨어를 수혜자로 보거나 모델 공개를 곧바로 기존 기업의 붕괴로 해석하면 실패한다.',
    counterclaim: '범용 모델이 기능을 대체해도 규제·업무 통합·데이터 품질·책임 부담이 기존 사업자의 방어력을 유지할 수 있다.',
    question: 'AI는 이 기업의 고객가치·가격결정력·전환비용을 높이는가, 아니면 기존에 받던 가격을 낮추는가?',
    visualization: 'AI 능력 → 기능 대체·제품 강화 → 고객가치·가격·마진 → 해자 강화 또는 침식',
    route: { id: 'fundamental', metric: '매출·유지율·마진·해자', timeframe: '분기~다년' }
  },
  {
    id: 'financial-vs-physical-capital-speed', page: 'atlas', title: '금융 자본과 물리 자본의 속도 차이',
    aliases: ['금융자본 속도', '물리적 자본', 'financial vs physical capital', '건설 리드타임'],
    linkedConceptIds: ['atlas:economics-capex', 'atlas:power-interconnection', 'atlas:compute-gpu'],
    definition: '금융자본은 빠르게 약속·배분될 수 있지만 전력·공장·네트워크·허가 같은 물리 자본은 긴 건설·검증 시간을 요구한다.',
    mechanism: '수요와 자금이 먼저 몰려도 물리적 공급은 납기·허가·계통·수율을 거쳐야 한다. 이 시간차가 병목의 가격과 초과이익을 만든다.',
    observables: ['CAPEX 계획·납기', '허가·계통 접속·공사', '설치 용량과 실제 가동 용량'],
    confirmation: '발표된 자금·주문·서버 수와 실제 전력 인입·가동·사용량을 시간축별로 대조한다.',
    invalidation: '발표된 투자액을 즉시 생산능력·매출로 환산하거나, 설치와 가동을 같은 것으로 보면 실패한다.',
    counterclaim: '기존 유휴 용량·모듈형 장비·효율 개선은 물리적 공급 반응을 예상보다 빠르게 만들 수 있다.',
    question: '현재 제약은 돈이 부족해서인가, 아니면 건설·접속·수율·가동까지의 물리 시간이 부족해서인가?',
    visualization: '수요·금융 → 물리 투자·허가·납기 → 가동 가능한 capacity',
    route: { id: 'atlas', metric: 'CAPEX·전력·가동 용량', timeframe: '분기~다년' }
  },
  {
    id: 'bottleneck-duration-substitutability', page: 'atlas', title: '병목의 지속기간과 대체 가능성',
    aliases: ['병목 지속기간', '대체 가능성', 'scarcity duration', 'bottleneck'],
    linkedConceptIds: ['atlas:memory-dram-hbm', 'atlas:power-transformer', 'atlas:foundry-capacity-yield'],
    definition: '병목은 현재 부족하다는 사실만으로 영구적인 가치가 되지 않으며, 지속기간·대체재·증설 가능성을 함께 봐야 한다.',
    mechanism: '한 제약이 완화되면 수요와 이익은 다음 제약으로 이동한다. 진입장벽이 낮고 증설이 빠르면 가격 신호가 공급 확장을 불러 초과마진이 줄어든다.',
    observables: ['lead time·재고', '대체 기술·공급자', '증설 계획·수율·가격'],
    confirmation: '병목의 위치뿐 아니라 얼마나 오래 유지될지와 다른 공정·제품·지역으로 대체될 수 있는지를 확인한다.',
    invalidation: '현재 희소성을 영구적 독점으로, 또는 공급 증가를 즉시 과잉으로 단정하면 실패한다.',
    counterclaim: '인증·수율·안전·전력 같은 비가격 제약은 단순 증설보다 오래 지속될 수 있다.',
    question: '이 병목은 언제 풀리고, 풀릴 때 수요·마진·가치가 어느 인접 단계로 이동하는가?',
    visualization: '수요 → 병목 → 가격·마진 → 증설·대체 → 다음 병목',
    route: { id: 'themes', metric: '산업 병목·공급 반응', timeframe: '분기~다년' }
  },
  {
    id: 'capital-cycle-supply-response', page: 'atlas', title: 'AI 인프라의 자본 사이클',
    aliases: ['자본 사이클', '과잉공급', 'capacity cycle', 'capital cycle'],
    linkedConceptIds: ['atlas:foundry-capacity-yield', 'atlas:economics-capex', 'atlas:economics-roic'],
    definition: '수요 급증과 공급 지연은 높은 가격·마진을 만들고, 그 신호가 자본을 끌어들인 뒤 공급 과잉과 수익률 하락으로 이어질 수 있다.',
    mechanism: '수요 증가→공급 부족→마진 확대→경쟁 CAPEX→재고·가격 하락의 순환을 주문 취소·납기·재고·가동률·수율로 관찰한다.',
    observables: ['경쟁사 CAPEX·capacity', '재고·주문 취소·가격', '가동률·마진·ROIC'],
    confirmation: '수요가 강하다는 서사보다 공급 확장의 누적 속도와 가격·마진·가동률의 선행 변화를 함께 확인한다.',
    invalidation: '부족한 현재 가격을 미래 이익으로 고정하거나, CAPEX 증가만으로 지속 가능한 수요를 확정하면 실패한다.',
    counterclaim: '수요가 공급 확장보다 더 빠르게 증가하거나 인증·기술 격차가 유지되면 사이클의 고점이 늦어질 수 있다.',
    question: '현재 이익은 구조적 경쟁력인가, 공급이 따라오기 전의 일시적 희소성 보상인가?',
    visualization: '수요 급증 → 공급 지연 → 초과마진 → CAPEX → 과잉·마진 정상화',
    route: { id: 'themes', metric: 'capacity·재고·마진·ROIC', timeframe: '분기~다년' }
  },
  {
    id: 'ai-value-chain-to-cashflow', page: 'atlas', title: 'AI 가치사슬에서 현금흐름까지',
    aliases: ['AI 가치사슬', '이익 풀', 'value chain cashflow', '병목의 다음 단계'],
    linkedConceptIds: ['atlas:compute-gpu', 'atlas:memory-dram-hbm', 'atlas:power-it-load', 'atlas:economics-fcf'],
    definition: 'AI는 모델 하나가 아니라 workload가 계산·메모리·패키징·네트워크·전력·응용 서비스로 번역되는 가치사슬이다.',
    mechanism: '수요의 형태가 필요한 부품과 시설을 정하고, 각 단계의 가격·수율·가동률·고객 집중·자본비용이 매출을 FCF로 전환하는 정도를 결정한다.',
    observables: ['workload·처리량·지연', '공급·수율·전력·가동률', '매출·마진·CAPEX·FCF'],
    confirmation: '수요의 출발점에서 병목을 지나 어느 기업의 현금흐름으로 번역되는지 단계별로 확인한다.',
    invalidation: '인접 산업이라는 이유만으로 수혜를 부여하거나, 최종 수요를 중간재 매출과 동일시하면 실패한다.',
    counterclaim: '가치사슬의 한 단계가 가격을 잃어도 효율 개선·수요 확장·서비스 반복매출이 다른 단계의 가치를 키울 수 있다.',
    question: '이 수요는 가치사슬의 어느 단계에서 가격결정력을 만들고, 실제 FCF로 언제 남는가?',
    visualization: 'workload → compute·memory·network·power → service → margin·FCF',
    route: { id: 'themes', metric: 'AI 가치사슬·현금흐름', timeframe: '분기~다년' }
  },
  {
    id: 'buildout-inflation-longrun-deflation', page: 'atlas', title: 'AI 구축 인플레이션과 장기 디플레이션',
    aliases: ['AI 인플레이션', '구축 사이클', '장기 디플레이션', 'buildout inflation'],
    linkedConceptIds: ['atlas:power-generation', 'atlas:power-it-load', 'atlas:economics-revenue-model'],
    definition: 'AI는 구축기에는 전력·구리·변압기·메모리·냉각·건설 수요를 자극할 수 있지만, 성숙기에는 자동화와 효율 향상으로 비용을 낮출 수 있다.',
    mechanism: '단기 공급 제약과 장기 생산성 효과가 서로 다른 시간축에 놓인다. 둘을 섞으면 구축 인플레이션을 영구적 물가 상승 또는 즉시 디플레이션으로 오해한다.',
    observables: ['인프라 투입재 가격·납기', '전력·가동률·효율', '서비스 가격·단위 원가·생산성'],
    confirmation: '구축 단계의 물리적 투입비용과 운영 단계의 요청당 비용·생산성 개선을 각각 측정한다.',
    invalidation: '장기 기술 효과를 당장 물가에 적용하거나, 구축기 가격 상승을 AI의 영구적 인플레이션으로 해석하면 실패한다.',
    counterclaim: '효율 개선이 빠르더라도 사용량이 더 빠르게 늘면 총자원 수요와 비용은 계속 커질 수 있다.',
    question: '지금 관측하는 가격 변화는 구축 수요의 일시적 병목인가, 운영 효율과 총사용량의 장기 변화인가?',
    visualization: '구축 수요·물리 병목 → 단기 비용 상승 ↔ 운영 효율·생산성 → 장기 단위원가',
    route: { id: 'macro', metric: 'AI CAPEX·전력·생산성', timeframe: '분기~다년' }
  },
  {
    id: 'monetization-and-unit-economics', page: 'atlas', title: 'AI의 수익화는 사용량보다 지불 구조',
    aliases: ['AI 수익화', '단위경제성', 'cost-to-serve', 'who pays'],
    linkedConceptIds: ['atlas:economics-revenue-model', 'atlas:economics-fcf', 'atlas:physical-ai-unit-economics'],
    definition: '기술적 가치와 주주수익은 다르며, AI의 수익화는 누가 어떤 workflow에 얼마를 지불하고 서비스 원가를 누가 부담하는지로 검증한다.',
    mechanism: '요청·사용자·GPU시간·작업 단위의 가격에서 추론·데이터·지원·전력·감가상각 비용을 빼야 기여이익과 확장 가능성이 보인다.',
    observables: ['고객 지불·유지율', '요청당 원가·지원비', 'gross margin·contribution·FCF'],
    confirmation: '사용량 증가가 반복매출·단위 기여·현금흐름으로 전환되는지 고객군·workflow별로 나눈다.',
    invalidation: '벤치마크·시연·사용자 수를 매출과 이익으로 대체하거나, 원가가 감소할 것이라는 가정만으로 수익화를 확정하면 실패한다.',
    counterclaim: '초기 단위경제성이 약해도 가격·모델 효율·가동률·고객 락인 개선이 후행적으로 마진을 만들 수 있다.',
    question: '누가 지불하며, 추가 사용 1단위의 매출과 원가·지원·자본 부담은 어떻게 변하는가?',
    visualization: '고객 workflow → 사용량·가격 − 추론·지원·인프라 원가 → 기여이익·FCF',
    route: { id: 'fundamental', metric: '단위경제성·매출·FCF', timeframe: '분기~다년' }
  },
  {
    id: 'capex-utilization-depreciation-fcf', page: 'atlas', title: 'CAPEX·가동률·감가상각·FCF 연결',
    aliases: ['가동률', '감가상각', 'CAPEX와 FCF', 'utilization depreciation'],
    linkedConceptIds: ['atlas:economics-capex', 'atlas:economics-depreciation', 'atlas:cloud-utilization', 'atlas:economics-fcf'],
    definition: '설비투자는 먼저 현금을 사용하고 이후 가동률·가격·수명·감가상각·재투자 필요를 통해 현금흐름과 ROIC로 돌아온다.',
    mechanism: '설치된 자산이 실제 workload를 처리하지 못하면 고정비 흡수와 FCF가 약해진다. 회계상 감가상각과 현금 CAPEX의 시점을 분리해야 한다.',
    observables: ['CAPEX·리스·감가상각', 'usable capacity·가동률·유휴', '매출·마진·FCF·재투자'],
    confirmation: '명목 capacity가 아니라 usable output과 가동률, 자산 수명, 유지·교체 CAPEX를 같은 기간에 놓는다.',
    invalidation: 'CAPEX가 많으면 수요가 강하다고 보거나, 감가상각비만으로 현금 부담을 계산하면 실패한다.',
    counterclaim: '초기 유휴가 있더라도 장기 계약·높은 수요·효율 개선으로 가동률과 현금 전환이 상승할 수 있다.',
    question: '새 자산이 언제 어느 가동률에서 투자비·감가상각·자본비용을 넘어서는 현금을 만드는가?',
    visualization: 'CAPEX 현금 유출 → usable capacity·가동률 → 감가상각·마진 → FCF·재투자',
    route: { id: 'fundamental', metric: 'CAPEX·가동률·FCF·ROIC', timeframe: '분기~다년' }
  },
  {
    id: 'liquidity-concentration-flow-reversal', page: 'atlas', title: 'AI 유동성 집중과 되돌림',
    aliases: ['유동성 집중', 'flow concentration', '대형주 쏠림', '자금 되돌림'],
    linkedConceptIds: ['atlas:economics-capex', 'atlas:economics-revenue-model', 'principles:cycles-allocation'],
    definition: '큰 자금은 소수의 플랫폼·반도체·전력·데이터센터 관련 자산으로 집중될 수 있으며, 유입은 내재가치의 증명이 아니다.',
    mechanism: '패시브·테마·성장 기대가 좁은 종목군의 멀티플과 자금 흐름을 끌어올리지만, 기대·금리·리밸런싱이 반전되면 흐름도 빠르게 되돌아갈 수 있다.',
    observables: ['시장 breadth·집중도', '자금 유입·거래량·멀티플', '이익·주문·현금흐름의 폭'],
    confirmation: '자금 유입과 실제 이익·주문·현금흐름의 확산이 함께 일어나는지 비교한다.',
    invalidation: '유입액만으로 장기 가치나 안전성을 확정하거나, 대형주 상승을 산업 전체의 건강으로 대체하면 실패한다.',
    counterclaim: '실제 생산성·이익 확산이 동반되면 초기 집중은 구조적 승자 형성 과정일 수 있다.',
    question: '현재 가격을 지탱하는 것은 폭넓은 현금흐름인가, 좁은 흐름과 기대인가?',
    visualization: '기대·패시브 흐름 → 소수 자산 집중 → 멀티플·breadth → 이익 검증 또는 되돌림',
    route: { id: 'themes', metric: '집중도·breadth·자금 흐름', timeframe: '일간~분기' }
  },
  {
    id: 'labor-productivity-distribution', page: 'atlas', title: 'AI 생산성의 귀속과 노동 충격',
    aliases: ['AI 노동시장', '생산성의 귀속', '임금과 이익', 'labor displacement'],
    linkedConceptIds: ['atlas:application-manufacturing', 'atlas:application-finance', 'atlas:application-roi-payer'],
    definition: 'AI의 생산성 효과는 기술 성능만으로 결정되지 않고, 이익·임금·가격 인하 중 누가 gains를 가져가는지에 따라 경제와 기업가치가 달라진다.',
    mechanism: '자동화·보완은 업무 단위의 산출과 비용을 바꾸지만, 경쟁·노동 공급·규제·조직 전환이 그 효과의 분배와 수요를 결정한다.',
    observables: ['업무별 처리량·오류·인건비', '임금·고용·마진', '가격·수요·도입률'],
    confirmation: '모델 성능이 아니라 실제 workflow의 비용절감·산출·고용·가격 전가를 확인한다.',
    invalidation: '일자리 대체 또는 생산성 향상을 총량 하나로 단정하고 분배·전환 비용을 무시하면 실패한다.',
    counterclaim: '새로운 수요와 보완 직무가 빠르게 생기면 총고용과 소비 여력이 늘어날 수 있다.',
    question: 'AI로 생긴 생산성 이득은 이익·임금·가격 중 어디에 귀속되고, 그 귀속이 지속될 조건은 무엇인가?',
    visualization: 'AI 도입 → 업무 산출·비용 → 이익·임금·가격의 분배 → 수요 재순환',
    route: { id: 'macro', metric: '생산성·임금·고용·마진', timeframe: '분기~다년' }
  },
  {
    id: 'ai-cycle-stop-signals', page: 'atlas', title: 'AI 사이클의 종료 조건',
    aliases: ['AI 사이클 종료', 'CAPEX 검증', '수익화 검증', 'cycle stop signals'],
    linkedConceptIds: ['atlas:economics-capex', 'atlas:economics-depreciation', 'atlas:economics-roic', 'atlas:future-uncertainty-gate'],
    definition: 'AI 사이클의 끝은 CAPEX 증가율 하나가 아니라 지출 주체의 수익성·가동률·현금흐름·자금조달이 더 이상 비용을 정당화하지 못하는 지점에서 확인한다.',
    mechanism: '빅테크·클라우드의 지출이 공급자 매출로 전환된 뒤 최종 사용량·가격·마진·FCF·ROIC로 되돌아오는지 추적한다. 효율 개선이 CAPEX 둔화보다 중요한 신호일 수 있다.',
    observables: ['지출 주체 CAPEX·감가상각·부채', '가동률·사용량·가격', '매출·FCF·ROIC·재투자'],
    confirmation: '투자 확대가 최종 고객의 지불과 효율 개선으로 회수되는지, 또는 재무 부담과 과잉설비로 남는지 확인한다.',
    invalidation: 'CAPEX 증가를 영구 수요로, CAPEX 둔화를 즉시 붕괴로 해석하거나 공급자 매출만으로 사이클을 검증하면 실패한다.',
    counterclaim: '지출이 둔화해도 동일한 서비스 처리량을 더 적은 자본으로 달성하는 효율 개선은 사이클을 연장할 수 있다.',
    question: '누가 비용을 지불하고 있으며, 그 비용은 사용량·가격·마진·FCF로 회수되고 있는가?',
    visualization: 'CAPEX → capacity·usage → revenue·margin → FCF·ROIC → 재투자 또는 감속',
    route: { id: 'fundamental', metric: 'CAPEX·감가·가동률·FCF', timeframe: '분기~다년' }
  },
  {
    id: 'information-parity-thesis-ownership', page: 'atlas', title: '정보 평준화 이후의 분석 소유권',
    aliases: ['AI 정보 평준화', '테제 소유권', '분석의 해석', 'thesis ownership'],
    linkedConceptIds: ['atlas:future-uncertainty-gate', 'principles:market-price-discovery'],
    definition: 'AI가 정보 접근 비용을 낮출수록 단순 요약은 차별화되지 않으며, 투자자는 구조를 연결하고 반대 시나리오를 견디는 해석을 스스로 소유해야 한다.',
    mechanism: '질문·자료수집·요약은 평준화되지만, 범위 설정·측정 단위·인과 경로·확률·무효화 조건을 정하는 판단은 남는다.',
    observables: ['주장·출처·기준일', '가정·확률·반대 경로', '검증 결과·복기 기록'],
    confirmation: '자신의 언어로 테제를 설명하고, 무엇이 틀리면 포지션·해석을 바꿀지 사전에 기록한다.',
    invalidation: 'AI가 만든 문장·인용 수·정보량을 이해나 우위의 대체물로 쓰면 실패한다.',
    counterclaim: '검증 가능한 반복 패턴과 더 나은 데이터·측정·실행 프로세스는 정보 평준화 이후에도 차이를 만들 수 있다.',
    question: '이 해석에서 다른 사람도 얻기 쉬운 사실과 내가 책임져야 할 가정·반증 조건은 각각 무엇인가?',
    visualization: '자료 접근 → 구조화 → 가정·반증 → 판단 → 기록·복기',
    route: { id: 'atlas', metric: '주장·출처·무효화·복기', timeframe: '구조·분기' }
  }
];

const pageLabels = Object.freeze({ principles: '시장 원리', atlas: 'AI 시대 지식 지도' });
const frameworks = Object.freeze(definitions.map((item) => Object.freeze({
  ...item,
  conceptId: `integrated-frameworks:${item.id}`,
  surface: 'integrated-frameworks',
  pageLabel: pageLabels[item.page],
  sourceKind: 'SUPPLIED_REFERENCE',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  currentClaimsAllowed: false,
  rankingUse: 'none',
  analysisStages: Object.freeze(['scope', 'mechanism', 'observables', 'confirmation', 'invalidation', 'currentness']),
  evidenceSeparation: Object.freeze(['structural reference', 'current observation', 'inference', 'action']),
  aliases: Object.freeze(unique([item.id, item.title, ...(item.aliases || [])])),
  route: Object.freeze({ ...item.route, routeLabel: `${item.route.metric} 전문 화면에서 별도 검증` })
})));

const aliasMap = new Map();
for (const framework of frameworks) for (const alias of framework.aliases) aliasMap.set(alias, [...(aliasMap.get(alias) || []), framework.conceptId]);

export const INTEGRATED_MARKET_AI_FRAMEWORKS = frameworks;
export const INTEGRATED_KNOWLEDGE_CONCEPTS = Object.freeze(frameworks.map((framework) => Object.freeze({
  canonicalId: framework.conceptId,
  legacyId: framework.id,
  surface: framework.surface,
  equivalenceGroup: null,
  title: framework.title,
  kind: 'integrated-analytical-framework',
  layer: framework.page === 'principles' ? 'L5' : 'F6',
  domainId: framework.page,
  status: 'CANONICAL_REFERENCE',
  source: { artifact: 'src/domain/knowledge/integrated-market-ai-framework-pack.js', locator: 'INTEGRATED_MARKET_AI_FRAMEWORKS', field: 'frameworks[]' },
  sourceIds: [],
  linkedConceptIds: Object.freeze([...framework.linkedConceptIds])
})));
export const INTEGRATED_KNOWLEDGE_ALIASES = Object.freeze([...aliasMap.entries()].sort(([a], [b]) => compareStableText(a, b)).map(([alias, targets]) => Object.freeze({ alias, targets: Object.freeze(unique(targets)), kind: 'STRUCTURAL_TERM', resolution: targets.length === 1 ? 'unique' : 'multi-framework' })));
export const INTEGRATED_MARKET_AI_ARTICLES = Object.freeze(frameworks.map((framework) => Object.freeze({
  schemaVersion: 'knowledge-framework-article.v1',
  articleId: framework.conceptId,
  lessonId: `integrated-framework:${framework.id}`,
  surface: framework.surface,
  page: framework.page,
  title: framework.title,
  conceptIds: Object.freeze([framework.conceptId, ...framework.linkedConceptIds]),
  authoringStatus: 'STRUCTURED_REFERENCE',
  publication: framework.publication,
  reviewedAt: '2026-09-12',
  keywords: framework.aliases,
  route: Object.freeze({ routeId: framework.page, deepLink: `?integratedFramework=${encodeURIComponent(framework.id)}`, verificationRouteId: framework.route.id, verificationLabel: framework.route.routeLabel, metric: framework.route.metric, timeframe: framework.route.timeframe }),
  sources: Object.freeze([]),
  summary: Object.freeze({ definition: framework.definition, mechanism: framework.mechanism, example: framework.observables.join(' · '), counterScenario: `${framework.invalidation} ${framework.counterclaim}`, visualization: framework.visualization }),
  processing: Object.freeze({ stages: framework.analysisStages, evidenceSeparation: framework.evidenceSeparation, confirmation: framework.confirmation, invalidation: framework.invalidation, question: framework.question })
})));

export const INTEGRATED_MARKET_AI_CROSS_PAGE_SPINE = Object.freeze([
  Object.freeze({ id: 'money-and-rates', title: '돈·금리·기대', pages: ['principles'], copy: '구매력과 할인율, 기대와 신용이 자산의 출발 조건을 바꿉니다.' }),
  Object.freeze({ id: 'financial-conditions', title: '유동성·담보·자금', pages: ['principles'], copy: '현금·신용·담보·위험선호가 자본의 이동 속도와 방향을 만듭니다.' }),
  Object.freeze({ id: 'physical-constraints', title: '물리적 병목', pages: ['atlas'], copy: 'AI 수요는 계산에서 메모리·패키징·네트워크·전력·허가로 번역됩니다.' }),
  Object.freeze({ id: 'capital-cycle', title: 'CAPEX·공급 반응', pages: ['atlas'], copy: '희소성의 가격 신호는 증설을 부르고, 공급 반응은 마진과 ROIC를 되돌립니다.' }),
  Object.freeze({ id: 'monetization', title: '사용량·수익화', pages: ['atlas'], copy: '기술 가치는 고객 지불·단위경제성·가동률·현금흐름으로 검증됩니다.' }),
  Object.freeze({ id: 'market-feedback', title: '가격·리스크·복기', pages: ['principles', 'atlas'], copy: '기대와 실제 결과의 간격을 무효화 조건·비중·기록으로 다시 판단합니다.' })
]);

export const INTEGRATED_MARKET_AI_FRAMEWORK_PACK = Object.freeze({
  schemaVersion: INTEGRATED_MARKET_AI_FRAMEWORK_PACK_VERSION,
  status: 'REFERENCE_ONLY',
  publication: 'EDUCATIONAL_REFERENCE_ONLY',
  currentClaimsAllowed: false,
  rankingUse: 'none',
  frameworks,
  concepts: INTEGRATED_KNOWLEDGE_CONCEPTS,
  aliases: INTEGRATED_KNOWLEDGE_ALIASES,
  articles: INTEGRATED_MARKET_AI_ARTICLES,
  crossPageSpine: INTEGRATED_MARKET_AI_CROSS_PAGE_SPINE,
  boundary: '문헌에서 추출한 영구 원리와 분석 절차만 보존한다. 현재 수치·기업 주장·가격·매매 신호는 별도 최신 근거가 없으면 생성하지 않는다.'
});

export function matchIntegratedFrameworks(query, { page = null, limit = 6 } = {}) {
  const normalized = clean(query).toLocaleLowerCase('ko-KR');
  if (!normalized) return Object.freeze([]);
  const rows = frameworks.map((framework) => {
    const pageMatch = !page || framework.page === page;
    const matchedAliases = framework.aliases.filter((alias) => normalized.includes(alias.toLocaleLowerCase('ko-KR')));
    const titleMatch = normalized.includes(framework.title.toLocaleLowerCase('ko-KR'));
    const score = (pageMatch ? 2 : 0) + (titleMatch ? 8 : 0) + matchedAliases.length * 3;
    return { framework, score, matchedAliases };
  }).filter((row) => row.score > 2 && (!page || row.framework.page === page)).sort((a, b) => b.score - a.score || a.framework.id.localeCompare(b.framework.id)).slice(0, Math.min(8, Number.isInteger(limit) && limit > 0 ? limit : 6));
  return Object.freeze(rows.map(({ framework, score, matchedAliases }) => Object.freeze({ frameworkId: framework.id, conceptId: framework.conceptId, page: framework.page, score, matchedAliases: Object.freeze(matchedAliases), linkedConceptIds: framework.linkedConceptIds, confirmation: framework.confirmation, invalidation: framework.invalidation, question: framework.question })));
}
