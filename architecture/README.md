# AIO architecture rebuild

This directory is the executable contract for the AR-00~09 strangler migration
described in `_context/ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md`.
Cross-session packet order, per-layer ownership, route cutover, and deletion
ledgers are defined in
`_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md`.

The current release keeps the GitHub Pages shell. New code under `src/` is
native ESM and owns all 17 route lifecycle/renderer modules plus the
sentiment/news/entity/portfolio/screener/analysis state boundaries, pure domain
models, AI envelopes, storage gateways, and release contracts. It exposes a
read-only `window.AIO_ARCH` projection; legacy globals are consumed only through
the compatibility facade.

Files in this directory are release inputs, not a progress diary:

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
