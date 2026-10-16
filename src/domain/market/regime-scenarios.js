// P1628: observed six-axis conditions, shared by the market screen and AI context.
// This is a conditional reading of completed observations, never a forecast or a trade instruction.
import { alignMarketInputs, buildCloseSeries, buildMarketRegime, usdKrwWindow } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';
import { latestCompletedKrSession, resolveMarketCalendarSession, countOpenSessionsBetween } from './market-calendar.js';
import { historyFieldSessionDate, isHeldHistoryValue } from './history-session.js';
import { krIndexMoveRecord, krIndexMoveText, KR_MONTH_SESSIONS } from './kr-index-record.js';

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

function tierGap(weak, strong) {
  const byDate = new Map(strong.map((point) => [point.date, point.value]));
  return weak.filter((point) => byDate.has(point.date)).map((point) => ({ date: point.date, value: point.value - byDate.get(point.date) }));
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
    trend: [chart('spx', 'S&P 500 종가', '지수 pt', spx, { note: '지수의 확정 종가 추이. 이동평균 위치와 방향은 아래 근거에서 함께 확인합니다.' }),
      // v57.81: the leadership proxy and the small caps beside the S&P 500 — the trend axis is capped when both break.
      chart('ndx', '나스닥 100 종가', '지수 pt', daily('ndx'), { note: '주도 대형 기술주의 흐름. 5거래일 3% 이상 하락하면 주도 영역이 약해지는지 확인합니다.' }),
      chart('rut', '러셀 2000 종가', '지수 pt', daily('rut'), { note: '중소형주의 흐름. 200일선 아래에 있으면 상승이 대형주 밖으로 퍼지지 못한 상태입니다.' })],
    breadth: [chart('breadth20', '20일선 위 종목 비율 (단기)', '%', daily('breadth20'), { format: percent, refs: [RULES.breadth.weakBelow, RULES.breadth.broadAtLeast], domain: [0, 100], note: '단기 참여도. 50일선 비율보다 먼저 움직여 참여가 넓어지거나 줄어드는 방향을 먼저 보여 줍니다.' }),
      chart('breadth50', '50일선 위 종목 비율', '%', daily('breadth50'), { format: percent, refs: [RULES.breadth.weakBelow, RULES.breadth.broadAtLeast], domain: [0, 100], note: 'AIO 미국 수집 표본의 비율. 전체 미국 거래소 종목을 집계한 값과 모집단이 다릅니다.' }),
      chart('breadth200', '200일선 위 종목 비율', '%', daily('breadth200'), { format: percent, refs: [RULES.breadth.weakBelow, RULES.breadth.broadAtLeast], domain: [0, 100], note: '중기 참여도(50일)와 장기 참여도(200일)가 함께 넓어지는지 비교합니다.' })],
    volatility: [chart('vix', 'VIX', '지수 pt', daily('vix'), { format: value => value.toFixed(1), refs: [RULES.volatility.calmBelow, RULES.volatility.stressAt] }),
      chart('vix-term', 'VIX / 3개월 VIX', '배', ratio, { format: value => value.toFixed(2), refs: [RULES.volatility.calmRatioBelow, RULES.volatility.invertedRatioAt], note: '같은 관측일의 두 지수만 나눕니다. 1 이상은 단기 변동성이 중기보다 높은 기간 구조입니다.' })],
    rates: [chart('tnx', '미 10년물 명목금리', '%', daily('tnx'), { format: percent }),
      chart('tips', '10년 실질금리(TIPS)', '%', macro('realYield10'), { format: percent, note: '명목금리와 실질금리는 서로 다른 관측일일 수 있습니다. 같은 날짜의 자료가 없으면 분해해 단정하지 않습니다.' }),
      chart('breakeven', '10년 기대인플레이션', '%', macro('breakeven10'), { format: percent, note: '물가 예상만이 아니라 유동성·위험 프리미엄도 포함하는 인플레이션 보상 지표입니다.' })],
    credit: [chart('hy', '하이일드 스프레드(OAS)', 'bp', macro('hyOas', 100), { refs: [RULES.credit.tightBelowBp, RULES.credit.stressAtBp], note: '하이일드 스프레드는 수준과 5거래일 확대·축소를 구분해서 읽습니다.' }),
      // v57.79 (UI review): chart names carry a plain-Korean name with the market abbreviation in brackets (OAS · CCC · TIPS).
      // P1638: the weakest tier against B — the average can stay calm while CCC borrowers lose access first.
      chart('ccc-b', '최하위(CCC)·B 등급 가산금리 격차', 'bp', tierGap(macro('cccOas', 100), macro('bOas', 100)), { note: '가장 약한 등급(CCC 이하)과 B 등급의 OAS 차이. 격차는 상대 차이입니다. 벌어지면 시장이 가장 약한 기업을 더 따로 가려내고 있다는 뜻이며, CCC 금리 수준 자체가 올랐는지는 하이일드 가산금리와 함께 확인합니다.' })],
    commodities: [chart('wti', 'WTI 선물', 'USD / 배럴', daily('wti'), { format: value => `$${value.toFixed(1)}` }),
      chart('dxy', '달러 인덱스', '지수 pt', daily('dxy'), { format: value => value.toFixed(1) })],
    korea: [chart('usdkrw', '원 / 달러', 'KRW / USD', daily('usdkrw'), { format: count })]
  };
  return { range, axes: Object.fromEntries(Object.entries(definitions).map(([id, charts]) => [id, charts.filter(item => item.series.length > 1)])) };
}

