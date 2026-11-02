// The owner's X bookmarks added after the 2026-11-01 read (2026-11-02). Every bookmark in x.com/i/history above the first
// id of the 11/01 read was read in full through the owner's browser — article bodies, author threads, quoted posts, other
// users' replies — plus the four sustain_abund replies the 11/01 read could not open. Same reference-only shape as
// packet-20261101-x-bookmarks.js: nothing here is a live value, a ranking input or a call. Ledger: _artifacts/x-bookmarks-20261102/.
const check = (claim, state, basis) => Object.freeze({ claim, state, basis });
// Grades on the ledger's scale: A checked or reusable, B cited or confirming, C none.
const SOURCE_TIMELINE = Object.freeze({
  '2116905196479451413': Object.freeze({ postedAtUtc: '2026-11-01T14:48:00Z', refersTo: 'Nasdaq rally attempt from the 10/30 low close; follow-through days of 2022, 2023, 2025 and 2026', lag: 'two sessions before the earliest possible follow-through day', laterOutcome: 'AIO recomputed the cited follow-through days from ^IXIC daily bars with the same rule: 2025-04-22 (day 10), 2026-04-14 (day 11), 2026-06-15 (day 4) failed on 2026-07-23 — all match. 10/30 is day 1 in AIO too.' }),
  '2114012389226283209': Object.freeze({ postedAtUtc: '2026-10-24T15:13:00Z', refersTo: "the author's own dated calls since July (an index thread of quoted posts)", lag: 'retrospective', laterOutcome: 'n/a (an index). Each call carries its date, which is the habit the packet keeps; individual sector likes and dislikes are not carried.' }),
  '2116884680721269178': Object.freeze({ postedAtUtc: '2026-11-01T13:26:00Z', refersTo: 'the October drawdown in Korea and the US; Korean margin debt Aug–Oct; Samsung/SK hynix price vs 2027 operating-profit estimates', lag: 'weekend after the 10/30 close', laterOutcome: 'Korean semiconductor exports +259% y/y (October) is the trade ministry release; margin debt 27.4 → 34.3 trillion won matches the direction AIO 시장 온도 shows. The absorption test (lower margin debt, continued foreign selling, no lower low) cannot be judged yet.' }),
  '2116698557201965442': Object.freeze({ postedAtUtc: '2026-11-01T01:07:00Z', refersTo: 'a trend-following method (part 5: sideways and falling markets)', lag: 'not event-bound', laterOutcome: 'n/a (a method).' }),
  '2116854165406462419': Object.freeze({ postedAtUtc: '2026-11-01T11:25:00Z', refersTo: 'range boundaries (a 1:21 video and its caption)', lag: 'not event-bound', laterOutcome: 'n/a (a method; the video was not watched, the caption and the quoted post carry the rule).' }),
  '2116903278919512149': Object.freeze({ postedAtUtc: '2026-11-01T14:40:00Z', refersTo: 'SOXX after the 6/22 high (655.01); WSTS monthly sales to August; the 2027 AI-infrastructure shake-out', lag: 'weekend after the 10/30 close', laterOutcome: 'Cannot be judged yet. Lines stated in advance: a close below about 451 (3% under the 465 first-leg low) confirms the channel; a close above 589.51 voids it.' }),
  '2116883092837388435': Object.freeze({ postedAtUtc: '2026-11-01T13:20:00Z', refersTo: 'SOXX weekly chart, short version of the article above', lag: 'weekend', laterOutcome: 'Cannot be judged yet; the 50-week EMA 456 is the author’s line.' }),
  '2116911283547320410': Object.freeze({ postedAtUtc: '2026-11-01T15:12:00Z', refersTo: 'October sector heat map, RSP vs SPX, hedge-fund gross exposure, QQQ/SPY short interest, VIX and 0DTE puts on 10/30, the 11/3 midterm', lag: 'weekend after the 10/30 close', laterOutcome: 'AIO 10/30: VIX close 19.42 (matches); RSP vs S&P 500 in October matches the direction. Exposure and short-interest figures are third-party and not carried.' })
});
const SOURCE_QUALITY = Object.freeze({
  '2116905196479451413': Object.freeze({ data: 'A', coverage: 'A', logic: 'A', insight: 'A' }),
  '2114012389226283209': Object.freeze({ data: 'C', coverage: 'B', logic: 'B', insight: 'C' }),
  '2116884680721269178': Object.freeze({ data: 'B', coverage: 'A', logic: 'A', insight: 'B' }),
  '2116698557201965442': Object.freeze({ data: 'C', coverage: 'A', logic: 'A', insight: 'B' }),
  '2116854165406462419': Object.freeze({ data: 'C', coverage: 'B', logic: 'B', insight: 'C' }),
  '2116903278919512149': Object.freeze({ data: 'B', coverage: 'A', logic: 'A', insight: 'A' }),
  '2116883092837388435': Object.freeze({ data: 'C', coverage: 'B', logic: 'B', insight: 'B' }),
  '2116911283547320410': Object.freeze({ data: 'B', coverage: 'A', logic: 'A', insight: 'B' })
});
const source = (handle, statusId, date, summary, checks = []) => Object.freeze({
  id: `${handle}-${statusId}`, author: handle, sourceUrl: `https://x.com/${handle}/status/${statusId}`, publishedAt: date, publishedAtKst: date,
  sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED', summary, checks: Object.freeze(checks),
  timeline: SOURCE_TIMELINE[statusId], quality: SOURCE_QUALITY[statusId]
});

