# 거시 · 금리 화면 실브라우저 전수 점검 (MACRO-OBSERVATIONS)

- 일시: 2026-10-11 (KST, 일) · 점검자: frontend-full-audit-20261011 / macro-axis
- 대상: AIO Screener 하이브리드 정적 셸, 라우트 `#macro`(거시 경제), `#fxbond`(금리 · 환율)
- 환경: 로컬 서버 http://127.0.0.1:8931 (기 실행, 미재시작) · agent-browser(CDP Chrome, headless) · 뷰포트 1440×900 · 세션 `aio-macro-b2c50a70c36a`
- 기준: 마지막 완료 미국 정규장 2026-10-09(금) 종가. `history.json` 의 마지막 row 는 2026-10-10(토)이지만 `seriesMode=completed-market-cut`, `cycleEnd=2026-10-09T23:00Z`, `fieldMeta.observedAt` 이 10/9 이므로 10/9 종가로 키잉된다.
- ground truth: `public-data/macro-history.json`, `market-snapshot.json`, `history.json`, `data.json`, `operations-status.json`
- 산출물: 이 문서 + `MACRO-OBSERVATIONS.json` (그 외 파일 수정·생성 없음, git/코드 수정 없음)

## 0. 등급별 건수

| 등급 | 건수 | ID |
|---|---|---|
| A (틀림/낡음/추정) | 1 | MACRO-A1 |
| B (같은 값, 다른 basis/단위) | 1 | MACRO-B1 |
| C (staleness/basis/상태칩/누락) | 5 | MACRO-C1 … C5 |
| D (카피/UX/접근성) | 6 | MACRO-D1 … D6 |
| 콘솔 에러 | 2 | MACRO-CONSOLE-1·2 |
| blocked/미확인 | 5 | MACRO-U1 … U5 |

전수 대조: `#macro` 36항목 + `#fxbond` 24항목 = 60항목 대조 기록(JSON `reconciliation`), A/B 2건만 불일치.

## 1. 발견 목록

### A

**MACRO-A1 (needs-double-check) — '1년 전' 비교값이 실제 12개월 전이 아님**
- route: `#macro` · 위치: 물가 > `CPI (전년 대비)` 카드 추이 줄, 고용 > `실업률` 카드 추이 줄
- expected: CPI 1년 전 = **2.9%** (`macro-history.series.cpiIndexNsa` 2025-08-01 323.976 ÷ 2024-08-01 314.796 = +2.92%), 실업률 1년 전 = **4.4%** (`series.unemployment` 2025-09-01 = 4.4)
- actual: CPI **2.7%**(= 2025-07 YoY 2.71% = 13개월 전), 실업률 **4.3%**(= 2025-08 값 = 13개월 전)
- 원인: `macro-history` 의 CPI/core CPI/CPI(SA)/core CPI(SA)/실업률 계열에 **2025-10-01 관측이 없다**(2025-09-01 다음이 2025-11-01). `indicators.js trendOf()` 가 위치(index −13)로 '1년 전'을 잡아 창이 한 달 밀린다. payrolls·PCEPI 에는 2025-10 이 있어 같은 보드의 PCE 카드는 정상(2.7%@2025-08).
- 재현: (1) `macro-history.json` 에서 2025-10 부재와 13번째 뒤 관측값 확인 → 스크래치패드 `verify.js` 재현 결과 `CPI YoY: 1년전=2.7(2025-07-01)`, `실업률: 1년전=4.3(2025-08-01)`. (2) `#macro` 에서 두 카드 문구 확인.
- 증거: `public-data/macro-history.json` (`cpiIndexNsa`, `unemployment`), `src/domain/macro/indicators.js:160-175`, 스크래치패드 `verify.txt`, `macro-pretty.json`, `macro-board.png`
- 수정 방향: 위치 기반 대신 달력 기준(정확히 12개월 전 달) 비교, 결측 시 창을 명시.

### B

