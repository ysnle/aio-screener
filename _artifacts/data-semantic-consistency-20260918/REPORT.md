---
title: AIO 데이터 파이프라인 전수 의미·정합성 감사
audit_date: 2026-09-18
audit_revision: v55.01
local_head: ff4e37c9
scope: public-data/ 전 산출물(중첩 포함) · 생산자 · 소비자 · 계약 · 게이트의 값↔라벨↔단위↔시각 의미
evidence_levels: static (repo·산출물 직접 정독) + runtime (로컬 게이트 재현·직접 재계산)
baseline: qa-runner session data-semantic-20260918 (2508 files)
---

# 데이터 파이프라인 전수 의미·정합성 감사 (2026-09-18)

## 0. 이 감사의 위치

`_artifacts/automation-audit-20260917/REPORT.md` §10은 의미·정합성 검토를 **6건(S1~S6) 샘플**로 수행했고, §10.4에 미검증 항목을 스스로 남겼다. 이번 감사는 그 표본을 **전 요소 전수 재계산**으로 대체한다.

- 모든 수치는 이 세션에서 실제로 계산한 값이다. 정적 인용이 아니라 재계산·재현으로 확인했다.
- 보고서가 주장하지 않는 것은 §7에 명시했다(**미검증 경계**).
- 커밋·푸시·배포는 수행하지 않았다. 로컬 체크아웃 기준이며 라이브 배포 상태는 측정하지 않았다.

측정 시각: 2026-09-18T14:00Z (로컬 HEAD `ff4e37c9`, version `v55.01`).

---

## 1. 판정 요약

| 영역 | 전수 의미 검사 결과 |
|---|---|
| 교차 산출물 리비전 결속 | **일치** (8곳 전부 동일 리비전) |
| 산출물 내부 산술(파생값) | **일치** (breadth·changePct·t10y2y·AAII·krExports·리비전 파생) |
| 지식/아틀라스/원리 카운트 | **일치** (455·160·212·274·169·227·217 전부 재계산 일치) |
| 13F 농도·집계 | **일치** (정규화 키 집계 기준, 소수 4자리까지) |
| 발행 라벨 ↔ 실제 의미 | **19건 불일치** (§2) |
| 게이트가 못 보는 의미 축 | **8개 축** (§4) |

핵심 결론: **"구조는 닫힌 루프, 의미는 여전히 부분 개방"** 이다. 이전 감사의 S1~S6 중 S2·S1·S4는 **프로듀서만 수정되고 발행 산출물에는 미전파**됐으며(§5), 새로 14건이 확인됐다.

---

## 2. 확정 결함

각 항목은 `증상 → 근거(file:line) → 측정값 → 게이트 상태 → 영향` 순이다.

### D1 (높음) — 살아있는 산출물 안에서 영구 동결되는 필드 4종

`data.json`은 30분마다 갱신되지만, 그 안의 일부 블록은 **이전 산출물을 그대로 승계해 절대 갱신되지 않는다.**

- `scripts/fetch-data.mjs:3406-3414` — `marketSurveys = previousMarketSurveys ? { ...previousMarketSurveys, automatedCheckedAt, aaii } : {...}`. spread가 `checkedAt`을 덮지 않으므로 **한 번 기록된 값이 영원히 유지**된다.
- `scripts/fetch-data.mjs:3608` — `officialWebReferences: previousOfficialWebReferences` (순수 승계).
- 이 값들의 유일한 생산자 `scripts/refresh-web-research.mjs`는 **어느 워크플로에도 배선되지 않았다** (`.github/` 전체 grep 0건).
- `scripts/fetch-data.mjs:3588` — `marketSurveysStatus: 'web-research-captured-reference'` 하드코딩(나이와 무관).

측정값(`public-data/data.json`):

| 필드 | 값 | 나이 |
|---|---|---|
| `marketSurveys.checkedAt` / `meta.marketSurveysCheckedAt` | `2026-08-21T15:00:00Z` | 28일 |
| `marketSurveys.automatedCheckedAt` | `2026-09-17T12:34:20.484Z` | 현재 |
| `marketSurveys.aaii.fetchedAt` | `2026-09-17T12:34:20.484Z` | 현재 |
| `marketSurveys.naaim.observedAt` | `2026-07-22` | 58일 (동결) |
| `officialWebReferences.krExports.observedAt` | `2026-07-01` | 79일 (동결) |

**게이트 상태:** `scripts/ci-web-research-contract-check.mjs:65-66`이 `data.meta.marketSurveysCheckedAt === structural-data-research.checkedAt`을 요구해 **동결을 계약으로 고정**한다. 이 게이트는 `watchdog-local` 프로파일 전용이라 `contracts`/`affected` 경로에서는 실행되지 않는다.

**영향:** 같은 객체에 `checkedAt`(28일)과 `automatedCheckedAt`(현재)이 나란히 있고, 이름상 "확인 시각"으로 읽히는 쪽이 동결된 값이다. `naaim`/`investorsIntelligence`/`krExports`는 자동화로는 갱신 불가능하다.

### D2 (높음) — `newsSourceCount`가 다른 의미의 수를 발행하고 아무도 읽지 않는다

- `scripts/fetch-data.mjs:3577` — `newsSourceCount: NEWS_FEEDS.length`.
- `scripts/fetch-data.mjs:1131-1140` — `NEWS_FEEDS`는 RSS 쿼리 **8개**다.
- 측정: `data.json.news`의 distinct `source` = **29**, distinct `independenceKey` = **29**.
- 런타임 소비 0건. UI의 "N개 등록 소스"는 별도 상수 `js/aio-data.js:7115`(`AIO_NEWS_SOURCES.length`)에서 채운다.

**영향:** `newsSourceCount`는 "출처 수"로 읽히지만 실제로는 "수집 피드 수"다. 소비자가 없어 화면 오류는 아니지만, 발행 스키마가 오명 필드를 영구 보존한다.

### D3 (중상) — `_bea.values.corePceMoM`이 전년동월비 값을 담는다

