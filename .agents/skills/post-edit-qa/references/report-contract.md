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
