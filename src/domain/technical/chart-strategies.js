// v58.79 (owner 2026-10-25, chart review): three things the chart screen did not say plainly — which way the trend runs and
// whether it is turning, how the same chart reads under different trading styles (so a reader picks the logic that fits
// them), and what a reward-to-risk ratio means in win-rate terms. Every input is a completed daily bar or a field the chart
// analysis and the price-level map already computed; met counts are counts, not probabilities, and no price here is a
// proposed entry, stop or target (R724) — each style names its own published rule; this stock's prices stay in the level
// map (v59.46 P24-PRODUCT-01).
import { swingPoints } from './price-levels.js';
import { RULES } from '../rules/thresholds.js';
import { finiteNumber as finite } from '../shared/number.js';

const at = (series, back = 0) => (Array.isArray(series) ? finite(series[series.length - 1 - back]) : null);
const pct = (a, b) => (a > 0 && b > 0 ? (a / b - 1) * 100 : null);

/** Direction from structure (swing highs/lows), the moving-average order and the 50-day slope, plus any turn under way. */
export function trendRead(analysis) {
  if (!analysis?.available) return null;
  const bars = analysis.bars, n = bars.length - 1, close = bars[n].close;
  const sma50 = at(analysis.lines?.sma50), sma200 = at(analysis.lines?.sma200), sma50Then = at(analysis.lines?.sma50, 20);
  const slope50 = pct(sma50, sma50Then);
  const { highs, lows } = swingPoints(bars, Math.max(0, bars.length - 252), 5);
  const lastTwo = (list, key) => list.slice(-2).map((i) => bars[i][key]);
  const [h1, h2] = lastTwo(highs, 'high'), [l1, l2] = lastTwo(lows, 'low');
  const structure = h2 != null && l2 != null && h1 != null && l1 != null ? (h2 > h1 && l2 > l1 ? 'up' : h2 < h1 && l2 < l1 ? 'down' : 'mixed') : null;
  const order = sma50 && sma200 ? (close > sma50 && sma50 > sma200 ? 'up' : close < sma50 && sma50 < sma200 ? 'down' : 'mixed') : null;
  const votes = [structure, order, slope50 == null ? null : slope50 > 1 ? 'up' : slope50 < -1 ? 'down' : 'mixed'].filter(Boolean);
  const up = votes.filter((v) => v === 'up').length, down = votes.filter((v) => v === 'down').length;
  const direction = votes.length < 2 ? null : up >= 2 && !down ? 'up' : down >= 2 && !up ? 'down' : 'sideways';
  const facts = [
    structure ? `고점·저점: ${structure === 'up' ? '높아지는 고점과 저점' : structure === 'down' ? '낮아지는 고점과 저점' : '엇갈림'}` : null,
    order ? `이동평균: ${order === 'up' ? '종가 > 50일선 > 200일선' : order === 'down' ? '종가 < 50일선 < 200일선' : '혼조'}` : null,
    slope50 != null ? `50일선 20거래일 기울기 ${slope50 >= 0 ? '+' : ''}${slope50.toFixed(1)}%` : null
  ].filter(Boolean);
  // A turn: the last swing high (low) broken against the trend, or a 50/200 cross in the last 20 sessions.
  const lastHigh = highs.length ? bars[highs.at(-1)].high : null, lastLow = lows.length ? bars[lows.at(-1)].low : null;
  let cross = null;
  const s50 = analysis.lines?.sma50 || [], s200 = analysis.lines?.sma200 || [];
  for (let k = n; k > Math.max(0, n - 20); k--) {
    if (s50[k] == null || s200[k] == null || s50[k - 1] == null || s200[k - 1] == null) break;
    if ((s50[k] > s200[k]) !== (s50[k - 1] > s200[k - 1])) { cross = { golden: s50[k] > s200[k], ago: n - k }; break; }
  }
  const turn = (direction === 'down' || structure === 'down') && lastHigh && close > lastHigh ? `직전 스윙 고점 ${lastHigh.toFixed(2)} 위 종가 — 하락 구조가 깨지는 첫 신호(전환 시도)`
    : (direction === 'up' || structure === 'up') && lastLow && close < lastLow ? `직전 스윙 저점 ${lastLow.toFixed(2)} 아래 종가 — 상승 구조가 깨지는 첫 신호(훼손)`
      : cross ? `${cross.ago}거래일 전 50일선이 200일선을 ${cross.golden ? '위로(골든 크로스)' : '아래로(데드 크로스)'} 교차 — 늦게 나오는 확인 신호`
        : null;
  const label = { up: '상승 추세', down: '하락 추세', sideways: '횡보·전환 구간' }[direction] || '판단 보류';
  return { direction, label, facts, turn, structure, order, slope50, lastHigh, lastLow };
}

