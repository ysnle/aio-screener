// Market reading lane: regime/scenario context for the prompt, headline translation and the verified market analysis.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RULES } from '../../src/domain/rules/thresholds.js';
import { SHARED_AI_MODEL, requestSharedAnalysis, resolveSharedAiConfig } from '../lib/ai-shared-analysis.mjs';
import { buildCloseSeries } from '../../src/domain/briefing/market-read.js';
import { countOpenSessionsBetween } from '../../src/domain/market/market-calendar.js';
import { buildMarketFlow } from '../../src/domain/market/market-flow.js';
import { HEADLINE_GLOSSARY_PAIRS } from '../../src/domain/briefing/headline-terms.js';
import { expandScreenerArtifact } from '../../src/data/screener-extended.js';
import { loadThemeMaps } from '../build-scenario-state.mjs';
import { readNarrativeContext } from '../lib/narrative-context.mjs';
import { renderMarketScenarioModel } from '../../src/domain/market/regime-scenarios.js';
import { renderScenarioOutlookContext } from '../../src/domain/market/scenario-outlook.js';
import { renderMacroCrossroadsContext } from '../../src/domain/market/macro-crossroads.js';
import { renderMarketGuideContext } from '../../src/domain/guide/market-guide.js';
import { POLITICAL_EVENTS } from '../../src/domain/briefing/schedule.js';
import { indexLevels, levelValue, levelsRead } from '../../src/domain/market/index-levels.js';
import { interpretationFromArtifacts, marketAnalysisRegimeInput as regimeInputFromArtifacts } from '../lib/market-interpretation-inputs.mjs'; // owner 2026-10-19: one interpretation pipeline
import { NEWS_INTRADAY_MAX } from '../lib/news-selection.mjs';
import { buildMarketAnalysisPrompt, buildMarketAnalysisRetryPrompt, inflationDirectionLine } from '../lib/market-analysis-prompt.mjs';
import { afterHoursContextLines, afterHoursSignature } from './after-hours.mjs';
import { earningsContextLines, earningsContextSignature, readEventBriefs, cashflowContextLines, readBigtechCashflow } from './earnings-context.mjs';
import { softenReaderDuty, inflationEasingContradicts, EVIDENCE_TIER_METRIC_IDS, KOREA_MOVE_MENTION_PCT, MARKET_ANALYSIS_CLOSED_SESSIONS, snapshotEvidenceRows, buildCompletedCloseBasis, marketAnalysisReversal, marketAnalysisLargeMove, marketAnalysisLargeMoveDirection, marketSentenceDay, marketSentenceRejectReason, dailyMarketSentence, MARKET_SENTENCE_LABEL, splitMarketSentence, buildMarketAnalysisEvidence, buildMarketAnalysisHeadlineContext, buildMarketAnalysisNewsEvidence, buildStructuredMarketAnalysis, describeMarketAnalysisIssues, retainVerifiedMarketAnalysis, reusableMarketAnalysis, validateMarketAnalysisText, lastVerifiedMarketAnalysis, plainMarketFallbackSummary } from '../lib/market-analysis-validate.mjs';
import { HIST, SCENARIO_STATE_OUT, SCENARIO_OUTCOMES_OUT, EARNINGS_CALENDAR_OUT, REPO_ROOT } from './paths.mjs';
const SCREENER_OUT = `${REPO_ROOT}/public-data/screener.json`;
import { MACRO_HISTORY_OUT, MACRO_CALENDAR_OUT } from './macro-history.mjs';
import { coreInflationRead } from '../../src/domain/macro/macro-read.js';
import { readNumber } from '../../src/domain/shared/number.js';
import { readHistoryRows as expandHistoryRows } from '../../src/domain/market/history-rows.js';

// v57.81: plain Korean values with their session ("10/14 종가"), never "SPX=… (ISO)"; the last verified reading rides along
// as `lastVerified` so the next run can still keep it (retainVerifiedMarketAnalysis).
function buildMarketAnalysisFallback(data, reason, metricEvidence = buildMarketAnalysisEvidence(data), newsEvidence = buildMarketAnalysisNewsEvidence(data), { previous = null, nowMs = Date.now() } = {}) {
  const summary = plainMarketFallbackSummary(metricEvidence);
  const fallback = buildStructuredMarketAnalysis({ data, text: summary, model: 'none', status: 'blocked', reason, metricEvidence, newsEvidence, semantic: { ok: false, issues: [reason], causalEvidenceCount: 0 } });
  const lastVerified = lastVerifiedMarketAnalysis(previous, nowMs);
  return lastVerified ? { ...fallback, lastVerified } : fallback;
}

// P1635: the published narrative read only levels, so it filled its lines with statements such as
// "the two indicators are different indicators". It now receives the same deterministic regime,
// scenario and likelihood reading the 시장 상태 screen shows (same domain modules, same completed
// closes in history.json), and is asked to connect change -> meaning -> path -> what to check.
// P1685 review: the screen's credit axis reads the 20-session HY change from macro-history; the narrative must get
// the same series or it calls credit 'favorable' while the screen says 'neutral'.
function readPublishedMacroHistory() {
  try { return JSON.parse(readFileSync(MACRO_HISTORY_OUT, 'utf8')); } catch (_) { return null; }
}

// v59.85 (macro/AI review): the INFLATION_DIRECTION line states the screen's core-inflation direction (macro-read coreInflationRead:
// core PCE and core CPI 3-month pace against year-over-year — the quadrant, 물가 axis and chapter read the same flag), not a cpiDelta guess.
export function marketAnalysisInflationDirection(data, macroHistory = readPublishedMacroHistory()) {
  try {
    return coreInflationRead({ macro: data?.macro || {}, mh: macroHistory }).direction || null; // the one shared core-inflation direction
  } catch (_) { return null; }
}

export function marketAnalysisRegimeInput(data, history = [], macroHistory = readPublishedMacroHistory()) {
  return regimeInputFromArtifacts(data, history, macroHistory); // owner 2026-10-19: moved to scripts/lib/market-interpretation-inputs.mjs
}

// v59.70 (R8): the screener (several MB), theme maps and consensus are read once per file version, not on every call.
const FILE_MEMO = new Map();
function readJsonOnce(file, load = () => JSON.parse(readFileSync(file, 'utf8'))) {
  let version = null;
  try { version = statSync(file).mtimeMs; } catch (_) { return null; }
  const held = FILE_MEMO.get(file);
  if (held && held.version === version) return held.value;
  let value = null;
  try { value = load(); } catch (_) {}
  FILE_MEMO.set(file, { version, value });
  return value;
}

