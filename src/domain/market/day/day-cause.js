// Why the session moved, as one model: every candidate cause of the day ledger (public-data/market-day.json) — a macro
// release, a linked headline, the sector that carried the index, a theme, a stock's pull — with the checks it was held
// to and one result: attributed (귀속), held (보류) or excluded (제외). The checks are rules on figures of the same
// session: a release is attributed only when the 2- and 10-year yields went the way its surprise points; a headline is
// held when it is an opinion, an unconfirmed report or rides a held release, and excluded when the same variable is
// cited both ways for moves of one direction; a theme whose median barely moved while one sub-theme alone went the other
// way is that sub-theme's move. The cross-asset divergences are the session-level check rows. The model states figures,
// fixed state words and results; what the move meant is the AI reading's.
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { shortDate } from '../../content/date-labels.js';
import { DAY_READ_WORDS } from '../../content/day-read-words.js';
import { RULES } from '../../rules/thresholds.js';
import { sectorLabel } from '../../screener/sector-label.js';
import { reportVerification } from '../../news/report-verification.js';
import { UP_WORDS, DOWN_WORDS } from '../../news/direction-words.js';
import { WORD_TOPICS } from './word-topics.js';

const WD = DAY_READ_WORDS.divergence;
const WC = DAY_READ_WORDS.catalysts;

/**
 * The lines. rateLineBp: a yield step under it is no direction (the divergence table's 10-year line, used for the 2-year
 * too); contributionBp: a stock's pull on the S&P 500 that counts (day-account pullSaid's line); flatPct and partGapPp:
 * a theme median under one session move is flat, a sub-theme that far from it moved on its own (RULES.sessionRead).
 */
export const CAUSE_LINES = Object.freeze({ rateLineBp: 3, contributionBp: 5, stocksMax: 3, flatPct: RULES.sessionRead.movePct, partGapPp: RULES.sessionRead.partGapPp });
export const CATALYST_RANKS = Object.freeze(['lead', 'major']);
export const CATALYSTS_MAX = 3;

/** The fixed words: the three results and the reason each check gives. */
export const CAUSE_WORDS = Object.freeze({
  label: '원인 판정',
  release: '발표와 반응',
  alternative: '다른 후보',
  result: Object.freeze({ attributed: '귀속', held: '보류', excluded: '제외' }),
  reason: Object.freeze({
    'rates-with': '금리 같은 방향', 'rates-against': '금리 반대', 'rates-flat': '금리 변화 작음', 'rates-missing': '금리 자료 대기', 'no-forecast': '예상치 없음', 'in-line': '예상 부합',
    opinion: '발언', unconfirmed: '미확인 보도', 'two-way': '양방향 인용', 'release-held': '발표 귀속 보류', reported: '보도',
    'part-only': '하위 테마만', whole: '테마 전반', contribution: '지수 기여'
  })
});

const MOVE_KINDS = new Set(['price', 'stock-move', 'group-move']);
const RATE_LEGS = Object.freeze(['tnx', 'dgs2']);
// The variables a headline can cite as a reason (the ledger's own word topics) and the prices that are those variables:
// a headline linked only to its variable's own price reports that move, it does not explain another.
const VARIABLE_ASSETS = Object.freeze({ rates: ['tnx', 'dgs2'], inflation: ['breakeven10'], energy: ['wti', 'brent'], metals: ['gold', 'silver'], credit: ['hyOas', 'igOas', 'cccOas'], fx: ['dxy', 'usdjpy', 'usdkrw'], crypto: ['btc'], jobs: [] });
// An interview or a person's remark, not an announcement: a view verb, or "says" after a person's role ("Russia says"
// and "minister says" are a government's statement and stay reports).
const OPINION_EN = /\b(?:thinks?|believes?|interview|podcast|op-ed)\b|\b(?:ceo|chief executive|founder|chairman|analyst|strategist|investor|billionaire)\b[^,;:]{0,40}\b(?:says?|said)\b/i;
const OPINION_KO = /(?<![가-힣])인터뷰(?:에서|서)?(?![가-힣])|(?:라고|다고)\s?말했다(?![가-힣])/;
// Labour figures where a higher print is the weaker economy.
const WEAKER_WHEN_HIGHER = /\b(?:unemployment|jobless)\b|(?<![가-힣])실업/i;

