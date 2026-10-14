// P1742 (owner 2026-10-13): "앞으로의 갈림길" — the forward branches on 거시 (full), 오늘 and 시장 상태 (compact).
// One visual (the upcoming releases and the branch map with each branch's met-condition dots), a short reading
// (why rates matter and what would have to happen for them to fall), then per-branch detail folded inside each map
// row (one list, not the map plus a second accordion of the same branches): the
// cause→effect chain, the dated triggers, the three likelihood lines and the reader's choices with their
// opportunity cost. Reads only published artifacts already loaded for the 거시 and 시장 상태 screens.
import { buildMacroRead } from '../../domain/macro/macro-read.js';
import { buildMacroCrossroads, upcomingMacroEvents, CHOICES, SHAPES } from '../../domain/market/macro-crossroads.js';
import { refreshSharedArtifact, SCENARIO_OUTCOMES, SCENARIO_STATE } from '../../data/shared-artifacts.js';
import { themesForBranch } from '../../domain/scenarios/exposures.js';
import { krThemeLabel } from '../../domain/themes/kr-themes.js';
import { el } from './dom.js';

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
// Korean particles follow the last Hangul syllable of a quoted path name (quotes are skipped).
const batchim = (text) => { const syllables = String(text || '').match(/[가-힣]/g); return syllables ? (syllables.at(-1).charCodeAt(0) - 0xac00) % 28 !== 0 : false; };
const josa = (text, withFinal, withoutFinal) => (batchim(text) ? withFinal : withoutFinal);
const TONE = { same: '시장 가격 같은 방향', against: '시장 가격 반대 방향', neutral: '시장 가격 중립', unknown: '시장 가격 보류' };

export { themeLinkRow };

export function crossroadsForRoot(root, { regime = null, nowMs = Date.now() } = {}) {
  const macroHistory = root?._aioMacroHistory || null;
  const history = root?._aioHistory || [];
  const read = buildMacroRead({ macro: root?._aioServerMacro || null, macroHistory, regime: regime?.available ? regime : null, history });
  const breadthState = regime?.axes?.find((axis) => axis.id === 'breadth')?.state || null;
  const events = upcomingMacroEvents({ releases: root?.AIO_MACRO_CALENDAR?.releases || {}, schedules: root?.AIO_MACRO_OFFICIAL_SCHEDULES || {}, nowMs });
  return buildMacroCrossroads({ read: read ? { ...read, breadthState } : read, macroHistory, history, events, outcomes: root?.[SCENARIO_OUTCOMES.key] || null });
}

/** P1743: load the weekly long-history outcomes and the per-refresh state once; repaint when either arrives. */
export function refreshScenarioArtifacts(root, repaint) {
  for (const spec of [SCENARIO_OUTCOMES, SCENARIO_STATE]) {
    refreshSharedArtifact(root, spec).then(({ changed }) => { if (changed) repaint?.(); }).catch(() => {});
  }
}

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
    if (anchor) setTimeout(() => doc.getElementById(anchor)?.scrollIntoView?.({ block: 'start' }), 60);
  });
  return button;
}

