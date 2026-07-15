---
verified_by: Codex (handoff-to-code reconciliation + focused live source probes)
last_verified: 2026-07-15
confidence: high for local implementation state; live/legal/human gates remain explicit
target_version: v52.96
source_handoff: _context/INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md
source_plan: _context/DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md
document_role: current reconciliation ledger and executable handoff contract
execution_contract_version: 1.0
---

# 기관급 데이터 핸드오프 대조 및 실행 설계

## 결론

### v52.96 local audit addendum

- `scripts/ci-data-lineage-audit.mjs`가 tracked `public-data/*.json` 12개를 정책별로 열거하고 timestamp, age, source, producer failure, 마지막 Git commit을 출력한다. 2026-07-15 local 결과는 `PASS 10 / WARN 2 / FAIL 0`이다.
- WARN은 `screener-universe.json`의 선언된 7일 staleAfterDays 초과와 `sec-fundamentals.json` 24/655(3.7%)로, SEC 80% decision-use 게이트는 계속 차단된다. 값의 존재만으로 current/decision-use로 승격하지 않는다.
- AI 답변은 T940~T1014 및 T1021~T1023의 shared pipeline, typed claim/evidence, currentness, retrieval poisoning, conduct/action, automated publish, SLO/golden/replay, rights/tool, page completeness 계약과 Chromium headless 1084/1084 결과로 `VERIFIED_LOCAL` 범위만 확인된다. 이는 실제 모델의 사실성, provider rights, live model, human/legal 인증을 의미하지 않는다.
- 이 보강으로 공개 판정은 변경하지 않는다. SEC 80% 누적, 공식 이벤트/KR server adapter, PIT/corporate actions, live soak, Firefox/WebKit·NVDA/VoiceOver·실사용자, 법률/권리 승인은 여전히 `PUBLIC NO-GO` 조건이다.

핸드오프와 v52.92까지의 작업은 중복 문서를 만들었지만, 동일한 항목을 이중 실행한 것은 아니다. 핸드오프는 `DESIGNED` 기준 원장이고 대체 계획은 공급자 선택표이며, 실제 구현은 일부만 진행돼 있었다. 이번 대조에서 세 가지 누락을 확인하고 로컬 구현했다.

1. `SCREENER_ONLY` 진입점은 있었지만 독립 GitHub Actions 작업과 publish 전 의미 검사가 없었다.
2. `screener.json`에는 전체 `factorObservedAt`만 있고 종목별 `observedAt/source/allowedUse`가 없었다.
3. Put/Call은 공식 Cboe CDN이 403인 상태에서도 브라우저 공용 프록시 경로가 주경로였고, 실패 시 오래된 snapshot으로 되돌아갈 수 있었다.

## WP 상태 대조

| Packet | 현재 상태 | 겹친 기존 작업 | 이번 확인/조치 | 남은 것 |
|---|---|---|---|---|
| WP-0 공개 위험 차단 | VERIFIED_LOCAL / live 별도 | v52.75~80 semantic/publish gate | raw server marketAnalysis는 semantic opt-in 없으면 공개 차단 유지 | live model corpus·semantic publish 인증 |
| WP-1 Canonical Quote | IMPLEMENTED_LOCAL / artifact 갱신 대기 | v52.91 regularMarketTime/session/timezone | producer에 `observedAt/fetchedAt/delayedByMs/venue/allowedUse` 명시 | 현재 배포 `data.json` 77행 재생성·live 확인 |
| WP-2 Typed Macro | PARTIAL | FRED per-series `_asOf_*` | 중복 구현 안 함 | BLS/BEA 원발표, release/vintage 저장 |
| WP-3 Breadth | VERIFIED_LOCAL, research-only | v52.92 846/870 AIO universe breadth | 종목별 lineage 추가, artifact validator 통과 | PIT constituents/delisted/official exchange breadth |
| WP-4 Fundamentals/Filings | IMPLEMENTED_LOCAL / operator config | 기존 client SEC on-demand, FMP 0건 | 무료 SEC companyfacts bounded batch·정규화·누적 artifact·6h workflow 추가 | `SEC_USER_AGENT` 저장소 변수, 80% 누적, DART 수정공시/기간 정규화 |
| WP-5 Official Event Graph | DESIGNED | 공식 일정 일부, 뉴스 2차 소스 | 중복 구현 안 함 | SEC/Fed/BLS/BEA/BOK/DART event ID·정정·cluster graph |
| WP-6 KR Official | PARTIAL | client BOK ECOS/KOSIS key path | OpenDART를 무료 키 경로로 재분류 | server adapter, 무료 키, KRX 승인/제3자 제공 조건 |
| WP-7 Research efficacy | PARTIAL | v52.91~92 research-only ranking | 제한 계약 유지 | PIT/OOS/cost/turnover/calibration 승인 |
| WP-8 Release gate | PARTIAL | runtime/CI/rights registry | free-plan-only constraint 추가 | live soak, notification, legal/human approval |
| WP-9 Cross-page reconciliation | PARTIAL | canonical F&G와 currentness gate | 이번에 중복 구현 안 함 | 22 route 반복 metric 전체의 value/asOf/sourceKind/evidence ID CI |
| WP-10 Page completeness | PARTIAL | 22 route/page AI contracts | 이번에 중복 구현 안 함 | unique producer 실제 성공·minCoverage·failure state 전 route 증명 |
| WP-11 Screener truth | VERIFIED_LOCAL, fundamentals partial | v52.92 universe/coverage/research contract | 846개 행 `observedAt/source/allowedUse`, validator, 무료 재무 coverage gate | SEC 80% 누적 전 value/quality 비활성, displayed count live 대조 |
| WP-12 SLO/quarantine | PARTIAL | last-known-good core quote, source gates | screener publish 전 semantic validator 추가 | source별 p95/error budget/replay/immutable raw |
| WP-13 Human journey | PARTIAL | Chromium matrices + certification registry | 자동 결과를 실제 사람 인증으로 승격하지 않음 | Firefox/WebKit/NVDA/VoiceOver/실사용자 서명 |
| WP-14 Rights review | DESIGNED/PARTIAL registry | AI/data rights registries | 무료 경로만 기본 자동화, 무료 동등 대체 불가를 명시 | 법률 승인·KRX/거래소 entitlement |

