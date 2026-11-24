// What the market investigation follows (scripts/producer/market-investigation.mjs). Pure: no I/O, no names of days,
// tickers or events. The market-day ledger (src/domain/market/day/facts.js) already sizes every price, stock and group
// move against its own recent volatility and ranks it by materiality; a lead is a move at the ledger's lead tier on the
// latest session, or a rule word (overall verdict, diagnosis, rebound, a scenario's condition count) that differs from the
// previous session's. A quiet session yields no lead, and the investigation then asks nothing.
import { RULES } from '../../rules/thresholds.js';
import { readNumber, signedText } from '../../shared/number.js';

const LIMIT = RULES.investigation;
const LEAD_TIER = RULES.moveMateriality.tiers.lead;
const MOVE_KINDS = Object.freeze(['price', 'stock-move', 'group-move']);
const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

/** A ledger move as one fact line: label, close date, the change, the five-session change and its size in the asset's own sd. */
export function moveLine(fact) {
  const change = readNumber(fact?.change);
  if (change == null) return '';
  const bp = fact.changeUnit === 'bp' || fact.unit === 'bp';
  const unit = bp ? 'bp' : '%';
  const digits = bp ? 0 : 2;
  const weekValue = readNumber(fact.week), zValue = readNumber(fact.z), shareValue = readNumber(fact.share);
  const week = weekValue != null ? `, 5거래일 ${signedText(weekValue, digits, unit)}` : '';
  const z = zValue != null ? `, 평소 하루 변동의 ${Math.abs(zValue).toFixed(1)}배` : '';
  const name = fact.kind === 'stock-move' ? `${fact.label || fact.subjects?.[0]} (${fact.subjects?.[0] || ''})` : fact.label;
  const leaders = fact.kind === 'group-move' && Array.isArray(fact.leaders) && fact.leaders.length
    ? ` · 앞선 종목 ${fact.leaders.slice(0, 3).map((row) => `${row.sym} ${signedText(row.change, 1, '%')}`).join(', ')}` : '';
  const share = fact.kind === 'group-move' && shareValue != null ? ` · 같은 방향 ${shareValue}%` : '';
  return `${name} ${md(fact.date)} 종가 ${signedText(change, digits, unit)}${week}${z}${share}${leaders}`;
}

/** The latest session of the ledger per market (its own `sessions`, else the newest move date). */
function latestSessions(day) {
  const us = day?.sessions?.us || null;
  const kr = day?.sessions?.kr || null;
  return { us, kr };
}

/** A move is on the latest session of its market; a macro series (weekly-leg credit, rates) is read at its latest observation. */
function onLatestSession(fact, sessions) {
  if (fact.kind === 'price' && fact.assetKind === 'macro') return true;
  const market = (fact.topics || []).includes('korea') && !(fact.topics || []).includes('equity-us') ? 'kr' : 'us';
  const session = sessions[market] || sessions.us;
  return !session || fact.date === session;
}

/**
 * The move leads: lead-tier moves of the latest session, largest first, at most maxPriceLeads prices, maxStockLeads
 * stocks and maxGroupLeads groups (a group whose members include a stock already led is the same story, not another).
 */
export function moveLeads(day) {
  const sessions = latestSessions(day);
  const weight = (fact) => readNumber(fact?.materiality) ?? 0;
  const facts = (Array.isArray(day?.facts) ? day.facts : [])
    .filter((fact) => fact && MOVE_KINDS.includes(fact.kind) && weight(fact) >= LEAD_TIER && onLatestSession(fact, sessions))
    .sort((a, b) => weight(b) - weight(a) ||MOVE_KINDS.indexOf(a.kind) - MOVE_KINDS.indexOf(b.kind) || String(a.id).localeCompare(String(b.id)));
  const caps = { price: LIMIT.maxPriceLeads, 'stock-move': LIMIT.maxStockLeads, 'group-move': LIMIT.maxGroupLeads };
  const taken = { price: 0, 'stock-move': 0, 'group-move': 0 };
  const stocks = new Set();
  const leads = [];
  for (const fact of facts) {
    if (taken[fact.kind] >= caps[fact.kind]) continue;
    if (fact.kind === 'group-move' && (fact.members || []).some((sym) => stocks.has(sym))) continue;
    if (fact.kind === 'stock-move') (fact.subjects || []).forEach((sym) => stocks.add(sym));
    taken[fact.kind] += 1;
    leads.push({ id: fact.id, kind: fact.kind, label: fact.label || fact.asset || fact.group || '', date: fact.date, materiality: weight(fact), text: moveLine(fact),
      subjects: Array.isArray(fact.subjects) ? fact.subjects.slice(0, 3) : [], topics: Array.isArray(fact.topics) ? fact.topics.slice(0, 4) : [] });
  }
  return leads;
}

/**
 * The rule words that decide what the screens say: { overall, diagnosis, rebound, scenarios: { id: 'met/total' } }. Built by
 * the producer from the shared interpretation; here only compared.
 */
export function stateLeads(current, prior) {
  if (!current || !prior?.words) return [];
  const before = prior.words;
  const out = [];
  const word = (key, title) => {
    const now = current[key] || null, then = before[key] || null;
    if (now && then && now !== then) out.push({ id: `state:${key}:${then}>${now}`, kind: 'state', label: title, date: null, materiality: LEAD_TIER, text: `${title}: ${prior.session ? `${md(prior.session)} ` : ''}${then} → 지금 ${now}`, subjects: [], topics: [] });
  };
  word('overall', '시장 상태 종합 판정');
  word('diagnosis', '하락 진단');
  word('rebound', '반등 판정');
  for (const [id, now] of Object.entries(current.scenarios || {})) {
    const then = before.scenarios?.[id];
    if (then && now && then !== now) out.push({ id: `state:scenario:${id}:${then}>${now}`, kind: 'state', label: current.scenarioTitles?.[id] || id, date: null, materiality: LEAD_TIER,
      text: `시나리오 '${current.scenarioTitles?.[id] || id}' 조건 충족 ${then} → ${now}`, subjects: [], topics: [] });
  }
  return out;
}

/**
 * The session's state record: the words of the session before (`prior`) stay until a new session closes, so a word that
 * changed is one lead for the whole session, not a new lead set on every refresh.
 */
export function nextStateRecord(previous, session, words) {
  const held = previous && typeof previous === 'object' ? previous : {};
  if (!session || !words) return held.current ? held : null;
  if (held.current?.session === session) return { prior: held.prior || null, current: { session, words } };
  return { prior: held.current || held.prior || null, current: { session, words } };
}

/**
 * { session, leads, quiet, keySource } for one refresh. `keySource` is the text the producer hashes: the US session and the
 * lead ids, so the same lead set never calls again and any new lead (a new session, a new mover, a changed word) does.
 */
export function selectLeads({ day = null, state = null } = {}) {
  const sessions = latestSessions(day);
  const moves = moveLeads(day);
  const words = stateLeads(state?.current?.words || null, state?.prior || null);
  const leads = [...moves, ...words].slice(0, LIMIT.maxLeads);
  // A move lead's id carries its own close date, so the Korean close re-keys only when it adds a Korean lead.
  return { session: sessions, leads, quiet: leads.length === 0, keySource: [sessions.us || '', ...leads.map((lead) => lead.id)].join('|') };
}
