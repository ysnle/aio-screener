import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { readProducerSource } from './lib/producer-source.mjs'; // v57.62: fetch-data.mjs + the lib modules split out of it
import { backtestFactors, classifyCboePutCallCurrentness, deriveCyclePublication, deriveFactorQuality, deriveTickerNewsLineage, writeMacroCalendar } from './fetch-data.mjs';
import { FOMC_RECHECK_MS, buildIsmRuleEvents, deriveFedPolicyRate, parseFomcCalendarHtml, selectFomcMeetings } from './lib/official-calendars.mjs';
import { factorScopesByMarket, marketOfSymbol, sessionDateInMarket, timeZoneForMarket } from '../src/domain/market/session-time.js';
import { FACTOR_FRESHNESS_MS } from '../src/domain/screener/factor-ranks.js';
import { percentileRank01, spearman } from './lib/rank-statistics.mjs';
import { SHARED_AI_MODEL, extractCompletedResponseText, requestSharedAnalysis, resolveSharedAiConfig } from './lib/ai-shared-analysis.mjs';
import { marketAnalysisDiagnostic, summarizeOperationalChecks, workflowCadence, operationalSummary } from './lib/operational-health.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

const errors = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};

// P1596: optional degradation is visible even when release-blocking gates pass.
check('P1596 warnings cannot be reported as healthy', summarizeOperationalChecks([], ['AI unavailable']).status === 'DEGRADED'
  && summarizeOperationalChecks([{ ok: false, severity: 'warning' }]).gateStatus === 'PASS'
  && summarizeOperationalChecks([{ ok: false, severity: 'error' }]).status === 'FAIL'
  && summarizeOperationalChecks([{ ok: true, severity: 'error' }]).status === 'PASS');
check('P1596 AI diagnostics retain the actual semantic failure', marketAnalysisDiagnostic({ marketAnalysis: { reason: 'metric-value-mismatch:market.vix' } }) === 'metric-value-mismatch:market.vix'
  && marketAnalysisDiagnostic({ meta: { marketAnalysisOk: true } }) === 'verified');
check('P1596 operational summary preserves nonblocking failures', operationalSummary({ status: 'DEGRADED', gateStatus: 'PASS', warnings: ['analysis-unavailable'] }).includes('analysis-unavailable')
  && /aio-operational-health/.test(read('.github/workflows/data-watchdog.yml')));
{
  const now = Date.parse('2026-10-10T12:00:00Z');
  const run = minutes => ({ head_branch: 'main', event: 'schedule', created_at: new Date(now - minutes * 60000).toISOString() });
  check('P1596 cadence detects missing slots despite a recent success', !workflowCadence([run(5), run(180)], { now, maxAgeMinutes: 65 }).ok
    && workflowCadence([run(5), run(35)], { now, maxAgeMinutes: 65 }).ok
    && !workflowCadence([run(-10)], { now, maxAgeMinutes: 65 }).ok);
}
check('P1596 external observer collects all Pages results and preserves degraded status', /const pagesPromise = Promise\.allSettled/.test(read('scripts/ci-external-pipeline-check.mjs'))
  && /summarizeOperationalChecks\(result\.checks, result\.warnings\)/.test(read('scripts/ci-external-pipeline-check.mjs')));

const completeCycle = deriveCyclePublication({ marketSnapshotPublished: true, quoteCount: 78, requiredQuoteCount: 78, newsCount: 10, historyUpdated: true });
check('cycle publication requires every declared component', completeCycle.status === 'PUBLISHED' && completeCycle.blockers.length === 0, JSON.stringify(completeCycle));
for (const [label, input, blocker] of [
  ['snapshot', { marketSnapshotPublished: false, quoteCount: 78, requiredQuoteCount: 78, newsCount: 10, historyUpdated: true }, 'market-snapshot-not-published'],
  ['quotes', { marketSnapshotPublished: true, quoteCount: 77, requiredQuoteCount: 78, newsCount: 10, historyUpdated: true }, 'quote-coverage-incomplete'],
  ['news', { marketSnapshotPublished: true, quoteCount: 78, requiredQuoteCount: 78, newsCount: 9, historyUpdated: true }, 'current-news-below-minimum'],
  ['history', { marketSnapshotPublished: true, quoteCount: 78, requiredQuoteCount: 78, newsCount: 10, historyUpdated: false }, 'history-update-incomplete']
]) {
  const cycle = deriveCyclePublication(input);
  check(`cycle publication fails closed for ${label}`, cycle.status === 'DEGRADED' && cycle.blockers.includes(blocker), JSON.stringify(cycle));
}
// P1069/R591: factor/score ties require average ranks. The no-tie d-squared
// shortcut produces a different answer for this fixture and is not acceptable
// for percentile factors or IC reporting.
const tieFixture = JSON.parse(read('architecture/fixtures/backtest-ranking-ties.json'));
const tiePercentiles = percentileRank01(tieFixture.values.percentileInput);
const tieRho = spearman(tieFixture.values.factor, tieFixture.values.outcome);
check('tie-aware percentile ranking uses midranks', tiePercentiles.every((value, index) => Math.abs(value - tieFixture.expected.percentile01[index]) < 1e-12), JSON.stringify(tiePercentiles));
check('tie-aware Spearman uses Pearson on midranks', Math.abs(tieRho - tieFixture.expected.spearmanRho) < 1e-9, String(tieRho));
const extractNodeHeredocs = (text) => {
  const blocks = [];
  const re = /node(\s+--input-type=module)? - <<'NODE'\r?\n([\s\S]*?)\r?\n\s*NODE/g;
  let match;
  while ((match = re.exec(text))) {
    blocks.push({ source: match[2].replace(/^\s{10}/gm, ''), module: Boolean(match[1]) });
  }
  return blocks;
};
const checkNodeHeredocSyntax = (label, text) => {
  const blocks = extractNodeHeredocs(text);
  check(`${label} has Node heredoc blocks`, blocks.length > 0);
  blocks.forEach((block, index) => {
    if (block.module) {
      check(`${label} Node heredoc ${index + 1} uses ESM imports, not CommonJS require`, !/\brequire\s*\(/.test(block.source), 'module heredocs must use import statements');
      const result = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: block.source, encoding: 'utf8' });
      check(`${label} Node heredoc ${index + 1} parses`, result.status === 0, (result.stderr || '').trim());
      return;
    }
    try { new Function('require', 'process', block.source); }
    catch (error) { check(`${label} Node heredoc ${index + 1} parses`, false, error.message); }
  });
};
// P584/R265/C1: extract a top-level `function NAME(...) { ... }` by brace-depth counting (not a
// regex bound) so nested control-flow braces inside the function don't truncate the extraction.
const extractFunctionSource = (text, name) => {
  const sig = `function ${name}(`;
  const start = text.indexOf(sig);
  if (start < 0) return null;
  const braceStart = text.indexOf('{', start);
  if (braceStart < 0) return null;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
};

const refresh = read('.github/workflows/refresh-data.yml');
const screenerRefresh = read('.github/workflows/refresh-screener.yml');
const mastersLane = refresh.match(/      - name: Refresh weekly SEC 13F and daily 13D-G discovery[\s\S]*?(?=\n      - name: )/)?.[0] || '';
const watchdog = read('.github/workflows/data-watchdog.yml');
const ci = read('.github/workflows/ci.yml');
const externalPipeline = read('scripts/ci-external-pipeline-check.mjs');
const qaPipeline = JSON.parse(read('architecture/qa-pipeline.json'));
const watchdogScripts = (qaPipeline.profiles?.watchdog || []).flatMap((group) => qaPipeline.groups?.[group]?.gates || []).map((gate) => gate.script);
const fetchData = readProducerSource();
{
  // Saturday 2026-10-10 12:00Z: latest completed US session is Fri 10-09, the one before is Thu 10-08.
  const now = Date.parse('2026-10-10T12:00:00Z');
  check('P1581: the Yahoo quote fallback never derives a daily change from chartPreviousClose (5-day window start)', /prev = \(typeof m\.previousClose === 'number' && m\.previousClose > 0\) \? m\.previousClose : null;/.test(fetchData) && !/prev = \(typeof m\.chartPreviousClose === 'number'/.test(fetchData));
  {
    // P1799: at the KRX open the current session's bar is missing, so the previous close is the last bar dated before
    // the session (10/15 09:01 KST KOSPI against the 10/14 close 6008.81, not the 10/13 close 6035.35).
    const { previousCloseBarIndex } = await import('./fetch-data.mjs');
    const kst = { exchangeTimezoneName: 'Asia/Seoul', gmtoffset: 32400 };
    const bar = (iso, close) => ({ timestamp: Date.parse(iso) / 1000, close });
    const krBars = [bar('2026-10-13T00:00:00Z', 6035.35), bar('2026-10-14T00:00:00Z', 6008.81)];
    const atOpen = previousCloseBarIndex(krBars, { ...kst, regularMarketTime: Date.parse('2026-10-15T00:01:20Z') / 1000 });
    const withToday = previousCloseBarIndex([...krBars, bar('2026-10-15T00:00:00Z', 5701.75)], { ...kst, regularMarketTime: Date.parse('2026-10-15T00:01:20Z') / 1000 });
    const afterClose = previousCloseBarIndex([...krBars, bar('2026-10-15T00:00:00Z', 5650)], { ...kst, regularMarketTime: Date.parse('2026-10-15T06:30:00Z') / 1000 });
    const us = previousCloseBarIndex([bar('2026-10-13T13:30:00Z', 1), bar('2026-10-14T13:30:00Z', 2)], { exchangeTimezoneName: 'America/New_York', gmtoffset: -14400, regularMarketTime: Date.parse('2026-10-14T20:00:00Z') / 1000 });
    check('P1799 Seoul-session previous close is the last bar before the current session even when today\'s bar is not printed yet',
      krBars[atOpen]?.close === 6008.81 && withToday === 1 && afterClose === 1 && us === 0,
      JSON.stringify({ atOpen, withToday, afterClose, us }));
  }
  {
    // P1587: a cover-page share count 1000x off the EPS-implied count (PKG, 2026) is withheld, never priced.
    const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
    const fy = (val, extra = {}) => ({ val, form: '10-K', fp: 'FY', fy: 2025, start: '2025-01-01', end: '2025-12-31', filed: '2026-02-25', accn: 'a', ...extra });
    const facts = (shares) => ({ facts: { 'us-gaap': { Revenues: { units: { USD: [fy(8.6e9), fy(8.4e9, { start: '2024-01-01', end: '2024-12-31', fy: 2024, accn: 'b' })] } }, NetIncomeLoss: { units: { USD: [fy(774.1e6)] } }, StockholdersEquity: { units: { USD: [{ ...fy(4.598e9), start: undefined }] } }, EarningsPerShareDiluted: { units: { 'USD/shares': [fy(8.62)] } } }, dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ val: shares, form: '10-K', fp: 'FY', end: '2026-02-20', filed: '2026-02-25', accn: 'a' }] } } } } });
    const bad = normalizeSecCompanyFacts('PKG', facts(89213394000), 229.94, null);
    const good = normalizeSecCompanyFacts('PKG', facts(89213394), 229.94, null);
    check('P1587: SEC share counts far from net income / diluted EPS are withheld before P/E and P/B',
      bad?.sharesCheck === 'scale-mismatch' && bad?.sharesOutstanding === null && bad?.pe == null && good?.sharesCheck === 'consistent' && Math.abs(good?.pe - 26.5) < 0.2,
      JSON.stringify({ bad: bad && { c: bad.sharesCheck, pe: bad.pe }, good: good && { c: good.sharesCheck, pe: good.pe } }));
    // 2026-10-14: a filer with no reported share count (class-dimensioned dei) is priced on net income / diluted EPS;
    // utility revenue concepts count as annual revenue.
    const multiClass = { facts: { 'us-gaap': { RegulatedAndUnregulatedOperatingRevenue: { units: { USD: [fy(8.6e9), fy(8.4e9, { start: '2024-01-01', end: '2024-12-31', fy: 2024, accn: 'b' })] } }, NetIncomeLoss: { units: { USD: [fy(774.1e6)] } }, EarningsPerShareDiluted: { units: { 'USD/shares': [fy(8.62)] } } } } };
    const implied = normalizeSecCompanyFacts('MULTI', multiClass, 229.94, null);
    const noEps = normalizeSecCompanyFacts('MULTI', { facts: { 'us-gaap': { ...multiClass.facts['us-gaap'], EarningsPerShareDiluted: undefined } } }, 229.94, null);
    check('v57.59 SEC share count falls back to net income / diluted EPS only when no reported count exists; utility revenue is annual revenue',
      implied?.sharesBasis === 'eps-implied' && Math.abs(implied?.sharesOutstanding - 774.1e6 / 8.62) < 1 && Math.abs(implied?.pe - 26.7) < 0.2
        && implied?.revenue === 8.6e9 && noEps?.sharesOutstanding == null && bad?.sharesBasis == null,
      JSON.stringify({ implied: implied && { b: implied.sharesBasis, s: implied.sharesOutstanding, pe: implied.pe, r: implied.revenue }, noEps: noEps && noEps.sharesOutstanding }));
    // v57.66 P1798: class-dimensioned 10-K instance facts (shapes of the V, WMG, COKE and BRK FY2025 filings).
    const { parseClassShareFacts, selectClassDimensionedShares, classInstanceUrl } = await import('./fetch-sec-fundamentals.mjs');
    const instance = (symbols, classes) => {
      const ctx = (id, member, period) => `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier scheme="http://www.sec.gov/CIK">1</xbrli:identifier>${member ? `<xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementClassOfStockAxis">us-gaap:${member}</xbrldi:explicitMember></xbrli:segment>` : ''}</xbrli:entity><xbrli:period>${period}</xbrli:period></xbrli:context>`;
      const fyPeriod = '<xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate>';
      const parts = ['<xbrli:xbrl>', ctx('noise', null, fyPeriod)];
      symbols.forEach(([symbol, member], i) => parts.push(ctx(`s${i}`, member, fyPeriod), `<dei:TradingSymbol contextRef="s${i}">${symbol}</dei:TradingSymbol>`));
      classes.forEach(([member, eps, count], i) => parts.push(ctx(`c${i}`, member, fyPeriod),
        `<us-gaap:EarningsPerShareDiluted contextRef="c${i}" unitRef="usdPerShare" decimals="2">${eps}</us-gaap:EarningsPerShareDiluted>`,
        `<us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding contextRef="c${i}" unitRef="shares" decimals="-6">${count}</us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding>`));
      // A second dimension (equity component) is never read as a class fact.
      parts.push('<xbrli:context id="two"><xbrli:entity><xbrli:segment><xbrldi:explicitMember dimension="us-gaap:StatementClassOfStockAxis">us-gaap:CommonClassAMember</xbrldi:explicitMember><xbrldi:explicitMember dimension="us-gaap:StatementEquityComponentsAxis">us-gaap:RetainedEarningsMember</xbrldi:explicitMember></xbrli:segment></xbrli:entity><xbrli:period>' + fyPeriod + '</xbrli:period></xbrli:context>',
        '<us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding contextRef="two" unitRef="shares">1</us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding>', '</xbrli:xbrl>');
      return parseClassShareFacts(parts.join('\n'));
    };
    const visa = selectClassDimensionedShares(instance([['V', 'CommonClassAMember'], ['V26', 'A2026NotesMember']], [['CommonClassAMember', 10.20, 1966000000], ['CommonClassB1Member', 15.95, 5000000], ['CommonClassCMember', 40.82, 9000000]]), 'V', 20058e6, '2025-12-31');
    const wmg = selectClassDimensionedShares(instance([['WMG', null]], [['CommonClassAMember', 0.69, 145128000], ['CommonClassBMember', 0.69, 375380000]]), 'WMG', 365e6, '2025-12-31');
    const coke = selectClassDimensionedShares(instance([['COKE', null]], [['CommonClassUndefinedMember', 6.81, 83807000], ['CommonClassBMember', 6.76, 10149000]]), 'COKE', 570582000, '2025-12-31');
    const brk = selectClassDimensionedShares(instance([['BRK.A', 'CommonClassAMember'], ['BRK.B', 'CommonClassBMember']], [['EquivalentClassAMember', 46563, 1438223], ['EquivalentClassBMember', 31.04, 2157335139]]), 'BRK-B', 66968e6, '2025-12-31');
    const differ = selectClassDimensionedShares(instance([], [['CommonClassAMember', 10.20, 1966000000], ['CommonClassCMember', 40.82, 9000000]]), 'X', 20058e6, '2025-12-31');
    const multiClassFacts = { facts: { 'us-gaap': { Revenues: multiClass.facts['us-gaap'].RegulatedAndUnregulatedOperatingRevenue, NetIncomeLoss: { units: { USD: [fy(365e6)] } } } } };
    const submissions = { filings: { recent: { accessionNumber: ['a'], primaryDocument: ['wmg-20251231.htm'], acceptanceDateTime: [null] } } };
    const priced = normalizeSecCompanyFacts('WMG', multiClassFacts, 30, submissions, instance([['WMG', null]], [['CommonClassAMember', 0.69, 145128000], ['CommonClassBMember', 0.69, 375380000]]));
    const withheld = normalizeSecCompanyFacts('BRK-B', multiClassFacts, 30, submissions, instance([['BRK.B', 'CommonClassBMember']], [['EquivalentClassBMember', 31.04, 2157335139]]));
    const secSource = read('scripts/fetch-sec-fundamentals.mjs');
    check('v57.66 P1798: multi-class 10-K counts price the traded class or the same-EPS class sum, never a double count or an unmatched class',
      visa.value === 1966000000 && visa.method === 'traded-class' && wmg.value === 520508000 && wmg.method === 'class-sum'
        && coke.value === 83807000 && brk.value == null && brk.reason === 'class-member-unmatched' && differ.value == null
        && priced?.sharesBasis === 'class-dimensioned-10k' && priced?.sharesCheck === 'consistent' && priced?.sharesClassMethod === 'class-sum' && Math.abs(priced?.pe - 30 * 520508000 / 365e6) < 0.01
        && withheld?.sharesOutstanding == null && withheld?.sharesClassCheck === 'class-member-unmatched' && withheld?.pe == null
        && classInstanceUrl('0001319161', '0001319161-25-000034', { filings: { recent: { accessionNumber: ['0001319161-25-000034'], primaryDocument: ['wmg-20250930.htm'] } } }) === 'https://www.sec.gov/Archives/edgar/data/1319161/000131916125000034/wmg-20250930_htm.xml'
        && /Number\(b\.sharesMissing\) - Number\(a\.sharesMissing\)/.test(secSource) && /classInstanceUrl\(meta\.cik, normalized\.accession, submissions\)/.test(secSource),
      JSON.stringify({ visa, wmg, coke, brk, differ, priced: priced && { b: priced.sharesBasis, s: priced.sharesOutstanding, pe: priced.pe }, withheld: withheld && withheld.sharesClassCheck }));
  }
  {
    // 2026-10-14: the BLS cache is bypassed on a scheduled CPI/NFP date from 12:35Z when it was filled before 13:35Z.
    const { blsReleaseCacheBypass, fetchBlsSeries } = await import('./fetch-data.mjs');
    const schedules = { 'us-cpi': ['2026-10-14'], 'us-nfp': ['2026-11-06'], 'us-pce': ['2026-10-15'] };
    const at = (iso) => Date.parse(iso);
    const cached = await fetchBlsSeries({ fetchedAt: '2026-10-15T09:00:00Z', series: {} }, { releaseSchedules: schedules, nowMs: at('2026-10-15T13:00:00Z') });
    check('v57.59 BLS cache bypass only on a scheduled CPI/NFP date after 12:35Z for a cache filled before 13:35Z',
      blsReleaseCacheBypass(at('2026-10-14T08:00:00Z'), at('2026-10-14T12:40:00Z'), schedules)
        && blsReleaseCacheBypass(at('2026-11-06T13:00:00Z'), at('2026-11-06T13:40:00Z'), schedules)
        && !blsReleaseCacheBypass(at('2026-10-14T08:00:00Z'), at('2026-10-14T12:30:00Z'), schedules)
        && !blsReleaseCacheBypass(at('2026-10-14T13:36:00Z'), at('2026-10-14T14:00:00Z'), schedules)
        && !blsReleaseCacheBypass(at('2026-10-15T08:00:00Z'), at('2026-10-15T13:00:00Z'), schedules)
        && !blsReleaseCacheBypass(at('2026-10-14T08:00:00Z'), at('2026-10-14T12:40:00Z'), null)
        && cached.cacheHit === true,
      JSON.stringify({ cached: cached.status }));
  }
  check('P1576: an in-session quote without a previous close is never written to history as a completed close', /bySym\[q\.symbol\] = usePreviousClose \? previousClose : \(isOpenPoint \|\| preOpenPrint\) \? null : q\.regularMarketPrice;/.test(fetchData));
  check('P1573: Cboe put/call is current only within one session of the latest completed close',
    classifyCboePutCallCurrentness('2026-10-09', now) === 'current-reference'
      && classifyCboePutCallCurrentness('2026-10-08', now) === 'current-reference'
      && classifyCboePutCallCurrentness('2026-10-07', now) === 'stale-reference'
      && classifyCboePutCallCurrentness(null, now) === 'stale-reference');
}
{
  const beaCatch = fetchData.slice(fetchData.indexOf('async function fetchBeaPce('), fetchData.indexOf('async function fetchBeaPce(') + 1600);
  check('P1572: a failed BEA PCE fetch spreads the carried row before its failure status, so stale values are never republished as ok',
    beaCatch.indexOf('...(previous') > 0 && beaCatch.indexOf('...(previous') < beaCatch.indexOf("status: previous && previous.values ? 'last-known-good' : 'unavailable'"));
}
const fetchTelegram = read('scripts/fetch-telegram-digest.mjs');
const reconciliationBuilder = read('scripts/build-reconciliation-status.mjs');
const core = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
const data = read('js/aio-data.js');
const chat = read('js/aio-chat.js');
const tests = read('js/aio-tests.js');
const screenerPage = read('src/ui/pages/screener.js');
const screenerProvider = read('src/data/providers/screener.js');
const newsPage = read('src/ui/pages/news.js');
const marketPage = read('src/ui/pages/market.js');
const html = read('index.html');
// P1133/R620: page-level renderers extracted from index.html's inline block D live in js/aio-pages.js.
const pagesSource = read('js/aio-pages.js');
// v57.54: the P517/P531/P535 + R222/R230/R232 ledger prose-marker check moved to architecture/governance-markers.json
// (policy "data-pipeline-contract"); this gate no longer reads QA-CHECKLIST/RULES/BUG-POSTMORTEM.
const marketNewsStart = html.indexOf('id="page-market-news"');
const marketNewsEnd = marketNewsStart >= 0 ? html.indexOf('<!-- ═══════════════ PAGE:', marketNewsStart + 1) : -1;
const marketNewsHtml = marketNewsStart >= 0 ? html.slice(marketNewsStart, marketNewsEnd > marketNewsStart ? marketNewsEnd : marketNewsStart + 9000) : '';
const newsEmptyStart = data.indexOf('현재 조건에서');
const newsEmptyBlock = newsEmptyStart >= 0 ? data.slice(newsEmptyStart, newsEmptyStart + 1400) : '';

