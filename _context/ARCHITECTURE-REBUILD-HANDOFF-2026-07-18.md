---
verified_by: Codex (repository-wide static architecture review and current audit reconciliation)
last_verified: 2026-07-19
confidence: high
auto_refresh: false
target_version: v53.15
status: IMPLEMENTED_LOCAL_PARTIAL
scope: whole-system architecture

## 2026-07-19 ARX-09~16 local implementation checkpoint

Entity, portfolio, screener, analysis, pure domain, AI, privacy vault, release,
and retirement boundaries are implemented in native ESM. All 17 route modules
are registered without legacy observer ownership. External provider rights,
fast-plane credentials/soak, and browser/live certification remain explicit
operator gates; the user-requested full validation batch is deferred until the
packet sequence is complete.
---

# AIO Screener 구조 개편·근본 재구축 핸드오프

## 0. 최종 판정

현재 AIO의 문제는 데이터 최신화 코드 몇 곳만의 문제가 아니다. **브라우저 우선 단일 문서형 MVP가 제품·데이터·AI·운영 기능의 성장 속도를 감당하지 못한 상태**가 근본 원인이다. 이후 도입된 Store, Evidence, PageBus, TimerRegistry, CI 감사는 유효한 안전장치지만, 대부분 기존 전역 상태·DOM 직접 쓰기·분산 fetch 위에 추가된 호환층이다. 이 구조를 계속 보강만 하면 안전장치와 레거시 경로가 함께 늘어나는 덧붙이기식 복잡성이 반복된다.

초기 설계가 당시 목적에 틀렸던 것은 아니다. GitHub Pages에 빠르게 배포하는 개인용 단일 HTML 도구에는 합리적이었다. 그러나 현재 규모와 요구사항에는 맞지 않는다.

- `index.html` 28,371줄, `aio-core.js` 26,569줄, `aio-data.js` 17,798줄이다.
- 앱 코드 5개 파일에서 `window.* =` 명시적 쓰기가 1,110회, 파일 간 중복을 제거한 전역 이름이 728개다. 테스트 파일은 별도다.
- `DATA_SNAPSHOT` 참조는 417회지만 `readSnapshotField` 참조는 3회뿐이다.
- 직접 `localStorage` 연산은 171회지만 `storageAdapter` 참조는 9회다.
- `window.showPage =` 할당은 앱 코드에 10회 있고, `aio-data.js`가 코어 라우터를 다시 감싸는 몽키패치도 남아 있다.
- `index.html`에 외부 모듈과 별도로 11개 인라인 런타임 `<script>` 블록이 남아 있다.
- 테스트 제외 `innerHTML` 참조가 460회이며 fetch, 상태 변경, 계산, 렌더가 동일 함수에 섞인 경로가 존재한다.

권장 방향은 다음과 같다.

> **GitHub Pages 정적 배포는 유지하되, TypeScript + ESM + 얇은 빌드 단계 위에서 앱 셸·도메인·데이터·상태·표현·AI·플랫폼 경계를 다시 세우고, 호환 파사드를 통해 페이지 단위로 교체한다.**

React/Vue 등 UI 프레임워크로 한 번에 다시 쓰는 방식은 권장하지 않는다. 먼저 프레임워크 중립적인 모듈 경계와 계약을 확립하고, 실제 UI 복잡도가 정당화할 때 별도 ADR로 결정한다.

## 1. 검토 범위와 정직한 한계

### 1.1 이전 검토는 데이터 중심이었다

2026-07-18 직전 검토는 22개 데이터 범주의 원천·관측시각·자동 최신화·공백, 브라우저 quote 수집, GitHub Actions artifact, Watchdog, `PriceStore`/`EvidenceStore`/`_liveData`/`DATA_SNAPSHOT`, AI WebSearch의 우회 가능성을 깊게 봤다. 상태·스케줄러·배포도 데이터와 연결된 범위에서는 확인했다.

그러나 UI, 라우팅, 저장소, AI, 보안, 빌드, 테스트, 문서 거버넌스를 데이터와 같은 깊이로 재설계한 것은 아니었다. 즉 이전 판정은 **데이터 plane 중심의 구조 진단**이었다.

### 1.2 이번에 추가 검토한 12개 구조면

1. 앱 셸·부트·모듈 로딩
2. 라우팅·페이지 생명주기·차트/타이머 정리
3. 전역 상태·저장소·캐시
4. 데이터 수집·정규화·증거·최신성
5. 금융 도메인 계산·모델·백테스트 parity
6. UI 렌더링·CSS·차트·접근성
7. AI 컨텍스트·모델 호출·WebSearch·출력 게이트
8. 보안·비밀정보·프라이버시·XSS 경계
9. 서비스 워커·오프라인·캐시 무효화
10. CI·테스트·라이브 합성 모니터링
11. GitHub Actions·Worker·배포·데이터 운영
12. 문서·규칙·스킬·변경 거버넌스

### 1.3 구현 배치에서 별도 실측할 것

