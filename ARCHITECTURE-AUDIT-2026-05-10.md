# AIO v49.3 Architecture Audit Reinforcement

Date: 2026-05-10
Source: `AIO_Screener_v49_전수감사_최종보고서.docx`
Scope: function inventory, data pipeline, page functions, charts, AI prompts, portfolio risk, test coverage.

## 1. Function Inventory Actions

- Pure calculation functions now include `calcDataQuality`, `calcAIInfraHeat`, `calcPositionTechnicalRisk`, and `calcPortfolioTechnicalRisk` in `js/aio-core.js`.
- OHLCV technical functions remain centralized in `calcTechnicalSnapshot` and `calcSellPressure`; snapshot aliases such as `dist50ATR` were added to reduce naming drift.
- Render-only additions live in `js/aio-ui.js`: `renderDataQualityBadge`, `renderNewsImpactBadge`, and `renderPortfolioTechnicalRisk`.
- API/data additions live in `js/aio-data.js`: `fetchOHLCVBundleWithFallback` and `calcNewsImpactVector`.

## 2. Data Pipeline Actions

- `fetchOHLCVWithFallback()` still returns an array for legacy compatibility, but now attaches non-enumerable `dataQuality`.
- `fetchOHLCVBundleWithFallback()` returns explicit `{ data, dataQuality }` for new callers.
- News items now carry `impactVector` with `tickerImpact`, `factor`, `technicalImpact`, `portfolioImpact`, `urgency`, `sentiment`, and `topic`.
- Data quality uses source, rows, timestamp, stale/error/missing flags, freshness, and confidence labels.

## 3. Page And Chart Actions

- Technical page now shows data quality beside the Institutional Technical Brief.
- Semiconductor heat panel now includes AI infrastructure basket heat when available.
- Portfolio page now adds a technical position-risk panel under the VaR/Sharpe/MDD/correlation section.
- Existing chart destruction and SVG fallback behavior from v49.2 is preserved.

## 4. Prompt And Text Actions

- Technical prompts in `js/aio-chat.js` and inline `CHAT_CONTEXTS.technical` now reference DataQuality, NewsImpactVector, AIInfraHeat, and PortfolioTechnicalRisk.
- Action ladder remains mandatory: `HOLD_CORE`, `NO_ADD_RAISE_STOP`, `TRIM_25_33`, `TRIM_50`, `EXIT_OR_HEDGE`.
- Low confidence or fallback data must be explained conservatively instead of presented as live precision.

## 5. Portfolio/Risk Actions

- Position technical risk combines sell pressure, 10/21/50MA violation state, ATR extension, P/L, and concentration.
- Portfolio technical risk aggregates average/max position risk and top-weight concentration into a single heat score and action.
- This complements, rather than replaces, existing VaR, Sharpe, MDD, and correlation analytics.

## 6. Test Coverage Actions

- Added T108~T115 for DataQuality, ATR alias/stage fields, AIInfraHeat, position risk, portfolio risk, NewsImpactVector, data-quality badge rendering, and prompt action-ladder consistency.
- Existing T103~T107 institutional technical engine tests remain unchanged.

