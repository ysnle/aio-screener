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

## Lenses (2026-10-16, from reviewed X/pstack materials)
- **Deletion test:** if this function/module/option were deleted, would its complexity reappear in callers? No → CUT.
  Prefer delete over simplify, simplify over optimise, optimise over automate. "Nothing to cut" is a valid answer.
- **Comments:** this repo keeps "why" comments with a version/P tag and notes on browser, provider or data-source
  quirks. Flag only: stale comments the code contradicts, comments that restate the next line, and workaround comments
  with no P/R reference or removal condition (agents copy these). A "do not change" comment whose constraint a cheap
  gate or test could hold is a SIMPLIFY candidate: encode it, then shorten the comment to the reference.
- **Low-signal tests/gates:** a check that restates the implementation (text pin, snapshot of its own output) and would
  not catch a real defect the behaviour gates miss. Name the defect it would catch or mark it CUT-candidate.
- Give the reviewer a target ("find at least N lines or say why not"); open-ended cleanup stops too early.

## Tooling
- `node scripts/dead-code.mjs report [js/<file>.js]` lists top-level names with no runtime reference (RULES-named ones are flagged keep; test/gate-only refs are listed). `node scripts/dead-code.mjs remove <file> <names>` deletes them CRLF-safely. Re-grep string-built references before removing.
- Parallel trims: one worktree per file group (`git worktree add <dir> -b claude/vX.Y-<area> <base>`), disjoint ownership, integrate and gate once.

## Rules for the reviewer
- Read-only; no git writes; never run fetch-/build-/sync-/refresh-/generate-/bump-version/record-fix or `--write`.
- A CUT needs verified evidence (no runtime, test or gate caller). Otherwise mark it `guessed`.
- Do not trim ledgers/CHANGELOG history; RULES entries are contracts — name the rule a cut would violate.