// What the 2026-11-02 read covered: 9 bookmarks above the 11/01 read (8 investment, 1 off-topic LLM explainer) plus the four
// replies left unread on 11/01.
export const PACKET_20261102_AUDIT = Object.freeze({
  readOn: '2026-11-02', newSinceLedger: 9, inScope: 8, agentPractice: 1, unrelated: 0, framesAdded: 3,
  repoState: Object.freeze({ reflected: 2, partial: 4, missing: 2, conflict: 0, notApplicable: 1 }),
  alreadyCovered: Object.freeze([
    '강제 청산과 펀더멘털 하락의 구분, 좋은 기업도 팔아야 하는 매도 → forced-seller-chain',
    '박스 경계에서 가격 도달이 아니라 후속 반응(복귀·되돌림 지지)을 확인 → breakout-follow-through, static-level-base-rate',
    '기술주만의 하락인지 방어 업종·동일가중까지 번지는지로 하락장 진입 판정 → leadership-handoff-criteria',
    'VIX를 기대 변동 범위와 종가 기준으로 읽기 → 10/18 변동성·기저율 노트',
    '판단 날짜를 박아 두고 나중에 결과와 대조하기 → 원장의 timeline·laterOutcome'
  ]),
  declined: Object.freeze(['개별 종목 관찰 목록(CVE·NTRA)과 레버리지 ETF 분할 매수', '지수 가격 구간(SPX 7600·7500, NQ 28150, QQQ 668·630)과 SOXX 328·2027-09 날짜 예측', '헤지펀드 그로스 노출·QQQ 공매도 잔고(제3자 자료, 무료 공식 원천 없음)', '업종 선호·비선호 목록(2차전지·바이오·조방원·원전)']),
  conflictsFixed: Object.freeze([]),
  structural: Object.freeze([
    '나스닥 종합지수 일봉으로 반등 시도 일수·바닥 확인일(FTD)·실패를 계산해 시장 상태 추세 칸의 분배일 옆에 둠(자동 갱신)',
    '미 국채 입찰 결과(응찰률·간접 낙찰 비중, 같은 만기 직전 6회 대비)를 TreasuryDirect에서 자동 수집해 거시 금리 칸에 붙임 — 10/27 MrMarket89 글의 빈칸'
  ])
});

