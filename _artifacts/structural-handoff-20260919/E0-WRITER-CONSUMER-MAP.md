# E0 — 현재 writer/소비자 맵, 기준 SHA, 저장 포맷, deprecated reader, shadow 종료 조건

2026-09-23 · [26 실행 카드 E0](26-EXECUTION-AND-ACCEPTANCE-PLAN.md) 산출물. 기준: v56.15, HEAD `2195722dab571eaca0335249d02e84abdd128e94`, QA 세션 기준선 `handoff-impl-20260923`(2,836 파일 content-hash). 증거 수준: 정적 코드 추적(파일:라인). 라이브·브라우저 인증이 아니다. 이 문서의 기록은 설계 문서 작성이며 승격·배포가 아니다.

## 1. 스크리너 수직 경로 (E2 대상)

### Writer

| 단계 | 위치 | 내용 |
|---|---|---|
| preset 정의 | `src/domain/screener/screen-engine.js:250` `createDefaultScreenDefinitions()` | 6개 preset(quality/momentum/trend/lowvol/balanced/breakout-observation) |
| 정의 저장 | `src/domain/screener/saved-screens.js:22` `createSavedScreen()` (schemaVersion 2), `src/ui/pages/screener.js:1304` `saveCurrentScreen()` | Redux 세션 저장(`state.screener.savedScreens`), 영구 저장 아님 |
| 미리보기 | `src/app/bootstrap.js:398-403` `previewScreenerDefinition()` | 같은 rows/snapshotId로 `runScreen`, capture/persist 없음 |
| 실행 | `src/app/bootstrap.js:385-394` `runScreenerDefinition()` | `runScreen` → `captureScreenRun` → archive `put` |
| 판정 | `src/domain/screener/screen-engine.js:145` `runScreen()` | screenStatus/rank/rankExplanation/resultHash |
| 저장 레코드 | `src/domain/screener/screen-engine.js:213` `captureScreenRun()` | `screener-run-record.v1` + `contentHash` |
| 파이프라인 | `src/data/orchestrators/screener.js:28-163` `sync()` | rows/lastRun/runHistory/workbench metadata |
| artifact reader | `src/data/providers/screener.js:210` `readCurrent()` | `snapshotId` content-addressed(L544), `fieldReadiness` |
| legacy projection | `js/aio-data.js:5248` `_aioApplyNativeScreenerState()`, `:15254` `updateScreenerFromLiveData()`, `:15389` `_aioComputeFactorRanks()` | `SCREENER_DB` 이중 writer |

### 저장 포맷

- IndexedDB `aio-screener-runs` v1 / store `runs` / keyPath `id` (= runId): `{id, savedAt, sequence, record}` (`src/storage/screener-runs.js:10-13`), 보관 기본 5·상한 20.
- `record.schemaVersion: "screener-run-record.v1"`, `record.engineVersion: "screen-engine.v5"` (**E0 관측 시점**; P1180 이후 신규 record는 `screen-engine.v6` + `record.run.calculationInputId`/`factorInputPolicy`를 싣고 `replayScreenRun`이 v5/v6을 각각의 identity semantics로 분기한다), `record.contentHash`.
- localStorage 스크리너 전용 키 없음. preset savedScreens는 Redux 세션 한정.

### Consumer

- UI: `src/ui/pages/screener.js` — render(:832), Why drawer(:1046), 보관 목록(:1126), replay(:1143-1154 `workbench.replay` → `replayScreenRun` screen-engine.js:228, 해시 무결성 검증).
- AI: `js/aio-data.js:16603` `_aioRunScreenerQuery()`, `:16742` `_formatScreenerResultPrompt()` — `js/aio-chat.js:6361-6365`(일반), `:8652-8659`(통합) 두 곳에서 호출.
- 교차: `js/aio-kr-data.js:2794`, `js/aio-pages.js:126`, `src/data/runtime-readers.js:269-346`, `src/legacy/compatibility-facade.js:328`.

### deprecated reader / 이중 경로 (shadow 종료 대상)

