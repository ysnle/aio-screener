# Post-Edit QA Tiers

Use this reference to select QA depth after code, data, UI, or workflow edits.

## Tier 1: Structural Integrity

- HTML tag balance.
- R1 7-surface version sync.
- JavaScript syntax checks.
- No obvious broken imports or missing generated artifacts.

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

