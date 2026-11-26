// The read model of public-data/research-reference.json: market figures that no daily producer can collect cleanly
// (single-name credit, memory contract prices, fund flows and positioning). A person checks them once or twice a week
// from public pages and writes them by hand (owner decision 2026-11-26). Each row carries its own date, so the block
// never reads as one snapshot, and the rows explain the automated data beside them: they never enter a score, a table
// rank or a chart series.
//
// Ageing is per row, from the row's own asOf (Korean calendar day): past RESEARCH_STALE_DAYS the row stays with its
// date and a quiet 갱신 전 tag; past RESEARCH_DROP_DAYS it leaves the face. A row dated in the future, or one missing a
// field the schema requires, is not shown at all (the gate fails it before it ships).
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';
import { isIsoDay } from '../shared/session-date.js';
import { RESEARCH_WORDS } from './words.js';

export const RESEARCH_REFERENCE_SCHEMA = 'research-reference.v1';
// ai-financing, bank-lending and compute-price are the AI funding chain's researched links (domain/themes/ai-funding-chain.js).
export const RESEARCH_GROUP_IDS = Object.freeze(['credit-single-name', 'credit-market', 'memory-price', 'fund-flows', 'ai-financing', 'bank-lending', 'compute-price', 'rates-policy']);
export const RESEARCH_KINDS = Object.freeze(['observed', 'forecast']);
export const RESEARCH_STALE_DAYS = 10;
export const RESEARCH_DROP_DAYS = 21;
// A figure that is a period total or a quarterly forecast (a year's issuance to date, a contract-price outlook) stays true
// for longer than a market level; such an item names its own window in validDays, up to this many days.
export const RESEARCH_VALID_DAYS_MAX = 120;

// How each unit prints (through a claim figure) and how a row is set against its prior:
//   change 'bp'   the level moved in basis points (a yield in %, a spread in bp)
//   change 'pct'  the level moved in percent (a price, an index)
//   change null   the value is itself a flow or a rate of change: the prior is printed beside it instead of a difference
const UNIT_SPEC = Object.freeze({
  pct: { figure: (v) => ({ unit: 'rate', value: v, digits: 2 }), change: 'bp', toBp: (d) => d * 100 },
  bp: { figure: (v) => ({ unit: 'spread', value: v, digits: 0 }), change: 'bp', toBp: (d) => d },
  usd: { figure: (v) => ({ unit: 'perShare', value: v, digits: 2 }), change: 'pct' },
  // A flow (fund flows) is signed: money in prints "+", money out "-". An amount (a bond deal, a total) is not a flow.
  usdBn: { figure: (v) => ({ unit: 'usdChange', value: v * 1e9 }), change: null },
  amountUsdBn: { figure: (v) => ({ unit: 'usd', value: v * 1e9 }), change: 'pct' },
  index: { figure: (v) => ({ unit: 'level', value: v, digits: 2 }), change: 'pct' },
  level: { figure: (v) => ({ unit: 'level', value: v, digits: 2 }), change: 'pct' },
  price: { figure: (v) => ({ unit: 'level', value: v, digits: 2 }), change: 'pct' },
  // A whole-number quantity whose own unit is in the label (weeks of lead time).
  count: { figure: (v) => ({ unit: 'level', value: v, digits: 0 }), change: 'pct' },
  qoqPct: { figure: (v) => ({ unit: 'pct', value: v, digits: Number.isInteger(v) ? 0 : 1 }), change: null }
});
export const RESEARCH_UNITS = Object.freeze(Object.keys(UNIT_SPEC));

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const isRange = (range) => Array.isArray(range) && range.length === 2 && range.every(finite) && range[0] <= range[1];
const hasValue = (node) => node != null && Object.prototype.hasOwnProperty.call(node, 'value') && node.value != null;
const hasRange = (node) => node != null && Object.prototype.hasOwnProperty.call(node, 'range') && node.range != null;
/** Exactly one of value (a number) or range ([lo, hi], lo <= hi). */
const oneMeasure = (node) => (hasValue(node) !== hasRange(node)) && (hasValue(node) ? finite(node.value) : isRange(node.range));

/** The Korean calendar day of `nowMs` (the reader's day; asOf dates are written in it). */
export const kstDay = (nowMs = Date.now()) => new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/**
 * Every schema problem of the artifact, as short English strings (the gate prints them; the reader skips such rows).
 * An artifact with empty groups has none.
 */
