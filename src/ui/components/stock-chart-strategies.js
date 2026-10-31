// v58.79 (owner 2026-10-25, chart review): the same chart read under four trading styles, so a reader picks the logic
// that fits their horizon and temperament instead of one verdict. The chosen style stays on this device (storage
// gateway). Each style shows its own conditions (met/total is a count) and its stop, profit-taking and invalidation
// rule; nothing fills the plan fields and no slot carries this stock's price (R724 — the reader chooses the price).
import { strategyLenses, STRATEGY_STYLES } from '../../domain/technical/chart-strategies.js';
import { createStorageGateway } from '../../platform/storage.js';
import { el } from './dom.js';

const STYLE_KEY = 'chart-style-v1';
const storage = createStorageGateway();

export function strategySection(doc, analysis, levels, rsi = null) {
  const lenses = strategyLenses(analysis, levels?.available ? levels : null, { rsi });
  if (!lenses.length) return null;
  const section = el(doc, 'section', null, 'chart-strategies');
  section.id = 'chart-strategies';
  section.append(el(doc, 'h3', '매매 방식별로 보기', 'briefing-h2'));
  const fit = lenses.filter((lens) => lens.met === lens.total).map((lens) => lens.name);
  // v59.45 R4-02: the share is of the conditions that could be checked (met/known), unknowns stay out of the denominator,
  // and "가장 많이 맞는 방식" is named only when one style leads with at least one met condition — an all-zero tie read
  // "돌파(0/5)" and opened that tab as if it fitted best.
  const ratio = (lens) => (lens.known > 0 ? lens.met / lens.known : null);
  const ranked = lenses.filter((lens) => ratio(lens) != null && lens.met > 0).sort((a, b) => ratio(b) - ratio(a));
  const best = ranked.length && (ranked.length === 1 || ratio(ranked[0]) > ratio(ranked[1])) ? ranked[0] : null;
  const unknownOf = (lens) => lens.total - lens.known;
  section.append(el(doc, 'p', fit.length ? `지금 조건이 모두 맞는 방식은 ${fit.join('·')}입니다. 같은 차트도 방식에 따라 들어갈 자리·손절·목표가 다릅니다.`
    : best ? `조건이 모두 맞는 방식은 없고, 확인된 조건 기준으로 가장 많이 맞는 방식은 ${best.name}(${best.met}/${best.known}${unknownOf(best) ? `, 확인 불가 ${unknownOf(best)}` : ''})입니다. 맞지 않는 방식이라면 기다리는 것도 계획입니다.`
      : '조건이 모두 맞는 방식은 없고, 확인된 조건으로 앞서는 방식도 없습니다. 맞지 않는 방식이라면 기다리는 것도 계획입니다.', 'xr-reading'));
  let chosen = storage.get(STYLE_KEY, '') || '';
  if (!lenses.some((lens) => lens.id === chosen)) chosen = best?.id || lenses[0].id;
  const tabs = el(doc, 'div', null, 'sx-seg chart-strategy-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', '매매 방식');
  Object.assign(tabs.style, { display: 'flex', flexWrap: 'wrap', maxWidth: '100%' }); // four styles wrap on a phone
  const card = el(doc, 'div', null, 'chart-strategy');
  card.setAttribute('aria-live', 'polite');
  const show = (id) => {
    const lens = lenses.find((row) => row.id === id) || lenses[0];
    chosen = lens.id;
    tabs.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.style === lens.id)));
    const head = el(doc, 'h4', `${lens.name} — 조건 ${lens.met}/${lens.total}${unknownOf(lens) ? `, 확인 불가 ${unknownOf(lens)}` : ''}`);
    const who = el(doc, 'p', `맞는 사람: ${lens.who}`, 'theme-strength-basis');
    who.title = `근거: ${lens.source}`;
    const list = el(doc, 'ul', null, 'chart-strategy-checks');
    Object.assign(list.style, { margin: '4px 0', paddingLeft: '0', listStyle: 'none', fontSize: '13px', lineHeight: '1.7' });
    for (const [label, ok] of lens.conditions) {
      const item = el(doc, 'li', `${ok === true ? '충족' : ok === false ? '미충족' : '확인 불가'} · ${label}`);
      item.className = `chart-strategy-check ${ok === true ? 'is-pass' : ok === false ? 'is-fail' : 'is-unknown'}`;
      list.append(item);
    }
    const rules = el(doc, 'dl', null, 'regime-evidence chart-strategy-rules');
    // v59.46 P24-PRODUCT-01: the slots name the style's rule, not this stock's price (R724); prices are in the 가격 레벨 section.
    for (const [label, value] of [['이 방식의 손절 규칙', lens.stop], ['이 방식의 이익 확정 규칙', lens.target], ['계획 무효', lens.invalidation]]) rules.append(el(doc, 'dt', label), el(doc, 'dd', value));
    card.replaceChildren(head, who, list, rules);
  };
  for (const style of STRATEGY_STYLES) {
    const lens = lenses.find((row) => row.id === style.id);
    const button = el(doc, 'button', `${style.name} ${lens.met}/${lens.total}`);
    button.type = 'button';
    button.dataset.style = style.id;
    button.title = style.who;
    button.addEventListener('click', () => { show(style.id); storage.set(STYLE_KEY, style.id); });
    tabs.append(button);
  }
  show(chosen);
  const note = el(doc, 'p', '방식은 성향의 선택이고 정답이 아닙니다. 이 종목의 이동평균·스윙 고저점·거래 집중 가격대는 아래 「가격 레벨과 내 계획」에 있습니다 — 고른 방식의 규칙에 맞는 가격을 골라 직접 넣어 보세요.', 'theme-strength-basis');
  section.append(tabs, card, note);
  return section;
}
