# Company story re-base brief (2026-11-08): headline numbers onto the latest reported quarter

Owner (lee) asked, 2026-11-08: fundamentally raise the quality of the company/financial analysis so users get
fresh, correct, connected readings built from primary sources. Today is 2026-11-08 (KST). Repository:
`/home/user/aio-screener`.

## Why this wave exists

57 stories carry an `earnings` block whose period ended more than 120 days before the story's own research date
(NVDA shows FY2026 ended 2026-01-25, AVGO FY2025 ended 2025-11-02 …). The face of the page (four numbers, segment
bars, the period label) therefore shows numbers 4-12 months old, while the debate and industryMetric already quote the
latest quarter. A reader sees two periods mixed on one screen. Professional tear sheets lead with the latest reported
quarter (with year-over-year change) and keep the fiscal year as context. This wave fixes that at the source.

## Your assignment: RE-BASE `<SYMBOL>`

1. Find the company's **latest reported quarter** as of 2026-11-08 (earnings release / 8-K Ex.99.1 / 6-K / 10-Q /
   IR PDF; Korean listings: company IR 잠정실적 or 분기보고서). If the company reported again after the story's
   `researchedAt`, that newer report is the one.
2. Copy `public-data/company-profiles/<SYMBOL>.json` to
   `_artifacts/company-refresh-20261108/profiles/<SYMBOL>.json` and edit the copy only.
3. Rewrite `earnings` for that **single quarter** (3 months, not year-to-date, not fiscal year):
   - `period`: e.g. `"Q3 2026 (ended 2026-09-30)"` or `"Q2 FY2027 (ended 2026-07-26)"`.
   - **new field** `periodEnd`: the quarter's last day, ISO `YYYY-MM-DD` (required).
   - **new field** `basis`: `"quarter"`.
   - `revenue.value/unit/yoy` (yoy = vs the same quarter a year earlier, percent), `grossMargin`, `operatingMargin`,
     `netMargin` (GAAP; say in `text` if a figure is non-GAAP), `operatingCashFlow`, `freeCashFlow` for the quarter
     (if the release gives only year-to-date cash flow, put YTD cash flow in `useOfCash` and set the quarter's cash
     values to `null` rather than mixing periods).
   - `segments`: the quarter's segment revenue with `share` and `yoy`.
   - `industryMetric`: keep the metrics this industry is judged by, refreshed to the same quarter.
   - `text`: 2-4 sentences. First the quarter, then **one sentence of fiscal-year/TTM context** (e.g. "직전 회계연도
     FY2026 매출은 2,159억 달러였다") so scale is not lost.
4. `useOfCash`: the latest period the report gives (quarter or year-to-date); state it in `useOfCash.period`.
5. Refresh `guidance.latest` (newest guide; drop superseded ones), `guidance.track`, `estimates` (may cite
   `public-data/consensus-estimates.json` as a source with its date), `watch`, `trading.calendar` (drop past events,
   add the next known report date), and `aiChain.aiRevenue` / `strategy` / `sell.customers` only where the new
   report or call said something new.
6. **Rewrite `debate` and `underTheHood`** so they reflect the new numbers (rules in
   `_artifacts/company-refresh-20261107/BRIEF.md` §debate and underTheHood — read that file once).
7. Set `researchedAt` to `2026-11-08`. Keep old source ids; add new sources after the last id; drop a source only if
   nothing cites it.

If the latest reported quarter is already the story's `earnings` period (rare in this list), still add `periodEnd`
and `basis`, and report `already quarterly`.

## Korean-reader rules that this wave also fixes

- `guidance.latest[].metric` is **Korean**: 매출, 매출총이익률, 영업이익률, 영업비용, 조정 EPS, GAAP 희석 EPS,
  조정 EBITDA, 잉여현금흐름, 설비투자, 자사주 매입 … (keep a term like EBITDA, EPS, ARR, RPO as is inside Korean).
- `aiChain.dependsOn` / `aiChain.sellsTo` items start with a Korean description, never a raw layer slug.
  Wrong: `"semicap-foundry (TSMC, Samsung 웨이퍼·CoWoS 패키징)"`. Right: `"장비·파운드리 (TSMC, Samsung 웨이퍼·CoWoS 패키징)"`.
  Layer names: 전력·에너지, 냉각·전기 설비, 데이터센터 부동산, 장비·파운드리, 메모리, 연산 칩, 네트워크, 클라우드,
  모델·플랫폼, 소프트웨어·앱, 기기, AI를 쓰는 기업.

## Sources and honesty (unchanged, strict)

- Primary first. Every number has a source id and a date. Nothing from memory. A number you cannot confirm is `null`
  and goes into `unverified`. Do not write numbers from search-result titles or snippets.
- WebFetch is limited (about 100 calls per hour shared by all agents; sec.gov and many IR sites refuse curl). Use at
  most 3 fetches per symbol: the earnings release first (8-K Ex.99.1, IR PDF, or a verbatim repost such as StockTitan,
  GlobeNewswire, Business Wire, PR Newswire), then the call transcript if budget allows. When refused for budget, wait
  about 10 minutes and continue.
- Never name customers, partners or rivals from general knowledge: only names a source you read states.
- Name other companies by their common English name (NVIDIA, TSMC, Samsung Electronics, SK hynix, Microsoft …) in
  customers, partners, sellsTo, dependsOn, moneyFlow and rivals. The graph links companies by exact names.
- No quizzes, no question chips, no "전문가가 보는" labels, no trade instructions (entry, stop, target, size, timing,
  사세요/파세요/비중). Plain, professional Korean prose.
- Do not run `scripts/fetch-*`, do not create accounts, do not send personal data anywhere, do not git commit.

## Check before you finish

`node scripts/ci-company-profile-contract-check.mjs --dir _artifacts/company-refresh-20261108/profiles` and fix every
issue for YOUR symbols (others write into the same folder; never edit their files). Then for US filers compare your
quarter revenue with `public-data/sec-fiscal-history.json` → `quarters[<SYMBOL>]` (format in its `quarterFormat`; USD
millions) when that quarter is there; a mismatch over 1% must be explained in your report.

## Report back (short)

One line per symbol: `re-based` / `already quarterly` / `failed`; quarter used and periodEnd; revenue and YoY; the SEC
cross-check result; primary source count; anything important left in `unverified`.