const priceOf = (day, asset, date) => (day.facts || []).find((row) => row?.kind === 'price' && row.asset === asset && row.date === date && Number.isFinite(row.change)) || null;
const unitOf = (fact) => (fact.changeUnit === 'bp' || fact.unit === 'bp' ? 'bp' : 'pct');
const priceClaim = (fact, label = fact.label) => claim({ subject: fact.asset, measure: 'change1d', asOf: fact.date, figures: [{ value: fact.change, unit: unitOf(fact), basis: 'change1d', label }] });
const pointsClaim = (subject, value, asOf, label) => claim({ subject, measure: 'indexContribution', asOf, figures: [{ value, unit: 'pp', basis: 'indexContribution', label }] });

// ── the session-level checks: two figures of one session that went the way a reader would not expect ──
const price = (asset) => (day, date) => {
  const fact = priceOf(day, asset, date);
  return fact ? { value: fact.change, unit: unitOf(fact), label: WD.names[asset], subject: asset, measure: 'change1d' } : null;
};
const sector = (name, key) => (day, date) => {
  const row = day.indexSplit?.date === date ? (day.indexSplit.sectors || []).find((item) => item?.sector === name) : null;
  return row && Number.isFinite(row.change) ? { value: row.change, unit: 'pct', label: WD.names[key], subject: `sector:${name}`, measure: 'sectorChange1d' } : null;
};
const hotInflation = (day, date) => {
  const fact = (day.facts || []).find((row) => row?.kind === 'release' && row.date === date && (row.topics || []).includes('inflation')
    && Number.isFinite(row.actual) && Number.isFinite(row.forecast) && row.actual > row.forecast);
  return fact ? { release: fact } : null;
};

/**
 * The divergence rows: `a` and `b` read the two legs, `fires(a, b)` holds each to its line — 3bp on the 10-year, 1% on the
 * S&P 500, 0.3% on the dollar, 1% on gold, 2% on WTI, 0.5% on the energy sector; spreads "no wider" is at most +1bp.
 */
export const DIVERGENCE_RULES = Object.freeze([
  Object.freeze({ id: 'hot-inflation-yields-down', a: hotInflation, b: price('tnx'), fires: (a, b) => b.value <= -CAUSE_LINES.rateLineBp }),
  Object.freeze({ id: 'stocks-down-credit-calm', a: price('spx'), b: price('hyOas'), fires: (a, b) => a.value <= -1 && b.value <= 1 }),
  Object.freeze({ id: 'dollar-down-gold-down', a: price('dxy'), b: price('gold'), fires: (a, b) => a.value <= -0.3 && b.value <= -1 }),
  Object.freeze({ id: 'oil-up-energy-down', a: price('wti'), b: sector('Energy', 'energy'), fires: (a, b) => a.value >= 2 && b.value <= -0.5 })
]);

function releaseSaid(fact) {
  const unit = fact.unit === '%' ? 'rate' : 'level';
  const figure = (value, label) => ({ value, unit, digits: Number.isInteger(value) ? 0 : 1, basis: 'release', label });
  const c = claim({ subject: fact.id, measure: 'release', asOf: fact.date, figures: [figure(fact.actual, fact.label), ...(Number.isFinite(fact.forecast) ? [figure(fact.forecast, '예상')] : [])] });
  return Number.isFinite(fact.forecast) ? say(WD.release, { name: fact.label, actual: c, forecast: say('{c.1}', { c }) }) : say('{name} {c}', { name: fact.label, c });
}
function legSaid(leg, date) {
  if (leg.release) return releaseSaid(leg.release);
  return say('{c.label} {c}', { c: claim({ subject: leg.subject, measure: leg.measure, asOf: date, figures: [{ value: leg.value, unit: leg.unit, basis: leg.measure, label: leg.label }] }) });
}
function divergencesOf(day, asOf) {
  const out = [];
  for (const rule of DIVERGENCE_RULES) {
    const a = rule.a(day, asOf), b = rule.b(day, asOf);
    if (!a || !b || !rule.fires(a, b)) continue;
    const said = say(WD.said, { d: shortDate(asOf), a: legSaid(a, asOf), b: legSaid(b, asOf) });
    if (said.text) out.push({ id: rule.id, date: asOf, said });
  }
  return out;
}

