# QA·커밋·배포 효율성 재감사 — 2026-09-26

> 기준은 로컬 dirty v56.50의 `architecture/qa-pipeline.json`, `scripts/qa-runner.mjs`, GitHub Actions YAML 및 이전 로컬 QA 캐시다. 원격 Actions 실행 기록은 이 환경에서 GitHub API 연결이 차단되어 읽지 못했다. 아래 **선택 게이트 수는 `--explain` 실측**, 실행 시간은 서로 다른 날의 로컬 캐시 표본이며, CI 총 소요시간·비용·절감률은 아직 미측정이다. 사용자 소유 변경은 건드리지 않았다. [외부 참고의 독립 테스트 원칙](32-EXTERNAL-REFERENCES-CHART-NEWS-AND-TEST-DESIGN-20260925.md)은 AIO 게이트의 실제 보호 계약을 확인하는 질문으로만 사용한다.

## 판정

현재 구조는 **안전 경계는 비교적 잘 설계됐지만, 효율이 최적임을 입증하지 못했다.** `affected`·성공 캐시·`rerun-failed`·사전 검사→계약→브라우저 단계·정확한 SHA attestation·배포 후 실측·독립 watchdog은 유지할 이유가 있다. 반면 그룹 단위 선택과 광범위한 fingerprint, 동일 검사의 반복, CI 작업별 브라우저 준비, 로컬 병렬 실행의 단일 캐시/리포트 파일은 구체적인 비용 또는 정확성 위험이다. 테스트 숫자나 LOC를 목표로 삭제하지 않고, **실제 고장 반증을 남기는 더 강한 한 경계**로 합친다.

| 근거 | 관찰 | 해석 |
|---|---|---|
| `qa-runner.mjs affected --files version.json --explain` | 10그룹·**103 gate**, 그중 browser **23** | 버전 문자열/서비스워커 변화에도 실제 브라우저 인수는 필요하지만, 로컬 작은 증분마다 전 브라우저를 다시 선택하는 것은 큰 후보 비용이다. 출시 1회의 `full --no-cache`는 계속 필요하다. |
| 같은 명령에 `_context/CURRENT-STATE.md`, `js/aio-glossary.js`, `public-data/data.json` | 각각 **26/71/81 gate**; Glossary는 browser 23, data.json은 browser 9 | `impactRules`가 그룹 단위여서 소유 기능보다 넓게 선택한다. 변경과 위험의 관계를 게이트 단위로 교정할 여지가 있다. |
| `qa-pipeline.json`·`ci.yml` | `full`은 **131 gate/브라우저 23**. 일반 CI는 preflight 1+contracts 5+browser 6 = **12개 시험 job**에서 `npm ci`를 각각 실행하고 6개 browser job에서 `playwright install --with-deps chromium`을 실행한다. | 격리·병렬성의 대가다. 설치 반복이 총 비용인지 병목인지 Actions job 타임라인으로 측정해야 한다. `setup-node`의 npm 다운로드 캐시는 이미 켜져 있으며 `node_modules` 설치 자체는 별개다. |
| `qa-pipeline.json` | `scripts/ci-data-plane-contract-check.mjs`가 `data`와 `cloudflare`의 두 ID에 같은 인자 없이 등록됨 | 일반 CI 계약 matrix에서 동일 스크립트가 같은 SHA에 **2회 실행**된다. 다른 7개 중복 스크립트 매핑은 `watchdog-local`과 `data`처럼 **서로 다른 운용 시점**이며 한 CI 실행의 중복이라고 묶지 않는다. |
| `refresh-data.yml`·`refresh-screener.yml` | data는 artifact integrity·continuity·refresh audit를 앞선 검증과 promotion gate에 재호출. screener는 `validate-screener-artifact`·`ci-screener-workbench-contract`를 두 번 호출. | 최종 생산물/입력이 두 호출 사이에 바뀌지 않는 경우에만 반복이다. 마지막 산출물 조립 이후 **한 번의 fail-closed 후보 검사**로 배치하되, 앞선 검사 중 조기 실패를 주는 것이 실제 시간을 절약하면 유지한다. 변경 전후 실패 주입으로 확인한다. |
| `qa-runner.mjs` | 기본 `success-cache.json`과 `last-run.json`을 모든 로컬 실행이 공유; 각 PASS에서 `writeFileSync`로 캐시 전체를 즉시 다시 씀. `rerun-failed`는 마지막 전역 리포트만 읽음. 이번에도 `affected`의 실패 리포트가 다음 `--group workspace` 성공 리포트로 **덮였다**. | 실패 배치를 명시하지 않으면 후속 `rerun-failed`가 원래 실패를 다시 고를 수 없는 것은 관찰된 문제다. 여러 에이전트/터미널의 캐시 lost update/부분 읽기는 별도 설계 위험이다. 지난 문서 감사의 기본 캐시 쓰기 `EPERM` 두 번은 관찰됐지만 **원인은 미확정**이며 동시성 탓으로 단정하지 않는다. |
| 이번 문서 QA의 실제 `affected --session` | 다른 작업자가 세션 시작 후 수정한 `scripts/ci-architecture-browser-check.mjs`까지 선택돼 `browser-runtime`으로 넓어졌다. preflight `operations-contract`가 실패해 후속 workspace 12개와 browser 1개가 SKIP됐다. `--group workspace --no-cache`는 **12 PASS/0 FAIL**. | 공유 dirty workspace의 세션 기준선은 작업 소유 범위와 같지 않다. 파일을 정확히 지정해도 현 runner는 preflight 전 게이트를 실행한다. 문서만 바꾼 QA가 독립적인 **운영 데이터 revision 불일치**로 막힐 수 있다. release CI에서는 그 실패를 계속 차단해야 한다. |
| `.cache/aio-qa/success-cache.json` 로컬 기록 | 141개 gate의 여러 날짜 성공 실행 시간이 합계 289.1초(직렬 시간의 합). 오래 걸린 표본은 `browser-architecture` 36.5초, `browser-viewport` 29.3초, `qa-runner-behavior` 16.3초. | 이는 **한 번의 full 실행 시간이나 CI 소요시간이 아니다.** 브라우저는 shard 병렬이고 캐시 기록 날짜가 다르다. `qa-runner-behavior`가 값싼 preflight에 항상 들어가는 선택은 critical path 측정 후보. |
| `ensure-live-convergence.mjs` | bot refresh 후 CI attestation을 15초 간격·최대 20분 기다림. 시간이 지나면 `AWAITING_CI_ATTESTATION`을 종료 코드 0으로 보고하며 다음 주기 수렴에 의존. | 20분은 CPU 검사가 아니라 CI 완료 대기다. 단순 삭제하면 봇 배포가 다시 끊길 수 있다. CI duration p95, timeout 빈도, 실제 live 지연을 먼저 측정해 polling/수렴 책임을 조정한다. |

