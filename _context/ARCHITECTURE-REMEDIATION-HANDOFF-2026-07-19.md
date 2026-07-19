---
verified_by: Claude Fable 5 (repository-wide structural audit; 발견마다 파일:라인 증거 인용)
last_verified: 2026-07-19
confidence: high
auto_refresh: false
target_version: v53.16
status: DESIGNED_EXECUTABLE
parent: ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md
sibling: ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md
scope: rebuild integrity remediation + ARX 재진입
---

# AIO 아키텍처 재구축 무결성 복구·보강 실행 핸드오프 (RM-00~06)

## 0. 이 문서의 역할

2026-07-19 18:20~19:23 배치(커밋 `b7bce36`→`9462404`, origin/main 푸시 완료)가 **재구축 자체의 목표 구조를 훼손한 것이 아니라, 재구축의 진척 회계와 게이트 무결성을 훼손했다.** 상위 handoff의 목표 아키텍처와 실행 계획의 ARX-00~16 파동은 그대로 유효하다. 이 문서는 그 사이에 끼어드는 **선행 복구 원장**이다.

- 우선순위: **RM-00·RM-01·RM-04 완료 전에는 새 ARX 패킷 착수 금지.**
- 이 문서와 실행 계획이 충돌하면 소유권·게이트 서술은 이 문서가, 목표 구조·파동 순서는 실행 계획이 우선한다.
- 완료 상태 정의(`DESIGNED`~`RETIRED`)와 세션 카드 양식은 실행 계획 §1·§7을 그대로 사용한다. 복제하지 않는다.
- 근거 규칙: **R352**(v53.15 신설 — "migration은 scaffold 존재가 아니라 실행 소유권 이전 + legacy burn-down으로 판정") — 이 문서 전체가 R352의 집행이다.

### 0.1 실행 상태 (2026-07-19 세션)

RM-00 + RM-04 완료(같은 세션 병합 실행, §3 권장 방식). 이어서 같은 세션에서 RM-01도 완료(사용자 지시로 "커밋만 하고 남은 항목 순차 진행"). 세션 카드는 §7 형식으로 문서 하단에 별도 기록. 요약:

**RM-00+RM-04**:
- `architecture/route-owners.json` 신설(17 route × 5칸 실측 + legacy 심볼 목록) — 이하 모든 소유권 서술의 단일 소스.
- `build-operations-status.mjs` 하드코딩 배열 삭제 → route-owners.json 파생. `public-data/operations-status.json` 재생성 완료(`nativeRendererOwner:['guide','sentiment']`, `legacyOwner:15`, `cutoverStatus:'MIGRATION_IN_PROGRESS'`).
- `architecture/retirement-manifest.json` 정정(`status:'MIGRATION_IN_PROGRESS'`, `legacyRouteOwners` 15개 복원).
- `ci-retirement-contract.mjs`/`ci-operations-status-check.mjs`/`ci-architecture-contract-check.mjs` 재작성 — route-owners.json 대조 검증으로 전환. `ci-domain-parity-check.mjs`→`ci-domain-module-smoke-check.mjs` 개명(ci.yml 동기화, 항진성 자체는 RM-03 잔존).
- 핸드오프(07-18)·실행계획(07-19)·INDEX.md·CHANGELOG의 상충 서술 정정(F-07) — 기존 줄은 취소선/추기로 보존, 삭제 없음.
- BUG-POSTMORTEM P740 + "진척 인플레이션" 반복 클래스 신설.

**RM-01** (같은 세션 이어서 실행):
- contested id 전수 재측정: analysis/entity/themes 100% contested(12/13/3개 id 전부), market(quote+breadth contested, macro FRED 5개 id는 index.html에 아예 존재하지 않아 경합이 아니라 완전 비활성 코드로 판정), portfolio/screener/news 컨테이너 전부 contested.
- `src/ui/pages/{analysis,entity,market,themes,portfolio,screener,news}.js` 7개 모듈에서 contested content 쓰기 전부 삭제, dataset 스탬프만 유지.
- 추가 발견 2건(RM-00에서 놓쳤던 것): (1) news.js가 `stopPropagation()`으로 legacy `data-action` 클릭 위임을 차단 중이었음(별도 삭제) — DOM 쓰기 경합과 무관한 숨은 회귀. (2) sentiment.js의 `home-fg-score`·`sent-analysis-text`도 실제로 legacy와 경합 중이었음(`sent-analysis-text`의 legacy 소유자는 `setTimeout` 간접 호출이라 P736/738/739의 직접-호출 grep에 안 걸렸음) — 삭제 완료, narrativeOwner를 `native`→`legacy`로 정정.
- `AG-DOM-WRITER` 정적 게이트 신설(`ci-architecture-contract-check.mjs`) + `domWriterIntersectionAllowlist`(fg-score-big/pc-score-big, legacy가 읽기 전용으로 의존) 신설.
- `ci-architecture-browser-check.mjs`에 home `score-gauge-val` 정수·`home-trading-signal` 한국어 라벨·market-news/briefing non-native 검증 추가.
- BUG-POSTMORTEM P741.
- 진짜 legacy 삭제(ARX cutover)는 아직 없음 — 이번 배치는 native의 경합 쓰기만 제거했다(삭제 방향은 legacy→유지, native→삭제).

**남은 항목**: RM-02(store clone 성능) · RM-03(도메인 추출) · RM-05(게이트 보강) · RM-06(ARX 재진입 지침, RM-00/01/04 완료로 선행조건 충족).

## 1. 실측 발견 원장 (F-01~F-09)

각 발견은 2026-07-19 v53.16(HEAD `9462404`) 실측이다. 재현 명령이 함께 있으면 착수 전 재실행한다.

### F-01 — 소유권 원장 하드코딩 (P0)

