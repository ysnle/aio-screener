# Company profile research brief (top-100 expansion, 2026-10-28)

Goal: write `profiles-v2/<SYMBOL>.json` for each assigned company in the exact shape of `SCHEMA-v2.md` (read it first),
so a Korean reader can follow one connected story: technology and moat → what it designs → who makes it → who buys it
→ how the money flows in → how much it earns → what it does with the money → where it sits in the AI value chain →
who it competes with and how it plans to win → roadmap and what it will do next → what to watch and how a trader uses it.

Read two finished examples before writing: `profiles-v2/NVDA.json` and `profiles-v2/JPM.json`.

## Sources

- Primary first: the company's latest 10-K/10-Q/20-F/6-K or earnings release, the investor-relations site, the latest
  earnings-call transcript, proxy. Korean companies: DART filings (dart.fss.or.kr), company IR pages and IR decks.
- `www.sec.gov` returns 403 from this machine. Use WebSearch/WebFetch to reach the company IR copy of the same filing or
  release, or a reputable mirror, and cite what you actually read.
- Every number has a source id and a date. Nothing from memory. A number you could not confirm is `null` and goes into
  `unverified`. Today is 2026-10-28. If the company reported in the last few days, use that report.
- Do not send any personal data to any site. Do not create accounts.

## Writing rules

- Korean prose, plain and direct. Each `text` is 2–4 sentences that follow from the step before.
- Do not label anything "전문가가 보는 것" or similar.
- No trade instructions: no entry, stop, target price, position size or timing. `trading.conditions` lists
  conditions a trader checks, never orders.
- `aiChain.layer` must be one value from the schema list. `moneyFlow.steps` has 3–6 arrows with real names where
  disclosed. `useOfCash` items with use `other` or `customer financing` need a Korean `label`.
- Segments should sum to reported revenue for the period; say so in `unverified` if they do not.
- Korean companies: units "KRW tn" or "KRW bn" (the checker only sums USD units, that is fine), K-IFRS consolidated.

## Check before you finish

Run `node "<scratchpad>/pilot/verify-v2.mjs" . _artifacts/company-profile-pilot-20261028/profiles-v2` from
`C:\Projects\AIO` (the parent gives you the scratchpad path) and fix every issue it lists for your symbols.

## Report back

One line per symbol: sources count (primary count), period used, anything left in `unverified` that matters, and any
place where you used a secondary source for a number. Do not edit any other file in the repo.
