# 원장 승격·보존 도구 독립 검토

MODE: review | 최초 VERDICT: FAIL(검증기 계약 보완 필요) | independence: limited(동일 모델, 별도 문맥)

검토 대상은 `_artifacts/architecture-quality-audit/tools/continue-review.mjs`와 `tools/verify.mjs` 전문이다. 보조로 `tools/repair-relative-imports.mjs` 전문, original/migration/verification manifest 일부를 읽었다. 제품·생산자·브라우저·네트워크·통합 검증기는 실행하지 않았다. 기존 root 원장/증거를 변경하지 않았으며 이번 추가 작업 소유 파일은 이 문서 하나다.

최초 읽기 바이트 SHA256:

- continue-review.mjs: `6a9bcead4f7202f019ce08f637a2424e2ebf0a8cc21ce9ca4e3fcfa9feeded7a`
- verify.mjs: `bb868f1b4a5ea4db6c4f9b1fbe5ab6526ee80f26eee315cdb9c03c4b55df5227`

## LR01 — [ACT ON][medium] verify가 FULL 영수증의 읽기 범위·고정 REF를 독립 검증하지 않음

최초 위치 `verify.mjs:45-62`. `continue-review.mjs:25-29`는 고정 REF, git blob SHA, `1-N` 전체 범위를 확인한다. 그러나 verify의 canonical 승격 검사는 TSV entry의 status/ref/sha만 대조하고 `entry.read_ranges`, `receipt.range`, 고정 REF 상수, 실제 git blob을 독립 대조하지 않는다. continuation.fixedRef와 entry.ref를 같이 잘못 바꾸면 둘의 일치만으로 해당 조건이 통과한다.

실행한 최소 반례는 실제 verify source의 `check(canonical.every(...))` 표현식을 그대로 발췌해 Node VM에서 평가했다. 실제 고정 baseline 850행 중 `cloudflare-worker-proxy.js`(이전 PARTIAL_PRIOR_READ) 1행만 FULL_CURRENT_REVIEW로 만들고, 동일 SHA/이유/영수증 경로를 가진 가상 TSV와 continuation을 주입했다. **entry.read_ranges=`2-2`, receipt.range=`2-2`, continuation.fixedRef=entry.ref=`wrong-ref`인데 해당 predicate=true**였다. fs.readFileSync만 메모리 TSV 반환으로 대체했고 파일 쓰기 0회였다. 전체 verify PASS를 재현했다는 주장은 아니다. 이 결과는 승격의 핵심 predicate가 거짓 범위를 거부하지 않는다는 증거다.

최소 대안은 verify가 고정 REF를 자체 고정하고 실제 blob SHA/행 수와 TSV/continuation 양쪽 범위를 독립 대조하는 것이다. 사용된 receipt의 경로 집합과 원장 additions의 일대일 관계, coverage/counts도 재계산 대조한다. 주 담당자가 이 보완을 진행한다고 통지했다. 수정 후 재검토는 아래에 기록한다.

## LR02 — [ACT ON][medium] 반복 실행 검증이 marker 누락 시 실제 증거 수정 도구를 실행함

최초 위치 `verify.mjs:66-69`, `repair-relative-imports.mjs:8,31-42`.

verify는 실제 audit 폴더에 대해 repair 스크립트를 child process로 실행하여 “already applied” 거부를 확인한다. repair의 무수정 보장은 `relative-import-repairs.json`이 **존재할 때만** 성립한다. marker가 누락되면 repair는 파생 evidence의 .mjs를 실제 쓰고 migration.json의 hash/bytes/transformation을 갱신한 뒤 marker를 새로 만든다. verify가 나중에 `guard.status !== 0`/바이트 비교 실패를 기록해도 이미 쓰기는 일어났다. 따라서 “검증이 실패했다”가 원본 파생 증거의 무변경을 보장하지 않는다.

이는 파일 누락 조건과 두 스크립트의 실제 호출/쓰기 문장에 따른 정적 경로 증명이며 실제 evidence에 이 반례를 실행하지 않았다. marker가 정상 존재하는 현행 상태에서는 repair가 쓰기 전에 거부하므로 지금 증거가 손상됐다고 주장하지 않는다. 원본 zip은 이 경로가 수정하지 않는다.

최소 대안: marker가 없으면 child를 실행하지 않고 즉시 실패시키거나, 임시 복사본에서 거부 동작을 시험한다. 도구가 documentation-review.json/verification.json 같은 **의도한 파생 보고서를 재생성하는 것**과 evidence를 변형하는 것은 별개다. 보고서 재생성 자체를 버그로 세지 않는다.

## LR03 — [CONSIDER][low] 원본 manifest와 migration manifest의 일대일 결속을 확인하지 않음

최초 위치 `verify.mjs:14-26`. zip 전체 SHA, original/migration의 482행 수, relocatedPath 고유성, 현재 relocatedSha256 및 raw evidence 동일성은 검사한다. 하지만 migration row의 `originalPath`, `archiveEntry`, `sha256`, 원본 bytes가 original.entries의 같은 원본을 가리키는지 대조하지 않는다. zip 내부 entry의 hash와 original.entries의 hash도 이 스크립트에서는 재확인하지 않는다.

