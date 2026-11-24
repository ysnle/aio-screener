// The owner's X bookmarks read after the 11/04 packet (2026-11-07 and 11-08): posts not yet in any packet, read through
// the owner's browser — article bodies, every image the ledger lists as opened, shown replies and the quote tab where it
// loaded. Same reference-only shape as packet-20261104-x-bookmarks.js: nothing here is a live value, a ranking input or a
// call. Ledger and per-item dispositions: _artifacts/x-bookmarks-20261105/CLAUDE-RESPONSE-20261108.md. Posting times are
// decoded from the status IDs; the save date is not shown by X and is not claimed.
const check = (claim, state, basis) => Object.freeze({ claim, state, basis });
// Grades on the ledger's scale: A checked or reusable, B cited or confirming, C none.
const SOURCE_TIMELINE = Object.freeze({
  '2118740837479645300': Object.freeze({ postedAtUtc: '2026-11-06T16:22:34Z', refersTo: 'Marvell business model, FY2026 results, the Lumentum combination and a weekly volume profile', lag: 'four days after the 11/02 Lumentum announcement', laterOutcome: 'Checked against SEC filings: FY2026 revenue $8.19B (+42%) matches; the article FCF $1.723B does not match the 10-K OCF − capex $1.396B (AIO MRVL story already carries $1.396B). The Lumentum deal is pending until 1H 2028.' }),
  '2118976633923330445': Object.freeze({ postedAtUtc: '2026-11-07T07:59:32Z', refersTo: 'US data-center pipeline (86 GW under construction, Texas 26%), hyperscaler capex and backlog vs a fear reading in puts and CDS', lag: 'the 11/06 close', laterOutcome: 'Cannot be judged yet. Goldman/Aterio/Wells Fargo source reports were not read; the 86 GW and the delay-not-cancellation caption stay the chart author’s.' }),
  '2118905628336984096': Object.freeze({ postedAtUtc: '2026-11-07T03:17:23Z', refersTo: 'the 20-week moving average as a regime line on Samsung Electronics and SK hynix weekly charts', lag: 'not event-bound', laterOutcome: 'n/a (a method; the author’s own follow-up says the line is context, not a signal).' }),
  '2118550351158854003': Object.freeze({ postedAtUtc: '2026-11-06T03:45:39Z', refersTo: '2026 leaders (DELL, MRVL, AMD, ARM, MU, SNDK) and past leaders 2003–2025 lined up on follow-through days', lag: 'after the 11/05 session', laterOutcome: 'n/a (a case study). Three of the case charts print a report dated after the follow-through day they illustrate (NFLX 2003, NVDA 2016, ZM 2020).' }),
  '2112334545840435251': Object.freeze({ postedAtUtc: '2026-10-20T00:06:15Z', refersTo: 'AI-infrastructure funding part 1: CoreWeave price and bond moves, the purchase-lease-guarantee web around one model company', lag: 'the 10/19 close', laterOutcome: 'Primary filings checked by the ledger: NVIDIA’s Ohio residual value guarantee caps at $105B with trigger, recovery and termination terms; Nebius’s Meta backstop is up to $15B of a $27B order. Caps, not losses.' }),
  '2114009470405853493': Object.freeze({ postedAtUtc: '2026-10-24T15:01:48Z', refersTo: 'AI-infrastructure funding part 2: investment commitments financed by a holding company’s borrowing against listed stakes', lag: 'not event-bound', laterOutcome: 'n/a (a hypothesis; the cover image is a mood picture, not evidence).' }),
  '2118682346937577566': Object.freeze({ postedAtUtc: '2026-11-06T12:30:09Z', refersTo: 'SoftBank and Arm declines, 12-month debt growth, LTV and CDS as the follow-up to part 2', lag: 'the 11/06 Tokyo session', laterOutcome: 'SoftBank IR: LTV 13.0% is the 2026-06-30 figure, and 25% (35% in stress) is the company’s own policy target, not a lender trigger. Turbine-order and loan-sale items are reports quoted in screenshots.' }),
  '2115947976237650236': Object.freeze({ postedAtUtc: '2026-10-29T23:24:44Z', refersTo: 'PCE, rates, oil and gold with AMZN and SNDK after-hours prints of 10/29', lag: 'same evening', laterOutcome: 'The attached prints are timed snapshots (16:00 and 18:58 EDT), not final after-hours closes; SNDK prices are before the 8-for-1 split that trades from 11/20.' })
});

