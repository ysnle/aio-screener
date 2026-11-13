# 045 — Chat: the model can ask for the data it needs (function tools)

Priority P1 · Effort L · Risk MED–HIGH · Label `v60.02`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v60.02`**, pending
records go to `_artifacts/pending-records/plan-045/` with `"version": "v60.02"` and date `2026-11-13`.

## Why

Owner (2026-11-12): the AI should "think, reason and judge for itself" as it does in an ordinary chatbot. Today the
chat gives the model one shot: about 26 data blocks are chosen by keyword rules before the question is sent
(`chatSendUnified`, js/aio-chat.js), each under a size cap, and the model cannot ask for anything else. If the rules
guessed wrong (a second ticker, a longer price history, the fundamentals of a peer, the macro release behind a
move) the answer says "확인되지 않음". The Worker already admits up to 32 custom function tools per request
(`worker/openai-budget.mjs` `prepareOpenAiBudget`: `type: 'function'` with `name`, `description`, `parameters`,
`strict`; `function_call` and `function_call_output` input items; `tool_choice` auto/required/none; **hosted search
cannot mix with custom functions**), and the chat defines none.

## Design (decided — do not redesign; report disagreement in NOTES)

1. **A tool registry in `src/ai/tools/`** (new folder): one module per concern, loaded with the chat
   (`src/app/chat-globals.js`), never at boot.
   - `src/ai/tools/registry.js`: `CHAT_TOOLS` (frozen list of `{ name, description, parameters, run }`),
     `toolDefinitions()` → the array sent to the model (`{ type:'function', name, description, parameters,
     strict:true }`), `runTool(name, argsJson, { root, now })` → `{ ok, text, entities }` (never throws; unknown
     tool, bad JSON or a failed reader returns `ok:false` with a short Korean reason). `text` is capped (per tool,
     default 3,000 chars, hard cap 6,000) and always ends with the as-of date of what it returned.
   - Each tool wraps a reader that **already exists** — do not write new data logic. Candidates found by the audit
     (verify each path and signature; drop one that is not a pure/local read and say so):
     | tool | existing reader |
     |---|---|
     | `price_history(symbol, sessions≤120)` | `loadCompletedDailyBars` (src/data/daily-chart-bars.js) |
     | `technicals(symbols≤3)` | `chatTechnicalBlock` (src/ai/context/technical-lines.js) |
     | `trend(symbol)` | `chatStockTrendLine` (src/ai/context/stock-trend-line.js) |
     | `fundamentals(symbol)` | `formatSecResearchEvidence` over the stored SEC record (src/…/sec-fundamentals.js) |
     | `company_story(symbol)` | `companyStoryFor` (company-profiles.js) |
     | `consensus(symbol)` | `consensusRowFor` (src/data/consensus-estimates.js) |
     | `screen(query)` | `runScreenerQuery` + `formatScreenerResultPrompt` (src/ai/context/screener-query.js) |
     | `macro(topic)` | `buildChatMacroLines` (src/ai/context/chat-macro-lines.js) |
     | `scenario_record(themeOrState)` | `analogOutcome` / `themeStateOutcomes` (src/domain/scenarios/analogs.js) |
     | `news(query, days≤7)` | the news cache reader `_buildNewsContext` uses (expose the pure part) |
     A tool that needs a network fetch the page would not already make is out; a reader that returns a promise from
     the app's own cached artifact fetch (`refreshSharedArtifact`, the SEC store) is fine.
   - Symbols go through the one resolver (`normalizeTickerInput` / `resolveRegisteredName`); an unknown symbol
     returns `ok:false` "등록되지 않은 종목" — never a guess (AGENTS: no ticker inference).
   - No tool reads the portfolio, the reader notes or saved conversations.
2. **The loop in `callSharedAi`** (js/aio-chat.js ~1136–1400). Today: one streamed request, events
   `response.output_text.delta`, annotations, `response.completed|incomplete`.
   - When `opts.tools` is given and search is **not** attached (`reqBody.tools` empty after `attachNativeSearch`),
     send `tools: toolDefinitions()`, `tool_choice: 'auto'`, `parallel_tool_calls: true`.
   - Collect `function_call` output items from the stream (read the Responses streaming events the code already
     parses and the completed response's `output` array; handle both — take the calls from `response.completed`'s
     `output` as the source of truth). If the completed response has function calls: run them with `runTool`
     (in parallel, each bounded to 8 s), append to `input` the model's `function_call` items exactly as returned and
     one `function_call_output` per call (`call_id`, `output: text`), and send the next request. **At most 2 tool
     rounds** and **at most 6 calls in total**; on the last allowed request send `tool_choice: 'none'` so the model
     must answer. Text deltas of a round that ends in tool calls are not shown.
   - The Worker bounds each request separately (own reservation, own daily count): nothing to change there. Keep
     the idempotency key distinct per round (find how the key is derived; a replayed key would return the first
     round's response).
   - While tools run, the panel's pending line says what is happening in plain Korean, one line, e.g.
     `자료를 더 찾는 중: 엔비디아 재무, 반도체 테마 기록` (from each tool's short label) — no tool names, no JSON.
   - Cancel (`_aioCancelChatRequest`) stops between rounds and during a round; retries/fallback models
     (`_fallbackOrder`) restart from round 0 without duplicating appended items.
   - Failure of the tool path (a Worker 400 naming tools, a malformed call) falls back **once** to the same request
     without tools, so the answer the reader gets is never worse than today.
3. **What the model is told** (one block in the prompt head, owned by the registry: `toolsPromptBlock()`):
   the injected data is a first selection; when the question needs something that is not there, call a tool instead
   of writing "확인되지 않음"; call several at once when they are independent; do not call for what is already in
   the prompt; a tool result is data with its own date.
4. **Evidence**: every tool result's text joins the reference text the answer's figures are checked against
   (`meta.referenceText` passed to `_aioRunAIResponsePipeline`; plan 047 owns `publication.js` — you only append
   text). Record in the answer-quality entry `toolRounds` and `toolCalls` (extend the allowed fields in
   `src/ai/telemetry/answer-quality-log.js`).
5. **When tools are offered**: every mode except `quick`; not when hosted search is attached for this request (the
   Worker refuses the mix). No setting, no toggle.

## Steps (tests first for each)

A. Registry and tools with unit tests in `scripts/ci-ai-intelligence-contract-check.mjs` (`v60.02`): definitions
   are valid for the Worker (`prepareOpenAiBudget` accepts a body carrying them — call it); each tool returns capped
   text with a date on a fixture root; unknown symbol / bad JSON / thrown reader → `ok:false`, no throw; no tool
   output contains `undefined`/`NaN`/`[object Object]`.
B. The loop, tested with a scripted fetch in the gate that already drives `callSharedAi`
   (`scripts/ci-ai-chat-reliability-contract-check.mjs`): (1) no tool call → one request, same as today;
   (2) one round with two parallel calls → second request carries both outputs, final text is the second
   response's; (3) the model keeps calling → the third request has `tool_choice:'none'`; (4) more than 6 calls →
   extra calls get an `ok:false` "한도" output; (5) a 400 on the first tools request → one retry without tools;
   (6) cancel during tool execution → no further request; (7) search attached → no function tools in the body.
C. Wiring in `chatSendUnified`, the prompt block, the pending line, reference text and telemetry, with prompt-level
   tests through `scripts/fixtures/chat-prompt-assembly.mjs` (extend it) and one pipeline-semantics case
   (`scripts/fixtures/pipeline-semantics/ai.mjs`): a figure that came only from a tool result stays in the answer.

## STOP conditions

- The Responses stream does not deliver function calls in a form the current parser can be extended to read without
  rewriting the stream reader — report the event shapes you can see in code/fixtures and stop B; land A.
- `prepareOpenAiBudget` rejects the definitions (schema strictness, name pattern, size) — report its message; do
  not edit the Worker.
- Boot budget: `node scripts/ci-boot-bundle-budget-check.mjs` must report `"failures": []` after each step. The
  registry and tools load with the chat. If a tool's reader drags a boot module's size up, load it lazily; do not
  edit `architecture/boot-budget.json`.

## Finish

`node --check` on every touched file; ratchets pass (text-pin, instruction-text, regex-term, shared-primitive,
patch-comment — no `--write`); chat browser gates (`ls scripts | grep "chat.*browser"`) exit 0;
`node scripts/qa-runner.mjs contracts --keep-going` (expected failures only: generated-state, knowledge-lint and
refresh-origin-live-data for that cause, browser-data-pin-drift, publish-data-commit, syntax /
narrative-lifecycle-model timeouts — re-run alone); one pending record (change-only) quoting the owner request;
`apply-pending-records --dry-run` exits 0; everything committed, one commit per step.
Report: the final tool list with each reader and cap, the request sequence of test (2) as JSON bodies (trimmed),
and what a real model run still needs to prove (nothing here can call the live model).
