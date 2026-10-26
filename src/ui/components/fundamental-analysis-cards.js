// v58.55 (개편 v2 3d/5g): the analysis cards v58.53 left out — 듀폰 분해 and 역 DCF on 종목 요약, R&D 비율 on 재무 공시.
// Readings come from src/domain/fundamental/analysis-read.js; this file only draws them. A card whose inputs are not yet
// collected says "수집 대기 · 다음 SEC 갱신 후 표시"; a filer that does not tag an item says so — never a zero.
import { buildDupontRead, buildRdRead, impliedGrowth, dcfValue, reverseDcfInputs, REVERSE_DCF_DEFAULTS, buildTrailingYearRead, buildEarningsSchedule, buildSurpriseRead, buildMarginCashRead, buildThemePeers } from '../../domain/fundamental/analysis-read.js';
import { formatUsdShort, reconcileFiscalHistory } from '../../domain/fundamental/fiscal-read.js';
import { fiscalYearShortLabel } from '../../domain/fundamental/period.js';
import { el } from './dom.js';
import { fiscalBarGeometry, parseFiscalHistory } from './fiscal-read.js';
import { peMultipleText } from '../../domain/fundamental/consensus-read.js';
import { stockLensContext, lensCard, thesisCard, situationCard } from './stock-lens-cards.js';
import { signedText } from '../../domain/shared/number.js';

export const COLLECTION_PENDING_LABEL = '수집 대기, 다음 SEC 갱신 후 표시';
const pct = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const ratio = (value) => value.toFixed(Math.abs(value) < 0.1 ? 3 : 2);
const signedPct = (value, digits = 1) => signedText(value * 100, digits, '%');

function cardHead(doc, title, meta, chip = null) {
  const head = el(doc, 'div', null, 'sx-card__head');
  const left = el(doc, 'h3', title, 'sx-card__title');
  head.append(left);
  const right = el(doc, 'span', null, 'v2-analysis-head__meta');
  if (meta) right.append(el(doc, 'span', meta, 'sx-card__meta'));
  if (chip) right.append(el(doc, 'span', chip.text, `sx-chip sx-chip--sm ${chip.className || 'sx-chip--neutral'}`));
  head.append(right);
  return head;
}

function disclosure(doc, summary, boxes) {
  const fold = el(doc, 'details', null, 'sx-disclosure v2-analysis-principle');
  fold.append(el(doc, 'summary', summary));
  const body = el(doc, 'div', null, 'sx-disclosure__body');
  for (const [label, text] of boxes) {
    const box = el(doc, 'div', null, 'sx-disclosure__card');
    box.append(el(doc, 'span', label, 'sx-disclosure__label'), el(doc, 'p', text, 'sx-disclosure__text'));
    body.append(box);
  }
  fold.append(body);
  return fold;
}

// The honest waiting state: the item is designed and its producer is wired, the issuer's record predates it.
export function pendingNote(doc, what, items = '총자산·R&D') {
  const box = el(doc, 'div', null, 'v2-analysis-pending');
  box.setAttribute('role', 'status');
  box.append(el(doc, 'span', COLLECTION_PENDING_LABEL, 'sx-chip sx-chip--sm sx-chip--date'),
    el(doc, 'p', `${what}에 필요한 ${items} 항목을 SEC 연간 공시에서 새로 수집하고 있습니다. 공시 갱신은 하루 다섯 번, 회차마다 일부 기업씩 진행되며 이 기업 차례가 오면 자동으로 표시됩니다. 그 전까지 값을 추정하지 않습니다.`, 'v2-analysis-pending__text'));
  return box;
}

function unavailable(doc, text) {
  return el(doc, 'p', text, 'v2-analysis-unavailable');
}