// ── candidates ──
// The sector that carried the S&P 500 the index's way (indexSplit), the alternative a held release points to.
function leadSector(day, asOf) {
  const split = day.indexSplit;
  if (split?.date !== asOf || !Array.isArray(split.sectors) || !Number.isFinite(split.total) || !split.total) return null;
  const way = Math.sign(split.total);
  const lead = split.sectors.filter((row) => Number.isFinite(row?.contribution)).sort((a, b) => way * (b.contribution - a.contribution))[0];
  return lead && way * lead.contribution > 0 ? lead : null;
}
const sectorSaid = (row, asOf) => say('{name} {c}', { name: sectorLabel(row.sector), c: pointsClaim(`sector:${row.sector}`, row.contribution, asOf, sectorLabel(row.sector)) });

// The yields' side a surprise points to: a hotter print (inflation, payrolls) +1, a higher unemployment print -1.
function releaseSide(fact) {
  const topics = fact.topics || [];
  if (topics.includes('inflation')) return 1;
  if (topics.includes('jobs')) return WEAKER_WHEN_HIGHER.test(`${fact.label || ''} ${fact.id || ''}`) ? -1 : 1;
  return 0;
}

function releaseCandidate(day, fact, asOf) {
  const side = releaseSide(fact);
  const surprise = Number.isFinite(fact.actual) && Number.isFinite(fact.forecast) ? Math.sign(fact.actual - fact.forecast) : null;
  // Each yield leg of the release's own session; a FRED 2-year a day behind is no leg (자료 대기), never a neighbour's value.
  const legs = RATE_LEGS.map((asset) => priceOf(day, asset, fact.date)).filter(Boolean)
    .map((leg) => ({ leg, way: Math.abs(leg.change) < CAUSE_LINES.rateLineBp ? 0 : Math.sign(leg.change) * side * surprise }));
  const outcome = surprise === null || !side ? 'no-forecast' : surprise === 0 ? 'in-line' : !legs.length ? 'rates-missing'
    : legs.some((row) => row.way < 0) && !legs.some((row) => row.way > 0) ? 'rates-against'
      : legs.some((row) => row.way > 0) && !legs.some((row) => row.way < 0) ? 'rates-with' : 'rates-flat';
  const alt = outcome === 'rates-against' ? leadSector(day, asOf) : null;
  return {
    id: fact.id, kind: 'release', subject: fact.label, date: fact.date, topics: fact.topics || [],
    checks: [{ id: 'rates', outcome, legs: legs.map(({ leg, way }) => ({ asset: leg.asset, change: leg.change, date: leg.date, way })) }],
    result: outcome === 'rates-with' ? 'attributed' : 'held', reason: outcome,
    said: say('{d} {release}{legs}', { d: shortDate(fact.date), release: releaseSaid(fact), legs: legs.length ? say(', {list}', { list: sayJoin(legs.map(({ leg }) => say('{c.label} {c}', { c: priceClaim(leg) })), ', ') }) : NOTHING }),
    alternative: alt ? { id: `sector:${alt.sector}`, said: sectorSaid(alt, asOf) } : null
  };
}

const titleOf = (fact) => `${fact.title || ''} ${fact.titleKo || ''}`;
function statementOf(fact) {
  const text = titleOf(fact);
  if (reportVerification(text) !== 'reported' || fact.verification === 'unconfirmed') return 'unconfirmed';
  return OPINION_EN.test(fact.title || '') || OPINION_KO.test(fact.titleKo || '') ? 'opinion' : 'reported';
}
// A headline's clauses ("Stocks fall | as oil prices rise"): its English joints and punctuation.
const CLAUSE_JOINTS = /\s(?:as|after|amid|on|while|despite|with)\s|[,;:]/i;
// The one variable a headline cites and the one direction its own clause gives it, else null.
function citedOf(fact) {
  const found = new Map();
  for (const clause of String(fact.title || fact.titleKo || '').split(CLAUSE_JOINTS)) {
    const vars = WORD_TOPICS.filter(([topic, re]) => Object.hasOwn(VARIABLE_ASSETS, topic) && re.test(clause)).map(([topic]) => topic);
    const up = UP_WORDS.test(clause), down = DOWN_WORDS.test(clause);
    if (vars.length === 1 && up !== down) found.set(vars[0], (found.get(vars[0]) || new Set()).add(up ? 1 : -1));
  }
  const [variable, ways] = found.size === 1 ? [...found][0] : [];
  return ways?.size === 1 ? { variable, way: [...ways][0] } : null;
}

