// The owner's X bookmarks added after the 2026-11-02 read (2026-11-04). Every bookmark in x.com/i/history above the
// 11/02 read was read through the owner's browser and the fxtwitter thread API — article bodies and every article image,
// author threads, quoted posts two levels deep, other users' replies. One quoted post was subscriber-only and stayed
// unread. Same reference-only shape as packet-20261102-x-bookmarks.js: nothing here is a live value, a ranking input or a
// call. Ledger: _artifacts/x-bookmarks-20261104/.
const check = (claim, state, basis) => Object.freeze({ claim, state, basis });
// Grades on the ledger's scale: A checked or reusable, B cited or confirming, C none.
const SOURCE_TIMELINE = Object.freeze({
  '2117088528534532318': Object.freeze({ postedAtUtc: '2026-11-02T02:56:53Z', refersTo: 'Nasdaq correction from the 10/6 high to the 10/30 close; base rates of 7%+ corrections since 1986; QQQ monthly bearish engulfing since 2005; sector share of a 210-name watch list near 52-week highs', lag: 'weekend after the 10/30 close', laterOutcome: 'The 11/02 Nasdaq close 25,164.36 fell below the 10/30 close 25,437, so the rally-attempt count restarts from 11/02 and the earliest follow-through day moves past 11/5. AIO screener 11/03: within 5% of the 52-week closing high — healthcare 34/88, technology 9/179; the energy share in AIO (11/53) is lower than the author’s list after Brent fell 7.6% on 11/03.' }),
  '2117584577040728104': Object.freeze({ postedAtUtc: '2026-11-03T11:48:00Z', refersTo: 'QQQ drawdown zones -14% and -16.5% from the high and a single-digit fear & greed reading', lag: 'Asian session 11/03', laterOutcome: 'Cannot be judged yet. AIO composite fear & greed read 18.95 on the 11/03 cut, the same zone as the CNN 19 in the post’s image.' }),
  '2117561383294587012': Object.freeze({ postedAtUtc: '2026-11-03T10:15:50Z', refersTo: 'Nasdaq 100 futures at the 200-day line and a monthly Fibonacci channel floor; SOXX weights after the 10/30 rebalance; AMD consensus before its 11/03 report', lag: 'before the AMD report and the midterm result', laterOutcome: 'AMD beat the data-center and fourth-quarter guidance bars the post set (data center $8.55B vs about $8.25B expected; guide $17.0B vs about $16.3B). Index direction cannot be judged yet.' }),
  '2117388916898832719': Object.freeze({ postedAtUtc: '2026-11-02T22:50:31Z', refersTo: 'a broker’s 2027 semiconductor outlook (Korea Investment & Securities), shared with a one-line endorsement', lag: 'not event-bound; the call is a November turn', laterOutcome: 'Cannot be judged yet. The thesis (price peaks near the growth sign change, 3Q27–4Q27 at the earliest) directly opposes the 11/02 acceleration frame; both are kept as competing clocks.' }),
  '2117540898473210128': Object.freeze({ postedAtUtc: '2026-11-03T08:54:26Z', refersTo: 'trailing vs forward P/E of 26 AI value-chain names in six layers, early November', lag: 'the 11/2–11/3 closes', laterOutcome: 'Rechecked with AIO consensus-estimates.json and SEC P/E for the US names: memory forward P/E about 5 (MU), chip design 15–60, equipment 21–26, networking 29–40 — the same ordering. Bases differ (consensus adjusted EPS vs GAAP), so the levels are approximate.' }),
  '2117742046299770937': Object.freeze({ postedAtUtc: '2026-11-03T22:13:44Z', refersTo: 'AMD 3Q26 results (a broker’s summary quoted with a comment)', lag: 'same evening', laterOutcome: 'Company release figures; quarterly free cash flow fell 64% q/q on inventory (-$3.0B) and receivables (-$1.9B) while revenue rose 16% q/q.' }),
  '2117757214463308287': Object.freeze({ postedAtUtc: '2026-11-03T23:14:00Z', refersTo: 'the after-hours reaction to AMD and Super Micro results', lag: 'same evening', laterOutcome: 'n/a (an after-hours reaction; the next session decides it).' }),
  '2117803780469326271': Object.freeze({ postedAtUtc: '2026-11-04T02:19:02Z', refersTo: 'Arista Networks 3Q26 results and call', lag: 'next morning', laterOutcome: 'Company figures (revenue +58.5% y/y, adjusted operating margin 49.1%, 2027 growth guide 38–40%). The attached image is unrelated to the company.' }),
  '2117623943989465218': Object.freeze({ postedAtUtc: '2026-11-03T14:24:26Z', refersTo: 'a bank’s pre-open notes for 11/03: midterm odds, onsemi, Marvell–Lumentum, Palantir contract value, TMT short interest', lag: 'pre-open 11/03', laterOutcome: 'n/a (dated desk notes; short-interest and beta figures are third-party).' }),
  '2117600904811778548': Object.freeze({ postedAtUtc: '2026-11-03T12:52:53Z', refersTo: 'a table of the 50 US stocks most recommended by top analysts, with 12-month targets and returns since first pick', lag: 'not event-bound', laterOutcome: 'Not carried: a third-party ranking with no stated method; AIO does not rank by analyst targets.' }),
  '2117559780537422297': Object.freeze({ postedAtUtc: '2026-11-03T10:09:28Z', refersTo: 'US investment-grade spread (3–5 year proxy) vs a 150 bp systemic line; private credit in B/CCC; a Chinese state-owned developer’s trust default', lag: 'same day', laterOutcome: 'AIO macro-history (FRED, to 10/30): IG OAS 0.78 → 0.94 since 8/04, HY 2.73 → 3.44, CCC 10.19 → 13.27. The widening is largest at the bottom tier and IG is at its one-year high but well under the systemic line — the post’s reading holds.' }),
  '2117382738676482105': Object.freeze({ postedAtUtc: '2026-11-02T22:25:58Z', refersTo: 'the 11/02 close and the reasons attached to it (capex, debt and equity raises, peak-out talk, hedge-fund de-grossing)', lag: 'same evening', laterOutcome: 'AIO history 11/02: Nasdaq -1.07%, S&P 500 -0.51%, Dow +0.41%; Brent -7.6% on the 11/03 row; 10-year 4.89% (post 4.88%). Hedge-fund flow figures are third-party.' }),
  '2117033551661023412': Object.freeze({ postedAtUtc: '2026-11-01T23:18:25Z', refersTo: 'global liquidity vs the Nasdaq 100, cloud margins, a chip-capacity composite, token demand, compute supply vs demand', lag: 'weekend', laterOutcome: 'n/a (a thesis). Hyperscaler operating cash flow and capex are in AIO bigtech-cashflow.json; token and liquidity composites are the author’s own and not carried.' }),
  '2117588511620784340': Object.freeze({ postedAtUtc: '2026-11-03T12:03:38Z', refersTo: 'a sell decision checklist and an anecdote from Reminiscences of a Stock Operator', lag: 'not event-bound', laterOutcome: 'n/a (a method).' }),
  '2117362559959621738': Object.freeze({ postedAtUtc: '2026-11-02T21:05:47Z', refersTo: 'midterm prediction-market odds, the sector rotation before the vote, oil falling while tech sold off', lag: 'the evening before the 11/03 vote', laterOutcome: 'The author’s 10/30 rule from the previous packet (VIX does not close above 20) broke on 11/02 (AIO close 21.15). The post-vote flow cannot be judged yet.' }),
  '2117412265490362789': Object.freeze({ postedAtUtc: '2026-11-03T00:23:18Z', refersTo: 'screenshots of a third-party Korean market app at the 11/03 open (KOSPI -3.3%, advancers 21%, strong and weak industries)', lag: 'intraday', laterOutcome: 'n/a (a product screenshot; kept as a screen-design reference only).' }),
  '2117150968441950588': Object.freeze({ postedAtUtc: '2026-11-02T07:05:00Z', refersTo: 'the cover and contents of a 745-page shipbuilding, defense and machinery outlook', lag: 'not event-bound', laterOutcome: 'n/a (only the cover and contents were shared; the report itself was not read).' })
});
const SOURCE_QUALITY = Object.freeze({
  '2117088528534532318': Object.freeze({ data: 'A', coverage: 'A', logic: 'A', insight: 'A' }),
  '2117584577040728104': Object.freeze({ data: 'B', coverage: 'C', logic: 'B', insight: 'C' }),
  '2117561383294587012': Object.freeze({ data: 'B', coverage: 'B', logic: 'B', insight: 'B' }),
  '2117388916898832719': Object.freeze({ data: 'B', coverage: 'A', logic: 'A', insight: 'A' }),
  '2117540898473210128': Object.freeze({ data: 'A', coverage: 'A', logic: 'B', insight: 'B' }),
  '2117742046299770937': Object.freeze({ data: 'A', coverage: 'A', logic: 'B', insight: 'B' }),
  '2117757214463308287': Object.freeze({ data: 'B', coverage: 'B', logic: 'C', insight: 'C' }),
  '2117803780469326271': Object.freeze({ data: 'B', coverage: 'B', logic: 'B', insight: 'B' }),
  '2117623943989465218': Object.freeze({ data: 'B', coverage: 'B', logic: 'B', insight: 'C' }),
  '2117600904811778548': Object.freeze({ data: 'C', coverage: 'B', logic: 'C', insight: 'C' }),
  '2117559780537422297': Object.freeze({ data: 'A', coverage: 'B', logic: 'A', insight: 'A' }),
  '2117382738676482105': Object.freeze({ data: 'B', coverage: 'A', logic: 'B', insight: 'B' }),
  '2117033551661023412': Object.freeze({ data: 'B', coverage: 'A', logic: 'B', insight: 'B' }),
  '2117588511620784340': Object.freeze({ data: 'C', coverage: 'A', logic: 'A', insight: 'A' }),
  '2117362559959621738': Object.freeze({ data: 'B', coverage: 'B', logic: 'B', insight: 'B' }),
  '2117412265490362789': Object.freeze({ data: 'C', coverage: 'C', logic: 'C', insight: 'B' }),
  '2117150968441950588': Object.freeze({ data: 'C', coverage: 'C', logic: 'C', insight: 'C' })
});
const source = (handle, statusId, date, summary, checks = []) => Object.freeze({
  id: `${handle}-${statusId}`, author: handle, sourceUrl: `https://x.com/${handle}/status/${statusId}`, publishedAt: date, publishedAtKst: date,
  sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition: 'FRAMEWORK_EXTRACTED', summary, checks: Object.freeze(checks),
  timeline: SOURCE_TIMELINE[statusId], quality: SOURCE_QUALITY[statusId]
});

