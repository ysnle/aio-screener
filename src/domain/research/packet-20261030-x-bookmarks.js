// The owner's X bookmarks added after the 2026-10-28 read (2026-10-30). Every bookmark in x.com/i/history above the first
// id of the 10/28 read was read in full — posts, author threads, quoted posts and every attached image — then compared with
// what AIO already teaches and shows. Same reference-only shape as packet-20261028-x-bookmarks.js: nothing here is a live
// value, a ranking input or a call. The ledger is _artifacts/x-bookmarks-20261030/.
const check = (claim, state, basis) => Object.freeze({ claim, state, basis });
// From _artifacts/x-bookmarks-20261030/ledger.json (grade scale there): A checked or reusable, B cited or confirming, C none.
const SOURCE_TIMELINE = Object.freeze({
  '2116026764631658546': Object.freeze({ postedAtUtc: '2026-10-30T04:37:49Z', refersTo: "INTC Q3 call of 10/29 after the close", lag: "about 8 h after the call", laterOutcome: "AIO brief: revenue $16.5B (matches); latest trade -25.8% vs the -21.9% after-hours print in the attached screenshot" }),
  '2115678175988699203': Object.freeze({ postedAtUtc: '2026-10-29T05:32:39Z', refersTo: "WSJ article on iPhone memory chips and AI", lag: "unknown (paywalled)", laterOutcome: "n/a" }),
  '2115921893786280267': Object.freeze({ postedAtUtc: '2026-10-29T21:41:06Z', refersTo: "Memory industry through FY2026; new fabs 2027–2029", lag: "not event-bound", laterOutcome: "Cannot be judged yet (a cycle call). Micron growth arithmetic checks" }),
  '2115574525718860249': Object.freeze({ postedAtUtc: '2026-10-28T22:40:47Z', refersTo: "GOOGL Q3 call of 10/28", lag: "about 2 h after the call", laterOutcome: "Revenue $127.6B and 31.8% margin match the AIO brief; first session -12.6% vs about -10.5% after hours" }),
  '2115798637695619154': Object.freeze({ postedAtUtc: '2026-10-29T13:31:19Z', refersTo: "MSFT·GOOGL calls of 10/28, broker notes of 10/29", lag: "about 17 h after the calls", laterOutcome: "MSFT first session -0.2% (AIO) beside GOOGL -12.6%: cash-flow guidance split two hyperscalers on the same night" }),
  '2116139928174182778': Object.freeze({ postedAtUtc: '2026-10-30T12:07:29Z', refersTo: "10/30 US premarket (after the AMZN·INTC after-hours reports of 10/29)", lag: "about 16 h after the reports, 1.5 h before the open", laterOutcome: "AIO latest trade at 09:54Z: AMZN -7.2%, INTC -25.8% — consistent with the post's -7.3% / -25%" }),
  '2115520189051855082': Object.freeze({ postedAtUtc: '2026-10-28T19:04:52Z', refersTo: "Anthropic S-1 of 10/26", lag: "2 days after the filing", laterOutcome: "IPO not priced yet; the PV of years 1–5 recomputes" }),
  '2115638855869296798': Object.freeze({ postedAtUtc: '2026-10-29T02:56:24Z', refersTo: "a general rule for post-earnings gaps", lag: "not event-bound", laterOutcome: "Checkable on AIO's own reactions: META -7.0% first day, -10.5% after six sessions; SK hynix +10.9% first day, +5.7% after three" }),
  '2116001035575816689': Object.freeze({ postedAtUtc: '2026-10-30T02:55:34Z', refersTo: "10/29 US close and the 10/30 Korean and Japanese mornings", lag: "intraday, KOSPI chart at 11:55 KST", laterOutcome: "Samsung brief: 2 sessions -7.0% (AIO). PCE 3.6% matches the 거시 board" }),
  '2115264014032986365': Object.freeze({ postedAtUtc: '2026-10-28T02:06:55Z', refersTo: "the 10/27 rebound", lag: "same day", laterOutcome: "10/29–30 sold off again (SMH -1.1% on 10/29, AI infrastructure down premarket 10/30): the day-to-day flip the post warns against" })
});
const SOURCE_QUALITY = Object.freeze({
  '2116026764631658546': Object.freeze({"data": "A", "coverage": "B", "logic": "A", "insight": "A"}),
  '2115678175988699203': Object.freeze({"data": "C", "coverage": "B", "logic": "C", "insight": "B"}),
  '2115921893786280267': Object.freeze({"data": "B", "coverage": "A", "logic": "A", "insight": "B"}),
  '2115574525718860249': Object.freeze({"data": "A", "coverage": "B", "logic": "A", "insight": "A"}),
  '2115798637695619154': Object.freeze({"data": "B", "coverage": "A", "logic": "B", "insight": "B"}),
  '2116139928174182778': Object.freeze({"data": "B", "coverage": "A", "logic": "B", "insight": "B"}),
  '2115520189051855082': Object.freeze({"data": "A", "coverage": "B", "logic": "A", "insight": "A"}),
  '2115638855869296798': Object.freeze({"data": "C", "coverage": "B", "logic": "B", "insight": "A"}),
  '2116001035575816689': Object.freeze({"data": "B", "coverage": "A", "logic": "A", "insight": "B"}),
  '2115264014032986365': Object.freeze({"data": "C", "coverage": "B", "logic": "A", "insight": "B"})
});
// v59.44 (owner 2026-10-30, "시간과 시계열도 같이 보고 있는거지? 퀄리티·커버리지·로직·관점"): each source carries when it was
// posted against the event it reads and what AIO's own data showed afterwards (timeline), and four grades (quality) on the
// ledger's scale — data checked, coverage, logic with a falsifier, insight new to AIO.
const source = (handle, statusId, date, summary, checks = []) => Object.freeze({
  id: `${handle}-${statusId}`, author: handle, sourceUrl: `https://x.com/${handle}/status/${statusId}`, publishedAt: date, publishedAtKst: date,
  sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED', summary, checks: Object.freeze(checks),
  timeline: SOURCE_TIMELINE[statusId], quality: SOURCE_QUALITY[statusId]
});

