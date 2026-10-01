import { buildBriefingDecisionSummary } from '../../domain/briefing/decision-summary.js';
import { computeTradingScoreModel } from '../../domain/signal/trading-score.js';

function node(doc, tag, value, css = '') {
  const el = doc.createElement(tag);
  if (value != null) el.textContent = value;
  if (css) el.style.cssText = css;
  return el;
}

// P1346: native ownership replaces the entry-only legacy score/F&G/action writers.
export function renderBriefingSummary({ documentRef: doc, root, page, items = [] }) {
  let input = {};
  try { input = root?._aioReadTradingScoreInputs?.() || {}; } catch (_) {}
  let quotes = [];
  try { quotes = root?.AIO_ARCH?.getMarketSnapshot?.()?.quotes || []; } catch (_) {}
  const obs = {};
  for (const [key, symbol] of Object.entries({ tnx: '^TNX', dxy: 'DX-Y.NYB', oilPrice: 'CL=F', usdJpy: 'JPY=X', nvda: 'NVDA', smh: 'SMH', kospi: '^KS11' })) {
    const live = root?._liveData?.[symbol];
    const envelope = live?.quoteEnvelope || live;
    obs[key] = [quotes.find((row) => row.instrumentId === symbol), envelope && { ...envelope,
      value: envelope.value ?? envelope.price, session: envelope.session || envelope.marketState || live.session || live.marketState }].filter(Boolean);
  }
  const model = buildBriefingDecisionSummary({ scoreInputs: input, observations: obs, items });
  let section = page.querySelector('#briefing-decision-summary');
  if (!section) {
    section = node(doc, 'section', null, 'margin:20px 0;padding:20px;border:1px solid var(--border);border-radius:8px;background:var(--bg-elevated);');
    section.id = 'briefing-decision-summary';
    section.setAttribute('aria-labelledby', 'briefing-summary-title');
    const strip = doc.getElementById('briefing-market-strip');
    if (strip) strip.after(section); else page.prepend(section);
  }
  const heading = node(doc, 'h2', '시장 상황 요약 (6축)', 'font-size:18px;margin:0 0 6px;');
  heading.id = 'briefing-summary-title';
  const basis = node(doc, 'p', `${model.basisLabel} · 참고 관찰`, 'font-size:12px;color:var(--text-secondary);margin:0 0 16px;');
  const grid = node(doc, 'div', null, 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;');
  for (const axis of model.axes) {
    const box = node(doc, 'div', null, 'padding:12px;border-top:1px solid var(--border);line-height:1.7;');
    box.dataset.axis = axis.id;
    box.dataset.tone = axis.tone;
    box.append(node(doc, 'h3', `${axis.title} · ${axis.label}`, 'font-size:14px;margin:0 0 6px;'));
    const values = axis.values.map((row) => `${row.label} ${row.value == null ? '—' : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: row.key === 'fg' ? 0 : 2 }).format(row.value)}${row.key === 'tnx' && row.value != null ? '%' : ''}`).join(' · ');
    box.append(node(doc, 'p', values, 'margin:0 0 4px;font-size:13px;'), node(doc, 'small', axis.basisLabel),
      node(doc, 'p', axis.newsLabel, 'margin:4px 0;font-size:12px;color:var(--text-secondary);'));
    for (const value of axis.values.filter((row) => row.basisLabel)) box.append(node(doc, 'small', `${value.label}: ${value.basisLabel}`, 'display:block;font-size:11px;'));
    if (axis.missing.length) box.append(node(doc, 'small', `관측 근거 미확보: ${axis.missing.join(' · ')}`));
    grid.append(box);
  }
  section.replaceChildren(heading, basis, grid);
  section.dataset.aioBriefingSummaryRenderer = 'native';
  const score = computeTradingScoreModel(input);
  const set = (id, value) => { const el = doc.getElementById(id); if (el) { el.textContent = value; el.style.color = ''; } };
  set('briefing-score-val', score.total == null ? '—' : `${score.total}${score.partial ? '*' : ''}`);
  set('briefing-fg-val', input.fg == null ? '—' : String(Math.round(input.fg)));
  set('briefing-regime-badge', '종가 기준 참고 관찰');
  set('briefing-regime-badge3', score.total == null ? '점수 보류' : '참고값');
  set('briefing-action-meta', '시장 확인 목록 · 매매 지시 아님');
  const actions = doc.getElementById('briefing-action-list');
  if (actions) actions.replaceChildren(...model.checks.map((check) => node(doc, 'div', check, 'font-size:13px;line-height:1.7;')));
}
