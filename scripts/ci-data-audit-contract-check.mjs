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
  // The published history.json is history.v2 once the producer runs (v59.70); read it the way the producers do.
  const { readHistoryRows } = await import('../src/domain/market/history-rows.js');
  const out = interpretationFromArtifacts({ data: pd('data.json'), history: readHistoryRows(pd('history.json')), macroHistory: pd('macro-history.json'), screener: pd('screener.json'), nowMs: Date.parse('2026-11-03T14:00:00Z') });
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
  // v59.70 (owner 11/4 "권장안대로"): one semiconductor gauge app-wide — the home card, index levels, charts, day account,
  // cross-asset moves, earnings reactions, the money-flow growth basket and market-day facts read SOXX; the smh history
  // column stays data only. A domain or UI module that reads the 'smh' field again fails.
  const { INDEX_STRIP } = await import('../src/ui/components/home-index-strip.js');
  const { LEVEL_FIELDS } = await import('../src/domain/market/index-levels.js');
  const { CHART_INDEXES } = await import('../src/domain/technical/market-charts.js');
  check('v59.70 SOXX: the home semiconductor card, index levels and charts are SOXX', INDEX_STRIP.some((row) => row.sym === 'SOXX' && row.close === 'soxx') && !INDEX_STRIP.some((row) => row.sym === 'SMH')
    && LEVEL_FIELDS.some(([field]) => field === 'soxx') && CHART_INDEXES.some(([field]) => field === 'soxx') && ![...LEVEL_FIELDS, ...CHART_INDEXES].some(([field]) => field === 'smh'));
  const SMH_FIELD = /['"]smh['"]|\.smh\b|\bsmh\s*:/;
  const jsFiles = (dir) => fs.readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? jsFiles(`${dir}/${entry.name}`) : /\.(?:m?js)$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
  const smhReads = [...jsFiles('src/domain'), ...jsFiles('src/ui')].filter((rel) => !/^src\/domain\/(?:research|knowledge)\/|history-session\.js$/.test(rel))
    .flatMap((rel) => read(rel).split('\n').map((line, index) => ({ rel, line, index })).filter(({ line }) => !/^\s*(?:\/\/|\*)/.test(line) && SMH_FIELD.test(line)).map(({ rel, index }) => `${rel}:${index + 1}`));
  check('v59.70 SOXX: no screen reads the smh history column', smhReads.length === 0, smhReads.join(', '));
  check('v59.70 SOXX: the 무슨 일이 있었나 semiconductor bar is SOXX', bars.some((bar) => bar.id === 'soxx' && bar.label === '반도체 SOXX') && !bars.some((bar) => bar.id === 'smh'), JSON.stringify(bars.map((bar) => bar.id)));
}

