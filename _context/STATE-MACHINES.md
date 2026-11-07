# 상태 머신 목록 — 상태·불변식·전이표·도달 가능한 잘못된 상태

- 작성: 2026-11-07 상태 머신 감사 (v59.73 HEAD 기준). 수정은 다음 릴리스(v59.74)에 기록된다.
- 범위: 브라우저 런타임(`src/`, `js/`)의 명시적·암묵적 상태 머신. 생산자·Worker 쪽 상태 머신은 이미 모델 검사 게이트가 있어 §3에 위치만 적는다.
- 회귀 게이트: `node scripts/ci-state-machine-regression-check.mjs` (아래 SM-03·04·05 사례), 기존 `ci-refresh-scheduler-model-check.mjs`(일시정지)·`ci-artifact-cache-model-check.mjs`(강제 새로고침).
- 갱신 규칙: 상태 머신 코드를 바꾸면 해당 절의 전이표와 불변식을 같이 고친다. 새 결함은 §2 표에 SM 번호로 추가하고, 고친 결함은 상태를 `고침(v…)`으로 바꾼다. 행을 지우지 않는다.

"암묵적"이란 상태 이름 없이 플래그·전역 변수·타이머 조합으로만 존재하는 상태 머신을 뜻한다. 이 앱의 결함은 대부분 여기서 나왔다.

---

## 1. 목록

| ID | 상태 머신 | 위치 | 종류 | 검증 |
|---|---|---|---|---|
| SM-01 | 라우트 생명주기 | `src/app/router.js` `createLifecycleRouter` | 명시적 | ESM 유닛·아키텍처 브라우저 게이트 |
| SM-02 | 지연 화면 모듈 | `src/app/router.js` `createLazyPage` + `data-aio-route-module-state` | 명시적 | ESM 유닛 |
| SM-03 | 자동 갱신 작업 1회 실행 | `src/app/refresh-scheduler.js` `_runScheduledTask` (`cfg._status`, `_inFlight`) | 암묵적 | **state-machine-regression** |
| SM-03P | 스케줄러 일시정지·세대 | `src/app/refresh-scheduler.js` (`_schedulerPaused`, `_scheduleEpoch`, `cfg.timer`) | 암묵적 | refresh-scheduler-model (R1~R3) |
| SM-04 | 시세 요청 종목 목록 | `window._aioQuoteRequestSymbols` (scheduler·`js/aio-data.js`·`js/aio-core.js`) | 암묵적 | **state-machine-regression** |
| SM-05 | 시세 수신과 실패 재시도 | `js/aio-data.js` `fetchLiveQuotes`, 재시도 소유자 `src/app/refresh-scheduler.js` `_aioScheduleQuoteRetry`·`_aioCancelQuoteRetry` | 암묵적 | **state-machine-regression** |
| SM-06 | 뉴스 수신 잠금 | `js/aio-data.js` `fetchAllNews` (`isFetching`, `_fetchStartTime`) | 암묵적 | 리뷰 |
| SM-07 | 화면 진입 갱신 | `src/app/refresh-scheduler.js` `_aioRefreshPageData` | 암묵적 | 리뷰 |
| SM-08 | AI 질문 요청(run) | `js/aio-chat.js` `_aioBeginChatRequest` / `_aioReleaseChatRequest` / `_aioCancelChatRequest` | 명시적 | AI 채팅 신뢰성 계약 |
| SM-09 | AI 패널 스크립트 로더 | `src/app/chat-loader.js` | 명시적 | 부팅 상호작용 게이트 |
| SM-10 | 용어 사전 로더 | `src/app/classic-loader.js` | 명시적 | 리뷰 |
| SM-11 | 핵심 데이터 관문 | `src/app/critical-data-gate.js` | 명시적 | ESM 유닛 |
| SM-12 | 산출물 캐시 항목 | `src/data/artifact-cache.js` | 명시적 | artifact-cache-model |
| SM-13 | 유니버스 밖 종목 읽기 | `src/data/on-demand-symbol.js` | 명시적 | ESM 유닛 |
| SM-14 | 서비스 워커 교체 새로고침 | `js/aio-data.js` `controllerchange`, `js/aio-ui.js` 등록 | 암묵적 | 리뷰 |
| SM-15 | 서버 데이터 적재 상태 | `src/data/server-data-loader.js` (`__aioServerDataLoadState`, `__aioServerDataApplied`) | 암묵적 | ui-states |
| SM-16 | 부팅 시세 단계 | `src/app/boot-sequence.js` `_aioBootPhase.quoteReady` | 암묵적 | 리뷰 |

