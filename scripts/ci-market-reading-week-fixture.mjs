// v60.18 (weekly audit 2026-11-15, _artifacts/weekly-audit-20261115/content-reflection.md D2-D4, D9, D10): the AI market
// reading's defects of the week 11/9-11/15, replayed on the inputs those runs published (scripts/fixtures/
// market-analysis-week-20261115.json, trimmed from public-data at each commit). No model call and no file outside the
// fixture is read; the model's answers are stubs.
//
//   outage    be745561b 11/10 14:51Z — provider HTTP 429 (CPI day). The 12:51Z reading had been kept twice; once the US
//             session opened, SOXX turned in-session and its "반도체(SOXX) 종가 +7.49%" failed session-wording-mismatch,
//             so 25 runs showed figures only under "자동 검증을 통과하지 못해".
//   inSession 31f8184 11/11 19:51Z — S&P 500 +1.44% in session; only WTI could reach the current-session slot.
//   lead      8006cca6b 11/14 07:21Z — the 10-year rose 29bp in five sessions; the list had no 10-year, the reading opened
//             on SOXX and published "…+9.35%였으며, 이는입니다.".
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as va from './lib/market-analysis-validate.mjs';
import * as moves from './lib/market-analysis-moves.mjs';
import { genMarketAnalysis, marketDriversContext, priorSessionMoveLines, MARKET_ANALYSIS_REJECTIONS_OUT } from './producer/market-narrative.mjs';
import { buildMarketDay } from '../src/domain/market/day/facts.js';
import * as rejections from './lib/market-analysis-rejections.mjs';
import { DATA_PUBLISH_SETS } from './lib/data-publish-sets.mjs';
import { PAGES_DATA_EXCLUDES } from './lib/pages-bundle-config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fx = JSON.parse(readFileSync(join(root, 'scripts/fixtures/market-analysis-week-20261115.json'), 'utf8'));
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${String(detail).slice(0, 900)}` : ''}`); };
const changesOf = (snapshot) => new Map(va.snapshotEvidenceRows(snapshot).filter((row) => row?.evidenceId && row.changePct != null).map((row) => [row.evidenceId, Number(row.changePct)]));
const quiet = async (run) => { const { warn, log } = console; console.warn = () => {}; console.log = () => {}; try { return await run(); } finally { console.warn = warn; console.log = log; } };
// A section that throws (a rule or export that does not exist yet) is a failure of that section, not of the whole gate.
const section = async (name, body) => { try { await body(); } catch (error) { failures.push(`${name}: threw ${String(error?.message || error).slice(0, 300)}`); } };

