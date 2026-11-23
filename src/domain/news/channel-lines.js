export const fmtNumber = (value) => (Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—');
export function fmtPrice(value, currency) {
  if (!Number.isFinite(value)) return '—';
  if (currency === 'USD') return `$${fmtNumber(value)}`;
  if (currency === 'KRW') return `${fmtNumber(value)}원`;
  return `${fmtNumber(value)} ${currency === 'EUR' ? '유로' : currency === 'JPY' ? '엔' : currency || ''}`.trim();
}
export const DIRECTION = Object.freeze({ raise: '상향', cut: '하향', hold: '유지', initiate: '신규', set: '제시' });
export const RATING = Object.freeze({ buy: '매수', hold: '중립', sell: '매도' });
export const VERDICT = Object.freeze({ beat: '상회', miss: '하회', inline: '부합' });

/** One structured signal as one line, without its date. */
export function signalLine(signal) {
  if (!signal) return '';
  if (signal.kind === 'pt') {
    return `${signal.broker || '증권사'}, ${signal.ticker} 목표주가 ${signal.ptFrom != null ? `${fmtPrice(signal.ptFrom, signal.currency)} → ` : ''}${fmtPrice(signal.ptTo, signal.currency)} ${DIRECTION[signal.direction] || ''}${signal.rating ? `, ${RATING[signal.rating]}` : ''}${signal.ratingAction ? `, 의견 ${signal.ratingAction === 'upgrade' ? '상향' : '하향'}` : ''}`.trim();
  }
  if (signal.kind === 'earnings') {
    return `${signal.ticker || signal.name}${signal.ticker && signal.name ? ` (${signal.name})` : ''} 실적, 매출 ${VERDICT[signal.revenue] || '—'}, EPS ${VERDICT[signal.eps] || '—'}${signal.guidance ? `, 가이던스 ${signal.guidance === 'raise' ? '상향' : '하향'}` : ''}`;
  }
  if (signal.kind === 'macro') {
    const unit = signal.unit || '';
    const verdict = signal.actual > signal.forecast ? '예상보다 높음' : signal.actual < signal.forecast ? '예상보다 낮음' : '예상과 같음';
    return `${signal.name} 실제 ${fmtNumber(signal.actual)}${unit}, 예상 ${fmtNumber(signal.forecast)}${unit}${signal.previous != null ? `, 이전 ${fmtNumber(signal.previous)}${unit}` : ''} (${verdict})`;
  }
  if (signal.kind === 'deal') {
    const terms = [signal.payment === 'stock' ? '주식 교환' : signal.payment === 'cash' ? '현금' : null,
      signal.ratio != null ? `${signal.target} 1주당 ${signal.acquirer} ${fmtNumber(signal.ratio)}주` : null,
      Number.isFinite(signal.valueUsd) ? `거래 규모 약 ${fmtNumber(Math.round(signal.valueUsd / 1e8))}억 달러` : null,
      signal.premiumPct != null ? `프리미엄 ${fmtNumber(signal.premiumPct)}%` : null].filter(Boolean);
    return `${signal.acquirer}의 ${signal.target} 인수 발표${terms.length ? ` (${terms.join(', ')})` : ''}`;
  }
  return '';
}

/**
 * The processed line a channel post may show for `symbol`: the post's own extracted fact about that ticker, else null.
 * `signals` is telegram-digest.json `signals` (each names its source post id).
 */
export function channelLineFor(symbol, post, signals = []) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym || !post) return null;
  const id = String(post.id || '');
  const names = (signal) => (Array.isArray(signal?.tickers) ? signal.tickers : [signal?.ticker]).map((t) => String(t || '').toUpperCase());
  const hit = (Array.isArray(signals) ? signals : []).find((signal) => String(signal?.post || '') === id && names(signal).includes(sym) && signal.kind !== 'retail');
  return hit ? signalLine(hit) : null;
}
