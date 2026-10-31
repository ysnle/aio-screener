// Nathan | Factomind structural frameworks: the part of the Previous Threads reference registry that boot readers
// need (the framework pack the AI planner matches against, the screener setup profile and the screener reference
// metadata). The thread catalogue itself (252 links with access status and post counts) stays in
// nathan-previous-threads.js, which loads with the research corpus on demand and composes the full reference from
// this module. Frameworks name their source posts by title; SOURCE_THREADS resolves those titles to the catalogue's
// X status ids (thread id = `nathan-x-<status>`), so the catalogue does not have to enter the boot set.

export const NATHAN_PREVIOUS_THREADS_IDENTITY = Object.freeze({
  id: 'nathan-previous-threads-20260912',
  reviewedAt: '2026-09-12',
  author: 'Nathan | Factomind'
});

// [catalogue title, X status] for every post a framework cites (same rows as RAW_THREADS / RAW_NOTION_THREADS).
const SOURCE_THREADS = Object.freeze([
  ['아서 헤이즈 블로그 글 분석 (MOVE index, 재정적자, Treasury buyback)', '1914877841801437672'],
  ['금융 시장 불변의 법칙', '1906968123401703631'],
  ['시장의 극단은 생각보다 더 극단적이다', '1906506810380673532'],
  ['대응하라는 조언은 좋은 투자 조언이 아니다', '1897811632728031535'],
  ['가상화폐 시장을 통해 배우는 금융', '1782558858243866839'],
  ['레버리지는 언제 써야 할까?', '1810563648261382390'],
  ['리스크 프레임워크에 관한 생각', '1730853002519736420'],
  ['투자와 삶, 리스크에 대한 생각', '1898198841771671624'],
  ['개인 투자자가 돈을 잃는 근본적인 이유와 금융 시장의 구조', '1903717211824324872'],
  ['예측, 그리고 나쁜 배팅과 좋은 배팅', '1909162905809072508'],
  ['자산 가격 움직임 생각 프레임워크', '1808834880517910742'],
  ['동전 던지기로 알아보는 선반영의 개념', '1818264457967264077'],
  ['아서 헤이즈의 3월 시장 폭락 예측이 좋은 예측인 이유', '1743459856932290834'],
  ['What makes Arthur Hayes’ market crash prediction a good prediction', '1743200309508502004'],
  ['경제정책의 나비효과', '1910448699811258608'],
  ['레이 달리오의 관세 인사이트', '1908104699582251101'],
  ['트럼프 정책에 대한 생각', '1896760622089695364'],
  ['한국에 대한 안타까움', '1895999273332056287'],
  ['ETF는 시장 모멘텀을 강화시킨다', '1762773425473609810'],
  ['BTC ETF flow, 너무 큰 의미를 두지 않아도 된다', '1785117632875946307'],
  ['현물 비트코인 ETF 승인 이후 눈여겨보아야 할 점', '1743999186243354898'],
  ['Cash creation vs. In-kind creation 방식의 차이가 비트코인 ETF 에 미치는 영향은?', '1725816574249169390'],
  ['비트코인 현물 ETF 관련 두 가지 개념 정리', '1716675880775455186'],
  ['ETF 시드 거래가 조정된다는 뜻을 해석해보기', '1738348106427867640'],
  ['증권 거래할 때 비용 초간단 정리', '1813791726609613067'],
  ['ETF 거래 시 비용 절약하는 법', '1813016554986172663'],
  ['선물과 현물의 관계', '1902181741764444483'],
  ['Blackrock Bitcoin ETF의 AP Jane Street 은 어떤 기업일까', '1740986493982875725'],
  ['하이퍼리퀴드의 구조적 결함', '1905118531341230308'],
  ['2024년을 마무리하며 적어보는 금융 시장에 대한 생각', '1872113816512958850'],
  ['한국 개인투자자가 성공하기 쉽지 않은 이유', '1823578073125806432'],
  ['당신의 매매 기법이 작동하지 않는 이유', '1800132910722568580'],
  ['대다수 단기 투자가 실패하는 이유', '1758740704216686786'],
  ['개인투자자들이 단기 전략으로 수익 못 내는 이유', '1716767578968965573'],
  ['레이 달리오의 시장 진단 & 버블 판독법', '1763799601440833551'],
  ['매수 버튼 누르기 전에 생각해볼 점 세 가지', '1795613940455748010'],
  ['성공적인 투자를 위해 반드시 필요한 고민 : 자산을 어떻게 살 것인가?', '1719724910690648280'],
  ['TVL과 예치작의 허상', '1887813679284126110'],
  ['알트 코인은 왜 안오를까?', '1886039036474892735'],
  ['USDC, USDT, 코인원', '1730105900818735323'],
  ['NXPC 백서 읽는 꿀팁', '1913230207642984661'],
  ['NXPC 토큰 디자인', '1888909942519914535'],
  ['NXPC 디자인 하면서 주의했던 점들', '1894265723507413359'],
  ['How to read NXPC whitepaper', '1913226386015482162'],
  ['How my ETF journey led to NXPC designing project', '1894276956184875485'],
  ['NXPC tokenomics design', '1888938155853910209'],
  ['FTX 자금유용 디테일 (WSJ 출처)', '1711350916119675363'],
  ['투자자 보호의 의미', '1708331079218975112'],
  ['투자 하면서 사기 당하지 않기 위해 필요한 태도', '1879121296384196920'],
  ['금융은 단순하다', '1885729674984407283'],
  ['20250409 둠스데이?', '1909759146532241429'],
  ['20250407 위험자산이 녹아내리는 와중에 든 생각', '1909072201363661235'],
  ['20250311 채권 시장을 통해 알아보는 시황', '1899330960589738426'],
  ['20250228 경기부양책', '1895254461578432637'],
  ['20250421 머니프린팅과 패권의 몰락', '1910503804040364385'],
  ['AI 기술로 소비자의 주머니가 열리는 과정', '1802207116188696962'],
  ['20231117 미국 국채 수급에 대한 우려', '1725482289545798140'],
  ['국채 수익률 곡선 설명', '1709225406463873037'],
  ['NXPC 디자인 사전 미팅', '1914945578221625667'],
  ['블랙락의 현물 ETF S-1 서류 업데이트를 통해 도출할 수 있는 인사이트', '1744320571452924329'],
  ['금융시장과 맞닿아있는 일을 하면서 배운 점들', '1809436338275627243'],
  ['가짜뉴스와 사회적 실험', '1712639485828386862'],
  ['전문성에 대한 짧은 생각', '1724815764501475508'],
  ['불변의 법칙 (Same as Ever) 후기 - 모건 하우절의 스토리텔링', '1790676887343370306'],
  ['커리어 돌이켜보았을 때 가장 후회되는 순간', '1911417101954228508'],
  ['성공한 기업을 만들기 위해 혁신적인 아이디어가 반드시 필요할까?', '1723647460348993907'],
  ['삶에서 가장 훌륭한 레버리지', '1909464712770994432'],
  ['신입 트레이더가 겪는 해탈 과정', '1731819466281853207'],
  ['링크드인 네트워킹 팁', '1895720638129828113'],
  ['스타트업 Roam을 통해 보는 새로운 문제와 비즈니스 기회', '1702143255088071042'],
  ['부동산 위주의 금융 정책이 나쁜 정책인 이유', '1900046641404797272'],
  ['엑셀 사용 꿀팁 1편', '1713130461650919478'],
  ['엑셀 사용 꿀팁 2편', '1713423305284428038'],
  ['주관적인 인터뷰 팁', '1804884017210077385'],
  ['듀레이션 면접 썰', '1701049361046946137'],
  ['자산군 (Asset Class)에 대해 알아보기 1편 : 채권', '1553649451914653696'],
  ['자산군 (Asset Class)에 대해 알아보기 2편 : 주식', '1555470207925497856'],
  ['자산군 (Asset Class)에 대해 알아보기 3편 : 상품/원자재/외환', '1560861082079883265'],
  ['자산군 (Asset Class)에 대해 알아보기 4편 : 대체자산 + 가상화폐', '1564637949207412738'],
  ['헤징 (Hedging) 에 대해 제대로 이해하고 활용하는 방법', '1581542610543730696'],
  ['OTC 장외거래 (Over The Counter) 에 대해 알아보기 1편', '1566371297139249152'],
  ['마켓메이커 (시장조성자)에 대해 알아보기', '1610596214025908225'],
  ['FTX 청산 관련 OTC 거래에 대해 알아야 할 점', '1701225730263441732'],
  ['stEth-Eth 가격 다이버전스가 시사하는 점', '1535849386672295936'],
  ['금융시장 Myth Busting 4편 : 금융시장 내 기관에 대해 알아보기 (서론편)', '1584078463128195072'],
  ['금융시장 Myth Busting 5편 : 금융시장 내 기관에 대해 알아보기 (기관 타입별 소개편)', '1585218453920952320'],
  ['금융시장의 현대화를 요약하는 세 가지 키워드', '1695813564341362743'],
  ['월가 투자은행들의 수익성이 악화되고 있는 이유', '1652510927194050562'],
  ['왜 은행주는 하락장에서 잘 버틸까?', '1537294936445698048'],
  ['월가가 크립토 거래소를 만드는 이유', '1609765746942566402'],
  ['투자를 하는 사람이라면 반드시 알아야 할 균형 가격에 대한 고찰', '1675438704595472385'],
  ['기관 트레이더가 아니라면 알기 쉽지 않은 자산 가격에 대한 진실', '1601965650838441984'],
  ['평가손익의 허상 이해하기', '1548974302728691712'],
  ['크립토 밸류에이션이 쉽지 않은 이유', '1546444364603596800'],
  ['20221123 시황 업데이트 (PER 체크)', '1595348262810443778'],
  ['GBTC의 역프리미엄. 현재 GBTC는 얼마나 싼가?', '1595684818725265408'],
  ['스타크래프트로 알아보는 규제의 중요성', '1684545885177511941'],
  ['미국 크립토 규제안 드래프트 뜯어보기', '1534106474947162117'],
  ['Takeaway on US crypto regulation draft leak', '1534115620610281474'],
  ['SEC vs. XRP 7월 13일 판결문 뜯어보기', '1679684091204235264'],
  ['SEC의 Binance, Coinbase 기소문 비교분석', '1670373404069994496'],
  ['SEC 의 Beaxy 기소', '1641270079223627776'],
  ['Blackrock 의 Bitcoin ETF 신청에 관한 고찰', '1669929298856398848'],
  ['Wen physical BTC ETF? What is preventing its launch?', '1497424287481102340']
]);
const SOURCE_ID_BY_TITLE = new Map(SOURCE_THREADS.map(([title, status]) => [title, `nathan-x-${status}`]));
const ref = (...titles) => titles.map((title) => SOURCE_ID_BY_TITLE.get(title)).filter(Boolean);

