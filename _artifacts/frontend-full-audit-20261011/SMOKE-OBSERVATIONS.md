# SMOKE-OBSERVATIONS — 전 라우트 부트/렌더/상호작용 스모크 (구조적 런타임 건강 점검)

- 감사: `frontend-full-audit-20261011` / 담당: 구조적 런타임 건강 (콘텐츠 의미 판정 제외)
- 관측 시각: 2026-10-11T07:17:18.982Z
- 대상: `http://127.0.0.1:8931` (감사 전부터 실행 중, 본 에이전트는 시작/종료하지 않음) · 뷰포트 1440x900 · Chromium (Playwright 1.61.1) · 앱 버전 v57.35
- 딥링크 점검: **20개** (정규 라우트 19 + alias `#options` 1) · DOM 내 페이지 컨테이너 19개 · 스크린샷 20장
- 스크립트는 세션 스크래치패드에만 작성했고 리포 파일 수정·생성·git 조작은 없다.

## 1. 결론 요약

| 항목 | 값 |
|---|---|
| 점검 라우트(딥링크) | 20 (정규 19 + alias 1) |
| 콘텐츠가 실제로 렌더된 라우트 | 19/19 |
| 미처리 페이지 예외(uncaught) | 0건 (전 라우트·전 상호작용 합계) |
| 로컬 4xx/5xx 리소스 | 0건 |
| 판정 분포(라우트별) | 정상 16 · A 0 · B 1 · C 1 · D 1 |
| 전역(전 라우트 공통) 발견 | 2건 (SMOKE-B2 / SMOKE-D2) — 특정 라우트에 귀속하지 않고 위 분포에 넣지 않았다 |

> 라우트별 판정은 그 라우트에 귀속되는 최상위 등급 하나로 표기했다. `SMOKE-B2`(톱바 VIX 배지)와 `SMOKE-D2`(SW 미등록)는 셸 전역이라 19개 라우트 전부에 걸리지만 라우트 판정을 오염시키지 않도록 분리해 기록했다.

### A/B 발견 전체 한 줄 요약

- **SMOKE-B1 (B, screener)** — "이어서 볼 곳" 흐름 링크가 `순위가 놓인 환경 — 판정 대기`로 18초 이상 고정되고, 같은 세션의 #signal은 같은 시장 국면을 `혼조`로 렌더한다(영구 placeholder).
- **SMOKE-B2 (B, 전 라우트 셸)** — 톱바 VIX 배지가 19/19 라우트에서 20초 후에도 `VIX —`로 남고, 같은 세션의 대시보드 VIX 카드는 `14.84`이며 P1508의 일별 종가 폴백이 배지에 반영되지 않는다.
- A등급 발견은 **없다** — 에러 화면·미렌더 라우트 0건, 미처리 예외 0건.

## 2. 라우트별 표

| 라우트 | 허브 | 딥링크 | HTTP | 활성 페이지 | 콘텐츠 길이 800ms | 3300ms | 허브 탭 | 콘솔 에러 | 실패 요청(외부) | 로컬 4xx/5xx | 판정 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `home` | today | `#home` | 200 | page-home | 1287 | 1881 | home(current) briefing market-news | 25 | 14 | 0 | **정상** |
| `briefing` | today | `#briefing` | 200 | page-briefing | 1061 | 2264 | home briefing(current) market-news | 20 | 12 | 0 | **정상** |
| `market-news` | today | `#market-news` | 200 | page-market-news | 1117 | 3027 | home briefing market-news(current) | 10 | 5 | 0 | **정상** |
| `signal` | market | `#signal` | 200 | page-signal | 1433 | 3450 | signal(current) breadth sentiment | 34 | 19 | 0 | **정상** |
| `breadth` | market | `#breadth` | 200 | page-breadth | 1826 | 2921 | signal breadth(current) sentiment | 25 | 14 | 0 | **정상** |
| `sentiment` | market | `#sentiment` | 200 | page-sentiment | 1573 | 1948 | signal breadth sentiment(current) | 8 | 4 | 0 | **정상** |
| `macro` | macro | `#macro` | 200 | page-macro | 3878 | 5204 | macro(current) fxbond | 12 | 6 | 0 | **정상** |
| `fxbond` | macro | `#fxbond` | 200 | page-fxbond | 1752 | 2566 | macro fxbond(current) | 14 | 7 | 0 | **D** |
| `themes` | themes | `#themes` | 200 | page-themes | 2004 | 4069 | 숨김(탭 1개) | 19 | 11 | 0 | **정상** |
| `theme-detail` | themes | `#theme-detail` | 200 | page-themes | 3643 | 5350 | 숨김(탭 1개) | 30 | 17 | 0 | **정상** |
| `ticker` | stock | `#ticker` | 200 | page-ticker | 731 | 731 | ticker(current) technical fundamental | 14 | 9 | 0 | **정상** |
| `technical` | stock | `#technical` | 200 | page-technical | 893 | 995 | ticker technical(current) fundamental | 15 | 8 | 0 | **C** |
| `fundamental` | stock | `#fundamental` | 200 | page-fundamental | 867 | 867 | ticker technical fundamental(current) | 18 | 11 | 0 | **정상** |
| `screener` | screener | `#screener` | 200 | page-screener | 1443 | 3521 | 숨김(탭 1개) | 23 | 13 | 0 | **B** |
| `portfolio` | portfolio | `#portfolio` | 200 | page-portfolio | 1112 | 1177 | 숨김(탭 1개) | 26 | 15 | 0 | **정상** |
| `principles` | learn | `#principles` | 200 | page-principles | 656 | 2836 | principles(current) atlas masters | 26 | 15 | 0 | **정상** |
| `atlas` | learn | `#atlas` | 200 | page-atlas | 652 | 1920 | principles atlas(current) masters | 16 | 8 | 0 | **정상** |
| `masters` | learn | `#masters` | 200 | page-masters | 652 | 3347 | principles atlas masters(current) | 30 | 17 | 0 | **정상** |
| `guide` | learn | `#guide` | 200 | page-guide | 2334 | 2334 | principles atlas masters | 17 | 10 | 0 | **정상** |
| `#options` (alias) | market | `#options` | 200 | page-sentiment | 1573 | — | (sentiment와 동일) | 8 | — | 0 | **정상** |

