---
verified_by: agent (Fable 5)
last_verified: 2026-07-18
confidence: high
target_version: v53.15
# 2026-07-18 통합/압축: 상시 참조 룰(R290+ 및 핵심 keep-list 89건)은 전문 유지, 나머지 244건은 헤더 한 줄로 축약.
# 헤더-only 룰의 본문 전문은 git 히스토리(2026-07-18 이전 리비전) 참조. R번호는 전량 보존(재발 추적/게이트 grep 호환).
---

## R352. Architecture migration must transfer an executable owner and monotonically retire legacy coupling (v53.15, P736)

**Rule**: 새 `src/` 모듈·CI 스크립트·manifest를 추가한 것만으로 route 재구축을 완료 처리하지 않는다. 각 migration batch는 lifecycle·renderer·data·chart·narrative 소유권을 분리해 기록하고, 수정 전 `DELETE-LEDGER`에 declaration/caller/global/DOM/event/storage/test를 적은 뒤 최소 한 개의 대응 legacy wrapper/hook/writer를 같은 변경에서 제거해야 한다. Store가 dispatch한 route command는 reducer가 실제 소비해야 하며, release manifest의 app revision은 `version.json`과 정확히 같아야 한다.

**Validation**: `ci-architecture-contract-check.mjs`는 선언된 burn-down 상한과 퇴역 패턴 부재, release revision parity, 전체 실행 원장의 계층·route·세션 카드·최종 인수 구조를 blocking한다. `ci-architecture-browser-check.mjs`는 router와 store의 route가 모두 `sentiment`인지, ESM owner가 fail-closed 배지를 렌더하는지 검증한다. `operations-status.json`은 native lifecycle owner와 native renderer owner를 별도로 공개하며 renderer 전환 전에는 native route로 계산하지 않는다.

## R351. History bucket dates must not replace field-level observation provenance (v53.14, P735)

**Rule**: `history.json`의 행 `date`는 기존 차트 호환용 calendar bucket일 뿐, 각 값의 관측시각이 아니다. 숫자 입력은 `fieldMeta[field]`에 `observedAt`, `fetchedAt`, `lastSuccessfulAt`, `source`, `sourceKind`, `allowedUse`를 보유해야 하며 휴장일 carry-forward는 이전 관측값·`reference-only`·관계 상태를 명시한다. FRED/AI/HY OAS 공급 실패는 LKG 값 삭제·새 관측 승격·raw AI 발행으로 이어지면 안 된다.

**Validation**: `ci-history-field-time-contract-check.mjs`는 모든 numeric history field의 field-level evidence와 NFP 10배 fixture를 검증한다. `fetch-data.mjs`의 FRED LKG merge, `js/aio-data.js`의 durable HY OAS projection, `marketAnalysisSemanticOk` fail-closed 상태를 함께 확인한다.

## R350. Protected portfolio reloads and RSS backstops must fail closed at the visible boundary (v53.13, P734)

**Rule**: An encrypted portfolio must render its lock screen after a hard reload before any sensitive data surface is shown. News RSS retries may broaden only the provider query window; every item must still pass the canonical completed 08:00 KST cycle filter, and stale headlines must not be promoted as current.

**Validation**: `ci-portfolio-vault-e2e.mjs` must pass `reload_requires_unlock`; `ci-data-pipeline-contract-check.mjs` must assert RSS retry/backstop wiring and canonical cycle filtering.

## R349. Workflow module heredocs require an ESM runtime-import contract (v53.12, P733)

**Rule**: A workflow heredoc run with `node --input-type=module -` must use ESM imports throughout; do not leave `require()` in module-mode code.

**Validation**: `ci-data-pipeline-contract-check.mjs` rejects `require()` in module heredocs and checks the refresh summary's `node:fs` import.

## R348. Workflow heredocs must declare the same Node module mode that their source syntax requires (v53.11, P732)

**Rule**: A workflow heredoc containing `import` or top-level `await` is an ESM program. The command must use `node --input-type=module -`, and the CI syntax checker must parse it with the same mode. A CommonJS `new Function` check is not sufficient evidence for an ESM heredoc.

**Validation**: `ci-data-pipeline-contract-check.mjs` and `ci-control-char-check.mjs` must parse refresh/watchdog workflow heredocs.

## R347. Durable and fast data planes must expose independent revisions and fail closed until operator SLO evidence exists (v53.11, AR-07)

**Rule**: A GitHub Actions durable artifact is not proof that an independent fast plane, provider rights, or a 7-day freshness SLO exists. Canonical snapshots must retain the last known good revision on failed attempts, while Worker/Cron/KV/R2 health, provider rights, coverage, reconciliation, and soak status remain explicit `CURRENT`, `PARTIAL`, `BLOCKED`, or `OPERATOR_REQUIRED` states.

**Required**: Keep `market-snapshot.json`, `market-snapshot-status.json`, `operations-status.json`, and `reconciliation-status.json` revisioned and validated. Never overwrite a last-known-good snapshot with an incomplete publish, never promote a WebSearch inference to an exact current numeric value, and never report `VERIFIED_LIVE` without external scheduler/resource and soak evidence.

**Validation**: `ci-market-snapshot-contract-check.mjs`, `ci-data-plane-contract-check.mjs`, `ci-operations-status-check.mjs`, `ci-reconciliation-contract-check.mjs`, `ci-inference-contract-check.mjs`, and the live data-watchdog checks.

## R346. Legacy event adapters must normalize the actual EventTarget and payload shape at the boundary (v53.9, P729)

**Rule**: A compatibility observer must subscribe to the same `EventTarget` that emits the legacy event and normalize its real `CustomEvent.detail` shape before routing or state projection. Do not assume that a browser event dispatched on `document` bubbles to `window`, or that a legacy string payload is an object envelope.

**Required**: The adapter owns target selection and string/object detail normalization. The route lifecycle gate must exercise one legacy event, a mount, a dispose, and a route round-trip in Chromium. A failed observer must leave the legacy shell as the rollback owner.

**Validation**: `scripts/ci-architecture-browser-check.mjs` verifies `document`-targeted `aio:pageShown` string detail, sentiment mount/dispose, offline blocked state, and sentiment→home→sentiment round-trip with zero unexpected browser errors.

## R345. 고빈도 데이터 batch는 Store 기록과 DOM 반영을 분리하고 전역 scan·rewrite를 batch당 한 번만 수행한다 (v53.9, P728)

**Rule**: quote처럼 여러 레코드를 한 묶음으로 적용하는 경로에서 각 `Store.set()`이 전체 문서를 스캔하지 않는다. 레코드별 단계는 검증·저장·특수 파생값만 처리하고, 공통 `data-live-*` DOM 반영과 lineage annotation은 batch 마지막 canonical binder가 한 번 소유한다. 단건 스트림 갱신은 symbol-target selector만 사용한다.

**Required**: 동일 이벤트 안에서 `[data-live-price]`/`[data-live-chg]` 전체 rewrite가 둘 이상 존재하지 않게 한다. 퇴역 UI 소비자를 위한 네트워크 fanout은 sink 삭제와 함께 scheduler에서 제거하고, runtime audit은 삭제된 DOM 존재 여부가 아니라 현재 canonical evidence의 값·시각·실패 상태를 검사한다.

**Validation**: `ci-runtime-contract-check.mjs`가 `PriceStore.set(..., { deferDomAnnotation:true })`, 중복 bulk rewrite 부재, target annotation의 `data-live-field` 포함, `fetchKrDynamicData()`의 `fetchKrInvestorTop10` 미호출, KR evidence audit 계약을 이진 검증한다. headless T383/T863과 critical routes에서 console/page error 0을 확인한다.

## R344. 퇴역 UI의 렌더 경로와 주기 작업은 canonical owner 하나만 남기고 실행 가능한 게이트로 고정한다 (v53.8, P727)

**Rule**: HTML에서 제거된 DOM sink를 조회하는 renderer·wrapper·event hook은 조용한 no-op이라도 남기지 않는다. 현재 UI에 남은 일부 상태 갱신은 별도 legacy wrapper가 아니라 해당 페이지의 canonical updater에 합친다. 반복 작업은 이름 있는 `_aioTimerRegistry` 경로만 사용하며, registry가 없을 때 raw `setInterval`로 우회하지 않는다.

**Required**: UI 리디자인 시 구 DOM ID뿐 아니라 `getElementById`/`querySelector` sink, 함수 선언, 모든 호출부, wrapper, 이벤트 등록을 저장소 전체에서 함께 제거한다. 남겨야 하는 출력은 현재 DOM ID와 canonical updater 사이의 직접 경로로 옮긴다. 주기 작업은 `_aioRegisterTimer(name, fn, ms)`를 통해 중복 등록 시 이전 timer가 정리되도록 한다.

**Validation**: `ci-runtime-contract-check.mjs`가 `updateFxDynamicComments`/`generateFxBondCommentary` 선언과 `fx-dc-*`/`bond-dc-*` DOM 조회 0건, `updateFxBondPage()`의 현재 상태 배지·Cross-Asset Matrix 직접 갱신, `aio-chat.js`의 raw `setInterval` 0건을 이진 검증한다. 변경 후 fxbond route와 headless 전체 테스트에서 console/page error 0을 확인한다.

## R343. 신용 판정은 HYG 등 듀레이션 오염 가격이 아니라 FRED HY OAS(bp) 실측만 사용하고, 결측 시 null 사전 차단으로 0을 방지한다 (v53.7, P726)

**Rule**: HYG(또는 임의 회사채 ETF) 달러 가격을 고정 임계값(예: `hyg > 88`, `hyg < 78`)으로 비교해 신용 스프레드 수준을 판정하지 않는다. HYG 가격은 금리(듀레이션) 노출이 섞여 있어 레짐이 바뀌면 같은 가격이 다른 신용 상태를 의미하게 된다. 신용 레벨 판정·점수·바 그래프·라벨·AI 컨텍스트는 전부 `window._hySpreadBp`(FRED BAMLH0A0HYM2, bp 단위)를 단일 소스로 사용하고 350/450/550bp를 표준 경계로 정렬한다(안정/주의/위기). HYG 가격 자체는 상대적 방향(당일 등락, 자기 자신 대비 상대 손절 트리거)에만 쓸 수 있다.

**Required**: (1) 신용 판정 함수 신설·수정 시 `grep -nE "hyg\s*[<>]=?\s*[0-9]{2}\b" index.html js/*.js`로 전수 확인 — OAS 아닌 결과가 0건이어야 한다. (2) `Number.isFinite(Number(v))`는 `v`가 `null`/`undefined`/`''`일 때 `Number(v)=0`으로 통과하는 함정(P715 클래스)이 있으므로, 결측 가능한 값에는 반드시 `v != null && Number.isFinite(Number(v))` 또는 `typeof v === 'number' && isFinite(v)` 형태로 null을 먼저 차단한다. (3) 신용/시장값 처방형 문구("피신 권고", "회피" 등)는 관측형으로 전환한다(R25/P714 원칙과 동일).

**Validation**: `grep -nE "hyg\s*[<>]=?\s*[0-9]{2}\b" index.html js/*.js | grep -vi "oas\|bp\b"` → 0건. `grep -n "Number.isFinite(Number(" index.html js/*.js`로 나온 각 사이트에 인접 `!= null`/`== null` 존재 확인. 결측·정상 양쪽 상태를 실브라우저(Playwright 등)로 직접 렌더링해 DOM 텍스트와 콘솔 에러 0을 확인한다 — 코드 리딩만으로 "어느 표면이 라이브에서 이기는가"를 판단하지 않는다(같은 사건에서 대상 DOM 자체가 존재하지 않는 고아 코드를 코드 리딩만으로는 놓쳤다).

## R342. 변동 데이터와 현재형 서술은 런타임 증거만 사용하고 결측을 정적 시드로 메우지 않는다 (v53.4, P717)

**Rule**: 시세·심리·거시·시장폭·수급·차트·시나리오 확률·이벤트 결과·현재 narrative·공급자 가격은 코드나 HTML의 고정 수치/문장으로 현재 상태를 만들지 않는다. 공식 일정·정책처럼 수동 검증이 필요한 값만 출처 URL, 기준일, 용도(`reference-only`/`calendar-only`)를 갖춘 단일 레지스트리에 둘 수 있다.

**Required**: 변동 필드는 explicit null로 초기화하고 생산자 미수신 시 `—`/`미수신`/판단 보류를 표시한다. SCREENER_DB는 식별자만 정적으로 보관하며 signal/memo/mcap/rsi는 provenance가 있는 런타임 산출물만 병합한다. 합성 차트, quote/FRED 시계열, RRG seed, 고정 시나리오 확률, 현재형 이벤트·뉴스·테마 문장, LLM 가격·환율 fallback을 금지한다. 과거 사례를 남길 때는 archive/reference 표지와 비운영 용도를 명시한다.

**Validation**: `node scripts/ci-static-data-contract-check.mjs` 22/22, `ci-runtime-contract-check.mjs`, DOM `data-live-*`/`data-snap` numeric seed 검사, `AIO_STATIC_DATA_POLICY`, `AIO.getStaticSeedFallbackAudit()` orphan 0, Chromium headless 전수 테스트.

**Provider retirement addendum (P718)**: 변동 데이터 생산자·레지스트리를 퇴역할 때는 관련 선언, 호출, DOM sink, formatter, 테스트를 하나의 수직 경로로 제거한다. `provider-required` 출력은 검증된 응답 전까지 숫자·확률·중립 기본값을 렌더하지 않는다. 정적 검사만으로 완료 처리하지 않고, 외부 요청이 실패한 실제 Chromium route에서 console error 0을 확인한다.

## R341. 퇴역 기능은 inert stub로 보존하지 않고 수직 경로와 공개 artifact에서 완전히 제거한다 (v53.3, P716)

**Rule**: 사용하지 않는 기능을 unconditional `return`, 빈 함수, 숨김 DOM/CSS, legacy wrapper로 남기지 않는다. 실제 활성 대체 경로와 외부 참조가 없음을 증명한 뒤 DOM·스타일·상태·함수·호출·테스트·배포 항목을 하나의 수직 경로로 제거한다.

**Required**: runtime named function은 선언 외 참조가 최소 1개 있어야 한다. 퇴역 기능 테스트는 “inert”가 아니라 심볼·DOM·배포 자산의 부재를 검증한다. Pages는 runtime script를 파일명으로 명시하고 `js/*.js` wildcard를 사용하지 않으며, CI 전용 `aio-tests.js`는 HTML·Pages artifact·service worker cache에 포함하지 않는다.

**Validation**: `scripts/ci-structural-check.mjs` declaration-only scan, `scripts/ci-release-revision-check.mjs` manifest/CI/SW 정합 검사, `rg` 수직 참조 스윕, Chromium headless 전체 회귀.

## R340. 파생 시장 결론은 필수 관측 입력의 의미·기준일·coverage가 충족될 때만 표시한다 (v52.99, P712)

**Rule**: 금리 스프레드, 기술지표, Stage, RRG, 시장폭, McClellan, HY OAS, 테마·시장 건강도처럼 여러 값을 결합하는 결론은 각 필수 입력의 instrument/maturity/unit/source/asOf/coverage를 검증해야 한다. 다른 만기·다른 지표·정적 시드·중립 상수·난수 시계열을 결측 대용으로 사용해 현재값이나 현재 판정처럼 표시하지 않는다.

**Required**: 2s10s는 명시적 2Y·10Y 관측치만, RSI/MACD/Stage·시장 레짐·지지저항은 기준시각이 확인된 충분한 OHLCV만, RRG는 상대가격 히스토리만, McClellan은 실제 상승·하락 종목수 시계열만, HY OAS는 공식 OAS 관측치만 사용한다. 엔캐리·크로스에셋 프록시는 모든 필수 현재 입력이 있어도 포지션·옵션·당국조치·방향 예측으로 승격하지 않으며, 하나라도 없으면 점수도 보류한다. 비정규화 가격비율은 시장폭·집중도 결론에 쓰지 않는다. 한국 테마·시장건강도는 최소 coverage와 현재 수급/VKOSPI를 충족해야 한다. 하나라도 충족하지 않으면 값·등급·행동 문구를 함께 `판정 보류`로 닫고 누락 입력을 표시한다.

**Validation**: T874, T1024~T1027, T1037~T1039, `scripts/ci-runtime-contract-check.mjs`, 22-route semantic inventory, synthetic-series/RRG-seed/HYG-to-OAS/past-calendar source scans.

## R339. 증분 정성 피드는 전체 관측 lineage와 capped 소비 payload를 분리하고 현재 narrative를 재생성한다 (v52.97, P711)

**Rule**: Telegram 같은 증분 정성 피드의 `count`는 이번 fetch 수나 capped 본문 배열 길이로 가장하지 않는다. rolling window 전체의 경량 ID/channel/time/score/tags/tickers lineage와 UI/chat용 capped full text를 분리하고, `freshCount`, text eligibility, high/broad signal, selected payload coverage를 각각 노출한다. 동적 artifact가 로드되면 정적 과거 themes/catalysts/categories/pageMap을 유지하지 않고 현재 원문에서 재생성한다.

**Required**: producer와 runtime fallback은 동일한 22-page 의미 map을 만들고, guide처럼 뉴스가 불필요한 route는 명시적 비적용으로 남긴다. 분류 taxonomy와 ticker alias는 현재 채널 주제를 수용하고 SCREENER_DB universe를 활용한다. 전 채널 실패는 이전 성공 digest의 본문·`generatedAt`을 보존하고 `attemptedAt`/failure만 갱신한다. Telegram 내용은 계속 secondary/reference이며 가격·금리·매매 판단값으로 직접 승격하지 않는다.

**Validation**: `AIO.getTelegramPageCoverageAudit()`, `AIO.getTelegramPipelineAudit().digest.coverage`, T830~T831, `ci-data-pipeline-contract-check.mjs`, `ci-runtime-contract-check.mjs`, `_artifacts/telegram-5d-coverage-audit-2026-07-15.md`.

## R338. 데이터 artifact lineage는 정책별 timestamp와 반영 commit을 함께 검증하고, 다른 시각을 승격하지 않는다 (v52.96, P710)

**Rule**: live-core quote, incremental official reference, daily history, research horizon, editorial note, and universe reference have different freshness semantics. A tracked JSON file must have an explicit policy and timestamp selector; `generatedAt`, `asOf`, `observedAt`, `fetchedAt`, `releaseAt`, `lastSuccessfulAt`, and row dates must not be silently substituted for one another. A current-looking file without producer/source and last-commit evidence is not a complete lineage record.

**Required**: `scripts/ci-data-lineage-audit.mjs` must enumerate every tracked `public-data/*.json`, report timestamp/age/source/producer failures/last commit, fail on missing or invalid core lineage, warn on reference/research staleness, and preserve explicit decision-use gates such as SEC coverage below 80%. Its report is local/CI evidence only and never upgrades provider rights, factual truth, live deployment, or human/legal approval.

**Validation**: `node scripts/ci-data-lineage-audit.mjs --json` with the 12-artifact local report and CI invocation.

## R335. BLS 공식 macro evidence는 FRED 대체값이 아니라 typed primary producer로 보존한다 (v52.94)

**Rule**: BLS keyless API 값은 FRED 값과 별도의 sourceKind/evidence/series metadata로 보존한다. `releaseAt`은 API가 제공하지 않으면 null이어야 하며, fetch time을 release time으로 승격하지 않는다. M13·연간 평균·불충분한 history·실패 응답은 정상 관측값이나 결정용 값으로 혼합하지 않는다.

**Required**: allowlist와 bounded POST를 유지하고 12시간 성공 캐시, last-known-good, `attemptedAt/failureReason`, unit/frequency/seasonalAdjustment, derived input observation periods를 artifact와 runtime contract fixture로 검증한다.

## R336. 모든 route의 page completeness는 producer failure와 reference fallback을 종결 상태로 노출한다 (v52.94)

**Rule**: `loading`을 최종 상태로 남기지 말고 `loaded | partial | empty | blocked | stale-reference` 중 하나로 종료한다. `missing/zero`, 공급자 장애, stale/reference를 서로 다른 상태로 유지하며 required producer가 충족되지 않으면 해당 route의 금지 claim과 allowed use를 함께 노출한다.

**Required**: `AIO_PAGE_CONTRACTS.pages[id]`의 required/optional/coverage/age/failure/forbidden fields와 `AIO.getPageDataCompleteness()`/`auditPageDataCompleteness({allRoutes:true})`를 단일 실행 경로로 사용한다. 22-route fixture, runtime contract, headless/accessibility/viewport matrix를 큰 변경 단위마다 통과시킨다.

