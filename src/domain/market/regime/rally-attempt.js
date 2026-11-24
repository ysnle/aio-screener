// v59.57 (X bookmarks 11/02 — damipov "바닥 신호 FTD", shmath8218 "쉬는 것도 매매다", laylaperfume's two scenarios): the
// index follow-through day. AIO counted O'Neil's distribution days (selling under volume) but not the other half of the
// same method: after a correction, the lowest close starts a rally attempt and the first session after it is day 1 (the
// low itself is day 0, as in the source and the IBD convention; counting the low as day 1 would start one session
// early); the count runs while no later close undercuts the low; from day 4 a session up 1.25% or more on
// volume above the prior session is the follow-through day (the method reads it as institutions buying again; price and
// total volume cannot show who bought); a later close below the low fails it. The bookmarked read added the part that
// decides whether it matters — leaders breaking out to new highs within days to three weeks after it — which the screen
// pairs with the S&P 500 new-high count AIO already records. Thresholds: RULES.rallyAttempt. Pure.
// RALLY_COUNT_MODEL stamps the rows the producer writes (fieldMeta.rallyPhase.model); the reader withholds rows counted
// under another model, and the producer rewrites every warmed row of its one-year window on each run.
import { RULES } from '../../rules/thresholds.js';
import { finiteNumber as finite, readNumber } from '../../shared/number.js';
import { resolveMarketCalendarSession } from '../session/market-calendar.js';
import { FOLLOW_THROUGH_WORDS as W } from '../../content/rebound-words.js';

export const RALLY_PHASE = Object.freeze({ none: 0, attempt: 1, confirmed: 2 });
/** The count's definition stamp: v2 counts day 1 from the session after the low (v1, unstamped, counted the low as day 1). */
export const RALLY_COUNT_MODEL = 'rally-attempt.v2';
export const RALLY_COUNT_RULE = 'day 0 = lowest close after a 6% drawdown from the 63-session closing high, day 1 = the next session; follow-through = day 4+ close up 1.25% on volume above the prior session; a close under the day-0 low fails it';

/**
 * Per-session rally-attempt state of an index.
 * @param {Array<{ date: string, close: number, volume: number }>} bars ascending completed sessions
 * @returns {Array<{ date: string, phase: 0|1|2, day: number|null, followThrough: boolean, failed: boolean, lowDate: string|null, lowClose: number|null, gainPct: number|null }>}
 */
export function rallyAttemptSeries(bars = [], rules = RULES.rallyAttempt) {
  const out = [];
  let phase = RALLY_PHASE.none, lowIndex = -1;
  for (let i = 0; i < bars.length; i += 1) {
    const close = finite(bars[i]?.close);
    const date = bars[i]?.date || null;
    if (close == null) { out.push({ date, phase, day: null, followThrough: false, failed: false, lowDate: null, lowClose: null, gainPct: null }); continue; }
    let high = -Infinity;
    for (let j = Math.max(0, i - rules.lookbackSessions + 1); j <= i; j += 1) { const c = finite(bars[j]?.close); if (c != null && c > high) high = c; }
    const prev = i > 0 ? finite(bars[i - 1]?.close) : null;
    const gainPct = prev ? (close / prev - 1) * 100 : null;
    let followThrough = false, failed = false;
    if (phase === RALLY_PHASE.none) {
      if (close <= high * (1 - rules.correctionPct / 100)) { phase = RALLY_PHASE.attempt; lowIndex = i; }
    } else if (close < bars[lowIndex].close) {
      failed = phase === RALLY_PHASE.confirmed;
      phase = RALLY_PHASE.attempt; lowIndex = i;
    } else if (close >= high) {
      phase = RALLY_PHASE.none; lowIndex = -1;
    } else if (phase === RALLY_PHASE.attempt) {
      const day = i - lowIndex; // the low is day 0
      const volume = finite(bars[i]?.volume), prevVolume = finite(bars[i - 1]?.volume);
      if (day >= rules.minDay && gainPct != null && gainPct >= rules.gainPct - 1e-9 && volume != null && prevVolume != null && volume > prevVolume) {
        phase = RALLY_PHASE.confirmed; followThrough = true;
      }
    }
    const inEpisode = phase !== RALLY_PHASE.none && lowIndex >= 0;
    // warmedUp: the 63-session high window is full. Before it the "high" is only the series' own running max, so a
    // correction from an earlier peak is missed; the producer re-runs a 1-year window every refresh and must not
    // overwrite the well-warmed rows it wrote earlier with these cold-start states.
    out.push({ date, phase, day: inEpisode ? i - lowIndex : null, followThrough, failed, warmedUp: i + 1 >= rules.lookbackSessions,
      lowDate: inEpisode ? bars[lowIndex].date : null, lowClose: inEpisode ? bars[lowIndex].close : null, gainPct: gainPct == null ? null : Number(gainPct.toFixed(2)) });
  }
  return out;
}

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const fmt = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
const halfDay = (date) => !!date && resolveMarketCalendarSession({ market: 'US', date }).halfDay === true;

