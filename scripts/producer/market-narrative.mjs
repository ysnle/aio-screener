// Market reading lane: regime/scenario context for the prompt, headline translation and the verified market analysis.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { RULES } from '../../src/domain/rules/thresholds.js';
import { SHARED_AI_MODEL, requestSharedAnalysis, resolveSharedAiConfig } from '../lib/ai-shared-analysis.mjs';
import { buildCloseSeries } from '../../src/domain/briefing/market-read.js';
import { readNarrativeContext } from '../lib/narrative-context.mjs';
import { renderMarketScenarioModel } from '../../src/domain/market/regime-scenarios.js';
import { renderScenarioOutlookContext } from '../../src/domain/market/scenario-outlook.js';
import { renderMacroCrossroadsContext } from '../../src/domain/market/macro-crossroads.js';
import { renderMarketGuideContext } from '../../src/domain/guide/market-guide.js';
import { interpretationFromArtifacts, marketAnalysisRegimeInput as regimeInputFromArtifacts } from '../lib/market-interpretation-inputs.mjs'; // owner 2026-10-19: one interpretation pipeline
import { NEWS_INTRADAY_MAX } from '../lib/news-selection.mjs';
import { KOREA_MOVE_MENTION_PCT, MARKET_ANALYSIS_CLOSED_SESSIONS, buildCompletedCloseBasis, marketAnalysisReversal, marketAnalysisLargeMove, marketAnalysisLargeMoveDirection, marketSentenceDay, marketSentenceRejectReason, dailyMarketSentence, MARKET_SENTENCE_LABEL, splitMarketSentence, buildMarketAnalysisEvidence, buildMarketAnalysisHeadlineContext, buildMarketAnalysisNewsEvidence, buildStructuredMarketAnalysis, describeMarketAnalysisIssues, retainVerifiedMarketAnalysis, reusableMarketAnalysis, validateMarketAnalysisText, lastVerifiedMarketAnalysis, plainMarketFallbackSummary } from '../lib/market-analysis-validate.mjs';
import { HIST, SCENARIO_STATE_OUT, SCENARIO_OUTCOMES_OUT, EARNINGS_CALENDAR_OUT } from './paths.mjs';
import { MACRO_HISTORY_OUT, MACRO_CALENDAR_OUT } from './macro-history.mjs';

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

export function marketAnalysisRegimeInput(data, history = [], macroHistory = readPublishedMacroHistory()) {
  return regimeInputFromArtifacts(data, history, macroHistory); // owner 2026-10-19: moved to scripts/lib/market-interpretation-inputs.mjs
}

