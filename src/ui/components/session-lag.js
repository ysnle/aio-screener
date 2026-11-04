// v59.70 (data audit R1): one label for a basis one session behind the latest completed session, shared by the 테마
// screen's sector card, 세부 테마 상위 and 테마 시나리오 — "11/2 종가 기준, 11/3 반영 전". The basis stays the artifact's
// own session (rotationHistory, playbook asOfByMarket): data.json's freshness ledger row carries no basis session.
import { shortDate } from '../../domain/content/date-labels.js';
import { latestCompletedUsSession } from '../../domain/market/market-calendar.js';

/** The latest completed US session (ISO day) when `basis` is behind it, else ''. */
export function usSessionPending(basis, nowMs = Date.now()) {
  const latest = latestCompletedUsSession(nowMs - 5 * 60000, { requirePrevious: false })?.date || '';
  return basis && latest && String(basis).slice(0, 10) < latest ? latest : '';
}

/** "11/2 종가 기준, 11/3 반영 전" when behind; "11/3 종가" when current; '' without a basis. */
export function sessionChipText(basis, pending = usSessionPending(basis)) {
  if (!basis) return '';
  return pending ? `${shortDate(basis)} 종가 기준, ${shortDate(pending)} 반영 전` : `${shortDate(basis)} 종가`;
}