// D2 / most frequent block: SOXX's completed close is a basis while it trades in session.
await section('D2 outage', async () => {
  const { data, snapshot, history, previous } = fx.outage;
  const evidence = va.buildMarketAnalysisEvidence(data, { snapshot });
  const semis = evidence.find((row) => row.metricId === 'market.semis');
  const basis = va.buildCompletedCloseBasis(evidence, history).get(semis?.evidenceId);
  const issues = va.validateMarketAnalysisText('미국 11/9 반도체(SOXX) 종가 +7.49%였습니다.', data, snapshot, { history }).issues;
  check('v60.18 an in-session SOXX row accepts its last completed close (11/9 +7.49%), so the prompt\'s own close line is not session-wording-mismatch',
    semis && !va.MARKET_ANALYSIS_CLOSED_SESSIONS.includes(semis.session) && basis?.sessionDate === '2026-11-09' && Math.abs(basis.changePct - 7.49) < 0.01
      && !issues.some((issue) => /market\.semis/.test(issue)), JSON.stringify({ session: semis?.session, basis, issues }));
  // D2: the provider outage keeps the 12:51Z reading, dated, instead of figures only.
  const nowMs = Date.parse(fx.outage.nowMs);
  const revalidate = (summary) => va.validateMarketAnalysisText(summary, data, snapshot, { history });
  const kept = va.retainVerifiedMarketAnalysis(previous, { reason: 'provider-http-429', nowMs, revalidate });
  check('v60.18 on 11/10 14:51Z (HTTP 429) the 12:51Z verified reading is kept with its own time (it was dropped for a session-wording rule)',
    kept?.status === 'verified' && kept.retained?.from === '2026-11-10T12:51:44.043Z' && kept.retained.reason === 'provider-http-429',
    JSON.stringify(va.retainedReadingIssues(previous, revalidate(previous.full))));
  // A reading the new data contradict is still not kept: the same reading after a large S&P 500 move.
  const crashed = { ...snapshot, quotes: snapshot.quotes.map((row) => row.instrumentId === '^GSPC' ? { ...row, evidenceId: 'market.index.spx:crash', value: row.value * 0.96, changePct: -4.6 } : row) };
  const crashedIssues = va.retainedReadingIssues(previous, va.validateMarketAnalysisText(previous.full, data, crashed, { history }));
  check('v60.18 a retained reading is still dropped when this run\'s data contradict it (S&P 500 down 4% since, a reading that never quoted it)',
    crashedIssues.includes('market-moved-since-reading:market.spx')
      && va.retainVerifiedMarketAnalysis(previous, { reason: 'provider-http-429', nowMs, revalidate: (summary) => va.validateMarketAnalysisText(summary, data, crashed, { history }) }) === null, JSON.stringify(crashedIssues));
  // The producer: a 429 answer and a thrown timeout both keep it; the fallback says the provider did not answer. The runs
  // get no history, so the producer builds no packet context from the working tree's public-data (hermetic); the
  // completed-close rules are checked above with the history.
  const run = (request, prev = previous) => quiet(() => genMarketAnalysis(data, snapshot, { previous: prev, request, nowMs, history: [], narrative: { text: '', signature: 'fixture', themes: [] }, earnings: null, eventBriefs: null, bigtechCashflow: null, recordRejections: null }));
  const answered429 = await run(async () => ({ text: null, reason: 'provider-http-429' }));
  const timedOut = await run(async () => { const error = new Error('timeout'); error.name = 'AbortError'; throw error; });
  const noReading = await run(async () => ({ text: null, reason: 'provider-http-429' }), null);
  check('v60.18 the producer keeps the verified reading on a 429 and on a thrown timeout; without one, the fallback names the provider, not the validator',
    answered429?.status === 'verified' && answered429.retained?.from === previous.generatedAt
      && timedOut?.status === 'verified' && timedOut.retained?.reason === 'provider-timeout'
      && noReading?.status === 'blocked' && /AI 해석 제공처가 응답하지 않아/.test(noReading.summary) && !/검증을 통과하지 못해/.test(noReading.summary),
    JSON.stringify({ a: [answered429?.status, answered429?.reason], t: [timedOut?.status, timedOut?.reason], n: noReading?.summary }));
  const ev = va.buildMarketAnalysisEvidence(data, { snapshot });
  check('v60.18 the fallback wording follows the cause: a validator block says so, a provider failure does not, a contradicted earlier reading is named with its time',
    /자동 검증을 통과하지 못해/.test(va.plainMarketFallbackSummary(ev, { reason: 'axis-state-contradiction:credit' }))
      && /AI 해석 제공처가 응답하지 않아/.test(va.plainMarketFallbackSummary(ev, { reason: 'provider-timeout' }))
      && /11\/10 21:51 KST에 검증된 해석은 그 뒤 지표가 바뀌어/.test(va.plainMarketFallbackSummary(ev, { reason: 'provider-http-429', lastVerifiedAt: previous.generatedAt })));
});