- 17개 route의 성공/부분 실패/지연/오프라인 행렬
- PC·노트북·모바일 시각 회귀와 키보드/스크린리더 사용성
- 장중/장외/휴장일별 freshness SLO
- Cloudflare Worker 실제 secret·rate-limit·비용 설정
- route 왕복 시 heap/listener/timer/chart 증가량
- 공급자 약관·재배포 권리와 유료 데이터 계약

이 문서는 저장소 전체의 구조 설계다. 위 항목은 구현 완료 판정에 필요한 런타임/운영 증거다.

## 2. 현재 구조 지도

```text
GitHub Actions / 브라우저 직접 API / Cloudflare Worker
        |                    |                 |
        +------ public-data -+------ proxy/AI-+
                             |
index.html (HTML + CSS + 11 inline runtime islands)
        |
        +-- aio-core.js  : router, globals, state shims, stores, audits, domain logic
        +-- aio-data.js  : providers, scheduler, quotes, news, screener, DOM, router wrapper
        +-- aio-ui.js    : charts, renderers, fundamentals, visual helpers
        +-- aio-chat.js  : contexts, retrieval, providers, WebSearch, policy, rendering, storage
        +-- aio-tests.js : global-runtime integration test bundle
        |
window globals / DATA_SNAPSHOT / _liveData / localStorage / DOM
        |
17 pages, charts, narratives, signals, AI responses
```

파일 개수가 적다는 사실 자체가 문제가 아니다. **계층 방향이 강제되지 않고 모든 층이 `window`, DOM, storage, fetch를 통해 서로를 우회할 수 있다는 것**이 문제다.

## 3. 구조면별 판정

| 구조면 | 현재 자산 | 근본 취약점 | 판정 |
|---|---|---|---|
| 앱 셸·모듈 | CDN 고정·SRI, defer, 분리 JS | ESM이 아니며 로드 순서·전역 alias 의존, 인라인 런타임 11개 | 재구축 |
| 라우터·생명주기 | `PAGES`, `showPage`, PageBus, resource registry | `showPage` 재할당, data 모듈 몽키패치, 지연 init, dispose 계약 부재 | 재구축 |
| 상태 | `AIO.state`, Price/Macro/News Store | `_liveData`, `DATA_SNAPSHOT`, DOM, 전역이 병존 | 교체 |
| 저장소 | Vault, safeLS, 일부 schema validator | 직접 localStorage 171회, adapter 채택률 낮음, migration 원장 부재 | 교체 |
| 데이터 | provider, freshness/evidence/audit, 서버 artifact | 수집·검증·상태·DOM·AI가 혼합, 사후 DOM audit 비중 큼 | 재구축 |
| 도메인 계산 | 시장 상태, Score, Factor, 위험·기술 계산 | pure 경계와 입력 스키마 불완전, live/backtest parity 분리 | 격리 후 검증 |
| UI·차트 | 17 route, 풍부한 시각화·접근성 보강 | 거대 상주 DOM, HTML sink·인라인 CSS, renderer가 상태/API 접근 | 점진 교체 |
| AI | typed claim/action gate, evidence prompt, WebSearch, Worker | context·provider·검색·저장·렌더가 한 모듈에 결합 | 경계 재구축 |
| 보안 | DOMPurify, SRI, Vault, Worker rate limit | 인라인 script로 강한 CSP 곤란, sink가 넓고 공개 앱 토큰은 비밀 아님 | 구조 개선 |
| SW·캐시 | Network-First, TTL, 버전 회전 | asset manifest 수동, 앱/데이터 버전 결합 | 재구축 |
| 테스트·관측 | 정적/헤드리스/viewport/a11y/portfolio gate | 전역 런타임 결합 테스트가 많고 provider/pure contract가 약함 | 재편 |
| 운영·거버넌스 | 강한 CI·규칙·사후분석·스킬 | 감사 계층의 급성장, 문서 drift, 앱 배포와 데이터 전달 결합 | 압축·분리 |

### 3.1 유지할 자산

- 17 route와 현재 정보구조
- 검증된 금융 산식과 회귀 테스트
- typed evidence, freshness, allowed-use 개념
- DOMPurify, SRI, Vault, Worker 기본 보안 장치
- Chart/Timer registry의 자원 추적 개념
- headless/viewport/a11y/portfolio/semantic/structural CI
- 데이터 원천 대사와 22개 범주 인벤토리
- GitHub Pages라는 낮은 운영비의 정적 전달면

문제는 자산의 존재 여부가 아니라, **모든 소비자가 그 경계를 반드시 통과하도록 강제되지 않는 것**이다.

## 4. 근본 원인과 금지 패턴

```text
정적 단일 HTML
  -> 브라우저 직접 fetch와 DOM 업데이트
  -> 기능·페이지·전역 상태 증가
  -> 외부 JS 파일 분리
  -> Store/Registry/감사 레이어 추가
  -> 서버 artifact/Worker/CI 추가
  -> 레거시 호환을 위해 기존 경로 유지
```

외부 파일 분리는 파일 크기를 나눴지만 의존성 방향을 만들지 못했다. 이후 안전장치는 기존 경로를 완전히 대체하지 않고 감싸거나 감시했다. 그 결과 정상 경로와 호환 경로가 동시에 남았다.

