// ADR-0003 S4: the 차트 screen's reading as a view model — the four reading cards under the chart (trend, distance from
// the 50-day line, RSI 14, 60-session VWAP), the two moving-average structure rows, and the whole fact sheet the AI's
// technical block quotes. The screen renders these; the chat repeats them. Neither re-derives a verdict, so the chart and
// the AI cannot call the same bars by two names. Every value comes from the completed daily bars the chart draws.
import { RULES } from '../rules/thresholds.js';
import { rsiWilder } from './definitions.js';
import { trendRead } from './chart-strategies.js';
import { trendOfBars } from './trend-state.js';
import { chartReading } from './chart-analysis.js';
import { layerFacts, LAYER_IDS } from './chart-layers.js';
import { formatScreenerPrice } from '../screener/market-scope.js';
import { signedText } from '../shared/number.js';

const signedPct = (value) => signedText(value, 1, '%');

/** Volume-weighted average of the daily typical price over the last `sessions` bars, or null when the window is short. */
export function sessionVwap(bars, sessions = 60) {
  const recent = (bars || []).slice(-sessions);
  let weighted = 0, volume = 0;
  for (const bar of recent) { const v = Number(bar.volume) || 0; if (v > 0) { weighted += (bar.high + bar.low + bar.close) / 3 * v; volume += v; } }
  return recent.length >= sessions && volume > 0 ? weighted / volume : null;
}

/** RSI 14 on the chart's closes with its band word (RULES.technical.rsi). */
export function bandedRsi(value) {
  if (value == null || !Number.isFinite(value)) return null;
  const { overbought: hot, oversold: cold } = RULES.technical.rsi;
  const band = value >= hot ? 'overbought' : value <= cold ? 'oversold' : 'neutral';
  return {
    value, band, word: { overbought: '과열', oversold: '과매도', neutral: '중립' }[band],
    detail: band === 'overbought' ? `과열 기준(${hot}) 이상 — 강한 추세에서는 오래 머물기도 합니다` : band === 'oversold' ? `과매도 기준(${cold}) 이하 — 약한 추세에서는 이어지기도 합니다` : `과열 ${hot}, 과매도 ${cold} 사이`
  };
}

/**
 * The reading cards under the daily chart: [{ id, name, value, detail, ref, title? }].
 * Direction first. The word is the canonical trend the chip, the 종목 page and the screener say
 * (trend-state.js); the swing structure and the 50-day slope (trendRead) are its evidence, not a second verdict.
 */
export function chartReadCards(analysis, { currency = null } = {}) {
  if (!analysis?.available) return [];
  const close = analysis.last?.close;
  const sma50 = analysis.lines?.sma50?.at(-1);
  const cards = [];
  const trend = trendRead(analysis);
  const canonical = trendOfBars(analysis.bars);
  if (canonical || trend?.direction) {
    cards.push({ id: 'trend', name: '추세', value: canonical?.label || '판단 보류',
      detail: trend?.turn || (trend?.facts || []).filter((fact) => !fact.startsWith('이동평균')).join(', '),
      ref: '50·200일선 위치(종목·스크리너와 같은 판정), 고점·저점 구조(Dow)',
      title: [canonical?.text, ...(trend?.facts || []), trend?.turn].filter(Boolean).join(' · ') });
  }
  if (close > 0 && sma50 > 0) {
    const pct = (close / sma50 - 1) * 100;
    const multiple = Number.isFinite(analysis.adrFrom50) ? Math.abs(analysis.adrFrom50) : null;
    cards.push({ id: 'sma50', name: '50일선 대비', value: signedPct(pct),
      detail: multiple == null ? `50일선 ${formatScreenerPrice(sma50, currency)}` : `일평균 변동폭(${analysis.adrPct.toFixed(1)}%)의 ${multiple.toFixed(1)}배 ${pct >= 0 ? '위 — 멀수록 50일선 쪽으로 되돌릴 때 낙폭이 큽니다' : '아래 — 멀수록 50일선을 되찾는 데 필요한 상승 폭이 큽니다'}`,
      ref: '이동평균 규칙, Brock·Lakonishok·LeBaron(1992)' });
  }
  const rsi = bandedRsi(rsiWilder(analysis.bars.map((bar) => bar.close)));
  if (rsi) cards.push({ id: 'rsi', name: 'RSI 14일', value: rsi.value.toFixed(1), detail: rsi.detail, ref: 'Wilder(1978) RSI' });
  const vwap = sessionVwap(analysis.bars, 60);
  if (vwap != null && close > 0) {
    cards.push({ id: 'vwap', name: '거래량 가중 평균가 (60일)', value: formatScreenerPrice(vwap, currency),
      detail: `종가가 ${Math.abs((close / vwap - 1) * 100).toFixed(1)}% ${close >= vwap ? '위' : '아래'} — 최근 60거래일 거래가 많이 일어난 가격의 평균`,
      ref: 'VWAP, 일봉 전형가격 × 거래량 근사' });
  }
  return cards;
}

/** Short 5 > 10 > 20, mid/long 20 > 50 > 200 — the alignment the chart's layer line states. */
export function chartStructureRows(alignment) {
  const align = alignment || {};
  return [
    ['단기 이평 배열 (5·10·20일)', align.shortLabel ? `${align.shortLabel}${align.closeAbove5 == null ? '' : `, 종가 5일선 ${align.closeAbove5 ? '위' : '아래'}`}` : '계산 불가'],
    ['중장기 이평 배열 (20·50·200일)', align.longLabel ? `${align.longLabel}${align.full && align.full === align.long && align.long !== 'mixed' ? ' (100일선 포함)' : ''}` : '기록 부족']
  ];
}

const ALL_LAYERS = Object.freeze(Object.fromEntries(LAYER_IDS.map((id) => [id, true])));

/**
 * Everything the daily chart states about one symbol, for a reader that is not the chart (the AI's technical block):
 * the reading (state, grounds, flip), the structure rows, the evidence list, the cards and every layer chip with its
 * detail. `layers` is buildChartLayers(analysis.bars), the chart's own layer computation.
 */
export function chartFactSheet({ analysis, layers, currency = null, regime = null } = {}) {
  if (!analysis?.available) return { available: false, reason: analysis?.reason || 'no-analysis' };
  const price = (value) => formatScreenerPrice(value, currency);
  return {
    available: true,
    asOf: analysis.asOf,
    bars: analysis.bars.length,
    state: analysis.state,
    stateLabel: analysis.stateLabel,
    reading: chartReading(analysis, regime),
    structure: layers?.available ? chartStructureRows(layers.alignment) : [],
    evidence: analysis.evidence || [],
    cards: chartReadCards(analysis, { currency }),
    chips: layers?.available ? layerFacts(layers, ALL_LAYERS, layers.bars, price) : []
  };
}
