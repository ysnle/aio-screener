// 종목 개요: one question — "이 회사는 무엇으로 돈을 벌고 산업의 어디에 있는가". Three sections, top to
// bottom, nothing folded but 원자료 표 / 계산 방법 / 데이터 출처 (indicator-face.js kindFold):
//   사업 — what it sells, to whom, what drives revenue (the researched company story; without one, the listing facts);
//   밸류체인 안의 자리 — the AI map layer, the customers and suppliers the stories name, the capital flows it is a party to,
//     and one link into the map (a company outside the map gets one line);
//   재무 한눈에 — the figures that say whether it makes money, each a number with a fixed state word, the standing among
//     named theme peers, and the way to 재무 공시.
// 쟁점과 전망 is the screen's next view, its own question — "무엇이 다투어지고 무엇이 보는 눈을 바꾸나":
// the issue the stock turns on and its two readings, the structures under the numbers, the company's outlook and the
// signals that the story holds or breaks. 개요 ends on one line to it.
// 사업 also carries how it competes and what AI does to it; 밸류체인 안의 자리 its partners and the link to the library's
// reading of its industry.
// The facts come from src/domain/entity/company-overview.js and the story file; this module only lays them out. Sources
// stay off the face; dates stay on the figures.
import { el } from './dom.js';
import { indicatorRow, kindFold, rawTable } from './indicator-face.js';
import { amountScale, moneyText, storyFreshness, CASH_USE_LABEL, POSITION_LABEL } from '../../domain/entity/company-story.js';
import { sectorLabel } from '../../domain/screener/sector-label.js';
import { readNumber, signedText } from '../../domain/shared/number.js';
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';
import { datedStory } from '../../domain/fundamental/research-text.js';

const has = (value) => value != null && value !== '' && !(Array.isArray(value) && !value.length);
const mdOf = (date) => (hasLeadingIsoDay(date) ? `${Number(String(date).slice(5, 7))}/${Number(String(date).slice(8, 10))}` : String(date || ''));
const signed = (value) => (readNumber(value) == null ? null : signedText(readNumber(value), 1, '%'));

function section(doc, id, title) {
  const box = el(doc, 'section', null, 'co-section');
  box.dataset.companySection = id;
  const head = el(doc, 'h2', title, 'co-section__title');
  head.id = `ticker-company-${id}`;
  box.setAttribute('aria-labelledby', head.id);
  box.append(head);
  return box;
}

function block(doc, title, ...nodes) {
  const box = el(doc, 'div', null, 'co-block');
  box.append(el(doc, 'h3', title, 'co-block__title'), ...nodes.filter(Boolean));
  return box;
}
function list(doc, items, className = 'co-list') {
  const ul = el(doc, 'ul', null, className);
  for (const item of items) if (has(item)) ul.append(typeof item === 'string' ? el(doc, 'li', item) : item);
  return ul;
}
// "when what" rows (a roadmap step, a deciding fact, an upcoming event): the date in bold.
function datedList(doc, rows) {
  return list(doc, rows.filter((row) => has(row?.what) || has(row?.event)).map((row) => {
    const li = el(doc, 'li');
    const when = hasLeadingIsoDay(row.when || row.date || '') ? mdOf(row.when || row.date) : (row.when || row.date || '');
    if (when) li.append(el(doc, 'b', when), doc.createTextNode(' '));
    li.append(doc.createTextNode(row.what || row.event));
    return li;
  }));
}
// Two (or more) titled readings side by side; text or a list each. Null when none has content.
function pairOf(doc, parts) {
  const cells = parts.filter(([, value]) => has(value)).map(([title, value]) => {
    const cell = el(doc, 'div', null, 'co-cell');
    cell.append(el(doc, 'h4', title, 'co-cell__title'), Array.isArray(value) ? list(doc, value) : el(doc, 'p', value, 'co-text'));
    return cell;
  });
  if (!cells.length) return null;
  const box = el(doc, 'div', null, 'co-pair');
  box.append(...cells);
  return box;
}

