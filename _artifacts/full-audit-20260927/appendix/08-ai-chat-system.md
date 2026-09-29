# AIO Screener — AI Chat / Orchestration System Audit

Scope audited: `src/ai/**`, `js/aio-chat.js` (9,258 lines), relevant `js/aio-ui.js` / `js/aio-core.js`,
`cloudflare-worker-proxy.js` (`/anthropic`, `/relay`), `scripts/ci-ai-*.mjs` / `ci-chat-*.mjs`,
`architecture/product-charter.json`, `src/app/bootstrap.js` (the ESM↔legacy bridge).
Read-only static analysis; no LLM calls made, no scripts executed, no repo state changed.
All line numbers are from the files as currently on disk (repo has no git history available in this
session — "no git repository" per environment banner — so exact HEAD SHA is unverified).

---

## 1. End-to-end request flow (as actually wired, not as designed on paper)

```
Browser (index.html, static SPA, no bundler)
 ├─ <script defer> js/aio-core.js, aio-data.js, aio-ui.js, aio-chat.js   (classic globals, execute in doc order)
 └─ <script type=module> src/app/bootstrap.js                            (ESM "architecture" bridge)
        │  imports src/ai/orchestrator/answer-orchestrator.js, context-builder.js,
        │  retrieval/{evidence,knowledge}.js, research/evidence.js
        └─ exposes them on window.AIO_ARCH = { planAIQuestion, executeAIQuestion,
              getAIOrchestrator, classifyAIConduct, getAIConductPolicy,
              buildScopedConductFallback, createAIResearchEvidenceDocument,
              normalizeAIResearchExecutionResult, evaluateAIResearchEvidenceFloor,
              parseAIAnswerPlan, renderAIAnswerPlan, getAIContext(unused), ... }

User types in a per-page chat panel (chatSend, aio-chat.js:6181) or the unified
chat bar (chatSendUnified, aio-chat.js:8445)
  │
  ▼
1. chatSend/chatSendUnified checks window.AIO_ARCH.getAIOrchestrator(); if present
   and not already orchestrated, re-enters through
   aiOrchestrator.execute({query,route,surface,legacyRunner: chatSend})
   → answer-orchestrator.execute() calls createQuestionPlan() (question-planner.js)
     which runs, in order: classifyQuestionIntent (intent/taxonomy.js),
     resolveEntities (entity/resolver.js), resolveQuestionTime/session
     (time/market-session.js), classifyAIRequest (policy/conduct.js — REQUEST
     surface only, answer text does not exist yet), evaluateQuestionActionPermission
     (policy/suitability.js), createResearchDecision/createResearchPlan,
     createCapabilityPlan. Returns a frozen questionPlan object.
   → legacyRunner re-invokes chatSend(ctxId, {_aioOrchestrated:true, questionPlan})
2. Pre-provider gate (aio-chat.js:6239, "Product-charter boundary: reject
   personalized direct action before quota, retrieval, or provider work"):
   window.AIO.evaluateAIActionPermission({query, suitabilityProfile, evidence})
   (aio-core.js:6727) — classifies P0 prohibited conduct (MNPI, manipulation,
   wash/front-running, rumor amplification) via window.AIO_ARCH.classifyAIConduct
   → window.AIO_ARCH's src/ai/policy/conduct.js. If BLOCKED_P0 the request is
   never sent to a provider (chatSend returns immediately with a safe-mode
   message). Non-P0 personalized/direct-action requests are NOT blocked here —
   see §Critical-2.
3. Retrieval/context assembly happens entirely inside aio-chat.js (NOT via
   src/ai/retrieval/evidence.js, which is unused — see §Critical-1): ticker
   quotes (_fetchTickerDataForChat), technical data, sector/deep-compare data,
   news (_buildNewsContext), knowledge pack context
   (buildNathanAnalysisContext via question-planner.js, and
   window.AIO_ARCH's aiKnowledgeRetriever via getAIOrchestrator().buildAIKnowledgeContext),
   optional web research (_aiWebSearch: Perplexity → Google CSE → Claude native
   web_search, in that fallback order), screener rows. Every externally sourced
   block is wrapped by window.AIO.buildAIUntrustedBlock() (aio-core.js:6566)
   before concatenation into the system prompt.
4. callClaude(system, messages, onChunk, onDone, onError, opts) (aio-chat.js:2090)
   picks a transport: personal API key → https://api.anthropic.com/v1/messages
   directly from the browser; otherwise the shared Cloudflare Worker
   `<workerUrl>/anthropic` (health-checked/cached first). Streams SSE.
5. onChunk (per token) and onDone (on stream completion) BOTH pipe the
   accumulated text through the SAME function, _aioRunAIResponsePipeline()
   (aio-chat.js:365), with streamPhase:'partial'|'complete'. This is the single
   choke point where: the model's [AI_ANSWER_PLAN] JSON block is parsed
   (window.AIO_ARCH.parseAIAnswerPlan → src/ai/response/claim-ledger.js),
   claims are cross-checked against real evidence rows
   (_aioBuildPublishableAnswerPlan, aio-chat.js:300 — see §Keep-1),
   conduct is re-audited on the OUTPUT text (window.AIO.evaluateAIActionPermission
   again, now with the rendered text — this is the "auditAIResponse" surface),
   tool/rights/publish/premise/research-gate audits run, and the final
   user-visible string + blocked/limitations flags are produced.
6. Render: chatAppendMsg() innerHTML's the gated text (sanitized via
   _aioSafeMD/escHtml), _aioAppendAIPublicDisclosure() appends an "answer basis"
   `<details>` element (source/as-of/evidence-status), saveChatEntry() persists
   a redacted Q/A pair to localStorage IF chat history is opted in.
```

