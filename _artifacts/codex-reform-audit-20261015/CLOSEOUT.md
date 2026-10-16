# 감사 문서 마감

기준: v57.82 / `1dff3b233c0382dee6bf978b4b625901ead5012f` / 2026-10-15 KST.

제품 검토는 [HANDOFF](./HANDOFF.md)와 [REVIEW](./REVIEW.md), 실행 원문은 [gates](./gates/)와 [counterexamples](./counterexamples.json)에 있다.

## 검증 결과

- 제품 코드 불변 상태의 전체 QA: 172 PASS / 0 FAIL / 0 SKIP. [full-qa.json](./gates/full-qa.json).
- 외부 상태: 2 PASS, 운영 상태 DEGRADED. [external-qa.json](./gates/external-qa.json), [상세](./gates/external-pipeline-status.json).
- 사용자 흐름: PC 7/11, 폰 8/11. 실패 원인은 REVIEW F12에 기록. 검증기 자체는 수정하지 않았다.
- 라우트 선언과 DOM: 19/19 일치. selector가 0개인 route도 있어 의미 전수 검수와 다르다.
- 실제 Chrome: 8개 화면과 대표 하위 흐름, 390px·768px, 라이트/다크, 공용 AI 1회 완료. 화면·콘솔·배포 의존성 DOM을 live/에 보존했다.
- 순수 반례: `node _artifacts/codex-reform-audit-20261015/reproduce.mjs`. 외부 네트워크·생산기·실제 브라우저 저장소 사용 없음.

## 문서·workspace closeout

INDEX의 최신 인계 경로를 갱신하고 `node scripts/generate-workspace-state.mjs --write`로 catalog를 공식 재생성했다. `node scripts/qa-runner.mjs affected --session codex-handoff-audit-20261015 --explain`에서 preflight/workspace만 선택됨을 확인한 뒤 같은 명령을 실행했다.

결과: **20 PASS + 9 CACHED / 0 FAIL / 0 SKIP**, 8.1초. run `2026-10-15T14-13-29-948Z-7904-uhif2a`. [affected-qa.json](./gates/affected-qa.json). generated-state, workspace-contract, knowledge-lint, workflow-compaction, skill-contract/evals, ledger-integrity, assertion-trace, profile/skill mirror checks를 포함한다. `git diff --check`도 PASS다.

독립 검토의 세 지적을 반영했다. F09는 사례 수 26개와 작은 표본 통계 묶음 11개를 구별했다. F30은 제외된 dispatch 85회의 자동·수동 비중을 알 수 없음을 명시했다. F18은 외부 추론 없는 Worker mock을 재현기에 추가하고 3×200/AI.run 3회 결과를 보존했다. 실제 제품 수정·버전 bump·새 P/R/QA 원장 기록은 이번 감사 범위가 아니다.

## 화면 디자인 기준 점검

제품 UI를 수정한 배치가 아닌 현재 화면의 감사 결과다. 자동 gate가 의미·보조기기 검수까지 통과시킨 것으로 읽지 않는다.

| 기준 | 결과 |
|---|---|
| 초보자가 한 문장으로 이해 | 실제 사용자 인수 미검증, F23 후속 |
| 한 시각 + 3~5줄 설명 + 접힌 상세 | WARN: 홈·테마·거시의 긴 설명과 계층 문제 |
| 화면 전체의 논리 흐름 | 개선 확인, 역할·기준 반복은 화면별 제안에 기록 |
| 조건과 확인 사항, 직접 매매 지시 배제 | 대표 화면·AI 표본 확인, 정성 확률 잔여 F10 |
| 숫자의 기준일·결측 표시 | 대표 종가/한국장/공시/시세에서 확인, F07/F16/F29 경계 |
| 공급자·구현 정보는 필요한 근거에만 | WARN: 브리핑 원시 ID F11, 13F 구현 어휘 |
| 등급·점수의 예측력 과장 배제 | 백분위·검증 제한 개선 확인, 통계 F05/F09 보완 |
| 한국·미국 세션 구분 | 대표 홈/시장/종목/테마에서 확인 |
| 이모지·제어문자 | 등록 control-char gate PASS, 전편 문구 의미 검수 아님 |
| 라이트/다크·대비 | 실제 테마 전환 + 자동 a11y PASS, 전체 WCAG 수동 인증 아님 |
| 폰/iPad/desktop·터치·키보드 | geometry/반응형/터치 gate PASS와 대표 Chrome 관찰, 실물 키보드·가상 키보드·모든 44px 대상은 별도 |
| 포커스·차트 텍스트 대안 | 자동 gate·대표 사전/차트 확인, 보조기기 답변 완료 F24 미검증 |
| 하나의 AI 패널 | 대표 화면 간 동일 대화 유지 확인, 페이지별 입력창 추가 없음 |

## 실행 명령

```text
node scripts/qa-runner.mjs session-start --session codex-handoff-audit-20261015
node scripts/qa-runner.mjs full --no-cache
node scripts/qa-runner.mjs external --no-cache
node .claude/skills/verify-aio/scripts/verify-aio.mjs check
node .claude/skills/verify-aio/scripts/verify-aio.mjs launch
node .claude/skills/verify-aio/scripts/verify-aio.mjs drive all --run codex-audit-20261015 --viewport desktop
node .claude/skills/verify-aio/scripts/verify-aio.mjs drive all --run codex-audit-20261015 --viewport phone
node .claude/skills/verify-aio/scripts/verify-aio.mjs registry --run codex-audit-20261015
node _artifacts/codex-reform-audit-20261015/reproduce.mjs
gh run view 38745095163 --repo ysnle/aio-screener --log
gh run download 38745095163 --repo ysnle/aio-screener --dir _artifacts/codex-reform-audit-20261015/watchdog
node scripts/generate-workspace-state.mjs --write
node scripts/qa-runner.mjs affected --session codex-handoff-audit-20261015 --explain
node scripts/qa-runner.mjs affected --session codex-handoff-audit-20261015
node .claude/skills/verify-aio/scripts/verify-aio.mjs cleanup
git diff --check
```

## 증거 보존과 환경

첫 sandbox full/external/launch 실패는 임시 폴더·하위 프로세스·네트워크 접근 제한이었다. 정상 권한 재실행의 위 결과와 분리했다. 권한 자동 검토 거절은 없었다.

full이 재생성한 기존 tracked 증거 53개는 gates/로 복사한 뒤 시작 HEAD 내용으로 복원했다. [evidence-receipt.json](./evidence-receipt.json). 이번 폴더 밖의 과거 감사 증거를 새 결과로 바꾸지 않았다.

knowledge-lint는 INDEX 경로·문서 현실·정책 드리프트를 대상으로 한 targeted pass다. 전체 8패스 의미 감사·모든 명령의 모델 행동 평가를 수행했다고 주장하지 않는다. 기계적 workspace 게이트와 투자 콘텐츠 의미 검수는 별개다.

commit/push/deploy/workflow dispatch 없음. 로컬 서버 PID 27988 종료·8791 listener 없음 확인. Chrome 임시 viewport와 라이트 테마 복원 확인 후 검토용 탭을 닫는다. 실제 XSS·계정 청구·Secrets·원문 전수·실기기 Safari·보조기기·개인 보유 수치·새 버전 장기 SLO는 미검증으로 남긴다.
