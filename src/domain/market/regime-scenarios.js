// P1628: observed six-axis conditions, shared by the market screen and AI context.
// This is a conditional reading of completed observations, never a forecast or a trade instruction.
import { alignMarketInputs, buildCloseSeries, buildMarketRegime } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';
import { latestCompletedKrSession, resolveMarketCalendarSession, countOpenSessionsBetween } from './market-calendar.js';

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
const count = value => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const percent = value => `${value.toFixed(1)}%`;

function macroSeries(macroHistory, key, through, factor = 1) {
  const byDate = new Map();
  for (const row of macroHistory?.series?.[key]?.observations || []) {
    const stamp = date(Array.isArray(row) ? row[0] : row?.date);
    const value = finite(Array.isArray(row) ? row[1] : row?.value);
    if (stamp && value != null && (!through || stamp <= through)) byDate.set(stamp, value * factor);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([stamp, value]) => ({ date: stamp, value }));
}

export function buildRegimeAxisHistory(input = {}, { macroHistory = null, regime = buildMarketRegime(input) } = {}) {
  if (!regime.available || !regime.asOf) return { range: null, axes: {} };
  const through = regime.asOf;
  const spx = buildCloseSeries(input.history, 'spx', { through }).slice(-126);
  const range = spx.length > 1 ? [spx[0].date, through] : null;
  if (!range) return { range: null, axes: {} };
  const clip = series => series.filter(point => point.date >= range[0] && point.date <= range[1]);
  const daily = field => clip(buildCloseSeries(input.history, field, { through }));
  const macro = (field, factor = 1) => clip(macroSeries(macroHistory, field, through, factor));
  const chart = (id, title, unit, series, { format = count, refs = [], domain = null, note = '' } = {}) => ({ id, title, unit, series, format, refLines: refs, domain, note });
  const vix3m = new Map(daily('vix3m').map(point => [point.date, point.value]));
  const ratio = daily('vix').filter(point => vix3m.get(point.date) > 0).map(point => ({ date: point.date, value: point.value / vix3m.get(point.date) }));
  const definitions = {
    trend: [chart('spx', 'S&P 500 종가', '지수 pt', spx, { note: '지수의 완료 종가 추이. 이동평균 위치와 방향은 아래 근거에서 함께 확인합니다.' })],
    breadth: [chart('breadth50', '50일선 위 종목 비율', '%', daily('breadth50'), { format: percent, refs: [RULES.breadth.weakBelow, RULES.breadth.broadAtLeast], domain: [0, 100], note: 'AIO 미국 수집 표본의 비율. 전체 미국 거래소 종목을 집계한 값과 모집단이 다릅니다.' }),
      chart('breadth200', '200일선 위 종목 비율', '%', daily('breadth200'), { format: percent, refs: [RULES.breadth.weakBelow, RULES.breadth.broadAtLeast], domain: [0, 100], note: '중기 참여도(50일)와 장기 참여도(200일)가 함께 넓어지는지 비교합니다.' })],
    volatility: [chart('vix', 'VIX', '지수 pt', daily('vix'), { format: value => value.toFixed(1), refs: [RULES.volatility.calmBelow, RULES.volatility.stressAt] }),
      chart('vix-term', 'VIX / 3개월 VIX', '배', ratio, { format: value => value.toFixed(2), refs: [RULES.volatility.calmRatioBelow, RULES.volatility.invertedRatioAt], note: '같은 관측일의 두 지수만 나눕니다. 1 이상은 단기 변동성이 중기보다 높은 기간 구조입니다.' })],
    rates: [chart('tnx', '미 10년물 명목금리', '%', daily('tnx'), { format: percent }),
      chart('tips', '10년 TIPS 실질금리', '%', macro('realYield10'), { format: percent, note: '명목금리와 실질금리는 서로 다른 관측일일 수 있습니다. 같은 날짜의 자료가 없으면 분해해 단정하지 않습니다.' }),
      chart('breakeven', '10년 기대인플레이션', '%', macro('breakeven10'), { format: percent, note: '물가 예상만이 아니라 유동성·위험 프리미엄도 포함하는 인플레이션 보상 지표입니다.' })],
    credit: [chart('hy', '하이일드 OAS', 'bp', macro('hyOas', 100), { refs: [RULES.credit.tightBelowBp, RULES.credit.stressAtBp], note: 'ICE BofA 하이일드 OAS. 수준과 5거래일 확대·축소를 구분해서 읽습니다.' })],
    commodities: [chart('wti', 'WTI 선물', 'USD / 배럴', daily('wti'), { format: value => `$${value.toFixed(1)}` }),
      chart('dxy', '달러 인덱스', '지수 pt', daily('dxy'), { format: value => value.toFixed(1) })],
    korea: [chart('usdkrw', '원 / 달러', 'KRW / USD', daily('usdkrw'), { format: count })]
  };
  return { range, axes: Object.fromEntries(Object.entries(definitions).map(([id, charts]) => [id, charts.filter(item => item.series.length > 1)])) };
}