// What the 2026-10-30 read covered: 19 bookmarks new since the 10/28 read, 16 investment material, 3 agent practice.
export const PACKET_20261030_AUDIT = Object.freeze({
  readOn: '2026-10-30', newSinceLedger: 19, inScope: 16, agentPractice: 3, unrelated: 0, framesAdded: 4,
  repoState: Object.freeze({ reflected: 6, partial: 8, missing: 1, conflict: 0, notApplicable: 4 }),
  alreadyCovered: Object.freeze([
    '빅테크 실적은 성장 × 설비투자 × 잉여현금흐름 → hyperscaler-capex-grid (알파벳·아마존 급락, 마이크로소프트·오라클 상승이 같은 틀)',
    '레버리지 청산과 투자 논리 훼손의 구분 → forced-seller-chain',
    '메모리 이익 정점에서 가장 싸 보이는 배수와 증설 주기 → memory-cycle-lead, contract-duration-multiple',
    '수평선·추세선이 통했는지 세어 보기 → static-level-base-rate'
  ]),
  declined: Object.freeze(['개별 매매 포지션 공개와 가격 구간 매매', '헤지펀드 공매도 비율과 상장 이벤트 반등 예측(단일 출처, 확인 불가)', '종교 비유 문체']),
  conflictsFixed: Object.freeze([]),
  // What the read changed on the screens (v59.44), beside the frames.
  structural: Object.freeze([
    'AI 공급망 흐름 문장에 같은 거래일 방어 업종(헬스케어·필수소비재·부동산·유틸리티) 대비를 붙임',
    '실적 요약이 설비투자·잉여현금흐름·영업현금흐름을 함께 뽑고 카드 앞면에 보임',
    '발표 후 3거래일부터 첫날 뒤 경로(더 내림·일부 되돌림)를 적음'
  ])
});

