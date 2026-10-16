// P1743 (owner 2026-10-13): "테마 시나리오" on 테마 — every US and KR theme read by one rule (src/domain/scenarios/
// theme-playbook.js), so a sector rally, a pullback inside a long uptrend or a bottleneck theme is never a hand-written
// note. One visual (the momentum map: 6-month trend × 1-month move, coloured by the macro wind), a short reading (where
// strength moved and which combinations stand out), then folded per-stage cards with each theme's choices, opportunity
// cost, evidence lines, structural hypothesis and what would break it. Stock selection stays on 테마 상세 and 스크리너.
import { buildGroupStrength } from '../../domain/themes/group-strength.js';
import { krThemeArtifactRead } from '../../domain/themes/kr-themes.js';
import { buildThemePlaybook } from '../../domain/scenarios/theme-playbook.js';
import { THEME_STATES } from '../../domain/scenarios/analogs.js';
import { relativeBand } from '../../domain/themes/recent-check.js';
import { WIND_LABELS } from '../../domain/scenarios/exposures.js';
import { CHOICES } from '../../domain/market/macro-crossroads.js';
import { MACRO_HISTORY, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { crossroadsForRoot, refreshScenarioArtifacts } from './macro-crossroads.js';
import { setResearchHandoff } from '../../app/research-handoff.js';
import { readMarketRegime } from './market-regime.js';
import { el } from './dom.js';

const SVG = 'http://www.w3.org/2000/svg';
const pct = (value) => (value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`);
const mkt = (row) => (row.market === 'KR' ? '한국' : '미국'); // v57.54: '국내' read as ambiguous on a US-first screen
function svg(doc, tag, attrs = {}) {
  const node = doc.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

export function themePlaybookForRoot(root, store, { nowMs = Date.now() } = {}) {
  const rows = store?.getState?.()?.screener?.rows || [];
  const regime = readMarketRegime(root);
  const crossroads = crossroadsForRoot(root, { regime, nowMs });
  const usGroups = buildGroupStrength({ themes: root?.THEME_MAP || [], rows, sortKey: 'ret3m', now: nowMs }).groups || [];
  const krThemes = root?.KR_THEME_MAP && typeof root.KR_THEME_MAP === 'object' ? krThemeArtifactRead({ themeMap: root.KR_THEME_MAP, rows }).themes : [];
  const labels = Object.fromEntries((root?.THEME_MAP || []).map((theme) => [theme.id, theme.nameKr]));
  const credit = regime?.axes?.find((axis) => axis.id === 'credit')?.state || null;
  // v57.81: the shared close history lets each stage be read against the S&P 500 / KOSPI over the same windows.
  return { crossroads, playbook: buildThemePlaybook({ usGroups, krThemes, crossroads, credit, outcomes: root?._aioScenarioOutcomes || null, labels, history: Array.isArray(root?._aioHistory) ? root._aioHistory : null }) };
}

// Two drawings of the same map: the wide one (640 × 360) and a narrow one (320 × 300, fewer labels) shown when the
// section is under 600px wide (container query in regime-quality.css), so labels never render below 12px.
// v57.79: `labels` is the most labels a drawing carries (farthest from the centre first); the rest stay on hover/tap.
const MAP_SIZES = Object.freeze({ wide: { W: 640, H: 360, pad: 40, font: 13, labels: 8 }, narrow: { W: 320, H: 300, pad: 30, font: 13.5, labels: 4 } });
// Rough rendered width: Hangul is about one em, Latin, digits and spaces about 0.6 em.
const isHangul = (ch) => { const c = ch.codePointAt(0); return (c >= 0x1100 && c <= 0x11ff) || (c >= 0x3131 && c <= 0x318e) || (c >= 0xac00 && c <= 0xd7a3); };
const textWidth = (text, font) => [...text].reduce((sum, ch) => sum + (isHangul(ch) ? font : font * 0.62), 0);

// v57.81: the map plots what the stage is read from — the gap to the index over the same window when it is known.
const mapX = (row) => row.relative?.trend ?? row.ret6m ?? row.ret3m;
const mapY = (row) => row.relative?.recent ?? row.ret1m;

/** Momentum map: x = long trend (6-month, KR 3-month), y = 1-month, both against the index; colour = wind under the lead branch. */
function momentumMap(doc, themes, size = 'wide', onPick = null) {
  const { W, H, pad, font, labels: maxLabels } = MAP_SIZES[size];
  const points = themes.filter((row) => mapY(row) != null && mapX(row) != null);
  const xs = points.map(mapX), ys = points.map(mapY);
  const span = (values) => Math.max(5, ...values.map((value) => Math.abs(value))) * 1.1;
  const sx = span(xs), sy = span(ys);
  const X = (value) => pad + (value + sx) / (2 * sx) * (W - 2 * pad), Y = (value) => H - pad - (value + sy) / (2 * sy) * (H - 2 * pad);
  const box = svg(doc, 'svg', { viewBox: `0 0 ${W} ${H}`, class: `tp-map is-${size}`, role: 'img', 'aria-label': `테마 ${points.length}개의 긴 추세와 최근 1개월 움직임 지도` });
  box.append(svg(doc, 'line', { x1: X(0), x2: X(0), y1: pad / 2, y2: H - pad / 2, class: 'tp-axis' }), svg(doc, 'line', { x1: pad / 2, x2: W - pad / 2, y1: Y(0), y2: Y(0), class: 'tp-axis' }));
  const corner = (text, x, y, anchor) => { const t = svg(doc, 'text', { x, y, 'text-anchor': anchor, class: 'tp-quad' }); t.textContent = text; box.append(t); };
  corner('주도 지속', W - pad / 2, pad / 2 + 4, 'end'); corner('추세 속 조정', W - pad / 2, H - pad / 2 - 2, 'end');
  corner('반등 시도', pad / 2, pad / 2 + 4, 'start'); corner('약세 지속', pad / 2, H - pad / 2 - 2, 'start');
  const axisLabel = svg(doc, 'text', { x: W / 2, y: H - 4, 'text-anchor': 'middle', class: 'tp-axis-label' }); axisLabel.textContent = points.some((row) => row.relative) ? '긴 추세, 지수 대비 (미국 6개월 · 한국 3개월) →' : '긴 추세 (미국 6개월 · 한국 3개월) →'; box.append(axisLabel);
  const yLabel = svg(doc, 'text', { x: 12, y: H / 2, 'text-anchor': 'middle', class: 'tp-axis-label', transform: `rotate(-90 12 ${H / 2})` }); yLabel.textContent = points.some((row) => row.relative) ? '1개월, 지수 대비 →' : '최근 1개월 →'; box.append(yLabel);
  // v57.79 (375 review): labels covered markers and each other. Only the themes farthest from the centre are labelled
  // (both axes scaled to the drawing), a label never sits on any marker, another label, a quadrant caption or an axis
  // title, and every point keeps its hover title; a tap prints the same line under the map.
  const marks = [];
  const describe = (row) => `[${mkt(row)}] ${row.label}: ${row.stateLabel.split(' (')[0]} · 1개월 ${pct(row.ret1m)} · 긴 추세 ${pct(row.ret6m ?? row.ret3m)}${row.relative ? ` (${row.relative.name} 대비 ${pct(row.relative.recent)}p · ${pct(row.relative.trend)}p)` : ''}${row.ret5d != null ? ` · 5거래일 ${pct(row.ret5d)}` : ''} · ${WIND_LABELS[row.wind.lead]}`;
  const located = points.map((row) => {
    const x = X(mapX(row)), y = Y(mapY(row));
    const mark = row.market === 'KR' ? svg(doc, 'rect', { x: x - 5, y: y - 5, width: 10, height: 10, class: `tp-dot is-${row.wind.lead}` }) : svg(doc, 'circle', { cx: x, cy: y, r: 6, class: `tp-dot is-${row.wind.lead}` });
    const title = svg(doc, 'title'); title.textContent = describe(row);
    mark.append(title); box.append(mark);
    if (onPick) mark.addEventListener('click', () => onPick(describe(row)));
    marks.push({ x0: x - 7, x1: x + 7, y0: y - 7, y1: y + 7 });
    return { row, x, y, distance: Math.hypot(mapX(row) / sx, mapY(row) / sy) };
  });
  const wanted = located.sort((a, b) => b.distance - a.distance).map(({ row, x, y }) => ({ x, y, text: `${row.market === 'KR' ? '한국 ' : ''}${row.label.split(/[ /]/)[0]}` }));
  const placed = [
    { x0: W - pad / 2 - font * 7, x1: W, y0: 0, y1: pad / 2 + 8 }, { x0: W - pad / 2 - font * 8.5, x1: W, y0: H - pad / 2 - font - 4, y1: H },
    { x0: 0, x1: pad / 2 + font * 7, y0: 0, y1: pad / 2 + 8 }, { x0: 0, x1: pad / 2 + font * 7, y0: H - pad / 2 - font - 4, y1: H },
    { x0: W / 2 - font * 9, x1: W / 2 + font * 9, y0: H - font - 6, y1: H }, { x0: 0, x1: 20, y0: H / 2 - font * 4, y1: H / 2 + font * 4 }
  ];
  const hits = (a) => placed.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) || marks.some((b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0);
  let count = 0;
  for (const label of wanted) {
    if (count >= maxLabels) break;
    const w = textWidth(label.text, font) + 4, h = font + 5;
    const options = [[label.x + 8, label.y + 4, 'start'], [label.x - 8, label.y + 4, 'end'], [label.x, label.y - 10, 'middle'], [label.x, label.y + 18, 'middle']];
    for (const [tx, ty, anchor] of options) {
      const x0 = anchor === 'start' ? tx : anchor === 'end' ? tx - w : tx - w / 2;
      const rect = { x0, x1: x0 + w, y0: ty - h + 3, y1: ty + 3 };
      if (rect.x0 < 0 || rect.x1 > W || rect.y0 < 0 || rect.y1 > H || hits(rect)) continue;
      placed.push(rect);
      count += 1;
      const t = svg(doc, 'text', { x: tx, y: ty, 'text-anchor': anchor, class: 'tp-label' }); t.textContent = label.text; box.append(t);
      break;
    }
  }
  return box;
}

function legend(doc) {
  const row = el(doc, 'div', null, 'tp-legend');
  for (const key of ['tail', 'head', 'mixed', 'none']) { const item = el(doc, 'span', null, 'tp-legend-item'); item.append(el(doc, 'span', null, `tp-swatch is-${key}`), doc.createTextNode(WIND_LABELS[key])); row.append(item); }
  row.append(el(doc, 'span', '원: 미국 · 네모: 한국 · 중심 시나리오 기준', 'tp-legend-note'));
  return row;
}

// The sector most of a theme's priced members belong to (at least half of them), for the screener handoff. KR members
// also carry one member ticker so the screener opens its Korean listing (screener.js reads a KRX ticker as KR).
function screenerSectorFor(root, store) {
  const rows = store?.getState?.()?.screener?.rows || [];
  const bySymbol = new Map(rows.filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  return (theme) => {
    const symbols = theme.market === 'KR'
      ? (root?.KR_THEME_MAP?.[theme.id] || []).flatMap((member) => [`${member?.code}.KS`, `${member?.code}.KQ`])
      : (root?.THEME_MAP || []).find((item) => item.id === theme.id)?.subThemes?.flatMap((sub) => sub?.tickers || []) || [];
    const members = [...new Set(symbols.map((sym) => String(sym).toUpperCase()))].map((sym) => bySymbol.get(sym)).filter((row) => row?.sector);
    if (members.length < 3) return null;
    const counts = new Map();
    for (const row of members) counts.set(row.sector, (counts.get(row.sector) || 0) + 1);
    const [sector, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (count * 2 < members.length) return null;
    return theme.market === 'KR' ? { sector, ticker: String(members.find((row) => row.sector === sector).sym) } : { sector };
  };
}

function themeCard(doc, root, row, screenerSector = null) {
  const card = el(doc, 'details', null, 'tp-card');
  card.dataset.theme = `${row.market}:${row.id}`;
  const summary = el(doc, 'summary', null, 'tp-card-summary');
  summary.append(el(doc, 'span', `${mkt(row)} · ${row.label}`, 'tp-card-title'), el(doc, 'span', `1개월 ${pct(row.ret1m)}${row.ret5d != null ? ` · 5거래일 ${pct(row.ret5d)}` : ''}`, 'tp-card-num'),
    el(doc, 'span', WIND_LABELS[row.wind.lead], `xr-tag is-wind-${row.wind.lead}`), el(doc, 'span', `유리: ${row.favored.map((key) => CHOICES[key]).join(' · ') || '보류'}`, 'xr-tag is-choice'));
  card.append(summary);
  card.append(el(doc, 'p', `${row.stateLabel} · ${row.ret3m != null ? `3개월 ${pct(row.ret3m)}` : ''}${row.ret6m != null ? ` · 6개월 ${pct(row.ret6m)}` : ''}${row.above50 != null ? ` · 50일선 위 ${row.above50}%` : ''}${row.tagLabels.length ? ` · 성격: ${row.tagLabels.join(', ')}` : ''}`, 'xr-basis'));
  card.append(el(doc, 'p', `거시 영향: ${row.windText}.`, 'xr-reading'));
  const evidence = el(doc, 'ul', null, 'xr-evidence');
  // v57.79: the positioning caveat is the same for every theme, so it is said once in the section's basis line.
  evidence.append(el(doc, 'li', `조건: ${row.fit} — ${row.basisText.join(' · ')}`), el(doc, 'li', `과거 빈도: ${row.past}`));
  card.append(el(doc, 'h4', '판단 근거', 'xr-h4'), evidence);
  if (row.thesis) {
    card.append(el(doc, 'h4', '핵심 논리와 점검 신호', 'xr-h4'), el(doc, 'p', `${row.thesis}. 논리가 깨지는 신호: ${row.breaks.join(', ')}.`, 'xr-reading'));
  }
  card.append(el(doc, 'h4', '이 단계의 대응별 득실', 'xr-h4'));
  const table = el(doc, 'div', null, 'xr-choices');
  for (const [key, text] of Object.entries(row.choices)) {
    const line = el(doc, 'div', null, 'xr-choice');
    if (row.favored.includes(key)) line.dataset.favored = 'true';
    line.append(el(doc, 'span', CHOICES[key], 'xr-choice-name'), el(doc, 'span', text, 'xr-choice-text'));
    if (row.favored.includes(key)) line.append(el(doc, 'span', '상대적으로 유리', 'xr-choice-flag'));
    table.append(line);
  }
  card.append(table, el(doc, 'p', row.favoredWhy, 'xr-reading'));
  const explore = el(doc, 'div', null, 'xr-explore');
  explore.append(el(doc, 'span', '종목은 직접 보기:', 'xr-explore-label'));
  const link = (label, onClick) => { const b = el(doc, 'button', `${label} →`, 'flow-next-link'); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  if (row.market === 'US' && typeof root?.showThemeDetail === 'function') {
    const detail = link('테마 상세 · 구성 종목', () => root.showThemeDetail(row.id));
    detail.dataset.themeId = row.id; // the 테마 page places the detail panel right after this section (themes.js trigger rule)
    explore.append(detail);
  }
  if (row.market === 'KR') explore.append(link('한국 테마 흐름', () => {
    // The KR theme read sits inside a fold that starts closed: open it before scrolling to it.
    const target = doc.getElementById('kr-themes-artifact-read');
    const fold = doc.getElementById('kr-integrated-themes') || target?.closest?.('details');
    if (fold) fold.open = true;
    target?.scrollIntoView?.({ block: 'start' });
  }));
  // The screener opens on the theme's dominant sector (the same typed handoff the sector rotation uses).
  const sector = screenerSector?.(row) || null;
  const screener = link('스크리너', () => {
    if (sector) setResearchHandoff({ root, routeId: 'screener', context: sector, label: `${mkt(row)} ${row.label}` });
    root?.showPage?.('screener');
  });
  if (sector) screener.title = `${row.label} 구성 종목이 가장 많은 섹터(${sector.sector})부터 엽니다`;
  explore.append(screener);
  card.append(explore);
  return card;
}

export function renderThemePlaybook({ documentRef: doc, root, store } = {}) {
  if (!doc) return null;
  let host = doc.getElementById('theme-playbook');
  if (!host) {
    const before = doc.getElementById('theme-strength-board');
    if (!before) return null;
    const section = el(doc, 'section', null, 'aio-section tp-section');
    section.setAttribute('aria-labelledby', 'theme-playbook-title');
    const title = el(doc, 'h2', '테마 시나리오 — 단계와 거시 영향', 'briefing-h2');
    title.id = 'theme-playbook-title';
    host = el(doc, 'div');
    host.id = 'theme-playbook';
    section.append(title, host);
    before.insertAdjacentElement('beforebegin', section);
  }
  if (!host.dataset.aioScenarioLoad) {
    host.dataset.aioScenarioLoad = 'on';
    const repaint = () => renderThemePlaybook({ documentRef: doc, root, store });
    refreshScenarioArtifacts(root, repaint);
    refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => { if (changed) repaint(); }).catch(() => {});
  }
  const { crossroads, playbook } = themePlaybookForRoot(root, store);
  root.__aioThemePlaybook = playbook;
  if (!playbook.available) { host.replaceChildren(el(doc, 'p', '테마 수익률(스크리너)을 받으면 모든 테마를 같은 규칙으로 읽습니다.', 'xr-basis')); return playbook; }
  const openIds = new Set([...host.querySelectorAll('.tp-card[open]')].map((node) => node.dataset.theme));
  const openStages = new Set([...host.querySelectorAll('.tp-stage[open]')].map((node) => node.dataset.stage));
  const lead = crossroads?.items?.find((item) => item.id === crossroads.leadId);
  const [headline, ...restOfRotation] = playbook.rotation.text.split(/(?<=니다\.)\s+/);
  const reading = [headline, ...(restOfRotation.length ? [restOfRotation.join(' ')] : [])];
  const h = playbook.highlights;
  // v57.81 (audit): no action suggestion in the reading ("분할 접근의 부담이 비교적 작은 경우" was one), and leaders are
  // only those that pass the index-relative, confirmed stage — each named with its last five sessions.
  if (h.structuralPullbacks.length) reading.push(`긴 추세는 지수보다 앞서 있는데 최근 1개월 뒤처졌고 중심 시나리오에서 역풍이 아닌 테마: ${h.structuralPullbacks.slice(0, 6).map((row) => `${mkt(row)} ${row.label}(${pct(row.ret1m)})`).join(', ')} — 핵심 논리가 깨지는 신호가 없는지 함께 봅니다.`);
  if (h.headwindLeaders.length) reading.push(`거시 부담에도 주도하는 테마(6개월·1개월 지수 대비, 최근 5거래일 확인): ${h.headwindLeaders.slice(0, 4).map((row) => `${mkt(row)} ${row.label}${row.ret5d != null ? `(5거래일 ${pct(row.ret5d)})` : ''}`).join(', ')} — 업종 고유 동력(실적·구조 수요)이 있는지 확인이 필요합니다.`);
  if (h.tailwindLaggards.length) reading.push(`거시 수혜에도 약세인 테마: ${h.tailwindLaggards.slice(0, 4).map((row) => `${mkt(row)} ${row.label}`).join(', ')} — 업종 고유의 문제가 있는지 먼저 봅니다.`);
  const basis = el(doc, 'p', `${playbook.asOfText || `${playbook.asOf ? `${playbook.asOf} ` : ''}확정 종가`} · 테마 ${playbook.themes.length}개${playbook.rotation?.market === '한국' ? ' (미국 테마 수익률을 받기 전이라 한국만)' : ''} · ${lead ? `중심 시나리오 '${lead.title.split(' — ')[0]}' 기준` : '중심 시나리오 미정'}. 단계는 6개월(한국 3개월)·1개월 수익률을 같은 기간 지수(미국 S&P 500 · 한국 코스피)와 비교해 정하고(1개월 ±${relativeBand('ret1m')}%p, 6개월 ±${relativeBand('ret6m')}%p 안의 차이는 앞선 것으로 보지 않음), 최근 5거래일이 평소 1주 움직임의 2배를 넘게 반대로 움직이면 1개월 판정을 보류합니다. 수혜·부담은 테마 성격이 중심 시나리오에 유리한지 불리한지로 정합니다. 확률 숫자·가격·종목 지시는 쓰지 않습니다. 레버리지·포지션 쏠림을 직접 재는 자료는 없어 가격 단서(1개월 낙폭·50일선 위 비율)로만 봅니다.`, 'xr-basis');
  const screenerSector = screenerSectorFor(root, store);
  const mapWrap = el(doc, 'div', null, 'tp-map-wrap');
  const pick = el(doc, 'p', null, 'tp-pick');
  pick.setAttribute('aria-live', 'polite');
  pick.hidden = true;
  const onPick = (text) => { pick.textContent = text; pick.hidden = false; };
  mapWrap.append(momentumMap(doc, playbook.themes, 'wide', onPick), momentumMap(doc, playbook.themes, 'narrow', onPick), pick);
  const stages = Object.keys(THEME_STATES).map((stage) => {
    const list = playbook.themes.filter((row) => row.state === stage).sort((a, b) => b.ret1m - a.ret1m);
    if (!list.length) return null;
    const fold = el(doc, 'details', null, 'tp-stage');
    fold.dataset.stage = stage;
    fold.open = openStages.has(stage);
    fold.append(el(doc, 'summary', `${THEME_STATES[stage]} · ${list.length}개`, 'tp-stage-summary'));
    for (const row of list) { const card = themeCard(doc, root, row, screenerSector); card.open = openIds.has(card.dataset.theme); fold.append(card); }
    return fold;
  }).filter(Boolean);
  // v57.88 (screen audit): a theme whose stage is held (state null — e.g. 한국 원전·건설, where the largest-traded names
  // disagree with the median) left every group, so "테마 46개" listed 43. It gets its own group with the hold reason.
  const held = playbook.themes.filter((row) => !THEME_STATES[row.state]).sort((a, b) => (b.ret1m ?? -Infinity) - (a.ret1m ?? -Infinity));
  if (held.length) {
    const fold = el(doc, 'details', null, 'tp-stage');
    fold.dataset.stage = 'held';
    fold.open = openStages.has('held');
    fold.append(el(doc, 'summary', `판정 보류 · ${held.length}개`, 'tp-stage-summary'));
    for (const row of held) { const card = themeCard(doc, root, row, screenerSector); card.open = openIds.has(card.dataset.theme); fold.append(card); }
    stages.push(fold);
  }
  host.replaceChildren(el(doc, 'p', reading[0], 'xr-lead'), basis, mapWrap, legend(doc), ...reading.slice(1).map((text) => el(doc, 'p', text, 'xr-reading')), ...stages,
    el(doc, 'p', '세부 종목 선택은 테마 상세·차트·재무 공시·스크리너에서 직접 합니다.', 'xr-caveat'));
  host.dataset.aioThemePlaybook = 'native';
  return playbook;
}

/** Inside the theme detail panel: this theme's stage, wind and choices, tied back to the full sections. */
export function renderThemeDetailPlaybook({ documentRef: doc, root } = {}) {
  const summary = doc?.getElementById('theme-detail-native-summary');
  if (!summary) return null;
  let host = doc.getElementById('theme-detail-native-playbook');
  // The theme's own read comes before "이어서 볼 곳" (themes.js leaves a placeholder ahead of that nav).
  if (!host) {
    host = el(doc, 'div', null, 'theme-detail-native-section tp-detail'); host.id = 'theme-detail-native-playbook';
    const next = doc.getElementById('theme-detail-next');
    if (next && summary.contains(next)) next.insertAdjacentElement('beforebegin', host); else summary.insertAdjacentElement('afterend', host);
  }
  const themeId = doc.getElementById('theme-detail-panel')?.dataset.currentTheme || root?._currentThemeId || null;
  const row = themeId ? root?.__aioThemePlaybook?.themes?.find((item) => item.market === 'US' && item.id === themeId) : null;
  host.hidden = !row;
  if (!row) { host.replaceChildren(); return null; }
  const link = (label, onClick) => { const b = el(doc, 'button', `${label} →`, 'flow-next-link'); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const links = el(doc, 'div', null, 'xr-explore');
  links.append(link('모든 테마 시나리오와 비교', () => doc.getElementById('theme-playbook-title')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })),
    link('거시 시나리오의 근거', () => { root?.showPage?.('macro'); setTimeout(() => doc.getElementById('macro-crossroads-title')?.scrollIntoView?.({ block: 'start' }), 60); }));
  host.replaceChildren(el(doc, 'h4', '이 테마의 시나리오', 'xr-h4'),
    el(doc, 'p', `${row.stateLabel}${row.stateLabel.includes('5거래일') || row.ret5d == null ? '' : ` · 5거래일 ${pct(row.ret5d)}`} · 1개월 ${pct(row.ret1m)}${row.ret6m != null ? ` · 6개월 ${pct(row.ret6m)}` : ''} · ${row.fit}`, 'xr-basis'),
    el(doc, 'p', `거시 영향: ${row.windText}. 유리한 대응: ${row.favored.map((key) => CHOICES[key]).join(' · ') || '판단 보류'} — ${row.favoredWhy}`, 'xr-reading'),
    ...(row.thesis ? [el(doc, 'p', `핵심 논리: ${row.thesis}. 점검 신호: ${row.breaks.join(', ')}.`, 'xr-reading')] : []),
    el(doc, 'p', '아래 구성 종목·대표 종목에서 추세가 살아 있는 종목을 직접 고릅니다.', 'xr-caveat'), links);
  return row;
}

