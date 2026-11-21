// P1742 (owner 2026-10-13): "향후 시나리오" — the forward branches, owned by 시장 상태 › 시나리오와 전망 (매크로, 테마 and
// 오늘 link here). Every scenario is one row of a pick list ordered by conditions met; the chosen row's card shows in
// full — conditions met, what the market prices, the cause→effect chain with the places it strengthens and weakens and
// their themes, the dated triggers, the decision frame and the choices. Then the record of past judgements (raw table).
// The shared driver (rate-hub.js) is 금리와 환율's. Reads only published artifacts already loaded for 시장 상태.
import { CHOICES, EVENT_NAMES, fomcDecisionDate, macroTransitions } from '../../domain/market/regime/macro-crossroads.js';
import { scenarioLead } from '../../domain/market/regime/scenario-lead.js';
import { CHOICE_WORDS } from '../../domain/content/choice-words.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { foldSummary, markFold } from './indicator-face.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { groupCashflowSentence } from '../../domain/fundamental/quarterly-cashflow.js';
import { themesForBranch } from '../../domain/scenarios/exposures.js';
import { krThemeLabel } from '../../domain/themes/kr-themes.js';
import { el } from './dom.js';
import { decisionFrameBlock, favouredLine } from './decision-frame.js';
import { branchDecisionFrame } from '../../domain/scenarios/decision-frame.js';
import { withDirectionParticle } from '../../domain/content/korean-particle.js';
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';
import { pickList } from './pick-list.js';
import { BIGTECH_CASHFLOW, SCENARIO_OUTCOMES, SCENARIO_STATE } from '../../data/artifact-registry.js';

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const TONE = { same: '시장 가격 같은 방향', against: '시장 가격 반대 방향', neutral: '시장 가격 중립', unknown: '시장 가격 확인 불가' };

export { themeLinkRow };

// Owner 2026-10-19: the branches come from the shared interpretation, so 거시, 오늘, 브리핑, 테마 and the AI read one
// model: the same regime (breadth condition), the published previous lead (a tie keeps it) and the same release dates.
// `regime` is accepted for older callers and ignored — the interpretation builds it from the same inputs.
export function crossroadsForRoot(root, { nowMs = Date.now() } = {}) {
  return marketInterpretation(root, { nowMs }).crossroads;
}

/** P1743: load the weekly long-history outcomes and the per-refresh state once; repaint when either arrives. */
export function refreshScenarioArtifacts(root, repaint) {
  for (const spec of [SCENARIO_OUTCOMES, SCENARIO_STATE, BIGTECH_CASHFLOW]) {
    refreshSharedArtifact(root, spec).then(({ changed }) => { if (changed) repaint?.(); }).catch(() => {});
  }
}

const pastConflictTag = (doc, item) => {
  const tag = el(doc, 'span', '과거 표본과 어긋남', 'xr-tag is-past-conflict');
  tag.title = `비슷한 때 이후 ${item.pastConflict.horizon}거래일 상승 ${item.pastConflict.sharePct}%, 같은 기록 전체 거래일 ${item.pastConflict.basePct}% (${item.pastConflict.n}번)`;
  return tag;
};
function meter(doc, item) {
  const box = el(doc, 'span', null, 'xr-meter');
  // v57.61 WCAG 1.1.1: the fit text is printed right beside the dots, so the meter is decorative for assistive tech.
  box.setAttribute('aria-hidden', 'true');
  const order = (ok) => ok === true ? 0 : ok === false ? 1 : 2; // filled dots first, so 3/4 reads as three filled
  for (const [, ok] of [...item.conditions].sort((a, b) => order(a[1]) - order(b[1]))) box.append(el(doc, 'span', null, `xr-dot ${ok == null ? 'is-unknown' : ok ? 'is-met' : 'is-unmet'}`));
  return box;
}

function chainRow(doc, chain) {
  const row = el(doc, 'div', null, 'xr-chain');
  chain.forEach((step, index) => {
    if (index) row.append(el(doc, 'span', '→', 'xr-chain-sep'));
    row.append(el(doc, 'span', step, 'xr-chain-step'));
  });
  return row;
}

