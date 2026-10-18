// P1421: a narrow, priced Responses protocol shared by browser and Actions.
// Price snapshot: https://developers.openai.com/api/docs/models/gpt-6-luna
// Text input is bounded by UTF-8 bytes plus protocol/schema framing. Cached
// tokens are charged at the worst cache-write rate, never at a guessed discount.
export const OPENAI_MODEL = 'gpt-6-luna';
export const PRICING_AS_OF = '2026-10-03';
// P1608: owner approved $20 including conditional hosted search (2026-10-11).
export const AI_MONTHLY_MAX_MICRO_USD = 20000000;
export const WEB_SEARCH_MAX_CALLS = 2;
// v57.62: a searched response is a loop of up to 1 + max_tool_calls model turns. Every turn re-reads the whole
// prompt, the search content returned so far and the earlier turns' output items (reasoning/tool calls), so the
// pre-answer reservation bills each turn at its worst context instead of counting the prompt once:
//   reservation = calls x fee + (1 + calls) x (prompt + calls x content allowance + max_output) x input rate
//               + max_output x output rate, at long-context rates when that worst turn exceeds 272k tokens.
// Pricing page (https://developers.openai.com/api/docs/pricing, checked 2026-10-14): web search $10/1k calls plus
// search content tokens at model input rates; the only published block size is 8,000 tokens/call (mini models).
// The fee carries the same 1.1 regional uplift as tokens. Hosted search has no numeric content cap, so the per-call
// allowance is policy: 4x (low) / 8x (medium) the published block. A completed receipt then settles from usage.
export const WEB_SEARCH_FEE_MICRO_USD_PER_CALL = 11000; // $0.01 x 1.1
export const SEARCH_CONTENT_TOKENS_PER_CALL = Object.freeze({ low: 32000, medium: 64000 });
const LONG_CONTEXT_TOKENS = 272000;
// v57.61: analysis may ask for medium reasoning and medium search context; both stay inside max_output_tokens
// and the per-call content allowance above (v57.62). Higher effort is never admitted with search.
const SEARCH_EFFORTS = ['low', 'medium'];
const SEARCH_CONTEXT_SIZES = ['low', 'medium'];
// v57.61: reasoning tokens are counted inside max_output_tokens, so medium-effort analysis needs room beyond 8192
// or the visible answer is cut. Reservation = tokens x output price: 16384 x $0.55/M = $0.009 per request.
export const AI_MAX_OUTPUT_TOKENS_LIMIT = 16384;
export const paidWebSearchEnabled = env => env?.AI_WEB_SEARCH_ENABLED === 'true';
const INPUT_MICRO_USD_PER_TOKEN = 0.1 * 1.25 * 1.1;
const OUTPUT_MICRO_USD_PER_TOKEN = 0.5 * 1.1;
// v57.62: above 272k input tokens per model turn the page lists $0.20 input / $0.75 output per 1M.
const LONG_INPUT_MICRO_USD_PER_TOKEN = 0.2 * 1.25 * 1.1;
const LONG_OUTPUT_MICRO_USD_PER_TOKEN = 0.75 * 1.1;
const tokenRates = longContext => longContext ? [LONG_INPUT_MICRO_USD_PER_TOKEN, LONG_OUTPUT_MICRO_USD_PER_TOKEN] : [INPUT_MICRO_USD_PER_TOKEN, OUTPUT_MICRO_USD_PER_TOKEN];

export function quotaInteger(value, fallback, maximum = 1000000) {
  const raw = value === undefined ? String(fallback) : String(value);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > maximum) throw new Error('invalid AI quota configuration');
  return Number(raw);
}

