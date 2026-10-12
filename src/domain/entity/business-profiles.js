// P1624: the same identity/source contract applies to every issuer; never infer its business from a ticker.
export function businessProfileFor(symbol, row = {}, metadata = {}) {
  const id = String(symbol || '').trim().toUpperCase();
  const candidates = [metadata.businessProfile, row.businessProfile];
  const profile = candidates.find(item => String(item?.symbol || '').trim().toUpperCase() === id
    && typeof item?.description === 'string' && item.description.trim()
    && typeof item?.sourceUrl === 'string' && /^https:\/\//.test(item.sourceUrl));
  const isKr = /\.(KS|KQ)$/.test(id);
  const instrument = String(metadata.instrumentType || row.instrumentType || row.quoteType || row.instrumentRef?.assetType || row.assetType || '').toUpperCase();
  const kind = instrument === 'ETF' ? '상장지수펀드(ETF)' : instrument === 'INDEX' ? '지수'
    : ['EQUITY','STOCK'].includes(instrument) ? '상장 기업' : '종목';
  return { symbol: id, name: row.name || metadata.name || id,
    kind: `${isKr ? '한국' : metadata.currency === 'USD' || row.market === 'US' ? '미국' : '시장 미확인'} ${kind}`,
    sector: row.sector || null, industry: row.industry || null,
    description: profile?.description.trim() || null, source: profile?.source || '종목 등록 정보',
    sourceUrl: profile?.sourceUrl || metadata.sourceUrl || null,
    descriptionStatus: profile ? 'sourced' : 'unavailable' };
}
