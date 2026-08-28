# Post-Edit QA Tiers

Use this reference to select QA depth after code, data, UI, or workflow edits.

## Tier 1: Structural Integrity

- Run `node scripts/qa-runner.mjs fast` for the content-keyed local preflight.
- Use `--no-cache` when certifying a release or debugging the runner itself.
- The preflight aggregates syntax, workflow YAML, version, architecture, generated-state and workspace-contract failures before returning.
- A Tier 1 failure blocks higher-cost browser phases; it does not hide sibling Tier 1 failures.

## Tier 2: Page Function Coverage

Check all user-facing pages touched by the change and any shared navigation path. For broad edits, inspect the full page set, including dashboard, signal, breadth, sentiment, sectors, themes, macro, options, portfolio, screener, ticker, and chat-related surfaces.

## Tier 3: Data Pipelines

Verify public-data generation, screener artifacts, quote fallbacks, macro/sentiment/breadth arrays, and chat context snapshots.

## Tier 4: Charts And Layout

Check chart creation/destroy paths, canvas availability, responsive layout, overflow defense, Korean text wrapping, and no hidden grid artifacts.

## Tier 5: Security

Search for unsafe `innerHTML`, event-handler injection, missing escaping, and user-input rendering paths.

## Tier 6: Accessibility

Check labels, aria attributes, landmarks, skip links, focus paths, and minimum font constraints.

## Tier 7: Data Integrity

Check unknown tickers, zero-vs-missing distinction, inverted FX rules, weights summing to 100 where required, and stale static data.

## Tier 8: News And Keywords

Check R16 ticker display, R17 keyword length, channel allowlists, and Korean market rewrite behavior.

## Tier 9: Performance

Check timers, listeners, Chart.js lifecycle, large arrays, localStorage usage, and repeated render loops.

## Tier 10: Dead Page / Dead DOM

Check init functions, `aio:pageShown`, `aio:liveQuotes`, `data-snap` mappings, and DOM IDs that are never read or written.

## Tier 11: Dynamic Text And Chat Contexts

Check hardcoded dynamic narratives, `CHAT_CONTEXTS` keys, chatSend context references, stale scenario numbers, and answer safety rules.

## Tier 12: Regression-Specific Gates

Run any gate named by the changed rule, postmortem, or CI script.

The canonical mapping is `architecture/qa-pipeline.json`. Capture `session-start --session <task-id>` before editing, then start with `affected --session <task-id> --explain` and execute the same selection. When no baseline exists, use `affected --files <exact-task-paths>`; never infer the task boundary from unrelated dirty files. For docs/skills/agents/hooks/workflows this selects workspace generation, contracts, knowledge lint, skill/profile mirror checks and hook fixtures. A static workspace PASS does not certify model behavior or deployed operations.

## Execution And Retry Policy

- Local: static gates may run concurrently; browser gates run sequentially to avoid port/server/resource collisions.
- CI: contract and browser groups run as `fail-fast: false` matrix shards after the preceding phase passes.
- Cache: only successful local gates are cached, keyed by the gate definition and all declared input contents. CI and release certification use `--no-cache`.
- Retry: after a failure batch, fix the complete batch and run `rerun-failed`; it selects exact failed gates plus declared dependencies, not all siblings in their groups. Run `affected` again after changing a different surface. Run `full --no-cache` once at the final release boundary, not after every edit.
- Evidence: `.cache/aio-qa/last-run.json` records selection, timing, PASS/FAIL/SKIP and the phase that blocked later work.

## Tier 13: Live Deployment Verification (R290/P653)

For UI/UX-visible changes, run this tier before claiming the change works, not just that its source compiles or its unit tests pass — static checks and headless DOM assertions verify structure, not what a user actually sees render.

- If Chrome MCP browser tools are connected: navigate to the local dev server (or the live site when checking deployed behavior), interact with the changed control the way a user would, screenshot before/after, and read the console for new errors/warnings.
- If Chrome MCP is not connected: do not claim this tier passed. State explicitly in the report that live-browser verification was not run and why, and record it as a QA-CHECKLIST unverified item rather than letting it disappear into prose that the next session has to rediscover.
- This tier is distinct from Tier 4 (chart/layout static checks) and `scripts/ci-viewport-matrix-check.mjs` (headless geometry matrix): both of those catch structural regressions without a real browser paint. Use this tier when the question is "does this actually look/work right," not "is the DOM well-formed."
