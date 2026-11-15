// Which market moves the AI market reading must open with (v60.18, weekly audit 2026-11-15 D3/D4/D6). Pure: no I/O.
//
// Before v60.18 the producer kept two hand-picked lists: the completed-close lines named S&P 500, 나스닥 100, SOXX, KOSPI and
// WTI by a fixed 1-day / 5-day edge, and the in-session line admitted WTI at ±2% only. The week of 11/10 the reading
// opened with "WTI 11/10 종가 -0.93%" while the 10-year yield made its largest five-session rise of the year (+29bp), and
// said "미국 시장의 동시 장중 움직임은 확인된 자료가 없습니다" with the S&P 500 +1.44% in session. SOXX was the only
// equity line that cleared its edge most days, so every reading led with the same SOXX sentence.
//
// The size of a move is the market-day ledger's (src/domain/market/day/facts.js priceMove/priceMoveSize on
// RULES.moveMateriality): the last session against the sd of the steps before it, and the five-session leg while the last
// step extends it. Using that one function, the ledger and the reading cannot rank the same day differently. This module
// keeps only what is the reading's own: the labels and name patterns the validator reads the lead back by, the RULES
// absolute edges as a second way in (a crash on a short history), and the in-session slot rule. Lines are listed by size,
// largest first, and the reading's first line follows the first one (validator: priorSessionMoveIssues).
import { RULES } from '../../src/domain/rules/thresholds.js';
import { sessionCloses } from '../../src/domain/market/indices/index-levels.js';
import { closeSessionMarket } from '../../src/domain/market/session/close-series.js';
import { countOpenSessionsBetween } from '../../src/domain/market/session/market-calendar.js';
import { priceMateriality, priceMove, priceMoveSize, sessionStep, sessionStepSd } from '../../src/domain/market/day/facts.js';
import { moveSizeWord, spanMoveGrade } from '../../src/domain/market/session/move-size.js';

export const COMPLETED_MOVE_LINES_MAX = 4;
const MOVE = RULES.moveMateriality;
const READ = RULES.marketReading;
const M = RULES.largeMove;
const L = RULES.leadership;

/**
 * The declared metrics. `label` is what the packet prints (the validator reads the lead back by it); `name` is how the
 * reading may name it; `floor1d`/`floor5d` are the absolute edges kept from RULES (null: volatility rule only);
 * `metricId` is the in-session evidence row (null: not offered in session here — KOSPI has KOREA_LARGE_INTRADAY_MOVE);
 * `nowZ` is the in-session materiality in one-session sd (0: always shown while its session is open) and `nowFloor` the
 * absolute in-session edge used when the history is too short for an sd.
 */