---

## 2. 도달 가능한 잘못된 상태·전이 (우선순위 순)

영향 기준: **높음** = 화면이 사실과 다른 상태를 말하거나 외부 호출이 계속 늘어남, **중간** = 갱신이 빠지거나 한 사이클 늦음, **낮음** = 보이는 영향이 작거나 드묾.

| 결함 | 영향 | 상태 머신 | 도달 경로(증거) | 상태 | 이슈 묶음 |
|---|---|---|---|---|---|
| SM-05 | 높음 | 시세 재시도 | 스냅샷 없이 시세가 실패하면 `fetchLiveQuotes`가 `setTimeout(fetchLiveQuotes, wait)`를 **실패마다 새로** 걸었다. 3분 주기 스케줄러가 실패할 때마다 자기 갱신하는 재시도 사슬이 하나씩 늘어 1시간 오프라인이면 약 20개, 각 사슬은 탭이 숨겨져도 계속 호출했다(스케줄러 일시정지 밖, R3 위반). | 고침(v59.74) | A. 갱신 결과 기록·재시도 |
| SM-03a | 높음 | 갱신 작업 | `fetchLiveQuotes`·`fetchAllNews`가 이미 수신 중이면 `undefined`를 돌려줬고, 스케줄러는 `undefined`를 성공으로 기록(`_lastOk` 갱신, `loaded`)했다. 재현: 부팅 2단계 수신 중에 화면 진입 갱신이 돌면 그 화면의 종목은 받지도 않고 "방금 갱신"이 되어 다음 진입 갱신(½ 주기)까지 건너뛴다. | 고침(v59.74) | A |
| SM-04 | 중간 | 시세 요청 종목 | 쓰는 쪽 셋(`runScheduledRefresh`, `AIO.ensureFreshDataForUse`, `repairPageLiveDataBinding`)이 모두 "이전 값 저장 → 내 값 설정 → 끝나면 이전 값 복원"을 했다. 겹친 두 갱신이 시작 순서와 같은 순서로 끝나면, 먼저 끝난 쪽이 아직 도는 갱신의 목록을 지우고(그 갱신의 시세 단계가 종목 없이 돈다) 나중 끝난 쪽이 먼저 끝난 갱신의 목록을 **영구히** 되살렸다. 재현: 화면 진입 갱신 + 탭 복귀 갱신. | 고침(v59.74) | A |
| SM-03b | 중간 | 갱신 작업 | 화면을 옮겨 진입 갱신이 취소되면(`route-changed`) 실패로 기록: `_status='failed'`, `retryCount+1`, 경고 문구 시도. 실제 공급자는 실패하지 않았다. | 고침(v59.74) | A |
| SM-03c | 중간 | 갱신 작업 | 시간 초과나 취소 뒤에도 수신은 계속돼 전역 데이터는 갱신되는데, 그 결과는 버려져 `failed`·옛 `_lastOk`가 남았다. 다음 진입이 다시 받아 호출이 겹친다. | 고침(v59.74) | A |
| SM-07 | 낮음 | 화면 진입 갱신 | `_aioPageRefreshLast[key]`(30초 간격)를 실제 실행 전에 찍는다. 0ms 뒤 실행이 화면 이동으로 버려지거나 취소되면, 30초 안에 같은 화면으로 돌아와도 갱신하지 않는다. 다음 주기가 메운다. | 열림 | B. 화면 진입 갱신 |
| SM-08 | 낮음 | AI 질문 요청 | 한 대화가 화면을 따라가는 답변(`_aioKeepRunningAnswer`) 중에 다른 AI 화면으로 가면 `updateAIPanelContext`·`toggleAIPanel`이 `#ai-panel-btn`을 다시 켠다. 답변이 도는 동안 전송이 눌리지만 `chatSendUnified`는 조용히 무시한다(60초가 지나면 돌던 답변을 취소). 요청 잠금 자체는 지켜진다. | 열림 | C. AI 패널 |
| SM-13 | 낮음 | 유니버스 밖 종목 | 대기 중인 항목도 40개 LRU에서 밀려날 수 있어, 같은 종목을 다시 부르면 중복 수신이 생긴다(동시 2개 제한 안). | 열림 | D. 캐시 |
| SM-15 | 낮음 | 서버 데이터 | `_aioLoadServerData` 호출이 겹치면 늦게 온 옛 응답이 새 메타를 덮을 수 있다(세대 가드 없음). 호출 간격이 30분이고 부팅 재시도는 이전 호출이 돌려준 뒤라 실제로 겹치기 어렵다. | 열림(관찰) | D |

