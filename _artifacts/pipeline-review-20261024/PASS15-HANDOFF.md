# PASS15 — 잔여 범위 실측·운영 복구 판정

2026-10-29 KST. v59.42(note P2127) 작업 트리. cstack review 모드의 기존 결함 감사 지속. 사용자 지시에 따라 에이전트 없이 직접 검토, 제품 코드 수정 없음. 사용자 소유 다수 dirty 파일을 보존했다. baseline pipeline-review-pass15-20261029.

## 얼마나 남았는가

작업 시작 목록 4,628파일(이전4,529에서99개 추가). 아래는 경로 기반 분류이며 생성물과 중복 사본을 독립 파이프라인 수로 간주하지 않는다. ignored/private 파일은 이 목록 밖이다.

| 분류 | 전체 | 대장상 직접 전체 판독 | reader 보고 | 부분 판독 | 미대조 |
|---|---:|---:|---:|---:|---:|
| src/js/scripts/worker 및 workflow | 940 | 116 | 55 | 5 | 764 |
| public-data | 836 | 0 | 0 | 0 | 836 |
| _artifacts | 2,561 | 0 | 0 | 0 | 2,561 |
| 문서·설정·나머지 루트 파일 | 291 | 1 | 0 | 0 | 290 |

직접 판독으로 대조하지 않은 source 그룹은824파일이다. 미대조는 '한 번도 읽지 않음'과 다르다. 과거 서술형 문서/행 단위 데이터 확인이 파일 대장에 매핑되지 않았을 수 있다. 특히 public-data와 audit 결과의0은 데이터 검사가 전혀 없었다는 뜻이 아니다. 반대로 기존 보고 존재나 파일 scan만으로 직접 의미 검토 완료로 승격하지 않는다. 루트 cloudflare-worker-proxy.js 같은 파일은 위의 '나머지'에 들어가므로 소스940은 모든 실행파일의 완전한 정의가 아니다.

단순 파일 수 대비 약12%의 source 직접 판독 기록은 인시/의미 완료율이 아니다. 전체가 거의 끝났다는 설명은 근거가 없다. 데이터·이미지·원문 자료 검토 깊이, 기존 기록 대조, 코드 변경분 재검토가 남아 있어 시간/몇 회 안에 완료를 약속할 수 없다. 현재 속도의 몇 번 추가 조사로 끝날 규모가 아니다.

src/ai/49파일 전체 판독은 이전 시점 본문에 대한 기록이다. 현재 새 question-cues.js가 있고 market-content.js도 변경됐다. shared-artifacts.js 역시 이전 ledger hash와 달라졌다. 원래19개 drift 중 PASS14에서3개 재판독했고, 이번에 operations-alert/knowledge-lint/deployment-provenance3개를 추가 재판독한다(원래 목록의 잔여13개). 별도의 이번 변경2개는 새 재검토 대상으로 보존한다. 새 파일99개에는 조사 산출물/회사 profile 자료도 포함돼 '새 pipeline99개'라는 뜻은 아니다. `pass15-inventory-drift.json`에 새 경로와 이전/현재 hash를 저장했다.

## P15-OPS-01 — 관측 실패/Worker 무배포 성공을 복구로 승격

수정 권고, 중요도 중간, Pre-existing. 최초 OPS-01의 같은 결함 계열에 남은2경로다. Pages skip 정상 경로는 v58.77에서 수정됐으므로 과거 발견을 그대로 현재 결함으로 반복하지 않는다.

`.github/workflows/operations-alert.yml`의 observedWork는 Pages의 외부 검증 step 성공을 요구한다. 하지만 listJobs API 예외를 catch하면 true를 반환한다. 최신 성공과 직전 성공의 jobs 조회가 모두 실패하면 실제 관측 여부를 확인하지 못했는데 기존 이슈에 Recovered 댓글을 쓰고 닫는다. API 장애는 관측 미확인이지 복구 증거가 아니다.

같은 함수의 workSteps는 Pages만 등록하고 Worker 두 workflow는 기본 true다. PASS14에서 확인했듯 Worker도 최신 main 변경/no-change로 deploy와 smoke를 건너뛰면서 workflow success가 가능하다. 그런 성공2개는 기존 Worker 장애 이슈를 닫는다.

재현은 workflow에 포함된 JavaScript 본문을 그대로 추출해 stub GitHub API로 실행했다. 실제 외부 요청/Issue 쓰기 없음.

| 주입 상태 | 기존 open issue 종료 |
|---|---|
| Pages success2회, 검증 step skipped | false (기존 수정 정상 대조군) |
| Pages success2회, jobs 조회503 예외 | true (남은 관측 실패 경로) |
| AI Worker success2회, work skipped | true (Worker 미등록 경로) |

보강안: observedWork를 observed/unobserved/unknown의3상태로 만들고 unknown은 복구 판정과 실패 streak 절단에 사용하지 않는다. Worker는 해당 smoke step 성공 또는 별도의 deployment observation artifact를 요구한다. skip을 새로운 실패로 만들 필요는 없다. 실제 미변경 상태면 기존 alert를 보존하고 후속 관측이 회복을 결정해야 한다. 회귀: 정상2회, fail/pass/fail, skip 사이 실패, API unavailable, 페이지네이션 오류, Worker no-change/stale-main, 실제 smoke 성공을 포함한다.

## P15-SLO-01 — 제외한 수동 성공이 복구 통계에는 포함됨