앞으로 금지한다.

- 새 전역을 추가한 뒤 나중에 Store로 옮기기
- 기존 fetch 경로를 둔 채 새 provider 함수만 병렬 추가하기
- 새 페이지를 인라인 HTML/스크립트로 추가하기
- adapter를 만들고 채택률 게이트 없이 완료로 표시하기
- DOM을 다시 읽어 canonical 상태나 evidence를 만들기
- old/new 경로를 종료일 없이 함께 유지하기

## 5. 목표 아키텍처

### 5.1 기술 기준

| 항목 | 권장 | 이유 |
|---|---|---|
| 언어 | TypeScript, 기존 JS는 `allowJs`로 점진 수용 | 상태·provider 계약을 컴파일 시 검증 |
| 모듈 | native ESM | 로드 순서 전역 결합 제거 |
| 빌드 | Vite 또는 동급의 얇은 정적 빌드 | Pages 유지, code splitting, asset manifest |
| UI | 우선 framework-neutral page/component contract | 빅뱅 재작성 방지 |
| 상태 | 작은 typed store + selector + command | 단일 writer와 파생 상태 분리 |
| 스키마 | JSON Schema 또는 Zod 계열 하나를 ADR로 선택 | 외부 데이터 runtime 검증 |
| 테스트 | unit/contract + 기존 Playwright E2E | 순수 로직과 브라우저 검증 분리 |
| 배포 | 앱 release와 데이터 release 분리 | 데이터 현재성의 앱 배포 종속 제거 |

### 5.2 계층 방향

```text
presentation/pages/components/charts
               |
          selectors / view models
               |
application commands / router / lifecycle
               |
domain services and pure calculations
               |
canonical typed state + EvidenceStore
               |
data orchestration / quality / cache
               |
provider adapters / storage / HTTP / Worker
```

의존성은 아래쪽으로만 향한다. domain 함수가 provider, DOM, localStorage를 직접 알 수 없다.

### 5.3 목표 폴더

```text
src/
  app/           bootstrap.ts · router.ts · lifecycle.ts · commands.ts
  state/         store.ts · slices/ · selectors/
  domain/        market/ · macro/ · technical/ · portfolio/ · screener/ · news/
  data/          contracts/ · providers/ · normalize/ · quality/ · orchestrators/
  ui/            components/ · pages/ · charts/ · styles/
  ai/            context-builder · retrieval · provider-gateway · websearch · policy · response
  platform/      http · storage · vault · telemetry · clock · sanitizer
  legacy/        compatibility-facade.ts
worker/
scripts/
tests/           unit/ · contract/ · component/ · e2e/
public/
```

### 5.4 상태·페이지 계약

canonical state는 `navigation`, `evidence`, `portfolio`, `preferences`, `ai`, `operations` slice로 제한한다.

1. 각 field/metric은 writer가 하나다.
2. 계산 가능한 값은 저장하지 않고 selector로 만든다.
3. DOM은 상태가 아니며 store에 역으로 쓰지 않는다.
4. 외부 응답은 검증 전 state에 들어가지 않는다.
5. legacy global은 compatibility facade의 read-only projection만 허용한다.

```ts
interface PageModule {
  route: RouteId;
  mount(ctx: PageContext): Promise<() => void> | (() => void);
}
```

`mount`가 만든 listener, AbortController, timer, chart, observer는 반환된 `dispose`에서 정리한다. 라우터만 mount/dispose를 호출한다. `showPage` wrapper와 지연 `setTimeout` init은 금지한다.

### 5.5 데이터·증거 계약

상세는 `AUTOMATED-DATA-RELIABILITY-HANDOFF-2026-07-18.md`를 AR-07 하위 실행계획으로 사용한다.

```text
provider response
  -> schema validation
  -> symbol/unit/time normalization
  -> quality/freshness/divergence gate
  -> EvidenceStore ingest
  -> canonical state -> selector
  -> UI / chart / domain / AI context
```

EvidenceStore는 DOM을 스캔해 만들지 않는다. ingest 시점에 생성하고 UI와 AI가 같은 evidence ID를 소비한다.

### 5.6 AI·저장소·보안 계약

- `ContextBuilder`는 typed evidence와 사용자 허용 범위만 읽는다.
- `ProviderGateway`가 BYOK Anthropic, 서버 Worker, 향후 provider를 동일 envelope로 감싼다.
- WebSearch 결과는 `INFERRED` 또는 문서 evidence로만 등록한다.
- `Policy`가 stale/missing/privacy/action strength를 판정한다.
- `ResponsePipeline`이 sanitizer와 disclosure를 거쳐 렌더한다.
- UI는 provider별 헤더·키·재시도를 알지 못한다.
- Web Storage/IndexedDB 직접 호출은 `platform/storage` 밖에서 0건이어야 한다.
- 저장 schema에 `schemaVersion`과 순방향 migration을 둔다.
- HTML sink는 승인 renderer/sanitizer 밖에서 0건을 목표로 한다.
- 인라인 script 제거 후 nonce 없는 강한 CSP를 적용한다.

