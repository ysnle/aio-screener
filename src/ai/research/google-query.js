// P1607: search-plan restrictions must survive the provider transport boundary.
export function buildGoogleSearchQuery(query, options = {}) {
  const domains = [...new Set((options.allowedDomains || []).map(value => String(value).toLowerCase().replace(/^www\./, '')))]
    .filter(domain => /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)).slice(0, 20);
  const restriction = domains.length ? ' (' + domains.map(domain => 'site:' + domain).join(' OR ') + ')' : '';
  const days = Number(options.lookbackDays) || ({ day: 1, week: 7, month: 30 }[options.recency]);
  return { query: String(query).slice(0, 1800) + restriction, domains,
    dateRestrict: Number.isInteger(days) && days > 0 ? 'd' + Math.min(days, 3650) : null };
}

export function isGoogleResultAllowed(rawUrl, domains = []) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && (!domains.length || domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)));
  } catch { return false; }
}
