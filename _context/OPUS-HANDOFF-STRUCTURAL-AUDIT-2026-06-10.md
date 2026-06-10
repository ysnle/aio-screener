---
verified_by: agent (Fable 5, 라이브 구동 + GitHub API + 정적 실측)
audit_date: 2026-06-10
target_version: v50.23
confidence: high (모든 수치 실측 — 추정치는 "추정" 명기)
purpose: Opus 작업 세션 핸드오프 — 이 문서만으로 cold start 작업 가능
---

# AIO Screener 구조 전수 감사 + Opus 작업 지시서 (2026-06-10)

## 진행 상태 (2026-06-10 업데이트 — Opus 세션)

| WO | 상태 | 배포 |
|----|------|------|
| WO-1 cron 신뢰도 + 워치독 + fetch 호스트 폴백 | ✅ 완료 | v50.24 + ops(refresh/watchdog yml, fetch-data.mjs) |
| WO-2 ATH 레짐 버그 (P498) | ✅ 완료 | v50.24 |
| WO-3 refresh 매핑 (P499) | ✅ 완료 | v50.24 |
| WO-4 데이터 신선도 배지 + 주기 재로드 | ✅ 완료 | v50.24 |
| WO-5 정적 내러티브 레짐 드리프트 가드 | ✅ 완료 | v50.25 |
| WO-7 히스토리 축적 (생산자) | ✅ 완료·**prod 검증** | ops(fetch-data.mjs). 2026-06-10 12:46Z cron이 history.json 첫 생성 확인. **소비자(차트 연결)는 미완** — 30일 누적 후 진행 |
| WO-8 CI 게이트 (구문/버전/stray) | ✅ 완료·**CI green** | ops(.github/workflows/ci.yml + scripts/ci-version-check.mjs). 매 push green |
| WO-11 초보자 태스크 중심 홈 | ✅ 완료(시작 패널) | v50.26 #aio-beginner-panel 3대 질문. **전면 홈 재구조화는 후속** |
| WO-6 뉴스 백엔드 이전 | ⬜ 미착수 — 다음 권장 (검증된 서버 fetch 패턴 확장, 저위험) | |
| WO-7 소비자 (차트 history.json 연결) | ⬜ 미착수 — 히스토리 ~30일 누적 후 | |
| WO-9 페이로드 다이어트 | ⬜ 미착수 (위험 — script 로드 순서) | |
| WO-10 Claude 키 서버화 (Worker) | ⬜ 미착수 (**Cloudflare 운영자 설정 필요** — 로컬 검증 불가) | |
| WO-12~14 문서/audit 위생 | ⬜ 부분 | |

**prod 실측 검증(2026-06-10)**: cron 발화(05:11Z·12:46Z 성공) + history.json 첫 레코드 생성 + CI 전 push green + v50.26 라이브 + 레짐 드리프트 배너(F&G 탐욕→공포) + 초보자 패널 요약 동작 = 모두 확인.

부수 완료: R206 `getVisibleDevMarkerAudit`에서 `\bprominent\b` 오탐 제거(T776 안정화). P498/P499 BUG-POSTMORTEM 기록.


## 0. 이 문서의 목적

Fable 5 세션에서 수행한 **백엔드/프론트엔드/데이터 파이프라인/초보자 UX/자동 운영** 전수 조사 결과와,
이를 기반으로 한 **우선순위 작업 백로그(WO-1~WO-14)**다. Opus는 §5 백로그를 위에서부터 순서대로 진행하면 된다.
각 WO에 대상 파일·수용 기준·위험을 명기했다.

**작업 시 절대 준수** (루트 `CLAUDE.md`):
- R1 버전 동기화 7곳 (title · badge · APP_VERSION · version.json · sw.js SW_VERSION · _context/CLAUDE.md · CHANGELOG.md) + 캐시버스터 6곳 (`?v=` js 스크립트 태그)
- 자동 배포/커밋 금지 — 사용자가 `/deploy` 명시할 때만
- 전체 재작성 금지 — `_context/CODE-MAP.md` 기반 부분 패치
- 버그 수정 시 `_context/BUG-POSTMORTEM.md`에 P번호 기록

---

## 1. 조사 방법 (재현 가능)