// v57.54 audit (13): each path links straight to the themes its exposure tags favour (US: the theme's detail; KR: the
// Korean theme stages on 테마, after the US ones). The same registry the playbook uses; no ticker is named.
function themeLinkRow(doc, root, item, { max = 4 } = {}) {
  if (!item) return null;
  const { wind, themes } = themesForBranch(item);
  const usNames = new Map((Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []).map((theme) => [theme.id, theme.nameKr || theme.name || theme.id]));
  const us = themes.filter((theme) => theme.market === 'US' && usNames.has(theme.id)).slice(0, max);
  const kr = themes.filter((theme) => theme.market === 'KR');
  if (!us.length && !kr.length) return null;
  const row = el(doc, 'div', null, 'xr-explore xr-theme-links');
  row.append(el(doc, 'span', `${wind === 'tail' ? '순풍인' : '업종·기업마다 갈리는'} 테마`, 'xr-explore-label'));
  for (const theme of us) {
    const button = el(doc, 'button', `${usNames.get(theme.id)} →`, 'flow-next-link');
    button.type = 'button';
    button.title = '테마 상세 · 구성 종목';
    button.addEventListener('click', () => { if (typeof root?.showThemeDetail === 'function') root.showThemeDetail(theme.id); else root?.showPage?.('themes'); });
    row.append(button);
  }
  if (kr.length) {
    const names = kr.slice(0, 3).map((theme) => krThemeLabel(theme.id).split(' / ')[0]);
    const button = linkButton(doc, root, `한국 ${names.join('·')}${kr.length > 3 ? ` 외 ${kr.length - 3}개` : ''}`, 'themes', 'theme-playbook-title');
    button.title = '테마 화면의 한국 테마 단계';
    row.append(button);
  }
  return row;
}

function timeline(doc, model) {
  const strip = el(doc, 'ol', null, 'xr-timeline');
  strip.setAttribute('aria-label', '다가오는 공식 발표');
  for (const event of model.events.slice(0, 6)) {
    const item = el(doc, 'li', null, 'xr-event');
    if (model.nextEvent && event.id === model.nextEvent.id) item.dataset.next = 'true';
    item.append(el(doc, 'span', md(event.date), 'xr-event-date'), el(doc, 'span', event.name, 'xr-event-name'));
    strip.append(item);
  }
  return strip;
}

// The map is the only list of branches: each row is a <details class="xr-branch"> whose summary is the map row (keyboard
// operable, expanded state announced) and whose body is that branch's detail, opened in place.
// Expert review 2026-10-14: the branches the current state points to (lead, tied, alternative) come first and the lead
// opens on first paint; the rest sit in one fold so the page reads the current branch before the others.
function branchMap(doc, root, model, openIds, { firstPaint = false, restOpen = false } = {}) {
  const map = el(doc, 'div', null, 'xr-map');
  map.append(el(doc, 'div', '지금', 'xr-map-now'));
  const list = el(doc, 'ul', null, 'xr-map-branches');
  const current = new Set([model.leadId, model.altId, ...(model.tiedIds || [])].filter(Boolean));
  const rank = (item) => (item.id === model.leadId ? 0 : (model.tiedIds || []).includes(item.id) ? 1 : item.id === model.altId ? 2 : 3);
  const row = (item) => {
    const li = el(doc, 'li', null, 'xr-map-branch');
    li.dataset.branch = item.id;
    if (item.id === model.leadId) li.dataset.lead = 'true';
    li.append(branchCard(doc, root, item, item.id === model.leadId, openIds.has(item.id) || (firstPaint && item.id === model.leadId)));
    return li;
  };
  const ordered = current.size ? [...model.items].sort((a, b) => rank(a) - rank(b)) : model.items;
  const rest = current.size ? ordered.filter((item) => !current.has(item.id)) : [];
  for (const item of ordered.filter((item) => !rest.includes(item))) list.append(row(item));
  if (rest.length) {
    const holder = el(doc, 'li', null, 'xr-map-branch xr-map-rest-row');
    const fold = el(doc, 'details', null, 'xr-map-rest');
    fold.open = restOpen || rest.some((item) => openIds.has(item.id));
    const inner = el(doc, 'ul', null, 'xr-map-branches');
    inner.append(...rest.map(row));
    fold.append(el(doc, 'summary', `지금 조건과 덜 맞는 길 ${rest.length}개 — 펼쳐 보기`, 'xr-map-rest-summary'), inner);
    holder.append(fold);
    list.append(holder);
  }
  map.append(list);
  return map;
}