관측 상세:
- `콘텐츠 길이`는 `document.body.innerText` 길이(공백 정규화)이며, 800ms(요구 기준)와 3300ms(추가 정착 관측)를 함께 실었다.
- 콘솔 에러와 실패 요청은 **전부 외부 오리진**(Worker 프록시 / corsproxy.io / allorigins / CoinGecko)이다. 로컬 오리진 실패는 0건이며, 유일한 로컬 실패는 네비게이션으로 끊긴 `net::ERR_ABORTED` 진행 중 요청이다.
- `theme-detail` 딥링크는 `AIO_ROUTE_REGISTRY.canonical["theme-detail"] = "themes"`에 따라 `#page-themes`로 정착한다(설계된 alias). 페이지 컨테이너 19개는 DOM에 모두 존재한다.
- `ticker` / `fundamental` / `portfolio`의 731~1,177자 고정값은 선택 종목·보유 내역이 없는 **설계된 빈 상태**로, 다음 행동 안내와 출처 문구를 함께 렌더한다(등급 아님).
- `technical`은 분석 셸(시장 국면·6축)은 즉시 렌더되지만 차트 패널만 지연된다 → SMOKE-C1.

### 레이아웃 / 접근성 계측(전 라우트)

| 라우트 | 가로 오버플로 | 문서 스크롤 높이 / 뷰포트 | 내부 스크롤러 | 이름 없는 컨트롤 | alt 없는 이미지 | 중복 id | 제목 단계 건너뜀 |
|---|---|---|---|---|---|---|---|
| `home` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `briefing` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `market-news` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `signal` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `breadth` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `sentiment` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `macro` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `fxbond` | 없음 | 900/900 | — | 0 | 0 | 0 | **2->4** |
| `themes` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `theme-detail` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `ticker` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `technical` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `fundamental` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `screener` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `portfolio` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `principles` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `atlas` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `masters` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |
| `guide` | 없음 | 900/900 | — | 0 | 0 | 0 | 없음 |

- 19개 라우트 전부 `scrollWidth == clientWidth == 1440` → 가로 오버플로 없음. 문서 자체는 스크롤되지 않고 `#main-content`가 유일한 스크롤 컨테이너 → **이중 스크롤바 없음**.
- `breadth`의 `ul.breadth-drill-list`(3개, 420px)와 `principles/atlas/masters`의 `nav.rl-nav`(760px)는 의도된 내부 패널 스크롤이다(문서 스크롤 없음 → 이중 스크롤 아님). 관측 기록만 남긴다.
- 19개 라우트 전부 이름 없는 인터랙티브 컨트롤 0개 · alt 없는 이미지 0개 · 중복 id 0개.

## 3. 발견 상세

### SMOKE-B1 — [B] "이어서 볼 곳" 흐름 링크가 "판정 대기"로 영구 고정 — 같은 세션의 #signal은 "혼조"

