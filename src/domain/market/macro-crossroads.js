// P1742/P1743 (owner 2026-10-13): the forward view as a general engine, not a set of named examples.
//   signals  — every macro/market observation the branches can test, computed once from published artifacts
//   BRANCHES — a registry of macro paths; each is data: rule conditions, a cause→effect chain, exposure tags it
//              strengthens/weakens (themes inherit these through src/domain/scenarios/exposures.js), release
//              triggers that can be scored automatically when the data lands, a market-pricing line, and the
//              reader's four choices with their opportunity cost and the relatively favoured one.
// Likelihood has three evidence lines only (AGENTS 2026-10-13): met-condition count, the direction market prices
// lean, and past frequency (long history from scenario-outcomes.json when published, else AIO's own closes) with its
// sample size. Never a probability percentage, a price, a size, a date to act or a named stock.
import { buildCloseSeries, sessionPointBack } from '../briefing/market-read.js';
import { seriesOf, yoySeries, annualised3m } from '../macro/macro-read.js';
import { RULES } from '../rules/thresholds.js';
import { BRANCH_ANALOGS, analogOutcome, frequencyText } from '../scenarios/analogs.js';
import { EXPOSURE_TAGS } from '../scenarios/exposures.js';

export const MACRO_CROSSROADS_VERSION = 'macro-crossroads.v2';

