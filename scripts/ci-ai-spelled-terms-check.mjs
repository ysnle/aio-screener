#!/usr/bin/env node
// v60.18 (weekly audit 2026-11-15 S3): the market reading of 11/12-11/13 spelled Latin names out in Hangul (에이아이,
// 씨엔비씨, 에스앤피500) beside "AI" and "S&P 500" elsewhere on the same screen (9e92f0a1d: 17 times). The provider's text
// enters the artifact through splitMarketSentence (body and the day's sentence); the spelled forms are put back there.
// This gate checks the rule and the published reading.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitMarketSentence } from './lib/market-analysis-validate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SPELLED = /에이아이|씨엔비씨|에스앤피/;
const failures = [];
const check = (label, fn) => { try { fn(); console.log(`  ok  ${label}`); } catch (error) { failures.push(label); console.log(`  FAIL ${label}\n       ${error.message.split('\n')[0]}`); } };

check('v60.18 the reading and the day sentence write AI, CNBC and S&P 500 in Latin', () => {
  const raw = '11/12 씨엔비씨 보도에 따르면 반도체·에이아이 공급망 기대가 눌렸습니다. 에스앤피500은 -0.40%, 에스앤피오백은 50일선 아래입니다.\n오늘의 한 문장: 꺾인 에이아이 주도와 순환이 맞서고 있습니다.';
  const { body, sentence } = splitMarketSentence(raw);
  assert.equal(body, '11/12 CNBC 보도에 따르면 반도체·AI 공급망 기대가 눌렸습니다. S&P 500은 -0.40%, S&P 500은 50일선 아래입니다.', 'v60.18 Latin names in the reading body');
  assert.equal(sentence, '꺾인 AI 주도와 순환이 맞서고 있습니다.', 'v60.18 Latin names in the day sentence');
  assert.equal(splitMarketSentence('에이스 아이템과 이아이는 그대로입니다.').body, '에이스 아이템과 이아이는 그대로입니다.', 'v60.18 other Hangul is untouched');
});

// The published reading is reported, not failed: a reading written before this rule (or retained from one) keeps its
// spelling until the next verified reading replaces it, and the artifact carries no marker of which rule wrote it.
// AIO_SPELLED_TERMS_STRICT=1 turns the report into a failure (for a check after the first refresh under v60.18).
{
  const data = JSON.parse(readFileSync(resolve(root, process.env.AIO_DATA_JSON || 'public-data/data.json'), 'utf8'));
  const ma = data?.marketAnalysis || {};
  const texts = [ma.summary, ma.full, ma.sentence?.text, ...(Array.isArray(ma.sentences) ? ma.sentences.map((row) => row?.text) : [])].filter((text) => typeof text === 'string');
  const hits = texts.filter((text) => SPELLED.test(text)).map((text) => text.match(new RegExp(`.{0,20}(?:${SPELLED.source}).{0,10}`))?.[0]);
  if (process.env.AIO_SPELLED_TERMS_STRICT === '1') check('v60.18 the published market reading has no spelled-out Latin names', () => assert.deepEqual(hits, [], 'v60.18 no spelled-out Latin name in the published reading'));
  else if (hits.length) console.log(`  note the published reading (${ma.generatedAt || 'unknown time'}) still spells ${hits.length} name(s) in Hangul: ${hits.slice(0, 3).join(' / ')}`);
}

if (failures.length) { console.error(`ai-spelled-terms: ${failures.length} failed`); process.exit(1); }
console.log('ai-spelled-terms: all checks passed');
