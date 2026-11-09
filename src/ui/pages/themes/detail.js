// Theme screens: one theme in detail — criteria, teach, summary, composition, members, leaders and the day insights.
import { signedBar } from '../../components/signed-bar.js';
import { selectSelectedThemeDetail, selectThemesItems } from '../../../state/selectors/themes.js';
import { renderThemeDetailPlaybook, themeTeachFor, scenarioSplitText } from '../../components/theme-playbook-view.js';
import { themePlaybookForRoot } from '../../components/theme-playbook.js';
import { MEMBER_ROLES, macroMoves, revisionCounts, themeReasons } from '../../../domain/scenarios/theme-criteria.js';
import { THEME_STATES } from '../../../domain/scenarios/analogs.js';
import { headlineForCompany, sessionNewsWindow } from '../../../domain/briefing/news-picks.js';
import { selectNewsItems } from '../../../state/selectors/news.js';
import { themeDetailFlow } from '../../../domain/market/page-flow.js';
import { buildGroupStrength, directionLabel } from '../../../domain/themes/group-strength.js';
import { buildCloseSeries } from '../../../domain/market/close-series.js';
import { selectProducedRotation } from '../../../domain/themes/produced-rotation.js';
import { RRG_QUADRANT_WORDS } from '../../../domain/themes/rrg.js';
import { benchmarkReturns, basisOf } from '../../components/theme-strength.js';
import { renderNextSteps } from '../../components/page-flow.js';
import { signedText, directionOf, finiteNumber as finite } from '../../../domain/shared/number.js';
import { withTopicParticle } from '../../../domain/content/korean-particle.js';
import { refreshSharedArtifact } from '../../../data/shared-artifacts.js';
import { readRowNumber } from '../../../data/contracts/screener.js';
import { requestConsensusEstimates, CONSENSUS_KEY } from '../../../data/consensus-estimates.js';
import { isoDay, stampDay, latestSessionRows } from '../../../domain/shared/session-date.js';
import { askRow } from '../../components/ask-row.js';
import { dirColor, finiteOrNull, screenerRowMap } from './shared.js';
import { shortSession, usCloseSession } from './rrg.js';
import { EARNINGS_CALENDAR } from '../../../data/artifact-registry.js';

// v58.75 (persona review): the theme's representative ETF against SPY over the produced 100 sessions (rotationHistory
// relativeStrength, rebased to 100 on the first session) — the line an RRG point summarises. No ETF, no chart.
export const stageWord = (state) => String(THEME_STATES[state] || '').split(' (')[0];
export const pctText = (value) => (finiteOrNull(value) == null ? '—' : `${signedText(value, 1)}%`);

// v58.75 (persona review, teach-and-check A-3): the ETF's sector-rotation quadrant ten sessions ago (the produced trail)
// against now — a move the trail records, not a forecast.
export const RRG_MOVE_SESSIONS = 10;
export function rrgMoveOf(root, themeId) {
  const etf = (root?.THEME_MAP || []).find((theme) => theme?.id === themeId)?.etf || null;
  const item = etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, etf, Date.now()) : null;
  if (!item || finiteOrNull(item.rsRatio) == null || finiteOrNull(item.rsMomentum) == null) return null;
  const points = (Array.isArray(item.trail) ? item.trail : []).filter((point) => finiteOrNull(point?.rsRatio) != null && finiteOrNull(point?.rsMomentum) != null && (!item.sessionDate || String(point.sessionDate) < String(item.sessionDate)));
  const past = points[points.length - RRG_MOVE_SESSIONS];
  if (!past) return null;
  const quadrant = (ratio, momentum) => (ratio >= 100 ? (momentum >= 100 ? 'Leading' : 'Weakening') : momentum >= 100 ? 'Improving' : 'Lagging');
  const from = quadrant(past.rsRatio, past.rsMomentum), to = quadrant(item.rsRatio, item.rsMomentum);
  return { etf, from, to, fromWord: RRG_QUADRANT_WORDS[from], toWord: RRG_QUADRANT_WORDS[to], sessions: RRG_MOVE_SESSIONS };
}

// Same-session headlines that name a member which moved 2% or more (news-picks.js matcher: ticker or the company's own name).
export function themeHeadlines(root, store, members, session) {
  const span = session ? sessionNewsWindow(session) : null;
  if (!span) return [];
  const timeline = root?._serverMarketTimeline || {};
  const news = [...selectNewsItems(store?.getState?.() || {}), ...(Array.isArray(root?._serverNewsIntraday) ? root._serverNewsIntraday : []),
    ...(timeline.current?.headlines || []), ...(Array.isArray(timeline.slots) ? timeline.slots : []).flatMap((slot) => slot?.headlines || [])];
  const telegram = Array.isArray(root?.AIO_TELEGRAM_CURRENT_ITEMS) ? root.AIO_TELEGRAM_CURRENT_ITEMS : [];
  if (!news.length && !telegram.length) return [];
  const movers = members.filter((member) => Math.abs(finiteOrNull(member.row?.ret1d) ?? 0) >= 2 && String(member.row?.factorSessionDate || '').slice(0, 10) === session)
    .sort((a, b) => Math.abs(b.row.ret1d) - Math.abs(a.row.ret1d)).slice(0, 4);
  const out = [];
  for (const member of movers) {
    const hit = headlineForCompany({ symbol: member.sym, name: member.row?.name || '' }, { news, telegram, signals: root?.AIO_TELEGRAM_SIGNALS || [], span });
    const title = hit ? String(hit.kind === 'telegram' ? hit.text : hit.row?.titleKo || hit.row?.ko_title || hit.row?.title || '').trim() : '';
    if (title) out.push({ sym: member.sym, ret1d: member.row.ret1d, title: title.length > 90 ? `${title.slice(0, 87)}…` : title });
    if (out.length >= 2) break;
  }
  return out;
}

/** The AI-readable summary of one theme: { headline, items: [{ label, met, value, principle }], reasons, roles, scenarios }. */
export function themeCriteriaSummary(root, store, themeId) {
  const raw = String(themeId || '').trim();
  if (!raw) return null;
  const [marketPart, idPart] = raw.includes(':') ? raw.split(':') : [null, raw];
  const playbook = root?.__aioThemePlaybook?.available ? root.__aioThemePlaybook : themePlaybookForRoot(root, store).playbook;
  const themes = playbook?.themes || [];
  const row = themes.find((item) => (!marketPart || item.market === marketPart.toUpperCase()) && (item.id === idPart || item.label === idPart))
    || themes.find((item) => item.label?.includes(idPart));
  if (!row) return null;
  const teach = themeTeachFor({ root, store, market: row.market, themeId: row.id, playbook });
  if (!teach?.criteria) return null;
  const reasons = themeReasons({ row, tags: row.tags || [], moves: macroMoves(root?._aioHistory || [], teach.regime), crossroads: teach.crossroads,
    revisions: revisionCounts(teach.consensus, teach.measured.map((member) => member.sym)), rrgMove: row.market === 'US' ? rrgMoveOf(root, row.id) : null }).map((item) => item.text);
  return { market: row.market, themeId: row.id, label: row.label, stage: stageWord(row.state) || '판정 보류', asOf: teach.after,
    headline: teach.criteria.headline, items: teach.criteria.items.map(({ label, met, value, principle }) => ({ label, met, value, principle })),
    reasons, roles: Object.fromEntries(Object.entries(teach.examples).map(([key, list]) => [MEMBER_ROLES[key].name, list])),
    scenarios: { favorable: teach.split.favorable, unfavorable: teach.split.unfavorable, breaks: row.breaks || [] } };
}

