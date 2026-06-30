# Data Refresh Workflow

Use this reference after reading `inventory.md`.

## Refresh Order

1. Build the 22-category staleness table.
2. Refresh CRITICAL categories first.
3. Update generated artifacts through the repo's scripts when available.
4. Keep producer, artifact, consumer, and gate together.
5. Update docs that describe refreshed surfaces.
6. Bump version with `node scripts/bump-version.mjs <version>`.
7. Run data, runtime, version, and skill gates relevant to the touched surfaces.

## Non-Negotiables

- Do not silently mix fresh and stale arrays.
- Do not update only UI text when the underlying consumer data remains stale.
- Do not use demo or invented market values.
- If network access is unavailable, mark live-source updates as BLOCKED and still validate local generated artifacts.
- Keep R1 as 7 synchronized surfaces.

## Required Verification

Use the relevant subset:

- `node scripts/ci-version-check.mjs`
- `node scripts/ci-runtime-contract-check.mjs`
- `node scripts/ci-data-pipeline-contract-check.mjs`
- `node scripts/ci-semantic-review-check.mjs`
- `node scripts/ci-workflow-compaction-check.mjs`
- `node scripts/ci-skill-contract-check.mjs` for skill/docs changes.

