# /autoresearch

## AIO Skill Operating Contract

This command selects its named skill. Read its entrypoint and only the references needed now; reuse `.claude/skills/_shared/operating-contract.md` and other unchanged context already read.

Use `.claude/skills` as canonical and, only after canonical skill edits or confirmed mirror drift, refresh the Codex mirror with `node scripts/sync-agent-skills.mjs`. Keep R1 as 7 surfaces when a version bump is required, and run `node scripts/ci-skill-contract-check.mjs` after skill or wrapper edits.

## Route

Run `.claude/skills/autoresearch/SKILL.md`.

## Final Output

Separate verified, blocked, and unverified surfaces. Do not claim browser, network, or live validation unless it actually ran.