각 열린 항목은 "가능성 낮은 경계 사례에 복잡도를 더하지 않는다"(CLAUDE.md 작업 규칙)에 따라 소유자 판단 전까지 코드를 더하지 않는다.

---

## 3. 상태 머신별 상태·불변식·전이표

### SM-01 라우트 생명주기 (`createLifecycleRouter`)

상태: `만들어짐`(start 전) · `시작됨/빈 화면` · `탑재됨(route, entityId, scope)` · `폐기됨`.

| 현재 | 사건 | 가드 | 다음 | 부수 효과 |
|---|---|---|---|---|
| 만들어짐 | `start()` | 폐기 아님 | 시작됨 | `aio:pageShown` 구독, 주소 딥링크 설치 |
| 시작됨/탑재됨 | `transition(r, d)` | 같은 route·entity·살아 있는 scope | 그대로(재커밋) | 마커 재확인, viewState가 새것이면 `recommit` 발행 |
| 시작됨/탑재됨 | `transition(r, d)` | 그 밖 | 탑재됨(r) | 이전 scope 폐기 → 새 scope → `mount` → 마커 → `aio:navigationCommitted` |
| 탑재됨 | 정리 중 재진입 이동·폐기 | `transitionId` 불일치 | 나중 이동이 이김 | 이 이동은 `false` (P1518) |
| 탑재됨 | `mount` 예외 | — | 시작됨/빈 화면 | scope 폐기 후 예외 전달 |
| 아무 상태 | `dispose()` | — | 폐기됨 | 활성 scope·구독 해제 |

불변식: 활성 scope는 많아야 하나다. 새 mount 전에 이전 scope는 폐기된다. viewState는 진짜 이동에서만 바뀐다(P1278). 외부 이동 권한이 설치되면 `aio:pageShown`은 관찰 전용이다(P1143). 마커는 페이지 노드에 남고 지워지지 않는다(P1161). 새 결함 없음.

### SM-02 지연 화면 모듈 (`createLazyPage`)

모듈 상태: `없음` → `대기(시도 n, 1.5 s·6 s 뒤 재시도)` → `해결됨`(캐시) | `실패`(대기 지움, 다음 진입이 다시 시도).
노드 상태 `data-aio-route-module-state`: mount마다 `loading` → `ready` | `failed`.

불변식: 폐기된 scope는 import가 끝나도 탑재하지 않는다. 실패한 mount는 등록한 자원을 놓는다. 관찰: 로딩 중 화면을 떠나면 그 노드는 다음 진입까지 `loading`으로 남는다. 테마 딥링크는 `ready`가 아닐 때 대기 id(`_aioOpenThemeDetailOnThemes`)를 남겨 다음 mount가 읽으므로 영향 없음.

### SM-03 자동 갱신 작업 1회 실행 (`_runScheduledTask`)

`cfg._status`: `(없음)` · `loading` · `loaded` · `partial` · `failed` · `missing`. 짝 플래그: `_inFlight`, `_lastOk`, `retryCount`.

| 현재 | 사건 | 다음 `_status` | `_lastOk` | `retryCount` |
|---|---|---|---|---|
| 아무 상태, `_inFlight` | 새 실행 요청 | 그대로 | 그대로 | 그대로 (`already in flight`로 건너뜀) |
| S, 일시정지 | 새 실행 요청 | 그대로 | 그대로 | 그대로 |
| S | 실행 시작 | `loading` (`S` 기억) | — | — |
| loading | 결과 성공(배열 일부 실패면 partial) | `loaded`/`partial`/결과의 status | 지금 | 0 |
| loading | 결과 `ok:false` / `null` / 전부 실패 / 건너뜀 | `failed`/`missing` | 그대로 | 그대로 |
| loading | 결과 `coalesced:true` (다른 호출이 이미 수신 중) | **S로 복원** | 그대로 | 그대로 |
| loading | 예외 | `failed` | 그대로 | +1 |
| loading | 시간 초과 | `failed` | 그대로 | +1 |
| loading | 호출자 취소(`signal` abort) | **S로 복원** | 그대로 | 그대로 |
| failed(시간 초과)·S(취소) | 늦게 도착한 작업 결과 | 위 결과 규칙대로 기록 | 결과대로 | 결과대로 |
| 아무 상태 | 작업 settle | `_inFlight=false` | — | — |

