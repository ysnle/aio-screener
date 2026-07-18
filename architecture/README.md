# AIO architecture rebuild

This directory is the executable contract for the AR-00~09 strangler migration
described in `_context/ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md`.

The current release keeps the GitHub Pages legacy shell. New code under `src/`
is native ESM and owns the first vertical slice (sentiment evidence, state,
selectors, lifecycle observation, and AI policy). The compatibility facade is
the only place where that slice reads legacy globals. It exposes a read-only
`window.AIO_ARCH` projection during migration; it does not replace the legacy
router or write to legacy globals.

Files in this directory are release inputs, not a progress diary:

- `golden-routes.json` — the supported route contract used by the boundary gate.
- `baseline.json` — AR-00 legacy coupling counters; increases fail CI.
- `release-manifest.json` — app/data/evidence revision separation for AR-08.
- `adr-0001-rebuild-foundations.md` — decisions that keep the migration
  framework-neutral and rollback-safe.

The migration is complete only when the legacy counters and compatibility
surface reach zero, as required by AR-09. Until then `AIO_ARCH.status` remains
`MIGRATION_IN_PROGRESS`.

Market snapshot publication is fail-closed: a failed run may retain
`lastSuccessfulAt`, but a `published` snapshot with incomplete Tier 0 coverage
is rejected by the contract gate. Provider rights, independent scheduling, and
7-day SLO evidence remain operator/runtime responsibilities.
