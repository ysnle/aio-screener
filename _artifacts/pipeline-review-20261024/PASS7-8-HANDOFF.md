# 추가 의미 감사 — 장기 검증·테마·표시 분모

2026-10-27 / cstack review / v58.80 / 제품 변경 없음. 전수 완료 아님.
사용자의 에이전트 미사용 지시 이후 주 담당자만 판독·실행한다. 실행 중 하위 에이전트가 없음을 확인했다. 이전 에이전트가 전달한 미통합 후보는 직접 확인 전 확정으로 세지 않는다. 아래 5건은 모두 주 담당자가 실제 함수 또는 변경하지 않은 소스 블록으로 재현했다. 브라우저·배포 발생 증거와는 구분한다.

## P7-BT-01 — 장기 국면 분류가 리밸런싱보다 한 세션 뒤를 읽음 [ACT ON, medium, E2]

scripts/backtest-factors-longrun.mjs:161–167은 offset을 marketSeries.length - off로 환산한다. 실제 backtestFactors는 calendarDates.length - 1 - offset으로 리밸런싱 날짜를 선택한다. 두 달력이 완전히 같아도 한 세션 차이가 난다. 주 담당자가 실제 backtestFactors와 원본 regimeGroups 블록을 실행한 합성 300일/20종목 fixture에서 리밸런싱은 2025-11-27, 국면 판독은 2025-11-28이었다. 날짜는 휴일을 제외하지 않은 합성 평일 달력이다. classifier stub은 전달된 날짜만 기록했으므로 실제 역사적 국면 반전 횟수를 재현했다는 뜻은 아니다.

의미: 당시 국면별 성과를 나눈다고 하면서 다음 세션 정보를 쓸 수 있다. 시장 달력과 종목 coverage 달력이 다르면 차이는 한 세션보다 커질 수 있다. 개선안은 offset 재계산을 없애고 backtest가 실제 채택한 rebalanceDate에 정확히 join하며, 해당 날짜의 관측이 없으면 그 국면 집계를 보류하는 것이다. 동일 달력·휴일 차이·일부 종목 결측·국면 경계 날짜를 fixture로 둔다. producer 본체나 외부 수집은 실행하지 않았다.

## P7-UI-01 — 결측 검증 수익률이 추이에서 0으로 변환 [ACT ON, medium, E2]

src/ui/components/screener-validation.js:36의 Number(null)/Number('')와 유한값 검사가 두 결측을 실제 0으로 받아들인다. summarizeValidation에 같은 fingerprint의 두 날짜, 각각 null/빈 quantileSpreadNet을 넣으면 series=[0,0]이다. renderScreenerValidation은 series를 그대로 trend chart에 넘긴다. meanTStat(:19)와 spreadSeries(:45)도 같은 변환을 사용하지만 이번 확정 재현은 chart series에 한정한다.

현재 public-data/backtest-history.json의 92행을 읽은 결과 null/빈 quantileSpreadNet은 0건이었다. 따라서 현재 그래프가 잘못됐다고 보고하지 않는다. 개선안: null/빈 값 제외 후 숫자 변환, 연속 기록의 결측은 chart gap으로 남기고 valid observation count를 사용한다. 실제 0, null, 빈 문자열, NaN, 정상 양/음수를 구분한다.

## P8-THEME-01 — 테마 최소 표본이 유효 수익률 수를 세지 않음 [ACT ON, medium, E2]

theme-criteria.js:37은 존재하는 row 객체 수를 count로 세고 :122는 count>=3와 중앙값 존재만 확인한다. ret1m/ret3m의 실제 유효 수가 각각 1개여도 measured=true가 된다. heatKnown(:90)은 extensionCount>=3만 확인하고 ret5d는 중앙값이 존재하면 충분하다.