**MACRO-B1 (needs-double-check) — 같은 5거래일 변화가 화면마다 '5일' / '1주'**
- route: `#macro` ↔ `#fxbond` · 위치: 신용 축 `HY 315bp (5일 −9bp)` vs 하이일드 스프레드 카드 `1주 −9bp`; 금리 축 근거 `미 10년물 5.24% (5일 -4bp, 20일 +27bp)` vs 곡선 `10년 1주 −4bp`
- expected: 동일 창(5영업일)은 같은 basis 이름으로 표기. 근거값 `data.json macro.hyOASDelta5=-0.09`, `macro.dgs10Delta5=-0.04`
- actual: 값은 동일(−9bp, −4bp)한데 `#macro` 는 '5일', `#fxbond` 는 '1주'
- 재현: 두 라우트의 해당 문구를 나란히 읽고 `data.json` delta 값과 대조
- 증거: `public-data/data.json` (`hyOASDelta5`, `dgs10Delta5`), `src/domain/macro/macro-read.js:26-29`, `src/domain/macro/rates-fx.js:94`, 스크래치패드 `macro-pretty.json`, `fx-body.txt`
- 수정 방향: '5거래일' 표기 통일(판정 기준 문구 '신용 스프레드 1주 ±25bp' 와도 맞춤).

### C

**MACRO-C1 — 상단 시세 상태칩 오표기(7종 / '서버' 접두 없음)**
- route: 공통 상단바(두 라우트 모두) · 위치: `#live-quote-ts` → `10/9 마감 · 시세 7종`
- expected: `서버 10/9 마감 · 시세 16종`, `data-currentness ∈ {close,stale}`, title 에 '실시간 시세가 아닌' — 근거: `market-snapshot.json quotes` 16건/coverage 16·16, `operations-status.json planes.durable.coverage 16/16`, 저장소 게이트 `scripts/ci-architecture-browser-check.mjs:102`
- actual: `10/9 마감 · 시세 7종`, title `미국 정규장 마감 · 10/9 종가 기준 (최신 관측 10/10 06:29 KST)`. 같은 세션 첫 로드 스크린샷은 `서버 10/9 마감 · 시세 16종` 이었고 live fetch 실패 반복 뒤 7종으로 바뀜
- 원인: 칩 숫자가 durable 스냅샷(16)이 아니라 fast quote plane 생존 수를 반영. operations-status 상 fast plane 은 OPERATOR_REQUIRED, quotes featureAvailability=UNAVAILABLE
- 재현: `#macro` 로드 직후/20초 후, `#fxbond` 에서 `#live-quote-ts` textContent 샘플링(스크래치패드 `ex7.js` → `lq.json`)
- 증거: `public-data/market-snapshot.json`, `public-data/operations-status.json`, `scripts/ci-architecture-browser-check.mjs:91-104`, `macro-view.png`(16종) ↔ `fx-top.png`/`fx-grid.png`(7종)
- 수정 방향: 칩은 durable 기준 고정, live 상태는 별도 슬롯.

**MACRO-C2 (needs-double-check) — 결측월을 건너뛴 3개월 평균으로 만든 Sahm 0.00%p 가 관측값처럼 표시**
- route: `#macro` · 위치: 성장 축 details `Sahm 지표 0.00%p (0.5 이상이면 침체 신호)`, '국면 판정 기준과 지금 읽은 값' 표 1행 `기준 미만`
- expected: 결측월이 있으면 3개월 평균 정의가 성립하지 않으므로 계산 보류/결측 안내. `unemployment` 는 2025-09 다음이 2025-11(2025-10 부재)
- actual: `0.00%p` + `기준 미만`, 결측 안내 없음
- 재현: `macro-history.json` 2025-10 부재 확인 → `#macro` 에서 details 펼쳐 Sahm 행 확인
- 증거: `public-data/macro-history.json` (`unemployment`), `src/domain/macro/macro-read.js:69-77`, 스크래치패드 `hidden-macro.json`, `verify.txt`(`sahm gap = 0.000`)
- 수정 방향: 결측월 시 Sahm·3개월 평균류 보류 + 상태칩.