## 무료 소스 실행 판정

| 데이터 | 조치 | 상태 |
|---|---|---|
| Cboe Total/Equity/Index Put/Call | 공식 Daily Market Statistics HTML을 서버 수집하고 거래일과 묶음. 브라우저 CDN/공용 프록시 실패가 공식 서버값을 덮지 못함 | IMPLEMENTED_LOCAL, 실제 공식 페이지 파서 확인 |
| SEC 재무 | company ticker map + companyfacts, 24종목 bounded batch, annual period/filing/accession provenance, 원자적 artifact | IMPLEMENTED_LOCAL, 정규화 fixture PASS; 실제 수집은 `SEC_USER_AGENT` 필요 |
| FRED | 기존 무료 키 서버 경로 유지 | CONNECTED |
| BOK ECOS/KOSIS | 기존 client 무료 키 경로 유지 | PARTIAL; server 자동화 미구현 |
| OpenDART | 무료 키 경로로 registry 정정 | PLANNED; key/정정공시/연결·별도 정규화 필요 |
| KRX Open API | 무료 비상업 키 후보 | BLOCKED: 승인·출처·제3자 제공 조건 확정 전 자동 승격 금지 |
| 미국 통합 실시간 시세/NBBO | 무료 동등 경로 없음 | REFERENCE/BLOCKED |
| 한국 실시간 수급·공매도 | 무료 동등 경로 없음 | REFERENCE/BLOCKED |
| AAII/NAAIM/II | 무료 동등 API 없음 | MANUAL/REFERENCE |
| 실시간 옵션 chain/Greeks | 무료 동등 공개·재배포 경로 없음 | EDUCATION ONLY |

## 중복과 누락의 최종 정리

- 중복: 핸드오프 §5와 대체 계획의 공급자 목록, 핸드오프 WP-3/7/14와 v52.92의 breadth/research/rights 작업은 주제가 겹친다. 이 문서를 상태 대조표로 두고 새 병렬 registry는 만들지 않았다.
- 누락 해소: 독립 screener workflow, publish 전 semantic validator, per-row screener lineage, official Cboe delayed ingest, 무료 SEC incremental adapter.
- 아직 누락: BLS/BEA, official event graph, OpenDART server adapter, ECOS/KOSIS server adapter, KRX 승인, PIT/corporate actions, 실제 사람·법률·live 인증.
- 페이지 수: 사용자 표면은 20개다. 자동 QA 22 route는 파생 `ticker/theme-detail`과 호환 reference `options`를 포함한 내부 수이며, 22개 사용자 페이지라는 뜻이 아니다.

현재 공개 판정은 계속 `PUBLIC NO-GO`다. 이번 작업은 무료 공식 원천과 실패 차단을 늘렸지만, 실시간 권리·PIT 연구·법률·사람 인증을 대체하지 않는다.

---

## 1. 이 문서의 사용 목적과 우선순위

이 문서는 단순 감사 보고서가 아니라 **다른 모델이 남은 작업을 추측 없이 순차 실행하기 위한 작업 계약**이다. 기존 핸드오프의 목표 구조와 대체 계획의 공급자 판정을 폐기하지 않고, 현재 저장소 상태·실행 순서·파일 경계·완료 게이트를 한곳에 연결한다.

다른 모델은 아래 순서로 읽는다.

1. `_context/INSTITUTIONAL-DATA-READINESS-HANDOFF-2026-07-12.md`: 최종 목표 구조, WP-0~14, PUBLIC gate.
2. 이 문서: 현재 구현 상태, 다음 작업 순서, 파일·함수·검수 계약.
3. `_context/DATA-SOURCE-REPLACEMENT-PLAN-2026-07-14.md`: 무료 공급자·권리·대체 가능성.
4. `_context/WORKFLOW-GOVERNANCE.md`: 변경 전후 게이트와 검증 표현 규칙.
5. `_context/RULES.md`, `_context/QA-CHECKLIST.md`, `_context/BUG-POSTMORTEM.md`: 코드 수정 시 적용할 회귀 방지 규칙.

문서 간 충돌 시 다음 우선순위를 적용한다.

```text
실제 코드/산출물/Actions/라이브 실측
  > 이 문서의 날짜가 붙은 현재 상태
  > 원본 기관급 핸드오프의 목표 구조
  > 공급자 대체 계획
  > 과거 감사 문서의 historical baseline
```

목표 구조가 현재 구현보다 앞서 있어도 완료로 간주하지 않는다. 각 항목은 반드시 아래 상태 중 하나로 기록한다.

```text
DESIGNED
  -> IMPLEMENTED_LOCAL
  -> VERIFIED_LOCAL
  -> COMMITTED
  -> VERIFIED_ACTIONS
  -> VERIFIED_LIVE
  -> HUMAN_LEGAL_APPROVED
```