function headlineCandidates(day, asOf, heldTopics) {
  const byId = new Map(day.facts.map((fact) => [fact?.id, fact]));
  const linked = new Map();
  for (const link of Array.isArray(day.links) ? day.links : []) {
    const move = byId.get(link?.to);
    if (!move || !MOVE_KINDS.has(move.kind) || move.date !== asOf) continue;
    linked.set(link.from, [...(linked.get(link.from) || []), move]);
  }
  const rows = day.facts.filter((fact) => fact?.kind === 'headline' && fact.date === asOf && linked.has(fact.id)).map((fact) => {
    const moves = linked.get(fact.id);
    const cited = citedOf(fact);
    // The moves it is cited for: not its own variable's price; their side is the most material one's.
    const reasons = cited ? moves.filter((move) => !(move.kind === 'price' && VARIABLE_ASSETS[cited.variable].includes(move.asset))) : [];
    const lead = [...reasons].sort((a, b) => Number(b.materiality || 0) - Number(a.materiality || 0))[0];
    return { fact, moves, cited: cited && lead && Math.sign(lead.change) ? { ...cited, side: Math.sign(lead.change) } : null, statement: statementOf(fact) };
  });
  // A variable cited up and down for moves of one direction explains neither.
  const ways = new Map();
  for (const row of rows) if (row.cited) {
    const key = `${row.cited.variable}:${row.cited.side}`;
    ways.set(key, (ways.get(key) || new Set()).add(row.cited.way));
  }
  return rows.map(({ fact, moves, cited, statement }) => {
    const twoWay = !!cited && ways.get(`${cited.variable}:${cited.side}`).size > 1;
    const rideHeld = (fact.wordTopics || []).some((topic) => heldTopics.has(topic));
    const reason = twoWay ? 'two-way' : statement !== 'reported' ? statement : rideHeld ? 'release-held' : 'reported';
    return {
      id: fact.id, kind: 'headline', subject: fact.subjects?.[0] || null, date: fact.date, rank: fact.rank, materiality: fact.materiality,
      title: fact.titleKo && !fact.titleKoFailed ? String(fact.titleKo).trim() : '', moves: moves.map((move) => move.id),
      checks: [{ id: 'statement', outcome: statement }, { id: 'two-way', outcome: twoWay ? 'two-way' : cited ? 'one-way' : 'none', variable: cited?.variable || null }, { id: 'release', outcome: rideHeld ? 'release-held' : 'none' }],
      result: twoWay ? 'excluded' : reason === 'reported' ? 'attributed' : 'held', reason
    };
  });
}

// A theme whose median is flat while exactly one sub-theme went against all the others, that far from the median.
function loneSubTheme(fact) {
  const parts = (Array.isArray(fact.parts) ? fact.parts : []).filter((part) => part?.name && Number.isFinite(part.change) && part.change);
  if (Math.abs(fact.change) >= CAUSE_LINES.flatPct || parts.length < 2) return null;
  const lone = parts.filter((part) => parts.every((other) => other === part || Math.sign(other.change) !== Math.sign(part.change)));
  return lone.length === 1 && Math.abs(lone[0].change - fact.change) >= CAUSE_LINES.partGapPp ? lone[0] : null;
}
function groupCandidates(day, asOf) {
  return day.facts.filter((fact) => fact?.kind === 'group-move' && fact.date === asOf && String(fact.group || '').startsWith('theme:') && Number.isFinite(fact.change)).flatMap((fact) => {
    const part = loneSubTheme(fact);
    if (!part && !CATALYST_RANKS.includes(fact.rank)) return [];
    const whole = claim({ subject: fact.id, measure: 'groupChange1d', asOf, figures: [{ value: fact.change, unit: 'pct', basis: 'groupChange1d', label: fact.label }] });
    const said = part ? say('{name} {m}({part} {p})', { name: fact.label, m: whole, part: part.name, p: claim({ subject: `${fact.id}/${part.name}`, measure: 'groupChange1d', asOf, figures: [{ value: part.change, unit: 'pct', basis: 'groupChange1d', label: part.name }] }) })
      : say('{name} {m}', { name: fact.label, m: whole });
    return [{ id: fact.id, kind: 'group', subject: part ? `${fact.label}/${part.name}` : fact.label, date: asOf, materiality: fact.materiality,
      checks: [{ id: 'within', outcome: part ? 'part-only' : 'whole', part: part?.name || null }], result: 'attributed', reason: part ? 'part-only' : 'whole', said }];
  });
}