// The client notice names the cause the producer published (meta.marketAnalysisBlockCause) — on 11/10 the 429 runs read
// '운영자의 공용 AI 연결 설정 후…', a setup step, whenever the reading was missing.
await section('block-cause notice', async () => {
  const { pipelineNotices } = await import('../src/data/pipeline-notices.js');
  const noticeOf = (reason) => {
    const meta = { marketCyclePublished: true, fredHasKey: true, reconciliation: { status: 'ok' }, marketAnalysisOk: false, marketAnalysisReason: reason, marketAnalysisBlockCause: va.marketAnalysisBlockCause(reason) };
    return (pipelineNotices(meta) || []).find((row) => /AI 시장 분석/.test(row.text));
  };
  const provider = noticeOf('provider-http-429'), validation = noticeOf('axis-state-contradiction:volatility'), unset = noticeOf('shared-ai-not-configured');
  check('v60.18 the AI notice says provider outage, validation block and not-configured in three different sentences, none a setup step unless unset',
    provider && validation && unset && new Set([provider.detail, validation.detail, unset.detail]).size === 3
      && /응답하지 않았/.test(provider.detail) && /검증/.test(validation.detail) && /설정되지 않았/.test(unset.detail)
      && ![provider.detail, validation.detail].some((text) => /설정/.test(text)), JSON.stringify({ provider, validation, unset }));
  const { buildServerDataMeta } = await import('../src/data/server-data.js');
  const carried = buildServerDataMeta({ meta: { generatedAt: '2026-11-15T05:25:00Z', marketAnalysisOk: false, marketAnalysisBlockCause: 'provider' } }, { now: Date.parse('2026-11-15T05:30:00Z') });
  check('v60.18 the server meta carries marketAnalysisBlockCause to the client', carried.marketAnalysisBlockCause === 'provider', JSON.stringify(carried.marketAnalysisBlockCause));
});

// D3: the current-session slot carries every declared in-session metric that reaches its materiality; the S&P 500 always.
await section('D3 in-session', async () => {
  const { data, snapshot, history } = fx.inSession;
  const evidence = va.buildMarketAnalysisEvidence(data, { snapshot });
  const rows = moves.inSessionMoves(evidence, changesOf(snapshot), history, { closedSessions: va.MARKET_ANALYSIS_CLOSED_SESSIONS });
  const drivers = marketDriversContext({ history, intradayRows: rows });
  const live = drivers.match(/^- LIVE_MOVE[^\n]*/m)?.[0] || '';
  check('v60.18 on 11/11 19:51Z the LIVE_MOVE slot carries the S&P 500 +1.44% (and SOXX +6.80%) in session, not WTI alone',
    /S&P 500 장중 \d\d:\d\d KST 기준 \+1\.44%/.test(live) && /반도체\(SOXX\) 장중 \d\d:\d\d KST 기준 \+6\.80%/.test(live), live);
});

// D3 (slot labels) and the direction rule.
await section('D3 slots', async () => {
  const drivers = marketDriversContext({ history: fx.lead.history });
  const { data, snapshot, history } = fx.outage;
  const issuesOf = (text) => va.validateMarketAnalysisText(text, data, snapshot, { history }).issues;
  check('v60.18 MARKET_DRIVERS slots are ids, not the Korean words the model copied; an id left in the text blocks',
    /^- CLOSE_MOVE /m.test(drivers) && /^- LIVE_MOVE /m.test(drivers) && /^- NEXT_CHECK /m.test(drivers) && !/^- (?:압력|지금|확인·반증):/m.test(drivers)
      && issuesOf('CLOSE_MOVE: 반도체(SOXX) 11/9 종가 +7.49%였습니다.').includes('prompt-label-leak'), drivers.slice(0, 400));
  const recorded = issuesOf('압력: 반도체(SOXX)는 11/9 종가 +7.49%였지만 5거래일 -2.95%였습니다.'); // 9b0d25ee4, the week's largest up day
  check('v60.18 a direction word that contradicts the sign of its move blocks ("압력: 반도체(SOXX) … +7.49%", "+7.49%로 하락"); a matching one does not',
    recorded.includes('direction-sign-contradiction:market.semis')
      && issuesOf('미국 11/9 반도체(SOXX) 종가 +7.49%로 하락했습니다.').includes('direction-sign-contradiction:market.semis')
      && !issuesOf('미국 11/9 반도체(SOXX) 종가 +7.49%로 급등했습니다.').some((issue) => issue.startsWith('direction-sign'))
      && !issuesOf('11/9 WTI 종가 -4.38%로 반등과 유가 하락이 두드러졌습니다.').some((issue) => issue.startsWith('direction-sign')), JSON.stringify(recorded));
});

