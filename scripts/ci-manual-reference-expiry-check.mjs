// P1736/P1737 manual-reference expiry gate.
// Every hand-kept value that can go stale (policy rates, KR CPI, the official release schedules, the exchange holiday
// tables, the operator web snapshots) carries asOf plus nextExpectedAt/maxAgeDays/coverageEnd in the registry inside
// js/aio-core.js (P1736:BEGIN..END). This gate evaluates that same block against the committed producer artifacts.
//
// Structure (registry coverage, consumer wiring, fixtures) fails the gate. An expired value does NOT fail it: the screen
// already holds it as '기한 지남' and the data watchdog opens/updates one issue from --issue-body (owner direction P1542:
// a data problem is shown honestly and must not stop shipping). --strict turns expiries into a failure.
//
// Options: --now <ISO>  --json <path>  --issue-body <path>  --github-output  --strict
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { MARKET_CALENDAR_REGISTRY } from '../src/domain/market/market-calendar.js';
import { mergeProducedMacroCalendar } from '../src/data/macro-calendar.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => (existsSync(join(root, path)) ? JSON.parse(read(path)) : null);
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
const nowArg = option('--now');
const nowMs = nowArg ? Date.parse(nowArg) : Date.now();
const errors = [];
const check = (label, condition, detail = '') => { if (!condition) errors.push(label + (detail ? `: ${detail}` : '')); };

const core = read('js/aio-core.js');
const block = (startToken, endToken) => {
  const start = core.indexOf(startToken);
  const end = start < 0 ? -1 : core.indexOf(endToken, start);
  return start < 0 || end < 0 ? '' : core.slice(start, end + endToken.length);
};
const sources = {
  manual: block('const AIO_MANUAL_REFERENCE = Object.freeze({', '\n});'),
  registry: block('// P1736:BEGIN manual-reference-expiry', '// P1736:END manual-reference-expiry'),
  events: block('window.AIO_EVENT_FRESHNESS_REGISTRY = {', '\n};'),
  schedules: block('window.AIO_MACRO_OFFICIAL_SCHEDULES = {', '\n};'),
  scheduleAsOf: block('window.AIO_MACRO_OFFICIAL_SCHEDULES_ASOF = {', '\n};')
};
for (const [name, text] of Object.entries(sources)) check(`P1736 js/aio-core.js block present: ${name}`, text.length > 0);
const sandbox = { window: {} };
try {
  runInNewContext(`${Object.values(sources).join('\n')}
window.AIO_MANUAL_REFERENCE = AIO_MANUAL_REFERENCE;
window.__rules = AIO_MANUAL_REFERENCE_EXPIRY_RULES;
window.__evaluate = _aioEvaluateManualReferences;
window.__normalize = _aioNormalizeProducedReferences;`, sandbox, { timeout: 2000 });
} catch (error) {
  errors.push(`P1736 registry block does not evaluate: ${error.message}`);
}
const W = sandbox.window;
if (typeof W.__evaluate !== 'function') {
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}

// Producer artifacts (each optional: absent = the manual value stands with its own window).
const data = readJson('public-data/data.json') || {};
const officialReferences = readJson('public-data/official-references.json');
const macroCalendar = readJson('public-data/macro-calendar.json');
let produced = W.__normalize({}, { policyRates: data.policyRates || null });
if (officialReferences && /^official-web-references\.v\d+$/.test(String(officialReferences.schemaVersion || ''))) produced = W.__normalize(produced, { officialReferences });
const merged = macroCalendar?.schedules ? mergeProducedMacroCalendar(W.AIO_MACRO_OFFICIAL_SCHEDULES, macroCalendar) : { schedules: W.AIO_MACRO_OFFICIAL_SCHEDULES, producedAt: {} };
const calendarYears = Object.fromEntries(Object.entries(MARKET_CALENDAR_REGISTRY).map(([market, years]) => [market, Object.keys(years).map(Number)]));
const inputFor = (overrides = {}) => ({
  now: nowMs, manual: W.AIO_MANUAL_REFERENCE, eventRegistry: W.AIO_EVENT_FRESHNESS_REGISTRY,
  schedules: merged.schedules, scheduleAsOf: W.AIO_MACRO_OFFICIAL_SCHEDULES_ASOF, scheduleProducedAt: merged.producedAt,
  calendarYears, produced,
  serverMeta: { krExports: data.officialWebReferences?.krExports || null },
  structuralResearch: readJson('public-data/structural-data-research.json'),
  ...overrides
});
const audit = W.__evaluate(inputFor());