| 방법 | 대상 |
|---|---|
| 정적 실측 | 파일 크기/gzip, 줄 수, 데이터 sink 카운트 (PowerShell) |
| GitHub API | `refresh-data.yml` workflow run 이력, 라이브 `data.json` meta, repo fork 여부 |
| 라이브 구동 검증 | `localhost:8080` (python http.server, v50.23 확인). **SW unregister + caches.delete 후 fresh reload** (프로젝트 교훈 준수). 콘솔 로그, 자체 감사 실행, DOM 측정, 모바일(375px) 리사이즈 |
| 앱 자체 감사 | `AIO.getAutoOpsReadiness()` 실행 결과 수집 |
| 코드 추적 | 화면에서 발견된 모순(ATH 레짐)을 코드 라인까지 역추적 |

> 주의: preview 서버 루트는 메인 작업본이었음(코드는 동일 v50.23, `public-data/data.json`만 23심볼 시드 버전).
> 라이브 사이트의 data.json은 74심볼 버전으로 별도 확인함.

---

## 2. 실측 수치 (Evidence Table)

### 2.1 페이로드 (gzip은 GitHub Pages 전송 추정치)

| 파일 | raw | gzip |
|---|---|---|
| index.html (29,296줄) | 2,254 KB | 603 KB |
| js/aio-core.js (19,635줄) | 1,180 KB | 322 KB |
| js/aio-data.js (13,186줄) | 927 KB | 284 KB |
| js/aio-chat.js (6,870줄) | 517 KB | 155 KB |
| js/aio-tests.js (5,006줄) | **394 KB** | **102 KB** ← 테스트 코드가 전 사용자에게 배송됨 |
| js/aio-ui.js | 181 KB | 47 KB |
| js/aio-glossary.js | 56 KB | 21 KB |
| **합계** | **5,510 KB** | **1,534 KB** |

- 로컬 서버 기준 부팅: DOMContentLoaded 2,470ms · load 4,984ms · 리소스 250개 · 전송 2,616KB. **프로덕션(원격+콜드캐시)은 이보다 느림.**
- 로컬 스크립트 6개에 `defer` 없음 (CDN 3개만 defer) → HTML 파싱 블로킹.
- DOM 상주 노드 10,998개 (21페이지 전체가 DOM에 항시 존재). preview 스크린샷 캡처가 30s 타임아웃 2회 — 렌더러 부하 신호.

### 2.2 데이터 바인딩 표면

| sink | 개수 |
|---|---|
| `data-live-price` | 149 |
| `data-live-chg` | 112 |
| `data-snap=` | 96 |
| `data-action=` | 338 |
| `<canvas` | 39 |
| `<table` | 34 |

### 2.3 데이터 백엔드 (v50.23)

- `scripts/fetch-data.mjs`: Yahoo 74심볼 + FRED 7시리즈(키 필요) + CNN F&G → `public-data/data.json`. 수동 실행 검증: 74/74 성공, 2.1초.
- **GitHub Actions cron(`*/30`) 실제 발화: 0회.** workflow run 이력 = `workflow_dispatch`(수동) 1회뿐 (2026-06-10 01:29Z). 01:29Z 등록 후 04:30Z까지 약 3시간 동안 예정 6회 모두 미발화. repo는 fork 아님, default branch main, Actions 활성(수동 실행은 성공).
- 사이트 로더 `_aioLoadServerData` ([js/aio-data.js:4372](../js/aio-data.js)): **부팅 시 1회만** 로드. `ageMin` 계산하지만(L4380) **화면에 표시하지 않음**. 주기 재fetch 없음.
- fetch 스크립트 실패 처리: 심볼 50%+ 실패 시에만 exit(1). **F&G 실패(`cnn:fail`)·FRED 시리즈 실패는 조용히 통과.**
- data.json은 매 실행 **덮어쓰기** — 히스토리 축적 없음.

### 2.4 라이브 구동 결과 (2026-06-10, 급락장 당일)

- 콘솔 **에러 0건** / 경고 다수(프록시 다운, CBOE PCR 실패→snapshot 강등, FRED 키 없음)
- 서버 데이터 적용 확인: SPX 7,386.65 (-2.93%) · VIX 19.87 (+23.7%) · F&G 34 화면 반영 ✓
- 뉴스 파이프라인 작동: DOM에 150건, 최신 "미국-이란 충돌(CENTCOM)" 5시간 전 ✓ — **오늘 급락의 원인 이벤트가 뉴스에는 있음**
- `AIO.getAutoOpsReadiness()` = **status: warn, 14개 이슈** (§3에 상세)
- 모바일(375px): 가로 오버플로 0, 사이드바 숨김+햄버거 정상

