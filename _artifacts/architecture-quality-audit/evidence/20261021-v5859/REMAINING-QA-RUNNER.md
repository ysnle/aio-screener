> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# QA runner 전문 의미 검토

MODE: review | VERDICT: FAIL | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc (v58.59)

FINDINGS: 2 actionable(P2). 제품·runner·manifest는 수정하지 않았다. 고정 원본을 읽고 가상 FS/가상 child completion을 주입한 VM에서 전체 runner의 선택·캐시·보고 제어 흐름을 검증했다. cstack review 적용. INDEPENDENCE: 동일 모델의 분담 검토이므로 limited.

## 전문 읽기 범위

- `scripts/qa-runner.mjs`: 실행 내용 1–945 전체(끝 LF를 split하면 946행). 1–260,261–530,531–760,761–945의 연속 범위를 모두 읽었다.
- `scripts/ci-qa-runner-behavior-check.mjs`: 실행 내용 1–401 전체(끝 LF 포함 집계402행). 1–210,211–401 전체를 읽었다.
- 기준선 소유권, explicit files 우선, candidate 전체 인덱스 결속, cache/no-cache, phase SKIP, exact retry, 실패 sidecar redaction, 병렬 pool, atomic write, temp 환경을 검토했다. 기존 A06 cache dependency fingerprint 누락은 중복 발견으로 넣지 않았다.

## QR01 [ACT ON][P2] 실패한 gate를 재실행하지 않고 과거 성공 캐시로 해소

위치: `scripts/qa-runner.mjs:647–652`, `767–801`, `934–937`.

호출 경로: cache 가능 gate의 동일 fingerprint 성공 → 후속 `--no-cache` 실행 실패 → 성공 cache entry는 FAIL branch에서 지워지지 않음 → 사용자가 안내받은 기본 `rerun-failed` 실행 → 647에서 예전 성공을 CACHED로 반환 → 934가 CACHED를 실패 해소로 인정 → failed-batch 삭제. retry profile 자체는 noCache를 강제하지 않는다(85,349–379).

measured: 고정 runner 전문을 VM에서 세 번 평가했다. 파일과 manifest는 동일하고 가상 child 완료 코드만 0→1로 바꿨다. 첫 run PASS1, 두 번째 `--no-cache` run FAIL1이었다. 세 번째 기본 rerun-failed는 child spawn **0회**, CACHED1, exit0, failed-batch 없음으로 끝났다. 원시 결과의 cacheRetry.pass/fail/retry가 각각의 보고서·로그·캐시 상태를 보존한다.

영향: no-cache 재검사에서 드러난 환경/일시 상태 실패나 동일 입력의 비결정적 실패를 실제 재시도 없이 해결됐다고 표시할 수 있다. 코드·입력 바이트 변경을 전제로 하지 않으므로 A06 의존성 누락과 다른 문제다. `full --no-cache`와 candidate의 별도 인증 조건은 유지되므로 이 반례로 배포 인증 우회가 입증된 것은 아니다.

대안: FAIL 시 해당 성공 entry를 무효화하고, rerun-failed의 실패 대상은 실제 실행을 요구한다. '실제로 실행해 통과해야 삭제'라는 917–918의 계약을 유지하려면 failed batch 해소에는 해당 실패 이후의 PASS 증거를 요구한다. fixture의 gate.env나 args를 fail→pass로 바꾸면 fingerprint도 바뀌어 이 결함을 놓칠 수 있으므로, 같은 identity의 실행 결과만 달라지는 대조군이 필요하다.

## QR02 [ACT ON][P2] 과거 실패 ID가 없어지면 빈 retry가 성공 종료

위치: `scripts/qa-runner.mjs:363–374`, `395–405`, `865–895`, `945`.

호출 경로: 이전 실패 report에 FAIL id=a 존재 → manifest에서 gate a가 제거/변경되고 같은 group은 유지 → requestedGateIds에는 a가 있어 빈 실패 배치 거절(375–378)을 통과 → visit(a)는 gate가 없으면 조용히 return(399) → selectedGates가 0개 → results=[]/counts={} 보고서 생성 → counts.FAIL이 없으므로 exit0. 선택 후 요청된 실패 ID가 모두 실제 gate로 해석되었는지 검증하지 않는다.

