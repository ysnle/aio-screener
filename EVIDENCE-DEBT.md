# AIO Evidence Debt

Version: v50.1
Updated: 2026-06-02T19:10:00+09:00

## Baseline

- Route pages: 21 (`home`, `signal`, `breadth`, `sentiment`, `briefing`, `technical`, `macro`, `fxbond`, `fundamental`, `themes`, `theme-detail`, `portfolio`, `ticker`, `market-news`, `options`, `kr-home`, `kr-supply`, `kr-themes`, `kr-macro`, `kr-technical`, `guide`)
- Static DOM surface: 259 live bindings, 106 snapshot bindings, 110 chart-like elements, 525 controls, 34 tables, about 32,095 numeric tokens.
- `guide` is classified as education/reference content, not market-current trading content.
- `DATA_SNAPSHOT` is fallback/reference/historical by default. It must not be treated as verified current trading evidence without promotion through `EvidenceStore`.

## Debt Classes

- `snapshot/reference`: visible values backed only by `DATA_SNAPSHOT`, static dates, or fallback mirrors. Remediation: attach external/current source evidence or keep visibly reference-only.
- `chart-series-required`: chart containers that need series source, lastPoint, asOf, fallback, and blank-render checks. Remediation: assign `chartEvidenceId` and connect chart draw functions to series metadata.
- `numeric-current-metric-evidence-required`: static numeric text that appears to be a current market metric. Remediation: bind to live/snapshot/formula evidence or reclassify as threshold, historical, guide-example, version, code, or reference-only.
- `current-claim-evidence-required`: narrative text that makes a current market claim without a nearby evidence link. Remediation: link to EvidenceStore or rewrite as structural explanation.
- `table-source-policy-required`: table content without row-level source/asOf policy. Remediation: assign table evidence and row freshness policy.
- `trading-decision-currentness-required`: market score/regime/execution window/stage/ticker/options outputs that can affect trading decisions must pass `AIO.getTradingDecisionInputEvidence()` and `AIO.getTradingDecisionLogicAudit()`. Remediation: verified current inputs first; otherwise show reference-only/data-check instead of actionable guidance.

## Trading Decision Debt

- Breadth proxies (`TOP_GAINERS_LOSERS`, RSP/SPY ratio) are acceptable only as fallback labels, not full market breadth proof.
- Technical proxies from same-day price change are not RSI/MACD evidence and must remain non-decision-use when OHLCV is unavailable.
- Single-stock entry checklist must prefer fresh ticker OHLCV/quote evidence over static screener RSI/signal.
- Options IV Rank must use verified VIX history when available; reference bands are reference-only.

## Acceptance Gate

Use `AIO.runEvidenceDeploymentGate({ strict: true })`.

Must-pass minimum:

- 21 route page contracts exist.
- Contract-derived `DATA_REQUIREMENT_PROFILES`, `AIO_PAGE_REFRESH_MAP`, and `PAGE_DEEP_AUDIT_SYSTEMS` are populated.
- `EvidenceStore` has `unclassifiedCount === 0` and `totals.needs_evidence === 0`.
- Critical pages have block count 0.
- `SourceAdapterRegistry` and `AuditRegistry` exist and run.
- `AIO.getTradingDecisionLogicAudit()` is included in `AIO.runEvidenceDeploymentGate()` and has no strict-blocking trading-use fallback findings.

Warn-level remediation remains expected until each current claim, chart, table, and static numeric text has a concrete source adapter or is explicitly classified as reference/education/historical.
