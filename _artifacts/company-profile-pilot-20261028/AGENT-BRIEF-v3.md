# Company story research brief, v3 (AI-chain expansion + quarterly refresh, 2026-10-30)

The owner wants every AI, semiconductor and data-center name on the 테마 screen to have a company story, and the
stories that went stale this earnings week refreshed. Today is 2026-10-30 (KST). Work in `C:\Projects\AIO`.

## Two kinds of assignment

**NEW `<SYMBOL>`**: write `_artifacts/company-profile-pilot-20261028/profiles-v3/<SYMBOL>.json` from scratch in the
exact shape of `_artifacts/company-profile-pilot-20261028/SCHEMA-v2.md` (read it first). Read two finished stories
before writing: `public-data/company-profiles/NVDA.json` and `public-data/company-profiles/AVGO.json` (or `MU.json`).

**UPDATE `<SYMBOL>`**: copy `public-data/company-profiles/<SYMBOL>.json` to `profiles-v3/<SYMBOL>.json`, then rewrite
only what the company's newest quarterly report (released 2026-10-27..30) changed: `earnings` (period = the new quarter,
revenue, margins, cash flow, segments), `useOfCash` if the report gives quarter or year-to-date figures, `guidance`
(latest + what changed), `estimates` if present, `watch`, `trading.calendar` (drop the report that is now past, add the
next known event), and `strategy`/`aiChain.aiRevenue` only where the release or call said something new. Keep moat,
design, make, sell, competition and governance unless the report changed them. Set `researchedAt` to `2026-10-30`.
Keep old source ids; add new sources after the last id.

## Sources

- Primary first: the latest 10-K/10-Q/20-F/6-K or earnings release, the investor-relations site, the latest
  earnings-call transcript or prepared remarks, the proxy. `www.sec.gov` may return 403 from this machine: reach the
  company IR copy of the same filing or release, or a reputable mirror, and cite what you actually read.
- Every number has a source id and a date. Nothing from memory. A number you could not confirm is `null` and goes into
  `unverified`. If the company reported in the last few days, use that report.
- Do not send any personal data to any site. Do not create accounts. Do not run any script under `scripts/fetch-*`.

## Writing rules

- Korean prose, plain and direct. Each `text` is 2-4 sentences that follow from the step before. The reader is an
  individual investor who mostly holds AI and semiconductor names: say plainly how AI spending reaches this company's
  income statement, which customers and products carry it, and what would break it.
- Do not label anything "전문가가 보는 것" or similar.
- No trade instructions: no entry, stop, target price, position size or timing. `trading.conditions` lists conditions a
  trader checks, never orders.
- `aiChain.layer` must be one value from the schema list. `moneyFlow.steps` has 3-6 arrows with real names where
  disclosed. `useOfCash` items with use `other` or `customer financing` need a Korean `label`.
- Units must be one the reader formats (`USD bn`, `USD mn`, `KRW tn`, `KRW bn`, `TWD bn`, `EUR bn`, ... — see
  `STORY_UNITS` in `src/domain/entity/company-story.js`). Foreign filers keep their reporting currency.
- Segments should sum to reported revenue for the period; say so in `unverified` if they do not.

## Check before you finish

Run `node scripts/ci-company-profile-contract-check.mjs --dir _artifacts/company-profile-pilot-20261028/profiles-v3`
and fix every issue it lists for YOUR symbols (other agents write into the same folder at the same time; ignore their
files and never edit them). Do not edit any file outside `profiles-v3/<your symbols>.json`.

## Report back

One line per symbol: sources count (primary count), period used, anything left in `unverified` that matters, and any
place where a number came from a secondary source only.