// Segment revenue as bars of one currency. An unknown share (null) prints no percentage, and a share the file does not
// give is read against the company's revenue, not the listed segments' sum.
export function segmentBars(doc, earnings) {
  const segs = (earnings?.segments || []).map((s) => ({ ...s, scale: amountScale(s.revenue, s.unit) })).filter((s) => s.scale > 0);
  if (!segs.length) return null;
  const currencyOf = (unit) => (String(unit || '').match(/^[A-Z]{3}/i)?.[0] || '').toUpperCase();
  if (new Set(segs.map((s) => currencyOf(s.unit))).size > 1) return null;
  const max = Math.max(...segs.map((s) => s.scale));
  const revenueScale = currencyOf(earnings?.revenue?.unit) === currencyOf(segs[0].unit) ? amountScale(earnings?.revenue?.value, earnings?.revenue?.unit) : null;
  const shareOf = (s) => (s.share === null ? null : readNumber(s.share) != null ? readNumber(s.share)
    : revenueScale > 0 ? (s.scale / revenueScale) * 100 : null);
  const box = el(doc, 'div', null, 'co-bars');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `사업부별 매출: ${segs.map((s) => `${s.name} ${moneyText(s.revenue, s.unit)}`).join(', ')}`);
  for (const s of segs) {
    const row = el(doc, 'div', null, 'co-bar');
    const track = el(doc, 'span', null, 'co-bar__track');
    const fill = el(doc, 'span', null, 'co-bar__fill');
    fill.style.width = `${((s.scale / max) * 100).toFixed(1)}%`;
    track.append(fill);
    const share = shareOf(s);
    row.append(el(doc, 'span', s.name, 'co-bar__name'), track, el(doc, 'span', `${moneyText(s.revenue, s.unit)}${share != null ? `, ${Math.round(share)}%` : ''}${s.yoy != null ? `, ${signed(s.yoy)}` : ''}`, 'co-bar__value'));
    box.append(row);
  }
  return box;
}

