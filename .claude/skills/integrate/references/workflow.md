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

