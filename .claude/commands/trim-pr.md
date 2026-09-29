# /trim-pr

After a PR (or a large local change) is ready, review it in a **fresh context** and cut what is not needed.
Writers add more code than required; asking them to be concise up front does not work — cutting after does.

## How
1. Spawn one read-only reviewer agent (prompt shape: `.claude/skills/_shared/agent-prompt-anatomy.md`).
   Give it only: the PR number/branch, the base commit for this change, the product facts, and the rules below.
2. It returns a ranked list (max 25): file:line, what to cut/simplify, evidence it read (caller search),
   lines saved, risk + which gate could break, verdict CUT / SIMPLIFY / KEEP-BUT-NOTE, verified/guessed.
3. For large PRs, fan out: one reviewer per area (src/, js/, scripts/ gates, workflows), then one skeptic
   agent that re-checks every CUT verdict against callers and RULES before anything is applied.
4. Present the list. Apply only items the user approves (or low-risk verified CUTs when the user asked for
   autonomous cleanup), then run the affected gates and record one ledger entry for the batch.

## Rules for the reviewer
- Read-only; no git writes; never run fetch-/build-/sync-/refresh-/generate-/bump-version/record-fix or `--write`.
- A CUT needs verified evidence (no runtime, test or gate caller). Otherwise mark it `guessed`.
- Do not trim ledgers/CHANGELOG history; RULES entries are contracts — name the rule a cut would violate.