export function buildMarketAnalysisRegimeContext(data, history = []) {
  try {
    // Owner 2026-10-19: one shared interpretation (scripts/lib/market-interpretation-inputs.mjs), the same stages the
    // screens and scenario-state.json read.
    const input = marketAnalysisRegimeInput(data, history);
    const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch (_) { return null; } };
    const state = readJson(SCENARIO_STATE_OUT);
    // v59.70 (R8): the same screener (S&P 500 breadth, index weights, theme stages) and consensus inputs as the screens.
    const interpretation = interpretationFromArtifacts({ data, history, macroHistory: input.macroHistory, calendar: readJson(MACRO_CALENDAR_OUT), outcomes: readJson(SCENARIO_OUTCOMES_OUT), previous: state,
      screener: readJsonOnce(SCREENER_OUT), themeMaps: readJsonOnce(`${REPO_ROOT}/js/aio-pages.js`, () => loadThemeMaps(REPO_ROOT)),
      consensus: readJsonOnce(`${REPO_ROOT}/public-data/consensus-estimates.json`), nowMs: input.now });
    const { regime, scenarios, outlook } = interpretation;
    if (!regime?.available) return '';
    const axes = (regime.axes || []).map((axis) => `${axis.label || axis.id}: ${axis.state}${axis.read ? ` — ${axis.read}` : ''}`).join('\n');
    // v57.81 (owner 2026-10-15): the trend state with the SOXX (v59.70 proxy) / Russell 2000 evidence rows and the leadership-break
    // flag travel as their own lines, so the narrative cannot call the trend 양호 or say semis lead while the flag is on.
    const trend = (regime.axes || []).find((axis) => axis.id === 'trend');
    const trendLine = trend ? `추세 판정: ${trend.stateLabel || trend.state}${trend.testing ? ' (50일선 시험 구간)' : ''}${trend.capped ? ' (SOXX·러셀 2000 동반 약세로 중립 상한)' : ''} · 근거: ${(trend.evidence || []).map(([label, value]) => `${label} ${value}`).join('; ')}` : '';
    const leadership = regime.leadership;
    const leadershipLine = leadership?.break ? `주도 영역 이탈(leadershipBreak): 예 — ${leadership.summary}. 반도체·AI가 지금도 주도한다고 쓰지 말고, 최근 하락을 함께 적을 것.`
      // v57.83: leaders weak without market-wide confirmation is not "아니오" — the narrative must not say they still lead.
      : leadership?.state === 'weak' ? `주도 영역 이탈(leadershipBreak): 확산 미확인 — ${leadership.summary}. 반도체·AI가 지금도 주도한다고 쓰지 말고, 최근 하락을 함께 적을 것.`
      : leadership?.state === 'holding' ? '주도 영역 이탈(leadershipBreak): 아니오.' : '주도 영역 이탈(leadershipBreak): 확인 불가.';
    const conflicts = (regime.conflicts || []).length ? `엇갈리는 신호: ${regime.conflicts.join(' ')}` : '';
    // Owner 2026-10-18: the semiconductor drawdown travels on its own line so the day's tension is weighed against oil and
    // rates by the size of the move, not by how many headlines a topic got.
    const semisRow = (trend?.evidence || []).find(([label]) => label === '반도체 (SOXX)');
    const semisLine = semisRow ? `반도체·AI 주도주: SOXX ${semisRow[1]} — 오늘의 긴장을 고를 때 이 하락폭을 유가·금리 변화와 같은 기준(움직임의 크기와 판정 변화)으로 비교할 것.` : '';
    // v57.81: the validator rejects a Korea-vs-US sentence without both session dates when they differ; the packet says so.
    const krDate = buildCloseSeries(input.history, 'kospi').at(-1)?.date || null;
    const sessions = krDate && regime.asOf && krDate !== regime.asOf ? `세션 기준일: 미국 ${regime.asOf.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/')} · 한국 ${krDate.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/')} — 두 시장을 한 문장에서 함께 말하면 두 날짜(M/D)를 모두 적을 것.` : '';
    return [`종합: ${regime.overall} (양호 ${regime.counts?.favorable ?? '-'} · 부담 ${regime.counts?.burden ?? '-'})`, sessions, priorSessionMoveLines(input.history), trendLine, leadershipLine, semisLine, marketFlowContext(data, input.history, input.now), conflicts, axes,
      renderMarketScenarioModel(scenarios), renderScenarioOutlookContext(outlook), marketAnalysisCrossroadsContext(interpretation, state)].filter(Boolean).join('\n');
  } catch (error) {
    return '';
  }
}

// v58.68 (owner 2026-10-23): "the screens show the surface" — the packet carried the indices and the semiconductor drop
// but not where the money went. The same money-flow reading 오늘 and 시장 상태 draw (domain/market/market-flow.js): sector
// ETFs, the 10-year yield, fear, the strongest and weakest sub-themes and the sectors whose sub-themes split.
export function marketFlowContext(data, history = [], nowMs = Date.now(), { screener = null, themes = null } = {}) {
  try {
    const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch (_) { return null; } };
    const scr = screener || readJson(SCREENER_OUT);
    const rows = scr ? Object.entries(expandScreenerArtifact(scr)?.data || {}).map(([sym, row]) => ({ sym, ...row })) : null;
    const flow = buildMarketFlow({ rotationHistory: data?.rotationHistory || null, macro: data?.macro || null, history, themes: themes || loadThemeMaps().usThemes, rows, nowMs });
    if (!flow?.available) return '';
    const t = flow.themes?.available ? flow.themes : null;
    return [`자금 흐름(미국 ${mdOf(flow.session)} 종가): ${flow.label} — ${flow.line}. ${flow.read}`,
      t ? [t.strongLine, t.weakLine, t.splitLines.length ? `같은 업종 안에서 갈린 곳: ${t.splitLines.slice(0, 4).join(' / ')}` : '',
        // v58.74: the AI-chain sub-themes whose own members split (MU up, SNDK·WDC·STX down on 10/23)
        t.memberSplitLines?.length ? `같은 테마 안에서 갈린 종목: ${t.memberSplitLines.slice(0, 3).join(' / ')}` : ''].filter(Boolean).join(' · ') : '',
      '— 지수의 움직임이 어느 업종·테마에 몰렸고 돈이 어디로 옮겨갔는지(버틴 쪽과 밀린 쪽)를 압력 단락에서 한 번 쓸 것. 업종 이동을 정치·선거 같은 원인으로 단정하지 말 것; 원인은 HEADLINE_CONTEXT 보도로만 붙인다.'].filter(Boolean).join('\n');
  } catch (_) {
    return '';
  }
}

