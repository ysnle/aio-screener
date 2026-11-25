#!/usr/bin/env node
// The forward view has to keep running with the market, not only when someone opens a screen.
// Every data refresh (refresh-data.yml, after fetch-data) this producer — no network, published artifacts only —
//   1. recomputes the macro crossroads (every branch in the registry) and the theme playbook (every US and KR theme),
//   2. scores any newly published release (CPI, jobs, PCE, retail sales, policy rate) against every branch's rule,
//   3. diffs the result against the previous snapshot and appends what changed (lead/alternative branch, a branch's
//      met-condition count or market-pricing side, a theme's stage, the rotation, the rate tension) to a short log,
//   4. keeps a daily theme snapshot so AIO's own record of theme stages accumulates.
// Output: public-data/scenario-state.json (schema scenario-state.v1). Screens and the AI read the log and the scored
// releases; the live branch/theme numbers are recomputed in the browser from the same rules.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { interpretationFromArtifacts } from './lib/market-interpretation-inputs.mjs'; // One interpretation pipeline
import { releaseActuals, actualText, scoreRelease, EVENT_NAMES } from '../src/domain/market/regime/macro-crossroads.js';
import { THEME_STATES, THEME_STAGE_RULE } from '../src/domain/scenarios/analogs.js';
import { SCENARIO_STATE_CURRENT } from '../src/domain/scenarios/theme-stage.js';
import { choiceName } from '../src/domain/guide/market-guide.js';
import { withDirectionParticle } from '../src/domain/content/korean-particle.js';
import { LESSON_BY_ID } from '../src/domain/guide/lessons.js';
import { scenarioLead } from '../src/domain/market/regime/scenario-lead.js';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { verdictModelFingerprint } from './lib/verdict-model.mjs';
import { buildMarketOpening } from '../src/domain/market/story/market-story.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PD = (name) => path.join(ROOT, 'public-data', name);
export const SCENARIO_STATE_SCHEMA = 'scenario-state.v1';
const MAX_TRANSITIONS = 60;
const MAX_EVENT_OUTCOMES = 24;
const MAX_THEME_DAYS = 120;

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** A plain literal a classic script assigns (`var NAME = [` … `\n];`), evaluated in isolation; null when absent. */
export function classicLiteral(file, head, close, rootDir = ROOT) {
  const source = readFileSync(path.join(rootDir, file), 'utf8');
  const start = source.indexOf(head);
  if (start < 0) return null;
  const end = source.indexOf(close, start);
  // No vm timeout: the slice is a data literal, and a timeout under a loaded runner would read as "no themes".
  try { return vm.runInNewContext(`(${source.slice(start + head.length - 1, end + 2)})`, {}); } catch { return null; }
}

/** THEME_MAP (js/aio-pages.js) and KR_THEME_MAP (js/aio-kr-data.js) are plain literals; evaluate them in isolation. */
export function loadThemeMaps(rootDir = ROOT) {
  const literal = (file, head, close) => classicLiteral(file, head, close, rootDir);
  const usThemes = literal('js/aio-pages.js', 'var THEME_MAP = [', '\n];') || [];
  const krThemeMap = literal('js/aio-kr-data.js', 'var KR_THEME_MAP = {', '\n};') || {};
  return { usThemes, krThemeMap, labels: Object.fromEntries(usThemes.map((theme) => [theme.id, theme.nameKr])) };
}

const short = (title) => String(title || '').split(' — ')[0];
const themeKey = (row) => `${row.market}:${row.id}`;

/**
 * v58.79 (owner 2026-10-25): the forward record (from 2026-10-12) plus the recomputed one (theme-stage-history.json, built
 * by the screener run from adjusted closes with the same rule). A recorded day and a recorded theme always win; a day or
 * a theme the record lacks is filled from the recomputed copy and marked `recomputed`. A copy built on another rule is
 * ignored.
 */
