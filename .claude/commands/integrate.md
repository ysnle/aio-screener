# /integrate

## AIO Skill Operating Contract

This command is a thin wrapper. Read `_context/CURRENT-STATE.md`, `_context/WORKFLOW-GOVERNANCE.md`, `_context/INDEX.md`, `.claude/skills/_shared/operating-contract.md`, and `.claude/skills/integrate/SKILL.md` completely.

Use `.claude/skills` as canonical and refresh any local Codex mirror with `node scripts/sync-agent-skills.mjs`. Keep R1 as 7 surfaces when a version bump is required, and run `node scripts/ci-skill-contract-check.mjs` after skill or wrapper edits.

## Route

Run `.claude/skills/integrate/SKILL.md`.

## Final Output

Separate verified, blocked, and unverified surfaces. Do not claim browser, network, or live validation unless it actually ran.