// The styles a reader can choose. `who` says whose temperament the style suits; rules cite the published source.
export const STRATEGY_STYLES = Object.freeze([
  { id: 'breakout', name: '돌파', who: '며칠~몇 주, 오르는 종목을 더 오를 때 사는 성향', source: 'O\'Neil·Minervini(피벗·변동성 수축)' },
  { id: 'pullback', name: '눌림목', who: '몇 주, 상승 추세 안에서 쉬어 갈 때 사는 성향', source: '추세 추종(21일 EMA·50일선 되돌림)' },
  { id: 'position', name: '장기 추세', who: '몇 달 이상, 큰 흐름이 바뀔 때까지 들고 가는 성향', source: 'Weinstein 단계(30주선)' },
  { id: 'reversion', name: '과매도 되돌림', who: '며칠, 많이 빠진 뒤의 짧은 반등만 노리는 성향', source: '평균 회귀(RSI·50일선 거리)' }
]);

/** The same chart read under each style: conditions met (a count), and the style's own stop, target and invalidation rule. */
export function strategyLenses(analysis, levels = null, { rsi = null } = {}) {
  if (!analysis?.available) return [];
  const bars = analysis.bars, n = bars.length - 1, close = bars[n].close;
  const ema21 = at(analysis.lines?.ema21), sma50 = at(analysis.lines?.sma50), sma200 = at(analysis.lines?.sma200), sma200Then = at(analysis.lines?.sma200, 20);
  const adr = analysis.adrPct > 0 ? close * analysis.adrPct / 100 : null;
  const near = (price, multiple = 1.5) => (price > 0 && adr ? Math.abs(close - price) <= adr * multiple : null);
  const templateMet = (analysis.templateChecks || []).filter(([, ok]) => ok === true).length;
  const stage = analysis.weinstein?.stage ?? null;
  const vol5 = bars.slice(-5).reduce((sum, bar) => sum + (bar.volume || 0), 0) / 5;
  const vol50 = bars.slice(-50).reduce((sum, bar) => sum + (bar.volume || 0), 0) / 50;
  const quietPullback = vol5 > 0 && vol50 > 0 ? vol5 < vol50 : null;
  const hot = RULES.technical.rsi.overbought, cold = RULES.technical.rsi.oversold;
  const fmt = (value) => (value > 0 ? value.toFixed(value >= 1000 ? 0 : 2) : '—');
  const pack = (style, conditions, rules) => {
    const known = conditions.filter(([, ok]) => ok != null);
    return { ...style, conditions, met: known.filter(([, ok]) => ok).length, known: known.length, total: conditions.length, ...rules };
  };
  const pivot = analysis.pivot;
  return [
    pack(STRATEGY_STYLES[0], [
      [`추세 템플릿 8개 중 7개 이상 (지금 ${templateMet}개)`, templateMet >= 7],
      ['유효한 변동성 수축과 피벗', pivot > 0 ? true : false],
      [`피벗까지 5% 이내 또는 막 돌파${pivot > 0 ? ` (피벗 ${fmt(pivot)})` : ''}`, pivot > 0 ? close >= pivot * 0.95 && close <= pivot * 1.05 : null],
      ['최근 10일 거래량이 50일 평균의 80% 미만(마름)', analysis.dryUp == null ? null : analysis.dryUp < 0.8],
      ['상대강도선이 1년 고점 근처(-5% 이내)', analysis.rsFromHigh == null ? null : analysis.rsFromHigh >= -5]
    // v59.46 P24-PRODUCT-01 (R724): stop/target/invalidation are the style's published rule only. This stock's prices
    // (pivot, EMA, 50/200-day, swing points, volume zones) sit in the level map; the lens no longer writes them into a
    // stop or target slot, and no rule tells the reader to sell — it says what the style's practitioners do.
    ], {
      stop: '피벗 아래로 다시 들어오거나 마지막 수축 저점 아래 종가 — 이 방식은 보통 진입가의 5~8% 안에 둡니다',
      target: '베이스 깊이만큼의 측정 이동폭, 또는 감수한 위험 폭의 2~3배 구간에서 이익 일부를 확정하는 것이 이 방식의 규칙입니다',
      invalidation: '돌파한 날의 거래량이 평소의 1.5배에 못 미치거나, 며칠 안에 피벗 아래 종가'
    }),
    pack(STRATEGY_STYLES[1], [
      ['상승 추세 (종가 > 50일선 > 200일선)', sma50 && sma200 ? close > sma50 && sma50 > sma200 : null],
      [`21일 EMA 또는 50일선 근처로 되돌림 (일평균 변동폭 1.5배 이내)`, ema21 || sma50 ? (near(ema21) || near(sma50)) : null],
      [`RSI 40~60 (쉬는 구간)${rsi != null ? `, 지금 ${rsi.toFixed(0)}` : ''}`, rsi == null ? null : rsi >= 40 && rsi <= 60],
      ['되돌림 동안 거래량 감소 (5일 평균 < 50일 평균)', quietPullback]
    ], {
      stop: '직전 스윙 저점 아래, 또는 50일선 아래 종가',
      target: '직전 고점(최근 20거래일 고가) 재시험이 첫 기준, 넘으면 추세가 이어지는 동안 보유하는 것이 이 방식의 규칙입니다',
      invalidation: '50일선 아래 종가가 이틀 이어지거나 되돌림 거래량이 오히려 늘어남'
    }),
    pack(STRATEGY_STYLES[2], [
      [`주봉 Weinstein 2단계(상승)${stage ? `, 지금 ${stage}단계` : ''}`, stage == null ? null : stage === 2],
      ['종가가 200일선 위', sma200 ? close > sma200 : null],
      ['200일선이 20거래일 전보다 높음(오름)', sma200 && sma200Then ? sma200 > sma200Then : null],
      [`6개월 수익률이 ${analysis.benchmarkLabel || '지수'}보다 높음`, analysis.rs == null ? null : analysis.rs > 0]
    ], {
      stop: '주봉 종가가 30주선(일봉으로는 200일선 부근) 아래로 내려가면 재점검',
      target: '정해진 목표 없이 2단계가 이어지는 동안 보유하고, 3단계(30주선 평평)로 상승 동력이 약해지면 이익 일부를 확정하는 것이 이 방식의 규칙입니다',
      invalidation: '30주선이 평평해지며 가격이 그 아래·위를 오가는 3단계, 또는 4단계 진입'
    }),
    pack(STRATEGY_STYLES[3], [
      [`RSI ${cold} 이하${rsi != null ? `, 지금 ${rsi.toFixed(0)}` : ''}`, rsi == null ? null : rsi <= cold],
      ['50일선에서 일평균 변동폭 2.5배 넘게 아래', analysis.adrFrom50 == null ? null : analysis.adrFrom50 <= -2.5],
      ['장기 추세는 살아 있음 (종가 > 200일선)', sma200 ? close > sma200 : null],
      ['반전 봉 (오늘 종가가 전일 고가 위)', bars[n - 1] ? close > bars[n - 1].high : null]
    ], {
      stop: '최근 저점(20거래일 저가) 아래 — 실패가 잦은 방식이라 손절 폭을 짧게 둡니다',
      target: '21일 EMA 또는 50일선까지의 되돌림 — 이 방식은 반등을 추세 전환으로 보지 않습니다',
      invalidation: '새 저점 종가, 또는 반등이 21일 EMA 앞에서 거래량 없이 꺾임'
    })
  // v59.45 R4-02: a condition without data is unknown, not unmet — a lens with 0 of 4 checkable read "조건이 맞지 않음".
  ].map((lens) => ({ ...lens, note: lens.known === 0 ? '조건을 확인할 자료가 없음'
    : lens.met === lens.total ? '조건이 모두 맞는 방식'
      : lens.met === 0 ? (lens.known < lens.total ? `확인된 ${lens.known}개 조건 중 맞는 것 없음` : '지금은 이 방식의 조건이 맞지 않음') : null, rsiHot: hot }));
}