function linkButton(doc, root, label, route, anchor = null) {
  const button = el(doc, 'button', `${label} →`, 'flow-next-link');
  button.type = 'button';
  button.addEventListener('click', () => {
    root.showPage?.(route);
    // v57.76: 거시's scenarios now follow the current-state blocks, which can still grow after the route change — the
    // scroll repeats briefly (one 60ms try landed ~2,000px short on desktop).
    if (anchor) for (const delay of [80, 400, 1200]) setTimeout(() => doc.getElementById(anchor)?.scrollIntoView?.({ block: 'start' }), delay);
  });
  return button;
}

// v57.54 audit (13): each path links straight to the themes its exposure tags favour (US: the theme's detail; KR: the
// Korean theme stages on 테마, after the US ones). The same registry the playbook uses; no ticker is named.
// v57.71 / v57.86 (owner 2026-10-15, live review): the list is the path's exposure, not the themes' current strength
// ("순풍인 테마 반도체" on a -4% chip day read as a call on today's move), so the label names it as that condition.
function themeLinks(doc, root, item, max) {
  if (!item) return null;
  const { wind, themes } = themesForBranch(item);
  const usNames = new Map((Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []).map((theme) => [theme.id, theme.nameKr || theme.name || theme.id]));
  const us = themes.filter((theme) => theme.market === 'US' && usNames.has(theme.id)).slice(0, max);
  const kr = themes.filter((theme) => theme.market === 'KR');
  if (!us.length && !kr.length) return null;
  const buttons = us.map((theme) => {
    const button = el(doc, 'button', `${usNames.get(theme.id)} →`, 'flow-next-link');
    button.type = 'button';
    button.title = '테마 상세, 구성 종목';
    button.addEventListener('click', () => { if (typeof root?.showThemeDetail === 'function') root.showThemeDetail(theme.id); else root?.showPage?.('themes'); });
    return button;
  });
  if (kr.length) {
    const names = kr.slice(0, 3).map((theme) => krThemeLabel(theme.id).split(' / ')[0]);
    const button = linkButton(doc, root, `한국 ${names.join('·')}${kr.length > 3 ? ` 외 ${kr.length - 3}개` : ''}`, 'themes', 'theme-playbook-title');
    button.title = '테마 화면의 한국 테마 단계';
    buttons.push(button);
  }
  return { label: wind === 'tail' ? '이 시나리오의 수혜 테마(현재 강약과 별개)' : '영향이 갈리는 테마', buttons };
}

// The themes as one row of their own (브리핑's split read).
function themeLinkRow(doc, root, item, { max = 4 } = {}) {
  const links = themeLinks(doc, root, item, max);
  if (!links) return null;
  const row = el(doc, 'div', null, 'xr-explore xr-theme-links');
  row.append(el(doc, 'span', links.label, 'xr-explore-label'), ...links.buttons);
  return row;
}

// (owner 2026-11-20) every scenario is one row of a list ordered by how far its conditions are met — the current branches
// (lead, tied, alternative) first — with name, met/total and one line; the chosen row's card shows in full beside the list
// (below it on a narrow screen), the most-met one to start. No fold: the list is the comparison and the card is the reading;
// each card's sample is its frame's raw-table fold. Three full cards stacked ran to 6,700px on a phone.
export function orderedScenarios(model) {
  const lead = scenarioLead(model);
  const leadIds = new Set(lead.ids);
  const current = new Set([...lead.ids, model.altId].filter(Boolean));
  const rank = (item) => (leadIds.has(item.id) ? 0 : item.id === model.altId ? 2 : 3);
  // v57.81 (audit X2): a branch whose core condition is met comes before one that only matches side conditions.
  const fit = (item) => (item.known >= 2 && item.total ? item.met / item.total + (item.gate?.met === true ? 1 : 0) : -1);
  return { lead, items: [...model.items].sort((a, b) => (current.size ? rank(a) - rank(b) : 0) || fit(b) - fit(a)) };
}

