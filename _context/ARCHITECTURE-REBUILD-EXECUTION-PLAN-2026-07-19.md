---
verified_by: Codex (v53.15 repository, contracts, and Chromium evidence)
last_verified: 2026-07-19
confidence: high
auto_refresh: false
target_version: v53.15
status: DESIGNED_EXECUTABLE
parent: ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md
scope: whole-system architecture execution

## Current ARX-09~16 checkpoint (2026-07-19)

The local implementation now includes entity, portfolio, screener, analysis,
pure domain, AI, privacy vault, release, and retirement boundaries. All 17
route lifecycle/renderer modules are registered natively; compatibility input
is read-only through the facade. Full §8.1 validation remains intentionally
deferred until this packet sequence is complete, then runs as one batch.
---

# AIO 전체 아키텍처 재구축 실행 핸드오프

## 0. 이 문서의 역할

`ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md`가 목표 구조와 AR-00~09의 상위 SSOT라면, 이 문서는 **다른 세션이 한 배치씩 실제 코드를 교체하고 삭제하기 위한 실행 원장**이다. 신규 파일·CI·MJS 개수는 진척으로 계산하지 않는다. 다음 세 가지가 같은 배치에서 확인될 때만 진척이다.

1. 새 계층이 브라우저 실행 소유권을 가진다.
2. 대응 legacy owner/writer/hook/fetch/storage/HTML sink가 삭제된다.
3. 삭제와 소유권이 계약·브라우저 게이트로 다시 돌아오지 못하게 고정된다.

현재 checkout은 `main` HEAD `644c105`, 작업 버전은 `v53.15`이며 v53.15 변경은 아직 커밋·배포되지 않은 상태에서 작성됐다. 새 세션은 이 상태를 사실로 가정하지 말고 반드시 `git status --short`, `git rev-parse --short HEAD`, `version.json`을 다시 읽는다.

## 1. 완료 상태 정의

| 상태 | 의미 |
|---|---|
| `DESIGNED` | 목표·파일·삭제 대상만 정의됨 |
| `BASELINED` | 호출자·writer·DOM·데이터·테스트를 코드에서 재측정함 |
| `IN_PROGRESS` | 새 owner와 legacy owner가 잠시 병존함 |
| `VERIFIED_LOCAL` | 새 owner 실행, legacy 삭제, burn-down, 전체 로컬 회귀 통과 |
| `VERIFIED_LIVE` | 배포 revision 일치와 실제 provider 성공/실패 상태까지 검증 |
| `RETIRED` | compatibility export와 legacy path가 코드·manifest·문서에서 제거됨 |

`src/` 파일이 있다는 이유로 `VERIFIED_LOCAL`을 표시하지 않는다. Renderer가 legacy면 route는 legacy owner다. Observer만 붙은 route도 native route가 아니다.

## 2. 계층별 현재 상태와 목표

상위 handoff의 12개 구조면을 실행 시 누락이 생기지 않도록 state와 evidence, UI와 domain을 분리한 14개 실행 계층(L00~L13)으로 세분화한다. 범위가 늘어난 것이 아니라 같은 전체 시스템을 더 촘촘하게 나눈 것이다.

