// S5 (ADR-0003): the one statement of what the browser and the shared AI Worker must agree on. The Worker
// (cloudflare-worker-proxy.js, worker/openai-budget.mjs) imports it through its bundle, the browser through
// src/app/chat-globals.js (AIO.aiWorkerContract) and src/domain/ai/shared-connection.js. The model id, the body limit and
// the header names were literals in five files, and the client's trim target (180 KB) sat beside a Worker limit (200 KiB)
// it never named. Pure constants: no imports, safe for the Worker, the domain and the classic shell.

/** The only model the shared Worker serves (owner: gpt-6-luna shared Worker, AGENTS.md). */
export const AI_PROVIDER = 'openai';
export const AI_MODEL = 'gpt-6-luna';

/** The Worker refuses a request whose UTF-8 text is larger than this. */
export const AI_REQUEST_MAX_BYTES = 200 * 1024;
/** What the chat trims its instructions + input to: the limit less room for the request framing (model, tools, flags). */
export const AI_CLIENT_BODY_TARGET_BYTES = 180000;

export const AI_HEADERS = Object.freeze({
  appToken: 'X-AIO-App-Token',
  operatorToken: 'X-AIO-Operator-Token',
  automationToken: 'X-AIO-Automation-Token',
  idempotencyKey: 'X-AIO-Idempotency-Key',
  requestId: 'X-AIO-Request-Id',
  maxTokens: 'X-AIO-Max-Tokens'
});

export const AI_WORKER_CONTRACT = Object.freeze({ provider: AI_PROVIDER, model: AI_MODEL, requestMaxBytes: AI_REQUEST_MAX_BYTES, clientBodyTargetBytes: AI_CLIENT_BODY_TARGET_BYTES, headers: AI_HEADERS });
