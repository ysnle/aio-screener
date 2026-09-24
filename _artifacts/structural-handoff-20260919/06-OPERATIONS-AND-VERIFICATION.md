# 06 — 운영과 검증이 실제 경계를 덮는가

Astra 설계 · Luna MAX 조사 · 2026-09-20. 배포/API실행권한을 요청하거나 사용하지 않았다.

> **v56.15 현재성 보강 (2026-09-23):** 아래 O01–O03의 서술은 최초 발견 당시(v55.22–v56.01) 기록으로 남긴다. 완료·잔여 상태는 이 파일의 마지막 절과 [25 finding 상태 crosswalk](25-CURRENT-FINDING-STATUS-CROSSWALK.md)가 정본이다. 특히 P1173이 O01/O03 일부를, P1166이 O02/O04/O05 일부를, P1169가 SEC의 O06 일부를 닫았다. 새 발견 R24-07은 `push` 실행도 예정 run으로 계산될 수 있음을 확인했다. 기존 설계만 보고 이미 해결됐거나 아직 전부 미구현이라고 판단하지 않는다.

## O01 / W06-A — 변경 영향과 gate 입력의 일치

역사 발견: v55.22에서 js/aio-kr-data.js는 data-refresh gate의 입력으로 선언됐으나 `--files js/aio-kr-data.js --list`는 core/browser만 선택했다. 이 결과를 v56.15의 열린 결함으로 재인용하지 않는다. P1173에서 선언 input과 impact rule의 차이를 파생 검사해 당시 228개 drift를 0으로 만든 로컬 gate와 canary를 추가했다.

유지할 계약: gate가 의존하는 입력과 impactRules에서 해당 gate가 선택되는 규칙을 함께 검사한다. 이름 매칭만으로 충분하지 않으며 dynamic import, 생성물, registry 의존을 포함한다. producer 변경 canary는 consumer·contract·semantic fixture의 실제 gate 선택을 현재 registry에서 파생한다. 복제 문서 목록을 정본으로 두지 않는다.

## O02 / W06-B — SLO 관측창 완전성

역사 발견: 초기 builder는 workflow별 run pagination·branch 범위를 충분히 발행하지 않았고, 서로 다른 domain의 관측일 합집합이 필요한 범위를 덮을 수 있었다. 실제 원격 Actions에서 인증 오류가 났다고 단정하지 않는다. P1166은 domain별 lane, expected cadence, manual run 제외, pagination completeness를 추가했지만 R24-07의 event/slot 혼입은 현재 열려 있다. 자세한 최신 계약은 아래 R24-07 절이 정본이다.

## O03 / W06-C — SW와artifact 세대일치

역사 발견: 초기 SW cache route에서 data.json, history.json, screener.json, telegram-digest.json의 경로와 cache TTL/fallback 관계가 충분히 명시되지 않았다. 이 사실만으로 실제 오프라인 장애가 있었다고 확정하지 않는다. P1173은 소비되는 core artifact의 cache route와 자체 TTL 검사 일부를 추가했다.

유지할 인수: online→offline, 이전 tab이 열린 채 새 release, shell 성공/data 실패, artifact 일부만 새 revision, cache quota, failed refresh 뒤 last-good을 브라우저에서 확인한다. 화면은 수신 모드·관측일·revision을 보존하고 서로 다른 세대의 model input을 완전한 한 결과처럼 합치지 않는다. 사용자에게 cache key 대신 “저장된 9/18 자료”처럼 설명한다.

## 긍정적 연결과 한계

refresh→fail-closed validation→exactSHA CIattestation→Pages exactSHAdeploy/convergence 경로가있다. 이것은배포정합성의좋은기반이다. 로컬gate통과를현재서비스가용성·데이터권리·30일SLO로확장하지않는다. boot/soak stale표시와 NOT_CERTIFIED template도정직한상태로보존한다.

## 이번 QA 실행의 실패 보존

[v56 재검증](RECHECK-V56.md)에 PASS103/FAIL5/SKIP23의확대실행을기록했다. data-plane503은같은테스트의두gate에서발생했고, refresh/lineage는로컬artifact SLA, knowledge-lint는generatedstate불일치였다. 코드수정금지범위라직접고치지않는다. 환경문제/실제코드문제의근본원인과시점별재현을구분해구현작업으로넘긴다.

다음조사: refresh retry/backoff/idempotency, partialpublish원자성, provider일일쿼터·공유토큰·CORS/auth분리, emergencyrollback, 실패알림누락·과다알림. 자동commit/push/deploy는허용되지않는다.

## v56.15 현재 상태와 통합 이행 계약

아래 표는 최초 O01–O03 기록을 v56.15와 P ledger에 대조한 상태다. 각 수정은 연결 gate가 검사한 범위에서만 완료로 본다.