/** Reward-to-risk in plain terms: the ratio, and the win rate at which the plan breaks even (before costs). */
export function rewardRiskFacts(rewardRisk) {
  if (!(rewardRisk > 0)) return null;
  const breakeven = 1 / (1 + rewardRisk) * 100;
  return { ratio: rewardRisk, breakevenWinRate: breakeven, text: `손익비 ${rewardRisk.toFixed(1)} : 1이면 10번 중 약 ${(breakeven / 10).toFixed(1)}번 이상(승률 ${breakeven.toFixed(0)}% 이상) 맞아야 비용 전 본전입니다.` };
}

export const RR_GUIDE = Object.freeze([
  '손익비(R:R) = (목표가 − 진입가) ÷ (진입가 − 손절가). 진입가에서 손절가까지를 1R(내가 감수하는 한 번의 손실)로 둡니다.',
  '본전 승률 = 1 ÷ (1 + 손익비). 1:1이면 50%, 2:1이면 33%, 3:1이면 25% 이상 맞아야 본전입니다 — 손익비가 클수록 덜 맞아도 됩니다.',
  '순서가 중요합니다: 손절가는 차트 구조(저점·이동평균·변동폭)로 먼저 정하고, 목표가는 다음 저항·측정 이동폭으로 정한 뒤 비율을 확인합니다. 원하는 비율에 맞추려고 손절을 좁히면 정상적인 흔들림에 걸립니다.',
  '한 번에 감수할 금액 = 전체 자본 × 감수 비율(흔히 0.5~2%). 수량 = 그 금액 ÷ (진입가 − 손절가). 아래 투입 금액·전체 자본 칸이 이 계산을 보여 줍니다.'
]);
