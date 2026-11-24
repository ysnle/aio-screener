import { EXPOSURE_TAGS, US_THEME_PROFILES, windFor, WIND_LABELS } from '../scenarios/exposures.js';
import { formatUsdRevenue, earningsFilterMs, reportedNumber, dedupeEarningsRows } from './schedule.js';
import { isIsoDay } from '../shared/session-date.js';
import { scenarioLead } from '../market/regime/scenario-lead.js';

// A scenario is named only when the headline's own words are about what that branch tracks
// (src/domain/market/regime/macro-crossroads.js branch ids); a branch without a term list is never named.
export const SCENARIO_TITLE_TERMS = Object.freeze({
  reheat: /inflation|\bCPI\b|\bPCE\b|price pressure|hot(?:ter)? prices|물가|인플레/i,
  softland: /inflation|\bCPI\b|\bPCE\b|payrolls?|jobs report|unemployment|soft landing|물가|인플레|고용|실업|연착륙/i,
  slowdown: /payrolls?|jobless|jobs report|layoffs?|unemployment|recession|고용|실업|해고|감원|침체/i,
  oilshock: /\boil\b|crude|\bOPEC|\bBrent\b|\bWTI\b|gasoline|유가|원유|휘발유/i,
  creditstress: /credit spread|high[- ]yield|junk bond|default|private credit|bankrupt|신용|부도|회사채|파산|사모 대출/i,
  dollarsurge: /\bdollar\b(?! (?:tree|general|store))|\bDXY\b|greenback|달러 강세|달러 지수|강달러/i,
  reflation: /\bGDP\b|economic growth|retail sales|\bISM\b|\bPMI\b|성장률|소매판매|경기 확장/i,
  aibust: /\bAI (?:spending|capex|bubble|trade|stocks?|sell-?off|infrastructure|investment|boom)|\b(?:spending|capex|bubble|sell-?off)\b.{0,40}\bAI\b|data cent(?:er|re)s?|hyperscalers?|neoclouds?|\bcapex\b|AI (?:투자|거품|버블)|데이터센터|설비투자/i,
  fiscalsteep: /long-term (?:yield|rate)|30-year|10-year|term premium|deficit|bond auction|treasury yields?|장기 금리|국채 금리|재정 적자|국채 입찰/i,
  volshock: /\bVIX\b|volatility|sell-?off|\brout\b|변동성|급락|투매/i
});
const AXIS_WORDS = Object.freeze({ reheat: '물가', softland: '물가·고용', slowdown: '고용', oilshock: '유가', creditstress: '신용', dollarsurge: '달러', reflation: '성장', aibust: 'AI 투자', fiscalsteep: '장기 금리', volshock: '변동성' });
const short = (item) => String(item?.title || '').split(' — ')[0];

/** The lead and alternative branches of the shared model, in that order; tied branches are each '동률', with no alternative. */
export function liveBranches(xr) {
  const lead = scenarioLead(xr);
  if (lead.state === 'tie') return lead.items.map((item) => ({ item, role: '동률' }));
  const alt = lead.items.length && xr.altId ? (xr.items || []).find((branch) => branch.id === xr.altId) : null;
  return [[lead.items[0], '선두'], [alt, '대안']].filter(([item]) => item).map(([item, role]) => ({ item, role }));
}

/**
 * The event → impact chain for one headline: the axis it touches, the live branch it moves, the exposures that branch
 * burdens and helps, and what to check next (the branch's next dated trigger, else its standing check). Null when the
 * headline names no live branch's subject. `axes` (optional) keeps a feed off branches unrelated to it.
 */
export function newsImpactChain(words, xr, { axes = null } = {}) {
  for (const { item, role } of liveBranches(xr)) {
    if (axes && !(item.axes || []).some((axis) => axes.includes(axis))) continue;
    if (!SCENARIO_TITLE_TERMS[item.id]?.test(String(words || ''))) continue;
    const trigger = (item.triggers || [])[0];
    const check = trigger ? `${trigger.when}, ${trigger.text}` : (item.checks || [])[0] || null;
    // The first two exposure names (the label before its comma), with 등 when the list is longer.
    const names = (tags) => (Array.isArray(tags) && tags.length ? `${tags.slice(0, 2).map((tag) => String(EXPOSURE_TAGS[tag] || tag).split(',')[0]).join(', ')}${tags.length > 2 ? ' 등' : ''}` : null);
    const weaker = names(item.weaker);
    const firmer = names(item.firmer);
    const head = `${AXIS_WORDS[item.id] || '매크로'} → '${short(item)}'(${role}, ${item.fit})`;
    const parts = [head, weaker ? `부담: ${weaker}` : null, firmer ? `수혜: ${firmer}` : null, check ? `확인: ${check}` : null];
    return { branchId: item.id, role, branch: short(item), axis: AXIS_WORDS[item.id] || null, weaker, firmer, check, head, text: parts.filter(Boolean).join(' → ') };
  }
  return null;
}