## R337. Runtime fixture override와 reference fallback drift의 의미를 테스트 계약에 고정한다 (v52.94, P709)

**Rule**: 명시적인 `_aioScreenerLoadState.status` fixture/operator 상태는 실제 artifact metadata보다 우선하여 producer 장애를 재현해야 한다. 반대로 날짜가 있는 `_fallback` mirror의 값 차이는 `referenceOnly/fallbackAsOf/snapshotAsOf/parityRequired`로 공개하고, reference-only 상태를 live parity 실패로 승격하지 않는다.

**Required**: T686은 zero drift 또는 명시적인 dated reference-only evidence만 허용하고, T1022는 실제 artifact가 존재하는 환경에서도 disconnected producer를 검증한다. `AIO.getSnapshotFallbackConsistencyAudit()`와 page completeness API를 함께 유지한다.

## R313. AI reference retrieval must be intent-aware, top-k bounded, source-separated, and deterministically compacted (v52.78, P693)

**Rule**: Imported research is `REFERENCE` material, not current market evidence. AI context assembly must classify the question, declare required evidence fields, rank route-relevant research with a stable top-k/tie order, and compact over-budget reference text deterministically within the declared 2K–6K token budget.

**Required**: Reuse `AIO.classifyAIQueryIntent`, `AIO.retrieveImportedResearch`, `AIO.buildAIRetrievalContext`, and `AIO.compactAIContext`; preserve `sourceKind`/`asOf` and the explicit live/SNAPSHOT/verified-data rule. Do not trim separately injected current evidence or create a parallel AI truth store. Record P95 input-token samples using the shared chars/4 estimator with the stated ±10% target.

**Validation**: T950~T957, WP-AI3 runtime-contract checks, `AIO.getAIRetrievalAudit`, `AIO.recordAIContextBudget`, and Chromium headless `1018/1018 PASS` locally. Live model/retrieval quality certification remains separate.

## R314. External AI inputs must be explicitly untrusted and portfolio data must be allowlisted (v52.79, P694)

**Rule**: News, Telegram, web-search, and translation-source text are data, not instructions. Normalize hidden/control characters, audit injection signatures, and wrap the block before model submission. Portfolio AI may send only the declared field allowlist after a session-only consent preview; chat history must expose bounded retention and off mode.

**Required**: Reuse `AIO.sanitizeAIUntrustedText`, `AIO.buildAIUntrustedBlock`, `AIO.redactPortfolioForAI`, `AIO.getPortfolioAIPrivacyPreview`, and `AIO.getChatHistoryPolicy`. Do not pass account/user identifiers, exact position quantities/costs, targets, or raw journal fields by default.

**Validation**: T958~T962, WP-AI4 runtime-contract checks, and Chromium headless `1027/1027 PASS` locally.

## R315. Personalized financial action permission must be evaluated once at the shared response boundary (v52.79, P694)

**Rule**: Prohibited conduct is denied; personalized trade instructions require suitability, current/live evidence, sourceKind/asOf, and explicit assumptions/invalidation context. Stale, missing, or `REFERENCE`-only evidence cannot authorize a personalized action. Probability claims require evidence or calibration metadata.

**Required**: Use `AIO.evaluateAIActionPermission` inside `_aioRunAIResponsePipeline`; retain `conductAudit` in the response envelope and do not create a per-page parallel gate.

**Validation**: T963~T966 and WP-AI5 runtime-contract checks; live model/red-team and jurisdiction-specific legal review remain separate.

## R316. Automated content must pass a publish audit and retain a deterministic fallback/source label (v52.80, P695)

**Rule**: Translation, briefing, and market-analysis output are publish surfaces, not merely chat responses. Structured claim corruption or a missing required envelope must fail closed without breaking the page; expose a deterministic evidence-summary/template fallback and distinguish it from AI-generated text.

**Required**: Reuse `AIO.validateAIAutomatedPublish`, `AIO.buildDeterministicEvidenceSummary`, and `AIO.getAIOutputSourceLabel` through the shared response pipeline. Preserve the existing `AIO.synthesizeMarketAnalysis` fallback for unverified server prose.

**Validation**: T967~T968, WP-AI6 runtime-contract checks, and Chromium headless `1032/1032 PASS` locally.

## R317. AI page context contracts must be projected from the existing page registry (v52.80, P695)

**Rule**: Every route must declare required/optional/forbidden AI data, beginner/expert answer modes, decision policy, and explicit disabled-state behavior. The source of truth remains `AIO_PAGE_CONTRACTS`; aliases such as `kr-technical`/`kr-tech` are audited explicitly.

**Required**: Reuse `AIO.getPageAIContract` and `AIO.auditPageAIContracts`; do not create a parallel route registry or silently omit a page context.

**Validation**: T969~T971, WP-AI7 runtime-contract checks, and 22-route audit with `silentDisabled=0`.

## R326. Tool capabilities are read-only by default and mutation/unknown operations are denied (v52.86, P701)

**Rule**: AI may inspect explicitly registered read-only data only. Unknown capabilities, writes, orders, account changes, external sends, file/network mutations, and operation mismatches are denied at the shared response boundary.

**Required**: Reuse `AIO.getAIToolCapabilityRegistry`, `AIO.evaluateAIToolPermission`, and `AIO.auditAIToolCapabilities`; do not infer write permission from user prose or create an entrypoint-specific mutation path.

**Validation**: T1007~T1009 and T1013, WP-AI19 runtime-contract checks, and Chromium headless `1075/1075 PASS` locally. Live tool/operator certification remains separate.

## R327. Provider/data/output rights, retention, training, redistribution, and region require explicit registry approval (v52.86, P701)

**Rule**: Availability of a provider or data source is not rights approval. Missing or unverified rights metadata remains review-required; notices must state the scope and no training/redistribution/region permission may be inferred.

**Required**: Reuse `AIO.getAIRightsRegistry`, `AIO.evaluateAIDataRights`, and `AIO.auditAIRightsRegistry`; keep local-reference approval separate from live provider/legal/operator verification.

**Validation**: T1010~T1014, WP-AI20 runtime-contract checks, and Chromium headless `1075/1075 PASS` locally. Live rights/legal/operator certification remains separate.

## R324. Coverage and exposure audits must neutralize missingness before recommendations (v52.85, P700)

**Rule**: Region/sector/cap/liquidity/source coverage and exposure must be reported explicitly. Missing or unknown fields are neutral, never a positive/negative score or eligible recommendation; any promotion of missingness fails the gate.

**Required**: Reuse `AIO.buildAICoverageExposureReport` and `AIO.evaluateAICoverageBias`; retain per-dimension missingness, exposure counts, unknown rows, and promoted IDs. Keep population/model bias certification separate from local structural coverage.

**Validation**: T999~T1001, WP-AI17 runtime-contract checks, and Chromium headless `1067/1067 PASS` locally. Live universe/model bias remains separate.

## R325. Human chat claims require signed cross-mode evidence and explicit incomplete states (v52.85, P700)

**Rule**: Chat usability/accessibility claims require screen-reader, keyboard, mobile, novice, expert, and task-completion evidence with evidence ID, signer, and signed timestamp. Missing dimensions or signatures are blocked, not silently promoted to pass.

**Required**: Reuse `AIO.getHumanChatCertificationMatrix`, `AIO.createHumanChatCertification`, and `AIO.evaluateHumanChatCertification`; preserve surface/route/viewport/assistive-tech context and keep live human certification separate from local fixtures.

**Validation**: T1002~T1006, WP-AI18 runtime-contract checks, and Chromium headless `1067/1067 PASS` locally. Live SR/mobile/user certification remains separate.

## R322. Model releases require replay provenance, approval, canary, and rollback evidence (v52.84, P699)

**Rule**: A model response is replayable only when request/app/data/Worker revision, model, prompt, retriever, validator, evidence snapshot, sampling, and output hash are retained. Release approval requires named owner/reviewer, replay pass, canary pass, and no rollback trigger.

**Required**: Reuse `AIO.createAIReplayManifest`, `AIO.recordAIReplayManifest`, `AIO.replayAIResponseSample`, and `AIO.evaluateAIModelRelease`; keep model prose separate from Evidence and fail closed on metadata/output drift.

**Validation**: T991~T994, WP-AI15 runtime-contract checks, and Chromium headless `1059/1059 PASS` locally. Live provider/model replay and canary certification remain separate.

## R323. AI cache identity, idempotency, and stream completion must be tenant-safe and auditable (v52.84, P699)

**Rule**: Response/context identity must include tenant/session/route/entity/evidence/model/prompt/retriever scope without raw identifier leakage. Duplicate in-flight requests are denied, completed requests are replay-only, and partial/aborted streams cannot be silently promoted to complete.

**Required**: Reuse `AIO.buildAIIsolationCacheKey`, `AIO.beginAIIdempotentRequest`, `AIO.finalizeAIIdempotentRequest`, `AIO.abortAIIdempotentRequest`, and `AIO.finalizeAIStream`; keep current request ownership and stream state at the shared pipeline boundary.

**Validation**: T995~T998, WP-AI16 runtime-contract checks, and Chromium headless `1059/1059 PASS` locally. Live multi-user race/isolation certification remains separate.

## R320. Retrieval documents require lifecycle metadata and poisoning quarantine before AI use (v52.83, P698)

**Rule**: Imported research is untrusted reference material. Every indexed document must retain document/chunk/version/time/source-tier metadata; injection/encoded/hidden content, retracted, superseded, or manually quarantined rows cannot enter active top-k or current-action evidence.

**Required**: Reuse `AIO.indexAIRetrievalDocuments`, `AIO.evaluateAIRetrievalQuality`, `AIO.quarantineAIRetrievalDocument`, and `AIO.retrieveImportedResearch`. Record recall/precision/source-tier/temporal metrics and fail closed when a quarantined document is used by a current action path.

**Validation**: T983~T987, WP-AI13 runtime-contract checks, and Chromium headless `1051/1051 PASS` locally. Live retrieval/model certification remains separate.

## R321. Financial conduct classification must preserve P0, legal-review, and educational states (v52.83, P698)

**Rule**: Conduct policy must classify all matched categories, block executable prohibited conduct at P0, route actionable jurisdictional/legal/tax/regulatory advice to legal review, and preserve non-actionable educational explanations. The shared response boundary is the enforcement point.

**Required**: Reuse `AIO.getFinancialConductPolicy`, `AIO.classifyFinancialConduct`, and `AIO.evaluateAIActionPermission`; do not create per-entrypoint conduct exceptions or silently convert legal-review-required content into advice.

**Validation**: T988~T990, WP-AI14 runtime-contract checks, and Chromium headless `1051/1051 PASS` locally. Live red-team/legal certification remains separate.

## R318. AI operations and release claims require measured SLO, deterministic benchmark, and manifest-linked feedback (v52.81, P696)

**Rule**: Provider usage, latency, token/cost, quota, model A/B, and user feedback must be observable through bounded local contracts. A candidate is not releasable when it regresses groundedness/currentness/action safety, exceeds the latency/cost tolerance, or has any P0 error.

**Required**: Reuse `AIO.recordAISLOSample`, `AIO.getAISLOReport`, `AIO.tryAcquireAIQuota`, `AIO.runAIGoldenBenchmark`, `AIO.evaluateAIGoldenABGate`, and `AIO.createAIFeedbackSample`. Keep live-provider/model certification separate from deterministic local fixtures.

**Validation**: T972~T976, WP-AI8/9/10 runtime-contract checks, and Chromium headless `1037/1037 PASS` locally.

## R319. Conversation state and finance arithmetic must be deterministic, scoped, and auditable (v52.82, P697)

**Rule**: A response may render only for its current session/turn/route/entity. Route/entity changes, cancel, retry, timeout, and trim must invalidate stale ownership. Financial arithmetic must come from an approved deterministic calculator and a validated `CalculationEvidence` object; model-generated numbers cannot become decision inputs.

**Required**: Reuse `AIO.createAIConversationState`, `AIO.transitionAIConversationState`, `AIO.isCurrentAIResponse`, `AIO.runApprovedCalculation`, `AIO.validateCalculationEvidence`, and `AIO.checkCalculationInvariant`.

**Validation**: T977~T982, WP-AI11/12 runtime-contract checks, and Chromium headless `1043/1043 PASS` locally.

## R312. Structured current-sensitive AI claims must preserve typed Evidence identity and fail closed on mismatch (v52.77, P692)

**Rule**: A model-generated current-sensitive claim is not publishable merely because it contains a number. It must carry metric, value, unit, scale, direction, as-of, source/sourceKind, and exactly one evidenceId that resolves to the same metric/unit/scale/value/direction evidence row. Unstructured prose remains subject to the existing public action/freshness gates; structured claim envelopes additionally pass the shared WP-AI2 claim audit.

**Required**: Reuse the common `_aioRunAIResponsePipeline`; do not create a parallel AI-only validator or evidence store. Block missing/duplicate evidence, future or missing as-of/source, F&G↔VIX confusion, NFP scale errors, bp↔percent errors, sign reversal, and FX quote inversion. Keep counterexample fixtures in T941~T949 and keep the prompt schema versioned.

**Validation**: `AIO.createTypedClaim`, `AIO.validateTypedClaim`, `AIO.validateAIResponseClaims`, `claimAudit`, WP-AI2 runtime contract, and Chromium headless T941~T949 (`1010/1010 PASS` locally). Live model-output certification is separate.

## R311. 공개 AI의 모든 진입점은 동일 요청 envelope·응답 pipeline·validator/block-policy 버전을 기록하고 retry는 같은 completion contract를 재사용한다 (v52.76, P691)

- per-page/unified/retry/translation/briefing/server-analysis는 `_aioCreateAIRequestObject`와 `_aioRunAIResponsePipeline`을 공유한다. 새 parallel validator를 만들지 말고 기존 action gate를 공통 pipeline에 흡수한다.
- request object에는 entrypoint·requestId·attempt·pipelineVersion·validatorVersion·blockPolicyVersion을 기록하고, retry는 새 request를 만들지 않는다. 최종 manifest에는 raw model text를 저장하지 않는다.
- 자동 콘텐츠가 pipeline 부재 또는 공개 action 정책 차단을 만나면 local/deterministic fallback으로 닫혀야 하며, undefined `CHAT_CONTEXTS`로 조용히 실패하면 안 된다. T937–T940과 runtime contract를 함께 유지한다.

## R310. 공개 AI는 렌더 경계까지 베타·교육/리서치 보조 정책을 강제하고, 검증되지 않은 자동 문장을 공개하지 않는다 (v52.75, P690)

- 공개 AI 표면은 `AI 베타 · 교육/리서치 보조`로 식별해야 하며, 독립 투자자문·검증 시스템·실시간 주문 도구처럼 보이는 문구를 사용하지 않는다.
- 구체적인 매수·매도·진입·청산·비중·수량·손절·목표가 지시는 typed evidence/suitability/action gate가 구현·통과되기 전까지 차단한다. 이 게이트는 streaming, 완료, retry, 양쪽 채팅 진입점, assistant history와 후속 chips에 동일하게 적용한다.
- current-sensitive 답변은 기준시각·Evidence 상태·원천/원문 재확인 안내를 표시하고, `marketAnalysisOk` 생성 성공만으로 자동 LLM 문장을 공개하지 않는다. 의미 검증 `marketAnalysisSemanticOk=true` 또는 명시적 `status: verified`가 필요하다.
- 검증은 T932–T936와 `ci-runtime-contract-check.mjs`로 concrete/강한 방향성 action 차단·교육성 답변·disclosure 메타·unverified marketAnalysis 폴백을 모두 고정한다. 현재 로컬 Chromium 기준선은 `997/997 PASS`이며, 실제 Pages/Worker와 모델 문답은 별도 live gate다.

## R301. 일반 사용자 부팅 경로에서는 배포·공유·전수 Evidence 감사를 실행하지 않는다 (v52.74)

- 부팅 및 페이지 이동 이벤트가 호출하는 함수는 활성 페이지와 이미 수집된 런타임 상태만 읽어야 한다. `getShareReadinessAudit`, `getDeploymentGateAudit`, `getAutoOpsReadiness`, full-surface DOM/text 감사는 CI·명시적 개발자 모드에서만 허용한다.
- 초기 상태 UI는 `pointer-events:none`인 비차단 표시여야 하며 3초 이내 강제 해제한다. 상태 표시의 존재를 성능 개선으로 간주하지 않는다.
- CI는 실제 Chromium에서 FCP ≤2.5초, 최초 페이지 전환 ≤2초, 최대 long task ≤2.5초, 목적 라우트 활성화와 상태 표시 해제를 검증한다.

## R300. When turning on new error/warning signal collection inside a test harness that deliberately blocks network access, expect the app's own legitimate failure-detection code to surface through that same channel — trace it to source before allowlisting or failing on it (v52.52)

