# /version-up

Use the project script for version synchronization.

## Required Workflow

1. Choose the next version using R2: one decimal place only. Examples: `31.9 -> 32`, never `31.10`.
2. Run `node scripts/bump-version.mjs vX.Y` with the bundled Node runtime when `node` is not on PATH.
3. Update `version.json.note` with the actual change summary.
4. Ensure `CHANGELOG.md` has the current version entry.
5. Run `node scripts/ci-version-check.mjs`.

## R1 Surfaces

R1 means 7 synchronized surfaces: title, badge, APP_VERSION, `version.json`, `sw.js`, `CLAUDE.md`, `_context/CLAUDE.md`, plus matching CHANGELOG entry/check where applicable.

## Final Output

Report the new version and the exact validation command result.
