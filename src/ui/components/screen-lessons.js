// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): every analysis screen ends with the principles that screen raises —
// what not to be fooled by, what to trust, the attitude and technique it calls for — from the same lesson registry and
// market guide as 오늘, so the lesson a reader meets on 시장 상태, 거시, 차트 or 스크리너 matches today's state and opens
// the same principles lesson. Installed once by bootstrap; re-renders on navigation and when closes arrive.
import { SCREEN_LESSON_IDS, selectScreenLessons } from '../../domain/guide/lessons.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { summarizeCandidateArchive } from '../../domain/screener/candidate-record.js';
import { requestConsensusEstimates, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { lessonItem } from './market-guide.js';
import { el } from './dom.js';

/** Today's state for the lessons' live sentences; an unloaded market leaves every lesson without a reason. */
export function lessonContext(root, { nowMs = Date.now() } = {}) {
  const rankEvidence = rankEvidenceForRoot(root);
  try {
    // The same stages the 오늘 guide reads. The curve (macro history) and index earnings (weights + consensus) do not
    // need the price history, so a missing one leaves only the regime-based sentences silent.
    const { regime, outlook, crossroads, guide, curve, indexEarnings } = marketInterpretation(root, { nowMs });
    if (!regime?.available) return { regime, curve, indexEarnings, rankEvidence, nowMs };
    return { regime, outlook, crossroads, direction: guide?.direction || null, curve, indexEarnings, rankEvidence, nowMs };
  } catch (_) { return { rankEvidence, nowMs }; }
}

// The screener's forward record (public-data/screener-candidate-archive.json, loaded by the screener page).
function rankEvidenceForRoot(root) {
  try { return root?._aioCandidateArchive?.entries ? summarizeCandidateArchive(root._aioCandidateArchive).independent || null : null; } catch (_) { return null; }
}

export function renderScreenLessons({ documentRef: doc, root, routeId, ctx = null } = {}) {
  const page = doc?.getElementById?.(`page-${routeId}`);
  if (!page || !SCREEN_LESSON_IDS[routeId]) return null;
  // The revision-breadth lesson reads the consensus artifact, which only 오늘 and the stock screens request.
  if (!ctx && root && !root[CONSENSUS_KEY] && SCREEN_LESSON_IDS[routeId].includes('earnings-revisions')) {
    requestConsensusEstimates(root, () => renderScreenLessons({ documentRef: doc, root, routeId }));
  }
  // Each lesson lives on one screen (SCREEN_LESSON_IDS); at most three, those today's data touches first.
  const lessons = selectScreenLessons(routeId, ctx || lessonContext(root), { limit: 3 });
  if (!lessons.length) return null;
  const id = `screen-lessons-${routeId}`;
  let box = page.querySelector(`[data-aio-screen-lessons="${routeId}"]`);
  if (!box) {
    box = el(doc, 'section', null, 'xr-section mg-guide mg-screen-lessons');
    box.dataset.aioScreenLessons = routeId;
    box.setAttribute('aria-labelledby', `${id}-title`);
  }
  // Before "이어서 볼 곳" and the source notes, so the screen still ends on where to go next.
  const before = [...page.children].find((node) => node !== box && (node.classList?.contains('flow-next') || node.classList?.contains('page-sources')));
  if (before) { if (box.nextElementSibling !== before) page.insertBefore(box, before); } else if (box.parentElement !== page) page.appendChild(box);
  box.hidden = routeId === 'portfolio' && page.dataset.pfEmpty === 'true'; // v58.75: principles follow the first holding
  const title = el(doc, 'h2', '이 화면을 볼 때 — 속지 말 것과 원칙', 'xr-h3');
  title.id = `${id}-title`;
  const list = el(doc, 'ul', null, 'mg-lessons');
  lessons.forEach((lesson) => list.append(lessonItem(doc, root, lesson)));
  // v58.56 (re-audit #16) on the market screens, every screen since first-users run-6 (owner 2026-10-31): the lessons are
  // one closed line (titles in the summary) that opens; a reader's open fold stays open across re-renders.
  const wasOpen = box.querySelector(':scope > details')?.open || false;
  const fold = el(doc, 'details', null, 'sx-disclosure mg-screen-lessons-fold');
  fold.open = wasOpen;
  const summary = el(doc, 'summary', null, 'mg-screen-lessons-summary');
  summary.append(title, el(doc, 'span', lessons.map((lesson) => lesson.title).filter(Boolean).join(', '), 'mg-screen-lessons-names'));
  fold.append(summary, list);
  box.replaceChildren(fold);
  return lessons;
}

export function installScreenLessons({ root = globalThis, documentRef = root.document, activeRoute = () => null } = {}) {
  const target = documentRef || root;
  const render = (event) => { const routeId = event?.detail?.routeId || activeRoute(); if (routeId) renderScreenLessons({ documentRef, root, routeId }); };
  const events = ['aio:navigationCommitted', 'aio:historyLoaded', 'aio:serverDataLoaded'];
  events.forEach((name) => target?.addEventListener?.(name, render));
  render();
  return () => events.forEach((name) => target?.removeEventListener?.(name, render));
}