// P1273: exercise the home renderer with a ranked headline that has no article body.
// Discovery rank may select a card; translation, impact text and sentiment remain withheld.
const homeNewsStart = data.indexOf('function _aioHomeNewsHeadlineOnly(');
const homeNewsEnd = data.indexOf('\n/* ── renderBriefingFeed()', homeNewsStart);
let homeHeadlineBoundary = false;
let homeArticleSummaryPreserved = false;
let homeNewsFixtureError = '';
if (homeNewsStart >= 0 && homeNewsEnd > homeNewsStart) {
  const source = data.slice(homeNewsStart, homeNewsEnd);
  const renderFixture = (item) => {
    const host = { innerHTML: '' };
    const calls = { sentiment: 0, summary: 0, translatedTitle: 0, tickers: 0, translateRequested: 0 };
    const sandbox = {
      window: { AIO: { buildNewsSurfaceModel: () => ({ items: [item] }) } },
      document: { getElementById: (id) => id === 'home-news-highlights' ? host : null },
      escHtml: (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
      escUrl: (value) => String(value || ''),
      getSentimentFromText: () => { calls.sentiment++; return 'bull'; },
      getDisplayTitle: () => { calls.translatedTitle++; return '근거 없는 번역 제목'; },
      getDisplaySummary: () => { calls.summary++; return '확인되지 않은 시장 영향과 수혜 해석'; },
      getDisplayTickers: () => { calls.tickers++; return ['$FAKE']; },
      getTimeAgo: () => '방금',
      // v57.54: the model path must request a real translation for uncached cards (P554 trigger).
      _tcHas: () => false, _translationInProgress: false,
      autoTranslateNews: (items) => { calls.translateRequested += items.length; return Promise.resolve(); }
    };
    runInNewContext(`${source}\nrenderHomeFeed([]);`, sandbox, { timeout: 2000 });
    return { html: host.innerHTML, calls };
  };
  try {
    const headline = renderFixture({ title: 'Original wire headline', link: 'https://example.com/article', score: 62, topic: 'semi', source: 'Reuters', contentDepth: 'headline-only', pubDate: '2026-09-25T20:00:00Z' });
    const translated = renderFixture({ title: 'Original wire headline', ko_title: '한국어 번역 제목', link: 'https://example.com/article', score: 62, topic: 'semi', source: 'Reuters', contentDepth: 'headline-only', pubDate: '2026-09-25T20:00:00Z' });
    homeHeadlineBoundary = headline.html.includes('Original wire headline')
      && headline.html.includes('href="https://example.com/article"')
      // P1380: developer rank/verification notes are not user content; source and time remain.
      && !headline.html.includes('헤드라인 전용·본문 미검증') && !headline.html.includes('선별 점수')
      && headline.html.includes('Reuters · 방금')
      && translated.html.includes('한국어 번역 제목') && !translated.html.includes('근거 없는 번역 제목')
      && !headline.html.includes('근거 없는 번역 제목')
      && !headline.html.includes('확인되지 않은 시장 영향과 수혜 해석')
      && !headline.html.includes('$FAKE')
      && headline.calls.sentiment === 0 && headline.calls.summary === 0 && headline.calls.translatedTitle === 0 && headline.calls.tickers === 0
      && headline.calls.translateRequested === 1;
    const article = renderFixture({ title: 'Article with an excerpt', desc: 'This independently reviewed excerpt is longer than forty characters and supplies article-level context.', link: 'https://example.com/full', score: 75, topic: 'macro', source: 'Reuters', contentDepth: 'summary', pubDate: '2026-09-25T20:00:00Z' });
    homeArticleSummaryPreserved = article.html.includes('확인되지 않은 시장 영향과 수혜 해석')
      && !article.html.includes('헤드라인 전용·본문 미검증')
      && article.calls.summary === 1;
  } catch (error) {
    homeNewsFixtureError = error.message;
  }
}
check('P1273 home headline-only card withholds interpretation while exposing original article and rank meaning', homeHeadlineBoundary, homeNewsFixtureError);
check('P1273 home full-article card retains its summary path', homeArticleSummaryPreserved, homeNewsFixtureError);

check('refresh workflow runs twice hourly', /cron:\s*'17,47 \* \* \* \*'/.test(refresh));
check('P1309/R654/QA-DATA-51 daily 13D/G poll runs ownership-only while filing-season Monday, unconnected HR/HR-A, and manual runs can invoke the full 13F chain',
  /cron:\s*'33 7 \* \* \*'/.test(refresh)
    && /steps\.daily-lane\.outputs\.due == 'true'/.test(mastersLane)
    && /MASTERS_MODE.*operator/.test(mastersLane)
    && /collect-13f-discovery\.mjs --ownership-only/.test(mastersLane)
    && /pending_13f_hr.*-gt 0/.test(mastersLane)
    && /in_filing_season.*true/.test(mastersLane)
    && /date -u \+%u/.test(mastersLane)
    && /run_full_13f\(\)\s*\{[\s\S]*collect-13f-discovery\.mjs[\s\S]*collect-13f-reference\.mjs[\s\S]*collect-13f-history-rows\.mjs[\s\S]*build-masters-runtime-artifacts\.mjs/.test(mastersLane)
    && /else[\s\S]*run_full_13f/.test(mastersLane)
    && /ci-13f-currentness-check\.mjs/.test(mastersLane)
    && /ci-masters-contract-check\.mjs/.test(mastersLane)
    && /steps\.masters\.outcome == 'success' \|\| steps\.masters\.outcome == 'skipped'/.test(refresh));
check('P1309/R654/QA-DATA-51 candidate and exact-SHA CI handoff remain after the weekly/daily SEC lanes',
  refresh.indexOf('Refresh weekly SEC 13F and daily 13D-G discovery') < refresh.indexOf('verify-refresh-candidate.mjs --record')
    && refresh.indexOf('verify-refresh-candidate.mjs --record') < refresh.indexOf('Commit refreshed public data if changed')
    && /node scripts\/verify-refresh-candidate\.mjs --expect-commit/.test(refresh)
    && /final_sha="\$\(git rev-parse HEAD\)"/.test(refresh)
    && /release_sha="\$final_sha"/.test(refresh));
check('refresh workflow has write permission and no cancel-in-progress', /contents:\s*write/.test(refresh) && /cancel-in-progress:\s*false/.test(refresh));
check('P1421 refresh workflow fetches market data with official optional secrets and shared AI budget', /node scripts\/fetch-data\.mjs/.test(refresh) && /FRED_API_KEY/.test(refresh) && !/FMP_API_KEY/.test(refresh) && /AIO_AUTOMATION_TOKEN/.test(refresh) && /AI_PROXY_URL/.test(refresh) && !/OPENAI_API_KEY|ANTHROPIC_API_KEY/.test(refresh));
{
  const env = { AI_PROXY_URL: 'https://fixture.workers.dev', AIO_AUTOMATION_TOKEN: 'fixture-only-automation-token-32-characters', GITHUB_RUN_ID: '42' };
  const complete = { model: SHARED_AI_MODEL, status: 'completed', output: [
    { type: 'reasoning', summary: [] },
    { type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '검증된 시장 요약' }] },
  ] };
  check('P1421 Actions rejects missing automation credentials and unsafe Worker URLs',
    !resolveSharedAiConfig({ ...env, AIO_AUTOMATION_TOKEN: 'short' })
    && !resolveSharedAiConfig({ ...env, AI_PROXY_URL: 'http://fixture.workers.dev' })
    && !resolveSharedAiConfig({ ...env, AI_PROXY_URL: 'https://token@fixture.workers.dev' }));
  check('P1421 Responses extraction accepts completed Luna alias and snapshot text, rejects incomplete and refusal',
    extractCompletedResponseText(complete) === '검증된 시장 요약'
    && extractCompletedResponseText({ ...complete, model: 'gpt-6-luna-2026-09-22' }) === '검증된 시장 요약'
    && !extractCompletedResponseText({ ...complete, status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } })
    && !extractCompletedResponseText({ ...complete, model: 'other-provider' })
    && !extractCompletedResponseText({ ...complete, output: [{ type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'refusal', refusal: '拒否' }] }] }));
  const requests = [];
  const fetchImpl = async (url, options) => { requests.push({ url, options }); return new Response(JSON.stringify(complete), { status: 200 }); };
  const first = await requestSharedAnalysis('fixture', { env, fetchImpl });
  const second = await requestSharedAnalysis('fixture', { env, fetchImpl });
  const requestBody = JSON.parse(requests[0].options.body);
  check('P1421 Actions AI always uses shared budget and fresh reservations without provider key or paid tools',
    first.text === '검증된 시장 요약' && second.text === first.text
    && requests.every(row => row.url === 'https://fixture.workers.dev/openai' && row.options.redirect === 'error'
      && row.options.headers['X-AIO-Automation-Token'] === env.AIO_AUTOMATION_TOKEN && !row.options.headers.Origin)
    && requests[0].options.headers['X-AIO-Idempotency-Key'] !== requests[1].options.headers['X-AIO-Idempotency-Key']
    && requestBody.model === SHARED_AI_MODEL && requestBody.max_output_tokens === 1500
    && requestBody.store === false && requestBody.reasoning.effort === 'none' && !requestBody.tools
    && !/api\.anthropic\.com|api\.openai\.com|ANTHROPIC_API_KEY|OPENAI_API_KEY/.test(fetchData));
  const limited = await requestSharedAnalysis('fixture', { env, fetchImpl: async () => new Response('{}', { status: 429 }) });
  check('P1421 monthly quota exhaustion fails closed without direct provider retry', limited.text === null && limited.reason === 'provider-http-429');
}
check('refresh workflow fetches Telegram digest artifact', /node scripts\/fetch-telegram-digest\.mjs --days=(?:7|14) --out=public-data\/telegram-digest\.json/.test(refresh));
check('P1204 core refresh workflow stages core public-data artifacts and validates the Git index', /(?:git add -- )?public-data\/data\.json public-data\/history\.json/.test(refresh) && /stage_if_exists public-data\/telegram-digest\.json/.test(refresh) && /stage_if_exists public-data\/score-backtest-history\.json/.test(refresh) && /stage_if_exists public-data\/masters\/index\.json/.test(refresh) && /node scripts\/ci-masters-contract-check\.mjs --staged/.test(refresh));
check('Telegram producer atomically synchronizes and stages Atlas lineage', /atlasIndex\.telegramObservedLineage\s*=\s*lineageCount/.test(fetchTelegram) && /public-data\/atlas\/index\.json/.test(refresh));
// The property is "an independent six-hourly validated publish job", not "fires at :23".
// Hardcoding the minute made a deliberate schedule offset (v56 moved it off data-watchdog's
// crowded :23) look like a contract violation.
check('screener refresh is an independent six-hour validated publish job', /cron:\s*'\d{1,2} \*\/6 \* \* \*'/.test(screenerRefresh) && /SCREENER_ONLY:\s*'1'/.test(screenerRefresh) && /SCREENER_ENRICH:\s*'1'/.test(screenerRefresh) && /validate-screener-artifact\.mjs/.test(screenerRefresh));
check('screener producer never promotes filing-only records into the factor row map', /if \(!data\[sym\]\) continue;/.test(fetchData) && !/else data\[sym\] = fmpResult\.data\[sym\]/.test(fetchData));
check('screener workflow default automation uses only free SEC path', /fetch-sec-fundamentals\.mjs/.test(screenerRefresh) && /SEC_USER_AGENT/.test(screenerRefresh) && /sec-fundamentals\.json/.test(screenerRefresh) && !/FMP_API_KEY/.test(screenerRefresh));
check('trading-score backtest harness is wired into the refresh pipeline', /runBacktest as runTradingScoreBacktest/.test(readProducerSource()) && exists('scripts/backtest-trading-score.mjs'));
check('refresh workflow publishes status summary', /GITHUB_STEP_SUMMARY/.test(refresh) && /fearGreedOk/.test(refresh) && /fredFetchOk/.test(refresh) && /marketAnalysisOk/.test(refresh));
check('refresh summary exposes automated AAII relay and same-date Treasury producer states', /AAII weekly/.test(refresh) && /aaiiRelayUsed/.test(refresh) && /Treasury curve/.test(refresh) && /treasuryObservedAt/.test(refresh));
// The producer runs the whole CI data QA group (which contains ci-reconciliation-contract-check.mjs) before commit.
const dataGroupGates = JSON.parse(readFileSync(new URL('../architecture/qa-pipeline.json', import.meta.url), 'utf8'))?.groups?.data?.gates || [];
const reconciliationGateAt = refresh.indexOf('qa-runner.mjs --group data');
check('P1751 core refresh validates evidence-derived reconciliation before commit', reconciliationGateAt >= 0
  && dataGroupGates.some((gate) => gate.script === 'scripts/ci-reconciliation-contract-check.mjs')
  && reconciliationGateAt < refresh.indexOf('Commit refreshed public data if changed'));
check('screener refresh atomically rebuilds and commits reconciliation and operations status', /build-reconciliation-status\.mjs/.test(screenerRefresh) && /build-operations-status\.mjs/.test(screenerRefresh) && /public-data\/reconciliation-status\.json/.test(screenerRefresh) && /public-data\/operations-status\.json/.test(screenerRefresh));
check('both refresh workflows keep generated workspace state outside data promotion while committing readiness artifacts', [refresh, screenerRefresh].every((workflow) => !/generate-workspace-state\.mjs --write/.test(workflow)
  && !/git add[^\n]*_context\/(?:CURRENT-STATE|CONTEXT-CATALOG)/.test(workflow)
  && /Fail-closed promotion candidate gate before push/.test(workflow)
  && /architecture\/public-readiness\.json/.test(workflow)));
check('refresh workflow module summary uses ESM fs import', /node --input-type=module - <<'NODE'[\s\S]*import fs from 'node:fs';/.test(refresh) && !/node --input-type=module - <<'NODE'[\s\S]*const fs = require\(/.test(refresh));
checkNodeHeredocSyntax('refresh-data workflow', refresh);

check('watchdog runs the aggregate local+external profile', /qa-runner\.mjs watchdog --no-cache/.test(watchdog) && ['watchdog-local', 'external'].every((group) => qaPipeline.profiles?.watchdog?.includes(group)));
check('watchdog checks data and Telegram freshness', /pages-data-freshness/.test(externalPipeline) && /pages-telegram-freshness/.test(externalPipeline));
check('watchdog checks live Telegram channel coverage', /pages-telegram-coverage/.test(externalPipeline) && /lastPostId/.test(externalPipeline));
check('watchdog freshness threshold tolerates transient Actions lag', /default:\s*'360'/.test(watchdog) && /AIO_LIVE_MAX_AGE_MIN:/.test(watchdog));
check('watchdog has core quality floors for public data', /symbolsOk\)\s*>=\s*70/.test(externalPipeline) && /newsCount\)\s*>=\s*10/.test(externalPipeline) && /telegram\?\.count\)\s*>=\s*100/.test(externalPipeline));
check('watchdog reports optional degraded services', /fearGreedOk/.test(externalPipeline) && /fredFetchOk/.test(externalPipeline) && /marketAnalysisOk/.test(externalPipeline));
check('watchdog checks screener artifact health', /pages-screener-freshness/.test(externalPipeline) && /48 \* 60/.test(externalPipeline));
check('watchdog retains local data contracts', ['scripts/ci-market-snapshot-contract-check.mjs', 'scripts/ci-operations-status-check.mjs', 'scripts/ci-reconciliation-contract-check.mjs', 'scripts/ci-data-refresh-audit.mjs'].every((script) => watchdogScripts.includes(script)));

check('fetch-data writes data/history/screener artifacts', /public-data\/data\.json/.test(fetchData) && /public-data\/history\.json/.test(fetchData) && /public-data\/screener\.json/.test(fetchData));
check('fetch-data collects quotes, F&G, FRED, news, LLM analysis', /fetchQuote/.test(fetchData) && /fetchFearGreed/.test(fetchData) && /fetchFred/.test(fetchData) && /fetchNews/.test(fetchData) && /genMarketAnalysis/.test(fetchData));
check('fetch-data retries RSS and broadens provider window before canonical cycle filtering', /_fetchRssWithRetry/.test(fetchData) && /when%3A7d/.test(fetchData) && /ts >= cycle\.startMs/.test(fetchData) && /ts < cycle\.endMs/.test(fetchData));
check('fetch-data separates FRED configured vs fetched', /fredHasKey/.test(fetchData) && /fredFetchOk/.test(fetchData) && /macroKeyCount/.test(fetchData));
check('fetch-data exposes marketAnalysisOk', /marketAnalysisOk/.test(fetchData));
check('market analysis keeps value/scale fabrication blocking while identity proximity only warns',
  /buildMarketAnalysisEvidence/.test(fetchData) && /metricEvidence/.test(fetchData)
    && /warnings\.push\('metric-identity-proximity:vix-vs-fear-greed'\)/.test(fetchData)
    && !/issues\.push\('metric-identity-mismatch:vix-vs-fear-greed'\)/.test(fetchData)
    && /metric-value-mismatch/.test(fetchData) && /nfp-scale-mismatch/.test(fetchData));
check('market analysis is structured, evidence-bound, and fail-closed with a typed fallback', /schemaVersion:\s*'market-analysis\.v2'/.test(fetchData) && /claims/.test(fetchData) && /evidenceIds/.test(fetchData) && /buildMarketAnalysisFallback/.test(fetchData) && /marketAnalysisOk\s*=\s*marketAnalysis\.status === 'verified'/.test(fetchData));
check('market analysis news selection uses independent clusters instead of a blind first-N slice', /buildMarketAnalysisNewsEvidence/.test(fetchData) && /independenceKey/.test(fetchData) && /clusters/.test(fetchData) && !/data\.news\)\.slice\(0, 8\)/.test(fetchData));
check('news artifacts expose source tier, content depth, event time, and independence lineage', /sourceTierLabel/.test(fetchData) && /contentDepth:\s*'headline-only'/.test(fetchData) && /eventTime:/.test(fetchData) && /independenceKey:/.test(fetchData));
check('market-analysis news evidence excludes headline-only rows and requires article content', /isMarketAnalysisNewsEligible/.test(fetchData) && /MARKET_ANALYSIS_NEWS_HEADLINE_DEPTHS/.test(fetchData) && /body\.length\s*>=\s*40/.test(fetchData) && /causalEvidence\s*=\s*buildMarketAnalysisNewsEvidence\(data\)/.test(fetchData));
check('server Treasury curve bridge projects every dated maturity to browser consumers', /AIO_SERVER_TREASURY_FIELDS/.test(data) && ['dgs2', 'dgs5', 'dgs10', 'dgs20', 'dgs30', 't10y2y'].every((field) => new RegExp(`field:\\s*'${field}'`).test(data)) && /window\._fredData\s*=\s*fred/.test(data) && /DATA_SNAPSHOT\[snapshotKey\]/.test(data) && /globalThis\[definition\.runtimeKey\]/.test(data) && /window\._live5Y/.test(data) && /window\._live20Y/.test(data) && /tnx20y/.test(data) && /treasuryProjectedFields/.test(data));
check('CPI contract keeps BLS NSA market-standard and SA analytical series explicitly separate', /CUUR0000SA0/.test(fetchData) && /CUSR0000SA0/.test(fetchData) && /seasonalAdjustment:\s*'NSA'/.test(fetchData) && /seasonalAdjustment:\s*'SA'/.test(fetchData) && /blsCpiSaYoY/.test(fetchData) && /blsCoreCpiSaYoY/.test(fetchData) && /CPIAUCNS/.test(fetchData) && /expectedAdjustment/.test(fetchData) && /_canonicalCpiDefinitionBlocked/.test(data));
check('screener validator exposes mixed revision and fundamental field lineage gates', /mixedRevision/.test(read('scripts/validate-screener-artifact.mjs')) && /fundamental rows require source\/model\/observedAt lineage/.test(read('scripts/validate-screener-artifact.mjs')) && /fieldCoverage/.test(read('scripts/validate-screener-artifact.mjs')));
check('fetch-data ranks backstop news by market-impact score', /scoreServerNewsItem/.test(fetchData) && /SERVER_NEWS_PRIORITY_RULES/.test(fetchData) && /selectionReason/.test(fetchData) && /serverNewsScored/.test(fetchData) && /newsScoreMax/.test(fetchData));
check('fetch-data has first-class credit/funding news backstop', /Google News - Credit\/Funding/.test(fetchData) && /topic:\s*'credit'/.test(fetchData) && /credit-funding/.test(fetchData) && /capex funding/.test(fetchData) && /data center financing/.test(fetchData));
check('fetch-data ranks news by actual article source tier, not Google feed tier', /getServerNewsSourceTier/.test(fetchData) && /SERVER_NEWS_LOW_QUALITY_SOURCE_RE/.test(fetchData) && /source-tier/.test(fetchData) && /low-quality-source-8/.test(fetchData) && /feedTier/.test(fetchData));
check('telegram classifier routes credit and capex funding risk', /add\('credit'\)/.test(fetchTelegram) && /lqd|LQD/.test(fetchTelegram) && /project finance|프로젝트/.test(fetchTelegram) && /capex funding|자금조달/.test(fetchTelegram));
check('P1373 fetch-data queries the Korean edition in Korean and reserves fxbond/credit floors', /코스피 OR 코스닥 OR 삼성전자 OR SK하이닉스/.test(fetchData) && /[['fxbond', 3], ['credit', 2]]/.test(fetchData));
check('fetch-data enforces KST 08:00 completed 24h news cycle', /NEWS_CYCLE_POLICY\s*=\s*'kst-0800-completed-24h'/.test(fetchData) && /getKst0800NewsCycle/.test(fetchData) && /newsCycleStart/.test(fetchData) && /newsCycleEnd/.test(fetchData) && /newsCycleLabel/.test(fetchData));
check('BEA PCE adapter is keyless official-primary evidence with observation/release/fetch separation', /parseBeaPceHtml/.test(fetchData) && /fetchBeaPce/.test(fetchData) && /www\.bea\.gov\/news\/current-releases/.test(fetchData) && /bea-official-primary/.test(fetchData) && /nextReleaseAt/.test(fetchData));
check('history stores completed closes and carries the shared market-cut revision', /completed-market-cut/.test(fetchData) && /previous-completed-close/.test(fetchData) && /deriveMarketSession/.test(fetchData) && /marketSnapshotRevision/.test(fetchData));
check('failed market publication keeps attempt and LKG snapshot lineage separate', /marketSnapshotAttemptRevision/.test(fetchData) && /marketSnapshotPublishedAt/.test(fetchData) && /marketSnapshotLastSuccessfulAt/.test(fetchData) && /MARKET_SNAPSHOT_OUT/.test(fetchData) && /marketSnapshotInfo\.retainedRevision/.test(fetchData) && /marketSnapshotForConsumers/.test(fetchData));
check('screener Kalman factor uses comparable log percent scale', /Math\.log\(v\)/.test(fetchData) && /Math\.expm1\(s1\)\s*\*\s*100/.test(fetchData) && /scale:\s*'log_pct_day'/.test(fetchData) && /kalmanScale/.test(fetchData) && /kalmanScale:\s*'log_pct_day'/.test(fetchData));
check('screener pipeline emits timestamped universe breadth and a research-only ranking contract', /computeScreenerBreadth/.test(fetchData) && /factorObservedAt/.test(fetchData) && /coveragePct/.test(fetchData) && /rankingContract/.test(fetchData) && /research-relative-ranking-only/.test(fetchData));
check('fetch-data preserves the last-known-good artifact on core quote outage', /CORE_QUOTE_COVERAGE_FAILED/.test(fetchData) && fetchData.indexOf('CORE_QUOTE_COVERAGE_FAILED') < fetchData.indexOf('await atomicWriteFile(OUT'));
check('22-category reconciliation is computed from executable artifact checks, not a static status table', /buildReconciliationStatus/.test(reconciliationBuilder) && /evidenceCheck/.test(reconciliationBuilder) && /runtimeBlockedCategories/.test(reconciliationBuilder) && /policyBlockedCategories/.test(reconciliationBuilder) && !/const CATEGORY_STATUS/.test(reconciliationBuilder));
check('browser reloads reconciliation with data polling and rejects market revision drift', /reconciliation-status\.json\?t=/.test(data) && /reconciliation-status-v2/.test(data) && /sourceRevisionMatches/.test(data) && /market snapshot revision mismatch/.test(data) && /getDataReconciliationStatus/.test(data));
check('all market-sensitive pages share one category-to-epoch contract', /PAGE_MARKET_EPOCH_CONTRACT/.test(core) && /getPageMarketEpochState/.test(core) && /applyPageMarketEpoch/.test(core) && /getPageMarketEpochAudit/.test(core));
check('page evidence is fail-closed by shared market epoch and revision state', /market-epoch-blocked/.test(core) && /market-epoch-partial/.test(core) && /data-market-revision/.test(core) && /data-market-cut-end/.test(core) && /aio:marketEpochUpdated/.test(core));
  check('server quote rows emit explicit observation/fetch/delay/session/venue/use lineage', /observedAt:\s*Number\.isFinite\(m\.regularMarketTime\)/.test(fetchData) && /fetchedAt:\s*new Date\(\)\.toISOString\(\)/.test(fetchData) && /delayedByMs:/.test(fetchData) && /marketSession:/.test(fetchData) && /venue:/.test(fetchData) && /sourceKind:\s*'T3_PUBLIC_DELAYED'/.test(fetchData) && /allowedUse:\s*'reference-only'/.test(fetchData));