// ── 듀폰 분해 ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export function dupontCard(doc, history, { financial = false, fundamentals = null } = {}) {
  const read = buildDupontRead(history, { fundamentals });
  if (read.state === 'none') return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-dupont');
  card.dataset.analysis = 'dupont';
  card.dataset.state = read.state;
  card.setAttribute('aria-label', '수익성의 구조, 듀폰 분해');
  const latest = read.columns?.at(-1);
  const basisWord = (basis) => (basis === 'average' ? '평균 자산·자본' : '기말 자산·자본');
  card.append(cardHead(doc, '수익성의 구조, 듀폰 분해', latest ? `${latest.label}, ${basisWord(latest.basis)}` : 'SEC 연간 공시'));
  if (read.state === 'pending') { card.append(pendingNote(doc, '듀폰 분해')); return card; }
  if (read.state !== 'ready') { card.append(unavailable(doc, read.reason)); return card; }
  // The equation for the latest year (design 3d): 순이익률 × 자산회전율 × 재무 레버리지 = ROE.
  const strip = el(doc, 'div', null, 'v2-dupont-eq');
  strip.setAttribute('role', 'group');
  strip.setAttribute('aria-label', `${latest.label} ROE ${pct(latest.roe)} = 순이익률 ${pct(latest.margin)} × 자산회전율 ${ratio(latest.turnover)} × 재무 레버리지 ${ratio(latest.leverage)}`);
  const parts = [['margin', '순이익률', pct(latest.margin), '×'], ['turnover', '자산회전율', ratio(latest.turnover), '×'], ['leverage', '재무 레버리지', ratio(latest.leverage), '='], ['roe', 'ROE', pct(latest.roe), '']];
  for (const [id, name, value, op] of parts) {
    const tile = el(doc, 'div', null, `v2-dupont-eq__tile${id === 'roe' ? ' is-result' : ''}${id === read.driver ? ' is-driver' : ''}`);
    tile.append(el(doc, 'span', name, 'v2-dupont-eq__name'), el(doc, 'b', value, 'v2-dupont-eq__value'));
    strip.append(tile);
    if (op) strip.append(el(doc, 'span', op, 'v2-dupont-eq__op'));
  }
  card.append(el(doc, 'p', '순이익률 × 자산회전율 × 재무 레버리지 = ROE', 'v2-dupont-eq__formula'), strip);
  // The two years side by side.
  if (read.columns.length === 2) {
    const [prev, now] = read.columns;
    const table = el(doc, 'table', null, 'v2-dupont-table');
    table.append(el(doc, 'caption', `${prev.label}와 ${now.label} 비교 — ${read.basis === 'average' ? '자산·자기자본은 각 해의 기초·기말 평균' : read.basis === 'year-end' ? '자산·자기자본은 기말 값(평균을 만들 직전 해 자료가 없음)' : `${prev.label} ${basisWord(prev.basis)}, ${now.label} ${basisWord(now.basis)}(직전 해 자료가 있는 해만 평균)`}`));
    const head = el(doc, 'thead'); const hr = el(doc, 'tr');
    for (const label of ['요인', prev.label, now.label]) { const th = el(doc, 'th', label); th.scope = 'col'; hr.append(th); }
    head.append(hr); table.append(head);
    const body = el(doc, 'tbody');
    for (const [id, name, fmt] of [['margin', '순이익률', (v) => pct(v)], ['turnover', '자산회전율', (v) => `${ratio(v)}회`], ['leverage', '재무 레버리지', (v) => `${ratio(v)}배`], ['roe', 'ROE', (v) => pct(v)]]) {
      const tr = el(doc, 'tr', null, `${id === read.driver ? 'is-driver' : ''}${id === 'roe' ? ' is-result' : ''}`.trim() || null);
      const th = el(doc, 'th', name); th.scope = 'row';
      tr.append(th, el(doc, 'td', fmt(prev[id])), el(doc, 'td', fmt(now[id])));
      body.append(tr);
    }
    table.append(body);
    card.append(table);
  }
  card.append(el(doc, 'p', read.sentence, 'v2-analysis-lede'));
  card.append(disclosure(doc, '원리, 듀폰 분해', [
    ['원리', 'ROE = 순이익 ÷ 자기자본을 순이익률(순이익 ÷ 매출) × 자산회전율(매출 ÷ 총자산) × 재무 레버리지(총자산 ÷ 자기자본)로 나눕니다. 같은 ROE라도 마진에서 오는지, 자산을 빨리 돌려서인지, 빚으로 자본을 줄여서인지에 따라 지속성과 위험이 다릅니다.'],
    ['지금 읽기', `${read.basis === 'average' ? '기초·기말 평균 총자산과 평균 자기자본을 썼습니다(재무 공시의 ROE와 같은 기준).' : read.basis === 'year-end' ? '평균을 만들 직전 해 자료가 없어 기말 값을 썼습니다.' : '직전 해 자료가 있는 해는 평균, 없는 해는 기말 값을 썼습니다(재무 공시의 ROE와 같은 규칙).'} 가장 크게 움직인 요인은 표에서 강조했습니다.`],
    ['한계, 함께 볼 것', `${financial ? '은행은 예금을 부채로 쓰는 구조라 재무 레버리지가 10배 안팎이 보통이고 자산회전율은 매우 낮습니다 — 일반 기업과 같은 눈높이로 비교하지 않습니다. ' : ''}높은 수익성은 시간이 지나며 평균 쪽으로 돌아가는 경향이 관측됐습니다(Fama·French 2000). 일회성 이익·자사주 매입은 10-K 원문에서 확인합니다.`]
  ]));
  card.append(el(doc, 'p', '근거, DuPont 분해(1920년대), 수익성 평균 회귀(Fama·French 2000), 데이터, 미국 증권거래위원회 연간 공시(10-K)', 'sx-evidence'));
  return card;
}

// ── 역 DCF (calculator) ──────────────────────────────────────────────────────────────────────────────────────────────
const RANGE = Object.freeze({ discountRate: { min: 6, max: 14, step: 0.5 }, terminalGrowth: { min: 0, max: 4, step: 0.5 } });
function assumptionsOf(root) {
  const saved = root?._aioReverseDcfAssumptions;
  const pick = (key) => (Number.isFinite(saved?.[key]) ? saved[key] : REVERSE_DCF_DEFAULTS[key]);
  return { discountRate: pick('discountRate'), terminalGrowth: pick('terminalGrowth') };
}

export function growthSentence(result, years = 10) {
  if (result.state === 'ready') {
    const g = result.growth;
    return g >= 0
      ? `이 가정에서 지금 시가총액을 설명하려면 잉여현금흐름이 앞으로 ${years}년간 연 ${pct(g)}씩 늘어야 합니다.`
      : `이 가정에서는 잉여현금흐름이 앞으로 ${years}년간 연 ${pct(Math.abs(g))}씩 줄어드는 경로로도 지금 시가총액이 설명됩니다.`;
  }
  if (result.state === 'above-range') return `이 가정에서는 연 ${pct(result.bound, 0)}를 넘는 성장이 필요해 계산 범위를 벗어납니다.`;
  if (result.state === 'below-range') return `이 가정에서는 잉여현금흐름이 연 ${pct(Math.abs(result.bound), 0)}보다 빠르게 줄어도 지금 시가총액이 설명돼 계산 범위를 벗어납니다.`;
  if (result.state === 'rate-below-terminal') return '할인율이 영구 성장률보다 커야 계산됩니다.';
  return '계산할 수 없습니다.';
}