직접 재현: 세 row 중 A만 1개월5%, 3개월10%, 1주1%; B/C 수익률은 null. 세 row 모두 거리/ADR은 유효하다. memberRoles는 A를 leader로, themeCriteria는 '과열 아님'을 met=true로 판정한다. A 자신의 값 하나가 테마 중앙값을 만들고 다시 A를 그 중앙값과 비교하는 상태다. UI theme-playbook-view.js:201–209는 row가 있는지만 필터하므로 이 입력 경계를 차단하지 않는다. 실제 현재 테마에서의 빈도는 미집계다.

개편: 지표별 n과 공통 유효 집합 n을 반환하고, 역할 비교의 1·3개월 및 heat의 1주 수익률 각각에 최소3을 적용한다. 서로 다른 종목 집합의 중앙값을 합성할 때에는 그 범위도 공개한다. 부족하면 미확인으로 두고 6개 중 충족 수를 올리지 않는다. 무조건 최소 비중을 늘리는 대신 제품 규모에 맞는 n/coverage 계약을 명시한다.

## P8-UI-02 — 일부 관측의 비율을 상위 집단 전체 비율처럼 설명 [ACT ON, medium, E2]

screener-read.js:60–71은 above의 분모를 measured.length, dropped의 분모를 dropMeasured.length로 계산하지만 문장은 '상위 20% 중 ...%'이다. 직접 재현: 순위50행→top10, 그중 한 행만 거리10/ADR2/ret5d=-10이 있고 나머지는 결측이면 '상위 20% 중 100%가 ... 위 ... 100%는 ... 하락'이다. 같은 함수의 nearHigh는 자료 있는 종목 수를 표시하므로 설명 계약도 서로 다르다.

보강: 자료 있는 1/10종목 중 1개라는 분자·유효 분모·전체 수를 함께 반환하고, 요약 문구는 그 정보를 사용한다. 충분한 coverage가 없으면 집단 상태를 요약하지 않고 관측 범위를 먼저 알린다. 필터링된 목록의 상위 범위와 동률 경계도 함께 명시한다. 실제 화면 실행 대신 실제 표시 문장 생성 함수를 재현했다.

## P8-DATA-12 — 누락 세션을 건넌 종목 수익률과 지수 하루 수익률 비교 [ACT ON, medium, E2]

PASS6의 미확정 gap 후보를 주 담당자 재현으로 승격한다. price-factors.js:424–427은 nullCloseDates에 따라 ret1d/5d/10d를 보류하지만 :442의 followThroughFields에는 gap을 전달하지 않는다. follow-through.js:145–150은 직전 유효 row와 당일 close로 수익률을 계산하고 지수의 당일 값과 비교한다.

직접 fixture: 80평일 이력에서 마지막 전 세션을 제거하고 해당 날짜를 gap으로 제공했다. 최근 지수 하락일은 9개다. 전체 입력의 버팀은 89%; 결측 입력은 ret1d=null인데 downDayCount=8, 버팀100%였다. 두 세션을 건넌 마지막 종목 수익률을 하루 수익률로 집계한 것이다. gap 때문에 제거된 날뿐 아니라 gap을 건너 계산한 다음 날도 일간 비교에서 제외해야 한다. 그 경우 이 fixture는 유효7일로 최소8 미달, 자료없음이어야 한다.

최초 fixture는 지수 하락일을8개만 만들어 gap 후7개가 남았고 현행 최소표본 guard가 정상적으로 null을 반환했다. 이를 실패 증거로 세지 않았다. 하락일9개 fixture로 최소표본 이상의 상황에서도 기간 불일치가 남음을 확인했다. 실제 artifact 발생 빈도는 미확인이다. 보강: 각 return에 시작/종료 session을 연결하고 benchmark와 양쪽 날짜를 일치시킨 뒤 coverage를 계산한다.

## 직접 판독 범위와 구조 메모