// ── 사업 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function businessSection(doc, { story, profile, freshness, inMap = false }) {
  const box = section(doc, 'business', '사업');
  if (story) {
    if (freshness?.state === 'stale') {
      const when = freshness.newReport ? `${mdOf(freshness.newReport)} 새 실적 발표` : `${Number(freshness.newQuarterEnd.slice(5, 7))}월 ${Number(freshness.newQuarterEnd.slice(8, 10))}일에 끝난 분기 공시`;
      box.append(el(doc, 'p', `${when} 이전 조사입니다. 아래 사업부 숫자는 그 전 보고서 기준이고, 새 숫자는 재무 한눈에와 재무 공시에 있습니다.`, 'co-stale'));
    }
    // The design text sometimes opens on the moat paragraph before it ("이런 생태계 위에서 …"); then that paragraph leads.
    const design = story.design?.text, moat = story.moat?.text;
    const what = has(design) && has(moat) && /^(이런|이러한|그런|이를|이|그)\s/.test(design) ? [moat, design] : [design || moat].filter(has);
    if (what.length) box.append(block(doc, '무엇을 파나', ...what.map((text) => el(doc, 'p', text, 'co-text'))));
    const sell = story.sell || {};
    const customers = (sell.customers || []).slice(0, 4);
    if (has(sell.text) || customers.length) {
      box.append(block(doc, '누구에게 파나', has(sell.text) ? el(doc, 'p', sell.text, 'co-text') : null, customers.length ? list(doc, customers) : null,
        has(sell.concentration) ? el(doc, 'p', `고객 집중: ${sell.concentration}`, 'co-text') : null));
    }
    const bars = segmentBars(doc, story.earnings);
    const flow = story.moneyFlow || {};
    if (has(flow.text) || bars) {
      box.append(block(doc, '매출을 움직이는 것', has(flow.text) ? el(doc, 'p', flow.text, 'co-text') : null,
        bars ? el(doc, 'p', `사업부별 매출${story.earnings?.period ? `, ${String(story.earnings.period).replace(/\s*\(.*$/, '')}` : ''}`, 'co-figure-title') : null, bars,
        has(flow.pricing) ? el(doc, 'p', `과금 방식: ${flow.pricing}`, 'co-text') : null));
    }
    const steps = flow.steps || [];
    if (steps.length) {
      const table = rawTable(doc, steps.map((hop) => [`${hop.from} → ${hop.to}`, hop.what]), '돈이 들어오는 길');
      box.append(kindFold(doc, 'raw-table', `돈이 들어오는 길 ${steps.length}단계`, [table]));
    }
    const make = story.make || {};
    const makers = (make.partners || []).slice(0, 6);
    if (has(make.text) || makers.length) box.append(block(doc, '누가 만드나', has(make.text) ? el(doc, 'p', make.text, 'co-text') : null, makers.length ? list(doc, makers) : null));
    const comp = story.competition || {};
    const compPair = pairOf(doc, [['지금 이기는 이유', comp.edge], ['점유율을 뺏길 수 있는 길', comp.threats]]);
    if (compPair || has(comp.text)) box.append(block(doc, '경쟁', compPair, has(comp.text) ? el(doc, 'p', comp.text, 'co-text') : null));
    const ai = story.aiChain || {};
    const aiPair = pairOf(doc, [['AI가 실적에 닿는 길', ai.upside], ['AI가 위협이 되는 경우', ai.risk]]);
    // A company on the AI map has its position under 밸류체인 안의 자리; one outside it reads it here.
    const aiPosition = !inMap && has(ai.position) ? el(doc, 'p', ai.position, 'co-text') : null;
    if (aiPair || aiPosition || has(ai.aiRevenue)) box.append(block(doc, 'AI', aiPosition, aiPair, has(ai.aiRevenue) ? el(doc, 'p', `공개된 AI 관련 수치: ${ai.aiRevenue}`, 'co-text') : null));
    return box;
  }
  // No researched story: only the listing's own facts.
  const facts = [['분류', profile?.kind], ['섹터', profile?.sector ? sectorLabel(profile.sector) : null], ['업종', profile?.industry]].filter(([, value]) => has(value));
  const factList = el(doc, 'dl', null, 'co-facts');
  for (const [label, value] of facts) factList.append(el(doc, 'dt', label), el(doc, 'dd', value));
  if (facts.length) box.append(factList);
  box.append(el(doc, 'p', profile?.description || '사업 설명 자료 없음', profile?.description ? 'co-text' : 'co-empty'));
  return box;
}

// ── 밸류체인 안의 자리 ────────────────────────────────────────────────────────────────────────────────────────────────
function nameChips(doc, rows, openTicker, limit = 6) {
  const box = el(doc, 'div', null, 'co-chips');
  for (const row of rows.slice(0, limit)) {
    const chip = el(doc, row.symbol && typeof openTicker === 'function' ? 'button' : 'span', row.symbol && row.name !== row.symbol ? `${row.name} ${row.symbol}` : row.name, 'sx-chip sx-chip--sm co-chip');
    // What the money pays for sits beside the name: one 사 주는 곳 list holds a foundry order and an ad-inventory payment.
    if (row.what) chip.append(el(doc, 'span', ` · ${row.what}`, 'co-chip__what'));
    if (chip.tagName === 'BUTTON') { chip.type = 'button'; chip.setAttribute('aria-label', `${row.name}${row.what ? `(${row.what})` : ''} 종목 개요 열기`); chip.addEventListener('click', () => openTicker(row.symbol)); }
    box.append(chip);
  }
  if (rows.length > limit) box.append(el(doc, 'span', `외 ${rows.length - limit}곳`, 'co-more'));
  return box;
}

// How this industry earns, cycles and misleads is the research library's 산업 지도 reading; the screen links to it.
function industryLink(doc, industry, openIndustry) {
  if (!industry || typeof openIndustry !== 'function') return null;
  const go = el(doc, 'button', '이 업종이 돌아가는 방식, 산업 지도에서 읽기 →', 'flow-next-link co-link');
  go.type = 'button';
  go.dataset.industryDomain = industry.domain;
  go.addEventListener('click', () => openIndustry(industry.domain));
  return go;
}

