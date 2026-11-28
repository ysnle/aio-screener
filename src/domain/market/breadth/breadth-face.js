// The 시장 폭 screen's row facts: for each participation measure, the side of its drawn reference lines its latest value is
// on (a band word, not a grade), the distance to the nearest line, and the counter line under the breadth verdict. The
// lines are the ones each chart already draws (src/ui/components/breadth-board.js buildBreadthCards) and the 시장 상태
// rules (RULES.breadth, RULES.leadership.distributionDaysAt); nothing here changes the breadth axis or its state.
import { RULES } from '../../rules/thresholds.js';
import { signedText } from '../../shared/number.js';
import { BREADTH_SPEED_WORDS } from '../../briefing/market-read.js';
import { MOVER_RULES } from './movers.js';

const B = RULES.breadth;
const DD_AT = RULES.leadership.distributionDaysAt;

// How each measure is read against its lines: 'share' (the axis's 40 / 60% lines), 'extreme' (20 / 80%), 'half' (50%),
// 'sign' (above or below zero), 'ratio' (4% risers over fallers against 0.5 / 1 / 2), 'count' (distribution days against
// the 시장 상태 count) and 'direction' (A/D line: its
// 20-session direction; its level depends on the record's first day).
export const MEASURE_READS = Object.freeze({
  b20: 'share', b50: 'share', b200: 'share', b40: 'extreme', adv: 'half', ad: 'direction',
  hl: Object.freeze({ kind: 'sign', up: '신고가 많음', down: '신저가 많음' }),
  mv: Object.freeze({ kind: 'ratio', lines: MOVER_RULES.refLines }),
  dd: 'count'
});

// The rule of the breadth speed word (market-read breadthSpeedOf), for the method fold.
export const BREADTH_SPEED_METHOD = `방향: 50일선 위 비율의 ${B.speedSessions}거래일 변화가 지난 1년 같은 변화 크기 중앙값의 ${B.speedMultiple}배를 넘으면 '${BREADTH_SPEED_WORDS.down}'·'${BREADTH_SPEED_WORDS.up}', 그 안이면 표시 없음. 판정과 개수는 바꾸지 않습니다.`;

const pp = (value) => `${signedText(value, 0)}%p`;
const nearest = (value, lines) => lines.map((line) => ({ line, gap: line - value })).sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0] || null;

/**
 * { band, side, distance } for one measure's latest value. `side` is 'up' (the participation side of its lines), 'down' or
 * null (no side: the 20/80 extremes, the 50% advance line, the A/D direction). `change20` is the 20-session change, for the
 * A/D line.
 */
export function measureFace(id, value, { change20 = null } = {}) {
  const read = MEASURE_READS[id];
  if (!read || !Number.isFinite(value)) return { band: '', side: null, distance: '' };
  const kind = typeof read === 'string' ? read : read.kind;
  if (kind === 'share') {
    const band = value >= B.broadAtLeast ? `${B.broadAtLeast}% 이상` : value < B.weakBelow ? `${B.weakBelow}% 미만` : `${B.weakBelow}~${B.broadAtLeast}%`;
    const near = nearest(value, [B.weakBelow, B.broadAtLeast]);
    return { band, side: value >= B.broadAtLeast ? 'up' : value < B.weakBelow ? 'down' : null, distance: near ? `${near.line}%까지 ${pp(near.gap)}` : '' };
  }
  if (kind === 'extreme') {
    const band = value > 80 ? '80% 초과' : value < 20 ? '20% 미만' : '20~80%';
    const near = nearest(value, [20, 80]);
    return { band, side: null, distance: near ? `${near.line}%까지 ${pp(near.gap)}` : '' };
  }
  if (kind === 'half') return { band: value >= 50 ? '50% 이상' : '50% 미만', side: null, distance: `50%까지 ${pp(50 - value)}` };
  if (kind === 'ratio') {
    // A risers-over-fallers ratio against its 0.5 / 1 / 2 lines: the side is which count is larger.
    const [low, even, high] = read.lines;
    const band = value < low ? `${low} 미만` : value >= high ? `${high} 이상` : value >= even ? `${even}~${high}` : `${low}~${even}`;
    const near = read.lines.map((line) => ({ line, gap: line - value })).sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))[0];
    return { band, side: value > even ? 'up' : value < even ? 'down' : null, distance: `${near.line}까지 ${signedText(near.gap, 2, '')}` };
  }
  if (kind === 'sign') {
    const shown = Math.round(value);
    return { band: shown > 0 ? read.up : shown < 0 ? read.down : '같음', side: shown > 0 ? 'up' : shown < 0 ? 'down' : null, distance: shown ? `0까지 ${signedText(-shown, 0)}` : '' };
  }
  if (kind === 'count') {
    const shown = Math.round(value);
    return { band: shown >= DD_AT ? `${DD_AT}회 이상` : `${DD_AT}회 미만`, side: shown >= DD_AT ? 'down' : null, distance: shown >= DD_AT ? `${DD_AT}회 기준 ${signedText(shown - DD_AT, 0)}` : `${DD_AT}회까지 +${DD_AT - shown}` };
  }
  // direction
  return { band: !Number.isFinite(change20) ? '방향 기록 부족' : change20 > 0 ? '20일 상승' : change20 < 0 ? '20일 하락' : '20일 변화 없음', side: null, distance: '' };
}

/**
 * The counter line under the breadth verdict: the measures on the other side of where the axis stands. A 양호 axis is
 * countered by the measures on the down side, a 부담 axis by those on the up side; a 중립 axis leans toward its nearest
 * flip (axis.flipDistance.toward) and is countered by the measures on the other side of that. `rows` are
 * [{ id, title, value, text }] with the latest value and its shown text. Facts only: title and value.
 */
export function breadthCounter(axis, rows = []) {
  if (!axis || axis.state === 'unknown') return null;
  const toward = axis.state === 'favorable' ? 'favorable' : axis.state === 'burden' ? 'burden' : axis.flipDistance?.toward || null;
  if (!toward) return null;
  const against = toward === 'favorable' ? 'down' : 'up';
  const items = rows.filter((row) => measureFace(row.id, row.value).side === against).map((row) => `${row.title} ${row.text}`);
  return items.length ? { kind: axis.state === 'neutral' ? 'nearest' : 'opposite', toward, items } : null;
}
