# 자동화의 실제 완료와 사용자 도달을 검증하는 구조

2026-09-21 · v56.01 / HEAD 2bf963a76c6f2fb1079166ce806beaaa820b1c6a. Astra 설계·집필. 제품 수정 없음. 정적 코드와 합성 실행으로 확인하며 현재 원격 운영 성공 여부는 인증하지 않는다.

## O04 — 예정 작업이 누락돼도 운영 집계는 PASS 가능

`scripts/build-operations-slo-window.mjs`의 fetchRuns는 completed 실행만 가져온다. summarize는 그중 success 비율을 계산하고, artifactRuns는 market/screener 실행을 합친다. windowSummary는 날짜 수와 성공률·SHA 형식 충족으로 PASS를 만든다. 실제 실행의 원본 SHA를 가졌다는 것과 해당 산출물의 품질·도착을 검증했다는 것은 다르다.

실제 스크립트에 network/writeFile만 대체한 [합성 반증](automation-slo-repro.json): market refresh는 30일 매일 1회 성공, screener refresh는 0회, watchdog은 30일 매일 1회 성공. 반환은 CERTIFIED_WINDOW, 7d/30d PASS, thirtyDaySlo PASS였다. 현재 설정 watchdog은 매시간, screener는 6시간마다다. 따라서 한 데이터 영역이 아예 멈추고 예정 감시 대부분이 없는데도 해당 인증 상태가 만들어질 수 있다. publicPromotionAllowed=false는 유지되므로 이 반증이 자동 공개 승격까지 입증하지는 않는다. 실제 운영에서 같은 장애가 발생했다는 주장이 아니다.

`ci-operations-slo-window-check.mjs`도 같은 집계 조건을 검사한다. 형태가 맞는지 검사하는 gate를 통과해도 운영 완전성은 입증되지 않는다.

설계: 각 데이터 도메인별로 다음을 독립 측정한다.

- **예정 도착률**: calendar/정책상 필요한 산출물 중 deadline까지 도착한 비율. 수동 실행을 추가해 분모를 유리하게 바꾸지 않는다.
- **실행 성공률**: 시작한 job 중 성공. 미실행·queued·hung·취소·재시도는 별도 상태다.
- **유효 데이터율**: 필요한 entity/field 중 단위·기간·시점·품질을 충족한 비율.
- **사용자 도달률**: 공개 manifest와 실제 소비 revision 일치, 허용 지연 내 화면 도달.
- **복구 성과**: 마지막 적격 데이터 이후 경과시간, 장애 탐지 지연, 복구 시간과 영향 범위.

artifact aggregate가 한 영역의 소실을 덮지 못하도록 market, screener, fundamentals, reference 등 별도 SLO를 만든다. 한 날짜에 성공 한 번이라는 요건을 24시간 운영 증거로 승격하지 않는다. API pagination 한도·조회 기간 경계·branch/event·retry 중복을 명시하고 불완전 조회는 인증 불가로 둔다.

GitHub는 schedule 지연과 고부하 시 누락 가능성을 명시한다. 따라서 schedule 자체를 실행 보장으로 취급할 수 없다. [GitHub 공식 schedule 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule). 현재 watchdog도 같은 Actions 기반이므로 그 scheduler가 멈추는 장애를 독립적으로 탐지하지 못할 수 있다. 외부 heartbeat 또는 데이터 소비 측 최대 허용 지연 감시를 설계하며, 중복 알림과 비용을 고려해 필요한 도메인에만 적용한다.

인수 fixture: screener 0회, 하루 한 번만 실행, job 무한 대기, 예정시각을 넘긴 성공, retry 성공, 공식 휴장, API 일부 페이지만 응답, 최신 원격 revision과 소비 revision 불일치. “실행된 작업이 모두 성공”과 “필요 데이터가 계속 제공됨”을 별도 판정해야 한다.

## O05 — 구성 상태와 실측 상태 혼합