/**
 * The 시장 상태 reading from history rows that carry rallyPhase / rallyDay / followThroughDay (and nasdaq, breadthNewHighs).
 * Returns null outside an episode with no recent follow-through. Words: FOLLOW_THROUGH_WORDS (never the story's 반등 시도).
 * `rule` is the face's one line: the base low and the rule. `shortSession` is the early-close date (NYSE half day) when
 * the volume test that decides the state compared a shortened session — the session tested or the one before it; the
 * rule is unchanged, the reader is told the comparison is not like for like.
 */
export function rallyAttemptRead(history = [], { through = null, rules = RULES.rallyAttempt } = {}) {
  const rows = (history || []).filter((row) => row && readNumber(row.rallyPhase) != null && (!through || String(row.date) <= String(through)));
  if (!rows.length) return null;
  const last = rows.at(-1);
  const phase = Number(last.rallyPhase);
  if (phase === RALLY_PHASE.none) return null;
  const day = Number(last.rallyDay);
  // Weekend and holiday rows carry no rally fields (filtered above), so the low is the latest row whose count is 0 —
  // not `day` rows back from the end.
  let start = rows.length - 1;
  while (start > 0 && readNumber(rows[start].rallyDay) !== 0) start -= 1;
  // Rows the producer counted under another definition (the v1 count, low = day 1) are withheld until its next run
  // rewrites them; rows with no provenance (fixtures, the page's own derivations) are read as they are.
  const otherModel = (row) => { const meta = row?.fieldMeta?.rallyPhase; return !!meta && meta.model !== RALLY_COUNT_MODEL; };
  if (rows.slice(Math.max(0, start - 40)).some(otherModel)) return null;
  const lowRow = rows[start];
  const lowDate = lowRow?.date || null;
  const lowClose = readNumber(lowRow?.nasdaq);
  // A follow-through inside this episode, and whether one failed in the 40 sessions before it began.
  const episode = rows.slice(start);
  const ftdIndex = episode.findIndex((row) => Number(row.followThroughDay) === 1);
  // A follow-through "failed" only when the index undercut the low it rallied from, which restarts day 0 without passing
  // through phase 0. An earlier follow-through that ran on to a new high (phase 0 rows after it) succeeded; counting any
  // follow-through in the 40 sessions before as a failure told the reader a successful signal had failed.
  const before = rows.slice(Math.max(0, start - 40), start);
  const lastFtd = before.map((row) => Number(row.followThroughDay) === 1).lastIndexOf(true);
  const failedEarlier = lastFtd >= 0 && before.slice(lastFtd).every((row) => Number(row.rallyPhase) !== RALLY_PHASE.none);
  // The base low and the rule on one line (the face states both; the story's rebound reads another index and rule).
  // The session after the low is day 1 (the low is day 0), and the face says where the count starts.
  const test = `저점 ${md(lowDate)}${lowClose != null ? `(종가 ${fmt(lowClose)})` : ''} 다음 거래일을 1일째로 세어 ${rules.minDay}일째부터 하루 +${rules.gainPct}% 이상·거래량 전일보다 많으면 ${W.confirmed}`;
  // An early close in the volume test: the tested session (index i of rows) or the session before it.
  const shortAt = (i) => (i < 0 ? null : halfDay(rows[i]?.date) ? rows[i].date : halfDay(rows[i - 1]?.date) ? rows[i - 1].date : null);
  if (phase === RALLY_PHASE.attempt) {
    const toGo = Math.max(0, rules.minDay - day);
    // The session that set the low (11/20, Nasdaq -5.3%) is day 0: no rebound yet, the count starts the next session.
    const lowDay = day === 0;
    const state = lowDay ? `${md(lowDate)} 새 저점 — 반등 일수는 다음 거래일부터` : `저점(${md(lowDate)}) 뒤 ${day}일째, ${W.pending}`;
    const plain = lowDay ? `새 저점을 낸 날이라 반등은 아직 없습니다. 빠르면 ${toGo}거래일 뒤부터 ${W.confirmed}할 수 있습니다.`
      : toGo > 0 ? `빠르면 ${toGo}거래일 뒤부터 ${W.confirmed}할 수 있습니다.`
        : `아직 조건을 채운 날이 없습니다.`;
    const highsNow = readNumber(last.breadthNewHighs);
    const ready = highsNow != null ? ` ${W.confirmed} 뒤 다음 확인점은 주도주 신고가입니다 — 지금 S&P 500 52주 신고가 종목 ${highsNow}개.` : '';
    return { phase: 'attempt', day, lowDate, lowClose, state, shortSession: toGo > 0 ? null : shortAt(rows.length - 1),
      rule: `${test} · 저점 종가 아래 마감이면 다시 셈`,
      plain: `${plain}${failedEarlier ? ` 직전 ${W.name}는 저점을 다시 깨며 ${W.failed}했습니다.` : ''}${ready}` };
  }
  const ftd = ftdIndex >= 0 ? episode[ftdIndex] : null;
  const since = ftd ? episode.length - 1 - ftdIndex : null;
  const prevClose = ftd ? readNumber(rows[start + ftdIndex - 1]?.nasdaq) : null;
  const ftdClose = ftd ? readNumber(ftd.nasdaq) : null;
  const gain = prevClose && ftdClose ? (ftdClose / prevClose - 1) * 100 : null;
  const highs = (row) => (row ? readNumber(row.breadthNewHighs) : null);
  const atFtd = highs(ftd), now = highs(last);
  const leaders = atFtd != null && now != null ? ` S&P 500 52주 신고가 종목은 그날 ${atFtd}개, 지금 ${now}개입니다.` : '';
  const window = since != null && since <= rules.leaderWindowSessions
    ? ` ${W.confirmed} 뒤 며칠에서 3주 안에 주도주가 신고가로 따라 나오는지가 다음 확인점입니다(${since}거래일 지남).`
    : '';
  return { phase: 'confirmed', day, lowDate, lowClose, ftdDate: ftd?.date || null, since, shortSession: ftd ? shortAt(start + ftdIndex) : null,
    state: ftd ? `${W.confirmed}(${md(ftd.date)}${gain != null ? `, +${gain.toFixed(2)}%` : ''})` : W.confirmed,
    rule: `${test} · 저점 종가 아래 마감이면 ${W.failed}`,
    plain: `${ftd ? `저점 뒤 ${Number(ftd.rallyDay)}일째에 ` : ''}${W.index}이 거래량을 늘리며 크게 올랐습니다.${leaders}${window}` };
}
