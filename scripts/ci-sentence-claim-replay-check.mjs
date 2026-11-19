#!/usr/bin/env node
// Replays the producers whose sentences carry claims (src/domain/shared/claim.js) over every session on disk and holds each
// claim against the facts it came from (scripts/lib/claim-validate.mjs). Before, a word was checked by a reader on the
// screen: "가장 많이 움직인 종목" at -3.9% in a group whose median was -7.1%, "상승이 넓게 퍼져" beside falling indexes,
// a ratio of 1.00 called higher than its line of 1. Here every converted sentence of every stored session is read by
// machine, with no network, no DOM and no git:
//   - market read (src/domain/briefing/market-read.js buildMarketRead): each session of public-data/history.json, and each
//     session of the frozen 2026 crash-replay closes that history.json no longer holds, with that close as `now`;
//   - day account (src/domain/briefing/day-account.js buildDayAccount): the market-day ledger rebuilt from history.json
//     and macro-history.json at each session (price stories), and the published public-data/market-day.json (every kind);
//   - a self-test: one false claim per defect class (a–f) must be flagged;
//   - a static ratchet: in the converted files, a Korean template literal that interpolates a formatted number is text
//     written outside the composer (day-account: none; market-read: only its unconverted statements, never more).
//   node scripts/ci-sentence-claim-replay-check.mjs [--verbose]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claim, say } from '../src/domain/shared/claim.js';
import { buildMarketRead } from '../src/domain/briefing/market-read.js';
import { buildDayAccount } from '../src/domain/briefing/day-account.js';
import { buildMarketDay, MACRO_SERIES } from '../src/domain/market/day/facts.js';
import { oneSessionDay } from '../src/domain/market/day/one-session.js';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { CLAIM_CHECKS, claimIssues, saidIssues } from './lib/claim-validate.mjs';
import { closeFacts, ledgerFacts } from './lib/claim-facts.mjs';
import { replayFixtureRows, macroHistoryThrough, marketInputsAt } from './lib/replay-inputs.mjs';
import { lexLiterals } from './ci-sentence-join-check.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const started = Date.now();
const failures = [];
const counts = Object.fromEntries(CLAIM_CHECKS.map((check) => [check, 0]));
const verbose = process.argv.includes('--verbose');

// The market-read statements printed from claims. Every other statement id is still free text (see the ratchet below).
const CONVERTED_STATEMENTS = Object.freeze(['narrow-rally', 'broad-rally', 'broad-weakness', 'broad-derisking', 'index-defended', 'tech-leads', 'tech-lags',
  'credit-widening', 'credit-stress', 'vix-inversion', 'vix-spike']);
// Korean template literals that interpolate a formatted number, per converted file. The count may only fall.
const RATCHET = Object.freeze({ 'src/domain/briefing/day-account.js': 0, 'src/domain/briefing/market-read.js': 216 });

// 1. Self-test: one false claim per defect class must be flagged by its check.
{
  const D = '2026-11-16';
  const facts = {
    group: { asOf: D, values: { change1d: -7.1, median: -7.1 }, members: { AAA: -9.5, BBB: -8.8, CCC: -3.9 } },
    spx: { asOf: D, values: { change1d: -1.2, change5d: -2, change20d: -3 } },
    breadth50: { asOf: D, values: { above50: 65 } },
    tnx: { asOf: D, values: { change5d: -19 }, sd: { change5d: { sd: 4, sessions: 5 } } },
    vix: { asOf: D, values: { change5d: 26 }, sd: { change5d: { sd: 8, sessions: 5 } } },
    ratio: { asOf: D, values: { level: 1 } }
  };
  const wrong = {
    'a-rank': claim({ subject: 'group', measure: 'change1d', word: 'most-fell', asOf: D, rank: { among: 'group' }, figures: [{ value: -3.9, unit: 'pct', basis: 'member', label: 'CCC' }] }),
    'b-index': claim({ subject: 'breadth50', measure: 'above50', word: 'broad-rise', asOf: D, compare: { against: 'spx', measure: 'change20d', threshold: 60, relation: 'atLeast' }, figures: [{ value: 65, unit: 'share', basis: 'above50', label: '50일선 위' }] }),
    'c-size': claim({ subject: 'vix', measure: 'change5d', word: 'spike', asOf: D, compare: { threshold: 25, relation: 'atLeast' }, figures: [{ value: 26, unit: 'pct', digits: 0, basis: 'change5d', label: 'VIX 5일' }] }),
    'd-relation': claim({ subject: 'ratio', measure: 'level', word: 'inverted', asOf: D, compare: { threshold: 1, relation: 'above' }, figures: [{ value: 1.001, unit: 'level', basis: 'level', label: 'VIX' }] }),
    'e-label': claim({ subject: 'spx', measure: 'change1d', asOf: D, figures: [{ value: -1.2, unit: 'pct', basis: 'change1d', label: '' }] }),
    'f-asof': claim({ subject: 'spx', measure: 'change1d', asOf: '2026-11-17', figures: [{ value: -1.2, unit: 'pct', basis: 'change1d', label: 'S&P 500' }] })
  };
  for (const [check, row] of Object.entries(wrong)) {
    const found = claimIssues(row, facts).map((issue) => issue.check);
    if (!found.includes(check)) failures.push(`self-test: a false ${check} claim was not flagged (${found.join(',') || 'no issue'})`);
  }
  // A figure smuggled into the text as a plain name has no claim.
  const smuggled = say('{name} 하락', { name: 'S&P 500 -1.2%' });
  if (!saidIssues(smuggled, facts).some((issue) => issue.check === 'e-label')) failures.push('self-test: a printed figure without a claim was not flagged');
  // A true claim of each kind passes.
  const right = claim({ subject: 'group', measure: 'change1d', word: 'most-fell', asOf: D, rank: { among: 'group' }, figures: [{ value: -9.5, unit: 'pct', basis: 'member', label: 'AAA' }, { value: -8.8, unit: 'pct', basis: 'member', label: 'BBB' }] });
  if (claimIssues(right, facts).length) failures.push(`self-test: a true superlative was flagged ${JSON.stringify(claimIssues(right, facts))}`);
}

