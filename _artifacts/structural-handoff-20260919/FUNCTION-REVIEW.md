# 함수·계약 검수 대장 — 전수 완료 아님

Astra 유지·설계. 최종 갱신 2026-09-21. 각 행의 함수는 해당 의미 경계를 읽은 범위이며, 파일 전체/모든 입력의 정확성 인증이 아니다. ‘정적’은 코드 추적, ‘합성’은 고정 입력 실행, ‘브라우저’는 로컬 관찰이다. 55는 v55.22, 56은 외부 미커밋 변경을 포함한 v56이다. 9/21 증분은 v56.01 기준이다. 근거가 다른 버전이면 해당 대상의 재검증 문서를 우선한다.

**v56.15 보강, 2026-09-23:** 아래 기존 표는 함수별 역사 조사 범위를 보존한다. 현재 해결/부분/열림은 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md)를 정본 색인으로 삼고, 설계·인수는 [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)와 대상 패키지를 따른다. 이 증분은 기존 70여 함수 전체 재실행이 아니다.

| 추가 함수/경계 | 새로 확인한 의미 | 증거 수준·상태 | 설계 연결 |
|---|---|---|---|
| `validateMarketSnapshot`/coverage audit | quote `metricId`만 틀린 published snapshot을 `ok:true`로 수용 | 순수 계약 함수 합성, 현재 수용 경로 확인 | 03 W03-A, 24 R24-02, 26 E1 |
| factor producer→provider→normalizer→runtime reader | barStart·session·time-basis의 일부가 전달 중 소실되고 일반 observedAt으로 노출 | 정적 끝단 경로, 실제 UI 재주입 대기 | 15 D04, 24 R24-03, 26 E1 |
| `snapshotIdentityRows`→`computeFactorRanks` size | 같은 artifact에서 live mcap 1B→10B에 AAA size 점수/순위 75/100→25/0, snapshotId도 변경 | provider+domain 합성, 같은 ID 다른 결과는 미재현 | 07,13,24 R24-04,26 E2 |
| `buildPortfolioBacktestLab` | 가격 이력 없는 의도 ticker를 제외하고 남은 멤버로 배분 | 정적 경로, missing-member 합성/UI 인수 대기 | 22/23,24 R24-05,26 E3/E4 |
| `refreshPortfolioRisk` | 현재 시세 비중을 과거 모든 일 수익률에 적용·현금 제외 | 정적 경로, 실제 계좌 성과라 부를 수 없음 | 22,24 R24-06,26 E4 |
| Vault reader→portfolio provider→surface/UI | cost/base/cash currency 전달 누락 가능, 서로 다른 통화 P&L·`$` 표기 | 정적 경로, 전체 E2E 미실행 | 11/22,24 R24-06,26 E3 |
| `buildLane`/`buildSloWindow` | push 이벤트만 있어도 scheduled arrival PASS가 가능 | 순수 SLO 합성; 실제 원격 실패 미관측 | 06/17,24 R24-07,26 E5 |
| compatibility facade→router fast path | showPage 선행 효과, 같은 route/entity의 viewState 변화 무시 가능 | 정적 경로, 실브라우저 전환 재검증 대기 | 00 W00,24 R24-08 |
| masters manager shard→summary | manager 전체와 top-10 preview count/label 혼동 | 정적 producer/renderer 경로 | 04 C03 |
| AI intent→conduct→publication | ‘나에게’ 개인화 분류와 공개 단계 제한 전달 불일치 후보 | 정적 경로, 실모델 공개 재현 대기 | 05 A06,26 E6 |

## 핵심 흐름

`instrument/universe → provider → observation/period/unit → field readiness → hard filters → factor transforms → ranking → explanation → UI/AI → saved run/replay → operation/refresh`

전 구간의 공통 질문: 무엇을 의미하는 값인가, 어느 시점에 알 수 있었나, 어느 단위인가, 무엇과 비교하나, 결측 때 어떻게 바뀌나, 누가 계산을 소유하나, 어디에 표시·전송되나, 같은 입력으로 재현되는가.