공유 서버 키는 Worker 밖으로 나가지 않는다. 공개 클라이언트 토큰은 인증으로 보지 않으며 rate-limit, origin allowlist, abuse switch, 비용 budget을 Worker가 강제한다.

### 5.7 앱 배포와 데이터 운영 분리

```text
App release: source -> build -> test -> immutable assets -> GitHub Pages
Fast data:   provider -> Worker cron -> validate -> KV/R2/cache -> /quotes
Durable data: scheduled fetch -> validate -> versioned artifact/LKG -> read endpoint
```

새 데이터마다 앱 commit과 Pages 전체 배포를 요구하지 않는다. 앱은 app release, data revision, evidence revision을 별도로 표시한다.

## 6. 유지·교체·폐기 매트릭스

| 현재 요소 | 조치 | 목표 |
|---|---|---|
| GitHub Pages | 유지 | 빌드 결과 정적 배포 |
| 17 route 콘텐츠 | 페이지별 추출 | active route lazy mount |
| `PAGES` | 개념 유지, 구현 교체 | typed route registry |
| `_aioPageBus` | 임시 호환 후 폐기 | router lifecycle + store subscription |
| Timer/Chart registry | 개념 유지, scope화 | page resource bag + dispose |
| `DATA_SNAPSHOT`, `_liveData` | read-only projection 후 폐기 | EvidenceStore selector |
| Price/Macro/News Store | 검증 로직 추출 | canonical evidence ingest |
| DOM 기반 Evidence audit | 폐기 | ingest ledger + render parity audit |
| `safeLS`/Vault | migration 로직 보존 | versioned storage repositories |
| 직접 localStorage | 폐기 | storage gateway 100% |
| 직접 fetch/proxy race | 폐기 | HTTP + provider adapters |
| 인라인 runtime script | 폐기 | ESM page modules |
| DOMPurify/SRI | 유지 | 중앙 sanitizer + dependency policy |
| `aio-tests.js` | 회귀 기준 후 분해 | unit/contract/component/E2E |
| current CI gates | 유지·재배치 | 계층별 blocking gates |
| hardcoded SW asset list | 폐기 | build-generated manifest |

## 7. 마이그레이션 원칙

빅뱅 재작성 대신 strangler migration을 사용한다.

```text
legacy page/global <- compatibility facade <- new typed store/domain/page
```

한 route 또는 state slice를 전환한 배치에서는 같은 기능의 legacy writer와 monkey patch를 제거한다. “새 구조도 추가했지만 옛 경로는 안전을 위해 유지”는 완료가 아니다.

배치 공통 완료 조건:

1. 새 계약과 owner가 문서화됨
2. unit/contract/E2E가 추가됨
3. compatibility facade 사용량이 감소함
4. 해당 legacy writer/fetch/DOM/storage 경로가 삭제됨
5. route 왕복에서 listener/timer/chart 증가가 0
6. live/local 값과 evidence ID가 허용 오차 내 일치
7. 이전 release artifact로 rollback 가능

## 8. 실행 패킷 AR-00~09

### AR-00 — 기준선 동결과 ADR

- 17 route별 핵심 기능·데이터·상호작용 golden manifest
- global writer, direct fetch/storage/HTML sink, monkey patch 자동 baseline
- ADR: build, runtime schema, state store, UI framework 유보
- CI가 신규 global/direct storage/direct fetch 증가를 차단

### AR-01 — 빌드·ESM·호환 파사드

- `src/`와 TypeScript/ESM build 도입
- 현재 HTML을 entry shell로 사용
- 필요한 전역만 compatibility facade에서 export
- build-generated asset manifest
- 완료: 화면 parity, facade 밖 신규 `window.* =` 0

### AR-02 — Platform gateways

- HTTP, storage, clock, telemetry, sanitizer 단일 진입점
- provider timeout/retry/cancel/error envelope
- fake clock과 fixture transport
- 완료: 첫 vertical slice의 direct fetch/storage/innerHTML 0

### AR-03 — Canonical Evidence and State

- typed Evidence envelope와 store
- quote/macro/news slice 및 selectors
- one-writer enforcement
- legacy globals read-only projection
- 완료: Tier 0 UI·차트·AI 동일 evidence ID, DOM→state/evidence 경로 0

### AR-04 — Domain engines

- regime, Trading Score, Factor, technical, portfolio risk를 pure module로 이동
- 입력/출력 schema와 provenance
- live/backtest 동일 함수 또는 명시적 model version
- 완료: fixture parity, missing/neutral/zero/stale 분리

### AR-05 — Router·생명주기·UI 추출

권장 순서:

1. `guide`, `glossary`
2. `market-news`, `briefing`, `sentiment`
3. `macro`, `fxbond`, `breadth`, `themes`
4. `ticker`, `fundamental`, `technical`, `options`
5. `portfolio`, `screener`, `signal`, `home`

완료: 해당 route inline script/showPage hook 제거, dispose 후 resource 0, viewport/a11y parity.

### AR-06 — AI·검색·보안 통합