// v59.70 (screen review 11/4 + X bookmarks #3): one 20-session HY change and one credit rule on every screen. 시장 상태 said
// '20일 +34bp' beside 연결해서 보면 '+32bp' (each counted its own window), and 매크로's credit chapter called +40bp or 4.5%
// 위기 with a '3.5% 돌파' flip while the credit axis (RULES.credit, creditState) read 중립.
{
  const { hyDelta20Bp } = await import('../src/domain/briefing/market-read.js');
  const { buildMacroChapters } = await import('../src/domain/macro/macro-chapters.js');
  const { crossReadings } = await import('../src/domain/market/cross-readings.js');
  const { resolveMarketCalendarSession } = await import('../src/domain/market/market-calendar.js');
  const sessions = [];
  for (let t = Date.parse('2026-02-02T12:00:00Z'); sessions.length < 201; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') sessions.push(date);
  }
  // HY swinging ±30bp on a 40-session cycle (its 20-session record reaches ~60bp, so a record stress needs 50bp), then +45bp
  // over the last 20 sessions to ~340bp — wider than widen20dBp, short of the record edge and of 350bp.
  const wave = (i) => 2.9 + 0.3 * Math.sin(2 * Math.PI * i / 40);
  // FRED publishes a day after the close: the history's 10-year yield already has session 201 when HY ends at 200 (11/3 vs
  // 11/2 on 11/4), which made the paired reading a 19-session HY change.
  const hyObs = sessions.slice(0, 200).map((date, i) => [date, i < 180 ? wave(i) : wave(179) + (i - 179) * 0.0225]);
  const mh = { series: { hyOas: { observations: hyObs }, cccOas: { observations: sessions.map((date) => [date, 9]) }, igOas: { observations: sessions.map((date) => [date, 0.8]) } } };
  const hist = sessions.map((date, i) => ({ date, tnx: 4 - (i >= 180 ? (i - 179) * 0.006 : 0), fieldMeta: { tnx: { sessionDate: date, observedAt: `${date}T20:00:00Z` } } }));
  const axisHy20 = hyDelta20Bp(mh)?.value;
  const chapter = buildMacroChapters({ macroHistory: mh, history: hist }).find?.((item) => item?.id === 'credit') || buildMacroChapters({ macroHistory: mh, history: hist }).chapters?.find((item) => item.id === 'credit');
  const pair = crossReadings({ history: hist, macroHistory: mh }).find((item) => item.id === 'rates-credit');
  const quoted = (text) => Number((text || '').match(/하이일드 스프레드 ([+-]?\d+)bp/)?.[1]);
  check('v59.70 HY 20-session change: 매크로 and 연결해서 보면 quote the credit axis\'s number', Number.isFinite(axisHy20) && Math.round(axisHy20) === 45
    && new RegExp(`\\(\\+${Math.round(axisHy20)}bp\\)`).test(chapter?.now || '') && quoted(pair?.text) === Math.round(axisHy20), JSON.stringify({ axisHy20, now: chapter?.now, pair: pair?.text?.slice(0, 60) }));
  check('v59.70 매크로 credit chapter: +45bp at 345bp is the credit axis\'s 중립, not 위기', chapter?.state === 'neutral' && !/크게 벌어졌습니다/.test(chapter?.mean || '') && !/3\.5%/.test(chapter?.flip || '') && /4\.5%/.test(chapter?.flip || ''), JSON.stringify({ state: chapter?.state, mean: chapter?.mean?.slice(0, 40), flip: chapter?.flip }));
  // X bookmarks #4: the long range is each tier's own recorded quantile band (FRED serves ~3 years), never a fixed 150bp.
  const ranges = chapter?.ranges;
  const hyRange = ranges?.ranges?.find((range) => range.id === 'hyOas');
  check('v59.70 매크로 credit chapter: IG, HY and CCC sit in their own recorded p10~p90 band', ranges?.ranges?.length === 3
    && ranges.ranges.every((range) => [range.p10, range.p50, range.p90, range.now].every(Number.isFinite) && range.p10 <= range.p50 && range.p50 <= range.p90)
    && hyRange?.pct >= 90 && ranges.ranges.filter((range) => range.id !== 'hyOas').every((range) => range.pct === 50)
    && /^하이일드 3\.\d\d%, 2026년 2월 이후 기록의 \d+% 위치/.test(ranges.line) && !/150\s*bp/.test(JSON.stringify(ranges)), JSON.stringify({ line: ranges?.line, hy: hyRange?.pct }));
  const { MACRO_HISTORY_SERIES } = await import('./producer/macro-history.mjs');
  check('v59.70 macro-history keeps every OAS observation FRED serves (800 rows, not 280)', ['hyOas', 'igOas', 'cccOas'].every((id) => MACRO_HISTORY_SERIES[id]?.limit === 800));
}

// v59.70 (X bookmarks #1): Nasdaq correction base rates — "N번 중 N번" with the definition, outside the verdict.
{
  const { correctionBaseRates, correctionReading } = await import('../src/domain/scenarios/correction-base-rates.js');
  // 12 cycles from 1990: a 10-session -8% dip (fast), every third cycle a 300-session slide to -25% (slow, bear), then a new record.
  const closes = []; let level = 100; let day = Date.parse('1990-01-02T00:00:00Z');
  const push = (value) => { closes.push([new Date(day).toISOString().slice(0, 10), value]); day += 86400000; };
  for (let cycle = 0; cycle < 12; cycle += 1) {
    for (let i = 0; i < 20; i += 1) push(level *= 1.002);
    const bear = cycle % 3 === 2; const steps = bear ? 300 : 10; const floor = bear ? 0.75 : 0.92; const top = level;
    for (let i = 1; i <= steps; i += 1) push(top * (1 - (1 - floor) * i / steps));
    for (let i = 1; i <= steps; i += 1) push(top * (floor + (1.01 - floor) * i / steps));
    level = top * 1.01;
  }
  const rates = correctionBaseRates(closes);
  check('v59.70 correction base rate: 12 corrections, 4 bear markets, 8 fast with none bear', rates?.n === 12 && rates.bear === 4 && rates.fastN === 8 && rates.fastBear === 0 && rates.events?.length === 12, JSON.stringify(rates && { n: rates.n, bear: rates.bear, fastN: rates.fastN, fastBear: rates.fastBear }));
  const reading = correctionReading(rates, { close: rates.high.close * 0.92, recordClose: rates.high.close });
  check('v59.70 correction base rate: the line says N번 중 N번 with its definition, never a probability', /1990년 이후 나스닥 종합 7% 이상 조정 12번 중 4번이 -20%까지/.test(reading?.text || '') && /8번 중 0번/.test(reading.text)
    && /^정의: 직전 최고 종가보다 7% 이상/.test(reading.definition) && /판정 점수에는 넣지 않습니다/.test(reading.definition) && !/확률|가능성/.test(reading.text + reading.definition), reading?.text);
  const { buildScenarioOutcomes } = await import('./build-scenario-outcomes.mjs');
  const outcomeBody = buildScenarioOutcomes({ market: {}, nasdaq: closes });
  check('v59.70 scenario-outcomes publishes the Nasdaq correction counts from the closes it is given', outcomeBody.corrections?.n === 12 && outcomeBody.corrections.bear === 4 && buildScenarioOutcomes({ market: {} }).corrections === null);
}