| # | 위치 | 사유 | shadow 종료 조건 |
|---|---|---|---|
| S-A | `js/aio-data.js:1816` `renderScreenerResults()` | `aio:screener:render-request` dispatch만 하고 리스너 부재 → no-op | **퇴역 완료(P1185, 2026-09-24)**: 리스너 0 확인 후 함수·호출 삭제, `route-owners.json legacySymbolsMustBeAbsent.screener`에 심볼 등록으로 재등장 차단(`ci-retirement-contract`). 브라우저 페이지 순회는 미검증(데이터 노후 SKIP) |
| S-B | `src/data/runtime-readers.js:612` `readScreener()` | `root._aioScreenerRows` 전역 할당 부재 → 항상 빈 행(죽은 reader) | **퇴역 완료(P1185, 2026-09-24)**: 소비 0(grep — facade는 자기 reader 사용) 확인 후 reader·export 삭제, `ci-runtime-contract-check`가 재도입을 차단 |
| S-C | `_aioGetCanonicalScreenerRows`(aio-data.js:976) vs facade `readScreener`(compatibility-facade.js:328) | 같은 행을 서로 다른 fallback 체인으로 2회 구현 | 한 owner(reader)로 합칠 때까지 shadow 비교: 같은 입력 → 같은 행 집합 |
| S-D | `_aioApplyNativeScreenerState` 이중 트리거(이벤트 :5335 + 직접 :5983) | 같은 상태를 두 번 읽어 legacy projection을 덮어씀 | 단일 트리거 전환 후 projection diff 0 |
| S-E | AI 소비 이중 구현(aio-chat.js:6361 / 8652) | 같은 함수 쌍을 두 채팅이 각각 호출 | 공통 helper 추출 후 동일 결과 확인 |
| S-F | IDB `AIOScreenerDB`(aio-data.js:5160) | 뉴스 전용인데 스크리너 명칭 — 실제 run 저장소와 혼동 | 개명/주석 정리, 쓰기 경로 이전 |

## 2. 포트폴리오 배분/백테스트 (E3·E4 대상)

### AllocationDefinition writer와 정규화 지점 (P1176/PFR 문맥)

| 위치 | 동작 |
|---|---|
| `js/aio-workspace.js:376-377` `addPortfolioPosition()` | `parsedTarget > 0 ? parsedTarget : null` — target 0/빈칸 → null (P1176 legacy 직렬화) |
| `src/data/runtime-readers.js:22-25` `optionalPrice()` | target: `>0` 아니면 null |
| `src/data/runtime-readers.js:19-25,582` | targetWeight는 `optionalNumber`로 0 생존 |
| `src/data/normalize/portfolio.js:46` | `target: positiveFinite` → 0→null |
| `src/data/normalize/portfolio.js:47,19-22` | `targetWeight: weightPercent` → 0→0 유지 (0≤n≤100) |
| `src/legacy/compatibility-facade.js:266-279` | **targetWeight 필드 매핑 없음 → 드롭**, target은 `>0`만 |
| `src/domain/portfolio/backtest.js:368-396` | 명시 targetWeight 합>0이면 정규화, 아니면 종점 시장가치 basis (`targetWeightBasis` :370) — **`[0,0]`/`[0,null]`이 explicit label로 폴백 (23:PFR07)** |
| `src/domain/portfolio/backtest.js:272-275` | 가격 이력 없는 ticker 선제외 → 잔여 100% 재정규화 (22:PFR08 / R24-05) |

주의: `targetWeight`·`sector`는 여전히 앱 writer가 없고 import(`importPortfolio` js/aio-workspace.js:1455-1482)·수동 편집으로만 유입된다. 종전 `js/aio-workspace.js:398` 갱신 경로는 기존 position을 통째로 교체해 `sector`/`targetWeight`/`currency`/`costCurrency`를 유실시켰으나, **P1187이 `{ ...positions[existing], ...폼 필드 }`로 바꿔 비폼 필드를 보존**한다. `costCurrency`는 이제 폼(`pf-add-cost-currency`)이 writer다.

### 백테스트/위험 결과 저장

- 백테스트 run은 **영속화되지 않음**: `js/aio-workspace.js:1292` `window._lastPortfolioBacktestLab` 메모리 전역, 직렬화 없음. reload 시 재실행 재계산만 가능. 계약 확인은 `scripts/ci-runtime-contract-check.mjs:231`.
- 위험 `refreshPortfolioRisk`(`js/aio-workspace.js:831`) 결과도 DOM 렌더만(`:931` `_renderRiskMetrics`), 저장 없음. 현재 시세 비중을 과거 모든 일 수익률에 적용 + 현금 제외 (R24-06 legacy-risk-path).
- 별도 지속 저장: `aio_portfolio_journal_v1`(일지, 백테스트 결과 아님).

### Portfolio 저장 포맷