// ── Structure ───────────────────────────────────────────────────────────────
const ids = new Set(audit.items.map((item) => item.id));
for (const key of Object.keys(W.AIO_MANUAL_REFERENCE)) check(`P1736 every AIO_MANUAL_REFERENCE entry has an expiry rule (${key})`, ids.has(key));
for (const key of Object.keys(W.AIO_MACRO_OFFICIAL_SCHEDULES)) {
  check(`P1736 every official schedule row has an expiry item (${key})`, ids.has(`schedule:${key}`));
  check(`P1736 every official schedule row records when it was checked (${key})`, /^\d{4}-\d{2}-\d{2}$/.test(String(W.AIO_MACRO_OFFICIAL_SCHEDULES_ASOF?.[key] || '')));
}
for (const id of ['fomcEvent', 'holidays:KRX', 'holidays:NYSE', 'structuralResearch']) check(`P1736 registry covers ${id}`, ids.has(id));
const webResearchMaxAge = Number(read('scripts/ci-web-research-contract-check.mjs').match(/const MAX_AGE_DAYS = (\d+);/)?.[1]);
check('P1736 the structural research item expires with the 180-day web-research gate', W.__rules.structuralResearch?.maxAgeDays === webResearchMaxAge, `${W.__rules.structuralResearch?.maxAgeDays} vs ${webResearchMaxAge}`);
check('P1737 NAAIM is retired: no expiry item and no snapshot projection', !ids.has('naaim') && !/DATA_SNAPSHOT\.naaimExposure\s*=/.test(read('js/aio-data.js')) && !/\.naaimExposure\s*=/.test(core));
for (const id of Object.keys(W.AIO_EVENT_FRESHNESS_REGISTRY || {})) check(`P1736 event registry entry ${id} has an expiry window`, /^\d{4}-\d{2}-\d{2}$/.test(String(W.AIO_EVENT_FRESHNESS_REGISTRY[id]?.eventDate || '')) && Number.isFinite(Number(W.AIO_EVENT_FRESHNESS_REGISTRY[id]?.maxClaimAgeDays)));
for (const item of audit.items) {
  check(`P1736 ${item.id} has asOf and an expiry (nextExpectedAt/maxAgeDays/coverageEnd)`, item.status !== 'invalid', JSON.stringify({ asOf: item.asOf, expiresAt: item.expiresAt }));
  check(`P1736 ${item.id} names its screen behaviour`, typeof item.screen === 'string' && item.screen.length > 4);
}

// ── Fixtures: the same evaluator, synthetic clocks and artifacts ─────────────
const fixture = (overrides) => W.__evaluate(inputFor(overrides));
const byId = (result, id) => result.items.find((item) => item.id === id) || {};
const fedNext = W.AIO_MANUAL_REFERENCE.fedPolicy.next;
const dayAfter = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const kstNoon = (iso) => Date.parse(`${iso}T03:00:00Z`);
check('P1736 fixture: manual Fed range is current on its decision day',
  ['current', 'due'].includes(byId(fixture({ now: kstNoon(W.AIO_MANUAL_REFERENCE.fedPolicy.asOf), produced: {} }), 'fedPolicy').status));
check('P1736 fixture: manual Fed range is still current through the grace day after the next meeting',
  byId(fixture({ now: kstNoon(dayAfter(fedNext, 1)), produced: {} }), 'fedPolicy').held === false);
check('P1736 fixture: manual Fed range is held two days after the next meeting',
  byId(fixture({ now: kstNoon(dayAfter(fedNext, 2)), produced: {} }), 'fedPolicy').held === true);