// v59.51 (content audit, owner's two layers): the face of the theme detail is one short reading for a beginner — the
// stage, the move against the market, the strongest and weakest part inside, and what the lead scenario means for it —
// and the criteria headline. The analysis behind it (reasons, the sub-theme flow, the stage read and the criteria table
// with the conditional scenarios) sits in one expert fold. This fills the slots renderThemeDetailSummary leaves.
export const WIND_PLAIN = Object.freeze({ tail: '유리한 쪽', head: '불리한 쪽', mixed: '유리·불리가 섞인 쪽', none: '영향이 크지 않은 쪽' });
export function renderThemeDetailTeach({ documentRef, root, store }) {
  const readingHost = documentRef?.getElementById('theme-detail-reading');
  const why = documentRef?.getElementById('theme-detail-native-why');
  const criteriaHost = documentRef?.getElementById('theme-detail-native-criteria');
  const tableHost = documentRef?.getElementById('theme-detail-native-criteria-table');
  if (!readingHost && !why && !criteriaHost && !tableHost) return;
  const themeId = String(root?._currentThemeId || '');
  const teach = themeId ? themeTeachFor({ root, store, market: 'US', themeId }) : null;
  const make = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  if (!teach?.criteria) { for (const node of [readingHost, why, criteriaHost, tableHost]) if (node) { node.hidden = true; node.replaceChildren(); } return; }
  const { row, criteria } = teach;
  if (readingHost) {
    const lines = [];
    const definition = THEME_STATES[row.state]?.match(/\((.*)\)$/)?.[1];
    lines.push(THEME_STATES[row.state] ? `지금 단계는 '${stageWord(row.state)}'입니다${definition ? ` — ${definition}` : ''}.` : '지금 단계는 판정 보류입니다 — 단계를 정하는 조건이 서로 엇갈립니다.');
    const etf = (root?.THEME_MAP || []).find((theme) => theme?.id === themeId)?.etf || null;
    const rel = relativeSeriesOf(root, etf);
    const word = (value, last) => `${Math.abs(value).toFixed(1)}% ${value >= 0 ? (last ? '강했습니다' : '강했고') : (last ? '약했습니다' : '약했고')}`;
    if (rel) lines.push(`최근 ${rel.series.length}거래일은 시장(SPY)보다 ${word(rel.total, false)}, 최근 20거래일은 ${word(rel.recent, true)}.`);
    const ranked = themeFlowOf(root, store, themeId, etf).flow.rows.filter((group) => !group.smallSample && group.ret3m != null);
    if (ranked.length >= 2) lines.push(`테마 안에서는 ${ranked[0].name} 쪽이 가장 강하고, ${ranked.at(-1).name} 쪽이 가장 약합니다(3개월).`);
    // v59.51 (one lead source): scenarioLead — a tie names every tied branch and reads their common wind (혼재 if they differ).
    const scenario = teach.scenario;
    if (scenario?.items?.length && WIND_PLAIN[row.wind?.lead]) lines.push(scenario.state === 'tie'
      ? `${String(scenario.face || '').replace(/\.$/, '')} — 이 테마에는 ${WIND_PLAIN[row.wind.lead]}입니다.`
      : `지금 조건이 가장 많이 맞는 시나리오 ${scenario.names[0]}에서는 이 테마에 ${WIND_PLAIN[row.wind.lead]}입니다.`);
    readingHost.replaceChildren(...lines.map((text) => make('li', text)));
    readingHost.hidden = !lines.length;
  }
  if (why) {
    const reasons = themeReasons({ row, tags: row.tags || [], moves: macroMoves(root?._aioHistory || [], teach.regime), crossroads: teach.crossroads,
      revisions: revisionCounts(teach.consensus, teach.measured.map((member) => member.sym)), rrgMove: rrgMoveOf(root, themeId), headlines: themeHeadlines(root, store, teach.measured, teach.after) });
    const list = make('ul', null, 'thp-why-list');
    reasons.forEach((item) => list.append(make('li', item.text)));
    // v58.79: which causes qualify is the heading's hover, not a line under the list.
    why.replaceChildren(Object.assign(make('div', '이 흐름의 이유', 'thp-detail-heading'), { title: '거시 축 이동, 이익 전망 수정, 섹터 회전 이동, 선두 시나리오, 같은 날 보도처럼 데이터로 확인되는 원인만 적습니다.' }), reasons.length ? list : make('p', '데이터로 확인되는 원인이 아직 없습니다(미확인).', 'thp-detail-empty'));
    why.hidden = false;
  }
  if (criteriaHost) {
    criteriaHost.replaceChildren(make('div', '전문가 기준', 'thp-detail-heading'), make('p', `${criteria.headline}.`, 'thp-detail-body'));
    criteriaHost.hidden = false;
  }
  if (tableHost) {
    const table = make('table', null, 'thp-criteria-table');
    const head = make('thead'), hr = make('tr');
    ['기준과 원리', '이 테마 지금', '충족'].forEach((label) => hr.append(make('th', label)));
    head.append(hr);
    const body = make('tbody');
    for (const item of criteria.items) {
      const tr = make('tr');
      const nameCell = make('td');
      nameCell.append(make('span', item.label, 'thp-criteria-name'), make('span', ` ${item.principle}`, 'thp-criteria-principle'));
      tr.append(nameCell, make('td', item.value), make('td', item.met == null ? '미확인' : item.met ? '충족' : '미충족', `thp-criteria-met is-${item.met == null ? 'unknown' : item.met ? 'met' : 'unmet'}`));
      [...tr.children].forEach((td, index) => { td.dataset.label = ['기준', '지금', '충족'][index]; });
      body.append(tr);
    }
    table.append(head, body);
    const confirm = criteria.items.filter((item) => item.met === false).map((item) => item.label);
    const split = scenarioSplitText(teach.split);
    tableHost.replaceChildren(make('div', '전문가 기준 6개 — 원리와 이 테마의 지금 값', 'thp-detail-heading'), table,
      ...(split ? [make('p', `${split} 확인할 신호: ${confirm.length ? `미충족 기준(${confirm.join(', ')})이 충족으로 바뀌는지` : '충족한 기준이 유지되는지'}. 논리가 깨지는 신호는 위 '이 테마의 시나리오'의 점검 신호입니다.`, 'thp-detail-body')] : []));
    tableHost.hidden = false;
  }
}

// The representative ETF ÷ SPY over the produced sessions (rotationHistory relativeStrength): the series, its total move
// and its last 20 sessions — read by the chart and the detail reading.
export function relativeSeriesOf(root, etf) {
  const produced = etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, etf, Date.now()) : null;
  const series = (produced?.relativeStrength || []).filter((point) => point?.sessionDate && finite(point.value) != null);
  if (series.length < 20) return null;
  const last = series.at(-1), back20 = series.at(-21) || series[0];
  return { series, total: last.value / series[0].value * 100 - 100, recent: last.value / back20.value * 100 - 100 };
}

// P1440: the theme's own flow from the published screener medians (sub-theme groups), read by the expert fold and the reading.
export function themeFlowOf(root, store, themeId, etf, label = null) {
  const rows = store?.getState?.()?.screener?.rows || [];
  const model = buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey: 'ret3m', benchmark: benchmarkReturns(root?._aioHistory || []) });
  // P1591 (T03): the ETF's rotation state is read only through the session-checked selector.
  const etfRotation = etf ? selectProducedRotation(root?._serverDataMeta?.rotationHistory, etf, Date.now()) : null;
  const stageRow = root?.__aioThemePlaybook?.themes?.find((row) => row.market === 'US' && row.id === themeId && row.state);
  const themeName = (root?.THEME_MAP || []).find((theme) => theme?.id === themeId)?.nameKr || label || null;
  const flow = themeDetailFlow({ themeId, themeName, groups: model.groups, etf: etf || null, rotation: etfRotation ? { [etf]: etfRotation } : {},
    stage: stageRow ? { state: stageRow.state, label: String(stageRow.stateLabel || '').split(' (')[0], window: '6개월' } : null });
  return { flow, rows, themeName };
}