export function reverseDcfCard(doc, root, { history, fundamentals, close, financial = false, symbol = '' }) {
  const inputs = reverseDcfInputs({ history, fundamentals, close, financial });
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-rdcf');
  card.dataset.analysis = 'reverse-dcf';
  card.dataset.state = inputs.state;
  card.setAttribute('aria-label', '가격이 말하는 기대, 역 DCF');
  card.append(cardHead(doc, '가격이 말하는 기대, 역 DCF', inputs.state === 'ready' ? `${inputs.label} 잉여현금흐름, ${inputs.priceDate} 종가` : null, { text: '가정에 따라 달라지는 계산', className: 'sx-chip--neutral' }));
  if (inputs.state !== 'ready') { card.append(unavailable(doc, inputs.reason)); return card; }
  const assumptions = assumptionsOf(root);
  const facts = el(doc, 'div', null, 'v2-rdcf-facts');
  const fact = (name, value, detail) => { const tile = el(doc, 'div', null, 'v2-rdcf-fact'); tile.append(el(doc, 'span', name, 'v2-rdcf-fact__name'), el(doc, 'b', value, 'v2-rdcf-fact__value'), el(doc, 'span', detail, 'v2-rdcf-fact__detail')); facts.append(tile); };
  fact('잉여현금흐름', formatUsdShort(inputs.fcf), `${inputs.label} 영업현금흐름 ${formatUsdShort(inputs.ocf)} − 설비투자 ${formatUsdShort(inputs.capex)}`);
  fact('시가총액', formatUsdShort(inputs.marketValue), `${inputs.priceDate} 종가 $${inputs.price.toFixed(2)} × ${(inputs.shares / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M주`);
  const result = el(doc, 'div', null, 'v2-rdcf-result');
  result.setAttribute('aria-live', 'polite');
  const resultName = el(doc, 'span', '지금 가격이 가정하는 연 성장률, 향후 10년', 'v2-rdcf-result__name');
  const resultValue = el(doc, 'b', '', 'v2-rdcf-result__value');
  const resultText = el(doc, 'p', '', 'v2-rdcf-result__text');
  const sensitivity = el(doc, 'p', '', 'v2-rdcf-result__sens');
  // v58.74 (text audit 종목 C1): the implied rate needs an anchor — the company's own revenue pace over the filed years, and
  // whether a thin free-cash-flow margin makes margin gains (not growth) the price's premise.
  const anchor = el(doc, 'p', '', 'v2-rdcf-result__anchor');
  const filed = (Array.isArray(history) ? history : []).filter((row) => Number(row?.revenue) > 0 && /^\d{4}-\d{2}-\d{2}/.test(String(row?.periodEnd || ''))).sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)));
  const spanYears = filed.length >= 3 ? Math.round((Date.parse(filed.at(-1).periodEnd) - Date.parse(filed[0].periodEnd)) / (365.25 * 86400000)) : 0;
  const revenueCagr = spanYears >= 2 ? (filed.at(-1).revenue / filed[0].revenue) ** (1 / spanYears) - 1 : null;
  const fcfMargin = filed.length ? inputs.fcf / filed.at(-1).revenue : null;
  result.append(resultName, resultValue, resultText, anchor, sensitivity);
  const controls = el(doc, 'div', null, 'v2-rdcf-controls');
  const outputs = {};
  const sliders = {};
  const idBase = `rdcf-${String(symbol || 'x').replace(/[^A-Za-z0-9]/g, '')}`;
  for (const [key, label, note] of [['discountRate', '할인율', '기대 수익률, 기본 9%'], ['terminalGrowth', '영구 성장률', '10년 뒤, 기본 2.5%']]) {
    const wrap = el(doc, 'div', null, 'v2-rdcf-control');
    const id = `${idBase}-${key}`;
    const lab = el(doc, 'label', null, 'v2-rdcf-control__label');
    lab.htmlFor = id;
    outputs[key] = el(doc, 'b', '', 'v2-rdcf-control__value');
    lab.append(el(doc, 'span', label), outputs[key]);
    const input = el(doc, 'input', null, 'v2-rdcf-control__input');
    input.type = 'range'; input.id = id;
    input.min = String(RANGE[key].min); input.max = String(RANGE[key].max); input.step = String(RANGE[key].step);
    input.value = String(assumptions[key] * 100);
    input.setAttribute('aria-describedby', `${id}-note`);
    const hint = el(doc, 'span', note, 'v2-rdcf-control__note');
    hint.id = `${id}-note`;
    sliders[key] = input;
    wrap.append(lab, input, hint);
    controls.append(wrap);
  }
  const reset = el(doc, 'button', '기본 가정으로', 'sx-link v2-rdcf-reset');
  reset.type = 'button';
  controls.append(reset);
  const update = () => {
    const r = Number(sliders.discountRate.value) / 100;
    const gT = Number(sliders.terminalGrowth.value) / 100;
    root._aioReverseDcfAssumptions = { discountRate: r, terminalGrowth: gT };
    outputs.discountRate.textContent = pct(r);
    outputs.terminalGrowth.textContent = pct(gT);
    sliders.discountRate.setAttribute('aria-valuetext', pct(r));
    sliders.terminalGrowth.setAttribute('aria-valuetext', pct(gT));
    const solved = impliedGrowth({ fcf: inputs.fcf, marketValue: inputs.marketValue, discountRate: r, terminalGrowth: gT });
    card.dataset.result = solved.state;
    resultValue.textContent = solved.state === 'ready' ? `연 ${signedPct(solved.growth)}` : solved.state === 'above-range' ? `연 +${pct(solved.bound, 0)} 초과` : solved.state === 'below-range' ? `연 -${pct(Math.abs(solved.bound), 0)} 미만` : '—';
    resultText.textContent = growthSentence(solved);
    anchor.textContent = solved.state !== 'ready' ? '' : [
      revenueCagr != null ? `이 성장률은 지난 ${spanYears}년 매출 연평균 ${signedPct(revenueCagr)}보다 ${Math.abs(solved.growth - revenueCagr) < 0.01 ? '비슷한' : solved.growth < revenueCagr ? '낮은' : '높은'} 가정입니다(현금흐름 성장률과 매출 성장률을 나란히 놓은 참고 비교).` : '',
      fcfMargin != null && fcfMargin < 0.05 ? `잉여현금흐름이 매출의 ${pct(fcfMargin)}라, 성장률보다 마진 개선이 가격의 전제입니다.` : ''
    ].filter(Boolean).join(' ');
    const higher = r + 0.005 > gT ? impliedGrowth({ fcf: inputs.fcf, marketValue: inputs.marketValue, discountRate: r + 0.005, terminalGrowth: gT }) : null;
    sensitivity.textContent = solved.state === 'ready' && higher?.state === 'ready'
      ? `할인율을 0.5%p 높이면 필요한 성장률은 연 ${signedPct(higher.growth)} — 먼 미래 현금의 비중이 클수록 할인율 변화에 민감합니다.`
      : '';
  };
  sliders.discountRate.addEventListener('input', update);
  sliders.terminalGrowth.addEventListener('input', update);
  reset.addEventListener('click', () => { sliders.discountRate.value = String(REVERSE_DCF_DEFAULTS.discountRate * 100); sliders.terminalGrowth.value = String(REVERSE_DCF_DEFAULTS.terminalGrowth * 100); update(); });
  update();
  card.append(facts, result, controls);
  const zeroGrowth = dcfValue(inputs.fcf, 0, REVERSE_DCF_DEFAULTS.discountRate, REVERSE_DCF_DEFAULTS.terminalGrowth);
  card.append(disclosure(doc, '계산식과 가정', [
    ['계산식', `시가총액 = Σ(t=1..10) FCF × (1+g)ᵗ ÷ (1+r)ᵗ + FCF × (1+g)¹⁰ × (1+영구 성장률) ÷ (r − 영구 성장률) ÷ (1+r)¹⁰. FCF는 ${inputs.label} 영업현금흐름 − 설비투자, r은 할인율입니다. 이 식을 만족하는 g를 찾아 보여 줍니다.`],
    ['가정', `할인율과 영구 성장률은 사용자가 정하는 가정이며 기본값(9%, 2.5%)은 출발점일 뿐입니다. 부채·현금은 따로 더하거나 빼지 않고 시가총액(주주 몫)과 이자 지급 뒤 현금흐름을 비교하는 근사입니다. 참고로 기본 가정에서 성장 0%면 계산 가치는 ${formatUsdShort(zeroGrowth)}입니다.`],
    ['한계', '한 해의 잉여현금흐름이 출발점이라 그해 설비투자·운전자본이 특이하면 결과가 크게 달라집니다. 이 숫자는 가격이 어떤 기대를 담고 있는지 보는 계산이며, 그 기대가 맞는지는 이 화면이 판단하지 않습니다.']
  ]));
  card.append(el(doc, 'p', `근거, Mauboussin·Rappaport 《Expectations Investing》, 데이터, SEC EDGAR 10-K 현금흐름표, 주식 수 ${inputs.sharesObservedAt ? `${inputs.sharesObservedAt} 공시` : 'SEC 공시'}, ${inputs.priceDate} 종가`, 'sx-evidence'));
  return card;
}

