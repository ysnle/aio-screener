# Post-Edit QA Report Contract

Use this reference when writing the final QA report.

## Required Sections

1. Summary with PASS/WARN/FAIL.
2. Touched surfaces.
3. Tier results.
4. FAIL items requiring immediate fix.
5. WARN items requiring user or future review.
6. Fixed items.
7. Gates run with exact command names.
8. Unverified or blocked surfaces.

## Number Claims (2026-10-16)

Before a report states a measured number (speed, size, count, coverage, a market statistic or a hit rate), check:
the work actually ran and finished inside the measurement; failures and empty results were counted, not skipped;
what limits the number (the slow step, the sample size, the source cadence); and, for a before/after claim, that
the gap exceeds run-to-run noise. If any of these is unknown, report the number as inconclusive with the reason.

## Binary Completion Checks

| ID | Question |
|----|----------|
| QA1 | Did Tier 1 pass or list exact failures? |
| QA2 | Were touched user-facing pages checked? |
| QA3 | Were touched data producers and consumers checked together? |
| QA4 | Were security and escaping surfaces considered for UI text changes? |
| QA5 | Were blocked checks separated from passing checks? |
| QA6 | Was the relevant executable gate run or named as unavailable? |
| QA7 | For UI/UX-visible changes, does the report state whether Tier 13 (live browser) ran, and if not, why? |
| QA11 | Does every measured number in the report pass the Number Claims check or carry "inconclusive" with a reason? |