export function relativeStrengthChart(documentRef, root, detail) {
  const etf = detail?.etf || null;
  const rel = relativeSeriesOf(root, etf);
  if (!rel) return null;
  const { series } = rel;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const node = (tag, attrs = {}, text = null) => { const n = documentRef.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text != null) n.textContent = text; return n; };
  const W = 640, H = 170, padL = 40, padR = 56, padT = 12, padB = 24;
  const values = series.map((point) => point.value);
  const lo = Math.min(100, ...values), hi = Math.max(100, ...values), span = Math.max(1, hi - lo);
  const x = (i) => padL + i / (series.length - 1) * (W - padL - padR);
  const y = (v) => padT + (hi + span * 0.05 - v) / (span * 1.1) * (H - padT - padB);
  const last = series.at(-1);
  const svg = node('svg', { viewBox: `0 0 ${W} ${H}`, class: 'thp-rel-chart', role: 'img', 'aria-label': `${etf}의 SPY 대비 상대가격 ${series.length}거래일, ${shortSession(series[0].sessionDate)} 100에서 ${shortSession(last.sessionDate)} ${last.value.toFixed(1)}, 기간 ${signedText(rel.total, 1)}%, 최근 20거래일 ${signedText(rel.recent, 1)}%` });
  svg.append(node('line', { x1: padL, x2: W - padR, y1: y(100), y2: y(100), class: 'thp-rel-base' }), node('text', { x: padL - 4, y: y(100) + 4, 'text-anchor': 'end', class: 'thp-rel-tick' }, '100'));
  for (const v of [hi, lo]) if (Math.abs(v - 100) > span * 0.12) svg.append(node('text', { x: padL - 4, y: y(v) + 4, 'text-anchor': 'end', class: 'thp-rel-tick' }, v.toFixed(0)));
  svg.append(node('polyline', { points: series.map((point, i) => `${x(i).toFixed(1)},${y(point.value).toFixed(1)}`).join(' '), class: `thp-rel-line ${last.value >= 100 ? 'is-up' : 'is-down'}` }));
  svg.append(node('circle', { cx: x(series.length - 1), cy: y(last.value), r: 3, class: `thp-rel-dot ${last.value >= 100 ? 'is-up' : 'is-down'}` }), node('text', { x: x(series.length - 1) + 6, y: y(last.value) + 4, class: 'thp-rel-tick' }, last.value.toFixed(1)));
  svg.append(node('text', { x: padL, y: H - 6, class: 'thp-rel-tick' }, shortSession(series[0].sessionDate)), node('text', { x: W - padR, y: H - 6, 'text-anchor': 'end', class: 'thp-rel-tick' }, shortSession(last.sessionDate)));
  const box = documentRef.createElement('div');
  box.className = 'thp-rel';
  const head = documentRef.createElement('div');
  head.className = 'thp-detail-heading';
  // v59.51 (content audit): the reading above the chart says what the line did; the how-to caption left and the method
  // (rebased to 100 on the first session; the scatter compares this line with its 50-session average) is the head's hover.
  head.textContent = `시장(SPY)과 견준 대표 ETF ${etf}, 최근 ${series.length}거래일`;
  head.title = `${shortSession(series[0].sessionDate)}을 100으로 놓은 ${etf} ÷ SPY 상대가격(${shortSession(last.sessionDate)} ${last.value.toFixed(1)}). 섹터 회전 그래프의 점은 이 선을 50거래일 평균과 견준 값입니다.`;
  box.append(head, svg);
  return box;
}

export function renderThemeDetailSummary({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-summary');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    for (const node of [host, documentRef.getElementById('theme-detail-native-next')]) if (node) { node.replaceChildren(); node.hidden = true; }
    return;
  }
  const title = documentRef.createElement('div');
  title.textContent = detail.label;
  title.className = 'thp-summary-title';
  const meta = documentRef.createElement('span');
  meta.textContent = detail.etf ? `, ${detail.etf}` : ', 커스텀 합산';
  meta.className = 'thp-summary-meta';
  title.appendChild(meta);

  const performance = documentRef.createElement('span');
  const pct = typeof detail.pct === 'number' && Number.isFinite(detail.pct) ? detail.pct : null;
  performance.textContent = pct == null ? '당일 등락 대기' : `${signedText(pct, 2)}%`;
  performance.className = 'thp-summary-pct';
  performance.style.color = dirColor(pct, 2);

  const header = documentRef.createElement('div');
  header.className = 'thp-summary-header';
  header.append(title, performance);

  // v59.51 (content audit): the provenance line (provider and taxonomy text beside the number) and the leaders line (the
  // member table lists them) left the face; the quote basis is the day move's hover.
  const themeItem = selectThemesItems(store?.getState?.() || {}).find((item) => String(item?.id || '') === String(detail.id));
  const closeOf = usCloseSession(root);
  performance.title = detail.source === 'quote-missing' || pct == null ? '시세 근거 미확보'
    : themeItem?.sourceKind === 'runtime-quote' ? '당일 등락, 실시간·지연 시세' : `당일 등락, ${closeOf ? `${shortSession(closeOf)} ` : ''}확정 종가 기준`;

  const make = (tag, className, id = null) => { const node = documentRef.createElement(tag); if (className) node.className = className; if (id) { node.id = id; node.hidden = true; } return node; };
  // Face: the reading (renderThemeDetailTeach fills it), the chart and the criteria headline.
  const reading = make('ul', 'thp-reading', 'theme-detail-reading');
  const criteriaSlot = make('div', 'theme-detail-native-section thp-criteria', 'theme-detail-native-criteria');
  // Fold: the analysis behind the reading, for an expert.
  const expert = make('details', 'thp-expert-fold');
  expert.id = 'theme-detail-expert';
  expert.open = !!root._aioThemeExpertOpen;
  expert.addEventListener('toggle', () => { root._aioThemeExpertOpen = expert.open; });
  const summary = documentRef.createElement('summary');
  summary.textContent = '전문가용 분석 — 원인, 세부 테마 흐름, 시나리오, 기준 6개';
  // P1588: the membership review date stays with the theme; it opens the expert fold rather than sitting on the face.
  const membership = detail.membershipPolicy || {};
  const provenance = documentRef.createElement('p');
  provenance.className = 'theme-strength-basis thp-summary-provenance';
  provenance.textContent = `AIO 참고 테마 분류, ${membership.observedAt ? `구성 기준 ${String(membership.observedAt).slice(0, 10)}(분류 검토일, 가격 기준일 아님)` : '구성 기준일 미검증'}`;
  provenance.title = `시세 출처: ${detail.source}, 구성 출처: ${membership.source || 'AIO curated taxonomy'}`;
  provenance.setAttribute('data-source-kind', membership.sourceKind || 'REFERENCE');
  provenance.setAttribute('data-operational-use', membership.allowedUse === 'decision' ? 'decision' : 'reference-only');
  if (membership.observedAt) provenance.setAttribute('data-observed-at', membership.observedAt);
  expert.append(summary, provenance, make('div', 'theme-detail-native-section thp-why', 'theme-detail-native-why'));
  const relative = relativeStrengthChart(documentRef, root, detail);
  host.replaceChildren(header, reading, ...(relative ? [relative] : []), criteriaSlot, expert);
  const { flow, rows, themeName } = themeFlowOf(root, store, detail.id, detail.etf || null, detail.label);
  if (flow.rows.length) {
    const box = documentRef.createElement('div');
    box.className = 'theme-detail-flow';
    const flowHead = documentRef.createElement('div');
    flowHead.className = 'thp-detail-heading';
    flowHead.textContent = '세부 테마 흐름 — 구성 종목 중앙값';
    box.append(flowHead);
    // P1681 (X03): the same stale admission as the theme table — the read is a dated reference, not today's leaders.
    const basis = basisOf(rows, store?.getState?.()?.screener?.metadata || null, root?._aioHistory || []);
    if (flow.read) { const p = documentRef.createElement('p'); p.className = 'flow-lead'; p.textContent = basis?.stale ? `${basis.label}. ${flow.read}` : flow.read; box.append(p); }
    const max = Math.max(1, ...flow.rows.map((group) => Math.abs(group.ret3m ?? 0)));
    for (const group of flow.rows) {
      const line = documentRef.createElement('div');
      line.className = 'stock-read-bars';
      const name = documentRef.createElement('span');
      name.className = 'stock-read-bar-label';
      name.textContent = group.smallSample ? `${group.name}, 표본 ${group.members}종목, 참고` : group.name; // D15
      const item = documentRef.createElement('div');
      item.className = 'stock-read-bar-row';
      const bar = signedBar(documentRef, group.ret3m ?? 0, max); // v59.69: a falling group sits left of zero
      const value = documentRef.createElement('span');
      value.className = 'stock-read-bar-value';
      const dir = directionLabel(group); // 3개월→1개월 순위 변화 (audit 19: not the playbook stage words; v58.74 names a contrary week)
      value.textContent = `3개월 ${group.ret3m == null ? '—' : `${signedText(group.ret3m, 1)}%`}, 1개월 ${group.ret1m == null ? '—' : `${signedText(group.ret1m, 1)}%`}${group.ret5d != null ? `, 5거래일 ${signedText(group.ret5d, 1)}%` : ''}${group.above50Pct != null ? `, 50일선 위 ${group.above50Pct}%` : ''}${dir ? `, ${dir}` : ''}`;
      item.append(bar, value);
      line.append(name, item);
      box.append(line);
    }
    expert.append(box);
  }
  // P1743 (audit 18): the theme's 시나리오 read (renderThemeDetailPlaybook fills this); a stale copy (older placement) is
  // dropped so the id stays unique. Then the criteria table with the conditional scenarios (renderThemeDetailTeach).
  documentRef.getElementById('theme-detail-native-playbook')?.remove();
  expert.append(make('div', 'theme-detail-native-section tp-detail', 'theme-detail-native-playbook'), make('div', 'theme-detail-native-section thp-criteria', 'theme-detail-native-criteria-table'));
  host.hidden = false;
  renderThemeDetailNext(documentRef, flow.next, themeName || detail.label);
}

