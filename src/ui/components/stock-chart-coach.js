// v58.75 (owner decision 2026-10-24, teach-and-check D1-D6): the daily chart's teaching sections — '셋업 읽기' (setup
// life cycle, pre-breakout checklist, weekly/daily agreement, past breakouts) and '가격 레벨과 내 계획' (level map, how
// experts set stops and targets, the user's own plan check). Split from stock-chart.js and loaded with the first daily
// chart: stock-chart.js is reachable from bootstrap (openMarketChart), so these stay out of the boot module set.
import { buildPriceLevels, checkPricePlan } from '../../domain/technical/price-levels.js';
import { SETUP_STAGES, setupLifecycle, breakoutChecklist, timeframeAlignment, pastBreakouts, pastBreakoutsText } from '../../domain/technical/setup-coach.js';
import { buildEarningsSchedule } from '../../domain/fundamental/analysis-read.js';
import { EARNINGS_CALENDAR } from './fiscal-read.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { formatScreenerPrice } from '../../domain/screener/market-scope.js';
import { el } from './dom.js';
import { myLineFacts } from './stock-chart-drawings.js';
import { rewardRiskFacts, RR_GUIDE } from '../../domain/technical/chart-strategies.js';
import { signedText } from '../../domain/shared/number.js';

// The domain functions the sections use, passed as one object so stock-chart.js reads them through this lazy module.
export const tools = Object.freeze({ buildPriceLevels, checkPricePlan, SETUP_STAGES, setupLifecycle, breakoutChecklist, timeframeAlignment, pastBreakouts, pastBreakoutsText, buildEarningsSchedule });

// v58.75 (teach-and-check D1–D4, D6): '셋업 읽기' — the life-cycle band, the pre-breakout checklist (a count, with each
// principle and current value), the weekly/daily agreement and this stock's own past breakouts, then the next steps.
// The market line is the shared regime read and the lead scenario of the macro crossroads, never a new verdict.
const MARK = Object.freeze({ true: ['✓', '충족', 'is-pass'], false: ['✕', '미충족', 'is-fail'], null: ['–', '확인 불가', 'is-unknown'] });
function lifecycleBand(doc, life) {
  const band = el(doc, 'ol', null, 'chart-life-band');
  band.setAttribute('aria-label', '셋업 생애 주기');
  Object.assign(band.style, { display: 'grid', gridTemplateColumns: `repeat(${SETUP_STAGE_LABELS.length}, minmax(0, 1fr))`, gap: '3px', listStyle: 'none', padding: '0', margin: '8px 0 4px' });
  SETUP_STAGE_LABELS.forEach(([id, label], index) => {
    const current = life?.stage === id;
    const li = el(doc, 'li', `${index + 1} ${label}`);
    if (current) li.setAttribute('aria-current', 'step');
    Object.assign(li.style, { padding: '6px 4px', borderRadius: '4px', fontSize: '12px', textAlign: 'center', lineHeight: '1.3',
      background: current ? 'var(--accent)' : 'var(--surface-2, var(--bg-surface))', color: current ? 'var(--bg-card)' : 'var(--text-secondary)', fontWeight: current ? '700' : '400' });
    band.append(li);
  });
  return band;
}
const SETUP_STAGE_LABELS = Object.freeze([['base', '베이스'], ['approach', '피벗 접근'], ['breakout', '돌파'], ['follow', '후속 확인'], ['extended', '확장']]);

function marketContextLine(root, regime) {
  let lead = null;
  try {
    // The live interpretation's crossroads (the 거시 screen's own model); the per-refresh scenario state when it is absent.
    const live = marketInterpretation(root)?.crossroads;
    const crossroads = live?.leadId ? live : root?._aioScenarioState?.crossroads;
    const item = crossroads?.items?.find((row) => row.id === crossroads.leadId);
    if (item) lead = `${String(item.title || '').split(' — ')[0]}(${item.fit || `조건 충족 ${item.met}/${item.total}`})`;
  } catch (_) {}
  const state = regime?.available ? `지금 시장 상태 '${regime.overall}'` : '시장 상태 판정 대기';
  return `${state}${lead ? `, 조건이 가장 많이 맞는 시나리오 '${lead}'` : ''}.`;
}

