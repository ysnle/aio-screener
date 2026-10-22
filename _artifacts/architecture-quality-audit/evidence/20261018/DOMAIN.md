> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Domain 구조·의미 검토 — 진행 중

범위는 `src/domain/**/*.js` 152파일, 28,674줄이다. 아직 전수 전문 검토 완료가 아니다. 파일별 실제 상태는 `domain-reading.tsv`가 기준이다. 현재 70 FULL(이 중 3파일은 root 전문 검토 재사용), 20 EXACT_PRIOR_REUSE, 62 미독/부분이다. 이전 내용 감사는 동일 SHA가 증명된 knowledge/research literal에만 재사용했으며, 이번 함수/변환과 소비 import를 별도로 읽었다. FULL은 실행 PASS나 투자 타당성 인증이 아니다.

시작 및 중간 끝 bundle SHA256은 모두 `de73d7c869f51a600af5aaae3100821dfd911bad6ffebdc2ad3e38af87fb0986`이다. 알고리즘은 정렬된 `/` 상대경로 UTF-8 + NUL + 원시 파일 bytes를 연속 SHA256 처리한다. 도메인 원문은 수정하지 않았다. 두 차례 묶음 출력 잘림은 미완료로 남기고 root 복구 지시에 따라 4,000자 단위로 재독했다.

## 우선 소견 8개

아래는 읽기·호출추적으로 확보한 소견이다. 격리 실행은 root가 맡았으며 이 문서가 아직 root 실행 결과를 대신 주장하지 않는다.

1. **높음 — 오래된 TNX가 금리 카드 대신 전체 모델을 예외로 중단시킬 수 있다.** `src/domain/briefing/market-read.js:1104`의 원시 TNX 시계열에는 오래된 상승 기록이 남지만 `alignMarketInputs`는 2세션 초과 지연 TNX를 null로 보류한다. `:1111`은 이 경우에도 latch를 held로 둘 수 있고 `:1121`에서 `tnx.yearPosition`을 직접 읽는다. 반론: 최신 TNX일 때는 정상이다. 최소 수정: held/read 생성에도 정렬 후 사용 가능한 TNX와 변화값 조건을 적용한다. 검증: 연속 상승 TNX 기록 뒤 SPX만 5세션 이상 추가하고 공개 `buildMarketRegime`가 throw 없이 금리 unknown을 반환하는지 확인한다. 증거: 함수 전체 읽기, 원시→정렬→카드 생성 흐름 추적; root 재현 요청.

2. **중간 — NOT 필터의 가격 입력이 계산 identity에서 빠진다.** `src/domain/screener/screen-engine.js:155`~`:169` walker는 children만 방문하지만 `:77`~`:78` 평가기와 `src/data/contracts/screener.js:530`~`:531` 검증기는 not.child를 지원한다. 가격 필드가 NOT 안에서만 소비되면 가격 tick으로 결과가 달라져도 `:181`~`:185`의 identity 입력키에는 반영되지 않는다. `src/data/orchestrators/screener.js:85`가 실행 소비자다. 반론: 현재 기본 preset은 NOT를 쓰지 않는다. 최소 수정: AST child 방문을 보완한다. 검증: not(range(price.close))의 price 변경 시 calculationInputId가 바뀌고 미참조 price 변경은 그대로인지 확인한다. 증거: 전문 읽기·검증기/호출 추적; root 격리 재현 담당.

3. **중간 — 실질금리 하락에도 상승 부담 문구가 나온다.** `src/domain/briefing/market-read.js:571`은 abs(real5+bei5)>=8로 양방향을 받지만 `:575`~`:576`은 실질금리 주도이면 항상 PER 부담·실질금리 상승 중단 확인을 출력한다. 공개 `buildMarketRead`의 statements[id=real-yield-led]가 소비 표면이다. 반론: 양수 금리변화에는 맞는 설명이다. 최소 수정: 같은 branch 안에서 변화 부호에 맞춰 reading/check를 만든다. 검증: 동일 기준일의 -20bp/-1bp와 +20bp/+1bp를 쌍으로 검증한다. 증거: 전문 읽기, 함수 입력→statement 추적; root 재현 요청.

4. **중간 — 상수 팩터를 독립정보로 센다.** `src/domain/screener/factor-overlap.js:73`~`:74`에서 0분산 Spearman null을 0으로 치환하고 대각을 1로 고정한다. 상수 팩터는 정보가 없는데 effective factor 수에 1개로 기여한다. `src/ui/pages/screener.js:13` 및 `:1968`이 문장으로 출력한다. 반론: 현행 정상 분포에는 영향이 없고 충분한 유효표본 30개도 요구한다. 최소 수정: 변동 없는 열을 제외하거나 결과를 보류하고 제외 사유를 표시한다. 검증: 30개 동일값 팩터와 정상 변동 팩터의 조합으로 정보 수가 부풀지 않는지 확인한다. 증거: 전문 읽기·UI 소비 추적; root 격리 재현 담당.

