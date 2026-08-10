# Data Source And Promotion Policy

Read this reference before collecting, replacing, or promoting market data.

## Source Priority

1. Prefer the official producer or regulator for releases, calendars, and filings.
2. Prefer an existing repository producer and its raw artifact over manual transcription.
3. Use reputable secondary sources only when the primary source is unavailable and label them as secondary.
4. Treat search snippets, Telegram, commentary, and user-supplied observations as `REFERENCE` until independently verified.

## Required Evidence Fields

Record or preserve, where the target schema supports them:

- `source` or source URL/identifier.
- `sourceKind`: `LIVE`, `OFFICIAL`, `SECONDARY`, `REFERENCE`, or `FALLBACK`.
- Observation or release timestamp.
- Collection timestamp.
- Freshness/session state.
- Failure or blocked reason.

## Promotion Rules

- Never invent, interpolate, or extrapolate a missing current market value.
- Never relabel a stale artifact as current by changing only its timestamp.
- Never replace a precise indicator with a same-topic proxy without changing the label and contract.
- Preserve the last known good artifact on collection failure and expose its stale state.
- Keep producer, artifact, consumer, and gate synchronized in one change.
- Use web browsing only when it is available and cite the actual source consulted; otherwise mark external refresh as BLOCKED.

## Binary Checks

| ID | Question |
|----|----------|
| SP1 | Does every promoted value have an identifiable source and observation boundary? |
| SP2 | Are failed or unavailable sources marked BLOCKED/STALE rather than fabricated? |
| SP3 | Is `REFERENCE` content prevented from becoming a current decision input? |
| SP4 | Does the consumer label match the exact indicator or proxy being supplied? |