function placeSection(doc, { place, story, industry = null, openTicker, openMap, openIndustry }) {
  const box = section(doc, 'place', '밸류체인 안의 자리');
  if (!place?.inMap) {
    const rivals = (place?.rivals || []).slice(0, 4).map((row) => row.name);
    box.append(el(doc, 'p', `AI 밸류체인 지도에 없는 회사입니다${place?.storyLayerLabel ? `(회사 이야기 분류: ${place.storyLayerLabel})` : ''}.${rivals.length ? ` 같은 시장에서 겨루는 곳: ${rivals.join(', ')}.` : ''}`, 'co-text'));
    if (place?.partners?.length) box.append(block(doc, `함께 일하는 곳 ${place.partners.length}`, nameChips(doc, place.partners, openTicker)));
    const industryGo = industryLink(doc, industry, openIndustry);
    if (industryGo) box.append(industryGo);
    return box;
  }
  if (place.layer) {
    const where = el(doc, 'p', null, 'co-layer');
    where.append(el(doc, 'b', `${place.layer.n}층 ${place.layer.title}`), doc.createTextNode(` (${place.layer.desc})`));
    box.append(where);
  }
  if (has(place.position)) box.append(el(doc, 'p', place.position, 'co-text'));
  const pair = el(doc, 'div', null, 'co-pair');
  if (place.customers.length) pair.append(block(doc, `사 주는 곳 ${place.customers.length}`, nameChips(doc, place.customers, openTicker)));
  if (place.suppliers.length) pair.append(block(doc, `공급하는 곳 ${place.suppliers.length}`, nameChips(doc, place.suppliers, openTicker)));
  if (pair.childElementCount) box.append(pair);
  else if (place.layer) box.append(el(doc, 'p', '다른 조사 기업과 이어진 고객·공급처 없음', 'co-empty'));
  if (place.rivals.length) box.append(block(doc, `겨루는 곳 ${place.rivals.length}`, nameChips(doc, place.rivals, openTicker)));
  if (place.partners.length) box.append(block(doc, `함께 일하는 곳 ${place.partners.length}`, nameChips(doc, place.partners, openTicker)));
  if (place.capital.length) {
    const list = el(doc, 'ul', null, 'co-capital');
    for (const row of place.capital) {
      const item = el(doc, 'li', null, `co-capital__row is-${row.direction}`);
      const head = el(doc, 'p', null, 'co-capital__head');
      // "앤트로픽에 지분 투자 100억 달러" (this company pays) or "인텔로부터 지분 투자 …" (it receives).
      head.append(doc.createTextNode(`${row.counterparty.name}${row.direction === 'out' ? '에' : '로부터'} ${row.kind}${row.onBehalfOf ? `(의무를 지는 곳 ${row.onBehalfOf})` : ''} `), el(doc, 'b', row.amount || '금액 미공개'));
      if (row.reported) head.append(el(doc, 'span', '보도', 'sx-chip sx-chip--sm sx-chip--neutral co-capital__status'));
      item.append(head, el(doc, 'p', [row.amountBasis, row.announced ? `${row.announced}${row.dateBasis ? ` ${row.dateBasis}` : ''}` : null].filter(Boolean).join(', '), 'co-capital__line'));
      list.append(item);
    }
    box.append(block(doc, `자본순환 ${place.capital.length}건`, list));
  }
  if (typeof openMap === 'function') {
    const go = el(doc, 'button', 'AI 지도에서 보기', 'aio-btn-table co-link');
    go.type = 'button';
    go.addEventListener('click', () => openMap(place));
    box.append(go);
  }
  const industryGo = industryLink(doc, industry, openIndustry);
  if (industryGo) box.append(industryGo);
  // The basis of every link: whose story said it, and the sentence.
  const said = [['사 주는 곳', place.customers], ['공급하는 곳', place.suppliers], ['겨루는 곳', place.rivals], ['함께 일하는 곳', place.partners]]
    .flatMap(([group, rows]) => rows.flatMap((row) => row.said.map((s) => [`${group}, ${row.name}`, `${s.by === place.symbol ? '이 회사' : s.by} 이야기: ${s.text}`])));
  const arenas = story?.competition?.arenas || [];
  const capitalWhat = place.capital.map((row) => [`${row.kind}, ${row.counterparty.name}`, row.what]);
  if (said.length || arenas.length || capitalWhat.length) {
    const tables = [];
    if (said.length) tables.push(rawTable(doc, said, '연결 근거'));
    if (arenas.length) tables.push(rawTable(doc, arenas.map((a) => [a.arena, [POSITION_LABEL[a.position] || a.position, (a.rivals || []).join(', '), a.share].filter(Boolean).join(', ')]), '시장별 경쟁'));
    if (capitalWhat.length) tables.push(rawTable(doc, capitalWhat, '자본순환 내용'));
    box.append(kindFold(doc, 'raw-table', [said.length ? `연결 근거 ${said.length}건` : null, arenas.length ? `시장별 경쟁 ${arenas.length}곳` : null, capitalWhat.length ? `자본순환 내용 ${capitalWhat.length}건` : null].filter(Boolean).join(', '), tables));
  }
  return box;
}

