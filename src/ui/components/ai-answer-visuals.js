// P1741: visuals under an AI answer, drawn by the app from the same data the screens use — completed daily bars
// (chart-analysis), issuer filings (fiscal history) — never from numbers the model wrote. The unified AI panel is the
// only AI entry point (owner 2026-10-12) and had no visual at all; the sparkline/diagram code lived on the retired
// per-page chat path. Each figure states its basis date; a figure whose data is missing is not drawn.
import { analyzeChart } from '../../domain/technical/chart-analysis.js';
import { barsFromYahoo, completedBars } from './stock-chart.js';
import { requestFiscalHistory, parseFiscalHistory } from './fiscal-read.js';
import { crossroadsForRoot } from './macro-crossroads.js';
import { themePlaybookForRoot } from './theme-playbook.js';
import { readMarketRegime } from './market-regime.js';
import { CHOICES } from '../../domain/market/macro-crossroads.js';
import { THEME_STATES } from '../../domain/scenarios/analogs.js';
import { WIND_LABELS } from '../../domain/scenarios/exposures.js';

const CHART_WORDS = /차트|추세|이평|이동\s*평균|지지|저항|돌파|이탈|기술적|셋업|패턴|모멘텀|rsi|macd|chart|trend|support|resistance|breakout/i;
const FUNDAMENTAL_WORDS = /실적|매출|이익|마진|이익률|재무|펀더멘탈|현금\s*흐름|fcf|성장률|분기|어닝|가이던스|밸류에이션|per\b|earnings|revenue|margin|fundamental|quarter/i;
const COMPARE_WORDS = /비교|대비|vs\.?|versus|어느\s*쪽|차이/i;
const THEME_WORDS = /섹터|테마|업종|로테이션|순환|주도|병목|반도체|소프트웨어|광통신|포토닉스|메모리|전력|조선|방산|원전|바이오|2차전지/i;

const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));
const signed = (value, digits = 1) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
const price = (value, kr) => (kr ? Math.round(value).toLocaleString('en-US') : value >= 1000 ? value.toFixed(0) : value.toFixed(2));

// Which figures fit this question. At most two, so a figure supports the answer instead of replacing it.
export function chooseAnswerVisuals({ query = '', mode = 'analysis', canonical = [], tickers = [] } = {}) {
  const companies = (Array.isArray(tickers) ? tickers : []).filter((symbol) => symbol && !/^\^|=X$|=F$|-USD$/.test(symbol)).slice(0, 3);
  // P1743: a market-level outlook question gets the branch table, and the theme stages when it is about themes/sectors.
  if (!companies.length && mode === 'outlook') return [{ kind: 'crossroads', symbols: [] }, ...(THEME_WORDS.test(query) ? [{ kind: 'themes', symbols: [] }] : [])];
  if (!companies.length && THEME_WORDS.test(query) && mode !== 'quick') return [{ kind: 'themes', symbols: [] }];
  if (!companies.length || mode === 'quick' && !CHART_WORDS.test(query) && !FUNDAMENTAL_WORDS.test(query)) return [];
  const picks = [];
  if (companies.length >= 2 && (mode === 'comparison' || COMPARE_WORDS.test(query))) picks.push({ kind: 'relative', symbols: companies });
  const lead = companies[0];
  const wantsChart = CHART_WORDS.test(query) || canonical.includes('TECHNICAL_ANALYSIS');
  const wantsFundamentals = FUNDAMENTAL_WORDS.test(query);
  if (wantsFundamentals && !isKr(lead)) picks.push({ kind: 'fundamentals', symbols: [lead] });
  if (wantsChart || (!picks.length && (mode === 'decision' || mode === 'analysis'))) picks.push({ kind: 'price', symbols: [lead] });
  return picks.slice(0, 2);
}

function frame(doc, title, caption) {
  const figure = doc.createElement('figure');
  figure.className = 'aio-answer-visual';
  figure.style.cssText = 'margin:10px 0 4px;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-1);max-width:600px;';
  const head = doc.createElement('div');
  head.textContent = title;
  head.style.cssText = 'font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:6px;';
  const body = doc.createElement('div');
  const note = doc.createElement('figcaption');
  note.textContent = caption;
  note.style.cssText = 'font-size:12px;line-height:1.5;color:var(--text-muted);margin-top:6px;';
  figure.append(head, body, note);
  return { figure, body };
}

