# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages에서 제공되는 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 변동하는 버전·라우트·파일 크기·지식 상태의 정본은 `_context/CURRENT-STATE.md`이며, 이 문서에는 복제하지 않는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v54.63**
- **버전 이력 → CHANGELOG.md** (v52.62+ 상세, v52.61 이하는 압축 이력 + git 히스토리). 버그 계보 → `_context/BUG-POSTMORTEM.md`(반복 클래스 표 + 압축 원장), 검증 이력 → `_context/QA-CHECKLIST.md` §6.
- 이 파일에는 버전별 작업 요약을 **누적하지 않는다** (2026-07-18 통합 — CHANGELOG가 단일 출처).
- 코드 구조: `index.html` 정적 셸 + `js/` 호환 모듈 + `src/` native ESM. 현재 집계는 `_context/CURRENT-STATE.md`, 구간 탐색은 `_context/CODE-MAP.md`를 사용한다.
- 스택: HTML5 + 인라인 CSS/JS · Chart.js(CDN) · AES-256 · GitHub Pages · 한국어 UI · 아이보리 테마(다크 지원) · WCAG AA

---

## 작업 유형별 읽을 파일

| 작업 | 읽을 파일 |
|------|----------|
| **index.html 수정** | `_context/CODE-MAP.md` → 해당 line 범위만 Read |
| **모든 작업** | `_context/CURRENT-STATE.md` → `_context/WORKFLOW-GOVERNANCE.md` → `_context/INDEX.md` |
| **버그 수정** | `/bug-fix` → 관련 R/P/QA 항목만 검색 → 회귀 게이트 |
| **새 기능** | 관련 스킬 → `_context/CODE-MAP.md`/도메인 계약의 필요한 범위 |
| **QA/점검** | `/qa` → 변경 위험에서 tier·라우트 집합 파생 |
| **자료 통합** | `/integrate` 스킬 (→ `CHANGELOG.md` + `_context/KNOWLEDGE-BASE.md` 환류) |
| **데이터 갱신** | `/data-refresh` 스킬 |
| **지식 린팅** | `/knowledge-lint` 스킬 |

상세 라우팅: `_context/INDEX.md`; 기계 상태: `_context/CURRENT-STATE.md`; 전체 파일 분류: `_context/CONTEXT-CATALOG.json`.

---

## 절대 규칙 (R1~R3만 — 나머지는 `_context/RULES.md`)

**R1. 버전 동기화**: title · badge · APP_VERSION · version.json · sw.js SW_VERSION · root/context docs · CHANGELOG.md · JS cachebusters — **반드시 `node scripts/bump-version.mjs <버전>`으로 일괄 패치** (v51.64~)
**R2. 버전 체계**: `v{major}.{patch}` 숫자 단조 증가 (예: v48.76 → v48.77). 최신 실제 체계는 두 자리 patch 허용.
**R3. 버그 수정 시 사후 분석**: `_context/BUG-POSTMORTEM.md`에 P번호 기록
**R27. Commands↔Skills 동기화**: 새 스킬 시 command wrapper 동시 생성

---

## 작업 규칙

- **자동 배포/커밋 금지** — 사용자가 해당 동작을 명시적으로 요청한 경우에만
- **코드 전면 재작성 금지** — CODE-MAP/owner registry 기반으로 가장 낮은 공통 원인을 부분 패치
- **코드 수정 시 자동 반영**: BUG-POSTMORTEM + QA-CHECKLIST + RULES + 버전 7곳 동기화
- **게이트-문서 계약 주의**: CI 게이트가 QA-CHECKLIST §7 마커·RULES 특정 문구·CHANGELOG v50.89 섹션을 grep한다 — 문서 압축/정리 시 삭제 금지

---

## 복리 루프 (Karpathy Second Brain)

```
작업 수행 → 산출물 → 위키(_context/) 환류 → 다음 작업이 더 정확
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | BUG-POSTMORTEM → 3회 반복 시 RULES 승격 |
| /integrate | CHAT_CONTEXTS + SCREENER_DB + TECH_KW/MACRO_KW |
| /qa | QA-CHECKLIST 항목 추가 |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| 리팩토링 ±500줄 | CODE-MAP 재스캔 |

에러 복리 방지: `/knowledge-lint`와 `ci-workspace-contract-check.mjs`를 push/PR·주기 실행에 연결한다. 코드 확인 없이 추측 판단 금지.

---

## 토큰 효율성

- 인사/칭찬/마무리 멘트 금지 · 질문 되풀이 금지 — 바로 작업
- 요청 범위 외 제안/과잉 설계 금지
- index.html은 CODE-MAP 기반 부분 읽기 · 파일은 한 번만 읽기
- 모르면 솔직히 말하기 (경로/함수명 날조 금지)
- 대형 RULES/QA/BUG/KNOWLEDGE 원장은 관련 용어만 검색한다. 기본 컨텍스트는 CURRENT-STATE/GOVERNANCE/INDEX와 선택된 스킬 라우터로 제한한다.
- 자동 커밋 훅을 추가하지 않는다. 훅은 파괴 명령 차단과 advisory 검증만 수행한다.