| 발견 | 상태 | 완료·잔여 근거 |
|---|---|---|
| O01 gate input/impactRules | P1173 보강 완료 | 선언 input과 규칙의 drift 파생 검사 및 canary가 228→0. 새 registry 의존이 계속 포착되는지 유지 |
| O02 관측창 완전성 | P1166 부분 완료, R24-07 열림 | pagination/domain 분리와 cadence field는 있으나 scheduled event 귀속이 틀릴 수 있음 |
| O03 service worker/artifact | P1173 정적 계약 보강 | 핵심 artifact cache route/TTL 추가; offline 전환·구/신 탭·복구 브라우저 실측은 미완료 |
| O04 scheduled arrival | P1166 부분 완료, R24-07 열림 | domain lane과 cron cadence가 있으나 push-only 성공도 PASS가 될 수 있음 |
| O05 configured vs observed | P1166/P1173 producer 보강 | UNKNOWN/NOT_OBSERVED와 basis field 발행; 기능별 화면 소비·원격 browser observation 미완료 |
| O06 부분 수집·publication | P1169 SEC에서 부분 완료 | SEC receipt의 순수 fixture는 있음; 다른 도메인 receipt와 status 소비·사용자 복구 설명 미완료 |
| O07 input generation/compatibility | P1173 screener 일부 완료 | compatibility 판단과 partial set 차단 있음; common publication ID, remote transition, 전체 domain 전파는 미완료 |

### R24-07 / O02·O04 — 예정 도착은 workflow 실행 수가 아니라 slot으로 측정

현재 v56.15 순수 계산 반증에서 build-operations-slo-window.mjs는 workflow_dispatch만 제외하고 push 등 나머지 event를 모두 scheduled로 분류한다. 30일 성공 push만 넣은 screener lane도 MEASURED, 창도 PASS가 됐다. 원격 운영 장애의 관측이 아니라 집계 함수의 의미 오류다. P1166은 domain lane, cron 기반 expected count, pagination completeness를 추가했지만 새 반증은 아직 차단되지 않았다.

새 기준은 도메인별 versioned SchedulePolicy에서 생성하는 slotId(domain + policyRevision + scheduledAt)다. policy는 workflow/producer, UTC cron 또는 명시 cadence, domain calendar와 휴장 규칙, due time, 허용 지연, required output set, consumer delivery 조건을 소유한다. cron만으로 거래일·24/7 자료의 분모를 정하지 않는다. run receipt는 trigger event, runId/runAttempt, branch/SHA, started/completed/publishedAt, slotId, publicationId, output hashes를 연결한다. schedule event만 slot 후보이며 push, pull_request, workflow_dispatch, workflow_run은 on-demand lane이다. retry는 같은 slot의 attempt이지 새로운 도착이 아니다.

scheduledArrivalRate는 deadline까지 호환 publication과 consumer 도달이 있는 unique slot 비율, executionSuccessRate는 시작된 시도의 성공/실패/취소, dataValidityRate는 required entity/metric/period/unit/rights 충족률, consumerDelivery는 실제 사용된 revision과 관측시각을 각각 본다. 빌드 성공과 데이터 검증 실패가 동시에 일어나면 실행 성공이어도 유효 도착은 아니다. 휴장/no-data는 policy가 명시할 때만 허용 결과다. 조회가 잘렸거나 branch/SHA/slot이 모호하면 PASS 대신 INSUFFICIENT_EVIDENCE, schedule 미설정은 NOT_CONFIGURED다.

필수 반증 fixture:

| 입력 | 기대 |
|---|---|
| 예상 30 schedule slot, 각각 유효 publication과 exact SHA가 연결 | policy threshold 충족 시 PASS — 양성 대조 |
| 30일 push-only 성공 또는 workflow_dispatch-only 성공 | 예정 도착 0/30, PASS 금지 |
| 28 schedule + push 2회 + manual 2회 성공 | 예정 도착 28/30 |
| 한 slot retry 3회 후 정상 발행 | unique 도착 1회, attempt 3회; 분모·분자 중복 없음 |
| 성공 run이나 invalid output/publication 누락/consumer 미도달 | execution success와 valid delivery를 각각 판정 |
| cancel, hung, 다음 slot 지연, duplicate run, SHA 누락 | 상태 분리; 귀속 모호 시 인증 불가 |
| pagination truncated, branch 누락, cron parse 실패, schedule 없음 | 인증 불가 또는 NOT_CONFIGURED; PASS 금지 |
| 공식 휴장/no-data day | domain policy와 receipt에서 선언된 예외만 허용 |

소유권: 도메인 owner는 필수 자료·휴장·허용 지연, workflow owner는 trigger·slot·retry·SHA, publication coordinator는 hash/manifest/pointer, operations owner는 SLO 계산과 completeness, feature owner는 상태 표시를 책임진다. producer와 checker가 같은 순수 함수를 공유해도 push-only 반증과 healthy schedule positive control을 유지한다. 새 assertion에는 실제 예방 P ID와 verify_by를 QA ledger에 연결한다.

전환은 현재 계산과 slot 계산을 별도 schema로 shadow 운전한다. 과거 run은 원래 slot으로 유일하게 귀속할 수 있을 때만 backfill하며 모호하면 unclassified로 남긴다. 정상 대조와 반증 gate, 완전 관측 창을 확인한 뒤 consumer를 전환한다. 새 계산이 틀리면 certification을 멈추고 원본 run/receipt를 보존한 뒤 검증된 계산 revision으로 복구한다. P1166의 과거 false PASS를 유효 값으로 복원하지 않는다. local synthetic gate와 실제 30일 원격 window는 각각 독립 evidence다.