check('P1737 fixture: a current producer range supersedes the expired manual one',
  byId(fixture({ now: kstNoon(dayAfter(fedNext, 30)), produced: W.__normalize({}, { policyRates: { fed: { lower: 3.75, upper: 4, asOf: dayAfter(fedNext, 29), status: 'current' } } }) }), 'fedPolicy').status === 'superseded');
check('P1737 fixture: a stale producer range does not supersede (manual value keeps its own window)',
  byId(fixture({ now: kstNoon(dayAfter(fedNext, 30)), produced: W.__normalize({}, { policyRates: { fed: { lower: 3.75, upper: 4, asOf: '2026-01-01', status: 'stale' } } }) }), 'fedPolicy').held === true);
const refs = (status) => ({ officialReferences: { schemaVersion: 'official-web-references.v2', items: {
  bokBaseRate: { value: 3, unit: '%', effectiveDate: '2026-10-22', nextMeeting: '2026-11-26', status },
  krCpi: { yoy: 2.4, period: '2026-10', publishedAt: '2026-11-03', status },
  krExports: { exportsYoyPct: 5, exportsBillionUsd: 60, period: '2026-10', periodLabel: '2026년 10월', publishedAt: '2026-11-01', status } } } });
const verifiedLater = fixture({ now: kstNoon('2026-11-10'), produced: W.__normalize({}, refs('verified')) });
check('P1737 fixture: verified BOK/KR CPI/exports supersede the manual or data.json copies',
  ['bokPolicy', 'krInflation', 'krExports'].every((id) => byId(verifiedLater, id).status === 'superseded'), JSON.stringify(verifiedLater.items.map((item) => [item.id, item.status])));
const unverifiedLater = fixture({ now: kstNoon('2026-11-10'), produced: W.__normalize({}, refs('unverified')) });
check('P1737 fixture: unverified artifact values never supersede; the expired manual values are held',
  byId(unverifiedLater, 'bokPolicy').held === true && byId(unverifiedLater, 'krInflation').held === true);
const neverVerified = fixture({ serverMeta: {}, produced: W.__normalize({}, { officialReferences: { items: { krExports: { exportsBillionUsd: null, exportsYoyPct: null, publishedAt: null, status: 'unverified', reason: 'value-not-on-page' } } } }) });
check('P1736 fixture: an export item the lane never verified stays listed as unverified and held (the issue does not close)',
  byId(neverVerified, 'krExports').status === 'unverified' && byId(neverVerified, 'krExports').held === true && neverVerified.expired.includes('krExports'), JSON.stringify(byId(neverVerified, 'krExports')));
const verifiedWithoutFigure = W.__normalize({}, { officialReferences: { items: { krExports: { exportsBillionUsd: null, status: 'verified' } } } });
check('P1736 fixture: a verified label without a figure is not treated as verified', verifiedWithoutFigure.krExports?.status === 'unverified');
check('P1736 fixture: an exhausted schedule row is held',
  byId(fixture({ now: kstNoon('2027-03-01'), schedules: { 'kr-bok': ['2026-11-26'] }, scheduleProducedAt: {} }), 'schedule:kr-bok').held === true);
check('P1736 fixture: the holiday tables enter review 61 days before the last registered year ends',
  byId(fixture({ now: kstNoon('2027-11-15') }), 'holidays:KRX').status === 'due' && byId(fixture({ now: kstNoon('2028-01-02') }), 'holidays:NYSE').held === true);

