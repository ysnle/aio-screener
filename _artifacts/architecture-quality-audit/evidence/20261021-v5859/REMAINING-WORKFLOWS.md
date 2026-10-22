> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 미검토 workflow 13개 전문 감사

MODE: review | VERDICT: FAIL (한정된 신규 결함 1개) | REF: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc` (v58.59)

FINDINGS: actionable 1, CONSIDER 1. 고정 REF `.github/workflows/*.yml` 13개를 모두 전문으로 읽었다. 읽기 원장은 [remaining-workflows-reading.tsv](./remaining-workflows-reading.tsv)이며 SHA256은 줄바꿈을 변환하지 않은 `git show` blob bytes 기준이다. 현재 checkout의 v58.61 및 다른 작업자의 dirty 변경을 검토 기준에 섞지 않았다. 제품/운영 파일, HANDOFF는 수정하지 않았다.

의도는 가족 약 5명의 무료 도구에서 실제로 새 데이터가 게시되고, 검증하지 않은 SHA를 배포하지 않으며, 실패를 정직하게 드러내는지 확인하는 것이다. 완료 기준은 13개 trigger→권한→실행→publication/alert 경로의 전문 검토와 후보 반례의 분리다. 가장 중요한 위험은 실패/충돌 뒤 성공으로 저장된 상태 때문에 수집을 건너뛰는 것이다.

## WF01 — [ACT ON][P2] 충돌로 게시하지 않은 SEC poll도 게시 완료 marker를 저장한다

위치: `.github/workflows/refresh-data.yml:519` (marker 조건), `:465–478` (collision 재실행 처리), `:161–165` (age 기반 다음 poll 판단), `scripts/daily-lane-age.mjs:11–15` (최신 시각을 선택).

실제 호출 경로는 daily lane due → `masters`의 discovery/13F poll 성공 → commit/push 시 main 충돌 → `collision_retry` → `refresh-data.yml`을 `trigger=scheduler,retry=collision`로 dispatch하고 `changed=false`, `collision=true`, `exit 0` → `commit.outcome == success` → daily marker write/save다. marker 조건은 미게시 충돌을 검사하지 않는다. 동일 producer concurrency group으로 재실행 producer가 대기하는 동안 기존 producer가 marker 저장까지 마칠 수 있으므로, 재실행에서 그 marker를 복원하는 경로가 도달 가능하다.

반례: main에 있는 discovery는 48시간 전이고 이번 런이 새 SEC evidence를 찾았지만, 다른 main 변경과 충돌해 candidate 전체를 버린다. 그런데 marker를 현재 시각으로 저장한다. 실제 고정 `lastPollAgeHours` 함수는 marker 없을 때 48, 미게시 marker를 주면 0을 반환했다. 재실행은 operator가 아닌 scheduler라 age로 판단하고 daily lane을 건너뛴다. 버려진 새 SEC evidence는 다음 강제 daily cron/operator 또는 age 문턱을 넘을 때까지 재수집되지 않을 수 있다. 날짜를 바꿔서 거짓 수치를 화면에 보이는 결함이라고 주장하는 것이 아니라, 의도된 즉시 충돌 복구가 데이터 발견 lane을 건너뛰는 결함이다.

최소 보완: marker write 조건에 `steps.commit.outputs.collision != 'true'`를 추가한다. `changed == true`만 요구하면 정상적인 무변경 poll까지 매번 재수집하므로 부적절하다. 검증은 ① collision+success에서는 marker 미갱신, ② 정상 no-change poll에서는 갱신, ③ 정상 게시에서는 갱신의 세 상태를 대조하면 된다. CI/Pages SHA gate는 게시 파일의 안전을 다룰 뿐, 이 cache marker의 의미를 검사하지 않으므로 이 문제를 보완하지 않는다.

증거 수준: source 조건 추적 + 실제 fixed helper 격리 실행. [실행 결과](./workflow-probe-result.json). 실제 Actions/cache/SEC 호출이나 실배포에서 발생 빈도는 측정하지 않았다.

## WC01 — [CONSIDER] dispatch ref가 이동하면 attested SHA와 run head SHA가 달라지는 일시적 handoff 지연

`refresh-data.yml:509`와 refresh-screener의 core/extended dispatch는 `--ref main`에 별도로 `release_sha=A`를 보낸다. dispatch 직전에 main이 B로 이동하면 CI checkout/attestation은 A인데 run head는 B다. [GitHub 공식 event 문서](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)는 dispatch의 GITHUB_SHA를 선택 ref의 마지막 commit으로 정의한다.

`scripts/ensure-live-convergence.mjs:123–126`은 `head_sha=A`로만 실행을 검색한다. 실제 fixed driver를 mocked API로 실행했을 때 A에 해당 run이 없으면 `AWAITING_CI_ATTESTATION` exit 0으로 끝났다. pages-deploy도 API run head SHA와 expected SHA를 다시 비교하므로 A/B 불일치가 검증되지 않은 배포로 이어지지는 않는다. 또한 이미 main이 B이므로 stale A를 내보내지 않는 것이 맞고, B의 converge cycle이 복구한다. 지속 장애로 입증되지 않아 actionable로 합산하지 않는다. 개선한다면 stale await를 일찍 중단하고 최신 main 수렴으로 넘기는 수준이면 충분하다. 배포 SHA 검증을 느슨하게 하는 제안은 아니다.

## 파일별 전문 검토 결론

| 파일 | 확인한 경로와 판단 |
|---|---|
| ci.yml | PR/read-only 및 push/dispatch 분리, preflight 후 contract/browser shard, reduced scope의 fully-tested source ancestry, immutable attestation. 추가 actionable 없음. |
| pages-deploy.yml | API로 CI 종류/결론/branch/repo/SHA 재검증, 같은 run artifact, public artifact staging, main head 재확인, bounded retry. WC01은 stale release 차단과 대조했다. |
| deploy-ai-proxy.yml | main push CI attestation 및 exact checkout, live drift/recipe guard, 별도 concurrency, 수동 secret sync, smoke 실패 후 rollback/source 확인. 유료 smoke는 기존 shared Worker를 통하고 budget429를 operating-blocked로 취급한다. 실제 배포나 유료 호출은 하지 않았다. |
| deploy-data-plane.yml | exact push CI, source identity, 최신 main의 Worker-input 변경 guard, KV/secret 설정, smoke/rollback과 bootstrap 한정 허용. dispatch secret 누락 시 repair 경로도 읽었다. 추가 actionable 없음. |
| data-watchdog.yml | schedule+workflow completion, aggregate non-fail-fast check, 마지막 단계 실패 결론 보존, issue-expiry 별도 job. QA runner cache와 external report 경로 차이는 실제 `ci-external-pipeline-check.mjs:18`이 `.cache/aio-qa/external-pipeline-status.json`에 쓰므로 경로 오류로 보고하지 않았다. |
| operations-alert.yml | workflow별 lock, latest completed 상태만 reconcile, skipped/cancelled/neutral 제외, cadence-only success가 recovery로 닫지 않음, 반복 실패 dedupe 및 recovery close. 작은 사용 규모에 추가 당직 체계는 요구하지 않는다. |
| refresh-data.yml | producer별 outcome 및 validation gate 모두 요구하는 publish, 충돌 candidate 재검증과 bounded retry, daily lane/cache 및 CI→converge. WF01 발견. news mode는 cadence helper의 명시 계약상 producer 전체 실행이므로 mode 전달 누락으로 보고하지 않았다. |
| refresh-screener.yml | SEC contact 선검사, ledger restore→projection guard→staged candidate 검증, core와 extended 독립 lock/commit/CI/converge. 확장 shard 실패가 core를 되돌리지 않는 경로와 retry를 읽었다. WC01 외 추가 actionable 없음. |
| exchange-calendar-review.yml | main-only, read-only report와 issue-write job 분리, 연도별 marker/title fallback, closed review 존중. 추가 actionable 없음. |
| macro-calendar-review.yml | main-only, 공식 후보→preview→report→artifact, needs_review 조건과 월/digest dedupe. producer는 실행하지 않았다. 추가 actionable 없음. |
| universe-review.yml | main-only, universe mirror check→시간 기준 report→월별 issue, closed review 존중. 추가 actionable 없음. |
| knowledge-build-candidate.yml | PR/event SHA, read-only token 및 credentials 미보존, disposable candidate workspace, 사람 검토 artifact. 이 workflow 파일의 전문 검토이며 호출된 parity checker 내부 전체의 신규 인증은 아니다. |
| knowledge-lint.yml | 주간/수동 deterministic check, contents read 및 credentials 미보존. semantic/human certification과 deterministic lint의 경계를 정직하게 유지한다. setup-node 생략만으로 runner Node가 부적합하다고 추정하지 않았다. |

## 재현과 한계

`node _artifacts/architecture-quality-audit-20261021-v5859/workflow-probe-review.mjs` → PASS. 실제 fixed `daily-lane-age`를 data URL module로 import하고 실제 convergence driver를 모든 fetch가 mock인 자식 Node로 실행했다. 첫 probe 시 shebang을 eval 중간에 넣어 SyntaxError가 발생했고 harness에서 shebang을 제거한 뒤 동일 명령이 통과했다. 제품 결함과 이 감사 harness 오류를 구별한다.

추가 tracing으로 전문을 읽은 helper는 `scripts/ensure-live-convergence.mjs`, `scripts/daily-lane-age.mjs`, `scripts/refresh-cadence.mjs`, `scripts/worker-deploy-impact.mjs`다. external checker와 audit gates는 관련 줄만 검색했으므로 전문 coverage로 승격하지 않는다. TSV는 요청한 workflow 13개만 담는다. 실제 Actions 실행, producer, SEC/API 수집, 배포/롤백, branch protection 원격 설정은 미검증이다. 모듈 내부의 모든 data integrity를 workflow 읽기만으로 인증하지 않는다.

SAFETY FACT: 충돌 후보를 게시하지 않는 gate와 marker의 의미는 별개다. 전자는 source로 추적했고, 후자의 반례는 실제 age helper로 재현했다. INDEPENDENCE: 동일 모델의 독립 업무 분담, limited. commit/push/deploy 없음. 다음 최우선 조치는 WF01의 marker condition과 세 상태 회귀 검사 보완이다.