function polyline(values, x, y) {
  let path = '';
  values.forEach((value, index) => {
    if (value == null) return;
    path += `${path && values[index - 1] != null ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)} `;
  });
  return path.trim();
}

function axisLabels(min, max, y, width, fmt) {
  return [max, (max + min) / 2, min].map((value) => `<line x1="60" x2="${width - 6}" y1="${y(value).toFixed(1)}" y2="${y(value).toFixed(1)}" stroke="var(--chart-grid)"/><text x="56" y="${(y(value) + 4).toFixed(1)}" text-anchor="end" font-size="13" fill="var(--text-muted)">${esc(fmt(value))}</text>`).join('');
}

async function loadBars(root, symbol, range) {
  const payload = await Promise.resolve(root?._aioFetchYahooChartData?.(symbol, range, '1d')).catch(() => null);
  return completedBars(barsFromYahoo(payload), payload).bars;
}

// Close, 50-day and 200-day lines over the last ~6 months, with the 52-week high and the chart state.
export async function buildPriceVisual({ documentRef: doc, root, symbol }) {
  const bars = await loadBars(root, symbol, '2y');
  const analysis = analyzeChart(bars);
  if (!analysis.available) return null;
  const span = Math.min(126, analysis.bars.length);
  const start = analysis.bars.length - span;
  const closes = analysis.bars.slice(start).map((bar) => bar.close);
  const ma50 = analysis.lines.sma50.slice(start);
  const ma200 = analysis.lines.sma200.slice(start);
  const all = [...closes, ...ma50, ...ma200].filter((value) => finite(value) != null);
  const min = Math.min(...all), max = Math.max(...all);
  const W = 400, H = 190, top = 10, bottom = 26;
  const x = (i) => 62 + (i / (span - 1)) * (W - 68);
  const y = (v) => top + (1 - (v - min) / ((max - min) || 1)) * (H - top - bottom);
  const kr = isKr(symbol);
  const ma50Last = finite(ma50[ma50.length - 1]), ma200Last = finite(ma200[ma200.length - 1]);
  const last = analysis.last.close;
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(symbol)} 최근 ${span}거래일 종가와 이동평균" style="display:block;max-width:100%;height:auto;">` +
    axisLabels(min, max, y, W, (v) => price(v, kr)) +
    `<path d="${polyline(ma200, x, y)}" fill="none" stroke="var(--chart-3)" stroke-width="1.4" stroke-dasharray="2 3"/>` +
    `<path d="${polyline(ma50, x, y)}" fill="none" stroke="var(--chart-5)" stroke-width="1.4" stroke-dasharray="6 3"/>` +
    `<path d="${polyline(closes, x, y)}" fill="none" stroke="var(--chart-1)" stroke-width="1.8"/>` +
    `<circle cx="${x(span - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="var(--chart-1)"/>` +
    `<text x="62" y="${H - 6}" font-size="13" fill="var(--text-muted)">${esc(analysis.bars[start].time)}</text>` +
    `<text x="${W - 6}" y="${H - 6}" text-anchor="end" font-size="13" fill="var(--text-muted)">${esc(analysis.asOf)}</text>` +
    `</svg>`;
  const legend = `<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary);margin-top:4px;"><span><svg width="18" height="6" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><line x1="0" x2="18" y1="3" y2="3" stroke="var(--chart-1)" stroke-width="2"/></svg>종가</span><span><svg width="18" height="6" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><line x1="0" x2="18" y1="3" y2="3" stroke="var(--chart-5)" stroke-width="2" stroke-dasharray=\"6 3\"/></svg>50일선</span><span><svg width="18" height="6" aria-hidden="true" style="vertical-align:middle;margin-right:4px;"><line x1="0" x2="18" y1="3" y2="3" stroke="var(--chart-3)" stroke-width="2" stroke-dasharray=\"2 3\"/></svg>200일선</span></div>`;
  const facts = [
    `${analysis.asOf} 종가 ${price(last, kr)}`,
    ma50Last ? `50일선 대비 ${signed((last / ma50Last - 1) * 100)}` : null,
    ma200Last ? `200일선 대비 ${signed((last / ma200Last - 1) * 100)}` : null,
    `${analysis.rangeLabel} 고점 대비 ${signed(analysis.fromHigh)}`,
    `차트 상태: ${analysis.stateLabel}`
  ].filter(Boolean).join(' · ');
  const { figure, body } = frame(doc, `${symbol} 최근 ${span}거래일 가격 흐름`, `${facts}. 완료된 일봉 기준이며 장중 봉은 제외했습니다.${analysis.flip ? ` 상태가 바뀌는 조건: ${analysis.flip}.` : ''}`);
  body.innerHTML = svg + legend;
  return figure;
}

