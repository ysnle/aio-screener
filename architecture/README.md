# AIO architecture rebuild

This directory is the executable contract for the AR-00~09 strangler migration
described in `_context/ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md`.
Cross-session packet order, per-layer ownership, route cutover, and deletion
ledgers are defined in
`_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md`.

The current release keeps the GitHub Pages shell. Code under `src/` is a native
ESM strangler layer over a legacy-first boot path. The route registry currently
contains 20 routes and records lifecycle/renderer/data ownership separately from
chart, narrative, storage and producer retirement. A route is not fully native
until every applicable surface is native or explicitly not applicable and its
legacy writer is removed. `fullNativeOwner` is therefore the completion signal;
lifecycle/renderer counts alone are not.

`window.AIO_ARCH` is still a transitional compatibility API, not a certified
minimal read-only facade. Native runtime readers also still adapt legacy globals.
The target direction remains source adapter → validation → canonical evidence
store → selector/view model → route UI, with no UI fetch/storage/private-global
access after each vertical slice is retired.

Files in this directory are release inputs, not a progress diary:

- `product-charter.json` — product identity, non-goals, trust planes, evidence
  claims, deployment boundaries and promotion gates. Architecture changes must
  preserve this contract or change it explicitly before implementation.
- `golden-routes.json` — the supported route contract used by the boundary gate.
- `baseline.json` — AR-00 legacy coupling counters plus monotonic burn-down
  targets and retired-pattern contracts; equality is not sufficient for a
  declared cutover batch.
- `release-manifest.json` — app/data/evidence revision separation for AR-08.
- `adr-0001-rebuild-foundations.md` — decisions that keep the migration
  framework-neutral and rollback-safe.

Local route retirement is recorded as `NATIVE_ROUTES_LOCAL`; live provider
rights, data-plane credentials, and the remaining legacy-shell coupling counters
are separately operator-gated and are not represented as live certification.

Market snapshot publication is fail-closed: a failed run may retain
`lastSuccessfulAt`, but a `published` snapshot with incomplete Tier 0 coverage
is rejected by the contract gate. Provider rights, independent scheduling, and
7-day SLO evidence remain operator/runtime responsibilities.