// What the 2026-11-04 read covered: 25 bookmarks above the 11/02 read (17 investment, 8 agent and coding practice).
export const PACKET_20261104_AUDIT = Object.freeze({
  readOn: '2026-11-04', newSinceLedger: 25, inScope: 17, agentPractice: 8, unrelated: 0, framesAdded: 4,
  repoState: Object.freeze({ reflected: 2, partial: 11, missing: 2, conflict: 1, notApplicable: 9 }),
  alreadyCovered: Object.freeze([
    '분배일·바닥 확인일(FTD)로 바닥을 확인하고 가격으로 맞히지 않기 → follow-through-day-leaders',
    '돈이 기술주에서 헬스케어·에너지·방어 업종으로 옮겨 갔는지, 전체로 번졌는지 → leadership-handoff-criteria, leadership-dispersion',
    '모든 뉴스를 하락 이유로 끼워 맞추는 해석과 가격에 맞춰 붙는 설명 → narrative-ledger-check',
    '빅테크의 영업현금흐름 대비 설비투자·주주환원과 차입 → truth-leverage-gauges, 빅테크 투자 자금 여력(bigtech-cashflow)',
    '이익이 가장 좋을 때 주가가 가장 싼 사이클 업종의 낮은 PER → cyclical-per 개념',
    '공포 지수 한 자릿수·고점 대비 낙폭 구간에서 나눠 사기 → volatility-base-rates, 시장 심리 화면'
  ]),
  declined: Object.freeze(['개별 종목 관찰 목록(에너지·헬스케어 12종목)과 분할 매수 가격(QQQ 655·635)', '애널리스트 추천 수 순위와 12개월 목표주가(방법 미공개 제3자 표)', '중간선거 예측시장 확률(이벤트 종료, 무료 공식 원천 없음)', '헤지펀드 순매수·TMT 공매도 잔고·베타(제3자 자료)', '토큰 사용량·전력·연산 공급 지표(작성자 자체 합성 지표)', '증권사 목표가·비중확대 의견']),
  conflictsFixed: Object.freeze(['반도체 주가 고점: 11/02 가속도 시계(증가율의 증가 폭이 줄면 꺾임)와 11/04 부호 시계(증가율이 마이너스로 돌 때 꺾임)를 cycle-top-two-clocks에 함께 두고, 어느 쪽이 맞는지 가를 관측을 적음']),
  structural: Object.freeze([])
});

