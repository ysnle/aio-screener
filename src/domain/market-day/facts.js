// v59.63 phase 1 (owner 2026-11-03: "예를 들어 설명하는 걸 그대로 옮기지 말고 구조적으로 파악해서 분석하고 연결"): one
// ledger of what happened in the last day, built from the artifacts the producers already publish, in one shape every
// screen and the AI reading can select from by its own role. A fact is a move (an index, an asset, a stock, a group) or
// an event (a headline, a reported quarter, a deal, an analyst action, a release, a dated event). Nothing here names a
// company, a date or a level by hand: what is unusual is decided by the size of a move against its own recent
// volatility, and what a move is linked to is decided by shared subjects (the same ticker, a member of the same group)
// or a shared topic. A move with no subject link is kept and marked unexplained instead of being given a guessed cause.
import { readNumber, surprisePct } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { sessionCloses } from '../market/index-levels.js';
import { closeSessionMarket } from '../market/close-series.js';
import { countOpenSessionsBetween } from '../market/market-calendar.js';
import { companyMatcher } from '../briefing/news-picks.js';
import { SCHEDULED_EVENTS } from '../briefing/scheduled-events.js';
import { EVENT_NAMES } from '../market/macro-crossroads.js';

export const MARKET_DAY_VERSION = 'market-day.v1';
const HOUR = 3600000;
const DAY = 24 * HOUR;

// Prices and levels read from history.json (session-keyed closes). `unit` bp means the field is a yield in percent.
// v59.70 (lens plan step 7): `unit` names the change, not the value — 4.123 with unit 'bp' is a 4.123% level that moved in
// bp. Each price fact also carries valueUnit ('%' level, 'level' price or index) and changeUnit ('bp' or 'pct'); `unit`
// stays for artifacts already published and their readers.
export const ASSETS = Object.freeze([
  ['spx', 'S&P 500', 'index', ['equity-us']], ['ndx', '나스닥100', 'index', ['equity-us', 'ai-semis']],
  ['soxx', '반도체(SOXX)', 'index', ['ai-semis']], ['rut', '러셀2000', 'index', ['equity-us', 'small-caps']],
  ['rsp', 'S&P 500 동일가중', 'index', ['equity-us', 'breadth']], ['kospi', '코스피', 'index', ['korea']],
  ['kosdaq', '코스닥', 'index', ['korea']], ['vix', 'VIX', 'volatility', ['volatility']],
  ['tnx', '미국 10년 금리', 'rate', ['rates'], 'bp'], ['dxy', '달러지수', 'fx', ['fx']], ['usdkrw', '원/달러', 'fx', ['fx', 'korea']],
  ['usdjpy', '엔/달러', 'fx', ['fx']], ['wti', 'WTI 유가', 'commodity', ['energy']], ['brent', '브렌트 유가', 'commodity', ['energy']],
  ['gold', '금', 'commodity', ['metals']], ['silver', '은', 'commodity', ['metals']], ['btc', '비트코인', 'crypto', ['crypto']]
].map(([field, label, kind, topics, unit = 'pct']) => Object.freeze({ field, label, kind, topics, unit })));

// FRED series (macro-history.json, observations [[day, value]]); every one is a percent level, read in bp.
export const MACRO_SERIES = Object.freeze([
  ['hyOas', '하이일드 스프레드', ['credit']], ['cccOas', 'CCC 스프레드', ['credit']], ['igOas', '투자등급 스프레드', ['credit']],
  ['dgs2', '미국 2년 금리', ['rates']], ['realYield10', '10년 실질금리', ['rates']], ['breakeven10', '10년 기대인플레', ['rates', 'inflation']]
].map(([id, label, topics]) => Object.freeze({ id, label, topics })));

// A news feed topic (scripts/lib/news-selection.mjs) as the ledger's topics; the headline's own words add more below.
const NEWS_TOPICS = Object.freeze({ macro: ['macro'], semi: ['ai-semis'], geo: ['geopolitics', 'energy'], fxbond: ['rates', 'fx'], credit: ['credit'],
  energy: ['energy'], crypto: ['crypto'], healthcare: ['healthcare'], korea: ['korea'], kr: ['korea'], equity: ['equity-us'], analyst: ['equity-us'], earnings: ['earnings'] });
