import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveMarketSession } from './build-market-snapshot.mjs';
import { readProducerSource } from './lib/producer-source.mjs'; // v57.62: fetch-data.mjs + the lib modules split out of it
import { holdRepeatedSessions, continuousReopenPrint, mergeMacroLastKnownGood, normalizeHistoryRows, parseBeaPceHtml, validateMarketAnalysisText, HIST_FIELD_PLAUSIBILITY, histValueWithinPlausibility, parseFredDexkousCsv, compareUsdKrwCrossCheck } from './fetch-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[history-field-time-contract] ${message}`); };

const history = readJson('public-data/history.json');
if (!Array.isArray(history) || history.length < 2) fail('history.json must contain at least two rows');
const fields = ['spx', 'nasdaq', 'dow', 'rut', 'vix', 'vvix', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'kosdaq', 'btc', 'usdkrw'];
const errors = [];
const fetchDataSource = readProducerSource();
if (!/regularMarketPreviousCloseObservedAt:[\s\S]{0,260}closeBars\[prevIndex \+ 1\]\??\.timestamp/.test(fetchDataSource)) { // v58.80: the bar after the previous one is the current bar (a weekend reopen bar is not)
  errors.push('fetch-data: previous completed close must use the current daily bar opening boundary, not the previous bar opening time');
}
// P1192 (P1095 권위): 완료 컷 행은 그 컷을 넘는 시각의 previous-completed-close를 담을 수 없다.
// Yahoo가 진행 중 bar를 그 bar의 개시 시각으로 스탬프하는 창(FX/상품 일봉 경계 00:00Z가
// KST-08:00 뉴스 컷 23:00Z보다 뒤)에서 그 경계가 컷을 넘으므로, producer는 값을 **버리지 않고**
// 직전 bar의 개시 경계로 앉히거나(그마저 컷을 넘으면 값을 싣지 않는다) 해야 한다. 시각만 바꾸거나
// 컷을 늘리는 위장은 금지다 — 두 대안의 존재 자체를 코드에서 요구한다.
if (!/previousBarOpenedAt:/.test(fetchDataSource)
  || !/quote\.observationRelation !== 'previous-completed-close'/.test(fetchDataSource)
  || !/stamp <= cutMs/.test(fetchDataSource)
  || !/observedAtBoundary: 'previous-bar-open'/.test(fetchDataSource)) {
  errors.push('fetch-data: a previous-completed-close stamp that exceeds the row cut must fall back to the previous bar boundary or be dropped (P1192)');
}
// P1117: every lane that writes a history fieldMeta must publish the timestamp-source and
// observation-relation markers. The market lane computed them and then dropped them in its
// projection, so the artifact gate that looks for `observedAtSource` skipped its assertions
// forever. Assert each lane emits the marker instead of trusting one of them.
for (const [lane, literal] of [
  ['backfill', /byDate\[row\.date\]\.fieldMeta\[field\] = \{/],
  ['market', /const historyMeta = \(field, quote, fallback = \{\}\) => \(\{/],
  ['screener-breadth', /target\.fieldMeta\[field\] = \{/],
]) {
  const start = fetchDataSource.search(literal);
  const body = start >= 0 ? fetchDataSource.slice(start, start + 1600) : '';
  for (const key of ['observedAtSource:', 'observationRelation:']) {
    if (!body.includes(key)) errors.push(`fetch-data: the ${lane} history fieldMeta lane must publish ${key.replace(':', '')}`);
  }
}
let observedFieldCount = 0;
let numericFieldCount = 0;
let previousDate = null;
// P1246: 타당 범위는 producer가 선언한 **하나의** 맵을 그대로 쓴다. 게이트가 자기 리터럴을 따로
// 들고 있으면 선언과 집행이 조용히 어긋난다(P1127이 지적한 바로 그 경로).
const ranges = HIST_FIELD_PLAUSIBILITY;

for (const [index, row] of history.entries()) {
  if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) {
    errors.push(`row ${index}: date must be YYYY-MM-DD`);
    continue;
  }
  if (previousDate && row.date <= previousDate) errors.push(`row ${row.date}: dates must be unique and strictly increasing`);
  previousDate = row.date;
  for (const field of fields) {
    if (typeof row[field] !== 'number' || !Number.isFinite(row[field])) continue;
    numericFieldCount++;
    const allowed = ranges[field];
    if (allowed && (row[field] < allowed[0] || row[field] > allowed[1])) {
      errors.push(`row ${row.date} field ${field}: value ${row[field]} outside plausibility range ${allowed.join('..')}`);
    }
    const meta = row.fieldMeta?.[field];
    if (!meta || !meta.observedAt || !meta.fetchedAt || !meta.lastSuccessfulAt || !meta.source || !meta.sourceKind || !meta.allowedUse) {
      errors.push(`row ${row.date} field ${field}: incomplete fieldMeta`);
      continue;
    }
    if (!Number.isFinite(Date.parse(meta.observedAt)) || !Number.isFinite(Date.parse(meta.fetchedAt)) || !Number.isFinite(Date.parse(meta.lastSuccessfulAt))) {
      errors.push(`row ${row.date} field ${field}: unparseable timestamp`);
      continue;
    }
    const bucketEnd = Date.parse(`${row.date}T23:59:59.999Z`);
    if (Date.parse(meta.observedAt) > bucketEnd) {
      errors.push(`row ${row.date} field ${field}: observedAt is after the stored date bucket`);
      continue;
    }
    observedFieldCount++;
  }
}

const latest = history[history.length - 1];
if (latest?.seriesMode !== 'completed-market-cut' || !latest?.cycleEnd || !latest?.marketSnapshotRevision) {
  errors.push(`latest row ${latest?.date || 'missing'}: completed-market-cut metadata missing`);
}
for (const field of fields) {
  if (!Number.isFinite(latest?.[field])) continue;
  const meta = latest.fieldMeta?.[field] || {};
  if (meta.marketSession !== 'COMPLETED' || !['previous-completed-close','latest-completed-close'].includes(meta.valueBasis)) {
    errors.push(`latest row ${latest.date} field ${field}: session/valueBasis is not a completed close`);
  }
  if (['CURRENT_SESSION','DELAYED_IN_SESSION'].includes(meta.observedMarketSession) && meta.valueBasis !== 'previous-completed-close') {
    errors.push(`latest row ${latest.date} field ${field}: in-session observation promoted as daily close`);
  }
}

const snapshot = readJson('public-data/market-snapshot.json');
const snapshotMap = new Map((snapshot.quotes || []).map((row) => [row.instrumentId, row]));
const fieldSymbols = {
  spx:'^GSPC', nasdaq:'^IXIC', dow:'^DJI', rut:'^RUT', vix:'^VIX', tnx:'^TNX',
  dxy:'DX-Y.NYB', wti:'CL=F', gold:'GC=F', kospi:'^KS11', kosdaq:'^KQ11', btc:'BTC-USD',
  usdkrw:'KRW=X'
};
for (const [field, symbol] of Object.entries(fieldSymbols)) {
  const quote = snapshotMap.get(symbol);
  if (!quote || !Number.isFinite(latest?.[field])) continue;
  // Both artifacts now carry the same completed close for a 24/7 asset: history publishes
  // regularMarketPreviousClose with the boundary timestamp that closed it, and the snapshot
  // exposes that same previous value. The old continuous special case compared two DIFFERENT
  // live observations through a 2% band precisely because the artifacts deliberately disagreed;
  // they no longer do, so one rule covers every instrument (P1160 follow-up).
  // P1703: an extended-hours print (^VIX global trading hours) is not the completed close either.
  // The session is re-derived from the observation with the producer's own classifier, so a snapshot written before the
  // classifier learned about extended-hours prints is judged by today's rule.
  const session = deriveMarketSession({ instrumentId: symbol, observedAt: quote.observedAt, now: Date.parse(quote.fetchedAt || snapshot.generatedAt || '') }) || quote.session;
  // v58.71 (live 2026-10-23 03:53Z): Yahoo left BTC's 10/22 daily close empty, the snapshot published previousValue null,
  // and Number(null) = 0 made this check refuse the refresh ("84011.97 != 0"). A missing value has nothing to compare.
  const numberOrNaN = (value) => (value == null || value === '' ? NaN : Number(value));
  const expected = ['CURRENT_SESSION','DELAYED_IN_SESSION','PREMARKET','AFTER_HOURS'].includes(session) || ['CURRENT_SESSION','DELAYED_IN_SESSION'].includes(quote.session) ? numberOrNaN(quote.previousValue) : numberOrNaN(quote.value);
  const tolerance = 0.02;
  if (Number.isFinite(expected) && Math.abs(Number(latest[field]) - expected) > tolerance) {
    errors.push(`latest row ${latest.date} field ${field}: ${latest[field]} != ${symbol} completed value ${expected} (${quote.session})`);
  }
}

if (numericFieldCount === 0 || observedFieldCount !== numericFieldCount) {
  fail(`${errors.slice(0, 8).join('; ') || 'no numeric fields with complete field-level evidence'}`);
}
if (errors.length) fail(errors.slice(0, 12).join('; '));

const data = readJson('public-data/data.json');
const beaFixture = parseBeaPceHtml(`
  <h1>Personal Income and Outlays, June 2026</h1>
  <p>EMBARGOED UNTIL RELEASE AT 8:30 a.m. EDT, Thursday, July 30, 2026</p>
  <p>From the preceding month, the PCE price index for June decreased 0.1 percent.
  Excluding food and energy, the PCE price index increased 0.1 percent.</p>
  <p>From the same month one year ago, the PCE price index for June increased 3.7 percent.
  Excluding food and energy, the PCE price index increased 3.3 percent from one year ago.</p>
  <p>Next release: August 26, 2026, at 8:30 a.m. EDT</p>
`, 'https://www.bea.gov/news/fixture', '2026-07-31T00:00:00Z');
if (beaFixture.values.pce !== 3.7 || beaFixture.values.corePce !== 3.3 || beaFixture.values.pceMoM !== -0.1 || beaFixture.values.corePceMoM !== 0.1 || beaFixture.observedAt !== '2026-06-01') {
  fail(`BEA PCE parser fixture failed: ${JSON.stringify(beaFixture)}`);
}
// P1096: the live release page interposes the goods/services/food/energy detail
// between the monthly headline and the monthly core sentence. A character
// window that wide crossed into the twelve-month paragraph and published
// corePceMoM 3.3 (== corePce YoY) beside a correct pceMoM. The monthly core
// figure must come from the monthly paragraph regardless of that detail.
const beaLongDetailFixture = parseBeaPceHtml(`
  <h1>Personal Income and Outlays, July 2026</h1>
  <p>From the preceding month, the PCE price index for July increased 0.2 percent. Prices for goods increased 0.1 percent and prices for services increased 0.3 percent. Food prices decreased less than 0.1 percent and energy prices decreased 1.5 percent. Excluding food and energy, the PCE price index increased 0.2 percent.</p>
  <p>From the same month one year ago, the PCE price index for July increased 3.7 percent. Excluding food and energy, the PCE price index increased 3.3 percent from one year ago.</p>
  <p>Next release: September 30, 2026, at 8:30 a.m. EDT</p>
`, 'https://www.bea.gov/news/fixture-long-detail', '2026-08-28T00:00:00Z');
if (beaLongDetailFixture.values.pceMoM !== 0.2 || beaLongDetailFixture.values.corePceMoM !== 0.2 || beaLongDetailFixture.values.corePce !== 3.3) {
  fail(`BEA PCE long-detail fixture failed: ${JSON.stringify(beaLongDetailFixture.values)}`);
}
// P1096 exact reproduction: when the monthly paragraph carries no core clause,
// the old bounded window reached into the adjacent twelve-month paragraph and
// published pceMoM 0.2 with corePceMoM 3.3 (== corePce YoY) — the live shape.
const beaCrossParagraphFixture = parseBeaPceHtml(`
  <h1>Personal Income and Outlays, July 2026</h1>
  <p>From the preceding month, the PCE price index for July increased 0.2 percent. On a monthly basis, energy and food prices partly offset each other.</p>
  <p>From the same month one year ago, the PCE price index for July increased 3.7 percent. Excluding food and energy, the PCE price index increased 3.3 percent from one year ago.</p>
  <p>Next release: September 30, 2026, at 8:30 a.m. EDT</p>
`, 'https://www.bea.gov/news/fixture-cross-paragraph', '2026-08-28T00:00:00Z');
if (beaCrossParagraphFixture.values.pceMoM !== 0.2 || beaCrossParagraphFixture.values.corePceMoM !== null) {
  fail(`BEA PCE cross-paragraph guard failed: ${JSON.stringify(beaCrossParagraphFixture.values)}`);
}
if (beaCrossParagraphFixture.values.corePceMoM === beaCrossParagraphFixture.values.corePce) {
  fail('BEA PCE monthly core was substituted by the twelve-month core');
}
// Fail closed: without a monthly paragraph the monthly figures must be absent,
// never borrowed from the twelve-month paragraph.
const beaYoyOnlyFixture = parseBeaPceHtml(`
  <h1>Personal Income and Outlays, July 2026</h1>
  <p>From the same month one year ago, the PCE price index for July increased 3.7 percent. Excluding food and energy, the PCE price index increased 3.3 percent from one year ago.</p>
  <p>Next release: September 30, 2026, at 8:30 a.m. EDT</p>
`, 'https://www.bea.gov/news/fixture-yoy-only', '2026-08-28T00:00:00Z');
if (beaYoyOnlyFixture.values.pceMoM !== null || beaYoyOnlyFixture.values.corePceMoM !== null) {
  fail(`BEA PCE yoy-only fixture published a monthly figure it could not know: ${JSON.stringify(beaYoyOnlyFixture.values)}`);
}
// P1101: rows written by the market lane and the screener lane must converge on
// one column set, and a fieldMeta entry must never outlive its finite value.
const raggedFixture = normalizeHistoryRows([
  { date: '2026-09-15', seriesMode: 'completed-market-cut', cycleEnd: '2026-09-14T23:00:00.000Z', spx: 7000, fg: 30, breadth20: 55, pcr: 0.92, fieldMeta: { spx: { observedAt: '2026-09-15T20:00:00.000Z' }, fg: { observedAt: '2026-09-15T00:00:00.000Z' }, pcr: { observedAt: '2026-09-15' } } },
  { date: '2026-09-16', fieldMeta: { breadth50: { observedAt: '2026-09-15T13:30:00.000Z' } } },
  { date: '2026-09-17', seriesMode: 'completed-market-cut', cycleEnd: '2026-09-16T23:00:00.000Z', marketSnapshotRevision: 'market-snapshot:x:y', spx: null, fieldMeta: { spx: { observedAt: '2026-09-16T20:00:00.000Z' } } }
]);
const fixtureColumns = raggedFixture.map((row) => Object.keys(row).sort().join(','));
if (new Set(fixtureColumns).size !== 1) fail(`history row normalization left ragged rows: ${JSON.stringify(fixtureColumns)}`);
if (Object.keys(raggedFixture[1].fieldMeta).length !== 0 || Object.keys(raggedFixture[2].fieldMeta).length !== 0) {
  fail(`history row normalization kept fieldMeta for a null value: ${JSON.stringify(raggedFixture.map((row) => row.fieldMeta))}`);
}
if (!fixtureColumns[0].includes('breadth200,') || !fixtureColumns[0].includes('marketSnapshotRevision') || !fixtureColumns[0].includes('spx') || raggedFixture[1].pcr !== null) {
  fail(`history row normalization did not fill the shared column set: ${fixtureColumns[0]}`);
}
// v57.81: one session is one observation. The 10/12 DXY bar (row 10/12) and the same close read as the previous close
// at the 10/13 run (row 10/13) were two observations of 102.58; a later row repeating a recorded session is held.
{
  const meta = (observedAt, fetchedAt, extra = {}) => ({ observedAt, fetchedAt, lastSuccessfulAt: fetchedAt, source: 'Yahoo chart', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'completed-market-series', ...extra });
  const prevClose = { valueBasis: 'previous-completed-close', observationRelation: 'previous-completed-close', observedAtSource: 'provider-previous-close' };
  const rows = [
    { date: '2026-10-12', dxy: 102.58, usdkrw: 1340.84, fieldMeta: { dxy: meta('2026-10-12T04:00:00Z', '2026-10-12T19:23:21Z', { observationRelation: 'latest-completed-close', observedAtSource: 'provider-current' }), usdkrw: meta('2026-10-11T23:00:00Z', '2026-10-11T23:21:00Z', { ...prevClose, sessionDate: '2026-10-09' }) } },
    { date: '2026-10-13', dxy: 102.58, usdkrw: 1341.63, fieldMeta: { dxy: meta('2026-10-13T04:00:00Z', '2026-10-13T23:51:06Z', prevClose), usdkrw: meta('2026-10-11T23:00:00Z', '2026-10-12T07:51:00Z', { ...prevClose, sessionDate: '2026-10-09' }) } },
    { date: '2026-10-14', dxy: 102.18, fieldMeta: { dxy: meta('2026-10-14T04:00:00Z', '2026-10-14T23:21:26Z', prevClose) } },
  ];
  const first = holdRepeatedSessions(rows, { at: '2026-10-15T08:00:00Z' });
  const heldDxy = rows[1].fieldMeta.dxy;
  if (heldDxy.observationRelation !== 'carried-forward' || heldDxy.carriedFrom !== '2026-10-12' || heldDxy.sessionDate !== '2026-10-12' || heldDxy.heldReason !== 'session-already-recorded' || rows[1].dxy !== 102.58) fail(`v57.81 a repeated session is held, not a second observation: ${JSON.stringify(heldDxy)}`);
  if (rows[2].fieldMeta.dxy.observationRelation !== 'previous-completed-close') fail('v57.81 the 10/14 row holds the 10/13 DXY close — a distinct session stays an observation');
  // Two producer-dated reads of one session that differ: the later read revises the owner and the old value is kept.
  if (rows[0].usdkrw !== 1341.63 || rows[0].fieldMeta.usdkrw.revisions?.[0]?.value !== 1340.84 || rows[1].fieldMeta.usdkrw.observationRelation !== 'carried-forward' || first.revised.length !== 1) fail(`v57.81 a re-read of one session revises the owner with a record: ${JSON.stringify(rows[0].fieldMeta.usdkrw)}`);
  const snapshot = JSON.stringify(rows);
  const second = holdRepeatedSessions(rows, { at: '2026-10-15T08:30:00Z' });
  if (second.held.length || second.revised.length || JSON.stringify(rows) !== snapshot) fail('v57.81 holding repeated sessions is idempotent');
  // v58.71: today's row is rewritten each run; a value the owner already replaced does not come back, and a previous-close
  // read does not revise a settled latest-close owner.
  const today = (value, extra) => ({ date: '2026-10-14', usdkrw: value, dow: 52495.9, fieldMeta: { usdkrw: meta('2026-10-11T23:00:00Z', '2026-10-14T09:00:00Z', { ...prevClose, sessionDate: '2026-10-09' }), dow: meta('2026-10-13T13:30:00Z', '2026-10-14T09:00:00Z', { ...prevClose, sessionDate: '2026-10-13' }), ...extra } });
  const owned = [rows[0], { date: '2026-10-13', dow: 52495.88, fieldMeta: { dow: meta('2026-10-13T20:46:03Z', '2026-10-13T23:54:00Z', { observationRelation: 'latest-completed-close', observedAtSource: 'provider-current', sessionDate: '2026-10-13' }) } }];
  const flip = holdRepeatedSessions([...owned, today(1340.84)], { at: '2026-10-15T09:00:00Z' });
  if (rows[0].usdkrw !== 1341.63 || owned[1].dow !== 52495.88 || flip.revised.length || flip.held.length !== 2) fail(`v58.71 a replaced value or a previous-close read does not flip the owner back: ${JSON.stringify(flip)}`);
  // An evening reopen print of futures/FX/DXY is not a completed close; a Friday settle print is.
  if (!continuousReopenPrint('CL=F', '2026-10-11T23:01:22Z') || !continuousReopenPrint('DX-Y.NYB', '2026-10-04T23:26:48Z') || continuousReopenPrint('CL=F', '2026-10-09T20:59:58Z') || continuousReopenPrint('^GSPC', '2026-10-11T23:01:22Z')) fail('v57.81 a Sunday-evening futures/DXY print belongs to a session that has not completed');
}
// v57.81 (analysis audit 2026-10-15): the published won rows as written before sessionDate existed. The 10/12 row carries
// the 10/9 bar (the 10/8 backfill row's own stamp and value) and the 10/14 and 10/15 rows share the 10/14 23:00Z stamp
// with different values. FX bars are dated by the London session they close, so the reader collapses each copy onto
// its session and the producer holds the later repeat.
{
  const { buildCloseSeries } = await import('../src/domain/briefing/market-read.js');
  const fx = (observedAt, fetchedAt, relation) => ({ observedAt, fetchedAt, lastSuccessfulAt: fetchedAt, source: 'Yahoo chart', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'completed-market-series',
    ...(relation === 'prev' ? { valueBasis: 'previous-completed-close', observationRelation: 'previous-completed-close', observedAtSource: 'provider-previous-close' } : { observationRelation: 'latest-completed-close', observedAtSource: 'provider-current' }) });
  const won = [
    { date: '2026-10-07', usdkrw: 1339.08, fieldMeta: { usdkrw: fx('2026-10-07T23:00:00.000Z', '2026-10-14T20:22:02.080Z') } },
    { date: '2026-10-08', usdkrw: 1342.99, fieldMeta: { usdkrw: fx('2026-10-08T23:00:00.000Z', '2026-10-14T20:22:02.080Z') } },
    { date: '2026-10-12', usdkrw: 1342.99, fieldMeta: { usdkrw: fx('2026-10-08T23:00:00.000Z', '2026-10-12T19:23:21.927Z', 'prev') } },
    { date: '2026-10-13', usdkrw: 1339.88, fieldMeta: { usdkrw: fx('2026-10-13T23:00:00.000Z', '2026-10-13T23:51:06.874Z', 'prev') } },
    { date: '2026-10-14', usdkrw: 1340.84, fieldMeta: { usdkrw: fx('2026-10-14T23:00:00.000Z', '2026-10-14T23:21:26.878Z', 'prev') } },
    { date: '2026-10-15', usdkrw: 1341.63, fieldMeta: { usdkrw: fx('2026-10-14T23:00:00.000Z', '2026-10-15T11:30:53.313Z', 'prev') } },
  ];
  const series = buildCloseSeries(won, 'usdkrw');
  const dates = series.map((point) => point.date);
  if (JSON.stringify(dates) !== JSON.stringify(['2026-10-08', '2026-10-09', '2026-10-13', '2026-10-14']) || series.find((point) => point.date === '2026-10-09')?.value !== 1342.99 || series.at(-1).value !== 1341.63) fail(`v57.81 carried usdkrw copies collapse onto their London session: ${JSON.stringify(series)}`);
  const copy = structuredClone(won);
  const { held } = holdRepeatedSessions(copy, { at: '2026-10-15T12:00:00Z', fields: ['usdkrw'] });
  if (!held.some((row) => row.date === '2026-10-12' && row.session === '2026-10-09' && row.carriedFrom === '2026-10-08')) fail(`v57.81 the producer holds the 10/12 copy of the 10/9 won bar: ${JSON.stringify(held)}`);
}
const lkg = mergeMacroLastKnownGood(
  { _source: 'fred:no-key', _failedSeries: ['pce'] },
  { cpi: 3.5, _asOf_cpi: '2026-06-01', _source_cpi: 'fred-official-primary', hyOAS: 2.71, _source_hyOAS: 'fred-official-public-csv', _failedSeries: ['vix'] }
);
// 2026-10-14: `_failedSeries` lists only the current run's failures (an earlier run's 'vix' is not accumulated).
if (lkg.cpi !== 3.5 || lkg.hyOAS !== 2.71 || !lkg._failedSeries.includes('pce') || lkg._failedSeries.includes('vix')
  || lkg._source_cpi !== 'last-known-good' || lkg._source_hyOAS !== 'last-known-good'
  || lkg._originSource_cpi !== 'fred-official-primary' || lkg._freshness_cpi !== 'stale-reference') {
  fail(`macro LKG merge fixture failed: ${JSON.stringify(lkg)}`);
}
const nfp = Number(data.macro?.nfp);
if (Number.isFinite(nfp)) {
  const good = validateMarketAnalysisText(`NFP ${nfp}천명`, data);
  const bad = validateMarketAnalysisText(`NFP ${nfp}만명`, data);
  if (!good.ok || bad.ok || !bad.issues.includes('nfp-scale-mismatch')) {
    fail(`NFP semantic fixture failed: good=${JSON.stringify(good)} bad=${JSON.stringify(bad)}`);
  }
}

// ── P1246 (E3/E4 FX 축): USD/KRW 정본 열 · 품질 경계 · 공식 교차검증 계약 ────────────────
// (a) FX 열은 같은 producer 경로로 생산된다 — 값과 fieldMeta를 한 번의 열거에서 만든다.
if (!/HIST_SYMBOLS = \{[\s\S]*?'KRW=X': 'usdkrw'/.test(fetchDataSource)) {
  fail('fetch-data: history must map KRW=X to the usdkrw field, or the backtest FX axis has no producer');
}
if (!/const fieldValues = \{\}/.test(fetchDataSource) || !/fieldValues\[field\] = value;/.test(fetchDataSource)) {
  fail('fetch-data: the market lane must derive history values and fieldMeta from one enumeration');
}
// (b) 품질 경계: 선언된 범위 밖 값은 관측으로 승격되지 않는다.
if (!histValueWithinPlausibility('usdkrw', 1380) || histValueWithinPlausibility('usdkrw', 13.8)
  || histValueWithinPlausibility('usdkrw', null) || histValueWithinPlausibility('usdkrw', NaN)
  || !histValueWithinPlausibility('vix', 16) || histValueWithinPlausibility('vix', 4000)) {
  fail('fetch-data: the shared plausibility boundary must accept plausible values and reject implausible ones');
}
if (!/if \(!histValueWithinPlausibility\(field, row\.close\)\) continue;/.test(fetchDataSource)
  || !/const pickField = \(field, symbol\) => \{/.test(fetchDataSource)) {
  fail('fetch-data: both the backfill lane and the market lane must apply the shared plausibility boundary');
}
// (c) 공식 교차검증: FRED DEXKOUS 공개 CSV는 상태를 말하고, 비교는 값을 바꾸지 않는다.
const dexkousFixture = parseFredDexkousCsv('observation_date,DEXKOUS\n2026-09-18,1382.40\n2026-09-21,1391.05\n2026-09-19,.\n', '2026-09-25T00:00:00.000Z');
if (!dexkousFixture || dexkousFixture.value !== 1391.05 || dexkousFixture.observedAt !== '2026-09-21'
  || dexkousFixture.seriesId !== 'DEXKOUS' || dexkousFixture.decisionUse !== false
  || !/DEXKOUS/.test(dexkousFixture.sourceUrl || '')) {
  fail(`DEXKOUS CSV fixture failed: ${JSON.stringify(dexkousFixture)}`);
}
if (parseFredDexkousCsv('observation_date,DEXKOUS\n2026-09-19,.\n', '2026-09-25T00:00:00.000Z') !== null) {
  fail('a DEXKOUS CSV with no numeric observation must stay unavailable, not become zero');
}
const fxProvider = (value, date) => ({ value, date, observedAt: `${date}T00:00:00.000Z` });
// 같은 날짜 비교는 판정한다.
const fxAgreed = compareUsdKrwCrossCheck({ provider: fxProvider(1391.05, '2026-09-21'), official: dexkousFixture });
if (fxAgreed.status !== 'ok' || fxAgreed.comparable !== true || fxAgreed.dayGap !== 0 || fxAgreed.decisionUse !== false
  || fxAgreed.official?.seriesId !== 'DEXKOUS' || fxAgreed.providerValue !== 1391.05) {
  fail(`FX cross-check agreed fixture failed: ${JSON.stringify(fxAgreed)}`);
}
// 공급자 봉이 공식 관측일과 하루 어긋나도(00:00Z 일봉 경계) 판정한다 — 실제 날짜는 레코드에 남는다.
const fxAdjacent = compareUsdKrwCrossCheck({ provider: fxProvider(1385.20, '2026-09-22'), official: dexkousFixture });
if (fxAdjacent.status !== 'ok' || fxAdjacent.comparable !== true || fxAdjacent.dayGap !== 1 || fxAdjacent.providerDate !== '2026-09-22') {
  fail(`FX cross-check must still judge a one-day-stamped FX bar and record its real date: ${JSON.stringify(fxAdjacent)}`);
}
const fxDivergent = compareUsdKrwCrossCheck({ provider: fxProvider(1500, '2026-09-21'), official: dexkousFixture });
if (fxDivergent.status !== 'divergent' || !(fxDivergent.divergencePct > 5) || fxDivergent.providerValue !== 1500 || fxDivergent.officialValue !== 1391.05) {
  fail(`FX cross-check must report an aligned divergence without rewriting either value: ${JSON.stringify(fxDivergent)}`);
}
// 공식 계열의 공표 지연: 시점이 다른 두 값을 비교해 '불일치'라고 말하면 지연을 데이터 오류로 오표기한다.
const fxLagging = compareUsdKrwCrossCheck({ provider: fxProvider(1358.96, '2026-09-25'), official: dexkousFixture, latestProvider: { value: 1358.96, date: '2026-09-25' } });
if (fxLagging.status !== 'not-comparable' || fxLagging.comparable !== false || fxLagging.dayGap !== 4 || fxLagging.latestProviderValue !== 1358.96) {
  fail(`FX cross-check must not call a publication-lagged official series divergent: ${JSON.stringify(fxLagging)}`);
}
if (compareUsdKrwCrossCheck({ provider: null, official: dexkousFixture }).status !== 'unavailable'
  || compareUsdKrwCrossCheck({ provider: fxProvider(1391.05, '2026-09-21'), official: null }).status !== 'unavailable'
  || compareUsdKrwCrossCheck({}).status !== 'unavailable') {
  fail('FX cross-check must report unavailable when either side has no observation, never a fabricated value');
}
// 배선: 교차검증은 크립토 교차검증 옆에 발행되고, 히스토리 레인이 통째로 실패해도 판정 불가를 남긴다.
if (!/data\.providerCrossChecks\.fx = histInfo\?\.fxCrossCheck/.test(fetchDataSource)
  || !/\|\| compareUsdKrwCrossCheck\(\{ provider: null, official: fredDexkous/.test(fetchDataSource)) {
  fail('fetch-data must publish the FX cross-check beside the crypto cross-check, with a verdict even when the history lane fails');
}
// 배선: 비교는 **공식 관측일과 같은 시점**의 확정 종가로 한다(최신값으로 대신하지 않는다).
if (!/const officialDate = String\(officialFx\?\.observedAt/.test(fetchDataSource)
  || !/\.map\(\(candidate\) => hist\.find\(\(row\) => row && row\.date === candidate && Number\.isFinite\(row\.usdkrw\)\)\)/.test(fetchDataSource)) {
  fail('fetch-data must compare the official observation against the aligned provider close, not the latest value');
}

// v58.68 (live 2026-10-21/22): after the refresh outage the 10/21 row held the 10/20 close (valueBasis previous-completed-close),
// the backfill kept it, and the 10/21 US close never entered history. A bar replaces a value from another session; a
// completed record of the bar's own session still wins (P1656).
{
  const { mergeBackfillBars } = await import('./producer/history.mjs');
  const morningCut = { observedAt: '2026-10-20T13:30:00.000Z', valueBasis: 'previous-completed-close', observationRelation: 'previous-completed-close', sessionDate: '2026-10-20' };
  const closeRecord = { observedAt: '2026-10-22T20:31:48.000Z', valueBasis: 'provider-current-value', observationRelation: 'latest-completed-close' };
  const hist = [
    { date: '2026-10-21', spx: 7712.57, fieldMeta: { spx: morningCut } },
    { date: '2026-10-22', spx: 7663.43, fieldMeta: { spx: closeRecord } }
  ];
  const bar = (date, value) => ({ date, spx: value, fieldMeta: { spx: { observedAt: `${date}T13:30:00.000Z`, observationRelation: 'latest-completed-close', observedAtSource: 'provider-current', sessionDate: date } } });
  mergeBackfillBars(hist, { '2026-10-21': bar('2026-10-21', 7757.17), '2026-10-22': bar('2026-10-22', 7663.4) }, ['spx']);
  if (hist[0].spx !== 7757.17 || hist[0].fieldMeta.spx.sessionDate !== '2026-10-21') fail(`v58.68 a backfill bar must replace a value from another session: ${JSON.stringify(hist[0])}`);
  if (hist[1].spx !== 7663.43 || hist[1].fieldMeta.spx.valueBasis !== 'provider-current-value') fail('P1656/v58.68 a completed record of the same session as the bar must not be overwritten');
}

console.log(JSON.stringify({
  ok: true,
  rows: history.length,
  numericFields: numericFieldCount,
  fieldEvidence: observedFieldCount,
  latestSeriesMode: latest.seriesMode,
  completedCloseFields: fields.filter((field) => Number.isFinite(latest?.[field])).length,
  nfpScaleGate: Number.isFinite(nfp) ? 'PASS' : 'SKIPPED_NO_NFP'
}));