export function mergeThemeHistory(recorded = [], backfill = null) {
  const byDate = new Map((Array.isArray(recorded) ? recorded : []).filter((row) => row?.date).map((row) => [row.date, { ...row, themes: { ...(row.themes || {}) } }]));
  const usable = backfill?.schemaVersion === 'theme-stage-history.v1' && backfill.rule === THEME_STAGE_RULE && Array.isArray(backfill.history);
  if (!usable) return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const firstRecorded = [...byDate.keys()].filter((date) => !byDate.get(date).recomputed).sort()[0] || null;
  for (const day of backfill.history) {
    if (!day?.date || !day.themes) continue;
    const own = byDate.get(day.date);
    if (!own) { byDate.set(day.date, { date: day.date, themes: { ...day.themes }, recomputed: true }); continue; }
    // Only a day before the forward record started takes a missing theme (a newer recorded day without it means it was not measured).
    if (!own.recomputed && firstRecorded && day.date >= firstRecorded) continue;
    for (const [key, value] of Object.entries(day.themes)) if (!(key in own.themes)) own.themes[key] = value;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * A theme whose stage the playbook withheld only because its benchmark's close is a
 * session behind (row.held, e.g. RSP before the 23:00Z cut while the screener already has the day) keeps the previous
 * snapshot's stage on its own basis, marked held, so the next read on the common date is compared with the last real one.
 * Without a previous stage on the same benchmark the withheld row stands as it is.
 */
export function heldThemeRow(row, previous) {
  if (!row?.held) return null;
  const old = (previous?.themes || []).find((item) => themeKey(item) === themeKey(row));
  if (!old?.state || !old.benchmark || old.benchmark !== row.held.benchmark) return null;
  return { ...old, held: { reason: row.held.reason, benchmarkAsOf: row.held.benchmarkAsOf, basis: row.basis || null } };
}

/** What changed between two snapshots, as plain sentences. */
export function diffSnapshots(previous, current, at) {
  if (!previous) return [];
  const out = [];
  const push = (kind, text) => out.push({ at, kind, text });
  const titleOf = (id, snap) => short(snap.crossroads?.items?.find((item) => item.id === id)?.title) || id;
  const p = previous.crossroads || {}, c = current.crossroads || {};
  // Snapshots keep the lead fields without the live model's availability flag. Compare the same leader sets the
  // screens read: order inside a tie is immaterial, entering/leaving it or changing its members is a real transition.
  const beforeLead = scenarioLead({ ...p, available: true }), afterLead = scenarioLead({ ...c, available: true });
  const leadChanged = [...beforeLead.ids].sort().join('|') !== [...afterLead.ids].sort().join('|');
  if (leadChanged) {
    if (afterLead.state === 'tie') push('lead', `조건 충족 동률 시나리오가 ${afterLead.names.join(' · ')}입니다(직전: ${beforeLead.names.join(' · ') || '판단 보류'}).`);
    else push('lead', c.leadId ? `가장 맞는 시나리오가 ${beforeLead.names.join(' · ') || "'판단 보류'"}에서 ${withDirectionParticle(`'${titleOf(c.leadId, current)}'`)} 바뀌었습니다.` : '조건을 확인할 관측이 부족해 중심 시나리오 판단을 보류합니다.');
  } else if (afterLead.state === 'lead' && p.altId !== c.altId && c.altId) push('alt', `대안 시나리오가 ${withDirectionParticle(`'${titleOf(c.altId, current)}'`)} 바뀌었습니다.`);
  const before = new Map((p.items || []).map((item) => [item.id, item]));
  for (const item of c.items || []) {
    const old = before.get(item.id);
    if (!old) continue;
    // Conditions carry no id in the snapshot; they are matched by their full label (a label whose figure changed reads
    // as one lost and one gained). A swap at the same count is a change of reasons and is logged too.
    if (item.known >= 2) {
      const was = (label) => (old.conditions || []).find(([l]) => l === label)?.[1];
      const gained = (item.conditions || []).filter(([label, ok]) => ok === true && was(label) !== true).map(([label]) => label.split(' (')[0]);
      const lost = (item.conditions || []).filter(([label, ok]) => ok !== true && was(label) === true).map(([label]) => label.split(' (')[0]);
      const why = [gained.length ? `새로 충족: ${gained.join(', ')}` : '', lost.length ? `더 이상 아님: ${lost.join(', ')}` : ''].filter(Boolean);
      if (old.met !== item.met) push('fit', `'${short(item.title)}' 조건 충족 ${old.met}/${old.total} → ${item.met}/${item.total}${why.map((part) => ` (${part})`).join('')}.`);
      else if (gained.length && lost.length) push('fit', `'${short(item.title)}' 조건 충족 ${item.met}/${item.total} 그대로, 근거가 바뀜 (${why.join('; ')}).`);
    }
    const toneLabel = { same: '이 시나리오 쪽', against: '반대쪽', neutral: '중립' };
    if (old.pricingTone !== item.pricingTone && old.pricingTone !== 'unknown' && item.pricingTone !== 'unknown') {
      push('pricing', `'${short(item.title)}'에 대한 시장 가격이 ${toneLabel[old.pricingTone] || old.pricingTone}에서 ${withDirectionParticle(toneLabel[item.pricingTone] || item.pricingTone)} 바뀌었습니다.`);
    } else if (item.pricingTone === 'unknown' && old.pricingTone && old.pricingTone !== 'unknown') {
      push('pricing', `'${short(item.title)}': 시장 가격 자료가 빠져 방향을 읽지 못함(직전: ${toneLabel[old.pricingTone] || old.pricingTone}).`);
    }
  }
  // The market guide's cross-scenario direction and the principles today's data touches are logged too.
  const pg = previous.guide || null, cg = current.guide || null;
  if (pg && cg && pg.robust !== cg.robust) push('guide', cg.robust ? `여러 시나리오에 걸쳐 손해가 작은 선택이 '${pg.robust ? choiceName(pg.robust) : '집계 없음'}'에서 ${withDirectionParticle(`'${choiceName(cg.robust)}'`)} 바뀌었습니다.` : (cg.split ? '살아 있는 시나리오들이 유리한 선택지를 서로 다르게 적어 한쪽으로 세지 않습니다.' : '핵심 조건을 갖춘 시나리오가 없어 선택지 집계를 멈췄습니다.'));
  if (pg && cg) {
    // Only a newly relevant trap is logged (the others follow the same axes the log already records).
    const added = (cg.lessonIds || []).filter((id) => !(pg.lessonIds || []).includes(id) && LESSON_BY_ID[id]?.kind === 'trap' && cg.reasons?.[id]);
    if (added.length) push('lesson', `새로 조심할 함정: ${added.map((id) => LESSON_BY_ID[id].title).join(' · ')}.`);
  }
  if (!!p.tension !== !!c.tension) push('tension', c.tension ? `금리 괴리가 생겼습니다: ${c.tension}` : '금리를 낮출 조건과 10년물 움직임의 괴리가 풀렸습니다.');
  const themesBefore = new Map((previous.themes || []).map((row) => [themeKey(row), row]));
  const stageMoves = [];
  for (const row of current.themes || []) {
    const old = themesBefore.get(themeKey(row));
    // A move is logged only between two stages read against the same benchmark; a
    // row carried over (held) is the previous stage itself, not a reading. A snapshot from before the benchmark was
    // stamped compares nothing for one refresh.
    if (!old?.benchmark || old.benchmark !== row.benchmark || row.held) continue;
    // v57.86 (live review): market names in words (no [US]/[KR] codes) and one line per theme move.
    const line = `${row.market === 'KR' ? '한국' : '미국'} ${row.label}: ${THEME_STATES[old?.state]?.split(' (')[0]} → ${THEME_STATES[row.state]?.split(' (')[0]}`;
    if (old && old.state && row.state && old.state !== row.state && !stageMoves.includes(line)) stageMoves.push(line);
  }
  if (stageMoves.length) push('theme', `테마 단계 변화 ${stageMoves.length}건 — ${stageMoves.slice(0, 6).join(' · ')}${stageMoves.length > 6 ? ' 외' : ''}.`);
  const topBefore = previous.rotation?.top, topNow = current.rotation?.top;
  // Compare only within the same theme scope (US-only vs all themes), so a scope change is not a market move.
  if (topBefore && topNow && topBefore.scope === topNow.scope && (topBefore.strong !== topNow.strong || topBefore.weak !== topNow.weak)) push('rotation', `1개월 기준 가장 강한 테마 성격 '${topNow.strong}', 가장 약한 성격 '${topNow.weak}'(직전: '${topBefore.strong}' / '${topBefore.weak}').`);
  return out;
}

/** Newly published releases (period later than the last one scored) scored against every branch rule. */
export function scoreNewReleases(macroHistory, lastScored = {}, at) {
  const actuals = releaseActuals(macroHistory);
  const scored = [], next = { ...lastScored };
  for (const [id, actual] of Object.entries(actuals)) {
    if (!actual?.period || (lastScored[id] && actual.period <= lastScored[id])) continue;
    // v59.45 (P17-RELEASE-01): a release whose other half (실업률, 임금, 전체 CPI) is not in yet is not consumed; it is
    // scored on the refresh that has the whole report.
    if (actual.missing?.length) continue;
    next[id] = actual.period;
    scored.push({ at, id, name: EVENT_NAMES[id] || id, period: actual.period, actual, actualText: actualText(id, actual), matched: scoreRelease(id, actual) });
  }
  return { scored, lastScored: next };
}

export function buildScenarioState({ data = null, history = [], macroHistory = null, calendar = null, screener = null, themeMaps = null, consensus = null, outcomes = null, previous = null, themeBackfill = null, longrun = null, marketDay = null, briefs = null, nowMs = Date.now() } = {}) {
  const at = new Date(nowMs).toISOString();
  // The shared interpretation (the same stages the screens, the AI and the narrative read).
  // The shared input builder also carries the sector rotation (data.json) and the index-earnings input, so
  // the structure outlook and guide here read the same stages as the screens.
  const interpretation = interpretationFromArtifacts({ data, history, macroHistory, calendar, outcomes, previous, screener: screener || {}, themeMaps, consensus, nowMs });
  const { crossroads, guide } = interpretation;
  if (!crossroads) throw new Error(`[scenario-state] crossroads stage failed: ${interpretation.errors.crossroads || 'no model'}`);
  const playbook = interpretation.playbook || { themes: [], rotation: null, highlights: {} };
  const snapshot = {
    crossroads: { asOf: crossroads.asOf, headline: crossroads.headline, leadId: crossroads.leadId, altId: crossroads.altId, tiedIds: crossroads.tiedIds || [], tension: crossroads.rateHub?.tension || null,
      nextEvent: crossroads.nextEvent, pathsDown: (crossroads.rateHub?.pathsDown || []).map((row) => ({ id: row.id, label: row.label, ok: row.ok })),
      items: (crossroads.items || []).map((item) => ({ id: item.id, title: item.title, met: item.met, total: item.total, known: item.known, fit: item.fit, conditions: item.conditions, pricingTone: item.pricing?.tone || 'unknown', favored: item.favored, pastN: item.past?.n ?? 0, pastSource: item.past?.source || null })) },
    themes: (playbook.themes || []).map((row) => heldThemeRow(row, previous) || ({ market: row.market, id: row.id, label: row.label, state: row.state, stateLabel: row.stateLabel, ret5d: row.ret5d ?? null, ret1m: row.ret1m, ret3m: row.ret3m, ret6m: row.ret6m, above50: row.above50, basis: row.basis || null, benchmark: row.relative?.field || null, windLead: row.wind.lead, windAlt: row.wind.alt, favored: row.favored, fit: row.fit })),
    rotation: { text: playbook.rotation?.text || '', top: playbook.rotation?.tags?.length >= 2 ? { strong: playbook.rotation.tags[0].label, weak: playbook.rotation.tags.at(-1).label, scope: playbook.rotation.market || null } : null, tags: playbook.rotation?.tags || [] },
    guide: guide?.available ? { asOf: guide.asOf, headline: guide.headline, leadId: guide.leadId, tiedIds: guide.tiedIds || [], robust: guide.direction.robust, split: guide.direction.split,
      tally: guide.direction.tally.map((row) => ({ key: row.key, favoredIn: row.favoredIn, costlyIn: row.costlyIn })), situation: guide.situation, stance: guide.stance,
      lessonIds: guide.lessons.map((row) => row.id), reasons: Object.fromEntries(guide.lessons.filter((row) => row.reason).map((row) => [row.id, row.reason])) } : null,
    highlights: Object.fromEntries(Object.entries(playbook.highlights || {}).map(([key, list]) => [key, list.map(themeKey)]))
  };
  const transitions = [...(previous?.transitions || []), ...diffSnapshots(previous, snapshot, at)].slice(-MAX_TRANSITIONS);
  const { scored, lastScored } = scoreNewReleases(macroHistory, previous?.lastScored || {}, at);
  const eventOutcomes = [...(previous?.eventOutcomes || []), ...scored].slice(-MAX_EVENT_OUTCOMES);
  const themeDay = playbook.asOf;
  // Each market's themes are filed under that market's own session: the US basis date keyed every row, so a Korean
  // session one day ahead was recorded a day late (KR 11/13 on the 11/12 and 11/13 rows, KR 11/12 nowhere).
  const themeHistory = mergeThemeHistory(previous?.themeHistory || [], themeBackfill);
  for (const row of snapshot.themes) {
    if (row.held) continue; // a carried stage belongs to its own earlier day, which already holds it
    const day = playbook.asOfByMarket?.[row.market] || themeDay;
    if (!day) continue;
    let entry = themeHistory.find((item) => item.date === day);
    if (!entry) { entry = { date: day, themes: {} }; themeHistory.push(entry); }
    delete entry.recomputed;
    entry.themes[themeKey(row)] = [row.ret1m == null ? null : Math.round(row.ret1m * 10) / 10, row.state];
  }
  themeHistory.sort((a, b) => a.date.localeCompare(b.date));
  const payload = {
    schemaVersion: SCENARIO_STATE_SCHEMA, status: SCENARIO_STATE_CURRENT, generatedAt: at,
    sourceLabel: 'AIO 공개 산출물(거시 기록·확정 종가·스크리너)로 갱신마다 재계산',
    // screenerComputedAt names the screener.json the theme rows were built from. The screener lane rewrites that
    // file between market refreshes, so a same-close comparison with the live pipeline holds only on the same file.
    basis: { macroAsOf: crossroads.asOf || null, themeAsOf: themeDay || null, themeAsOfByMarket: playbook.asOfByMarket || null, outcomesAt: outcomes?.generatedAt || null, screenerComputedAt: screener?.factorComputedAt || null },
    // v58.75 (persona review): the rule the theme rows and rotation text were built with (screens skip a mismatched copy).
    playbookVersion: playbook.version || null,
    ...snapshot,
    transitions: transitions.slice(-MAX_TRANSITIONS), eventOutcomes, lastScored,
    themeHistory: themeHistory.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_THEME_DAYS)
  };
  // Not part of scenario-state.json (non-enumerable): main() writes it as its own 1 KB artifact.
  // The record carries the opening read's lines (market-story.js buildMarketOpening) for the static shell to paint.
  const opening = buildMarketOpening({ history: interpretation.inputs?.history || history, macroHistory, longrun, through: interpretation.regime?.asOf || null,
    day: marketDay, briefs, afterHours: data?.afterHours || null, regime: interpretation.regime || null, events: interpretation.events || [], earnings: interpretation.indexEarnings || null });
  Object.defineProperty(payload, 'todayVerdict', { value: todayVerdictFrom(interpretation.regime, at, verdictModelFingerprint(), opening), enumerable: false });
  return payload;
}

/**
 * The record's `story`: the opening's lines as { id, label, text } on its own close (null without one), as 오늘 paints
 * them — the other markets as their one synthesis line (id 'cross') in place of the head and the rows.
 */
export function openingStory(opening, asOf) {
  if (!opening?.available || opening.asOf !== asOf || !opening.lines?.length) return null;
  const summary = opening.crossSummary?.said?.text ? { id: 'cross', label: opening.crossSummary.label, text: opening.crossSummary.said.text } : null;
  const first = opening.lines.findIndex((line) => line.id === 'cross');
  const lines = opening.lines.flatMap((line, i) => (line.id === 'cross-head' || (line.id === 'cross' && i !== first) ? []
    : line.id === 'cross' ? (summary ? [summary] : []) : [{ id: line.id, label: line.label, text: line.said.text }]));
  return { asOf: opening.asOf, diagnosis: opening.diagnosis?.state && opening.diagnosis.state !== 'none' ? opening.diagnosis.word : null, lines };
}

// First-users F01 (run-5 phone): on slow 3G the 오늘 verdict waited ~40 s for 1.9 MB of scripts and history. The static
// shell paints this record (the same interpretation the screen computes) until the screen's own render replaces it.
export const TODAY_VERDICT_SCHEMA = 'today-verdict.v1';
// `model` names the code that computed it (scripts/lib/verdict-model.mjs), so a record written by
// older rules is visible beside the screen's recomputation instead of a silent 1/4/1 next to 1/3/2.
// `story` (openingStory) is added without a schema bump — the shell paints heroLine when a record has none, so a
// record written before this release still renders (index.html), and this one renders on an older shell.
export function todayVerdictFrom(regime, at, model = null, opening = null) {
  if (!regime?.available || !regime.overall || !regime.asOf) return null;
  const story = openingStory(opening, regime.asOf);
  return { schemaVersion: TODAY_VERDICT_SCHEMA, generatedAt: at, asOf: regime.asOf, overall: regime.overall,
    heroLine: regime.heroLine || '', holdReason: regime.holdReason || null, counts: regime.counts || null, model, ...(story ? { story } : {}) };
}

async function main() {
  const historyRaw = readJson(PD('history.json'));
  const history = readHistoryRows(historyRaw);
  const payload = buildScenarioState({
    data: readJson(PD('data.json')), history, macroHistory: readJson(PD('macro-history.json')), calendar: readJson(PD('macro-calendar.json')),
    screener: readJson(PD('screener.json')), themeMaps: loadThemeMaps(ROOT), consensus: readJson(PD('consensus-estimates.json')), themeBackfill: readJson(PD('theme-stage-history.json')), longrun: readJson(PD('index-longrun.json')), marketDay: readJson(PD('market-day.json')), briefs: readJson(PD('event-briefs.json')), outcomes: ((out) => (out?.status === 'current' ? out : null))(readJson(PD('scenario-outcomes.json'))), previous: ((prev) => (prev?.status === 'current' ? prev : null))(readJson(PD('scenario-state.json'))) // a pending placeholder is not a previous state
  });
  if (!payload.crossroads.items.length) { console.warn('[scenario-state] no branches computed — artifact unchanged'); return; }
  await atomicWriteFile(PD('scenario-state.json'), JSON.stringify(payload));
  if (payload.todayVerdict) await atomicWriteFile(PD('today-verdict.json'), JSON.stringify(payload.todayVerdict));
  console.log(`[scenario-state] lead=${payload.crossroads.leadId} alt=${payload.crossroads.altId} themes=${payload.themes.length} transitions=${payload.transitions.length} scored=${payload.eventOutcomes.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[scenario-state] ${error?.message || error}`); process.exitCode = 0; });
}