const WORD_TOPICS = Object.freeze([
  ['rates', /\b(?:fed|fomc|powell|treasury yields?|bond yields?|rate cuts?|rate hikes?)\b|금리|국채/i],
  ['inflation', /\b(?:inflation|cpi|pce|ppi)\b|물가/i], ['jobs', /\b(?:payrolls?|jobs report|unemployment|jobless)\b|고용|실업/i],
  ['energy', /\b(?:oil|crude|opec|brent|wti|natural gas)\b|(?<![가-힣])유가(?!증권)|원유/i], ['metals', /\b(?:gold|silver|copper)\b|금값|은값|구리/i],
  ['credit', /\b(?:credit spreads?|junk bonds?|high yield|private credit|defaults?)\b|신용|회사채/i],
  ['ai-semis', /\b(?:ai|chips?|semiconductors?|nvidia|data cent(?:er|re)s?|hbm|gpu)\b|반도체|인공지능/i],
  ['politics', /\b(?:midterms?|elections?|congress|senate|tariffs?|shutdown)\b|선거|관세/i],
  ['deal', /\b(?:acquir(?:e|es|ed|ing)|acquisition|merger|takeover|buyout|all-stock)\b|인수|합병/i],
  ['earnings', /\b(?:earnings|quarterly results|guidance|revenue)\b|실적|가이던스/i], ['fx', /\b(?:dollar index|strong dollar|weak dollar|greenback|yen|yuan|currenc(?:y|ies))\b|환율|달러(?:화|지수|인덱스|\s?강세|\s?약세)|엔화|원화/i],
  ['korea', /\b(?:kospi|kosdaq|korea|samsung|sk hynix)\b|코스피|코스닥|삼성|하이닉스/i], ['crypto', /\b(?:bitcoin|crypto|ether(?:eum)?)\b|비트코인/i]
]);

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;
const stdev = (values) => { if (values.length < 10) return null; const m = mean(values); return Math.sqrt(mean(values.map((v) => (v - m) ** 2))) || null; };
const round = (value, digits = 2) => (Number.isFinite(value) ? Number(value.toFixed(digits)) : null);
const stampOf = (row) => Date.parse(row?.publishedAt || row?.pubDate || row?.datetime || row?.eventTime || '');
const topicsOf = (text, base = []) => [...new Set([...base, ...WORD_TOPICS.filter(([, re]) => re.test(text)).map(([topic]) => topic)])];

/** A change and how unusual it is: the last step against the standard deviation of the 60 steps before it. */
function changeOf(series, unit) {
  if (series.length < 12) return null;
  const steps = series.slice(1).map((row, i) => (unit === 'bp' ? (row.value - series[i].value) * 100 : (row.value / series[i].value - 1) * 100));
  const last = steps.at(-1);
  const sd = stdev(steps.slice(-61, -1));
  const week = series.length >= 6 ? (unit === 'bp' ? (series.at(-1).value - series.at(-6).value) * 100 : (series.at(-1).value / series.at(-6).value - 1) * 100) : null;
  return { change: round(last), week: round(week), z: sd ? round(last / sd) : null };
}

function priceFacts(history) {
  const out = [];
  for (const asset of ASSETS) {
    const series = sessionCloses(history, asset.field);
    const move = changeOf(series, asset.unit);
    if (!move) continue;
    const last = series.at(-1);
    // v59.70 (screen review 7·8): a day move is one session. A close the producer carried forward drops out of the series,
    // and the step over the gap (WTI 10/30→11/3, 나스닥100 the same) read as that day's -7.7% / -0.7%; no fact then.
    if (countOpenSessionsBetween(series.at(-2).date, last.date, closeSessionMarket(asset.field) || 'US') !== 1) continue;
    out.push({ id: `price:${asset.field}:${last.date}`, kind: 'price', asset: asset.field, label: asset.label, assetKind: asset.kind, date: last.date,
      value: round(last.value, asset.unit === 'bp' ? 3 : 2), unit: asset.unit, valueUnit: asset.unit === 'bp' ? '%' : 'level', changeUnit: asset.unit, ...move, topics: asset.topics, subjects: [], weight: Math.abs(move.z ?? 0) });
  }
  return out;
}

function macroFacts(macroHistory) {
  const out = [];
  for (const series of MACRO_SERIES) {
    const rows = (macroHistory?.series?.[series.id]?.observations || []).map(([date, value]) => ({ date, value: readNumber(value) })).filter((row) => row.value !== null);
    const move = changeOf(rows, 'bp');
    if (!move) continue;
    const last = rows.at(-1);
    out.push({ id: `price:${series.id}:${last.date}`, kind: 'price', asset: series.id, label: series.label, assetKind: 'macro', date: last.date,
      value: round(last.value, 3), unit: 'bp', valueUnit: '%', changeUnit: 'bp', ...move, topics: series.topics, subjects: [], weight: Math.abs(move.z ?? 0) });
  }
  return out;
}