| ID | 계층 | 현재 실체 | 목표 owner | 상태 | 다음 핵심 삭제/검증 |
|---|---|---|---|---|---|
| L00 | 앱 셸·부트 | `index.html` 28,381줄, runtime inline script 11개, legacy defer bundle + ESM bootstrap | `src/app/bootstrap` + build/static shell | `IN_PROGRESS` | inline runtime 11→0, shell에는 metadata/mount/accessibility만 남김 |
| L01 | 라우터·생명주기 | legacy `showPage/PAGES/PageBus`, ESM router 병존; sentiment lifecycle만 ESM | typed route registry와 page resource bag | `IN_PROGRESS` | route별 init hook·wrapper 삭제, mount/dispose 단일 호출자, 왕복 resource 증가 0 |
| L02 | 명령·상태·selector | `AIO.state`, `_liveData`, `DATA_SNAPSHOT`, DOM, 여러 Store 병존; ESM state는 sentiment/snapshot 일부 | typed commands + canonical slices + selectors | `IN_PROGRESS` | DOM→state 금지, metric별 writer 1개, legacy projection read-only |
| L03 | 저장소·캐시 | Vault/safeLS와 직접 Web Storage 189건 병존 | versioned repository + storage/vault gateway | `DESIGNED` | gateway 밖 direct storage 0, migration/rollback fixture |
| L04 | 데이터 provider·orchestration | direct fetch 42건, legacy producer가 DOM·global도 갱신; snapshot/evidence 계약 일부 존재 | provider adapter→normalize→quality→evidence ingest | `IN_PROGRESS` | 첫 slice direct fetch/global/DOM writer 삭제, 실패 시 LKG 보존 |
| L05 | Evidence·freshness·lineage | typed evidence와 field-time 계약 존재하지만 legacy DOM audit/전역 projection 병존 | canonical EvidenceStore와 ingest ledger | `IN_PROGRESS` | UI·chart·AI evidence ID 동일, DOM에서 evidence 생성 0 |
| L06 | 금융 domain·quant | 대다수 계산이 `aio-core/data/ui`에서 전역·DOM과 결합; sentiment pure module만 존재 | pure domain services + model/input version | `IN_PROGRESS` | live/backtest fixture parity, missing/zero/neutral/stale 분리 |
| L07 | UI·component·chart·narrative | native renderer 1/17, HTML sink 418건, 거대 상주 DOM | route-local page/component/chart modules | `IN_PROGRESS` | sentiment native renderer 후 16개 legacy renderer·HTML writer·chart init 삭제 |
| L08 | AI·retrieval·WebSearch | typed claim/policy scaffold는 있으나 `aio-chat.js` 6,084줄이 context/provider/storage/render를 소유 | context/retrieval/provider/policy/response 분리 | `IN_PROGRESS` | 모든 진입점 동일 envelope/gate, provider·DOM·storage 직접 접근 제거 |
| L09 | 보안·프라이버시 | DOMPurify/SRI/Vault/Worker gate 존재, 넓은 sink와 inline script로 강한 CSP 곤란 | central sanitizer, vault, Worker cost/abuse boundary | `IN_PROGRESS` | 승인 sink allowlist, inline script 0 후 CSP, secret/client boundary E2E |
| L10 | SW·asset·release | 수동 cache/version surface와 앱·데이터 revision 병존 | build manifest + immutable app assets + 독립 data revision | `IN_PROGRESS` | manifest 기반 precache, app/data/worker mismatch와 rollback 검증 |
| L11 | 테스트·관측·성능 | 강한 legacy E2E 1101개와 route matrix 존재, pure/component/leak 계측 부족 | unit/contract/component/E2E + telemetry budget | `IN_PROGRESS` | dependency/single-writer/resource-leak/evidence-parity blocking |
| L12 | 운영·워크플로 | durable plane CURRENT, fast plane OPERATOR_REQUIRED, reconciliation PARTIAL | 독립 fast/durable plane + SLO/rights ledger | `IN_PROGRESS` | Cloudflare 설정·권리·7일 soak 없이는 VERIFIED_LIVE 금지 |
| L13 | 문서·거버넌스 | 상위 handoff/ADR/RULES/QA 존재, 과거 진단서 다수 | architecture/ADR/runbook + 이 실행 원장 | `IN_PROGRESS` | 배치마다 owner/deletion/status 갱신, 종료 시 과거 handoff archive |

2026-07-19 ARX-01~06 진행 후 실측 burn-down은 `explicitWindowWrites=1094`, `directFetch=42`, `directStorage=189`, `htmlSinks=416`이다. 운영 공개 상태는 `nativeLifecycleOwner=['briefing','guide','market-news','sentiment']`, `nativeRendererOwner=['briefing','guide','market-news','sentiment']`, `legacyOwner=13`, `nativeOwner=[]`이다.

