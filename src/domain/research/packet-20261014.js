// v57.54: the 2026-10-14 owner X packet (16 posts, author threads and every image) plus three chat images.
// Commentary becomes reasoning frames and one product surface (the per-market price temperature); dated numbers stay
// dated references with a verification state, never live input. Same shape as packet-20261011.js.
const kst = (utc) => new Date(Date.parse(utc) + 9 * 3600000).toISOString().replace(/\.\d{3}Z$/, '+09:00');
const source = (handle, statusId, author, publishedAt, disposition, summary, checks = []) => Object.freeze({
  id: `${handle}-${statusId}`, author, sourceUrl: `https://x.com/${handle}/status/${statusId}`, publishedAt, publishedAtKst: kst(publishedAt),
  sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition, summary, checks: Object.freeze(checks.map(Object.freeze))
});
const image = (id, summary, disposition) => Object.freeze({ id, author: 'owner attachment', sourceUrl: '', publishedAt: '2026-10-14T00:00:00Z', publishedAtKst: '2026-10-14T09:00:00+09:00', sourceKind: 'REFERENCE', status: 'DIRECT_READ', disposition, summary, checks: Object.freeze([]) });
// checks: { claim, state: VERIFIED | CONSISTENT | UNVERIFIED, basis } — basis names the public series or filing compared on 2026-10-14.