중간 단계를 건너뛴 표현을 금지한다. 예를 들어 로컬 fixture PASS는 `VERIFIED_LOCAL`이지 `VERIFIED_LIVE`가 아니다.

## 2. 2026-07-15 인수 시점 Truth Manifest

아래 수치는 다음 모델이 작업 시작 즉시 다시 측정해야 하는 기준선이다. 값이 달라졌으면 새 실측을 우선하고 이 표를 갱신한다.

| 영역 | 인수 기준선 | 판정 |
|---|---|---|
| checkout | `C:\Projects\AIO`, branch `main` | 단일 root checkout |
| Git | `HEAD = origin/main = 01aca353dc97471e230252d89c180fbaa7baaeec` | 인수 시점 원격 기준은 같지만 working tree는 dirty |
| 버전 | `version.json = v52.93` | 로컬 버전 |
| working tree | 앱·데이터·문서 변경 다수와 신규 workflow/script/artifact 존재 | 사용자 작업 보존 필수, 임의 reset/checkout 금지 |
| screener workflow | `.github/workflows/refresh-screener.yml`은 로컬 신규 파일이며 `origin/main`에는 없음 | 커밋·push 전 Actions에서 실행 불가 |
| core quotes | `public-data/data.json`: 77행, `observedAt` 0/77 | producer는 수정됐지만 현재 artifact 재생성 필요 |
| screener | 846/870행, `observedAt` 846/846, factor observation `2026-07-15T00:00:00Z` | 로컬 artifact VERIFIED_LOCAL |
| screener breadth | US 707/725, KR 143/145 eligible; AIO universe research/reference | 공식 거래소 breadth로 표현 금지 |
| fundamentals | 0/725, `fundamentalCoveragePct = 0` | 값·quality 활성화 금지 |
| SEC artifact | `operator_configuration_required`, stored 0 | 사용자가 repository variable 등록을 보고했지만 Actions 수집은 미검증 |
| Cboe Put/Call | 공식 Daily Market Statistics parser와 delayed contract 구현 | 실제 parser 확인, 라이브 publish 미검증 |
| live Pages/Worker | 이번 인수 계약 작성 과정에서는 미검증 | `VERIFIED_LIVE` 주장 금지 |
| 공개 판정 | `PUBLIC NO-GO` | 유지 |

### 2.1 운영 설정의 정확한 분류

| 이름 | GitHub 위치 | 민감도 | 현재 코드 사용 | 운영 계약 |
|---|---|---|---|---|
| `SEC_USER_AGENT` | Actions Repository **Variable** | 비밀 아님. 앱 이름·버전·모니터링 연락처 | `refresh-screener.yml` → `fetch-sec-fundamentals.mjs` | Variable이 맞다. 값·이메일을 로그/문서에 재기록하지 않는다. |
| `FRED_API_KEY` | Actions Repository **Secret** | 비밀 | `refresh-data.yml` | 유지. core macro 실패 시 last-known-good 보존. |
| `TWELVE_DATA_API_KEY` | Actions Repository **Secret**, 선택 | 비밀 | quote fallback | 없으면 `SKIP`, 있어도 출처·지연·권리 표시. |
| `ANTHROPIC_API_KEY` | Actions Repository **Secret**, 선택 | 비밀·비용 발생 | 30분 core refresh의 자동 market analysis | 비용/호출 정책 승인 없이는 필수 데이터 의존성으로 취급하지 않는다. 제거 시 deterministic fallback 유지. |
| `FMP_API_KEY` | Actions Repository **Secret**에 존재할 수 있음 | 비밀 | 무료 전용 기본 workflow에서는 사용하지 않음 | strict free-only이면 삭제 가능. 삭제 전 다른 workflow 참조를 `rg`로 재확인. |
| OpenDART/ECOS/KOSIS/KRX 키 | 미구성 또는 미검증 | 비밀/승인 정보 | server adapter 미구현 | 구현과 운영 설정을 분리. 키가 있다는 이유만으로 CONNECTED 처리 금지. |

GitHub Environment secrets/variables는 현재 workflow가 environment를 선언하지 않으므로 필요 없다. Repository scope를 사용한다. Cloudflare Worker의 Secret/Variable은 GitHub Actions 설정과 별개다.

## 3. 변경 불변식

다른 모델은 모든 Batch에서 아래 불변식을 지킨다.

1. 새 병렬 page/source/evidence registry를 만들지 않는다. 페이지 계약은 `window.AIO_PAGE_CONTRACTS`, 공급자 상태는 기존 source/rights registry를 확장한다.
2. `generatedAt`, `fetchedAt`, `observedAt`, `releaseAt`, `lastSuccessfulAt`, `attemptedAt`을 서로 대체하지 않는다.
3. 실패 응답·빈 응답·낮은 커버리지는 마지막 정상 artifact를 덮지 않는다.
4. `missing`, `zero`, `neutral`, `stale`, `reference`, `blocked`를 구분한다.
5. 무료 공급자 가용성, 코드 구현, Actions 성공, live 소비, 공개 권리를 각각 별도 상태로 기록한다.
6. 공식 원천이 있어도 재배포·상업 표시 권리가 불명확하면 `decisionUse=false` 또는 `REFERENCE`로 유지한다.
7. 시세·팩터·점수의 숫자를 LLM이 생성하거나 보정하지 않는다. 계산은 versioned deterministic function만 수행한다.
8. 20개 사용자 표면과 22개 내부 route를 혼용하지 않는다.
9. 작업 전 dirty 파일 목록을 저장하고, 맡은 파일만 patch한다. 사용자 artifact와 다른 모델의 WIP를 정리 명목으로 삭제하지 않는다.
10. 커밋·push·배포는 사용자 명시 승인 이후에만 수행한다.

