# /version-up

Use the project script for version synchronization.

## Required Workflow

1. Choose the next monotonically increasing version using R2: `v{major}.{patch}` with the canonical form enforced by `bump-version.mjs`; two-digit patches are valid.
2. Run `node scripts/bump-version.mjs vX.Y` with the bundled Node runtime when `node` is not on PATH.
3. Update `version.json.note` with the actual change summary.
4. Ensure `CHANGELOG.md` has the current version entry.
5. Regenerate `_context/CURRENT-STATE.md`/`CONTEXT-CATALOG.json` and run `node scripts/ci-version-check.mjs` plus `node scripts/ci-workspace-contract-check.mjs`.

## Ledger Recording Flow (record-fix)

Use this instead of hand-editing the P/R/QA/CHANGELOG/note/status surfaces. The existing steps above still apply.

1. `node scripts/bump-version.mjs vX.Y` (creates the `## vX.Y (date)` CHANGELOG heading with its placeholder).
2. Write an `entry.json` (scratch location, not committed) with `version`, `date`, `p` {title, symptom, root_cause, fix, violated_rule, prevention, verification}, `r` {title, rule, validation} or null, `qa` [{id, text, verify_by, done}], `qa_section`, `changelog` [bullets], `note`, and optional `status` {time, title, bullets}. Use `{P}`/`{R}` in any text for the allocated ids; never hardcode them.
3. Preview, then record: `node scripts/record-fix.mjs entry.json --dry-run`, then `node scripts/record-fix.mjs entry.json`. Ids are computed from the ledger bodies (max + 1); duplicate QA ids, missing `verify_by`, a missing version heading and unmanifested R gaps are refused with no files changed. It writes every file atomically and preserves each file's line endings.
4. Run the gates: `node scripts/ci-record-fix-check.mjs`, `node scripts/ci-ledger-integrity-check.mjs`, `node scripts/ci-knowledge-lint-check.mjs`, regenerate workspace state (`node scripts/generate-workspace-state.mjs --write`), then `node scripts/ci-version-check.mjs` and `node scripts/ci-workspace-contract-check.mjs`.

## R1 Surfaces

R1 means 7 synchronized surfaces: title, badge, APP_VERSION, `version.json`, `sw.js`, `CLAUDE.md`, `_context/CLAUDE.md`, plus matching CHANGELOG entry/check where applicable.

## Final Output

Report the new version and the exact validation command result.