불변식:
- I3.1 한 작업 `cfg`는 한 번에 한 실행만 소유한다. 시간 초과·취소 뒤에도 실제 작업이 settle할 때까지 `_inFlight`는 참이다(그래서 늦은 결과 기록이 더 새 실행을 덮지 않는다).
- I3.2 `_lastOk`는 이 실행이 실제로 데이터를 받았을 때만 움직인다. 아무 일도 하지 않은 실행(coalesced)은 성공이 아니다. (SM-03a)
- I3.3 `failed`와 `retryCount`는 공급자 실패만 센다. 호출자 취소는 실패가 아니다. (SM-03b)
- I3.4 settle된 작업의 결과는 버려지지 않는다. (SM-03c)

### SM-03P 스케줄러 일시정지·세대

상태: `보임/동작`(`_schedulerPaused=false`, 작업마다 timer 또는 실행 중) · `숨김/정지`(모든 timer 해제, 세대+1).

| 현재 | 사건 | 다음 | 효과 |
|---|---|---|---|
| 보임 | `visibilitychange` hidden | 숨김 | 세대+1, timer 해제 |
| 숨김 | visible | 보임 | `interval` 이상 지난 작업 즉시 갱신, timer 재시작 |
| 아무 상태 | `runScheduledRefresh` 끝 | 지금 탭 상태대로 | (v59.60 고침) |
| 보임 | timer 발화 | 보임 | 세대가 같을 때만 실행·다음 timer |

불변식 R1~R3은 `ci-refresh-scheduler-model-check.mjs`가 깊이 6까지 전수 검사한다. 첫 periodic 실행은 `초기 지연 + interval`이다(첫 수신은 부팅 단계 몫) — 의도.

### SM-04 시세 요청 종목 목록 (`window._aioQuoteRequestSymbols`)

v59.74부터 값은 계산된다: **기본층**(`AIO.registerLiveSymbol`이 등록한 행·보유 종목) ∪ **보유 중인 목록들**(진행 중인 갱신 각각의 종목). 쓰는 쪽은 `_aioHoldQuoteRequestSymbols(list)`로 잡고 돌려받은 `release()`로 놓는다.

| 사건 | 결과 |
|---|---|
| 갱신 시작(종목 있음) | 보유 추가 → 다시 발행 |
| 갱신 끝(어떤 순서든) | 그 보유만 제거 → 다시 발행. 비면 속성 삭제 |
| `registerLiveSymbol(sym)` | 기본층에 추가 → 다시 발행 |
| `release()` 두 번 | 두 번째는 아무 일 없음 |

불변식: I4.1 진행 중인 갱신의 종목은 끝날 때까지 목록에 있다. I4.2 모든 갱신이 끝나면 목록은 기본층과 같다. 이전(저장·복원) 방식은 두 불변식을 모두 깼다(SM-04).

### SM-05 시세 수신과 실패 재시도 (`fetchLiveQuotes`)

상태: `쉼` · `수신 중`(`_aioQuoteInFlight`) · `재시도 대기`(스케줄러 안의 재시도 timer 하나, `window._aioScheduleQuoteRetry`가 걸고 `window._aioCancelQuoteRetry`가 푼다).

| 현재 | 사건 | 다음 | 돌려주는 값 |
|---|---|---|---|
| 수신 중 | 또 호출 | 수신 중 | `{ok:false, skipped:true, coalesced:true}` |
| 쉼/재시도 대기 | 호출 | 수신 중 (대기 중 재시도 취소) | — |
| 수신 중 | 시세 0건, 스냅샷 있음 | 쉼 | `{ok:false, status:'failed'}` (스케줄러 주기가 다시 시도) |
| 수신 중 | 시세 0건, 스냅샷 없음 | 재시도 대기(backoff 15·30·…·300 s, 기존 대기 교체) | `{ok:false, status:'failed'}` |
| 재시도 대기 | timer, 탭 숨김 | 쉼 | 호출 안 함(복귀 갱신이 맡음) |
| 재시도 대기 | timer, 탭 보임 | 수신 중 | — |

불변식: 재시도 timer는 많아야 하나. 숨긴 탭은 재시도 timer로 호출하지 않는다(SM-03P R3과 같은 약속).

### SM-06 뉴스 수신 잠금 (`fetchAllNews`)

`쉼` → `수신 중`(`isFetching`, `_fetchStartTime`) → `쉼`. 180초 넘은 잠금은 다음 호출이 강제로 푼다. 서버 묶음이 신선하거나 10분 캐시 안이면 수신하지 않고 그 데이터를 쓴다(데이터가 현재이므로 성공으로 기록하는 것이 맞다). 수신 중 호출은 v59.74부터 `coalesced`를 돌려준다(SM-03a).

### SM-07 화면 진입 갱신 (`_aioRefreshPageData`)