// A stock move is kept when it is large for the stock itself (|1-day| at least 4% and 1.5 times its average daily range)
// on a name liquid enough to matter, or when it moved the S&P 500 by 5bp or more (index weight % x return %): NVDA -3% is
// -23bp of the index and matters more than a small cap's -20%. The 30 by materiality.
function stockFacts(screener, universe, themesBySymbol, indexWeights) {
  const rows = [];
  const session = screener?.factorSessionDateByMarket?.US || null;
  for (const item of universe) {
    const row = screener?.data?.[item.sym];
    const ret = readRowNumber(row, 'ret1d'); const adr = readRowNumber(row, 'adrPct'); const dv = readRowNumber(row, 'dollarVolume30d');
    if (ret === null || !(adr > 0) || !(dv >= 2e8) || /\.K[SQ]$/.test(item.sym) || item.sector === 'ETF') continue; // an ETF is a price, not a company
    const z = ret / adr;
    const indexWeight = indexWeights.get(item.sym) || 0;
    const indexBp = indexWeight * ret; // weight in %, return in % -> basis points of the index
    if (!((Math.abs(ret) >= 4 && Math.abs(z) >= 1.5) || Math.abs(indexBp) >= 5)) continue;
    rows.push({ id: `stock:${item.sym}:${session}`, kind: 'stock-move', subjects: [item.sym], label: item.name || item.sym, sector: item.sector || null,
      themes: themesBySymbol.get(item.sym) || [], date: session, change: round(ret), week: round(readRowNumber(row, 'ret5d')), z: round(z), rvol: round(readRowNumber(row, 'rvol20')),
      indexWeight: indexWeight || null, indexBp: indexWeight ? round(indexBp, 1) : null, dollarVolume30d: dv, topics: [], weight: Math.abs(z) });
  }
  return rows;
}

// A group (a theme of the app's map, or a GICS-style sector) moved when the median member moved 2% or more and at least
// 70% of its members with a 1-day return moved the same way.
function groupFacts(screener, universe, themes) {
  const session = screener?.factorSessionDateByMarket?.US || null;
  const retOf = (sym) => readRowNumber(screener?.data?.[sym], 'ret1d');
  const groups = [
    ...themes.map((theme) => ({ id: `theme:${theme.id}`, label: theme.nameKr, members: theme.leaders || [] })),
    ...[...new Set(universe.map((item) => item.sector).filter(Boolean))].map((sector) => ({ id: `sector:${sector}`, label: sector, members: universe.filter((item) => item.sector === sector && !/\.K[SQ]$/.test(item.sym)).map((item) => item.sym) }))
  ];
  const out = [];
  for (const group of groups) {
    const moves = group.members.map((sym) => [sym, retOf(sym)]).filter(([, ret]) => ret !== null);
    if (moves.length < 4) continue;
    const sorted = moves.map(([, ret]) => ret).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const same = moves.filter(([, ret]) => Math.sign(ret) === Math.sign(median)).length / moves.length;
    if (Math.abs(median) < 2 || same < 0.7) continue;
    const lead = [...moves].sort((a, b) => Math.sign(median) * (b[1] - a[1])).slice(0, 3);
    out.push({ id: `group:${group.id}:${session}`, kind: 'group-move', group: group.id, label: group.label, date: session, change: round(median), share: round(same * 100, 0),
      members: moves.map(([sym]) => sym), leaders: lead.map(([sym, ret]) => ({ sym, change: round(ret) })), subjects: [], topics: [], weight: Math.abs(median) / 2 });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 16);
}

function earningsFacts(calendar, nowMs, namesBySymbol) {
  const out = [];
  for (const row of Array.isArray(calendar?.earnings) ? calendar.earnings : []) {
    const at = Date.parse(`${row?.date}T12:00:00Z`);
    if (!row?.symbol || !Number.isFinite(at)) continue;
    const reported = readNumber(row.epsActual) !== null || readNumber(row.revenueActual) !== null;
    const surprise = surprisePct;
    const weight = readNumber(row.indexWeight) || 0;
    if (reported && at >= nowMs - 3 * DAY && at <= nowMs + DAY) {
      out.push({ id: `earnings:${row.symbol}:${row.date}`, kind: 'earnings', subjects: [row.symbol], label: namesBySymbol.get(row.symbol) || row.symbol, date: row.date, hour: row.hour || null,
        epsSurprise: surprise(row.epsActual, row.epsEstimate), revenueSurprise: surprise(row.revenueActual, row.revenueEstimate), indexWeight: weight || null, topics: ['earnings'], weight: 1 + weight });
    } else if (!reported && at >= nowMs - 12 * HOUR && at <= nowMs + 7 * DAY && (weight >= 0.3 || namesBySymbol.has(row.symbol))) {
      out.push({ id: `upcoming:earnings:${row.symbol}:${row.date}`, kind: 'upcoming', event: 'earnings', subjects: [row.symbol], label: namesBySymbol.get(row.symbol) || row.symbol,
        date: row.date, hour: row.hour || null, indexWeight: weight || null, topics: ['earnings'], weight: weight });
    }
  }
  // Reported quarters: the index-weighted ones and every one whose stock moved (moved is added by the caller), at most 30.
  const upcoming = out.filter((fact) => fact.kind === 'upcoming').sort((a, b) => b.weight - a.weight).slice(0, 15);
  return [...out.filter((fact) => fact.kind === 'earnings'), ...upcoming];
}