const issuesSeen = [];
const record = (where, text, issues) => {
  for (const issue of issues) {
    counts[issue.check] = (counts[issue.check] || 0) + 1;
    issuesSeen.push(`${where} [${issue.check}] ${issue.message} — ${text}`);
  }
};

// 2. Market read, each stored session.
const rows = readHistoryRows(readJson('public-data/history.json'));
const macroHistory = readJson('public-data/macro-history.json');
const fixture = replayFixtureRows(readJson('architecture/fixtures/crash-replay-2026-closes.json'));
const inHistory = new Set(rows.map((row) => row.date));
let readSessions = 0, readClaims = 0;
const freeText = new Set();
for (const [tag, set, dates] of [['history', rows, rows.map((row) => row.date)], ['crash-replay', fixture, fixture.map((row) => row.date).filter((date) => !inHistory.has(date))]]) {
  for (const date of dates) {
    const input = marketInputsAt(set, macroHistory, date);
    const read = buildMarketRead(input);
    if (!read.available) continue;
    readSessions += 1;
    const facts = closeFacts(input.history, macroHistory);
    for (const statement of read.statements) {
      const converted = CONVERTED_STATEMENTS.includes(statement.id);
      if (!converted) { freeText.add(statement.id); if (statement.claims) failures.push(`${tag} ${date} ${statement.id}: carries claims but is not listed as converted`); continue; }
      if (!statement.claims?.length) { failures.push(`${tag} ${date} ${statement.id}: converted statement without claims`); continue; }
      readClaims += statement.claims.length;
      const text = [statement.text, statement.reading, statement.check].filter(Boolean).join(' ');
      record(`market-read ${tag} ${date} ${statement.id}`, statement.text, saidIssues({ text, claims: statement.claims }, facts));
    }
  }
}

// 3. Day account: the ledger rebuilt at each session, and the published ledger.
const macroCalendar = readJson('public-data/macro-calendar.json');
const macroIds = MACRO_SERIES.map((series) => series.id);
let accounts = 0, accountClaims = 0;
const checkAccount = (where, day, history, briefs = null) => {
  const ledger = oneSessionDay(day, history);
  const account = buildDayAccount(ledger, { briefs });
  if (!account.available) return;
  accounts += 1;
  const facts = ledgerFacts(ledger);
  const parts = [{ text: account.opening, claims: account.claims.opening }, { text: account.asOf, claims: account.claims.asOf },
    ...[...account.stories, ...account.more].map((story) => ({ text: [story.title, story.line, ...story.why].join(' '), claims: story.claims, figuresOf: story }))];
  for (const part of parts) {
    if (!part.text.trim()) continue;
    if (part.figuresOf && part.figuresOf.kind !== 'event' && !part.claims.length) failures.push(`${where}: a ${part.figuresOf.kind} story without claims (${part.text})`);
    accountClaims += part.claims.length;
    record(where, part.text, saidIssues(part, facts));
  }
};
for (const row of rows) {
  const input = marketInputsAt(rows, macroHistory, row.date);
  const day = buildMarketDay({ history: input.history, macroHistory: macroHistoryThrough(macroHistory, row.date, macroIds), macroCalendar, nowMs: input.now });
  checkAccount(`day-account ${row.date}`, day, input.history);
}
checkAccount('day-account published', readJson('public-data/market-day.json'), rows, readJson('public-data/event-briefs.json'));

// 4. Static ratchet: no number formatted into Korean text outside the composer in the converted files.
const FORMATTED = /\b(?:signedText|signed|fmt|pct|bp|move|usdKoreanText|shortDate|md|win20)\s*\(|\.(?:toFixed|toLocaleString)\s*\(|\bMath\.\w+\s*\(|\bRULES\.|\bB\.\w/;
const HANGUL = /[가-힣]/;
for (const [file, baseline] of Object.entries(RATCHET)) {
  const { literals } = lexLiterals(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const hits = literals.filter((literal) => literal.kind === 'tpl' && HANGUL.test(literal.text) && literal.interps.some((interp) => FORMATTED.test(interp.src))).length;
  if (hits > baseline) failures.push(`ratchet: ${file} formats a number into Korean text ${hits} times outside the composer (allowed ${baseline}); print it from a claim (src/domain/shared/claim.js say)`);
  else if (hits < baseline) failures.push(`ratchet: ${file} is down to ${hits} (baseline ${baseline}); lower RATCHET in this script`);
}

if (issuesSeen.length) failures.push(...issuesSeen.slice(0, 60), ...(issuesSeen.length > 60 ? [`… ${issuesSeen.length - 60} more claim issues`] : []));
const ms = Date.now() - started;
const tally = CLAIM_CHECKS.map((check) => `${check} ${counts[check]}`).join(', ');
if (verbose) console.log(`free-text market-read statements still to convert: ${[...freeText].sort().join(', ')}`);
if (failures.length) {
  console.error(`[sentence-claim-replay] FAIL (${failures.length}) — v60.30 a converted sentence must hold against its facts\n- ${failures.join('\n- ')}\nissues by check: ${tally}`);
  process.exit(1);
}
console.log(`[sentence-claim-replay] OK: ${readSessions} market-read sessions (${readClaims} claims), ${accounts} day accounts (${accountClaims} claims), 0 issues (${tally}); ${CONVERTED_STATEMENTS.length} statement ids converted; ${ms} ms`);
