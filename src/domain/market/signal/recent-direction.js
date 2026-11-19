// A level state and a recent direction are two readings of two numbers. "지수를 받치던
// 주도주가 함께 약해지고 있습니다" stood on SOXX's level (50-day line -10~15%, high -29~32%) through +7.49% and +6.01% days,
// and "VIX 17.49 … 5일 +5% 올라" compared 11/11 with 11/4 (16.61) across the 11/5 spike to 28.18 — the same close series
// and dates, but an endpoint difference that hid the leg ending today. The level stays with each axis rule; this module
// names only the direction, from the completed closes, and always says which points it compared.
//
// The window is the last `sessions` + 1 closes. The current leg starts at the window's latest turn: when today is past
// the window's high (low), the turn is the low (high) before it; otherwise it is the later of the window's high and low.
// The earlier leg runs from the opposite extreme before that turn to the turn. A turn counts when the earlier leg is at
// least one typical day and a quarter of the current leg (a dip of 0.07 under the base before a 12% rise is not a turn);
// without one, the current leg is the net change from the window's first close. The current leg is the direction ("…
// 중") when it is at least one typical day, over any number of sessions; a smaller leg after a counted turn is a pause
// after the earlier leg, and a smaller net change is 횡보. "Typical day" = the median absolute session change over the
// `typicalSessions` steps before today.
import { median } from '../../themes/theme-medians.js';
import { signedText } from '../../shared/number.js';
import { shortDate } from '../../content/date-labels.js';

export const RECENT_DIRECTION_RULE = Object.freeze({ sessions: 5, typicalSessions: 20, turnShareOfLeg: 0.25 });
const DELTA = Object.freeze({ pct: (now, then) => (now / then - 1) * 100, bp: (now, then) => (now - then) * 100, pt: (now, then) => now - then });
const UNIT_TEXT = Object.freeze({ pct: '%', bp: 'bp', pt: 'pt' });
const point = (row) => ({ date: row.date, value: row.value });
const argBy = (list, better) => list.reduce((best, row, index) => (better(row.value, list[best].value) ? index : best), 0);

/**
 * @param {{date:string,value:number}[]} series completed closes, oldest first, through the basis
 * @param {{unit?:'pct'|'bp'|'pt', sessions?:number, typicalSessions?:number}} [options]
 * @returns {null|{dir:'up'|'down'|'flat', turned:boolean, change:number, from:{date:string,value:number},
 *   to:{date:string,value:number}, legSessions:number, prior:null|{dir:'up'|'down', change:number, from:object, to:object},
 *   net:number, typical:number|null, sessions:number, unit:string}}
 */
export function recentDirection(series, { unit = 'pct', sessions = RECENT_DIRECTION_RULE.sessions, typicalSessions = RECENT_DIRECTION_RULE.typicalSessions } = {}) {
  const points = (Array.isArray(series) ? series : []).filter((row) => row?.date && Number.isFinite(row.value) && (unit !== 'pct' || row.value > 0));
  if (points.length < sessions + 1) return null;
  const delta = DELTA[unit] || DELTA.pct;
  const frame = points.slice(-1 - sessions);
  const before = frame.slice(0, -1), to = frame.at(-1), base = frame[0];
  const history = points.slice(-2 - typicalSessions, -1); // the typical day is measured before today's step
  const steps = history.slice(1).map((row, index) => Math.abs(delta(row.value, history[index].value)));
  const typical = steps.length >= Math.ceil(typicalSessions / 2) ? median(steps) : null;
  const floor = typical ?? 0;
  const net = delta(to.value, base.value);
  const high = argBy(before, (a, b) => a > b), low = argBy(before, (a, b) => a < b);
  // the latest turn and the opposite extreme before it
  let turn, opposite;
  if (to.value >= before[high].value) { turn = low; opposite = argBy(before.slice(0, low + 1), (a, b) => a > b); }
  else if (to.value <= before[low].value) { turn = high; opposite = argBy(before.slice(0, high + 1), (a, b) => a < b); }
  else { turn = Math.max(high, low); opposite = Math.min(high, low); }
  const leg = delta(to.value, before[turn].value);
  const priorChange = turn > opposite ? delta(before[turn].value, before[opposite].value) : 0;
  const counted = priorChange !== 0 && Math.abs(priorChange) >= Math.max(floor, Math.abs(leg) * RECENT_DIRECTION_RULE.turnShareOfLeg);
  const sign = (value) => (value > 0 ? 'up' : value < 0 ? 'down' : 'flat');
  if (!counted) {
    return { dir: Math.abs(net) < floor ? 'flat' : sign(net), turned: false, change: net, from: point(base), to: point(to), legSessions: sessions, prior: null, net, typical, sessions, unit };
  }
  return { dir: Math.abs(leg) < floor || leg === 0 ? 'flat' : sign(leg), turned: true, change: leg, from: point(before[turn]), to: point(to), legSessions: frame.length - 1 - turn,
    prior: { dir: sign(priorChange), change: priorChange, from: point(before[opposite]), to: point(before[turn]) }, net, typical, sessions, unit };
}

