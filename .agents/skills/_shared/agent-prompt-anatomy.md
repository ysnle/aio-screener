# Agent prompt anatomy (delegation template)

Use this shape for every subagent prompt. Order matters: the agent reads the goal first and the context last.

1. **GOAL** — one or two sentences: the outcome, not the steps, plus what done looks like and where to stop
   (item cap, turn cap or "stop after N failed attempts").
2. **RETURN FORMAT** — exactly what to hand back (fields, ranking, length cap). Ask for evidence per item
   (file:line read, command run) and a verified/guessed mark for every claim.
3. **WARNINGS** — hard limits: files it may/may not edit, scripts it must not run (fetch-*, build-*, sync-*,
   refresh-*, generate-*, bump-version, record-fix, anything with --write), no git operations, when to stop.
4. **CONTEXT** — the background dump: why the work exists, what was tried, product facts
   (desktop + tablet + phone responsive since 2026-10-11, Korean family users, one operator, US close basis), where to look.

Rules of thumb
- One agent per independent item; give each a clean context with only what that item needs.
- Assign disjoint file ownership when agents edit in parallel, with one worktree per editing agent as required by AGENTS.md. Read-only reviewers may share the main checkout.
- Verification is a separate pass by a different agent (skeptic), not a sentence in the worker's prompt.
- After a large change, run `/trim-pr` in a fresh context: cutting after the fact beats asking a writer to be concise.
- The main session keeps ledgers, version bumps and final gates; agents return drafts.
- Reviewer prompts ask for the one fact the change's safety rests on and how far it was proven:
  said → line cited → failure path traced → script/gate run → reproduced in the app. Stop-level is reported, never upgraded.

Depth, model and fan-out (2026-10-16)
- Read-only reviewers run at low/medium effort (owner 2026-10-13). When a delegate's result is wrong, fix the prompt
  and context first; then ask: did it not know enough (use a larger model) or not try hard enough (raise effort)?
- Fan out (parallel agents, workflows, loops) only when the slices are independent, an automated check can reject a
  bad result, and there is a hard stop. Pilot one slice first and read its cost before launching the rest.