## 4. 목표 런타임 구조

새 서비스부터 만드는 것이 목표가 아니다. 현재 정적 GitHub Pages 구조에서 다음 단일 경로로 수렴시킨다.

```text
official/free provider
  -> bounded server adapter
  -> raw response hash + fetch attempt audit
  -> canonical normalized evidence
  -> deterministic calculation evidence
  -> AIO_PAGE_CONTRACTS required producer/minCoverage/failure state
  -> one UI/AI projection
  -> semantic/freshness/rights gate
  -> versioned public-data artifact
  -> CI -> GitHub Pages -> live invariant
```

최소 Evidence 필드는 다음과 같다.

```text
Evidence {
  evidenceId, metricId, entityId, value, unit, currency,
  observedAt, releaseAt?, fetchedAt, lastSuccessfulAt,
  source, sourceKind, sourceUrl?, providerRevision?,
  transformId?, transformVersion?, inputEvidenceIds[],
  coverage, qualityStatus, freshnessStatus, rightsStatus,
  allowedUse, decisionUse, failureReason?
}
```

첫 단계에서 모든 기존 JSON을 한 번에 마이그레이션하지 않는다. WP-1/2/4/9/10에서 소비 빈도가 높은 metric부터 위 필드를 채우고, 호환 adapter를 통해 기존 UI가 읽게 한다. 동일 metric의 새 전역 변수를 추가하는 방식은 금지한다.

## 5. 실행 순서

### Batch 0 — 상태 보존과 활성화 준비

목표: 현재 로컬 구현을 잃지 않고 Actions가 실행 가능한 단위로 만든다.

- `git status --short`, `git diff --name-only`, `git diff --stat`으로 변경 소유 범위를 기록한다.
- `.github/workflows/refresh-screener.yml`, `scripts/fetch-sec-fundamentals.mjs`, `scripts/validate-screener-artifact.mjs`가 실제 commit 대상인지 확인한다.
- `origin/main`에 없는 workflow를 로컬 실행 결과만으로 운영 중이라고 표현하지 않는다.
- 전체 로컬 gate를 통과한 뒤에만 사용자의 커밋/push 승인 단계로 이동한다.

완료 조건: dirty state가 문서화되고, 대상 파일·제외 파일·rollback commit이 명시됨.

### Batch 1 — WP-1 quote artifact + WP-4/11 SEC 실제 활성화

목표: 이미 구현된 producer가 실제 artifact와 Actions에서 동작함을 증명한다.

1. commit/push 후 `Refresh screener and SEC fundamentals`를 수동 실행한다.
2. Actions log에서 `SEC_USER_AGENT` 값 자체가 아닌 `stored/eligible/attempted/updated/failures`만 확인한다.
3. `public-data/sec-fundamentals.json`이 `operator_configuration_required`에서 정상 payload로 전환됐는지 확인한다.
4. `Refresh market data`를 실행해 `public-data/data.json` quote 77행에 `observedAt/fetchedAt/delayedByMs/marketSession/venue/allowedUse`가 생겼는지 확인한다.
5. Pages 배포 뒤 raw JSON과 앱 runtime이 동일 evidence를 소비하는지 확인한다.

SEC는 24종목 bounded batch이고 미국 denominator는 725이므로 80%는 최소 580종목이다. 실패가 없다는 가정에서도 최소 25회의 성공 batch가 필요하며, 6시간 cadence에서는 이론상 약 6.25일이다. 실제 eligible/정규화 실패 때문에 더 길 수 있다. 따라서 첫 성공 run을 80% 완료로 보고하지 않는다.

완료 조건:

- quote `observedAt` 목표 77/77, 최소 허용은 workflow가 요구하는 핵심 quote threshold 이상이며 누락 symbol 공개.
- SEC `status != operator_configuration_required`, `attempted > 0`, failure reason 구조화.
- fundamentals는 coverage 80% 전 `value/quality` decision-use 비활성.
- Actions commit → CI → Pages 배포 연결 확인.

### Batch 2 — WP-2 BLS keyless 원발표 어댑터

목표: FRED와 별개로 미국 물가·고용 원발표를 무료 공식 BLS에서 직접 수집한다.

1차 series allowlist:

| metric | BLS series | 단위/변환 | 소비 페이지 |
|---|---|---|---|
| CPI-U headline SA | `CUSR0000SA0` | index, MoM/YoY는 deterministic 계산 | macro, briefing, signal |
| CPI-U core SA | `CUSR0000SA0L1E` | index, MoM/YoY | macro, briefing |
| unemployment rate | `LNS14000000` | percent | macro, briefing |
| labor force participation | `LNS11300000` | percent | macro |
| total nonfarm payroll | `CES0000000001` | thousands, 월간 차분 | macro, briefing |
| average hourly earnings | `CES0500000003` | USD/hour, MoM/YoY | macro, briefing |

구현 계약:

