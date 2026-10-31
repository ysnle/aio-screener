# Pipeline review PASS17 — 시장 계산·해석 연결

2026-10-29, v59.42 작업 트리 직접 판독. 제품 코드 개선 없음. 에이전트 없이 주 담당자 수행. 전체 감사는 미완료이며 이 문서는 계속 작업하는 중간 기록이다.

## 판독 범위와 정상 계약

이번 본문 직접 판독 22파일: src/domain/market/{market-lean,breadth,breadth-signals,breadth-snapshot,breadth-consensus,screener-breadth,sector-map,leadership-verdict,kr-index-record,kr-investor-flows,korea-participation,index-earnings,market-flow,page-flow,market-timeline,regime-radar,regime-scenarios,scenario-outlook,macro-crossroads}.js, src/app/score-entry-points.js, src/domain/themes/{produced-rotation,recent-check}.js. 출력이 잘린 page-flow 중간과 macro-crossroads 281–315줄은 별도 재판독했다. PASS16의 11개 시장 파일과 합쳐 src/domain/market 30파일 본문 판독 기록이 있다. 이는 모든 관련 생산자·소비자·현재 운영 데이터의 의미 검증 완료를 뜻하지 않는다.

정상 계약: produced-rotation은 최신 완료 세션·조정 종가·SPY·모델 버전·관측 시각·사분면을 함께 대조한다. 시장 시나리오는 필수 시장 폭/신용/변동성 관측과 stale basis를 보류한다. 시나리오 조건 개수는 확률이 아닌 개수로 표시한다. market-lean은 겹치는 VIX 일별 통계를 투표에서 제외하고 독립 표본 30개 미만도 투표시키지 않는다. 한국 참여도는 KRX 완료 세션의 같은 날짜 표본을 고른다. 지수 이익은 80% 비중 coverage와 이중 주식 클래스 중복 제거, 전망·가격 나이 제한을 갖는다. 이것들은 소스 판독 증거이며 브라우저·배포 검증이 아니다.

## 재현 및 확정 발견

모두 기존 코드에서 발견. reproduce-pass17.mjs와 pass17-reproductions.json 참조. 순수 함수만 실행했고 네트워크·생산자·제품 쓰기는 없다.

### P17-BREADTH-01 — 한국 관측 날짜 누락이 검증 통과

중간. screener-breadth.js:58–59에서 관측이 없으면 krAgeHours=null인데 숫자 비교 두 개를 모두 통과한다. 정상 US + 날짜 없는 KR을 넣으면 state=verified_current, kr.ts=0인 데이터가 반환된다. compatibility-globals.js:122의 _aioScreenerBreadth가 활성 진입점. 현재 공개 데이터에서 실제 누락이 발생했다는 주장은 아니다. 유효한 유한 timestamp를 KR에도 명시적으로 요구하고 미래/누락/invalid/경계 시각 회귀를 추가한다. US와 KR 각자의 판정 상태도 함께 반환해야 한다.

### P17-BREADTH-02 — 오래된 우선 모집단이 정상 대체 모집단을 차단

중간. screener-breadth.js:34는 값·coverage만 보고 SP500을 먼저 선택한 뒤 날짜를 검사한다. 10/1 SP500과 10/28 US를 같이 넣으면 blocked/us=null/kr=null. SP500만 빼면 같은 US가 verified_current다. 주석의 '같은 검증을 통과하면 우선 사용'과 구현이 다르다. 후보별 모든 조건을 검사한 뒤 선택하거나 오래된 S&P 모집단을 날짜 있는 참고로 제공하는 정책을 명시해야 한다. US 실패가 정상 KR까지 제거하는 결합도 별도 개선 대상으로 남긴다. 모집단 대체 때 라벨과 이력의 universeScope를 함께 유지한다.

### P17-MAP-01 — 거래대금 결측이 시가총액 오류로 처리

중간. sector-map.js:132의 finite(null)/value는 0이 되어 비정상 회전율 필터가 정상 시가총액을 버린다. index weight artifact 없는 fallback에서 시총 10억달러·수익률 1%인 20개 행을 넣으면 계산 가능한 시총 0개로 지도 unavailable. dollarVolume30d=1천만만 추가하면 available. 거래대금 미확인을 0으로 바꾸지 말고 검증 상태와 시총 보유 여부를 나눈다. 정책상 거래대금 검증 필수라면 '시가총액 계산 불가' 대신 실제 누락 원인을 설명한다. index-weight 정상 경로의 장애로 확대하지 않는다.

