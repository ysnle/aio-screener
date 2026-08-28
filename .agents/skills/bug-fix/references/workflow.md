# Bug-Fix Workflow

Use this reference for any defect, regression, runtime error, broken UI path, stale data path, or failed gate.

## Root-Cause Sequence

1. Classify the failure as code defect, stale data, environment/provider failure, or documentation/skill drift.
2. Reproduce or identify the failing path with the strongest available evidence.
3. Locate producer, transformer, consumer, and gate.
4. Fix the lowest shared cause, not only the visible symptom.
5. Add a negative-control check that fails on the pre-fix state when the defect can recur.
6. Update `_context/BUG-POSTMORTEM.md` with a new P-number.
7. Promote a repeated failure pattern to `_context/RULES.md` and QA when applicable.
8. Bump version with R1 7-surface sync when versioned surfaces changed.

Do not require browser evidence for a non-UI defect. Do require browser interaction before claiming a visible UI defect is resolved; if browser control is unavailable, report runtime/static success and browser verification as BLOCKED.

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