// v59.70 (X bookmarks #6, #11): flows after a release and the beat-but-fell share, on closes, outside any verdict.
{
  const { eventAftermath, beatButFell } = await import('../src/domain/briefing/event-aftermath.js');
  const { resolveMarketCalendarSession } = await import('../src/domain/market/market-calendar.js');
  const days = [];
  for (let t = Date.parse('2026-10-01T12:00:00Z'); days.length < 20; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') days.push(date);
  }
  // A release at 14:00 ET on days[10]: S&P 500 flat after it, Nasdaq 100 +3%, defensives -1%, RSP and RUT flat.
  const hist = days.map((date, i) => {
    const k = Math.max(0, i - 9);
    const row = { date, spx: 6000, ndx: 20000 * (1 + 0.01 * Math.min(k, 3)), xlp: 80 * (1 - 0.0033 * Math.min(k, 3)), xlu: 70 * (1 - 0.0033 * Math.min(k, 3)), xlv: 140 * (1 - 0.0033 * Math.min(k, 3)), rsp: 180, rut: 2400, fieldMeta: {} };
    for (const field of ['spx', 'ndx', 'xlp', 'xlu', 'xlv', 'rsp', 'rut']) row.fieldMeta[field] = { sessionDate: date, observedAt: `${date}T20:00:00Z` };
    return row;
  }).slice(0, 13);
  const flow = eventAftermath(hist, { publishedAt: `${days[10]}T18:00:00Z`, label: 'FOMC' });
  check('v59.70 event aftermath: three sessions after the release read 기술로 복귀 against the S&P 500', flow?.sessions === 3 && flow.from === days[9] && flow.outcome === '기술로 복귀'
    && /^FOMC 뒤 3거래일, S&P 500 대비 기술 \+3\.0%p, 방어 업종 -1\.0%p, 동일가중·소형 0\.0%p — 기술로 복귀\.$/.test(flow.text), JSON.stringify(flow));
  check('v59.70 event aftermath: one session after the release is not read yet', eventAftermath(hist.slice(0, 11), { publishedAt: `${days[10]}T18:00:00Z` }) === null);
  const brief = (surprisePct, close) => ({ kind: 'earnings', figures: [{ metric: 'eps_diluted', estimate: { surprisePct } }], reaction: { firstPct: close } });
  const briefs = [...Array.from({ length: 10 }, (_, i) => brief(5, i < 6 ? -2 : 1)), ...Array.from({ length: 4 }, () => brief(-5, -3))];
  const beats = beatButFell(briefs);
  check('v59.70 호재 무반응: 10 beats, 6 fell, beside all reports', beats?.beats === 10 && beats.fell === 6 && beats.share === 60 && beats.reports === 14 && beats.allFell === 10, JSON.stringify(beats));
  const { HIST_FIELD_PLAUSIBILITY } = await import('./producer/history.mjs');
  check('v59.70 history keeps XLP, XLU and XLV closes', ['xlp', 'xlu', 'xlv'].every((field) => Array.isArray(HIST_FIELD_PLAUSIBILITY[field])));
}

