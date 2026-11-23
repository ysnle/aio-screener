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
//   - fundamentals (src/domain/fundamental/fiscal-read.js, quarter-read.js): every filer in public-data/sec-fiscal-history.json,
//     each figure held to its period (FY, four quarters, a quarter, a span of years, a price window); v60.50 adds the
//     이익의 질 card (earnings-quality.js), the same-sector peer bars (peer-read.js, peer medians and bands from the stored
//     strings) and the consensus line (consensus-read.js buildConsensusPoint, held to the consensus row and the screener row);
//   - a self-test: one false claim per defect class (a–h) must be flagged, and a fundamental sentence without claims;
//   - a static ratchet: in the converted files, a Korean template literal that interpolates a formatted number is text
//     written outside the composer (day-account, fiscal-read, quarter-read: none; market-read: only its unconverted
//     statements, never more).
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
import { CLAIM_CHECKS, claimIssues, isClaimError, saidIssues } from './lib/claim-validate.mjs';
import { closeFacts, ledgerFacts, openingFacts, recordFacts } from './lib/claim-facts.mjs';
import { buildMarketOpening } from '../src/domain/market/story/market-story.js';
import { replayFixtureRows, macroHistoryThrough, marketInputsAt } from './lib/replay-inputs.mjs';
import { lexLiterals } from './ci-sentence-join-check.mjs';
import { buildFiscalRead, parseFiscalHistory } from '../src/domain/fundamental/fiscal-read.js';
import { buildQuarterRead, buildWorkingCapitalRead, parseQuarterHistory } from '../src/domain/fundamental/quarter-read.js';
import { expandSecRecords } from '../src/data/contracts/sec-projection.js';
import { expandShardRow } from '../src/data/screener-extended.js';
import { createScreenerProvider } from '../src/data/providers/screener.js';
import { normalizeScreener } from '../src/data/normalize/screener.js';
import { filerFacts, addPeerFacts, consensusFacts } from './lib/claim-facts.mjs';
import { reconcileFiscalHistory, financialKind } from '../src/domain/fundamental/fiscal-read.js';
import { buildEarningsQuality } from '../src/domain/fundamental/earnings-quality.js';
import { buildAccrualRead } from '../src/domain/fundamental/analysis-read.js';
import { buildPeerRead } from '../src/domain/fundamental/peer-read.js';
import { buildConsensusPoint } from '../src/domain/fundamental/consensus-read.js';
import { buildPricedInRead } from '../src/domain/fundamental/priced-in.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const started = Date.now();
const failures = [];
const counts = Object.fromEntries(CLAIM_CHECKS.map((check) => [check, 0]));
const verbose = process.argv.includes('--verbose');

// The market-read statements printed from claims. Every other statement id is still free text (see the ratchet below).
const CONVERTED_STATEMENTS = Object.freeze(['narrow-rally', 'broad-rally', 'broad-weakness', 'broad-derisking', 'index-defended', 'tech-leads', 'tech-lags',
  'credit-widening', 'credit-stress', 'vix-inversion', 'vix-spike']);