- `scripts/fetch-data.mjs:725` — `mom` 정규식이 `preceding month … Excluding food and energy … (increased|decreased) X percent`를 잡는다.
- `scripts/fetch-data.mjs:753` — `corePceMoM: mom ? _signedPercent(mom[3], mom[4]) : null`.
- 측정: `macro._bea.values = { pce: 3.7, corePce: 3.3, pceMoM: 0.2, corePceMoM: 3.3 }`.
  - `corePceMoM`(3.3) == `corePce`(YoY 3.3)과 정확히 일치.
  - `pceMoM`(0.2) 대비 16.5배 — 월간 물가 상승률로 불가능한 값.
  - 즉 MoM 블록의 두 번째 쌍이 YoY 문장의 core 값을 집어왔다.

**게이트 상태:** 이 필드에 대한 단언 없음. 런타임 소비 0건(dead).
**영향:** 사용자 영향은 없으나 발행 산출물이 **거짓 사실 진술**을 담는다.

### D4 (중상) — `history.json` 시계열 108행이 "이전 세션 종가"에 "현재 관측 시각"을 찍었다

이전 감사 S1의 실체이며, 프로듀서는 고쳐졌지만 발행 산출물은 옛 형식이다.

- 프로듀서 수정(적용됨): `scripts/fetch-data.mjs:1567-1584` — `observedAt: usePreviousClose ? previousObservedAt : q.observedAt`, `observationRelation`, `observedAtSource`.
- 측정(`public-data/history.json`, 420행):
  - `valueBasis === 'previous-completed-close'` 이면서 `observedAt > cycleEnd`인 행 = **108건**.
  - 예: `2026-08-13.dxy observedAt=2026-08-13T04:00:00Z > cycleEnd=2026-08-12T23:00:00Z`, `2026-08-14.spx observedAt=2026-08-14T13:30:00Z > cycleEnd=2026-08-13T23:00:00Z`.
  - `observedAtSource` 보유 행 = **0 / 420**. `observationRelation` 보유 행 = **14 / 420** (전부 `carried-forward`).
  - dxy/wti/gold의 `observedAt`은 `04:00:00Z`(ET 자정), kospi/kosdaq/btc는 `00:00:00Z`로 정규화돼 있다 — 실제 종가 관측 시각이 아니다.

**게이트 상태:** `scripts/ci-artifact-semantics-check.mjs:76-79`가 `observedAtSource`가 한 행도 없으면 단언 전체를 건너뛴다. 현재 실행 출력:
```
[artifact-semantics] transition: history rows predate P1095; vintage assertions apply after the next refresh.
```
**영향:** 시계열 위에서 상관·정렬·선행/후행을 계산하면 혼합 빈티지 + 잘못된 시각이 된다. 14개 필드 중 6개가 한 세션 어긋난다.

### D5 (중) — `macro._freshness_*` 19개가 전부 거짓 신호다

- 측정: 19필드 **전부** `stale-reference`. 그런데 같은 접두의 `_source_*`는 `bls-official-primary`·`bea-official-primary`·`fred-official-primary`·`us-treasury-official-primary`(hyOAS만 `fred-official-public-csv`)이고, `_asOf_*`는 최신(dgs\* `2026-09-16`, hyOAS `2026-09-15`), `_failedSeries = []`, `_treasury.status = 'cached-fresh'`다.
- 프로듀서 수정(적용됨): `scripts/fetch-data.mjs:684` — `merged['_freshness_'+field] = 'observed'`.

**게이트 상태:** `ci-artifact-semantics-check.mjs:47-51` transition — 발행물에 `observed`가 하나도 없으면 아티팩트 단언을 건너뛴다.
**영향:** 이 필드로 LKG와 정상 관측을 구분할 수 없다. 런타임 소비 0건이라 화면 영향은 없다.

### D6 (중) — 서술 근거의 id 역추적이 전 행에서 성립하지 않고, 단위 오류를 게이트가 볼 수 없다

이전 감사 S2의 잔존분이며, 게이트가 **공허하게 통과**한다.

- 측정(`data.json.marketAnalysis.metricEvidence`, 11행):
  - `canonicalMetricId` 보유 행 = **0 / 11** → `ci-artifact-semantics-check.mjs:139-150`의 두 canonical 단언이 vacuous.
  - `metricId`가 스냅샷과 전면 불일치: `market.spx` vs `market.index.spx`, `market.us10y` vs `market.rates.us10y`, `market.dxy` vs `market.fx.dxy`, `sentiment.fear-greed` vs 대응 없음.
  - `unit`: `market.us10y` = **`index`** (스냅샷 동일 지표 `market.rates.us10y` = `percent`).
  - `evidenceId` 네임스페이스 상이: `market-analysis:^TNX:2026-09-16T18:59:54.000Z` vs 스냅샷 `market.rates.us10y:<hash>`.
- `ci-artifact-semantics-check.mjs:126-133`의 `legacyNamespace` 정규식이 11행 전부를 면제한다.

**완화:** `marketAnalysis.status = 'blocked'`, `semanticStatus = 'blocked'`, `reason = 'metric-identity-mismatch:vix-vs-fear-greed,causal-evidence-missing'` — 차단된 서술은 사용자에게 노출되지 않는다. **의미 가드는 실제로 작동한다.**

### D7 (중) — `selectedRawCoveragePct`가 280.5%로 발행된다

- `scripts/fetch-telegram-digest.mjs:518` — `selectedRawCoveragePct = Math.round(selectedRawIds.size / eligibleTextCount * 1000) / 10`.
- 측정(`telegram-digest.json.coverage`): `selectedRawCount 418` / `eligibleTextCount 149` = **280.5%**.
- 두 집합이 다른 모집단이다: `selectedRawIds`는 `topItems(45) ∪ broadItems(400)`의 상한 요약셋(`scripts/fetch-telegram-digest.mjs:464-473`), `eligibleTextCount`는 whole-window 텍스트 보유셋.

**영향:** "coverage %"가 100%를 넘는 값은 커버리지가 아니다. `coverage.semantics` 문자열이 페이로드 상한을 설명하지만 비율 자체의 분모 불일치는 설명하지 않는다.

