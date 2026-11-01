// v59.55 (owner 11/1): the closing card of every market screen (domain/market/market-synthesis.js). It sits right above
// 이어서 볼 곳: this screen's own line, the four-step chain (체력 → 흐름 → 움직이는 힘 → 다음 갈림길), up to three
// scenario branches with a met/total meter and what confirms or breaks each, where to lean and what to avoid, the checks
// to make, and two questions for the AI. renderNextSteps (page-flow.js) loads it lazily for the SYNTHESIS_PAGES navs.
import { buildMarketSynthesis, firstSentence } from '../../domain/market/market-synthesis.js';

const OWN_LEAD = Object.freeze({ sentiment: '#sentiment-synthesis', news: '#news-focus .news-focus__now' });
import { latestMarketInterpretation, marketInterpretation } from '../../data/selectors/interpretation.js';
import { frameHead, markFrame } from './section-frame.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { el } from './dom.js';
import { askRow } from './ask-row.js';
import { openRouteSection } from './page-flow.js';

function chain(doc, rows) {
  const list = el(doc, 'ol', null, 'mk-synth__chain');
  for (const row of rows) {
    const item = el(doc, 'li', null, 'mk-synth__step');
    item.dataset.step = row.id;
    item.append(el(doc, 'span', row.label, 'mk-synth__step-label'), el(doc, 'span', row.text, 'mk-synth__step-text'));
    list.append(item);
  }
  return list;
}

function branchCard(doc, row) {
  const card = el(doc, 'div', null, 'mk-synth__branch');
  card.dataset.branch = row.id;
  card.dataset.role = row.role;
  const head = el(doc, 'div', null, 'mk-synth__branch-head');
  head.append(el(doc, 'span', row.role, 'mk-synth__role'), el(doc, 'b', row.name, 'mk-synth__branch-name'));
  card.append(head);
  if (Number.isFinite(row.met) && Number.isFinite(row.total) && row.total > 0) {
    const meter = el(doc, 'div', null, 'mk-synth__meter');
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', `조건 ${row.total}개 중 ${row.met}개 충족`);
    for (let i = 0; i < row.total; i += 1) meter.append(el(doc, 'span', null, i < row.met ? 'is-met' : ''));
    card.append(meter, el(doc, 'span', `조건 ${row.met}/${row.total} 충족`, 'mk-synth__fit'));
  }
  const lines = [['강해지는 쪽', row.firmer], ['약해지는 쪽', row.weaker], ['맞다는 신호', row.confirm], ['틀렸다는 신호', row.breaks]].filter(([, text]) => text);
  if (lines.length) {
    const dl = el(doc, 'dl', null, 'mk-synth__branch-lines');
    for (const [label, text] of lines) dl.append(el(doc, 'dt', label), el(doc, 'dd', text));
    card.append(dl);
  }
  return card;
}

function stance(doc, model) {
  if (!model.pursue.length && !model.avoid.length) return null;
  const box = el(doc, 'div', null, 'mk-synth__stance');
  for (const [title, rows, cls] of [['기울일 쪽', model.pursue, 'is-pursue'], ['피할 쪽', model.avoid, 'is-avoid']]) {
    if (!rows.length) continue;
    const col = el(doc, 'div', null, `mk-synth__stance-col ${cls}`);
    const h = el(doc, 'h4', title, 'mk-synth__stance-title');
    if (model.caution) h.title = model.caution;
    const list = el(doc, 'ul');
    for (const text of rows) list.append(el(doc, 'li', text));
    col.append(h, list);
    box.append(col);
  }
  return box;
}

function questionRow(doc, model) {
  const lead = model.branches[0];
  const questions = [
    lead ? ['시나리오 점검', `지금 중심 시나리오 '${lead.name}'가 맞는지, 틀렸다면 어떤 신호가 먼저 나오는지 설명해줘`] : null,
    ['내 대응 점검', '지금 시장 국면에서 현금 비중, 보유 종목 비중, 손절 기준을 어떤 원칙으로 점검해야 하는지 알려줘']
  ].filter(Boolean);
  return askRow(doc, questions, 'mk-synth__ask');
}

