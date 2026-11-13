# 047 — Chat: a figure is supported for the subject it was given for

Priority P2 · Effort M · Risk MED · Label `v60.02`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v60.02`**, pending
records go to `_artifacts/pending-records/plan-047/` with `"version": "v60.02"` and date `2026-11-13`.

## Why

Since v60.01 a current figure in a chat answer stays when it appears in the material the model was given
(`src/ai/response/publication.js`: `answerReferenceText`, `supportedNumbersFromText`, `supportedNumbers`,
`figuresSupported`). The check is flat: every figure in the reference text supports every sentence. In a two-stock
question the prompt holds "NVDA … PER 28.4배" and "AMD … PER 41.2배"; an answer saying "AMD의 PER은 28.4배입니다"
passes although the figure belongs to NVDA. The protection the owner kept ("no invented numbers") should also catch
a real number attached to the wrong subject.

## Design (decided)

1. `supportedNumbersFromText(text, { entities })` tags each figure with the subject it was given for:
   - `entities` is a list of `{ id, names: [...] }` for the companies/indices the question is about (ticker and its
     registry names). Matching is by whole word for ASCII (`NVDA`, `Nvidia`) and by substring for Hangul names
     (엔비디아), longest name first.
   - Split the reference text into blocks at blank lines. A block that names **exactly one** entity gives all its
     figures to that entity. Otherwise go by line: a line naming exactly one entity gives its figures to it; a line
     naming none or several is **neutral** (its figures support any subject — macro lines, tables with several
     tickers on a row, generic data).
   - Result rows: `{ value, unit, signed, entity: id | null }`.
2. `figuresSupported(text, numbers, { entities })`: find the entities the **sentence** names (same matcher). If the
   sentence names exactly one entity, a figure is supported only by a row whose `entity` is that id or `null`. If
   the sentence names none or several, any row supports it (as today) — a comparison sentence ("NVDA 28.4배, AMD
   41.2배") is checked figure by figure only when each figure sits in its own clause with one entity: split the
   sentence at commas/；/"반면"/"이고"/"이며"/"but"/"while" and apply the single-entity rule per clause that names
   exactly one entity. Typed evidence rows (`supportedNumbersFromEvidence`) get `entity` from the row's
   ticker/entity field when it has one, else `null`.
3. Without `entities` (callers that do not pass them) behaviour is exactly v60.01.
4. Wiring: `buildPublishableAnswerPlan` and the fallback path take `entities` in their options next to
   `referenceText`; `src/ai/response/request-pipeline.js` passes `meta.entities`; `js/aio-chat.js` passes the
   tickers it resolved for the question with their registry names — add **only** the property to the two
   `_aioRunAIResponsePipeline(fullText, { referenceText: _uniReferenceText, …` call sites and one line that builds
   the list beside `_uniReferenceText` (another executor edits `callSharedAi` and the prompt assembly in the same
   file: keep your change to those three places). Build the names from `AIO_TICKER_NAME_REGISTRY` through an
   existing helper if one returns names for a symbol (search `git grep -n "entries\[.*\]\.kr\|registryNames" -- src
   js | head`); do not add a new global.

## Steps (tests first)

A. Unit tests in `scripts/ci-ai-intelligence-contract-check.mjs` (`v60.02`) on the pure functions, with reference
   text holding an NVDA block (가격 180.25달러, PER 28.4배, 1개월 -6.2%), an AMD block (가격 142.10달러, PER 41.2배)
   and a neutral macro line (미국 10년물 4.95%):
   - kept: "NVDA의 PER은 28.4배입니다.", "엔비디아는 180.25달러입니다.", "AMD의 PER은 41.2배입니다.", "10년물은
     4.95%입니다.", "NVDA 28.4배, AMD 41.2배로 차이가 큽니다.", "PER은 28.4배입니다." (no subject named);
   - removed: "AMD의 PER은 28.4배입니다.", "엔비디아는 142.10달러입니다.", "NVDA는 28.4배이고 AMD는 28.4배입니다."
     (second clause wrong → the sentence is removed);
   - no `entities` passed → the three removed sentences are kept (v60.01 behaviour).
   Show the removed cases are kept on the old source.
B. End-to-end through `buildPublishableAnswerPlan` and the fallback path, and one pipeline-semantics case
   (`scripts/fixtures/pipeline-semantics/ai.mjs`) proving `meta.entities` reaches publication.
C. The wiring in request-pipeline.js and the three places in js/aio-chat.js; extend
   `scripts/fixtures/chat-prompt-assembly.mjs` only if a test needs it.

## STOP conditions

- The injected blocks name a company only in a header far above its figures separated by blank lines (so most
  figures become neutral and the rule never fires on real prompts): measure on the four fixture prompts of
  `chat-prompt-assembly.mjs` plus a two-ticker fixture how many figures get an entity; if under half of a ticker
  block's figures are tagged, report the block shapes and propose the rule that fits them instead of shipping a
  rule that does nothing.
- A regex or shared-primitive ratchet refuses the matcher: bound it, do not `--write`.

## Finish

`node --check`; `ci-ai-intelligence-contract-check`, `ci-pipeline-semantics-check`,
`ci-ai-chat-reliability-contract-check`, boot budget `"failures": []`, ratchets; `qa-runner contracts --keep-going`
(expected failures only as in other plans); one pending record (defect with `p`); `apply-pending-records --dry-run`
exits 0; committed. Report the tagging measurement from the STOP check even when it passes.