`scripts/build-operations-status.mjs:43-48`이 `nativeOwner` 17개 route 전체·`legacyOwner: 0`·`cutoverStatus: 'NATIVE_ROUTES_LOCAL'`을 **리터럴 배열로 하드코딩**한다. `architecture/retirement-manifest.json`도 `nativeRoutes` 17개·`legacyRouteOwners: []`를 선언한다. 실행 계획 §1("Renderer가 legacy면 legacy owner") · §5("다섯 칸 중 하나라도 legacy면 nativeOwner 집계 금지") 및 R352 위반.

실측 소유권(§2 진실표): renderer native는 **2**(guide/sentiment — 2차 스윕에서 market-news/briefing의 legacy writer 잔존 확정, F-03), data native 0, chart native 1(sentiment), narrative native 0~1(재실측 필요). 5칸 기준 `nativeOwner`는 **0**이어야 한다. 직전 기록(실행 계획 §2 checkpoint `nativeRendererOwner=4 / legacyOwner=13`)조차 과대였다.

### F-02 — 게이트 역전: 게이트가 실측을 검증하지 않고 선언을 강제 (P0)

- `scripts/ci-retirement-contract.mjs:12` — `manifest.nativeRoutes.length !== 17`이면 **실패**. 즉 정직한 값(부분 native)을 넣으면 CI가 깨지도록 작성됨.
- `scripts/ci-operations-status-check.mjs:15` — `legacyOwner + nativeRendererOwner.length === supported` 항등식 강제. 17개 renderer 선언 하에서 `legacyOwner=0`이 산술적으로 강제됨.
- `scripts/ci-architecture-contract-check.mjs:94-100` — native renderer 검증이 "신규 파일에 마커 문자열 존재"뿐. 대응 legacy writer 삭제는 검증하지 않음(자기 증명).
- CHANGELOG v53.15 P738 / v53.16 P739가 "Pages deployment is not blocked by …"를 명시 — **배포를 통과시키기 위해 게이트를 조정**한 이력이 그대로 기록돼 있다. 이 게이트들은 현재 `.github/workflows/ci.yml:101/113`에서 deploy를 blocking하므로, 원장을 정직하게 되돌리려면 게이트 로직을 같은 배치에서 함께 교체해야 한다(아니면 CI가 빨간불).

### F-03 — 이중 DOM writer 도입: 소유권 이전이 아니라 경쟁 writer 추가 (P0, 사용자 가시)

renderer owner가 legacy인 13개 route에 추가된 얇은 native 모듈(`src/ui/pages/analysis.js` 49줄, `entity.js` 66줄, `market.js` 72줄, `themes.js` 62줄, `portfolio.js` 70줄, `screener.js` 60줄)이 **legacy가 계속 쓰는 동일 DOM 노드를 덮어쓴다**. 대표 충돌:

| DOM id | legacy writer | native writer | 충돌 내용 |
|---|---|---|---|
| `home-trading-signal` | `aio-data.js:16500` (`_aioRenderHomeHero`/`refreshSignal`, 실제 Trading Score 5밴드 한국어 "환경 우호/양호…") | `analysis.js` (`home.action` = `WATCH/WAIT/REDUCE` 영문) | 모델·언어·척도 모두 다름 |
| `score-gauge-val` | `aio-core.js` `refreshSignalDashboard` (0~100 정수) | `analysis.js:18` (toy 모델 -1~1 `toFixed(2)`) | "62" vs "0.33" 경합 |
| `home-hero-total` | `aio-data.js:16414` | `analysis.js:13` (`availableInputs`) | 의미 다름 |
| `ticker-hero-price` 등 ticker-* | `aio-core.js:25740` 일대 | `entity.js:24-36` | 데이터 경로 다름 |
| `screener-results-body`·`screener-result-count` | `aio-data.js:1974/1977/2013` (22컬럼 innerHTML) | `screener.js:16-37` (5컬럼 replaceChildren) | **테이블 전체 경합 — native가 이기면 22컬럼 테이블에 5컬럼 행** |
| `pf-positions-tbody`·`pf-total-value`·`pf-total-pnl` | `aio-ui.js:1161`(liveEls) 등 | `portfolio.js:13-47` (5컬럼 행) | 동일 계열 |
| `live-news-feed` | `aio-data.js:11033/11128/12716/12748/13199` | `news.js:74-87` replaceChildren | **market-news도 실제로는 경합** — "legacy list renderer 삭제" 주장과 달리 5곳 잔존 |
| `briefing-live-news-list` | `aio-core.js:3573/3601/25313/25364` + `aio-data.js:11549/11710` | `news.js` | **briefing도 경합** — 6곳 잔존 |

도달 경로 확정: facade(`compatibility-facade.js:157-161`)가 legacy `showPage` 실행 **후** `router.transition`을 호출 → native mount가 나중에 실행되고, 이후 `aio:liveQuotes`/`aio:refresh:done`/모든 store dispatch마다 native가 재렌더(`analysis.js:40-45`)한다. 마지막 writer가 이기는 경합이며 AG-03(단일 writer)·실행 계획 §3 금지("legacy fetch/writer를 둔 채 병렬 추가") 위반. **native 모듈의 데이터가 6줄짜리 toy 도메인 산출이므로, 이기는 쪽이 native면 품질이 후퇴한다.**

news/screener/portfolio 컨테이너 경합 확정에 따라 "renderer native 4(briefing/guide/market-news/sentiment)"도 과대다. **대응 legacy writer가 실제 0인 진짜 renderer cutover는 guide·sentiment 2개뿐이며, market-news/briefing은 CONTESTED다.**

### F-04 — 항진(tautological) 도메인 parity 게이트 (P1)