### 2.5 운영 문서 무게

CHANGELOG 1,045KB · BUG-POSTMORTEM 494KB(P1~P497) · RULES 184KB(R1~R207) · 루트 CLAUDE.md 129KB · aio-tests.js 836 테스트(브라우저 전용, CI 없음).

---

## 3. CRITICAL 발견 (P0) — 즉시 작업 대상

### C1. 자율 운영 미완성: cron 0회 발화 + 감시 장치 0

"v50.23 진짜 자율 운영 전환"은 **아직 프로덕션에서 사실이 아니다.** 30분 cron이 등록 후 한 번도 자동 실행되지 않았고
(§2.3), 라이브 data.json은 계속 stale해지는 중이다. 더 심각한 구조 문제: **cron이 죽어도 아무도 모른다** —
이전 CORS 프록시가 조용히 죽던 것과 동일한 실패 클래스가 백엔드에서 재현된 것.

원인 후보 (Opus가 순서대로 점검):
1. GitHub은 새로 추가된 schedule 워크플로 등록에 지연이 있고, `*/30` 같은 고빈도 cron은 상시 지연/드랍됨(실제 45~90분 간격이 보통). 그러나 3시간 0회는 비정상 — Actions 탭에서 schedule 비활성 공지 확인.
2. 워크플로 파일을 한 번 더 커밋(touch)하면 schedule 재등록되는 사례가 많음.
3. 근본 대안: cron을 `0,30 * * * *` 또는 1시간으로 완화 + **외부 트리거 보강**(예: 두 번째 워크플로가 data.json age 검사).

### C2. ATH 레짐 버그 — 오늘 홈 화면에 실증 노출 중

화면 동시 표시: SPX **-2.93%** (라이브) vs 시장 레짐 **"ATH -0.4% · Near ATH"** (모순).

원인 확정 ([js/aio-data.js:12303](../js/aio-data.js)):
```js
window._spxATH = Math.max(window._spxATH || 7412.84, q.regularMarketPrice);
```
- 하드코딩 `7412.84`는 stale ATH (실제 `DATA_SNAPSHOT.spxATH` = 7585).
- 7386.65/7412.84 - 1 = -0.35% → "ATH -0.4%" 표시. 실제 갭은 -2.6%.
- **v50.16에서 같은 패턴의 L13125는 시정**(`window._spxATH || DATA_SNAPSHOT.spxATH || 7585`)됐으나,
  **먼저 실행되어 `window._spxATH`를 오염시키는 L12303은 미시정** — 중복 로직의 한쪽만 고쳐진 사례.
- 시정: L12303을 `Math.max(window._spxATH || (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT.spxATH) || 7585, q.regularMarketPrice)`로.
- **재발 방지**: `7412.84`/ATH 하드코딩 전수 grep + "동일 값의 중복 정의 금지(단일 출처)" 패턴을 audit에 추가. P번호 기록 필수.

### C3. "숫자는 자동, 내러티브는 수동" — stale 내러티브의 구조 미해결 (오늘이 실증)

오늘(6/10) 미국-이란 충돌로 SPX -2.9%·Nasdaq -5.2%·VIX +23.7% 급락. 사이트 상태:
- 뉴스 피드: 충돌 소식 정상 표시 (5시간 전) ✓
- 그러나 topbar "매크로 ● UPTREND", 시장폭 "52%"(6/5 스냅샷), 레짐 "Near ATH"(C2),
  시나리오·브리핑·DATA_SNAPSHOT 내러티브는 6/5~6/8 "사상최고 랠리·NVIDIA 블리츠" 전제 그대로.
- v50.16~50.22에서 6개 버전에 걸쳐 stale 내러티브를 손으로 고쳤지만, **내러티브가 Claude 세션 시점에
  하드코딩되는 구조**가 원인이므로 시장이 급변할 때마다 (= 가장 중요한 순간마다) 재발한다. 초보자에게 최위험 결함.

구조적 해법 (WO-4): 모든 정적 내러티브 블록에 **작성 시점 레짐 스탬프** (당시 VIX/SPX/F&G) 의무화 →
렌더 시 현재값과 비교해 괴리 임계(예: VIX ±30%, SPX ±2%, F&G ±20pt) 초과 시 자동으로
"참고(작성 시점과 시장 급변)" 배지 + 시각 강등. 기존 `getEventTimelineStalenessAudit`(날짜 기반)의 레짐 기반 일반화.