// Quarterly revenue bars with the net margin of each quarter (8 quarters), or annual bars when quarters are missing.
export async function buildFundamentalsVisual({ documentRef: doc, root, symbol }) {
  if (!root._aioSecFiscalHistory) await new Promise((resolve) => { requestFiscalHistory(root, resolve); setTimeout(resolve, 6000); });
  const quarterText = root._aioSecQuarterHistory?.[symbol];
  let rows = [];
  let unit = '분기';
  if (typeof quarterText === 'string') {
    rows = quarterText.split(';').map((part) => part.split(':')).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] || ''))
      .map(([periodEnd, revenue, netIncome]) => ({ periodEnd, revenue: finite(Number(revenue)), netIncome: finite(Number(netIncome)) }));
  }
  if (rows.filter((row) => row.revenue != null).length < 4) {
    const annual = root._aioSecFiscalHistory?.[symbol];
    rows = (typeof annual === 'string' ? parseFiscalHistory(annual) : []).map((row) => ({ periodEnd: row.periodEnd, revenue: row.revenue != null ? row.revenue / 1e6 : null, netIncome: row.netIncome != null ? row.netIncome / 1e6 : null }));
    unit = '회계연도';
  }
  rows = rows.filter((row) => row.revenue != null && row.revenue > 0).slice(-8);
  if (rows.length < 3) return null;
  const W = 400, H = 236, top = 20, bottom = 54;
  const maxRev = Math.max(...rows.map((row) => row.revenue));
  const slot = (W - 66) / rows.length;
  const barW = Math.min(36, slot * 0.55);
  const y = (v) => top + (1 - v / maxRev) * (H - top - bottom);
  const money = (millions) => (millions >= 1000 ? `${(millions / 1000).toFixed(millions >= 100000 ? 0 : 1)}B` : `${Math.round(millions)}M`);
  let bars = '';
  rows.forEach((row, i) => {
    const cx = 60 + slot * i + slot / 2;
    const margin = row.netIncome != null ? row.netIncome / row.revenue * 100 : null;
    bars += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y(row.revenue).toFixed(1)}" width="${barW.toFixed(1)}" height="${(H - bottom - y(row.revenue)).toFixed(1)}" fill="var(--chart-2)" rx="2"/>`;
    bars += `<text x="${cx.toFixed(1)}" y="${(y(row.revenue) - 4).toFixed(1)}" text-anchor="middle" font-size="13" fill="var(--text-secondary)">${esc(money(row.revenue))}</text>`;
    bars += `<text x="${cx.toFixed(1)}" y="${(H - bottom + 17).toFixed(1)}" text-anchor="middle" font-size="13" fill="var(--text-muted)">${esc(row.periodEnd.slice(2, 7).replace('-', '.'))}</text>`;
    if (margin != null) bars += `<text x="${cx.toFixed(1)}" y="${(H - bottom + 36).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${margin >= 0 ? 'var(--chart-4)' : 'var(--chart-8)'}">${esc(margin.toFixed(0))}%</text>`;
  });
  const first = rows[0], last = rows[rows.length - 1];
  const growth = (last.revenue / first.revenue - 1) * 100;
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(symbol)} ${unit}별 매출과 순이익률" style="display:block;max-width:100%;height:auto;"><line x1="60" x2="${W - 6}" y1="${H - bottom}" y2="${H - bottom}" stroke="var(--chart-axis)"/>${bars}</svg>`;
  const { figure, body } = frame(doc, `${symbol} ${unit}별 매출과 순이익률`,
    `막대는 매출(미국 달러), 기간 아래 숫자는 그 기간의 순이익률입니다. ${first.periodEnd} → ${last.periodEnd} 매출 ${signed(growth, 0)}. 공시 기준이며 마지막 기간 종료일은 ${last.periodEnd}입니다.`);
  body.innerHTML = svg;
  return figure;
}

