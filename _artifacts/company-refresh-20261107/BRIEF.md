# Company story refresh and expansion brief (2026-11-07)

The owner (lee) asked, 2026-11-07: improve the quality of each company's content, widen coverage, and add more
companies. The page now leads with 핵심 쟁점 (debate), 돈과 기술의 흐름 (a graph built from the stories' customer,
partner, money-flow and competitor lines), 숫자 뒤의 구조 (underTheHood) and the industry's workings, before the
step-by-step story. Today is 2026-11-07 (KST). Repository: `/home/user/aio-screener`.

## Two kinds of assignment

**UPDATE `<SYMBOL>`**: first find the company's newest quarterly or annual report (earnings release, 10-Q/10-K,
20-F/6-K, DART 분기/반기보고서 or 잠정실적). If it was released **on or before the story's `researchedAt`** and the story
already uses it, write nothing and report `no newer report`. Otherwise copy `public-data/company-profiles/<SYMBOL>.json`
to `_artifacts/company-refresh-20261107/profiles/<SYMBOL>.json` and rewrite what that report changed: `earnings`
(period = the new quarter or year; revenue, margins, cash flow, segments), `useOfCash` where the report gives quarter or
year-to-date figures, `guidance` (latest and what changed), `estimates` if present, `watch`, `trading.calendar` (drop
past events, add the next known one), `strategy` / `aiChain.aiRevenue` / `sell.customers` only where the report or call
said something new. Fill any `null` value or `unverified` item you can now confirm, and remove it from `unverified`.
Then **rewrite `debate` and `underTheHood`** so they reflect the new numbers (rules below). Set `researchedAt` to
`2026-11-07`. Keep old source ids; add new sources after the last id; drop a source only if nothing cites it.

**NEW `<SYMBOL>`**: write `_artifacts/company-refresh-20261107/profiles/<SYMBOL>.json` from scratch in the exact shape
of `_artifacts/company-profile-pilot-20261028/SCHEMA-v2.md` (read it first), plus `debate` and `underTheHood`. Read two
finished stories first: `public-data/company-profiles/NVDA.json` and one close to your company (e.g. `005380.KS.json`
for a Korean manufacturer, `JPM.json` for a bank, `GE.json` for industrials). Korean listings: use the K-IFRS 연결
figures from DART or the company IR, unit `KRW tn` or `KRW bn`; `name` is the English legal name, and put the Korean
name in the report so it can be registered.

## Sources

- Primary first: the filing or earnings release, the IR site, the latest call transcript or prepared remarks, DART.
  `www.sec.gov` and DART may be unreachable from this machine: use the company IR copy of the same document or a
  reputable mirror, and cite what you actually read (https URL + date).
- Every number has a source id and a date. Nothing from memory. A number you cannot confirm is `null` and goes into
  `unverified`.
- Do not send personal data anywhere, do not create accounts, do not run `scripts/fetch-*`.

## Writing rules (story)

- Korean prose, plain, professional, direct. Each `text` is 2-4 sentences that follow from the step before. Say plainly
  how AI spending (or, for a non-AI business, its own end demand) reaches the income statement, which customers and
  products carry it, and what would break it.
- No "전문가가 보는" labels. No quizzes or question chips. No trade instructions (entry, stop, target price, size,
  timing, 사세요/파세요/비중). `trading.conditions` lists conditions a trader checks, never orders.
- `aiChain.layer` is one value from the schema list. `moneyFlow.steps` has 3-6 arrows with real names where disclosed.
  `useOfCash` items with use `other` or `customer financing` need a Korean `label`. Units are from `STORY_UNITS` in
  `src/domain/entity/company-story.js`.
- **Name other companies by their common English name** (NVIDIA, TSMC, Samsung Electronics, SK hynix, Microsoft,
  Amazon, Hyundai Motor, Kia, LG Energy Solution …) in `sell.customers`, `make.partners`, `aiChain.sellsTo`,
  `aiChain.dependsOn`, `moneyFlow.steps` and `competition.arenas[].rivals`. Put the company first in a customer line,
  then " - " and the detail ("Hyundai Motor - 전기차 배터리 공급"). The graph links companies only by exact names.

## debate and underTheHood

```json
"debate": {
  "question": "명사절로 쓴 한 가지 쟁점 (…는지 / …인지로 끝남, 물음표 없음, 70자 안팎)",
  "bull": { "text": "이야기가 유지된다는 읽기, 2-3문장, 구체적 사실", "src": ["s1"] },
  "bear": { "text": "이야기가 깨진다는 읽기, 2-3문장, 구체적 사실", "src": ["s7"] },
  "decides": [ { "when": "날짜나 기간 (story가 주는 대로)", "what": "판가름할 관찰 가능한 사실", "src": ["s11"] } ]
},
"underTheHood": [ { "title": "24자 이하 명사구", "text": "2-3문장: 빠른 읽기가 놓치는 구조와 그것이 숫자 읽기에 왜 중요한지", "src": ["s3"] } ]
```

- Only facts in the story itself (cite its own source ids). `question` must not end with `?`, 는가, 인가, 은가, 할까,
  을까, 일까. `decides` 1-3 items; `underTheHood` 2-4 items. Bull and bear are both real and do not mirror each other.
  Describe readings as readings ("~라고 보는 쪽은 … 근거로 든다"); no invented consensus, no price-news causality.
- Good underTheHood subjects: who finally pays and how far end demand is; circular money (a supplier financing or
  investing in its customer); purchase / supply commitments versus revenue; concentration; order → capacity → revenue
  lags; where pricing power sits; accounting basis (depreciation life, non-GAAP vs GAAP, cumulative vs single quarter);
  regulatory or export dependence; a segment that funds another.

## Check before you finish

`node scripts/ci-company-profile-contract-check.mjs --dir _artifacts/company-refresh-20261107/profiles` and fix every
issue for YOUR symbols (others write into the same folder; ignore and never edit their files). Edit nothing outside
`_artifacts/company-refresh-20261107/profiles/<your symbols>.json`.

## Report back

One line per symbol: `updated` / `new` / `no newer report`; period used; sources (primary count); anything important
left in `unverified`; for NEW symbols, the exact names other companies use for it (English and Korean, e.g.
`LG Energy Solution, LG에너지솔루션, LGES`).

## Second wave notes (2026-11-07 17:00 UTC)

- WebFetch is limited to 100 calls per hour shared by every agent, and curl to sec.gov / IR sites is blocked. Use at
  most 3 fetches per symbol: the earnings release first (8-K Ex.99.1, IR PDF or a verbatim repost such as Finviz or
  StockTitan), then the 10-Q or call transcript only if budget allows. When a fetch is refused for budget, wait about
  10 minutes and continue; do not skip a symbol for budget alone, and do not write numbers from search-result titles.
- Consensus may come from `public-data/consensus-estimates.json` (cite it as a source with its date).
- Never name customers, partners or rivals from general knowledge: only names a source you read states. Leave the rest
  out (the graph draws a link for every exact name).