function scheduleFacts(macroCalendar, nowMs) {
  const out = [];
  const alias = { 'us-fomc': 'us-fed-rate' };
  for (const [rawId, dates] of Object.entries(macroCalendar?.schedules || {})) {
    const id = alias[rawId] || rawId;
    for (const date of Array.isArray(dates) ? dates : []) {
      const at = Date.parse(`${date}T13:30:00Z`);
      if (!EVENT_NAMES[id] || !(at >= nowMs - 12 * HOUR && at <= nowMs + 10 * DAY)) continue;
      out.push({ id: `upcoming:${id}:${date}`, kind: 'upcoming', event: id, label: EVENT_NAMES[id], date, subjects: [],
        topics: id === 'us-nfp' ? ['jobs', 'rates'] : ['us-cpi', 'us-pce'].includes(id) ? ['inflation', 'rates'] : ['rates', 'macro'], weight: 2 });
    }
  }
  for (const event of SCHEDULED_EVENTS) {
    const at = Date.parse(event.atKst);
    if (!(at >= nowMs - 2 * DAY && at <= nowMs + 10 * DAY)) continue;
    out.push({ id: `event:${event.id}`, kind: at <= nowMs ? 'event' : 'upcoming', event: event.id, label: event.storyTitle || event.label, date: event.marketDate || event.atKst.slice(0, 10),
      why: event.why, subjects: [], topics: ['politics'], weight: event.major ? 3 : 1 });
  }
  return out;
}

const SIGNAL_TOPICS = { deal: ['deal'], pt: ['analyst'], macro: ['macro'], retail: ['positioning'] };
function signalFacts(signals, nowMs) {
  const since = new Date(nowMs - 2 * DAY).toISOString().slice(0, 10);
  const out = [];
  const analyst = new Map();
  for (const signal of Array.isArray(signals) ? signals : []) {
    if (!signal?.kind || String(signal.date || '') < since) continue;
    if (signal.kind === 'deal') {
      out.push({ id: `deal:${signal.acquirer}:${signal.target}`, kind: 'deal', subjects: [signal.acquirer, signal.target], acquirer: signal.acquirer, target: signal.target, date: signal.date,
        payment: signal.payment, ratio: signal.ratio, valueUsd: signal.valueUsd, premiumPct: signal.premiumPct, topics: ['deal'], weight: 3, src: { kind: 'telegram', post: signal.post } });
    } else if (signal.kind === 'pt' && signal.ticker) {
      const row = analyst.get(signal.ticker) || { raise: 0, cut: 0, other: 0, date: signal.date };
      row[signal.direction === 'raise' ? 'raise' : signal.direction === 'cut' ? 'cut' : 'other'] += 1;
      if (String(signal.date) > row.date) row.date = signal.date;
      analyst.set(signal.ticker, row);
    } else if (signal.kind === 'macro') {
      out.push({ id: `release:${signal.key}`, kind: 'release', label: signal.name, date: signal.date, actual: signal.actual, forecast: signal.forecast, previous: signal.previous, unit: signal.unit,
        surprise: signal.surprise, subjects: [], topics: topicsOf(`${signal.name} ${signal.nameEn || ''}`, SIGNAL_TOPICS.macro), weight: 2, src: { kind: 'telegram', post: signal.post } });
    } else if (signal.kind === 'retail') {
      out.push({ id: `positioning:${signal.key}`, kind: 'positioning', label: '서학개미 순매수', date: signal.date, side: signal.side, leveragedLongShare: signal.leveragedLongShare,
        inverseShare: signal.inverseShare, top: (signal.top || []).slice(0, 3).map((row) => row.name), subjects: [], topics: ['positioning'], weight: 1, src: { kind: 'telegram', post: signal.post } });
    }
  }
  for (const [ticker, row] of analyst) {
    out.push({ id: `analyst:${ticker}:${row.date}`, kind: 'analyst', subjects: [ticker], date: row.date, raises: row.raise, cuts: row.cut, others: row.other, topics: ['analyst'], weight: (row.raise + row.cut) / 2 });
  }
  return out;
}