// v57.50 (W1 request): the theme detail continues where its reading points — themeDetailFlow().next (the screener search
// and 시장 폭). v59.51 (content audit): with the 'AI에게 묻기' chips (the legacy #page-theme-detail block's three, on the
// shared _aioAskInPanel handler) they close the panel, after the members, instead of sitting mid-panel.
export function renderThemeDetailNext(documentRef, next, askName) {
  const host = documentRef?.getElementById('theme-detail-native-next');
  if (!host) return;
  host.replaceChildren();
  if (Array.isArray(next) && next.length) {
    const nav = documentRef.createElement('nav');
    nav.className = 'flow-next';
    nav.id = 'theme-detail-next';
    nav.setAttribute('aria-label', '이어서 볼 곳');
    host.append(nav);
    renderNextSteps(documentRef, nav, next);
  }
  host.append(askRow(documentRef, [['성장 동력', `${askName} 테마의 성장 동력과 지금 흐름을 설명해줘`], ['경쟁 구도', `${askName} 테마의 경쟁 구도를 정리해줘`], ['위험 요소', `${askName} 테마의 위험 요소와 확인할 지표를 정리해줘`]], 'thp-ask-row'));
  host.hidden = false;
}

export function detailQuote(detail, symbol) {
  const quote = detail?.quotes?.[symbol];
  if (!quote || typeof quote !== 'object') return null;
  const price = finite(quote.price);
  const pct = finite(quote.pct);
  const currency = quote.currency ? String(quote.currency).trim().toUpperCase() : null;
  return price == null && pct == null ? null : { price, pct, currency };
}

export function formatQuotePrice(value, currency) {
  if (value == null) return '가격 대기';
  const code = String(currency || '').trim().toUpperCase();
  if (!code) return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}, 통화 미확인`;
  try {
    return new Intl.NumberFormat(code === 'KRW' ? 'ko-KR' : 'en-US', {
      style: 'currency', currency: code, maximumFractionDigits: code === 'KRW' ? 0 : 2
    }).format(value);
  } catch (_) {
    return `${code} ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

export function compositeDetailPct(detail, subTheme) {
  if (subTheme?.etf) {
    const etfQuote = detailQuote(detail, subTheme.etf);
    if (finite(etfQuote?.pct) != null) return etfQuote.pct;
  }
  const weighted = Object.entries(subTheme?.weights || {})
    .map(([symbol, weight]) => ({ quote: detailQuote(detail, symbol), weight: Number(weight) }))
    .filter((row) => finite(row.quote?.pct) != null && Number.isFinite(row.weight) && row.weight > 0);
  if (weighted.length) {
    const totalWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
    if (totalWeight > 0) return weighted.reduce((sum, row) => sum + row.quote.pct * row.weight, 0) / totalWeight;
  }
  const pcts = (subTheme?.tickers || [])
    .map((symbol) => detailQuote(detail, symbol)?.pct)
    .filter((value) => finite(value) != null);
  return pcts.length ? pcts.reduce((sum, value) => sum + value, 0) / pcts.length : null;
}

