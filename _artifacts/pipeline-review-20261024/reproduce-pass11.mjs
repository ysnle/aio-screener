// Review-only fixtures against actual publication/renderer/action gate functions.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createAnswerPlan } from '../../src/ai/response/claim-ledger.js';
import { buildPublishableAnswerPlan } from '../../src/ai/response/publication.js';
import { renderAnswerPlan } from '../../src/ai/response/renderer.js';
import { installAIRequestPipeline } from '../../src/ai/response/request-pipeline.js';
import { extractTickers } from '../../src/ai/entity/extract-tickers.js';
import { resolveEntities } from '../../src/ai/entity/resolver.js';
import { resolveChatTickers } from '../../src/ai/entity/chat-tickers.js';
const sentence = '연준이 금리를 인하했고 신용 스트레스도 해소됐다.';
const evidence = [{ evidenceId: 'audit-price', status: 'reference', source: 'audit-price-provider',
  asOf: '2026-10-27', metric: 'price', entity: 'AAPL', value: 100, unit: 'USD', allowedUse: 'reference' }];
const plan = createAnswerPlan({ summary: sentence, claims: [{ claimId: 'audit-event', type: 'text', text: sentence,
  source: 'audit-price-provider', asOf: '2026-10-27', evidenceIds: ['audit-price'], status: 'verified' }] });
const published = buildPublishableAnswerPlan(plan, evidence, true);
assert.equal(published.plan.summary, '');
assert.equal(published.plan.claims.claims.length, 1);
const output = renderAnswerPlan(published.plan);
assert.ok(output.includes(sentence));
const root = {};
installAIRequestPipeline(root, {});
const direct = root._aioApplyAIActionGate('NVDA를 매수하세요.');
const attribution = root._aioApplyAIActionGate('오닐은 추세를 따라야 한다고 봤습니다 그래서 NVDA를 매수하세요.');
assert.ok(direct.replacedSentences > 0);
assert.ok(attribution.text.includes('NVDA를 매수하세요'));
const query = 'BRK.B 실적 분석';
const registryRoot = { AIO_TICKER_NAME_REGISTRY: { entries: { 'BRK-B': { en: 'Berkshire Hathaway Class B' } } } };
const entities = resolveEntities(query, { root: registryRoot });
const selected = resolveChatTickers({ query, questionPlan: { entities }, extract: extractTickers, companiesOnly: true });
assert.ok(selected.includes('BRK'));
assert.ok(selected.includes('BRK-B'));
const report = { at: new Date().toISOString(), evidenceSynthetic: true, tickerSelection: { query, entities, selected: [...selected] }, event: { published, output },
  actionGate: { direct, attribution }, limits: 'No model/provider calls, no live UI. Actual publication/renderer and directive gate; not full browser execution.' };
fs.writeFileSync(new URL('./pass11-reproductions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