- ContextBuilder, ProviderGateway, Retrieval, Policy, Renderer 분리
- streaming/complete 동일 output gate
- prompt/evidence/privacy/cost manifest
- Worker abuse/cost controls와 BYOK 경계
- 완료: 모든 진입점 동일 manifest, stale/missing 숫자·강한 행동문구 0

### AR-07 — 데이터 운영면 분리

- 데이터 신뢰성 핸드오프 Batch 0~4 실행
- fast quote plane, durable LKG, independent scheduler
- app/data/evidence revision 분리
- 사용자 노출 14페이지와 조건부 3 route를 `UI 값 ↔ Evidence ↔ artifact ↔ 원천`으로 대조
- 완료: Tier 0 SLO, 실패 run의 LKG overwrite 0, 앱 재배포 없는 data 갱신, 중요 수치 source reconciliation 100%

### AR-08 — SW·배포·관측 재구축

- build manifest precache, hashed immutable asset
- data API freshness/cache-control
- release/data/Worker synthetic checks
- 완료: rollout/rollback 재현, revision mismatch 탐지, offline/partial E2E

### AR-09 — Legacy cutover와 문서 압축

- `DATA_SNAPSHOT`, `_liveData`, `showPage` wrapper, PageBus legacy 제거
- inline runtime script 0
- direct fetch/storage/HTML sink 예외 0 또는 승인 allowlist
- 과거 handoff archive, architecture/ADR/runbook을 active SSOT로 지정
- 완료: old/new 병렬 writer 0, compatibility export 0 또는 승인 API만 존재

## 9. 계층별 CI 게이트

| Gate | 실패 조건 |
|---|---|
| AG-01 Dependency | domain이 DOM/fetch/storage/provider를 import |
| AG-02 Global budget | facade 밖 `window.* =` 신규 발생 |
| AG-03 Single writer | 동일 state/metric 복수 writer |
| AG-04 Network | provider/HttpClient 밖 직접 fetch |
| AG-05 Storage | platform/storage 밖 Web Storage/IndexedDB |
| AG-06 HTML | 승인 renderer/sanitizer 밖 HTML sink |
| AG-07 Lifecycle | route 왕복 후 resource count 증가 |
| AG-08 Evidence parity | UI·chart·AI가 다른 evidence ID/값 사용 |
| AG-09 Data quality | coverage/freshness/divergence gate 실패 |
| AG-10 Model parity | 동일 modelVersion live/backtest 불일치 |
| AG-11 Release parity | source, asset, SW, app/data revision 불일치 |
| AG-12 Legacy burn-down | 배치 목표 대비 compatibility 사용량 미감소 |
| AG-13 Source reconciliation | 중요 수치의 UI/artifact/원천 값·단위·관측시각 중 하나라도 불일치 또는 미기록 |
| AG-14 Narrative evidence | 현재형 분석문의 수치·단위가 Evidence ID로 역추적되지 않거나 producer/client 검증 중 하나라도 우회 |

기존 structural, semantic, headless, viewport, a11y, portfolio, live invariant 게이트는 유지하되 새 원장을 더 늘리기보다 구조 위반을 직접 차단하도록 통합한다.

## 10. 순서와 첫 vertical slice

```text
AR-00 -> AR-01 -> AR-02 -> AR-03
                         -> AR-04 / AR-05 / AR-06 / AR-07
                         -> AR-08 -> AR-09
```

첫 구현은 `sentiment` route의 VIX/Fear & Greed/Put-Call 묶음을 권장한다. quote·심리·파생값·freshness·chart·AI context를 모두 검증하면서 portfolio 상태를 건드리지 않아 롤백 위험이 상대적으로 낮다.

완료 기준은 새 카드가 보이는 것이 아니다. **해당 지표의 old writer, DOM audit, page hook이 삭제되고 AG-01~12가 통과해야 한다.**

## 11. 운영자 결정 카드

| 결정 | 기본 권고 |
|---|---|
| build | Vite |
| runtime schema | 외부 artifact 중심이면 JSON Schema, 내부 편의 중심이면 Zod; ADR에서 하나로 통일 |
| state | 자체 작은 typed store로 시작 |
| UI framework | 이번 재구축에서는 유보 |
| fast data | 기존 Worker 경험을 활용한 Cloudflare KV/R2/cache 우선 |
| 유료 시세 | 무료 best-effort와 계약형 Tier 0 SLO를 제품 문구에서 분리 |
| Worker 인증 | 공개 토큰을 인증으로 보지 말고 비용 상한+rate limit, 필요 시 사용자 인증 |

## 12. 후속 실행자 체크리스트

- [ ] dirty worktree를 보존하고 재구축 작업 단위를 분리했다.
- [ ] `version.json`, git HEAD, live revision을 각각 기록했다.
- [ ] AR-00 golden manifest와 counters를 재측정했다.
- [ ] 첫 vertical slice 밖을 넓게 수정하지 않는다.
- [ ] 대체할 legacy writer/hook/storage/fetch 목록을 먼저 적었다.
- [ ] 구현 후 그 legacy 목록이 실제 삭제됐는지 diff로 확인했다.
- [ ] 정적·헤드리스·viewport·a11y·live gate를 통과했다.
- [ ] route 왕복 leak과 evidence parity를 실브라우저에서 확인했다.
- [ ] 커밋·푸시·배포는 사용자 명시 지시 없이는 하지 않는다.