export function renderThemeDetailComposition({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-composition');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }

  const heading = documentRef.createElement('div');
  heading.textContent = '구성 종목, 기간 수익률과 추세 위치';
  heading.className = 'thp-detail-heading thp-detail-heading--loose';
  // v59.51 (content audit): the 세부 테마별 당일 등락 fold left the face — its sub-theme day cards are the 당일 상세 fold's
  // 서브테마 panel (renderThemeDetailSubthemeGap) and its 상승 종목 비율 line repeated the 참여 폭 panel there.
  const screenerRows = screenerRowMap(store);
  const seen = new Set();
  const members = (detail.subThemes || []).flatMap((subTheme) => (subTheme.tickers || []).map((symbol) => ({ sym: String(symbol).toUpperCase(), group: subTheme.name || '' })))
    .filter((member) => (seen.has(member.sym) ? false : seen.add(member.sym))).map((member) => ({ ...member, label: member.sym, row: screenerRows.get(member.sym) || null }));
  const rerender = () => { if (String(root?._currentThemeId || '') === String(detail.id)) { renderThemeDetailComposition({ documentRef, root, store }); renderThemeDetailTeach({ documentRef, root, store }); } };
  const parts = [heading];
  const teach = themeTeachFor({ root, store, market: 'US', themeId: detail.id });
  // v58.75 (persona review): a Finviz-style member table (1주·1개월·3개월·6개월, 50일선·52주 고점 거리, 20일 평균 대비
  // 거래량, sortable) separates leaders from laggards.
  const table = members.some((member) => member.row) ? memberTable(documentRef, root, members, { onSort: rerender, showGroup: (detail.subThemes || []).length > 1, ariaLabel: `${detail.label} 구성 종목 표`, roles: teach?.roles || null }) : null;
  const roleFold = table ? memberRoleParts(documentRef, teach, members) : null;
  if (table) parts.push(table.lead, table.region, table.basis, ...(roleFold ? [roleFold] : []));
  else parts.push(Object.assign(documentRef.createElement('p'), { className: 'thp-detail-empty', textContent: '구성 종목의 기간 수익률 기록을 아직 받지 못했습니다.' }));
  const catalysts = themeCatalysts(documentRef, root, members.map((member) => member.sym), rerender);
  if (catalysts) parts.push(catalysts);
  host.replaceChildren(...parts);
  host.hidden = false;
}

export function subthemeDayCards(documentRef, detail) {
  const subThemes = documentRef.createElement('div');
  subThemes.className = 'thp-subtheme-list';
  (detail.subThemes || []).forEach((subTheme) => {
    const card = documentRef.createElement('section');
    card.className = 'thp-subtheme-card';
    const title = documentRef.createElement('div');
    title.className = 'thp-subtheme-title';
    const name = documentRef.createElement('span');
    name.textContent = subTheme.name || '세부 테마';
    name.className = 'thp-subtheme-name';
    if (subTheme.etf) {
      const etfLabel = documentRef.createElement('span');
      etfLabel.textContent = `, ${subTheme.etf}`;
      etfLabel.className = 'thp-subtheme-etf';
      name.appendChild(etfLabel);
    }
    const pct = compositeDetailPct(detail, subTheme);
    const performance = documentRef.createElement('span');
    performance.textContent = pct == null ? '시세 대기' : `${signedText(pct, 2)}%`;
    performance.className = 'thp-subtheme-pct';
    performance.style.color = dirColor(pct, 2);
    title.append(name, performance);
    card.appendChild(title);

    const tickers = documentRef.createElement('div');
    tickers.className = 'thp-ticker-chips';
    (subTheme.tickers || []).forEach((symbol) => {
      const quote = detailQuote(detail, symbol);
      const chip = documentRef.createElement('span');
      chip.textContent = `${symbol}${quote?.pct == null ? '' : ` ${signedText(quote.pct, 1)}%`}`;
      chip.dataset.action = 'showTicker';
      chip.dataset.arg = symbol;
      chip.title = `${symbol} 분석`;
      chip.className = 'thp-ticker-chip';
      tickers.appendChild(chip);
    });
    if (!tickers.childElementCount) {
      const empty = documentRef.createElement('span');
      empty.textContent = '구성종목 없음';
      empty.className = 'thp-detail-empty';
      tickers.appendChild(empty);
    }
    card.appendChild(tickers);
    subThemes.appendChild(card);
  });

  if (!subThemes.childElementCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = '세부 테마 구성 데이터가 없습니다.';
    empty.className = 'thp-detail-empty';
    subThemes.appendChild(empty);
  }
  return subThemes;
}

// v58.75 (persona review, A-2·5): folded, how an expert picks inside a theme — the role counts against the members' median,
// each role's definition, its pro and con, the members that fit it now, and the liquidity / earnings flags. v59.51: the
// role count and the 50-day share left the face (one line over the table) for this fold.
export function memberRoleParts(documentRef, teach, members = []) {
  const roles = teach?.roles;
  if (!roles?.measured) return null;
  const make = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const count = (key) => [...roles.roles.values()].filter((info) => info.role === key).length;
  const sma = members.map((member) => readRowNumber(member.row, 'pctSma50', 'display')).filter((value) => value != null);
  const fold = make('details', null, 'thp-roles-fold');
  fold.append(make('summary', '테마 안에서 종목 고르는 법 — 주도·후발·이탈'),
    make('p', `역할 분포: ${Object.entries(MEMBER_ROLES).map(([key, role]) => `${role.label} ${count(key)}`).join('·')}종목, 나머지는 중간(구성 종목 중앙값 1개월 ${pctText(roles.stats.ret1m)}, 3개월 ${pctText(roles.stats.ret3m)} 기준).${sma.length ? ` 50일선 위 ${sma.filter((value) => value > 0).length}/${sma.length}종목.` : ''}`, 'thp-detail-body'));
  for (const [key, role] of Object.entries(MEMBER_ROLES)) {
    const examples = teach.examples?.[key] || [];
    const p = make('p', null, 'thp-detail-body');
    p.append(make('strong', role.name), documentRef.createTextNode(` — ${role.rule}. 장점: ${role.pro} 단점: ${role.con} 지금: ${examples.length ? examples.join(', ') : '해당 종목 없음'}.`));
    fold.append(p);
  }
  const infos = [...roles.roles.entries()];
  const thin = infos.filter(([, info]) => info.thin).map(([sym]) => sym);
  const due = infos.filter(([, info]) => info.earnings).map(([sym, info]) => `${sym} ${info.earnings}`);
  fold.append(make('p', `유동성: 30일 평균 거래대금 2,000만 달러 미만 ${thin.length ? `${thin.length}종목(${thin.slice(0, 6).join(', ')}${thin.length > 6 ? ' 외' : ''}) — 사고팔 때 호가 차이로 비용이 커질 수 있습니다` : '종목 없음'}. 실적 일정: ${teach.calendar ? (due.length ? `${due.join(', ')} — 발표 전후 하루 변동이 평소보다 커질 수 있습니다` : '달력 주간에 없음') : teach.row?.market === 'KR' ? '실적 달력은 미국 종목만 있어 미확인' : '달력 미확인'}. 바닥 다지기(베이스) 구조는 종목 차트에서 확인합니다.`, 'thp-detail-body'));
  return fold;
}

export const MEMBER_COLUMNS = Object.freeze([['ret5d', '1주'], ['ret1m', '1개월'], ['ret3m', '3개월'], ['ret6m', '6개월'], ['pctSma50', '50일선 대비'], ['pctFrom52wHigh', '52주 고점 대비'], ['rvol20', '거래량 배수']]);
/**
 * Sortable member table from published screener rows. members: [{ sym, label, group?, row }]. The 3개월 top and bottom
 * third carry a plain flag (a rank fact, not a grade). Sort state lives on root so a repaint keeps it.
 */
export function memberTable(documentRef, root, members, { onSort, showGroup = false, ariaLabel = '구성 종목 표', basisDate = null, roles = null } = {}) {
  // v58.75 (persona review, A-5): with member roles (theme-criteria.js memberRoles) the last column names the role and its
  // liquidity / earnings flags instead of the 3개월 third.
  const roleMap = roles?.measured ? roles.roles : null;
  const sort = root._aioMemberSort && MEMBER_COLUMNS.some(([key]) => key === root._aioMemberSort.key) ? root._aioMemberSort : { key: 'ret3m', dir: -1 };
  // v59.46 boundary contract (stage 2): a member's published numbers are read through the readiness contract.
  const memberValue = (member, key) => readRowNumber(member.row, key, 'display');
  const ranked = members.filter((member) => memberValue(member, 'ret3m') != null).sort((a, b) => memberValue(b, 'ret3m') - memberValue(a, 'ret3m'));
  const third = ranked.length >= 6 ? Math.floor(ranked.length / 3) : 0;
  const top = new Set(ranked.slice(0, third).map((member) => member.sym)), bottom = new Set(third ? ranked.slice(-third).map((member) => member.sym) : []);
  const sorted = [...members].sort((a, b) => {
    const va = memberValue(a, sort.key), vb = memberValue(b, sort.key);
    if (va == null && vb == null) return a.sym.localeCompare(b.sym);
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * sort.dir;
  });
  const make = (tag, text, className) => { const n = documentRef.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
  const table = make('table', null, 'thp-member-table');
  const head = make('thead'), hr = make('tr');
  const lastLabel = roleMap ? '역할' : '3개월 순위';
  const labels = ['종목', ...(showGroup ? ['세부 테마'] : []), ...MEMBER_COLUMNS.map(([, label]) => label), lastLabel];
  hr.append(make('th', '종목'));
  if (showGroup) hr.append(make('th', '세부 테마'));
  for (const [key, label] of MEMBER_COLUMNS) {
    const th = make('th');
    th.setAttribute('aria-sort', sort.key === key ? (sort.dir < 0 ? 'descending' : 'ascending') : 'none');
    const button = make('button', `${label}${sort.key === key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}`, 'thp-member-sort');
    button.type = 'button';
    button.addEventListener('click', () => { root._aioMemberSort = { key, dir: sort.key === key ? -sort.dir : -1 }; onSort?.(); });
    th.append(button);
    hr.append(th);
  }
  hr.append(make('th', lastLabel));
  head.append(hr);
  const body = make('tbody');
  const fmt = (key, value) => (value == null ? '—' : key === 'rvol20' ? `${value.toFixed(2)}배` : `${signedText(value, 1)}%`);
  // Fifteen rows first (the sort decides which); the rest on request, so a 40-name theme does not run a screen long.
  const shown = root._aioMemberAll || sorted.length <= 18 ? sorted : sorted.slice(0, 15);
  for (const member of shown) {
    const tr = make('tr');
    const cell = make('td');
    const button = make('button', member.label, 'breadth-drill-symbol');
    button.type = 'button';
    button.dataset.action = 'showTicker';
    button.dataset.arg = member.sym;
    if (member.label !== member.sym) button.title = member.sym;
    cell.append(button);
    tr.append(cell);
    if (showGroup) tr.append(make('td', member.group || '—', 'thp-member-group'));
    for (const [key] of MEMBER_COLUMNS) {
      const value = memberValue(member, key);
      tr.append(make('td', fmt(key, value), `is-num${value == null || key === 'rvol20' || !directionOf(value) ? '' : directionOf(value) === 'up' ? ' is-up' : ' is-down'}${sort.key === key ? ' is-sorted' : ''}`));
    }
    if (roleMap) {
      const info = roleMap.get(member.sym) || {};
      const flags = [info.thin ? '거래대금 적음' : null, info.earnings ? `실적 ${info.earnings}` : null].filter(Boolean);
      tr.append(make('td', [info.role ? MEMBER_ROLES[info.role].label : '—', ...flags].join(', '), `thp-member-flag${info.role ? ` is-${info.role}` : ''}`));
    } else tr.append(make('td', top.has(member.sym) ? '상위 1/3' : bottom.has(member.sym) ? '하위 1/3' : '', top.has(member.sym) ? 'thp-member-flag is-top' : bottom.has(member.sym) ? 'thp-member-flag is-bottom' : 'thp-member-flag'));
    [...tr.children].forEach((td, index) => { td.dataset.label = labels[index]; });
    body.append(tr);
  }
  table.append(head, body);
  const region = make('div', null, 'aio-table-scroll thp-member-scroll');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', `${ariaLabel}, 가로 스크롤`);
  region.tabIndex = 0;
  region.append(table);
  const name = (member) => member.label;
  // v59.51 (content audit): one line over the table, names only (the numbers are in the table; the 50-day share is in the
  // roles fold).
  const lead = make('p', ranked.length >= 4
    ? `3개월 기준 앞선 종목은 ${ranked.slice(0, 3).map(name).join('·')}, 뒤처진 종목은 ${ranked.slice(-2).reverse().map(name).join('·')}입니다.`
    : '구성 종목의 기간 수익률 기록이 적어 앞선·뒤처진 종목을 나누지 않습니다.', 'thp-detail-body');
  const latestMemberSession = latestSessionRows(members, (member) => stampDay(member.row?.factorSessionDate)).basis;
  // v58.79: the close date stays; how to read the columns is its hover.
  const basis = make('p', basisDate || (latestMemberSession ? `${shortSession(latestMemberSession)} 종가 기준` : '종가 기준일 미확인'), 'thp-perf-basis');
  basis.title = `열 제목을 누르면 정렬, 거래량 배수 = 최근 거래량 ÷ 20일 평균, ${roleMap ? "역할은 아래 '테마 안에서 종목 고르는 법'의 정의" : `3개월 순위는 이 표 안에서의 위치(기록 ${ranked.length}종목)`}`;
  if (sorted.length > 18) {
    const more = make('button', root._aioMemberAll ? '정렬 순 상위 15종목만 보기' : `전체 ${sorted.length}종목 보기`, 'theme-strength-more thp-member-more');
    more.type = 'button';
    more.addEventListener('click', () => { root._aioMemberAll = !root._aioMemberAll; onSort?.(); });
    basis.append(' ', more);
  }
  return { lead, region, basis };
}

// v58.75 (persona review): what is scheduled for the theme's members — the published earnings calendar week and the
// four-week estimate revisions (consensus-estimates.json fwd.up4w / down4w). Both load once and repaint on arrival.
export function themeCatalysts(documentRef, root, symbols, rerender) {
  if (!root[EARNINGS_CALENDAR.key]) refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed) rerender(); }).catch(() => {});
  if (!root[CONSENSUS_KEY]) requestConsensusEstimates(root, rerender);
  const wanted = new Set(symbols.map((symbol) => String(symbol).toUpperCase()));
  const calendar = root[EARNINGS_CALENDAR.key];
  const lines = [];
  if (Array.isArray(calendar?.earnings)) {
    const hour = { bmo: '장전', amc: '장후', dmh: '장중' };
    const due = calendar.earnings.filter((row) => wanted.has(String(row?.symbol || '').toUpperCase()) && isoDay(row?.date))
      .sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
    const span = calendar.weekStart && calendar.weekEnd ? `${shortSession(calendar.weekStart)}~${shortSession(calendar.weekEnd)}` : '이번 달력 주간';
    lines.push(due.length ? `실적 발표 예정(${span}, 구성 종목): ${due.map((row) => `${row.symbol} ${shortSession(row.date)}${hour[row.hour] ? ` ${hour[row.hour]}` : ''}`).join(', ')}.` : `${span} 실적 발표 예정인 구성 종목은 달력에 없습니다.`);
  }
  // v59.51 (content audit): the four-week estimate-revision count left this box — the expert fold's '이 흐름의 이유' prints
  // the same count (theme-criteria.js revisionCounts); the consensus still loads here for that reason and the criteria.
  if (!lines.length) return null;
  const box = documentRef.createElement('div');
  box.className = 'thp-catalysts';
  const head = documentRef.createElement('div');
  head.className = 'thp-detail-heading';
  head.textContent = '다가오는 실적 발표';
  box.append(head, ...lines.map((text) => { const p = documentRef.createElement('p'); p.className = 'thp-detail-body'; p.textContent = text; return p; }));
  return box;
}

