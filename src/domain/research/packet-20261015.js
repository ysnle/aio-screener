// v57.74: the 2026-10-15 owner note on the Korean crash day (seven drivers) and the owner's policy-floor hypothesis.
// Each dated driver keeps a verification state; three reasoning frames become lessons and claims. Nothing here is a
// live value, a ranking input or a call — same reference-only shape as packet-20261014.js.
const check = (claim, state, basis) => Object.freeze({ claim, state, basis });
// checks: { claim, state: VERIFIED | CONSISTENT | UNVERIFIED, basis } — compared on 2026-10-15 against public reports
// and the BLS series AIO already stores. A misattributed or unpublished figure stays UNVERIFIED with the reason.
export const PACKET_20261015_SOURCES = Object.freeze([
  Object.freeze({
    id: 'owner-chat-20261015-crash-drivers', author: 'owner chat', sourceUrl: '', publishedAt: '2026-10-15T03:30:00Z', publishedAtKst: '2026-10-15T12:30:00+09:00',
    sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED',
    summary: '코스피 급락일(10/15) 원인 정리 일곱 가지: CoreWeave발 AI 투자 회의론, AI 인프라 투자 대비 매출 부족 추정, 브로드컴 CEO의 도박 비유, 미국 9월 CPI, 중국 CXMT의 차세대 D램 설계 발표, 외국인 연속 순매도, 레버리지 ETF 반대매매. 회수·조달·주문 경로와 기술 발표 단계 노트로 반영.',
    checks: Object.freeze([
      check('CoreWeave 급락이 AI 투자 회의론을 키움', 'CONSISTENT', '10/13~15 국내외 보도: CoreWeave 하루 약 −15%, 회사채 수익률 15% 상회로 부채 부담 우려. 거래소 원자료와는 대조하지 않음'),
      check('Gartner: 2026~2030 AI 인프라 투자 약 7조 달러, 필요한 매출에 크게 못 미침', 'UNVERIFIED', '7조 달러는 McKinsey의 2030년까지 필요 투자 추정으로 인용됨. Gartner 2026-03 요약은 하이퍼스케일러 AI 인프라 지출 2030년까지 6.3조 달러, 투하자본이익률 25%에 필요한 누적 매출 약 8.2조 달러로 제시(원문 유료, 요약만 확인) — 방향은 같으나 숫자와 출처가 다름'),
      check('브로드컴 CEO가 AI 투자 일부를 도박에 비유', 'CONSISTENT', '10/12 싱가포르 DBS 행사 패널 발언을 Reuters 등이 인용(카지노 도박 비유, 자본이 가장 큰 제약). 공식 녹취록은 공개되지 않음'),
      check('미국 9월 CPI가 뜨거웠음', 'VERIFIED', 'AIO 거시 기록(BLS 지수): 9월 헤드라인 전월비 +0.65%, 전년비 3.7% · 근원 전월비 +0.33%, 전년비 2.6%. 사전 보도된 근원 예상은 약 2.4%'),
      check('CXMT가 차세대 D램 설계 돌파를 주장', 'VERIFIED', '10/10 상하이 행사 발표(TechNode·TrendForce 10/12): 4F² 셀 구조, 연말 서버 DDR5 RDIMM 계획. 계획 단계이며 양산·수율은 미공개'),
      check('외국인 8거래일 연속 순매도', 'CONSISTENT', '서울경제 10/15: 10/2~15 8거래일 연속 순매도, 누적 약 15.7조 원. 매체마다 연속 일수 집계가 다름'),
      check('외국인 올해 누적 200조 원 이상 순매도', 'UNVERIFIED', '확인된 최근 집계는 5~9월 5개월 누적 약 134.9조 원(서울경제 10/1)과 10월 약 15조 원. 연간 200조 원 집계는 찾지 못함'),
      check('레버리지 ETF 반대매매가 하락을 키움', 'UNVERIFIED', '7월 급락 때 반대매매 규모는 금융감독원 집계 인용 보도가 있으나, 10월 반대매매 금액은 아직 공개 집계가 없음')
    ])
  }),
  Object.freeze({
    id: 'owner-chat-20261015-policy-floor', author: 'owner chat', sourceUrl: '', publishedAt: '2026-10-15T03:30:00Z', publishedAtKst: '2026-10-15T12:30:00+09:00',
    sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED',
    summary: '소유자 가설(미국 중심): AI 거품이 꺼지면 미국 경기 침체에 연준·정부가 돈을 더 풀어야 하고, 장기 금리 상승과 재정 불확실성이 커지므로 당국은 하락이 계속되는 것을 용인하지 않을 것. 정책 바닥과 그 한계 노트로 반영(물가가 연준의 대응 크기를 제한하고, 재정 확대가 장기 금리를 올려 주가 회복을 늦출 수 있다는 반론과 함께).',
    checks: Object.freeze([])
  })
]);