/**
 * The reading's shape for number-free text: 'up', 'down', 'downAfterUp', 'holdAfterUp', 'holdAfterDown', 'flat' (an up
 * leg after a down leg is a rebound and reads 'up'); null without a reading.
 */
export function directionKey(reading) {
  if (!reading) return null;
  const after = reading.prior?.dir;
  if (reading.dir === 'flat') return after === 'up' ? 'holdAfterUp' : after === 'down' ? 'holdAfterDown' : 'flat';
  if (reading.dir === 'down') return after === 'up' ? 'downAfterUp' : 'down';
  return 'up';
}

const DAYS = ['', '하루', '이틀', '사흘', '나흘'];
const daysText = (n) => DAYS[n] || `${n}거래일`;

/**
 * The direction as a predicate with the points it compared: '5거래일 +3.5% 반등 중입니다', '11/5 28.18에서 -38% 내려온 뒤
 * 11/11 17.49부터 이틀 +10% 반등 중입니다', '11/5 131.90에서 +17.8% 오른 뒤 11/11 155.40부터 하루 -0.3%로 방향이 뚜렷하지
 * 않습니다'. Only the leg that ends today is written as "… 중".
 */
export function directionPredicate(reading, { below = false, digits = 1, valueDigits = 2 } = {}) {
  if (!reading) return null;
  const u = UNIT_TEXT[reading.unit] || '%';
  const signed = (value) => signedText(value, digits, u);
  const at = (row) => `${shortDate(row.date)} ${row.value.toLocaleString('en-US', { minimumFractionDigits: valueDigits, maximumFractionDigits: valueDigits })}`;
  if (!reading.turned) {
    const span = `${reading.sessions}거래일 ${signed(reading.change)}`;
    if (reading.dir === 'flat') return `${span}로 뚜렷한 방향이 없습니다`;
    return `${span} ${reading.dir === 'up' ? (below ? '반등' : '상승') : '하락'} 중입니다`;
  }
  const { prior } = reading;
  const earlier = `${at(prior.from)}에서 ${signed(prior.change)} ${prior.dir === 'up' ? '오른' : '내려온'} 뒤`;
  const leg = `${at(reading.from)}부터 ${daysText(reading.legSessions)} ${signed(reading.change)}`;
  if (reading.dir === 'flat') return `${earlier} ${leg}로 방향이 뚜렷하지 않습니다`;
  return `${earlier} ${leg} ${reading.dir === 'up' ? (prior.dir === 'down' || below ? '반등' : '상승') : '하락'} 중입니다`;
}

/**
 * The same reading as an evidence value — the points compared and one fixed direction word, no sentence:
 * '5거래일 +3.5% 반등', '11/3 155.00 → 11/5 131.90 -14.9%, 이후 이틀 +11.3% 반등', '… 이후 하루 -0.3% 횡보'.
 */
export function directionFacts(reading, { below = false, digits = 1, valueDigits = 2 } = {}) {
  if (!reading) return null;
  const u = UNIT_TEXT[reading.unit] || '%';
  const signed = (value) => signedText(value, digits, u);
  const at = (row) => `${shortDate(row.date)} ${row.value.toLocaleString('en-US', { minimumFractionDigits: valueDigits, maximumFractionDigits: valueDigits })}`;
  const { prior } = reading;
  const word = reading.dir === 'flat' ? '횡보' : reading.dir === 'down' ? '하락' : (prior?.dir === 'down' || below ? '반등' : '상승');
  if (!reading.turned) return `${reading.sessions}거래일 ${signed(reading.change)} ${word}`;
  return `${at(prior.from)} → ${at(reading.from)} ${signed(prior.change)}, 이후 ${daysText(reading.legSessions)} ${signed(reading.change)} ${word}`;
}