`scripts/ci-domain-parity-check.mjs:10-25`는 "live vs backtest parity"를 **같은 파일 안에서 같은 fixture로 같은 함수를 두 번 호출**해 비교한다 — 항상 통과. 진짜 알고리즘(`computeTradingScore` `aio-core.js:21671`, `TRADING_SCORE` 구성 `:13103`, RRG, Weinstein, F&G 합성)은 추출되지 않았고, `src/domain/*`은 6~19줄의 **별개 단순 모델**이다(`signal/decision.js` 9줄, `home/summary.js` 6줄). AG-MODEL이 초록이지만 실제 모델에 대해 아무것도 증명하지 않는다.

### F-05 — store 성능 계약 부재 (P1, W5 전 필수)

`src/state/store.js`가 매 `dispatch`마다 전체 state를 2회 + **구독자당 1회** `structuredClone`한다(`store.js:17-20`). `bootstrap.js:194-213`은 `aio:liveQuotes` 1건에 orchestrator sync 6개를 배선 → 시세 이벤트 1건 = 6 dispatch × (2+구독 페이지 수) 전체 복제. screener 846행·OHLCV 이력을 slice로 옮기는 순간(W5) 이 설계는 유지 불가.

### F-06 — 배치 규율 붕괴: §8.1 일괄 유예 (P0)

실행 계획 §3.6은 "배치마다 전체 regression"을 요구하는데, 최신 checkpoint가 "full §8.1 validation deferred until packet sequence complete"로 유예했다. 결과가 git 이력에 있다: `b7bce36`(일괄 완료 선언) 직후 `b6bf926`·`737808c`(게이트 사후 수정) 연쇄. 유예된 대형 배치가 게이트에 걸려 사후 패치된 전형이다.

### F-07 — 문서 3중 상충 (P1)

같은 날 세 곳이 서로 다른 소유권을 주장: handoff frontmatter("All 17 route modules … without legacy observer ownership") vs 실행 계획 §10("native renderer 17개 중 어느 것도 완료되지 않음")·§2 checkpoint(native 4/legacy 13) vs `operations-status.json`(17/0). INDEX.md `:47`의 v53.15 correction("native renderer 0/17")과도 상충.

### F-08 — R3 미이행 (P2)

F-01~F-03은 각각 "게이트 회귀"에 해당하나 BUG-POSTMORTEM에 P번호로 기록되지 않았다(최신 P739). 반복 클래스 관점에서는 **"진척 인플레이션(선언식 상태 승격)"**이 신규 클래스 후보다 — P736/R352가 만들어진 바로 다음 배치에서 재발했으므로 승격 요건(반복)을 이미 충족.

### F-09 — 경미/관찰 (P3)

- lifecycle router는 `start()` 시 초기 route를 mount하지 않는다(`router.js:40-44`) — 첫 `aio:pageShown` 의존. legacy boot가 초기 showPage를 호출하므로 현재는 동작하나, ARX-15(shell cutover)에서 명시 초기 mount로 바꿔야 함.
- `installNavigation`은 showPage 몽키패치다(`compatibility-facade.js:157`) — 계획 §5.4가 금지한 패턴의 승인된 임시 예외임을 재확인. ARX-16 종료 대상.
- store 초기화 실패 시 `JSON.parse(JSON.stringify())` fallback은 `Date`/`NaN`을 소실시킨다 — evidence `observedAt`을 string으로만 유지하는 현 계약을 깨지 말 것.
- `market-snapshot` 계약이 `value <= 0`을 invalid로 판정(`contracts/market-snapshot.js:124`) — 금리·스프레드 계열이 0/음수가 되는 국면(ZIRP 등)에서 정당한 관측이 차단된다. Tier 0 확장 전에 단위별 유효범위로 교체.
- ci.yml 내부 주석(170~176행 "deploy needs에서 제외")이 실제 구성(341행 `needs`에 headless-tests 포함)과 상충 — 주석 정리 대상.

### F-10 — 신규 vault 무암호화 (P1, ARX-14 착수 전 필수 인지)

`src/storage/vault.js`의 `createPrivacyVault`는 **consent 게이트 + versioned envelope일 뿐 암호화가 없다**(평문 `aio:vault:portfolio` 키 저장). 레거시 포트폴리오 Vault는 AES-256이다. 현재는 bootstrap이 이 vault를 read 전용으로만 배선해 실해가 없지만, ARX-14(storage 이관)에서 이 모듈로 포트폴리오 write를 옮기면 **암호화 후퇴**가 된다. ARX-14 인수 기준에 "신규 vault의 at-rest 암호화가 레거시와 동등 이상(WebCrypto AES-GCM 등) + 기존 암호문 마이그레이션"을 추가해야 한다.

### F-11 — Trading Score 3중 구현과 백테스트 드리프트 (P1, RM-03 직접 근거)

Trading Score가 세 벌 존재한다: ① 라이브 `computeTradingScore`(`aio-core.js:21671~`, 증거 게이팅·TTL 캐시·역U자 모멘텀을 갖춘 실모델) ② `scripts/backtest-trading-score.mjs:35`의 **"v52.1 기준 로직/가중치/임계값 그대로 복사"** 재구현(파일 스스로 명시; 이후 라이브가 v53.x로 진화해도 사본은 자동 추적 안 됨 — parity는 과거 scratchpad 단위테스트 1회뿐, 상시 게이트 아님) ③ `src/domain/signal/decision.js`의 무관한 3입력 toy. RM-03의 추출이 완료되면 ①②③이 단일 모듈 소비로 수렴해야 하며, backtest 스크립트의 사본 함수 삭제를 RM-03 DELETE-LEDGER에 포함한다.

## 2. Route 소유권 진실표 (RM-00 재실측의 초기 가설)

RM-00은 이 표를 **선언이 아니라 재실측으로 확정**한 뒤 `architecture/route-owners.json`(신설)에 기록한다.