- Adding `page.on('pageerror')`/`page.on('console')` collection to `scripts/ci-viewport-matrix-check.mjs` (which had never collected either before — a route could throw on every single visit and still report a clean PASS) immediately surfaced 8 new "failures" the moment it was turned on, all sharing one message shape: `[AIO:api] {source}: warn → error {errCount: 3}`. Tracing this to its source (`js/aio-core.js` `_reportApiError()`) showed it was the app's own intentional API-health monitor correctly detecting that a data source failed 3 consecutive times and escalating its tracked status from `warn` to `error` — entirely expected, since this exact harness aborts every external network request by design (for deterministic, offline testing). Not a bug; the app behaving exactly as designed under conditions the test itself created.
- The fix is not to disable the new error collection (that would throw away the real signal it's meant to provide) and not to blanket-suppress all `console.error` (same problem). Extend the allowlist to match the *specific, verified* expected-noise pattern only, the same way this repo already handles `net::ERR_FAILED`/`Failed to load resource` in `ci-headless-tests.mjs` (documented there as "the expected side-effect of the route.abort() below, not a real regression"). A narrow, source-traced allowlist entry preserves the ability to catch a genuinely new unexpected error later; a broad one (e.g. matching on `[AIO:api]` alone, or any `console.error` containing "error") would silently swallow real regressions in the same logging subsystem.
- General pattern: any time a QA harness deliberately creates an abnormal environment (blocked network, mocked time, stubbed randomness, forced error injection) and you add a *new* signal-collection mechanism to that harness, budget time to first triage what fires under normal/expected conditions before treating the first run's failure list as a queue of real bugs to fix. Some of it usually is real (see the F-01 SVG-overlap bug this same effort found and fixed, P667) — but conflating "test-environment-induced expected noise" with "genuine defect" either wastes effort chasing non-bugs or, worse, trains the next person to distrust and ignore the new gate.
- See P667/BUG-POSTMORTEM.md.

## R299. A factor backtest's universe composition and lookback window can flip the sign of a well-known factor — don't compare against academic-literature factor performance without matching sample characteristics (v52.51)

- A 10-year (2016-2026), 120-large-cap-ticker, monthly-rebalanced backtest of the live factor ranking model's `lowvol` sub-factor (`-annualizedVol`, computed over a trailing 60-day window) found a *statistically significant negative* Spearman IC with 5/21/63-day forward returns (e.g. 21-day: ICIR=-0.191, t-stat=-2.04, 95% CI [-0.093,-0.002], strengthening in the more recent walk-forward holdout period to ICIR=-0.491/t=-2.95) — the opposite sign from the "low-volatility anomaly" the factor's inclusion presumably assumed. The blended composite (momentum+trend+lowvol+kalman at live NEUTRAL weights) showed no statistically distinguishable-from-zero signal at any of 1/5/21/63-day horizons over the same sample.
- Two candidate explanations, both plausible and neither proven: the academic low-vol anomaly is usually measured on a full-market universe over multi-decade, multi-regime windows using risk-adjusted (often beta-relative) volatility — a top-120-by-market-cap, single-decade, raw-60-day-volatility measurement is a materially different construct, not a replication attempt of the same claim. Separately, this specific decade's sample happens to be dominated by large-cap tech/AI-theme names where the historically-quieter (lower realized vol) names underperformed the historically-more-volatile high-growth names — a sample-composition effect, not necessarily a universal property of "low volatility" as a concept.
- Before citing an academic factor-investing result (low-vol anomaly, momentum premium, quality premium, etc.) as justification for a scoring/ranking rule, or before treating a backtest's finding as evidence the underlying factor concept itself is wrong, check whether the backtest's universe (breadth, cap-weighting, sector composition), lookback window (which regimes it does/doesn't span), and exact factor definition (raw vs risk-adjusted, lookback length) actually match the literature's — a narrow, sample-specific result can validly point in the opposite direction from the general finding without either being "wrong."
- Same underlying caution as R298 (fixed absolute thresholds vs. regime shift) applied to a different failure mode: there, a *rule's own threshold* didn't survive a regime-spanning window; here, a *factor's own sign* doesn't necessarily generalize from a narrow sample back to the broad-universe literature claim that motivated including it.
- This finding does **not** by itself justify silently changing `_aioComputeFactorRanks()`'s live factor weights or the `lowvol` factor's direction/inclusion — same principle as R298's closing point: report it, don't act on it unilaterally on a partial-coverage (4-of-7-factor, subset-not-full-universe, survivorship-bias-unresolved) validation result.
- See P666/BUG-POSTMORTEM.md, `public-data/factor-backtest-longrun.json`.

## R298. A hand-tuned score using fixed absolute-level thresholds on a macro indicator must be re-validated against realized outcomes across a regime-shifting window before trusting its sign, not just its shape (v52.49)

- `computeTradingScore()`'s `macroScore`/`volScore` components compare live values against fixed absolute numbers (`dxy > 107`, `tnx > 4.5`, `vix < 15` for top volScore tier) that were presumably reasonable at whatever moment they were chosen. A 10-year backtest (2016-07 to 2026-07, `scripts/backtest-trading-score-longrun.mjs` → `public-data/score-backtest-longrun.json`) found the reconstructed vol+trend+macro sub-formula (55% of the score's weight) has a *statistically significant negative* Spearman correlation with both 21-day (rho=-0.165, 95% CI [-0.203,-0.127], n=2492) and 63-day (rho=-0.255, CI [-0.291,-0.217], n=2450) forward SPX returns — stable in sign across a chronological reference/holdout split, not a one-period fluke.
- The leading hypothesis (not proven, but consistent with the data): `tnx`/`dxy`'s fixed absolute thresholds don't adapt to the fact that this 10-year window itself spans a structural regime shift (near-zero rates through ~2021, then a multi-year rate-hiking regime from 2022) — "high TNX" by 2016 standards and "high TNX" by 2023 standards are different regime positions, but the score treats them identically. `volScore`'s "low VIX = high score" logic independently shows the strongest single-factor negative correlation of the three (rho=-0.171 at 21d) — consistent with the broader, independently-documented observation that unusually low realized/implied volatility often precedes complacency-driven mean-reversion rather than continued calm.
- Before adding a new absolute-level threshold to a scoring/decision function (or trusting an existing one), check whether that threshold's "high/low" classification would mean the same thing across the full multi-year range the function is expected to operate over — if the underlying indicator has a known multi-year secular trend or regime dependency (rates, dollar strength, credit spreads), prefer a rolling-percentile or regime-relative comparison over a hardcoded absolute cutoff, or explicitly document why the absolute cutoff is expected to remain valid.
- A negative/inverted backtest result is itself required output, not a failure to hide: per [[TM-VIII]] (`_context/KNOWLEDGE-BASE.md`) and P665 (`BUG-POSTMORTEM.md`), the finding was written up and the artifact kept exactly as computed — an unfavorable result doesn't get silently discarded or excluded from the next validation pass.
- **This finding does NOT by itself justify silently changing `computeTradingScore()`'s live logic, thresholds, or `getScoreAdvice()` text.** The backtest covers only ~55% of the score's weight (vol+trend+macro; momScore/breadthScore/PCR/AAII held at neutral constants throughout since no free multi-year PIT source exists for them) — treat "should the live score/label change in response" as a separate, explicit product decision requiring its own confirmation, not an automatic consequence of a partial-coverage validation result.
- See P665/BUG-POSTMORTEM.md, TM-VIII/KNOWLEDGE-BASE.md.

## R297. A score's evidence/provenance registry must list every input the score function actually reads — not just the subset registered when the registry was first built (v52.49)

- `computeTradingScore()` reads ~13 distinct inputs (spx/spy/vix/tnx/hyg/dxy/oil plus vvix/fg/breadth200/pcr/aaiiBear/hyBp), but `TRADING_DECISION_CRITICAL_INPUTS` (the registry `getTradingDecisionInputEvidence()` walks to compute `evidenceStatus`/`evidenceAudit`) only listed the first 7 for a long time — the other 6 could be silently missing or hours-stale with zero effect on the reported evidence status, because they were never in the list being checked. The registry and the score function are two separate pieces of code with no compiler-enforced link between them; nothing fails if they drift apart.
- Before adding a new input to a scoring/decision function, check whether that function's output already has an evidence/provenance registry consuming it, and if so, add the new input there in the same change — not as a follow-up. Conversely, when auditing an existing evidence registry's completeness, don't just check that it runs without error; read the scored function's own source and diff its actual input list against the registry's `id`/`symbol` list by hand.
- Not every input needs the same registry shape: inputs read via `window._liveData[symbol].price` (quote-based) and inputs read via a bespoke `window` global (`_lastFG`, `_breadth200`, `_putCallRatio`, `_hySpreadBp`, `_aaiiBearish` — each with its own fallback chain already written inline in the scoring function) need different evidence-lookup code, since the latter have no symbol to key a live-quote lookup on and instead need the same `_markFetch(apiName)` central freshness registry (v48.36) other API fetches already use. A registry entry for a global-var input is useless if that global is never `_markFetch`-registered anywhere — add the `_markFetch` call at the same time as the registry entry, not after.
- Not every input is trading-grade even when present: an input that is *always* snapshot/reference tier by its nature (e.g. AAII bearish %, a weekly manually-refreshed survey number with no live-fetch path at all) should be tagged `decisionUse:'reference'` rather than `'trading'`, so it is honestly excluded from a "critical inputs missing" gate instead of permanently tripping it (or, worse, being silently dropped from the registry entirely to avoid that false trip — which is how it went missing in the first place).
- A regression test asserting the registry's `total` input count (a specific number, e.g. 13) is a deliberate, narrow exception to R279 ("don't hardcode a literal a test happens to observe") — here the literal *is* the structural property under test: it trips on purpose the next time a 14th input is added to the score function without a matching registry entry, forcing a human to update both together rather than let them silently diverge again.
- See P664/BUG-POSTMORTEM.md (WO-6): `_aioDefaultDecision()`, the shared cross-page decision-header builder, had an entirely separate problem in the same area — it already computed a `sourceKind`/confidence badge from 5 raw macro metrics, but discarded `computeTradingScore()`'s own `evidenceAudit` (reading only `.total`), so the screen's provenance badge and the score's own evidence-completeness could show two disconnected pictures. Fixed by merging `evidenceAudit.criticalMissing.length` into the page's `sourceKind` computation, bounded (0→no change, 1-2→mild DELAYED, 3+→SNAPSHOT) so routine single-input staleness doesn't flip every page to a permanently degraded badge — an unbounded merge would trade one honesty bug (stale shown as live) for its mirror image (routinely-fresh shown as permanently stale).

## R280. A global function declared in more than one non-module `<script>` (inline or external) silently loses all but the last-loaded definition — with no error, no warning (v52.8, mechanically gated v52.19)

- Classic (non-module) `<script>` tags share one global scope. If the same function name is declared with `function`/`async function` syntax in two different `<script>` blocks — inline, external, or a mix — the *last one to execute* wins completely; every earlier declaration (and everything only it called) becomes silently unreachable. No console error, no lint signal from either file read in isolation.
- `<script defer>` external files always execute after all inline `<script>` blocks that precede them in document order — so a duplicate between an inline block and a deferred external file always resolves to the external file's version, regardless of which looks more "current."
- Before adding a new top-level `function name(){}` to any non-IIFE-wrapped `js/*.js` file or an inline `<script>` block in index.html, grep the *entire* codebase for that exact name first. If a match exists, rename one, make one explicitly call the other, or delete the obsolete one — never let two same-named declarations coexist unremarked.
- **v52.19: this is no longer a human-grep-only rule.** `scripts/ci-structural-check.mjs` extracts every column-0 (true top-level) `function`/`async function` declaration from index.html and all 5 runtime `js/*.js` modules and fails the build if any name appears in more than one file (a small allowlist exists only for a confirmed-tracked, not-yet-resolved shadow — currently empty). A future accidental reintroduction of this class is now caught at CI time, not discovered live.
- Complements R260 (same file/scope duplicate — single-file check) and R275 (shared global *objects* must merge, not overwrite) — R280 covers the same last-write-wins hazard applied to *functions* declared across *separate files*.
- See P605/P626, BUG-POSTMORTEM.md.

## R279. A regression test must assert the structural property a value is supposed to satisfy, not the specific value/date/count observed when the test was written — that literal will itself go stale (v52.7, broadened v52.20)

- Originally (v52.7): a frequency string embedding a required weekday (e.g. `monthly-first-friday`) must snap to that weekday after every mechanical date-advance, not just shift by a calendar month/day count. A mechanical "advance this stale date to the next cycle" loop that steps by `+1 month` preserves the *day-of-month*, not the *day-of-week* — for a weekday-anchored release (e.g. US NFP: always the first Friday), this can silently produce a date the event can never fall on. Check for the weekday-anchor pattern *before* a generic "contains 'monthly'" branch, and compute the actual target weekday rather than reusing the previous cycle's day-of-month.
- **v52.20 (P627): this generalizes well beyond calendar dates.** A test that hardcodes an exact number, count, keyword, or date literal observed at write-time — rather than the *range*, *shape*, or *invariant* that value was actually meant to demonstrate — is guaranteed to fail again the moment that value legitimately changes (a periodically-refreshed market seed, a rolling-window digest's content, a version string, a macro indicator reading). Six-plus instances of this same root cause were found and fixed in one pass: exact-equality checks on legitimately-refreshed data seeds (assert a sanity range instead), one-off print values elevated to permanent thresholds inside an otherwise-correct sanity band (assert the real economic/structural threshold, e.g. PMI's 50-point expansion boundary, not the specific month's print), pinned calendar dates on any auto-advancing schedule (assert validity + not-in-the-past + weekday-anchor, not the literal date), and pinned content/counts from a deliberately rolling-window data source (assert shape and cross-field consistency, not what a specific week's content happened to say).
- A regression test for this class of bug must assert the structural property generically across whatever the current value is — not a specific literal, which will itself go stale and either need constant upkeep or get quietly skip-listed as "drift" and stop actually checking anything. If a hardcoded literal is truly unavoidable (e.g. a genuinely fixed structural constant), that's a signal the literal itself, not the test, deserves a comment explaining why it won't drift.
- Narrower sibling of R267 ("current"-labeled rolling aggregations must anchor windows to the newest observation) — both are about mechanical date/window/value math silently producing a plausible-looking but wrong result (or a plausible-looking but wrong *test*) when a hidden anchoring requirement isn't carried through.
- See P604 (original NFP case), P627 (eight-test generalization: breadth SMA seeds, KR/US macro sanity bands, FOMC/NFP/CPI/PCE calendar, semver format, Telegram digest content/dates/page-map).
- See P604/BUG-POSTMORTEM.md.

## R278. A `workflow_run`-triggered job that needs the commit its trigger produced must checkout `head_branch`, not `head_sha` (v52.5)

- `github.event.workflow_run.head_sha` is fixed to the head of the triggering workflow's branch **at the moment that workflow started** — not any commit it committed/pushed during its own run. A downstream job that does `actions/checkout@v4` with `ref: ${{ github.event.workflow_run.head_sha }}` in order to validate or deploy "what the triggering run just produced" will instead always get the commit that existed *before* that run's own work — one full cycle behind, indefinitely, on every single firing.
- If the triggering workflow's own job is a commit-and-push job (a bot/data-refresh workflow) and a downstream `workflow_run` job needs that pushed commit, checkout `ref: ${{ github.event.workflow_run.head_branch }}` instead (the branch name, e.g. `main`) — this resolves to the actual current head of that branch at checkout time, which by the time the `workflow_run` event has fired already includes the push. Guard it so `push`/`pull_request`/`workflow_dispatch` paths (which have no `workflow_run` payload) keep their existing behavior: `${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_branch || github.sha }}`.
- A validate/deploy job silently running on the wrong tree is worse than it failing loudly: the run goes green, any redeployed artifact's `Last-Modified` timestamp updates, and nothing in the job's own log looks wrong unless someone specifically diffs the checked-out SHA against the commit the triggering run actually pushed.
- See P602/BUG-POSTMORTEM.md and `_context/FABLE-LIVE-AUDIT-2026-07-04.md` P0: this exact pattern in `ci.yml`'s three jobs (validate/headless-tests/deploy) meant every bot data-refresh cycle had its CI validate and its live deploy carry the *previous* cycle's tree — live `data.json` got a fresh deploy timestamp with stale content on every cycle since R272/P591 wired up the `workflow_run` chain.

## R277. An external deploy/publish action known to fail transiently must retry once in the same job, not rely on the next scheduled cycle to self-heal (v52.4)
## R276. New code needing current market/risk/regime/breadth/cycle condition must consume `window.AIO.marketState`, not re-derive it independently (v52.3)

- `window.AIO.computeMarketState()` (js/aio-core.js:2728-2823) is the single synthesis point for derived market condition — it composes `_aioRegimeNow()` + `getCycleFromMacro()` + `diagnoseBreadthConsensus()` + `AIO_ACTION_RULES.getActionPlan()` + news sentiment (`_aioComputeNewsSignal()`) into one `window.AIO.marketState` object and dispatches `aio:marketStateUpdated`, throttled to once per 2s, whenever any input could have changed (`aio:liveQuotes`/`aio:pageShown`/`aio:serverDataLoaded`/`aio:newsUpdated` all trigger a recompute).
- New code that needs any of `spx`/`vix`/`fg`/`vixBand(Label)`/`fgZone(Label)`/`cyclePhase`/`cycleScore`/`cycleFull`/`breadthConsensus`/`breadthScore`/`breadthConsensusFull`/`riskLevel`/`riskScore`/`dominantTopic`/`newsSignal`/`actionPlan`/`driftFromSnapshot` must read it from `window.AIO.marketState`, via one of the two patterns already established in the codebase — not by calling `_aioRegimeNow`/`getCycleFromMacro`/`diagnoseBreadthConsensus`/`AIO_ACTION_RULES` directly, and not by reading `window._liveData`/`DATA_SNAPSHOT`/`window._breadth*` raw globals to recompute an equivalent value:
  - **Subscribe** (re-render-on-change surfaces): `window.addEventListener('aio:marketStateUpdated', function(){ /* read window.AIO.marketState */ })` — see js/aio-ui.js:3849, js/aio-core.js:3057-3064 (fans out to 6 renderers: drift markers, action plan, breadth consensus, themes cycle, briefing action, options rec).
  - **Pull with fallback compute** (one-off reads inside another function): `window.AIO.marketState || (window.AIO.computeMarketState && window.AIO.computeMarketState())` — see js/aio-core.js:2843 (`synthesizeMarketAnalysis`).
- If a genuinely new derived market signal is needed that `computeMarketState` doesn't yet produce, extend `computeMarketState` itself to add the field — do not add a parallel independent computation for it elsewhere.
- Non-goal: this does not require migrating the codebase's existing ~4,688 `window.*` references (re-measured 2026-07-04; up from Fable's 2026-07-02 baseline of ~3,371, consistent with Phase 3 [A3] relocating a globals-dense 273-line block into aio-core.js). That migration is out of one-session scope and tracked as chronic/long-term in `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §A4 — this rule is a forward-looking guard for new code only.
- Out of scope: purely local/one-off UI state unrelated to shared market conditions (e.g. a dropdown's open/closed flag) is not what this rule targets.
- Complements R244 (an already-displayed value must not be independently recomputed per surface — a display-consistency rule): R276 is the more general source-discipline rule — don't create a new independent computation path in the first place, regardless of whether the value is already displayed elsewhere.
- See P600/BUG-POSTMORTEM.md.
- **Additional precedent (P606/v52.9)**: themes page's top-right cycle chip computed its own independent `defCount`/`cycCount` sector-leadership heuristic while the same page's body (`_aioRenderThemesCycle`) already read the correct source (`marketState.cycleFull`/`getCycleFromMacro`) — the two silently disagreed on-screen. Fixed by pointing the chip at the same source instead of a parallel heuristic. Pre-dated this rule's own introduction (v52.3), which is exactly the kind of older UI code this rule exists to catch when next touched.

## R275. A shared global object populated by multiple files must always be merged, never plainly overwritten — even if today's load order happens to make it safe (v51.99)
## R274. A live-fetch binding introduced for an existing labeled/thresholded field must fetch the exact same named indicator the label represents — not a same-topic substitute (v51.97)
## R273. A value that's supposed to mirror or track another value must be verified equal by evaluating both, not by eyeballing the diff — and duplicate/mirror fields must be named to be found (v51.96)
## R272. A bot/Action-authored push using the default `GITHUB_TOKEN` never triggers other `on: push` workflows — chain via `workflow_run` instead, not `[skip ci]` removal alone (v51.95)
## R271. After editing `SCREENER_DB` (js/aio-data.js), always re-run `scripts/sync-screener-universe.mjs` before committing (v51.94)
## R270. A third-party data source's availability and symbol convention must be live-verified, never assumed from a report or general knowledge — and an integration must be scoped down to only the asset classes actually confirmed (v51.92)
## R269. A CI job that whitelists known-failing tests must classify each entry by cause, and adding to the whitelist is only valid right after a fresh, real measurement (v51.91)
## R268. Combining sub-signals of different natural scale into one factor requires normalizing each first (v51.89)
## R267. "Current"-labeled rolling aggregations must anchor windows to the newest observation (v51.88)
## R266. When a measured value and a proxy heuristic coexist, consumers must prefer the measurement — and fetchers must store measurements consumably (v51.88)
## R265. Code that claims parity with a named external tool/methodology must match that source's exact definition, verified by recomputation (v51.86)
## R264. An API key in a URL must never be routed through a third-party proxy; a "sensitive URL" guard must block the egress, not just caching (v51.85)
## R263. Every producer of deployable artifacts must actually trigger the deploy path, and the watchdog must verify the DEPLOYED surface, not just the repo (v51.84)
## R262. Scheduled scrapers/fetchers hitting external feeds must self-throttle with a persisted cursor, not stateless full re-scans (v51.83)

- Any scheduled fetch script that walks a paginated external feed (especially an unofficial one, like Telegram's public web mirror) must persist a cursor (last-seen id/timestamp) between runs and use it to stop early once caught up, rather than re-walking the entire window from scratch every cycle.
- If the output artifact only persists a capped/filtered summary (not the full raw item list), carry forward and merge that summary with freshly-fetched items before recomputing derived fields — an early-stopped fetch must not silently shrink what the app actually consumes.
- `fetch-telegram-digest.mjs`'s `lastPostId` cursor + `topItems`/`broadItems` merge pool is the concrete precedent.
- See P571/BUG-POSTMORTEM.md for the incident (48 full-window re-scans/day of an unofficial scraping surface with zero throttle).

## R261. A "single responsibility" canonical updater must include every DOM sink for its metric (v51.83)

- When a function is documented as the single canonical place that updates all DOM sinks for a metric, any new sibling element added later to display that same metric must be added to that function's sink list in the same change. A forgotten sink silently freezes at its static HTML placeholder forever while the rest of the metric's displays update live.
- `_applyFearGreedScore()`'s sink list (`big`, `val`, `homeFG`, `rat` — js/aio-data.js) is the concrete precedent.
- See P570/BUG-POSTMORTEM.md for the incident (two different F&G numbers on the same sentiment-page card).
- **Additional precedent (P607/v52.10)**: briefing's and signal's own F&G pills didn't even read the wrong-but-existing sink — they read `window._fearGreedValue`, a global never assigned anywhere in the codebase (permanently `undefined`, copy-pasted into two separate pages), instead of the real live-maintained `window._lastFG`. A variant of "forgotten sink": here the sink element existed and was wired to *a* variable, just not the correct one — same failure mode (frozen at placeholder forever) via a different mistake (wrong identifier instead of no call at all).

## R259. Re-registerable event listeners must guard against duplicate registration consistently across sibling elements (v51.83)
## R260. A function must never be redefined more than once at the same scope in the same file (v51.83)
## R258. A hardening measure added to one surface must be checked against equivalent surfaces (v51.83)
## R257. Persisted-and-later-rendered free text needs both input-boundary validation and escaped render (v51.83)
## R256. Every external data source in the fetch pipeline must track per-unit failures, not just an aggregate ok flag (v51.83)
## R255. Automated workflows pushing to a shared branch must rebase/retry on rejection, never push-once-and-drop (v51.83)
## R254. External classification tags are not ground truth without independent keyword support, and AI prompts must verify tag-content consistency (v51.83)
## R253. Multiple DOM bindings for the same metric must share one resolver, not independently-ordered fallback chains (v51.83)
## R252. A static/curated list overlaid with live per-item data must flag contradictions, not silently keep them (v51.83)
## R251. XBRL/multi-source financial data must resolve to the freshest tag and validated period, and refresh handlers must have a real data source (v51.83)
## R250. A shared cross-page renderer must resolve each page's own parameters, not one hardcoded default (v51.83)
## R249. Externally-sourced text must be escaped at the pipeline entry point, not at each render call site (v51.83)
## R248. Deployment must be wired to the CI gate, not merely run alongside it (v51.82)

- If a CI workflow exists specifically to catch bad states before they reach users, the deployment mechanism must actually depend on it (e.g. a `deploy` job with `needs: validate`), not run through an independent, unaware path (e.g. legacy branch-based GitHub Pages, which deploys on push regardless of workflow outcome).
- If a report-only test job becomes fully green and its skip-list is emptied, promote it to a real deploy gate in the same release: remove `continue-on-error` and add it to `deploy.needs`. Leaving a 922/922 suite as report-only is the same failure mode as an unwired gate, just one step less obvious.
- Verify this after any deployment/CI config change: push a commit, confirm the deploy job only runs after validate succeeds, and confirm `gh api repos/{owner}/{repo}/pages` reports `build_type: "workflow"` (not `"legacy"`).
- When migrating from legacy branch-deploy to an Actions-based `deploy-pages` job, the artifact staging step must reproduce whatever exclusions the legacy path silently applied (Jekyll's default dot/underscore exclusion here) — `actions/upload-pages-artifact` performs no such filtering itself, so a naive `path: '.'` would newly publish previously-hidden internal directories.
- See P557/BUG-POSTMORTEM.md for the incident (Pages deployed live regardless of the 33%-failing CI gate).

## R247. CDN/script load-failure detection must not race against `defer` (v51.82)
## R246. Version-bump commits must land atomically; never leave main in a partially-synced state (v51.82)
## R245. Prioritized/boosted content selection must guarantee its picks already ran through required enrichment (v51.82)

- If a display surface reorders or filters a list by an importance/boost score, it must not assume the enrichment (translation, scoring, tagging) a normal reader would need was already applied — enrichment pipelines that process "the first N items in fetch order" or "items visible via a specific DOM marker" do not automatically cover an independently-selected top-N-by-importance subset.
- Any such surface must check whether its selected items already carry the required enrichment and, if not, trigger it directly for exactly those items rather than relying on a generic/lazy mechanism that may never reach them.
- `renderHomeFeed()`'s "핵심 뉴스" catch-up translation call (js/aio-data.js, guarded by `_tcHas`/`_translationInProgress`) is the concrete precedent.
- See P554/BUG-POSTMORTEM.md for the incident (home page's boosted Tier-1/geopolitical headlines were exactly the ones permanently stuck on "[번역 대기]").
- v52.6/P603 update: this rule was only ever applied to `renderHomeFeed` — nine other independently-selected news surfaces built afterward (`_aioRenderPageNewsStrip`, shared by 8 pages' topic-filtered strips; `renderBriefingFeed`'s own score/window selection; `_aioRenderBriefingDigest`'s Top3) each had the exact same gap and sat permanently on "[번역 대기]" until fixed. When adding or reviewing ANY surface that independently selects/filters/sorts a subset of `newsCache` for display (not just "boosted" ones — topic-tag filters count too), check it against this rule, not just against whatever the most recent fixed example was.

## R244. A live-state value shown in multiple UI surfaces must not be computed independently per surface (v51.82)
## R243. Portfolio UX must close input -> AI analysis -> journal reflection -> learning loop (v51.80)
## R242. Portfolio backtests must expose assumptions, monthly construction, drawdown recovery, and active risk (v51.79)
## R241. Public readiness must expose page-level source/asOf, not only aggregate status (v51.78)
## R240. User-supplied trader frameworks must be centralized as REFERENCE, not live levels (v51.77)
## R239. External-share readiness must be visible on the default home path (v51.76, P551)
## R238. Page currentness must be source-capped before visible decisions (v51.74, P549)
## R237. Skills must use router-plus-reference architecture (v51.73)
## R236. Skills and command wrappers must be contract-gated (v51.72)
## R235. calcTechnicalSnapshot fields must close producer-consumer-artifact-gate together (v51.71, P548)
## R234. 신규 UI 블록은 검증 전까지 기본값 hidden (v51.64, P545 예방)
## R233. Ticker technical analysis must prioritize Minervini price/MA/volume/supply logic (v51.45, P536)
## R232. Cross-asset trading factors must use comparable scales (v51.44, P535)

- Screener, rank, and backtest factors that compare stocks across currencies, nominal price levels, or split histories must use returns, log prices, ratios, z-scores, or explicitly versioned normalized units. Raw price-unit velocity is not acceptable for cross-sectional ranking.
- Public-data enrichment must carry a scale/version marker for derived factors whose meaning can change, such as `kalmanScale: "log_pct_day"`. Runtime consumers must merge those fields only when the expected marker is present.
- Trading score copy must distinguish "market is favorable" from "buy aggressively now". `75+` can mean buy-friendly conditions, but visible/chat guidance must still mention position sizing, staged entry, invalidation price, or event risk.
- Backtest summaries must be described as factor sanity/IC checks unless they include walk-forward portfolio construction, transaction costs, slippage, survivorship controls, and execution constraints.
- `scripts/ci-data-pipeline-contract-check.mjs` and `scripts/ci-runtime-contract-check.mjs` are the regression gates for this rule.

## R231. Visual hierarchy must not be locked to the old Bloomberg-terminal premise (v51.43, P534)

- A page is not clean just because the runtime works and the default-route noise is hidden. The first viewport must make the primary decision, next action, data confidence, and most important note visually distinct from ordinary widgets.
- Do not preserve Bloomberg-terminal styling as a constraint when it weakens readability. Dense market data is acceptable, but repeated cyan accents, identical dark cards, negative letter spacing, and long first-screen prose must be reduced when they flatten priority.
- Operator-facing session notes are priority context, but long notes must render as a scan-ready title/lead with the full memo available behind an intentional expansion control.
- KR and secondary pages must follow the same decision-first hierarchy as US/global pages. Legacy intro boxes, status chip bars, and educational prose must not appear above the page decision card unless they are the current primary action.
- Visual hierarchy changes must be closed by a gate or checklist that checks the actual structural markers, not only screenshots or subjective notes.

## R226. Server news backstop must rank by market impact, not arrival order (v50.98)
## R228. Default-route UX must remove collapsed noise and avoid empty grid tracks (v51.30, P529)

- Collapsed `<details>` is not a sufficient cleanup for explanation-only or advanced-framework content on a default route. If a block is not directly actionable in the current session, remove it from the visible path or keep only a hidden legacy sink when runtime/tests still reference an ID.
- Removing content from a default route does not mean deleting the investment logic. Core formulas, decision flows, and framework explanations must be compressed into the guide/methodology reference or another deliberate secondary surface.
- Finite user-facing card groups such as 3 decision cards or 6 snapshot cards must not use CSS `auto-fill`; use `auto-fit` or explicit responsive columns so empty tracks collapse instead of creating large right-side blank space.
- A page should not put long secondary rails such as subcomponent lists, crypto widgets, or framework explanations beside a short primary chart if it creates a tall left column and blank right column. Promote the content to a balanced full-width section or remove it from the default path.
- Operator-facing session notes are priority context, not secondary decoration: if visible, the home operator note must appear before the decision/header flow with readable first-viewport typography.
- Hidden legacy sinks retained for runtime/test compatibility must not be wrapped by default-route folding helpers or reintroduced as visible collapsed rows.
- QA for UI/UX changes must inspect actual user screenshots or viewport captures for visual value density, not only `scrollWidth/clientWidth`.
- `scripts/ci-ux-default-path-check.mjs` must stay wired into CI and must fail if default routes regain visible analysis-flow summaries, duplicate diagnostic widgets, `auto-fill` finite card grids, or lose the guide methodology reference.

## R229. Scheduled workflow embedded scripts must be syntax-gated (v51.30, P530)
## R230. Default-path numeric renderers must be partial-data safe (v51.42, P533)

- Live/default-path renderers must not call `.toFixed()` directly on nested live, scenario, chart, or event-context fields. Normalize through `Number(...)` plus `Number.isFinite(...)`, or use `window._aioSafeFixed()`.
- Treat `_liveData`, public-data JSON, scenario registry outputs, Chart.js tooltip payloads, and event-context objects as partial until proven otherwise.
- `scripts/ci-runtime-contract-check.mjs` must fail if unsafe direct patterns such as `live.price.toFixed`, `sumCheck.sum.toFixed`, or `ctx.parsed.y.toFixed` return.

## R225. News surfaces must provide Korean market rewrite, not translation-only headlines (v50.97)
## R224. Currentness and fallback data must be visible at the consumer surface (v50.96)
## R223. News translation must degrade to Korean insight, not raw English-only context (v50.95)
## R222. Public-data pipelines require an Actions-to-consumer contract gate (v50.94)

- Market/news auto-refresh is complete only when the path is contract-tested end to end: GitHub Actions schedule -> fetch script -> committed `public-data/*.json` artifact -> runtime loader -> runtime audit -> visible/chat/memo consumer.
- `data-watchdog.yml` must fail on stale or too-thin core artifacts, not only malformed JSON. Minimum floors: `symbolsOk >= 70`, `newsCount >= 10`, Telegram digest `count >= 100` and at least 2 channels.
- Optional services that depend on secrets (FRED, LLM market analysis, FMP fundamentals) may degrade without failing the site, but their status must be visible in `AIO.getDataPipelineAudit().layers.sources.publicData`.
- `scripts/ci-data-pipeline-contract-check.mjs` is the static gate for this rule and must be run by CI.

## R221. Telegram/news auto-refresh must close the ticker memo consumer path (v50.93)
## R165. AIO_TICKER_NAME_REGISTRY 의미적 정확성 + 한글 별명 일관성 의무 (v49.80 Codex)
## R166. AIO_THEME_SEMANTIC_EXCLUSION_RULES 의미적 misfit 배제 의무 (v49.80 Codex)
## R159. ticker / options context는 _currentTickerId null + _liveData 미수신 양쪽 가드 의무 (v49.79)
## R160. kr-macro 정적 데이터 / 시점 토큰 진입부 staleness 경고 의무 (v49.79)
## R161. localStorage QuotaExceededError 강화 처리 + 사용자 toast 의무 (v49.79)
## R162. 외부 fetch 결과 schema 검증 + graceful degrade 의무 (v49.79)
## R163. 멀티탭 localStorage storage 이벤트 리스너 의무 (v49.79)
## R164. Claude API 호출 토큰 사용량 누적 추적 + 비용 가시화 의무 (v49.79)
## R156. 외부 fetch 폴백 chain은 sequential 금지, Promise.race 병렬 의무 (v49.78 코드 단위 진단)
## R157. innerHTML 호출 전 _aioSafeMD fallback chain 의무 (v49.78)
## R158. chatSend atomic streaming lock — 입력 검증 통과 직후 즉시 (v49.78)
## R153. chatSend silent return 모든 경로 사용자 피드백 의무 (v49.77)
## R154. callClaude 최종 실패 시 friendly 안내 + 자가 진단 가이드 (v49.77)
## R155. 데이터 ✗ / 환각 검출 시 답변 위 액션 버튼 배너 의무 (v49.77)
## R151. 시세 데이터 ✗ 시 답변에 가격 수치 절대 금지 — HARD STOP (v49.76)
## R152. 모바일 채팅 레이아웃 100vw 비율 의무 (v49.76)
## R147. CHAT_CONTEXTS 등록은 DOM 패널과 항상 쌍 (Pattern A 일반화) (v49.75)
## R148. ABSOLUTE RULES는 system prompt 정의 + 답변 후처리 양쪽 의무 (Pattern B 일반화) (v49.75)
## R149. 외부 fetch 실패는 사용자 ❌ 라벨로 surfacing 의무 (Pattern C 일반화) (v49.75)
## R150. AI 답변에 등장한 날짜 토큰은 세션 시각 대비 stale 자동 검출 (Pattern D 일반화) (v49.75)
## R145. AI 답변에 학습 데이터 자기 인용 + 시점 환각 절대 금지 (v49.74 hotfix)
## R146. home 페이지 인라인 채팅 패널 의무 (v49.74 hotfix)
## R143. AI 답변 품질 audit는 11 페이지 평가 의무 (KR 4 페이지 포함) (v49.74)
## R144. AI 채팅 멀티턴 윈도잉 + 요약 prepend 의무 (v49.74)
## R140. AI 답변에서 정성 표현 사용 시 정량 근거 1개 이상 괄호 동반 의무 (v49.73)
## R141. AI 답변 표준 4 구조 강제 (결론/정량/시나리오/액션) (v49.73)
## R142. 모든 정량 인용 시 (출처 · 기준일) 괄호 필수 (v49.73)
## R138. fundamental 종목 검색 시 7 차트 자동 렌더 의무 (v49.72)
## R139. AI 채팅 답변에 종목 detect 시 "📊 차트 보기" 버튼 자동 삽입 의무 (v49.72)
## R135. 4/5차는 감사 함수만으로 완료 금지
## 📋 작업 전 필수 체크

### 1. 이 폴더 구조 확인 (v48.79+ 모듈화 후)
```
_context/                              ← 지식 베이스 (유일한 진실의 원천)
├── RULES.md                           ← 지금 이 파일 (마스터 룰, 가장 먼저 읽기)
├── BUG-POSTMORTEM.md                  ← 버그 사후 분석 누적 로그 (매 수정 후 기록)
├── QA-CHECKLIST.md                    ← 실행 가능한 QA 체크리스트 v3.3
├── KNOWLEDGE-BASE.md                  ← 기술 인사이트 축적 (R26)
├── CODE-MAP.md                        ← index.html + js 모듈 line 범위 맵 (부분 읽기 가이드)
├── WORKTREE-AUDIT.md                  ← GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리
├── INDEX.md                           ← 지식 베이스 자동 인덱스 (R24)
└── CLAUDE.md                          ← _context/ 컨텍스트 + 파일 구조

루트/
├── CLAUDE.md                          ← 프로젝트 가이드
├── CHANGELOG.md                       ← 버전별 변경 이력
├── index.html + version.json          ← HTML shell + 버전 메타
└── js/                                ← aio-core/data/ui/chat/glossary 모듈
```

### 2. 작업 유형별 반드시 읽을 파일

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| **index.html 수정** | **CODE-MAP.md → 해당 line 범위만 Read** |
| 버그 수정 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md → QA-CHECKLIST.md |
| 새 기능 추가 | RULES.md → CODE-MAP.md → WORKTREE-AUDIT.md(배포/워크트리 영향 시) |
| QA/점검 요청 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 리팩토링/개편 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md |
| 버전 릴리스 | RULES.md(R1~R2) → CHANGELOG.md → WORKTREE-AUDIT.md(배포 상태 기록) |
| 지식 린팅 | RULES.md(R19~R20) → `/knowledge-lint` |

---

## 🔴 절대 규칙 (위반 시 무조건 재작업)

### R1. 버전 동기화 (7곳 필수)
버전 변경 시 반드시 **7곳 모두** 동일한 버전 문자열인지 확인:
1. `<title>` 태그 — `AIO Screener v{버전} — 올인원 투자 터미널`
2. `#app-version-badge` — HTML 내 인라인 텍스트
3. `version.json` → `version` 필드
4. `_context/CLAUDE.md` → `현재 버전:` 행
5. `CHANGELOG.md` → 최상단 항목의 버전 번호
6. **`const APP_VERSION`** — JS 상수 (`js/aio-core.js`). 이 값이 title과 badge를 JS에서 덮어씀. 놓치면 HTML은 v38.4인데 화면에 v38.3 표시
7. **`SW_VERSION`** — Service Worker 캐시 네임스페이스 (`sw.js`). 놓치면 새 배포 후에도 구버전 shell/data cache가 남을 수 있음.
8. **JS cachebusters** — `index.html`의 `./js/aio-*.js?v=` 값은 `version.json.version`의 숫자 부분과 반드시 일치해야 한다. CI는 5개 cachebuster를 모두 검사한다.

> ⚠️ **v48.80 사고**: SW_VERSION이 v48.66에 머물러 stale cache 회전이 지연될 수 있었음. APP_VERSION과 SW_VERSION은 함께 동기화할 것.

확인 명령:
```bash
grep '<title>' index.html | head -1
grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
grep 'APP_VERSION' js/aio-core.js | head -1
grep 'SW_VERSION' sw.js | head -1
cat version.json | grep version
grep '현재 버전' _context/CLAUDE.md
head -20 CHANGELOG.md | grep '## v'
grep -o '\?v=[0-9.]*' index.html | sort -u
```

### R1-A. GitHub 배포 후 브라우저 버전 확인 (필수)
코드를 GitHub에 업로드한 뒤, **반드시 라이브 사이트에서 브라우저 캐시 무시 새로고침** 후 확인:
1. 브라우저 탭 제목(`<title>`)에 올바른 버전이 표시되는가
2. 페이지 상단 `#app-version-badge`에 올바른 버전이 표시되는가
3. `version.json` 직접 접속(`/version.json`)으로 올바른 버전이 반환되는가

> **파일 버전 ≠ 브라우저 버전** 불일치의 흔한 원인:
> - GitHub Pages 캐시 (배포 후 1~5분 지연)
> - 브라우저 캐시 (Ctrl+Shift+R 또는 DevTools > Network > Disable cache)
> - 업로드 누락 (index.html만 올리고 version.json 미업로드, 또는 그 반대)
> - JS에서 `updateQuotaBadge()` 등이 badge 텍스트를 런타임에 덮어쓰는 경우

### R2. 버전 체계
- 현재 체계는 `v{major}.{patch}` 숫자 단조 증가: v48.77 → v48.78 → v48.79
- patch는 한 자리/두 자리 모두 허용한다. 숫자 비교로만 최신 여부를 판단하고, 문자열 사전순 비교는 금지한다.

### R3. 버그 수정 시 사후 분석 필수
모든 버그 수정 후 `BUG-POSTMORTEM.md`에 아래 형식으로 추가:
```
## [날짜] v{버전} — {버그 제목}
- **증상**: 사용자가 본 문제
- **근본 원인**: 왜 발생했나
- **놓친 이유**: 왜 기존 점검에서 못 잡았나
- **수정 내용**: 무엇을 바꿨나
- **예방 규칙**: 다음에 같은 유형 방지하려면
- **QA 체크리스트 추가 항목**: (있으면)
```

### R4. 동적 DOM 삽입 주의
### R5. CSS overflow 3중 방어
### R6. LLM 응답 렌더링 안전장치
### R7. 한국어 텍스트 레이아웃 검증 (v31.9 추가)
### R8. 차트 카드 텍스트 폴백 필수 (v31.9 추가)
### R10. 종목코드 입력 시 3중 검증 필수 (v35.6 추가)
신규 종목 추가 시 반드시 아래 3단계 모두 통과해야 DB에 코드 입력 가능:
1. **Yahoo Finance quote 페이지에서 공식 회사명 확인** — DB 등록명과 일치해야 함 (269620="Syswork" ≠ "레인보우로보틱스" 사례)
2. **가격/시총 범위 합리성 확인** — 해당 기업 규모와 가격대가 맞는지 (코스맥스 ODM 1위인데 9,520원 소형주 → 자회사 오매핑)
3. **비상장 여부 확인** — 네이버증권/KRX에서 "비상장"/"장외" 표기 시 코드 할당 금지 (두나무=비상장 사례)

### R11. 비상장 기업 코드 할당 금지 (v35.6 추가)
Yahoo Finance가 가격을 반환해도 해당 기업이 실제 상장사인지 확인해야 함. 비상장 기업의 이름을 상장 코드에 매핑하면 **전혀 다른 회사의 데이터**가 해당 이름으로 표시됨 (P18 Ghost Stock).

### R12. 유사 이름 모자회사 구분 (v35.6 추가)
검색 시 동일/유사 이름이 복수 나오면(예: 코스맥스/코스맥스BTI), 각각의 정식 종목명·코드·시총·사업내용을 대조하여 본사/자회사 구분 후 올바른 코드 선택 (P19 Parent-Sub Confusion).

### R13. CHAT_CONTEXTS 이원화 필수 (v37.5 추가)
### R14. 뉴스 키워드 현행화 (v37.6 추가)
### R9. Dead Page 방지 — 페이지 3종 세트 + init 가드 리셋 필수 (v31.10 추가, v42.1 강화)
- 새 페이지(`page-xxx`) 추가 시 반드시 **3종 세트** 구현:
  1. **init 함수** (`initXxxPage()`) — 데이터 로드 + DOM 업데이트
  2. **`aio:pageShown` 리스너** — 페이지 진입 시 init 호출
  3. **`aio:liveQuotes` 리스너** — 실시간 데이터 갱신 시 활성 페이지면 업데이트
- HTML만 있고 JS init이 없으면 하드코딩 데이터가 영구적으로 표시되는 Dead Page가 됨
- 정적 페이지(guide)는 예외이나, 동적 데이터가 하나라도 있으면 반드시 적용
- **[3회 위반 강화]** init 가드(`if (xxxInitialized) return;`) 사용 시 `destroyPageCharts()`에 반드시 `xxxInitialized = false` 리셋 추가. 누락 시 페이지 재진입 불가 (P28)
- **[3회 위반 강화]** `setInterval` 추가 시 반드시 `destroyPageCharts()`에 대응 `clearInterval` 추가 (P27). 타이머 미해제 = 좀비 프로세스
- **[v48.69 4차 강화]** 전역 연속 타이머(모듈 최상위 레벨)도 반드시 ID를 전역 변수에 저장할 것:
  ```javascript
  // 금지
  setInterval(fn, 15*60*1000);
  // 올바른 패턴
  if (window._myTimer) clearInterval(window._myTimer);
  window._myTimer = setInterval(fn, 15*60*1000);
  ```
- 검증: `grep -n 'setInterval(' js/*.js | grep -v 'clearInterval\|_.*=\s*setInterval\|window\._.*=\s*setInterval'` → 0건 기대

### R15. 데이터 미수신 vs 진짜 0% 구분 필수 (v38.3 추가, P25, v42.1 강화)
- `d.pct || 0` 패턴은 **데이터 없음**과 **진짜 0% 변동**을 구분할 수 없으므로 금지
- 반드시 `d && d.price != null && d.pct != null` 명시적 null 체크 후, 미수신 시 "—" 표시
- **[3회 위반 강화]** 코드 수정 후 `grep '|| 0' index.html | grep -i 'pct\|change\|percent'` 실행하여 잔존 패턴 스캔 필수
- **[3회 위반 강화]** `|| 숫자` 폴백은 0이 유효값인 모든 필드(pct, change, breadth %)에서 사용 금지. `!= null ? val : fallback` 패턴 사용
- 새 UI 섹션(카드, 그리드, 테이블) 추가 시 반드시 점검:
  1. 클릭/인터랙션 핸들러 구현 여부
  2. `aio:liveQuotes` 자동 갱신 연결 여부
  3. 상세 패널(detail panel)이 열려있을 때 자동 갱신 포함 여부

### R16. 뉴스 티커 표시 규칙 (v39.0 추가, P30)
- 매크로/지정학/정책/금리/무역 토픽(`macro`,`geopolitics`,`policy`,`fed`,`rates`,`trade`) 뉴스에는 **티커 숨김**
- 기업/실적/섹터/일반 토픽 뉴스에만 관련 종목 티커 표시
- `isCompanyNews()`를 티커 표시 판단에 쓰지 말 것 (토픽 분류가 부정확할 수 있음 — general로 분류된 매크로 뉴스에 ETF 티커 붙는 문제)
- 홈 핵심뉴스, 시장 뉴스(renderFeed), 데일리 브리핑(renderBriefingFeed) 3곳 모두 동일 기준 적용

### R17. 뉴스 키워드 추가 시 길이 제한 (v39.0 추가, P28, v42.1 강화, v42.5 재정의)
- **영어 키워드**: 3글자 미만 단독 키워드 추가 금지 (오탐 원인 — `'S'` 한 글자로 모든 텍스트 매칭 사고 발생)
- **한국어 키워드**: 2글자 도메인 특화 용어(`'금리'`, `'물가'`, `'고용'` 등)는 허용 — 한국어 금융 도메인에서 오탐 위험보다 누락 위험이 큼. 단, **1글자 한국어 단독 키워드는 금지** (예: `'팹'`)
- 티커 매칭은 `extractTickers()`에서 word boundary(`\b`)로 처리해야 함
- 키워드 추가 후 반드시 비금융 텍스트("약물 운전 STOP" 등)로 오탐 테스트
- **[4회 위반 강화]** 약어(QE, AI, EV 등)는 full form이 이미 존재하면 추가 금지. 약어가 반드시 필요한 경우 복합 패턴으로 구체화
- **[v42.5 교훈]** 키워드 제거는 누락 위험이 큼 — 선별 로직 강화가 우선, 키워드 제거는 최후 수단

### R18. 텔레그램 채널 관리 (v39.0 추가, P29)
### R19. _context/ 지식 정합성 린팅 (v40.4 추가)
### R20. 에이전트 산출물 검증 상태 관리 (v40.4 추가)
### R21. 하드코딩 차트 데이터 경과일 관리 (v40.4 추가, P31)
- 차트 데이터(VIX/NAAIM/AAII/브레드쓰 등)는 `DATA_SNAPSHOT._updated`와 함께 관리
- 3일+ 경과 시 `renderStaleWarning()` 경고 배지 자동 표시
- 동적 전환 가능한 데이터(VIX/HYG/SPY/QQQ)는 Yahoo Finance API로 자동 교체, 하드코딩은 폴백으로만

### R22. 뉴스 3곳 계층적 선별 체계 (v40.4 추가, P32)
- **홈 핵심**: 정적 큐레이션 (`HOME_WEEKLY_NEWS`), 시장 전체 핵심 2~3건
- **브리핑**: score 45+, 5~20건, 20건 초과 시 score 우선 선별 → 시간순 재정렬
- **시장 뉴스**: score 30+, 150건 상한, 48h, 시간순 (광범위)
- scoreItem()에 5대 토픽 부스트(매크로/지정학/주식/외환/채권) + 비시장 정치 감점(-25) 필수

### R23. 외국 기업(ADR) 재무 파싱 (v40.4 추가, P33)
### R24. _context/ 인덱스 자동 관리 (v41.6 추가)
- `_context/INDEX.md`는 지식 베이스 전체 문서의 역할, 상태, 연결 관계를 기록하는 자동 인덱스
- `/knowledge-lint` 실행 시 L6 단계에서 자동 갱신 (신규 파일 추가, 삭제된 파일 제거, 갱신일/신뢰도 동기화)
- 현재 버전 대비 10+ 버전 차이 문서는 "정리 대상 후보"로 자동 식별

### R25. 버그 역참조 체계 (v41.6 추가)
- BUG-POSTMORTEM.md 각 버그 항목에 `violated_rule: R{N}` 태그 필수 기록
- 신규 규칙 위반이면 `violated_rule: 신규 ({카테고리})` 형식
- `/knowledge-lint` L7 단계에서 규칙별 위반 빈도 자동 집계 -- 3회 이상 위반 시 "규칙 강화 필요" 플래그
- 태그 누락 항목도 린팅에서 경고 보고

### R26. 기술 인사이트 환류 (v41.6 추가)
- 대화/작업 중 발견한 기술적 인사이트(API 동작, 브라우저 quirks, 라이브러리 패턴)는 `_context/KNOWLEDGE-BASE.md`에 축적
- BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, KNOWLEDGE-BASE는 "어떻게 동작하는가"를 기록
- 동일 인사이트 3회 이상 재발견 시 RULES.md 규칙 승격 검토
- 카테고리: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

### R27. Commands ↔ Skills 동기화 (v46.2 추가, P69 교훈)
- 새 스킬(`skills/xxx/SKILL.md`) 추가 시 **반드시** `commands/xxx.md` wrapper도 동시 생성
- wrapper 없으면 `/xxx` 자동완성에 안 나옴 → 사용자가 스킬 존재 자체를 모름 (silent omission)
- CHAT_CONTEXTS에 새 페이지 컨텍스트 추가 시 **반드시** `_aiCtxMap` + `_aiDefaultChips`에도 동시 매핑
- 매핑 없으면 통합 AI 패널에서 해당 페이지 진입 시 컨텍스트 자동 전환 안 됨 → silent failure
- 검증: `ls .claude/commands/*.md | wc -l` == skills 폴더 수 + 인라인 commands 수

### R28. 실제 클릭 테스트 필수 (v46.5 추가, P82 교훈)
### R29. AI 채팅 데이터 검증 태그 (v46.5 추가)
### R30. 지표 라벨/임계값 전역 통일 (v46.8 추가, P83~P104 교훈)
### R31. innerHTML XSS 전수 점검 (v46.8 추가, P100 교훈)
### R33. 데이터 Freshness 추적 의무화 — DATE_ENGINE + _markFetch + _aioFeedHealth (v48.39 추가, P133 교훈)
### R52. 외부 CDN 스크립트 SRI 의무 (v48.69 추가, P140 교훈, 구 R34 → R52 재번호)
### R53. 독립 병렬 fetch는 단일 실패 격리 (v48.69 추가, P143 교훈, 구 R35 → R53 재번호)
### R32. Event Delegation 의무화 — onclick 인라인 핸들러 금지 (v48.35 추가, P132 교훈)
## 🟡 점검 시 주의사항 (과거 실수에서 배운 것)

### CSS/레이아웃 패턴
1. **grid 내부에 동적 요소 삽입** → 레이아웃 파괴 (v31.2 시그널 배너 사건)
2. **overflow:hidden on parent** → 자식 콘텐츠 잘림 (v31.1 채팅 가로 텍스트)
3. **max-height 컨테이너** → 하단 여백 없으면 콘텐츠가 입력창에 가려짐
4. **white-space:nowrap 전파** → 부모의 nowrap이 자식까지 영향

### JS/데이터 패턴
5. **_ldSafe 미사용** → null/undefined에서 .toFixed() 등 호출 시 크래시
5b. **getElementById → stale DOM 참조** → HTML에 없는 ID를 JS에서 참조하면 항상 null → 기능 무동작 (P43). DOM ID 참조 추가 시 `grep 'id="해당ID"' index.html` 필수
6. **async 에러 미처리** → try-catch 누락 시 무한 로딩 상태
7. **타이머 중복** → setInterval 중복 등록 시 메모리 누수 + 성능 저하
8. **popstate 핸들러 누락** → 뒤로가기 시 차트/데이터 미갱신

### LLM/AI 패턴
9. **시스템 프롬프트 규칙 무시** → Claude가 테이블 생성 → 렌더링 깨짐
10. **스트리밍 중 DOM 조작** → innerHTML 반복 교체 시 깜빡임/메모리 누수

### 레이아웃/텍스트 패턴 (v31.9 추가)
11. **고정폭 grid 컬럼 + 한국어 텍스트** → 라틴 기준 설계된 셀에서 한국어 텍스트 오버플로우 (P7)
12. **CDN 지연 시 차트 미렌더링** → 텍스트 폴백 없으면 빈 카드 표시 (P8)
13. **반응형 미대응** → 768px/480px에서 grid 컬럼 축소 없으면 텍스트 겹침/잘림
14. **Dead Page** → HTML만 있고 init 함수/이벤트 리스너 없음 → 하드코딩 데이터 영구 표시 (P9)

### 기술 분석 엔진 패턴 (v32 추가)
15. **analyzeTickerDeep/analyzeKrTickerDeep DOM target** → 결과를 렌더할 target element ID가 실제 HTML div ID와 일치해야 함 (US: `#ticker-analysis-result`, KR: `#kr-ticker-analysis-result`)
16. **CF Worker 프록시 의존** → Yahoo Finance 차트 데이터는 CF Worker(aio-yahoo-proxy)를 통해 fetch. rate limit(기본 100 req/min) 초과 시 429 에러. 동시 분석 요청 수 제한 필요.
17. **지수 분석 자동 트리거** → `initKoreaTechnical()`은 pageShown 시 KOSPI/KOSDAQ 동시 fetch → 2개 동시 API 호출. 이미 분석 결과가 있으면 재호출 방지 (innerHTML 체크).

### 종목 데이터 무결성 패턴 (v35.6 추가)
18. **Phantom Ticker (P17)** → 종목코드 미검증 입력 시 Yahoo Finance가 **다른 회사의 정상 가격**을 반환 → 에러 없이 잘못된 데이터 유입 (269620 사례)
19. **Ghost Stock (P18)** → 비상장 기업 이름을 상장 코드에 매핑 → 전혀 다른 회사의 데이터가 해당 이름으로 표시 (294870 두나무 사례)
20. **Parent-Sub Confusion (P19)** → 유사 이름 모자회사 혼동 → 자회사 코드에 본사 이름 매핑 (044820 코스맥스BTI 사례)

---

## 📌 QA 요청 시 워크플로우

```
1. RULES.md 읽기
2. BUG-POSTMORTEM.md 읽기 (기존 패턴 파악)
3. QA-CHECKLIST.md 기반으로 점검 수행
4. 발견된 문제 수정
5. 수정한 문제마다 BUG-POSTMORTEM.md에 사후 분석 추가
6. 필요 시 QA-CHECKLIST.md에 새 항목 추가
7. 버전 동기화 확인 (R1)
```

---

## 세션 2026-04-04 신규 규칙 (P31~P38)

### P31. 데이터-UI 단일 진실 원천 (Single Source of Truth)
데이터(JS)와 UI(HTML)가 2곳에서 관리되면 반드시 한쪽을 제거. JS에서 동적 생성하여 불일치 근본 방지.

### P32. 종목 추가 시 상장 여부 확인 필수
KOSPI(.KS) / KOSDAQ(.KQ) 상장 확인. 비상장·장외 주식 추가 금지. 두나무(업비트) 같은 비상장 실수 반복 방지.

### P33. 테마 간 동일 종목 중복 배치 금지
자회사는 모회사 테마에서 커버. 예: 보스턴다이내믹스(현대차 자회사) → auto에서 커버, robot에 현대차 별도 배치 금지.

### P34. 테마 종목 비중 체계적 설정
(1) 시총 비례 (2) 독과점 구조 반영 (3) 대장주 비중 상향 (4) ETF 구성 크로스체크. 임의 감 배분 금지.

### P35. 데모/모의 데이터 라벨링 또는 제거
정적 모의 데이터는 `[DEMO]` 라벨 필수. 실제 데이터 연결 완료 시 즉시 제거. 사용자 오인 방지.

### P36. UI 텍스트 핵심/상세 분리
접힌 상태에서 핵심 한 줄 완전히 읽혀야 함. 상세 설명은 토글/AI 채팅으로 분리.

### P37. 인라인 font-size 11px 미만 사용 금지
CSS override가 자동 보정(7-8→11px)하지만, 신규 코드에서 극소 글자 사용 자체를 금지.

### P38. 전역 기능은 글로벌 컴포넌트로
AI 채팅, 알림 등 전역적 기능은 페이지별 복제가 아닌 글로벌 컴포넌트(사이드바 등)로 구현.

### P56. init 함수 내 cleanup 루프 중복 금지
차트/DOM 생성 후 즉시 destroy하는 "생성 → destroy" 패턴은 코드 리뷰에서 반드시 검출. 하나의 init 함수에 cleanup 루프가 두 개 이상 존재하면 두 번째 루프가 방금 만든 객체를 날릴 위험.

### P57. 고정 repeat(N,1fr) 그리드 모바일 검증 필수
`repeat(N,1fr)` (N≥5)은 모바일 375px에서 N×최소셀너비 > 컨테이너 width 여부 확인 필수. 6열 이상 그리드는 `repeat(auto-fit,minmax(Xpx,1fr))`으로 교체 검토.

### P58. applyDataSnapshot map과 HTML data-snap 속성 동기화 필수
`applyDataSnapshot()` map에 키를 추가/제거할 때 반드시 HTML `data-snap="key"` 속성 존재 여부를 grep으로 확인. 키가 있는데 HTML 없으면 dead code, HTML에 있는데 map에 없으면 hardcoded 고정값 버그.

### P59. _lastFG 초기값은 DATA_SNAPSHOT.fg에서 가져올 것
`fetchFearGreed()` 비동기 응답 전에 `_lastFG`가 필요한 컨텍스트(AI 채팅 스냅, 트레이딩 스코어 등)에서 기본값 18로 폴백되는 문제. `applyDataSnapshot()` 직후 `window._lastFG = DATA_SNAPSHOT.fg || 18`로 초기화할 것.

### P60. signal 페이지 브레드쓰 바는 liveQuotes + pageShown 양쪽에서 갱신
`updateBreadthBars()`가 breadth 페이지 init에서만 호출되면 signal 페이지 브레드쓰 섹션은 breadth 페이지를 방문하기 전까지 하드코딩 고정값. signal 페이지의 `aio:liveQuotes` 리스너에서도 `updateBreadthBars()` 호출 필수.

---

## 🟡 재발 방지 규칙 (v48.54 신설 — 레이어/파이프라인/함수 단위)

### R34. CSS 색상 토큰 우선 — rgba 하드코딩 금지 (v48.54 추가)
**원칙**: 투명 화이트 오버레이 `rgba(255,255,255,0.0X)` 패턴은 CSS 변수(`--surface-1~5`)로만 사용.

**금지 패턴**:
```html
<!-- BAD -->
<div style="background:rgba(255,255,255,0.02)">
```

**권장 패턴**:
```html
<!-- GOOD -->
<div style="background:var(--surface-1)">
```

**표준 매핑** (v48.48 정의):
| 값 | 변수 |
|-----|------|
| `rgba(255,255,255,0.02)` | `var(--surface-1)` |
| `rgba(255,255,255,0.03)` | `var(--surface-2)` |
| `rgba(255,255,255,0.04)` | `var(--surface-3)` |
| `rgba(255,255,255,0.05)` | `var(--surface-4)` |
| `rgba(255,255,255,0.08)` | `var(--surface-5)` |

**⚠ Canvas ctx 예외**: HTML5 Canvas의 `ctx.strokeStyle` / `ctx.fillStyle` / `ctx.font`는 CSS var를 **해석 못함**. Canvas 렌더러 내부에서는 직접 hex/rgba 값 사용:
```js
// BAD
ctx.strokeStyle = 'var(--surface-5)';  // 작동 안 함
// GOOD
ctx.strokeStyle = 'rgba(255,255,255,0.08)';  // 또는 '#8888884A'
```

> SVG `fill="var(...)"` 및 HTML `style="..."` 속성은 OK (CSS 해석).

### R35. 신규 페이지 → CHAT_CONTEXTS 동시 생성 (v48.54 추가, P106 교훈)
### R36. Themes 페이지 종목 추가 → LIVE_SYMBOLS 동시 등록 (v48.54 추가)
### R37. data-snap 신규 추가 → 자동 렌더러 참여 (v48.54 추가, P108 교훈)
### R38. `on*` 인라인 이벤트 핸들러 금지 — 전체 확장 (R32 확장, v48.54 추가)
### R39. extractTickers → UI 노출 경로 필수 페어링 (v48.55 추가, P116/P121/P122/P125 교훈)
### R40. CHAT_CONTEXTS system() = persona + 메서드론만 (v48.55 추가)
### R41. 기업 분석 맥락 ctx 전원 FMP 심층 활성 (v48.55 추가)
### R42. Agent 결과 실측 교차검증 의무 (v48.59 추가, Agent 오판 5회 누적)
### R43. Canvas context는 CSS var 미해석 (R34 예외, v48.59 추가)
### R44. setTimeout 무한 재귀 종료 카운터 필수 (v48.59 추가, renderAllEtfGrid 교훈)
### R45. 페이지 전환 active 설정은 `dataset.arg` 기반 (v48.59 추가, v48.32 onclick 0건 후 잔존 버그)
### R46. HTML 외 JS 파일까지 sed 치환 범위 확대 (v48.61 추가)
### R47. CSS 변수 자기순환 참조 금지 (v48.61 추가, surface-1~5 교훈)
### R49. 새 페이지 추가 시 결론 바 의무 (v48.62 추가)
### R50. fb-estimated 배지 사용 기준 (v48.62 추가)
### R51. 콘텐츠 카드 본문 폰트 최소 12px (v48.62 추가)
### R48. Canvas 렌더러 전역 변수 참조 시 실제 설정 위치 확인 (v48.61 추가, _pcRatio vs _putCallRatio 교훈)
## 🔧 Hook 자동화 (v48.61 대폭 확장 — Layer 2~9 실제 구현)

### validate-edit.sh Hook 9 Layer
1. **Layer 1**: div 균형 (기존 v31+)
2. **Layer 2**: `rgba(255,255,255,0.0[2-8])` 신규 추가 경고 — R34 위반 감지
3. **Layer 3**: `on(mouseover|mouseout|blur|focus|click|change|input|keydown|keyup|submit)=` 신규 추가 경고 — R38 위반
4. **Layer 4**: `ctx\.(stroke|fill)Style\s*=\s*['"]var\(--` 감지 — R43 Canvas 에러
5. **Layer 5**: CHAT_CONTEXTS system 함수 내 `SUB_THEMES|themeMap\.(slice|map|forEach)` 6회+ 경고 — R40
6. **Layer 6**: `extractTickers`/`getDisplayTickers` 호출 횟수 vs `tickerStr`/`tickerTag`/`mentionedTickers` 사용 불일치 경고 — R39 (P125 탐지)
7. **Layer 7**: `setTimeout\([^,]+,\s*\d+\)` 재귀 3회+ vs `_xxxRetries > N` 가드 부재 경고 — R44
8. **Layer 8**: `getAttribute\(['"]onclick['"]\)` 신규 추가 경고 — R45 위반
9. **Layer 9**: TODO/FIXME/XXX 10건+ 증가 시 기술부채 경고 — R42 원칙

## R54. `data-aio-archive` 마킹 원칙 (v49.21 추가)
## R55. 동일 지표 multi-sink 단일화 (v49.24 추가, P216/P218 근본)
## R56. 임계값·라벨 단일 출처 — THRESHOLD_REGISTRY (v49.24 추가, P219 근본)
## R57. 정적 테이블 stale 감지 의무 (v49.24 추가, P217 근본)
## R58. DOM 인라인 vs DATA_SNAPSHOT 3-way 정합 (v49.24 추가, P213 근본)
## R59. 점수 스케일 단일 정의 — SCORE_SCALES (v49.25 추가, L1 근본)
## R60. 매매 전략 권장값 단일 출처 — ATR_PRESETS (v49.25 추가, L4 근본)
## R61. 다중 신호 합의 알고리즘 — diagnoseBreadthConsensus (v49.25 추가, L3 근본)
## R62. 정량 지표 자동 채점 — PIOTROSKI_CHECKLIST (v49.25 추가, L7 근본)
## R63. 라벨 인라인 사용 자동 audit — getThresholdLabelAudit (v49.25 추가, R56 자동화)
## R64. 점수 가중치 단일 정의 — WEIGHT_REGISTRY (v49.26 추가, I2 근본)
## R65. 시각 위계 단일 정의 — CARD_HIERARCHY (v49.26 추가, I3 근본)
## R66. 중복 콘텐츠 자동 감사 — getDuplicateContentAudit (v49.26 추가, I4 근본)
## R67. 동적 판정 함수 단일화 — getCycleFromMacro (v49.26 추가, I7 근본)
## R68. 페이지 placeholder 표준 — 동적 검색 가이드 (v49.26 추가, I5/I6 근본)
## R69. Action Item 단일 출처 — ACTION_RULES (v49.27 추가, E1/E2 근본)
## R70. 페이지 목적 단일 정의 — PAGE_PURPOSE_REGISTRY (v49.27 추가, E3/E4 근본)
## R71. 이론 vs 실행 비율 audit — getPagePurposeRatioAudit (v49.27 추가, E5 근본)
## R72. 시나리오 확률 시간 의존 — SCENARIO_REGISTRY (v49.27 추가, L6 근본)
## R73. 인프라 추가 시 페이지 적용 동반 의무 (v49.28 추가, P239 메타 근본)

**원칙**: 신규 `*_REGISTRY` 객체나 `AIO.get*Audit()`/`AIO.applyXxxToElement()` 함수를 추가할 때 **반드시 같은 버전에서 해당 인프라를 실제 페이지에 적용**해야 한다. 인프라 등록 PR과 페이지 적용 PR을 분리하면 인프라가 "사용 가능"하지만 "사용 안 됨" 상태로 영구 잔존.

**근거 (P239)**: v49.24~v49.27이 18개 근본 인프라(THRESHOLD/SCORE_SCALES/ATR/PIOTROSKI/WEIGHT/CARD_HIERARCHY/applyLabel/getCycle/ACTION/PAGE_PURPOSE/SCENARIO 등)를 추가했으나 실제 페이지 DOM에 적용 안 함. 사용자가 보는 화면은 그대로 stale. v49.28에서 시정.

**적용 체크리스트**:
1. 인프라 객체/함수 등록 (`aio-core.js`)
2. 최소 1개 페이지에 적용 (DOM 마커 + JS 호출)
3. `_aioPageBus.register()` 또는 `applyDataSnapshot` 통합 (페이지 진입 시 자동 호출)
4. 회귀 테스트 추가 — 페이지에 인프라 호출 결과 표시 확인 (단순 인프라 함수 존재 여부 X, 실제 DOM 결과 검증)

**위반 시**: 새 인프라가 "코드는 있는데 화면에 없음" 패턴으로 누적 → 디버깅 어려움, 사용자 신뢰 훼손
**자동 감사**: `AIO.getThresholdLabelAudit()` + `AIO.getSnapshotConsistencyAudit()` 호출 결과 + getDuplicateContentAudit를 정기 점검하여 적용률 추적

---

## R74. DOM 인라인 폴백 vs DATA_SNAPSHOT 동시 갱신 의무 (v49.30 추가, P252/M1 근본)
## R75. 정적 콘텐츠 lifecycle 메타 필수 (v49.30 추가, P253/M2 근본)
## R76. 정치/관료 이름 NAMED_ENTITY_REGISTRY 경유 의무 (v49.30 추가, P254/M3 근본)
## R77. 거시지표 MACRO_CALENDAR 등록 + 자동 stale (v49.30 추가, P254/M4 근본)
## R78. KR 거시 KR_MACRO_RELEASE 등록 + 발표 캘린더 의무 (v49.30 추가, P255/M5 근본)
## R79. 지정학 시나리오 단일 출처 — GEOPOLITICAL_CONTEXT_REGISTRY (v49.31 추가, H3 근본)
## R80. 정적 데이터베이스 메타 의무 — SCREENER_DB_META (v49.31 추가, H1 근본)
## R81. 정기 발표 데이터 사용자 가시 마커 (v49.31 추가, H4 근본)
## R82. AI 채팅 가격 fetch 실패 시 Hard Guard 의무 (v49.32 추가, P263 근본)
## R83. 채팅 응답 post-hoc 가격 검증 의무 (v49.32 추가, P264 근본)
## R84. System 프롬프트 정량 수치 화이트리스트 (v49.32 추가, P262 근본)
## R85. 종목명-티커 단일 출처 — TICKER_NAME_REGISTRY (v49.32 추가, P266 근본)
## R86. 환각 패턴 자동 탐지 + 의심 점수 (v49.32 추가, P264 보강)
## R87. 종목별 데이터 무결성 통합 검증 (v49.32 확장, 사용자 추가 요청)
## R88. Fundamental 15 분석 기준 데이터 출처 매핑 (v49.32 확장)
## R89. AI 채팅 응답 자동 검증 통합 의무 (v49.33 추가, P269 근본)
## R90. 종목 정성 분석 출처 의무 — ANALYSIS_FRAMEWORK_REGISTRY (v49.34 추가, 사용자 지적)
## R91. 페이지 표시 분석 기준 registry 등록 + 가용성 가시화 의무 (v49.35 추가, P275 근본)
## R92. 페이지 표시 분석 기준 100% 커버 의무 (v49.36 추가, P278 근본)
## R93. 페이지 sequential audit 의무 (v49.37 추가, P282 메타 근본)
## R94. 페이지 인라인 임계값 표 REGISTRY 정합 의무 (v49.38 추가, P286 근본)
## R95. 페이지 간 동일 ticker 정합 의무 (v49.39 추가, P290 근본)
## R96. data-action 핸들러 등록 검증 (v49.39 추가, P291 근본)
## R98. JS 함수 내 var X + const/let X 충돌 자동 탐지 (v49.44 추가, P311 근본)
## R134. AI 채팅 데이터 다운로드 + 금액/% 시뮬레이션 의무 (v49.70 추가, P373~P374 근본)
## R133. AI 채팅 알람/임계값 트리거 의무 (v49.70 추가, P372 근본)
## R132. AI 채팅 사용자 투자 프로필 메모리 의무 (v49.70 추가, P371 근본)
## R131. AI 채팅 거시 시나리오 동적 시뮬레이션 + 약어/별명 fuzzy 매칭 의무 (v49.69 추가, P368~P369 근본)
## R130. AI 채팅 자동 페이지 이동 + 포트폴리오 동적 시뮬레이션 의무 (v49.69 추가, P366~P367 근본)
## R129. AI 채팅 후속 질문 자동 제안 의무 (v49.69 추가, P365 근본)
## R128. AI 채팅 시각 단서 표준 + 데이터 소스 우선순위 + 출처 타임스탬프 (v49.68 추가, P361~P363 근본)
## R127. AI 채팅 Bull/Base/Bear 3 시나리오 분기 강제 (v49.68 추가, P361 근본)
## R126. AI 채팅 기관급 분석 프레임워크 8개 인용 의무 (v49.68 추가, P360 근본)
## R123. 사이드바 Audit row 의미 분리 표시 의무 (v49.67 추가, P357 근본)
## R122. AI 채팅 사용자 체감 품질 의무 (v49.67 추가, P352~P356 근본)
## R121. AI 채팅 시스템 정의-호출 정합 의무 (v49.66 추가, P348~P351 근본)
## R119. 3대 본질 정렬 감사 의무 (v49.65 추가, P346 근본)
## R120. 초보자 초기 상태 문구는 보이는 DOM 기준으로만 감사 (v49.65 추가, P347 근본)
## R118. REGISTRY coveragePct와 실등록 카운트 분리 감사 의무 (v49.65 추가, P339 근본)
## R117. dataConfidence:low 분야 환각 차단 알림 의무 (v49.65 추가, P340 근본)
## R116. 새 분석 관점 추가 시 4축 동시 갱신 의무 (v49.65 추가, P340 근본)
## R115. 사용자 가시 placeholder 텍스트 표준 의무 (v49.64 추가, P334 근본)
## R114. 외부 워크트리 통합 시 함수 존재 vs 페이지 실행 검증 분리 의무 (v49.63 추가, P331 근본)
## R112. 모든 CHAT_CONTEXTS는 _getChatRules() 호출 의무 (v49.59 추가, P327 근본)
## R110. signal/breadth/sentiment context는 라이브 수치 자동 주입 의무 (v49.59 추가, P324 근본)
## R109. fxbond 한국 금리 스냅샷 시점 명시 의무 (v49.59 추가, P326 근본)
## R108. Audit 함수 추가 시 사이드바 위젯에도 노출 의무 (v49.58 추가, P322 근본)
## R107. 채팅 fetch는 반드시 Promise.allSettled + 개별 timeout 의무 (v49.58 추가, P321 근본)
## R106. 새 페이지 CHAT_CONTEXTS 신규 시 window._currentXxxId 자동 주입 의무 (v49.58 추가, P319 근본)
## R105. 테마 페이지 진입 시 채팅 컨텍스트에 활성 테마 ticker 라이브 가격 주입 의무 (v49.57 추가, P316/P317 근본)
## R104. _fetchTickerDataForChat 신규 fetch 추가 시 ABSOLUTE RULES 동기 확장 의무 (v49.57 추가, P317 근본)
## R103. SCR_KEYWORD_ALIASES 신규 테마 추가 시 AIO_TICKER_NAME_REGISTRY 등록 의무 (v49.57 추가, P316 근본)
## R102. 페이지 cell-level audit 의무 (v49.48 추가, P318 근본)
## R101. DOM ticker vs LIVE_SYMBOLS coverage 의무 (v49.48 추가, P317 근본)
## R75 보강 (v49.48, P316 근본 — Jensen hardcoded → 일반화)

**기존 R75 (v49.30)**: 정적 콘텐츠 lifecycle 메타 부착 의무 (`createdAt` + `archiveAfterDays` + `replaceAfterDays`).

**v49.48 보강**: lifecycle 콘텐츠는 페이지에 `data-lifecycle-id="ID"` 마커 부착 + `[id$="-stale-days"]` 또는 `.lifecycle-stale-days` span 신설. `_aioStaticContentLifecycleHook()`이 모든 페이지 진입 시 자동 갱신.

**근거 (P316)**: v49.42 P304 시정 후 Jensen 인터뷰 `#jensen-interview-stale-days` span을 채우는 hook이 페이지 진입 시 호출되지 않아 v49.47 P314까지 영구 "경과 계산중" 표시. v49.47에서 Jensen 전용 hardcoded hook 추가했으나 `briefing-week-may-4-10` / `kr-export-2026-02` 같은 다른 LIFECYCLE 항목은 여전히 갱신 안 됨.

**시정**: v49.48 P316 — `_aioStaticContentLifecycleHook()` 일반화 + `_aioPageBus 'aio:pageShown'` 모든 페이지 자동 호출.

**위반 시**: STATIC_CONTENT_LIFECYCLE 등록 콘텐츠가 페이지에 표시되지만 동적 갱신 안 됨 (영구 stale label).

---

## R100. API 키 저장 2중화 + 백업/복원 UX 의무 (v49.45 추가, P312 근본)
## R99. SW SHELL_ASSETS 자산 무결성 자동 검증 (v49.44 추가, P310 근본)
## R97. data-snap 키 vs DATA_SNAPSHOT 시드 정합 (v49.41 추가, P301 근본)
## R125. Second/third-pass text, function, and data meaning audit required (v49.67 added, P359 root prevention)
## R124. DOM-first full surface audit required (v49.67 added, P358 root prevention)
## R167. innerHTML 삽입 시 모든 사용자/외부 변수에 escHtml() 의무 + 정규식 메타문자 이스케이프 (v49.81 added, P433~P435 root prevention)
## R168. vendor-prefix CSS 속성은 표준 속성과 동시 선언 + inline hover: 금지 (v49.81 added, P436~P437 root prevention)
## R169. 동일 함수 내 var/const/let 이름 충돌 금지 + 신규 코드 let/const 우선 (v49.81 added, P438 root prevention, P311 패턴 재발 방지)
## R170. 외부 작업본 통합 시 KR/외국 ticker 매핑 다중 위치 cross-check 의무 (v49.82 added, P439~P441 root prevention)
## R172~R178. v49.83 — 기관급 + 직관성 7 규칙 (사용자 백로그 9건 응답)

**R172 — MACRO_CALENDAR auto-advance 의무**: 발표 캘린더 entry는 일자 경과 시 자동 next event compute. `AIO._aioRecomputeMacroCalendar({ dryRun: true })` 사이드바 18축 노출 의무.

**R173 — cross-asset correlation matrix 의무**: 자산 간 30일 rolling Pearson correlation + regime classification 자동 산출. `AIO.computeCrossAssetCorrelation()` `_priceHistory` 활용. 사이드바 16축.

**R174 — AI 답변 정량 비율 측정 의무**: 채팅 답변에서 정량 토큰 비율 7%+ 권장. `AIO.assertQuantitativeRatioAudit()` 자동 측정 + 사이드바 17축. <4% 시 'fail' (정성 과다 환각 위험).

**R175 — earnings call transcript 통합 의무**: 종목 분석 시 FMP /earning_call_transcript 자동 fetch + 시스템 프롬프트 [Earnings Call (Qx YYYY)] 라벨 주입. AlphaSense/Sentieo 대체 무료 옵션.

**R176 — AI 답변 시각 자료 의무**: 답변 종목 detect 시 30일 mini sparkline SVG 자동 인라인 삽입. `_aioBuildSparklineSvg` 활용. 양수 green / 음수 red. 최대 3 종목.

**R177 — 사이드바 audit 일반/개발자 mode 토글 의무**: 18+ audit row metric은 일반 사용자에게 부담. `localStorage.aio_audit_mode = 'simple' | 'detailed'` 토글 의무.

**R178 — audit failure status sticky top + pulse 의무**: ✗ failure rows는 자동 top sort + 빨간 border + 2s pulse animation. ⚠ warn = amber. 위기 시그널 즉각 가시.

**Pattern 일반화 (R170 확장)**: 신규 audit 함수 추가 시 (1) fn 정의 (2) 사이드바 data-audit-key row 노출 (3) 회귀 T 테스트 3종 셋트 (`fn 정의 / status 반환 / 사이드바 DOM`) 동시 작성 의무.

---

## R179. 클라이언트 접속 시 자동운영 모델 — 부팅 로더 명시 + 서버 cron 금지 (v49.88 added, P447 root)
## R180. 데이터 lineage 5단계 연결 의무 + 자동 audit (v49.89 added, P450 root)
## R181. 데이터 검증은 카테고리 + cell-level(개별 sink→source) 둘 다 (v49.90 added, P451 root)
## R182. cell-level은 연결 + 값 정확성 둘 다 / 텍스트 수치는 동적 참조 (v49.91 added, P452 root)
## R183. WebSearch 수치는 지표별 정상 band 검증 후 수용 (v49.92 added, P453 root)
## R184. 동일 지표가 2개 저장소(DATA_SNAPSHOT 본체 + _fallback 미러)에 존재 시 정합 의무 (v49.96 added, P459 root)
## R185. 재발방지 audit은 pull이 아닌 push — 지속 운영 중 자동 surfacing 의무 (v49.96 added, P461 root)
## R186. 첫 접속/새로고침 시 진행률 로더 + 정적 콘텐츠 만료 시 동적 폴스루 의무 (v49.97 added, P462 root)
## R200. v50 페이지 계약/데이터 증거/AI 답변/배포 게이트 4원칙 (v50.0 added, P476 root)
## R187. 매매 핵심 페이지(종합 5)는 진입 시 stale하면 즉시 재fetch 의무 (v49.98 added, P463 root)
## R188. 전체 데이터 최신화 진행률은 중앙 refresh state를 단일 진실 원천으로 표시한다 (v49.101 added, P464 root)
## R189. 5개 종합 페이지 개별 데이터는 page profile 심볼/태스크 union으로 최신화한다 (v49.102 added, P465 root)
## R190. 보이는 차트/지표/시세/수치/수식/텍스트 표면은 최신화 감사에 자동 편입한다 (v49.103 added, P466 root)
## R191. AI 채팅의 종목 답변은 strict preflight 후 최신 시세/기업 데이터 블록만 인용한다 (v49.104 added, P467 root)
## R192. `forceFresh` for AI stock answers must bypass every local freshness shortcut (v49.105 added, P468 root)
## R193. AI chat must vary answer structure by intent and use only injected current data for current claims (v49.106 added, P469 root)
## R194. Critical-10 refresh success must be followed by DOM binding verification (v49.107 added, P470 root)
## R195. Trading-use market data must pass DataTruthGate before decision use (v49.108 added, P471 root)
## R196. Trading-use quotes require independent cross-source validation when available (v49.109 added, P472 root)
## R197. Critical-10 freshness must audit visible market surface, not only refresh schedules (v49.110 added, P473 root)
## R198. Critical-10 page content must be compared with current market reference/regime before being trusted (v49.111 added, P474 root)
## R199. Critical-10 content checks must use a full evidence matrix, not representative samples (v49.112 added, P475 root)
## R201. Trading decision logic must pass current evidence gate (v50.1 added, P477 root)
## R202. Runtime version uses one or two decimal digits only (v50.1 added)
## R203. News surfaces must use the shared evidence-style surface contract (v50.2 added, P478 root)
## R204. User-facing market text must pass the text surface contract (v50.3 added, P479 root)
## R205. Static market calendars must separate official releases from source-dependent topics (v50.4 added, P480 root)
## R206. 사용자 가시 텍스트에 개발자/버전 마커 금지 (v50.14 added, v50.13 UX audit root)
## R207. 접근성 WCAG AA 유지 — 접근 이름·최소 폰트·tap target (v50.14 added)
## R208. 분석 UI 상태·수량·정밀 주장·향후 일정은 증거 원천에서 파생 (v50.55 added, P500 root)
## R209. 계약 수·시간대·복합 가격 카드는 단일 진실 원천에서 파생 (v50.56 added, P501 root)
## R210. 런타임 scope·sink 소유권·증거 게이트 의미를 함께 검증 (v50.56 added, P502 root)
## R211. 넓은 AI 종목 추천은 분산 후보군을 먼저 만들고 반복 앵커를 감점 (v50.57 added, P503 root)
## R212. AI 채팅 정확성 가드는 사용자 의도별로 적용하고 답변력을 억제하지 않는다 (v50.58 added, P504 root)
## R213. AI 채팅 데이터 기능은 자연어 라우팅과 출처 레지스트리까지 연결해야 한다 (v50.59 added, P505 root)
## R214. AI 채팅은 AIO 전용 통합 답변 계약까지 주입해야 한다 (v50.60 added, P506 root)
## R215. Telegram/외부 정성 소스는 digest -> 화면 -> 스크리너 -> 채팅 -> 테스트까지 환류해야 한다 (v50.61 added, P507 root)
## R216. Data/news refresh must separate collection freshness from consumption coverage (v50.62 added, P508 root)
## R217. Scheduled data sources must close the collect -> artifact -> consume -> audit loop (v50.63 added, P509 root)
## R218. Runtime contract / share readiness gate is mandatory (v50.79)
## R219. Audit/gate is not semantic review (v50.89, P513 root)

**Rule**: A task is not complete just because an audit function exists, an object has the expected shape, a coverage percentage is high, or a sidebar row/DOM marker is present. For any request touching pages, AI chat, data/source pipelines, trading logic, technical analysis, ticker analysis, portfolio logic, market text, or public-sharing UX, the review must close the real semantic path:

- user request/intent -> affected function(s) and criteria
- affected function(s) -> downstream consumer(s)
- downstream consumer(s) -> visible page/chat/report output
- visible output -> market/domain meaning, currentness, source confidence, and user action risk

**Required**:
- Every new audit/readiness/coverage test must have either a direct semantic companion check or a documented semantic backlog item.
- Trading and market-decision edits must include at least one direct function contract and one user-visible wording/action check.
- AI chat edits must verify the route from user prompt intent to data/source block to answer policy/output, not only callable existence.
- UI/page redesign edits must inspect the first-screen visible hierarchy and at least one real user scenario for the touched route.
- Data/source edits must verify collect -> artifact/source -> loader -> normalized model -> page/chat consumer -> stale/source label.
- `node scripts/ci-semantic-review-check.mjs` must pass whenever `ci-runtime-contract-check.mjs`, AI/data/trading audits, or page redesign gates are touched.

**Validation**: `scripts/ci-semantic-review-check.mjs` inventories audit-only risk, verifies R219/P513 governance hooks, and asserts that high-risk trading/currentness gates remain semantic rather than shape-only.

## R227. Recommendation verification must exercise the no-ticker screener path (v51.30, P526 root)
## R220. Workflow memory must be compacted before it is extended (v50.89, P514 root)

**Rule**: `_context`, `CLAUDE.md`, QA checklists, postmortems, and `.claude/skills/*/SKILL.md` are operating surfaces, not infinite append-only logs. When a repeated problem appears, prefer one of these actions in order: remove stale guidance, merge duplicate rules, compress history into an indexable summary, split large skill details into `references/`, then add a new rule/check only if none of the above closes the loop.

**Required**:
- Do not add a long SKILL.md section when the material can live in a referenced file or deterministic script.
- A skill over 300 lines or 15KB must be treated as a compaction candidate unless it has a clear progressive-disclosure structure.
- `_context/BUG-POSTMORTEM.md` remains an archive, but latest failure patterns must be summarized into active RULES/QA/CI gates rather than re-read wholesale.
- `_context/RULES.md` additions must retire or merge superseded rules when a newer rule covers the same surface.
- `CLAUDE.md` must point to current operating contracts, not duplicate every historical caution.
- Any task that updates workflow docs or skills must run `node scripts/ci-workflow-compaction-check.mjs`.

**Validation**: `scripts/ci-workflow-compaction-check.mjs` reports oversized context/skill surfaces and fails if R220/P514 governance hooks are missing.

## R230. Dynamic news refresh must prove source quality and visible freshness (v51.30, P531 root)

**Rule**: News automation is not complete when RSS items are merely fetched or `public-data/data.json.newsCount` is nonzero. The visible home/briefing news surfaces must prioritize current, market-moving, credible-source items and must expose stale/empty states instead of filling the page with weak or old headlines.

**Required**:
- Server news scoring must distinguish Google News feed priority from actual article source tier; a high-priority query must not upgrade weak/re-syndicated sources.
- Low-quality/re-syndicated sources must receive an explicit penalty and must not dominate home core news.
- Query coverage must include the active market-mover themes that drive the current session, including Korea/AI semiconductor pressure and rebound when relevant.
- Home, briefing, market-news, and analysis-page news strips should use the same completed 08:00 KST to 08:00 KST 24h decision cycle unless the item is explicitly marked as a reference/static fallback.
- CI must assert source-tier scoring, low-quality penalties, current market-mover query coverage, and the home freshness contract.

**Validation**: `scripts/ci-data-pipeline-contract-check.mjs` checks source-tier scoring, low-quality source penalties, Korea AI/semi market-mover query coverage, dedicated credit/funding news backstop coverage, server `newsCycle*` metadata, and the shared completed 08:00 KST 24h news surface contract.

## R281. Live/browser QA must cover rendered route surfaces, not only prior static findings (v52.23, P633 root)
## R282. Assertive market-verdict/interpretation text must gate on live-sourced inputs — fallback/snapshot/blocked data may show numbers, but must not assert a directional or confidence-implying verdict (v52.24, P634/P635 root)
## R283. Interactive detail surfaces must be canonical, all registry entries must render, and same-screen metrics must share the same source (v52.27, P642 root)
## R284. Proxy responses, visible value slots, and browser QA matrices must be typed and executable (v52.28, P643 root)
## R285. Operational health labels and feed quality gates must distinguish sources and use accumulated evidence (v52.29, P644 root)
## R286. AI chat key gates must test the effective Claude route, not only the personal-key field (v52.30, P645 root)
## R287. Market breadth color, label, and gauge bars must share the canonical breadth regime (v52.31, P646 root)
## R288. Route x viewport audits must include topbar clipping and SVG text geometry, not only page overflow (v52.32, P647 root)
## R289. Live quote bridges must keep DATA_SNAPSHOT and `_fallback` mirrors synchronized (v52.33, P648 root)
## R290. Live-deployed invariants must be re-verified on a schedule independent of new commits (v52.38, P653 root)

**Rule**: A postmortem whose root cause was only reproducible against the deployed site — not by re-running local source gates against the checked-out repository — must add a standing predicate to `scripts/ci-live-invariant-check.mjs` in addition to any source-level contract in `ci-runtime-contract-check.mjs`/`ci-structural-check.mjs`. Source gates prove correctness at commit time; they cannot prove the live site is still serving that same correct state days or weeks later with no new commit in between to trigger them.

**Why this matters**: P638/C1 (a deployed Cloudflare Worker route older than the repo's `/anthropic` route) and P572/R263 (data commits landing while `[skip ci]` silently stopped the Pages deploy from publishing them) both had a fully correct repository while the live site diverged. No source gate could have caught either — nothing in the files those gates read had changed. `ci-structural-check.mjs`'s R280 shadow-declaration scan is a proven example of a check that only protects the repository, not what GitHub Pages/CDN actually serves.

**Required**:
- `scripts/ci-live-invariant-check.mjs` fetches the deployed site (`https://ysnle.github.io/aio-screener/`) and checks a small set of standing invariants against the live bytes: cachebuster/version coherency across all live script tags, and a live re-run of the R280 cross-file function-shadow scan.
- `.github/workflows/data-watchdog.yml` runs this script on its existing hourly schedule so a live-only regression surfaces without waiting for the next commit.
- Grow the predicate list only for root causes a local gate structurally cannot see (deploy/CDN/cache/operator-config drift). Do not duplicate a check `ci-runtime-contract-check.mjs`/`ci-structural-check.mjs` already enforces at commit time — two lists asserting the same fact will drift apart from each other.