/** Open one branch's detail on 거시 (from the six-axis cards or another screen) and bring it into view. */
export function openCrossroadsBranch(doc, root, branchId) {
  const reveal = () => {
    const card = doc?.querySelector?.(`.xr-branch[data-branch="${branchId}"]`);
    if (!card) return false;
    const fold = card.closest?.('.xr-map-rest');
    if (fold) fold.open = true;
    card.open = true;
    card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    card.querySelector('summary')?.focus?.({ preventScroll: true });
    return true;
  };
  const onMacro = doc?.getElementById('page-macro')?.classList?.contains('active');
  if (onMacro !== false && reveal()) return;
  root?.showPage?.('macro');
  // The 거시 section may still be mounting after the route change: try a few times, then give up quietly.
  const retry = (delays) => { if (!delays.length) return; setTimeout(() => { if (!reveal()) retry(delays.slice(1)); }, delays[0]); };
  retry([80, 300, 900]);
}

function rateHub(doc, model) {
  const hub = el(doc, 'div', null, 'xr-hub');
  hub.append(el(doc, 'h3', '왜 금리가 중심인가', 'xr-h3'));
  if (model.rateHub.policy) hub.append(el(doc, 'p', model.rateHub.policy, 'xr-hub-now')); // v57.55 review (E2-03): policy path first
  if (model.rateHub.now) hub.append(el(doc, 'p', model.rateHub.now, 'xr-hub-now'));
  if (model.rateHub.pricingNote) hub.append(el(doc, 'p', model.rateHub.pricingNote, 'xr-hub-note'));
  hub.append(el(doc, 'p', model.rateHub.whyHigherHurts, 'xr-reading'));
  if (model.rateHub.tension) hub.append(el(doc, 'p', model.rateHub.tension, 'xr-tension'));
  hub.append(el(doc, 'h4', '금리가 내려가려면 — 무엇이 필요하고 어디서 확인하나', 'xr-h4'));
  const grid = el(doc, 'div', null, 'xr-paths');
  for (const path of model.rateHub.pathsDown) {
    const card = el(doc, 'div', null, `xr-path is-${path.stateText ? 'mixed' : path.ok == null ? 'unknown' : path.ok ? 'met' : 'unmet'}`);
    card.append(el(doc, 'span', path.label, 'xr-path-label'), el(doc, 'span', path.stateText || (path.ok == null ? '확인 불가' : path.ok ? '진행 중' : '아직 아님'), 'xr-path-state'),
      el(doc, 'p', path.evidence, 'xr-path-evidence'), el(doc, 'p', path.next ? `확인: ${path.next}` : '', 'xr-path-next'));
    grid.append(card);
  }
  hub.append(grid, el(doc, 'p', model.rateHub.caveat, 'xr-caveat'));
  return hub;
}