// ── 쟁점과 전망 ──────────────────────────────────────────────────────────────────────────────────────────────────────
// The issue the stock turns on and its two readings, the structures under the numbers, what the company and the market
// plans and the signals that the story holds or breaks. The numbers each report is read on live on 재무 공시.
// Null for a company without a researched story (no empty heading).
function outlookSection(doc, { story }) {
  if (!story) return null;
  const box = section(doc, 'outlook', '쟁점과 전망');
  const d = story.debate || {};
  if (has(d.question)) {
    const decides = (d.decides || []).filter((item) => has(item?.what));
    box.append(block(doc, '핵심 쟁점', el(doc, 'p', d.question, 'co-lead'),
      pairOf(doc, [['이야기가 유지된다는 읽기', d.bull?.text], ['이야기가 깨진다는 읽기', d.bear?.text]]),
      decides.length ? el(doc, 'h4', '판가름할 것', 'co-cell__title') : null, decides.length ? datedList(doc, decides) : null));
  }
  const hood = (story.underTheHood || []).filter((item) => has(item?.title) && has(item?.text));
  if (hood.length) {
    const rows = hood.map((item) => { const cell = el(doc, 'div', null, 'co-cell'); cell.append(el(doc, 'h4', item.title, 'co-cell__title'), el(doc, 'p', item.text, 'co-text')); return cell; });
    const grid = el(doc, 'div', null, 'co-pair');
    grid.append(...rows);
    box.append(block(doc, '잘 안 보이는 구조', grid));
  }
  const st = story.strategy || {}, gd = story.guidance || {};
  const guide = (gd.latest || []).filter((row) => has(row?.value)).map((row) => `${[row.period, row.metric].filter(Boolean).join(' ')}: ${row.value}${row.givenOn ? ` (${mdOf(row.givenOn)} 발표)` : ''}`);
  const roadmap = (st.roadmap || []).filter((row) => has(row?.what));
  if (has(st.goal) || roadmap.length || has(st.vision) || guide.length || has(gd.track)) {
    box.append(block(doc, '회사가 밝힌 전망과 계획', has(st.goal) ? el(doc, 'p', st.goal, 'co-text') : null,
      guide.length ? el(doc, 'h4', '회사가 밝힌 숫자', 'co-cell__title') : null, guide.length ? list(doc, guide) : null,
      has(gd.track) ? el(doc, 'p', gd.track, 'co-text') : null,
      roadmap.length ? el(doc, 'h4', '앞으로의 계획', 'co-cell__title') : null, roadmap.length ? datedList(doc, roadmap) : null,
      has(st.vision) ? el(doc, 'p', st.vision, 'co-text') : null));
  }
  const w = story.watch || {};
  const signals = pairOf(doc, [['맞아가고 있다는 신호', w.confirms], ['어긋나고 있다는 신호', w.breaks]]);
  if (signals) box.append(block(doc, '이야기가 맞는지 보는 신호', signals));
  if (box.childElementCount === 1) return null;
  box.append(kindFold(doc, 'method', '두 읽기와 신호의 근거', [el(doc, 'p', `${story.researchedAt ? `${mdOf(story.researchedAt)} 조사한 ` : ''}회사 공시·발표 자료와 보도에 근거한 읽기입니다. 어느 쪽이 맞다는 판단이나 매매 의견이 아닙니다.`, 'ind-method__text')]));
  return box;
}