`scripts/build-operations-status.mjs:468`은 browser plane을 관측 없이 CURRENT/CONFIGURED_HEALTHY로 만든다. 저장소의 실제 operations-status에도 이 상태가 있다. 이는 브라우저 실행·Pages 도달·SW revision 일치의 실측 근거가 아니다. UI가 이 값을 실제 정상 인증으로 표시하는 전체 소비 경로는 이번에 확인하지 않았다.

설계: configured, lastAttempt, lastSuccess, dataQuality, deliveryObserved, evidenceAge를 분리한다. 관측하지 않았으면 UNKNOWN/NOT_OBSERVED이고 설정돼 있으면 configured=true다. 오래된 성공은 성공 시각을 유지하되 현재 건강 상태로 승격하지 않는다. 운영자는 실패 plane과 영향 기능을, 사용자는 “종목 가격은 최신 참고, 재무 순위는 갱신 대기”처럼 기능 수준 상태를 본다.

## O06 — SEC 부분 수집 결과와 workflow 성공의 의미

Luna MAX 정적 추적: screener workflow는 SEC 24개 batch를 실행한다. `fetch-sec-fundamentals.mjs:499–529`는 회사별 오류를 TRANSIENT_PROVIDER_FAILURE로 기록하고 계속 진행하며 attempted/updated/failures를 발행한 뒤 정상 반환한다. 후속 projection/스크리너 validator는 동일성·형식·coverage를 검사하지만 이번 SEC batch의 updated/transient failure를 publication 성공의 필수 조건으로 사용하지 않는다. 따라서 기존 레코드가 충분하면 이번 수집이 모두 실패해도 전체 workflow 성공과 양립할 수 있다. 모든 endpoint 실패를 네트워크 주입으로 재현하지는 않았다.

이것이 곧 모든 부분 실패에 workflow를 중단해야 한다는 뜻은 아니다. 점진 수집이라면 기존 적격 데이터 유지가 합리적이다. 문제는 **이번 수집 성공, 기존 값 보존, 분석 적격성, publication 성공**을 같은 성공 상태로 합치는 것이다. domain receipt에 attempted/updated/retained/terminalUnsupported/transientFailed와 lastSuccessfulObservation을 독립 기록하고, 허용된 부분 성공 기준을 명시한다. 필수 재무 입력이 시점/기간 요건을 잃은 종목은 분석에서 제외하되 가격 전용 화면까지 불필요하게 막지 않는다.

현재 파일은 eligible=655, stored=562, attempted=24, updated=24다. 실패 원장 95개는 terminal 68, transient 3, status 없는 구형 24로 서로 다른 성격이다. 이를 전부 이번 batch 실패 또는 새 수집 성공으로 해석하지 않는다. 현재 수집 전체 실패가 관찰됐다는 주장은 아니다.

보호 장치도 있다. market refresh의 commit 조건은 fetch 및 degradation/continuity/reconciliation/promotion gate 성공을 요구한다. presence-only continuity 검사 옆에는 별도 reconciliation 검사도 있다. 따라서 “게이트가 아무것도 막지 않는다”는 결론은 부정확하다. 강화 대상은 도메인별 현재 수집 성과와 허용된 부분 발행 정책이다.

선택적 소스의 정책 경계: earnings producer는 API 키가 없어도 이전 current-reference 파일이면 그대로 정상 반환한다(`fetch-earnings-calendar.mjs:53–55`). UI는 weekStart/weekEnd/generatedAt을 읽고 이번 주 행만 렌더하며 저장 범위를 표시한다(`js/aio-pages.js:1551–1580`). 현재 파일도 operator-key-required/0건이다. 따라서 이전 주 사건을 이번 주로 오표시하는 결함으로 분류하지 않는다. 의도된 무키 fallback이며, 갱신 실패·기존 범위·현재 이용 가능성이 분리되는지 인수할 정책 경계다.

## O07 — 검증된 배포 SHA와 브라우저 입력 묶음은 다른 경계