## 13. 최종 인수 게이트

1. `index.html`은 mount point, 접근성 shell, metadata 중심이며 runtime inline script가 없다.
2. route는 typed registry와 mount/dispose 계약으로만 전환된다.
3. canonical state/evidence 밖의 시장·포트폴리오·AI writer가 없다.
4. domain 계산은 DOM, fetch, storage와 독립된 pure function이다.
5. 외부 통신·저장·HTML sink는 각 단일 gateway를 통과한다.
6. UI·차트·AI가 동일 evidence ID와 freshness를 사용한다.
7. 중요 시세는 앱 배포와 독립된 fast/durable plane에서 SLO를 충족한다.
8. live/backtest model version과 입력 계약이 일치한다.
9. CI가 dependency, global, writer, lifecycle, evidence, release 경계를 blocking한다.
10. compatibility facade와 old/new 병렬 경로가 종료됐다.

이 기준 전에는 “구조 보강 완료”가 아니라 “재구축 진행 중”으로 표시한다.

## 14. 관련 문서 위계

1. **이 문서** — 전체 시스템 목표 아키텍처와 재구축 순서의 상위 SSOT
2. `ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md` — 다른 세션용 계층·route·삭제 원장·배치 실행 계약
3. `AUTOMATED-DATA-RELIABILITY-HANDOFF-2026-07-18.md` — AR-07 데이터 plane 하위 실행계획
4. `AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md` — AR-06 AI 위험·검증 기준선
5. `CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md` — 과거 전체 시스템 증거 원장
6. `WO7-GLOBAL-INVENTORY-2026-07-10.md` — 전역 격리 baseline
7. `CODE-MAP.md`, `RULES.md`, `QA-CHECKLIST.md` — 실제 수정·검증 규칙

하위 문서와 충돌하면 최신 코드 실측과 이 문서의 계층 경계를 우선하되, 데이터 source/rights/freshness 세부 기준은 데이터 핸드오프를 따른다.

## 15. 2026-07-18 라이브 페이지·레이어 재검증 반영

### 15.1 이번에 실제로 확인한 범위

- 배포본 `v53.7`의 사용자 노출 14페이지를 인앱 브라우저에서 순회했다. 로컬 저장소는 `v53.9`이므로 배포본과 로컬본을 같은 실행물로 간주하지 않는다.
- 각 활성 페이지에서 텍스트 길이, live/snapshot sink, evidence/claim marker, canvas, `판정 보류·미수신·지연` 상태 문구를 수집했다.
- 로컬 Chromium에서는 외부망이 차단되어 470건의 외부 요청이 실패했다. 이 실행은 failure-mode 검증에는 사용했지만 provider 성공 검증으로 계산하지 않았다.
- 구조 검토는 데이터 plane뿐 아니라 부팅·라우터·상태·저장소·도메인·UI/차트·AI·보안·SW/캐시·테스트/관측·배포·문서의 12개 구조면을 포함한다. 단, 장시간 누수·부하·상용 provider 계약·모든 조건부 입력 성공 상태는 아직 미검증이다.

### 15.2 페이지별 현재 판정

| 페이지 | 텍스트·수치 | 차트·시계열 | 구조 판정 |
|---|---|---|---|
| briefing | live 7/snapshot 2, 뉴스·브리핑 렌더 | 전용 차트 없음 | 부분 자동; 브리핑 수치 claim gate 필요 |
| home | 12개 클라이언트 시세만 수신, 주요 지수 다수 미수신, BTC live | 전용 canvas 없음 | 부분 데이터 상태가 정상 노출되나 Tier 0 backstop 부재 |
| market-news | 40건 server artifact와 라이브 기사 렌더, 45분 주기 표기 | 해당 없음 | 자동 수집은 존재하나 run 성공과 기사 원문 1:1은 별도 검증 필요 |
| signal | 부분 데이터 점수·수집 대기 | 전용 canvas 없음 | 입력 결손 시 fail-closed, 설명문 Evidence 연결 미완전 |
| breadth | 기준일 2026-07-17, AIO breadth 표시 | 가격·50MA canvas 2개 | Weinstein OHLCV·McClellan A/D 이력 미수신 |
| sentiment | VIX/F&G 일부 수신 | VIX 기간구조 canvas 1개 | HY OAS 미수신, 설문은 공백/수동 |
| technical | SPY 90거래일 차트 렌더 | 가격·거래량 canvas 2개 | 200일 OHLCV 부족으로 Weinstein/MTF 보류 |
| macro | live/snapshot 혼재 | 미국 수익률곡선 canvas 1개 | 만기별 source/asOf를 한 계약으로 통합해야 함 |
| fxbond | live 90/snapshot 5 | 10Y·USD/JPY 3개월 canvas 2개 | 화면 렌더는 되나 각 series point provenance 미완전 |
| themes | 테마 데이터 렌더 | RRG는 상태 span만 확인 | SPY 대비 20일+ 상대강도 이력 성공 경로 재검증 필요 |
| portfolio | 보유종목 없을 때 빈 상태 | 보유 데이터 없으면 차트 없음 | 사용자 입력 의존 상태로 정상; 자동 데이터 실패와 구분 |
| fundamental | 기업 설명·가격 포지션 미수신 | 성장성·수익성 canvas 2개 | SEC/FMP coverage 결손을 명시하지만 1:1 filing 검증 미완료 |
| screener | artifact 기반 표 렌더 | 시계열 canvas 없음 | 846/870 history, SEC 93/655만 확보 |
| guide | 정적 설명·면책 | 해당 없음 | 의도적 비자동 콘텐츠 |