// Headlines of the selected bundle (data.json news + newsIntraday) inside the last 36 hours. A headline names a company
// only through companyMatcher (its ticker as a word or its proper name); the topic is the feed's plus the words'.
const matchersOf = (universe) => universe.filter((item) => !/\.K[SQ]$/.test(item.sym)).map((item) => [item.sym, companyMatcher(item.sym, item.name)]).filter(([, re]) => re);
function headlineFacts(news, matchers, nowMs) {
  const seen = new Set();
  const out = [];
  for (const row of Array.isArray(news) ? news : []) {
    const at = stampOf(row);
    const key = row?.link || row?.title;
    if (!row?.title || !Number.isFinite(at) || at < nowMs - 36 * HOUR || at > nowMs + HOUR || seen.has(key)) continue;
    seen.add(key);
    const subjects = matchers.filter(([, re]) => re.test(row.title)).map(([sym]) => sym).slice(0, 4);
    out.push({ id: `headline:${row.guid || row.sourceArticleId || key}`.slice(0, 120), kind: 'headline', title: row.title, titleKo: row.titleKo || null, at: new Date(at).toISOString(), date: new Date(at).toISOString().slice(0, 10),
      subjects, topics: topicsOf(row.title, NEWS_TOPICS[row.topic] || []), wordTopics: topicsOf(row.title), tier: readNumber(row.tier), score: readNumber(row.score),
      src: { kind: 'news', source: row.source || null, link: row.link || null }, weight: (readNumber(row.score) || 0) / 50 });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 150);
}

// The screener's per-company headlines (screener.json newsMemo, "[MM-DD] title · [MM-DD] title", stamped newsTs) for the
// stocks that moved: the bundle keeps 40 market-wide rows, so a company's own story ("Marvell To Buy Lumentum …") was
// often only here. A memo older than 36 hours is not today's reason.
function memoFacts(screener, symbols, nowMs, matchers = []) {
  const out = [];
  for (const sym of symbols) {
    const row = screener?.data?.[sym];
    const at = Date.parse(row?.newsTs || row?.newsObservedAt || '');
    if (!row?.newsMemo || !Number.isFinite(at) || at < nowMs - 36 * HOUR || at > nowMs + HOUR) continue;
    String(row.newsMemo).split(' · ').map((part) => part.replace(/^\[\d{2}-\d{2}\]\s*/, '').trim()).filter(Boolean).slice(0, 2).forEach((title, i) => {
      out.push({ id: `memo:${sym}:${i}:${new Date(at).toISOString().slice(0, 10)}`, kind: 'headline', title, at: new Date(at).toISOString(), date: new Date(at).toISOString().slice(0, 10),
        subjects: [...new Set([sym, ...matchers.filter(([, re]) => re.test(title)).map(([other]) => other)])].slice(0, 4), topics: topicsOf(title, ['equity-us']), wordTopics: topicsOf(title), tier: null, score: null, src: { kind: 'company-news', sources: (row.newsMemoSources || []).slice(0, 2) }, weight: 1 });
    });
  }
  return out;
}

function briefFacts(briefs, nowMs) {
  return (Array.isArray(briefs?.briefs) ? briefs.briefs : [])
    .filter((brief) => brief?.symbol && Date.parse(`${brief.eventDate}T12:00:00Z`) >= nowMs - 3 * DAY)
    .map((brief) => ({ id: `brief:${brief.id}`, kind: 'brief', subjects: [brief.symbol], label: brief.nameKo || brief.symbol, date: brief.eventDate, briefId: brief.id,
      topics: ['earnings'], weight: 1, src: { kind: brief.source?.kind || 'official', title: brief.source?.title || null } }));
}

// The price a group's earnings depend on (theme ids of js/aio-pages.js THEME_MAP, sectors of screener-universe.json).
// Rates-sensitive groups are left out: utilities and real estate fall with higher yields, so their sign is reversed.
export const GROUP_DRIVERS = Object.freeze({ 'theme:energy': 'wti', 'sector:Energy': 'wti', 'theme:crypto': 'btc', 'theme:semiconductor': 'soxx', 'theme:photonics': 'soxx', 'theme:ai_infra': 'soxx' });

const MOVE_KINDS = new Set(['price', 'stock-move', 'group-move']);
const CAUSE_KINDS = new Set(['headline', 'earnings', 'brief', 'deal', 'analyst', 'release', 'event']);

/**
 * Links, each { from: cause id, to: move id, basis }:
 *  - subject: the cause names the moved stock;
 *  - member: the cause names a member of the moved group (or a stock the deal joins);
 *  - peer: two stock moves the same way inside one theme (one story moving a chain);
 *  - topic: a cause on the moved asset's topic (prices of indexes and assets only; weaker, never "explains" a stock).
 */
