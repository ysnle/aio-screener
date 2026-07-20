---
verified_by: Claude Fable 5 (repository-wide structural audit; 발견마다 파일:라인 증거 인용); RM-00~05 실행 Claude Sonnet 5; RM-03 item 2 실행 Claude Sonnet 5
last_verified: 2026-07-20
confidence: high
auto_refresh: false
target_version: v53.16
status: RM-00~05_COMPLETE_RM-03-ITEM2_COMPLETE_ARX_REENTRY_READY
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

**RM-02** (같은 세션 이어서 실행):
- `src/state/store.js`: dispatch당 clone 2회+구독자당 1회 제거. 1000행 screener fixture 벤치 — 구 설계 p95 7.49ms(300 표본) → 신 설계 p95 0.044~0.111ms. `devMode`(기본 false) 옵션에서만 deep-freeze로 불변 강제.
- `architecture/adr-0002-vite-typescript-and-state-access.md` 신설 — Vite/TS 본 결정은 여전히 보류, "부록"으로 getState()/selectors 결정만 기록(`getStateUnsafe` 전체 rename은 기각 — 근거 문서화).
- `src/state/memoize.js` 신설(`createSelector`, `subscribeToSlice`) + `sentiment.js`에 실배선(관련 없는 dispatch로 인한 차트 재그리기 제거).
- `bootstrap.js`의 `aio:liveQuotes` 6개 개별 리스너 → 마이크로태스크 coalescing 단일 리스너 1개.
- `ci-architecture-contract-check.mjs`에 1000행 screener dispatch+notify p95≤5ms 성능 게이트 추가(구 설계 회귀 시 7.49ms로 실패 확인).
- BUG-POSTMORTEM P742.

**RM-03** (같은 세션 이어서 실행, item 1·5만 — item 2·3은 아래 미해결 항목 참조):
- `computeTradingScore`(`js/aio-core.js:21671`, 5서브스코어+7보정+TTL 20s 캐시)를 `src/domain/signal/trading-score.js`(`computeTradingScoreModel`, 순수 함수)로 추출. 헤드리스 7시나리오 골든 fixture(`architecture/fixtures/trading-score-golden.json`, `scripts/dump-trading-score-fixtures.mjs`로 생성)와 완전 일치 확인.
- **배선 버그 발견·수정**: `compatibility-facade.js`의 `exposeArchitecture()`가 `window.AIO_ARCH` 노출 필드를 하드코딩 allowlist로 cherry-pick — 새 브릿지 함수가 그 목록에 없어 실브라우저에서 조용히 누락(골든 fixture 대조로는 못 잡고 `ci-architecture-browser-check.mjs`의 home 화면 검증에서 발견, score가 "null*"로 표시됨). 한 줄 추가로 수정.
- `scripts/backtest-trading-score.mjs`의 5개 서브스코어 사본 삭제 → 같은 모델 호출로 수렴. 그 과정에서 사본이 라이브와 이미 3가지로 드리프트돼 있었음을 확인(trend null-vs-50 폴백, 라이브가 제거한 HYG 달러가격 임계 잔존, 존재하지 않는 aaiiBear 보정) — F-11이 정확히 예견한 현상.
- `ci-domain-parity-check.mjs`(구 `ci-domain-module-smoke-check.mjs`) 실 parity 추가 + 이름 원복. market/macro/portfolio/screener/news/technical 5종은 여전히 smoke-only(RM-03 item 2, 이번 배치 범위 아님).
- BUG-POSTMORTEM P743.

**RM-03 미해결(의도적 보류, 2026-07-19 시점)**: item 3(`signal/decision.js`의 3입력 toy 모델 삭제)은 `src/data/normalize/analysis.js`가 여전히 `deriveSignalDecision(...)`의 `.status`를 소비 중이라 보류했다 — RM-01이 DOM 렌더는 끊었지만 데이터 파이프라인 자체는 안 끊었다. 삭제하려면 `normalizeAnalysis`의 signal 유도 로직을 무엇으로 대체할지(예: `computeTradingScoreModel` 결과를 signal 슬라이스에 매핑) 별도 설계 결정이 필요하며, 실시간 사용자 상태에 영향을 주는 변경이라 이번 세션 스코프를 벗어난다고 판단해 보류했다. 후속 세션 과제로 명시.

