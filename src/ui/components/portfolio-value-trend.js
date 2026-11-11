// v59.70 (S16): 포트폴리오 ① 지금 구성과 S&P 500 — the shared trend chart over the last year, drawn on entry from the
// screener's published closes (src/domain/portfolio/benchmark-trend.js) and the close history's session dates. It
// replaces js/aio-ui.js updateBenchmarkChart, which asked Yahoo for every holding and drew only after 새로고침.
import { BENCHMARK_WINDOWS, buildBenchmarkTrend } from '../../domain/portfolio/benchmark-trend.js';
import { fxReturnInto } from '../../domain/portfolio/attribution.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { buildCloseSeries, sessionPointBack } from '../../domain/market/session/close-series.js';
import { closeChange } from '../../domain/market/session/market-windows.js';
import { signedText } from '../../domain/shared/number.js';
import { createTrendChart } from './trend-chart.js';
import { renderDataState } from './data-state.js';
import { artifactFreshnessBadge, freshnessBadge } from './freshness-badge.js';
import { el } from './dom.js';

const signed = (value, unit = '%') => signedText(value, 1, unit);

/** The model for the section from the page's surface and the symbol → screener row map. */
export function portfolioValueTrend({ surface, rowOf, history = [] } = {}) {
  if (surface?.currencyState === 'mixed-without-conversion') return { available: false, reason: surface.baseChoiceConverts ? 'currency-base' : 'currency' };
  const spy = rowOf('SPY');
  const asOf = spy?.factorSessionDate || null;
  const spx = asOf ? buildCloseSeries(history, 'spx', { through: asOf }) : [];
  const dateOf = (sessions) => (spx.length ? sessionPointBack(spx, sessions, 'US')?.date || null : null);
  const rows = (surface?.rows || []).map((row) => ({ symbol: String(row.listingSymbol || row.symbol || '').toUpperCase(), value: row.value, convertedFrom: row.convertedFrom || null }));
  // A holding converted into the base currency carries the USD/KRW close move over the same window as its return.
  const convertedFrom = new Map(rows.filter((row) => row.convertedFrom).map((row) => [row.symbol, row.convertedFrom]));
  const sessionsOf = new Map(BENCHMARK_WINDOWS.map((span) => [span.key, span.sessions]));
  const fxMoves = new Map();
  const usdkrwPct = (key) => {
    if (!fxMoves.has(key)) fxMoves.set(key, asOf ? closeChange(history, 'usdkrw', sessionsOf.get(key), { through: asOf })?.pct ?? null : null);
    return fxMoves.get(key);
  };
  const fxReturnOf = (symbol, key) => {
    const from = convertedFrom.get(symbol);
    if (!from) return 0;
    const fx = fxReturnInto(from, surface?.baseCurrency, usdkrwPct(key));
    return fx == null ? null : fx * 100;
  };
  const model = buildBenchmarkTrend({
    holdings: rows,
    returnOf: (symbol, key) => readRowNumber(rowOf(symbol), key, 'calculation'),
    indexReturnOf: (key) => readRowNumber(spy, key, 'calculation'),
    dateOf: spx.length ? dateOf : null,
    asOf: spx.length ? asOf : null,
    fxReturnOf
  });
  if (!model.available) return model;
  return { ...model, fxIncluded: [...convertedFrom.keys()].some((symbol) => !model.missing.includes(symbol)) };
}

const HOLD_TEXT = Object.freeze({
  currency: '통화가 다른 종목이 섞여 있고 환율이 없어 한 통화로 합치지 못했습니다. 설정에서 기준 통화와 환율을 넣으면 그립니다.',
  'currency-base': '원화와 달러 종목이 섞여 있어 아직 한 통화로 합치지 않았습니다. 설정에서 기준 통화를 고르면 원/달러 종가로 환산해 그립니다.',
  coverage: '보유 평가액의 80% 이상이 1일 이상의 가격 기록을 갖추지 못해 비교를 보류합니다.'
});