### D8 (중) — `history.json` 행 스키마가 균질하지 않고 최신행이 5필드를 조용히 누락한다

- 측정: 420행 중 breadth 계열 5필드(`breadth20`/`50`/`200`/`advanceRatio`/`advanceDecline`)를 가진 행 = **232** (2025-10-14 ~ **2026-09-16**). 나머지 188행(최신 `2026-09-17` 포함)은 해당 키 자체가 없다.
- `scripts/fetch-data.mjs:1504` — `HIST_FIELDS`만 `null`로 채우고 breadth는 `HIST_FIELDS` 밖이다.
- 두 생산자(`refresh-data.yml`과 `refresh-screener.yml:89`)가 같은 파일을 **다른 필드 집합으로 업서트**한다. breadth는 screener 경로에서만 채워진다.

**영향:** breadth 시계열이 가격 시계열보다 하루 짧은데, `null` 자리표시자도 없어 소비자는 시리즈 종료로 오인한다.

### D9 (중) — 관측되지 않은 건강 상태가 `CURRENT`로 발행된다

- 측정(`operations-status.json`):
  - `planes.fast.health = { status: 'CURRENT', statusCode: 200, observationStatus: 'NOT_ATTEMPTED', source: 'last-observed-live-health', revision: 'fast-quotes:de5d80b2' }`
  - `ai.publicChat = { status: 'CURRENT', health: { observationStatus: 'NOT_ATTEMPTED', revision: 'v54.37' } }` — 저장소는 `v55.01`.
- `scripts/build-operations-status.mjs:241,247,260-261`가 `last-observed-live-health` + `NOT_ATTEMPTED`를 하드코딩한다.
- 재사용 유효성 플래그(`proxyEvidenceFresh`/`fastEvidenceFresh`)는 `scripts/build-operations-status.mjs`에서 계산되지만 **발행되지 않는다**. `scripts/ci-operations-status-check.mjs:35-36`은 픽스처로만 그 경계를 검증한다.

**영향:** 소비자는 `NOT_ATTEMPTED`는 보지만 **재사용이 아직 유효한지**는 판정할 수 없다. 상위 `status: CURRENT`만 읽으면 현재 관측으로 오인한다.

### D10 (중하) — `earnings-calendar.json` 유령 프로듀서: 발행되는 순간 CI가 red가 된다

- `refresh-screener.yml:39`가 `scripts/fetch-earnings-calendar.mjs`를 실행하고, `:90`이 존재 시 커밋한다.
- 그런데 파일은 **저장소에 없다**(untracked, working tree 부재). `.gitignore`에도 없다 → 지금까지 한 번도 발행되지 않았다.
- `scripts/ci-data-lineage-audit.mjs:113-137`의 `POLICIES`에 `earnings-calendar.json` 항목이 없다. `:157`은 미등록 top-level artifact를 **FAIL**로 처리한다.

**영향:** Finnhub 시크릿/수집이 성공하는 순간 봇이 커밋 → `contracts` preflight FAIL → attestation 부재 → 배포 정지. 이전 감사 A1과 정확히 같은 경로다. 사전 게이트(pre-push)는 이 파일을 검사하지 않으므로 로컬에서는 초록이다.

### D11 (중하) — 중첩 데이터 산출물 1,372개에 신선도·계보 정책이 없다

- `scripts/ci-data-lineage-audit.mjs:267` — `readdirSync(DATA_DIR)` **비재귀** → top-level 23개만 검사.
- 실측(파일 수 / 용량):

| 디렉터리 | JSON | 용량 |
|---|---:|---:|
| `public-data/objects/` | 629 | 141.1 MB |
| `public-data/knowledge/` | 668 | 8.2 MB |
| `public-data/masters/` | 58 | 313.6 MB |
| `public-data/atlas/` | 12 | 0.5 MB |
| `public-data/principles/` | 5 | 0.4 MB |
| **합계 (무정책)** | **1,372** | **463.8 MB** |
| top-level (정책 있음) | 23 | — |

- 예: `public-data/knowledge/status-summary.json`의 `generatedAt = 2026-08-18` (31일) — 신선도 게이트 없음.
- 완화: masters/knowledge는 자체 `reviewedAt`/`status` 라벨을 갖고 `ci-masters-contract-check`·`ci-knowledge-*`가 **구조**를 검사한다.

### D12 (중하) — `sw.js` 캐시 라우팅이 실제 소비자와 어긋난다

- `sw.js:224-226` `DATA_URL_PATTERNS`가 캐시하는 대상 중 `market-snapshot-status.json`·`operations-status.json`은 **클라이언트 fetch 0건**.
- 실제 주 데이터(`data.json`, `history.json`, `screener.json`, `screener-universe.json`, `model-validation-status.json`, `telegram-digest.json`, `user-research-digest.json`, `operator-note.json`)은 **데이터 캐시 패턴 밖**이다.
- `sw.js:242-244` `REFERENCE_URL_PATTERNS`는 소비되는 knowledge/atlas/principles/masters 중 일부만 커버한다.

### D13 (중하) — `PUBLISHED_RUNTIME_ASSETS`(187개)는 아무도 읽지 않는 등록부다

