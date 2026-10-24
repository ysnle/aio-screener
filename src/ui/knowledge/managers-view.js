// 리서치 라이브러리 · 대가 보유 종목. Contents: the eight ways of managing money, each listing its managers;
// 운용 방식 비교 opens the side-by-side table. The open manager's quarterly holdings and changes are the
// document; the right column says what that style is for and what 13F cannot show about it.
import { createResearchShell, asideBlock, el } from './research-shell.js';
import { STYLE_FRAMES, styleFrameOf } from '../../domain/masters/style-frames.js';
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
  const methodOnly = [];
  for (const manager of catalog?.managers || []) {
    const listed = nameById.get(manager.id);
    if (!listed) continue;
    if (listed.type === 'METHOD_ONLY') methodOnly.push(listed);
    else {
      const frame = styleFrameOf(manager.style);
      if (frame) grouped.get(frame.id).push(listed);
    }
  }
  const appendGroup = (label, managers) => {
    const group = el(doc, 'div', 'rl-nav-group');
    const head = el(doc, 'p', 'rl-nav-title', label);
    head.appendChild(el(doc, 'span', null, String(managers.length)));
    group.appendChild(head);
    managers.forEach((manager) => group.appendChild(navButton(doc, manager.name, { active: !overview && manager.id === selectedId, action: 'select-manager', value: manager.id, sub: true })));
    nav.appendChild(group);
  };
  for (const frame of STYLE_FRAMES) {
    const managers = grouped.get(frame.id) || [];
    if (managers.length) appendGroup(frame.label, managers);
  }
  if (methodOnly.length) appendGroup('방법론 참고(13F 미신고)', methodOnly);
  if (overview) {
    const article = el(doc, 'article', 'af-article');
    // v57.48 expert review #25: a two-sentence lead; the longer explanation is folded below it.
    const more = el(doc, 'details', 'af-basis');
    more.append(el(doc, 'summary', null, '13F로 보이는 것과 안 보이는 것'),
      el(doc, 'p', 'rl-copy', '운용사마다 실제 기준 분기와 제출일이 다르니 각 상세의 보고 분기를 함께 본다. 지수를 그대로 따라가는 운용사의 보유 변화는 판단이 아니라 자금 흐름의 결과이고, 퀀트 펀드의 보유 목록에는 숏 포지션이 빠져 있어 방향을 말해 주지 않는다. 매크로 펀드의 핵심 포지션인 선물·외환·국채는 아예 보이지 않는다.'));
    article.append(el(doc, 'p', 'af-kicker', '대가 보유 종목'), el(doc, 'h2', 'af-issue', '돈을 굴리는 방식별로 13F 읽기'),
      el(doc, 'p', 'af-lead', '13F는 전체 포트폴리오가 아니다 — 미국 상장 주식과 일부 옵션의 분기 말 롱 포지션을 분기가 끝난 뒤 45일 이내에 신고하는 공시다. 같은 13F라도 누가 냈느냐에 따라 읽는 법이 달라서, 보유 목록을 열기 전에 그 운용사가 어떤 문제를 풀려고 하는지부터 본다.'), more);
    if (styleTable) { styleTable.open = true; article.appendChild(styleTable); }
    main.appendChild(article);
  } else if (detail) {
    main.appendChild(detail);
  }
  const selectedCatalog = (catalog?.managers || []).find((manager) => manager.id === selectedId);
  const frame = selectedCatalog ? styleFrameOf(selectedCatalog.style) : null;
  if (!overview && frame) {
    const box = asideBlock(doc, `방식, ${frame.label}`);
    [['풀려는 문제', frame.problem], ['수익의 원천', frame.source], ['감수하는 위험', frame.risk], ['13F에 보이는 것', frame.sees], ['13F로 알 수 없는 것', frame.blind]].forEach(([k, v]) => {
      const row = el(doc, 'p', 'rl-copy');
      row.append(el(doc, 'strong', null, `${k} `), doc.createTextNode(v));
      box.appendChild(row);
    });
    aside.appendChild(box);
    // 2026-10-14 audit: the "같은 방식의 운용사" list repeated the left TOC group (same styleFrameOf grouping,
    // same 13F-only filter), so the right column keeps only the style frame and the ticker lookup.
  }
  if (tickerLookup) {
    const box = asideBlock(doc, '종목으로 찾기');
    box.appendChild(tickerLookup);
    aside.appendChild(box);
  }
  return shell;
}
