import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeMacroLastKnownGood, normalizeHistoryRows, parseBeaPceHtml, validateMarketAnalysisText, HIST_FIELD_PLAUSIBILITY, histValueWithinPlausibility, parseFredDexkousCsv, compareUsdKrwCrossCheck } from './fetch-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const readText = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const fail = (message) => { throw new Error(`[history-field-time-contract] ${message}`); };

const history = readJson('public-data/history.json');
if (!Array.isArray(history) || history.length < 2) fail('history.json must contain at least two rows');
const fields = ['spx', 'nasdaq', 'dow', 'rut', 'vix', 'vvix', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'kosdaq', 'btc', 'usdkrw'];
const errors = [];
const fetchDataSource = readText('scripts/fetch-data.mjs');
if (!/regularMarketPreviousCloseObservedAt:[\s\S]{0,260}closeBars\[closeBars\.length - 1\]\.timestamp/.test(fetchDataSource)) {
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
  const expected = ['CURRENT_SESSION','DELAYED_IN_SESSION'].includes(quote.session) ? Number(quote.previousValue) : Number(quote.value);
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
  { date: '2026-09-15', seriesMode: 'completed-market-cut', cycleEnd: '2026-09-14T23:00:00.000Z', spx: 7000, fg: 30, breadth20: 55, fieldMeta: { spx: { observedAt: '2026-09-15T20:00:00.000Z' }, fg: { observedAt: '2026-09-15T00:00:00.000Z' } } },
  { date: '2026-09-16', fieldMeta: { breadth50: { observedAt: '2026-09-15T13:30:00.000Z' } } },
  { date: '2026-09-17', seriesMode: 'completed-market-cut', cycleEnd: '2026-09-16T23:00:00.000Z', marketSnapshotRevision: 'market-snapshot:x:y', spx: null, fieldMeta: { spx: { observedAt: '2026-09-16T20:00:00.000Z' } } }
]);
const fixtureColumns = raggedFixture.map((row) => Object.keys(row).sort().join(','));
if (new Set(fixtureColumns).size !== 1) fail(`history row normalization left ragged rows: ${JSON.stringify(fixtureColumns)}`);
if (Object.keys(raggedFixture[1].fieldMeta).length !== 0 || Object.keys(raggedFixture[2].fieldMeta).length !== 0) {
  fail(`history row normalization kept fieldMeta for a null value: ${JSON.stringify(raggedFixture.map((row) => row.fieldMeta))}`);
}
if (!fixtureColumns[0].includes('breadth200,') || !fixtureColumns[0].includes('marketSnapshotRevision') || !fixtureColumns[0].includes('spx')) {
  fail(`history row normalization did not fill the shared column set: ${fixtureColumns[0]}`);
}
const lkg = mergeMacroLastKnownGood(
  { _source: 'fred:no-key', _failedSeries: ['pce'] },
  { cpi: 3.5, _asOf_cpi: '2026-06-01', _source_cpi: 'fred-official-primary', hyOAS: 2.71, _source_hyOAS: 'fred-official-public-csv' }
);
if (lkg.cpi !== 3.5 || lkg.hyOAS !== 2.71 || !lkg._failedSeries.includes('pce')
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
// 배선: 비교는 **공식 관측일과 같은 시점**의 완료 종가로 한다(최신값으로 대신하지 않는다).
if (!/const officialDate = String\(officialFx\?\.observedAt/.test(fetchDataSource)
  || !/\.map\(\(candidate\) => hist\.find\(\(row\) => row && row\.date === candidate && Number\.isFinite\(row\.usdkrw\)\)\)/.test(fetchDataSource)) {
  fail('fetch-data must compare the official observation against the aligned provider close, not the latest value');
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
