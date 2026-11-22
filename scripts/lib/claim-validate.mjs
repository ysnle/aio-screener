// The sentence-claim checker: a claim (src/domain/shared/claim.js) against the facts it came from. Pure; never imported
// by browser code. It checks facts, never opinions: a word is held only to what its vocabulary entry asserts (a sign, a
// rank, an index direction, a size grade, a relation to a line), each against values the facts carry. The figure rules
// are the AI answer checker's (src/domain/shared/figure-agreement.js), so text written by the model and text written
// by code agree with their data by one rule set.
//
// facts: { [subject]: { asOf, asOfBy?: { [measure]: day }, values: { [measure]: number }, members?: { [id]: number },
//          sd?: { [measure]: { sd, sessions } } } }
import { CLAIM_WORDS, figureDigits, figureText, printedValue as printed, thresholdText } from '../../src/domain/shared/claim.js';
import { moveGrade } from '../../src/domain/market/session/move-size.js';
import { printedValueAgrees, signAgrees, directionAgrees, sizeWordAgrees, numericFieldsMissing } from '../../src/domain/shared/figure-agreement.js';

/** The defect classes, in report order: a-rank … f-asof, then the plain figure checks; 'unlinked' (a warning) last. */
export const CLAIM_CHECKS = Object.freeze(['a-rank', 'b-index', 'c-size', 'd-relation', 'e-label', 'f-asof', 'direction', 'same-way', 'value', 'shape', 'unlinked']);

const valueOf = (facts, subject, measure) => {
  const value = facts?.[subject]?.values?.[measure];
  return Number.isFinite(value) ? value : null;
};
const RELATIONS = Object.freeze({ above: (a, b) => a > b, below: (a, b) => a < b, atLeast: (a, b) => a >= b, atMost: (a, b) => a <= b });

/**
 * @param {object} claim
 * @param {object} facts
 * @param {{text?: string}} [options] the composed text the claim is printed in (for the label check)
 * @returns {Array<{check:string, level:'error'|'warning', subject:string, message:string}>} — level 'warning' is the
 *   'unlinked' outcome: a date, figure or comparison the facts hold nothing for, so it was not compared (not verified).
 */