export const PACKET_20261014_SOURCES = Object.freeze([
  source('ridajarid2', '2098337636020543700', 'Rida Jarid', '2026-09-11T09:07:32Z', 'PRINCIPLE_ONLY', '트레이딩 강좌 Article(홍보 포함): 발표치가 예상 범위의 어디에 떨어지는지로 미리 짠 시나리오 지도, 균형·불균형, 거래량 분포. 발표 전 시나리오를 적어 두는 원칙은 시장 상태 갈림길(P1743)과 같은 구조라 원칙만 참고.'),
  source('Trader_Jesse_', '2107496261494726966', 'Trader Jesse', '2026-10-06T15:40:38Z', 'REFERENCE_ONLY', '재무부 현금잔고(TGA)를 10월 말 약 1.05조 달러까지 다시 채우면 유동성이 조인다는 관점과 "거시는 남들이 공포에 빠질 때를 대비하는 도구"라는 원칙.', [
    { claim: 'TGA 10월 말 약 1.05조 달러 재축적', state: 'UNVERIFIED', basis: '전망치. AIO FRED 계열(WTREGEN) 10/7 0.88조 달러 — 관측과 전망을 섞지 않음' }
  ]),
  source('Argona0x', '2108200441955655695', 'Argona', '2026-10-08T14:18:48Z', 'PRINCIPLE_ONLY', '"개인용 블룸버그 터미널" Article(AI 도구 홍보): 모든 숫자에 출처와 시각, 오늘 움직임을 평소 하루 움직임과 비교, 백테스트 점검표(미래 정보 금지·비용·충분한 거래 수·표본 밖·단순 보유 비교·최대 낙폭). 숫자 옆 기준일과 과거 빈도 표의 사례 수·범위 표기가 이미 같은 원칙이며, 점검표는 백테스트 기각 노트로 반영.'),
  source('0xkvro', '2109617227313844693', 'kvro', '2026-10-12T12:08:36Z', 'ADOPTED', 'AI 매매 봇 Article: 승률은 기대값이 아님, 다중 검정(무작위 봇 1만 개 중 최고 샤프 약 2.3 → 새 구간 약 0), 비용 스트레스, 전진 검증, 기각 엔진. 백테스트 기각 노트(backtest-rejection)의 뼈대. 봇·자동 주문은 범위 밖.'),
  source('RohOnChain', '2109650293365305427', 'Roan', '2026-10-12T14:20:00Z', 'PRINCIPLE_ONLY', '퀀트 연구 도구 홍보 Article: 생존 편향·미래 정보, 판정(자료로 확인됨·절충·우위 없음), 변수 고원, 2015년 기준 표본 분리, 사건 전진 검증. 원칙은 백테스트 기각 노트에 합치고 도구는 도입하지 않음.'),
  source('RohOnChain', '2109708114698408422', 'Roan', '2026-10-12T18:09:45Z', 'BLOCKED', 'REA(무엇이든 역설계) MCP 소개와 연구 논문 이미지. 도구를 설치하지 않음. 이미지 3(시장 온도계)은 남의 비공개 산식을 역설계하지 않고, 공개된 가격만으로 AIO가 계산식을 밝혀 다시 만드는 방식으로 반영(지수별 가격 온도).'),
  source('ridajarid2', '2109712626049839263', 'Rida Jarid', '2026-10-12T18:27:41Z', 'ALREADY_COVERED', '펀더멘털과 기술적 분석 항목 인포그래픽. 종목 화면의 재무·차트 항목과 스크리너 열이 이미 다룸.'),
  source('amitisinvesting', '2109817302199722402', 'amit', '2026-10-13T01:23:38Z', 'REFERENCE_ONLY', '주간 리캡: 자본이 AI의 다음 제약이라는 브로드컴 CEO 발언 인용, SPY 거래량 2003년 이후 최저, 지수는 최고치에서 0.2% 안쪽인데 S&P 종목 84%가 고점 대비 10% 이상 낮음, AI 42개 종목이 2024년 이후 상승의 67%, 금 ETF 3분기 사상 최대 유입, 블랙록 미국 주식 중립 하향. 쏠림·참여 노트의 예시로만 사용.', [
    { claim: 'S&P 500이 최고치에서 0.2% 안쪽', state: 'VERIFIED', basis: 'AIO 종가 기록: 10/13 7,805.45, 최고 10/6 7,818.93(−0.17%)' },
    { claim: '자본이 AI의 다음 제약(브로드컴 CEO)', state: 'CONSISTENT', basis: '10/12 싱가포르 DBS 행사 패널 발언을 Reuters 등이 인용(10/15 재확인). 공식 녹취록은 미공개' },
    { claim: 'S&P 종목 84%가 고점 대비 −10% 이하, AI 42종목이 상승의 67%', state: 'UNVERIFIED', basis: '집계 원천 미공개' }
  ]),
  source('NURadu_', '2109830200276189561', 'Nuradu', '2026-10-13T02:14:53Z', 'ADOPTED', 'Article "7월의 데자뷰": 삼성전자 2분기·3분기 사상 최대 실적에도 주가 하락, 걱정이 메모리 정점에서 AI 투자 자금 조달로 이동, 미 10년물 5.2% 위, 광통신주 급락. 확인 네 가지(빅테크 설비투자 지침, AI 기업 수익화, 금리·신용 스프레드, 수주잔고·주문)를 병목 해소 노트에 반영.', [
    { claim: '삼성전자 3분기 잠정 영업이익 107.4조 원(직전 최대 89.4조)', state: 'VERIFIED', basis: '2026-10-08 잠정실적 공시 보도(K-IFRS 연결, 매출 195조)' },
    { claim: '미 10년물 5.2% 위', state: 'VERIFIED', basis: 'FRED DGS10 10/9 5.24%, ^TNX 10/13 5.22%' },
    { claim: '10/12 광통신주 CIEN −10%·LITE −9.8%·COHR −7.9%', state: 'UNVERIFIED', basis: '종목별 일간 등락은 대조하지 않음' }
  ]),
  source('ysh1yo2848', '2109853582061396237', 'Blue Whale', '2026-10-13T03:47:47Z', 'REFERENCE_ONLY', '코스피 투매: 10/7부터 전력기기, 이어 삼성전자·SK하이닉스, 신용잔고·미수금 반대매매 확인, 7/30 저점 대비 쌍바닥 가능성, 코스닥 상대강도 상위 종목 버팀. 쏠림·투매 노트의 투매 흔적 항목으로 반영. 투자자별 수급·신용잔고 수집은 P1671에서 퇴역해 화면에는 넣지 않음.'),
  source('NuttyCLD', '2109901309679976764', 'Nutty', '2026-10-13T06:57:26Z', 'REFERENCE_ONLY', '반도체 장비 소식 10건(ASML 부품가 인상, High-NA 대형 마스크, 8단 HBM 검토, GF 인터포저, AMAT–BESI 본딩, 삼성 400단 NAND, GAA ALD, 패키징 검사, 광 프로브·광 인터커넥트, SMIC DUV 경제성)과 장비사별 1년 주가·PER 표. 공정 단계별 역할은 기존 반도체 공정 노트와 지식 지도가 다루고, 주가·PER 표는 날짜가 붙은 참고로만 둠.'),
  source('laylaperfume', '2109908864275743225', 'Humble', '2026-10-13T07:27:28Z', 'REFERENCE_ONLY', '10/13 코스피 마감 −5.46%(6,035), SK하이닉스 7/30 저점 위 고점 상승·RSI 저점 하락(숨은 상승 다이버전스 가능성)과 200일선, 코스닥 피보나치 0.5 지지, 외국인 대량 매도. 이동평균 대비 ATR 배수 차트는 기존 차트 ATR 확장(P1507)과 같음.', [
    { claim: '코스피 10/13 종가 6,035.35(−5.46%)', state: 'VERIFIED', basis: '거래소 일봉(코스피 지수) 대조' },
    { claim: '외국인 코스피 −5조1,577억 원', state: 'UNVERIFIED', basis: '투자자별 매매 원천을 수집하지 않음(P1671)' }
  ]),
  source('DeItaone', '2109961234174890475', 'Walter Bloomberg', '2026-10-13T10:55:34Z', 'REFERENCE_ONLY', 'BofA 펀드매니저 설문 헤드라인: 주식을 꺾으려면 10년물 약 6% 필요, 기술주 비중 2020년 8월 이후 최고, 경기소비재 2008년 7월 이후 최저, 반도체 매수가 가장 붐비는 거래, 최대 위험은 무질서한 금리 급등과 AI 거품.', [
    { claim: '2026년 10월 설문 수치', state: 'UNVERIFIED', basis: '10월 원 보고서 미확인. 6~7월 설문에서 반도체 매수가 사상 최대로 붐비는 거래(80~82%)였다는 보도와는 방향이 같음' }
  ]),
  source('fednmad', '2109992398000697749', 'fednmad', '2026-10-13T12:59:24Z', 'REFERENCE_ONLY', '씨티 선물 포지셔닝: 러셀2000 매도 3년 극단, 유럽 매수 최대지만 손실 구간, 아시아(A50·코스피200) 신규 매도 급증, 닛케이 매도 92% 손실(숏 스퀴즈 취약). 포지셔닝 화면은 소유자 결정으로 제거된 상태(P1628)라 쏠림 노트의 원리만 반영.'),
  source('sshleo84', '2109996526105948603', '매크로비욘드(Sung)', '2026-10-13T13:15:48Z', 'ADOPTED', '주가 조정·이익 정점·산업 둔화의 구분, 설비투자 ≠ 반도체 매출, 병목 해소가 공급자 프리미엄을 깎는 경로(출하 +20%·단가 −15% → 매출 +2%), "돈의 방향 → 산업 → 주도주", 무효화 조건(설비투자 삭감·주문 취소·재고 증가와 단가 하락 동시 발생). 병목 해소 노트(supply-relief-margin)의 뼈대.'),
  source('tmmrwseoul', '2110009417580290297', 'Ian Lee', '2026-10-13T14:07:01Z', 'REFERENCE_ONLY', '시장 폭이 약세 극단에 들어 10월 말 평균 회귀를 예상하는 스레드. 극단 뒤 결과는 지수별 가격 온도의 과거 빈도(사례 수·평균 범위)로 확인하도록 연결하고, 날짜 예측은 쓰지 않음.')
]);