**Validation**: `node scripts/ci-live-invariant-check.mjs` (network-dependent; also runs in `data-watchdog.yml`).

## R291. Static page-education content must state invariant mechanisms only, never a current level/date/verdict, and must inherit the existing declutter/accessibility gates (v52.39, P654 root)

**Rule**: A page-level "fundamentals"/education surface (e.g. `AIO_PAGE_FUNDAMENTALS`) is static prose written once and shipped to every visitor regardless of when they load the page — it is not a live render function, so it cannot re-check freshness on each view the way R282's live-verdict functions can. It must therefore never contain a claim that is only true on the day it was written: no current price/level, no current date, no directional/regime verdict. Only invariant mechanisms and relationships ("금리가 오르면 밸류에이션이 눌린다" style) are allowed — the fact side of R282's live/fallback distinction, applied unconditionally, since this content has no live/fallback state to check at all; it is always "unsourced" by construction and must read that way forever.

**Why this matters**: found during the v52.39 22-page education-layer audit (`_context/FABLE-EDU-OVERHAUL-DESIGN-2026-07-09.md` §1) — E1 (concept)/E2 (mechanism)/E5 (action guidance) were missing on 20 of 22 route pages, and the obvious failure mode when filling that gap is exactly R282's stale-narrative pattern (a hardcoded "지금 DXY 98은 위험 구간" sentence that reads as current fact forever). R282 gates *render functions* that can check a live/fallback flag at render time; this content has no such flag to check, so the constraint has to be enforced at content-authoring time instead.

