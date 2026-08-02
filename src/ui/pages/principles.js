import { createResourceBag } from '../../app/lifecycle.js';

const REVIEWED_AT = '2026-08-02';
const RESEARCH_URL = './public-data/atlas/source-packets.json';
const CHAPTERS_URL = './public-data/principles/chapters.json';
const LESSON_LIBRARY_URL = './public-data/principles/lesson-library.json';

const RESEARCH_NODE_IDS = Object.freeze({
  'ai-era': 'candidate.ai-era',
  'ai-workload': 'candidate.ai-workload',
  compute: 'candidate.compute',
  'memory-hbm': 'candidate.memory-hbm',
  'advanced-packaging': 'candidate.advanced-packaging',
  storage: 'candidate.storage-ssd',
  'power-cooling': 'candidate.power-cooling',
  'ai-capex': 'candidate.ai-capex',
  visibility: 'candidate.revenue-visibility-lta',
  financing: 'candidate.financing-credit',
  'geo-rates': 'candidate.geo-oil-rates',
  evaluation: 'candidate.evaluation-dimensions'
});

// MP-01/KG-02: the first content packet is intentionally structured like the
// eventual JSON catalog. It is educational/reference content, not a market
// snapshot and not an investment recommendation.
const RAW_CATALOG = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: 'ai-era', type: 'root', title: 'AI 시대', summary: '문제·능력·모델·시스템·하드웨어·경제를 한 흐름으로 읽는 출발점.', layer: 'L0', status: 'REVIEWED_CANDIDATE', sourceName: 'Stanford HAI AI Index', sourceUrl: 'https://hai.stanford.edu/ai-index/2025-ai-index-report', x: 50, y: 14 }),
    Object.freeze({ id: 'ai-workload', type: 'concept', title: 'AI workload', summary: '학습과 추론은 서로 다른 계산·메모리·지연 요구를 만든다.', layer: 'L1', status: 'REVIEWED_CANDIDATE', sourceName: 'NVIDIA technical overview', sourceUrl: 'https://developer.nvidia.com/deep-learning', x: 25, y: 33 }),
    Object.freeze({ id: 'compute', type: 'infrastructure', title: '계산', summary: '병렬 연산과 특화 가속기가 모델의 처리량을 결정한다.', layer: 'L2', status: 'REVIEWED_CANDIDATE', sourceName: 'US DOE ASCR', sourceUrl: 'https://science.osti.gov/ascr', x: 50, y: 33 }),
    Object.freeze({ id: 'memory-hbm', type: 'infrastructure', title: '메모리·HBM', summary: '데이터 이동과 대역폭이 계산 능력의 실제 활용도를 제한할 수 있다.', layer: 'L2', status: 'PARTIAL', sourceName: 'JEDEC standards', sourceUrl: 'https://www.jedec.org/standards-documents', x: 75, y: 33 }),
    Object.freeze({ id: 'advanced-packaging', type: 'infrastructure', title: '첨단 패키징', summary: '칩과 메모리를 가까이 묶어 대역폭·열·수율의 절충을 만든다.', layer: 'L3', status: 'PARTIAL', sourceName: 'TSMC technology', sourceUrl: 'https://www.tsmc.com/english/dedicatedFoundry/technology/3dfabric', x: 17, y: 55 }),
    Object.freeze({ id: 'storage', type: 'infrastructure', title: '스토리지', summary: '추론과 데이터 파이프라인에서 저장 용량·지연·쓰기 내구성이 비용 구조에 영향을 준다.', layer: 'L3', status: 'PARTIAL', sourceName: 'SNIA', sourceUrl: 'https://www.snia.org/education/what-is-storage', x: 38, y: 55 }),
    Object.freeze({ id: 'power-cooling', type: 'infrastructure', title: '전력·냉각', summary: '데이터센터의 전력 공급과 열 제거가 물리적 확장의 전제다.', layer: 'L3', status: 'REVIEWED_CANDIDATE', sourceName: 'US DOE data centers', sourceUrl: 'https://www.energy.gov/articles/energy-department-releases-new-report-economics-data-centers', x: 62, y: 55 }),
    Object.freeze({ id: 'ai-capex', type: 'economics', title: 'AI CAPEX', summary: '서버·네트워크·전력 투자는 매출 성장과 감가상각·현금흐름 사이의 연결고리다.', layer: 'L4', status: 'PARTIAL', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access', x: 83, y: 55 }),
    Object.freeze({ id: 'visibility', type: 'economics', title: '매출 가시성', summary: '수주·예약·사용량·고객 집중도는 미래 매출을 읽는 단서지만 확정 매출과 동일하지 않다.', layer: 'L5', status: 'REVIEWED_CANDIDATE', sourceName: 'SEC filings', sourceUrl: 'https://www.sec.gov/edgar/search-and-access', x: 25, y: 76 }),
    Object.freeze({ id: 'financing', type: 'economics', title: '금융·신용', summary: '금리와 신용 조건은 장기 투자 프로젝트의 할인율과 자금 조달 여건을 바꾼다.', layer: 'L5', status: 'REVIEWED_CANDIDATE', sourceName: 'Federal Reserve FOMC', sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomc.htm', x: 50, y: 76 }),
    Object.freeze({ id: 'geo-rates', type: 'macro', title: '지정학·원자재·금리', summary: '공급망·에너지·금융 조건이 서로 연결되며 산업의 병목을 재배치할 수 있다.', layer: 'L5', status: 'PARTIAL', sourceName: 'IEA World Energy Outlook', sourceUrl: 'https://www.iea.org/reports/world-energy-outlook-2025', x: 75, y: 76 }),
    Object.freeze({ id: 'evaluation', type: 'method', title: '검증 프레임', summary: '성장률보다 먼저 출처·관찰기간·단위·대체 설명을 확인한다.', layer: 'L6', status: 'REVIEWED_CANDIDATE', sourceName: 'SEC Investor.gov', sourceUrl: 'https://www.investor.gov/introduction-investing/investing-basics', x: 50, y: 94 })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'ai-era', to: 'ai-workload', relation: '분해' }),
    Object.freeze({ from: 'ai-era', to: 'compute', relation: '핵심 축' }),
    Object.freeze({ from: 'ai-era', to: 'evaluation', relation: '검증' }),
    Object.freeze({ from: 'ai-workload', to: 'compute', relation: '요구' }),
    Object.freeze({ from: 'ai-workload', to: 'memory-hbm', relation: '요구' }),
    Object.freeze({ from: 'compute', to: 'advanced-packaging', relation: '구현' }),
    Object.freeze({ from: 'memory-hbm', to: 'advanced-packaging', relation: '구현' }),
    Object.freeze({ from: 'memory-hbm', to: 'storage', relation: '병목 이동' }),
    Object.freeze({ from: 'compute', to: 'power-cooling', relation: '소비' }),
    Object.freeze({ from: 'power-cooling', to: 'ai-capex', relation: '확장 조건' }),
    Object.freeze({ from: 'advanced-packaging', to: 'ai-capex', relation: '공급망' }),
    Object.freeze({ from: 'storage', to: 'visibility', relation: '수요 단서' }),
    Object.freeze({ from: 'ai-capex', to: 'visibility', relation: '매출 연결' }),
    Object.freeze({ from: 'ai-capex', to: 'financing', relation: '자금 조달' }),
    Object.freeze({ from: 'geo-rates', to: 'financing', relation: '조건 변화' }),
    Object.freeze({ from: 'financing', to: 'evaluation', relation: '할인·위험' }),
    Object.freeze({ from: 'visibility', to: 'evaluation', relation: '검증' })
  ]),
  lessons: Object.freeze([
    Object.freeze({ id: 'money-rates', title: '돈의 시간가치와 금리', level: '입문', summary: '금리는 모든 장기 현금흐름의 현재가치를 바꾸는 가격이다.', body: '먼저 금리의 방향을 맞히려 하기보다, 현금흐름의 기간과 자금 조달 조건이 어떤 변수인지 분리해서 읽습니다.', nodeIds: ['financing', 'evaluation'], route: 'fxbond', routeLabel: '환율·채권 화면 열기' }),
    Object.freeze({ id: 'bonds-dollar', title: '채권·달러·캐리', level: '입문', summary: '금리 차이와 위험선호는 채권과 통화의 상대가격에 흔적을 남긴다.', body: '채권 금리, 달러, 위험자산을 하나의 원인으로 단정하지 말고 관찰기간과 반대 방향 가능성을 함께 기록합니다.', nodeIds: ['geo-rates', 'financing'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'valuation', title: '기업·주식·밸류에이션', level: '입문', summary: '좋은 산업과 좋은 주식은 같은 문장이 아니다.', body: '산업의 성장 가능성, 기업의 경쟁력, 주가에 반영된 기대를 서로 다른 질문으로 분리합니다.', nodeIds: ['visibility', 'evaluation'], route: 'fundamental', routeLabel: '기업 분석 화면 열기' }),
    Object.freeze({ id: 'ai-semiconductor', title: 'AI 반도체 가치사슬', level: '심화', summary: '계산→메모리→패키징→전력으로 병목을 따라간다.', body: '하나의 승자 서사를 고정하지 않고, AI workload가 요구하는 계산·대역폭·열·공급망 제약을 순서대로 확인합니다.', nodeIds: ['ai-workload', 'compute', 'memory-hbm', 'advanced-packaging'], route: 'themes', routeLabel: '테마·트렌드 화면 열기' }),
    Object.freeze({ id: 'data-center-power', title: 'AI 데이터센터와 전력', level: '심화', summary: '서버를 늘리는 일은 전력·냉각·그리드의 문제이기도 하다.', body: 'CAPEX를 수요의 증거로 바로 해석하지 말고, 전력 인입·냉각·가동률·감가상각을 별도 확인 항목으로 둡니다.', nodeIds: ['power-cooling', 'ai-capex'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'inference-storage', title: '추론과 스토리지', level: '심화', summary: '학습 이후의 추론 비용과 데이터 이동은 새로운 병목이 될 수 있다.', body: '모델 규모만 보지 말고 요청량·지연·메모리 이동·저장 패턴이 시스템 비용에 미치는 영향을 질문합니다.', nodeIds: ['ai-workload', 'memory-hbm', 'storage'], route: 'technical', routeLabel: '기술 분석 화면 열기' }),
    Object.freeze({ id: 'evidence-loop', title: '출처에서 판단까지', level: '입문', summary: '발견 자료는 가설이고, 1차 자료가 검증을 담당한다.', body: '텔레그램·뉴스·검색 결과는 발견용으로만 쓰고, 공시·기관 자료·표준 문서에서 주장과 관찰시점을 다시 확인합니다.', nodeIds: ['evaluation', 'visibility'], route: 'market-news', routeLabel: '시장 뉴스 화면 열기' })
  ]),
  paths: Object.freeze([
    Object.freeze({ id: 'beginner', title: '처음 읽는 자본의 지도', description: '금리에서 AI 인프라까지, 원인과 결과를 한 번에 잇는 5단계.', lessonIds: ['money-rates', 'bonds-dollar', 'valuation', 'ai-semiconductor', 'evidence-loop'] }),
    Object.freeze({ id: 'ai-infrastructure', title: 'AI 인프라 심화 경로', description: 'workload·메모리·패키징·전력·CAPEX를 병목 관점에서 읽는 경로.', lessonIds: ['ai-semiconductor', 'data-center-power', 'inference-storage', 'valuation'] })
  ])
});

