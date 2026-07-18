# ADR-0001: framework-neutral ESM foundations

- Status: accepted for AR-00~06
- Date: 2026-07-18
- Scope: browser application runtime and the first vertical slice

## Decision

Use native ESM with a small typed-by-contract runtime before selecting a UI
framework. The static GitHub Pages delivery surface remains in place while
route modules, state, evidence, domain calculations, and platform gateways are
replaced one slice at a time.

The first slice is sentiment because it exercises quote/macro evidence,
freshness, a pure domain calculation, existing chart/UI consumers, and an AI
context boundary without mutating portfolio state.

## Contracts

1. `src/domain/**` is pure and cannot import DOM, network, storage, or provider
   modules.
2. `src/data/**` validates external values before ingesting them into the
   evidence store.
3. `src/app/**` owns route lifecycle and disposal.
4. `src/ui/**` receives selectors/evidence; it does not fetch or read storage.
5. `src/ai/**` consumes the same evidence envelope as UI and decision surfaces.
6. `src/legacy/**` is the only compatibility boundary for legacy globals.
7. New modules must not add global writers, direct `fetch`, direct Web Storage,
   or unbounded HTML sinks.

## Rollback

The ESM bootstrap is progressive enhancement. If it cannot initialize, the
legacy application remains the page owner and records a bounded warning. The
new runtime never replaces `showPage`, mutates `DATA_SNAPSHOT`, or changes
legacy route rendering during this migration step.

## Exit criteria

AR-01~AR-06 are considered locally implemented when the architecture contract
gate passes, the sentiment route receives canonical evidence metadata, all
resources created by the observer are disposed on route changes, and the
legacy coupling baseline does not increase. AR-07~AR-09 remain governed by
their own data, deployment, and legacy-burn-down gates until their slices are
cut over.