- 우선 `scripts/fetch-data.mjs` 안에 `fetchBlsSeries()`/`normalizeBlsSeries()`를 추가해 기존 `data.json.macro`와 Evidence 경로에 병합한다. 별도 사용자 소비 artifact나 새 전역 macro registry를 만들지 않는다.
- keyless BLS Public Data API v1/호환 POST 한 번에 allowlist를 요청한다. 미등록 제한을 넘지 않도록 마지막 성공 `fetchedAt`이 12시간 이내이면 네트워크 요청을 건너뛴다.
- BLS 값은 FRED 값의 조용한 대체재가 아니라 별도 official evidence다. 두 값이 같은 metric을 나타내면 observation period·seasonal adjustment·unit을 맞춘 뒤 divergence를 기록한다.
- API가 제공하지 않는 `releaseAt`을 `fetchedAt`으로 채우지 않는다. v1에서는 nullable로 두고 후속 official release-calendar adapter가 채우게 한다.
- `M13`, annual average, preliminary/revised footnote를 일반 월 observation으로 혼합하지 않는다.
- latest/previous/12-month observation이 부족하면 변화율을 계산하지 않고 `insufficient_history`로 차단한다.
- 실패 시 기존 BLS evidence를 보존하고 `attemptedAt/failureReason`만 갱신한다.

필수 gate:

- fixture: 정상 월 series, 역순 응답, `M13`, footnote/revision, 빈 data, 일부 series 실패, 429/5xx.
- 계산 반례: CPI index를 percent로 표시, payroll level을 change로 표시, NSA/SA 혼합, `fetchedAt`을 release date로 표시하면 FAIL.
- `scripts/ci-data-pipeline-contract-check.mjs`에 keyless/bounded/cadence/last-known-good 계약 추가.
- `js/aio-tests.js` 또는 runtime gate에서 macro/briefing의 evidence ID·unit·asOf 일치 확인.

공식 참고: `https://www.bls.gov/developers/`, `https://www.bls.gov/developers/api_faqs.htm`, `https://www.bls.gov/cpi/factsheets/cpi-series-ids.htm`.

### Batch 3 — WP-9 반복 metric 정합성 + WP-10 페이지 완결성

목표: “페이지 계약이 존재함”을 “required producer가 실제 성공함”으로 강화한다.

- `window.AIO_PAGE_CONTRACTS.pages[id]`에 `requiredProducers`, `optionalProducers`, `minCoverage`, `maxAge`, `failureState`, `forbiddenClaims`를 추가한다.
- 기존 `refreshTasks`와 병렬 registry를 만들지 말고 호환 projection으로 유지한다.
- `AIO.getPageDataCompleteness(pageId)`가 producer별 `lastSuccessfulAt/coverage/evidenceIds/status`를 반환하게 한다.
- `AIO.auditPageDataCompleteness({allRoutes:true})`가 22 route를 검사하고 required producer 미성공·낮은 coverage·stale·권리 차단을 구분한다.
- 동일 metric이 여러 페이지에 보이면 아래 §7 identity 계약으로 CI 대조한다.
- visible UI는 `loading`이 영구 지속되지 않고 `loaded | partial | empty | blocked | stale-reference` 중 하나로 종료한다.

완료 조건: 22 route 각각 required/optional/forbidden/failure state가 존재하고, fixture에서 producer 하나를 끊으면 해당 route만 정확히 `partial/blocked`로 바뀜.

### Batch 4 — WP-5/6 공식 이벤트·한국 공식 데이터

순서는 `OpenDART -> ECOS/KOSIS -> official event graph -> KRX 조건부`다.

- OpenDART: 공시 ID, 접수일, 정정/취소, 연결/별도, 사업연도·분기, 원문 URL을 보존한다.
- ECOS/KOSIS: series allowlist와 단위/주기/조정 상태를 코드로 고정하고 server adapter에서 수집한다.
- event graph: SEC/Fed/BLS/BEA/BOK/DART event를 canonical `eventId/entityIds/eventType/scheduledAt/releasedAt/revisedAt/sourceEvidenceIds`로 연결한다.
- KRX: 승인키 발급, 표시 의무, 제3자 제공/Pages 재배포 조건이 확인되기 전에는 구현돼도 PUBLIC source로 승격하지 않는다.

완료 조건: 정정공시 fixture가 이전 값을 silently 유지하지 않고 superseded 연결을 만들며, 한국 페이지가 공식 source 실패 시 Naver 2차 경로를 명시적 `REFERENCE/PARTIAL`로 표시.

### Batch 5 — WP-7/8/12 효능·운영 검증

- live Trading Score와 backtest factor/weight/universe/cost/holding period를 하나의 model manifest로 묶는다.
- point-in-time constituents, delisted, split/dividend, survivorship를 처리하기 전 predictive/public signal claim을 금지한다.
- source별 p95 latency, success rate, stale rate, semantic failure rate, coverage를 기록한다.
- malformed/empty/divergence/bad tick은 quarantine하고 last-known-good를 current action으로 승격하지 않는다.
- notification은 “workflow 성공”이 아니라 required producer/SLO/public gate 실패에 연결한다.

완료 조건: PIT/OOS/cost/turnover/calibration 증거와 live/backtest parity가 없으면 research-only를 자동 유지하고 행동 문구 0.

### Batch 6 — WP-13/14 live·사람·법률 인증

- 20개 사용자 표면과 22개 route의 차이를 유지해 실제 사용자는 20면, 파생/호환 검증은 22 route로 수행한다.
- 데스크톱/모바일, keyboard, screen reader, Chrome/Firefox/WebKit, 초보/숙련 사용자의 정상/partial/timeout/malformed 여정을 기록한다.
- 데이터 source·LLM provider·생성물의 수집/캐시/재배포/상업 이용/보존/지역/삭제 정책을 승인받는다.
- 브라우저 플러그인이 중단되면 HTTP/Playwright를 browser skill 성공으로 대체 보고하지 않는다. 각각의 검증 수단을 정확히 명시한다.