### C4. 7개 페이지의 진입 시 refresh가 존재하지 않는 task를 참조 (자체 감사가 이미 경고 중)

`AIO.getAutoOpsReadiness()` 실측:
```
theme-detail→themeRanking (unknown task), portfolio→portfolioRisk (unknown task),
ticker→companyFundamentals (unknown task), ticker→filings (unknown task),
options→optionsSnapshot (unknown task), kr-themes→themeRanking (unknown task),
kr-macro→krMacro (unknown task)
```
`AIO_PAGE_REFRESH_MAP`이 `REFRESH_SCHEDULE`에 없는 task 키를 참조 → 해당 7페이지는 진입 시 자동 갱신이 no-op.
시정: 키를 실제 task로 매핑하거나 task 신설. 수용 기준: autoOps 해당 이슈 0.

### C5. 배포 게이트 FAIL인데 강제력 없음

자체 감사 실측: `v50 evidence deployment gate fail: critical page blocked evidence: home:1, signal:31,
sentiment:3, macro:4, fxbond:16, themes:12` + `398 truth-blocked market data symbols` + `2114 evidence items 미리뷰`.
게이트·트루스게이트·audit 인프라는 훌륭하게 작동하며 정확히 경고하고 있으나, **결과가 콘솔 warn으로만 흘러가고
아무것도 막지 않는다.** 구조적 해법 = CI 게이트(WO-8) + 게이트 fail 항목의 실제 소진(블록 67건 우선).

---

## 4. 구조 영역별 발견 (P1~P3)

### 4.1 데이터 백엔드 — 커버리지가 시세·FRED·F&G에서 멈춤

여전히 클라이언트 CORS 프록시/수동 의존인 것:
| 데이터 | 현재 경로 | 백엔드 이전 가능성 |
|---|---|---|
| 뉴스 RSS 60+ 소스 | 클라이언트 프록시 (자주 죽는 경로, 라이브에서 corsproxy/codetabs disabled 실측) | **가능** — 서버에서 RSS는 CORS 없음 |
| OHLCV 히스토리 (차트/기술지표) | 클라이언트 Yahoo 프록시 | **가능** — 핵심 심볼 일봉을 data.json 동봉 |
| CBOE PCR | 클라이언트 (라이브에서 실패→snapshot 강등 실측) | **가능** |
| VKOSPI | 네이버 클라이언트 | 가능 |
| breadth %aboveMA, AAII, NAAIM | 주간 수동 WebSearch | **불가능(무료 자동 소스 없음)** — 정직 한계 유지 |

추가 갭:
- **히스토리 미축적**: data.json 덮어쓰기 → 52주 VIX(IV Rank), breadth 사이클, F&G 추이가 하드코딩 시드 의존.
  하루 1회 `public-data/history.json`에 일별 스냅샷 append하면 해결 (기관급 차트의 실질 기반).
- **boot-only 로드**: 탭 열어두면 data.json 재로드 없음 → 30분 주기 재fetch 추가 (몇 줄).
- **F&G/FRED 실패 무감지**: meta에 실패 필드 추가 + 워크플로에서 검사.
- git-as-DB 트레이드오프: cron 정상화 시 연 ~17K 커밋. 당장은 수용 가능, 장기적으로 데이터 전용 브랜치 검토.

### 4.2 프론트엔드/성능

- aio-tests.js 394KB(gzip 102KB)가 전 방문자에게 배송 + 일반 사용자 브라우저에서 파싱됨. **개발자 모드에서만 동적 import**로 전환.
- 로컬 스크립트 6개 `defer` 부재 → 603KB HTML 파싱과 3.2MB JS 파싱이 직렬 블로킹.
- 21페이지 전체 DOM 상주(11K 노드) + canvas 39 + 타이머 9. 스크린샷 캡처 타임아웃이 시사하듯 무거움.
  장기: 페이지 lazy-render (진입 시 DOM 생성). 단기: 비활성 페이지 차트 destroy 확인.
- SW 캐시 stale 사고 반복 이력(P310, P311, v50.14/50.16/50.18 교훈) — 빌드 해시 없는 수동 `?v=` 캐시버스터가 근본 원인. CI 도입 시 자동화.