// ── R&D 비율 ──────────────────────────────────────────────────────────────────────────────────────────────────────────
function rdNowText(read) {
  const generic = '막대는 공시된 회계연도별 R&D ÷ 매출입니다. 비율이 오르면 매출보다 투자가 빨리 늘었거나 매출이 줄었다는 뜻이라 매출 흐름과 함께 봅니다.';
  const { first, latest, deltaPp } = read;
  if (deltaPp == null || !(first?.rd > 0) || !(latest?.rd > 0) || Math.abs(deltaPp) < 0.5) return generic;
  const rdUp = latest.rd > first.rd;
  const why = deltaPp < 0 ? (rdUp ? '매출이 연구개발비보다 더 빨리 늘어난 결과입니다' : '연구개발비 자체를 줄인 결과입니다')
    : (rdUp ? '연구개발비가 매출보다 빨리 늘어난 결과입니다' : '매출이 연구개발비보다 더 많이 줄어든 결과입니다');
  return `비율은 ${first.label} ${pct(first.ratio)}에서 ${latest.label} ${pct(latest.ratio)}로 ${deltaPp < 0 ? '낮아졌지만' : '높아졌고'} 연구개발비는 ${formatUsdShort(first.rd)}에서 ${formatUsdShort(latest.rd)}로 ${rdUp ? '늘었습니다' : '줄었습니다'} — ${why}. 막대는 회계연도별 R&D ÷ 매출입니다.`;
}