function scenarioMap(doc, root, model, picked = null) {
  const { lead, items } = orderedScenarios(model);
  const leadIds = new Set(lead.ids);
  const card = (item) => {
    const node = scenarioCard(doc, root, item, branchDecisionFrame(item, { cash: model.cash }));
    // Every marked card carries the same mark; a tie also says so (data-tied), so no single card reads as the one 중심.
    if (leadIds.has(item.id)) { node.dataset.lead = 'true'; if (lead.state === 'tie') node.dataset.tied = 'true'; }
    return node;
  };
  // Only a reader's choice is kept across re-renders: the default follows the order, which changes as data arrives.
  return pickList(doc, {
    items, picked, label: `시나리오 ${items.length}개`, key: 'branch',
    classes: { wrap: 'xr-map', list: 'xr-picks', pick: 'xr-pick', detail: 'xr-pick-detail' },
    row: (item, button) => {
      if (leadIds.has(item.id)) button.dataset.lead = 'true';
      const [name, what] = item.title.split(' — ');
      // The second line says what the scenario is; the count is already beside the name, so only a missing core condition is added.
      const line = [what, item.gate && item.gate.met !== true ? '핵심 조건 미충족' : ''].filter(Boolean).join(' · ');
      return [el(doc, 'span', name, 'xr-map-title'), meter(doc, item), el(doc, 'span', `조건 ${item.met}/${item.total}`, 'xr-map-fit'), el(doc, 'span', line || item.status || item.fit, 'xr-pick-line')];
    },
    detail: card
  });
}

function showScenarioView(doc, root) {
  const page = doc?.getElementById?.('page-signal');
  const isCurrent = page?.classList.contains('active');
  root?._aioShowPageView?.('page-signal', 'story', { byReader: isCurrent });
  if (!isCurrent) root?.showPage?.('signal');
}

/** Open 시장 상태 at the scenario map. The blocks above can still grow after the route change, so the scroll repeats. */
export function showCrossroadsSection(doc, root) {
  showScenarioView(doc, root);
  for (const delay of [80, 400, 1200]) setTimeout(() => doc?.getElementById?.('macro-crossroads')?.scrollIntoView?.({ block: 'start' }), delay);
}

/** Open one branch's detail on 시장 상태 (from the 매크로 factor cards or another screen) and bring it into view. */
export function openCrossroadsBranch(doc, root, branchId) {
  const reveal = () => {
    const pick = doc?.querySelector?.(`#regime-depth-fold .xr-pick[data-branch="${branchId}"]`);
    if (pick) pick.click();
    const card = doc?.querySelector?.(`#regime-depth-fold .xr-branch[data-branch="${branchId}"]`);
    if (!card) return false;
    card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    (pick || card).focus?.({ preventScroll: true });
    return true;
  };
  showScenarioView(doc, root);
  if (reveal()) return;
  // The scenario map may still be mounting after the route change: try a few times, then give up quietly.
  const retry = (delays) => { if (!delays.length) return; setTimeout(() => { if (!reveal()) retry(delays.slice(1)); }, delays[0]); };
  retry([80, 300, 900]);
}

const CASHFLOW_MAX_AGE_MS = 10 * 86400000;
function bigtechCashflowText(root) {
  const payload = root?.[BIGTECH_CASHFLOW.key];
  const age = Date.now() - Date.parse(payload?.generatedAt || '');
  const sentence = age >= 0 && age <= CASHFLOW_MAX_AGE_MS ? groupCashflowSentence(payload?.hyperscalers) : '';
  return sentence ? `투자 자금 여력(SEC 분기 공시 기준, 조건에 넣지 않는 참고값): ${sentence}` : '';
}