check('fetch-data exposes an isolated screener-only refresh path', /SCREENER_ONLY/.test(fetchData) && /export async function enrichScreener/.test(fetchData));
  check('screener rows retain per-symbol observation/source/use lineage', /f\.observedAt\s*=\s*r\.observedAt/.test(fetchData) && /f\.sourceKind\s*=\s*'T3_PUBLIC_DELAYED'/.test(fetchData) && /f\.allowedUse\s*=\s*'research-relative-ranking-only'/.test(fetchData));
check('ticker news keeps publication and fetch timestamps separate and provider prioritizes explicit lineage', /deriveTickerNewsLineage/.test(fetchData) && /newsObservedAt\s*=\s*lineage\.newsObservedAt/.test(fetchData) && /newsFetchedAt\s*=\s*lineage\.newsFetchedAt/.test(fetchData) && !/newsTs\s*=\s*Date\.now\(\)/.test(fetchData) && /newsObservedAt:\s*newsObservedAt/.test(screenerProvider) && /newsFetchedAt:\s*newsFetchedAt/.test(screenerProvider));
check('core refresh ingests official delayed Cboe statistics without a public CORS proxy', /parseCboePutCallHtml/.test(fetchData) && /Cboe Daily Market Statistics/.test(fetchData) && /sourceKind:\s*'T3_PUBLIC_DELAYED'/.test(fetchData) && /fetchCboePutCall\(\)/.test(fetchData));
check('client applies server Cboe data first and protects it from failed legacy proxy fallback', /d\.putCall\.totalPutCall/.test(data) && /sourceLabel:\s*'Cboe Daily Market Statistics'/.test(data) && /must not overwrite a fresher official/.test(data));
check('client preserves the server shared cycle and retries a saved personal FRED key when server FRED failed', /newsCycleStart:\s*d\.meta\.newsCycleStart/.test(data) && /marketSnapshotRevision:\s*d\.meta\.marketSnapshotRevision/.test(data) && /cycleManifestRevision:\s*d\.meta\.cycleManifestRevision/.test(data) && /marketCycleFreshnessSlaHours/.test(data) && /if \(!d\.meta\.fredFetchOk\)/.test(data) && /authentication:'VERIFIED'/.test(data));
check('cold server-data projection performs a bounded full-loader replay until DATA_SNAPSHOT exists', /_snapshotBridgeWait\s*<\s*60/.test(data) && /_aioServerDataBridgeAttempts\s*<=\s*5/.test(data) && /_aioLoadServerData\(\)/.test(data) && /waiting-for-snapshot/.test(data));
check('P1518 free SEC fundamentals use bounded batches and shared atomic persistence', exists('scripts/fetch-sec-fundamentals.mjs') && /SEC_BATCH_LIMIT/.test(read('scripts/fetch-sec-fundamentals.mjs')) && /SEC_USER_AGENT/.test(read('scripts/fetch-sec-fundamentals.mjs')) && /import \{ atomicWriteFile \} from '\.\/lib\/atomic-write\.mjs'/.test(read('scripts/fetch-sec-fundamentals.mjs')) && /await atomicWriteFile\(path, JSON\.stringify\(value, null, 1\)\)/.test(read('scripts/fetch-sec-fundamentals.mjs')));
check('BLS direct adapter is keyless, bounded, cadence-gated, and merged as typed official evidence',
  /BLS_SERIES/.test(fetchData) && /api\.bls\.gov\/publicAPI\/v1\/timeseries\/data/.test(fetchData) &&
  /method:\s*'POST'/.test(fetchData) && /BLS_CACHE_MAX_AGE_MS/.test(fetchData) && /12 \* 60 \* 60 \* 1000/.test(fetchData) &&
  /M\(\?:0\[1-9\]\|1\[0-2\]\)/.test(fetchData) && /releaseAt:\s*null/.test(fetchData) &&
  /macro\._bls/.test(fetchData) && /blsStatus/.test(fetchData) && /blsLastSuccessfulAt/.test(fetchData));
check('U.S. Treasury keyless adapter supplies an official same-date five-point curve and 10Y-2Y spread',
  /parseTreasuryYieldCurveXml/.test(fetchData) && /pages\/xml\?data=daily_treasury_yield_curve/.test(fetchData) && /fetchTreasuryYieldCurve/.test(fetchData) && /home\.treasury\.gov/.test(fetchData) &&
  /us-treasury-official-primary/.test(fetchData) && /same-date-spread/.test(fetchData) && /treasuryObservedAt/.test(fetchData));
check('AAII weekly reference refresh is automated with bounded publisher-direct/reader-relay paths and remains non-decision evidence',
  /fetchAaiiSentiment/.test(fetchData) && /parseAaiiSentimentText/.test(fetchData) && /AAII_READER_URL/.test(fetchData) &&
  /publisher-public-web-via-reader-relay/.test(fetchData) && /decisionUse:\s*false/.test(fetchData) && /aaiiRelayUsed/.test(fetchData));
check('HY OAS has a keyless official FRED public-download adapter with LKG and typed lineage',
  /parseFredHyOasCsv/.test(fetchData) && /fetchFredHyOasPublic/.test(fetchData) && /fredgraph\.csv\?id=BAMLH0A0HYM2/.test(fetchData) &&
  /FRED_HY_OAS_CACHE_MAX_AGE_MS/.test(fetchData) && /fred-official-public-csv/.test(fetchData) && /fredHyOasObservedAt/.test(fetchData));