const G = RULES.growth;
const P = RULES.policy;
const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const last = (series) => series.length ? series[series.length - 1] : null;
// v57.54 review: "20거래일" counts open sessions like 시장 상태 and 거시 (sessionPointBack), not array slots — a gap
// in the record made WTI read -7.2% here and -11.4% there on the same day.
const changeOver = (series, n) => { const back = sessionPointBack(series, n); return back ? series[series.length - 1].value - back.value : null; };
const pctOver = (series, n) => { const back = sessionPointBack(series, n); return back?.value ? (series[series.length - 1].value / back.value - 1) * 100 : null; };
const fmt = (value, digits = 1) => value == null ? '—' : value.toFixed(digits);
const signed = (value, digits = 1, unit = '') => value == null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}${unit}`;
// v57.54 audit (5): a change in a yield or a yield spread is written in bp everywhere (briefing already did: 10년물 +28bp).
const bpChange = (value) => value == null ? '—' : signed(value * 100, 0, 'bp');
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const has = (value) => value != null;
const all = (...values) => values.every(has);

export const CHOICES = Object.freeze({
  wait: '기다림 (현금 · 단기채)',
  stage: '분할 접근',
  hold: '보유 유지',
  defend: '방어 전환'
});

// Which present structure (src/domain/market/regime-scenarios.js) a branch tends to push the market toward — the bridge
// from "지금 구조" to "앞으로의 갈림길".
export const SHAPES = Object.freeze({ expansion: '확산 회복', concentration: '집중 유지', weakness: '동반 약화' });

export const EVENT_NAMES = Object.freeze({ 'us-cpi': 'CPI (소비자물가)', 'us-nfp': '고용보고서', 'us-pce': 'PCE (연준 기준 물가)', 'us-fed-rate': 'FOMC 회의', 'us-retail': '소매판매', 'us-ism-mfg': 'ISM 제조업' });

/** Upcoming official releases: the published schedule first, the curated calendar for the rest. */
export function upcomingMacroEvents({ releases = {}, schedules = {}, nowMs = Date.now(), horizonDays = 45 } = {}) {
  const today = new Date(nowMs).toISOString().slice(0, 10);
  const horizon = new Date(nowMs + horizonDays * 86400000).toISOString().slice(0, 10);
  const alias = { 'us-fomc': 'us-fed-rate' }; // the official FOMC page and the policy-rate release share one date set
  const out = new Map();
  for (const [rawId, dates] of Object.entries(schedules || {})) {
    const id = alias[rawId] || rawId;
    if (out.has(id)) continue;
    const next = (Array.isArray(dates) ? dates : []).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today).sort()[0];
    if (next) out.set(id, next);
  }
  for (const [id, row] of Object.entries(releases || {})) {
    const date = String(row?.nextRelease || '').slice(0, 10);
    if (!out.has(id) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today) out.set(id, date);
  }
  return [...out].filter(([id, date]) => EVENT_NAMES[id] && date <= horizon).map(([id, date]) => ({ id, name: EVENT_NAMES[id], date })).sort((a, b) => a.date.localeCompare(b.date));
}

/** The latest published value of each scorable release (what the producer compares against the branch triggers). */
export function releaseActuals(macroHistory) {
  const mom = (field) => { const s = seriesOf(macroHistory, field); return s.length > 1 && s[s.length - 2].value ? { date: last(s).date, value: (last(s).value / s[s.length - 2].value - 1) * 100 } : null; };
  const out = {};
  const core = mom('coreCpiIndex'), head = mom('cpiIndex');
  if (core) out['us-cpi'] = { period: core.date, coreMoM: core.value, headMoM: head?.date === core.date ? head.value : null };
  const payrolls = seriesOf(macroHistory, 'payrolls'), unemployment = seriesOf(macroHistory, 'unemployment'), wages = mom('hourlyEarnings');
  if (payrolls.length > 1) {
    const u = unemployment.length > 1 && last(unemployment).date === last(payrolls).date ? last(unemployment).value - unemployment[unemployment.length - 2].value : null;
    out['us-nfp'] = { period: last(payrolls).date, payroll: last(payrolls).value - payrolls[payrolls.length - 2].value, unempDelta: u, wageMoM: wages?.date === last(payrolls).date ? wages.value : null };
  }
  const pce = mom('corePceIndex');
  if (pce) out['us-pce'] = { period: pce.date, coreMoM: pce.value };
  const retail = seriesOf(macroHistory, 'retailSales');
  if (retail.length > 2) { const m = (i) => (retail[i].value / retail[i - 1].value - 1) * 100; out['us-retail'] = { period: last(retail).date, mom: m(retail.length - 1), prevMom: m(retail.length - 2) }; }
  const fed = seriesOf(macroHistory, 'fedTargetUpper');
  // The target range is a daily series: the "release" is the last change, dated by the day it took effect.
  if (fed.length > 1) { let i = fed.length - 1; while (i > 0 && fed[i - 1].value === fed[i].value) i -= 1; if (i > 0) out['us-fed-rate'] = { period: fed[i].date, upperDelta: fed[i].value - fed[i - 1].value }; }
  return out;
}

const ACTUAL_TEXT = {
  'us-cpi': (a) => `근원 CPI 전월 대비 ${signed(a.coreMoM, 2, '%')}${a.headMoM != null ? ` · 헤드라인 ${signed(a.headMoM, 2, '%')}` : ''}`,
  'us-nfp': (a) => `일자리 ${signed(a.payroll, 0)}천 명${a.unempDelta != null ? ` · 실업률 ${signed(a.unempDelta, 1, '%p')}` : ''}${a.wageMoM != null ? ` · 시간당 임금 ${signed(a.wageMoM, 2, '%')}` : ''}`,
  'us-pce': (a) => `근원 PCE 전월 대비 ${signed(a.coreMoM, 2, '%')}`,
  'us-retail': (a) => `소매판매 전월 대비 ${signed(a.mom, 1, '%')} (직전 달 ${signed(a.prevMom, 1, '%')})`,
  'us-fed-rate': (a) => `연준 상단 금리 ${bpChange(a.upperDelta)}`
};
export const actualText = (id, actual) => (ACTUAL_TEXT[id] && actual ? ACTUAL_TEXT[id](actual) : '');

export function buildScenarioSignals({ read = null, macroHistory = null, history = [] } = {}) {
  const axis = (id) => read?.axes?.find((row) => row.id === id) || null;
  const growth = axis('growth')?.detail || {}, inflation = axis('inflation')?.detail || {}, policy = axis('policy')?.detail || {};
  const close = (field) => buildCloseSeries(history, field);
  const wti = close('wti'), tnx = close('tnx'), spx = close('spx'), dxy = close('dxy'), krw = close('usdkrw'), vix = close('vix'), vix3m = close('vix3m');
  const mh = (field) => seriesOf(macroHistory, field);
  const ccc = mh('cccOas'), b = mh('bOas');
  const bByDate = new Map(b.map((row) => [row.date, row.value]));
  const gap = ccc.filter((row) => bByDate.has(row.date)).map((row) => ({ date: row.date, value: (row.value - bByDate.get(row.date)) * 100 }));
  const nfci = mh('financialConditions');
  const hy = mh('hyOas');
  const pricing = finite(policy.pricing);
  const vixLast = last(vix), vix3mLast = last(vix3m);
  const oil20 = pctOver(wti, 20);
  const oilVsYear = wti.length >= 120 ? (last(wti).value / (wti.slice(-250).reduce((sum, p) => sum + p.value, 0) / Math.min(250, wti.length)) - 1) * 100 : null;
  const hy20 = changeOver(hy, 20);
  // Brent beside WTI (buildMacroRead().oil → brentWtiCheck): an abnormal same-day gap is never compared.
  const oilCheck = read?.oil && !read.oil.abnormal ? read.oil : null;
  return {
    sahm: finite(growth.sahm?.value), payroll3: finite(growth.payroll?.avg3), payrollPrior3: finite(growth.payroll?.prior3), claimsUp: finite(growth.claims?.aboveLow),
    coreYoy: finite(inflation.yoy), corePace: finite(inflation.pace?.value), accelerating: inflation.accelerating ?? null,
    coreCpiPace: finite(annualised3m(mh('coreCpiIndex'))?.value),
    wageYoy: finite(last(yoySeries(mh('hourlyEarnings')))?.value), retailYoy: finite(last(yoySeries(mh('retailSales')))?.value),
    sentiment: finite(last(mh('consumerSentiment'))?.value),
    breakeven20: changeOver(mh('breakeven10'), 20), termPremium: mh('termPremium10'), termPremium20: changeOver(mh('termPremium10'), 20),
    curve20: changeOver(mh('t10y3m'), 20), hy20: hy20 == null ? null : hy20 * 100,
    cccGap20: changeOver(gap, 20), nfci: finite(last(nfci)?.value), nfci4: changeOver(nfci, 4),
    cash: last(mh('sofr')), oil20, oilVsYear, brent20: finite(oilCheck?.brent20), brentBasis: oilCheck?.basis || null, oilSurging: oil20 == null ? null : oil20 >= 10 || (oilVsYear != null && oilVsYear >= 25),
    tnx: last(tnx), tnx20: changeOver(tnx, 20), spx5: pctOver(spx, 5), spx20: pctOver(spx, 20), dxy20: pctOver(dxy, 20), krw20: pctOver(krw, 20),
    vix: vixLast?.value ?? null, vixRatio: vixLast && vix3mLast && vixLast.date === vix3mLast.date && vix3mLast.value ? vixLast.value / vix3mLast.value : null,
    pricing, mid: finite(policy.mid), lean: pricing == null ? 'unknown' : pricing >= P.pricedMovePp ? 'hike' : pricing <= -P.pricedMovePp ? 'cut' : 'hold',
    credit: axis('credit')?.state || 'unknown', growthState: axis('growth')?.state || 'unknown',
    // v57.55 review (E2-03/E2-15): the policy path — last target change and the 3-month bill (10y − (10y−3m)) against the range.
    policy: (() => {
      const fed = mh('fedTargetUpper'), d10 = mh('dgs10'), c = mh('t10y3m');
      if (fed.length < 2) return null;
      let i = fed.length - 1; while (i > 0 && fed[i - 1].value === fed[i].value) i -= 1;
      const cByDate = new Map(c.map((row) => [row.date, row.value]));
      const pair = [...d10].reverse().find((row) => cByDate.has(row.date));
      return { upper: last(fed).value, changeDate: i > 0 ? fed[i].date : null, change: i > 0 ? fed[i].value - fed[i - 1].value : 0,
        bill: pair ? pair.value - cByDate.get(pair.date) : null, billDate: pair?.date || null };
    })(),
    commodities: axis('commodities')?.state || 'unknown', breadth: read?.breadthState ?? null,
    asOf: [growth.sahm?.date, inflation.pace?.date, last(tnx)?.date].filter(Boolean).sort().at(-1) || null
  };
}

// The proxy caveat is said once, in the rate hub (rateHub.pricingNote); each branch keeps one short line.
export const PRICING_NOTE = '2년물 − 기준금리 중간값은 기간·위험 프리미엄이 섞인 대용 지표라 정책 예상을 그대로 뜻하지는 않습니다.';
const leanPricing = (want, note = '') => (s) => {
  if (s.lean === 'unknown') return { tone: 'unknown', text: '2년물·기준금리 자료가 없어 시장 가격 방향을 보류합니다.' };
  const tone = s.lean === want ? 'same' : s.lean === 'hold' ? 'neutral' : 'against';
  return { tone, text: `2년물−기준금리 ${signed(s.pricing, 2, '%p')} (${s.lean === 'hike' ? '금리 상단 쪽' : s.lean === 'cut' ? '금리 하단 쪽' : '동결 부근'}${note && s.lean === want ? note : ''})` };
};
const deltaPricing = (key, label, unit, digits, wantUp) => (s) => {
  const value = s[key];
  if (value == null) return { tone: 'unknown', text: `${label} 기록이 없어 시장 가격 방향을 보류합니다.` };
  const up = value > 0;
  return { tone: up === wantUp ? 'same' : 'against', text: `${label} ${unit === '%p→bp' ? bpChange(value) : signed(value, digits, unit)} — ${up === wantUp ? '시장 가격도 이 길 쪽으로 움직임' : '시장 가격은 이 길과 반대로 움직임'}` };
};

/** The branch registry. Add a branch by adding data here; screens, AI context, the producer and gates follow.
 *  axes — the 거시 six-axis cards whose observations the conditions test (each card links to these branches). */
export const BRANCHES = Object.freeze([
  { id: 'reheat', shape: 'concentration', axes: ['inflation', 'policy'], title: '물가 재가속 — 금리가 더 오르는 길',
    conditions: [['근원 물가 재가속 (3개월 속도가 1년치보다 0.5%p 이상 빠름)', (s) => s.accelerating], ['유가 급등 (WTI 20거래일 +10% 이상 또는 1년 평균 대비 +25% 이상)', (s) => s.oilSurging], ['임금 상승률 전년 대비 3.5% 이상', (s) => has(s.wageYoy) ? s.wageYoy >= 3.5 : null], [`고용 견조 (Sahm ${G.sahmWatchAt}%p 미만 + 일자리 3개월 평균 ${G.payrollSolidK / 10}만 명 이상)`, (s) => s.growthState === 'unknown' ? null : s.growthState === 'favorable']],
    chain: ['물가 재가속', '연준 인상·동결 연장 기대', '2년·10년 금리 상승', '할인율 상승 → 고PER 성장주 압박', '달러 강세 · 자금 조달 비용 상승'],
    firmer: ['energy', 'financials'], weaker: ['growth', 'yield', 'liquidity', 'consumer'],
    triggers: [['us-cpi', '근원 CPI 전월 대비 0.4% 이상 (연율 약 5%)', (a) => a.coreMoM >= 0.4], ['us-nfp', '일자리 25만 명 이상 + 시간당 임금 전월 대비 0.4% 이상', (a) => a.payroll >= 250 && (a.wageMoM ?? 0) >= 0.4], ['us-pce', '근원 PCE 전월 대비 0.3% 이상', (a) => a.coreMoM >= 0.3], ['us-fed-rate', '기준금리 인상', (a) => a.upperDelta > 0]],
    pricing: leanPricing('hike'),
    choices: { wait: '현금성 자산의 이자가 기다림의 비용을 줄여 줍니다. 금리가 오르는 동안에는 기다리는 쪽이 놓치는 것이 상대적으로 작습니다.', stage: '분할 접근은 가능하지만 금리가 오르는 동안 밸류에이션이 더 낮아질 수 있어 서두를 이유가 작습니다. 금리 상승이 멈추는 신호를 기준으로 나눠 보는 편이 맞습니다.', hold: '추세가 살아 있는 보유 종목은 유지하되, 이익보다 기대에 기대는 고PER·적자 성장주 비중이 큰지 점검합니다.', defend: '에너지·현금성 비중이 금리 상승 구간의 충격을 덜어 줍니다. 다만 물가가 바로 꺾이면 방어의 기회비용이 커집니다.' },
    favored: ['wait', 'defend'], favoredWhy: '금리 상승이 이어지는 길에서는 기다림의 비용(놓친 상승 − 현금 이자)이 작고, 성급한 매수의 비용(밸류에이션 추가 하락)이 큽니다.',
    explore: [['fxbond', '금리 · 환율', '10년물·2년물과 달러가 실제로 오르는지'], ['themes', '테마 · 섹터', '에너지·금융의 상대강도']] },
  { id: 'softland', shape: 'expansion', axes: ['inflation', 'growth'], title: '물가 둔화 + 고용 완만 — 금리가 내려갈 여지가 생기는 길',
    conditions: [['근원 물가 속도가 1년치 이하 (둔화 중)', (s) => all(s.corePace, s.coreYoy) ? s.corePace <= s.coreYoy : null], [`고용 완만 (Sahm ${G.sahmRecessionAt}%p 미만 + 일자리 3개월 평균 증가)`, (s) => all(s.sahm, s.payroll3) ? s.sahm < G.sahmRecessionAt && s.payroll3 > 0 : null], ['유가 안정 (WTI 20거래일 +5% 미만)', (s) => has(s.oil20) ? s.oil20 < 5 : null], ['신용 안정 (하이일드 스프레드 우호)', (s) => s.credit === 'unknown' ? null : s.credit === 'favorable']],
    chain: ['물가 둔화', '금리 인하 기대', '2년·10년 금리 하락', '할인율 하락 → 밸류에이션 지지', '참여 확산 (중소형·후행 업종)'],
    firmer: ['growth', 'yield', 'consumer', 'liquidity', 'cyclical'], weaker: ['energy', 'defensive'],
    triggers: [['us-cpi', '근원 CPI 전월 대비 0.2% 이하 (연율 약 2.4%, 목표 부근)', (a) => a.coreMoM <= 0.2], ['us-nfp', '일자리 7.5만~20만 명 + 실업률 보합~+0.1%p', (a) => a.payroll >= 75 && a.payroll <= 200 && (a.unempDelta ?? 0) <= 0.1], ['us-pce', '근원 PCE 전월 대비 0.2% 이하', (a) => a.coreMoM <= 0.2], ['us-fed-rate', '기준금리 인하 (신용이 안정된 상태에서)', (a) => a.upperDelta < 0]],
    pricing: leanPricing('cut'),
    choices: { wait: '금리 하락은 발표 직후 가격에 먼저 반영되는 경향이 있어, 확인을 끝까지 기다리는 동안의 기회비용이 커지는 길입니다.', stage: '발표마다 확인 신호가 나올 때 나눠 들어가면, 한 번에 들어가는 타이밍 위험을 줄이면서 놓치는 상승도 줄일 수 있습니다.', hold: '보유 유지가 자연스러운 길입니다. 시장 폭이 넓어지면 후행 업종으로 기회가 퍼지는지 함께 봅니다.', defend: '방어 전환의 기회비용이 큰 길입니다 — 방어 업종은 금리 하락과 참여 확산 국면에서 상대적으로 뒤처지는 경향이 있습니다.' },
    favored: ['stage', 'hold'], favoredWhy: '금리가 내려갈 여지가 확인되는 길에서는 기다림의 기회비용이 커지고, 나눠 들어가는 쪽이 타이밍 위험과 놓친 상승을 함께 줄입니다.',
    explore: [['themes', '테마 · 섹터', '성장·중소형 업종이 개선으로 넘어오는지'], ['screener', '스크리너', '추세가 살아 있는 후보를 직접 고르기']] },
  { id: 'slowdown', shape: 'weakness', axes: ['growth', 'credit'], title: '고용 급랭 — 금리는 내려도 이익이 꺾이는 길',
    conditions: [[`실업률 상승 주의 (Sahm ${G.sahmWatchAt}%p 이상)`, (s) => has(s.sahm) ? s.sahm >= G.sahmWatchAt : null], [`일자리 3개월 평균 ${G.payrollSlowdownK / 10}만 명 미만`, (s) => has(s.payroll3) ? s.payroll3 < G.payrollSlowdownK : null], ['실업수당 청구 4주 평균이 1년 저점보다 15% 이상 높음', (s) => has(s.claimsUp) ? s.claimsUp >= 15 : null], ['신용 부담 (하이일드 스프레드 확대)', (s) => s.credit === 'unknown' ? null : s.credit === 'burden']],
    chain: ['고용 급랭', '소비 둔화', '기업 이익 추정치 하향', '금리는 내려도 주가는 이익을 따라 하락', '신용 스프레드 확대'],
    firmer: ['defensive', 'yield'], weaker: ['cyclical', 'financials', 'consumer', 'liquidity', 'energy'],
    triggers: [['us-nfp', '일자리 5만 명 미만 + 실업률 0.2%p 이상 상승', (a) => a.payroll < 50 && (a.unempDelta ?? 0) >= 0.2], ['us-retail', '소매판매 두 달 연속 감소', (a) => a.mom < 0 && a.prevMom < 0], ['us-fed-rate', '경기 우려를 이유로 한 인하 (주식에 좋은 신호가 아닐 수 있음)', (a) => a.upperDelta < 0]],
    pricing: leanPricing('cut', ' · 경기 악화 때문일 수 있음'),
    choices: { wait: '신용 스프레드 확대가 멈출 때까지 기다리는 비용이 작은 길입니다. 현금성 자산의 이자도 그 사이를 메워 줍니다.', stage: '"금리 하락 = 호재"라는 등식이 깨지는 길입니다. 분할 접근은 신용 스프레드가 안정되는 것을 확인한 뒤가 맞습니다.', hold: '보유는 이익이 꺾이기 쉬운 경기민감·소형주 비중부터 점검합니다.', defend: '방어 업종과 장기 국채가 상대적으로 버티는 길입니다.' },
    favored: ['defend', 'wait'], favoredWhy: '이 길에서는 이익 하향이 금리 하락의 효과를 압도하는 경향이 있어, 확인 후 접근과 방어 쪽이 손실을 줄입니다.',
    explore: [['signal', '시장 상태', '하이일드 스프레드와 시장 폭이 함께 나빠지는지'], ['themes', '테마 · 섹터', '방어 업종의 상대강도']] },
  { id: 'oilshock', shape: 'concentration', axes: ['commodities'], title: '유가 충격 — 물가와 성장이 함께 부담받는 길',
    conditions: [['유가 급등 (WTI 20거래일 +10% 이상 또는 1년 평균 대비 +25% 이상)', (s) => s.oilSurging], ['10년 기대인플레이션 20회 관측 상승', (s) => has(s.breakeven20) ? s.breakeven20 > 0 : null], ['소비자심리 60 미만', (s) => has(s.sentiment) ? s.sentiment < 60 : null], ['유가·달러 축 부담', (s) => s.commodities === 'unknown' ? null : s.commodities === 'burden']],
    chain: ['유가 급등', '헤드라인 물가 상승 + 소비 여력 감소', '연준 딜레마 (물가 대응 vs 성장)', '금리 하락이 막히고 이익은 압박', '원유 수입국(한국) 원화 부담'],
    firmer: ['energy'], weaker: ['consumer', 'cyclical', 'growth'], mixed: ['dollar'],
    triggers: [['us-cpi', '헤드라인 CPI가 근원보다 전월 대비 0.2%p 이상 높음 (에너지발 물가)', (a) => a.headMoM != null && a.headMoM - a.coreMoM >= 0.2]],
    pricing: deltaPricing('breakeven20', '10년 기대인플레이션 20회 관측', '%p→bp', 0, true),
    choices: { wait: '유가 상승이 멈추는 신호(20거래일 변화가 마이너스로 전환)를 기다리는 비용이 작은 길입니다.', stage: '분할 접근은 에너지 비용을 가격에 넘길 수 있는 영역에 한정하는 편이 맞습니다.', hold: '보유 종목 중 연료·물류비 비중이 큰 업종을 점검합니다.', defend: '에너지 업종 비중이 유가 충격을 일부 상쇄합니다. 유가가 급반락하면 이 기회비용이 커집니다.' },
    favored: ['wait'], favoredWhy: '유가 충격은 물가와 성장을 함께 누르므로, 유가가 꺾이는 것을 확인하기 전 서두르는 쪽의 비용이 큽니다.',
    explore: [['fxbond', '금리 · 환율', '기대인플레이션과 10년물이 유가를 따라 오르는지'], ['themes', '테마 · 섹터', '에너지 업종의 상대강도']] },
  { id: 'creditstress', shape: 'weakness', axes: ['credit'], title: '신용 경색 — 돈줄이 마르는 길',
    conditions: [['신용 축 부담 (하이일드 스프레드 높음 또는 빠른 확대)', (s) => s.credit === 'unknown' ? null : s.credit === 'burden'], ['하이일드 스프레드 20회 관측 +50bp 이상 확대', (s) => has(s.hy20) ? s.hy20 >= 50 : null], ['가장 약한 등급(CCC)과 B 등급 격차 20회 관측 확대', (s) => has(s.cccGap20) ? s.cccGap20 > 0 : null], ['금융여건지수(NFCI) 4주 전보다 긴축 방향', (s) => has(s.nfci4) ? s.nfci4 > 0 : null]],
    chain: ['신용 스프레드 확대', '약한 기업부터 차환·조달 곤란', '투자·고용 축소', '이익 하향 + 위험 회피', '주가 하락이 신용 위험으로 번짐'],
    firmer: ['defensive'], weaker: ['financials', 'liquidity', 'cyclical', 'growth', 'consumer'],
    triggers: [['us-fed-rate', '긴급 유동성 공급·인하 (신용 불안 대응)', (a) => a.upperDelta < 0]],
    pricing: deltaPricing('hy20', '하이일드 스프레드 20회 관측', 'bp', 0, true),
    choices: { wait: '신용이 흔들리는 동안 기다리는 비용이 가장 작은 길입니다 — 확대가 멈추는 것을 먼저 확인합니다.', stage: '분할 접근은 스프레드 확대가 멈추고 줄어들기 시작한 뒤가 맞습니다. 그 전의 "싸 보임"은 근거가 약합니다.', hold: '차입 비중이 크거나 자금 조달이 잦은 기업 비중부터 점검합니다.', defend: '현금흐름이 안정적인 방어 업종과 우량 채권이 상대적으로 버팁니다.' },
    favored: ['wait', 'defend'], favoredWhy: '신용 경색은 주가보다 늦게 끝나는 경향이 있어, 확대가 멈춘 것을 확인하기 전의 매수는 비용이 큽니다.',
    explore: [['signal', '시장 상태', '하이일드·CCC 격차와 시장 폭'], ['sentiment', '투자 심리', 'VIX와 신용이 같은 쪽인지']] },
  { id: 'dollarsurge', shape: 'concentration', axes: ['commodities', 'rates', 'policy'], title: '달러 급등 — 해외 자금이 빠지기 쉬운 길',
    conditions: [['달러 인덱스 20거래일 +2% 이상', (s) => has(s.dxy20) ? s.dxy20 >= 2 : null], ['원/달러 20거래일 +2% 이상 (원화 약세)', (s) => has(s.krw20) ? s.krw20 >= 2 : null], ['시장 가격이 금리 상단 쪽 (2년물이 기준금리 위)', (s) => s.lean === 'unknown' ? null : s.lean === 'hike'], ['10년물 20거래일 상승', (s) => has(s.tnx20) ? s.tnx20 > 0 : null]],
    chain: ['미국 금리 우위 · 안전자산 선호', '달러 강세', '신흥국·한국에서 외국인 자금 유출', '원자재 가격 하락 압력 · 해외 매출 환산 감소', '수출 기업은 환율 이익, 내수·수입 기업은 부담'],
    firmer: [], weaker: ['liquidity', 'energy'], mixed: ['dollar'],
    triggers: [['us-fed-rate', '기준금리 인상', (a) => a.upperDelta > 0], ['us-cpi', '근원 CPI 전월 대비 0.4% 이상', (a) => a.coreMoM >= 0.4]],
    pricing: leanPricing('hike'), pricingInConditions: true, chainNeeds: { 2: 1 },
    choices: { wait: '달러가 오르는 동안 원화 자산을 서둘러 늘릴 이유가 작습니다. 달러 현금성 자산은 환율 이익도 줍니다.', stage: '분할 접근은 환율 상승이 멈추는 신호와 함께 나누는 편이 맞습니다.', hold: '수출 비중이 큰 보유 종목은 환율 이익이 일부 상쇄합니다. 내수·수입 의존 종목을 점검합니다.', defend: '달러 자산과 수출 기업 비중이 원화 약세의 충격을 덜어 줍니다.' },
    favored: ['wait', 'hold'], favoredWhy: '달러 급등기에는 외국인 수급이 약해지기 쉬워 서두를 이유가 작고, 수출 기업 보유는 환율로 일부 상쇄됩니다.',
    explore: [['fxbond', '금리 · 환율', '달러·원화·엔화 추이'], ['themes', '테마 · 섹터', '한국 수출 테마의 상대강도']] },
  { id: 'reflation', shape: 'expansion', axes: ['growth', 'rates'], title: '성장 재가속 — 금리와 이익이 함께 오르는 길',
    conditions: [[`일자리 3개월 평균 ${G.payrollSolidK / 10}만 명 이상이며 그 전 3개월보다 많음`, (s) => all(s.payroll3, s.payrollPrior3) ? s.payroll3 >= G.payrollSolidK && s.payroll3 > s.payrollPrior3 : null], ['소매판매 전년 대비 3% 이상', (s) => has(s.retailYoy) ? s.retailYoy >= 3 : null], ['10년물 상승 + 장단기 금리차 확대 (성장 기대형 금리 상승)', (s) => all(s.tnx20, s.curve20) ? s.tnx20 > 0 && s.curve20 > 0 : null], ['시장 폭 우호', (s) => s.breadth == null ? null : s.breadth === 'favorable']],
    chain: ['고용·소비 재가속', '이익 추정치 상향', '성장 기대로 금리 상승', '경기민감·금융 이익 개선', '방어·배당주 상대 부진'],
    firmer: ['cyclical', 'financials', 'energy', 'consumer'], weaker: ['defensive', 'yield'],
    triggers: [['us-nfp', '일자리 20만 명 이상', (a) => a.payroll >= 200], ['us-retail', '소매판매 전월 대비 +0.5% 이상', (a) => a.mom >= 0.5]],
    pricing: deltaPricing('curve20', '10년−3개월 금리차 20회 관측', '%p→bp', 0, true),
    choices: { wait: '이익이 함께 오르는 길에서는 기다림의 기회비용이 큽니다.', stage: '금리 상승이 이익 개선을 동반하는지 확인하며 나눠 들어가는 쪽이 자연스럽습니다.', hold: '경기민감·금융 보유가 유리해지는 길입니다.', defend: '방어 전환의 기회비용이 큰 길입니다.' },
    favored: ['hold', 'stage'], favoredWhy: '금리 상승이 성장 기대 때문이라면 이익이 함께 늘어 주가가 버티는 경향이 있습니다 — 물가 때문인 금리 상승과 구분합니다.',
    explore: [['themes', '테마 · 섹터', '경기민감·금융 업종 개선'], ['screener', '스크리너', '이익 추정이 오르는 후보']] },
  { id: 'volshock', shape: 'weakness', axes: ['credit'], title: '변동성 충격 — 공포가 가격을 앞지르는 길',
    conditions: [['VIX 25 이상', (s) => has(s.vix) ? s.vix >= 25 : null], ['VIX 기간 구조 역전 (단기 ≥ 3개월)', (s) => has(s.vixRatio) ? s.vixRatio >= 1 : null], ['S&P 500 5거래일 −4% 이하', (s) => has(s.spx5) ? s.spx5 <= -4 : null], ['시장 폭 부담', (s) => s.breadth == null ? null : s.breadth === 'burden']],
    chain: ['급락 · 변동성 급등', '위험 축소(레버리지 청산)', '좋은 종목까지 함께 매도', '신용이 버티면 되돌림, 신용이 무너지면 장기화', '변동성 진정 후 주도주 재편'],
    firmer: ['defensive'], weaker: ['liquidity', 'growth', 'cyclical'],
    triggers: [],
    pricing: (s) => s.vixRatio == null ? { tone: 'unknown', text: 'VIX 기간 구조 기록이 없어 보류합니다.' } : { tone: s.vixRatio >= 1 ? 'same' : 'against', text: `VIX / 3개월 VIX ${s.vixRatio.toFixed(2)} — ${s.vixRatio >= 1 ? '단기 공포가 중기보다 큼(역전)' : '정상 구조(단기 공포가 중기보다 작음)'}` },
    choices: { wait: '기간 구조 역전이 풀릴 때까지 기다리는 쪽은 바닥 근처를 놓칠 수 있지만, 신용이 함께 무너지는 경우의 손실을 피합니다.', stage: '신용이 버티는 공포에서는 나눠 들어가는 쪽이 유리했던 경우가 많았습니다 — 아래 과거 빈도와 신용 축을 함께 확인합니다.', hold: '보유는 레버리지·변동성이 큰 종목 비중부터 점검합니다.', defend: '방어 전환은 급락 뒤에 하면 반등을 놓치는 기회비용이 커집니다.' },
    favored: ['stage', 'wait'], favoredWhy: '신용이 버티면 분할 접근, 신용도 무너지면 기다림 — 갈림 조건은 하이일드 스프레드입니다.',
    explore: [['sentiment', '투자 심리', 'VIX·기간 구조·심리 지표'], ['signal', '시장 상태', '신용 축이 버티는지']] }
]);

function pastFor(branchId, { history, outcomes }) {
  const analog = BRANCH_ANALOGS[branchId];
  if (!analog) return { text: '과거 비교 기준이 정의되지 않았습니다.', n: 0 };
  const long = outcomes?.branches?.[branchId];
  if (long && long.n >= 3) return { ...long, text: frequencyText(long, analog.label, { source: outcomes.sourceLabel || '장기 일봉 기록' }), source: 'long' };
  const fields = ['spx', 'tnx', 'vix', 'wti', 'dxy'];
  const maps = Object.fromEntries(fields.map((field) => [field, new Map(buildCloseSeries(history, field).map((p) => [p.date, p.value]))]));
  const rows = [...maps.spx].map(([date, spx]) => Object.fromEntries([['date', date], ['spx', spx], ...fields.slice(1).filter((f) => maps[f].has(date)).map((f) => [f, maps[f].get(date)])]));
  const local = analogOutcome(rows, analog);
  return { ...(local || { n: 0 }), text: frequencyText(local, analog.label), source: 'local' };
}

// When the past-frequency line points the other way from the favoured choices (stocks mostly rose after the same
// conditions, yet the branch favours waiting), one sentence says what the conclusion is measured against.
const DEFENSIVE_CHOICES = new Set(['wait', 'defend']);
// Korean particles follow the last Hangul syllable (quotes and brackets after it are skipped).
const lastBatchim = (text) => { const syllables = String(text || '').match(/[가-힣]/g); if (!syllables) return false; return (syllables.at(-1).charCodeAt(0) - 0xac00) % 28 !== 0; };
const subjectParticle = (text) => (lastBatchim(text) ? '이' : '가');
const andParticle = (text) => (lastBatchim(text) ? '과' : '와');
function pastBridge(branch, past) {
  if (!past || !(past.n >= 3) || !Number.isFinite(past.up)) return null;
  const share = past.up / past.n;
  const defensive = branch.favored.every((key) => DEFENSIVE_CHOICES.has(key));
  const risky = branch.favored.every((key) => !DEFENSIVE_CHOICES.has(key));
  const direction = defensive && share >= 0.6 ? '올랐습니다' : risky && share <= 0.4 ? '내렸습니다' : null;
  if (!direction) return null;
  const path = branch.title.split(' — ')[1] || '이 길';
  const conclusion = branch.favored.map((key) => CHOICES[key].split(' (')[0]).join('·');
  return `과거 표본에서는 이후 주가가 대체로 ${direction} — 이 길의 결론(${conclusion})은 '${path}'${subjectParticle(path)} 실제로 이어질 때의 비용 기준${past.n < 10 ? '이며, 표본이 작습니다' : '입니다'}.`;
}

/**
 * @param {object} input
 * @param {object} input.read     buildMacroRead() result (+ optional breadthState from the market regime)
 * @param {object} input.macroHistory published macro-history.v1
 * @param {Array}  input.history  daily close history
 * @param {Array}  input.events   upcomingMacroEvents()
 * @param {object} [input.outcomes] published scenario-outcomes.v1 (long-history analogs)
 */
export function buildMacroCrossroads({ read = null, macroHistory = null, history = [], events = [], outcomes = null } = {}) {
  const s = buildScenarioSignals({ read, macroHistory, history });
  const when = (id) => { const row = events.find((e) => e.id === id); return row ? `${md(row.date)} ${row.name}` : null; };
  const cashText = s.cash ? `현금성 자산의 이자(SOFR ${s.cash.value.toFixed(2)}%, ${md(s.cash.date)})` : null;
  const items = BRANCHES.map((branch) => {
    const conditions = branch.conditions.map(([label, test]) => { let ok = null; try { ok = test(s); } catch (_) { ok = null; } return [label, ok == null ? null : !!ok]; });
    const known = conditions.filter(([, ok]) => ok != null);
    const met = known.filter(([, ok]) => ok).length;
    const choices = { ...branch.choices };
    if (cashText) choices.wait = choices.wait.replace('현금성 자산의 이자', cashText);
    const mixed = (branch.mixed || []).map((tag) => EXPOSURE_TAGS[tag]).join(', ');
    const past = pastFor(branch.id, { history, outcomes });
    // v57.55 review (E2-05): a chain link whose own condition is unmet this time (외국인 자금 유출 while the won is not weak) says so.
    const chain = branch.chain.map((text, index) => (branch.chainNeeds?.[index] != null && conditions[branch.chainNeeds[index]]?.[1] === false ? `${text} (이번엔 미확인)` : text));
    return { id: branch.id, shape: branch.shape || null, axes: branch.axes || [], title: branch.title, chain, conditions, pricingInConditions: !!branch.pricingInConditions, choices, favored: branch.favored, favoredWhy: branch.favoredWhy,
      firmer: branch.firmer, weaker: branch.weaker, mixed: branch.mixed || [],
      // A branch with only a split exposure (달러: 수출은 이익, 수입은 부담) is not "no beneficiary" — the split is named.
      impact: { firmer: branch.firmer.map((tag) => EXPOSURE_TAGS[tag]).join(', ') || (mixed ? '한쪽으로 뚜렷하게 강해지는 영역은 없음' : '뚜렷한 수혜 영역 없음'), weaker: branch.weaker.map((tag) => EXPOSURE_TAGS[tag]).join(', ') || '—', mixed },
      met, total: conditions.length, known: known.length,
      fit: known.length < 2 ? '판단 보류' : `조건 부합 ${met}/${conditions.length}${known.length < conditions.length ? ` · 확인 가능 ${known.length}개` : ''}`,
      basis: conditions.map(([label, ok]) => `${label} ${ok == null ? '확인 불가' : ok ? '충족' : '미충족'}`),
      pricing: branch.pricing(s),
      past, pastBridge: pastBridge(branch, past),
      triggers: branch.triggers.map(([id, text]) => ({ id, when: when(id), text })).filter((row) => row.when),
      explore: branch.explore.map(([route, label, why]) => ({ route, label, why })) };
  });
  const ratio = (item) => item.known < 2 ? -1 : item.met / item.total;
  // v57.55 review (E2-04): a branch whose conditions already count 2y − midpoint does not get the same gauge again as a tie-break.
  const pricedSame = (item) => item.pricing.tone === 'same' && !item.pricingInConditions;
  const ranked = [...items].sort((a, b) => ratio(b) - ratio(a) || pricedSame(b) - pricedSame(a));
  const lead = ranked[0];
  const held = !lead || ratio(lead) <= 0;
  const others = ranked.filter((item) => item !== lead && item.known >= 2 && item.met > 0);
  // Branches level with the lead on met conditions are a tie, not a lead and a runner-up: the headline says so.
  const tied = held ? [] : ranked.filter((item) => item.known >= 2 && ratio(item) === ratio(lead));
  const alt = held ? null : tied[1] || others.find(pricedSame) || others[0] || null;
  const nextEvent = events.find((row) => ['us-cpi', 'us-nfp', 'us-fed-rate', 'us-pce'].includes(row.id)) || events[0] || null;

  // The rate hub: why higher rates hurt, what would have to happen for them to fall, and which release shows it.
  // Oil falling is read on WTI and Brent together: opposite 20-session signs on the same futures basis are 엇갈림, not
  // "유가 하락 진행 중". European spot Brent (no futures record yet) is quoted for reference only (P1726).
  const brentComparable = has(s.oil20) && has(s.brent20) && s.brentBasis === 'futures';
  const oilSplit = brentComparable && (s.oil20 < 0) !== (s.brent20 < 0);
  const p = s.policy;
  const policyLine = p ? `연준 ${p.changeDate ? `${md(p.changeDate)} ${p.change > 0 ? '인상' : '인하'}(${bpChange(p.change)}) 뒤 ` : ''}상단 ${fmt(p.upper, 2)}%${p.bill != null ? ` · 3개월물 ${fmt(p.bill, 2)}%(${md(p.billDate)}) — ${p.bill > p.upper ? `목표 범위 상단보다 ${Math.round((p.bill - p.upper) * 100)}bp 높게 거래` : p.bill < p.upper - 0.25 ? `목표 범위 하단보다 ${Math.round((p.upper - 0.25 - p.bill) * 100)}bp 낮게 거래` : '목표 범위 안에서 거래'}${p.bill > p.upper || p.bill < p.upper - 0.25 ? '(국채 수급도 섞인 관측값이라 정책 예상으로 단정하지 않음)' : ''}` : ''}` : null;
  const rateHub = {
    policy: policyLine,
    now: s.tnx ? `미 10년물 ${fmt(s.tnx.value, 2)}% (20거래일 ${bpChange(s.tnx20)})${s.pricing != null ? ` · 2년물 − 기준금리 ${signed(s.pricing, 2, '%p')}` : ''}` : null,
    pricingNote: s.pricing != null ? `${PRICING_NOTE.replace('기준금리 중간값', `기준금리 중간값(${fmt(s.mid, 2)}%)`)} 아래 각 길의 '시장 가격'도 같은 대용 지표입니다.` : null,
    whyHigherHurts: '금리가 더 오르면 미래 이익을 오늘 가치로 바꾸는 할인율이 높아져 PER이 높은 성장주부터 눌리고, 기업·가계의 차입 비용이 올라 이익과 투자가 둔화하며, 달러 강세가 해외 매출과 신흥국 자금을 압박합니다.',
    pathsDown: [
      { id: 'disinflation', label: '물가 둔화', ok: all(s.corePace, s.coreYoy) ? s.corePace <= s.coreYoy : null,
        evidence: has(s.corePace) ? `근원 PCE 3개월 속도 ${fmt(s.corePace)}% · 1년치 ${fmt(s.coreYoy)}%${s.coreCpiPace != null ? ` · 근원 CPI 3개월 속도 ${fmt(s.coreCpiPace)}%` : ''}` : '물가 기록 대기', next: [when('us-cpi'), when('us-pce')].filter(Boolean).join(' · ') },
      { id: 'oil', label: '유가 하락', ok: oilSplit ? null : has(s.oil20) ? s.oil20 < 0 && !(s.oilVsYear >= 10) : null, stateText: oilSplit ? '엇갈림' : has(s.oil20) && s.oil20 < 0 && s.oilVsYear >= 10 ? '내려도 높은 수준' : null,
        evidence: has(s.oil20) ? `WTI 20거래일 ${signed(s.oil20, 1, '%')}${has(s.brent20) ? ` · 브렌트${s.brentBasis === 'futures' ? '' : ' 현물'} ${signed(s.brent20, 1, '%')}` : ''}${s.oilVsYear != null ? ` · WTI 1년 평균 대비 ${signed(s.oilVsYear, 0, '%')}` : ''}${oilSplit ? ' — 두 유가의 방향이 달라 하락으로 보지 않습니다' : s.oil20 < 0 && s.oilVsYear >= 10 ? ' — 최근엔 내렸지만 1년 평균보다 아직 높아 물가 부담이 풀렸다고 보지 않습니다' : ''}` : '유가 기록 대기', next: '매일 유가 종가' },
      { id: 'cooling', label: '고용·경기 둔화', ok: s.growthState === 'unknown' ? null : s.growthState === 'burden' ? true : s.growthState === 'favorable' ? false : null,
        stateText: s.growthState === 'neutral' ? '채용만 둔화' : null,
        evidence: has(s.sahm) ? `Sahm ${fmt(s.sahm, 2)}%p · 일자리 3개월 평균 ${s.payroll3 == null ? '—' : `${Math.round(s.payroll3)}천 명`}${s.growthState === 'neutral' ? ' — 채용은 기준 아래지만 실업률은 아직 오르지 않았습니다(고용 축 중립)' : ''}` : '고용 기록 대기', next: [when('us-nfp'), '매주 목요일 실업수당 청구'].filter(Boolean).join(' · ') }
    ],
    tension: null,
    caveat: '고용·경기 둔화로 금리가 내려가는 길은 이익 둔화가 함께 오기 때문에 주식에 늘 좋은 것은 아닙니다 — 물가 둔화로 내려가는 길과 구분해서 봅니다.'
  };
  // When the conditions for lower rates and the actual move in long rates disagree, that gap is the story.
  const downPaths = rateHub.pathsDown.filter((path) => path.ok).length;
  if (downPaths >= 2 && s.tnx20 != null && s.tnx20 >= 0.15) {
    rateHub.tension = `금리를 낮출 조건 ${downPaths}개가 보이는데도${p?.change > 0 ? ` 연준은 ${md(p.changeDate)}에 올렸고` : ''} 10년물은 20거래일 ${bpChange(s.tnx20)} 올랐습니다${s.termPremium20 != null ? ` (10년 기간 프리미엄 ${bpChange(s.termPremium20)}, ${md(last(s.termPremium).date)})` : ''}. 물가·경기 밖의 요인(국채 공급, 기간 프리미엄, 해외 금리)이 금리를 올리고 있을 수 있어, ${nextEvent ? `${md(nextEvent.date)} ${nextEvent.name} 발표가` : '다음 물가 발표가'} 이 괴리를 어느 쪽으로 푸는지가 핵심입니다.`;
  } else if (downPaths === 0 && s.tnx20 != null && s.tnx20 <= -0.15) {
    rateHub.tension = `금리를 낮출 조건이 뚜렷하지 않은데 10년물은 20거래일 ${bpChange(s.tnx20)} 내렸습니다. 안전자산 선호나 해외 요인일 수 있어, 위험 회피가 원인인지 신용·변동성 축과 함께 확인합니다.`;
  }
  const short = (item) => item.title.split(' — ')[0];
  const COUNT_WORDS = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟'];
  const tone = (item) => item.pricing.tone === 'same' ? '시장 가격도 같은 방향' : item.pricing.tone === 'against' ? '시장 가격은 반대' : item.pricing.tone === 'neutral' ? '시장 가격은 중립' : '';
  const sameFit = tied.every((item) => item.met === lead.met && item.total === lead.total);
  const tiedText = tied.map((item) => { const extra = [sameFit ? '' : item.fit, tone(item)].filter(Boolean).join(', '); return `'${short(item)}'${extra ? `(${extra})` : ''}`; });
  const headline = held ? '조건을 확인할 관측이 부족하거나 뚜렷하게 맞는 갈림길이 없어 판단을 보류합니다.'
    : tied.length >= 2 ? `조건 부합이 같은${sameFit ? `(${lead.met}/${lead.total})` : ''} 길이 ${COUNT_WORDS[tied.length] || `${tied.length}개`}입니다 — ${tiedText.slice(0, -1).join(', ')}${andParticle(tiedText.at(-2))} ${tiedText.at(-1)}. ${nextEvent ? `다음 분기점 ${md(nextEvent.date)} ${nextEvent.name} 발표가 ${tied.length === 2 ? '둘을' : '이 길들을'} 가릅니다.` : '다음 발표가 이 길들을 가릅니다.'}`
    : `지금 조건이 가장 많이 맞는 갈림길은 '${short(lead)}'(${lead.fit})입니다.${lead.pricing.tone === 'same' ? ' 시장 가격도 같은 방향입니다.' : lead.pricing.tone === 'against' ? ' 다만 시장 가격은 반대 방향입니다.' : ''}${alt ? ` 함께 볼 길: '${short(alt)}'(${alt.fit}${alt.pricing.tone === 'same' ? ', 시장 가격은 이쪽' : ''}).` : ''}${nextEvent ? ` 다음 분기점: ${md(nextEvent.date)} ${nextEvent.name}.` : ''}`;
  return { available: items.some((item) => item.known >= 2), version: MACRO_CROSSROADS_VERSION, asOf: s.asOf, held, headline,
    leadId: held ? null : lead.id, altId: alt?.id || null, tiedIds: tied.length >= 2 ? tied.map((item) => item.id) : [], items, rateHub, events, nextEvent, cash: s.cash ? { value: s.cash.value, date: s.cash.date } : null };
}

/** Score a published release against every branch trigger (used by the producer when new data lands). */
export function scoreRelease(eventId, actual) {
  const matched = [];
  for (const branch of BRANCHES) for (const [id, text, test] of branch.triggers) {
    if (id !== eventId) continue;
    let ok = false; try { ok = test(actual) === true; } catch (_) { ok = false; }
    if (ok) matched.push({ branchId: branch.id, title: branch.title.split(' — ')[0], rule: text });
  }
  return matched;
}

/** The AI context: the same branches the screens show, in a compact block. */
export function renderMacroCrossroadsContext(model, { state = null } = {}) {
  if (!model?.available) return '';
  const lines = [`【앞으로의 갈림길 — 거시 시나리오(${model.asOf || '기준일 미확인'} 관측 기준, 예측 아님)】`, model.headline,
    `금리 허브: ${model.rateHub.now || '금리 기록 대기'}. ${model.rateHub.whyHigherHurts}${model.rateHub.pricingNote ? ` ${model.rateHub.pricingNote}` : ''}`];
  if (model.rateHub.tension) lines.push(`괴리: ${model.rateHub.tension}`);
  lines.push(`금리가 내려가려면: ${model.rateHub.pathsDown.map((p) => `${p.label} ${p.stateText || (p.ok == null ? '확인 불가' : p.ok ? '진행 중' : '아직 아님')} (${p.evidence}${p.next ? `; 확인: ${p.next}` : ''})`).join(' / ')}. ${model.rateHub.caveat}`);
  const rank = (item) => (item.id === model.leadId ? 2 : item.id === model.altId ? 1 : 0);
  const ordered = [...model.items].sort((a, b) => rank(b) - rank(a) || b.met / b.total - a.met / a.total);
  for (const item of ordered) {
    const detailed = rank(item) > 0; // lead and alternative in full; the rest stay one line so themes fit the same budget
    lines.push(detailed
      ? `- ${item.title}: ${item.fit} [${item.basis.join(', ')}]. 인과: ${item.chain.join(' → ')}. 강해지는 쪽: ${item.impact.firmer}; 약해지는 쪽: ${item.impact.weaker}${item.impact.mixed ? `; 엇갈림: ${item.impact.mixed}` : ''}. 시장 가격: ${item.pricing.text.replace(/\.$/, '')}. 과거 빈도: ${item.past.text}${item.pastBridge ? ` ${item.pastBridge}` : ''} 확인 일정: ${item.triggers.map((t) => `${t.when} — ${t.text}`).join('; ') || '일정 없음(시장 지표로 확인)'}. 선택지: ${Object.entries(item.choices).map(([key, text]) => `${CHOICES[key]} — ${text}`).join(' / ')} 이 길에서 상대적으로 유리한 쪽: ${item.favored.map((key) => CHOICES[key]).join(', ')} (${item.favoredWhy})`
      : `- ${item.title}: ${item.fit}. 인과: ${item.chain.join(' → ')}. 시장 가격: ${item.pricing.tone === 'same' ? '이 길 쪽' : item.pricing.tone === 'against' ? '반대쪽' : item.pricing.tone === 'neutral' ? '중립' : '보류'}. 이 길이라면 유리: ${item.favored.map((key) => CHOICES[key]).join(', ')}`);
  }
  if (state?.transitions?.length) lines.push(`최근 변화(자동 기록): ${state.transitions.slice(-6).map((t) => `${String(t.at).slice(5, 10)} ${t.text}`).join(' / ')}`);
  if (state?.eventOutcomes?.length) lines.push(`지난 발표 판정(자동): ${state.eventOutcomes.slice(-4).map((e) => `${e.name} ${e.period}: ${e.actualText} → ${e.matched.length ? `${e.matched.map((m) => m.title).join('·')} 기준 충족` : '어느 길의 기준도 아님'}`).join(' / ')}`);
  lines.push('규칙: 가능성은 위 세 근거(조건 부합 수·시장 가격 방향·과거 빈도와 표본 수)로만 말하고 %·확률 숫자를 만들지 마라. 선택지별 기회비용과 상대적으로 유리한 쪽은 말하되, 가격·수량·시점·특정 종목 매매 지시는 하지 말고 세부 선별은 차트·기업·테마·스크리너 화면에서 사용자가 하도록 안내하라.');
  return lines.join('\n');
}