// One scenario on the face: name, met-condition dots, status, the price direction and favoured choice, then its body.
function scenarioCard(doc, root, item, frame = null) {
  const card = el(doc, 'article', null, 'xr-branch');
  card.dataset.branch = item.id;
  card.tabIndex = -1;
  const [name, sub] = item.title.split(' — ');
  const head = el(doc, 'h4', null, 'xr-map-head');
  head.append(el(doc, 'span', name, 'xr-map-title'), meter(doc, item), el(doc, 'span', item.status || item.fit, 'xr-map-fit'));
  const tags = el(doc, 'p', null, 'xr-map-tags');
  tags.append(el(doc, 'span', TONE[item.pricing.tone] || TONE.unknown, `xr-tag is-${item.pricing.tone}`),
    el(doc, 'span', `${CHOICE_WORDS.favored}: ${item.favored.map((key) => CHOICES[key]).join(', ')}`, 'xr-tag is-choice'));
  // v57.84 (owner 2026-10-16): favored stays; a conflict with the past frequency is named beside it.
  if (item.pastConflict) tags.append(pastConflictTag(doc, item));
  card.append(head, ...(sub ? [el(doc, 'p', sub, 'xr-map-sub')] : []), tags);
  const body = el(doc, 'div', null, 'xr-branch-body');
  body.append(chainRow(doc, item.chain));
  const impact = el(doc, 'dl', null, 'xr-impact');
  impact.append(el(doc, 'dt', '강해지는 곳'), el(doc, 'dd', item.impact.firmer), el(doc, 'dt', '약해지는 곳'), el(doc, 'dd', item.impact.weaker));
  if (item.impact.mixed) impact.append(el(doc, 'dt', '엇갈리는 쪽'), el(doc, 'dd', `${item.impact.mixed} — 업종·기업마다 이익과 부담이 갈립니다`));
  const themes = themeLinks(doc, root, item, 6);
  if (themes) { const links = el(doc, 'dd', null, 'xr-impact-links'); links.append(...themes.buttons); impact.append(el(doc, 'dt', themes.label, 'xr-impact-wide'), links); }
  body.append(impact);
  body.append(el(doc, 'h4', '판단 근거', 'xr-h4'));
  const evidence = el(doc, 'ul', null, 'xr-evidence');
  // v58.74 (text audit): the conditions carry commas and '또는' themselves; joined into one sentence they read as five lines.
  const conditionItem = el(doc, 'li', `조건 ${item.met}/${item.total}`);
  const conditionList = el(doc, 'ul', null, 'xr-conditions');
  for (const text of item.basis) conditionList.append(el(doc, 'li', text));
  conditionItem.append(conditionList);
  evidence.append(conditionItem, el(doc, 'li', `시장 가격: ${item.pricing.text}`));
  // v59.56 (X bookmarks 11/01): the AI-capex funding gauge the authors read, from SEC quarterly filings — reference, not a condition.
  const cashflow = item.id === 'aibust' ? bigtechCashflowText(root) : '';
  if (cashflow) evidence.append(el(doc, 'li', cashflow));
  body.append(evidence);
  // The past frequency is the frame's 가능성 line; the full sentence (span, definition, bridge) sits in its fold.
  const frameBlock = decisionFrameBlock(doc, frame, { method: `${item.past.text}${item.pastBridge ? ` ${item.pastBridge}` : ''}`, side: false });
  if (frameBlock) body.append(el(doc, 'h4', '과거 기록으로 본 득실', 'xr-h4'), frameBlock);
  else body.append(el(doc, 'p', `과거 빈도: ${item.past.text}`, 'xr-reading'));
  if (item.triggers.length) {
    body.append(el(doc, 'h4', '확인할 발표', 'xr-h4'));
    const triggers = el(doc, 'ul', null, 'xr-triggers');
    for (const trigger of item.triggers) triggers.append(el(doc, 'li', `${trigger.when} — ${trigger.text}`));
    body.append(triggers);
  }
  body.append(el(doc, 'h4', '대응별 득실', 'xr-h4'));
  const table = el(doc, 'div', null, 'xr-choices');
  for (const [key, text] of Object.entries(item.choices)) {
    const row = el(doc, 'div', null, 'xr-choice');
    if (item.favored.includes(key)) row.dataset.favored = 'true';
    row.append(el(doc, 'span', CHOICES[key], 'xr-choice-name'), el(doc, 'span', text, 'xr-choice-text'));
    if (item.favored.includes(key)) row.append(el(doc, 'span', CHOICE_WORDS.favored, 'xr-choice-flag'));
    table.append(row);
  }
  body.append(table, favouredLine(doc, frame) || el(doc, 'p', item.favoredWhy, 'xr-reading'));
  card.append(body);
  return card;
}