**RM-03 item 2 (다음 세션, 2026-07-20, P745/P746)**: F&G 합성·RRG·Weinstein/MTF를 재실측 기반으로 완료했다.
- **F&G**: 전수 grep(CNN 7-factor 방법론 키워드 safe-haven/junk-bond/priceStrength/synthesize 전부 0건) 결과 로컬 합성 로직 자체가 존재하지 않음을 확인 — `fetchFearGreed`는 CNN이 이미 계산한 값을 그대로 받는다. "F&G 합성 추출"은 원 handoff(F-11)의 전제 오류였고, 대상이 없으므로 추출할 것도 없다.
- **RRG**: `calcLiveRS`/`classifyRRG`(index.html)의 RS-Ratio/RS-Momentum 계산과 사분면 분류를 `src/domain/themes/rrg.js`(`computeRelativeRotation`)로 이관. legacy는 `window.AIO_ARCH.computeRelativeRotation` 호출 + fail-closed 폴백으로 축소.
- **Weinstein/MTF**: MA-스택/스테이지 분류(`shortBull`~`stageEstimate`, 원래 `calcTechnicalSnapshot` 내부)를 `src/domain/technical/stage.js`(`classifyMovingAverageStructure`)로, MTF의 일간/주간/중기 추세 분류를 같은 파일의 `deriveMultiTimeframeView`로 이관.
- **부수 발견 1(중요)**: index.html에 Weinstein(`updateWeinsteinStage`)·MTF(`updateMTF`) 각각 구현이 두 벌 존재했다 — `function name(){}` 선언(구 라이브 시세 기반 복합점수 모델) 뒤에 sloppy-mode 재대입 `name = function(snapshot){}`(P712/R340의 신 OHLCV 기반 모델)가 있어, 앞선 구현은 어떤 호출 경로로도 도달 불가능한 완전 사문(死文)이었다(376줄, `_spy_ath` localStorage 조회 포함). 실행 계획·핸드오프가 "RRG/Weinstein/MTF 추출"을 computeTradingScore와 "같은 패턴"으로 가정했던 전제 자체가 부정확했다는 뜻 — 실제로는 추출 전에 먼저 사문 코드부터 걷어내야 했다.
- **부수 발견 2**: breadth 페이지의 `updateWSAnalysis()`(js/aio-ui.js)가 자기 페이지가 아니라 technical 페이지의 DOM(`ws-analysis`)에 쓰고 있던 고아 함수임을 확인해 삭제. `breadth-stage-summary`(breadth 페이지)·`mtf-verdict-text`(technical 페이지)는 위 사문 코드가 유일한 writer였다는 것도 확인 — 즉 이 두 표면은 이번 삭제 이전부터 이미 라이브로는 절대 갱신되지 않는 영구 플레이스홀더였다. 무엇을 채울지는 제품 결정이 필요해 이번 배치에서는 고치지 않고 명시 이월(QA-CHECKLIST 열린 백로그).
- **parity**: RRG/Weinstein/MTF 모두 `git stash`로 추출 전 커밋 상태를 일시 복원해 legacy에서 직접 헤드리스 덤프(`scripts/dump-rrg-fixtures.mjs`, `dump-weinstein-mtf-fixtures.mjs`, 8개 시나리오씩)한 골든 fixture와 완전 일치를 `ci-domain-parity-check.mjs`에서 확인. `bootstrap.js` api 객체와 `compatibility-facade.js`의 `exposeArchitecture()` 양쪽에 신규 함수를 함께 등록해 P743이 발견한 "노출측 allowlist 누락" 배선 버그의 재발을 피했다(브라우저 게이트도 별도로 PASS 확인).
- **item 3 재확인**: `deriveSignalDecision`의 toy 출력은 `src/ui/pages/analysis.js`(RM-01 이후)가 `.status`만 읽고 `.action`/`.score`/`.reasons`는 어디서도 읽지 않음을 소비처 전수 grep으로 재확인 — 즉 이 toy 모델은 현재 화면에 어떤 잘못된 값도 노출하지 않는다. 그러나 올바른 대체(`computeTradingScoreModel`의 0~100 점수를 action/label로 매핑)는 `normalizeAnalysis`에 vix/vvix/dxy/tnx/oilPrice/pcr/hyBp/newsSentimentScore/newsRiskSignals를 새로 threading해야 하는 작업이며, 이는 실행 계획 §4의 ARX-11(technical+signal+home orchestration, W4/W5/W7 선행 필요)이 이미 계획해 둔 별도 파동이다. 이번 세션은 그 사실을 실측으로 확정하는 데 그치고 조기·부분적인 매핑을 임의로 만들지 않았다(레거시와 다른 산식의 병렬 도입 금지 원칙과 동일한 이유로, "일부만 미리 연결"도 같은 리스크).
- 상세: `_context/BUG-POSTMORTEM.md` P745(추출)·P746(고아 DOM 발견).

**RM-05** (같은 세션 이어서 실행):
- item 1(AG-DOM-WRITER 상시화)·item 4(ops-status 이원화 방지)는 RM-01/RM-00에서 이미 구현됨 — 재확인만 하고 `route-owners.json`에 route cutover 시 허용목록 이관 절차를 명시.
- item 2: `ci-architecture-browser-check.mjs`에 17-route 전체 2랩 왕복 리소스 누수 검증 추가(canvas 수·legacy 타이머 레지스트리 크기가 랩1↔랩2 사이 불변). 이 작업 중 **entity.js/market.js/themes.js 3개 모듈이 RM-01에서 `aioArchitectureRoute` lifecycle 마커를 빠뜨린 잔여 결함을 발견·수정**(9개 route 30초 타임아웃 — 기존 게이트는 5개 route만 방문해 못 잡았음).
- item 3: `scripts/ci-esm-core-unit-check.mjs` 신설 — store/router/lifecycle/evidence-store/facade 5개 ESM 코어를 route 배선과 독립적으로 격리 unit 검증, ci.yml 배선.
- BUG-POSTMORTEM P744.

**RM-06** (ARX 재진입 지침 — 2026-07-19 작성 시점엔 "다음 세션을 위한 선언"이었으나, 2026-07-20 같은 세션에서 사용자가 ARX-03/04 착수를 명시 지시해 실제로 재진입했다. 이하 원문은 지침으로서 보존하고, 실제 착수 결과는 새 하위 항목으로 추가):
- RM-00·RM-01·RM-04(P0 선행조건) 전부 완료. RM-02·RM-03(item 1·5)·RM-05도 같은 세션에서 완료. **2026-07-20 세션에서 RM-03 item 2도 완료**(F&G는 대상 없음으로 확정, RRG·Weinstein/MTF는 실 parity로 추출). item 3은 "별도 설계 결정 필요"가 아니라 "ARX-11 스코프임을 실측으로 확정, 조기 부분 구현은 하지 않음"으로 상태를 정정 — RM-03 전체가 이제 의도적으로 스코프를 좁힌 상태로 완결됐다(§0.1 RM-03 item 2 블록 참조).
- **재진입점**: 실행계획 §4 파동 W2(ARX-03 commands/selectors, ARX-04 platform/storage/sanitizer 채택)부터. route 순서는 실행계획 §5 유지(guide/sentiment 이후 다음은 market-news+briefing 진짜 cutover, 그다음 macro+fxbond+breadth 순).
- **작업량 전제**: sentiment 템플릿 기준 route당 실작업량 ≈ 600~800줄 신규(UI 200~350 + data 4파일 + slice/selector/commands) + 대응 legacy 수백~수천 줄 삭제. 17 route 전체로는 신규 약 1만 줄·삭제 수만 줄 잔존 — "하루 만에 전체 등록" 판정 불가를 다시 확인.
- **진척의 유일한 지표**: `route-owners.json`의 5칸(lifecycle/renderer/data/chart/narrative) native 개수 증가 + `architecture/baseline.json` 4개 카운터(explicitWindowWrites/directFetch/directStorage/htmlSinks)의 단조 감소. 신규 파일 수·마커·dataset 스탬프(`aioArchitectureRoute`/`Slice`/`Renderer`)는 진척이 아니다(R352, F-01의 교훈 반복 확인).
- **screener/portfolio 이관 선행조건**: RM-02(store 성능)가 완료됐으므로(1000행 fixture p95=0.04ms) 이제 대형 slice 이관(W5)의 성능 전제는 충족. 단 W5 자체는 W2~W4 완료 후 순서.
- **현재 실측 요약**(다음 세션 시작 시 재확인 없이 신뢰하지 말 것 — `node scripts/ci-retirement-contract.mjs`로 재확인): lifecycle native 17/17, renderer native 2/17(guide, sentiment), data native 0/17, chart native 1/17(sentiment), narrative native 0/17(RM-01에서 sentiment도 legacy로 재분류됨) — **RM-03 item 2는 도메인 계층 작업이라 이 5칸은 불변**(route ownership이 목표가 아니었음, 정상). `architecture/baseline.json`(2026-07-20 갱신): explicitWindowWrites=1088(1094→1088), directFetch=42(불변), directStorage=187(189→187), htmlSinks=410(416→410) — RM-03 item 2가 삭제한 사문 Weinstein/MTF 복합점수 코드(376줄, innerHTML 6곳·localStorage 2곳 포함)만큼 처음으로 실질 감소했다. `ci-domain-parity-check.mjs`의 실 parity 대상은 이제 3개(trading-score/RRG/Weinstein-MTF) — 원래 항진이던 7개(market/macro/portfolio/screener/news/technical/signal) 중 어느 것도 이번 배치로 줄지 않았다(RRG·Weinstein/MTF는 그 7개 목록에 없던 별도 추가 항목).