### O01/O03/O05/O06/O07 end-to-end 완료 계약

- O01: architecture/qa-pipeline.json input과 impact rules에서 실제 선택 gate를 파생한다. 새 producer, domain contract, semantic fixture, browser 의존을 canary로 묶고 문서 파일 목록을 정본으로 만들지 않는다. P1173의 228→0 결과는 당시 선언 범위에 한정한다.
- O03/O07: publication manifest에 publication ID, artifact별 hash/schema, source SHA, model/definition revision, required member, compatibility policy, 생성/공개 시각을 둔다. consumer는 한 manifest를 고정하며 latest 파일을 임의 조합하지 않는다. cadence 차이는 허용할 수 있지만 schema 불명·세대 일부 교체는 unverifiable/partial이다. 저장 run은 input snapshot identity를 보존한다.
- O05: configured, last attempt, last successful observation, evidence age, data validity, publication, consumer delivery, feature availability, missing reason을 독립 축으로 유지한다. overall에는 포함·제외 plane을 선언한다. 관측 없는 기능은 unknown, 오래된 성공은 stale/reference다.
- O06: P1169 SEC receipt는 도메인 패턴의 첫 완료다. 확장 receipt는 run/source revision, input watermark, attempted/updated/retained/failed/quarantined, validation, output hashes, publication, last successful observation, consumer acknowledgement를 연결한다. 0 updates가 파일 생성시각을 현재성으로 올리지 않는다. 필수 member 결측은 ranking/analysis를 보류한다.

### 브라우저·사용자 인수, 권리·보안, 복구

브라우저 fixture는 online N→N+1 전환, 이전 탭 유지, 파일 일부 404/new revision, manifest/hash 불일치, offline 복귀, cache quota, timeout, 취소 뒤 늦은 응답, 구 shell과 신 schema, 저장 run replay를 포함한다. positive control은 cadence가 달라도 호환 manifest가 선언한 입력이다. 사용자는 사용한 자료 기준일·publication revision·현재 갱신 실패·실행 보류 이유를 확인할 수 있어야 한다. 상태는 색에만 의존하지 않고 keyboard, focus, screen reader, 좁은 viewport에서도 이유와 출처 시각을 전달한다.

Workflow token과 provider secret은 필요한 job에 최소 권한으로만 제공한다. client bundle, public artifact, issue body/title, log/trace에 secret을 넣지 않는다. user portfolio와 원문 검색 내용은 public operational log로 복사하지 않는다. source registry에 allowed use, attribution, persistence/redistribution, retention/deletion, 확인 owner/date가 없으면 public publication으로 승격하지 않는다. HTTP 200과 성공 fetch는 권리 확인이 아니다.

복구 runbook은 detect → 영향 기능/source 확인 → 신규 publication freeze → last-good compatible manifest 고정 → stale/impact 표시 → credential rotation 또는 source 재수집·정정 → hash·consumer 확인 → 원인/영향 기록 순서다. app release와 data pointer는 서로 다른 owner가 compatibility를 확인한다. 실패 candidate는 격리하고 잘못된 데이터나 false PASS를 last-good으로 재등록하지 않는다. 새 schema와 구 shell이 호환되지 않으면 한쪽만 독립적으로 이동하지 않는다.

| 단계 | owner | 완료 조건 | 실패 복구 |
|---|---|---|---|
| SchedulePolicy/slot | domain + workflow owner | 실제 cron/event와 due slot, retry fixture 일치 | 인증 불가로 닫고 원자료 보존 |
| receipt/manifest | producer + publication coordinator | output hash/schema/rights/member/receipt 일치 | candidate quarantine, last-good 유지 |
| SLO | operations owner | push-only, zero run, retry, truncate, 정상 schedule 모두 판별 | 새 인증 중지, 검증된 계산 revision 복구 |
| SW/provider | runtime/shell owner | old/new tab, offline, partial rollout, replay browser evidence | 호환 last-good set, 위험 기능 보류 |
| 기능 상태 UX | route owner + accessibility reviewer | 날짜·이유·사용 가능 범위를 접근성 있게 전달 | 모호하면 unavailable/reference |
| live delivery | operator | 실제 SHA attestation, Pages/SW/data revision, evidence age | 승격 중지, manifest/release 복구 |

P1173은 O01/O03/O05/O07 일부 local contract를, P1166은 O02/O04/O05 일부를, P1169는 SEC의 O06 일부를 닫았다. R24-07은 O02/O04에 새로 열린 event 분류 gap이다. 전체 finding 상태는 [25 finding 상태 crosswalk](25-CURRENT-FINDING-STATUS-CROSSWALK.md), 실행 순서와 사용자 인수는 [26 실행·인수 계획](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)을 따른다. 이 설계는 구현·원격 운영·출처 권리 검증 완료를 선언하지 않는다.