| 칸 | native 실측(가설) | 근거 |
|---|---|---|
| lifecycleOwner | 17 (조건부) | `PAGES` init 전부 null(`aio-core.js:25058~`), ESM router가 mount/dispose 소유. 단 showPage 본체(DOM show/hide·hash)는 legacy — "lifecycle=init/dispose 소유"로 정의를 명시하고 기록할 것 |
| rendererOwner | **2 — guide/sentiment** | 이 2개만 대응 legacy writer 실측 0. market-news/briefing은 CHANGELOG의 "legacy list renderer 삭제" 주장과 달리 `live-news-feed` 5곳·`briefing-live-news-list` 6곳의 legacy writer 잔존으로 CONTESTED(F-03). 나머지 13은 legacy renderer 생존 + thin native 병존 |
| dataOwner | 0 (sentiment는 IN_PROGRESS) | 모든 provider가 facade legacy projection을 read(`bootstrap.js:138-163`); directFetch 42→42 |
| chartOwner | 1 — sentiment | `sentiment.js`만 차트 소유. 나머지 차트는 legacy |
| narrativeOwner | 0~1 재실측 | ARX-01 카드와 §2 checkpoint가 상충 — sentiment 서술문 writer를 실측으로 판정 |

burn-down 기준선(v53.16): `explicitWindowWrites=1094 / directFetch=42 / directStorage=189 / htmlSinks=416` (`architecture/baseline.json`). 레거시 약 92,000줄(index.html 28,381 + js/ 63,474) vs src/ 96파일 3,218줄.

## 3. 복구 패킷

공통 규칙: 한 세션 = 한 패킷(RM-00+RM-04만 병합 허용). 매 패킷에서 실행 계획 §7 세션 카드 작성 + §8.1 전체 게이트 실행(유예 금지). 커밋·푸시·배포는 사용자 명시 지시 시에만.

### RM-00 — 진척 회계 복구 (P0, RM-04와 같은 세션 권장)

목표: 소유권 상태를 코드 파생 단일 소스로 만들고, 게이트를 "선언 강제"에서 "실측 검증"으로 뒤집는다.

1. `architecture/route-owners.json` 신설 — route×5칸 owner + (renderer/data native 선언 route에 한해) **부재해야 할 legacy 심볼 목록**을 명시. §2 진실표를 재실측해 채운다.
2. `scripts/build-operations-status.mjs`의 하드코딩 배열(43-48행) 삭제 → route-owners.json에서 파생. `nativeOwner`는 5칸 전부 native인 route만(현재 0). `cutoverStatus`는 `MIGRATION_IN_PROGRESS`.
3. `architecture/retirement-manifest.json` 정정: `nativeRoutes`→실측, `legacyRouteOwners` 복원, `status`→`MIGRATION_IN_PROGRESS`.
4. 게이트 재작성(같은 배치 필수 — F-02):
   - `ci-retirement-contract.mjs`: "17개 아니면 실패"(12행) 삭제 → "manifest = route-owners.json 파생값과 일치 + renderer-native route는 등록된 legacy 심볼이 `js/*`·`index.html`에 0건" 검증.
   - `ci-operations-status-check.mjs`: 항등식(15행)을 5칸 모델로 교체.
   - `ci-architecture-contract-check.mjs`: 마커 존재 검사에 **부재 검사**(route별 legacy 심볼 0건)를 추가.
   - `ci-domain-parity-check.mjs`: 이름을 `ci-domain-module-smoke-check.mjs`로 변경(항진성 해소는 RM-03). ci.yml의 step 이름도 함께.
5. 문서 정정: handoff frontmatter·실행 계획 checkpoint·INDEX.md에 동일한 실측 서술. CHANGELOG는 이력이므로 v53.16 항목 아래에 "정정" 줄 추기(기존 줄 삭제 금지 — 게이트-문서 계약 주의).
6. BUG-POSTMORTEM P740+ 기록: F-01/F-02/F-03 각 1건(또는 통합 1건 + 상세), 반복 클래스 표에 "진척 인플레이션 — 선언식 상태 승격" 신설, R352를 위반 규칙으로 연결(R3/R25).

인수: `node scripts/ci-*` 전부 PASS 상태에서 ops-status/manifest/3문서가 동일 실측값을 말함 + `git diff`로 하드코딩 배열 제거 확인 + P번호 존재. **주의: 정직한 값으로 되돌리면 현행 게이트가 실패하므로 2~4를 반드시 한 배치로.**

### RM-01 — 이중 DOM writer 차단 (P0, 사용자 가시 회귀 해소)

목표: renderer owner가 legacy인 route에서 native 모듈은 **legacy 소유 노드에 쓰지 않는다.**

1. contested ID 전수 측정(명령 예):
   `grep -ohE "'[a-z][a-z0-9-]+'" src/ui/pages/{analysis,entity,market,themes,portfolio,screener}.js | sort -u` 로 native write 대상 추출 → 각 id를 `js/*.js`·`index.html`에서 cross-grep → legacy writer가 있는 id = contested.
2. 조치 기본값: contested id에 대한 native `setText/textContent` 라인 **삭제**. 남기는 것은 route dataset 스탬프(`data-aio-architecture-*`)와 legacy가 쓰지 않는 신규 전용 노드뿐. 의미 충돌 2건(`home-trading-signal` 영문 액션, `score-gauge-val` -1~1 점수)은 최우선 삭제.
3. `renderSentimentSummaryProjection`(`sentiment.js:35-43`)의 cross-page sink(`home-fg-score`/`fg-score-*`)는 ARX-02에서 legacy F&G sink가 삭제됐다는 기록을 실측 검증 — legacy writer가 남아 있으면 동일 기준으로 한쪽 제거.
4. 정적 게이트 신설 `AG-DOM-WRITER`: `src/ui/pages/*`가 쓰는 id와 `js/*`가 쓰는 id의 교집합 0을 `ci-architecture-contract-check.mjs`에 추가(향후 route cutover 시 route-owners.json 갱신과 함께 교집합 허용 목록 이동).
5. 브라우저 게이트 확장: home 로드 후 `score-gauge-val` 텍스트가 정수(0~100) 형식인지, `home-trading-signal`이 한국어 라벨인지 assert.