**Required**:
- Content arrays for this component class may state relationships/thresholds/mechanisms but never a specific current price, index level, or date, and never a present-tense market verdict. This is not a ban on the words "지금"/"현재" themselves — a sentence that only frames an invariant question (e.g. "지금 얼마나 공격적이어도 되나") or quotes an actual UI section's literal label (e.g. a "경기 사이클 — 지금 어디?" card name) stays allowed; the boundary is asserting a specific market state as current fact, not the presence of either word.
- The DOM wrapper must reuse the existing `.aio-page-advanced-toggle` default-collapsed contract (no `open` attribute) rather than inventing a new always-expanded block, and must not use the `.aio-page-brief` class the v50.29 declutter contract already flags via `pageBriefNotDecluttered`.
- The component must not add new `aria-live` regions — static reference content does not need one, and `ci-ux-default-path-check.mjs` caps the whole document at 10.
- Interactive affordances stay out of scope for this content class; term cross-references are plain-text pointers ("사용 설명서 → 용어사전에서 X 검색"), not new `data-action`/onclick surfaces.

**Validation**: `js/aio-tests.js` T869 (registry completeness + render/idempotency smoke across all covered pages) and `scripts/ci-runtime-contract-check.mjs` (registry size, renderer/hook wiring, `.aio-page-brief` absence, `aria-live` absence within the component's own code block).

## R292. A client-side call routed through a region-unpinned shared edge proxy must auto-retry on the provider's own regional-block error signature, not just report it (v52.44, B8/P659 root)

**Rule**: When a browser-side fetch goes through a free-tier/shared edge proxy that cannot pin its execution region (e.g. Cloudflare Workers' free plan, which anycast-routes each inbound request independently), a request that happens to land on a datacenter the upstream provider blocks by policy fails with the upstream's own error body — not the proxy's own error shape. That failure is transient in the sense that a *new* request is independently re-routed and has a good chance of landing on a working datacenter; it is not transient in the sense that retrying the *same* connection or simply waiting would help. The retry must therefore: (a) issue a genuinely new request rather than reuse/retry the same connection, (b) gate on the caller actually being routed through the shared proxy — a direct call to the provider's own API from the user's own network never hits this failure mode, and (c) distinguish the provider's own error signature from the proxy's own unrelated error shapes at the same status code — retrying a proxy-side auth/quota/timeout failure wastes an attempt and can mask a real, non-transient problem.

**Why this matters**: found on B8 (`_context/DEFERRED-BLOCKS.md`) — curl reproduced the exact mechanism 3 times: identical requests through Cloudflare's free-plan Worker landed on `CF-RAY:...-NRT` (Tokyo, 200 OK) or `CF-RAY:...-HKG` (Hong Kong, 403) depending on which edge anycast happened to select, and the 403 body was Anthropic's own `{error:{type:'forbidden',message:'Request not allowed'}}` — not the Worker's own `errorResponse()` shape (`{error,status}`) — proving Anthropic itself, not the repo's Worker code, rejected the Hong-Kong-routed request by regional policy. The repo, secrets, and deploy were all otherwise correct; there was nothing to fix upstream, only a client-side mitigation to add. A prior, unrelated 403 investigation on the same route (B5) had guessed "Anthropic rate/concurrency limiting" — that guess was wrong (corrected once this mechanism was actually reproduced), which is itself a caution against assuming a cause for a recurring status code without reproducing the actual error body.

**Required**:
- Detect the specific upstream error shape (not just the HTTP status code) before retrying — a matching status code from the proxy's own error path is a different, non-retriable problem.
- Gate the retry on the call actually being server-key/proxy-routed; a direct-to-provider call under the user's own key/network never exercises this failure mode and must not retry on it.
- Cap retries low (1-2) and retry immediately with a fresh request — this is a routing-luck problem, not a load/backoff problem, so exponential backoff or added delay only costs latency without helping.
- Apply the same helper to every call site that shares the affected route, not only the one surface where the symptom was first noticed — a shared root cause left half-patched (e.g. chat fixed but briefing/translation left on raw `fetch`) reproduces the same user-visible failure on the unpatched surfaces.

**Validation**: `js/aio-tests.js` T887 (helper structure: status gate, server-key gate, provider-error-shape check, retry-fetch presence) + T888-T890 (all call sites wired, not just the first one found) and `scripts/ci-runtime-contract-check.mjs`'s matching B8 checks.

## R294. A security/encryption UI claim and a lock gate are two separate things to verify — a settings screen existing is not proof its protection is wired into the actual read path (v52.46, WO-1A/P661 root)

**Rule**: When a feature claims a security property in its UI copy (e.g. "PIN 설정 후 저장 시 AES-256 암호화"), verify two independent things, not one: (a) does the storage/read path actually implement that property, and (b) does the *gate* that's supposed to enforce it (a lock screen, a PIN prompt) actually get invoked on the path a user takes to reach the data. A function that looks like the gate (checks a stored PIN, decides whether to show a lock screen) is not evidence the gate fires — grep for its actual call sites. A gate that exists but is never called is indistinguishable, to someone reading the code casually, from one that works; it only differs when someone actually traces the caller graph or drives the UI.

**Why this matters**: found on P661 — the portfolio's `checkPortfolioPin()` was a complete orphan (zero call sites repo-wide); the page's `pf-main` container defaulted to visible, so a user who *had* set a PIN never saw a lock screen on normal page entry — the gate silently never engaged, independent of and prior to the separate finding that the underlying data was never actually encrypted (Codex P0-2). Two distinct bugs, easy to conflate as one, each requiring its own fix and its own verification.

**Required**:
- Grep the entire codebase for a security gate function's name before trusting it's load-bearing; a zero-call-site result means it does nothing regardless of how correct its internal logic looks.
- Verify the claimed protection (encryption, hashing, etc.) with an actual round-trip test against the real storage key, not just a code read — wrong-credential rejection specifically (the failure mode most likely to be silently absent) needs its own explicit test.
- When retrofitting real protection onto a previously-fake claim, cover migration for existing users who already have data under the old (unprotected) scheme — an upgrade path, not just a fresh-install path.
- Prefer wiring the gate into the single shared render/entry function all callers already funnel through, rather than trying to add the check at every individual call site — a per-call-site approach is exactly how a gate becomes reachable from some paths and not others.

**Validation**: `js/aio-tests.js` T891-T895 (`_testV5246PortfolioVault`) — static source-contract checks that the sensitive-key set, the shared vault sync-cache, the lock gate's actual wiring into the render function, and the null-decrypt wrong-PIN check are all present — plus a same-session Playwright E2E pass (17/17 across fresh-install, encrypt-at-rest, cross-reload lock, wrong-PIN rejection, correct-PIN recovery, legacy-PIN migration, and opt-out-without-touching-the-shared-vault scenarios) backing the behavioral claim that static contracts alone can't prove.

## R295. A special-purpose route added to a shared edge proxy must pass through the same defenses as every other route on that proxy — a new route is a new perimeter, not an exception to the old one (v52.47, WO-1B/P662 root)

**Rule**: When a new route is added to an existing edge/CORS proxy (e.g. a `POST /anthropic` handler bolted onto a Worker that was originally "just" a GET data-proxy), it does not automatically inherit that proxy's existing defenses (bot-UA filtering, rate limiting, domain allowlisting) unless it is explicitly routed through them — and if the new route is branched off *before* those checks in the request-dispatch order, it silently bypasses all of them. A route that is more expensive per-call than the rest of the proxy (an LLM relay vs. a JSON GET) needs its own, stricter version of each defense, not a shared one sized for cheap calls. Separately: CORS headers are a browser-side reading restriction, not a server-side access control — `Access-Control-Allow-Origin` never stops a `curl`/script/server call from reaching the handler and consuming its resources; an actual `Origin` check inside the handler (reject if missing or not allowlisted) is a different, additional control that CORS header generation does not provide for free.

**Why this matters**: found on WO-1B (`cloudflare-worker-proxy.js`) — the `/anthropic` server-key route was dispatched before the general proxy's bot-UA check, `checkRateLimit`, and domain allowlist, and never checked `Origin` itself (it only echoed one into the CORS response header). A daily-cap KV counter's read-then-write was also a non-atomic race (acceptable for a soft cap, but combined with "no cap enforced at all if the KV binding is simply missing" turned an intended cost ceiling into silent unlimited exposure on the single most common misconfiguration — forgetting to bind a namespace).

**Required**:
- When adding a new route to a shared proxy, explicitly re-apply (or deliberately, visibly skip with a comment explaining why) every defense the proxy's other routes already have — origin, rate limit, size limits — rather than assuming routing order makes this automatic.
- Give an expensive route its own, separate rate-limit bucket/threshold; do not let it share a limit sized for the proxy's cheapest call.
- A resource cap gated on an optional binding (KV, a queue, a secret) must decide explicitly whether missing-binding means fail-open (available but uncapped) or fail-closed (unavailable but never uncapped) — silence defaults to fail-open, which is rarely the intended answer for a *cost* cap specifically (availability caps may reasonably differ).
- Document the honest ceiling of client-side-only auth for a static site with no backend: a shared token embedded in public JS raises the bar against automated/naive abuse but is transparent to anyone who reads the page's own source — state this limitation next to the mitigation, not as a silent gap discovered later.

**Validation**: `scripts/ci-worker-anthropic-check.mjs` — imports and directly invokes the real Worker `fetch` handler (Node 18+'s native `Request`/`Response`/`URL` make this possible without a Cloudflare deployment or a browser), asserting kill-switch, Origin rejection, optional app-token rejection, the dedicated `/anthropic` rate limit, KV-unbound fail-closed, and the body-size cap all produce the correct status codes — a real behavioral test, not only a source-text contract, since this logic doesn't have the async-in-a-synchronous-test-runner constraint that gated B8/WO-1A to static checks. Plus `ci-runtime-contract-check.mjs` static checks for the client-side header wiring.

## R296. A session-scoped automation hook must not hardcode an absolute environment fact, and must scope its side effects to what changed during its own session, not whatever it finds lying around (v52.47, WO-5/P663 root)

**Rule**: A hook config that hardcodes an absolute filesystem path (a user profile directory, a cloud-sync folder) breaks the instant that path changes — a repo move, a re-clone, a sync-provider migration — and it breaks *silently*: the hook invocation just fails to resolve and the tool moves on, with no visible error surfaced to the person relying on it. Prefer paths relative to the repo root (resolved at hook-invocation time, since these tools already run with the project root as cwd) over anything user- or machine-specific. Separately: a `Stop`/session-end hook that does `git add -A` to auto-save "this session's work" is making an assumption — that everything currently dirty in the working tree belongs to this session — which is only true if the tree started clean. It routinely isn't: a previous session's uncommitted scratch state, or (concretely, in a repo two different agent tools operate on) a *different* tool's uncommitted output, sits there from before this session began. `git add -A` cannot distinguish "dirty because of me" from "was already dirty" — it stages both, and the resulting commit silently bundles unrelated work under this session's label.

**Why this matters**: found on WO-5 — `.codex/hooks.json` hardcoded every hook command to an absolute OneDrive path that no longer existed (the project had moved to a plain local directory), so every Codex-side hook (file-overwrite protection, dangerous-command blocking, version-sync checking) had been silently doing nothing. Separately, this exact session's own Stop-hook auto-commit (`git add -A`) was directly observed sweeping in a diagnosis document and an index file that predated the session and had nothing to do with its work — not a hypothetical, a commit (`1b3f39a`) that actually happened mid-session.

**Required**:
- Hook commands in `settings.json`/`hooks.json` must be relative paths from the repo root, never an absolute path baked in for one machine's current directory layout.
- A regex meant to capture a numeric field with a variable digit count must not hardcode a fixed digit count for any segment (`\.[0-9]` only ever captures one digit) — verify against a current real value with more digits than the pattern's author was probably picturing when they wrote it.
- A session-end auto-commit hook should snapshot repo state at session *start* (a `SessionStart` hook writing `git status --porcelain` to a scratch file) and diff against it at session end, staging only paths that are new since the snapshot — not stage everything currently dirty. This is a path-membership diff (ignore the exact status code, compare only which paths appear), so a file already dirty before the session correctly stays untouched by this session's commit even if it's still dirty at the end.
- When two tools' hook configs are meant to mirror each other (here, `.claude/` and `.codex/`), diverging line endings alone can make `diff` report every line as changed and obscure whether the actual logic has drifted — normalize (or diff with whitespace/CRLF stripped) before concluding they disagree.
- A repo-governance change with real teeth (enabling branch protection where none existed) needs the actual current push pattern checked first (do bots/hooks push directly to the default branch with no PR?) — a protection ruleset sized for a PR-based workflow (required reviews, required status checks before merge) would immediately break a direct-push-based one; scope the ruleset to what's actually compatible with the observed workflow (e.g. force-push/deletion protection only) rather than a generic "best practice" default.

**Validation**: manual pipe-tests of each hook script's new logic against synthetic and real repo state (comm-based diff verified empty when nothing changed and correctly identified a newly-created path after a snapshot; version-regex re-verified against the actual current multi-digit version string) before wiring into `settings.local.json`/`hooks.json`, per the `update-config` skill's construct-then-verify workflow. Branch protection settings verified by re-querying `GET /repos/.../branches/main/protection` after the change and confirming the exact fields set (`allow_force_pushes`/`allow_deletions` false, `required_pull_request_reviews` absent).

## R293. Every workflow YAML must be hard-gated for control-character corruption and parseability; other bot-written text gets a baseline-tracked regression gate (v52.45, WO-0/P660 root)

**Rule**: An automated "WIP auto-save" commit bot that writes Korean (or any non-ASCII) text into files can silently mojibake-corrupt that text — inserting genuine C0/C1 control characters (e.g. U+0080) into otherwise-valid UTF-8. For `.github/workflows/*.yml` specifically this is not merely cosmetic: PyYAML (and GitHub's own workflow parser) rejects C1 control characters outright, so a single corrupted byte anywhere in the file makes the *entire workflow* fail to parse — the job never even gets created, and — critically — a workflow like a freshness watchdog fails *silently from the monitoring system's own perspective*, since the thing meant to catch failures is itself the thing that broke. Workflow YAML must therefore be a zero-tolerance gate (any control character or YAML-parse failure fails CI), not a warn-and-continue.
For the rest of the repo (docs, scripts, source `.md`/`.js`/`.json`), the same corruption can and does accumulate silently over many commits with no equivalent hard consequence (nothing "fails" when a changelog paragraph is garbled) — a from-scratch zero-tolerance gate would immediately fail on pre-existing historical debt that isn't safely fixable in one pass (see below). Use a baseline file recording the current known-corrupt count per file; fail only if a file's count *increases* (new corruption), and treat a decrease as an improvement to re-baseline, never as a failure.

**Why this matters**: found via `_context/CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md` WO-0 — commit `40dbef8`'s auto-save mojibake'd 5 characters in `data-watchdog.yml` into the exact C1 codepoint YAML forbids, and the corrupted commit only reached `origin/main` via a later merge, at which point every subsequent scheduled watchdog run started failing with "workflow file issue" and zero job output — a repo-wide `git ls-files`+charcode scan while building the fix's CI gate then surfaced the *same* corruption pattern already baked into `CHANGELOG.md` (6,386 instances) and `_context/BUG-POSTMORTEM.md` (3,208 instances) from many earlier bot commits, accumulated silently for weeks with no gate to catch it.

**Required**:
- `.github/workflows/*.yml`: 0 control characters and a successful YAML parse (e.g. via `js-yaml`), enforced on every push/PR — no baseline, no exceptions.
- Everything else the bot writes to: a baseline-tracked scan (count control characters per file, compare to a recorded baseline, fail only on increase) so new corruption is caught going forward without requiring an immediate, risky mass-rewrite of existing history to turn the gate on.
- When a literal control-character regex/escape sequence needs to live in the *checking script itself*, prefer numeric char-code range comparisons over regex character-class escapes (`\x7f-\x9f` etc.) — those exact escapes proved unreliable to author/transcribe correctly through this session's own tooling, ironically for a script whose entire job is detecting that class of corruption.

**Validation**: `scripts/ci-control-char-check.mjs` (hard workflow gate + baseline regression gate) wired into `ci.yml`'s `validate` job; `_context/control-char-baseline.json` tracks the known pre-existing count per file.

## R301. A current market metric must have one canonical selector and an explicit provenance state; a snapshot may render as reference but must never silently drive a decision (v52.55, H3-A/P671 root)

**Rule**: A metric shown in multiple pages (especially Fear & Greed) must be selected through one canonical currentness envelope containing value, source, as-of/fetched-at, freshness, status, and decision-use permission. Truthy fallback chains (`live || snapshot || default`) are prohibited for current claims because they erase valid zeroes and can promote an old snapshot into a trading input. A stale or reference value may remain visible only with its reference state; score/entry logic must neutralize or block it until current evidence is available.

**Required**: Producers must write provenance metadata at the same time as the value; consumers (page summaries, dashboards, decision headers, AI evidence) must read the selector rather than `_lastFG`/`DATA_SNAPSHOT` directly. CI and headless tests must cover live-over-snapshot precedence, zero preservation, snapshot non-decision use, and stale blocking.

**Validation**: `window.AIO.getCanonicalMetric('fg')`, `js/aio-tests.js` T901–T904, and `scripts/ci-runtime-contract-check.mjs` H3-A checks.

## R302. Historical event context must expire before it can influence a current action; derived regimes need a missing-input quorum gate (v52.55, H3-B/C/P672 root)

## R303. PC geometry and external-source failures must be explicit, bounded, and user-visible (v52.56, H3-D/E/P673 root)

## R304. Third-party libraries are progressive enhancements and must never block the local route boot queue (v52.57, H3-F/P674 root)

**Rule**: A CDN-only library may improve charts, sanitization, or visualization, but it must not sit ahead of local application modules in a blocking ordered load queue. The core route router, page state, and safe fallback must boot even if every third-party CDN is unavailable.

**Required**: Load external enhancement libraries asynchronously or through an explicit bounded loader; keep local application modules in their deterministic order; retain a no-library fallback for every route that depends on an enhancement.

**Validation**: T912, runtime H3-F check, and the PC Chromium reload journey.

**Rule**: A canvas must never keep an intrinsic width larger than its actual desktop grid parent; an intentionally wide table must be contained by an explicit, keyboard-accessible horizontal-scroll region. External success, partial, timeout, malformed, and unavailable responses must resolve through one state contract with an explicit `allowedUse` policy. Console warnings alone or blank feed slots are not a valid failure state.

**Required**: Use the shared canvas width contract and `.aio-table-scroll` region semantics; use `AIO.normalizeExternalSourceState()`/`AIO_EXTERNAL_STATES` for API/RSS transitions; render a localized status and retry/reference policy where an external feed has no usable result.

**Validation**: T907–T911, runtime-contract H3-D/E checks, and the real PC/laptop Chromium artifact matrix.

**Rule**: Event/result narratives are reusable context, not perpetual current signals. Every event claim needs an explicit age window and must become historical/reference-only after expiry. A derived score or regime may retain a numeric diagnostic output for transparency, but when critical current inputs are missing/stale beyond the quorum threshold it must block an execution conclusion and expose the reason.

**Required**: Use `AIO_EVENT_FRESHNESS_REGISTRY` through `AIO.getEventClaimState()`; do not read event status/date directly to form current action copy. Preserve the diagnostic score, but block action/decision and prevent later overlays from restoring a strong conclusion.

**Validation**: T905/T906, `_aioDefaultDecision().decisionBlocked`, `_aioApplyEventFreshnessGate()` claim-state attributes, and runtime H3-B/C checks.

## R305. Partial third-party chart stubs must be treated as unavailable before registry access (v52.58, P675 root)

**Rule**: A truthy global library symbol is not proof that the required API surface loaded. Progressive-enhancement chart initialization must guard every API it calls, including `registry`, `plugins`, and `register`, before touching a partial local fallback stub.

**Required**: Keep the `initBreadthPage()` partial-Chart guard, preserve the local non-chart fallback path, and retain T918 plus the real Chromium H3-H/H3-I gate so CDN-loss route errors remain visible.

## R306. Typed provenance must separate evidence state from action strength (v52.59, P676 root)

**Rule**: Missing, neutral, future-dated, stale, delayed, snapshot, manual, seed, fallback, and proxy evidence are not interchangeable. A typed evidence envelope must preserve the source kind, as-of time, status, operational use, action strength, confidence, and one stable evidence ID.

**Required**: Reuse the same evidence ID across decision UI, score metadata, and AI context; missing remains distinct from neutral; future or missing evidence blocks action, while stale/reference evidence is reference-only and cautious-only. Validate through T930, the typed-provenance runtime contract, and `data-evidence-id`/`data-operational-use` attributes.

## R307. Full-route accessibility is a blocking local gate; assistive technology remains separate (v52.59, P676 root)

**Rule**: Every registered route must be checked at the mobile viewport for computed font sizes, control naming, select/canvas naming, positive tabindex, skip-link behavior, and modal semantics. A local route matrix cannot substitute for Firefox/WebKit or NVDA/manual evidence.

**Required**: Keep `ci-accessibility-matrix-check.mjs` in the blocking workflow and require zero computed fonts under 10px, nameless controls, unnamed selects/canvases, and positive tabindex values. Keep small-target observations and external/human Tier-13 evidence explicitly separate.

**Validation**: T918, `ci-runtime-contract-check.mjs`, and `ci-critical10-human-surface-check.mjs` with external requests blocked.

## R308. Fallback/reference freshness must not be forced into live parity (v52.60, P677 root)

**Rule**: A static `DATA_SNAPSHOT` marked `_isFallback=true` is reference-only and may lag a dynamically refreshed digest or source artifact. Its freshness contract is explicit degraded-state labeling and chronological ordering, not identical timestamps with a live-ish source.

**Required**: Regression tests must distinguish fallback from promoted snapshot state. For fallback data, require valid dates and `marketDate <= digestDate`; for promoted data, require the configured cross-source parity window. Never advance a fallback date without updating the values and provenance it describes.

## R309. Bulk text-replacement scripts must not run blindly across JS string literals — check for characters doing double duty as logic markers before a global find-replace (v52.62, P678 root)

**Rule**: Any script that mechanically strips or remaps literal characters/colors across an entire source file (not just HTML display text) can hit JS string literals where that character is not decorative but the *only* distinguishing content between two branches of a ternary or template string (e.g. `cond ? '✓' : '✗'`) that downstream code parses via `.indexOf()`/`.charAt()`/equality. Collapsing both branches to the same value silently makes the condition permanently true — this is worse than a visual regression because it looks like working code, still runs, and can pass a full test suite if that exact logic path isn't asserted.

**Required**: After any bulk find/replace across a full HTML+JS file (emoji strips, color sweeps, label renames), grep specifically for the signature of this failure class before trusting the change: both-branches-identical ternaries (`? '...' : '...'` where both sides are now equal) and `.indexOf('')`/`.indexOf(<now-empty-or-collapsed-string>)` patterns. A passing headless suite is necessary but not sufficient — confirm the specific corrupted-looking lines by reading them, not just by re-running tests. See P678/BUG-POSTMORTEM.md.

## R328. 승인된 화면 시안은 장식층이 아니라 기본 정보구조이며, 접힌 레거시는 통합으로 간주하지 않는다 (v52.87, P702 root)

**Rule**: 시안에 없는 기존 섹션을 `<details>`로 접거나 시안 앞뒤에 그대로 붙이는 방식은 이식 완료가 아니다. 기본 사용자 경로는 시안의 순서·밀도·텍스트 계층을 우선하고, 중복 설명·교육·운영 진단은 삭제하거나 전용 도움말/개발자 모드로 이관해야 한다.

**Required**: 13개 시안 화면에는 conclusion → evidence → action 순서에 직접 기여하는 콘텐츠만 기본 노출한다. `.aio-fund`, Public Status, 파이프라인 감사, 시안 밖 고급 도구는 기본 경로에 렌더하지 않는다. R291의 페이지별 교육 블록 의무는 본 규칙으로 대체하며, 교육은 전용 사용 설명서에서 제공한다.

**Validation**: T869, runtime-contract의 inert fundamentals/no-navigation-hook, 13면 advanced developer-only, 포트폴리오 순서/CTA, 스크리너 9열 게이트.

## R329. 시안 기본 경로 계약은 초기 HTML이 아니라 런타임 주입이 끝난 최종 화면에 적용한다 (v52.88, P703 root)

**Rule**: 승인 시안의 순서·밀도·중복 제거 계약은 페이지 진입 이벤트, 비동기 데이터 렌더, 공통 헤더/뉴스 삽입, 기존 재배치 함수가 모두 실행된 뒤에도 유지되어야 한다. 자동 생성된 패널이라는 이유로 시안 밖 콘텐츠를 일반 사용자 화면에 되살리지 않는다.

**Required**: 13면의 자동 판단 헤더·관련 뉴스·중복 피드·운영 진단은 개발자 경로로 격리한다. 결과 수가 변하는 뉴스와 스크리너는 첫 화면 상한과 명시적 점진 공개를 사용하고, 긴 브리핑 피드는 사용자가 확장하기 전까지 높이를 제한한다. 시안에서 정의한 핵심 순서를 런타임 DOM 이동으로 뒤집지 않는다.

**Validation**: T869 `redesign_default_path_v5288`, runtime-contract [G], 로컬 Chromium 13면 데스크톱·모바일 캡처, viewport/accessibility matrix.

## R330. 사용자 표면 수와 내부 QA 라우트 수를 분리하고, 시안 정보 위계를 모든 사용자 표면에 적용한다 (v52.89, P704 root)

**Rule**: 제품 페이지 수는 메뉴에서 직접 접근하는 19개 페이지와 용어사전 오버레이 1개를 합한 20개 사용자 표면으로 설명한다. `ticker`, `theme-detail`은 파생 뷰이며 `options`는 폐기 호환 reference shell이므로 22개 QA 라우트를 22개 사용자 페이지라고 부르지 않는다.

**Required**: 핵심 13면의 타이포그래피·여백·정보 우선순위를 사용설명서·용어사전·한국 5면에도 확장한다. 교육 콘텐츠는 검색 가능한 장별 공개, 대규모 테마 목록은 점진 공개, 중복 뉴스와 페이지 내 반복 용어 설명은 공용 뉴스/가이드 표면으로 통합한다. 기존 데이터·액션 함수는 재사용하고 별도 정적 데모를 만들지 않는다.

**Validation**: T869 `redesign_default_path_v5289`, runtime-contract [G], `AIO_ROUTE_REGISTRY.classes`, 남은 7면 데스크톱·모바일 실렌더링.

## R331. 시안의 최종 렌더 계약은 loaded/empty/degraded/closed 상태 전환과 종료 시간까지 포함한다 (v52.90, P705 root)

**Rule**: 섹션의 존재·순서·기본 노출만 맞아도 사용자 여정이 완료된 것으로 보지 않는다. 비동기 공급자 무응답, 캐시 폴백, 결과 0건, 접힌 상세, 닫힌 오프스크린 패널에서도 화면은 유한 시간 안에 읽을 수 있는 한 상태로 수렴해야 하며 같은 정보의 본문·요약·상태 소유자가 분리돼서는 안 된다.

**Required**: 외부 다중 요청은 총 예산과 부분 성공 경로를 가진다. 뉴스 피드와 헤더는 한 상태 갱신 함수를 사용한다. 점진 공개 컨트롤은 자신이 공개할 콘텐츠와 같은 페이지/컨테이너에 둔다. 닫힌 패널은 `inert`와 ARIA/포커스 상태를 함께 전환한다. 데이터가 없으면 계산 불가능한 카드를 숨기고 다음 행동을 우선한다. 대량 브라우저 요청은 명시적 상한·회로·단일 실패 설명을 가진다.

**Validation**: T1015~T1020, runtime-contract [G2], 20개 사용자 표면 데스크톱/모바일 렌더와 기업 분석 timeout·뉴스 cache/load-more·AI open/close·KR failure·portfolio empty 실제 Chromium 여정.

## R332. 데이터 파일 갱신시각·외부 관측시각·마지막 수집 성공시각을 분리하고 missing을 판단값으로 승격하지 않는다 (v52.91, P706 root)

**Rule**: `generatedAt`은 파일 생성 또는 실제 성공 중 문서화된 한 의미만 가져야 하며, 가격의 거래소 관측시각과 공급자 요청시각을 대신하지 않는다. 값이 없거나 원천이 실패한 상태를 `0`, 중립, 현재값, 또는 새 성공시각으로 변환하지 않는다. 지표가 그대로라는 이유만으로 정책금리를 stale 처리하지 않고 지표 주기에 맞는 freshness budget을 사용한다.

**Required**: 모든 의사결정 입력은 source, `observedAt`, `fetchedAt` 또는 `attemptedAt`, `lastSuccessfulAt`, freshness, `allowedUse`를 구분한다. 시세 producer는 거래 관측 메타데이터를 보존한다. 시장폭·심리·수급처럼 최신성이 끊긴 값은 점수/레짐/행동 문구에서 차단하며 화면에는 원천 미수신·참고값을 명시한다. 비밀키 실값은 masked input DOM에 복원하지 않는다. 통계적 예측 검증을 통과하지 않은 점수는 환경 설명으로만 명명한다.

**Validation**: runtime contract LIVE3-01~10, data-pipeline contract, 22개 범주 currentness 평가표, 실브라우저 20개 사용자 표면, 당일 공식/1차 소스 시장 대조.

## R333. 핵심 수집 실패는 마지막 정상 산출물을 덮어쓰지 않으며 공급자 가용성과 구현 완료를 분리한다 (v52.92, P707 root)

**Rule**: producer는 핵심 커버리지·스키마·관측시각 게이트를 통과하기 전에 공개 artifact를 쓰지 않는다. 독립 갱신 가능한 데이터군은 전체 파이프라인과 분리한다. 대체 API가 존재한다는 사실을 현재 연결·권리 승인·운영 준비 완료로 표시하지 않는다.

**Required**: 각 외부 의존은 current provider, target adapter, alternative, implementation state, rights, cadence를 기록한다. 실패 시 마지막 정상 artifact와 `lastSuccessfulAt`을 유지하고 새 `attemptedAt`/실패 상태만 기록한다. missing·라이선스 차단 입력은 중립값이나 현재값으로 변환하지 않는다.

**Validation**: data-pipeline contract의 `CORE_QUOTE_COVERAGE_FAILED` 선행 순서와 `SCREENER_ONLY`, runtime contract LIVE3-11~12, `AIO.getExternalDependencyAudit()`.

## R334. 데이터 대체 계획은 독립 실행·행 단위 lineage·publish 전 의미 검사로 닫는다 (v52.93, P708 root)

**Rule**: CLI 진입점이나 후보 API 문서만 존재하는 상태를 자동화 완료로 표시하지 않는다. 반복 artifact는 각 행의 관측시각·출처·허용 용도를 보존하고, publish 전에 커버리지·현재성·사용범위를 실행 가능한 validator로 검사한다.

**Required**: 무료 공식 원천을 우선하고 무료 동등 경로가 없으면 reference/education으로 제한한다. 운영자 이메일·무료 키·승인이 필요한 원천은 `operator_configuration_required`로 fail-closed 처리한다. 공용 CORS proxy/CDN 실패가 더 최신인 공식 서버 artifact를 snapshot으로 되돌리지 못하게 한다.

**Validation**: `refresh-screener.yml`, `validate-screener-artifact.mjs`, SEC companyfacts 정규화 fixture, Cboe 공식 페이지 parser fixture/live probe, 종목별 `observedAt/sourceKind/allowedUse`, runtime/data-pipeline contract.
