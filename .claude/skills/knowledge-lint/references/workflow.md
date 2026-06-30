# Knowledge Lint Workflow

Use this reference when checking `_context/`, rules, postmortems, QA, commands, and skills for consistency.

## Seven Lint Passes

1. Postmortem-to-rule mapping: every repeated P-pattern should map to a rule or explicit reason.
2. Rule-to-QA mapping: every executable rule should have a QA or CI gate when practical.
3. Code reality: referenced files, functions, pages, and gates should exist.
4. Version/date currentness: current version and R1 surfaces should agree.
5. Duplicate or contradictory rules: identify the active single source of truth.
6. Index coverage: `_context/INDEX.md` should list active context docs and maintenance triggers.
7. Violation frequency: high-frequency violated rules should be promoted to stronger gates.

## Report Contract

Return a report with:

- PASS/WARN/FAIL summary.
- Findings grouped by lint pass.
- Files and line references when available.
- Auto-fixed items.
- User-confirmation items.
- Gates run and results.

## Closeout

If lint changes docs or skill surfaces:

- Update `_context/INDEX.md` when document scope changes.
- Update `_context/RULES.md` for new enforceable rules.
- Run `node scripts/ci-workflow-compaction-check.mjs`.
- Run `node scripts/ci-skill-contract-check.mjs` for skill or wrapper changes.

