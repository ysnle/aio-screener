// The owner's X bookmarks added after the 2026-10-30 read (2026-11-01). Every bookmark in x.com/i/history above the first
// id of the 10/30 read was read in full — posts, author threads, quoted posts followed three levels deep, other users'
// replies on seven of the nine investment posts, and every attached image — then compared, claim by claim and frame by
// frame, with what AIO collects, selects, generates and links. Same reference-only shape as packet-20261030-x-bookmarks.js:
// nothing here is a live value, a ranking input or a call. The ledger is _artifacts/x-bookmarks-20261101/.
const check = (claim, state, basis) => Object.freeze({ claim, state, basis });
// From _artifacts/x-bookmarks-20261101/ledger.json (grade scale there): A checked or reusable, B cited or confirming, C none.
const SOURCE_TIMELINE = Object.freeze({
  '2116235808109986188': Object.freeze({ postedAtUtc: '2026-10-30T18:28:29Z', refersTo: '10/30 US session (cross-asset), the five hyperscalers Jan–Sep cash flow, HY/IG spreads to 10/29', lag: 'intraday, about 2.5 h before the close', laterOutcome: 'AIO 10/30 closes: SMH -6.98%, gold -3.3%, 필수소비재 +1.4%, 에너지 +1.9% — same direction. HY 326bp (10/29) and IG 89bp match the FRED series; HY was 260bp on 8/28.' }),
  '2116230300548350309': Object.freeze({ postedAtUtc: '2026-10-30T18:06:35Z', refersTo: 'AMZN·INTC reports of 10/29 after the close and the FT report on Anthropic ratings of 10/30', lag: 'about 22 h after the reports, intraday', laterOutcome: 'AIO briefs: INTC 10/30 close -28.6%, Q4 revenue guidance $15.0–16.0B (matches). AMZN close -1.4% in the brief (the post gives no close).' }),
  '2115846289737089247': Object.freeze({ postedAtUtc: '2026-10-29T16:40:40Z', refersTo: 'ServiceNow Q3 call of 10/28', lag: 'about 20 h after the call', laterOutcome: 'AIO brief: NOW 2 sessions -30.0%; reported reason is guidance and cRPO, not seats — the seat argument is the author’s reading.' }),
  '2116515796184969332': Object.freeze({ postedAtUtc: '2026-10-31T13:01:03Z', refersTo: 'the 10/30 selloff and the leadership question', lag: 'about 17 h after the close', laterOutcome: 'Of the three falsifiers: equal weight held up (RSP -0.79% vs S&P 500 -1.82% on 10/30), forward EPS revisions net up (344 up vs 227 down of 916), HY +55bp over 60 sessions but flat over 20 — one of three partly met. Cannot judge the rotation call yet.' }),
  '2116358611236786369': Object.freeze({ postedAtUtc: '2026-10-31T02:36:27Z', refersTo: 'weekend fear posts after 10/30; the US midterm of 11/3', lag: 'about 9 h after the close', laterOutcome: 'Midterm not held yet at the read (11/1). AIO schedule carries it as 11/4 KST with the 11/3 vote.' }),
  '2116345952256835942': Object.freeze({ postedAtUtc: '2026-10-31T01:46:09Z', refersTo: 'a viral pair-trade call (short AI hardware, long bio/health/software/security) after 10/30', lag: 'about 6 h after the close', laterOutcome: 'Cannot be judged yet. On 10/30 software (NOW, FTNT) fell with hardware, so the long leg was not a hedge that day.' }),
  '2116233205116481850': Object.freeze({ postedAtUtc: '2026-10-30T18:18:08Z', refersTo: 'the Asian supply-chain earnings season (KR/CN/JP/TW, monthly sales, orders, capex plans)', lag: 'not event-bound', laterOutcome: 'n/a (a method). Quoted thread 2053065976393212101 (2026-05-09) gives the four gauges this packet adopts.' }),
  '2116342909259944335': Object.freeze({ postedAtUtc: '2026-10-31T01:34:03Z', refersTo: 'RS-rating sector map (Top 50 by sector, cumulative/1w/1m)', lag: 'after the 10/30 close', laterOutcome: 'AIO 10/30 theme read: 대형 제약 +1.9%, 필수소비재 상위, 반도체·광통신 최하위 — same ordering.' }),
  '2116375222479942111': Object.freeze({ postedAtUtc: '2026-10-31T03:42:28Z', refersTo: '10/30 close: SPY 120/200-day lines, VIX, GLD, BTC levels', lag: 'about 11 h after the close', laterOutcome: 'S&P 500 7,580 vs 200-day 7,310 (+3.7%) in AIO — the 200-day call is a price-level forecast and is not carried.' })
});
const SOURCE_QUALITY = Object.freeze({
  '2116235808109986188': Object.freeze({ data: 'A', coverage: 'A', logic: 'A', insight: 'B' }),
  '2116230300548350309': Object.freeze({ data: 'A', coverage: 'A', logic: 'B', insight: 'B' }),
  '2115846289737089247': Object.freeze({ data: 'C', coverage: 'B', logic: 'B', insight: 'B' }),
  '2116515796184969332': Object.freeze({ data: 'C', coverage: 'A', logic: 'A', insight: 'A' }),
  '2116358611236786369': Object.freeze({ data: 'C', coverage: 'A', logic: 'A', insight: 'B' }),
  '2116345952256835942': Object.freeze({ data: 'C', coverage: 'B', logic: 'B', insight: 'B' }),
  '2116233205116481850': Object.freeze({ data: 'C', coverage: 'A', logic: 'A', insight: 'A' }),
  '2116342909259944335': Object.freeze({ data: 'B', coverage: 'A', logic: 'C', insight: 'C' }),
  '2116375222479942111': Object.freeze({ data: 'B', coverage: 'A', logic: 'C', insight: 'C' })
});
const source = (handle, statusId, date, summary, checks = []) => Object.freeze({
  id: `${handle}-${statusId}`, author: handle, sourceUrl: `https://x.com/${handle}/status/${statusId}`, publishedAt: date, publishedAtKst: date,
  sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED', summary, checks: Object.freeze(checks),
  timeline: SOURCE_TIMELINE[statusId], quality: SOURCE_QUALITY[statusId]
});

