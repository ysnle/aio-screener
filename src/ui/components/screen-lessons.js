// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): every analysis screen ends with the principles that screen raises —
// what not to be fooled by, what to trust, the attitude and technique it calls for — from the same lesson registry and
// market guide as 오늘, so the lesson a reader meets on 시장 상태, 거시, 차트 or 스크리너 matches today's state and opens
// the same principles lesson. Installed once by bootstrap; re-renders on navigation and when closes arrive.
import { SCREEN_LESSON_IDS, selectScreenLessons } from '../../domain/guide/lessons.js';
import { buildMarketGuide } from '../../domain/guide/market-guide.js';
import { buildMarketRegime } from '../../domain/briefing/market-read.js';
import { buildMarketScenarios } from '../../domain/market/regime-scenarios.js';
import { collectMarketInputs } from '../../data/selectors/market-inputs.js';
import { crossroadsForRoot } from './macro-crossroads.js';
import { outlookForRoot } from './scenario-outlook.js';
import { lessonItem } from './market-guide.js';
import { el } from './dom.js';

/** Today's state for the lessons' live sentences; an unloaded market leaves every lesson without a reason. */
export function lessonContext(root, { nowMs = Date.now() } = {}) {
  try {
    if (!root?._aioHistory?.length) return { nowMs };
    const inputs = collectMarketInputs(root);
    const regime = buildMarketRegime(inputs);
    if (!regime?.available) return { regime, nowMs };
    const scenarios = buildMarketScenarios(inputs, { regime });
    const outlook = scenarios?.available ? outlookForRoot(root, { scenarios, regime }) : null;
    const crossroads = crossroadsForRoot(root, { regime, nowMs });
    const guide = buildMarketGuide({ regime, outlook, crossroads, nowMs });
    return { regime, outlook, crossroads, direction: guide.direction, nowMs };
  } catch (_) { return { nowMs }; }
}

export function renderScreenLessons({ documentRef: doc, root, routeId, ctx = null } = {}) {
  const page = doc?.getElementById?.(`page-${routeId}`);
  if (!page || !SCREEN_LESSON_IDS[routeId]) return null;
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
  const title = el(doc, 'h2', '이 화면을 볼 때 — 속지 말 것과 원칙', 'xr-h3');
  title.id = `${id}-title`;
  const list = el(doc, 'ul', null, 'mg-lessons');
  lessons.forEach((lesson) => list.append(lessonItem(doc, root, lesson)));
  box.replaceChildren(title, list);
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