Two independent public entry points (`chatSend` / per-page panels, `chatSendUnified`
/ the global bar) exist, but they are not a duplicated policy path: both call the
same `_aioRunAIResponsePipeline`, `_aioApplyAIActionGate`, `_aioCreateAIRequestObject`
and `window.AIO.evaluateAIActionPermission`. This is intentional single-policy-plane
design (comment at aio-chat.js:18-20: "the action validator remains
`_aioApplyAIActionGate` so there is no parallel gate") and it holds up under
inspection — see Keep-3.

**Where is policy enforced, and can it be bypassed?**
- Pre-provider: only hard P0 prohibited-conduct categories block the network call
  (aio-chat.js:6239-6253). Suitability/personalized-action requirements do **not**
  block the call (see Critical-2) — by explicit design decision "P1120" (comments at
  answer-orchestrator.js:28-35, aio-chat.js:6228-6230, aio-core.js:6765-6769): a
  personalized/direct-action question without a suitability profile is *disclosed*
  with a limitation banner, not refused outright, "because AIO is a private research
  tool." This is a deliberate policy-relaxation the product/compliance owner should
  sign off on explicitly; the product charter (`aiBoundary.personalizedDirectActionDefault:
  "BLOCKED"`) reads as a harder line than what P1120 implements.
- Post-response: the SAME conduct classifier runs again on the model's output text
  (`auditAIResponse` in policy/conduct.js audits `responseText` for a "legal
  directive" pattern) and can escalate a request that started as EDUCATIONAL to
  LEGAL_TAX_ANALYSIS if the answer itself reads as a directive.
- **Streaming does not leak unverified content.** While `streamPhase==='partial'`,
  `_aioRunAIResponsePipeline` can only produce visible text once
  `parseAIAnswerPlan` finds a *complete* `[AI_ANSWER_PLAN]...[/AI_ANSWER_PLAN]`
  block; since Claude emits that block incrementally, `publishablePlan.plan` is
  null for most of the stream, so `visible` falls back to the literal placeholder
  string `"AI 답변을 구성하고 근거를 검증하는 중…"` (aio-chat.js:391). Only at
  `streamPhase==='complete'` is the verified/rendered text shown. This is a real,
  verified anti-leak design, not just a comment (Keep-2).
- **Bypass surface:** the personal-API-key path (`callClaude` → `api.anthropic.com`
  directly) still routes through the identical `_aioRunAIResponsePipeline`/gate
  code because that code lives client-side in `aio-chat.js`, not in the worker.
  So the gate cannot be skipped by choosing BYOK vs. shared-worker *through the
  UI*. It CAN trivially be skipped by anyone opening devtools and calling
  `callClaude()` directly, or by scripting a raw POST to `/anthropic` with a
  valid `X-AIO-App-Token` (which is a public, hardcoded, non-secret string —
  `_aioAppToken()` returns the literal `'aio-screener-app-v1'`, aio-chat.js:1967,
  by the code's own comment: "공개 클라이언트 JS에 그대로 노출되므로 진짜 비밀이 아니다").
  All policy/claim-verification enforcement is **client-side only**; the worker
  enforces transport-level controls (origin allowlist, app-token gate, per-IP
  rate limit, atomic Durable-Object daily quota, model-family allowlist regex,
  max_tokens clamp) but has **no awareness of conduct policy, claim binding, or
  the answer-plan contract**. See Critical-3.

---

## 2. Prompt construction

- **System prompt** is assembled per-request in `aio-chat.js` from: a persona/context
  block (`CHAT_CONTEXTS`, aio-chat.js:1483), the "public AI action policy" boilerplate
  (`_aioPublicAIActionPolicyPrompt`, aio-chat.js:551 + the AnswerPlan-contract addendum
  at aio-chat.js:566), the coverage/current-data-contract block
  (`_buildChatAnswerCoverageContext`, aio-chat.js:4398), and then a sequence of
  `buildAIUntrustedBlock(...)`-wrapped data blocks (ticker quotes, news, web search,
  knowledge-pack reference, domain analysis JSON). No token budgeting library is used;
  size is tracked with a crude `chars/4` estimator (`_aioAIEstimateTokens`,
  aio-core.js area) purely for an audit sample, and a hard **90,000-character**
  auto-trim drops the oldest conversation turns when `system+messages` exceeds it
  (aio-chat.js:2124-2134) — the system prompt itself is never trimmed, only prior
  turns, so a single very large data injection (e.g. a big ticker/news block) cannot
  be shed by this mechanism.
- **Prompt caching**: real and correctly implemented. The system string is split at
  a fixed marker (`'【데이터 검증 상태'`, aio-chat.js:2152) into a static prefix
  (persona + policy boilerplate, marked `cache_control: {type:'ephemeral'}`) and a
  dynamic suffix (live data), sent as a 2-part `system` array with the
  `anthropic-beta: prompt-caching-2024-07-31` header only when a cache block is
  present. Cache-hit rate is logged from `usage.cache_read_input_tokens` (Keep-4).
  Caveat: if upstream persona/policy text is edited to remove or move the marker
  string, caching silently degrades to "no cache" with no alert — it's a string
  match on Korean text, brittle to refactors.
- **Untrusted-content quarantine / prompt-injection resistance**: real, not just a
  comment. `window.AIO.buildAIUntrustedBlock` (aio-core.js:6566) wraps every
  externally-sourced block (news, web search, knowledge pack, ticker enrichment,
  domain analysis) with explicit `[AIO UNTRUSTED DATA START/END]` delimiters and an
  instruction line telling the model to ignore embedded instructions. The
  normalizer (`_aioAIUntrustedNormalize`, aio-core.js:6532) strips zero-width/hidden
  Unicode and control characters, NFKC-normalizes, and **flags** (Korean+English)
  instruction-injection patterns ("ignore previous instructions", "system prompt",
  "reveal", "jailbreak", "이전 지시 무시", etc.) and base64-looking payloads, plus a
  hard length cap (2,400 chars/item, 8-12 items). **Gap**: flagged content is not
  removed, blocked, or routed to a stricter path — it is still concatenated into
  the prompt with only a flag recorded in an in-memory audit
  (`window._aioAIUntrustedAudit`). The defense is entirely "label it and ask the
  model to disregard it"; there is no code-level circuit breaker (e.g., refuse to
  answer, or drop that specific source) when `flags.length>0`. For a 5-user
  internal tool this is a reasonable risk level, but it should not be described as
  hard-blocking prompt injection — it is soft, instruction-level mitigation with an
  audit trail (Medium finding, §Medium-1).
- **Suitability profile is always null.** `question-planner.js:91` calls
  `evaluateQuestionActionPermission({..., suitabilityProfile: null, evidenceComplete:
  false})` unconditionally when building the plan — there is no code path anywhere
  in the audited scope that ever supplies a real `suitabilityProfile`. Combined
  with P1120 (Critical-2), this means the suitability gate in
  `src/ai/policy/suitability.js` is permanently in its "clarification-required"
  branch and never actually reaches `allowed:true`; the disclosure banner fires
  every time a personalized/direct-action question is asked, indefinitely. This
  is consistent (not broken), but it means the "if suitabilityProfile present" code
  path in `evaluateQuestionActionPermission` and `evaluateAIActionPermission` is
  dead in practice — there is no UI to collect a suitability profile.

---

## 3. Hallucination controls

This is the strongest part of the system and worth calling out precisely.

- **Structured output contract** (`[AI_ANSWER_PLAN]{...}[/AI_ANSWER_PLAN]`,
  schema `answer-plan.v1`, `src/ai/response/claim-ledger.js`): the model must emit
  numeric claims as typed objects (`type, text, metric, entity, value, unit, scale,
  asOf, source, evidenceIds, status`), not embed numbers loosely in prose. The
  system prompt explicitly forbids repeating current numbers outside the `claims`
  array (aio-chat.js:568-570).
- **Cross-referencing against real evidence, not just structural validation**
  (Keep-1): `_aioBuildPublishableAnswerPlan` (aio-chat.js:300-363) — for every
  numeric/metric/percentage/probability claim, it requires the referenced
  `evidenceIds` to exist in `bindingEvidence` (the actual injected ticker/news/
  research rows for *this* request, collected by `_aioCollectAIClaimEvidence`),
  AND requires `claim.value === row.value`, `claim.unit === row.unit`, matching
  `entity`/`metric`/`scale`, and (for current-sensitive claims) a matching
  `asOf` timestamp and `source`. Any claim that fails is dropped
  (`evidence-content-mismatch`/`evidence-unbound`/etc.), the claim is not shown,
  and the answer degrades to a limitation banner rather than exposing the
  unverified number. This is a genuine value-level hallucination check, not a
  citation-format check.
- **Prose-level backstop**: `_aioHasCurrentNumericContent` / 
  `_aioStripUnverifiedCurrentNumericSentences` regex-strip any sentence in the
  free-text summary/sections that looks like a current price/%/date/ratio when
  `currentSensitive` is true and no valid structured claim backs it
  (aio-chat.js:274-298, applied inside `_aioBuildPublishableAnswerPlan`).
- **Premise verification** (`src/ai/orchestrator/premise.js`): if the user's
  question asserts a direction ("NVDA is down today"), `evaluateDirectionalPremise`
  only confirms it against evidence rows matching the exact entity/metric/unit/
  timeframe/period tuple, with an explicit decision-use grant
  (`hasExplicitDecisionGrant`) — it will not infer a match from a proxy metric,
  a different period, or a merely "verified" status without the full current-claim
  grant chain. Wired into the question plan (`plan.premise`) and surfaced to the
  response pipeline (`_aioRunAIResponsePipeline` adds a "질문의 전제가 반대/충돌/
  미확인" disclosure when status is CONTRADICTED/CONFLICT/UNVERIFIED).
- **Stale/missing data**: `_aioBuildAIResponseDisclosure` and the coverage-context
  block explicitly instruct "missing is never zero" and require an as-of timestamp;
  `_aioEvidenceCanPublish` rejects rows with status matching
  `blocked|missing|stale|mismatch|invalid|refresh_required|unavailable|conflict|
  contradicted` or a future `asOf`.
- **Native web_search citations**: when Claude's server-side `web_search` tool is
  used, citation URLs/titles are captured from `citations_delta` and
  `web_search_tool_result` stream events (aio-chat.js:2269-2345) and bound to the
  specific `requestId` (not a shared global) so a canceled/overlapping request's
  citations can't leak into another answer's evidence set — a subtle but real
  concurrency-correctness detail (P1245 in comments).
- **Gap**: none of this is unit-tested against *adversarial* model output at scale
  (only fixture-style CI checks — see §6). The claim-binding logic is regex/string
  based (`_aioClaimSourceUrl`, source-string equality) rather than using a stable
  evidence-ID contract everywhere; a source string that differs by whitespace or
  a redirect could cause a true claim to be dropped (false negative — safe
  direction, but a quality cost) or, in principle, a source that happens to have
  the same string label from an unrelated row could be misattributed to a
  different value (`sourceMatches` alone is checked before value equality, so a
  wrong row could only pass if it also has the same value/unit/entity/metric,
  which limits the actual risk — unverified whether this has ever fired
  incorrectly in production; no telemetry on `droppedClaims` reasons was found
  being aggregated/reported anywhere).

---

## 4. Model selection / escalation, cost controls, error handling, streaming

- **Model IDs are hardcoded literals** in `js/aio-ui.js:343-358`:
  `claude-haiku-4-5-20251001`, `claude-sonnet-4-6` (used for both `sonnet` and
  `sonnet-thinking` keys, the latter adding `thinking:true, thinkingBudget:5000`).
  No indirection through an env/config file; a model retirement means an edit in
  this one file plus the worker's `/^claude-(haiku|sonnet)/` allowlist regex
  (cloudflare-worker-proxy.js:685) which does NOT validate the exact model
  string beyond the family prefix — a client could send
  `claude-sonnet-nonexistent-id` and it would pass the worker's regex and fail at
  Anthropic instead of being caught earlier.
- **Escalation heuristic** (`_detectQueryComplexity`, aio-ui.js:360-473) is a large,
  hand-tuned Korean/English regex cascade per route context (portfolio, fundamental,
  technical, signal, macro, breadth, sentiment, kr-*, themes) plus generic
  "thinking-keyword"/"sonnet-keyword" detection and structural heuristics (question
  marks, conjunctions, length). It is unvalidated: there is no eval harness or
  labeled corpus measuring whether this heuristic actually correlates with the
  need for a bigger model (contrast with `src/ai/eval/benchmark.js`'s
  `evaluateRoutingCorpus`, which measures *intent* classification, not *model
  selection*, and is a separate, disconnected classifier — see §5). This is the
  single largest maintenance/quality-drift risk item: it is pure regex heuristics
  with no measurement of precision/recall against actual "needed Sonnet but got
  Haiku" cases.
- **Cost controls**: `LLM_BUDGET.dailyQueryLimit = 20` (per-browser client-side
  counter, aio-ui.js:475-478) plus the worker's atomic Durable-Object daily cap
  (`ANTHROPIC_DAILY_CAP=300`, shared across users, `worker/wrangler.proxy.toml:11`)
  and `ANTHROPIC_MAX_TOKENS=1500` output cap (`worker/wrangler.proxy.toml:12`) for
  the shared-worker route. The client reads the worker's actual configured
  `maxTokens` from `/health` and clamps its own `effectiveMaxTokens` to it
  (aio-chat.js:2166-2168) — genuinely consistent, and the system prompt is told to
  keep the whole AnswerPlan within ~1,500 tokens (aio-chat.js:569) which matches
  the worker's default cap. BYOK (personal-key) users are not subject to the
  1500-token cap or the 300/day shared cap; only their own Anthropic account
  limits apply, and `requestedMaxTokens` there defaults to 12,000 (16,000 for
  thinking mode).
- **Region-block retry**: a documented, narrow retry (`_aioFetchClaudeWithRetry`,
  aio-chat.js:2059) that only retries on `serverKey && status===403` when the
  body is Anthropic's own `{error:{type:'forbidden'}}` shape (a known Cloudflare
  anycast-to-Hong-Kong-datacenter block observed and documented in-code), max 2
  retries with backoff. Not a general retry-on-failure policy — other 4xx/5xx are
  surfaced to the user as errors with guidance text (rate limit → wait/switch
  model, 5xx → check status.anthropic.com). Reasonable, narrowly scoped.
- **Streaming robustness**: connection timeout 30s (60s for thinking models),
  15s inter-chunk timeout, hard 50,000-char output truncation with a visible
  truncation notice, `message_stop` presence is verified (an ended stream without
  it throws), abort/cancel wiring is per-request (`AbortController` +
  `_aioLinkChatAbortSignal`) so a new question cancels the prior one cleanly
  (verified by `ci-chat-resilience-check.mjs`, which actually executes the real
  `aio-chat.js` source in a `vm` sandbox rather than re-implementing a mock —
  see §6). This is solid, production-grade streaming-transport engineering.
- **anthropic-dangerous-direct-browser-access: true`** is set for the BYOK path
  (aio-chat.js:2203) — expected for a pure static-site BYOK feature, but it does
  mean a user's personal Claude API key is used directly from browser JS with no
  server-side check on the requests it makes (rate limiting, quota, model
  allowlist are all absent on the BYOK path; only the shared-worker path is
  policed by the worker).

---

## 5. Duplication: legacy `aio-chat.js` vs `src/ai/**` — two pipelines?

**Yes, but it's a partial, not total, split-brain**, and the picture is more
specific than "two competing systems":

- **Genuinely wired and load-bearing** (imported by `src/app/bootstrap.js`, exposed
  as `window.AIO_ARCH`, and actually called from `aio-chat.js`/`aio-core.js`):
  - `createQuestionPlan` (question-planner.js) → called at the top of every
    chat send via `_classifyChatIntent`/`window.AIO_ARCH.planAIQuestion`
    (aio-chat.js:4342, aio-core.js:6146) to get intent/entities/timeframe/
    currentSensitive/premise/researchDecision — but only its **output fields**
    are read; aio-chat.js's own regex-based `_classifyChatIntent` translates the
    canonical intents into a *second*, chat-specific intent taxonomy
    (`ACTION_DECISION, LATEST_CHECK, DEEP_RESEARCH, ...`) used only to decide
    what context to inject and which coverage axes are "required" — i.e. the
    canonical planner's output is immediately re-classified by ad hoc logic
    rather than driving behavior directly. This is a real, mild duplication:
    two intent taxonomies where one wraps the other.
  - `classifyAIConduct`/`classifyAIRequest`/`auditAIResponse`/`getAIConductPolicy`/
    `buildScopedConductFallback` (policy/conduct.js) → called from
    `window.AIO.classifyFinancialConduct`/`getFinancialConductPolicy`/
    `evaluateAIActionPermission` (aio-core.js:6715-6736), which is the actual
    gate function used everywhere in aio-chat.js. This is a clean single
    source of truth for conduct policy.
  - `parseAnswerPlanText`/`renderAnswerPlan` (response/claim-ledger.js,
    response/renderer.js) → called directly by `_aioRunAIResponsePipeline`.
  - `createEvidenceDocument`/`normalizeResearchExecutionResult`/
    `evaluateResearchEvidenceFloor` (research/evidence.js) → called from the
    research/web-search preparation path (aio-chat.js:5164-5241).
  - `getAIOrchestrator().execute()` → the one-time re-entry wrapper at the top
    of `chatSend`/`chatSendUnified` that plans first, then re-invokes the legacy
    function with `_aioOrchestrated:true` — a real "orchestrator owns planning,
    legacy owns provider I/O" seam, per the AIQ-0/AIQ-1 comments.
- **Imported in bootstrap.js but functionally dead / never called from any chat
  path**: `buildEvidenceContext` (context-builder.js) and
  `createEvidenceRetriever` (retrieval/evidence.js), exposed as
  `window.AIO.getAIContext` / `window.AIO_ARCH...` — grep across `js/*.js` finds
  **zero** call sites other than the legacy-compatibility-facade re-export
  (`src/legacy/compatibility-facade.js:545`), which itself has no caller found
  in the audited scope. `src/ai/policy.js` (`evaluateEvidenceUse`,
  `evaluateClaim`) is imported only by `context-builder.js` (also unused) and by
  CI scripts — not by any runtime chat path. `src/ai/retrieval/knowledge.js`'s
  `createAIKnowledgeIndex`/`retrieveAIKnowledge` exports are used only inside
  its own `createAIKnowledgeRetriever` factory, which IS used (knowledge-pack
  context, aio-chat.js:6581/6592, 8650/8654) — so that module is live, but via
  one narrow entry point, not the general retrieval API.
  `src/ai/analysis/{causal,company,sector,technical,macro-fx}.js` and
  `registry.js` are wired through `answer-orchestrator.js`'s
  `buildAnalysisContext`/`analyze`, which IS called (aio-chat.js:1063-1218,
  `_aioBuildChatAnalysisContext`) — live.
- **Entirely CI-only, no runtime import anywhere**: nothing else in `src/ai/**`
  appears in this category beyond the two items above; the rest is either live
  (imported by bootstrap.js and called) or CI-only by design (the `eval/`
  benchmark harness, which is explicitly a test tool, not a runtime module).
- **Package-level confirmation**: `package.json`'s own description says
  *"CI-only tooling (no app runtime dependency — index.html is a
  dependency-free static SPA)"* — that line describes the `scripts/`/`qa`
  tooling, not `src/`, and is technically accurate for `scripts/*.mjs`, but a
  reader could mistakenly extend it to `src/ai/**`; in fact roughly 80% of
  `src/ai/**` (by file count) IS on the runtime import graph via
  `bootstrap.js`. This is worth a one-line doc correction so a future
  contributor doesn't delete "unused" modules that are actually load-bearing,
  or conversely trust that "it's imported so it's live" without checking for
  a real call site (as with `context-builder.js`/`retrieval/evidence.js`).

**Net assessment**: this is not "two pipelines that diverge" so much as "one
runtime pipeline, mostly implemented in `aio-chat.js`, that *consults* a set of
pure ESM policy/planning modules through a thin bridge, plus a handful of ESM
modules that were built for a retrieval/context path that was never finished
being wired in." The duplication that exists (two intent taxonomies, the
suitability profile that's always null, the never-called `getAIContext`) is
real but bounded, not systemic.

---

## 6. What does the eval/CI layer actually prove?

- **`src/ai/eval/benchmark.js`**: `evaluateRoutingCorpus` checks only whether
  `createQuestionPlan(query).intent.primary` matches a hand-labeled
  `expectedIntent` for a list of test cases — i.e. it measures **intent
  classification accuracy**, nothing about answer quality, citation accuracy, or
  policy correctness. `createBenchmarkManifest`/`assertBenchmarkReady` just
  check that a manifest has all of `snapshotRevision/modelVersion/promptVersion/
  retrieverVersion/validatorVersion` set — a structural "is this benchmark run
  reproducible" gate, not a quality score. **There is no rubric-graded answer
  evaluation anywhere in the audited scope.**
- **CI scripts** (`scripts/ci-ai-*.mjs`, `ci-chat-*.mjs`) are, on inspection,
  meaningfully better than typical "import and smoke test" gates:
  - `ci-ai-intelligence-contract-check.mjs` imports the real ESM modules
    (question-planner, claim-ledger, renderer, market-session, the `analysis/*`
    builders, benchmark, research/*, conduct policy, the orchestrator, knowledge
    retrieval, `policy.js`) and runs them against fixture cases/queries —
    genuine unit/contract tests of the ESM layer's *internal* correctness
    (e.g., "지금 반도체 하락 중" → `SECTOR_ANALYSIS`).
  - `ci-ai-chat-reliability-contract-check.mjs`, `ci-ai-quote-evidence-check.mjs`,
    `ci-chat-resilience-check.mjs`, `ci-ai-provider-stream-check.mjs` take the
    unusual and genuinely valuable approach of **reading the literal source text
    of `js/aio-chat.js`/`aio-core.js`, slicing out specific function bodies by
    string markers, and executing that exact production source in a Node `vm`
    sandbox** with a minimal fake `window`/`document`/`fetch` — rather than
    re-implementing test doubles of the logic that could silently drift from
    the real implementation. `ci-ai-provider-stream-check.mjs` specifically
    fuzzes `callClaude`'s SSE handling across
    `{complete, provider-error, premature-eof, invalid-event,
    error-body-timeout, caller-abort} × {serverKey: true/false}` — a real
    transport-robustness regression suite.
  - `ci-ai-premise-check.mjs` uses `node:assert` fixtures against
    `evaluateDirectionalPremise`/`createQuestionPlan` with realistic evidence
    rows (VERIFIED/UNVERIFIED cases) — a genuine contract test of the premise
    module, not a placeholder.
  - Several other gates (`ci-ai-chat-analysis-integration-check.mjs`,
    `ci-ai-analysis-evidence-check.mjs`, `ci-ai-chat-public-route-browser-check.mjs`,
    `ci-chat-response-layout-browser-check.mjs`, `ci-chat-ui-state-browser-check.mjs`)
    were not fully read line-by-line given scope/time; based on naming and the
    pattern established by the ones inspected, they likely follow the same
    "read real source + fixture-execute" or Playwright-browser-check pattern
    (**unverified** — flagged for a follow-up pass if needed).
  - **What none of them prove**: whether a real Claude response to a real user
    question is *correct*, *well-cited*, *free of subtle miscalibration*, or
    *appropriately hedged*. There is no LLM-graded or human-graded output
    rubric, no golden-answer set, and no live-canary evaluation. The CI layer
    proves "the code that assembles/gates the answer behaves as specified
    given a fixture," not "the assembled answer is good." That gap is
    structural, not a bug — a rubric-graded eval requires either human review
    or another model as judge, and neither exists here.

---

## 7. Regulatory / financial-advice posture, disclaimers, privacy

- **Charter** (`architecture/product-charter.json`) sets a hard non-goal:
  "individualized-buy-sell-sizing-or-timing-instructions-without-suitability-
  and-current-decision-evidence" and `aiBoundary.personalizedDirectActionDefault:
  "BLOCKED"`. The **implemented** policy (P1120, §Critical-2) is looser than
  this reads: personalized/direct-action questions without a suitability profile
  are answered with a disclosure banner, not blocked. This is a real
  charter-vs-implementation gap that should be either (a) reconciled in the
  charter text to describe the disclosure model accurately, or (b) the
  implementation tightened to actually block, whichever the operator intends —
  currently the two documents disagree.
- **AI-generated / beta labeling**: every response is tagged with
  `_AIO_PUBLIC_AI_POLICY = {label:'AI 베타 · 교육/리서치 보조', status:'beta-research',
  actionGate:'read-only-conditional-analysis'}` and an appended `<details>`
  "답변 근거" (answer basis) element showing evidence status / as-of time / source
  (aio-chat.js:586-658). The system prompt itself instructs the model that it is
  "AI 베타 · 교육/리서치 보조이며 독립 투자자문·검증 시스템·실시간 주문 도구가 아니다"
  (aio-chat.js:552-560). This satisfies a basic AI-generated/beta disclosure
  posture; it is not a formal regulatory disclaimer (no jurisdiction-specific
  "not investment advice" legal boilerplate was found beyond this framing —
  **unverified** whether such boilerplate exists elsewhere in the UI shell
  outside the audited files).
- **P0 prohibited-conduct list** (`policy/conduct.js`) covers MNPI, market
  manipulation, wash trading, front-running, rumor amplification, and
  restricted-security instructions — a reasonable minimum set for a retail
  research tool, hard-blocked pre-provider.
- **Chat history privacy**: default **off** (`aio_chat_history_enabled` defaults
  to unset/false, `window.AIO.getChatHistoryPolicy()`, aio-core.js:6665-6668),
  opt-in required, stored client-side only in `localStorage` (never uploaded to
  the worker or any server — the worker has no chat-history storage in the
  audited scope), redacted before storage
  (`_aioRedactChatHistoryText`/`prepareChatHistoryEntry`, aio-core.js:6678+ —
  strips emails, API-key-shaped strings, `Bearer` tokens, and share-quantity/
  percentage figures in a portfolio context), with a *declared* policy of
  30-day retention / 50-entry cap (`retentionDays:30, maxEntries:50` in the
  returned policy object) — **whether that retention/cap is actually enforced
  by a pruning routine, or is just a descriptive field nobody reads, was not
  confirmed in this pass (unverified — would need to trace every
  `saveChatEntry`/localStorage-write call site for a prune step)**. This is
  overall a genuinely privacy-respecting default (off, local-only, redacted),
  better than "logged to a server by default."
- **Portfolio data**: requires explicit session-scoped consent
  (`window.AIO.setPortfolioAIConsent`, sessionStorage-only, cleared on tab
  close) before portfolio positions are sent to the model at all, and even then
  only a redacted view (`redactPortfolioForAI`: ticker/sector/allocationPct/
  returnPct only — explicitly excludes accountId/userId/email/broker/qty/cost/
  memo/notes/journal, aio-core.js:6529-6530, 6608-6635).

---

## Findings summary (severity, file:line, root cause)

### Critical
1. **`src/ai/context-builder.js` + `src/ai/retrieval/evidence.js` (and the
   `policy.js`/`getAIContext` API surface they support) are dead code from the
   runtime's perspective** — imported by `bootstrap.js:73-76` and exposed as
   `window.AIO.getAIContext`, but no call site exists in `js/aio-chat.js`,
   `aio-ui.js`, or `aio-core.js` (only a self-referential re-export in
   `src/legacy/compatibility-facade.js:545` with no further caller found).
   Root cause: an evidence-retrieval abstraction was built ahead of the
   feature that would consume it, and the chat prompt-assembly logic in
   `aio-chat.js` grew its own separate, ad hoc evidence-collection path
   (`_aioCollectAIClaimEvidence`) instead of converging on it. Risk: future
   contributors may either (a) delete it as dead code while something silently
   depends on the `window.AIO.getAIContext` global, or (b) extend it believing
   it is on the critical path, wasting effort. **Recommendation**: either wire
   `_aioCollectAIClaimEvidence` through `createEvidenceRetriever`, or remove
   the unused export and note the retirement in `architecture/route-owners.json`
   / retirement-manifest per the project's own stated architecture principle
   ("route-ownership-requires-writer-retirement-not-only-native-wrappers").

2. **Personalized/direct-action suitability gate is charter-stronger-than-
   implementation.** `architecture/product-charter.json`'s
   `aiBoundary.personalizedDirectActionDefault: "BLOCKED"` and non-goal
   "individualized-buy-sell-sizing-or-timing-instructions-without-suitability-
   and-current-decision-evidence" read as a hard block. The actual code
   (`answer-orchestrator.js:28-35` comment "P1120: the pre-provider
   action-permission refusal was retired"; `aio-core.js:6765-6769`) treats this
   as a **disclosure**, not a refusal: a personalized/direct-action question
   without a suitability profile (which is *never* populated —
   `question-planner.js:91` always passes `suitabilityProfile: null`) still
   gets a full answer with a "※ 투자 성향·적합성 정보가 없어..." banner prepended.
   This may be the intended, deliberate product decision (the in-code comment
   explicitly argues for it — "AIO는 사설 리서치 도구") but it directly
   contradicts the charter's own stated boundary as written. **Recommendation**:
   reconcile the charter text with the implemented behavior (pick one), and if
   the disclosure model is intended, update `aiBoundary` and the non-goal list
   to describe it precisely (e.g. "requires an explicit uncertainty disclosure"
   rather than "BLOCKED").

3. **All policy/claim-verification enforcement is client-side; the shared
   Cloudflare Worker enforces only transport controls.** `cloudflare-worker-
   proxy.js`'s `/anthropic` handler (line 662-722) checks origin, app-token,
   per-IP rate limit, atomic daily quota, a loose model-family regex
   (`/^claude-(haiku|sonnet)/`), and clamps `max_tokens` — it has zero
   knowledge of conduct policy, claim-evidence binding, or the AnswerPlan
   contract. Anyone who can reach the worker URL with a valid (public,
   hardcoded) app token — e.g., by reading it out of the shipped JS, which the
   code's own comment acknowledges ("진짜 비밀이 아니다") — can send arbitrary
   `system`/`messages` and get an unfiltered, ungated Claude response, fully
   bypassing every hallucination/conduct control described in §3 and §1.
   For a 5-user trusted-user tool this is a low-likelihood risk, but it means
   none of the carefully engineered claim-binding/conduct logic is a genuine
   security boundary — it is a UX/quality safeguard for the shipped web app,
   not a policy enforcement point for the API surface itself.
   **Recommendation** (see §Rebuild): move at minimum the conduct P0 check
   (cheap, regex-based, `policy/conduct.js` already has zero dependencies) into
   the Worker before the upstream fetch, so the hard-refusal boundary holds
   even for direct API callers.

### High
4. **Model-selection heuristic (`_detectQueryComplexity`, aio-ui.js:360-473) is
   an unvalidated, hand-tuned regex cascade with no accuracy measurement.**
   Unlike intent classification (which has `evaluateRoutingCorpus` in
   `eval/benchmark.js`, wired into `ci-ai-intelligence-contract-check.mjs`),
   there is no labeled corpus or CI gate measuring whether this heuristic
   correctly escalates queries that actually need Sonnet/Thinking. Silent
   under- or over-escalation directly affects both answer quality and the
   20/day (client) and 300/day (shared) query budgets. **Recommendation**:
   build a small labeled corpus (expected model tier per sample query) and a
   CI check analogous to `evaluateRoutingCorpus`.
5. **Untrusted-content injection defense is soft-only** (§2): detected
   injection/encoded-payload patterns are flagged into an audit object but the
   flagged content is still sent to the model unchanged; only hidden-Unicode
   and control characters are actually stripped. There is no fallback (drop
   the source, refuse, or route to a stricter prompt) when a source is flagged.
   **Recommendation**: when `flags` includes `instruction-injection` or
   `encoded-payload`, either drop that specific untrusted item entirely before
   it reaches the prompt, or explicitly downgrade to "source unavailable" —
   don't rely solely on the model's instruction-following to resist it.
6. **Worker `ANTHROPIC_MAX_TOKENS=1500` default combined with `_detectQueryComplexity`
   escalating to Sonnet-Thinking (`thinkingBudget:5000`) for shared-worker users**
   means `useExtendedThinking` is disabled server-side whenever
   `effectiveMaxTokens (≤1500) ≤ thinkingBudget(5000)+256` (aio-chat.js:2169) —
   i.e., for every shared-worker (non-BYOK) user, "Sonnet Thinking" silently
   degrades to plain Sonnet with no thinking budget, without any user-visible
   indication that the requested reasoning mode was not actually used (the
   response pipeline's `truncated`/`extendedThinking` fields are computed but
   **not** currently checked in `_aioRunAIResponsePipeline`'s limitation logic
   for "you asked for Thinking but did not get it" — only for length
   truncation). **Unverified** whether this is surfaced anywhere else in the UI
   (e.g. a model-badge); worth a targeted check.

### Medium
7. **Two intent taxonomies for one question** (§5): `intent/taxonomy.js`'s
   canonical intents (`SECTOR_ANALYSIS`, `ENTITY_ANALYSIS`, etc.) are
   immediately re-classified by `_classifyChatIntent`'s own regex-based
   taxonomy (`ACTION_DECISION`, `DEEP_RESEARCH`, `TECHNICAL_SETUP`, ...) purely
   to decide prompt content/coverage requirements. Not incorrect, but it is a
   second classifier that can drift from the first, doubling the surface a
   future contributor must update when adding a new intent.
8. **`suitabilityProfile` is structurally always `null`** (question-planner.js:91)
   — the suitability module's "profile present" branch is unreachable in
   production. Either build the missing profile-collection UI, or simplify the
   module to reflect that it currently only ever returns
   "clarification-required"/"educational".
9. **Prompt-cache split relies on a brittle string marker**
   (`'【데이터 검증 상태'`, aio-chat.js:2152) with no test asserting the marker
   still exists in the current system-prompt text; an edit to the Korean
   boilerplate could silently disable caching (cost regression) with no CI
   signal. **Recommendation**: add a CI check (in the existing
   `ci-ai-chat-reliability-contract-check.mjs` style) asserting the marker is
   present in the built system prompt.
10. **`claude-sonnet-4-6` model ID has no dated snapshot suffix** unlike
    `claude-haiku-4-5-20251001` (aio-ui.js:344-357) — if this is an alias
    Anthropic can silently move, the app has no version pinning for its primary
    model; if it is a specific dated release with the date omitted from the
    string, that's just a naming inconsistency. **Unverified** which is the
    case without checking current Anthropic model catalog.

### Low
11. `LLM_BUDGET.dailyQueryLimit=20` is a client-side `localStorage` counter,
    trivially reset by clearing site data or using a private window — it is a
    UX nudge, not a real quota (the real quota is the worker's atomic
    Durable-Object cap). Not mislabeled in the code, but worth confirming
    users understand the two are different.
12. `eval/benchmark.js`'s naming ("benchmark") invites the assumption it
    measures answer quality; it measures only intent-routing accuracy. A
    rename or a doc-comment clarifying scope would reduce future confusion.
13. `package.json` description ("CI-only tooling ... index.html is a
    dependency-free static SPA") is true for `scripts/*.mjs` but reads as if
    it also describes `src/**`, when in fact most of `src/ai/**` is on the
    runtime import graph via `src/app/bootstrap.js`. Worth a one-line
    clarification to prevent future "safe to delete, nothing imports src/"
    mistakes.

---

## What to keep

- **Keep-1**: `_aioBuildPublishableAnswerPlan`'s value-level claim/evidence
  cross-check (aio-chat.js:300-363) — this is a materially strong, specific
  hallucination control (checks `value`, `unit`, `entity`, `metric`, `scale`,
  `asOf`, `source` against real injected evidence rows, not just "was a
  citation present"). Rare to see this precisely implemented.
- **Keep-2**: streaming never reveals unverified content — the partial-stream
  path only shows a "verifying" placeholder until the full AnswerPlan block is
  parsed and gated (aio-chat.js:390-391). Directly answers the audit's
  "streaming published before policy check?" concern in the negative (good).
- **Keep-3**: single shared response-gate function
  (`_aioRunAIResponsePipeline`/`_aioApplyAIActionGate`) used identically by
  both public entry points (`chatSend`, `chatSendUnified`) and by both
  `streamPhase` values — no parallel/divergent gate exists, which the code's
  own comments call out as a deliberate invariant.
- **Keep-4**: correctly implemented Anthropic prompt caching (static/dynamic
  system-prompt split, `cache_control: ephemeral`, conditional beta header,
  cache-hit-rate logging from real `usage` fields) plus a working worker-
  reported `maxTokens` → client `effectiveMaxTokens` clamp, keeping the two
  tiers (BYOK vs shared) consistent with their respective token budgets.
- **Keep-5**: CI gates that execute real production source (`vm.runInContext`
  over sliced text from `aio-chat.js`) instead of reimplementing test doubles —
  this is unusual and valuable given `aio-chat.js` is not an ES module and
  can't otherwise be unit-tested without a bundler; it directly prevents
  test/implementation drift.
- **Keep-6**: default-off, local-only, redacted chat history and consent-gated,
  field-allowlisted portfolio redaction before any personal data reaches a
  model — a genuinely privacy-conscious default posture.
- **Keep-7**: the untrusted-block wrapping convention applied consistently
  across every external content type (news/web/knowledge/ticker/domain
  analysis) with an audit trail, even though the enforcement itself is soft
  (Medium-1) — the *pattern* (label, don't trust, instruct-ignore, audit) is
  the right shape and should be kept and hardened, not replaced.

---

## How I would build it instead

The current system is better than a typical "one big prompt + fetch" chat
integration, largely because of Keep-1/2/3/4/5. The structural problem is that
the two things doing the most policy-sensitive work — conduct
classification and claim-evidence binding — run entirely in code the browser
downloads and can be told to skip. For a 5-user internal tool this is a
reasonable trade today, but if this product is heading toward more users or
external exposure, I would:

1. **Move the policy floor into the Worker, not just the client.** At minimum,
   port `policy/conduct.js`'s P0 check (pure, dependency-free, already ESM) into
   `cloudflare-worker-proxy.js`'s `/anthropic` handler, applied to the last user
   message before the upstream fetch. This makes the hard-refusal boundary real
   for *any* caller of the worker, not just the shipped UI. The claim-binding
   check is harder to move server-side because it depends on the same evidence
   rows the client already fetched from market-data providers (FMP/etc.); a
   cleaner design would have the client send its `bindingEvidence` alongside
   the model request so the worker (not just the browser) can validate the
   returned AnswerPlan before relaying it back — i.e., **tool-use / structured
   evidence pass-through with server-side validation of the returned
   claim ledger**, rather than trusting the browser to run
   `_aioBuildPublishableAnswerPlan` on the way out.
2. **Give the model retrieval as tool calls, not string concatenation.**
   Currently every data source (ticker quotes, news, web search, knowledge pack,
   domain analysis) is pre-fetched and string-concatenated into the system
   prompt behind an untrusted-block wrapper. An Anthropic tool-use loop (client
   or worker orchestrated) where the model calls `get_quote(ticker)`,
   `get_news(ticker)`, `search_web(query)` and receives typed, evidence-ID-
   tagged JSON results would let the *existing* claim-binding logic
   (`_aioBuildPublishableAnswerPlan`) validate against a narrower, purpose-built
   evidence set instead of a large pre-assembled blob, likely reducing both
   token cost (no unused context) and injection surface (fewer untrusted blocks
   pasted in speculatively).
3. **Unify the two intent taxonomies.** Have `_classifyChatIntent`'s
   context/coverage logic consume `intent/taxonomy.js`'s canonical intents
   directly (a lookup table from canonical intent → coverage axes) instead of
   re-deriving a parallel taxonomy from regexes over the same query text.
4. **Add a model-selection eval**, mirroring `evaluateRoutingCorpus`: a labeled
   corpus of `{query, ctxId, expectedTier}` run through `_detectQueryComplexity`
   in CI, so escalation-heuristic regressions are caught the same way intent
   regressions already are.
5. **Add an answer-quality eval set**, even a small one: a rubric (evidence
   cited? claims traceable? refused personalized advice appropriately?
   disclaimer present? hedged appropriately for `currentSensitive`?) scored by
   a separate judge model against a fixed set of representative Korean-market
   questions, run on a schedule (not necessarily every CI run, given Claude API
   cost) so answer-quality drift from prompt/model changes is caught before
   users notice it. This is the one category (真 answer-quality measurement)
   that has literally no coverage today.
6. **Retire or finish `context-builder.js`/`retrieval/evidence.js`.** Either
   route `_aioCollectAIClaimEvidence` through them (so there is one evidence-
   retrieval abstraction instead of two) or delete them and their `window.AIO.
   getAIContext` export, per the project's own stated architecture principle
   about writer retirement.
7. **Reconcile the charter with P1120** (personalized-action disclosure vs.
   block) so the two documents describing "what this AI is allowed to do"
   agree with each other.

Migration should be incremental and low-risk given the existing test
infrastructure: (a) port the conduct P0 regexes to the worker with a CI test
mirroring `ci-ai-intelligence-contract-check.mjs`'s conduct cases, verified
against the worker in isolation before touching the client; (b) build the
model-selection and answer-quality eval sets as pure additions (no runtime
behavior change) before touching `_detectQueryComplexity` itself; (c) only
after both are in place, consider the tool-use refactor, which is the largest
and riskiest change and should not be bundled with the policy-hardening work.

---

## Explicitly unverified / needs follow-up

- Whether `ci-ai-chat-analysis-integration-check.mjs`, `ci-ai-analysis-evidence-
  check.mjs`, `ci-ai-chat-public-route-browser-check.mjs`,
  `ci-chat-response-layout-browser-check.mjs`, `ci-chat-ui-state-browser-check.mjs`
  follow the same rigor as the gates read in full (§6) — not read line-by-line.
- Whether the declared chat-history retention (30 days / 50 entries) is
  actually enforced by a pruning routine anywhere, or is a descriptive field
  only.
- Whether `claude-sonnet-4-6` (no date suffix) is a stable alias or a specific
  dated snapshot with the date omitted from the string.
- Whether the live, deployed Cloudflare Worker matches
  `cloudflare-worker-proxy.js` in this repo (product charter itself flags
  `"cloudflare-edge-and-provider-plane": "SOURCE_CONTRACTED_LIVE_REVISION_DIVERGED"`
  — i.e., the project's own audit trail already states the deployed worker may
  differ from source).
- Whether extended-thinking silently degrading to plain Sonnet under the
  shared-worker token cap (Finding High-6) is surfaced anywhere in the UI.
- Exact current git HEAD / version number this audit corresponds to — no git
  metadata was available in this session (memory index says the repo was at
  "v48.97 완료" as of an earlier session, but `index.html` script tags in this
  read show `?v=56.55`, so the codebase has advanced well past that memory
  entry; treat the memory file's version number as stale for this audit).
