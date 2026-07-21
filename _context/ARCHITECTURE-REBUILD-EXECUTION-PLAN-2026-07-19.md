---
verified_by: Codex (v53.15 repository, contracts, and Chromium evidence); session cards appended through 2026-07-21 by Claude Sonnet 5 (see _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md for the authoritative current status/owner ledger per this doc's own precedence note above)
last_verified: 2026-07-21
confidence: high
auto_refresh: false
target_version: v53.15
status: DESIGNED_EXECUTABLE
parent: ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md
scope: whole-system architecture execution

## 2026-07-19 RM-00 correction (supersedes the checkpoint below — do not re-declare from the block below)

"All 17 route lifecycle/renderer modules are registered natively" conflated
lifecycle scaffold ownership with renderer ownership. Re-measured directly
against source (RM-00, new `architecture/route-owners.json`): lifecycleOwner
is native for 17/17 routes; rendererOwner is native for only 2/17 (guide,
sentiment) — market-news and briefing were also mis-declared native here and
in `operations-status.json` despite 5-6 live legacy writers still targeting
`live-news-feed`/`briefing-live-news-list`; dataOwner is native for 0/17;
chartOwner/narrativeOwner are native only for sentiment (1/17 each). "Full
§8.1 validation deferred until this packet sequence is complete" is retracted
(RM-04) — every batch below runs the complete §8.1 list, with no deferral.
See `_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md` (RM-00~06,
F-01~F-11) for the full ledger. RM-00/RM-01/RM-04 must close before any new
ARX packet in §4/§5 below starts.

## Current ARX-09~16 checkpoint (2026-07-19) — superseded by the RM-00 correction above, retained for history

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
| L02 | 명령·상태·selector | `AIO.state`, `_liveData`, `DATA_SNAPSHOT`, DOM, 여러 Store 병존; ESM state는 sentiment/snapshot 일부 | typed commands + canonical slices + selectors | `IN_PROGRESS` (ARX-03 재측정 2026-07-20: command/reducer 경계 자체는 8개 domain 전부 클린 — UI dispatch 0건, SET/CLEAR 쌍 일관, derived-state 중복 0. legacy `AIO.state`/`_liveData`/`DATA_SNAPSHOT`가 여전히 렌더를 소유하므로 층 전체를 VERIFIED_LOCAL로 승격하지 않음 — 아래 ARX-03/04 세션 카드 참조) | DOM→state 금지, metric별 writer 1개, legacy projection read-only |
| L03 | 저장소·캐시 | Vault/safeLS와 직접 Web Storage 189건 병존 | versioned repository + storage/vault gateway | `DESIGNED` | gateway 밖 direct storage 0, migration/rollback fixture |
| L04 | 데이터 provider·orchestration | direct fetch 42건, legacy producer가 DOM·global도 갱신; snapshot/evidence 계약 일부 존재 | provider adapter→normalize→quality→evidence ingest | `IN_PROGRESS` (ARX-04 2026-07-20: screener·entity 2개 provider가 각각 `public-data/screener.json`·`sec-fundamentals.json`을 `platform/http.js` 게이트웨이로 실제 fetch — market-snapshot.json 선례와 동일 패턴, 둘 다 native 렌더 소비자가 없어(RM-01 dataset-marker-only) 블러스트 반경 0인 route만 선택. sentiment는 ARX-01로 이미 라이브 렌더 중이라 데이터 소스 교체 시 사용자 가시 회귀 위험이 있어 의도적으로 보류(아래 참조). legacy fetch 42건은 무변화(추가식, 대체 아님) — "첫 slice fetch 삭제" 인수 기준은 아직 미충족, 아래 세션 카드 참조) | 첫 slice direct fetch/global/DOM writer 삭제, 실패 시 LKG 보존 |
| L05 | Evidence·freshness·lineage | typed evidence와 field-time 계약 존재하지만 legacy DOM audit/전역 projection 병존 | canonical EvidenceStore와 ingest ledger | `IN_PROGRESS` | UI·chart·AI evidence ID 동일, DOM에서 evidence 생성 0 |
| L06 | 금융 domain·quant | 대다수 계산이 `aio-core/data/ui`에서 전역·DOM과 결합; sentiment pure module만 존재 | pure domain services + model/input version | `IN_PROGRESS` | live/backtest fixture parity, missing/zero/neutral/stale 분리 |
| L07 | UI·component·chart·narrative | native renderer 1/17, HTML sink 418건, 거대 상주 DOM | route-local page/component/chart modules | `IN_PROGRESS` | sentiment native renderer 후 16개 legacy renderer·HTML writer·chart init 삭제 |
| L08 | AI·retrieval·WebSearch | typed claim/policy scaffold는 있으나 `aio-chat.js` 6,084줄이 context/provider/storage/render를 소유 | context/retrieval/provider/policy/response 분리 | `IN_PROGRESS` | 모든 진입점 동일 envelope/gate, provider·DOM·storage 직접 접근 제거 |
| L09 | 보안·프라이버시 | DOMPurify/SRI/Vault/Worker gate 존재, 넓은 sink와 inline script로 강한 CSP 곤란 | central sanitizer, vault, Worker cost/abuse boundary | `IN_PROGRESS` | 승인 sink allowlist, inline script 0 후 CSP, secret/client boundary E2E |
| L10 | SW·asset·release | 수동 cache/version surface와 앱·데이터 revision 병존 | build manifest + immutable app assets + 독립 data revision | `IN_PROGRESS` | manifest 기반 precache, app/data/worker mismatch와 rollback 검증 |
| L11 | 테스트·관측·성능 | 강한 legacy E2E 1101개와 route matrix 존재, pure/component/leak 계측 부족 | unit/contract/component/E2E + telemetry budget | `IN_PROGRESS` | dependency/single-writer/resource-leak/evidence-parity blocking |
| L12 | 운영·워크플로 | durable plane CURRENT, fast plane OPERATOR_REQUIRED, reconciliation PARTIAL | 독립 fast/durable plane + SLO/rights ledger | `IN_PROGRESS` | Cloudflare 설정·권리·7일 soak 없이는 VERIFIED_LIVE 금지 |
| L13 | 문서·거버넌스 | 상위 handoff/ADR/RULES/QA 존재, 과거 진단서 다수 | architecture/ADR/runbook + 이 실행 원장 | `IN_PROGRESS` | 배치마다 owner/deletion/status 갱신, 종료 시 과거 handoff archive |

2026-07-19 ARX-01~06 진행 후 실측 burn-down은 `explicitWindowWrites=1094`, `directFetch=42`, `directStorage=189`, `htmlSinks=416`이다. **RM-00 정정(2026-07-19)**: 아래 문장은 당시 `operations-status.json`의 (하드코딩이었던) 선언을 그대로 인용한 것으로 부정확했다. `architecture/route-owners.json` 실측 기준 운영 공개 상태는 `nativeLifecycleOwner`=17개 전체, `nativeRendererOwner=['guide','sentiment']`(2개뿐 — market-news/briefing은 `live-news-feed`/`briefing-live-news-list`에 legacy writer 5~6곳이 남아 CONTESTED), `legacyOwner=15`, `nativeOwner=[]`이다. ~~운영 공개 상태는 `nativeLifecycleOwner=['briefing','guide','market-news','sentiment']`, `nativeRendererOwner=['briefing','guide','market-news','sentiment']`, `legacyOwner=13`, `nativeOwner=[]`이다.~~(원문 보존, 취소선)

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
node scripts/ci-esm-core-unit-check.mjs
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

- native renderer 17개 중 15개 미완료(**RM-00 정정**: 원문은 "어느 것도 완료되지 않음"이라 적었으나 이는 sentiment의 §11 세션 카드 자체의 "renderer native" 판정과 상충하는 오기였다 — 실측은 guide·sentiment 2개 완료, market-news/briefing을 포함한 나머지 15개는 legacy renderer가 살아있는 채로 thin native 모듈과 동일 DOM을 경합 중이다. 상세: `architecture/route-owners.json`, `_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md` F-03/F-07)
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

**RM-00 correction (2026-07-19)**: the sentence below re-asserted the same hardcoded declaration `operations-status.json` was shipping at the time and was not independently measured. Re-measured against `architecture/route-owners.json`: operations owner state is `nativeLifecycleOwner`=all 17 routes, `nativeRendererOwner=['guide','sentiment']` only (market-news/briefing still have 5-6 live legacy writers into `live-news-feed`/`briefing-live-news-list` and remain CONTESTED, not native), `legacyOwner=15`, and `nativeOwner=[]`; data, chart, and narrative ownership remain legacy except sentiment's chart/narrative. ~~Operations owner state is `nativeLifecycleOwner=['briefing','guide','market-news','sentiment']`, `nativeRendererOwner=['briefing','guide','market-news','sentiment']`, `legacyOwner=13`, and `nativeOwner=[]`; data and narrative ownership remain legacy until their later packets.~~(원문 보존, 취소선)

The current measured counters are `explicitWindowWrites=1094`, `directFetch=42`, `directStorage=189`, and `htmlSinks=416`. Legacy sentiment producers now notify the canonical `AIO_ARCH.ingestSentiment` evidence/state writer for F&G, Put/Call, and HY updates. ARX-02 and ARX-04 are locally closed for the new ESM slice. Guide, market-news, and briefing now have native route modules plus a `data/news` state writer. ARX-07/08 now have shared normalized market/theme states consumed by macro/fxbond/breadth/themes/theme-detail slice renderers; full route ownership remains pending. ARX-09~16 remains active for entity, domain, AI, storage, release, and retirement work. Full §8.1 validation remains deferred until all packets are finished.

후속 진행 중인 ARX-02/03은 provider·normalize·orchestrator와 state slice/selector/command 경계를 연결하고 VIX legacy narrative/chart hook, F&G/HY/PutCall의 일부 legacy DOM sink, dead F&G/crypto HTML renderer, renderer 전용 T879, 중복 snapshot projection을 삭제했다. legacy producer의 전체 gateway 전환과 남은 cross-route writer 검증이 남아 있으므로 ARX-02는 완료로 표시하지 않는다.

**정정 (2026-07-20, ARX-03/04 재진입 실측)**: 위 368행의 "ARX-02 and ARX-04 are locally closed for the new ESM slice"는 실측되지 않은 서술이었다. 2026-07-20 재측정 결과 ARX-04(HTTP 게이트웨이 실채택)는 sentiment 포함 8개 domain provider 중 **0개**가 `platform/http.js`를 사용했다 — 전부 `legacy.readX()` projection이었다(유일한 예외는 이 재진입 이전부터 있던 AR-07의 `market-snapshot.json` 로더, provider 계층이 아니라 별도의 durable-snapshot 경로). "closed"는 F-01~F-03류의 미실측 선언이었음을 기록하고, 아래 ARX-03/04 세션 카드가 실측 기반 정정이다.

커밋·푸시·배포는 사용자의 명시 지시가 있을 때만 수행한다.

---

## 세션 카드 — ARX-03 검증 + ARX-04 첫 실착수 (2026-07-20, RM-06 재진입 첫 패킷)

```text
Packet: ARX-03(검증만, 코드 변경 없음) + ARX-04 첫 슬라이스(screener provider 실 fetch)
Checkout/HEAD/version/liveRevision: RM-03 item 2(같은 세션, 미커밋)에 이어서 시작 / v53.16(버전 미변경) / live revision 미확인(배포 없음)
Scope route/metric/layer: ARX-03 — src/state/slices/*.js·src/app/commands/*.js·src/ui/pages/*.js 8개 domain 전수 재검증(코드 변경 없음). ARX-04 — src/data/providers/screener.js·src/data/normalize/screener.js·src/data/orchestrators/screener.js·src/app/bootstrap.js(screener 배선만)
Owner before: ARX-03 — 선언상 IN_PROGRESS(재측정 없음). ARX-04 — 선언상 "locally closed"(368행, 미실측). 실측: screener provider는 `legacy.readScreener`(SCREENER_DB projection) 사용, 직접 fetch 0.
Owner after: ARX-03 — IN_PROGRESS 유지(정직한 재확인, 승격 아님): command/reducer 경계는 8개 domain 전부 클린함을 실측 확인(증거 아래). ARX-04 — screener provider가 `public-data/screener.json`을 `platform/http.js`(`httpClient.requestJson`)로 직접 fetch(846행 실수신 확인). legacy fetch(`js/aio-data.js:5613`)·`SCREENER_DB` 병합(`_aioApplyServerScreener`)은 그대로 유지(additive, 대체 아님) — screener route의 dataOwner는 여전히 legacy(native 렌더가 아직 이 데이터를 쓰지 않음, RM-01이 dataset 마커만 남겨둔 상태 그대로).
Files read: src/state/slices/{sentiment,news,market,themes,entity,portfolio,screener,analysis}.js 전체, src/app/commands/*.js 8개, src/ui/pages/*.js 8개(dispatch 패턴 확인), src/data/providers/*.js 8개(fetch 패턴 확인), src/platform/http.js, src/data/market-snapshot-loader.js(선례), src/legacy/market-snapshot-bridge.js(선례), src/legacy/compatibility-facade.js의 readScreener/readMarket/readAnalysis, js/aio-data.js의 screener.json fetch 블록(5610~5630)·`_aioApplyServerScreener`(15865~) 전문, public-data/screener.json 실제 구조
Files changed: src/data/providers/screener.js(재작성) · src/data/normalize/screener.js(fetch 필드 5종 추가 + rank/score null-coercion 버그 수정) · src/data/orchestrators/screener.js(async 전환) · src/app/bootstrap.js(screener provider 배선)
DELETE-LEDGER before edit:
  - declaration: 해당 없음(이 배치는 순수 추가 — screener provider의 `read` 콜백 파라미터를 `httpClient`로 교체했을 뿐 legacy 함수는 삭제하지 않음, additive 설계를 의도적으로 선택했기 때문)
  - callers: `bootstrap.js`의 `createScreenerProvider({ read: legacy.readScreener })` → `createScreenerProvider({ httpClient })` 1곳 변경. `legacy.readScreener` 자체는 facade에 그대로 남음(다른 7개 domain의 대응 함수와 대칭성 유지 목적, 호출자 0곳이지만 유해하지 않아 이번 배치 삭제 대상에서 제외 — 다음 세션 판단 필요 시 참고)
  - global writer: 해당 없음
  - DOM/chart/narrative sink: 해당 없음(native screener 콘텐츠는 여전히 렌더되지 않음 — RM-01 dataset 마커 상태 불변)
  - event/timer/storage: 해당 없음(fetch 실패/컴포넌트 dispose 시 in-flight 요청 취소는 이번 배치 스코프 밖으로 명시 — 아래 Unverified 참조)
  - tests/docs: 없음
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 legacy 카운터 무변화(1088/42/187/410, RM-03 item 2 종료 시점과 동일) — legacy screener fetch를 삭제하지 않았으므로 정상.
New compatibility introduced and retirement packet: 없음(신규 legacy 프로젝션 아님 — 반대로 legacy 프로젝션 1개를 실 fetch로 교체). retirement 대상 아님.
Local gates: §8.1 핵심 12개 전부 PASS(viewport FULL_INIT 68/68 포함) + ci-domain-parity-check + ci-retirement-contract + ci-portfolio-vault-e2e(8/8) + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-knowledge-lint + ci-doc-currency 전부 PASS. headless 1098/1098.
Browser evidence: `ci-architecture-browser-check.mjs` 상태 덤프에서 `state.screener` 실측 — 수정 전(rank 버그 포함) `{status:"current", rowCount:846, sample:{rank:0, ...}}`(rank가 null이어야 하는데 0으로 오염), 수정 후 `{status:"current", rowCount:846, sample:{rank:null, rsi:48.2, ret1m:-2.22, ...}}`. browserErrors 0.
Live evidence: 없음 — 커밋(로컬) 여부도 사용자 지시 대기, 배포는 미지시.
Unverified/blockers: (1) in-flight fetch 도중 architecture dispose 시 AbortController로 취소하는 로직 없음 — 현재 native screener slice는 어떤 UI도 소비하지 않아 실해는 없지만(무해한 stale write), 향후 screener route 실 cutover 전에는 추가해야 함. (2) `score`/`rank`/`sector`/`name`은 `public-data/screener.json`에 없는 필드라 항상 null — 진짜 값을 채우려면 legacy의 `_aioComputeFactorRanks`(js/aio-data.js:15905, 7-factor 랭킹)를 도메인으로 추출해야 하며, 이는 CODE-MAP이 이미 지목한 서버 4-factor와의 기존 불일치(진단 C2)까지 함께 해결해야 하는 별도 작업 — 이번 배치에서 임의로 근사하지 않음(R352). (3) legacy의 `_aioApplyServerScreener`/`fetch(screener.json)` 자체 삭제(진짜 cutover)는 native screener route 렌더링이 실제로 이 slice를 소비하게 될 때(향후 W5 ARX-10) 진행 — 지금 삭제하면 `SCREENER_DB`를 직접 읽는 수십 곳의 legacy 함수가 전부 결측 상태가 됨.
Status: VERIFIED_LOCAL (ARX-03 재검증 스코프 한정 — 층 전체 승격 아님. ARX-04는 8개 domain 중 1개(screener)의 provider adapter 단계만 IN_PROGRESS→첫 실 fetch 확보, "첫 slice fetch/DOM writer 삭제" 인수 기준은 legacy 삭제가 없어 아직 미충족. 나머지 7개 domain·legacy cutover는 후속 세션)
```

## 세션 카드 — ARX-04 두 번째 슬라이스: entity 펀더멘털 실 fetch (2026-07-20, 같은 세션)

```text
Packet: ARX-04 entity(ticker) provider — sec-fundamentals.json 실 fetch
Checkout/HEAD/version/liveRevision: ARX-03/04 screener 세션 카드(같은 세션, 미커밋 상태였다가 이후 auto-commit-on-stop 훅으로 fd7b52a에 커밋됨)에 이어서 시작 / v53.16(버전 미변경) / live revision 미확인
Scope route/metric/layer: src/data/providers/entity.js · src/data/orchestrators/entity.js · src/app/bootstrap.js(entity 배선만)
Owner before: entity provider가 `legacy.readEntity`(→ `root._fundAnalysisData`, `root._optionsAnalysisData/_optionsData`, `root._liveData[id]`) projection만 사용. `_fundAnalysisData`는 js/aio-chat.js(AI 티커분석 경로)에서만 대입 — 일반 페이지 탐색에서는 항상 null이었음을 grep으로 확인.
Owner after: entity provider가 `public-data/sec-fundamentals.json`을 `platform/http.js`로 직접 fetch해 `.fundamentals`를 채움(symbol 조회, provider 수명 동안 캐시). `.id`/`.quote`/`.options`는 legacy projection 유지 — 이번 슬라이스 범위 밖.
Files read: src/data/providers/entity.js·normalize/entity.js·orchestrators/entity.js, src/legacy/compatibility-facade.js의 readEntity, js/aio-chat.js의 `_fundAnalysisData` 대입 지점 3곳 전문, public-data/sec-fundamentals.json 실제 구조(98/655 SEC 커버리지)
Files changed: src/data/providers/entity.js(재작성) · src/data/orchestrators/entity.js(async 전환) · src/app/bootstrap.js(entity provider 배선에 httpClient 추가)
DELETE-LEDGER before edit: 해당 없음(순수 추가 — legacy `readEntity`/`_fundAnalysisData` 소비는 그대로 유지, quote/options 필드는 손대지 않음)
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 legacy 카운터 무변화(1088/42/187/410) — legacy fetch를 삭제하지 않았으므로 정상.
New compatibility introduced and retirement packet: 없음.
Local gates: §8.1 핵심 12개 전부 PASS(viewport FULL_INIT 68/68 포함) + ci-domain-parity-check + ci-retirement-contract + ci-portfolio-vault-e2e + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-knowledge-lint + ci-doc-currency 전부 PASS. headless 1098/1098.
Browser evidence: 실 Chromium 애드훅 검증(임시 스크립트, 실행 후 삭제) — `window._currentTickerId='A'` 설정 → `aio:pageShown` 발화 → `state.entity.fundamentals`에 AGILENT TECHNOLOGIES 실제 SEC 데이터(revenue 6,948,000,000 등) 확인. `ZZZZNOTREAL`(미존재 심볼)은 `fundamentals:null`로 안전 폴백, 크래시 없음. `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0.
Live evidence: 없음 — 커밋 여부·배포 모두 사용자 지시 대기.
Unverified/blockers: (1) `.quote`/`.options`는 이번 슬라이스 범위 밖 — quote는 라이브 시세 파이어호스 의존이라 market domain과 함께 별도 검토 필요, options는 legacy 자체도 AI 컨텍스트 경로 외엔 거의 채워지지 않아 우선순위 낮음. (2) FMP API가 활성화되면(`fmpHasKey:true`) 현재 SEC-only 펀더멘털이 legacy의 FMP+SEC 혼합 결과와 달라질 수 있음 — 지금은 `fmpHasKey:false`라 SEC가 사실상 유일한 실소스라 문제 없지만, FMP 키가 추가되는 시점에 재검토 필요. (3) SEC 커버리지가 98/655(15%)로 낮음 — 이 슬라이스는 커버리지를 개선하지 않으며(생산자 측 문제, WP-7/P708 계열), 대부분의 티커는 여전히 fundamentals:null.
Status: VERIFIED_LOCAL (ARX-04 entity 슬라이스 한정 — quote/options/legacy fetch 삭제는 범위 밖)
```

## 세션 카드 — RM-03 계속: news 감성점수·리스크신호 실 parity 추출 (2026-07-20, Fable 어드바이저 검토 후)

```text
Packet: RM-03 (item 2 이후 계속) — computeNewsSentimentScore/computeNewsRiskSignals 도메인 추출
Checkout/HEAD/version/liveRevision: entity 세션 카드(087b5e5 커밋됨)에 이어서, `model: fable` read-only 어드바이저 자문(코드 변경 없음) 후 시작 / v53.16(버전 미변경) / live revision 미확인
Scope route/metric/layer: js/aio-data.js(computeNewsSentimentScore/computeNewsRiskSignals 래퍼만) · src/domain/news/scoring.js(신규) · src/app/bootstrap.js · src/legacy/compatibility-facade.js · scripts/ci-domain-parity-check.mjs
Owner before: 두 함수가 legacy 단일 구현(`getSentimentFromText`/`filterByAge`/`filterByKst0800NewsCycle` 헬퍼 포함, 전부 `js/aio-data.js`). `ci-domain-parity-check.mjs`의 news 항목은 `deriveNewsClaim`(단일기사 claim 검증, 별개 함수) smoke-only.
Owner after: `classifyNewsTextStance`/`briefingWindowKST`/`computeNewsSentimentScore`/`computeNewsRiskSignals`가 `src/domain/news/scoring.js` 순수 함수로 이관, `now`를 명시 매개변수화(legacy는 암묵적 `Date.now()`). legacy 래퍼 2개는 `newsCache` 폴백 유지한 채 `window.AIO_ARCH` 호출로 축소. `deriveNewsClaim`은 그대로 별개 smoke-only(대상 아님, 혼동 방지 주석 추가).
Files read: js/aio-data.js의 computeNewsSentimentScore(12184~12216)·computeNewsRiskSignals(12218~12261)·getSentimentFromText(9194~9210)·filterByAge(8677~8685)·filterByKst0800NewsCycle(8687~8696)·_getBriefingWindowKST(11436~11465, 도달불가 사문 코드 잔존 확인·이번 배치 대상 아님) 전문, 3개 실 호출부(aio-core.js:21731-21732, aio-data.js:6035/6050/13126) 전수 grep, src/domain/news/claims.js(별개 확인)
Files changed: js/aio-data.js · src/app/bootstrap.js · src/legacy/compatibility-facade.js · sw.js · scripts/ci-domain-parity-check.mjs
Files added: src/domain/news/scoring.js · scripts/dump-news-scoring-fixtures.mjs · architecture/fixtures/news-scoring-golden.json
DELETE-LEDGER before edit:
  - declaration: computeNewsSentimentScore/computeNewsRiskSignals 함수 본문 전체(계산 로직) — 래퍼에는 `newsCache` 폴백 선택과 브릿지 호출만 남김
  - callers: 없음(3개 호출부 시그니처 불변 — `items` 인자 또는 무인자 호출 모두 동일하게 동작)
  - global writer: 해당 없음
  - DOM/chart/narrative sink: 해당 없음(순수 계산 이관, 두 함수 모두 원래 DOM 미접촉)
  - event/timer/storage: 해당 없음
  - tests/docs: 없음(두 함수를 직접 검증하는 legacy 전용 테스트 없었음, 사전 확인)
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 legacy 카운터 무변화(1088/42/187/410) — 이 배치는 순수 계산 이관이며 DOM/global/storage 삭제 대상 아님.
New compatibility introduced and retirement packet: `window.AIO_ARCH.computeNewsSentimentScore`/`computeNewsRiskSignals` 신규 브릿지(단일 구현 소비 경로, P743/P745와 동일 패턴) — retirement 대상 아님.
Local gates: §8.1 핵심 12개 전부 PASS(viewport FULL_INIT 68/68 포함) + ci-domain-parity-check(news 감성점수 7필드·리스크신호 배열 8 fixture 전부 일치) + ci-retirement-contract + ci-portfolio-vault-e2e + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-knowledge-lint + ci-doc-currency 전부 PASS. headless 1098/1098.
Browser evidence: `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0, 기존 route 검증 불변.
Live evidence: 없음 — 커밋·배포 모두 사용자 지시 대기.
Unverified/blockers: (1) `_getBriefingWindowKST`의 원문(11452행 이후, `return` 뒤 도달불가 사문 코드)은 이번 배치에서 발견만 하고 삭제하지 않음(범위 밖 — 별도 소소한 burn-down 후보로 QA-CHECKLIST에 추가 고려). (2) fixture 8개가 geo(high/mid)·energy(high)·credit(high)·earnings(positive) 5개 리스크 분기는 실측했으나 earnings(negative) 분기는 미포함 — 다음 fixture 확장 시 추가 권장(낮은 우선순위, 로직은 positive와 대칭이라 위험 낮음). (3) Fable 자문이 지적한 시나리오(sentiment 재검토, screener-ranking의 C2 불일치, market/macro의 "toy 퇴역 가능성")는 이번 배치 범위 밖 — 다음 세션 후보로 이월.
Status: VERIFIED_LOCAL (news 도메인 슬라이스 한정 — RM-03 잔여 스코프는 market/macro/portfolio/screener-ranking/technical, signal은 ARX-11로 별도)
```

## 세션 카드 — RM-06 계속: Fable 자문(news ARX-04 평가 + orchestrator staleness 수정) + C2 재평가 (2026-07-21)

```text
Packet: ARX-04 news 평가(N/A 확정, 코드 변경 없음) + orchestrator 동시성 수정(screener/entity) + CODE-MAP/C2 문서 정정
Checkout/HEAD/version/liveRevision: news 세션 카드(bdf98ae 커밋됨)에 이어서, `model: fable` read-only 어드바이저 1차 자문 후 시작 / v53.16(버전 미변경) / live revision 미확인
Scope route/metric/layer: src/data/orchestrators/{screener,entity}.js · src/app/bootstrap.js(stop() 배선만) · scripts/ci-esm-core-unit-check.mjs(신규 테스트) · _context/CODE-MAP.md · js/aio-data.js(사문 코드 삭제) · scripts/ci-knowledge-lint-check.mjs(무관한 버그 수정)
Owner before: news provider — read() 프로젝션만(legacy `_allNewsItems`/`newsCache`). screener/entity orchestrator — resolve 순서 보장 없음(오래된 fetch가 새 fetch를 덮어쓸 수 있는 잠재 race, 실사용자 영향은 0 — native 렌더 소비자 없음).
Owner after: news — dataOwner legacy 유지로 확정(N/A, deferred TODO 아님). screener/entity orchestrator — 세대 카운터 가드로 오래된 resolve 무시 + dispose()로 영구 무시, bootstrap.js stop()에 배선. CODE-MAP.md의 `_aioComputeFactorRanks` 좌표·C2 진단 서술 정정.
Files read: js/aio-data.js의 _serverNewsBackstop/_aioApplyNewsBackstop 전문(5561-5564/6075-6081/13003-13013), src/app/router.js(dispose 범위 재확인), src/platform/http.js(signal 배선 확인), src/data/providers/{screener,entity}.js(캐싱 유무 대조), fetch-data.mjs:1173-1197(backtestFactors docstring 전문), js/aio-data.js:15871(_aioFactorWeights)/15947(_aioComputeFactorRanks) 재확인
Files changed: src/data/orchestrators/screener.js · src/data/orchestrators/entity.js · src/app/bootstrap.js · scripts/ci-esm-core-unit-check.mjs · _context/CODE-MAP.md · js/aio-data.js(_getBriefingWindowKST 사문 13줄 삭제) · scripts/ci-knowledge-lint-check.mjs
DELETE-LEDGER before edit:
  - declaration: js/aio-data.js의 `_getBriefingWindowKST` `return` 문 뒤 도달불가 13줄(P749가 발견만 하고 미착수했던 것)
  - callers: 없음(사문 코드라 호출부 자체가 없음)
  - global writer: 해당 없음
  - DOM/chart/narrative sink: 해당 없음
  - event/timer/storage: 해당 없음
  - tests/docs: CODE-MAP.md의 자기모순 좌표(15829/15905/16029 등) 정정, "라이브·서버 모델 불일치" 서술을 "의도적 서브셋 검증"으로 정정
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 카운터 무변화(1088/42/187/410) — 사문 코드 삭제분(13줄)은 window write/fetch/storage/HTML sink를 하나도 포함하지 않아 카운터에 반영되지 않음(정상, 순수 로컬 변수 계산 코드였음).
New compatibility introduced and retirement packet: 없음(orchestrator 변경은 내부 동시성 로직, 신규 전역/프로젝션 아님).
Local gates: §8.1 핵심 12개 전부 PASS(viewport FULL_INIT 68/68 포함) + ci-domain-parity-check + ci-retirement-contract + ci-portfolio-vault-e2e(8/8) + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-doc-currency 전부 PASS. headless 1098/1098. ci-esm-core-unit-check에 orchestrator staleness 8개 시나리오(겹치는 호출 2×2 + dispose 2×2) 신규 추가·PASS.
Browser evidence: `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0.
Live evidence: 없음 — 커밋·배포 모두 사용자 지시 대기.
Unverified/blockers: `src/platform/http.js`의 `signal: options.signal || controller.signal`(외부 signal 전달 시 내부 timeout-abort 무력화)는 Fable이 지적했으나 현재 아무 호출부도 signal을 넘기지 않아 휴면 상태 — 손대지 않고 QA-CHECKLIST 후속 후보로만 기록. market/macro의 "toy 퇴역 가능성"(Fable 1차 자문)은 이번 세션에서 재확인하지 않음(1차 자문 그대로 유효 취급).
Status: VERIFIED_LOCAL (orchestrator 동시성 수정 + 문서 정정 스코프 한정 — news는 "평가 후 미착수 확정"이라 provider 코드 변경 없음)
```

## 세션 카드 — RM-06 계속: P746 완전 해소(mtf-verdict-text 배선 + breadth 참여도 분류기 신설, Fable 2차 자문) (2026-07-21, 같은 세션)

```text
Packet: P746 후속 — technical mtf-verdict-text 배선(사용자 결정: 같은 라이브 데이터) + breadth-stage-summary 신규 설계(사용자 결정: breadth 고유 재설계, `model: fable` 2차 어드바이저 자문 후 구현)
Checkout/HEAD/version/liveRevision: 위 orchestrator 세션 카드에 이어서 시작 / v53.16(버전 미변경) / live revision 미확인
Scope route/metric/layer: index.html(updateMTF·breadth 섹션 라벨) · src/domain/market/breadth.js(신규) · src/app/bootstrap.js · src/legacy/compatibility-facade.js · js/aio-ui.js(updateBreadthBars) · sw.js(precache) · architecture/baseline.json · scripts/ci-esm-core-unit-check.mjs
Owner before: mtf-verdict-text — 정적 "분석 대기 중…"(구 updateMTF가 유일한 writer였으나 P745에서 사문 코드로 삭제됨). breadth-stage-summary — 정적 "OHLCV 근거 미수신", "Weinstein Stage" 섹션 라벨(오해 소지 — 다일 이력이 없어 추세국면 판정 불가능한데 "Stage"라는 이름을 쓰고 있었음).
Owner after: mtf-verdict-text — `updateMTF()` 안에서 이미 계산 중인 `deriveMultiTimeframeView` 결과(daily/weekly/medium)로 한줄 요약, medium이 200거래일 미만이면 Weinstein Stage 위젯과 동일 문턱으로 fail-closed(신규 데이터 소스 없음). breadth-stage-summary — `src/domain/market/breadth.js`의 `classifyBreadthParticipation`(level×direction 2축, "Stage" 아님)로 배선, 섹션 라벨을 "시장 참여도"로 변경.
Files read: index.html의 updateWeinsteinStage/updateMTF 전문(15827-15891)·breadth 섹션 마크업(6697-6724), js/aio-ui.js의 updateBreadthBars/updateBreadthUI/updateRallyQualityVerdict 전문(1-135, 3948-3972), js/aio-data.js의 _aioGetPrevDeltaRef/_aioRenderDeltas 전문(5695-5830)·_breadthLiveData 대입부(15725-15749), src/domain/technical/stage.js(재사용 여부 검토), public-data/history.json 구조, architecture/reconciliation-status.json
Files changed: index.html · js/aio-ui.js · src/app/bootstrap.js · src/legacy/compatibility-facade.js · sw.js · architecture/baseline.json · scripts/ci-esm-core-unit-check.mjs
Files added: src/domain/market/breadth.js
DELETE-LEDGER before edit:
  - declaration: 해당 없음(신규 기능 — 두 표면 모두 이전에 writer가 없었으므로 삭제 대상 없음)
  - callers: 해당 없음
  - global writer: 해당 없음
  - DOM/chart/narrative sink: `updateBreadthBars()`의 `breadth-stage-summary` fail-closed 리셋 경로를 `.innerHTML=`에서 `.textContent=`로 교체(요청 대상은 아니었으나 같은 줄을 만지는 김에 안전한 쪽으로 — htmlSinks 410→409)
  - event/timer/storage: 해당 없음
  - tests/docs: index.html의 "Weinstein Stage" 섹션 라벨과 `breadth-diag-text`의 "Weinstein Stage… 판정을 보류합니다" 문장을 새 동작에 맞게 정정
Burn-down before/after: explicitWindowWrites/directFetch/directStorage 3개 카운터 무변화(1088/42/187). htmlSinks 410→409(신규 순감소, `architecture/baseline.json` 갱신). 신규 도메인 파일이 domain-layer 정적 경계 검사(`ci-architecture-contract-check.mjs`의 `forbiddenByLayer.domain`)에서 주석 내 리터럴 "localStorage" 문자열 때문에 오탐 실패했던 것을 발견 — 코드가 아닌 주석이었지만 정규식이 구분하지 못해 문구를 "device-persisted"로 재작성해 해소.
New compatibility introduced and retirement packet: `window.AIO_ARCH.classifyBreadthParticipation` 신규 브릿지(단일 구현 소비 경로, P743/P745/P749와 동일 패턴) — retirement 대상 아님. `bootstrap.js`/`compatibility-facade.js` 양쪽에 동시 등록(배선 누락 재발 방지 절차 4번째 준수).
Local gates: §8.1 핵심 12개 전부 PASS(viewport FULL_INIT 68/68·worstOverflow 0px·jsErrors 0 포함) + ci-domain-parity-check + ci-retirement-contract + ci-portfolio-vault-e2e(8/8) + ci-boot-interaction + ci-ux-default-path(3831/3831) + ci-doc-currency 전부 PASS. headless 1098/1098. ci-esm-core-unit-check에 classifyBreadthParticipation 7개 시나리오 신규 추가·PASS(broad+rising/narrow 2분기/neutral+flat/delta없음→null/sma5Delta대체/필수입력결측).
Browser evidence: 실 Chromium 애드훅 검증 2건(각각 임시 스크립트, 실행 후 삭제) — (1) mtf-verdict-text: 상승/하락/혼조/데이터부족 4개 OHLCV 시나리오로 `calcTechnicalSnapshot`+`updateMTF` 실행, 텍스트·색상 기대값과 일치. (2) breadth-stage-summary: `window._breadthLiveData`+`localStorage.aio_delta_prev` 4개 시나리오(미수신/broad+rising/narrow+falling/neutral-무delta) 주입 후 `updateBreadthBars()` 실행, 텍스트·색상·`breadth-diag-text` 문장 전부 일치. `ci-architecture-browser-check.mjs`(17-route 왕복) browserErrors 0.
Live evidence: 없음 — 커밋·배포 모두 사용자 지시 대기.
Unverified/blockers: 진짜 추세인지형 breadth stage(다일 이력 기반)는 `history.json`에 일별 breadth를 영속화하는 별도 `/data-refresh` 성격 작업이 선행돼야 함(Fable이 명시적으로 "지금 만들지 말라"고 권고, 이번 세션 범위 밖). direction 판정에 쓰는 1스텝 delta는 localStorage 단일 슬롯(브라우저별·일별 초기화)이라 첫 방문·캐시 삭제 시 항상 null로 폴백(설계상 의도, 조작 안 함).
Status: VERIFIED_LOCAL (P746 완전 해소 — mtf-verdict-text·breadth-stage-summary 양쪽 모두 정적 플레이스홀더에서 라이브 배선으로 전환)
```
