# PASS24 — 차트 계산·과거 신호·수준 지도·전략 설명

2026-10-30 직접 판독. 전체10개 technical 모듈: bands, signal-history, price-levels, chart-scenarios, chart-compare, chart-drawings, chart-strategies, stage, setup-coach, chart-analysis. src/ui/components/stock-chart-strategies.js도 전체 판독(총11). definitions/follow-through는 기존 PASS6 직접 판독 기록이고 이번 재판독은 아니다. stock-chart.js276–315의 데이터→completedBars→analysis 연결은 부분 판독. 6개 반례 묶음 reproduce-pass24.mjs exit0, pass24-reproductions.json. 제품 개선 없음.

## P24-EARNINGS-01 — 일정 미확인을 ‘그 뒤 발표’로 승격

breakoutChecklist는 earnings.state=unconfirmed이고 windowEnd-analysis.asOf>=14일이면 met=true, “목록에 날짜 없음 — 그 뒤 발표”로 표시한다. 공급자 coverage 누락·미공표 일정은 발표가 없다는 증거가 아니다. asOf10/1/windowEnd11/1 반례 통과. producer calendar가 빈 행을 보장된 no-event로 정의하는지와 무관하게 state=unconfirmed와 충돌한다.

개편: confirmed scheduled만 일정 거리 계산, coverage 종료는 조회 범위 설명으로만 사용. no-event를 발행하려면 그 의미를 별도 증거로 제공. 회귀: 미공표·공급자누락·조회기간연장·과거analysis·거래일/달력일 차이. template도7true+1unknown을 met=true로 요약한다. 변형템플릿의 허용예외라면 ‘8개 모두 검증’과 구별하고 어떤 항목 예외인지 남길 것.

## P24-STAGE-01 — 기울기 없음에도 상승으로 명명

classifyMovingAverageStructure는 sma50Rising!==false를 상승으로 취급한다. sma50=100,sma200=90,close110,sma20=105,sma50Prior 없음→UPTREND 및 MA_STRUCTURE_LABELS='50일선 상승'. 구조가 양호하다는 사실과 기울기 관측은 다르다. label의 50일선 상승 단정 제거 또는 기울기 확인 조건 분리. 평평한 선은 false로 TOPPING/둔화가 되므로 상승/하락/보합/미확인 네 상태로 명명하는 방안. deriveTechnicalStageFromOhlcv는 미래를 fresh로 만들지 않는 보호 확인. 숫자 timestamp를 Date.parse로만 해석하는 입력 계약과 중간 거래일 누락 검증은 보강 후보.

## P24-SIGNAL-01 — 미래 종료값 결측을 -100%로 집계

signalHistory는 진입 close>0만 확인하며 종료 close null은 나눗셈에서0이 된다. 5개 사례 종료값null→medianPct=-100,upShare0 재현. 정상 analyzeChart는 유효bar만 filter하므로 null 직접 전달 경로는 차단될 수 있으나, filter로 빠진 거래일 때문에 21개 row가21거래일과 달라지는 위험은 남는다. 날짜·유효 종료값을 가진 outcome panel을 쓰고 누락사례를 분모에서 구별할 것.

이 모듈은5개 이상이면 median/비율 필드를 만들고 화면은 상승 count/n으로 쓰지만 같은 history baseline은 제공하지 않는다. setup-coach.pastBreakouts는10미만 count-only·10–29small·baseline을 별도 구현한다. 소표본·사례 정의를 공통화할 필요. RS line의 상대변화는 (1+rStock)/(1+rIndex)-1이며 arithmetic 초과수익률 rStock-rIndex와 다르다. signal의 medianExcessPct 명칭·‘지수 대비’ 단위를 명확화.

## P24-VWAP-01 — 짧은 history와 거래량 누락을 충분한 앵커로 표현

vwapAnchors는21개 이상이면52주고점/6개월저점 라벨을 붙인다.60개bar에서도52주고점이 생성되는 반례. chart-analysis rangeLabel은 부족기간을 표시하므로 같은 차트가 서로 다른 기간 의미를 말한다. anchoredVwap는 volume누락 이후 이전값을 그대로 반복한다(10→100가격, 두번째 volume null에도VWAP10). 이는 결측을 거래량0으로 해석하는 것과 같다.

개편: 실제span 라벨과 기준기간 충분성, 누락volume coverage를 전달하고 끊김/참고 표시. daily typical-price×volume의 VWAP는 실제 tick 거래대금 VWAP의 근사임을 유지. 회귀:21/60/126/252개bar, 중간volume결측, 0volume 정지일, 분할조정 가격과 raw volume 조합.

## P24-DISTANCE-01 — 상승 필요폭을 ‘고점보다 아래’ 백분율로 서술

buildChartScenarios는 resistance/close-1을 계산하면서 ‘종가가 회복기준보다 x% 아래’라고 한다. close100/resistance120이면20%아래로 출력되나 기준120대비 종가는16.67%아래다. 필요한 상승폭20%라고 쓰면 맞는다. support 쪽은 close/support-1이라 기준점 대비 거리이며 양쪽 비교의 분모도 다르다. 동일 분모(current close)로 도달 이동폭을 비교하고 문장을 맞추거나 기준점대비 거리를 각각 명시. 큰 갭·동률·양쪽 경계 회귀 필요.