**RM-06 실제 착수 (같은 날 2026-07-20, 사용자 지시, P747)**: ARX-03을 8개 domain 전수 재측정해 command/reducer 경계가 이미 클린함을 확인(UI dispatch 0건, 승격은 아님 — legacy가 여전히 렌더를 소유). ARX-04는 실행 계획이 "closed"로 선언했던 것과 달리(F-01~F-03류 미실측 서술이었음, 실행계획 문서에 취소선 없이 정정 각주 추가) 8개 provider 중 실 fetch를 쓰는 곳이 0개였음을 확인 — screener provider를 AR-07의 market-snapshot.json 로더 선례를 따라 `public-data/screener.json`을 `platform/http.js`로 실제 fetch하도록 재작성(846행 실수신, legacy fetch·SCREENER_DB 병합은 additive 유지). 그 과정에서 `normalizeScreener`의 `rank` 필드가 P715류 null→0 오염 버그였음을 실브라우저 상태 덤프로 발견·수정. 상세 세션 카드: `_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md`(실행계획 문서가 ARX 세션 카드의 정식 위치이므로 이 원장에는 요약만 유지).

**RM-06 두 번째 슬라이스 (같은 날, 사용자 지시, P748)**: sentiment를 다음 ARX-04 대상으로 검토하다가 **screener/entity/themes(RM-01이 native 렌더를 dataset-marker-only로 축소, 블러스트 반경 0)와 달리 sentiment는 ARX-01로 이미 실제 라이브 렌더링 중이라 데이터 소스 교체가 사용자 가시 회귀 위험**이라는 걸 발견해 사용자에게 확인 후 entity로 전환했다. entity provider가 `public-data/sec-fundamentals.json`을 실 fetch하도록 재작성 — legacy `_fundAnalysisData`(교체 대상)를 grep해보니 AI 채팅 티커분석 경로에서만 대입되고 일반 탐색에서는 항상 null이었음을 확인해, 이 교체가 순수 개선(기존 동작 파괴 없음)임을 검증했다. `.quote`/`.options`는 이번 슬라이스 범위 밖. 실 Chromium에서 심볼 "A"(SEC 데이터셋 존재)와 "ZZZZNOTREAL"(미존재, fail-closed) 양쪽 확인. **ARX-04 domain 확장 원칙 확정**: 다음 domain을 고를 때 "native 렌더가 실제로 이 slice를 소비하는가"를 최우선 안전 기준으로 삼는다 — market/themes(둘 다 라이브 quote 파이어호스 의존)와 sentiment는 이 기준으로 후순위, portfolio/analysis는 애초에 독립 fetch 대상이 아님(로컬 Vault/파생 데이터). 남은 안전 후보는 news(다중 소스라 screener/entity보다 복잡) 정도.

**남은 항목(다음 세션)**: (1) `breadth-stage-summary`/`mtf-verdict-text` 두 표면에 무엇을 채울지 제품 결정(P746) — QA-CHECKLIST 열린 백로그. (2) RM-03 item 3의 실제 구현은 ARX-11(W4/W5/W7 선행) 스코프로 확정. (3) `ci-domain-parity-check.mjs`의 나머지 7개 smoke-only 모델(market/macro/portfolio/screener/news/technical/signal)의 실 parity화. (4) ARX-04: 나머지 6개 domain(sentiment는 라이브 렌더 회귀 위험으로 신중 접근 필요, market/themes는 quote 파이어호스 의존, news는 다중 소스+번역+dedup, portfolio/analysis는 독립 fetch 대상 아님)의 실 fetch 전환, screener·entity의 in-flight fetch abort-on-dispose 보강, `_aioComputeFactorRanks` 랭킹 산식 도메인 추출(screener slice의 score/rank는 항상 null). (5) ARX-04 완료 판정은 "첫 slice의 legacy fetch/DOM writer 실제 삭제"가 있어야 하며, screener·entity 둘 다 추가식이라 그 기준 미충족 — legacy cutover 시점은 해당 route의 진짜 렌더 전환(W5 ARX-09/10) 때가 자연스러움.

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

### F-12 — F&G는 로컬 합성 대상이 없고, Weinstein/MTF는 legacy 자체가 이미 사문+실구현의 이중 상태였다 (P1, RM-03 item 2 직접 근거, 2026-07-20 실측)

F-11이 세운 "F&G 합성 → RRG → Weinstein/MTF, 각각 같은 패턴(추출=동일 산식 이동)"이라는 계획은 두 지점에서 실제 코드와 달랐다.

