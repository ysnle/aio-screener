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
  { sym: 'NOW', tier: 2, nameKo: '서비스나우', newsNames: ['ServiceNow'], irDomains: ['servicenow.com'] },
  { sym: '000660.KS', tier: 1, nameKo: 'SK하이닉스', market: 'KR', dartCorpCode: '00164779', dartName: 'SK하이닉스', newsNames: ['SK Hynix', 'SK하이닉스', '하이닉스'], irDomains: ['skhynix.com'] },
  { sym: '005930.KS', tier: 1, nameKo: '삼성전자', market: 'KR', dartCorpCode: '00126380', dartName: '삼성전자', newsNames: ['Samsung Electronics', '삼성전자'], irDomains: ['samsung.com'] }
].map(Object.freeze));

export const MOVER_BY_SYMBOL = Object.freeze(Object.fromEntries(MARKET_MOVERS.map((row) => [row.sym, row])));
