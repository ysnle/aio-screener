// ADR-0003 S4 (C's open item): the chat's technical block quotes the 차트 screen's own reading. It used to download a
// second OHLCV series (fetchOHLCVWithFallback, 260 bars) and recompute RSI, MACD, the moving-average stack, a "Stage",
// VCP, Fibonacci, a volume profile, divergences and an extension heat through the legacy technical snapshot, each
// with its own labels (e.g. '50일선 이탈(추세 훼손)', '상단 재진입(소진주의)'), so the AI could name the bars the chart
// draws differently from the chart. Now: the same completed daily bars (src/data/daily-chart-bars.js), the same
// analysis (analyzeChart, buildChartLayers) and the same words (chart-read.js chartFactSheet). This module only
// formats; it judges nothing.
import { analyzeChart, benchmarkFieldFor } from '../../domain/technical/chart-analysis.js';
import { buildCloseSeries } from '../../domain/briefing/market-read.js';
import { buildChartLayers, BASE_MA } from '../../domain/technical/chart-layers.js';
import { chartFactSheet, bandedRsi } from '../../domain/technical/chart-read.js';
import { rsiWilder } from '../../domain/technical/definitions.js';
import { formatScreenerPrice } from '../../domain/screener/market-scope.js';
import { signedText, readNumber } from '../../domain/shared/number.js';
import { isIsoDay } from '../../domain/shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { loadCompletedDailyBars } from '../../data/daily-chart-bars.js';
import { screenRowFor } from './stock-trend-line.js';

const MAX_SYMBOLS = 3;
const LOAD_TIMEOUT_MS = 6000;
const isKrSymbol = (symbol) => /\.(KS|KQ)$/i.test(symbol) || symbol === '^KS11' || symbol === '^KQ11';
const isAbort = (error) => error && (error.name === 'AbortError' || error.code === 'ABORTED');

export const TECHNICAL_BLOCK_HELD = '기술 데이터 수신 대기';

function heldBlock(symbol) {
  return `━━ [${symbol} 기술적 데이터] ━━\n차트 화면과 같은 일봉을 받지 못해 기술 지표를 계산하지 않았다. 추측 금지, "${TECHNICAL_BLOCK_HELD}"로 답하라.`;
}

/**
 * RSI as one number: the screener row's value when it carries a session (the number the 종목 page and the [주가 추이] line
 * show), else the chart's own RSI on the same bars.
 */
function statedRsi(symbol, bars, row) {
  const rowRsi = row ? readRowNumber(row, 'rsi', 'display') : null;
  const rowSession = row && isIsoDay(String(row.factorSessionDate || '').slice(0, 10)) ? String(row.factorSessionDate).slice(0, 10) : null;
  const reading = bandedRsi(rowRsi != null && rowSession ? rowRsi : rsiWilder(bars.map((bar) => bar.close)));
  if (!reading) return null;
  const basis = rowRsi != null && rowSession ? `${rowSession} 종가, 스크리너 값` : `${bars.at(-1).time} 종가, 차트 일봉`;
  return `RSI(14) ${reading.value.toFixed(1)} (${basis}) ${reading.word}`;
}

/** The day change: a KRX listing only against the verified previous KRX close, otherwise the chart's last two bars. */
function dayChangeText({ symbol, analysis, krDayChange }) {
  if (isKrSymbol(symbol)) {
    const kr = typeof krDayChange === 'function' ? krDayChange(symbol, analysis.asOf, analysis.last.close) : null;
    if (!kr) return '전일 대비 미확인 — 직전 거래소 종가를 검증하지 못함, 등락률을 만들지 말 것';
    return `${signedText(kr.pct, 2)}%, ${kr.basis === 'screener-reconciled-session-change' ? `${analysis.asOf} 거래소 종가 기준 1일 변화` : `거래소 종가 기준 직전 ${kr.basisDate} 대비`}`;
  }
  return analysis.prev ? `${signedText((analysis.last.close / analysis.prev.close - 1) * 100, 2)}%` : '전일 대비 미확인';
}

/**
 * One symbol's block from its completed daily bars.
 * @param {{ symbol: string, bars: object[], droppedLive?: boolean, payload?: object|null, row?: object|null,
 *   krDayChange?: Function|null }} input
 */
