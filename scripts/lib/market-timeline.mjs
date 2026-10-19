// Market timeline (owner 2026-10-19, cadence redesign): the macro reading keeps its completed 24h cycle (08:00 KST,
// news-selection.mjs), and the micro market read is cut into four KST slots ending 06:00 · 12:00 · 18:00 · 24:00.
// A slot is sealed by the first refresh at or after its end and is never overwritten afterwards, so a reader who missed
// 12:00-18:00 still finds that slot after the 18:00 one lands; the timeline keeps the last eight slots (two days).
// Each slot holds the key quotes at the seal, their moves since the previous sealed slot, the tier 1-2 headlines published
// inside the window (selectNewsIntraday's filters) and a short summary. A thin window is still sealed: the summary says so,
// and no minimum-news gate applies (the 10-item gate stays on the 24h bundle only).
import { selectNewsIntraday } from './news-selection.mjs';

export const MARKET_TIMELINE_SCHEMA = 'market-timeline.v1';
export const MARKET_TIMELINE_POLICY = 'kst-6h-slots-sealed-once';
export const MARKET_SLOT_HOURS_KST = Object.freeze([0, 6, 12, 18]);
export const MARKET_SLOT_RETAIN = 8;
export const MARKET_SLOT_HEADLINE_MAX = 6;
export const MARKET_SLOT_CURRENT_HEADLINE_MAX = 4;
const HOUR = 3600000;
const SLOT_MS = 6 * HOUR;
const KST_OFFSET_MS = 9 * HOUR;
// A slot that ended this long ago can no longer be rebuilt (the RSS pool reaches back about 30 h and quotes only exist now).
const SEAL_HORIZON_MS = 24 * HOUR;
// News collection failed this run: wait for the next run unless the slot ended this long ago.
const NEWS_WAIT_MS = 3 * HOUR;
// Sealed later than this after its end, the slot is labelled late (its quotes are the seal-time values).
const LATE_SEAL_MS = 90 * 60000;
const SUMMARY_RETRY_MS = 3 * HOUR;

// The slot quotes: what moves inside six hours and what a reader checks first. Rates move in bp.
export const MARKET_SLOT_METRICS = Object.freeze([
  ['market.index.kospi', '코스피'], ['market.index.kosdaq', '코스닥'], ['market.index.spx', 'S&P 500'], ['market.index.nasdaq', '나스닥'],
  ['market.fx.usdkrw', '원/달러'], ['market.rates.us10y', '미 10년물'], ['market.fx.dxy', '달러지수'], ['market.commodity.wti', 'WTI'],
  ['market.commodity.gold', '금'], ['market.crypto.btc', '비트코인'], ['market.volatility.vix', 'VIX'],
]);

const iso = (ms) => new Date(ms).toISOString();
const kstParts = (ms) => { const text = new Date(ms + KST_OFFSET_MS).toISOString(); return { date: text.slice(0, 10), md: `${+text.slice(5, 7)}/${+text.slice(8, 10)}`, hm: text.slice(11, 16) }; };

// Slot boundaries fall on 00/06/12/18 KST = 15/21/03/09 UTC, i.e. UTC multiples of 6 h shifted by 3 h.
export function marketSlotEndAtOrBefore(ms) {
  return Math.floor((ms - 3 * HOUR) / SLOT_MS) * SLOT_MS + 3 * HOUR;
}

export function marketSlotWindow(endMs) {
  const startMs = endMs - SLOT_MS;
  const start = kstParts(startMs);
  const end = kstParts(endMs);
  // The slot ending at 00:00 KST belongs to the day it closes: "10/19 18:00~24:00".
  const endHm = end.hm === '00:00' ? '24:00' : end.hm;
  return {
    id: `kst-slot-${iso(endMs)}`, startMs, endMs, start: iso(startMs), end: iso(endMs),
    kstDate: start.date, endLabel: endHm, label: `${start.md} ${start.hm}~${endHm}`,
  };
}

