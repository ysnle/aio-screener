# 042 — Chat: one set of instructions, an answer the length the question needs, and effort for hard explanations

Priority P1 · Effort M–L · Risk MED · Label `v59.99`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v59.99`**, pending
records go to `_artifacts/pending-records/plan-042/` with `"version": "v59.99"` and date `2026-11-12`.

This plan must not touch `src/ai/response/publication.js` (plan 041 owns it) and must not weaken: the trade
instruction ban (`_aioApplyAIActionGate`), the evidence contract for current numbers, the budget ledger, or the
external-evidence tail kept by `_cutSystem`.

## Why

Audit of `chatSendUnified` (js/aio-chat.js ~3850–4450) found the system prompt carries the same decision in several
blocks with different wording, and some that pull against each other:

| Decision | Where it is stated |
|---|---|
| Missing data | intent block (~3043 "추측하지 말고 제한사항으로 밝혀라"), coverage block (~2871), answer principles (`src/ai/response/answer-principles.js`), evidence contract, and the policy in `request-pipeline.js` ~472 ("'확인 필요'로 끝내지 말고 … 끝까지 답하며") which pulls the other way |
| Answer shape | `answerModeGuide` (`src/ai/response/answer-modes.js`, chosen by `chooseAnswerMode`); the coverage block's own `mode=` and `response_diversity_rule` (computed separately by `_classifyChatIntent`, can disagree); the integrated block's `answer_contract` steps 1–6 (~2958–2964); principles item 4 |
| Length | policy says "2,500자 안팎" (`request-pipeline.js` ~487) while the token ceiling is 8,000–16,000 |
| Identity | integrated block: "This screener chat is not a generic LLM. It must combine …" beside "use only injected data" |

and three routing facts: questions in `explain`/`quick` mode run with reasoning effort `none` even when the concept is
hard (감마 스퀴즈, 듀레이션); `luna-low` is unused for the analysis family; `attachNativeSearch`
(`src/ai/research/native-search.js` ~22–29) sets `tool_choice: 'required'`, so a concept question classified
REQUIRED must search before it may answer. News reaches the model as 5 items capped at 2,400 chars in total because
the NEWS wrapper is called without `maxChars` (js/aio-chat.js ~4108).

## Part A — one owner per decision in the prompt (tests first)

1. Print the assembled system prompt for four fixture questions before changing anything (a script in your scratch
   dir that stubs the data readers the way `scripts/fixtures/pipeline-semantics/ai.mjs` or the chat reliability gate
   already does — find the existing harness that runs `chatSendUnified` or its prompt builders offline:
   `git grep -ln "chatSendUnified\|_buildChatAnswerCoverageContext" -- scripts`). Save the four prompts and their
   character counts in your scratch dir; quote the counts in your report. If no harness can build the whole prompt
   offline, build it block by block from the exported/pure builders and say which blocks you could not include.
2. Make each decision have one owner and delete the other statements (delete, do not add a "see above" line):
   - **Missing data** → the evidence contract block is the owner. Its rule, in one place: say what is missing and
     why it matters in one clause, then still answer with what is known (reasoning, mechanism, history, what to
     check) — never stop at "확인 필요". Remove the missing-data sentences from the intent block, the coverage block
     and the principles; reword the policy sentence at ~472 to point at the same rule rather than restating it.
   - **Answer shape** → `answerModeGuide(mode)` is the owner, with `mode` from `chooseAnswerMode` only. Remove the
     coverage block's `mode=`/`response_diversity_rule` lines and the integrated block's `answer_contract` steps
     where they prescribe structure; keep the parts of those blocks that carry *data* (what was injected, coverage
     flags, Telegram lines). If `_classifyChatIntent`'s mode is used for anything other than the prompt text
     (`git grep -n "_classifyChatIntent" -- js src`), leave that use alone and report it.
   - **Length** → remove "2,500자 안팎". The mode guide states length per mode: quick 1–3 sentences; explain as long
     as the mechanism needs; analysis/decision/comparison/outlook "핵심 판단을 먼저 쓰고, 근거와 반대 시나리오를
     끝까지 전개한다. 길이 제한은 없지만 같은 말을 반복하지 않는다." (Korean, same register as the existing guides).
   - **Identity** → delete "This screener chat is not a generic LLM…"; keep the sentence that says which data blocks
     take precedence over memory for current facts (it already exists in the principles).
3. After the change, print the same four prompts: report character counts before/after and attach a unified diff of
   one of them in your report (trimmed to the changed regions).
4. Tests (`v59.99`): behavioural, on the builders' output — for each of the four fixtures the assembled prompt
   contains exactly one occurrence of the missing-data rule's lead phrase and exactly one answer-shape block (count
   by the block header the builders emit, e.g. `【이번 답변의 형태`), and does not contain "2,500자". Put them in the
   gate that already asserts on prompt content (`scripts/ci-ai-intelligence-contract-check.mjs` or the chat
   reliability gate — whichever owns the builders). These are output assertions, not source text pins.
5. Run `node scripts/ci-instruction-text-ratchet-check.mjs` and `node scripts/ci-text-pin-ratchet-check.mjs`; counts
   may only go down. If an existing gate pins one of the deleted sentences in *source text*, change only that
   assertion to the behavioural form in step 4 and list it.

STOP: a deleted sentence is cited by an R-rule as the fix for a past incident
(`git grep -n "<the phrase>" -- _context/RULES.md _context/BUG-POSTMORTEM.md | head`) and no remaining sentence
covers that incident — keep that one sentence in its owner block and say which incident.

## Part B — routing (tests first)

1. `explain` mode gets reasoning effort `low` (model key `luna-low`), max tokens unchanged; `quick` stays `none`.
   Change it where the key is chosen (js/aio-chat.js ~4225–4230), next to the existing analysis-family override.
2. Hosted search: `tool_choice` becomes `'auto'` instead of `'required'` when the question's research need is not
   about a current fact — i.e. when the taxonomy says the answer does not depend on today's values
   (`currentSensitive === false`). A current-fact question keeps `'required'`. Read how the Worker bounds a searched
   request (`worker/openai-budget.mjs`: the reservation is the same either way; `'auto'` is an accepted value) and
   how the client handles an answer that came back without a search call (citations empty) — if the client treats
   "search was attached but not used" as a failure anywhere, fix that path and test it.
3. NEWS block: pass an explicit cap. Read `reference-budget.js` for how other blocks are sized; give news 6,000
   chars and up to 8 items (titles 160 chars, descriptions 300 chars), and confirm with the four fixture prompts
   that the total stays under the client body target with the largest data blocks present.
4. Tests (`v59.99`) in the gate that covers routing (find with `git grep -ln "_detectQueryComplexity\|chooseAnswerMode"
   -- scripts`): "감마 스퀴즈가 뭐야?" and "듀레이션이 뭐야?" → effort low; "테슬라 PER 얼마야?" → none; a concept
   question with search attached → `tool_choice` auto; "엔비디아 오늘 왜 떨어졌어?" → required; the news block of a
   fixture with 8 long items holds 8 items and ≤ 6,000 chars.
5. `node scripts/ci-worker-relay-check.mjs`, `node scripts/ci-ai-budget-scope-check.mjs` and the pipeline-semantics
   gate exit 0.

STOP: `'auto'` is rejected by a Worker admission test or by `ci-worker-*` gates — report the message; do not edit the
Worker.

## Finish

`node --check` on every touched file; `node scripts/ci-boot-bundle-budget-check.mjs` reports `"failures": []`;
`node scripts/qa-runner.mjs contracts --keep-going` (expected failures only: generated-state, knowledge-lint and
refresh-origin-live-data for that cause, browser-data-pin-drift, publish-data-commit, syntax /
narrative-lifecycle-model timeouts — re-run those alone); two pending records (A change-only, B change-only — or a
defect with `p` if you found a client path that mishandled an unsearched answer); `apply-pending-records --dry-run`
exits 0; everything committed. Report: prompt sizes before/after for the four fixtures, every sentence you deleted
(quoted), and anything you kept because of the STOP rule.