### 2.1 확인 깊이

각 계층은 파일 존재만 본 것이 아니라 다음 경계를 함께 확인한다.

- **입력**: provider/artifact/user/event가 어떤 schema와 freshness로 들어오는가
- **명령**: 누가 fetch·저장·계산·route transition을 시작하는가
- **상태**: canonical writer와 legacy projection이 누구인가
- **파생**: domain 계산과 selector가 외부 효과로부터 분리됐는가
- **출력**: DOM·chart·narrative·AI가 같은 evidence를 쓰는가
- **생명주기**: mount/refresh/dispose에서 listener/timer/chart/AbortController가 정리되는가
- **운영**: app/data/worker revision, provider rights, scheduler, LKG, rollback이 구분되는가
- **검증**: unit/contract/browser/live 중 어느 증거까지 있는가

정적 코드·로컬 Chromium·artifact 계약은 확인했다. 실제 Cloudflare 자원, 장중 fast-plane SLO, 공급자 권리, 장시간 heap/listener soak, 모든 조건부 route 성공 입력은 아직 확인하지 않았다.

## 3. 배치 공통 실행 규칙

각 세션은 아래 순서를 바꾸지 않는다.

1. `RULES.md`, `CODE-MAP.md`, 상위 handoff, 이 문서, 대상 계층 하위 문서를 읽는다.
2. 대상 route/metric의 `producer → normalize → state/evidence → selector/domain → DOM/chart/narrative/AI`를 1:1로 적는다.
3. 수정 전에 `DELETE-LEDGER`를 만든다. 함수, 호출부, global writer, DOM sink, event hook, timer/chart, storage key, test를 포함한다.
4. 새 owner를 연결하되 legacy와 장기간 병렬 운영하지 않는다.
5. 같은 배치에서 삭제 원장을 실행하고 카운터가 실제 감소했는지 확인한다.
6. route 단위 게이트 후 전체 regression을 실행한다.
7. operations status와 이 문서의 상태를 실제 renderer/lifecycle/data owner 기준으로 갱신한다.

금지 사항:

- 삭제 대상이 0개인 architecture migration 배치
- observer/facade만 추가하고 native renderer로 표시
- legacy fetch를 둔 채 같은 provider adapter를 병렬 추가
- Store dispatch만 하고 reducer/consumer를 검증하지 않음
- DOM을 다시 읽어 canonical state/evidence 생성
- 전체 파일 재작성 또는 ±500줄 이상 이동 후 CODE-MAP 미갱신
- 외부 운영 증거 없이 `VERIFIED_LIVE` 표시

## 4. 전체 의존 순서와 실행 파동

```text
W0 ownership baseline (v53.15 완료)
  -> W1 sentiment full vertical cutover
      -> W2 shared platform/state/evidence adoption
          -> W3 low-risk/static/content routes
          -> W4 market/macro/chart routes
          -> W5 entity/portfolio/screener routes
          -> W6 signal/home orchestration routes
      -> W7 domain/live-backtest parity
      -> W8 AI/retrieval/security cutover
      -> W9 storage/privacy cutover
  -> W10 shell/build/SW/release cutover
  -> W11 legacy zero + live certification + document archive
```