function linkFacts(facts) {
  const links = [];
  const moves = facts.filter((fact) => MOVE_KINDS.has(fact.kind));
  const causes = facts.filter((fact) => CAUSE_KINDS.has(fact.kind));
  for (const move of moves) {
    const own = move.kind === 'stock-move' ? move.subjects : move.kind === 'group-move' ? move.members : [];
    const hits = [];
    for (const cause of causes) {
      // A group is linked through the members that led it (its three largest moves the group's way), not any of its
      // hundreds of members: a sector of 300 names would otherwise absorb every report of the day.
      const named = cause.subjects?.some((sym) => (move.kind === 'group-move' ? move.leaders.some((lead) => lead.sym === sym) : own.includes(sym)));
      if (named) { hits.push({ from: cause.id, to: move.id, basis: move.kind === 'stock-move' ? 'subject' : 'member', w: cause.weight + 2 }); continue; }
      if (move.kind === 'price' && cause.kind !== 'analyst' && cause.topics?.some((topic) => move.topics.includes(topic))) hits.push({ from: cause.id, to: move.id, basis: 'topic', w: cause.weight });
    }
    links.push(...hits.sort((a, b) => b.w - a.w).slice(0, 5).map(({ w, ...link }) => link));
  }
  // driver: a group whose earnings run on one price (energy producers on crude, miners on bitcoin, chip names on the chip
  // index) moved the same way as that price, which itself moved at least one of its standard deviations.
  const prices = new Map(moves.filter((move) => move.kind === 'price').map((move) => [move.asset, move]));
  const driverOf = (groupIds) => groupIds.map((id) => GROUP_DRIVERS[id]).find(Boolean);
  for (const move of moves.filter((m) => m.kind !== 'price')) {
    const ids = move.kind === 'group-move' ? [move.group] : [...move.themes.map((id) => `theme:${id}`), `sector:${move.sector}`];
    const price = prices.get(driverOf(ids));
    if (price && price.id !== move.id && Math.abs(price.z ?? 0) >= 1 && Math.sign(price.change) === Math.sign(move.change)) links.push({ from: price.id, to: move.id, basis: 'driver' });
  }
  const stocks = moves.filter((move) => move.kind === 'stock-move');
  for (let i = 0; i < stocks.length; i += 1) for (let j = i + 1; j < stocks.length; j += 1) {
    const [a, b] = [stocks[i], stocks[j]];
    if (Math.sign(a.change) === Math.sign(b.change) && a.themes.some((theme) => b.themes.includes(theme))) links.push({ from: a.id, to: b.id, basis: 'peer' });
  }
  for (const group of moves.filter((move) => move.kind === 'group-move')) {
    for (const stock of stocks) if (group.members.includes(stock.subjects[0]) && Math.sign(group.change) === Math.sign(stock.change)) links.push({ from: stock.id, to: group.id, basis: 'member' });
  }
  return links;
}

// Threads: facts joined by subject, member and peer links (topic links are too broad to join a story). Each thread is
// ranked by the weight of its moves and named by its largest move.
function threadsOf(facts, links) {
  const parent = new Map(facts.map((fact) => [fact.id, fact.id]));
  const find = (id) => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id); } return id; };
  for (const link of links) if (link.basis !== 'topic' && parent.has(link.from) && parent.has(link.to)) parent.set(find(link.from), find(link.to));
  const groups = new Map();
  for (const fact of facts) { const root = find(fact.id); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(fact); }
  return [...groups.values()].filter((members) => members.length >= 2 && members.some((fact) => MOVE_KINDS.has(fact.kind)))
    .map((members) => {
      const moves = members.filter((fact) => MOVE_KINDS.has(fact.kind)).sort((a, b) => b.weight - a.weight);
      return { id: `thread:${moves[0].id}`, lead: moves[0].id, facts: members.map((fact) => fact.id), weight: round(moves.reduce((sum, fact) => sum + fact.weight, 0)),
        kinds: [...new Set(members.map((fact) => fact.kind))] };
    })
    .sort((a, b) => b.weight - a.weight).slice(0, 12);
}

