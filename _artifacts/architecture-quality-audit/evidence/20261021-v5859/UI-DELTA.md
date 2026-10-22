> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# UI 고정 REF 차이 감사

MODE: review | VERDICT: FAIL | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc (v58.59)

FINDINGS: actionable 4개(warning / medium; 1개는 root 브라우저 증거 통합), CONSIDER 1개(low). 제품·데이터·producer·외부 API·유료 AI·Git 상태 변경 없음. 작성한 것은 이 폴더의 UI 보고서·읽기 원장·격리 재현뿐이다.

## 범위와 읽기 증거

`git show <고정 REF>:<path>` 및 `git diff d36bb256 <고정 REF> -- <소유 경로>`만 제품 원문으로 사용했다. src/ui/pages 및 src/ui/knowledge의 변경 12경로 전체 diff를 의미 검토했다. screener의 추가/수정 868줄도 끝까지 읽었다. fundamental-analysis-cards.js, fundamental-analysis-lazy.js, screener-validation.js, portfolio-read.js는 현재 전문을 읽었다(후자 2개는 기존 파일이므로 신규 파일이라 부르지 않는다).

`ui-reading.tsv` 31행 = 현재 pages/knowledge 27개 + 추가 소유 components 4개. FULL 재독 4개, BASE_PLUS_DIFF 12개, INHERITED_FULL 15개이다. INHERITED_FULL은 변경 없는 내용의 이전 읽기를 계승한다는 뜻이며 이번 전문 재독이 아니다. 기존 20261021 원장의 SHA-256을 실제 d36bb256 원문과 대조했고, 그 원장에서 FULL이라 한 기존 해시가 20261019 FULL 원장과 일치하는지도 확인했다. 이전 원장에 남은 삭제 4개는 현재 파일 수에 포함하지 않는다. 과거 findings는 이번 전체 diff 독립 검토와 격리 재현을 끝낸 후에만 읽었다.

검토 lens: 사용자 경로·결측·단위·키보드 및 모달 수명·날짜·render identity·실제 값. cstack review 및 review-rubric을 읽었다. INDEPENDENCE: limited(동일 모델의 독립 담당자); 다른 담당자 판단을 독립 표로 세지 않았다.

## ACT ON UI-59-01 [medium] — 채권이 섞이면 섹터 카드가 다른 분모를 주식 비중으로 설명

- 위치: `src/ui/components/portfolio-read.js:149`, `:162`~`:164`, `:242`.
- 트리거: 같은 기준 통화에서 NVDA 평가액 500, TLT 평가액 500을 보유한다. TLT는 이 버전 asset-class.js의 정확한 채권 ETF 목록에 포함되어 있다.
- 실패: 새 portfolioLens는 두 평가액을 모두 total=1000에 넣어 Technology=50%를 계산한다. renderPortfolioLens의 카드는 이를 **“가장 큰 섹터가 주식 평가액의 50%입니다”**라고 설명한다. 실제 주식 부분은 NVDA뿐이므로 주식 평가액 중 Technology 비중은 100%이다. 채권 완충 카드가 바로 옆에서 TLT를 채권으로 설명하는데 섹터 카드에서는 주식 분모로 섞으므로 독자가 주식 집중도를 절반으로 읽는다.
- 증거: 고정 REF의 실제 portfolioLens 함수 격리 실행 → `topSector.pct === 50` assert 통과. 렌더 경로는 pages/portfolio.js render → renderPortfolioLens → portfolioLens → 해당 문구이다. 재현은 stress 입력 없이 실행하며 부채/가격 계산을 새로 만들지 않는다. beta·bond 결과는 이 단언에 관여하지 않는 경계 stub이며, 브라우저 재현으로 주장하지 않는다.
- 최소 수정 방향: 현재 분모를 유지하면 “현금 제외 보유 평가액”이라고 정확히 이름 붙인다. 주식 섹터 집중도를 뜻한다면 정확한 채권 분류를 제외한 주식 분모를 별도로 계산한다. 두 의미를 섞지 않는다.

## CONSIDER UI-59-02 [low] — 시총 오름차순에서 #가 현재 행 순서와 반대

- 위치: `src/ui/pages/screener.js:1724`~`:1730`, `:2012`; 컬럼 hint는 `:116` 부근.
- 트리거: 기본 overview에서 # 헤더를 눌러 시총 작은 순으로 전환한다.
- 실패: 헤더 설명은 “지금 정렬 기준에서의 순서”인데 capOrderMap은 항상 시총 큰 순으로 재정렬한다. 시총 10, 100인 두 행이 작은 순으로 놓이면 #는 2, 1이다. 다른 정렬에서는 실제 행 순서 1, 2를 써 같은 컬럼 의미가 전환된다. 수익률/실제 순위를 바꾸는 결함은 아니므로 낮은 우선순위의 의미 일관성 문제로 분류한다.
- 증거: 고정 capOrderMap + 실제 capFilterValue 격리 실행 → tablePosition `[1,2]`, displayedHash `[2,1]` assert 통과. live overlay 없는 fixture라는 경계를 재현에 명시했다.
- 수정 방향: 현재 행 순서를 일관되게 쓰거나, 항상 시총 서수라면 컬럼 설명과 다른 정렬 경로도 그 의미로 통일한다.