// Thread id -> catalogue title for the posts frameworks cite (the framework articles name each source post).
export const NATHAN_FRAMEWORK_SOURCE_TITLES = new Map(SOURCE_THREADS.map(([title, status]) => [`nathan-x-${status}`, title]));

const RAW_FRAMEWORKS = [
  {
    id: 'nathan-liquidity-extremes', title: '유동성·극단·강제 디레버리징',
    sourceRefs: ref('아서 헤이즈 블로그 글 분석 (MOVE index, 재정적자, Treasury buyback)', '금융 시장 불변의 법칙', '시장의 극단은 생각보다 더 극단적이다', '대응하라는 조언은 좋은 투자 조언이 아니다', '가상화폐 시장을 통해 배우는 금융'),
    thesis: '시장 가격의 극단은 단순한 심리보다 명목자산·신용·담보와 포지션 청산이 겹칠 때 커질 수 있다.',
    mechanism: '유동성·담보 여력 저하 → 공통 출구와 마진 청산 → 현물·선물·채권의 가격 괴리와 변동성 확대.',
    inputs: ['MOVE/VIX 성격의 변동성', 'repo·담보·마진', 'credit spread', 'forced selling', '현물·선물 괴리'], timeframe: 'event-window / stress-window',
    confirmation: '가격 극단과 함께 funding·collateral·margin·liquidation 관측이 같은 시간창에서 확인될 때만 plumbing 가설을 강화한다.',
    invalidation: '담보·자금조달·청산 증거 없이 가격 방향만으로 유동성 원인을 단정하지 않는다.',
    counterclaim: 'MOVE나 ETF flow 하나는 정부·시장 전체의 확정적 신호가 아니다.',
    allowedConsumers: ['screener:reference-context', 'chat:market', 'chat:portfolio', 'knowledge:market-plumbing'], blockedConsumers: ['rank', 'current-price', 'auto-order']
  },
  {
    id: 'nathan-leverage-survival', title: '레버리지의 총비용과 생존성',
    sourceRefs: ref('레버리지는 언제 써야 할까?', '리스크 프레임워크에 관한 생각', '투자와 삶, 리스크에 대한 생각', '개인 투자자가 돈을 잃는 근본적인 이유와 금융 시장의 구조'),
    thesis: '레버리지는 기대수익 배수가 아니라 금융비용·청산비용·회복시간을 함께 계산하는 생존성 문제다.',
    mechanism: '차입비용과 방향성 노출 → 변동성·담보 요구 → 강제 축소 또는 회복 불가능한 복리 손실.',
    inputs: ['gross/net exposure', 'financing cost', 'collateral', 'margin headroom', 'drawdown', 'recovery time'], timeframe: 'position-life / drawdown-window',
    confirmation: '노출 한도·자금조달비용·최악의 청산 경로를 사전에 수치화하고, 손실 시나리오에서도 포지션이 생존하는지 확인한다.',
    invalidation: '레버리지 배수만 있고 담보·유지증거금·청산 조건이 없으면 의사결정 근거로 사용하지 않는다.',
    counterclaim: '레버리지 자체가 항상 나쁜 것이 아니라 비용과 실패 경로가 통제되는지가 핵심이다.',
    allowedConsumers: ['screener:risk-context', 'chat:portfolio', 'knowledge:decision-hygiene'], blockedConsumers: ['auto-sizing', 'leverage-recommendation', 'return-probability']
  },
  {
    id: 'nathan-forecast-falsifiability', title: '예측보다 불변식·메커니즘·무효화',
    sourceRefs: ref('예측, 그리고 나쁜 배팅과 좋은 배팅', '자산 가격 움직임 생각 프레임워크', '동전 던지기로 알아보는 선반영의 개념', '아서 헤이즈의 3월 시장 폭락 예측이 좋은 예측인 이유', 'What makes Arthur Hayes’ market crash prediction a good prediction'),
    thesis: '좋은 예측은 방향을 맞혔다는 사후 결과가 아니라 시점·전달 메커니즘·반증 조건을 사전에 공개한다.',
    mechanism: '공개정보의 반영·불확실성 해소·새 정보 유입을 구분하고, 기대값과 실제 경로를 별도로 기록한다.',
    inputs: ['timestamp', 'mechanism', 'expected value', 'new information', 'invalidation', 'outcome log'], timeframe: 'forecast-window / event-window',
    confirmation: '예측 시점에 무엇이 이미 가격에 반영됐는지와 어떤 관측이 가설을 깨는지 명시되어야 한다.',
    invalidation: '방향만 맞고 시점·경로·무효화가 없으면 예측 품질의 증거로 승격하지 않는다.',
    counterclaim: '확률적 판단은 정보가 바뀌면 갱신될 수 있으므로 고정된 확언과 동일하지 않다.',
    allowedConsumers: ['screener:hypothesis-context', 'chat:principles', 'knowledge:hypothesis-testing'], blockedConsumers: ['probability-badge', 'target-price', 'auto-entry']
  },
  {
    id: 'nathan-policy-second-order', title: '정책의 1차·2차·부작용 전달경로',
    sourceRefs: ref('경제정책의 나비효과', '레이 달리오의 관세 인사이트', '트럼프 정책에 대한 생각', '한국에 대한 안타까움'),
    thesis: '정책 이벤트는 발표 자체보다 상대국 대응·FX·물가·금융조건을 거치는 2차 경로에서 자산에 전달된다.',
    mechanism: '정책 발표 → 상대국·기업의 행동 변화 → 공급망·환율·마진·물가 → 통화·재정 대응 → 자산 가격.',
    inputs: ['policy text', 'retaliation', 'elasticity', 'FX', 'producer/consumer prices', 'financial conditions'], timeframe: 'policy-event / macro-lag',
    confirmation: '직접 효과와 2차 효과를 분리한 뒤 실제 정책·FX·물가·금융조건 시계열이 같은 가설을 지지하는지 확인한다.',
    invalidation: '당시의 국가·가격·환율 전망을 현재 정책 판단에 그대로 이식하지 않는다.',
    counterclaim: '정책의 의도와 실제 결과는 다를 수 있고, 경로별 탄력성에 따라 결과가 반대일 수 있다.',
    allowedConsumers: ['screener:theme-context', 'chat:macro', 'knowledge:policy-transmission'], blockedConsumers: ['current-policy-claim', 'directional-order', 'target-price']
  },
  {
    id: 'nathan-etf-flow-channel', title: 'ETF flow는 신호가 아니라 전달 채널',
    sourceRefs: ref('ETF는 시장 모멘텀을 강화시킨다', 'BTC ETF flow, 너무 큰 의미를 두지 않아도 된다', '현물 비트코인 ETF 승인 이후 눈여겨보아야 할 점', 'Cash creation vs. In-kind creation 방식의 차이가 비트코인 ETF 에 미치는 영향은?', '비트코인 현물 ETF 관련 두 가지 개념 정리', 'ETF 시드 거래가 조정된다는 뜻을 해석해보기'),
    thesis: 'ETF flow는 수요가 전달되는 한 경로이며, 단일 일자 flow를 시장의 깊은 수요나 방향성 증거로 과대해석하면 안 된다.',
    mechanism: '투자자 주문 → AP·creation/redemption → 기초자산 거래 → ETF와 NAV의 괴리·유동성·가격 반응.',
    inputs: ['AUM', 'net flow', 'creation/redemption', 'NAV premium/discount', 'AP activity', 'settlement rail'], timeframe: 'daily-flow / launch-window',
    confirmation: 'flow를 AUM 변화·creation/redemption·NAV 괴리·기초자산 거래량과 함께 확인한다.',
    invalidation: 'flow 하나로 현재 수급·가격 방향·기관 의도를 단정하지 않는다.',
    counterclaim: '시장이 얕거나 상품이 새로 출시된 국면에서는 ETF flow가 가격을 증폭시키는 중요한 채널이 될 수 있다.',
    allowedConsumers: ['screener:reference-context', 'chat:market', 'knowledge:market-structure'], blockedConsumers: ['flow-only-rank', 'current-demand-claim', 'auto-order']
  },
  {
    id: 'nathan-market-structure-execution', title: '시장구조·유동성 공급·실행비용',
    sourceRefs: ref('증권 거래할 때 비용 초간단 정리', 'ETF 거래 시 비용 절약하는 법', '선물과 현물의 관계', 'Blackrock Bitcoin ETF의 AP Jane Street 은 어떤 기업일까', '하이퍼리퀴드의 구조적 결함'),
    thesis: '거래 결과는 방향성뿐 아니라 spread·depth·inventory·funding·청산 구조와 실행 방식의 영향을 받는다.',
    mechanism: '주문 도착 → 유동성 공급자 inventory 변화·hedge → 호가·slippage·funding 조정 → 체결비용 또는 청산 전염.',
    inputs: ['bid-ask spread', 'displayed depth', 'slippage', 'inventory', 'funding', 'orderbook liquidity', 'liquidation flow'], timeframe: 'execution-window / stress-window',
    confirmation: '주문 규모·호가 깊이·체결 분할·funding·청산 데이터를 함께 확인한다.',
    invalidation: '시장구조 설명만으로 특정 거래소·상품의 현재 안전성을 보증하지 않는다.',
    counterclaim: '유동성 공급자와 AP가 가격 괴리를 줄이는 완충 역할을 할 수도 있다.',
    allowedConsumers: ['screener:execution-context', 'chat:technical', 'knowledge:market-structure'], blockedConsumers: ['execution-guarantee', 'venue-safety-claim', 'auto-order']
  },
  {
    id: 'nathan-retail-flow-edge-decay', title: '관심·flow·전략의 적응과 edge decay',
    sourceRefs: ref('2024년을 마무리하며 적어보는 금융 시장에 대한 생각', '한국 개인투자자가 성공하기 쉽지 않은 이유', '당신의 매매 기법이 작동하지 않는 이유', '대다수 단기 투자가 실패하는 이유', '개인투자자들이 단기 전략으로 수익 못 내는 이유'),
    thesis: '단기 결과는 펀더멘털보다 관심·기대·flow·비합리적 행동에 흔들릴 수 있고, 반복되는 전략은 시장 적응으로 약화될 수 있다.',
    mechanism: '노출 → 관심 → 기대 → 투기적 수요 → 가격·flow → 참가자 적응 → 신호 약화 또는 반전.',
    inputs: ['attention', 'flow', 'sentiment', 'turnover', 'breadth', 'strategy decay', 'holding horizon'], timeframe: 'cycle-window / strategy-life',
    confirmation: '전략의 사전 규칙·표본 밖 성과·시장 국면·turnover 변화를 분리해 확인한다.',
    invalidation: '과거의 성공 사례나 단기 수익만으로 현재 edge의 지속성을 주장하지 않는다.',
    counterclaim: '모든 단기 전략이 실패하는 것은 아니며, 명시적 규칙·비용·검증 표본이 필요하다.',
    allowedConsumers: ['screener:regime-context', 'chat:principles', 'knowledge:behavior-audit'], blockedConsumers: ['strategy-hit-rate', 'current-signal', 'auto-entry']
  },
  {
    id: 'nathan-bubble-diagnostics', title: '버블 판독: 가격이 아니라 가정의 지속성',
    sourceRefs: ref('레이 달리오의 시장 진단 & 버블 판독법', '매수 버튼 누르기 전에 생각해볼 점 세 가지', '성공적인 투자를 위해 반드시 필요한 고민 : 자산을 어떻게 살 것인가?'),
    thesis: '버블은 비싸 보인다는 인상보다 현금흐름 대비 가격, 지속 불가능한 가정, 신규 참여자, 낙관과 레버리지를 함께 점검하는 진단 문제다.',
    mechanism: '기대수익 상승 → 신규 참여·레버리지 → 가격 상승 → 더 높은 기대와 매수 → 현금흐름·가정의 검증 실패.',
    inputs: ['valuation/cash flow', 'assumption durability', 'new participants', 'optimism', 'leverage', 'expectation purchases'], timeframe: 'cycle-window',
    confirmation: '가격·현금흐름·가정·참여자·레버리지의 다섯 축이 동시에 과열되는지 점검한다.',
    invalidation: '고평가처럼 보인다는 이유만으로 버블이나 하락 시점을 확정하지 않는다.',
    counterclaim: '높은 가격은 실제 현금흐름 성장과 낮은 자본비용으로 설명될 수도 있다.',
    allowedConsumers: ['screener:valuation-context', 'chat:market', 'knowledge:hypothesis-testing'], blockedConsumers: ['bubble-label-only', 'crash-date', 'short-order']
  },
  {
    id: 'nathan-crypto-fundamentals', title: '크립토 실사용·수익과 투기성 수요 분리',
    sourceRefs: ref('TVL과 예치작의 허상', '알트 코인은 왜 안오를까?', 'USDC, USDT, 코인원', '가상화폐 시장을 통해 배우는 금융', 'BTC ETF flow, 너무 큰 의미를 두지 않아도 된다'),
    thesis: 'TVL·프리미엄·flow·토큰 가격은 실사용·프로토콜 수익·신용·유동성과 분리해 읽어야 한다.',
    mechanism: '투기성 수요·담보·거래소 유동성 ↔ 프로토콜 사용·수익·현금흐름·counterparty risk의 상호작용.',
    inputs: ['protocol revenue', 'real usage', 'TVL composition', 'stablecoin premium', 'spot/derivatives liquidity', 'counterparty risk'], timeframe: 'cycle-window / stress-window',
    confirmation: '표시된 TVL이나 flow가 실제 사용자·수익·담보·상환 구조로 이어지는지 확인한다.',
    invalidation: 'TVL·stablecoin premium·ETF flow를 실사용이나 장기 가치의 단독 대리변수로 사용하지 않는다.',
    counterclaim: '초기 네트워크는 수익보다 유동성·사용자 확보가 먼저일 수 있으므로 시간창을 구분해야 한다.',
    allowedConsumers: ['screener:theme-context', 'chat:crypto', 'knowledge:crypto-market-structure'], blockedConsumers: ['token-value-claim', 'yield-guarantee', 'auto-order']
  },
  {
    id: 'nathan-tokenomics-value-link', title: '토큰의 직접적 가치 연결고리',
    sourceRefs: ref('NXPC 백서 읽는 꿀팁', 'NXPC 토큰 디자인', 'NXPC 디자인 하면서 주의했던 점들', 'How to read NXPC whitepaper', 'How my ETF journey led to NXPC designing project', 'NXPC tokenomics design'),
    thesis: '토큰 설계는 서사·기대만이 아니라 IP·사용·보상·공급·수요가 토큰에 직접 연결되는 메커니즘을 설명해야 한다.',
    mechanism: '제품/IP의 사용과 가치 → 설계된 참여·보상·소각·교환 메커니즘 → 토큰 수요·공급·가치 포착.',
    inputs: ['utility', 'value capture', 'token supply', 'emission/reward', 'redemption/exchange', 'IP linkage'], timeframe: 'design-review / product-life',
    confirmation: '백서의 목표·토큰 flow·가치 포착·실제 사용자가 연결되는 경로를 독립적으로 확인한다.',
    invalidation: '백서 서사나 기대수요만으로 토큰 가격·성공을 판단하지 않는다.',
    counterclaim: '직접 연결고리가 있어도 사용자 채택·규제·유동성·운영 실행이 검증되지 않으면 작동하지 않을 수 있다.',
    allowedConsumers: ['screener:theme-context', 'chat:crypto', 'knowledge:tokenomics'], blockedConsumers: ['token-ranking', 'price-target', 'yield-guarantee']
  },
  {
    id: 'nathan-counterparty-custody', title: '거래상대방·보관·결제 위험',
    sourceRefs: ref('가상화폐 시장을 통해 배우는 금융', 'FTX 자금유용 디테일 (WSJ 출처)', '하이퍼리퀴드의 구조적 결함', '선물과 현물의 관계'),
    thesis: '시장 노출을 평가할 때 가격위험과 별도로 거래상대방·보관·결제·청산 구조를 확인해야 한다.',
    mechanism: '담보·보관·거래소·청산기관의 실패 또는 유동성 단절 → 출금·가격·포지션 청산 경로가 동시에 악화.',
    inputs: ['custody', 'collateral segregation', 'settlement', 'counterparty', 'liquidation waterfall', 'withdrawal conditions'], timeframe: 'product-life / stress-window',
    confirmation: '자산의 보관·담보·결제 주체와 실패 시 회수·청산 순서를 문서와 실제 운영 증거로 확인한다.',
    invalidation: '단일 2차 보도나 플랫폼 설명만으로 현재 보관 안전성을 보증하지 않는다.',
    counterclaim: '중앙화·분산화 여부 자체보다 담보·권리·감사·청산 계약의 구체성이 중요하다.',
    allowedConsumers: ['screener:risk-context', 'chat:crypto', 'knowledge:counterparty-risk'], blockedConsumers: ['safety-label', 'custody-guarantee', 'auto-order']
  },
  {
    id: 'nathan-investor-protection', title: '투자자 보호와 의사결정 위생',
    sourceRefs: ref('투자자 보호의 의미', '투자 하면서 사기 당하지 않기 위해 필요한 태도', '매수 버튼 누르기 전에 생각해볼 점 세 가지', '금융은 단순하다'),
    thesis: '투자자 보호는 원금 보장이 아니라 위험·이해상충·조작을 공개하고 사실과 희망을 분리하게 하는 장치다.',
    mechanism: '정보 공개·검증 가능성·이해상충 확인 → 서사와 사실 분리 → 손실 경로와 반증 조건을 기록.',
    inputs: ['disclosed risks', 'conflicts', 'source quality', 'fact vs. narrative', 'incentives', 'invalidation'], timeframe: 'decision-window',
    confirmation: '주장·근거·이해상충·무효화 조건을 분리해 읽고, 출처가 말하지 않은 것을 보충하지 않는다.',
    invalidation: '마케팅 문구·권위·원하는 결론만으로 사실성을 높이지 않는다.',
    counterclaim: '정보가 공개되어도 사용자가 이해하지 못하면 보호 효과가 제한된다.',
    allowedConsumers: ['screener:reference-context', 'chat:principles', 'knowledge:decision-hygiene'], blockedConsumers: ['guarantee', 'fraud-free-label', 'auto-order']
  },
  {
    id: 'nathan-credit-stress-gates', title: '매크로 신용·자금조달 스트레스 게이트',
    sourceRefs: ref('20250409 둠스데이?', '20250407 위험자산이 녹아내리는 와중에 든 생각', '20250311 채권 시장을 통해 알아보는 시황', '20250228 경기부양책', '20250421 머니프린팅과 패권의 몰락'),
    thesis: '위험자산 하락과 장기금리 상승의 동시 발생은 성장·달러 신뢰·자금조달 스트레스 가설을 점검하게 하지만, 단독으로 위기를 확정하지 않는다.',
    mechanism: '정책·물가·성장 기대 변화 → 장단기 금리·달러·credit spread → funding 조건·위험자산의 할인율과 수급.',
    inputs: ['front-end yields', 'long yields', 'HYG/JNK', 'MBB/SPMB', 'credit spreads', 'FX', 'repo/funding'], timeframe: 'macro-release-lag / stress-window',
    confirmation: '위험자산·금리·credit·FX·funding이 같은 시간창에서 일관된 스트레스 패턴을 보이는지 공식·현재 데이터로 재검증한다.',
    invalidation: '게시물의 당시 수치·목표·위기 서사를 현재 매크로 상태로 복사하지 않는다.',
    counterclaim: '금리 상승은 성장·인플레이션 기대 개선으로도 발생할 수 있어 경로 식별이 필요하다.',
    allowedConsumers: ['screener:macro-context', 'chat:macro', 'knowledge:macro-transmission'], blockedConsumers: ['crisis-label', 'current-macro-claim', 'directional-order']
  },
  {
    id: 'nathan-product-monetization', title: 'AI 제품의 지불의사와 업그레이드 전환',
    sourceRefs: ref('AI 기술로 소비자의 주머니가 열리는 과정'),
    thesis: '기술 진보가 매출로 전환되려면 기능 개선보다 사용자의 지불의사·업그레이드 필요·가격 전환이 확인되어야 한다.',
    mechanism: '기존 제품 효용 정체 → 새로운 기능의 체감 효용 상승 → willingness-to-pay·가격·채택률 → 매출 전환.',
    inputs: ['feature utility', 'willingness to pay', 'upgrade rate', 'pricing', 'retention', 'usage'], timeframe: 'product-cycle / cohort-window',
    confirmation: '기능 사용량이 실제 유료 전환·가격·유지율로 이어지는지 cohort와 공시·제품 데이터로 확인한다.',
    invalidation: 'AI 기능 출시나 관심도만으로 소비자 매출·기업 이익을 현재 사실로 단정하지 않는다.',
    counterclaim: '높은 지불의사가 있어도 경쟁·비용·규제·공급 제약 때문에 이익으로 남지 않을 수 있다.',
    allowedConsumers: ['screener:theme-context', 'chat:themes', 'knowledge:software-outcome-economics'], blockedConsumers: ['revenue-forecast', 'current-demand-claim', 'auto-order']
  }
];

