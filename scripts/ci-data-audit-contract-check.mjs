#!/usr/bin/env node
// v59.70 data audit (2026-11-04, _artifacts/data-audit-20261104/REPORT.md): one offline gate for the pipeline
// redistribution items R3/R4/R5/R7/R8/R9/R10/R12. Each check runs the producer function on fixtures, so it fails on the
// code before the change (every series refetched each run, the backtest rebuilt every cycle, a stale record keeping
// decision use, a hand-kept Fed decision, producers without the rotation input, the aux symbols in the core floor).
import fs from 'node:fs';

const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// R2 (stage 1) is held by ci-history-session-model-check and the runtime contract (historyFieldMeta in close-series).

// R3: a series is refetched by its frequency or a due release, never on every cycle.
const macro = await import('./producer/macro-history.mjs');
{
  const nowMs = Date.parse('2026-11-10T13:30:00Z'); // 08:30 ET on a CPI day, before the 09:00 ET due time
  const fresh = (at) => ({ observations: [['2026-09-01', 1], ['2026-10-01', 2]], fetchedAt: at, stale: false });
  const schedules = { 'us-cpi': ['2026-11-10'] };
  check('v59.70 R3 a monthly series fetched an hour ago is not refetched', macro.macroSeriesDue({ id: 'CPIAUCSL', frequency: 'monthly' }, fresh('2026-11-10T12:30:00Z'), { nowMs, schedules }) === false);
  check('v59.70 R3 a scheduled CPI release makes the CPI series due from 09:00 ET', macro.macroSeriesDue({ id: 'CPIAUCSL', frequency: 'monthly' }, fresh('2026-11-10T12:30:00Z'), { nowMs: Date.parse('2026-11-10T14:05:00Z'), schedules }) === true);
  check('v59.70 R3 a daily series is refetched after its interval', macro.macroSeriesDue({ id: 'DGS10', frequency: 'daily' }, fresh('2026-11-10T09:00:00Z'), { nowMs }) === true);
  check('v59.70 R3 a stale (failed) series is retried every run', macro.macroSeriesDue({ id: 'DGS10', frequency: 'daily' }, { ...fresh('2026-11-10T13:00:00Z'), stale: true }, { nowMs }) === true);
  check('v59.70 R3 writeMacroHistory consults macroSeriesDue before fetching', /macroSeriesDue\(spec, prior, \{ nowMs, schedules \}\)/.test(read('scripts/producer/macro-history.mjs')));
}

// R4: producer-only files stay off Pages; the unread score backtest is rebuilt at most daily.
{
  const pages = read('.github/workflows/pages-deploy.yml');
  const manifest = JSON.parse(read('public-artifact-manifest.json'));
  const sw = read('sw.js');
  for (const file of ['sec-fundamentals-extended.json', 'telegram-observed.json', 'screener-extended-universe.json', 'score-backtest-history.json', 'score-backtest-longrun.json', 'operations-slo-window.json', 'telegram-reference-window.json']) {
    check(`v59.70 R4 Pages excludes producer-only ${file}`, pages.includes(`--exclude '${file}'`));
    check(`v59.70 R4 the public artifact manifest lists ${file} as excluded`, manifest.excludedFromPagesArtifact.includes(`public-data/${file}`));
    check(`v59.70 R4 the service worker never precaches excluded ${file}`, !sw.includes(file));
  }
  const fetchData = read('scripts/fetch-data.mjs');
  const due = fetchData.match(/export function scoreBacktestDue\([\s\S]*?\n\}/)?.[0];
  check('v59.70 R4 the score backtest has a daily due rule', !!due && /if \(scoreBacktestDue\(scoreBacktestAt\)\)/.test(fetchData));
}

