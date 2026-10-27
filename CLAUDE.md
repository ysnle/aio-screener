# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages에서 제공되는 하이브리드 정적 셸 + native ESM 투자 리서치 터미널이다. 변동하는 버전·라우트·파일 크기·지식 상태의 정본은 `_context/CURRENT-STATE.md`이며, 이 문서에는 복제하지 않는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v59.23**
- **버전 이력 → CHANGELOG.md** (v52.62+ 상세, v52.61 이하는 압축 이력 + git 히스토리). 버그 계보 → `_context/BUG-POSTMORTEM.md`(반복 클래스 표 + 압축 원장), 검증 이력 → `_context/QA-CHECKLIST.md`(현행 항목은 상단, §6은 압축 보관).
- 이 파일에는 버전별 작업 요약을 **누적하지 않는다** (2026-07-18 통합 — CHANGELOG가 단일 출처).
- 코드 구조: `index.html` 정적 셸 + `js/` 호환 모듈 + `src/` native ESM. 현재 집계는 `_context/CURRENT-STATE.md`, 구간 탐색은 `_context/CODE-MAP.md`를 사용한다.
- 스택: HTML5 + 인라인 CSS/JS · Chart.js(CDN) · AES-256 · GitHub Pages · 한국어 UI · 아이보리 테마(다크 지원) · WCAG AA

---

## 작업 유형별 읽을 파일

| 작업 | 읽을 파일 |
|------|----------|
| **index.html 수정** | `_context/CODE-MAP.md` → 해당 line 범위만 Read |
| **모든 작업** | `_context/CURRENT-STATE.md` 한 번 확인; governance/index는 관련 상세나 위치 탐색이 필요할 때 |
| **작업 이어받기(핸드오프)** | SessionStart 훅이 출력하는 최신 `_artifacts/**/HANDOFF*.md`·`*RESPONSE*.md` — 마지막 작업·열린 항목·다음 행동·반복 금지 |
| **버그 수정** | `/bug-fix` → 관련 R/P/QA 항목만 검색 → 회귀 게이트 |
| **새 기능** | 관련 스킬 → `_context/CODE-MAP.md`/도메인 계약의 필요한 범위 |
| **QA/점검** | `/qa` → 변경 위험에서 tier·라우트 집합 파생 |
| **자료 통합** | `/integrate` 스킬 (→ `CHANGELOG.md` + `_context/KNOWLEDGE-BASE.md` 환류) |
| **데이터 갱신** | `/data-refresh` 스킬 |
| **지식 린팅** | `/knowledge-lint` 스킬 |

상세 라우팅: `_context/INDEX.md`; 기계 상태: `_context/CURRENT-STATE.md`; 전체 파일 분류: `_context/CONTEXT-CATALOG.json`.

---

## 절대 규칙 (R1~R3·R27 — 나머지는 `_context/RULES.md` 상단 핵심 규칙 색인부터)

**R1. 버전 동기화**: title · badge · APP_VERSION · version.json · sw.js SW_VERSION · 런타임·배포 revision 메타데이터(public-config·architecture·wrangler·operations-status) · CHANGELOG.md · JS cachebusters (날짜가 박힌 핸드오프 문서는 동결) — **반드시 `node scripts/bump-version.mjs <버전>`으로 일괄 패치** (v51.64~)
**R2. 버전 체계**: `v{major}.{patch}` 숫자 단조 증가 (예: v48.76 → v48.77). 최신 실제 체계는 두 자리 patch 허용.
**R3. 버그 수정 시 사후 분석**: P/R/QA/CHANGELOG/상태는 `node scripts/record-fix.mjs <entry.json>`로 한 번에 기록 (수기 편집 금지, 형식은 `/version-up`). 결함이 아닌 기능·정리는 `p` 없는 change-only 항목으로 기록(P 번호 미할당)하고, 새 assertion은 도입 릴리스(`v57.54 …`)를 인용한다
**R27. Commands↔Skills 동기화**: 새 스킬 시 command wrapper 동시 생성

---

## 작업 규칙

