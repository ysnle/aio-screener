# 049 — Chat: the model decides when to search the web, and may use search and data tools in one answer

Priority P1 · Effort M–L · Risk MED–HIGH (touches the Worker's admission and budget bound) · Label `v60.02`
Depends on plan 045 (function tools and the tool loop in `callSharedAi`) being merged — your brief names the base.

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v60.02`**, pending
records go to `_artifacts/pending-records/plan-049/` with `"version": "v60.02"` and date `2026-11-13`; and for this
plan only you **may** edit `worker/openai-budget.mjs` and the Worker gates/tests that cover it (not
`cloudflare-worker-proxy.js` unless a STOP says so, never `worker/wrangler.proxy.toml`).

## Why (owner 2026-11-13)

"웹 검색도 적절히 효율적으로 알아서 사용할 수 있도록." Today a keyword classifier decides before the model sees the
question whether search is attached (research need REQUIRED / OPTIONAL / NOT_NEEDED in the question plan;
`src/ai/research/native-search.js` `attachNativeSearch`, `searchMustRun`), and when attached to a current-sensitive
question it is forced (`tool_choice: 'required'`). The Worker (`worker/openai-budget.mjs` `prepareOpenAiBudget`)
refuses a request that carries both hosted search and custom functions ("hosted search cannot mix with custom
functions"), so after plan 045 a question gets **either** search **or** the app's data tools. A model in an ordinary
chatbot decides itself, per question, whether to look something up and where.

## Design (decided)

1. **Worker admission: search and functions may travel together.** In `prepareOpenAiBudget` remove the
   `body.tools.length !== 1` refusal for a searched request and bound the mix instead:
   - at most one `web_search` tool (as today) plus up to 12 function tools;
   - `max_tool_calls` keeps its meaning and limit for hosted search (`WEB_SEARCH_MAX_CALLS = 2`); confirm from the
     code and its comments what the provider applies it to — if it caps *all* tool calls of a response, raise the
     admitted maximum to 6 for a mixed request only and reserve as if all were searches would be wrong: reserve
     search fees for at most 2 and state in a comment how the bound was derived. If you cannot establish from the
     repository what `max_tool_calls` counts, keep the reservation at the worst case (every admitted call a search)
     and say so — a bound that is too high only holds budget briefly; one that is too low breaks the ledger.
   - the reservation formula must stay an upper bound: the existing searched formula already bills `(1 + calls)`
     turns at the worst context; add the function-definition tokens it already counts (`tools.length × 4096`) and
     keep `reasoning.effort` restricted to low/medium whenever search is present.
   - Tests in the Worker budget gate (`git grep -ln "prepareOpenAiBudget" -- scripts/ci-*.mjs`): a mixed body is
     admitted; two search tools, 13 functions, effort high with search, and an over-size body are refused; the mixed
     reservation ≥ the search-only reservation for the same body + function tokens; the settlement path
     (`verifiedOpenAiCharge`) settles a mixed response with both `web_search_call` and `function_call` items.
     Run the budget model check (`ls scripts | grep "budget.*model\|quota.*model"`; the model-check skill lists it)
     — it must pass unchanged or be extended, never weakened.
2. **Client: search is offered, the model chooses.** In `attachNativeSearch` / `chatSendUnified`:
   - attach `web_search` (context `low`; `medium` only when the mode is analysis/decision/comparison/outlook **and**
     the question plan marks research REQUIRED) on every question except mode `quick`, whenever the Worker health
     says paid search is enabled and the month's budget policy allows it (`_aioAIBudgetPolicy` — read what
     `preparePaidWebSearch` checks and keep it);
   - `tool_choice: 'auto'` by default. `'required'` only when the reader asked for a search in words
     (`requestedByUser`) or the question is about a named event of the last few days that the injected data does not
     contain — keep the existing `searchMustRun` signal for that and write down its exact condition in your report;
   - the same request carries plan 045's function tools (the mix the Worker now admits). In the tool loop a round
     may contain hosted search calls (run by the provider inside the response) and function calls (run by the
     client); the round/call limits of plan 045 count function calls only; hosted search is capped by the Worker.
3. **What the model is told** (extend plan 045's `toolsPromptBlock`, one owner): look in the injected data first,
   then the app's data tools (they are dated and already checked), and search the web for what neither can hold —
   news behind a move, a company event, guidance, a filing detail, anything after the data's as-of time; one
   focused query beats several broad ones; cite what was found with its date; never search for a price or ratio the
   app already gave. Remove or reword the old "웹 리서치 지시" block (`sysPrompt +=` near the search wiring) so the
   two do not disagree.
4. **Honest status**: the line under an answer says what happened (`searchStatusText` from plan 042): searched and
   cited N sources / not searched (app data and general knowledge). The answer-quality log records `searchCalls`
   (actual `web_search_call` count from the completed response) beside `searched`.
5. **Cost guard, measured not guessed**: add to `AIO.answerQualitySummary()` the share of answers that searched and
   the average search calls, so the owner can see whether "auto" searches too much. No new cap.

## Steps (tests first)

A. Worker admission and reservation (unit tests + model check).
B. Client attachment and `tool_choice` rules with tests in the gate that covers `attachNativeSearch`
   (`scripts/ci-native-search-check.mjs` and the routing cases of `ci-ai-intelligence-contract-check`): concept
   question → search offered, auto; "검색해서 알려줘" → required; quick → no search; search disabled in health →
   no search tool and the function tools still sent; a mixed body passes `prepareOpenAiBudget`.
C. Loop with a mixed response (scripted fetch in `ci-ai-chat-reliability-contract-check`): a response with one
   `web_search_call`, citations and two `function_call` items → function outputs sent in the next request, the
   citations of every round are kept for the sources list, status text says searched; a response that neither
   searched nor called → "not searched".
D. Prompt block and telemetry.

## STOP conditions

- The budget model check or a ledger gate fails for the mixed request and passing needs a change to the Durable
  Object ledger in `cloudflare-worker-proxy.js` — stop Part A, report the failing invariant; then do B–D for the
  non-mixed case only (search offered with `auto` when function tools are absent — i.e. keep 045's "no function
  tools when search is attached" rule but still let the model choose whether to search).
- A deployed-Worker contract gate pins the refusal text of the mix — change only that assertion (label `v60.02`)
  and quote it.

## Finish

`node --check`; Worker gates (`ci-worker-relay-check`, `ci-worker-openai-contract-check`, `ci-ai-budget-scope-check`,
the budget model check), `ci-native-search-check`, `ci-ai-intelligence-contract-check`,
`ci-ai-chat-reliability-contract-check`, `ci-pipeline-semantics-check`, boot budget `"failures": []`, ratchets;
`qa-runner contracts --keep-going` (expected failures only as in other plans); pending records (A change-only
stating the bound, B–D change-only quoting the owner); `apply-pending-records --dry-run` exits 0; one commit per
step. Report the reservation numbers before/after for one typical body (search only, functions only, mixed) and
what only a live run can prove.
