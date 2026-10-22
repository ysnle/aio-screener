> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 검증 마감 기록

상태: 감사 체크포인트 산출물 정리. 제품 결함 존재, 전수 의미 검토 IN_PROGRESS. 제품 소스·데이터를 고치거나 commit/push/deploy하지 않았다. 다른 작업의 v58.60 및 이후 dirty 변경은 이 감사 소유가 아니다.

## 직접 실행한 검증

| 명령/근거 | 결과와 범위 |
|---|---|
| `node scripts/ci-boot-bundle-budget-check.mjs` | PASS,42 boot 출력 raw1496044/gzip544662 bytes. v58.59 정적 ESM 출력이며 전체 다운로드/paint 아님. |
| `node --experimental-vm-modules .../analyze.mjs` | 고정 source 분석: JS/MJS792 구문 오류0, 알려진 bootstrap392모듈. 의미/브라우저 검증 아님. |
| `node .../reproduce-market-reading.mjs` | 실제 고정 모듈의 결측 예외와 반대 부호 설명 반례를 재실행. market-reading-result.json. |
| `node .../reproduce-cache-identity.mjs` | 의존만 바꾼 fingerprint 동일/gate 본문 변경 대조는 다름. gate 자체 실행/producer 없음. |
| `node .../reproduce-legacy-latest.mjs` | 실제 고정 renderer의 KST08/09시 일정 대조와 한국 미수신 반례. |
| `node .../reproduce-legacy-core-hwm.mjs` | 실제 core fetch 함수+정확한 chat consumer VM, HPE fixture 수락. 실제 AI 답변 호출 아님. |
| `node --experimental-vm-modules .../domain-probe.mjs` | exit0, DuPont/FY 반례와 별도 FX 비교; 일부 수치 synthetic. assertion PASS를 임의로 붙이지 않고 반환값 보존. |
| `node .../ui-delta-repro.mjs` | exit0, 섹터 분모/시총#/IC t 혼용/현금 포함 계좌β assert. 실브라우저 보유 입력 없음. |
| `node --experimental-vm-modules .../domain-complete-probe.mjs` | exit0, 현재 home3개 임계값 양옆이 실제 axis rule과 일치. 동결 입력 민감도이지 미래 장 예측 아님. |
| `node .../probe-tooling.mjs` | exit0, R719 삭제 미검출 및 literal/alias/freshness 개수 경계. 실제 gate 전체 실행 아님. |
| `node --experimental-vm-modules .../latest-delta-probe.mjs` | exit0, v58.60 provider의 availableAt 복원·서로 다른 날짜 보존·prompt label 정리/재사용 보류·정적 artifact 크기 확인. |
| `node .../root-receipt.mjs`, `node .../assemble.mjs` | 고정 hash 원장 생성, source/receipt 불일치0. 현재 checkout 차이는 별도 기록. |
| 실제 Pages browser | v58.59 주 메뉴8경로와 일부 desktop/phone/tablet 동작. BROWSER.md와 PNG/텍스트. 전체 라우트/기기/상태 인증 아님. |

여기서 `.../`는 `_artifacts/architecture-quality-audit-20261021-v5859/`다. 최초 실행의 raw 결과는 root-executions.json, 추가 반례는 각 결과 JSON과 도구 실행 기록에 있다. 폴더에는 이전 감사에서 복사한 미실행 probe도 있다. 위 표와 보고서에 명시한 실행만 이번 최신 검증으로 주장한다.

## 산출물 QA

실행 결과: 감사 helper30개 구문 오류0. 선택 preflight 최초13 PASS/1 FAIL(qa-runner-behavior의 임시 last-run.json ENOENT)였고, 실패 원본 run을 지정해 그1개만 재실행했다. TMP/TEMP를 workspace의 .cache/architecture-audit-temp로 둔 재실행은 PASS(29.3초), failed batch가 해소됐다. **합산14개 선택 검사 PASS이며 전체 release/full 인증은 아니다.** 코드 변경 없이 실행 위치를 바꾼 결과를 관측했으며 최초 실패의 저수준 원인을 모두 규명했다는 뜻은 아니다. retry-qa-result.json/log에 정확한 명령과 환경을 남겼다. 이후 추가한 helper도 artifact-integrity에서 다시 구문 검사한다.

`node --experimental-vm-modules _artifacts/architecture-quality-audit-20261021-v5859/closeout-qa.mjs`는 이 폴더 파일을 명시적으로 `qa-runner affected --session architecture-quality-20261021-v5859 --files <목록> --no-cache`에 넘긴다. 정확한 인수/시작·완료/exit/산출물 구문 결과는 closeout-qa-result.json, 출력은 closeout-qa.log다. 현재 작업 트리의 선택된 preflight 결과이며 고정 v58.59 전체 release/배포 인증이 아니다. unrelated dirty 파일을 작업 범위로 지정하지 않는다.