- **문서와 코드가 어긋나면 코드 관례를 따른다** — CODE-MAP·스킬·핸드오프·메모리·이 파일의 설명이 지금 코드와 다르면 코드의 관례를 따르고, 최종 답변에 찾은 어긋남을 모두 적는다. 단 `AGENTS.md` 제품 결정·`RULES.md` 정책과 다른 코드는 결함으로 보고한다. 근거: 에이전트는 지시 파일이 낡아도 90% 이상 그쪽을 따르며, 이 한 문장이 코드 준수를 4%→91%로 바꿨다(arXiv 2610.30571, 2026-10-25)
- **가능성 낮은 경계 사례에 복잡도를 더하지 않는다** — 드문 경합·보안 사례 대비 코드는 실패 양상·가능성·복잡도 비용을 먼저 설명하고 동의를 받은 뒤 넣는다(opencode AGENTS, 2026-10-25)
- 변경 이유 추적은 `/why`(`node scripts/why-trace.mjs`), 선례 없는 화면 결정은 `/prototype`, 첫 사용자 관점 QA는 `/first-users`
- **제품 결정·협업 원칙의 단일 출처는 `AGENTS.md`** (Product decisions + 협업 원칙: 소유자 요청도 근거로 검토·반대 의견 제시, 8화면 정보구조 통합, 원천 없는 위젯·근거 없는 등급 제거, 느린 데이터 정적화, AI는 OpenAI gpt-6-luna 공용 Worker · 웹검색 포함 월 $20 · AI 항상 사용·웹검색 자동(2026-10-11~12))
- **자동 배포/커밋 금지** — 사용자가 해당 동작을 명시적으로 요청한 경우에만
- **코드 전면 재작성 금지** — CODE-MAP/owner registry 기반으로 가장 낮은 공통 원인을 부분 패치
- **제품 결정·변경 흐름은 `AGENTS.md`가 정본**: 종가 기준 점수, 데스크톱·모바일·아이패드 반응형 지원(2026-10-11 재승인), 옵션 퇴역, 티커 추정 금지, 로컬 프로듀서 금지, **main 직접 작업**(PR 없음, push는 요청 시), 생성물 충돌 해소 스크립트
- **기록 순서**: `bump-version` → 항목별 `record-fix` → `generate-workspace-state --write` → 원장·버전·워크스페이스 게이트. 큰 배치는 구현을 모은 뒤 기록·검증을 한 번에
- **게이트-문서 계약**: 원장(RULES/QA-CHECKLIST/BUG-POSTMORTEM/CHANGELOG) 산문은 자유롭게 압축·정리해도 된다. 게이트는 구조만 검사한다 — `## R<n>.` 헤딩(번호 보존), QA 행 형식·`verify_by`, CHANGELOG `## v<버전>` 헤딩. 정책↔원장 추적은 `architecture/governance-markers.json`이 담당한다
- **배치 마감 시 push 여부를 한 번 묻는다** — 로컬 미푸시가 길어지면 실서비스 생산자·라이브가 어긋난다(v57.54 검토)

---

## 복리 루프 (Karpathy Second Brain)

```
작업 수행 → 산출물 → 위키(_context/) 환류 → 다음 작업이 더 정확
```

| 작업 | 환류 대상 |
|------|----------|
| 버그 수정 | BUG-POSTMORTEM → 반복 결함 클래스는 RULES/QA + 실행 게이트로 승격 (AGENTS) |
| /integrate | KNOWLEDGE-BASE + `src/ai/context/panel-contexts.js` + 스크리너 레지스트리 |
| /qa | QA-CHECKLIST 항목 추가 |
| 인사이트 | KNOWLEDGE-BASE (R26) |
| 리팩토링 ±500줄 | CODE-MAP 재스캔 |

에러 복리 방지: `/knowledge-lint`와 `ci-workspace-contract-check.mjs`를 push·주기 실행에 연결한다. 코드 확인 없이 추측 판단 금지.

---

## 토큰 효율성

- 인사/칭찬/마무리 멘트 금지 · 질문 되풀이 금지 — 바로 작업
- 요청 없는 구현·과잉 설계 금지 — 단, 반대 의견과 더 단순한 대안은 먼저 말한다 (AGENTS 협업 원칙)
- index.html은 CODE-MAP 기반 부분 읽기 · 파일은 한 번만 읽기
- 모르면 솔직히 말하기 (경로/함수명 날조 금지)
- 대형 RULES/QA/BUG/KNOWLEDGE 원장은 관련 용어만 검색한다. 기본 컨텍스트는 CURRENT-STATE로 제한하고 GOVERNANCE/INDEX와 스킬은 필요한 부분만 읽는다. 승인·완료·병렬 위임 원칙은 AGENTS.md를 따른다.
- 자동 커밋 훅을 추가하지 않는다. 훅은 파괴 명령 차단과 advisory 검증만 수행한다.
- 위임·검토 루틴: 서브에이전트 프롬프트는 `.claude/skills/_shared/agent-prompt-anatomy.md`(목표→반환 형식→경고→컨텍스트). 주간 회고 `/retro`, 큰 작업 전 `/restate`, 가정 점검은 `/assumptions`(검증/추정 표시, 적용 전 정지), 큰 배치 뒤에는 새 컨텍스트 `/trim-pr`로 덜어낼 것부터 찾는다.