| 경로/함수 | 검토 의미 | 증거/상태 | 연결 |
|---|---|---|---|
| market-snapshot: validateMarketSnapshot / tier0Coverage | 선언/실측coverage·unit |55합성문제,56동일반증차단 |03,D01 |
| market-snapshot-loader의 수용 경로 | published 승격 |55정적,56추가통합필요 |03 |
| market.js quoteValue/renderLiveQuotes | 값·현재성·lineage |55정적,56미재검증 |03,D02 |
| fetch-sec-fundamentals factRows | taxonomy/unit 선택 |Luna정적,unit보존추적필요 |09 |
| annualDurationRows / instantRows / dedupeLatestFiled |기간·정정 선택 |55정적,56전체회귀미실행 |09 |
| acceptedAtByAccession / buildPointInTimeFacts |공개시각·accession |55정적,과거filing확장미검증 |09 |
| normalizeSecCompanyFacts |피연산자·파생시점 |55합성문제,56동일반증차단 |09,F01/F02 |
| classifyIssuerCapability / refreshSecFundamentals |CIK/지원범위/분모 |Luna정적,공급자실행미검증 |09 |
| fetch-data enrichSecFundamentals / enrichFundamentals |FY/TTM 혼합·품질라벨 |Luna정적,56전수미재검증 |09 |
| getScreenerUniverse / fetchHistory / _enrichPriceFactors |universe/가격기준 |Luna부분추적,기업행동후속 |07,09 |
| buildFieldReadiness / fieldObservationContext |field별가용성 |Luna부분추적,전수미완료 |09 |
| factor-ranks momRaw / trendRaw |다중기간 가중·결측재정규화 |55정적;각창 golden미실행 |07 |
| lowvolRaw / sizeRaw / valueRaw / qualityRaw / kalmanRaw |방향·변환·clamp |55정적;산업적타당성후속 |07 |
| stats / guardedStats / winz / z2pct |표준화·이상치·백분위 |55정적;MAD0/소표본후속 |07,M03 |
| factorLineage / factorEvidenceUsable |시각·허용용도·품질 |55정적;session정책후속 |07 |
| sanitizeWeights / computeFactorRanks |요청기준·active집합·동점 |55합성문제,56동일반증차단 |07,M01 |
| deriveTurnoverStability / deriveRegimeStability |멤버십안정성과거래회전율구별 |55정적;시계열fixture미실행 |07 |
| factor-weights deriveFactorWeights |profile/regime/promotion |부분읽기;전체검수미완료 |후속 |
| screen-engine valueAt / readinessAt / auditRequiredFields |실제값·준비상태일치 |55정적;상충값후속 |07 |
| evaluateNode / nullResult |3값논리·결측정책 |55정적;AST 조합회귀후속 |07 |
| contributionFor / makeExplanation / runScreen |필터와순위·동점·근거 |55합성문제,56동일반증차단 |07,M02 |
| captureScreenRun / replayScreenRun |불변입력·hash·version |55정적;실제저장replay후속 |07 |
| createDefaultScreenDefinitions / summarizeScreenReadiness |preset목적·분모 |55정적;6preset 전수UI후속 |07 |
| longrun fetchDailyBars |adjusted/raw 구별 |55정적문제,56미재검증 |07,M04 |
| longrun computeICIR |중첩창 추론 |55정적,56미재검증 |07,M05 |
| fetch-data backtestFactors |calendar정렬·4/7한계 |일부경로읽음,전체미완료 |07 |
| portfolio buildPortfolioBacktestLab |월별grid·연율화·비용한계 |55합성문제,56동일반증차단 |07,M06 |
| _aioBtMonthEnds / _aioBtMonthDiff |월말/실제경과기간 |부분읽기;정렬·중복후속 |07 |
| computeMarketHealth |표본·component·행동표시 |55합성문제,56동일반증차단 |08,H01 |
| computeTradingScoreModel / deriveTradingScoreComponents |중복기여·임계값·coverage |Luna정적;예측력미검증 |08,H03 |
| deriveSignalDecisionFromTradingScore / deriveTradingScoreDecisionPresentation |참고/행동경계 |Luna정적;모든UI후속 |08 |
| deriveMacroTransmissionEvidence / renderMacroTransmissionLens |단계partial·인과고지 |Luna정적,56미재검증 |08,H04 |
| renderMacro / deriveTreasuryCurveEvidence |2s10s 두시점 |55정적문제,56미재검증 |08,H02 |
| classifyMovingAverageStructure / deriveMultiTimeframeView |MA stage·warmup |56정적;부분입력소비자후속 |10 |
| deriveTechnicalStageFromOhlcv |time 타입·연속tail |56합성 계약경계 |10,T03 |
| _calcSMA / _calcEMAFull / _calcATR / _calcRSILast / _calcMACD |전처리·window·seed |56정적부분,수학인증아님 |10 |
| computeRelativeRotation / classifyRRG |주기·datejoin·마지막결측 |56합성/정적문제 |10,T02 |
| calcLiveRS / collectPriceHistory / hydrateRRGDailyHistory |tick/daily 연결 |56정적;실제혼합빈도미검증 |10 |
| calcCompositePerf / getThemePerf |명시0·mcap·현재성 |56합성/정적문제 |10,T01 |
| normalizePortfolio / derivePortfolioSurface |통화·빈상태·평가완전성 |55/56합성 |02,11 |
| deriveConcentrationRisk / concentrationPenaltyForWeight |가치분모·원가fallback |56읽음;후속합성필요 |11후속 |
| getPortfolioData / savePortfolioData / addPosition |저장실패와UI완료 |56합성/정적문제 |11,P11-01 |
| createPrivacyVault / createVersionedRepository |암호화capability·migration |56정적;실제Vault인증아님 |11 |
| getPortfolioAIPrivacyPreview / _aioBuildPortfolioActionPrompt |session동의·전송경계 |56부분추적;전체전송미완료 |11 |
| createIssuerAggregateView |manager범위·집계단위 |55정적문제,56미재검증 |04,C01 |
| build-knowledge-domain-dossiers 생성경로 |KPI/질문/valueChain분리 |55정적문제,56미재검증 |04,C02 |
| _parseRssXml / fetchNews / normalizeNews / createNewsCard |제목·출처·시각 |Luna정적;56UI미재검증 |09,F03 |
| _fmtTickerNewsMemo / deriveTickerNewsLineage / _enrichTickerNews |개별기사lineage손실 |Luna정적 |09,F03 |
| createAIAnswerOrchestrator / question-planner |계획·정책·legacy실행 |정적;실제답변미검증 |05예정 |
| AI research preparation / streaming guards / claim ledger |근거충분성과공개시점 |정적후보;적대적fixture필요 |05예정 |