export function claimIssues(claim, facts, { text = null } = {}) {
  const issues = [];
  const flag = (check, message) => issues.push({ check, level: 'error', subject: claim?.subject, message });
  // Nothing to compare is its own outcome, not a pass: a warning callers count and show (interpretation never blocks).
  const unlinked = (message) => issues.push({ check: 'unlinked', level: 'warning', subject: claim?.subject, message });
  const word = claim?.word ? CLAIM_WORDS[claim.word] : null;
  if (claim?.word && !word) flag('shape', `unknown word ${claim.word}`);
  const figures = Array.isArray(claim?.figures) ? claim.figures : [];
  const own = facts?.[claim?.subject] || null;
  if (!own) unlinked(`${claim?.subject}/${claim?.measure} has no facts to compare its date and figures with`);

  // (f) the claim's date is the date of the data its figures came from.
  const wantDay = own?.asOfBy?.[claim.measure] ?? own?.asOf ?? null;
  if (!claim?.asOf) flag('f-asof', `${claim?.subject}/${claim?.measure} has no asOf`);
  else if (wantDay && claim.asOf !== wantDay) flag('f-asof', `${claim.subject}/${claim.measure} dated ${claim.asOf}, its data is ${wantDay}`);
  else if (own && !wantDay) unlinked(`${claim.subject}/${claim.measure}: its facts carry no date to compare ${claim.asOf} with`);

  for (const figure of figures) {
    for (const missing of numericFieldsMissing({ value: figure.value, unit: figure.unit, asOf: claim.asOf })) if (missing !== 'as_of_missing') flag('shape', `${figure.label || '?'}: ${missing}`);
    // (e) every figure says what it is, and the text prints that label.
    if (!String(figure.label || '').trim()) flag('e-label', `${claim.subject}/${claim.measure} figure ${figure.value} has no label`);
    else if (text != null && !text.includes(figure.label)) flag('e-label', `${claim.subject}: label "${figure.label}" is not printed beside ${figureText(figure)}`);
    // The printed figure is its fact (the AI checker's rounding and sign rules).
    const fact = figure.basis === 'member' ? own?.members?.[figure.label] : valueOf(facts, claim.subject, figure.basis);
    if (own && !Number.isFinite(fact) && Number.isFinite(figure.value)) unlinked(`${claim.subject}/${figure.basis}: no fact for ${figureText(figure)}`);
    if (Number.isFinite(fact) && Number.isFinite(figure.value)) {
      const written = Math.abs(printed(figure));
      const sign = figure.unit === 'pct' || figure.unit === 'bp' ? Math.sign(printed(figure)) : 0;
      if (!printedValueAgrees(written, figureDigits(figure), fact) || !signAgrees(sign, fact)) flag('value', `${claim.subject}/${figure.basis} printed ${figureText(figure)}, data ${fact}`);
    }
  }
  if (!word) return issues;

  // The value the word judges: the subject's measure in the facts, else the claim's first figure.
  const judged = valueOf(facts, claim.subject, claim.measure) ?? (Number.isFinite(figures[0]?.value) ? figures[0].value : null);
  const ranked = word.rank ? (figures.length ? figures.filter((figure) => figure.basis === 'member').map((figure) => ({ id: figure.label, value: figure.value })) : judged == null ? [] : [{ id: claim.subject, value: judged }]) : [];

  if (word.sign) {
    if (word.rank) { for (const row of ranked) if (!directionAgrees(word.sign, row.value)) flag('direction', `"${word.text}" names ${row.id} at ${row.value}`); }
    else if (!directionAgrees(word.sign, judged)) flag('direction', `"${word.text}" on ${claim.subject}/${claim.measure} ${judged}`);
  }

  // (a) a superlative holds against every member of its group and beyond the group's median.
  if (word.rank) {
    const among = facts?.[claim.rank?.among];
    if (!claim.rank?.among) flag('a-rank', `"${word.text}" without a group`);
    else if (!among) unlinked(`"${word.text}" ranks within ${claim.rank.among}, which has no facts`);
    else {
      const key = (value) => (word.sign ? word.sign * value : Math.abs(value));
      const names = new Set(ranked.map((row) => row.id));
      const others = Object.entries(among.members || {}).filter(([id, value]) => !names.has(id) && Number.isFinite(value));
      const floor = Math.min(...ranked.map((row) => key(row.value)));
      const beat = others.filter(([, value]) => key(value) > floor);
      if (beat.length) flag('a-rank', `"${word.text}" (${[...names].join(', ')}) in ${claim.rank.among}, but ${beat.map(([id, value]) => `${id} ${value}`).join(', ')} moved more`);
      const median = among.values?.median;
      if (word.sign && Number.isFinite(median)) for (const row of ranked) if (key(row.value) < key(median)) flag('a-rank', `"${word.text}" ${row.id} ${row.value} is short of the ${claim.rank.among} median ${median}`);
    }
  }

  // (b) a participation word asserts the index's own direction.
  const against = claim.compare?.against;
  const againstValue = against ? valueOf(facts, against, claim.compare.measure || claim.measure) : null;
  if (against && againstValue == null && (word.index || word.same || word.relation)) unlinked(`"${word.text}" compares with ${against}/${claim.compare.measure || claim.measure}, which has no fact`);
  if (word.index && againstValue != null && !directionAgrees(word.index, againstValue)) flag('b-index', `"${word.text}" while ${against}/${claim.compare.measure || claim.measure} is ${againstValue}`);
  if (word.same && againstValue != null && judged != null && judged !== 0 && againstValue !== 0 && Math.sign(judged) !== Math.sign(againstValue)) flag('same-way', `"${word.text}": ${claim.subject} ${judged} vs ${against} ${againstValue}`);

  // (c) a size word agrees with the move's grade on its own volatility.
  if (word.size) {
    const scale = own?.sd?.[claim.measure];
    const grade = scale && judged != null ? moveGrade(judged, scale.sd, scale.sessions) : null;
    if (!sizeWordAgrees(word.size, grade)) flag('c-size', `"${word.text}" on ${claim.subject}/${claim.measure} ${judged} graded ${grade}`);
  }

  // (d) a word that places the figure against a line holds on the printed value.
  if (word.relation) {
    if (claim.compare?.relation && claim.compare.relation !== word.relation) flag('d-relation', `"${word.text}" is ${word.relation}, the claim compares ${claim.compare.relation}`);
    const figure = figures[0];
    const line = Number.isFinite(claim.compare?.threshold) ? (figure ? printed({ ...figure, value: claim.compare.threshold }) : claim.compare.threshold)
      : againstValue != null && figure ? printed({ ...figure, value: againstValue }) : null;
    const value = figure ? printed(figure) : judged;
    if (line != null && value != null && !RELATIONS[word.relation](value, line)) flag('d-relation', `"${word.text}": printed ${value} is not ${word.relation} ${line}`);
  }
  return issues;
}

// A figure printed in the text that no claim carries: a signed number, a number with a unit (%, bp, 배, 달러).
const PRINTED_FIGURE = /[+\-−]\d[\d,.]*|\d[\d,.]*(?:%p?|(?<=\d)bps?(?![A-Za-z])|배|억 달러|조 달러|만 달러|달러)/g;
/** (e) the composed text prints only figures its claims carry. */
export function unclaimedFigures({ text, claims }) {
  let rest = String(text || '');
  const shown = claims.flatMap((claim) => [...claim.figures.map(figureText), ...(Number.isFinite(claim.compare?.threshold) && claim.figures[0] ? [thresholdText(claim)] : [])]);
  for (const piece of shown.sort((a, b) => b.length - a.length)) rest = rest.split(piece).join(' ');
  return rest.match(PRINTED_FIGURE) || [];
}

/** Every issue of a composed text: each claim's, and each printed figure no claim carries. */
export function saidIssues(said, facts) {
  const issues = said.claims.flatMap((claim) => claimIssues(claim, facts, { text: said.text }));
  for (const figure of unclaimedFigures(said)) issues.push({ check: 'e-label', level: 'error', subject: null, message: `"${figure}" is printed without a claim` });
  return issues;
}

/** An issue that blocks (a fact error), as against an 'unlinked' warning (nothing to compare). */
export const isClaimError = (issue) => issue?.level !== 'warning';