## 반드시 보존할 경계

1. 로컬 `affected --session`은 작업 전 hash 기준선으로 기존 dirty 파일을 제외하고, `rerun-failed`는 실패 gate와 선언 의존성만 고른다. `full --no-cache`는 출시/공유 셸 인증 때 한 번, `external --no-cache`는 배포 상태 주장 때 실행한다. 기계적 PASS는 금융 원문·실사용자 이해도를 대신하지 않는다.
2. CI의 preflight→contracts→browser, 샤드별 `fail-fast:false`, 마지막 정확한 tested SHA attestation은 비용이 있어도 오류 격리·출시 무결성을 보호한다. Pages는 성공 CI의 아티팩트와 SHA를 대조한 뒤 배포한다. 봇의 `GITHUB_TOKEN` push가 다른 workflow를 자동 시작하지 않으므로 명시적 `workflow_dispatch`가 필요하다([GitHub 공식 설명](https://docs.github.com/en/actions/concepts/security/github_token)).
3. refresh bot은 producer 검사를 통과한 산출물만 commit/push하고, Pages는 독립 CI attestation을 기다린다. 로컬 검사로 원격 준비를 대체하거나 빨라지려고 검증 안 된 커밋을 배포하지 않는다. [Playwright 공식 CI 지침](https://playwright.dev/docs/ci)은 shard와 CI worker 1을 권하며, 브라우저 바이너리 캐시는 복원 시간 이점이 불분명하므로 무조건 도입하지 않는다.
4. watchdog은 커밋 없는 사이에도 CDN·Worker·데이터 drift를 볼 수 있어 source CI와 다른 관측 계약이다. scheduled knowledge lint도 시간 기반 문서 노후 검출이라는 별도 목적이므로 source CI와 검사명이 겹친다는 이유만으로 삭제하지 않는다.

## 개선 순서와 인수 조건 (아직 설계, 코드 미수정)

| 우선 | 변경 단위 | 안전한 인수 |
|---|---|---|
| P0 — 로컬 QA 실행 identity | `qa-runner`의 캐시·리포트를 세션/run ID별로 분리하거나 원자적 쓰기+충돌 제어를 도입. `rerun-failed --session/--report`가 정확한 실패 배치를 다시 읽게 한다. 잘못된/손상된 캐시는 PASS가 아닌 재실행으로 처리하고 명시적 원인을 보고한다. | 2개 동시 runner가 서로 다른 PASS/FAIL을 내는 격리 fixture, 중간 프로세스 종료·권한 오류·손상 캐시, 리포트 선택 오용을 실패 주입. 기존 `EPERM` 재현 여부를 별도 측정. |
| P0 — 커밋 후보 identity | 수동 코드 변경은 작업 파일 목록과 staged diff, 로컬 QA가 검사한 파일 hash를 commit 후보에 결속. dirty 파일이 많은 현재 저장소에서는 격리 checkout/브랜치 또는 staging snapshot으로 **실제로 푸시할 tree**를 검증한다. | `qa-runner`가 통과한 working tree와 일부만 staged된 tree가 다르면 출시 준비 PASS 금지. CI는 push 뒤 exact commit을 재검증하고, 배포 SHA와 동등성을 계속 확인. 자동 commit/push/deploy 권한을 추가하지 않음. |
| P1 — 선택 범위 | 버전 bump를 수직 코드 변경의 마지막에 모으고, 순수 version-only 변경에는 SW/부팅/캐시버스터 등 위험 게이트를 유지하면서 불필요한 전체 기능 브라우저 반복을 줄이는 gate 단위 impact를 설계. 문서 전용 `affected`에서도 작업과 무관한 `operations-contract`를 항상 실행하는 preflight 구조를 분리하되 **release CI의 필수 검사에서는 유지**한다. data/Glossary도 route owner와 data cut 기준으로 좁히되 출시 full·변경된 공통 셸은 넓게 유지. | 지금의 `--explain` 103/71/81 기준과 변경 후 selected set을 나란히 저장. 각 제외 gate에 결함 주입/의존 파일 변경 canary가 있어야 하며, version→SW/boot와 데이터→사용자 화면 결함을 놓치면 되돌림. 현재 운영 데이터 불일치를 문서용 selector가 숨겨도 release CI에서는 FAIL이어야 한다. |
| P1 — 진짜 반복 제거 | `ci-data-plane-contract-check`의 data/cloudflare 이중 등록을 한 owner로 옮기고, 다른 경로 변경 시 영향 선택을 보완. refresh 워크플로 중복 검사는 마지막 producer 쓰기 이후 한 번의 후보 검사로 재배치하며 의도적 조기 실패는 남김. | 호출 횟수 감소 전후 동일 입력/산출물 hash, 각 gate의 의도한 결함에서 실패, bot push 차단, 다른 그룹 변경 canary, CI 결과·배포 수렴이 일치. |
| P1 — CI 시작 비용 | 각 CI job에 checkout/setup/npm install/Chromium install/gate 시간과 queue 대기를 분리해 기록. 6개 browser shard의 준비 방식으로 현행 `install --with-deps`와 Playwright 버전 고정 이미지 등 **두 후보만** 동일 SHA·shard에서 비교한다. [GitHub 의존성 캐시 설명](https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching)의 캐시/아티팩트 목적도 구분한다. | 최소 최근 20회와 후보 반복 10회의 p50/p95 wall time·runner minutes·실패율·flake·출시 지연 비교. ≥20% 비용/시간 감소 같은 목표는 사전 등록 후, 새 불안정·약한 검증이 생기면 채택하지 않음. |
| P2 — 수렴 대기 | `await-sha`가 20분을 넘거나 후속 수렴에 맡긴 횟수, bot push→CI attest→Pages publish→live SHA 일치 시간을 기록. 15초 polling은 API 호출량과 지연 tradeoff로 평가. | 늦은 CI 성공·실패·아티팩트 누락·같은 SHA 중복 dispatch·새 main 선점 fixture와 실제 Actions trace. event 전환은 GitHub 토큰 이벤트 제약과 SHA/attestation 조건을 재확인한 뒤에만. |

## 확인되지 않은 것과 다음 측정

- 이 환경에서 `gh run list`는 GitHub API 접속 제한으로 실패했고 공개 Actions 페이지도 확인되지 않았다. 따라서 **현재 CI p50/p95, 월 runner 비용, 중복 호출의 실제 시간, 배포 전체 지연**은 알 수 없다. 위 수치는 로컬 manifest 선택·캐시 표본·워크플로 정적 구조다.
- `qa-runner` 기본 캐시 `EPERM`의 원인, 브라우저 6 job 준비의 실제 critical path, Playwright 이미지의 속도/보안 tradeoff는 아직 실험 전이다. 로그만 보고 특정 gate나 설치 절차를 제거하지 않는다.
- **현재 작업 트리의 release 후보는 green이 아니다.** `ci-operations-contract-check.mjs`가 `market-snapshot` revision 정합성에서 FAIL: snapshot·operations는 `2026-09-26T04:22:44.260Z:cdd25e96`, asset·release manifest는 `2026-09-24T12:42:23.205Z:61b604b1`이다. 이 작업에서 해당 producer/manifest를 수정하지 않았다. 다른 동시 작업의 미완료 상태인지 원인 확인 전 커밋/배포 가능으로 판단하지 않는다.
- Pages의 external 검사는 배포 **이후**에 실행된다. 실사이트 실패가 나도 그 시점에는 게시가 이루어졌을 수 있으므로 `CI green`과 `live healthy`를 다른 상태로 보고, 실패 시 복구/운영 판단 시간을 측정한다. 배포 전 원격 준비 검증과 배포 후 canary·복구 계약을 차기 설계에 연결한다.