export const PACKET_20261014_IMAGES = Object.freeze([
  image('attachment-semis-value-chain-20261014', '반도체 가치사슬 지도: 설계·제조 역할, 소재 투입, 웨이퍼 공정 단계별 장비사, 공정 제어, 테스트·조립·패키징. 기존 반도체 공정 노트(semi-process)와 지식 지도의 가치사슬이 같은 구조를 다룸. 종목 매핑은 확인된 티커만 쓰는 원칙이라 그림의 회사 목록을 새 매핑으로 옮기지 않음.', 'ALREADY_COVERED'),
  image('attachment-supply-relief-timeline-20261014', '공급 부족 해소 시점 표(2026년 10월 기준): 범용 D램·니어라인 HDD 2028년 이후, FC-BGA 기판 2028년 증설 가동, 정제유 2027~2028, HBM 2027년 하반기, T-글래스 2027년 중반 이후, 서버 CPU 2027년 이후 — 근거 수·의견 갈림·고객 선지급 표시. 병목 해소 노트의 날짜 붙은 예시로만 사용하고 현재값으로 승격하지 않음.', 'REFERENCE_ONLY'),
  image('attachment-market-thermometer-20261014', '시장별 심리 온도계(CNN 46, 나스닥 52, 코스피 7·5일째 극단 공포, 코스닥 24, 닛케이 38)와 코스피 온도 10년 차트. 산식이 비공개라 같은 값을 만들 수 없음. 가격만으로 다섯 요소를 최근 3년 순위로 바꾸고 3개 이상이 하위 10%면 극단 저온으로 보는 AIO 계산(지수별 가격 온도)으로 반영: 같은 날 코스피 극단 저온, 코스닥 저온 쪽, 나스닥 중간으로 방향은 비슷하고 닛케이는 차이가 큼.', 'ADOPTED')
]);

