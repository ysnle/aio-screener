# Integrate Workflow

Use this reference when a user provides analysis, research, news, reports, interviews, or market commentary to integrate into AIO.

## Classification

Classify the source into one or more buckets:

- Technical analysis.
- Macro regime or cross-asset signal.
- Sector/theme rotation.
- Company or ticker-specific insight.
- News/event update.
- Risk management or trading process rule.
- Prompt/LLM behavior guidance.

## Extraction

Extract only durable, reusable information:

- New concepts or framework rules.
- New keywords with at least 3 characters, respecting R17.
- Ticker or theme mappings.
- Chat context additions.
- Screener or ranking logic.
- Risk rules or invalidation conditions.

Do not integrate transient claims unless they update a dated data surface and pass data-refresh rules.

## Sensitive Data Guard (R290/P653)

Every integration target below is a git-tracked file that this repo deploys publicly via GitHub Pages. Before writing extracted material into any of them:

- Scan user-provided source material for credential-shaped strings: API key prefixes (`sk-`, `AKIA`, etc.), private-key block headers, account/card numbers, tokens, passwords.
- If found, do not persist the literal value. Mask it (e.g. `sk-***redacted***`) or drop the line, and tell the user in your response what was excluded and why, so they know to rotate it if it was already committed elsewhere.
- This applies even when the user pastes the material directly into chat — the risk is what lands in the git-tracked doc, not how it arrived.

## Integration Targets

Choose the smallest correct target:

- `TECH_KW` or `MACRO_KW` for keyword routing.
- `CHAT_CONTEXTS` for AI answer context.
- Screener/theme/ticker registries for classification.
- `_context/KNOWLEDGE-BASE` or related docs for durable insight.
- CHANGELOG and version surfaces when behavior changes.

## Self-Eval

Before closeout:

| ID | Question |
|----|----------|
| I1 | Did the integration extract the framework rather than copy prose? |
| I2 | Are all new keywords at least 3 characters? |
| I3 | Is every changed consumer connected to a producer/source? |
| I4 | Did CHANGELOG and R1 version sync happen when behavior changed? |
| I5 | Are unsupported claims marked unverified or omitted? |
| I6 | Were credential-shaped strings masked or dropped before writing to any git-tracked doc? |