const OBSERVE = Object.freeze({
  trend: '지수가 이동평균 위·아래로 마감하는지와 50일선 방향을 함께 확인합니다.',
  breadth: '50일선과 200일선 위 비율이 같은 방향인지, 신고가·신저가가 참여도 변화를 확인하는지 봅니다.',
  volatility: 'VIX 수준, 5일 변화, VIX/3개월 VIX가 함께 안정 또는 스트레스를 가리키는지 봅니다.',
  rates: '명목금리의 20일 변화와 최근 5일 되돌림을 구분하고, 같은 날짜의 TIPS·기대인플레가 원인을 뒷받침하는지 봅니다.',
  credit: 'HY OAS의 높은 수준과 빠른 확대를 구분합니다. 폭이 좁아지는지, 확대가 연속되는지 확인합니다.',
  commodities: '유가와 달러가 동시에 부담을 만드는지, 하나의 상승을 다른 자산까지 확대해 읽고 있지 않은지 봅니다.',
  korea: '원·엔의 환율과 국내 주가를 따로 확인합니다. 미국 6개 축의 합계에는 넣지 않습니다.'
});

export function buildMarketScenarios(input = {}, { regime = buildMarketRegime(input) } = {}) {
  if (!regime.available) return { available: false, asOf: null, scenarios: [], axes: [], reason: '완료 종가 기록이 없어 조건 해석을 보류합니다.' };
  const aligned = alignMarketInputs(input);
  const byId = Object.fromEntries(regime.axes.map(axis => [axis.id, axis]));
  const essential = ['trend', 'breadth', 'credit', 'volatility'];
  const missing = essential.filter(id => !byId[id] || byId[id].state === 'unknown');
  // Breadth may have a one-window burden rule. A scenario describing both windows
  // still needs both actual observations; an existing axis label cannot fill the gap.
  if (aligned.s.breadth50 == null || aligned.s.breadth200 == null) {
    if (!missing.includes('breadth')) missing.push('breadth');
  }
  if (aligned.c.hy5 == null && !missing.includes('credit')) missing.push('credit');
  if ((!aligned.s.vix || !aligned.s.vix3m || aligned.s.vix.date !== aligned.s.vix3m.date || aligned.s.vix.d5 == null)
    && !missing.includes('volatility')) missing.push('volatility');
  const hold = missing.length > 0;
  const facts = essential.flatMap(id => (byId[id]?.evidence || []).slice(0, id === 'trend' ? 2 : 1).map(([label, value]) => `${label} ${value}`));
  const confirmed = states => !hold && states;
  const calmRisk = byId.credit?.state !== 'burden' && byId.volatility?.state !== 'burden';
  const scenarios = [
    { id: 'expansion', title: '확산 회복', confirmed: confirmed(byId.trend?.state === 'favorable' && byId.breadth?.state === 'favorable' && calmRisk),
      interpretation: '이 조건들이 함께 충족되면 지수의 상승 추세를 다수 종목의 참여가 뒷받침하는 흐름으로 읽습니다. 반등이 이어질지는 참여도와 자금 조달 여건의 다음 관측으로 확인합니다.',
      conditions: [`S&P 500이 상승하는 50일선 위이고 50일선이 200일선 위인 상태.`, `50일선·200일선 위 종목 비율이 모두 ${RULES.breadth.broadAtLeast}% 이상.`, `HY OAS·변동성이 부담 판정에 들어가지 않는지 함께 확인.`],
      counterEvidence: `지수의 추세가 약해지거나 참여도 둘 중 하나가 ${RULES.breadth.broadAtLeast}% 아래로 내려오면 확산 해석을 다시 확인합니다. HY 확대나 VIX 기간 구조 역전이 동반되면 회복의 근거가 약해집니다.`,
      observe: ['지수만 상승하는지, 50일·200일 참여도도 동행하는지', '신고가가 신저가보다 많아지는지', 'HY 스프레드가 급격히 넓어지는지'] },
    { id: 'concentration', title: '집중 유지', confirmed: confirmed(byId.trend?.state === 'favorable' && byId.breadth?.state === 'burden' && calmRisk),
      interpretation: '이 조건들이 함께 보이면 지수 추세와 표본 종목의 참여도가 갈라진 흐름으로 읽습니다. 일부 종목에 상승이 집중됐을 가능성을 살피되, 실제 지수 구성 종목의 기여도를 확인하기 전에는 대형주가 원인이라고 단정하지 않습니다.',
      conditions: [`S&P 500의 상승 추세가 유지되지만 50일선·200일선 위 비율 중 하나가 ${RULES.breadth.weakBelow}% 미만.`, 'HY OAS와 변동성이 부담 판정으로 함께 넘어가지 않는 상태.'],
      counterEvidence: `참여도 두 비율이 모두 ${RULES.breadth.broadAtLeast}% 이상으로 넓어지면 확산 쪽을 확인합니다. 지수 추세가 약해지면서 HY·변동성 부담까지 커지면 집중 유지 해석은 약해집니다.`,
      observe: ['지수 고점과 참여 종목 비율 사이의 괴리가 줄어드는지', '기존 주도 종목과 새로 강해지는 종목이 바뀌는지', '신용·변동성이 주가와 다른 경고를 내는지'] },
    { id: 'weakness', title: '동반 약화', confirmed: confirmed(byId.trend?.state === 'burden' && byId.breadth?.state === 'burden' && (byId.credit?.state === 'burden' || byId.volatility?.state === 'burden')),
      interpretation: '이 조건들이 함께 보이면 지수·참여도 약화가 신용 또는 변동성의 스트레스와 동반된 흐름으로 읽습니다. 한 지표의 일시적 급등과 여러 축의 동시 변화를 구분합니다.',
      conditions: ['S&P 500이 200일선 아래이거나 하락하는 50일선 아래로 마감.', `50일선·200일선 위 종목 비율 중 하나가 ${RULES.breadth.weakBelow}% 미만.`, `HY ${RULES.credit.stressAtBp}bp 이상 또는 5일 +${RULES.credit.widen5dBp}bp 확대, 혹은 VIX ${RULES.volatility.stressAt} 이상·기간 구조 역전·5일 +${RULES.volatility.spike5dPct}% 급등 중 실제 부담 신호가 동반.`],
      counterEvidence: '지수가 이동평균을 회복하고 참여도가 넓어지며 HY 확대와 변동성 스트레스가 함께 진정되면 동반 약화의 근거를 다시 확인합니다. 금리 하락만으로 이 조건들이 충족됐다고 보지 않습니다.',
      observe: ['지수 회복이 하루 움직임에 그치는지', '시장 폭과 신고가·신저가도 동시에 회복하는지', 'HY 확대·VIX 역전이 실제로 완화되는지'] }
  ].map(item => ({ ...item, held: hold, status: hold ? '판단 보류' : item.confirmed ? '현재 조건 부합' : '관찰할 조건',
    facts, missing: missing.map(id => byId[id]?.title || id) }));
  return { available: true, asOf: regime.asOf, held: hold, scenarios,
    axes: regime.axes.map(axis => ({ id: axis.id, observe: OBSERVE[axis.id] || '', condition: axis.flip || null })),
    reason: hold ? `${missing.map(id => byId[id]?.title || id).join(' · ')}의 필요한 관측이 없어 현재 어느 흐름에 해당하는지 보류합니다.` : null };
}