function branchCard(doc, root, item, lead, open = false) {
  const card = el(doc, 'details', null, 'xr-branch');
  card.dataset.branch = item.id;
  if (lead) card.dataset.lead = 'true';
  card.open = open;
  const summary = el(doc, 'summary', null, 'xr-branch-summary');
  const [name, sub] = item.title.split(' — ');
  const head = el(doc, 'span', null, 'xr-map-head');
  head.append(el(doc, 'span', name, 'xr-map-title'), meter(doc, item), el(doc, 'span', item.fit, 'xr-map-fit'));
  const tags = el(doc, 'span', null, 'xr-map-tags');
  tags.append(el(doc, 'span', TONE[item.pricing.tone] || TONE.unknown, `xr-tag is-${item.pricing.tone}`),
    el(doc, 'span', `이 길이라면 유리: ${item.favored.map((key) => CHOICES[key]).join(' · ')}`, 'xr-tag is-choice'));
  summary.append(head, ...(sub ? [el(doc, 'span', sub, 'xr-map-sub')] : []), tags, el(doc, 'span', '근거와 선택지', 'xr-map-more'));
  card.append(summary);
  const body = el(doc, 'div', null, 'xr-branch-body');
  body.append(chainRow(doc, item.chain));
  const impact = el(doc, 'dl', null, 'xr-impact');
  impact.append(el(doc, 'dt', '상대적으로 강한 쪽'), el(doc, 'dd', item.impact.firmer), el(doc, 'dt', '상대적으로 약한 쪽'), el(doc, 'dd', item.impact.weaker));
  if (item.impact.mixed) impact.append(el(doc, 'dt', '엇갈리는 쪽'), el(doc, 'dd', `${item.impact.mixed} — 업종·기업마다 이익과 부담이 갈립니다`));
  body.append(impact);
  const themeRow = themeLinkRow(doc, root, item, { max: 6 });
  if (themeRow) body.append(themeRow);
  body.append(el(doc, 'h4', '가능성의 근거 — 세 가지', 'xr-h4'));
  const evidence = el(doc, 'ul', null, 'xr-evidence');
  evidence.append(el(doc, 'li', `조건: ${item.basis.join(' · ')}`), el(doc, 'li', `시장 가격: ${item.pricing.text}`), el(doc, 'li', `과거 빈도: ${item.past.text}${item.pastBridge ? ` ${item.pastBridge}` : ''}`));
  body.append(evidence);
  if (item.triggers.length) {
    body.append(el(doc, 'h4', '이 길이 맞는지 가를 발표', 'xr-h4'));
    const triggers = el(doc, 'ul', null, 'xr-triggers');
    for (const trigger of item.triggers) triggers.append(el(doc, 'li', `${trigger.when} — ${trigger.text}`));
    body.append(triggers);
  }
  body.append(el(doc, 'h4', '이 길이라면 — 선택지와 기회비용', 'xr-h4'));
  const table = el(doc, 'div', null, 'xr-choices');
  for (const [key, text] of Object.entries(item.choices)) {
    const row = el(doc, 'div', null, 'xr-choice');
    if (item.favored.includes(key)) row.dataset.favored = 'true';
    row.append(el(doc, 'span', CHOICES[key], 'xr-choice-name'), el(doc, 'span', text, 'xr-choice-text'));
    if (item.favored.includes(key)) row.append(el(doc, 'span', '상대적으로 유리', 'xr-choice-flag'));
    table.append(row);
  }
  body.append(table, el(doc, 'p', item.favoredWhy, 'xr-reading'));
  const explore = el(doc, 'div', null, 'xr-explore');
  explore.append(el(doc, 'span', '세부 선별은 직접:', 'xr-explore-label'), ...item.explore.map((link) => { const b = linkButton(doc, root, link.label, link.route, link.route === 'themes' ? 'theme-playbook-title' : null); b.title = link.why; return b; }));
  body.append(explore);
  card.append(body);
  return card;
}

const shortDate = (iso) => md(String(iso || '').slice(0, 10));
// v57.54 review: a release is named by its own period (8월분, 9/17 결정), and the day AIO judged it comes after —
// "10/13 CPI (2026-08-01 기준)" read as if the August CPI came out on 10/13.
const periodLabel = (period) => { const text = String(period || ''); const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(text); if (!m) return text ? `(${text})` : ''; return !m[3] || m[3] === '01' ? `${Number(m[2])}월분` : `${Number(m[2])}/${Number(m[3])}`; };
/** P1743: what the automated record saw change — branch lead/alt shifts, condition flips, and scored releases. */
function changeLog(doc, state) {
  const transitions = (state?.transitions || []).slice(-6).reverse();
  const scored = (state?.eventOutcomes || []).slice(-6).reverse();
  if (!transitions.length && !scored.length) return null;
  const box = el(doc, 'div', null, 'xr-changes');
  box.append(el(doc, 'h3', '자동 기록 — 무엇이 바뀌었나', 'xr-h3'));
  if (scored.length) {
    box.append(el(doc, 'h4', '지난 발표 판정', 'xr-h4'));
    const list = el(doc, 'ul', null, 'xr-scored');
    for (const row of scored) list.append(el(doc, 'li', `${row.name} ${periodLabel(row.period)}: ${row.actualText} → ${row.matched.length ? `${row.matched.map((m) => `'${m.title}'`).join(' · ')} 길의 기준 충족` : '어느 길의 기준에도 해당하지 않음'} (판정 ${shortDate(row.at)})`));
    box.append(list);
  }
  if (transitions.length) {
    box.append(el(doc, 'h4', '최근 변화', 'xr-h4'));
    const list = el(doc, 'ul', null, 'xr-transitions');
    for (const row of transitions) list.append(el(doc, 'li', `${shortDate(row.at)} ${row.text}`));
    box.append(list);
  }
  box.append(el(doc, 'p', `데이터 갱신마다 자동으로 다시 계산해 기록합니다${state?.generatedAt ? ` · 마지막 계산 ${shortDate(state.generatedAt)}` : ''}.`, 'xr-caveat'));
  return box;
}