### P17-CONSENSUS-01 — 결측 시장 폭을 강세 합의로 전환

중간, 함수 방어 결함. breadth-consensus.js:20 Number(null)=0이고 registry의 0은 capitulation/+0.5다. sma 세 개 null → consensus=.5/'강세 합의', 모두 undefined인 대조군은 '—'. 실제 registry의 null 방어도 사전 Number 변환 때문에 우회된다(js/aio-core.js:8970 이후). score-entry-points.js가 노출하고 aio-core.js:2763은 breadthEvidence.available 이후 호출하므로 실제 현재 입력의 null 도달 가능성은 더 확인해야 한다. 숫자 타입·범위 확인 전 정규화 금지, 결측/0/극단 실제값을 구별하는 회귀 필요. 합의 모델의 실제 사용 범위와 은퇴한 화면의 잔존 계약은 별도 추적한다.

### P17-EARNINGS-01 — 미래 종가도 최신 가격으로 인정

중간, 함수 방어 결함. index-earnings.js:44 closeCurrent는 now-ms 상한만 검사한다. 2099-01-01 factorSessionDate, 현재 전망 EPS5·가격100을 넣으면 forwardPe20과 yield coverage100%를 발행한다. market-interpretation.js:84가 활성 호출. 정상 관측일 대조와 최신 완료 US 세션 상한을 요구해야 한다. 현재 artifact에 미래 날짜가 있다는 주장은 아니다. 추가 후보: weightsAsOf/realYieldAsOf는 표시용일 뿐 계산 허용 조건에 쓰지 않으며, weight 문자열은 필터만 수치화하고 실제 합산은 원문을 사용한다. producer의 타입 보증·금리 freshness 전달을 확인하기 전 운영 결함으로 확정하지 않는다.

### P17-RELEASE-01 — 실업률 미확인을 '보합'으로 간주해 시나리오 충족 기록

중간. macro-crossroads.js:275 softland NFP trigger는 (unempDelta ?? 0)<=.1이다. payroll100(천명), unempDelta=null도 '일자리 7.5만~20만 + 실업률 보합~+0.1%p' 충족. -.5도 충족해 문구의 하한과 다르다. 단순 비정상 입력만의 문제가 아니다: releaseActuals는 실업률과 payroll의 최신 월이 다르면 u=null을 실제로 만든다(:98–100). build-scenario-state.js:119–129 scoreNewReleases가 이를 이벤트 판정으로 기록하고 period를 소비하므로 이후 같은 월 실업률이 도착해도 재평가되지 않는다. 필요한 지표가 모두 도착할 때까지 pending, 부분 공개 상태 및 수정/revision identity를 기록하고 같은 기간의 보강 자료 도착을 재평가해야 한다. 문구와 일치하는 0..0.1 범위를 선택하거나 '0.1 이하'로 정책을 명시한다. null CPI도 <=.2를 통과할 수 있으나 정상 releaseActuals 생성 경로와 구분해 방어 후보로 둔다.

### P17-OUTLOOK-01 — RRG 경계 항목은 논리상 표시 불가능

낮음. scenario-outlook.js:106의 quadrantOf(row)==='Leading' && rrgBorder(row)는 동시에 참일 수 없다. quadrantOf는 rrgSettledQuadrant가 Border이면 null을 반환한다. 100.2/100.2, raw Leading 입력은 실제 Border지만 경계 링크가 빈 배열이다. '경계도 따로 표시해 총수가 맞는다'는 v58.80 주석과 불일치. raw quadrant와 settled quadrant를 별도 필드로 다루고 경계 그룹은 raw/인접 구역으로 분류한다. 경계/선도/반락 그룹 합집합과 중복을 행동 검사한다.

### P17-FLOW-01 — 가격 관측을 자금 이동의 확인으로 강화

중간, 소스 의미 결함. market-flow.js:58–62의 '돈은 방어 업종으로 옮겨갔습니다', '시장 전반에서 돈이 빠졌습니다'는 입력에 ETF 가격 등락·금리 변화·공포지수만 있고 순유입/순유출 자료가 없다. market-interpretation.js:96의 flow stage로 전달된다. R679의 관측 의미 보존 및 page-flow.js의 P1449 주석('가격 관측은 자금 유입 증거 아님')과 상충한다. 업종 상대 강세/가격상 위험 회피로 표현하고 실제 펀드 플로 자료가 있을 때만 관측된 자금 이동으로 분리한다. 원인 가설은 확인된 원인처럼 쓰지 않는다. 외부 금융 주장을 검증한 것이 아니라 입력 계약과 출력 단정의 불일치다. 별도 후보: 8개 섹터만 있어도 분모를 11로 출력하므로 관측/누락 개수의 표시 계약 필요.