// Up to three companies rebased to 100 over the last ~3 months of completed sessions.
export async function buildRelativeVisual({ documentRef: doc, root, symbols }) {
  const series = (await Promise.all(symbols.slice(0, 3).map(async (symbol) => ({ symbol, bars: (await loadBars(root, symbol, '6mo')).slice(-63) }))))
    .filter((item) => item.bars.length >= 20);
  if (series.length < 2) return null;
  const span = Math.min(...series.map((item) => item.bars.length));
  const lines = series.map((item) => { const bars = item.bars.slice(-span); return { ...item, values: bars.map((bar) => bar.close / bars[0].close * 100), from: bars[0].time, to: bars[bars.length - 1].time }; });
  const all = lines.flatMap((line) => line.values);
  const min = Math.min(...all, 100), max = Math.max(...all, 100);
  const W = 400, H = 190, top = 10, bottom = 26;
  const x = (i) => 62 + (i / (span - 1)) * (W - 68);
  const y = (v) => top + (1 - (v - min) / ((max - min) || 1)) * (H - top - bottom);
  const colors = ['var(--chart-1)', 'var(--chart-4)', 'var(--chart-8)'];
  const svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(lines.map((line) => line.symbol).join(', '))} 상대 수익률" style="display:block;max-width:100%;height:auto;">` +
    axisLabels(min, max, y, W, (v) => v.toFixed(0)) +
    lines.map((line, i) => `<path d="${polyline(line.values, x, y)}" fill="none" stroke="${colors[i]}" stroke-width="1.8"${i === 2 ? ' stroke-dasharray="5 3"' : ''}/>`).join('') +
    `<text x="62" y="${H - 6}" font-size="13" fill="var(--text-muted)">${esc(lines[0].from)}</text><text x="${W - 6}" y="${H - 6}" text-anchor="end" font-size="13" fill="var(--text-muted)">${esc(lines[0].to)}</text></svg>`;
  const legend = `<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--text-secondary);margin-top:4px;">${lines.map((line, i) => `<span><span style="display:inline-block;width:14px;height:2px;vertical-align:middle;background:${colors[i]};margin-right:4px;"></span>${esc(line.symbol)} ${esc(signed(line.values[line.values.length - 1] - 100))}</span>`).join('')}</div>`;
  const { figure, body } = frame(doc, `최근 ${span}거래일 상대 수익률 (시작일 = 100)`,
    `${lines[0].from}~${lines[0].to} 완료된 일봉 종가 기준입니다. 통화·시장이 다르면 각 시장의 현지 가격으로 계산했습니다.`);
  body.innerHTML = svg + legend;
  return figure;
}