## P24-PRODUCT-01 — 교육 설명과 현재 종목의 매매 기준 제시 경계

strategyLenses는 현재 종목 pivot/20일고저/EMA를 ‘손절 기준/목표 기준’에 삽입하고 일부 정리/보유 문구까지 생성한다. stock-chart-strategies는 가장 충족비율 높은 방식을 기본 선택하고 ‘지금 조건이 모두 맞는 방식’으로 추천처럼 읽힐 수 있게 연결한다. 자동 plan 필드 채우기를 하지 않는 보호는 있지만 ‘앱이 가격·시점·크기를 고르지 않는다’는 현재 제품 결정과 긴장한다. 조건개수는 검증된 우열 점수가 아니며 unknown 조건도 분모에 포함된다.

개편 제안(기능 삭제는 하지 않음): 일반 전략의 역사적 원칙과 현재 관측 수준을 분리, 현재 숫자는 수준 지도에만 표시하고 손절/목표 연결은 사용자 입력 계획의 사실검사로 한정. 방식 기본 선택은 사용자의 선택 또는 중립 비교 상태. 특정전략의 합격률을 추천 순위로 승격하지 않는다. RR_GUIDE의 자본0.5~2%·수량식은 일반 교육 맥락과 실제 계좌값을 결합하지 않는 경계를 명시. 현재 사용자의 교육 기능 요청을 폐지할 이유로 쓰지 않는다.

## 추가 후보·정상 계약

- price-level reactions는 low까지 올라온 적 없는 bar도 한쪽 high/close 부등식만으로 반응횟수에 포함될 수 있다. zone와 실제 high-low 교집합, 접근방향, 연속touch묶음을 정의할 것. zone merge 폭은 member 중심점만 제한하지만 volume/gap 구간 폭은 더 넓을 수 있어 ‘zone never wider’ 주석 부정확.
- buildPriceLevels는 유효bar filter로 기간을 압축, input 시간/완료session 검사없음. checkPricePlan은 지도에 남긴 위/아래5개만 보므로 먼 target까지 중간수준이 없다는 주장은 못한다. 손절위치로 long/short를 추정하는 대신 사용자의 방향 확인/표시 필요. 손실액은 지정가격 체결 가정이며 gap/slippage 범위를 설명할 후보.
- chart-compare는 다른 종목을3일내 이전종가로 맞추지만 자신의 bars 정렬을 가정한다. periodReturns는 invalid close를 filter해 기간을 압축. overlay의 동기 기준일과 각자 periodReturns 기준일이 다를 수 있다. nullgap을 points에서 삭제하면 차트가 선으로 이어지는지도 consumer 검토 필요.
- chart-analysis의 과거 overheat marker는 오늘ADR을 사용하는 근사라 새bar로 과거 표시가 바뀔 수 있다(코드 주석 명시). 과거신호 통계대상에는 extended가 없어 해당 통계오염으로 확대하지 않는다. current pivot을 최근10일 breakout에 소급하지만 pastBreakouts는 각당시prefix를 사용하여 계약이 다르다.
- setup-coach baseline은 index0부터, signal사례는60부터 eligibility를 가지므로 표본기간이 다르다. nonoverlap은 정확히horizon만큼 띄워 서로 같은 끝/시작값을 공유하되 수익률 구간은 겹치지 않는 정상 구현. 예측확률이 아닌 기록이라고 표시하는 보호 유지.
- weeklyCloses의 마지막 미완료주 포함 여부는 definitions/데이터caller 계약 재검토 필요. daily completed만으로 completed week는 보증되지 않는다.
- 교육 근거는 일부 원칙이 likelihood를 암시(‘이어지기 쉽다’, ‘실패 잦다’, ‘기관수요’)하나 자체검증 결과와 분리되어 있지 않다. 문헌 원칙의 소개인지 현재종목 검증결론인지 명확화. 외부문헌 사실검증은 이번 로컬 감사에서 하지 않았다.
- price map·scenarios는 관측된 수준과 조건 분기를 제공하고 임의 예측 확률을 만들지 않는다. drawlines의 confirmed는 최소3touch 규칙의 뜻이며 예측 성능 인증은 아니다.

## 감사 QA 및 현재 트리

PASS20–23 문서/ledger 관련 affected 실행: 2026-10-30T13-47-51-310Z-31796-vmb6s0, pass9/cached3/fail0, exit0. 캐시3은 capability-claims/route-registry/qa-runner-behavior. 이전 PASS17 qa-runner-behavior 실패와 이번 캐시통과는 다른 실행 상태이며 이전 실패의 원인수정 증거로 쓰지 않는다. PASS24는 이후 추가되어 해당 실행이 PASS24까지 검증했다는 뜻이 아니다.

후속 인벤토리에서5027경로로 늘었다. generated hash는 판독시각 hash가 아니라 관측 hash이므로 현재 dirty source를 REQUIRED_DIRTY_REVISION_READ_NOT_CERTIFIED로 보수 재분류하도록 ledger 보강. PASS20–21 뒤 event-briefs 등 동시변경이 있어 과거반례가 현재도 재현된다고 자동 주장하지 않는다. 전체 감사 완료·UI/배포 검증 완료 아님. 제품 수정·commit/push/deploy 없음.