measured: 별도 실패 run을 만든 뒤 가상 manifest의 gate a를 replacement로 바꾸고 기본 rerun-failed를 실행했다. 결과는 gate0, counts{}, exit0이었다. 이전 failed-batch는 그대로 남았고 로그에도 '이 런이 모든 gate를 덮지 않아 보존'이 찍혔다. 따라서 실패 기록을 삭제했다는 주장은 하지 않는다. 다만 자동화나 요약이 retry exit0만 소비하면 실제 재검사가 전혀 없는 상태를 성공으로 읽는다.

대안: 요청한 실패 ID 중 현재 manifest에 없는 ID를 명시적으로 보고하고 exit2로 종료한다. rename/retirement라면 원래 실패 항목과 새 gate의 대응을 운영자가 검토할 수 있도록 남긴다. 임의로 replacement를 대신 실행하거나 원래 실패를 성공으로 바꾸지 않는다.

## 유지할 설계와 미확정 경계

- explicit --files가 session/dirty 전체보다 우선하며, session digest 차이는 사용자 기존 dirty가 추가 변경되지 않았을 때 제외한다. baseline은 작업자 소유를 자동 식별하지 않으므로 다른 작업자가 baseline 이후 수정한 파일은 함께 잡힐 수 있다. 현재 문서가 동시 작업에 explicit file 소유권을 권하는 이유와 맞는다.
- full --no-cache만 verified-tree를 기록하고 candidate는 full ID 집합/manifest/runner/실제 인덱스 파일을 함께 검사한다. 부분·retry 성공을 full 인증으로 승격하지 않는다.
- 실패 phase 뒤 SKIP을 별도 집계하고, keep-going은 로컬에서만 적용한다. rerun-failed가 SKIP을 재검사하지 않는 사실은 현재 '정확한 실패만 재검사' 계약과 맞으므로 별도 버그로 주장하지 않는다. 출시 전 full 실행이 필요하다.
- atomic tmp+rename의 EPERM/EACCES/EBUSY 재시도, gate별 runId output 격리, 원본 출력 spool 삭제·redaction은 실제 코드에서 확인했다. 원자적 한 파일 교체와 서로 다른 동시 실행의 논리적 transaction 보장은 다르다. 현재 동시성 fixture는 실패 하나+성공 하나만 검증하며 서로 다른 실패 둘의 합집합 보존은 검증하지 않는다(추가 후보, 이번 확정 발견 아님).
- behavior-check는 외부 OS tmpdir에 fixture를 만든다(9). runner child의 status만 확인한 뒤 last-run.json을 직접 읽는 곳(55–57 등)이 있어 자식이 보고서 쓰기 전에 중단된 경우 ENOENT가 2차 진단이 될 수 있다. 기존 VALIDATION.md의 최초13PASS/1FAIL, workspace TMP/TEMP 변경 후 재검사 PASS는 읽었다. 이번에는 이 실패를 재실행하지 않았으며 저수준 권한/잠금/경로 원인으로 단정하지 않는다.
- 이 behavior gate는 candidate 검증용 **별도 임시 git repo에 commit**하는 부분(313–320)을 포함하므로, 이번 읽기 전용 분담에서는 gate 자체를 실행하지 않았다. 넓은 QA·producer도 실행하지 않았다.

## 실행 증거

`node _artifacts/architecture-quality-audit-20261021-v5859/qa-runner-probe-repro.mjs` → exit0. 고정 blob을 git show로 읽어 shebang/import 문만 가상 환경에 맞게 제거하고 전체 본문을 VM의 async wrapper에서 평가했다. FS는 메모리 Map, 자식 프로세스는 EventEmitter/stream stub이다. source fingerprint/hash 및 경로 선택은 실제 runner 코드다. 실제 gate·Git 변경·외부 네트워크·producer·브라우저 실행은 없다. audit 전용 probe와 결과 파일만 썼다.

SAFETY FACT: 두 제어 흐름 반례는 고정 원본 전체의 격리 실행으로 PROVED(ladder4). 실제 Windows 자식 프로세스/OS 잠금·권한 재현과 전체 CI는 UNVERIFIED다. commit/push/deploy하지 않았다.
