# 038 — Follow-ups: reader-facing defects left after round 3

Priority P2 · Effort M · Risk LOW–MED · Base `2ce167d91` · Label `v59.98`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full, with three overrides: the base commit is **`2ce167d91`** (use `git reset --keep 2ce167d91`), new assertion
labels cite **`v59.98`**, and pending records go to `_artifacts/pending-records/plan-038/` with `"version": "v59.98"`
and today's date `2026-11-11`.

Seven independent parts. Do them in order, one commit per part, a failing test first for every part marked (test).
If a part hits its STOP condition, report it and continue with the next part.

## A. An all-capital ticker in an AI question does not also resolve to another issuer (test)

`resolveRegisteredName` (src/domain/instruments/resolve-name.js) now reads an all-capital ticker-shaped word as a
ticker: `FORD` matches a display name only when the registry spells it exactly that way. The AI entity resolver has
its own English-name matcher (`englishPhraseMatches`; find it with `git grep -n "englishPhraseMatches" -- src`), which
still matches names case-insensitively, so `resolveEntities('FORD 어때')` returns FORD (ticker, unverified) **and**
F (alias, verified); `BLOCK` likewise returns XYZ.

Fix: apply the same rule there — a word in the question that is all-capital and ticker-shaped
(`/^[A-Z0-9.^=-]{1,5}$/` with at least one letter) matches an English display name only if it equals the registry's
spelling exactly. Mixed- or lower-case words ("Ford 어때", "ford") keep today's match. Prefer one shared predicate
exported from `resolve-name.js` and used by both, over a second copy of the rule.

Tests (in the gate that already tests `resolveEntities`; find it with `git grep -ln "resolveEntities" -- scripts`):
`'FORD 어때'` → no entity for F; `'Ford 어때'` → F; `'TSMC 어때'` → TSM; `'NAVER 실적'` → 035420.KS;
`'BLOCK 전망'` → no XYZ.

STOP: an existing test requires an all-capital spelling of a mixed-case name to resolve in a question — report it.

## B. 시장 상태 story and the rates axis quote the same 10-year 5-session change when the input lags (test)

Found by a replay in plan 035: with the 10-year input two US sessions behind the S&P close (the axis still uses it),
`scripts/ci-metric-consistency-check.mjs` fails "시장 상태 story quotes the verdict table's 10-year 5-session
change": the story says −9bp, the axis −7bp. The two readers take the 5-session change over different windows when
the last 10-year observation is older than the basis close.

1. Reproduce: copy `public-data/history.json` to a temp dir, remove `tnx` from the last two US session rows, and run
   the gate's readers on it (look at how the gate loads its inputs; a small script in your scratch dir that imports
   the same modules is fine). Print both numbers and the dates each reader used.