// D4 / D6: the 10-year, gold and the dollar are declared; multi-session moves qualify; the lead is the largest move.
await section('D4/D6 lead', async () => {
  const { history, published } = fx.lead;
  const line = priorSessionMoveLines(history);
  const context = line;
  const opening = published.split('\n').slice(0, 2).join('\n'); // as published: SOXX first
  const rewritten = `미국 10년물 금리는 11/13 종가 +5.0bp로 5거래일 +29.0bp 올랐습니다.\n${published.split('\n').slice(1).join('\n')}`;
  check('v60.18 on 11/14 the completed-close list opens with the 10-year (+29bp in five sessions) and the reading must open with it',
    /^직전 완료 세션의 큰 움직임: 미국 10년물 금리 11\/13 종가 \+5\.0bp \(5거래일 \+29\.0bp\) · 반도체\(SOXX\) 11\/13 종가 -3\.67%/.test(line)
      && va.priorSessionMoveIssues(opening, { context }).includes('prior-session-move-omitted') && !va.priorSessionMoveIssues(rewritten, { context }).length, line);
  check('v60.18 the registry declares the 10-year, gold and the dollar, sized against their own volatility',
    ['tnx', 'gold', 'dxy'].every((field) => moves.MARKET_MOVE_METRICS.some((entry) => entry.field === field))
      && moves.completedSessionMove(history, moves.MARKET_MOVE_METRICS.find((entry) => entry.field === 'tnx'))?.size > 0);
  // One scale: on every session of the week the reading sizes each declared metric exactly as the market-day ledger does.
  const declared = new Set(moves.MARKET_MOVE_METRICS.map((entry) => entry.field));
  const disagree = [];
  for (const day of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) {
    const through = history.filter((row) => String(row.date) <= day);
    const ours = new Map(moves.MARKET_MOVE_METRICS.map((entry) => moves.completedSessionMove(through, entry)).filter((move) => move?.points != null).map((move) => [move.field, move.points]));
    const ledger = new Map(buildMarketDay({ history: through, nowMs: Date.parse(`${day}T23:00:00Z`) }).facts.filter((fact) => fact.kind === 'price' && declared.has(fact.asset)).map((fact) => [fact.asset, fact.weight]));
    for (const field of new Set([...ours.keys(), ...ledger.keys()])) if (ours.get(field) !== ledger.get(field)) disagree.push(`${day} ${field} ${ours.get(field)}/${ledger.get(field)}`);
  }
  check('v60.18 the reading and the market-day ledger give every declared metric the same materiality on 11/9-11/13 (one priceMove scale)', !disagree.length, disagree.join('; '));
  // v60.19 (Codex numbers audit): what a price explains. On 11/11 the ledger raised the chip index (own 46) to 65 for the
  // chip groups it drove (photonics 81 × the driver share); given that ledger, the reading's list opens with SOXX, not the
  // dollar's z 2.11. Without a ledger (this fixture's history only) the order is the volatility order above.
  const through11 = history.filter((row) => String(row.date) <= '2026-11-11');
  const plain = moves.completedSessionMoves(through11).map((move) => move.field);
  const ledger11 = { facts: [{ kind: 'price', id: 'price:soxx:2026-11-11', materiality: 65, explains: { id: 'group:theme:photonics:2026-11-11', basis: 'driver', points: 81, own: 46 } }] };
  const withLedger = moves.completedSessionMoves(through11, { ledger: ledger11 });
  check('v60.19 [11/11] given the ledger\'s driver-raised points the reading opens with SOXX; the raise only reorders lines that qualify',
    plain[0] === 'dxy' && withLedger[0]?.field === 'soxx' && withLedger[0].explainedPoints === 65 && withLedger.length === plain.length
      && moves.completedSessionMoves(through11, { ledger: { facts: [{ kind: 'price', id: 'price:kospi:2026-11-11', materiality: 99, explains: {} }] } }).every((move) => move.field !== 'kospi' || plain.includes('kospi')),
    JSON.stringify({ plain, withLedger: withLedger.map((move) => [move.field, move.score]) }));
});