/** Full section on 거시. */
export function renderMacroCrossroads({ documentRef: doc, root, regime = null, host = null } = {}) {
  let target = host || doc?.getElementById('macro-crossroads');
  // The section is created here (the shell stays unchanged): first on 거시, before the current-regime section.
  const before = !target ? doc?.getElementById('macro-regime')?.closest('section') : null;
  if (before) {
    const section = el(doc, 'section', null, 'briefing-block macro-section xr-section');
    section.setAttribute('aria-labelledby', 'macro-crossroads-title');
    const title = el(doc, 'h2', '앞으로의 갈림길 — 다음 발표가 가를 길', 'briefing-h2');
    title.id = 'macro-crossroads-title';
    target = el(doc, 'div');
    target.id = 'macro-crossroads';
    section.append(title, target);
    before.insertAdjacentElement('beforebegin', section);
  }
  if (!target) return null;
  const model = crossroadsForRoot(root, { regime });
  root.__aioMacroCrossroads = model;
  if (!target.dataset.aioScenarioLoad) { target.dataset.aioScenarioLoad = 'on'; refreshScenarioArtifacts(root, () => renderMacroCrossroads({ documentRef: doc, root, regime, host: target })); }
  const openIds = new Set([...target.querySelectorAll('.xr-branch[open]')].map((node) => node.dataset.branch));
  const firstPaint = !target.querySelector('.xr-branch');
  const restOpen = !!target.querySelector('.xr-map-rest[open]');
  const focused = target.contains?.(doc.activeElement) ? doc.activeElement?.closest?.('.xr-branch')?.dataset.branch : null;
  if (!model.available) { target.replaceChildren(el(doc, 'p', model.headline, 'xr-lead')); return model; }
  const basis = el(doc, 'p', `${model.asOf || '기준일 미확인'} 관측 기준 · 예측이 아니라, 다음 발표가 어느 길로 갈지 가를 때 무엇을 보고 어떻게 대응할지의 지도입니다. 가능성은 조건 부합 수 · 시장 가격 방향 · 과거 빈도로만 말하고 확률 숫자는 쓰지 않습니다.`, 'xr-basis');
  // The rate hub (why rates lead, the proxy caveat once) comes first; the map below opens each branch in place.
  const mapHead = el(doc, 'h3', `${model.items.length}갈래의 길 — 눌러서 근거와 선택지 보기`, 'xr-h3');
  target.replaceChildren(el(doc, 'p', model.headline, 'xr-lead'), basis, timeline(doc, model), rateHub(doc, model), mapHead, branchMap(doc, root, model, openIds, { firstPaint, restOpen }), ...[changeLog(doc, root?.[SCENARIO_STATE.key])].filter(Boolean),
    el(doc, 'p', '세부 종목 선택은 차트·기업·테마·스크리너에서 직접 합니다. 이 지도는 가격·수량·시점을 제시하지 않습니다.', 'xr-caveat'));
  target.dataset.aioCrossroads = 'native';
  if (focused) target.querySelector(`.xr-branch[data-branch="${focused}"] > summary`)?.focus?.({ preventScroll: true }); // a repaint keeps keyboard focus
  return model;
}