// P1737: produced calendars replace (not union) the hand-kept FOMC/ISM rows; a non-ok FOMC status keeps the manual dates.
{
  const manual = { 'us-fomc': ['2026-09-16', '2026-10-28', '2026-12-09'], 'us-fed-rate': ['2026-09-16', '2026-10-28', '2026-12-09'], 'us-ism-mfg': ['2026-10-01', '2026-11-02'], 'us-cpi': ['2026-10-14'] };
  const payload = (fomcStatus) => ({ schemaVersion: 'macro-calendar.v1', generatedAt: '2026-10-13T00:00:00Z',
    schedules: { 'us-cpi': ['2026-10-14', '2026-11-10'], 'us-fomc': ['2026-10-29', '2026-12-09', '2027-01-27'], 'us-fed-rate': ['2026-10-29', '2026-12-09', '2027-01-27'], 'us-ism-mfg': ['2026-11-03', '2026-12-01'] },
    events: [{ calendarId: 'us-fomc', date: '2026-10-29', source: 'fed-official', sep: false }, { calendarId: 'us-fomc', date: '2026-12-09', source: 'fed-official', sep: true }, { calendarId: 'us-fomc', date: '2027-01-27', source: 'fed-official', sep: false },
      { calendarId: 'us-ism-mfg', date: '2026-11-03', source: 'ism-rule' }, { calendarId: 'us-ism-mfg', date: '2026-12-01', source: 'ism-rule' }],
    meta: { fomcStatus, fomcFetchedAt: '2026-10-13T00:00:00Z' } });
  const ok = mergeProducedMacroCalendar(manual, payload('ok'));
  check('P1737 fed-official FOMC dates replace the manual year (a moved meeting leaves no stale date)', JSON.stringify(ok.schedules['us-fomc']) === JSON.stringify(['2026-10-29', '2026-12-09', '2027-01-27']) && JSON.stringify(ok.schedules['us-fed-rate']) === JSON.stringify(ok.schedules['us-fomc']), JSON.stringify(ok.schedules['us-fomc']));
  check('P1737 SEP flags come only from fed-official events', ok.fomc.accepted === true && ok.fomc.sep['2026-12-09'] === true && ok.fomc.sep['2026-10-29'] === false);
  const stale = mergeProducedMacroCalendar(manual, payload('stale'));
  check('P1737 a stale FOMC calendar keeps the manual dates', JSON.stringify(stale.schedules['us-fomc']) === JSON.stringify(manual['us-fomc']) && stale.fomc.accepted === false && !stale.producedAt['us-fomc']);
  check('P1737 ISM rule dates replace the months they cover, keep the others', JSON.stringify(ok.schedules['us-ism-mfg']) === JSON.stringify(['2026-10-01', '2026-11-03', '2026-12-01']), JSON.stringify(ok.schedules['us-ism-mfg']));
  check('P1654/P1737 FRED rows still extend by union', JSON.stringify(ok.schedules['us-cpi']) === JSON.stringify(['2026-10-14', '2026-11-10']));
}

