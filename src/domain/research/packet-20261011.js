// P1605: directly read commentary becomes a reasoning protocol, never live numeric input.
const source = (id, author, publishedAtKst, summary, relatedUrls = []) => Object.freeze({ id, author, sourceUrl: `https://x.com/${author === 'Nuradu' ? 'NURadu_' : author === 'Humble' ? 'laylaperfume' : 'Trader_Jesse_'}/status/${id.split('-').at(-1)}`, publishedAtKst, sourceKind: 'REFERENCE', status: 'DIRECT_READ', summary, relatedUrls: Object.freeze(relatedUrls), accessBoundary: '원문과 공개된 작성자 후속 글 확인. 로그인 뒤 숨은 답글·이후 수정은 전수 확인하지 못함.', observedOn: '2026-10-11' });
export const PACKET_20261011_SOURCES = Object.freeze([
  source('Nuradu-2108953697267208335', 'Nuradu', '2026-10-11T01:11+09:00', '신용 등급별 분산, 차환·현금의 시간차, 환매 요청과 지급, 투자·상거래 관계 중첩과 법인 책임 범위'),
  source('Trader-Jesse-2108759022228865361', 'Trader Jesse', '2026-10-10T12:18+09:00', '분석별 역할을 나누고 충돌하는 정보의 중요도를 판단하는 올라운드 사고와 리스크 관리', ['https://x.com/Trader_Jesse_/status/2108759024422535532', 'https://x.com/Trader_Jesse_/status/2108759026209263774', 'https://x.com/Trader_Jesse_/status/2108771717338534355', 'https://x.com/Trader_Jesse_/status/2108751351383761215', 'https://x.com/Trader_Jesse_/status/2107607642776686909']),
  source('Humble-2108920033439305817', 'Humble', '2026-10-10T22:58+09:00', '측정 범위 비교, 업종 순환과 시장 폭, 수주·생산능력·CAPEX 및 발표 후 반응으로 가설을 재검토', ['https://x.com/laylaperfume/status/2108924280973168706'])
]);