| Wave | 실행 패킷 | 선행 조건 | 완료 증거 |
|---|---|---|---|
| W0 | ARX-00 owner/burn-down 기준선 | 없음 | v53.15: sentiment lifecycle, global 1110→1109 |
| W1 | ARX-01 sentiment renderer, ARX-02 sentiment data writer | W0 | sentiment native renderer·state/evidence, legacy init/fetch/DOM writer 삭제 |
| W2 | ARX-03 commands/selectors, ARX-04 HTTP/storage/sanitizer adoption | W1 | 첫 slice direct network/storage/HTML sink 0 |
| W3 | ARX-05 guide, ARX-06 market-news+briefing | W2 | low-risk route 3개 renderer cutover, content/narrative evidence 계약 |
| W4 | ARX-07 macro+fxbond+breadth, ARX-08 themes+theme-detail | W2 | chart series provenance·dispose·route input 계약 |
| W5 | ARX-09 ticker+fundamental+options, ARX-10 portfolio+screener | W2/W9 일부 | entity cancellation, vault boundary, table virtualization/partial state |
| W6 | ARX-11 technical+signal+home | W4/W5/W7 | 최종 파생·오케스트레이션 route의 legacy owner 삭제 |
| W7 | ARX-12 domain engines와 live/backtest parity | W1 이후 병렬 가능 | modelVersion/inputVersion/fixture parity |
| W8 | ARX-13 AI context/retrieval/provider/policy/response | canonical evidence와 route owner | 모든 AI 진입점 동일 manifest와 output gate |
| W9 | ARX-14 storage/vault/privacy migration | W2 | direct storage 0, migration/rollback E2E |
| W10 | ARX-15 shell/build/asset/SW/release | native renderer 다수 확보 후 | inline runtime 0, manifest build, revision/rollback E2E |
| W11 | ARX-16 compatibility removal/live certification | W3~W10 완료 | legacy owner 0, facade 승인 API만, live SLO/rights 증거 |

TypeScript/Vite는 목표가 아니라 경계 강제 수단이다. W1에서 native ESM으로 완전한 수직 slice를 먼저 증명한 후 ADR-0002에서 `native ESM 유지`와 `Vite+TypeScript 전환`을 비교한다. 빌드 도구 도입만으로 W10 완료를 표시하지 않는다.

## 5. 17 route 세부 전환 원장

| 순서 | Route | 현재 owner | 주요 계층·위험 | 선행 | 반드시 삭제할 legacy 범주 |
|---|---|---|---|---|---|
| 1 | sentiment | ESM lifecycle·renderer / legacy data writer | F&G·VIX·PutCall·HY, chart, refresh | W0 | `initSentimentPage`, facade mount map, legacy chart registry·refresh hook; producer DOM writer는 ARX-02 |
| 2 | guide | legacy renderer | 정적 콘텐츠, navigation, 접근성 | W2 | PAGES init/inline event·불필요 observer |
| 3 | market-news | legacy renderer | news artifact, filter, translation, XSS | W2 | legacy list renderer·direct sink·route hook |
| 4 | briefing | legacy renderer | current narrative, news/metric claims, AI | market-news | legacy briefing renderer·중복 claim writer |
| 5 | macro | legacy renderer | FRED series, yield curve, mixed cadence | W2/W7 | route fetch/DOM writer·chart init·global macro projection |
| 6 | fxbond | legacy renderer | FX/rates series, commentary, 2 charts | macro | duplicated series fetch/HTML commentary/chart hooks |
| 7 | breadth | legacy renderer | screener breadth/history, 2 charts | W2/W7 | init wrapper·DOM audit writer·chart/timer hook |
| 8 | themes | legacy renderer | RRG history, relative-strength domain | breadth/W7 | legacy RRG hydration/render hook |
| 9 | theme-detail | legacy renderer | required route input, redirect, chart/detail | themes | implicit global selected-theme state·fallback redirect writer |
| 10 | ticker | legacy renderer | entity input, abort/race, quote/fundamental | W2 | global selected ticker·uncancelled fetch·direct renderer |
| 11 | fundamental | legacy renderer | SEC/FMP partial coverage, filing evidence | ticker | provider-specific UI writer·duplicate entity cache |
| 12 | options | legacy renderer | key/chain required, partial/unavailable state | ticker | direct provider/DOM path·implicit selected symbol |
| 13 | portfolio | legacy renderer | encrypted user state, CRUD, privacy | W9 | direct storage·legacy vault projection·global portfolio writer |
| 14 | screener | legacy renderer | large table, artifact revision, filters | W2/W7 | global filter/result writer·full-table HTML rewrite |
| 15 | technical | legacy renderer | OHLCV, indicators, chart lifecycle | W7 | duplicated technical calculations·chart/global cache writer |
| 16 | signal | legacy renderer | domain aggregation, fail-closed decision text | W4/W5/W7 | legacy score/narrative writer·route refresh hook |
| 17 | home | legacy renderer | 모든 slice 집계, first-paint/performance | 나머지 route | global dashboard refresh·duplicated summary writer·legacy init |