// ── Consumer wiring ─────────────────────────────────────────────────────────
const ui = read('js/aio-ui.js');
const dataJs = read('js/aio-data.js');
check('P1736 applyDataSnapshot holds expired BOK/KR CPI values as 기한 지남', /'bok-rate':\s*refHeld\('bokPolicy'/.test(core) && /'kr-cpi':\s*refHeld\('krInflation'/.test(core) && /'kr-cpi-yoy':\s*refHeld\('krInflation'/.test(core));
check('P1737 fed-target fallback and both CP2 writers use AIO.getFedPolicyRange', /'fed-target':[^\n]*_fedRange/.test(core) && /cp2Fed = typeof window\.AIO\.getFedPolicyRange/.test(core) && /function getCP2Text\(\)[\s\S]{0,700}getFedPolicyRange\(\)/.test(core));
for (const file of ['src/ui/components/daily-loop.js', 'src/ui/components/briefing-read.js', 'src/ui/pages/market.js']) check(`P1737 ${file} reads the Fed range through AIO.getFedPolicyRange`, /getFedPolicyRange/.test(read(file)));
check('P1736 the BOK next-meeting helper has no hand-typed month/day list', !/function getNextBOK\(\)\s*\{[\s\S]{0,200}var schedule = \[\[/.test(ui) && /function getNextBOK\(\)[\s\S]{0,300}releases\['kr-bok'\]/.test(ui));
check('P1737 data.json and official-references.json reach applyProducedReferences', /applyProducedReferences\(\{ policyRates:/.test(dataJs) && /official-references\.json/.test(dataJs) && /applyProducedReferences\(\{ officialReferences: payload \}\)/.test(dataJs));
// The browser fetches the artifact only after data.json announces it (meta.officialReferencesCheckedAt). fetch-data
// sets that before the lane runs in the same workflow, so the announcement may lag the file by one run: that is a
// warning, never a failure (P1736: failing here would block the very data commit that first carries the file).
// Only an announcement newer than the file itself is wrong.
const announcedAt = Date.parse(data.meta?.officialReferencesCheckedAt || '');
const fileCheckedAt = Date.parse(officialReferences?.checkedAt || '');
check('P1736 data.json never announces an official-references check newer than the file', !officialReferences || !Number.isFinite(announcedAt) || !Number.isFinite(fileCheckedAt) || announcedAt <= fileCheckedAt,
  `${data.meta?.officialReferencesCheckedAt} > ${officialReferences?.checkedAt}`);
const announcementLag = officialReferences && (!Number.isFinite(announcedAt) || (Number.isFinite(fileCheckedAt) && announcedAt < fileCheckedAt));
check('P1736 the boot snapshot is projected through the registry', /try \{ window\.AIO\.applyManualReferenceState\(\); \}/.test(core));

// ── Report ──────────────────────────────────────────────────────────────────
const md = (iso) => iso || '—';
console.log(`Manual reference registry (today KST ${audit.today}):`);
console.log('| id | status | asOf | expires | where |');
for (const item of audit.items) console.log(`| ${item.id} | ${item.status} | ${md(item.asOf)} | ${md(item.expiresAt)} | ${item.where} |`);
const expired = audit.items.filter((item) => item.held);
const due = audit.items.filter((item) => item.status === 'due');
const digest = expired.map((item) => `${item.id}@${item.expiresAt}`).sort().join(',');
if (option('--json')) writeFileSync(option('--json'), JSON.stringify({ ...audit, digest }, null, 2));
if (option('--issue-body')) {
  const lines = [
    '<!-- aio-manual-reference-expiry -->',
    `<!-- aio-manual-reference-expiry-digest:${digest || 'none'} -->`,
    `## Expired manual references (${audit.today} KST)`,
    '',
    'These hand-kept values passed their window. The screen already holds them as "기한 지남"; update the value (or let the producer artifact publish a verified one) and the next watchdog run closes this issue.',
    '',
    '| Item | Where | Checked | Expired after | Screen behaviour | Producer that supersedes it |',
    '|---|---|---|---|---|---|',
    ...expired.map((item) => `| ${item.label} (\`${item.id}\`) | \`${item.where}\` | ${md(item.asOf)} | ${md(item.expiresAt)} | ${item.screen} | ${item.producer ? `\`${item.producer}\`` : '—'} |`),
    '',
    due.length ? `Due for review soon: ${due.map((item) => `\`${item.id}\` (expires ${item.expiresAt})`).join(', ')}` : 'Nothing else is due for review.',
    '',
    'Generated by `node scripts/ci-manual-reference-expiry-check.mjs` (P1736).'
  ];
  writeFileSync(option('--issue-body'), lines.join('\n') + '\n');
}
if (args.includes('--github-output') && process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `expired=${expired.length ? 'true' : 'false'}\nexpired_count=${expired.length}\ndigest=${digest || 'none'}\n`);
}
if (expired.length) console.warn(`WARN P1736 expired manual references (held on screen as 기한 지남): ${expired.map((item) => `${item.id}(expired after ${item.expiresAt})`).join(', ')}`);
if (announcementLag) console.warn('WARN P1736 data.json meta.officialReferencesCheckedAt lags public-data/official-references.json by a run (the next refresh announces it)');
if (due.length) console.warn(`WARN P1736 due for review: ${due.map((item) => `${item.id}(expires ${item.expiresAt})`).join(', ')}`);
if (args.includes('--strict') && expired.length) errors.push(`P1736 --strict: ${expired.length} expired manual reference(s)`);

if (errors.length) {
  console.error('Manual reference expiry check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`Manual reference expiry OK: ${audit.items.length} items, expired=${expired.length}, due=${due.length}.`);
