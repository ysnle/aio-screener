// v58.75 (persona review): the redacted holdings line — ticker, sector, weight, return and the valuation basis — moved out
// of js/aio-workspace.js. The portfolio workbench prompts use it, and the AI panel sends it only after the session consent.
const signedPct = (value) => `${value >= 0 ? '+' : ''}${value}%`;

export function portfolioRowsLine(root = globalThis) {
  const positions = typeof root.getPortfolioData === 'function' ? root.getPortfolioData() || [] : [];
  const snap = typeof root._aioPortfolioAiRows === 'function' ? root._aioPortfolioAiRows() : null; // #12: base-currency rows + date (src/domain/portfolio/portfolio-read.js)
  const rows = snap?.available && snap.rows.length ? snap.rows
    : typeof root.AIO?.redactPortfolioForAI === 'function' ? root.AIO.redactPortfolioForAI(positions) : positions.map((p) => ({ ticker: p.ticker }));
  const line = rows.map((p) => {
    const facts = [p.sector && p.sector !== 'unknown' ? p.sector : null, p.allocationPct != null ? `비중 ${p.allocationPct}%` : null, p.returnPct != null ? `수익률 ${signedPct(p.returnPct)}` : null].filter(Boolean);
    return p.ticker + (facts.length ? `(${facts.join(', ')})` : '');
  }).join(', ');
  if (!snap?.available) return line;
  const cash = snap.cashPct != null ? `, 현금 ${snap.cashPct}%${snap.cashCurrencies?.length ? `(${snap.cashCurrencies.join('·')}${snap.cashBasis ? `, ${snap.cashBasis} 환산` : ''})` : ''}` : '';
  return `${line} [기준 통화 ${snap.baseCurrency || '미선언'}, 평가 기준일 ${snap.asOf || '미확인'}, 비중은 현금 포함 총자산 대비${cash}]`;
}
