// v58.75 (persona review, teach-and-check spec F1): right under the six-axis table on 시장 상태, the four shared choices
// (관망·분할·보유·방어) read through the scenario whose conditions fit best now — each with that scenario's own written,
// conditional cost comparison (macro-crossroads BRANCHES[].choices, the R698 frame) — and then the nearest conditions that
// would change the reading: the axis thresholds closest to today (regime axis.flipDistance, ordered by the distance in
// typical moves) and the scenario's next release check. No new judgement, no probability, nothing about the reader's book.
// Loaded lazily from market-regime.js (not part of the first paint).
import { el } from './dom.js';
import { CHOICES } from '../../domain/market/macro-crossroads.js';
import { CHOICE_WORDS } from '../../domain/content/choice-words.js';

const STATE = Object.freeze({ favored: [CHOICE_WORDS.favoredState, 'favorable'], costly: [CHOICE_WORDS.costlyState, 'burden'], neutral: ['중립', 'neutral'] });

export function regimeChoicesModel({ guide = null, axes = [] } = {}) {
  const paths = guide?.available ? guide.direction?.live || [] : [];
  const lead = paths.find((path) => path.id === guide?.leadId) || paths[0] || null;
  if (!lead) return { available: false };
  const choices = Object.keys(CHOICES).filter((key) => lead.choices?.[key]).map((key) => ({
    key, label: CHOICES[key], text: lead.choices[key], state: lead.favored.includes(key) ? 'favored' : lead.costly.includes(key) ? 'costly' : 'neutral'
  }));
  const flips = axes.filter((row) => row?.id !== 'korea' && row.flipDistance && !row.flipDistance.needsMore)
    .map((row) => ({ title: row.title, d: row.flipDistance }))
    .sort((a, b) => (a.d.sessions ?? Infinity) - (b.d.sessions ?? Infinity)).slice(0, 2);
  const trigger = lead.triggers?.[0] || null;
  return { available: choices.length > 0, lead, choices, flips, trigger };
}

export function renderRegimeChoices({ documentRef: doc, guide, axes, anchor }) {
  if (!doc || !anchor) return null;
  let box = doc.getElementById('regime-choices');
  if (!box) {
    box = el(doc, 'section', null, 'sx-card mk-choices');
    box.id = 'regime-choices';
    box.setAttribute('aria-labelledby', 'regime-choices-title');
  }
  if (box.previousElementSibling !== anchor) anchor.after(box);
  const model = regimeChoicesModel({ guide, axes });
  box.hidden = !model.available;
  if (!model.available) { box.replaceChildren(); return model; }
  const title = el(doc, 'h2', '이 국면에서 네 가지 선택지의 득실', 'sx-card__title');
  title.id = 'regime-choices-title';
  const lead = el(doc, 'p', `조건이 가장 많이 맞는 시나리오 '${model.lead.short}'(${model.lead.fit})에 적힌 조건부 비용 비교입니다. 확률이나 내 계좌에 대한 지시가 아니며, 아래 조건이 바뀌면 이 비교도 바뀝니다.`, 'xr-reading');
  const list = el(doc, 'ul', null, 'mk-combo__list mk-choices__list');
  for (const choice of model.choices) {
    const [label, tone] = STATE[choice.state];
    const li = el(doc, 'li', null, 'mk-choices__row');
    li.dataset.state = choice.state;
    li.append(el(doc, 'strong', choice.label), doc.createTextNode(' '), el(doc, 'span', label, `sx-chip sx-chip--sm sx-chip--${tone}`), doc.createTextNode(' '), el(doc, 'span', choice.text, 'mk-choices__text'));
    list.append(li);
  }
  const flips = el(doc, 'ul', null, 'mk-combo__list mk-choices__flips');
  for (const { title: name, d } of model.flips) flips.append(el(doc, 'li', `${d.condition} ${name} → ${d.towardLabel} (지금부터 ${d.text}${d.also?.length ? `, 함께 필요: ${d.also.map((also) => also.condition).join(', ')}` : ''})`));
  if (model.trigger) flips.append(el(doc, 'li', `다음 발표 확인: ${model.trigger.when} — ${model.trigger.text}`));
  box.replaceChildren(title, lead, list, ...(flips.childElementCount ? [el(doc, 'h3', '판단이 바뀌는 가장 가까운 조건', 'xr-h4'), flips] : []));
  return model;
}