// P1743: the theme side of the same picture, from the per-refresh state (every theme read by one rule).
function themeLines(doc, root) {
  const state = root?.[SCENARIO_STATE.key];
  const themes = state?.themes || [];
  if (!themes.length) return [];
  const byKey = new Map(themes.map((row) => [`${row.market}:${row.id}`, row]));
  const pullbacks = (state.highlights?.structuralPullbacks || []).map((key) => byKey.get(key)).filter(Boolean).slice(0, 4);
  const lines = [];
  if (state.rotation?.text) lines.push(el(doc, 'p', `테마: ${state.rotation.text}`, 'xr-reading'));
  const ret1m = (value) => (Number.isFinite(value) ? `1개월 ${value >= 0 ? '+' : ''}${value.toFixed(1)}%` : '1개월 —');
  if (pullbacks.length) lines.push(el(doc, 'p', `긴 추세 속 조정이면서 거시 역풍이 아닌 테마: ${pullbacks.map((row) => `${row.market === 'KR' ? '한국' : '미국'} ${row.label}(${ret1m(row.ret1m)})`).join(', ')} — 나눠 접근하는 쪽의 기회비용이 상대적으로 작은 조합입니다(구조 가설이 깨지면 중단).`, 'xr-reading'));
  return lines;
}

// One branch as a card: name, condition fit and market-price direction, what fares relatively better, the structure the
// path leads to and the themes it touches (US first, Korean themes as one link).
function pathCard(doc, root, item, { kicker, fit }) {
  const card = el(doc, 'div', null, 'xr-path-card');
  const tone = item.pricing.tone === 'same' ? '시장 가격도 이 방향' : item.pricing.tone === 'against' ? '시장 가격은 반대 방향' : '시장 가격 보류';
  const head = el(doc, 'div', null, 'xr-path-head');
  head.append(el(doc, 'span', kicker, 'xr-path-kicker'), el(doc, 'strong', `'${item.title.split(' — ')[0]}'`, 'xr-path-name'));
  const tags = el(doc, 'div', null, 'xr-path-tags');
  if (fit) tags.append(el(doc, 'span', fit, 'basis-chip'));
  tags.append(el(doc, 'span', tone, `basis-chip xr-price is-${item.pricing.tone || 'none'}`));
  const rows = el(doc, 'dl', null, 'xr-path-rows');
  // v57.55 review (E1-13/E2-16): the owner-approved "상대적으로 유리한 쪽" (2026-10-13); its scope note is written once under the cards.
  const favoredRow = el(doc, 'dd', item.favored.map((key) => CHOICES[key]).join(' · '));
  favoredRow.title = item.favoredWhy || '';
  rows.append(el(doc, 'dt', '이 길이라면 상대적으로 유리한 쪽'), favoredRow);
  if (item.shape && SHAPES[item.shape]) rows.append(el(doc, 'dt', '이어지는 구조'), el(doc, 'dd', `'${SHAPES[item.shape]}'`));
  card.append(head, tags, rows);
  const themes = themeLinkRow(doc, root, item);
  if (themes) card.append(themes);
  card.title = item.favoredWhy || '';
  return card;
}

/** Compact block on 오늘 and 시장 상태: one forward view — the present structure (when given), the branch the next
 * releases would most likely confirm and the structure it leads to, its chain and favoured choice, the alternative,
 * the rate tension and the theme side — then links to 거시 and 테마. */