## 2026-09-21 증분

| 함수/경로 | 확인한 경계 | 증거/상태 | 핸드오프 |
|---|---|---|---|
| `_calcWeeklyContext` → `analyzeTickerDeep` 설명 | 부족 기간 SMA 축소·동률 bearish | 실제 함수 합성 재현, 해당 UI 주입 미실행 | 14 T04 |
| `_calcVCP` / `_calcVcpQuality` | 같은 이름의 다른 기준 | 정적 확인, 모델별 성능 미검증 | 14 T05 |
| `_assessEntryQuality` / `calcSellPressure` / `calcExitPlan` | 규칙→행동·기여·적용 조건 | 정적 확인, 투자 성능 인증 아님 | 14 T06 |
| `validateAnswerPlan` → publication → renderer | bound claim과 자유문장 수치 | 합성 공개 결과 일부 숫자 잔존 | 05 A04 |
| native citations → research floor | 요청 소유권·질문 관련성 | floor 합성, 실제 교차 요청 미재현 | 05 A05 |
| intent / suitability / conduct → chat | 개인화 분류·limitation 전달 | 모듈 합성 + 정적 소비자 추적 | 05 A06 |
| screener base run / selectDefinition / execute | 선택 프리셋과 미리보기 | 같은 선택 화면에서 readiness 미리보기 703 / preset 실행 286 | 12 U01 |
| manager shard producer → issuer aggregate renderer | 전체/manager/preview 집계 | 실제 shard + 로컬 브라우저 | 04 C03 |
| fetchHistory → price factors → enrichScreener → render | bar start와 종가 관측시각 | 정적 + 실제 artifact, PIT 손실 미재현 | 15 D04 |
| universe → provider → instrumentRef | MIC·assetType 필수 필드 | 실제 파일 기반 provider 실행 | 15 D05 |
| liveEnrichment / provider merge | 누락 통화로 기존 통화 소실 | 합성 입력만 재현, 실데이터 발생 미확인 | 15 D06 |
| SLO fetchRuns / summarize / windowSummary | 미실행·빈 도메인·예정 주기 | 실제 스크립트 network mock, 0회 screener에도 인증 | 17 O04 |
| buildOperationsStatus browser plane | 설정과 실측 구분 | CURRENT 하드코딩 정적 확인, 사용자 표시 전수 미확인 | 17 O05 |
| SEC batch producer → validators → publication | 수집 실패와 이전 값 보존 | 정적 추적·현재 artifact 대조, 전체 timeout 주입 미실행 | 17 O06 |
| Pages attestation → provider multi-fetch / SW shell | 배포 SHA와 소비 묶음 호환성 | Astra 정적 확인, 전환 중 혼합 오류는 미재현 후보 | 17 O07 |
| refresh-web-research / scheduled fetch-data | 고정 snapshot·실제 fetch·보존 | 정적 확인, AAII 외 범용 검색 job 아님 | 18 W01 |
| research document → evidence binding → data consumers | 검색 문서와 정형 observation 경계 | 정적 경로에 durable 숫자 승격 없음 | 18 W02 |