Astra 추가 정적 확인: Pages workflow는 CI conclusion/branch/SHA, attestation의 testedSha를 대조하고 정확한 SHA를 checkout한다. 배포 뒤 external pipeline 및 live invariant 검사도 선언돼 있다. 따라서 mutable main을 무조건 배포하는 구조라고 판단하지 않는다. 이 감사에서는 해당 원격 실행의 성공을 조회·검증하지 않았다.

반면 screener provider의 readCurrent(`src/data/providers/screener.js:175–203`)는 screener/universe/model-validation의 가변 URL을 Promise.all로 각각 읽는다. freshness와 per-field readiness가 있지만 세 응답의 publication manifest/hash 호환성을 대조하는 경로는 이 함수에서 확인하지 못했다. content-addressed snapshot 생성은 받은 행 집합의 식별이며, 입력 파일들이 같은 publication에 속한다는 증거와 다르다. 서로 다른 cadence의 파일이 무조건 같은 생성일이어야 한다는 뜻도 아니다.

SW shell 경로(`sw.js:199–219`)는 각 요청을 network-first로 받아 캐시에 저장하고 실패 시 개별 캐시를 반환한다. URL별 최신 파일 또는 이전 캐시를 조합할 수 있는 구조다. 실제 배포 전환 중 old/new 코드가 섞여 오류를 냈다는 브라우저 재현은 하지 않았으므로 **revision 호환성 조사 후보**로 남긴다. TTL 보호와 SHA 배포가 있어도 이 사용자 세션 경계를 자동 증명하지는 않는다.

설계: data manifest는 서로 다른 관측 cadence를 허용하되 함께 사용 가능한 각 파일의 불변 주소/hash/schema/modelVersion을 묶는다. client는 manifest를 먼저 고정하고 입력을 검증한 뒤 새 세트로 교체한다. 실패하면 마지막 완전한 호환 세트 또는 기능별 명시적 부분 상태를 사용한다. shell도 content hash 자산 또는 검증된 release 단위로 읽도록 한다. 열린 화면의 run은 고정하고 새로운 자료가 도착하면 새 run으로 이동했음을 알린다.

인수: 세 요청 사이 publication 전환, 새 파일 일부 404, 오프라인 복귀, 이전 탭+새 SW, 취소 후 늦은 응답, schema 변경, 데이터만 갱신. revision이 다른 것 자체가 실패가 아니라 허용된 compatibility/시점 정책을 위반한 조합을 차단하는지 검사한다. 실제 데이터 저장소 분리는 16의 비용·주기·독립 rollback 조건으로 결정한다.

## 구현 작업 단위와 인수

| 순서 | 소유 모듈/책임 | 대체할 동작 | 인수 증거 |
|---|---|---|---|
| 1 | source registry + domain receipt | job exit code만으로 수집 성공 추론 | SEC 전부 실패·일부 실패·terminal 제외를 구분 |
| 2 | SLO builder/checker | completed 합산으로 전영역 인증 | 예정 누락·도메인 0회 반증을 차단 |
| 3 | operations status producer/consumer | configured를 CURRENT로 표시 | 관측 없음/오래된 성공/새 실패 상태 일치 |
| 4 | publication coordinator | 비교 도메인 간 임의 latest 조합 | 동일 revision 소비·부분 rollback fixture |
| 5 | 사용자 상태/AI explanation | 전역 정상 배지 | 기능별 사용 가능한 범위·시각·누락 이유 |

새 metadata를 추가하는 것만으로 완료하지 않는다. 기존 aggregate 성공을 소비하는 승격 조건과 UI writer를 찾아 교체해야 한다. 각 단계는 독립 검증·rollback 가능한 크기로 구현하고, 실제 원격 이력은 따로 측정한다.

## 공통 receipt 계약

job receipt는 runId, domain, sourceRevision, input watermarks, attempted/succeeded/failed/retained entity 수, validation 결과, output hashes, publication revision, consumer 확인을 담는다. 생성시각 하나로 데이터가 새로워졌다고 표시하지 않는다. 실패 시 마지막 적격 데이터와 실패 receipt를 함께 남긴다.

