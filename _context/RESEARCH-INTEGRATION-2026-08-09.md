# Research Integration Ledger — 2026-08-09

## Purpose

This ledger records how the user-supplied text, links, and nine clipboard images were converted into AIO reference context, screener evidence fields, prompts, ticker memos, and validation gates. It keeps observations separate from current facts and prevents screenshot thresholds or interview estimates from becoming hidden live inputs.

## Source boundary and quality tiers

| Tier | Use | Examples |
|---|---|---|
| 1 | Current decision evidence | Provider time series, filings, utility/ISO measurements, reproducible calculations |
| 2 | Corroboration and mechanism | Primary research, official releases, attributable dated interviews |
| 3 | Hypothesis generation | X posts, analyst commentary, screenshots, pasted summaries |

X pages were not independently readable in the execution environment. The pasted text and images were therefore retained as `REFERENCE`; inaccessible links were not treated as verified primary evidence. The readable corroboration used for the power frame was [Bloomberg's power-quality analysis](https://www.bloomberg.com/graphics/2024-ai-power-home-appliances/), [the arXiv power-transient paper](https://arxiv.org/abs/2606.25095), and [Power 2026's grid/interconnection framing](https://power2026.ai/). Bloomberg's own framing requires correlation and facility-specific measurement; it does not support a universal household-appliance damage claim.

## Material-by-material integration

| Material | Extracted observation | Structural integration | Quality limit / invalidation |
|---|---|---|---|
| AI data-center power summary | Fast GPU workload ramps can create transformer thermal stress, voltage flicker and harmonics; total MWh is not the whole problem. | `powerQualityFrame`; monitor ramp-rate, peak-to-average, transformer load/temperature, PCC THD, sag/swell/flicker, frequency, interconnection, BTM and PPA. | Measure at the facility/PCC. Correlation is not causation; utility monitoring can disagree. |
| Gavin Baker summary | AI demand debate should join GPU availability/rental repricing, OCF, frontier-lab growth, memory LTA, credit and power capacity. | Q1-Q5, `demandFalsifiers`, memory LTA frame, NVDA/AVGO/AMD/MU/CRWV/IREN/CEG/BE and hyperscaler memos. | Interview estimates are hypotheses until filings, contract terms, rental prices, cash flow and power delivery reconcile. |
| O'Neil climax-top list | Record gain/volume, exhaustion gap, rapid run, railroad track, high-volume no-progress, down-day clustering, channel extension and 200SMA stretch are exhaustion clues. | `calcBlowoffTopChecklist`, weekly-bar input, `setupProfile.climaxRisk`, entry timing and missing-evidence behavior. | Probabilistic checklist. Weekly rules are not valid when only daily bars exist; no automatic sell/order. |
| Image 1 — TradingView Best winners | Price >$1, ADR ≥4.5%, 52-week-low distance ≥70%, dollar liquidity, current dollar volume, EMA8>EMA21 and price>EMA60 form a liquid continuation candidate screen. | Server computes `price`, `adrPct`, `pctFrom52wLow`, `dollarVolume30d`, `dollarVolume`, `ema8/21/60`; `winnerFilter` is candidate/not-confirmed/unavailable; UI filter `TradingView 승자 필터 통과`. | Thresholds are a template. Any missing field fails closed; this screen does not prove earnings quality, support or absence of climax risk. |
| Image 2 — Relative-strength pullback | Pullbacks near 200SMA can offer continuation hypotheses; failed reclaim/supply can support short research. | `relativeStrengthPullback`, `support200`, supply-side short frame; DELL/HPE/BE/NBIS/CVNA references. | Fresh support, benchmark RS, volume, borrow/flow and invalidation are required. Weakness alone is not a short. |
| Image 3 — KOSPI | 200MA undershoot/reclaim, gap retracement, oscillator divergence and volume frame a Korean-index regime hypothesis. | Chart-reading protocol, KOSPI/EWY breadth and macro prompts; levels are not hardcoded. | Image levels are historical context only. |
| Image 4 — S&P 500/Nasdaq | MACD divergence, stochastic reversal and 50/200MA recovery need retest and breadth confirmation. | Index breadth/relative-strength checks and chart protocol. | Divergence alone is not a reversal signal. |
| Image 5 — WTI/10Y/DXY/KRW | Rates, dollar, oil and FX are transmission channels for equity/semiconductor risk. | Macro/FX/bond cross-checks and protect playbook. | Current direction must come from live series; no screenshot values enter `DATA_SNAPSHOT`. |
| Image 6 — Daily recap | Cybersecurity, mega-cap software, steel, refiners, semis, dollar and SQQQ/QQQ are separate leadership or hedge branches. | PANW/CRWD/DDOG/RBRK/NUE/RS/STLD/PSX/VLO/MPC memos; SQQQ registered as hedge-demand context, not a quality candidate. | Peer strength is not fundamental proof. Inverse ETF strength is not equity leadership. |
| Image 7 — Economic calendar | Event date, time and impact tier define observation windows. | `eventCalendarFrame`, calendar-aware prompts and current-provider requirement. | Screenshot dates/times do not populate current calendar data. |
| Image 8 — Earnings calendar | Before/after-market grouping creates gap, liquidity and invalidation risk. | Earnings-event prompts and ticker catalyst checks. | Actual/estimate/surprise and price-volume reaction must be current. |
| Image 9 — Support/resistance chart | Returning to an uptrend does not remove pullback, two-way tape or time risk. | Reclaim/failed-retest protocol, wait/probe behavior, support/resistance and invalidation. | A rebound is not a confirmed trend change. |

## Q1-Q5 convergence frame

1. **Q1 — Demand or narrative?** Require utilization/backlog conversion and OCF, then compare with depreciation, financing and power delivery.
2. **Q2 — What is the market model?** Separate memory P/ASP and multiple, neocloud Q/utilization and capital access, and software usage/retention.
3. **Q3 — What falsifies it?** OCF acceleration stops, GPU rental/used prices fall, frontier-lab growth stalls, memory/LTA weakens, or credit/power blocks capacity.
4. **Q4 — Is the move accepted?** Require price acceptance after reclaim/retest, volume, benchmark-relative strength, breadth and catalyst reaction; a gap or low-volume bounce is insufficient.
5. **Q5 — What changes the view?** State confirmation, invalidation, missing fields and next observation window. Do not use a narrative, screenshot, single divergence, or low P/E as a conclusion.

## Screener/data contract added

The published EOD artifact now carries nullable evidence fields:

`price`, `adrPct`, `pctFrom52wLow`, `pctFrom52wHigh`, `avgVolume30d`, `dollarVolume30d`, `lastVolume`, `dollarVolume`, `ema8`, `ema21`, `ema60`.

`setupProfile.winnerFilter` is:

- `candidate`: all seven illustrated checks pass;
- `not-confirmed`: all seven fields exist but at least one check fails;
- `unavailable`: at least one required field is missing.

The profile remains `research-relative-ranking-only`; it does not become a trading signal. `missingEvidence` names each absent field, and the screener exposes filters for winner candidates, RS pullbacks, 200SMA proximity, climax watch, and missing evidence.

## Runtime and communication contract

Every answer using this packet must distinguish:

- observed current provider/filing/measurement evidence;
- user-supplied reference evidence;
- inference or scenario;
- missing evidence and invalidation.

Power-quality claims must state the measurement needed: PCC THD/current harmonics, voltage sag/swell/flicker, frequency response, transformer temperature/load factor, and a validated interconnection load model. Supply-side short claims must state overhead supply, failed reclaim/retest, volume/borrow/flow, catalyst and invalidation.

