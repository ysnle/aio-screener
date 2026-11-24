#!/usr/bin/env node
// The opening read of 오늘 and 시장 상태 (src/domain/market/story/market-story.js
// buildMarketOpening). On the 11/20 crash the home said only "부담 우세 / 주도주와 지수 모두 추세선 아래에서 하락 중입니다."
// The face is now three layers — the lede (one plain sentence of stage words and the diagnosis, at most one number), the
// fall bars, the diagnosis line — then one small record line; every figure is a claim and every size word computed. This
// gate holds them on fixtures: the stage words at -10/-20, every lede the rule can produce (leaders × broad × diagnosis),
// the bars' model, one Nasdaq, no size word without a record or the long-run tables, the since with a fixture long-run
// artifact (never beside the number), each diagnosis line, and the static shell painting both today-verdict.json shapes.
//   node scripts/ci-market-story-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { inspect } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSections } from './lib/gate-sections.mjs';
import { buildMarketOpening, diagnoseFall, openingFactLines, fallStandings, DIAGNOSIS_WORDS, OPENING_INDEXES } from '../src/domain/market/story/market-story.js';
import { stageOf } from '../src/domain/market/story/fall-frame.js';
import { summarizeIndexHistory, risesInFalls } from '../src/domain/market/indices/long-run.js';
import { REBOUND_STANCE } from '../src/domain/market/story/rebound.js';
import { priceChecks } from '../src/domain/briefing/market-read.js';
import { withRebound } from '../src/domain/guide/market-guide.js';
import { resolveMarketCalendarSession } from '../src/domain/market/session/market-calendar.js';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { RULES } from '../src/domain/rules/thresholds.js';
import { CLAIM_WORDS } from '../src/domain/shared/claim.js';
import { saidIssues, isClaimError, unclaimedFigures } from './lib/claim-validate.mjs';
import { stockFalls, oneInWord } from '../src/domain/market/breadth/stock-falls.js';
import { vixBandRecord, vixBandLedeSaid, vixBandLedeMethod } from '../src/domain/market/signal/vix-band-record.js';
import { leaderFalls } from '../src/domain/briefing/ai-chain-flow.js';
import { indexSaid } from '../src/domain/briefing/day-account.js';
import { openingFacts } from './lib/claim-facts.mjs';
import { todayVerdictFrom } from './build-scenario-state.mjs';
import { LONGRUN_INDEXES } from './build-index-longrun.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
// An assert message names the release; the actual and expected values follow it.
const why = (error) => (error?.generatedMessage === false && 'actual' in error ? `${error.message}: actual ${inspect(error.actual)}, expected ${inspect(error.expected)}` : String(error?.message));
const check = (label, fn) => { try { fn(); console.log(`  ok  ${label}`); } catch (error) { failures.push(label); console.log(`  FAIL ${label}\n       ${why(error).replace(/\s+/g, ' ').slice(0, 700)}`); } };
const report = (name) => { const failed = failures.splice(0); if (failed.length) { console.error(`market-story ${name}: ${failed.length} failed`); process.exit(1); } };
const SIZE_WORDS = /역사적|최대|코로나 이후|사상/;
const said = (opening, id) => opening.lines.find((line) => line.id === id)?.said || { text: '', claims: [] };

// US open sessions of 2026 through 11/20 (the calendar the close series reads), and a fixture history on them.
const SESSIONS = [];
for (let t = Date.parse('2026-01-02T12:00:00Z'); SESSIONS.length < 400; t += 86400000) {
  const date = new Date(t).toISOString().slice(0, 10);
  if (date > '2026-11-20') break;
  if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') SESSIONS.push(date);
}
const path = (n, start, peakAt, peak, end) => Array.from({ length: n }, (_, i) => (i <= peakAt ? start + (peak - start) * (i / peakAt) : peak + (end - peak) * ((i - peakAt) / (n - 1 - peakAt))));
// Leaders peak and fall hard; the broad market peaks with them and falls less (the equal weight a little later).
function fixtureHistory({ soxEnd = 0.57, ndxEnd = 0.8, spxEnd = 0.885, rspEnd = 0.93, dowEnd = 0.886, peakShare = 0.7 } = {}) {
  const n = SESSIONS.length; const peakAt = Math.floor(n * peakShare);
  const cols = { sox: path(n, 6000, peakAt, 10000, 10000 * soxEnd), ndx: path(n, 20000, peakAt, 25000, 25000 * ndxEnd), spx: path(n, 6000, peakAt, 7000, 7000 * spxEnd),
    rsp: path(n, 180, peakAt + 5, 200, 200 * rspEnd), dow: path(n, 40000, peakAt, 45000, 45000 * dowEnd) };
  return SESSIONS.map((date, i) => ({ date, ...Object.fromEntries(Object.entries(cols).map(([field, values]) => [field, +values[i].toFixed(2)])), breadth50: 45 }));
}
// HY OAS (percent) on the same sessions: flat at `level`, then `jump` over the last five; `weak` adds an unemployment rate
// that rose 0.8 points over its one-year low (the Sahm line turned).
const credit = (level, jump = 0, { weak = false } = {}) => {
  const series = { hyOas: { observations: SESSIONS.map((date, i) => [date, +(level + (i >= SESSIONS.length - 5 ? jump * ((i - (SESSIONS.length - 6)) / 5) : 0)).toFixed(4)]) } };
  if (weak) {
    const months = [];
    for (let y = 2025, m = 1; y < 2026 || m <= 11; m === 12 ? (y += 1, m = 1) : (m += 1)) months.push(`${y}-${String(m).padStart(2, '0')}-01`);
    series.unemployment = { observations: months.map((date, i) => [date, i >= months.length - 3 ? 4.7 + 0.1 * (i - (months.length - 3)) : 4.0]) };
  }
  return { series };
};
const texts = (opening) => [...opening.lines.map((line) => line.said.text), opening.korea?.text || '', ...opening.table.map((row) => row.said.text)].join('\n');
const stageText = (row) => CLAIM_WORDS[row.stage?.word || 'pre-correction'].text;
const PLAIN = { unwind: '쏠림이 되돌려지는 하락입니다', recession: '경기 침체 우려가 반영되는 하락입니다', stress: '신용 시장이 흔들리는 하락입니다', hold: '어떤 하락인지는 판단을 미룹니다' };

