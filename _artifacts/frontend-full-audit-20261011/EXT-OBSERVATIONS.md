# EXT-OBSERVATIONS — AIO Screener 2026-10-09 (Fri) US close vs external public data

- **Artifact:** `_artifacts/frontend-full-audit-20261011/EXT-OBSERVATIONS.md`
- **Generated:** 2026-10-11 (Sunday)
- **Reference session:** 2026-10-09 (Fri) US close. KRX was **closed** on 2026-10-09 (Hangul Day), so 2026-10-08 is the latest KRX close.
- **Method:** `web_search` / `web_fetch` cross-check only. **Verification-only** — no repo data file was modified, no git, local server 127.0.0.1:8931 untouched.
- **Tolerances:** prices/futures > 0.20% = mismatch; index points > 0.10% = mismatch; rates > 0.03 %p = mismatch. Rounding-digit differences = match (noted).

## Source files read (AIO side)

| File | Revision / as-of |
|---|---|
| `public-data/market-snapshot.json` | `market-snapshot:2026-10-10T15:23:15.089Z:b98b55b4` (schema `market-snapshot-v2`) |
| `public-data/data.json` | `meta.generatedAt 2026-10-10T15:23:15.089Z` |
| `public-data/history.json` | last element `date=2026-10-10`, `cycleEnd=2026-10-09T23:00:00.000Z` |
| `public-data/breadth-contributors.json` | `generatedAt 2026-10-10T13:01:40.601Z` |

## Main comparison table