// Slot ends still to seal, oldest first: after the newest sealed end, at or before now, within the rebuild horizon.
export function pendingMarketSlots(previous, nowMs) {
  const sealedEnds = (Array.isArray(previous?.slots) ? previous.slots : []).map((slot) => Date.parse(slot?.end)).filter(Number.isFinite);
  const lastSealed = sealedEnds.length ? Math.max(...sealedEnds) : -Infinity;
  const ends = [];
  for (let end = marketSlotEndAtOrBefore(nowMs); end > lastSealed && end > nowMs - SEAL_HORIZON_MS; end -= SLOT_MS) ends.unshift(end);
  return ends;
}

export function buildMarketSlotMarks(snapshot) {
  const byMetric = new Map((Array.isArray(snapshot?.quotes) ? snapshot.quotes : []).filter((row) => row?.metricId).map((row) => [row.metricId, row]));
  const marks = {};
  for (const [metricId, label] of MARKET_SLOT_METRICS) {
    const row = byMetric.get(metricId);
    const value = Number(row?.value);
    if (!row || !Number.isFinite(value) || !Number.isFinite(Date.parse(row.observedAt))) continue;
    marks[metricId] = { label, value, unit: row.unit || null, observedAt: row.observedAt, session: row.session || null,
      ...(Number.isFinite(Number(row.changePct)) ? { changePct: Number(row.changePct) } : {}) };
  }
  return marks;
}

// Moves inside the window: a quote whose observation advanced since the previous sealed marks. Without previous marks the
// provider's change vs the previous close is used for quotes observed inside the window (first slot after a gap).
export function marketSlotMoves(marks, previousMarks, window) {
  const moves = [];
  for (const [metricId, label] of MARKET_SLOT_METRICS) {
    const mark = marks?.[metricId];
    if (!mark) continue;
    const before = previousMarks?.[metricId];
    const observedMs = Date.parse(mark.observedAt);
    let change = null;
    let basis = null;
    if (before && Number.isFinite(Number(before.value)) && before.observedAt !== mark.observedAt) {
      change = mark.unit === 'percent' ? (mark.value - Number(before.value)) * 100 : (mark.value / Number(before.value) - 1) * 100;
      basis = 'previous-slot';
    } else if (!before && Number.isFinite(mark.changePct) && observedMs >= window.startMs) {
      change = mark.unit === 'percent' ? (mark.value - mark.value / (1 + mark.changePct / 100)) * 100 : mark.changePct;
      basis = 'previous-close';
    }
    if (!Number.isFinite(change) || Math.abs(change) < 0.005) continue;
    moves.push({ metricId, label, change: Math.round(change * 100) / 100, changeUnit: mark.unit === 'percent' ? 'bp' : 'pct', basis, observedAt: mark.observedAt });
  }
  return moves.sort((a, b) => Math.abs(b.change) / (b.changeUnit === 'bp' ? 10 : 1) - Math.abs(a.change) / (a.changeUnit === 'bp' ? 10 : 1));
}

export function selectMarketSlotHeadlines(pool, window, max = MARKET_SLOT_HEADLINE_MAX) {
  const inWindow = (Array.isArray(pool) ? pool : []).filter((row) => Number.isFinite(Number(row?.ts)) && row.ts >= window.startMs && row.ts < window.endMs);
  return selectNewsIntraday(inWindow, { cycleEndMs: window.startMs, nowMs: window.endMs, canonical: [], max })
    .map(({ score, selectionReason, contentDepth, provisional, ...row }) => row);
}

const formatMove = (move) => `${move.label} ${move.change >= 0 ? '+' : ''}${move.change.toFixed(2)}${move.changeUnit === 'bp' ? 'bp' : '%'}`;