1. **F&G 합성 로직 자체가 존재하지 않는다.** `fetchFearGreed`/`_applyFearGreedScore`(`js/aio-data.js:16766~16824`)는 CNN이 이미 계산한 점수를 그대로 fetch한다. CNN의 7-factor 방법론(market momentum/stock price strength/stock price breadth/put-call options/junk bond demand/market volatility/safe haven demand) 키워드로 `js/*.js`·`index.html` 전수 grep해도 로컬 합성 코드는 0건이다. `src/domain/sentiment/metrics.js`의 `fearGreedBand`/`deriveSentimentSummary`는 이미 존재하는 점수를 밴드·라벨로 바꾸는 로직일 뿐, "합성"이 아니다(그리고 이미 이전 세션에 추출돼 있었다). 결론: F&G는 RM-03 item 2의 추출 대상에서 제외한다 — 대상이 없기 때문이다.
2. **`updateWeinsteinStage`/`updateMTF`가 index.html에 각각 두 벌 존재했다.** 먼저 `function updateWeinsteinStage(){}`(구, 라이브 시세·breadth·HY·섹터 로테이션 기반 복합점수, localStorage `_spy_ath` 사용)가 선언되고, 그 뒤(비-strict 모드 스크립트) `updateWeinsteinStage = function(snapshot){}`(P712/R340이 도입한 신 OHLCV 기반 fail-closed 모델)가 같은 전역 이름에 **재대입**돼 앞쪽을 완전히 덮어썼다. `updateMTF`도 동일 패턴(구 4-factor 가중점수 모델 vs 신 OHLCV 기반 모델). 재대입이 최초 스크립트 실행 중 무조건 일어나고, 두 함수의 모든 호출부는 그 이후에만(이벤트 핸들러·비동기 콜백 내부) 실행되므로 구 구현은 어떤 경로로도 도달 불가능한 완전 사문(死文)이었다 — 하지만 이름과 시그니처가 같아 정적 코드 리딩만으로는 "두 벌 중 어느 쪽이 사는지" 즉시 드러나지 않는다(전체 참조 교차 grep + 실행 순서 추론이 필요했음).

이 두 발견 모두 "F-11의 계획을 실행하기 전에 대상 코드를 라인 단위로 재확인해야 한다"는 R352/F-01의 교훈이 도메인 추출 계획 자체에도 적용됨을 보여준다. 부수적으로 breadth 페이지의 `updateWSAnalysis()`(`js/aio-ui.js`)가 자기 페이지가 아닌 technical 페이지의 DOM(`ws-analysis`)에 쓰던 고아 함수였고, `breadth-stage-summary`/`mtf-verdict-text` 두 표면은 위 사문 구현이 유일한 writer라 이미 라이브로는 절대 갱신되지 않는 상태였음도 함께 발견됐다(P746, 제품 결정 필요해 이번 배치 미해결로 이관).

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

## 5. 문서 전체 인수 기준 (2026-07-19 RM-00~05 완료 시점 판정, 2026-07-20 RM-03 item 2 갱신)

1. **충족**: ops-status·retirement-manifest·route-owners.json·handoff·실행 계획·INDEX가 동일한 실측 소유권(lifecycle 17, renderer 2, data 0, chart 1, narrative 1)을 서술한다. RM-03 item 2는 도메인 계층 작업이라 이 5칸을 바꾸지 않았다(2026-07-20 재확인).
2. **충족**: contested DOM writer 0 (AG-DOM-WRITER PASS, RM-01). 단 이는 "native가 legacy를 침범하지 않는다"는 뜻이며, "legacy가 삭제되고 native가 단독 소유"라는 뜻이 아니다. §2 baseline 4카운터는 RM-00~05 동안 무변화였으나 RM-03 item 2(2026-07-20)에서 처음 실질 감소했다(1094/42/189/416 → 1088/42/187/410) — 단 이 감소는 "native가 legacy 소유를 인수해서"가 아니라 "완전히 사문화된 legacy 코드를 삭제해서"이며, contested DOM writer 0이라는 결론 자체는 바뀌지 않는다.
3. **부분 충족**: RM-03 item 1이 `computeTradingScoreModel`, item 2(2026-07-20)가 `computeRelativeRotation`/`classifyMovingAverageStructure`/`deriveMultiTimeframeView`까지 legacy 덤프 대조 실 parity를 달성했다(`ci-domain-parity-check.mjs`, RRG/Weinstein-MTF 각 8개 fixture 전부 일치). 단 이 셋은 `ci-domain-parity-check.mjs`가 원래 항진으로 지목했던 7개 모델(market/macro/portfolio/screener/news/technical/signal) 목록에 없던 별도 추가 항목이었다 — 그 7개는 이번 배치로 **하나도 줄지 않았고 여전히 항진**이다. "항진 게이트 0"은 미충족이며, F&G는 이번 세션에서 "로컬 합성 로직 자체가 없음"으로 확정돼 대상에서 제외됐다(추출할 항진 게이트가 애초에 없음).
4. **충족**: 그 정직한 상태로 §8.1 전체(12개, RM-05에서 ci-esm-core-unit-check 추가) + ci.yml 전체가 PASS(게이트를 낮춰서가 아니라 검증을 바꿔서 — RM-00의 원칙 유지). RM-03 item 2도 동일 원칙으로 §8.1 + 확장 25종 게이트 전부 재실행·PASS(세션 카드 참조).
5. **충족**: F-01~F-03의 P번호(P740/P741)와 "진척 인플레이션" 반복 클래스가 BUG-POSTMORTEM에 존재한다. P742(RM-02)·P743(RM-03 item 1)·P744(RM-05)·P745(RM-03 item 2)·P746(고아 DOM 발견)도 같은 규율로 추가 기록됨.
6. **충족**: 이후 모든 상태 승격이 route-owners.json 파생값으로만 이뤄지도록 게이트가 강제한다(RM-00의 cross-validation).

**요약**: 6개 기준 중 5개 충족, 1개(항진 게이트) 부분 충족 — RM-03 item 2로 실 parity 대상이 1개→3개로 늘었으나 원래 지목된 7개 항진 모델 자체는 그대로 남아 있다. "전체 재구축 완료"가 아니라 "회계·게이트 무결성 복구 완료 + ARX 재진입 준비 완료"로 정확히 스코프를 한정한다.

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