const DRIVERS = 'owner-chat-20261015-crash-drivers', FLOOR = 'owner-chat-20261015-policy-floor';

export const PACKET_20261015_FRAMES = Object.freeze([
  { id: 'ai-capex-payback', path: 'business', title: 'AI 투자 회수 의문이 메모리로 번지는 경로', issue: '설비투자 대비 매출, 자금 조달, 주문으로 이어지는 시차', sourceRefs: [DRIVERS],
    answer: 'AI 설비투자가 커도 그 돈을 회수할 매출이 늦게 오면, 시장은 투자를 이어 갈 자금 조달부터 의심합니다. 빚으로 데이터센터를 짓는 AI 클라우드 기업의 회사채 금리가 오르면 투자가 미뤄지고, 그 아래 서버 메모리·HBM 주문의 증가세가 느려질 수 있습니다. 의심과 실제 주문 감소는 다른 단계입니다.',
    steps: ['설비투자 대비 AI 매출 격차', 'AI 클라우드 기업의 조달 비용', '데이터센터 착공·가동 일정', '서버 메모리·HBM 주문과 가격', '메모리 기업 이익 전망'],
    mechanism: [
      '회수는 누적으로 봅니다. 2026년 3월 Gartner 요약은 하이퍼스케일러의 AI 인프라 지출이 2030년까지 6.3조 달러에 이르고, 투하자본이익률 25%를 내려면 누적 매출이 약 8.2조 달러 필요하다고 봤습니다(원문 유료, 요약 기준). 숫자보다 매출이 투자 속도를 따라오는지가 핵심입니다.',
      '돈을 빌려 GPU를 사고 빌려주는 AI 클라우드 기업은 금리와 신용에 가장 먼저 반응합니다. 2026년 10월 CoreWeave 회사채 수익률이 15%를 넘었다는 보도와 함께 주가가 하루 15%가량 빠졌습니다. 조달이 막히면 착공이 밀리고, 주문은 몇 분기 뒤에 줄어듭니다.',
      '메모리 주가는 주문이 실제로 줄기 전에 의심만으로도 먼저 빠집니다. 한국 지수에서 두 메모리 기업 비중이 절반을 넘으면, 이 의심은 업종이 아니라 지수 전체의 문제가 됩니다. 그래서 하락의 원인이 의심인지 실제 주문 변화인지 나눠 봐야 합니다.'
    ],
    example: { inputs: ['가상 데이터센터 투자 100', '연 매출 15, 현금 마진 40%', '장비 수명 5년'], steps: ['연 현금 창출 = 15 × 0.40 = 6', '5년 누적 = 6 × 5 = 30'], result: '장비 수명 안에 투자 100 중 30만 돌아옵니다. 매출이 빠르게 늘지 않으면 장비를 바꿀 때 다시 빚을 내야 해서, 조달 비용이 투자 속도를 정하게 됩니다.' },
    reverse: '빅테크가 설비투자 지침을 유지하거나 올리고, AI 기업 매출이 투자보다 빨리 늘며, 회사채 금리가 안정되면 의심은 가격 조정으로 끝날 수 있습니다. 지침 하향·데이터센터 취소·메모리 가격 하락이 함께 나오면 판단을 이익 전망 하향 쪽으로 옮깁니다.',
    channels: ['투자', '매출', '현금'], variables: ['빅테크 설비투자 지침', 'AI 기업 매출 증가율', 'AI 클라우드 회사채 금리', '데이터센터 착공·취소', '서버 D램·HBM 가격과 주문'],
    indicators: [{ label: 'AI 설비투자 사슬 테마의 단계와 거시 영향', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '신용 스프레드와 금리', route: 'macro', routeLabel: '거시 경제' }, { label: '종목별 Forward PER와 예상 이익 증가율', route: 'screener', routeLabel: '스크리너' }],
    shift: '설비투자 증가를 곧장 공급자 이익으로 옮기던 모델에서 회수(매출)·조달(신용)·주문(시차)을 나눠 보는 모델로 전환', inputs: ['hyperscaler capex guidance', 'AI revenue run-rate', 'AI cloud bond yields', 'data center starts and cancellations', 'server DRAM and HBM contract prices'],
    chart: '설비투자와 AI 매출을 같은 분기 축에 나란히, 회사채 금리는 별도 축', counterclaim: '인프라 투자는 원래 매출보다 앞서며, 회수 기간이 길다는 것만으로 투자가 과하다고 단정할 수 없음', concepts: ['capex', 'roic', 'credit-cost'] },
  { id: 'tech-claim-stages', path: 'industry', title: '경쟁사 기술 발표를 읽는 단계', issue: '발표·샘플·양산·수율·고객 인증·점유율과 제품 시장의 구분', sourceRefs: [DRIVERS],
    answer: '경쟁사가 새 기술을 발표했다는 것과 그 제품이 팔린다는 것 사이에는 여러 단계가 있습니다. 설계 발표 → 샘플 → 양산 → 수율 → 고객 인증 → 점유율 순서로 확인하고, 범용 D램·서버 D램·HBM 가운데 어느 시장의 이야기인지 나눠 봅니다.',
    steps: ['설계·계획 발표', '샘플 출하', '양산 시작', '수율과 원가', '고객 인증', '점유율·가격 변화'],
    mechanism: [
      '2026년 10월 CXMT는 셀 면적을 줄인 4F² 구조로 연말에 서버 DDR5 모듈을 내놓겠다는 계획을 밝혔습니다. 계획 발표 단계이고 양산과 수율은 공개되지 않았는데도 메모리 주가는 크게 빠졌습니다. 시장은 먼 미래의 가격 경쟁을 지금 가격에 미리 반영하려 합니다.',
      '제품 시장마다 위협의 크기가 다릅니다. 범용·서버 D램은 공급이 늘면 가격이 먼저 반응하지만, HBM은 적층·패키징과 고객 인증이 길어 진입이 느립니다. 같은 발표라도 기업의 제품별 매출 구성에 따라 영향이 달라집니다.',
      '확인할 것은 단계가 실제로 넘어가는지입니다. 샘플 출하, 고객 인증 통과, 계약가격 하락이 이어지면 위협이 현실이 되고, 장비 수출 규제나 수율 문제로 일정이 밀리면 발표 당일의 반응이 과했던 것이 됩니다.'
    ],
    reverse: '양산과 고객 인증이 예정대로 확인되고 범용 D램 계약가격이 내려가기 시작하면 가격 경쟁 우려는 이익 전망 문제로 옮겨 갑니다. 일정이 밀리거나 수율이 낮으면 발표만으로 생긴 하락은 되돌려질 여지가 있습니다.',
    channels: ['단가', '매출'], variables: ['양산 일정과 수율', '고객 인증', 'D램 계약가격', '제품별 매출 비중(범용·서버·HBM)', '장비 수출 규제'],
    indicators: [{ label: '메모리 공급망의 층별 역할', route: 'atlas', routeLabel: '지식 지도' }, { label: '반도체·메모리 테마의 상대강도', route: 'themes', routeLabel: '테마 · 섹터' }],
    shift: '경쟁사 발표를 곧바로 점유율 손실로 읽던 모델에서 단계별 확인과 제품 시장 구분으로 읽는 모델로 전환', inputs: ['announcements', 'sample shipments', 'mass production start', 'yield', 'customer qualification', 'contract prices'],
    chart: '단계별 확인 표 — 단계, 확인 여부, 날짜', counterclaim: '기술 격차가 줄어드는 방향 자체는 장기 가격 압력이 될 수 있어, 일정이 밀렸다고 위협이 사라졌다고 볼 수 없음', concepts: ['qualification', 'hbm', 'price-volume-mix'] },
  { id: 'policy-floor-limits', path: 'money', title: '정책 바닥과 그 한계', issue: '미국 급락에 대한 연준·재정 대응이 막는 것과 막지 못하는 것', sourceRefs: [FLOOR, DRIVERS],
    answer: '미국 증시 급락이 금융 불안으로 번지면 연준과 정부는 대응에 나서는 경향이 있습니다. 다만 대응이 막는 것은 신용 경색과 강제 청산 같은 연쇄이고, 기업 이익 전망까지 바꾸지는 못합니다. 물가가 높을 때는 연준의 여력이 줄어 바닥이 더 낮은 곳에 생깁니다.',
    steps: ['AI 투자 꺾임 → 이익·고용 둔화', '연준 금리 인하 · 정부 재정 지출', '국채 발행 증가 → 장기 금리 상승 가능', '연쇄 차단 = 바닥, 이익·장기 금리 = 가격 회복', '물가가 대응 크기를 제한'],
    mechanism: [
      'AI 설비투자는 최근 미국 경기를 떠받친 큰 축이어서, 투자가 꺾이면 이익과 고용이 함께 둔화할 수 있습니다. 그러면 연준은 금리를 내리고 정부는 재정을 풀어 연쇄를 막으려 합니다. 2020년처럼 대응이 빠르고 클 때는 투매가 짧게 끝났습니다.',
      '연준의 여력은 물가에 달려 있습니다. 2022년에는 물가가 높아 S&P 500이 고점에서 25% 넘게 빠지는 동안에도 금리를 올렸습니다. 2026년 9월 소비자물가는 전년보다 3.7%, 근원은 2.6% 올랐고 연준은 9월에 금리를 올렸습니다. 이런 때의 바닥은 물가가 꺾인 뒤에 생기는 경우가 많습니다.',
      '정부가 빚을 내 돈을 풀면 국채 발행이 늘어, 연준이 정책금리를 내려도 10년물 같은 장기 금리는 오를 수 있습니다. 단기 금리는 내리고 장기 금리는 오르는 가파른 곡선입니다. 장기 금리가 오르면 미래 이익의 현재 가치가 줄어 성장주에 부담이라, 정책이 나와도 주가 회복은 더딜 수 있습니다.'
    ],
    example: { inputs: ['가상 주식의 내년 이익 100', '할인율 8% → 9%', '장기 성장률 3%'], steps: ['가치 = 100 ÷ (0.08 − 0.03) = 2,000', '할인율 9%면 100 ÷ (0.09 − 0.03) ≈ 1,667'], result: '이익이 그대로여도 장기 금리가 올라 할인율이 1%p 오르면 가치는 약 17% 낮아집니다. 연쇄를 막아 바닥을 만드는 대응과 가격을 올리는 대응은 다를 수 있습니다.' },
    reverse: '물가가 꺾여 연준이 인상을 멈추거나 인하로 돌아서고, 10년물 금리가 함께 내려가며 하이일드 스프레드 확대가 멈추면 정책 바닥이 가격 회복으로 이어지는 쪽입니다. 물가가 다시 오르는데 주가와 국채 가격이 함께 빠지면 바닥은 더 아래에 있다고 봅니다.',
    channels: ['금리', '현금', '투자'], variables: ['근원 물가 추세', 'FOMC 다음 결정', '10년물 금리와 장단기 금리차', '하이일드 스프레드', '재정 적자·국채 발행 계획', '변동성(VIX)'],
    indicators: [{ label: '금리·물가와 향후 시나리오', route: 'macro', routeLabel: '거시 경제' }, { label: '과열·냉각 구간과 투자 심리', route: 'sentiment', routeLabel: '투자 심리' }],
    shift: '"당국이 하락을 용인하지 않는다"를 하나의 바닥으로 보던 모델에서, 연쇄 차단(바닥)과 가격 회복(이익·장기 금리)을 나누고 물가가 연준의 대응 크기를 정한다고 보는 모델로 전환', inputs: ['core inflation trend', 'FOMC decision', '10-year yield and 2s10s', 'HY spread', 'deficit and Treasury issuance', 'VIX'],
    chart: 'S&P 500과 10년물 금리를 같은 기간 축에 — 함께 빠지는 구간과 엇갈리는 구간을 음영', counterclaim: '침체가 깊어져 물가가 함께 내려가면 연준의 여력이 커지고 장기 금리도 경기 둔화 쪽으로 내려가, 2020년처럼 정책 대응이 바닥과 회복을 함께 만들 수 있음', concepts: ['policy-vs-long-rate', 'term-premium', 'credit-cost'] }
].map(Object.freeze));

export const PACKET_20261015_LESSONS = Object.freeze(PACKET_20261015_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((ref) => { const s = PACKET_20261015_SOURCES.find((row) => row.id === ref); return { label: `소유자 자료 — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261015_CLAIMS = Object.freeze(PACKET_20261015_FRAMES.map((f) => Object.freeze({
  id: `claim-20261015-${f.id}`, packetId: 'packet-2026-10-15', observedOn: '2026-10-15', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '발표·분기 실적·정책 결정 일정과 가격 세션을 구분; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 급락일의 지수·수급·발언·추정치는 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['지수·종목 등락', '외국인 순매도 금액', '회사채 수익률', '발표 일정', '추정 투자 규모']), status: 'FRAMEWORK_EXTRACTED'
})));