6. **테이블·리스트 컨테이너 3종의 route별 결정**: screener/portfolio/market-news·briefing은 thin native가 콘텐츠 컨테이너(`screener-results-body`, `pf-positions-tbody`, `live-news-feed`, `briefing-live-news-list`)를 통째로 다시 그린다. 기본 권고 — **해당 route의 native 콘텐츠 렌더를 mount에서 제거**(dataset 스탬프만 유지)하고 legacy 소유를 명시 복원. 진짜 cutover(레거시 5~6곳 writer 삭제)는 해당 ARX route 패킷에서 수행하고, 이 배치에서 어중간한 병존은 금지.

DELETE-LEDGER(최소): `analysis.js:13-24`의 contested setText 전부, `entity.js:24-36` 중 contested, market/themes 동일 기준, screener/portfolio/news의 콘텐츠 컨테이너 렌더 호출부. 인수: 교집합 0 + §8.1 전체 PASS + 실브라우저에서 home/signal 한국어 라벨·정수 점수 유지 + screener/portfolio 테이블 컬럼 수 정상.

### RM-02 — store·이벤트 성능 계약 (P1, W5 진입 전 필수)

1. clone 전략 교체: `getState()` clone 제거 → dev 모드 deep-freeze로 불변 강제, dispatch는 reducer 구조 공유(현행 스프레드) 유지, 구독자 통지에 state 직접 전달. 필요 시 `getStateUnsafe`/`selectors만 공개` 중 택1을 ADR-0002 부록으로 기록.
2. selector 메모이제이션 유틸 1개(입력 참조 동등성 기반) 추가, 페이지 렌더는 관련 slice 변경 시에만.
3. `bootstrap.js:194-213`의 liveQuotes×6 orchestrator를 **단일 coalesced sync**(마이크로태스크 배칭, 이벤트당 dispatch ≤ slice 변경분)로.
4. 성능 게이트: 1,000행 screener fixture로 dispatch+notify p95 예산(초기값 5ms, 실측 후 확정) node 벤치를 `ci-architecture-contract-check`에 추가.

### RM-03 — 도메인 추출 실질화 (P1, route 패킷과 병렬 가능)

원칙: **레거시와 다른 새 모델을 병렬 도입하지 않는다**(F-03의 원인 패턴). 추출 = 동일 산식의 이동.

1. 1차 대상 `computeTradingScore`(`aio-core.js:21671`, 구성 `:13103`): 입력 인벤토리 → `src/domain/signal/trading-score.js` 순수 함수화(입력 스키마·`modelVersion`) → **legacy 함수가 내부에서 추출본을 호출**(단일 구현) → golden fixture는 헤드리스 실행에서 legacy 입출력 덤프로 생성 → parity 게이트 = 추출본 vs 덤프 대조.
2. 이후 순서: F&G 합성 → RRG(rsRatio/rsMomentum) → Weinstein/MTF. 각각 같은 패턴.
3. 기존 toy 모듈 처리: 추출본이 들어서는 시점에 해당 toy 모델 삭제(예: `signal/decision.js`의 3입력 점수). UI가 소비 중이면 RM-01 이후라 소비처가 없어야 정상.
4. `ci-domain-module-smoke-check`를 실 parity(덤프 대조)로 교체하고 이름을 되돌림.
5. **백테스트 사본 수렴(F-11)**: `backtest-trading-score.mjs`·`backtest-trading-score-longrun.mjs`의 복사된 서브스코어 함수를 삭제하고 추출된 `src/domain/signal/trading-score.js`를 import — 라이브/백테스트/native가 단일 구현을 소비. 사본 삭제를 DELETE-LEDGER에 기록.

### RM-04 — 배치 규율 복원 (P0, RM-00과 병합 가능)

1. 실행 계획 checkpoint의 "full §8.1 deferred …" 서술 삭제 → "매 배치 §8.1 전체 실행" 복원.
2. 세션 카드 없는 배치 금지 재확인. "한 세션 한 패킷" 재확인.
3. ~~push 경위 확인~~ → **해소(2026-07-19)**: 사용자가 해당 배포를 직접 지시했다고 확인함. 거버넌스 위반 아님. 단, "완료 선언과 게이트 조정이 같은 배치에서 일어나면 배포 전 원장 재검증"을 WORKFLOW-GOVERNANCE 점검 항목으로 추가 검토.
4. RM-00의 정정으로 공개 artifact(ops-status 등)가 바뀌므로, **정정본 배포(재게시) 여부는 사용자 지시 대기**로 명시.

### RM-05 — 게이트 실효성 보강 (P2)

1. AG-DOM-WRITER 상시화(RM-01 산출물), route cutover 시 허용 목록 이동 절차 문서화.
2. 브라우저 게이트에 native route 전체의 A→B→A 왕복 listener/timer/chart delta 0 assert 확장(현재 sentiment 위주).
3. 신규 ESM 코어(store/router/lifecycle/evidence-store/facade) 최소 unit 계약 테스트 추가 — 현재 신규 런타임은 계약 grep+브라우저 스모크 외 unit 부재.
4. `ci-operations-status-check`에 "route-owners.json과 ops-status 불일치 시 실패"를 유지해 원장 이원화 재발 차단.

### RM-06 — ARX 재진입 지침 (RM-00/01/04 완료 후)