function checklistBlock(doc, root, sym, analysis, regime, tools) {
  const earnings = /\.(KS|KQ)$/.test(sym) ? null : tools.buildEarningsSchedule({ symbol: sym, calendar: root?.[EARNINGS_CALENDAR.key] || null });
  const list = tools.breakoutChecklist(analysis, { regime, earnings });
  if (root.__aioSetupCoach?.symbol === sym) root.__aioSetupCoach.checklist = list;
  const box = el(doc, 'div', null, 'chart-breakout-check');
  box.id = 'chart-breakout-check';
  box.dataset.symbol = sym; // the late earnings redraw checks it still belongs to the charted symbol
  box.append(el(doc, 'h4', '돌파 전 점검표'), el(doc, 'p', list.headline, 'xr-reading'));
  const marks = el(doc, 'ul', null, 'chart-check-list');
  Object.assign(marks.style, { listStyle: 'none', padding: '0', margin: '4px 0', display: 'grid', gap: '4px', fontSize: '13px' });
  for (const item of list.items) {
    const [glyph, word, tone] = MARK[String(item.met)];
    const li = el(doc, 'li', null, `chart-check-item ${tone}`);
    const mark = el(doc, 'span', glyph, `chart-template-dot ${tone}`);
    mark.setAttribute('aria-label', word);
    mark.style.marginRight = '6px';
    const value = el(doc, 'span', ` — ${item.value}`);
    value.style.color = 'var(--text-secondary)';
    li.append(mark, el(doc, 'b', item.label), value);
    marks.append(li);
  }
  box.append(marks);
  const why = el(doc, 'details', null, 'chart-check-why');
  why.append(el(doc, 'summary', '각 조건을 보는 이유와 돌파 실패 조건'));
  for (const item of list.items) why.append(el(doc, 'p', `${item.label}: ${item.principle}`));
  why.append(el(doc, 'p', list.failedRule));
  const past = root.__aioSetupCoach?.symbol === sym ? root.__aioSetupCoach.pastBreakouts : tools.pastBreakoutsText(tools.pastBreakouts(analysis));
  if (past) why.append(el(doc, 'p', `이 종목의 과거 돌파: ${past}`));
  why.append(el(doc, 'p', '점검표는 전문가들이 돌파를 보기 전에 확인하는 조건의 개수를 셀 뿐이며, 모두 충족해도 돌파가 이어진다는 보장은 없습니다.', 'theme-strength-basis'));
  box.append(why);
  return box;
}