필수 도메인 오류가 전체 publication을 막아야 하는지, 해당 projection만 이전 적격 버전으로 남길지는 dependency와 비교 의미로 결정한다. 무조건 전체 중단도, 무조건 부분 발행도 정답이 아니다. 함께 비교되는 피처 집합은 일관된 snapshot을 유지한다. UI/AI가 서로 다른 run의 시각·점수를 조합하지 못하게 한다.

발행 완료는 파일 생성이나 commit으로 끝나지 않는다. manifest 검증, 소비 가능한 revision 공개, 실제 도달 확인, 운영 receipt 보존까지 각각 상태를 가진다. public status 갱신 자체가 실패하더라도 마지막 성공 시각으로 지연을 감지할 수 있어야 한다.

## 2026-09-23 O04–O07 상태와 운영 인수 계약

상위 상태와 실행 순서는 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md), [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)와 일치한다.

| 발견 | 최신 상태 | P 항목으로 닫힌 부분 | 남은 운영/사용자 인수 |
|---|---|---|---|
| O04 | **부분 구현 + 새 반증 열림** | P1166가 market/screener/watchdog lane 분리, workflow cadence 기반 expectedRuns, dispatch 제외, pagination completeness, 정상 cadence 긍정 대조를 추가했다. | R24-07에서 `workflow_dispatch` 외 `push`를 scheduled로 세는 새 경로가 확인됐다. 예정 event 귀속·slot 단위 중복/재시도·휴장 처리가 남는다. 현 원격 30일 성공 여부는 이 문서로 판정하지 않는다. |
| O05 | **부분 구현** | P1166이 `configured`와 `observed`를 분리하고 browser plane의 관측 없음은 UNKNOWN/NOT_OBSERVED로 만든다. P1173은 `overallBasis`와 featureAvailability를 추가했다. | status consumer에서 기능별 사용자 문장으로 연결하고 browser/delivery 상태를 기능별로 보이는지 확인해야 한다. durable overall만으로 browser 정상/비정상을 표시하지 않는다. |
| O06 | **부분 구현** | P1169가 SEC batch receipt와 `SUCCESS/PARTIAL/NO_REFRESH_RETAINED/EMPTY/NOT_ATTEMPTED` 계약을 구현하고 5개 fixture로 실패/유지 축을 분리했다. | SEC 외 domain receipt, checked-in 최신 산출물, 운영 알림·화면 연결은 남아 있다. 기존 데이터 보존을 이번 refresh 성공으로 말하지 않는다. |
| O07 | **부분 구현** | P1173이 screener/universe/model-validation 소비 조합에 COHERENT/INCOMPATIBLE/UNVERIFIABLE 판정을 넣고 일부 교체 상태를 탐지한다. | publication 전체 coordinator, SW/cache 세대 전환과 사용자 run 고정, 실제 배포/원격 브라우저 혼합 전환 trace는 미검증이다. |

### O04 예정 실행 분모: event와 schedule slot을 같은 식별자로 연결

`completed runs`를 분모로 삼지 않는다. 각 예정 slot을 workflow schedule 정의와 업무 calendar에서 먼저 생성하고, 해당 slot에 도착한 **schedule event**만 분자 후보가 된다. `push`, `workflow_dispatch`, repository/manual dispatch, 재시도는 별도 지표로 보존하되 schedule 도착률 분자에 더하지 않는다. `push` 성공만으로 schedule 누락을 채우면 안 된다.

```ts
type ExpectedDeliverySlot = {
  slotId: string;                    // hash(workflowId, domain, scheduledAt, cadencePolicyVersion)
  workflowId: string;
  domain: string;
  scheduledAt: string;
  deadlineAt: string;
  calendarStatus: 'expected' | 'market_holiday' | 'not_due';
};
type RunReceipt = {
  runId: string;
  eventName: string;                 // schedule/push/workflow_dispatch/…
  scheduledAt: string | null;
  slotId: string | null;
  attempt: number;
  conclusion: string;
  startedAt: string;
  completedAt: string | null;
  outputRevision: string | null;
};
```

