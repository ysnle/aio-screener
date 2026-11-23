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

export function entityFundamentalsState(state, { requestedId = '', onDemandStatus = null } = {}) {
  if (state?.fundamentals) return 'ready';
  const wanted = String(requestedId || '').trim().toUpperCase();
  if (!state?.id || (wanted && state.id !== wanted) || onDemandStatus === 'loading') return 'loading';
  if (!state?.fundamentalsMeta) return 'failed';
  return state.fundamentalsMeta.checkedFor === state.id ? 'absent' : 'loading';
}