5. **중간 — 벤치마크의 거래일 기간 계약이 공통 시계열 규칙과 다르다.** `src/domain/market/benchmarks.js:16`~`:23`은 21/63/126번째 관측을 과거점으로 쓰지만 `src/domain/briefing/market-read.js:187`의 sessionPointBack은 시장 세션 간격과 결측 slack을 확인한다. 결측일이 있으면 종목의 동일 기간과 벤치마크 창이 달라질 수 있다. 소비자는 `src/ui/components/stock-read.js:201`, `src/ui/components/portfolio-read.js:57`/`:67`이다. 반론: 일별 기록이 완전하면 결과는 같다. 최소 수정: benchmark 시장을 주입해 공통 sessionPointBack 계약을 재사용하되 기존 21/63/126 창은 유지한다. 검증: 동일한 US/KR complete 기록과 중간 누락 기록에서 시작/끝 세션을 비교한다. 증거: 양쪽 함수 읽기·UI 호출 추적; 실행 미검증.

6. **중간 — 한국 스트레스 표본 하한은 유효 비중첩 창 수를 세지 않는다.** `src/domain/portfolio/kr-stress.js:16`은 floor((rows-1)/n)만으로 최소 10사례를 허용하고 `:20`의 실제 세션 간격 검사는 이후 최악 창 선택에만 쓰인다. 많은 결측이 있는 201개 기록과 유효 20세션 창 1개도 표본 하한을 통과할 수 있다. `src/app/bootstrap.js:237`의 _aioKrIndexStress가 소비한다. 반론: 완전한 연속 기록에는 하한이 맞는다. 최소 수정: 실제 유효·비중첩 창을 세어 최소 표본 여부를 정하고 최악 기록은 현재 정의대로 유지한다. 검증: row수는 충분하나 유효 비중첩 10창 미만인 기록과 정확히 10창인 기록을 나란히 검증한다. 증거: 전문 읽기·호출 추적; 실행 미검증.

7. **낮음/잠복 — 매일 replay하면 최소 유지기간이 계속 연장된다.** `src/domain/screener/regime.js:29`~`:30`은 previous.observedAt부터 hold를 재고 매번 `:49`에 now를 기록한다. `:65`~`:68`은 이를 다음 previous로 넘겨 2일 hold가 일별 데이터에서 끝나지 않는다. 검색된 외부 소비는 현재 계약 게이트뿐이다. 반론: 2일 이상 간격의 입력이나 minHoldMs=0은 정상 작동한다. 최소 수정: 관측시각과 상태 진입시각을 구분해 상태가 바뀔 때만 유지 기준시각을 갱신한다. 검증: 매일 7일간 반대 입력을 넣어 최소기간 뒤 전이가 일어나는지 확인한다. 증거: 전문 읽기·replay 추적·소비 검색; root 격리 재현 담당.

8. **구조 개선 후보 — 공통 시계열과 화면 판정의 소유가 briefing 파일에 집중돼 있다.** `src/domain/briefing/market-read.js:107`의 buildCloseSeries, `:187`의 sessionPointBack과 통계/정렬/한국 기록/신용/문구/전체 판정이 같은 1,321줄 106,829 UTF16 모듈에 있고, domain 내부 16파일이 이 모듈을 import한다. 시장·거시·현금환산·스트레스·심리·테마가 briefing 소유에 의존한다. 반론: 하나의 기준으로 재사용해 드리프트를 줄인 점은 옳고 파일 길이 자체는 결함이 아니다. 최소 리팩터링: 분해가 필요해질 때만 공통 close-series/세션 창 부분을 market 계층의 한 모듈로 옮기고 기존 API는 재수출해 연결을 보존한다. 판정 축별 추가 분할이나 framework 도입은 제안하지 않는다. 검증: 기존 pure fixture 결과 동등성과 US/KR 휴일/결측/이전종가/date-only/settle 우선순위 계약을 유지하고 import 변경 경계를 확인한다. 증거: 원문 전체 및 16개 import 연결 읽기. 성능 향상은 측정하지 않았다.

## 유지할 구조

finiteNumber의 엄격한 수치 읽기, period의 동일 회계기간 비교, ticker의 exact registry 정책, immutable 반환, 외부 I/O 주입과 순수 계산 분리는 전반적으로 유익하다. 같은 이름의 finite라도 strict와 coercing의 의미가 달라 전부 하나로 치환하면 오히려 계약을 바꾼다. 작은 helper들을 길이만 보고 합치거나 이미 분리된 도메인을 더 쪼개는 변경은 권하지 않는다.

## 미완료

대형 SEC 정규화/보고서, portfolio backtest/risk/surface, factor-ranks/price-factors, macro/read/crossroads 등은 아직 전문 미완료다. 62행 미독/부분을 완료로 승격하지 않았다. 코드 수정·Git·QA·producer·fetch·네트워크·AI 호출·commit/deploy를 수행하지 않았다. 감사 출력 두 파일만 root 지시에 따라 보존했다.