export function buildMarketAnalysisRegimeContext(data, history = []) {
  try {
    // Owner 2026-10-19: one shared interpretation (scripts/lib/market-interpretation-inputs.mjs), the same stages the
    // screens and scenario-state.json read.
    const input = marketAnalysisRegimeInput(data, history);
    const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch (_) { return null; } };
    const state = readJson(SCENARIO_STATE_OUT);
    const interpretation = interpretationFromArtifacts({ data, history, macroHistory: input.macroHistory, calendar: readJson(MACRO_CALENDAR_OUT), outcomes: readJson(SCENARIO_OUTCOMES_OUT), previous: state, nowMs: input.now });
    const { regime, scenarios, outlook } = interpretation;
    if (!regime?.available) return '';
    const axes = (regime.axes || []).map((axis) => `${axis.label || axis.id}: ${axis.state}${axis.read ? ` — ${axis.read}` : ''}`).join('\n');
    // v57.81 (owner 2026-10-15): the trend state with the Nasdaq-100 / Russell 2000 evidence rows and the leadership-break
    // flag travel as their own lines, so the narrative cannot call the trend 양호 or say semis lead while the flag is on.
    const trend = (regime.axes || []).find((axis) => axis.id === 'trend');
    const trendLine = trend ? `추세 판정: ${trend.stateLabel || trend.state}${trend.testing ? ' (50일선 시험 구간)' : ''}${trend.capped ? ' (나스닥 100·러셀 2000 동반 약세로 중립 상한)' : ''} · 근거: ${(trend.evidence || []).map(([label, value]) => `${label} ${value}`).join('; ')}` : '';
    const leadership = regime.leadership;
    const leadershipLine = leadership?.break ? `주도 영역 이탈(leadershipBreak): 예 — ${leadership.summary}. 반도체·AI가 지금도 주도한다고 쓰지 말고, 최근 하락을 함께 적을 것.`
      // v57.83: leaders weak without market-wide confirmation is not "아니오" — the narrative must not say they still lead.
      : leadership?.state === 'weak' ? `주도 영역 이탈(leadershipBreak): 확산 미확인 — ${leadership.summary}. 반도체·AI가 지금도 주도한다고 쓰지 말고, 최근 하락을 함께 적을 것.`
      : leadership?.state === 'holding' ? '주도 영역 이탈(leadershipBreak): 아니오.' : '주도 영역 이탈(leadershipBreak): 확인 불가.';
    const conflicts = (regime.conflicts || []).length ? `엇갈리는 신호: ${regime.conflicts.join(' ')}` : '';
    // Owner 2026-10-18: the semiconductor drawdown travels on its own line so the day's tension is weighed against oil and
    // rates by the size of the move, not by how many headlines a topic got.
    const smhRow = (trend?.evidence || []).find(([label]) => label === '반도체 (SMH)');
    const semisLine = smhRow ? `반도체·AI 주도주: SMH ${smhRow[1]} — 오늘의 긴장을 고를 때 이 하락폭을 유가·금리 변화와 같은 기준(움직임의 크기와 판정 변화)으로 비교할 것.` : '';
    // v57.81: the validator rejects a Korea-vs-US sentence without both session dates when they differ; the packet says so.
    const krDate = buildCloseSeries(input.history, 'kospi').at(-1)?.date || null;
    const sessions = krDate && regime.asOf && krDate !== regime.asOf ? `세션 기준일: 미국 ${regime.asOf.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/')} · 한국 ${krDate.slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/')} — 두 시장을 한 문장에서 함께 말하면 두 날짜(M/D)를 모두 적을 것.` : '';
    return [`종합: ${regime.overall} (양호 ${regime.counts?.favorable ?? '-'} · 부담 ${regime.counts?.burden ?? '-'})`, sessions, priorSessionMoveLines(input.history), trendLine, leadershipLine, semisLine, conflicts, axes,
      renderMarketScenarioModel(scenarios), renderScenarioOutlookContext(outlook), marketAnalysisCrossroadsContext(interpretation, state)].filter(Boolean).join('\n');
  } catch (error) {
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
  for (const [field, label] of [['spx', 'S&P 500'], ['kospi', '코스피'], ['wti', 'WTI']]) {
    const series = buildCloseSeries(history, field).filter((point) => Number(point?.value) > 0);
    if (series.length < 2) continue;
    const last = series.at(-1), prior = series.at(-2), back5 = series.length >= 6 ? series.at(-6) : null;
    const d1 = (last.value / prior.value - 1) * 100;
    const d5 = back5 ? (last.value / back5.value - 1) * 100 : null;
    if (!(Math.abs(d1) >= PRIOR_SESSION_MOVE_1D_PCT || (d5 != null && Math.abs(d5) >= PRIOR_SESSION_MOVE_5D_PCT))) continue;
    lines.push(`${label} ${md(last.date)} 종가 ${signed(d1)}${d5 != null ? ` (5거래일 ${signed(d5)})` : ''}`);
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
  return `다음 대형주 실적(${mdOf(date)}, 미국 시각): ${groups.map(([hour, symbols]) => `${hour ? when[hour] : '시간 미정'} ${symbols.join('·')}`).join(' / ')}`;
}
export function marketDriversContext({ history = [], reversal = null, intradayRows = [], earningsLine = '' } = {}) {
  const prior = priorSessionMoveLines(history).replace(/^직전 완료 세션의 큰 움직임: /, '').replace(/ — .*$/, '');
  const kst = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);
  const now = reversal
    ? `코스피 ${mdOf(reversal.closeDate)} 종가 ${signedPct(reversal.closeChangePct)} 뒤 장중 ${kst(reversal.observedAt)} KST 기준 ${signedPct(reversal.nowChangePct)} — 직전 완료 세션과 반대 방향`
    : '';
  const intraday = intradayRows.map((row) => `${row.label} 장중 ${kst(row.observedAt)} KST 기준 ${signedPct(row.changePct)}`).join(' · ');
  return [
    'MARKET_DRIVERS (해석의 뼈대 — 아래 세 칸을 이 순서로 채운다. 숫자는 METRIC_EVIDENCE·REGIME_CONTEXT·KOREA_LARGE_INTRADAY_MOVE와 아래 장중 값만 쓴다):',
    `- 압력: ${prior || '직전 완료 세션의 큰 움직임 없음 — 가장 최근 완료 종가의 변화'} — 이 움직임에 대해 보도된 이유를 서로 다른 것으로 2~3개 쓴다. 이유마다 "10/20 WSJ 보도에 따르면 …"처럼 HEADLINE_CONTEXT 헤드라인의 날짜(M/D, date= 값)와 출처를 같은 문장에 붙이고, 그 이유가 무엇을 거쳐 어느 쪽(반도체·대형 기술주, 유가, 신용 등)에 닿았는지 한 구절로 잇는다.`,
    `- 지금: ${[now, intraday].filter(Boolean).join(' · ') || '장중 큰 움직임 없음 — 가장 최근 세션'} — 이 움직임에 대해 보도된 이유를 1~3개, 같은 형식(날짜·출처)으로 쓴다. 장중 움직임의 이유는 08:00 이후 장중 속보(잠정)나 그 직전 미국 장 마감 뒤 헤드라인에서만 고르고 잠정이면 "잠정"을 쓴다. 압력의 이유와 지금의 이유를 한 문장에 섞지 않는다.`,
    `- 확인·반증: ${earningsLine || '다음 대형주 실적 일정 미수집'} — 지금 움직임이 이어지려면 무엇이 확인돼야 하고(예: 실적과 설비투자 전망이 반도체·대형 기술주로 이어지는지, 유가·신용이 같은 방향인지) 무엇이 나오면 되돌림으로 보는지 쓴다. 매매 지시·목표가 없이.`,
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
    const parsed = JSON.parse(await readFile(HIST, 'utf8'));
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.history) ? parsed.history : [];
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
export const isFaithfulKoreanTitle = (title, ko) => {
  if (!isCleanKoreanTitle(ko)) return false;
  if (!HEADLINE_NAMES.every(([en, kr]) => !en.test(String(title || '')) || kr.test(String(ko || '')))) return false;
  if (/multi-?billion|\bbillions?\b/i.test(String(title || '')) && !/trillion/i.test(String(title || '')) && /수천억|수조/.test(String(ko || ''))) return false;
  const stated = titleAmounts(title);
  return !stated.length || koreanAmounts(ko).every((amount) => stated.some((value) => Math.abs(amount - value) <= value * 0.01));
};
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
    try { free = await translate(pending.map((item) => item.title.slice(0, 300))); } catch (_) { free = null; }
    if (Array.isArray(free?.translations) && free.translations.length === pending.length) {
      const translated = accept(free.translations);
      if (translated >= Math.ceil(pending.length * 0.8)) return { reused, translated, pending: pending.length, provider: 'workers-ai', model: free.model || null, reason: null };
      pending.forEach((item) => { delete item.titleKo; });
      freeReason = 'workers-ai-low-yield';
    } else freeReason = free?.reason || 'workers-ai-unavailable';
  }
  if (!pending.length || typeof request !== 'function') return { reused, translated: 0, pending: pending.length, reason: pending.length ? 'no-request' : null, ...(freeReason ? { freeReason } : {}) };
  const prompt = ['다음 영어 금융 뉴스 헤드라인을 자연스러운 한국어 기사 제목으로 옮겨라. 고유명사·티커·숫자는 그대로 두고, 뜻을 더하거나 빼지 마라.',
    `출력은 JSON 문자열 배열 하나만, 입력과 같은 순서로 정확히 ${pending.length}개.`,
    JSON.stringify(pending.map((item) => item.title.slice(0, 300)))].join('\n');
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