// What the 2026-11-01 read covered: 16 bookmarks new since the 10/30 read, 9 investment material, 7 agent/design practice
// (listed for a separate thread, not acted on here).
export const PACKET_20261101_AUDIT = Object.freeze({
  readOn: '2026-11-01', newSinceLedger: 16, inScope: 9, agentPractice: 7, unrelated: 0, framesAdded: 3,
  repoState: Object.freeze({ reflected: 2, partial: 6, missing: 1, conflict: 0, notApplicable: 7 }),
  alreadyCovered: Object.freeze([
    '빅테크 현금 → 외부 차입 → 공급망 주문의 돈줄 사슬 → counterparty-funding-chain, ai-infra-credit-ladder, hyperscaler-capex-grid',
    '좌석 과금 소프트웨어가 AI에 잠식되는 구조 → usage-up-yield-down',
    '가능성을 근거로, 시각적 유사성을 인과로 쓰는 글 거르기와 관찰·가설·반증 분리 → evidence-grades-falsifier, evidence-role-conflict',
    '추세가 극단적으로 늘어난 뒤의 되돌림과 바닥의 구분 → snapback-vs-bottom',
    '평균 신용과 취약 차주의 시간차(하위 등급부터 벌어짐) → credit-distribution-refinancing',
    '예탁금 감소 속 신용잔고 재증가(기간조정) → 시장 온도의 한국 예탁금·신용 항목'
  ]),
  declined: Object.freeze(['SPY·GLD·BTC 가격 구간과 200일선 도달 예측(sustain_abund)', '정당 승리 선반영 추정과 바닥 업종 매수 암시(ysh1yo2848)', '개별 종목 선호·비선호 목록과 매매 시점', '헤지펀드 그로스 노출 같은 포지션 데이터(댓글, 무료 공식 원천 없음)']),
  conflictsFixed: Object.freeze([]),
  // What the read changed in the pipeline and on the screens (v59.56), beside the frames.
  structural: Object.freeze([
    '실적 요약 숫자 검증이 기간 표기(2026년·Q1 2027·3Q·최근 12개월)와 억·조 달러 표기 때문에 버리던 항목을 살림 — 저장분 기준 129건 중 119건',
    '시황 해석이 직전 미국 종가의 실적 반응·원문 수치·가이던스·보도된 이유(US_EARNINGS)를 입력으로 받음',
    '신용 판정 옆에 60거래일 하이일드·CCC·투자등급 변화와 등급 간 분화 문장을 붙임(판정 규칙은 그대로)'
  ])
});

