# 구조·사용성 개선 검증 기록

## 판정

v54.85, 2026-09-11. 사용자의 마지막 요청에 따라 중단됐던 채팅 화면·시세 근거·지식 검사 수정만 마무리했다. 해당 수정과 집중 회귀는 PASS이며, 종합 QA는 기존 데이터의 유효기간 초과로 WARN이다. 앞선 전체 개선 요청의 미완료 항목이나 배포 완료를 뜻하지 않는다.

## 변경 범위

- 전체 요청 대조: [SESSION-COVERAGE.md](SESSION-COVERAGE.md)
- 실제 파일 변화: [CHANGED-FILES.md](CHANGED-FILES.md)
- AI 설계와 현재 구현 대조: [AI-DESIGN-AUDIT.md](AI-DESIGN-AUDIT.md)
- 기존 성능 측정: [성능 보고서](../performance-hunt-20260906/REPORT.md)
- 이번 채팅 UX 기준선: `chat-ux-20260910`. 앞선 수정은 `structural-quality-20260906` 기준선과 구분한다.

## 확인한 결함과 수정

P1056: unified 채팅의 row flex에 모델 배지·검증 안내·데이터 상태·출처를 형제로 붙여 본문 폭을 압축했다. 답변과 메타데이터의 세로 흐름, 좁은 화면의 표·코드 overflow를 보강한다. 근거 상세는 키보드로 펼치는 details로 제공하고 내부 구현 용어를 사용자 문장으로 바꿨다. 검색 링크는 중복을 제거하고 검증된 근거라는 인상을 주지 않게 표시한다.

P1057: 두 시세 근거 producer가 같은 시세의 출처·통화·관측시각을 다르게 누락했다. 공유 builder로 실제 provenance를 보존하며 누락을 수신시각·통화 추측으로 채우지 않는다.

## 검증 증거

- `node scripts/ci-chat-resilience-check.mjs`: PASS. 취소·검색 fallback·출처 spoofing·중복 링크·관측시각 부재 등 격리 runtime 검증.
- `node scripts/ci-ai-chat-reliability-contract-check.mjs`: PASS.
- `node scripts/ci-ai-analysis-evidence-check.mjs`: PASS. typed mapping·상충 값·단위/시각·입력 부족·전제 API.
- 직접 로컬 브라우저: 홈과 AI 패널 열기, 추천 항목의 버튼 노출, 연결 없는 질문 전송 후 안내 및 입력 보존 확인. 실제 키나 개인 저장 기록을 사용하지 않았다.
- 앞선 `full --no-cache`: 92 PASS, 4 FAIL, 22 SKIP. 원본은 [qa-full-v5484-initial.json](qa-full-v5484-initial.json). 당시 실패한 지식 소비 계약을 수정한 후 `rerun-failed`로 재검사한다.
- `node scripts/ci-chat-response-layout-browser-check.mjs`: 320/400/768/1280px PASS, 근거 details 키보드 펼침/닫힘 PASS. 이전 직계 sibling row 구조에서는 400px 패널의 본문 폭이 97.13px로 압축됐고, 수정 후 371px로 표시된다. [수정 화면](chat-layout-400.png), [이전 구조 재현](chat-layout-before-400.png). 격리 테스트 답변이며 실제 provider 답변은 아니다.
- `node scripts/ci-ai-quote-evidence-check.mjs`, `node scripts/ci-ai-intelligence-contract-check.mjs`, `node scripts/ci-ai-chat-analysis-integration-check.mjs`: PASS. 미확인/stale truth, 관측시각 충돌, source override 및 중복 ID 반례 포함.
- `node scripts/qa-runner.mjs rerun-failed`: 기존 지식 계약 4개 PASS.
- `node scripts/qa-runner.mjs affected --session chat-ux-20260910`: 91 PASS, 4 CACHED, 3 FAIL, 17 SKIP. [원본 결과](qa-chat-ux-v5485.json), [이번 변경 목록](chat-ux-changed-files.txt). workspace 생성물·버전·지침·스킬·profile 동기화 검사 PASS.
- 실패는 `reconciliation`, `data-refresh`, `data-lineage`의 기존 데이터 유효기간 초과다. 사용자의 범위 제한에 따라 데이터 전체 갱신을 추가하지 않았다. 후속 17개는 runner에서 건너뛰었으며 통과로 계산하지 않는다.
- 후속 중 채팅 관련 `ci-chat-ui-state-browser-check.mjs`, `ci-ai-chat-public-route-browser-check.mjs`, `ci-chat-response-layout-browser-check.mjs`는 별도 실행 PASS. public route fixture는 disabled/Worker request 0, partial claim degradation·truncated recovery·page errors 0을 확인했다.

## 미완료·미검증

- `node scripts/audit-knowledge-encyclopedia-depth.mjs --strict`: FAIL, `ENCYCLOPEDIA_DEPTH_BLOCKED`. 160/160 교육 원문이 1,200자 하한 미달이고 완전한 의미 계약은 0/160이다. 참조 원문 보존 검사와 심층 집필 검사를 구분한다.
- 실제 provider 답변, 공개 Worker 활성화, 장시간 다중 턴·blind benchmark·운영 비용은 미검증이다.
- 정확한 수익률 기간을 제공하지 않는 데이터로 상승·하락 전제를 확인했다고 말하지 않는다. 섹터 전체 표본·검증된 인과 관계·복합 의도 분석 합성은 부분 구현이다.
- history producer의 일봉 시작 경계를 이전 종가 관측시각으로 사용하는 의미 문제는 별도 수정 대상이다. 현재 전제 검증은 이를 기간 증거로 사용하지 않는다.
- 전체 함수·모든 사용자 조합의 품질을 인증하지 않는다. 자동 PASS를 전체 내용의 의미 검수로 승격하지 않는다.

커밋·push·배포는 수행하지 않았다.
