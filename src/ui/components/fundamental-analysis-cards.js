// v58.55 (개편 v2 3d/5g): the analysis cards v58.53 left out — 듀폰 분해 and 역 DCF on 종목 요약, R&D 비율 on 재무 공시.
// Readings come from src/domain/fundamental/analysis-read.js; this file only draws them. A card whose inputs are not yet
// collected says "수집 대기 · 다음 SEC 갱신 후 표시"; a filer that does not tag an item says so — never a zero.
import { buildDupontRead, buildRdRead, impliedGrowth, dcfValue, reverseDcfInputs, REVERSE_DCF_DEFAULTS } from '../../domain/fundamental/analysis-read.js';
import { formatUsdShort } from '../../domain/fundamental/fiscal-read.js';
import { fiscalYearShortLabel } from '../../domain/fundamental/period.js';
import { el } from './dom.js';

export const COLLECTION_PENDING_LABEL = '수집 대기, 다음 SEC 갱신 후 표시';
const pct = (value, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const ratio = (value) => value.toFixed(Math.abs(value) < 0.1 ? 3 : 2);
const signedPct = (value, digits = 1) => `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(digits)}%`;

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
export function pendingNote(doc, what) {
  const box = el(doc, 'div', null, 'v2-analysis-pending');
  box.setAttribute('role', 'status');
  box.append(el(doc, 'span', COLLECTION_PENDING_LABEL, 'sx-chip sx-chip--sm sx-chip--date'),
    el(doc, 'p', `${what}에 필요한 총자산·R&D 항목을 SEC 연간 공시에서 새로 수집하고 있습니다. 공시 갱신은 하루 다섯 번, 회차마다 일부 기업씩 진행되며 이 기업 차례가 오면 자동으로 표시됩니다. 그 전까지 값을 추정하지 않습니다.`, 'v2-analysis-pending__text'));
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
  card.append(el(doc, 'p', '근거, DuPont 분해(1920년대), 수익성 평균 회귀(Fama·French 2000), 데이터, SEC EDGAR XBRL 연간 공시(10-K)', 'sx-evidence'));
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
  result.append(resultName, resultValue, resultText, sensitivity);
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
    resultValue.textContent = solved.state === 'ready' ? `연 ${signedPct(solved.growth)}` : solved.state === 'above-range' ? `연 +${pct(solved.bound, 0)} 초과` : solved.state === 'below-range' ? `연 −${pct(Math.abs(solved.bound), 0)} 미만` : '—';
    resultText.textContent = growthSentence(solved);
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
  const lede = `${read.latest.label} 연구개발비 ${formatUsdShort(read.latest.rd)} — 매출의 ${pct(read.latest.ratio)}${read.deltaPp != null ? ` (${read.first.label} ${pct(read.first.ratio)}에서 ${Math.abs(read.deltaPp) < 0.5 ? '비슷한 수준' : `${read.deltaPp > 0 ? '+' : '−'}${Math.abs(read.deltaPp).toFixed(1)}%p`})` : ''}.${read.latestIsNewest ? '' : ' 최근 회계연도에는 R&D가 따로 표시되지 않았습니다.'}`;
  card.append(el(doc, 'p', lede, 'v2-analysis-lede'), trend);
  card.append(disclosure(doc, '원리, R&D 비율', [
    ['원리', '연구개발비는 회계상 비용으로 바로 처리되지만 성격은 미래 매출을 위한 투자에 가깝습니다. 매출 대비 비율이 높고 꾸준한 기업은 장부 이익이 실제 경제적 이익보다 낮게 잡히는 경향이 있습니다.'],
    ['지금 읽기', '막대는 공시된 회계연도별 R&D ÷ 매출입니다. 비율이 오르면 매출보다 투자가 빨리 늘었거나 매출이 줄었다는 뜻이라 매출 흐름과 함께 봅니다.'],
    ['한계, 함께 볼 것', '업종마다 정상 수준이 크게 다릅니다(소프트웨어·제약은 높고 유통·금융은 거의 없음). 인수한 연구개발(IPR&D)이 섞인 해는 10-K 원문에서 확인합니다.']
  ]));
  card.append(el(doc, 'p', '근거, Lev·Sougiannis(1996) R&D 자본화와 수익률, 데이터, SEC EDGAR XBRL 연간 공시', 'sx-evidence'));
  return card;
}