// D9: what is published (citations removed) must be well formed, on the first pass and after salvage.
await section('D9 published form', async () => {
  const { data, snapshot, history } = fx.outage;
  const issuesOf = (text) => va.validateMarketAnalysisText(text, data, snapshot, { history }).issues;
  const broken = {
    fused: '11/13 반도체(SOXX) 종가 -3.67%로 밀렸지만 5거래일은 +9.35%였으며, 이는 [market.sector.semis:2229ce3e; regime-context 주도 영역 이탈 신호]입니다.', // 8006cca6b
    emptyParens: '반도체(SOXX)는 11/12 종가 -0.26%였고 주도 영역 이탈 신호입니다([market.sector.semis:0a495b98], [regime-context]).', // 6cd4c25a6
    openParen: '반도체(SOXX) 11/11 종가 +6.01%([market.sector.semis:1556bce0], 5거래일 +3.50%)였습니다.', // 4abfc0caf
    packetLabel: '11/14 로이터 보도는 엔비디아 하락 지속을 전했습니다 [헤드라인].' // 9cdcd8dc5
  };
  const flagged = Object.fromEntries(Object.entries(broken).map(([key, text]) => [key, va.publishedTextIssues(text)]));
  const clean = '미국 11/9 반도체(SOXX) 종가 +7.49%로 급등했습니다. [market.sector.semis:0a495b98; regime-context]\n11/10 연합뉴스 보도에 따르면 미국 기술주 급반등이 배경으로 거론됐습니다.';
  check('v60.18 the published form of the week\'s broken readings is rejected ("이는입니다", "(,)", "(, 5거래일", "[헤드라인]"); a citation after the period is fine',
    Object.values(flagged).every((issues) => issues.includes('published-text-malformed')) && !va.publishedTextIssues(clean).length
      && issuesOf(broken.fused).includes('published-text-malformed'), JSON.stringify(flagged));
  const salvaged = va.salvageMarketAnalysis([clean, broken.fused, '한국 11/10 코스피는 종가 +4.39%로 반등했습니다.', '다음 확인은 11/17 소매판매입니다.', '반증은 신용 확대입니다.', '판단은 보류합니다.'].join('\n'),
    (text) => va.validateMarketAnalysisText(text, data, snapshot, { history }));
  check('v60.18 a salvaged reading passes the same well-formedness rule: the broken line goes, whole',
    salvaged.ok && !/이는\s?입니다|이는입니다/.test(salvaged.text) && salvaged.removed.some((row) => row.issues.includes('published-text-malformed')), JSON.stringify(salvaged).slice(0, 400));
});

// REGIME_CONTEXT's direction sentences (v60.18 verdict wording) name a dated base; copied verbatim they must pass.
await section('packet direction wording', async () => {
  const { data, snapshot, history } = fx.outage;
  const context = 'volatility: neutral — VIX 19.30 — 18~25 통상 범위입니다. VIX는 11/6 25.64에서 -32% 내려온 뒤 11/11 17.49부터 이틀 +10% 반등 중입니다.\n주도 영역 이탈 — S&P 500은 11/6 7,376.86에서 +3.3% 오른 뒤 11/11 7,619.38부터 이틀 -0.8% 하락 중입니다.';
  const issuesOf = (text) => va.validateMarketAnalysisText(text, data, snapshot, { history, context }).issues.filter((issue) => /^metric-value-mismatch/.test(issue));
  const copied = ['VIX는 11/6 25.64에서 -32% 내려온 뒤 11/11 17.49부터 이틀 +10% 반등 중입니다.', 'S&P 500은 11/6 7,376.86에서 +3.3% 오른 뒤 11/11 7,619.38부터 이틀 -0.8% 하락 중입니다.'];
  check('v60.18 a dated base the packet gives ("11/6 25.64에서", "5거래일 전(11/4 16.61)보다") is a reference level; the same number written as the current level is still blocked',
    copied.every((text) => !issuesOf(text).length) && issuesOf('VIX는 11/10 25.64입니다.').includes('metric-value-mismatch:market.vix')
      && va.analysisNumberMarkedAsReference('VIX는 5거래일 전(11/4 16.61)보다 +5% 높습니다.', 16.61), JSON.stringify(copied.map(issuesOf)));
});

