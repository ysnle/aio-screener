# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v45.7**
- 메인 파일: `index.html` (**~38,250줄**, ~2.1MB)
- 스택: HTML5 + 인라인 CSS3 + Vanilla JS(ES5/ES6) · Chart.js(CDN) · AES-256(API 키 암호화) · GitHub Pages 정적 호스팅 · 한국어 UI · 다크 테마 · WCAG AA

## 새 대화 시작 시 필수 읽기

1. 이 파일 (CLAUDE.md) — 절대 규칙 + 작업 규칙 요약
2. `_context/RULES.md` — 마스터 룰 R1~R26 (필요 시)
3. 작업 유형에 따라 아래 "작업 유형별 읽을 파일" 표 참조

## 상세 문서 위치

- **파일 구조 / Hook 시스템**: `_context/CLAUDE.md`
- **index.html 내부 구조 + line 범위 맵**: `_context/CODE-MAP.md` ← **index.html 수정 전 필독**
- **마스터 룰 R1~R26**: `_context/RULES.md`
- **버그 사후 분석**: `_context/BUG-POSTMORTEM.md`
- **QA 체크리스트**: `_context/QA-CHECKLIST.md`
- **작업/백업/자료 분류 규칙**: `_context/working-rules.md`
- **기술 인사이트**: `_context/KNOWLEDGE-BASE.md`
- **지식 베이스 인덱스**: `_context/INDEX.md`

---

## 절대 규칙 (핵심만 — 상세는 RULES.md)

### R1. 버전 동기화 (6곳 필수)
버전 변경 시 6곳 모두 동일한 문자열:
1. `<title>` 태그
2. `#app-version-badge` 인라인 텍스트
3. `const APP_VERSION` JS 상수
4. `version.json` → `version`
5. `_context/CLAUDE.md` → `현재 버전`
6. `CHANGELOG.md` 최상단 항목

확인:
```bash
grep '<title>' index.html | head -1
grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
grep version version.json
grep '현재 버전' _context/CLAUDE.md
head -20 CHANGELOG.md | grep '## v'
```

### R2. 버전 체계
소수점 아래 1자리만: 31.1, 31.2, ..., 31.9, 32. **31.10 금지**.

### R3. 버그 수정 시 사후 분석 필수
모든 버그 수정 후 `_context/BUG-POSTMORTEM.md`에 기록 (형식은 RULES.md).

### R4~R26
상세 규칙은 `_context/RULES.md` 참조. 주요 축: 동적 DOM(R4), CSS overflow(R5), LLM 안전장치(R6), Dead Page 방지(R9), 종목코드 검증(R10~R12), CHAT_CONTEXTS 이원화(R13), 뉴스 키워드/티커(R14~R18), 데이터 경과일(R21), 뉴스 계층 선별(R22), 인덱스 자동 관리(R24), 버그 역참조(R25), 기술 인사이트 환류(R26).

---

## 작업 규칙 (핵심)

### 배포
- **자동 배포/커밋 금지** — 사용자가 명시적으로 요청할 때만 (/deploy 또는 "배포해줘")
- `index.html`이 곧 최신 버전 — 항상 이 파일에서 작업

### 코드 수정 시 자동 반영 (사용자 요청 없어도)
1. `_context/BUG-POSTMORTEM.md` — 버그 원인/수정/예방 기록
2. `_context/QA-CHECKLIST.md` — 새 검증 항목 추가
3. `_context/RULES.md` — 새 규칙/패턴 추가
4. 버전 6곳 동기화 (R1)

### index.html 수정 원칙
- **절대 전체 재작성 금지** — 38,250줄 단일 파일이므로 필요한 부분만 패치
- 수정 전 `_context/CODE-MAP.md`에서 해당 기능의 line 범위 확인 → Read offset/limit로 부분 읽기
- 이전 버전 백업(aio_ui_prototype_vXX.html)에 덮어쓰기 금지
- 자료 자동 분류 / 백업 관리 등 상세는 `_context/working-rules.md`

---

## 토큰 효율성

- 인사/칭찬/마무리 멘트 금지
- 질문 되풀이 금지 — 바로 답변/작업
- 요청 범위 외 제안/과잉 설계 금지
- 파일은 한 번만 읽기 (변경 의심 시 제외) — 특히 index.html은 CODE-MAP 기반 부분 읽기
- ASCII 우선 · 모르면 솔직히 말하기 (경로/함수명 날조 금지)

---

## 작업 유형별 읽을 파일

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| index.html 수정 | **CODE-MAP.md** → 해당 line 범위만 Read |
| 버그 수정 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 새 기능 추가 | RULES.md → working-rules.md → CODE-MAP.md |
| QA/점검 요청 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 리팩토링/개편 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md |
| 버전 릴리스 | RULES.md(R1~R2) → working-rules.md |
| 지식 린팅 | RULES.md(R19~R20) → `/knowledge-lint` 스킬 |
| 자료 통합 | working-rules.md(자료 자동 분류) → `/integrate` |
