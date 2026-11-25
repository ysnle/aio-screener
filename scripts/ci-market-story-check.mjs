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
import { paintOpening } from '../src/ui/components/market-story.js';
import { SCREEN_STORY } from '../src/domain/market/story/screen-story.js';
import { tieLines } from '../src/ui/components/story-tie.js';
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
    assert.deepEqual(opening.lines.map((line) => line.id).slice(0, 3), ['session', 'lede', 'diagnosis'], 'v60.50 lede-variants');
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
    assert.deepEqual(record.story.lines.map((line) => [line.id, line.label]).slice(0, 3), [['session', ''], ['lede', ''], ['diagnosis', '쏠림 되돌림']], 'v60.50 verdict-record-shapes');
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
  const day1 = after(base.map((row, i, all) => (i === all.length - 1 ? { ...row, rallyPhase: 1, rallyDay: 0, followThroughDay: 0 } : row)), '2026-11-23', { sox: 1.14, ndx: 1.069, spx: 1.047, rsp: 1.026, dow: 1.04 }, { rallyPhase: 1, rallyDay: 1, followThroughDay: 0 });
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
    assert.deepEqual(rebound.lines.map((line) => line.id), ['session', 'lede', 'diagnosis', 'watch', 'records'], 'v60.51 the diagnosis line stays; the conditions line follows it');
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
  check('v60.52 the AI facts carry the state word and its conditions, each naming the index and rule (never merged with the Composite FTD)', () => {
    const lines = openingFactLines(rebound);
    assert.ok(lines.includes('반등 상태어(나스닥 100 규칙으로 정함, 바꾸지 말 것): 반등 시도'), 'v60.52 rebound terms');
    assert.ok(lines.some((line) => line.startsWith(`반등(나스닥 100 종가, 저점 대비 +${S.reboundPct}% 규칙): 반등 시도 — 나스닥 100이 11/20 종가`)), 'v60.52 rebound terms');
    assert.equal(lines.filter((line) => line.startsWith('반등 가격 조건(나스닥 100·S&P 500): ')).length, 2, 'v60.52 rebound terms');
    // The tracker's confirm clause is the follow-through count itself, named with its own index and word.
    const story = lines.filter((line) => !line.startsWith('반등 추적: '));
    assert.ok(story.every((line) => !/반등 확인|바닥 확인/.test(line)), 'v60.52 the story lines never use the follow-through words');
    assert.doesNotMatch(`${texts(rebound)}\n${story.join('\n')}`, /나스닥 종합|나스닥(?! 100)/, 'v60.51 rebound');
  });
  const day2 = after(day1, '2026-11-24', { sox: 1.01, ndx: 1.005, spx: 1.003, rsp: 1.002, dow: 1.003 }, { rallyPhase: 1, rallyDay: 2, followThroughDay: 0 });
  // Five sessions after the bounce: a down day, then a follow-through day (the producer's rally fields, v60.52 count: the
  // 11/20 low is day 0, so 11/27 is day 4) and two more.
  const day6 = [['2026-11-25', 0.985, { rallyPhase: 1, rallyDay: 3, followThroughDay: 0 }], ['2026-11-27', 1.03, { rallyPhase: 2, rallyDay: 4, followThroughDay: 1 }],
    ['2026-11-30', 1.004, { rallyPhase: 2, rallyDay: 5, followThroughDay: 0 }], ['2026-12-01', 0.996, { rallyPhase: 2, rallyDay: 6, followThroughDay: 0 }]]
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
  check('v60.52 the follow-through day, once it happened, is a fact of the state line (not a row), naming its own index and word', () => {
    assert.match(said(build(day6), 'watch').text, /^11\/27 나스닥 종합 반등 확인 신호\(FTD\)가 나왔습니다\. 나스닥 100이 11\/20 종가\(20,000\) 아래로 마감하면 반등 실패입니다\./, 'v60.52 rebound terms');
    assert.doesNotMatch(said(build(day6), 'watch').text, /바닥 확인/, 'v60.52 rebound terms');
    assert.doesNotMatch(said(rebound, 'watch').text, /반등 확인 신호/, 'v60.51 none before it happens');
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
  check('v60.56 rebound-track: the rebound as a process — N일째, each session\'s move since the low\'s close, the follow-through condition and the low\'s check', () => {
    const track = build(day2).track;
    assert.equal(track.head.text, '11/20 저점 뒤 2일째', 'v60.56 rebound-track');
    assert.deepEqual(track.columns.map((column) => column.label), ['반도체', '나스닥 100', 'S&P 500', '동일가중'], 'v60.56 rebound-track: leaders first');
    assert.deepEqual(track.rows.map((row) => [row.date, row.day, row.cells.map((cell) => cell.said.text)]),
      [['2026-11-23', 1, ['+14.0%', '+6.9%', '+4.7%', '+2.6%']], ['2026-11-24', 2, ['+15.1%', '+7.4%', '+5.0%', '+2.8%']]], 'v60.56 rebound-track: each close against the 11/20 close, oldest first');
    assert.equal(track.confirm.met, false, 'v60.56 rebound-track');
    assert.equal(track.confirm.said.text, `나스닥 종합이 저점 뒤 ${RULES.rallyAttempt.minDay}일째부터 하루 +${RULES.rallyAttempt.gainPct}% 이상 오르고 거래량이 전날보다 많으면 반등 확인 신호(FTD)`, 'v60.56 rebound-track: the follow-through count\'s own rule and words');
    assert.equal(track.fail.said.text, build(day2).rebound.checks.texts[0], 'v60.56 rebound-track: the fail condition is the low\'s own check, not a second rule');
    for (const piece of [track.said, ...track.rows.map((row) => row.said)]) cleanSaid(piece, day2);
    const line = openingFactLines(build(day2)).find((item) => item.startsWith('반등 추적: '));
    assert.equal(line, `반등 추적: ${track.said.text}`, 'v60.56 rebound-track');
    assert.match(line, /^반등 추적: 11\/20 저점 뒤 2일째\(반등 시도\)\. 11\/23\(1일째\) 반도체 \+14\.0%, .*; 11\/24\(2일째\) .* 확인 조건: 나스닥 종합이 .* 실패 조건: 나스닥 100이 11\/20 종가 20,000 위를 지키는지/, 'v60.56 rebound-track');
  });
  check('v60.56 rebound-track: at most the last six sessions, numbered from the low; the follow-through, once it happened, is the confirm condition met', () => {
    const day7 = after(day6, '2026-12-02', { sox: 1.01, ndx: 1.01, spx: 1.01, rsp: 1.01, dow: 1.01 }, { rallyPhase: 2, rallyDay: 7, followThroughDay: 0 });
    const track = build(day7).track;
    assert.equal(track.day, 7, 'v60.56 rebound-track');
    assert.deepEqual(track.rows.map((row) => `${row.date}:${row.day}`), ['2026-11-24:2', '2026-11-25:3', '2026-11-27:4', '2026-11-30:5', '2026-12-01:6', '2026-12-02:7'], `v60.56 rebound-track: ${RULES.reboundTrack.sessionsMax} rows, oldest first`);
    assert.deepEqual({ met: track.confirm.met, text: track.confirm.said.text }, { met: true, text: '11/27 나스닥 종합 반등 확인 신호(FTD)가 나왔습니다.' }, 'v60.56 rebound-track');
  });
  check('v60.56 rebound-track: a close missing on a session is 자료 없음 in its cell, never the neighbouring close', () => {
    const gap = day2.map((row) => (row.date === '2026-11-23' ? (({ rsp, ...rest }) => rest)(row) : row));
    const track = build(gap).track;
    assert.deepEqual(track.rows[0].cells.map((cell) => cell.said.text), ['+14.0%', '+6.9%', '+4.7%', '자료 없음'], 'v60.56 rebound-track');
    assert.equal(track.rows[0].cells[3].value, null, 'v60.56 rebound-track');
    assert.match(track.rows[1].cells[3].said.text, /^\+/, 'v60.56 rebound-track: the next session reads its own close');
  });
  check('v60.56 rebound-track: a failed rebound shows its sessions through the break with the fail condition met and no confirm; no rebound, no tracker and no line', () => {
    const broke = after(day2, '2026-11-25', { sox: 0.82, ndx: 0.9, spx: 0.93, rsp: 0.96, dow: 0.94 });
    const failed = build(broke).track;
    assert.equal(failed.state, 'failed', 'v60.56 rebound-track');
    assert.equal(failed.confirm, null, 'v60.56 rebound-track');
    assert.deepEqual({ met: failed.fail.met, text: failed.fail.said.text }, { met: true, text: '나스닥 100이 11/20 종가 20,000 아래로 마감해 반등 실패' }, 'v60.56 rebound-track');
    assert.deepEqual(failed.rows.map((row) => row.day), [1, 2, 3], 'v60.56 rebound-track');
    assert.ok(failed.rows[2].cells[1].value < 0, 'v60.56 rebound-track: the break session reads under the low');
    cleanSaid(failed.said, broke);
    for (const history of [base, after(broke, '2026-11-27', { ndx: 0.99, spx: 0.99, sox: 0.99 }), after(base, '2026-11-23', { ndx: 1.045, spx: 1.03, sox: 1.08 })]) {
      const opening = build(history);
      assert.equal(opening.track, null, 'v60.56 rebound-track: no rebound, no tracker');
      assert.ok(!openingFactLines(opening).some((item) => item.startsWith('반등 추적')), 'v60.56 rebound-track: and no line');
    }
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
    assert.deepEqual(record.story.lines.map((line) => [line.id, line.label]), [['session', ''], ['lede', ''], ['diagnosis', '쏠림 되돌림'], ['watch', '반등 시도'], ['records', '']], 'v60.51 rebound');
    assert.equal(record.schemaVersion, 'today-verdict.v1', 'v60.51 rebound');
  });
  check('v60.51 no instruction and no size word on the rebound lines', () => {
    const all = [...rebound.lines.map((line) => line.said.text), ...rebound.rebound.checks.texts].join('\n');
    assert.doesNotMatch(all, /사세요|파세요|매수하|매도하/, 'v60.51 rebound');
    assert.doesNotMatch(all, SIZE_WORDS, 'v60.51 rebound');
  });

  // Whether other markets confirm the rebound (rebound-quality.js), from the 11/20 low to the 11/23 close, each end on its
  // own session. `ends`: field → [value on 11/20, value on 11/23] (null leaves the field off that row); `hy`: the spread
  // (percent) on 11/20 and 11/23 (null: no observation that day).
  const LOW = '2026-11-20', NOW = '2026-11-23';
  const crossMarket = ({ ends = {}, hy = [3.76, 3.5], extraRows = {} } = {}) => {
    const history = day1.map((row) => {
      const at = row.date === LOW ? 0 : row.date === NOW ? 1 : -1;
      const next = { ...row, ...(extraRows[row.date] || {}) };
      if (at < 0) return next;
      for (const [field, pair] of Object.entries(ends)) { if (pair[at] == null) delete next[field]; else next[field] = pair[at]; }
      return next;
    });
    const macroHistory = credit(3.2);
    macroHistory.series.hyOas.observations = macroHistory.series.hyOas.observations.filter(([date]) => date !== LOW).concat(hy[0] == null ? [] : [[LOW, hy[0]]], hy[1] == null ? [] : [[NOW, hy[1]]]).sort((a, b) => a[0].localeCompare(b[0]));
    return { history, macroHistory, opening: buildMarketOpening({ history, macroHistory }) };
  };
  const CONFIRMING = { dxy: [104, 103], vix: [35.89, 24], vix3m: [30.94, 26], breadth50: [43, 53], rsp: [186, 190] };
  const qualityOf = (opening) => opening.rebound?.quality || null;
  const cleanQuality = (quality, history, macroHistory) => {
    for (const piece of [quality.said, ...quality.items]) {
      assert.deepEqual(unclaimedFigures(piece), [], `v60.53 rebound quality: figures without a claim: ${piece.text}`);
      assert.deepEqual(saidIssues(piece, openingFacts(history, macroHistory)).filter(isClaimError), [], `v60.53 rebound quality: claim errors: ${piece.text}`);
      assert.doesNotMatch(piece.text, /사세요|파세요|매수하|매도하|숏커버링입니다|숏커버링이었|숏커버링 때문/, `v60.53 rebound quality: no order, no asserted cause: ${piece.text}`);
    }
  };
  check('v60.53 rebound quality: all four checks confirm — 4/4, 뒷받침됨, both ends dated, no index-only note', () => {
    const { history, macroHistory, opening } = crossMarket({ ends: CONFIRMING });
    const q = qualityOf(opening);
    assert.ok(q, 'v60.53 rebound quality: an attempt carries the cross-market read');
    assert.deepEqual([q.state, q.word, q.met, q.known, q.from, q.through], ['confirmed', '뒷받침됨', 4, 4, LOW, NOW], 'v60.53 rebound quality: all confirm');
    assert.equal(q.said.text, '다른 시장 확인 4/4, 11/20 저점부터 11/23 종가까지.', 'v60.53 rebound quality: the verdict line');
    assert.deepEqual(q.items.map((item) => item.text), [
      '신용 확인 — 하이일드 스프레드 376bp(11/20) → 350bp(11/23)',
      '달러 확인 — 달러 지수 104.00(11/20) → 103.00(11/23)',
      '변동성 확인 — VIX 35.89(11/20) → 24.00(11/23), 3개월 VIX 26.00',
      '참여 폭 확인 — 50일선 위 종목 43%(11/20) → 53%(11/23), 동일가중 +2.2%'], 'v60.53 rebound quality: one row per check, both ends with their dates');
    assert.deepEqual(q.checks.map((row) => [row.id, row.label, row.met]), [['credit', '신용', true], ['dollar', '달러', true], ['volatility', '변동성', true], ['breadth', '참여 폭', true]], 'v60.53 rebound quality: check shape');
    assert.doesNotMatch(q.said.text, /숏커버링/, 'v60.53 rebound quality: the note is the index-only state\'s alone');
    cleanQuality(q, history, macroHistory);
    const lines = openingFactLines(opening);
    assert.ok(lines.includes(`반등의 다른 시장 확인(저점과 최근 종가를 같은 거래일끼리 비교, 원인 단정 아님): 뒷받침됨 — ${q.said.text}`), 'v60.53 rebound quality: the AI gets the screen\'s verdict');
    assert.equal(lines.filter((line) => line.startsWith('반등의 다른 시장 항목: ')).length, 4, 'v60.53 rebound quality: and every row');
  });
  check('v60.53 rebound quality: one of four confirms — 확인 부족, not 지수만 반등, and no short-covering note', () => {
    const { opening } = crossMarket({ ends: { dxy: [103, 104], vix: [35.89, 27], vix3m: [30.94, 26], breadth50: [43, 53], rsp: [186, 190] }, hy: [3.5, 3.76] });
    const q = qualityOf(opening);
    assert.deepEqual([q.state, q.word, q.met, q.known], ['weak', '확인 부족', 1, 4], 'v60.53 rebound quality: a confirmed check keeps the read off index-only');
    assert.doesNotMatch(q.said.text, /숏커버링/, 'v60.53 rebound quality: the note belongs to 0 confirmed alone');
  });
  check('v60.53 rebound quality: only the index rose — 0/4, 지수만 반등 with the conditional note, VIX down but over its 3-month counts as unmet', () => {
    const { history, macroHistory, opening } = crossMarket({ ends: { dxy: [103, 104], vix: [35.89, 27], vix3m: [30.94, 26], breadth50: [43, 41], rsp: [186, 190] }, hy: [3.5, 3.76] });
    const q = qualityOf(opening);
    assert.deepEqual([q.state, q.word, q.met, q.known], ['index-only', '지수만 반등', 0, 4], 'v60.53 rebound quality: index only');
    assert.equal(q.said.text, '다른 시장 확인 0/4, 11/20 저점부터 11/23 종가까지. 지수만 오른 반등은 숏커버링과 구별되지 않습니다.', 'v60.53 rebound quality: the index-only verdict and its conditional note');
    assert.equal(q.items[2].text, '변동성 미확인 — VIX 35.89(11/20) → 27.00(11/23), 3개월 VIX 26.00', 'v60.53 rebound quality: VIX lower than at the low but over the 3-month VIX is not confirmation');
    assert.equal(q.checks[3].met, false, 'v60.53 rebound quality: the equal weight up does not carry participation alone');
    cleanQuality(q, history, macroHistory);
  });
  check('v60.53 rebound quality: a missing series shrinks the denominator and is named (3/3 still reads 뒷받침됨)', () => {
    const { history, macroHistory, opening } = crossMarket({ ends: { ...CONFIRMING, dxy: [null, null] } });
    const q = qualityOf(opening);
    assert.deepEqual([q.state, q.met, q.known, q.total], ['confirmed', 3, 3, 4], 'v60.53 rebound quality: missing series');
    assert.equal(q.said.text, '다른 시장 확인 3/3, 11/20 저점부터 11/23 종가까지. 자료 없음: 달러.', 'v60.53 rebound quality: the missing check is named');
    assert.equal(q.items[1].text, '달러 자료 없음 — 달러 지수 11/20 값 없음 → 11/23 값 없음', 'v60.53 rebound quality: the missing row says which ends are missing');
    assert.equal(q.checks[1].met, null, 'v60.53 rebound quality: unknown is null, never false');
    cleanQuality(q, history, macroHistory);
    const two = qualityOf(crossMarket({ ends: { ...CONFIRMING, dxy: [null, null], vix: [null, null] } }).opening);
    assert.deepEqual([two.state, two.word, two.known], ['thin', '판단 보류', 2], 'v60.53 rebound quality: under RULES.reboundQuality.minKnown known checks no tally word is given');
  });
  check('v60.53 rebound quality: no borrowing across sessions — a value on a neighbouring day never stands in for the low or the latest close', () => {
    // DXY and the spread have no 11/23 close; VIX has none on 11/20 but one on 11/19; the producer's weekend rows carry DXY.
    const { history, macroHistory, opening } = crossMarket({ ends: { ...CONFIRMING, dxy: [104, null], vix: [null, 24] }, hy: [3.76, null],
      extraRows: { '2026-11-19': { vix: 30, dxy: 103.5 } } });
    const q = qualityOf(opening);
    assert.deepEqual(q.checks.map((row) => row.met), [null, null, null, true], 'v60.53 rebound quality: three checks unknown, not read off 11/19 or 11/20');
    assert.equal(q.items[0].text, '신용 자료 없음 — 하이일드 스프레드 376bp(11/20) → 11/23 값 없음', 'v60.53 rebound quality: the 11/20 spread is not the 11/23 one');
    assert.equal(q.items[1].text, '달러 자료 없음 — 달러 지수 104.00(11/20) → 11/23 값 없음', 'v60.53 rebound quality: DXY without an 11/23 close');
    assert.equal(q.items[2].text, '변동성 자료 없음 — VIX 11/20 값 없음 → 24.00(11/23), 3개월 VIX 26.00', 'v60.53 rebound quality: the 11/19 VIX is not the low\'s');
    assert.deepEqual([q.state, q.known], ['thin', 1], 'v60.53 rebound quality: one known check is no tally word');
    // A weekend row between the low and the latest close (the producer carries prices onto 11/21-11/22) holds a DXY value.
    const weekendRows = [...history, { date: '2026-11-22', dxy: 102 }].sort((a, b) => a.date.localeCompare(b.date));
    const weekend = qualityOf(buildMarketOpening({ history: weekendRows, macroHistory }));
    assert.equal(weekend.checks[1].met, null, 'v60.53 rebound quality: a value on a non-session row is not a close of the latest session');
  });
  check('v60.53 rebound quality: nothing without a rebound — the crash close, a failed rebound, or the low day itself', () => {
    const crash = buildMarketOpening({ history: base, macroHistory: credit(3.2) });
    assert.equal(crash.rebound, null, 'v60.53 rebound quality: the fixture low has no rebound');
    assert.ok(openingFactLines(crash).every((line) => !line.startsWith('반등의 다른 시장')), 'v60.53 rebound quality: no AI line without a rebound');
    assert.ok(!texts(crash).includes('다른 시장 확인'), 'v60.53 rebound quality: no face text without a rebound');
    const failed = after(day1, '2026-11-24', { sox: 0.85, ndx: 0.92, spx: 0.95, rsp: 0.97, dow: 0.96 });
    const fell = build(failed);
    assert.equal(fell.rebound?.state, 'failed', 'v60.53 rebound quality: the fixture fails the rebound');
    assert.equal(fell.rebound.quality, null, 'v60.53 rebound quality: a failed rebound has no cross-market read');
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
    assert.deepEqual(opening.lines.map((line) => line.id), ['session', 'lede', 'diagnosis', 'records'], 'v60.51 crash-11-20: the 11/20 face keeps its three lines');
    assert.deepEqual(opening.bars.bars.map((bar) => `${bar.label} ${bar.valueText}`), ['반도체(SOX) -42.5%', '나스닥 100 -19.8%', 'S&P 500 -11.6%', '다우 -11.4%', '동일가중 -7.1%'], 'v60.50 crash-11-20');
  });
  report('crash-11-20');
}, 'code'],
['session-read', async () => {
  // The latest session's own sentence ahead of the fall's standing (session-read.js), on fixture closes: the crash low on
  // 11/20, the 11/23 rebound, then an 11/24 that gives most of it back in the leaders while the equal weight rises.
  const base = fixtureHistory();
  const after = (rows, date, m) => { const last = rows.at(-1); return [...rows, { date, ...Object.fromEntries(['sox', 'ndx', 'spx', 'rsp', 'dow'].map((f) => [f, +(last[f] * (m[f] ?? 1)).toFixed(2)])), breadth50: 45 }]; };
  const day1 = after(base, '2026-11-23', { sox: 1.14, ndx: 1.069, spx: 1.047, rsp: 1.026, dow: 1.04 });
  const day2 = after(day1, '2026-11-24', { sox: 0.92, ndx: 0.98, spx: 0.995, rsp: 1.005, dow: 0.995 });
  const split = { index: 'spx', date: '2026-11-24', coverage: 99.7, total: -0.5, sectors: [{ sector: 'Information Technology', weight: 35.5, contribution: -0.97, change: -2.74 },
    { sector: 'Industrials', weight: 8.3, contribution: -0.04, change: -0.51 }, { sector: 'Real Estate', weight: 1.9, contribution: 0.02, change: 1.17 },
    { sector: 'Financials', weight: 12.5, contribution: 0.11, change: 0.88 }, { sector: 'Health Care', weight: 10.4, contribution: 0.3, change: 2.87 }, { sector: 'Consumer Discretionary', weight: 9.6, contribution: 0.08, change: 0.11 }] };
  const ledger = (us) => ({ sessions: { us }, indexSplit: { ...split, date: us }, facts: [
    { id: 'group:theme:photonics:2026-11-24', kind: 'group-move', label: '광통신', date: '2026-11-24', change: -9.3, rank: 'lead', materiality: 93 },
    { id: 'group:theme:semis:2026-11-24', kind: 'group-move', label: '반도체', date: '2026-11-24', change: -8.4, rank: 'lead', materiality: 84, parts: [{ name: '메모리', change: -11.2 }, { name: '장비', change: -9.0 }, { name: '파운드리', change: -6.9 }] },
    { id: 'group:theme:health:2026-11-24', kind: 'group-move', label: '헬스케어', date: '2026-11-24', change: 2.8, rank: 'major', materiality: 40 },
    { id: 'group:theme:quiet:2026-11-24', kind: 'group-move', label: '조용한 테마', date: '2026-11-24', change: -2.1, rank: 'minor', materiality: 99 },
    { id: 'group:sector:Technology:2026-11-24', kind: 'group-move', label: 'Technology', date: '2026-11-24', change: -5, rank: 'lead', materiality: 98 },
    { id: 'stock:MU:2026-11-24', kind: 'stock-move', subjects: ['MU'], date: '2026-11-24', change: -11.0, materiality: 42 },
    { id: 'stock:NVDA:2026-11-24', kind: 'stock-move', subjects: ['NVDA'], date: '2026-11-24', change: -5.9, materiality: 100 },
    { id: 'stock:AAPL:2026-11-24', kind: 'stock-move', subjects: ['AAPL'], date: '2026-11-24', change: 1.4, materiality: 90 },
    { id: 'stock:OLD:2026-11-23', kind: 'stock-move', subjects: ['OLD'], date: '2026-11-23', change: -30, materiality: 100 }] });
  const prints = (sessionDate) => ({ sessionDate, rows: [{ symbol: 'SMALL', changePct: -7.2, highPct: 1.1, lowPct: -8.0, indexWeight: 0.06 }, { symbol: 'DELL', changePct: 0.9, highPct: 12.4, lowPct: -0.4, indexWeight: 0.16 }, { symbol: 'NOPRINT', changePct: null, indexWeight: 0.5 }] });
  const briefs = { briefs: [{ symbol: 'DELL', nameKo: '델테크놀로지스', kind: 'earnings', eventDate: '2026-11-24', figures: [{ label: 'EPS' }, { label: '비GAAP EPS', estimate: { surprisePct: 40.1 } }] }] };
  const build = (history, more = {}) => buildMarketOpening({ history, macroHistory: credit(3.2), ...more });
  const gave = build(day2, { day: ledger('2026-11-24'), afterHours: prints('2026-11-24'), briefs, regularMoves: { DELL: -11.8 } });
  check('v60.55 the session leads: its moves, what the signs say together, and the share of the rebound given back', () => {
    assert.deepEqual(gave.lines.map((line) => line.id).slice(0, 5), ['session', 'gathered', 'split', 'after-hours', 'lede'], 'v60.55 session-read');
    assert.equal(said(gave, 'session').text, '11/24 반도체 -8.0%, 나스닥 100 -2.0%, S&P 500 -0.5%, 동일가중 +0.5%. 하락이 주도주에 몰린 날입니다. 11/20 저점 뒤 오른 폭 가운데 반도체 +14.0% 중 65%, 나스닥 100 +6.9% 중 31%를 되돌렸습니다.', 'v60.55 session-read');
    assert.deepEqual(unclaimedFigures(said(gave, 'session')), [], 'v60.55 session-read: every figure is a claim');
  });
  check('v60.55 where it gathered: theme groups and the most material stocks on the index side, one group against it; no sector, no minor group, no other session', () => {
    assert.equal(gave.lines.find((line) => line.id === 'gathered').label, '내린 곳', 'v60.55 session-read');
    assert.equal(said(gave, 'gathered').text, '테마로는 광통신 -9.3%, 반도체 -8.4%(메모리 -11.2%). 큰 종목으로는 NVDA -5.9%, MU -11.0%. 반대로 헬스케어 +2.8%.', 'v60.55 session-read');
  });
  check('v60.55 after-close reporters by index weight with the regular session beside the extended print; a row without a print is left out', () => {
    assert.equal(said(gave, 'after-hours').text, '델테크놀로지스(DELL) EPS 예상 대비 +40.1%에 시간외 +0.9%, 한때 +12.4%(정규장 -11.8%), SMALL 시간외 -7.2%. 시간외 가격은 잠정값입니다.', 'v60.55 session-read: an extreme the last print left is said; one it stayed near is not');
  });
  check('v60.55 why the S&P 500 moved less: the heaviest sector, the rest summed, the sectors that went the other way; silent when the split is another session or does not add up to the index', () => {
    assert.equal(said(gave, 'split').text, 'S&P 500 -0.5% 가운데 기술(비중 36%)이 1.0%p 끌어내렸고, 나머지 업종은 합쳐 0.5%p 끌어올렸습니다. 헬스케어 +2.9%, 금융 +0.9%가 올랐습니다. 동일가중과 다우는 기술 비중이 작아 그만큼 덜 움직였습니다.', 'v60.55 session-read: a sector under the weight or the move floor is not named');
    assert.deepEqual(unclaimedFigures(said(gave, 'split')), [], 'v60.55 session-read');
    const off = build(day2, { day: { ...ledger('2026-11-24'), indexSplit: { ...split, total: -1.4 } } });
    assert.equal(said(off, 'split').text, '', 'v60.55 session-read');
  });
  check('v60.55 a share given back is said only of an index that fell this session', () => {
    const up = build(after(day2, '2026-11-25', { sox: 1.004, ndx: 0.994, spx: 0.996, rsp: 0.995 }));
    assert.doesNotMatch(said(up, 'session').text, /되돌렸습니다/, 'v60.55 session-read');
  });
  check('v60.55 a ledger or after-hours file of another session says nothing; the moves still lead', () => {
    const stale = build(day2, { day: ledger('2026-11-23'), afterHours: prints('2026-11-23'), briefs });
    assert.deepEqual(stale.lines.map((line) => line.id).slice(0, 2), ['session', 'lede'], 'v60.55 session-read');
  });
  check('v60.55 the rebound day itself gives nothing back, and a quiet session names no place', () => {
    assert.doesNotMatch(said(build(day1), 'session').text, /되돌렸습니다/, 'v60.55 session-read');
    assert.match(said(build(day1), 'session').text, /^11\/23 반도체 \+14\.0%, 나스닥 100 \+6\.9%, S&P 500 \+4\.7%, 동일가중 \+2\.6%\. 주도주가 시장 전체보다 더 올랐습니다\.$/, 'v60.55 session-read');
    const quiet = build(after(day1, '2026-11-24', { sox: 1.003, ndx: 1.002, spx: 1.001, rsp: 1.001 }), { day: ledger('2026-11-24') });
    assert.equal(said(quiet, 'session').text, '11/24 반도체 +0.3%, 나스닥 100 +0.2%, S&P 500 +0.1%, 동일가중 +0.1%.', 'v60.55 session-read');
    assert.equal(said(quiet, 'gathered').text, '', 'v60.55 session-read');
  });
  check('v60.55 the AI fact lines carry the same three session lines, ahead of the standing', () => {
    const lines = openingFactLines(gave);
    assert.equal(lines[0], `최근 세션: ${said(gave, 'session').text}`, 'v60.55 session-read');
    assert.equal(lines[1], `반등 추적: ${gave.track.said.text}`, 'v60.56 rebound-track: the tracker line right after the session line');
    assert.equal(lines[2], `최근 세션에 내린 곳: ${said(gave, 'gathered').text}`, 'v60.55 session-read');
    assert.match(lines[3], /^최근 세션 S&P 500 업종별 기여: S&P 500 -0\.5% 가운데 기술/, 'v60.55 session-read');
    assert.match(lines[4], /^최근 세션 장 마감 뒤 실적\(시간외 잠정값\): 델테크놀로지스/, 'v60.55 session-read');
  });
  check('v60.55 the credit check reads the newest published spread after the low with its own date, and 자료 없음 when none is published yet', () => {
    const lagging = { series: { hyOas: { observations: [...SESSIONS.map((date) => [date, 3.76]), ['2026-11-23', 3.63]] } } };
    const row = buildMarketOpening({ history: day2, macroHistory: lagging }).rebound.quality.checks.find((item) => item.id === 'credit');
    assert.equal(row.said.text, '신용 확인 — 하이일드 스프레드 376bp(11/20) → 363bp(11/23)', 'v60.55 session-read');
    const none = buildMarketOpening({ history: day2, macroHistory: { series: { hyOas: { observations: SESSIONS.map((date) => [date, 3.76]) } } } }).rebound.quality.checks.find((item) => item.id === 'credit');
    assert.equal(none.met, null, 'v60.55 session-read');
    assert.match(none.said.text, /^신용 자료 없음 — 하이일드 스프레드 376bp\(11\/20\) → 11\/24 값 없음$/, 'v60.55 session-read');
  });

  // The cross-market rows (cross-market.js) on the same 11/24 fixture: the other markets' closes beside the indexes, a regime
  // of that session whose axis states the rows take, the 2-year and the target range, and a release calendar.
  const LAST = '2026-11-24';
  const markets = (rows, { drop = [] } = {}) => rows.map((row, i) => {
    const last = row.date === LAST;
    const next = { ...row, dxy: last ? 103 : 100, vix: last ? 26 : 20, vix3m: 25, breadth50: last ? 56 : 45, breadth200: 55, tnx: last ? 4.3 : 4.5 + i * 0 };
    if (last) for (const field of drop) delete next[field];
    return next;
  });
  const pathHistory = () => {
    const mh = credit(3.2);
    const days = [...SESSIONS, '2026-11-23', '2026-11-24'];
    mh.series.fedTargetLower = { observations: days.map((date) => [date, 3.75]) };
    mh.series.fedTargetUpper = { observations: days.map((date) => [date, 4]) };
    mh.series.dgs2 = { observations: [['2026-10-23', 4.875], ['2026-11-23', 4.675]] };
    // The spread a session late, as published: 11/23 is the newest observation on 11/24.
    mh.series.hyOas.observations.push(['2026-11-23', 3.63]);
    return mh;
  };
  const regimeOf = (asOf = LAST, states = {}) => ({ available: true, asOf, axes: [
    { id: 'credit', state: states.credit || 'burden', observation: { level: 363, change5: 43, change20: 43, asOf: '2026-11-23' } },
    // VIX 26 would read 부담 on the axis's own rule: the row must take the axis's word, not judge it again.
    { id: 'volatility', state: states.volatility || 'favorable' }, { id: 'breadth', state: 'neutral' },
    { id: 'rates', state: states.rates || 'neutral', growthScare: states.growthScare || null }, { id: 'commodities', state: 'burden', decidedBy: { dxyPosition: states.dxyPosition ?? 1 } }] });
  const EVENTS = [{ id: 'us-cpi', name: 'CPI (소비자물가)', date: '2026-11-24' }, { id: 'us-nfp', name: '고용보고서', date: '2026-11-25' },
    { id: 'us-pce', name: 'PCE (연준 기준 물가)', date: '2026-11-26' }, { id: 'us-cpi', name: 'CPI (소비자물가)', date: '2026-12-10' }];
  const crossBuild = (more = {}) => buildMarketOpening({ history: markets(day2, more), macroHistory: pathHistory(), regime: regimeOf(), events: EVENTS, ...more.opening });
  const cross = crossBuild();
  const crossLines = (opening) => opening.lines.filter((line) => line.id === 'cross');
  check('v60.55 cross-market: five rows and the policy path sit after the session lines and before the lede, headed by the rebound\'s tally', () => {
    const ids = cross.lines.map((line) => line.id);
    assert.deepEqual(ids.slice(0, ids.indexOf('lede') + 1), ['session', 'cross-head', 'cross', 'cross', 'cross', 'cross', 'cross', 'cross', 'lede'], 'v60.55 cross-market');
    assert.deepEqual(crossLines(cross).map((line) => [line.key, line.label]), [['credit', '신용 부담'], ['dollar', '달러 부담'], ['volatility', '변동성 양호'], ['breadth', '시장 폭 중립'], ['rates', '금리 중립'], ['rates-path', '금리 경로 인상 반영']], 'v60.55 cross-market: each state is the axis\'s (the dollar: its leg of the 유가와 달러 axis)');
    assert.equal(cross.lines.find((line) => line.id === 'cross-head').label, cross.rebound.quality.word, 'v60.55 cross-market: the head is the rebound\'s own tally word');
  });
  check('v60.55 cross-market: each row is its figures with their own dates, the rebound mark, then the fixed clause', () => {
    const text = (key) => crossLines(cross).find((line) => line.key === key).said.text;
    assert.equal(text('credit'), '하이일드 스프레드 363bp(11/23), 5거래일 +43bp, 20거래일 +43bp · 저점 뒤 미확인 — 기업이 돈 빌리는 값이 높거나 빠르게 오르는 중이라, 주식 하락이 자금 걱정으로 번질 수 있는 상태', 'v60.55 cross-market: the spread is the credit axis\'s observation, dated');
    assert.equal(text('dollar'), '달러 지수 103.00, 20거래일 +3.0% · 저점 뒤 미확인 — 달러가 빠르게 강해지는 중이라 세계 돈줄이 조여 위험자산에 부담이 되는 쪽', 'v60.55 cross-market');
    assert.match(text('volatility'), /^VIX 26\.00, 5거래일 \+30\.0%, 3개월 VIX 25\.00 · 저점 뒤 (확인|미확인|자료 없음) — 옵션 시장이 큰 흔들림을 예상하지 않는 상태$/, 'v60.55 cross-market: the clause follows the axis state');
    assert.match(text('breadth'), /^50일선 위 종목 56%\(5거래일 전 45%\), 200일선 위 55% · 저점 뒤 /, 'v60.55 cross-market');
    assert.equal(text('rates'), '10년 4.30%, 5거래일 -20bp, 20거래일 -20bp — 10년 금리가 주식에 큰 부담을 더하지 않는 상태', 'v60.55 cross-market: no rebound check for rates');
    assert.equal(text('rates-path'), '2년물 − 기준금리 중간값 +80bp(11/23), 10/23에는 +100bp · 다음 물가 발표 11/26 PCE (연준 기준 물가) — 인상 반영이 줄어드는 중이라, 물가가 식는 발표가 이어지면 인상 가격이 빠지고 인하 기대로 넘어갈 수 있음', 'v60.55 cross-market: the gap a month back, and the first CPI or PCE after the session (not one on it, not another release)');
  });
  check('v60.55 cross-market: every printed figure is a claim and no claim errs; no order, no source name, no textbook wording, no emoji', () => {
    for (const line of [...crossLines(cross), cross.lines.find((item) => item.id === 'cross-head')]) {
      assert.deepEqual(unclaimedFigures(line.said), [], `v60.55 cross-market: figures without a claim: ${line.said.text}`);
      assert.deepEqual(saidIssues(line.said, openingFacts(markets(day2), pathHistory())).filter(isClaimError), [], `v60.55 cross-market: claim errors: ${line.said.text}`);
      assert.doesNotMatch(line.said.text, /사세요|파세요|매수하|매도하|FRED|ICE|Cboe|란 |하는 법|\p{Extended_Pictographic}/u, `v60.55 cross-market: ${line.said.text}`);
    }
  });
  check('v60.55 cross-market: the dollar leg — burden past the line (at the top of its range from +2%), favorable at -2%, neutral between', () => {
    const dollar = (dxy, position) => crossLines(buildMarketOpening({ history: markets(day2).map((row) => (row.date === LAST ? { ...row, dxy } : row)), macroHistory: pathHistory(), regime: regimeOf(LAST, { dxyPosition: position }), events: EVENTS }))
      .find((line) => line.key === 'dollar').state;
    assert.deepEqual([dollar(102.2, 1), dollar(102.2, 0.5), dollar(102.6, 0.5), dollar(97.9, 0.5), dollar(99, 0.5)], ['burden', 'neutral', 'burden', 'favorable', 'neutral'], 'v60.55 cross-market');
  });
  check('v60.55 cross-market: a regime of another session, or none, gives no rows (no state is borrowed); a growth-scare 중립 takes its own clause', () => {
    assert.equal(crossLines(buildMarketOpening({ history: markets(day2), macroHistory: pathHistory(), regime: regimeOf('2026-11-23'), events: EVENTS })).length, 0, 'v60.55 cross-market');
    const none = buildMarketOpening({ history: markets(day2), macroHistory: pathHistory(), events: EVENTS });
    assert.ok(!none.lines.some((line) => line.id.startsWith('cross')) && !openingFactLines(none).some((line) => line.startsWith('다른 시장')), 'v60.55 cross-market');
    const scare = buildMarketOpening({ history: markets(day2), macroHistory: pathHistory(), regime: regimeOf(LAST, { growthScare: { spx20: -5 } }), events: EVENTS });
    assert.match(crossLines(scare).find((line) => line.key === 'rates').said.text, / — 10년 금리는 내렸지만 주가도 함께 빠져, 할인율 안도보다 성장 걱정 쪽$/, 'v60.55 cross-market');
  });
  check('v60.55 cross-market: a series with no close on the session says its own date, and one with none at all says 값 없음', () => {
    const stale = crossLines(buildMarketOpening({ history: markets(day2, { drop: ['breadth50', 'breadth200', 'vix', 'vix3m', 'dxy', 'tnx'] }), macroHistory: pathHistory(), regime: regimeOf(), events: EVENTS }));
    assert.match(stale.find((line) => line.key === 'breadth').said.text, /^50일선 위 종목 45%\(11\/23\)/, 'v60.55 cross-market: the 11/23 share is said as 11/23\'s');
    assert.match(stale.find((line) => line.key === 'volatility').said.text, /^VIX 20\.00\(11\/23\)/, 'v60.55 cross-market');
    const bare = crossLines(buildMarketOpening({ history: day2, macroHistory: credit(3.2), regime: { ...regimeOf(), axes: regimeOf().axes.map((row) => (row.id === 'credit' ? { ...row, state: 'unknown', observation: null } : row)) }, events: [] }));
    assert.deepEqual(bare.map((line) => line.said.text.split(' — ')[0].split(' · ')[0]), ['하이일드 스프레드 값 없음', '달러 지수 값 없음', 'VIX 값 없음', '50일선 위 종목 45%(5거래일 전 45%)', '10년 금리 값 없음'], 'v60.55 cross-market: no path without a 2-year, nothing filled');
    assert.equal(bare.find((line) => line.key === 'credit').label, '신용 확인 불가', 'v60.55 cross-market');
  });
  check('v60.55 cross-market: the AI fact lines carry each row with its rule-decided word, the path with its proxy caveat and the next release, after the session and before the standing', () => {
    const lines = openingFactLines(cross);
    const at = (prefix) => lines.findIndex((line) => line.startsWith(prefix));
    assert.ok(at('최근 세션: ') < at('다른 시장 신용(') && at('다른 시장 금리 다음 확인') < at('요약: '), 'v60.55 cross-market: order');
    assert.ok(lines.includes('다른 시장 변동성(상태어는 규칙으로 정함, 바꾸지 말 것): 양호 — ' + cross.cross.find((row) => row.id === 'volatility').said.text + ` · 반등 저점 뒤 ${cross.cross.find((row) => row.id === 'volatility').since.mark} — 지금 뜻: 옵션 시장이 큰 흔들림을 예상하지 않는 상태`), 'v60.55 cross-market');
    assert.ok(lines.includes('다른 시장 금리 경로(2년물로 어림한 값이라 기간·위험 프리미엄이 섞임, 인상·인하 횟수 아님): 인상 반영 — 2년물 − 기준금리 중간값 +80bp(11/23), 10/23에는 +100bp — 지금 뜻: 인상 반영이 줄어드는 중이라, 물가가 식는 발표가 이어지면 인상 가격이 빠지고 인하 기대로 넘어갈 수 있음'), 'v60.55 cross-market');
    assert.ok(lines.includes('다른 시장 금리 다음 확인(수집된 발표 일정): 다음 물가 발표 11/26 PCE (연준 기준 물가)'), 'v60.55 cross-market');
  });
  check('v60.56 cross-market: the produced record (오늘\'s static shell) carries the one synthesis line where the rows were, no head and no rows', () => {
    const record = todayVerdictFrom({ available: true, overall: '부담 우세', asOf: LAST, heroLine: 'x', counts: { favorable: 0, neutral: 2, burden: 4, unknown: 0 } }, 'now', 'm', cross);
    const ids = record.story.lines.map((line) => line.id);
    assert.deepEqual(ids.slice(0, ids.indexOf('lede') + 1), ['session', 'cross', 'lede'], 'v60.56 home-synthesis');
    assert.deepEqual(record.story.lines.find((line) => line.id === 'cross'), { id: 'cross', label: '다른 시장', text: cross.crossSummary.said.text }, 'v60.56 home-synthesis');
  });
  check('v60.56 home-synthesis: one sentence from the same rows — each state\'s markets (부담, 중립, 양호, 자료 없음), then the rate path and the next inflation release', () => {
    assert.equal(cross.crossSummary.said.text, '부담: 신용·달러. 중립: 시장 폭·금리. 양호: 변동성. 금리 경로 인상 반영, 다음 물가 발표 11/26 PCE (연준 기준 물가).', 'v60.56 home-synthesis');
    for (const bucket of cross.crossSummary.buckets) for (const name of bucket.names) assert.ok(cross.cross.some((row) => row.label === name && (row.state === bucket.state)), `v60.56 home-synthesis: ${name} is in its row's own state`);
    assert.equal(cross.crossSummary.buckets.flatMap((bucket) => bucket.names).length, cross.cross.length, 'v60.56 home-synthesis: every row once');
    const bare = buildMarketOpening({ history: day2, macroHistory: credit(3.2), regime: { ...regimeOf(), axes: regimeOf().axes.map((row) => (row.id === 'credit' ? { ...row, state: 'unknown', observation: null } : row)) }, events: [] });
    assert.equal(bare.crossSummary.said.text, '중립: 시장 폭·금리. 양호: 변동성. 자료 없음: 신용·달러. 금리 경로 자료 없음.','v60.56 home-synthesis: a row without a state and a missing path are said as 자료 없음, never dropped');
    assert.equal(buildMarketOpening({ history: markets(day2), macroHistory: pathHistory(), events: EVENTS }).crossSummary, null, 'v60.56 home-synthesis: no rows, no sentence');
    assert.deepEqual(unclaimedFigures(cross.crossSummary.said), [], 'v60.56 home-synthesis');
    assert.doesNotMatch(cross.crossSummary.said.text, /사세요|파세요|매수하|매도하|뜻합니다|\p{Extended_Pictographic}/u, 'v60.56 home-synthesis');
  });
  check('v60.56 home-synthesis: 오늘 paints the one sentence in place of the rows; 시장 상태 keeps the rows and adds the tracker under the session lines', () => {
    const node = (tag) => ({ tag, className: '', textContent: '', dataset: {}, style: {}, hidden: false, children: [], attrs: {}, append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; }, setAttribute(k, v) { this.attrs[k] = v; } });
    const doc = { createElement: node, createTextNode: (text) => ({ tag: '#text', textContent: text, children: [], dataset: {} }) };
    const all = (item) => [item, ...item.children.flatMap(all)];
    const home = node('div');
    assert.ok(paintOpening(doc, home, cross, null, { summary: true }), 'v60.56 home-synthesis');
    assert.deepEqual(home.children.slice(0, 3).map((child) => child.dataset.part), ['session', 'cross', 'lede'], 'v60.56 home-synthesis: session, the one sentence, the lede');
    assert.equal(all(home).map((part) => part.textContent).join('').includes(`다른 시장 — ${cross.crossSummary.said.text}`), true, 'v60.56 home-synthesis');
    assert.ok(!all(home).some((item) => item.className === 'opening-cross__row' || item.className === 'rebound-track'), 'v60.56 home-synthesis: no rows and no tracker on 오늘');
    const signal = node('div');
    assert.ok(paintOpening(doc, signal, cross, node('div'), { track: true }), 'v60.56 rebound-track');
    assert.deepEqual(signal.children.slice(0, 3).map((child) => child.dataset.part || child.className), ['session', 'track', 'cross'], 'v60.56 rebound-track: the tracker under the session lines, the rows after it');
    const rows = all(signal).filter((item) => item.tag === 'tr' && item.dataset.date);
    assert.deepEqual(rows.map((row) => row.dataset.date), ['2026-11-23', '2026-11-24'], 'v60.56 rebound-track: one row per session, oldest first');
  });
  check('v60.55 cross-market: the face paints the rows as one compact block before the lede and the rebound tally once, as its head (no second list under the rebound line)', () => {
    const node = (tag) => ({ tag, className: '', textContent: '', dataset: {}, style: {}, hidden: false, children: [], append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; }, setAttribute() {} });
    const doc = { createElement: node, createTextNode: (text) => ({ tag: '#text', textContent: text, children: [], dataset: {} }) };
    const host = node('div');
    assert.ok(paintOpening(doc, host, cross), 'v60.55 cross-market: painted');
    const all = (item) => [item, ...item.children.flatMap(all)];
    const textOf = (item) => all(item).map((part) => part.textContent).join('');
    assert.deepEqual(host.children.slice(0, 3).map((child) => child.dataset.part || child.className), ['session', 'cross', 'lede'], 'v60.55 cross-market: session, the other markets, then the lede');
    const rows = all(host).filter((item) => item.className === 'opening-cross__row');
    assert.deepEqual(rows.map((row) => row.dataset.check), ['credit', 'dollar', 'volatility', 'breadth', 'rates', 'rates-path'], 'v60.55 cross-market: one row per market');
    assert.deepEqual(rows.map((row) => all(row).find((item) => item.className === 'opening-cross__state').dataset.state), ['burden', 'burden', 'favorable', 'neutral', 'neutral', 'hike'], 'v60.55 cross-market: the state tag');
    assert.ok(!all(host).some((item) => item.className === 'opening-checks'), 'v60.55 cross-market: the rebound checks are not listed a second time');
    const tally = cross.rebound.quality.said.text;
    assert.equal(textOf(host).split(tally).length - 1, 1, 'v60.55 cross-market: the tally is said once, as the head of the rows');
    for (const row of rows) assert.ok(all(row).some((item) => item.className === 'opening-cross__meaning' && item.textContent) && all(row).some((item) => item.className === 'opening-cross__figures' && /\d/.test(item.textContent)), 'v60.55 cross-market: clause and figures');
  });
  check('v60.55 a screen tie picks the opening lines its screen declares, and nothing when the opening has none', () => {
    assert.deepEqual(Object.keys(SCREEN_STORY).sort(), ['breadth', 'charts', 'fxbond', 'korea', 'macro', 'sentiment', 'themes'], 'v60.55 story-tie: the screens with a tie');
    const pick = (screen) => tieLines(gave.lines, SCREEN_STORY[screen]);
    assert.deepEqual(pick('themes').own.map((line) => line.id), ['session', 'gathered', 'split'], 'v60.55 story-tie: 테마 reads the session, where it gathered and the index split');
    assert.deepEqual(pick('breadth').own.map((line) => line.id), ['session', 'split'], 'v60.55 story-tie: 시장 폭 reads the session and the index split');
    assert.deepEqual(pick('fxbond').own, [], 'v60.55 story-tie: 금리와 환율 reads no session line');
    assert.ok(pick('fxbond').cross.every((line) => ['dollar', 'rates', 'rates-path'].includes(line.key)), 'v60.55 story-tie: 금리와 환율 reads the dollar and rates rows only');
    assert.deepEqual(tieLines([], SCREEN_STORY.themes), { own: [], cross: [] }, 'v60.55 story-tie: no opening, no line');
    for (const file of ['src/ui/components/sentiment-board.js', 'src/ui/pages/market.js', 'src/ui/pages/themes.js']) assert.match(readFileSync(resolve(root, file), 'utf8'), /renderStoryTie\(/, `v60.55 story-tie: ${file} paints it`);
    assert.match(readFileSync(resolve(root, 'scripts/lib/screen-reading.mjs'), 'utf8'), /story: SCREEN_STORY\.themes/, 'v60.55 story-tie: the AI packet reads the same registry');
  });
  report('session-read');
}, 'code'],
// ---- each screen's own sentence under its story tie (src/domain/market/story/screen-tie.js) ------------------------------
['screen-tie', async () => {
  const { screenTieOf, sessionShapeOf, SCREEN_TIE_IDS, SCREEN_TIE_STATES } = await import('../src/domain/market/story/screen-tie.js');
  const { SCREEN_TIE_SHAPES, SCREEN_TIE_WORDS } = await import('../src/domain/content/screen-tie-words.js');
  const D = SESSIONS.at(-1);
  const SHAPES = ['leaders-down', 'leaders-more-down', 'broad-down', 'leaders-up', 'leaders-more-up', 'broad-up'];
  // The leaders' and the equal weight's one-session moves that give each shape (RULES.sessionRead: movePct 1, leadGapPp 1).
  const MOVES = { 'leaders-down': [-2, 0.5], 'leaders-more-down': [-2.5, -0.8], 'broad-down': [-1.5, -1.2], 'leaders-up': [2, -0.3], 'leaders-more-up': [2.5, 0.8], 'broad-up': [1.5, 1.3] };
  const openingOf = (ndx, rsp, asOf = D) => ({ available: true, asOf, rows: { ndx: { moves: [null, ndx] }, ...(rsp == null ? {} : { rsp: { moves: [null, rsp] } }) } });
  const regimeOf = (axes = [], watchAxes = []) => ({ available: true, asOf: D, axes, watchAxes });
  const tnxHistory = (from, to) => SESSIONS.slice(-30).map((date, i, list) => ({ date, spx: 6000, tnx: +(from + (to - from) * (i / (list.length - 1))).toFixed(3), breadth50: 55 }));
  const macroHistory = (then, now) => ({ series: { dgs2: { observations: [[SESSIONS.at(-25), then], [D, now]] },
    fedTargetLower: { observations: [[SESSIONS.at(-60), 3.75]] }, fedTargetUpper: { observations: [[SESSIONS.at(-60), 4]] } } });
  const playbookOf = (market, states, basis = D, lagging = false) => ({ available: true, asOfByMarket: { [market]: basis }, lagging: { [market]: lagging }, themes: states.map((state, i) => ({ market, id: `t${i}`, state })) });
  const sentimentRead = (state, fear, greed, overheated = false) => ({ state, overheated, ready: Array.from({ length: 6 }, (_, i) => i), fear: Array.from({ length: fear }), greed: Array.from({ length: greed }) });
  // One input per (screen, state): the screen's own verdict as the existing reader hands it.
  const INPUTS = {
    breadth: (state) => ({ regime: regimeOf([{ id: 'breadth', state }]), history: tnxHistory(4, 4) }),
    sentiment: (state) => {
      const axis = state === 'fear' ? 'burden' : 'neutral';
      return { regime: regimeOf([], [{ id: 'sentiment', state: axis }]), sentiment: sentimentRead(axis, state === 'fear' ? 4 : 1, state === 'greed' ? 4 : 0, state === 'greed') };
    },
    macro: (state) => ({ macroHistory: macroHistory(3.9, { down: 3.7, flat: 3.85, up: 4.1 }[state]) }),
    fxbond: (state) => ({ regime: regimeOf([{ id: 'rates', state: state === 'growthScare' ? 'neutral' : state, growthScare: state === 'growthScare' }]),
      history: tnxHistory(4.3, { favorable: 4.0, neutral: 4.35, growthScare: 4.05, burden: 4.6 }[state]) }),
    themes: (state) => ({ playbook: playbookOf('US', state === 'lead' ? ['leading', 'weak', 'inline'] : ['weak', 'inline']) }),
    korea: (state) => ({ playbook: playbookOf('KR', state === 'lead' ? ['leading', 'weak'] : ['weak'], '2026-12-01') }),
    charts: (state) => ({ readings: [{ field: 'ndx', asOf: D, trend: { above: 'up', near: 'near50', pullback: 'pullback', under: 'down' }[state], s50: -1.2, s200: 3.4 }] })
  };
  const keysOf = (screen) => [...new Set(Object.values(SCREEN_TIE_SHAPES[screen]))].flatMap((shapeClass) => SCREEN_TIE_STATES[screen].map((state) => `${shapeClass}:${state}`));
  check('v60.56 screen-tie: the session shape is the session read\'s, and a quiet or half-read session has none', () => {
    for (const shape of SHAPES) assert.equal(sessionShapeOf(openingOf(...MOVES[shape])), shape, `v60.56 screen-tie: ${shape}`);
    assert.equal(sessionShapeOf(openingOf(-0.6, 0.4)), null, 'v60.56 screen-tie: a Nasdaq-100 move under 1% has no shape');
    assert.equal(sessionShapeOf(openingOf(-2, null)), null, 'v60.56 screen-tie: no equal weight, no shape');
    assert.deepEqual(SCREEN_TIE_IDS.slice().sort(), ['breadth', 'charts', 'fxbond', 'korea', 'macro', 'sentiment', 'themes'], 'v60.56 screen-tie: seven screens');
  });
  check('v60.56 screen-tie: every key of each table (shape class × the screen\'s states) is reached by its reader, and the table has no other key', () => {
    for (const screen of SCREEN_TIE_IDS) {
      assert.deepEqual(Object.keys(SCREEN_TIE_WORDS[screen]).sort(), keysOf(screen).sort(), `v60.56 screen-tie: ${screen} table keys`);
      const reached = new Set();
      for (const shape of SHAPES) for (const state of SCREEN_TIE_STATES[screen]) {
        const tie = screenTieOf(screen, { opening: openingOf(...MOVES[shape]), ...INPUTS[screen](state) });
        assert.ok(tie, `v60.56 screen-tie: ${screen} ${shape} ${state} gives a sentence`);
        assert.equal(tie.key, `${SCREEN_TIE_SHAPES[screen][shape]}:${state}`, `v60.56 screen-tie: ${screen} ${shape} ${state}`);
        reached.add(tie.key);
      }
      assert.deepEqual([...reached].sort(), keysOf(screen).sort(), `v60.56 screen-tie: ${screen} reaches every key`);
    }
  });
  check('v60.56 screen-tie: every figure is a claim, no sentence passes 70 characters, and no ending repeats more than twice in a screen', () => {
    for (const screen of SCREEN_TIE_IDS) {
      for (const state of SCREEN_TIE_STATES[screen]) for (const shape of SHAPES) {
        const { said } = screenTieOf(screen, { opening: openingOf(...MOVES[shape]), ...INPUTS[screen](state) });
        assert.deepEqual(unclaimedFigures(said), [], `v60.56 screen-tie: ${screen} ${state}: ${said.text}`);
        assert.ok(said.text.length <= 70, `v60.56 screen-tie: ${screen} ${state} length ${said.text.length}: ${said.text}`);
        assert.doesNotMatch(said.text, /뜻합니다|읽습니다|자리/, `v60.56 screen-tie: ${screen} no lecture: ${said.text}`);
      }
      const ends = Object.values(SCREEN_TIE_WORDS[screen]).map((text) => text.trim().split(/\s+/).at(-1));
      for (const end of new Set(ends)) assert.ok(ends.filter((item) => item === end).length <= 2, `v60.56 screen-tie: ${screen} ends "${end}" more than twice`);
    }
  });
  check('v60.56 screen-tie: a missing shape, state, figure or session gives no sentence', () => {
    const down = openingOf(...MOVES['leaders-down']);
    const none = (screen, input, label) => assert.equal(screenTieOf(screen, input), null, `v60.56 screen-tie: ${screen} ${label}`);
    for (const screen of SCREEN_TIE_IDS) {
      none(screen, { opening: openingOf(0.4, 0.2), ...INPUTS[screen](SCREEN_TIE_STATES[screen][0]) }, 'quiet session');
      none(screen, { opening: { available: false }, ...INPUTS[screen](SCREEN_TIE_STATES[screen][0]) }, 'no opening');
      none(screen, { opening: down }, 'no state input');
    }
    none('breadth', { opening: down, regime: { ...regimeOf([{ id: 'breadth', state: 'burden' }]), asOf: SESSIONS.at(-2) }, history: tnxHistory(4, 4) }, 'regime of another session');
    none('breadth', { opening: down, regime: regimeOf([{ id: 'breadth', state: 'unknown' }]), history: tnxHistory(4, 4) }, 'unknown axis');
    none('breadth', { opening: down, regime: regimeOf([{ id: 'breadth', state: 'burden' }]), history: tnxHistory(4, 4).map((row) => ({ ...row, breadth50: row.date === D ? null : 50 })) }, 'no breadth on the session');
    none('sentiment', { opening: down, regime: regimeOf([], [{ id: 'sentiment', state: 'burden' }]), sentiment: sentimentRead('neutral', 1, 0) }, 'a read that disagrees with the row');
    none('macro', { opening: down, macroHistory: { series: { dgs2: { observations: [[D, 3.7]] }, fedTargetLower: { observations: [[D, 3.75]] }, fedTargetUpper: { observations: [[D, 4]] } } } }, 'no month-earlier 2-year');
    none('fxbond', { opening: down, regime: regimeOf([{ id: 'rates', state: 'neutral' }]), history: tnxHistory(4, 4).slice(-5) }, 'no 20-session change');
    none('themes', { opening: down, playbook: playbookOf('US', ['leading'], SESSIONS.at(-2)) }, 'stages of another session');
    none('themes', { opening: down, playbook: playbookOf('US', ['leading'], D, true) }, 'lagging stages');
    none('korea', { opening: down, playbook: playbookOf('KR', ['leading'], D) }, 'a Korean session not after the US one');
    none('charts', { opening: down, readings: [{ field: 'ndx', asOf: SESSIONS.at(-2), trend: 'up', s50: 1, s200: 2 }] }, 'a card on another close');
    none('charts', { opening: down, readings: [{ field: 'spx', asOf: D, trend: 'up', s50: 1, s200: 2 }] }, 'no 나스닥100 card');
  });
  check('v60.56 screen-tie: the tie paints the screen\'s sentence first, and 테마·한국·기술적 분석 hand it what only the page holds', () => {
    const tie = readFileSync(resolve(root, 'src/ui/components/story-tie.js'), 'utf8');
    assert.match(tie, /replaceChildren\(\.\.\.\(tie \? \[openingLine\(doc, \{ id: 'tie'/, 'v60.56 screen-tie: the own sentence leads the tie');
    const themesPage = readFileSync(resolve(root, 'src/ui/pages/themes.js'), 'utf8');
    assert.match(themesPage, /renderStoryTie\(\{ documentRef, root, screen: 'themes', context: \{ playbook \} \}\)/, 'v60.56 screen-tie: 테마 passes the playbook');
    assert.match(themesPage, /renderStoryTie\(\{ documentRef, root, screen: 'korea', context: \{ playbook, extra \} \}\)/, 'v60.57 korea-link: 한국 passes the playbook and its link lines');
    assert.match(readFileSync(resolve(root, 'src/ui/pages/charts.js'), 'utf8'), /renderStoryTie\(\{ documentRef, root, screen: 'charts', context: \{ readings: list \} \}\)/, 'v60.56 screen-tie: 기술적 분석 passes its drawn cards');
    assert.match(readFileSync(resolve(root, 'src/ui/styles/v2-market.css'), 'utf8'), /\.story-tie \.opening-line\[data-part="tie"\] \{ font-size: 14px; font-weight: 600;/, 'v60.56 screen-tie: primary 14px weight 600');
  });
  report('screen-tie');
}, 'code'],
['korea-link', async () => {
  const { koreaSessionLink } = await import('../src/domain/market/korea/korea-session-link.js');
  const { KOREA_LINK_WORDS: W } = await import('../src/domain/content/korea-link-words.js');
  const sessionsOf = (market, through) => {
    const out = [];
    for (let t = Date.parse('2026-08-03T12:00:00Z'); ; t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      if (date > through) break;
      if (resolveMarketCalendarSession({ market, date }).status === 'open') out.push(date);
    }
    return out;
  };
  // Flat closes, then `moves` (percent) on the last sessions.
  const closesWith = (dates, moves) => { let value = 100; const start = dates.length - moves.length; return dates.map((_, i) => (i >= start ? (value *= 1 + moves[i - start] / 100) : value)); };
  const linkHistory = ({ usMoves = [1], krMoves = [1], usThrough = '2026-11-19', krThrough = '2026-11-20' } = {}) => {
    const rows = new Map();
    const put = (dates, field, values) => dates.forEach((date, i) => rows.set(date, { ...(rows.get(date) || { date }), [field]: values[i] }));
    const us = sessionsOf('US', usThrough); const kr = sessionsOf('KR', krThrough);
    put(us, 'sox', closesWith(us, usMoves)); put(kr, 'kospi', closesWith(kr, krMoves));
    return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
  };
  const flowsOf = (date, value, sum5, sum20) => ({ state: 'ok', markets: [{ id: 'kospi', label: '코스피', date,
    rows: [{ id: 'foreign', label: '외국인', value, date }], trends: [{ id: 'foreign', label: '외국인', points: [], sum5, sum20, sessions: 20 }] }] });
  const lineOf = (link, id) => link?.lines.find((line) => line.id === id)?.said || null;
  const unclaimed = (link) => link.lines.flatMap((line) => unclaimedFigures(line.said));
  check('v60.57 korea-link: a KOSPI session follows the latest US session before it; pending while the US session is not before the KOSPI one', () => {
    const reflected = koreaSessionLink({ history: linkHistory({ usMoves: [-3], krMoves: [-2] }) });
    assert.equal(reflected.state, 'reflected', 'v60.57 korea-link: US 11/19 then KOSPI 11/20 is reflected');
    assert.deepEqual([reflected.us.date, reflected.kr.date], ['2026-11-19', '2026-11-20'], 'v60.57 korea-link: the dates');
    assert.equal(lineOf(reflected, 'korea-pending'), null, 'v60.57 korea-link: no pending line once reflected');
    assert.equal(lineOf(reflected, 'korea-pair').text, '11/19 미국 반도체 -3.0% 뒤 11/20 코스피는 -2.0%로 같은 방향이었습니다.', 'v60.57 korea-link: the pair line');
    const pending = koreaSessionLink({ history: linkHistory({ usMoves: [-3, 2], krMoves: [-2], usThrough: '2026-11-20' }) });
    assert.equal(pending.state, 'pending', 'v60.57 korea-link: US 11/20 with KOSPI 11/20 is pending');
    assert.deepEqual(pending.lines.map((line) => line.id), ['korea-pending', 'korea-pair'], 'v60.57 korea-link: pending leads');
    assert.equal(lineOf(pending, 'korea-pending').text, '11/20 미국 반도체 +2.0%는 아직 한국 장에 반영되지 않았습니다.', 'v60.57 korea-link: the pending line');
    assert.match(lineOf(pending, 'korea-pair').text, /^11\/19 미국 반도체 -3\.0% 뒤 11\/20 코스피는/, 'v60.57 korea-link: KOSPI 11/20 pairs with US 11/19, not 11/20');
    assert.deepEqual(unclaimed(pending), [], 'v60.57 korea-link: every figure printed from a claim');
    assert.equal(koreaSessionLink({ history: linkHistory().map(({ kospi, ...row }) => row) }), null, 'v60.57 korea-link: no KOSPI, no link');
    assert.equal(koreaSessionLink({ history: linkHistory().map(({ sox, ...row }) => row) }), null, 'v60.57 korea-link: no semis, no link');
  });
  check('v60.57 korea-link: same direction, opposite, and a KOSPI move too small to have a direction', () => {
    const pair = (krMove) => lineOf(koreaSessionLink({ history: linkHistory({ usMoves: [2], krMoves: [krMove] }) }), 'korea-pair').text;
    assert.equal(pair(1.5), '11/19 미국 반도체 +2.0% 뒤 11/20 코스피는 +1.5%로 같은 방향이었습니다.', 'v60.57 korea-link: same');
    assert.equal(pair(-1.5), '11/19 미국 반도체 +2.0% 뒤 11/20 코스피는 -1.5%로 반대로 움직였습니다.', 'v60.57 korea-link: opposite');
    assert.equal(pair(-0.2), '11/19 미국 반도체 +2.0% 뒤 11/20 코스피는 -0.2%로 거의 움직이지 않았습니다.', 'v60.57 korea-link: flat');
  });
  check('v60.57 korea-link: the foreign-flow line and its meaning by the day, the 5- and 20-session sums and the KOSPI move', () => {
    const flows = (krMove, value, sum5, sum20) => lineOf(koreaSessionLink({ history: linkHistory({ krMoves: [krMove] }), flows: flowsOf('2026-11-20', value, sum5, sum20) }), 'korea-flows')?.text || '';
    assert.equal(flows(1, 8130, -12877, -147073), `외국인은 코스피에서 11/20 +8,130억, 5거래일 합 -1.3조, 20거래일 합 -15조입니다. ${W.meaning['buy-early']}`, 'v60.57 korea-link: buy day inside a 20-session sell');
    assert.ok(flows(1, 8130, 3000, -147073).endsWith(W.meaning['buy-turning']), 'v60.57 korea-link: the 5-session sum turned');
    assert.ok(flows(1, -5000, -9000, -40000).endsWith(W.meaning['sell-up']), 'v60.57 korea-link: KOSPI up without foreign buying');
    assert.ok(flows(-1, -5000, -9000, -40000).endsWith(W.meaning['sell-down']), 'v60.57 korea-link: foreign selling with the fall');
    assert.ok(flows(1, 5000, 9000, 40000).endsWith(W.meaning['buy-ongoing']), 'v60.57 korea-link: buying on a 20-session buy');
    assert.ok(flows(-1, -5000, 9000, 40000).endsWith(W.meaning['sell-holding']), 'v60.57 korea-link: a sell day inside a 20-session buy');
    assert.equal(flows(1, 8130, -12877, null), '외국인은 코스피에서 11/20 +8,130억, 5거래일 합 -1.3조입니다.', 'v60.57 korea-link: no 20-session sum, no meaning and no sum printed');
    assert.equal(flows(1, 8130, null, -147073), '외국인은 코스피에서 11/20 +8,130억, 20거래일 합 -15조입니다.', 'v60.57 korea-link: a missing 5-session sum is omitted');
    const link = koreaSessionLink({ history: linkHistory({ krMoves: [1] }), flows: flowsOf('2026-11-20', 8130, -12877, -147073) });
    assert.deepEqual(unclaimed(link), [], 'v60.57 korea-link: the amounts are claims');
    assert.deepEqual(link.factLines.map((line) => line.split(': ')[0]), ['미국장과 한국장', '외국인 수급'], 'v60.57 korea-link: AI fact prefixes');
  });
  check('v60.57 korea-link: flows of another day keep their own date and are read against that day\'s KOSPI move', () => {
    // KOSPI 11/19 rose, 11/20 fell; the flows are 11/19's.
    const link = koreaSessionLink({ history: linkHistory({ krMoves: [1, -2] }), flows: flowsOf('2026-11-19', -5000, -9000, -40000) });
    const text = lineOf(link, 'korea-flows').text;
    assert.match(text, /^외국인은 코스피에서 11\/19 -5,000억/, 'v60.57 korea-link: the flow line states 11/19');
    assert.ok(text.endsWith(W.meaning['sell-up']), 'v60.57 korea-link: read against KOSPI 11/19 (up), not 11/20 (down)');
    const gap = koreaSessionLink({ history: linkHistory({ krMoves: [1, -2] }).map(({ kospi, ...row }) => (row.date === '2026-11-18' ? row : { ...row, kospi })), flows: flowsOf('2026-11-19', -5000, -9000, -40000) });
    assert.equal(lineOf(gap, 'korea-flows').text, '외국인은 코스피에서 11/19 -5,000억, 5거래일 합 -9,000억, 20거래일 합 -4.0조입니다.', 'v60.57 korea-link: no KOSPI move that day, no sign-dependent meaning');
  });
  check('v60.57 korea-link: without flows (missing, loading, or no current foreign value) only the session lines remain', () => {
    for (const flows of [null, { state: 'loading' }, flowsOf('2026-11-20', null, null, null)]) {
      const link = koreaSessionLink({ history: linkHistory(), flows });
      assert.deepEqual(link.lines.map((line) => line.id), ['korea-pair'], `v60.57 korea-link: ${JSON.stringify(flows)?.slice(0, 40)}`);
    }
  });
  check('v60.57 korea-link: 한국 does not take the opening\'s split line (S&P 500 sector contributions name no Korean stock)', () => {
    assert.ok(!SCREEN_STORY.korea.includes('split'), 'v60.57 korea-link: SCREEN_STORY.korea');
  });
  report('korea-link');
}, 'code']
]);
console.log('market-story: all checks passed');
