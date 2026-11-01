// v59.55 (owner 11/1, "텔레그램에서 가져오는 게시물과 자료들은 제발 그대로 복붙해서 가져오지 말고 … 가공 후 다른 정보/데이터들과 같이
// 통합해서"): a channel post never reaches a screen as its own text. What a screen may show is the structured fact the
// producer extracted from it (scripts/lib/telegram-signals.mjs: a target-price or rating action, a quarter against
// estimates, a release against the forecast), written in the app's own sentence form; a post without such a fact feeds
// the AI reading (narrative-context.mjs, the chat context) only. Shared by 뉴스's 시장 신호 card, the move headlines on
// 브리핑 and 테마, and the session sentence.

const day = (iso) => {
  const [, mm, dd] = String(iso || '').split('-').map(Number);
  return mm && dd ? `${mm}/${dd}` : '';
};
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
  return '';
}

/** The same line with its date in front ("10/30 BofA, NVDA 목표주가 …"). */
export const datedSignalLine = (signal) => `${day(signal?.date)} ${signalLine(signal)}`.trim();

/**
 * The processed line a channel post may show for `symbol`: the post's own extracted fact about that ticker, else null.
 * `signals` is telegram-digest.json `signals` (each names its source post id).
 */
export function channelLineFor(symbol, post, signals = []) {
  const sym = String(symbol || '').toUpperCase();
  if (!sym || !post) return null;
  const id = String(post.id || '');
  const hit = (Array.isArray(signals) ? signals : []).find((signal) => String(signal?.post || '') === id && String(signal?.ticker || '').toUpperCase() === sym && signal.kind !== 'retail');
  return hit ? signalLine(hit) : null;
}