전체 full/external QA, 실제 AI 전송/청구·배포 Worker, 모든 접근성/오류/사용자 상태는 미검증이다. 확인된 제품 결함의 실제 수정은 하지 않았으므로 ‘fixed items’는 없음이다. 원장의 과대 승격과 보고 문구는 감사 자료 안에서 바로잡았다.

앞선 마감의 산출물 점검: helper32개 구문 오류0, Markdown 로컬 링크 누락0, 고정 source/receipt 불일치0이었다. 소유 probe4개의 CRLF를 LF로 정규화했다. 이후 계속 작업의 최신 집계는 아래와 [artifact-integrity-result.json](./artifact-integrity-result.json)에 있다. 소유 경로의 git diff --check도 exit0이다(untracked 파일 내용의 전체 검사를 대신하지 않으므로 위 별도 검사를 함께 했다).

## 계속 작업 마감 — 2026-10-21 23:03 KST

새 session: `audit-remaining-20261021-v5861`. 기준선은4081파일을 캡처했고 이후 작업은 감사 산출물에만 썼다. 작업 트리 버전은 중간에v58.62가 되었으나 고정 원장은v58.59를 유지했다. 새 전문53개는 현재 소스와 SHA53/53일치, 전체850원장 중405전문/13mirror/432미완료, 고정source/receipt mismatch0이다. 새 최신4개 파일은 별도 diff-only로 보존했다.

root가 이번에 직접 실행한 반례:

- `node .../remaining-governance-probe.mjs`: 원본3개 gate VM, 정상 대조와 identity/중복/완료 반례. 메모리 변경만 수행.
- `node .../chat-probe-boundaries.mjs`: 실제 채팅 함수4개 경계의 assert 모두 충족. 외부·유료0.
- `node .../ui-shell-probe-repro.mjs`: 저장 거절/허용 대조, 이력 실패에서 가짜30일 수익률 출력 재현.
- `node .../workflow-probe-review.mjs`: 실제 age/helper와 mocked convergence driver. Actions/API 실행 없음.
- `node .../workspace-tool-probe-review.mjs`: parser/validator 실제 VM, major-only 거절/소수 버전 허용.
- `node .../qa-runner-probe-repro.mjs`: 실제 runner 전체를 가상FS/child 완료로 평가, cache로 실패 해소 및 빈 retry를 재현. 실제 gate를 이 probe가 실행하지 않음.

위 경로의 `...`는 이 감사 디렉터리다. 종료0은 결함 반례가 재현됐다는 뜻이며 제품 정상 판정이 아니다.

`node .../remaining-closeout.mjs`는 정확한38개 감사 소유 경로를 `affected --session audit-remaining-20261021-v5861 --files <명시목록> --no-cache`에 전달했다. 기존에 관측한 외부 tmp 문제를 피하도록 프로세스TMP/TEMP를 `.cache/audit-remaining-temp`로 지정했다. 결과 **14PASS/0CACHED/0FAIL/0SKIP**,42초. report `.cache/aio-qa/runs/2026-10-21T14-03-08-269Z-10948-zgajo5.json`, 명령·목록·환경은 remaining-closeout.json/log에 보존했다. behavior gate는 임시 fixture repo에서만 테스트용 commit을 사용한다. 프로젝트 저장소 commit/push/deploy는 없었다. 이 preflight는 현재 checkout 결과이며 고정v58.59 전체 QA나 배포 인증이 아니다.

이번에 새 실브라우저·live/유료 AI/producer/전체full·external QA를 실행하지 않았다. 앞선 v58.59 실제 브라우저 증거와 v58.60 delta는 날짜/범위를 유지한다. 작업 트리의 사용자/다른 작업자 변경은 수정하거나 되돌리지 않았다.

23:05 KST `node --experimental-vm-modules .../artifact-integrity.mjs`: helper41개 구문 오류0, 로컬 Markdown 링크 누락0, 고정source/receipt mismatch0. 새 probe2개의 CRLF를 LF로 정규화했다. `git diff --check -- <감사 폴더>` exit0. 별도 검토자가53개 receipt의 고정blob/inventory/reading-ledger 일치와 고유성, 순증52 및 발견13건의 증거 범위를 다시 대조해 불일치0을 보고했다. 이 마지막 문구 보완은 보고서 정리이며 제품·실행 helper 변경은 아니다.