export function rdCard(doc, history) {
  const read = buildRdRead(history);
  if (read.state === 'none') return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-rd');
  card.dataset.analysis = 'rd';
  card.dataset.state = read.state;
  card.setAttribute('aria-label', 'R&D 비율');
  card.append(cardHead(doc, 'R&D 비율', read.state === 'ready' ? `R&D ÷ 매출, ${read.latest.label}` : 'R&D ÷ 매출'));
  if (read.state === 'pending') { card.append(pendingNote(doc, 'R&D 비율')); return card; }
  if (read.state === 'unreported') {
    card.append(el(doc, 'b', 'R&D 별도 공시 없음', 'v2-rd-none'), unavailable(doc, '이 회사의 연간 손익계산서에는 연구개발비가 따로 표시되지 않습니다(다른 비용에 포함되었거나 연구개발이 사업의 중심이 아닌 경우). 0%로 읽지 않습니다.'));
    return card;
  }
  const max = Math.max(...read.years.map((year) => year.ratio ?? 0), 0.0001);
  const trend = el(doc, 'div', null, 'v2-fiscal-trend v2-rd-trend');
  trend.setAttribute('role', 'img');
  trend.setAttribute('aria-label', `R&D ÷ 매출 ${read.years.length}개 회계연도: ${read.years.map((year) => `${year.label} ${year.ratio == null ? '공시 없음' : pct(year.ratio)}`).join(', ')}`);
  for (const year of read.years) {
    const col = el(doc, 'span', null, 'v2-fiscal-trend__col');
    const bar = el(doc, 'span', null, `v2-fiscal-trend__bar${year.ratio == null ? ' is-na' : ''}`);
    bar.style.height = `${year.ratio == null ? 4 : Math.max(6, year.ratio / max * 100).toFixed(1)}%`;
    col.title = `${year.periodEnd} ${year.ratio == null ? 'R&D 공시 없음' : `R&D ${formatUsdShort(year.rd)}, 매출의 ${pct(year.ratio)}`}`;
    col.append(el(doc, 'span', year.ratio == null ? '—' : pct(year.ratio), 'v2-fiscal-trend__value'), bar, el(doc, 'span', fiscalYearShortLabel(year.periodEnd), 'v2-fiscal-trend__year'));
    trend.append(col);
  }
  const lede = `${read.latest.label} 연구개발비 ${formatUsdShort(read.latest.rd)} — 매출의 ${pct(read.latest.ratio)}${read.deltaPp != null ? ` (${read.first.label} ${pct(read.first.ratio)}에서 ${Math.abs(read.deltaPp) < 0.5 ? '비슷한 수준' : `${read.deltaPp > 0 ? '+' : '-'}${Math.abs(read.deltaPp).toFixed(1)}%p`})` : ''}.${read.latestIsNewest ? '' : ' 최근 회계연도에는 R&D가 따로 표시되지 않았습니다.'}`;
  card.append(el(doc, 'p', lede, 'v2-analysis-lede'), trend);
  card.append(disclosure(doc, '원리, R&D 비율', [
    ['원리', '연구개발비는 회계상 비용으로 바로 처리되지만 성격은 미래 매출을 위한 투자에 가깝습니다. 매출 대비 비율이 높고 꾸준한 기업은 장부 이익이 실제 경제적 이익보다 낮게 잡히는 경향이 있습니다.'],
    // v58.74 (text audit 종목 C3): the reading says which side moved the ratio — R&D itself, or revenue.
    ['지금 읽기', rdNowText(read)],
    ['한계, 함께 볼 것', '업종마다 정상 수준이 크게 다릅니다(소프트웨어·제약은 높고 유통·금융은 거의 없음). 인수한 연구개발(IPR&D)이 섞인 해는 10-K 원문에서 확인합니다.']
  ]));
  card.append(el(doc, 'p', '근거, Lev·Sougiannis(1996) R&D 자본화와 수익률, 데이터, 미국 증권거래위원회 연간 공시(10-K)', 'sx-evidence'));
  return card;
}

// ── v58.75 (persona review): recent four quarters, earnings surprise, margin ladder · net cash · capital return, theme peers ──
const usd2 = (value) => `${value < 0 ? '-' : ''}$${Math.abs(value).toFixed(2)}`;

// One line under the annual headline: the last four filed quarters against the same four a year earlier (null = omit).
export function trailingYearLine(read) {
  if (!read) return null;
  const yoy = [read.revenueYoy != null ? `매출 ${signedText(read.revenueYoy, 1, '%')}` : null, read.netIncomeYoy != null ? `순이익 ${signedText(read.netIncomeYoy, 1, '%')}` : null].filter(Boolean);
  return `최근 4개 분기(${read.through.slice(0, 7)} 분기까지) 매출 ${formatUsdShort(read.revenue)}, 순이익 ${formatUsdShort(read.netIncome)}, 순이익률 ${read.margin == null ? '—' : `${read.margin.toFixed(1)}%`}`
    + `${yoy.length ? ` — 전년 같은 4개 분기 대비 ${yoy.join(', ')}${read.priorMargin != null && read.margin != null ? `, 순이익률 ${read.priorMargin.toFixed(1)}%에서 ${read.margin.toFixed(1)}%` : ''}` : ''}.${read.hasDerived ? ' (4분기 하나는 연간에서 1~3분기를 뺀 값)' : ''}`;
}

