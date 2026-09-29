# /bug-fix

## AIO Skill Operating Contract

This command selects its named skill. Read its entrypoint and only the references needed now; reuse `.claude/skills/_shared/operating-contract.md` and other unchanged context already read.

Use `.claude/skills` as canonical and, only after canonical skill edits or confirmed mirror drift, refresh the Codex mirror with `node scripts/sync-agent-skills.mjs`. When a version bump is required, use `node scripts/bump-version.mjs` (it patches every version surface) and record ledgers with `node scripts/record-fix.mjs`, and run `node scripts/ci-skill-contract-check.mjs` after skill or wrapper edits.

## Route

Run `.claude/skills/bug-fix/SKILL.md`.

## Final Output

Separate verified, blocked, and unverified surfaces. Do not claim browser, network, or live validation unless it actually ran.
