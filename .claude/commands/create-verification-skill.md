# /create-verification-skill

## AIO Skill Operating Contract

This command selects its named skill. Read its entrypoint and only the references needed now; reuse `.claude/skills/_shared/operating-contract.md` and other unchanged context already read.

Use `.claude/skills` as canonical and, only after canonical skill edits or confirmed mirror drift, refresh the Codex mirror with `node scripts/sync-agent-skills.mjs`. Run `node scripts/ci-skill-contract-check.mjs` after skill or wrapper edits. Never commit or push unless the user asks.

## Route

Run `.claude/skills/create-verification-skill/SKILL.md`.

Generate or rebuild a project-local verification skill (in AIO: `.claude/skills/verify-aio/`).