// Reported adjusted EPS against the consensus before each report: paired bars on one zero line, the surprise under each.
export function surpriseCard(doc, read) {
  if (!read?.rows?.length) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-surprise');
  card.dataset.analysis = 'surprise';
  card.setAttribute('aria-label', '실적 발표, 예상 대비 실제 EPS');
  card.append(cardHead(doc, '예상 대비 실제 EPS', `최근 ${read.rows.length}개 분기, 조정 EPS`));
  const n = read.rows.length;
  const lede = `최근 ${n}개 분기 중 ${read.beats}번 예상보다 높았고 ${read.misses}번 낮았습니다${read.average != null ? `, 차이 평균 ${signedText(read.average, 1, '%')}` : ''}. 직전 분기(${read.latest.quarter}) 실제 ${usd2(read.latest.actual)}, 예상 ${usd2(read.latest.estimate)}.`;
  card.append(el(doc, 'p', lede, 'v2-analysis-lede'));
  const scale = fiscalBarGeometry(read.rows.flatMap((row) => [row.estimate, row.actual]));
  const box = el(doc, 'div', null, 'fiscal-bars');
  box.style.setProperty('--fiscal-zero', `${scale.baseline.toFixed(3)}%`);
  for (const row of read.rows) {
    const col = el(doc, 'div', null, 'fiscal-col');
    const values = el(doc, 'div', null, 'fiscal-values');
    values.append(el(doc, 'span', `예상 ${usd2(row.estimate)}`, 'fiscal-value'), el(doc, 'span', `실제 ${usd2(row.actual)}`, `fiscal-value${row.actual < 0 ? ' is-loss' : ''}`));
    const stack = el(doc, 'div', null, 'fiscal-stack');
    for (const [field, label, className] of [['estimate', '예상', 'is-revenue'], ['actual', '실제', 'is-income']]) {
      const geometry = scale.rect(row[field]);
      if (!geometry) continue;
      const bar = el(doc, 'div', null, `fiscal-bar ${className}${row[field] < 0 ? ' is-loss' : ''}`);
      bar.style.top = `${geometry.top.toFixed(3)}%`;
      bar.style.height = `${geometry.height.toFixed(3)}%`;
      bar.title = `${row.quarter} 분기 ${label} EPS ${usd2(row[field])}`;
      stack.append(bar);
    }
    col.append(values, stack, el(doc, 'span', `${row.quarter} 분기`, 'fiscal-year'),
      el(doc, 'span', row.surprise == null ? '차이 계산 불가' : `차이 ${signedText(row.surprise, 1, '%')}`, `fiscal-margin${row.actual < row.estimate ? ' is-loss' : ''}`));
    box.append(col);
  }
  const scroll = el(doc, 'div', null, 'fiscal-chart-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', '분기별 예상과 실제 EPS 차트, 가로 스크롤');
  scroll.append(box);
  const legend = el(doc, 'div', null, 'fiscal-legend');
  legend.append(el(doc, 'span', '예상', 'is-revenue'), el(doc, 'span', '실제', 'is-income'), el(doc, 'span', '발표 직전 컨센서스와 발표된 조정 EPS', 'is-note'));
  const chart = el(doc, 'div', null, 'fiscal-chart fiscal-quality-chart');
  chart.append(scroll, legend);
  card.append(chart);
  card.append(disclosure(doc, '원리, 실적 서프라이즈', [
    ['원리', '애널리스트 예상(컨센서스)보다 높은 실적이 발표되면 주가가 그 뒤로도 같은 방향으로 움직이는 경향(실적 발표 후 표류)이 오래 관측됐습니다. 예상을 자주 넘는 회사는 회사가 보수적으로 안내하는 경우도 많아, 넘은 폭이 줄어드는지도 함께 봅니다.'],
    ['지금 읽기', `${read.beats === n ? `${n}개 분기 모두 예상보다 높았습니다.` : read.misses === n ? `${n}개 분기 모두 예상보다 낮았습니다.` : `넘은 분기와 못 미친 분기가 섞여 있습니다.`} 숫자는 일회성 항목을 뺀 조정 EPS이며 SEC 공시 순이익과 기준이 다릅니다.`],
    ['한계, 함께 볼 것', `점수에 쓰지 않는 참고값입니다. 매출 서프라이즈와 다음 분기 가이던스는 이 자료에 없어 실적 발표 자료에서 확인합니다.${read.asOf ? ` 자료 기준 ${read.asOf}.` : ''}`]
  ]));
  return card;
}

