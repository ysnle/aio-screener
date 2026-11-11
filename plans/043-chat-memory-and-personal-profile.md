# 043 — Chat: memory across conversations and a personal profile, kept on the reader's device

Priority P1 · Effort L · Risk MED · Label `v59.99`

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v59.99`**, pending
records go to `_artifacts/pending-records/plan-043/` with `"version": "v59.99"` and date `2026-11-12`.

## Why (owner request 2026-11-12)

"사용자의 질문과 과거 대화 내용들을 참고해서 유연하게 답변 … 각각의 사용자들에 특성과 성격에 맞는 개인화 AI 대화."

Facts at the base commit:
- Inside one conversation the model receives the earlier turns (`state.messages`, trimmed oldest-first above
  60,000 chars; js/aio-chat.js ~3844) and a memo of up to 3 related earlier Q/A pairs (~2996).
- Saved conversations exist per device with consent (`src/ai/session/chat-sessions.js`,
  `src/ui/components/chat-sessions.js`); reopening one restores its turns. A **new** conversation knows nothing of
  earlier ones.
- The prompt has no notion of who is asking: no level, no preferred depth, no interests, no holdings outside the
  portfolio screen.

Product constraints (AGENTS.md, fixed): about five family users, no sign-up, no server-side user data, the site and
repository are public. So everything here is **device-local** (localStorage, like saved conversations), shown to the
reader, editable and deletable, and covered by the existing conversation-saving consent (no new consent dialog;
declining or revoking consent removes it all — extend `setConsent(false)`).

Three parts, in order, one commit each. New modules load with the chat (`src/app/chat-globals.js`), never at boot:
`node scripts/ci-boot-bundle-budget-check.mjs` must report `"failures": []` after each part.

## Part A — a profile the reader sets (tests first)

1. New pure module `src/ai/session/reader-profile.js`: `loadProfile(storage)`, `saveProfile(storage, profile)`,
   `profilePromptBlock(profile)`. Fields, all optional, every value from a closed list (no free text in this part):
   - `level`: `beginner | intermediate | expert`
   - `depth`: `short | standard | deep`
   - `tone`: `plain | technical`
   - `horizon`: `short-term | swing | long-term`
   - `interests`: up to 6 of the app's own theme/sector ids (take the list from the existing theme registry — find it
     with `git grep -n "themeId\|THEME_REGISTRY" -- src/domain | head`; do not invent ids)
   `saveProfile` returns false without consent or on a storage failure. An unknown value is dropped, not stored.
2. `profilePromptBlock` returns one short Korean block (≤ 400 chars) or `''` for an empty profile, e.g.
   `【이 사용자】 수준: 입문 · 답변 깊이: 깊게 · 말투: 쉬운 말 · 투자 기간: 장기 · 관심: 반도체, 헬스케어` followed by one
   line of how to use it: adapt vocabulary, depth and examples to it; it never changes facts, never relaxes the
   evidence rules and never turns into a personal trade instruction.
3. UI: one compact control in the AI panel where the saved-conversation list lives
   (`src/ui/components/chat-sessions.js`): a "나에게 맞추기" fold with five rows of chips/selects, saved on change, with
   a "지우기" action. Follow the panel's existing classes and the design tokens gate
   (`ls scripts | grep "design-token\|inline-style"`); no emoji; phone width must not overflow (the panel is already
   responsive — reuse its layout classes). Without consent the fold shows the existing consent question instead.
4. Inject the block in `chatSendUnified` (js/aio-chat.js) as one `sysPrompt +=` placed with the other reader-context
   blocks, before the evidence contract tail. It must be inside the head that `_cutSystem` may shorten, never in the
   tail.
5. Tests (`v59.99`): the module (closed lists, cap, consent, revoke clears) in
   `scripts/ci-ai-intelligence-contract-check.mjs`; the prompt contains the block exactly once when a profile exists
   and not at all when empty (behavioural, via the builder used by the existing prompt tests); a fake-DOM render of
   the fold (five rows, save on change, clear).

## Part B — what earlier conversations said about the same subject (tests first)

1. New pure function in `src/ai/session/chat-sessions.js`: `relatedEarlierTurns(storage, { question, entities,
   excludeSessionId, now, limit = 3 })` → up to 3 earlier turns from **other** saved conversations that share a
   resolved entity (ticker) or theme id with the new question, newest first, each cut to the question (≤ 160 chars),
   the first 500 chars of the stored answer and its date. Matching is by the entity/theme ids the chat already
   resolves for the question (find where `detectedTickers` and the theme match are computed in `chatSendUnified`);
   no fuzzy text search, no AI call. A turn older than 90 days is skipped.
2. Inject as one block `【이전 대화에서】` with the date on each item and one instruction line: these are the reader's
   earlier questions and the answers given then; numbers in them are as of that date and must not be repeated as
   current — use them for continuity ("지난번 … 이후") and to avoid re-explaining what was already covered.
3. Tests (`v59.99`): two saved sessions, a new question about one ticker → the matching turn is returned with its
   date, the other is not; nothing is returned without consent; a 91-day-old turn is skipped; the block appears once
   in the prompt. Add one case to `scripts/fixtures/pipeline-semantics/ai.mjs` if that harness builds the prompt.
4. The evidence filters must still treat a number copied from that block as unbound: add a test that a sentence
   repeating a figure from an earlier answer is removed on a current-sensitive question (it is not evidence). If the
   publication code would treat the block as evidence, STOP and report.

## Part C — things the reader told the assistant are remembered (tests first)

1. The answer plan contract (`src/ai/response/request-pipeline.js` ~485–491, the `[AI_ANSWER_PLAN]` JSON) gains one
   optional field `remember`: an array of at most 2 short Korean notes (≤ 60 chars each) and only when the reader
   **stated something about themselves in this conversation** that would help later answers: what they hold or
   watch, their horizon or goal, what they asked to be explained differently. The contract text says: never infer,
   never record a health/financial-distress/identity detail, no account numbers or amounts of money, omit the field
   when there is nothing. If plan 042 has already reworded this block, keep its wording and add only this field.
2. Parse it in `src/ai/response/claim-ledger.js` `parseAnswerPlanText` (tolerate absence; drop notes over the caps,
   notes containing digits followed by 원/달러/USD/KRW/만/억, and anything not a string).
3. Store: `src/ai/session/reader-notes.js` — `loadNotes`, `addNotes` (dedupe by normalised text, keep the newest 20),
   `removeNote`, `clearNotes`, `notesPromptBlock` (≤ 600 chars, `【사용자가 알려준 것】`, each with its date). Consent
   rules as in Part A.
4. UI: under the Part A fold, a list "기억하고 있는 것" with a delete button per note and "모두 지우기"; when a new
   note is saved, the panel's status line says so once (`role="status"`), so nothing is remembered silently.
5. Inject `notesPromptBlock` beside the profile block. The same safety line applies: notes shape emphasis and
   examples; they never become a trade instruction ("보유 중이니 매도하세요" stays banned — add an action-gate test
   that an answer saying so is still replaced).
6. Tests (`v59.99`): parser caps and the money filter; store cap/dedupe/consent/revoke; the panel list (fake DOM);
   prompt contains the notes block once; a plan with `remember` is rendered without showing the field in the answer.

STOP for Part C: the answer-plan parser or a gate treats unknown fields as a format failure that hides the answer —
report the path; do not loosen the parser beyond accepting this one field.

## Finish

`node --check` on every touched file; boot budget `"failures": []`; the design-token, inline-style, text-pin,
instruction-text and regex ratchets pass (counts may only go down, or state the reason a count went up and stop);
`node scripts/qa-runner.mjs contracts --keep-going` (expected failures only: generated-state, knowledge-lint and
refresh-origin-live-data for that cause, browser-data-pin-drift, publish-data-commit, syntax /
narrative-lifecycle-model timeouts — re-run alone); run the chat browser gates once
(`node scripts/ci-chat-ui-state-browser-check.mjs`; find others with `ls scripts | grep "chat.*browser"`); three
pending records (features, change-only); `apply-pending-records --dry-run` exits 0; everything committed.
Report what a prompt looks like with a profile, one related earlier turn and two notes (paste those three blocks).
