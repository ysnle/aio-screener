# 044 — The AI may judge and weigh scenarios; only a trade order is banned; a number is checked, not deleted

Priority P1 · Effort L · Risk MED–HIGH (protections are being narrowed on purpose) · Label `v59.99`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v59.99`**, pending
records go to `_artifacts/pending-records/plan-044/` with `"version": "v59.99"` and date `2026-11-12`.

## Owner decision (2026-11-12, verbatim sense)

"AI에게 어느 정도의 자율성은 부여해줘야 돼. … 매매 지시 금지만 … '지금은 현금 보유가 우위인 상황' / '주식 매수
부담인 구간' 이렇게 확률적 사고와 가능성/시나리오를 기반으로 한 설명과 판단들은 사용자에게 얘기해도 된다. … 특정
주식이 180달러인 상황에서 '천천히 분할 매수 하기 좋은 구간/상황' 이렇게 답변" 할 수 있어야 한다.

The rule from now on:
- **Banned:** an order addressed to the reader — an imperative or a recommendation to act ("매수하세요", "지금
  사세요", "비중을 줄이십시오", "매도를 추천드립니다", "손절은 178달러에서 하세요", "30%를 NVDA에 배분하세요"), in
  Korean or English, with or without a price. This protection keeps its notice text and its tests.
- **Allowed:** an assessment of the situation and of what the evidence favours — "현금 보유가 우위인 상황", "매수가
  부담스러운 구간", "분할 매수하기 좋은 구간", "매수 기회로 보입니다", "비중 확대를 고려할 만한 구간", "관망이
  낫습니다", a scenario with its conditions, and likelihood in words ("가능성이 더 높아 보입니다") **when the sentence
  or the one before it gives its ground** (a condition, a price direction, a record with its count).
- **Still banned (reviewer's position, owner informed):** a probability as a number the model made up ("상승 확률
  60%", "70% 가능성") without a calibration source. A frequency with its count ("과거 73건 중 41건") is evidence and
  is allowed.
- **Numbers:** a current figure in an answer must exist in what the model was given (injected evidence, search
  citations). A sentence is removed only when it carries a current figure that is **not** in that material — not
  merely because it contains a figure.

Three parts, in order, one commit each, failing tests first.

## Part A — chat: a current number that is in the evidence stays in the sentence

Today (`src/ai/response/publication.js`, `buildPublishableAnswerPlan` → `clean()` → the sentence stripper): on a
`currentSensitive` answer every summary/section sentence whose `numericClaimKind` is `'current'` is deleted, whether
or not its number is the injected one. So "NVDA는 180달러로, 분할 매수하기 좋은 구간입니다" loses the judgement with
the number.

1. Read how evidence reaches `buildPublishableAnswerPlan` (its second argument and `opts`) and how a claim is bound
   to an evidence row (value, unit, time, entity). Write down in your report the fields an evidence row carries and
   which rows exist for a single-stock question (price, change, PER, the trend block …) — use the fixtures the
   intelligence gate already builds.
2. Build once per answer a set of **supported numbers** from the evidence rows (and from search citation snippets if
   they are passed in — if they are not available to this function, say so and use evidence rows only): each
   numeric value in its printed forms (e.g. 180, 180.0, 180.25 → "180.25", "180.3", "180"; percentages with one and
   two decimals; thousands separators; 조/억/만 forms only if the row already prints them). Keep it a small pure
   helper with its own tests; do not match a bare one- or two-digit integer against the whole set (a "5" is
   supported by everything) — integers under 100 must match a row whose unit agrees with the unit written in the
   sentence (%, 배, 달러, 원, bp, 포인트).
3. In the sentence stripper, a `'current'` sentence is kept when **every** current figure in it is supported; it is
   removed when at least one is not. Table cells: the same rule per cell instead of "확인 필요" for a supported
   figure.
4. Keep the claims path as it is (typed claims with evidence ids stay the strongest binding).
5. Tests (`v59.99`, `scripts/ci-ai-intelligence-contract-check.mjs`), on a `currentSensitive` plan with an evidence
   row price 180.25 USD and change −1.2%:
   - kept: "NVDA는 180.25달러로, 천천히 분할 매수하기 좋은 구간입니다.", "오늘 −1.2% 내렸지만 추세는 유지됩니다.";
   - removed: "NVDA는 195달러까지 오를 여지가 있습니다." (195 unsupported), "PER은 28배입니다." (no row),
     "180.25달러에서 172달러로 내려오면 …" is conditional → today's rule applies (kept);
   - a sentence mixing a supported and an unsupported figure is removed;
   - with no evidence rows at all behaviour is exactly today's (existing tests untouched).
   Show the kept cases fail on the old source.
6. Then change the prompt contract so the model is no longer told to keep current numbers out of prose: in the
   answer-plan contract (`src/ai/response/request-pipeline.js` ~485–491; plans 042/043 may have reworded it — keep
   their wording and change only this instruction) say: figures from the injected data and search results may be
   written in the sentences where they belong, with their date or basis; a figure that is not in that material must
   not be written. `claims` stays for the key figures.

STOP: evidence rows are not passed to the stripper on some path (e.g. the fallback path for an answer without a
plan block) and passing them needs a change outside `publication.js`/the pipeline's result assembly — implement the
plan path, leave the fallback path as today and report it.

## Part B — chat: the action gate bans orders, not assessments

`_aioApplyAIActionGate` (`src/ai/response/request-pipeline.js` ~558–650) has pattern families: recommend,
imperative, colloquial, weight, sizedWeight, allocation, nominalised, colloquialHold, positionImperative, englishSoft,
english, pricedImperative, tickerAction and **opportunity**
(`(매수|매도|진입|매집|저가 매수|추가 매수) (기회|적기|타이밍) (로|으로|입니다|…)`).

1. Remove the `opportunity` family from the replaced patterns: "매수 기회로 보입니다", "저가 매수 타이밍으로 읽힙니다"
   are assessments. Keep it replaced only when it is itself inside an imperative/recommendation the other families
   already catch.
2. `nominalised` ("매수하는 게 좋습니다 / 맞습니다 / 낫습니다"): keep as replaced **only** when it addresses the
   reader's action without a condition — i.e. keep today's behaviour for "지금 매수하는 게 좋습니다"; allow it when
   the clause is an assessment of a zone or situation ("분할 매수하기 좋은 구간입니다", "매수하기 부담스러운
   구간입니다", "…하기 유리한 상황입니다": the head noun is 구간/상황/국면/환경/시점). Add that as an explicit
   exemption with a named regex, not by loosening the verb list.
3. Everything else stays: all imperative/recommend/weight/priced/allocation/position families, English directives,
   the negation and quotation handling.
4. Tests (`v59.99`): kept — "지금은 현금 보유가 우위인 상황입니다.", "현재는 주식 매수가 부담스러운 구간입니다.",
   "NVDA는 천천히 분할 매수하기 좋은 구간입니다.", "매수 기회로 보입니다.", "비중 확대를 고려할 만한 구간입니다.",
   "지금은 관망이 낫습니다.", "이 시나리오라면 비중을 줄이는 쪽이 유리합니다."; replaced — "NVDA를 지금
   매수하세요.", "지금 사세요.", "비중을 30%로 늘리세요.", "매도를 추천드립니다.", "손절은 178달러에서 하세요.",
   "지금 매수하는 게 좋습니다.", "Consider buying NVDA now.", and every sentence the existing v59.95/v59.97 tests
   already require replaced (do not edit those expectations — if one of them is an "opportunity" sentence that this
   plan now allows, list it and change that single expectation, quoting it in your report).
5. Update the policy text the model reads (same file ~465–491, and `answerModeGuide('decision')` in
   `src/ai/response/answer-modes.js` if it still says only "명령 대신 … 지지하는지"): state the rule from the top of
   this plan in two or three sentences — judge the situation and say which side the evidence favours and why,
   scenarios with conditions, likelihood in words with its ground; never an order to the reader; never a made-up
   percentage probability.
6. The numeric-probability rule (~502) stays.

## Part C — automated market reading: judgement and likelihood in words are allowed with their ground

`scripts/lib/market-analysis-validate.mjs` `validateAnalysisAdmission`: `likelihood-qualitative` blocks any
"가능성/확률 … 높/낮/크/작" unless the sentence carries a condition count n/m; `probability-claim` blocks numeric
probabilities; `trade-instruction` blocks orders. `scripts/lib/market-analysis-prompt.mjs` tells the model the same.

1. `likelihood-qualitative` passes when the sentence, or the sentence immediately before it, gives a ground: a
   condition count (n/m), a record with its count ("과거 73건", "표본 N"), a named price direction or axis state from
   the packet (추세/시장 폭/신용/변동성/금리 + state word, or a signed change with %/bp), or an explicit conditional
   ("…하면", "…라면"). It is still blocked when the likelihood stands alone ("반등 가능성이 높습니다." with nothing
   before it). `probability-claim` and `trade-instruction` are unchanged.
2. Add a stance vocabulary the reading may use and the validator must not block: "우위", "부담스러운 구간",
   "유리한 구간/국면", "비용이 작다/크다" — check each against every existing rule (`ANALYSIS_TRADE_INSTRUCTION`,
   the reader-duty softener, axis claims) with a test sentence; fix any rule that blocks one of them and say which.
3. Prompt (`market-analysis-prompt.mjs`): where it forbids likelihood words or asks only for condition counts,
   reword to: after the observed moves and the scenario conditions, **say which side the evidence favours and why**
   in one or two sentences (e.g. 현금·방어 우위 / 분할 접근 우위 / 판단 보류), with its ground and what would change
   it; likelihood in words needs its ground in the same or previous sentence; no percentage probability; no order
   to the reader. Keep every data rule (dates, bp for rate changes, evidence ids, 장중 time labels).
4. Tests (`v59.99`, `scripts/ci-scenario-guidance-fixture.mjs` next to the existing v59.99 block): passes —
   "조건 충족 3/4이고 시장 폭도 양호해 반등 가능성이 더 높아 보입니다.", "과거 73건 중 41건에서 20거래일 뒤 올랐습니다.
   이번에도 반등 가능성이 더 큽니다.", "신용이 안정적인 동안은 분할 접근이 우위입니다."; blocked — "반등 가능성이
   높습니다." alone, "상승 확률은 60%입니다.", "지금 매수하세요.".
5. Run `node scripts/ci-data-pipeline-contract-check.mjs`, `node scripts/ci-pipeline-semantics-check.mjs`,
   `node scripts/ci-crash-replay-check.mjs` and the prompt-size gate if one exists
   (`git grep -ln "marketAnalysisPromptSections" -- scripts`).

STOP: a gate replays stored production readings and one of them now fails or changes — report which and why.

## Finish

`node --check` on every touched file; boot budget `"failures": []`; ratchets pass (regex-term, instruction-text,
text-pin: a count may go up only for the new named regexes in Parts A–C — say by how much; if a ratchet refuses,
run nothing with `--write`, report the numbers); `node scripts/qa-runner.mjs contracts --keep-going` (expected
failures only as in the other plans); three pending records (A defect, B and C change-only with the owner decision
quoted); `apply-pending-records --dry-run` exits 0; everything committed. Report every protection test that still
passes unchanged, by name.