const PRINTS_FIGURE_ANY = /\d[\d,.]*\s*(?:%|bp)/;
// Korean template literals that interpolate a formatted number, per converted file. The count may only fall.
const RATCHET = Object.freeze({ 'src/domain/briefing/day-account.js': 0, 'src/domain/briefing/market-read.js': 216,
  'src/domain/fundamental/fiscal-read.js': 0, 'src/domain/fundamental/quarter-read.js': 0,
  'src/domain/fundamental/earnings-quality.js': 0, 'src/domain/fundamental/peer-read.js': 0,
  // v60.50 market-story: the opening read is printed from claims; the 10 are the week card's older sentences (11 before).
  'src/domain/market/story/market-story.js': 10,
  // consensus-read: peMultipleText, the multiple formatter its unconverted consumers (screener table, company analysis, AI context) share.
  'src/domain/fundamental/consensus-read.js': 1 });

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
    const found = claimIssues(row, facts).filter(isClaimError).map((issue) => issue.check);
    if (!found.includes(check)) failures.push(`self-test: a false ${check} claim was not flagged (${found.join(',') || 'no issue'})`);
  }
  // v60.46: a claim whose subject, figure basis or comparison has no facts is 'unlinked' (a warning), never a silent pass.
  const loose = claimIssues(claim({ subject: 'ndx', measure: 'change1d', word: 'broad-rise', asOf: D, compare: { against: 'rut', measure: 'change1d' }, figures: [{ value: -1.2, unit: 'pct', basis: 'change1d', label: '나스닥 100' }] }), facts);
  const looseFigure = claimIssues(claim({ subject: 'spx', measure: 'change1d', asOf: D, figures: [{ value: 3.3, unit: 'pct', basis: 'change60d', label: 'S&P 500 60일' }] }), facts);
  if (!loose.some((issue) => issue.check === 'unlinked' && !isClaimError(issue)) || loose.some(isClaimError) || !looseFigure.some((issue) => issue.check === 'unlinked'))
    failures.push(`self-test: an unlinked claim must be its own warning outcome ${JSON.stringify({ loose, looseFigure })}`);
  // A figure smuggled into the text as a plain name has no claim.
  const smuggled = say('{name} 하락', { name: 'S&P 500 -1.2%' });
  if (!saidIssues(smuggled, facts).some((issue) => issue.check === 'e-label')) failures.push('self-test: a printed figure without a claim was not flagged');
  // A true claim of each kind passes.
  const right = claim({ subject: 'group', measure: 'change1d', word: 'most-fell', asOf: D, rank: { among: 'group' }, figures: [{ value: -9.5, unit: 'pct', basis: 'member', label: 'AAA' }, { value: -8.8, unit: 'pct', basis: 'member', label: 'BBB' }] });
  if (claimIssues(right, facts).length) failures.push(`self-test: a true superlative was flagged ${JSON.stringify(claimIssues(right, facts))}`);

  // v60.49 a filer's figures: one false claim per period rule must be flagged, and a true one pass.
  const filer = { 'filer:TEST': { periods: { 'FY:2026-01-31': { revenue: 200e9, netIncome: 50e9 }, 'FY:2025-01-31': { revenue: 100e9, netIncome: 20e9 },
    'FY:2023-01-31': { revenue: 80e9 }, 'Q:2026-07-31': { revenue: 60e9 }, 'Q:2025-07-31': { revenue: 40e9 }, 'TTM:2026-07-31': { pe: 31.2 } } } };
  const on = (figures, extra = {}) => claim({ subject: 'filer:TEST', measure: 'm', asOf: extra.asOf ?? '2026-01-31', figures, ...extra });
  const fyAndQuarter = [{ value: 200e9, unit: 'usd', basis: 'revenue', label: '매출', period: 'FY:2026-01-31' }, { value: 60e9, unit: 'usd', basis: 'revenue', label: '분기', period: 'Q:2026-07-31' }];
  const periodWrong = [
    ['g-period', 'a money figure without a period', on([{ value: 200e9, unit: 'usd', basis: 'revenue', label: '매출' }])],
    ['g-period', 'a four-quarter PER printed as the fiscal year', on([{ value: 31.2, unit: 'x', basis: 'pe', label: 'PER', period: 'FY:2026-01-31' }])],
    ['h-across', 'a fiscal year changed against a quarter', on([{ value: 100, unit: 'pct', basis: 'revenue', label: '매출', period: 'FY:2026-01-31', against: 'Q:2025-07-31' }])],
    ['h-across', 'a three-year change printed as one year', on([{ value: 150, unit: 'pct', basis: 'revenue', label: '매출', period: 'FY:2026-01-31', against: 'FY:2023-01-31' }])],
    ['h-across', 'two periods in one claim, undeclared', on(fyAndQuarter, { asOf: '2026-07-31' })],
    ['h-across', 'a fiscal year compared with a quarter', on(fyAndQuarter, { asOf: '2026-07-31', compare: { across: ['FY:2026-01-31', 'Q:2026-07-31'] } })],
    ['f-asof', 'dated by an older period than it prints', on([fyAndQuarter[1]], { asOf: '2026-01-31' })],
    ['value', 'a change that is not its data', on([{ value: 40, unit: 'pct', basis: 'revenue', label: '분기 매출', period: 'Q:2026-07-31', against: 'Q:2025-07-31' }], { asOf: '2026-07-31' })]
  ];
  for (const [check, what, row] of periodWrong) {
    const found = claimIssues(row, filer).filter(isClaimError).map((issue) => issue.check);
    if (!found.includes(check)) failures.push(`v60.49 self-test: ${what} was not flagged as ${check} (${found.join(',') || 'no issue'})`);
  }
  const periodRight = [on([{ value: 200e9, unit: 'usd', basis: 'revenue', label: '매출', period: 'FY:2026-01-31' }, { value: 100, unit: 'pct', basis: 'revenue', label: '매출', period: 'FY:2026-01-31', against: 'FY:2025-01-31' }]),
    on([{ value: 25, unit: 'share', basis: 'margin', label: '순이익률', period: 'FY:2026-01-31' }, { value: 150, unit: 'pct', basis: 'revenue', label: '매출', period: 'FY:2026-01-31', against: 'FY:2023-01-31' }], { compare: { across: ['FY:2026-01-31', 'FY:2023-01-31'] } }),
    on([{ value: 31.2, unit: 'x', basis: 'pe', label: 'PER', period: 'TTM:2026-07-31' }], { asOf: '2026-07-31' })];
  for (const row of periodRight) { const found = claimIssues(row, filer).filter(isClaimError); if (found.length) failures.push(`v60.49 self-test: a true filer claim was flagged ${JSON.stringify(found)}`); }
  // The old read: a fundamental sentence formatted outside the composer carries no claim, so each figure in it is flagged.
  const oldRead = { text: '최근 회계연도 매출 2,159억 달러(+65.5%), 약 5년 연평균 +67.2%. 5년 연속 증가입니다.', claims: [] };
  if (saidIssues(oldRead, filer).filter((issue) => issue.check === 'e-label').length < 2) failures.push('v60.49 self-test: a fundamental sentence without claims was not flagged');

  // v60.50 negative controls on the two period defects. (1) An equity change against a fiscal year two years back, said as
  // "전년보다": the checker flags the old claim (h-across) and the read no longer makes it.
  const gapYears = [{ periodEnd: '2022-12-31', revenue: 100e9, netIncome: 10e9, equity: 50e9 }, { periodEnd: '2024-12-31', revenue: 120e9, netIncome: 30e9, equity: 80e9 }];
  const gapRead = buildFiscalRead({ symbol: 'TEST', fundamentals: { symbol: 'TEST', periodType: 'FY', observedAt: '2024-12-31', roe: 45, fiscalHistory: gapYears } });
  const gapFacts = filerFacts('TEST', { annual: '2022-12-31:100000:10000:50000;2024-12-31:120000:30000:80000' });
  const oldEquity = claim({ subject: 'filer:TEST', measure: 'equity', asOf: '2024-12-31', figures: [{ value: 60, unit: 'pct', basis: 'equity', label: '자기자본', period: 'FY:2024-12-31', against: 'FY:2022-12-31' }] });
  if (!claimIssues(oldEquity, gapFacts).some((issue) => issue.check === 'h-across')) failures.push('v60.50 self-test: an equity change across two fiscal years was not flagged');
  if (gapRead.points.some((point) => /전년보다/.test(point.text) || point.claims?.some((c) => c.figures.some((f) => f.basis === 'equity'))))
    failures.push('v60.50 self-test: the fiscal read still compares equity across a gap as "전년보다"');
  // (2) A working-capital step from a quarter 65 days earlier (old 60–120 day rule): flagged, and no longer read.
  const quarterGap = parseQuarterHistory('2026-04-26:100:10:r:50:40;2026-06-30:110:12:r:60:45');
  if (buildWorkingCapitalRead(quarterGap, { symbol: 'TEST' }).available) failures.push('v60.50 self-test: a 65-day quarter step is still read as one quarter');
  const oldStep = claim({ subject: 'filer:TEST', measure: 'inventory', asOf: '2026-06-30', figures: [{ value: 20, unit: 'pct', basis: 'inventory', label: '재고', period: 'Q:2026-06-30', against: 'Q:2026-04-26' }] });
  if (!claimIssues(oldStep, filerFacts('TEST', { quarters: '2026-04-26:100:10:r:50:40;2026-06-30:110:12:r:60:45' })).some((issue) => issue.check === 'h-across')) failures.push('v60.50 self-test: a 65-day quarter step was not flagged');
}