// Margin ladder (gross → operating → net) for the latest fiscal year carrying those lines, with net cash and capital return.
export function marginCashCard(doc, read, { financial = false } = {}) {
  if (!read || read.state === 'none') return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-margin-cash');
  card.dataset.analysis = 'margin-cash';
  card.dataset.state = read.state;
  card.setAttribute('aria-label', '이익률 단계와 현금');
  card.append(cardHead(doc, '이익률 단계와 현금', read.state === 'ready' ? `${read.label} 연간` : '연간 공시'));
  if (read.state === 'pending') { card.append(pendingNote(doc, '이익률 단계와 순현금', '매출총이익·영업이익·현금·주식보상·자사주·배당')); return card; }
  const [gross, operating, net] = read.ladder;
  const steps = read.ladder.filter((step) => step.value != null);
  const lede = gross.value != null && operating.value != null && net.value != null
    ? `매출 100달러 중 ${gross.value.toFixed(0)}달러가 원가를 뺀 이익, ${operating.value.toFixed(0)}달러가 영업비용까지 뺀 이익, ${net.value.toFixed(0)}달러가 이자·세금 뒤 순이익입니다(${read.label}).`
    : `${read.label} ${steps.map((step) => `${step.label} ${step.value.toFixed(1)}%`).join(', ')}${gross.value == null ? ', 매출총이익은 따로 공시되지 않았습니다' : ''}.`;
  card.append(el(doc, 'p', lede, 'v2-analysis-lede'));
  const bars = el(doc, 'div', null, 'v2-margin-ladder');
  for (const step of read.ladder) {
    const line = el(doc, 'div', null, 'stock-read-bars');
    line.append(el(doc, 'span', step.label, 'stock-read-bar-label'));
    const item = el(doc, 'div', null, 'stock-read-bar-row');
    if (step.value == null) item.append(el(doc, 'span', step.id === 'gross' ? '따로 공시 없음' : '자료 없음', 'stock-read-bar-value'));
    else {
      const track = el(doc, 'div', null, 'stock-read-track');
      const bar = el(doc, 'div', null, `stock-read-bar is-${step.value < 0 ? 'burden' : 'neutral'}`);
      bar.style.width = `${Math.max(step.value > 0 ? 2 : 0, Math.min(100, step.value)).toFixed(1)}%`;
      track.append(bar);
      const change = step.prior != null ? `, ${read.priorLabel} ${step.prior.toFixed(1)}%` : '';
      item.append(track, el(doc, 'span', `${step.value.toFixed(1)}%${change}`, 'stock-read-bar-value'));
    }
    line.append(item);
    bars.append(line);
  }
  card.append(bars);
  const lines = el(doc, 'ul', null, 'v2-margin-cash__lines');
  const cash = read.cash;
  if (cash && !financial) {
    const what = cash.shortTermInvestments != null ? '현금·단기투자' : '현금성 자산';
    lines.append(el(doc, 'li', cash.debt == null ? `${what} ${formatUsdShort(cash.liquid)}, 장기부채 자료 없음`
      : `${what} ${formatUsdShort(cash.liquid)} 대 장기부채 ${formatUsdShort(cash.debt)} — ${cash.net >= 0 ? `순현금 ${formatUsdShort(cash.net)}` : `순부채 ${formatUsdShort(-cash.net)}`}(${read.label} 말)`));
  }
  const cap = read.capital;
  const capital = [cap.sbcRatio != null ? `주식보상 매출의 ${cap.sbcRatio.toFixed(1)}%` : null, cap.buybacks != null ? `자사주 매입 ${formatUsdShort(cap.buybacks)}` : null, cap.dividends != null ? `배당 ${formatUsdShort(cap.dividends)}` : null].filter(Boolean);
  if (capital.length) lines.append(el(doc, 'li', `${capital.join(', ')}${cap.returnedShareOfFcf != null ? ` — 매입과 배당 합이 잉여현금흐름의 ${cap.returnedShareOfFcf.toFixed(0)}%` : ''}.`));
  if (lines.childElementCount) card.append(lines);
  card.append(disclosure(doc, '원리, 이익률 단계와 현금', [
    ['원리', '매출총이익률은 가격 결정력과 원가, 영업이익률은 판매·연구 비용을 쓴 뒤의 본업 수익성, 순이익률은 이자·세금·일회성 항목까지 반영한 결과입니다. 세 단계의 간격이 어디서 벌어지는지가 비용 구조를 보여 줍니다.'],
    ['지금 읽기', `${operating.value != null && net.value != null ? (net.value > operating.value ? '순이익률이 영업이익률보다 높아 이자 수익·투자 이익 같은 영업 밖 이익이 있었던 해입니다.' : `영업이익률과 순이익률의 차이 ${(operating.value - net.value).toFixed(1)}%p는 이자·세금·영업 밖 손익입니다.`) : '세 단계 중 공시된 값만 표시했습니다.'}${cap.sbcRatio != null && cap.sbcRatio >= 10 ? ' 주식보상이 매출의 10% 이상이라, 현금흐름에 더해지는 비현금 비용이지만 주식 수를 늘리는 실제 비용으로 함께 봅니다.' : ''}`],
    ['한계, 함께 볼 것', `순현금은 현금성 자산(단기투자 포함 시 표기)에서 장기부채만 뺀 값이며, 1년 안에 갚을 부채와 리스 부채는 빠져 있습니다.${financial ? ' 은행·대출 금융사는 현금과 부채가 영업 자산이라 순현금 줄을 표시하지 않습니다.' : ''} 매출총이익을 따로 표시하지 않는 업종(금융·서비스 일부)은 첫 단계가 비어 있습니다.`]
  ]));
  card.append(el(doc, 'p', '데이터, 미국 증권거래위원회 연간 공시(10-K)(최근 2개 회계연도)', 'sx-evidence'));
  return card;
}