- 라우트: `screener` (허브 `screener`) · 축: 핵심 영역이 빈 채로 남음 (영구 placeholder) · 심각도: medium
- 재현 절차:
  1) http://127.0.0.1:8931/index.html#screener 로 딥링크 진입 (뷰포트 1440x900)
  2) 스크리너 표 하단 "이어서 볼 곳" 영역까지 스크롤
  3) span.flow-next-why 텍스트 관찰: "순위가 놓인 환경 — 판정 대기"
  4) 1.5s / 6s / 15s / 18s / 25s 시점에 재측정해도 동일 문자열 (변화 없음)
  5) 대조: 같은 서버·같은 세션에서 #signal 진입 후 h2#regime-overall → 6s 안에 "혼조"(우호 3·중립 0·부담 3)로 렌더
- 콘솔 에러 원문:
  ```
  Access to fetch at 'https://aio-proxy.zmfhd007.workers.dev/health' from origin 'http://127.0.0.1:8931' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: The 'Access-Control-Allow-Origin' header has a value 'https://ysnle.github.io' that is not equal to the supplied origin.
  ```
  ```
  Failed to load resource: the server responded with a status of 403 () @ https://corsproxy.io/?https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2F%255EGSPC%3Frange%3D1y%26interval%3D1d
  ```
- 증거: `_artifacts/frontend-full-audit-20261011/smoke-screener.png` · `scratchpad/probe4.json (screener.flow)` · `scratchpad/probe3.json (screener 1.5/6/15/25s)`
- 기전: src/domain/screener/screener-read.js:72 — `순위가 놓인 환경 — ${regime?.available ? regime.overall : "판정 대기"}`. 스크리너 라우트는 이 흐름 링크를 1회 렌더한 뒤 시장 국면이 도착해도 다시 그리지 않는 것으로 보인다(같은 세션에서 국면 자체는 계산 가능).
- 수정 방향: 시장 국면 도착 이벤트(aio:dataTimelineUpdated / market 스토어 커밋)에서 이 흐름 링크를 재렌더하거나, 국면 미도착 상태는 "—" 대신 "시장 국면 계산 중" + 산출 조건을 함께 노출해 영구 대기와 구분한다. 국면이 끝내 불가하면 링크를 숨긴다.

### SMOKE-B2 — [B] 톱바 VIX 배지가 모든 라우트에서 "VIX —"로 영구 고정 — P1508 종가 폴백이 발동하지 않음

- 라우트: `전 라우트 (셸 톱바, 19/19)` (허브 `shell`) · 축: 핵심 영역이 빈 채로 남음 (출처 없는 위젯이 영구 "—") · 심각도: medium
- 재현 절차:
  1) http://127.0.0.1:8931/index.html#home (이후 #sentiment, #signal, #screener, #guide 등 19개 라우트 전부)
  2) 20초 대기 후 document.querySelector("[data-vix-badge]").textContent 관찰 → 4/4 라우트 모두 "VIX —"
  3) 같은 시점 같은 셸의 live 시세는 정상: 톱바 라벨이 "종가 서버 10/9 마감 · 시세 16종"
  4) 같은 세션에서 [data-live-price="^VIX"] (대시보드 VIX 카드) = "14.84" → VIX 값 자체는 로컬 종가 자산에 존재
  5) 19개 라우트 스모크 본문 모두 "… 시세 16종 VIX — 도움말 …" 으로 동일
- 콘솔 에러 원문:
  ```
  Access to fetch at 'https://aio-proxy.zmfhd007.workers.dev/?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2F%255EVIX%3Finterval%3D1d%26range%3D3mo' from origin 'http://127.0.0.1:8931' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a value 'https://ysnle.github.io' that is not equal to the supplied origin.
  ```
  ```
  Failed to load resource: net::ERR_FAILED @ https://aio-proxy.zmfhd007.workers.dev/?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2F%255EVIX%3Finterval%3D1d%26range%3D3mo
  ```
- 증거: `_artifacts/frontend-full-audit-20261011/smoke-technical.png (톱바 "시세 16종 VIX —" 육안 확인)` · `scratchpad/probe5.json (home/sentiment/signal/screener 모두 vixBadge="VIX —", homeVixCard="14.84")`
- 기전: js/aio-data.js:15156-15158 — `_vixBadgeText = "VIX " + _vixFixed(vp, 2, "—")`; `if (vp == null) { …last daily history vix… " 종가" }`; `document.querySelectorAll("[data-vix-badge]").forEach(el => el.textContent = _vixBadgeText)`. 이 대입이 실행되는 시점이 실시간 시세 갱신 경로에 묶여 있어, 실시간 시세가 한 번도 오지 않는 로드에서는 P1508의 일별 종가 폴백이 배지에 반영되지 않는다.
- 유의: 동일 값이 다른 화면에서는 정상 표기되므로(14.84) 의미 판정이 아니라 배지 wiring 문제로 본다. 로컬 검증 환경에서는 외부 시세가 전부 차단되므로, 라이브 환경에서도 실시간 시세가 없는 첫 로드에 재현될 가능성이 높다.
- 수정 방향: 부팅 시 1회(그리고 history 로드 완료 시)에도 배지 텍스트를 산출하도록 폴백을 시세 갱신 경로에서 분리한다. 값이 끝내 없으면 "VIX —" 대신 "VIX 자료 없음"처럼 사유를 담거나 배지를 숨긴다.