Route 완료 체크는 다섯 칸을 별도로 기록한다: `lifecycleOwner`, `rendererOwner`, `dataOwner`, `chartOwner`, `narrativeOwner`. 다섯 칸 중 하나라도 legacy면 `nativeOwner`로 집계하지 않는다.

### 5.1 다음 세션의 첫 패킷: ARX-01 sentiment renderer

수정 전 확인 범위:

- `CODE-MAP.md`의 `page-sentiment`, `initSentimentPage`
- `index.html`의 `page-sentiment` DOM(현재 약 6,888~7,040)
- `js/aio-ui.js`의 sentiment chart/renderer 영역(현재 `initSentimentPage` 약 217행부터)
- `js/aio-data.js`의 F&G/PutCall/HY/VIX producer 및 DOM writer
- `src/ui/pages/sentiment.js`, `src/domain/sentiment/metrics.js`, evidence/state/platform 계층

구현 목표:

1. `src/ui/pages/sentiment/`가 카드·상태·차트 mount/dispose를 소유한다.
2. UI는 typed selector/evidence만 읽고 fetch/storage/global을 읽지 않는다.
3. Chart 인스턴스·observer·listener는 resource bag에 등록한다.
4. legacy renderer는 facade에서 제거하고 `initSentimentPage`와 전용 helper/callers를 삭제한다.
5. F&G/VIX/PutCall/HY의 누락·stale·partial·observed fixture를 각각 렌더한다.

ARX-01 `DELETE-LEDGER` 최소 항목:

- `src/legacy/compatibility-facade.js`의 `sentiment: 'initSentimentPage'`
- `js/aio-ui.js`의 `initSentimentPage`와 전용 chart init/refresh 호출부
- sentiment route에 남은 PAGES/showPage/pageShown init 경로
- 새 renderer가 대체한 `innerHTML/textContent/className` legacy writer
- 삭제된 함수만을 단언하는 legacy 테스트와 stale CODE-MAP 참조

ARX-01은 producer 전체 교체까지 한 번에 넓히지 않는다. Legacy producer projection을 임시 입력으로 쓸 경우 facade 안 read-only adapter로 명시하고 ARX-02 삭제 대상으로 등록한다. Renderer 완료를 data owner 완료로 오표시하지 않는다.

## 6. 교차 계층 패킷의 파일·인수 기준

| 패킷 | 주요 파일/목표 | 인수 기준 |
|---|---|---|
| ARX-02 Data writer | `src/data/providers|normalize|orchestrators`, evidence contracts, legacy producer 삭제 | 해당 metric provider→evidence 단일 writer, UI/chart/AI 동일 revision |
| ARX-03 State/command | `src/state/slices`, selectors, application commands | reducer가 모든 command 소비, derived state 저장 0, DOM→state 0 |
| ARX-04 Platform | `src/platform/http/storage/sanitizer/telemetry/clock` | 대상 slice direct fetch/storage/HTML sink 0, timeout/abort/fixture |
| ARX-12 Domain | `src/domain/market|macro|technical|portfolio|screener|news` | DOM/provider import 0, model/input version, live/backtest fixture parity |
| ARX-13 AI | `src/ai/context|retrieval|provider|websearch|policy|response` | unified/per-page/retry/translation/briefing 동일 envelope와 policy |
| ARX-14 Storage | versioned repository와 migration registry | direct storage 0, Vault opt-in/out/reload/migration/rollback 8+ E2E |
| ARX-15 Release | app shell, build config, asset manifest, `sw.js`, workflows | hashed immutable asset, app/data/worker revision 분리, rollback 재현 |
| ARX-16 Retirement | facade, global projections, PageBus, legacy bundles/docs | approved public API 외 globals 0, renderer owner 17/17 native, inline runtime 0 |