export const TRANSITION_TITLE = '소수 주도 → 동반 약세 전환 확인 중';

const OBSERVE = Object.freeze({
  trend: '지수가 이동평균 위·아래로 마감하는지와 50일선 방향을 함께 확인합니다.',
  breadth: '50일선과 200일선 위 비율이 같은 방향인지, 신고가·신저가가 참여도 변화를 확인하는지 봅니다.',
  volatility: 'VIX 수준, 5일 변화, VIX/3개월 VIX가 함께 안정 또는 스트레스를 가리키는지 봅니다.',
  rates: '명목금리의 20일 변화와 최근 5일 되돌림을 구분하고, 같은 날짜의 TIPS·기대인플레가 원인을 뒷받침하는지 봅니다.',
  credit: 'HY OAS의 높은 수준과 빠른 확대를 구분합니다. 폭이 좁아지는지, 확대가 연속되는지 확인합니다.',
  commodities: '유가와 달러가 동시에 부담을 만드는지, 하나의 상승을 다른 자산까지 확대해 읽고 있지 않은지 봅니다.',
  korea: '원·엔의 환율과 한국·일본 주가를 따로 확인합니다. 미국 6개 지표의 합계에는 넣지 않습니다.'
});

export function buildMarketScenarios(input = {}, { regime = buildMarketRegime(input) } = {}) {
  if (!regime.available) return { available: false, asOf: null, scenarios: [], axes: [], reason: '확정 종가 기록이 없어 조건 해석을 보류합니다.' };
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
  if (regime.staleBasis && !missing.includes('basis')) missing.push('basis'); // M05: an old close is not today's condition
  if ((!aligned.s.vix || !aligned.s.vix3m || aligned.s.vix.date !== aligned.s.vix3m.date || aligned.s.vix.d5 == null)
    && !missing.includes('volatility')) missing.push('volatility');
  const hold = missing.length > 0;
  const facts = essential.flatMap(id => (byId[id]?.evidence || []).slice(0, id === 'trend' ? 2 : 1).map(([label, value]) => `${label} ${value}`));
  const confirmed = states => !hold && states;
  // P1727: "credit calm" is the shared creditState 'favorable' (the outlook's 부합 count uses the same rule); a neutral
  // credit axis (HY +45bp over 20 sessions) confirmed 소수 종목 주도 here while the outlook counted it 미충족 (3/4).
  const calmRisk = byId.credit?.state === 'favorable' && byId.volatility?.state !== 'burden';
  // v57.81 (owner 2026-10-15): 소수 종목 주도 also needs the leaders to be holding (regime.leadership, market-read). When the
  // leadership proxy and the market-wide confirmations break together, the weakness card carries the transition reading
  // ('소수 주도 → 동반 약세 전환 확인 중') — the three ids stay, so the forward-branch registry's shape keys are unchanged.
  const leadership = regime.leadership || { state: 'unknown', break: false };
  const leadersHolding = leadership.state === 'holding';
  const transition = !hold && !!leadership.break;
  const scenarios = [
    { id: 'expansion', title: '고른 상승', confirmed: confirmed(byId.trend?.state === 'favorable' && byId.breadth?.state === 'favorable' && calmRisk),
      interpretation: '이 조건들이 함께 충족되면 지수의 상승 추세를 다수 종목의 참여가 뒷받침하는 흐름으로 읽습니다. 반등이 이어질지는 참여도와 자금 조달 여건의 다음 관측으로 확인합니다.',
      conditions: [`S&P 500이 상승하는 50일선 위이고 50일선이 200일선 위인 상태.`, `50일선·200일선 위 종목 비율이 모두 ${RULES.breadth.broadAtLeast}% 이상.`, `신용 지표가 양호(HY ${RULES.credit.tightBelowBp}bp 미만, 5일·20거래일 확대 없음)이고 변동성이 부담 판정이 아닌 상태.`],
      counterEvidence: `지수의 추세가 약해지거나 참여도 둘 중 하나가 ${RULES.breadth.broadAtLeast}% 아래로 내려오면 확산 해석을 다시 확인합니다. HY 확대나 VIX 기간 구조 역전이 동반되면 회복의 근거가 약해집니다.`,
      observe: ['지수만 상승하는지, 50일·200일 참여도도 동행하는지', '신고가가 신저가보다 많아지는지', '하이일드 스프레드가 급격히 넓어지는지'] },
    { id: 'concentration', title: '소수 종목 주도', confirmed: confirmed(byId.trend?.state === 'favorable' && byId.breadth?.state === 'burden' && calmRisk && leadersHolding),
      interpretation: '이 조건들이 함께 보이면 지수 추세와 표본 종목의 참여도가 갈라진 흐름으로 읽습니다. 일부 종목에 상승이 집중됐을 가능성을 살피되, 실제 지수 구성 종목의 기여도를 확인하기 전에는 대형주가 원인이라고 단정하지 않습니다.',
      conditions: [`S&P 500의 상승 추세가 유지되지만 50일선·200일선 위 비율 중 하나가 ${RULES.breadth.weakBelow}% 미만.`, `신용 지표가 양호(HY ${RULES.credit.tightBelowBp}bp 미만, 5일·20거래일 확대 없음)이고 변동성이 부담 판정이 아닌 상태.`,
        `주도 영역 유지: 나스닥 100이 5거래일 -${RULES.trend.leaderDrop5dPct}% 이상 밀리거나 50일선 아래로 내려간 상태에서 신저가 우위·상승 종목 ${Math.round(RULES.leadership.advanceRatioWeakBelow * 100)}% 미만·분배일 ${RULES.leadership.distributionDaysAt}일 이상·러셀 2000 200일선 아래 중 ${RULES.leadership.minConfirmations}개 이상이 겹치지 않은 상태.`],
      counterEvidence: `참여도 두 비율이 모두 ${RULES.breadth.broadAtLeast}% 이상으로 넓어지면 고른 상승 쪽을 확인합니다. 주도 영역이 꺾이고 신저가·분배일·중소형주 약세가 겹치거나, 지수 추세가 약해지면서 HY·변동성 부담까지 커지면 소수 종목 주도 해석은 약해집니다.`,
      observe: ['지수 고점과 참여 종목 비율 사이의 괴리가 줄어드는지', '기존 주도 종목과 새로 강해지는 종목이 바뀌는지', '신용·변동성이 주가와 다른 경고를 내는지'] },
    { id: 'weakness', title: '동반 약세', confirmed: confirmed(byId.trend?.state === 'burden' && byId.breadth?.state === 'burden' && (byId.credit?.state === 'burden' || byId.volatility?.state === 'burden')),
      interpretation: '이 조건들이 함께 보이면 지수·참여도 약화가 신용 또는 변동성의 스트레스와 동반된 흐름으로 읽습니다. 한 지표의 일시적 급등과 여러 지표의 동시 변화를 구분합니다.',
      conditions: ['S&P 500이 200일선 아래이거나 하락하는 50일선 아래로 마감.', `50일선·200일선 위 종목 비율 중 하나가 ${RULES.breadth.weakBelow}% 미만.`, `HY ${RULES.credit.stressAtBp}bp 이상 또는 5일 +${RULES.credit.widen5dBp}bp 확대, 혹은 VIX ${RULES.volatility.stressAt} 이상·기간 구조 역전·5일 +${RULES.volatility.spike5dPct}% 급등 중 실제 부담 신호가 동반.`],
      counterEvidence: '지수가 이동평균을 회복하고 참여도가 넓어지며 HY 확대와 변동성 스트레스가 함께 진정되면 동반 약세의 근거를 다시 확인합니다. 금리 하락만으로 이 조건들이 충족됐다고 보지 않습니다.',
      observe: ['지수 회복이 하루 움직임에 그치는지', '시장 폭과 신고가·신저가도 동시에 회복하는지', 'HY 확대·VIX 역전이 실제로 완화되는지'] }
  ].map(item => ({ ...item, held: hold, status: hold ? '판단 보류' : item.confirmed ? '현재 조건 충족' : '관찰할 조건',
    facts, missing: missing.map(id => byId[id]?.title || (id === 'basis' ? '최신 종가 기록' : id)),
    // v57.81: an unconfirmed weakness card reads as the transition while the leadership break holds.
    transition: item.id === 'weakness' && transition && !item.confirmed ? TRANSITION_TITLE : null }));
  return { available: true, asOf: regime.asOf, held: hold, scenarios, leadership: { state: leadership.state, break: !!leadership.break, summary: leadership.summary || null, met: leadership.met ?? 0, total: leadership.confirmations?.length ?? 0, need: leadership.need ?? RULES.leadership.minConfirmations },
    axes: regime.axes.map(axis => ({ id: axis.id, observe: OBSERVE[axis.id] || '', condition: axis.flip || null })),
    reason: hold ? (regime.staleBasis ? regime.holdReason : `${missing.map(id => byId[id]?.title || id).join(' · ')}의 필요한 관측이 없어 현재 어느 흐름에 해당하는지 보류합니다.`) : null };
}

