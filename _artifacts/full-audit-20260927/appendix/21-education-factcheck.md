# AIO Screener — Educational Content Fact-Check Audit (Read-Only)

Audit date: 2026-09-28. Scope: js/aio-glossary.js, guide page (src/ui/pages/guide.js + index.html
static content lines 12392-13357), public-data/principles/*, public-data/atlas/* (partial),
public-data/masters/* (partial), selected tooltips in index.html, and cross-checks against
implementation code in js/aio-core.js, js/aio-data.js, js/aio-macro-tech.js, js/aio-ui.js.

No project files were modified. No scripts were executed. Web verification used WebSearch/WebFetch
against primary sources (Fed, CBOE definitions, KRX/기획재정부 tax rules, Piotroski literature).

## Coverage actually achieved (be precise about gaps)

| Area | Total | Read | Deep fact-check applied |
|---|---|---|---|
| js/aio-glossary.js terms | 273 | 273 (100%, both halves) | ~25 terms checked against primary/web sources or code; the file already contains an internal `GLOSSARY_FIGURE_SOURCES` audit registry (86 entries) covering most numeric claims — I spot-checked ~15 of those 86 registry rows against external sources |
| Guide page content (index.html #page-guide, ~965 lines) | 1 page | 100% | Yes — 10-step routine, Qullamaggie/Minervini/SEPA section, FAQ, API setup, trading-hours math, VIX/DXY/tax blocks all read and checked |
| public-data/principles/chapters.json | 15 chapters | 15 (100%) | Conceptual/framing text, low numeric-claim density; spot-checked |
| public-data/principles/lesson-library.json | 112 lessons | Header + grep scan of all 112 for numeric patterns; 1 lesson (D6, 중립금리) read in full and verified against live Fed sources | 1 lesson fully verified (see below); rest are largely non-numeric conceptual prose (grep found almost no hard numbers to check) |
| public-data/atlas/* (12 files, ~9,039 lines) | 12 files | Structure + samples of foundation-lessons.json and domain-claim-ledger.json read; **did not reach the 25% depth-sampling target** on taxonomy-node-coverage.json / current-evidence-ledger.json / player-product-currentness.json due to time budget | Partial — flagged as a coverage gap below |
| public-data/masters/* + src/ui/pages/masters.js | 34 manager JSON files + manager-principles.json | manager-principles.json fully read (50 lines, all profiles); masters.js fully read; individual 13F holdings JSON files (34 files) not opened — they are SEC-filing-derived data tables, not prose | manager-principles.json checked for misattributed quotes — none found (deliberately quote-free, sourced to official investor-relations pages) |
| Code cross-checks | — | RSI thresholds, VIX bands, Weinstein/Stage models (3 implementations), VCP/SEPA criteria, Bollinger comment, F&G, Piotroski, DXY, Sahm Rule, Korean securities tax, TPR/RPR/ER/SR acronyms | — |

**Headline finding**: this codebase has already been through substantial internal hardening — the
glossary carries its own `GLOSSARY_FIGURE_SOURCES` provenance registry, and most "X% = signal"
claims are already hedged as "관례/방법론-예시" rather than stated as universal rules. The residual
problems are concentrated in (a) numeric drift between the hedged **documentation** and the
**actual running code**, (b) one factually wrong external fact (Korean securities tax), and (c) one
wrong attribution year (Piotroski).

---

## ERRORS (factually wrong, not just unhedged)

| # | File:Line | Quoted text | What's wrong | Correct version | Source |
|---|---|---|---|---|---|
| E1 | `js/aio-glossary.js:305` | "한국주식: 증권거래세는 시장별로 다르며(2026-01-02 시행 증권거래세법 시행령 제5조 기준 — 유가증권시장 0.05%, 코넥스 0.10%, 코스닥 0.20%)" | States KOSPI (유가증권시장) total tax as **0.05%**. This is only the 증권거래세 component; KOSPI sales also carry a mandatory **농어촌특별세 0.15%**, so the real total sell-side tax on a KOSPI trade is **0.20%** — the same as KOSDAQ, not 4x cheaper. As written, a family member could conclude KOSPI trading costs a quarter of KOSDAQ's tax. Effective date is also given as "2026-01-02"; official sources say the amendment takes effect **2026-01-01**. | KOSPI(유가증권시장): 증권거래세 0.05% + 농어촌특별세 0.15% = **총 0.20%**. KOSDAQ/K-OTC: 0.20% (증권거래세만). KONEX: 0.10%. Effective 2026-01-01. | [verified-source] WebSearch results citing 기획재정부 세법 시행령 개정안 (Herald/Daum, Dec 2025): "코스피는 농어촌특별세 0.15%에 증권거래세 0.05%가 더해지고, 코스닥과 K-OTC는 0.20%로 오릅니다. 코넥스는 0.1%로 유지." |
| E2 | `js/aio-glossary.js:16` (def) and `:340` (registry) | "피오트로스키 F-점수... 7점 이상=재무 건전, 3점 이하=부실 위험" / registry: `src:'Piotroski(1998) F-Score 정의'` | The registry attributes the F-Score to **"Piotroski(1998)"**. Piotroski's F-Score paper ("Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers") was published in the **Journal of Accounting Research in 2000**, not 1998. Also, Piotroski's own paper defines its extreme deciles as **score 8-9 = high / 0-2 = low**, not the popularized "7+/3-" cited here; the registry's claim that "7/3 절단값은 원논문 표본 기준" (the 7/3 cutoffs come from the original paper's own sample) is itself inaccurate — 7/3 is a later industry simplification, not Piotroski's own boundary. | Cite as Piotroski (2000), *Journal of Accounting Research* 38 (Supplement): 1–41. Original paper's own extreme bins are 8-9 (strong) / 0-2 (weak); "7+/3-" should be labeled an industry convention, not "원논문 표본 기준". | [verified-source] WebSearch (Wikipedia "Piotroski F-score", StableBread, ChartMill summaries) consistently date the paper 2000 and describe 8-9/0-2 as the paper's own high/low bins. |

## OUTDATED (was correct once, may now be stale / needs periodic refresh)

| # | File:Line | Text | Concern | Note |
|---|---|---|---|---|
| O1 | `js/aio-glossary.js:147` | "외환보유고... 한국 약 $4,200억, 중국 약 $3.2조" | No `asOf` date attached in the glossary entry itself (the figure-sources registry does not cover this term at all — it's one of the few numeric entries missing from `GLOSSARY_FIGURE_SOURCES`). FX reserve levels move continuously; without a stated as-of date this will silently drift out of date and there is no registry entry tracking it. | [judgment] — recommend adding to `GLOSSARY_FIGURE_SOURCES` with an as-of date like the other historical-observation entries. |
| O2 | `js/aio-glossary.js:125` | "국가부채/GDP비율... 미국 약 120%, 일본 약 250%" | Same issue as O1 — flagged in the registry (`kind:'역사-관측'`) as needing a "최신 통계 확인" but no as-of date is given in the visible glossary text itself, only in the internal registry comment. Reasonable order of magnitude but could be off several points depending on vintage. | [judgment] |

## INCONSISTENT (same concept defined/computed differently in two or more places)

| # | Concept | Location A | Location B | Discrepancy |
|---|---|---|---|---|
| I1 | RSI overbought/oversold thresholds | `js/aio-glossary.js:60` ("70=과매수, 30=과매도"), `js/aio-core.js:8309-8310` (THRESHOLD_REGISTRY: rsi-oversold=30, rsi-overbought=70), `js/aio-core.js:28001` (screener check labels 30–70 as "정상 구간"), tooltip `index.html:8226` ("RSI 임계값: <30 과매도 ... 70~80 과매수") | `js/aio-data.js:16732-16733` — the AI-chat natural-language screener query parser interprets a user's free-text "과매도" as **RSI≤35** and "과매수" as **RSI≥65** | Every documented/labeled place in the product uses the Wilder-standard 30/70 split, but the actual behavior when a user types "과매도 종목 찾아줘" into AI chat silently filters at 35/65 instead — a different, undocumented threshold that will return different stocks than the glossary/tooltip promise. |
| I2 | VIX regime bands | Glossary `js/aio-glossary.js:186` (educational bands "15·20~25·30", explicitly non-binding); Position-sizing framework `js/aio-core.js:14200-14204` (bands at 15/20/25/30, tied to explicit sizePct 100/80/50/30/15); THRESHOLD_REGISTRY `js/aio-core.js:8305-8306` (vix-fear-extreme=30, vix-normal-upper=20) | Home-summary "안정/보통/경계/패닉" label at `js/aio-core.js:3800` uses **18/25/32** as the band edges (`rvix<18`, `<25`, `<32`, else) | Two different numeric bandings for the same concept (VIX regime label) coexist in the code: one system uses 15/20/25/30, another uses 18/25/32. A user reading the glossary's "15·20~25·30" framing and then seeing the home-page label at VIX=19 would get "안정" from one system's boundary (< 20) but a different classification from the 18/25/32 system (≥18 → "보통", not "안정"). |
| I3 | Minervini SEPA / "Trend Template" criteria | `js/aio-glossary.js:90` — 8 criteria matching Minervini's published Trend Template exactly: price>150&200MA, 150MA>200MA, 200MA rising, 50MA>150&200MA, price>50MA, ≥25% above 52-wk low, within 25% of 52-wk high (i.e. "75% 이내"), **RS≥70** | `index.html:12861-12864` (guide page, "SEPA 기준") lists only **7** criteria — drops "가격>150일선" as a distinct check (only checks price≥200MA), and **omits the RS≥70 criterion entirely**. It also invents a "5개 이상이면 Stage 2 조건 충족" (5-of-7 partial-pass) rule that has no basis in Minervini's actual template, which requires *all* criteria, not a majority | The same named methodology ("SEPA") is defined with a different criteria count (8 vs 7), different criteria (RS included vs. dropped), and a fabricated partial-pass threshold in two different places on the same product. A reader who studies the glossary and then reads the guide will see genuinely different rules under the same name. |
| I4 | 52-week-high proximity used for "Stage 2" | Glossary (`aio-glossary.js:90`) and guide (`index.html:12863`) both say **within 25%** of the 52-week high ("75% 이내" / "-25% 이내") | `js/aio-core.js:20547` — the actual `_calcVCP()` Stage-2 gate uses `pct52 >= -30`, i.e. **within 30%** of the 52-week high | The code is measurably looser (accepts stocks up to 5 percentage points further from their 52-week high) than what both educational surfaces tell the user the rule is. This is a direct instance of "the site's computation doesn't match its own explanation." |
| I5 | "Weinstein Stage Analysis" methodology | Glossary (`aio-glossary.js:89`): "30주 이동평균선 기울기+가격 위치로 4단계 판단" (single 30-week MA slope + price position) | Three different concrete implementations coexist: (a) `js/aio-ui.js:5143` `_detectStage()` — per-ticker, uses **daily SMA150** (≈30-week proxy, acknowledged in a code comment) + SMA50/20 + higher-lows/highs pattern; (b) `js/aio-macro-tech.js:1027` `updateWeinsteinStage()` — SPY-only, uses a **50/100/200-day SMA stack** model, and its own code comment (line 1039-1040, tag "P1253") explicitly notes it is "다른 판정" (a different verdict) from (a); (c) `_calcVCP()`'s internal Stage-2 flag (`js/aio-core.js:20547`) uses yet a third combination (SMA50/150/200 + 52wk-high -30%) | The team is already aware two of the three models disagree (see the P1253 comment), which is good practice, but the glossary's single "30주 이동평균선" description does not disclose that at least three numerically distinct models exist across the product, or which one a given page is showing. |
| I6 | "TPR" acronym in the Minervini "Triple Barrel" feature | `index.html:12855-12857` (guide): "TPR(Timing Price Range 최상단)" | `js/aio-data.js:8317-8318` — a topic/news-keyword list contains the line `'Minervini TPR', 'TPR','Trend Persistence Ratio'`, i.e. in the same Minervini-chart-analysis feature context (see adjoining comment "v51.09 ... Minervini 차트 분석"), TPR is associated with "Trend Persistence Ratio" | Same three-letter acronym, same named feature ("Minervini Triple Barrel" / "Minervini TPR"), two unrelated full names ("Timing Price Range" vs. "Trend Persistence Ratio") in two different files. [judgment: the aio-data.js list is a keyword-matching array rather than formal documentation, so this is weaker evidence than I1-I5, but the adjacency to "Minervini TPR" in the same commit block makes it a real terminology collision worth resolving.] |

## OVERCLAIM (heuristic/convention presented with more authority than warranted)

| # | File:Line | Text | Issue |
|---|---|---|---|
| OC1 | `js/aio-glossary.js:340` (registry) | "7/3 절단값은 원논문 표본 기준이며" | See E2 — states the popularized 7/3 cutoff is grounded in Piotroski's own paper's sample, when the paper's own extreme bins are 8-9/0-2. This is the registry mischaracterizing a convention as a primary-source-derived value, the exact failure mode the registry was built to prevent. |
| OC2 | `index.html:12552` (guide, SIGNAL page card) | "부분 백테스트(2016~2026)에서 선행수익률과 음(−)의 상관이 관측됨" | An internal, uncited backtest claim spanning through the current year (2026) with no linked methodology, sample, or source. Cannot be verified externally; flagged under "could not verify" below. If this claim is meant to justify "점수가 매매 신호가 아님," it undercuts its own credibility by citing an unsourced statistic to make that point. |
| OC3 | `index.html:12884` (guide, Qullamaggie "스캔 루틴") | "장마감 후 1M/3M/6M 상위 1~7% 스캔 → ADR 5%+ → 50종목 이내 압축" | Presented as a fixed operational recipe (specific percentile cutoffs and filter order) attributed to Qullamaggie's public methodology without a source citation or a hedge that these are the guide-author's paraphrase/interpretation rather than Qullamaggie's own stated numbers. Unlike the glossary (which routes almost every numeric claim through `GLOSSARY_FIGURE_SOURCES`), the guide's strategy section has no equivalent provenance mechanism, so numbers like "1~7%" and "50종목" read as authoritative when their origin is unclear. |

## JARGON (undefined terms that block beginner comprehension)

| # | File:Line | Term(s) | Issue |
|---|---|---|---|
| J1 | `index.html:12857` | RPR, ER, SR (in "RPR 80+·ER 80+·SR 80+는 추가 확인 항목") | None of these three acronyms are expanded anywhere in the guide, the glossary, or (as far as could be found) in the codebase's user-facing strings. `RPR` is expanded once, only in a keyword list (`js/aio-data.js:8318`, "Relative Price Ratio") that a beginner would never see. `ER` and `SR` have no expansion anywhere found. For a page whose stated audience includes beginners, dropping three unexplained acronyms with numeric thresholds ("80+") is a comprehension blocker. |
| J2 | `public-data/principles/lesson-library.json` lesson D6 (`mechanism` field, ~line 748) | "Kalman filter", "one-sided/two-sided smoothed", "data vintage", "LW·HLW류 모형", "term premium" | This lesson is tagged `"level": "기초·시장 원리"` (labeled as a *basic* lesson) but the mechanism paragraph uses graduate-econometrics vocabulary (Kalman filtering, one-sided vs. two-sided smoothed estimates, data vintages) with no glossary link or plain-language gloss. This is a mismatch between the stated difficulty level and the actual reading level. |
| J3 | `index.html:12819` (Qullamaggie breakout setup) | "Opening Range High(1m/5m/60m 봉 고점)" | Introduced without explanation of what "Opening Range" means or why three different candle timeframes (1-minute/5-minute/60-minute) would give different "highs" to check against — likely opaque to a non-intraday-trading reader. |

## Could not verify (flagged, not resolved)

- The internal SIGNAL-score backtest claim "부분 백테스트(2016~2026)에서 선행수익률과 음(−)의 상관이 관측됨" (`index.html:12552`) — no source, sample size, or methodology is exposed; cannot be checked against any external reference since it is proprietary/internal.
- FX reserve figures (한국 $4,200억, 중국 $3.2조) and debt/GDP figures (미국 120%, 일본 250%) in `js/aio-glossary.js:125,147` have no as-of date in the visible text, so "currently correct" cannot be assessed without knowing the intended reference period.
- `public-data/atlas/taxonomy-node-coverage.json`, `current-evidence-ledger.json`, and `player-product-currentness.json` (combined ~4,800 lines) were only partially sampled (structure-level, not content-level) — the task's 25%-of-entries sampling bar was not fully met for the atlas industry-map numeric claims (chip node names, HBM bandwidth specs, capacity/GW figures) due to time budget. This is the single largest remaining coverage gap in this audit and should be revisited in a follow-up pass focused specifically on atlas.js + these three JSON files.
- 33 of 34 `public-data/masters/managers/*.json` 13F holdings files were not opened (only `manager-principles.json` and `masters.js` were read in full); these are machine-generated filing tables rather than prose, so risk is judged lower, but this was not independently confirmed for every file.
- Exact statutory citation "증권거래세법 시행령 제5조" (article number) could not be independently verified against the actual 시행령 text within this session's tool access — only the rate itself and effective-date framing were checked via news coverage of the 기획재정부 announcement.

---

## Summary of what was already good (context for the errors above)

The glossary's `GLOSSARY_FIGURE_SOURCES` registry (js/aio-glossary.js:337-422) is a genuinely good pattern:
86 numeric/attributed claims are each tagged with a `kind` (정의/관례/방법론-예시/역사-관측/미검증-경험칙),
a `src`, and a `cond` describing the claim's limits. Most of the classic "beginner-book overclaims" one
would expect to find (RSI 70/30 as a "signal," VIX bands as universal, Fear&Greed thresholds as
predictive, head-and-shoulders "89% reliability," DCA-always-beats-lump-sum, etc.) have already been
converted to explicitly hedged, sourced statements. The errors and inconsistencies above are the
residue that survived that hardening pass — mostly places where a second/third code path or a
separate prose surface (guide page, AI-chat query parser, keyword list) was never reconciled against
the glossary's already-correct definition.
