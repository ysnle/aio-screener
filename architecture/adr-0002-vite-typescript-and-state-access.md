# ADR-0002: build tooling adoption (deferred) and store state-access contract

- Status: main decision deferred; appendix (state access) accepted 2026-07-19 (RM-02)
- Date opened: 2026-07-19
- Scope: whole-system architecture execution

## Decision (native ESM vs Vite+TypeScript) — deferred

Per `ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md` §4: this comparison is made
after W1 proves a complete native-ESM vertical slice, not before. It is not decided
in this appendix. Do not treat the presence of this file as that decision having
been made — only the appendix below is currently accepted.

## Appendix: store state-access contract (RM-02, accepted 2026-07-19)

### Context

`src/state/store.js`'s original `createStore()` called `structuredClone`/JSON
round-trip on every `dispatch()` twice (once for the reducer input, once for the
committed state) plus once more per subscriber inside `getState()` — O(subscribers)
deep clones per dispatch. `bootstrap.js` wires `aio:liveQuotes` to 6 independent
`orchestrator.sync()` calls, each of which can dispatch, so one live-quote tick could
trigger up to 6 dispatches × (2 + page-subscriber-count) full-state clones. This does
not scale to the screener/portfolio slices RM-06/W5 will add (hundreds of rows).

### Decision

1. `getState()` returns the live state reference. No clone on read or write.
2. `dispatch()` passes the live state to `reducer(state, action)` and commits
   `next` directly — reducers are already required to be spread-based/structurally-
   sharing (every `src/state/slices/*.js` reducer already does
   `{ ...state, x: xReducer(state.x, action) }`), so the store does not need to
   defensively clone what reducers are already contractually forbidden to mutate.
3. Listeners receive the live `state` object directly, not a per-listener clone.
4. `createStore({ devMode })`: when `devMode` is true, the store `Object.freeze`s
   the state tree (recursively) after every commit. An accidental in-place mutation
   then throws immediately (strict mode) instead of silently corrupting canonical
   state days later. `devMode` defaults to `false` — the freeze walk has a real cost
   and must never be paid by end users; `src/app/bootstrap.js` is the only caller
   that decides `devMode`, and it does so from an explicit, non-default signal
   (e.g. a debug query flag), never a bare environment guess.

### Rejected alternative: `getState()`/selectors split

Considered exposing only typed selectors and renaming the raw accessor to
`getStateUnsafe()` to make "this is a live reference, do not mutate" impossible to
miss at the call site. Rejected for this batch: every native page module and
`bootstrap.js` already calls `store.getState()` directly (this is not a
behavior change, only a name change), and renaming it is a mechanical, wide-blast-
radius edit across every consumer that is out of RM-02's stated scope (a
performance contract, not an API redesign). The safety property RM-02 actually
needs — "mutating live state must be detectable" — is delivered by `devMode` deep-
freeze instead. Revisit the rename if a future packet finds a real accidental-
mutation incident that freeze alone did not catch.

### Consequences

- Selectors (`src/state/selectors/*.js`) remain the primary, safe read path;
  `getState()` is documented as returning a live reference callers must not mutate.
- `devMode` freeze must be exercised by at least one test (fixture in
  `ci-architecture-contract-check.mjs`) so the guardrail itself does not silently
  bit-rot.
- A future packet may still revisit the `getStateUnsafe` rename or a selectors-only
  public surface; this appendix records why it was not done now, not that it can
  never be done.
