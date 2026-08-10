# Autoresearch Workflow

Use this reference when improving a skill through repeated binary evaluation.

## Required Inputs

Collect these before starting the loop:

1. Target skill path.
2. Three to five realistic task prompts.
3. Three to six binary evals.
4. Experiment count, default 5.
5. Experiment interval, default 2 minutes when a live loop is used.
6. Stop condition or budget limit.

If any required input is missing and cannot be inferred from local context, ask the user before running the loop.

## Eval Design

Each eval must be yes/no, observable, and tied to user-visible quality. Avoid subjective scales, duplicate checks, and checks the agent can pass without improving the skill.

Use `references/eval-guide.md` when writing or revising evals.

## Baseline

1. Create `autoresearch-[skill-name]/`.
2. Save the original target skill as `SKILL.md.baseline`.
3. Run the unmodified skill on all task prompts.
4. Score every output against every eval.
5. Record experiment `0` in `results.tsv` and `results.json`.

Choose the evaluation mode before scoring:

- Use deterministic static evaluation for skill topology, references, wrappers, encoding, and mirror parity.
- Use behavioral runs for output quality. If independent task runs are unavailable, record behavioral quality as unverified rather than inferring it from static checks.

## Experiment Loop

For each experiment:

1. Identify the most frequent failed eval.
2. Choose exactly one prompt, instruction, routing, or reference change.
3. Apply that single change to the working copy, not the original baseline.
4. Re-run the same prompts and evals.
5. Keep the change only if the score improves.
6. Revert if the score is equal or worse.
7. Record the score, decision, and reason in `results.tsv` and `changelog.md`.

One variable means one causal hypothesis. A change may touch multiple files when those files form one contract boundary, such as canonical skill plus generated-mirror gate.

Stop when the user interrupts, the budget is reached, or the skill passes at least 95% for three consecutive experiments.

## Dashboard Contract

If an autoresearch run creates a dashboard, generate a single local HTML file with:

- Auto-refresh from `results.json`.
- Score trend by experiment.
- Accepted, rejected, and baseline states.
- Eval breakdown.
- Current status.

## Output Contract

Return:

- Improved working skill file.
- `results.tsv`.
- `results.json`.
- `changelog.md`.
- Dashboard path when generated.