### SMOKE-C1 — [C] 차트 패널이 "SPY 일봉 불러오는 중…" + 빈 캔버스로 약 9~13초 정지 후에야 실패 안내로 전환

- 라우트: `technical` (허브 `stock`) · 축: 로딩 상태가 멈춤 · 심각도: medium
- 재현 절차:
  1) http://127.0.0.1:8931/index.html#technical 딥링크 진입
  2) #stock-chart-status 관찰: ~2s "불러오는 중…" (t=3000/6000/9000 모두)
  3) t≈9000ms까지 "불러오는 중…" 유지, #stock-chart-state 배지 "판정 대기", 차트 영역은 흰 박스
  4) t≈14000ms에야 상태가 비워지고 "#stock-chart-evidence"에 "SPY 시세를 받아오지 못했습니다 / 시세 제공처나 중계 서버가 응답하지 않았습니다. … 다시 시도" 렌더
  5) 종목을 직접 입력(NVDA → 차트 보기)해도 동일: t=8000까지 "불러오는 중…", t=16000에 실패 안내
- 콘솔 에러 원문:
  ```
  Access to fetch at 'https://aio-proxy.zmfhd007.workers.dev/?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2FSPY%3Frange%3D2y%26interval%3D1d%26includePrePost%3Dfalse' from origin 'http://127.0.0.1:8931' has been blocked by CORS policy: The 'Access-Control-Allow-Origin' header has a value 'https://ysnle.github.io' that is not equal to the supplied origin.
  ```
  ```
  Failed to load resource: the server responded with a status of 403 () @ https://corsproxy.io/?https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2FSPY%3Frange%3D2y%26interval%3D1d%26includePrePost%3Dfalse
  ```
  ```
  Failed to load resource: net::ERR_FAILED @ https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv8%2Ffinance%2Fchart%2FSPY%3Frange%3D2y%26interval%3D1d%26includePrePost%3Dfalse
  ```
- 증거: `_artifacts/frontend-full-audit-20261011/smoke-technical.png (3.3s 시점: "SPY 일봉 불러오는 중… 판정 대기" + 빈 차트 박스)` · `scratchpad/probe3.json (chart.technical 1/3/6/9/14/20s, chart.technicalWithSymbol)`
- 기전: src/ui/components/stock-chart.js:121이 상태를 "불러오는 중…"으로 설정하고, 실패 시 130-146행의 emptyState 폴백으로 교체한다. 실제로 폴백은 도달하지만, 3개 중계 경로(worker proxy → corsproxy.io → allorigins.win)를 직렬로 모두 소진한 뒤에야 도달하므로 사용자에게는 9~13초간 "불러오는 중" + 빈 영역으로 보인다.
- 수정 방향: 프록시 폴백 체인 전체에 짧은 마감(예: 4초)을 걸고, 초과 시 곧바로 실패 안내 + 다시 시도 버튼을 렌더한다(폴백은 백그라운드에서 계속). "불러오는 중" 상태에는 경과 시간/재시도 어포던스를 함께 둔다. 상태 배지 "판정 대기"도 실패 확정 시 함께 정리한다.

### SMOKE-D1 — [D] fxbond 활성 페이지 제목 단계가 h2 → h4로 건너뜀 (h3 없음)

- 라우트: `fxbond` (허브 `macro`) · 축: 접근성 (제목 단계 건너뜀) · 심각도: low
- 재현 절차:
  1) http://127.0.0.1:8931/index.html#fxbond 딥링크 진입
  2) document.querySelectorAll(".page.active h1,h2,h3,h4") 순서 관찰 → [2,2,4,4,4,2,2,3,3,3,3,2]
  3) 3번째 제목에서 h2 다음이 h4 (h3 부재) → 스크린리더/개요 탐색에서 계층 단절
- 콘솔 에러 원문: 없음(이 발견은 콘솔 오류가 아니라 상태/구조에서 검출).
- 증거: `scratchpad/probe2.json (a11y[f xbond].headingSeq = [2,2,4,4,4,2,2,3,3,3,3,2], headingJump = "2->4")`
- 기전: index.html #page-fxbond 섹션에서 중간 레벨 제목(h3) 없이 h4가 사용됨. 같은 허브의 #page-macro는 [2,2,3,3,3,3,3,3,2,2,3,4]로 단계가 연속적이라 두 형제 화면이 서로 다른 개요를 만든다.
- 수정 방향: fxbond의 h4 블록 제목을 h3로 올리거나(권장) 해당 섹션에 h3 도입. 매크로 화면과 제목 레벨을 맞춘다.