ARX-07 데이터 운영 세부는 `AUTOMATED-DATA-RELIABILITY-HANDOFF-2026-07-18.md`, ARX-13 AI 위험·검증 세부는 `AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md`를 하위 계약으로 사용한다. 동일 내용을 새 문서에 복제하지 않는다.

## 7. 세션 작업 카드

다른 세션은 시작할 때 아래 카드를 복사해 실제 값으로 채운다.

```text
Packet: ARX-__
Checkout/HEAD/version/liveRevision:
Scope route/metric/layer:
Owner before: lifecycle / renderer / data / chart / narrative
Owner after:  lifecycle / renderer / data / chart / narrative
Files read:
Files changed:
DELETE-LEDGER before edit:
  - declaration
  - callers
  - global writer
  - DOM/chart/narrative sink
  - event/timer/storage
  - tests/docs
Burn-down before/after:
New compatibility introduced and retirement packet:
Local gates:
Browser evidence:
Live evidence:
Unverified/blockers:
Status: DESIGNED|BASELINED|IN_PROGRESS|VERIFIED_LOCAL|VERIFIED_LIVE|RETIRED
```

한 세션은 기본적으로 route packet 하나 또는 cross-layer slice 하나만 소유한다. 여러 route를 동시에 바꿀 때는 공유 owner 삭제가 명확하고 각 route rollback이 독립적일 때만 허용한다.

## 8. 실행 게이트

### 8.1 모든 배치에서 즉시 실행

```powershell
node scripts/ci-architecture-contract-check.mjs
node scripts/ci-architecture-browser-check.mjs
node scripts/ci-operations-status-check.mjs
node scripts/ci-version-check.mjs
node scripts/ci-structural-check.mjs
node scripts/ci-runtime-contract-check.mjs
node scripts/ci-semantic-review-check.mjs
node scripts/ci-headless-tests.mjs
node scripts/ci-critical10-human-surface-check.mjs
node scripts/ci-accessibility-matrix-check.mjs
$env:AIO_VIEWPORT_FULL_INIT='1'; node scripts/ci-viewport-matrix-check.mjs
git diff --check
```

### 8.2 해당 계층 진입 시 만들어야 하는 blocking gate

| Gate | 도입 시점 | Yes 조건 |
|---|---|---|
| AG-DEP | 첫 domain 이동 | domain의 DOM/fetch/storage/provider import 0 |
| AG-WRITER | 첫 state slice 완료 | metric/state writer가 manifest당 정확히 1개 |
| AG-RESOURCE | 첫 native chart renderer | A→B→A 반복 후 listener/timer/chart/observer delta 0 |
| AG-EVIDENCE | 첫 data owner 완료 | UI/chart/AI evidenceId·value·unit·observedAt 일치 |
| AG-STORAGE | ARX-14 | gateway 밖 Web Storage/IndexedDB 0 |
| AG-HTML | 첫 component renderer | approved renderer/sanitizer 밖 dynamic HTML sink 0 |
| AG-MODEL | ARX-12 | live/backtest modelVersion/inputVersion 및 fixture 결과 일치 |
| AG-RELEASE | ARX-15 | app/data/evidence/worker/SW revision mismatch 0, rollback PASS |
| AG-LEGACY | 매 배치 | 선언한 counter 감소 및 DELETE-LEDGER 패턴 재등장 0 |