// MP-05: extend the AI-infrastructure slice with the economic spine from
// chapters A–K. These are evergreen reference concepts; current prices and
// macro observations remain owned by the live specialist routes.
const MARKET_EXPANSION = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: 'scarcity-choice', type: 'principle', title: '희소성과 선택', summary: '자원은 유한하고 선택에는 기회비용이 따른다는 경제의 출발점.', layer: 'L0', sourceName: 'Federal Reserve Education', sourceUrl: 'https://www.federalreserve.gov/education.htm', x: 20, y: 10 }),
    Object.freeze({ id: 'productivity-wealth', type: 'principle', title: '생산성과 부', summary: '노동·자본·기술·제도가 같은 자원으로 더 많은 가치를 만드는 과정.', layer: 'L0', sourceName: 'OECD Productivity', sourceUrl: 'https://www.oecd.org/en/topics/productivity.html', x: 20, y: 20 }),
    Object.freeze({ id: 'capitalism-engine', type: 'principle', title: '자본주의의 엔진', summary: '소유·계약·경쟁·투자가 생산능력과 이익의 재투자를 연결하는 방식.', layer: 'L1', sourceName: 'IMF Topics', sourceUrl: 'https://www.imf.org/en/Topics', x: 20, y: 30 }),
    Object.freeze({ id: 'money-purchasing-power', type: 'principle', title: '돈과 구매력', summary: '돈은 교환·계산·저장의 기능을 가지며 물가 변화는 구매력을 바꾼다.', layer: 'L1', sourceName: 'Federal Reserve Education', sourceUrl: 'https://www.federalreserve.gov/education.htm', x: 20, y: 40 }),
    Object.freeze({ id: 'inflation-deflation', type: 'principle', title: '인플레이션과 디플레이션', summary: '평균 가격수준의 변화와 상대가격 변화를 구분해 수요·공급·기대의 전달을 읽는다.', layer: 'L1', sourceName: 'BLS CPI', sourceUrl: 'https://www.bls.gov/cpi/', x: 20, y: 50 }),
    Object.freeze({ id: 'credit-banks-debt', type: 'principle', title: '신용·은행·부채', summary: '현재 지출과 미래 소득을 연결하지만 상환·담보·만기 위험도 만든다.', layer: 'L2', sourceName: 'Federal Reserve Education', sourceUrl: 'https://www.federalreserve.gov/education.htm', x: 20, y: 60 }),
    Object.freeze({ id: 'interest-central-bank', type: 'principle', title: '금리와 중앙은행', summary: '금리는 시간·위험·유동성의 가격이며 중앙은행은 금융조건과 물가 기대에 영향을 준다.', layer: 'L2', sourceName: 'Federal Reserve Monetary Policy', sourceUrl: 'https://www.federalreserve.gov/monetarypolicy.htm', x: 20, y: 70 }),
    Object.freeze({ id: 'bonds-dollar-currency', type: 'principle', title: '채권·달러·환율', summary: '채권의 현금흐름과 금리, 통화의 상대가격이 글로벌 자금 흐름과 연결된다.', layer: 'L3', sourceName: 'U.S. Treasury', sourceUrl: 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rates', x: 20, y: 80 }),
    Object.freeze({ id: 'government-fiscal', type: 'principle', title: '정부·재정·국가', summary: '세입·지출·차입과 정책 우선순위가 수요·공급·국가의 자본배분에 미치는 경로.', layer: 'L3', sourceName: 'U.S. Treasury', sourceUrl: 'https://home.treasury.gov/policy-issues', x: 35, y: 90 }),
    Object.freeze({ id: 'company-stock-valuation', type: 'principle', title: '기업·주식·밸류에이션', summary: '기업의 생산·현금흐름·자금조달과 주식의 기대가치·가격을 분리해 읽는다.', layer: 'L4', sourceName: 'Investor.gov', sourceUrl: 'https://www.investor.gov/introduction-investing/investing-basics', x: 50, y: 90 }),
    Object.freeze({ id: 'market-price-discovery', type: 'principle', title: '시장과 가격발견', summary: '주문·유동성·기대·서프라이즈가 거래 가능한 가격에 반영되는 과정.', layer: 'L4', sourceName: 'SEC Investor.gov', sourceUrl: 'https://www.investor.gov/introduction-investing/investing-basics', x: 65, y: 90 }),
    Object.freeze({ id: 'cycles-allocation', type: 'principle', title: '경기순환과 자산배분', summary: '경기·이익·유동성의 서로 다른 시간축이 산업과 자산의 상대가격에 전달된다.', layer: 'L5', sourceName: 'IMF Topics', sourceUrl: 'https://www.imf.org/en/Topics', x: 80, y: 80 }),
    Object.freeze({ id: 'investment-risk', type: 'principle', title: '투자와 리스크', summary: '수익 가능성보다 먼저 손실·생존·포지션 크기·검증 절차를 설계한다.', layer: 'L5', sourceName: 'Investor.gov', sourceUrl: 'https://www.investor.gov/introduction-investing/investing-basics', x: 80, y: 70 }),
    Object.freeze({ id: 'industry-value-chain', type: 'principle', title: '산업 가치사슬', summary: '수요에서 원재료·공정·제품·서비스·현금흐름으로 이어지는 이익 풀과 병목의 지도.', layer: 'L5', sourceName: 'SEC Investor.gov', sourceUrl: 'https://www.investor.gov/introduction-investing/investing-basics', x: 80, y: 60 })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'ai-era', to: 'scarcity-choice', relation: '출발점' }),
    Object.freeze({ from: 'scarcity-choice', to: 'productivity-wealth', relation: '선택과 산출' }),
    Object.freeze({ from: 'productivity-wealth', to: 'capitalism-engine', relation: '제도와 투자' }),
    Object.freeze({ from: 'capitalism-engine', to: 'money-purchasing-power', relation: '교환과 계산' }),
    Object.freeze({ from: 'money-purchasing-power', to: 'inflation-deflation', relation: '구매력 변화' }),
    Object.freeze({ from: 'inflation-deflation', to: 'credit-banks-debt', relation: '신용 조건' }),
    Object.freeze({ from: 'credit-banks-debt', to: 'interest-central-bank', relation: '자금 가격' }),
    Object.freeze({ from: 'interest-central-bank', to: 'bonds-dollar-currency', relation: '금융 전달' }),
    Object.freeze({ from: 'bonds-dollar-currency', to: 'government-fiscal', relation: '국가 자금' }),
    Object.freeze({ from: 'government-fiscal', to: 'company-stock-valuation', relation: '기업 환경' }),
    Object.freeze({ from: 'company-stock-valuation', to: 'market-price-discovery', relation: '기대와 가격' }),
    Object.freeze({ from: 'market-price-discovery', to: 'cycles-allocation', relation: '시간축' }),
    Object.freeze({ from: 'cycles-allocation', to: 'investment-risk', relation: '배분과 생존' }),
    Object.freeze({ from: 'investment-risk', to: 'industry-value-chain', relation: '분석 단위' }),
    Object.freeze({ from: 'industry-value-chain', to: 'ai-workload', relation: 'AI 산업 연결' }),
    Object.freeze({ from: 'interest-central-bank', to: 'financing', relation: '할인율·자금비용' }),
    Object.freeze({ from: 'industry-value-chain', to: 'ai-capex', relation: '이익 풀·투자' })
  ]),
  lessons: Object.freeze([
    Object.freeze({ id: 'scarcity-and-choice', title: '희소성에서 시작하는 경제', level: '입문', summary: '선택은 포기한 대안과 기회비용을 만든다.', body: '경제의 출발점은 돈이 아니라 유한한 시간·노동·자원입니다. 어떤 선택이 효율적인지 보려면 선택한 결과뿐 아니라 포기한 대안과 제약 조건을 함께 적어야 합니다.', nodeIds: ['scarcity-choice', 'productivity-wealth'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'productivity-and-wealth', title: '생산성이 생활수준을 바꾸는 경로', level: '입문', summary: '같은 시간에 더 많은 가치를 만드는 능력이 소득과 부의 기반이 된다.', body: '생산성은 노동·자본·기술·제도가 결합해 산출을 늘리는 방식입니다. 명목 가격이 오른 것과 실제로 생산할 수 있는 양이 늘어난 것을 구분해야 합니다.', nodeIds: ['productivity-wealth', 'capitalism-engine'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'money-and-purchasing-power', title: '돈은 왜 구매력을 잃는가', level: '입문', summary: '교환의 편의와 구매력의 변화는 서로 다른 질문이다.', body: '돈은 교환 매개·계산 단위·가치 저장 기능을 가집니다. 물가 수준이 오르면 같은 금액으로 살 수 있는 양이 줄어들므로 명목 금액과 실질 구매력을 나눠 봅니다.', nodeIds: ['money-purchasing-power', 'inflation-deflation'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'inflation-transmission', title: '인플레이션의 전달 경로', level: '입문', summary: '수요·공급·기대·임금·금리가 가격수준에 영향을 준다.', body: '개별 가격 상승과 광범위한 물가 상승을 구분하고, 충격이 일시적인지 기대와 임금·신용으로 번지는지 확인합니다. 원인 하나로 모든 물가를 설명하지 않습니다.', nodeIds: ['inflation-deflation', 'interest-central-bank'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'credit-and-debt', title: '신용은 미래 소득을 현재로 당긴다', level: '입문', summary: '신용은 투자를 앞당기지만 상환과 만기 위험을 만든다.', body: '은행과 채권은 자금을 필요한 곳으로 연결합니다. 부채가 생산능력과 현금흐름을 늘리는지, 아니면 담보가격과 차환에만 의존하는지 구분해야 합니다.', nodeIds: ['credit-banks-debt', 'interest-central-bank'], route: 'fxbond', routeLabel: '환율·채권 화면 열기' }),
    Object.freeze({ id: 'rates-and-central-bank', title: '금리는 돈의 시간 가격이다', level: '입문', summary: '금리 변화는 할인율·차입비용·환율·수요로 전달된다.', body: '기준금리와 시장금리, 명목금리와 실질금리를 분리합니다. 같은 금리 변화도 부채 구조·현금흐름 만기·통화·위험 프리미엄에 따라 기업과 자산에 다르게 전달됩니다.', nodeIds: ['interest-central-bank', 'financing'], route: 'fxbond', routeLabel: '환율·채권 화면 열기' }),
    Object.freeze({ id: 'bonds-dollar-and-currency', title: '채권·달러·환율을 함께 읽기', level: '심화', summary: '현금흐름의 가격과 통화의 상대가격은 자금 이동의 흔적을 남긴다.', body: '채권 가격과 수익률은 반대 방향으로 움직이고, 달러와 환율은 금리 차이뿐 아니라 성장·위험회피·유동성의 영향을 받습니다. 하나의 화살표로 단정하지 않습니다.', nodeIds: ['bonds-dollar-currency', 'interest-central-bank'], route: 'fxbond', routeLabel: '환율·채권 화면 열기' }),
    Object.freeze({ id: 'fiscal-and-private-sector', title: '정부 재정과 민간의 연결', level: '심화', summary: '정부의 세입·지출·차입은 수요와 자금시장에 전달된다.', body: '재정정책은 경기 안정·공공재·분배·부채 지속가능성의 문제를 동시에 가집니다. 정부 지출의 크기만 보지 말고 재원·기간·민간 투자와의 관계를 확인합니다.', nodeIds: ['government-fiscal', 'bonds-dollar-currency'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'company-and-stock', title: '기업의 경제와 주식의 기대', level: '입문', summary: '좋은 기업·좋은 산업·좋은 주가는 서로 다른 질문이다.', body: '기업은 제품을 팔아 현금흐름을 만들고 자본을 재투자합니다. 주식 가격은 그 현금흐름에 대한 기대와 할인율·위험·수급이 결합한 결과이므로 사업의 질과 가격을 분리합니다.', nodeIds: ['company-stock-valuation', 'market-price-discovery'], route: 'fundamental', routeLabel: '기업 분석 화면 열기' }),
    Object.freeze({ id: 'price-discovery', title: '시장은 기대와 서프라이즈를 가격에 반영한다', level: '심화', summary: '가격은 공개 정보뿐 아니라 유동성·포지셔닝·예상과 실제의 차이를 반영한다.', body: '뉴스가 좋다는 사실만으로 가격이 오르는 것은 아닙니다. 시장이 이미 무엇을 기대했는지, 거래 가능한 유동성과 포지션이 어떤지, 예상 밖 정보가 무엇인지 함께 봅니다.', nodeIds: ['market-price-discovery', 'evaluation'], route: 'technical', routeLabel: '기술 분석 화면 열기' }),
    Object.freeze({ id: 'cycles-and-allocation', title: '경기·이익·유동성은 다른 시계로 움직인다', level: '심화', summary: '자산배분은 여러 사이클과 상관관계의 변화에 대한 관리다.', body: '경기지표가 좋아도 이익·유동성·밸류에이션이 같은 방향이라는 보장은 없습니다. 자산 간 관계가 고정되어 있다고 가정하지 말고 국면과 위험 예산을 함께 확인합니다.', nodeIds: ['cycles-allocation', 'market-price-discovery'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'investing-and-survival', title: '투자에서 먼저 지켜야 할 생존', level: '입문', summary: '수익률보다 손실 규모·확률·복구 가능성을 먼저 관리한다.', body: '포지션 크기와 손실 한도는 전망의 정확도와 별개로 생존을 결정합니다. 투자·투기·저축을 구분하고, 틀렸을 때의 행동과 검증 시점을 미리 정합니다.', nodeIds: ['investment-risk', 'evaluation'], route: 'portfolio', routeLabel: '포트폴리오 화면 열기' }),
    Object.freeze({ id: 'industry-value-pools', title: '산업을 이익 풀과 병목으로 읽기', level: '심화', summary: '산업 이름보다 가치사슬·대체재·고객·KPI를 먼저 본다.', body: '수요가 늘어도 모든 참여자가 같은 이익을 얻지 않습니다. 원재료·공정·제품·서비스·고객의 힘과 병목, 가격 결정력, 자본집약도를 순서대로 확인합니다.', nodeIds: ['industry-value-chain', 'ai-workload', 'ai-capex'], route: 'themes', routeLabel: '테마·트렌드 화면 열기' }),
    Object.freeze({ id: 'ai-market-bridge', title: '경제 원리에서 AI 인프라로', level: '심화', summary: '희소성·병목·자본비용이 GPU부터 전력망까지 반복된다.', body: 'AI 수요는 workload를 만들고, workload는 계산·메모리·패키징·네트워크·전력에 투자를 요구합니다. 기술 가능성은 수요·가동률·현금흐름·자본비용을 통과해야 경제적 결과가 됩니다.', nodeIds: ['industry-value-chain', 'ai-workload', 'ai-capex', 'financing'], route: 'themes', routeLabel: '테마·트렌드 화면 열기' })
  ]),
  paths: Object.freeze([
    Object.freeze({ id: 'market-foundations', title: '처음 배우는 시장과 자본', description: '희소성에서 기업·가격·산업까지 경제적 연결고리를 순서대로 읽습니다.', lessonIds: ['scarcity-and-choice', 'productivity-and-wealth', 'money-and-purchasing-power', 'inflation-transmission', 'credit-and-debt', 'rates-and-central-bank', 'company-and-stock', 'price-discovery', 'cycles-and-allocation', 'investing-and-survival'] }),
    Object.freeze({ id: 'market-to-ai', title: '시장 원리에서 AI 산업으로', description: '자본비용·병목·가치사슬이 AI 인프라에 전달되는 경로를 확인합니다.', lessonIds: ['rates-and-central-bank', 'bonds-dollar-and-currency', 'fiscal-and-private-sector', 'industry-value-pools', 'ai-market-bridge', 'ai-semiconductor', 'data-center-power'] })
  ])
});

// MP-05/K~O: extend the economic spine into power, adjacent industries, and
// the Korea-facing transmission layer. These are structural lessons; current
// company metrics remain owned by the live data and specialist routes.
const SYSTEMS_EXPANSION = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: 'power-electricity-system', type: 'infrastructure', title: '전력 시스템', summary: '발전·송전·배전·저장·수요반응이 하나의 물리적 시스템으로 전력을 공급합니다.', layer: 'L3', sourceName: 'IEA Electricity', sourceUrl: 'https://www.iea.org/reports/electricity-2025', x: 20, y: 15 }),
    Object.freeze({ id: 'power-generation-market', type: 'infrastructure', title: '발전 시장', summary: '가스·석탄·원전·수력·재생에너지가 비용·안정성·탄소 제약을 두고 전력 믹스를 만듭니다.', layer: 'L3', sourceName: 'EIA Electricity', sourceUrl: 'https://www.eia.gov/electricity/', x: 35, y: 25 }),
    Object.freeze({ id: 'grid-transmission-distribution', type: 'infrastructure', title: '전력망과 접속', summary: '송전망·배전망·변전소와 접속 대기시간이 발전소와 데이터센터의 실제 가동 시점을 결정합니다.', layer: 'L3', sourceName: 'U.S. DOE Grid', sourceUrl: 'https://www.energy.gov/gdo/grid-deployment-office', x: 50, y: 35 }),
    Object.freeze({ id: 'energy-storage', type: 'infrastructure', title: '저장과 수요반응', summary: '배터리·양수·수요반응은 전력 생산과 소비의 시간 차이를 줄여 계통 유연성을 높입니다.', layer: 'L3', sourceName: 'U.S. DOE Energy Storage', sourceUrl: 'https://www.energy.gov/oe/energy-storage', x: 65, y: 45 }),
    Object.freeze({ id: 'data-center-power-demand', type: 'infrastructure', title: '데이터센터 전력 수요', summary: 'AI 랙 밀도와 가동률은 데이터센터를 전력의 대형 산업 수요처로 바꿉니다.', layer: 'L4', sourceName: 'U.S. DOE Data Centers', sourceUrl: 'https://www.energy.gov/articles/energy-department-releases-new-report-economics-data-centers', x: 80, y: 55 }),
    Object.freeze({ id: 'industrial-energy-efficiency', type: 'industry', title: '산업 효율과 냉각', summary: '효율·냉각·열관리 개선은 같은 전력으로 더 많은 계산과 생산을 가능하게 합니다.', layer: 'L4', sourceName: 'U.S. DOE Industrial Efficiency', sourceUrl: 'https://www.energy.gov/amo/industrial-decarbonization', x: 80, y: 65 }),
    Object.freeze({ id: 'critical-minerals', type: 'industry', title: '핵심 광물과 소재', summary: '구리·리튬·희토류·웨이퍼 소재의 공급과 정제가 장비·전력·배터리 확장의 병목이 될 수 있습니다.', layer: 'L4', sourceName: 'IEA Critical Minerals', sourceUrl: 'https://www.iea.org/topics/critical-minerals', x: 65, y: 75 }),
    Object.freeze({ id: 'robotics-automation', type: 'industry', title: '로보틱스와 자동화', summary: '센서·제어·모델·액추에이터를 결합해 소프트웨어 지능을 물리적 작업으로 전달합니다.', layer: 'L5', sourceName: 'NIST Robotics', sourceUrl: 'https://www.nist.gov/topics/robotics', x: 50, y: 75 }),
    Object.freeze({ id: 'defense-space', type: 'industry', title: '방산과 우주', summary: '자율성·센서·통신·엣지 컴퓨팅이 높은 신뢰성·보안·조달 주기와 결합되는 산업입니다.', layer: 'L5', sourceName: 'U.S. Department of Defense', sourceUrl: 'https://www.defense.gov/Topics/Technology/', x: 35, y: 75 }),
    Object.freeze({ id: 'biotech-healthcare', type: 'industry', title: '바이오와 헬스케어', summary: 'AI가 발견·진단·임상·운영에 들어가지만 규제·검증·상환 구조가 상용화를 제한합니다.', layer: 'L5', sourceName: 'FDA Digital Health', sourceUrl: 'https://www.fda.gov/medical-devices/digital-health-center-excellence', x: 20, y: 75 }),
    Object.freeze({ id: 'finance-software-consumer', type: 'industry', title: '금융·소프트웨어·소비자 서비스', summary: '모델이 반복 업무와 의사결정을 바꾸면서 데이터·유통·신뢰·전환율이 가치 포착을 좌우합니다.', layer: 'L5', sourceName: 'OECD AI', sourceUrl: 'https://oecd.ai/en/', x: 20, y: 85 }),
    Object.freeze({ id: 'us-korea-market', type: 'market', title: '미국·한국 시장 연결', summary: '글로벌 공급망·상장시장·고객·정책의 연결을 통해 AI 산업의 가치가 지역별로 분배됩니다.', layer: 'L6', sourceName: 'Korea International Trade Association', sourceUrl: 'https://www.kita.org/', x: 35, y: 90 }),
    Object.freeze({ id: 'krw-dollar-foreign-flow', type: 'macro', title: '원화·달러·외국인 자금', summary: '환율·금리·외국인 수급은 같은 산업의 원화 수익과 달러 기준 자본비용을 다르게 보이게 합니다.', layer: 'L6', sourceName: 'Bank of Korea', sourceUrl: 'https://www.bok.or.kr/eng/main/main.do', x: 50, y: 90 }),
    Object.freeze({ id: 'korea-semiconductor-policy', type: 'policy', title: '한국 반도체 정책과 공급망', summary: '세제·인프라·인력·수출 규칙은 기업의 투자 위치와 공급망 회복력을 바꿉니다.', layer: 'L6', sourceName: 'Korea Ministry of Trade', sourceUrl: 'https://english.motie.go.kr/', x: 65, y: 90 }),
    Object.freeze({ id: 'tax-accounting-cashflow', type: 'method', title: '세금·회계·현금흐름', summary: '회계상 성장과 실제 현금 회수는 다를 수 있으므로 감가상각·운전자본·세금을 함께 읽어야 합니다.', layer: 'L6', sourceName: 'SEC Investor.gov', sourceUrl: 'https://www.investor.gov/introduction-investing/investing-basics', x: 80, y: 90 })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'power-cooling', to: 'power-electricity-system', relation: '전력 제약' }),
    Object.freeze({ from: 'power-electricity-system', to: 'power-generation-market', relation: '발전 믹스' }),
    Object.freeze({ from: 'power-generation-market', to: 'grid-transmission-distribution', relation: '계통 접속' }),
    Object.freeze({ from: 'grid-transmission-distribution', to: 'energy-storage', relation: '유연성' }),
    Object.freeze({ from: 'energy-storage', to: 'data-center-power-demand', relation: '수요 안정화' }),
    Object.freeze({ from: 'data-center-power-demand', to: 'industrial-energy-efficiency', relation: '효율·냉각' }),
    Object.freeze({ from: 'industrial-energy-efficiency', to: 'critical-minerals', relation: '소재 수요' }),
    Object.freeze({ from: 'industry-value-chain', to: 'robotics-automation', relation: '인접 산업' }),
    Object.freeze({ from: 'robotics-automation', to: 'defense-space', relation: '고신뢰 응용' }),
    Object.freeze({ from: 'defense-space', to: 'biotech-healthcare', relation: '센서·검증' }),
    Object.freeze({ from: 'biotech-healthcare', to: 'finance-software-consumer', relation: '상용화' }),
    Object.freeze({ from: 'finance-software-consumer', to: 'us-korea-market', relation: '가치 포착' }),
    Object.freeze({ from: 'us-korea-market', to: 'krw-dollar-foreign-flow', relation: '환율·자금' }),
    Object.freeze({ from: 'krw-dollar-foreign-flow', to: 'korea-semiconductor-policy', relation: '정책 전달' }),
    Object.freeze({ from: 'korea-semiconductor-policy', to: 'tax-accounting-cashflow', relation: '투자 회수' }),
    Object.freeze({ from: 'critical-minerals', to: 'industry-value-chain', relation: '공급 병목' }),
    Object.freeze({ from: 'company-stock-valuation', to: 'tax-accounting-cashflow', relation: '현금흐름 검증' })
  ]),
  lessons: Object.freeze([
    Object.freeze({ id: 'electricity-system', title: '전기는 상품이면서 시스템이다', level: '입문', summary: '발전량만이 아니라 송전·배전·저장·수요반응의 제약을 함께 봅니다.', body: '전력은 재고처럼 오래 저장하기 어렵고 순간 수급을 맞춰야 합니다. 따라서 발전원가, 계통 접속, 예비력, 저장과 수요반응을 분리해 보면 데이터센터 증설이 왜 장비 구매만으로 끝나지 않는지 이해할 수 있습니다.', nodeIds: ['power-electricity-system', 'grid-transmission-distribution'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'generation-and-mix', title: '발전 믹스와 비용 곡선', level: '입문', summary: '발전원별 비용·탄소·안정성의 교환관계가 전력 가격과 투자 방향을 만듭니다.', body: '가스·석탄·원전·수력·재생에너지는 가동률과 변동성, 연료비, 정책 조건이 다릅니다. 평균 발전단가 하나로 결론 내리지 말고 피크 수요, 예비력, 연료 조달, 장기 계약을 함께 확인합니다.', nodeIds: ['power-generation-market', 'power-electricity-system'], route: 'macro', routeLabel: '거시경제 화면 열기' }),
    Object.freeze({ id: 'grid-and-storage', title: '전력망·저장·접속 대기', level: '입문', summary: '발전 설비가 있어도 계통에 연결하지 못하면 실제 공급능력이 되지 않습니다.', body: '송전선·변전소·배전망의 용량과 인허가가 실제 가동 시점을 결정합니다. 배터리와 수요반응은 시간대별 불일치를 줄이지만, 지속시간·열화·안전·수익모델의 한계를 함께 봐야 합니다.', nodeIds: ['grid-transmission-distribution', 'energy-storage'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'data-center-demand', title: 'AI 수요가 전력 시장으로 전달되는 법', level: '심화', summary: '랙 밀도와 가동률이 데이터센터의 전력 수요와 시설 투자로 번역됩니다.', body: 'AI 서버의 전력 수요는 칩 성능만이 아니라 메모리·네트워크·냉각·가동률과 함께 결정됩니다. 수요 추정은 전력 사용량, 접속 일정, PUE, 고객 계약, 투자 회수기간을 연결해야 합니다.', nodeIds: ['data-center-power-demand', 'industrial-energy-efficiency', 'power-cooling'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'industrial-bottlenecks', title: '소재와 산업 병목 읽기', level: '심화', summary: '산업의 병목은 장비 이름보다 소재·정제·리드타임·대체 가능성에서 드러납니다.', body: '핵심 광물과 소재는 매장량보다 정제능력, 지역 집중도, 재활용, 대체재, 인증 기간이 중요합니다. 병목이 가격과 마진을 높일 수도 있지만, 공급 증설과 기술 대체가 진행되면 경제성은 빠르게 변합니다.', nodeIds: ['critical-minerals', 'industry-value-chain'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'adjacent-industry-chain', title: 'AI 이후의 인접 산업', level: '심화', summary: 'AI의 가치가 로봇·방산·바이오·서비스로 확장되는 경로를 단계별로 검증합니다.', body: '응용 산업은 모델 성능만으로 열리지 않습니다. 센서와 제어, 안전·보안, 규제·임상 검증, 구매자 예산과 반복 사용량이 함께 충족되어야 현금흐름이 생깁니다.', nodeIds: ['robotics-automation', 'defense-space', 'biotech-healthcare', 'finance-software-consumer'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'korea-market-bridge', title: '한국 투자자가 읽는 산업 연결', level: '심화', summary: '글로벌 산업 변화가 원화·달러·정책·공급망을 통해 한국 시장에 전달되는 경로를 봅니다.', body: '한국 기업을 볼 때 최종 수요처, 달러 매출, 원화 비용, 외국인 수급, 정책 지원, 고객 집중도를 분리합니다. 국가와 기업의 이해관계를 동일시하지 말고 공시와 공식 통계를 우선 확인합니다.', nodeIds: ['us-korea-market', 'krw-dollar-foreign-flow', 'korea-semiconductor-policy'], route: 'fxbond', routeLabel: '환율·채권 화면 열기' }),
    Object.freeze({ id: 'cashflow-and-tax', title: '성장을 현금흐름으로 검증하기', level: '입문', summary: '매출 성장·회계이익·실제 현금 회수를 분리하면 투자 서사의 취약점이 보입니다.', body: 'CAPEX와 감가상각, 운전자본, 세금, 주식보상, 부채 만기를 함께 읽어야 합니다. 회계상 이익이 커져도 현금 전환이 약하거나 재투자 부담이 커지면 주주가치의 경로는 달라질 수 있습니다.', nodeIds: ['tax-accounting-cashflow', 'company-stock-valuation', 'investment-risk'], route: 'fundamental', routeLabel: '기업 분석 화면 열기' })
  ]),
  paths: Object.freeze([
    Object.freeze({ id: 'power-and-infrastructure', title: '전력에서 AI 인프라까지', description: '전력 시스템·계통·저장·데이터센터 수요를 따라 물리적 병목을 읽습니다.', lessonIds: ['electricity-system', 'generation-and-mix', 'grid-and-storage', 'data-center-demand', 'industrial-bottlenecks'] }),
    Object.freeze({ id: 'industry-and-korea', title: 'AI 이후 산업과 한국 시장', description: '인접 산업·환율·정책·현금흐름을 연결해 지역 시장으로 전달되는 경로를 확인합니다.', lessonIds: ['adjacent-industry-chain', 'korea-market-bridge', 'cashflow-and-tax', 'evidence-loop'] }),
    Object.freeze({ id: 'ai-systems-and-economics', title: 'AI 시스템과 경제성', description: '워크로드가 계산·메모리·패키징·전력·자본비용을 거쳐 현금흐름으로 번역되는 경로입니다.', lessonIds: ['ai-semiconductor', 'inference-storage', 'data-center-power', 'industry-value-pools', 'ai-market-bridge'] }),
    Object.freeze({ id: 'capital-risk-and-evidence', title: '자본·리스크·검증', description: '금리·기업·가격·손실 한도·출처 검증을 한 번의 판단 루프로 묶습니다.', lessonIds: ['rates-and-central-bank', 'company-and-stock', 'price-discovery', 'investing-and-survival', 'evidence-loop'] })
  ])
});

const APPLICATIONS_EXPANSION = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({ id: 'physical-ai-perception', type: 'industry', title: 'Physical AI 인지·센서 융합', summary: '카메라·라이다·촉각·상태 신호를 하나의 세계 상태로 묶어 행동 가능한 입력으로 만드는 단계입니다.', layer: 'L3', sourceName: 'NIST Robotics', sourceUrl: 'https://www.nist.gov/topics/robotics', x: 15, y: 20 }),
    Object.freeze({ id: 'physical-ai-planning', type: 'industry', title: 'Physical AI 계획·경로 생성', summary: '목표·제약·예측된 상태를 바탕으로 다음 행동의 순서를 고르는 소프트웨어 계층입니다.', layer: 'L4', sourceName: 'Tesla AI', sourceUrl: 'https://www.tesla.com/AI', x: 30, y: 30 }),
    Object.freeze({ id: 'physical-ai-control', type: 'industry', title: 'Physical AI 제어·작동', summary: '계획을 모터·차량·로봇의 실제 움직임으로 바꾸며 지연·안전·인간 개입을 함께 관리합니다.', layer: 'L4', sourceName: 'Shield AI Hivemind', sourceUrl: 'https://shield.ai/hivemind/', x: 45, y: 40 }),
    Object.freeze({ id: 'robot-unit-economics', type: 'economics', title: '로봇 단위경제', summary: '하드웨어 원가뿐 아니라 가동률·유지보수·현장 통합·작업 성공률을 함께 봐야 하는 경제성 문제입니다.', layer: 'L6', sourceName: 'OECD AI', sourceUrl: 'https://oecd.ai/en/', x: 60, y: 50 }),
    Object.freeze({ id: 'defense-autonomy', type: 'industry', title: '방산 자율화와 인간 통제', summary: '탐지·판단·행동의 자동화 수준과 통신 단절·오판·인간 승인 경계를 함께 평가합니다.', layer: 'L4', sourceName: 'Shield AI Hivemind', sourceUrl: 'https://shield.ai/hivemind/', x: 15, y: 55 }),
    Object.freeze({ id: 'defense-procurement', type: 'economics', title: '방산 조달과 생산 지속성', summary: '시연 성능보다 반복 생산·정비·보급·계약 인식이 임무 지속성과 사업성을 결정합니다.', layer: 'L6', sourceName: 'U.S. Department of Defense', sourceUrl: 'https://www.defense.gov/Topics/Technology/', x: 30, y: 65 }),
    Object.freeze({ id: 'space-launch-economics', type: 'industry', title: '우주 발사 서비스', summary: '발사체 물리와 발사 성공률, 재사용 회전율, 발사장·보험·고객 일정이 하나의 운영 시스템을 이룹니다.', layer: 'L3', sourceName: 'Rocket Lab', sourceUrl: 'https://rocketlabcorp.com/space-systems/spacecraft/', x: 45, y: 70 }),
    Object.freeze({ id: 'space-systems-economics', type: 'economics', title: '우주 시스템 가치사슬', summary: '발사·위성·부품·지상국·데이터 서비스를 분리해야 어느 단계가 반복 매출과 병목을 갖는지 보입니다.', layer: 'L5', sourceName: 'Rocket Lab', sourceUrl: 'https://rocketlabcorp.com/space-systems/spacecraft/', x: 60, y: 75 }),
    Object.freeze({ id: 'enterprise-ai-workflow', type: 'industry', title: '기업 AI 워크플로 통합', summary: '모델보다 데이터 권한·업무 맥락·감사 로그·사람의 승인 흐름이 실제 도입의 경계를 만듭니다.', layer: 'L4', sourceName: 'Palantir AIP', sourceUrl: 'https://www.palantir.com/platforms/aip/', x: 75, y: 15 }),
    Object.freeze({ id: 'ai-workflow-adoption', type: 'economics', title: 'AI 업무 도입과 전환비용', summary: '시간 절약이 매출이나 현금흐름으로 이어지려면 조직 재설계·교육·검수·전환비용을 함께 통과해야 합니다.', layer: 'L5', sourceName: 'Siemens Industrial Copilot', sourceUrl: 'https://www.siemens.com/en-us/company/insights/generative-ai-industrial-copilot/', x: 85, y: 25 }),
    Object.freeze({ id: 'application-roi-evidence', type: 'method', title: 'AI 애플리케이션 ROI 검증', summary: '사용량이나 토큰 가격 대신 작업 성공률·처리시간·오류비용·유지비용을 기준선과 비교합니다.', layer: 'L6', sourceName: 'NIST AI Evaluation', sourceUrl: 'https://www.nist.gov/ai', x: 90, y: 35 }),
    Object.freeze({ id: 'rare-earths-supply-chain', type: 'industry', title: '희토류·자석 공급망', summary: '광석·분리·정제·자석·고객 인증은 서로 다른 단계이므로 자원 보유와 다운스트림 공급능력을 구분합니다.', layer: 'L3', sourceName: 'MP Materials', sourceUrl: 'https://www.mpmaterials.com/', x: 70, y: 45 }),
    Object.freeze({ id: 'refining-qualification', type: 'process', title: '정제·재활용·고객 인증', summary: '순도·회수율·공정 수율과 고객 인증 기간이 소재 사업의 실제 병목과 자본회수 속도를 결정합니다.', layer: 'L4', sourceName: 'IEA Critical Minerals', sourceUrl: 'https://www.iea.org/topics/critical-minerals', x: 80, y: 55 }),
    Object.freeze({ id: 'materials-policy', type: 'policy', title: '핵심소재 산업정책', summary: '보조금·수출통제·비축·지역화 정책은 소재의 가격뿐 아니라 공급망 선택과 투자 위치를 바꿉니다.', layer: 'L5', sourceName: 'Japan METI', sourceUrl: 'https://www.meti.go.jp/english/press/2026/0415_001.html', x: 90, y: 65 }),
    Object.freeze({ id: 'hbm-system-bottleneck', type: 'infrastructure', title: 'HBM 시스템 병목', summary: '대역폭·용량·전력·적층수율·패키지 연결을 함께 봐야 메모리 병목을 시스템 관점에서 설명할 수 있습니다.', layer: 'L3', sourceName: 'Samsung Semiconductor HBM', sourceUrl: 'https://semiconductor.samsung.com/dram/hbm/', x: 10, y: 80 }),
    Object.freeze({ id: 'chiplet-economics', type: 'economics', title: '칩렛·패키지 경제성', summary: '다이 분할은 설계 재사용과 수율의 이점을 줄 수 있지만 인터포저·검증·열·패키지 비용을 추가합니다.', layer: 'L5', sourceName: 'TSMC 3DFabric', sourceUrl: 'https://www.tsmc.com/english/dedicatedFoundry/technology/3dfabric', x: 25, y: 85 }),
    Object.freeze({ id: 'quantum-platform', type: 'future', title: '양자 플랫폼과 측정', summary: '큐비트 하드웨어·회로 실행·오류·측정·클라우드 접근을 하나의 실험 루프로 평가해야 합니다.', layer: 'L3', sourceName: 'IBM Quantum', sourceUrl: 'https://www.ibm.com/quantum/products', x: 40, y: 90 }),
    Object.freeze({ id: 'photonic-link-economics', type: 'future', title: '포토닉 링크와 전력/비트', summary: '광 링크는 대역폭·거리·오류율뿐 아니라 전력/비트와 모듈 수율을 함께 봐야 네트워크 병목을 설명할 수 있습니다.', layer: 'L4', sourceName: 'Coherent Networking', sourceUrl: 'https://www.coherent.com/networking', x: 55, y: 90 }),
    Object.freeze({ id: 'data-center-lease-burden', type: 'finance', title: '데이터센터 임차·자금 부담', summary: 'AI 인프라 수요는 서버 CAPEX뿐 아니라 임차·전력계약·감가상각·금융비용으로 재무제표에 전달됩니다.', layer: 'L5', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access', x: 70, y: 90 })
  ]),
  edges: Object.freeze([
    Object.freeze({ from: 'robotics-automation', to: 'physical-ai-perception', relation: '인지 입력' }),
    Object.freeze({ from: 'physical-ai-perception', to: 'physical-ai-planning', relation: '상태 추정' }),
    Object.freeze({ from: 'physical-ai-planning', to: 'physical-ai-control', relation: '행동 계획' }),
    Object.freeze({ from: 'physical-ai-control', to: 'robot-unit-economics', relation: '가동·유지비' }),
    Object.freeze({ from: 'defense-space', to: 'defense-autonomy', relation: '임무 자동화' }),
    Object.freeze({ from: 'defense-autonomy', to: 'defense-procurement', relation: '조달 검증' }),
    Object.freeze({ from: 'space-launch-economics', to: 'space-systems-economics', relation: '우주 가치사슬' }),
    Object.freeze({ from: 'space-systems-economics', to: 'defense-procurement', relation: '정부 고객' }),
    Object.freeze({ from: 'finance-software-consumer', to: 'enterprise-ai-workflow', relation: '업무 적용' }),
    Object.freeze({ from: 'enterprise-ai-workflow', to: 'ai-workflow-adoption', relation: '도입 비용' }),
    Object.freeze({ from: 'ai-workflow-adoption', to: 'application-roi-evidence', relation: '성과 검증' }),
    Object.freeze({ from: 'critical-minerals', to: 'rare-earths-supply-chain', relation: '소재 가치사슬' }),
    Object.freeze({ from: 'rare-earths-supply-chain', to: 'refining-qualification', relation: '정제·인증' }),
    Object.freeze({ from: 'refining-qualification', to: 'materials-policy', relation: '정책 경계' }),
    Object.freeze({ from: 'memory-hbm', to: 'hbm-system-bottleneck', relation: '메모리 시스템' }),
    Object.freeze({ from: 'hbm-system-bottleneck', to: 'chiplet-economics', relation: '패키지 연결' }),
    Object.freeze({ from: 'advanced-packaging', to: 'chiplet-economics', relation: '패키지 비용' }),
    Object.freeze({ from: 'ai-era', to: 'quantum-platform', relation: '인접 연산' }),
    Object.freeze({ from: 'network-fabric', to: 'photonic-link-economics', relation: '광 연결' }),
    Object.freeze({ from: 'ai-capex', to: 'data-center-lease-burden', relation: '자금·임차' })
  ]),
  lessons: Object.freeze([
    Object.freeze({ id: 'physical-ai-loop', title: '물리 AI는 인지에서 작동까지 닫힌 고리다', level: '심화', summary: '센서·상태추정·계획·제어를 나누어야 데모와 현장 운용을 구분할 수 있습니다.', body: '물리 환경에서는 입력이 불완전하고 행동 결과가 다시 다음 입력을 바꿉니다. 따라서 모델 정확도 하나보다 지연·안전·복구·인간 승인까지 연결해 봅니다.', nodeIds: ['physical-ai-perception', 'physical-ai-planning', 'physical-ai-control'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'defense-autonomy-and-procurement', title: '방산 자율화는 생산·통제·조달을 함께 본다', level: '심화', summary: '임무 성능과 반복 생산, 통신 회복, 인간 통제를 같은 검증 프레임에 놓습니다.', body: '자율화의 사업성은 알고리즘 시연만으로 결정되지 않습니다. 조달기관이 요구하는 안전·정비·보급·계약 조건과 운용자의 통제 범위를 함께 확인해야 합니다.', nodeIds: ['defense-autonomy', 'defense-procurement'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'space-stack-economics', title: '우주 산업은 발사와 시스템을 분리해 읽는다', level: '심화', summary: '발사 서비스, 위성, 부품, 지상 인프라, 데이터 매출의 논리를 구분합니다.', body: '발사 성공은 필요조건이지만 반복 매출의 충분조건은 아닙니다. 재사용 회전율·제조 병목·고객 일정·보험·데이터 서비스까지 가치사슬을 이어 봅니다.', nodeIds: ['space-launch-economics', 'space-systems-economics'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'enterprise-ai-adoption', title: '기업 AI는 업무와 통제 안에 들어가야 한다', level: '입문', summary: '데이터 권한과 사람의 검수, 전환비용을 빼고 ROI를 말하지 않습니다.', body: '기업 시스템에서 AI는 독립된 챗봇이 아니라 기존 데이터·권한·업무·감사 로그와 연결됩니다. 도입률이 실제 비용 절감이나 매출로 이어지는지 기준선과 비교합니다.', nodeIds: ['enterprise-ai-workflow', 'ai-workflow-adoption', 'application-roi-evidence'], route: 'fundamental', routeLabel: '기업 분석 화면 열기' }),
    Object.freeze({ id: 'materials-chain-and-policy', title: '핵심소재는 자원보다 정제와 인증이 중요하다', level: '입문', summary: '광석부터 고객 인증까지 단계별 병목과 정책 리스크를 분리합니다.', body: '소재 공급망의 각 단계는 다른 장비·기술·고객 조건을 요구합니다. 자원 보유량을 곧바로 판매 가능 물량이나 마진으로 해석하지 않고 회수율·순도·인증·정책을 확인합니다.', nodeIds: ['rare-earths-supply-chain', 'refining-qualification', 'materials-policy'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'hbm-package-economics', title: 'HBM과 패키지는 하나의 시스템 병목이다', level: '심화', summary: '메모리 대역폭·적층·열·수율·패키지 원가를 함께 읽습니다.', body: '가속기 성능은 연산기만으로 결정되지 않습니다. 메모리와 패키지의 연결, 전력과 열, 고객 인증 시간이 시스템 처리량과 투자회수에 영향을 줍니다.', nodeIds: ['hbm-system-bottleneck', 'chiplet-economics'], route: 'technical', routeLabel: '기술 분석 화면 열기' }),
    Object.freeze({ id: 'quantum-and-photonic-boundary', title: '인접 연산은 측정 가능한 경계부터 본다', level: '심화', summary: '양자와 포토닉 기술을 상용화 주장보다 실험·측정·통합 조건으로 평가합니다.', body: '새로운 연산 방식은 기존 시스템을 즉시 대체한다고 가정하지 않습니다. 하드웨어 접근성·오류·측정·소프트웨어·전력/비트·모듈 수율을 각각 확인합니다.', nodeIds: ['quantum-platform', 'photonic-link-economics'], route: 'themes', routeLabel: '테마 화면 열기' }),
    Object.freeze({ id: 'data-center-financing', title: 'AI 인프라는 임차와 자금조달까지 확장된다', level: '입문', summary: 'CAPEX를 서버 구매만으로 보지 않고 임차·전력계약·감가상각·금융비용으로 연결합니다.', body: '데이터센터 투자는 현금지출과 회계비용, 계약상 의무가 서로 다른 시점에 나타납니다. 수요 전망이 실제 ROIC가 되려면 가동률·자금비용·감가상각·계약 조건을 확인해야 합니다.', nodeIds: ['data-center-lease-burden', 'ai-capex', 'financing'], route: 'fundamental', routeLabel: '기업 분석 화면 열기' }),
    Object.freeze({ id: 'ai-era-system-map', title: 'AI 시대는 하나의 모델이 아니라 연결된 시스템이다', level: '입문', summary: '문제·능력·모델·하드웨어·경제를 같은 층으로 섞지 않고 전달 경로로 연결합니다.', body: 'AI의 변화는 모델 성능만으로 끝나지 않습니다. 사용자의 workload가 계산·메모리·전력·자본·업무 시스템을 거쳐 실제 결과와 현금흐름으로 번역되는지를 단계별로 확인합니다.', nodeIds: ['ai-era', 'ai-workload', 'evaluation'], route: 'atlas', routeLabel: 'AI Era Atlas 열기' }),
    Object.freeze({ id: 'robot-unit-economics', title: '로봇의 성능은 작업 성공과 가동률로 번역된다', level: '심화', summary: '로봇 하드웨어 가격보다 작업 성공률·통합·유지보수·가동률을 함께 읽습니다.', body: '물리 AI의 경제성은 데모 속도나 모델 정확도가 아니라 현장에서 반복적으로 완료한 유효 작업과 그 비용으로 확인합니다. 설치·교육·정비·다운타임·사람의 개입을 단위경제에 포함합니다.', nodeIds: ['robot-unit-economics', 'physical-ai-control', 'application-roi-evidence'], route: 'themes', routeLabel: '테마 화면 열기' })
  ]),
  paths: Object.freeze([])
});

const CATALOG = Object.freeze({
  nodes: Object.freeze([...RAW_CATALOG.nodes, ...MARKET_EXPANSION.nodes, ...SYSTEMS_EXPANSION.nodes, ...APPLICATIONS_EXPANSION.nodes].map((node) => Object.freeze({ ...node, reviewedAt: REVIEWED_AT }))),
  edges: Object.freeze([...RAW_CATALOG.edges, ...MARKET_EXPANSION.edges, ...SYSTEMS_EXPANSION.edges, ...APPLICATIONS_EXPANSION.edges]),
  lessons: Object.freeze([...RAW_CATALOG.lessons, ...MARKET_EXPANSION.lessons, ...SYSTEMS_EXPANSION.lessons, ...APPLICATIONS_EXPANSION.lessons].map((lesson) => Object.freeze({ ...lesson, reviewedAt: REVIEWED_AT }))),
  paths: Object.freeze([...RAW_CATALOG.paths, ...MARKET_EXPANSION.paths, ...SYSTEMS_EXPANSION.paths, ...APPLICATIONS_EXPANSION.paths])
});

const NODE_BY_ID = new Map(CATALOG.nodes.map((node) => [node.id, node]));
const LESSON_BY_ID = new Map(CATALOG.lessons.map((lesson) => [lesson.id, lesson]));

function nodesWithinHops(startId, depth) {
  const distances = new Map([[startId, 0]]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    const currentDistance = distances.get(current) || 0;
    if (currentDistance >= depth) continue;
    CATALOG.edges.forEach((edge) => {
      const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (neighbor && !distances.has(neighbor)) {
        distances.set(neighbor, currentDistance + 1);
        queue.push(neighbor);
      }
    });
  }
  return distances;
}

function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(documentRef, className, text, action, value) {
  const node = element(documentRef, 'button', className, text);
  node.type = 'button';
  node.dataset.principlesAction = action;
  if (value) node.dataset.principlesValue = value;
  return node;
}

function sourceBadge(documentRef, item) {
  const wrap = element(documentRef, 'div', 'principles-source');
  const statusLabels = { REVIEWED_CANDIDATE: '1차 출처 확인 후보', PARTIAL: '일부 확인', REFERENCE_CONNECTED: '학습 원고 연결', AUTHORED_REFERENCE: '학습 원고 작성 완료', NEEDS_REVIEW: '추가 검토 필요' };
  const displayStatus = statusLabels[item.status] || item.status || 'NEEDS_REVIEW';
  const badge = element(documentRef, 'span', `principles-status principles-status-${String(item.status || '').toLowerCase()}`, displayStatus);
  badge.title = '수치·현재 판단이 아닌 콘텐츠 검토 상태';
  const reviewed = element(documentRef, 'span', 'principles-reviewed', `검토 ${item.reviewedAt || REVIEWED_AT}`);
  const link = element(documentRef, 'a', 'principles-source-link', item.sourceName || '원문 출처');
  link.href = item.sourceUrl || '#';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  wrap.append(badge, reviewed, link);
  return wrap;
}

function researchStatusLabel(status) {
  return ({ REFERENCE_CONNECTED: '학습 원고 연결', EDUCATIONAL_REFERENCE_ONLY: '교육용 참고', PARTIAL: '일부 확인', REVIEWED_CANDIDATE: '1차 출처 확인 후보' })[status] || status || '확인 중';
}

function relatedNodes(item) {
  const ids = item.nodeIds || [];
  return ids.map((id) => NODE_BY_ID.get(id)).filter(Boolean);
}

function nodeMatches(node, query) {
  if (!query) return true;
  return [node.title, node.summary, node.layer, node.type].join(' ').toLowerCase().includes(query);
}

function lessonMatches(lesson, query) {
  if (!query) return true;
  return [lesson.title, lesson.summary, lesson.body, lesson.level].join(' ').toLowerCase().includes(query);
}

function researchNode(research, nodeId) {
  const researchId = RESEARCH_NODE_IDS[nodeId];
  return (research?.nodes || []).find((item) => item.id === researchId) || null;
}

function researchEvidenceForNodes(research, nodeIds) {
  const sourceIds = new Set();
  (nodeIds || []).forEach((nodeId) => (researchNode(research, nodeId)?.evidence || []).forEach((sourceId) => sourceIds.add(sourceId)));
  return [...sourceIds];
}

function createEvidenceBlock(documentRef, sourceIds, research) {
  const block = element(documentRef, 'div', 'principles-evidence');
  /*
  const sources = new Map((research?.sources || []).map((source) => [source.id, source]));
  const title = element(documentRef, 'div', 'principles-evidence-title', `Evidence registry ${sourceIds?.length || 0}개`);
  */
  const title = element(documentRef, 'div', 'principles-evidence-title', `Evidence registry ${sourceIds?.length || 0} sources`);
  const sources = new Map((research?.sources || []).map((source) => [source.id, source]));
  const links = element(documentRef, 'div', 'principles-evidence-links');
  (sourceIds || []).forEach((sourceId) => {
    const source = sources.get(sourceId);
    const link = element(documentRef, 'a', 'principles-evidence-link', sourceId);
    link.href = source?.url || '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = source ? `${source.title} · ${source.publisher}` : 'Research source registry';
    links.appendChild(link);
  });
  if (!sourceIds?.length) links.appendChild(element(documentRef, 'span', 'principles-evidence-empty', '연결된 primary source 없음'));
  block.append(title, links);
  return block;
}

const NODE_READING_FRAMES = Object.freeze({
  'ai-era': ['문제·모델·시스템·하드웨어를 같은 층위의 주장으로 섞지 않았는가?', '산업 구조를 설명하는 관찰과 기업 성과를 설명하는 관찰이 분리되어 있는가?'],
  'ai-workload': ['학습과 추론 중 어느 workload를 설명하는가?', '처리량·지연·메모리 이동·저장 요구 중 어떤 병목이 관찰된 것인가?'],
  compute: ['연산량 증가가 실제 시스템 처리량으로 이어지는 조건은 무엇인가?', '가속기 수요와 특정 공급자의 매출·마진 주장을 분리했는가?'],
  'memory-hbm': ['대역폭·용량·전력 중 어떤 메모리 제약을 말하는가?', '제품 발표를 전체 공급·가격·수율 전망으로 확대하지 않았는가?'],
  'advanced-packaging': ['패키징이 연결하는 계산·메모리·열 조건은 무엇인가?', '기술 로드맵과 실제 생산능력·수율의 차이를 확인했는가?'],
  storage: ['추론·KV cache·RAG가 저장장치에 만드는 요구는 무엇인가?', '제품 use case와 전체 NAND 수요·가격 전망을 분리했는가?'],
  'power-cooling': ['전력 인입·냉각·가동률 중 어떤 확장 조건을 검증하는가?', 'CAPEX를 수요의 증거로 곧바로 해석하지 않았는가?'],
  'ai-capex': ['CAPEX가 매출·FCF·감가상각·리스 약정과 어떻게 연결되는가?', '계획된 투자와 이미 인식된 수요를 구분했는가?'],
  visibility: ['LTA·수주·예약·사용량 중 실제 관찰된 매출 단서는 무엇인가?', '고객 집중도와 downside protection을 별도 질문으로 두었는가?'],
  financing: ['금리·리스·신용 조건이 프로젝트의 현금흐름에 어떤 제약을 주는가?', '금융조건의 변화와 주가 방향을 하나의 인과로 단정하지 않았는가?'],
  'geo-rates': ['에너지·공급망·물가·금리 사이에서 실제 관측된 연결고리는 무엇인가?', '정책·시장 반응·기업 valuation을 서로 다른 evidence 층으로 분리했는가?'],
  evaluation: ['주장·출처·관찰시점·단위가 함께 기록되었는가?', '반대 설명과 추가 검증에 필요한 1차 자료가 무엇인가?']
});

const NODE_EXPLANATIONS = Object.freeze({
  'ai-era': { definition: 'AI 시대는 모델 하나의 이야기가 아니라 데이터·연산·메모리·전력·자본·검증이 연결된 생산 시스템의 변화입니다.', intuition: '한 부품의 성능이 올라가도 다른 병목이 남아 있으면 전체 서비스의 경제성은 개선되지 않습니다.', mechanism: '사용 사례가 workload를 만들고, workload가 칩·메모리·네트워크·데이터센터 투자를 유도하며, 매출과 자금조달이 다시 확장을 결정합니다.', kpi: '사용량과 추론 비용, 지연시간, 데이터센터 가동률, CAPEX와 FCF, 계약·매출의 가시성을 함께 봅니다.', connection: '반도체·서버·전력·냉각·클라우드·소프트웨어의 역할을 하나의 전달 경로로 읽는 출발점입니다.', risk: '수요가 실제 사용으로 이어지지 않거나 비용·전력·규제 병목이 풀리지 않으면 성장 주장이 약해집니다.' },
  'ai-workload': { definition: 'AI workload는 학습과 추론에서 발생하는 실제 계산·메모리·통신 작업의 묶음입니다.', intuition: '같은 모델이라도 학습인지 추론인지, 배치인지 실시간인지에 따라 필요한 하드웨어가 달라집니다.', mechanism: '행렬 연산, 메모리 접근, 모델 크기, 토큰 처리량, 사용자 지연 요구가 시스템 설계를 결정합니다.', kpi: '처리량, 지연시간, GPU 사용률, 메모리 대역폭, 요청당 비용, 전력당 성능을 확인합니다.', connection: 'workload 정의가 컴퓨트·HBM·패키징·네트워크·스토리지 수요의 근거가 됩니다.', risk: '벤치마크가 실제 서비스 패턴을 대표하지 않거나, 효율 개선이 사용량 증가로 상쇄될 수 있습니다.' },
  compute: { definition: '컴퓨트는 모델의 계산을 수행하는 가속기·CPU·시스템 소프트웨어의 조합입니다.', intuition: '칩의 이론 성능보다 필요한 계산을 얼마나 빠르고 싸게, 안정적으로 처리하는지가 중요합니다.', mechanism: '연산 유닛과 메모리 계층, 인터커넥트, 컴파일러와 라이브러리가 함께 성능을 만듭니다.', kpi: '실제 workload 처리량, 지연시간, 전력당 성능, 공급 가능 수량, 총소유비용을 봅니다.', connection: '가속기 선택은 HBM·첨단 패키징·전력·데이터센터 CAPEX로 연쇄 전달됩니다.', risk: '소프트웨어 생태계 전환 비용, 공급 제약, 활용률 저하가 예상 성능을 실현하지 못하게 할 수 있습니다.' },
  'memory-hbm': { definition: 'HBM은 가속기 가까이에 높은 대역폭으로 데이터를 공급하는 적층 메모리입니다.', intuition: '연산기가 빨라도 필요한 데이터가 늦게 도착하면 전체 시스템은 메모리 병목으로 멈춥니다.', mechanism: '다이 적층과 넓은 인터페이스, TSV·패키징 기술이 대역폭과 용량·전력의 균형을 결정합니다.', kpi: '대역폭, 용량, 수율, 적층 세대, 전력, 공급 리드타임과 고객 인증을 확인합니다.', connection: 'HBM은 메모리 제조사뿐 아니라 GPU·패키징·기판·테스트 업체의 병목과 연결됩니다.', risk: '높은 난이도의 수율·발열·공급 집중도가 출하량과 마진을 제한할 수 있습니다.' },
  'advanced-packaging': { definition: '첨단 패키징은 서로 다른 칩렛과 메모리를 하나의 고성능 시스템으로 연결하는 후공정 기술입니다.', intuition: '미세공정만으로는 성능·비용·수율을 동시에 개선하기 어려워 패키지가 시스템 설계의 일부가 됩니다.', mechanism: '칩렛 배치, 인터포저·브리지, 열 설계, 전력 공급, 테스트가 함께 동작해야 합니다.', kpi: '패키지 크기와 대역폭, 수율, 생산능력, 열 특성, 고객 인증 기간을 봅니다.', connection: '파운드리의 FEOL 기술과 HBM, 기판, 장비, 데이터센터 전력 제약을 이어줍니다.', risk: '조립 수율과 열·전력 문제가 양산을 늦추거나 비용 우위를 없앨 수 있습니다.' },
  storage: { definition: '스토리지는 모델·데이터·체크포인트·검색 인덱스를 저장하고 이동시키는 계층입니다.', intuition: '추론이 빨라도 데이터를 읽고 쓰는 시간이 길면 사용자 경험과 비용이 악화됩니다.', mechanism: 'NAND·SSD·파일시스템·캐시·네트워크가 용량, 지연시간, 내구성, 비용을 나눠 담당합니다.', kpi: 'IOPS, 처리량, 지연시간, GB당 비용, 내구성, 데이터 이동량과 캐시 적중률을 봅니다.', connection: '추론·RAG·데이터 파이프라인의 성장과 SSD·네트워크·전력 수요를 연결합니다.', risk: '저장 용량 증가가 실제 수익으로 이어지지 않거나 가격 하락이 공급업체의 경제성을 압박할 수 있습니다.' },
  'power-cooling': { definition: '전력·냉각은 데이터센터가 계산 장비를 지속적으로 가동하게 하는 물리적 제약입니다.', intuition: '서버를 더 설치할 공간보다 전력 인입과 열을 처리할 능력이 먼저 부족해질 수 있습니다.', mechanism: '전력망·변전·UPS·냉각·랙 밀도·시설 가동률이 함께 데이터센터 처리능력을 제한합니다.', kpi: '전력 사용량, PUE, 랙 전력 밀도, 냉각 용량, 인허가·접속 대기시간, 전력 단가를 봅니다.', connection: 'AI CAPEX가 실제 서비스 공급능력으로 바뀌는 마지막 물리적 게이트입니다.', risk: '전력 접속 지연, 비용 상승, 지역 규제, 물 부족과 열 설계 실패가 확장을 막을 수 있습니다.' },
  'ai-capex': { definition: 'AI CAPEX는 서버·네트워크·데이터센터·전력 인프라에 투입되는 장기 투자입니다.', intuition: '투자액 자체보다 그 투자가 반복 매출과 현금흐름으로 전환되는지가 중요합니다.', mechanism: '수요 전망과 계약, 공급능력, 감가상각, 가동률, 자금조달이 투자 회수 구조를 만듭니다.', kpi: 'CAPEX 성장률, 감가상각, FCF, 가동률, 예약·계약 매출, 고객 집중도와 투자 회수기간을 봅니다.', connection: '컴퓨트·메모리·전력의 수요를 기업의 매출·마진·자본배분으로 번역합니다.', risk: '과잉 투자, 수요 둔화, 기술 세대 교체, 자금비용 상승으로 회수가 늦어질 수 있습니다.' },
  visibility: { definition: '매출 가시성은 계약·예약·백로그·고객 사용량처럼 미래 매출을 관찰할 수 있는 정도입니다.', intuition: '좋은 기술도 고객이 언제 얼마나 쓸지 보이지 않으면 기업 실적의 불확실성은 큽니다.', mechanism: '계약 기간과 해지 조건, 사용량 기반 과금, 고객 집중도, 갱신률이 현재 매출과 미래 매출을 연결합니다.', kpi: '백로그, RPO, 예약률, 갱신률, 순매출 유지율, 고객 집중도와 매출 인식 시점을 확인합니다.', connection: 'AI 인프라 투자가 실제 기업 수익으로 전달되는 상업적 증거입니다.', risk: '계약이 취소되거나 사용량이 기대에 못 미치고, 고객의 자체 구축이 외부 매출을 대체할 수 있습니다.' },
  financing: { definition: '금융·신용은 기업과 프로젝트가 성장 투자를 언제, 어떤 비용으로 조달할 수 있는지를 결정합니다.', intuition: '같은 사업 기회도 금리와 신용 조건이 바뀌면 투자 가능한 규모와 가치가 달라집니다.', mechanism: '정책금리·채권금리·스프레드·담보·현금흐름이 자본비용과 투자 속도를 바꿉니다.', kpi: '자금조달 비용, 순부채, 이자보상, 만기 구조, 스프레드, FCF와 자본비용을 봅니다.', connection: 'CAPEX 계획을 기업의 밸런스시트와 시장 가치로 연결합니다.', risk: '금리 상승, 신용 스프레드 확대, 만기 집중, 현금흐름 부족이 확장을 급격히 늦출 수 있습니다.' },
  'geo-rates': { definition: '지정학·원자재·금리는 공급망과 자본비용을 동시에 움직이는 외부 조건입니다.', intuition: '한 지역의 정책이나 에너지 가격이 칩 공급, 전력비, 환율, 할인율에 동시에 영향을 줄 수 있습니다.', mechanism: '수출통제·관세·에너지 공급·중앙은행 정책이 비용·납기·수요·가치평가에 전달됩니다.', kpi: '에너지 가격, 환율, 금리, 공급 리드타임, 수출 규제, 지역별 생산능력을 확인합니다.', connection: '기술 경쟁을 산업정책·공급망·거시금융의 문제로 확장해 읽게 합니다.', risk: '규제 변화와 공급 충격의 방향·시점이 불확실하며, 기업이 비용을 고객에게 전가하지 못할 수 있습니다.' },
  evaluation: { definition: '검증 프레임은 주장·출처·관찰·해석을 분리해 기술과 시장 이야기를 검증하는 방법입니다.', intuition: '좋아 보이는 숫자 하나보다 무엇을 직접 관찰했고 무엇을 추론했는지를 구분해야 합니다.', mechanism: '1차 출처를 먼저 확인하고, 관찰 사실과 해석·가정·실패 조건을 별도로 기록합니다.', kpi: '출처의 1차성, 기준일, 재현성, 주장별 근거, 반증 조건과 최신성 상태를 봅니다.', connection: '모든 산업 노드를 투자 신호가 아니라 검증 가능한 학습·분석 단위로 연결합니다.', risk: '출처가 오래됐거나 홍보성 주장만 남거나, 상관관계를 인과관계로 오인하면 분석이 무너집니다.' }
});

const LEARNING_TRACKS = Object.freeze([
  { id: 'quick-15', title: '15분 · AI 시스템 지도', description: 'AI가 어떤 작업을 만들고 어떤 하드웨어를 필요로 하는지 먼저 잡습니다.', nodes: ['ai-era', 'ai-workload', 'compute', 'memory-hbm'] },
  { id: 'core-30', title: '30분 · 인프라와 투자', description: '패키징·전력·CAPEX·금융을 연결해 공급능력과 투자 회수 구조를 봅니다.', nodes: ['advanced-packaging', 'power-cooling', 'ai-capex', 'financing'] },
  { id: 'deep-45', title: '45분 · 시장으로 전달되는 과정', description: '지정학·가시성·검증까지 포함해 기술 주장이 기업과 시장에 전달되는 경로를 확인합니다.', nodes: ['geo-rates', 'visibility', 'evaluation'] }
]);

function createNodeExplanation(documentRef, node) {
  const explanation = NODE_EXPLANATIONS[node?.id] || (() => {
    const lesson = [...MARKET_EXPANSION.lessons, ...SYSTEMS_EXPANSION.lessons, ...APPLICATIONS_EXPANSION.lessons].find((item) => item.nodeIds?.includes(node?.id));
    return node ? {
      definition: node.summary,
      intuition: lesson?.summary || '개념을 결과가 아니라 원인·제약·대체 설명의 연결로 읽습니다.',
      mechanism: lesson?.body || '입력·제약·전달 경로·결과를 분리해 확인합니다.',
      kpi: '관찰 기간·단위·현금흐름·가격·수요·공급능력 중 주장에 맞는 지표를 선택합니다.',
      connection: '상위 원리와 하위 산업·기업·전문 화면의 연결을 확인합니다.',
      risk: '개념 설명을 현재 가격·기업 실적·매매 신호로 곧바로 확장하지 않습니다.'
    } : null;
  })();
  if (!explanation) return null;
  const block = element(documentRef, 'section', 'principles-explainer');
  block.append(element(documentRef, 'h4', 'principles-explainer-title', '이 원리를 읽는 법'));
  [['정의', explanation.definition], ['직관', explanation.intuition], ['작동 방식', explanation.mechanism], ['핵심 KPI', explanation.kpi], ['산업 연결', explanation.connection], ['실패 조건', explanation.risk]].forEach(([label, body]) => {
    const item = element(documentRef, 'div', 'principles-explainer-item');
    item.append(element(documentRef, 'strong', 'principles-explainer-label', label), element(documentRef, 'p', 'principles-explainer-body', body));
    block.appendChild(item);
  });
  block.appendChild(element(documentRef, 'p', 'principles-explainer-asof', `개념 설명 검토 기준일 ${REVIEWED_AT} · 현재 가격·목표가·매매 신호가 아닌 구조적 학습 자료`));
  return block;
}

function createLearningTracks(documentRef) {
  const block = element(documentRef, 'section', 'principles-learning-tracks');
  block.append(element(documentRef, 'div', 'principles-eyebrow', '학습 순서'), element(documentRef, 'h3', 'principles-learning-title', '15·30·45분으로 시장 원리 익히기'));
  const grid = element(documentRef, 'div', 'principles-learning-grid');
  LEARNING_TRACKS.forEach((track) => {
    const card = element(documentRef, 'article', 'principles-learning-card');
    card.dataset.principlesTrack = track.id;
    card.append(element(documentRef, 'h4', 'principles-learning-card-title', track.title), element(documentRef, 'p', 'principles-learning-card-copy', track.description));
    const steps = element(documentRef, 'div', 'principles-learning-steps');
    track.nodes.forEach((nodeId, index) => steps.appendChild(element(documentRef, 'span', 'principles-learning-step', `${index + 1}. ${NODE_BY_ID.get(nodeId)?.title || nodeId}`)));
    card.appendChild(steps);
    grid.appendChild(card);
  });
  block.appendChild(grid);
  return block;
}

function createLessonLibrary(documentRef, artifact, query) {
  const block = element(documentRef, 'section', 'principles-lesson-library');
  const lessons = (artifact?.lessons || []).filter((lesson) => !query || [lesson.id, lesson.chapterId, lesson.title, lesson.definition, lesson.mechanism, lesson.example, lesson.counterScenario, lesson.verificationQuestion, lesson.diagram, (lesson.sourceIds || []).join(' ')].join(' ').toLowerCase().includes(query));
  block.append(
    element(documentRef, 'div', 'principles-eyebrow', 'A~O lesson library'),
    element(documentRef, 'h3', 'principles-learning-title', `세부 lesson 원고 · ${lessons.length}/${artifact?.lessons?.length || 0}개 표시`),
    element(documentRef, 'p', 'principles-detail-summary', artifact?.boundary || '세부 lesson 원고를 불러오는 중입니다.')
  );
  const grid = element(documentRef, 'div', 'principles-lesson-library-grid');
  const sourceById = new Map((artifact?.sources || []).map((source) => [source.id, source]));
  lessons.forEach((lesson) => {
    const card = element(documentRef, 'article', 'principles-authored-lesson-card');
    card.dataset.principlesLessonId = lesson.id;
    card.append(
      element(documentRef, 'div', 'principles-eyebrow', `Chapter ${lesson.chapterId} · ${lesson.level} · 학습 원고 작성 완료`),
      element(documentRef, 'h4', 'principles-learning-card-title', `${lesson.id} · ${lesson.title}`),
      element(documentRef, 'p', 'principles-chapter-copy', `정의: ${lesson.definition}`),
      element(documentRef, 'p', 'principles-chapter-copy', `작동 원리: ${lesson.mechanism}`),
      element(documentRef, 'p', 'principles-chapter-copy', `분석 예시: ${lesson.example}`),
      element(documentRef, 'p', 'principles-chapter-copy principles-chapter-counter', `반례·실패 조건: ${lesson.counterScenario}`),
      element(documentRef, 'p', 'principles-chapter-copy principles-chapter-question', `검증 질문: ${lesson.verificationQuestion}`),
      element(documentRef, 'p', 'principles-chapter-copy', `선수 개념: ${(lesson.prerequisites || []).join(' · ')} · 시각화: ${lesson.diagram}`)
    );
    const sources = element(documentRef, 'div', 'principles-evidence-links');
    (lesson.sourceIds || []).forEach((sourceId) => {
      const source = sourceById.get(sourceId);
      const link = element(documentRef, 'a', 'principles-evidence-link', source ? `${sourceId} · ${source.publisher}` : sourceId);
      link.href = source?.url || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = source ? `${source.title} · ${source.publisher}` : 'Lesson source registry';
      sources.appendChild(link);
    });
    card.appendChild(sources);
    grid.appendChild(card);
  });
  if (!lessons.length) grid.appendChild(element(documentRef, 'div', 'principles-empty', '검색 결과가 없습니다.'));
  block.appendChild(grid);
  return block;
}

function createChapterCurriculum(documentRef, chapterArtifact, query) {
  const block = element(documentRef, 'section', 'principles-chapter-curriculum');
  const chapters = (chapterArtifact?.chapters || []).filter((chapter) => !query || [chapter.id, chapter.title, chapter.question, chapter.coreIdea, chapter.mechanism, chapter.counterScenario, chapter.verificationQuestion, (chapter.nodeIds || []).join(' ')].join(' ').toLowerCase().includes(query));
  block.append(
    element(documentRef, 'div', 'principles-eyebrow', 'A~O authored curriculum'),
    element(documentRef, 'h3', 'principles-learning-title', `시장 원리 15개 챕터 · ${chapters.length}개 표시`),
    element(documentRef, 'p', 'principles-detail-summary', chapterArtifact?.boundary || '챕터 원고를 불러오는 중입니다.')
  );
  const grid = element(documentRef, 'div', 'principles-chapter-grid');
  chapters.forEach((chapter) => {
    const card = element(documentRef, 'article', 'principles-chapter-card');
    card.dataset.principlesChapter = chapter.id;
    const meta = element(documentRef, 'div', 'principles-eyebrow', `Chapter ${chapter.id} · 학습 원고 작성 완료`);
    card.append(
      meta,
      element(documentRef, 'h4', 'principles-learning-card-title', chapter.title),
      element(documentRef, 'p', 'principles-chapter-question', `핵심 질문: ${chapter.question}`),
      element(documentRef, 'p', 'principles-chapter-copy', `핵심 원리: ${chapter.coreIdea}`),
      element(documentRef, 'p', 'principles-chapter-copy', `작동 경로: ${chapter.mechanism}`),
      element(documentRef, 'p', 'principles-chapter-copy principles-chapter-counter', `반례·실패 조건: ${chapter.counterScenario}`),
      element(documentRef, 'p', 'principles-chapter-copy principles-chapter-question', `검증 질문: ${chapter.verificationQuestion}`)
    );
    const nodes = element(documentRef, 'div', 'principles-related');
    (chapter.nodeIds || []).forEach((nodeId) => nodes.appendChild(element(documentRef, 'span', 'principles-related-chip', NODE_BY_ID.get(nodeId)?.title || nodeId)));
    card.append(nodes, sourceBadge(documentRef, { status: 'REVIEWED_CANDIDATE', sourceName: chapter.sourceName, sourceUrl: chapter.sourceUrl, reviewedAt: REVIEWED_AT }));
    grid.appendChild(card);
  });
  if (!chapters.length) grid.appendChild(element(documentRef, 'div', 'principles-empty', query ? `"${query}"와 일치하는 챕터가 없습니다.` : '챕터 원고를 불러오는 중입니다.'));
  block.appendChild(grid);
  return block;
}

function researchClaimsForNode(research, nodeId) {
  const sourceIds = new Set(researchNode(research, nodeId)?.evidence || []);
  if (!sourceIds.size) return [];
  return (research?.claims || []).filter((claim) => (claim.evidence || []).some((sourceId) => sourceIds.has(sourceId)));
}

function createResearchAnalysis(documentRef, node, research) {
  const block = element(documentRef, 'section', 'principles-analysis-block');
  const sourceIds = researchNode(research, node?.id)?.evidence || [];
  const claims = researchClaimsForNode(research, node?.id);
  block.append(
    element(documentRef, 'div', 'principles-eyebrow', '자료 기반 분석'),
    element(documentRef, 'h4', 'principles-analysis-title', '출처에서 관찰과 해석 분리하기'),
    element(documentRef, 'p', 'principles-analysis-intro', `${claims.length}개 연결 주장 · ${sourceIds.length}개 1차 출처 · 상태 ${researchStatusLabel(research?.status)}`)
  );
  if (claims.length) {
    const claimList = element(documentRef, 'div', 'principles-analysis-claims');
    const sources = new Map((research?.sources || []).map((source) => [source.id, source]));
    claims.forEach((claim) => {
      const card = element(documentRef, 'article', 'principles-analysis-claim');
      card.append(
        element(documentRef, 'div', 'principles-analysis-claim-meta', `${claim.id} · ${researchStatusLabel(claim.status)}`),
        element(documentRef, 'h5', 'principles-analysis-claim-title', claim.title),
        element(documentRef, 'p', 'principles-analysis-claim-summary', claim.summary)
      );
      if (claim.observations?.length) {
        const observations = element(documentRef, 'ul', 'principles-analysis-observations');
        claim.observations.forEach((observation) => observations.appendChild(element(documentRef, 'li', '', observation)));
        card.appendChild(observations);
      }
      const evidence = element(documentRef, 'div', 'principles-analysis-claim-sources');
      (claim.evidence || []).forEach((sourceId) => {
        const source = sources.get(sourceId);
        const link = element(documentRef, 'a', 'principles-analysis-source-link', sourceId);
        link.href = source?.url || '#';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = source ? `${source.title} · ${source.publisher}` : 'Research source registry';
        evidence.appendChild(link);
      });
      card.appendChild(evidence);
      claimList.appendChild(card);
    });
    block.appendChild(claimList);
  } else {
    block.appendChild(element(documentRef, 'p', 'principles-analysis-empty', '이 노드에는 아직 claim-level primary-source 분석이 연결되지 않았습니다. 구조적 설명만 제공하며 현재 수치나 판단을 생성하지 않습니다.'));
  }
  const frame = element(documentRef, 'div', 'principles-reading-frame');
  frame.appendChild(element(documentRef, 'strong', 'principles-reading-frame-title', '이 노드를 읽을 때 확인할 질문'));
  const questions = element(documentRef, 'ul', 'principles-reading-frame-list');
  (NODE_READING_FRAMES[node?.id] || ['무엇이 관찰값이고 무엇이 추론인가?', '관찰시점·단위·대체 설명을 함께 확인했는가?']).forEach((question) => questions.appendChild(element(documentRef, 'li', '', question)));
  frame.appendChild(questions);
  frame.appendChild(element(documentRef, 'p', 'principles-analysis-boundary', '경계: 이 요약은 Telegram 발견 자료와 공식 primary source를 연결한 연구 참고층이며, 현재 가격·목표가·매매 신호가 아닙니다.'));
  block.appendChild(frame);
  return block;
}

function createNodeCard(documentRef, node, selected, onSelect, research) {
  const card = button(documentRef, `principles-node-card${selected ? ' is-selected' : ''}`, '', 'select-node', node.id);
  card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  const title = element(documentRef, 'strong', 'principles-node-title', node.title);
  const meta = element(documentRef, 'span', 'principles-node-meta', `${node.layer} · ${node.type}`);
  const summary = element(documentRef, 'span', 'principles-node-summary', node.summary);
  const evidence = researchNode(research, node.id)?.evidence || [];
  card.append(title, meta, summary, element(documentRef, 'span', 'principles-node-evidence', evidence.length ? `Evidence ${evidence.join(' · ')}` : 'Evidence pending'));
  card.addEventListener('click', onSelect);
  return card;
}

function createSvgGraph(documentRef, selectedId, visibleNodes, visibleEdges) {
  const graph = element(documentRef, 'div', 'principles-graph-canvas');
  const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'AI 산업 가치사슬 관계 그래프. 노드 상세는 아래 텍스트 목록에서 확인할 수 있습니다.');
  const visible = new Set(visibleNodes.map((node) => node.id));
  visibleEdges.filter((edge) => visible.has(edge.from) && visible.has(edge.to)).forEach((edge) => {
    const from = NODE_BY_ID.get(edge.from);
    const to = NODE_BY_ID.get(edge.to);
    const line = documentRef.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(from.x));
    line.setAttribute('y1', String(from.y));
    line.setAttribute('x2', String(to.x));
    line.setAttribute('y2', String(to.y));
    line.setAttribute('class', `principles-edge${edge.from === selectedId || edge.to === selectedId ? ' is-active' : ''}`);
    line.setAttribute('aria-label', `${from.title}에서 ${to.title}: ${edge.relation}`);
    svg.appendChild(line);
  });
  graph.appendChild(svg);
  visibleNodes.forEach((node) => {
    const item = element(documentRef, 'div', `principles-graph-node${node.id === selectedId ? ' is-selected' : ''}`);
    item.style.left = `${node.x}%`;
    item.style.top = `${node.y}%`;
    const nodeButton = button(documentRef, 'principles-graph-node-button', node.title, 'select-node', node.id);
    nodeButton.setAttribute('aria-pressed', node.id === selectedId ? 'true' : 'false');
    nodeButton.title = node.summary;
    item.appendChild(nodeButton);
    graph.appendChild(item);
  });
  return graph;
}

function createNodeDetail(documentRef, node, lesson, onRoute, research) {
  const detail = element(documentRef, 'article', 'principles-detail-card');
  if (node) {
    detail.append(
      element(documentRef, 'div', 'principles-eyebrow', `${node.layer} · ${node.type}`),
      element(documentRef, 'h3', 'principles-detail-title', node.title),
      element(documentRef, 'p', 'principles-detail-summary', node.summary),
      createNodeExplanation(documentRef, node),
      sourceBadge(documentRef, { ...node, reviewedAt: REVIEWED_AT }),
      createEvidenceBlock(documentRef, researchNode(research, node.id)?.evidence || [], research),
      createResearchAnalysis(documentRef, node, research)
    );
    detail.querySelector('.principles-detail-title')?.setAttribute('tabindex', '-1');
  }
  if (lesson) {
    const lessonBlock = element(documentRef, 'div', 'principles-lesson-detail');
    lessonBlock.append(
      element(documentRef, 'div', 'principles-eyebrow', `${lesson.level} 레슨`),
      element(documentRef, 'h4', 'principles-lesson-title', lesson.title),
      element(documentRef, 'p', 'principles-detail-summary', lesson.body)
    );
    const related = element(documentRef, 'div', 'principles-related');
    relatedNodes(lesson).forEach((relatedNode) => related.appendChild(element(documentRef, 'span', 'principles-related-chip', relatedNode.title)));
    lessonBlock.appendChild(related);
    if (lesson.route) {
      const routeButton = button(documentRef, 'principles-route-button', lesson.routeLabel, 'route', lesson.route);
      routeButton.addEventListener('click', onRoute);
      lessonBlock.appendChild(routeButton);
    }
    detail.appendChild(lessonBlock);
  }
  return detail;
}

export function createPrinciplesPage({ root = globalThis, documentRef = root.document } = {}) {
  return {
    route: 'principles',
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-principles');
      if (!page) return () => bag.dispose();
      const content = page.querySelector('[data-principles-content]');
      if (!content) return () => bag.dispose();
       const state = { mode: 'tree', query: '', selectedId: 'ai-era', selectedLessonId: 'money-rates', pathId: 'beginner', step: 0, depth: 1, research: null, chapters: null, lessonLibrary: null, researchError: false, chaptersError: false, lessonLibraryError: false };
      page.dataset.aioArchitectureRoute = 'principles';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;

      const route = (routeId) => {
        if (typeof root?.showPage === 'function') root.showPage(routeId);
      };

      const focusDetail = () => {
        const heading = page.querySelector('.principles-detail-title');
        if (!heading) return;
        heading.scrollIntoView({ block: 'start', behavior: 'auto' });
        heading.focus({ preventScroll: true });
      };

      const selectNode = (nodeId) => {
        state.selectedId = nodeId;
        render();
        queueMicrotask(focusDetail);
      };

      function visibleGraphNodes() {
        // KG-05: keep the first graph view within the 9–15 node density
        // contract; depth changes edge emphasis/navigation, not discoverability.
        const distances = nodesWithinHops(state.selectedId, state.depth);
        const scoped = CATALOG.nodes.filter((node) => distances.has(node.id));
        if (!state.query) return scoped;
        return scoped.filter((node) => nodeMatches(node, state.query) || node.id === state.selectedId);
      }

      function renderToolbar() {
        const toolbar = element(documentRef, 'div', 'principles-toolbar');
        const modes = element(documentRef, 'div', 'principles-mode-tabs');
        [['tree', 'Tree 계층'], ['graph', 'Graph 관계'], ['path', 'Path 학습']].forEach(([mode, label]) => {
          const tab = button(documentRef, `principles-mode-tab${state.mode === mode ? ' is-active' : ''}`, label, 'mode', mode);
          tab.setAttribute('aria-pressed', state.mode === mode ? 'true' : 'false');
          modes.appendChild(tab);
        });
        const search = element(documentRef, 'label', 'principles-search');
        const searchLabel = element(documentRef, 'span', 'principles-sr-only', '시장 원리 검색');
        const input = element(documentRef, 'input', 'principles-search-input');
        input.type = 'search';
        input.placeholder = '노드·레슨 검색';
        input.value = state.query;
        input.setAttribute('aria-label', '노드·레슨 검색');
        input.addEventListener('input', (event) => { state.query = String(event.target.value || '').trim().toLowerCase(); render(); });
        search.append(searchLabel, input);
        toolbar.append(modes, search);
        if (state.mode === 'graph') {
          const depth = element(documentRef, 'div', 'principles-depth-toggle');
          [1, 2].forEach((value) => {
            const toggle = button(documentRef, `principles-depth-button${state.depth === value ? ' is-active' : ''}`, `${value}-hop`, 'depth', String(value));
            depth.appendChild(toggle);
          });
          toolbar.appendChild(depth);
        }
        return toolbar;
      }

      function renderTree() {
        const layout = element(documentRef, 'div', 'principles-workspace');
        const list = element(documentRef, 'div', 'principles-tree-list');
        const matchingNodes = CATALOG.nodes.filter((node) => nodeMatches(node, state.query));
         matchingNodes.forEach((node) => list.appendChild(createNodeCard(documentRef, node, state.selectedId === node.id, () => selectNode(node.id), state.research)));
        if (!matchingNodes.length) list.appendChild(element(documentRef, 'div', 'principles-empty', `"${state.query}"와 일치하는 노드가 없습니다.`));
        layout.appendChild(list);
         layout.appendChild(createNodeDetail(documentRef, NODE_BY_ID.get(state.selectedId), LESSON_BY_ID.get(state.selectedLessonId), () => route(LESSON_BY_ID.get(state.selectedLessonId)?.route), state.research));
        return layout;
      }

      function renderGraph() {
        const layout = element(documentRef, 'div', 'principles-workspace principles-graph-workspace');
        const nodes = visibleGraphNodes();
        const visibleIds = new Set(nodes.map((node) => node.id));
        const edges = CATALOG.edges.filter((edge) => visibleIds.has(edge.from) && visibleIds.has(edge.to));
        layout.dataset.principlesGraphNodeCount = String(nodes.length);
        layout.dataset.principlesGraphEdgeCount = String(edges.length);
        layout.appendChild(createSvgGraph(documentRef, state.selectedId, nodes, edges));
        const list = element(documentRef, 'div', 'principles-graph-mobile-list');
        list.setAttribute('aria-label', '그래프 노드 텍스트 목록');
         nodes.forEach((node) => list.appendChild(createNodeCard(documentRef, node, state.selectedId === node.id, () => selectNode(node.id), state.research)));
        layout.appendChild(list);
         layout.appendChild(createNodeDetail(documentRef, NODE_BY_ID.get(state.selectedId), LESSON_BY_ID.get(state.selectedLessonId), () => route(LESSON_BY_ID.get(state.selectedLessonId)?.route), state.research));
        return layout;
      }

      function renderPath() {
        const path = CATALOG.paths.find((item) => item.id === state.pathId) || CATALOG.paths[0];
        const lessonIds = path.lessonIds.filter((id) => lessonMatches(LESSON_BY_ID.get(id), state.query));
        const lesson = LESSON_BY_ID.get(lessonIds[state.step] || lessonIds[0] || path.lessonIds[0]);
        const layout = element(documentRef, 'div', 'principles-path-layout');
        const pathPicker = element(documentRef, 'div', 'principles-path-picker');
        CATALOG.paths.forEach((item) => {
          const pathButton = button(documentRef, `principles-path-button${item.id === state.pathId ? ' is-active' : ''}`, item.title, 'path-select', item.id);
          pathButton.appendChild(element(documentRef, 'small', 'principles-path-description', item.description));
          pathPicker.appendChild(pathButton);
        });
        const rail = element(documentRef, 'ol', 'principles-path-rail');
        path.lessonIds.forEach((lessonId, index) => {
          const item = LESSON_BY_ID.get(lessonId);
          const stepButton = button(documentRef, `principles-path-step${index === state.step ? ' is-active' : ''}`, `${index + 1}. ${item.title}`, 'step', String(index));
          stepButton.setAttribute('aria-current', index === state.step ? 'step' : 'false');
          rail.appendChild(element(documentRef, 'li', '', ''));
          rail.lastElementChild.appendChild(stepButton);
        });
        const card = element(documentRef, 'article', 'principles-path-card');
        if (lesson && (!state.query || lessonMatches(lesson, state.query))) {
          card.append(element(documentRef, 'div', 'principles-eyebrow', `${lesson.level} · ${state.step + 1}/${path.lessonIds.length}`), element(documentRef, 'h3', 'principles-detail-title', lesson.title), element(documentRef, 'p', 'principles-detail-summary', lesson.summary), element(documentRef, 'p', 'principles-path-body', lesson.body), sourceBadge(documentRef, { status: 'REVIEWED_CANDIDATE', sourceName: '학습 콘텐츠 검토 기록', sourceUrl: 'https://www.sec.gov/edgar/search-and-access', reviewedAt: REVIEWED_AT }));
          const actions = element(documentRef, 'div', 'principles-path-actions');
          const previous = button(documentRef, 'principles-route-button is-secondary', '이전', 'step', String(Math.max(0, state.step - 1)));
          const next = button(documentRef, 'principles-route-button', state.step >= path.lessonIds.length - 1 ? '경로 처음으로' : '다음 단계', 'step', String(state.step >= path.lessonIds.length - 1 ? 0 : state.step + 1));
          actions.append(previous, next);
          card.appendChild(actions);
          card.appendChild(createEvidenceBlock(documentRef, researchEvidenceForNodes(state.research, lesson?.nodeIds), state.research));
          if (lesson.route) {
            const routeButton = button(documentRef, 'principles-route-button is-secondary', lesson.routeLabel, 'route', lesson.route);
            routeButton.addEventListener('click', () => route(lesson.route));
            card.appendChild(routeButton);
          }
        } else {
          card.appendChild(element(documentRef, 'div', 'principles-empty', `"${state.query}"와 일치하는 레슨이 없습니다.`));
        }
        layout.append(pathPicker, rail, card);
        return layout;
      }

      function render() {
        content.replaceChildren(renderToolbar(), createChapterCurriculum(documentRef, state.chapters, state.query), createLessonLibrary(documentRef, state.lessonLibrary, state.query), createLearningTracks(documentRef), state.mode === 'tree' ? renderTree() : state.mode === 'graph' ? renderGraph() : renderPath());
         const count = page.querySelector('[data-principles-result-count]');
         /*
         if (count) count.textContent = `nodes ${CATALOG.nodes.length} · authored lessons ${state.lessonLibrary?.lessons?.length || 0} · evidence ${state.research?.sources?.length || 0} sources · ${state.research ? 'connected' : 'loading'}`;
        if (count) count.textContent = `노드 ${CATALOG.nodes.length}개 · 레슨 ${CATALOG.lessons.length}개 · 출처 검토일 ${REVIEWED_AT}`;
      */
      if (count) count.textContent = `nodes ${CATALOG.nodes.length} · authored lessons ${state.lessonLibrary?.lessons?.length || 0} · evidence ${state.research?.sources?.length || 0} sources · ${state.research ? 'connected' : 'loading'}`;
      }

      const onClick = (event) => {
        const target = event.target.closest?.('[data-principles-action]');
        if (!target || !page.contains(target)) return;
        const action = target.dataset.principlesAction;
        const value = target.dataset.principlesValue;
        if (action === 'mode') state.mode = value;
        if (action === 'depth') state.depth = Number(value) || 1;
        if (action === 'select-node') state.selectedId = value;
        if (action === 'path-select') { state.pathId = value; state.step = 0; }
        if (action === 'step') state.step = Math.max(0, Number(value) || 0);
        if (action !== 'route') {
          event.preventDefault();
          render();
          if (action === 'select-node') queueMicrotask(focusDetail);
        }
      };
      page.addEventListener('click', onClick);
      bag.add(() => page.removeEventListener('click', onClick));
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === 'principles') delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
         delete page.dataset.aioContentKind;
         delete page.dataset.aioReviewedAt;
         delete page.dataset.aioPrinciplesResearch;
         delete page.dataset.aioPrinciplesChapters;
         delete page.dataset.aioPrinciplesLessonLibrary;
         content.replaceChildren();
       });
       render();
       const fetchFn = root?.fetch || globalThis.fetch;
       if (typeof fetchFn === 'function') {
         const loadJson = (url) => fetchFn(url).then((response) => { if (!response.ok) throw new Error(`Principles artifact ${response.status}`); return response.json(); });
          Promise.all([loadJson(RESEARCH_URL), loadJson(CHAPTERS_URL), loadJson(LESSON_LIBRARY_URL)])
            .then(([research, chapters, lessonLibrary]) => { state.research = research; state.chapters = chapters; state.lessonLibrary = lessonLibrary; page.dataset.aioPrinciplesResearch = 'connected'; page.dataset.aioPrinciplesChapters = 'connected'; page.dataset.aioPrinciplesLessonLibrary = 'connected'; render(); })
            .catch(() => { state.researchError = true; state.chaptersError = true; state.lessonLibraryError = true; page.dataset.aioPrinciplesResearch = 'fallback'; page.dataset.aioPrinciplesChapters = 'fallback'; page.dataset.aioPrinciplesLessonLibrary = 'fallback'; render(); });
       }
       return () => bag.dispose();
    }
  };
}

export { CATALOG as MARKET_PRINCIPLES_CATALOG, RESEARCH_URL, CHAPTERS_URL, LESSON_LIBRARY_URL };