// Review v60.19 B6: a validator that throws sent the catch to retainOrFallback, which re-ran it, threw again and failed
// the whole refresh (fetch-data has no guard). It now takes the plain fallback, named a pipeline fault.
await section('validator throws', async () => {
  const { data, snapshot, previous } = fx.outage;
  const nowMs = Date.parse(fx.outage.nowMs);
  const validator = () => { throw new Error('injected validator fault'); };
  let out = null, thrown = null;
  try {
    out = await quiet(() => genMarketAnalysis(data, snapshot, { previous, request: async () => ({ text: '반도체(SOXX)는 11/9 종가 +7.49%였습니다.' }), nowMs, history: [], narrative: { text: '', signature: 'fixture', themes: [] },
      earnings: null, eventBriefs: null, bigtechCashflow: null, recordRejections: null, validator }));
  } catch (error) { thrown = error; }
  const { marketAnalysisBlockCause } = va;
  const { pipelineNotices } = await import('../src/data/pipeline-notices.js');
  const notice = pipelineNotices({ marketCyclePublished: true, marketAnalysisOk: false, marketAnalysisBlockCause: marketAnalysisBlockCause(out?.reason) }) || [];
  check('review v60.19 a throwing validator gives the plain fallback (reason validator-error, the pipeline notice), never a thrown refresh',
    !thrown && out?.status !== 'verified' && out?.reason === 'validator-error' && marketAnalysisBlockCause(out.reason) === 'pipeline'
      && notice.some((row) => /자동 검증 단계에 오류/.test(row.detail || '')) && /자동 검증 단계에 오류가 있어/.test(out.summary || ''), `${thrown?.message || ''} ${JSON.stringify({ status: out?.status, reason: out?.reason, summary: out?.summary })}`);
});

