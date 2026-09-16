import { classifyQuestionIntent } from '../../../src/ai/intent/taxonomy.js';

// Positive cases: a metric/quote question about an instrument must keep the
// numeric + currentness guards on, including Korean company names.
// Negative controls: concept/education questions must NOT be flagged.
const cases = [
  ['삼성전자 실적 어때?', true],
  ['엔비디아 실적 어때', true],
  ['AAPL PER 얼마야?', true],
  ['AAPL 밸류에이션 분석해줘', true],
  ['삼성전자 목표가 어떻게 봐?', true],
  ['AAPL 주가 어때', true],
  ['오늘 시장 어때?', true],
  ['금리 전망은?', true],
  ['PER이 뭐야?', false],
  ['PEG가 뭐야?', false],
  ['RSI가 뭐야?', false],
  ['이동평균 개념 설명해줘', false],
  ['스크리닝이 뭐야?', false]
];

let failed = 0;
const rows = [];
for (const [query, expected] of cases) {
  const result = classifyQuestionIntent(query);
  const ok = result.currentSensitive === expected;
  if (!ok) failed += 1;
  rows.push({ query, primary: result.primary, currentSensitive: result.currentSensitive, explicitCurrent: result.explicitCurrent, inherentlyCurrent: result.inherentlyCurrent, expected, ok });
}

console.log(JSON.stringify({ total: cases.length, failed, rows }, null, 1));
if (failed) {
  console.error(`FAIL: ${failed} classification expectation(s) not met`);
  process.exit(1);
}
console.log('taxonomy probe PASS: instrument-metric questions guard on, concept questions stay off.');