// ── 재무 한눈에 ──────────────────────────────────────────────────────────────────────────────────────────────────────
const SOURCE_WORD = Object.freeze({ sec: '미국 공시', dart: '한국 공시', story: '회사 실적 발표' });
// Where the period's cash went, one bar per use against the largest (amounts of one currency only).
function cashBars(doc, useOfCash) {
  const items = (useOfCash?.items || []).map((x) => ({ ...x, scale: amountScale(x.value, x.unit) })).filter((x) => x.scale > 0);
  if (!items.length) return null;
  const currencyOf = (unit) => (String(unit || '').match(/^[A-Z]{3}/i)?.[0] || '').toUpperCase();
  if (new Set(items.map((x) => currencyOf(x.unit))).size > 1) return null;
  const max = Math.max(...items.map((x) => x.scale));
  const box = el(doc, 'div', null, 'co-bars');
  box.setAttribute('role', 'img');
  const name = (x) => x.label || CASH_USE_LABEL[x.use] || x.use;
  box.setAttribute('aria-label', `현금을 쓴 곳: ${items.map((x) => `${name(x)} ${moneyText(x.value, x.unit)}`).join(', ')}`);
  for (const x of items) {
    const row = el(doc, 'div', null, 'co-bar');
    const track = el(doc, 'span', null, 'co-bar__track');
    const fill = el(doc, 'span', null, 'co-bar__fill');
    fill.style.width = `${((x.scale / max) * 100).toFixed(1)}%`;
    track.append(fill);
    row.append(el(doc, 'span', name(x), 'co-bar__name'), track, el(doc, 'span', moneyText(x.value, x.unit), 'co-bar__value'));
    box.append(row);
  }
  return box;
}

function moneySection(doc, { money, emptyText, peer, priced, openFundamental }) {
  const box = section(doc, 'money', '재무 한눈에');
  if (!money?.rows?.length) box.append(el(doc, 'p', emptyText || '재무 자료 없음', 'co-empty'));
  else {
    const list = el(doc, 'div', null, 'co-rows');
    for (const row of money.rows) list.append(indicatorRow(doc, { title: row.title, stateLabel: row.state, tone: row.tone, value: row.value, lines: row.lines, level: 'h3' }));
    box.append(list);
  }
  // What the price already discounts (src/domain/fundamental/priced-in.js); absent when the inputs are not readable.
  if (priced?.lines?.length) {
    const read = block(doc, `이 주가가 반영하는 것${priced.state === 'plain' ? '' : `: ${priced.label}`}`, ...priced.lines.map((line) => el(doc, 'p', line.text, 'co-text')),
      kindFold(doc, 'method', '상태를 정하는 법', priced.method.map((text) => el(doc, 'p', text, 'ind-method__text'))));
    read.dataset.companyPriced = '';
    box.append(read);
  }
  // Standing among named theme peers: the strongest and the weakest metric (stock-lens-cards.js peerLine).
  if (peer) {
    const standing = el(doc, 'div', null, 'co-block');
    standing.dataset.companyPeer = '';
    standing.append(el(doc, 'h3', `동종 ${peer.theme} ${peer.count}곳 안에서`, 'co-block__title'));
    const lines = el(doc, 'ul', null, 'co-list co-peer');
    for (const [label, text, tone] of [['강한 점', peer.strength, 'favorable'], ['약한 점', peer.weakness, 'burden']]) {
      if (!text) continue;
      const li = el(doc, 'li', null, `is-${tone}`);
      li.append(el(doc, 'b', label), doc.createTextNode(` ${text}`));
      lines.append(li);
    }
    standing.append(lines);
    box.append(standing);
  }
  if (typeof openFundamental === 'function') {
    const go = el(doc, 'button', '실적과 현금, 재무 공시에서 보기', 'aio-btn-table co-link');
    go.type = 'button';
    go.addEventListener('click', openFundamental);
    box.append(go);
  }
  if (money?.rows?.length) {
    box.append(kindFold(doc, 'method', `${SOURCE_WORD[money.source] || '공시'} 기준, 상태어를 정하는 법`, [
      el(doc, 'p', '매출 성장은 최근 4개 분기 합계가 회계연도 말보다 새로우면 그 합계를 1년 전 같은 4개 분기와 비교하고, 아니면 회계연도 전년 대비입니다. 2%p 안쪽은 보합으로 적습니다.', 'ind-method__text'),
      el(doc, 'p', '순이익률·영업이익률은 0보다 크면 흑자, 작으면 적자입니다. 잉여현금흐름은 영업현금흐름에서 설비투자를 뺀 값이고, 순현금은 현금·단기투자에서 장기부채를 뺀 값입니다(리스 부채 제외). 은행·보험사는 이 두 줄을 계산하지 않습니다.', 'ind-method__text'),
      money.source === 'story' ? el(doc, 'p', '공시 수집본에 이 회사 숫자가 없어 회사가 발표한 실적을 조사일 기준으로 옮겼습니다.', 'ind-method__text') : null
    ]));
  }
  return box;
}

