// v59.57 (X bookmarks 11/02 — damipov "바닥 신호 FTD", shmath8218 "쉬는 것도 매매다", laylaperfume's two scenarios): the
// index follow-through day. AIO counted O'Neil's distribution days (selling under volume) but not the other half of the
// same method: after a correction, the lowest close is day 1 of a rally attempt; the count runs while no later close
// undercuts it; from day 4 a session up 1.25% or more on volume above the prior session is the follow-through day
// (institutions buying again); a later close below the day-1 close fails it. The bookmarked read added the part that
// decides whether it matters — leaders breaking out to new highs within days to three weeks after it — which the screen
// pairs with the S&P 500 new-high count AIO already records. Thresholds: RULES.rallyAttempt. Pure.

import { RULES } from '../rules/thresholds.js';
import { finiteNumber as finite, readNumber } from '../shared/number.js';

export const RALLY_PHASE = Object.freeze({ none: 0, attempt: 1, confirmed: 2 });

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
      const day = i - lowIndex + 1;
      const volume = finite(bars[i]?.volume), prevVolume = finite(bars[i - 1]?.volume);
      if (day >= rules.minDay && gainPct != null && gainPct >= rules.gainPct - 1e-9 && volume != null && prevVolume != null && volume > prevVolume) {
        phase = RALLY_PHASE.confirmed; followThrough = true;
      }
    }
    const inEpisode = phase !== RALLY_PHASE.none && lowIndex >= 0;
    out.push({ date, phase, day: inEpisode ? i - lowIndex + 1 : null, followThrough, failed,
      lowDate: inEpisode ? bars[lowIndex].date : null, lowClose: inEpisode ? bars[lowIndex].close : null, gainPct: gainPct == null ? null : Number(gainPct.toFixed(2)) });
  }
  return out;
}

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const fmt = (value) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });

/**
 * The 시장 상태 reading from history rows that carry rallyPhase / rallyDay / followThroughDay (and nasdaq, breadthNewHighs).
 * Returns null outside an episode with no recent follow-through.
 */
export function rallyAttemptRead(history = [], { through = null, rules = RULES.rallyAttempt } = {}) {
  const rows = (history || []).filter((row) => row && readNumber(row.rallyPhase) != null && (!through || String(row.date) <= String(through)));
  if (!rows.length) return null;
  const last = rows.at(-1);
  const phase = Number(last.rallyPhase);
  if (phase === RALLY_PHASE.none) return null;
  const day = Number(last.rallyDay);
  // Weekend and holiday rows carry no rally fields (filtered above), so the session that is day 1 is the latest row
  // whose count is 1 — not `day` rows back from the end.
  let start = rows.length - 1;
  while (start > 0 && Number(rows[start].rallyDay) !== 1) start -= 1;
  const lowRow = rows[start];
  const lowDate = lowRow?.date || null;
  const lowClose = readNumber(lowRow?.nasdaq);
  const lowText = `${md(lowDate)} 저점${lowClose != null ? `(종가 ${fmt(lowClose)})` : ''}`;
  // A follow-through inside this episode, and whether one failed in the 40 sessions before it began.
  const episode = rows.slice(start);
  const ftdIndex = episode.findIndex((row) => Number(row.followThroughDay) === 1);
  const before = rows.slice(Math.max(0, start - 40), start);
  const failedEarlier = before.some((row) => Number(row.followThroughDay) === 1);
  if (phase === RALLY_PHASE.attempt) {
    const toGo = Math.max(0, rules.minDay - day);
    const state = `반등 시도 ${day}일째`;
    const plain = toGo > 0
      ? `1일째는 ${lowText}입니다. ${rules.minDay}일째부터 나스닥이 하루 ${rules.gainPct}% 이상 오르면서 거래량이 전날보다 많으면 바닥 확인일(FTD)입니다 — 빠르면 ${toGo}거래일 뒤.`
      : `1일째는 ${lowText}입니다. 아직 하루 ${rules.gainPct}% 이상 오르면서 거래량이 늘어난 날(바닥 확인일)이 없습니다.`;
    const highsNow = readNumber(last.breadthNewHighs);
    const ready = highsNow != null ? ` 바닥 확인일이 나와도 주도주가 신고가로 따라 나와야 힘이 있습니다 — 지금 S&P 500 52주 신고가 종목은 ${highsNow}개입니다.` : '';
    return { phase: 'attempt', day, lowDate, lowClose, state, plain: `${plain} 그 종가 아래로 마감하면 처음부터 다시 셉니다.${failedEarlier ? ' 직전 바닥 확인일은 저점을 다시 깨며 실패했습니다.' : ''}${ready}` };
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
    ? ` 바닥 확인일 뒤 며칠에서 3주 안에 주도주가 신고가로 따라 나오는지가 이 신호의 힘을 가릅니다(${since}거래일 지남).`
    : '';
  return { phase: 'confirmed', day, lowDate, lowClose, ftdDate: ftd?.date || null, since,
    state: ftd ? `바닥 확인일 ${md(ftd.date)}${gain != null ? ` (+${gain.toFixed(2)}%)` : ''}` : '바닥 확인 후',
    plain: `${lowText} 이후${ftd ? ` ${Number(ftd.rallyDay)}일째에` : ''} 나스닥이 거래량을 늘리며 크게 올랐습니다.${leaders}${window} ${md(lowDate)} 종가 아래로 마감하면 실패로 봅니다.` };
}
