// v58.71 (owner 2026-10-23: "텔레그램 데이터들은 AI 채팅 시스템이랑도 연결할 부분이 있나?"): the chat saw channel posts only
// on the news/theme pages and only as 120-character summaries, so "META 목표주가 바뀌었어?" on a stock page got nothing.
// The digest `signals` (scripts/lib/telegram-signals.mjs) are joined here: for the tickers in the question, every
// reported target-price/rating action and quarter; for a market question, the latest releases against forecast and the
// retail leverage share. Each line is a relayed report — the chat cites it as "리서치 채널 보도", not as AIO data.

const DIRECTION = { raise: '상향', cut: '하향', hold: '유지', initiate: '신규', set: '제시' };
const VERDICT = { beat: '상회', miss: '하회', inline: '부합' };
const money = (value, currency) => (Number.isFinite(value) ? `${value.toLocaleString('en-US')}${currency === 'KRW' ? '원' : currency === 'USD' ? ' USD' : ` ${currency || ''}`}` : '?');

/** Prompt lines ('' when nothing applies). `tickers` are the symbols the question resolved to. */
export function formatChannelSignalEvidence(signals, { tickers = [], market = false, maxPerTicker = 6 } = {}) {
  const list = Array.isArray(signals) ? signals : [];
  if (!list.length) return '';
  const wanted = new Set((Array.isArray(tickers) ? tickers : []).map((sym) => String(sym || '').toUpperCase()).filter(Boolean));
  const lines = [];
  for (const sym of wanted) {
    const own = list.filter((signal) => String(signal.ticker || '').toUpperCase() === sym && (signal.kind === 'pt' || signal.kind === 'earnings'))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, maxPerTicker);
    for (const signal of own) {
      lines.push(signal.kind === 'pt'
        ? `  [${signal.date} ${sym}] ${signal.broker || '증권사'} 목표주가 ${signal.ptFrom != null ? `${money(signal.ptFrom, signal.currency)} → ` : ''}${money(signal.ptTo, signal.currency)} ${DIRECTION[signal.direction] || ''}${signal.rating ? ` · 의견 ${signal.rating}` : ''}${signal.ratingAction ? ` (${signal.ratingAction})` : ''}`
        : `  [${signal.date} ${sym}] 실적 ${signal.quarter || ''} 매출 ${VERDICT[signal.revenue] || '—'} · EPS ${VERDICT[signal.eps] || '—'} (예상 대비)${signal.guidance ? ` · 가이던스 ${signal.guidance === 'raise' ? '상향' : '하향'}` : ''}`);
    }
  }
  if (market) {
    for (const release of list.filter((signal) => signal.kind === 'macro').slice(0, 3)) {
      lines.push(`  [${release.date} 경제지표] ${release.name}: 실제 ${release.actual}${release.unit || ''} · 예상 ${release.forecast}${release.unit || ''}${release.previous != null ? ` · 이전 ${release.previous}${release.unit || ''}` : ''}`);
    }
    const retail = list.filter((signal) => signal.kind === 'retail' && signal.side === 'buy').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (retail[0]) lines.push(`  [${retail[0].date} 서학개미 순매수] 상위 10종목 ${retail[0].top10Share}% · 레버리지 롱 ${retail[0].leveragedLongShare}%${retail[1] ? ` (직전 ${retail[1].date} ${retail[1].leveragedLongShare}%)` : ''}`);
  }
  if (!lines.length) return '';
  return `telegram_channel_data (리서치 채널이 전한 수치 · 2차 자료 — 인용 시 "리서치 채널 보도에 따르면"으로 귀속하고 AIO가 확인한 값으로 쓰지 않는다; 목록에 없는 종목은 보도 없음이지 근거 없음이 아니다):\n${lines.join('\n')}\n`;
}