// The rejected attempts are kept for the operator (whole text, issues, input fingerprint), bounded, outside the repository.
await section('rejection log', async () => {
  const { data, snapshot, previous } = fx.outage;
  const nowMs = Date.parse(fx.outage.nowMs);
  const bad = '압력: 반도체(SOXX)는 11/9 종가 +7.49%였습니다. 자세한 내용은 https://example.com/a 참고, 문의 ops@example.com.';
  const logged = [];
  const target = join(root, 'public-data', 'market-analysis-rejections.json');
  const before = existsSync(target) ? readFileSync(target, 'utf8') : null;
  await quiet(() => genMarketAnalysis(data, snapshot, { previous, request: async () => ({ text: bad }), nowMs, history: [], narrative: { text: '', signature: 'fixture', themes: [] }, earnings: null, eventBriefs: null, bigtechCashflow: null,
    recordRejections: (attempts, run) => logged.push({ attempts, run }) }));
  // Review v60.19 B2: production passes `request` too, so the default writer runs whenever no option turns it off — the
  // run below is production's call shape (a request, no recordRejections) and writes under $RUNNER_TEMP; an explicit
  // `recordRejections: null` writes nothing.
  const runnerTemp = mkdtempSync(join(tmpdir(), 'aio-runner-temp-'));
  const savedRunnerTemp = process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP = runnerTemp;
  try {
    await quiet(() => genMarketAnalysis(data, snapshot, { previous, request: async () => ({ text: bad }), nowMs, history: [], narrative: { text: '', signature: 'fixture', themes: [] }, earnings: null, eventBriefs: null, bigtechCashflow: null, recordRejections: null }));
    const silent = !existsSync(join(runnerTemp, 'market-analysis-rejections.json'));
    await quiet(() => genMarketAnalysis(data, snapshot, { previous, request: async () => ({ text: bad }), nowMs, history: [], narrative: { text: '', signature: 'fixture', themes: [] }, earnings: null, eventBriefs: null, bigtechCashflow: null }));
    const written = join(runnerTemp, 'market-analysis-rejections.json');
    const log = existsSync(written) ? JSON.parse(readFileSync(written, 'utf8')) : null;
    check('review v60.19 production\'s call shape (a request, no option) writes the rejection log under $RUNNER_TEMP; recordRejections: null writes nothing',
      silent && log?.attempts?.length === 2 && log.attempts.every((row) => row.issues.includes('direction-sign-contradiction:market.semis')), `silent=${silent} log=${JSON.stringify(log)?.slice(0, 200)}`);
  } finally {
    if (savedRunnerTemp === undefined) delete process.env.RUNNER_TEMP; else process.env.RUNNER_TEMP = savedRunnerTemp;
    rmSync(runnerTemp, { recursive: true, force: true });
  }
  const after = existsSync(target) ? readFileSync(target, 'utf8') : null;
  const call = logged[0];
  check('v60.18 a rejected run hands both attempts to the rejection log with their issues and the input fingerprint; nothing is written into the repository',
    logged.length === 1 && call.attempts.length === 2 && call.attempts.every((row) => row.text === bad && row.issues.includes('direction-sign-contradiction:market.semis'))
      && /^[0-9a-f]{16}$/.test(call.run.inputKey) && /^[0-9a-f]{16}$/.test(call.run.contextKey) && before === after, JSON.stringify(call?.run));
  let log = null;
  for (let i = 0; i < 30; i += 1) log = rejections.nextRejectionLog(log, call.attempts, { ...call.run, nowMs: nowMs + i * 60000 });
  check('v60.18 the log is bounded (REJECTIONS_MAX attempts, newest kept) and scrubbed of links and addresses',
    log.attempts.length === rejections.REJECTIONS_MAX && log.attempts.at(-1).at === new Date(nowMs + 29 * 60000).toISOString()
      && log.attempts.every((row) => !/https?:|@example/.test(row.text) && row.text.length <= rejections.REJECTION_TEXT_MAX)
      && rejections.rejectionIssueCounts(log).some(([issue, count]) => issue === 'direction-sign-contradiction:market.semis' && count === rejections.REJECTIONS_MAX), JSON.stringify(log.attempts.at(-1)));
  // P1719: rejected AI text never enters the repository or a published artifact. The log is written outside the tree
  // ($RUNNER_TEMP in CI) and refresh-data uploads it as a short-retention Actions artifact; no publish set, Pages
  // exclude, manifest entry or lineage row names it, because nothing published carries it.
  const outside = relative(root, MARKET_ANALYSIS_REJECTIONS_OUT);
  const refreshWorkflow = readFileSync(join(root, '.github/workflows/refresh-data.yml'), 'utf8');
  const upload = /- name: Upload rejected AI reading attempts[\s\S]*?path: \$\{\{ runner\.temp \}\}\/market-analysis-rejections\.json[\s\S]*?retention-days: (\d+)/.exec(refreshWorkflow);
  const registered = [JSON.stringify(DATA_PUBLISH_SETS), PAGES_DATA_EXCLUDES.join('|'), readFileSync(join(root, '.github/workflows/pages-deploy.yml'), 'utf8'),
    readFileSync(join(root, 'public-artifact-manifest.json'), 'utf8'), readFileSync(join(root, 'scripts/ci-data-lineage-audit.mjs'), 'utf8')].some((text) => text.includes('market-analysis-rejections'));
  check('v60.18 the rejection log is written outside the repository and uploaded as a short-retention Actions artifact, never published',
    (outside.startsWith('..') || isAbsolute(outside)) && basename(MARKET_ANALYSIS_REJECTIONS_OUT) === 'market-analysis-rejections.json'
      && !!upload && Number(upload[1]) <= 7 && !registered && !existsSync(join(root, 'public-data', 'market-analysis-rejections.json')), `${MARKET_ANALYSIS_REJECTIONS_OUT} upload=${upload?.[1]} registered=${registered}`);
});