export function researchReferenceProblems(artifact, { nowMs = Date.now() } = {}) {
  const problems = [];
  const today = kstDay(nowMs);
  if (!artifact || typeof artifact !== 'object') return ['artifact is not an object'];
  if (artifact.schemaVersion !== RESEARCH_REFERENCE_SCHEMA) problems.push(`schemaVersion is ${artifact.schemaVersion}, expected ${RESEARCH_REFERENCE_SCHEMA}`);
  if (!isIsoDay(artifact.checkedAt)) problems.push('checkedAt is not YYYY-MM-DD');
  else if (artifact.checkedAt > today) problems.push(`checkedAt ${artifact.checkedAt} is after today ${today}`);
  if (typeof artifact.method !== 'string' || !artifact.method.trim()) problems.push('method is missing');
  if (!Array.isArray(artifact.groups)) return [...problems, 'groups is not an array'];
  const seen = new Set();
  for (const group of artifact.groups) {
    if (!RESEARCH_GROUP_IDS.includes(group?.id)) problems.push(`unknown group id ${group?.id}`);
    if (typeof group?.title !== 'string' || !group.title.trim()) problems.push(`group ${group?.id} has no title`);
    if (!Array.isArray(group?.items)) { problems.push(`group ${group?.id} items is not an array`); continue; }
    for (const item of group.items) {
      const where = `${group.id}/${item?.id}`;
      if (typeof item?.id !== 'string' || !item.id) problems.push(`${group.id}: an item has no id`);
      else if (seen.has(item.id)) problems.push(`${where}: duplicate id`);
      seen.add(item?.id);
      if (typeof item?.label !== 'string' || !item.label.trim()) problems.push(`${where}: label missing`);
      if (item?.entity != null && !/^[A-Z0-9][A-Z0-9.-]{0,9}$/.test(String(item.entity))) problems.push(`${where}: entity is not a ticker`);
      if (!oneMeasure(item)) problems.push(`${where}: needs exactly one of a numeric value or a [lo, hi] range`);
      if (!UNIT_SPEC[item?.unit]) problems.push(`${where}: unknown unit ${item?.unit}`);
      if (!isIsoDay(item?.asOf)) problems.push(`${where}: asOf is not YYYY-MM-DD`);
      else if (item.asOf > today) problems.push(`${where}: asOf ${item.asOf} is after today ${today}`);
      if (item?.kind != null && !RESEARCH_KINDS.includes(item.kind)) problems.push(`${where}: kind must be observed or forecast`);
      if (item?.period != null && (typeof item.period !== 'string' || !item.period.trim())) problems.push(`${where}: period is not a string`);
      if (item?.prior != null) {
        if (!oneMeasure(item.prior)) problems.push(`${where}: prior needs exactly one of a numeric value or a range`);
        if (!isIsoDay(item.prior?.asOf)) problems.push(`${where}: prior.asOf is not YYYY-MM-DD`);
        else if (isIsoDay(item.asOf) && item.prior.asOf > item.asOf) problems.push(`${where}: prior.asOf is after asOf`);
      }
      if (item?.validDays != null && !(Number.isInteger(item.validDays) && item.validDays > RESEARCH_DROP_DAYS && item.validDays <= RESEARCH_VALID_DAYS_MAX)) problems.push(`${where}: validDays must be an integer above ${RESEARCH_DROP_DAYS} and at most ${RESEARCH_VALID_DAYS_MAX}`);
      if (item?.record != null && typeof item.record !== 'string') problems.push(`${where}: record is not a string`);
      if (typeof item?.note !== 'string' || !item.note.trim()) problems.push(`${where}: note missing`);
      if (typeof item?.sourceName !== 'string' || !item.sourceName.trim()) problems.push(`${where}: sourceName missing`);
      if (!/^https:\/\/[^\s]+$/.test(String(item?.sourceUrl || ''))) problems.push(`${where}: sourceUrl is not an https URL`);
    }
  }
  return problems;
}

function measureSaid(subject, unit, node, asOf, label) {
  const spec = UNIT_SPEC[unit];
  const figure = (value, part) => ({ ...spec.figure(value), basis: `research:${part}`, label });
  const measured = (figures) => claim({ subject, measure: `research:${unit}`, asOf, figures });
  // One claim for both ends, so the range prints its sign and unit once ("+8~13%").
  if (hasRange(node)) return say('{v.range}', { v: measured([figure(node.range[0], 'low'), figure(node.range[1], 'high')]) });
  return say('{v}', { v: measured([figure(node.value, 'value')]) });
}

function changeSaid(subject, item) {
  const prior = item.prior;
  if (!prior || !oneMeasure(prior) || !isIsoDay(prior.asOf)) return NOTHING;
  const spec = UNIT_SPEC[item.unit];
  const dated = claim({ subject, measure: 'research:priorAsOf', asOf: prior.asOf });
  // A difference only between two single values of a level unit; a flow, a rate of change or a range shows its prior.
  if (spec.change && hasValue(item) && hasValue(prior)) {
    const figure = spec.change === 'bp'
      ? { unit: 'bp', value: spec.toBp(item.value - prior.value), label: `${prior.asOf} 대비 변화` }
      : prior.value > 0 ? { unit: 'pct', value: (item.value / prior.value - 1) * 100, digits: 1, label: `${prior.asOf} 대비 변화율` } : null;
    if (!figure) return NOTHING;
    const moved = claim({ subject, measure: `research:change:${figure.unit}`, asOf: item.asOf, figures: [{ ...figure, basis: 'research:change' }] });
    return say(`{d.date} ${RESEARCH_WORDS.since} {c}`, { d: dated, c: moved });
  }
  return say(`${RESEARCH_WORDS.prior} {p}({d.date})`, { p: measureSaid(subject, item.unit, prior, prior.asOf, `${item.label} 이전 값`), d: dated });
}