export async function genMarketAnalysis(data, snapshot = null, { previous = null, request = null, nowMs = Date.now(), history = null, narrative = null, earnings = undefined } = {}) {
  const metricEvidence = buildMarketAnalysisEvidence(data, { snapshot });
  const newsEvidence = buildMarketAnalysisNewsEvidence(data);
  const keep = { previous, nowMs }; // v57.81: every fallback carries the last verified reading forward
  if (metricEvidence.length < 2) return buildMarketAnalysisFallback(data, 'metric-evidence-insufficient', metricEvidence, newsEvidence, keep);
  const narrativeContext = narrative || readNarrativeContext({ nowMs }); // `narrative` is a fixture seam
  // 2026-10-19 data audit: a reading reused across the 08:00 KST day boundary carries no sentence candidate, so the new
  // day's sentence could not be written until the evidence happened to change. The first run of a day whose sentence
  // is still yesterday's writes afresh once (a reading generated earlier that same day is reusable again).
  const sentenceDayOpen = previous?.sentence?.day !== marketSentenceDay(nowMs) && marketSentenceDay(Date.parse(previous?.generatedAt || '') || 0) !== marketSentenceDay(nowMs);
  const reused = sentenceDayOpen ? null : reusableMarketAnalysis(previous, { metricEvidence, newsEvidence, headlineContext: buildMarketAnalysisHeadlineContext(data), narrativeSignature: narrativeContext.signature, nowMs });
  if (reused) {
    console.log(`[fetch-data] marketAnalysis evidence and headlines unchanged — reusing verified analysis from ${reused.generatedAt} (no AI call)`);
    return reused;
  }
  // `request` is a fixture seam (ci contract); production always uses the shared Worker.
  if (!request && !resolveSharedAiConfig()) return buildMarketAnalysisFallback(data, 'shared-ai-not-configured', metricEvidence, newsEvidence, keep);
  const ask = request || requestSharedAnalysis;
  try {
    const changeOf = new Map((snapshot?.quotes || []).filter(row => row?.evidenceId && Number.isFinite(Number(row.changePct))).map(row => [row.evidenceId, Number(row.changePct)]));
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
    const evidenceLines = promptEvidence.slice(0, 16).map(row => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${row.basis ? ` (${row.basis})` : ''}${changeText(row)} observedAt=${row.observedAt} session=${row.session || 'n/a'} source=${row.source}`).join('\n');
    // v57.69 (2026-10-15 crash audit): KOSPI fell over 5% in session and the commentary, built from completed closes only,
    // never mentioned it. A Korean move of 3% or more in session is offered on its own, labelled 장중 with its KST time.
    const kstTime = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);
    const koreaIntradayLines = metricEvidence
      .filter((row) => row.metricId === 'market.kospi' && row.session && !MARKET_ANALYSIS_CLOSED_SESSIONS.includes(row.session) && Math.abs(changeOf.get(row.evidenceId)) >= KOREA_MOVE_MENTION_PCT)
      .map((row) => `- ${row.evidenceId} ${row.label}=${row.value} ${row.unit}${changeText(row)} 장중 ${kstTime(row.observedAt)} KST 기준(지연 값) session=${row.session}`).join('\n');
    // v57.81: the same completed closes feed REGIME_CONTEXT and the validator's completed-close basis for in-session rows.
    const historyRows = history || await readHistoryRows(); // v57.86: `history` is a fixture seam (a dated test must not read rows published after it)
    const regimeContext = buildMarketAnalysisRegimeContext(data, historyRows);
    const validate = (body) => validateMarketAnalysisText(body, data, snapshot, { context: regimeContext, history: historyRows });
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
    const driversContext = marketDriversContext({ history: historyRows, reversal, intradayRows, earningsLine: nextEarningsLine(earnings === undefined ? readEarningsCalendar() : earnings, usCloseDate) });
    const macroNow = data?.macro || {};
    const signed = (value) => `${Number(value) >= 0 ? '+' : ''}${value}`;
    const inflationLine = Number.isFinite(Number(macroNow.cpi)) && Number.isFinite(Number(macroNow.cpiDelta))
      ? `INFLATION_DIRECTION: 미국 CPI 전년비 ${macroNow.cpi}% (직전 달 대비 ${signed(macroNow.cpiDelta)}%p)${Number.isFinite(Number(macroNow.coreCpi)) ? `, 근원 ${macroNow.coreCpi}% (${signed(macroNow.coreCpiDelta)}%p)` : ''}, 기준월 ${String(macroNow._asOf_cpi || '').slice(0, 7) || '미확인'}. `
        + (Number(macroNow.cpiDelta) > 0 || Number(macroNow.coreCpiDelta) > 0 ? '물가는 오르는 중이다 — "물가 둔화"라고 쓰지 마라.' : '물가 방향을 이 값 밖에서 추정하지 마라.')
      : '';
    const model = SHARED_AI_MODEL;
    const prompt = [
      '아래 근거로 시장 해석을 반드시 한국어로만 작성하라(영어 문장 금지). 제목·마크다운 헤더 없이 7~9줄 평문으로 쓴다. Write the whole answer in Korean.',
      '순서: (1) MARKET_DRIVERS의 압력·지금 두 칸 — 무엇이 얼마나 바뀌었고(완료 종가는 날짜 M/D와 METRIC_EVIDENCE·REGIME_CONTEXT의 change 값, 장중 값은 "장중 HH:MM KST") 그 움직임마다 보도된 이유가 무엇인가(이유마다 헤드라인 날짜·출처) (2) 그 변화가 REGIME_CONTEXT의 어느 축·흐름과 맞물리는가 (3) 지금 조건에 가장 가까운 흐름 — 반드시 흐름·시나리오 이름과 함께("「이름」 — 조건 충족 n/m"), 숫자만 단독으로 쓰지 않는다. 단 REGIME_CONTEXT의 판정 문장이 "어느 흐름이라고 보기 이릅니다"·"중심 시나리오를 정하지 않습니다"라고 하면(시나리오 설명 속 "…라고 보기 이릅니다"는 판정이 아니다) 그 판정을 먼저 그대로 쓰고, 가장 많이 맞는 흐름은 "핵심 조건 미충족"과 함께만 언급하며 그 흐름을 결론처럼 쓰지 않는다 (4) 향후 시나리오: REGIME_CONTEXT의 【향후 시나리오】에서 다음 발표(날짜)과 조건이 가장 많이 맞는 시나리오, 시장 가격이 같은 방향인지, 금리 괴리가 있으면 그 뜻 — 인과(무엇이 무엇을 거쳐 주가에 닿는지)를 한 문장으로 (5) 그 시나리오라면 선택지(관망·분할 접근·보유 유지·방어 전환)별 기회비용과 상대적으로 유리한 쪽(중심 시나리오가 없으면 "유리한 쪽"을 정하지 말고 각 시나리오로 갈 때 무엇이 바뀌는지만), 반대 시나리오로 가면 무엇이 바뀌는지, 【테마 시나리오】가 있으면 그 시나리오에서 수혜·부담인 테마와 추세 속 조정 테마를 한 문장으로 (6) MARKET_DRIVERS의 확인·반증 칸: 다음에 확인할 것(일정 포함)과 이 해석이 틀렸다고 볼 반증 조건. 지표를 나열만 하거나 "두 지표는 서로 다르다"처럼 정보가 없는 문장은 쓰지 마라.',
      '가격·수량·시점·특정 종목 매매 지시(사라/팔아라, 목표가, "비중을 늘리세요" 같은 명령)는 쓰지 않는다. 대신 시나리오별 선택지의 기회비용과 "이 시나리오라면 상대적으로 유리한 쪽"은 REGIME_CONTEXT 근거로 쓴다(소유자 2026-10-13). 가능성은 조건 충족 n/m · 시장 가격 방향 · 과거 빈도(표본 수와 함께)로만 말하고 %·확률 숫자를 만들지 마라. 세부 종목 선택은 사용자가 차트·기업·테마·스크리너에서 한다고 밝혀도 된다.',
      '각 변화율은 반드시 그 지표 이름 바로 뒤에 쓴다(예: "코스피 -1.2%"). 다른 지표의 변화율을 앞 지표 이름에 붙이지 마라. 금리(10Y)의 변화는 bp로만 쓰고 %로 쓰지 마라(금리 수준만 % 단위).',
      'METRIC_EVIDENCE에는 완료된 종가만 들어 있다. 장중 값은 KOREA_LARGE_INTRADAY_MOVE·MARKET_DRIVERS에 적힌 것만 쓴다. 장중 값을 언급하면 "장중"과 관측 시각(예: 13:05 KST)을 같은 문장에 쓰고 "마감·종가"라고 쓰지 마라.',
      'Every numeric claim must be supported by one or more supplied METRIC_EVIDENCE ids.',
      'Do not treat VIX and Fear&Greed as the same metric, and do not spend a sentence saying they differ. Do not invent missing values. Return 7-9 concise lines.',
      // v57.75: the CPI direction is stated so the model does not infer "물가 둔화" from falling yields (blocked, then retried).
      ...(inflationLine ? [inflationLine] : []),
      'REGIME_CONTEXT (deterministic reading from the same completed closes the site shows; cite as [regime-context]):\n' + (regimeContext || 'none'),
      'METRIC_EVIDENCE:\n' + evidenceLines,
      ...(koreaIntradayLines ? ['KOREA_LARGE_INTRADAY_MOVE (장중 지연 값 — 반드시 한 줄로 언급하라: "코스피 장중 HH:MM KST 기준 -x.xx%"처럼 장중과 시각을 같은 문장에 쓰고 마감·종가라고 쓰지 마라. ' + (intradayLines
        // v57.75 (crash audit): HEADLINE_CONTEXT is the 08:00 bundle, written before the Korean session — on 10/15 the model
        // pinned a −7.8% intraday drop on those older headlines and called the won "강세" while USD/KRW rose. The cause may
        // only come from post-08:00 headlines; without them the line says the cause headline was not collected.
        // 2026-10-21: the overnight drivers of the +4.48% rebound (WSJ "Stocks Make a U-Turn…" 05:18 KST, SpaceX capex
        // 07:33 KST) came after the US close but before 08:00; headlines after the US close count, the day before's do not.
        ? `원인은 아래 "08:00 이후 장중 속보(잠정)" 헤드라인(잠정이라고 표시)이나 직전 미국 장 마감(${usCloseAt || '미국 종가 시각'}) 뒤에 나온 HEADLINE_CONTEXT 헤드라인에만 귀속하라. 그보다 이전 헤드라인을 장중 움직임의 원인으로 쓰지 마라`
        : '08:00 이후 장중 헤드라인이 없다. 원인을 추정하지 말고 "장중 원인 헤드라인 미수집"이라고 쓴다') + '. 원화 방향은 USD/KRW 값으로만 판단한다(USD/KRW 상승 = 원화 약세)):\n' + koreaIntradayLines] : []),
      'NEWS_CLUSTERS (article-level evidence, may be absent):\n' + (newsLines || 'none'),
      'HEADLINE_CONTEXT (retained headlines — titles only; these are the only news material available):\n' + (headlineLines || 'none')
        + (intradayLines ? '\n08:00 이후 장중 속보(잠정 — 다음 08:00 묶음 전의 미확정 헤드라인, 인용 시 "잠정"으로 표시):\n' + intradayLines : ''),
      driversContext,
      // Owner 2026-10-18: the stories the 08:00 bundle missed (AI funding, memory, deleveraging …) from AIO's own Telegram
      // digest and mover headlines, with the analysis note that says how to read each. Weighting, not evidence.
      ...(narrativeContext.text ? ['NARRATIVE_CONTEXT (지난 72시간 2차 자료: 리서치 텔레그램 채널 중계와 5거래일 급등락 종목의 헤드라인. 사실 확정이 아니라 지금 시장이 어떤 이야기에 무게를 두는지 보여 주는 참고다. 쓰는 법: (a) 오늘의 긴장과 (2)~(6)의 주제를 고를 때 HEADLINE_CONTEXT의 건수만 보지 말고 REGIME_CONTEXT의 움직임 크기와 여기의 언급 비중을 함께 본다 (b) 인용하면 "리서치 채널 중계에 따르면"·"…보도에 따르면"으로 귀속하고 한 가지 해석으로 제시한다 (c) [루머]·[미확인·익명 소식통] 항목은 같은 문장에 "루머" 또는 "미확인"을 쓰고 원인으로 단정하지 않는다 (d) 여기의 숫자·종목명·티커는 METRIC_EVIDENCE가 아니므로 쓰지 않는다 (e) 같은 주제에 강세 측 반론이 있으면 함께 적어 한쪽으로 기울지 않는다 (f) "읽는 틀"은 그 주제를 확인하는 순서다 — 다음에 확인할 것(6)에 활용한다):\n' + narrativeContext.text] : []),
      'DIRECTIONAL/CAUSAL PROSE: you may offer a directional or causal reading, but attribute it to the named headline ("헤드라인에 따르면", "According to <source>") and present it as one reading among alternatives, never as a confirmed fact. End with what would invalidate the reading and what the reader should check. The final decision belongs to the reader, not to this text.',
      ...(largeMove ? ['LARGE_MOVE (S&P 500 1% 이상 또는 코스피 3% 이상): 보도된 배경을 반드시 한 문장으로 쓴다 — "헤드라인에 따르면 …이 배경으로 거론됐다"처럼 HEADLINE_CONTEXT(장중 움직임이면 08:00 이후 장중 속보) 헤드라인 하나를 이름과 함께 든다. 그 문장 안에서 "단정할 수 없다·확인되지 않았다"로 귀속을 지우지 말고, 다른 해석이 있다는 점은 다음 문장에 쓴다.'] : []),
      // v57.71 (owner 2026-10-15): the home's one-sentence line, written by the same call (no extra request).
      `마지막에 7~9줄과 별도로 한 줄을 더 쓴다: "${MARKET_SENTENCE_LABEL} " 뒤에 지금 시장을 관통하는 긴장을 질문이나 대비로 담은 한 문장(40자 안팎). 숫자·%·종목명·지수명·티커·매매 지시 없이(영문 약어는 AI만 쓴다, 예: HBM·D램 대신 메모리), 오늘의 근거(METRIC_EVIDENCE·HEADLINE_CONTEXT·REGIME_CONTEXT)에서 나온 갈림을 담는다. 갈림의 주제는 REGIME_CONTEXT에서 가장 크게 움직였거나 판정이 바뀐 영역(예: 반도체·AI 주도주 급락, 신용 확대, 유가)에서 고르고, 헤드라인이 많다는 이유만으로 고르지 않는다. ${largeMoveDirection === 'down' ? '오늘은 큰 하락이 마감됐다: 긴장은 그 하락(반등 실패·재하락·낙폭 확대 중 사실에 맞는 것)에서 출발하고, 하락이라는 사실을 문장 안에 쓴다. 소진·바닥·회복만으로 짜인 문장은 쓰지 않는다.' : largeMoveDirection === 'up' ? '오늘은 큰 상승이 마감됐다: 긴장은 그 반등·상승에서 출발하고, 상승이라는 사실을 문장 안에 쓴다.' : largeMoveDirection === 'mixed' ? '오늘은 미국과 한국 장이 엇갈렸다(한쪽의 큰 움직임 뒤 다른 쪽이 반대로 마감): 긴장은 그 엇갈림에서 출발한다. 하락만 또는 상승만 쓰지 말고, 두 방향을 함께 담거나 방향 대신 그 사이의 질문(무엇이 이어질지)을 쓴다.' : '큰 움직임이 없는 날에만, 바닥 확인 조건이 있으면 그 갈림(소진 대 확인)을 담아도 된다.'} 문체 예시(그대로 쓰지 말 것): "오늘의 하락은 기회인가, 서사의 끝을 알리는 신호인가?" / "누군가는 이날을 기다렸고, 누군가는 이날을 기점으로 떠날 것이다."`,
    ].join('\n\n');
    // v57.75: the retained text is re-checked against this run's data — on 10/15 a reading verified before the crash
    // ("원화 강세", easing inflation) would otherwise be re-served for 12 h after the evidence turned.
    // v57.81: the full result goes back so a value quoted for an observation that has since moved a little is not fatal
    // (retainedReadingIssues), and a provider failure keeps the verified reading too instead of the plain fallback.
    // Live 2026-10-21: every run after 08:00 KST was blocked on the body, so the reading was retained without a sentence
    // candidate (marketSentenceReject: no-new-candidate) and the 10/20 sentence stayed all morning. The sentence has its own
    // gate (marketSentenceRejectReason); a candidate from a blocked attempt that passes it still opens the new day.
    const inflationRising = Number(data?.macro?.cpiDelta) > 0 || Number(data?.macro?.coreCpiDelta) > 0;
    let passingSentence = null;
    const noteSentence = (candidate) => {
      if (candidate && !marketSentenceRejectReason(candidate, { inflationRising, largeMoveDirection: largeMove ? largeMoveDirection : null })) passingSentence = candidate;
    };
    const retainOrFallback = (reason) => {
      const carry = passingSentence ? { sentenceCandidate: passingSentence, largeMove, largeMoveDirection } : {};
      const retained = retainVerifiedMarketAnalysis(previous, { reason, nowMs, revalidate: (summary) => validateMarketAnalysisText(summary, data, snapshot, { context: regimeContext, history: historyRows }) });
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
      const retryPrompt = prompt + '\n\nPREVIOUS_ATTEMPT_REJECTED (자동 검증기가 직전 답을 아래 이유로 차단했다. 같은 오류 없이 처음부터 다시 쓴다. 날짜·시각 숫자를 지표 이름 바로 뒤에 두지 말고, 지표 수준·변화는 METRIC_EVIDENCE 값만 쓴다):\n'
        + describeMarketAnalysisIssues(text, semantic.issues, metricEvidence, changeOf);
      const retry = await ask(retryPrompt).catch(() => ({ text: null }));
      if (retry.text) {
        ({ body: text, sentence: sentenceCandidate } = splitMarketSentence(retry.text));
        noteSentence(sentenceCandidate);
        semantic = validate(text);
        if (!semantic.ok) logRejected('attempt-2', text, semantic.issues);
      }
    }
    if (!text || !semantic.ok) return retainOrFallback(semantic.issues.join(','));
    return { ...buildStructuredMarketAnalysis({ data, text: semantic.text || text, model, status: 'verified', reason: null, metricEvidence, newsEvidence, semantic }), sentenceCandidate, largeMove, largeMoveDirection,
      narrativeSignature: narrativeContext.signature, narrativeThemes: narrativeContext.themes.map(({ id, label, telegramCount, recentCount, tickerCount }) => ({ id, label, telegramCount, recentCount, tickerCount })) };
  } catch (error) {
    return buildMarketAnalysisFallback(data, error?.name === 'AbortError' ? 'provider-timeout' : 'provider-error', metricEvidence, newsEvidence, keep);
  }
}

// Publishes one run's market analysis into data.json (split out of fetch-data.mjs main, pipeline redesign 2026-10-19).
export function applyMarketAnalysis(data, marketAnalysis, { previous = null, nowMs = Date.now() } = {}) {
  if (marketAnalysis) {
    // v57.71: one sentence a day — kept from the earlier run of the same 08:00 KST day, else this run's validated line.
    const { sentenceCandidate = null, largeMove = false, largeMoveDirection = null, ...analysis } = marketAnalysis;
    const inflationRising = Number(data.macro?.cpiDelta) > 0 || Number(data.macro?.coreCpiDelta) > 0;
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
