// v59.70 (data audit R1): one label for a basis one session behind the latest completed session, shared by the 테마
// screen's sector card, 세부 테마 상위 and 테마 시나리오 — "11/2 종가, 11/3 반영 전". The basis stays the artifact's
// own session (rotationHistory, playbook asOfByMarket): data.json's freshness ledger row carries no basis session.
// 2026-11-18: the label is an as-of chip, so it fits ASOF_MAX with a market prefix ("미국 12/31 종가, 12/31 반영 전" is 23);
// the chip no longer cuts text, and a cut "… 11/17 반영 전" had read "… 11/17 반영".
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