## ACT ON UI-59-03 [medium] — IC의 t로 수익률 차이에 판단 가능/긍정 색상을 부여

- 위치: `src/ui/components/screener-validation.js:131`~`:132`, `:158`, `:181`~`:183` 부근 새 readValidationState/renderValidationHero.
- 트리거: 12개 과거 시점에서 높은 순위상관(IC)이 반복되지만 상위−하위 평균 수익률 차이의 크기가 한 시점에 집중되어 그 차이 평균의 표준오차가 크다.
- 실패: 새 read는 `ic.compositeT`가 2를 넘는다는 사실로 `quantileSpreadNet` 부호에 favorable/burden state를 주고 hero의 상위−하위 평균 tile을 색칠하며 “표본 판단: 판단 가능”으로 표시한다. IC 평균의 t와 상위−하위 평균 수익률 차이의 t는 다른 통계다. 기존 summarizeValidation에도 같은 의미 혼동이 있어 PRE-EXISTING 원인이지만, 이번 새 hero가 같은 잘못된 판정을 별도 계산해 주 요약의 긍정/부정 색으로 확장했다.
- 실행 증거: 같은 12×100개 합성 cross-section에서 점수 순위와 수익률 순위를 거의 같게 만들고, 마지막 시점의 수익률 크기만 키웠다(다른 시점 0.001~0.1%, 마지막 0.1~10%). 순위상관의 t=61408.78, 상위−하위 평균 차이의 t=1.12121이다. 고정 REF의 readValidationState는 `distinguishable:true`, `state:favorable`을 반환했다. fingerprint만 동일모델 경계 stub이며 두 통계는 동일 수익률 행에서 직접 계산했다. 통계 값을 서로 독립으로 지어 넣지 않았다. 기본 재현은 거래비용 0인 경우이며 비용을 일정하게 빼도 두 t의 혼동은 사라지지 않는다.
- 최소 수정 방향: IC 유의성은 IC 타일/설명에만 붙이고, 상하위 평균 차이의 색과 판단 문구는 해당 차이 시계열 자체의 검증 통계를 사용할 때만 부여한다. 그 통계가 없으면 중립/판단 보류로 표시한다.

## ACT ON UI-59-04 [medium] — 프리셋을 바꿔도 자동 inspector의 이전 순위 근거가 남음

- 위치: `src/ui/pages/screener.js:2783` 부근 autoInspect guard, `:3207`~`:3225` renderNow, `:3237` 이후 selectDefinition.
- 트리거: 데스크톱 스크리너 최초 진입으로 NVDA inspector가 자동 선택된 후 “모멘텀 지속” 프리셋을 선택한다.
- 실패: 표와 조건 통과 수는 새 프리셋으로 바뀌지만 inspector는 이전 NVDA 전체 308위/838 및 조건통과 문구를 계속 표시한다. root 관측에서 표 첫행은 MRNA, 통과수는 341→268로 바뀌었는데 inspector 전문은 byte 동일했다. 새 조건의 NVDA 행은249위인데 inspector는308위였다. 같은 행을 명시 클릭하자249위로 정상 갱신됐다(browser-inspector-positive-control.json). 이 프리셋 전환의 팩터 가중치는 같으므로 가중치 숫자 자체의 불일치를 재현했다고 주장하지 않는다.
- 증거: root가 실제 Pages v58.59에서 실행한 `browser-inspector-observation.json` 및 browser-screener-before/after.txt/.png. 이 담당자는 해당 JSON의 before/after/unchanged=true를 읽어 코드 경로와 대조했다. 직접 브라우저를 실행한 것처럼 세지 않는다. 배포 버전 표시는 root의 DOM 관측이며 배포 SHA 동일성 인증을 추가 주장하지 않는다.
- 원인: selectDefinition은 activeRow를 초기화하지 않고 renderNow는 renderWhyDrawer를 갱신하지 않는다. autoInspect도 activeRow/autoInspected가 있으면 반환한다. 이전 수동 drawer에도 원인은 있었으나 이번 자동 inspector로 기본 사용자 경로에서 즉시 드러난다.
- 수정 방향: 새 프리셋/새 데이터에서 선택 symbol의 최신 row로 inspector를 다시 읽거나 선택을 해제하고 새 첫행을 선택한다. 이전 row 객체를 새 실행의 근거로 남기지 않는다.

## ACT ON UI-59-05 [medium] — 현금 제외 보유 부분의 β를 계좌 전체 움직임으로 설명