새 gate만 추가하고 실제 owner/debt가 줄지 않은 배치는 실패다. 기존 architecture gate의 burn-down 목표를 먼저 갱신하고 실제 코드 감소와 함께 제출한다.

## 9. 전체 재구축 최종 인수 기준

다음 항목이 모두 Yes일 때만 `ARCHITECTURE_REBUILT`로 승격한다.

| ID | Yes 조건 |
|---|---|
| AC-01 | 17 route의 lifecycle/renderer/data/chart/narrative owner가 모두 manifest에 있고 legacy owner 0 |
| AC-02 | `index.html` runtime inline script 0, metadata/mount/accessibility shell만 존재 |
| AC-03 | facade 밖 신규/legacy global writer 0 또는 ADR 승인 public API allowlist만 존재 |
| AC-04 | provider/HTTP gateway 밖 direct fetch 0 |
| AC-05 | storage/vault gateway 밖 direct storage 0 |
| AC-06 | approved renderer/sanitizer 밖 dynamic HTML sink 0 |
| AC-07 | canonical state/evidence 밖 시장·포트폴리오·AI writer 0 |
| AC-08 | domain이 DOM/network/storage/provider와 독립되고 live/backtest parity PASS |
| AC-09 | UI·chart·narrative·AI가 같은 evidence ID/freshness/revision 사용 |
| AC-10 | route 반복 전환과 30분 soak에서 resource/heap 증가가 예산 내 |
| AC-11 | app/data/evidence/worker/SW revision과 rollback을 재현 가능 |
| AC-12 | Tier 0 fast/durable SLO, provider rights, LKG, reconciliation이 VERIFIED_LIVE |
| AC-13 | 전체 static/headless/viewport/a11y/vault/security/live invariant PASS |
| AC-14 | compatibility facade·PageBus·legacy projections가 제거되거나 ADR 승인 API만 남음 |
| AC-15 | architecture/ADR/runbook/이 실행 원장이 active SSOT이고 과거 중복 handoff가 archive됨 |

## 10. 현재 검증된 것과 검증되지 않은 것

검증됨:

- v53.15 local architecture/operations/version/release 계약
- explicit global writer 1110→1109 실제 감소
- ARX-01 native renderer cutover에서 explicit global writer 1109→1100 추가 감소; ARX-02/03 진행 중 VIX legacy narrative/chart·producer HTML sink·중복 snapshot projection을 삭제해 1100→1097 및 420→418 추가 감소
- sentiment router/store route, ESM lifecycle/badge, route 왕복, browserErrors 0
- headless 1101/1101, Critical-10 10/10, a11y 17/17, viewport 68/68, Vault 8/8
- durable Tier 0 snapshot 16/16과 fail-closed/LKG 계약

검증되지 않음:

- native renderer 17개 중 어느 것도 완료되지 않음
- direct fetch/storage/HTML sink의 전체 gateway 전환
- `index.html` runtime island와 legacy bundle 제거
- 모든 domain의 pure/live-backtest parity
- AI legacy module 전체 분해와 live model quality/red-team
- Cloudflare fast plane credential/resource/7-day 99% soak
- provider redistribution rights, SEC 80% coverage
- 장시간 resource/heap soak, 키보드·스크린리더 실사

## 11. 다음 세션 시작 지시

첫 후속 세션은 **ARX-01 sentiment renderer만** 수행한다. 이번 패킷의 실행 결과는 다음과 같다.