| 지표 | AIO 값 (키 경로 · 기준일) | 외부 값 (출처 URL) | 오차 | 판정 |
|---|---|---|---|---|
| S&P 500 | 7,811.54 · `market-snapshot.json:quotes[metricId=market.index.spx].value` · 2026-10-09T21:29:56Z | 7,811.54 · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026), [CNBC](https://www.cnbc.com/2026/10/08/stock-market-today-live-updates.html) | 0.000% | **일치** |
| 나스닥 종합 | 27,366.17 · `quotes[market.index.nasdaq].value` · 2026-10-09T21:15:59Z | 27,366.17 · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026), [businessquant](https://businessquant.com/economic-data/usnasdaq/) | 0.000% | **일치** |
| 다우존스 | 51,654.95 · `quotes[market.index.dow].value` · 2026-10-09T20:37:50Z | 51,654.95 · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026), [dowjonestoday](https://dowjonestoday.net/), [measuringworth](https://www.measuringworth.com/datasets/DJA/index.php) | 0.000% | **일치** |
| 10Y 국채 금리 | 5.244 (`^TNX`) · `quotes[market.rates.us10y].value` · 2026-10-09T18:59:55Z; dgs10=5.24 · `data.json:macro._treasury.values.dgs10` · 2026-10-09 | 5.24% · [Advisor Perspectives](https://www.advisorperspectives.com/dshort/updates/2026/10/09/treasury-yields-snapshot-october-9-2026), [Treasury Rate Watch](https://treasuryratewatch.com/daily/treasury-yield-curve) | 0.004 %p (^TNX) / 0.000 %p (dgs10) | **일치** |
| 2Y 국채 금리 | 4.80 · `data.json:macro._treasury.values.dgs2` (`_asOf_dgs2=2026-10-09`) | 4.80% · [Advisor Perspectives](https://www.advisorperspectives.com/dshort/updates/2026/10/09/treasury-yields-snapshot-october-9-2026), [RIA Circle](https://www.riacircle.com/news/11591455) | 0.000 %p | **일치** |
| 달러 인덱스 (DXY) | 102.231 · `quotes[market.fx.dxy].value` · 2026-10-09T20:59:59Z | 102.22 · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026); 102.21 [StreetStats](https://streetstats.finance/liquidity/fx); 102.23 [Convex](https://convextrade.com/metrics/dxy/history/2026) | +0.011% | **일치** |
| USD/KRW | 1,340.9 · `quotes[market.fx.usdkrw].value` · 2026-10-10T03:30:56Z | 1,341.49 · [nimbuscalc (2026-10-09)](https://www.nimbuscalc.com/calculators/financial-calculators/currency-converter/USD-KRW-2026-10-09/) | 0.044% | **일치** |
| WTI 유가 | 91.85 · `quotes[market.commodity.wti].value` · 2026-10-09T20:59:58Z | 91.85 · [World Oil Monitor](https://worldoilmonitor.com/daily-oil-market-summary), [Convex](https://convextrade.com/metrics/wti) | 0.000% | **일치** |
| 금 (GC=F) | 4,216.3 · `quotes[market.commodity.gold].value` · 2026-10-09T20:59:59Z | 4,220.60 · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026) (spot range 4,185–4,227) | 0.102% | **일치** (출처 분산 ±0.7% 주의, basis: 선물 vs 현물) |
| VIX | 14.84 · `quotes[market.volatility.vix].value` · 2026-10-09T20:15:01Z | 14.84 · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026), [BullionMarketCap](https://www.bullionmarketcap.com/commodities/vix) | 0.000% | **일치** |
| 비트코인 — EOD (history) | 82,546.32 · `history.json.last.btc` (valueBasis `previous-completed-close`, 2026-10-09) | 82,546.32 · [StatMuse](https://www.statmuse.com/money/ask/bitcoin-prices-2026), [TapeWire](https://thetapewire.com/btc/); 82,543 [Macrotrends](https://www.macrotrends.net/3230/btcusd-bitcoin-daily-price-chart) | 0.000% | **일치** |
| 비트코인 — live (snapshot) | 82,871.3 · `quotes[market.crypto.btc].value` (session `CURRENT_SESSION`) · 2026-10-10T15:22:01Z | 82,546.32 (2026-10-09 close) · [StatMuse](https://www.statmuse.com/money/ask/bitcoin-prices-2026) | **+0.394%** | **불일치 (B)** — 값 오류 아님, basis: 라이브 시세 vs 10/9 종가 |
| 상승/하락 종목 수 (breadth) | **null** · `history.json.last.advanceDecline` / `advanceRatio` / `breadth*` (10/9 블록 비어 있음). 참고: `breadth-contributors.json.sessions[2026-10-09].signals` = up4:22 / down4:11 (유니버스 810종목 ±4%) | 5,798 상승 / 3,668 하락 · [stocksetups](https://stocksetups.com/today) | — | **판정불가** (AIO 미표시 + basis 상이) |
| Russell 2000 *(bonus)* | 2,806.9814 · `quotes[market.index.russell2000].value` · 2026-10-09T20:30:16Z | 2,806.97 · [Stockysis](https://www.stockysis.com/blog/market-summary-2026-10-09) | 0.0004% | **일치** |
| KOSPI *(bonus, 10/8)* | 6,625.93 · `quotes[market.index.kospi].value` · **2026-10-08**T11:05:40Z | 6,625.93 · [biggo/KRX](https://finance.biggo.com/news/7427f2e6-c4f2-4e01-b049-e2c0d6ae9a0a), [Tradingeconomics](https://tradingeconomics.com/south-korea/stock-market) | 0.000% | **일치** (stale 아님 — 10/9 한글날 휴장) |
| KOSDAQ *(bonus, 10/8)* | 892.27 · `quotes[market.index.kosdaq].value` · **2026-10-08**T11:05:40Z | 892.27 · [Seoul Economic Daily](https://en.sedaily.com/finance/2026/10/08/kosdaq-falls-069-percent-to-close-at-89227) | 0.000% | **일치** (stale 아님 — 10/9 한글날 휴장) |
| 13주 T-bill `^IRX` *(bonus)* | 4.057 · `quotes[market.rates.us13w].value` · 2026-10-09T18:59:55Z | 4.16% · [Treasury Rate Watch](https://treasuryratewatch.com/daily/treasury-bill-rates) | **0.103 %p** | **불일치 (B)** — basis: ^IRX 디스카운트 기준 vs Treasury bill 기준 |
| 이더리움 *(bonus)* | 2,505.5 · `quotes[market.crypto.eth].value` (`CURRENT_SESSION`) · 2026-10-10T15:22:00Z | 2,480.86 (10/9 종가) · [finlore.io](https://finlore.io/news/sp500-closes-7811-near-52-week-high-vix-1484-october-9-2026) | +0.993% | **판정불가** (아님 basis: 라이브 vs EOD) |
| VIX3M *(bonus)* | 17.77 · `quotes[market.volatility.vix3m].value` · 2026-10-09T20:15:01Z | — (신뢰 출처 미확보) | — | **판정불가** |
| VVIX *(bonus)* | 84.88 · `history.json.last.vvix` · 2026-10-09 | — (미검증) | — | **판정불가** |

## 불일치 상세 (재현 절차 포함)

### B-1. `btc-live` — BTC 라이브 시세 vs 10/9 종가 (basis 불일치)
- **AIO 값:** `market-snapshot.json → quotes[metricId=market.crypto.btc].value = 82,871.3`, `session="CURRENT_SESSION"`, `quality="CURRENT"`, `observedAt=2026-10-10T15:22:01.000Z`.
- **외부 값:** 82,546.32 (2026-10-09 종가) — StatMuse / TapeWire / Macrotrends(82,543).
- **오차:** +324.98 (+0.394%) → 0.2% 초과.
- **등급 B (값 오류 아님, basis 불일치):** 스냅샷 값은 10/10 15:22Z에 캡처된 **인트라데이 라이브 시세**이며 10/9 종가가 아니다. 동일 시리즈의 EOD 값(`history.json.last.btc = 82,546.32`)은 외부와 정확히 일치.
- **재현:** `history.json` 마지막 원소(`date=2026-10-10`, `valueBasis=previous-completed-close`)와 `market-snapshot.json`의 BTC quote `session` 필드를 비교. 화면이 82,871.3을 "10/9 종가"로 라벨하면 B/A 경계 이슈 → **레이블/렌더러 수정** 권고(값 자체 수정 아님).

### B-2. `us13w` — ^IRX vs 13주 T-bill (basis 불일치, 범위 외)
- **AIO 값:** `market-snapshot.json → quotes[market.rates.us13w].value = 4.057` (`observedAt=2026-10-09T18:59:55Z`).
- **외부 값:** 4.16% ([Treasury Rate Watch](https://treasuryratewatch.com/daily/treasury-bill-rates), "4.16% on the 13-Week Oct 9 2026").
- **오차:** 0.103 %p → 0.03 %p 초과.
- **등급 B:** `^IRX`는 Cboe의 13주 T-bill **디스카운트 기준** 지수이고, 외부 4.16%는 Treasury bill-rate 기준 → 기준(basis) 차이. 요구 지표 목록 밖 → 참고 플래그만.
- **재현:** ^IRX 정의(Cboe 13-week T-bill discount index)와 U.S. Treasury 13-week bill quote 기준을 문서화하지 않으면 두 값을 직접 비교 불가.

## stale 판정

| 시리즈 | AIO 기준일 | 갱신 주기 | 판정 | 근거 |
|---|---|---|---|---|
| KOSPI / KOSDAQ | 2026-10-08 | KRX 영업일 daily | **stale 아님** | 2026-10-09는 한글날(KRX 휴장) → 10/8이 최신 완료 종가. 외부 10/8 종가와 정확 일치. |
| USD/KRW | 2026-10-10T03:30:56Z | 연속 FX | **허용** | 주말 아시아 FX 프린트이나 값은 10/9 종가와 동일(0.04%). |
| BTC (snapshot) | 2026-10-10T15:22:01Z | 연속 | **basis 주의** | EOD가 아닌 라이브 시세. EOD 시리즈(history)는 외부와 정확 일치. |

## 배제한(불신) 출처 — 기록

| 출처 | 주장 | 처리 |
|---|---|---|
| tickerdaily.com | 10Y가 18bp 하락해 3.92% | **미사용** — 4개 독립 출처 + U.S. Treasury par curve(5.24%)와 상충 |
| globaloilshock.com | WTI $90.28 (10/9) | **미사용** — worldoilmonitor/convextrade($91.85)와 상충 |
| strota.in | KOSPI 6,754.05 (10/8) | **미사용** — biggo/trendonify/tradingeconomics(6,625.93)와 상충 |
| Yahoo Finance 사이드바 | VIX 14.95, 금 4,634.40, BTC 79,460.34 | **미사용** — 이후 시점의 라이브 사이드바, 10/9 종가 아님 |

## 요약

- 대조 행: **20** (요구 13 + 부가 7)
- **일치 14 / 불일치 2 / 판정불가 4** · 등급 A(틀린 값 표시) **0건**, 등급 B(basis) **3건**(btc-live, us13w, eth-live)
- 요구 지표(S&P 500, 나스닥, 다우, 10Y, 2Y, DXY, USD/KRW, WTI, 금, VIX, BTC-EOD)는 **전부 일치**.
- 권고는 "레이블/렌더러 수정" 또는 "data-refresh 필요"로만 기술(위 `recommendations` 참조). 리포 데이터 파일은 미수정.
