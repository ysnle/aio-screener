# AIO Screener

가족·지인(약 5명)이 쓰는 무료 미국 중심 투자 리서치 터미널이다. 무료 공개 데이터를 GitHub Actions가 모아 정적 산출물로 만들고, GitHub Pages가 화면을 내보낸다. AI 해석은 공용 Cloudflare Worker 하나를 거친다.

- 사이트: https://ysnle.github.io/aio-screener/
- 구조: `index.html` 정적 셸 + `js/` 호환 모듈 + `src/` native ESM, 데이터는 `public-data/`, Worker는 `worker/`
- 현재 버전·라우트·파일 크기: `_context/CURRENT-STATE.md`(생성 파일, 손으로 고치지 않음)

## 어디서 무엇을 찾나

| 알고 싶은 것 | 정본 |
|---|---|
| 제품 결정·협업 원칙·변경 흐름 | [`AGENTS.md`](AGENTS.md) |
| 소유자 결정의 날짜·출처·대체 관계 | [`_context/OWNER-DECISIONS.md`](_context/OWNER-DECISIONS.md) |
| Claude Code 작업 안내 | [`CLAUDE.md`](CLAUDE.md) |
| 문서 위치 탐색 | [`_context/INDEX.md`](_context/INDEX.md) |
| 규칙·원칙(C1~C18) | [`_context/RULES.md`](_context/RULES.md) — 검색 전용 |
| 결함 사후 분석(P) | [`_context/BUG-POSTMORTEM.md`](_context/BUG-POSTMORTEM.md) — 맨 위 원칙별 반복 결함 표, 나머지는 검색 |
| 검증 항목(QA) | [`_context/QA-CHECKLIST.md`](_context/QA-CHECKLIST.md) — 열린 항목이 위 |
| 버전 이력 | [`CHANGELOG.md`](CHANGELOG.md) |
| 열린 작업·결정 대기 | [`_context/ROADMAP.md`](_context/ROADMAP.md) |
| 운영 대응 | [`_context/OPERATOR-RUNBOOK.md`](_context/OPERATOR-RUNBOOK.md) |
| 코드 리뷰 기준 | [`REVIEW.md`](REVIEW.md) |

## 기록은 스크립트로

- 버전: `node scripts/bump-version.mjs <버전>`
- 결함·기능 기록: `node scripts/record-fix.mjs <entry.json>` (병렬 작업은 `_artifacts/pending-records/<스레드>/`에 두고 통합 때 `node scripts/apply-pending-records.mjs --dry-run`으로 확인한 뒤 `--apply`로 기록)
- 작업 공간 상태: `node scripts/generate-workspace-state.mjs --write`
- 로컬 검증: `npm run qa` (변경 영향 기반)

데이터를 외부에서 가져오는 생산자 스크립트는 GitHub Actions에서만 돈다. 화면의 점수와 해석은 직전 미국장 종가 기준의 참고 자료이며 매매 지시가 아니다.