export function renderMarketScenarioContext(input = {}, options = {}) {
  const model = buildMarketScenarios(input, options);
  if (!model.available) return '';
  return `시장 화면과 같은 ${model.asOf} 완료 종가의 조건부 해석. 예측 확률·목표가가 아닙니다.${model.reason ? ` ${model.reason}` : ''}\n`
    + model.scenarios.map(item => `${item.title} (${item.status}): ${item.interpretation}\n관측: ${item.facts.join('; ')}\n유효 조건: ${item.conditions.join(' ')}\n반증: ${item.counterEvidence}\n다음 확인: ${item.observe.join('; ')}`).join('\n');
}

// P1628: a Korean index observation belongs to its KRX session, never the US
// cycle row carrying it through a Korean holiday/weekend.
export function buildKoreaIndexSeries(history = [], field, { nowMs = Date.now() } = {}) {
  const completed = latestCompletedKrSession(nowMs);
  if (!completed) return [];
  const byDate = new Map();
  for (const row of Array.isArray(history) ? history : []) {
    const value = finite(row?.[field]);
    const meta = row?.fieldMeta?.[field];
    if (!(value > 0) || meta?.observationRelation === 'current-session' || meta?.valueBasis === 'current-session') continue;
    const stamp = String(meta?.observedAt || row?.date || '');
    let observed = date(stamp);
    if (!observed && Number.isFinite(Date.parse(stamp))) observed = new Date(stamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    if (!observed || observed > completed.date || resolveMarketCalendarSession({ market: 'KR', date: observed }).status !== 'open') continue;
    byDate.set(observed, value);
  }
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([stamp, value]) => ({ date: stamp, value }));
}