// v57.87 (10/16 audit): on the session after KOSPI's -7.6% close the commentary spoke only of the next morning's
// in-session rebound — METRIC_EVIDENCE carries the latest observation, so the completed crash close never reached the
// prompt. A completed close that moved 3% in a session or 8% over five sessions travels as its own dated line.
export const PRIOR_SESSION_MOVE_1D_PCT = RULES.largeMove.priorSession1dPct;
export const PRIOR_SESSION_MOVE_5D_PCT = RULES.largeMove.priorSession5dPct;
export function priorSessionMoveLines(history = []) {
  const md = (date) => String(date || '').slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
  const signed = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  const lines = [];
  // WTI too (10/16 audit): its in-session row is dropped from METRIC_EVIDENCE, so a +3% oil close never reached the prompt.
  // v58.68 (owner 2026-10-23, US first): the 10/22 reading opened with KOSPI and never named the Nasdaq 100 or the
  // semiconductor drop. The US lines come first, the Nasdaq 100 and SOXX join at the leadership 급락일 edges, and a US
  // one-session change is written only across consecutive sessions (a missing 10/21 row made 10/20→10/22 look like a day).
  const L = RULES.leadership;
  // v58.71 (pipeline audit): KOSPI is checked on the KRX calendar and WTI on the US one (CME follows US holidays), and a
  // five-session change needs exactly five sessions; a missing row made a two-session change read as "M/D 종가".
  // v59.24 (live 2026-10-26 08:20 KST): CL=F reopens at 18:00 ET and Yahoo keeps Friday's settle as its previous close
  // until the bar rolls, so the 08:00 KST reading opened with "WTI 10/23 종가 +3.82%" while oil had settled -1.46% on 10/26.
  // A US line whose last close is older than the latest S&P 500 close is not the 직전 완료 세션 and is left out.
  const usLatest = buildCloseSeries(history, 'spx').filter((point) => Number(point?.value) > 0).at(-1)?.date || null;
  for (const [field, label, edge, market] of [['spx', 'S&P 500', PRIOR_SESSION_MOVE_1D_PCT, 'US'], ['ndx', '나스닥 100', L.shockNdx1dPct, 'US'], ['soxx', '반도체(SOXX)', L.shockSemis1dPct, 'US'], ['kospi', '코스피', PRIOR_SESSION_MOVE_1D_PCT, 'KR'], ['wti', 'WTI', PRIOR_SESSION_MOVE_1D_PCT, 'US']]) {
    const series = buildCloseSeries(history, field).filter((point) => Number(point?.value) > 0);
    if (series.length < 2) continue;
    const last = series.at(-1), prior = series.at(-2), back5 = series.length >= 6 ? series.at(-6) : null;
    if (market === 'US' && usLatest && last.date < usLatest) continue;
    const consecutive = countOpenSessionsBetween(prior.date, last.date, market) === 1;
    const d1 = consecutive ? (last.value / prior.value - 1) * 100 : null;
    const d5 = back5 && countOpenSessionsBetween(back5.date, last.date, market) === 5 ? (last.value / back5.value - 1) * 100 : null;
    if (!((d1 != null && Math.abs(d1) >= edge) || (d5 != null && Math.abs(d5) >= PRIOR_SESSION_MOVE_5D_PCT))) continue;
    lines.push(`${label} ${md(last.date)} 종가${d1 != null ? ` ${signed(d1)}` : ''}${d5 != null ? ` (5거래일 ${signed(d5)})` : ''}`);
  }
  return lines.length ? `직전 완료 세션의 큰 움직임: ${lines.join(' · ')} — 이후 장중 반등·하락과 별개로, 해석의 첫 두 줄 안에 이 종가 변화를 날짜(M/D)와 함께 한 번 쓸 것.` : '';
}

