# /retro

Once a week (or after a long batch), look back over recent sessions in a **fresh context** and find the mistakes
that keep coming back. One session sees its own errors; only a look across sessions shows the repeated class.

## How
1. Spawn one read-only reviewer agent at low or medium effort (prompt shape: `.claude/skills/_shared/agent-prompt-anatomy.md`).
   Give it only the window (default: the last 7 days) and the sources below.
2. Sources, newest first:
   - `_artifacts/**/HANDOFF*.md` and `*RESPONSE*.md` dated inside the window
   - `git log --since=<window>` subjects and the CHANGELOG headings they touch
   - `_context/BUG-POSTMORTEM.md` entries added inside the window (search by P number range, never load it whole)
   - the user's feedback memories, when the harness has a memory directory
3. It returns at most 10 rows, most frequent first: mistake class, two or more dated occurrences with evidence
   (file, P number or commit), what each time cost, the cheapest prevention (gate, rule line, routine step or
   nothing), verified/guessed.
4. A class seen three times or more is a candidate for RULES promotion and a gate (the compounding loop in
   CLAUDE.md). Present the list; apply only what the user approves, then record one change-only entry.

## Rules for the reviewer
- Read-only; no git writes; never run fetch-/build-/sync-/refresh-/generate-/bump-version/record-fix or `--write`.
- Count only occurrences with evidence. A single occurrence is not a pattern; say "seen once" and move on.
- Prefer removing a step or merging two rules over adding a new one. Name the rule or gate a proposal would change.