export const MARKET_MOVE_METRICS = Object.freeze([
  { field: 'spx', label: 'S&P 500', unit: 'pct', metricId: 'market.spx', name: /S&P\s?500|S&P|에스앤피/i, floor1d: M.priorSession1dPct, floor5d: M.priorSession5dPct, nowZ: 0, nowFloor: 0 },
  { field: 'ndx', label: '나스닥 100', unit: 'pct', metricId: null, name: /나스닥/, floor1d: L.shockNdx1dPct, floor5d: M.priorSession5dPct, nowZ: null, nowFloor: null },
  { field: 'soxx', label: '반도체(SOXX)', unit: 'pct', metricId: 'market.semis', name: /반도체|\bSOXX\b/, floor1d: L.shockSemis1dPct, floor5d: M.priorSession5dPct, nowZ: READ.inSessionZ, nowFloor: M.dailyDiffOtherPct },
  { field: 'kospi', label: '코스피', unit: 'pct', metricId: null, name: /코스피|\bKOSPI\b/i, floor1d: M.priorSession1dPct, floor5d: M.priorSession5dPct, nowZ: null, nowFloor: null },
  { field: 'tnx', label: '미국 10년물 금리', unit: 'bp', metricId: 'market.us10y', name: /10년물|10년\s?국채|장기\s?금리|10Y/, floor1d: null, floor5d: null, nowZ: READ.inSessionZ, nowFloor: M.dailyDiffTnxBp },
  { field: 'wti', label: 'WTI', unit: 'pct', metricId: 'market.wti', name: /\bWTI\b|(?<![가-힣])(?:국제\s?)?유가|원유/, floor1d: M.priorSession1dPct, floor5d: M.priorSession5dPct, nowZ: READ.inSessionZ, nowFloor: READ.inSessionWtiPct },
  { field: 'gold', label: '금', unit: 'pct', metricId: 'market.gold', name: /(?<![가-힣])금(?:값|\s?가격|\s?선물)?(?=[은는이가을를도의과와·,\s(]|$)|\bGold\b/, floor1d: null, floor5d: null, nowZ: READ.inSessionZ, nowFloor: M.dailyDiffOtherPct },
  { field: 'dxy', label: '달러지수', unit: 'pct', metricId: 'market.dxy', name: /달러\s?(?:지수|인덱스)|\bDXY\b/, floor1d: null, floor5d: null, nowZ: READ.inSessionZ, nowFloor: M.dailyDiffOtherPct },
].map((entry) => Object.freeze({ ...entry, market: closeSessionMarket(entry.field) || 'US' })));

export const moveMetricByLabel = (label) => MARKET_MOVE_METRICS.find((entry) => entry.label === label) || null;
const mdOf = (date) => String(date || '').slice(5).replace('-', '/').replace(/^0/, '').replace('/0', '/');
export const signedMove = (value, unit) => `${value >= 0 ? '+' : ''}${value.toFixed(unit === 'bp' ? 1 : 2)}${unit === 'bp' ? 'bp' : '%'}`;
const closesOf = (history, field) => sessionCloses(history, field).filter((point) => Number(point?.value) > 0);

/**
 * One metric's last completed session, sized by the ledger's priceMove: `size` is priceMoveSize (|z|, or the counted
 * five-session |zWeek|). A step across a gap is no move (the ledger drops that fact too). Without the history for an sd,
 * only the RULES edges can let it in.
 */
export function completedSessionMove(history, entry) {
  const series = closesOf(history, entry.field);
  if (series.length < 2) return null;
  const last = series.at(-1), prior = series.at(-2);
  if (countOpenSessionsBetween(prior.date, last.date, entry.market) !== 1) return null;
  const ledger = priceMove(series, entry.unit);
  const d1 = ledger ? ledger.change : sessionStep(entry.unit, prior.value, last.value);
  const d5 = ledger ? ledger.week : (series.length > MOVE.weekSessions ? sessionStep(entry.unit, series.at(-1 - MOVE.weekSessions).value, last.value) : null);
  const { size, leg } = ledger && ledger.z != null ? priceMoveSize(ledger) : { size: null, leg: null };
  const floor1 = entry.floor1d && d1 != null ? Math.abs(d1) / entry.floor1d : 0;
  const floor5 = entry.floor5d && d5 != null ? Math.abs(d5) / entry.floor5d : 0;
  const qualifies = (size != null && size >= MOVE.unusualZ) || floor1 >= 1 || floor5 >= 1;
  // Ranked by the ledger's size; on a history too short for an sd, an edge counts as unusualZ (it only lets a move in).
  const score = size != null ? size : MOVE.unusualZ * Math.max(floor1, floor5);
  const points = size != null ? priceMateriality(ledger, entry.field) : null; // the ledger's 0-100 weight for this fact
  return { field: entry.field, label: entry.label, unit: entry.unit, market: entry.market, date: last.date, d1, d5, size, leg, points, score, qualifies };
}

/**
 * The completed-session moves the reading must account for, largest first. `ledger` (a market-day.json of the same
 * session, optional) adds what each price explains: a price the ledger raised for the moves it drives (facts.js
 * scoreMateriality, `explains`) ranks by those points, on the same scale (points / pointsPerSd). It only reorders lines
 * that already qualify; it never lets a move in.
 */
export function completedSessionMoves(history = [], { max = COMPLETED_MOVE_LINES_MAX, ledger = null } = {}) {
  const explained = new Map((Array.isArray(ledger?.facts) ? ledger.facts : []).filter((fact) => fact?.kind === 'price' && fact.explains && Number.isFinite(fact.materiality)).map((fact) => [fact.id, fact.materiality]));
  // v59.24: a US line whose last close is older than the latest S&P 500 close is not the 직전 완료 세션 (CL=F kept
  // Friday's settle on Monday morning).
  const usLatest = closesOf(history, 'spx').at(-1)?.date || null;
  return MARKET_MOVE_METRICS.map((entry) => completedSessionMove(history, entry))
    .filter((move) => move && move.qualifies && !(move.market === 'US' && usLatest && move.date < usLatest))
    .map((move) => { const points = explained.get(`price:${move.field}:${move.date}`); return points != null && points / MOVE.pointsPerSd > move.score ? { ...move, score: points / MOVE.pointsPerSd, explainedPoints: points } : move; })
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

/**
 * v60.19: the ledger's size grade (src/domain/market/session/move-size.js, the move against its own one-session sd) of
 * every declared metric's last completed session and of its five sessions — what a size word in the reading must agree
 * with. The prompt prints it (moveSizeLine) and the validator recomputes it from the same history (moveSizeWordIssues).
 * A US metric whose last close is older than the latest S&P 500 close is not the completed session (as above).
 */
export function moveSizeGrades(history = []) {
  const usLatest = closesOf(history, 'spx').at(-1)?.date || null;
  return MARKET_MOVE_METRICS.map((entry) => {
    const series = closesOf(history, entry.field);
    if (series.length < 2) return null;
    const last = series.at(-1), prior = series.at(-2);
    if (countOpenSessionsBetween(prior.date, last.date, entry.market) !== 1 || (entry.market === 'US' && usLatest && last.date < usLatest)) return null;
    const d1 = sessionStep(entry.unit, prior.value, last.value);
    const d5 = series.length > MOVE.weekSessions ? sessionStep(entry.unit, series.at(-1 - MOVE.weekSessions).value, last.value) : null;
    // review v60.19 A4: each leg on the sd of the steps before it (spanMoveGrade), the screen's and the ledger's rule
    return { field: entry.field, label: entry.label, name: entry.name, unit: entry.unit, date: last.date, d1, d5,
      day: spanMoveGrade(series, d1, 1, entry.unit), week: d5 == null ? null : spanMoveGrade(series, d5, MOVE.weekSessions, entry.unit) };
  }).filter((row) => row && (row.day || row.week));
}

export const MOVE_SIZE_HEAD = 'MOVE_SIZE';
/** The prompt's MOVE_SIZE block ('' without grades). */
export function moveSizeLine(grades = []) {
  if (!grades.length) return '';
  const leg = (change, unit, grade) => `${signedMove(change, unit)} ${moveSizeWord(grade)}`;
  return `${MOVE_SIZE_HEAD} (직전 완료 세션의 크기 등급 — 그 지표의 평소 하루 변동에 견준 크기다. 급등·급락·폭등·폭락·큰 폭·크게 오르다/내리다는 '큰 폭'인 움직임에만, 소폭·보합은 '소폭'인 움직임에만 쓴다. '보통'이면 크기 말 없이 방향과 숫자만 쓴다. 블록 이름은 본문에 쓰지 않는다): `
    + grades.map((row) => `${row.label} ${mdOf(row.date)} 하루 ${row.day ? leg(row.d1, row.unit, row.day) : `${signedMove(row.d1, row.unit)} 등급 없음`}${row.d5 != null && row.week ? ` · 5거래일 ${leg(row.d5, row.unit, row.week)}` : ''}`).join(' | ');
}

export const formatCompletedMove =(move) => `${move.label} ${mdOf(move.date)} 종가${move.d1 != null ? ` ${signedMove(move.d1, move.unit)}` : ''}${move.d5 != null ? ` (5거래일 ${signedMove(move.d5, move.unit)})` : ''}`;

/**
 * The in-session rows for the reading's current-session slot: each declared metric whose evidence row is in session and
 * whose change since the previous close reaches its `nowZ` (a rate in bp). `changes` maps evidenceId -> changePct.
 */
export function inSessionMoves(metricEvidence = [], changes = new Map(), history = [], { closedSessions = [] } = {}) {
  const rows = [];
  for (const entry of MARKET_MOVE_METRICS) {
    if (!entry.metricId || entry.nowZ == null) continue;
    const row = (Array.isArray(metricEvidence) ? metricEvidence : []).find((item) => item.metricId === entry.metricId);
    if (!row || !row.session || closedSessions.includes(row.session) || !changes.has(row.evidenceId)) continue;
    const pct = Number(changes.get(row.evidenceId));
    if (!Number.isFinite(pct)) continue;
    const change = entry.unit === 'bp' ? (Number(row.value) - Number(row.value) / (1 + pct / 100)) * 100 : pct;
    const sd = sessionStepSd(closesOf(history, entry.field), entry.unit);
    const z = sd ? Math.abs(change) / sd : null;
    if (!(entry.nowZ === 0 || (z != null ? z >= entry.nowZ : Math.abs(change) >= entry.nowFloor))) continue;
    rows.push({ field: entry.field, label: entry.label, unit: entry.unit, observedAt: row.observedAt, change, z: z ?? 0, always: entry.nowZ === 0 });
  }
  return rows.sort((a, b) => Number(b.always) - Number(a.always) || b.z - a.z);
}