수정 권고, 중요도 중간, Pre-existing. build-operations-slo-window.mjs의 buildLane은 operator workflow_dispatch를 manualRunsExcluded로 제외한다. 그러나 failureRecovery의 orderedWatchdog는 observed.watchdog 전체를 정렬한다. successRate/failureCount와 recoveryCount/consecutiveFailuresMax의 모집단이 서로 다르다.

재현: schedule failure → operator dispatch success → schedule failure. lane successRate=0, manualRunsExcluded=1, failureCount=2인데 recoveryCount=1, consecutiveFailuresMax=1이다. 같은 자동 운영 경로의 연속 실패2회가 수동 성공으로 끊어진다. 창 자체 PASS를 만들어내는 결함이라고 주장하지 않는다. 자동 lane의 신뢰성과 복구 설명이 서로 충돌하는 문제다. 검색한 src 소비자에는 해당 세부 필드 직접 사용을 확인하지 못했으며 현재 영향 근거는 생성되는 운영 artifact 계약이다.

개편안: success/failure/recovery가 같은 eligible run 집합을 사용하거나 수동 포함 전체 복구를 별도 지표/이름으로 명시한다. clock·완료상태·trigger·scheduler dispatch 기준도 같은 정규화 함수로 묶는다. 회귀: 실패/수동성공/실패, 실패/자동 scheduler성공/실패, 취소, 중복ID, 범위밖/미래 run을 비교한다.

## 직접 전체 판독6개와 정상 확인

| 파일 | 검토 계약 |
|---|---|
| .github/workflows/operations-alert.yml | 최신 완료 run·2회실패/2회복구·skip·issue marker·서명 중복 알림 |
| .github/workflows/knowledge-lint.yml | 주간 deterministic lint·수동 실행·읽기 권한·의미 인증 제외 |
| scripts/deployment-provenance.mjs | run ID/SHA/repository/event·완료 성공·현재 실행 예외·exact lookup fallback |
| scripts/build-operations-slo-window.mjs | API 창·페이지 상한·cadence history·trigger 분류·도메인별 분모·회복 |
| scripts/lib/operations-alert-policy.mjs | 엄격 timestamp·거래소 완료 세션·명시 outage·UTC 일일 사용량 |
| scripts/operations-alert/collect-observations.mjs | deployed artifact 우선순위·site 상태·비공개 usage·safe summary |

collector/policy의 중간 잘린 출력은 다시 읽었다. ci-operations-alert-policy-check는 부분 판독으로 남긴다. ci-operations-alert-source-check는 출력 본문을 확인했지만 이번 대장의 완전 판독 수에 추가하지 않았다. build-operations-status와 외부 배포 검증 전체는 추가 검토가 필요하다.

정상 계약: provenance는 completed의 timeout/failure를 허용하지 않고 allowInProgress 때만 queued/in_progress를 허용한다. collector는 토큰이 없으면 비공개 usage endpoint를 호출하지 않고 private header 요청은 redirect:error를 사용하며 결과는 status/reason만 반환한다. site outage 시작을 deploy 시각으로 꾸며내지 않는다. artifact 운영 지연은 완료 거래소 세션으로 계산하고 등록 안 된 연도는 UNKNOWN이다. SLO는 실행 신뢰도임을 measures에 명시하고 source pagination 불완전 또는 필수 도메인 미관측을 PASS로 만들지 않는다.

후속 후보: cadence history의 일부 구간 누락/100개 commit 상한은 분모 완전성과 연결되므로 추가 fixture가 필요하다. site/collector fetch에는 자체 timeout이 없어 호출자 timeout 계약을 확인해야 한다. producer generatedAt의 갱신이 실제 데이터 관측을 의미하는지는 기존 freshness 경로와 교차 검토한다. 이 후보들을 새 확정 결함으로 계수하지 않는다.

## 실행 증거

reproduce-pass15.mjs: 로컬 workflow mock과 순수 SLO 함수 assertion 통과, pass15-reproductions.json 기록. 이어 붙인 rg 명령이 Windows wildcard 경로로 실패해 첫 묶음 shell exit는1이었으나 fixture 자체는 완료했다. 검색은 directory+glob 방식으로 바로 재실행했다. 제품 코드 수정·로컬 producer 실행·원격 Issue 쓰기·commit/push/deploy 없음. 전체 감사 미완료.

QA: audit 소유8경로 affected run `2026-10-29T01-20-29-624Z-23016-xc7pf4`: pass9/cached1/fail2. generated-state는 이미 dirty인 CURRENT-STATE.md/CONTEXT-CATALOG.json 불일치를 보고했다. qa-runner-behavior는 임시 cache/last-run.json ENOENT로 실패했다. 해당 check의1–78줄을 부분 추적하면 자식 runner의 exit1만 확인한 뒤 report를 즉시 읽으므로 '기대된 gate 실패'와 'report 생성 전 runner 실패'를 구별하지 못한다. 자식 stderr가 이 경로에 출력되지 않아 원인을 sandbox나 코드 결함으로 확정하지 않는다. 감사 fixture 구문 및 audit diff --check는 통과했다. 사용자 요청이 개선 금지이므로 workspace generator나 QA 코드를 수정하지 않았다.

종료 대장4632파일은 이번 감사 자료4개가 추가된 결과다. 시작 분모940 source 그룹에서 직접 전체 판독은122, 나머지818이며 본문 판독과 의미/실행 인증은 계속 구분한다. 원래 drift 잔여13개와 이번 새 변경2개는 미검증 상태로 남긴다.