// "2년물−기준금리 +0.82%p (금리 상단 쪽, <branch note>)" → "2년물−기준금리 +0.82%p (금리 상단 쪽)".
function gaugeText(text) {
  if (!text) return null;
  const hit = String(text).match(/^(2년물−기준금리 \S+) \((금리 상단 쪽|금리 하단 쪽|동결 부근)/);
  return hit ? `${hit[1]} (${hit[2]})` : String(text).split(' (')[0];
}
const MACRO_EVENT_IDS = new Set(['us-fed-rate', 'us-cpi', 'us-nfp', 'us-pce']);
/** The US theme ids whose sub-themes list `symbol` (THEME_MAP). */
function themesOf(themeMap, symbol) {
  return (Array.isArray(themeMap) ? themeMap : []).filter((theme) => (theme?.subThemes || []).some((sub) => (sub.tickers || []).some((t) => String(t).toUpperCase() === symbol)));
}

/**
 * Previews of the next market events within `days`: up to two macro releases (what the market is pricing where it is
 * collected — 2-year yield against the policy rate for the Fed; the prior print otherwise — and what each branch needs
 * from the release) and up to three of the heaviest earnings reports (consensus EPS and revenue, and whether the lead
 * branch reads the company's themes as a tailwind or headwind).
 */
export function eventPreviews({ xr = null, schedule = [], earnings = [], names = {}, themeMap = [], nowMs = Date.now(), days = 10 } = {}) {
  const horizon = nowMs + days * 86400000;
  const out = [];
  const live = liveBranches(xr);
  const roleOf = (id) => live.find((row) => row.item.id === id)?.role || null;
  const lastFor = (id) => (Array.isArray(schedule) ? schedule : []).find((row) => row.kind === 'macro' && String(row.id || '').startsWith(`macro:${id === 'us-fed-rate' ? 'us-fomc' : id}:`))?.last || null;
  for (const event of (xr?.events || []).filter((row) => MACRO_EVENT_IDS.has(row.id) && Number.isFinite(row.atMs) && row.atMs >= nowMs && row.atMs <= horizon).slice(0, 2)) {
    // The Fed line: the current upper bound and the 2-year gauge as the branches read it ("2년물−기준금리 +0.82%p (금리 상단 쪽)").
    const gauge = (xr.items || []).map((item) => item.pricing?.text).find((text) => /^2년물−기준금리/.test(String(text || '')));
    const expect = event.id === 'us-fed-rate'
      ? [String(xr.rateHub?.policy || '').split(/,| — /)[0] || null, gaugeText(gauge)].filter(Boolean)
      // Consensus is not a source this site collects, so its absence is not a line.
      : [lastFor(event.id)].filter(Boolean);
    const branches = (xr.items || []).map((item) => ({ item, trigger: (item.triggers || []).find((row) => row.id === event.id) })).filter((row) => row.trigger)
      .sort((a, b) => Number(!roleOf(a.item.id)) - Number(!roleOf(b.item.id)))
      .slice(0, 3).map(({ item, trigger }) => `${trigger.text}이면 '${short(item)}'${roleOf(item.id) ? `(${roleOf(item.id)})` : ''} 쪽`);
    out.push({ kind: 'macro', id: event.id, when: event.when, title: event.name, expect, branches,
      note: event.id === 'us-fed-rate' && xr.rateHub?.now ? '2년물과 기준금리의 차이는 시장 예상을 어림한 값이며 기간 프리미엄이 섞여 있습니다.' : null });
  }
  const lead = live.find((row) => row.role === '선두')?.item || null;
  const reports = dedupeEarningsRows(earnings).filter((row) => row?.symbol && names[row.symbol] && row.date && Number(row.indexWeight) > 0)
    .map((row) => ({ row, atMs: earningsFilterMs(row) }))
    .filter(({ row, atMs }) => Number.isFinite(atMs) && atMs >= nowMs - 6 * 3600000 && atMs <= horizon && reportedNumber(row.epsActual) == null && reportedNumber(row.revenueActual) == null)
    .sort((a, b) => Number(b.row.indexWeight) - Number(a.row.indexWeight)).slice(0, 3);
  for (const { row } of reports) {
    const eps = Number.isFinite(Number(row.epsEstimate)) && row.epsEstimate !== null && row.epsEstimate !== '' ? `EPS 예상 ${Number(row.epsEstimate).toFixed(2)}` : null;
    const revenue = formatUsdRevenue(row.revenueEstimate) ? `매출 예상 ${formatUsdRevenue(row.revenueEstimate)}` : null;
    const themes = themesOf(themeMap, row.symbol);
    const tags = [...new Set(themes.flatMap((theme) => US_THEME_PROFILES[theme.id]?.tags || []))];
    const wind = lead ? windFor(tags, lead) : 'none';
    const link = lead && wind !== 'none' && themes.length
      ? `선두 시나리오 '${short(lead)}'에서 이 회사의 테마(${themes.slice(0, 2).map((theme) => theme.nameKr || theme.id).join(', ')})는 ${WIND_LABELS[wind]} 쪽 — 실적과 가이던스가 그 가정을 확인하는지 봅니다.` : null;
    const [, m, d] = row.date.split('-').map(Number);
    out.push({ kind: 'earnings', id: `earnings:${row.symbol}`, when: `${m}/${d} 미국 ${row.hour === 'bmo' ? '장 전' : row.hour === 'amc' ? '장 마감 후' : '시간 미정'}`,
      title: `${names[row.symbol]} (${row.symbol}) 실적`, expect: [eps, revenue].filter(Boolean), branches: link ? [link] : [], note: null });
  }
  return out;
}

const SESSION_ORDER = Object.freeze({ bmo: 0, dmh: 1, amc: 2 });
const SESSION_LABEL = Object.freeze({ bmo: '장 전', dmh: '장중', amc: '장 마감 후' }); // dmh = Finnhub's during-market-hours, '장중' on the stock pages too
/**
 * The collected earnings week (earnings-calendar.json window), per US date and session, largest market value first: each
 * session shows `perSession` reports plus every watched or held one. Market value comes from the screener rows (mcap);
 * a report outside the universe ranks after them by its index weight, then its revenue estimate.
 */
export function buildEarningsWeek({ earnings = [], weekStart = null, weekEnd = null, rows = [], names = {}, watched = new Set(), held = new Set(), perSession = 8 } = {}) {
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const inside = (date) => isIsoDay(String(date || '')) && (!weekStart || date >= weekStart) && (!weekEnd || date <= weekEnd);
  const list = dedupeEarningsRows((Array.isArray(earnings) ? earnings : []).filter((row) => row?.symbol && inside(row.date))).map((row) => {
    const symbol = String(row.symbol).toUpperCase();
    const screener = bySym.get(symbol);
    const mcap = Number(screener?.mcap);
    const dollarEstimates = Number(row.indexWeight) > 0 || !!screener;
    const eps = dollarEstimates && row.epsEstimate != null && row.epsEstimate !== '' && Number.isFinite(Number(row.epsEstimate)) ? Number(row.epsEstimate) : null;
    return { symbol, name: String(names[symbol] || screener?.name || '').replace(/\s*\(The\)$/i, ''), date: row.date, session: ['bmo', 'dmh', 'amc'].includes(row.hour) ? row.hour : 'unknown',
      mcap: Number.isFinite(mcap) && mcap > 0 ? mcap : null, weight: Number(row.indexWeight) || 0, revenueEstimate: dollarEstimates ? Number(row.revenueEstimate) || 0 : 0,
      eps, revenue: dollarEstimates ? formatUsdRevenue(row.revenueEstimate) : null, watched: watched.has(symbol), held: held.has(symbol), reported: reportedNumber(row.epsActual) != null || reportedNumber(row.revenueActual) != null };
  });
  const rank = (a, b) => (b.mcap || 0) - (a.mcap || 0) || b.weight - a.weight || b.revenueEstimate - a.revenueEstimate || a.symbol.localeCompare(b.symbol);
  const dates = [...new Set(list.map((row) => row.date))].sort();
  const days = dates.map((date) => {
    const sessions = ['bmo', 'dmh', 'amc', 'unknown'].map((key) => {
      const all = list.filter((row) => row.date === date && row.session === key).sort(rank);
      if (!all.length) return null;
      const shown = [...all.slice(0, perSession), ...all.slice(perSession).filter((row) => row.watched || row.held)];
      return { key, label: SESSION_LABEL[key] || '시간 미정', count: all.length, rows: shown, hidden: all.length - shown.length };
    }).filter(Boolean).sort((a, b) => (SESSION_ORDER[a.key] ?? 3) - (SESSION_ORDER[b.key] ?? 3));
    return { date, count: sessions.reduce((sum, row) => sum + row.count, 0), sessions };
  });
  return { total: list.length, sp500: list.filter((row) => row.weight > 0).length, mine: list.filter((row) => row.watched || row.held), days, weekStart, weekEnd };
}
