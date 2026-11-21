# 종목

종목 is one company viewed three ways: 개요, 쟁점과 전망 and 재무 공시 (owner 2026-11-21: the first two are views of `page-ticker`, `data-view=overview|outlook`, shown as hub tabs; the page's own `.page-views` row is hidden). The user searches by ticker, 6-digit KR code or Korean name, and the same company stays selected across the tabs: on 재무 공시 the hub bar names it (plus `다른 종목` and where they came from); on 개요 the hub bar keeps only the way back, and the route `#ticker?sym=<SYM>` plus the hero name it (v59.55). The company's chart is read on 기술적 분석: the hub bar's `기술적 분석에서 보기` opens it there (owner 2026-11-19, the 차트 tab is retired).

## Sub-features

- `stock-search` — v59.70 (D4): `#ticker-search-open` (and the hub's `종목 고르기`/`다른 종목`) opens the command search's 종목 scope: registry and KRX names as you type, US listing names from the third Latin letter, the typed symbol as a `data-kind=typed` row checked against the listing; Enter opens the first row. Quick chips (NVDA, AAPL, MSFT, 삼성전자) stay. `005930` / `삼성전자` resolve to `005930.KS`. From 재무 공시 the pick keeps that tab; from 기술적 분석 it opens in that page's analysis slot.
- `stock-summary` — hero `#ticker-hero-name`, `#ticker-hero-fullname`, `#ticker-hero-price` (number or `—`), basis line `#ticker-summary-price-basis` that explains a missing price, and `#ticker-hero-line` (what the company is).
- `stock-overview` — `#ticker-company` (2026-11-19): sections 사업 · 밸류체인 안의 자리 · 재무 한눈에 (`[data-company-section=business|place|money]`), nothing folded but 원자료 표 / 계산 방법 / 데이터 출처; it ends on one link `[data-company-next=outlook]` (`쟁점과 전망: <핵심 쟁점> →`); then `내 메모`. A company outside the AI map gets one line in 밸류체인 안의 자리.
- `stock-outlook` — `#ticker-outlook` on `#ticker?sym=<SYM>&view=outlook`: section 쟁점과 전망 (`[data-company-section=outlook]`: 핵심 쟁점, 잘 안 보이는 구조, 회사가 밝힌 전망과 계획, 이야기가 맞는지 보는 신호); the search and the company head stay, `#ticker-company` and `내 메모` are hidden. A company without a researched story shows `쟁점과 전망 자료 없음`.
- `stock-chart-link` — `#aio-hub-tabs .aio-hub-subject-chart` (`기술적 분석에서 보기`) opens `page-charts` with the company in `#stock-chart-section` (title `#stock-chart-title` = `<SYM> 일봉`). See `charts.md`.
- `stock-subject` — `#aio-hub-tabs .aio-hub-subject strong` = the symbol on 재무 공시.
- `stock-invalid` — text matching nothing shows `‘…’ 검색 결과가 없습니다`; a well-formed symbol the listing refuses (e.g. `ZZZZQ`) stays in the dialog with `#aio-command-status` "…목록에 없는 기호입니다"; the subject stays. A `showTicker` call with a name or a refused deep link still writes `#ticker-search-hint` (role=status, with candidates) under the 종목 search button.

## How to get to it (user POV)

- Sidebar 내 투자 › 종목, then search.
- A ticker in 스크리너 (Why drawer), 테마 detail, 포트폴리오 or news opens it here.
- Deep links `#ticker`, `#ticker?sym=<SYM>&view=outlook`, `#fundamental`. The old `#technical/<SYM>` opens 기술적 분석 with that symbol.

## Driving it with verify-aio

Preconditions:

- Doctor OK.

- **Open.** Click sidebar `종목`. `page-ticker`; tabs exactly `개요,쟁점과 전망,재무 공시`.
- **Search.** Click `#ticker-search-open`, fill `NVDA` in `#aio-command-input`, Enter. Subject `NVDA`; price is a number or `—`; when `—`, `#ticker-summary-price-basis` is non-empty.
- **Issues.** Tab `쟁점과 전망` → still `page-ticker`, address `view=outlook`, `#ticker-outlook` shows 핵심 쟁점, `#ticker-company` hidden, hero unchanged. Tab `개요` returns; its last line links to 쟁점과 전망.
- **Filings.** Tab `재무 공시` → `page-fundamental`; subject stays `NVDA` (failure if lost). Tab `개요` returns to the same hero.
- **Chart follows the company.** Click `기술적 분석에서 보기`: `page-charts`, `#stock-chart-title` starts with `NVDA` (failure if it stayed on SPY or the previous company). Sidebar `종목` returns.
- **Korean name.** Same box, fill `삼성전자`, Enter. Subject `005930.KS`; hero name contains `삼성전자`.
- **Korean candidate.** Fill `애플` (no Enter), click the `AAPL` row in `#aio-command-results`. Subject `AAPL`; 재무 한눈에 shows its figures (not '불러오는 중') within 4 s (P2088/R728: late repaints use the latest state).
- **Invalid.** Fill `!!`, Enter: `검색 결과가 없습니다`. Fill `ZZZZQ`, Enter: the status line refuses it. Esc; the subject is unchanged.
- **Proof.** `drive stock` evidence; `report.json` records `priceState`.

## Gotchas

- The hero price comes only from live quotes / the Yahoo chart call (`_liveData`); no public-data snapshot holds a stock close. On 127.0.0.1 it is `—` with basis `시세 제공처 응답 없음 …`. Numeric prices are verified only on the Pages origin.
- Chart OHLCV is CORS-blocked locally, so the 기술적 분석 slot shows its 시세를 받아오지 못했습니다 card; the title still names the symbol. Drawn candles are verified only on the Pages origin.
- SEC filings fetches are CORS-blocked locally too; 재무 공시 shows its stored snapshot or an explicit missing state.