const id = (handle) => PACKET_20261014_SOURCES.find((row) => row.id.startsWith(`${handle}-`)).id;
const SUNG = id('sshleo84'), NURADU = id('NURadu_'), KVRO = id('0xkvro'), ROH = 'RohOnChain-2109650293365305427', ARGONA = id('Argona0x'), AMIT = id('amitisinvesting'), WHALE = id('ysh1yo2848'), DELTA = id('DeItaone'), FED = id('fednmad'), IAN = id('tmmrwseoul');

export const PACKET_20261014_FRAMES = Object.freeze([
  { id: 'supply-relief-margin', path: 'market', title: '병목 해소와 공급자 프리미엄', issue: '주가 조정·이익 정점·산업 둔화의 구분과 병목 해소의 이익 경로', sourceRefs: [SUNG, NURADU],
    answer: '반도체 주가가 빠질 때 세 가지는 서로 다른 사건입니다. 가격만 조정된 것인지, 이익 증가율이 정점을 지난 것인지, 산업 수요가 꺾인 것인지에 따라 같은 하락도 뜻이 다릅니다. 병목이 풀리면 물량은 늘어도 단가가 먼저 내려가 공급자의 초과 이익이 줄어들 수 있습니다.',
    steps: ['조정·이익 정점·산업 둔화 구분', '고객 설비투자 → 공급자 매출 몫', '출하량 × 단가 분해', '증설 가동 시점과 선지급 계약', '설비투자 삭감·주문 취소·재고↑·단가↓ 동시 발생 확인'],
    mechanism: [
      '빅테크의 설비투자가 늘어도 그 돈이 모두 반도체 매출이 되지는 않습니다. 건물·전력·네트워크로 나뉘고, 반도체 안에서도 GPU·메모리·기판·장비로 다시 나뉩니다. 설비투자 증가율과 특정 공급자의 매출 증가율은 같은 숫자가 아니어서, 층별 몫과 계약 시점을 따로 봐야 합니다.',
      '공급이 부족한 동안 공급자는 물량보다 단가로 돈을 법니다. 증설이 가동돼 부족이 풀리면 출하는 늘어도 단가가 먼저 내려갑니다. 출하가 20% 늘고 단가가 15% 내리면 매출은 1.20 × 0.85 = 1.02, 2% 늘 뿐입니다. 이익률이 높던 공급자일수록 단가 하락이 이익에 크게 작용합니다.',
      '그래서 부족이 언제 풀리는지가 관건입니다. 2026년 10월에 돌던 추정은 범용 D램 2028년 이후, FC-BGA 기판 2028년 증설 가동, HBM 2027년 하반기처럼 품목마다 달랐습니다. 이런 일정은 고객 선지급·장기계약이 얼마나 붙었는지와 함께 보고, 새 발표가 나오면 바꾸는 참고값입니다.',
      '자금 조달이 새 걱정이 된 국면(2026년 10월, 미 10년물 5.2%대)에서는 네 가지를 함께 봅니다. 빅테크 설비투자 지침, AI 기업의 실제 수익화, 금리와 신용 스프레드, 수주잔고와 신규 주문입니다. 넷이 함께 나빠질 때 이익 정점이 산업 둔화로 넘어갑니다.'
    ],
    example: { inputs: ['가상 공급자 출하 100, 단가 10 → 매출 1,000', '증설 가동 후 출하 +20%', '단가 −15%'], steps: ['새 매출 = 120 × 8.5 = 1,020', '매출 증가율 = 1,020 ÷ 1,000 − 1 = 2%'], result: '출하가 20% 늘어도 매출은 2% 느는 데 그칩니다. 고정비가 같다면 이익률은 단가 하락만큼 더 크게 줄 수 있습니다.' },
    reverse: '수요가 공급보다 빨리 늘거나 고객이 선지급·장기계약으로 물량을 묶으면 증설이 가동돼도 단가가 버틸 수 있습니다. 설비투자 지침 삭감, 주문 취소, 재고 증가와 단가 하락이 한꺼번에 나타날 때 판단을 산업 둔화 쪽으로 옮깁니다.',
    channels: ['단가', '매출', '투자'], variables: ['고객 설비투자 지침과 반도체 몫', '출하량과 판매단가(ASP)', '재고 일수', '증설 가동 시점', '선지급·장기계약 비중'],
    indicators: [{ label: '공급망 층별 역할과 이익 변수', route: 'atlas', routeLabel: '지식 지도' }, { label: '반도체·메모리 테마의 상대강도', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '종목별 Forward PER와 예상 이익 증가율', route: 'screener', routeLabel: '스크리너' }],
    shift: '설비투자 증가를 공급자 이익 증가로 곧장 옮기던 모델에서 층별 몫·출하×단가·해소 시점으로 나누는 모델로 전환', inputs: ['hyperscaler capex guidance', 'shipments', 'ASP', 'inventory days', 'capacity ramp dates', 'prepayment and long-term agreements'],
    chart: '출하량·단가·매출을 같은 분기 축에 나란히; 해소 시점은 날짜가 붙은 참고 표', counterclaim: '선지급과 장기계약이 단가 하락을 늦출 수 있고, 새 병목(전력·기판·광학)이 다른 층의 프리미엄을 만들 수 있음', concepts: ['price-volume-mix', 'capex', 'cyclical-per'] },
  { id: 'backtest-rejection', path: 'foundation', title: '백테스트를 기각하는 순서', issue: '많이 시험할수록 그럴듯한 가짜 우위가 쉬워지는 다중 검정 문제', sourceRefs: [KVRO, ROH, ARGONA],
    answer: '전략을 100개 시험해 가장 좋은 하나를 고르면, 아무 우위가 없어도 성적이 좋아 보이는 전략이 나옵니다. 동전 던지기로 매매하는 가상 봇 1만 개 중 최고 성적은 과거 구간에서 샤프 지수 약 2.3을 냈지만 새 구간에서는 평균 0으로 돌아갔다는 가상 실험이 그 예입니다. 좋은 검증은 찾는 과정보다 기각하는 과정이 깁니다.',
    steps: ['시험한 전략 수 기록', '거래당 기대값', '비용 두 배 스트레스', '표본 밖·전진 검증', '생존 편향·미래 정보 제거', '단순 보유·최대 낙폭 비교'],
    mechanism: [
      '승률은 기대값이 아닙니다. 90%를 맞히고 맞힐 때 10을 벌다 틀릴 때 100을 잃으면 거래당 기대값은 0.9 × 10 − 0.1 × 100 = −1입니다. 40%만 맞혀도 맞힐 때 150, 틀릴 때 50이면 0.4 × 150 − 0.6 × 50 = +30입니다. 평균 이익·평균 손실·거래 비용을 함께 봐야 우위가 보입니다.',
      '같은 기간 자료로 변수를 고르고 같은 기간 성적으로 평가하면 과거에만 맞는 모델이 됩니다. 앞 구간에서 변수를 정해 고정하고 다음 구간에서 평가하는 전진 검증, 상장폐지 종목을 뺀 생존 편향과 발표 전에 알 수 없던 값을 쓴 미래 정보를 걷어 내야 합니다. 비용을 두 배로 올렸을 때 사라지는 우위는 실제로 남기 어렵습니다.',
      'AIO의 과거 빈도 표도 같은 원칙을 따릅니다. 과거에 비슷했던 날 뒤의 결과를 보여 줄 때 사례 수와 평균의 범위(±)를 함께 적고, 범위가 겹치면 차이가 구별되지 않는다고 씁니다. 변수를 조금 바꿔도 성적이 비슷한 넓은 고원이 좁은 봉우리보다 믿을 만합니다.'
    ],
    example: { inputs: ['가상 전략 240회 거래', '과거 구간 샤프 2.31', '비용 두 배 샤프 0.41', '표본 밖 샤프 −0.24'], steps: ['과거 성적 통과', '비용 스트레스에서 대부분 소멸', '표본 밖 실패 → 기각'], result: '과거 성적이 뛰어나도 비용과 새 구간을 견디지 못하면 기각합니다. 기각 기록도 시험한 전략 수와 함께 남깁니다.' },
    reverse: '변수 범위 전체에서 성적이 비슷하고, 비용 두 배와 여러 표본 밖 구간에서도 우위가 남으며, 경제적 이유가 설명되는 전략은 실제 우위일 가능성이 높아집니다. 그래도 과거 분포일 뿐 미래 수익의 보장은 아닙니다.',
    channels: ['비용', '현금'], variables: ['시험한 전략 수', '거래당 기대값', '비용 두 배 성적', '표본 밖 성적', '최대 낙폭·단순 보유 대비'],
    indicators: [{ label: '과거 빈도 표의 사례 수와 평균 범위', route: 'signal', routeLabel: '시장 상태' }, { label: '극단 구간 뒤 결과의 범위', route: 'sentiment', routeLabel: '투자 심리' }],
    shift: '가장 좋은 백테스트를 고르는 모델에서 시험 수·비용·표본 밖으로 기각하는 모델로 전환', inputs: ['number of trials', 'expectancy', 'cost stress', 'walk-forward', 'survivorship', 'look-ahead', 'max drawdown versus buy-and-hold'],
    chart: '변수 격자별 성적 열지도(고원 대 봉우리)와 비용 단계별 성적 선', counterclaim: '엄격한 기각은 기록이 짧은 진짜 우위를 놓칠 수 있고, 시장 구조가 바뀌면 과거의 실패가 유효해질 수도 있음', concepts: ['expected-value', 'base-rate', 'correlation'] },
  { id: 'crowding-breadth-extreme', path: 'market', title: '쏠림과 투매를 구분하는 확인', issue: '지수 신고가 아래의 좁은 참여, 포지션 쏠림, 투매의 흔적', sourceRefs: [AMIT, DELTA, FED, WHALE, IAN],
    answer: '지수가 최고치 근처인데 대부분의 종목이 각자의 고점에서 멀다면 시장은 소수 종목의 힘으로 서 있습니다. 급락장에서 강제 매도와 대량 매도가 겹친 뒤 지수가 앞선 저점을 지키면 투매가 끝나 가는 흔적일 수 있습니다. 둘 다 심리의 극단이지만 확인하는 지표가 다릅니다.',
    steps: ['지수와 종목 참여의 괴리', '포지션 쏠림(설문·선물 포지션)', '강제 매도 흔적(신용·미수 반대매매)', '앞선 저점 방어와 가격 온도', '극단 뒤 과거 결과의 범위'],
    mechanism: [
      '2026년 10월 중순 S&P 500은 최고치에서 0.2% 안쪽이었지만 종목 대다수가 각자의 고점보다 10% 이상 낮고, AI 관련 소수 종목이 상승의 대부분을 만들었다는 집계가 돌았습니다. 지수만 보면 강세장, 종목을 보면 조정장입니다. 이 괴리는 주도주가 흔들릴 때 지수가 빠르게 따라 내려갈 수 있다는 뜻입니다.',
      '쏠림은 포지션으로 확인합니다. 펀드매니저 설문에서 반도체 매수가 가장 붐비는 거래로 꼽히거나 선물 포지션에서 특정 지수의 매도가 극단에 몰리면, 작은 뉴스에도 반대 방향 청산이 크게 일어날 수 있습니다. 붐비는 쪽은 실망에 약하고 몰린 매도는 반등에 약합니다.',
      '투매는 가격과 수급으로 확인합니다. 신용 반대매매와 대량 매도로 지수가 급락한 뒤 앞선 저점을 지키고 가격 온도가 극단 저온에 들어가면 매도 압력이 소진되는 흔적입니다. 다만 AIO 계산에서 극단 저온 뒤 석 달 평균은 아무 날의 평균과 범위가 겹쳐, 이를 바닥의 증거로 쓰지 않습니다.'
    ],
    example: { inputs: ['가상 지수 최고치 대비 −0.2%', '구성 종목 100개 중 84개가 각자 고점 대비 −10% 이하', '상위 소수 종목이 상승분의 3분의 2'], steps: ['지수 낙폭 −0.2%와 종목 중앙값 낙폭을 나란히 기록', '동일가중 지수·참여율 추세 확인'], result: '지수 신고가를 넓은 강세로 읽지 않고, 주도주가 실망을 주면 하방 위험이 큰 좁은 시장으로 기록합니다.' },
    reverse: '참여 종목이 늘고 동일가중 지수가 함께 오르면 좁은 시장 우려는 약해집니다. 급락 뒤 앞선 저점이 깨지고 강제 매도가 이어지면 투매 소진 가설은 버립니다.',
    channels: ['현금', '투자'], variables: ['지수 낙폭 대 종목 중앙값 낙폭', '동일가중·시가총액가중 차이', '포지션 쏠림(설문·선물)', '신용잔고·반대매매', '앞선 저점과 가격 온도'],
    indicators: [{ label: '참여 종목과 지수의 같은 기간 추이', route: 'breadth', routeLabel: '시장 폭' }, { label: '지수별 가격 온도와 심리 카드', route: 'sentiment', routeLabel: '투자 심리' }],
    shift: '지수 수준 하나로 강세·약세를 판정하던 모델에서 참여·포지션·강제 매도를 나눠 보는 모델로 전환', inputs: ['index versus median drawdown', 'equal versus cap weight', 'fund manager survey crowding', 'futures positioning', 'margin liquidation', 'price temperature'],
    chart: '지수와 종목 중앙값 낙폭을 나란히, 극단 구간 음영', counterclaim: '좁은 시장도 오래 이어질 수 있고, 투매 흔적 뒤에 2차 하락이 오는 경우도 많음', concepts: ['base-rate', 'correlation', 'expected-value'] }
].map(Object.freeze));

const allSources = [...PACKET_20261014_SOURCES, ...PACKET_20261014_IMAGES];
export const PACKET_20261014_LESSONS = Object.freeze(PACKET_20261014_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps },
  sources: f.sourceRefs.map((ref) => { const s = allSources.find((row) => row.id === ref); return { label: `${s.author} — ${s.publishedAtKst.slice(0, 10)} 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));

export const PACKET_20261014_CLAIMS = Object.freeze(PACKET_20261014_FRAMES.map((f) => Object.freeze({
  id: `claim-20261014-${f.id}`, packetId: 'packet-2026-10-14', observedOn: '2026-10-14', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: `${f.title} — ${f.issue}`,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '분기 실적·계약 일정과 가격 세션을 구분; 날짜가 붙은 예시는 그 날짜의 관측', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 게시물의 가격·수급·설문·일정은 현재 데이터로 승격하지 않음. 확인 상태는 sources[].checks에 기록.',
  transientElements: Object.freeze(['지수·종목 등락', '투자자별 순매수', '설문 비율', '공급 부족 해소 시점', '포지션 손익']), status: 'FRAMEWORK_EXTRACTED'
})));
