// One size scale for every magnitude word (소폭 · 보통 · 큰 폭, 급등 · 급락, 보합권). A change is sized against the
// series' own recent one-session volatility on the market-day ledger's tiers (RULES.moveMateriality), never against a
// fixed percent: +0.8% is ordinary for the KOSPI and large for the won. src/domain/market/day/facts.js ranks its facts on
// the same functions; a sentence that names a size reads moveGrade here. Light on purpose (boot readers import it).
import { RULES } from '../../rules/thresholds.js';
import { stdev } from '../../shared/number.js';
import { buildCloseSeries } from './close-series.js';

const MOVE = RULES.moveMateriality;

/** One session step of a close series: bp for yields, % otherwise. */
export const sessionStep = (unit, from, to) => (unit === 'bp' ? (to - from) * 100 : (to / from - 1) * 100);

/**
 * The sd the next step of `series` is measured against: its last sdSessions completed steps (null under minSteps steps or
 * on a flat series).
 */
export function sessionStepSd(series, unit) {
  const list = Array.isArray(series) ? series : [];
  const steps = list.slice(1).map((row, i) => sessionStep(unit, list[i].value, row.value)).slice(-MOVE.sdSessions);
  return steps.length < MOVE.minSteps ? null : stdev(steps) || null;
}

export const materialityRank = (points) => points >= MOVE.tiers.lead ? 'lead' : points >= MOVE.tiers.major ? 'major' : points >= MOVE.tiers.minor ? 'minor' : 'context';

/**
 * The size of a `sessions`-session change against a one-session sd (scaled by √sessions): 'small' (the ledger's context
 * tier), 'ordinary' (minor or major) or 'large' (lead); null without an sd — then no size is claimed.
 */
export function moveGrade(change, sd, sessions = 1) {
  if (!(sd > 0) || !Number.isFinite(change) || !(sessions >= 1)) return null;
  const rank = materialityRank(Math.abs(change) / (sd * Math.sqrt(sessions)) * MOVE.pointsPerSd);
  return rank === 'context' ? 'small' : rank === 'lead' ? 'large' : 'ordinary';
}

/**
 * The one rule for the sd a `sessions`-session change that ends at the last close of `series` is sized
 * against — the steps before the span starts. The span's own steps are the move being measured; inside the sd they
 * shrink its own size (WTI 11/04 -14.26% over five sessions graded ordinary on the screen and large in the validator).
 * The ledger (facts.js priceMove), the reading's MOVE_SIZE grades and every screen grade read it here.
 */
export function spanStepSd(series, sessions = 1, unit = 'pct') {
  const list = Array.isArray(series) ? series : [];
  return sessions >= 1 && list.length > sessions ? sessionStepSd(list.slice(0, list.length - sessions), unit) : null;
}
/** moveGrade of a `sessions`-session change ending at the last close of `series`, on spanStepSd. */
export const spanMoveGrade = (series, change, sessions = 1, unit = 'pct') => moveGrade(change, spanStepSd(series, sessions, unit), sessions);

/** moveGrade of a close-history field (history.json rows) whose change ends at `through` (the last close when null). */
export function closeMoveGrade(history, field, change, { sessions = 1, unit = 'pct', through = null } = {}) {
  const series = buildCloseSeries(Array.isArray(history) ? history : [], field, through ? { through } : {});
  return spanMoveGrade(series, change, sessions, unit);
}

/** moveGrade from an annualised volatility in % (a screener row's `vol`): one-session sd = vol ÷ √252. */
export const annualVolMoveGrade = (change, annualVolPct, sessions = 1) => moveGrade(change, Number(annualVolPct) > 0 ? Number(annualVolPct) / Math.sqrt(252) : null, sessions);

export const MOVE_SIZE_WORDS = Object.freeze({ small: '소폭', ordinary: '보통', large: '큰 폭' });
/** The ledger's size word; '보통' when there is no grade (no size claimed). */
export const moveSizeWord = (grade) => MOVE_SIZE_WORDS[grade] || MOVE_SIZE_WORDS.ordinary;
/** 급등 / 급락 only for a large move; otherwise the plain direction. */
export const moveVerb = (change, grade) => (grade === 'large' ? (change < 0 ? '급락' : '급등') : change < 0 ? '하락' : '상승');
