// P1742 (owner 2026-10-13): "향후 시나리오" — the forward branches on 거시 (full) and 오늘 (compact); v57.76: 시장 상태
// links to 거시 instead of repeating them.
// One visual (the upcoming releases and the branch map with each branch's met-condition dots), a short reading
// (why rates matter and what would have to happen for them to fall), then per-branch detail folded inside each map
// row (one list, not the map plus a second accordion of the same branches): the
// cause→effect chain, the dated triggers, the three likelihood lines and the reader's choices with their
// opportunity cost. Reads only published artifacts already loaded for the 거시 and 시장 상태 screens.
import { CHOICES, EVENT_NAMES, fomcDecisionDate, macroTransitions } from '../../domain/market/macro-crossroads.js';
import { scenarioLead } from '../../domain/market/scenario-lead.js';
import { CHOICE_WORDS } from '../../domain/content/choice-words.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { frameHead, markFrame, noteFold, setAsOf } from './section-frame.js';
import { refreshSharedArtifact, SCENARIO_OUTCOMES, SCENARIO_STATE, BIGTECH_CASHFLOW, TREASURY_AUCTIONS } from '../../data/shared-artifacts.js';
import { auctionLine, latestByTenor, AUCTION_METHOD } from '../../domain/macro/treasury-auctions.js';
import { groupCashflowSentence } from '../../domain/fundamental/quarterly-cashflow.js';
import { themesForBranch } from '../../domain/scenarios/exposures.js';
import { krThemeLabel } from '../../domain/themes/kr-themes.js';
import { el } from './dom.js';
import { withDirectionParticle } from '../../domain/content/korean-particle.js';
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
// Korean particles follow the last Hangul syllable of a quoted path name (quotes are skipped).
const batchim = (text) => { const syllables = String(text || '').match(/[가-힣]/g); return syllables ? (syllables.at(-1).charCodeAt(0) - 0xac00) % 28 !== 0 : false; };
const josa = (text, withFinal, withoutFinal) => (batchim(text) ? withFinal : withoutFinal);
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
  for (const spec of [SCENARIO_OUTCOMES, SCENARIO_STATE, BIGTECH_CASHFLOW, TREASURY_AUCTIONS]) {
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
function themeLinkRow(doc, root, item, { max = 4 } = {}) {
  if (!item) return null;
  const { wind, themes } = themesForBranch(item);
  const usNames = new Map((Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []).map((theme) => [theme.id, theme.nameKr || theme.name || theme.id]));
  const us = themes.filter((theme) => theme.market === 'US' && usNames.has(theme.id)).slice(0, max);
  const kr = themes.filter((theme) => theme.market === 'KR');
  if (!us.length && !kr.length) return null;
  const row = el(doc, 'div', null, 'xr-explore xr-theme-links');
  // v57.71 (owner 2026-10-15): "순풍인 테마 반도체" on a -4% chip day read as a call on today's move. The row lists the
  // themes this path's exposure tags favour, so it is named as that condition.
  // v57.86 (live review): the home card listed 방산/항공우주 as 수혜 while the theme line below called it weak (-7.7%) — the label
  // says the list is the path's exposure, not the themes' current strength.
  row.append(el(doc, 'span', wind === 'tail' ? '이 시나리오의 수혜 테마(현재 강약과 별개)' : '영향이 갈리는 테마', 'xr-explore-label'));
  for (const theme of us) {
    const button = el(doc, 'button', `${usNames.get(theme.id)} →`, 'flow-next-link');
    button.type = 'button';
    button.title = '테마 상세, 구성 종목';
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
    item.append(el(doc, 'span', (event.when || md(event.date)).replace(/ \d{2}:\d{2} KST$/, ' KST'), 'xr-event-date'), el(doc, 'span', event.name, 'xr-event-name'));
    strip.append(item);
  }
  return strip;
}

// The map is the only list of branches: each row is a <details class="xr-branch"> whose summary is the map row (keyboard
// operable, expanded state announced) and whose body is that branch's detail, opened in place.
// Expert review 2026-10-14: the branches the current state points to (lead, tied, alternative) come first; the rest sit
// in one fold so the page reads the current branch before the others. v59.51 (content audit): every branch row starts
// closed — the row itself (name, met-condition dots, price direction, smaller cost) is the face; only a row the reader
// opened stays open across repaints.
function branchMap(doc, root, model, openIds, { restOpen = false } = {}) {
  const map = el(doc, 'div', null, 'xr-map');
  map.append(el(doc, 'div', '지금', 'xr-map-now'));
  const list = el(doc, 'ul', null, 'xr-map-branches');
  // v59.51 (area H): the marked rows are scenarioLead's ids — one lead, or every tied branch (each marked, none 중심).
  const lead = scenarioLead(model);
  const leadIds = new Set(lead.ids);
  const current = new Set([...lead.ids, model.altId].filter(Boolean));
  const rank = (item) => (leadIds.has(item.id) ? 0 : item.id === model.altId ? 2 : 3);
  const row = (item) => {
    const li = el(doc, 'li', null, 'xr-map-branch');
    li.dataset.branch = item.id;
    // Every marked row carries the same mark; a tie also says so (data-tied), so no single row reads as the one 중심.
    if (leadIds.has(item.id)) { li.dataset.lead = 'true'; if (lead.state === 'tie') li.dataset.tied = 'true'; }
    li.append(branchCard(doc, root, item, leadIds.has(item.id), openIds.has(item.id)));
    return li;
  };
  // v57.79: within the same rank the branches run by share of conditions met, so the heading's "조건 충족 순" holds.
  // v57.81 (audit X2): a branch whose core condition is met comes before one that only matches side conditions.
  const fit = (item) => (item.known >= 2 && item.total ? item.met / item.total + (item.gate?.met === true ? 1 : 0) : -1);
  const ordered = [...model.items].sort((a, b) => (current.size ? rank(a) - rank(b) : 0) || fit(b) - fit(a));
  const rest = current.size ? ordered.filter((item) => !current.has(item.id)) : [];
  for (const item of ordered.filter((item) => !rest.includes(item))) list.append(row(item));
  if (rest.length) {
    const holder = el(doc, 'li', null, 'xr-map-branch xr-map-rest-row');
    const fold = el(doc, 'details', null, 'xr-map-rest');
    fold.open = restOpen || rest.some((item) => openIds.has(item.id));
    const inner = el(doc, 'ul', null, 'xr-map-branches');
    inner.append(...rest.map(row));
    fold.append(el(doc, 'summary', `나머지 시나리오 ${rest.length}개 보기`, 'xr-map-rest-summary'), inner);
    holder.append(fold);
    list.append(holder);
  }
  map.append(list);
  return map;
}

// v59.68: the scenario map lives in 시장 상태's scenario fold; opening it shows the page and unfolds it.
function openScenarioFold(doc) {
  const fold = doc?.getElementById?.('regime-depth-fold');
  if (fold) fold.open = true;
}

/** Open 시장 상태 at the scenario map. The blocks above can still grow after the route change, so the scroll repeats. */
export function showCrossroadsSection(doc, root) {
  root?.showPage?.('signal');
  for (const delay of [80, 400, 1200]) setTimeout(() => { openScenarioFold(doc); doc?.getElementById?.('macro-crossroads')?.scrollIntoView?.({ block: 'start' }); }, delay);
}

/** Open one branch's detail on 시장 상태 (from the 매크로 factor cards or another screen) and bring it into view. */
export function openCrossroadsBranch(doc, root, branchId) {
  const reveal = () => {
    const card = doc?.querySelector?.(`.xr-branch[data-branch="${branchId}"]`);
    if (!card) return false;
    openScenarioFold(doc);
    const fold = card.closest?.('.xr-map-rest');
    if (fold) fold.open = true;
    card.open = true;
    card.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    card.querySelector('summary')?.focus?.({ preventScroll: true });
    return true;
  };
  const onSignal = doc?.getElementById('page-signal')?.classList?.contains('active');
  if (onSignal !== false && reveal()) return;
  root?.showPage?.('signal');
  // The scenario map may still be mounting after the route change: try a few times, then give up quietly.
  const retry = (delays) => { if (!delays.length) return; setTimeout(() => { if (!reveal()) retry(delays.slice(1)); }, delays[0]); };
  retry([80, 300, 900]);
}

// v59.57 (X bookmarks 11/02, MrMarket89 10/27): who is buying the new supply. The latest note and bond auction of each tenor
// against its own previous six, one line on the face and the per-tenor rows one fold down; a reference, never a condition.
const AUCTIONS_MAX_AGE_MS = 21 * 86400000;
function auctionBlock(doc, root) {
  const payload = root?.[TREASURY_AUCTIONS.key];
  const age = Date.now() - Date.parse(payload?.latestAuction || '');
  if (!payload?.summary || !(age >= 0 && age <= AUCTIONS_MAX_AGE_MS)) return null;
  const box = el(doc, 'div', null, 'xr-auctions');
  box.append(el(doc, 'p', `국채 입찰: ${payload.summary}`, 'xr-hub-now'));
  const fold = el(doc, 'details', null, 'xr-auctions-fold sx-disclosure');
  fold.append(el(doc, 'summary', '만기별 최근 입찰 결과와 읽는 법'));
  const list = el(doc, 'ul', null, 'xr-evidence');
  for (const row of latestByTenor(payload.rows || [])) list.append(el(doc, 'li', auctionLine(row)));
  fold.append(list, el(doc, 'p', AUCTION_METHOD, 'xr-path-evidence'));
  box.append(fold);
  return box;
}

function rateHub(doc, model, pathsOpen = false, root = null) {
  const hub = el(doc, 'div', null, 'xr-hub');
  hub.append(el(doc, 'h3', '왜 금리가 중심인가', 'xr-h3'));
  if (model.rateHub.policy) hub.append(el(doc, 'p', model.rateHub.policy, 'xr-hub-now')); // v57.55 review (E2-03): policy path first
  if (model.rateHub.now) hub.append(el(doc, 'p', model.rateHub.now, 'xr-hub-now'));
  const auctions = auctionBlock(doc, root);
  if (auctions) hub.append(auctions);
  // v59.51 (two layers): the face keeps today's numbers and the tension line; how higher rates reach stocks (the textbook
  // channels) and the proxy caveat are the expert layer, one fold down.
  const why = [model.rateHub.whyHigherHurts, model.rateHub.pricingNote].filter(Boolean).join(' ');
  if (why) hub.append(noteFold(doc, why, '금리가 주가에 닿는 경로와 이 수치의 한계'));
  if (model.rateHub.tension) hub.append(el(doc, 'p', model.rateHub.tension, 'xr-tension'));
  // v59.51 (content audit): the three conditions for lower rates are the expert layer — one closed line on the face, the
  // state, evidence and next release of each inside.
  const paths = el(doc, 'details', null, 'xr-paths-fold sx-disclosure');
  paths.open = pathsOpen;
  const moving = model.rateHub.pathsDown.filter((path) => path.ok === true).length;
  paths.append(el(doc, 'summary', `금리가 내려가려면 — ${moving ? `조건 ${model.rateHub.pathsDown.length}가지 중 ${moving}가지 진행 중` : `조건 ${model.rateHub.pathsDown.length}가지, 아직 진행 중인 것 없음`}`, 'xr-h4'));
  const grid = el(doc, 'div', null, 'xr-paths');
  for (const path of model.rateHub.pathsDown) {
    const card = el(doc, 'div', null, `xr-path is-${path.stateText ? 'mixed' : path.ok == null ? 'unknown' : path.ok ? 'met' : 'unmet'}`);
    card.append(el(doc, 'span', path.label, 'xr-path-label'), el(doc, 'span', path.stateText || (path.ok == null ? '확인 불가' : path.ok ? '진행 중' : '아직 아님'), 'xr-path-state'),
      el(doc, 'p', path.evidence, 'xr-path-evidence'), el(doc, 'p', path.next ? `확인: ${path.next}` : '', 'xr-path-next'));
    grid.append(card);
  }
  paths.append(grid);
  hub.append(paths, noteFold(doc, model.rateHub.caveat, '금리 하락이 늘 좋은가')); // v58.79
  return hub;
}

const CASHFLOW_MAX_AGE_MS = 10 * 86400000;
function bigtechCashflowText(root) {
  const payload = root?.[BIGTECH_CASHFLOW.key];
  const age = Date.now() - Date.parse(payload?.generatedAt || '');
  const sentence = age >= 0 && age <= CASHFLOW_MAX_AGE_MS ? groupCashflowSentence(payload?.hyperscalers) : '';
  return sentence ? `투자 자금 여력(SEC 분기 공시 기준, 조건에 넣지 않는 참고값): ${sentence}` : '';
}

function branchCard(doc, root, item, lead, open = false) {
  const card = el(doc, 'details', null, 'xr-branch');
  card.dataset.branch = item.id;
  if (lead) card.dataset.lead = 'true';
  card.open = open;
  const summary = el(doc, 'summary', null, 'xr-branch-summary');
  const [name, sub] = item.title.split(' — ');
  const head = el(doc, 'span', null, 'xr-map-head');
  head.append(el(doc, 'span', name, 'xr-map-title'), meter(doc, item), el(doc, 'span', item.status || item.fit, 'xr-map-fit'));
  const tags = el(doc, 'span', null, 'xr-map-tags');
  tags.append(el(doc, 'span', TONE[item.pricing.tone] || TONE.unknown, `xr-tag is-${item.pricing.tone}`),
    el(doc, 'span', `${CHOICE_WORDS.favored}: ${item.favored.map((key) => CHOICES[key]).join(', ')}`, 'xr-tag is-choice'));
  // v57.84 (owner 2026-10-16): favored stays; a conflict with the past frequency is named beside it.
  if (item.pastConflict) tags.append(pastConflictTag(doc, item));
  summary.append(head, ...(sub ? [el(doc, 'span', sub, 'xr-map-sub')] : []), tags, el(doc, 'span', '근거와 선택지', 'xr-map-more'));
  card.append(summary);
  const body = el(doc, 'div', null, 'xr-branch-body');
  body.append(chainRow(doc, item.chain));
  const impact = el(doc, 'dl', null, 'xr-impact');
  impact.append(el(doc, 'dt', '강해지는 곳'), el(doc, 'dd', item.impact.firmer), el(doc, 'dt', '약해지는 곳'), el(doc, 'dd', item.impact.weaker));
  if (item.impact.mixed) impact.append(el(doc, 'dt', '엇갈리는 쪽'), el(doc, 'dd', `${item.impact.mixed} — 업종·기업마다 이익과 부담이 갈립니다`));
  body.append(impact);
  const themeRow = themeLinkRow(doc, root, item, { max: 6 });
  if (themeRow) body.append(themeRow);
  body.append(el(doc, 'h4', '판단 근거', 'xr-h4'));
  const evidence = el(doc, 'ul', null, 'xr-evidence');
  // v58.74 (text audit): the conditions carry commas and '또는' themselves; joined into one sentence they read as five lines.
  const conditionItem = el(doc, 'li', `조건 ${item.met}/${item.total}`);
  const conditionList = el(doc, 'ul', null, 'xr-conditions');
  for (const text of item.basis) conditionList.append(el(doc, 'li', text));
  conditionItem.append(conditionList);
  evidence.append(conditionItem, el(doc, 'li', `시장 가격: ${item.pricing.text}`), el(doc, 'li', `과거 빈도: ${item.past.text}${item.pastBridge ? ` ${item.pastBridge}` : ''}`));
  // v59.56 (X bookmarks 11/01): the AI-capex funding gauge the authors read, from SEC quarterly filings — reference, not a condition.
  const cashflow = item.id === 'aibust' ? bigtechCashflowText(root) : '';
  if (cashflow) evidence.append(el(doc, 'li', cashflow));
  body.append(evidence);
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
  body.append(table, el(doc, 'p', item.favoredWhy, 'xr-reading'));
  const explore = el(doc, 'div', null, 'xr-explore');
  explore.append(el(doc, 'span', '종목은 직접 보기:', 'xr-explore-label'), ...item.explore.map((link) => { const b = linkButton(doc, root, link.label, link.route, link.route === 'themes' ? 'theme-playbook-title' : null); b.title = link.why; return b; }));
  body.append(explore);
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
  const box = el(doc, 'details', null, 'xr-changes sx-disclosure');
  box.open = open;
  box.append(el(doc, 'summary', `지난 판정과 바뀐 점 (발표 판정 ${scored.length}건, 변화 ${transitions.length}건)`, 'xr-h3'));
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
  box.title = `데이터 갱신마다 자동으로 다시 계산해 기록합니다${computedAt ? `(마지막 계산 ${shortDate(computedAt)})` : ''}`;
  return box;
}

/** Full section on 거시. */
export function renderMacroCrossroads({ documentRef: doc, root, regime = null, host = null } = {}) {
  let target = host || doc?.getElementById('macro-crossroads');
  // The section is created here (the shell stays unchanged). v57.76: 거시 reads current state first — 지금의 거시 국면 →
  // 거시 6요인 → 어떻게 연결되나 — and the scenarios follow the chain, before 경제 지표 and 유가·금.
  const after = !target ? doc?.getElementById('macro-chain')?.closest('section') : null;
  if (after) {
    const section = el(doc, 'section', null, 'briefing-block macro-section xr-section');
    section.setAttribute('aria-labelledby', 'macro-crossroads-title');
    // v58.79 section frame: title + observation-date chip (the method sentence is the chip's hover).
    const title = frameHead(doc, { title: '향후 시나리오 — 다음 발표로 확인', titleId: 'macro-crossroads-title', titleClass: 'briefing-h2' });
    markFrame(section, 'macro.crossroads');
    target = el(doc, 'div');
    target.id = 'macro-crossroads';
    // v57.76: one bridge line ties the branches to the chain right above.
    section.append(title, target);
    after.insertAdjacentElement('afterend', section);
  }
  if (!target) return null;
  const model = crossroadsForRoot(root, { regime });
  root.__aioMacroCrossroads = model;
  if (!target.dataset.aioScenarioLoad) { target.dataset.aioScenarioLoad = 'on'; refreshScenarioArtifacts(root, () => renderMacroCrossroads({ documentRef: doc, root, regime, host: target })); }
  const openIds = new Set([...target.querySelectorAll('.xr-branch[open]')].map((node) => node.dataset.branch));
  const restOpen = !!target.querySelector('.xr-map-rest[open]');
  const focused = target.contains?.(doc.activeElement) ? doc.activeElement?.closest?.('.xr-branch')?.dataset.branch : null;
  const pathsOpen = !!target.querySelector('details.xr-paths-fold')?.open;
  const changesOpen = !!target.querySelector('details.xr-changes')?.open;
  if (!model.available) { target.replaceChildren(el(doc, 'p', model.headline, 'xr-lead')); return model; }
  setAsOf(doc, target.parentElement?.querySelector(':scope > .aio-frame-head'), model.asOf ? `${shortDate(model.asOf)} 관측` : '기준일 미확인',
    '갈래마다 조건 충족 수, 시장 가격 방향, 과거 빈도를 나란히 놓고 다음 발표에서 무엇이 갈래를 가르는지 적었습니다. 과거 빈도는 시나리오 조건이 아니라 비슷한 시장 움직임으로 고른 비교입니다.');
  // The rate hub (why rates lead, the proxy caveat once) comes first; the map below opens each branch in place.
  // v57.79 (UI review): the heading says what the list is (ordered by conditions met), not how to use it.
  const mapHead = el(doc, 'h3', `시나리오 ${model.items.length}개 — 조건 충족 순`, 'xr-h3');
  // v58.79: the closing "세부 종목 선택은 …" caption left; the screen names no price, size or timing by construction (R724).
  target.replaceChildren(el(doc, 'p', model.headline, 'xr-lead'), timeline(doc, model), rateHub(doc, model, pathsOpen, root), mapHead, branchMap(doc, root, model, openIds, { restOpen }), ...[changeLog(doc, root?.[SCENARIO_STATE.key], changesOpen, root?._aioArtifactFreshness?.('scenario-state.json')?.checkedAt)].filter(Boolean));
  target.dataset.aioCrossroads = 'native';
  if (focused) target.querySelector(`.xr-branch[data-branch="${focused}"] > summary`)?.focus?.({ preventScroll: true }); // a repaint keeps keyboard focus
  return model;
}


