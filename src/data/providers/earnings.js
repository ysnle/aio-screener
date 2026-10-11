// P1607: shared calendar discovery stays within the artifact's actual date window.
export function selectPublicEarnings(data, symbol, from, to) {
  if (!data || data.status !== 'current-reference' || !Array.isArray(data.earnings) || !data.weekStart || !data.weekEnd || from > data.weekEnd || to < data.weekStart) return null;
  return data.earnings.filter(row => row.symbol === symbol && row.date >= from && row.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(row => ({ ...row, source: data.source, sourceUrl: data.sourceUrl, fetchedAt: data.generatedAt, coverageEnd: data.weekEnd }));
}

export function createPublicEarningsReader(httpClient, now = () => Date.now()) {
  let pending, cached, loadedAt = 0;
  return async (symbol, from, to) => {
    if (!cached || now() - loadedAt > 120000) {
      if (!pending) pending = httpClient.requestJson('./public-data/earnings-calendar.json', { cache: 'no-store' }).then(result => {
        if (result.ok && Array.isArray(result.data?.earnings)) { cached = result.data; loadedAt = now(); }
        else cached = null;
      }).finally(() => { pending = null; });
      await pending;
    }
    return selectPublicEarnings(cached, symbol, from, to);
  };
}
