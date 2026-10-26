# 종목

종목 is one company viewed three ways: 요약, 차트 and 재무 공시. The user searches by ticker, 6-digit KR code or Korean name, and the hub bar keeps naming the same company (and where they came from) across all three tabs.

## Sub-features

- `stock-search` — `#ticker-direct-search` + Enter or `분석 →`; quick chips (NVDA, AAPL, MSFT, 삼성전자). `005930` / `삼성전자` normalize to `005930.KS`.
- `stock-summary` — hero `#ticker-hero-name`, `#ticker-hero-fullname`, `#ticker-hero-price` (number or `—`), basis line `#ticker-summary-price-basis` that explains a missing price.
- `stock-chart` — 차트 tab's visible chart is the stock-chart component: `#stock-chart-form` / `#stock-chart-input`, title `#stock-chart-title` = `<SYM> 일봉`. The legacy folds below it (incl. `#deep-analysis-section`) are hidden outside `body.aio-dev-mode` (P702) — never drive them.
- `stock-subject` — `#aio-hub-tabs .aio-hub-subject strong` = the symbol on all three tabs.
- `stock-invalid` — input failing `^[A-Z0-9.-]{1,12}$` shows the persistent `#ticker-search-hint` (role=status, "…정확히 일치하는 종목이 없습니다" with candidates) and the subject stays; a well-formed unknown (e.g. `ZZZZ`) opens with `시세 수신 대기`.

## How to get to it (user POV)

- Sidebar 내 투자 › 종목, then search.
- A ticker in 스크리너 (Why drawer), 테마 detail, 포트폴리오 or news opens it here.
- Deep links `#ticker`, `#technical`, `#fundamental`.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `종목`. `page-ticker`; tabs exactly `요약,차트,재무 공시`.
- **Search.** Fill `NVDA`, Enter. Subject `NVDA`; price is a number or `—`; when `—`, `#ticker-summary-price-basis` is non-empty.
- **Chart / filings.** Tabs `차트` → `page-technical`, `재무 공시` → `page-fundamental`; subject stays `NVDA` (failure if lost). Tab `요약` returns to the same hero.
- **Chart follows the company.** On 차트, `#stock-chart-title` starts with `NVDA` (failure if it stayed on SPY or the previous company).
- **Korean name.** Fill `삼성전자`, Enter. Subject `005930.KS`; hero name contains `삼성전자`.
- **Korean candidate.** Fill `애플` (no Enter), click the `#ticker-suggest` button. Subject `AAPL`; the 재무 tile leaves '불러오는 중' within 4 s (P2088/R728: late repaints use the latest state).
- **Invalid.** Fill `!!`, Enter. `#ticker-search-hint[role=status]` names the miss; the subject is unchanged.
- **Proof.** `drive stock` evidence; `report.json` records `priceState`.

## Gotchas

- The hero price comes only from live quotes / the Yahoo chart call (`_liveData`); no public-data snapshot holds a stock close. On 127.0.0.1 it is `—` with basis `시세 제공처 응답 없음 …`. Numeric prices are verified only on the Pages origin.
- Chart OHLCV is CORS-blocked locally, so the chart shows its 시세를 받아오지 못했습니다 card; the title still names the symbol. Drawn candles are verified only on the Pages origin.
- SEC filings fetches are CORS-blocked locally too; 재무 공시 shows its stored snapshot or an explicit missing state.