**2026-07-19 갱신**: RM-00/01/02/03(item 1·5)/04/05가 같은 세션에서 완료되어 "RM 완료 전 ARX 착수 금지" 조항의 전제(RM 미완료)는 더 이상 성립하지 않는다. 그러나 이것이 "따라서 이어서 ARX-03/04를 자동 착수하라"는 뜻은 아니다 — RM-06(§0.1)이 명시하듯 ARX 재진입은 route당 600~800줄 신규+수백~수천 줄 삭제 규모의 별도 다세션 작업이며, 착수 여부·시점은 사용자 지시를 받는다. 나머지 3개 금지 항목(삭제 0건 배치, legacy와 다른 산식 병렬 도입, 무단 커밋·푸시·배포)은 RM 완료 여부와 무관하게 계속 유효하다.

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

### 세션 카드 — RM-02 (같은 세션, RM-01 직후 이어서 실행)

```text
Packet: RM-02
Checkout/HEAD/version/liveRevision: RM-01이 69a1fa5로 커밋된 상태에서 이어서 시작 / v53.16 / live revision 미확인(배포 없음)
Scope route/metric/layer: store·이벤트 성능 계약 — src/state/store.js, src/state/memoize.js(신규), src/app/bootstrap.js, src/ui/pages/sentiment.js, scripts/ci-architecture-contract-check.mjs, architecture/adr-0002-*.md(신규), sw.js
Owner before: dispatch당 전체 state clone 2회 + 구독자당 1회(1000행 screener fixture p95=7.49ms). aio:liveQuotes 6개 독립 리스너(조정 없음). 성능 게이트 부재.
Owner after: clone 0회(reducer 스프레드 신뢰, devMode에서만 deep-freeze). aio:liveQuotes 1개 coalesced 리스너. sentiment.js는 자기 slice 참조 변경 시에만 재렌더. 1000행 fixture p95=0.044~0.111ms. 성능 게이트 상시화(5ms 예산).
Files read: src/state/store.js, src/state/slices/*.js(reducer 스프레드 계약 확인), src/app/bootstrap.js 전체, src/ui/pages/sentiment.js, architecture/adr-0001-rebuild-foundations.md(기존 ADR 관례 확인), _context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md §4(ADR-0002 예약 확인)
Files changed: src/state/store.js · src/state/memoize.js(신규) · src/app/bootstrap.js · src/ui/pages/sentiment.js · scripts/ci-architecture-contract-check.mjs · architecture/adr-0002-vite-typescript-and-state-access.md(신규) · sw.js(신규 파일 precache 등록) · _context/BUG-POSTMORTEM.md · CHANGELOG.md · _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md(이 문서)
DELETE-LEDGER before edit:
  - declaration: store.js의 `clone()` 함수와 그 3곳 호출부(getState 1·dispatch 2) 전체 삭제, `deepFreeze()`로 교체(devMode 조건부)
  - callers: bootstrap.js의 `stopMarketQuotes`/`stopThemesQuotes`/`stopEntityQuotes`/`stopPortfolioQuotes`/`stopAnalysisQuotes` 5개 변수 선언 및 대응 `legacy.on('aio:liveQuotes', ...)` 호출 5건 삭제(1개 coalesced 리스너로 통합), stop() cleanup에서 대응 5개 호출 제거
  - global writer: 해당 없음
  - DOM/chart/narrative sink: 해당 없음(이 배치는 store 내부 성능 계약, DOM 쓰기 변경 없음)
  - event/timer/storage: aio:liveQuotes 리스너 등록 개수만 6→1로 감소, 다른 이벤트(refresh:done/pageShown/marketSnapshot 등)는 스코프 외로 유지(명시된 범위만 처리)
  - tests/docs: 없음(기존 테스트가 새 설계로도 그대로 통과함을 §8.1로 확인)
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 legacy 카운터 무변경(1094/42/189/416, 이 배치는 legacy 파일 비대상). 신규 성능 카운터: perfScreenerDispatchP95Ms 벤치 없음(신설)→0.044ms.
New compatibility introduced and retirement packet: `createStore({ devMode })` 신규 옵션(기본 false, 하위 호환 — 기존 모든 호출부가 옵션 생략 시 이전과 동일하게 동작). 별도 retirement 불필요(옵션 추가는 호환 깨짐 없음).
Local gates: §8.1 전체(11개, 신규 성능 게이트 포함) PASS + headless 1098/1098 + critical10 10/10 + a11y 17/17 + viewport(FULL_INIT) 68/68 + Portfolio Vault E2E + boot-interaction(exit 0) + knowledge-lint 0 warning + ux-default-path(3846/3846) + 나머지 static 계약(market-snapshot/data-plane/inference/reconciliation/data-lineage/data-pipeline/static-data/history-field-time/storage-migration/release-manifest) 전부 PASS.
Browser evidence: `ci-architecture-browser-check.mjs` PASS — sentiment/guide/content route 기존 검증 불변, home surface(정수 점수+한국어 라벨) 불변, browserErrors 0. sentiment.js가 subscribeToSlice로 전환된 뒤에도 render 결과 동일함을 확인(뱃지·차트·score 텍스트 불변).
Live evidence: 없음 — 커밋(로컬)만, 배포는 미지시.
Unverified/blockers: `devMode` deep-freeze 자체를 실행하는 전용 테스트가 아직 없음(ADR-0002 부록의 consequences에 후속 과제로 기록) — 현재는 `devMode` 미사용(기본 false)이라 freeze 경로 자체가 어떤 실행 경로에서도 아직 실제로 실행되지 않는다. RM-02 item3의 범위를 aio:liveQuotes 6개로만 한정했고 refresh:done(5개)·pageShown(5개)은 동일 패턴이 남아있음(다음 성능 패킷 후보로 기록, 이번 배치 스코프 아님).
Status: VERIFIED_LOCAL (RM-02 스코프 한정 — W5 진입의 선행 조건이었던 성능 계약·게이트가 갖춰짐. refresh:done/pageShown coalescing과 devMode freeze 실사용은 후속 과제)
```

### 세션 카드 — RM-03 (같은 세션, RM-02 직후 이어서 실행, item 1·5만)