// R5: a failed record never publishes decision use.
const evidence = await import('../src/data/contracts/evidence.js');
{
  const out = evidence.degradePayloadAllowedUse({ putCall: { status: 'stale-reference', allowedUse: 'decision-with-daily-delay' }, ok: { status: 'ok', allowedUse: 'decision-with-daily-delay' }, nested: { aaii: { status: 'unavailable', allowedUse: 'current-with-session-and-delay-gate' } } });
  check('v59.70 R5 a stale record is lowered to reference-only', out.putCall.allowedUse === 'reference-only' && out.putCall.allowedUseDeclared === 'decision-with-daily-delay');
  check('v59.70 R5 a current record keeps its declared use', out.ok.allowedUse === 'decision-with-daily-delay');
  check('v59.70 R5 a record one level down is lowered too', out.nested.aaii.allowedUse === 'reference-only');
  check('v59.70 R5 fetch-data publishes through the rule', /\.\.\.degradePayloadAllowedUse\(d\)/.test(read('scripts/fetch-data.mjs')));
  // Recomputed each run: the lowered record carried into the next artifact returns to its declared use once its status recovers.
  const carried = { ...out.putCall, status: 'ok' };
  const recovered = evidence.degradeAllowedUseOnStatus(carried);
  check('v59.70 R5 a carried record whose source recovered returns to its declared use', recovered.allowedUse === 'decision-with-daily-delay' && !('allowedUseDeclared' in recovered) && !('allowedUseDegradedBy' in recovered), JSON.stringify(recovered));
  const again = evidence.degradeAllowedUseOnStatus({ ...out.putCall, status: 'stale-reference' });
  check('v59.70 R5 a record lowered twice keeps the producer\'s declared use, not reference-only', again.allowedUseDeclared === 'decision-with-daily-delay' && again.allowedUse === 'reference-only');
  // One freshness model: a record without its own status follows the file's aio-freshness.v1 state.
  const noStatus = { allowedUse: 'decision-with-daily-delay', value: 1 };
  check('v59.70 R5 a record without status follows a stale file state', evidence.degradeAllowedUseOnStatus(noStatus, { fileState: 'stale' }).allowedUse === 'reference-only' && evidence.degradeAllowedUseOnStatus(noStatus, { fileState: 'fresh' }).allowedUse === 'decision-with-daily-delay');
  check('v59.70 R5 a record\'s own status wins over the file state', evidence.degradeAllowedUseOnStatus({ ...noStatus, status: 'ok' }, { fileState: 'stale' }).allowedUse === 'decision-with-daily-delay');
}

// R6(b) is held by ci-korea-participation-fixture (Naver parser, format guard). R6(c): OpenDART is not added (owner
// 2026-11-04) — no run writes a 0-company kr-fundamentals file, and none is published.
{
  const { mergeWithPrevious } = await import('./fetch-dart-fundamentals.mjs');
  check('v59.70 R6(c) a run that read no company publishes nothing', mergeWithPrevious({}, [], null).publish === false && mergeWithPrevious({}, [{ sym: '005930.KS', reason: 'timeout' }], null).publish === false);
  check('v59.70 R6(c) no 0-company kr-fundamentals.json is published', (() => { try { return JSON.parse(read('public-data/kr-fundamentals.json')).count > 0; } catch { return true; } })());
}

// R7: the FOMC decision comes from the target history, not a hand-kept string.
const calendars = await import('./lib/official-calendars.mjs');
{
  const upperHistory = [['2026-09-15', 3.75], ['2026-09-16', 3.75], ['2026-09-17', 4], ['2026-10-27', 4], ['2026-10-29', 4]];
  const hold = calendars.deriveFedDecision({ upper: 4, asOf: '2026-11-02', upperHistory, fomcDates: ['2026-09-16', '2026-10-28', '2026-12-09'] });
  const hike = calendars.deriveFedDecision({ upper: 4, asOf: '2026-09-20', upperHistory, fomcDates: ['2026-09-16', '2026-10-28'] });
  check('v59.70 R7 a meeting with no change reads 동결', hold?.decision === '동결' && hold.decisionDate === '2026-10-28', JSON.stringify(hold));
  check('v59.70 R7 a meeting that raised the upper bound reads 인상', hike?.decision === '인상' && hike.changePp === 0.25, JSON.stringify(hike));
  check('v59.70 R7 no meeting on record gives no decision', calendars.deriveFedDecision({ upper: 4, asOf: '2026-01-01', upperHistory, fomcDates: [] }) === null);
}

