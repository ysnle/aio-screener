> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Workspace 도구 6개 전문 검토

MODE: review | VERDICT: FAIL (version contract 결함 1개) | REF: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc` (v58.59)

고정 blob의 요청 파일 6개를 모두 전문으로 읽었다. [읽기 원장](./remaining-workspace-tools-reading.tsv)은 요청 6개와 이전 workflow 추적에서 실제 전문을 읽은 helper 4개, 총 10개에 대해 byte 그대로 계산한 SHA256과 FULL 근거를 담는다. helper는 ensure-live-convergence, daily-lane-age, refresh-cadence, worker-deploy-impact이며 workflow 보고서의 추적 근거와 같다. 현재 dirty checkout의 도구를 실행하거나 덮어쓰지 않았다. 실제 bump/record-fix/generation/producer/commit/push/deploy 없음.

의도는 문서가 요구하는 bump→record→generation 경로가 유효한 버전/기록을 만들고 실패에서 회복하는지 확인하는 것이다. 완료 기준은 6개 CLI validation, 쓰는 파일 범위, 실패 처리와 테스트 oracle의 전문 대조다. 가장 중요한 위험은 서로 다른 버전 문법으로 필수 기록 단계가 끊기는 것이다.

## WTO01 — [ACT ON][P2] major-only 버전은 범프와 CI가 허용하지만 record-fix가 거부한다

위치: `scripts/record-fix.mjs:134` (`validateEntry`의 dotted-version-only regex), `scripts/bump-version.mjs:66–80` (version parse/canonicalization), 대조 `scripts/ci-version-check.mjs:28–29` (major-only canonical 허용).

실제 경로: R3 및 AGENTS의 기록 계약은 `bump-version` 후 `record-fix`다. bump CLI는 `v59`와 `v59.00` 모두 canonical `v59`로 만든다. CI version gate도 `v59`를 허용하고 오류 문구가 `use v54 or v54.01`이라고 명시한다. 그러나 `record-fix`의 `validateEntry`는 `^v\d+\.\d+$`를 요구하므로 entry.version=`v59`를 읽기/쓰기 전에 거부한다. entry에 `v59.00`을 쓰는 우회도 뒤의 CHANGELOG/version.json 일치 검사에서 canonical `v59`와 달라진다. 이는 아직 현재 v58.59 작업이 실패했다는 뜻이 아니라 지원하는 다음 major-only 릴리스에서 정해진 기록 경로가 깨진다는 뜻이다.

실제 fixed parser/validator를 VM으로 실행했다. `v59`→`v59`→`version must look like "v56.80"`, `v59.00`→`v59`→같은 오류, 양성 대조 `v59.01`→validation 오류 없음. [결과](./workspace-tool-probe-result.json). 제품 CLI를 호출하지 않았고 버전 표면을 쓰지 않았다.

최소 보완: record entry도 동일 canonical version 문법을 허용하고, 후속 JSON/CHANGELOG의 정확한 버전 일치 검사를 유지한다. 단순히 `v59.00`을 별도 정본으로 받아들이면 두 표면의 버전이 갈라진다. `ci-record-fix-check`에 major-only fixture를 추가하면 기존 v99.1 전용 fixture의 빈틈을 닫을 수 있다.

## 파일별 검토

| 파일 | 전문 검토한 의미와 결론 |
|---|---|
| generate-workspace-state.mjs (45줄) | build/render 후 `--stdout`/`--check`/`--write`로 분기. --check는 두 산출물을 비교하고 stale이면 실패, write는 두 파일을 순서대로 쓴다. helper `workspace-state-lib` 내부 전체는 이번 범위 밖이다. 두 파일을 transaction으로 취급하지는 않지만 중간 I/O 실패 뒤 동일 --write 재실행으로 수렴하며 --check가 불일치를 드러내므로 새 actionable로 세지 않았다. |
| sync-agent-profiles.mjs (45줄) | registry→Claude markdown/Codex TOML, requiredReads/boundaries/checks 생성, TOML literal delimiter 치환, check의 missing/stale 실패. 실제 registry 프로필에서 벗어난 이름/path traversal은 도달 근거 없이 보안 finding으로 만들지 않았다. 각 target의 순차 쓰기와 extra stale profile 미검사는 확인했으나 새 defect로 단정하지 않았다. |
| sync-agent-skills.mjs (73줄) | canonical 디렉터리 확인→전체 복사→양쪽 상대경로/bytes 대조. source 추가/수정은 수렴하지만 삭제/rename 뒤 mirror-only 파일은 복사 실행 후에도 남아 실패하는 WC-T01을 아래 CONSIDER로 남긴다. |
| bump-version.mjs (447줄) | 입력 정규화/숫자 단조 증가, --resume-from, --align-generated의 originals 복구, 표면 regex preflight, 각 대상 쓰기, revision-bound route-soak 증거 무효화, CHANGELOG 및 generation. major-only canonical이 WTO01의 한쪽이다. 모든 일반 bump 쓰기를 transaction으로 묶지는 않으며 errors를 모은 뒤 nonzero로 종료한다. |
| record-fix.mjs (478줄) | validation→메모리 compute→P/R 배정/duplicate/gap 보호→QA update와 verify_by→CHANGELOG/version 일치→tmp write/rename와 rollback→별도 regeneration. change-only는 P ledger를 안 읽고 r를 금지한다. --root fixture는 진짜 repo generation을 안 한다. WTO01 발견. concurrent writer/OS crash까지 보장하는 transaction은 아니지만 현재 단일 root recorder 계약을 벗어난 동시 실행을 가정해 finding으로 만들지 않았다. |
| ci-record-fix-check.mjs (333줄) | 실제 ledger의 임시 사본, fixture CLI root, 본문 regex 및 실제 ledger gate, reject에서 unchanged, dry-run, explicit QA update, change-only, CRLF/BOM, 마지막 real hash 불변 비교. 의미 있는 양성/음성 대조가 있다. fixture version은 v99.1로 고정되어 WTO01 major-only 경계를 놓친다. rename/write fault injection이나 regen 실패 fixture는 없어 이 gate가 rollback 모든 실패를 실행으로 검증한다고 말할 수 없다. |

## CONSIDER와 보장 한계

**WC-T01 — skill 삭제/rename의 정리 경로.** `sync-agent-skills.mjs:38–44`는 canonical 파일만 복사하고 `:62–63`은 mirror-only 파일을 실패시킨다. 따라서 canonical skill 파일이 삭제되면 일반 sync 재실행만으로 check를 복구하지 못한다. 현재 고정 tree에 실제 stale mirror가 있다는 주장은 아니다. 운영자가 제거할 generated 경로를 명시적으로 알리는 안전한 prune 경로 또는 복구 안내를 검토할 만하다. 임의로 사용자 mirror-only 파일을 지우는 개선은 제안하지 않는다.

**부분 범프와 복구.** bump의 주석은 모든 replacement를 preflight한다고 설명하지만 cachebuster의 존재 검사는 실제 index patch 단계에 있으며, metadata의 JSON parse나 CHANGELOG 읽기 실패도 앞선 표면이 기록된 뒤 일어날 수 있다. 이 경우 다른 대상도 계속 시도하고 마지막에 실패한다. `--resume-from`과 version gates가 있으므로 이를 숨은 정상 성공/배포 오류로 주장하지 않았다. 더 강한 원자성을 원한다면 모든 내용을 메모리에 계산한 뒤 쓰는 방식이 더 명확하지만, 지금 사용자 규모에서 전면 transaction 계층을 추가하자는 요구는 아니다. 실제 fault injection은 실행하지 않았다.

record-fix의 rename rollback은 best-effort이며 rollback 쓰기의 예외를 무시한다. 복구 디스크 쓰기까지 실패하면 `rolled back`/CLI `no files changed` 메시지를 절대 보장할 수 없다. 이를 실사용 데이터 손상으로 승격하지 않았다. regeneration 실패는 ledger 쓰기 성공을 명시하고 수동 재생성 명령과 nonzero를 반환하므로 그 단계의 실패 표현은 정직하다.

## 확인과 범위

`node _artifacts/architecture-quality-audit-20261021-v5859/workspace-tool-probe-review.mjs` → PASS. 고정 parser 및 validator만 실제 VM에서 실행했다. `node --check`는 이 감사 probe의 구문만 검사했다. `ci-record-fix-check` 자체, bump/record CLI 및 generation은 실행하지 않았다. 관련 R3와 ci-version gate 문법만 필요한 구간을 추가 읽었으므로 이 의존 파일들을 FULL 원장에 넣지 않았다.

INDEPENDENCE: 동일 모델의 추가 독립 범위 검토, limited. 증거는 정적 전문+일부 실제 순수 함수 실행이며 전체 제품 QA/배포 인증이 아니다. 다음 조치는 WTO01 문법 일치와 major-only fixture 보완이다.