```text
Packet: RM-03 (item 1 computeTradingScore 추출 + item 5 백테스트 수렴만; item 2 F&G/RRG/Weinstein와 item 3 toy 모델 삭제는 미착수·의도적 보류)
Checkout/HEAD/version/liveRevision: RM-02가 e031a88로 커밋된 상태에서 이어서 시작 / v53.16 / live revision 미확인(배포 없음)
Scope route/metric/layer: 도메인 추출 — js/aio-core.js:computeTradingScore, src/domain/signal/trading-score.js(신규), src/app/bootstrap.js, src/legacy/compatibility-facade.js, scripts/backtest-trading-score.mjs, scripts/ci-domain-parity-check.mjs(rename), scripts/ci-runtime-contract-check.mjs, scripts/ci-semantic-review-check.mjs
Owner before: 매매 점수 포뮬러가 3벌(라이브 aio-core.js / 백테스트 사본 scripts/backtest-trading-score.mjs / signal toy 도메인 src/domain/signal/decision.js) 존재, 서로 독립적으로 드리프트
Owner after: 라이브+백테스트가 `src/domain/signal/trading-score.js` 단일 구현을 소비(F-11 목표의 2/3 벌 수렴). toy 도메인(3번째 벌)은 미해결로 명시 이월 — "수렴 완료"로 오표기하지 않음.
Files read: js/aio-core.js:21671~21849(computeTradingScore 전문), src/app/bootstrap.js 전문, src/legacy/compatibility-facade.js 전문, scripts/backtest-trading-score.mjs·backtest-trading-score-longrun.mjs 전문, src/domain/signal/decision.js, src/data/normalize/analysis.js(toy 모델 소비처 확인), scripts/ci-domain-module-smoke-check.mjs, scripts/ci-runtime-contract-check.mjs·ci-semantic-review-check.mjs(관련 체크만)
Files changed: js/aio-core.js · src/app/bootstrap.js · src/legacy/compatibility-facade.js · scripts/backtest-trading-score.mjs · scripts/ci-runtime-contract-check.mjs · scripts/ci-semantic-review-check.mjs · sw.js · .github/workflows/ci.yml · public-data/score-backtest-history.json(재생성) · _context/BUG-POSTMORTEM.md · CHANGELOG.md · _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md(이 문서)
Files added: src/domain/signal/trading-score.js · scripts/dump-trading-score-fixtures.mjs · architecture/fixtures/trading-score-golden.json
Files renamed: scripts/ci-domain-module-smoke-check.mjs → scripts/ci-domain-parity-check.mjs
DELETE-LEDGER before edit:
  - declaration: js/aio-core.js의 computeTradingScore 내부 5개 서브스코어 계산 블록(volScore/momScore/trendCalcScore/breadthCalcScore/macroScore 계단함수) — 도메인 모듈로 이관, 래퍼에는 입력 수집만 남김. scripts/backtest-trading-score.mjs의 calcVolScore/calcMomScore/calcTrendScore/calcBreadthScore/calcMacroScore 5개 함수 전체 삭제.
  - callers: 없음(함수 호출부는 그대로, 내부 구현만 위임)
  - global writer: 해당 없음
  - DOM/chart/narrative sink: 해당 없음(도메인 계층 작업, DOM 무관)
  - event/timer/storage: 해당 없음
  - tests/docs: ci-runtime-contract-check.mjs·ci-semantic-review-check.mjs의 "`{ total, score: total`가 core에 있어야 한다" 하드 검증 2건을 도메인 모듈 검사로 정정. ci-domain-module-smoke-check.mjs → ci-domain-parity-check.mjs 개명 + ci.yml 갱신.
Burn-down before/after: explicitWindowWrites/directFetch/directStorage/htmlSinks 4개 legacy 카운터 무변화(1094/42/189/416) — 이 배치는 알고리즘 이관이며 legacy DOM/global 삭제 대상 아님. 실질 변화: Trading Score 구현체 3벌→2벌(라이브+백테스트 수렴, toy 도메인 잔존).
New compatibility introduced and retirement packet: `window.AIO_ARCH.computeTradingScoreModel` 신규 브릿지(단일 구현 소비 경로) — retirement 대상 아님(영구 계약). `architecture/fixtures/trading-score-golden.json`은 향후 F&G/RRG/Weinstein 추출 시 동일 패턴(헤드리스 덤프→순수 함수 추출→parity 대조)의 참조 사례로 유지.
Local gates: §8.1 전체(11개, 성능 게이트 포함) + ci-retirement-contract + ci-domain-parity-check(골든 7종 전부 일치) + ci-runtime-contract-check + ci-semantic-review-check 전부 PASS. headless 1098/1098. Portfolio Vault E2E, knowledge-lint 0 warning.
Browser evidence: `ci-architecture-browser-check.mjs` — **1차 실행에서 회귀 발견**(`scoreGaugeVal:"null*"`, `hasModelFn:false` — exposeArchitecture 배선 누락), 원인 진단 후 수정, **재실행 PASS**(`scoreGaugeVal:"52*"`, browserErrors 0). 이 발견 자체가 "골든 fixture parity만으로는 cross-module 배선 문제를 잡지 못한다"는 근거.
Live evidence: 없음 — 커밋(로컬)만, 배포는 미지시.
Unverified/blockers: RM-03 item 2(F&G 합성·RRG·Weinstein/MTF 추출) 전부 미착수. item 3(`signal/decision.js` toy 모델 삭제)은 `normalizeAnalysis`의 실 소비 때문에 의도적 보류 — 삭제 시 signal 슬라이스 유도 로직을 무엇으로 대체할지 별도 설계 결정 필요(위 미해결 항목 참조). `backtest-trading-score-longrun.mjs`의 percentile 기반 `calcTrendScoreRel` 등은 의도적으로 별개 방법론이라 그대로 유지 — 향후 세션이 이를 "미수렴 드리프트"로 오인하지 않도록 주의.
Status: VERIFIED_LOCAL (RM-03 item 1·5 스코프 한정 — item 2·3 잔존, "RM-03 완료"로 승격하지 않음)
```

### 세션 카드 — RM-05 (같은 세션, RM-03 직후 이어서 실행)

```text
Packet: RM-05
Checkout/HEAD/version/liveRevision: RM-03이 9293bd4로 커밋된 상태에서 이어서 시작 / v53.16 / live revision 미확인(배포 없음)
Scope route/metric/layer: 게이트 실효성 보강 — scripts/ci-architecture-browser-check.mjs, scripts/ci-esm-core-unit-check.mjs(신규), src/ui/pages/{entity,market,themes}.js, architecture/route-owners.json, .github/workflows/ci.yml, 실행계획 §8.1
Owner before: AG-DOM-WRITER는 이미 상시(RM-01), ops-status 이원화 방지도 이미 상시(RM-00) — 문서화만 부재. 브라우저 게이트는 5개 route만 왕복(sentiment/guide/market-news/briefing/home), 나머지 12개 route는 실행 경로 검증 이력 없음. ESM 코어 5개 모듈은 통합 스모크(ci-architecture-contract-check)로만 간접 검증, 격리 unit 테스트 없음.
Owner after: 브라우저 게이트가 17개 route 전부를 2랩 왕복하며 canvas/타이머 누수를 검증. ESM 코어 5개 모듈 격리 unit 계약 39개 assertion 신설. route-owners.json에 AG-DOM-WRITER 허용목록 이관 절차 명시.
Files read: src/app/lifecycle.js, src/app/router.js, src/data/evidence-store.js, src/data/contracts/evidence.js, src/legacy/compatibility-facade.js(재독), src/ui/pages/{entity,market,themes}.js(재독, 결함 발견)
Files changed: scripts/ci-architecture-browser-check.mjs · src/ui/pages/entity.js · src/ui/pages/market.js · src/ui/pages/themes.js · architecture/route-owners.json · .github/workflows/ci.yml · _context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md(§8.1) · _context/BUG-POSTMORTEM.md · CHANGELOG.md · _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md(이 문서)
Files added: scripts/ci-esm-core-unit-check.mjs
DELETE-LEDGER before edit: 해당 없음(이 배치는 신규 게이트/테스트 추가 + 3개 파일의 누락된 dataset 속성 1줄씩 추가 — 삭제 대상 없음, 정상. RM-01/03과 달리 이 배치의 목적 자체가 "검증 강화"이며 legacy burn-down이 목표가 아님)
Burn-down before/after: 4개 legacy 카운터 무변화(1094/42/189/416) — 대상 아님.
New compatibility introduced and retirement packet: 없음. `dataset.aioArchitectureRoute` 추가는 새 계약이 아니라 기존 6개 모듈이 이미 지키던 계약을 나머지 3개 모듈로 확장한 것(일관성 수정).
Local gates: §8.1 전체(12개, ci-esm-core-unit-check 포함) + ci-retirement-contract + ci-domain-parity-check + ci-operations-status-check 전부 PASS. headless 1098/1098. critical10/a11y/knowledge-lint PASS.
Browser evidence: `ci-architecture-browser-check.mjs` — **수정 전 9개 route에서 30초 타임아웃 재현**(entity/market/themes 누락 확인) → 수정 후 17-route 2랩 왕복 PASS(canvas 42=42, 타이머 11=11 랩1↔랩2 동일, browserErrors 0).
Live evidence: 없음 — 커밋(로컬)만, 배포는 미지시.
Unverified/blockers: 리소스 누수 검증은 canvas/legacy-timer-registry라는 관측 가능한 대리 지표 기반이며 CDP `getEventListeners` 기반 완전한 리스너 전수 조사는 아님(문서화된 의도적 스코프 축소). ESM 코어 unit 테스트는 "최소"(minimal) 수준(5개 모듈 × 평균 7~8개 assertion)이며 모든 edge case를 다루지 않음.
Status: VERIFIED_LOCAL (RM-05 item 1·2·3·4 전부 완료 — RM-00~05 중 유일하게 "완료"로 승격 가능한 패킷. RM-03 item 2·3만 미해결로 남음)
```

### 세션 카드 — RM-03 item 2 (다음 세션, 2026-07-20)

```text
Packet: RM-03 item 2 (F&G 합성 유무 확정 + RRG/Weinstein/MTF 도메인 추출) — item 3은 소비처 재확인 및 ARX-11 이관 확정만, 구현 없음
Checkout/HEAD/version/liveRevision: RM-06이 70927bb로 커밋된 상태에서 이어서 시작 / v53.16(버전 미변경 — RM-00~06과 동일 관례) / live revision 미확인(배포 없음)
Scope route/metric/layer: 도메인 추출 — index.html:calcLiveRS/classifyRRG/updateWeinsteinStage(구)/updateMTF(구·신), js/aio-core.js:calcTechnicalSnapshot, js/aio-ui.js:updateWSAnalysis, src/domain/themes/rrg.js(신규), src/domain/technical/stage.js(신규), src/app/bootstrap.js, src/legacy/compatibility-facade.js, scripts/ci-domain-parity-check.mjs, scripts/dump-rrg-fixtures.mjs(신규), scripts/dump-weinstein-mtf-fixtures.mjs(신규)
Owner before: RRG 산식(calcLiveRS 내부)·Weinstein/MTF 산식(calcTechnicalSnapshot·updateMTF 내부)이 전부 legacy 단일 구현(단 Weinstein/MTF는 legacy 자체가 사문 구현 1벌 + 실구현 1벌의 이중 상태였음, 아래 참조). F&G는 로컬 산식 자체가 없음(CNN fetch-only).
Owner after: RRG 순수 수학이 src/domain/themes/rrg.js(computeRelativeRotation)로, Weinstein MA-스택/스테이지·MTF 추세 분류가 src/domain/technical/stage.js(classifyMovingAverageStructure/deriveMultiTimeframeView)로 이관 — legacy 3개 함수(calcLiveRS/calcTechnicalSnapshot/updateMTF)는 window.AIO_ARCH 호출 + fail-closed 폴백으로 축소. route ownership(lifecycle/renderer/data/chart/narrative 5칸)은 도메인 계층 작업이라 불변.
Files read: index.html의 calcLiveRS/classifyRRG/updateWeinsteinStage(양쪽 정의)/updateMTF(양쪽 정의)/renderRRGQuadrantCards 전체, js/aio-core.js의 calcTechnicalSnapshot 전체(19021~19657)·getTradingDecisionLogicAudit, js/aio-ui.js의 updateWSAnalysis/initBreadthPage/updateBreadthBars, js/aio-data.js의 fetchFearGreed/_applyFearGreedScore 및 F&G 관련 전 참조, src/domain/{sentiment/metrics,signal/trading-score,home/summary,market/model}.js, src/data/normalize/analysis.js, src/app/bootstrap.js, src/legacy/compatibility-facade.js, scripts/dump-trading-score-fixtures.mjs(패턴 참고), scripts/ci-domain-parity-check.mjs, _context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md 전문
Files changed: index.html · js/aio-core.js · js/aio-ui.js · src/app/bootstrap.js · src/legacy/compatibility-facade.js · sw.js · scripts/ci-domain-parity-check.mjs · architecture/baseline.json · _context/CODE-MAP.md · _context/BUG-POSTMORTEM.md · CHANGELOG.md · _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md(이 문서)
Files added: src/domain/themes/rrg.js · src/domain/technical/stage.js · scripts/dump-rrg-fixtures.mjs · scripts/dump-weinstein-mtf-fixtures.mjs · architecture/fixtures/rrg-golden.json · architecture/fixtures/weinstein-mtf-golden.json
DELETE-LEDGER before edit:
  - declaration: index.html의 구 `function updateWeinsteinStage(){}`(15051~15269, 218줄)·구 `function updateMTF(){}`(15271~15424, 158줄) 전체 — sloppy-mode 재대입으로 어떤 호출 경로로도 도달 불가능함을 전체 참조 교차 grep으로 확인 후 통삭제(376줄). js/aio-ui.js의 `updateWSAnalysis()`(자기 페이지가 아닌 technical 페이지 DOM에 쓰던 고아 함수) 전체 삭제.
  - callers: js/aio-ui.js의 `initBreadthPage()` 끝의 `updateWSAnalysis()` 호출 1곳, index.html의 breadth `aio:liveQuotes` 분기 `if(breadthPage...){updateWSAnalysis();}` 블록 전체 삭제.
  - global writer: 해당 없음(도메인 계층 이관, 전역 변수 삭제 아님)
  - DOM/chart/narrative sink: 구 updateWeinsteinStage의 `ws-stage1~4`/`ws-analysis` innerHTML/style 쓰기, 구 updateMTF의 `mtf-analysis`/`mtf-verdict-text` innerHTML 쓰기, updateWSAnalysis의 `ws-analysis` innerHTML 쓰기 — 전부 위 함수 삭제와 함께 제거(모두 사문/고아였으므로 가시 회귀 없음)
  - event/timer/storage: 구 updateWeinsteinStage의 `localStorage.getItem/setItem('_spy_ath')` 2곳 삭제(→ directStorage 189→187)
  - tests/docs: 없음(해당 사문/고아 함수를 직접 검증하는 테스트 없었음 — js/aio-tests.js에 `updateWSAnalysis`/`classifyRRG` 참조 0건 사전 확인)
Burn-down before/after: explicitWindowWrites 1094→1088 · directFetch 42→42(불변) · directStorage 189→187 · htmlSinks 416→410. `architecture/baseline.json` 갱신(explicitWindowWritesMax 1109→1088로 재래칫). RM-00~05는 이 4개 카운터가 전부 불변이었음 — RM-03 item 2가 이 연작 최초로 실질 legacy 삭제를 기록했다.
New compatibility introduced and retirement packet: `window.AIO_ARCH.computeRelativeRotation`/`classifyMovingAverageStructure`/`deriveMultiTimeframeView` 3개 신규 브릿지(단일 구현 소비 경로, P743 트레이딩스코어와 동일 패턴) — retirement 대상 아님(영구 계약). bootstrap.js api 객체와 compatibility-facade.js exposeArchitecture() 양쪽에 같은 배치에서 등록(P743 배선 버그 재발 방지 절차 적용).
Local gates: §8.1 핵심 12개 전부 PASS(viewport FULL_INIT 68/68·worstOverflow 0px·jsErrors 0 포함) + ci-domain-parity-check(RRG 8 fixture·Weinstein/MTF 8 fixture 전부 실 parity 일치) + ci-retirement-contract·ci-operations-status-check·ci-doc-currency(index.html -406줄 드리프트 감지했으나 ±500 임계 이내)·ci-knowledge-lint·ci-portfolio-vault-e2e(8/8)·ci-boot-interaction·ci-ux-default-path(div 3831/3831)·ci-data-lineage(1 WARN=SEC coverage, 기존·무관)·나머지 static 계약(market-snapshot/data-plane/inference/reconciliation/data-pipeline/static-data/history-field-time/storage-migration/release-manifest/release-revision/control-char/second-pass-baseline/skill-contract/workflow-compaction/worker-anthropic) 전부 PASS. headless 1098/1098.
Browser evidence: `ci-architecture-browser-check.mjs` PASS — routeRoundTrip true, canvases 42=42, timers 11=11(랩1↔랩2 동일), browserErrors 0. sentiment/guide/home 기존 검증 불변.
Live evidence: 없음 — 커밋(로컬) 여부도 사용자 지시 대기, 배포는 미지시.
Unverified/blockers: `breadth-stage-summary`/`mtf-verdict-text` 두 표면을 무엇으로 채울지 제품 결정 미해결(P746, QA-CHECKLIST 이관 권고). Weinstein STAGE_3_TOPPING 분기(fullBull && sma50Rising===false)는 골든 fixture 8종 중 어느 것도 명중시키지 못했다 — 다른 5개 stageEstimate 분기·null 입력 분기는 실측 확인했으나 이 분기는 코드 대조(문자 단위 transcription 검증)로만 검증됨, 다음 세션에서 이 분기를 명중시키는 fixture를 추가하면 커버리지를 완성할 수 있음. `ci-domain-parity-check.mjs`의 원래 7개 smoke-only 모델(market/macro/portfolio/screener/news/technical/signal)은 이번 배치로 줄지 않음.
Status: VERIFIED_LOCAL (RM-03 item 2 스코프 한정 — RM-03 전체가 이제 "item 1·2·5 완료 + item 3 의도적 스코프 확정(ARX-11 이관)"으로 완결. §5 전체 인수 기준 항목 3은 여전히 "부분 충족"이나 실 parity 대상이 1개→3개로 늘었다는 의미로 갱신)
```