// Same-theme companies by name. The broad-sector percentile stays below it, folded.
export function themePeerCard(doc, read, { onOpen = null } = {}) {
  if (!read?.rows?.length) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-theme-peers');
  card.dataset.analysis = 'theme-peers';
  card.setAttribute('aria-label', `같은 테마 기업 비교, ${read.themeName}`);
  card.append(cardHead(doc, '같은 테마 기업과 비교', `${read.themeName}${read.subNames.length ? `, ${read.subNames.join(' / ')}` : ''}`));
  const own = read.rows[0];
  const peers = read.rows.slice(1);
  const median = (field) => { const values = peers.map((row) => row[field]).filter((v) => v != null).sort((a, b) => a - b); if (!values.length) return null; const m = Math.floor(values.length / 2); return values.length % 2 ? values[m] : (values[m - 1] + values[m]) / 2; };
  const parts = [['growth', '매출 성장'], ['margin', '순이익률'], ['roe', 'ROE']].map(([field, label]) => {
    const mid = median(field);
    return own[field] != null && mid != null ? `${label} ${own[field].toFixed(1)}%(같은 테마 중앙값 ${mid.toFixed(1)}%)` : null;
  }).filter(Boolean);
  if (parts.length) card.append(el(doc, 'p', `${own.name} ${parts.join(', ')}.`, 'v2-analysis-lede'));
  const region = el(doc, 'div', null, 'fiscal-table-scroll');
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', '같은 테마 기업 비교표, 가로 스크롤');
  const table = el(doc, 'table', null, 'fiscal-amount-table');
  table.append(el(doc, 'caption', '각 회사의 최근 회계연도, 자료 없음은 0이 아닙니다'));
  const head = el(doc, 'thead'); const headRow = el(doc, 'tr');
  for (const label of ['기업', '회계연도', '매출 성장', '순이익률', 'ROE', 'PER']) { const th = el(doc, 'th', label); th.scope = 'col'; headRow.append(th); }
  head.append(headRow); table.append(head);
  const body = el(doc, 'tbody');
  const pctCell = (value) => (value == null ? '—' : `${value.toFixed(1)}%`);
  for (const row of read.rows) {
    const tr = el(doc, 'tr', null, row.self ? 'is-self' : null);
    const name = el(doc, 'th', null);
    name.scope = 'row';
    if (!row.self && typeof onOpen === 'function') {
      const go = el(doc, 'button', row.name === row.sym ? row.sym : `${row.name} (${row.sym})`, 'stock-read-point-link');
      go.type = 'button';
      go.addEventListener('click', () => onOpen(row.sym));
      name.append(go);
    } else name.textContent = `${row.name === row.sym ? row.sym : `${row.name} (${row.sym})`}${row.self ? ', 이 종목' : ''}`;
    tr.append(name, el(doc, 'td', fiscalYearShortLabel(row.periodEnd) || row.periodEnd || '—'),
      el(doc, 'td', pctCell(row.growth), row.growth < 0 ? 'is-loss' : null), el(doc, 'td', pctCell(row.margin), row.margin < 0 ? 'is-loss' : null),
      el(doc, 'td', pctCell(row.roe), row.roe < 0 ? 'is-loss' : null), el(doc, 'td', row.pe == null ? '—' : peMultipleText(row.pe)));
    body.append(tr);
  }
  table.append(body); region.append(table);
  card.append(region, el(doc, 'p', '테마는 AIO의 투자 분류이며 사업 비중이 같다는 뜻은 아닙니다. 회계연도 마감 시점이 회사마다 달라, 차이가 큰 회사는 같은 시기로 읽지 않습니다. PER은 스크리너의 공시 이익 기준이며 적자 회사는 표시하지 않습니다.', 'theme-strength-basis'));
  return card;
}

// v58.75: everything 재무 공시 adds for this pass, built here so the boot-loaded fiscal-read.js stays small. hero = lines
// under the annual headline; cards = margin/cash (only with a fiscal series) and the EPS surprise; themePeers = the table.
export function fiscalExtras(doc, { root, symbol, quarters, history, consensus, calendar, calendarState = null, rows, fundamentals, series = false, financial = false }) {
  const hero = [];
  const recent = trailingYearLine(buildTrailingYearRead(quarters));
  if (recent) hero.push(el(doc, 'p', recent, 'fiscal-period-basis v2-fiscal-recent'));
  const schedule = buildEarningsSchedule({ symbol, calendar, consensus, calendarState });
  if (schedule) { const line = el(doc, 'p', schedule.text, 'fiscal-period-basis sx-meta v2-fiscal-schedule'); if (schedule.title) line.title = schedule.title; hero.push(line); }
  const cards = [series ? marginCashCard(doc, buildMarginCashRead(history), { financial }) : null, surpriseCard(doc, buildSurpriseRead(consensus))].filter(Boolean);
  const fiscal = root?._aioSecFiscalHistory;
  const themePeers = fiscal ? themePeerCard(doc, buildThemePeers({ symbol, themes: root?.THEME_MAP, rows,
    seriesFor: (sym) => (fiscal[sym] ? reconcileFiscalHistory(parseFiscalHistory(fiscal[sym]), sym === symbol ? fundamentals : null, sym) : null) }),
  { onOpen: typeof root?.showTicker === 'function' ? (sym) => root.showTicker(sym) : null }) : null;
  // v58.75 ('고르는 법' B1/B3/B4): the business lens leads the analysis cards; the thesis template and the favourable/unfavourable
  // situations follow the reading.
  const lensCtx = series ? stockLensContext(root, symbol, { fundamentals, bars: root?._aioEntitySummaries?.[symbol]?.history || null }) : null;
  const lens = lensCtx ? lensCard(doc, lensCtx.lensRead) : null;
  if (lens) cards.unshift(lens);
  const after = lensCtx ? [thesisCard(doc, root, lensCtx), situationCard(doc, lensCtx)].filter(Boolean) : [];
  return { hero, cards, themePeers, after };
}