// Owner 2026-10-21: the reading anchored on KOSPI's 10/20 close (-3.73%) and never said why the market fell or why it was
// rebounding +4.48% that morning, though the headlines were in the packet. MARKET_DRIVERS sets the order — the pressure
// with its reported reasons, the current move with its reported reasons, and what would confirm or deny it — and names
// the next large-cap earnings, so "does the follow-through reach semis and big tech" has dates to check against.
const mdOf = (date) => String(date || '').slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
const signedPct = (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
export const NEXT_EARNINGS_MIN_WEIGHT = 0.3; // S&P 500 index weight in percent
export function nextEarningsLine(calendar, afterDate, { max = 6 } = {}) {
  const rows = (Array.isArray(calendar?.earnings) ? calendar.earnings : [])
    .filter((row) => row?.symbol && afterDate && String(row.date || '') > afterDate && Number(row.indexWeight) >= NEXT_EARNINGS_MIN_WEIGHT && row.epsActual == null);
  const date = rows.map((row) => row.date).sort()[0];
  if (!date) return '';
  const when = { bmo: '장 전', amc: '장 마감 후' };
  const day = rows.filter((row) => row.date === date).sort((a, b) => Number(b.indexWeight) - Number(a.indexWeight)).slice(0, max);
  const groups = ['bmo', 'amc', null].map((hour) => [hour, day.filter((row) => (when[row.hour] ? row.hour : null) === hour).map((row) => row.symbol)]).filter(([, symbols]) => symbols.length);
  // v58.74 (audit): the first session alone (10/27 KO·V) let the reading call 10/27 the large-cap day while MSFT·GOOGL
  // (10/28) and AMZN (10/29) carry the week; the heaviest reports of the next seven days follow, dated.
  const weekEnd = new Date(Date.parse(`${date}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const later = rows.filter((row) => row.date > date && row.date <= weekEnd).sort((a, b) => Number(b.indexWeight) - Number(a.indexWeight)).slice(0, 4)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || Number(b.indexWeight) - Number(a.indexWeight));
  const laterText = later.map((row) => `${mdOf(row.date)} ${when[row.hour] || '시간 미정'} ${row.symbol}`).join(', ');
  return `다음 대형주 실적(${mdOf(date)}, 미국 시각): ${groups.map(([hour, symbols]) => `${hour ? when[hour] : '시간 미정'} ${symbols.join('·')}`).join(' / ')}${laterText ? ` / 이어서 비중이 큰 실적(미국 시각): ${laterText}` : ''}`;
}
// v58.72 (live review 10/23): with no market in session the fallback read "장중 큰 움직임 없음", and the 16:27 KST reading
// wrote "장중 큰 움직임은 없고" on a day KOSPI fell 4% intraday and closed +0.30%. The packet has no completed session's
// intraday range, so the fallback says only that no session is open now and forbids the claim.
export const NO_SESSION_ROW_NOW = '지금 진행 중인 장의 장중 값 없음 — 가장 최근 완료 종가로 쓰고, 완료된 세션의 장중 등락은 이 자료에 없으니 "장중 큰 움직임이 없었다"고 쓰지 말 것(장중 흐름은 그 날짜 헤드라인이 전할 때만 헤드라인에 귀속해 쓴다)';
// v58.74 (owner review 10/24): the week of the Israeli election the reading named only FOMC and earnings. Scheduled
// elections inside the next week travel with the confirm/deny row, dated in KST (the briefing schedule's own list).
export function upcomingPoliticalLine(nowMs = Date.now(), days = 7) {
  const rows = POLITICAL_EVENTS.map((event) => ({ ...event, atMs: Date.parse(event.atKst) }))
    .filter((event) => Number.isFinite(event.atMs) && event.atMs >= nowMs && event.atMs <= nowMs + days * 86400000);
  return rows.length ? `정치 일정: ${rows.map((event) => `${mdOf(event.atKst.slice(0, 10))} KST ${event.label}`).join(' / ')}` : '';
}
// v59.62 (owner 2026-11-03): the reading said nothing about where the indexes sit on their charts (Nasdaq-100 more than
// 10% off its high, semiconductors 11% under the 50-day line, the July low as support). Rules over the closes only
// (src/domain/market/index-levels.js); the line names no price target.
export function chartLevelsLine(history = []) {
  const levels = indexLevels(history);
  return levels.length ? `차트 위치: ${levels.map(levelValue).join(' · ')}. ${levelsRead(levels)}` : '';
}
export function marketDriversContext({ history = [], reversal = null, intradayRows = [], earningsLine = '', eventsLine = '', levelsLine = '' } = {}) {
  const prior = priorSessionMoveLines(history).replace(/^직전 완료 세션의 큰 움직임: /, '').replace(/ — .*$/, '');
  const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);
  const now = reversal
    ? `코스피 ${mdOf(reversal.closeDate)} 종가 ${signedPct(reversal.closeChangePct)} 뒤 장중 ${kst(reversal.observedAt)} KST 기준 ${signedPct(reversal.nowChangePct)} — 직전 완료 세션과 반대 방향`
    : '';
  const intraday = intradayRows.map((row) => `${row.label} 장중 ${kst(row.observedAt)} KST 기준 ${signedPct(row.changePct)}`).join(' · ');
  return [
    'MARKET_DRIVERS (해석의 뼈대 — 아래 세 칸을 이 순서로 채운다. 숫자는 METRIC_EVIDENCE·REGIME_CONTEXT·KOREA_LARGE_INTRADAY_MOVE와 아래 장중 값만 쓴다):',
    `- 압력: ${prior || '직전 완료 세션의 큰 움직임 없음 — 가장 최근 완료 종가의 변화'} — 이 움직임에 대해 보도된 이유를 서로 다른 것으로 2~3개 쓴다. 이유마다 "10/20 WSJ 보도에 따르면 …"처럼 HEADLINE_CONTEXT 헤드라인의 날짜(M/D, date= 값)와 출처를 같은 문장에 붙이고, 그 이유가 무엇을 거쳐 어느 쪽(반도체·대형 기술주, 유가, 신용 등)에 닿았는지 한 구절로 잇는다.`,
    `- 지금: ${[now, intraday].filter(Boolean).join(' · ') || NO_SESSION_ROW_NOW} — 이 움직임에 대해 보도된 이유를 1~3개, 같은 형식(날짜·출처)으로 쓴다. 장중 움직임의 이유는 08:00 이후 장중 속보(잠정)나 그 직전 미국 장 마감 뒤 헤드라인에서만 고르고 잠정이면 "잠정"을 쓴다. 압력의 이유와 지금의 이유를 한 문장에 섞지 않는다.`,
    `- 확인·반증: ${[earningsLine || '다음 대형주 실적 일정 미수집', eventsLine, levelsLine].filter(Boolean).join(' / ')} — 지금 움직임이 이어지려면 무엇이 확인돼야 하고(예: 실적과 설비투자 전망이 반도체·대형 기술주로 이어지는지, 유가·신용이 같은 방향인지) 무엇이 나오면 되돌림으로 보는지 쓴다. 매매 지시·목표가 없이.`,
    '보도된 이유가 헤드라인에 없으면 지어내지 말고 "보도된 이유 미수집"이라고 쓴다. 헤드라인은 원인을 확정하지 않는다 — 한 가지 해석으로 쓴다.'
  ].join('\n');
}

// P1742 (owner 2026-10-13): the narrative looks forward with the same branches the 거시 screen draws — the next official
// releases, each branch's chain, its three likelihood lines and the reader's choices with their opportunity cost.
export function marketAnalysisCrossroadsContext(interpretation, state = null) {
  try {
    // P1743: the previous refresh's scenario state (scripts/build-scenario-state.mjs runs after this producer) adds the
    // automated record — what changed, how the latest releases scored — and every theme's stage under the same branches.
    // Owner 2026-10-19: the shared market guide (the 오늘 card) so the narrative explains with the same synthesis.
    const { crossroads, guide } = interpretation || {};
    if (!crossroads) return '';
    return [renderMacroCrossroadsContext(crossroads, { state }), scenarioStateThemeLines(state), guide ? renderMarketGuideContext(guide) : ''].filter(Boolean).join('\n');
  } catch (_) { return ''; }
}

export function scenarioStateThemeLines(state) {
  const themes = Array.isArray(state?.themes) ? state.themes : [];
  if (!themes.length) return '';
  const byKey = new Map(themes.map((row) => [`${row.market}:${row.id}`, row]));
  // v57.81 (themes audit): each named theme carries its stage window and its last five sessions beside the month, so the
  // narrative cannot call a theme leading from the month while the week broke (validator: themeLeadClaimIssues).
  const signedPct = (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
  const named = (keys = []) => keys.map((key) => byKey.get(key)).filter(Boolean).map((row) => `${row.label}(${row.market === 'KR' ? '3개월' : '6개월'}·1개월 기준 · 1개월 ${signedPct(row.ret1m)}${Number.isFinite(row.ret5d) ? ` · 5거래일 ${signedPct(row.ret5d)}` : ''})`).slice(0, 6).join(', ');
  const h = state.highlights || {};
  // v57.75 (crash audit): theme returns lag the macro read by a session when the theme producer has not run yet; the
  // header says so, so the model does not present them as today's moves.
  const themeAsOf = state.basis?.themeAsOf || null, macroAsOf = state.basis?.macroAsOf || null;
  const lag = themeAsOf && macroAsOf && themeAsOf < macroAsOf ? ` — 거시 기준일 ${macroAsOf}보다 오래된 값, 최근 세션 움직임 반영 전이므로 오늘의 움직임으로 쓰지 마라` : '';
  // v57.81: KR themes close a session after the US ones; the header prints each market's date and the stage rule.
  const byMarket = state.basis?.themeAsOfByMarket || null;
  const dates = byMarket && (byMarket.US || byMarket.KR) ? [byMarket.US ? `미국 ${byMarket.US}` : '', byMarket.KR ? `한국 ${byMarket.KR}` : ''].filter(Boolean).join(' · ') : (themeAsOf || '기준일 미확인');
  return [`【테마 시나리오 — 모든 테마를 같은 규칙으로(${dates} 확정 종가, 직전 갱신${lag}) · 단계는 6개월(한국 3개월)·1개월 수익률을 같은 기간 지수와 비교하고 최근 5거래일로 점검】`, state.rotation?.text ? `가격 기준 강약 이동: ${state.rotation.text}` : '',
    h.structuralPullbacks?.length ? `긴 추세 속 조정 + 중심 시나리오에서 역풍 아님: ${named(h.structuralPullbacks)}` : '',
    h.headwindLeaders?.length ? `거시 부담에도 주도: ${named(h.headwindLeaders)}` : '',
    h.tailwindLaggards?.length ? `거시 수혜인데 약세: ${named(h.tailwindLaggards)}` : ''].filter(Boolean).join('\n');
}

async function readHistoryRows() {
  try {
    return expandHistoryRows(JSON.parse(await readFile(HIST, 'utf8'))); // v59.70 R2
  } catch (_) { return []; }
}

// v57.55 review (news trust): every browser re-translated the same English headlines through the shared AI budget, and on a
// rate limit fell back to machine translation ("금 회사 - Kitco AM 보고서"). Headlines are translated once here: titles
// already translated last run are reused, only new English titles go in one bounded request, and anything that does not
// come back as a Korean line keeps no titleKo (the browser then translates as before). A failure never blocks the cycle.
export const HEADLINE_TRANSLATION_MAX = 30;
const hasHangul = (text) => /[가-힣]/.test(String(text || ''));
// v57.69 (P1803): the free model returned Korean lines with Thai, Hanja or Kana mixed in, and any one Hangul syllable
// passed. A translation is kept only when it carries no other script and at least two Hangul syllables; a cached
// translation from an earlier run is held to the same test so a bad one is not reused forever.
export const isCleanKoreanTitle = (text) => {
  const value = String(text || '');
  return (value.match(/[가-힣]/g) || []).length >= 2 && !/[฀-๿぀-ヿ㐀-䶿一-鿿Ѐ-ӿ؀-ۿ�]/.test(value);
};
// Screen audit 2026-10-20: "Anthropic and Nscale in talks for second multibillion-dollar deal" came back as "인간형 AI와
// Nscale, 2번째 수천억 달러 규모 거래" — the company name read as an adjective and the size inflated a hundredfold. A
// translation must keep each named company (Korean or Latin spelling) and must not scale billions up.
const HEADLINE_NAMES = Object.freeze([
  [/\bAnthropic\b/i, /앤트로픽|앤스로픽|Anthropic/i], [/\bOpenAI\b/i, /오픈\s?AI|OpenAI/i], [/\bNvidia\b/i, /엔비디아|Nvidia/i],
  [/\bCoreWeave\b/i, /코어위브|CoreWeave/i], [/\bNscale\b/i, /엔스케일|Nscale/i], [/\bxAI\b/, /xAI|엑스AI/i]
]);
// "$45 billion" also came back as "4,500억 달러" (450억): every 억/조 amount in the Korean line must equal one stated in the title.
// Dollar amounts only, in units of 억 (1 million = 0.01억); "1조 2,000억 달러" is one amount.
const titleAmounts = (title) => [...String(title || '').matchAll(/\$\s?(\d+(?:\.\d+)?)\s*(million|billion|bn|trillion)\b/gi)]
  .map((m) => Number(m[1]) * (/^t/i.test(m[2]) ? 10000 : /^m/i.test(m[2]) ? 0.01 : 10));
const koreanAmounts = (ko) => [...String(ko || '').matchAll(/(?:(\d[\d,]*(?:\.\d+)?)\s*조\s*)?(?:(\d[\d,]*(?:\.\d+)?)\s*억\s*)?(?:(\d[\d,]*)\s*만\s*)?달러/g)]
  .filter((m) => m[1] || m[2] || m[3]).map((m) => [m[1], m[2], m[3]].map((v) => Number(String(v || '0').replace(/,/g, ''))))
  .map(([jo, eok, man]) => jo * 10000 + eok + man / 10000);
// v58.72 (live review 10/23): "Bessent dismisses AI bubble fears" came back as "... AI 버블 우려 bác함" (Vietnamese). An
// accented Latin word is kept only when the source title has it too (Nestlé, Société Générale).
const ACCENTED_WORD = /[A-Za-zÀ-ɏḀ-ỿ]*[À-ɏḀ-ỿ][A-Za-zÀ-ɏḀ-ỿ]*/g;
// v58.74 (text audit, news translation): the free model turned "Treasury Haven" into "재정 예금 안정성" and "Bearish Euro
// Bets" into "유로 매도 건으로 상승". A market term in the title must come back as its market word; a title that fails
// keeps no titleKo, so the browser translates it with the shared model instead of showing a wrong meaning.
const HEADLINE_TERMS = Object.freeze([
  [/\bTreasur(?:y|ies)\b(?!\s+(?:Secretary|Department))/, /국채|미 국채|재무부/], [/\bhaven\b/i, /안전/], [/\bFed\b/, /연준|연방준비/],
  [/\bbearish\b/i, /약세|하락|매도|비관/], [/\bbullish\b/i, /강세|상승|매수|낙관/], [/\bselloff\b|\bsell-off\b/i, /매도|급락|하락/],
  // v58.75 (persona review): "guidance" came back as 지침/안내; a company outlook is 가이던스 or 전망.
  [/\bguidance\b/i, /가이던스|전망/],
  // "Bearish Euro Bets" passed as "유로 매도 건으로 상승" (매도 satisfied the bearish term); a bet is a 베팅/포지션.
  [/\b(?:bearish|bullish)\b(?:\s+\S+){0,2}\s+bets?\b/i, /(?:약세|강세|하락|상승|매도|매수|숏|롱)\s*(?:베팅|포지션)|공매도/],
  // v59.56 (text-quality audit): 'high junk' came back as '고위 자산'·'상승' — a junk/high-yield credit word must stay a credit word.
  [/\bjunk\b|\bhigh[- ]yield\b/i, /정크|하이일드|투기\s*등급|고위험\s*(?:채|회사채|등급)/]
]);
// v58.75 (persona review): the shared model is told the market words up front (the validator above only rejects a miss
// afterwards). The free Workers AI path takes no instructions; its misses fall to this prompt through the validator.
export const HEADLINE_GLOSSARY = HEADLINE_GLOSSARY_PAIRS.map(([en, ko]) => `${en} → ${ko}`).join(', '); // shared with the browser's after-translation fixes
export const isFaithfulKoreanTitle = (title, ko) => {
  if (!isCleanKoreanTitle(ko)) return false;
  // v59.56: a dictionary-form verb left mid-headline ('소식통은 말하다') is an unfinished translation, not a title.
  if (/(?:말하|밝히|전하|보도하)다(?=\s|[,.·]|$)/.test(String(ko || ''))) return false;
  if (!HEADLINE_TERMS.every(([en, kr]) => !en.test(String(title || '')) || kr.test(String(ko || '')))) return false;
  if ((String(ko || '').match(ACCENTED_WORD) || []).some((word) => !String(title || '').includes(word))) return false;
  if (!HEADLINE_NAMES.every(([en, kr]) => !en.test(String(title || '')) || kr.test(String(ko || '')))) return false;
  if (/multi-?billion|\bbillions?\b/i.test(String(title || '')) && !/trillion/i.test(String(title || '')) && /수천억|수조/.test(String(ko || ''))) return false;
  const stated = titleAmounts(title);
  return !stated.length || koreanAmounts(ko).every((amount) => stated.some((value) => Math.abs(amount - value) <= value * 0.01));
};
// v59.74 (site QA 11/7: '… market eyes Fed policy : Finance : JKN' was translated with its feed tail): trailing
// ' : Section : Outlet' / ' | Outlet' segments are the feed's labels, not the headline, and are not sent for translation.
export const headlineForTranslation = (title) => String(title || '').replace(/(?:\s+[:|]\s+[A-Z][\w.&'-]*(?:\s[A-Z][\w.&'-]*){0,2}){1,3}$/, '').trim().slice(0, 300);
export async function translateHeadlines(items, { previous = [], request = null, translate = null } = {}) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item && typeof item.title === 'string' && item.title.trim());
  const known = new Map((Array.isArray(previous) ? previous : []).filter((item) => item?.title && isFaithfulKoreanTitle(item.title, item.titleKo)).map((item) => [item.title, item.titleKo]));
  let reused = 0;
  for (const item of list) {
    if (hasHangul(item.title) || item.titleKo) continue;
    if (known.has(item.title)) { item.titleKo = known.get(item.title); reused += 1; }
  }
  const pending = list.filter((item) => !hasHangul(item.title) && !item.titleKo).slice(0, HEADLINE_TRANSLATION_MAX);
  const accept = (strings) => {
    let count = 0;
    pending.forEach((item, index) => {
      const ko = typeof strings[index] === 'string' ? strings[index].replace(/\s+/g, ' ').trim() : '';
      if (isFaithfulKoreanTitle(item.title, ko) && ko.length <= 200) { item.titleKo = ko; count += 1; }
    });
    return count;
  };
  // 2026-10-14: Workers AI first (free daily allowance on the Worker); a refusal or a short answer falls to the shared model.
  let freeReason = null;
  if (pending.length && typeof translate === 'function') {
    let free = null;
    try { free = await translate(pending.map((item) => headlineForTranslation(item.title))); } catch (_) { free = null; }
    if (Array.isArray(free?.translations) && free.translations.length === pending.length) {
      const translated = accept(free.translations);
      if (translated >= Math.ceil(pending.length * 0.8)) return { reused, translated, pending: pending.length, provider: 'workers-ai', model: free.model || null, reason: null };
      pending.forEach((item) => { delete item.titleKo; });
      freeReason = 'workers-ai-low-yield';
    } else freeReason = free?.reason || 'workers-ai-unavailable';
  }
  if (!pending.length || typeof request !== 'function') return { reused, translated: 0, pending: pending.length, reason: pending.length ? 'no-request' : null, ...(freeReason ? { freeReason } : {}) };
  const prompt = ['다음 영어 금융 뉴스 헤드라인을 자연스러운 한국어 기사 제목으로 옮겨라. 고유명사·티커·숫자는 그대로 두고, 뜻을 더하거나 빼지 마라.',
    `시장 용어는 다음처럼 옮긴다: ${HEADLINE_GLOSSARY}.`,
    `출력은 JSON 문자열 배열 하나만, 입력과 같은 순서로 정확히 ${pending.length}개.`,
    JSON.stringify(pending.map((item) => headlineForTranslation(item.title)))].join('\n');
  let result = null;
  try { result = await request(prompt); } catch (_) { result = null; }
  const text = String(result?.text || '');
  let parsed = null;
  try { parsed = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1)); } catch (_) { parsed = null; }
  if (!Array.isArray(parsed) || parsed.length !== pending.length) return { reused, translated: 0, pending: pending.length, reason: result?.reason || 'unparsed', ...(freeReason ? { freeReason } : {}) };
  return { reused, translated: accept(parsed), pending: pending.length, provider: 'shared-openai', reason: null, ...(freeReason ? { freeReason } : {}) };
}

function readEarningsCalendar() {
  try { return JSON.parse(readFileSync(EARNINGS_CALENDAR_OUT, 'utf8')); } catch (_) { return null; }
}

export async function genMarketAnalysis(data, snapshot = null, { previous = null, request = null, nowMs = Date.now(), history = null, narrative = null, earnings = undefined, eventBriefs = undefined, bigtechCashflow = undefined } = {}) {
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  const newsEvidence = buildMarketAnalysisNewsEvidence(data);
  const keep = { previous, nowMs }; // v57.81: every fallback carries the last verified reading forward
  if (metricEvidence.length < 2) return buildMarketAnalysisFallback(data, 'metric-evidence-insufficient', metricEvidence, newsEvidence, keep);
  const narrativeContext = narrative || readNarrativeContext({ nowMs }); // `narrative` is a fixture seam
  // 2026-10-19 data audit: a reading reused across the 08:00 KST day boundary carries no sentence candidate, so the new
  // day's sentence could not be written until the evidence happened to change. The first run of a day whose sentence
  // is still yesterday's writes afresh once (a reading generated earlier that same day is reusable again).
  const sentenceDayOpen = previous?.sentence?.day !== marketSentenceDay(nowMs) && marketSentenceDay(Date.parse(previous?.generatedAt || '') || 0) !== marketSentenceDay(nowMs);
  const headlineContext = buildMarketAnalysisHeadlineContext(data);
  // v59.25: a new after-hours move (whole-percent key) reopens the reading, like a new narrative theme does.
  const afterHoursKey = afterHoursSignature(data?.afterHours);
  // v59.56: the reports whose sessions closed on the latest US close (event-briefs.json) reopen the reading the same way.
  // `history`/`eventBriefs` are fixture seams; the close date comes from the published history like the prompt's.
  const briefsInput = eventBriefs === undefined ? readEventBriefs() : eventBriefs;
  const historyEarly = history || await readHistoryRows();
  const earningsCloseDate = buildCloseSeries(historyEarly, 'spx').at(-1)?.date || null;
  const earningsKey = earningsContextSignature(briefsInput, earningsCloseDate);
  const inputSignature = [narrativeContext.signature || '', afterHoursKey ? `ah:${afterHoursKey}` : '', earningsKey ? `er:${earningsKey}` : ''].filter(Boolean).join('|') || narrativeContext.signature;
  const reused = sentenceDayOpen ? null : reusableMarketAnalysis(previous, { metricEvidence, newsEvidence, headlineContext, narrativeSignature: inputSignature, nowMs });
  if (reused) {
    console.log(`[fetch-data] marketAnalysis evidence and headlines unchanged — reusing verified analysis from ${reused.generatedAt} (no AI call)`);
    return reused;
  }
  // v58.71 (pipeline audit): a blocked attempt kept the old signature, so unchanged inputs never matched the reuse check and
  // every 30-minute run (nights and weekends too) spent two model calls on the same material for up to 12 h. The blocked
  // attempt's inputs (evidence, news, headlines, themes, sentence day) are kept as a key; the same key does not call again.
  const evidenceIds = (rows) => [...new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.evidenceId || '')))].sort().join(',');
  const attemptKey = createHash('sha1').update([evidenceIds(metricEvidence), evidenceIds(newsEvidence), evidenceIds(headlineContext), String(inputSignature || ''), marketSentenceDay(nowMs)].join('|')).digest('hex').slice(0, 16);
  if (previous?.blockedAttemptKey === attemptKey) {
    const reason = previous.retained?.reason || previous.reason || 'analysis-blocked';
    const again = retainVerifiedMarketAnalysis(previous, { reason, nowMs });
    console.log(`[fetch-data] marketAnalysis inputs unchanged since the blocked attempt — no AI call (${again ? 'retained' : 'fallback'})`);
    return { ...(again || buildMarketAnalysisFallback(data, reason, metricEvidence, newsEvidence, keep)), blockedAttemptKey: attemptKey };
  }
  // `request` is a fixture seam (ci contract); production always uses the shared Worker.
  if (!request && !resolveSharedAiConfig()) return buildMarketAnalysisFallback(data, 'shared-ai-not-configured', metricEvidence, newsEvidence, keep);
  const ask = request || requestSharedAnalysis;
  try {
    const changeOf = new Map(snapshotEvidenceRows(snapshot).filter(row => row?.evidenceId && readNumber(row.changePct) != null).map(row => [row.evidenceId, Number(row.changePct)]));
    // T08 (v57.48 review): the briefing shows completed closes, and the commentary under it opened with KOSPI/WTI/DXY/gold
    // in-session moves. Only completed-session values reach the prompt; in-session rows stay out (the validator still
    // requires 장중 + time if one appears). T03: a rate's change is given in bp — its changePct is a relative change of
    // the yield (-0.08% of 5.24% is -0.4bp), which the model wrote as "금리 -0.08%".
    const promptEvidence = metricEvidence.filter((row) => !row.session || MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session));
    const changeText = (row) => {
      if (!changeOf.has(row.evidenceId)) return '';
      const pct = changeOf.get(row.evidenceId);
      if (row.unit === 'percent') { const bp = (row.value - row.value / (1 + pct / 100)) * 100; return ` change=${bp >= 0 ? '+' : ''}${bp.toFixed(1)}bp vs previous close`; }
      return ` change=${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% vs previous close`;
    };
    const evidenceLines = promptEvidence.slice(0, 24).map(row => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${row.basis ? ` (${row.basis})` : ''}${changeText(row)} observedAt=${row.observedAt} session=${row.session || 'n/a'} source=${row.source}`).join('\n');
    // v57.69 (2026-10-15 crash audit): KOSPI fell over 5% in session and the commentary, built from completed closes only,
    // never mentioned it. A Korean move of 3% or more in session is offered on its own, labelled 장중 with its KST time.
    const kstTime = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);
    const koreaIntradayLines = metricEvidence
      .filter((row) => row.metricId === 'market.kospi' && row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session) && Math.abs(changeOf.get(row.evidenceId)) >= KOREA_MOVE_MENTION_PCT)
      .map((row) => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${changeText(row)} 장중 ${kstTime(row.observedAt)} KST 기준(지연 값) session=${row.session}`).join('\n');
    // Live 2026-10-21: KOSPI +3.3% was explained only as "AI 투자심리 회복" while Nasdaq 100 futures were +0.99% — US index
    // futures trade around the clock, so they are in session at every run and never reached the closed-only evidence.
    // The evidence tier's in-session rows (futures, Asian indices mid-session) are offered with 장중 + KST time.
    const crossMarketIntradayLines = metricEvidence
      .filter((row) => EVIDENCE_TIER_METRIC_IDS.includes(row.metricId) && row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session) && changeOf.has(row.evidenceId))
      .map((row) => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${changeText(row)} 장중 ${kstTime(row.observedAt)} KST 기준(지연 값) session=${row.session}`).join('\n');
    // v57.81: the same completed closes feed REGIME_CONTEXT and the validator's completed-close basis for in-session rows.
    const historyRows = historyEarly; // v57.86: `history` is a fixture seam (a dated test must not read rows published after it)
    const regimeContext = buildMarketAnalysisRegimeContext(data, historyRows);
    // v59.25: the after-hours lines are part of the packet the validator checks numbers against.
    const afterHoursLines = afterHoursContextLines(data?.afterHours);
    const earningsLines = earningsContextLines(briefsInput, earningsCloseDate);
    // v59.56: SEC quarterly cash flow (hyperscaler total + the night's big-tech reporters); `bigtechCashflow` is a fixture seam.
    const cashflowLines = cashflowContextLines(bigtechCashflow === undefined ? readBigtechCashflow() : bigtechCashflow, briefsInput, earningsCloseDate, { nowMs });
    const inflationDirection = marketAnalysisInflationDirection(data); // v59.85: the screen's core-inflation direction, one read for prompt and gates
    const validate = (body) => validateMarketAnalysisText(body, data, snapshot, { context: [regimeContext, afterHoursLines, earningsLines, cashflowLines].filter(Boolean).join('\n'), history: historyRows, inflationDirection });
    // v57.75: a large equity move (KOSPI 3% / S&P 500 1%) lets the day's sentence be replaced once (dailyMarketSentence).
    // v57.81: computed before the prompt so the first attempt is told a cause must be attributed (the validator blocks
    // an unattributed reading on such a day; before, only the retry was told and both 10/15 05:55Z/07:52Z attempts failed).
    const largeMove = marketAnalysisLargeMove(metricEvidence, changeOf, data); // 2026-10-19: same rule and headline window as the validator
    const largeMoveDirection = marketAnalysisLargeMoveDirection(metricEvidence, changeOf, data);
    const newsLines = newsEvidence.map(row => `- ${row.evidenceId} ${row.title} [${row.source}] observedAt=${row.observedAt}`).join('\n');
    // 2026-10-21: each headline carries its KST date (date=M/D) so a reason can be cited with the day it was reported.
    const kstDay = (iso) => { const ms = Date.parse(iso || ''); return Number.isFinite(ms) ? mdOf(new Date(ms + 9 * 3600000).toISOString().slice(0, 10)) : '날짜 미상'; };
    const headlineLines = buildMarketAnalysisHeadlineContext(data).map(row => `- ${row.evidenceId} ${row.verification === 'unconfirmed' ? '[미확인 보도] ' : ''}${row.title} [${row.source}] date=${kstDay(row.observedAt)} observedAt=${row.observedAt}`).join('\n');
    // P1719/P1720: post-08:00 headlines are the only news on a Korean session's events before the next bundle; they are
    // labelled provisional so the model does not present them as settled.
    const intradayLines = (Array.isArray(data?.newsIntraday) ? data.newsIntraday : []).slice(0, NEWS_INTRADAY_MAX)
      .filter((row) => row && row.title && row.publishedAt)
      .map((row) => `- [08:00 이후 장중 속보(잠정)] ${row.title} [${row.source || 'unknown'}] date=${kstDay(row.publishedAt)} publishedAt=${row.publishedAt}`).join('\n');
    const reversal = marketAnalysisReversal(metricEvidence, changeOf, buildCompletedCloseBasis(metricEvidence, historyRows));
    // Oil moved -2.6% in session on the Iran-talks headlines; an in-session oil move of 2% or more is offered with 장중 + time.
    const intradayRows = metricEvidence.filter((row) => row.metricId === 'market.wti' && row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session) && Math.abs(changeOf.get(row.evidenceId)) >= 2)
      .map((row) => ({ label: row.label, observedAt: row.observedAt, changePct: changeOf.get(row.evidenceId) }));
    const usCloseDate = buildCloseSeries(historyRows, 'spx').at(-1)?.date || null;
    const usCloseAt = usCloseDate ? `${mdOf(usCloseDate)} 16:00 ET` : null;
    const driversContext = marketDriversContext({ history: historyRows, reversal, intradayRows, earningsLine: nextEarningsLine(earnings === undefined ? readEarningsCalendar() : earnings, usCloseDate), eventsLine: upcomingPoliticalLine(), levelsLine: chartLevelsLine(historyRows) });
    const inflationLine = inflationDirectionLine(data?.macro || {}, { direction: inflationDirection }); // v57.75 / v59.85: INFLATION_DIRECTION on the screen's direction
    const model = SHARED_AI_MODEL;
    const prompt = buildMarketAnalysisPrompt({ inflationLine, regimeContext, evidenceLines, koreaIntradayLines, intradayLines, usCloseAt, afterHoursLines, earningsLines,
      cashflowLines, crossMarketIntradayLines, newsLines, headlineLines, driversContext, narrativeText: narrativeContext.text, largeMove, largeMoveDirection });
    // v57.75: the retained text is re-checked against this run's data — on 10/15 a reading verified before the crash
    // ("원화 강세", easing inflation) would otherwise be re-served for 12 h after the evidence turned.
    // v57.81: the full result goes back so a value quoted for an observation that has since moved a little is not fatal
    // (retainedReadingIssues), and a provider failure keeps the verified reading too instead of the plain fallback.
    // Live 2026-10-21: every run after 08:00 KST was blocked on the body, so the reading was retained without a sentence
    // candidate (marketSentenceReject: no-new-candidate) and the 10/20 sentence stayed all morning. The sentence has its own
    // gate (marketSentenceRejectReason); a candidate from a blocked attempt that passes it still opens the new day.
    const inflationRising = inflationEasingContradicts(data?.macro || {}, inflationDirection);
    let passingSentence = null;
    const noteSentence = (candidate) => {
      if (candidate && !marketSentenceRejectReason(candidate, { inflationRising, largeMoveDirection: largeMove ? largeMoveDirection : null })) passingSentence = candidate;
    };
    const retainOrFallback = (reason) => {
      const carry = passingSentence ? { sentenceCandidate: passingSentence, largeMove, largeMoveDirection } : {};
      const retained = retainVerifiedMarketAnalysis(previous, { reason, nowMs, revalidate: (summary) => validateMarketAnalysisText(summary, data, snapshot, { context: regimeContext, history: historyRows, inflationDirection }) });
      if (retained) {
        console.warn(`[fetch-data] marketAnalysis retained previous verified analysis from ${retained.retained.from}`);
        return { ...retained, ...carry };
      }
      return { ...buildMarketAnalysisFallback(data, reason, metricEvidence, newsEvidence, keep), ...carry };
    };
    const result = await ask(prompt);
    if (!result.text) return retainOrFallback(result.reason || 'provider-empty');
    let { body: text, sentence: sentenceCandidate } = splitMarketSentence(result.text);
    noteSentence(sentenceCandidate);
    let semantic = validate(text);
    // P1719: the rejected text goes to the Actions log only (400 chars), never into a public artifact.
    // v57.81: an attribution block also logs the sentences that named news (300 chars), so the next block is diagnosable —
    // the 10/15 log cut off before the sentence the validator judged.
    const logRejected = (attempt, body, issues) => {
      const newsSentences = issues.includes('causal-attribution-missing')
        ? String(body || '').replace(/\[[^\]]*\]/g, '').split(/(?<=[.?!。])\s+|\n+/).filter((sentence) => /헤드라인|보도|기사|언론|속보|뉴스|according to|headline|reported/i.test(sentence)).join(' / ').replace(/\s+/g, ' ').slice(0, 300)
        : '';
      console.warn(`[fetch-data] marketAnalysis ${attempt} blocked: ${issues.join(',').slice(0, 300)} :: ${String(body || '').replace(/\s+/g, ' ').slice(0, 400)}${issues.includes('causal-attribution-missing') ? ` :: news-sentences=${newsSentences || 'none'}` : ''}`);
    };
    if (!semantic.ok) {
      // P1719: one retry with the validator's reasons; a second block is final for this run.
      logRejected('attempt-1', text, semantic.issues);
      const retryPrompt = buildMarketAnalysisRetryPrompt(prompt, describeMarketAnalysisIssues(text, semantic.issues, metricEvidence, changeOf));
      const retry = await ask(retryPrompt).catch(() => ({ text: null }));
      if (retry.text) {
        ({ body: text, sentence: sentenceCandidate } = splitMarketSentence(retry.text));
        noteSentence(sentenceCandidate);
        semantic = validate(text);
        if (!semantic.ok) logRejected('attempt-2', text, semantic.issues);
      }
    }
    if (!text || !semantic.ok) return { ...retainOrFallback(semantic.issues.join(',')), blockedAttemptKey: attemptKey };
    return { ...buildStructuredMarketAnalysis({ data, text: softenReaderDuty(semantic.text || text), model, status: 'verified', reason: null, metricEvidence, newsEvidence, semantic }), sentenceCandidate, largeMove, largeMoveDirection,
      narrativeSignature: inputSignature, narrativeThemes: narrativeContext.themes.map(({ id, label, telegramCount, recentCount, tickerCount }) => ({ id, label, telegramCount, recentCount, tickerCount })) };
  } catch (error) {
    return buildMarketAnalysisFallback(data, error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error', metricEvidence, newsEvidence, keep);
  }
}