// P1743: the same branches the 거시 screen draws — met-condition dots, market-price side, the favoured choice.
async function buildCrossroadsVisual({ documentRef: doc, root }) {
  const model = crossroadsForRoot(root, { regime: readMarketRegime(root) });
  if (!model?.available || model.held) return null;
  const tone = { same: '이 시나리오 쪽', against: '반대쪽', neutral: '중립', unknown: '보류' };
  const rows = [...model.items].sort((a, b) => (b.id === model.leadId) - (a.id === model.leadId) || (b.id === model.altId) - (a.id === model.altId) || b.met / b.total - a.met / a.total).slice(0, 6);
  const dots = (item) => Array.from({ length: item.total }, (_, i) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:2px;border:1.5px solid var(--text-secondary);${i < item.met ? 'background:var(--text-primary);border-color:var(--text-primary);' : ''}"></span>`).join('');
  const { figure, body } = frame(doc, '향후 시나리오 — 조건 충족 · 시장 가격 · 그 시나리오에서 유리한 쪽',
    `${model.asOf || ''} 관측 기준 · 확률이 아니라 맞는 조건 수와 시장 가격 방향입니다.${model.nextEvent ? ` 다음 발표 ${esc(model.nextEvent.date)} ${esc(model.nextEvent.name)}.` : ''}`);
  body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;">${rows.map((item) => `<tr style="border-top:1px solid var(--border-subtle);${item.id === model.leadId ? 'font-weight:600;' : ''}"><td style="padding:4px 6px 4px 0;color:var(--text-primary);">${esc(item.title.split(' — ')[0])}${item.id === model.leadId ? ' (중심)' : item.id === model.altId ? ' (대안)' : ''}</td><td style="padding:4px 6px;white-space:nowrap;" aria-label="조건 ${item.met}/${item.total}">${dots(item)}<span style="margin-left:4px;color:var(--text-secondary);">${item.met}/${item.total}</span></td><td style="padding:4px 6px;color:var(--text-secondary);white-space:nowrap;">${esc(tone[item.pricing.tone] || '보류')}</td><td style="padding:4px 0;color:var(--text-secondary);">${esc(item.favored.map((key) => CHOICES[key].split(' (')[0]).join(' · '))}</td></tr>`).join('')}</table>`;
  return figure;
}

// P1743: every theme's stage (long trend × 1 month) and its macro wind, as four short lists.
async function buildThemesVisual({ documentRef: doc, root }) {
  const store = root?.AIO?.store || { getState: () => ({ screener: { rows: root?.AIO_ARCH?.getScreenerState?.()?.rows || [] } }) };
  const { playbook } = themePlaybookForRoot(root, store);
  if (!playbook?.available) return null;
  const pct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  const color = { tail: 'var(--data-green)', head: 'var(--data-red)', mixed: 'var(--text-primary)', none: 'var(--text-muted)' };
  const { figure, body } = frame(doc, '테마 단계와 거시 영향 (모든 테마, 같은 규칙)',
    `${esc(playbook.asOf || '')} 확정 종가 · 긴 추세(미국 6개월, 한국 3개월)와 1개월 움직임 · 색은 중심 시나리오 기준 수혜(초록)·부담(빨강).`);
  body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">${Object.keys(THEME_STATES).map((stage) => {
    const list = playbook.themes.filter((row) => row.state === stage).sort((a, b) => b.ret1m - a.ret1m);
    return `<div><div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:3px;">${esc(THEME_STATES[stage].split(' (')[0])} · ${list.length}</div>${list.slice(0, 6).map((row) => `<div style="font-size:12px;color:${color[row.wind.lead]};" title="${esc(WIND_LABELS[row.wind.lead])}">${row.market === 'KR' ? '국내' : '미국'} ${esc(row.label)} ${pct(row.ret1m)}</div>`).join('')}${list.length > 6 ? `<div style="font-size:12px;color:var(--text-muted);">외 ${list.length - 6}개</div>` : ''}</div>`;
  }).join('')}</div>`;
  return figure;
}

const BUILDERS = { price: buildPriceVisual, fundamentals: buildFundamentalsVisual, relative: buildRelativeVisual, crossroads: buildCrossroadsVisual, themes: buildThemesVisual };

export async function renderAnswerVisuals({ documentRef: doc = globalThis.document, root = globalThis, container, query = '', mode = 'analysis', canonical = [], tickers = [], isCurrent = () => true } = {}) {
  if (!doc || !container) return [];
  const picks = chooseAnswerVisuals({ query, mode, canonical, tickers });
  const drawn = [];
  for (const pick of picks) {
    let figure = null;
    try { figure = await BUILDERS[pick.kind]({ documentRef: doc, root, symbol: pick.symbols[0], symbols: pick.symbols }); } catch (_) { figure = null; }
    if (!figure || !isCurrent()) continue;
    figure.dataset.visual = pick.kind;
    container.appendChild(figure);
    drawn.push(pick.kind);
  }
  return drawn;
}

// P1741: the unified panel's mount — a host above the source badge, kept only when a figure was drawn.
export async function attachAnswerVisuals({ documentRef: doc = globalThis.document, parent, before = null, scroller = null, ...rest } = {}) {
  if (!doc || !parent || !chooseAnswerVisuals(rest).length) return [];
  const host = doc.createElement('div');
  host.className = 'aio-answer-visuals';
  parent.insertBefore(host, before);
  const drawn = await renderAnswerVisuals({ ...rest, documentRef: doc, container: host, isCurrent: () => doc.body.contains(host) });
  if (!drawn.length) host.remove();
  else if (scroller) scroller.scrollTop = scroller.scrollHeight;
  return drawn;
}