### SMOKE-D2 — [D] 서비스 워커가 127.0.0.1 호스트에서 등록되지 않음 — SW/캐시 시나리오 재현 불가

- 라우트: `전 라우트 (셸 부트스트랩)` (허브 `shell`) · 축: 런타임 조건 (감사 재현성/오프라인 셸) · 심각도: low
- 재현 절차:
  1) http://127.0.0.1:8931/index.html#home 을 load 이벤트까지 로드하고 6초 대기
  2) isSecureContext=true, "serviceWorker" in navigator=true, localStorage.aio_sw_disabled=null 확인
  3) navigator.serviceWorker.getRegistrations() → [] , navigator.serviceWorker.controller → null , caches.keys() → []
  4) 따라서 "SW 등록 시 새 콘텐츠가 캐시에 갇혀 이전 버전이 보이는지(첫 로드 vs 재로드)"는 이 호스트에서 관측 불가
  5) 대조: 첫 로드 vs 재로드 콘텐츠 길이는 home 1271/1271, screener 921/2817, sentiment 71/1341, principles 16/2231 — 차이는 SW가 아니라 비동기 데이터 도착 시점차이며, /index.html 은 매번 status 200 + version.json v57.35 로 동일
- 콘솔 에러 원문: 없음(이 발견은 콘솔 오류가 아니라 상태/구조에서 검출).
- 증거: `scratchpad/probe2.json (sw.afterLoad6s, sw.firstVsReload, sw.registrationsAfter, sw.cachesAfter)` · `scratchpad/smoke-raw.json (serviceWorker)`
- 기전: js/aio-ui.js:6816 — `if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost"))`. 감사 서버는 http://127.0.0.1:8931 이므로 hostname이 "127.0.0.1"이라 조건이 거짓 → 등록 블록 전체가 조용히 건너뛴다(경고 로그도 없음).
- 수정 방향: 로컬/오프라인 검증이 가능하도록 조건에 127.0.0.1(및 ::1)을 명시적으로 포함하고(`location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "[::1]"`), 건너뛸 때는 한 줄 로그를 남겨 "왜 SW가 없는지"를 관측 가능하게 만든다.

## 4. 콘솔 에러 · 실패 요청 상위 목록

총 콘솔 에러 발생 1553건, 그중 미처리 페이지 예외 **0건**. 전부 외부 오리진 요청 실패가 원인이며 앱 코드 예외는 없다.

> 위 총계는 **19개 딥링크 1회 진입 + 상호작용 프로브(약 40회 페이지 로드) + SW 프로브**를 모두 합산한 값이다. 라우트별 단일 진입 기준 콘솔 에러는 8(sentiment·별칭)~34(signal)건이며 라우트별 표에 실었다. 같은 실패가 재시도·폴백마다 중복 집계되므로 절대량보다 **서명 순위**를 보면 된다.

관측 상세:
- 상위 3개(1329/1553 = 86%)는 프록시/중계 계층의 도달 실패이며, 그중 1순위는 "Failed to load resource: net::ERR_FAILED"(Worker 프록시·allorigins·codetabs 등 중계 URL), 2순위는 Worker 프록시 오리진 allowlist(`https://ysnle.github.io`) 때문에 발생하는 CORS 프리플라이트 실패다.
- 6번째 항목 `[AIO:api] proxy-primary: warn → error {errCount: 3}`는 예외가 아니라 앱이 스스로 남긴 진단 로그다(프록시 1차 경로 실패). 참고로 남긴다.

### 콘솔 에러 서명별 순위 (전 라우트+상호작용 합산)

