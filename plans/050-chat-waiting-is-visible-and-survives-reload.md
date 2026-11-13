# 050 — Chat: the reader sees what a long answer is doing, and a reload does not lose the question

Priority P1 · Effort M · Risk MED · Label `v60.02`
Depends on plan 045 (tool loop in `callSharedAi`) being merged — your brief names the base.

Read `plans/_executor-rules.md` in the main checkout first (C:\Projects\AIO\plans\_executor-rules.md). It applies in
full with these overrides: use the base commit your brief names, new assertion labels cite **`v60.02`**, pending
records go to `_artifacts/pending-records/plan-050/` with `"version": "v60.02"` and date `2026-11-13`.

## Why (owner 2026-11-13)

"웹 검색, 도구 호출, 데이터 분석 … 시간이 좀 걸릴 수 있잖아? … 사용자에게 안내를 하고 있어? 렉이나 오류 걸린거라
생각해서 나가거나 새로고침하면 초기화 되는 거 아니야?"

Facts at the base:
- While an answer is produced the panel shows one static bubble: `분석 중...` (js/aio-chat.js ~3847), then
  `AI 답변을 구성하고 근거를 검증하는 중…` (src/ai/response/request-pipeline.js ~308). The text is not shown as it
  streams, because the answer is one `[AI_ANSWER_PLAN]` JSON block that must pass the evidence and action filters
  before anything is published. With medium reasoning, search and (after 045) up to two tool rounds, that bubble
  can stand unchanged for 30–120 s. No elapsed time, no stage, no hint that this is normal.
- Nothing is kept while a run is in flight: a turn is saved only when it finishes (`saveChatEntry`, with consent).
  A reload or closing the panel's page during the wait loses the question and the answer; there is no
  `beforeunload` notice.

The filters stay as they are — unfiltered streamed text is not shown. What changes is what the reader is told and
what survives.

## Part A — a live status line (tests first)

1. One owner for the pending state: a small module `src/ai/session/run-progress.js` (pure) — `createRunProgress({
   now })` with `stage(name, detail)`, `chars(n)`, `snapshot(now)` → `{ stage, label, elapsedSec, slow }`.
   Stages and Korean labels (plain, no jargon, no emoji):
   - `preparing` — `질문에 맞는 자료를 고르는 중`
   - `searching` — `웹에서 찾는 중`
   - `tools` — `자료를 더 찾는 중: <labels>` (from plan 045's tool labels)
   - `thinking` — `생각하는 중` (reasoning effort low/medium before the first text delta)
   - `writing` — `답변을 쓰는 중 (N자)` (count of streamed characters, updated at most twice a second)
   - `checking` — `숫자와 근거를 확인하는 중`
   `label` appends the elapsed time after 5 s: `… · 12초`. `slow` turns true at 25 s; then the line adds once:
   `자료 조회와 검색이 있으면 1~2분 걸릴 수 있습니다. 진행 중입니다.`
2. Drive it from the real events: `chatSendUnified` (preparing), `callSharedAi` (first request sent → thinking or
   searching when a `web_search_call` item/event appears; tool round → tools; `response.output_text.delta` →
   writing with the running length; stream end → checking), the response pipeline (publish → done). Read the
   stream events the code already parses; do not invent event names — if the search-in-progress event is not
   visible in the parser or fixtures, show `searching` only when search is `tool_choice: 'required'` and say so.
3. Render: the existing loading bubble becomes the status line (`role="status"`, `aria-live="polite"`, updated in
   place — one DOM node, text only; a 1 s timer only while a run is in flight, cleared on done/cancel/error). The
   stop control stays reachable. Reuse the panel's existing classes; no new colours; phone width must not overflow.
4. When the stream stalls, say so before it fails: at 60 % of the chunk timeout without any event the line reads
   `응답이 늦어지고 있습니다. 조금 더 기다립니다.`; the timeout itself keeps its existing retry/fallback path.
5. Tests (`v60.02`): the pure module (labels, elapsed, slow, throttle) in `ci-ai-intelligence-contract-check`; a
   scripted-stream case in `ci-ai-chat-reliability-contract-check` asserting the sequence of stages for (a) a plain
   answer, (b) a searched answer, (c) a tool round; one case in `ci-chat-ui-state-browser-check.mjs`: the status
   node exists once, updates in place, and is gone after the answer; cancel clears the timer (no update after
   cancel).

## Part B — a reload or a closed tab does not lose the question (tests first)

1. Pending turn: when a question is sent, store `{ sessionId, ctx, question, startedAt }` under one key
   (`aio_chat_pending_v1`) through a pure helper in `src/ai/session/chat-sessions.js` (or a small sibling module if
   the boot budget needs it — these modules are in the boot set; check `ci-boot-bundle-budget-check` and move the
   new code to a chat-loaded module if it does not fit). It is cleared when the turn finishes, fails for good, or
   is cancelled by the reader. This uses sessionStorage (it must survive a reload of this tab, not other devices
   or days) and needs no consent: it is the reader's own unsent work in this tab, kept at most 15 minutes.
2. On panel load: if a pending turn exists and is younger than 15 minutes, show one card above the input —
   `답변을 받기 전에 화면이 새로 열렸습니다. 방금 질문: "<question, 80 chars>"` with two buttons `다시 묻기` and
   `지우기`. `다시 묻기` sends the question again in the same conversation (the earlier turns are restored by the
   existing saved-conversation path when the reader consented; without consent it starts with that question
   alone). Never resend automatically.
3. Leaving while a run is in flight: register `beforeunload` only between send and done (remove it on
   done/cancel/error) so the browser asks before closing or reloading. Route changes inside the app do not cancel
   a run today? — read `_aioCancelChatRequest` callers: if switching screens cancels the run (`route-changed`),
   keep the run alive when the AI panel is a shell-level panel that stays mounted; if it is cancelled by design
   (the answer is about the screen), make the status say so and keep the pending card. Report what you found and
   which you did.
4. A finished answer that arrives while the tab is hidden: confirm it is rendered and saved as usual
   (visibilitychange must not cancel); add a test if a seam exists.
5. Tests (`v60.02`): helper unit tests (store, expiry at 15 min with an injected clock, clear on finish); fake-DOM
   or browser test of the card and its two buttons; `beforeunload` is registered during a run and removed after.

## STOP conditions

- The boot budget fails and the code cannot move to a chat-loaded module — report bytes; do not edit
  `architecture/boot-budget.json`.
- Showing stages needs the unfiltered answer text in the DOM — it must not; only its length is used.

## Finish

`node --check`; `ci-ai-intelligence-contract-check`, `ci-ai-chat-reliability-contract-check`,
`ci-pipeline-semantics-check`, the chat browser gates (`ls scripts | grep "chat.*browser"`), design-token /
inline-style / text-pin / instruction-text ratchets, boot budget `"failures": []`; `qa-runner contracts
--keep-going` (expected failures only as in other plans); two pending records (change-only, quoting the owner);
`apply-pending-records --dry-run` exits 0; one commit per part. Report the status-line text at each stage and what
needs a look in a real browser.
