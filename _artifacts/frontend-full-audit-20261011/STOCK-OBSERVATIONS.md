# STOCK-OBSERVATIONS — AIO Screener 종목 화면 (#ticker · #technical · #fundamental)

- generatedAt: 2026-10-11 (오늘), 마지막 미국장 종가 2026-10-09 (금)
- server: http://127.0.0.1:8931 · symbols: NVDA, AAPL · capture: Node+Playwright 1스크립트 1회 실행 (스크래치패드 `stock-audit.js`)
- screenshots: `stock-{NVDA,AAPL}-{ticker,technical,fundamental}.png` (6장)
- 등급: A=틀린/낡은 데이터, B=같은 값 다른 basis, C=기준일/상태칩 오류, D=카피/UX

## 확인 포인트 결과
| # | 점검 | 결과 |
|---|------|------|
| CP1 | 세 탭 같은 회사 유지 + 종목명-티커 매칭 | PARTIAL — 요약/재무는 일치, **차트(#technical)는 기본 SPY** (STOCK-A1) |
| CP2 | 현재가 basis '직전 정규장 종가' / 차트 마지막 봉 10/9 | BLOCKED (라이브 시세·차트 plane 차단) |
| CP3 | 분기 라벨이 sec-fiscal-history와 일치 + 단위 표기 | PASS(라벨 일치) / FINDING(단위, STOCK-B2) |
| CP4 | 세 탭 간 최근 분기 매출 불일치 | NO-OVERLAP — 분기 매출은 #fundamental 한 곳($96.2B)에만 존재, 교차 불일치 없음 |
| CP5 | 스냅샷 리서치의 출처·기준일 동반 | PASS — '관찰 {시각} · {출처} · {가격기준}' 형식 확인 |

## Findings

### STOCK-A1 · A · route `#technical` · 일봉 차트 헤더
- expected: `NVDA 일봉` (선택 종목). keyPath: entity state id → `#stock-chart-input`=NVDA (index.html:6705 기본값 `SPY 일봉`)
- actual: 헤더 **`SPY 일봉`** 인데 `#stock-chart-input`=NVDA — 선택 종목과 불일치 (AAPL 방문 시엔 `AAPL 일봉`로 갱신되는 비결정적 동작)
- direction: 차트 탭 진입 시 현재 종목을 헤더/차트에 즉시 바인딩하고, 로드 실패 시에도 기본 SPY로 남지 않게. 세 탭이 같은 회사를 유지하도록 종목 주체를 라우트 간 전달·유지.
- confidence: medium-high

### STOCK-A2 · A · route `#fundamental` · '관측 항목' 개수
- expected: 7 (`sec-fundamentals.json[sym].coverage.length`=7) 또는 화면 전체 하나의 정의. keyPath: NVDA coverage=[revenue,netIncome,equity,sharesOutstanding,revGrowth,margin,roe]
- actual: `#fund-analysis-text` **"SEC FY 데이터 7개 항목 확인"** vs `#fund-native-sec-coverage` **"관측 항목 6개"** (sec-grid도 6개)
- direction: '관측 항목' 정의를 통일(요약=coverage 7 vs 보고=metrics 6으로 갈라짐). 같은 집계를 두 렌더러가 공유.
- confidence: medium

### STOCK-B1 · B · route `#fundamental` · ROE
- expected: 하나의 ROE 기준 + 라벨. keyPath: 평균자기자본 ROE=netIncome/((equity_t+equity_{t-1})/2), 기말 ROE=netIncome/equity_t
- actual: NVDA 재무흐름/기본보고 **101.5% (평균자기자본)** vs 관심종목 카드 **76.3% (기말)** — 한 화면 두 값. AAPL 171.4% vs 151.9% 동일 패턴
- direction: 카드에 '(평균자기자본 기준)'/'기말 기준' 라벨을 붙이거나 한 기준으로 통일.
- confidence: high

### STOCK-B2 · B · route `#fundamental` · SEC FY 요약 한 줄
- expected: `$215.9B` (또는 2,159억 달러), 재무흐름/secGrid와 같은 단위. keyPath: `sec-fundamentals.json NVDA.revenue=215938000000`
- actual: **"매출 215,938,000,000 · 순이익 120,067,000,000"** (단위·$ 없음) vs 같은 화면 `$215.9B`
- direction: 요약 줄도 $B/$M 축약 + '달러' 단위로 포맷(또는 전체 자릿수면 단위 라벨 명시).
- confidence: high

### STOCK-C1 · C · route `#ticker` · 현재가/등락
- expected: 현재가 라벨 '직전 미국 정규장 종가 (10/9)'. keyPath: `src/data/research-snapshots.js` basisLabel(regular-session-close='미국 정규장 종가', previous-regular-close='직전 미국 정규장 종가 대비')
- actual: 현재가·등락 `—`, **basis 라벨/칩 없음**; `#ticker-ov-prevclose`('전일 종가')도 `—`
- direction: 현재가에 출처·기준시점 칩 부착('직전 미국 정규장 종가 · 10/9'). live 차단 시에도 durable 종가로 라벨링.
- confidence: low (blocked-1과 결합)

### STOCK-C2 · C · route `#fundamental` · '기준일' 표기
- expected: as-of를 공시일(제출 2026-02-25)로 명시하거나 '회계연도 말'로 구분. keyPath: NVDA observedAt=2026-01-25, filedAt=2026-02-25
- actual: `#fund-analysis-text` **"기준일 2026-01-25"**(=회계연도 말) vs 같은 화면 meta "회계연도 말 2026-01-25 · 제출 2026-02-25"
- direction: '기준일'→'회계연도 말' 통일 또는 제출일 병기(데이터 최신 시점 오해 방지).
- confidence: medium

### STOCK-C3 · C · route `#ticker` · 종목 개요 '가격 정보' 위젯
- expected: 52주 범위 값. keyPath: 같은 화면 stock-read가 '52주 범위 82% 지점' 계산(스크리너 아티팩트)
- actual: **`52주 범위 —`, `전일 종가 —`** (빈값) — 같은 페이지 stock-read는 82% 표시
- direction: 위젯 52주 범위를 stock-read와 같은 스크리너 수집본에서 채우거나 빈값 사유를 행 옆에 표기.
- confidence: medium

### STOCK-D1 · D · route `#technical` · 차트 미수신 안내 문구
- expected: 현재 종목명 사용 / 전환 시 초기화
- actual: AAPL로 전환해 헤더가 'AAPL 일봉'이어도 안내는 **"SPY 시세를 받아오지 못했습니다"** 잔존(이전 SPY 시도 문구)
- direction: 종목 전환 시 이전 실패/상태 문구 초기화 후 현재 심볼로 재작성.
- confidence: medium

### STOCK-D2 · D · route `#ticker` · 1개월 수익률 중복
- expected: 기준 라벨과 함께 1회 표기
- actual: '지난 1개월 수익률 +5.0%'(위젯)와 '수익률 — NVDA vs S&P 500 · 1개월 +5.0%'(stock-read) 중복
- direction: 위젯 수익률 행 제거(차트가 대신) 또는 기준 라벨을 한 곳으로.
- confidence: medium

## 데이터와 일치(정상) 항목
- 종목명-티커 매칭: NVDA=NVIDIA Corporation / AAPL=Apple Inc.; SEC 기본 보고 제목 NVIDIA CORP / Apple Inc.
- NVDA 연간 FY2021..FY2026, FY2026 매출 $215.9B(+65.5%) — sec-fiscal-history 일치
- NVDA 분기 라벨 24.10/25.01*/25.04/25.07/25.10/26.01*/26.04/26.07 및 $B 값 = artifact quarters 정확 일치 (*=derived 'd')
- AAPL 연간 FY2020..FY2025, FY2025 $416.2B(+6.4%); AAPL 분기 부재를 '연결 안 됨'으로 정상 처리
- basis/as-of 칩: `#fund-data-status`(기준 2026-01-25 + data-observed-at), `#ticker-ov-provenance`('수익률·팩터: 스크리너 아티팩트'), stock-read 각주('10/9 종가 기준 스크리너 수집본')
- `#technical` regime '10/9 미국 종가 기준 · 우호 3 · 중립 0 · 부담 3'
- 리서치 스냅샷 본문에 출처·관찰시각·가격기준 라벨 포함

## Blocked
1. **현재가·등락 실측 및 basis('직전 정규장 종가') 대조** — durable 아티팩트에 종목별 시세 없음(market-snapshot 16종=지수/FX/원자재/크립토, history.json hasStockSeries=false). 라이브 plane은 Cloudflare worker 프록시가 origin 127.0.0.1 거부(ACAO=https://ysnle.github.io) → hero '—'.
2. **차트 마지막 봉=10/9 및 기간** — 종목별 OHLCV는 provider fetch(Yahoo chart NVDA 3mo) 필요 → worker CORS 차단, rowCount=0. durable history.json에 종목 시계열 없음.
3. **관련 뉴스 3건 회사 관련성** — `#ticker`에 회사 뉴스 블록 없음(1M/3M/6M/1Y 버튼뿐). `#fundamental` 뉴스는 숨은 legacy fold(`#fund-rpt-news`, Finnhub /company-news)로 키 미설정 → 항목 없음.
4. **콘솔 에러 327건 앱-귀속 판정** — 대부분 worker 프록시 CORS·CDN preload integrity mismatch·403. 환경/설정 문제.
5. **AAPL 분기 라벨 대조** — sec-fiscal-history.json에 AAPL `quarters` 없음 → 대조 원본 부재.

## Counts
- findings: A=2 · B=2 · C=3 · D=2 (total 9) · consistent=7 · blocked=5 · consoleEvents=327