const N = PACKET_20261011_SOURCES[0].id, J = PACKET_20261011_SOURCES[1].id, H = PACKET_20261011_SOURCES[2].id;
export const PACKET_20261011_FRAMES = Object.freeze([
  { id: 'credit-distribution-refinancing', path: 'money', title: '평균 신용과 취약 차주의 시간', issue: '평균이 감추는 신용 분산과 차환의 시간차', sourceRefs: [N],
    answer: '시장 전체의 신용 스프레드가 안정돼도 가장 약한 차주의 자금조달은 먼저 막힐 수 있습니다. 산업의 성장성과 그 성장이 현금으로 돌아올 때까지 버틸 능력은 별개의 질문입니다.',
    steps: ['전체·등급별 스프레드 분리', '차주의 만기와 현금 회수 시점', '신규 집행·기존 한도 인출', '차환·희석·신용 전염 확인'],
    mechanism: ['전체 하이일드 평균과 BB·B·CCC의 분포를 같은 관측일·같은 정의로 비교합니다. CCC만 악화되는 국면과 B·BB까지 동반 악화되는 국면은 전염 범위가 다릅니다. OAS는 옵션 효과를 조정한 시장 스프레드이고 채권 유효수익률은 시장 가격에 반영된 수익률입니다. 둘 다 특정 기업의 신규 대출금리와 같지 않습니다.', '수주→납품·검수→대금 회수와 이자·급여·부채 만기를 각각 시간축에 놓습니다. 은행이나 펀드의 유동성이 충분해도 차주별 담보·조건·만기 연장 선별은 강화될 수 있습니다. 신규 집행 감소와 기존 리볼버 인출 증가가 겹쳐도 수요 둔화·선별 강화라는 대안 설명을 함께 확인해야 합니다.', 'PIK는 현금 이자를 원금에 얹는 계약 방식이며 그 자체로 부도는 아닙니다. non-accrual 비중은 원가와 공정가치 분모를 분리해야 합니다. 회사가 증자로 생존해도 기존 주주 지분은 희석될 수 있어 기업 생존과 주주 성과를 구분합니다. 개인의 현금 여유도 투자 논거가 확인되기 전 생활비 때문에 선택을 강요받는 시간을 줄이는 역할입니다.'],
    example: { inputs: ['가상 차주 현금 30', '만기까지 회수 현금 20', '그 전 이자·운영비·원금 70'], steps: ['그 시점의 조달 부족 = 70 − 30 − 20 = 20'], result: '그 뒤 수주가 커도 오늘의 부족 20을 없애지는 못합니다. 만기 연장·증자·담보 조건은 따로 확인합니다.' },
    reverse: '등급별 악화가 멈추고 현금 회수·만기 분산·확정된 조달 여력이 개선되면 같은 성장 투자도 유동성 부담을 낮출 수 있습니다. 등급별·차주별 자료가 없으면 위기나 안전을 판정하지 않습니다.',
    channels: ['현금', '비용'], variables: ['등급별 OAS와 관측일', '향후 12~24개월 만기', 'FCF·이자 지급능력', '신규 집행·기존 한도 인출', 'PIK·non-accrual의 평가 분모'], indicators: [{ label: '금리·신용의 공개된 추이 확인 — 등급별·사모신용 상세는 원공시 별도 확인', route: 'fxbond', routeLabel: '금리 · 환율' }, { label: '기업의 현금흐름과 부채 공시', route: 'fundamental', routeLabel: '재무 공시' }],
    shift: '전체 평균으로 위기를 예언하는 모델에서 취약 차주·만기·자금 공급의 전염 경로를 추적하는 모델로 전환', inputs: ['rating OAS', 'debt maturity', 'FCF', 'PIK', 'non-accrual cost/fair-value denominator'], chart: '등급별 동일 일자 시계열과 CCC−B 차이, 만기·대금회수 사건창', counterclaim: '대출 집행 감소는 차주 수요 둔화나 포트폴리오 선별 강화일 수 있으며 펀드의 현금 고갈을 뜻하지 않음' },
  { id: 'financing-perimeter-overlap', path: 'business', title: '투자와 매출이 겹치는 자금 구조', issue: '거래 관계의 중첩과 법인별 손실 책임', sourceRefs: [N, H],
    answer: '고객에게 투자하는 공급자는 투자 가치와 매출을 함께 얻지만, 고객이 흔들릴 때는 두 경로에서 충격을 받을 수 있습니다. 이 연결이 존재한다는 사실과 같은 돈을 돌려 썼다는 증명은 다릅니다.',
    steps: ['법인·펀드·SPV 구분', '투자·대출·구매·임대 연결', '보증·소구·담보 책임', '수요 충격의 두 경로'],
    mechanism: ['관계를 그릴 때 노드는 간판 이름이 아니라 실제 계약 주체입니다. 투자·대출·구매·임대·보증은 서로 다른 연결이고, 연결 강도는 실제 금액과 계약 범위가 있어야 알 수 있습니다. 공개된 거래 총액에 어떤 투자자가 참여했다는 통계는 그 투자자가 실제 낸 금액의 비중이 아닙니다.', '고객 수요가 강하면 고객의 자금조달→설비 구매→공급자 매출과 투자 가치가 함께 늘어납니다. 약해지면 주문·가동률·잔존가치와 투자 자산 가치가 동시에 낮아질 수 있습니다. 공급자의 가격 결정력과 고객의 현금 수익화가 이 연결을 지속시킬 수 있는지를 구분합니다.', '데이터센터 JV나 SPV의 차입을 모회사 부채로 곧바로 합산하지 않습니다. 소구 여부, 잔존가치 보증의 상한·기간·조건, 임차 의무를 공시에서 확인합니다. 펀드가 버틸 수 있다는 사실도 차주에게 새 자금이 계속 공급된다는 뜻은 아닙니다.'],
    example: { inputs: ['가상 거래 전체 100', '투자자 A·B가 함께 참여', '개별 출자액 미공개'], steps: ['A 참여 거래 총액 = 100', 'A 실제 출자액 = 미확인'], result: '참여 거래 총액 100을 A의 실제 출자금 100으로 바꾸지 않습니다.' },
    reverse: '분산된 고객·제한된 보증·장기 계약·충분한 현금 수익화가 확인되면 관계 중첩은 효율적인 조달 구조일 수 있습니다. 계약 주체와 책임이 불명확하면 손실 규모와 파산 연쇄를 추정하지 않습니다.',
    channels: ['매출', '투자', '현금'], variables: ['투자자·고객·공급자 연결', '실제 출자액과 발표 거래총액', 'SPV·소구·보증 상한', '가동률·임차·잔존가치'], indicators: [{ label: '투자·부채·보증은 해당 법인의 공시에서 확인', route: 'fundamental', routeLabel: '재무 공시' }, { label: 'AI 공급망의 역할과 수익 경로', route: 'atlas', routeLabel: '지식 지도' }],
    shift: '같은 간판을 한 장부로 보는 모델에서 계약 주체와 관계 종류별 책임을 분리하는 모델로 전환', inputs: ['legal entity', 'investment and commerce edges', 'announced deal denominator', 'recourse', 'guarantee cap'], chart: '법인별 투자·상거래·보증 관계도; 실금액 미공개 연결의 가중치는 보류', counterclaim: '관계 중첩은 효율적인 조달일 수 있으며 자금 순환 사기나 즉각적인 전염을 입증하지 않음' },
  { id: 'measurement-scope-comparison', path: 'accounting', title: '숫자를 비교하기 전에 맞출 범위', issue: '측정 기준 변경과 실제 실적 변화의 구분', sourceRefs: [N, H],
    answer: '같은 매출·환매·부실이라는 이름 아래에서도 기간과 분모가 달라질 수 있습니다. 숫자가 달라진 원인을 성과 변화로 해석하기 전에 두 숫자가 같은 대상을 재는지 확인해야 합니다.',
    steps: ['기간·통화·법인·분모', '예상·실제·이전과 수정본', '집계 범위의 차이 제거', '동일 기준에서 변화 해석'],
    mechanism: ['매출 run-rate는 특정 시점의 속도를 연환산한 값이고 회계연도 매출은 그 기간에 실제 인식한 합계입니다. 직접 판매와 파트너 경유 판매의 포함 범위, 총액·순액 인식, 법인 연결 범위가 다르면 숫자 차이를 매출 감소로 읽을 수 없습니다. 같은 기준으로 재작성할 자료가 없으면 비교 결론을 보류합니다.', '환매 요청에는 이전에 처리되지 않은 반복 요청이 포함될 수 있습니다. 실제 지급과 신규 유입의 차이가 순유출이며, 전체 발행주식 대비 지급 한도와 요청주식 대비 처리율도 서로 다른 분모입니다. non-accrual은 평가 손실로 공정가치 분모가 달라질 수 있어 원가 기준과 방향이 반대로 보일 수 있습니다.', '국채 입찰은 날짜·만기·CUSIP·재개 발행 여부가 사건 식별자입니다. 경제지표는 actual·consensus·prior·수정값 및 잠정·확정 상태를 나누고, 실적은 분기·누적·QoQ·YoY를 구분합니다. 헤드라인의 해석과 수치 원문을 분리하면 기준 변경을 경제 충격으로 오인하는 일을 줄일 수 있습니다.'],
    example: { inputs: ['가상 전체 주식 100', '환매 요청 20', '실제 지급 5', '신규 유입 4(동일 가치 단위 가정)'], steps: ['요청률 = 20 ÷ 100 = 20%', '요청 처리율 = 5 ÷ 20 = 25%', '지급 비중 = 5 ÷ 100 = 5%', '순유출 = 5 − 4 = 1'], result: '20% 요청률을 20% 자금 유출로 표시하면 안 됩니다. 실제 데이터에서는 주식 수와 현금 평가 단위도 맞춰야 합니다.' },
    reverse: '기간·연결 범위·통화·분모가 일치한 수정 원문에서도 감소가 남으면 실제 악화를 검토할 수 있습니다. 기준 차이라는 설명 역시 원문 대사 없이 면죄부로 사용할 수 없습니다.',
    channels: ['매출', '현금'], variables: ['회계기간·연환산 시점', '총액·순액·채널 범위', '분모·평가 기준', '잠정·확정·수정본', '사건 식별자와 관측 시각'], indicators: [{ label: '실적의 기간·통화·공시 원문', route: 'fundamental', routeLabel: '재무 공시' }, { label: '일정·기대와 발표 결과', route: 'briefing', routeLabel: '브리핑' }],
    shift: '같은 이름의 숫자를 바로 비교하는 모델에서 측정 정의를 대사한 뒤 변화를 해석하는 모델로 전환', inputs: ['period', 'currency', 'entity perimeter', 'denominator', 'run-rate', 'actual/consensus/prior', 'revision'], chart: '동일 사건·기간·단위로 actual/consensus/prior를 나란히 비교; 정의가 다른 값은 분리', counterclaim: '집계 기준 차이가 존재해도 같은 기준으로 다시 비교한 실적은 실제 악화일 수 있음' },
  { id: 'evidence-role-conflict', path: 'market', title: '충돌하는 증거를 제자리에 놓기', issue: '분석의 개수와 판단의 질을 구분하는 사고 순서', sourceRefs: [J, N, H],
    answer: '신용은 취약 차주를 경고하면서 주도 기업의 실적과 가격 추세는 강할 수 있습니다. 서로 다른 대상과 기간을 설명하는 증거를 한 점수로 평균내면 이 구조가 사라집니다.',
    steps: ['주장·대상·기간 명시', '환경·기업·가격·기대 구분', '충돌의 이유와 대안 설명', '논거를 약화할 관측 조건'],
    mechanism: ['거시는 조달 환경과 할인율, 기업 실적은 수익 구조, 차트는 실제 가격의 수용·거부, 수급은 참여의 범위, 심리·포지셔닝은 기대와 취약성을 설명합니다. 가격 상승만으로 자금 유입을 확정하지 않고, 설문 심리만으로 실제 포지션을 확정하지 않습니다.', '신호가 모두 일치할 때까지 기다리는 것이 유일한 판단 방법은 아닙니다. 먼저 설명하려는 질문과 기간을 고정하고, 그 질문을 직접 뒷받침하는 증거·반대 증거·아직 없는 입력을 나란히 놓습니다. 증거의 최신성·정의·직접성에 따라 중요도를 설명하되 근거 없는 가중 점수나 합성 등급은 만들지 않습니다.', '오래 올랐다는 사실은 하락의 원인이 아니며 숨은 수혜주를 억지로 연결하는 것도 인과 관계가 아닙니다. 주문→매출→현금의 실제 경로와 이미 가격에 반영된 기대를 확인합니다. 논거가 맞더라도 확인까지 필요한 기간과 유동성 부담이 다를 수 있으므로 해석의 기간과 무효화 조건을 함께 기록합니다.'],
    example: { inputs: ['가상 환경: 조달 부담', '기업: 현금 실적 개선', '가격: 추세 유지', '참여: 소수 집중'], steps: ['환경 부담 ≠ 해당 기업 실적 악화', '가격 추세 유지 ≠ 시장 전체의 안전', '확인할 변화: 현금·주문 악화 또는 참여 확산'], result: '혼합된 증거를 그대로 설명하고 어떤 관측이 논거를 바꿀지 기록합니다.' },
    reverse: '기업 현금과 가격 수용이 함께 약해지고 부담이 여러 등급·업종으로 확산되면 같은 질문에 대한 반대 증거가 강해집니다. 수급·심리 자료가 없으면 가격만으로 그 항목을 채우지 않습니다.',
    channels: ['현금', '매출'], variables: ['주장 대상·기간', '직접 근거와 대안 설명', '실적·가격 수용·참여', '기대와 실제 포지셔닝', '무효화 조건·확인까지의 시간'], indicators: [{ label: '같은 종목의 가격과 실적 확인', route: 'ticker', routeLabel: '종목' }, { label: '시장 환경과 참여의 분리', route: 'signal', routeLabel: '시장 상태' }],
    shift: '모든 신호의 합의나 점수 평균을 기다리는 모델에서 질문별 역할과 반증 경로를 설명하는 모델로 전환', inputs: ['scope and horizon', 'macro', 'company cash flows', 'price acceptance', 'participation', 'positioning'], chart: '같은 기간의 기업·시장 증거를 병렬 표시; 상반된 축은 합산하지 않음', counterclaim: '리스크 확대와 강한 주도주 추세는 동시에 성립할 수 있으며 모든 축 일치가 필수는 아님' },
  { id: 'rotation-bottleneck-confirmation', path: 'market', title: '순환매와 위험회피를 구분하는 확인', issue: '섹터 조정·시장 폭과 AI 병목 전이의 구분', sourceRefs: [H, J],
    answer: '한 업종이 쉬는 동안 다른 업종이 참여하면 순환일 수 있고, 참여가 함께 줄면 위험회피일 수 있습니다. AI의 관심 이동도 정해진 순서가 아니라 실제 공급 제약과 현금 수익화로 확인해야 합니다.',
    steps: ['동일 기간 업종·지수 비교', '동일가중·소형주·금융의 참여', '주문·가동률·CAPEX 확인', '발표 후 가격·금리의 반응'],
    mechanism: ['시장가중 지수, 동일가중 지수, 소형주와 금융 업종을 동일 기간·가격 조정 기준으로 비교합니다. 대표 종목 몇 개의 강세는 업종 전체 강세나 시장 폭의 회복을 증명하지 않습니다. 금융 ETF 반등도 금융기관의 신용 건전성을 직접 측정하는 값은 아닙니다.', 'AI 계산·메모리·패키징·광학·네트워크·전력은 상호 의존하는 공급망입니다. 주목받는 층이 옮겨갈 수 있지만 반드시 그 순서로 수혜가 발생하는 것은 아닙니다. 신규 수주, 고객의 투자 계획, 생산능력과 가동률, CoWoS 증설, 납기·취소 조건을 확인하고 공급 확대로 병목 프리미엄이 줄어드는 반대 경로를 검토합니다.', '물가 안정→금리 완화→참여 확산은 조건부 시나리오입니다. 발표된 실적·가이던스와 발표 후 금리·가격 반응으로 각 연결을 다시 확인합니다. 고점의 갭 하나로 미완성 반전 패턴을 단정하지 않으며 주요 구간을 회복하거나 이탈 후 복귀에 실패한 실제 종가를 구분합니다.'],
    example: { inputs: ['가상 업종 A −2%', '시장가중 +1%', '동일가중 +2%', '소형주 +1%(같은 기간·기준)'], steps: ['A의 약세만으로 시장 전체 하락을 판정하지 않음', '참여 종목 비율·기간별 지속성 추가 확인'], result: '순환 가능성을 기록할 수 있지만 추세 전환 완료나 순자금 유입을 확정하지 않습니다.' },
    reverse: '동일가중·소형주가 함께 약해지고 참여가 줄면 광범위 조정이라는 대안이 강해집니다. 수주 취소·가동률 하락·CAPEX 축소가 확인되면 병목의 지속 가설도 다시 검토합니다.',
    channels: ['매출', '투자', '현금'], variables: ['같은 기간 업종·동일가중 비교', '상승 참여 종목 비율', '수주·가동률·납기·취소', 'CAPEX·CoWoS 생산능력', '발표 이후 금리·가격 반응'], indicators: [{ label: '참여 종목과 지수의 같은 기간 추이', route: 'breadth', routeLabel: '시장 폭' }, { label: '업종·테마의 상대강도', route: 'themes', routeLabel: '테마 · 섹터' }, { label: '공급망의 역할과 이익 변수', route: 'atlas', routeLabel: '지식 지도' }],
    shift: '특정 섹터 조정과 예정된 병목 순서를 전체 시장 결론으로 확대하는 모델에서 참여와 실수요를 검증하는 모델로 전환', inputs: ['equal-weight versus cap-weight', 'small caps', 'breadth', 'orders and utilization', 'CAPEX', 'post-event response'], chart: '같은 기간 업종/지수 비교와 가격·거래량·완성/미완성 구조; 선물과 현물은 분리', counterclaim: '강한 내러티브와 주가 조정은 공존할 수 있으며 공급 확대로 병목 이익이 줄어들 수 있음' }
].map(Object.freeze));