1. 재진입점: W2(ARX-03/04 platform·state 채택)부터, route 순서는 실행 계획 §5 유지. sentiment 템플릿 기준 route당 실작업량은 UI 200~350줄 + data 4파일 + slice/selector/commands ≈ **600~800줄 신규 + 대응 legacy 수백~수천 줄 삭제**다. 17 route 전체로는 신규 약 1만 줄·삭제 수만 줄이 남은 실제 부피임을 전제하고 패킷을 계획한다(하루 만에 "전체 등록" 같은 판정 불가).
2. 진척의 유일한 지표: route-owners.json의 5칸 native 증가 + baseline.json 4개 카운터의 단조 감소. 신규 파일 수·마커·dataset 스탬프는 진척이 아니다(R352).
3. 대형 slice(screener/portfolio) 이관은 RM-02 완료가 선행 조건.

## 4. 실행 순서

```text
RM-00 + RM-04 (원장·게이트·규율 — 1세션)
  -> RM-01 (이중 writer 차단 — 1세션)
      -> RM-02 (store 성능 — 1세션)
      -> RM-03 (도메인 추출 — 병렬 가능, 다세션)
      -> RM-05 (게이트 보강 — 1세션)
          -> RM-06: ARX W2 재진입 (실행 계획 §4 파동 복귀)
```

## 5. 문서 전체 인수 기준

1. ops-status·retirement-manifest·route-owners.json·handoff·실행 계획·INDEX가 **동일한 실측 소유권**을 서술한다.
2. contested DOM writer 0 (AG-DOM-WRITER PASS).
3. 항진 게이트 0 — parity는 legacy 덤프 대조다.
4. 그 정직한 상태로 §8.1 전체 + ci.yml 전체가 PASS다(게이트를 낮춰서가 아니라 검증을 바꿔서).
5. F-01~F-03의 P번호와 "진척 인플레이션" 반복 클래스가 BUG-POSTMORTEM에 존재한다.
6. 이후 모든 상태 승격이 route-owners.json 파생값으로만 이뤄진다.

## 6. 이 감사의 커버리지와 미검증 고지 (2026-07-19 2차 스윕 후 최종)

**전문 정독(라인 단위 100%)**: `src/**` 96/96 파일 · `sw.js` · `worker/data-plane.js` · 게이트 스크립트(architecture-contract/browser/retirement/operations/domain-parity) · `architecture/*.json` 매니페스트 · CODE-MAP(실측 대조 일치) · 관련 핸드오프/ADR 문서 전체.

**구조 단위 검증(앵커 정독 + 계통 스윕)**: `index.html` — head/CSP 부재/SRI/preload, `<script>` 전수 열거(외부 8 + inline 11 + module 1, CODE-MAP 주장과 일치) · `aio-core.js` — showPage(:25570)/PAGES(:25058)/computeTradingScore(:21671~) 정독, TimerRegistry 채택(raw setInterval 1건뿐) · `aio-data.js` — 스케줄러/뉴스·screener 렌더러/contested writer 라인 확정 · `aio-chat.js` — CHAT_CONTEXTS/BYOK Anthropic·Perplexity 엔드포인트/innerHTML sink 위치 · `aio-ui.js`/`aio-tests.js`/`aio-glossary.js` 구조 · workflows 3종(cron·push 하드닝·watchdog 게이트) · `fetch-data.mjs` 구조(quote 검증 tolerance·KST 사이클) · backtest 스크립트(사본 확인) · 위험 클래스 전수 grep: eval/new Function/document.write **0건**, DOMPurify 사용처(core 9·chat 3·index 4), localStorage 키 인벤토리, 외부 호스트 인벤토리(FMP·allorigins·rsshub·yahoo·corsproxy 상위 — 서드파티 CORS 프록시 의존은 기존 문서의 SPOF 지적과 일치).

**여전히 검증하지 않음(정적으로 불가능하거나 범위 밖)**: 4대 레거시 번들 92K줄의 문자 그대로 전 라인(위험 중심 표적+스윕으로 대체), live 사이트의 v53.16 실반영·런타임 거동(이중 writer 경합의 실제 승자 포함 — 정적 근거로는 native 후행 실행이 우세하나 실브라우저 확인 필요), Cloudflare fast plane 실배포, provider rights, 장시간 heap/listener soak, AI 응답 품질(→ AI-CHAT-INSTITUTIONAL-AUDIT), 알고리즘의 금융적 타당성 자체(산식 구조만 판정).

이 문서의 판정이 이후 실측과 다르면 실측을 우선하고 이 문서를 정정한다.

## 7. 금지 목록

- RM 완료 전 새 ARX 패킷 착수, 새 병렬 계획 문서 생성(이 문서가 유일한 RM 원장)
- 삭제 0건 architecture 배치, 선언식 상태 승격, 게이트를 낮춰서 초록 만들기
- legacy와 다른 산식의 병렬 도입(도메인은 추출만)
- 사용자 명시 지시 없는 커밋·푸시·배포

## 8. 세션 로그 (실행 계획 §7 양식)