const issuesSeen = [], unlinkedSeen = [];
const record = (where, text, issues) => {
  for (const issue of issues) {
    counts[issue.check] = (counts[issue.check] || 0) + 1;
    (isClaimError(issue) ? issuesSeen : unlinkedSeen).push(`${where} [${issue.check}] ${issue.message} — ${text}`);
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

// 2b. v60.50 the opening read (market-story.js buildMarketOpening: the lede, the diagnosis line, the record line, 한국, the
// index table — the bars print the table's fall claims) at each
// stored session, held against the closes and the HY spread (claim-facts.mjs openingFacts). Without the long-run tables,
// which this replay never reads, every fall is from the record's closing high.
let openings = 0, openingClaims = 0;
for (const row of rows) {
  const input = marketInputsAt(rows, macroHistory, row.date);
  const opening = buildMarketOpening({ history: input.history, macroHistory, through: row.date });
  if (!opening.available) continue;
  openings += 1;
  const facts = openingFacts(input.history, macroHistory);
  for (const part of [...opening.lines.map((line) => [line.id, line.said]), ['korea', opening.korea], ...opening.table.map((item) => [`table-${item.id}`, item.said])]) {
    const [id, said] = part;
    if (!said?.text) continue;
    if (PRINTS_FIGURE_ANY.test(said.text) && !said.claims.length) failures.push(`v60.50 opening ${row.date} ${id}: prints a figure without claims (${said.text})`);
    openingClaims += said.claims.length;
    record(`opening ${row.date} ${id}`, said.text, saidIssues(said, facts));
  }
}

// 3. Day account: the ledger rebuilt at each session, and the published ledger.
const macroCalendar = readJson('public-data/macro-calendar.json');
const macroIds = MACRO_SERIES.map((series) => series.id);
let accounts = 0, accountClaims = 0;
const checkAccount = (where, day, history, briefs = null) => {
  const ledger = oneSessionDay(day, history);
  // v60.50: with the closes, the opening ranks its leading index's move within the record (recordFacts holds that rank).
  const account = buildDayAccount(ledger, { briefs, history });
  if (!account.available) return;
  accounts += 1;
  const facts = { ...ledgerFacts(ledger), ...recordFacts(history, ledger) };
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

// 3b. v60.49 fundamentals: the 재무 공시 reads (fiscal-read buildFiscalRead, quarter-read buildQuarterRead and
// buildWorkingCapitalRead) for every filer in public-data/sec-fiscal-history.json, on the inputs the screen gives them
// (the canonical screener row, the expanded SEC summary record, the parsed annual and quarter strings), held against the
// filer's facts read from the same stored strings (claim-facts.mjs filerFacts). A sentence that prints a figure carries claims.
const fiscalHistory = readJson('public-data/sec-fiscal-history.json');
const secTable = expandSecRecords(readJson('public-data/sec-fundamentals-summary.json'));
const screener = readJson('public-data/screener.json');
const screenerAsOf = Date.parse(screener.asOf);
const screenerProvider = createScreenerProvider({ httpClient: { requestJson: async (url) => { try { return { ok: true, data: readJson(`public-data/${String(url).split('?')[0].split('/').pop()}`) }; } catch (_) { return { ok: false, status: 404 }; } } },
  clock: { now: () => screenerAsOf, iso: () => screener.asOf } });
const canonicalRows = new Map(normalizeScreener(await screenerProvider.readCurrent()).rows.map((row) => [row.sym, row]));
const PRINTS_FIGURE = /\d[\d,.]*\s*(?:%|배|달러|년|개월)/;
let filers = 0, filerSentences = 0, filerClaims = 0;
const consensus = readJson('public-data/consensus-estimates.json');
const consensusNow = Date.parse(consensus.generatedAt);
const sicOf = (symbol) => String(fiscalHistory.issuerSic?.[symbol] ?? '').split('|')[0] || null;
const bySector = new Map();
for (const row of canonicalRows.values()) if (row.sector && fiscalHistory.data?.[row.sym]) bySector.set(row.sector, [...(bySector.get(row.sector) || []), row.sym]);
// v60.50 negative control on real output: per converted producer, the first sentence that prints a figure must be flagged
// once its claims are dropped (e-label) and once its first figure is moved off its data (value).
const controlled = new Set();
const control = (kind, part, facts) => {
  if (controlled.has(kind) || !PRINTS_FIGURE.test(part.text) || !part.claims?.length) return;
  const first = part.claims.find((c) => c.figures.some((f) => Number.isFinite(f.value) && f.value !== 0 && !['years', 'months'].includes(f.unit)));
  if (!first || !saidIssues({ text: part.text, claims: part.claims }, facts).every((issue) => !isClaimError(issue))) return;
  controlled.add(kind);
  if (!saidIssues({ text: part.text, claims: [] }, facts).some((issue) => issue.check === 'e-label')) failures.push(`v60.50 control ${kind}: a sentence without its claims was not flagged (${part.text})`);
  const index = first.figures.findIndex((f) => Number.isFinite(f.value) && f.value !== 0 && !['years', 'months'].includes(f.unit));
  const moved = claim({ ...first, figures: first.figures.map((f, i) => (i === index ? { ...f, value: f.value * 1.5 + Math.sign(f.value) } : f)) });
  if (!claimIssues(moved, facts).some((issue) => issue.check === 'value' || issue.check === 'd-relation')) failures.push(`v60.50 control ${kind}: a figure off its data was not flagged (${part.text})`);
};
for (const symbol of Object.keys(fiscalHistory.data || {}).sort()) {
  const annual = fiscalHistory.data[symbol];
  const quarterText = fiscalHistory.quarters?.[symbol] || '';
  const quarters = quarterText ? parseQuarterHistory(quarterText) : [];
  const fiscal = buildFiscalRead({ symbol, fundamentals: { ...(secTable[symbol] || {}), fiscalHistory: parseFiscalHistory(annual) }, row: canonicalRows.get(symbol) || null, quarters,
    sic: String(fiscalHistory.issuerSic?.[symbol] ?? '').split('|')[0] || null, debtBasis: fiscalHistory.debtBasis?.[symbol] === 'lease-inclusive' ? 'lease-inclusive' : 'long-term' });
  const quarter = buildQuarterRead(quarters, { symbol });
  const working = buildWorkingCapitalRead(quarters, { symbol });
  const expanded = expandShardRow(screener, screener.data?.[symbol]);
  const row = canonicalRows.get(symbol) || null;
  const facts = filerFacts(symbol, { annual, quarters: quarterText, summary: secTable[symbol] || null, row: expanded });
  // v60.50 the same-sector peers as the screen picks them (fiscal-read.js peerSection), their facts from the stored strings.
  const peerSymbols = row?.sector ? (bySector.get(row.sector) || []).filter((sym) => sym !== symbol) : [];
  addPeerFacts(facts, symbol, { peers: peerSymbols.map((sym) => ({ symbol: sym, annual: fiscalHistory.data[sym], held: financialKind(sym, row.sector, sicOf(sym)) != null })), ownHeld: financialKind(symbol, row?.sector, sicOf(symbol)) != null });
  const estimate = consensus.rows?.[symbol] || null;
  Object.assign(facts, consensusFacts(symbol, { estimate, row: expanded }));
  const quality = fiscal.points.some((point) => point.id === 'bank') ? null : buildEarningsQuality({ symbol, history: fiscal.history, accrual: buildAccrualRead(fiscal.history) });
  const peer = row?.sector ? buildPeerRead({ symbol, sector: row.sector, peers: peerSymbols, sicFor: sicOf,
    seriesFor: (sym) => (fiscalHistory.data[sym] ? reconcileFiscalHistory(parseFiscalHistory(fiscalHistory.data[sym]), sym === symbol ? { ...(secTable[symbol] || {}) } : null, sym) : null) }) : { available: false };
  const point = estimate ? buildConsensusPoint(row, estimate, { now: consensusNow }) : null;
  const priced = estimate ? buildPricedInRead(row, estimate, { now: consensusNow }) : null; // v60.50 종목 개요 이 주가가 반영하는 것
  const said = [['headline', { text: fiscal.headline || '', claims: fiscal.headlineClaims || [] }], ...fiscal.points.map((point) => [point.id, point]),
    ['quarter', { text: quarter.headline || '', claims: quarter.claims || [] }], ['working-capital', { text: working.headline || '', claims: working.claims || [] }],
    ...(quality ? [['quality-trend', quality.trendLabel], ...quality.rows.map((item) => [`quality-${item.id}`, { text: [item.name, item.detail, item.value.text].filter(Boolean).join(' '), probe: [item.detail, item.value.text].filter(Boolean).join(' '), claims: item.value.claims }]),
      ...quality.rows.filter((item) => item.hover).map((item) => [`quality-${item.id}-hover`, item.hover]), ['quality-reconcile', quality.reconcile || { text: '', claims: [] }], ['quality-reading', quality.reading]] : []),
    ...(peer.available ? peer.rows.map((metric) => [`peer-${metric.id}`, { text: `${metric.label} ${metric.said.text}`, claims: metric.said.claims }]) : []),
    ...(point ? [['consensus', point]] : []), ...(priced ? priced.lines.map((line, i) => [`priced-${i}`, line]) : [])];
  filers += 1;
  for (const [id, part] of said) {
    if (!part.text) continue;
    filerSentences += 1;
    if (PRINTS_FIGURE.test(part.probe ?? part.text) && !part.claims?.length) failures.push(`v60.49 filer ${symbol} ${id}: prints a figure without claims (${part.text})`);
    filerClaims += part.claims?.length || 0;
    record(`filer ${symbol} ${id}`, part.text, saidIssues({ text: part.text, claims: part.claims || [] }, facts));
    control(id.replace(/-.*$/, ''), part, facts);
  }
}
for (const kind of ['quality', 'peer', 'consensus', 'earnings', 'growth', 'priced']) if (!controlled.has(kind)) failures.push(`v60.50 control ${kind}: no sentence on disk exercised the negative control`);

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
// Unlinked claims were not compared: named as such (a warning), never counted as verified.
if (unlinkedSeen.length) console.warn(`[sentence-claim-replay] ${unlinkedSeen.length} claim part(s) not compared (no facts):\n- ${unlinkedSeen.slice(0, verbose ? Infinity : 20).join('\n- ')}`);
if (failures.length) {
  console.error(`[sentence-claim-replay] FAIL (${failures.length}) — v60.30 a converted sentence must hold against its facts\n- ${failures.join('\n- ')}\nissues by check: ${tally}`);
  process.exit(1);
}
console.log(`[sentence-claim-replay] OK: ${readSessions} market-read sessions (${readClaims} claims), ${openings} opening reads (${openingClaims} claims), ${accounts} day accounts (${accountClaims} claims), ${filers} filers (${filerSentences} fundamental sentences, ${filerClaims} claims), 0 fact errors, ${unlinkedSeen.length} not compared (${tally}); ${CONVERTED_STATEMENTS.length} statement ids converted; ${ms} ms`);