RAW_FRAMEWORKS.push(
  {
    id: 'nathan-treasury-supply-demand', title: '국채 수급·듀레이션·텀프리미엄 전달경로',
    sourceRefs: ref('20231117 미국 국채 수급에 대한 우려', '20250311 채권 시장을 통해 알아보는 시황', '아서 헤이즈 블로그 글 분석 (MOVE index, 재정적자, Treasury buyback)', '국채 수익률 곡선 설명'),
    thesis: '장기금리는 정책금리 전망만으로 설명되지 않으며, 순발행·해외수요·QT·텀프리미엄과 경매 소화력이 함께 가격에 반영된다.',
    mechanism: '순발행·롤오버·QT·해외수요 변화 → 듀레이션 수급과 경매 소화력 변화 → 장기금리·텀프리미엄 → 달러·할인율·금융여건.',
    inputs: ['net issuance', 'foreign demand/holdings', 'auction tails', 'term premium', 'front-end vs. long-end yields', 'QT', 'FX'], timeframe: 'auction-window / macro-lag',
    confirmation: '발행·보유·경매·금리곡선·FX를 같은 시점으로 정렬하고 금리 상승이 성장·물가·수급 중 어느 경로와 맞는지 분해한다.',
    invalidation: '게시물의 당시 해외수요·발행량·금리 수치를 현재 국채시장 상태로 복사하지 않는다.',
    counterclaim: '장기금리 상승은 수급 악화뿐 아니라 성장·인플레이션 기대 개선으로도 발생할 수 있다.',
    allowedConsumers: ['screener:macro-context', 'chat:macro', 'knowledge:treasury-plumbing'], blockedConsumers: ['current-yield-claim', 'rate-direction-only', 'auto-order']
  },
  {
    id: 'nathan-macro-risk-asset-divergence', title: '실물경제와 위험자산의 괴리',
    sourceRefs: ref('최근 경기상황 간단요약', '2024년을 마무리하며 금융 시장에 대한 생각', '20250311 채권 시장을 통해 알아보는 시황', '20250407 위험자산이 녹아내리는 와중에 든 생각'),
    thesis: '금리 동결 기대나 유동성으로 위험자산이 오르는 동안 실물경제·소비·신용은 약해질 수 있으므로 자산 가격을 경기 회복의 단독 증거로 읽으면 안 된다.',
    mechanism: '정책 기대·할인율 안정 → 위험자산 재평가, 동시에 이자 부담·소비 전환·수출·신용 약화 → 가격과 실물지표의 시간차 확대.',
    inputs: ['real activity', 'consumption mix', 'exports', 'credit conditions', 'risk-asset breadth', 'policy expectations'], timeframe: 'macro-lag / cycle-window',
    confirmation: '가격 상승이 이익·현금흐름·고용·소비·신용으로 전이되는지, 아니면 멀티플과 유동성에만 머무는지 구분한다.',
    invalidation: '한두 개 경기지표나 위험자산 방향만으로 경기 국면을 확정하지 않는다.',
    counterclaim: '실물지표는 가격보다 늦게 회복될 수 있어 괴리가 곧바로 하락 신호라는 뜻은 아니다.',
    allowedConsumers: ['screener:macro-context', 'chat:macro', 'knowledge:cycle-diagnostics'], blockedConsumers: ['recession-label', 'current-regime-claim', 'directional-order']
  },
  {
    id: 'nathan-nonbank-regulatory-arbitrage', title: '은행에서 비은행으로 이동하는 규제·시스템 리스크',
    sourceRefs: ref('월가 동료들과 캐치업하면서 들은 내용들', '하이퍼리퀴드의 구조적 결함', 'FTX 자금유용 디테일 (WSJ 출처)', '금융 시장 불변의 법칙'),
    thesis: '은행의 자본·규제 비용이 커질수록 시장활동이 비은행 금융기관으로 이동할 수 있으며, 시장점유율 이동만으로 위험이 사라지는 것이 아니라 가시성·레버리지·청산 경로를 다시 봐야 한다.',
    mechanism: '은행 규제·자본비용 증가 → 은행의 중개 축소 → 비은행 점유율 확대 → 규제·공시·담보·레버리지의 비대칭 → 충격 시 유동성 단절과 시스템 전염.',
    inputs: ['dealer inventory', 'bank capital constraints', 'NBFI share', 'leverage', 'collateral', 'margin', 'disclosure quality', 'liquidation waterfall'], timeframe: 'structural / stress-window',
    confirmation: '점유율 변화와 함께 비은행의 담보·레버리지·자금조달·청산 조건 및 공시 수준을 확인한다.',
    invalidation: '비은행이라는 분류 자체만으로 시스템 리스크나 실패 가능성을 확정하지 않는다.',
    counterclaim: '비은행 중개는 효율성과 분산을 높이고 충격을 흡수하는 완충 역할도 할 수 있다.',
    allowedConsumers: ['screener:risk-context', 'chat:market', 'chat:crypto', 'knowledge:systemic-risk'], blockedConsumers: ['platform-safety-label', 'crisis-probability', 'auto-order']
  },
  {
    id: 'nathan-etf-nav-basket-integrity', title: 'ETF 바스켓·NAV·생성환매의 무결성',
    sourceRefs: ref('NXPC 디자인 사전 미팅', '블랙락의 현물 ETF S-1 서류 업데이트를 통해 도출할 수 있는 인사이트', 'Blackrock Bitcoin ETF의 AP Jane Street 은 어떤 기업일까', 'ETF 시드 거래가 조정된다는 뜻을 해석해보기', 'Cash creation vs. In-kind creation 방식의 차이가 비트코인 ETF 에 미치는 영향은?'),
    thesis: 'ETF의 품질은 이름이나 flow보다 부분 바스켓이 전체 자산가치를 얼마나 대표하는지, NAV를 관찰·산출·조정할 수 있는지에 달려 있다.',
    mechanism: '생성·환매 주문 → AP·유동성공급자의 바스켓 조달·헤지 → 기초자산 가격·평가·결제 → NAV 괴리·스프레드·추적오차.',
    inputs: ['basket composition', 'partial-basket representativeness', 'NAV methodology', 'creation/redemption', 'AP/LP', 'premium/discount', 'settlement', 'underlying liquidity'], timeframe: 'product-design / launch-window / stress-window',
    confirmation: '바스켓 구성·평가 가능성·생성환매 방식·AP 역할·NAV 괴리와 기초자산 유동성을 함께 확인한다.',
    invalidation: 'ETF flow나 승인 이벤트만으로 장기 수요·기관 의도·상품 안전성을 단정하지 않는다.',
    counterclaim: '충분한 유동성과 정교한 AP·NAV 절차가 있으면 생성환매가 가격 괴리를 줄이는 완충장치가 될 수 있다.',
    allowedConsumers: ['screener:execution-context', 'chat:market', 'chat:crypto', 'knowledge:etf-structure'], blockedConsumers: ['flow-only-rank', 'product-safety-guarantee', 'auto-order']
  },
  {
    id: 'nathan-market-impersonal-tail-risk', title: '시장은 비인격적이며 테일리스크는 제거되지 않는다',
    sourceRefs: ref('금융시장과 맞닿아있는 일을 하면서 배운 점들', '투자와 삶, 리스크에 대한 생각', '리스크 프레임워크에 관한 생각', '성공적인 투자를 위해 반드시 필요한 고민 : 자산을 어떻게 살 것인가?'),
    thesis: '시장은 투자자의 포지션이나 의도를 배려하지 않으며, 완벽한 전략과 예측으로 모든 테일 이벤트를 제거할 수 없으므로 생존 설계가 핵심이다.',
    mechanism: '예상 밖 충격 발생 → 상관관계·유동성·담보 조건 변화 → 단일 포지션 손실 확대 → 분산·보수적 레버리지·현금 여력의 생존 효과.',
    inputs: ['correlation', 'concentration', 'tail loss', 'liquidity', 'cash buffer', 'leverage', 'recovery time'], timeframe: 'portfolio-life / stress-window',
    confirmation: '시장 방향 예측과 별개로 손실 상한·분산·담보 여력·회복 가능성을 사전 점검한다.',
    invalidation: '시장에 의도나 인격을 부여하거나, 과거의 성공만으로 미래 테일리스크가 제거됐다고 보지 않는다.',
    counterclaim: '분산은 모든 손실을 막지 않으며 상관관계가 함께 상승하는 위기에서는 보호력이 제한될 수 있다.',
    allowedConsumers: ['screener:risk-context', 'chat:portfolio', 'knowledge:tail-risk'], blockedConsumers: ['risk-free-label', 'guaranteed-recovery', 'auto-sizing']
  },
  {
    id: 'nathan-research-provenance', title: '정의·출처·서사와 사실의 분리',
    sourceRefs: ref('가짜뉴스와 사회적 실험', '전문성에 대한 짧은 생각', '불변의 법칙 (Same as Ever) 후기 - 모건 하우절의 스토리텔링', '투자자 보호의 의미'),
    thesis: '읽기 쉬운 서사와 권위 있는 표현은 사실성의 증거가 아니며, 개념을 정의하고 출처·주장·추론·반증을 분리해야 정보의 질을 평가할 수 있다.',
    mechanism: '서사·플랫폼 확산 → 공감과 확신 상승 → 사실·해석·추론 혼합 위험 → 1차 출처·정의·반증 조건으로 재분해.',
    inputs: ['claim text', 'definition', 'source tier', 'timestamp', 'derivation', 'missing context', 'invalidation', 'conflicts'], timeframe: 'decision-window',
    confirmation: '원문 출처와 관측시점을 기록하고, 저자가 말한 것·말하지 않은 것·독자가 추론한 것을 분리한다.',
    invalidation: '스토리의 설득력, 팔로워 수, 권위, 단일 캡처만으로 현재 사실이나 투자 신호를 승격하지 않는다.',
    counterclaim: '좋은 서사는 복잡한 개념의 이해를 돕지만 증거의 대체물이 아니라 전달 형식으로만 사용해야 한다.',
    allowedConsumers: ['screener:reference-context', 'chat:principles', 'knowledge:source-hygiene'], blockedConsumers: ['fact-confidence-only', 'current-claim', 'auto-order']
  },
  {
    id: 'nathan-specialized-edge-luck', title: '전문성·네트워크·기회와 운의 분리',
    sourceRefs: ref('커리어 돌이켜보았을 때 가장 후회되는 순간', '성공한 기업을 만들기 위해 혁신적인 아이디어가 반드시 필요할까?', '삶에서 가장 훌륭한 레버리지', '신입 트레이더가 겪는 해탈 과정', '링크드인 네트워킹 팁'),
    thesis: '지속 가능한 edge는 도메인 전문성·문제에 가까운 경험·네트워크에서 나오지만, 결과에는 시기와 운이 섞이므로 성과를 전부 실력으로 귀속하면 안 된다.',
    mechanism: '전문지식·현장경험·관계자 네트워크 → 남들이 놓친 문제·정보·실행경로 발견 → 시장 타이밍과 결합 → 성과, 이후 운과 실력 분리 평가.',
    inputs: ['domain knowledge', 'network', 'problem proximity', 'execution', 'timing', 'luck', 'out-of-sample persistence'], timeframe: 'career-cycle / strategy-life',
    confirmation: '성과를 낸 전략의 사전 지식·재현성·표본 밖 성과와 우연한 환경을 별도로 기록한다.',
    invalidation: '한 번의 대박, 유명한 직함, 연결망만으로 현재 edge나 미래 성과를 보증하지 않는다.',
    counterclaim: '전문성과 네트워크가 우연한 기회를 반복적으로 포착하는 확률을 높일 수는 있다.',
    allowedConsumers: ['screener:reference-context', 'chat:principles', 'knowledge:edge-audit'], blockedConsumers: ['skill-guarantee', 'performance-forecast', 'auto-order']
  },
  {
    id: 'nathan-problem-friction-opportunity', title: '거시적 마찰에서 제품·사업 기회 찾기',
    sourceRefs: ref('스타트업 Roam을 통해 보는 새로운 문제와 비즈니스 기회', '부동산 위주의 금융 정책이 나쁜 정책인 이유', 'AI 기술로 소비자의 주머니가 열리는 과정', '성공한 기업을 만들기 위해 혁신적인 아이디어가 반드시 필요할까?'),
    thesis: '기회는 반드시 신기술에서 나오지 않으며, 금리·정책·자산배분이 만든 마찰을 구체적으로 정의하고 각 이해관계자의 비용을 줄이는 구조에서 사업성이 생길 수 있다.',
    mechanism: '정책·금리·자본배분 변화 → 거래·자금·구매의 마찰 → 법적·운영적 제약 안에서 중개·승계·도구·제품 설계 → 사용자 효용과 수수료·매출.',
    inputs: ['market friction', 'policy constraint', 'legal eligibility', 'stakeholder incentives', 'unit economics', 'willingness to pay', 'adoption', 'execution'], timeframe: 'product-cycle / macro-lag',
    confirmation: '문제가 실제 거래·자금·시간 비용으로 나타나는지, 해결책이 구매자·판매자·자금제공자·플랫폼 모두의 인센티브를 맞추는지 확인한다.',
    invalidation: '문제의 존재나 기술 출시만으로 수요·수익·성공을 현재 사실로 단정하지 않는다.',
    counterclaim: '마찰이 커도 규제·운영·자본·채택 비용이 수익성을 압도할 수 있다.',
    allowedConsumers: ['screener:theme-context', 'chat:themes', 'knowledge:business-mechanism'], blockedConsumers: ['revenue-forecast', 'adoption-claim', 'auto-order']
  },
  {
    id: 'nathan-analysis-workflow-clarity', title: '분석 워크플로의 재현성·명료성·도구 위생',
    sourceRefs: ref('엑셀 사용 꿀팁 1편', '엑셀 사용 꿀팁 2편', '전문성에 대한 짧은 생각', '주관적인 인터뷰 팁', '듀레이션 면접 썰'),
    thesis: '전문적 분석은 어려운 용어와 복잡한 도구가 아니라 입력·정의·수식·출력의 경계를 명확히 하고 다른 사람이 재현할 수 있게 설명하는 데서 나온다.',
    mechanism: '원자료·수식·숨김행·중복·참조·포맷 확인 → 재현 가능한 계산·표·차트 → 짧고 정확한 설명 → 검토·의사결정 품질 향상.',
    inputs: ['source data', 'formula references', 'hidden rows', 'duplicates', 'dynamic ranges', 'definition', 'reproducibility', 'communication'], timeframe: 'analysis-window / decision-window',
    confirmation: '입력·변환·계산·출력과 예외·누락을 분리하고, 개념을 정의한 뒤 독립된 사람이 같은 결과를 재현할 수 있는지 확인한다.',
    invalidation: '화려한 표·어려운 용어·빠른 암산·짧은 설명만으로 분석의 정확성이나 전문성을 판단하지 않는다.',
    counterclaim: '도구 숙련도는 생산성을 높일 수 있지만, 잘못 정의된 문제와 데이터는 더 빠르게 확대할 뿐이다.',
    allowedConsumers: ['screener:reference-context', 'chat:research-method', 'knowledge:analysis-quality'], blockedConsumers: ['data-quality-guarantee', 'current-signal', 'auto-order']
  }
);