export function technicalBlock({ symbol, bars, droppedLive = false, payload = null, row = null, krDayChange = null, history = [] }) {
  // The chart's comparison index (S&P 500, KOSPI or KOSDAQ closes from the app's history), so relative strength matches.
  const field = benchmarkFieldFor(symbol);
  const analysis = analyzeChart(bars || [], { benchmark: field ? buildCloseSeries(history || [], field) : [], benchmarkLabel: field === 'kosdaq' ? 'KOSDAQ' : field === 'kospi' ? 'KOSPI' : 'S&P 500' });
  if (!analysis.available) return heldBlock(symbol);
  const currency = isKrSymbol(symbol) ? 'KRW' : payload?.meta?.currency || null;
  const price = (value) => formatScreenerPrice(value, currency);
  const layers = buildChartLayers(analysis.bars);
  const sheet = chartFactSheet({ analysis, layers, currency });
  const lines = [`━━ [${symbol} 기술적 데이터, 일봉 ${sheet.bars}봉, 차트 화면과 같은 완료 봉 기준${droppedLive ? ', 진행 중인 오늘 봉 제외' : ''}] ━━`];
  const rsi = statedRsi(symbol, analysis.bars, row);
  lines.push(`• 종가 ${price(analysis.last.close)} (${analysis.asOf}, ${dayChangeText({ symbol, analysis, krDayChange })})${rsi ? `, ${rsi}` : ''}`);
  if (sheet.reading) {
    lines.push(`• 차트 읽기(${sheet.stateLabel}): ${sheet.reading.headline}`);
    if (sheet.reading.why) lines.push(`• 근거: ${sheet.reading.why}`);
    if (sheet.reading.flip) lines.push(`• 전환 조건: ${sheet.reading.flip}`);
  }
  const ma = layers.available ? BASE_MA.map((period) => [period, readNumber(layers.ma[period]?.at(-1))]).filter(([, value]) => value != null) : [];
  if (ma.length) lines.push(`• 이동평균: ${ma.map(([period, value]) => `${period}일 ${price(value)}`).join(', ')} — ${sheet.structure.map(([label, value]) => `${label} ${value}`).join(', ')}`);
  // The RSI card and chip are left out (RSI is stated once above, as the number the screen pages show), and so are the two
  // moving-average chips the structure rows already state.
  const cards = sheet.cards.filter((card) => card.id !== 'rsi');
  if (cards.length) lines.push(`• 차트 카드: ${cards.map((card) => `${card.name} ${card.value}${card.detail ? ` (${card.detail})` : ''}`).join('; ')}`);
  const chips = sheet.chips.filter((chip) => !['rsi', 'ma-short', 'ma-long'].includes(chip.id));
  if (chips.length) lines.push(`• 차트 표시: ${chips.map((chip) => `${chip.text}${chip.title ? ` (${chip.title})` : ''}`).join('; ')}`);
  const evidence = sheet.evidence.filter(([, value]) => value && value !== '—');
  if (evidence.length) lines.push(`• 근거 목록: ${evidence.map(([label, value]) => `${label} ${value}`).join('; ')}`);
  if (payload) lines.push(`• 데이터: ${payload.transport || payload.sourceKind || '시세 제공처'}${payload.allowedUse ? `, ${payload.allowedUse}` : ''}`);
  lines.push('※ 위는 차트 화면이 같은 일봉으로 보여 주는 값과 문구다. 지지·저항·추세 무효화 조건을 설명하되, 매매 지시·손절가·목표가로 전환하지 말고 학습데이터 추측을 금지한다.');
  return lines.join('\n');
}

function withTimeout(promise, ms) {
  let timer = null;
  return Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(null), ms); })]).finally(() => clearTimeout(timer));
}

/**
 * The chat's technical block for up to three symbols ('' when none). An abort from the chat's signal propagates; any
 * other load failure becomes that symbol's held block.
 */
export async function chatTechnicalBlock(symbols, { root = globalThis, signal = null, autoMarket = false } = {}) {
  const list = (Array.isArray(symbols) ? symbols : []).map((symbol) => String(symbol || '').toUpperCase()).filter(Boolean).slice(0, MAX_SYMBOLS);
  if (!list.length) return '';
  const loaded = await Promise.all(list.map((symbol) => withTimeout(loadCompletedDailyBars(root, symbol, { signal }).catch((error) => {
    if (isAbort(error)) throw error;
    return null;
  }), LOAD_TIMEOUT_MS)));
  const krDayChange = typeof root?._aioKrVerifiedDayChange === 'function' ? root._aioKrVerifiedDayChange.bind(root) : null;
  const blocks = list.map((symbol, index) => {
    const data = loaded[index];
    if (!data?.bars?.length) return heldBlock(symbol);
    try {
      return technicalBlock({ symbol, ...data, row: screenRowFor(root, symbol)?.row || null, krDayChange, history: root?._aioHistory || [] });
    } catch (_) { return heldBlock(symbol); }
  });
  return `\n\n【${autoMarket ? '시장 대표 차트' : '종목'} 기술적 실측 데이터 (차트 화면 일봉 판정)】\n${blocks.join('\n\n')}\n`;
}