**MACRO-C3 — 월별 카드의 발표일/다음 발표 누락**
- route: `#macro` · 위치: `주택 착공 (연율)` meta `8월분` 만, `실효 연방기금금리 (월평균)` meta `9월분` 만
- expected: 같은 보드의 소매판매 `8월분 · 9/16 발표 · 다음 10/15`, 실업률 `9월분 · 10/2 발표 · 다음 11/6` 처럼 관측기간 + 발표일(+출처)
- actual: 관측기간만. 출처는 hover title 뿐
- 원인: `indicators.js` MACRO_GROUPS 의 `housingStarts`(48행)·`fedRate`(26행) 항목에 `release` 키 없음 → `releaseInfo()` 가 `{last:null,next:null}`
- 증거: `src/domain/macro/indicators.js:26,48`, 스크래치패드 `macro-pretty.json` cards[10]/[1]
- 수정 방향: 두 항목에 공식 일정 근거 추가.

**MACRO-C4 (needs-double-check) — 페이지 기준일보다 5거래일 이전 일별 계열에 지연 표기 없음**
- route: `#fxbond` · 위치: `10년 기간 프리미엄 (Kim-Wright)` 카드 meta `10/2` (페이지 기준 `10/9`)
- expected: 기준일 대비 뒤처짐을 카드에 표기(다른 카드는 10/8·10/9)
- actual: `10/2` 만. stale 판정 임계가 30일(`macro-board.js:514,522`)이라 9일 지연은 통과
- 증거: `public-data/macro-history.json` `termPremium10` 마지막 `["2026-10-02",1.0847]`, `src/ui/components/macro-board.js:508-525`, 스크래치패드 `fx-body.txt`
- 수정 방향: 지연 표기를 시리즈 주기 기준으로.

**MACRO-C5 (needs-double-check) — 정적 참조값에 관측일·출처 없음**
- route: 두 라우트 · 위치: (a) `에너지는 CPI의 약 7%`, (b) `중립 약 1%`, (c) 카드의 발표일 문구 `9/11 발표 · 다음 10/14` 등
- expected: 값 + 관측일 + 출처 병기
- actual: (a) 출처·기준시점 없음 (b) 출처는 코드 주석에만 (c) 화면엔 발표일만, 캘린더 출처(`BLS official schedule`)·검증일 미노출
- 증거: `src/domain/macro/macro-read.js:8,158,305`, `js/aio-core.js:11076-11110`(AIO_MACRO_CALENDAR v53.4 / OFFICIAL_SCHEDULES), 스크래치패드 `hidden-macro.json`
- 수정 방향: 기준시점·출처 병기, 캘린더 source/sourceUrl·검증일 노출.

### D

- **MACRO-D1** `#macro` WTI·금 차트 aria-label `10/14~10/9 추이`(연도 없음 → 역순처럼 읽힘). `trend-chart.js:29-32,143`. 스크래치패드 `hidden-macro.json chartArias`.
- **MACRO-D2** 차트 y축 눈금에 단위 없음(`#fxbond` 96.0~104.0 / 1300~1600 / 150.0~165.0 / 4.0~5.5, `#macro` 40~120 / 3500~5500) — 카드 값에는 단위가 있고 수익률 곡선은 `%` 를 붙여 일관성 없음.
- **MACRO-D3** 스파크 '기간 고점/저점' 줄 단위 누락(비농업 `237 · -156`, 주택 착공 `152 · 118`). `macro-board.js:98-106`.
- **MACRO-D4** 부호 글리프 혼용(게이지 캡션 `. -1.7%` ASCII vs headline `−1.7%` U+2212). `macro-board.js:151` vs `macro-read.js:26`.
- **MACRO-D5** 날짜 표기 혼용(카드 meta `10/8` vs note `기준일 2026-10-08`, 헤더 `2026-10-14 KST 기준`). `rates-fx.js:143-148`.
- **MACRO-D6** 차트 없는 `연준 목표 범위` 카드가 그리드 한 칸을 차지해 큰 공백(`macro-board.png`).

### 콘솔

- **MACRO-CONSOLE-1** `[AIO:pagebus] html-kr-live/aio:liveQuotes handler failed: Cannot read properties of null (reading 'toFixed')` — 두 라우트 반복(warning). 화면 숫자 영향은 없으나 가드 누락(→ MACRO-D7 로도 기록).
- **MACRO-CONSOLE-2** 프록시 5종 disabled / `Yahoo v7 batch chunk error` / `[AIO:HY] HY 스프레드 프록시 전부 실패 — 정적 데이터 사용 중` / `[error] [AIO:api] proxy-primary: warn → error`. 실행 환경 외부망 차단으로 보이며 화면 값은 저장소 기록 기반이라 영향 없음.