조건부 route `theme-detail`, `ticker`, `options`는 테마/티커/키·체인 입력이 필요한 성공 상태를 전부 재현하지 못했다. `theme-detail`은 입력 없이 접근하면 `themes`로 복귀한다. 따라서 17 route 전체를 라이브 성공 검증했다고 보고하지 않는다.

### 15.3 재구축 인수 조건 보강

1. 페이지별 자동 갱신 판정은 producer 존재가 아니라 실제 `observedAt` 변화와 DOM 재렌더 증거로 결정한다.
2. 차트는 canvas 존재만으로 통과시키지 않고 series ID, 모든 point의 관측일, 마지막 값, 결측 구간, 원천 응답 hash를 기록한다.
3. 현재형 분석문은 숫자 token마다 Evidence ID·단위 formatter·관측시각을 가져야 한다. 정적 교육문은 `education/reference`로 분리한다.
4. raw AI 산출물과 사용자 공개문 모두 같은 claim validator를 통과해야 한다. client가 차단했더라도 producer가 잘못된 수치를 생성하면 품질 게이트는 실패다.
5. 배포본과 로컬본의 revision이 다르면 live 검증 상태를 로컬 완료 상태로 승격하지 않는다.

## 16. 2026-07-19 로컬 구현 상태 (v53.13)

v53.11에서 AR-00~06의 실행 가능한 ESM 기반 계약을 추가하고 첫 `sentiment`
vertical slice를 legacy shell에 연결했다. AR-00 golden route/baseline/ADR,
platform gateways, typed store/evidence/freshness/lineage, pure sentiment
domain, lifecycle router, AI evidence policy, compatibility facade를 `src/`에
두었고 `window.AIO_ARCH`는 `MIGRATION_IN_PROGRESS` read-only projection으로만
노출된다. AR-07은 Tier 0 coverage를 충족하지 못한 market snapshot publish를
거부하는 계약까지 구현했으며, AR-08은 Pages allowlist·SW pre-cache·revision
parity gate를 연결했다.

로컬에서 확인한 것은 ESM boot, offline blocked sentiment, document-targeted
`aio:pageShown` string detail, sentiment→home→sentiment dispose/mount,
legacy coupling baseline no increase다. WebSearch inferred claim contract와 typed
`showPage`/`AIO_ARCH.navigate` navigation facade도 추가했다. Cloudflare 독립
스케줄러/KV·R2 credentials/resource IDs, 공급자 권리·키, 7일 SLO, 전 데이터
plane의 live backstop과 AR-09 full native renderer cutover는 외부 운영 설정과
대규모 route migration이 필요해 아직 `VERIFIED_LIVE`/전체 재구축 완료로
승격하지 않는다.

## 17. 2026-07-19 v53.13 실행 산출물

- `public-data/market-snapshot.json`: Tier 0 16/16 canonical quote evidence, published only on complete coverage.
- `public-data/market-snapshot-status.json`: failed attempt와 retained last-known-good revision을 별도 기록.
- `worker/data-plane.js` + `worker/wrangler.example.toml`: 5-minute Cron, KV current pointer, R2 revision/LKG, authenticated admin run, `/health`/`/quotes` contract. Repository에는 Cloudflare credentials/resource IDs가 없어 deploy는 manual preflight로 남겼다.
- `public-data/operations-status.json`: durable `CURRENT`, fast `OPERATOR_REQUIRED`, provider rights와 SEC coverage blocker, route ownership을 공개 상태로 기록.
- `public-data/reconciliation-status.json`: 22 categories = `MATCH 3 / PARTIAL 13 / BLOCKED 6`.
- `src/ai/inference.js`: WebSearch claims are direction/range/confidence/sourceCount/sourceUrls/observedWindow only; exact current numeric fields are rejected and HIGH requires two sources.
- `src/legacy/compatibility-facade.js`: typed lifecycle router owns navigation entry through an explicitly marked compatibility facade; legacy renderer remains the declared owner for 16 routes, so AR-09 is not falsely marked complete.
- Local gates passed: architecture contract/browser, inference, market snapshot, data plane, operations, reconciliation, workflow YAML/control-character checks. v53.13 local Vault E2E is 8/8 PASS and the RSS retry/backstop contract is PASS.
- Refresh run `29670719055` succeeded with `news 31` and created data commit `313b7db`; downstream CI run `29670732380` passed validate, 22-category/static and lineage gates, headless tests, all-route accessibility, viewport 68/68, Critical-10, Vault E2E, and GitHub Pages deploy.
- Live invariant check passed at `https://ysnle.github.io/aio-screener` with version `v53.13`; live `data.json` reports `symbolsOk=78`, `newsCount=31`, generated at `2026-07-19T02:46:57.844Z`.
- Release boundary remains explicit: AR-07 fast plane is `OPERATOR_REQUIRED` pending Cloudflare credentials/provider rights/7-day SLO, and AR-09 remains partial because the legacy renderer still owns the declared route set. Do not promote either to full verified completion.

