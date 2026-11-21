// A theme word (방산, 우주/위성, defense) finds that theme's curated constituents, in the screener's search and
// in the chat's screen tool. The manual keyword aliases stay; theme members are added to them (union), never substituted.
export function mergeThemeAliases(aliases = {}, themes = []) {
  const merged = {};
  for (const [key, list] of Object.entries(aliases || {})) if (Array.isArray(list)) merged[key] = [...list];
  const add = (word, symbols) => {
    const keys = new Set([String(word || '').trim().toLowerCase()].flatMap((value) => [value, value.replace(/\s+/g, '')]).filter((value) => value.length >= 2));
    for (const key of keys) merged[key] = [...new Set([...(merged[key] || []), ...symbols])];
  };
  for (const theme of Array.isArray(themes) ? themes : []) {
    const subs = Array.isArray(theme?.subThemes) ? theme.subThemes : [];
    const members = [...new Set([...(theme?.leaders || []), ...subs.flatMap((sub) => sub?.tickers || [])].map((symbol) => String(symbol || '').toUpperCase()).filter(Boolean))];
    if (!members.length) continue;
    const name = String(theme?.nameKr || '');
    [theme?.id, name, ...name.split('/')].forEach((word) => add(word, members));
    for (const sub of subs) {
      const tickers = (sub?.tickers || []).map((symbol) => String(symbol || '').toUpperCase()).filter(Boolean);
      if (tickers.length) [sub?.name, ...String(sub?.name || '').split('/')].forEach((word) => add(word, tickers));
    }
  }
  return merged;
}