const shortDate = (iso) => md(String(iso || '').slice(0, 10));
// v57.54 review: a release is named by its own period (8월분, 9/17 결정), and the day AIO judged it comes after —
// "10/13 CPI (2026-08-01 기준)" read as if the August CPI came out on 10/13.
const periodLabel = (period) => { const text = String(period || ''); const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(text); if (!m) return text ? `(${text})` : ''; return !m[3] || m[3] === '01' ? `${Number(m[2])}월분` : `${Number(m[2])}/${Number(m[3])}`; };
// v58.74 (text audit): records written before the text pass keep their old wording ('유가 충격'(으)로, −0.5%); they are
// read with today's particle and sign rule instead of being rewritten in the stored history.
const recordText = (text) => String(text ?? '').replace(/('[^']+'|[가-힣A-Za-z0-9]+)\(으\)로/g, (match, word) => withDirectionParticle(word)).replace(/−(?=\d)/g, '-');
/** P1743: what the automated record saw change — branch lead/alt shifts, condition flips, and scored releases. */
// v59.51 (content audit): the record is reference for a returning reader — one closed line on the face.
function changeLog(doc, state, open = false, checkedAt = null) {
  const transitions = macroTransitions(state).slice(-6).reverse(); // v59.51 (area H): macro events only
  const scored = (state?.eventOutcomes || []).slice(-6).reverse();
  if (!transitions.length && !scored.length) return null;
  const box = markFold(el(doc, 'details', null, 'xr-changes'), 'raw-table');
  box.open = open;
  box.append(foldSummary(doc, 'raw-table', `지난 판정과 바뀐 점 (발표 판정 ${scored.length}건, 변화 ${transitions.length}건)`));
  if (scored.length) {
    box.append(el(doc, 'h4', '지난 발표 판정', 'xr-h4'));
    const list = el(doc, 'ul', null, 'xr-scored');
    for (const row of scored) list.append(el(doc, 'li', `${row.name} ${periodLabel(row.name === EVENT_NAMES['us-fed-rate'] && hasLeadingIsoDay(String(row.period || '')) ? fomcDecisionDate(row.period) : row.period)}: ${recordText(row.actualText)} → ${row.matched.length ? `${row.matched.map((m) => `'${m.title}'`).join(', ')} 시나리오의 기준 충족` : '어느 시나리오의 기준에도 해당하지 않음'} (판정 ${shortDate(row.at)})`));
    box.append(list);
  }
  if (transitions.length) {
    box.append(el(doc, 'h4', '최근 변화', 'xr-h4'));
    const list = el(doc, 'ul', null, 'xr-transitions');
    // v57.88 (screen audit): several records a day read as contradictions with the date alone — the KST time is shown.
    const stamp = (iso) => { const ms = Date.parse(iso || ''); if (!Number.isFinite(ms)) return shortDate(iso); const kst = new Date(ms + 9 * 3600000).toISOString(); return `${md(kst.slice(0, 10))} ${kst.slice(11, 16)} KST`; };
    for (const row of transitions) list.append(el(doc, 'li', `${stamp(row.at)} ${recordText(row.text)}`));
    box.append(list);
  }
  // v58.79: the "recomputed every refresh" caption became the fold's hover.
  // v59.70: an unchanged state keeps its published bytes, so the producer ledger's checkedAt is the last recomputation.
  const computedAt = checkedAt || state?.generatedAt;
  box.title = computedAt ? `마지막 계산 ${shortDate(computedAt)}` : '';
  return box;
}

/** Render the scenario map in the host which 시장 상태 mounts; `leadAside()` may add one line under the lead. */
export function renderMacroCrossroads({ documentRef: doc, root, regime = null, host: target, leadAside = null } = {}) {
  if (!target) return null;
  const model = crossroadsForRoot(root, { regime });
  root.__aioMacroCrossroads = model;
  if (!target.dataset.aioScenarioLoad) { target.dataset.aioScenarioLoad = 'on'; refreshScenarioArtifacts(root, () => renderMacroCrossroads({ documentRef: doc, root, regime, host: target, leadAside })); }
  const picked = target.querySelector('.xr-map')?.dataset.picked || null;
  const focused = target.contains?.(doc.activeElement) ? doc.activeElement?.closest?.('[data-branch]')?.dataset.branch : null;
  const changesOpen = !!target.querySelector('details.xr-changes')?.open;
  const aside = leadAside?.() || null;
  if (!model.available) { target.replaceChildren(el(doc, 'p', model.headline, 'xr-lead'), ...(aside ? [aside] : [])); return model; }
  // v57.79 (UI review): the heading says what the list is (ordered by conditions met), not how to use it.
  const mapHead = el(doc, 'h3', `시나리오 ${model.items.length}개 — 조건 충족 순`, 'xr-h3');
  const basis = el(doc, 'p', '과거 빈도는 비슷한 시장 움직임으로 고른 비교입니다.', 'xr-reading');
  target.replaceChildren(el(doc, 'p', model.headline, 'xr-lead'), ...(aside ? [aside] : []), mapHead, basis, scenarioMap(doc, root, model, picked), ...[changeLog(doc, root?.[SCENARIO_STATE.key], changesOpen, root?._aioArtifactFreshness?.('scenario-state.json')?.checkedAt)].filter(Boolean));
  target.dataset.aioCrossroads = 'native';
  if (focused) target.querySelector(`.xr-pick[data-branch="${focused}"]`)?.focus?.({ preventScroll: true }); // a repaint keeps keyboard focus
  return model;
}