## 놓치지 않기 위한 다음 조사 큐

9/22 증분: `updatePatternSignals`의 HYG null 비교→toFixed는 실제 양쪽 브라우저 예외와 로컬 코드로 확인했다(21 B02). 포트폴리오 초기배분·현금분모·RF·benchmark·tail표본은 Luna MAX 코드/합성 조사 후 Astra가22에 재설계했다. 원시 probe 재실행은 구현 인수에 남겼다. 20개 라우트 양쪽 방문의 의미 비교표는21이며 함수 전수 완료를 뜻하지 않는다.

1. 금융 데이터 식별: symbol alias/venue/share class/ADR, delisted·합병·분할·배당, 조정계수, FX 기준과거래캘린더, 숫자0/음수/소수 단위.
2. 분석: sector별 ratio 비교, ROE 평균자본·EPS/주식수 기준, VCP·volume profile·divergence, 옵션 Greeks/payoff, Kalman noise 선택, rank sensitivity, 중복종목/ETF look-through exposure.
3. 운용 재현: PIT universe, revision/as-of, restatement policy, provider schema 변경, stale fallback, refresh 동시성·부분성공·원자적publication, 모델변경 migration, 데이터권리와허용용도.
4. 사용자 동선: 스크린 정의→통과/제외 이유→종목 상세→저장실행→재현, keyboard/focus, 단위와분모, partial/loading/error recovery, old/new run 혼합, 과도한매매행동문구.
5. 보존·신뢰: Vault 잠금/복구, 저장quota/충돌, import/export, AI동의·민감정보·prompt injection·claim충분성, 취소와최신요청소유권.
6. 운영: 실제deploy revision, SW old/new asset 혼합, runtime cache TTL, rate limit/backoff, provider 장애와공식휴장 구별, 알림/SLO 수집완전성, QA gate 선택누락과의미fixture.

이 큐를 파일명 목록만 훑는 검사로 대체하지 않는다. 후속 증분마다 작은 함수 집합을 입력→계산→소비자까지 닫고 증거/설계를 붙인다. 남은 범위는 숨기거나 전체PASS로 바꾸지 않는다.