### 4.3 데이터 정합성/출처

- **중복 로직 = 최대 리스크 클래스** (C2가 표본): 같은 값(ATH, breadth, 임계값)이 여러 곳에 정의되어
  한쪽만 고쳐지는 버그가 반복됨 (v50.16~22에서 발견된 verdict 부호/property 불일치도 동족).
  audit으로 사후 검출하는 것보다 **단일 출처 상수/함수로 통합**이 근본.
- truth-blocked 398심볼 실측 — 프록시 사망 시 cross-validation이 대량 차단(정확한 동작)하지만,
  사용자에게는 구분 표시가 약함. data.json이 정상화되면 대부분 해소될 것.
- 출처 표시는 인프라(lineage/data-source 속성)가 잘 깔려 있음. 사용자 가시화(출처 툴팁 일관성)는 양호.

### 4.4 AI 채팅 — 키 배포 모델이 구조 한계

- 공유 유료 Claude 키를 각 사용자 localStorage에 입력: 유출 위험 + 쿼터 클라이언트 강제 불가 + **초보자 최대 진입장벽**.
- localStorage AES는 키가 클라이언트 코드에 있어 사실상 난독화.
- `_context/CLAUDE.md`가 언급하는 `cloudflare-worker-proxy.js`는 **repo에 없음**(P310 일괄 삭제 때 소실 추정).
- 구조 해법: Cloudflare Worker 무료 티어 프록시 (키는 Worker secret, 일일 한도 서버 강제, 허용 origin 제한).
  사용자는 키 입력 없이 채팅 사용 가능 → 초보자 온보딩 해결과 직결.

### 4.5 초보자 UX — "주석"은 충분, "구조"가 전문가용

실측:
- 사이드바 가시 내비 타겟 67개, 페이지 메뉴 19개, **API 키 입력칸 7개**(Finnhub/FRED/TwelveData/FMP/NewsData/BOK ECOS/KOSIS)가 사이드바에 상시 노출.
- 홈 페이지: 최상위 섹션 17개, 스크롤 2,757px, 가시 텍스트 8,760자.
- 메뉴 라벨: "시장 폭", "수급 분석", "옵션", "환율 · 채권" — 초보자가 어디부터 갈지 알 수 없는 지표 중심 IA.
- 잘 된 것: 온보딩 배너 존재, 한글화, 용어집 267개, 모바일 기본기, 페이지별 목적 헤더.

구조적 방향 (WO-11):
1. API 키 7칸을 "고급 설정" 접기로 이동 (기본 숨김) — 키 없이도 data.json 기반으로 작동함을 명확히.
2. 홈 최상단을 초보자 3질문 중심으로 재조립: **"오늘 시장 어때/뭘 조심해" / "이 종목 사도 돼?" / "내 포트폴리오 괜찮아?"** — 기존 페이지 재활용(새 기능 아님), 각 질문이 해당 페이지 1곳으로 안내.
3. 초보/고급 모드 토글(이미 v49.83에 사이드바 모드 토글 인프라 존재 — 페이지 콘텐츠까지 확장).

### 4.6 품질 게이트/CI — 전부 런타임 자체감사, 강제 게이트 0

- 836 테스트·200+ 규칙·수십 audit이 모두 브라우저 콘솔 수동 실행. P311(SyntaxError로 파이프라인 전체 마비)은 `node --check` 한 줄이면 push 시점에 잡혔음.
- Actions에 Node 이미 있음 → 최소 CI: ① `node --check js/*.js` ② `scripts/fetch-data.mjs` 스모크 ③ 버전 동기화 7곳 grep 검증 ④ (확장) Playwright로 부팅 후 콘솔 에러 0 + `AIO.runTests()` 스모크.

### 4.7 유지보수성/프로세스

- 문서가 코드보다 빨리 자람: CHANGELOG 1MB+, POSTMORTEM 494KB, 루트 CLAUDE.md 129KB → 매 Claude 세션 컨텍스트 비용. 루트 CLAUDE.md는 최근 3~5버전 + 핵심 규칙만 남기고 아카이브 분리 권장.
- audit 함수 세대 중첩 (critical-10 계열만 5세대: v49.107~112 + v50.0 게이트). 통폐합 대상.
- index.html 29K줄 인라인 JS — CODE-MAP 의존 작업은 한계. 장기적으로 페이지 단위 모듈 분리 지속.

