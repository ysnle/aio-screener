// P1417 (owner request 2026-10-03, open-source comparison): sub-theme relative strength. The
// reference (xang1234/stock-screener group rankings) averages per-stock 1-99 RS ratings built from
// fixed horizon weights (0.2/0.3/0.2/0.15/0.15). Those weights are a composite rating, which this
// screener does not publish (owner decision: evidence and state, no ungrounded grade). Instead a
// group is described by the MEDIAN return of its members over one chosen window, ranked against the
// other groups, with the S&P 500 return beside it. Direction compares the group's 1-month rank with
// its 3-month rank (the RRG idea of momentum against the longer trend) — no stored history needed.
// Members come from the curated THEME_MAP; a symbol without published returns is not counted.

export const GROUP_STRENGTH_MODEL_VERSION = 'theme-group-strength.v1';
export const GROUP_WINDOWS = Object.freeze({ ret1m: '1개월', ret3m: '3개월', ret6m: '6개월' });
export const MIN_GROUP_MEMBERS = 3;

const finite = (value) => (value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);

export function median(values) {
  const list = values.filter((value) => value != null).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

function rankBy(groups, key) {
  const ranked = groups.filter((group) => group[key] != null).sort((a, b) => b[key] - a[key]);
  const ranks = new Map();
  ranked.forEach((group, index) => ranks.set(group.id, index + 1));
  return ranks;
}

/**
 * @param {{ themes: Array, rows: Array<{sym:string,name?:string,ret1m?:number,ret3m?:number,ret6m?:number,pctSma50?:number}>, sortKey?: 'ret1m'|'ret3m'|'ret6m', benchmark?: {ret1m?:number,ret3m?:number,ret6m?:number} }} input
 */
export function buildGroupStrength({ themes = [], rows = [], sortKey = 'ret3m', benchmark = {} } = {}) {
  const key = GROUP_WINDOWS[sortKey] ? sortKey : 'ret3m';
  const bySymbol = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const groups = [];
  const excluded = [];
  for (const theme of Array.isArray(themes) ? themes : []) {
    for (const sub of Array.isArray(theme?.subThemes) ? theme.subThemes : []) {
      const tickers = [...new Set((sub?.tickers || []).map((sym) => String(sym).toUpperCase()))];
      const members = tickers.map((sym) => bySymbol.get(sym)).filter((row) => row && finite(row[key]) != null);
      const id = `${theme.id}:${sub.name}`;
      if (members.length < MIN_GROUP_MEMBERS) { excluded.push({ id, themeName: theme.nameKr, name: sub.name, members: members.length, listed: tickers.length }); continue; }
      const above = members.filter((row) => finite(row.pctSma50) != null);
      const leader = [...members].sort((a, b) => finite(b[key]) - finite(a[key]))[0];
      groups.push({
        id, themeId: theme.id, themeName: theme.nameKr, name: sub.name,
        members: members.length, listed: tickers.length,
        ret1m: median(members.map((row) => finite(row.ret1m))),
        ret3m: median(members.map((row) => finite(row.ret3m))),
        ret6m: median(members.map((row) => finite(row.ret6m))),
        above50Pct: above.length ? Math.round(above.filter((row) => finite(row.pctSma50) > 0).length / above.length * 100) : null,
        leader: leader ? { sym: String(leader.sym).toUpperCase(), name: leader.name || '', value: finite(leader[key]) } : null
      });
    }
  }
  const rank1m = rankBy(groups, 'ret1m');
  const rank3m = rankBy(groups, 'ret3m');
  const rankSort = rankBy(groups, key);
  const total = groups.length;
  const bench = finite(benchmark?.[key]);
  const out = groups.map((group) => {
    const r1 = rank1m.get(group.id) ?? null;
    const r3 = rank3m.get(group.id) ?? null;
    // Direction: a 1-month rank clearly better (lower) than the 3-month rank is improving momentum.
    const shift = r1 != null && r3 != null ? r3 - r1 : null;
    const band = Math.max(3, Math.round(total * 0.15));
    const direction = shift == null ? null : shift >= band ? 'improving' : shift <= -band ? 'weakening' : 'steady';
    return { ...group, rank: rankSort.get(group.id) ?? null, rank1m: r1, rank3m: r3, direction, vsBenchmark: group[key] != null && bench != null ? group[key] - bench : null };
  }).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
  // Theme level (all sub-theme members once), used where a layer links to a whole theme.
  const themeSummary = {};
  for (const theme of Array.isArray(themes) ? themes : []) {
    const tickers = [...new Set((theme?.subThemes || []).flatMap((sub) => sub?.tickers || []).map((sym) => String(sym).toUpperCase()))];
    const members = tickers.map((sym) => bySymbol.get(sym)).filter((row) => row && finite(row[key]) != null);
    themeSummary[theme.id] = { id: theme.id, name: theme.nameKr, members: members.length, value: members.length >= MIN_GROUP_MEMBERS ? median(members.map((row) => finite(row[key]))) : null };
  }
  return { model: GROUP_STRENGTH_MODEL_VERSION, sortKey: key, windowLabel: GROUP_WINDOWS[key], total, benchmark: bench, groups: out, excluded, themes: themeSummary };
}