- 저장소 전체에서 이 상수의 참조는 `sw.js:33`(정의)와 `scripts/ci-service-worker-cache-policy-check.mjs:14`의 **금지 단언**뿐이다.
- 목록 중 `public-data/` 항목은 5개뿐(`masters/manager-catalog`, `manager-row-previews`, `filing-discovery`, `manager-principles`, `knowledge/route-targets`) — 실제 데이터 페이로드 대부분이 미등록.
- 드리프트를 검사하는 게이트가 없으므로 "유령/누락"이 무검출로 누적된다(이전 감사 §2 #5, 미수정).

### D14 (낮음) — 운영 상태에 선언되지 않은 세 번째 어휘가 있다

- 선언: `statusVocabulary`(6개) / `statusCodeVocabulary`(5개).
- 실제로 `readiness.*`가 `secretConfigured: 'OPERATOR_REQUIRED'`, `licensedForUse: 'REVIEW_REQUIRED'`를 쓴다. **`REVIEW_REQUIRED`는 두 어휘 어디에도 없다**(`providers.yahoo.rights`, `operations.planes.*.readiness.licensedForUse`).
- `scripts/ci-artifact-semantics-check.mjs:104-113`의 walker는 키 이름이 정확히 `status`/`statusCode`인 것만 검사 → `rights`/`licensedForUse`/`secretConfigured`는 무검사.

### D15 (낮음) — 자기보고 카운트가 발행 payload와 모순처럼 읽히고, 대조 게이트가 없다

- 측정: `meta.symbolsOk = 78`, `meta.cycleComponents.quoteCount = 78`, `requiredQuoteCount = 78`인데 `quotes = []`, `quotesPublished = false`, `quotePolicy = 'client-direct-fetch-only(P715)'`, 스냅샷 `quotes.length = 16`.
- 스크리너는 `ok === rows.length`를 게이트가 재계산하지만(`ci-screener-workbench-contract` SCR-OS-00), `data.json`의 자기보고 카운트를 배열 길이와 대조하는 게이트는 없다.

### D16 (낮음) — `screener.json`의 같은 이름 필드가 두 계층에서 다른 값을 갖는다

- top-level `factorObservedAt = 2026-09-17T00:00:00Z`(정규화 버킷).
- 행 레벨 `factorObservedAt` 분포: `2026-09-16T13:30:00Z` × 705, `2026-09-17T00:00:00Z` × 130, `2026-09-16T00:00:00Z` × 14.
- 동일 키 이름이 요약 버킷과 실제 관측을 각각 뜻한다.

### D17 (낮음) — UI가 `valueBasis`를 항상 하드코딩 리터럴로 표시한다

- `js/aio-data.js:6825` — `_aioHistorySeries`가 `{ date, value, observedAt, source, sourceKind }`만 반환 → `fieldMeta` 소실(같은 파일 `:6814` 주석은 `fieldMeta`가 실제 provenance라고 선언).
- `src/ui/pages/market.js:263` — `row?.valueBasis || row?.changeBasis || row?.fieldMeta?.valueBasis || 'completed-market-series'` → 앞 세 후보가 항상 undefined → **항상 마지막 리터럴**.
- `src/ui/pages/market.js:342-343`이 차트 title과 `data-change-basis`에 그 리터럴을 쓴다.

**영향:** D4의 108행(`previous-completed-close`)·`carried-forward` 행이 UI에서 `completed-market-series`로 균질화된다. 발행된 `history.json.fieldMeta.*.valueBasis`(`fetch-data.mjs:1582`)는 사용자 화면에 도달하지 못한다.

### D18 (중하) — 단위 선언은 죽고 표시 단위는 하드코딩으로 흩어져 있다

- `js/aio-data.js:2890-2926` `FRED_SERIES_META[*].unit`(`'%'`, `'bp'`, `'K'`, `'B USD'`, `'USD/bbl'` …) — **읽기 0건**.
- 실제 표시 단위는 포맷터에 리터럴로 박혀 있다: `js/aio-data.js:3101`(`'bp'`), `:3115`, `:3136`, `:3166`, `:3169`, `:3175`, `:3191`. `DCOILWTICO`(`USD/bbl`)는 `applyFredToUI`에서 아예 렌더되지 않는다.
- hyOAS는 `%`↔`bp` 변환(`×100`)이 최소 3곳에 반복된다(`js/aio-data.js:5582-5621`, `src/ui/pages/market.js:398`, `:665`).

**영향:** 단위를 선언과 표시가 아니라 표시 코드가 결정한다. 선언이 틀려도 게이트가 볼 수 없다(§4-1).

### D19 (낮음) — `fearGreed.history`가 같은 날짜에 2포인트를 갖는다

- 측정: 252포인트 / 251일. 중복일 = `2026-09-17` (`00:00:00Z` 26.11 + `12:16:31Z` 26.11).
- 마지막 항목은 일별 시리즈 규율 밖의 장중 스냅샷이며, `history.json`의 `fg` 필드도 같은 관측시각(`2026-09-17T12:16:31Z`)을 쓰는데 그 행의 `cycleEnd`는 `2026-09-16T23:00:00Z`다.

---

## 3. 정합성이 확인된 것 (재계산 일치)

전수로 재계산해 **일치**한 항목이다. 이 목록이 있어야 §2의 결함이 "무엇과 대비되는지"가 분명해진다.

**리비전 결속 (8곳 동일):** `market-snapshot:2026-09-17T12:34:20.413Z:3de67b19`
`data.meta.marketSnapshotRevision` = `market-snapshot.revision` = `market-snapshot-status.lastKnownGoodRevision` = `history.at(-1).marketSnapshotRevision` = `release-manifest.dataRevision` = `asset-manifest.dataRevision` = `operations-status.dataRevision` = `reconciliation.categories[*].marketSnapshotRevision`.

**투영 매니페스트:** `sec-fundamentals-summary.manifest`의 `sourceSha256`·`runtimeSha256`·`sourceBytes`·`runtimeBytes`·`records(562)`가 실제 파일과 **LF 정규화 기준 일치** (30,769,429 B → 621,442 B).

**breadth 산술 (3세그먼트 완전 일치):**

| | universe | eligible | coverage% | A+D+U | advanceRatio |
|---|---:|---:|---:|---:|---|
| all | 873 | 850 | 97.4 | 315+519+16=850 | 315/834 = 0.3777 ✓ |
| us | 728 | 708 | 97.3 | 241+458+9=708 | 241/699 = 0.3448 ✓ |
| kr | 145 | 142 | 97.9 | 74+61+7=142 | 74/135 = 0.5481 ✓ |

`us + kr = all`이 세 축(universe 873 / eligible 850 / advances 315 / declines 519 / unchanged 16)에서 정확히 성립.

**reconciliation:** `counts {PARTIAL:13, MATCH:7, BLOCKED:2}` = 카테고리 tally와 동일. `closure.unresolved(15)` = `partial(13) + operatorRequired(2)`. 22 카테고리.

**operations-status:** `providers.sec.coveragePct 85.8 = 562/655` ✓ · `planes.browser.revision v55.01` = `version.json` ✓ · `reconciliation.tier0.artifact` = 스냅샷 리비전 ✓ · `routes` 20 = `CURRENT-STATE.md` ✓.

**13F 농도 (5개 매니저 표본):** 정규화 키(`NORMALIZED_CUSIP+PUT_CALL+SHARE_TYPE`) 집계 시 보고값과 **소수 4자리까지 일치** — Berkshire top5 68.6515 / top10 88.4689, BlackRock 19.2399 / 28.0052, Scion 96.7986 / 100.0000, Pershing Square 78.1845 / 99.9321, Third Point 38.1168 / 60.0917. `holdings-summary` 366행 = `holdingRowsPublished 366` = 37 매니저 × ~10.

**telegram:** `count 2336` = `observedItems.length` ✓ · `successfulChannelCount 4` = `channels.length 4` ✓ · `atlas/index.json.telegramObservedLineage 499` = `retainedItemCount 499` ✓ (교차 산출물).

**지식 카운트 (전부 재계산 일치):** research-dossiers 455 = 313+4+138 ✓ · articles 160 = principles 112 + atlasFoundations 48 ✓ · concepts 212 ✓ · claims 274 ✓ · sources 169 ✓ · route-targets 227 = 188+39 ✓ · ai-retrieval-index 217 = 112+48+28+29 = withConcepts 105 + unmapped 112 ✓ · principles lesson-library lessons 112 = chapters 15(카운트 키) ✓ · `knowledge/status-summary.json` ↔ `_context/CURRENT-STATE.md` 일치 · `atlas/index.json`의 `taxonomyNodes 95` = `concepts.json.counts.atlas 95` ✓.

**뉴스:** 40/40건이 선언 사이클(`2026-09-15T23:00Z`~`2026-09-16T23:00Z`) 안에 있음 · `newsScoreMin 38`/`newsScoreMax 62`가 실제 min/max와 일치 ✓.

**기타 파생:** `macro._treasury.values.t10y2y 0.27 = dgs10 5.01 − dgs2 4.74` ✓ · krExports `29.8 − 23.5 = 6.3` ✓ · `fearGreed.previousScore 26` ↔ `score 26` ✓ · 스냅샷 `coverage 16/16` = `tier0 16/16` = `observed` = `quotes.length` ✓ · `market-snapshot-status.attemptStatus 'published'` = `market-snapshot.status 'published'` ✓.

---

## 4. 게이트가 볼 수 없는 의미 축

| # | 축 | 근거 |
|---|---|---|
| 1 | **발행 수치의 단위·스케일** | `unit` 단언은 `ci-artifact-semantics-check.mjs:143-149`(canonical 행 전용, 현재 **0행**)와 AI-chat/screener envelope(`ci-ai-quote-evidence-check.mjs:113-116`)뿐. `macro.*` 수치의 단위를 바운드/재계산하는 게이트 없음 |
| 2 | **교차 출처 대조** | `independent-quote-reconciliation`이 의도적 BLOCKED(`ci-professional-data-gap-check.mjs:26`). `ci-history-field-time-contract-check.mjs:80-86`의 일치는 동일 Yahoo 출처 대조 |
| 3 | **id 역추적 완전성** | `data.marketAnalysis.claims[].evidenceIds`만 해소. 스냅샷 quote `evidenceId` 유일성·`screener.fieldObservations`·telegram item id는 무검사. 게다가 §2-D6에 따라 현재 그 검사도 공허 |
| 4 | **임계 라벨 재도출** | `quality.gate`·`operations.overall`·`readiness.*`는 어휘/상수 비교뿐. 수치에서 라벨을 재계산하는 것은 trading-score(`:155-178`)와 reconciliation(`ci-reconciliation-contract-check.mjs:27-42`)뿐 |
| 5 | **자기보고 카운트** | `data.meta.symbolsOk`/`newsCount`를 실제 배열과 대조하는 게이트 없음 |
| 6 | **중첩 산출물 신선도** | 1,372개 / 463.8MB 무정책 (§2-D11) |
| 7 | **죽은 필드 탐지** | `_freshness_*`, `observedAtSource`, `history.fieldMeta.valueBasis`, `screener.*.priceBasis`, `FRED_SERIES_META.unit` 등 발행-미소비 필드를 단언하는 게이트 없음 |
| 8 | **등록부 드리프트** | `PUBLISHED_RUNTIME_ASSETS`는 금지 단언만 있고 일치 단언이 없다 (§2-D13) |

---

## 5. 이전 감사 항목의 전파 상태

`ci-artifact-semantics-check.mjs` 실행 출력이 전파 상태를 스스로 보고한다:

```
[artifact-semantics] transition: macro freshness markers predate P1090; artifact assertions apply after the next refresh.
[artifact-semantics] transition: history rows predate P1095; vintage assertions apply after the next refresh.
Artifact semantics OK: ...
```

| 이전 항목 | 프로듀서 | 발행 산출물 | 게이트 |
|---|---|---|---|
| S1 (history 6필드 빈티지, P1095) | 수정됨 (`fetch-data.mjs:1567-1584`) | **미전파** (D4, 108행) | transition(공허) |
| S4 (macro sticky stale, P1090) | 수정됨 (`fetch-data.mjs:684`) | **미전파** (D5, 19필드) | transition(공허) |
| S2 (10Y `index` 단위, metricId) | 미수정 | 잔존 (D6) | canonical 0행 → 공허 |
| S3 ("45분" 주기 오귀속) | — | **정정 확인** (`index.html:11780`, `:11828`) | — |
| S5 (status 어휘) | 수정됨 (P1091) | 적용됨 | 통과 (단 §2-D14 잔여) |
| S6 (동결 freshness 평가시각) | 수정됨 (P1092) | 적용됨 (`evaluatedAt` 존재) | 통과 |

**안전장치 없음 경고:** transition 분기는 "다음 refresh에 형식이 전파되면 단언을 좁힌다"고 주석에 적었지만, **전파 여부를 감시하는 게이트는 없다**. 데이터 갱신이 다시 멈추면 두 단언은 계속 공허하게 통과한다.

**현재 데이터 그룹 게이트 상태** (`node scripts/qa-runner.mjs --group data --no-cache`, 21 PASS / **2 FAIL**):

```
FAIL reconciliation  — artifact timestamp outside 24h operating window: 2026-09-17T12:34:28.549Z
FAIL data-lineage    — market-snapshot.json age 25.44h > 24h SLA
```
두 FAIL은 의미 결함이 아니라 **자동 갱신 정지(이전 감사 A1)의 결과**다. 같은 원인으로 WARN 8건(`market-snapshot-status` 25.44h, `telegram-digest` 25.44h, `screener-universe` 64.58d, `operator-note` 80.6d, `structural-data-research` 28d, `operations-slo-window` 25d, `reconciliation-status` 25.44h)이 누적돼 있다.

---

## 6. 이번 절차에서 정정한 나의 오판

감사 자체의 신뢰도를 위해 기록한다.

1. **sec-fundamentals 매니페스트 해시 불일치**로 1차 판정했으나, 프로듀서가 LF 정규화 후 해싱하기 때문이었다(내 probe가 CRLF 원본 바이트로 계산). 정규화 기준으로는 4개 값 전부 일치 → **결함 아님**.
2. **13F 농도 불일치**(Berkshire 46.14% vs 보고 68.65%)로 1차 판정했으나, 원시 행 기준으로 잘못 재계산한 것이었다. 정규화 키(`CUSIP+PUT_CALL+SHARE_TYPE`)로 집계하면 소수 4자리까지 일치 → **결함 아님**.
3. **`statusCodeVocabulary`에 `OPERATOR_REQUIRED`가 없다**고 판단했으나, 내 probe가 `overall`(status 축)을 statusCode 집합에 섞은 오류였다 → **위반 아님**. 어휘 문제는 `readiness.*`/`rights`의 `REVIEW_REQUIRED`로 한정된다(D14).

---

## 7. 이 감사가 주장하지 않는 것 (미검증 경계)

- **`public-data/objects/**`(629개 / 141MB)의 내용은 검사하지 않았다.** 내용주소 해시 계약은 별도 게이트(`masters-contract`)가 담당한다.
- **37개 매니저 전체의 농도/턴오버/비교는 5개 표본만 재계산**했다. 나머지는 스키마와 카운트만 대조했다.
- **1,372개 중첩 산출물의 필드 수준 의미**는 knowledge/atlas/principles의 **인덱스 카운트**만 대조했다. 개별 dossier·article·manager shard 본문은 읽지 않았다.
- **LLM 서술 텍스트의 의미**는 검증 대상이 아니다(현재 `blocked` 폴백).
- **브라우저 렌더 결과·차트 시각 정확성**은 측정하지 않았다(픽셀 기준선 없음).
- **라이브 배포·Worker·provider 상태**는 이번에 fetch하지 않았다. 모든 수치는 로컬 체크아웃 기준이며, 이전 감사에서 관측한 `sourceSha` 격차(프록시 `v54.37`)는 재측정하지 않았다.
- **백테스트 산출물의 방법론 타당성**(IC/ICIR 계산의 통계적 유효성)은 검증하지 않았다.
- **provider 권리·라이선스 검토**는 범위 밖이다(`OPERATOR_REQUIRED` 유지).
- **`worker/data-plane.js`가 만드는 산출물**과 브라우저 소비자 간 정합은 미확인이다.

---

## 8. 재현 방법

```text
node scripts/qa-runner.mjs session-start --session <task-id>
node scripts/qa-runner.mjs --group data --no-cache
node scripts/ci-artifact-semantics-check.mjs
node scripts/ci-data-lineage-audit.mjs
node scripts/ci-history-field-time-contract-check.mjs
node scripts/ci-sec-runtime-projection-check.mjs
node scripts/ci-web-research-contract-check.mjs     # §2-D1 (watchdog-local 전용)
node scripts/ci-static-db-expiry-check.mjs
```

이번 세션에서 사용한 재계산 probe(스크래치패드, 저장소 밖): 리비전·시각 결속, 자기보고 카운트 대조, 매크로 신선도 매트릭스, fearGreed 일별 중복, history 빈티지 위반 카운트, 운영/스크리너/텔레그램 정합, 13F 농도 재계산, breadth 산술, 지식 카운트 대조.

**커밋·푸시·배포는 수행하지 않았다.**

---

## 9. 구현 결과 (v55.02, 2026-09-18)

§2의 19건 중 **13건을 수정하고 각각을 실행 가능한 회귀 게이트로 고정했다**(P1096~P1108, R614). 전환 면제가 필요한 항목은 단일 `inTransition` 헬퍼(만료 **2026-10-18**)로 묶어, 만료 후에는 단언이 무조건 실행되고 면제 중에도 부채가 수치로 보고된다.

| 결함 | P / R | 수정 | 회귀 게이트 |
|---|---|---|---|
| D3 BEA 월간 core가 12개월 문단에서 옴 | P1096 / R614 | 문단 스코프 추출 + fail-closed | `ci-history-field-time-contract-check.mjs` 픽스처 4건(정확 재현: 옛 `0.2/3.3` → 새 `0.2/null`) |
| D2 `newsSourceCount`가 피드 수를 출처 수로 발행 | P1097 / R614 | `newsFeedCount`·`newsPublisherCount` 분리 | `ci-artifact-semantics-check.mjs` 자기보고 카운트 4단언 |
| D7 텔레그램 커버리지 280.5% | P1098 / R614 | 분자를 같은 모집단으로 제한, 두 비율 발행 | 동일 게이트: `≤100`·부분집합·lineage 일치 |
| D19 F&G 일별 중복·값/출처 불일치 | P1100 / R614 | 달력일 dedupe + 값/출처 정렬 | 동일 게이트: 일당 1포인트·헤드라인=반올림 |
| D8 history 행 비균질 | P1101 / R614 | 두 레인이 같은 정규화 함수, `null` 사용 | `ci-history-field-time-contract-check.mjs` 정규화 픽스처 + 발행본 열 집합 단언 |
| D10 earnings 캘린더 유령 프로듀서 | P1102 / R614 | 계보 정책 등록 + 클라이언트 스냅샷 폴백 구현 | `ci-data-pipeline-contract-check.mjs` 3자 일치 |
| D14 미선언 권리·정합성 어휘 + 권리 승격 | P1103 / R614 | 축별 어휘 발행, 권리 승격 제거(`promotable`은 `VERIFIED`만) | `ci-artifact-semantics-check.mjs` + 두 계약 검증기 |
| D9 관측 안 된 health가 `CURRENT` | P1104 / R614 | `evidenceFresh`·`evidenceEvaluatedAt` 발행 | 동일 게이트: 이월 판정 증명 요구 |
| D17 `valueBasis` 리터럴 균일화 | P1105 / R614 | `_aioHistorySeries`가 `fieldMeta` 전달 | `ci-runtime-contract-check.mjs` 프로듀서↔소비자 결합 |
| D18-1 FRED 중복 선언 3건 | P1106 / R614 | 중복 제거 + `unit` 키 명시 | 동일 게이트: 중복 0건·unit 키 존재 |
| D1 `checkedAt` 영구 동결 | P1107 / R614 | 라이브 점검 시각과 이월 스냅샷 시각 분리 | 동일 게이트 + `ci-web-research-contract-check.mjs` |
| D6 canonical 0행 공허 통과 | P1108 / R614 | canonical 0행을 만료 후 실패로 | 동일 게이트 |
| (공통) 전환 면제 무만료 | P1099 / R614 | 만료 시한 + 부채 수치 보고 | 게이트 자체 |

**이번에 확정된 신규 결함 1건(§2에 없던 것):** `build-reconciliation-status.mjs:114`가 `MATCH`를 이유로 권리를 `REVIEW_REQUIRED`→`CURRENT`로 승격해 7개 범주를 `promotable: true`로 만들었고, 같은 산출물 계열의 `blockers`는 `provider_rights_review_required`였다(P1103에 포함). 체크리스트 통과가 권리를 검증하지는 않는다.

### 실행한 검증 (로컬)

| 게이트 | 결과 |
|---|---|
| `ci-artifact-semantics-check.mjs` | PASS (전환 부채 11건을 수치로 보고) |
| `ci-history-field-time-contract-check.mjs` | PASS (신규 픽스처 4건 포함) |
| `ci-runtime-contract-check.mjs` | PASS |
| `ci-data-pipeline-contract-check.mjs` | PASS |
| `ci-data-continuity-check.mjs` | PASS (57 checks) |
| `ci-static-data-contract-check.mjs` | PASS (22/22) |
| `ci-screener-workbench-contract.mjs` | PASS |
| `ci-operations-status-check.mjs` | PASS |
| `ci-source-registry-contract-check.mjs` | PASS |
| `ci-operator-readiness-check.mjs` | PASS |
| `ci-professional-data-gap-check.mjs` | PASS |
| `ci-architecture-contract-check.mjs` | PASS (directFetch 42 ratchet 유지) |
| `ci-version-check.mjs` | PASS (R1 9 cachebusters, v55.02) |
| `qa-runner.mjs contracts --no-cache` (전 정적 계약) | **101 PASS / 2 FAIL / 0 SKIP** |
| workspace closeout 7종(generated-state·workspace·knowledge-lint·skill·skill-eval·agent-profiles·agent-skills) | PASS |
| `git diff --check` | PASS (CRLF 안내만) |

**변경과 무관한 기존 FAIL(로컬 데이터 25.8시간 노후):** `data-lineage`(data.json 12h·market-snapshot 24h 초과), `reconciliation-contract`(24h 창 초과), `web-research-contract`(AAII 12h 초과). 모두 자동 갱신 정지의 결과이며 이번 수정으로 해소되지 않는다.

### 미수정으로 남긴 것 (QA-EXHAUST-56~59)

| # | 항목 | 남긴 이유 |
|---|---|---|
| 1 | 중첩 산출물 1,372개(463.8MB)의 필드 수준 의미 | 최상위 23개는 전수 재계산했으나 knowledge/atlas/principles/masters 하위는 인덱스 카운트만 대조했다. `objects/**`(629개/141MB)와 37개 매니저 중 32개 농도 재계산이 남아 있다. 단순 누락이 아니라 **다음 감사의 범위**다. |
| 2 | `PUBLISHED_RUNTIME_ASSETS`(187개) 드리프트 | 이 상수는 저장소 어디서도 읽히지 않는다(정의 + 금지 단언뿐). 삭제할지 실제 발행 집합과 일치시킬지 결정이 필요해 **설계 결정 대기**로 남겼다. |
| 3 | `sw.js` 캐시 패턴 ↔ 소비자 불일치 | 캐시 대상을 바꾸면 오프라인 동작·서비스워커 게이트에 영향이 있어 브라우저 검증이 선행돼야 한다. |
| 4 | `screener.json` top-level/행 레벨 `factorObservedAt` 의미 분리 | 계약(`src/data/contracts/screener.js`)과 소비 경로가 이 필드를 쓰므로 이름 변경은 영향 검토가 필요하다. |
| 5 | FRED 표시 단위의 선언-표시 단일 원천화 | 중복 선언은 제거했고 렌더되는 시리즈에서 두 값이 일치함을 확인했다. 포맷터 리팩터는 별도 작업으로 분리했다. |

**커밋·푸시·배포는 수행하지 않았다.** v55.02 범프와 R1 7표면 동기화는 로컬에서 완료됐다.

---

## 10. 전 요소 완전성 확보와 구조 보강 (v55.03, 2026-09-18)

§7이 "미검증"으로 남긴 중첩 산출물을 **전부** 검사하고, §9가 남긴 미수정 항목을 닫았다.

### 10.1 전수 검사 결과 — 결함이 아니었던 것 (재계산 일치)

| 대상 | 검사 규모 | 결과 |
|---|---|---|
| `public-data/masters` 37개 매니저 | 정규화 키(`CUSIP+PUT_CALL+SHARE_TYPE`) 집계로 top5/top10·`fullRowCount`·`reportedPositionCount`·`parsedValueTotal`·`cover.tableValueTotal` 재계산 | **37/37 일치** |
| 값 잔차 라벨 | `EXACT / |Δ|≤1 EXCEPTION_DISCLOSED / 그 외 MISMATCH` (`collect-13f-reference.mjs:263`) | 원칙적 — duquesne Δ4·fidelity Δ5는 MISMATCH, wellington Δ1은 EXCEPTION_DISCLOSED로 정확히 라벨 |
| 범주 모집단 7/37/38/2/5 축 | 각 산출물의 `coverage` 블록 | 전부 자기 서술과 일치(`mark-minervini`는 `methodOnlyProfiles:1`) |
| `objects/**` | 629개 파일의 sha256 vs 파일명 | **629/629 일치**(원시 바이트 기준), 참조 경로 37건 전부 존재 |
| knowledge·atlas·principles 참조 | 685개 파일, 8,908개 참조 vs 전역 식별자 3,210개 | dangling은 2계열 35건뿐(§10.2에서 수정) |
| atlas·principles 선언 카운트 | taxonomyNodes 95·domains 19·claims 57·foundationLessons 48·conceptGuides 60·lessons 112·chapters 15 | 전부 재현 |
| `coverage-matrix` | 455 units × kind 분포(112/48/60/28/95/50/19/21/22) | 합 455 일치, `stateVocabulary` 6개 중 1개 사용(코퍼스가 INVENTORIED 단계 — 선언된 진척 어휘) |

### 10.2 새로 확정한 결함과 수정

| ID | 결함 | 수정 | 게이트 |
|---|---|---|---|
| P1109 | 퇴역 범위(labs 16파일)가 계속 발행 + `relationship-guides` 미해소 `routeIds` 5건(소비자가 `'연결 분석 화면'` 폴백 칩으로 렌더 → **사용자 가시**) | 죽은 생성기 삭제, 산출물 16개 제거, dangling 5건 제거 | 참조 해소 + 퇴역 재발행 금지 (**음성 대조 완료**) |
| P1110 | 중첩 1,372개에 신선도 측정면 없음 | 계열별 정책(49개 측정, WARN 전용) | `report.nested` — 13건 창 초과, 0건 파싱 실패 |
| P1111 | `PUBLISHED_RUNTIME_ASSETS` 184항목·참조 3게이트·11개 ghost | 삭제(sw.js −40%), 3게이트를 실제 소유 메커니즘(요청 기반 런타임 셸)으로 교정 | 등록부 부재 단언 |
| P1112 | 캐시 라우팅이 미소비 2파일을 캐시한다고 선언 | 해당 2항목 제거 | 경로 기반 소비자 대조 (**음성 대조 완료**) |
| P1113 | 정규화 버킷이 행 관측시각 폴백 | 3곳 제거·fail-closed | `ci-runtime-contract-check` |
| P1114 | yoy 6시리즈가 빈 단위 선언 | `'%'`로 일치 | `ci-runtime-contract-check` |

**신규 발견(측정면이 드러냄, 수정은 OPEN):**
- **날짜 없는 중첩 산출물 12건** — `taxonomy-node-coverage`·`lesson-library`·`domain-guides`·`foundation-lessons`·`foundations`·`player-product-registry`·`source-packets`·`domain-claim-ledger`·`domain-source-packets`·`chapters`·`reference-curriculum`·`relationship-guides`가 `revision`/`status`만 갖고 시각이 없어 **나이를 측정할 수 없다**. 타임스탬프 부여는 저작 변경이라 OPEN.
- **`objects/**` 592/629(94%) 미참조** — 전부 git 추적 상태(141MB). 내용주소 저장소에 GC/보존 정책이 없다.
- **`security-master-reference.json` 48일** — masters 45일 창 초과(새 측정면이 검출).

### 10.3 이번 절차에서 정정한 나의 오판 (2건)

1. **13F 값 잔차를 "라벨 불일치"로 1차 판정**했으나, 프로듀서의 3분기 규칙(`0 / ≤1 / 그 외`)에 따라 정확히 라벨된 정직한 공시였다.
2. **`PUBLISHED_RUNTIME_ASSETS`를 "참조 0건"으로 판정**했으나, 3개 게이트가 그 **내부 문자열**을 소유 근거로 읽고 있었다(상수명으로만 grep한 오류). 삭제 후 3게이트가 FAIL해 발견했고, 각 게이트를 실제 소유 메커니즘으로 교정했다 — 단언을 삭제하지 않고 의미를 바로잡았다.

### 10.4 실행한 검증 (v55.03)

| 게이트 | 결과 |
|---|---|
| `qa-runner.mjs contracts --no-cache` | **101 PASS / 2 FAIL / 0 SKIP** |
| `ci-artifact-semantics-check.mjs` | PASS + 참조 해소 음성 대조 FAIL 확인 |
| `ci-service-worker-cache-policy-check.mjs` | PASS + 라우팅 음성 대조 FAIL 확인 |
| 중첩 측정면 (`ci-data-lineage-audit.mjs`) | 49 measured / 13 stale / 0 unreadable (WARN) |
| workspace closeout 7종 + `ci-qa-pipeline-contract-check` | PASS (136 gates) |
| `ci-syntax-check.mjs` | PASS (384 파일) |
| `git diff --check` | PASS (CRLF 안내만) |

2 FAIL은 **로컬 데이터 26.2시간 노후**(`data.json` 12h·`market-snapshot.json` 24h SLA)로 자동 갱신 정지의 결과이며 이번 변경과 무관하다.

### 10.5 이번에도 미검증으로 남긴 경계

- 브라우저 그룹(`browser-runtime`·`browser-resilience`·`browser-viewport`·`browser-surface`)은 실행하지 않았다 — 렌더 결과는 이 보고서가 주장하지 않는다.
- 라이브 배포·Worker·provider 상태는 fetch하지 않았다.
- 백테스트 산출물의 통계적 타당성은 검증하지 않았다.
- 12개 무날짜 산출물의 실제 저작 시점은 알 수 없다(기록이 없으므로).

**커밋·푸시·배포는 수행하지 않았다.**