export function renderMarketScenarioContext(input = {}, options = {}) {
  const model = buildMarketScenarios(input, options);
  if (!model.available) return '';
  // v57.81: the leadership-break flag is stated before the cards, so the narrative cannot say the leaders are still leading.
  const lead = model.leadership?.break ? `주도 영역 이탈(leadershipBreak): 예 — ${model.leadership.summary}. 소수 종목 주도 조건 미충족, '${TRANSITION_TITLE}'.\n`
    : model.leadership?.state === 'weak' ? `주도 영역 이탈(leadershipBreak): 확산 미확인 — ${model.leadership.summary}. 주도주는 약해졌고 시장 전반 확인은 ${model.leadership.met}/${model.leadership.total}개. 소수 종목 주도 조건 미충족.\n`
    : model.leadership?.state === 'holding' ? '주도 영역 이탈(leadershipBreak): 아니오.\n' : '주도 영역 이탈(leadershipBreak): 확인 불가.\n';
  return `시장 화면과 같은 ${model.asOf} 확정 종가의 조건부 해석. 예측 확률·목표가가 아닙니다.${model.reason ? ` ${model.reason}` : ''}\n` + lead
    + model.scenarios.map(item => `${item.transition || item.title} (${item.status}): ${item.interpretation}\n관측: ${item.facts.join('; ')}\n유효 조건: ${item.conditions.join(' ')}\n반증: ${item.counterEvidence}\n다음 확인: ${item.observe.join('; ')}`).join('\n');
}