구체 반례: raw 이외 .md/.mjs migration row의 `originalPath`/`archiveEntry`만 다른 원본 이름으로 바꾸어도 relocatedPath·sha·본문을 건드리지 않으므로 현재 검사 조건은 이 변경을 읽지 않는다. 따라서 verifier PASS는 “482개 원본↔482개 이전 결과의 올바른 일대일 매핑” 전체를 독립 증명하지 못한다. 이 반례는 소스 조건식의 정적 대조이며 manifest를 실제 변조하지 않았다. 현행 archive가 복구 불가능하거나 실제 매핑이 틀렸다는 주장이 아니다.

최소 대안: originalPath(또는 archiveEntry) 기준 유일성과 집합 일치, original.entries와 migration.entries의 원본 hash/크기/entry 명칭 일치를 비교한다. 별도 archive 검증을 이미 수행했다면 그 정확한 결과와 범위를 연결한다.

## 유지되는 계약과 문구 한계

- continue-review는 고정 historical ledger에서 시작하며 지정 4개 TSV의 FULL/FULL_DIRECT만 수락한다. 기존 850경로와 SHA, 실제 fixed blob, 연속 선언 범위, 중복 receipt를 검사하고 현행 workingTreeDrift를 별도 둔다. 부분 caller/VM fixture를 자동 FULL로 승격하는 코드가 아니다.
- 범위·SHA 검사는 **영수증의 기계적 일관성**이며 인간/에이전트가 실제 모든 줄을 읽었다는 인지적 사실을 증명하지 못한다. 문구 `Receipts assert actual whole-source reading`의 assert는 담당자 보고라는 의미로 제한해야 한다. 현재 report boundary도 reported-document-review라고 한정한다.
- original archive 전체 digest, raw evidence 현재 바이트 대조, historical immutable 필드 대조는 유효한 보존 증거다. canonical FULL은 고정 source에 관한 것으로 live/current 전체를 인증하지 않는다.
- 최초 verify `repeatRepairGuard.evidenceBytesUnchanged:true`는 비교 결과를 값에 반영하지 않는 상수다. 실제 비교 실패 시 failures에는 남지만 그 하위 boolean만 소비하면 잘못 읽을 수 있다. 해당 boolean을 실제 결과로 산출하는 편이 정확하다.
- `relative-import-check.json`의 introducedMissing=0은 저장된 결과를 읽은 것이다. 이 verify가 현재 모든 import를 재분석했다고 해석하면 과장이다.

수정 전 원장 전체 재생성·검증 실행 없이 소스와 한 predicate 메모리 반례까지만 확인했다. 주 담당자의 수정 diff 재검토 대기.

## 수정 후 독립 재검토 — 2026-10-22

후속 VERDICT: **PASS_WITH_BOUNDARY — LR01–03의 지적 계약 보완 확인**. 최초 반례·최초 SHA는 위에 그대로 보존한다. 재검토한 verify.mjs SHA256은 `a533620bd8e03846b4f32411e8e3ca2b05aadb9c2036527fb178b1405d214e75`다. 수정된 파일 전문을 읽었으며 전체 검증기 실행과 보고서 재생성은 주 담당자가 소유한다.

- **LR01 보완 확인:** continuation.fixedRef를 고정 커밋과 비교하고, 허용된 4개 reading TSV 경로만 수락한다. 실제 `git show` blob SHA 및 `1-N`을 원본 inventory, TSV `read_ranges`, continuation `range` 양쪽과 대조한다. 비승격행 evidence도 historical relocation과 같아야 한다. canonical에서 coverage counts, continuation totals를 재계산 비교한다. 수정된 실제 `canonical.every` predicate를 같은 메모리 VM으로 실행한 결과 **`2-2` 거부=true, 정상 `1-1625` 수락=true**였다. git blob은 실제 고정 커밋에서 읽고 TSV만 메모리에 주입했으며 쓰기 0회다. 잘못된 REF는 별도 pinned-ref 조건이 실패하도록 바뀌었다(소스 확인).
- **LR02 보완 확인:** marker가 없으면 check 실패를 기록하고 child process를 건너뛴다. marker 존재 시에만 기존 repair 거부 경로를 실행한다. 보고서에 `attempted`와 실제 byte 비교 결과를 넣어 `evidenceBytesUnchanged:true` 상수도 제거했다. marker 누락 반례의 evidence 쓰기 경로는 이 분기에서 제거됐다. 실제 marker 삭제/repair 실행은 하지 않았다.
- **LR03 보완 확인:** original/migration의 originalPath 유일성, archive digest identity, originalPath/relocatedPath/archiveEntry/bytes/sha256을 기준 원본 row와 일대일 비교한다. 지적한 migration identity만 잘못 바꾸는 경우는 이제 조건식이 거부한다. zip 내부 모든 member를 직접 펼쳐 hash하는 검증까지 새로 생겼다는 주장은 하지 않는다.

최종 boundary는 verifier가 documentation-review.json/verification.json을 재생성한다고 정확히 밝힌다. 저장된 import 결과의 현재성 문제는 주 담당자가 import report를 재생성하고 input hash를 연결할 예정이라고 통지했으며, 이 재검토 SHA에서는 그 후속 실행을 확인하지 않았다. 인지적 전문 읽기는 여전히 담당자의 보고이고 기계 검사가 실제 독해 자체를 인증하지 않는 한계는 유지된다. 동일 source를 전체 서비스/live 안전성으로 승격하지 않는다.
