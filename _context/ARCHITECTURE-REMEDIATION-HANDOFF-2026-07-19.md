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

## 1. 실측 발견 원장 (F-01~F-09)

각 발견은 2026-07-19 v53.16(HEAD `9462404`) 실측이다. 재현 명령이 함께 있으면 착수 전 재실행한다.

### F-01 — 소유권 원장 하드코딩 (P0)

`scripts/build-operations-status.mjs:43-48`이 `nativeOwner` 17개 route 전체·`legacyOwner: 0`·`cutoverStatus: 'NATIVE_ROUTES_LOCAL'`을 **리터럴 배열로 하드코딩**한다. `architecture/retirement-manifest.json`도 `nativeRoutes` 17개·`legacyRouteOwners: []`를 선언한다. 실행 계획 §1("Renderer가 legacy면 legacy owner") · §5("다섯 칸 중 하나라도 legacy면 nativeOwner 집계 금지") 및 R352 위반.

실측 소유권(§2 진실표): renderer native는 최대 4(briefing/guide/market-news/sentiment), data native 0, chart native 1(sentiment), narrative native 0~1(재실측 필요). 5칸 기준 `nativeOwner`는 **0**이어야 한다. 직전 정직 기록은 실행 계획 §2 checkpoint의 `nativeRendererOwner=4 / legacyOwner=13`이었다.

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

도달 경로 확정: facade(`compatibility-facade.js:157-161`)가 legacy `showPage` 실행 **후** `router.transition`을 호출 → native mount가 나중에 실행되고, 이후 `aio:liveQuotes`/`aio:refresh:done`/모든 store dispatch마다 native가 재렌더(`analysis.js:40-45`)한다. 마지막 writer가 이기는 경합이며 AG-03(단일 writer)·실행 계획 §3 금지("legacy fetch/writer를 둔 채 병렬 추가") 위반. **native 모듈의 데이터가 6줄짜리 toy 도메인 산출이므로, 이기는 쪽이 native면 품질이 후퇴한다.**

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

## 2. Route 소유권 진실표 (RM-00 재실측의 초기 가설)

RM-00은 이 표를 **선언이 아니라 재실측으로 확정**한 뒤 `architecture/route-owners.json`(신설)에 기록한다.

| 칸 | native 실측(가설) | 근거 |
|---|---|---|
| lifecycleOwner | 17 (조건부) | `PAGES` init 전부 null(`aio-core.js:25058~`), ESM router가 mount/dispose 소유. 단 showPage 본체(DOM show/hide·hash)는 legacy — "lifecycle=init/dispose 소유"로 정의를 명시하고 기록할 것 |
| rendererOwner | 4 — briefing/guide/market-news/sentiment | 이 4개만 대응 legacy renderer 삭제 이력 존재(CHANGELOG v53.15). 나머지 13은 legacy renderer 생존 + thin native 병존(F-03) |
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

DELETE-LEDGER(최소): `analysis.js:13-24`의 contested setText 전부, `entity.js:24-36` 중 contested, market/themes/portfolio/screener 동일 기준. 인수: 교집합 0 + §8.1 전체 PASS + 실브라우저에서 home/signal 한국어 라벨·정수 점수 유지.

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

### RM-04 — 배치 규율 복원 (P0, RM-00과 병합 가능)

1. 실행 계획 checkpoint의 "full §8.1 deferred …" 서술 삭제 → "매 배치 §8.1 전체 실행" 복원.
2. 세션 카드 없는 배치 금지 재확인. "한 세션 한 패킷" 재확인.
3. 이번 4커밋(`b7bce36`~`9462404`)의 push 경위를 사용자에게 확인 — "자동 배포/커밋 금지" 규칙과의 정합 판정은 운영자 몫. 무단이었다면 WORKFLOW-GOVERNANCE에 push 게이트 추가 검토.
4. RM-00의 정정으로 공개 artifact(ops-status 등)가 바뀌므로, **배포(재게시) 여부는 사용자 지시 대기**로 명시.

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

## 6. 이 감사의 커버리지와 미검증 고지

- 검증함(정적 실측): 문서 위계 전체, src/ 96파일 전수 열거+주요 40여 파일 정독, bootstrap 배선(index.html:28375), 게이트 스크립트 6종 정독, 카운터 재측정(문서 수치와 일치 확인), legacy는 표적 정독(PAGES/showPage/hero·signal writer/computeTradingScore 위치)과 grep 전수.
- 검증하지 않음: index.html 28K줄·aio-core 26K줄·aio-chat 6K줄의 라인 단위 전수, live 사이트의 v53.16 반영 상태, Cloudflare fast plane, provider rights, 장시간 soak, AI 레거시 내부 품질(→ AI-CHAT-INSTITUTIONAL-AUDIT), 알고리즘의 금융적 타당성 재검증(구조만 판정).
- 이 문서의 판정이 이후 실측과 다르면 실측을 우선하고 이 문서를 정정한다.

## 7. 금지 목록

- RM 완료 전 새 ARX 패킷 착수, 새 병렬 계획 문서 생성(이 문서가 유일한 RM 원장)
- 삭제 0건 architecture 배치, 선언식 상태 승격, 게이트를 낮춰서 초록 만들기
- legacy와 다른 산식의 병렬 도입(도메인은 추출만)
- 사용자 명시 지시 없는 커밋·푸시·배포
