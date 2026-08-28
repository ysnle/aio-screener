function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeThemeDetail(detail) {
  if (!detail || typeof detail !== 'object') return null;
  const leaders = Array.isArray(detail.leaders)
    ? detail.leaders.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const leaderHighlight = Array.isArray(detail.leaderHighlight)
    ? detail.leaderHighlight.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const subThemes = Array.isArray(detail.subThemes)
    ? detail.subThemes.map((sub) => ({
        name: String(sub?.name || '').trim(),
        tickers: Array.isArray(sub?.tickers)
          ? sub.tickers.map((value) => String(value || '').trim().toUpperCase()).filter(Boolean)
          : [],
        etf: sub?.etf ? String(sub.etf).trim().toUpperCase() : null,
        weights: sub?.weights && typeof sub.weights === 'object'
          ? Object.fromEntries(Object.entries(sub.weights).map(([symbol, weight]) => [String(symbol).trim().toUpperCase(), finite(Number(weight))]))
          : null
      })).filter((sub) => sub.name || sub.tickers.length)
    : [];
  const quotes = detail.quotes && typeof detail.quotes === 'object'
    ? Object.fromEntries(Object.entries(detail.quotes).map(([symbol, quote]) => [String(symbol).trim().toUpperCase(), Object.freeze({
        price: finite(quote?.price),
        pct: finite(quote?.pct),
        directionValue: finite(quote?.directionValue ?? quote?.pct),
        observedAt: quote?.observedAt || null,
        fetchedAt: quote?.fetchedAt || null,
        source: quote?.source || 'theme-detail-provider',
        sourceKind: quote?.sourceKind || 'runtime-quote',
        revision: quote?.revision || null,
        changeBasis: quote?.changeBasis || 'unknown',
        directionCompatible: quote?.directionCompatible === true
      })]))
    : {};
  const rawInsight = detail.insight && typeof detail.insight === 'object' ? detail.insight : {};
  const insight = Object.freeze({
    macro: String(rawInsight.macro || '').trim(),
    paradox: String(rawInsight.paradox || '').trim(),
    chainEffect: String(rawInsight.chainEffect || '').trim(),
    sentiment: String(rawInsight.sentiment || '').trim(),
    breakSignals: Object.freeze(Array.isArray(rawInsight.breakSignals)
      ? rawInsight.breakSignals.map((value) => String(value || '').trim()).filter(Boolean)
      : [])
  });
  return Object.freeze({
    id: String(detail.id || '').trim(),
    label: String(detail.label || detail.nameKr || detail.id || 'Theme'),
    etf: detail.etf ? String(detail.etf).trim().toUpperCase() : null,
    compositeBase: detail.compositeBase ? String(detail.compositeBase).trim().toUpperCase() : null,
    pct: finite(detail.pct),
    breadth: finite(detail.breadth),
    source: String(detail.source || 'theme-detail-provider'),
    membershipPolicy: detail.membershipPolicy && typeof detail.membershipPolicy === 'object' ? Object.freeze({
      version: String(detail.membershipPolicy.version || 'theme-membership.v1'),
      source: String(detail.membershipPolicy.source || 'AIO curated taxonomy'),
      sourceKind: String(detail.membershipPolicy.sourceKind || 'REFERENCE'),
      observedAt: detail.membershipPolicy.observedAt || null,
      allowedUse: String(detail.membershipPolicy.allowedUse || 'reference'),
      status: String(detail.membershipPolicy.status || 'as-of-unverified'),
      note: String(detail.membershipPolicy.note || '')
    }) : null,
    leaders: Object.freeze(leaders),
    leaderHighlight: Object.freeze(leaderHighlight),
    quotes: Object.freeze(quotes),
    insight,
    subThemes: Object.freeze(subThemes.map((sub) => Object.freeze(sub)))
  });
}

export function normalizeThemes(raw = {}) {
  const items = (Array.isArray(raw.items) ? raw.items : []).map((item, index) => ({
    id: String(item?.id || item?.symbol || `theme-${index}`),
    symbol: String(item?.symbol || item?.id || ''),
    label: String(item?.label || item?.name || item?.symbol || 'Theme'),
    pct: finite(item?.pct),
    weeklyPct: finite(item?.weeklyPct),
    rsRatio: finite(item?.rsRatio),
    rsMomentum: finite(item?.rsMomentum),
    quadrant: String(item?.quadrant || 'neutral'),
    view: String(item?.view || 'sectors'),
    source: String(item?.source || 'themes-provider'),
    sourceKind: String(item?.sourceKind || 'runtime-quote'),
    price: finite(item?.price),
    directionValue: finite(item?.directionValue ?? item?.pct),
    observedAt: item?.observedAt || null,
    fetchedAt: item?.fetchedAt || null,
    revision: item?.revision || null,
    changeBasis: item?.changeBasis || 'unknown',
    directionCompatible: item?.directionCompatible === true
  }));
  return Object.freeze({
    items: Object.freeze(items),
    selectedId: raw.selectedId || null,
    selectedDetail: normalizeThemeDetail(raw.selectedDetail),
    updatedAt: raw.updatedAt || null
  });
}