---

## 5. Opus 작업 백로그 (우선순위순)

> 각 WO 완료 시: P번호 기록(버그인 경우) + 관련 테스트 추가 + R1 버전 동기화. 배포는 사용자 승인 후.

### P0 — 자율 운영 완성 + 라이브 버그 (즉시)

**WO-1. cron 발화 진단/복구 + 데이터 신선도 워치독**
- 대상: `.github/workflows/refresh-data.yml`, 신규 워치독 로직
- 할 일: ① cron 미발화 원인 점검(§C1 순서) — 워크플로 파일 touch 재커밋 포함 ② cron `*/30`→`17,47 * * * *`(정시 혼잡 회피) 조정 검토 ③ fetch-data.mjs에 F&G/FRED 실패를 meta에 노출하고 워크플로 step에서 검사 ④ (선택) 별도 경량 워크플로: data.json `generatedAt`이 3시간+ stale이면 워크플로 fail → GitHub 자동 이메일 알림
- 수용 기준: scheduled run이 연속 3회+ 실제 발화 확인. 실패 시 운영자가 알 수 있는 경로 1개 이상.

**WO-2. ATH 레짐 버그 시정 (P번호 신규)**
- 대상: [js/aio-data.js:12303](../js/aio-data.js)
- 할 일: §C2 시정 + `7412\.84` 전수 grep + ATH 단일 출처화(헬퍼 함수) + 회귀 테스트(T 신규: `_spxATH >= DATA_SNAPSHOT.spxATH`)
- 수용 기준: SPX < ATH-2% 상황에서 레짐 라벨이 "Near ATH"가 아닐 것.

**WO-3. 7개 페이지 refresh 매핑 시정 (P번호 신규)**
- 대상: `AIO_PAGE_REFRESH_MAP` / `REFRESH_SCHEDULE` (aio-core.js 또는 aio-data.js — `unknown task` 문자열로 위치 추적)
- 할 일: §C4의 7개 매핑을 실제 task로 연결. 수용 기준: `getAutoOpsReadiness()`에서 해당 이슈 0.

**WO-4. data.json 신선도 표면화 + 주기 재로드**
- 대상: `_aioLoadServerData` ([js/aio-data.js:4372](../js/aio-data.js)), topbar/사이드바 UI
- 할 일: ① `ageMin`을 topbar 배지로 표시("서버 데이터 N분 전") — 60분+ amber, 3시간+ red ② 30분 간격 재fetch(`_aioRegisterTimer` 사용) ③ `aio:serverDataLoaded` 이벤트에 내러티브 갱신(`refreshActivePageNarratives`) 연결 확인
- 수용 기준: 사용자가 데이터 나이를 항상 볼 수 있음.

### P1 — stale 내러티브 구조 차단 + 백엔드 확장

**WO-5. 내러티브 레짐 스탬프 + 자동 강등 (C3 구조 해법)**
- 대상: DATA_SNAPSHOT 내러티브 필드, AIO_SCENARIO_REGISTRY, HOME_WEEKLY_NEWS, briefing 정적 블록
- 할 일: 정적 내러티브 블록에 `_regimeStamp: {vix, spx, fg, date}` 의무화 → 렌더 시 현재값과 비교, 임계 초과 시 "⚠ 작성 시점과 시장 급변 — 참고용" 배지 + 시각 강등. audit(`getNarrativeRegimeDriftAudit` 신규)로 미스탬프 블록 검출.
- 수용 기준: VIX +30% 급변 시뮬레이션에서 6/8자 랠리 내러티브가 자동 강등될 것.

**WO-6. 뉴스 수집 백엔드 이전**
- 대상: `scripts/fetch-data.mjs`(또는 분리 `fetch-news.mjs`), 사이트 뉴스 로더
- 할 일: 핵심 RSS/텔레그램 t.me/s 소스를 서버에서 수집 → `public-data/news.json` → 클라이언트는 동일출처 우선 로드, 프록시는 폴백 강등 (v50.23 시세 패턴 그대로).
- 수용 기준: 프록시 전멸 상태에서도 뉴스 표시.

**WO-7. 히스토리 축적 (`history.json`)**
- 대상: fetch-data.mjs + 신규 일별 append 로직 + 차트 소비처
- 할 일: 하루 1회(미국장 마감 후) 핵심 지표(SPX/VIX/F&G/금리/breadth 가용분) append. IV Rank·F&G 추이·VIX 퍼센타일이 이 파일 우선 사용.
- 수용 기준: 30일 후 차트가 시드 배열 대신 실데이터 사용 가능 구조.