| # | 서명 | 발생 횟수 |
|---|---|---|
| 1 | Failed to load resource: net::ERR_FAILED (external proxy/API) | 669 |
| 2 | CORS blocked: fetch to aio-proxy.zmfhd007.workers.dev (worker proxy; ACAO allowlist = https://ysnle.github.io) | 299 |
| 3 | CORS blocked: fetch to api.allorigins.win | 292 |
| 4 | Failed to load resource: HTTP 403 (외부 CORS 프록시 corsproxy.io) | 195 |
| 5 | CORS blocked: fetch to api.coingecko.com | 64 |
| 6 | Failed to load resource: HTTP 429 (rate limit, api.coingecko.com) | 9 |
| 7 | [AIO:api] 앱 내부 로그(예외 아님): [AIO:api] proxy-primary: warn → error {errCount: 3} | 6 |
| 8 | CORS blocked: fetch to m.stock.naver.com | 6 |
| 9 | CORS blocked: fetch to fchart.stock.naver.com | 5 |
| 10 | Failed to load resource: net::ERR_CONNECTION_TIMED_OUT (stooq.com CSV, 외부) | 4 |
| 11 | CORS blocked: fetch to query1.finance.yahoo.com | 2 |
| 12 | Failed to load resource: HTTP 422 (api.rss2json.com) | 1 |
| 13 | CORS blocked: fetch to api.rss2json.com | 1 |

대표 원문(최다 발생):

```
Failed to load resource: net::ERR_FAILED
```

### 실패한 리소스 요청 서명별 순위 (외부)

| # | 서명 | 발생 횟수 | 대표 URL |
|---|---|---|---|
| 1 | requestfailed :: api.allorigins.win | 339 | `https://api.allorigins.win/raw?url=https%3A%2F%2Fwww.cnbc.com%2Fid%2F100003114%2Fdevice%2Frss%2Frss.html` |
| 2 | requestfailed :: aio-proxy.zmfhd007.workers.dev (worker proxy) | 314 | `https://aio-proxy.zmfhd007.workers.dev/health` |
| 3 | requestfailed :: api.codetabs.com | 245 | `https://api.codetabs.com/v1/proxy/?quest=https%3A%2F%2Fwww.cnbc.com%2Fid%2F15839069%2Fdevice%2Frss%2Frss.html` |
| 4 | status-403 :: corsproxy.io | 195 | `https://corsproxy.io/?https%3A%2F%2Fwww.cnbc.com%2Fid%2F100003114%2Fdevice%2Frss%2Frss.html` |
| 5 | requestfailed :: api.coingecko.com | 68 | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=tr` |
| 6 | requestfailed :: corsproxy.io | 47 | `https://corsproxy.io/?https%3A%2F%2Ffchart.stock.naver.com%2FsiseJson.nhn%3Fsymbol%3D005930%26timeframe%3Dday%26count%3D120%26requestType%3D0` |
| 7 | requestfailed :: stooq.com | 25 | `https://stooq.com/q/l/?s=skew.us+cl.f+gc.f+dx.f&f=sd2t2ohlcv&h&e=csv` |
| 8 | status-429 :: api.rss2json.com | 7 | `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Frsshub.app%2Freuters%2Fmarket` |
| 9 | requestfailed :: m.stock.naver.com | 6 | `https://m.stock.naver.com/api/index/KOSPI/trend` |
| 10 | requestfailed :: fchart.stock.naver.com | 5 | `https://fchart.stock.naver.com/siseJson.nhn?symbol=005930&timeframe=day&count=120&requestType=0` |
| 11 | requestfailed :: production.dataviz.cnn.io | 3 | `https://production.dataviz.cnn.io/index/fearandgreed/graphdata` |
| 12 | status-429 :: api.coingecko.com | 2 | `https://api.coingecko.com/api/v3/global` |
| 13 | requestfailed :: query1.finance.yahoo.com | 2 | `https://query1.finance.yahoo.com/v8/finance/chart/%5EKQ11?interval=1m&range=1d` |
| 14 | status-422 :: api.rss2json.com | 1 | `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Ffinance.yahoo.com%2Fnews%2Frssindex` |
| 15 | requestfailed :: api.rss2json.com | 1 | `https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fwww.investing.com%2Frss%2Fnews.rss` |

### 로컬(127.0.0.1:8931) 실패 요청

**404/500: 0건.** 관측된 로컬 실패는 모두 `net::ERR_ABORTED`(네비게이션/리로드로 페이지가 파괴되며 끊긴 진행 중 요청)이다:

- `http://127.0.0.1:8931/public-data/screener.json` (serviceWorker)
- `http://127.0.0.1:8931/public-data/screener-universe.json` (serviceWorker)
- `http://127.0.0.1:8931/public-data/model-validation-status.json` (serviceWorker)
- `http://127.0.0.1:8931/src/ui/components/screener-read.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/ui/components/screener-validation.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/domain/screener/candidate-record.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/domain/screener/factor-overlap.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/data/artifact-cache.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/state/selectors/screener.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/domain/screener/model-fingerprint.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/ui/components/sentiment-board.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/public-data/history.json?t=497695` (interaction:refresh-return)
- `http://127.0.0.1:8931/public-data/operator-note.json?t=5972344` (interaction:refresh-return)
- `http://127.0.0.1:8931/src/ui/knowledge/industry-view.js` (interaction:refresh-return)
- `http://127.0.0.1:8931/public-data/screener-candidate-archive.json` (serviceWorker)
- `http://127.0.0.1:8931/public-data/factor-backtest-longrun.json` (serviceWorker)
- `http://127.0.0.1:8931/public-data/backtest-history.json` (serviceWorker)
- `http://127.0.0.1:8931/public-data/macro-history.json` (serviceWorker)

핵심 데이터 artifact 직접 조회 결과 전부 200: `public-data/{data,history,screener,screener-universe,model-validation-status,operator-note,screener-candidate-archive,factor-backtest-longrun,backtest-history,macro-history,telegram-digest}.json`.

## 5. 상호작용 샘플

| 시나리오 | 결과 | 비-CORS 콘솔/페이지 오류 |
|---|---|---|
| 허브 탭 전환 (오늘/시장 상태/거시·금리/종목/리서치 5개 허브, 9회) | 전부 성공, 활성 페이지 정확 | 0 |
| 톱바 화면 간 이동 (8개 nav 항목) | 전부 성공, 허브 탭 재구성 정확 | 0 |
| 종목 진입 (home/screener/themes/market-news → 첫 종목 어포던스 클릭) | 4/4 `#page-ticker`로 이동, 활성 페이지 정확 | 0 |
| 새로고침 복귀 (home/screener/sentiment/atlas) | 해시·활성 페이지 유지, 오류 없음(길이 차이는 비동기 데이터 도착 시점차) | 0 |

허브 탭 전환 관측(전환 후 활성 페이지 / 콘텐츠 길이):

| from | tab | active | len |
|---|---|---|---|
| home | briefing | page-briefing | 2306 |
| home | market-news | page-market-news | 3079 |
| signal | breadth | page-breadth | 761 |
| signal | sentiment | page-sentiment | 2007 |
| macro | fxbond | page-fxbond | 961 |
| ticker | technical | page-technical | 1053 |
| ticker | fundamental | page-fundamental | 919 |
| principles | atlas | page-atlas | 1978 |
| principles | masters | page-masters | 3382 |

톱바 화면 이동 관측:

| arg | hub | active | 허브 탭 | len |
|---|---|---|---|---|
| home | today | page-home | home briefing market-news | 1932 |
| signal | market | page-signal | signal breadth sentiment | 3505 |
| macro | macro | page-macro | macro fxbond | 1030 |
| themes | themes | page-themes | — | 1109 |
| ticker | stock | page-ticker | ticker technical fundamental | 783 |
| screener | screener | page-screener | — | 1580 |
| portfolio | portfolio | page-portfolio | — | 1246 |
| principles | learn | page-principles | principles atlas masters | 2896 |

종목 진입 관측:

- {"start":"home","candidateCount":6}
- {"start":"home","clicked":true,"active":["page-ticker"],"len":783,"dash":1,"sample":"메인 콘텐츠로 건너뛰기 AIO Investment Screener 데일리 오늘 시장 시장 상태 거시 · 금리 테마 · 섹터 내 투자 종목 스크리너 포트폴리오 리서치 리서치 라이브러리 용어 사전 다크 모드로 전환 AI"}
- {"start":"screener","candidateCount":6}
- {"start":"screener","clicked":true,"active":["page-ticker"],"len":783,"dash":1,"sample":"메인 콘텐츠로 건너뛰기 AIO Investment Screener 데일리 오늘 시장 시장 상태 거시 · 금리 테마 · 섹터 내 투자 종목 스크리너 포트폴리오 리서치 리서치 라이브러리 용어 사전 다크 모드로 전환 AI"}
- {"start":"themes","candidateCount":204}
- {"start":"themes","clicked":true,"active":["page-ticker"],"len":783,"dash":1,"sample":"메인 콘텐츠로 건너뛰기 AIO Investment Screener 데일리 오늘 시장 시장 상태 거시 · 금리 테마 · 섹터 내 투자 종목 스크리너 포트폴리오 리서치 리서치 라이브러리 용어 사전 다크 모드로 전환 AI"}
- {"start":"market-news","candidateCount":344}
- {"start":"market-news","clicked":true,"active":["page-ticker"],"len":783,"dash":1,"sample":"메인 콘텐츠로 건너뛰기 AIO Investment Screener 데일리 오늘 시장 시장 상태 거시 · 금리 테마 · 섹터 내 투자 종목 스크리너 포트폴리오 리서치 리서치 라이브러리 용어 사전 다크 모드로 전환 AI"}
- {"start":"ticker-deeplink-nosubject","active":["page-ticker"],"len":783,"sample":"메인 콘텐츠로 건너뛰기 AIO Investment Screener 데일리 오늘 시장 시장 상태 거시 · 금리 테마 · 섹터 내 투자 종목 스크리너 포트폴리오 리서치 리서치 라이브러리 용어 사전 다크 모드로 전환 AI 도우미 일시 사용 불가 GPT-6 Luna · 공용 AI 연결 개인 A"}

새로고침 복귀 관측:

| 라우트 | 첫 로드 len | 리로드 후 len | Δ | 해시 |
|---|---|---|---|---|
| home | 1932 | 1885 | -47 | #home |
| screener | 1580 | 1420 | -160 | #screener |
| sentiment | 756 | 1952 | 1196 | #sentiment |
| atlas | 710 | 1924 | 1214 | #atlas |

허브 탭은 `themes`(탭 1개), `screener`, `portfolio`에서 `tab:false`/단일 탭 규칙에 따라 숨겨진다(설계: `src/ui/navigation/route-hubs.js:60-68`).

## 6. 서비스 워커 · 캐시 신선도

| 확인 | 값 |
|---|---|
| SW 등록 | **없음** — getRegistrations() = [] |
| navigator.serviceWorker.controller | null |
| Cache Storage | `caches.keys()` = [] |
| isSecureContext | true |
| localStorage.aio_sw_disabled | null |
| /index.html 응답 | 매 로드 status 200, version.json = v57.35 (디스크 v57.35) |

첫 로드 vs 재로드 콘텐츠 길이(같은 라우트):

| 라우트 | 첫 로드 | 리로드 | 비고 |
|---|---|---|---|
| home | 1271 | 1271 | 비동기 데이터 도착 시점차(활성 페이지 동일) |
| screener | 921 | 2817 | 비동기 데이터 도착 시점차(활성 페이지 동일) |
| sentiment | 71 | 1341 | 비동기 데이터 도착 시점차(활성 페이지 동일) |
| principles | 16 | 2231 | 비동기 데이터 도착 시점차(활성 페이지 동일) |

판정: **재현 불가(N/A)** — `js/aio-ui.js:6816`의 `location.protocol === "https:" || location.hostname === "localhost"` 가드 때문에 `127.0.0.1` 호스트에서는 SW가 아예 등록되지 않아 "이전 버전이 캐시에 갇히는" 시나리오를 관측할 수 없다. 이 조건 자체를 발견 `SMOKE-D2`로 기록했다.

## 7. Blocked / 관측 한계

- **BLOCKED-1 — SW/캐시 고정(stale cache) 시나리오**
  - 사유: http://127.0.0.1:8931 에서는 js/aio-ui.js:6816 가드 때문에 SW가 등록되지 않는다(registrations=[]). https 또는 hostname "localhost" 에서만 재현 가능. 로컬 서버를 직접 시작/종료하거나 포트를 바꾸는 것은 지시 위반이라 하지 않았다.
  - 우회: localhost:8931 로 접속하면 동일 서버에서 SW 등록을 재현할 수 있다.
- **BLOCKED-2 — 외부 데이터 공급자 계층**
  - 사유: Cloudflare Worker 프록시의 CORS 허용 오리진이 https://ysnle.github.io 이고, corsproxy.io 403 / allorigins CORS 실패 / coingecko CORS·429 / CNN dataviz 차단. 로컬 오리진에서는 시세·뉴스·FRED·CBOE·SEC·Finnhub·AlphaVantage·FMP·한국 리레이(Yahoo, CoinGecko, FRED, CBOE, SEC, naver, bok, kosis)가 전부 도달 불가. 이로 인한 위젯 상태의 의미 판정은 다른 에이전트 담당.
  - 우회: 없음(환경 제약). 프록시 allowlist에 로컬 오리진을 추가하거나 로컬 대역 fixture가 필요.

- 자동 브라우저 계측은 한국어 의미·정확성·미적 품질을 인증하지 않는다. 본 문서는 구조(렌더/상태/오류/레이아웃/접근성)만 판정한다.
- 콘텐츠 길이는 document.body.innerText 길이이며, 숨겨진 18개 비활성 화면은 포함되지 않는다(정규화 후 측정).
- 스크린샷은 1440x900 뷰포트 컷이며, 셸이 고정 높이이므로 스크롤 하단 내용은 스크린샷에 담기지 않는다(계측값·DOM 관측으로 보완).
- 세션 스크래치패드는 세션 보존 정책에 따라 정리된다. 영구 보존이 필요한 수치는 본 문서에 함께 기재했다.

## 8. 증거 파일

- _artifacts/frontend-full-audit-20261011/smoke-<route>.png (19) + smoke-options.png (alias) — 1440x900 뷰포트 스크린샷
- scratchpad/smoke-raw.json (라우트별 원시 관측: m800/m3300 DOM 계측, 콘솔/페이지/요청 오류, SW)
- scratchpad/probe2.json (로컬 실패 요청, 로딩 지속 스냅샷, 레이아웃 오버플로, 경량 a11y, SW)
- scratchpad/probe3.json (판정 대기/차트 상태 시간축 1.5s→25s)
- scratchpad/probe4.json (18s 시점 placeholder 재확인)
- scratchpad/probe5.json (톱바 VIX 배지 20s 시점)

---

참고: 본 문서는 구조 판정만 담당한다. 각 위젯이 보여 주는 수치의 의미·최신성·정확성 판정은 별도 에이전트 산출물을 따른다.