// v59.70 (owner 2026-11-07): 시장 상태's 시장이 말하는 이야기 — between 무슨 일이 있었나 (what moved) and the six-axis table
// (what the indicators say). One visual (how much each story is relayed, the last 24 hours shaded), one line per story
// (whether the indicators back the scenario it points to), and a fold per story with the reading frame, the scenario's
// confirm / break signals and what each general response costs (src/domain/narrative/narrative-cards.js). Counts only:
// no relayed post text is shown (owner 2026-11-01).
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { buildNarrativeCards } from '../../domain/narrative/narrative-cards.js';
import { MARKET_DAY, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { NARRATIVE_BY_ID } from '../../domain/narrative/narratives.js';

const FACE_MAX = 3;
const shortMd = (iso) => { const [, m, d] = String(iso || '').split('-'); return m && d ? `${Number(m)}/${Number(d)}` : ''; };

function attentionBars(doc, cards) {
  const max = Math.max(1, ...cards.map((card) => card.total));
  const list = el(doc, 'ol', null, 'mk-narr__bars');
  list.setAttribute('aria-label', `이야기별 리서치 채널 언급: ${cards.map((card) => `${card.label} ${card.total}건 중 24시간 ${card.recent}건`).join(', ')}`);
  for (const card of cards) {
    const row = el(doc, 'li', null, 'mk-narr__bar-row');
    const track = el(doc, 'span', null, 'mk-narr__track');
    track.setAttribute('aria-hidden', 'true');
    const earlier = el(doc, 'span', null, 'mk-narr__fill is-earlier');
    earlier.style.width = `${((card.total - card.recent) / max) * 100}%`;
    const recent = el(doc, 'span', null, 'mk-narr__fill is-recent');
    recent.style.width = `${(card.recent / max) * 100}%`;
    track.append(recent, earlier);
    row.append(el(doc, 'span', card.label, 'mk-narr__bar-label'), track, el(doc, 'span', `${card.total}건`, 'mk-narr__bar-value'));
    list.append(row);
  }
  return list;
}

function scenarioBlock(doc, scenario) {
  const box = el(doc, 'div', null, 'mk-narr__scenario');
  box.append(el(doc, 'p', null, 'mk-narr__scenario-head'));
  box.firstChild.append(el(doc, 'b', scenario.title), doc.createTextNode(` · ${scenario.status} · ${scenario.supportWord}`));
  const rows = [
    scenario.chain.length ? ['흐름', scenario.chain.join(' → ')] : null,
    scenario.pricing ? ['시장 가격', scenario.pricing] : null,
    scenario.confirm.length ? ['맞다는 신호', scenario.confirm.join(' / ')] : null,
    scenario.breaks.length ? ['틀렸다는 신호', scenario.breaks.join(' / ')] : null,
    scenario.past ? ['과거 빈도', scenario.past] : null
  ].filter(Boolean);
  const dl = el(doc, 'dl', null, 'mk-narr__facts');
  for (const [term, text] of rows) dl.append(el(doc, 'dt', term), el(doc, 'dd', text));
  box.append(dl);
  if (scenario.choices.length) {
    box.append(el(doc, 'p', '이 시나리오에서 대응별 득실', 'event-brief__sub'));
    const ul = el(doc, 'ul', null, 'mk-narr__choices');
    for (const choice of scenario.choices) {
      const mark = scenario.favored.includes(choice.name) ? '상대적으로 유리' : scenario.costly.includes(choice.name) ? '비용 큼' : '';
      const li = el(doc, 'li', null, mark ? `is-${mark === '비용 큼' ? 'costly' : 'favored'}` : '');
      li.append(el(doc, 'b', `${choice.name}${mark ? ` (${mark})` : ''}`), doc.createTextNode(` ${choice.text}`));
      ul.append(li);
    }
    box.append(ul);
    if (scenario.favoredWhy) box.append(el(doc, 'p', scenario.favoredWhy, 'mk-narr__why'));
  }
  return box;
}

function storyItem(doc, card) {
  const item = el(doc, 'li', null, 'mk-narr__story');
  item.dataset.support = card.support;
  const head = el(doc, 'p', null, 'mk-narr__story-head');
  head.append(el(doc, 'b', card.label), el(doc, 'span', card.supportWord, `mk-narr__chip is-${card.support}`));
  item.append(head, el(doc, 'p', card.line, 'mk-narr__line'));
  const fold = el(doc, 'details', null, 'mk-narr__more');
  fold.append(el(doc, 'summary', '근거·시나리오·대응 보기'));
  if (card.question) fold.append(el(doc, 'p', `질문: ${card.question}`, 'mk-narr__question'));
  fold.append(el(doc, 'p', `관심: ${card.attention}${card.movers.length ? ` · 헤드라인이 이 이야기를 다룬 급등락 종목 ${card.movers.join(', ')}` : ''}`, 'mk-narr__attention'));
  if (card.frame) {
    fold.append(el(doc, 'p', `읽는 틀 — ${card.frame.title}`, 'event-brief__sub'), el(doc, 'p', card.frame.steps.join(' → '), 'mk-narr__frame'));
    if (card.frame.counterclaim) fold.append(el(doc, 'p', `반론: ${card.frame.counterclaim}`, 'mk-narr__frame is-counter'));
  }
  for (const scenario of card.scenarios) fold.append(scenarioBlock(doc, scenario));
  item.append(fold);
  return item;
}

let lessonsPromise = null;
export function renderMarketNarratives({ documentRef: doc, root, interpretation }) {
  const story = doc?.getElementById('regime-story');
  const axes = doc?.querySelector?.('#page-signal .mk-axes');
  if (!axes) return null;
  let section = doc.getElementById('regime-narratives');
  if (!section) {
    section = el(doc, 'section', null, 'sx-card mk-narr');
    section.id = 'regime-narratives';
    section.setAttribute('aria-labelledby', 'regime-narratives-title');
    section.hidden = true;
    (story && story.parentNode === axes.parentNode ? story : axes).insertAdjacentElement(story ? 'afterend' : 'beforebegin', section);
  }
  const again = () => renderMarketNarratives({ documentRef: doc, root, interpretation });
  const day = root?.[MARKET_DAY.key];
  if (!day) { refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) again(); }).catch(() => {}); return section; }
  lessonsPromise ||= import('../../domain/knowledge/learning-core.js').then((mod) => mod.LESSONS || []).catch(() => []);
  lessonsPromise.then((lessons) => {
    const key = [day.narratives?.at, interpretation?.crossroads?.asOf, interpretation?.crossroads?.leadId].join('|');
    if (section.dataset.signature === key && section.childElementCount) return;
    const model = buildNarrativeCards({ narratives: day.narratives, crossroads: interpretation?.crossroads, lessons });
    section.hidden = !model.available;
    if (!model.available) { section.replaceChildren(); return; }
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
    const list = el(doc, 'ol', null, 'mk-narr__list');
    cards.slice(0, FACE_MAX).forEach((card) => list.append(storyItem(doc, card)));
    const parts = [frameHead(doc, { title: '시장이 말하는 이야기', titleId: 'regime-narratives-title', asOf, asOfDetail: '공개 리서치 채널 4곳과 급등락 종목 헤드라인에서 이야기별 언급을 셉니다' }),
      attentionBars(doc, cards), legend, ...(changeLine ? [changeLine] : []), list];
    if (cards.length > FACE_MAX) {
      const more = el(doc, 'details', null, 'sx-disclosure mk-narr__rest');
      const rest = el(doc, 'ol', null, 'mk-narr__list');
      cards.slice(FACE_MAX).forEach((card) => rest.append(storyItem(doc, card)));
      more.append(el(doc, 'summary', `나머지 이야기 ${cards.length - FACE_MAX}개`), rest);
      parts.push(more);
    }
    section.replaceChildren(...parts);
    markFrame(section, 'signal.narratives');
    section.dataset.signature = key;
  });
  return section;
}