export function renderCrossroadsCompact({ documentRef: doc, root, regime = null, anchor = null, id = 'home-crossroads', structure = null, title = '앞으로의 갈림길' } = {}) {
  if (!doc || !anchor) return null;
  const model = crossroadsForRoot(root, { regime });
  let box = doc.getElementById(id);
  if (!box) { box = el(doc, 'div', null, 'xr-compact'); box.id = id; anchor.insertAdjacentElement('afterend', box); }
  if (!box.dataset.aioScenarioLoad) { box.dataset.aioScenarioLoad = 'on'; refreshScenarioArtifacts(root, () => renderCrossroadsCompact({ documentRef: doc, root, regime, anchor, id, structure, title })); }
  const lead = model.items?.find((item) => item.id === model.leadId);
  box.hidden = (!model.available || !lead) && !structure;
  if (box.hidden) return model;
  const alt = model.items.find((item) => item.id === model.altId) || null;
  const short = (item) => item.title.split(' — ')[0];
  const links = el(doc, 'div', null, 'xr-explore');
  links.append(linkButton(doc, root, '모든 갈림길과 선택지', 'macro', 'macro-crossroads-title'));
  if (root?.[SCENARIO_STATE.key]?.themes?.length) links.append(linkButton(doc, root, '모든 테마의 단계', 'themes', 'theme-playbook-title'));
  const parts = [el(doc, 'h3', title, 'xr-h3')];
  if (structure) parts.push(...structure);
  // v57.54 audit (8): the same tie rule as 거시 (tiedIds, P1747) — a tie names both paths up front and says why one is
  // written first. v57.54 (owner review 2026-10-14, "조금만 압축하고 정렬"): one lead line, the lead path's chain,
  // then the two paths side by side as cards (market-price direction, what fares better, the structure it leads to,
  // its themes) instead of three run-on sentences.
  const tied = lead && alt && model.tiedIds?.includes(lead.id) && model.tiedIds.includes(alt.id);
  if (lead) {
    const sameFit = tied && lead.met === alt.met && lead.total === alt.total;
    const event = model.nextEvent ? `${md(model.nextEvent.date)} ${model.nextEvent.name}` : '';
    const leadLine = tied
      ? `${event ? `${event} 발표가` : '다음 발표가'} 가를 두 길 — 조건 부합이 같습니다${sameFit ? `(${lead.met}/${lead.total})` : ''}.${lead.pricing.tone === 'same' && alt.pricing.tone !== 'same' ? ` 시장 가격이 같은 방향인 '${short(lead)}'${josa(short(lead), '을', '를')} 먼저 둡니다.` : ''}`
      : `다음 발표가 가를 길${event ? ` · ${event}` : ''} — 지금은 '${short(lead)}' 쪽 조건이 더 맞습니다.`;
    parts.push(el(doc, 'p', leadLine, 'xr-lead'), chainRow(doc, lead.chain));
    const cards = el(doc, 'div', null, 'xr-path-cards');
    // Expert review 2026-10-14: a tie is not a ranking — the first card says why it is first, or both read '함께 볼 길'.
    const pricedFirst = tied && lead.pricing.tone === 'same' && alt.pricing.tone !== 'same';
    cards.append(pathCard(doc, root, lead, { kicker: !tied ? '조건이 더 맞는 길' : pricedFirst ? '시장 가격도 같은 방향인 길' : '함께 볼 길', fit: sameFit ? null : lead.fit }));
    if (alt) cards.append(pathCard(doc, root, alt, { kicker: '함께 볼 길', fit: sameFit ? null : alt.fit }));
    parts.push(cards, el(doc, 'p', "'상대적으로 유리한 쪽'은 그 길이 실제로 이어질 때의 비용 비교이며, 따라 하라는 뜻은 아닙니다.", 'xr-scope-note'));
    if (model.rateHub.tension) parts.push(el(doc, 'p', model.rateHub.tension, 'xr-tension'));
  } else parts.push(el(doc, 'p', model.headline, 'xr-reading'));
  parts.push(...themeLines(doc, root), links);
  box.replaceChildren(...parts);
  box.dataset.aioCrossroads = 'compact';
  return model;
}