완료 조건: human/legal 서명 artifact와 live release manifest가 없으면 PUBLIC NO-GO 유지.

## 6. WP-0~14 파일 단위 작업 카드

| WP | 다음 원자 작업 | 주 대상 파일/함수 | binary done | rollback |
|---|---|---|---|---|
| WP-0 | semantic publish 차단 live 재검증 | `js/aio-chat.js`, `js/aio-data.js`, Worker, publish validator | invalid model output visible sink 0 | deterministic fallback 고정 |
| WP-1 | quote artifact 재생성·소비 대조 | `scripts/fetch-data.mjs`, `public-data/data.json` | quote observation lineage 충족, Pages raw/runtime 일치 | 마지막 정상 data commit 복원 |
| WP-2 | BLS direct adapter | `scripts/fetch-data.mjs`, data pipeline CI, macro consumers | 6 series 단위/주기/관측일 fixture PASS | BLS producer disable, FRED 유지 |
| WP-3 | PIT breadth 설계 전 research-only 유지 | screener producer/validator | 공식 exchange 표현 0, lineage 100% | 기존 검증 artifact 유지 |
| WP-4 | SEC Actions 활성화·누적 | `fetch-sec-fundamentals.mjs`, workflow, screener enrichment | Actions success + 80% coverage 전 decision-use off | 이전 SEC artifact 보존 |
| WP-5 | canonical official event ID | data adapter + Evidence/Event store | 정정·중복·시간대 fixture PASS | secondary news만 reference 유지 |
| WP-6 | OpenDART/ECOS/KOSIS server adapter | provider adapter, KR consumers | 공식/2차 source 분리, correction 보존 | client fallback을 partial로 유지 |
| WP-7 | live/backtest manifest | backtest scripts, score calculator, model manifest | 동일 입력/가중치/버전 parity | research-only 고정 |
| WP-8 | release manifest와 알림 | CI/workflow/live invariant | app/data/Worker/source revision 추적 | 직전 verified release |
| WP-9 | repeated metric identity audit | `AIO_PAGE_CONTRACTS`, Evidence audit, CI | value/unit/asOf/source/evidence ID 불일치 0 | 변경 producer 비활성 |
| WP-10 | page completeness runtime | page contracts, data readiness UI | 22/22 required producer 상태 증명 | route별 partial state |
| WP-11 | displayed screener count/coverage 대조 | screener renderer/validator | artifact/display/filter count 설명 가능 | table decision-use 차단 |
| WP-12 | SLO/quarantine/last-known-good | refresh scripts, watchdog, runtime audit | injected bad data current-action 사용 0 | verified artifact 재사용 |
| WP-13 | human journey certification | QA artifact, 브라우저/AT matrix | 서명된 task matrix complete | PUBLIC NO-GO |
| WP-14 | rights review | rights registry + 법률 artifact | source별 approved/blocked 명시 | 해당 source 표시 차단 |

각 작업 카드는 PR/세션 시작 시 다음 필드를 채운다.

```text
Packet:
Baseline commit/version:
Owned files:
Excluded dirty files:
Current evidence:
Implementation contract:
Failure fixtures:
Commands/gates:
Local result:
Actions result:
Live result:
Human/legal result:
Status transition:
Rollback:
Remaining blocker:
```

## 7. Cross-page metric identity 계약

아래 metric은 페이지마다 다시 계산하거나 서로 다른 fallback을 조용히 사용하면 안 된다. 한 canonical evidence를 여러 projection이 소비한다.

| metric family | 주요 소비 페이지 | 반드시 같은 것 | 허용되는 차이 |
|---|---|---|---|
| S&P/Nasdaq/KOSPI/KOSDAQ quotes | home, signal, briefing, technical, kr-home, kr-technical | value, currency, observedAt, session, source evidence ID | 표시 자릿수 |
| VIX/VVIX | home, signal, sentiment, technical, options | value, observedAt, sourceKind, freshness | 목적별 threshold 설명 |
| Fear & Greed | home, signal, sentiment, briefing | score, observation, source, stale policy | 요약 문구 |
| breadth | home, signal, breadth, briefing, technical | universe ID, denominator, eligible, observedAt, method | 선택 window(20/50/200) |
| Put/Call | signal, sentiment, options | total/equity/index 구분, trading date, delayed label | 페이지별 선택 ratio |
| US rates/credit | signal, macro, fxbond, briefing | tenor/series, unit(%/bp), observedAt | 변화 기간 |
| FX | home, macro, fxbond, kr-home, kr-macro | pair direction, currency, observedAt | 표시 precision |
| fundamentals | screener, ticker, fundamental, portfolio | filing/accession, FY/TTM, restatement, model | 페이지별 필드 subset |
| news/event | briefing, market-news, ticker, themes, KR pages | canonical event/document ID, publishedAt, source tier | ranking/cluster presentation |
| scores/regime | home, signal, screener, ticker, portfolio | formula/model version, input evidence IDs, missing policy | 목적별 action permission |

CI는 단순 DOM text 비교가 아니라 canonical evidence ID와 semantic identity를 대조한다. 하나의 source가 실패해 페이지별 fallback이 달라지면 `conflict`를 노출하고 강한 결론을 차단한다.

## 8. 22 route 페이지 데이터 완결성 설계