- 키 `aio_portfolio_data` (`js/aio-workspace.js:210`): `JSON.stringify(positions)`, position `{ticker, qty, cost, target|null, memo, addedAt, updatedAt}` (+import 유입 `sector,targetWeight,note,currency,costCurrency`).
- PIN 설정 시 `aio_enc::` AES-GCM-256+PBKDF2 (`js/aio-core.js:17363-17418`), opt-out 키 `aio_portfolio_vault_optout`.
- 부속: `aio_portfolio_cash`(평문), `aio_portfolio_journal_v1`.

### 통화 필드 소실 지점 (E3 선행)

| 필드 | 드롭 지점 |
|---|---|
| `holding.currency`/`costCurrency` | ① `src/data/runtime-readers.js:582` 매핑 필드 목록에서 제거(upstream 소실) ② `src/domain/portfolio/surface.js:187-203` row가 `currency`만 담음 |
| `baseCurrency`/`cashCurrency` | `src/data/providers/portfolio.js:29-39` 반환 객체가 명시 필드만 나열 → 드롭 |

→ P1181이 ①·②(reader 매핑·provider 반환)를 고쳤고, P1187이 **종목 원가 통화** writer(`pf-add-cost-currency`)를, P1188이 **계좌·현금 통화** writer(`pf-base-currency-input`/`pf-cash-currency-input`, 키 `aio_portfolio_base_currency`/`aio_portfolio_cash_currency`)를 추가했다. 남은 것은 FX 환산·cut이다. CI는 모듈을 직접 입력으로 테스트(`scripts/ci-esm-core-unit-check.mjs:1308-1332`)라 통화 폼 입력 왕복은 `ci-portfolio-vault-e2e`(PFE2-12·PFE2-15)로만 검증된다.

### deprecated reader / 이중 경로

| # | 위치 | 사유 | shadow 종료 조건 |
|---|---|---|---|
| P-A | `src/legacy/compatibility-facade.js:247-290` `readPortfolio` | runtime-readers와 다른 매핑으로 같은 Vault를 2회 구현, targetWeight·통화 드롭 | native store가 단일 owner일 때까지 두 reader 출력 shadow diff 0 |
| P-B | `js/aio-workspace.js:572-673` `renderPortfolio()` + `:755` `updatePortfolioSummary()` | 세 번째 직접 reader + 자체 totals | `_nativePortfolioTable` fence 제거 후 단일 렌더 확인 |
| P-C | `js/aio-ui.js:2555-2579` `_buildSectors()` | 폐기 키 `localStorage['aio_portfolio']`(sym 스키마)로 섹터 계산 | 현행 데이터로 동일 섹터 결과 확인 후 제거 |
| P-D | `js/aio-chat.js:5941-5948` `_simulatePortfolioAddition()` | `window.getPortfolioState` 미정의 + 폐기 키 `aio_portfolio_v1` fallback, `h.quantity`≠현행 `qty` → 사실상 죽은 reader | 호출 0 확인 후 삭제 |
| P-E | `getPortfolioState` 3중 호출(runtime-readers.js:569,573 / compatibility-facade.js:249 / aio-chat.js:5943) | 정의/할당 전체 저장소에 부재 → 항상 `getPortfolioData()` fallback | 정의를 만들거나 호출부를 제거 |
| P-F | 현금 `aio_portfolio_cash` 4중 read(workspace:667,760 / facade:285 / runtime-readers:587) | 통화선언 없는 숫자 합산 | cash 통화 envelope 도입 후 단일 reader |

## 3. 시세 metric/팩터 시간 (E1 대상)

### quote 검증 경로

- registry: `src/data/contracts/market-snapshot.js:13-30` `TIER_0_INSTRUMENTS` (16행, `{instrumentId, metricId, unit}`).
- validator: `:106-141` `validateMarketSnapshot` — metricId는 존재(truthy)만 검사(:130), registry 대조 없음(R24-02). `:150-188` `auditMarketSnapshotCoverage`는 unit만 대조(:167).
- `:57-86` `normalizeQuote` — `:65` metricId 누락 시 registry fallback 보증 → 잘못된 비-null 값은 그대로 통과, `:71` source 기본값 → 존재 검사 공허.
- 호출: `scripts/build-market-snapshot.mjs:245`, `worker/data-plane.js:168`, `src/data/market-snapshot-loader.js:52`, 게이트 `scripts/ci-market-snapshot-contract-check.mjs`.
- producer는 둘 다 `metricId: instrument.metricId`로 registry에서 복사(build-market-snapshot.mjs:192, worker/data-plane.js:105) — 정상 경로에서는 일치.

### 팩터 시간 필드 전달 (R24-03)

