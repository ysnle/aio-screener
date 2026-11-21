// The three market flows (고른 상승 / 소수 종목 주도 / 동반 약세) — where today's market structure sits, read from
// breadth and leadership; 시장 폭 owns it, after that page's verdict. The closest flow on the face in full (its reading,
// the related themes, what to check and what to watch out for, what would prove it wrong), the other two one line each;
// every flow's conditions and basis are one method fold. The forward macro scenarios are 시장 상태 › 시나리오와 전망's.
import { el } from './dom.js';
import { markFrame } from './section-frame.js';
import { kindFold } from './indicator-face.js';
import { shortDate } from '../../domain/content/date-labels.js';

// "관련 섹터·테마" names are buttons — a theme opens its detail page, a sector (or a theme without an id) opens
// 테마 · 섹터. Without link data the plain sentence stays.
function opportunityNode(doc, root, view, className) {
  const node = el(doc, 'p', null, className);
  const parts = Array.isArray(view?.opportunityLinks) ? view.opportunityLinks.filter((part) => part?.links?.length) : [];
  if (!parts.length) { node.textContent = view?.opportunity || ''; return node; }
  parts.forEach((part, index) => {
    if (index) node.append(doc.createTextNode(', '));
    node.append(doc.createTextNode(`${part.label}: `));
    part.links.forEach((link, at) => {
      if (at) node.append(doc.createTextNode(', ')); // keeps the names apart ("소재에너지헬스케어")
      const button = el(doc, 'button', link.label, 'regime-opportunity-chip');
      button.type = 'button';
      button.title = link.kind === 'theme' && link.themeId ? `${link.label} 테마 상세` : '테마와 섹터 화면에서 보기';
      button.addEventListener('click', () => {
        if (link.kind === 'theme' && link.themeId && typeof root?.showThemeDetail === 'function') root.showThemeDetail(link.themeId);
        else root?.showPage?.('themes');
      });
      node.append(button);
    });
  });
  return node;
}

function listBlock(doc, title, items) {
  const box = el(doc, 'div', null, 'regime-scenario-list');
  box.append(el(doc, 'h4', title));
  const list = el(doc, 'ul'); for (const item of items || []) list.append(el(doc, 'li', item)); box.append(list);
  return box;
}

/** The flows card: `model` is the interpretation's scenarios stage, `outlook` its outlook. */
export function marketStructureSection(doc, root, model, outlook) {
  const section = el(doc, 'section', null, 'sx-card regime-scenarios');
  section.dataset.aioRegimeScenarios = 'native';
  section.id = 'regime-structure';
  section.setAttribute('aria-labelledby', 'regime-structure-title');
  const title = el(doc, 'h2', '지금 시장 구조', 'sx-card__title');
  title.id = 'regime-structure-title';
  section.append(title);
  const leadView = (outlook?.items || []).find((item) => item.id === outlook?.leadId);
  const lead = el(doc, 'p', !model.available ? '세 흐름 판단 보류' : leadView ? `'${leadView.title}'에 가장 가까움 · ${leadView.fit}` : `${model.asOf ? `${shortDate(model.asOf)} 종가` : ''}`, 'mk-structure__lead');
  lead.title = '맞는 조건 수이며 확률이 아닙니다';
  section.append(lead);
  markFrame(section, 'breadth.structure');
  if (!model.available) { section.append(el(doc, 'p', model.reason, 'regime-scenario-hold')); return section; }
  if (model.reason) section.append(el(doc, 'p', model.reason, 'regime-scenario-hold'));
  if (outlook?.available) section.append(el(doc, 'p', outlook.headline, 'regime-scenario-lead'));
  const byId = Object.fromEntries((outlook?.items || []).map((item) => [item.id, item]));
  const leadId = outlook?.leadId || null;
  const list = el(doc, 'ul', null, 'regime-scenario-grid');
  for (const scenario of model.scenarios) {
    const view = byId[scenario.id];
    const card = el(doc, 'li', null, 'regime-scenario-card');
    card.dataset.scenario = scenario.id; card.dataset.confirmed = String(scenario.confirmed);
    if (view) card.dataset.likelihood = view.likelihood;
    const head = el(doc, 'div', null, 'regime-scenario-head');
    // While the leadership break holds, the weakness card is titled as the transition and its count names 동반 약세.
    head.append(el(doc, 'b', view?.transition ? view.title : scenario.title), el(doc, 'span', view ? `${view.transition ? '동반 약세 ' : ''}${view.fit}${view.shortfall ? ', 아직 성립 아님' : ''}` : scenario.status, 'regime-scenario-status'));
    if (view?.shortfall) head.lastChild.title = view.shortfall; // what is still missing
    card.append(head);
    // The closest flow is read in full; the other two are their name and count (their conditions are in the method fold).
    if (scenario.id === leadId || !leadId) card.append(el(doc, 'p', view ? view.posture : scenario.interpretation, 'regime-scenario-reading'));
    if (scenario.id === leadId && view) {
      card.dataset.lead = 'true';
      card.append(opportunityNode(doc, root, view, 'regime-scenario-opportunity'), listBlock(doc, '확인할 것', view.check), listBlock(doc, '조심할 것', view.caution),
        el(doc, 'p', `이 해석이 틀렸다는 신호: ${scenario.counterEvidence}`, 'regime-scenario-reading'));
    }
    list.append(card);
  }
  section.append(list, kindFold(doc, 'method', '세 흐름의 조건과 근거', model.scenarios.flatMap((scenario) => [
    el(doc, 'h4', scenario.title), ...(byId[scenario.id] ? [el(doc, 'p', `조건 근거: ${byId[scenario.id].basis}`, 'regime-scenario-basis')] : []),
    listBlock(doc, '성립 조건', scenario.conditions)])));
  return section;
}

/** Places (or replaces) the flows card after `anchor` on 시장 폭. */
export function renderMarketStructure({ documentRef: doc, root, interpretation, anchor }) {
  if (!doc || !anchor) return null;
  const methodOpen = !!doc.getElementById('regime-structure')?.querySelector?.(':scope > details')?.open;
  doc.getElementById('regime-structure')?.remove();
  const section = marketStructureSection(doc, root, interpretation?.scenarios || { available: false }, interpretation?.outlook || null);
  const fold = section.querySelector?.(':scope > details');
  if (fold && methodOpen) fold.open = true;
  anchor.insertAdjacentElement('afterend', section);
  return section;
}