export const PACKET_20261102_SOURCES = Object.freeze([
  source('damipov', '2116905196479451413', '2026-11-01', '바닥 확인일(FTD)과 준비된 주도주. 하락 뒤 가장 낮은 종가를 1일째로 세고, 4일째부터 나스닥이 크게 오르며 거래량이 늘면 FTD. FTD는 자주 실패하고(2022-03, 2026-06), 힘을 가르는 것은 FTD 뒤 며칠에서 3주 안에 50일선 위·얕은 베이스·높은 상대강도의 주도주가 피벗을 넘어 신고가로 나오는지다. 사례 2026-04-14(마이크론 당일 신고가), 2023-11-01(빅테크 열흘 안 다섯 곳), 2025-04-22(팔란티어 15거래일 뒤). 지금은 10/30이 1일째, 피벗 근처 베이스를 만든 대형주가 적고 대부분 에너지·헬스케어라 FTD가 나와도 약할 수 있다는 판단.', [check('2025-04-22 10일째, 2026-04-14 11일째, 2026-06-15 4일째 FTD, 7/23 실패', 'VERIFIED', 'AIO가 ^IXIC 일봉에 같은 규칙(6% 조정, 1.25% 이상 상승, 거래량 증가)을 돌린 결과와 날짜·일수 모두 같음'), check('10/30이 이번 조정의 가장 낮은 종가', 'VERIFIED', 'AIO 나스닥 종합 10/30 25,437, 10/6 27,599.79 대비 -7.8%')]),
  source('Trader_Jesse_', '2114012389226283209', '2026-10-25', '7월 이후 작성자 자신의 판단을 날짜와 함께 모은 색인 스레드: 7/30 폭락 정점 코멘트, 네오클라우드 비선호, 코스피 V자 기대 금지와 더블바텀, 소부장 신고가 뒤 높아진 저점, 금리·주식 동반 하락은 고금리가 취약 차주 신용에 미친 시차라는 해석, 리드타임 긴 조선·방산·원전 비선호.'),
  source('Trader_Jesse_', '2116884680721269178', '2026-11-01', '주말 마감 노트. 조정은 예상했지만 청산 규모가 컸다. 한국 신용융자 8월 초 27.4조 → 10월 중순 34.3조(+25%), CFD·TRS 강제 축소, 반도체와 무관한 업종 동반 급락을 근거로 하락의 상당 부분을 포지셔닝으로 본다. 판단을 바꿀 조건: 신용잔고가 줄고 외국인 매도가 이어져도 저점을 낮추지 않으면 강제 물량 흡수, 청산 뒤에도 저점이 낮아지고 이익 전망까지 하향되면 판단 수정. 삼성·하이닉스 9/23–10/13 주가 -18.7%·-22.5% 대 2027 영업이익 전망 -0.9%·+0.4%, 10월 반도체 수출 +259%.', [check('10월 반도체 수출 전년 대비 약 +259%', 'UNVERIFIED', 'AIO는 산업부 수출입 동향을 수집하지 않음(뉴스 분류만)'), check('신용융자 8월 초 27.4조 → 10월 중순 34.3조', 'CONSISTENT', 'AIO 시장 온도의 신용융자 증가 방향과 같음')]),
  source('shmath8218', '2116698557201965442', '2026-11-01', '추세추종 교과서 5편: 횡보장·하락장에서는 쉬는 것도 매매. 지수·주도주가 20일선 아래에서 회복하지 못하면 새 자리를 찾지 않고, 60일선까지 내려가면 횡보를 의심, 120일선이 깨지고 꺾이면 신규 매수를 잠근다. 연속 손절은 종목보다 시장 방향을 의심하라는 신호. 재개는 확실한 주도주가 20일선 위에서 버티고 60·120일선이 고개를 들고 거래대금이 실린 반등에서, 정찰매수부터.'),
  source('BTC_WyckoffLab', '2116854165406462419', '2026-11-01', '가격 도달은 지지 확인이 아니다. 박스 하단 이탈 뒤 박스 안 복귀, 상단 돌파 뒤 되돌림 지지라는 후속 반응을 확인하고, 종가로 하단을 이탈한 뒤 반등에서도 복귀하지 못하면 지지가 저항으로 바뀐다.'),
  source('WonhaengL', '2116903278919512149', '2026-11-01', 'SOXX 하락 채널 가설. 반도체 매출 전년 대비 증가율(WSTS 3개월 평균)은 8월 +144%로 최고인데 그 증가율이 매달 더 오르는 폭(델타)은 6월 +18.3%p에서 7·8월 +6~7.5%p로 줄었고, SOXX 고점(6/22)도 그달이었다. 기저효과로 9월 전월 대비가 약 +7%에 못 미치면 델타는 마이너스. 1994년 이후 약세장 5번은 모두 첫 하락이 -30% 안팎에서 멈췄다가 반등 뒤 그 저점을 깼고, 첫 저점을 종가로 3% 넘게 깬 6건은 모두 -40% 이상으로 갔지만, -25~-37% 조정 8건 중 6건은 그대로 바닥이었다. 2027년 연산 자원 재고·네오클라우드 정리(차마스·머스크 발언, BIS·무디스·번스타인 수치)와 하이퍼스케일러 2027 설비투자 증가 예고를 양쪽 근거로 함께 적음. 확정선 451, 폐기선 589.51.', [check('SOXX 고점 655.01(6/22), 10/30 종가 471.51', 'UNVERIFIED', 'AIO는 SOXX가 아니라 SMH를 기록함'), check('반도체 매출 증가율 +144%와 델타', 'UNVERIFIED', 'AIO는 WSTS 월 매출을 수집하지 않음')]),
  source('WonhaengL', '2116883092837388435', '2026-11-01', '위 글의 짧은 판: SOXX가 하락 평행채널 하단(LL)에 닿아 한 번 반등할 자리. 50주 지수이평 456이 깨지면 본격 하락, 거기서 반등하면 채널 가동. 댓글에서 채널 위로 뚫으면 관점 폐기라고 명시.'),
  source('laylaperfume', '2116911283547320410', '2026-11-02', '10월 AI 인프라·반도체·대형 기술주 매도와 헬스케어·필수소비재·유틸리티·에너지 강세, 동일가중 RSP 상승 마감을 내부 로테이션으로 읽은 글. 상승 시나리오: 그로스 노출 감소 -7.8%(2016년 이후 최대)와 기술주 공매도 잔고 증가가 중간선거 뒤 숏커버 연료. 하락 시나리오: 방어 업종·헬스케어까지 기술주와 함께 빠지고 RSP·IWM이 동시에 약해지면 하락장 진입. VIX는 10/30 장중 23.93에서 19.42로 마감, 최근 장중 20을 넘어도 종가로 20 위에 머문 날이 없어, 종가 20 아래면 기술적 반등 가능·20 위 안착 뒤 25면 경계.', [check('VIX 10/30 종가 19.42', 'VERIFIED', 'AIO history 10/30 vix 19.42'), check('그로스 노출 -7.8%, QQQ 공매도 잔고 급증', 'UNVERIFIED', '제3자 자료, AIO에 원천 없음')])
]);

