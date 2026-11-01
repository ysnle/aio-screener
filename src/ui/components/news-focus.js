// v59.56 (handoff item 3, owner 11/1 "찾기 힘든 정보·뉴스를 모아 선별·가공·분석"): 뉴스's analysis block, above 중요 뉴스 —
// what this window's coverage is about (stories per topic, one story per event) and which live scenario the headlines
// feed (the same headline → scenario rule as each card's '시나리오 연결', domain/briefing/event-guide.js). One picture, a
// short read, one fold with the headlines behind each scenario. Counting coverage measures attention, not direction.
import { el } from './dom.js';

const TOP_TOPICS = 6;

export function newsFocusModel(stories = []) {
  const list = (Array.isArray(stories) ? stories : []).filter((story) => story && story.topic);
  if (list.length < 5) return { available: false };
  const topics = [...list.reduce((map, story) => map.set(story.topic, (map.get(story.topic) || 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]).slice(0, TOP_TOPICS).map(([label, count]) => ({ label, count, tied: list.filter((story) => story.topic === label && story.chain).length }));
  const branches = new Map();
  for (const story of list) {
    if (!story.chain?.branch) continue;
    const entry = branches.get(story.chain.branch) || { name: story.chain.branch, role: story.chain.role, check: story.chain.check, titles: [] };
    entry.titles.push(story.title);
    branches.set(story.chain.branch, entry);
  }
  const scenarios = [...branches.values()].sort((a, b) => b.titles.length - a.titles.length);
  const tiedCount = scenarios.reduce((sum, row) => sum + row.titles.length, 0);
  const [first, second] = topics;
  const lead = `사건 ${list.length}건(같은 사건 기사는 하나로). 가장 많이 다룬 주제는 ${first.label} ${first.count}건${second ? `, ${second.label} ${second.count}건` : ''}입니다.`;
  const tie = tiedCount
    ? `지금 시나리오에 이어지는 기사는 ${tiedCount}건으로, ${scenarios.slice(0, 2).map((row) => `'${row.name}' 쪽 ${row.titles.length}건`).join(', ')}입니다.`
    : '지금 시나리오의 조건과 이어지는 기사는 없습니다. 뉴스가 판단을 바꿀 재료는 아직 없다는 뜻입니다.';
  const read = tie;
  const caveat = '사건 수는 시장의 관심이 어디 있는지를 보여 줄 뿐 방향을 말하지 않습니다. 시나리오가 맞는지는 각 시나리오의 확인 조건으로 봅니다. 주제는 수집처 분류 기준입니다.';
  return { available: true, total: list.length, topics, scenarios, tiedCount, lead, read, caveat };
}

export function renderNewsFocus({ documentRef: doc, stories = [] }) {
  const anchor = doc?.getElementById('news-important');
  if (!anchor) return null;
  let block = doc.getElementById('news-focus');
  const model = newsFocusModel(stories);
  if (!model.available) { block?.remove(); return null; }
  if (!block) {
    block = el(doc, 'section', null, 'aio-section briefing-block sx-card news-focus');
    block.id = 'news-focus';
    block.setAttribute('aria-labelledby', 'news-focus-title');
    anchor.before(block);
  }
  const wasOpen = !!block.querySelector('details')?.open;
  const title = el(doc, 'h2', '뉴스가 모이는 곳', 'briefing-h2');
  title.id = 'news-focus-title';
  const figure = el(doc, 'figure', null, 'news-focus__viz');
  figure.setAttribute('role', 'img');
  figure.setAttribute('aria-label', `주제별 사건 수: ${model.topics.map((row) => `${row.label} ${row.count}건${row.tied ? `(시나리오 연결 ${row.tied}건)` : ''}`).join(', ')}`);
  const max = Math.max(...model.topics.map((row) => row.count), 1);
  for (const row of model.topics) {
    const line = el(doc, 'div', null, 'news-focus__row');
    const track = el(doc, 'span', null, 'news-focus__track');
    const all = el(doc, 'span', null, 'news-focus__bar');
    all.style.width = `${(row.count / max * 100).toFixed(1)}%`;
    const tied = el(doc, 'span', null, 'news-focus__bar is-tied');
    tied.style.width = `${(row.tied / max * 100).toFixed(1)}%`;
    track.append(all, tied);
    line.append(el(doc, 'span', row.label, 'news-focus__label'), track, el(doc, 'span', `${row.count}`, 'news-focus__val'));
    figure.append(line);
  }
  figure.append(el(doc, 'figcaption', '진한 부분은 지금 시나리오에 이어지는 기사', 'news-focus__cap'));
  const text = el(doc, 'div', null, 'news-focus__text');
  text.append(el(doc, 'p', model.lead, 'news-focus__now'), el(doc, 'p', model.read, 'news-focus__mean'));
  const body = el(doc, 'div', null, 'news-focus__body');
  body.append(figure, text);
  block.replaceChildren(title, body);
  {
    const fold = el(doc, 'details', null, 'sx-disclosure news-focus__more');
    fold.open = wasOpen;
    fold.append(el(doc, 'summary', model.scenarios.length ? '시나리오별 기사와 확인할 것' : '세는 법'));
    for (const row of model.scenarios) {
      const group = el(doc, 'div', null, 'news-focus__group');
      group.append(el(doc, 'h3', `'${row.name}' (${row.role}) — ${row.titles.length}건`, 'news-focus__group-title'));
      const list = el(doc, 'ul', null, 'news-focus__titles');
      row.titles.slice(0, 4).forEach((headline) => list.append(el(doc, 'li', headline)));
      group.append(list);
      if (row.check) group.append(el(doc, 'p', `확인할 것: ${row.check}`, 'news-focus__check'));
      fold.append(group);
    }
    fold.append(el(doc, 'p', model.caveat, 'news-focus__check'));
    block.append(fold);
  }
  return block;
}