export function setupCoachSection(doc, root, sym, analysis, regime, tools, hasLevels) {
  const section = el(doc, 'section', null, 'chart-setup-coach');
  section.id = 'chart-setup-coach';
  section.append(el(doc, 'h3', '셋업 읽기', 'briefing-h2'));
  section.append(el(doc, 'p', `${analysis.asOf} 완료 일봉 기준. ${marketContextLine(root, regime)}`, 'theme-strength-basis'));
  const life = tools.setupLifecycle(analysis);
  // The AI panel reads the same life-cycle stage, checklist and timeframe reading the screen shows (null for another symbol).
  root.__aioSetupCoach = { symbol: sym, asOf: analysis.asOf, lifecycle: life, checklist: null, alignment: tools.timeframeAlignment(analysis), pastBreakouts: tools.pastBreakoutsText(tools.pastBreakouts(analysis)), market: marketContextLine(root, regime) };
  root._aioSetupCoachFor = (symbolArg) => { const want = String(symbolArg || '').trim().toUpperCase(); const current = root.__aioSetupCoach; return current && (!want || want === current.symbol) ? current : null; };
  if (life) {
    const box = el(doc, 'div', null, 'chart-life');
    box.append(el(doc, 'p', life.headline, 'xr-reading'), lifecycleBand(doc, life));
    if (life.check) box.append(el(doc, 'p', `이 단계에서 전문가가 확인하는 것: ${life.check}`, 'theme-strength-basis'));
    const stages = el(doc, 'details', null, 'chart-life-stages');
    stages.append(el(doc, 'summary', '단계마다 확인하는 것'));
    tools.SETUP_STAGES.forEach((item, index) => stages.append(el(doc, 'p', `${index + 1} ${item.label}: ${item.check}`)));
    box.append(stages);
    section.append(box);
  }
  section.append(checklistBlock(doc, root, sym, analysis, regime, tools));
  const align = root.__aioSetupCoach.alignment;
  if (align) {
    const box = el(doc, 'div', null, 'chart-timeframe');
    box.append(el(doc, 'h4', '주봉과 일봉이 같은 방향인가'), el(doc, 'p', `${align.headline}. ${align.reading}`));
    section.append(box);
  }
  // D6: the next steps of the top-down flow on this screen — the level map and the plan check below.
  if (hasLevels) {
    const next = el(doc, 'p', null, 'chart-coach-next');
    next.append(doc.createTextNode('다음 단계: '));
    [['chart-levels', '가격 레벨 지도'], ['chart-plan-entry', '내 계획 점검']].forEach(([target, label], index) => {
      const button = el(doc, 'button', `${label} ↓`, 'sx-link');
      button.type = 'button';
      button.addEventListener('click', () => { const node = doc.getElementById(target); node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); if (target === 'chart-plan-entry') node?.focus?.({ preventScroll: true }); });
      if (index) next.append(doc.createTextNode(' → '));
      next.append(button);
    });
    section.append(next);
  }
  // The earnings calendar is a shared artifact; when it arrives the checklist is redrawn in place.
  if (!/\.(KS|KQ)$/.test(sym)) refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed } = {}) => {
    const current = doc.getElementById('chart-breakout-check');
    if (changed && current && current.dataset.symbol === sym) current.replaceWith(checklistBlock(doc, root, sym, analysis, regime, tools));
  }).catch(() => {});
  return section;
}

// v58.75 (owner decision 2026-10-24): '가격 레벨과 내 계획' — the level map (reading → ladder → table), the published ways
// experts set stops and targets with this stock's own numbers, and a check of the user's own plan. The app never picks a
// price: every number here is a mapped level or arithmetic on the numbers the user typed.
const kindsText = (level) => level.kinds.join('·');
const sideWord = (level) => (level.side === 'above' ? '저항 후보' : '지지 후보');
export function nearestLevels(levels) { return [...levels.above.slice(0, 2), ...levels.below.slice(0, 2)]; }