- producer: `scripts/fetch-data.mjs:2701-2711` — `factorObservedAt/factorBarStart/factorSessionDate/factorSessionTimezone/factorTimeBasis/factorComputedAt/factorQuality` 정상 생산. artifact metadata :2913-2920.
- **소실 1**: `src/data/providers/screener.js:347-389` 행 빌더가 위 5개 중 4개(fieldBarStart/SessionDate/SessionTimezone/TimeBasis/ComputedAt) 미복사.
- **소실 2**: `src/data/providers/screener.js:549-596` metadata 재구성에서 `factorSessionDateByMarket/factorBarStartByMarket/factorTimeBasis/factorComputedAt` drop → UI가 읽는 `metadata.factorSessionDate` 미생성.
- **소실 3**: `src/data/normalize/screener.js:4-119` 화이트리스트 미통과.
- 소비: `src/ui/pages/screener.js:904` `metadata.factorSessionDate || metadata.factorObservedAt` — 항상 폴백(bar-start 날짜가 세션일로 표시). `src/data/runtime-readers.js:306,333` basis 없는 `observedAt` 재노출.
- `factorQuality` CURRENT = `fetch-data.mjs:2711` `observedAt ? 'CURRENT' : 'MISSING'` + 소비측 `factor-ranks.js:195-196` STALE/MISSING·4일 경과만 기각 → timestamp 존재가 CURRENT 충분조건.

### deprecated reader / 게이트 공백

| # | 위치 | 사유 | shadow 종료 조건 |
|---|---|---|---|
| M-A | `auditMarketSnapshotCoverage` 미사용 경로 | loader는 `validateMarketSnapshot`만 호출 — metricId 대조 없음 | validator fail-closed 전환 후 정상 snapshot 수용(positive control) 유지 |
| M-B | 게이트 tamper 케이스에 metricId 없음 (`ci-market-snapshot-contract-check.mjs:112-117`) | unit/instrument/duplicate만 tamper | metricId tamper 반증 추가 후 회귀 차단 |

## 4. 변경 전후 입력·결과 차이표 (템플릿)

각 구현 카드가 종료될 때 이 표의 행을 채운다.

