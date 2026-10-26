# /prototype

Settle a design or behaviour question **with throwaway code before planning the real change**: two or three variants the
owner can see side by side, with screenshots and measurements, instead of one first design accepted on trust. Adapted from
pstack `playbooks/prototype.md` and mattpocock `prototype` (2026-10-25). The owner judges from screens, not specs.

## When
- A screen, chart or interaction with no precedent in the app, or an owner reference image (find the existing screen first,
  AGENTS coding discipline ①).
- An empirical fork a run can answer (which chart reads in 3 seconds, which layout survives 390px, which rule flips less).
- Not for bug fixes or a change with one obvious shape — say so and stop.

## How
1. State the one decision the prototype exists to make. No decision, no prototype.
2. Build 2–3 genuinely different variants in `_artifacts/prototype-<topic>-<date>/` (git-ignored scratch), never in `src/`
   or `js/`. Use the committed `public-data/` so numbers are real; no new producer, no AI spend.
3. Put the variants behind one switcher (buttons or `?v=a|b|c`), each labelled. A behavioural question gets the smallest
   script that prints the outcome instead (for a rule: replay it over `public-data/history.json` and count flips).
4. Observe on the real surfaces: desktop, iPad portrait and phone screenshots of each variant (verify-aio viewports or the
   browser pane), light and dark. Measure what the decision turns on — visible text length against
   `architecture/secondary-text-budget.json`, overflow at 390px, time to first meaningful paint, flip count.
5. Present: the variants, the evidence, the trade-offs, one recommendation with its reason. Say plainly that the code is
   throwaway. The chosen variant is then built properly in the owner module (CODE-MAP / route owners) under the usual
   batch flow, and the scratch folder is deleted.

## Rules
- Speed over polish inside the scratch folder; the product rules still apply to what is shown (no emoji, no developer copy,
  no invented numbers, sources off screen).
- A variant the owner did not ask for is welcome; a variant that breaks a product decision is not — name the decision.