export function buildKoreaRegimeObservations(input = {}, { nowMs = Date.now(), through = null } = {}) {
  const completed = latestCompletedKrSession(nowMs);
  const definitions = [['kospi', '코스피', '한국 대형주 중심 지수'], ['kosdaq', '코스닥', '코스닥 상장 종목 지수']];
  const indices = definitions.map(([id, title, scope]) => {
    const series = buildKoreaIndexSeries(input.history, id, { nowMs }).slice(-126);
    const last = series.at(-1), prior = series.at(-22);
    const change = last && prior?.value > 0 && countOpenSessionsBetween(prior.date, last.date, 'KR') === 21 ? (last.value / prior.value - 1) * 100 : null;
    return last ? { id, title, scope, series, asOf: last.date, last: last.value, change, unit: '지수 pt',
      stale: !!completed && last.date !== completed.date,
      read: change == null ? '1개월 변화를 계산할 완료 세션 기록이 부족합니다.' : `최근 21개 한국 거래일 ${change >= 0 ? '+' : ''}${change.toFixed(1)}%. 이 지수 안 종목들이 같은 방향인지 한국 시장 폭과 함께 확인합니다.`,
      observe: '미국장 기준일과 분리해 읽습니다. 지수 상승이 참여 종목 확대로 이어지는지 다음 한국 종가에서 확인합니다.' } : null;
  }).filter(Boolean);
  const fx = buildCloseSeries(input.history, 'usdkrw', { through }).filter(point => {
    const weekday = new Date(`${point.date}T12:00:00Z`).getUTCDay(); return weekday !== 0 && weekday !== 6;
  }).slice(-126);
  const lastFx = fx.at(-1), priorFx = fx.at(-22);
  const fxChange = lastFx && priorFx?.value > 0 ? (lastFx.value / priorFx.value - 1) * 100 : null;
  const cards = [...indices];
  if (lastFx) cards.push({ id: 'usdkrw', title: '원 / 달러', scope: '외환 관측일 · 뉴욕 날짜', series: fx, asOf: lastFx.date, last: lastFx.value, change: fxChange, unit: 'KRW / USD', stale: false,
    read: fxChange == null ? '방향을 계산할 외환 관측 기록이 부족합니다.' : `21개 외환 관측 ${fxChange >= 0 ? '+' : ''}${fxChange.toFixed(1)}%. ${fxChange > 0 ? '같은 달러에 더 많은 원화가 필요해 원화 약세 방향입니다.' : fxChange < 0 ? '같은 달러에 필요한 원화가 줄어 원화 강세 방향입니다.' : '같은 구간의 변화가 없습니다.'} 외국인 수급이나 수출 실적의 실제 변화는 별도 자료로 확인합니다.`,
    observe: '환율 움직임과 한국 주가를 같은 날짜·기간으로 확인합니다. 서로 관측일이 다르면 직접적인 인과나 상대강도로 단정하지 않습니다.' });
  const dates = indices.map(item => item.asOf);
  return { available: cards.length > 0, cards, asOf: dates.length ? dates.sort().at(-1) : null,
    note: '한국 지수는 한국 정규장 완료 종가, 환율은 별도 외환 관측입니다. 미국 6개 축의 우호·중립·부담 합계에 넣지 않습니다.' };
}
