# Bug-Fix Workflow

Use this reference for any defect, regression, runtime error, broken UI path, stale data path, or failed gate.

## Root-Cause Sequence

1. Reproduce or identify the failing path.
2. Locate producer, transformer, consumer, and gate.
3. Fix the lowest shared cause, not only the visible symptom.
4. Add or update an executable check when the defect can recur.
5. Update `_context/BUG-POSTMORTEM.md` with a new P-number.
6. Promote a repeated failure pattern to `_context/RULES.md`.
7. Add or update `_context/QA-CHECKLIST.md` when a manual or CI check is now required.
8. Bump version with R1 7-surface sync when code/data/docs changed.

## P-Number Record

Every bug fix postmortem should include:

- Date and version.
- Symptom.
- Root cause.
- Files changed.
- Prevention gate or checklist.
- Violated or newly created rule.
- Verification command and result.

## Structural Fix Test

Before finalizing, confirm:

- The same bad input cannot fail in a sibling consumer.
- The fix does not create a second source of truth.
- The gate would fail on the pre-fix state.
- The final answer separates verified, blocked, and unverified items.

