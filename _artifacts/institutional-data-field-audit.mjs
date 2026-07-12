import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = 'C:/Projects/AIO';
const OUT = resolve(ROOT, '_artifacts', 'institutional-data-field-audit.json');
const data = JSON.parse(readFileSync(resolve(ROOT, 'public-data', 'data.json'), 'utf8'));
const screener = JSON.parse(readFileSync(resolve(ROOT, 'public-data', 'screener.json'), 'utf8'));
const history = JSON.parse(readFileSync(resolve(ROOT, 'public-data', 'history.json'), 'utf8'));

const report = {
  generatedAt: new Date().toISOString(),
  inputs: {},
  leafAudit: {},
  quotes: {},
  macro: {},
  fearGreed: {},
  news: {},
  screener: {},
  history: {},
  failures: [],
  warnings: []
};

function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
function iso(v) { return typeof v === 'string' && !Number.isNaN(Date.parse(v)); }
function rows(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') return Object.entries(v).map(([key, value]) => ({ key, ...(value && typeof value === 'object' ? value : { value }) }));
  return [];
}
function leaves(root) {
  const out = [];
  const walk = (v, path) => {
    if (v === null || typeof v !== 'object') { out.push({ path, value: v, type: v === null ? 'null' : typeof v }); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${path}[${i}]`)); return; }
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(root, '');
  return out;
}
function summarizeLeaves(obj) {
  const all = leaves(obj);
  const nulls = all.filter(x => x.value === null || x.value === undefined || x.value === '');
  const nonFinite = all.filter(x => typeof x.value === 'number' && !Number.isFinite(x.value));
  const timestampLike = all.filter(x => /(?:At|Date|Time|asOf|updated|published)$/i.test(x.path));
  const invalidTimestamps = timestampLike.filter(x => x.value != null && x.value !== '' && !iso(x.value) && !/^\d{4}-\d{2}-\d{2}$/.test(String(x.value)));
  return {
    leafCount: all.length,
    types: Object.fromEntries([...new Set(all.map(x => x.type))].map(t => [t, all.filter(x => x.type === t).length])),
    nullOrEmptyCount: nulls.length,
    nullOrEmptyPaths: nulls.slice(0, 500).map(x => x.path),
    nonFiniteCount: nonFinite.length,
    invalidTimestampCount: invalidTimestamps.length,
    invalidTimestampPaths: invalidTimestamps.slice(0, 500).map(x => ({ path: x.path, value: x.value }))
  };
}

for (const [name, value] of Object.entries({ data, screener, history })) report.leafAudit[name] = summarizeLeaves(value);

const quoteRows = rows(data.quotes);
report.inputs.data = { topLevelKeys: Object.keys(data), generatedAt: data.generatedAt || data.meta?.generatedAt || null };
report.inputs.screener = { topLevelKeys: Object.keys(screener), asOf: screener.asOf || screener.meta?.asOf || null };
report.inputs.history = { topLevelKeys: Object.keys(history), asOf: history.asOf || history.generatedAt || null };

const quoteIssues = [];
for (const [i, q] of quoteRows.entries()) {
  const symbol = q.symbol || q.key || q.ticker || `row-${i}`;
  const price = q.price ?? q.regularMarketPrice ?? q.close;
  const prev = q.previousClose ?? q.prevClose ?? q.chartPreviousClose;
  const pct = q.pct ?? q.changePercent ?? q.regularMarketChangePercent;
  if (!finite(price) || price <= 0) quoteIssues.push({ symbol, field: 'price', value: price, issue: 'missing-or-nonpositive' });
  if (prev != null && (!finite(prev) || prev <= 0)) quoteIssues.push({ symbol, field: 'previousClose', value: prev, issue: 'invalid' });
  if (pct != null && (!finite(pct) || Math.abs(pct) > 100)) quoteIssues.push({ symbol, field: 'pct', value: pct, issue: 'invalid-range' });
  if (finite(price) && finite(prev) && finite(pct)) {
    const derived = (price / prev - 1) * 100;
    if (Math.abs(derived - pct) > 0.08) quoteIssues.push({ symbol, field: 'pct', value: pct, derived, issue: 'derived-mismatch' });
  }
}
const quoteFieldSet = [...new Set(quoteRows.flatMap(q => Object.keys(q)))].sort();
report.quotes = {
  count: quoteRows.length,
  fields: quoteFieldSet,
  rowsWithObservedAt: quoteRows.filter(q => iso(q.observedAt) || iso(q.regularMarketTime)).length,
  rowsWithFetchedAt: quoteRows.filter(q => iso(q.fetchedAt) || iso(q.updatedAt)).length,
  rowsWithMarketState: quoteRows.filter(q => q.marketState != null).length,
  rowsWithTimezone: quoteRows.filter(q => q.timezone || q.exchangeTimezoneName).length,
  rowsWithDelayMetadata: quoteRows.filter(q => q.delay != null || q.exchangeDataDelayedBy != null).length,
  issueCount: quoteIssues.length,
  issues: quoteIssues
};

const macroObject = data.macro || data.fred || {};
const macroRows = Object.entries(macroObject)
  .filter(([key, value]) => !key.startsWith('_') && !key.endsWith('Delta') && typeof value !== 'object')
  .map(([key, value]) => ({ key, value, asOf: macroObject[`_asOf_${key}`] || null, source: macroObject._source || null }));
const macroIssues = [];
for (const [i, m] of macroRows.entries()) {
  const key = m.series || m.id || m.key || `row-${i}`;
  const value = m.value ?? m.latest ?? m.close;
  if (value == null || value === '') macroIssues.push({ key, issue: 'missing-value' });
  if (typeof value === 'number' && !Number.isFinite(value)) macroIssues.push({ key, issue: 'nonfinite-value', value });
}
report.macro = {
  count: macroRows.length,
  fields: [...new Set(macroRows.flatMap(x => Object.keys(x)))].sort(),
  rowsWithSeriesObservedAt: macroRows.filter(x => iso(x.observedAt) || iso(x.asOf) || /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || ''))).length,
  rowsWithPublishedAt: macroRows.filter(x => iso(x.publishedAt)).length,
  rowsWithRevisionMetadata: macroRows.filter(x => x.realtimeStart || x.vintageDate || x.revisedAt || x.revision != null).length,
  issueCount: macroIssues.length,
  issues: macroIssues
};

const fg = data.fearGreed || {};
const fgRows = [fg];
report.fearGreed = {
  count: fgRows.length,
  fields: [...new Set(fgRows.flatMap(x => Object.keys(x)))].sort(),
  invalidValues: [fg.score, fg.previousScore, fg.previousWeek].filter(v => v != null && (!finite(v) || v < 0 || v > 100)),
  rowsWithObservedAt: iso(fg.observedAt) || iso(fg.asOf) || iso(fg.timestamp) ? 1 : 0,
  officialSource: false
};

const newsRows = rows(data.news);
const normTitle = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const titleCounts = new Map();
for (const n of newsRows) titleCounts.set(normTitle(n.title), (titleCounts.get(normTitle(n.title)) || 0) + 1);
const badNews = newsRows.map((n, i) => ({ i, n })).filter(({ n }) => !n.title || !(n.url || n.link) || !n.source || !(iso(n.publishedAt) || iso(n.datetime) || iso(n.date) || iso(n.pubDate))).map(({ i, n }) => ({ i, title: n.title || '', missing: ['title','url','source','publishedAt'].filter(k => k === 'url' ? !(n.url || n.link) : k === 'publishedAt' ? !(iso(n.publishedAt) || iso(n.datetime) || iso(n.date) || iso(n.pubDate)) : !n[k]) }));
report.news = {
  count: newsRows.length,
  fields: [...new Set(newsRows.flatMap(x => Object.keys(x)))].sort(),
  malformedCount: badNews.length,
  malformed: badNews,
  exactDuplicateTitleCount: [...titleCounts.values()].filter(n => n > 1).reduce((a, n) => a + n - 1, 0),
  sourceCounts: Object.fromEntries([...new Set(newsRows.map(x => x.source || 'MISSING'))].sort().map(s => [s, newsRows.filter(x => (x.source || 'MISSING') === s).length])),
  rowsWithAuthoritativeEventId: newsRows.filter(x => x.eventId || x.accessionNumber || x.releaseId).length
};

const stockContainer = screener.stocks || screener.data || screener.rows || [];
const stockRows = rows(stockContainer).map((s, i) => ({
  ...(s && typeof s === 'object' ? s : { value: s }),
  symbol: s?.symbol || s?.ticker || s?.key || (Array.isArray(stockContainer) ? undefined : Object.keys(stockContainer)[i])
}));
const stockIssues = [];
for (const [i, s] of stockRows.entries()) {
  const symbol = s.symbol || s.ticker || `row-${i}`;
  if (!s.symbol && !s.ticker) stockIssues.push({ symbol, field: 'symbol', issue: 'missing' });
  const price = s.price ?? s.close;
  if (price != null && (!finite(price) || price <= 0)) stockIssues.push({ symbol, field: 'price', value: price, issue: 'invalid' });
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === 'number' && !Number.isFinite(v)) stockIssues.push({ symbol, field: k, value: v, issue: 'nonfinite' });
    if (/score|rank|rsi/i.test(k) && finite(v) && (v < -100 || v > 10000)) stockIssues.push({ symbol, field: k, value: v, issue: 'implausible-range' });
  }
}
report.screener = {
  count: stockRows.length,
  fields: [...new Set(stockRows.flatMap(x => Object.keys(x)))].sort(),
  fieldCoverage: Object.fromEntries([...new Set(stockRows.flatMap(x => Object.keys(x)))].sort().map(k => [k, stockRows.filter(x => x[k] !== null && x[k] !== undefined && x[k] !== '').length])),
  issueCount: stockIssues.length,
  issues: stockIssues.slice(0, 2000),
  rowsWithObservedAt: stockRows.filter(x => iso(x.observedAt) || iso(x.asOf) || iso(x.regularMarketTime)).length,
  rowsWithSource: stockRows.filter(x => x.source || x.provider).length
};

const historyRows = rows(history.history || history.data || history);
const historyMetricKeys = [...new Set(historyRows.flatMap(x => Object.keys(x)).filter(k => !['key','date','asOf','generatedAt'].includes(k)))].sort();
report.history = {
  seriesCount: historyRows.length,
  fields: [...new Set(historyRows.flatMap(x => Object.keys(x)))].sort(),
  fieldCoverage: Object.fromEntries(historyMetricKeys.map(k => [k, historyRows.filter(x => finite(x[k])).length])),
  dateMin: historyRows.map(x => x.date || x.key).filter(Boolean).sort()[0] || null,
  dateMax: historyRows.map(x => x.date || x.key).filter(Boolean).sort().at(-1) || null
};

if (report.quotes.rowsWithObservedAt !== report.quotes.count) report.failures.push('quotes: not every row has true observation time');
if (report.quotes.rowsWithMarketState !== report.quotes.count) report.failures.push('quotes: not every row has market state');
if (report.quotes.rowsWithTimezone !== report.quotes.count) report.failures.push('quotes: not every row has exchange timezone');
if (report.macro.rowsWithRevisionMetadata !== report.macro.count) report.warnings.push('macro: revision/vintage metadata incomplete');
if (report.news.rowsWithAuthoritativeEventId !== report.news.count) report.warnings.push('news: authoritative event identifiers incomplete');
if (report.screener.rowsWithObservedAt !== report.screener.count) report.failures.push('screener: per-row observation time incomplete');

writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  output: OUT,
  leafAudit: report.leafAudit,
  quotes: report.quotes,
  macro: report.macro,
  fearGreed: report.fearGreed,
  news: report.news,
  screener: { ...report.screener, issues: undefined, fieldCoverage: undefined },
  failures: report.failures,
  warnings: report.warnings
}, null, 2));
