// v59.70 (owner 2026-11-07): 시장 상태's 시장이 말하는 이야기 — after the scenarios and today's guide (what the indicators
// say comes next), before 무슨 일이 있었나 (what moved). One visual, how much each story is relayed (the last 24 hours
// shaded), whose rows pick the story read below it: the question, the attention, whether the indicators back the scenario
// it points to (src/domain/narrative/narrative-cards.js), and a link to that scenario. Counts only: no relayed post text is
// shown (owner 2026-11-01).
// (owner 2026-11-20, face never folded; one owner per piece) a scenario's frame, choices, confirm and break signals are
// the 시나리오 section's (macro-crossroads.js) — the story names the scenario and its status and links there; the reading
// frame is the analysis note in 리서치 라이브러리, linked by id.
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { buildNarrativeCards } from '../../domain/narrative/narrative-cards.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { NARRATIVE_BY_ID } from '../../domain/narrative/narratives.js';
import { MARKET_DAY, SCENARIO_OUTCOMES } from '../../data/artifact-registry.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { openCrossroadsBranch } from './macro-crossroads.js';
import { pickList } from './pick-list.js';

const shortMd = (iso) => { const [, m, d] = String(iso || '').split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ''; };

// One story's row of the selector: its name, its mention bar (earlier and last-24-hour parts) and its count.
function barRow(doc, card, max, button) {
  button.dataset.focusKey = `story:${card.id}`;
  button.dataset.support = card.support;
  button.setAttribute('aria-label', `${card.label}, 언급 ${card.total}건 중 24시간 ${card.recent}건, ${card.supportWord}`);
  const track = el(doc, 'span', null, 'mk-narr__track');
  track.setAttribute('aria-hidden', 'true');
  const earlier = el(doc, 'span', null, 'mk-narr__fill is-earlier');
  earlier.style.width = `${((card.total - card.recent) / max) * 100}%`;
  const recent = el(doc, 'span', null, 'mk-narr__fill is-recent');
  recent.style.width = `${(card.recent / max) * 100}%`;
  track.append(recent, earlier);
  return [el(doc, 'span', card.label, 'mk-narr__bar-label'), track, el(doc, 'span', `${card.total}건`, 'mk-narr__bar-value')];
}

// focusKey names a control stably across repaints, so a late artifact that redraws the section keeps a keyboard reader's place.
function linkButton(doc, label, onClick, focusKey, className = 'flow-next-link') {
  const button = el(doc, 'button', label, className);
  button.type = 'button';
  button.dataset.focusKey = focusKey;
  button.addEventListener('click', onClick);
  return button;
}

// The scenario a story points to: its name, status and how far the indicators back it, the market's pricing, and the
// way to its full card in the 시나리오 section below.
function scenarioRow(doc, root, scenario, storyId) {
  const row = el(doc, 'li', null, 'mk-narr__scenario');
  row.dataset.branch = scenario.id;
  const head = el(doc, 'p', null, 'mk-narr__scenario-head');
  head.append(el(doc, 'b', scenario.title), doc.createTextNode(` · ${scenario.status} · ${scenario.supportWord}`));
  row.append(head);
  if (scenario.pricing) row.append(el(doc, 'p', `시장 가격: ${scenario.pricing}`, 'mk-narr__pricing'));
  row.append(linkButton(doc, '시나리오에서 보기 →', () => openCrossroadsBranch(doc, root, scenario.id), `scenario:${storyId}:${scenario.id}`));
  return row;
}

function storyItem(doc, root, card) {
  const item = el(doc, 'article', null, 'mk-narr__story');
  item.dataset.support = card.support;
  item.id = `market-story-${card.id}`;
  const head = el(doc, 'p', null, 'mk-narr__story-head');
  head.append(el(doc, 'b', card.label), el(doc, 'span', card.supportWord, `mk-narr__chip is-${card.support}`));
  item.append(head, el(doc, 'p', card.line, 'mk-narr__line'));
  if (card.question) item.append(el(doc, 'p', `쟁점: ${card.question}`, 'mk-narr__question'));
  item.append(el(doc, 'p', `관심: ${card.attention}${card.movers.length ? ` · 헤드라인이 이 이야기를 다룬 급등락 종목 ${card.movers.join(', ')}` : ''}`, 'mk-narr__attention'));
  if (card.scenarios.length) {
    const list = el(doc, 'ul', null, 'mk-narr__scenarios');
    for (const scenario of card.scenarios) list.append(scenarioRow(doc, root, scenario, card.id));
    item.append(list);
  }
  const frameId = (NARRATIVE_BY_ID[card.id]?.frames || [])[0];
  if (frameId) item.append(linkButton(doc, '읽는 틀 → 분석 노트', () => navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'frames', node: frameId } }), `frame:${card.id}`));
  return item;
}