function shareCandidates(day, asOf) {
  const out = [];
  const lead = leadSector(day, asOf);
  if (lead) out.push({ id: `sector:${lead.sector}`, kind: 'sector', subject: lead.sector, date: asOf, checks: [{ id: 'contribution', outcome: 'contribution', value: lead.contribution }], result: 'attributed', reason: 'contribution', said: sectorSaid(lead, asOf) });
  const way = Math.sign(priceOf(day, 'spx', asOf)?.change || day.indexSplit?.total || 0);
  const stocks = day.facts.filter((fact) => fact?.kind === 'stock-move' && fact.date === asOf && Number.isFinite(fact.indexBp) && Math.abs(fact.indexBp) >= CAUSE_LINES.contributionBp && Math.sign(fact.indexBp) === way)
    .sort((a, b) => Math.abs(b.indexBp) - Math.abs(a.indexBp)).slice(0, CAUSE_LINES.stocksMax);
  for (const fact of stocks) {
    out.push({ id: fact.id, kind: 'stock', subject: fact.subjects?.[0] || fact.label, date: asOf, checks: [{ id: 'contribution', outcome: 'contribution', value: fact.indexBp / 100 }], result: 'attributed', reason: 'contribution',
      said: say('{sym} {c}', { sym: fact.subjects?.[0] || fact.label, c: pointsClaim(`stock:${fact.subjects?.[0]}`, fact.indexBp / 100, asOf, 'S&P 500') }) });
  }
  return out;
}

/**
 * @param {object|null} day market-day.json
 * @param {string} [asOf] the basis US session (the ledger's own by default)
 * @returns {{asOf: string|null, candidates: object[], divergences: Array<{id, date, said}>}}
 */
export function dayCause(day, asOf = day?.sessions?.us) {
  if (!asOf || day?.sessions?.us !== asOf || !Array.isArray(day.facts)) return { asOf: asOf || null, candidates: [], divergences: [] };
  const releases = day.facts.filter((fact) => fact?.kind === 'release' && fact.date === asOf).map((fact) => releaseCandidate(day, fact, asOf));
  const heldTopics = new Set(releases.filter((row) => row.reason === 'rates-against').flatMap((row) => row.topics.filter((topic) => topic === 'inflation' || topic === 'jobs')));
  return { asOf, candidates: [...releases, ...headlineCandidates(day, asOf, heldTopics), ...groupCandidates(day, asOf), ...shareCandidates(day, asOf)], divergences: divergencesOf(day, asOf) };
}

/** The session's cross-asset divergences (the AI facts' 엇갈림 rows). */
export const sessionDivergences = (day, asOf) => dayCause(day, asOf).divergences;

/** The catalysts: the attributed headlines graded at least major, by the ledger's materiality, with their Korean title. */
export function sessionCatalysts(day, asOf, { max = CATALYSTS_MAX } = {}) {
  const items = dayCause(day, asOf).candidates.filter((row) => row.kind === 'headline' && row.result === 'attributed' && CATALYST_RANKS.includes(row.rank) && row.title)
    .sort((a, b) => Number(b.materiality || 0) - Number(a.materiality || 0)).slice(0, max)
    .map((row) => ({ id: row.id, date: row.date, title: row.title, materiality: row.materiality, moves: row.moves }));
  return items.length ? { items, said: sayJoin(items.map((item) => say(WC.item, { d: shortDate(item.date), title: item.title })), ' · ') } : { items: [], said: NOTHING };
}

/** The headlines of the ledger's session the model did not attribute (held or excluded): never a move's face report. */
export const unattributedHeadlines = (day) => new Set(dayCause(day).candidates.filter((row) => row.kind === 'headline' && row.result !== 'attributed').map((row) => row.id));