RAW_FRAMEWORKS.push(
  {
    id: 'nathan-asset-class-allocation', title: '자산군·위험프리미엄·포트폴리오 역할 분해',
    sourceRefs: ref('자산군 (Asset Class)에 대해 알아보기 1편 : 채권', '자산군 (Asset Class)에 대해 알아보기 2편 : 주식', '자산군 (Asset Class)에 대해 알아보기 3편 : 상품/원자재/외환', '자산군 (Asset Class)에 대해 알아보기 4편 : 대체자산 + 가상화폐', '성공적인 투자를 위해 반드시 필요한 고민 : 자산을 어떻게 살 것인가?'),
    thesis: '자산군 선택은 수익률 순위가 아니라 현금흐름·위험프리미엄·유동성·상관관계·포트폴리오 역할을 분해하는 문제다.',
    mechanism: '성장·물가·금리·신용·유동성 국면 변화 → 자산군별 현금흐름·듀레이션·변동성·상관관계 변화 → 포트폴리오 기여도와 손실 경로 변화.',
    inputs: ['cash flow', 'risk premia', 'duration', 'credit risk', 'liquidity', 'correlation', 'portfolio role', 'holding horizon'], timeframe: 'portfolio-life / cycle-window',
    confirmation: '각 자산의 기대수익이 어디서 발생하는지와 스트레스 국면의 유동성·상관관계·손실 경로를 같은 포트폴리오 기준으로 확인한다.',
    invalidation: '과거 수익률 순위나 자산군 이름만으로 현재 배분 비중·안전성·미래 수익을 확정하지 않는다.',
    counterclaim: '자산군 구분은 실제 위험요인과 노출이 겹치면 분산 효과를 과대평가할 수 있다.',
    allowedConsumers: ['screener:allocation-context', 'chat:portfolio', 'knowledge:asset-allocation'], blockedConsumers: ['allocation-recommendation', 'current-return-claim', 'auto-order']
  },
  {
    id: 'nathan-relative-value-hedging', title: '헤징·베이시스·OTC의 위험변환 구조',
    sourceRefs: ref('헤징 (Hedging) 에 대해 제대로 이해하고 활용하는 방법', 'OTC 장외거래 (Over The Counter) 에 대해 알아보기 1편', '선물과 현물의 관계', '마켓메이커 (시장조성자)에 대해 알아보기', 'FTX 청산 관련 OTC 거래에 대해 알아야 할 점', 'stEth-Eth 가격 다이버전스가 시사하는 점'),
    thesis: '헤징은 위험을 제거하는 주문이 아니라 가격·베이시스·유동성·거래상대방 위험을 다른 형태로 바꾸는 구조다.',
    mechanism: '기초자산 노출 → 선물·옵션·OTC·상대가치 포지션 → basis·funding·margin·counterparty 변화 → 헤지효과 또는 동시 청산.',
    inputs: ['hedge ratio', 'basis', 'funding', 'margin', 'counterparty', 'liquidity', 'settlement', 'execution cost'], timeframe: 'position-life / stress-window',
    confirmation: '헤지 대상·헤지 비율·괴리 확대 조건·담보·자금조달·결제·청산 순서를 사전에 적고 실제 괴리와 함께 점검한다.',
    invalidation: '헤지 포지션이 있다는 사실만으로 손실 상쇄·유동성·거래상대방 안전성을 보증하지 않는다.',
    counterclaim: '충분한 유동성과 적절한 만기·비율의 헤지는 포트폴리오의 특정 위험을 실질적으로 줄일 수 있다.',
    allowedConsumers: ['screener:execution-context', 'chat:portfolio', 'knowledge:hedging'], blockedConsumers: ['hedge-guarantee', 'auto-sizing', 'auto-order']
  },
  {
    id: 'nathan-institutional-intermediation', title: '기관·중개자·시장 현대화의 전달경로',
    sourceRefs: ref('금융시장 Myth Busting 4편 : 금융시장 내 기관에 대해 알아보기 (서론편)', '금융시장 Myth Busting 5편 : 금융시장 내 기관에 대해 알아보기 (기관 타입별 소개편)', '금융시장의 현대화를 요약하는 세 가지 키워드', '월가 투자은행들의 수익성이 악화되고 있는 이유', '왜 은행주는 하락장에서 잘 버틸까?', '월가가 크립토 거래소를 만드는 이유'),
    thesis: '시장 참여자의 이름보다 자본·재고·중개·수수료·규제·결제 역할을 분해해야 기관의 행동과 시장 변화가 보인다.',
    mechanism: '규제·자본비용·기술·수요 변화 → 은행·펀드·거래소·마켓메이커·AP의 역할과 점유율 변화 → 유동성·가격발견·비용·시스템 위험 변화.',
    inputs: ['institution type', 'capital constraint', 'inventory', 'fee model', 'market share', 'regulation', 'settlement', 'disclosure'], timeframe: 'structural / stress-window',
    confirmation: '기관의 법적 역할과 실제 수익모델·재고·담보·결제·공시를 분리해 확인하고 점유율 변화가 위험 이전인지 효율 개선인지 구분한다.',
    invalidation: '유명 기관의 참여나 시장점유율 증가만으로 유동성·상품 안전성·가격 방향을 추론하지 않는다.',
    counterclaim: '중개와 표준화의 발전은 거래비용을 낮추고 시장 접근성을 높이는 동시에 새로운 집중위험을 만들 수 있다.',
    allowedConsumers: ['screener:market-structure-context', 'chat:market', 'knowledge:financial-intermediation'], blockedConsumers: ['institution-safety-label', 'market-share-forecast', 'auto-order']
  },
  {
    id: 'nathan-valuation-price-formation', title: '가치평가·가격발견·평가손익의 분리',
    sourceRefs: ref('투자를 하는 사람이라면 반드시 알아야 할 균형 가격에 대한 고찰', '기관 트레이더가 아니라면 알기 쉽지 않은 자산 가격에 대한 진실', '평가손익의 허상 이해하기', '크립토 밸류에이션이 쉽지 않은 이유', '20221123 시황 업데이트 (PER 체크)', 'GBTC의 역프리미엄. 현재 GBTC는 얼마나 싼가?'),
    thesis: '가격·평가손익·균형가치·현금흐름·유동성은 서로 다른 관측치이므로 현재 손익과 장기 가치의 관계를 분리해야 한다.',
    mechanism: '정보·기대·현금흐름·할인율·수급·유동성 변화 → 가격발견과 평가손익 변화 → 실현 가능성·균형가치·재평가 위험의 재분해.',
    inputs: ['cash flow', 'discount rate', 'earnings multiple', 'mark-to-market', 'liquidity', 'premium/discount', 'realized P&L', 'expectations'], timeframe: 'valuation-window / stress-window',
    confirmation: '가격을 설명하는 현금흐름·할인율·수급·유동성 가정을 분리하고 평가손익이 실제 청산·실현 가능한 결과인지 확인한다.',
    invalidation: '현재 가격이 싸거나 비싸 보인다는 판단, 평가손익, 단일 멀티플만으로 균형가치나 회복을 확정하지 않는다.',
    counterclaim: '현금흐름과 위험프리미엄이 빠르게 바뀌는 자산은 정교한 평가모형도 넓은 불확실성 범위를 가질 수 있다.',
    allowedConsumers: ['screener:valuation-context', 'chat:market', 'knowledge:price-formation'], blockedConsumers: ['fair-value-label-only', 'recovery-claim', 'price-target']
  },
  {
    id: 'nathan-regulation-market-access', title: '규제·판결·상품승인과 시장접근성',
    sourceRefs: ref('스타크래프트로 알아보는 규제의 중요성', '미국 크립토 규제안 드래프트 뜯어보기', 'Takeaway on US crypto regulation draft leak', 'SEC vs. XRP 7월 13일 판결문 뜯어보기', 'SEC의 Binance, Coinbase 기소문 비교분석', 'SEC 의 Beaxy 기소', 'Blackrock 의 Bitcoin ETF 신청에 관한 고찰', 'Wen physical BTC ETF? What is preventing its launch?'),
    thesis: '규제는 뉴스 헤드라인이 아니라 누가 어떤 상품·거래소·보관·결제 경로에 접근할 수 있는지를 바꾸는 운영 제약이다.',
    mechanism: '법률·규정·판결·신청서·감독 집행 → 자격·공시·상장·보관·결제 요건 변화 → 시장접근성·유동성·비용·상품구조 변화.',
    inputs: ['primary legal text', 'jurisdiction', 'approval status', 'licensing', 'custody', 'disclosure', 'venue access', 'settlement'], timeframe: 'policy-event / product-life',
    confirmation: '2차 요약이 아니라 관할·원문·시점·적용범위·절차 상태를 확인하고 규제 사실과 시장 영향 추론을 분리한다.',
    invalidation: '초안·소송·신청·승인 기대를 현재 확정 규정이나 상품 출시 사실로 승격하지 않는다.',
    counterclaim: '규제 명확성은 접근성과 신뢰를 높일 수 있지만, 비용과 진입장벽을 함께 높여 유동성을 분산시킬 수 있다.',
    allowedConsumers: ['screener:regulatory-context', 'chat:crypto', 'knowledge:market-access'], blockedConsumers: ['legal-certainty-label', 'approval-claim', 'auto-order']
  }
);

const FRAMEWORKS = Object.freeze(RAW_FRAMEWORKS.map((framework) => Object.freeze({
  ...framework,
  claimType: 'STRUCTURAL_REFERENCE',
  status: 'DIRECT_READ_DERIVED',
  sourceRefs: Object.freeze(framework.sourceRefs),
  inputs: Object.freeze(framework.inputs),
  allowedConsumers: Object.freeze(framework.allowedConsumers),
  blockedConsumers: Object.freeze(framework.blockedConsumers),
  currentnessBoundary: '2022~2025의 공개 게시물에서 추출한 교육용 구조다. 최신 가격·수급·정책·규제·공시로 승격하려면 별도의 현재 producer와 재검증이 필요하다.'
})));

export const NATHAN_PREVIOUS_THREADS_FRAMEWORKS = FRAMEWORKS;
export const NATHAN_PREVIOUS_THREADS_FRAMEWORK_IDS = Object.freeze(FRAMEWORKS.map((framework) => framework.id));