한 `slotId`는 여러 재시도를 하나의 도착 기회로만 센다. schedule delay는 grace deadline 전·후를 나누고, grace를 넘긴 성공은 실행 성공으로 셀 수 있지만 정시 도착으로 소급 집계하지 않는다. market holiday는 해당 market calendar로 분모에서 제외하고 이유/달력을 공개한다. calendar 미검증은 휴장으로 간주하지 않고 인증을 제한한다. 7d/30d 집계는 workflow/domain/calendar policy revision 및 API pagination 완전성을 함께 묶는다.

### 공통 반증 fixture와 운영 dashboard 언어

| Fixture | 필요한 run/slot 입력 | 예상 판정 |
|---|---|---|
| `O04-push-only` | 30일 push 성공, 대응 schedule slot 미도착 | schedule arrival 0, 30d PASS 금지 |
| `O04-manual-does-not-fill` | schedule 누락 뒤 workflow_dispatch 성공 | manual count 증가, schedule slot 미충족 유지 |
| `O04-retry-one-slot` | 같은 slotId에서 3 attempts, 마지막 성공 | slot 분자는 최대 1; retry count 별도 |
| `O04-late-success` | deadline 초과 뒤 성공 | execution success와 on-time arrival 분리 |
| `O04-holiday` | domain calendar의 검증된 휴장 | 예정 분모에서 제외, 별도 holiday 카운트 증가 |
| `O04-incomplete-query` | API pagination/page cap 또는 조회 window 누락 | 인증 `INSUFFICIENT_EVIDENCE`; 실패율을 축소 집계하지 않음 |
| `O06-all-failed-retained` | 이번 batch 0 update, transient failure, 이전 data 보존 | `NO_REFRESH_RETAINED`; 데이터 사용 가능성과 새 수집 성공 분리 |
| `O07-cross-generation` | 배포 경계 중 manifest revision 혼합, 일부 404, 이전 tab/new SW | 허용 compatibility가 없는 조합은 activate하지 않고 마지막 호환 세트를 보존 |

운영자 화면은 `예정 slot / 도착 / 지연 / 미도착 / 실패 / 기존값 유지`와 dataQuality를 domain별로 보여준다. 사용자 화면은 내부 run ID 대신 `가격 참고는 10:15 기준, 재무 분석은 새 자료 대기 중`처럼 실제 기능을 좁혀 말한다. 설정만 되어 있는 browser plane은 `관측되지 않음`이지 `정상`이 아니다. 상태 카드 하나로 서로 다른 domain의 freshness를 합치지 않는다.

### 단계적 도입·rollback

1. 기존 7d/30d 결과와 raw run list를 보존하고 새 slot-matcher를 shadow 계산한다. O04 0회·push-only 반증을 포함해 기존 PASS와 새 결과 차이를 모두 검토한다.
2. 먼저 report-only로 출시한다. expected-slot inventory, calendar, pagination completeness, event attribution이 설명 가능해진 뒤 승격 경계에 연결한다.
3. receipt producer는 domain별로 배포하고 consumer는 optional receipt가 없을 때 `unknown`으로 downgrade한다. 오래된 발행물을 새 SUCCESS로 변환하지 않는다.
4. 새 산출물이나 consumer가 호환되지 않으면 마지막으로 검증된 publication revision을 계속 제공하고 새 domain만 `degraded`로 분리한다. 배포를 되돌릴 때 manifest와 shell의 호환 revision도 함께 복구한다.
5. false PASS, slot 중복, 예정 이벤트 미귀속, partial rollout 미탐지가 발견되면 promotion을 멈추고 raw evidence를 보존한다. local fixture 통과만으로 원격 운영 인증을 선언하지 않는다.

실제 O04–O07 인수 trace는 21의 manifest 형식을 따른다. 최소한 workflow YAML/cron revision, query window/pages, raw event/run IDs와 eventName, expected slot 목록, data/publication revision, browser가 소비한 revision, 화면 캡처·console, live deployment SHA를 연결한다. 이 문서 변경으로 실제 GitHub Actions 이력이나 배포가 조회/검증된 것은 아니다.