| 파일 | 상태 | 확인한 계약 / 한계 |
|---|---|---|
| scripts/backtest-factors-longrun.mjs | FULL | 상위 시총 표본·adjusted-only·70/30 분할·국면 분해·naive CI 한계 고지·발행. 현재 sectorOf를 넘기지 않는 라이브 비교 차이는 추가 후보 |
| scripts/lib/rank-statistics.mjs | FULL | ties midrank·pairwise finite·상수 rho null·Fisher CI. percentileRank01의 결측0.5는 호출 목적별 확인 필요 |
| src/ui/components/screener-validation.js | FULL cumulative | 모델 fingerprint·표본·t 기준·history chart·hero·gate 고지. P7-UI-01; model mismatch에도 distinguishable 색조가 남는 경로는 추가 검토 후보 |
| src/domain/scenarios/theme-criteria.js | FULL cumulative | 6조건·전망 revisions·실적 일정·주도/후발/이탈·macro exposure 연결. P8-THEME-01 |
| src/domain/scenarios/exposures.js | FULL cumulative | US/KR 구조 가설·노출 tag·wind 우선순위·proxy ETF. 외부 산업 사실의 최신성/정확성은 이 로컬 코드 판독으로 인증하지 않음 |
| src/domain/scenarios/theme-stage.js | FULL | scenario.status=current·theme/market 정확 매칭·단계 라벨. status 문자열만으로 시각 freshness를 검사하지 않으므로 loader 책임 후속 추적 |
| src/domain/scenarios/analogs.js | FULL cumulative | 대용 움직임·조건 testable 표본·비중·비중과 base rate 차이·10/30표본 정책·relative proxy outcome. themeStateOutcomes의 base는 benchmark 존재 날짜로 제한되지 않는 후보 |

부분 판독: theme-playbook.js 초반(일부 출력 잘림), theme-playbook-view.js:179–220, ui/pages/screener.js backtest/longrun 표시 및 load 구간, backtest-trading-score-longrun.mjs의 classifyRegime 부근. 부분 판독을 FULL로 세지 않는다.

자료/코드 차이: longrun의 fullUniverseSize는 loadTopUniverse가 이미 slice한 universe.length이므로 전체 원본 종목 수가 아니다. artifact에도 'top120, full120' 문구가 있다. 현재 화면은 이를 연구 표본 설명으로 사용한다. 장기 연구를 무조건10년이라고 표시하는 UI와 producer의 --range 옵션도 범위 계약을 통일해야 한다. longrun의 오래된 고정873종목/FMP 부재 설명과 현재 SEC 기반 producer의 차이도 남아 있다. 선행 PASS6의 코드·주석 차이와 함께 정리할 대상이다.

## 검증·남은 범위

reproduce-pass7.mjs exit0 → pass7-reproductions.json(주 담당자 실행 2026-10-26). reproduce-pass8.mjs exit0 → pass8-reproductions.json(주 담당자 실행 2026-10-27). 둘 다 외부 수집·제품 artifact 쓰기·브라우저 실행 없음. 에이전트의 거래점수 비교 불일치 보고는 아직 주 담당자 독립 확인 전이므로 신규 확정 항목에 넣지 않았다. 포트폴리오·캐시 위임 후속 결과도 확보됐다고 가정하지 않는다.

전체 UI/classic JS, 모든 producer/gate/문서의 파일별 대조, 시각 자료, 외부 Actions/배포 동작은 여전히 남아 있다. 모든 영역을 직접 확인했다는 답은 아직 '아니오'다. 기존 reader 판독 표시는 유지하되 앞으로 직접 재검토한 파일만 parent 상태로 바꾼다. 제품 코드 개선·commit·push·deploy 없음.

선택 QA: run 2026-10-27T11-33-15-656Z-31172-zzzrgc, 실행3 PASS / cache11 / FAIL0. 보고서는 pass8-affected-qa.json. reproduce-pass8.mjs 문법 검사와 감사 폴더 diff whitespace 검사 통과. 이는 감사 자료 변경 검증이며 제품 전체·배포 인증이 아니다.