1. dirty checkout을 보존하고 v53.15 변경 존재 여부를 확인했다.
2. `CODE-MAP.md`와 §5.1 범위를 실제 줄 번호로 재측정했다.
3. `initSentimentPage` 선언·전용 helper·호출부·차트 registry를 inventory했다.
4. DELETE-LEDGER를 실행해 facade mount map, legacy init/chart helper, data chart back-reference, legacy-only tests를 제거했다.
5. `src/ui/pages/sentiment.js`가 카드·상태·차트·resource bag lifecycle을 소유하도록 cutover했다.
6. 대응 legacy renderer를 삭제하고 facade에서 sentiment mount를 제거했다. ARX-02에서는 producer의 compatibility projection/event와 native evidence writer를 연결했다.
7. architecture counter와 operations route owner를 갱신했다: explicit global writes 1109→1097, HTML sinks 420→418, native renderer owner `sentiment`, legacy renderer owner 17→16.
8. 전체 §8.1 게이트는 모든 ARX 패킷 완료 후 실행한다. 현재 패킷은 syntax·retired-symbol 정적 확인만 완료한다.

이번 세션 카드:

```text
Packet: ARX-01
Checkout/HEAD/version: 644c105 / v53.15 (dirty baseline preserved)
Scope route/metric/layer: sentiment / F&G·VIX·PutCall·HY·AAII / renderer·chart lifecycle
Owner before: lifecycle ESM / renderer legacy / data legacy / chart legacy / narrative legacy
Owner after:  lifecycle ESM / renderer native / data legacy read-only adapter / chart native / narrative native
Files changed: src/ui/pages/sentiment.js, src/app/bootstrap.js, src/legacy/compatibility-facade.js, js/aio-ui.js, js/aio-data.js, js/aio-core.js, js/aio-tests.js, scripts/ci-architecture-*.mjs, scripts/build-operations-status.mjs, public-data/operations-status.json, CODE-MAP.md
DELETE-LEDGER: facade sentiment mount; initSentimentPage; sentiment chart helpers/registry; data chart back-reference; legacy-only tests; stale CODE-MAP symbols
Burn-down before/after: explicitWindowWrites 1109→1097; directFetch 42→42; directStorage 189→189; htmlSinks 420→418
Local gates: node --check (native modules) PASS; full §8.1 deferred until all packets complete
Browser evidence: deferred until all packets complete
Live evidence: not claimed; provider/Cloudflare evidence remains external
Status: VERIFIED_LOCAL (ARX-04 platform adoption remains)
```

### 2026-07-19 follow-up checkpoint: ARX-02 gateway and guide preparation

ARX-04 platform boundary is active for new ESM code: HTTP, storage, sanitizer, clock, and telemetry gateways are the only approved platform contracts; the sentiment, guide, and news native modules contain no direct fetch/storage/HTML sink.

Operations owner state is `nativeLifecycleOwner=['briefing','guide','market-news','sentiment']`, `nativeRendererOwner=['briefing','guide','market-news','sentiment']`, `legacyOwner=13`, and `nativeOwner=[]`; data and narrative ownership remain legacy until their later packets.

The current measured counters are `explicitWindowWrites=1094`, `directFetch=42`, `directStorage=189`, and `htmlSinks=416`. Legacy sentiment producers now notify the canonical `AIO_ARCH.ingestSentiment` evidence/state writer for F&G, Put/Call, and HY updates. ARX-02 and ARX-04 are locally closed for the new ESM slice. Guide, market-news, and briefing now have native route modules plus a `data/news` state writer. ARX-07/08 now have shared normalized market/theme states consumed by macro/fxbond/breadth/themes/theme-detail slice renderers; full route ownership remains pending. ARX-09~16 remains active for entity, domain, AI, storage, release, and retirement work. Full §8.1 validation remains deferred until all packets are finished.

후속 진행 중인 ARX-02/03은 provider·normalize·orchestrator와 state slice/selector/command 경계를 연결하고 VIX legacy narrative/chart hook, F&G/HY/PutCall의 일부 legacy DOM sink, dead F&G/crypto HTML renderer, renderer 전용 T879, 중복 snapshot projection을 삭제했다. legacy producer의 전체 gateway 전환과 남은 cross-route writer 검증이 남아 있으므로 ARX-02는 완료로 표시하지 않는다.

커밋·푸시·배포는 사용자의 명시 지시가 있을 때만 수행한다.