export const PACKET_20261101_SOURCES = Object.freeze([
  source('dubidubabap', '2116235808109986188', '2026-10-31', '10/30 급락을 여러 자산으로 함께 읽은 글. 반도체·나스닥·금·은·비트코인 하락과 필수소비재·에너지·헬스케어·유틸리티·국채·엔화 상승, 빅테크 5곳의 1–9월 합산 영업현금흐름 $542.9B 대 설비투자 $556.9B(차감 -$14B)와 주주환원 비율 27.4% → 9.3%, 하이일드 263bp → 326bp 대 투자등급 89bp. 결론은 AI 밸류에이션 조정과 차입 의존 기업의 신용 재평가이며, 확인할 것은 신용 스프레드 전염·2027년 설비투자 계획·실제 주문·유가와 물가.', [check('하이일드 326bp(10/29), 투자등급 89bp', 'VERIFIED', 'AIO FRED 하이일드 3.26%, 투자등급 0.89%(10/29)와 같음'), check('하이일드 8월 말 263bp', 'CONSISTENT', 'AIO 기록 8/27 263bp, 8/28 260bp'), check('9월 PCE 3.6%', 'VERIFIED', 'AIO 거시 지표판 PCE 3.6%와 같음'), check('금 약 -3%', 'VERIFIED', 'AIO 금 10/29 4,031.4 → 10/30 3,898.9(-3.3%)'), check('빅테크 5곳 1–9월 영업현금흐름·설비투자·주주환원 비율', 'UNVERIFIED', 'AIO는 분기 현금흐름을 받지 않음(sec-fiscal-history 분기에는 매출·순이익만)')]),
  source('NURadu_', '2116230300548350309', '2026-10-31', '10/30 나스닥 급락을 아마존(설비투자 $77B, 연간 $220B 가이던스, 최근 12개월 잉여현금흐름 -$42.4B) → 앤스로픽(BB급 신용등급 보도, 연기금·보험 자금 접근 제한) → 인텔(4분기 매출 $15–16B·조정 EPS $0.25 가이던스)로 이어지는 돈줄 사슬로 묶은 글. 질문이 "수요가 얼마나 늘까"에서 "그 돈을 누가 대나"로 바뀌었다는 정리.', [check('인텔 3분기 매출 $16.5B, 조정 EPS $0.52, 4분기 매출 $15–16B·조정 EPS $0.25 가이던스', 'VERIFIED', 'AIO 실적 요약(SEC 8-K 원문)과 같음'), check('아마존 희석 EPS $1.89', 'VERIFIED', 'AIO 실적 요약과 같음'), check('아마존 최근 12개월 잉여현금흐름 -$42.4B', 'VERIFIED', 'AIO 실적 요약 원문에 있었으나 v59.55까지 "12개월"의 12를 숫자로 보고 버림(v59.56에서 수정)'), check('아마존 연간 설비투자 약 $220B, AWS +39%', 'UNVERIFIED', 'AIO 콜 요약이 억 달러로 바꿔 쓴 문장을 원문 대조에서 버림(v59.56에서 단위 환산 허용)'), check('앤스로픽 BB급 등급 보도, KBRA BB+', 'UNVERIFIED', '보도 인용. AIO는 신용등급을 받지 않음')]),
  source('NURadu_', '2115846289737089247', '2026-10-30', '서비스나우가 AI 에이전트 사용량 13배를 말했는데 주가가 급락한 이유를 좌석 과금의 역설로 설명한 글. AI가 고객사 인력을 줄이면 좌석 구독이 줄고, 과금을 사용량·성과로 바꾸는 1–2년 동안 성장 둔화와 배수 하락을 견뎌야 한다는 주장. 댓글에서는 사이트 라이선스 전환, 현장 배치 엔지니어 팀이 보충됨.', [check('서비스나우 -25% 이상', 'CONSISTENT', 'AIO 반응 기록 발표 후 2거래일 누적 -30.0%'), check('하락 이유가 좌석 잠식', 'UNVERIFIED', 'AIO가 모은 보도의 이유는 다음 분기 매출 가이던스와 계약잔고(cRPO) 둔화 — 좌석 논리는 작성자의 해석')]),
  source('sshleo84', '2116515796184969332', '2026-10-31', '공포 대신 판단 기준을 세우자는 글. 이익 전망의 광범위한 하향, 하이일드 스프레드 확대, 동일가중 지수의 상대 약세가 함께 나타나면 판단을 고친다는 세 조건을 먼저 밝히고, 그 전까지는 주도주 교체(AI에서 전력·에너지·산업재·AI 활용 산업으로의 확산)를 강세장 종말로 오해하지 말라는 주장. 동일가중-시가총액 연간 수익률 차이 20년 막대그래프 첨부.', [check('일부 빅테크 급락 중 다수 종목 상승', 'CONSISTENT', 'AIO 10/30 종가: S&P 500 -1.82%, 동일가중(RSP) -0.79%; 10/26–10/30 RSP +0.5%, S&P 500 -1.3%'), check('이익 전망이 광범위하게 하향되지 않음', 'CONSISTENT', 'AIO 컨센서스 916종목 중 4주 상향 우세 344, 하향 우세 227')]),
  source('Trader_Jesse_', '2116358611236786369', '2026-10-31', '주말 공포 글을 거르는 기준. 가능성을 근거로, 차트의 닮은꼴을 인과로, 환율·외국인 수급 상관을 법칙으로 쓰는 글을 경계하고, "미국 사고 한국 팔라"는 롱숏은 무엇을 사고파는지(지수·반도체)부터 구분하라는 지적. 중간선거(11/3) 뒤 불확실성 해소, 관찰과 가설 분리, 틀렸을 때 판단을 바꿀 근거를 먼저 밝히라는 원칙. 댓글에서 포지션 데이터(헤지펀드 그로스 노출 축소) 보충.'),
  source('Trader_Jesse_', '2116345952256835942', '2026-10-31', 'AI 하드웨어 숏·바이오/헬스케어/소프트웨어/사이버보안 롱 페어를 지금 여기서 잡는 것은 말이 안 된다는 글. 인용한 10/13 글: 극단적 과매도에서 전망을 하락으로 뒤집는 것은 추세 추종이 아니라 뒤늦은 공포 추종이며, 하락 추세가 이어질 가능성과 지금 하락에 거는 것이 유리한지는 다른 문제.'),
  source('Trader_Jesse_', '2116233205116481850', '2026-10-31', '한국·중국·일본·대만 공급망 기업 100여 곳의 실적·월매출·수주·생산능력·설비투자 계획을 본 이유: 수요가 어디서 생기고, 어느 공정이 병목이 되며, 누가 가격 결정력을 갖고, 그것이 수주·매출·이익으로 언제 얼마나 빨리 이어지는가. 인용 스레드에서 병목 수혜를 병목 제품 공급자·증설 수혜자·가동률 수혜자 셋으로 나누고, 2026-05-09 스레드에서 AI 장세를 이익 증명 → 레버리지 → 구조화·대중화 세 단계로 나눠 이익 추정치·레버리지·크레딧·IPO 네 계기판을 제시.'),
  source('ysh1yo2848', '2116342909259944335', '2026-10-31', '미국 주식 상대강도 상위 50종목의 업종 분포(누적·1주·1개월). 바이오·제약과 진단·의료가 최상위, 반도체·하드웨어와 진단은 이탈 우세. 정치 일정 선반영 추정과 바닥 업종 매수 암시는 반영하지 않음.', [check('바이오·제약 강세, 반도체·하드웨어 약세', 'CONSISTENT', 'AIO 10/30 테마 흐름: 대형 제약 +1.9%, 반도체·AI 칩 -10.0%')]),
  source('sustain_abund', '2116375222479942111', '2026-10-31', '10/30 마감 기술적 메모: VIX 갭 하락 가능성, S&P 500의 120일선 반등과 200일선 하방, 애플·AMD 실적이 기술주 방향을 정한다는 관측, 필라델피아 반도체보다 메모리 선호, 금·비트코인 가격 구간. 가격 구간 예측은 반영하지 않음.', [check('S&P 500이 200일선에서 멂', 'VERIFIED', 'AIO 10/30 S&P 500 7,580.07, 200일선 7,310(+3.7%)')])
]);