// P1419: the carry card measured "US-Japan" as US 10Y minus the Bank of KOREA rate; no Japanese yield
// is collected, so the card reports the yen's own 20-day move (the 시장 상태 FX-axis rule) and no gap.
// P1425: the rule lives in the 금리 · 환율 domain module; the legacy composite writer is deleted.
{
  const ratesFx = read('src/domain/macro/rates-fx.js');
  check('P1419 FX/bond carry reads the yen 20-day move and never a Korea-rate gap labelled US-Japan',
    /buildCloseSeries\(history, spec\.id/.test(ratesFx) && /YEN_RALLY_RULE = RULES\.fx\.yenRally20dPct/.test(ratesFx) && /yenRally20dPct: 3/.test(read('src/domain/rules/thresholds.js')) && /yenStrength >= YEN_RALLY_RULE/.test(ratesFx)
      && !/bokRate/.test(ratesFx) && !/tnx - bokRate/.test(marketPage) && !/function _aioRenderCarryUnwindRisk/.test(read('js/aio-data.js')));
}
{
  let ok = false;
  let detail = '';
  try {
    const { normalizeBlsSeriesResponse } = await import('./fetch-data.mjs');
    const monthly = (id, latest, priorMonth, priorYear = priorMonth, extra = []) => ({
      seriesID: id,
      data: [
        { year: '2026', period: 'M06', value: String(latest), footnotes: [] },
        { year: '2026', period: 'M05', value: String(priorMonth), footnotes: [] },
        { year: '2026', period: 'M13', value: '999999', footnotes: [] },
        { year: '2025', period: 'M06', value: String(priorYear), footnotes: extra }
      ]
    });
    const aheSeries = monthly('CES0500000003', 40, 39, 38);
    aheSeries.data[0].footnotes = [{ code: 'P', text: 'Preliminary' }];
    const payload = { Results: { series: [
      monthly('CUUR0000SA0', 300, 299, 285),
      monthly('CUSR0000SA0', 310, 309, 300),
      monthly('CUUR0000SA0L1E', 200, 199, 190),
      monthly('CUSR0000SA0L1E', 210, 209, 200),
      monthly('LNS14000000', 4.1, 4.0),
      monthly('LNS11300000', 62.5, 62.4),
      monthly('CES0000000001', 16000, 15900),
      aheSeries
    ] } };
    const result = normalizeBlsSeriesResponse(payload, '2026-07-15T00:00:00.000Z');
    const cpi = result.series.cpi;
    const cpiSa = result.series.cpiSa;
    const coreCpi = result.series.coreCpi;
    const coreCpiSa = result.series.coreCpiSa;
    const nfp = result.series.nonfarmPayroll;
    const ahe = result.series.averageHourlyEarnings;
    ok = result.status === 'ok' && result.values.blsCpiYoY === 5.3 && result.values.blsCpiSaYoY === 3.3 &&
      result.values.blsCoreCpiYoY === 5.3 && result.values.blsCoreCpiSaYoY === 5 && result.values.blsNfpMoM === 100 &&
      result.values.blsAverageHourlyEarningsYoY === 5.3 && cpi.unit === 'index' && cpi.releaseAt === null &&
      cpi.seasonalAdjustment === 'NSA' && cpi.displayRole === 'market-standard-headline' && cpi.definition.includes('not seasonally adjusted') &&
      cpiSa.seasonalAdjustment === 'SA' && cpiSa.displayRole === 'analytical-seasonally-adjusted' &&
      coreCpi.seasonalAdjustment === 'NSA' && coreCpiSa.seasonalAdjustment === 'SA' &&
      cpi.inputObservationPeriods.every(period => !period.endsWith('M13')) && ahe.observationStatus === 'footnote-present' &&
      nfp.unit === 'thousands' && nfp.observedAt === '2026-06-01';
    detail = JSON.stringify({ status: result.status, values: result.values, cpi, cpiSa, coreCpi, coreCpiSa, nfp });
  } catch (error) { detail = error.message; }
  check('BLS normalizer rejects M13, preserves units/observation periods, and derives YoY/MoM deterministically', ok, detail.slice(0, 1200));
}
{
  let ok = false;
  let detail = '';
  try {
    const { buildMarketAnalysisNewsEvidence, isMarketAnalysisNewsEligible, validateMarketAnalysisText, MARKET_ANALYSIS_NEWS_CONTENT_POLICY } = await import('./fetch-data.mjs');
    const base = { source: 'Reuters', link: 'https://example.test/story', eventTime: '2026-08-12T12:00:00.000Z', score: 90, independenceKey: 'reuters' };
    const headline = { ...base, title: 'Headline-only market move', contentDepth: 'headline-only', content: 'This text is deliberately ignored because the source declares headline-only.' };
    const excerpt = { ...base, title: 'Article excerpt with a documented market catalyst', link: 'https://example.test/excerpt', independenceKey: 'ap-source', contentDepth: 'EXCERPT', excerpt: 'The article explains the catalyst, the reported transmission channel, and the observed response in sufficient detail for a cautious reference.' };
    const data = { meta: { generatedAt: '2026-08-12T12:01:00.000Z' }, news: [headline, excerpt] };
    const evidence = buildMarketAnalysisNewsEvidence(data);
    const semantic = validateMarketAnalysisText('Markets moved because the documented catalyst changed risk pricing.', { ...data, macro: {} });
    ok = !isMarketAnalysisNewsEligible(headline) && isMarketAnalysisNewsEligible(excerpt) && evidence.length === 1 && evidence[0].title === excerpt.title && semantic.causalEvidenceCount === 1
      // P1119 (S9): the retained headline-only shape is a declared rights boundary, not a
      // silently unpopulated field. The policy must travel with the code that enforces it.
      && MARKET_ANALYSIS_NEWS_CONTENT_POLICY.retainedDepth === 'headline-only'
      && MARKET_ANALYSIS_NEWS_CONTENT_POLICY.excerptRetention === 'not-permitted-source-rights'
      && MARKET_ANALYSIS_NEWS_CONTENT_POLICY.causalNarrative === 'headline-attributed-with-disclosure';
    detail = JSON.stringify({ evidence, semantic, policy: MARKET_ANALYSIS_NEWS_CONTENT_POLICY });
  } catch (error) { detail = error.message; }
  check('market analysis rejects headline-only news as causal evidence while accepting a substantive excerpt', ok, detail.slice(0, 1600));
}
{
  // P1122: causal prose is no longer discarded because article bodies are never retained
  // (rights). It is published with attribution required instead — an unattributed causal
  // sentence warns; a headline-attributed one does not.
  let ok = false;
  let detail = '';
  try {
    const { validateMarketAnalysisText } = await import('./fetch-data.mjs');
    const headline = { title: '금리 우려로 지수 하락', source: 'Reuters', link: 'https://example.test/rate', eventTime: '2026-08-12T11:00:00.000Z', contentDepth: 'headline-only', score: 80 };
    const data = { meta: { generatedAt: '2026-08-12T12:01:00.000Z' }, news: [headline], macro: {} };
    // P1139/QA-EXHAUST-80: the causal detector used to be an English word list, so this fixture
    // carried an English parenthetical purely to make the branch fire at all — Korean causal prose
    // was invisible. The Korean cases below deliberately have NO English token: they fail if the
    // Korean vocabulary is removed, which is exactly the regression the gate now prevents.
    const attributed = validateMarketAnalysisText('지수는 하락했습니다. 헤드라인에 따르면 금리 우려가 배경입니다.', data);
    const unattributed = validateMarketAnalysisText('지수는 하락했습니다. 금리 우려 때문입니다.', data);
    // Control: a descriptive Korean sentence with no causal marker must stay non-causal, so the
    // Korean branch cannot be satisfied by "any Hangul text".
    const descriptive = validateMarketAnalysisText('지수는 하락했습니다. 거래량은 평이했습니다.', data);
    const attributedEn = validateMarketAnalysisText('Markets moved because the documented catalyst changed risk pricing, according to the headline.', data);
    ok = Array.isArray(attributed.warnings)
      && attributed.issues.indexOf('causal-evidence-missing') < 0
      && unattributed.issues.indexOf('causal-evidence-missing') < 0
      && attributed.warnings.indexOf('causal-attribution-missing') < 0
      && unattributed.warnings.indexOf('causal-attribution-missing') >= 0
      && attributed.headlineCount === 1
      && descriptive.warnings.indexOf('causal-attribution-missing') < 0
      && attributedEn.warnings.indexOf('causal-attribution-missing') < 0;
    detail = JSON.stringify({ attributed, unattributed, descriptive, attributedEn });
  } catch (error) { detail = error.message; }
  check('headline-only causal prose warns on missing attribution instead of blocking the narrative', ok, detail.slice(0, 1600));
}
{
  // P1372: the 2026-10-01 artifact published an English "Korean Market Analysis" whose one-liner was
  // its markdown heading and which called an intraday delayed KOSPI value a close, marked verified.
  let ok = false;
  let detail = '';
  try {
    const { validateMarketAnalysisText } = await import('./fetch-data.mjs');
    const snapshot = { quotes: [
      { instrumentId: '^KS11', evidenceId: 'market.index.kospi:t', value: 6813.15, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-01T00:13:50.000Z', session: 'DELAYED_IN_SESSION' },
      { instrumentId: '^GSPC', evidenceId: 'market.index.spx:t', value: 7651.54, unit: 'index', source: 'Yahoo chart', observedAt: '2026-09-30T20:00:00.000Z', session: 'MARKET_CLOSED' }
    ] };
    const data = { meta: { generatedAt: '2026-10-01T00:34:00.000Z' }, news: [], macro: {} };
    const english = validateMarketAnalysisText('The KOSPI is at 6,813.15 while the S&P 500 stood at 7,651.54 and volatility stays contained.', data, snapshot);
    const closedWording = validateMarketAnalysisText('KOSPI는 6,813.15로 마감했고 SPX는 7,651.54로 마감했습니다. 위험 선호는 제한적입니다.', data, snapshot);
    const intraday = validateMarketAnalysisText('KOSPI는 장중 6,813.15이고 SPX는 전일 7,651.54로 마감했습니다. 위험 선호는 제한적입니다.', data, snapshot);
    const source = readProducerSource();
    ok = english.issues.includes('language-not-korean')
      && closedWording.issues.includes('session-wording-mismatch:market.kospi')
      && !closedWording.issues.includes('session-wording-mismatch:market.spx')
      && !intraday.issues.some((issue) => issue.startsWith('session-wording-mismatch') || issue === 'language-not-korean')
      && /filter\(\(line\) => line && !\/\^#\{1,6\}\\s\/\.test\(line\)\)/.test(source)
      && /반드시 한국어로만 작성하라/.test(source);
    detail = JSON.stringify({ english: english.issues, closedWording: closedWording.issues, intraday: intraday.issues });
  } catch (error) { detail = error.message; }
  check('P1372 market analysis must be Korean, heading-free, and never call an in-session value a close', ok, detail.slice(0, 1600));
  {
    // P1585: a correct sentence that states the move before the level must pass; a wrong level must not.
    const { validateMarketAnalysisText } = await import('./fetch-data.mjs');
    const snapshot = { quotes: [
      { instrumentId: '^GSPC', evidenceId: 'market.index.spx:t', value: 7816.7, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-09T20:00:00.000Z', session: 'MARKET_CLOSED' },
      { instrumentId: '^VIX', evidenceId: 'market.vol.vix:t', value: 14.86, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-09T20:00:00.000Z', session: 'MARKET_CLOSED' }
    ] };
    const data = { meta: { generatedAt: '2026-10-09T21:00:00.000Z' }, news: [], macro: {} };
    const moveFirst = validateMarketAnalysisText('SPX는 0.66% 오른 7,816.7이고 VIX는 3.6% 내린 14.86입니다. 위험 선호는 제한적입니다.', data, snapshot);
    const wrongLevel = validateMarketAnalysisText('SPX는 0.66% 오른 7,500이고 VIX는 3.6% 내린 19.9입니다. 위험 선호는 제한적입니다.', data, snapshot);
    const nextMetric = validateMarketAnalysisText('VIX는 안정적이며 SPX는 7,816.7입니다. 시장 폭을 함께 봅니다.', data, snapshot);
    const percentMove = validateMarketAnalysisText('VIX는 3.6% 변화했고 수준은 14.86입니다. SPX는 7,816.7입니다.', data, snapshot);
    const secondWrong = validateMarketAnalysisText('SPX는 7,816.7입니다. 이후 SPX는 6,000이라고 적었습니다. VIX는 14.86입니다.', data, snapshot);
    const upperEnglish = validateMarketAnalysisText('SPX는 7,816.7입니다. VIX는 14.86입니다. THE MARKET OUTLOOK IS EXTREMELY POSITIVE AND EVERY INVESTOR SHOULD BUY NOW.', data, snapshot);
    const aliases = validateMarketAnalysisText('S&P 500은 7,816.7입니다. VIX는 14.86입니다. 지표를 함께 봅니다.', data, snapshot);
    check('P1594 levels stay with their metric, every repeated mention is checked and uppercase prose stays subject to Korean validation',
      !nextMetric.issues.length && !percentMove.issues.length && !aliases.issues.length
      && secondWrong.issues.includes('metric-value-mismatch:market.spx') && upperEnglish.issues.includes('language-not-korean'),
      JSON.stringify({ nextMetric, percentMove, secondWrong, upperEnglish, aliases }));
    check('P1585 the analysis validator reads the level, not the move, and still rejects a wrong level',
      !moveFirst.issues.some((issue) => issue.startsWith('metric-value-mismatch'))
        && wrongLevel.issues.includes('metric-value-mismatch:market.spx') && wrongLevel.issues.includes('metric-value-mismatch:market.vix'),
      JSON.stringify({ moveFirst: moveFirst.issues, wrongLevel: wrongLevel.issues }));
  }
  {
    // T03/T08 (v57.48 review): the 10/13 artifact published, as verified, "유가 -6.40%인 코스피는 장중 하락" (-6.40% was KOSPI's
    // move) and "금리 -0.08%" (a relative change of the yield). A % move is now checked against the named metric's own
    // changePct under its Korean name too, a rate moves only in bp, and an in-session value needs 장중 + its time.
    // These fixtures test other rules on a -6% KOSPI day; the v57.69 KOSPI-mention rule is checked on its own (P1800).
    const { validateMarketAnalysisText: validateAll } = await import('./fetch-data.mjs');
    const validateMarketAnalysisText = (...args) => { const result = validateAll(...args); return { ...result, issues: result.issues.filter((issue) => issue !== 'korea-move-unaddressed') }; };
    const snapshot = { quotes: [
      { instrumentId: '^KS11', evidenceId: 'market.index.kospi:t', value: 5975.74, changePct: -6.3986, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-13T03:55:30.000Z', session: 'DELAYED_IN_SESSION' },
      { instrumentId: 'CL=F', evidenceId: 'market.commodity.wti:t', value: 92.53, changePct: -1.2908, unit: 'USD/barrel', source: 'Yahoo chart', observedAt: '2026-10-13T04:05:27.000Z', session: 'DELAYED_IN_SESSION' },
      { instrumentId: '^TNX', evidenceId: 'market.rates.us10y:t', value: 5.24, changePct: -0.0763, unit: 'percent', source: 'Yahoo chart', observedAt: '2026-10-12T18:59:53.000Z', session: 'MARKET_CLOSED' },
      { instrumentId: '^GSPC', evidenceId: 'market.index.spx:t', value: 7651.5, changePct: -0.06, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-12T20:00:00.000Z', session: 'MARKET_CLOSED' },
      { instrumentId: '^VIX', evidenceId: 'market.volatility.vix:t', value: 15.21, changePct: 2.4933, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-12T20:15:00.000Z', session: 'MARKET_CLOSED' }
    ] };
    const data = { meta: { generatedAt: '2026-10-13T04:17:00.000Z' }, news: [], macro: {} };
    const published = validateMarketAnalysisText('유가 -6.40%인 코스피는 장중 하락했고[market.index.kospi:780d058c], 유가 -1.29%도 약세였다.\n미국장에선 금리 -0.08%, 에스앤피오백 -0.06%로 소폭 하락했고 변동성지수는 +2.49% 상승했지만 15.21로 낮은 수준이다.', data, snapshot);
    const correct = validateMarketAnalysisText('미국장에선 10년물 금리가 0.4bp 내린 5.24%, 에스앤피오백 -0.06%로 소폭 하락했고 변동성지수는 +2.49% 상승했지만 15.21로 낮은 수준이다. 기준금리 4.50%는 이번 판단과 별개다.', data, snapshot);
    const timed = validateMarketAnalysisText('코스피는 13:05 KST 장중 -6.40%로 하락했다.', data, snapshot);
    const untimed = validateMarketAnalysisText('코스피는 장중 -6.40%로 하락했다.', data, snapshot);
    const wrongBp = validateMarketAnalysisText('10년물은 8bp 하락했다.', data, snapshot);
    // Review false blocks: other tenors/kinds of 금리, multi-period moves and shares are not the 10-year / one-session move.
    const otherRates = validateMarketAnalysisText('2년물 금리 4.80%와 실질 금리 1.85%는 10년물 5.24%보다 낮다.', data, snapshot);
    const multiPeriod = validateMarketAnalysisText('코스피는 20일 동안 8.2% 하락했고, S&P 500 상위 10개 기업이 40%를 차지한다.', data, snapshot);
    // P1702 (live 10/13): bound/approximate wording of a real move publishes; a wrong bound or direction still blocks.
    const boundOk = validateMarketAnalysisText('코스피는 13:05 KST 장중 6% 이상 급락했고 유가는 약 1.3% 내렸다.', data, snapshot);
    const boundWrong = validateMarketAnalysisText('코스피는 13:05 KST 장중 8% 이상 급락했다.', data, snapshot);
    const wayWrong = validateMarketAnalysisText('코스피는 13:05 KST 장중 6% 이상 급등했다.', data, snapshot);
    check('P1702 bound ("N% 이상") and approximate ("약 N%") moves are checked as such, not as exact values',
      !boundOk.issues.some((issue) => /metric-change-mismatch/.test(issue)) && boundWrong.issues.includes('metric-change-mismatch:market.kospi') && wayWrong.issues.includes('metric-change-mismatch:market.kospi'),
      JSON.stringify({ boundOk: boundOk.issues, boundWrong: boundWrong.issues, wayWrong: wayWrong.issues }));
    check('P1688/T03 review: other rate tenors, multi-period moves and shares do not trip the one-session check',
      !otherRates.issues.length && !multiPeriod.issues.length, JSON.stringify({ otherRates: otherRates.issues, multiPeriod: multiPeriod.issues }));
    const source = readProducerSource();
    check('P1688/T03 a % move is checked against its own metric (Korean names included) and a rate moves only in bp',
      published.issues.includes('metric-change-mismatch:market.wti') && published.issues.includes('rate-change-not-bp:market.us10y')
        && !correct.issues.length && wrongBp.issues.includes('metric-change-mismatch:market.us10y'),
      JSON.stringify({ published: published.issues, correct: correct.issues, wrongBp: wrongBp.issues }));
    check('P1688/T08 the commentary prompt carries completed closes only and an in-session value needs 장중 + its time',
      !timed.issues.length && untimed.issues.includes('intraday-time-missing:market.kospi')
        && /const promptEvidence = metricEvidence\.filter\(\(row\) => !row\.session \|\| MARKET_ANALYSIS_CLOSED_SESSIONS\.includes\(row\.session\)\)/.test(source)
        && /promptEvidence\.slice\(0, 16\)/.test(source) && /금리\(10Y\)의 변화는 bp로만/.test(source) && !/현금 비중을 두는 쪽이 유리할 가능성/.test(source),
      JSON.stringify({ timed: timed.issues, untimed: untimed.issues }));
  }
}
{
  // P1719 (live 10/13): dates and clock times were read as index levels ("S&P 500은 10월 12일 7,807.24로 마감" -> SPX=10,
  // "한국시간 오후 3시 기준" -> 3) and blocked a correct commentary; a blocked attempt gets one retry with its reasons, and
  // a second block keeps the previous verified analysis for 12 hours, marked `retained`.
  const { validateMarketAnalysisText, genMarketAnalysis, retainVerifiedMarketAnalysis } = await import('./fetch-data.mjs');
  const snapshot = { quotes: [
    { instrumentId: '^GSPC', evidenceId: 'market.index.spx:t', value: 7807.24, changePct: -0.4, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-12T20:00:00.000Z', session: 'MARKET_CLOSED' },
    { instrumentId: '^VIX', evidenceId: 'market.vol.vix:t', value: 15.21, changePct: 2.49, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-12T20:00:00.000Z', session: 'MARKET_CLOSED' },
    { instrumentId: '^KS11', evidenceId: 'market.index.kospi:t', value: 5975.74, changePct: -5.46, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-13T06:30:00.000Z', session: 'MARKET_CLOSED' }
  ] };
  const data = { meta: { generatedAt: '2026-10-13T09:00:00.000Z' }, news: [], macro: {} };
  const issues = (text, context = '') => validateMarketAnalysisText(text, data, snapshot, { context }).issues.filter((issue) => issue !== 'korea-move-unaddressed');
  const dated = issues('S&P 500은 10월 12일 7,807.24로 마감했다. 위험 선호는 제한적이다.');
  const clock = issues('KOSPI는 한국시간 오후 3시 기준 5,975.74로 마감했다. 코스피는 5.46% 하락했다.');
  const wrong = issues('S&P 500은 7,100으로 마감했다. 위험 선호는 제한적이다.');
  const wrongAfterDate = issues('S&P 500은 10월 12일 7,100으로 마감했다.');
  const contextQuoted = issues('S&P 500은 20일 고점 7,100 아래에서 7,807.24로 마감했다.', '20일 고점 7,100 대비');
  // Review (v57.52): a context value written as the current level is still a wrong level.
  const contextAsLevel = issues('S&P 500은 7,100으로 마감했다.', '20일 고점 7,100 대비');
  const contextBounded = issues('S&P 500은 10으로 마감했다.', '종합: 2026-10-13 100');
  check('P1719 dates and clock times are not metric levels; a wrong level still blocks; the REGIME_CONTEXT exception is whole-number bounded and needs a reference marker',
    !dated.length && !clock.length && wrong.includes('metric-value-mismatch:market.spx') && wrongAfterDate.includes('metric-value-mismatch:market.spx')
      && !contextQuoted.length && contextAsLevel.includes('metric-value-mismatch:market.spx') && contextBounded.includes('metric-value-mismatch:market.spx'),
    JSON.stringify({ dated, clock, wrong, wrongAfterDate, contextQuoted, contextAsLevel, contextBounded }));
  const bad = 'S&P 500은 7,100으로 마감했다. 위험 선호는 제한적이다.';
  const good = 'S&P 500은 10월 12일 7,807.24로 마감했다. 코스피는 5.46% 하락했다.';
  const prompts = [];
  const stub = (answers) => async (prompt) => { prompts.push(prompt); return { text: answers.shift() ?? null }; };
  const now = Date.parse('2026-10-13T09:00:00.000Z');
  const previous = { status: 'verified', semanticStatus: 'verified', semanticIssues: [], generatedAt: '2026-10-13T03:00:00.000Z', full: 'prev', oneLine: 'prev', metricEvidence: [] };
  const withIntraday = { ...data, newsIntraday: [{ title: '코스피 5% 급락', source: '연합뉴스', publishedAt: '2026-10-13T05:00:00.000Z' }] };
  const warn = console.warn; console.warn = () => {};
  let retried; let retained; let expired;
  try {
    retried = await genMarketAnalysis(withIntraday, snapshot, { previous, request: stub([bad, good]), nowMs: now });
    retained = await genMarketAnalysis(withIntraday, snapshot, { previous, request: stub([bad, bad]), nowMs: now });
    expired = await genMarketAnalysis(withIntraday, snapshot, { previous: { ...previous, generatedAt: '2026-10-12T20:00:00.000Z' }, request: stub([bad, bad]), nowMs: now });
  } finally { console.warn = warn; }
  check('P1719 one retry carries the blocked reasons and values; a second block keeps a <=12h verified analysis marked retained; older falls back',
    retried.status === 'verified' && !retried.retained && /PREVIOUS_ATTEMPT_REJECTED/.test(prompts[1] || '') && /evidence SPX=7807\.24/.test(prompts[1] || '') && /7100/.test(prompts[1] || '')
      && retained.status === 'verified' && retained.semanticStatus === 'verified' && retained.retained?.from === previous.generatedAt && /metric-value-mismatch/.test(retained.retained?.reason || '')
      && expired.status === 'blocked' && retainVerifiedMarketAnalysis({ ...previous, semanticIssues: ['x'] }, { nowMs: now }) === null
      && /08:00 이후 장중 속보\(잠정\)/.test(prompts[0] || ''),
    JSON.stringify({ retried: retried?.status, retained: retained?.retained, expired: expired?.status, prompts: prompts.length }));
  {
    // Unchanged evidence and headlines reuse a verified <12h analysis without a model call; any change, an older
    // analysis, or a flagged one calls again.
    const { reusableMarketAnalysis } = await import('./fetch-data.mjs');
    const firstPrompts = prompts.length;
    const fresh = await genMarketAnalysis(data, snapshot, { request: stub([good]), nowMs: now });
    const reusedRun = await genMarketAnalysis(data, snapshot, { previous: { ...fresh, generatedAt: '2026-10-13T08:00:00.000Z' }, request: stub([good]), nowMs: now });
    const callsAfterReuse = prompts.length;
    const movedSnapshot = { quotes: snapshot.quotes.map((row) => row.instrumentId === '^GSPC' ? { ...row, evidenceId: 'market.index.spx:t2' } : row) };
    const moved = await genMarketAnalysis(data, movedSnapshot, { previous: { ...fresh, generatedAt: '2026-10-13T08:00:00.000Z' }, request: stub([good]), nowMs: now });
    check('P1751 market analysis reuse skips the model only for unchanged evidence/headlines under 12 h',
      fresh.status === 'verified' && reusedRun.generatedAt === '2026-10-13T08:00:00.000Z' && callsAfterReuse === firstPrompts + 1
        && moved.generatedAt !== '2026-10-13T08:00:00.000Z' && prompts.length === callsAfterReuse + 1
        && reusableMarketAnalysis({ ...fresh, generatedAt: '2026-10-12T20:00:00.000Z' }, { metricEvidence: fresh.metricEvidence, newsEvidence: fresh.newsEvidence, headlineContext: fresh.headlineContext, nowMs: now }) === null
        && reusableMarketAnalysis({ ...fresh, semanticIssues: ['x'] }, { metricEvidence: fresh.metricEvidence, newsEvidence: fresh.newsEvidence, headlineContext: fresh.headlineContext, nowMs: now }) === null,
      JSON.stringify({ fresh: fresh.status, reused: reusedRun.generatedAt, moved: moved.generatedAt, calls: prompts.length - firstPrompts }));
  }
  const source = readProducerSource();
  check('P1719 a rejected text is logged (400 chars) and never published; the run passes the previous artifact analysis',
    /\.slice\(0, 400\)/.test(source) && /genMarketAnalysis\(data, marketSnapshotForConsumers, \{ previous: previous\?\.marketAnalysis \|\| null \}\)/.test(source)
      && /data\.meta\.marketAnalysisRetained = marketAnalysis\.retained \|\| null/.test(source));
  // Review (v57.52): one news cut per run — fetchNews and meta.newsCycleEnd use the same attempt time, so a run that
  // straddles 08:00 KST cannot pick newsIntraday against the previous cut and fail P1720.
  check('P1720 fetchNews and meta.newsCycleEnd share the run attempt time',
    /fetchNews\(Date\.parse\(attemptedAt\)\)/.test(source) && /const newsCycle = getKst0800NewsCycle\(Date\.parse\(attemptedAt\)\)/.test(source));
}
{
  // v57.69 (2026-10-15 crash audit): on a -1.1% S&P 500 / -5.5% KOSPI morning after a hot CPI the published reading
  // said "물가 둔화 경로", named no cause and no KOSPI move (P1800; the crossroads lead is P1801); the contributor lane published a one-stock session
  // (P1802); the free translator's mixed-script lines passed (P1803); Korean dailies could not enter the intraday slot (P1804).
  const { validateMarketAnalysisText, isCleanKoreanTitle, translateHeadlines, buildBreadthContributorSessions, selectNewsIntraday } = await import('./fetch-data.mjs');
  const snapshot = { quotes: [
    { instrumentId: '^GSPC', evidenceId: 'market.index.spx:c', value: 7718.94, changePct: -1.11, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-14T20:00:00.000Z', session: 'MARKET_CLOSED' },
    { instrumentId: '^KS11', evidenceId: 'market.index.kospi:c', value: 5635.83, changePct: -6.21, unit: 'index', source: 'Yahoo chart', observedAt: '2026-10-15T00:20:00.000Z', session: 'DELAYED_IN_SESSION' }
  ] };
  const news = [{ title: 'Nasdaq ends sharply lower as hot inflation data stokes rate-hike bets', source: 'Reuters', link: 'https://example.test/cpi', pubDate: '2026-10-14T21:00:00.000Z', score: 80 }];
  const hot = { meta: { generatedAt: '2026-10-15T00:21:00.000Z' }, news, macro: { cpiDelta: 0.3 } };
  const v = (text, data = hot) => validateMarketAnalysisText(text, data, snapshot).issues;
  const ok = v('Reuters 헤드라인에 따르면 뜨거운 물가 지표에 S&P 500은 1.11% 하락한 7,718.94로 마감했다. 코스피는 09:20 KST 장중 6.21% 급락했다.');
  const noCause = v('S&P 500은 1.11% 하락한 7,718.94로 마감했다. 코스피는 09:20 KST 장중 6.21% 급락했다.');
  const easing = v('보도에 따르면 S&P 500은 1.11% 하락했다. 장기금리 하락은 물가 둔화 경로와 일치한다. 코스피는 09:20 KST 장중 6.21% 급락했다.');
  const quotedPath = v('보도에 따르면 S&P 500은 1.11% 하락했다. 「물가 둔화」 경로는 이번 발표로 멀어졌다. 코스피는 09:20 KST 장중 6.21% 급락했다.');
  const noKorea = v('보도에 따르면 S&P 500은 1.11% 하락한 7,718.94로 마감했다.');
  const cooling = v('보도에 따르면 S&P 500은 1.11% 하락했다. 장기금리 하락은 물가 둔화 경로와 일치한다. 코스피는 09:20 KST 장중 6.21% 급락했다.', { ...hot, macro: { cpiDelta: -0.2 } });
  check('P1800 a large move needs a headline-attributed cause, a hot CPI cannot be read as easing, and a 3%+ KOSPI move is named',
    !ok.length && noCause.includes('causal-attribution-missing') && easing.includes('inflation-direction-contradicts-evidence')
      && !quotedPath.includes('inflation-direction-contradicts-evidence') && noKorea.includes('korea-move-unaddressed')
      && !cooling.includes('inflation-direction-contradicts-evidence'),
    JSON.stringify({ ok, noCause, easing, quotedPath, noKorea, cooling }));
  const source = readProducerSource();
  check('P1800 an in-session KOSPI move of 3% or more reaches the prompt labelled 장중 with its KST time',
    /const koreaIntradayLines = metricEvidence/.test(source) && /KOREA_LARGE_INTRADAY_MOVE \(장중 지연 값/.test(source)
      && /Math\.abs\(changeOf\.get\(row\.evidenceId\)\) >= KOREA_MOVE_MENTION_PCT/.test(source));

  const nowMs = Date.parse('2026-10-15T01:00:00.000Z');
  const point = (date, movers) => ({ date, us: { universe: 1143, signalEligible: { movers, highLow: movers }, contributors: { up4: [['AAA', 5]], down4: [] }, breadthUp4: 1, breadthDown4: 0, breadthNewHighs: 0, breadthNewLows: 0 } });
  const sessions = buildBreadthContributorSessions([point('2026-10-13', 839), point('2026-10-14', 1)], nowMs);
  check('P1802 a contributor session judged on less than half the universe is withheld, as in the history lane',
    sessions.length === 1 && sessions[0].date === '2026-10-13' && /minimumEligible = breadthMinimumEligible\(universe\)/.test(source),
    JSON.stringify(sessions.map((row) => [row.date, row.eligible])));

  const items = [{ title: 'Stocks slide after CPI' }, { title: 'Chip stocks fall' }, { title: 'Oil climbs' }, { title: 'Yields rise' }, { title: 'Dollar firms' }];
  const result = await translateHeadlines(items, {
    previous: [{ title: 'Oil climbs', titleKo: '유가 ราคา 상승' }],
    translate: async () => ({ translations: ['CPI 발표 후 증시 하락', '반도체주 株價 하락', '유가 상승', '국채 금리 상승', '달러 강세'], model: 'fixture' })
  });
  check('P1803 a translation with another script mixed in is not kept, and a cached one is held to the same test',
    isCleanKoreanTitle('CPI 발표 후 증시 하락') && !isCleanKoreanTitle('반도체주 株價 하락') && !isCleanKoreanTitle('유가 ราคา 상승') && !isCleanKoreanTitle('Nvidia 가')
      && result.reused === 0 && items[0].titleKo === 'CPI 발표 후 증시 하락' && !items[1].titleKo && items[2].titleKo === '유가 상승',
    JSON.stringify({ result, items }));

  const end = Date.parse('2026-10-14T23:00:00.000Z');
  const kr = (title, source, hours) => ({ title: `${title} - ${source}`, link: `https://news.example/${encodeURIComponent(title)}`, source, _sourceRaw: source, ts: end + hours * 3600000, topic: 'kr', country: 'kr', feedTier: 2 });
  const picked = selectNewsIntraday([kr('코스피 6% 급락 사이드카 발동 외국인 반도체 매도', '서울경제', 0.5), kr('원달러 환율 급등 외국인 순매도 확대', '뉴시스', 0.6), kr('코스닥 급락 반도체 약세', '포커스온경제', 0.7)], { cycleEndMs: end, nowMs: end + 2 * 3600000 });
  check('P1804 national Korean dailies and wires enter the intraday slot (tier 2); regional outlets stay out',
    picked.length === 2 && picked.every((item) => item.tier === 2 && item.market === 'kr') && !picked.some((item) => item.source === '포커스온경제'),
    JSON.stringify(picked.map((item) => [item.source, item.tier])));
}
{
  // v57.70 (2026-10-15 full-page audits): dated previous closes, the screener's majority session, fundamentals deep
  // links, theme constituents on completed closes, consensus basis gaps, non-lending financials, Telegram text.
  const { exchangeLocalDate } = await import('./fetch-data.mjs');
  const { buildCloseSeries } = await import('../src/domain/briefing/market-read.js');
  const { parseRouteDeepLink } = await import('../src/app/router.js');
  const { consensusView, buildConsensusPoint } = await import('../src/domain/fundamental/consensus-read.js');
  const { createThemesProvider } = await import('../src/data/providers/themes.js');
  const { cleanTelegramText } = await import('./lib/telegram-text.mjs');
  const prevMeta = (observedAt, sessionDate) => ({ observedAt, observationRelation: 'previous-completed-close', observedAtSource: 'provider-previous-close', ...(sessionDate ? { sessionDate } : {}) });
  const dated = buildCloseSeries([
    { date: '2026-10-13', wti: 93.74, fieldMeta: { wti: prevMeta('2026-10-13T04:00:00.000Z', '2026-10-12') } },
    { date: '2026-10-14', wti: 94.14, fieldMeta: { wti: prevMeta('2026-10-14T04:00:00.000Z', '2026-10-13') } }
  ], 'wti');
  const legacy = buildCloseSeries([
    { date: '2026-10-13', wti: 93.74, fieldMeta: { wti: prevMeta('2026-10-13T04:00:00.000Z') } }
  ], 'wti');
  check('v57.70 a previous close carries its own session date (the next bar\'s 00:00 ET boundary no longer names it)',
    JSON.stringify(dated) === JSON.stringify([{ date: '2026-10-12', value: 93.74 }, { date: '2026-10-13', value: 94.14 }]) && legacy[0]?.date === '2026-10-13'
      && exchangeLocalDate(Date.parse('2026-10-13T04:00:00.000Z'), 'America/New_York') === '2026-10-13' && exchangeLocalDate(Date.parse('2026-10-14T00:00:00.000Z'), 'Asia/Seoul') === '2026-10-14'
      && exchangeLocalDate(Date.parse('2026-10-13T04:00:00.000Z'), null) === null,
    JSON.stringify({ dated, legacy }));

  const rows = {};
  for (let i = 0; i < 20; i += 1) rows[`S${i}`] = { factorBarStart: '2026-10-13T13:30:00.000Z', factorSessionDate: '2026-10-13' };
  rows.LATE = { factorBarStart: '2026-10-14T13:30:00.000Z', factorSessionDate: '2026-10-14' };
  const scopes = factorScopesByMarket(rows);
  check('v57.70 the screener session is the date most rows carry, not the newest row\'s',
    scopes.US?.sessionDate === '2026-10-13' && scopes.US?.barStart === '2026-10-13T13:30:00.000Z' && scopes.US?.sessionRows === 20, JSON.stringify(scopes));

  check('v57.70 #fundamental/AAPL names its company like #ticker/AAPL',
    parseRouteDeepLink('#fundamental/aapl')?.entityId === 'AAPL' && parseRouteDeepLink('#fundamental?sym=MSFT')?.entityId === 'MSFT' && parseRouteDeepLink('#macro')?.entityId === null,
    JSON.stringify(parseRouteDeepLink('#fundamental/aapl')));

  const now = Date.parse('2026-10-15T00:00:00.000Z');
  const est = (trailing) => ({ asOf: '2026-10-14T17:38:53.081Z', fwd: { from: '2026-09', to: '2027-06', eps: 12.94, hi: 14.08, lo: 12, minEstimates: 6, up4w: 4, down4w: 1 }, trailing: { from: '2025-09', to: '2026-06', eps: trailing } });
  const gap = consensusView({ valuationPrice: 353.78 }, est(19.91), { now });
  const same = consensusView({ valuationPrice: 353.78 }, est(11.5), { now });
  const gapText = buildConsensusPoint({ valuationPrice: 353.78, factorSessionDate: '2026-10-13' }, est(19.91), { now })?.text || '';
  check('v57.70 a forward sum 30% or more below the trailing sum is not compared as the same basis',
    gap.trailingPe === null && gap.growth === null && gap.basisGap === true && gap.fwdPe > 27 && same.growth > 12 && same.trailingPe > 30
      && /같은 기준인지 확인되지 않으므로 성장률과 직전 PER은 표시하지 않습니다/.test(gapText) && !/예상 이익 -35%/.test(gapText),
    JSON.stringify({ gap, same: { growth: same.growth, trailingPe: same.trailingPe } }));

  const provider = createThemesProvider({
    readLiveData: () => ({}),
    readDefinitions: () => ({ themes: [{ id: 'care', nameKr: '헬스케어', leaders: ['A', 'B', 'C'], subThemes: [{ name: '제약', tickers: ['A', 'B', 'C'] }] }] }),
    readSelectedId: () => 'care',
    readScreenerRows: () => [{ sym: 'A', ret1d: 1.2, factorSessionDate: '2026-10-13' }, { sym: 'B', ret1d: -2.4, factorSessionDate: '2026-10-13' }, { sym: 'C', ret1d: 3, factorSessionDate: '2026-10-14' }],
    now: () => '2026-10-15T01:00:00.000Z'
  });
  const detail = provider.readCurrent().selectedDetail;
  check('v57.70 theme constituents fall back to one completed-close session when live quotes do not cover them',
    detail?.quoteBasis?.kind === 'completed-close' && detail.quoteBasis.session === '2026-10-13' && detail.quotes.A?.pct === 1.2 && detail.quotes.A?.closeBased === true
      && detail.quotes.C?.pct == null && detail.breadth === 50,
    JSON.stringify({ basis: detail?.quoteBasis, breadth: detail?.breadth, quotes: detail?.quotes }));

  check('v57.70 Telegram summaries carry no pictographs, rules or quoted Chinese originals; Hanja inside Korean stays',
    cleanTelegramText('▶️ 주요 코멘트').trim() === '주요 코멘트' && !/[一-鿿]/.test(cleanTelegramText('•닛케이225 -3% >韩国首尔综指下跌6%。 日本东证指数下跌2%。'))
      && /中 증시/.test(cleanTelegramText('中 증시 하락')) && !/━|☁/.test(cleanTelegramText('━━━ ☁️ CRWV')),
    JSON.stringify([cleanTelegramText('▶️ 주요 코멘트'), cleanTelegramText('•닛케이225 -3% >韩国首尔综指下跌6%。')]));

  const { isLendingFinancial } = await import('../src/domain/fundamental/fiscal-read.js');
  const { benchmarkFieldFor } = await import('../src/domain/technical/chart-analysis.js');
  check('v57.70 payment networks are not read as banks, and an index fund is not compared with its own index',
    !isLendingFinancial('V', 'Financials') && !isLendingFinancial('ma', 'Financials') && isLendingFinancial('JPM', 'Financials') && !isLendingFinancial('AAPL', 'Technology')
      && benchmarkFieldFor('SPY') === null && benchmarkFieldFor('^GSPC') === null && benchmarkFieldFor('AAPL') === 'spx'
      && benchmarkFieldFor('005930.KS') === 'kospi' && benchmarkFieldFor('247540.KQ') === 'kosdaq' && benchmarkFieldFor('^KS11') === null);
}
{
  // v57.71 (owner 2026-10-15): "오늘의 한 문장" — written on the analysis call's last line, validated on its own, fixed
  // once per 08:00 KST day; the Korean wire's market feed is read directly.
  const { splitMarketSentence, validateMarketSentence, dailyMarketSentence, marketSentenceDay } = await import('./lib/market-analysis-validate.mjs');
  const { NEWS_FEEDS } = await import('./lib/news-selection.mjs');
  const split = splitMarketSentence('S&P 500은 1.11% 하락했다.\n코스피는 장중 급락했다.\n오늘의 한 문장: "누군가는 이날을 기다렸고, 누군가는 이날을 기점으로 떠날 것이다."');
  const at = (iso) => Date.parse(iso);
  const morning = dailyMarketSentence({ candidate: '오늘의 하락은 기회인가, 서사의 끝을 알리는 신호인가?', previous: null, nowMs: at('2026-10-15T00:30:00.000Z') });
  const sameDay = dailyMarketSentence({ candidate: '다른 문장이 와도 같은 날에는 바뀌지 않는가?', previous: morning, nowMs: at('2026-10-15T06:30:00.000Z') });
  const nextDay = dailyMarketSentence({ candidate: '하루가 지나면 새 문장이 그 자리를 잇는가?', previous: morning, nowMs: at('2026-10-15T23:30:00.000Z') });
  const rejected = dailyMarketSentence({ candidate: 'NVDA를 지금 사세요', previous: morning, nowMs: at('2026-10-15T23:30:00.000Z') });
  check('v57.71 the daily sentence is split from the reading, carries no number/ticker/instruction, and changes once per 08:00 KST day',
    split.sentence === '누군가는 이날을 기다렸고, 누군가는 이날을 기점으로 떠날 것이다.' && !/오늘의 한 문장/.test(split.body)
      && validateMarketSentence('AI 서사는 끝났는가, 쉬어 가는 것인가?') && !validateMarketSentence('코스피 6% 급락, 기회인가') && !validateMarketSentence('지금 비중을 늘리세요, 바닥입니다')
      && morning?.day === '2026-10-15' && sameDay === morning && nextDay?.day === '2026-10-16' && nextDay.text !== morning.text && rejected === morning
      && marketSentenceDay(at('2026-10-14T22:59:00.000Z')) === '2026-10-14' && marketSentenceDay(at('2026-10-14T23:00:00.000Z')) === '2026-10-15',
    JSON.stringify({ split, morning, sameDay, nextDay, rejected }));
  const yonhap = NEWS_FEEDS.find((feed) => /yna\.co\.kr/.test(feed.url));
  check('v57.71 the Korean wire\'s market feed is read on the refresh cadence as a tier-2 Korean feed',
    yonhap?.country === 'kr' && yonhap.tier === 2 && yonhap.source === '연합뉴스' && NEWS_FEEDS.filter((feed) => /news\.google\.com/.test(feed.url)).length >= 8, JSON.stringify(yonhap));
}
{
  // P1720: post-08:00 articles go to a separate provisional slot (tier 1-2, curation filters, one per event, max 6,
  // Korean items first); the completed 08:00 bundle is unchanged.
  const { selectNewsIntraday, NEWS_INTRADAY_MAX } = await import('./fetch-data.mjs');
  const end = Date.parse('2026-10-12T23:00:00.000Z');
  const now = Date.parse('2026-10-13T09:00:00.000Z');
  const h = (x) => end + x * 3600000;
  const row = (title, source, ts, extra = {}) => ({ title: `${title} - ${source}`, link: `https://news.example/${encodeURIComponent(title)}`, source, _sourceRaw: source, ts, topic: 'kr', country: 'kr', feedTier: 2, ...extra });
  const picked = selectNewsIntraday([
    row('코스피 5% 급락…외국인 반도체 매도 확대', '연합뉴스', h(5)),
    row('코스피 5% 급락, 외국인 반도체 매도 확대', '연합뉴스', h(5.1)),
    row('삼성전자 하락 반도체주 동반 약세 SK하이닉스', '연합뉴스', h(6)),
    row('코스닥 급락 원달러 환율 1,340원대', '포커스온경제', h(4)),
    row('Stocks to buy now: the next Nvidia', 'Reuters', h(3), { topic: 'semi', country: 'us' }),
    row('Old bundle story on oil prices', 'Reuters', h(-1), { topic: 'geo', country: 'global' }),
    row('Gold hits record as investors seek safety', 'Financial Times', h(1), { topic: 'fxbond', country: 'global' }),
    row('Oil jumps as tanker hit near Hormuz', 'Reuters', h(2), { topic: 'geo', country: 'global' }),
    row('Treasury yields climb as dollar strengthens', 'Bloomberg', h(6), { topic: 'fxbond', country: 'global' }),
    row('Fed officials signal patience on rate cuts', 'CNBC', h(7), { topic: 'macro', country: 'us' }),
    row('Nvidia shares fall as chip stocks slide', 'CNBC', h(8), { topic: 'semi', country: 'us' }),
    row('Wall Street futures slip; S&P 500 eyes CPI', 'CNBC', h(8.5), { topic: 'macro', country: 'us' }),
    row('Copper falls on China demand worries', 'Bloomberg', h(9), { topic: 'fxbond', country: 'global' })
  ], { cycleEndMs: end, nowMs: now, canonical: [{ title: 'Gold hits record as investors seek safety', link: 'x', source: 'FT' }] });
  const titles = picked.map((item) => item.title);
  check('P1720 intraday slot: after the cut, tier 1-2, filters, one per event (bundle included), <=2 per publisher, Korean first, max 6',
    picked.length === NEWS_INTRADAY_MAX && picked.filter((item) => item.market === 'kr').length === 2
      && picked.every((item) => item.tier <= 2 && Date.parse(item.publishedAt) >= end && item.provisional === true && item.source && item.topic && item.market)
      && !titles.some((t) => /next Nvidia|Old bundle|Gold hits|1,340원대/.test(t)) && titles.filter((t) => /코스피 5% 급락/.test(t)).length === 1
      && picked.filter((item) => item.source === 'CNBC').length <= 2
      && selectNewsIntraday([], { cycleEndMs: end, nowMs: now }).length === 0,
    JSON.stringify(titles));
  const source = readProducerSource();
  check('P1720 the slot is published beside the canonical bundle and the bundle window is unchanged',
    /newsIntraday,\n\s*\};/.test(source) && /newsIntradayCount: newsIntraday\.length/.test(source)
      && /if \(!isFinite\(t\) \|\| t < cycle\.startMs \|\| t >= cycle\.endMs\) continue;/.test(source)
      && /Object\.defineProperty\(out, 'intraday', \{ value: selectNewsIntraday\(/.test(source));
}
{
  // P1721: Yahoo's daily FX bars dropped Mon 10/12 and left 10/13 null, so the FX previous close reached back to 10/9 and
  // the won froze at 1,342.99 for two days. The FX previous close is the hourly close at the 23:00Z (KST 08:00) cut.
  const { fxCloseAtCut, boundPreviousCloseToCut, HIST_FIELD_PLAUSIBILITY } = await import('./fetch-data.mjs');
  const fri20 = Date.parse('2026-10-09T20:00:00Z') / 1000;
  const mon22 = Date.parse('2026-10-12T22:00:00Z') / 1000;
  const tue = fxCloseAtCut([fri20, fri20 + 3600, mon22, mon22 + 3600], [1340.02, null, 1334.2, 1334.63], Date.parse('2026-10-13T08:28:00Z'));
  const mon = fxCloseAtCut([fri20, fri20 + 3600, mon22], [1340.02, null, 1334.2], Date.parse('2026-10-12T08:00:00Z'));
  const none = fxCloseAtCut([fri20], [null], Date.parse('2026-10-12T08:00:00Z'));
  const bySym = { 'KRW=X': tue?.close };
  const bySymQuote = { 'KRW=X': { observationRelation: 'previous-completed-close', observedAt: tue?.observedAt, previousBarOpenedAt: tue?.previousBoundary } };
  const bound = boundPreviousCloseToCut({ bySym, bySymQuote, cycleEnd: '2026-10-12T23:00:00.000Z' });
  const source = readProducerSource();
  check('P1721 FX previous close is the hourly close at the KST 08:00 cut (Monday close on Tuesday, Friday close on Monday) and stays within the row cut',
    tue?.close === 1334.2 && tue?.observedAt === '2026-10-12T23:00:00.000Z' && mon?.close === 1340.02 && mon?.observedAt === '2026-10-09T21:00:00.000Z'
      && none === null && !bound.adjusted.length && !bound.dropped.length && bySym['KRW=X'] === 1334.2
      && /_pctSource = 'fx-hourly-cut-close'/.test(source),
    JSON.stringify({ tue, mon, none, bound }));
  check('P1721 Brent futures (BZ=F) get the same completed-close history column as WTI (CL=F)',
    /'BZ=F': 'brent'/.test(source) && /'wti','brent','gold'/.test(source) && Array.isArray(HIST_FIELD_PLAUSIBILITY.brent));
}
{
  // P1722: a bare 기관 ("영국 기관: 호르무즈 … 선박 피격") is not the Korean institutional-investor flow.
  const { KR_INSTITUTIONAL_FLOW } = await import('./lib/telegram-tickers.mjs');
  const digestSource = read('scripts/fetch-telegram-digest.mjs');
  check('P1722 telegram 한국장/수급 tags need 기관 as an investor group, not any agency',
    !KR_INSTITUTIONAL_FLOW.test('영국 기관: 호르무즈 해협 및 인근 해역에서 선박 6척 하루 동안 잇따라 피격') && KR_INSTITUTIONAL_FLOW.test('외국인과 기관이 동반 매도')
      && KR_INSTITUTIONAL_FLOW.test('기관이 3,000억 순매도') && !/외국인\|기관\|코스피/.test(digestSource) && !/수급\|외국인\|기관\|순매수/.test(digestSource));
}
{
  // P1385: a FRED series added after the previous artifact (fedTargetLower/Upper) must still get an
  // explicit freshness marker; the semantics gate rejects `_source_*` without `_freshness_*`.
  let ok = false;
  let detail = '';
  try {
    const { mergeMacroLastKnownGood } = await import('./fetch-data.mjs');
    const merged = mergeMacroLastKnownGood({ _source: 'fred', fedTargetUpper: 4, _source_fedTargetUpper: 'fred-official-primary', cpi: 3.1 },
      { cpi: 3.0, _freshness_cpi: 'observed', unemployment: 4.1, _source_unemployment: 'fred-official-primary' });
    ok = merged._freshness_fedTargetUpper === 'observed' && merged._freshness_cpi === 'observed'
      && merged._source_unemployment === 'last-known-good' && merged._freshness_unemployment === 'stale-reference';
    detail = JSON.stringify({ fedTargetUpper: merged._freshness_fedTargetUpper, cpi: merged._freshness_cpi, unemployment: merged._freshness_unemployment });
  } catch (error) { detail = error.message; }
  check('P1385 newly added macro series publish an observed freshness marker', ok, detail);
}
{
  // P1119/P1122: the headline-only rights boundary stays (no article body is retained), but
  // its absence no longer withholds the narrative — causal prose is attributed and warned,
  // not blocked. Both halves are asserted so neither can drift silently.
  const fetchDataSource = readProducerSource();
  check('news producer retains no article body and publishes a headline-attributed narrative policy',
    /MARKET_ANALYSIS_NEWS_CONTENT_POLICY/.test(fetchDataSource)
      && /causalNarrative:\s*'headline-attributed-with-disclosure'/.test(fetchDataSource)
      && /excerptRetention:\s*'not-permitted-source-rights'/.test(fetchDataSource)
      && /newsContentPolicy:\s*MARKET_ANALYSIS_NEWS_CONTENT_POLICY/.test(fetchDataSource)
      && /contentDepth:\s*'headline-only'/.test(fetchDataSource)
      && !/contentDepth:\s*'(?:excerpt|article|full)'/.test(fetchDataSource));
  check('causal evidence that the policy makes impossible is a warning, never a block',
    /warnings\.push\('causal-attribution-missing'\)/.test(fetchDataSource)
      && /warnings\.push\('causal-evidence-missing'\)/.test(fetchDataSource)
      && !/issues\.push\('causal-evidence-missing'\)/.test(fetchDataSource)
      && /export function buildMarketAnalysisHeadlineContext/.test(fetchDataSource)
      && /HEADLINE_CONTEXT/.test(fetchDataSource)
      && /헤드라인에 따르면/.test(fetchDataSource));
}
{
  let ok = false;
  let detail = '';
  try {
    const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
    const facts = {
      cik: 1,
      entityName: 'Fixture Corp',
      facts: {
        'us-gaap': {
          RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
            { start:'2024-01-01', end:'2024-12-31', filed:'2025-02-01', form:'10-K', fp:'FY', val:800, accn:'a' },
            { start:'2025-01-01', end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:1000, accn:'b' }
          ] } },
          NetIncomeLoss: { units: { USD: [
            { start:'2024-01-01', end:'2024-12-31', filed:'2025-02-01', form:'10-K', fp:'FY', val:80, accn:'a' },
            { start:'2025-01-01', end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:100, accn:'b' }
          ] } },
          StockholdersEquity: { units: { USD: [
            { end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:500, accn:'b' }
          ] } }
        },
        dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
          { end:'2025-12-31', filed:'2026-02-01', form:'10-K', fp:'FY', val:10, accn:'b' }
        ] } } }
      }
    };
    const submissions = { filings: { recent: {
      accessionNumber: ['a', 'b'],
      acceptanceDateTime: ['2025-02-01T18:00:00.000Z', '2026-02-01T18:00:00.000Z']
    } } };
    const row = normalizeSecCompanyFacts('FIX', facts, 100, submissions);
    ok = row && row.pe === 10 && row.pb === 2 && row.roe === 20 && row.margin === 10 && row.revGrowth === 25 &&
      row.model === 'sec-fy-normalized-v2' && row.acceptedAt === '2026-02-01T18:00:00.000Z' &&
      row.pit?.schemaVersion === 'sec-pit-facts.v1' && row.pit.observationCount >= 6 && row.pit.acceptedTimeCount >= 4;
    detail = JSON.stringify(row);
  } catch (error) { detail = error.message; }
  check('SEC companyfacts normalizer preserves annual period and computes bounded comparable ratios', ok, detail.slice(0, 500));
}
{
  // P1374: a bank that reports only RevenuesNetOfInterestExpense was terminal (no revenue); a filer that
  // reports both keeps its standard revenue concept for the same period (lowest-priority fallback).
  let ok = false;
  let detail = '';
  try {
    const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
    const period = (val, accn, start, end, filed) => ({ start, end, filed, form: '10-K', fp: 'FY', val, accn });
    const common = {
      NetIncomeLoss: { units: { USD: [period(20, 'a', '2024-01-01', '2024-12-31', '2025-02-20'), period(25, 'b', '2025-01-01', '2025-12-31', '2026-02-20')] } },
      StockholdersEquity: { units: { USD: [{ end: '2025-12-31', filed: '2026-02-20', form: '10-K', fp: 'FY', val: 200, accn: 'b' }] } }
    };
    const shares = { dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: '2025-12-31', filed: '2026-02-20', form: '10-K', fp: 'FY', val: 10, accn: 'b' }] } } } };
    const bankRevenue = { RevenuesNetOfInterestExpense: { units: { USD: [period(80, 'a', '2024-01-01', '2024-12-31', '2025-02-20'), period(100, 'b', '2025-01-01', '2025-12-31', '2026-02-20')] } } };
    const submissions = { filings: { recent: { accessionNumber: ['a', 'b'], acceptanceDateTime: ['2025-02-20T18:00:00.000Z', '2026-02-20T18:00:00.000Z'] } } };
    const bank = normalizeSecCompanyFacts('BNK', { cik: 3, entityName: 'Bank Corp', facts: { 'us-gaap': { ...bankRevenue, ...common }, ...shares } }, 50, submissions);
    const both = normalizeSecCompanyFacts('BTH', { cik: 4, entityName: 'Both Corp', facts: { 'us-gaap': {
      Revenues: { units: { USD: [period(400, 'a', '2024-01-01', '2024-12-31', '2025-02-20'), period(500, 'b', '2025-01-01', '2025-12-31', '2026-02-20')] } },
      ...bankRevenue, ...common }, ...shares } }, 50, submissions);
    const secSource = readFileSync(new URL('./fetch-sec-fundamentals.mjs', import.meta.url), 'utf8');
    ok = !!bank && bank.margin === 25 && bank.revGrowth === 25 && !!both && both.margin === 5 && both.revGrowth === 25
      // terminal concept-coverage rows are rechecked once when the concept set version changes
      && /conceptSetChanged/.test(secSource) && /conceptSetVersion: SEC_CONCEPT_SET_VERSION/.test(secSource);
    detail = JSON.stringify({ bank: bank && { margin: bank.margin, revGrowth: bank.revGrowth }, both: both && { margin: both.margin, revGrowth: both.revGrowth } });
  } catch (error) { detail = error.message; }
  check('P1374 SEC normalizer covers bank revenue net of interest expense without overriding standard revenue', ok, detail.slice(0, 500));
}
{
  // W09-B/P1148 (F02): a derived ratio cannot have been reproducible before its LATEST operand
  // was public. Revenue filed 2024-02-01 with a later income/equity/shares restatement must move
  // the ratio availability to June — not keep the February revenue accession's provenance.
  let ok = false;
  let detail = '';
  try {
    const { normalizeSecCompanyFacts } = await import('./fetch-sec-fundamentals.mjs');
    const facts = {
      cik: 2,
      entityName: 'Availability Corp',
      facts: {
        'us-gaap': {
          RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
            { start: '2023-01-01', end: '2023-12-31', filed: '2024-02-01', form: '10-K', fp: 'FY', val: 800, accn: 'a' }
          ] } },
          NetIncomeLoss: { units: { USD: [
            { start: '2023-01-01', end: '2023-12-31', filed: '2024-06-01', form: '10-K/A', fp: 'FY', val: 100, accn: 'c' }
          ] } },
          StockholdersEquity: { units: { USD: [
            { end: '2023-12-31', filed: '2024-06-01', form: '10-K/A', fp: 'FY', val: 500, accn: 'c' }
          ] } }
        },
        dei: { EntityCommonStockSharesOutstanding: { units: { shares: [
          { end: '2023-12-31', filed: '2024-06-01', form: '10-K/A', fp: 'FY', val: 10, accn: 'c' }
        ] } } }
      }
    };
    const submissions = { filings: { recent: {
      accessionNumber: ['a', 'c'],
      acceptanceDateTime: ['2024-02-01T18:00:00.000Z', '2024-06-01T18:00:00.000Z']
    } } };
    const row = normalizeSecCompanyFacts('AVL', facts, 100, submissions);
    ok = !!row
      && row.availabilityModel === 'sec-pit-availability.v1'
      && row.operandAvailability?.revenue === '2024-02-01T18:00:00.000Z'
      && row.operandAvailability?.netIncome === '2024-06-01T18:00:00.000Z'
      && row.derivedAvailability?.margin === '2024-06-01T18:00:00.000Z'
      && row.derivedAvailability?.roe === '2024-06-01T18:00:00.000Z'
      && row.derivedAvailability?.pe === '2024-06-01T18:00:00.000Z'
      && row.availableAt === '2024-06-01T18:00:00.000Z'
      && row.availableAt !== row.operandAvailability.revenue
      && row.fiscalPeriodEnd === '2023-12-31'
      && row.reportRecency === 'stale-fy'
      && row.qualityStatus === 'REFERENCE';
    detail = JSON.stringify(row && { operandAvailability: row.operandAvailability, derivedAvailability: row.derivedAvailability, availableAt: row.availableAt, acceptedAt: row.acceptedAt, reportRecency: row.reportRecency, qualityStatus: row.qualityStatus });
  } catch (error) { detail = error.message; }
  check('W09-B/P1148: derived SEC ratios inherit the latest operand availability, not the revenue filing only', ok, detail.slice(0, 500));
}
{
  let ok = false;
  let detail = '';
  try {
    const { classifyIssuerCapability } = await import('./fetch-sec-fundamentals.mjs');
    const ifrs = classifyIssuerCapability({ facts: { 'ifrs-full': {} } }, { filings: { recent: { form: ['20-F'] } } });
    const usGaap = classifyIssuerCapability({ facts: { 'us-gaap': {} } }, { filings: { recent: { form: ['10-K'] } } });
    ok = ifrs.status === 'TERMINAL_UNSUPPORTED' && ifrs.issuerTaxonomy === 'IFRS' && /ifrs-taxonomy/.test(ifrs.reasonCode) && usGaap.status === 'SUPPORTED_US_GAAP';
    detail = JSON.stringify({ ifrs, usGaap });
  } catch (error) { detail = error.message; }
  check('SEC scheduler classifies IFRS/foreign issuers as terminal unsupported while retaining US-GAAP capability', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseTreasuryYieldCurveXml } = await import('./fetch-data.mjs');
    const entry = (date, values) => `<entry><content><m:properties><d:NEW_DATE m:type="Edm.DateTime">${date}T00:00:00</d:NEW_DATE>${Object.entries(values).map(([year, value]) => `<d:BC_${year}YEAR m:type="Edm.Double">${value}</d:BC_${year}YEAR>`).join('')}</m:properties></content></entry>`;
    const xml = `<feed>${entry('2026-08-11', { 2: 4.10, 5: 4.25, 10: 4.60, 20: 5.10, 30: 5.20 })}${entry('2026-08-12', { 2: 4.20, 5: 4.38, 10: 4.68, 20: 5.24, 30: 5.24 })}</feed>`;
    const curve = parseTreasuryYieldCurveXml(xml, '2026-08-13T00:00:00.000Z');
    ok = curve?.status === 'ok' && curve.observedAt === '2026-08-12' && curve.values.dgs2 === 4.2 && curve.values.dgs30 === 5.24 && curve.values.t10y2y === 0.48 && curve.sourceKind === 'T1_OFFICIAL';
    detail = JSON.stringify(curve);
  } catch (error) { detail = error.message; }
  check('Treasury curve parser selects the latest complete dated row and derives only a same-date spread', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseAaiiSentimentText } = await import('./fetch-data.mjs');
    const text = 'Reported Date Bullish Neutral Bearish\nAug 26 32.9%22.6%44.4%\nAug 19 35.5%24.6%39.9%';
    const result = parseAaiiSentimentText(text, '2026-08-28T03:00:00.000Z', 'https://r.jina.ai/https://www.aaii.com/sentimentsurvey/sent_results?adv=yes');
    ok = result?.status === 'current-reference' && result.observedAt === '2026-08-26' && result.bullish === 32.9 && result.neutral === 22.6 && result.bearish === 44.4 && result.spread === -11.5 && result.allowedUse === 'reference-only' && result.decisionUse === false && /relay/.test(result.sourceKind);
    detail = JSON.stringify(result);
  } catch (error) { detail = error.message; }
  check('AAII parser selects the latest complete official row, validates the 100% sum, and keeps relay evidence reference-only', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseFredHyOasCsv } = await import('./fetch-data.mjs');
    const csv = 'observation_date,BAMLH0A0HYM2\n2026-08-10,2.70\n2026-08-11,.\n2026-08-12,2.71\ninvalid,9.99\n';
    const result = parseFredHyOasCsv(csv, '2026-08-13T00:00:00.000Z');
    ok = result?.status === 'ok' && result.seriesId === 'BAMLH0A0HYM2' && result.observedAt === '2026-08-12' && result.value === 2.71 && result.unit === 'percent' && result.sourceKind === 'official-government-relay';
    detail = JSON.stringify(result);
  } catch (error) { detail = error.message; }
  check('FRED HY OAS CSV parser rejects missing/invalid rows and selects the latest dated observation', ok, detail);
}
{
  let ok = false;
  let detail = '';
  try {
    const { selectSecFundamentalsAsOf } = await import('../src/domain/fundamental/sec-report.js');
    const record = { symbol: 'FIX', pit: { observations: {
      revenue: [
        { value: 800, periodEnd: '2024-12-31', filedAt: '2025-02-01', acceptedAt: '2025-02-01T18:00:00.000Z', accession: 'a' },
        { value: 1000, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z', accession: 'b' },
        { value: 1100, periodEnd: '2025-12-31', filedAt: '2026-03-01', acceptedAt: '2026-03-01T18:00:00.000Z', accession: 'b-amend' }
      ],
      netIncome: [
        { value: 80, periodEnd: '2024-12-31', filedAt: '2025-02-01', acceptedAt: '2025-02-01T18:00:00.000Z', accession: 'a' },
        { value: 100, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z', accession: 'b' },
        { value: 105, periodEnd: '2025-12-31', filedAt: '2026-03-01', acceptedAt: '2026-03-01T18:00:00.000Z', accession: 'b-amend' }
      ],
      equity: [{ value: 500, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z' }],
      sharesOutstanding: [{ value: 10, periodEnd: '2025-12-31', filedAt: '2026-02-01', acceptedAt: '2026-02-01T18:00:00.000Z' }]
    } } };
    const before = selectSecFundamentalsAsOf(record, '2026-02-15T00:00:00.000Z');
    const after = selectSecFundamentalsAsOf(record, '2026-03-15T00:00:00.000Z', { priceAsOf: 100 });
    ok = before?.revenue === 1000 && before.netIncome === 100 && before.pe == null &&
      after?.revenue === 1100 && after.netIncome === 105 && after.pe === 9.52 && after.accession === 'b-amend';
    detail = JSON.stringify({ before, after });
  } catch (error) { detail = error.message; }
  check('SEC PIT selector excludes future amendments and never backfills current price without an as-of price', ok, detail.slice(0, 1000));
}
{
  let ok = false;
  let detail = '';
  try {
    const { parseCboePutCallHtml } = await import('./fetch-data.mjs');
    const row = parseCboePutCallHtml('{\\"name\\":\\"TOTAL PUT/CALL RATIO\\",\\"value\\":\\"0.93\\"},{\\"name\\":\\"INDEX PUT/CALL RATIO\\",\\"value\\":\\"1.01\\"},{\\"name\\":\\"EQUITY PUT/CALL RATIO\\",\\"value\\":\\"0.62\\"},{\\"selectedDate\\":\\"2026-07-14\\"}');
    ok = row && row.totalPutCall === 0.93 && row.indexPutCall === 1.01 && row.equityPutCall === 0.62 && row.asOf === '2026-07-14' && row.sourceKind === 'T3_PUBLIC_DELAYED';
    detail = JSON.stringify(row);
  } catch (error) { detail = error.message; }
  check('Cboe official page parser binds total/equity/index ratios to selected trading date', ok, detail);
}
{
  let detail = '';
  let ok = false;
  try {
    const { classifyFieldStatus } = await import('../src/data/contracts/screener.js');
    const now = Date.now();
    const fetchedAt = new Date(now).toISOString();
    const oldPublication = new Date(now - 3 * 86400000).toISOString();
    const lineage = deriveTickerNewsLineage([
      { title: 'older publication', pubDate: new Date(now - 8 * 86400000).toISOString() },
      { title: 'latest publication', ts: Date.parse(oldPublication) },
      { title: 'invalid publication', pubDate: 'not-a-date', ts: 0 }
    ], fetchedAt);
    const undated = deriveTickerNewsLineage([{ title: 'no publication timestamp' }], fetchedAt);
    const oldStatus = classifyFieldStatus({
      value: 'headline-only memo', observedAt: lineage.newsObservedAt, now,
      freshnessBudgetMs: 2 * 86400000, rights: 'REVIEW_REQUIRED', sourceKind: 'T3_PUBLIC_DELAYED'
    });
    const undatedStatus = classifyFieldStatus({
      value: 'headline-only memo', observedAt: undated.newsObservedAt, now,
      freshnessBudgetMs: 2 * 86400000, rights: 'REVIEW_REQUIRED', sourceKind: 'T3_PUBLIC_DELAYED'
    });
    ok = lineage.newsObservedAt === oldPublication && lineage.newsTs === oldPublication && lineage.newsFetchedAt === fetchedAt
      && oldStatus === 'STALE' && undated.newsObservedAt === null && undated.newsTs === null
      && undated.newsFetchedAt === fetchedAt && undatedStatus === 'STALE';
    detail = JSON.stringify({ lineage, undated, oldStatus, undatedStatus });
  } catch (error) { detail = error.message; }
  check('recent ticker-news fetch cannot make an old or undated publication look fresh', ok, detail);
}
{
  let detail = '';
  let ok = false;
  try {
    const src = extractFunctionSource(fetchData, 'computeScreenerBreadth');
    const fn = new Function('round', '_mean', `${src}\nreturn computeScreenerBreadth;`)(
      (v, d) => Number(v.toFixed(d)),
      (a) => a.reduce((s, v) => s + v, 0) / a.length
    );
    const up = Array.from({ length: 220 }, (_, i) => 100 + i);
    const down = Array.from({ length: 220 }, (_, i) => 400 - i);
    const out = fn(['UP','DOWN','005930.KS'], [
      { sym:'UP', adjCloses:up, observedAt:'2026-07-13T20:00:00.000Z' },
      { sym:'DOWN', adjCloses:down, observedAt:'2026-07-13T20:00:00.000Z' },
      { sym:'005930.KS', adjCloses:up, observedAt:'2026-07-14T06:30:00.000Z' }
    ]);
    ok = out.segments.us.universe === 2 && out.segments.us.eligible === 2 && out.segments.us.above20 === 50 && out.segments.us.advanceRatio === 0.5 && out.segments.kr.above200 === 100;
    detail = JSON.stringify(out.segments);
  } catch (error) { detail = error.message; }
  check('screener breadth calculation separates US/KR and computes MA/advance ratios', ok, detail.slice(0, 400));
}
{
  let detail = '';
  let ok = false;
  try {
    const dates = Array.from({ length: 260 }, (_, index) => new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10));
    const stocks = Array.from({ length: 12 }, (_, index) => {
      const closes = dates.map((_, day) => 100 + index + day * 0.2 + Math.sin((day + index) / 7));
      return {
        sym: `DATE${index}`,
        dates,
        closes,
        adjCloses: closes.map((value) => value * (1 + index / 100)),
        volumes: closes.map(() => 100000),
        adjustedCloseStatus: 'complete'
      };
    });
    // One series skips a bar; the common-date contract must still select one
    // shared rebalance date and map +FWD by that symbol's own next sessions.
    stocks[1] = {
      ...stocks[1],
      dates: stocks[1].dates.filter((_, index) => index !== 5),
      closes: stocks[1].closes.filter((_, index) => index !== 5),
      adjCloses: stocks[1].adjCloses.filter((_, index) => index !== 5),
      volumes: stocks[1].volumes.filter((_, index) => index !== 5)
    };
    const aligned = backtestFactors(stocks, { offsets: [42], fwdDays: 5, transactionCostBps: 20 });
    const missingAdjusted = backtestFactors([
      { ...stocks[0], adjCloses: stocks[0].adjCloses.map(() => null), adjustedCloseStatus: 'unavailable' },
      ...stocks.slice(1)
    ], { offsets: [42], fwdDays: 5, transactionCostBps: 20 });
    const noDates = backtestFactors(stocks.map(({ dates: _dates, ...stock }) => stock), { offsets: [42], fwdDays: 5 });
    ok = ['COMPLETE', 'PARTIAL'].includes(aligned.calculationStatus)
      && aligned.status === aligned.calculationStatus
      && aligned.dateAlignment?.mode === 'aligned'
      && aligned.dateAlignment?.commonDateCount === 259
      && aligned.dateAlignment?.calendarPolicy === 'minimum-coverage'
      && aligned.dateAlignment?.calendarDateCount === 260
      && aligned.rebalanceDates?.length === 1
      && aligned.executionModel?.transactionCostBps === 20
      && aligned.liquidity?.unitPolicy?.includes('USD and KRW')
      && aligned.universePolicy?.lookaheadBias === 'historical-membership-not-available'
      && aligned.universePolicy?.survivorshipBias === 'uncontrolled-current-membership-only'
      && aligned.readiness?.status === 'BLOCKED'
      && aligned.readiness?.blockers?.includes('historical-universe-point-in-time-not-available')
      && aligned.readiness?.blockers?.includes('execution-liquidity-filter-not-applied')
      && aligned.readiness?.blockers?.includes('transaction-costs-scenario-only')
      && aligned.dateAlignment?.forwardMapping?.includes('common-calendar exact')
      && missingAdjusted.adjustedCloseExcluded === 1
      && missingAdjusted.status === 'PARTIAL'
      && missingAdjusted.adjustedCloseStatus === 'partial'
      && noDates.status === 'BLOCKED'
      && noDates.readiness?.status === 'BLOCKED'
      && noDates.blockingReason === 'rebalance-calendar-required';
    detail = JSON.stringify({ aligned: { status: aligned.status, dateAlignment: aligned.dateAlignment, rebalanceDates: aligned.rebalanceDates }, missingAdjusted: { status: missingAdjusted.status, adjustedCloseStatus: missingAdjusted.adjustedCloseStatus, adjustedCloseExcluded: missingAdjusted.adjustedCloseExcluded }, noDates: { status: noDates.status, blockingReason: noDates.blockingReason } });
  } catch (error) { detail = error.message; }
  check('factor backtest aligns cross-sections by common dates and fails closed without dates', ok, detail.slice(0, 1400));
}
// P586/C2: backtest must self-disclose that it does not cover the live model's size/value/quality
// factors or its regime-adaptive weights, and the client panel must actually surface that disclosure
// rather than implying the full live composite rank is validated.
check('server backtest discloses its excluded factors and fixed weight regime', /excludedFactors/.test(fetchData) && /weightRegime:\s*'NEUTRAL'/.test(fetchData) && /excludedFactorsReason/.test(fetchData));
check('server backtest accumulates an IC time series artifact', /updateBacktestHistory/.test(fetchData) && /public-data\/backtest-history\.json/.test(fetchData));
check('client backtest panel surfaces the excluded-factors/weight-regime disclosure, not a blanket "validated" claim', /backtest\.excludedFactors/.test(screenerPage) && /backtest\.weightRegime/.test(screenerPage) && (/실시간 적응형 종합 랭크 검증 아님/.test(screenerPage) || /(?:레짐|국면) 틸트 후보는 검증·적용되지 않음/.test(screenerPage)) && !/종합 랭크가 검증 기반/.test(data + screenerPage));

// P587/R265/C6: dividend-unadjusted close systematically understates momentum/trend for
// high-yield names (measured: KO 6m return understated by 1.56pp raw vs adjusted). Factor/backtest
// math must consume the adjusted series; VCP stays on raw OHLC (price-structure pattern, not return).
check('fetchHistory exposes adjusted close alongside raw OHLCV', /adjClose:/.test(fetchData) && /indicators\?\.adjclose\?\.\[0\]\?\.adjclose/.test(fetchData));
check('screener factor enrichment keeps adjusted/raw price basis explicit', /adjCloses:/.test(fetchData) && /hasCompleteAdjusted/.test(fetchData) && /factorPriceSeries/.test(fetchData) && /backtestEligible/.test(fetchData));
check('VCP pattern recognition stays on raw OHLC (not adjusted close)', /_calcVCPServer\(r\.closes, r\.highs, r\.lows, r\.volumes\)/.test(fetchData));
check('backtest cross-sectional scoring is adjusted-close-only and fail-closed', /adjustedCloseStatus/.test(fetchData) && /priceBasis:\s*'adjusted-close-required'/.test(fetchData) && /adjustedCloseExcluded/.test(fetchData) && !/s\.adjCloses.*\? s\.adjCloses : s\.closes/.test(fetchData));
check('backtest publishes native liquidity/cost/rebalance disclosures', /transactionCostBps/.test(fetchData) && /executionModel/.test(fetchData) && /liquidityWindowDays/.test(fetchData) && /rebalanceDates/.test(fetchData) && /uncontrolled-current-membership-only/.test(fetchData));
  check('browser chart preserves raw OHLC and separate adjusted series', /adjustedCloses:/.test(data) && /adjustedCloseStatus/.test(data) && /backtestEligible/.test(data) && /sourceKind:\s*'T3_PUBLIC_DELAYED'/.test(data) && /research-history-raw-only/.test(data));

// P584/R265/C1: server screener.json RSI and the client's own displayed RSI must agree —
// previously the server used Cutler's RSI (windowed simple average) while the client used
// Wilder's RSI (recursively smoothed), same label, different numbers. Recompute both against
// identical synthetic input rather than trusting that matching source comments mean matching math.
let rsiParityDetail = '';
const rsiParityOk = (() => {
  try {
    const serverSrc = extractFunctionSource(fetchData, '_rsi14');
    const clientRsiSrc = extractFunctionSource(core, '_calcRSILast');
    const cleanNumsSrc = extractFunctionSource(core, '_aioCleanNums');
    if (!serverSrc) { rsiParityDetail = 'could not extract _rsi14 from fetch-data.mjs'; return false; }
    if (!clientRsiSrc) { rsiParityDetail = 'could not extract _calcRSILast from aio-core.js'; return false; }
    if (!cleanNumsSrc) { rsiParityDetail = 'could not extract _aioCleanNums from aio-core.js'; return false; }
    const roundFn = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
    const serverRsi14 = new Function('round', `${serverSrc}\nreturn _rsi14;`)(roundFn);
    const clientCalcRsiLast = new Function(`${cleanNumsSrc}\n${clientRsiSrc}\nreturn _calcRSILast;`)();
    // Deterministic synthetic series long enough (300 bars) for Wilder's smoothing to be well
    // past its warm-up window, matching real usage (screener enrichment runs on ~1y of history).
    const closes = [];
    let p = 100;
    for (let i = 0; i < 300; i++) {
      p += Math.sin(i / 7) * 1.3 + (i % 23 === 0 ? 4 : 0) - (i % 31 === 0 ? 3 : 0) + 0.02;
      closes.push(Math.max(1, p));
    }
    const serverVal = serverRsi14(closes);
    const clientVal = roundFn(clientCalcRsiLast(closes, 14), 1);
    if (typeof serverVal !== 'number' || typeof clientVal !== 'number') {
      rsiParityDetail = `non-numeric result: server=${serverVal} client=${clientVal}`;
      return false;
    }
    const diff = Math.abs(serverVal - clientVal);
    if (diff > 0.5) {
      rsiParityDetail = `server=${serverVal} client=${clientVal} diff=${diff.toFixed(2)} (tolerance 0.5)`;
      return false;
    }
    return true;
  } catch (e) {
    rsiParityDetail = e.message;
    return false;
  }
})();
check('server _rsi14 and client _calcRSILast are numerically equivalent (P584/R265 parity)', rsiParityOk, rsiParityDetail);

// FABLE-ARCH-DIAGNOSIS-2026-07-06.md Phase 3 [D-VCP]: server `_calcVCPServer` (fetch-data.mjs) and
// client `_calcVCP` (aio-core.js) are two independently-maintained implementations of the same
// pattern-recognition logic (parallel to the RSI case above) — currently in parameter parity, but
// nothing previously caught it if one side's swing-detection window, base-length lookback, or
// contraction-depth band drifted from the other. Text-contract check (not full behavioral parity
// like RSI above — VCP's differing input shapes, {ok,vcpScore,vcpStage,...} vs separate
// closes/highs/lows/volumes arrays, make a synthetic-data equivalence test disproportionate to what
// this is guarding): confirm the same core numeric literals appear in both extracted function bodies.
let vcpParityDetail = '';
const vcpParityOk = (() => {
  try {
    const serverSrc = extractFunctionSource(fetchData, '_calcVCPServer');
    const clientSrc = extractFunctionSource(core, '_calcVCP');
    if (!serverSrc) { vcpParityDetail = 'could not extract _calcVCPServer from fetch-data.mjs'; return false; }
    if (!clientSrc) { vcpParityDetail = 'could not extract _calcVCP from aio-core.js'; return false; }
    // Anchored to the actual declaration/expression, not a bare number — a nearby Korean comment
    // documenting the same parameter (e.g. "좌우 N=4봉 기준") would otherwise satisfy a loose
    // `N\s*=\s*4` match on whichever side's comment happens to still say the old value, hiding a
    // real drift in the code itself. Verified by deliberately mutating just the code declaration
    // (not the comment) and confirming a loose pattern missed it before tightening to these.
    const params = [
      { label: 'minimum bar count (60)', re: /\bn\s*<\s*60\b/ },
      { label: 'base window length (min(65, n-10))', re: /Math\.min\(65,\s*n\s*-\s*10\)/ },
      { label: 'swing pivot half-window (N=4 declaration)', re: /\bN\s*=\s*4\s*[;,]\s*(?:const\s+)?sw[HL]\s*=\s*\[\]/ },
      { label: '52-week lookback cap (min(252, n))', re: /Math\.min\(252,\s*n\)/ },
      { label: 'stage-2 52w-off-high floor (-30)', re: /pct52\s*>=\s*-30/ },
      { label: 'contraction depth floor (>= 1)', re: /(?:d|dep)\s*>=\s*1\s*&&/ },
      { label: 'contraction depth ceiling (<= 45)', re: /<=\s*45\)\s*ctrs\.push/ },
    ];
    const mismatches = params.filter((p) => p.re.test(serverSrc) !== p.re.test(clientSrc));
    if (mismatches.length) {
      vcpParityDetail = mismatches.map((p) => `${p.label}: server=${p.re.test(serverSrc)} client=${p.re.test(clientSrc)}`).join('; ');
      return false;
    }
    return true;
  } catch (e) {
    vcpParityDetail = e.message;
    return false;
  }
})();
check('server _calcVCPServer and client _calcVCP share the same core parameters (Phase 3 D-VCP parity)', vcpParityOk, vcpParityDetail);
check('telegram digest script extracts topics, tickers, topItems', /topicCounts/.test(fetchTelegram) && /tickerCounts/.test(fetchTelegram) && /topItems/.test(fetchTelegram) && /telegram-public-mirror/.test(fetchTelegram));
check('telegram digest preserves honest rolling-window lineage separately from capped text payloads', /observedItems/.test(fetchTelegram) && /eligibleTextCount/.test(fetchTelegram) && /selectedRawCoveragePct/.test(fetchTelegram) && /retainedItemCount/.test(fetchTelegram));
check('telegram digest regenerates narrative and all-page routing from current artifact', /buildDynamicNarrative/.test(fetchTelegram) && /themes:dynamicNarrative\.themes/.test(fetchTelegram) && /pageMap:dynamicNarrative\.pageMap/.test(fetchTelegram) && /loadRequiredPageIds/.test(fetchTelegram) && /route-owners\.json/.test(fetchTelegram) && /guide:\[\]/.test(fetchTelegram));
check('telegram digest separates the completed 24h lane from the rolling research window', /windowKind:\s*'research-14d'/.test(fetchTelegram) && /current24hWindow/.test(fetchTelegram) && /current24hCoverage/.test(fetchTelegram) && /current24hItems/.test(fetchTelegram) && /14-day research window/.test(fetchTelegram));
check('telegram ticker extraction expands through SCREENER_DB aliases', /loadScreenerAliases/.test(fetchTelegram) && /SCREENER_ALIASES/.test(fetchTelegram) && /screener alias load failed/.test(fetchTelegram));
check('telegram digest registers four channels and fail-closed source catalog', /CHANNEL_CATALOG/.test(fetchTelegram) && /HANAchina/.test(fetchTelegram) && /sourceCatalog/.test(fetchTelegram) && /CHANNELS\.map\(slug/.test(fetchTelegram) && /collectionStatus:'failed'/.test(fetchTelegram));
{
  // P1544: ticker symbols match case-sensitively; ordinary English words must not become tickers.
  const { matchTickers } = await import('./lib/telegram-tickers.mjs');
  const plain = matchTickers('To be or not to be: a cat, a mu, a meta lite plan, a coherent oracle of apple and azure gemini');
  check('P1544 ordinary English words (be/cat/mu/meta/lite/coherent/oracle/apple) are not tagged as tickers', plain.length === 0, plain.join(','));
  const real = matchTickers('BE rose on SOFC demand while Micron and MU, TSMC TPU, Oracle, Coherent and Apple moved');
  check('P1544 uppercase symbols and capitalized names still resolve', ['BE', 'MU', 'TSM', 'ORCL', 'COHR', 'AAPL'].every((t) => real.includes(t)), real.join(','));
  // 2026-10-13 news audit N15/N16: a product name (TPU) relates a company without making it the issuer, and a post
  // naming six or more issuers is a list whose names leave the issuer tally.
  const { classifyPostTickers } = await import('./lib/telegram-tickers.mjs');
  const product = classifyPostTickers('TPU orders rise as SOFC demand grows');
  check('P1711 N16 product names are related tickers, not issuers', product.tickers.length === 0 && ['AVGO', 'BE'].every((t) => product.relatedTickers.includes(t)) && !real.includes('AVGO'), JSON.stringify(product));
  const list = classifyPostTickers('Net buying TOP: NVDA, AMZN, TSMC, Oracle, Tesla, Micron');
  check('P1711 N15 six-or-more-issuer list posts leave the issuer tally', list.tickers.length === 0 && list.listTickers.length >= 6, JSON.stringify(list));
  check('P1544 telegram producer delegates ticker matching to the case-sensitive matcher', /classifyPostTickers\(stripLinks\(text\), SCREENER_ALIASES\)/.test(fetchTelegram) && !/\['BE', \/\\bBE\\b\|Bloom Energy\|SOFC\/i\]/.test(fetchTelegram));
}
{
  // 2026-10-13 news audit N01/N04/N09/N10/N11/N12/N13: ticker memos name their issuer or stay empty, rotate over
  // the universe, carry KST dates without the publisher in the text; market news caps paraphrases of one story.
  const fd = await import('./fetch-data.mjs');
  const now = Date.parse('2026-10-13T08:00:00Z');
  const at = (h) => now - h * 3600000;
  const wrong = [['V', 'Visa', 'Nvidia (NVDA) vs. Broadcom (AVGO): Which AI Stock Is a Better Buy?'], ['MA', 'Mastercard', 'MA Financial Group Issues Shares'],
    ['DE', 'Deere & Co', 'Edel SE shares fall'], ['LIN', 'Linde', 'Taiwan Stock Exchange Chairman Lin Hsiu-ming: In Talks'], ['NOW', 'ServiceNow', 'Microsoft Now Has 3 Generations of Its Own AI Chips'],
    ['LOW', 'Lowe\'s', 'WEN Stock Heads From A 12-Year Low'], ['BROS', 'Dutch Bros', 'Warner Bros. Discovery stock rises']];
  const leaked = wrong.filter(([sym, name, title]) => fd.selectTickerNewsMemo([{ title, source: 'Reuters', ts: at(2) }], { sym, name, nowMs: now }));
  check('P1709 N01 ticker memo keeps only headlines that name the issuer (fail-closed)', leaked.length === 0, leaked.map((x) => x[0]).join(','));
  const memo = fd.selectTickerNewsMemo([{ title: 'Deere Raises Outlook As Farm Demand Recovers - Reuters', source: 'Reuters', ts: Date.parse('2026-10-12T22:30:00Z') },
    { title: 'Deere stock price target raised - MarketBeat', source: 'MarketBeat', ts: at(1) }], { sym: 'DE', name: 'Deere & Co', nowMs: now });
  check('P1709 N05/N09/N10 memo drops low-quality sources, dates in KST, keeps the publisher out of the text', memo?.memo === '[10-13] Deere Raises Outlook As Farm Demand Recovers' && memo.sources[0] === 'Reuters', JSON.stringify(memo));
  const eligible = Array.from({ length: 768 }, (_, i) => `S${i}`);
  const covered = new Set();
  for (let run = 0; run < 12; run += 1) fd.planTickerNewsTargets(eligible, run * fd.TICKER_NEWS_ROTATION_SLOT_MS).targets.forEach((sym) => covered.add(sym));
  check('P1709 N04 ticker news keeps the 90 cap and reaches every eligible stock by rotation', fd.planTickerNewsTargets(eligible, now).targets.length === fd.TICKER_NEWS_RUN_CAP && covered.size === eligible.length, `covered=${covered.size}`);
  check('P1709 N04/N21 producer records why a memo is empty and carries only verified memos', /applyTickerNewsResults\(data,/.test(fetchData) && /'rotation-pending'/.test(fetchData) && /'fetch-failed'/.test(fetchData) && /prior\.newsMemoVerified === true/.test(fetchData) && !/\.slice\(0, 90\)/.test(fetchData));
  const cap = fd.createNewsTopicCap();
  const saudi = ['Oil prices rise on Saudi Arabia attacks', 'Oil prices spike after Houthi attacks on Saudi airports', 'Oil Jumps 2% as Saudi Attacks Revive Hormuz Fears', 'Oil Prices Recover as Saudi Arabia Attacks Offset Diesel Supply'];
  const taken = saudi.filter((title) => { if (cap.full(title)) return false; cap.add(title); return true; });
  check('P1710 N11 market news allows at most two paraphrases sharing the same key entities', taken.length === 2, taken.join(' | '));
  check('P1710 N12 CFD-broker desks are low-quality sources (host-normalised)', fd.newsSourceLabel('https://www.tmgm.com/') === 'tmgm.com' && /low-quality-source/.test(fd.scoreServerNewsItem({ title: 'Gold fails to sustain a break above $4,200, US CPI in focus', source: fd.newsSourceLabel('www.tmgm.com') }).selectionReason)
    && /low-quality-source/.test(fd.scoreServerNewsItem({ title: 'Dow Jones open 190 pts higher as investors eye bank earnings', source: 'Invezz' }).selectionReason));
  check('P1710 N13 promise-of-wealth headlines are clickbait', fd.scoreServerNewsItem({ title: 'Adding Nvidia During The Current Uncertainty is How Fortunes Are Made', source: 'Reuters' }).selectionReason === 'clickbait-filter');
}

check('app loads server data artifact', /public-data\/data\.json/.test(data) && /_aioLoadServerData/.test(data));
check('app applies quotes, macro, F&G, news, telegram, LLM, and native screener metadata', /applyLiveQuotes\(d\.quotes\)/.test(data) && /DATA_SNAPSHOT/.test(data) && /_applyFearGreedScore/.test(data) && /_aioApplyNewsBackstop/.test(data) && /_aioLoadServerTelegramDigest/.test(data) && /_serverMarketAnalysis/.test(data) && /_aioApplyNativeScreenerState/.test(data) && /aio:nativeScreenerReady/.test(data));
check('app gates and applies screener breadth with observation time and coverage', /_aioApplyScreenerBreadth/.test(data) && /breadthScreener/.test(data) && /coveragePct\s*>=\s*85/.test(data) && /ageHours\s*<=\s*96/.test(data));
check('quant readiness blocks trading claims until model parity and predictive validation pass', /getQuantReadinessAudit/.test(data) && /liveModelParity/.test(data) && /predictiveValidation/.test(data) && /research-relative-ranking-only/.test(data) && /매매 신호 아님/.test(data));
check('native screener only admits versioned log-scale Kalman fields and preserves stale backtest disclosure', /factor\.kalmanScale/.test(screenerProvider) && /kalmanVelConf/.test(screenerProvider) && /kalmanInnovZ/.test(screenerProvider) && /backtest:\s*artifact\.backtest/.test(screenerProvider) && /legacy_kalman_scale/.test(data));
check('app exposes public-data operational meta', /window\._serverDataMeta/.test(data) && /fredHasKey/.test(data) && /marketAnalysisOk/.test(data) && /telegramMemoOverlay/.test(data));
check('P1421 core data pipeline audit exposes publicData and shared AI availability', /getDataPipelineAudit/.test(core) && /publicData/.test(core) && /server FRED_API_KEY not configured/.test(core) && /if \(!serverPublicData\.marketAnalysisOk\)/.test(core) && /server AI market analysis unavailable; shared Worker configuration, budget or provider response needs verification/.test(core));
check('operational health includes data pipeline', /getOperationalHealth/.test(core) && /dataPipeline/.test(core));

check('chat consumes news context and screener memo', /_buildNewsContext/.test(chat) && /newsCache/.test(chat) && /SCREENER_DB Memo/.test(chat) && /_aioGetMemoForTicker/.test(chat));
check('news Korean translation and local insight fallback are wired', /_aioBuildNewsLocalKoreanInsight/.test(data) && /_aioGetNewsTranslation/.test(data) && /ko_explain/.test(data) && /getNewsTranslationQualityAudit/.test(data));
// The Korean rewrite brief renderer was never called (its #news-korean-rewrite-brief slot stayed hidden);
// the renderer trio and slot were retired. The per-item ko_rewrite/ko_section/ko_market fields stay.
check('P1753 news Korean rewrite fields stay on items and the uncalled rewrite brief stays retired', /ko_rewrite/.test(data) && /ko_section/.test(data) && /ko_market/.test(data) && !/_aioBuildNewsKoreanRewriteBrief|_aioRenderNewsKoreanRewriteBrief/.test(data) && !/news-korean-rewrite-brief/.test(read('index.html')));
// P1391: an untranslated headline is shown as written; no generated category sentence and no [EN]/[번역 중] prefixes.
check('P1391 market news title shows the original headline when no translation exists', !/_aioBuildNewsVisibleFallbackTitle/.test(data) && /P1391: no translation → the original headline/.test(data) && !/\[EN\]\s*'\s*\+/.test(data) && !/\[번역 중\]\s*'\s*\+\s*\(item\.title/.test(data));
check('P1753 market news native surface consumes normalized server/RSS items before Telegram fallback', /buildNewsSurfaceModel/.test(newsPage) && /selectNewsItems/.test(newsPage) && /_aioApplyNewsBackstop/.test(data) && /_aioApplyTelegramDigestToScreenerDb/.test(data) && /id="live-news-feed"/.test(read('index.html')));
check('news selection audit exposes score criteria and surface eligibility', /getNewsSelectionAudit/.test(data) && /scoreBuckets/.test(data) && /scoreReasons/.test(data) && /homeEligible/.test(data) && /marketNewsEligible/.test(data) && /unverified=-8/.test(data));
check('server news backstop preserves score tier and news-cycle metadata', /newsCycleStart/.test(data) && /newsCycleEnd/.test(data) && /serverCycleTrusted/.test(data) && /isFinite\(Number\(n\.score\)\)/.test(data));
check('all primary news surfaces use KST 08:00 completed 24h cycle', /home:\s*\{[\s\S]{0,260}newsCyclePolicy:\s*'kst-0800-completed-24h'[\s\S]{0,120}windowHours:\s*24/.test(data) && /market-news'[\s\S]{0,320}newsCyclePolicy:\s*'kst-0800-completed-24h'[\s\S]{0,120}windowHours:\s*24/.test(data) && /filterByKst0800NewsCycle/.test(data) && /newsCycle:\s*cycleWindow/.test(data));
// P1391: the developer timestamp bar was removed; the user-facing window wording lives in the subtitle and the important-news heading.
check('P1601 market-news labels derive completed 24h cycle rather than a stale today label', /표시 기간 기준/.test(marketNewsHtml) && /id="news-important-list"/.test(marketNewsHtml) && /fmt\(olderCycle \? cycleEnd : newsWindow.end\)/.test(newsPage) && !/최근 48시간|48시간 이내|필터:\s*48시간/.test(marketNewsHtml));
check('market-news empty state uses 24h completed-cycle wording', /08:00 KST까지 24시간/.test(newsPage) && !/완료 24h/.test(newsPage) && !/48.?\uC2DC\uAC04/.test(newsPage));
// P1389/P1391: the briefing no longer carries a news list (moved to the news screen's important/full split);
// its native owner renders the connected read, and no surface writes the retired list.
check('briefing primary feed has a native owner and no legacy primary DOM writer', /route === 'briefing'/.test(newsPage) && /renderBriefingRead/.test(newsPage) && /pickImportantNews/.test(newsPage) && !/briefing-live-news-list/.test(newsPage) && !/briefing-live-news-list/.test(core) && !/briefing-live-news-list/.test(data));
check('macro primary quote/FRED surface has a native owner and legacy writers fence native elements', /renderLiveQuotes/.test(marketPage) && /renderSnapshotMetrics/.test(marketPage) && /aioMacroRenderer/.test(marketPage) && /_aioIsNativeMacroElement/.test(data) && /_aioIsNativeMacroElement\(el\)/.test(data) && /closest\('#page-macro\[data-aio-architecture-renderer="native"\]'\)/.test(data) && /closest\('#page-macro\[data-aio-architecture-renderer="native"\]'\)/.test(core));
check('fxbond primary quote/MOVE surface has a native owner and legacy writers fence native elements', /renderFxbond/.test(marketPage) && /aioFxbondRenderer/.test(marketPage) && /function _aioIsNativeFxbondElement/.test(data) && /page-fxbond\[data-aio-architecture-renderer="native"\]/.test(data) && /page-fxbond\[data-aio-architecture-renderer="native"\]/.test(core) && /page-fxbond\[data-aio-architecture-renderer="native"\]/.test(pagesSource));
// P1395: the breadth page is the native trend-card board (breadth-board.js) over the dated history artifact.
check('P827 v57.60 breadth primary current-metric surface has a native artifact owner and no legacy writer remains', /renderBreadthBoard\(\{ documentRef, root \}\)/.test(marketPage) && /aioBreadthRenderer/.test(marketPage) && /buildCloseSeries\(history, 'breadth50'\)|pctSeries\('breadth50'\)/.test(read('src/ui/components/breadth-board.js')) && !/_aioIsNativeBreadthElement|function updateBreadthBars/.test(data + read('js/aio-ui.js')) /* v57.60: legacy breadth writers retired */);
check('news consumers do not directly reuse rolling 48h newsCache filters', !/filterByAge\(newsCache,\s*48\)/.test(data) && !/48시간 이내 한국 관련 뉴스|뉴스 피드 자동 추출[\s\S]{0,80}48시간/.test(html));
check('chat consumes Korean news translation context', /_aioGetNewsTranslation/.test(chat) && /ko_rewrite/.test(chat) && /ko_market/.test(chat) && /ko_explain/.test(chat) && /ko_impact/.test(chat) && /ko_action/.test(chat));
check('Telegram digest reaches SCREENER_DB memo', /_aioApplyTelegramDigestToScreenerDb/.test(data) && /_telegramMemoOverlay/.test(data) && /memoOverlay/.test(data));
check('Telegram runtime replaces stale static narrative with dynamic artifact fields', /themes:\s*Array\.isArray\(raw\.themes\)/.test(data) && /categories:\s*Array\.isArray\(raw\.categories\)/.test(data) && /pageMap:\s*raw\.pageMap/.test(data) && /getTelegramPageCoverageAudit/.test(data));
check('client current Telegram feed uses only the digest current24h lane', /rawCurrent24hItems/.test(data) && /AIO_TELEGRAM_CURRENT_ITEMS/.test(data) && /_aioRenderTelegramFeedHtml/.test(data));
check('news native summary projects count, source, risk, sentiment, and shared-cut status', /renderNewsSummary/.test(newsPage) && /news-24h-count/.test(newsPage) && !/news-risk-count|news-sent-score/.test(newsPage) && /last-fetch-time/.test(newsPage)); // P1672: sentiment/risk strip retired (P1391)
check('browser tests cover Telegram memo injection', /T831[\s\S]{0,2400}SCREENER_DB memo/.test(tests));

// v51.94/Phase 2 [B6]: getScreenerSymbols() must read the JSON artifact, not regex-scrape
// js/aio-data.js source text (the old "\n];" boundary search was a fragile string-search bound).
check('getScreenerSymbols reads screener-universe.json, not source-text regex', /screener-universe\.json/.test(fetchData) && !/src\.indexOf\('\\n\];'/.test(fetchData));
// Drift check: public-data/screener-universe.json must be exactly what
// scripts/sync-screener-universe.mjs would regenerate from js/aio-data.js's current SCREENER_DB
// right now — catches "edited SCREENER_DB, forgot to re-run the sync script" before it ships.
{
  const sync = spawnSync(process.execPath, [join(root, 'scripts/sync-screener-universe.mjs'), '--check'], { encoding: 'utf8' });
  check('public-data/screener-universe.json is in sync with js/aio-data.js SCREENER_DB', sync.status === 0, (sync.stdout + sync.stderr).trim().slice(0, 400));
}
// ── P1449: 종목 identity — SCREENER_DB/registry name vs the issuer's own SEC entity name. ──
// A ticker must name one issuer everywhere (P1339/R95/R85). The 2026-10 review caught 'A' being
// labelled Avantor on themes/screener while the 재무 screen correctly showed Agilent (AVTR is a
// different, absent ticker). Model names drift between vendor forms, so the comparison is a
// normalized (corporation/INC suffix-insensitive, case/hyphen-insensitive) token-first-name match,
// with the light fixture pinning the concrete incident and warnings for newly observed drifts.
try {
  // P1757: the full ledger is producer-only (data-store branch); the projection keeps entityName per row.
  const secFund = JSON.parse(exists('public-data/sec-fundamentals.json') ? read('public-data/sec-fundamentals.json') : read('public-data/sec-fundamentals-summary.json'));
  const universeRows = JSON.parse(read('public-data/screener-universe.json')).universe || [];
  const normalizeIssuerName = (value) => String(value || '')
    .toUpperCase().replace(/[,.\(\)]/g, ' ').replace(/\b(INC|INCORPORATED|CORPORATION|CORP|LTD|LIMITED|CO|COMPANY|PLC|NV|SA|CLASS)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
  // Gating needs to stay cheap and readable — the incident pin only ('A').
  const agilentUniverse = universeRows.find((row) => row?.sym === 'A');
  check("P1460 screener universe ticker 'A' is Agilent (not Avantor — that is AVTR)",
    !/AVANTOR/i.test(String(agilentUniverse?.name || '')) && /AGILENT/i.test(String(agilentUniverse?.name || '')),
    `A maps to ${agilentUniverse?.name}`);
  // Warn (not fail): many SEC entity names legitimately differ from vendor short names, so a
  // hard equality gate would be noise; the printed warning keeps the drift visible each run.
  const secSymbols = universeRows.filter((row) => secFund.data?.[row.sym]?.entityName);
  const drifts = secSymbols.filter((row) => normalizeIssuerName(row.name).split(' ')[0] && normalizeIssuerName(secFund.data[row.sym].entityName).split(' ')[0]
    && normalizeIssuerName(row.name).split(' ')[0] !== normalizeIssuerName(secFund.data[row.sym].entityName).split(' ')[0]);
  if (drifts.length) {
    console.warn(`[data-pipeline] P1449 issuer-name drift between SCREENER_DB and SEC entityName (information): ${drifts.slice(0, 8).map((row) => `${row.sym}: "${row.name}" vs "${secFund.data[row.sym].entityName}"`).join(' | ')}${drifts.length > 8 ? ` (+${drifts.length - 8} more)` : ''}`);
  }
} catch (error) {
  console.warn(`[data-pipeline] P1449 issuer identity cross-check could not read its artifacts: ${error.message}`);
}

check('data pipeline contract is wired into CI', qaPipeline.profiles?.full?.includes('core') && Object.values(qaPipeline.groups || {}).flatMap((group) => group.gates || []).some((gate) => gate.script === 'scripts/ci-data-pipeline-contract-check.mjs'));
const lineageAuditSource = read('scripts/ci-data-lineage-audit.mjs');
check('P1283/R634 lineage freshness reference uses the wall clock and ignores ambient overrides', /const NOW = createAuditTime\(\);/.test(lineageAuditSource) && !/process\.env\.AIO_LINEAGE_AS_OF/.test(lineageAuditSource));
check('P1287/R637 live-core freshness has no market-closed age waiver', !/marketClosedGraceEligible|deriveMarketSession|isLatestUsRegularClose/.test(lineageAuditSource) && /policy\.maxAgeHours != null && age\.ageHours > policy\.maxAgeHours/.test(lineageAuditSource));
const runtimeDataSource = read('js/aio-data.js');
const operationsStatusSource = read('scripts/build-operations-status.mjs');
check('P1291/R641 browser and operations status never waive stale live-core freshness at market close',
  !/marketClosedGrace|_utcDay/.test(runtimeDataSource)
  && /var _liveCoreEligible = _marketCyclePublished && _liveCoreFresh/.test(runtimeDataSource)
  && !/marketClosedGrace|utcDay/.test(operationsStatusSource)
  && /fresh: withinSla && coverageComplete && quoteQualityComplete/.test(operationsStatusSource));
let strictLiveCoreAgeFixtures = false;
try {
  const freshnessStart = runtimeDataSource.indexOf('function _aioIsStrictLiveCoreFreshnessAge(ageMs) {');
  const freshnessEnd = runtimeDataSource.indexOf('\n}', freshnessStart) + 2;
  if (freshnessStart >= 0 && freshnessEnd > freshnessStart) {
    const sandbox = {};
    runInNewContext(`${runtimeDataSource.slice(freshnessStart, freshnessEnd)}\nthis.assess = _aioIsStrictLiveCoreFreshnessAge;`, sandbox, { timeout: 1000 });
    strictLiveCoreAgeFixtures = sandbox.assess(12 * 60 * 60 * 1000) === true
      && sandbox.assess(12 * 60 * 60 * 1000 + 1) === false
      && sandbox.assess(-1) === false
      && sandbox.assess(NaN) === false;
  }
} catch (_) {}
check('P1295/R645 + P1296/R646 runtime uses fixed exact 12h age and rejects future, +1ms, and metadata overrides',
  strictLiveCoreAgeFixtures
  && /var _marketCycleFreshnessSlaHours = 12/.test(runtimeDataSource)
  && /_liveCoreFresh = _aioIsStrictLiveCoreFreshnessAge\(_serverAgeMs\)/.test(runtimeDataSource)
  && !/Number\(d\.meta\.marketCycleFreshnessSlaHours\)/.test(runtimeDataSource)
  && /const MARKET_CYCLE_FRESHNESS_SLA_MS = 12 \* 60 \* 60 \* 1000/.test(operationsStatusSource)
  && !/Number\(data\?\.meta\?\.marketCycleFreshnessSlaHours/.test(operationsStatusSource));
const legacyNewsSignalSource = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
const legacyNewsFacadeSource = read('src/legacy/compatibility-facade.js');
check('P1288/R638 legacy news aggregate and every action consumer require the shared sufficient-sample contract',
  /configuredMinNewsSample = Number\(window\.AIO_ARCH && window\.AIO_ARCH\.MIN_NEWS_ANALYSIS_SAMPLE\)/.test(legacyNewsSignalSource)
  && /if \(!minNewsSampleReady \|\| total < minNewsSample\)/.test(legacyNewsSignalSource)
  && /newsSignal\.sampleSufficient === true/.test(legacyNewsSignalSource)
  && /newsSignal\.sentimentScore === 'number' && Number\.isFinite\(newsSignal\.sentimentScore\)/.test(legacyNewsSignalSource)
  && /ns\.sampleSufficient === true && ns\.decisionEligible === true && Number\(ns\.total\) >= minNewsSample[\s\S]*?typeof ns\.sentimentScore === 'number' && Number\.isFinite\(ns\.sentimentScore\)/.test(legacyNewsSignalSource)
  && /sig\.sampleSufficient === true && Number\(sig\.total\) >= minNewsSample[\s\S]*?typeof sig\.sentimentScore === 'number' && Number\.isFinite\(sig\.sentimentScore\)/.test(legacyNewsSignalSource)
  && /MIN_NEWS_ANALYSIS_SAMPLE:\s*api\.MIN_NEWS_ANALYSIS_SAMPLE/.test(legacyNewsFacadeSource));
check('workflow governance doc exists', exists('_context/WORKFLOW-GOVERNANCE.md'));

// P1102: a producer whose artifact has no reader and no lineage policy is a
// latent CI trap — the first bot commit of the artifact fails the data group,
// which blocks attestation and therefore deployment. Keep the loop closed:
// producer wired to a workflow, artifact read by a client path, policy declared.
check('earnings calendar keeps producer, consumer and lineage policy aligned',
  /fetch-earnings-calendar\.mjs/.test(read('.github/workflows/refresh-screener.yml'))
  // P1133/R620: the earnings-calendar consumer moved with block D to js/aio-pages.js.
  && /public-data\/earnings-calendar\.json/.test(pagesSource)
  && /'earnings-calendar\.json'/.test(read('scripts/ci-data-lineage-audit.mjs')),
  'producer, consumer or lineage policy is missing');

// ── P1170 (15 D04): 관측 시각의 의미 계약 ────────────────────────────────────────────────────
// A provider's daily bar timestamp is the START of that session's bar, not the instant a
// close-derived factor was observable. Publishing the bar start under "observed" makes a
// close-based result look knowable at the open, so basis and session date are separate fields.
const barStartBasis = 'bar-start';
check('P1170 D04 a US bar start maps to its exchange-local session date', sessionDateInMarket('2026-09-18T13:30:00.000Z', 'US') === '2026-09-18', String(sessionDateInMarket('2026-09-18T13:30:00.000Z', 'US')));
check('P1170 D04 a KR bar start maps to its exchange-local session date', sessionDateInMarket('2026-09-18T00:00:00.000Z', 'KR') === '2026-09-18', String(sessionDateInMarket('2026-09-18T00:00:00.000Z', 'KR')));
check('P1170 D04 the session date follows DST rather than a fixed offset', sessionDateInMarket('2026-01-15T14:30:00.000Z', 'US') === '2026-01-15', String(sessionDateInMarket('2026-01-15T14:30:00.000Z', 'US')));
check('P1170 D04 one instant maps to different session dates per market', sessionDateInMarket('2026-09-19T00:00:00.000Z', 'KR') === '2026-09-19' && sessionDateInMarket('2026-09-19T00:00:00.000Z', 'US') === '2026-09-18', `${sessionDateInMarket('2026-09-19T00:00:00.000Z', 'KR')}/${sessionDateInMarket('2026-09-19T00:00:00.000Z', 'US')}`);
check('P1170 D04 a missing instant is not promoted to a precise timestamp', sessionDateInMarket(null, 'US') === null && sessionDateInMarket('', 'KR') === null && sessionDateInMarket('not-a-date', 'US') === null);
check('P1170 D04 market detection follows the listing suffix', marketOfSymbol('005930.KS') === 'KR' && marketOfSymbol('AAPL') === 'US' && timeZoneForMarket('KR') === 'Asia/Seoul');

const mixedScopes = factorScopesByMarket({
  AAPL: { factorBarStart: '2026-09-16T13:30:00.000Z', factorSessionDate: '2026-09-16' },
  MSFT: { factorBarStart: '2026-09-16T13:30:00.000Z', factorSessionDate: '2026-09-16' },
  '005930.KS': { factorBarStart: '2026-09-18T00:00:00.000Z', factorSessionDate: '2026-09-18' }
});
check('P1170 D04 mixed markets keep separate observation scopes', mixedScopes.US?.barStart === '2026-09-16T13:30:00.000Z' && mixedScopes.KR?.barStart === '2026-09-18T00:00:00.000Z', JSON.stringify(mixedScopes));
// 이 fixture에서 전역 max(KR 09-18)는 US의 최신성(09-16)을 2일 앞당겨 보고한다 — 전역 하나로는
// 개별 시장을 대표할 수 없다는 것이 이 단언의 요점이다.
check('P1170 D04 a global max does not stand in for per-market recency',
  mixedScopes.KR?.barStart !== mixedScopes.US?.barStart
  && mixedScopes.US?.sessionDate === '2026-09-16' && mixedScopes.KR?.sessionDate === '2026-09-18',
  JSON.stringify(mixedScopes));

const producerSource = readProducerSource();
for (const token of ['factorBarStart', 'factorSessionDate', 'factorSessionDateByMarket', 'factorBarStartByMarket', "factorTimeBasis: 'bar-start'", 'factorScopesByMarket', 'factorComputedAt']) {
  check(`P1170 D04 the factor producer publishes ${token}`, producerSource.includes(token));
}
const screenerPageSource = read('src/ui/pages/screener.js');
check('P1170 D04 the screener reads the session date instead of presenting the bar start as an observation',
  screenerPageSource.includes('factorSessionDate') && /관측시각 아님|관측시각이 아닙니다/.test(screenerPageSource));

const producedScreeners = JSON.parse(read('public-data/screener.json'));
const producedRows = Object.values(producedScreeners.data || {}).filter((row) => row && row.factorBarStart);
if (producedRows.length) {
  check('P1170 D04 produced rows carry a session date and an explicit bar-start basis',
    producedRows.every((row) => row.factorSessionDate && row.factorTimeBasis === barStartBasis && row.factorComputedAt),
    `${producedRows.length} rows`);
  check('P1170 D04 produced rows publish both the bar start and its session date',
    producedRows.every((row) => row.factorBarStart && row.factorSessionDate));
} else {
  console.log('[data-pipeline] factor rows do not carry the session contract yet; the next fetch-data run writes it.');
}

// ── R24-03/P1184: 품질 라벨은 타임스탬프 존재가 아니라 신선도 판정이다 ─────────────────────
// producer가 observedAt 존재만으로 CURRENT를 발행하면 provider가 오래된 마지막 봉을 돌려준
// 날에도 artifact에 CURRENT가 남는다(소비측 factor-ranks는 같은 행을 4일 경과로 차단한다).
// 라벨과 소비 판정이 같은 예산을 쓰는지 여기서 직접 확인한다.
{
  const computedAt = '2026-09-20T00:00:00.000Z';
  const fresh = deriveFactorQuality({ observedAt: '2026-09-19T13:30:00.000Z', computedAt });
  const weekend = deriveFactorQuality({ observedAt: '2026-09-16T13:30:00.000Z', computedAt });
  const old = deriveFactorQuality({ observedAt: '2026-09-01T13:30:00.000Z', computedAt });
  const missing = deriveFactorQuality({ observedAt: null, computedAt });
  const future = deriveFactorQuality({ observedAt: '2026-09-21T13:30:00.000Z', computedAt });
  check('P1184 a fresh factor observation is CURRENT', fresh.status === 'CURRENT' && fresh.stale === false, JSON.stringify(fresh));
  check('P1184 an observation inside the shared budget survives a weekend', weekend.status === 'CURRENT' && weekend.stale === false, JSON.stringify(weekend));
  check('P1184 an observation older than the shared budget is STALE, not CURRENT', old.status === 'STALE' && old.stale === true && old.ageMs > FACTOR_FRESHNESS_MS, JSON.stringify(old));
  check('P1184 a missing observation time is MISSING and stale', missing.status === 'MISSING' && missing.stale === true && missing.ageMs === null, JSON.stringify(missing));
  check('P1184 a future observation time is never CURRENT', future.status !== 'CURRENT', JSON.stringify(future));
  check('P1184 the producer publishes the judged quality instead of a timestamp-existence ternary',
    producerSource.includes('deriveFactorQuality(') && !/observedAt \? 'CURRENT' : 'MISSING'/.test(producerSource));
  check('P1184 producer and consumer share one freshness budget',
    producerSource.includes('FACTOR_FRESHNESS_MS') && read('src/domain/screener/factor-ranks.js').includes('export const FACTOR_FRESHNESS_MS'));
}

// ── R24-03 (15 D04): producer → provider → normalizer → UI 전달 불변 ────────────────────
// P1170이 producer에 필드를 만들었지만 provider 행 빌더·metadata 재구성·normalizer 화이트리스트가
// 첫 소실 지점이었다. UI가 읽는 metadata.factorSessionDate는 어느 계층에도 없어 바 시작 날짜로
// 폴백했다. 이 fixture는 필드가 실제로 흐르는지 데이터가 아닌 경로 자체에 단언한다.
const screenerProviderSource = read('src/data/providers/screener.js');
for (const token of ['factorBarStart', 'factorSessionDate', 'factorSessionTimezone', 'factorTimeBasis', 'factorComputedAt', 'factorSessionDateByMarket']) {
  check(`R24-03/P1179 the screener provider forwards ${token}`, screenerProviderSource.includes(token), 'field is dropped before consumers');
}
{
  const { normalizeScreener } = await import('../src/data/normalize/screener.js');
  const producerRow = {
    sym: 'NVDA',
    factorObservedAt: '2026-09-18T13:30:00.000Z',
    factorBarStart: '2026-09-18T13:30:00.000Z',
    factorSessionDate: '2026-09-18',
    factorSessionTimezone: 'America/New_York',
    factorTimeBasis: barStartBasis,
    factorComputedAt: '2026-09-20T01:02:03.000Z',
    factorQuality: { status: 'CURRENT' }
  };
  const normalized = normalizeScreener({ rows: [producerRow] }).rows[0];
  check('R24-03/P1179 the normalizer whitelist forwards factorBarStart',
    normalized?.factorBarStart === producerRow.factorBarStart, String(normalized?.factorBarStart));
  check('R24-03/P1179 the normalizer whitelist forwards factorSessionDate',
    normalized?.factorSessionDate === producerRow.factorSessionDate, String(normalized?.factorSessionDate));
  check('R24-03/P1179 the normalizer whitelist forwards factorSessionTimezone',
    normalized?.factorSessionTimezone === producerRow.factorSessionTimezone, String(normalized?.factorSessionTimezone));
  check('R24-03/P1179 the normalizer whitelist forwards factorTimeBasis',
    normalized?.factorTimeBasis === producerRow.factorTimeBasis, String(normalized?.factorTimeBasis));
  check('R24-03/P1179 the normalizer whitelist forwards factorComputedAt',
    normalized?.factorComputedAt === producerRow.factorComputedAt, String(normalized?.factorComputedAt));
}
{
  const runtimeReadersSource = read('src/data/runtime-readers.js');
  check('R24-03/P1179 the runtime reader publishes the observation basis beside the bar-start timestamp',
    (runtimeReadersSource.match(/observedAtBasis/g) || []).length >= 2);
}

// P1731/P1732/P1733: official FOMC page, FRED-derived policy range and ISM rule dates (fixtures only, no network).
{
  const row = (month, date) => `<div class="row fomc-meeting"><div class="fomc-meeting__month col-xs-5"><strong>${month}</strong></div><div class="fomc-meeting__date col-xs-4">${date}</div></div>`;
  const panel = (year, rows) => `<div class="panel"><div class="panel-heading"><h4><a id="${year}">${year} FOMC Meetings</a></h4></div>${rows.map(([m, d]) => row(m, d)).join('')}<div class="panel-footer">* Meeting associated with a Summary of Economic Projections.</div></div>`;
  const y2026 = [['January', '27-28'], ['March', '17-18*'], ['April', '28-29'], ['June', '16-17*'], ['July', '28-29'], ['August', '22 (notation vote)'], ['September', '15-16*'], ['Oct/Nov', '31-1'], ['December', '8-9*']];
  const y2027 = [['January', '26-27'], ['March', '16-17*'], ['April', '27-28'], ['June', '8-9*'], ['July', '27-28'], ['September', '14-15*'], ['October', '26-27'], ['December', '7-8*']];
  const html = panel(2026, y2026) + panel(2027, y2027) + panel(2025, y2026.slice(0, 3));
  const now = Date.parse('2026-10-13T09:00:00Z');
  const parsed = parseFomcCalendarHtml(html);
  const selected = selectFomcMeetings(parsed, now);
  const fomc2026 = selected.events.filter((event) => event.date.startsWith('2026-'));
  check('P1731 FOMC parser reads decision days, cross-month meetings and SEP marks from the official layout',
    selected.ok && fomc2026.length === 8 && fomc2026.filter((event) => event.sep).length === 4
      && fomc2026.some((event) => event.startDate === '2026-10-31' && event.date === '2026-11-01')
      && fomc2026.every((event) => event.source === 'fed-official' && typeof event.sep === 'boolean')
      && parsed.skipped.some((item) => /notation vote/.test(item.text)), JSON.stringify(selected));
  check('P1731 FOMC parser fails closed on an abnormal meeting count (current or posted next year)',
    !selectFomcMeetings(parseFomcCalendarHtml(panel(2026, y2026.slice(0, 6))), now).ok
      && !selectFomcMeetings(parseFomcCalendarHtml(panel(2026, y2026) + panel(2027, y2027.slice(0, 7))), now).ok
      && selectFomcMeetings(parseFomcCalendarHtml(panel(2026, y2026)), now).ok);
  const memory = new Map();
  let fetches = 0;
  const io = (text) => ({
    fetchFn: async () => ({ release_dates: [{ date: '2026-11-10' }] }),
    fetchTextFn: async () => { fetches += 1; if (text instanceof Error) throw text; return text; },
    readFn: async () => { if (!memory.has('out')) throw new Error('missing'); return memory.get('out'); },
    writeFn: async (_path, body) => { memory.set('out', body); }
  });
  await writeMacroCalendar('fixture-key', { ...io(html), nowMs: now });
  const first = JSON.parse(memory.get('out') || '{}');
  await writeMacroCalendar('fixture-key', { ...io(html), nowMs: now + FOMC_RECHECK_MS - 60000 });
  const fetchesWithinGate = fetches;
  await writeMacroCalendar('fixture-key', { ...io(new Error('HTTP 503')), nowMs: now + FOMC_RECHECK_MS + 60000 });
  const failed = JSON.parse(memory.get('out') || '{}');
  check('P1731 macro-calendar publishes FOMC schedule + provenance and keeps the consumer schedules contract',
    first.schemaVersion === 'macro-calendar.v1' && first.meta?.fomcStatus === 'ok' && first.meta?.fomcFetchedAt === new Date(now).toISOString()
      && first.schedules?.['us-fomc']?.includes('2026-12-09') && first.schedules?.['us-fed-rate']?.join() === first.schedules?.['us-fomc']?.join()
      && first.events?.filter((event) => event.source === 'fed-official').length === 16, JSON.stringify(first.meta));
  check('P1731 the FOMC page is rechecked only after 12 hours', fetches === 2 && fetchesWithinGate === 1, String(fetches));
  check('P1731 a failed FOMC refresh keeps the previous official dates and names the reason',
    failed.meta?.fomcStatus === 'stale' && /HTTP 503/.test(failed.meta?.fomcReason || '') && failed.meta?.fomcFetchedAt === first.meta?.fomcFetchedAt
      && failed.schedules?.['us-fomc']?.join() === first.schedules?.['us-fomc']?.join() && failed.status === 'partial', JSON.stringify(failed.meta));
  memory.clear();
  await writeMacroCalendar(undefined, { ...io(new Error('HTTP 503')), nowMs: now });
  const coldFail = JSON.parse(memory.get('out') || '{}');
  check('P1731 with no previous parse a failed FOMC refresh publishes no FOMC dates',
    coldFail.meta?.fomcStatus === 'unavailable' && !coldFail.schedules?.['us-fomc'] && Array.isArray(coldFail.schedules?.['us-ism-mfg']), JSON.stringify(coldFail.meta));
  const ism = buildIsmRuleEvents({ fromMs: Date.parse('2026-01-01T00:00:00Z'), toMs: Date.parse('2027-01-31T00:00:00Z') });
  const ismDate = (id, month) => ism.find((event) => event.calendarId === id && event.date.startsWith(month))?.date;
  check('P1733 ISM rule dates: 1st/3rd business day, January 2nd/4th, federal holidays skipped, rule-labelled',
    ismDate('us-ism-mfg', '2026-01') === '2026-01-05' && ismDate('us-ism-svc', '2026-01') === '2026-01-07'
      && ismDate('us-ism-svc', '2026-07') === '2026-07-06' && ismDate('us-ism-mfg', '2026-09') === '2026-09-01'
      && ismDate('us-ism-svc', '2026-10') === '2026-10-05' && ismDate('us-ism-mfg', '2026-11') === '2026-11-02'
      && ismDate('us-ism-mfg', '2027-01') === '2027-01-05' && ism.every((event) => event.source === 'ism-rule' && /^\d{4}-\d{2}$/.test(event.referenceMonth)),
    JSON.stringify(ism.slice(0, 4)));
  const fed = (overrides) => deriveFedPolicyRate({ fedTargetLower: 3.75, fedTargetUpper: 4, _asOf_fedTargetLower: '2026-10-12', _asOf_fedTargetUpper: '2026-10-12', ...overrides }, now);
  check('P1732 policyRates.fed is current only for a same-date, 25bp, recent FRED range',
    fed({}).status === 'current' && fed({}).lower === 3.75 && fed({}).upper === 4 && fed({}).asOf === '2026-10-12' && fed({}).source === 'FRED DFEDTARL/DFEDTARU'
      && fed({ _asOf_fedTargetUpper: '2026-10-11' }).status === 'stale' && fed({ fedTargetUpper: 4.25 }).status === 'stale'
      && fed({ _asOf_fedTargetLower: '2026-10-01', _asOf_fedTargetUpper: '2026-10-01' }).status === 'stale'
      && fed({ fedTargetLower: null }).status === 'stale');
  check('P1732 the producer publishes data.policyRates.fed from the merged macro block',
    /policyRates: \{ fed: deriveFedPolicyRate\(macro, Date\.parse\(attemptedAt\)\) \}/.test(readProducerSource()));
}

// P1757 (owner decision 2026-10-14): weekend cadence + producer-only SEC ledger.
{
  const { decideRefreshCadence, marketQuietWindow, WEEKEND_NEWS_INTERVAL_MIN, WEEKEND_NEWS_DUE_MIN } = await import('./refresh-cadence.mjs');
  const cron = (iso, lastNewsAt = null) => decideRefreshCadence({ nowMs: Date.parse(iso), eventName: 'schedule', schedule: '17,47 * * * *', lastNewsAt });
  // EDT: Fri 2026-10-16 close 20:00Z (Sat 05:00 KST) is final at 21:00Z (Sat 06:00 KST); Mon 07:00 KST = Sun 22:00Z.
  check('P1757 weekend window opens at Sat 06:00 KST (Friday US close + 60 min) and closes at Mon 07:00 KST under EDT',
    cron('2026-10-16T20:59:00Z').mode === 'full' && cron('2026-10-16T21:00:00Z').mode === 'news'
      && cron('2026-10-18T21:59:00Z').mode === 'news' && cron('2026-10-18T22:00:00Z').mode === 'full',
    JSON.stringify([cron('2026-10-16T20:59:00Z'), cron('2026-10-16T21:00:00Z'), cron('2026-10-18T22:00:00Z')].map((row) => row.reason)));
  check('P1757 the window follows the registered calendar: EST shifts the start to 07:00 KST, a half day moves it earlier, an unregistered year fails open',
    cron('2026-11-13T21:59:00Z').mode === 'full' && cron('2026-11-13T22:00:00Z').mode === 'news'
      && cron('2026-11-27T19:00:00Z').mode === 'news' && cron('2026-11-27T18:59:00Z').mode === 'full'
      && cron('2027-12-31T23:00:00Z').mode === 'full' && /calendar-unregistered/.test(cron('2027-12-31T23:00:00Z').reason));
  check('P1757 a weekday holiday is never quiet (futures, FX and the other market still print)',
    marketQuietWindow(Date.parse('2026-10-09T03:00:00Z')).quiet === false && marketQuietWindow(Date.parse('2026-11-26T15:00:00Z')).quiet === false);
  // v57.54: weekend news hourly (was 2 hours) — weekend policy/geopolitical news lands while both markets are closed.
  check('P1757 weekend news runs about every hour: skip below the due age, news at or past it or when the clock is unknown',
    cron('2026-10-17T12:00:00Z', '2026-10-17T11:30:00Z').mode === 'skip'
      && cron('2026-10-17T12:00:00Z', new Date(Date.parse('2026-10-17T12:00:00Z') - WEEKEND_NEWS_DUE_MIN * 60000).toISOString()).mode === 'news'
      && cron('2026-10-17T12:00:00Z', null).mode === 'news' && WEEKEND_NEWS_DUE_MIN < WEEKEND_NEWS_INTERVAL_MIN && WEEKEND_NEWS_INTERVAL_MIN <= 60);
  check('P1757 operator dispatch and the daily cron are always full; a Worker scheduler dispatch follows the weekend rule',
    decideRefreshCadence({ nowMs: Date.parse('2026-10-17T12:00:00Z'), eventName: 'workflow_dispatch', trigger: 'operator', lastNewsAt: '2026-10-17T11:55:00Z' }).mode === 'full'
      && decideRefreshCadence({ nowMs: Date.parse('2026-10-17T12:00:00Z'), eventName: 'workflow_dispatch', trigger: '', lastNewsAt: '2026-10-17T11:55:00Z' }).mode === 'full'
      && decideRefreshCadence({ nowMs: Date.parse('2026-10-17T07:33:00Z'), eventName: 'schedule', schedule: '33 7 * * *', lastNewsAt: '2026-10-17T07:30:00Z' }).mode === 'full'
      && decideRefreshCadence({ nowMs: Date.parse('2026-10-17T12:00:00Z'), eventName: 'workflow_dispatch', trigger: 'scheduler', lastNewsAt: '2026-10-17T11:55:00Z' }).mode === 'skip');
  // Freshness consumers of the weekend gap: every live-age threshold must exceed the news interval plus one missed slot.
  const lineageSource = read('scripts/ci-data-lineage-audit.mjs');
  const dataMaxAgeHours = Number(lineageSource.match(/'data\.json': \{[^}]*maxAgeHours: (\d+)/)?.[1]);
  const telegramMaxAgeHours = Number(lineageSource.match(/'telegram-digest\.json': \{[^}]*maxAgeHours: (\d+)/)?.[1]);
  const watchdogMaxAgeMin = Number(watchdog.match(/default:\s*'(\d+)'/)?.[1]);
  const worstWeekendGapMin = WEEKEND_NEWS_INTERVAL_MIN + 60;
  check('P1757 weekend publish gap stays inside every live freshness threshold (lineage data/telegram, watchdog live age, refresh-audit A1 12h SLA)',
    worstWeekendGapMin < dataMaxAgeHours * 60 && worstWeekendGapMin < telegramMaxAgeHours * 60 && worstWeekendGapMin < watchdogMaxAgeMin
      && /SLA=12h/.test(read('scripts/ci-data-refresh-audit.mjs')),
    'gap=' + worstWeekendGapMin + 'm data=' + dataMaxAgeHours + 'h telegram=' + telegramMaxAgeHours + 'h watchdog=' + watchdogMaxAgeMin + 'm');
  const cadenceJob = refresh.match(/\n  cadence:\n[\s\S]*?(?=\n  refresh:\n)/)?.[0] || '';
  const refreshJobHead = refresh.match(/\n  refresh:\n[\s\S]*?\n    steps:/)?.[0] || '';
  const convergeJobHead = refresh.match(/\n  converge:\n[\s\S]*?\n    steps:/)?.[0] || '';
  check('P1757 refresh-data decides cadence in a sparse, read-only job before the producer, and fails open to full',
    /node scripts\/refresh-cadence\.mjs --github-output/.test(cadenceJob) && /sparse-checkout:/.test(cadenceJob)
      && ['scripts/refresh-cadence.mjs', 'src/domain/market/market-calendar.js', 'public-data/data.json'].every((file) => cadenceJob.includes(file))
      && !/npm ci|setup-node/.test(cadenceJob) && /contents:\s*read/.test(cadenceJob) && !/\n    if:/.test(cadenceJob)
      && /needs: cadence/.test(refreshJobHead) && /if: \$\{\{ !cancelled\(\) && needs\.cadence\.outputs\.mode != 'skip' \}\}/.test(refreshJobHead)
      && /needs: \[cadence, refresh\]/.test(convergeJobHead) && /needs\.cadence\.outputs\.mode != 'skip'/.test(convergeJobHead)
      && /EVENT_SCHEDULE: \$\{\{ github\.event\.schedule \}\}/.test(cadenceJob) && /DISPATCH_TRIGGER: \$\{\{ inputs\.trigger \}\}/.test(cadenceJob));
  const commitStep = screenerRefresh.match(/- name: Commit only validated screener artifacts[\s\S]*?(?=\n      - name: )/)?.[0] || '';
  check('P1757 the SEC ledger is restored before the producer and published to the data-store branch before main is pushed',
    screenerRefresh.indexOf('sec-fundamentals-store.mjs restore') > 0
      && screenerRefresh.indexOf('sec-fundamentals-store.mjs restore') < screenerRefresh.indexOf('node scripts/fetch-sec-fundamentals.mjs')
      && /SEC_FULL_REBUILD/.test(screenerRefresh)
      && screenerRefresh.indexOf('sec-fundamentals-store.mjs guard') > screenerRefresh.indexOf('node scripts/fetch-sec-fundamentals.mjs')
      && screenerRefresh.indexOf('sec-fundamentals-store.mjs guard') < screenerRefresh.indexOf('node scripts/build-sec-runtime-projection.mjs')
      && commitStep.indexOf('sec-fundamentals-store.mjs publish') > 0 && commitStep.indexOf('sec-fundamentals-store.mjs publish') < commitStep.indexOf('git commit -m')
      && commitStep.indexOf('sec-fundamentals-store.mjs publish') < commitStep.indexOf('until git push'));
  check('P1757 neither producer stages the SEC ledger on main, it is gitignored, and Pages still excludes it',
    [refresh, screenerRefresh].every((workflow) => !/git add[^\n]*public-data\/sec-fundamentals\.json/.test(workflow) && !/stage_if_exists public-data\/sec-fundamentals\.json/.test(workflow) && !/"\$staged" = "public-data\/sec-fundamentals\.json"/.test(workflow))
      && /^\/?public-data\/sec-fundamentals\.json$/m.test(read('.gitignore'))
      && /--exclude 'sec-fundamentals\.json'/.test(read('.github/workflows/pages-deploy.yml')));
  check('P1757 CI restores the ledger only when its digest matches the checkout manifest, and gates degrade with a labelled skip otherwise',
    /sec-fundamentals-store\.mjs restore --match-manifest/.test(ci)
      && ['scripts/ci-sec-runtime-projection-check.mjs', 'scripts/ci-professional-data-gap-check.mjs'].every((file) => /readSecLedger/.test(read(file)) && /secLedgerSkipNote\(.*, ledger\)\)/.test(read(file)))
      // v57.65: a git-ignored local ledger whose digest differs from the manifest is stale and reads as absent.
      && /digest !== expected\) return \{ present: false, stale: true/.test(read('scripts/lib/sec-ledger.mjs'))
      && /fullRebuild/.test(read('scripts/fetch-sec-fundamentals.mjs')) && /GITHUB_ACTIONS === 'true' && !fullRebuild/.test(read('scripts/fetch-sec-fundamentals.mjs')));
}

if (errors.length) {
  console.error('Data pipeline contract check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  process.exit(1);
}

console.log('Data pipeline contract check OK: Actions -> public-data -> runtime audit -> chat/memo consumers are structurally wired.');