## 18. 2026-07-19 v53.15 실제 소유권 이전 1차 배치

v53.11~v53.14의 기반 작업은 필요한 scaffold였지만, "legacy coupling baseline no increase"만으로는 구조 개편의 진척을 증명하지 못했다. v53.15부터 migration batch의 완료 기준을 신규 파일 수가 아니라 **실행 소유권 이전 + 대응 legacy 삭제 + 단조 burn-down**으로 바꾼다.

직전 배치에서 sentiment의 route lifecycle과 fail-closed 상태 배지는 `src/ui/pages/sentiment.js`가 소유하기 시작했다. 기존 `PAGES.sentiment.init`과 `js/aio-ui.js`의 중복 badge writer를 제거했고, `js/aio-data.js`의 `window.showPage` monkeypatch도 기존 page bus subscriber로 교체해 explicit global writes를 1110에서 1109로 감소시켰다.

`route/changed`가 Store reducer에서 소비되도록 연결해 router와 state route가 일치한다. Architecture contract는 explicit global writes ≤1109, 제거된 init/badge/monkeypatch의 재등장 금지, `release-manifest.appRevision === version.json.version`을 blocking한다. Chromium contract는 sentiment의 router/store route, `심리: 판정 보류` 배지, route 왕복 dispose/mount를 확인한다.

운영 공개 상태도 소유권을 분리한다: `nativeLifecycleOwner=['sentiment']`, `nativeRendererOwner=[]`, `legacyOwner=17`. 따라서 이것은 AR-09 완료가 아니라 첫 lifecycle 배치였다.

이전 배치의 로컬 검증은 architecture/operations/version/release 및 데이터·보안·문서 계약 22종 PASS, headless 1101/1101, architecture Chromium browserErrors 0, Critical-10 10/10, a11y 17/17, viewport 68/68(overflow 0px·tinyText 0·jsErrors 0), Vault 8/8이었다. 이 증거는 이후 패킷의 완료 근거로 재사용하지 않는다.

## 19. 2026-07-19 ARX-01 sentiment renderer cutover

ARX-01에서 `src/ui/pages/sentiment.js`가 sentiment의 카드·상태·VIX/기간구조 차트·복합 판단·resource bag lifecycle을 실제로 소유하도록 전환했다. 렌더러는 store/evidence selector와 주입된 Chart constructor만 읽으며 fetch·storage·legacy global에 직접 접근하지 않는다. Chart.js가 없거나 시계열이 비어 있으면 동일 모듈의 bounded canvas fallback/blocked marker로 종료한다.

같은 배치에서 `js/aio-ui.js`의 `initSentimentPage`, 전용 chart helper/registry/fallback, `js/aio-core.js`의 sentiment chart cleanup, `js/aio-data.js`의 chart back-reference, `compatibility-facade`의 sentiment mount map과 삭제 함수 전용 테스트를 제거했다. 데이터 producer 자체는 ARX-02 전까지 facade read-only adapter로 남기고, 상태 동기화는 `putCall`·`hySpread`·AAII·VIX history까지 포함해 native selector가 소비한다.

Burn-down은 explicit global writes `1109→1094`, direct fetch `42→42`, direct storage `189→189`, HTML sink `420→416`이다. `nativeRendererOwner=['briefing','guide','market-news','sentiment']`, `legacyOwner=13`, `nativeOwner=[]`로 공개했고, data owner가 아직 legacy이므로 상태는 `MIGRATION_IN_PROGRESS`다. 전체 §8.1 회귀와 Chromium 증거는 모든 ARX 패킷 완료 후 일괄 실행한다. provider rights·Cloudflare fast plane·7-day soak·live evidence는 여전히 미검증이다.

ARX-02는 다음 수직 단계로 착수했다. `src/data/providers/sentiment.js` → `src/data/normalize/sentiment.js` → `src/data/orchestrators/sentiment.js` 경계를 추가하고 bootstrap의 sentiment sync를 `data/sentiment` 단일 dispatch/evidence writer로 이동했다. F&G/HY의 sentiment-page 직접 sink와 dead F&G/crypto HTML renderer를 제거했고 legacy producer가 `AIO_ARCH.ingestSentiment`를 통해 canonical writer에 통지하도록 연결했으며, ARX-02는 `VERIFIED_LOCAL`로 닫고 ARX-04 platform adoption과 ARX-05/06 route owner를 다음 packet으로 이관했다. data owner와 narrative owner는 아직 native로 승격하지 않는다.
