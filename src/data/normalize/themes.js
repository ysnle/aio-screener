function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function normalizeThemes(raw = {}) {
  const items = (Array.isArray(raw.items) ? raw.items : []).map((item, index) => ({
    id: String(item?.id || item?.symbol || `theme-${index}`),
    symbol: String(item?.symbol || item?.id || ''),
    label: String(item?.label || item?.name || item?.symbol || 'Theme'),
    pct: finite(item?.pct),
    rsRatio: finite(item?.rsRatio),
    rsMomentum: finite(item?.rsMomentum),
    quadrant: String(item?.quadrant || 'neutral'),
    view: String(item?.view || 'sectors'),
    source: String(item?.source || 'themes-provider')
  }));
  return Object.freeze({ items: Object.freeze(items), selectedId: raw.selectedId || null, updatedAt: raw.updatedAt || new Date().toISOString() });
}
