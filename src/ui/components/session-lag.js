import { shortDate } from '../../domain/content/date-labels.js';
import { latestCompletedSession } from '../../domain/market/session/market-calendar.js';

/** The latest completed US session (ISO day) when `basis` is behind it, else ''. */
export function usSessionPending(basis, nowMs = Date.now()) {
  const latest = latestCompletedSession('US', nowMs - 5 * 60000)?.date || '';
  return basis && latest && String(basis).slice(0, 10) < latest ? latest : '';
}

/** "11/2 종가, 11/3 반영 전" when behind; "11/3 종가" when current; '' without a basis. */
export function sessionChipText(basis, pending = usSessionPending(basis)) {
  if (!basis) return '';
  return pending ? `${shortDate(basis)} 종가, ${shortDate(pending)} 반영 전` : `${shortDate(basis)} 종가`;
}