export function renderMarketNarratives({ documentRef: doc, root, interpretation }) {
  // Placed after the 시나리오 card, before 무슨 일이 있었나 when that card is already there.
  const story = doc?.getElementById('regime-story');
  const depth = doc?.querySelector?.('#page-signal > .mk-depth');
  if (!depth) return null;
  let section = doc.getElementById('regime-narratives');
  if (!section) {
    section = el(doc, 'section', null, 'sx-card mk-narr');
    section.id = 'regime-narratives';
    section.setAttribute('aria-labelledby', 'regime-narratives-title');
    section.hidden = true;
    if (story && story.parentNode === depth.parentNode) story.insertAdjacentElement('beforebegin', section);
    else depth.insertAdjacentElement('afterend', section);
  }
  // A repaint reads the interpretation again: the one handed in was built before the artifact that triggered it arrived.
  const again = () => renderMarketNarratives({ documentRef: doc, root, interpretation: marketInterpretation(root) });
  const day = root?.[MARKET_DAY.key];
  if (!day) { refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) again(); }).catch(() => {}); return section; }
  // The scenario statuses read the branch records, as the scenario section does: when the long record arrives, both repaint.
  if (!root[SCENARIO_OUTCOMES.key]) refreshSharedArtifact(root, SCENARIO_OUTCOMES).then(({ changed }) => { if (changed) again(); }).catch(() => {});
  const key = [day.narratives?.at, interpretation?.crossroads?.asOf, interpretation?.crossroads?.leadId, interpretation?.crossroads?.pastRecord].join('|');
  if (section.dataset.signature === key && section.childElementCount) return section;
  const model = buildNarrativeCards({ narratives: day.narratives, crossroads: interpretation?.crossroads });
  section.hidden = !model.available;
  if (!model.available) { section.replaceChildren(); return section; }
  const cards = model.cards.map((card) => ({ ...card, total: (day.narratives.stories.find((row) => row.id === card.id) || {}).telegramCount || 0,
    recent: (day.narratives.stories.find((row) => row.id === card.id) || {}).recentCount || 0 }));
  const at = new Date(Date.parse(model.at) + 9 * 3600000);
  const asOf = Number.isFinite(at.getTime()) ? `${at.getUTCMonth() + 1}/${at.getUTCDate()} ${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')} KST까지 ${model.windowHours}시간` : `${model.windowHours}시간`;
  const legend = el(doc, 'p', '진한 부분은 최근 24시간. 언급 수는 관심의 크기이지 사실 여부나 가격 영향이 아닙니다.', 'mk-narr__legend');
  // v59.70 '바뀐 점': stories that entered or left the top list since the previous KST day (narratives.changes).
  const change = day.narratives.changes;
  const names = (ids) => (ids || []).map((id) => NARRATIVE_BY_ID[id]?.label || id).join(', ');
  const changeLine = change && (change.added?.length || change.dropped?.length)
    ? el(doc, 'p', `${shortMd(change.since)} 대비 ${[change.added?.length ? `새로 오른 이야기 ${names(change.added)}` : null, change.dropped?.length ? `빠진 이야기 ${names(change.dropped)}` : null].filter(Boolean).join(' · ')}`, 'mk-narr__change')
    : null;
  // The mention bars are the selector: the most relayed story reads first, a reader's pick is kept across repaints.
  const max = Math.max(1, ...cards.map((card) => card.total));
  const map = pickList(doc, {
    items: cards, picked: section.querySelector?.('.mk-narr__map')?.dataset.picked || null, label: `이야기 ${cards.length}개, 리서치 채널 언급 순`, key: 'story',
    classes: { wrap: 'mk-narr__map', list: 'mk-narr__bars', pick: 'mk-narr__bar-row', detail: 'mk-narr__detail' },
    row: (card, button) => barRow(doc, card, max, button),
    detail: (card) => storyItem(doc, root, card)
  });
  const parts = [frameHead(doc, { title: '시장이 말하는 이야기', titleId: 'regime-narratives-title', asOf, asOfDetail: '공개 리서치 채널 4곳과 급등락 종목 헤드라인에서 이야기별 언급을 셉니다' }),
    legend, ...(changeLine ? [changeLine] : []), map];
  const active = doc.activeElement;
  const focusKey = active && section.contains(active) ? active.dataset?.focusKey : null;
  section.replaceChildren(...parts);
  if (focusKey) [...section.querySelectorAll('[data-focus-key]')].find((node) => node.dataset.focusKey === focusKey)?.focus({ preventScroll: true });
  markFrame(section, 'signal.narratives');
  section.dataset.signature = key;
  return section;
}