const SOURCE_QUALITY = Object.freeze({
  '2118740837479645300': Object.freeze({ data: 'C', coverage: 'A', logic: 'B', insight: 'B' }),
  '2118976633923330445': Object.freeze({ data: 'B', coverage: 'B', logic: 'B', insight: 'A' }),
  '2118905628336984096': Object.freeze({ data: 'C', coverage: 'C', logic: 'B', insight: 'C' }),
  '2118550351158854003': Object.freeze({ data: 'B', coverage: 'A', logic: 'B', insight: 'A' }),
  '2112334545840435251': Object.freeze({ data: 'A', coverage: 'A', logic: 'B', insight: 'A' }),
  '2114009470405853493': Object.freeze({ data: 'B', coverage: 'B', logic: 'B', insight: 'B' }),
  '2118682346937577566': Object.freeze({ data: 'C', coverage: 'B', logic: 'B', insight: 'B' }),
  '2115947976237650236': Object.freeze({ data: 'B', coverage: 'B', logic: 'C', insight: 'C' })
});

const source = (handle, statusId, date, summary, checks = []) => Object.freeze({
  id: `${handle}-${statusId}`, author: handle, sourceUrl: `https://x.com/${handle}/status/${statusId}`, publishedAt: date, publishedAtKst: date,
  sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED', summary, checks: Object.freeze(checks),
  timeline: SOURCE_TIMELINE[statusId], quality: SOURCE_QUALITY[statusId]
});

export const PACKET_20261108_AUDIT = Object.freeze({
  readOn: '2026-11-08', newSinceLedger: 9, inScope: 8, agentPractice: 1, unrelated: 0, framesAdded: 4,
  // Rows counted above that an earlier ledger already read but never cited as a source.
  alsoInEarlierLedger: Object.freeze(['blazingbees-2115947976237650236 (10/30 ledger: read with its images, not cited then)']),
  repoState: Object.freeze({ reflected: 2, partial: 5, missing: 2, conflict: 0, notApplicable: 0 }),
  alreadyCovered: Object.freeze([
    'Marvell의 FY2026 잉여현금흐름은 공시 기준 13.96억 달러로 이미 기업 이야기에 있음 → MRVL 기업 이해(이번에 Lumentum 합병 예정·Google 워런트 조건 추가)',
    '주간 이동평균으로 추세 국면을 나누는 방법 → 기술적 분석의 30주선 단계(price-cycle-stages)와 주봉·일봉 방향',
    '확정·조건부·순환 약정의 구분 → commitment-present-value, backlog-funding-quality',
    'AI 인프라 신용이 번지는 단계 → ai-infra-credit-ladder',
    '호출자가 알아야 할 순서를 줄이는 모듈 경계(에이전트 작업 방식) → /deepen 스킬'
  ]),
  declined: Object.freeze(['애널리스트 단일 적정가와 "1~2년 내 전고점 회복 70%"(분모·표본 미공개)', '저자가 그린 기관 매수 구간·스마트 머니 구간(가격별 거래량으로 매수 주체를 알 수 없음)', 'H100 임대료 지수(제공사 방법론·재사용 권리 미확인)', '풋 거래량 "역대 최대"·데이터센터 CDS(상품 범위·이력 미대조)', 'SoftBank 실시간 LTV 역산(비상장 지분·부채를 고정한 교육용 가정일 뿐)', '터빈 주문 불이행·대출 매도 보도 캡처(원문·계약 미확인)']),
  conflictsFixed: Object.freeze(['FTD 레슨의 "큰 자금이 다시 사기 시작했다는 흔적"을 관측 서술로 고침(가격·총거래량으로 매수 주체를 알 수 없음)', '신용 패킷의 3~5년 근사치 85bp를 FRED로 재계산하고 OAS와 다른 지표임을 확인 항목으로 추가', '시장 상태·매크로의 "위기 신호가 오면 여기서 시작됩니다"(표본 검증 없는 선행 단정)를 관찰점 서술로 고침']),
  structural: Object.freeze([])
});

