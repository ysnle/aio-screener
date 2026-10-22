# 통합 검증 기록

**최신 후속 검증:** 10/22 밤에는 제품 잔여 검토를 추가했다. 현재 원장은 **429 FULL /13 mirror /408부분·미검토**다. 아래405/13/432 및29 PASS는 오전 자료 통합 마감의 역사적 기록이며, 밤의 후속 검증은 [후속 마감](./reviews/remaining-20261022/CLOSEOUT.md)과 [선택 QA](./reviews/remaining-20261022/qa-closeout.json)를 따른다. 현재 verification.json은 후속 원장/보존 검사를 포함해 다시 생성했다.

대상은 Architecture 감사 자료의 통합·정정과 `_context/INDEX.md`의 최신 진입점 연결이다. 제품 코드·버전·시장 데이터 수정이나 commit/push/deploy는 하지 않았다. 기존 dirty 변경은 이 작업 소유가 아니다.

실행 기준선: `audit-consolidation-20261022` (2026-10-22). 정확한 실행 결과와 명령은 verification.json 및 qa-closeout.json/log에 기록한다. 과거 snapshot의 VALIDATION과 이번 실행을 합산하지 않는다.

- `tools/merge-evidence.ps1`: 원본482개/15,200,806 bytes의 ZIP entry별 SHA 검증 후 이동. 원래5개 상위 폴더를 하나의 evidence 트리로 모았으며 파일 삭제는 사용하지 않았다.
- `tools/relocate-references.mjs`: MD의 탐색 링크/역사 배너와 helper의 감사 경로만 보정. raw JSON/log/TSV는 원본 보존.
- `tools/repair-relative-imports.mjs`, `tools/check-relative-imports.mjs`:90개 보정,107개 정적 상대 참조 대조. 이동으로 생긴 미해소0, 기존 은퇴 모듈 참조3은 별도 한계.
- `tools/verify.mjs`: 원본/이동 manifest, raw SHA, 모든 문서 링크·JSON·helper syntax, 루트 파생 원장, 재실행 guard,49개 문서 검토 범위를 대조한다. 결과가 완료된 뒤 verification.json을 따른다.
- workspace generator는 INDEX의 라우터 변경 후 정식 `generate-workspace-state --write`를 실행했다. 생성 문서는 직접 편집하지 않았다.

위 실행 중 Markdown 경로를 찾는 PowerShell 검색식 한 번은 quoting 오류로 실패했고, Node의 module dependency 검사로 바꿨다. 초기 상대 import 검사에서 이동으로 깨진 경로를 발견해90개를 보정했다. 이 중간 실패를 제품 결함이나 최종 PASS로 숨기지 않는다.

선택 QA는 명시한 작업 소유 경로로 한 번 실행한다. workspace-facing 필수 체크와 preflight 결과는 qa-closeout.json에 명령별로 보존한다. 전체 full/external·실브라우저·실제 유료 AI·producer는 실행하지 않는다. 다른 날짜의 과거 PASS/FAIL은 해당 원시 보고서에서 읽는다.

## 최종 실행 결과

`node .cache/audit-consolidation-20261022/qa-closeout.mjs`가 원래 경로482개와 새 감사 자료·INDEX/생성물의 **명시990개 경로**를 전달했다. Windows 명령행 길이 제한을 피하기 위해 파일 목록을 읽어 Node argv를 설정하는 얇은 wrapper로, 수정하지 않은 `scripts/qa-runner.mjs affected --session audit-consolidation-20261022 --files <목록> --no-cache`를 실행했다. 실제 선택은 qa-selection.json, 목록은 qa-owned-files.json, wrapper 경로/명령/출력은 qa-closeout.json/log에 있다. 영향 선택을 먼저 확인한 뒤 실행했고 preflight/workspace 외 group이나 producer/parity 실행은 선택하지 않았다.

2026-10-22 10:00 KST 마감: **29 PASS / 0 CACHED / 0 FAIL / 0 SKIP**,53초. workspace 필수10개 명령은 이 실행에 이미 포함되어 동일 입력으로 반복하지 않았다. `git diff --check`도 exit0이다. TMP/TEMP는 작업 전용 workspace 임시 경로를 사용했다. 행동 fixture의 임시 저장소 commit과 프로젝트 저장소의 commit은 구별하며 프로젝트 commit/push/deploy는 없다.

자료 검증은 원본482·raw325 불변, 문서49개 전문 재검토 기록, 파생원장850개/고유850개/405·13·432 보존, Markdown 링크 누락0, JSON parse 및 helper syntax 오류0이었다. 정확한 최종 개수는 verification.json을 따른다. guard 재실행은 예상대로 nonzero 거부했으며482개 근거 바이트가 그대로임을 확인했다. 이것은 의도한 안전 동작의 테스트 통과이며 QA 실패를 숨긴 것이 아니다.