const ref = (handle, statusId) => `${handle}-${statusId}`;
const R = {
  ftd: ref('damipov', '2116905196479451413'), rest: ref('shmath8218', '2116698557201965442'), box: ref('BTC_WyckoffLab', '2116854165406462419'),
  soxx: ref('WonhaengL', '2116903278919512149'), soxxShort: ref('WonhaengL', '2116883092837388435'), weekend: ref('Trader_Jesse_', '2116884680721269178'),
  index: ref('Trader_Jesse_', '2114012389226283209'), layla: ref('laylaperfume', '2116911283547320410')
};

export const PACKET_20261102_FRAMES = Object.freeze([
  { id: 'follow-through-day-leaders', path: 'chart', title: '바닥 확인일(FTD)과 따라 나오는 주도주', issue: '하락 뒤 지수가 바닥을 확인하는 날(follow-through day)을 세는 방법과, 그 신호의 힘을 가르는 주도주의 신고가 확인', sourceRefs: [R.ftd, R.rest, R.layla],
    answer: '조정 뒤 가장 낮은 종가를 1일째로 세고, 그 종가를 깨지 않는 동안 날짜를 셉니다. 4일째부터 나스닥이 하루 크게(AIO 기준 1.25% 이상) 오르면서 거래량이 전날보다 많으면 큰 자금이 다시 사기 시작했다는 흔적인 바닥 확인일입니다. 하지만 바닥 확인일은 자주 실패하므로 그날 지수를 사는 신호가 아니라, 그 뒤 며칠에서 3주 안에 하락장 동안 버틴 주도주가 신고가로 튀어나오는지를 지켜보라는 출발 신호입니다. 주도주가 따라 나오지 않는 바닥 확인일은 힘이 약합니다.',
    steps: ['조정 확인(고점 대비 하락)', '가장 낮은 종가 = 1일째, 깨지면 다시 셈', '4일째 이후 큰 상승 + 거래량 증가 = 바닥 확인일', '며칠~3주 안 주도주의 신고가 돌파', '1일째 종가 아래 마감 = 실패'],
    mechanism: [
      '급락장에서 하루이틀 반짝 반등은 흔합니다. 며칠을 버틴 뒤 거래량을 실은 큰 상승이 나와야 하루에 다 살 수 없는 큰 자금이 들어온 흔적으로 봅니다. 같은 방법의 다른 절반이 분배일(거래량이 늘면서 0.2% 이상 내린 날)이고, 분배일이 쌓이면 고점, 바닥 확인일이 나오면 바닥 쪽 신호입니다.',
      '주도주는 하락장 동안 50일선 위를 지키고, 고점 아래에서 얕고 거래량이 마르는 베이스를 만들며, 상대강도가 높게 유지됩니다. 바닥 확인일 뒤 이런 종목이 직전 최고 종가(피벗)를 넘어 52주 신고가를 내면 신호가 확인되고, 하락장에서 크게 밀린 종목은 지수가 돌아서도 한동안 따라오지 못합니다.',
      'AIO에서는 시장 상태 추세 칸에 분배일 수와 함께 나스닥 반등 시도 일수·바닥 확인일·실패를 두고, S&P 500 52주 신고가 종목 수로 주도주가 따라 나오는지를 같이 봅니다. 신고가가 어느 업종에서 나오는지는 테마·섹터 화면에서 확인합니다.'
    ],
    reverse: '바닥 확인일이 없는 바닥도 있고(V자 급반등), 바닥 확인일이 나온 뒤 저점을 다시 깨는 경우도 흔합니다(2022년 3월, 2026년 6월). 사례는 결과를 알고 고른 것이라 바닥 확인일 뒤 오르지 못한 종목이 더 많을 수 있고, 4일째 이후 1.25%라는 문턱도 시장 변동성에 따라 너무 낮거나 높을 수 있습니다.',
    channels: ['심리', '물량'], variables: ['반등 시도 일수', '1일째 저점 종가', '바닥 확인일 상승률·거래량', '52주 신고가 종목 수', '주도주의 50일선·베이스·피벗', '분배일 수'],
    indicators: [{ label: '시장 상태 추세 칸의 분배일·바닥 확인', route: 'signal', routeLabel: '시장 상태' }, { label: '테마·섹터 상대강도', route: 'themes', routeLabel: '테마 · 섹터' }],
    shift: '바닥을 가격 수준이나 "많이 빠졌다"로 판단하던 모델에서, 날짜를 세는 규칙(1일째·4일째·거래량)과 그 뒤 주도주의 신고가 확인이라는 두 단계로 판단하는 모델로 전환', inputs: ['rally attempt day count', 'day-1 low close', 'follow-through gain and volume', 'new 52-week highs', 'leader base and pivot', 'distribution days'],
    chart: '나스닥 일봉 위에 1일째 저점선과 바닥 확인일 표시를 두고, 아래에 S&P 500 52주 신고가 종목 수 막대를 겹치기', counterclaim: '바닥 확인일 없이 V자로 오르는 바닥도 있고, 바닥 확인일 뒤 저점을 다시 깨는 실패가 흔하며, 사례는 사후에 골라 성공률이 과장될 수 있음', concepts: ['base-rate', 'expected-value'] },

  { id: 'regime-fit-pause-rules', path: 'chart', title: '도구가 맞는 장을 고르기: 쉬는 규칙과 다시 시작하는 조건', issue: '추세추종 같은 방법이 통하는 장과 안 통하는 장을 이동평균 구조로 나누고, 신규 매수를 멈추고 다시 시작하는 조건을 미리 적어 두는 방법', sourceRefs: [R.rest, R.box, R.ftd],
    answer: '방법이 틀린 것이 아니라 방법이 맞지 않는 장에서 쓰는 것이 문제입니다. 상승 추세에서는 돌파와 손절 규칙이 제 역할을 하지만, 횡보장에서는 가짜 돌파와 작은 손절이 반복되고 하락장에서는 "많이 빠졌다"는 느낌의 매수가 손절을 연달아 부릅니다. 그래서 지수와 주도주가 20일선 아래에서 회복하지 못하면 새 자리를 찾지 않고, 60일선까지 내려가면 횡보를, 120일선이 깨지고 꺾이면 하락장을 의심해 신규 매수를 잠급니다. 다시 시작하는 조건(주도주가 20일선 위에서 버티고 중기선이 고개를 들며 거래대금이 실린 반등)도 미리 적어 둡니다.',
    steps: ['지금 장 구분(상승·횡보·하락)', '지수·주도주의 20·60·120일선 위치', '연속 손절 = 시장 방향 점검', '신규 매수 잠금', '다시 시작 조건: 주도주·중기선·거래대금', '작은 비중부터 재개'],
    mechanism: [
      '횡보장의 손실은 한 번의 크기가 아니라 횟수에서 옵니다. 손절 한 번은 손실 예산 안이어도 여덟 번이면 계좌가 깎입니다. 방향이 없는 자리에서 나눠 사는 것은 추세가 확인된 뒤 비중을 올리는 분할이 아니라 물타기에 가깝습니다.',
      '경계에서는 가격이 닿았는지가 아니라 그 뒤 반응을 봅니다. 박스 하단을 종가로 이탈한 뒤 반등에서도 박스 안으로 돌아오지 못하면 지지가 저항이 되고, 상단을 넘은 뒤 되돌림에서 지지받으면 돌파가 확인됩니다.',
      '쉬는 것에는 두 가지가 있습니다. 포지션을 줄이는 것과, 차트는 보되 신규 매수 버튼을 잠그는 것입니다. 쉬는 동안 다음 주도주 목록을 만들어 두면 바닥 확인일 뒤 따라 나오는 종목을 빨리 알아볼 수 있습니다.'
    ],
    reverse: '이동평균 기준은 늦습니다. V자 반등에서는 120일선이 고개를 들 때 이미 상승의 큰 부분이 지나 있고, 쉬는 규칙을 너무 엄격하게 지키면 바닥 근처의 좋은 자리를 놓칩니다. 이동평균 기간(20·60·120 또는 20·50·200)에 정답은 없고, 같은 규칙을 종목과 지수에 그대로 쓰면 맞지 않을 수 있습니다.',
    channels: ['심리'], variables: ['지수 20·60·120일선 위치', '주도주 20일선 유지', '연속 손절 횟수', '거래대금', '박스 경계의 종가 반응'],
    indicators: [{ label: '시장 상태 추세 칸', route: 'signal', routeLabel: '시장 상태' }, { label: '스크리너의 이동평균·셋업 조건', route: 'screener', routeLabel: '스크리너' }],
    shift: '규칙을 지키는 것만 묻던 모델에서, 규칙이 먹히는 장인지 먼저 구분하고 신규 매수를 잠그는 조건과 다시 여는 조건을 미리 적어 두는 모델로 전환', inputs: ['index vs 20/60/120-day lines', 'leader above 20-day line', 'consecutive stop-outs', 'turnover', 'range boundary close reaction'],
    chart: '지수 일봉에 20·60·120일선을 겹치고 신규 매수 잠금 구간을 음영으로, 거래대금 막대를 아래에 두기', counterclaim: '이동평균 기준은 늦어 V자 반등의 큰 부분을 놓칠 수 있고, 기간 선택에 정답이 없어 같은 규칙이 지수와 종목에서 다르게 작동함', concepts: ['base-rate'] },

  { id: 'growth-acceleration-peak', path: 'industry', title: '성장률보다 성장의 가속도: 사이클 주식의 고점과 첫 하락', issue: '매출 증가율이 최고여도 그 증가율이 오르는 속도(가속도)가 꺾이면 주가가 먼저 꺾일 수 있고, 기저효과가 가속도를 마이너스로 만드는 구조와 첫 하락 뒤 조정과 약세장을 가르는 선', sourceRefs: [R.soxx, R.soxxShort, R.weekend],
    answer: '반도체처럼 사이클이 큰 업종의 주가는 매출이 얼마나 늘었는지보다 그 증가율이 계속 빨라지는지에 반응하는 경우가 많습니다. 전년 대비 증가율이 사상 최고여도 매달 더 오르는 폭이 줄면 가격이 먼저 꺾일 수 있고, 작년에 매출이 빠르게 늘었던 달과 비교하게 되면 매출이 그대로여도 증가율은 기계적으로 내려갑니다(기저효과). 다만 첫 하락이 -30% 안팎에서 멈춘 뒤 그대로 바닥인 경우도 많아, 첫 저점을 종가로 확실히 깨는지를 약세장과 조정을 가르는 선으로 미리 정해 둡니다.',
    steps: ['전년 대비 증가율(수준)', '증가율의 월간 변화(가속도)', '기저효과: 작년 같은 달의 전월 대비', '첫 하락의 깊이와 반등 고점', '첫 저점 종가 이탈 여부(확정선)와 직전 반등 고점 돌파(폐기선)'],
    mechanism: [
      '가속도는 이렇게 계산합니다. 이번 달 전년 대비 증가율에서 지난달 증가율을 뺀 값입니다. 증가율이 +140%에서 +144%로 오르면 가속도는 +4%p로 아직 플러스지만, 그 전에 +18%p씩 오르던 때보다 크게 줄어든 것입니다. 작년 같은 달 매출이 전월보다 7% 늘었다면, 올해 이번 달도 7% 넘게 늘어야 증가율이 유지됩니다.',
      '사이클 주식의 주가 고점은 대체로 이익이 가장 좋을 때 나오고, 주가 바닥은 증가율이 가장 나쁠 때보다 먼저 옵니다. 그래서 증가율 수준만 보고 "아직 좋다"고 판단하면 늦고, 가속도와 기저를 함께 봐야 다음 몇 달의 숫자가 어떻게 보일지 압니다.',
      '숫자가 좋은데 주가가 빠질 때 원인은 둘로 나눕니다. 이익 전망이 거의 그대로인데 신용·레버리지 청산으로 빠지는 것인지, 다음 해 수요(재고·주문·자금 조달)가 실제로 꺾이는 것인지입니다. 앞쪽이면 청산이 끝난 뒤 더 팔아도 저점을 낮추지 않는지를, 뒤쪽이면 이익 전망 하향을 확인합니다.'
    ],
    reverse: '가속도 둔화의 큰 부분은 기저효과라는 계산의 결과라 실제 수요 둔화를 뜻하지 않을 수 있고, 공급 부족(HBM·첨단 패키징)이 가격을 받치면 가속도 마이너스가 더 늦게 옵니다. 과거 통계는 표본이 5~8개로 작고 지금보다 훨씬 낮은 성장률의 사이클에서 나왔으며, 하이퍼스케일러의 다음 해 설비투자가 늘어난다면 2027년 조정 시나리오 자체가 약해집니다.',
    channels: ['이익', '심리'], variables: ['업종 월 매출 전년 대비 증가율', '증가율의 월간 변화', '작년 같은 달 전월 대비', '첫 하락 깊이', '첫 저점 종가', '다음 해 설비투자 계획'],
    indicators: [{ label: 'AI 공급망 묶음별 흐름(반도체)', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '거시의 AI 투자 갈래와 빅테크 투자 자금 여력', route: 'macro', routeLabel: '매크로' }],
    shift: '"매출 증가율이 사상 최고니 고점이 아니다"로 읽던 모델에서, 증가율의 가속도와 기저효과로 다음 몇 달의 숫자를 미리 보고, 첫 하락 뒤 약세장과 조정을 가르는 가격선을 먼저 정하는 모델로 전환', inputs: ['industry sales YoY', 'YoY change month over month', 'prior-year MoM base', 'first-leg drawdown', 'first-leg low close', 'next-year capex plans'],
    chart: '업종 월 매출 증가율 선과 그 월간 변화 막대를 겹치고, 업종 ETF 가격과 첫 저점선을 같은 기간에 놓기', counterclaim: '가속도 둔화는 상당 부분 기저효과라는 계산 결과이고, 공급 부족과 다음 해 설비투자 증가가 하락 시나리오를 늦추거나 없앨 수 있으며, 과거 통계의 표본이 작음', concepts: ['level-vs-change', 'cyclical-per'] }
].map(Object.freeze));

export const PACKET_20261102_LESSONS = Object.freeze(PACKET_20261102_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((id) => { const s = PACKET_20261102_SOURCES.find((row) => row.id === id); return { label: `${s.author} — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261102_CLAIMS = Object.freeze(PACKET_20261102_FRAMES.map((f) => Object.freeze({
  id: `claim-20261102-${f.id}`, packetId: 'packet-2026-11-02-x-bookmarks', observedOn: '2026-11-02', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '지수 일봉(반등 시도 일수·바닥 확인일, 이후 3주), 이동평균 20·60·120일, 업종 월 매출 증가율과 그 월간 변화를 구분; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 북마크의 지수 가격선·증가율·포지션 수치는 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['반등 시도 일수', '가격 구간', '증가율과 가속도 수치', '포지션 수치']), status: 'FRAMEWORK_EXTRACTED'
})));
