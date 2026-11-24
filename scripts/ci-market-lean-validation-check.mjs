// The 시장 기울기 lean speaks a direction only where its backtest passed, and the backtest harness
// reads the past the way a reader had it.
//
// Part 1 — label gate. Every lean surface (the 시장 상태 card as painted, its chip, the AI context line) is rendered over
// every six-axis count and the frequency mixes that can vote, under the published verdict
// (public-data/model-validation-status.json `marketLean`) and under absent, failing, one-direction and passing
// verdicts. A direction word (매수 / 매도 / 방어 / 우위) may appear only for a key whose direction the verdict passed;
// with a passing verdict it must appear, with its past frequency and sample size beside it.
// Part 2 — harness unit check on the frozen 2026 replay window (architecture/fixtures/crash-replay-2026-closes.json):
// the replay equals the live functions called directly, ignores rows after the reading date, leaves a missing axis
// out of the count, uses an HY observation only from the next session, and the statistics and judgement behave.
//
//   node scripts/ci-market-lean-validation-check.mjs [--module <path to market-lean.js>]
// (--module exists to show that the pre-gate lean fails part 1.)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFakeDocument } from './lib/fake-dom.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleArg = process.argv.indexOf('--module');
const leanUrl = moduleArg > 0 ? pathToFileURL(path.resolve(process.argv[moduleArg + 1])).href : pathToFileURL(path.join(ROOT, 'src/domain/market/regime/market-lean.js')).href;
const lean = await import(leanUrl);
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// ── Part 1 ────────────────────────────────────────────────────────────────────────────────────────────────────────
const DIRECTION_WORD = /매수|매도|방어|우위/;
const DIRECTION_OF = { 2: 'buy', 1: 'buy', [-1]: 'defend', [-2]: 'defend' };
const allowed = (verdict, key) => {
  const v = verdict?.marketLean;
  if (!v || v.ruleVersion !== 'market-lean.v1') return false;
  const d = DIRECTION_OF[key];
  // A direction word needs its past frequency beside it, so a key the study holds no frequency for stays the count.
  return d ? v.directions?.[d] === true && Number.isFinite(v.frequencies?.[key]?.n) : v.directions?.buy === true && v.directions?.defend === true;
};
const block = (status, buy, defend) => ({ marketLean: { ruleVersion: 'market-lean.v1', horizon: 21, status, directions: { buy, defend }, span: { from: '2008-03-11', to: '2026-11-13' }, axesReconstructed: ['trend', 'volatility', 'rates', 'commodities'],
  frequencies: { 2: { rate: 72, base: 64, n: 40 }, 1: { rate: 70, base: 64, n: 45 }, 0: { rate: 64, base: 64, n: 120 }, [-1]: { rate: 55, base: 64, n: 40 }, [-2]: { rate: 50, base: 64, n: 31 } } } });
const published = JSON.parse(readFileSync(path.join(ROOT, 'public-data/model-validation-status.json'), 'utf8'));
const verdicts = { published, absent: null, failing: block('FAIL', false, false), buyOnly: block('PARTIAL', true, false), passing: block('PASS', true, true),
  otherRule: { marketLean: { ...block('PASS', true, true).marketLean, ruleVersion: 'market-lean.v0' } } };

const body = (state, hitRate) => ({ state, asOf: '2026-11-13', outcomes: { [state]: { h21: { n: 60, hitRate } }, all: { h21: { hitRate: 64 } } } });
const temperatures = { none: null, coldUp: { retained: [], markets: { spx: body('cold', 85), kospi: body('cold', 85) } }, hotDown: { retained: [], markets: { spx: body('hot', 40), nasdaq: body('hot', 40), kosdaq: body('hot', 40) } } };
const regimes = [null];
for (let f = 0; f <= 6; f += 1) for (let b = 0; b + f <= 6; b += 1) regimes.push({ available: true, sufficient: true, asOf: '2026-11-13', counts: { favorable: f, neutral: 6 - f - b, burden: b, unknown: 0 } });

