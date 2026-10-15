// v57.81: canned provider responses for the out-of-universe symbol gates (unit + browser). Shapes follow the live
// Yahoo v8 chart, SEC companyfacts/submissions and the Nasdaq Trader listing artifact; values are fixtures, not data.
const DAY = 86_400_000;

function lastCompletedUsSessionStart(nowMs) {
  // A US session's daily bar starts 13:30Z (EDT); the bar is completed after 20:15Z. Weekends are skipped.
  let ms = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate(), 13, 30);
  if (nowMs < ms + (6 * 60 + 45) * 60_000) ms -= DAY;
  while ([0, 6].includes(new Date(ms).getUTCDay())) ms -= DAY;
  return ms;
}

export function chartFixture(symbol, { nowMs = Date.now(), sessions = 252, start = 40, drift = 0.0011, wave = 0.06, name = symbol, exchange = 'NMS', instrumentType = 'EQUITY', volume = 400_000 } = {}) {
  const stamps = [];
  for (let ms = lastCompletedUsSessionStart(nowMs); stamps.length < sessions; ms -= DAY) if (![0, 6].includes(new Date(ms).getUTCDay())) stamps.unshift(ms);
  const closes = stamps.map((_, i) => Number((start * Math.exp(drift * i) * (1 + wave * Math.sin(i / 9))).toFixed(2)));
  const last = stamps.at(-1);
  return { chart: { error: null, result: [{
    meta: { symbol, shortName: name, longName: name, currency: 'USD', instrumentType, exchangeName: exchange, exchangeTimezoneName: 'America/New_York',
      regularMarketPrice: closes.at(-1), regularMarketTime: Math.floor((last + 6.5 * 3600_000) / 1000), regularMarketPreviousClose: closes.at(-2), previousClose: closes.at(-2),
      chartPreviousClose: closes[0], fiftyTwoWeekLow: Math.min(...closes), fiftyTwoWeekHigh: Math.max(...closes), dataGranularity: '1d',
      currentTradingPeriod: { regular: { start: Math.floor(last / 1000), end: Math.floor((last + 6.5 * 3600_000) / 1000) } } },
    timestamp: stamps.map((ms) => Math.floor(ms / 1000)),
    indicators: { quote: [{ close: closes, open: closes.map((x) => Number((x * 0.996).toFixed(2))), high: closes.map((x) => Number((x * 1.012).toFixed(2))),
      low: closes.map((x) => Number((x * 0.988).toFixed(2))), volume: closes.map((_, i) => volume + (i % 7) * 15_000) }], adjclose: [{ adjclose: closes }] } }] } };
}

// One issuer's annual 10-K facts for two fiscal years (FY ending Dec 31), the shape data.sec.gov returns.
export function companyFactsFixture({ cik, name, fy = 2025, revenue = [900e6, 1_100e6], netIncome = [120e6, 160e6], equity = [700e6, 820e6], shares = 40e6, eps = null } = {}) {
  const accn = (year) => `000${String(cik).slice(-7)}-${String(year + 1).slice(-2)}-000011`;
  const filed = (year) => `${year + 1}-02-20`;
  const duration = (values) => values.map((val, index) => { const year = fy - 1 + index; return { start: `${year}-01-01`, end: `${year}-12-31`, val, accn: accn(year), fy: year, fp: 'FY', form: '10-K', filed: filed(year), frame: `CY${year}` }; });
  const instant = (values) => values.map((val, index) => { const year = fy - 1 + index; return { end: `${year}-12-31`, val, accn: accn(year), fy: year, fp: 'FY', form: '10-K', filed: filed(year), frame: `CY${year}Q4I` }; });
  const dilutedEps = (eps || netIncome.map((value) => Number((value / shares).toFixed(2))));
  return { cik: Number(cik), entityName: name, facts: {
    dei: { EntityCommonStockSharesOutstanding: { units: { shares: [{ end: `${fy + 1}-02-10`, val: shares, accn: accn(fy), fy, fp: 'FY', form: '10-K', filed: filed(fy) }] } } },
    'us-gaap': {
      Revenues: { units: { USD: duration(revenue) } },
      NetIncomeLoss: { units: { USD: duration(netIncome) } },
      StockholdersEquity: { units: { USD: instant(equity) } },
      EarningsPerShareDiluted: { units: { 'USD/shares': duration(dilutedEps) } },
      WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: duration(netIncome.map(() => shares)) } }
    } } };
}

export function submissionsFixture({ cik, name, ticker, fy = 2025, sic = '3089', sicDescription = 'Plastics Products, NEC' } = {}) {
  const accession = `000${String(cik).slice(-7)}-${String(fy + 1).slice(-2)}-000011`;
  return { cik: String(Number(cik)), name, tickers: [ticker], exchanges: ['Nasdaq'], sic, sicDescription,
    filings: { recent: { accessionNumber: [accession], filingDate: [`${fy + 1}-02-20`], reportDate: [`${fy}-12-31`],
      acceptanceDateTime: [`${fy + 1}-02-20T21:05:00.000Z`], form: ['10-K'], primaryDocument: [`${ticker.toLowerCase()}-${fy}1231.htm`], items: [''] } } };
}

// v57.81: the same columnar us-listings.v1 shape scripts/lib/us-listings.mjs publishes (src/data/us-listings.js reads only that).
export function listingFixture(rows, { asOf = '2026-10-15' } = {}) {
  return { schemaVersion: 'us-listings.v1', generatedAt: `${asOf}T10:00:00Z`, asOf, source: 'fixture', count: rows.length,
    exchanges: { Q: 'Nasdaq', N: 'NYSE', A: 'NYSE American', P: 'NYSE Arca', Z: 'Cboe BZX', V: 'IEX' },
    columns: { sym: rows.map((row) => row.symbol), name: rows.map((row) => row.name), exch: rows.map((row) => row.exchange).join(''),
      etf: rows.map((row) => (row.etf === 'Y' ? '1' : '0')).join(''), cik: rows.map((row) => row.cik ?? null) } };
}