const ref = (handle, statusId) => `${handle}-${statusId}`;
const R = {
  crossAsset: ref('dubidubabap', '2116235808109986188'), funding: ref('NURadu_', '2116230300548350309'), seats: ref('NURadu_', '2115846289737089247'),
  criteria: ref('sshleo84', '2116515796184969332'), fear: ref('Trader_Jesse_', '2116358611236786369'), pair: ref('Trader_Jesse_', '2116345952256835942'),
  chain: ref('Trader_Jesse_', '2116233205116481850'), rs: ref('ysh1yo2848', '2116342909259944335')
};

export const PACKET_20261101_FRAMES = Object.freeze([
  { id: 'truth-leverage-gauges', path: 'market', title: '진짜 산업 위의 레버리지: 이익·레버리지·신용·상장 네 계기판', issue: '산업이 진짜여도 주가는 그 위에 얹힌 레버리지 때문에 크게 꺾일 수 있어, 이익 추정치·레버리지·신용·상장 시장 네 가지로 국면을 읽는 방법', sourceRefs: [R.chain, R.funding, R.crossAsset],
    answer: 'AI 수요가 진짜라는 것과 주가가 안전하다는 것은 다릅니다. 이익이 먼저 증명되면 그 이익을 담보로 차입·신용·구조화 상품이 붙고, 마지막에는 이익 없는 기업 상장까지 이어집니다. 그래서 국면은 이익 추정치가 계속 오르는지, 레버리지가 얼마나 들어왔는지, 신용 시장에 균열이 보이는지, 상장 시장이 과열됐는지 네 가지로 함께 봅니다. 숫자가 오르는 조정은 기회일 수 있고, 숫자가 꺾이는데 주가만 버티면 위험 신호입니다.',
    steps: ['이익 추정치의 방향', '이익을 담보로 붙은 레버리지(신용융자·옵션·사모신용·데이터센터 대출)', '신용 균열(하위 등급 스프레드·사모신용 환매·신규 발행 소화)', '상장 시장 과열(이익 없는 상장·첫날 급등)', '네 계기판의 조합으로 국면 판정'],
    mechanism: [
      '이익이 먼저 증명되는 구간에서는 병목 인프라(메모리·네트워크·전력)가 먼저 오릅니다. 그 뒤 오른 주가가 신뢰를 만들고, 신뢰가 차입과 외부 자본을 끌어와 설비투자가 커집니다. 이때부터 주가는 이익 증가율보다 빠르게 미래를 당겨 반영합니다.',
      '끝은 주식보다 신용에서 먼저 보일 수 있습니다. 투자등급은 그대로인데 하위 등급 스프레드만 벌어지거나, 사모신용 환매가 쌓이거나, 차입으로 짓는 쪽(신생 클라우드·AI 기업)의 조달 금리가 오르면, 현금이 많은 빅테크와 빌려서 짓는 쪽의 위험이 다르게 매겨지기 시작한 것입니다.',
      'AIO에서는 이익 추정치 방향(매크로의 지수 이익 전망), 신용의 등급 간 분화(시장 상태의 신용 축과 석 달 변화), 실적 요약의 설비투자·현금흐름, 시장 온도의 신용융자를 함께 놓고 봅니다. 상장 시장 과열은 아직 데이터가 없어 보도로만 확인합니다.'
    ],
    reverse: '레버리지가 늘어도 이익이 그보다 빨리 늘면 부담은 오히려 줄고, 신용 스프레드의 확대는 경기 둔화 없이 공급(신규 발행)만으로도 생깁니다. 상장 과열 역시 한두 건의 큰 상장으로 판정하면 과장됩니다. 네 계기판 중 하나만 켜진 상태를 국면 전환으로 읽지 않습니다.',
    channels: ['신용', '심리'], variables: ['이익 추정치 상향·하향 종목 수', '신용융자 잔고', '하이일드·CCC·투자등급 스프레드', '사모신용 환매 요청', '신규 상장 수와 첫날 수익률', '빅테크 설비투자 대비 영업현금흐름'],
    indicators: [{ label: '시장 상태의 신용 축과 석 달 변화', route: 'signal', routeLabel: '시장 상태' }, { label: '매크로의 S&P 500 이익 전망', route: 'macro', routeLabel: '매크로' }, { label: '주요 발표 요약의 설비투자·현금흐름', route: 'market-news', routeLabel: '뉴스' }],
    shift: 'AI 장세를 "진짜냐 거품이냐"로 묻던 모델에서, 진짜 산업 위에 얹힌 레버리지의 농도를 이익·레버리지·신용·상장 네 계기판으로 읽는 모델로 전환', inputs: ['forward EPS revisions', 'margin debt', 'HY/CCC/IG spreads', 'private credit redemptions', 'IPO first-day returns', 'capex vs operating cash flow'],
    chart: '이익 추정치 상향 비율 선과 하이일드·CCC 스프레드 선을 같은 기간에 겹치고, 신용융자 잔고 막대를 아래에 두기', counterclaim: '이익이 레버리지보다 빨리 늘면 부담은 줄고, 스프레드 확대는 신규 발행 공급만으로도 생길 수 있어 한 계기판으로 국면을 판정하면 틀림', concepts: ['credit-creation', 'fcf-vs-funding'] },

  { id: 'leadership-handoff-criteria', path: 'market', title: '주도주 교체와 강세장 끝을 가르는 세 조건', issue: '주도주가 급락할 때 그것이 상승장의 끝인지 주도권이 다른 업종으로 넘어가는 중인지를, 미리 정한 세 조건(이익 전망·하이일드·동일가중)으로 판정하는 방법', sourceRefs: [R.criteria, R.fear, R.pair, R.rs],
    answer: '주도주가 크게 빠진 날 경기침체를 확정처럼 말하는 글이 늘어납니다. 그 전에 판단을 바꿀 조건을 먼저 정해 둡니다. 기업 이익 전망이 넓게 하향되고, 하이일드 스프레드가 넓어지고, 동일가중 지수까지 시가총액 지수보다 약해지면 시장 전체가 약해지는 쪽입니다. 셋이 아직 아니면 주도주 하락은 주도권이 다른 업종으로 옮겨 가는 과정일 수 있어, 새로 강해지는 업종을 함께 봅니다.',
    steps: ['판단을 바꿀 조건을 먼저 적기', '이익 전망 하향의 폭(하향 종목 수)', '하이일드 스프레드의 방향(20·60거래일)', '동일가중 대 시가총액 지수의 상대 성과', '새로 강해지는 업종과 종목'],
    mechanism: [
      '시가총액 지수는 소수 대형주가 끌고 갑니다. 같은 날 동일가중 지수가 덜 빠지거나 오르면 하락은 대형 기술주에 몰린 것이고, 동일가중까지 약해지면 매도가 시장 전반으로 번진 것입니다.',
      '이익 전망과 신용은 가격보다 느리지만 덜 흔들립니다. 주가가 급락해도 추정치 상향 종목이 하향보다 많고 하이일드가 넓어지지 않으면 이익과 자금 조달의 바탕은 아직 버티는 것입니다. 반대로 셋이 함께 나빠지면 주도권 교체가 아니라 전반적 약세입니다.',
      '같은 원리로 국가·업종 롱숏을 볼 때는 무엇을 사고파는지부터 나눕니다. 한국 대형 반도체는 미국 반도체지수와 함께 움직이는 구간이 많아 "미국 롱·한국 숏"이 사실은 같은 위험을 양쪽에 든 것일 수 있고, 상관이 흔들리는 국면에서는 과거 관계를 전제로 한 짝이 둘 다 손실이 날 수 있습니다.'
    ],
    reverse: '세 조건은 늦게 켜집니다. 이익 전망은 실적 시즌에 몰아서 바뀌고, 하이일드는 주가가 이미 크게 빠진 뒤 넓어지기도 해, 조건이 다 켜질 때를 기다리면 하락의 상당 부분을 이미 지난 뒤일 수 있습니다. 반대로 동일가중의 상대 강세가 방어 업종으로의 도피일 뿐이면 주도권 교체가 아니라 위험 회피입니다.',
    channels: ['이익', '신용', '심리'], variables: ['이익 추정치 상향·하향 종목 수', '하이일드 20·60거래일 변화', '동일가중 대 시가총액 지수 상대 성과', '업종별 상대강도 순위', '방어 업종 비중'],
    indicators: [{ label: '시장 흐름의 동일가중 대비', route: 'home', routeLabel: '오늘' }, { label: '테마·섹터 상대강도', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '시장 상태의 신용 축', route: 'signal', routeLabel: '시장 상태' }],
    shift: '주도주 급락을 강세장의 끝으로 읽던 모델에서, 판단을 바꿀 세 조건(이익 전망·하이일드·동일가중)을 먼저 정하고 그 전까지는 주도권 이동과 새 주도 업종을 확인하는 모델로 전환', inputs: ['EPS revision breadth', 'HY spread 20/60-session change', 'RSP vs SPX relative return', 'sector RS ranks', 'defensive weight'],
    chart: '동일가중 ÷ 시가총액 지수 비율 선과 하이일드 스프레드 선을 겹치고, 업종 상대강도 순위표를 옆에 두기', counterclaim: '세 조건은 늦게 켜져 하락의 대부분이 지난 뒤일 수 있고, 동일가중의 상대 강세가 방어 업종 도피일 뿐이면 교체가 아니라 위험 회피임', concepts: ['sector-rotation-cycle', 'correlation'] },

  { id: 'bottleneck-beneficiary-tiers', path: 'industry', title: '공급 병목의 세 수혜층: 병목 제품·증설·가동률', issue: '수요가 병목을 만들 때 수혜가 병목 제품 공급자, 생산능력을 늘리는 장비 공급자, 가동률이 오르며 소모품을 파는 공급자 순으로 다르게 오는 구조', sourceRefs: [R.chain],
    answer: '빅테크 설비투자가 늘었다고 모든 반도체·장비 기업의 이익이 같은 속도로 늘지 않습니다. 병목 제품을 직접 만드는 회사는 판매가·제품 구성·장기 계약으로 먼저 벌고, 그 병목을 풀려고 생산능력을 늘릴 때 검사·정렬·후공정 장비 회사가 발주로 벌며, 늘어난 생산이 돌아가는 동안에는 공구·소모 부품 회사가 반복 소비로 법니다. 같은 업종 안에서도 고객·기술·생산능력에 따라 이익이 연결되는 시점과 속도가 다릅니다.',
    steps: ['수요가 생기는 곳(최종 고객의 설비투자)', '병목이 되는 공정과 제품', '병목 제품 공급자의 가격 결정력', '증설 발주를 받는 장비 공급자', '가동률을 따라가는 소모품 공급자', '각 단계가 수주·매출·이익으로 바뀌는 시점'],
    mechanism: [
      '병목 제품 공급자는 가격과 계약 기간이 이익을 정합니다. 공급이 모자라면 판매가가 오르고 장기 계약으로 물량이 묶여 이익이 먼저 늘지만, 증설이 가동되는 시점부터 가격 결정력이 약해집니다.',
      '증설 수혜자는 발주의 크기와 반복성이 이익을 정합니다. 신규 설비투자가 이어지는 동안 수주가 쌓이지만, 설비투자 계획이 줄면 수주가 먼저 꺾입니다. 그래서 고객의 다음 해 설비투자 계획과 월별 수주·매출을 함께 봅니다.',
      '가동률 수혜자는 생산량에 비례해 늦게, 오래 법니다. 첨단 패키징처럼 공정 수가 늘면 기판 면적·층수와 검사 시간이 늘어 소모량이 커지고, 이익은 증설이 끝난 뒤에도 가동이 이어지는 동안 유지됩니다.'
    ],
    reverse: '세 층의 순서가 늘 지켜지지 않습니다. 병목이 예상보다 빨리 풀리면 병목 제품 공급자의 이익이 먼저 꺾이고, 증설이 과잉으로 끝나면 장비 수주는 가동률 상승 없이 줄어듭니다. 같은 층 안에서도 고객 집중과 기술 격차가 이익을 가르니, 층 이름만으로 수혜를 정하지 않습니다.',
    channels: ['단가', '투자', '물량'], variables: ['병목 제품 판매가·계약 기간', '고객 설비투자 계획', '장비 월별 수주·매출', '가동률', '소모품 반복 매출', '증설 가동 시점'],
    indicators: [{ label: 'AI 공급망 묶음별 흐름', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '주요 발표 요약의 가이던스와 설비투자', route: 'market-news', routeLabel: '뉴스' }],
    shift: '"AI 수혜주"를 한 묶음으로 읽던 모델에서, 병목 제품·증설·가동률 세 수혜층이 서로 다른 시점과 속도로 이익을 얻는 구조로 읽는 모델로 전환', inputs: ['bottleneck selling price', 'customer capex plan', 'equipment orders', 'utilization', 'consumables revenue', 'capacity start dates'],
    chart: '세 수혜층 대표 묶음의 분기 매출 증가율을 같은 축에 겹치고, 최종 고객 설비투자 증가율 선을 함께 보기', counterclaim: '병목이 빨리 풀리거나 증설이 과잉으로 끝나면 순서가 깨지고, 같은 층 안에서도 고객 집중과 기술 격차가 이익을 가름', concepts: ['capex', 'utilization-contract'] }
].map(Object.freeze));

export const PACKET_20261101_LESSONS = Object.freeze(PACKET_20261101_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((id) => { const s = PACKET_20261101_SOURCES.find((row) => row.id === id); return { label: `${s.author} — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261101_CLAIMS = Object.freeze(PACKET_20261101_FRAMES.map((f) => Object.freeze({
  id: `claim-20261101-${f.id}`, packetId: 'packet-2026-11-01-x-bookmarks', observedOn: '2026-11-01', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '이익 추정치 4주 수정, 신용 스프레드 20·60거래일, 동일가중 대비 5거래일, 분기 실적·월별 수주를 구분; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 북마크의 현금흐름 합계·스프레드·등급·주가 반응은 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['빅테크 현금흐름 합계', '스프레드 수준', '신용등급 보도', '발표 후 주가 반응']), status: 'FRAMEWORK_EXTRACTED'
})));