// v59.70 (X bookmarks #8): quarter-end inventory and receivables — collected from 10-Q/10-K, projected as two quarter
// columns, read against revenue's step.
{
  const { quarterlyHistory } = await import('./lib/sec-fiscal-history.mjs');
  const { parseQuarterHistory, buildWorkingCapitalRead } = await import('../src/domain/fundamental/quarter-read.js');
  const { SEC_NORMALIZER_VERSION, normalizeSecCompanyFacts } = await import('../src/domain/fundamental/sec-normalize.js');
  // A minimal companyfacts document: two fiscal years, two 10-Q quarters, and quarter-end inventory and receivables.
  const fact = (start, end, val, form = '10-K', fp = 'FY', fy = 2025, filed = '2026-02-20') => ({ start, end, val, form, fp, fy, filed, accn: `0000-${end}-${form}` });
  const usd = (rows) => ({ units: { USD: rows } });
  const q2 = ['10-Q', 'Q2', 2026, '2026-08-01']; const q3 = ['10-Q', 'Q3', 2026, '2026-11-01'];
  const record = normalizeSecCompanyFacts('FIX', { cik: 2488, entityName: 'Fixture Corp', facts: {
    dei: { EntityCommonStockSharesOutstanding: { units: { shares: [fact(null, '2026-02-01', 1.6e9)] } } },
    'us-gaap': {
      Revenues: usd([fact('2025-01-01', '2025-12-31', 30e9), fact('2024-01-01', '2024-12-31', 24e9, '10-K', 'FY', 2024, '2025-02-20'), fact('2026-04-01', '2026-06-30', 7.7e9, ...q2), fact('2026-07-01', '2026-09-30', 9.2e9, ...q3)]),
      NetIncomeLoss: usd([fact('2025-01-01', '2025-12-31', 3e9), fact('2024-01-01', '2024-12-31', 2e9, '10-K', 'FY', 2024, '2025-02-20'), fact('2026-04-01', '2026-06-30', 0.8e9, ...q2), fact('2026-07-01', '2026-09-30', 1.2e9, ...q3)]),
      StockholdersEquity: usd([fact(null, '2025-12-31', 50e9), fact(null, '2024-12-31', 45e9, '10-K', 'FY', 2024, '2025-02-20')]),
      InventoryNet: usd([fact(null, '2026-06-30', 5e9, ...q2), fact(null, '2026-09-30', 6e9, ...q3)]),
      AccountsReceivableNetCurrent: usd([fact(null, '2026-06-30', 6e9, ...q2), fact(null, '2026-09-30', 7.8e9, ...q3)]),
    } } }, 100);
  const pit = record?.pit?.observations || {};
  check('v59.70 #8 the SEC normalizer collects quarter-end inventory and receivables', SEC_NORMALIZER_VERSION === 'sec-normalizer.2026-11-04' && record?.normalizerVersion === SEC_NORMALIZER_VERSION
    && pit.inventoryQ?.map((row) => row.value).sort().join(',') === '5000000000,6000000000' && pit.receivablesQ?.length === 2 && quarterlyHistory(pit) === '2026-06-30:7700:800:r:5000:6000;2026-09-30:9200:1200:r:6000:7800', quarterlyHistory(pit));
  const concept = { revenueQ: 'Revenues', netIncomeQ: 'NetIncomeLoss', inventoryQ: 'InventoryNet', receivablesQ: 'AccountsReceivableNetCurrent' };
  const q = (start, end, value, field) => ({ field, value, periodStart: start, periodEnd: end, filedAt: '2026-11-01', form: '10-Q', concept: concept[field] });
  const observations = {
    revenueQ: [q('2026-03-29', '2026-06-27', 7.7e9, 'revenueQ'), q('2026-06-28', '2026-09-27', 9.2e9, 'revenueQ')],
    netIncomeQ: [q('2026-03-29', '2026-06-27', 0.8e9, 'netIncomeQ'), q('2026-06-28', '2026-09-27', 1.2e9, 'netIncomeQ')],
    inventoryQ: [q(null, '2026-06-27', 5.0e9, 'inventoryQ'), q(null, '2026-09-27', 6.0e9, 'inventoryQ')],
    receivablesQ: [q(null, '2026-06-27', 6.0e9, 'receivablesQ'), q(null, '2026-09-27', 7.8e9, 'receivablesQ')],
  };
  const text = quarterlyHistory(observations);
  check('v59.70 #8 the quarter projection carries inventory and receivables columns', text === '2026-06-27:7700:800:r:5000:6000;2026-09-27:9200:1200:r:6000:7800', text);
  const legacy = quarterlyHistory({ revenueQ: observations.revenueQ, netIncomeQ: observations.netIncomeQ });
  check('v59.70 #8 a record read before the balances keeps the four-column quarter row', legacy === '2026-06-27:7700:800:r;2026-09-27:9200:1200:r', legacy);
  const wc = buildWorkingCapitalRead(parseQuarterHistory(text));
  check('v59.70 #8 the working-capital read names balances growing faster than revenue', wc.available && Math.round(wc.inventory.pct) === 20 && Math.round(wc.receivables.pct) === 30
    && /재고 \+20\.0%, 매출채권 \+30\.0%\(분기 매출 \+19\.5%\)/.test(wc.headline) && /매출채권이 매출보다 빠르게 늘어/.test(wc.headline), wc.headline);
  check('v59.70 #8 not yet collected is not a reading', buildWorkingCapitalRead(parseQuarterHistory(legacy)).available === false);
}

if (failures.length) {
  console.error(`Data audit contract FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Data audit contract OK: R3 due, R4 deploy/lane, R5 status ceiling, R7 produced Fed decision, R8 one input builder, R9 breadth counter, R10 computed gates, R12 aux symbols.');