// ── Materiality (owner 2026-11-03: "경중을 따져서 중요한 데이터는 중요한 곳에 … 쓸모없는 정보를 중요한 것처럼 하지 말아줘") ──
// Each fact gets 0–100 from what it is worth to the market, never from how loudly it is written:
//  - a price: its move against its own volatility, a core gauge (the index, the 10-year, the dollar, oil, gold, HY
//    spread, VIX, KOSPI) counting fully and a secondary one at 70%;
//  - a stock: the larger of its own surprise (|z| scaled by liquidity) and its pull on the S&P 500 (index bp);
//  - a group: its median move times how one-sided it was; a reported quarter: index weight and surprise; a deal: its
//    size; an upcoming item: index weight, or the release's standing (jobs, CPI, FOMC, PCE) or a major dated event;
//  - a headline or report: its source tier, raised to part of the largest move it is linked to (a story is as important
//    as what it moved). Machine-written stock-page items are noise and leave the ledger.
// Tiers: lead >= 60, major >= 35, minor >= 15, below that the fact is context only.
const CORE_GAUGES = new Set(['spx', 'ndx', 'kospi', 'tnx', 'dxy', 'wti', 'gold', 'hyOas', 'vix']);
const MAJOR_RELEASES = new Set(['us-nfp', 'us-cpi', 'us-fed-rate', 'us-pce']);
export const HEADLINE_NOISE = /\b(?:stock forecasts?|price, chart|tokenized (?:stock|bstock)s?|price \([A-Z]+\/USD\) today|outperforms competitors|underperforms (?:\w+ )?when compared to competitors|(?:sells|buys) \$[\d,]+ (?:in|of|worth)|executes (?:sale|purchase) of|position in|stake (?:raised|lowered|trimmed|boosted)|shares (?:sold|bought|acquired) by|stock quote|stock price today|should you buy)\b/i;
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
let NOW_MS = Date.now();
const nearness = (fact) => { const days = (Date.parse(`${fact.date}T12:00:00Z`) - NOW_MS) / DAY; return days <= 2 ? 1 : Math.max(1 / 3, 1 - (days - 2) / 12); };
function ownMateriality(fact) {
  switch (fact.kind) {
    case 'price': return clamp(Math.abs(fact.z ?? 0) * 25 * (CORE_GAUGES.has(fact.asset) ? 1 : 0.7));
    case 'stock-move': {
      const liquidity = Math.max(0.3, Math.min(1, Math.log10((fact.dollarVolume30d || 1e8) / 1e8) / 2));
      return clamp(Math.max(Math.abs(fact.z) * 18 * liquidity, Math.abs(fact.indexBp || 0) * 3));
    }
    case 'group-move': return clamp(Math.abs(fact.change) * 10 * (fact.share / 100));
    case 'earnings': return clamp(15 + 6 * (fact.indexWeight || 0) + Math.min(15, Math.abs(fact.epsSurprise || 0) / 2));
    case 'deal': return clamp(fact.valueUsd >= 5e10 ? 75 : fact.valueUsd >= 1e10 ? 60 : 40);
    // An upcoming item counts fully inside two days and fades to a third by ten days out.
    case 'upcoming': return clamp((fact.event === 'earnings' ? 15 + 6 * (fact.indexWeight || 0) + (fact.movingNow ? 25 : 0) : MAJOR_RELEASES.has(fact.event) ? 65 : fact.weight >= 3 ? 70 : 35) * nearness(fact));
    case 'event': return clamp(fact.weight >= 3 ? 70 : 35);
    case 'release': return 45;
    case 'positioning': return 30;
    case 'analyst': return clamp(8 * ((fact.raises || 0) + (fact.cuts || 0)));
    case 'brief': return 20;
    case 'headline': return fact.tier === 1 ? 25 : fact.tier === 2 ? 18 : fact.src?.kind === 'company-news' ? 15 : 10;
    default: return 10;
  }
}
const SHARE_OF_MOVE = { subject: 0.8, member: 0.7, driver: 0.8, topic: 0.4 };
function scoreMateriality(facts, links) {
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  for (const fact of facts) fact.materiality = ownMateriality(fact);
  for (const link of links) {
    const cause = byId.get(link.from); const move = byId.get(link.to);
    if (!cause || !move || !SHARE_OF_MOVE[link.basis] || MOVE_KINDS.has(cause.kind)) continue;
    cause.materiality = Math.max(cause.materiality, clamp(move.materiality * SHARE_OF_MOVE[link.basis]));
  }
  for (const fact of facts) fact.rank = fact.materiality >= 60 ? 'lead' : fact.materiality >= 35 ? 'major' : fact.materiality >= 15 ? 'minor' : 'context';
}

/**
 * @param {object} input
 * @param {object[]} input.history history.json rows
 * @param {object} input.screener screener.json ({ data, factorSessionDateByMarket })
 * @param {object[]} input.universe screener-universe.json `universe` ({ sym, name, sector })
 * @param {object[]} input.news data.json news + newsIntraday
 * @param {object[]} input.signals telegram-digest.json signals
 * @param {object} input.calendar earnings-calendar.json
 * @param {object} input.briefs event-briefs.json
 * @param {object} input.macroHistory macro-history.json
 * @param {object} input.macroCalendar macro-calendar.json
 * @param {object[]} input.themes the theme map ({ id, nameKr, leaders })
 * @param {object[]} input.indexWeights sp500-weights.json rows ({ sym, weight in % })
 */