export const PACKET_20261030_SOURCES = Object.freeze([
  source('MelvinInvests', '2116026764631658546', '2026-10-30', '인텔 3분기 콜 정리. 실적은 괜찮았지만 4분기 매출·이익 가이던스가 기대를 크게 밑돌았고, 원인으로 메모리 부족이 PC 가격을 올려 PC 시장이 2026년 약 12%, 2027년 약 10% 줄 것이라는 회사 전망, 서버 CPU는 수요가 넘치지만 생산 능력이 모자라 2027년 상반기까지 제약. AI 수요가 다른 제품의 비용이 되는 사례.', [check('인텔 3분기 매출 $16.5B', 'VERIFIED', 'AIO 실적 요약(SEC 8-K 원문) 매출 $16.5 billion과 같음'), check('조정 EPS $0.52, 4분기 매출 가이던스 $15–16B', 'UNVERIFIED', 'AIO 요약은 희석 EPS(GAAP) $0.60을 실음. 조정 기준과 가이던스는 대조하지 않음'), check('PC 시장 2026년 -12%, 2027년 -10% 전망', 'UNVERIFIED', '작성자가 전한 경영진 발언. 녹취록과 대조하지 않음')]),
  source('jukan05', '2115678175988699203', '2026-10-29', '애플 아이폰과 AI 메모리 칩을 다룬 기사 링크(제목만 확인, 본문은 유료). AI 서버가 메모리를 흡수하면서 휴대폰 제조사의 원가가 오르는 연결을 다룬 것으로 보임.', [check('기사 내용', 'UNVERIFIED', '유료 기사라 제목(주소)만 확인')]),
  source('chamath', '2115921893786280267', '2026-10-29', '메모리 업체 이익은 폭증했는데 주가는 고점 아래인 이유를 다섯 부분으로 정리한 리서치. 마이크론 매출 FY2025 $37.4B → FY2026 $133.2B(+256%), 신규 공장이 2027–2029년 가동, 중국 CXMT의 D램 매출 점유율 4% → 10%, 과거 두 번의 하락은 고객 재고 소화에서 시작. 이익 정점에서 배수가 가장 싸 보인다는 지적.', [check('마이크론 매출 $37.4B → $133.2B는 +256%', 'VERIFIED', '133.2 ÷ 37.4 − 1 = 2.56'), check('CXMT 점유율 4% → 10%', 'UNVERIFIED', '조사기관 인용. AIO는 메모리 점유율 데이터를 받지 않음')]),
  source('saso_capital', '2115574525718860249', '2026-10-28', '알파벳 3분기 콜 정리. 검색 광고 +12%로 둔화, 원인 넷 중 AI 모드(검색당 수익화가 낮은 화면)로 이용이 옮겨 가는 것만 구조적. 클라우드 매출 +103%, 3분기 잉여현금흐름 -$9.1B(설비투자 $51.4B), 미래 구매 약정 $924B·미개시 리스 $152B. 시장은 성장이 아니라 현금을 값매기고 있다는 결론.', [check('매출 $127.6B, 영업이익률 31.8%', 'VERIFIED', 'AIO 실적 요약(SEC 8-K 원문)의 매출 $127.6 billion, 영업이익률 31.8%와 같음'), check('3분기 잉여현금흐름 -$9.1B, 설비투자 $51.4B', 'UNVERIFIED', '현금흐름표와 대조하지 않음. v59.44부터 실적 요약이 설비투자·잉여현금흐름을 뽑음'), check('시간외 $322.22 → $288.35(약 -10.5%)', 'CONSISTENT', '다음 날 AIO 반응 기록은 정규장 종가 기준 -12.6%')]),
  source('GONOGO_Korea', '2115798637695619154', '2026-10-29', '빅테크 실적 정리. 구글은 AI 모드 검색이 늘었지만 검색당 수익화가 낮아 광고 성장이 둔화, 마이크로소프트는 애저 +48%에 회계연도 잉여현금흐름 플러스 유지 전망, 파운드리 오픈소스 모델 매출 10배. 중국 AI 설비투자 2025년 $110B → 2030년 $350B 전망 인용.', [check('애저 성장률 48%(직전 40%·43%)', 'UNVERIFIED', '작성자 인용. AIO 마이크로소프트 요약과 대조하지 않음')]),
  source('zerohedge', '2116139928174182778', '2026-10-30', '10/30 장전 주요 종목. 아마존 -7.3%(AWS 성장 실망), 인텔 -25%(PC 부진 가이던스), AI 인프라 동반 약세, 트윌리오 -18%를 AI 도입 속 소프트웨어 성장 재평가의 최신 사례로, 레딧·로블록스·핀터레스트 급락, 리제네론·길리어드 등 헬스케어 상승.', [check('아마존 장전 -7.3%', 'CONSISTENT', 'AIO 반응 기록의 발표 후 최근 체결가 -7.2%와 거의 같음'), check('인텔 장전 -25%', 'CONSISTENT', 'AIO 반응 기록의 발표 후 최근 체결가 -25.8%')]),
  source('AswathDamodaran', '2115520189051855082', '2026-10-28', '앤스로픽 상장 신고서 기준 가치평가. 매출이 급증했지만 3분기에 둔화, 매출 대비 연산비 251% → 48%로 하락, 연산 약정 $650B 초과를 계약상 부채로 보고 BB+ 금리 6.28%로 할인한 현재가치 약 $3,630억. 지분가치 약 $1.475조로 소문난 공모가 $1.5–2조보다 낮아 공모에는 불참.', [check('연차별 약정 1–5년차를 6.28%로 할인한 현재가치', 'VERIFIED', '63,168 ÷ 1.0628 = 59,435 등 1–5년차 합 약 2,795억 달러로 표와 몇백만 달러 안에서 같음'), check('6년차 이후 834.9억 달러', 'UNVERIFIED', '6년차 이후 지급 구조가 공개되지 않아 재계산하지 못함')]),
  source('Venu_7_', '2115638855869296798', '2026-10-29', '실적 뒤 15–20% 급락한 종목을 볼 때의 3일 원칙. 큰 기관은 하루에 다 팔 수 없어 첫날 반등은 숏커버일 수 있고, 둘째·셋째 날 새 저점이 나올 수 있다. 사흘 뒤 매도 거래량 감소, 저점 유지, 하락 이유 이해, 투자 논리 유지를 확인하고, 사업이 망가졌으면 할인이 아니라 재평가.'),
  source('blazingbees', '2116001035575816689', '2026-10-30', '10/30 머니플로우. 알파벳·아마존이 설비투자 확대와 잉여현금흐름 악화로 급락하고 샌디스크는 실적·가이던스가 예상을 넘었는데 성장률 둔화로 하락. 코스피 -5%, 하락 종목이 상승의 6배, 일본도 반도체가 지수보다 크게 하락, 헬스케어는 미국·한국·일본 모두 상대 강세. 좋은 실적만 보고 안심할 수 없고 시장이 무엇을 우려하는지 봐야 한다는 정리.', [check('PCE 3.6%', 'VERIFIED', 'AIO 거시 지표판의 9월분 PCE 물가 3.6%와 같음')]),
  source('Trader_Jesse_', '2115264014032986365', '2026-10-28', '반등한 날 사고 내일 빠지면 줄이는 식으로 하루 가격에 따라 비중을 뒤집지 말라는 글. 이번 조정의 원인(과도한 신용·레버리지 청산)과 회복 근거(AI 인프라 투자와 이익 성장)를 이해했다면 감당할 비중을 미리 정했어야 하고, 투자 논리가 훼손될 때만 판단을 바꾼다. 매크로는 변수이지 모든 주가 움직임의 답이 아니다.')
]);