## 2. 두 라우트 교차 대조(요구 4)

10년물 **5.24%**, 2년물 **4.80%**, 하이일드 **315bp**, 달러 인덱스 **102.23 (+2.8%)**, 실질금리 **2.87%**, 기대인플레이션 **2.33%**, 10년물 20일 **+27bp** — 모두 두 라우트에서 동일값. 값 불일치 없음. 유일한 차이는 동일 5거래일 변화의 창 이름(`5일` ↔ `1주`)으로 MACRO-B1.

## 3. 대조에서 확인된 정상 동작(참고)

- `그 밖의 통화` 는 `daily-reference-rate` 를 감지해 등락 셀을 숨기고 `하루 1회 갱신, 등락 없음` 으로 표기(`macro-board.js:571-594`) — 기준 없는 변동률을 만들지 않음.
- 실질금리(10/8)·기대인플레이션(10/9) 기준일 차이를 양쪽 카드에 명시하고 합산 보류(추이 5일 변화도 보류).
- 기간 프리미엄 카드는 `관측값이 아닌 모형 추정치` 라고 명시.
- 곡선/스프레드/기준일: `10/9 미국 종가 기준 · 국채 금리 10/9 공식 고시 기준` 이 `data.json _treasury.observedAt=2026-10-09` 와 일치. 2s10s 는 공식 `t10y2y=0.44` 와 자체 계산(5.24−4.80) 이 동일.
- `#macro`/`#fxbond` 어디에도 상시 `—` 자리표시 위젯이 없다(스크린 정직성 결정 준수).

## 4. blocked / 미확인

| ID | 항목 | 사유 |
|---|---|---|
| MACRO-U1 | `그 밖의 통화` 4종 환율 값과 `10/11 고시` 표기 | public-data 에 없고 런타임 외부 환율 API(`js/aio-data.js:13453-13524`) 값. 주말 고시 여부 확인 불가 |
| MACRO-U2 | 발표 일정 정적값의 사실 정확성(10/14 CPI, 10/15 소매판매, 10/28 FOMC) | 대조할 저장소 정적 캘린더 외 근거 없음(오프라인) |
| MACRO-U3 | proxy 차단 환경에서의 live 계열 일치(^TNX vs 재무부 dgs10 소수점 등) | 프록시·Yahoo fetch 실패. 오늘은 두 소스 모두 5.24 로 일치 |
| MACRO-U4 | `#page-macro` 내부 `한국 시장 — 핵심 지수 · 한국 매크로` 패널(`—` 자리표시 다수) | 한 번 관측되었으나 이후 비표시(display:none), innerText 에도 없음 → 1440×900 화면 미노출 |
| MACRO-U5 | `operations-status.json reconciliation.overall=PARTIAL`(hy-oas, macro-calendar, commodities-fx 등 13 PARTIAL / 2 BLOCKED) | 화면 값은 원값과 일치하나 durable 정합성 부채가 선언됨 |

## 5. 재현 방법(요약)

1. 서버(이미 실행 중) 확인: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8931/` → 200
2. `agent-browser --session <s> open http://127.0.0.1:8931/#macro` → `set viewport 1440 900` → `screenshot`
3. 본문/카드/축/체인 추출: 스크래치패드 `ex2.js`(`eval --stdin`, 결과를 base64 로 받아 `decode.js` 로 저장), details 내부는 `ex3.js`, 상태칩은 `ex7.js`
4. 데이터 재계산: `verify.js`(buildCloseSeries·yoy·trend·Sahm·payroll·term premium 재현) → `verify.txt`
5. `#fxbond` 로 이동해 2~4 반복, `agent-browser console` / `errors` 확인

증거 파일(스크린샷·추출 JSON·재계산 로그)은 세션 스크래치패드에만 저장했다:
`C:/Users/zmfhd/AppData/Local/Temp/commandcode/C--Projects-AIO/taste-onboarding-65b46882-10e8-40d2-a445-7a1d6d57df3b/scratchpad`
(리포에 스크립트/이미지를 만들지 않는 규칙 준수 — 세션 종료 시 정리되므로 위 5단계로 재생성)
