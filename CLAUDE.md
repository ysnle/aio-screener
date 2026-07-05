# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v52.12**
- **전체 버전 이력 → CHANGELOG.md** (상세 변경 이력의 단일 출처). 아래는 **최근 버전 요약만** 유지한다.
- **v52.6 뉴스 번역 파이프라인 사망 원인 규명·수정(FABLE-LIVE-AUDIT-2026-07-04.md P1, P603)**: 감사가 근거로 든 "쿼터 미소진" 사이드바 UI는 AI 채팅 전용 로컬 카운터로 뉴스 번역과 무관함을 확인(추론 근거 아님). Google Translate 무료 경로는 직접 호출로 정상 작동 확인(200·유효 번역·CORS 허용) — 인프라 장애 아님. **실제 원인**: `_aioRenderPageNewsStrip`(macro/fxbond/technical/themes/sentiment/signal/fundamental/breadth 8개 페이지 공유 함수, 감사 지목 페이지 목록과 정확히 일치)이 페이지별 상위 4건을 뽑아 렌더링하면서 그 선택 항목에 번역을 요청하지 않음 — 초기 6건 배치에도 `data-news-idx` 지연로딩 옵저버에도 안 걸려 영구 미번역. 브리핑도 `renderBriefingFeed`/`_aioRenderBriefingDigest` 두 곳 동일 결함. **R245/P554(홈 "핵심 뉴스"에서 이미 고친 동일 버그 유형)가 이 9개 표면엔 미적용 상태였던 것**. 수정: 3곳에 R245와 동일한 "선택 항목 미캐시 시 즉시 번역 요청" 패턴 추가 + `autoTranslateNews` 완료 시 해당 위젯 재렌더 연결. 원문 헤드라인 폴백·프록시 페일오버 하드닝은 범위 밖으로 보류(사용자 확인).
- **v52.5 CI workflow_run 체크아웃 ref 근본 수정(FABLE-LIVE-AUDIT-2026-07-04.md P0, P602/R278)**: `ci.yml`의 validate/headless-tests/deploy 3개 job이 공통으로 쓰던 `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`가 원인 — `head_sha`는 트리거 run이 **시작된 시점**의 커밋으로 고정되어, refresh-data가 새 데이터를 push해도 CI는 항상 그 직전 커밋을 검증·배포함(실측: 11:56:57Z push된 `1df0078` vs deploy job이 실제 체크아웃한 `34646a82…` — 라이브는 새 배포 타임스탬프인데 내용은 구버전). `ref`를 `github.event_name == 'workflow_run' && github.event.workflow_run.head_branch || github.sha`로 변경(3곳) — workflow_run 이벤트는 브랜치 현재 헤드(=방금 push된 커밋), push/PR 경로는 무변경. 신규 R278. **로컬 검증 한계**: workflow_run 페이로드는 실제 Actions 실행에만 존재 — PyYAML 구문검증 + 로컬 validate 전체 + 헤드리스 1회(896/921, 회귀 0)까지 확인, 실효과는 다음 라이브 사이클에서 확인 필요.
- **v52.4 CI 배포 재시도 추가(P601/R277)**: `workflow_run` 트리거 도입 후 33시간 이력 전수 조사 결과 GitHub Pages 배포가 16회 중 4회(25%) 간헐 실패(`Deployment failed, try again later` — validate/헤드리스 테스트는 항상 통과, 리포 콘텐츠 문제 아님)했음을 확인. `data-watchdog.yml`이 잡은 9.8시간 라이브 신선도 지연 사례를 역추적해 같은 배포 실패가 근본 원인임을 실증(배포 실패와 데이터 지연은 같은 문제의 두 증상). `ci.yml` deploy job에 1차 실패 시 30초 대기 후 1회 재시도 추가, 둘 다 실패해야 최종 실패. `data-watchdog.yml` 360분 임계값은 정상 작동 중이라 그대로 유지.
- **v52.3 Phase 3 [A4] 완료 — 신규 코드 강제 RULES 추가(P600)**: Fable 로드맵 원문이 "전수 마이그레이션이 아니라 신규 코드 강제 RULES 추가 검토"라 명시한 대로, `_context/RULES.md` R276 신설(신규 코드는 `window.AIO.marketState`/`aio:marketStateUpdated` 구독 필수, 원시 전역 참조 후 독립 재계산 금지). 기존 `window.*` 참조(재측정 ~4,688건) 소급 마이그레이션은 장기전으로 의도적으로 보류. 순수 문서 변경, 런타임 로직 무변경. **Fable 5 2026-07-02 로드맵 Phase 0~3 전체 완료**(다음 진단 전까지 이 로드맵 기반 후속 작업 없음).
- **v52.2 Sonnet 5 Phase 3 [C3] 매매점수 검증 하네스(P599)**: 홈 화면 중심 지표 `computeTradingScore`는 스크리너 팩터와 달리 어떤 백테스트도 없었음. 신규 `scripts/backtest-trading-score.mjs`가 5개 서브스코어 계단함수를 순수 함수로 재구현(로직 무변경)해 `history.json`으로 매일 재구성 점수 vs forward 5/21일 SPX 수익률을 계산, `score-backtest-history.json`에 날짜별 누적(Phase 1 `updateBacktestHistory` 패턴). **착수 전 실측한 핵심 제약**: `fg`(모멘텀 유일 입력)가 201일 중 24일치뿐이고 전부 최근 구간이라, 실행 결과 `corr5d=-0.758(n=19)`·`corr21d=-1(n=3)` — `statisticallyMeaningful: false`. **이 숫자로 어떤 결론도 내리지 않음**(재튜닝 없음, 새 UI 패널 없음) — history.json이 계속 쌓이는 대로 표본이 자동 성장하는 인프라만 구축. 격리 유닛테스트 40건(전 계단 경계값)으로 재구현이 라이브 공식과 정확히 일치함을 확인 + 로컬 validate 전체 + 헤드리스 896/921(회귀 0). **Phase 3 [C3] 완료**(인프라 기준). 남은 Phase 3: A4(상태 단일화, "장기전"), 별도 계획 필요.
- v52.1 이하 전체 버전 이력(Phase 0~3 로드맵 진행 상세 포함) → `CHANGELOG.md`

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
