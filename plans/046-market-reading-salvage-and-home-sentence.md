# 046 — Market reading: a blocked reading loses its bad sentence, not the whole text; the home sentence may judge

Priority P1 · Effort M · Risk MED · Label `v60.02`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v60.02`**, pending
records go to `_artifacts/pending-records/plan-046/` with `"version": "v60.02"` and date `2026-11-13`.

## Why

`genMarketAnalysis` (scripts/producer/market-narrative.mjs ~377–532): the model writes about eight to ten lines; the
deterministic validator (`validateMarketAnalysisText`, scripts/lib/market-analysis-validate.mjs) returns
`{ ok, issues, text }`; on failure there is one retry with the reasons; a second failure throws the whole text
away and the screen keeps the previous reading for up to 12 hours (`retainVerifiedMarketAnalysis`) or a fallback.
One sentence with one wrong word costs the reader a whole refresh of analysis. After the v59.99 validator fixes a
replay still lost 1 of 8 readings this way.

Second, the home one-line sentence (`marketSentenceRejectReason`, same file ~1229–1250) rejects a candidate with
`SENTENCE_INSTRUCTION` when it contains 매수/매도 outside a short allow-list, so "주식 매수가 부담스러운 구간" is
rejected as an instruction although the owner decision of 2026-11-12 (AGENTS.md "Judgement allowed") permits an
assessment and bans only an order to the reader.

## Part A — salvage (tests first)

1. New exported pure function in `scripts/lib/market-analysis-validate.mjs`:
   `salvageMarketAnalysis(text, validate, { maxRemoved = 2, minLines = 5 } = {})` → `{ ok, text, removed: [{ line,
   issues }] } | { ok:false }`.
   - Split the body into its lines (the reading is one sentence or two per line; keep the existing line split the
     validator uses — find it).
   - Greedy: while the text is not ok and fewer than `maxRemoved` lines were removed and more than `minLines`
     remain — for each line, validate the text without it; choose the removal that leaves the fewest issues,
     requiring strictly fewer than now (ties: the later line); if no removal reduces the issues, stop.
   - Return ok only when the final text validates with **zero** issues. The validator is the judge of whether an
     essential line was removed (a large-move day without its attributed cause, missing cross-market dates, a
     missing scenario line all remain issues), so do not add a second notion of "essential".
   - Never salvage when the issues include `trade-instruction` or `probability-claim` at the start: a reading that
     produced an order or an invented probability is discarded whole, as today.
   - Cost bound: at most `lines × maxRemoved` validator runs (≈20); measure one run on a real fixture and report it.
2. In `genMarketAnalysis`: after the retry, if still not ok, try `salvageMarketAnalysis(text, validate)` on the
   second attempt's text and, if that fails, on the first attempt's text (keep it). On success publish as
   `verified` with `salvaged: { removed: n, issues: [...] }` on the structured result, and log one line
   `[fetch-data] marketAnalysis salvaged: removed n line(s) for <issues>` (no text of the reading in the log beyond
   what the blocked-attempt log already prints). The one-line sentence candidate logic is unchanged.
3. Surface it in run meta the way other outcomes are (`aiUsage.purposes['market-analysis'].outcome`: add
   `'salvaged'`; find where `verified-after-retry` / `retained-previous` are set — scripts/producer/ai-usage.mjs)
   so the experiment and the operations summary can count it. If a gate enumerates the outcomes, extend its list.
4. Tests (`v60.02`): unit cases in `scripts/ci-scenario-guidance-fixture.mjs` with a stub validator (issue tied to
   one line → that line removed, ok; two bad lines → both removed; three bad lines → not ok; removing the bad line
   creates a new issue → not ok; trade-instruction → not ok without trying) and one end-to-end case through
   `genMarketAnalysis` with the `request` seam returning a text whose single bad line is an axis-state
   contradiction on both attempts → status `verified`, `salvaged.removed === 1`, the bad line absent, no third
   request. Use the fixtures the data-pipeline gate already has for `genMarketAnalysis`
   (`git grep -n "genMarketAnalysis(" -- scripts/ci-*.mjs scripts/fixtures`).
5. `scripts/ai-effort-experiment.mjs`: report `salvaged` per variant (it already prints status and attempts).

STOP: the structured builder (`buildStructuredMarketAnalysis`) or a downstream reader requires a fixed number of
lines/sections that a removed line breaks — report which reader and the shape it needs.

## Part B — the home sentence may judge (tests first)

1. Read `SENTENCE_INSTRUCTION` and every other reject reason of `marketSentenceRejectReason`.
2. An order stays rejected: imperative endings and recommendations (`사세요`, `매수하세요`, `파세요`, `…하라`,
   `…해야 합니다` addressed to the reader, `추천`, `담으세요`), and a bare action verb used as advice ("지금은 매수",
   "매도할 때"). An assessment passes: 매수/매도 as the object or modifier of a state noun or adjective —
   `매수(가|는)? 부담스러운`, `매수 부담`, `매수(하기)? (좋은|유리한|불리한) (구간|국면|상황|시점)`, `추격 매수의 비용`,
   `매도 압력`, `매도 우위`, `현금 (보유 )?우위`. Implement as a named assessment exemption checked before the
   instruction test, the same way plan 044 added `zoneAssessment` to the chat gate
   (src/ai/response/request-pipeline.js) — read that for the shape; do not import across the scripts/src boundary
   if the layering gate forbids it.
3. Tests (`v60.02`, next to the existing sentence tests): passes — "주식 매수가 부담스러운 구간입니다.", "추격
   매수의 비용이 큽니다.", "현금 보유가 우위인 하루였습니다.", "분할 매수하기 좋은 국면으로 읽힙니다."; rejected —
   "지금 매수하세요.", "매도할 때입니다.", "지금은 매수.", "비중을 줄이세요.". Existing sentence tests stay green
   unedited; if one of them is an assessment this plan now allows, list it and change that single expectation.

## Finish

`node --check`; `node scripts/ci-data-pipeline-contract-check.mjs`, `ci-scenario-guidance-fixture`,
`ci-pipeline-semantics-check`, `ci-crash-replay-check`, `ci-narrative-lifecycle-model-check` (run alone; it takes
~2.5 min — a salvaged reading is a `verified` reading in the lifecycle; if the model check enumerates outcomes and
fails, extend the model, do not weaken it, and report); ratchets pass; `qa-runner contracts --keep-going` (expected
failures only as in other plans); two pending records (A change-only with the replay figures, B change-only quoting
the owner decision); `apply-pending-records --dry-run` exits 0; one commit per part.