export function renderPortfolioValueTrend({ documentRef: doc, root, surface, rowOf }) {
  const host = doc?.getElementById('pf-value-trend');
  if (!host) return null;
  host.dataset.aioPortfolioChartRenderer = 'native';
  const body = host.querySelector('[data-pf-trend-body]');
  const badgeSlot = host.querySelector('[data-pf-trend-badge]');
  if (!body) return null;
  const model = portfolioValueTrend({ surface, rowOf, history: root?._aioHistory || [] });
  if (badgeSlot) badgeSlot.replaceChildren();
  if (!model.available) {
    if (model.reason === 'empty') { host.hidden = true; return model; }
    host.hidden = false;
    if (model.reason === 'loading') renderDataState(body, { state: 'loading', lines: 4, timeoutText: '종가 기록을 받지 못해 비교를 그리지 못했습니다.' });
    else renderDataState(body, { state: 'empty', text: HOLD_TEXT[model.reason] || HOLD_TEXT.coverage });
    return model;
  }
  host.hidden = false;
  body.removeAttribute('aria-busy');
  const badge = artifactFreshnessBadge(doc, 'screener.json') || freshnessBadge(doc, { state: 'unknown', basisSession: { US: model.asOf } });
  if (badge && badgeSlot) badgeSlot.append(badge);
  // Each figure stays with its label when the line wraps on a phone.
  const lead = el(doc, 'p', null, 'pf-trend-lead');
  const gap = el(doc, 'b', signed(model.gapPp, '%p'), Number(model.gapPp.toFixed(1)) > 0 ? 'is-up' : Number(model.gapPp.toFixed(1)) < 0 ? 'is-down' : '');
  const gapPart = el(doc, 'span', '차이 ', 'pf-trend-part');
  gapPart.append(gap);
  lead.append(el(doc, 'span', `${model.window}, 지금 구성 ${signed(model.bookPct)}`, 'pf-trend-part'), ' · ', el(doc, 'span', `S&P 500 ${signed(model.indexPct)}`, 'pf-trend-part'), ' · ', gapPart);
  const chart = createTrendChart(doc, {
    series: model.points.map((point) => ({ date: point.date, value: point.bookPct })),
    guide: { label: 'S&P 500', series: model.points.map((point) => ({ date: point.date, value: point.indexPct })) },
    refLines: [0], label: `지금 구성과 S&P 500, 최근 ${model.window} 수익률`, width: body.clientWidth || undefined,
    format: (value) => signed(value)
  });
  const parts = [lead, chart];
  const notes = [`${model.points.slice(0, -1).map((point) => point.label).join('·')} 전 수정 종가(배당 포함)를 이은 선, 지금 비중을 그대로 들고 있었다고 본 값이라 계좌 수익률과 다릅니다.${model.fxIncluded ? ' 기준 통화와 다른 종목은 원/달러 종가 변화를 더한 환율 포함 수익률입니다.' : ''}`];
  if (model.missing.length) notes.unshift(`가격 기록이 ${model.window}에 못 미치는 ${model.missing.slice(0, 3).join(', ')}${model.missing.length > 3 ? ` 외 ${model.missing.length - 3}종목` : ''} 제외(평가액의 ${Math.max(1, Math.round((1 - model.coveredShare) * 100))}%).`);
  parts.push(el(doc, 'p', notes.join(' '), 'pf-trend-note'));
  body.replaceChildren(...parts);
  // The chart is drawn at the body's width (labels keep their size); a width change of more than 40px draws it again.
  body.__pfTrendArgs = { documentRef: doc, root, surface, rowOf };
  body.__pfTrendWidth = body.clientWidth;
  const View = doc.defaultView?.ResizeObserver;
  if (View && !body.__pfTrendObserver) {
    body.__pfTrendObserver = new View(() => {
      if (Math.abs(body.clientWidth - (body.__pfTrendWidth || 0)) > 40 && body.__pfTrendArgs) renderPortfolioValueTrend(body.__pfTrendArgs);
    });
    body.__pfTrendObserver.observe(body);
  }
  return model;
}