// v60.19 (one materiality vocabulary): the reading's size words agree with the ledger's grade for that metric. On 11/13
// SOXX -3.67% is an ordinary day for the chip index (its own sd), the 10-year's +29bp over five sessions is large, the
// S&P 500's -0.40% small. The prompt carries the same grades the validator recomputes from the history.
await section('v60.19 size words', async () => {
  const { history, data } = fx.lead;
  const grades = moves.moveSizeGrades(history);
  const issues = (text) => va.moveSizeWordIssues(text, { grades });
  const line = moves.moveSizeLine(grades);
  check('v60.19 MOVE_SIZE carries each declared metric\'s day and five-session grade from the ledger scale',
    /^MOVE_SIZE \(/.test(line) && /반도체\(SOXX\) 11\/13 하루 -3\.67% 보통/.test(line) && /미국 10년물 금리 11\/13 하루 \+5\.0bp 보통 · 5거래일 \+29\.0bp 큰 폭/.test(line) && /S&P 500 11\/13 하루 -0\.40% 소폭/.test(line), line);
  check('v60.19 "급락" for a move the ledger grades ordinary blocks, and "소폭" for one it grades large blocks',
    issues('반도체(SOXX)는 11/13 종가 -3.67% 급락했습니다.').includes('move-size-word-contradicts-ledger:soxx')
      && issues('미국 10년물 금리는 5거래일 +29.0bp 소폭 올랐습니다.').includes('move-size-word-contradicts-ledger:tnx'),
    JSON.stringify(grades.map((row) => [row.field, row.day, row.week])));
  check('v60.19 a size word that matches the grade, an in-session sentence and a two-metric sentence pass',
    !issues('미국 10년물 금리는 5거래일 +29.0bp 급등했습니다.').length && !issues('S&P 500은 11/13 종가 -0.40% 소폭 내렸습니다.').length
      && !issues('반도체(SOXX)는 장중 13:05 KST 기준 급락했습니다.').length && !issues('반도체(SOXX)가 급락하는 사이 미국 10년물 금리는 올랐습니다.').length
      && !issues('반도체(SOXX)는 11/13 종가 -3.67% 내렸습니다.').length);
  // Review v60.19 A1: a size word binds to the metric only as its own predicate (same clause, after the name, nothing but
  // the move's date/close/number between). Another subject's 급락, a 우려 noun or a past period leaves the sentence unread.
  const foreign = ['엔비디아가 급락했지만 S&P 500은 11/13 종가 -0.40%에 그쳤습니다.', 'S&P 500은 11/13 종가 -0.40%로 지난주 급락분을 일부 되돌렸습니다.',
    '금리 급등 우려에도 S&P 500은 -0.40% 움직였습니다.', '코스닥이 급락한 가운데 코스피는 소폭 올랐습니다.'];
  check('v60.19 a size word that belongs to another subject, a 우려 noun or a past period is not read as the declared metric\'s',
    foreign.every((text) => !issues(text).length), JSON.stringify(foreign.map((text) => [text, issues(text)])));
  check('v60.19 the metric\'s own predicate after a clause break is still read',
    issues('엔비디아가 올랐지만 반도체(SOXX)는 11/13 종가 -3.67% 급락했습니다.').includes('move-size-word-contradicts-ledger:soxx'));
  const help = va.describeMarketAnalysisIssues('', ['move-size-word-contradicts-ledger:soxx'], [], new Map(), { grades });
  check('v60.19 the retry help for a size-word block names the metric and the ledger grade', /MOVE_SIZE/.test(help) && /반도체\(SOXX\): 하루 보통/.test(help), help);
  const blocked = va.validateMarketAnalysisText('반도체(SOXX)는 11/13 종가 -3.67% 급락했습니다.', data, null, { history }).issues;
  check('v60.19 validateMarketAnalysisText runs the size-word check on the run\'s history', blocked.includes('move-size-word-contradicts-ledger:soxx'), blocked.join(', '));
  check('v60.19 the block name is a prompt label: left in the text it blocks', va.PROMPT_SECTION_LABEL.test('MOVE_SIZE 기준으로 보면'));
});

if (failures.length) {
  console.error(`[market-reading-week-fixture] FAIL (${failures.length})\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('[market-reading-week-fixture] OK: 11/10 outage retention, 11/11 in-session slot, slot ids and direction rule, 11/14 lead and ledger agreement, published-form rule, rejection log');
