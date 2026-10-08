// 리서치 라이브러리 · 운용사·13F. Contents: the eight ways of managing money, each listing its managers;
// 운용 방식 비교 opens the side-by-side table. The open manager's quarterly holdings and changes are the
// document; the right column says what that style is for and what 13F cannot show about it.
import { createResearchShell, asideBlock, el } from './research-shell.js';
import { STYLE_FRAMES, groupManagersByStyle, styleFrameOf } from '../../domain/masters/style-frames.js';
import { ensureFrameStyle } from './analysis-frames.js';

function navButton(doc, label, { active = false, action, value = null, sub = false } = {}) {
  const node = el(doc, 'button', `rl-nav-item${sub ? ' rl-nav-sub' : ''}${active ? ' is-active' : ''}`, label);
  node.type = 'button';
  node.dataset.mastersAction = action;
  if (value != null) node.dataset.mastersValue = value;
  node.setAttribute('aria-pressed', active ? 'true' : 'false');
  return node;
}

export function renderManagersPage(doc, { root, catalog, registry, selectedId, overview, detail, styleTable, tickerLookup, onLocal }) {
  ensureFrameStyle(doc);
  const { shell, nav, main, aside } = createResearchShell(doc, { root, route: 'masters', onLocal });
  shell.dataset.mastersView = overview ? 'styles' : 'manager';
  const top = el(doc, 'div', 'rl-nav-group');
  top.appendChild(navButton(doc, '운용 방식 비교', { active: overview, action: 'style-overview' }));
  nav.appendChild(top);
  const nameById = new Map((registry || []).map((manager) => [manager.id, manager]));
  const grouped = new Map(STYLE_FRAMES.map((frame) => [frame.id, []]));
  for (const manager of catalog?.managers || []) {
    const frame = styleFrameOf(manager.style);
    if (frame && nameById.has(manager.id)) grouped.get(frame.id).push(nameById.get(manager.id));
  }
  for (const frame of STYLE_FRAMES) {
    const managers = grouped.get(frame.id) || [];
    if (!managers.length) continue;
    const group = el(doc, 'div', 'rl-nav-group');
    const head = el(doc, 'p', 'rl-nav-title', frame.label);
    head.appendChild(el(doc, 'span', null, String(managers.length)));
    group.appendChild(head);
    managers.forEach((manager) => group.appendChild(navButton(doc, manager.name, { active: !overview && manager.id === selectedId, action: 'select-manager', value: manager.id, sub: true })));
    nav.appendChild(group);
  }
  if (overview) {
    const article = el(doc, 'article', 'af-article');
    article.append(el(doc, 'p', 'af-kicker', '운용사·13F'), el(doc, 'h2', 'af-issue', '돈을 굴리는 방식별로 13F 읽기'),
      el(doc, 'p', 'af-lead', '13F는 전체 포트폴리오가 아니다. 미국 상장 주식과 일부 옵션의 분기 말 롱 포지션을, 통상 분기가 끝난 뒤 45일 이내에 신고하는 공시다. 운용사마다 실제 기준 분기와 제출일이 다르니 각 상세의 보고 분기를 함께 본다. 그래서 같은 13F라도 누가 냈느냐에 따라 읽는 법이 완전히 다르다. 지수를 그대로 따라가는 운용사의 보유 변화는 판단이 아니라 자금 흐름의 결과이고, 퀀트 펀드의 보유 목록에는 숏 포지션이 빠져 있어 방향을 말해 주지 않는다. 매크로 펀드의 핵심 포지션인 선물·외환·국채는 아예 보이지 않는다. 보유 목록을 열기 전에, 그 운용사가 어떤 문제를 풀려고 하는지부터 보는 이유다.'));
    if (styleTable) { styleTable.open = true; article.appendChild(styleTable); }
    main.appendChild(article);
  } else if (detail) {
    main.appendChild(detail);
  }
  const selectedCatalog = (catalog?.managers || []).find((manager) => manager.id === selectedId);
  const frame = selectedCatalog ? styleFrameOf(selectedCatalog.style) : null;
  if (!overview && frame) {
    const box = asideBlock(doc, `방식 · ${frame.label}`);
    [['풀려는 문제', frame.problem], ['수익의 원천', frame.source], ['감수하는 위험', frame.risk], ['13F에 보이는 것', frame.sees], ['13F로 알 수 없는 것', frame.blind]].forEach(([k, v]) => {
      const row = el(doc, 'p', 'rl-copy');
      row.append(el(doc, 'strong', null, `${k} `), doc.createTextNode(v));
      box.appendChild(row);
    });
    aside.appendChild(box);
    const peers = (groupManagersByStyle(catalog?.managers || []).get(frame.id) || []);
    if (peers.length > 1) {
      const peersBox = asideBlock(doc, '같은 방식의 운용사');
      (catalog?.managers || []).filter((manager) => styleFrameOf(manager.style)?.id === frame.id && manager.id !== selectedId && nameById.has(manager.id)).forEach((manager) => peersBox.appendChild(navButton(doc, nameById.get(manager.id).name, { action: 'select-manager', value: manager.id })));
      aside.appendChild(peersBox);
    }
  }
  if (tickerLookup) {
    const box = asideBlock(doc, '종목으로 찾기');
    box.appendChild(tickerLookup);
    aside.appendChild(box);
  }
  return shell;
}