export const PACKET_20261104_SOURCES = Object.freeze([
  source('damipov', '2117088528534532318', '2026-11-02', '11월 1주 시장 리포트. AI 대표주 14개 중 7개가 6개월 고점 대비 -40% 넘게 빠졌고, 같은 기간 52주 고점 5% 안 종목은 에너지·헬스케어에 몰렸다(관심 종목 210개 중 에너지 65%, 헬스케어 59%, 기술 15%). 1986년 이후 나스닥 7% 이상 조정 40번 중 8번이 약세장(-20%)으로 번졌고, 이번처럼 28거래일 안에 -7%가 된 빠른 조정은 32번 중 4번. 경로·VIX·10년물·유가 변화로 고른 닮은 조정 3번은 모두 -14% 안에서 멈췄고 저점 뒤 6~17거래일에 FTD가 나왔다. QQQ 10월 하락 장악형 월봉은 2005년 이후 일곱 번째로, 앞선 6번 중 4번이 6개월 안에 -10% 넘게 더 빠졌다. 최근 25거래일 분배일 QQQ 9·S&P 7·나스닥 4. 결론은 현금을 지키며 FTD를 기다리고, 새 돈은 신고가 업종 주도주의 피벗 돌파에만.', [check('나스닥 10/6 고점 대비 10/30 종가 -7.8%', 'VERIFIED', 'AIO history: 27,599.79 → 25,437'), check('업종별 52주 고점 근처 비율에서 헬스케어 우위, 기술 최하위', 'CONSISTENT', 'AIO 스크리너 11/03: 52주 종가 고점 5% 안 헬스케어 34/88(39%), 기술 9/179(5%). 에너지는 11/03 유가 급락 뒤 11/53(21%)'), check('1986년 이후 7% 조정 40번 중 8번 약세장, 빠른 조정 32번 중 4번', 'VERIFIED', 'Yahoo ^IXIC 1986~2026 일봉 종가로 같은 정의(직전 최고 종가 -7% 조정, -20% 약세장, 28거래일 안 -7% = 빠른 조정)를 다시 세어 40·8·32·4와 약세장 시작 고점 8개 날짜가 모두 같음'), check('QQQ 하락 장악형 월봉 2005년 이후 6번 중 4번이 6개월 안 -10% 추가', 'CONSISTENT', '같은 6개월(2008-06·2009-02·2010-01·2018-10·2020-02·2021-09)과 6개월 수익률이 재현되지만 "고가↑·저가↓·종가 < 전월 저가"(바깥 반전) 정의일 때만이다. 본문 도식의 몸통 장악형 정의(시가 ≥ 전월 종가, 종가 ≤ 전월 시가)로 세면 21번이라 같은 통계가 아님')]),
  source('Macaujeongc', '2117584577040728104', '2026-11-03', 'QQQ 고점 대비 -14%와 -16.5% 구간을 미리 정해 두고, 그 구간에서 공포·탐욕 지수가 한 자릿수로 내려가면 두 번에 나눠 사겠다는 계획. 방향을 틀려도 기술적 반등이 살려 줄 자리라는 판단.', [check('공포·탐욕 지수 19', 'CONSISTENT', 'AIO 합성 공포·탐욕 11/03 18.95')]),
  source('laylaperfume', '2117561383294587012', '2026-11-03', '반등 이유는 나스닥 선물의 피보나치 채널 하단과 200일선 지지라는 기술적 이유뿐이고, 진짜 반등인지는 AMD 실적과 중간선거를 소화한 뒤에 판단. SOXX는 10/30 리밸런싱 뒤 인텔 비중이 6.3%로 1위에서 5위로 내려가고 실적을 앞둔 AMD(9.2%)·엔비디아(8.0%)가 1·2위가 되어, 두 회사 실적에 ETF 변동성이 더 커진다. AMD는 데이터센터 전년 대비 약 +91% 기대가 이미 높아 데이터센터 성장 지속과 4분기 가이던스가 관건.', [check('AMD 데이터센터 매출과 4분기 가이던스가 기대를 넘었는지', 'VERIFIED', 'AMD 11/03 발표: 데이터센터 85.5억 달러(예상 약 82.5억), 4분기 매출 가이던스 170억 달러(예상 약 163억)')]),
  source('Trader_Jesse_', '2117388916898832719', '2026-11-03', '한국투자증권 반도체 2027 전망 공유("최근 본 가장 완성도 높은 리포트"). 두 가지 관성을 반박: (1) 증가율 고점이 주가 고점이라는 생각 — 주가 고점은 증가율 둔화가 아니라 마이너스 전환 근처에서 나왔고, 빨라도 3Q27~4Q27. 엔비디아가 횡보를 넘은 것도 매출 증가율 플러스가 가장 오래 이어진 분기였고, 국내 메모리 단가 증가율 고점 뒤 플러스 지속은 과거 최장 7개 분기. (2) 닷컴 트라우마 — 클라우드 업체의 전략 변화, 프런티어 모델 회사 지분 공유, 엔비디아의 자금 공급 역할, 미국 정책 지원으로 투자는 이어진다. 1H27 이익, 2H27 배수 반등.'),
  source('RoyPapa5', '2117540898473210128', '2026-11-03', 'AI 밸류체인 PER 지도: 6개 층(하이퍼스케일러·SW, AI 칩 설계, 메모리, 파운드리·장비, 네트워크·광, 전력·냉각) 26개 종목의 후행 PER → 선행 PER(로그 축). 선행 중앙값 메모리 3.0배, 하이퍼스케일러 22.3배, 칩 설계 24.4배, 장비 23.4배, 네트워크 28.3배, 전력 24.4배. 선이 길수록 시장이 기대하는 이익 증가 폭이 크다. 성장 산업 주도주가 이 정도 배수면 버블이 아니라는 주장, 댓글에서 중간 캐즘은 인정.', [check('메모리 선행 PER이 다른 층보다 한참 낮은 순서', 'CONSISTENT', 'AIO consensus-estimates(선행 EPS)와 SEC PER로 환산: MU 약 4.8배, 장비 21~26배, 네트워크 29~40배. 이익 기준이 달라 수준은 근사')]),
  source('Trader_Jesse_', '2117742046299770937', '2026-11-04', 'AMD 3Q26 실적 요약 인용: 매출 133.8억 달러(+44.7%), 데이터센터 85.5억(+96.9%, 매출 비중 63.9%), 4분기 가이던스 170억(컨센서스 +4.4%). 클라이언트(PC) 매출도 전년 대비 +7.2%라 인텔의 부진은 업황보다 인텔 문제일 수 있다는 코멘트. 분기 FCF는 재고 증가(-30억)·매출채권 증가(-19.3억)로 5.5억(전분기 대비 -64%).'),
  source('GONOGO_Korea', '2117757214463308287', '2026-11-04', 'AMD 시간외 +7%: 4분기 가이던스와 내년 데이터센터 성장 전망이 높은 기대를 다시 넘어, 인텔 급락 뒤 AI 전반의 시험대를 통과했다는 반응. 서버 제조사 실적도 좋아 AI 장비·클라우드 임대 업체가 함께 상승.'),
  source('fednmad', '2117803780469326271', '2026-11-04', '아리스타 3Q26: 매출 +58.5%(상장 뒤 최고 증가율), 조정 영업이익률 49.1%, 2027년 성장 38~40% 전망. 랙 안·랙 사이·데이터센터 사이(scale-up·out·across)를 모두 연결하고, 특정 GPU 회사에 묶이지 않는 개방형 이더넷 수요. 클러스터가 커질수록 통신 지연·혼잡 제어가 시스템 성능을 좌우해, 인프라 투자 확대가 곧 수익성 악화는 아니라는 비교점.'),
  source('GONOGO_Korea', '2117623943989465218', '2026-11-03', '11/03 장전 은행 노트: 하원 민주당 다수 확률 90%·상원 65%+, 온세미 AI 데이터센터 매출 첫 1.8억 달러와 인수, 마벨의 루멘텀 인수로 잠재시장 확대, 팔란티어 계약 기간 단축에 따른 총계약가치 변동 위험, TMT 공매도 잔고 증가와 베타 하락에 따른 업종 변동성 확대.'),
  source('GONOGO_Korea', '2117600904811778548', '2026-11-03', '상위 애널리스트 추천 수 상위 미국 주식 50개와 12개월 목표가 표(엔비디아 15명 1위, 마벨·AMD 14명). 첫 추천 뒤 수익률은 50개 중 41개가 S&P 500보다 낮음. 참고용.'),
  source('JunDo1050', '2117559780537422297', '2026-11-03', '금리 상승으로 리파이낸싱 비용이 오르며 부채비율이 높거나 현금흐름이 약한 기업과 부동산부터 신용 스트레스가 커지지만, 투자등급 3~5년 스프레드(근사치)는 85bp로 아직 낮아 시장 전체 신용경색으로 보기 어렵다 — 번진다면 150bp를 넘을 것. 사모신용 문제도 아직 B·CCC 대출에 국한되지만 하반기 들어 조금씩 악화. 인용: 중국 국유 부동산 기업 신탁 상환 실패로 "국유기업은 안전하다"는 믿음이 깨지며 우량 회사채 금리 급등, 미국 대형 부동산 회사가 차환 대신 건물을 넘기는 사례.', [check('하위 등급일수록 스프레드가 크게 벌어짐', 'VERIFIED', 'AIO macro-history(FRED) 8/04 → 10/30: CCC 10.19 → 13.27%, 하이일드 2.73 → 3.44%, 투자등급 0.78 → 0.94%'), check('투자등급 스프레드가 아직 낮음', 'CONSISTENT', 'AIO 투자등급 OAS 0.94%는 최근 1년 최고지만 150bp와 거리가 큼. 작성자 지표는 3~5년 만기 지수에서 국채 금리를 뺀 근사치라 수준이 다름'), check('3~5년 근사치 85bp', 'VERIFIED', 'FRED 11/02: 3~5년 투자등급 지수 유효수익률 5.53% − 국채 3년·5년 평균 4.675% = 85.5bp. 같은 날 투자등급 OAS는 94bp. 근사치는 옵션 조정 스프레드가 아니라 수익률 차이라, 금리가 오를 때 OAS와 다르게 움직일 수 있음. 150bp는 작성자의 경험칙이고 검증된 경보선이 아님')]),
  source('NURadu_', '2117382738676482105', '2026-11-03', '11/02 하락 이유를 하나씩 뜯어 본 글: 설비투자를 늘려도 줄여도, 유가·금리가 올라도 내려도 모두 하락 이유로 쓰인다. 빅테크의 미개시 리스 약정, 영업현금흐름 대비 주주환원 감소, 회사채·전환우선주 발행, 클라우드 임대 업체의 GPU 담보 대출이 차입 우려로 읽혔다. 진짜 원인은 헤지펀드가 5거래일 동안 그간 모은 AI 순매수를 토해 낸 수급. 가장 무서운 것은 호재를 줘도 매도 명분으로 삼는 분위기.', [check('11/02 나스닥 -1.07%, S&P 500 -0.51%, 다우 +0.41%', 'VERIFIED', 'AIO history 10/30 → 11/02 종가'), check('브렌트 -7.6%, 10년물 4.88%', 'CONSISTENT', 'AIO history 11/03 행 브렌트 113.43 → 104.77, 10년물 4.89%')]),
  source('RaoulGMI', '2117033551661023412', '2026-11-02', '"AI 거래는 끝났다"에 대한 반론. 유가 충격이 달러와 단기 금리를 올려 금융여건이 조여지고 글로벌 유동성 증가가 3월 이후 둔화한 것이 배수 하락의 원인이며 나머지 이야기는 가격에 맞춰 붙인 설명이라는 주장. 근거로 클라우드 영업이익률 상승(2019년 5% → 39%), 4대 클라우드 계약 잔고 약 2.5조 달러, 칩 공급 지표가 2011년 이후 가장 빡빡하다는 점, 토큰 사용량이 가격 하락보다 빠르게 는다는 점, 연산 공급 증가(연 1.8배)가 수요보다 느리다는 점. 유동성이 돌아오면 설비투자 사이클과 다시 만난다.'),
  source('Trader_Jesse_', '2117588511620784340', '2026-11-03', '매도 버튼 전에 "팔고 뭐 할 건데?": 현금 보유라면 지금 가격에서 현금이 그 자산보다 나은지(이미 조정을 거쳤다면 하락 위험과 반등 가능성을 함께), 숏 전환이라면 하락 예상과 숏으로 돈 버는 능력은 다른 문제, 다른 자산으로 갈아탄다면 위험회피 국면에서는 상관관계가 높아져 리스크가 사라지지 않는다. 매수 가격·이미 난 손실이 아니라 "지금 이 가격에서 무엇을 보유하는 것이 가장 합리적인가". 스레드: 팔았다가 싸게 다시 사려다 포지션 자체를 잃는 위험(기회비용과 재진입 위험).'),
  source('laylaperfume', '2117362559959621738', '2026-11-03', '중간선거 전 예측시장이 블루 스윕을 높게 반영하며 AI 인프라·반도체가 빠지고 헬스케어·친환경이 오르는 상황. 이미 기대가 반영된 업종을 뒤늦게 쫓지 말고, 결과 발표 뒤 실제 수급이 기술주로 돌아오는지·방어주 로테이션이 이어지는지·매도가 전체로 번지는지를 확인하라는 글. 유가가 내리는데도 기술주가 반응하지 못하면 AI 투자수익률 우려와 경기 둔화가 가격에 들어가는 신호일 수 있다. 단기 반등 포지션은 이미 청산.', [check('유가가 내려도 기술주 반등이 약함', 'CONSISTENT', 'AIO history 10/30 → 11/02: 10년물 4.93 → 4.89%로 내렸는데 나스닥 -1.07%, 반도체 ETF(SMH) 522.49 → 508.31(-2.7%)')]),
  source('lazyalphaio', '2117412265490362789', '2026-11-03', '한국장 개장 직후 시황 앱 화면: 코스피 -3.3%, 상승 종목 비율 21%, 오늘 강한 업종(제약·운송·일반서비스)과 약한 업종(기계·장비·전기전자), 오늘과 최근 20일 전환, "지수와 종목 대부분이 내리고 있어요" 한 문장 요약. 화면 구성 참고용.'),
  source('AlexZio00', '2117150968441950588', '2026-11-02', '조선·방산·기계 2027 전망 745쪽 증권사 리포트의 표지와 목차(병목은 남고 가격은 리셋). 본문은 공유되지 않아 내용은 읽지 못함.')
]);