export const PACKET_20261108_SOURCES = Object.freeze([
  source('pdicarlotrader', '2118740837479645300', '2026-11-07', 'Marvell을 팹리스 사업 모델 → 광연결·맞춤형 칩과 AI 투자 → 해자 판단 → 고객·인수·희석 위험 → GAAP·조정이익·현금 → 장기 추정·가치평가 → 기술적 가격대 순서로 정리. 성장과 인수 위험을 함께 놓은 구성은 따라가기 쉽지만, 글은 유료 교육 상품으로 연결된다.', [check('FY2026 매출 82억 달러, +42%', 'VERIFIED', '10-K 매출 81.946억 달러, 전년 57.673억 달러 대비 +42.1%'), check('FY2026 FCF 17.23억 달러', 'UNVERIFIED', '같은 10-K의 영업현금흐름 17.505억 − 유형자산 매입 3.541억 = 13.964억 달러로 재현되지 않음. 저자의 FCF 정의·원천 미공개'), check('Lumentum 합병으로 지분 약 33%', 'CONSISTENT', '회사 발표의 완전희석 기준 예상치. 양사 주주·규제 승인 뒤 2028년 상반기 완료 예정이라 확정 희석이 아님')]),
  source('dons_korea', '2118976633923330445', '2026-11-07', '풋 거래량·데이터센터 CDS·기술주 하락을 공포의 배경으로 두고, 하이퍼스케일러 설비투자 전망·백로그·GPU 임대료를 수요 근거로, 착공 86GW와 텍사스 모라토리엄 가능성을 일정 근거로 묶어 "수요 소멸보다 일정 지연"이라고 읽는 글. 첨부 4패널은 운영·건설 완료·건설 중·발표 용량을 연도와 주별로 나눈 재구성 차트.', [check('86GW × GW당 35억 달러 ≈ 3,010억 달러', 'CONSISTENT', '곱셈은 맞음. 균일 단가·총 프로젝트 비용·연간 건설지출의 정의가 같은지는 별도'), check('지연이지 취소가 아니다', 'UNVERIFIED', '차트 작성자의 전망. 프로젝트별 승인·상업운전 자료 없음'), check('2025년 데이터센터 건설 500억 달러', 'UNVERIFIED', 'Census 건설지출은 현장에 시행된 건설 가치라 회사 설비투자·서버와 다름. 원보고서 미열람')]),
  source('colu_farmer', '2118905628336984096', '2026-11-07', '20주 이동평균을 매매 타점이 아니라 시장 국면을 나누고 추격 매수를 피하는 기준으로 쓰는 글. 삼성전자·SK하이닉스 주봉을 사례로 들고, 작성자 보충 글에서 이동평균만 보지 않는다고 덧붙임.', [check('20주선 아래는 약한 국면', 'UNVERIFIED', '사례 차트 두 장. 횡보 구간의 잦은 교차·거짓 신호와 성과 표본은 제시되지 않음')]),
  source('damipov', '2118550351158854003', '2026-11-06', '지수가 바닥을 다질 때 먼저 나오는 주도주. 2026년 DELL·MRVL·AMD·ARM·MU·SNDK와 2003~2025년 과거 주도주를 바닥 확인일(FTD) 기준으로 맞춰 놓고, 조정 → 상대강도 → 베이스 → FTD → 돌파의 순서로 읽음. 이미지 23장.', [check('2026년 4월 FTD 날짜', 'VERIFIED', 'AIO 나스닥 종합 이력으로 재현: 3/30 종가 저점이 1일째, 4/8 +2.80%는 거래량이 전일보다 적어 제외, 4/14 11일째 +1.96%가 바닥 확인일'), check('2022년 실패와 2026년 반등의 FTD 상승률·거래량', 'CONSISTENT', '주석은 나스닥 종합 기준인데 가격 도형은 QQQ ETF. 계산 원천과 그림 원천이 다름'), check('과거 사례 차트의 실적 표', 'UNVERIFIED', 'NFLX 2003(FTD 03-17, 실적 04-17), NVDA 2016(03-01, 05-12), ZM 2020(04-06, 06-02)은 사건일 뒤에 나온 실적을 함께 표시. 사후 복기로는 문제없지만 당시 정보로 쓰면 미래 정보가 섞임'), check('요약 패널의 2009년 사례', 'UNVERIFIED', '본문·개별 차트는 BIDU, 요약 패널은 BKNG로 표기. 라벨 오류인지 다른 사례인지 미확인')]),
  source('damipov', '2112334545840435251', '2026-10-20', 'AI 인프라 자금조달 1부. CoreWeave 주가·채권 급변에서 시작해 한 모델 기업의 지급 능력이 구매계약·리스·보증·담보를 통해 클라우드 사업자·대주·보증인에게 번질 수 있다는 가설. 반증 후보로 GPU 임대료·차환·신규 주문·신용등급을 함께 제시.', [check('NVIDIA 잔존가치 보증', 'VERIFIED', 'NVIDIA 8-K(2026-08-17): Ohio 초기 약 4.25GW에 누적 최대 1,050억 달러 한도. 임대 개시·지급불이행 발동 조건과 회수액 차감·종료 조건이 있어 한도는 손실액이 아님'), check('Meta의 Nebius 구매 보장', 'VERIFIED', 'Nebius 6-K(2026-03-16): 5년 주문 최대 약 270억 달러 중 미판매 용량 구매 의무 최대 150억 달러'), check('CoreWeave 원금 만기 약 356억 달러', 'CONSISTENT', '2026-06-30 기준 10-Q 구간별 원금. 이후 차환·발행으로 바뀌므로 현재 만기로 쓰지 않음')]),
  source('damipov', '2114009470405853493', '2026-10-24', 'AI 인프라 자금조달 2부. 투자 약정 → 투자 지주사의 차입 → 보유 지분·담보가치 하락 → 조달 여건 악화라는 전달 경로 가설. 대화에서 경쟁사 점유율 상승과 공급망 전염 가능성을 위험 가설로 제기.', [check('지주사 차입과 담보가치의 연결', 'CONSISTENT', 'SoftBank NAV 방법론은 Arm 보유 가치에서 Arm 주식 담보 마진론 잔액을 차감한다고 설명. 개별 계약의 마진콜 가격은 공시되지 않음')]),
  source('damipov', '2118682346937577566', '2026-11-06', '2부 가설을 SoftBank 사례에 다시 연결한 후속 글. 주가·부채 증가·LTV·CDS를 함께 거론하고, 악재에도 가격이 더 약해지지 않으면 나쁜 소식이 상당 부분 반영됐을 가능성을 열어 둠. 첨부는 제3자 게시물과 보도 캡처.', [check('LTV 13%', 'CONSISTENT', 'SoftBank IR 공식 페이지의 2026-06-30 기준치. 11월 현재 담보비율이 아님'), check('LTV 25%가 위험선', 'UNVERIFIED', '25%(비상시 35%)는 회사 재무정책의 관리 목표이고 차입 계약의 강제상환 기준이 아님'), check('12개월 부채 증가 404억 달러와 OpenAI 투자 640억 달러', 'UNVERIFIED', '기간·총액/순액·조달 출처가 달라 포함 관계를 계산할 수 없음')]),
  source('blazingbees', '2115947976237650236', '2026-10-29', 'PCE·금리·유가·금과 기업 주가를 짧게 나열해 고물가와 안전 선호, 빅테크 설비투자·현금흐름, 반도체 성장 둔화 우려를 하나의 이야기로 묶은 글. 첨부는 AMZN·SNDK의 정규장·시간외 가격 화면.', [check('AMZN 시간외 −7.17%, SNDK 시간외 −4.14%', 'CONSISTENT', '화면의 18:58 EDT 시점 스냅샷. 시간외 최종가나 다음 정규장 종가가 아니고, SNDK는 11/20 거래 시작 예정인 8대1 분할 전 가격'), check('PCE가 매도의 원인', 'UNVERIFIED', '동시 관찰과 원인 추정이 섞여 있음. PCE 세부 지표·발표 시각과 주가 시각이 명시되지 않음')])
]);