// P1628: a Korean index observation belongs to its KRX session, never the US
// cycle row carrying it through a Korean holiday/weekend.
// P1755: one shared formatter (toLocaleDateString built one per row) and a memo per history array identity
// (+ length guard), field and completed KRX session date — the only time-dependent input. Callers get fresh points.
const KST_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' });
const KOREA_SERIES_MEMO = new WeakMap();
export function buildKoreaIndexSeries(history = [], field, { nowMs = Date.now() } = {}) {
  const completed = latestCompletedKrSession(nowMs);
  if (!completed) return [];
  if (!Array.isArray(history)) return computeKoreaIndexSeries(history, field, completed);
  let memo = KOREA_SERIES_MEMO.get(history);
  if (!memo || memo.length !== history.length) {
    memo = { length: history.length, series: new Map() };
    KOREA_SERIES_MEMO.set(history, memo);
  }
  const key = JSON.stringify([field, completed.date]);
  let series = memo.series.get(key);
  if (!series) {
    series = computeKoreaIndexSeries(history, field, completed);
    memo.series.set(key, series);
  }
  return series.map((point) => ({ ...point }));
}
function computeKoreaIndexSeries(history, field, completed) {
  const byDate = new Map();
  for (const row of Array.isArray(history) ? history : []) {
    const value = finite(row?.[field]);
    const meta = row?.fieldMeta?.[field];
    if (!(value > 0) || meta?.observationRelation === 'current-session' || meta?.valueBasis === 'current-session') continue;
    // v57.81: a held copy is not a session; a session-dated (or previous-close) value is dated by its own session.
    if (isHeldHistoryValue(meta)) continue;
    const stamp = String(meta?.observedAt || row?.date || '');
    let observed = historyFieldSessionDate(meta, field) || date(stamp);
    if (!observed && Number.isFinite(Date.parse(stamp))) observed = KST_DATE.format(new Date(stamp));
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
    // v57.81: one month is KR_MONTH_SESSIONS on both Korean index cards, and the day/5-day move with its record position
    // (when rare) is the same record the briefing reads (kr-index-record.js).
    const last = series.at(-1), prior = series.at(-(KR_MONTH_SESSIONS + 1));
    const change = last && prior?.value > 0 && countOpenSessionsBetween(prior.date, last.date, 'KR') === KR_MONTH_SESSIONS ? (last.value / prior.value - 1) * 100 : null;
    const record = last ? krIndexMoveRecord(input.history, id, { now: nowMs }) : null;
    const move = record?.date === last?.date ? krIndexMoveText(record) : '';
    return last ? { id, title, scope, series, asOf: last.date, last: last.value, change, unit: '지수 pt',
      stale: !!completed && last.date !== completed.date,
      read: change == null ? `${move ? `${move}. ` : ''}1개월 변화를 계산할 완료 세션 기록이 부족합니다.` : `최근 ${KR_MONTH_SESSIONS}거래일(한국) ${change >= 0 ? '+' : ''}${change.toFixed(1)}%${move ? ` · ${move}` : ''}. 이 지수 안 종목들이 같은 방향인지 한국 시장 폭과 함께 확인합니다.`, record,
      // T20 (expert review 2026-10-13): the follow-up names the direction the index actually moved (-8.7% read "지수 상승이…").
      observe: `미국장 기준일과 분리해 읽습니다. ${change == null ? '지수 움직임이 참여 종목의 같은 방향 움직임으로 이어지는지' : change >= 0 ? '지수 상승이 참여 종목 확대로 이어지는지' : '지수 하락이 종목 전반으로 퍼지는지, 일부 대형주에 그치는지'} 다음 한국 종가에서 확인합니다.` } : null;
  }).filter(Boolean);
  const fx = buildCloseSeries(input.history, 'usdkrw', { through }).filter(point => {
    const weekday = new Date(`${point.date}T12:00:00Z`).getUTCDay(); return weekday !== 0 && weekday !== 6;
  }).slice(-126);
  // v57.81: the same 20-session window as the 환율 axis (usdKrwWindow) — the card used 21 observations from another base.
  const lastFx = fx.at(-1);
  const fxWindow = usdKrwWindow(fx);
  const fxChange = fxWindow ? fxWindow.change : null;
  const cards = [...indices];
  if (lastFx) cards.push({ id: 'usdkrw', title: '원 / 달러', scope: '외환 관측일 · 뉴욕 날짜', series: fx, asOf: lastFx.date, last: lastFx.value, change: fxChange, unit: 'KRW / USD', stale: false,
    // T20: a move inside ±0.5% is 보합권, not a currency direction.
    read: fxChange == null ? '방향을 계산할 외환 관측 기록이 부족합니다.' : `20거래일 ${fxChange >= 0 ? '+' : ''}${fxChange.toFixed(1)}%${fxWindow.meanShift != null ? `(20일 평균 ${fxWindow.meanShift >= 0 ? '+' : ''}${fxWindow.meanShift.toFixed(1)}%)` : ''}. ${Math.abs(fxChange) < RULES.fx.krwFlatPct ? `±${RULES.fx.krwFlatPct}% 안의 움직임이라 원화 방향을 말하기 어려운 보합권입니다.` : !fxWindow.agrees ? `20일 평균은 그만큼 움직이지 않아 시작점의 일시적 수준 영향이 큽니다 — 원화 ${fxChange > 0 ? '약세' : '강세'}로 단정하지 않습니다.` : fxChange > 0 ? '같은 달러에 더 많은 원화가 필요해 원화 약세 방향입니다.' : '같은 달러에 필요한 원화가 줄어 원화 강세 방향입니다.'} 외국인 수급이나 수출 실적의 실제 변화는 별도 자료로 확인합니다.`,
    observe: '환율 움직임과 한국 주가를 같은 날짜·기간으로 확인합니다. 서로 관측일이 다르면 직접적인 인과나 상대강도로 단정하지 않습니다.' });
  const dates = indices.map(item => item.asOf);
  return { available: cards.length > 0, cards, asOf: dates.length ? dates.sort().at(-1) : null,
    note: '한국 지수는 한국 정규장 확정 종가, 환율은 별도 외환 관측입니다. 미국 6개 지표의 양호·중립·부담 합계에 넣지 않습니다.' };
}
