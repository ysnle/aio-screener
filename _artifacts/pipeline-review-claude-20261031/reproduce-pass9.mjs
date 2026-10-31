// Audit only: pure functions; no network or public-data writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { reconstructScore } from '../../scripts/backtest-trading-score.mjs';
import { reconstructRelativeScore } from '../../scripts/backtest-trading-score-longrun.mjs';
import { themeStateOutcomes, pastEvidence } from '../../src/domain/scenarios/analogs.js';
const prices = { spxPrice: 95, spx50ma: 90, spx200ma: 100 };
const baseInput = { ...prices, vix: 20, fg: 45, dxy: 104, tnx: 4.3, wti: 70, vvix: 100, hyg: 78 };
const baseline = reconstructScore(baseInput);
const relative = reconstructRelativeScore({ ...prices, vixP: .5, dxyP: .5, tnxP: .5, wtiP: .5, vvixP: .5 });
assert.equal(baseline.trendScore, 15);
assert.equal(relative.trendScore, 82);
const fgScores = [null, 0, 45, 100].map(fg => reconstructScore({ ...baseInput, fg }).total);
assert.equal(new Set(fgScores).size, 1);
const dates = Array.from({ length: 2500 }, (_, i) => new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10));
const a = dates.map((date, i) => [date, 100 * 1.002 ** i]);
const b = dates.map((date, i) => [date, i < 1500 ? 10000 - i : 100 * 1.002 ** i]);
const benchmark = dates.slice(1500).map(date => [date, 100]);
const first = themeStateOutcomes(a, { benchmark, benchmarkField: 'rsp' }).leading;
const second = themeStateOutcomes(b, { benchmark, benchmarkField: 'rsp' }).leading;
const omitBase = row => Object.fromEntries(Object.entries(row).filter(([key]) => !['baseN', 'baseUpPct'].includes(key)));
assert.deepEqual(omitBase(first), omitBase(second));
assert.notEqual(pastEvidence(first).informative, pastEvidence(second).informative);
const history = JSON.parse(fs.readFileSync('public-data/history.json', 'utf8'));
const seen = new Set();
const sessions = history.filter(row => {
  if (!Number.isFinite(row?.spx) || row.fieldMeta?.spx?.observationRelation === 'carried-forward') return false;
  const day = row.fieldMeta?.spx?.sessionDate;
  if (day && seen.has(day)) return false;
  if (day) seen.add(day);
  return true;
});
const report = { at: new Date().toISOString(), modelComparison: { baseline, relative, fgScores },
  historyFgGate: { eligibleSessions: sessions.length, omitted: sessions.filter(row => !Number.isFinite(row.fg)).length },
  themeBase: { synthetic: true, calendar: 'consecutive synthetic observations, not real exchange sessions', testableN: 811, first, second,
    firstEvidence: pastEvidence(first), secondEvidence: pastEvidence(second) } };
fs.writeFileSync(new URL('./pass9-reproductions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