export function aiMonthlyBudgetMicroUsd(env = {}) {
  const raw = String(env.AI_MONTHLY_BUDGET_USD ?? env.ANTHROPIC_MONTHLY_BUDGET_USD ?? '20');
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(raw)) throw new Error('invalid monthly AI budget');
  const [whole, fraction = ''] = raw.split('.');
  const amount = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0'));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > AI_MONTHLY_MAX_MICRO_USD) throw new Error('monthly AI budget must be between $0 and $20');
  return amount;
}

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => record(value) && Object.keys(value).every(key => keys.includes(key));
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

export function prepareOpenAiBudget(requestBody, env = {}) {
  if (!record(requestBody)) throw new Error('JSON object required');
  const body = { ...requestBody, model: requestBody.model ?? OPENAI_MODEL, store: false, service_tier: 'default' };
  if (body.model !== OPENAI_MODEL) throw new Error('unsupported model: shared AI supports gpt-6-luna only');
  const allowed = ['model','max_output_tokens','input','instructions','stream','reasoning','tools','tool_choice','parallel_tool_calls','text','store','service_tier','max_tool_calls'];
  if (!onlyKeys(body, allowed)) throw new Error('unsupported AI request parameter: no safe cost bound');
  if (requestBody.store !== undefined && requestBody.store !== false) throw new Error('shared AI requires store:false');
  if (requestBody.service_tier !== undefined && requestBody.service_tier !== 'default') throw new Error('only standard default service tier is budgeted');
  const maximum = quotaInteger(env.AI_MAX_OUTPUT_TOKENS, 4000, AI_MAX_OUTPUT_TOKENS_LIMIT);
  body.max_output_tokens = Math.min(maximum, quotaInteger(body.max_output_tokens, maximum));
  if (body.instructions !== undefined && typeof body.instructions !== 'string') throw new Error('text instructions required');
  if (body.stream !== undefined && typeof body.stream !== 'boolean') throw new Error('boolean stream required');
  if (body.parallel_tool_calls !== undefined && typeof body.parallel_tool_calls !== 'boolean') throw new Error('boolean parallel_tool_calls required');
  if (body.reasoning !== undefined && (!onlyKeys(body.reasoning, ['effort']) || !['none','low','medium','high','xhigh','max'].includes(body.reasoning.effort))) throw new Error('unsupported reasoning configuration');
  const textContent = value => {
    if (typeof value === 'string') return;
    if (!Array.isArray(value) || value.length > 64) throw new Error('bounded text content required');
    for (const block of value) {
      if (!onlyKeys(block, ['type','text','annotations']) || !['input_text','output_text'].includes(block.type)
        || typeof block.text !== 'string' || (block.annotations !== undefined && (!Array.isArray(block.annotations) || block.annotations.length))) throw new Error('only plain text input/output is budgeted');
    }
  };
  if (typeof body.input !== 'string') {
    if (!Array.isArray(body.input) || body.input.length > 64) throw new Error('at most 64 text/function input items required');
    for (const item of body.input) {
      if (onlyKeys(item, ['type','role','content']) && (item.type === undefined || item.type === 'message') && ['system','developer','user','assistant'].includes(item.role)) { textContent(item.content); continue; }
      if (onlyKeys(item, ['type','id','call_id','name','arguments','status']) && item.type === 'function_call'
        && identifier(item.name) && typeof item.call_id === 'string' && typeof item.arguments === 'string'
        && (item.id === undefined || typeof item.id === 'string') && (item.status === undefined || item.status === 'completed')) continue;
      if (onlyKeys(item, ['type','call_id','output']) && item.type === 'function_call_output' && typeof item.call_id === 'string' && typeof item.output === 'string') continue;
      throw new Error('unsupported AI input: image/file/audio/previous-response expansion is not budgeted');
    }
  }
  if (body.tools !== undefined && (!Array.isArray(body.tools) || body.tools.length > 32)) throw new Error('at most 32 custom functions supported');
  let searchToolCount = 0;
  for (const tool of body.tools || []) {
    if (tool?.type === 'web_search') {
      if (!paidWebSearchEnabled(env)) throw new Error('공용 AI 웹검색이 아직 활성화되지 않았습니다.');
      if (++searchToolCount > 1 || !onlyKeys(tool, ['type','search_context_size','return_token_budget','filters'])
        || !SEARCH_CONTEXT_SIZES.includes(tool.search_context_size) || tool.return_token_budget !== 'default') throw new Error('bounded web_search configuration required');
      if (tool.filters !== undefined && (!onlyKeys(tool.filters, ['allowed_domains']) || !Array.isArray(tool.filters.allowed_domains)
        || tool.filters.allowed_domains.length < 1 || tool.filters.allowed_domains.length > 100
        || tool.filters.allowed_domains.some(domain => typeof domain !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)))) throw new Error('invalid search domain filter');
      continue;
    }
    if (tool?.type !== 'function') throw new Error('unsupported paid tool');
    if (!onlyKeys(tool, ['type','name','description','parameters','strict']) || !identifier(tool.name) || !record(tool.parameters)
      || (tool.description !== undefined && typeof tool.description !== 'string') || (tool.strict !== undefined && typeof tool.strict !== 'boolean')) throw new Error('invalid custom function');
  }
  if (searchToolCount) {
    body.max_tool_calls = quotaInteger(body.max_tool_calls, WEB_SEARCH_MAX_CALLS, WEB_SEARCH_MAX_CALLS);
    body.reasoning = { effort: SEARCH_EFFORTS.includes(body.reasoning?.effort) ? body.reasoning.effort : 'low' };
    if (body.tools.length !== 1) throw new Error('hosted search cannot mix with custom functions');
  } else if (body.max_tool_calls !== undefined) throw new Error('max_tool_calls requires hosted search');
  if (body.tool_choice !== undefined && !['auto','required','none'].includes(body.tool_choice)
    && (!onlyKeys(body.tool_choice, ['type','name']) || body.tool_choice.type !== 'function' || !identifier(body.tool_choice.name))) throw new Error('unsupported tool choice');
  if (body.text !== undefined) {
    if (!onlyKeys(body.text, ['format']) || !record(body.text.format)) throw new Error('unsupported output format');
    const format = body.text.format;
    if (['text','json_object'].includes(format.type)) { if (!onlyKeys(format, ['type'])) throw new Error('invalid output format'); }
    else if (format.type !== 'json_schema' || !onlyKeys(format, ['type','name','description','schema','strict']) || !identifier(format.name) || !record(format.schema)
      || (format.description !== undefined && typeof format.description !== 'string') || (format.strict !== undefined && typeof format.strict !== 'boolean')) throw new Error('invalid JSON schema format');
  }
  const bytes = new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if (bytes > 200 * 1024) throw new Error('AI request exceeds the budgeted text limit');
  const inputTokenUpperBound = bytes + 8192 + (Array.isArray(body.input) ? body.input.length : 1) * 1024 + (body.tools?.length || 0) * 4096;
  if (inputTokenUpperBound > 272000) throw new Error('long-context pricing is outside the shared budget protocol');
  const textReservationMicroUsd = Math.ceil(inputTokenUpperBound * INPUT_MICRO_USD_PER_TOKEN + body.max_output_tokens * OUTPUT_MICRO_USD_PER_TOKEN);
  let reservationMicroUsd = textReservationMicroUsd, billedInputTokenUpperBound = inputTokenUpperBound, longContextPricing = false;
  if (searchToolCount) {
    const calls = body.max_tool_calls;
    const turnContextUpperBound = inputTokenUpperBound + calls * SEARCH_CONTENT_TOKENS_PER_CALL[body.tools[0].search_context_size] + body.max_output_tokens;
    longContextPricing = turnContextUpperBound > LONG_CONTEXT_TOKENS;
    billedInputTokenUpperBound = (1 + calls) * turnContextUpperBound;
    const [inputRate, outputRate] = tokenRates(longContextPricing);
    reservationMicroUsd = Math.ceil(calls * WEB_SEARCH_FEE_MICRO_USD_PER_CALL + billedInputTokenUpperBound * inputRate + body.max_output_tokens * outputRate);
  }
  // searchReserveMicroUsd = the search-attributable part (fees + repeated turns + content); > 0 marks a searched budget.
  const searchReserveMicroUsd = reservationMicroUsd - textReservationMicroUsd;
  return { body, reservationMicroUsd, monthlyCapMicroUsd: aiMonthlyBudgetMicroUsd(env), inputTokenUpperBound, billedInputTokenUpperBound, longContextPricing,
    searchReserveMicroUsd, accountingBasis: 'conservative-reservation-and-verified-usage-not-invoice', pricingAsOf: PRICING_AS_OF };
}