| 카드 | 입력 fixture | 변경 전 결과 | 변경 후 결과 | 증거 수준 |
|---|---|---|---|---|
| E1 metricId | 정상 16 quote / metricId만 wrong | 양쪽 `ok:true`(R24-02) | wrong 거부 + 정상 수용 | 순수 합성 (P1178, `ci-market-snapshot-contract-check`) |
| E1 identity 잔여 | source/sourceKind 부재 quote, valueKind 다른 quote, 손상 registry, 종전 valueKind 없는 artifact | source/sourceKind는 `'unknown'`/`'provider'`로 승격돼 `ok:true`, valueKind·sourceKind 무검증, registry 자체 오류도 16/16 matched, valueKind 모순 quote도 coverage 16/16 | 부재는 존재 검사 발화(`quote_source_missing`/`quote_sourceKind_missing`), valueKind 모순은 `quote_value_kind_mismatch` + coverage −1, 미인식 sourceKind는 fail closed, 손상 registry는 `registry_invalid:*`, 종전 artifact는 registry 파생으로 계속 16/16 | 순수 합성 + loader E2E (P1183, `ci-market-snapshot-contract-check`) |
| E1 시간 | producer→UI 행 단일 필드 추적 | 5개 필드 소실·세션일 폴백 | 끝단까지 동일 필드 보존 | 정적→ fixture (P1179, `ci-data-pipeline-contract-check` 전달 fixture) |
| E1 품질·basis | 마지막 봉이 오래된 factor 행(30일), `factorTimeBasis`/`factorBarStart`/`factorSessionDate`가 있는 행 | producer가 시각 존재만으로 `CURRENT`(소비측은 4일 초과로 차단 — 라벨·판정 불일치), evidence는 observedAt만 노출 | age 판정 `STALE`(+`ageMs`·`basis`)로 라벨·판정 일치, `factorEvidence`가 timeBasis·barStart·sessionDate 발행(미선언 행은 null, 차단 없음) | 순수 합성 (P1184, `ci-data-pipeline-contract-check` + `ci-research-model-contract-check`) |
| E2 정체성 | 동일 artifact, live mcap 1B→10B | score/rank/snapshotId 동시 변 (R24-04) | artifact 기본 정책에서 ID·rank 불변 | 합성 (예정) |
| E3 배분 | `[0,0]`, `[0,null]`, 누락 멤버 | 폴백·재정규화 (PFR07/R24-05) | 차단/명시 정책, 재정규화 금지 | 합성 (예정) |
| E3 통화 writer·ack | `pf-add-cost-currency` 빈/`krw`/`US` 폼 입력, import·전체삭제 persist 거부 | 통화 선언 입력 경로 0곳(import 우회로만), 수정 경로가 비폼 필드 삭제, import·전체삭제가 ack를 버려 거부에도 완료 표시 | 폼→저장 왕복(빈=null·무효 거부), `...existing` 보존, 실패 ack에서만 보류 문구 | 브라우저 (P1187, `ci-portfolio-vault-e2e` PFE2-12/13/14) + 소스 계약 (`ci-esm-core-unit-check`) |
| E4 위험·성과 | 무게치 폴백 종점 이동(95.24→80/20), RF 상수 라벨, 표본·꼬리 없음 VaR, sleeve가 계좌처럼 렌더, 원장 없는 성과 표시 | 시작 basis 불변(종점 이동 무변경), 계좌 −5%/주식 −10% 분리 선언, certification held, ledger 보류 + snapshot/estimate ID | 순수 합성 + 소스 계약 (P1182 15종, headless T845 — 실브라우저 패널 표시는 미검증) |
| E4 통화·수익률·성과 엔진 | 계좌/현금 통화·현금 수익률·RF 미선언 상태, 원장(거래+평가액) 입력 경로 없음, 목표비중 전략 입력, VaR 표본 안정성 미측정 | 계좌/현금 통화·RF 입력 경로 0곳이라 계좌 범위·Sharpe 영구 보류, 원장을 줘도 `account-performance-engine-not-wired`이고 원장을 넣을 UI도 0곳(`ledger: null` 하드코딩), 전략 경로 `exposure-path-not-wired`, `varCertification`이 '검증 부재' 라벨로 영구 보류 | 선언값만 사용(빈 값=미선언·무효 거부), 원장 계약 충족 시 TWR/MWR 계산(무흐름 0.21·흐름 시점 규약 차이), 전략 경로 표류/재설정, 표본 파생 시드 부트스트랩 밴드 + 민감도 3종으로 임계값 통과 시에만 `certified`, 원장 UI가 Vault 경로에 저장하고 패널이 실제 판정을 게시 | 순수 합성 (P1188·P1190·P1191, `ci-esm-core-unit-check`) + 브라우저 (`ci-portfolio-vault-e2e` PFE2-15·PFE2-16) |
| E5 SLO | push만 성공 | schedule PASS (R24-07) | schedule 0/N, PASS 금지 | 합성 (예정) |

## 5. E0 판정

- 기준 SHA·세션 기준선 확보 완료. writer/consumer/deprecated/shadow 종료 조건 위 표로 기록.
- `기존 run/portfolio 사본 export·복원`: 스크리너는 `captureScreenRun`→`replayScreenRun` contentHash 무결성이 기존 CI(`ci-screener-workbench-contract.mjs:197-199`)에 존재. 포트폴리오 백테스트 run은 저장 경로 자체가 없어(위 2절) export·복원 대상이 성립하지 않음을 현행 사실로 기록 — E3에서 저장·재현 여부를 먼저 결정한다.
- 이 문서는 기록 산출물이며 제품 코드·게이트 변경은 포함하지 않는다. 구현 변경은 각 카드에서 새 P 항목과 assertion trace로 수행한다.
- 갱신 이력: E1 종료(2026-09-24, v56.18) — P1178·P1179·P1183·P1184 행을 위 4절 표에 채웠다. **E2 착수(2026-09-24, v56.18·P1185)**: S-A·S-B 퇴역 완료(위 1절 표), S-C~S-F는 shadow 비교·공통 helper·단일 트리거가 선행돼야 해 미착수. **E3 착수(2026-09-24, v56.19·P1187)**: 통화 writer·수정 경로 보존·import/전체삭제 ack를 구현해 4절 표에 E3 통화 행을 채웠다(계좌 통화 입력 writer·FX 환산·cut은 미착수). **E4 착수(2026-09-24, v56.20·P1188)**: 계좌·현금 통화+현금 수익률·RF writer, TWR/MWR 원장 엔진, 고정 목표비중 전략 경로를 구현해 E4 통화·수익률·성과 엔진 행을 채웠다 — FX 환산·cut과 원장/전략 입력 UI는 미착수. E3 배분·E5 행은 각 카드 종료 시 채운다.