export function buildMarketDay({ history = [], screener = null, universe = [], news = [], signals = [], calendar = null, briefs = null, macroHistory = null,
  macroCalendar = null, themes = [], indexWeights = [], nowMs = Date.now() } = {}) {
  const themesBySymbol = new Map();
  for (const theme of themes) for (const sym of theme.leaders || []) themesBySymbol.set(sym, [...(themesBySymbol.get(sym) || []), theme.id]);
  const namesBySymbol = new Map(universe.map((item) => [item.sym, item.name || item.sym]));
  const weights = new Map((Array.isArray(indexWeights) ? indexWeights : []).map((row) => [String(row.sym || '').replace('.', '-'), readNumber(row.weight) || 0]));
  const matchers = matchersOf(universe);
  const candidates = [
    ...priceFacts(history), ...macroFacts(macroHistory), ...stockFacts(screener, universe, themesBySymbol, weights), ...groupFacts(screener, universe, themes),
    ...briefFacts(briefs, nowMs), ...signalFacts(signals, nowMs), ...scheduleFacts(macroCalendar, nowMs), ...headlineFacts(news, matchers, nowMs)
  ];
  const moved = new Set(candidates.filter((fact) => fact.kind === 'stock-move').flatMap((fact) => fact.subjects)
    .concat(candidates.filter((fact) => fact.kind === 'group-move').flatMap((fact) => fact.leaders.map((lead) => lead.sym))));
  candidates.push(...memoFacts(screener, [...moved], nowMs, matchers));
  const reported = earningsFacts(calendar, nowMs, namesBySymbol);
  candidates.push(...reported.filter((fact) => fact.kind === 'upcoming'),
    ...reported.filter((fact) => fact.kind === 'earnings' && (fact.indexWeight >= 0.1 || moved.has(fact.subjects[0]))));
  NOW_MS = nowMs;
  // A report due from a company that is already moving (its stock or a group it leads) is the next test of that move.
  for (const fact of candidates) if (fact.kind === 'upcoming' && fact.event === 'earnings' && moved.has(fact.subjects[0])) fact.movingNow = true;
  const noise = candidates.filter((fact) => fact.kind === 'headline' && HEADLINE_NOISE.test(fact.title));
  let facts = candidates.filter((fact) => !noise.includes(fact));
  scoreMateriality(facts, linkFacts(facts));
  // The most material of the open-ended kinds are kept; every price, group, event and upcoming item stays.
  const CAPS = { 'stock-move': 30, headline: 50, earnings: 30, analyst: 15 };
  const kept = new Set();
  // Headlines: at most two per company, so four rewrites of one story do not fill the list.
  const perSubject = new Map();
  for (const [kind, cap] of Object.entries(CAPS)) {
    facts.filter((fact) => fact.kind === kind).sort((a, b) => b.materiality - a.materiality).filter((fact) => {
      if (kind !== 'headline' || !fact.subjects.length) return true;
      if (fact.subjects.some((sym) => (perSubject.get(sym) || 0) >= 2)) return false;
      for (const sym of fact.subjects) perSubject.set(sym, (perSubject.get(sym) || 0) + 1);
      return true;
    }).slice(0, cap).forEach((fact) => kept.add(fact.id));
  }
  facts = facts.filter((fact) => !CAPS[fact.kind] || kept.has(fact.id));
  const links = linkFacts(facts);
  scoreMateriality(facts, links);
  // explainedBy: how a move is tied to a reason — its own news (subject/member) or the price it runs on (driver). A move
  // with neither is kept and says so; a peer or topic link alone explains nothing.
  for (const fact of facts) if (fact.kind === 'stock-move' || fact.kind === 'group-move') {
    fact.explainedBy = [...new Set(links.filter((link) => link.to === fact.id && ['subject', 'member', 'driver'].includes(link.basis)).map((link) => link.basis))];
  }
  for (const fact of facts) { if (fact.kind === 'price') fact.unusual = Math.abs(fact.z ?? 0) >= 2; fact.weight = fact.materiality; }
  facts.sort((a, b) => b.materiality - a.materiality);
  return {
    schemaVersion: MARKET_DAY_VERSION, generatedAt: new Date(nowMs).toISOString(),
    sessions: { us: screener?.factorSessionDateByMarket?.US || null, kr: screener?.factorSessionDateByMarket?.KR || null },
    rules: 'materiality 0-100 (lead>=60, major>=35, minor>=15); price z = last step / sd of the 60 before; stock move |1d|>=4% and >=1.5x ADR on $200M+ volume, or >=5bp of the S&P 500; group median >=2% with 70% same sign; headlines 36h; machine-written stock-page items dropped',
    counts: Object.fromEntries([...new Set(facts.map((fact) => fact.kind))].map((kind) => [kind, facts.filter((fact) => fact.kind === kind).length])),
    dropped: { noise: noise.length },
    facts, links, threads: threadsOf(facts, links)
  };
}