export function deterministicSlotSummary({ marks = null, moves = [], headlines = [], newsStatus = 'collected' } = {}) {
  const moved = moves.slice(0, 3).map(formatMove);
  // A catch-up slot (sealed after a missed run) has no quotes of its own: only its headlines are rebuilt.
  const movePart = !marks ? '이 회차는 마감 시점 지표 값이 기록되지 않았고'
    : moved.length ? `${moved.join(' · ')} 움직였고` : '주요 지표는 직전 회차와 같은 값이었고';
  const newsPart = newsStatus === 'unavailable' ? '이 회차는 헤드라인 수집에 실패했습니다.'
    : headlines.length ? `이 시간대 주요 헤드라인 ${headlines.length}건이 수집됐습니다.` : '이 시간대 수집된 주요 헤드라인은 없습니다.';
  return `${movePart}, ${newsPart}`;
}

// The summary carries no number (the moves are shown beside it), no ticker and no trade instruction.
const SLOT_INSTRUCTION = /(?:사세요|사라(?![지졌진질져])|사야|매수(?!세)|매도(?!세)|팔아|팔세요|(?<![가-힣])담(?:아|을|으세요)|들어가라|들어가세요|비중을\s?(?:늘|줄)|추천|확실히|반드시\s?오른|보장)/;
const SLOT_LATIN_ALLOWED = new Set(['AI', 'FED', 'FOMC', 'ECB', 'BOJ', 'BOK', 'OPEC', 'CPI', 'PPI', 'PCE', 'GDP', 'ETF', 'IPO', 'HBM', 'DRAM', 'NAND', 'GPU', 'WTI', 'VIX', 'S&P']);
export function validateMarketSlotSummary(text) {
  const value = String(text || '').replace(/\*\*|__|^#+\s*/gm, '').replace(/\s+/g, ' ').trim();
  if (value.length < 30 || value.length > 360) return null;
  const hangul = (value.match(/[가-힣]/g) || []).length;
  if (hangul < value.replace(/\s/g, '').length * 0.5) return null;
  if (/[0-9%$₩]/.test(value) || /\p{Extended_Pictographic}/u.test(value) || SLOT_INSTRUCTION.test(value)) return null;
  if ((value.match(/\b[A-Z]{2,5}\b/g) || []).some((word) => !SLOT_LATIN_ALLOWED.has(word))) return null;
  if ((value.match(/[.?!。？！]/g) || []).length > 4) return null;
  return value;
}

export function buildMarketSlotPrompt(slot) {
  const moves = slot.moves.length ? slot.moves.map((move) => `- ${formatMove(move)} (${move.basis === 'previous-slot' ? '직전 회차 대비' : '전일 종가 대비'})`).join('\n') : '- 직전 회차 이후 움직인 주요 지표 없음';
  const headlines = slot.headlines.length
    ? slot.headlines.map((row) => `- ${kstParts(Date.parse(row.publishedAt)).hm} KST ${row.verification === 'unconfirmed' ? '[미확인] ' : ''}${row.titleKo || row.title} [${row.source || 'unknown'}]`).join('\n')
    : '- 없음';
  return [
    `아래는 한국 시간 ${slot.label} 여섯 시간 동안의 시장 움직임과 그 사이 발행된 헤드라인이다. 이 시간대 시황을 한국어 2~3문장 평문으로 요약하라.`,
    '순서: 무엇이 움직였나 → 헤드라인에 따르면 무엇이 배경으로 거론됐나 → 다음 회차에 확인할 것. 수치는 화면에 따로 표시되므로 숫자·%·티커는 쓰지 말고 "큰 폭", "소폭"처럼 말로 쓴다.',
    '헤드라인에 없는 원인을 만들지 말고 "…보도에 따르면"으로 귀속하며 한 가지 해석으로만 제시한다. [미확인] 항목은 같은 문장에 "미확인"을 쓴다. 헤드라인이 적으면 적다고 쓴다. 매매 지시·추천·확신 표현은 쓰지 않는다. 제목·목록·마크다운 없이 쓴다.',
    `MOVES:\n${moves}`,
    `HEADLINES:\n${headlines}`,
  ].join('\n\n');
}

async function summarizeSlot(slot, request, nowMs) {
  if (typeof request !== 'function') return null;
  // A window with no move and at most one headline has nothing to summarise beyond the deterministic line.
  if (!slot.moves.length && slot.headlines.length < 2) return null;
  let result = null;
  try { result = await request(buildMarketSlotPrompt(slot)); } catch (_) { result = null; }
  const text = validateMarketSlotSummary(result?.text);
  return text ? { text, source: 'shared-model', generatedAt: iso(nowMs) } : { failed: result?.text ? 'validator-blocked' : (result?.reason || 'provider-empty') };
}

/**
 * Seals every slot that ended since the last sealed one and refreshes the in-progress slot (no I/O).
 * `pool` is the news plane's raw candidate pool (fetchNews(...).slotPool); null when this run reused the previous bundle.
 * Returns the timeline and `newHeadlines` (rows the caller may translate in place before summarizeMarketTimeline).
 */
export function sealMarketTimeline({ previous = null, snapshot = null, pool = null, nowMs = Date.now() } = {}) {
  const prior = previous?.schemaVersion === MARKET_TIMELINE_SCHEMA && Array.isArray(previous.slots) ? previous : null;
  const slots = (prior?.slots || []).map((slot) => ({ ...slot }));
  const newsCollected = Array.isArray(pool);
  const marks = buildMarketSlotMarks(snapshot);
  const pending = pendingMarketSlots(prior, nowMs);
  const sealed = [];
  pending.forEach((endMs, index) => {
    if (!newsCollected && nowMs - endMs < NEWS_WAIT_MS) return;
    const window = marketSlotWindow(endMs);
    const newest = index === pending.length - 1;
    const previousMarks = slots.map((slot) => slot.marks).find((value) => value && Object.keys(value).length) || null;
    const slotMarks = newest && Object.keys(marks).length ? marks : null;
    const moves = slotMarks ? marketSlotMoves(slotMarks, previousMarks, window) : [];
    const headlines = newsCollected ? selectMarketSlotHeadlines(pool, window) : [];
    const slot = {
      id: window.id, start: window.start, end: window.end, kstDate: window.kstDate, label: window.label, endLabel: window.endLabel,
      sealedAt: iso(nowMs), late: nowMs - endMs > LATE_SEAL_MS, marks: slotMarks, moves, headlines,
      headlineCount: headlines.length, newsStatus: newsCollected ? 'collected' : 'unavailable', thin: headlines.length < 2,
    };
    // Two summary attempts for the newest slot (the seal run and the next); older catch-up slots keep this line.
    slot.summary = { text: deterministicSlotSummary(slot), source: 'deterministic', generatedAt: iso(nowMs), retry: newest ? 2 : 0 };
    slots.unshift(slot);
    sealed.push(slot);
  });
  slots.splice(MARKET_SLOT_RETAIN);
  const currentWindow = marketSlotWindow(marketSlotEndAtOrBefore(nowMs) + SLOT_MS);
  const current = {
    start: currentWindow.start, end: currentWindow.end, label: currentWindow.label, endLabel: currentWindow.endLabel, updatedAt: iso(nowMs),
    headlines: newsCollected ? selectMarketSlotHeadlines(pool, { ...currentWindow, endMs: nowMs + 15 * 60000 }, MARKET_SLOT_CURRENT_HEADLINE_MAX)
      : (prior?.current?.end === currentWindow.end ? prior.current.headlines || [] : []),
  };
  const timeline = {
    schemaVersion: MARKET_TIMELINE_SCHEMA, policy: MARKET_TIMELINE_POLICY, slotHoursKst: MARKET_SLOT_HOURS_KST,
    macroBasis: 'kst-0800-completed-24h', retainSlots: MARKET_SLOT_RETAIN, updatedAt: iso(nowMs), slots, current,
  };
  return { timeline, sealed: sealed.map((slot) => slot.id), newHeadlines: [...sealed.flatMap((slot) => slot.headlines), ...current.headlines] };
}

/**
 * One summary request per run (`request`: prompt => {text, reason}): the newest sealed slot still on its deterministic
 * line, with attempts left and sealed less than three hours ago. A sealed slot is otherwise never rewritten.
 */
export async function summarizeMarketTimeline(timeline, { request = null, nowMs = Date.now() } = {}) {
  const target = (timeline?.slots || []).find((slot) => slot.summary?.source === 'deterministic' && slot.summary.retry > 0 && nowMs - Date.parse(slot.sealedAt) < SUMMARY_RETRY_MS);
  if (!target) return null;
  const outcome = await summarizeSlot(target, request, nowMs);
  if (outcome?.text) { target.summary = outcome; return 'verified'; }
  if (outcome?.failed) { target.summary = { ...target.summary, retry: target.summary.retry - 1, reason: outcome.failed }; return outcome.failed; }
  target.summary = { ...target.summary, retry: 0 };
  return typeof request === 'function' ? 'skipped-thin' : 'shared-ai-not-configured';
}

// Self-check for the watchdog and the data gate (ci-data-refresh-audit.mjs). It judges the artifact against its own clock,
// never the wall clock, so an old checked-in data.json does not fail. A producer that has written the timeline once
// (meta.marketTimelineSealed present) must keep writing it; a slot may wait for fresh news at most NEWS_WAIT_MS.
export function auditMarketTimeline(data) {
  const failures = [];
  const warnings = [];
  const timeline = data?.marketTimeline;
  const generatedMs = Date.parse(data?.meta?.generatedAt || '');
  if (!timeline) {
    if (data?.meta && Object.hasOwn(data.meta, 'marketTimelineSealed')) failures.push('market-timeline-missing');
    return { failures, warnings, present: false };
  }
  if (timeline.schemaVersion !== MARKET_TIMELINE_SCHEMA) failures.push(`market-timeline-schema:${timeline.schemaVersion}`);
  const slots = Array.isArray(timeline.slots) ? timeline.slots : [];
  if (slots.length > MARKET_SLOT_RETAIN) failures.push(`market-timeline-retain:${slots.length}`);
  const ends = slots.map((slot) => Date.parse(slot?.end));
  slots.forEach((slot, index) => {
    const start = Date.parse(slot?.start);
    if (!Number.isFinite(start) || ends[index] - start !== SLOT_MS || marketSlotEndAtOrBefore(ends[index]) !== ends[index]) failures.push(`market-timeline-window:${slot?.id}`);
    if (index && !(ends[index - 1] > ends[index])) failures.push(`market-timeline-order:${slot?.id}`);
    if (!slot?.summary?.text) failures.push(`market-timeline-summary-missing:${slot?.id}`);
    if (slot?.summary?.source === 'shared-model' && !validateMarketSlotSummary(slot.summary.text)) failures.push(`market-timeline-summary-unverified:${slot?.id}`);
    if (!Array.isArray(slot?.headlines) || slot.headlines.length > MARKET_SLOT_HEADLINE_MAX || slot.headlines.some((row) => !row?.title || !Number.isFinite(Date.parse(row.publishedAt)) || Date.parse(row.publishedAt) < start || Date.parse(row.publishedAt) >= ends[index])) failures.push(`market-timeline-headlines:${slot?.id}`);
  });
  if (Number.isFinite(generatedMs)) {
    const expected = marketSlotEndAtOrBefore(generatedMs);
    const newest = ends.length ? Math.max(...ends) : -Infinity;
    if (newest < expected) {
      const lagMs = generatedMs - expected;
      if (lagMs > NEWS_WAIT_MS + 15 * 60000) failures.push(`market-timeline-slot-missed:${iso(expected)}`);
      else if (lagMs > LATE_SEAL_MS) warnings.push(`market-timeline-slot-waiting:${iso(expected)}`);
    }
    if (Date.parse(timeline.updatedAt) !== generatedMs && Math.abs(Date.parse(timeline.updatedAt) - generatedMs) > 60 * 60000) warnings.push('market-timeline-updated-apart-from-artifact');
  }
  const retry = slots.find((slot) => slot?.summary?.source === 'deterministic' && slot.summary.reason);
  if (retry) warnings.push(`market-timeline-summary-fallback:${retry.summary.reason}`);
  return { failures, warnings, present: true, slots: slots.length };
}
