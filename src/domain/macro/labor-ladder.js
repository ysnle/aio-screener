// 고용 둔화 단계: the five-step order a labour slowdown runs through (2035019569706770872) — openings and hours shrink, then
// hiring and layoffs both fall, wage growth slows, re-entrants rise, and last layoffs surge. Each rung is met, not met or
// unread (series not published); the stage is the highest rung met. The unemployment-rate change is split into the
// unemployed (numerator) and the labour force (denominator) of the same household-survey months. Facts and state words only.
import { RULES } from '../rules/thresholds.js';
import { STATE_LABELS } from '../market/interpretation/concepts.js';
import { claimsTrend, monthIndex, sahmGap, seriesOf, yoySeries } from './macro-read.js';

// A rung's direction: the latest three-month average against the same three months a year earlier (one year apart keeps
// the season out); every month must be published (a skipped month leaves the rung unread).
export const LABOR_RULES = Object.freeze({ averageMonths: 3, againstMonths: 12 });
export const LABOR_STAGES = Object.freeze([
  Object.freeze({ id: 'openings', short: '구인', label: '구인·근로시간 축소' }),
  Object.freeze({ id: 'hiring', short: '채용', label: '채용·해고 감소' }),
  Object.freeze({ id: 'wages', short: '임금', label: '임금 상승률 둔화' }),
  Object.freeze({ id: 'reentry', short: '재진입', label: '재진입자 증가' }),
  Object.freeze({ id: 'layoffs', short: '해고', label: '해고 급증' })
]);
export const SPLIT_WORDS = Object.freeze({ entry: '참여 늘며 상승', loss: '실업자 늘며 상승', exit: '이탈하며 하락', jobs: '고용 늘며 하락', flat: '변화 없음', undivided: '가르지 않음' });

function yearTrend(rows) {
  const { averageMonths: n, againstMonths: back } = LABOR_RULES;
  const byMonth = new Map(rows.map((row) => [monthIndex(row.date), row]));
  const last = rows.at(-1);
  if (!last) return null;
  const avg = (end) => { const got = Array.from({ length: n }, (_, k) => byMonth.get(end - k)); return got.every(Boolean) ? got.reduce((sum, row) => sum + row.value, 0) / n : null; };
  const end = monthIndex(last.date);
  const now = avg(end), then = avg(end - back);
  return now == null || then == null ? null : { date: last.date, now, then, dir: now > then ? 'up' : now < then ? 'down' : 'flat' };
}
// One month's value against the month before it (calendar-adjacent), or null.
function monthStep(rows) {
  const [a, b] = rows.slice(-2);
  return a && b && monthIndex(b.date) - monthIndex(a.date) === 1 ? { from: a.date, date: b.date, before: a.value, value: b.value, change: b.value - a.value } : null;
}

/** The ladder: each rung { id, label, met: true | false | null, … } and the stage reached (0 = no rung met). */
export function laborLadder(macroHistory) {
  const G = RULES.growth;
  const of = (id) => seriesOf(macroHistory, id);
  const openings = yearTrend(of('jobOpenings')); const hours = yearTrend(of('weeklyHours'));
  const hires = yearTrend(of('jobHires')); const layoffs = yearTrend(of('jobLayoffs'));
  const reentry = yearTrend(of('reentrants'));
  const wageYoy = yoySeries(of('hourlyEarnings'));
  const wageNow = wageYoy.at(-1) || null;
  const wageThen = wageNow ? wageYoy.find((row) => monthIndex(row.date) === monthIndex(wageNow.date) - LABOR_RULES.againstMonths) || null : null;
  const sahm = sahmGap(of('unemployment'));
  const claims = claimsTrend(of('initialClaims'));
  const surge = [layoffs ? layoffs.dir === 'up' : null, claims ? claims.aboveLow >= G.claimsRiseAbovePct : null, sahm ? sahm.value >= G.sahmRecessionAt : null];
  const rungs = [
    { met: openings ? openings.dir === 'down' && (!hours || hours.dir === 'down') : null, facts: { openings, hours } },
    { met: hires && layoffs ? hires.dir === 'down' && layoffs.dir !== 'up' : null, facts: { hires, layoffs } },
    { met: wageNow && wageThen ? wageNow.value < wageThen.value : null, facts: { wageNow, wageThen } },
    { met: reentry ? reentry.dir === 'up' : null, facts: { reentry } },
    { met: surge.some((value) => value === true) ? true : surge.some((value) => value === false) ? false : null, facts: { layoffs, claims, sahm } }
  ].map((rung, index) => ({ ...LABOR_STAGES[index], ...rung }));
  const known = rungs.filter((rung) => rung.met !== null);
  // The steps run in order: a rung counts only while no earlier rung is read as not met (an unread rung does not block).
  // A layoff surge is stage 5 on its own (the post's 5단계 진입 signal).
  const firstNo = rungs.findIndex((rung) => rung.met === false);
  const stage = rungs.at(-1).met ? rungs.length : rungs.slice(0, firstNo < 0 ? rungs.length : firstNo).reduce((top, rung, index) => (rung.met ? index + 1 : top), 0);
  const state = !known.length ? 'unknown' : stage === 0 ? 'before' : `stage${stage}`;
  return { state, stage, label: !known.length ? STATE_LABELS.unknown : stage === 0 ? '1단계 전' : `둔화 ${stage}단계`, rungs, known: known.length, sahm, claims };
}

/**
 * The unemployment-rate change of one month split exactly: numerator (ΔU / L₁) + denominator (U₀ · (1/L₁ − 1/L₀)), in %p,
 * from the same two household-survey months; the published rate change and U-6 of those months beside it.
 */
export function unemploymentSplit(macroHistory) {
  const of = (id) => seriesOf(macroHistory, id);
  const u = monthStep(of('unemployed')); const l = monthStep(of('laborForce'));
  if (!u || !l || u.date !== l.date || u.from !== l.from) return null;
  const numeratorPp = (u.value - u.before) / l.value * 100;
  const denominatorPp = u.before * (1 / l.value - 1 / l.before) * 100;
  const changePp = numeratorPp + denominatorPp;
  const same = (step) => (step && step.date === u.date && step.from === u.from ? step : null);
  const published = same(monthStep(of('unemployment')));
  const u6 = same(monthStep(of('u6')));
  const reentry = same(monthStep(of('reentrants')));
  const shown = Math.round(changePp * 10) / 10;
  const kind = shown === 0 ? 'flat'
    : shown > 0 ? (l.change > 0 ? (reentry ? (reentry.change > 0 ? 'entry' : 'loss') : 'undivided') : 'loss')
      : l.change < 0 ? 'exit' : 'jobs';
  return { from: u.from, date: u.date, numeratorPp, denominatorPp, changePp, publishedPp: published ? published.change : null,
    unemployedK: u.change, laborForceK: l.change, u6Pp: u6 ? u6.change : null, reentrantsK: reentry ? reentry.change : null, kind, label: SPLIT_WORDS[kind] };
}