## 재현했지만 현재 생산 경로가 막는 방어 후보

market-timeline.js:15 formatSlotMove({change:null}) → flat/'0.00%'. 다만 scripts/lib/market-timeline.mjs:77–97 생산자는 null/비유한 change를 제외하므로 정상 생산 출력에서 발생한다고 주장하지 않는다. 외부/과거 artifact 경계의 수신 검증 보강 목록에 둔다.

## 추가 추적 목록과 개편 방향

- market-lean: KR temperatureItem에는 US와 달리 비교 asOf가 전달되지 않는다. retained 표시 없이 오래된 KR 자료가 남는 실제 경로를 producer/loader에서 확인할 것. US도 asOf 없는 값의 투표 허용 여부를 확인한다. 빈도 rate/base 범위 및 원본 이력 기간을 검증하고 '1990년 이후' 고정 문구를 실제 기간으로 파생한다.
- breadth-snapshot: 값의 세션은 buildCloseSeries가 결정하지만 eligible/universe는 수집 행 date에서 가져온다. 이월/late arrival 시 provenance를 같은 값에서 가져오는지 검증한다.
- sector-map: 날짜 없는 수익률은 다른 행의 basis가 있어도 가중 평균에 포함된다. weights의 유효 수/합계/중복, SPY 날짜 없음 허용을 producer 계약과 함께 대조한다.
- kr-investor-flows: 고정 5일 stale 판정은 발행 cadence를 반영하지 않는다. 시계열 정렬/중복/세션 gap과 latestDate 연계, 시장별 missing 대신 전 시장 합집합 missing을 쓰는 의미를 추가 검토한다.
- korea-participation: intraday/fieldReadiness는 중기 지표에서 확인하지만 sessionRead의 ret1d/ret5d는 raw 필드를 읽는다. 수급·공시 '미수집' 고정 문구는 현재 별도 수집기 존재와 대조해야 한다.
- regime-scenarios: USDKRW 카드 stale=false가 고정되어 있다. 실제 상위 freshness 전달과 함께 검토한다. 한국 시계열 memo는 배열 identity+length라 in-place correction의 무효화 계약을 확인한다.
- scenario-outlook: transition 반증이 '소수 주도로 되돌아감'을 말하지만 소수 주도의 breadth/credit 등 조건을 모두 재검사하는지 연결 검토한다.
- macro-crossroads: FOMC trigger 문구의 인하 사유/신용 조건은 upperDelta<0만으로 검사한다. 발표의 사실 조건과 인과 해석을 나눠야 한다. softland 이외 triggers도 required-field 계약으로 전수 비교할 것. policy lower bound fallback -0.25는 '추정하지 않음' 규칙과 검토 필요. fixed favored choices는 비용 가설이라는 한계를 유지한다.
- recent-check: marketWindowReturns/rsRecentCheck는 관측 개수를 세션 수로 읽는다. 누락 일자에 대한 upstream 정렬/완전성 계약을 확인해야 한다. band/hysteresis 구현 자체와 측정 통계의 타당성은 구분한다.

구조 개편 제안: 각 계산 입력을 value+unit+observedSession+population+availability로 유지하고 출력 직전에만 문자열화한다. 후보 선택 전에 freshness까지 포함한 동일 검증을 수행한다. 이벤트 평가는 met/unmet/unknown 삼상과 revision identity를 가진다. 화면·AI가 동일 모델을 공유해도 모델 자체의 의미가 틀리면 함께 틀리므로 숫자 테스트와 별도로 출력 주장에 필요한 입력을 검사한다. 여기서는 제안만 기록했다.

## 실행 및 한계

reproduce-pass17.mjs exit0. 날짜 누락·대체 실패·결측 숫자 변환·미래 가격·실업률 결측/하한·경계 링크를 대조군과 검사했다. 단위 재현은 배포 발생 증거가 아니다. 브라우저/외부 서비스/생산자 실행 없음. PowerShell brace 경로 문법 오류 한 번은 명령 전체가 파싱 실패했고 명시 경로로 재실행했다. QA 결과는 다음 연속 배치와 함께 기록한다. 기존 PASS15/16 generated-state 및 qa-runner-behavior 실패를 해결했다고 간주하지 않는다.