- 위치: `src/ui/components/portfolio-read.js:149`~`:158`, `:225`~`:226`, `:246`~`:247` 부근.
- 트리거: 기준 통화 USD로 주식 평가액 100, USD 현금 9900을 보유하고, 주식과 S&P 500의 가격 움직임이 같아 주식 β가 1인 35주 기록을 갖는다. 환율 문제 없이 같은 통화만 사용한다.
- 실패: portfolioLens는 value 있는 보유 종목들만 분모로 비중을 100%로 정규화해 β=1을 계산한다. hero는 “시장 1% 움직일 때 평균 1.00%”, 읽는 법 카드는 “이 계좌는 평균 1.00% 움직였습니다”라고 말한다. 실제 계좌의 주식 노출은 1%이므로 고정 현금의 수익률을 0으로 두는 동일 현재비중 계산에서 계좌 β는 0.01이다. 현금 99%인 계좌가 전액 주식 계좌처럼 보이며 현금 입력을 바꿔도 설명이 바뀌지 않는다.
- 계약 대조: 실제 derivePortfolioSurface는 positionValue=100, cash=9900, totalAssets=10000, exposurePct=1을 구분해 발행한다. 기존 portfolio-stress.js도 같은 보유 종목 내 정규화를 하지만 heading이 명시적으로 “주식 부분”이라고 한정한다. 새 hero/카드의 “이 계좌”는 그 한정을 잃었다. 기존 stress 추정기 자체의 현금 미포함을 새 결함으로 세는 것이 아니라 새 UI가 계좌 전체 수익률로 설명한 경계 위반이다.
- 실행 증거: 고정 REF FX·cash·surface 전문을 실행해 위 실제 surface를 만들고, 고정 stress-sensitivity 전문(회귀·as-of lookup·5세션 주간 추출 포함)을 실제 portfolioLens에 연결했다. 35주 β=1, R²=1을 얻었으며 동일 계좌분모 `beta × positionValue / totalAssets`는 0.01로 assert했다. stress의 buildCloseSeries만 합성 history의 `{date,key}`를 `{date,value}`로 읽는 스키마 adapter를 제공했고, 단일 USD cash 경로에서 호출되지 않는 FX history 함수는 호출 시 실패하도록 했다. bond 카드 결과는 사용하지 않는 stub이다. 외부 API·실브라우저는 실행하지 않았다.
- 최소 수정 방향: 값을 유지할 때는 hero/읽는 법 모두 “현금 제외 보유 부분의 시장 민감도”로 이름 붙인다. 계좌 민감도를 보여 주려면 cash/totalAssets가 확인된 경우 계좌 전체 비중으로 변환하고, 현금·일부 가격이 없을 때는 범위와 보류 이유를 명시한다.
- 중복 경계: domain 담당자가 재현한 기준통화 FX 누락도 동일한 “계좌 전체 기준으로 잘못 설명”하는 클래스의 별도 반례이다. 통합 보고에서는 accounts-basis 한 건으로 묶고 FX를 추가 actionable로 중복 계수하지 않는다.

## 별도 확인 후보와 제외

- β 기준통화: 새 hero가 호출하는 기존 estimateBookSensitivities는 local-currency 가격 수익률을 사용한다. KRW 계좌의 외화 수익률 설명 경계는 domain/금융 담당자에 전달했으며 독립 UI finding으로 중복 계수하지 않았다.
- 가격 누락 행은 portfolioLens의 holdings/effectiveN에서 빠지지만 hero의 주석이 “평가액 있는 N종목”을 명시한다. 이를 별도 결측 왜곡 finding으로 보고하지 않는다.

## 기타 delta 판단과 증거 한계

지식 정의 splitDefinition의 공식·주의 문장 분리와 CONCEPT_SURFACES/학습 경로 버튼, glossary close 후 screen/concept 전환, 아틀라스의 정확한 listing/층·도메인 owner 전환, masters의 CUSIP 기반 lookup·보유 검색·ticker chip, news tone 속성과 topic chip, themes chart 색상·축 글꼴 변경을 읽었다. 이 범위에서 추가 입증 결함은 없다. masters 다음 분기 기준일 계산, 누락 lookup fallback, 마지막 종가와 valuationClose 선택의 양수·날짜 guard를 코드로 확인했다. SEC 법정 마감시각/휴일 규칙을 외부 검증한 것은 아니다.

스크리너 table row cache 입력에 capOrder가 추가된 점, 정렬 alias/header aria-label, 필터/Why sheet의 Escape/Tab 경계, resize listener 해제, 사용자 클릭 없이 iPad 회전 시 sheet를 띄우지 않는 guard를 확인했다. 통과 선언은 하지 않으며 실제 keyboard·축소 레이아웃·터치·포커스 연속성은 root 브라우저 증거가 필요하다. 전체 QA·배포 상태는 이 담당 범위에서 실행하지 않았다.

## 실행

- `node _artifacts/architecture-quality-audit-20261021-v5859/ui-delta-repro.mjs` → 섹터 분모·시총 순서·IC/수익률 차이 통계·현금 포함 계좌 β 4개 관측 assert 통과, JSON 증거 생성.
- `node _artifacts/architecture-quality-audit-20261021-v5859/ui-ledger.mjs` → 31경로, FULL 4 / BASE_PLUS_DIFF 12 / INHERITED_FULL 15, 기준 해시 계승 대조 통과.

SAFETY FACT: 새 섹터 읽기의 명명된 분모가 실제 계산 분모와 같다는 계약은 반증됨(격리 실행 단계 4). 브라우저·전체 QA·배포는 미검증. 커밋·푸시·배포 없음.
