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
   (file, P number or commit), what each time cost, the prevention level chosen (ladder below) and why the higher
   levels do not fit, verified/guessed. Look in these places: navigation (agent read the wrong file or too much),
   automated checks (missing, unwired or too lax), standing docs (AGENTS/CLAUDE/skill lines that were ignored, stale or no-ops),
   tool economy (repeated expensive commands, oversized outputs), information access (facts the agent had to guess).
4. Prevention ladder, highest that works (adapted from pstack `/correct`, 2026-10-16):
   1. structure: one owner or one generated source, delete the old path the agent copied;
   2. gate: a check whose failure message names the correct file or function (new additions only when old cases exist);
   3. test of behaviour (never a text pin);
   4. a doc/rule line, only for judgement calls nothing can check.
   A proposed gate must be shown failing on one recorded past occurrence. A rule whose mistake can no longer happen is a
   removal candidate.
5. A class seen three times or more is a candidate for RULES promotion and a gate (the compounding loop in
   CLAUDE.md). Present the list; apply only what the user approves, then record one change-only entry.

## Rules for the reviewer
- Read-only; no git writes; never run fetch-/build-/sync-/refresh-/generate-/bump-version/record-fix or `--write`.
- Count only occurrences with evidence. A single occurrence is not a pattern; say "seen once" and move on.
- Prefer removing a step or merging two rules over adding a new one. Name the rule or gate a proposal would change.
