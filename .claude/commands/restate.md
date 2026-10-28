# /restate

Before starting a non-trivial task, restate in your own words:

1. **Goals** — what the user is ultimately trying to achieve (product outcome, not the literal request).
2. **Problem** — the concrete problem this request solves, and for whom (family users / the operator).
3. **Constraints you are honouring** — scope rules and standing decisions that apply (responsive desktop/tablet/phone, no deploy
   without an explicit request, US-close basis, ledgers via `scripts/record-fix.mjs`, etc.).
4. **What done looks like** — the observable result and how it will be verified.
5. **Open questions** — only the ones whose answer changes what you will do.
6. **Deeper, not bigger** (Felix Rieseberg, 2026-10-13) — for analysis, data or review work, answer before starting:
   (a) what a top professional in this field would do here that the request does not ask for;
   (b) the rawest material they would start from instead of what is already digested — the SEC filing, FRED/BLS series,
   artifact or log, not a summary, handoff or earlier report;
   (c) the specific methods and tools they would use — named methods (event study, non-overlapping sample, replay), not vocabulary;
   (d) what, other than you or the user, would show the result is right — a gate that fails on the wrong answer, a replay, the live page.
   Then restate the task as that deeper version. Describe the verb, not the noun ("get busy people to decide under uncertainty",
   not "a report"), and do what a practitioner does rather than write in their voice. `anthropic-skills:be-ambitious` runs the
   same step when it is installed.

Keep it under 20 lines. If a question in (5) blocks the work, ask it and stop; otherwise continue.