let session = null;
try { session = await import(pathToFileURL(path.join(ROOT, 'src/ui/components/session-lean.js')).href); } catch (error) { failures.push(`session-lean.js does not load offline: ${error.message}`); }
const painted = (input, verdict) => {
  if (!session || moduleArg > 0) return '';
  const doc = createFakeDocument();
  const anchor = doc.getElementById('regime-leaders');
  const root = { _aioHistory: [{ date: '2026-11-13', vix: 19.3 }], _aioStressOutcomes: null, _aioMarketTemperature: input.temperature, _aioLeanValidation: verdict, __aioSharedArtifacts: {} };
  const model = session.paintMarketLean(doc, root, input.regime, anchor);
  return model?.us?.available ? doc.getElementById('home-lean').textContent : '';
};

let surfaces = 0, spokenSeen = 0;
for (const [name, verdict] of Object.entries(verdicts)) {
  for (const [tName, temperature] of Object.entries(temperatures)) {
    for (const regime of regimes) {
      const input = { regime, temperature, vix: 19.3, validation: verdict };
      const model = lean.buildMarketLean(input);
      if (!model.us.available) continue;
      const key = model.us.ruleKey ?? model.us.key;
      const where = `${name}/${tName}/${regime ? `${regime.counts.favorable}-${regime.counts.neutral}-${regime.counts.burden}` : 'no-regime'} key ${key}`;
      const texts = { label: model.us.label, read: model.us.read, basis: model.us.basis, flip: model.us.flip, frequency: model.us.frequency,
        kr: model.kr.available ? `${model.kr.label} ${model.kr.read}` : '', ai: lean.renderMarketLeanContext(model), card: painted(input, verdict) };
      surfaces += 1;
      const ok = allowed(verdict, key);
      for (const [surface, text] of Object.entries(texts)) {
        if (!text) continue;
        // The Korea reference is never backtested, so it never carries a direction word.
        if ((!ok || surface === 'kr') && DIRECTION_WORD.test(text)) check(false, `v60.19 ${where}: ${surface} says a direction without a passing verdict — ${text.slice(0, 160)}`);
      }
      // No lean maps to a choice, passing verdict or not (one behaviour, market-lean.js).
      check(!('choices' in model.us) && !/덜 불리한 선택/.test(texts.ai), `v60.19 ${where}: the lean carries a choice list`);
      if (!ok) {
        if (regime) check(/양호 \d · 중립 \d · 부담 \d/.test(model.us.label), `v60.19 ${where}: label is not the condition count (${model.us.label})`);
      }
      if (ok && regime) {
        spokenSeen += 1;
        check(DIRECTION_WORD.test(model.us.label) || /엇갈림/.test(model.us.label), `v60.19 ${where}: a passing verdict did not speak the direction (${model.us.label})`);
        check(key === 'mixed' || /과거 같은 판정 뒤 21거래일 상승 \d+% \(평소 \d+%, 사례 \d+개/.test(model.us.frequency || ''), `v60.19 ${where}: the spoken direction has no past frequency and sample size beside it (${model.us.frequency})`);
        if (texts.card) check(texts.card.includes(model.us.frequency || model.us.label), `v60.19 ${where}: the painted card drops the frequency`);
      }
    }
  }
}
check(spokenSeen > 0, 'v60.19 the passing verdict never spoke a direction (positive control)');

// v60.19 (owner-approved VIX-band risk line): beside the six-axis state the card prints the published record's share of
// −5% drawdowns within 21 sessions for today's band, the base rate and the case count; until the weekly lane publishes
// those fields it prints 없음; the fold says the count did not pass its held-out validation. Unit + rendered copy.
if (session && moduleArg <= 0) {
  const { vixBandRecord, vixBandRiskLine } = await import(pathToFileURL(path.join(ROOT, 'src/domain/market/signal/vix-band-record.js')).href);
  const { stressOutcomesFingerprint } = await import(pathToFileURL(path.join(ROOT, 'src/domain/scenarios/outcome-fingerprints.js')).href);
  const { STRESS_OUTCOMES } = await import(pathToFileURL(path.join(ROOT, 'src/data/artifact-registry.js')).href);
  const record = { status: 'current', fingerprint: stressOutcomesFingerprint(), from: '1990-01-02', to: '2026-11-13', all: { 21: { hitRate: 64, n: 9000 } }, allRisk: { cases: 420, drawdownCases: 60, drawdownShare: 14.3 },
    bands: [{ id: 'normal', label: '15~20', horizons: { 21: { hitRate: 63, nEff: 136, n: 2856 } }, risk: { cases: 118, drawdownCases: 10, drawdownShare: 8.5 } }, { id: 'stress', label: '30~40', horizons: { 21: { hitRate: 60, nEff: 30 } }, risk: { cases: 21, drawdownCases: 6, drawdownShare: 28.6 } }, { id: 'panic', label: '40 이상', horizons: { 21: { hitRate: 70, nEff: 9.9 } }, risk: { cases: 7, drawdownCases: 3, drawdownShare: 42.9 } }] };
  const line = (vix, rec = record) => vixBandRiskLine(vixBandRecord(rec, vix));
  check(line(19.3)?.text === 'VIX 19.3(15~20 구간): 1990년 이후 이런 날 뒤 21거래일 안에 -5% 이상 빠진 경우 9% (겹치지 않는 사례 118개 중 10개, 평소 14%)', `v60.19 risk line beside the base rate and case count: ${line(19.3)?.text}`);
  // The share is taken on the non-overlapping cases it is printed beside — not on every overlapping day.
  const { stressRiskSummary } = await import(pathToFileURL(path.join(ROOT, 'src/domain/market/signal/stress-outcomes.js')).href);
  const windows = Array.from({ length: 42 }, (_, i) => ({ index: i, drawdown: i < 5 ? -6 : -1, ret: i < 5 ? -6 : 2 }));
  const summary = stressRiskSummary(windows);
  check(summary.days === 42 && summary.cases === 2 && summary.drawdownCases === 1 && summary.drawdownShare === 50 && summary.upCases === 1 && summary.upShare === 50,
    `v60.46 the drawdown share and its count are one sample (2 non-overlapping cases, 1 hit = 50%, not 5/42 days): ${JSON.stringify(summary)}`);
  check(line(33)?.state === 'small' && /사례 21개 중 6개 · 참고, 평소 14%\)$/.test(line(33).text) && line(45)?.state === 'thin' && !/%/.test(line(45).text.replace(/VIX 45\.0/, '')),
    `v60.19 evidence-strength on the risk line: 10–29 cases 참고, under 10 counts only (${line(33)?.text} / ${line(45)?.text})`);
  const old = { ...record, bands: record.bands.map(({ risk, ...band }) => band), allRisk: undefined };
  check(line(19.3, old)?.state === 'missing' && /없음/.test(line(19.3, old).text) && line(19.3, { ...record, fingerprint: 'stress-outcomes:older' })?.state === 'missing' && line(null) === null,
    'v60.19 a record without the drawdown fields, or from another definition, reads 없음; no VIX close, no line');
  const paint = (stress) => {
    const doc = createFakeDocument();
    const root = { _aioHistory: [{ date: '2026-11-13', vix: 19.3 }], [STRESS_OUTCOMES.key]: stress, _aioMarketTemperature: null, _aioLeanValidation: null, __aioSharedArtifacts: {} };
    session.paintMarketLean(doc, root, regimes.at(-1), doc.getElementById('regime-leaders'));
    return doc.getElementById('home-lean')?.textContent || '';
  };
  const card = paint(record), none = paint(null);
  // Review v60.19 A5: the fold's sentence on the count's risk read comes from the published verdict
  // (model-validation-status.json marketLean.risk); with none on file it says there is no published validation yet.
  check(card.includes(line(19.3).text) && card.includes('부담 수로 다음 한 달 깊은 하락이 잦은지 가르는 읽기는 아직 공개된 과거 검증 결과가 없습니다.') && !/통과하지 못했습니다/.test(card)
    && /양호 \d · 중립 \d · 부담 \d/.test(card) && !DIRECTION_WORD.test(card),
    `v60.19 the painted card carries the risk line, the validation sentence and the count as a state: ${card.slice(0, 400)}`);
  check(/낙폭 기록: 없음/.test(none), `v60.19 without the published fields the card says 없음: ${none.slice(0, 300)}`);
  const riskBlock = (status) => ({ ...block('FAIL', false, false).marketLean, risk: { ruleVersion: 'market-lean.v1', horizon: 21, status, criterion: { drawdownPct: -5, lowBurden: 0, highBurdenMin: 2, minEffectiveN: 30, level: 0.95 },
    heldOut: { from: '2020-08-03', to: '2026-10-14', highCases: 48, lowCases: 41, point: 11.2, ci: [-1.31, 23.9] } } });
  const noteOf = (verdict) => String(lean.buildMarketLean({ regime: regimes.at(-1), validation: verdict }).us.countNote || '');
  check(noteOf({ marketLean: riskBlock('FAIL') }) === '부담 2개 이상인 날과 0개인 날의 21거래일 안 -5% 이상 하락 비율 차이는 2020~2026년 검증 구간에서 기준(차이의 95% 구간이 0보다 위인지)을 통과하지 못했습니다.'
    && /을 통과했습니다\.$/.test(noteOf({ marketLean: riskBlock('PASS') })) && /아직 공개된 과거 검증 결과가 없습니다/.test(noteOf({ marketLean: riskBlock('NOT_RUN') }))
    && /아직 공개된/.test(noteOf({ marketLean: { ...riskBlock('FAIL'), risk: { ...riskBlock('FAIL').risk, ruleVersion: 'market-lean.v0' } } })),
    `review v60.19 the risk sentence states the published status, held-out span and criterion: ${noteOf({ marketLean: riskBlock('FAIL') })}`);
  // Review v60.19 A6: the AI context reader asks for the verdict first (no repaint); the card painted while that request is
  // in flight repaints when it lands.
  {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const verdict = block('PASS', true, true);
    const root = { _aioHistory: [{ date: '2026-11-13', vix: 19.3 }], __aioSharedArtifacts: {},
      fetch: async () => { await gate; const text = JSON.stringify(verdict); return { ok: true, status: 200, headers: { get: () => String(text.length) }, text: async () => text, json: async () => verdict }; } };
    const doc = createFakeDocument();
    let repaints = 0;
    session.paintHome(doc, root, null, regimes.at(-1), () => {}, () => regimes.at(-1));
    session.paintMarketLean(doc, root, regimes.at(-1), doc.getElementById('regime-leaders'), () => { repaints += 1; });
    release();
    for (let i = 0; i < 20 && !repaints; i += 1) await new Promise((resolve) => setTimeout(resolve, 5));
    check(repaints === 1 && root._aioLeanValidation?.marketLean?.status === 'PASS', `review v60.19 a card painted after the context reader's request repaints once when the verdict lands (repaints ${repaints})`);
  }
}
// Review v60.19 A7: why an unspoken key carries no direction word, case by case.
{
  const v = (status, buy, defend, frequencies = block('PASS', true, true).marketLean.frequencies) => lean.leanValidation({ marketLean: { ...block(status, buy, defend).marketLean, frequencies } });
  check(typeof lean.verdictLine === 'function', 'review v60.19 market-lean.js exports verdictLine');
  const lean2 = { verdictLine: lean.verdictLine || (() => '') };
  const cases = [
    [lean2.verdictLine(v('NOT_RUN', false, false), '1'), /아직 과거 검증 결과가 없어/],
    [lean2.verdictLine(v('FAIL', false, false), '1'), /기준을 통과하지 못해 방향을 붙이지 않습니다/],
    [lean2.verdictLine(v('PARTIAL', true, false), '0'), /상승 쪽 판정만 기준을 통과했고, 지금 개수는 한쪽으로 기울지 않아/],
    [lean2.verdictLine(v('PARTIAL', true, false), '-1'), /상승 쪽 판정만 기준을 통과했고, 지금 개수가 가리키는 하락 쪽은 기준을 통과하지 못해/],
    [lean2.verdictLine(v('PARTIAL', false, true), 'mixed'), /하락 쪽 판정만 기준을 통과했고, 지금은 조건과 과거 빈도가 서로 다른 쪽을/],
    [lean2.verdictLine(v('PASS', true, true, {}), '1'), /기준은 통과했지만, 지금 판정과 같은 과거 사례 기록이 없어/]
  ];
  for (const [text, want] of cases) check(want.test(text) && !DIRECTION_WORD.test(text), `review v60.19 verdict line case ${want}: ${text}`);
  check(lean.buildMarketLean({ regime: regimes.find((r) => r && r.counts.favorable === 2 && r.counts.burden === 2), validation: { marketLean: block('PARTIAL', true, false).marketLean } }).us.basis === lean2.verdictLine(v('PARTIAL', true, false), '0'),
    'review v60.19 the card basis is the verdict line for its own key');
}
const publishedStatus = published?.marketLean?.status || 'absent';