// max_output_tokens includes hidden reasoning tokens. Never add them a second
// time or trust missing/negative/over-bound usage to replenish monthly credit.
// A08 (Codex review): the approved alias and its dated snapshots (alias-YYYY-MM-DD) are one priced model. The
// text extractor already accepted dated responses; settlement must use the same identity rule, or a valid answer
// keeps its whole reservation. Any other model id is never priced by assumption.
export function isApprovedOpenAiModel(model) {
  const id = String(model || '');
  return id === OPENAI_MODEL || (id.startsWith(`${OPENAI_MODEL}-`) && /^\d{4}-\d{2}-\d{2}$/.test(id.slice(OPENAI_MODEL.length + 1)));
}

// v57.62: a completed searched receipt settles too. Responses usage aggregates every model turn of the hosted-search
// loop (prompt re-reads and search content tokens are input_tokens); each web_search_call output item is one billed
// call, whatever its action or status. Missing output, an unknown item shape, more calls than admitted, usage above
// the reserved bounds or a total above the reservation keeps the whole reservation.
// v58.20 review A1: an answer stopped at max_output_tokens is billed and shown to the user, so it settles too; its output
// is bounded by max_output_tokens like any other receipt. Other incomplete reasons keep the whole reservation.
const outputLimited = (response) => response.status === 'incomplete' && record(response.incomplete_details) && response.incomplete_details.reason === 'max_output_tokens';
export function verifiedOpenAiCharge(response, budget) {
  if (!record(response) || response.object !== 'response' || !isApprovedOpenAiModel(response.model) || (response.status !== 'completed' && !outputLimited(response))
    || typeof response.id !== 'string' || !response.id || !record(response.usage)) return null;
  const searched = budget.searchReserveMicroUsd > 0;
  let calls = 0;
  if (Array.isArray(response.output)) {
    if (response.output.length > 256) return null;
    for (const item of response.output) {
      if (!record(item) || typeof item.type !== 'string') return null;
      if (item.type === 'web_search_call') calls++;
    }
  } else if (searched) return null;
  if (calls > (searched ? budget.body.max_tool_calls : 0)) return null;
  const { input_tokens: input, output_tokens: output, total_tokens: total } = response.usage;
  if (![input, output, total].every(value => Number.isSafeInteger(value) && value >= 0)
    || total !== input + output || input > (searched ? budget.billedInputTokenUpperBound : budget.inputTokenUpperBound) || output > budget.body.max_output_tokens
    || response.service_tier !== undefined && response.service_tier !== 'default') return null;
  // v57.62 review: search content has no numeric cap, so one real turn can pass 272k even when the reservation-time
  // estimate did not. Any searched receipt whose billed input passes 272k settles at long-context rates (conservative).
  const [inputRate, outputRate] = tokenRates(searched && (budget.longContextPricing === true || input > LONG_CONTEXT_TOKENS));
  const amount = Math.max(1, Math.ceil(calls * WEB_SEARCH_FEE_MICRO_USD_PER_CALL + input * inputRate + output * outputRate));
  return amount <= budget.reservationMicroUsd ? amount : null;
}