// Publishes one run's market analysis into data.json (split out of fetch-data.mjs main, pipeline redesign 2026-10-19).
export function applyMarketAnalysis(data, marketAnalysis, { previous = null, nowMs = Date.now() } = {}) {
  if (marketAnalysis) {
    // v57.71: one sentence a day — kept from the earlier run of the same 08:00 KST day, else this run's validated line.
    const { sentenceCandidate = null, largeMove = false, largeMoveDirection = null, ...analysis } = marketAnalysis;
    const inflationRising = inflationEasingContradicts(data.macro || {}, marketAnalysisInflationDirection(data));
    data.marketAnalysis = { ...analysis, sentence: dailyMarketSentence({ candidate: sentenceCandidate, previous: previous?.sentence || null, nowMs, largeMove, largeMoveDirection, inflationRising }) };
    // 2026-10-19 data audit: a day's sentence that never replaced yesterday's left no trace; the run now records why.
    data.meta.marketSentenceReject = data.marketAnalysis.sentence?.day === marketSentenceDay(nowMs) ? null
      : (!('sentenceCandidate' in marketAnalysis) ? 'no-new-candidate' : marketSentenceRejectReason(sentenceCandidate, { inflationRising, largeMoveDirection: largeMove ? largeMoveDirection : null }));
    if (data.meta.marketSentenceReject) console.warn(`[fetch-data] daily sentence not replaced: ${data.meta.marketSentenceReject}${sentenceCandidate ? ` :: ${String(sentenceCandidate).slice(0, 120)}` : ''}`);
    data.meta.marketAnalysisOk = marketAnalysis.status === 'verified';
    // P1719: a retained previous verification is still verified prose, but this run's attempt was blocked.
    data.meta.marketAnalysisRetained = marketAnalysis.retained || null;
    data.meta.marketAnalysisSemanticOk = marketAnalysis.status === 'verified' && marketAnalysis.semanticStatus === 'verified' && Array.isArray(marketAnalysis.metricEvidence) && marketAnalysis.metricEvidence.length >= 2 && (!marketAnalysis.semanticIssues || marketAnalysis.semanticIssues.length === 0);
    data.meta.marketAnalysisEvidenceCount = Array.isArray(marketAnalysis.metricEvidence) ? marketAnalysis.metricEvidence.length : 0;
    data.meta.marketAnalysisNewsEvidenceCount = Array.isArray(marketAnalysis.newsEvidence) ? marketAnalysis.newsEvidence.length : 0;
    // P1594: retain the exact blocked reason, never substitute a credentials/budget guess.
    data.meta.marketAnalysisReason = marketAnalysis.status === 'verified' ? null : marketAnalysis.reason;
  } else {
    data.meta.marketAnalysisOk = false;
    data.meta.marketAnalysisSemanticOk = false;
    data.meta.marketAnalysisEvidenceCount = 0;
    data.meta.marketAnalysisNewsEvidenceCount = 0;
    data.meta.marketAnalysisReason = 'analysis-unavailable';
  }
  return data;
}
