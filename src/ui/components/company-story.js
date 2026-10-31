// v59.43 (owner 2026-10-28): the researched company story inside 종목 요약's '무엇을 하는 회사' section. The face carries
// the one-line summary, the money-flow path and four numbers; each later step of the story folds below it (owner
// reading standard: one visual, a short reading, details on demand). Sources stay off the face (owner 2026-10-06) and
// are listed with their dates in the last fold.
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';
import {
  layerLabel, POSITION_LABEL, CASH_USE_LABEL, moneyText, amountScale, pctText, storyFreshness
} from '../../domain/entity/company-story.js';

const has = (value) => value != null && value !== '' && !(Array.isArray(value) && !value.length);
const mdOf = (date) => { const m = String(date || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${Number(m[1])}/${Number(m[2])}` : String(date || ''); };

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function list(doc, items, className) {
  const ul = el(doc, 'ul', null, className);
  for (const item of items || []) if (has(item)) ul.append(el(doc, 'li', item));
  return ul;
}
function fold(doc, title, className = '') {
  const box = el(doc, 'details', null, `company-story-fold ${className}`.trim());
  box.append(el(doc, 'summary', title));
  return box;
}
function pair(doc, title, child) {
  const box = el(doc, 'div', null, 'company-story-cell');
  box.append(el(doc, 'h4', title), child);
  return box;
}
function signed(value) {
  const v = Number(value);
  return Number.isFinite(v) ? `${v > 0 ? '+' : ''}${pctText(v)}` : null;
}
function table(doc, head, rows) {
  const wrap = el(doc, 'div', null, 'company-story-table');
  const t = el(doc, 'table');
  const tr = el(doc, 'tr');
  head.forEach((label) => tr.append(el(doc, 'th', label)));
  const thead = el(doc, 'thead'); thead.append(tr);
  const tbody = el(doc, 'tbody');
  for (const cells of rows) { const row = el(doc, 'tr'); cells.forEach((cell) => row.append(el(doc, 'td', cell ?? '—'))); tbody.append(row); }
  t.append(thead, tbody); wrap.append(t);
  return wrap;
}

function moneyFlow(doc, profile) {
  const steps = profile.moneyFlow?.steps || [];
  if (!steps.length) return null;
  const flow = el(doc, 'ol', null, 'company-story-flow');
  flow.setAttribute('aria-label', '돈이 들어오는 길');
  for (const hop of steps) {
    const li = el(doc, 'li', null, 'company-story-hop');
    li.append(el(doc, 'span', hop.from, 'company-story-who'), el(doc, 'span', '→', 'company-story-arrow'), el(doc, 'span', hop.to, 'company-story-who'), el(doc, 'span', hop.what, 'company-story-what'));
    flow.append(li);
  }
  return flow;
}

function kpis(doc, earnings) {
  const e = earnings || {};
  const fcf = e.freeCashFlow?.value != null;
  const cells = [
    ['매출', e.revenue ? moneyText(e.revenue.value, e.revenue.unit) : null, e.revenue?.yoy],
    ['매출총이익률', pctText(e.grossMargin)], ['영업이익률', pctText(e.operatingMargin)],
    [fcf ? '잉여현금흐름' : '순이익률', fcf ? moneyText(e.freeCashFlow.value, e.freeCashFlow.unit) : pctText(e.netMargin)]
  ].filter(([, value]) => value);
  if (!cells.length) return null;
  const row = el(doc, 'div', null, 'company-story-kpis');
  for (const [label, value, yoy] of cells) {
    const cell = el(doc, 'div', null, 'company-story-kpi');
    cell.append(el(doc, 'strong', value), el(doc, 'span', yoy != null ? `${label}, 전년 대비 ${signed(yoy)}` : label));
    row.append(cell);
  }
  return row;
}

function segmentBars(doc, earnings) {
  const segs = (earnings?.segments || []).map((s) => ({ ...s, scale: amountScale(s.revenue, s.unit) })).filter((s) => s.scale > 0);
  if (!segs.length) return null;
  // v59.45 (pipeline review P25-STORY-03): bars compare amounts of one currency only, an unknown share (null) prints no
  // percentage instead of 0%, and a share the file does not give is read against the company's revenue, not against
  // the listed segments' sum (a partial list read as the whole company).
  const currencyOf = (unit) => (String(unit || '').match(/^[A-Z]{3}/i)?.[0] || '').toUpperCase();
  if (new Set(segs.map((s) => currencyOf(s.unit))).size > 1) return null;
  const max = Math.max(...segs.map((s) => s.scale));
  const revenueScale = currencyOf(earnings?.revenue?.unit) === currencyOf(segs[0].unit) ? amountScale(earnings?.revenue?.value, earnings?.revenue?.unit) : null;
  const shareOf = (s) => (s.share === null ? null : s.share !== undefined && s.share !== '' && Number.isFinite(Number(s.share)) ? Number(s.share)
    : revenueScale > 0 ? (s.scale / revenueScale) * 100 : null);
  const box = el(doc, 'div', null, 'company-story-bars');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `사업부별 매출: ${segs.map((s) => `${s.name} ${moneyText(s.revenue, s.unit)}`).join(', ')}`);
  for (const s of segs) {
    const row = el(doc, 'div', null, 'company-story-bar');
    const track = el(doc, 'span', null, 'company-story-track');
    const fill = el(doc, 'span', null, 'company-story-fill');
    fill.style.width = `${((s.scale / max) * 100).toFixed(1)}%`;
    track.append(fill);
    const share = shareOf(s);
    row.append(el(doc, 'span', s.name, 'company-story-bar-name'), track, el(doc, 'span', `${moneyText(s.revenue, s.unit)}${share != null ? `, ${Math.round(share)}%` : ''}${s.yoy != null ? `, ${signed(s.yoy)}` : ''}`, 'company-story-bar-value'));
    box.append(row);
  }
  return box;
}

function cashStack(doc, useOfCash) {
  const items = (useOfCash?.items || []).map((x) => ({ ...x, scale: amountScale(x.value, x.unit) })).filter((x) => x.scale > 0);
  if (!items.length) return null;
  const total = items.reduce((sum, x) => sum + x.scale, 0);
  const box = el(doc, 'div', null, 'company-story-cash');
  const bar = el(doc, 'div', null, 'company-story-stack');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `현금 사용: ${items.map((x) => `${x.label || CASH_USE_LABEL[x.use] || x.use} ${moneyText(x.value, x.unit)}`).join(', ')}`);
  const legend = el(doc, 'ul', null, 'company-story-legend');
  items.forEach((x, i) => {
    const seg = el(doc, 'span', null, `company-story-seg company-story-seg--${i % 7}`);
    seg.style.width = `${((x.scale / total) * 100).toFixed(2)}%`;
    bar.append(seg);
    const li = el(doc, 'li');
    li.append(el(doc, 'i', null, `company-story-seg--${i % 7}`), doc.createTextNode(`${x.label || CASH_USE_LABEL[x.use] || x.use} ${moneyText(x.value, x.unit)}`));
    legend.append(li);
  });
  box.append(bar, legend);
  return box;
}

/**
 * Paints the story into `host` (replacing its children after the heading the caller owns).
 * @param {{ profile: object, earnings?: Array, peers?: Array<{symbol:string,name?:string,layer?:string}>, openTicker?: Function }} ctx
 */
export function renderCompanyStory(doc, host, { profile, earnings = [], peers = [], openTicker = null }) {
  if (!doc || !host || !profile) return null;
  const nodes = [];
  const ai = profile.aiChain || {};
  const e = profile.earnings || {};
  const freshness = storyFreshness(profile, earnings);
  nodes.push(el(doc, 'p', profile.oneLine, 'company-story-one'));
  const meta = [ai.layer && layerLabel(ai.layer) ? `AI 밸류체인: ${layerLabel(ai.layer)}` : null,
    freshness.researchedAt ? `${mdOf(freshness.researchedAt)} 조사` : null, e.period ? `${e.period} 실적 기준` : null].filter(Boolean).join(', ');
  if (meta) nodes.push(el(doc, 'p', meta, 'company-story-meta'));
  if (freshness.state === 'stale') nodes.push(el(doc, 'p', `${mdOf(freshness.newReport)} 새 실적이 나왔습니다. 사업 구조·경쟁 설명은 그대로 쓰되, 실적·가이던스 숫자는 그 전 보고서 기준이니 새 숫자는 '최근 실적 발표 요약'에서 보세요.`, 'company-story-stale'));

  const flow = moneyFlow(doc, profile);
  if (flow) nodes.push(el(doc, 'h3', '돈이 들어오는 길', 'company-story-h3'), flow);
  if (has(profile.moneyFlow?.pricing)) nodes.push(el(doc, 'p', `과금 방식: ${profile.moneyFlow.pricing}`, 'company-story-small'));
  const numbers = kpis(doc, e);
  if (numbers) nodes.push(numbers);

  // 1. technology → design → make → sell
  const how = fold(doc, '무엇으로 이기고, 누가 만들어, 누구에게 파나');
  const grid = el(doc, 'div', null, 'company-story-grid');
  for (const [title, block, extra] of [['기술·해자', profile.moat, profile.moat?.sources], ['설계·제공', profile.design], ['생산', profile.make, profile.make?.partners?.slice(0, 4)], ['판매', profile.sell, profile.sell?.customers?.slice(0, 4)]]) {
    if (!block?.text && !has(extra)) continue;
    const cell = el(doc, 'div', null, 'company-story-cell');
    cell.append(el(doc, 'h4', title));
    if (block?.text) cell.append(el(doc, 'p', block.text));
    if (has(extra)) cell.append(list(doc, extra));
    grid.append(cell);
  }
  how.append(grid);
  if (has(profile.moneyFlow?.text)) how.append(el(doc, 'p', profile.moneyFlow.text));
  if (has(profile.sell?.concentration)) how.append(el(doc, 'p', `고객 집중: ${profile.sell.concentration}`, 'company-story-small'));
  nodes.push(how);

  // 2. earnings and use of cash
  const earn = fold(doc, `얼마나 벌고, 번 돈을 어디에 쓰나${e.period ? ` (${e.period})` : ''}`);
  const bars = segmentBars(doc, e);
  if (bars) earn.append(el(doc, 'h4', '사업부별 매출'), bars);
  if (has(e.industryMetric)) earn.append(pair(doc, '이 업종이 평가받는 숫자', list(doc, e.industryMetric.map((m) => `${m.name}: ${m.value}`))));
  if (has(e.text)) earn.append(el(doc, 'p', e.text));
  const cash = cashStack(doc, profile.useOfCash);
  if (cash) earn.append(el(doc, 'h4', `현금을 쓴 곳${profile.useOfCash?.period ? ` (${profile.useOfCash.period})` : ''}`), cash);
  if (has(profile.useOfCash?.text)) earn.append(el(doc, 'p', profile.useOfCash.text));
  nodes.push(earn);

  // 3. AI value chain
  const chain = fold(doc, `AI 밸류체인 속 위치${ai.layer && layerLabel(ai.layer) ? `: ${layerLabel(ai.layer)}` : ''}`);
  if (has(ai.position)) chain.append(el(doc, 'p', ai.position));
  const chainGrid = el(doc, 'div', null, 'company-story-grid');
  if (has(ai.dependsOn)) chainGrid.append(pair(doc, '필요로 하는 곳 (위쪽)', list(doc, ai.dependsOn)));
  if (has(ai.sellsTo)) chainGrid.append(pair(doc, '사 주는 곳 (아래쪽)', list(doc, ai.sellsTo)));
  if (has(ai.upside)) chainGrid.append(pair(doc, 'AI가 실적에 닿는 길', el(doc, 'p', ai.upside)));
  if (has(ai.risk)) chainGrid.append(pair(doc, 'AI가 위협이 되는 경우', el(doc, 'p', ai.risk)));
  if (chainGrid.childNodes.length) chain.append(chainGrid);
  if (has(ai.aiRevenue)) chain.append(el(doc, 'p', `공개된 AI 관련 수치: ${ai.aiRevenue}`, 'company-story-small'));
  const samePeers = peers.filter((row) => row.layer === ai.layer && String(row.symbol).toUpperCase() !== String(profile.symbol).toUpperCase());
  if (samePeers.length && typeof openTicker === 'function') {
    const row = el(doc, 'div', null, 'company-story-peers');
    row.append(el(doc, 'span', '같은 층의 기업', 'company-story-small'));
    for (const peer of samePeers.slice(0, 12)) {
      const button = el(doc, 'button', peer.symbol); button.type = 'button'; if (peer.name) button.title = peer.name;
      button.addEventListener('click', () => openTicker(peer.symbol));
      row.append(button);
    }
    chain.append(row);
  }
  nodes.push(chain);

  // 4. competition
  const comp = profile.competition || {};
  const compFold = fold(doc, '누구와 겨루나');
  if (has(comp.arenas)) compFold.append(table(doc, ['시장', '위치', '경쟁자', '점유율'], comp.arenas.map((a) => [a.arena, POSITION_LABEL[a.position] || a.position || null, (a.rivals || []).join(', '), a.share || null])));
  const compGrid = el(doc, 'div', null, 'company-story-grid');
  if (has(comp.edge)) compGrid.append(pair(doc, '지금 이기는 이유', el(doc, 'p', comp.edge)));
  if (has(comp.threats)) compGrid.append(pair(doc, '점유율을 뺏길 수 있는 길', el(doc, 'p', comp.threats)));
  if (compGrid.childNodes.length) compFold.append(compGrid);
  if (has(comp.text)) compFold.append(el(doc, 'p', comp.text));
  nodes.push(compFold);

  // 5. roadmap and guidance
  const st = profile.strategy || {}, gd = profile.guidance || {};
  const next = fold(doc, '앞으로 무엇을 하나');
  if (has(st.goal)) next.append(el(doc, 'p', st.goal));
  if (has(st.roadmap)) {
    const road = el(doc, 'ol', null, 'company-story-road');
    for (const m of st.roadmap) { const li = el(doc, 'li'); li.append(el(doc, 'strong', m.when), doc.createTextNode(` ${m.what}`)); road.append(li); }
    next.append(road);
  }
  if (has(st.vision)) next.append(el(doc, 'p', st.vision));
  if (has(gd.latest)) next.append(el(doc, 'h4', '회사가 밝힌 전망'), table(doc, ['기간', '항목', '회사가 밝힌 숫자', '발표일'], gd.latest.map((x) => [x.period, x.metric, x.value, x.givenOn ? mdOf(x.givenOn) : null])));
  if (has(gd.track)) next.append(el(doc, 'p', gd.track, 'company-story-small'));
  if (has(profile.estimates?.text)) next.append(el(doc, 'p', `시장 예상: ${profile.estimates.text}`, 'company-story-small'));
  nodes.push(next);

  // 6. what to watch, and how a trader uses it (conditions, never orders)
  const w = profile.watch || {}, t = profile.trading || {};
  const watch = fold(doc, '이야기가 맞는지 확인하는 법');
  const watchGrid = el(doc, 'div', null, 'company-story-grid');
  if (has(w.confirms)) watchGrid.append(pair(doc, '맞아가고 있다는 신호', list(doc, w.confirms)));
  if (has(w.breaks)) watchGrid.append(pair(doc, '어긋나고 있다는 신호', list(doc, w.breaks)));
  if (watchGrid.childNodes.length) watch.append(watchGrid);
  if (has(w.keyNumbers)) watch.append(pair(doc, '분기마다 볼 숫자', list(doc, w.keyNumbers.map((m) => `${m.name}: ${m.why}`))));
  // v59.45 (pipeline review P25-STORY-03): a dated event already past is not "다가오는"; undated ("2027 상반기") stays.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (t.calendar || []).filter((x) => !hasLeadingIsoDay(x?.date || '') || String(x.date).slice(0, 10) >= today);
  if (has(upcoming)) watch.append(pair(doc, '다가오는 일정', list(doc, upcoming.map((x) => `${hasLeadingIsoDay(x.date || '') ? mdOf(x.date) : x.date} ${x.event}`))));
  if (has(t.reaction)) watch.append(pair(doc, '실적 발표 때 주가가 반응하는 것', el(doc, 'p', t.reaction)));
  if (has(t.conditions)) watch.append(pair(doc, '매매할 때 함께 확인하는 조건', list(doc, t.conditions)));
  watch.append(el(doc, 'p', '조건을 확인하는 틀이며, 사고팔 가격이나 시점을 제시하지 않습니다.', 'company-story-small'));
  nodes.push(watch);

  if (has(profile.governance?.line)) nodes.push(el(doc, 'p', `경영·지배구조: ${profile.governance.line}`, 'company-story-small'));

  const sources = fold(doc, `근거 자료 ${profile.sources.length}개${has(profile.unverified) ? `, 확인하지 못해 비워 둔 값 ${profile.unverified.length}개` : ''}`, 'company-story-sources');
  const ol = el(doc, 'ol');
  for (const s of profile.sources) {
    const li = el(doc, 'li');
    const link = el(doc, 'a', s.title || s.publisher || '원문');
    if (/^https:\/\//.test(s.url || '')) { link.href = s.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    li.append(link, doc.createTextNode(`, ${[s.publisher, s.date].filter(Boolean).join(', ')}`));
    ol.append(li);
  }
  sources.append(ol);
  if (has(profile.unverified)) sources.append(pair(doc, '확인하지 못한 값', list(doc, profile.unverified)));
  nodes.push(sources);

  host.append(...nodes);
  host.dataset.companyStory = profile.symbol;
  return { freshness, layer: ai.layer || null };
}
