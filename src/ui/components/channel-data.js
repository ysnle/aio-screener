// v58.71 (owner 2026-10-23: "평소 우리가 놓칠 수 있는 핵심 주요 정보/데이터들"): the numbers the research channels relay —
// economic releases against the forecast, target-price and rating actions, quarters against estimates, and the share
// of leveraged long products in Korean retail net buying of US stocks — read from telegram-digest.json `signals`
// (scripts/lib/telegram-signals.mjs). One visual (the leverage share by day), one reading, the rows in a fold.

const el = (doc, tag, text, className) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const day = (iso) => {
  const [, mm, dd] = String(iso || '').split('-').map(Number);
  return mm && dd ? `${mm}/${dd}` : '';
};
const fmt = (value) => (Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');
const price = (value, currency) => {
  if (!Number.isFinite(value)) return '—';
  if (currency === 'USD') return `$${fmt(value)}`;
  if (currency === 'KRW') return `${fmt(value)}원`;
  return `${fmt(value)} ${currency === 'EUR' ? '유로' : currency === 'JPY' ? '엔' : currency || ''}`.trim();
};
const DIRECTION = { raise: '상향', cut: '하향', hold: '유지', initiate: '신규', set: '제시' };
const RATING = { buy: '매수', hold: '중립', sell: '매도' };
const VERDICT = { beat: '상회', miss: '하회', inline: '부합' };

/** The reading and rows for the panel; pure so the contract check can call it. */
export function channelDataModel(signals, { recentDays = 3 } = {}) {
  const list = Array.isArray(signals) ? signals : [];
  const latest = list.reduce((max, signal) => (String(signal.date || '') > max ? String(signal.date) : max), '');
  if (!latest) return null;
  const since = new Date(Date.parse(`${latest}T00:00:00Z`) - (recentDays - 1) * 86400000).toISOString().slice(0, 10);
  const recent = (signal) => String(signal.date || '') >= since;
  const byDate = (a, b) => String(b.date || '').localeCompare(String(a.date || ''));
  const retail = list.filter((signal) => signal.kind === 'retail' && signal.side === 'buy').sort(byDate);
  const actions = list.filter((signal) => signal.kind === 'pt').sort(byDate);
  const reports = list.filter((signal) => signal.kind === 'earnings').sort(byDate);
  const releases = list.filter((signal) => signal.kind === 'macro').sort(byDate);
  const recentActions = actions.filter(recent);
  const recentReports = reports.filter(recent);
  const missed = (signal) => [signal.revenue, signal.eps].includes('miss');
  const sentences = [];
  if (recentActions.length) {
    sentences.push(`${day(since)} 이후 목표주가 상향 ${recentActions.filter((s) => s.direction === 'raise').length}건, 하향 ${recentActions.filter((s) => s.direction === 'cut').length}건${recentReports.length ? `, 실적은 예상 상회 ${recentReports.filter((s) => !missed(s) && [s.revenue, s.eps].includes('beat')).length}곳, 하회 ${recentReports.filter(missed).length}곳` : ''}입니다.`);
  }
  if (retail[0]) {
    const [now, before] = retail;
    const change = before ? (now.leveragedLongShare > before.leveragedLongShare + 5 ? '늘었습니다' : now.leveragedLongShare < before.leveragedLongShare - 5 ? '줄었습니다' : '비슷합니다') : '';
    sentences.push(`${day(now.date)} 서학개미 순매수에서 레버리지 롱 상품 비중은 ${fmt(now.leveragedLongShare)}%${before ? `로 직전(${fmt(before.leveragedLongShare)}%)${change === '비슷합니다' ? '과 비슷합니다' : `보다 ${change}`}` : '입니다'}.`);
  }
  return {
    latest,
    reading: sentences.join(' '),
    leverage: retail.slice(0, 8).reverse().map((signal) => ({ date: signal.date, value: signal.leveragedLongShare, top: signal.top?.[0]?.name || '' })),
    releases: releases.slice(0, 6).map((s) => `${day(s.date)} ${s.name} — 실제 ${fmt(s.actual)}${s.unit || ''}, 예상 ${fmt(s.forecast)}${s.unit || ''}${s.previous != null ? `, 이전 ${fmt(s.previous)}${s.unit || ''}` : ''} (${s.actual > s.forecast ? '예상보다 높음' : s.actual < s.forecast ? '예상보다 낮음' : '예상과 같음'})`),
    actions: actions.slice(0, 24).map((s) => `${day(s.date)} ${s.ticker}, ${s.broker || '증권사'}, ${s.ptFrom != null ? `${price(s.ptFrom, s.currency)} → ` : ''}${price(s.ptTo, s.currency)} ${DIRECTION[s.direction] || ''}${s.rating ? `, ${RATING[s.rating]}` : ''}${s.ratingAction ? `, 의견 ${s.ratingAction === 'upgrade' ? '상향' : '하향'}` : ''}`),
    reports: reports.slice(0, 16).map((s) => `${day(s.date)} ${s.ticker || s.name}${s.ticker && s.name ? ` (${s.name})` : ''}, 매출 ${VERDICT[s.revenue] || '—'}, EPS ${VERDICT[s.eps] || '—'}${s.guidance ? `, 가이던스 ${s.guidance === 'raise' ? '상향' : '하향'}` : ''}`)
  };
}

/** Fills (creating on first use) the block above the channel notes inside the 채널 소식 card. */
export function renderChannelData(doc, card, signals) {
  if (!doc || !card) return;
  let container = card.querySelector('#news-tg-data');
  if (!container) {
    container = el(doc, 'div', null, 'tg-data');
    container.id = 'news-tg-data';
    card.insertBefore(container, card.querySelector('#tg-feed-market-news'));
  }
  const model = channelDataModel(signals);
  container.replaceChildren();
  container.hidden = !model;
  if (!model) return;
  container.append(el(doc, 'div', '채널 데이터, 채널이 전한 수치이며 앱이 직접 확인한 값은 아닙니다', 'tg-data-head'));
  if (model.reading) container.append(el(doc, 'p', model.reading, 'tg-data-reading'));
  if (model.leverage.length) {
    const chart = el(doc, 'div', null, 'tg-data-leverage');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `서학개미 순매수 중 레버리지 롱 상품 비중: ${model.leverage.map((row) => `${day(row.date)} ${fmt(row.value)}%`).join(', ')}`);
    chart.append(el(doc, 'div', '서학개미 순매수 중 레버리지 롱 상품 비중 (날짜별)', 'tg-data-sub'));
    for (const row of model.leverage) {
      const line = el(doc, 'div', null, 'pf-weight-row');
      const track = el(doc, 'span', null, 'pf-weight-track');
      const bar = el(doc, 'span', null, 'pf-weight-bar');
      bar.style.width = `${Math.max(1, Math.min(100, row.value || 0)).toFixed(1)}%`;
      track.append(bar);
      line.title = row.top ? `1위 ${row.top}` : '';
      line.append(el(doc, 'span', day(row.date)), track, el(doc, 'span', `${fmt(row.value)}%`));
      chart.append(line);
    }
    container.append(chart);
  }
  const fold = el(doc, 'details', null, 'tg-data-fold');
  fold.append(el(doc, 'summary', '지표, 목표주가, 실적 자세히'));
  for (const [title, rows] of [['경제지표 (실제 대 예상)', model.releases], ['목표주가, 투자의견', model.actions], ['실적 (예상 대비)', model.reports]]) {
    if (!rows.length) continue;
    fold.append(el(doc, 'div', title, 'tg-data-sub'));
    const ul = el(doc, 'ul', null, 'tg-data-list');
    for (const row of rows) ul.append(el(doc, 'li', row));
    fold.append(ul);
  }
  container.append(fold);
}