const ref = (handle, statusId) => `${handle}-${statusId}`;
const R = {
  mrvl: ref('pdicarlotrader', '2118740837479645300'), pipeline: ref('dons_korea', '2118976633923330445'), weekly: ref('colu_farmer', '2118905628336984096'),
  leaders: ref('damipov', '2118550351158854003'), funding1: ref('damipov', '2112334545840435251'), funding2: ref('damipov', '2114009470405853493'),
  softbank: ref('damipov', '2118682346937577566'), snapshot: ref('blazingbees', '2115947976237650236')
};

export const PACKET_20261108_FRAMES = Object.freeze([
  { id: 'delay-or-demand-loss', path: 'industry', title: '일정 지연인가 수요 감소인가: 어느 숫자가 바뀌었나', issue: 'AI 데이터센터 공포가 커질 때 수요가 줄어든 것인지 가동이 밀린 것인지를 바뀐 숫자의 종류로 가르기', sourceRefs: [R.pipeline],
    answer: '데이터센터를 부지·건물·전력·가동의 단계로 나누는 틀(데이터센터는 네 단계 노트)은 이미 있습니다. 공포가 커질 때 필요한 것은 그다음 질문, 무엇이 바뀌었는가입니다. 건설 중 용량은 그대로인데 가동 예정 연도만 뒤로 가면 일정 지연이고, 주문 취소·설비투자 계획 축소·수주잔고 감소가 함께 나오면 수요 쪽 변화입니다. 풋 거래량이나 CDS 상승, 주가 하락은 두 경우 모두에서 나올 수 있어 어느 쪽인지 가르지 못합니다.',
    steps: ['바뀐 숫자 찾기(용량·연도·주문·설비투자)', '가동 연도만 이동 → 지연 쪽', '주문 취소·투자 축소·잔고 감소 → 수요 쪽', '가격·신용 지표는 판정에서 빼기', '다음 분기 공시로 다시 확인'],
    mechanism: [
      '지연과 수요 감소는 같은 주가 하락으로 보여도 남기는 흔적이 다릅니다. 지연은 착공 물량과 고객 계약이 유지된 채 전력 연결·가동 시점이 밀리는 모습이고, 수요 감소는 하이퍼스케일러 설비투자 가이던스 하향, 주문 취소, 계약 잔고(RPO) 감소로 나타납니다. 둘 다 아니면 가격만 먼저 움직인 것입니다.',
      '숫자마다 원천과 정의가 달라 섞으면 판단이 틀어집니다. 미국 Census 건설지출은 매달 현장에 시행된 건설 가치라 서버·랙이 빠지고, 회사 설비투자는 장비까지 포함하며, 발표 GW는 아직 짓지 않은 계획까지 들어갑니다. 2029~2030년 가동 예정분 비중이 커질수록 아직 착공하지 않은 발표분에 기대는 몫이 커집니다.',
      '지연도 비용이 있습니다. 가동이 늦어지면 계약 매출의 시작이 늦어지고 건설·금융 비용은 먼저 나가, 지연이 길어지면 차입이 많은 운영사부터 부담이 커집니다. AIO에서는 테마·섹터의 AI 설비투자 흐름에서 회사별 투자 계획을, 종목 화면에서 계약 잔고와 현금흐름을 봅니다. 착공·가동 GW는 AIO가 받지 않는 숫자라 글의 86GW는 작성자의 주장으로 둡니다.'
    ],
    reverse: '지연이 길어지면 사실상 취소와 같아지고, 설비투자 가이던스가 유지돼도 다음 해 계획에서 줄어들 수 있습니다. 재구성 차트의 지역·용량 분류는 원데이터 없이 확정할 수 없고, 같은 보고서를 인용한 여러 게시물은 독립 근거 한 건입니다.',
    channels: ['물량', '심리'], variables: ['건설 중 용량', '가동 예정 연도', '설비투자 가이던스', '주문 취소', '계약 잔고(RPO)', '데이터센터 건설지출'],
    indicators: [{ label: '테마·섹터의 AI 설비투자 흐름', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '종목 화면의 계약 잔고·현금흐름', route: 'ticker', routeLabel: '종목' }],
    shift: '데이터센터 공포를 가격·신용 지표로 읽던 모델에서, 바뀐 숫자가 가동 연도인지 주문·투자 계획인지로 일정 지연과 수요 감소를 가르는 모델로 전환', inputs: ['under-construction capacity', 'expected operation year', 'capex guidance', 'order cancellations', 'remaining performance obligations', 'construction spending'],
    chart: '연도별 가동 예정 용량을 이번 분기와 직전 분기로 나란히 쌓아, 총량은 그대로인데 뒤 연도로 밀렸는지(지연) 총량이 줄었는지(수요) 한눈에 보이게 하기', counterclaim: '지연이 길어지면 취소와 같고, 가이던스가 유지돼도 다음 해 계획에서 줄 수 있으며, 재구성 차트는 원데이터 없이 분류를 확정할 수 없음', concepts: ['capex', 'rpo', 'utilization-contract'] },

  { id: 'exposure-cap-policy-line', path: 'money', title: '최대 한도, 정책 목표, 기준일: 금융 숫자 세 가지 구분', issue: '보증 한도·구매 보장 같은 최대 노출, 회사가 정한 재무 목표, 공시 기준일이 지난 비율을 실제 손실·계약 조건·현재 값과 구분하기', sourceRefs: [R.funding1, R.funding2, R.softbank],
    answer: 'AI 인프라 자금 이야기에 나오는 큰 숫자는 세 종류가 섞여 있습니다. 첫째, 보증 한도나 구매 보장은 조건이 맞을 때 낼 수 있는 최대액이지 이미 난 손실이 아닙니다(NVIDIA Ohio 보증 최대 1,050억 달러, Meta의 Nebius 구매 보장 최대 150억 달러). 둘째, 회사가 정한 재무 목표는 계약 조건이 아닙니다(SoftBank LTV 25% 미만, 비상시 35%는 회사의 관리 목표). 셋째, 공시 비율은 기준일의 값입니다(SoftBank LTV 13.0%는 2026년 6월 말). 세 가지를 나누면 "위험이 얼마나 큰가"가 "어떤 조건에서 얼마까지"로 바뀝니다.',
    steps: ['숫자의 종류(한도·목표·관측)', '발동 조건과 회수·종료 조건', '기준일과 그 뒤 바뀐 것', '같은 계약의 중복 인용 제거', '다음 공시에서 확인할 값'],
    mechanism: [
      '보증은 임대 개시 뒤 임차인의 지급불이행 같은 조건이 생겨야 발동하고, 자산을 다시 임대하거나 팔아 회수한 금액만큼 줄어듭니다. 한도를 손실로 읽으면 위험을 과장하고, 조건을 무시하면 반대로 위험의 경로를 놓칩니다.',
      '지주회사의 담보 비율은 보유 지분 가치와 순부채로 계산합니다. 상장 지분 가격은 매일 바뀌지만 비상장 지분 가치와 부채는 분기 공시 때만 바뀌어, 주가만 넣어 다시 계산한 비율은 실제 비율도 계약상 담보비율도 아닌 가정입니다. 개별 차입의 마진콜 가격은 공시되지 않는 경우가 많습니다.',
      'AIO에서는 매크로의 신용 스프레드와 테마·섹터의 AI 인프라 자금 흐름에서 시장 가격을 보고, 종목 화면의 기업 이해에서 회사가 공시한 약정·차입을 봅니다. 한도·목표·관측을 합산한 단일 위험액은 만들지 않습니다.'
    ],
    reverse: '조건부 한도라도 발동 조건이 동시에 여러 곳에서 맞으면 손실이 빠르게 커질 수 있고, 회사 목표선은 시장이 그 숫자를 경계로 삼으면 실제 압력이 됩니다. 공시 기준일 뒤의 변화는 다음 공시 전까지 확인할 수 없습니다.',
    channels: ['신용', '심리'], variables: ['보증·구매 보장 한도', '발동·회수·종료 조건', '회사 재무 목표', '공시 기준일', '보유 지분 가치', '순부채', '차입 만기'],
    indicators: [{ label: '매크로의 신용 스프레드', route: 'macro', routeLabel: '매크로' }, { label: '종목 화면의 기업 이해', route: 'ticker', routeLabel: '종목' }],
    shift: '보도에 나온 최대 금액과 비율을 위험의 크기로 바로 읽던 모델에서, 숫자의 종류(한도·목표·관측)와 발동 조건·기준일을 먼저 나누는 모델로 전환', inputs: ['guarantee cap', 'backstop cap', 'trigger and recovery terms', 'policy target', 'filing as-of date', 'listed stake value', 'net debt'],
    chart: '한 계약의 최대 한도를 바깥 막대, 발동 조건이 맞은 금액을 안쪽 막대로 겹치고, 옆에 기준일이 적힌 공시 비율 한 줄', counterclaim: '조건부 한도도 여러 곳에서 동시에 발동하면 손실이 빠르게 커지고, 회사 목표선은 시장이 경계로 삼으면 실제 압력이 됨', concepts: ['private-credit', 'refinancing', 'information-asymmetry'] },

  { id: 'case-chart-timing', path: 'chart', title: '사례 차트의 시점: 그날 알 수 있었던 것만', issue: '과거 사례 차트에 사건일 뒤의 실적·가격이 함께 그려질 때 생기는 미래 정보 섞임과, 다른 시각·다른 원천의 가격을 같은 값으로 읽는 문제', sourceRefs: [R.leaders, R.snapshot, R.weekly],
    answer: '과거 주도주 사례 차트는 결과를 알고 고른 그림입니다. 2003년 NFLX 사례는 바닥 확인일이 3월 17일인데 4월 17일 발표 실적을 함께 보여 주고, 2016년 NVDA와 2020년 ZM 사례도 같습니다. 복기로는 문제없지만, 그날 판단의 근거로 읽으면 아직 나오지 않은 실적을 본 셈이 됩니다. 가격도 같습니다. 정규장 종가, 오후 7시 시간외 화면, 분할 전 가격은 서로 다른 시각의 다른 값입니다.',
    steps: ['사건일 정하기', '그날까지 공표된 실적만 남기기', '가격의 시각·세션·분할 기준 확인', '지수와 ETF·차트 원천 구분', '사후 결과는 따로 보기'],
    mechanism: [
      '실적은 분기 종료일이 아니라 발표 시각에 시장에 알려집니다. 장 마감 뒤 발표는 그날 종가에 들어 있지 않습니다. 사례를 다시 볼 때는 발표 시각이 판단 시각보다 앞선 자료만 남겨야 같은 조건의 비교가 됩니다.',
      '주간 이동평균도 같은 문제가 있습니다. 이번 주가 끝나지 않았으면 그 주의 종가는 아직 정해지지 않은 값이라, 완성된 주의 선과 진행 중인 주의 값을 나눠 읽어야 합니다. 20주선을 100거래일선으로 바꾸면 휴장과 결측 처리 때문에 값이 달라집니다.',
      '그림의 원천도 확인합니다. FTD 상승률은 나스닥 종합 기준인데 가격 도형은 QQQ인 경우, 차트를 다시 그린 경우(작성자가 TradingView 화면을 AI로 다시 렌더링했다고 밝힌 사례), 요약 패널과 본문의 종목 표기가 다른 경우는 원시 일봉으로 재현하기 전까지 탐색 단서입니다.'
    ],
    reverse: '사후 사례는 패턴을 익히는 데 여전히 쓸모가 있고, 모든 차트에 발표 시각을 붙이면 그림이 복잡해집니다. 성공 사례만 모은 그림에서 성공률을 구할 수는 없지만, 같은 정의로 실패 사례까지 세면 기저율을 만들 수 있습니다.',
    channels: ['심리'], variables: ['사건일', '실적 발표 시각', '가격 관측 시각·세션', '분할 조정 여부', '지수·ETF 원천', '완성된 주봉 여부'],
    indicators: [{ label: '기술적 분석의 주봉·일봉 방향', route: 'charts', routeLabel: '기술적 분석' }, { label: '종목 화면의 실적 발표 요약', route: 'ticker', routeLabel: '종목' }],
    shift: '과거 사례 차트를 한 장의 사실로 읽던 모델에서, 사건일 기준으로 그날 알 수 있었던 정보와 나중에 붙은 정보를 나누고 가격의 시각·원천을 확인하는 모델로 전환', inputs: ['event date', 'earnings release time', 'price observation time', 'split adjustment', 'index vs ETF source', 'completed weekly bar'],
    chart: '사건일에 세로선을 긋고 그 왼쪽만 진하게, 오른쪽(사후 경로·이후 실적)은 흐리게 표시하고, 실적 표에는 발표일 열을 따로 두기', counterclaim: '사후 사례도 패턴 학습에는 쓸모가 있고, 같은 정의로 실패 사례까지 세면 기저율로 바꿀 수 있음', concepts: ['base-rate', 'information-asymmetry'] },

  { id: 'segment-sum-consolidated', path: 'accounting', title: '합계·정의가 다른 숫자: 사업부 합, 매출과 이익, FCF', issue: '사업부 매출 합과 연결 매출, 매출 증가율과 이익 증가율, 회사마다 다른 FCF 정의를 같은 숫자로 읽는 문제', sourceRefs: [R.mrvl],
    answer: '같은 회사의 숫자라도 더하거나 바꿔 부르면 틀리는 경우가 셋 있습니다. 사업부 매출을 더하면 연결 매출보다 커질 수 있습니다. 인텔 3분기는 세 주요 사업부 매출만 더해도 221억 달러로 연결 매출 165억 달러보다 큽니다. 파운드리 매출 67억 달러 중 외부 고객 몫은 4.11억 달러이고 나머지는 자사 제품 제조라, 기타 부문 7억 달러를 더한 뒤 내부거래 63억 달러를 빼야 165억 달러가 맞습니다. 매출 증가율은 이익 증가율이 아닙니다. 마이크론 FY2026의 +256%는 매출입니다. FCF는 정의가 여럿입니다. Marvell FY2026은 영업현금흐름 − 설비투자로 13.96억 달러인데, 같은 해를 17.23억 달러로 적은 글도 있습니다.',
    steps: ['합계인가 연결인가(내부거래 제거)', '매출인가 이익인가', '정의가 같은가(GAAP·조정·FCF)', '기간이 같은가(분기·누계·회계연도)', '반복되는 매출인가'],
    mechanism: [
      '내부거래가 큰 회사는 사업부 성장률이 외부 수요를 보여 주지 않습니다. 인텔 파운드리의 +58%는 내부 매출을 포함하고, 외부 매출 4.11억 달러의 증가도 회사가 주로 비반복 계약 매출이라고 설명합니다.',
      'FCF는 회사·데이터 제공처마다 설비투자 범위, 리스 원금, 인수 대금 처리가 다릅니다. 공시의 영업현금흐름과 유형자산 매입으로 다시 계산해 맞지 않으면 둘을 섞지 않고 각각의 정의를 적습니다. FCF도 인수·주식보상 희석·운전자본 변화까지는 말해 주지 않습니다.',
      'AIO 종목 화면은 SEC 공시의 영업현금흐름 − 설비투자로 FCF를 계산하고, 기업 이해에는 사업부 매출과 내부거래 제거액을 따로 적습니다.'
    ],
    reverse: '내부거래가 작은 회사는 사업부 합이 연결 매출과 거의 같고, 조정 FCF가 회사의 실제 투자 판단에 더 가까운 경우도 있습니다. 정의가 달라도 방향이 같으면 결론은 크게 바뀌지 않습니다.',
    channels: ['이익'], variables: ['사업부 매출', '내부거래 제거액', '외부 매출', '매출 증가율', '이익 증가율', '영업현금흐름', '설비투자', 'FCF 정의'],
    indicators: [{ label: '종목 화면의 재무·기업 이해', route: 'ticker', routeLabel: '종목' }],
    shift: '보도나 글의 합계·증가율·FCF를 그대로 비교하던 모델에서, 연결 범위·지표 종류·정의·기간을 먼저 맞춘 뒤 비교하는 모델로 전환', inputs: ['segment revenue', 'intersegment eliminations', 'external revenue', 'revenue growth', 'profit growth', 'operating cash flow', 'capex', 'FCF definition'],
    chart: '사업부 매출 막대 셋을 쌓고 그 옆에 내부거래 제거 막대(음수)와 연결 매출 막대를 두어 합이 맞는 다리 그림', counterclaim: '내부거래가 작으면 합과 연결이 거의 같고, 정의가 달라도 방향이 같으면 결론이 크게 바뀌지 않음', concepts: ['fcf-vs-funding', 'level-vs-change', 'dilution'] }
].map(Object.freeze));

export const PACKET_20261108_LESSONS = Object.freeze(PACKET_20261108_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((id) => { const s = PACKET_20261108_SOURCES.find((row) => row.id === id); return { label: `${s.author} — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261108_CLAIMS = Object.freeze(PACKET_20261108_FRAMES.map((f) => Object.freeze({
  id: `claim-20261108-${f.id}`, packetId: 'packet-2026-11-08-x-bookmarks', observedOn: '2026-11-08', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '분기 공시(10-Q·8-K·6-K)와 회사 IR의 기준일, 월별 건설지출, 사건일 기준 일봉·주봉; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 북마크의 용량·한도·비율·가격 스냅샷은 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['용량 GW', '보증 한도', 'LTV 비율', '시간외 가격', '사례 차트 수치']), status: 'FRAMEWORK_EXTRACTED'
})));
