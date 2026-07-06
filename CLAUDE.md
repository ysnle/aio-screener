# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v52.19**
- **전체 버전 이력 → CHANGELOG.md** (상세 변경 이력의 단일 출처). 아래는 **최근 버전 요약만** 유지한다.
- **v52.7~v52.15 FABLE-LIVE-AUDIT-2026-07-04.md P2~P6 전체 완료(P604~P616)**: P0/P1(v52.5/52.6)에 이어 감사 백로그 마저 처리. **P5a**(P604/R279): 매크로 캘린더 auto-advance가 요일-고정 발표일(NFP)을 불가능한 요일로 미는 버그 — `_firstWeekdayOfMonth` 스냅 추가. **P5b**(P605/R280): VKOSPI 27.00 고정 표시의 진짜 원인은 시드 stale이 아니라 `fetchKrDynamicData`가 index.html/aio-data.js에 중복 선언돼 defer 로드 순서상 후자가 항상 이겨 VKOSPI 실시간 fetch가 영구 미실행이었던 것 — 최소 범위로 해당 fetch만 복구(다른 5개 orphan 함수는 미검증 상태로 범위 밖 유지). **P5c**(P606, R276 사례): themes 사이클 칩-본문 모순 — 동일 소스 구독 전환. **P5d**(P607, R261 사례): briefing/signal F&G phantom global(`_fearGreedValue`) → `_lastFG`. **P5e**(P608): briefing 헤더 단어 중간 잘림 — 단어경계+'…' 헬퍼. **P2**(P609): "30분마다" tooltip을 실제 cron 실발화(1~4h) 기준으로 정정. **P3**(P610, 사용자 명시 요청으로 재개): kr-technical TradingView KRX 하드 브레이크 — Naver 일봉+Chart.js 자체 캔들/거래량/MA20으로 완전 대체(신규 CDN 없음). **P6**(P611~616): PUBLIC STATUS 영문 로그 노출(R206 사례)·`:focus-visible` 오검출·AI 패널 공백+프롬프트 잔류·운영자 노트 경과일 배지·모바일 버튼 잘림 기계적 수정 5건 + 홈 경고 pill 11개 연속→1줄요약+펼치기(`<details>` 재사용, 사용자가 3안 중 확정) 1건. Telegram 페이지간 중복·FMP다운 컬럼 UX는 사용자가 현행 유지로 확정(코드 변경 없음). 전 항목 헤드리스 899/922(스킵리스트 T278/T422 해소로 제거) 확인, **단 Chrome 확장 미연결로 이번 세션 UI 변경 전체의 실브라우저 시각 확인은 QA-CHECKLIST 잔여 항목**.
- v52.6 이하 전체 버전 이력(P0/P1 뉴스번역·CI워크플로 수정, Phase 0~3 로드맵 진행 상세 포함) → `CHANGELOG.md`
- **차기 작업 진입점**: `_context/FABLE-ARCH-DIAGNOSIS-2026-07-06.md` — 2026-07-06 전수 아키텍처 진단(7축 스코어카드·커버리지 정직표·07-02 진단 해소 8건 코드 대조·헤드리스 899/922 재현 실측) + Sonnet 5 인수인계 로드맵 Phase 0~4. 시작은 Phase 0-1(R280 기계 게이트) → 0-2(`fetchKrDynamicData` 그림자 선언 정리) 순.

- 메인 파일: `index.html` (집계는 `_context/CODE-MAP.md` 기준 유지, 인라인 onclick 0건) + `js/` 6개 모듈
- 스택: HTML5 + 인라인 CSS/JS · Chart.js(CDN) · AES-256 · GitHub Pages · 한국어 UI · 다크 테마 · WCAG AA

---

## 작업 유형별 읽을 파일

| 작업 | 읽을 파일 |
|------|----------|
| **index.html 수정** | `_context/CODE-MAP.md` → 해당 line 범위만 Read |
| **버그 수정** | `_context/RULES.md` → `BUG-POSTMORTEM.md` → `QA-CHECKLIST.md` |
| **새 기능** | `_context/RULES.md` → `_context/CODE-MAP.md` → `_context/WORKTREE-AUDIT.md`(워크트리/배포 영향 시) |
| **QA/점검** | `_context/RULES.md` → `BUG-POSTMORTEM.md` → `QA-CHECKLIST.md` |
| **자료 통합** | `/integrate` 스킬 (→ `CHANGELOG.md` + `_context/KNOWLEDGE-BASE.md` 환류) |
| **데이터 갱신** | `/data-refresh` 스킬 |
| **지식 린팅** | `/knowledge-lint` 스킬 |

상세 문서: `_context/CLAUDE.md` (파일 구조 · Hook · Commands↔Skills 매핑 · 복리 루프)

---

## 절대 규칙 (R1~R3만 — 나머지 R4~R263+는 `_context/RULES.md`)

**R1. 버전 동기화**: title · badge · APP_VERSION · version.json · sw.js SW_VERSION · root/context docs · CHANGELOG.md · JS cachebusters — **반드시 `node scripts/bump-version.mjs <버전>`으로 일괄 패치** (v51.64~)
**R2. 버전 체계**: `v{major}.{patch}` 숫자 단조 증가 (예: v48.76 → v48.77). 최신 실제 체계는 두 자리 patch 허용.
**R3. 버그 수정 시 사후 분석**: `_context/BUG-POSTMORTEM.md`에 P번호 기록
**R27. Commands↔Skills 동기화**: 새 스킬 시 command wrapper 동시 생성

---

## 작업 규칙

- **자동 배포/커밋 금지** — `/deploy` 또는 "배포해줘" 명시 시에만
- **전체 재작성 금지** — CODE-MAP.md 기반 부분 패치만
- **코드 수정 시 자동 반영**: BUG-POSTMORTEM + QA-CHECKLIST + RULES + 버전 7곳 동기화

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

에러 복리 방지: `/knowledge-lint` 주기적 실행 (주 1회+). 코드 확인 없이 추측 판단 금지.

---

## 토큰 효율성

- 인사/칭찬/마무리 멘트 금지 · 질문 되풀이 금지 — 바로 작업
- 요청 범위 외 제안/과잉 설계 금지
- index.html은 CODE-MAP 기반 부분 읽기 · 파일은 한 번만 읽기
- 모르면 솔직히 말하기 (경로/함수명 날조 금지)