2. Find the owner of the window (`src/domain/market/session/market-windows.js` and the aligned inputs in
   `src/domain/briefing/market-read.js` `alignMarketInputs`) and make the story read the change the axis reads
   (one function, one window: the five sessions ending at the 10-year's own last observation that the axis accepts).
3. Test in `scripts/ci-esm-core-unit-check.mjs`: a synthetic history with the 10-year two sessions behind gives the
   same 5-session change in the regime's rates axis and in `buildMarketStory`.

STOP: the two numbers differ by design (a comment or a test says the story must use the basis close) — report the
comment and both values instead of changing either.

## C. The AI action gate keeps "관심 종목을 정리하세요" (test)

`positionImperative` in `src/ai/response/request-pipeline.js` replaces a sentence whose object is one of 보유, 물량,
주식, 포지션, 종목, 비중, 지분 followed by 처분하/정리하/던지 + 세요/십시오. With 종목 + 정리하 it also replaces
"관심 종목을 정리하세요" (tidy your watchlist), which is ordinary guidance.

Fix: 정리하 counts only with 보유, 물량, 주식, 포지션, 비중, 지분 (not bare 종목), or when 종목 is preceded by 보유
("보유 종목을 정리하세요" stays a directive). 처분하 and 던지 keep the full list.

Tests in `scripts/ci-ai-intelligence-contract-check.mjs` next to the existing v59.97 action-gate cases: kept —
"관심 종목을 정리하세요.", "오늘 본 종목을 정리하세요."; replaced — "보유 종목을 정리하세요.", "종목을 모두
처분하세요.", "주식을 정리하세요.". Run `node scripts/ci-regex-term-ratchet-check.mjs` and
`node scripts/ci-instruction-text-ratchet-check.mjs` (find the exact names with `ls scripts | grep ratchet`); do not
quote directive sentences in product-source comments.

## D. A published FOMC brief with a non-Korean headline is repaired (test)

`scripts/fetch-event-briefs.mjs` has a repair loop for stored earnings briefs (near the comment that mentions
repairing headlines; `git grep -n "briefHeadline(" -- scripts/fetch-event-briefs.mjs`). FOMC briefs are not covered,
so one already stored with an English headline stays. Since v59.97 `safeHeadline` rejects a non-Korean headline for
new briefs.

Fix: in the same pass, a stored FOMC brief whose headline fails `isKoreanHeadline` gets the FOMC fallback headline
the producer already builds for that meeting (find the fallback in the FOMC branch; it has the form
"10/28 FOMC 결정"). Do not call the AI for the repair and do not touch a headline that passes.

Test in `scripts/ci-event-briefs-check.mjs` by driving `buildEventBriefs` with a previous artifact that holds an FOMC
brief with an English headline: the output headline is Korean; a previous Korean headline is unchanged.

STOP: the fallback needs data the stored brief does not carry (meeting date missing) — report the stored shape.

## E. Two more substring exclusions for stance keywords (test)

`src/domain/news/keyword-match.js` `SUBSTRING_EXCLUSIONS` has `'위기': ['분위기']`. Add `'부도': ['부도덕']`,
`'상향': ['상향식']`, `'하향': ['하향식']`. Before adding each, confirm the key is a stance keyword in
`src/domain/news/scoring.js`; skip one that is not and say so. Tests next to the existing `keywordHit` cases in
`scripts/ci-esm-core-unit-check.mjs`: `('부도덕한 경영 논란','부도')` false, `('건설사 부도 우려','부도')` true,
`('상향식 예산 편성','상향')` false, `('목표가 상향','상향')` true, `('하향식 접근','하향')` false,
`('전망 하향','하향')` true. Run `node scripts/ci-expect-output-check.mjs`; if a fixture output changes, read the
diff, and if every changed line is one of these false matches going away, update with `--update` and list them;
otherwise STOP.

## F. Three more places take direction from the printed value (test where a seam exists)

Same rule as plan 025 (`directionOf(value, digits)` / `signedText` from `src/domain/shared/number.js`; a value that
rounds to zero at the printed digits has no sign, no up/down class):
- `src/ui/pages/screener/model.js` `returnColor` (`value >= 0`): find every caller and the digits it prints.
- `src/ui/pages/themes/sectors.js` near `theme.ret1m >= 0 ? '50%'` (bar anchor).
- `src/ui/components/portfolio-backtest-lab.js` local `tone` (`v < 0 ? 'is-down' : 'is-up'`).
Read each site first: if the printed digits differ per caller, pass them in. Add `v59.98` cases to the block in
`scripts/ci-esm-core-unit-check.mjs` that tests the plan-025 sites where the site can be reached with the fake DOM;
say which sites have no test.

## G. 매크로 volatility text takes its band name from the shared ladder

`src/domain/macro/volatility.js` builds its own 18/25/32 ladder string beside `vixBand`
(`src/domain/market/sentiment/narrative.js`). Make it read the band name from `vixBand` (or from one exported ladder
both use) **only if** `node scripts/ci-boot-bundle-budget-check.mjs` still reports `"failures": []` afterwards and
`node scripts/ci-domain-parity-check.mjs` exits 0. If the boot budget fails, revert this part and report the
measured bytes — do not raise `architecture/boot-budget.json`.

## Finish

- `node --check` on every touched file; the gates named in each part exit 0.
- `node scripts/qa-runner.mjs contracts --keep-going`; expected failures only: `generated-state`, `knowledge-lint`
  (generated current state), `refresh-origin-live-data` (same cause), `publish-data-commit` (Windows stub), and
  `syntax` / `narrative-lifecycle-model` timeouts under load (re-run those alone).
- One pending record per part that changed product behaviour (A, B, C, D, E as defects with `p`; F as a defect;
  G change-only). `node scripts/apply-pending-records.mjs --dry-run` exits 0.
- `git diff --check 2ce167d91` clean; everything committed.
