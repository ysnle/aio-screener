# AIO Screener — Claude Code 프로젝트 가이드

AIO Screener는 GitHub Pages로 배포 중인 **단일 HTML 올인원 투자 터미널**이다. 실시간 시세, 매매 시그널, 섹터 로테이션(RRG), Fear & Greed, 포트폴리오, LLM 채팅을 하나의 `index.html`에 담는다.

- 배포: `https://ysnle.github.io/aio-screener/`
- 현재 버전: **v52.26**
- **전체 버전 이력 → CHANGELOG.md** (상세 변경 이력의 단일 출처). 아래는 **최근 버전 요약만** 유지한다.
- **v52.7~v52.15 FABLE-LIVE-AUDIT-2026-07-04.md P2~P6 전체 완료(P604~P616)**: P0/P1(v52.5/52.6)에 이어 감사 백로그 마저 처리. **P5a**(P604/R279): 매크로 캘린더 auto-advance가 요일-고정 발표일(NFP)을 불가능한 요일로 미는 버그 — `_firstWeekdayOfMonth` 스냅 추가. **P5b**(P605/R280): VKOSPI 27.00 고정 표시의 진짜 원인은 시드 stale이 아니라 `fetchKrDynamicData`가 index.html/aio-data.js에 중복 선언돼 defer 로드 순서상 후자가 항상 이겨 VKOSPI 실시간 fetch가 영구 미실행이었던 것 — 최소 범위로 해당 fetch만 복구(다른 5개 orphan 함수는 미검증 상태로 범위 밖 유지). **P5c**(P606, R276 사례): themes 사이클 칩-본문 모순 — 동일 소스 구독 전환. **P5d**(P607, R261 사례): briefing/signal F&G phantom global(`_fearGreedValue`) → `_lastFG`. **P5e**(P608): briefing 헤더 단어 중간 잘림 — 단어경계+'…' 헬퍼. **P2**(P609): "30분마다" tooltip을 실제 cron 실발화(1~4h) 기준으로 정정. **P3**(P610, 사용자 명시 요청으로 재개): kr-technical TradingView KRX 하드 브레이크 — Naver 일봉+Chart.js 자체 캔들/거래량/MA20으로 완전 대체(신규 CDN 없음). **P6**(P611~616): PUBLIC STATUS 영문 로그 노출(R206 사례)·`:focus-visible` 오검출·AI 패널 공백+프롬프트 잔류·운영자 노트 경과일 배지·모바일 버튼 잘림 기계적 수정 5건 + 홈 경고 pill 11개 연속→1줄요약+펼치기(`<details>` 재사용, 사용자가 3안 중 확정) 1건. Telegram 페이지간 중복·FMP다운 컬럼 UX는 사용자가 현행 유지로 확정(코드 변경 없음). 전 항목 헤드리스 899/922(스킵리스트 T278/T422 해소로 제거) 확인, **단 Chrome 확장 미연결로 이번 세션 UI 변경 전체의 실브라우저 시각 확인은 QA-CHECKLIST 잔여 항목**.
- v52.6 이하 전체 버전 이력(P0/P1 뉴스번역·CI워크플로 수정, Phase 0~3 로드맵 진행 상세 포함) → `CHANGELOG.md`
- **v52.24~v52.26 FABLE-LIVE-AUDIT-2026-07-07.md Phase L0~L4 전체 실행(P634~P641)**: 감사 작성 직후 같은 세션에서 즉시 착수해 L0~L4 전 항목 완료. **C3**(P634/신규 R282): VIX 기간구조가 live VIX를 정체 시드 VIX9D(18.80)와 비교해 실제 콘탱고를 패닉 백워데이션으로 오판정 — live 소스일 때만 방향 판정하게 게이트. **C4**(P635): VKOSPI 폴백 시드에 단정 "(정상)" 라벨 — "(폴백·정상 추정)"으로 정직화. **C5**(P636): Yahoo `^KS11` 전일종가가 미국 휴장 인접 주간에 한 세션 어긋나던 문제 — Naver 파생값을 sticky 우선. **C2**(P637): 번역 실패 시 일반 템플릿 대신 `freeTranslateNews`(Google Translate) 경유로 실제 헤드라인 확보. **C1**(P638): 배포 워커가 리포의 `/anthropic` 라우트보다 구버전임을 확정 → **같은 날 운영자가 Worker 재배포+`ANTHROPIC_API_KEY` 시크릿 추가로 완전 해소**(curl+라이브 브리핑 실렌더로 확인; `DEFERRED-BLOCKS.md` B5도 해소 처리). **C6 분석**: TruthGate 코드 정독 결과 "동행 급변 예외" 신설 불필요로 결론(기존 로직 타당, 오탐 원인은 C5). **L3-1/L2-3 재확인**: R280 게이트+KR 고아 함수 5개 정리는 **이미 v52.19(P626)에서 완료**돼 있었음을 발견(감사 문서 §5 우선순위표가 그 시점엔 낡은 정보였음 — 자기 정정). **L3-2**(P639): 티커 "시장 74점" vs 시그널 "56" 라벨 모순 — 로직은 타당했고 라벨만 "시장 건강도"로 명확화. **F3**(P640): kr-technical 설명문 TradingView 잔여 문구 정정. **L4-2**(P641): VKOSPI 미니차트가 "공유 확장 헬퍼" 때문이라고 봤던 중간 추정을 정정 — 실제로는 v50.15부터 굳어있던 하드코딩 20포인트 배열이었고 서버 history.json엔 vkospi 필드 자체가 없었음. 서버 크론 대신 클라이언트 localStorage 누적으로 안전하게 수정, 로컬 정적서버로 배포 전 실브라우저 검증(캔버스 픽셀 직접 판독 포함) 완료. 검증: 로컬 8게이트+헤드리스 922/922(전 배치 공통). 상세: `_context/FABLE-LIVE-AUDIT-2026-07-07.md` §6.
- **차기 작업 진입점**: `_context/FABLE-LIVE-AUDIT-2026-07-07.md` §6 이후 — **L4 잔여**(다른 소규모 참조차트 개별 점검 — VKOSPI건은 "공유 헬퍼"가 아니었으므로 일반화된 패턴을 가정하지 말 것, 자가진단→운영 루프 연결) → **L5**(운영자 협의 필요 항목, 아시아 세션 리스크 입력 등). 선행 문서: `FABLE-ARCH-DIAGNOSIS-2026-07-06.md`(정적 진단, Phase 0~4 로드맵).

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