export function renderThemeDetailLeaders({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-leaders');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }

  const heading = documentRef.createElement('div');
  heading.textContent = `대표 종목 상세, ${detail.leaders.length}종목`;
  heading.className = 'thp-detail-heading thp-detail-heading--loose';
  const cards = documentRef.createElement('div');
  cards.className = 'thp-leader-grid';
  (detail.leaders || []).forEach((symbol) => {
    const quote = detailQuote(detail, symbol);
    const card = documentRef.createElement('button');
    card.type = 'button';
    card.dataset.action = 'showTicker';
    card.dataset.arg = symbol;
    card.title = `${symbol} 상세 분석`;
    card.className = 'thp-leader-card';
    const ticker = documentRef.createElement('span');
    ticker.textContent = symbol;
    ticker.className = 'thp-leader-ticker';
    const price = documentRef.createElement('span');
    price.textContent = quote?.price == null && quote?.closeBased ? `${detail.quoteBasis?.session ? `${Number(detail.quoteBasis.session.slice(5, 7))}/${Number(detail.quoteBasis.session.slice(8, 10))} ` : ''}종가 기준` : formatQuotePrice(quote?.price, quote?.currency);
    price.className = 'thp-leader-price';
    const pct = documentRef.createElement('span');
    pct.textContent = quote?.pct == null ? '등락률 대기' : `${signedText(quote.pct, 2)}%`;
    pct.className = 'thp-leader-pct';
    pct.style.color = dirColor(quote?.pct ?? null, 2);
    card.append(ticker, price, pct);
    cards.appendChild(card);
  });
  if (!cards.childElementCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = '대표 종목 구성 데이터가 없습니다.';
    empty.className = 'thp-detail-empty';
    cards.appendChild(empty);
  }
  host.replaceChildren(heading, cards);
  host.hidden = false;
}

export function renderThemeDetailTemperature({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-temperature');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  // LC-38: this panel only observes ONE day's ETF change. It used to expand that single number into
  // time-series momentum, flow, cause and action claims ("모멘텀이 살아있다", "차익실현/로테이션
  // 매도", "구조적 훼손"). Each band now names the day window it actually measured; the other claim
  // types require their own evidence.
  heading.textContent = '테마 당일 등락 구간';
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  const pct = finite(detail.pct);
  if (pct == null) body.textContent = '시세 대기 — 구성종목 가격이 확인되면 당일 등락을 표시합니다.';
  else if (pct >= 3) body.textContent = '당일 +3% 이상 — 관측된 당일 등락 구간입니다. 과열·추세 지속은 별도 기간 근거가 필요합니다.';
  else if (pct >= 1) body.textContent = '당일 +1% 이상 — 관측된 당일 등락 구간입니다. 시계열 모멘텀·자금 유입은 별도 근거가 필요합니다.';
  // v59.45 R1-02: the flat band is symmetric (-1% < pct < +1%); +0.9% read 보합 while -0.05% read 하락.
  else if (pct > -1) body.textContent = '당일 보합 — 관측된 당일 등락 구간입니다. 방향은 추가 가격·거래량으로 확인합니다.';
  else if (pct > -2) body.textContent = '당일 -1% 이하 — 관측된 당일 등락 구간입니다. 원인(수급·로테이션)은 별도 근거가 필요합니다.';
  else body.textContent = '당일 -2% 이하 — 관측된 당일 등락 구간입니다. 시계열 하락·구조 훼손은 별도 기간 근거가 필요합니다.';
  body.className = 'thp-detail-body';
  body.style.color = pct == null ? 'var(--text-muted)' : pct > -1 ? 'var(--text-secondary)' : 'var(--data-amber)';
  host.replaceChildren(heading, body);
  host.hidden = false;
}

export function renderThemeDetailSpread({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-spread');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '종목 간 퍼포먼스 격차';
  heading.className = 'thp-detail-heading';
  const rows = (detail.leaders || [])
    .map((symbol) => ({ symbol, pct: detailQuote(detail, symbol)?.pct }))
    .filter((row) => finite(row.pct) != null)
    .sort((a, b) => b.pct - a.pct);
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body';
  if (rows.length < 2) {
    body.textContent = '시세 대기 — 최소 두 종목의 등락률이 확인되면 격차를 계산합니다.';
  } else {
    const spread = rows[0].pct - rows[rows.length - 1].pct;
    // LC-38: a narrow day-level spread is not evidence that every constituent reacted to one
    // catalyst, nor a reason to prefer the ETF. State the measured dispersion only.
    const level = spread > 5 ? '매우 큼 — 구성 종목 간 당일 등락 차가 큽니다.' : spread > 2 ? '보통 — 테마 전체 움직임과 종목별 차이가 함께 있습니다.' : '좁음 — 구성 종목의 당일 등락이 비슷합니다.';
    body.textContent = `등락 편차 ${spread.toFixed(1)}%p (${level})`;
    const leaders = documentRef.createElement('div');
    leaders.textContent = `최강 ${rows[0].symbol} ${signedText(rows[0].pct, 2)}%, 최약 ${rows[rows.length - 1].symbol} ${rows[rows.length - 1].pct >= 0 ? '+' : ''}${rows[rows.length - 1].pct.toFixed(2)}%`;
    leaders.className = 'thp-spread-leaders';
    body.appendChild(leaders);
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

export function renderThemeDetailBreadthHealth({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-breadth-health');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  // LC-28: the up-ratio is an observed PRICE participation measure. The retired wording claimed a
  // buyer and a fund flow the screen never measured; the label now names only the price participation.
  heading.textContent = '가격 상승 참여 폭 (당일)';
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  const breadth = finite(detail.breadth);
  // LC-36: the up-ratio is computed over the 리더 목록 중 가격이 확인된 종목만이다. 그 분모를 값
  // 옆에 표시해, 화면의 14행(리더 목록)과 실제 비율의 n이 다를 수 있음을 드러낸다.
  const leaderList = Array.isArray(detail.leaders) ? detail.leaders : [];
  const priceEligible = leaderList.filter((symbol) => finite(detailQuote(detail, symbol)?.pct) != null).length;
  const basis = breadth == null ? '' : ` (가격 적격 ${priceEligible}/${leaderList.length})`;
  if (breadth == null) body.textContent = '시세 대기 — 충분한 구성종목 가격이 확인되면 당일 가격 참여 폭을 계산합니다.';
  else if (breadth >= 70) body.textContent = `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 우수 — 관측된 당일 가격 참여이며 자금 유입·거래 주체의 증거가 아닙니다.`;
  else if (breadth >= 50) body.textContent = `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 보통 — 일부 종목 중심인지 선별이 필요합니다.`;
  else body.textContent = `상승 종목 ${breadth}%${basis}, 당일 가격 참여 폭 취약 — 관측된 당일 가격 참여이며 추세 단정이 아닙니다.`;
  body.className = 'thp-detail-body';
  body.style.color = breadth == null ? 'var(--text-muted)' : breadth >= 70 ? 'var(--data-green)' : breadth >= 50 ? 'var(--text-secondary)' : 'var(--data-amber)';
  host.replaceChildren(heading, body);
  host.hidden = false;
}

export function renderThemeDetailSubthemeGap({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-subtheme-gap');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = '세부 테마별 당일 등락';
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body';
  const rows = (detail.subThemes || [])
    .map((subTheme) => ({ name: subTheme.name || '서브테마', pct: compositeDetailPct(detail, subTheme) }))
    .filter((row) => finite(row.pct) != null)
    .sort((a, b) => b.pct - a.pct);
  if (rows.length < 2 || rows[0].name === rows[rows.length - 1].name) {
    body.textContent = '시세 대기 — 최소 두 서브테마의 등락률이 확인되면 격차를 계산합니다.';
  } else {
    const spread = rows[0].pct - rows[rows.length - 1].pct;
    // LC-37: max−min of day returns is price dispersion, not observed fund rotation.
    const read = spread > 1
      ? '세부 테마 간 당일 가격 반응 격차가 큽니다. 자금 순환 여부는 별도 수급 근거가 필요합니다.'
      : '세부 테마 간 당일 반응은 비슷했습니다.';
    body.textContent = `세부 테마 격차 ${spread.toFixed(1)}%p, 최강 ${rows[0].name} ${signedText(rows[0].pct, 2, '%')}, 최약 ${rows[rows.length - 1].name} ${signedText(rows[rows.length - 1].pct, 2, '%')} — ${read}`;
  }
  host.replaceChildren(heading, body, subthemeDayCards(documentRef, detail)); // v59.51: each sub-theme's day move and its members
  host.hidden = false;
}

export function renderThemeDetailBenchmark({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-benchmark');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  const heading = documentRef.createElement('div');
  heading.textContent = 'ETF·기준자산 벤치마크 비교';
  heading.className = 'thp-detail-heading';
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body';
  const themePct = finite(detail.pct);
  // Codex browser audit H25: when the theme's own return IS its representative ETF (반도체 = SMH), "SMH 대비
  // +0.00%p · 유사" compared SMH with itself. The comparison then moves to the broad market (SPY); without a
  // SPY quote it says why it is skipped instead of producing an empty "유사" verdict.
  const ownSymbol = detail.etf || detail.compositeBase || null;
  const ownPct = ownSymbol ? finite(detailQuote(detail, ownSymbol)?.pct) : null;
  const selfCompare = Boolean(ownSymbol && themePct != null && ownPct != null && Math.abs(themePct - ownPct) < 0.005);
  // v58.74 (audit): on a weekend SPY has no live quote; the S&P 500 close of the detail's own session stands in.
  const spxClose = (() => { if (detail.quoteBasis?.kind !== 'completed-close' || !detail.quoteBasis.session) return null; const series = buildCloseSeries(root?._aioHistory || [], 'spx'); const at = series.findIndex((point) => point.date === detail.quoteBasis.session); return at > 0 ? (series[at].value / series[at - 1].value - 1) * 100 : null; })();
  const marketPct = finite(detailQuote(detail, 'SPY')?.pct ?? root?._liveData?.SPY?.pct ?? root?._liveData?.SPY?.changePercent ?? spxClose);
  const benchmarkSymbol = selfCompare ? (marketPct != null ? 'SPY' : null) : ownSymbol;
  const benchmarkPct = selfCompare ? marketPct : ownPct;
  if (selfCompare && benchmarkPct == null) {
    body.textContent = `이 테마의 수익률은 대표 ETF ${ownSymbol} 자체라 같은 ETF와는 비교하지 않습니다. 시장(SPY) 등락이 확인되면 시장 대비로 비교합니다.`;
  } else if (!benchmarkSymbol || themePct == null || benchmarkPct == null) {
    body.textContent = '시세 대기 — 테마와 벤치마크의 등락률이 확인되면 비교합니다.';
  } else {
    const diff = themePct - benchmarkPct;
    const direction = diff > 0.5 ? '상회' : diff < -0.5 ? '하회' : '유사';
    const context = direction === '상회' ? '당일은 시장보다 강했습니다.' : direction === '하회' ? '당일은 시장보다 약했습니다.' : '당일 시장과 비슷했습니다.';
    // v58.74 (text audit): one session is read as one session — "상대 모멘텀이 우세" claimed a trend from a day.
    body.textContent = `${selfCompare ? `${withTopicParticle(`${ownSymbol}(테마 대표 ETF)`)} 당일 시장(SPY)보다 ` : `${benchmarkSymbol} 대비 `}${signedText(diff, 2, '%p')}(테마 ${signedText(themePct, 2, '%')}, ${selfCompare ? '시장' : '벤치마크'} ${signedText(benchmarkPct, 2, '%')}) — ${context}`;
  }
  host.replaceChildren(heading, body);
  host.hidden = false;
}

// v58.75 (persona review): the five same-day panels (등락 구간, 종목 간 격차, 참여 폭, 서브테마 격차, 벤치마크) and the leader
// price cards read one session. They move, unchanged and with their ids, into one fold whose summary is the day in one line.
export const DAY_HOSTS = Object.freeze(['theme-detail-native-leaders', 'theme-detail-native-temperature', 'theme-detail-native-spread', 'theme-detail-native-breadth-health', 'theme-detail-native-subtheme-gap', 'theme-detail-native-benchmark']);
export function themeDayLine(detail) {
  const pct = finite(detail?.pct);
  if (pct == null) return '당일 등락: 시세 대기';
  const priced = (detail.leaders || []).map((symbol) => ({ symbol, pct: detailQuote(detail, symbol)?.pct })).filter((row) => finite(row.pct) != null).sort((a, b) => b.pct - a.pct);
  // v59.45 R1-02: a member printed as 0.0% is not counted as rising — the count follows the printed sign (directionOf).
  const up = priced.filter((row) => directionOf(row.pct, 1) === 'up').length;
  const ends = priced.length >= 2 ? `, 최강 ${priced[0].symbol} ${signedText(priced[0].pct, 1)}%·최약 ${priced.at(-1).symbol} ${signedText(priced.at(-1).pct, 1)}%` : '';
  return `당일 ${signedText(pct, 1)}%${priced.length ? `, ${priced.length}종목 중 ${up}종목 상승(${Math.round(up / priced.length * 100)}%)` : ''}${ends}`;
}
export function syncThemeDetailDayFold(documentRef, store) {
  const panel = documentRef?.getElementById('theme-detail-panel');
  const first = documentRef?.getElementById(DAY_HOSTS[0]);
  if (!panel || !first) return;
  let fold = documentRef.getElementById('theme-detail-day-fold');
  if (!fold) {
    fold = documentRef.createElement('details');
    fold.id = 'theme-detail-day-fold';
    fold.className = 'theme-detail-day-fold';
    fold.append(documentRef.createElement('summary'));
    first.insertAdjacentElement('beforebegin', fold);
  }
  for (const id of DAY_HOSTS) { const node = documentRef.getElementById(id); if (node && node.parentElement !== fold) fold.append(node); }
  const shown = DAY_HOSTS.some((id) => documentRef.getElementById(id)?.hidden === false);
  fold.hidden = !shown;
  const summary = fold.querySelector('summary');
  if (summary) summary.textContent = shown ? `당일 상세 — ${themeDayLine(selectSelectedThemeDetail(store?.getState?.() || {}))}` : '당일 상세';
}

export function renderThemeDetailInsights({ documentRef, root, store, themeId = null }) {
  const host = documentRef?.getElementById('theme-detail-native-insights');
  if (!host) return;
  const detail = selectSelectedThemeDetail(store?.getState?.() || {});
  const requestedId = String(themeId || root?._currentThemeId || detail?.id || '');
  if (!detail || !requestedId || String(detail.id) !== requestedId) {
    host.replaceChildren();
    host.hidden = true;
    return;
  }
  // v59.51 (content audit, two layers): the authored insight is expert reading, so it opens on request.
  const heading = documentRef.createElement('summary');
  heading.textContent = '테마 맞춤 인사이트 — 거시 조건, 역설, 연쇄 효과, 깨지는 신호';
  const fold = documentRef.createElement('details');
  fold.className = 'thp-expert-fold';
  fold.open = !!root._aioThemeInsightOpen;
  fold.addEventListener('toggle', () => { root._aioThemeInsightOpen = fold.open; });
  const body = documentRef.createElement('div');
  body.className = 'thp-detail-body thp-detail-body--grid';
  const insight = detail.insight || {};
  const rows = [
    ['거시 조건', insight.macro],
    ['역설', insight.paradox],
    ['연쇄 효과', insight.chainEffect],
    ['센티멘트 함정', insight.sentiment]
  ].filter(([, value]) => value);
  (insight.breakSignals || []).forEach((value, index) => rows.push([`깨지는 신호 ${index + 1}`, value]));
  if (!rows.length) {
    // Codex browser audit H26: a permanent "데이터 대기" card for themes without an authored insight read as a
    // pending load. No authored insight → the section is not shown.
    host.replaceChildren();
    host.hidden = true;
    return;
  } else {
    rows.forEach(([label, value]) => {
      const row = documentRef.createElement('div');
      const labelNode = documentRef.createElement('b');
      labelNode.textContent = `${label}: `;
      row.append(labelNode, documentRef.createTextNode(value));
      body.appendChild(row);
    });
  }
  fold.append(heading, body);
  host.replaceChildren(fold);
  host.hidden = false;
}