화면마다 `AbortController` 하나. 다른 화면 진입은 그 화면의 진행 중 갱신을 `route-changed`로, 같은 화면 재진입은 `superseded`로 취소한다. 작업별 가드: ½ interval 안의 성공은 건너뜀, 30초 안의 진입 갱신은 건너뜀. 부팅 시세 단계가 준비되기 전(`quoteReady===false`)에는 돌지 않는다. 열린 결함 SM-07(§2).

### SM-08 AI 질문 요청 run

run 상태: `준비`(잠금, 데이터·리서치 대기) → `스트리밍` → `해제`; 어느 단계에서든 `취소`(사용자 중지·다른 화면·대체·60초 stale). 공유 대화 상태(`chat-sessions.js` shared)는 `_activeRequest`, `_requestEpoch`, `streaming`을 가진다.

불변식: 활성 run은 하나다. `_aioIsCurrentChatRequest`는 epoch·취소·abort를 함께 본다. 해제는 자기 epoch일 때만 공유 상태를 푼다. 쿼터 확인 모달은 취소 시 닫힌다. 열린 결함 SM-08(§2, 버튼만 잘못 켜짐).

### SM-09 · SM-10 지연 스크립트 로더

`스텁(호출 대기열)` → `불러오는 중`(pending 하나) → `적재`(대기열을 순서대로 재생) | `실패`(pending 지움, 알림 + 다시 시도). 같은 초안 전송·두 번째 AI 버튼은 대기열에 두 번 쌓지 않는다(P2171). 용어 사전은 대기열이 없고 `aio:glossaryReady`로 알린다. 새 결함 없음.

### SM-11 핵심 데이터 관문

`닫힘`(작업 대기열) → `열림`(한 번, 이후 바로 실행). `data.json`·`history.json` 읽기가 settle(ready·failed·empty)하거나 대체 대기(20 s)가 지나면 연다. 되돌아 닫히지 않는다.

### SM-12 산출물 캐시 항목

키마다 `없음` → `수신 중(소비자 n)` → `보관(TTL)` | `중단`(소비자 0 또는 시간 초과·정체). 소비자가 모두 떠나면 중단, 중단된 항목에는 새 요청이 합류하지 않는다. 강제 새로고침·수동 새로고침의 전이는 `ci-artifact-cache-model-check.mjs`(C3)가 전수 검사한다.

### SM-13 유니버스 밖 종목 읽기

종목마다 `없음` → `대기(promise)` → 기록(`ready`·`in-universe`·`not-listed`·`unavailable`·`universe-unavailable`). `ready`/`in-universe`는 유니버스 지문이 같을 때만 재사용, 그 밖은 60초 뒤 다시 읽음, `universe-unavailable`은 매번 다시 읽음. 동시 2개. 열린 결함 SM-13(§2).

### SM-14 서비스 워커 교체 새로고침

`controller 없음` → (첫 `controllerchange`) `controller 있음` → (다음 `controllerchange`) 세션당 한 번 새로고침(`aio_sw_controller_reload_v1`). 버전이 맞으면 플래그를 지워 다음 업데이트도 한 번 새로고침한다. 새로고침 반복 없음.

### SM-15 서버 데이터 적재 상태

`__aioServerDataLoadState`: `(없음)` → `ready` | `failed` | `empty`. 한 번 적용(`__aioServerDataApplied`)된 뒤의 실패는 상태를 `failed`로 되돌리지 않는다(적용된 사본이 날짜와 함께 남는다). 코어 준비 전이면 1초 간격 최대 5회 다시 적재한다. 열린 관찰 SM-15(§2).

### SM-16 부팅 시세 단계

`quoteReady=false`(부팅 0~2.5 s, 화면 진입 갱신·포트폴리오·스크리너 재시도 막음) → `true`(2.5 s에 켜고 아키텍처 준비를 최대 8 s 기다린 뒤 첫 수신). 켜진 뒤 진입 갱신이 먼저 수신을 잡으면 부팅 수신은 `coalesced`로 끝난다(무해).

---

## 4. 이 문서 밖에서 이미 검사되는 상태 머신

| 상태 머신 | 게이트 |
|---|---|
| AI 월 예산 장부(Worker Durable Object) | `scripts/ci-ai-ledger-model-check.mjs` |
| AI 시장 해설 게시 수명주기(생산자) | `scripts/ci-narrative-lifecycle-model-check.mjs` |
| history.json 세션 레인(생산자) | `scripts/ci-history-session-model-check.mjs` |
| 시장 세션 분류(생산자) | `scripts/ci-market-session-model-check.mjs` |
