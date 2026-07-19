# ADR-0001: framework-neutral ESM foundations

- Status: accepted for AR-00~16 local cutover
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
legacy application records a bounded warning. The new runtime owns the 17 route
lifecycles and renderers and consumes compatibility read models through the
facade; the facade remains read-only except for the approved sentiment ingest
gateway. Release, provider-rights, and live certification remain independent
operator evidence.

## Exit criteria

AR-01~AR-16 are considered locally cut over when the architecture, domain
parity, storage migration, release, and retirement contracts pass, all route
resources are disposed on route changes, and router/store route state agrees.
Live provider rights, fast-plane credentials, and browser certification remain
separate gates.