const ref = (handle, statusId) => `${handle}-${statusId}`;
const R = {
  weekly: ref('damipov', '2117088528534532318'), zones: ref('Macaujeongc', '2117584577040728104'), bounce: ref('laylaperfume', '2117561383294587012'),
  broker: ref('Trader_Jesse_', '2117388916898832719'), per: ref('RoyPapa5', '2117540898473210128'), amd: ref('Trader_Jesse_', '2117742046299770937'),
  anet: ref('fednmad', '2117803780469326271'), credit: ref('JunDo1050', '2117559780537422297'), reasons: ref('NURadu_', '2117382738676482105'),
  liquidity: ref('RaoulGMI', '2117033551661023412'), sell: ref('Trader_Jesse_', '2117588511620784340'), vote: ref('laylaperfume', '2117362559959621738')
};

export const PACKET_20261104_FRAMES = Object.freeze([
  { id: 'correction-base-rates', path: 'chart', title: '조정이 얼마나 깊어질지: 사건 정의와 기저율, 닮은 사례', issue: '조정이 약세장으로 번진 비율과 닮은 경로', sourceRefs: [R.weekly, R.zones, R.bounce],
    answer: '1986년 이후 나스닥이 직전 최고 종가 대비 -7% 넘게 빠진 조정은 40번, 그중 -20% 약세장까지 번진 것은 8번입니다. 2026년 11월 초처럼 고점 뒤 28거래일 안에 -7%가 된 빠른 조정만 세면 32번 중 4번으로 더 낮습니다. "많이 빠졌으니 바닥"도 "차트가 무너졌으니 폭락"도 이 비율 앞에서는 인상일 뿐입니다. 하락 속도·변동성·금리·유가가 닮은 사례로 더 좁히면 깊이의 범위가 보이고, 바닥 자체는 그 뒤 바닥 확인일과 주도주로 확인합니다.',
    steps: ['사건 정의(고점 대비 %·기간)', '같은 정의로 과거 사례 전체 세기', '조건으로 좁히기(속도·변동성·금리·유가)', '닮은 사례의 깊이·기간·바닥 확인까지 걸린 날', '표본 크기와 사후 선택 점검'],
    mechanism: [
      '정의가 결과를 바꿉니다. -7%인지 -10%인지, 종가인지 장중인지, 2000년처럼 여러 해에 걸친 하락을 한 번으로 셀지 여러 번으로 셀지에 따라 "몇 번 중 몇 번"이 달라집니다. 비율은 정의와 한 묶음이고, 지금 조정에도 같은 정의를 씁니다.',
      '월봉 패턴도 정의에 따라 사례 수가 크게 달라집니다. 2005년 이후 QQQ에서 한 달의 고가가 전월 고가를 넘고 종가가 전월 저가 아래로 마감한 바깥 반전은 6번이지만, 몸통만 덮은 장악형으로 넓히면 21번이 됩니다. 그 뒤 6개월은 방향이 섞여도 변동이 컸다는 정도가 남는 정보입니다.',
      '닮은 사례는 고점 뒤 경로를 고점=100으로 맞춰 겹쳐 그리면 지금이 어느 경로 위에 있는지가 보입니다. 닮은 사례가 모두 일정 깊이 안에서 멈췄다면 그 깊이를 넘는지가 판단을 바꿀 선이 됩니다.'
    ],
    reverse: '표본이 6~40개로 작고, 1986년 이후처럼 긴 기간에는 금리·시장 구조가 전혀 다른 시기가 섞입니다. 닮은 사례를 고르는 조건을 바꾸면 결과도 바뀌어 원하는 답을 고르기 쉽습니다. 기저율이 낮아도 이번이 그 소수일 수 있고, 진행 중인 조정은 표본에 없습니다.',
    channels: ['심리'], variables: ['고점 대비 하락률', '고점 뒤 거래일', '같은 정의의 과거 사례 수', '약세장으로 번진 비율', '닮은 사례의 최대 낙폭', '저점 뒤 바닥 확인까지 걸린 날'],
    indicators: [{ label: '시장 상태 추세 칸의 고점 대비 낙폭·분배일·바닥 확인', route: 'signal', routeLabel: '시장 상태' }, { label: '투자 심리의 공포·탐욕', route: 'sentiment', routeLabel: '투자 심리' }],
    shift: '빠진 폭이나 차트 모양을 하나의 인상으로 읽던 모델에서, 사건을 숫자로 정의하고 같은 정의의 과거 빈도(기저율)와 경로가 닮은 사례를 함께 보는 모델로 전환', inputs: ['drawdown from closing high', 'days since high', 'historical event count', 'conversion to -20%', 'analog path max drawdown', 'days from low to follow-through'],
    chart: '고점=100으로 맞춘 지수 경로를 닮은 과거 조정 2~3개와 겹치고, -20% 선을 점선으로, 오른쪽에 "몇 번 중 몇 번" 숫자 한 줄', counterclaim: '표본이 작고 시대가 섞이며, 닮은 사례를 고르는 조건을 바꾸면 결과가 바뀌어 사후 선택이 쉬움', concepts: ['base-rate', 'expected-value'] },

  { id: 'cycle-top-two-clocks', path: 'industry', title: '사이클 업종 고점의 두 시계: 가속도와 부호', issue: '사이클 업종 주가 고점의 두 시계', sourceRefs: [R.broker, R.per, R.amd, R.anet, R.liquidity],
    answer: '사이클 업종 주가의 고점을 두고 두 시계가 있습니다. 가속도 시계는 증가율이 오르는 폭이 줄기 시작하면 주가가 먼저 꺾인다고 보고, 부호 시계는 증가율이 플러스인 동안은 이익을 따라 오르고 마이너스로 돌 즈음에 고점이 난다고 봅니다. 둘 중 하나를 미리 정답으로 정하지 말고, 지금 주가가 어느 시계로 움직이는지를 관측으로 가립니다. 증가율이 둔화하는데도 이익 전망이 오르고 주가가 이익을 따라가면 부호 시계 쪽, 이익 전망이 그대로인데 주가가 먼저 빠지면 가속도 시계 쪽입니다.',
    steps: ['증가율 수준과 그 월간 변화(가속도)', '증가율이 플러스로 남을 예상 기간', '선행 이익 전망의 방향(상향·하향 수)', '후행 → 선행 PER 간격', '현금흐름: 재고·매출채권·설비투자'],
    mechanism: [
      '선행 PER이 후행보다 훨씬 낮다는 것은 시장이 다음 해 이익이 크게 늘 것으로 본다는 뜻입니다. 메모리처럼 선행 PER이 3~5배로 낮으면 시장은 그 이익이 정점이고 오래가지 않는다고 할인하는 것으로 읽히고, 고점 논쟁은 "그 이익이 몇 분기 더 플러스로 이어지느냐"로 바뀝니다. 같은 층(설계·장비·네트워크·전력) 안에서 후행과 선행의 간격을 나란히 놓으면 시장이 어디에 성장을 가장 많이 기대하는지 보입니다.',
      '실적 발표에서는 매출과 이익 외에 현금흐름을 같이 봅니다. 매출이 늘어도 재고와 매출채권이 더 빨리 늘면 그 분기 잉여현금흐름이 줄고, 출하를 앞당긴 것인지 다음 분기 수요를 준비한 것인지 다음 분기에 확인해야 합니다. 반대로 설비투자가 늘어도 영업이익률이 유지되는 회사(예: 네트워크 장비)는 투자 확대가 곧 수익성 악화는 아니라는 근거가 됩니다.',
      '공급이 수요를 못 따라가는 동안(장비·전력·패키징 병목) 가격이 받쳐져 증가율이 플러스로 오래 남을 수 있고, 이때는 부호 시계가 더 잘 맞습니다. 공급이 풀리고 재고가 쌓이기 시작하면 가속도 시계가 먼저 울립니다.'
    ],
    reverse: '두 시계 모두 과거 몇 번의 사이클에서 나온 경험칙이라 이번 사이클의 성장률·자금 조달 구조에 맞지 않을 수 있습니다. 선행 PER은 애널리스트 추정치가 늦게 바뀌는 만큼 낮아 보일 수 있고, 회사마다 이익 기준(조정·GAAP)과 회계연도가 달라 층별 비교는 근사입니다. 유동성과 금리가 배수를 함께 움직이면 두 시계와 상관없이 주가가 흔들립니다.',
    channels: ['이익', '심리'], variables: ['업종 매출 전년 대비 증가율', '증가율의 월간 변화', '선행 EPS 상향·하향 수', '후행·선행 PER', '재고·매출채권 증감', '설비투자 대비 영업이익률'],
    indicators: [{ label: 'AI 공급망 묶음별 흐름', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '종목의 이익 전망·재무', route: 'fundamental', routeLabel: '재무 공시' }],
    shift: '"증가율이 고점이면 주가도 고점" 하나로 읽던 모델에서, 가속도 시계와 부호 시계를 함께 두고 이익 전망 방향·PER 간격·현금흐름으로 지금 어느 시계가 맞는지 가리는 모델로 전환', inputs: ['industry sales YoY', 'YoY change month over month', 'forward EPS revisions', 'trailing and forward P/E', 'inventory and receivables change', 'operating margin vs capex'],
    chart: '층별로 후행 PER(빈 원)과 선행 PER(채운 원)을 로그 축 위 선으로 잇고, 옆에 업종 매출 증가율 선과 그 월간 변화 막대', counterclaim: '두 시계 모두 몇 번의 과거 사이클에서 나온 경험칙이고, 추정치 지연·이익 기준 차이 때문에 선행 PER 비교는 근사이며, 유동성이 배수를 함께 움직임', concepts: ['level-vs-change', 'cyclical-per'] },

  { id: 'credit-stress-tiers', path: 'money', title: '신용 스트레스가 어느 층에 있는지: CCC → 하이일드 → 투자등급', issue: '신용 스트레스가 번지는 세 층', sourceRefs: [R.credit, R.reasons, R.liquidity],
    answer: '신용 스트레스는 보통 가장 약한 곳에서 시작합니다. 부채가 많고 현금흐름이 약한 회사, 차환이 필요한 부동산, CCC·B 등급 대출이 먼저 아프고, 하이일드 전체, 마지막으로 투자등급까지 번지면 시장 전체의 신용경색입니다. 스프레드 하나보다 세 층(CCC·하이일드·투자등급)이 벌어진 폭과 순서가 위치를 알려 줍니다. 아래층만 크게 벌어지고 투자등급이 낮게 머물면 "약한 차입자의 문제", 투자등급까지 빠르게 벌어지면 "시장 전체로 번지는 중"입니다.',
    steps: ['CCC 스프레드 변화', '하이일드 전체 변화', '투자등급 변화와 과거 범위', '번지는 경로: 차환·담보·사모신용', '해외 신호(국유·우량 발행사의 상환 실패)'],
    mechanism: [
      '금리가 높게 유지되면 만기가 돌아오는 차입자부터 이자 부담이 커집니다. 차환 대신 담보 자산을 넘기는 사례(부동산)나 신탁·사모 대출 상환 실패가 늘면, 그 대출을 들고 있는 금융기관과 펀드가 다른 자산을 팔아 손실을 메우면서 우량 채권까지 금리가 오를 수 있습니다.',
      '"정부가 뒤를 봐주니 안전하다"고 여겨지던 발행사의 상환 실패는 신용 전체의 가격을 다시 매기게 합니다. 이런 사건 뒤 우량 회사채 금리가 함께 뛰면 아래층의 문제가 위층으로 번지는 신호입니다.',
      '기업이 주식을 사들이던 돈을 투자에 돌리고 회사채·전환우선주로 자금을 모으면 주식시장은 이를 희석과 차입 증가로 읽습니다. 다만 투자등급 발행이 무난히 소화되고(주문이 발행액의 몇 배) 스프레드가 낮게 머물면 자금 조달 자체가 막힌 것은 아닙니다.'
    ],
    reverse: '투자등급 스프레드의 "위험 수준"은 고정된 숫자가 아니라 지수·만기·기간에 따라 다르고, 2020년처럼 짧고 급하게 벌어진 뒤 정책으로 바로 좁아지는 경우도 있습니다. CCC 스프레드는 소수 발행사의 부도로 크게 튈 수 있어 업종 쏠림을 함께 봐야 하고, 사모신용은 공개 가격이 없어 스프레드에 늦게 나타납니다.',
    channels: ['신용', '금리'], variables: ['CCC 스프레드', '하이일드 스프레드', '투자등급 스프레드', '세 층의 변화 폭 순서', '차환 만기와 금리', '우량 발행사의 상환 실패'],
    indicators: [{ label: '매크로의 신용 스프레드', route: 'macro', routeLabel: '매크로' }, { label: '금리·환율', route: 'fxbond', routeLabel: '금리 · 환율' }],
    shift: '스프레드 하나의 높낮이로 신용 위험을 읽던 모델에서, CCC·하이일드·투자등급 세 층의 변화 순서로 스트레스가 어디에 있고 위로 번지는지를 읽는 모델로 전환', inputs: ['CCC OAS', 'high-yield OAS', 'investment-grade OAS', 'tier widening order', 'refinancing wall', 'state-linked issuer defaults'],
    chart: '세 층 스프레드를 같은 기간에 3개월 변화 막대로 나란히, 투자등급은 과거 범위 띠 위에 현재 점', counterclaim: '투자등급의 위험 수준은 지수·기간에 따라 다르고, CCC는 소수 부도에 크게 튀며, 사모신용 스트레스는 공개 스프레드에 늦게 나타남', concepts: ['private-credit', 'refinancing'] },

  { id: 'sell-decision-alternatives', path: 'market', title: '팔고 나서 무엇을 들 것인가: 매도는 다음 보유의 선택', issue: '매도 뒤 무엇을 들 것인가', sourceRefs: [R.sell, R.vote, R.zones],
    answer: '매도는 "무엇을 그만 들까"보다 "그 대신 무엇을 들까"의 선택입니다. 현금이면 지금 가격에서 남은 하락과 반등 가능성을 견줍니다. 숏이면 하락을 맞히는 것과 숏으로 돈을 버는 것이 다른 능력입니다. 다른 자산이면 위험회피 국면에 평소 낮던 상관이 높아져 리스크가 따라올 수 있습니다. 비교 기준은 산 가격이나 이미 난 손실이 아니라 지금 가격입니다.',
    steps: ['매도 뒤 대안 셋: 현금·숏·다른 자산', '지금 가격 기준 남은 하락과 반등 가능성', '갈아탈 자산과의 위험회피 국면 상관', '재진입 조건과 기회비용', '사건(실적·선거) 뒤 실제 수급 확인'],
    mechanism: [
      '팔았다가 더 싸게 다시 사겠다는 계획은 두 번 맞혀야 합니다. 조정을 맞히고, 다시 오를 때 제때 돌아와야 합니다. 두 번째를 놓치면 장기 추세에 올라탄 포지션 자체를 잃습니다. 다시 사는 조건(가격 구간이나 확인 신호)을 팔 때 함께 적어 두면 두 번째 판단이 감정에 덜 흔들립니다.',
      '큰 사건을 앞두고는 결과를 맞히기보다 결과 뒤 돈이 어디로 가는지를 봅니다. 사건 전에 이미 기대가 가격에 들어간 업종을 뒤늦게 쫓으면 결과 발표 뒤 차익실현에 걸리기 쉽고, 반대로 과도하게 팔린 업종에는 숏커버와 저가 매수가 들어올 수 있습니다. 확인할 것은 세 갈래입니다: 기술주로 돈이 돌아오는지, 방어주 로테이션이 이어지는지, 매도가 전체로 번지는지.',
      '사는 쪽도 같은 구조입니다. 미리 고점 대비 낙폭 구간과 심리 지표 조건을 정해 두고 두세 번에 나눠 들어가면, "언제가 바닥인가"를 한 번에 맞혀야 하는 부담이 줄어듭니다. 단, 나눠 사기는 손실 한도를 함께 정해야 물타기와 구분됩니다.'
    ],
    reverse: '계속 들고 가는 것도 판단이라, 펀더멘털이 실제로 훼손된 경우에는 "재진입 위험" 논리가 손실을 키울 수 있습니다. 미리 정한 매수 구간은 지수가 그 구간을 건너뛰면 쓸모가 없고, 사건 뒤 수급 확인을 기다리는 동안 첫 움직임을 놓칠 수 있습니다.',
    channels: ['심리'], variables: ['현금 대비 기대수익', '남은 하락 위험', '갈아탈 자산과의 상관', '재진입 조건', '사건 뒤 업종별 자금 방향', '나눠 사기 구간과 손실 한도'],
    indicators: [{ label: '포트폴리오 점검', route: 'portfolio', routeLabel: '포트폴리오' }, { label: '테마·섹터 상대강도', route: 'themes', routeLabel: '테마 · 섹터' }],
    shift: '매도를 리스크 관리의 끝으로 보던 모델에서, 매도 뒤 무엇을 들지(현금·숏·다른 자산)를 지금 가격 기준으로 비교하고 재진입 조건과 사건 뒤 수급 확인을 함께 적는 모델로 전환', inputs: ['cash vs holding expected return', 'remaining downside', 'risk-off correlation', 're-entry condition', 'post-event sector flows', 'staged entry zones and loss limit'],
    chart: '보유 자산과 대안(현금·다른 자산)의 최근 상관을 평소와 위험회피 구간으로 나눠 막대 두 개로, 아래에 재진입 조건 한 줄', counterclaim: '펀더멘털이 훼손된 경우 보유 논리가 손실을 키우고, 미리 정한 구간은 시장이 건너뛰면 무용하며, 수급 확인을 기다리다 첫 움직임을 놓칠 수 있음', concepts: ['opportunity-cost', 'sunk-cost-rebuy', 'correlation'] }
].map(Object.freeze));

export const PACKET_20261104_LESSONS = Object.freeze(PACKET_20261104_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((id) => { const s = PACKET_20261104_SOURCES.find((row) => row.id === id); return { label: `${s.author} — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261104_CLAIMS = Object.freeze(PACKET_20261104_FRAMES.map((f) => Object.freeze({
  id: `claim-20261104-${f.id}`, packetId: 'packet-2026-11-04-x-bookmarks', observedOn: '2026-11-04', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '지수 종가(고점 대비 낙폭·고점 뒤 거래일·과거 사례), 업종 월 매출 증가율과 분기 실적·선행 이익 전망, 신용 스프레드 3개월 변화; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 북마크의 지수 가격 구간·기저율 수치·PER·스프레드 수준은 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['가격 구간', '기저율 수치', 'PER 수준', '스프레드 수준', '선거 확률']), status: 'FRAMEWORK_EXTRACTED'
})));