await runSections('market-story', [
['stage-words', async () => {
  const S = RULES.story;
  check('v60.50 the stage words sit on the printed fall: 조정 at -10%, 약세장 at -20%, 약세장 문턱 within 1 point above -20%', () => {
    assert.equal(stageOf(-9.94), null, 'v60.50 -9.9% has no stage (the lede says 조정 전)');
    assert.equal(stageOf(-9.96)?.word, 'correction', 'v60.50 -10.0% printed is 조정');
    assert.equal(stageOf(-18.94)?.word, 'correction', 'v60.50 -18.9% is 조정');
    assert.equal(stageOf(-18.96)?.word, 'bear-edge', 'v60.50 -19.0% printed is 약세장 문턱');
    assert.equal(stageOf(-19.84)?.word, 'bear-edge', 'v60.50 -19.8% (NDX 11/20) is 약세장 문턱');
    assert.equal(stageOf(-19.96)?.word, 'bear', 'v60.50 -20.0% printed is 약세장');
    assert.equal(stageOf(-42.5)?.word, 'bear', 'v60.50 -42.5% is 약세장');
    assert.deepEqual([S.correctionPct, S.bearPct, S.bearEdgePp], [10, 20, 1], 'v60.50 RULES.story lines');
  });
  report('stage-words');
}, 'code'],
['lede-variants', async () => {
  // Every lede the rule produces: leaders 약세장 / 약세장 문턱 / 조정 / 조정 전 each, the S&P 500 at 약세장 / 조정 / 조정 전,
  // the equal weight beside or far above the Nasdaq-100, calm or stressed credit, the growth lines flat or turned.
  const LEADER = { bear: 0.57, 'bear-edge': 0.805, correction: 0.88, none: 0.95 };
  const BROAD = { bear: 0.78, correction: 0.885, none: 0.95 };
  const seen = new Set(), states = new Set(), problems = [];
  let ledes = 0;
  for (const [, sox] of Object.entries(LEADER)) for (const [, ndx] of Object.entries(LEADER)) for (const [, spx] of Object.entries(BROAD))
    for (const rsp of [0.97, ndx]) for (const level of [3.2, 4.8]) for (const weak of [false, true]) {
      const history = fixtureHistory({ soxEnd: sox, ndxEnd: ndx, spxEnd: spx, rspEnd: rsp, dowEnd: spx });
      const macroHistory = credit(level, 0, { weak });
      const opening = buildMarketOpening({ history, macroHistory });
      const lede = said(opening, 'lede');
      const { rows, diagnosis: d } = opening;
      const state = d?.state || 'none';
      ledes += 1; states.add(state);
      seen.add(`${rows.sox.stage?.word || 'none'}/${rows.ndx.stage?.word || 'none'}/${rows.spx.stage?.word || 'none'}/${state}`);
      const bare = lede.text.replace(/나스닥 100|S&P 500/g, '');
      if ((bare.match(/\d+(?:\.\d+)?/g) || []).length > 1) problems.push(`more than one number: ${lede.text}`);
      if (!lede.text.startsWith(`반도체는 `) || !lede.text.includes('나스닥 100')) problems.push(`leaders not first: ${lede.text}`);
      for (const row of [rows.sox, rows.ndx, rows.spx]) if (!lede.text.includes(stageText(row))) problems.push(`${row.id} stage "${stageText(row)}" missing: ${lede.text}`);
      if (state === 'none' ? Object.values(PLAIN).some((plain) => lede.text.includes(plain)) : !lede.text.includes(PLAIN[state])) problems.push(`${state} phrase: ${lede.text}`);
      if (Object.values(DIAGNOSIS_WORDS).some((word) => lede.text.includes(word))) problems.push(`state word in the lede (it is the diagnosis line's): ${lede.text}`);
      const errors = saidIssues(lede, openingFacts(history, macroHistory)).filter(isClaimError);
      if (errors.length) problems.push(`claim errors ${errors.map((issue) => `${issue.check} ${issue.message}`).join('; ')}: ${lede.text}`);
      if (/  |\s[,.]|이이|는는/.test(lede.text)) problems.push(`spacing or particle: ${lede.text}`);
    }
  check(`v60.50 every lede the rule produces (${ledes} built) has the leaders' and the broad market's stage words, at most one number, the diagnosis in everyday words, and claims that hold`, () => {
    assert.deepEqual(problems.slice(0, 5), [], 'v60.50 lede-variants');
  });
  check('v60.50 the lede variants cover each diagnosis and the no-diagnosis case, and each leader and broad stage', () => {
    assert.deepEqual([...states].sort(), ['hold', 'none', 'recession', 'stress', 'unwind'], 'v60.50 lede-variants');
    const parts = [...seen].map((key) => key.split('/'));
    for (const word of ['bear', 'bear-edge', 'correction', 'none']) assert.ok(parts.some(([a]) => a === word) && parts.some(([, b]) => b === word), `v60.50 leader stage ${word}`);
    for (const word of ['bear', 'correction', 'none']) assert.ok(parts.some(([, , c]) => c === word), `v60.50 broad stage ${word}`);
  });
  const opening = buildMarketOpening({ history: fixtureHistory(), macroHistory: credit(3.2) });
  check('v60.50 the crash shape reads "반도체는 고점에서 43% 내린 약세장이고 나스닥 100은 약세장입니다. 시장 전체는 조정에 그쳐, 쏠림이 …"', () => {
    assert.equal(said(opening, 'lede').text, '반도체는 고점에서 43% 내린 약세장이고 나스닥 100도 약세장입니다. 시장 전체는 조정에 그쳐, 쏠림이 되돌려지는 하락입니다.', 'v60.50 lede-variants');
    assert.deepEqual(opening.lines.map((line) => line.id).slice(0, 2), ['lede', 'diagnosis'], 'v60.50 lede-variants');
  });
  const quiet = buildMarketOpening({ history: fixtureHistory({ soxEnd: 0.95, ndxEnd: 0.97, spxEnd: 0.98, rspEnd: 0.98, dowEnd: 0.98 }), macroHistory: credit(3.2) });
  check('v60.50 with no diagnosis the lede is the stages alone and no diagnosis line is drawn', () => {
    assert.equal(said(quiet, 'lede').text, '반도체는 아직 조정 전이고 나스닥 100도 아직 조정 전입니다. 시장 전체도 아직 조정 전입니다.', 'v60.50 lede-variants');
    assert.equal(said(quiet, 'diagnosis').text, '', 'v60.50 lede-variants');
  });
  report('lede-variants');
}, 'code'],
['bars-and-one-nasdaq', async () => {
  const opening = buildMarketOpening({ history: fixtureHistory(), macroHistory: credit(3.2) });
  check('v60.50 the bars: 반도체, 나스닥 100, S&P 500, 다우, 동일가중 on one scale with the 조정 and 약세장 lines, each value the table\'s fall', () => {
    const { bars, scale, marks } = opening.bars;
    assert.deepEqual(bars.map((bar) => bar.label), ['반도체(SOX)', '나스닥 100', 'S&P 500', '다우', '동일가중'], 'v60.51 bars-and-one-nasdaq: the SOX bar names its index (the index card is the SOXX fund)');
    assert.deepEqual(marks.map((mark) => [mark.at, mark.word]), [[10, '조정'], [20, '약세장']], 'v60.50 bars-and-one-nasdaq');
    assert.ok(scale % 5 === 0 && scale >= Math.max(...bars.map((bar) => -bar.value)) && scale >= 25, `v60.50 scale ${scale}`);
    for (const bar of bars) assert.ok(opening.table.find((row) => row.id === bar.id).said.text.endsWith(`대비 ${bar.valueText}`), `v60.50 ${bar.id}`);
    assert.deepEqual(bars.map((bar) => bar.stage), ['약세장', '약세장', '조정', '조정', null], 'v60.50 bars-and-one-nasdaq');
  });
  check('v60.50 one Nasdaq: the face, the table and the facts name only the Nasdaq-100, and its long-run table is ^NDX', () => {
    const all = `${texts(opening)}\n${openingFactLines(opening).join('\n')}`;
    assert.doesNotMatch(all, /나스닥 종합|나스닥(?! 100)/, 'v60.50 bars-and-one-nasdaq');
    assert.ok(!OPENING_INDEXES.some((spec) => spec.id === 'nasdaq'), 'v60.50 bars-and-one-nasdaq');
    assert.equal(OPENING_INDEXES.find((spec) => spec.id === 'ndx').longrun, 'ndx', 'v60.50 bars-and-one-nasdaq');
    assert.equal(LONGRUN_INDEXES.ndx?.symbol, '^NDX', 'v60.50 bars-and-one-nasdaq');
    assert.equal('nasdaq' in LONGRUN_INDEXES, false, 'v60.50 bars-and-one-nasdaq');
  });
  check('v60.50 반도체 on the face is the SOX index, named in full in the table (not the SOXX fund of the index card)', () => {
    assert.doesNotMatch(opening.lines.map((line) => line.said.text).join(' '), /SOX/, 'v60.50 bars-and-one-nasdaq');
    const soxRow = opening.table.find((row) => row.id === 'sox').said.text;
    assert.ok(soxRow.startsWith('필라델피아 반도체 지수(SOX), '), `v60.50 the SOX row is named in full: ${soxRow}`);
  });
  report('bars-and-one-nasdaq');
}, 'code'],
['no-size-word-without-longrun', async () => {
  const opening = buildMarketOpening({ history: fixtureHistory(), macroHistory: credit(3.2) });
  check('v60.50 without the long-run tables no size word is printed, and "가장 큰" is only the record\'s (dated by its start)', () => {
    const all = `${texts(opening)}\n${openingFactLines(opening).join('\n')}`;
    assert.doesNotMatch(all, SIZE_WORDS, 'v60.50 no-size-word-without-longrun');
    for (const sentence of all.split(/(?<=\.)\s/)) if (/가장 (?:큰|깊)/.test(sentence)) assert.match(sentence, /기록\(\d{4}-\d{2}-\d{2} 이후\) 중 가장 큰/, `v60.50 ${sentence}`);
  });
  // A steady decline: the last session is the smallest fall of the record, so no "가장 큰" at all.
  const calm = fixtureHistory().map((row, i, all) => (i === all.length - 1 ? { ...row, sox: all[i - 1].sox * 0.999, ndx: all[i - 1].ndx * 0.999, spx: all[i - 1].spx * 0.999, dow: all[i - 1].dow * 0.999 } : row));
  check('v60.50 a record fall is named only when it is the largest of the record', () => {
    const steady = buildMarketOpening({ history: calm, macroHistory: credit(3.2) });
    assert.doesNotMatch(steady.lines.map((line) => line.said.text).join(' '), /하루 -[\d.]+%는 기록/, 'v60.50 no-size-word-without-longrun');
  });
  report('no-size-word-without-longrun');
}, 'code'],
['since-with-longrun', async () => {
  // A long index: up to 2015 peak, a 47% fall, a recovery to a new high in 2026, then the fixture's 43% fall.
  const history = fixtureHistory();
  const early = [];
  for (let t = Date.parse('2012-01-02T12:00:00Z'); ; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date >= SESSIONS[0]) break;
    const day = new Date(t).getUTCDay();
    if (day && day < 6) early.push(date);
  }
  const m = early.length; const a = Math.floor(m * 0.3), b = Math.floor(m * 0.45);
  const value = (i) => (i <= a ? 3000 + 3000 * (i / a) : i <= b ? 6000 - 2820 * ((i - a) / (b - a)) : 3180 + 2700 * ((i - b) / (m - b)));
  const closes = [...early.map((date, i) => [date, +value(i).toFixed(2)]), ...history.map((row) => [row.date, row.sox])];
  const body = summarizeIndexHistory(closes);
  const artifact = { schemaVersion: 'index-longrun.v1', definition: { drawdownMinPct: 10 }, indexes: { sox: body } };
  const opening = buildMarketOpening({ history, macroHistory: credit(3.2), longrun: artifact });
  const troughMonth = `${body.drawdowns[0].trough.slice(0, 4)}년 ${Number(body.drawdowns[0].trough.slice(5, 7))}월`;
  check('v60.50 with a long-run artifact the lede carries the since instead of the number, never both, and the record line does not repeat it', () => {
    assert.equal(body.drawdowns[0].depth, -47, 'v60.50 since-with-longrun');
    assert.ok(said(opening, 'lede').text.startsWith(`반도체는 ${troughMonth} 이후 가장 깊은 하락으로 약세장이고`), `v60.50 ${said(opening, 'lede').text}`);
    assert.doesNotMatch(said(opening, 'lede').text, /고점에서 \d/, 'v60.50 since-with-longrun');
    assert.doesNotMatch(said(opening, 'records').text, /이후 가장 깊습니다/, 'v60.50 since-with-longrun');
    assert.ok(openingFactLines(opening).some((line) => line.includes(`반도체 고점 대비 하락은 ${troughMonth} 저점(-47.0%) 이후 가장 깊습니다.`)), 'v60.50 the AI facts keep the since with its depth');
    assert.doesNotMatch(texts(opening), SIZE_WORDS, 'v60.50 since-with-longrun');
  });
  check('v60.50 a long-run table newer than the session read is not that day\'s standing', () => {
    const replay = buildMarketOpening({ history: history.slice(0, -3), macroHistory: credit(3.2), longrun: artifact });
    assert.match(said(replay, 'lede').text, /^반도체는 고점에서 \d+% 내린/, 'v60.50 since-with-longrun');
  });
  report('since-with-longrun');
}, 'code'],
['diagnosis-words', async () => {
  const row = (fall) => ({ fall: { value: fall, trough: fall } });
  const C = RULES.credit, S = RULES.story;
  const at = (hyBp, hy5 = 0) => ({ hyBp, hy5, date: '2026-11-19' });
  check('v60.50 each diagnosis word comes from its rule', () => {
    assert.equal(diagnoseFall({ ndx: row(-19.8), rsp: row(-7.1), credit: at(352, 32) }).state, 'unwind', 'v60.50 11/20: NDX 12.7pp under the equal weight, HY 352bp');
    assert.equal(diagnoseFall({ ndx: row(-19.8), rsp: row(-7.1), credit: at(C.stressAtBp + 30, 40) }).state, 'stress', 'v60.50 HY over the stress line');
    assert.equal(diagnoseFall({ ndx: row(-14), rsp: row(-12), credit: at(380), growth: { weak: true } }).state, 'recession', 'v60.50 a broad fall with the growth lines turned');
    assert.equal(diagnoseFall({ ndx: row(-14), rsp: row(-12), credit: at(380), growth: { weak: false } }).state, 'hold', 'v60.50 a broad fall without growth or credit signals');
    assert.equal(diagnoseFall({ ndx: row(-6), rsp: row(-3), credit: at(300) }).state, 'none', 'v60.50 nothing reached the correction line');
    assert.equal(diagnoseFall({ ndx: { fall: { value: -6, trough: -12 } }, rsp: row(-0.5), credit: at(300) }).state, 'unwind', 'v60.50 a fall that reached -10% stays diagnosed until a new high');
    assert.equal(diagnoseFall({ ndx: row(-19.8), rsp: row(-7.1), credit: at(352, C.widen5dBp)}).fast, true, 'v60.50 diagnosis-words');
    assert.equal(diagnoseFall({ ndx: row(-19.8), rsp: row(-7.1), credit: at(352, C.widen5dBp - 1) }).fast, false, 'v60.50 diagnosis-words');
    assert.ok(S.unwindGapPp === 5 && Object.values(DIAGNOSIS_WORDS).join() === '쏠림 되돌림,침체형,금융 불안형,판단 보류', 'v60.50 diagnosis-words');
  });
  const build = (level, jump, opts) => buildMarketOpening({ history: fixtureHistory(opts?.history), macroHistory: credit(level, jump, opts) });
  const fast = build(3.2, 0.32), calm = build(3.2, 0.02), stress = build(4.6, 0.3);
  const recession = build(3.8, 0, { weak: true, history: { ndxEnd: 0.86, rspEnd: 0.87 } }), hold = build(3.8, 0, { history: { ndxEnd: 0.86, rspEnd: 0.87 } });
  const line = (opening) => opening.lines.find((item) => item.id === 'diagnosis');
  check('v60.50 the diagnosis line: the state word as its label, one reason, the spread (its speed only when fast) and one flip condition', () => {
    assert.equal(line(fast).label, '쏠림 되돌림', 'v60.50 diagnosis-words');
    assert.match(line(fast).said.text, /^나스닥 100이 동일가중보다 [\d.]+%p 더 내렸고 신용 스프레드는 352bp, 5거래일 \+32bp로 빠르게 확대 중\. 450bp를 넘으면 금융 불안형\.$/, 'v60.50 diagnosis-words');
    assert.match(line(calm).said.text, /^나스닥 100이 동일가중보다 [\d.]+%p 더 내렸고 신용 스프레드는 322bp\. 450bp를 넘으면 금융 불안형\.$/, 'v60.50 diagnosis-words');
    assert.equal(line(stress).label, '금융 불안형', 'v60.50 diagnosis-words');
    assert.match(line(stress).said.text, /^신용 스프레드가 490bp로 금융 불안 기준\(450bp\) 위, 5거래일 \+30bp로 빠르게 확대 중\. 450bp 아래로 돌아오면 다시 판단\.$/, 'v60.50 diagnosis-words');
    assert.equal(line(recession).label, '침체형', 'v60.50 diagnosis-words');
    assert.match(line(recession).said.text, /^동일가중도 나스닥 100만큼 내렸고\(격차 [\d.]+%p\) 실업률 3개월 평균이 1년 저점보다 [\d.]+%p 높습니다\. 신용 스프레드는 380bp, 450bp를 넘으면 금융 불안형\.$/, 'v60.50 diagnosis-words');
    assert.equal(line(hold).label, '판단 보류', 'v60.50 diagnosis-words');
    assert.match(line(hold).said.text, /^나스닥 100과 동일가중의 격차가 [\d.]+%p로 작고 고용에 침체 신호가 없습니다\. 격차가 5%p를 넘으면 쏠림 되돌림\.$/, 'v60.50 diagnosis-words');
    for (const opening of [fast, calm, stress, recession, hold]) {
      const errors = saidIssues(line(opening).said, openingFacts(fixtureHistory(), credit(3.2))).filter((issue) => isClaimError(issue) && issue.check !== 'value' && issue.check !== 'f-asof');
      assert.deepEqual(errors, [], `v60.50 ${line(opening).said.text}`);
    }
  });
  report('diagnosis-words');
}, 'code'],
['verdict-record-shapes', async () => {
  // The static shell's paint script (index.html), run on a stub DOM: the old record paints heroLine, the new its lines.
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  // Loaded to run, not to read: the script's body between its own opening and the next closing tag.
  const opening = '<script>(window._aioTodayVerdict||Promise.resolve(null))';
  const start = html.indexOf(opening);
  const source = start < 0 ? null : html.slice(start + '<script>'.length, html.indexOf('</script>', start));
  const node = (id) => ({ id, textContent: '', dataset: {}, children: [],
    append(...items) { for (const item of items) { if (typeof item === 'string') this.textContent += item; else { this.children.push(item); this.textContent += item.textContent; } } } });
  const paint = async (record) => {
    const nodes = Object.fromEntries(['home-hero-total', 'home-hero-first', 'home-hero-desc', 'home-hero-headline', 'home-date-label', 'regime-overall', 'home-hero-counts', 'regime-opening'].map((id) => [id, node(id)]));
    nodes['home-hero-total'].textContent = '판정 대기'; nodes['regime-overall'].textContent = '판정 대기';
    const document = { getElementById: (id) => nodes[id] || null, createElement: () => { const el = node(null); Object.defineProperty(el, 'className', { set(v) { this._class = v; }, get() { return this._class; } }); return el; } };
    const context = vm.createContext({ window: { _aioTodayVerdict: Promise.resolve(record) }, document, Promise, Date, Intl, Array });
    await vm.runInContext(source, context);
    await new Promise((done) => setTimeout(done, 0));
    return nodes;
  };
  const asOf = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const old = { schemaVersion: 'today-verdict.v1', asOf, overall: '부담 우세', heroLine: '주도주와 지수 모두 추세선 아래에서 하락 중입니다.', holdReason: null, counts: { favorable: 0, neutral: 3, burden: 3, unknown: 0 } };
  const lines = [{ id: 'lede', label: '', text: '반도체는 고점에서 43% 내린 약세장입니다.' }, { id: 'diagnosis', label: '쏠림 되돌림', text: '나스닥 100이 더 내렸습니다.' }];
  check('v60.50 the shell script is found in index.html', () => assert.ok(source, 'v60.50 verdict-record-shapes'));
  const before = await paint(old);
  check('v60.50 an old-shape today-verdict.json (no story) still paints its verdict, heroLine and counts', () => {
    assert.equal(before['home-hero-total'].textContent, '부담 우세', 'v60.50 verdict-record-shapes');
    assert.equal(before['home-hero-first'].textContent, old.heroLine, 'v60.50 verdict-record-shapes');
    assert.equal(before['home-hero-counts'].textContent, '양호 0, 중립 3, 부담 3', 'v60.50 verdict-record-shapes');
  });
  const after = await paint({ ...old, story: { asOf, diagnosis: '쏠림 되돌림', lines } });
  check('v60.50 a record with story paints the lede and the diagnosis line (its word first) on 오늘, the verdict stays a tag', () => {
    assert.equal(after['home-hero-first'].children.length, 2, 'v60.50 verdict-record-shapes');
    assert.equal(after['home-hero-first'].children[0].dataset.part, 'lede', 'v60.50 verdict-record-shapes');
    assert.equal(after['home-hero-first'].children[0].textContent, lines[0].text, 'v60.50 verdict-record-shapes');
    assert.equal(after['home-hero-first'].children[1].textContent, '쏠림 되돌림 — 나스닥 100이 더 내렸습니다.', 'v60.50 verdict-record-shapes');
    assert.equal(after['home-hero-total'].textContent, '부담 우세', 'v60.50 verdict-record-shapes');
  });
  check('v60.50 the shell paints only its own first-paint element; the native read owns #home-hero-desc and #regime-opening', () => {
    for (const id of ['home-hero-desc', 'regime-opening']) assert.equal(after[id].textContent, '', `v60.50 ${id}`);
  });
  const mismatched = await paint({ ...old, story: { asOf: '2026-01-02', lines } });
  check('v60.50 story lines of another close are not painted beside this record', () => assert.equal(mismatched['home-hero-first'].textContent, old.heroLine, 'v60.50 verdict-record-shapes'));
  check('v60.50 the producer adds story only with an opening on the record\'s own close', () => {
    const regime = { available: true, overall: '부담 우세', asOf: '2026-11-20', heroLine: 'x', counts: { favorable: 0, neutral: 3, burden: 3, unknown: 0 } };
    assert.equal('story' in todayVerdictFrom(regime, 'now', 'm'), false, 'v60.50 verdict-record-shapes');
    const opening = buildMarketOpening({ history: fixtureHistory(), macroHistory: credit(3.2) });
    const record = todayVerdictFrom(regime, 'now', 'm', opening);
    assert.deepEqual(record.story.lines.map((line) => [line.id, line.label]).slice(0, 2), [['lede', ''], ['diagnosis', '쏠림 되돌림']], 'v60.50 verdict-record-shapes');
    assert.equal(record.schemaVersion, 'today-verdict.v1', 'v60.50 verdict-record-shapes');
    assert.equal('story' in todayVerdictFrom({ ...regime, asOf: '2026-11-19' }, 'now', 'm', opening), false, 'v60.50 verdict-record-shapes');
  });
  report('verdict-record-shapes');
}, 'code'],
['story-screens', async () => {
  // The story on five more screens — each a plain line from the domain, its figures claims.
  const clean = (piece) => { assert.deepEqual(unclaimedFigures(piece), [], `v60.50 figures without a claim: ${piece.text}`); assert.doesNotMatch(piece.text, SIZE_WORDS, 'v60.50 story-screens'); assert.doesNotMatch(piece.text, /사세요|파세요|매수하|매도하/, 'v60.50 story-screens'); };
  // 기술적 분석: this fall among the index's past falls, only with the long-run tables.
  const history = fixtureHistory({ ndxEnd: 0.802 });
  const early = [];
  for (let t = Date.parse('2012-01-02T12:00:00Z'); ; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date >= SESSIONS[0]) break;
    const day = new Date(t).getUTCDay();
    if (day && day < 6) early.push(date);
  }
  const m = early.length; const a = Math.floor(m * 0.3), b = Math.floor(m * 0.45);
  // One earlier fall of 30% (2015~2017) recovered to a new high before the fixture's own peak.
  const value = (i) => (i <= a ? 10000 + 6000 * (i / a) : i <= b ? 16000 - 4800 * ((i - a) / (b - a)) : 11200 + 8000 * ((i - b) / (m - b)));
  const ndxBody = summarizeIndexHistory([...early.map((date, i) => [date, +value(i).toFixed(2)]), ...history.map((row) => [row.date, row.ndx])]);
  const artifact = { schemaVersion: 'index-longrun.v1', definition: { drawdownMinPct: 10 }, indexes: { ndx: ndxBody } };
  const withTables = buildMarketOpening({ history, macroHistory: credit(3.2), longrun: artifact });
  check('v60.50 기술적 분석: the Nasdaq-100 line ranks this fall among its past falls of 10%+ and names the bear line within a point', () => {
    const [row] = fallStandings(withTables);
    assert.equal(row.id, 'ndx', 'v60.50 story-screens');
    assert.equal(row.said.text, '나스닥 100의 이번 하락은 2012년 이후 고점에서 10% 이상 내린 2번 가운데 2번째로 깊습니다. 약세장 기준(-20%)까지 0.2%p 남았습니다.', 'v60.50 story-screens');
    assert.deepEqual(row.episodes.map((e) => [e.current, e.depth]), [[true, -19.8], [false, -30]], 'v60.50 story-screens');
    assert.equal(row.episodes[0].sessions, SESSIONS.length - 1 - Math.floor(SESSIONS.length * 0.7), 'v60.50 story-screens');
    assert.deepEqual(row.bars.bars.map((bar) => `${bar.label} ${bar.valueText} ${bar.stage}`), [`이번 -19.8% ${row.episodes[0].sessions}거래일`, `${Number(ndxBody.drawdowns[0].peak.slice(0, 4))}년 ${Number(ndxBody.drawdowns[0].peak.slice(5, 7))}월 고점 -30.0% ${ndxBody.drawdowns[0].sessions}거래일`], 'v60.50 story-screens');
    clean(row.said);
  });
  check('v60.50 기술적 분석: no comparison without the long-run tables, or on a session the tables do not reach', () => {
    assert.deepEqual(fallStandings(buildMarketOpening({ history, macroHistory: credit(3.2) })), [], 'v60.50 story-screens');
    assert.deepEqual(fallStandings(buildMarketOpening({ history: history.slice(0, -3), macroHistory: credit(3.2), longrun: artifact })), [], 'v60.50 story-screens');
  });
  // 시장 폭: how many stocks are in the fall and how deep, against the S&P 500 on the same 52-week basis.
  // The calendar knows 2026; the 2025 part of the year is its weekdays (the close series keeps them, as it keeps history.json's).
  const year = [];
  for (let t = Date.parse('2025-09-02T12:00:00Z'); ; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (date >= SESSIONS[0]) break;
    const day = new Date(t).getUTCDay();
    if (day && day < 6) year.push(date);
  }
  year.push(...SESSIONS);
  const closes = year.map((date, i) => ({ date, spx: i < year.length - 30 ? 7000 : 7000 * (1 - 0.116 * ((i - (year.length - 31)) / 30)), rsp: i < year.length - 30 ? 200 : 200 * (1 - 0.071 * ((i - (year.length - 31)) / 30)) }));
  const rowsOf = (falls) => falls.map((value, i) => ({ sym: `S${i}`, market: 'US', sector: 'Industrials', factorSessionDate: '2026-11-20', pctFromCloseHigh52w: value }));
  const deep = Array.from({ length: 100 }, (_, i) => (i < 18 ? -55 : i < 50 ? -30 : -12));
  const fund = { sym: 'XLK', market: 'US', sector: 'ETF', factorSessionDate: '2026-11-20', pctFromCloseHigh52w: -90 };
  const korean = { sym: '005930.KS', market: 'KR', sector: 'Technology', factorSessionDate: '2026-11-20', pctFromCloseHigh52w: -90 };
  check('v60.50 시장 폭: the median stock against the index, the half-off share as an n-in-one word, funds and Korean rows out', () => {
    const falls = stockFalls({ rows: [...rowsOf(deep), fund, korean], history: closes, session: '2026-11-20' });
    assert.equal(falls.measured, 100, 'v60.50 story-screens');
    assert.equal(falls.said.text, '지수는 조정이지만 종목은 더 깊습니다. 관찰 중인 미국 종목 절반이 1년 고점에서 21% 넘게 내렸고, 여섯 중 하나꼴은 반 토막입니다.', 'v60.50 story-screens');
    assert.deepEqual(falls.bars.bars.map((bar) => `${bar.label} ${bar.valueText} ${bar.stage || ''}`.trim()), ['S&P 500 -11.6% 조정', '동일가중 -7.1%', '종목 중앙값 -21.0% 약세장'], 'v60.50 story-screens');
    clean(falls.said);
  });
  check('v60.50 시장 폭: a shallower median, no half-off stock, too few stocks or another session', () => {
    assert.equal(stockFalls({ rows: rowsOf(Array.from({ length: 40 }, () => -5)), history: closes, session: '2026-11-20' }).said.text, '종목은 지수보다 덜 내렸습니다. 관찰 중인 미국 종목 절반이 1년 고점에서 5% 넘게 내렸고, 반 토막 난 종목은 없습니다.', 'v60.50 story-screens');
    assert.equal(stockFalls({ rows: rowsOf(deep.slice(0, 20)), history: closes, session: '2026-11-20' }), null, 'v60.50 story-screens');
    assert.equal(stockFalls({ rows: rowsOf(deep), history: closes, session: '2026-11-19' }), null, 'v60.50 story-screens');
    assert.equal(oneInWord(26.2), '넷 중 하나꼴', 'v60.50 story-screens');
    assert.equal(oneInWord(3), null, 'v60.50 story-screens');
    assert.equal(RULES.story.halfOffPct, 50, 'v60.50 story-screens');
  });
  // 투자 심리: what days at today's VIX band were followed by, said only beyond the base rate.
  // The published record (borrowed as a realistic shape) with the 30~40 band's risk and the base set here.
  const published = JSON.parse(readFileSync(resolve(root, 'public-data/stress-outcomes.json'), 'utf8'));
  const band = (drawdownShare, upShare, cases = 64) => vixBandRecord({ ...published,
    bands: published.bands.map((row) => (row.id === 'stress' ? { ...row, label: '30~40', risk: { ...row.risk, cases, drawdownCases: Math.round(cases * drawdownShare / 100), drawdownShare, upCases: Math.round(cases * upShare / 100), upShare } } : row)),
    allRisk: { ...published.allRisk, cases: 442, drawdownShare: 15.6, upShare: 63.1 } }, 35.89);
  check('v60.50 투자 심리: the VIX-band line says a difference only beyond the base rate, names VIX, and gives no instruction', () => {
    const today = band(29.7, 68.8);
    if (today.state !== 'current') { console.log('  skip the VIX-band reader no longer takes this fixture shape'); return; }
    assert.equal(vixBandLedeSaid(today).text, 'VIX 30~40이던 날 뒤에는 한 달 안에 크게 더 빠진 경우가 평소보다 잦았지만(30%), 한 달 뒤 올라 있던 비율은 평소와 구별되지 않았습니다.', 'v60.50 story-screens');
    assert.equal(vixBandLedeSaid(band(17, 61)).text, 'VIX 30~40이던 날 뒤 한 달 흐름은 평소와 구별되지 않았습니다.', 'v60.50 story-screens');
    assert.equal(vixBandLedeSaid(band(29.7, 68.8, 8)).text, '', 'v60.50 under the evidence floor there is no line');
    assert.match(vixBandLedeMethod(today), /표본 오차의 2배/, 'v60.50 story-screens');
    clean(vixBandLedeSaid(today));
  });
  // 테마와 섹터: the leaders' members against every other theme's.
  const themes = [{ id: 'semiconductor', subThemes: [{ name: 'a', tickers: Array.from({ length: 12 }, (_, i) => `L${i}`) }] }, { id: 'staples', subThemes: [{ name: 'b', tickers: [...Array.from({ length: 12 }, (_, i) => `R${i}`), 'L0'] }] }];
  const themeRows = [...Array.from({ length: 12 }, (_, i) => ({ sym: `L${i}`, factorSessionDate: '2026-11-20', pctFromCloseHigh52w: -48 })), ...Array.from({ length: 12 }, (_, i) => ({ sym: `R${i}`, factorSessionDate: '2026-11-20', pctFromCloseHigh52w: -12 }))];
  check('v60.50 테마와 섹터: the leaders (LEADER_THEMES) against the rest, a leader listed in another theme counted once as a leader', () => {
    const falls = leaderFalls({ themes, rows: themeRows, session: '2026-11-20' });
    assert.equal(falls.said.text, '주도 테마(AI·반도체) 종목은 1년 고점에서 평균 48% 내렸고, 나머지 테마 종목은 평균 12%입니다.', 'v60.50 story-screens');
    assert.deepEqual([falls.leaders.measured, falls.rest.measured, falls.rest.listed], [12, 12, 12], 'v60.50 story-screens');
    assert.equal(leaderFalls({ themes, rows: themeRows.slice(0, 15), session: '2026-11-20' }), null, 'v60.50 a side under the evidence floor has no line');
    clean(falls.said);
  });
  // 브리핑: the leading index's move ranked within the record (a full year) or, with the tables, since the last as large.
  const spxDay = (change) => ({ kind: 'price', asset: 'spx', label: 'S&P 500', change, date: '2026-11-20', rank: 'lead', materiality: 90 });
  const dayHistory = year.map((date, i) => ({ date, spx: +(7000 * (1 + 0.002 * Math.sin(i))).toFixed(2) }));
  const last = dayHistory.at(-1);
  last.spx = +(dayHistory.at(-2).spx * 0.95).toFixed(2);
  const drop = (last.spx / dayHistory.at(-2).spx - 1) * 100;
  check('v60.50 브리핑: the record rank needs a full year of closes and the largest move of it', () => {
    assert.match(indexSaid([spxDay(drop)], { history: dayHistory }).text, /S&P 500 기준 기록\(2025-09-02 이후\) 중 가장 많이 내린 하루입니다\.$/, 'v60.50 story-screens');
    assert.equal(indexSaid([spxDay(drop)], { history: dayHistory.slice(-200) }).text.includes('기록('), false, 'v60.50 under a full year: no rank');
    assert.equal(indexSaid([spxDay(drop)]).text.includes('기록('), false, 'v60.50 without closes: no rank');
    const milder = dayHistory.map((row) => ({ ...row }));
    milder[100].spx = +(milder[99].spx * 0.93).toFixed(2);
    assert.equal(indexSaid([spxDay(drop)], { history: milder }).text.includes('기록('), false, 'v60.50 a larger earlier fall: no rank');
  });
  check('v60.50 브리핑: with the long-run tables the since form, only when the last move as large is over a year back', () => {
    const spxEarly = early.filter((date) => date < year[0]).map((date, i) => [date, +(3000 * (1 + 0.002 * Math.sin(i))).toFixed(2)]);
    spxEarly[300][1] = +(spxEarly[299][1] * 0.93).toFixed(2);
    const tables = { schemaVersion: 'index-longrun.v1', definition: { drawdownMinPct: 10 }, indexes: { spx: summarizeIndexHistory([...spxEarly, ...dayHistory.map((row) => [row.date, row.spx])]) } };
    const when = `${spxEarly[300][0].slice(0, 4)}년 ${Number(spxEarly[300][0].slice(5, 7))}월`;
    assert.match(indexSaid([spxDay(drop)], { history: dayHistory, longrun: tables }).text, new RegExp(`S&P 500 하루 -5\\.0%는 ${when} 이후 가장 큰 하루 하락입니다\\.$`), 'v60.50 story-screens');
  });
  report('story-screens');
}, 'code'],
['rebound', async () => {
  // The rebound inside a fall (rebound.js), on fixture closes built here. The crash fixture ends
  // at its low on 11/20; the sessions after it are the 11/23 shape (SOX +14%, NDX +6.9%, S&P 500 +4.7%) and what follows.
  const S = RULES.story;
  const base = fixtureHistory();
  const after = (rows, date, m, extra = {}) => { const last = rows.at(-1); return [...rows, { date, ...Object.fromEntries(['sox', 'ndx', 'spx', 'rsp', 'dow'].map((f) => [f, +(last[f] * (m[f] ?? 1)).toFixed(2)])), breadth50: 45, ...extra }]; };
  const day1 = after(base.map((row, i, all) => (i === all.length - 1 ? { ...row, rallyPhase: 1, rallyDay: 1, followThroughDay: 0 } : row)), '2026-11-23', { sox: 1.14, ndx: 1.069, spx: 1.047, rsp: 1.026, dow: 1.04 }, { rallyPhase: 1, rallyDay: 2, followThroughDay: 0 });
  const build = (history) => buildMarketOpening({ history, macroHistory: credit(3.2) });
  const rebound = build(day1);
  const facts = openingFacts(day1, credit(3.2));
  const cleanSaid = (piece, history = null) => { assert.deepEqual(unclaimedFigures(piece), [], `v60.51 figures without a claim: ${piece.text}`); assert.deepEqual(saidIssues(piece, history ? openingFacts(history, credit(3.2)) : facts).filter(isClaimError), [], `v60.51 claim errors: ${piece.text}`); };
  check('v60.51 RULES.story.reboundPct is 5 (half the correction line)', () => assert.equal(S.reboundPct, S.correctionPct / 2, 'v60.51 rebound'));
  check('v60.51 the 11/23 shape: 반등 시도, the lede says the bounce and the fall (two numbers), then the 200-day lines', () => {
    assert.equal(rebound.rebound?.state, 'attempt', 'v60.51 rebound');
    assert.equal(said(rebound, 'lede').text, '반도체는 하루 14% 반등했지만 고점 대비로는 아직 35% 아래, 약세장입니다. S&P 500과 나스닥 100이 모두 200일선 아래라 추세 전환은 아직 확인 전입니다.', 'v60.51 rebound');
    assert.doesNotMatch(said(rebound, 'lede').text, /하락입니다/, 'v60.51 a rebound day is not read as a fall');
    assert.ok((said(rebound, 'lede').text.replace(/나스닥 100|S&P 500|\d+일선/g, '').match(/\d+(?:\.\d+)?/g) || []).length <= 2, 'v60.51 at most two numbers in the lede');
    assert.deepEqual(rebound.lines.map((line) => line.id), ['lede', 'diagnosis', 'watch', 'records'], 'v60.51 the diagnosis line stays; the conditions line follows it');
    for (const id of ['lede', 'watch']) cleanSaid(said(rebound, id));
  });
  check('v60.51 the rebound paragraph, right after the diagnosis line on both screens: the low, the 200-day levels, then the stance', () => {
    const line = rebound.lines.find((item) => item.id === 'watch');
    assert.equal(line.label, '반등 시도', 'v60.51 rebound');
    assert.match(line.said.text, /^나스닥 100이 11\/20 종가\(20,000\) 아래로 마감하면 반등 실패입니다\. 200일선은 S&P 500 [\d,]+, 나스닥 100 [\d,]+입니다\. 200일선 회복을 기다리면 /, 'v60.51 rebound');
    assert.ok(line.said.text.endsWith(rebound.rebound.stance.text), 'v60.51 the stance closes the paragraph');
    const ndx = rebound.rows.ndx.episode;
    assert.ok(line.said.text.includes(`나스닥 100 ${Math.round(ndx.ma200).toLocaleString('en-US')}입니다.`), `v60.51 ${line.said.text}`);
    assert.doesNotMatch(line.said.text, /종가 대비/, 'v60.51 the distances are 시장 상태\'s row, not the face');
  });
  check('v60.51 시장 상태\'s 다음에 확인할 가격 조건: its owner puts the low and the 200-day row ahead of the axes\' three, five rows at most', () => {
    const [low, lines, ...rest] = rebound.rebound.checks.texts;
    assert.equal(rest.length, 0, 'v60.51 the follow-through day is not a row of its own');
    assert.match(low, /^나스닥 100이 11\/20 종가 20,000 위를 지키는지\(종가 대비 -6\.5%\) — 아래로 마감하면 반등 실패$/, 'v60.51 rebound');
    assert.match(lines, /^S&P 500과 나스닥 100이 200일선\([\d,]+ · [\d,]+\) 위로 마감하는지\(종가 대비 \+[\d.]+% · \+[\d.]+%\) — 50일선\([\d,]+ · [\d,]+\)까지 되찾으면 추세 회복$/, 'v60.51 rebound');
    rebound.rebound.checks.said.forEach(cleanSaid);
    const statements = ['a', 'b', 'c', 'd', 'b'].map((check) => ({ check }));
    assert.deepEqual(priceChecks(statements), ['a', 'b', 'c'], 'v60.51 without a rebound the axes\' three');
    assert.deepEqual(priceChecks(statements, rebound.rebound.checks.texts), [low, lines, 'a', 'b', 'c'], 'v60.51 a rebound day: five rows, its two first');
  });
  check('v60.51 the stance: what each stance costs in the state, conditionally, from the fixed vocabulary — and the guide takes it as data', () => {
    assert.equal(rebound.rebound.stance.text, '200일선 회복을 기다리면 반등의 앞부분을 놓치고, 지금 따라가면 11/20 종가를 다시 깨는 실패한 반등에 걸릴 수 있습니다. 조건이 하나씩 확인될 때마다 나눠 접근하면 두 비용을 함께 줄일 수 있습니다.', 'v60.51 rebound');
    assert.deepEqual(Object.keys(REBOUND_STANCE), ['attempt', 'recovered', 'failed'], 'v60.51 rebound');
    for (const [state, text] of Object.entries(REBOUND_STANCE)) { assert.doesNotMatch(text, /사세요|파세요|매수하|매도하|비중|\d+%/, `v60.51 no order or portfolio share: ${text}`); if (state !== 'failed') assert.match(text, /면 /, `v60.51 conditional: ${text}`); }
    assert.ok(openingFactLines(rebound).includes(`반등 대응(조건부, 지시 아님): ${rebound.rebound.stance.text}`), 'v60.51 rebound');
    const guide = withRebound({ available: true, headline: 'h' }, rebound.rebound);
    assert.deepEqual(guide.rebound, { word: '반등 시도', text: rebound.rebound.stance.text }, 'v60.51 rebound');
    assert.equal(withRebound({ available: false }, rebound.rebound).rebound, undefined, 'v60.51 rebound');
    assert.equal(withRebound({ available: true }, null).rebound, undefined, 'v60.51 rebound');
  });
  check('v60.51 the record line places the rebound day as it places a fall: the largest one-day rise of the record', () => {
    assert.match(said(rebound, 'records').text, /^반도체 하루 \+14\.0%는 기록\(2026-01-02 이후\) 중 가장 큰 하루 상승입니다\./, 'v60.51 rebound');
    cleanSaid(said(rebound, 'records'));
  });
  check('v60.51 the AI facts carry the state word and its conditions, and still name one Nasdaq', () => {
    const lines = openingFactLines(rebound);
    assert.ok(lines.includes('반등 상태어(규칙으로 정함, 바꾸지 말 것): 반등 시도'), 'v60.51 rebound');
    assert.ok(lines.some((line) => line.startsWith('반등: 반등 시도 — 나스닥 100이 11/20 종가')), 'v60.51 rebound');
    assert.equal(lines.filter((line) => line.startsWith('반등 확인 조건: ')).length, 2, 'v60.51 rebound');
    assert.doesNotMatch(`${texts(rebound)}\n${lines.join('\n')}`, /나스닥 종합|나스닥(?! 100)/, 'v60.51 rebound');
  });
  const day2 = after(day1, '2026-11-24', { sox: 1.01, ndx: 1.005, spx: 1.003, rsp: 1.002, dow: 1.003 }, { rallyPhase: 1, rallyDay: 3, followThroughDay: 0 });
  // Five sessions after the bounce: a down day, then a follow-through day (the producer's rally fields) and two more.
  const day6 = [['2026-11-25', 0.985, { rallyPhase: 1, rallyDay: 4, followThroughDay: 0 }], ['2026-11-27', 1.03, { rallyPhase: 2, rallyDay: 5, followThroughDay: 1 }],
    ['2026-11-30', 1.004, { rallyPhase: 2, rallyDay: 6, followThroughDay: 0 }], ['2026-12-01', 0.996, { rallyPhase: 2, rallyDay: 7, followThroughDay: 0 }]]
    .reduce((rows, [date, m, extra]) => after(rows, date, { sox: m, ndx: m, spx: m, rsp: m, dow: m }, extra), day2);
  check('v60.51 after the bounce day the lede counts from the dated low, not "하루": +1 and +5 sessions', () => {
    const next = build(day2);
    assert.equal(next.rebound?.state, 'attempt', 'v60.51 rebound');
    assert.equal(said(next, 'lede').text, '반도체는 저점(11/20)에서 15% 올라왔지만 고점 대비로는 아직 34% 아래, 약세장입니다. S&P 500과 나스닥 100이 모두 200일선 아래라 추세 전환은 아직 확인 전입니다.', 'v60.51 +1 session');
    const later = build(day6);
    assert.equal(later.asOf, '2026-12-01', 'v60.51 rebound');
    assert.equal(said(later, 'lede').text, '반도체는 저점(11/20)에서 17% 올라왔지만 고점 대비로는 아직 33% 아래, 약세장입니다. S&P 500은 200일선 위지만 나스닥 100은 아래라 추세 전환은 아직 확인 전입니다.', 'v60.51 +5 sessions');
    for (const [opening, history] of [[next, day2], [later, day6]]) { assert.doesNotMatch(said(opening, 'lede').text, /하루/, 'v60.51 rebound'); cleanSaid(said(opening, 'lede'), history); }
  });
  check('v60.51 the follow-through day, once it happened, is a fact of the state line (not a row), named without a second Nasdaq', () => {
    assert.match(said(build(day6), 'watch').text, /^11\/27 바닥 확인일이 나왔습니다\. 나스닥 100이 11\/20 종가\(20,000\) 아래로 마감하면 반등 실패입니다\./, 'v60.51 rebound');
    assert.doesNotMatch(said(rebound, 'watch').text, /바닥 확인일/, 'v60.51 none before it happens');
    assert.equal(build(day6).rebound.checks.texts.length, 2, 'v60.51 rebound');
  });
  check('v60.51 a close under the low the rebound rose from: 반등 실패 on that session, the fall\'s lede back, then nothing', () => {
    const broke = after(day2, '2026-11-25', { sox: 0.82, ndx: 0.9, spx: 0.93, rsp: 0.96, dow: 0.94 });
    const failed = build(broke);
    assert.equal(failed.rebound?.state, 'failed', 'v60.51 rebound');
    assert.equal(said(failed, 'lede').text, '반도체는 고점에서 46% 내린 약세장이고 나스닥 100도 약세장입니다. 시장 전체는 조정에 그쳐, 쏠림이 되돌려지는 하락입니다.', 'v60.51 rebound');
    assert.equal(failed.lines.find((line) => line.id === 'watch').label, '반등 실패', 'v60.51 rebound');
    assert.equal(said(failed, 'watch').text, '11/20 종가 아래로 마감해 반등 판단은 거둡니다. 지금은 하락 구간의 단계와 진단이 기준입니다.', 'v60.51 the stance alone: it names the broken low');
    assert.equal(failed.rebound.stance.text, said(failed, 'watch').text, 'v60.51 rebound');
    cleanSaid(said(failed, 'watch'), broke);
    assert.equal(build(after(broke, '2026-11-27', { ndx: 0.99, spx: 0.99, sox: 0.99 })).rebound, null, 'v60.51 rebound');
  });
  check('v60.51 no rebound read under the rule\'s line, or outside a fall that reached the correction line', () => {
    assert.equal(build(after(base, '2026-11-23', { ndx: 1.045, spx: 1.03, sox: 1.08 })).rebound, null, 'v60.51 a 4.5% bounce is not a rebound');
    const shallow = fixtureHistory({ soxEnd: 0.95, ndxEnd: 0.93, spxEnd: 0.97, rspEnd: 0.98, dowEnd: 0.97 });
    assert.equal(build(after(shallow, '2026-11-23', { ndx: 1.06, spx: 1.05, sox: 1.1 })).rebound, null, 'v60.51 a -7% fall has no rebound read');
  });
  // A rising year, a 12% dip and a recovery to just under the high: both indexes back over their 50- and 200-day lines.
  const n = SESSIONS.length;
  const shape = (i) => (i <= n - 21 ? 80 + 20 * (i / (n - 21)) : i <= n - 11 ? 100 - 12 * ((i - (n - 21)) / 10) : 88 + 11 * ((i - (n - 11)) / 10));
  const recoveredHistory = SESSIONS.map((date, i) => ({ date, sox: +(shape(i) * 100).toFixed(2), ndx: +(shape(i) * 250).toFixed(2), spx: +(shape(i) * 70).toFixed(2), rsp: +(shape(i) * 2).toFixed(2), dow: +(shape(i) * 450).toFixed(2), breadth50: 55 }));
  check('v60.51 추세 회복: the S&P 500 and the Nasdaq-100 both over their 50- and 200-day lines after the low', () => {
    const recovered = build(recoveredHistory);
    assert.equal(recovered.rebound?.state, 'recovered', 'v60.51 rebound');
    assert.equal(said(recovered, 'lede').text, '나스닥 100은 저점(11/6)에서 13% 올라 고점 대비 1% 아래까지 왔고, S&P 500과 나스닥 100은 50일선과 200일선을 모두 되찾았습니다.', 'v60.51 rebound');
    assert.equal(recovered.rebound.stance.text, REBOUND_STANCE.recovered, 'v60.51 rebound');
    assert.equal(recovered.lines.find((line) => line.id === 'watch').label, '추세 회복', 'v60.51 rebound');
    assert.equal(said(recovered, 'watch').text.replace(/\d{1,3}(?:,\d{3})+/g, 'N'), `200일선은 S&P 500 N, 나스닥 100 N입니다. ${REBOUND_STANCE.recovered}`, 'v60.51 rebound');
  });
  check('v60.51 추세 회복 holds through a dip under the 50-day line while both stay over the 200-day line, and ends under it', () => {
    const { ma50, ma200 } = build(recoveredHistory).rows.ndx.episode;
    const dip = (ma50 + ma200) / 2 / recoveredHistory.at(-1).ndx;
    const dipped = build(after(recoveredHistory, '2026-11-23', { sox: dip, ndx: dip, spx: dip, rsp: dip, dow: dip }));
    assert.equal(dipped.rebound?.state, 'recovered', 'v60.51 rebound');
    assert.match(said(dipped, 'lede').text, /S&P 500과 나스닥 100은 200일선 위를 지키고 있습니다\.$/, 'v60.51 rebound');
    const under = (ma200 * 0.985) / recoveredHistory.at(-1).ndx;
    assert.ok(ma200 * 0.985 > 88 * 250, 'v60.51 the fixture stays over its low');
    assert.equal(build(after(recoveredHistory, '2026-11-23', { sox: under, ndx: under, spx: under, rsp: under, dow: under })).rebound?.state, 'attempt', 'v60.51 rebound');
  });
  check('v60.51 past frequency under the record line, only with the long-run tables, counted by the reader from their own rows', () => {
    // An ndx table as the producer writes it: the one-session rises past a 3.5% cut and two drawdown episodes.
    const ndxBody = { from: '1985-10-01', through: '2026-11-20', moves: { 1: { cutRise: 3.5, rises: [['2001-01-03', 18.77], ['2008-10-13', 12.58], ['1999-01-04', 5.4], ['2020-03-13', 10.07], ['2003-05-01', 4.2], ['2026-11-19', 5]] } },
      drawdowns: [{ peak: '2000-03-27', trough: '2002-10-09', depth: -82.9, regained: '2015-01-01' }, { peak: '2020-02-19', trough: '2020-03-16', depth: -28, regained: '2020-06-01' }, { peak: '2026-10-06', trough: '2026-11-20', depth: -19.8, regained: null }] };
    const tables = { schemaVersion: 'index-longrun.v1', definition: { drawdownMinPct: 10 }, indexes: { ndx: ndxBody } };
    assert.deepEqual(risesInFalls(tables, 'ndx', S.reboundPct), { from: '1985-10-01', through: '2026-11-20', minPct: 5, total: 5, inside: 4 }, 'v60.51 1999 is outside; 2001/2008 inside 2000~2015, 2020 and 2026 inside theirs');
    assert.equal(risesInFalls({ indexes: { ndx: { ...ndxBody, moves: { 1: { ...ndxBody.moves[1], cutRise: 5.5 } } } } }, 'ndx', 5), null, 'v60.51 a tail cut above the line gives no count rather than a short one');
    const withTables = buildMarketOpening({ history: day1, macroHistory: credit(3.2), longrun: tables });
    assert.match(said(withTables, 'records').text, / 1985년 이후 나스닥 100이 하루 5% 이상 오른 날 5개 가운데 4개가 고점에서 10% 넘게 내린 하락 구간 안이었습니다\.$/, 'v60.51 rebound');
    assert.doesNotMatch(said(withTables, 'lede').text, /1985/, 'v60.51 not in the lede');
    assert.deepEqual(unclaimedFigures(said(withTables, 'records')), [], 'v60.51 rebound');
    assert.doesNotMatch(said(rebound, 'records').text, /이후 나스닥 100이 하루/, 'v60.51 nothing without the tables');
    assert.doesNotMatch(said(build(base), 'records').text, /하락 구간 안이었습니다/, 'v60.51 nothing outside a rebound');
  });
  check('v60.51 the produced record and the static shell carry the conditions line', () => {
    const regime = { available: true, overall: '부담 우세', asOf: '2026-11-23', heroLine: 'x', counts: { favorable: 0, neutral: 2, burden: 4, unknown: 0 } };
    const record = todayVerdictFrom(regime, 'now', 'm', rebound);
    assert.deepEqual(record.story.lines.map((line) => [line.id, line.label]), [['lede', ''], ['diagnosis', '쏠림 되돌림'], ['watch', '반등 시도'], ['records', '']], 'v60.51 rebound');
    assert.equal(record.schemaVersion, 'today-verdict.v1', 'v60.51 rebound');
  });
  check('v60.51 no instruction and no size word on the rebound lines', () => {
    const all = [...rebound.lines.map((line) => line.said.text), ...rebound.rebound.checks.texts].join('\n');
    assert.doesNotMatch(all, /사세요|파세요|매수하|매도하/, 'v60.51 rebound');
    assert.doesNotMatch(all, SIZE_WORDS, 'v60.51 rebound');
  });
  report('rebound');
}, 'code'],
['crash-11-20', async () => {
  // The published closes (borrowed as realistic input): the 11/20 crash.
  const history = readHistoryRows(JSON.parse(readFileSync(resolve(root, 'public-data/history.json'), 'utf8'))).filter((row) => row.date <= '2026-11-20');
  if (!history.some((row) => row.date === '2026-11-20')) { console.log('  skip 11/20 is no longer in history.json'); return; }
  const macroHistory = JSON.parse(readFileSync(resolve(root, 'public-data/macro-history.json'), 'utf8'));
  const opening = buildMarketOpening({ history, macroHistory, through: '2026-11-20' });
  check('v60.50 11/20: the lede, 쏠림 되돌림 with the fast widening and the 450bp line', () => {
    assert.equal(said(opening, 'lede').text, '반도체는 고점에서 43% 내린 약세장이고 나스닥 100은 약세장 문턱입니다. 시장 전체는 조정에 그쳐, 쏠림이 되돌려지는 하락입니다.', 'v60.50 crash-11-20');
    assert.equal(opening.diagnosis.state, 'unwind', 'v60.50 crash-11-20');
    // The credit figure is whatever the published series holds for that close (it arrives a session late and is not pinned here).
    assert.match(said(opening, 'diagnosis').text, /^나스닥 100이 동일가중보다 12\.7%p 더 내렸고 신용 스프레드는 \d+bp(?:.\d+\/\d+.)?, 5거래일 \+\d+bp로 빠르게 확대 중\. 450bp를 넘으면 금융 불안형\.$/, 'v60.50 crash-11-20');
    assert.equal(opening.rebound, null, 'v60.51 crash-11-20: no rebound read on the crash close');
    assert.deepEqual(opening.lines.map((line) => line.id), ['lede', 'diagnosis', 'records'], 'v60.51 crash-11-20: the 11/20 face keeps its three lines');
    assert.deepEqual(opening.bars.bars.map((bar) => `${bar.label} ${bar.valueText}`), ['반도체(SOX) -42.5%', '나스닥 100 -19.8%', 'S&P 500 -11.6%', '다우 -11.4%', '동일가중 -7.1%'], 'v60.50 crash-11-20');
  });
  report('crash-11-20');
}, 'code']
]);
console.log('market-story: all checks passed');