function levelLadder(doc, levels) {
  const all = [...levels.above, ...levels.below];
  const max = Math.max(1, ...all.map((level) => Math.abs(level.pct)));
  const box = el(doc, 'div', null, 'chart-level-ladder');
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', `현재가 기준 위 레벨 ${levels.above.length}개, 아래 레벨 ${levels.below.length}개의 위치`);
  Object.assign(box.style, { position: 'relative', height: '30px', margin: '8px 0 4px' });
  const track = el(doc, 'span');
  Object.assign(track.style, { position: 'absolute', left: '0', right: '0', top: '14px', height: '2px', background: 'var(--border)' });
  box.append(track);
  const at = (pct) => `${(50 + pct / max * 48).toFixed(1)}%`;
  for (const level of all) {
    const tick = el(doc, 'span');
    tick.title = `${sideWord(level)} ${signedText(level.pct, 1, '%')} (${kindsText(level)})`;
    Object.assign(tick.style, { position: 'absolute', left: at(level.pct), top: '8px', width: '2px', height: '14px', background: 'var(--text-secondary)', transform: 'translateX(-1px)' });
    box.append(tick);
  }
  const now = el(doc, 'span');
  Object.assign(now.style, { position: 'absolute', left: '50%', top: '4px', width: '10px', height: '22px', borderRadius: '3px', background: 'var(--accent)', transform: 'translateX(-5px)' });
  box.append(now);
  const scale = el(doc, 'div', null, 'chart-level-scale');
  Object.assign(scale.style, { display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' });
  scale.append(el(doc, 'span', `아래 ${signedText(-max, 1, '%')}`), el(doc, 'span', '현재가'), el(doc, 'span', `위 ${signedText(max, 1, '%')}`));
  const wrap = el(doc, 'div');
  wrap.append(box, scale);
  return wrap;
}

function levelTable(doc, levels, price) {
  const scroll = el(doc, 'div', null, 'aio-table-scroll');
  scroll.style.overflowX = 'auto';
  const table = el(doc, 'table', null, 'aio-table chart-level-table');
  const caption = el(doc, 'caption', '현재가 위·아래 가격 레벨 (가까운 순, 위는 먼 것부터)');
  caption.className = 'sr-only';
  Object.assign(caption.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' });
  const head = el(doc, 'thead'); const headRow = el(doc, 'tr');
  // Three columns so a phone keeps the words readable: the kinds sit under the price, the ADR multiple under the distance.
  ['가격·종류', '현재가 대비', '반응'].forEach((label) => { const th = el(doc, 'th', label); th.scope = 'col'; headRow.append(th); });
  head.append(headRow);
  const body = el(doc, 'tbody');
  const small = (textValue) => { const node = el(doc, 'small', textValue); Object.assign(node.style, { display: 'block', color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'normal' }); return node; };
  const row = (level) => {
    const tr = el(doc, 'tr');
    const priceCell = el(doc, 'td');
    const amount = el(doc, 'span', level.low !== level.high && (level.high - level.low) / level.price > 0.003 ? `${price(level.low)}~${price(level.high)}` : price(level.price));
    amount.style.whiteSpace = 'nowrap';
    priceCell.append(amount, small(`${sideWord(level)}: ${kindsText(level)}`));
    const dist = el(doc, 'td');
    const multiple = small(`변동폭 ${Math.abs(level.adrMultiple).toFixed(1)}배`);
    multiple.style.whiteSpace = 'nowrap';
    dist.append(el(doc, 'span', signedText(level.pct, 1, '%')), multiple);
    const reactions = el(doc, 'td', `${level.reactions}회`);
    [priceCell, dist, reactions].forEach((td) => { td.style.fontVariantNumeric = 'tabular-nums'; });
    dist.style.whiteSpace = 'nowrap'; reactions.style.whiteSpace = 'nowrap';
    tr.append(priceCell, dist, reactions);
    return tr;
  };
  [...levels.above].sort((a, b) => b.price - a.price).forEach((level) => body.append(row(level)));
  const now = el(doc, 'tr'); const cellNow = el(doc, 'td', `현재가 ${price(levels.close)} (${levels.asOf} 종가)`); cellNow.colSpan = 3; cellNow.style.fontWeight = '600'; now.append(cellNow); body.append(now);
  levels.below.forEach((level) => body.append(row(level)));
  table.append(caption, head, body);
  scroll.append(table);
  return scroll;
}

function expertMethods(doc, levels, price) {
  const details = el(doc, 'details', null, 'chart-level-methods');
  details.append(el(doc, 'summary', '전문가는 이렇게 정한다 — 손절·목표를 정하는 방법과 이 종목의 기준 숫자'));
  const item = (title, basis, plus, minus) => {
    const box = el(doc, 'div', null, 'chart-level-method');
    box.append(el(doc, 'h4', title), el(doc, 'p', basis), el(doc, 'p', `장점: ${plus} 약점: ${minus}`, 'theme-strength-basis'));
    details.append(box);
  };
  const close = levels.close;
  const swing = levels.swingLowBelow ? `가장 최근 스윙 저점은 ${price(levels.swingLowBelow.price)}(${levels.swingLowBelow.time})` : '현재가 아래 확인된 스윙 저점이 없습니다';
  const contraction = levels.contractionLow && levels.contractionLow < close ? `, 마지막 수축 저점은 ${price(levels.contractionLow)}` : '';
  details.append(el(doc, 'h4', '손절을 정하는 세 가지 방법'));
  item('구조 기준 — 마지막 저점 아래', `${swing}${contraction}입니다. 이 방법을 쓰면 기준이 되는 레벨은 그 저점이며, 저점 아래에 둡니다.`, '가격 구조가 깨졌다는 뜻이 분명합니다.', '저점이 멀면 위험 폭이 커지고, 같은 저점을 보는 사람이 많아 잠깐 밑돌았다 돌아오기도 합니다.');
  item('변동성 기준 — 하루 변동폭의 몇 배', levels.atr > 0 ? `일평균 변동폭 ${levels.adrPct.toFixed(1)}%, ATR(14) ${price(levels.atr)}입니다. 종가에서 ATR 1배 아래는 ${price(close - levels.atr)}, 2배 아래는 ${price(close - 2 * levels.atr)}입니다.` : `일평균 변동폭 ${levels.adrPct.toFixed(1)}%입니다.`, '종목마다 다른 흔들림 폭을 반영합니다.', '차트 구조와 관계없는 가격이 될 수 있습니다.');
  item('시간 기준 — 정한 기간 안에 진행이 없으면', '진입 전에 기간(예: 5~10거래일)을 정하고, 그 안에 가격이 진행하지 않으면 계획을 다시 봅니다.', '움직이지 않는 자리에 돈이 묶이는 시간을 제한합니다.', '가격 기준이 없어 그 사이 낙폭은 다른 기준과 함께 막아야 합니다.');
  details.append(el(doc, 'h4', '목표를 정하는 세 가지 방법'));
  const next = levels.above[0];
  item('다음 저항 구간', next ? `가장 가까운 저항 후보는 ${price(next.price)}(${kindsText(next)}, ${signedText(next.pct, 1, '%')})입니다.` : '현재가 위에 지도 위 레벨이 없습니다(최근 고점 위 구간).', '실제로 매도가 나왔던 가격을 씁니다.', '강한 추세에서는 저항 후보를 그대로 지나치기도 합니다.');
  const anchor = levels.pivot ?? levels.base?.high;
  item('측정 이동폭 — 베이스 깊이만큼', levels.base && anchor ? `베이스 깊이는 ${price(levels.base.depth)}(${levels.base.depthPct.toFixed(1)}%)입니다. 피벗 ${price(anchor)}에 더하면 ${price(anchor + levels.base.depth)}입니다.` : '유효한 베이스(차례로 얕아지는 수축)가 확인되지 않아 계산하지 않습니다.', '패턴 크기에 비례해 기계적으로 계산됩니다.', '같은 폭이 반복된다는 보장은 없습니다.');
  item('위험 대비 배수(R)', '진입가~손절가 거리를 1R로 두고 2R·3R 지점을 봅니다. 아래 \'내 계획 점검\'에 손절가를 넣으면 배수가 계산됩니다.', '손익 비율을 진입 전에 정해 둡니다.', '차트의 실제 저항과 관계없는 가격일 수 있습니다.');
  details.append(el(doc, 'p', '앱은 가격을 고르지 않습니다. 방법을 고르고 숫자는 직접 정하세요.', 'xr-reading'));
  return details;
}

const PLAN_FIELDS = Object.freeze([
  ['entry', '진입가(가정)'], ['stop', '손절가'], ['target', '목표가(선택)'], ['amount', '투입 금액(선택)'], ['capital', '전체 자본(선택)']
]);
// v58.75: the plan stays in memory for this page only (UI modules do not touch browser storage — architecture
// contract); a reload clears it, which also keeps amounts and capital off the device.
const PLANS = new Map();
function readPlan(root, sym) { return { ...(PLANS.get(sym) || {}) }; }
function savePlan(root, sym, plan) { PLANS.set(sym, { ...plan }); }

export function planFacts(result, price) {
  if (!result?.available) return [result?.reason === 'stop-equals-entry' ? '손절가가 진입가와 같아 위험 폭이 0입니다.' : '진입가와 손절가를 넣으면 계산합니다.'];
  const facts = [];
  const list = (levels) => levels.map((level) => `${price(level.price)} ${kindsText(level)}`).join(', ');
  const below = result.direction === 'long';
  if (!below) facts.push('손절가가 진입가보다 높아 하락에 거는 계획으로 계산합니다.');
  facts.push(`진입가~손절가 위험 폭 ${result.riskPct.toFixed(1)}% (일평균 변동폭의 ${result.riskAdr.toFixed(1)}배).`);
  if (result.stopVsLevel) facts.push(`손절가 ${price(result.stop)}는 ${sideWord(result.stopVsLevel.level)} ${price(result.stopVsLevel.level.price)}(${kindsText(result.stopVsLevel.level)})보다 ${Math.abs(result.stopVsLevel.pct).toFixed(1)}% ${below ? '아래' : '위'}입니다 (변동폭 ${Math.abs(result.stopVsLevel.adrMultiple).toFixed(1)}배).`);
  else facts.push('진입가와 손절가 사이에 지도 위 레벨이 없습니다.');
  if (result.stopBeyond) facts.push(`손절가 너머 가장 가까운 레벨은 ${price(result.stopBeyond.level.price)}(${kindsText(result.stopBeyond.level)}), 손절가에서 ${Math.abs(result.stopBeyond.pct).toFixed(1)}% ${below ? '아래' : '위'}입니다.`);
  if (result.levelsToStop.length > 1) facts.push(`손절가까지 가는 길에 레벨 ${result.levelsToStop.length}개: ${list(result.levelsToStop)}.`);
  if (result.target != null) {
    facts.push(result.levelsToTarget.length ? `목표가까지 가는 길에 ${below ? '저항' : '지지'} 후보 ${result.levelsToTarget.length}개: ${list(result.levelsToTarget)}.` : '진입가와 목표가 사이에 지도 위 레벨이 없습니다.');
    facts.push(`위험 1 대비 보상 ${result.rewardRisk.toFixed(1)}배 (목표가까지 ${result.rewardPct.toFixed(1)}%, 손절가까지 ${result.riskPct.toFixed(1)}%).`);
    const rr = rewardRiskFacts(result.rewardRisk);
    if (rr) facts.push(rr.text);
  } else if (result.targetIgnored) facts.push('목표가가 손절가와 같은 쪽에 있어 보상 배수를 계산하지 않았습니다.');
  if (result.lossAtStop != null) facts.push(`투입 금액 기준 손절가 도달 시 손실 약 ${price(result.lossAtStop)}${result.lossOfCapitalPct != null ? `, 전체 자본의 ${result.lossOfCapitalPct.toFixed(2)}%` : ''}.`);
  facts.push('갭·체결 미끄러짐·수수료는 반영하지 않은 계산입니다.');
  return facts;
}

function holdingCost(root, sym) {
  const surface = root?._aioPortfolioSurface;
  if (!surface || surface.readState !== 'ready') return null;
  const row = (Array.isArray(surface.rows) ? surface.rows : []).find((item) => String(item?.symbol || item?.ticker || '').toUpperCase() === sym);
  const cost = Number(row?.avgCost);
  return Number.isFinite(cost) && cost > 0 ? cost : null;
}

function rrGuide(doc) {
  const details = el(doc, 'details', null, 'chart-rr-guide');
  details.append(el(doc, 'summary', '손익비(R:R) 쉽게 — 계산과 본전 승률'));
  RR_GUIDE.forEach((line) => details.append(el(doc, 'p', line)));
  const scroll = el(doc, 'div', null, 'aio-table-scroll');
  scroll.style.overflowX = 'auto';
  const table = el(doc, 'table', null, 'aio-table');
  const head = el(doc, 'tr');
  ['손익비', '본전 승률', '10번 중 맞아야 하는 횟수'].forEach((label) => { const th = el(doc, 'th', label); th.scope = 'col'; head.append(th); });
  const thead = el(doc, 'thead'); thead.append(head);
  const body = el(doc, 'tbody');
  for (const ratio of [1, 1.5, 2, 3]) {
    const rr = rewardRiskFacts(ratio);
    const tr = el(doc, 'tr');
    tr.append(el(doc, 'td', `${ratio} : 1`), el(doc, 'td', `${rr.breakevenWinRate.toFixed(0)}%`), el(doc, 'td', `${(rr.breakevenWinRate / 10).toFixed(1)}번`));
    body.append(tr);
  }
  table.append(thead, body);
  scroll.append(table);
  details.append(scroll);
  return details;
}

function planCheck(doc, root, sym, levels, price, checkPricePlan) {
  const box = el(doc, 'div', null, 'chart-plan-check');
  box.append(el(doc, 'h4', '내 계획 점검'), el(doc, 'p', '내가 정한 가격을 넣으면 레벨 지도와 비교한 사실만 보여 줍니다. 입력값은 이 브라우저 탭에만 잠시 남습니다.', 'theme-strength-basis'));
  const stored = readPlan(root, sym);
  // v58.79 (chart review): a holding opened from the portfolio starts from its average cost, not today's close.
  const held = holdingCost(root, sym);
  const grid = el(doc, 'div', null, 'chart-plan-fields');
  Object.assign(grid.style, { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', margin: '6px 0' });
  const inputs = {};
  for (const [key, label] of PLAN_FIELDS) {
    const field = el(doc, 'label');
    Object.assign(field.style, { display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: 'var(--text-secondary)' });
    const input = el(doc, 'input');
    input.type = 'number'; input.inputMode = 'decimal'; input.step = 'any'; input.min = '0';
    input.id = `chart-plan-${key}`;
    input.value = stored[key] != null ? String(stored[key]) : key === 'entry' ? String(Number((held ?? levels.close).toFixed((held ?? levels.close) >= 1000 ? 0 : 2))) : '';
    // Touch browsers zoom into inputs under 16px (owner rule: touch-input 16px).
    Object.assign(input.style, { fontSize: '16px', padding: '6px 8px', border: '0.5px solid var(--border)', borderRadius: '6px', background: 'var(--bg-card)', color: 'var(--text-primary)', minWidth: '0' });
    field.append(doc.createTextNode(key === 'entry' && held != null && stored.entry == null ? '진입가(보유 평균 단가)' : label), input);
    grid.append(field);
    inputs[key] = input;
  }
  const out = el(doc, 'ul', null, 'chart-plan-facts');
  out.setAttribute('aria-live', 'polite');
  Object.assign(out.style, { margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6' });
  const update = () => {
    const plan = Object.fromEntries(PLAN_FIELDS.map(([key]) => [key, inputs[key].value === '' ? null : Number(inputs[key].value)]));
    savePlan(root, sym, plan);
    out.replaceChildren(...planFacts(checkPricePlan(levels, plan), price).map((line) => el(doc, 'li', line)));
  };
  Object.values(inputs).forEach((input) => input.addEventListener('input', update));
  update();
  box.append(grid, out);
  // v58.79: the lines the user drew on the chart, read against the map; each can fill the stop or target field.
  const mineBox = el(doc, 'ul', null, 'chart-plan-mine');
  Object.assign(mineBox.style, { margin: '6px 0 0', paddingLeft: '18px', fontSize: '13px', lineHeight: '1.6' });
  const fill = (key, value) => { inputs[key].value = String(value); update(); };
  const renderMine = () => {
    const facts = myLineFacts(sym, levels, price);
    mineBox.hidden = !facts.length;
    mineBox.replaceChildren(...facts.map((fact) => {
      const item = el(doc, 'li', `${fact.text} `);
      for (const [key, label] of [['stop', '손절가에'], ['target', '목표가에']]) {
        const button = el(doc, 'button', label, 'aio-btn-table');
        button.type = 'button';
        button.addEventListener('click', () => fill(key, fact.value));
        item.append(button);
      }
      return item;
    }));
  };
  root.__aioMyLinesChanged = (changed) => { if (changed === sym && mineBox.isConnected) renderMine(); };
  renderMine();
  box.append(mineBox);
  return box;
}

export function priceLevelSection(doc, root, sym, levels, currency, instance, checkPricePlan) {
  const section = el(doc, 'section', null, 'chart-levels');
  section.id = 'chart-levels';
  const price = (value) => formatScreenerPrice(value, currency);
  section.append(el(doc, 'h3', '가격 레벨과 내 계획', 'briefing-h2'));
  section.append(el(doc, 'p', `${levels.asOf} 완료 일봉 기준, 현재가 ${price(levels.close)}. 관찰할 가격대이며 매매 가격 제안이 아닙니다.`, 'theme-strength-basis'));
  const up = levels.above[0], down = levels.below[0];
  const lead = [up ? `가장 가까운 저항 후보는 ${signedText(up.pct, 1, '%')} 위 ${price(up.price)}(${kindsText(up)})` : '현재가 위에는 지도 위 레벨이 없고',
    down ? `지지 후보는 ${signedText(down.pct, 1, '%')} 아래 ${price(down.price)}(${kindsText(down)})입니다` : '아래에는 지도 위 레벨이 없습니다'].join(', ');
  section.append(el(doc, 'p', `${lead}.`, 'xr-reading'));
  section.append(levelLadder(doc, levels), levelTable(doc, levels, price));
  if (instance?.setLevels) {
    const toggle = el(doc, 'label', null, 'chart-level-toggle');
    Object.assign(toggle.style, { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', margin: '6px 0' });
    const box = el(doc, 'input'); box.type = 'checkbox'; box.id = 'chart-level-all';
    box.addEventListener('change', () => instance.setLevels(box.checked ? [...levels.above, ...levels.below] : nearestLevels(levels)));
    toggle.append(box, doc.createTextNode('차트에 레벨 전체 표시 (기본: 가장 가까운 위 2개·아래 2개, 연한 점선)'));
    section.append(toggle);
  }
  const how = el(doc, 'details', null, 'chart-level-definitions');
  how.append(el(doc, 'summary', '레벨을 찾는 방법과 읽는 법'));
  const R = levels.rules;
  [
    `스윙 고점·저점: 좌우 ${R.swingSpan}개 봉보다 높은 고가·낮은 저가, 최근 ${R.lookback}거래일. 50·200일선, 21일 EMA, 20일·${levels.rangeLabel} 고저, 피벗과 마지막 수축 저점도 함께 씁니다.`,
    '거래 집중 가격대: 최근 130거래일 거래량을 그날 저가~고가에 고르게 나눠 많이 쌓인 세 구간(일봉 추정). 미메운 갭: 전일 범위를 건너뛰고 열린 뒤 아직 되돌아오지 않은 가격 범위(가격의 0.3% 이상).',
    `가까운 레벨은 묶습니다: 가장 낮은 레벨에서 일평균 변동폭의 ${R.mergeAdr}배 이내에 있는 레벨은 한 구간이고, 종류에 모두 적습니다. '변동폭 N배'는 현재가와의 거리를 일평균 변동폭(${levels.adrPct.toFixed(1)}%)으로 나눈 값입니다.`,
    `반응 횟수: 최근 ${R.lookback}거래일 중 고가가 그 구간(변동폭 ${R.touchAdr}배 여유)에 닿고 종가는 구간 아래에서 끝났거나, 저가가 닿고 종가는 구간 위에서 끝난 봉의 수입니다. 많을수록 그 가격에서 매매가 자주 갈렸다는 뜻입니다.`,
    '지지 후보·저항 후보는 관찰할 가격대이며 그 가격에서 멈추거나 되돌아선다는 보장은 없습니다.'
  ].forEach((line) => how.append(el(doc, 'p', line)));
  section.append(how, expertMethods(doc, levels, price), rrGuide(doc), planCheck(doc, root, sym, levels, price, checkPricePlan));
  return section;
}