export const PACKET_20261011_LESSONS = Object.freeze(PACKET_20261011_FRAMES.map((f) => Object.freeze({
  ...f, figure: { kind: 'flow', steps: f.steps }, concepts: f.id === 'measurement-scope-comparison' ? ['three-statements', 'pct-vs-pp'] : ['fcf-vs-funding', 'capex'],
  sources: f.sourceRefs.map((id) => { const s = PACKET_20261011_SOURCES.find((row) => row.id === id); return { label: `${s.author} — 2026-10-10~11 참고 관점`, url: s.sourceUrl, supports: '구조적 해석의 출처이며 현재 수치·예측의 검증 자료는 아닙니다.' }; })
})));
export const PACKET_20261011_CLAIMS = Object.freeze(PACKET_20261011_FRAMES.map((f) => Object.freeze({
  id: `claim-20261011-${f.id}`, packetId: 'packet-2026-10-11', observedOn: '2026-10-11', sourceRefs: Object.freeze(f.sourceRefs), claimType: 'reasoning-framework', materialElement: f.issue,
  observation: f.answer, thesisLogic: f.mechanism[0], paradigmShift: f.shift, mechanism: `${f.steps.join(' → ')}. ${f.mechanism.join(' ')}`, chartTechnique: f.chart, indicatorInputs: Object.freeze(f.inputs),
  timeframe: '같은 정의·관측창의 비교; 기업 만기·분기 공시와 가격 세션을 구분', confirmation: f.mechanism.slice(1).join(' '), invalidation: f.reverse, counterclaim: f.counterclaim,
  allowedConsumers: Object.freeze(['knowledge:analysis-frames', 'chat:reference-reasoning']), blockedConsumers: Object.freeze(['rank', 'current-price', 'score', 'auto-order', 'personal-allocation']),
  currentnessBoundary: 'DATED REFERENCE — 게시물의 가격·수익률·매출·금리·일정은 현재 데이터로 승격하지 않음. 원공시·공식 시계열을 별도로 확인해야 함.',
  transientElements: Object.freeze(['당주 수익률', '가격 지지·목표 구간', '매출 추정치', '신용·환매 수치', '발표 일정', '개인 포트폴리오 계획']), status: 'FRAMEWORK_EXTRACTED'
})));
