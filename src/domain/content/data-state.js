// v58.80 (first-users bundle 3): one vocabulary for a value that is not on screen. Personas on a slow phone read "자료가
// 없습니다" while the file was still on its way (요약 공시, 다음 실적 일정, 테마 28개 중 0개, 포트폴리오 가격 없음) and the
// same words after a failed download. Four different facts, said the same way on every screen:
//   loading         asked, no answer yet              → 불러오는 중
//   failed          the transfer broke or timed out   → 받지 못함 (a retry is possible)
//   absent          answered, and there is no record  → 자료 없음
//   not-applicable  the measure does not apply        → 해당 없음
import { withObjectParticle, withSubjectParticle } from './korean-particle.js';

export const DATA_STATES = Object.freeze(['loading', 'failed', 'absent', 'not-applicable']);
export const DATA_STATE_CHIPS = Object.freeze({ loading: '불러오는 중', failed: '받지 못함', absent: '자료 없음', 'not-applicable': '해당 없음' });

/** The state of one artifact read: `value` undefined = not answered yet, null = answered with nothing. */
export function artifactState({ value, failed = false } = {}) {
  if (failed) return 'failed';
  if (value === undefined) return 'loading';
  return value == null ? 'absent' : 'ready';
}

/** One sentence for a missing subject in a given state ("다음 실적 일정을 불러오는 중입니다"). */
export function dataStateText(state, subject) {
  const what = String(subject || '자료');
  if (state === 'loading') return `${withObjectParticle(what)} 불러오는 중입니다`;
  if (state === 'failed') return `${withObjectParticle(what)} 받지 못했습니다. 잠시 뒤 다시 열면 다시 받습니다`;
  if (state === 'not-applicable') return `${withSubjectParticle(what)} 해당하지 않습니다`;
  return `${withSubjectParticle(what)} 없습니다`;
}

// The entity page's SEC projection: the provider dispatches only after the projection settles, so a synced symbol
// without fundamentalsMeta means the load failed (review v58.53, moved here so 요약 and its tiles read one state).
export function entityFundamentalsState(state, { requestedId = '', onDemandStatus = null } = {}) {
  if (state?.fundamentals) return 'ready';
  const wanted = String(requestedId || '').trim().toUpperCase();
  if (!state?.id || (wanted && state.id !== wanted) || onDemandStatus === 'loading') return 'loading';
  if (!state?.fundamentalsMeta) return 'failed';
  return state.fundamentalsMeta.checkedFor === state.id ? 'absent' : 'loading';
}