### P2 — 품질 게이트 + 성능 + 채팅 구조

**WO-8. CI 게이트 신설**
- 대상: `.github/workflows/ci.yml` 신규
- 할 일: push/PR 시 ① `node --check` 전 JS ② fetch-data.mjs 스모크(네트워크 실패 허용 분기) ③ 버전 동기화 7곳 일치 grep ④ (확장) Playwright 부팅 스모크.
- 수용 기준: P311급 SyntaxError가 push 시점에 차단됨.

**WO-9. 페이로드 다이어트**
- 대상: index.html 스크립트 태그, aio-tests.js 로드 방식
- 할 일: ① aio-tests.js를 기본 미로드 — 개발자 모드/콘솔 `AIO.loadTests()`에서 동적 import ② 로컬 스크립트 `defer` (실행 순서 의존성 검증 필수 — aio-core→data→ui→chat 순서 유지) ③ sw.js 프리캐시 목록 정합.
- 수용 기준: 일반 방문자 전송량 100KB+ 감소, 콘솔 에러 0, runTests 통과(개발자 모드).

**WO-10. Claude 키 서버화 (Cloudflare Worker 프록시 부활)**
- 대상: 신규 `cloudflare-worker-proxy.js`(소실 파일 재작성) + aio-chat.js 호출 분기
- 할 일: Worker가 Anthropic API 중계(키는 Worker secret, origin 제한, 일일 쿼터 KV 강제). 사이트는 Worker URL 설정 시 키 입력 불요. 기존 개인 키 경로는 유지(폴백).
- 수용 기준: 키 미입력 사용자가 채팅 가능(운영자 Worker 배포 후). 문서에 운영자 설정 가이드.

### P3 — 제품 도약 + 위생

**WO-11. 초보자 태스크 중심 홈 재조립** (§4.5 방향 1~3)
**WO-12. 문서 다이어트**: 루트 CLAUDE.md를 최근 5버전+핵심 규칙으로 슬림화, 이전 내용은 `_context/CHANGELOG-ARCHIVE.md`로.
**WO-13. audit 통폐합**: critical-10 5세대를 v50.0 게이트 단일 계열로 정리(레거시는 thin wrapper 유지).
**WO-14. 게이트 블록 소진**: critical page blocked evidence 67건(signal 31·fxbond 16·themes 12 우선) pass/reference 분류 완료.

---

## 6. 검증 명령 모음 (재현용)

```powershell
# cron 발화 확인
Invoke-RestMethod "https://api.github.com/repos/ysnle/aio-screener/actions/workflows/refresh-data.yml/runs?per_page=10" |
  Select-Object -Expand workflow_runs | ForEach-Object { "$($_.created_at) $($_.event) $($_.conclusion)" }

# 라이브 data.json 나이
(Invoke-RestMethod "https://ysnle.github.io/aio-screener/public-data/data.json").meta
```

```js
// 브라우저 콘솔 (SW 해제 + 캐시 삭제 후 fresh 로드 필수)
await AIO.getAutoOpsReadiness()        // C4/C5 이슈 추적
window._serverDataMeta                 // data.json 적용/나이
window._spxATH                         // WO-2 검증: DATA_SNAPSHOT.spxATH(7585) 이상이어야 정상
AIO.runTests()                         // 836 테스트 (기준선: GATE-BASELINE-2026-06-04.md)
```

---

## 7. 정직 한계 (Opus가 재조사하지 않아도 되는 것)

- AAII·NAAIM·breadth %aboveMA: 무료 자동 소스 없음 — 주간 수동 WebSearch가 유일 경로 (v50.5 결론 유효).
- 백엔드 전환 자체(fetch-data.mjs/로더)는 코드 검증 완료 — 동작함. 문제는 cron 발화와 커버리지/감시.
- 뉴스·채팅 파이프라인 코드 품질: v50.8/50.15 감사 결론(견고) 유효. 콘솔 에러 0 재확인.
- 모바일 기본 레이아웃: 오버플로 0 재확인 — 모바일 재작업 불요.
- 836 테스트/게이트/lineage 인프라는 자산 — 버리지 말고 CI로 끌어올리는 방향(WO-8).