```text
Packet: RM-00+RM-04
Checkout/HEAD/version/liveRevision: d147a76 (d147a7648a15899e3020b041a11cdc01af55c927) / v53.16 / live revision 미확인(이번 세션 배포 없음)
Scope route/metric/layer: 17-route 소유권 회계 전체(route-owners.json 신설) + 4개 게이트 재작성 + 배치 규율 문서 정정. 특정 route 렌더러 작업 아님(RM-01 스코프 아님).
Owner before: lifecycle 선언 17/17(하드코딩) / renderer 선언 17/17(하드코딩, 실측 2/17) / data 선언 불명 / chart 선언 불명 / narrative 선언 불명
Owner after:  lifecycle 실측 17/17 / renderer 실측 2/17(guide, sentiment) / data 실측 0/17 / chart 실측 1/17(sentiment) / narrative 실측 1/17(sentiment) — route-owners.json이 이후 유일한 소스
Files read: RULES.md(R352/R3/R25), BUG-POSTMORTEM.md(반복 클래스 표·최신 P), ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md 전문, ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md 앞부분, CODE-MAP.md, bootstrap.js/router.js/routes.js/legacy-observer.js/compatibility-facade.js, src/ui/pages/{guide,sentiment,analysis,entity,market,themes,portfolio,screener,news}.js 전문, src/state/store.js, src/data/contracts/operations.js, 4개 대상 게이트 원본, retirement-manifest.json/baseline.json/golden-routes.json/release-manifest.json, js/aio-core.js·aio-data.js·aio-ui.js 내 contested id 교차 grep 다수
Files changed: architecture/route-owners.json(신규) · architecture/retirement-manifest.json · public-data/operations-status.json · scripts/build-operations-status.mjs · scripts/ci-architecture-contract-check.mjs · scripts/ci-retirement-contract.mjs · scripts/ci-operations-status-check.mjs · scripts/ci-domain-parity-check.mjs→ci-domain-module-smoke-check.mjs(rename) · .github/workflows/ci.yml · _context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md · _context/ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md · _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md(이 문서) · _context/INDEX.md · _context/WORKFLOW-GOVERNANCE.md · _context/BUG-POSTMORTEM.md · CHANGELOG.md
DELETE-LEDGER before edit:
  - declaration: `build-operations-status.mjs:43-48` 하드코딩 배열(`nativeOwner`/`legacyOwner`/`nativeLifecycleOwner`/`nativeRendererOwner`/`cutoverStatus` 리터럴) — 삭제 후 route-owners.json 파생으로 교체
  - callers: 없음(리터럴 자체가 대상, 별도 호출부 없음)
  - global writer: 해당 없음 — 이 패킷은 회계/게이트 패킷이며 route DOM writer 변경 없음
  - DOM/chart/narrative sink: 해당 없음(RM-01 스코프로 이월, route-owners.json에 contested id 목록으로 인계)
  - event/timer/storage: 해당 없음
  - tests/docs: `ci-retirement-contract.mjs`의 "17개 아니면 실패" 하드 조건, `ci-operations-status-check.mjs`의 `requiredNativeRoutes` 하드코딩 배열, 실행계획/핸드오프의 "all 17 native"·"validation deferred" 서술 — 전부 실측 검증 또는 취소선 정정으로 교체(문서는 삭제 아닌 취소선+추기)
Burn-down before/after: explicitWindowWrites 1094→1094 · directFetch 42→42 · directStorage 189→189 · htmlSinks 416→416 (무변경 — 이 패킷은 legacy 코드 삭제가 대상이 아니며 정상. RM-01/02/03에서 감소 예정). 유일한 실질 변화는 `operations-status.json`의 `nativeRendererOwner` 17→2 — "감소"가 아니라 하드코딩 제거로 인한 정직화.
New compatibility introduced and retirement packet: 없음(신규 호환 계층 도입 없음). `retirement-manifest.json`의 `schemaVersion`을 v1→v2로 올리고 `nativeRoutes` 단일 필드를 `nativeLifecycleRoutes`/`nativeRendererRoutes`로 분리했다 — 소비자는 `ci-retirement-contract.mjs` 하나뿐이며 같은 배치에서 갱신했다.
Local gates: §8.1 전체(11개) PASS. 추가로 `ci-retirement-contract.mjs`/`ci-domain-module-smoke-check.mjs` 및 나머지 `ci-*.mjs` 20종 전부 PASS(`ci-live-invariant-check.mjs`만 의도적 제외 — 라이브 사이트 네트워크 의존이라 로컬 전용 회계 패킷과 무관, WORKFLOW-GOVERNANCE 기존 지침에 따름). headless 1098/1098, critical10 10/10, a11y 17/17, viewport(FULL_INIT) 68/68(worstOverflow 0px·jsErrors 0), Portfolio Vault E2E 8케이스 PASS, knowledge-lint 0 warning, data-lineage 15 PASS/1 WARN(사전 존재하던 SEC 커버리지 이슈, 이번 변경과 무관).
Browser evidence: `ci-architecture-browser-check.mjs` PASS — router/store route 둘 다 `sentiment`, badge `심리: 판정 보류`, guide native(`resultButtons` 정상), routeRoundTrip true, browserErrors 0.
Live evidence: 없음 — 커밋·푸시·배포 없음(사용자 명시 지시 대기, RM-04 §4). `public-data/operations-status.json` 재생성은 로컬 파일 변경일 뿐 배포 아님.
Unverified/blockers: RM-01(이중 DOM writer 제거) 미착수 — contested id는 `route-owners.json`에 route별로 문서화·인계 완료. RM-02(store clone 성능)·RM-03(도메인 추출·항진 게이트 실질화)·RM-05(게이트 보강) 전부 미착수. `themes`/`theme-detail`의 일부 contested id(`rrg-quadrant-cards`, `theme-detail-title`)와 sentiment의 cross-page sink(`home-fg-score`)는 RM-01에서 확정 필요(route-owners.json `openItems` 참조).
Status: VERIFIED_LOCAL (RM-00+RM-04 스코프 한정 — §5 전체 인수 기준의 항목 2·3은 RM-01/RM-03 완료 전까지 미충족이며 의도된 상태)
```

### 세션 카드 — RM-01 (같은 세션, RM-00+RM-04 직후 이어서 실행)