/** One typed row from an item, or null when the item is malformed. */
function rowOf(item, group, today) {
  if (!item || typeof item.id !== 'string' || !UNIT_SPEC[item.unit] || !oneMeasure(item) || !isIsoDay(item.asOf)) return null;
  if (item.asOf > today) return null;
  const ageDays = daysBetween(item.asOf, today);
  const longLived = Number.isInteger(item.validDays);
  if (ageDays > (longLived ? Math.min(item.validDays, RESEARCH_VALID_DAYS_MAX) : RESEARCH_DROP_DAYS)) return null;
  const subject = `research:${item.id}`;
  const value = measureSaid(subject, item.unit, item, item.asOf, item.label);
  const change = changeSaid(subject, item);
  const date = say('{d.date}', { d: claim({ subject, measure: 'research:asOf', asOf: item.asOf }) }); // M/D on the face
  return Object.freeze({
    id: item.id, group: group.id, groupTitle: group.title, label: item.label, entity: item.entity || null,
    period: item.period || null, forecast: item.kind === 'forecast', unit: item.unit,
    value, change, date, asOf: item.asOf, ageDays, stale: !longLived && ageDays > RESEARCH_STALE_DAYS, // a period figure with its own window is not waiting for a refresh
    record: item.record || null, note: String(item.note || ''), sourceName: item.sourceName || null, sourceUrl: item.sourceUrl || null,
    claims: Object.freeze([...new Set([...value.claims, ...change.claims, ...date.claims])])
  });
}

/**
 * { state, checkedAt, method, groups: [{ id, title, rows }], rows, sources } — `groups` limits the groups read,
 * `entity` keeps only one ticker's rows. state: 'loading' | 'unavailable' | 'empty' (no current row) | 'ok'.
 */
export function researchReference(artifact, { nowMs = Date.now(), groups = RESEARCH_GROUP_IDS, entity = null, loadState = 'loading' } = {}) {
  if (!artifact) return { state: loadState === 'failed' ? 'unavailable' : 'loading', groups: [], rows: [], sources: [] };
  if (artifact.schemaVersion !== RESEARCH_REFERENCE_SCHEMA || !Array.isArray(artifact.groups)) return { state: 'unavailable', groups: [], rows: [], sources: [] };
  const today = kstDay(nowMs);
  const wanted = new Set(groups);
  const out = [];
  for (const group of artifact.groups) {
    if (!wanted.has(group?.id) || !Array.isArray(group.items)) continue;
    const rows = group.items.map((item) => rowOf(item, group, today)).filter(Boolean)
      .filter((row) => !entity || row.entity === String(entity).toUpperCase());
    if (rows.length) out.push(Object.freeze({ id: group.id, title: String(group.title || group.id), rows }));
  }
  // Groups in the order asked for, so a caller decides which reads first.
  out.sort((a, b) => groups.indexOf(a.id) - groups.indexOf(b.id));
  const rows = out.flatMap((group) => group.rows);
  const sources = [...new Map(rows.filter((row) => row.sourceUrl).map((row) => [row.sourceUrl, { name: row.sourceName || row.sourceUrl, url: row.sourceUrl }])).values()];
  return { state: rows.length ? 'ok' : 'empty', checkedAt: isIsoDay(artifact.checkedAt) ? artifact.checkedAt : null, method: String(artifact.method || ''), groups: out, rows, sources };
}

/** One row as composed text: label, period, value, change, record — the same pieces the face shows. */
export function researchRowSaid(row) {
  const head = [row.label, row.period, row.forecast ? RESEARCH_WORDS.forecast : null].filter(Boolean).join(' ');
  return sayJoin([say('{h} {v}', { h: head, v: row.value }), row.change, row.record ? say('{r}', { r: row.record }) : NOTHING], ', ');
}

/**
 * Dated fact lines for the AI market-reading input, one per current row ('' rows dropped). Pure: the caller passes the
 * published artifact; nothing here fetches. The basis words say these are researched, dated and outside every score.
 */
export function researchFactLines(artifact, { nowMs = Date.now(), groups = RESEARCH_GROUP_IDS } = {}) {
  const view = researchReference(artifact, { nowMs, groups, loadState: 'failed' });
  if (view.state !== 'ok') return [];
  return view.rows.map((row) => `${RESEARCH_WORDS.factLead}(${row.groupTitle}; ${RESEARCH_WORDS.factBasis}; 기준일 ${row.asOf}${row.stale ? `, ${RESEARCH_WORDS.stale}` : ''}${row.entity ? `; ${row.entity}` : ''}): ${researchRowSaid(row).text} — ${row.note}`);
}