export function renderMarketSynthesis({ documentRef: doc, host, page }) {
  if (!doc || !host || !page) return null;
  const root = doc.defaultView || globalThis;
  const interpretation = latestMarketInterpretation(root) || marketInterpretation(root);
  // v59.56 (screen review): '${page}-synthesis' collided with 투자 심리's hero lede (#sentiment-synthesis), which this card then
  // emptied and moved to the bottom of the page; the card's ids carry their own prefix.
  const id = `mk-synth-${page}`;
  let section = doc.getElementById(id);
  const model = buildMarketSynthesis(interpretation, { page });
  if (!model.available) { section?.remove(); return null; }
  // v59.56 (screen review): 투자 심리 and 뉴스 start from their own verdict line on the screen (the 심리 종합 lede, the
  // '뉴스가 모이는 곳' lead), not the shared volatility axis sentence or nothing.
  const ownLead = OWN_LEAD[page] ? firstSentence(doc.querySelector(OWN_LEAD[page])?.textContent || '') : '';
  if (ownLead) model.pageLine = ownLead;
  const key = [model.asOf, model.headline, model.pageLine, model.branches.map((row) => `${row.id}:${row.met}`).join(',')].join('|');
  if (section?.dataset.signature === key) return section;
  if (!section) {
    section = el(doc, 'section', null, 'sx-card mk-synth');
    section.id = id;
    section.setAttribute('aria-labelledby', `${id}-title`);
  }
  if (section.nextElementSibling !== host) host.before(section);
  const parts = [frameHead(doc, { title: '연결해서 보면', titleId: `${id}-title`, asOf: model.asOf ? `${shortDate(model.asOf)} 종가` : '' })];
  if (model.pageLine) {
    const line = el(doc, 'p', null, 'mk-synth__page');
    line.append(el(doc, 'b', `${model.pageLabel}에서 본 것 `), doc.createTextNode(model.pageLine));
    parts.push(line);
  }
  parts.push(el(doc, 'h3', '시장 흐름은 이렇게 이어집니다', 'mk-synth__sub'), chain(doc, model.chain));
  // v59.56 (screen review, both reviewers' first finding): the scenario cards, the stance and the checks were the same
  // ~700px on eight screens. They stay whole on 국면 판정, the screen that owns the regime and scenarios; every other
  // screen keeps its own line and the four-step chain, then one link to the full card there.
  if (page !== 'signal') {
    const more = el(doc, 'button', '갈래별 시나리오, 대응, 확인할 것 → 국면 판정', 'flow-next-link mk-synth__more');
    more.type = 'button';
    more.addEventListener('click', () => openRouteSection(doc, root, 'signal', 'mk-synth-signal'));
    parts.push(more, questionRow(doc, model));
    section.replaceChildren(...parts);
    markFrame(section, `${page}.synthesis`);
    section.dataset.signature = key;
    return section;
  }
  if (model.branches.length) {
    const grid = el(doc, 'div', null, 'mk-synth__branches');
    grid.append(...model.branches.map((row) => branchCard(doc, row)));
    parts.push(el(doc, 'h3', '앞으로 펼쳐질 수 있는 갈래', 'mk-synth__sub'), grid);
  }
  const lean = stance(doc, model);
  if (lean) parts.push(el(doc, 'h3', '그래서 무엇을 하고 무엇을 피하나', 'mk-synth__sub'), lean);
  if (model.checks.length) {
    const list = el(doc, 'ol', null, 'mk-synth__checks');
    for (const text of model.checks) list.append(el(doc, 'li', text));
    parts.push(el(doc, 'h3', '확인할 것', 'mk-synth__sub'), list);
  }
  parts.push(questionRow(doc, model));
  section.replaceChildren(...parts);
  markFrame(section, `${page}.synthesis`);
  section.dataset.signature = key;
  return section;
}