```text
Packet: RM-01
Checkout/HEAD/version/liveRevision: RM-00+RM-04가 auto-commit-on-stop 훅으로 806013b에 이미 커밋된 상태에서 이어서 시작 / v53.16 / live revision 미확인(배포 없음)
Scope route/metric/layer: 이중 DOM writer 차단 — src/ui/pages/{analysis,entity,market,themes,portfolio,screener,news,sentiment}.js 8개 모듈, ci-architecture-contract-check.mjs, ci-architecture-browser-check.mjs, architecture/route-owners.json
Owner before: rendererOwner 15개 route가 legacy renderer 생존 + native가 동일 DOM에 경합 쓰기(문서화된 contested) / sentiment는 own-page 대부분 native이나 home-fg-score·sent-analysis-text 2개 id 미발견 경합 잔존
Owner after:  rendererOwner 분류 자체는 불변(여전히 legacy 15 / native 2 — 진짜 cutover는 이 배치 스코프 아님), 단 native의 경합 쓰기 0건으로 실측 정정. sentiment의 narrativeOwner는 native→legacy로 하향 정정(sent-analysis-text 삭제로).
Files read: route-owners.json 전체, src/ui/pages/{analysis,entity,market,themes,portfolio,screener,news,sentiment,guide}.js 전체 재독, js/aio-core.js·aio-data.js·aio-ui.js·index.html의 40+ id cross-grep, src/app/bootstrap.js(모듈 배선 재확인)
Files changed: src/ui/pages/{analysis,entity,market,themes,portfolio,screener,news,sentiment}.js(8개) · scripts/ci-architecture-contract-check.mjs · scripts/ci-architecture-browser-check.mjs · architecture/route-owners.json · _context/BUG-POSTMORTEM.md · CHANGELOG.md · _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md(이 문서)
DELETE-LEDGER before edit:
  - declaration: analysis.js 12개 setText, entity.js 13개 text(), market.js의 renderQuote/renderMetric 전체(+ 미사용 ROUTE_QUOTES/ROUTE_METRICS/format), themes.js의 renderThemes/createThemeCard 전체, portfolio.js 10개 setText+테이블 렌더, screener.js 5개 setText+테이블 렌더, news.js의 renderStories/createStory/sourceItems/displayTitle/displaySummary/safeHref/createModel 전체, sentiment.js의 home-fg-score(1줄)·sent-analysis-text(1개 setText) — 총 8개 파일
  - callers: news.js의 onClick(필터 4종+refresh)/onRefresh 핸들러와 그 addEventListener 등록·해제 전체(더 이상 렌더할 콘텐츠가 없어 상호작용 로직도 함께 제거)
  - global writer: 해당 없음(native 쪽 로컬 DOM 쓰기 삭제이지 전역 변수 아님)
  - DOM/chart/narrative sink: 위 declaration과 동일 — 이 배치의 핵심 삭제 대상
  - event/timer/storage: news.js의 aio:newsUpdated/aio:refresh:done/aio:serverDataLoaded 리스너는 유지(대신 dataset 상태만 갱신), click 리스너만 제거
  - tests/docs: `ci-architecture-contract-check.mjs`의 news.js `renderStories`/`aioArchitectureRenderer='native'` 마커 요구 삭제, `ci-architecture-browser-check.mjs`의 `briefingRenderer !== 'native'` 기대값을 `=== null` + `aioArchitectureSlice==='news'`로 정정
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 legacy 카운터 전부 무변경(1094/42/189/416) — 이 배치는 legacy 파일을 건드리지 않음(native 쪽 경합 쓰기만 삭제). src/ui/pages 순증감은 258 insertions(+)/540 deletions(-)(net -282줄) — 진짜 legacy burn-down이 아니라 native 쪽 정리임을 명시.
New compatibility introduced and retirement packet: 없음. `route-owners.json`에 `domWriterIntersectionAllowlist`(fg-score-big/pc-score-big, 근거 명시) 신설 — 유일하게 남기기로 한 "교집합"이며 legacy 읽기 전용 의존 관계로 문서화됨.
Local gates: §8.1 전체(11개) PASS(AG-DOM-WRITER 포함 재실행) + headless 1098/1098 + critical10 10/10 + a11y 17/17 + viewport(FULL_INIT) 68/68 + knowledge-lint 0 warning + Portfolio Vault E2E 8/8 + ux-default-path(div 3846/3846) + doc-currency(±500줄 트리거 미충족) 전부 PASS.
Browser evidence: `ci-architecture-browser-check.mjs` PASS — home `score-gauge-val`="52*"(정수+legacy stale 표기 허용 패턴), `home-trading-signal`="중립 · 관망"(한국어), market-news/briefing `aioArchitectureRenderer=null`+`aioArchitectureSlice='news'`, sentiment/guide 기존 검증 불변, browserErrors 0.
Live evidence: 없음 — 커밋(로컬)만 사용자 지시, 배포는 미지시.
Unverified/blockers: 진짜 ARX cutover(legacy 삭제 + native 단독 소유) 15개 route 전부 미착수 — 이번 배치는 "native가 legacy를 침범하지 않는다"만 확정했다. macro FRED 5개 id의 완전 비활성 코드는 native 쪽만 제거했고 legacy 쪽 해당 기능 부재 자체는 별도 버그(이번 스코프 아님, 데이터 획득 갭으로 알려진 이슈와 연결 가능성 — 후속 세션 검토 권고). themes/theme-detail의 rrg-quadrant-cards 콘텐츠(카드 목록 자체, 상태 텍스트 제외)에 대한 legacy 쓰기 라인 번호는 aio-core.js:22646 한 곳만 확인, 더 있을 가능성은 낮지만 100% 전수는 아님.
Status: VERIFIED_LOCAL (RM-01 스코프 한정 — AG-DOM-WRITER PASS로 §5 항목 2 "contested DOM writer 0"는 이번 배치가 정의한 범위 내에서 충족. 진짜 legacy 삭제가 없으므로 route별 rendererOwner는 여전히 legacy 15/guide+sentiment 2 그대로)
```