const ref = (handle, statusId) => `${handle}-${statusId}`;
const R = {
  intel: ref('MelvinInvests', '2116026764631658546'), apple: ref('jukan05', '2115678175988699203'), memory: ref('chamath', '2115921893786280267'),
  google: ref('saso_capital', '2115574525718860249'), bigtech: ref('GONOGO_Korea', '2115798637695619154'), movers: ref('zerohedge', '2116139928174182778'),
  anthropic: ref('AswathDamodaran', '2115520189051855082'),
  threeDay: ref('Venu_7_', '2115638855869296798'), flow: ref('blazingbees', '2116001035575816689'), hold: ref('Trader_Jesse_', '2115264014032986365')
};

export const PACKET_20261030_FRAMES = Object.freeze([
  { id: 'ai-demand-cost-squeeze', path: 'industry', title: 'AI 수요가 남의 비용이 될 때: 메모리 부족과 PC·휴대폰', issue: 'AI 서버가 메모리를 흡수하면 메모리 업체 이익은 늘지만, 같은 메모리를 사는 PC·휴대폰 쪽은 원가가 올라 수요가 줄어드는 연결', sourceRefs: [R.intel, R.apple, R.memory],
    answer: 'AI 수요는 공급망 안에서 누군가의 매출이면서 다른 누군가의 비용입니다. 메모리가 AI 서버로 몰리면 메모리 업체의 가격과 이익이 오르지만, 같은 메모리를 사서 PC·휴대폰을 만드는 회사는 원가가 오르고 소비자 가격이 올라 판매가 줄 수 있습니다. 그래서 반도체 안에서도 메모리 강세와 PC용 칩·완제품 약세가 같은 원인에서 함께 나올 수 있습니다.',
    steps: ['병목 부품(메모리)의 가격 상승', '그 부품을 사는 완제품의 원가 비중', '완제품 가격 인상과 수요 탄력성', '완제품 칩 공급사의 매출·마진', '병목이 풀리는 시점(증설 가동)'],
    mechanism: [
      '완제품에서 메모리가 차지하는 원가 비중이 클수록 메모리 가격 상승이 마진이나 판매가에 크게 전가됩니다. 기업 고객이 교체 주기를 늦출 수 있는 PC는 가격이 오르면 판매가 먼저 줄고, 그 PC에 들어가는 CPU 매출도 함께 줄어듭니다.',
      '같은 회사 안에서도 갈립니다. 서버 CPU는 AI 수요로 모자라고 PC CPU는 메모리 원가 때문에 줄면, 전체 매출 가이던스는 약해도 서버 쪽은 생산 능력이 문제라 원인이 다릅니다. 실적 요약에서 사업부별 매출과 경영진이 꼽은 원인을 나눠 읽습니다.',
      '병목은 영원하지 않습니다. 메모리 업체가 기록적인 현금으로 공장을 늘리고 그 공장이 가동되면 가격이 내려가고, 그때는 완제품 쪽 원가 부담이 줄고 메모리 쪽 이익이 줄어듭니다. 증설 가동 일정과 고객 재고가 전환점을 정합니다.'
    ],
    reverse: '메모리 가격 상승이 언제나 완제품 수요를 줄이는 것은 아닙니다. 프리미엄 제품은 가격 인상을 소비자에게 넘길 수 있고, 교체 주기가 몰린 해에는 가격이 올라도 판매가 버팁니다. 경영진이 메모리를 탓하는 것은 다른 부진 원인(점유율 하락, 제품 경쟁력)을 가리는 설명일 수도 있어, 경쟁사 실적과 함께 봅니다.',
    channels: ['단가', '비용'], variables: ['메모리 계약 가격', '완제품 원가 중 메모리 비중', 'PC·휴대폰 출하량 전망', '사업부별 매출', '증설 가동 시점', '고객 재고'],
    indicators: [{ label: 'AI 공급망 묶음별 흐름(메모리와 PC·소비자 칩)', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '실적 요약의 사업부문과 가이던스', route: 'market-news', routeLabel: '뉴스' }],
    shift: 'AI 수요를 반도체 전체의 호재로 읽던 모델에서, 병목 부품 가격이 그 부품을 사는 완제품의 비용이 되어 같은 원인에서 승자와 패자가 함께 나오는 모델로 전환', inputs: ['memory contract price', 'bill of materials share', 'unit shipment outlook', 'segment revenue', 'capacity start dates', 'customer inventory'],
    chart: '메모리 업체와 PC·휴대폰 칩 업체의 한 달 수익률을 나란히, 메모리 가격 추이와 겹쳐 보기', counterclaim: '프리미엄 완제품은 원가 상승을 가격으로 넘겨 수요가 버틸 수 있고, 경영진의 메모리 탓은 다른 부진을 가리는 설명일 수 있음', concepts: ['pass-through', 'elasticity'] },

  { id: 'usage-up-yield-down', path: 'business', title: '이용은 늘고 단위 수익은 줄 때: AI 검색과 소프트웨어', issue: 'AI가 이용량을 늘려도 이용 한 건당 수익이 낮은 화면으로 옮겨 가면 매출 성장이 둔화하는 구조와, AI 도입 속 소프트웨어 성장 재평가', sourceRefs: [R.google, R.bigtech, R.movers],
    answer: 'AI로 이용이 늘었다는 말과 돈을 더 번다는 말은 다릅니다. 검색이 AI 모드로 옮겨 가면 질문 수는 늘어도 한 번의 검색에서 버는 광고 수익이 아직 낮아 매출 성장이 둔화할 수 있습니다. 좌석 수로 돈을 버는 소프트웨어도 AI가 사람의 일을 대신하면 고객이 늘어도 좌석 수가 줄 수 있어, 시장은 이용량보다 단위 수익을 먼저 봅니다.',
    steps: ['이용량(질문·사용자·토큰) 변화', '새 화면·제품의 단위 수익', '기존 이익 풀에서 옮겨 가는 몫', '단위 수익을 올리는 장치(광고·가격) 진행', '총매출과 마진의 결과'],
    mechanism: [
      '매출은 이용량 × 단위 수익입니다. 이용량이 늘어도 단위 수익이 낮은 화면으로 이용이 옮겨 가면 총매출 성장은 오히려 느려질 수 있습니다. 회사가 새 화면의 단위 수익을 숫자로 밝히지 않으면, 그 격차가 얼마나 좁혀지는지는 다음 분기 매출로만 확인됩니다.',
      '소프트웨어는 과금 단위가 결과를 가릅니다. 사람 수(좌석)로 받는 회사는 AI가 업무를 대신할수록 고객사 직원 수와 함께 좌석이 줄 위험이 있고, 사용량이나 결과로 받는 회사는 AI 사용이 늘수록 매출이 늘 수 있습니다. 같은 소프트웨어 업종 안에서도 실적 반응이 갈리는 이유입니다.',
      '이 구조에서 실적 판정은 예상 대비 몇 % 넘었는지보다 단위 수익의 방향입니다. 경영진이 새 화면의 수익화 실험 결과를 말하지만 숫자를 주지 않으면 시장은 할인하고, 숫자가 나오면 그때 재평가합니다.'
    ],
    reverse: '단위 수익이 낮은 새 화면도 이용이 순증이면 총이익 풀을 키울 수 있습니다. AI 검색 질문의 대부분이 원래 없던 질문이라면 잠식이 아니라 추가이고, 광고가 붙으면 격차는 좁혀집니다. 좌석 과금 소프트웨어도 AI 기능을 비싼 요금제로 팔면 좌석 감소를 상쇄할 수 있습니다.',
    channels: ['매출', '단가'], variables: ['이용량 증가율', '단위당 수익', '새 화면 비중', '과금 단위(좌석·사용량)', '광고·가격 실험 결과', '총매출 성장률'],
    indicators: [{ label: '소프트웨어·인터넷 종목의 실적 반응', route: 'market-news', routeLabel: '뉴스' }, { label: '기업 이해의 돈이 들어오는 길', route: 'ticker', routeLabel: '종목 요약' }],
    shift: 'AI 이용량 증가를 매출 증가로 바로 읽던 모델에서, 매출 = 이용량 × 단위 수익으로 나눠 이용이 단위 수익이 낮은 곳으로 옮겨 가는지와 과금 단위가 AI에 어떻게 반응하는지로 읽는 모델로 전환', inputs: ['usage growth', 'revenue per unit', 'surface mix', 'pricing unit', 'monetization tests', 'total revenue growth'],
    chart: '분기별 이용량 증가율과 매출 증가율을 같은 축에 겹쳐 두 선의 간격(단위 수익 변화) 보기', counterclaim: '새 화면의 이용 대부분이 순증이면 잠식이 아니라 이익 풀 확대이고, 광고·고가 요금제로 단위 수익 격차는 좁혀질 수 있음', concepts: ['elasticity', 'competition-moat'] },

  { id: 'commitment-present-value', path: 'business', title: '약정은 부채처럼 읽기: 계약 의무의 현재가치', issue: '연산·구매 약정이 대차대조표의 부채가 아니어도 해지하기 어려우면 부채처럼 할인해 현재가치로 더해 보는 방법', sourceRefs: [R.anthropic, R.google],
    answer: '데이터센터·연산 계약처럼 몇 년에 걸쳐 반드시 내야 하는 돈은 장부의 부채가 아니어도 부채처럼 작동합니다. 연도별 지급액을 그 회사가 돈을 빌릴 때의 금리로 할인해 더하면 오늘 기준 부담이 나오고, 이를 현금·매출과 비교하면 투자 규모가 감당할 만한지 볼 수 있습니다. 계약에 물량 조정이나 해지 조건이 있으면 그만큼 부채성은 줄어듭니다.',
    steps: ['연도별 약정 지급액', '회사의 차입 금리(신용등급)', '연도별 할인과 합계', '현금·영업현금흐름과 비교', '해지·물량 조정 조건'],
    mechanism: [
      '현재가치는 지급액 ÷ (1 + 금리)^연차의 합입니다. 신용등급이 낮을수록 금리가 높아 같은 약정의 현재가치는 작아지지만, 그것은 부담이 작다는 뜻이 아니라 그 회사의 돈이 비싸다는 뜻입니다. 약정 총액(명목)과 현재가치를 함께 봐야 규모를 과장하거나 과소평가하지 않습니다.',
      '약정의 상대방도 봅니다. 한 회사의 약정은 상대 회사(클라우드·칩·전력 사업자)의 수주잔고이고, 그 수주잔고의 질은 약정한 회사의 신용에 달려 있습니다. 그래서 약정을 많이 한 회사의 자금 조달이 막히면 공급망 전체의 수주가 흔들릴 수 있습니다.',
      '빅테크의 미래 구매 약정과 미개시 리스는 계약상 최대치이고 일부는 물량을 조정할 수 있습니다. 공시의 주석에서 조정 가능 여부를 확인하고, 조정할 수 없는 몫만 부채처럼 셉니다.'
    ],
    example: { inputs: ['가상 약정: 1년차 100, 2년차 100', '차입 금리 6%'], steps: ['1년차 100 ÷ 1.06 ≈ 94.3', '2년차 100 ÷ 1.06² ≈ 89.0'], result: '명목 200의 약정은 오늘 기준 약 183의 부채와 비슷합니다. 금리가 높을수록 이 값은 작아지지만 그 회사의 자금 비용은 그만큼 비쌉니다.' },
    reverse: '약정은 공급 확보의 수단이기도 해서, 매출이 약정보다 빨리 늘면 부채가 아니라 싼 원가 확보가 됩니다. 물량 조정·해지 조건이 넓거나 상대방이 재판매할 수 있는 시장이 있으면 부채성은 작고, 현금이 충분하면 금리보다 집행 위험이 더 중요합니다.',
    channels: ['현금', '투자'], variables: ['연도별 약정 지급액', '차입 금리·신용등급', '약정 현재가치', '보유 현금', '영업현금흐름', '해지·물량 조정 조건'],
    indicators: [{ label: '재무 공시의 약정·리스 주석', route: 'fundamental', routeLabel: '재무 공시' }, { label: 'AI 인프라 신용 흐름', route: 'fxbond', routeLabel: '금리 · 환율' }],
    shift: '약정 총액을 헤드라인 숫자로 읽던 모델에서, 차입 금리로 할인한 현재가치를 부채처럼 더하고 해지 조건과 상대방 수주잔고까지 함께 읽는 모델로 전환', inputs: ['commitment schedule', 'borrowing rate', 'present value', 'cash balance', 'operating cash flow', 'cancellation terms'],
    chart: '연도별 약정 지급액 막대와 할인 뒤 현재가치 막대를 나란히, 영업현금흐름 선을 겹쳐 보기', counterclaim: '매출이 약정보다 빨리 늘면 약정은 부채가 아니라 공급 확보이고, 해지·물량 조정 조건이 넓으면 부채처럼 셀 몫은 작음', concepts: ['present-value', 'fcf-vs-funding'] },

  { id: 'post-report-path', path: 'chart', title: '실적 급락 뒤 사흘: 첫날 반응과 그다음 경로', issue: '실적 발표 뒤 크게 빠진 종목에서 첫날 숫자보다 그 뒤 며칠의 경로와 거래량으로 매도가 끝나 가는지를 읽는 방법', sourceRefs: [R.threeDay, R.flow, R.hold],
    answer: '실적 뒤 크게 빠진 첫날은 반응의 시작일 수 있습니다. 많은 주식을 가진 기관은 하루에 다 팔 수 없어 둘째·셋째 날에도 매도가 이어지고 새 저점이 나오기도 합니다. 그래서 첫날 수익률만 보지 말고, 사흘 정도 지나 저점이 지켜지는지, 매도 거래량이 줄어드는지, 하락 이유가 실적 일시 요인인지 사업의 변화인지를 함께 봅니다.',
    steps: ['첫날 갭과 거래량', '둘째·셋째 날 새 저점 여부', '매도 거래량의 감소', '하락 이유의 성격(일시·구조)', '저점 위 횡보와 기반 형성'],
    mechanism: [
      '큰 보유자가 비중을 줄이려면 여러 날이 필요해, 첫날 낙폭 뒤에도 매물이 남습니다. 첫날 반등은 공매도 청산이나 저가 매수일 수 있고 지속적인 기관 수요인지는 며칠 뒤 거래량으로 드러납니다.',
      '하락 이유가 결과를 가릅니다. 일회성 비용이나 회계 평가손처럼 영업과 무관한 이유면 경로가 짧고, 가이던스 하향이나 성장 둔화처럼 앞으로의 이익이 바뀐 이유면 할인이 아니라 재평가라 기반을 다지는 데 몇 주에서 몇 달이 걸립니다.',
      '실적이 예상을 넘었는데 빠지는 경우는 시장이 다른 것을 걱정한다는 신호입니다. 성장률 둔화, 설비투자 증가, 현금흐름 악화처럼 시장이 무엇을 우려하는지 반응 이유에서 확인합니다.'
    ],
    reverse: '사흘이 바닥을 보장하지 않습니다. 사업이 망가진 종목은 몇 주 뒤에도 새 저점을 만들고, 반대로 일회성 요인이 분명한 종목은 첫날 바로 되돌리기도 합니다. 이 틀은 매수·매도 시점이 아니라 매도가 끝나 가는지 읽는 관찰 순서입니다.',
    channels: ['현금'], variables: ['첫날 갭(%)', '발표 후 거래일별 종가', '거래량 추이', '발표 후 최저가 유지', '하락 이유(일시·구조)', '추정치 수정'],
    indicators: [{ label: '주요 발표 요약의 발표 후 경로와 반응 이유', route: 'market-news', routeLabel: '뉴스' }, { label: '종목 차트의 거래량', route: 'ticker', routeLabel: '종목 요약' }],
    shift: '실적 뒤 하락을 첫날 수익률로 판정하던 모델에서, 발표 후 며칠의 경로·거래량·하락 이유로 매도의 끝과 재평가를 구분하는 모델로 전환', inputs: ['first-day gap', 'post-report closes', 'volume trend', 'post-report low', 'cause of the drop', 'estimate revisions'],
    chart: '발표일을 0으로 둔 거래일별 누적 수익률 선과 거래량 막대, 발표 후 최저가 수평선', counterclaim: '일회성 요인이 분명하면 첫날 바로 되돌리고, 사업이 바뀐 종목은 사흘 뒤에도 새 저점을 만들어 사흘이라는 기간 자체에 근거가 없음', concepts: ['base-rate', 'expected-value'] }
].map(Object.freeze));

export const PACKET_20261030_LESSONS = Object.freeze(PACKET_20261030_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((id) => { const s = PACKET_20261030_SOURCES.find((row) => row.id === id); return { label: `${s.author} — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261030_CLAIMS = Object.freeze(PACKET_20261030_FRAMES.map((f) => Object.freeze({
  id: `claim-20261030-${f.id}`, packetId: 'packet-2026-10-30-x-bookmarks', observedOn: '2026-10-30', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '분기 실적·가이던스, 발표 후 거래일별 종가와 거래량, 연도별 약정 공시를 구분; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 북마크의 매출·약정 금액·점유율·주가 반응은 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['매출·가이던스 수치', '약정 금액', '메모리 점유율', '발표 후 주가 반응']), status: 'FRAMEWORK_EXTRACTED'
})));
