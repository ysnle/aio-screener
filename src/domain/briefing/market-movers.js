// v59.44: the market-mover list on its own, so the boot-time news matcher (src/domain/market/move-attribution.js)
// does not load the brief parser and selectors in event-briefs.js, which re-exports it.

// The fixed list (owner 2026-10-28). `newsNames` are the exact names a headline uses (src/domain/market/move-attribution.js
// matches them by the shared keyword rule). `irDomains` limit the call-summary search to the company's own pages plus wires.
// CIKs are not listed: the producer resolves them from SEC company_tickers.json by exact ticker. Korean names resolve
// through DART by corp code, and the producer checks the filing names the same company before using it.
// v59.44 (owner 2026-10-29/30, news weighting): `tier` 1 is the index-moving core (the largest US weights and the two
// Korean memory makers) that 오늘 shows as full cards. The researched company-story names
// (public-data/company-profiles/index.json) outside this list are added by the producer with their AI-chain layer; see
// briefTier in event-briefs.js for how the layer and the price move weigh them.
export const MARKET_MOVERS = Object.freeze([
  { sym: 'MSFT', tier: 1, nameKo: '마이크로소프트', newsNames: ['Microsoft'], irDomains: ['microsoft.com'] },
  { sym: 'GOOGL', tier: 1, nameKo: '알파벳', newsNames: ['Alphabet', 'Google'], irDomains: ['abc.xyz'] },
  { sym: 'AMZN', tier: 1, nameKo: '아마존', newsNames: ['Amazon'], irDomains: ['aboutamazon.com', 'amazon.com'] },
  { sym: 'META', tier: 1, nameKo: '메타', newsNames: ['Meta Platforms', 'Meta'], irDomains: ['atmeta.com', 'meta.com'] },
  { sym: 'AAPL', tier: 1, nameKo: '애플', newsNames: ['Apple'], irDomains: ['apple.com'] },
  { sym: 'NVDA', tier: 1, nameKo: '엔비디아', newsNames: ['Nvidia'], irDomains: ['nvidia.com'] },
  { sym: 'AVGO', tier: 1, nameKo: '브로드컴', newsNames: ['Broadcom'], irDomains: ['broadcom.com'] },
  { sym: 'TSM', tier: 1, nameKo: 'TSMC', newsNames: ['TSMC'], irDomains: ['tsmc.com'], foreignIssuer: true },
  { sym: 'ORCL', tier: 2, nameKo: '오라클', newsNames: ['Oracle'], irDomains: ['oracle.com'] },
  { sym: 'TSLA', tier: 1, nameKo: '테슬라', newsNames: ['Tesla'], irDomains: ['tesla.com'] },
  { sym: 'MU', tier: 2, nameKo: '마이크론', newsNames: ['Micron'], irDomains: ['micron.com'] },
  // v59.43 (owner 2026-10-29): ServiceNow's report moves enterprise-software names the same way the hyperscalers move AI hardware.
  { sym: 'NOW', tier: 2, nameKo: '서비스나우', newsNames: ['ServiceNow'], irDomains: ['servicenow.com'] },
  { sym: '000660.KS', tier: 1, nameKo: 'SK하이닉스', market: 'KR', dartCorpCode: '00164779', dartName: 'SK하이닉스', newsNames: ['SK Hynix', 'SK하이닉스', '하이닉스'], irDomains: ['skhynix.com'] },
  { sym: '005930.KS', tier: 1, nameKo: '삼성전자', market: 'KR', dartCorpCode: '00126380', dartName: '삼성전자', newsNames: ['Samsung Electronics', '삼성전자'], irDomains: ['samsung.com'] }
].map(Object.freeze));

export const MOVER_BY_SYMBOL = Object.freeze(Object.fromEntries(MARKET_MOVERS.map((row) => [row.sym, row])));
