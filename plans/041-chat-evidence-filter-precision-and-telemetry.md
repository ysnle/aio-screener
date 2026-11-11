# 041 — Chat: the evidence filter stops deleting general knowledge; what it deletes is counted

Priority P1 · Effort M · Risk MED · Label `v59.99`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v59.99`**, pending
records go to `_artifacts/pending-records/plan-041/` with `"version": "v59.99"` and date `2026-11-12`.

## Why

Owner's concern (2026-11-11): the pipeline around the model may be lowering answer quality. An audit ran the
post-filters on sample sentences. On any question the taxonomy marks `currentSensitive` (outlook, company metric,
"지금/오늘/최근" — `src/ai/**/taxonomy.js` ~112–118) the sentence strippers in `src/ai/response/publication.js`
(`hasCurrentNumericContent`, the "current event" rule ~145–158, `clean()` ~103–118 and ~275–282) delete:

- "S&P 500은 11개 섹터로 구성됩니다." (count pattern)
- "2008년 금융위기 때 S&P 500은 약 57% 하락했습니다." (historical fact with its year)
- "애플은 2023년에 시가총액 3조 달러를 처음 돌파했습니다."
- "비트코인 … 최대 2,100만 개로 제한됩니다."
- "엔비디아는 데이터센터 매출이 전체의 80%를 넘는 구조입니다."
- "금값은 지난 10년간 약 100% 올랐습니다."

and keep only conditional or "보통/역사적으로" sentences. The protection that must stay (AGENTS.md: no invented
numbers, dates on every current figure) is: **a number presented as a current observation must be bound to injected
evidence or a search citation.** Deleting dated history, definitions and fixed counts is outside that protection and
removes exactly the reasoning a reader asked for. Nothing records how often this happens.

## Part A — a sentence about the past or a fixed fact is not a current observation (tests first)

1. Read `publication.js` end to end and write down, in your report, the exact decision order for one sentence on a
   `currentSensitive` answer (which function, which regex, what exempts it).
2. Add one pure, exported classifier next to `hasCurrentNumericContent` — e.g. `numericClaimKind(sentence, { today })`
   returning `'current' | 'dated-past' | 'fixed-fact' | 'conditional' | 'none'` — and make the strippers remove only
   `'current'`. Rules, in this order:
   - **dated-past**: the sentence names a calendar year at least one year before `today`'s year ("2008년", "2023년에",
     "2020년 3월") or a completed historical period ("금융위기 때", "닷컴 버블 당시", "지난 10년간", "1970년대") **and**
     has no current marker (`현재|지금|오늘|최근|이번 주|이번 달|올해|금일|현 시점` or a date within the last 60 days of
     `today`). A sentence with both a past year and a current marker is `'current'` (e.g. "2023년 고점 대비 현재 12%
     낮습니다").
   - **fixed-fact**: a definition or structural count with no market level, price, return, rate, multiple or
     currency amount in it: counts of categories or units ("11개 섹터", "30개 종목", "연 8회", "2,100만 개로 제한")
     where the sentence's verb is definitional (`구성|이루어|나뉘|제한|정해|열립니다|엽니다|발표됩니다|뜻합니다|의미합니다|
     이다|입니다` at the end and no observation verb such as `올랐|내렸|하락했|상승했|마감|기록했|거래`). Keep the list of
     units and verbs small and named; do not try to be general.
   - **conditional**: today's exemption, unchanged.
   - everything else with numeric content: `'current'` — unchanged behaviour. In particular these stay removed when
     unbound: "엔비디아는 데이터센터 매출이 전체의 80%를 넘는 구조입니다." (a company metric with no date),
     "코스피는 2,650에서 마감했습니다.", "PER은 28배입니다.", "금리는 4.5%입니다.", "삼성전자는 반도체 업황 둔화로
     하락했습니다." (current event rule).
3. The "current event" rule gets the same two exemptions (a dated-past sentence is history, not an unbound current
   event).
4. Tests in `scripts/ci-ai-intelligence-contract-check.mjs` (label `v59.99`), driving the exported functions and one
   end-to-end `buildPublishableAnswerPlan`/`clean` case on a `currentSensitive` plan:
   - kept: the five dated-past/fixed-fact sentences above (all except the NVDA 80% one), plus "1987년 블랙 먼데이에
     다우는 하루 22.6% 하락했습니다.", "FOMC는 연 8회 열립니다.";
   - removed (unbound): the NVDA 80% sentence, "코스피는 2,650에서 마감했습니다.", "2023년 고점 대비 현재 12%
     낮습니다.", "작년 매출은 600억 달러였습니다." (no explicit year → current), "올해 2026년 들어 15% 올랐습니다.";
   - a bound current number is kept exactly as today (existing tests must stay green; do not edit their expectations).
   Show the kept cases fail on the old source (copy the file aside; never `git stash`).
5. Run the regex/term ratchets (`ls scripts | grep ratchet`) and `node scripts/ci-pipeline-semantics-check.mjs`.

STOP: a rule in `_context/RULES.md` (search `git grep -n "hasCurrentNumericContent\|numeric evidence\|현재 수치" --
_context/RULES.md | head`) states that *every* number in a current-sensitive answer must be evidence-bound, including
history — quote it and stop Part A (the reviewer decides); continue with Part B.

## Part B — what the filters removed is counted and shown (tests first)

1. Find where one answer's publication result is assembled (`src/ai/response/request-pipeline.js` ~271–425: dropped
   claims, removed sentences, directive replacements, truncation, effort/model key). Today these live only in memory
   (`window._aioAiPipelineAudit`, `window._aioAISLOSamples`).
2. Add one small store module under `src/ai/` (e.g. `src/ai/telemetry/answer-quality-log.js`): pure functions
   `recordAnswerQuality(storage, entry)` and `summariseAnswerQuality(storage, { days = 14 })` over a localStorage key
   holding at most 300 entries (newest kept), each entry **without any question or answer text**: `{ at, mode,
   effort, searched, outputTokens, truncated, removedNumericSentences, removedEventSentences, droppedClaims,
   directiveReplacements, sentencesTotal }`. Storage failures are swallowed (return false).
3. Call `recordAnswerQuality` once per finished answer from the pipeline with the counts it already has (add counters
   where a stripper only returns text: return `{ text, removed }` from the internal helper rather than recounting).
4. Surface it where AI usage is already shown to the operator (find the existing usage/connection panel:
   `git grep -n "aio_api_usage_v1" -- src js | head`): one line, e.g. `최근 14일 답변 42건 · 삭제된 문장 31개(답변당
   0.7) · 잘린 답변 2건`. No new panel, no chart. If no such operator surface exists, expose
   `AIO.answerQualitySummary()` only and say so.
5. Tests (`v59.99`) for the store (cap, no text fields accepted — an entry with `question`/`answer` keys is refused,
   summary math) in `scripts/ci-ai-intelligence-contract-check.mjs`, and one pipeline-level case in
   `scripts/fixtures/pipeline-semantics/ai.mjs` proving a finished answer with two removed sentences records `2`.
6. `node scripts/ci-boot-bundle-budget-check.mjs` must still report `"failures": []`: the store loads with the chat
   (`src/app/chat-globals.js`), not at boot. If it lands in the boot set, move the import.

## Finish

`node --check` on every touched file; gates named above exit 0; `node scripts/qa-runner.mjs contracts --keep-going`
(expected failures only: generated-state, knowledge-lint/refresh-origin-live-data for the same cause,
browser-data-pin-drift, publish-data-commit, and syntax / narrative-lifecycle-model timeouts — re-run those alone);
two pending records (A defect, B change-only); `apply-pending-records --dry-run` exits 0; everything committed.
Report the Part A decision order you wrote down and the before/after verdict for each test sentence.