function sourcesFold(doc, { story, profile, place }) {
  const items = [];
  for (const s of story?.sources || []) items.push({ text: [s.publisher, s.date].filter(Boolean).join(', '), title: s.title || s.publisher || '원문', url: s.url });
  if (!story && profile?.sourceUrl) items.push({ text: profile.source || '종목 등록 정보', title: '회사 설명 원문', url: profile.sourceUrl });
  for (const row of place?.capital || []) for (const s of row.sources) items.push({ text: [`자본순환, ${row.counterparty.name}`, s.publisher, s.date].filter(Boolean).join(', '), title: s.title || s.publisher || '원문', url: s.url });
  if (!items.length && !has(story?.unverified)) return null;
  const list = el(doc, 'ol', null, 'co-sources');
  for (const item of items) {
    const li = el(doc, 'li');
    const link = el(doc, 'a', item.title);
    if (/^https:\/\//.test(item.url || '')) { link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    li.append(link, doc.createTextNode(item.text ? `, ${item.text}` : ''));
    list.append(li);
  }
  const body = [list];
  if (has(story?.unverified)) { const ul = el(doc, 'ul', null, 'co-list'); for (const text of story.unverified) ul.append(el(doc, 'li', text)); body.push(el(doc, 'p', '확인하지 못해 비워 둔 값', 'co-figure-title'), ul); }
  const what = [story?.researchedAt ? `회사 이야기 ${mdOf(story.researchedAt)} 조사` : null, items.length ? `근거 자료 ${items.length}개` : null, has(story?.unverified) ? `비워 둔 값 ${story.unverified.length}개` : null].filter(Boolean).join(', ');
  return kindFold(doc, 'sources', what, body);
}

// The last line of 개요: the way to 쟁점과 전망, named by the issue the story turns on when it has one.
function outlookLink(doc, story, openOutlook) {
  const question = story?.debate?.question;
  const go = el(doc, 'button', has(question) ? `쟁점과 전망: ${question} →` : '쟁점과 전망 →', 'flow-next-link co-link');
  go.type = 'button';
  go.dataset.companyNext = 'outlook';
  go.addEventListener('click', openOutlook);
  return go;
}

/**
 * Paints the overview into `host` and 쟁점과 전망 into `ctx.outlookHost` (children replaced). ctx: { symbol, story, profile,
 * place, money, moneyEmpty, peer, priced, industry, earnings, briefs, quarters, today, outlookHost, openTicker, openMap,
 * openIndustry, openFundamental, openOutlook, actions }.
 */
export function renderCompanyOverview(doc, host, ctx) {
  if (!doc || !host) return null;
  const { earnings = [], briefs = [], quarters = '', outlookHost = null } = ctx;
  // Researched text speaks from its research day, never as "현재" (research-text.js); the live figures are the tables'.
  const story = datedStory(ctx.story || null);
  const freshness = story ? storyFreshness(story, earnings, undefined, { briefs, quarters }) : null;
  const outlook = outlookSection(doc, { story });
  if (outlookHost) {
    outlookHost.replaceChildren(outlook || el(doc, 'p', '쟁점과 전망 자료 없음', 'co-empty'));
    outlookHost.hidden = false;
  }
  const nodes = [
    businessSection(doc, { story, profile: ctx.profile, freshness, inMap: !!ctx.place?.inMap }),
    placeSection(doc, { place: ctx.place, story, industry: ctx.industry, openTicker: ctx.openTicker, openMap: ctx.openMap, openIndustry: ctx.openIndustry }),
    moneySection(doc, { money: ctx.money, emptyText: ctx.moneyEmpty, peer: ctx.peer, priced: ctx.priced, openFundamental: ctx.openFundamental }),
    outlook && typeof ctx.openOutlook === 'function' ? outlookLink(doc, story, ctx.openOutlook) : null
  ].filter(Boolean);
  if (ctx.actions?.length) { const row = el(doc, 'div', null, 'co-actions'); row.append(...ctx.actions); nodes.push(row); }
  const sources = sourcesFold(doc, { story, profile: ctx.profile, place: ctx.place });
  if (sources) nodes.push(sources);
  host.replaceChildren(...nodes);
  host.hidden = false;
  return { freshness };
}

/**
 * 재무 공시's company report (its children are replaced): the company's own account of the period, its industry's
 * figures, where its cash went, what the market expects, what each report is read on and the dated events ahead.
 * Hidden for a company without a researched story.
 */
export function renderCompanyReport(doc, host, { story: stored = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  if (!doc || !host) return;
  const story = datedStory(stored);
  const box = section(doc, 'report', '실적과 현금');
  const e = story?.earnings || {}, w = story?.watch || {}, t = story?.trading || {};
  if (has(e.text)) box.append(block(doc, `회사가 발표한 실적${e.period ? `, ${String(e.period).replace(/\s*\(.*$/, '')}` : ''}`, el(doc, 'p', e.text, 'co-text')));
  if (has(e.industryMetric)) box.append(block(doc, '이 업종이 평가받는 숫자', list(doc, e.industryMetric.map((m) => `${m.name}: ${m.value}`))));
  const cash = cashBars(doc, story?.useOfCash);
  if (cash || has(story?.useOfCash?.text)) box.append(block(doc, `현금을 쓴 곳${story.useOfCash.period ? `, ${String(story.useOfCash.period).replace(/\s*\(.*$/, '')}` : ''}`, cash, has(story.useOfCash.text) ? el(doc, 'p', story.useOfCash.text, 'co-text') : null));
  if (has(story?.estimates?.text)) box.append(block(doc, '시장 예상', el(doc, 'p', story.estimates.text, 'co-text')));
  const keyNumbers = (w.keyNumbers || []).filter((m) => has(m?.name)).map((m) => `${m.name}${m.why ? `: ${m.why}` : ''}`);
  const report = pairOf(doc, [['분기마다 볼 숫자', keyNumbers], ['실적 발표 때 주가가 반응하는 것', t.reaction], ['실적 때 함께 확인하는 것', t.conditions]]);
  if (report) box.append(block(doc, '실적 발표에서 볼 것', report));
  // A dated event already past is not "다가오는"; an undated one ("2027 상반기", "수시") stays.
  const upcoming = (t.calendar || []).filter((x) => has(x?.event) && (!hasLeadingIsoDay(x?.date || '') || String(x.date).slice(0, 10) >= today));
  if (upcoming.length) box.append(block(doc, '다가오는 일정', datedList(doc, upcoming)));
  if (has(story?.governance?.line)) box.append(block(doc, '경영·지배구조', el(doc, 'p', story.governance.line, 'co-text')));
  if (box.childElementCount === 1) { host.hidden = true; host.replaceChildren(); return; }
  box.querySelector('h2').id = 'fund-company-report-title';
  box.setAttribute('aria-labelledby', 'fund-company-report-title');
  host.replaceChildren(box);
  host.hidden = false;
}