아래 표는 WP-10에서 **기존 `AIO_PAGE_CONTRACTS`에 인코딩할 목표값**이다. 별도 JSON registry로 복제하지 않는다. `required`는 성공하지 않으면 페이지가 partial/blocked여야 하며, `optional` 결측은 명시적으로 숨기거나 설명한다.

| route | required producer | optional | 결측/금지 상태 |
|---|---|---|---|
| `home` | quotes, sentiment, breadth, technicals | news | 핵심 3축 중 하나 stale이면 오늘 행동 결론 차단 |
| `signal` | quotes, sentiment, breadth, technicals, VIX history, HY spread | news | predictive buy/sell claim 금지 |
| `breadth` | screener breadth, quotes | official exchange breadth | denominator/coverage 없는 breadth 금지 |
| `sentiment` | VIX/VVIX, Fear & Greed, HY spread | delayed Cboe, surveys | snapshot survey를 current composite로 승격 금지 |
| `briefing` | quotes, official macro evidence, news/event, sentiment, breadth | AI narrative | 검증 실패 AI narrative 대신 deterministic summary |
| `technical` | quotes, adjusted history, technical calculator | breadth/sentiment | observation 다른 quote/history 혼합 금지 |
| `macro` | FRED + BLS typed macro | BEA/Treasury/news | release/observation/fetch 혼용 금지 |
| `fxbond` | FX/rates/credit quotes + typed macro | news | pair inversion·%/bp 혼용 금지 |
| `fundamental` | selected entity, quote, SEC/DART filing evidence | news/technicals | filing coverage 없으면 valuation/quality 침묵 대신 결측 표시 |
| `themes` | quote/history, theme ranking inputs | news/valuation | stale constituents로 current leader claim 금지 |
| `theme-detail` | selected theme entity, same theme evidence | news | 선택 entity race/고아 route 금지 |
| `portfolio` | user holdings, current quotes, deterministic risk calculator | news/fundamentals | 빈 portfolio에 계산값·배분 권고 표시 금지 |
| `ticker` | selected symbol, quote/history, filings/fundamentals | news | 이전 symbol late response 표시 금지 |
| `market-news` | canonical news/event documents | quotes/sentiment | 번역 실패를 성공·현재 사건으로 표시 금지 |
| `options` | underlying/VIX/delayed PCR evidence | chain/Greeks | live chain 미검증 시 education/reference only |
| `kr-home` | KR index/FX quote, KR dynamic/supply status | news | Naver snapshot을 official real-time로 표현 금지 |
| `kr-supply` | investor-flow evidence + basis date | quote | missing을 0·중립 bar로 변환 금지 |
| `kr-themes` | KR quote/history + theme constituents/ranking | news | 과거 memo를 current catalyst로 표시 금지 |
| `kr-macro` | ECOS/KOSIS typed evidence 또는 명시적 partial fallback | FRED/FX | 주기·단위·발표일 없는 한국 macro 결론 금지 |
| `kr-technical` | KR quote/adjusted history/technical calculator | supply/macro | 미국 symbol/공식과 혼합 금지 |
| `guide` | static versioned content | live examples | live producer 불필요, 고정 예시는 reference/asOf 필요 |
| `screener` | validated screener artifact, universe, coverage, ranking contract | fundamentals | 846/870을 870 complete로 표현 금지, research-only 유지 |

`glossary`는 non-route overlay이며 static versioned content다. 사용자 표면 수는 19개 메뉴 페이지 + glossary overlay = 20개다. `ticker`와 `theme-detail` 파생 뷰, `options` 호환 reference가 자동 QA의 22 route에 포함된다.

## 9. 무료 공급자·fallback·권리 실행표

| family | primary/free | fallback | cadence | 공개/의사결정 계약 | 다음 작업 |
|---|---|---|---|---|---|
| US quotes/EOD | Yahoo server path | Twelve Data 선택, Stooq cross-check 후보 | 30분/core, EOD history | 통합 실시간/NBBO 아님 | quote artifact lineage 재생성 |
| US filings/fundamentals | SEC Companyfacts/Submissions | 이전 verified SEC artifact | 6시간 bounded, row 28일 refresh | filing facts/reference, TTM/estimate 아님 | Actions 활성화·80% 누적 |
| US labor/inflation | BLS Public Data API | FRED 동일 series cross-check | 12시간 gate + release-aware 후속 | official observation, release/vintage 구분 | Batch 2 |
| US national accounts | BEA API | FRED | release-aware | 무료 등록 key 필요 | BLS 다음, key operator card |
| US rates | Treasury official/FRED | quote proxy | daily/release | tenor/unit 고정 | direct adapter 필요성 평가 |
| Put/Call | Cboe Daily Market Statistics | last verified delayed snapshot | daily | delayed/reference, live chain 아님 | live publish 확인 |
| KR filings | OpenDART | 기업 IR/secondary news | filing event | 정정·연결/별도 필수 | server adapter |
| KR macro | ECOS/KOSIS | FRED/curated reference | series cadence | key/series mapping 필요 | server adapter |
| KR EOD | KRX Open API 조건부 | Naver/Yahoo reference | EOD | 승인·재배포 확인 전 PUBLIC 금지 | 운영자/법률 결정 |
| KR live flow | 계약 source 없음 | Naver partial/reference | best effort | 무료 동등 대체 없음 | 확장 중단, 상태 정직화 |
| surveys | AAII/NAAIM/II 공식/수동 | 없음 | weekly | manual/reference | 자동 current score 제외 |
| options chain/Greeks | 권리 있는 공급자 필요 | VIX/PCR 교육 proxy | provider-defined | 무료 동등 공개 경로 없음 | education-only 유지 |
| news/events | official regulator/company RSS + selected RSS | GDELT/secondary | source별 | 원문 권리/번역/중복 분리 | canonical event graph |

