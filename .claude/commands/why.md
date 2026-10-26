# /why

Find out **why** a piece of AIO code, rule or number is shaped the way it is before changing it. Code shows what happens;
this repo keeps the reasons in version-tagged comments, CHANGELOG, BUG-POSTMORTEM (P), RULES (R), QA-CHECKLIST and the
handoffs. Adapted from pstack `/why` and `/recall` (2026-10-25): the sources are this repo's ledgers, not Slack or Linear.

## How
1. Anchor first. Run `node scripts/why-trace.mjs <file>[:<start>[-<end>]]` or `node scripts/why-trace.mjs --symbol <name>`.
   It prints the last-touch commits for the lines, every version/P/R/QA id in those lines and commit messages, and the
   ledger line for each id. Read only what it points to (search ledgers by id; never load them whole).
2. Fill the gaps the anchor leaves: the latest `_artifacts/**/HANDOFF*.md` or `*RESPONSE*.md` that names the symbol, the
   owner decision in AGENTS "Product decisions", and the gate that pins the behaviour (`grep -rn <symbol> scripts/ci-*`).
3. If the code looks defensive (a hold, a fallback, a stale guard, a retry, a latch), look for the incident it answers:
   the P entry whose symptom it prevents. A guard with no P/R reference is a finding, not a reason to delete it.

## Reply (in Korean, this order)
- **질문과 대상 코드** — file:line range.
- **확인된 것** — each claim with its source (commit sha, P/R/QA id, CHANGELOG version, file:line).
- **추정** — what the sources suggest but do not state, marked as such. Never promote an inference to a finding.
- **경쟁 가설** — when two readings fit the evidence, both, with what would tell them apart.
- **모르는 것** — what no source answers.
- **찾아본 곳** — one line per source, including the ones that returned nothing.
- When the question precedes a change: **지킬 것 / 바꿀 것 / 피할 것 / 위험** — the constraint set for the change.

## Rules
- Read-only. Recency bias is the common error: the last commit is often a merge or a sweep; trace the version tag in the
  comment back to its CHANGELOG entry.
- When a doc and the code disagree, the code is what runs; say which doc is stale (CLAUDE.md, 2026-10-25).