// R8: one input builder; the producers pass the rotation, S&P 500 breadth and index-earnings inputs.
{
  const { interpretationFromArtifacts } = await import('./lib/market-interpretation-inputs.mjs');
  const inputs = await import('../src/domain/interpretation/inputs.js');
  const market = inputs.regimeMarketInput({ macro: { hyOAS: 3.12, _asOf_hyOAS: '2026-11-02', _asOf_dgs2: '2026-11-02' }, breadthSp500: { above50: 40 }, nowMs: 0 });
  check('v59.70 R8 the shared builder carries the 2-year date and the S&P 500 breadth segment', market.rates.dgs2AsOf === '2026-11-02' && market.breadthSp500?.above50 === 40 && market.credit.hyBp === 312);
  const producer = read('scripts/lib/market-interpretation-inputs.mjs');
  const { collectInterpretationInputs } = await import('../src/data/selectors/interpretation.js');
  const rotation = { schemaVersion: 'rotation-history.v1' };
  const collected = collectInterpretationInputs({ DATA_SNAPSHOT: {}, _aioServerMacro: { _asOf_dgs2: '2026-11-02' }, _serverDataMeta: { rotationHistory: rotation } }, { nowMs: 0 });
  check('v59.70 R8 the browser adapter returns the shared builder shape', collected.rotationHistory === rotation && collected.market.rates.dgs2AsOf === '2026-11-02' && 'indexEarnings' in collected && 'releases' in collected.calendar);
  check('v59.70 R8 the producer adapter assembles the input through interpretationInput()', /interpretationInput\(\{/.test(producer));
  check('v59.70 R8 the producers pass the sector rotation and index earnings', /rotationHistory: data\?\.rotationHistory/.test(producer) && /indexEarningsInput\(/.test(producer));
  check('v59.70 R8 interpretationFromArtifacts runs on an empty input', typeof interpretationFromArtifacts({ nowMs: 0 }) === 'object');
}

// R9: one moving-average breadth counter.
{
  const { breadthCounts } = await import('../src/domain/market/breadth.js');
  const counts = breadthCounts([{ pctSma50: 2 }, { pctSma50: -1 }, { pctSma50: null }, {}], 'pctSma50');
  check('v59.70 R9 breadthCounts counts only measured rows', counts.count === 2 && counts.above === 1 && counts.pct === 50, JSON.stringify(counts));
}

// R10: the validation gates are computed from one criteria file and match what is published.
{
  const { buildValidationGates } = await import('./build-validation-gates.mjs');
  const criteria = JSON.parse(read('architecture/validation-gate-criteria.json'));
  const backtest = JSON.parse(read('public-data/factor-backtest-longrun.json'));
  const built = buildValidationGates({ criteria, backtest, nowIso: '2026-11-04T00:00:00Z' });
  const published = { gate: JSON.parse(read('public-data/screener-validation-gate.json')), model: JSON.parse(read('public-data/model-validation-status.json')) };
  check('v59.70 R10 the published gate equals the computed one', published.gate.status === built.screenerGate.status && published.gate.allowedUse === built.screenerGate.allowedUse && JSON.stringify(published.gate.blockers) === JSON.stringify(built.screenerGate.blockers));
  check('v59.70 R10 the published model status equals the computed one', published.model.status === built.modelValidation.status && published.model.predictiveValidation === built.modelValidation.predictiveValidation);
  check('v59.70 R10 today\'s backtest meets none of the seven requirements (BLOCKED, relative ranking only)', built.screenerGate.status === 'BLOCKED' && built.screenerGate.allowedUse === 'research-relative-ranking-only' && built.screenerGate.blockers.length === 7, JSON.stringify(built.screenerGate.blockers));
  // A backtest that carries every piece of evidence passes; take any one away and both gates block again on it.
  const complete = {
    generatedAt: '2026-11-04T00:00:00Z', universe: { includesDelisted: true },
    methodology: { universeBasis: 'point-in-time', corporateActions: 'adjusted', fundamentalsAsOf: 'filing-available-date', transactionCostBps: 10, returnsNetOfCost: true, capacity: { maxAdvShare: 0.05 }, excludedFactors: [], regimeWeightsValidated: true },
    overallByHorizon: { fwd21d: { turnover: 0.3, icIR: {} } }
  };
  const pass = buildValidationGates({ criteria, backtest: complete, nowIso: '2026-11-04T00:00:00Z' });
  check('v59.70 R10 a backtest with every requirement passes both gates', pass.screenerGate.status === 'PASS' && pass.modelValidation.status === 'PASS' && pass.screenerGate.blockers.length === 0);
  for (const [key, broken] of [['pointInTimeUniverse', { methodology: { ...complete.methodology, survivorshipBiasCaveat: 'present-day universe' } }], ['turnoverModeled', { overallByHorizon: { fwd21d: { icIR: {} } } }], ['liveBacktestParity', { methodology: { ...complete.methodology, excludedFactors: ['value'] } }]]) {
    const one = buildValidationGates({ criteria, backtest: { ...complete, ...broken }, nowIso: '2026-11-04T00:00:00Z' });
    check(`v59.70 R10 a backtest missing ${key} blocks on that requirement alone`, one.screenerGate.status === 'BLOCKED' && JSON.stringify(one.screenerGate.blockers) === JSON.stringify([key]) && one.modelValidation.status === 'BLOCKED');
  }
}

// R12: the research symbols are collected but never count toward the core floor.
{
  const quotes = await import('./producer/quotes.mjs');
  check('v59.70 R12 aux symbols are in the fetch list but not the core list', quotes.AUX_SYMBOLS.every((sym) => quotes.SYMBOLS.includes(sym) && !quotes.CORE_SYMBOLS.includes(sym)));
  const fetchData = read('scripts/fetch-data.mjs');
  check('v59.70 R12 the coverage floor and the counts read the core set', /Math\.ceil\(CORE_SYMBOLS\.length \* 0\.5\)/.test(fetchData) && /symbolCount: CORE_SYMBOLS\.length/.test(fetchData) && !/requiredQuoteCount: SYMBOLS\.length/.test(fetchData));
  const history = read('scripts/producer/history.mjs');
  check('v59.70 R12 history has the research columns with plausibility ranges', ['sox', 'move', 'skew', 'vix9d'].every((field) => new RegExp(`'${field}'`).test(history) && new RegExp(`${field}: \\[`).test(history)));
  check('v59.70 R12 a thin research column never triggers the full backfill', /!AUX_HIST_FIELDS\.has\(field\) && thinField\(field\)/.test(history));
}

// R8 extension: the story reads five sessions of session-dated closes, and the verdict table's two watch rows stay
// outside the counts.
{
  const { buildMarketStory, STORY_SESSIONS } = await import('../src/domain/market/market-story.js');
  const { MARKET_WINDOWS } = await import('../src/domain/market/market-windows.js');
  const days = ['2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-02'];
  // Each row's NDX is the previous session's completed close; read by row date it would be one session late.
  const history = days.map((date, i) => ({ date, spx: 6000 + i * 10, ndx: 20000 + i * 100,
    fieldMeta: i ? { ndx: { sessionDate: days[i - 1], observationRelation: 'previous-completed-close', observedAt: `${days[i - 1]}T20:00:00Z` } } : {} }));
  const story = buildMarketStory({ history, nowMs: Date.parse('2026-11-03T14:00:00Z') });
  const ndx = story.bars?.find((bar) => bar.id === 'ndx');
  check('v59.70 story window is the table week (5 sessions)', STORY_SESSIONS === MARKET_WINDOWS.week && MARKET_WINDOWS.week === 5 && story.sessions === 5, `${STORY_SESSIONS}/${story.sessions}`);
  check('v59.70 story moves read session-dated closes, not the value carried on the row date', ndx?.asOf === '2026-10-30' && Math.abs(ndx.pct - (400 / 20300) * 100) < 1e-9, JSON.stringify(ndx));
  const { interpretationFromArtifacts } = await import('./lib/market-interpretation-inputs.mjs');
  const pd = (file) => JSON.parse(read(`public-data/${file}`));
  const out = interpretationFromArtifacts({ data: pd('data.json'), history: pd('history.json'), macroHistory: pd('macro-history.json'), screener: pd('screener.json'), nowMs: Date.parse('2026-11-03T14:00:00Z') });
  const regime = out.regime || out;
  const watch = Object.fromEntries((regime.watchAxes || []).map((row) => [row.id, row]));
  check('v59.70 the verdict table has the 심리 and AI·반도체 집중 watch rows', watch.sentiment && watch.leadership && watch.sentiment.watch && watch.leadership.watch, Object.keys(watch).join(','));
  check('v59.70 심리 carries no weight and AI·반도체 reaches the overall only through the leadership cap', watch.sentiment?.weight === 'none' && watch.leadership?.weight === 'leadership-cap');
  const counted = Object.values(regime.counts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  check('v59.70 the watch rows stay outside the counts', counted <= (regime.axes || []).length && !(regime.axes || []).some((row) => row.id === 'sentiment' || row.id === 'leadership'), `${counted}/${regime.axes?.length}`);
}

// v59.70 (owner 11/4): the Cboe put/call is retired — Cboe's terms forbid copying, storing and redistributing its
// statistics. Nothing may collect it again, history.json drops the stored 'pcr' column on its next write, and no score
// reads it. Each check runs the producer or domain function, so the code before the removal fails it.
{
  const planes = await import('./producer/source-planes.mjs');
  const macroSources = await import('./lib/macro-sources.mjs');
  check('v59.70 Cboe: no source plane collects put/call', !planes.sourcePlanes({ prior: {}, attemptedAt: '2026-11-04T00:00:00Z', env: {} }).some((plane) => /put.?call|cboe/i.test(`${plane.id} ${plane.label}`)));
  check('v59.70 Cboe: the macro sources export no Cboe reader', !Object.keys(macroSources).some((name) => /cboe|putcall/i.test(name)));
  const { normalizeHistoryRows, RETIRED_HIST_FIELDS } = await import('./producer/history.mjs');
  const rows = normalizeHistoryRows([{ date: '2026-10-22', spx: 6800, pcr: 0.94, fieldMeta: { spx: { observedAt: '2026-10-22T20:00:00Z' }, pcr: { observedAt: '2026-10-22', source: 'Cboe Daily Market Statistics' } } }]);
  check('v59.70 Cboe: a history write removes the stored pcr value and its provenance', RETIRED_HIST_FIELDS.includes('pcr') && !('pcr' in rows[0]) && !('pcr' in rows[0].fieldMeta) && rows[0].spx === 6800, JSON.stringify(rows[0]).slice(0, 200));
  const { computeCompositeFearGreed } = await import('../src/domain/sentiment/composite-fear-greed.js');
  const composite = computeCompositeFearGreed({ history: [{ date: '2026-10-22', spx: 6800, pcr: 0.9 }] });
  check('v59.70 Cboe: the sentiment composite has no put/call component', composite.componentsTotal === 6 && !composite.components.some((row) => row.id === 'putCall'));
  const { computeTradingScoreModel } = await import('../src/domain/signal/trading-score.js');
  const base = { mode: 'swing', vix: 18, vvix: 90, dxy: 100, tnx: 3.5, oilPrice: 80, maCurrent: true, spx200ma: 450, spx50ma: 480, spxPrice: 500, breadthAvailable: true, breadth200: 60, hyBp: 300 };
  check('v59.70 Cboe: the trading score does not read put/call', computeTradingScoreModel({ ...base, pcr: 1.6 }).total === computeTradingScoreModel(base).total);
  // Code that would call Cboe again (its statistics page or CDN, the page's ratio labels) or publish the old fields.
  const code = (dir) => fs.readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? (entry.name === 'node_modules' || entry.name === 'fixtures' ? [] : code(`${dir}/${entry.name}`)) : /\.(?:m?js)$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
  const CBOE_CALL = /cboe\.com\/data\/mktstat|cdn\.cboe\.com|TOTAL PUT\/CALL RATIO|_lastPutCallPayload\s*=|putCallOk\s*:|\bputCall\s*:\s*(?:putCall|data\.putCall)/;
  const hits = [...code('scripts'), ...code('src'), ...code('js'), 'cloudflare-worker-proxy.js'].filter((rel) => rel !== 'scripts/ci-data-audit-contract-check.mjs')
    .filter((rel) => read(rel).split('\n').some((line) => !/^\s*(?:\/\/|\*)/.test(line) && CBOE_CALL.test(line)));
  check('v59.70 Cboe: no code calls Cboe or publishes put/call', hits.length === 0, hits.join(', '));
  // ui-states' 11/4 report: the credit axis, its fields and the cross readings still took put/call. The credit state must not
  // move with it, and no domain file reads it except 13F option rows (the two integration shims left with the card).
  const { creditState } = await import('../src/domain/briefing/market-read.js');
  const calm = { hyBp: 300, hy5: -2, hy20: 5 };
  check('v59.70 Cboe: the credit state ignores a put/call input', JSON.stringify(creditState({ ...calm, pcr: 0.6 })) === JSON.stringify(creditState(calm)) && JSON.stringify(creditState({ ...calm, pcr: 1.4 })) === JSON.stringify(creditState(calm)));
  const PCR_READ = /\bpcr\b|putCall/;
  const SHIMS = [/!row\.putCall/];
  const domainHits = code('src/domain').flatMap((rel) => read(rel).split('\n').map((line, index) => ({ rel, line, index }))
    .filter(({ line }) => !/^\s*(?:\/\/|\*)/.test(line) && PCR_READ.test(line) && !SHIMS.some((shim) => shim.test(line))).map(({ rel, index }) => `${rel}:${index + 1}`));
  check('v59.70 Cboe: no domain file reads put/call outside 13F option rows',domainHits.length === 0, domainHits.join(', '));
}

// v59.70 (owner 11/4, "SOXX로 하자 … SOXX가 개미 투자자들을 더 대표"): the 'AI 주도' leadership proxy is SOXX, not the
// Nasdaq-100. Each check runs the rule, so the NDX-proxy code fails it: a SOXX slide under a firm Nasdaq-100 is a weak
// proxy, a firm SOXX under a falling Nasdaq-100 is not, and the Nasdaq-100 alone decides nothing.
{
  const { leadershipBreakOf } = await import('../src/domain/briefing/market-read.js');
  const { RULES } = await import('../src/domain/rules/thresholds.js');
  const asOf = '2026-11-02';
  const firm = (value) => ({ value, ma50: 100, d5: value, yearMax: 120, date: asOf });
  const slide = { value: 90, ma50: 100, d5: 97, yearMax: 120, date: asOf };
  const semisWeak = leadershipBreakOf({ soxx: slide, ndx: firm(110) }, asOf);
  const ndxWeak = leadershipBreakOf({ soxx: firm(110), ndx: slide }, asOf);
  check('v59.70 SOXX: the leadership proxy is SOXX', semisWeak.proxy === 'soxx' && semisWeak.proxyWeak === true && ndxWeak.proxyWeak === false && /^SOXX 5거래일/.test(semisWeak.summary), JSON.stringify({ semis: [semisWeak.proxy, semisWeak.proxyWeak], ndx: ndxWeak.proxyWeak }));
  check('v59.70 SOXX: without SOXX the Nasdaq-100 does not stand in', leadershipBreakOf({ ndx: slide }, asOf).available === false);
  const L = RULES.leadership;
  check('v59.70 SOXX: the edges are the volatility-scaled SOXX ones', L.proxyDrop5dPct === 6 && L.proxyBufferPct === 2 && L.aiLagSemis20dPp === 10 && L.semisLagRsp5dPp === 7 && !('aiLagNdx20dPp' in L) && !('leaderDrop5dPct' in RULES.trend), JSON.stringify(L));
  const { BRANCHES } = await import('../src/domain/market/macro-crossroads.js');
  const aiLag = BRANCHES.find((branch) => branch.id === 'aibust').conditions[0][1];
  check('v59.70 SOXX: the AI 투자 꺾임 gate reads SOXX, not the Nasdaq-100 or SMH', aiLag({ soxxRel20: -11 }) === true && aiLag({ ndxRel20: -5, smhRel20: -12 }) === null && aiLag({ soxxRel20: -9 }) === false);
  const { normalizeHistoryRows: normalize, HIST_FIELD_PLAUSIBILITY } = await import('./producer/history.mjs');
  const { CORE_SYMBOLS, AUX_SYMBOLS } = await import('./producer/quotes.mjs');
  check('v59.70 SOXX: a core quote and a history column with bounds', CORE_SYMBOLS.includes('SOXX') && !AUX_SYMBOLS.includes('SOXX') && Array.isArray(HIST_FIELD_PLAUSIBILITY.soxx) && 'soxx' in normalize([{ date: asOf, fieldMeta: {} }])[0]);
  const { buildMarketStory } = await import('../src/domain/market/market-story.js');
  const { resolveMarketCalendarSession } = await import('../src/domain/market/market-calendar.js');
  const days = [];
  for (let t = Date.parse('2026-10-19T12:00:00Z'); days.length < 8; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') days.push(date);
  }
  const storyRows = days.map((date, i) => ({ date, spx: 6800 + i, ndx: 25000 + i, smh: 300 - i, soxx: 250 - i * 2 }));
  const bars = buildMarketStory({ history: storyRows, nowMs: Date.parse(`${days.at(-1)}T22:00:00Z`) })?.bars || [];
  check('v59.70 SOXX: the 무슨 일이 있었나 semiconductor bar is SOXX', bars.some((bar) => bar.id === 'soxx' && bar.label === '반도체 SOXX') && !bars.some((bar) => bar.id === 'smh'), JSON.stringify(bars.map((bar) => bar.id)));
}

if (failures.length) {
  console.error(`Data audit contract FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Data audit contract OK: R3 due, R4 deploy/lane, R5 status ceiling, R7 produced Fed decision, R8 one input builder, R9 breadth counter, R10 computed gates, R12 aux symbols.');