## 10. 검증 명령과 증거 기준

문서/코드 변경 범위에 따라 아래를 실행한다. 한 명령의 PASS를 다른 층 검증으로 확대 해석하지 않는다.

```powershell
node --check scripts/fetch-data.mjs
node --check scripts/fetch-sec-fundamentals.mjs
node --check scripts/validate-screener-artifact.mjs
node --check js/aio-core.js
node --check js/aio-data.js
node --check js/aio-chat.js
node scripts/ci-data-pipeline-contract-check.mjs
node scripts/ci-data-lineage-audit.mjs --json
node scripts/validate-screener-artifact.mjs public-data/screener.json
node scripts/ci-runtime-contract-check.mjs
node scripts/ci-structural-check.mjs
node scripts/ci-version-check.mjs
node scripts/ci-semantic-review-check.mjs
node scripts/ci-workflow-compaction-check.mjs
node scripts/ci-knowledge-lint-check.mjs
git diff --check
```

증거 수준:

| 증거 | 인정 상태 | 인정하지 않는 주장 |
|---|---|---|
| syntax/fixture/CI PASS | VERIFIED_LOCAL | 실제 API/브라우저/live 성공 |
| 로컬 HTTP/Playwright | VERIFIED_LOCAL browser-like | 인앱 Browser skill·배포 사이트 검증 |
| GitHub Actions run URL + artifact diff | VERIFIED_ACTIONS | Pages가 새 파일을 서비스함 |
| live raw asset hash/version + runtime/browser | VERIFIED_LIVE | 사람 사용성·법률 승인 |
| signed human/AT matrix | HUMAN_APPROVED | 데이터 권리 승인 |
| source/provider 법률 검토 | LEGAL_APPROVED | 모델 효능·사용성 승인 |

## 11. 커밋·Actions·배포·라이브 검증 절차

이 절차는 사용자가 커밋/배포를 명시 승인했을 때만 실행한다.

1. 대상 변경과 사용자/다른 모델 WIP를 분리한다. `git add -A`를 기본값으로 사용하지 않는다.
2. 로컬 gate와 `git diff --check`를 통과한다.
3. 원자 commit을 만들고 main push 전 origin 최신 상태를 재확인한다.
4. CI/headless/deploy job이 모두 성공했는지 run URL로 기록한다.
5. `refresh-screener.yml`을 수동 dispatch하고 SEC/screener summary를 기록한다.
6. core refresh를 수동 dispatch해 quote observation lineage와 BLS/FRED/뉴스 상태를 확인한다.
7. 자동 데이터 commit이 CI를 거쳐 Pages에 반영됐는지 확인한다. `[skip ci]` 사용 금지.
8. live `version.json`, `public-data/data.json`, `public-data/screener.json`, `public-data/sec-fundamentals.json`의 hash/timestamp/coverage를 원격 commit과 대조한다.
9. 20개 사용자 표면의 loaded/partial/blocked 상태와 22 route 계약을 점검한다.
10. 실패하면 새 값으로 덮어쓰기보다 직전 verified artifact/commit으로 rollback하고 원인을 기록한다.

Rollback은 force-push나 history rewrite가 아니다. 앱은 정상 commit revert, 데이터는 직전 verified artifact를 새 commit으로 복원한다. workflow 장애 시 schedule을 무작정 삭제하지 말고 manual dispatch를 중지하고 실패 원인을 수정한다.

## 12. 중단 조건과 비목표

다음 조건에서는 구현 완료를 주장하지 않고 `BLOCKED` 또는 `SCOPED PARTIAL`로 종료한다.

- 운영자 key/승인/결제/법률 판단이 필요함.
- 무료 공개 API가 제공하지 않는 실시간/NBBO/OPRA/KR 실시간 수급 동등성을 요구함.
- source 권리나 재배포 조건을 확인할 수 없음.
- dirty 사용자 파일과 작업 파일이 충돌해 안전한 부분 patch가 불가능함.
- live/Browser/Actions 접근 없이 외부 상태 검증이 필요함.

비목표:

- 공급자 수를 늘리는 것 자체.
- 작은 무료 proxy를 여러 개 이어 붙여 “기관급”처럼 보이게 하는 것.
- 13개 시안/20개 사용자 표면을 다시 레거시 운영 패널로 채우는 것.
- 점수·팩터를 시장 예측 또는 매수 추천으로 포장하는 것.
- 문서상 registry와 실제 코드 registry를 이중화하는 것.

## 13. 최종 인수 보고 형식

다른 모델은 세션 종료 시 아래 형식으로 보고한다.

```text
Completed packets:
Files changed:
Old path retired:
New/extended single path:
Artifact before -> after:
Coverage before -> after:
Local gates:
Actions run:
Live version/hash:
20 user surfaces checked:
22 routes checked:
Human/legal evidence:
Status transitions:
Still blocked:
Rollback point:
Commit/push/deploy performed: yes/no
PUBLIC verdict: NO-GO/BETA/PUBLIC with exact passed gates
```

“완료”의 최소 의미는 source → adapter → normalized evidence → calculation/decision policy → page/UI/AI projection → artifact/CI → live 중 맡은 범위를 실제 값 하나와 실패 fixture 하나로 추적했다는 것이다. 함수명·workflow 파일·문서가 존재한다는 사실만으로 완료 처리하지 않는다.