// ── Part 2 ────────────────────────────────────────────────────────────────────────────────────────────────────────
if (moduleArg < 0) {
  const harness = await import('./backtest-market-lean.mjs');
  const { buildMarketRegime } = await import('../src/domain/briefing/market-read.js');
  const { judgeMarketLean } = await import('./build-validation-gates.mjs');
  const fixture = JSON.parse(readFileSync(path.join(ROOT, 'architecture/fixtures/crash-replay-2026-closes.json'), 'utf8'));
  const rows = fixture.dates.map((date, i) => { const row = { date }; for (const [field, values] of Object.entries(fixture.series)) if (Number.isFinite(values?.[i])) row[field] = values[i]; return row; });
  const start = rows.findIndex((row) => row.date >= '2026-07-01');
  const end = rows.findIndex((row) => row.date >= '2026-08-01');
  const hy = JSON.parse(readFileSync(path.join(ROOT, 'public-data/macro-history.json'), 'utf8')).series?.hyOas?.observations || [];
  const replay = harness.replayLean(rows, { hy, start, end });
  check(replay.length === end - start && replay.every((r) => r.sufficient), `v60.19 replay covers the July window with a count each day (${replay.length})`);
  // Parity: the same functions called directly on the same trailing window.
  for (const r of replay.filter((_, k) => k % 5 === 0)) {
    const history = rows.slice(Math.max(0, r.i - harness.HISTORY_WINDOW + 1), r.i + 1);
    const macroHistory = { series: { hyOas: { observations: hy.filter(([d]) => d < r.date).slice(-400) } } };
    const regime = buildMarketRegime({ history, credit: {}, rates: {}, macroHistory, now: Date.parse(`${r.date}T22:00:00Z`) });
    const direct = lean.buildMarketLean({ regime: regime.available ? regime : null });
    check(direct.us.score === r.score && JSON.stringify(regime.counts) === JSON.stringify(r.counts), `v60.19 ${r.date}: replay ${r.score} ${JSON.stringify(r.counts)} != direct ${direct.us.score} ${JSON.stringify(regime.counts)}`);
  }
  // Point in time: rows after the reading date are never read.
  const cut = replay[10];
  const scrambled = rows.map((row, k) => (k > cut.i ? { ...row, spx: row.spx * 3, vix: 80, tnx: row.tnx + 2 } : row));
  const again = harness.replayLean(scrambled, { hy, start: cut.i, end: cut.i + 1 })[0];
  check(JSON.stringify(again) === JSON.stringify(cut), `v60.19 ${cut.date}: a reading changed when later rows changed`);
  // An HY observation dated on the reading day is not used that day.
  const day = replay[5];
  const shock = harness.replayLean(rows, { hy: [...hy.filter(([d]) => d < day.date), [day.date, 12]], start: day.i, end: day.i + 1 })[0];
  check(shock.states.credit === day.states.credit, `v60.19 ${day.date}: an HY print dated the reading day moved the credit axis (${day.states.credit} -> ${shock.states.credit})`);
  // A missing axis is left out of the count, not read as neutral.
  const noBreadth = rows.map(({ breadth50, breadth20, breadth200, breadth40, advanceRatio, ...rest }) => rest);
  const thin = harness.replayLean(noBreadth, { hy, start: cut.i, end: cut.i + 1 })[0];
  check(thin.states.breadth === 'unknown' && thin.counts.unknown >= 1 && thin.counts.favorable + thin.counts.neutral + thin.counts.burden === 6 - thin.counts.unknown,
    `v60.19 without breadth rows the axis is unknown and out of the count: ${JSON.stringify(thin)}`);
  // Statistics.
  assert.deepEqual(harness.nonOverlapping([0, 1, 5, 21, 22, 42, 70], 21), [0, 21, 42, 70], 'v60.19 cases are kept greedily one horizon apart');
  check(Math.abs(harness.forwardReturn([{ spx: 100 }, { spx: 110 }], 0, 1) - 10) < 1e-9 && harness.forwardReturn([{ spx: 100 }], 0, 1) === null, 'v60.19 forward return is close to close and null past the end');
  const pairs = Array.from({ length: 400 }, (_, i) => ({ i, date: `d${i}`, score: i % 3 - 1, fwd: Math.sin(i / 9) + (i % 3 - 1) * 0.5 }));
  const stats = harness.spanStats(pairs, 21, { blockSessions: 63, resamples: 200, seed: 7, level: 0.95 });
  const twice = harness.spanStats(pairs, 21, { blockSessions: 63, resamples: 200, seed: 7, level: 0.95 });
  check(JSON.stringify(stats) === JSON.stringify(twice) && stats.labels.buy.vsAll.ci?.length === 2, 'v60.19 the bootstrap is seeded and gives an interval');
  check(stats.labels['2'].cases === 0 && stats.labels['2'].hitRate === null && stats.labels['2'].level === 'thin', 'v60.19 a label with no cases shows no rate');
  check(stats.labels.buy.cases === harness.nonOverlapping(pairs.filter((p) => p.score > 0).map((p) => p.i), 21).length, 'v60.19 cases are the non-overlapping count');
  // Judgement: no study is NOT_RUN; a study whose held-out buy side has 29 cases does not pass that side.
  const criteria = harness.loadCriteria();
  check(judgeMarketLean(null, criteria).status === 'NOT_RUN', 'v60.19 no lean study judges NOT_RUN');
  const labels = (cases, lo, hi, point) => ({ buy: { cases, vsAll: { point, ci: [lo, hi] } }, defend: { cases, vsAll: { point: -point, ci: [-hi, -lo] } } });
  const study = (cases) => ({ generatedAt: 'x', methodology: { ruleVersion: 'market-lean.v1', leanRules: lean.LEAN_RULES, axesReconstructed: ['trend', 'volatility', 'rates', 'commodities'], interval: criteria.interval, split: { heldOutFraction: criteria.heldOutFraction, embargoSessions: criteria.embargoSessions } },
    horizons: { h21: { heldOut: { labels: labels(cases, 0.2, 1.1, 0.6) }, inSample: { labels: labels(80, 0.1, 0.9, 0.5) }, all: { base: { hitRate: 64 }, labels: { 1: { hitRate: 70, cases: 90 } } } } } });
  const pass = judgeMarketLean(study(30), criteria), short = judgeMarketLean(study(29), criteria);
  check(pass.status === 'PASS' && pass.frequencies['1']?.n === 90 && short.status === 'FAIL' && !short.directions.buy, `v60.19 held-out cases gate: ${pass.status}/${short.status}`);
  check(judgeMarketLean({ ...study(40), methodology: { ...study(40).methodology, axesReconstructed: ['trend', 'rates', 'volatility'] } }, criteria).status === 'FAIL', 'v60.19 three axes do not pass');
  // Review v60.19 A5: the risk criterion is registered as pre-registered (2026-11-15 09:33 UTC) and judged like the direction.
  const gatesModule = await import('./build-validation-gates.mjs');
  const { buildValidationGates } = gatesModule;
  check(typeof gatesModule.judgeMarketLeanRisk === 'function', 'review v60.19 build-validation-gates.mjs judges the risk study (judgeMarketLeanRisk)');
  const judgeMarketLeanRisk = gatesModule.judgeMarketLeanRisk || (() => ({ status: 'MISSING', checks: {}, blockers: [] }));
  const allCriteria = JSON.parse(readFileSync(path.join(ROOT, 'architecture/validation-gate-criteria.json'), 'utf8'));
  const riskSpec = allCriteria.marketLeanRisk;
  check(riskSpec?.horizon === 21 && riskSpec.drawdownPct === -5 && riskSpec.groups?.lowBurden === 0 && riskSpec.groups?.highBurdenMin === 2 && riskSpec.minEffectiveN === 30
    && riskSpec.heldOutFraction === 0.3333 && riskSpec.embargoSessions === 21 && ['blockSessions', 'resamples', 'seed', 'level'].every((key) => riskSpec.interval?.[key] === criteria.interval[key]) && riskSpec.pass?.length === 3,
    `review v60.19 the risk criterion is the pre-registered one: ${JSON.stringify(riskSpec)?.slice(0, 300)}`);
  const riskHarness = await import('./backtest-market-lean-risk.mjs');
  const riskStudy = (ci, cases = [48, 41], points = [17.6, 19.88, 9.06]) => ({ generatedAt: 'x', methodology: { ruleVersion: 'market-lean.v1', leanRules: lean.LEAN_RULES, interval: criteria.interval,
    primary: { horizon: riskHarness.PRIMARY.horizon, drawdownPct: riskHarness.PRIMARY.drawdownAt, lowBurden: 0, highBurdenMin: 2 }, split: { heldOutFraction: criteria.heldOutFraction, embargoSessions: criteria.embargoSessions } },
    horizons: { h21: { heldOut: { from: '2020-08-03', to: '2026-10-14', burden: { high: { cases: cases[0] }, low: { cases: cases[1] } }, diffHighMinusLow: { point: 11.2, ci } },
      firstTwoThirds: { diffHighMinusLow: { point: points[0] } }, halfA: { diffHighMinusLow: { point: points[1] } }, halfB: { diffHighMinusLow: { point: points[2] } } } } });
  const failed = judgeMarketLeanRisk(riskStudy([-1.31, 23.9]), riskSpec);
  check(judgeMarketLeanRisk(null, riskSpec).status === 'NOT_RUN' && failed.status === 'FAIL' && failed.checks.heldOutLowerAboveZero === false && Object.entries(failed.checks).every(([k, ok]) => ok === (k !== 'heldOutLowerAboveZero'))
    && judgeMarketLeanRisk(riskStudy([0.4, 23.9]), riskSpec).status === 'PASS' && judgeMarketLeanRisk(riskStudy([0.4, 23.9], [29, 41]), riskSpec).status === 'FAIL'
    && judgeMarketLeanRisk(riskStudy([0.4, 23.9], undefined, [17.6, 19.88, -0.1]), riskSpec).status === 'FAIL'
    && judgeMarketLeanRisk({ ...riskStudy([0.4, 23.9]), methodology: { ...riskStudy([0.4, 23.9]).methodology, primary: { horizon: 21, drawdownPct: -8, lowBurden: 0, highBurdenMin: 2 } } }, riskSpec).blockers.includes('method-differs-from-criterion'),
    `review v60.19 the risk verdict: none NOT_RUN, the 11/15 numbers FAIL on the held-out interval only, cases/half/method gates (${JSON.stringify(failed.checks)})`);
  const gates = buildValidationGates({ criteria: allCriteria, leanRisk: riskStudy([-1.31, 23.9]) }).modelValidation.marketLean;
  check(gates.status === 'NOT_RUN' && gates.risk?.status === 'FAIL' && String(lean.countRiskNote?.(lean.leanValidation({ marketLean: gates })) || '').includes('2020~2026년 검증 구간에서'),
    `review v60.19 the gate file carries marketLean.risk and the fold reads it (${JSON.stringify(gates.risk?.heldOut)})`);
  // The weekly workflow runs the risk study beside the direction study, both optional to the judge (B3), and judges it.
  const workflow = readFileSync(path.join(ROOT, '.github/workflows/research-backtest.yml'), 'utf8');
  const stepOf = (name) => workflow.split(/\n(?=      - name: )/).find((step) => step.startsWith(`      - name: ${name}`)) || '';
  const leanStep = stepOf('Run market lean backtest'), riskStep = stepOf('Run market lean risk backtest'), judgeStep = stepOf('Judge validation gates from the backtest');
  check(/backtest-market-lean-risk\.mjs/.test(riskStep) && /continue-on-error: true/.test(leanStep) && /continue-on-error: true/.test(riskStep) && /--lean-risk/.test(judgeStep) && /::warning/.test(workflow),
    'review v60.19 research-backtest runs the risk study, keeps both lean studies optional to the judge with a visible warning, and passes --lean-risk');
}

if (failures.length) {
  console.error(`market lean validation check: FAIL (${failures.length})\n- ${failures.slice(0, 30).join('\n- ')}`);
  process.exit(1);
}
console.log(`market lean validation check: PASS (${surfaces} lean surfaces under 6 verdicts, published lean verdict ${publishedStatus}; harness unit checks on the 2026-07 replay window)`);
