#!/usr/bin/env node
// P1743 (owner 2026-10-13): the forward view has to keep running with the market, not only when someone opens a screen.
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
import { interpretationFromArtifacts } from './lib/market-interpretation-inputs.mjs'; // owner 2026-10-19: one interpretation pipeline
import { releaseActuals, actualText, scoreRelease, EVENT_NAMES } from '../src/domain/market/macro-crossroads.js';
import { THEME_STATES } from '../src/domain/scenarios/analogs.js';
import { SCENARIO_STATE_CURRENT } from '../src/domain/scenarios/theme-stage.js';
import { choiceName } from '../src/domain/guide/market-guide.js';
import { LESSON_BY_ID } from '../src/domain/guide/lessons.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PD = (name) => path.join(ROOT, 'public-data', name);
export const SCENARIO_STATE_SCHEMA = 'scenario-state.v1';
const MAX_TRANSITIONS = 60;
const MAX_EVENT_OUTCOMES = 24;
const MAX_THEME_DAYS = 120;

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

/** THEME_MAP (js/aio-pages.js) and KR_THEME_MAP (js/aio-kr-data.js) are plain literals; evaluate them in isolation. */
export function loadThemeMaps(rootDir = ROOT) {
  const literal = (file, head, close) => {
    const source = readFileSync(path.join(rootDir, file), 'utf8');
    const start = source.indexOf(head);
    if (start < 0) return null;
    const end = source.indexOf(close, start);
    try { return vm.runInNewContext(`(${source.slice(start + head.length - 1, end + 2)})`, {}, { timeout: 1000 }); } catch { return null; }
  };
  const usThemes = literal('js/aio-pages.js', 'var THEME_MAP = [', '\n];') || [];
  const krThemeMap = literal('js/aio-kr-data.js', 'var KR_THEME_MAP = {', '\n};') || {};
  return { usThemes, krThemeMap, labels: Object.fromEntries(usThemes.map((theme) => [theme.id, theme.nameKr])) };
}

const short = (title) => String(title || '').split(' — ')[0];
const themeKey = (row) => `${row.market}:${row.id}`;

/** What changed between two snapshots, as plain sentences. */
export function diffSnapshots(previous, current, at) {
  if (!previous) return [];
  const out = [];
  const push = (kind, text) => out.push({ at, kind, text });
  const titleOf = (id, snap) => short(snap.crossroads?.items?.find((item) => item.id === id)?.title) || id;
  const p = previous.crossroads || {}, c = current.crossroads || {};
  if (p.leadId !== c.leadId) push('lead', c.leadId ? `가장 맞는 시나리오가 '${p.leadId ? titleOf(p.leadId, previous) : '판단 보류'}'에서 '${titleOf(c.leadId, current)}'(으)로 바뀌었습니다.` : '조건을 확인할 관측이 부족해 중심 시나리오 판단을 보류합니다.');
  else if (p.altId !== c.altId && c.altId) push('alt', `대안 시나리오가 '${titleOf(c.altId, current)}'(으)로 바뀌었습니다.`);
  const before = new Map((p.items || []).map((item) => [item.id, item]));
  for (const item of c.items || []) {
    const old = before.get(item.id);
    if (!old) continue;
    if (old.met !== item.met && item.known >= 2) {
      const gained = item.conditions.filter(([label, ok]) => ok === true && old.conditions.find(([l]) => l === label)?.[1] !== true).map(([label]) => label.split(' (')[0]);
      const lost = item.conditions.filter(([label, ok]) => ok !== true && old.conditions.find(([l]) => l === label)?.[1] === true).map(([label]) => label.split(' (')[0]);
      push('fit', `'${short(item.title)}' 조건 충족 ${old.met}/${old.total} → ${item.met}/${item.total}${gained.length ? ` (새로 충족: ${gained.join(', ')})` : ''}${lost.length ? ` (더 이상 아님: ${lost.join(', ')})` : ''}.`);
    }
    if (old.pricingTone !== item.pricingTone && old.pricingTone !== 'unknown' && item.pricingTone !== 'unknown') {
      const label = { same: '이 시나리오 쪽', against: '반대쪽', neutral: '중립' };
      push('pricing', `'${short(item.title)}'에 대한 시장 가격이 ${label[old.pricingTone] || old.pricingTone}에서 ${label[item.pricingTone] || item.pricingTone}(으)로 바뀌었습니다.`);
    }
  }
  // Owner 2026-10-19: the market guide's cross-scenario direction and the principles today's data touches are logged too.
  const pg = previous.guide || null, cg = current.guide || null;
  if (pg && cg && pg.robust !== cg.robust) push('guide', cg.robust ? `여러 시나리오를 함께 볼 때 비용이 작은 쪽이 '${pg.robust ? choiceName(pg.robust) : '집계 없음'}'에서 '${choiceName(cg.robust)}'(으)로 바뀌었습니다.` : (cg.split ? '살아 있는 시나리오들이 유리한 선택지를 서로 다르게 적어 한쪽으로 세지 않습니다.' : '핵심 조건을 갖춘 시나리오가 없어 선택지 집계를 멈췄습니다.'));
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
    // v57.86 (live review): market names in words (no [US]/[KR] codes) and one line per theme move.
    const line = `${row.market === 'KR' ? '한국' : '미국'} ${row.label}: ${THEME_STATES[old?.state]?.split(' (')[0]} → ${THEME_STATES[row.state]?.split(' (')[0]}`;
    if (old && old.state && row.state && old.state !== row.state && !stageMoves.includes(line)) stageMoves.push(line);
  }
  if (stageMoves.length) push('theme', `테마 단계 변화 ${stageMoves.length}건 — ${stageMoves.slice(0, 6).join(' · ')}${stageMoves.length > 6 ? ' 외' : ''}.`);
  const topBefore = previous.rotation?.top, topNow = current.rotation?.top;
  // v57.54 review: compare only within the same theme scope (US-only vs all themes), so a scope change is not a market move.
  if (topBefore && topNow && topBefore.scope === topNow.scope && (topBefore.strong !== topNow.strong || topBefore.weak !== topNow.weak)) push('rotation', `1개월 기준 가장 강한 테마 성격 '${topNow.strong}', 가장 약한 성격 '${topNow.weak}'(직전: '${topBefore.strong}' / '${topBefore.weak}').`);
  return out;
}

/** Newly published releases (period later than the last one scored) scored against every branch rule. */
export function scoreNewReleases(macroHistory, lastScored = {}, at) {
  const actuals = releaseActuals(macroHistory);
  const scored = [], next = { ...lastScored };
  for (const [id, actual] of Object.entries(actuals)) {
    if (!actual?.period || (lastScored[id] && actual.period <= lastScored[id])) continue;
    next[id] = actual.period;
    scored.push({ at, id, name: EVENT_NAMES[id] || id, period: actual.period, actual, actualText: actualText(id, actual), matched: scoreRelease(id, actual) });
  }
  return { scored, lastScored: next };
}

export function buildScenarioState({ data = null, history = [], macroHistory = null, calendar = null, screener = null, themeMaps = null, outcomes = null, previous = null, nowMs = Date.now() } = {}) {
  const at = new Date(nowMs).toISOString();
  // Owner 2026-10-19: the shared interpretation (the same stages the screens, the AI and the narrative read). The
  // structure outlook here has no live sector rows (no rotation input), as before.
  const interpretation = interpretationFromArtifacts({ data, history, macroHistory, calendar, outcomes, previous, screener: screener || {}, themeMaps, nowMs });
  const { crossroads, guide } = interpretation;
  if (!crossroads) throw new Error(`[scenario-state] crossroads stage failed: ${interpretation.errors.crossroads || 'no model'}`);
  const playbook = interpretation.playbook || { themes: [], rotation: null, highlights: {} };
  const snapshot = {
    crossroads: { asOf: crossroads.asOf, headline: crossroads.headline, leadId: crossroads.leadId, altId: crossroads.altId, tension: crossroads.rateHub?.tension || null,
      nextEvent: crossroads.nextEvent, pathsDown: (crossroads.rateHub?.pathsDown || []).map((row) => ({ id: row.id, label: row.label, ok: row.ok })),
      items: (crossroads.items || []).map((item) => ({ id: item.id, title: item.title, met: item.met, total: item.total, known: item.known, fit: item.fit, conditions: item.conditions, pricingTone: item.pricing?.tone || 'unknown', favored: item.favored, pastN: item.past?.n ?? 0, pastSource: item.past?.source || null })) },
    themes: (playbook.themes || []).map((row) => ({ market: row.market, id: row.id, label: row.label, state: row.state, stateLabel: row.stateLabel, ret5d: row.ret5d ?? null, ret1m: row.ret1m, ret3m: row.ret3m, ret6m: row.ret6m, above50: row.above50, basis: row.basis || null, windLead: row.wind.lead, windAlt: row.wind.alt, favored: row.favored, fit: row.fit })),
    rotation: { text: playbook.rotation?.text || '', top: playbook.rotation?.tags?.length >= 2 ? { strong: playbook.rotation.tags[0].label, weak: playbook.rotation.tags.at(-1).label, scope: playbook.rotation.market || null } : null, tags: playbook.rotation?.tags || [] },
    guide: guide?.available ? { asOf: guide.asOf, headline: guide.headline, leadId: guide.leadId, robust: guide.direction.robust, split: guide.direction.split,
      tally: guide.direction.tally.map((row) => ({ key: row.key, favoredIn: row.favoredIn, costlyIn: row.costlyIn })), situation: guide.situation, stance: guide.stance,
      lessonIds: guide.lessons.map((row) => row.id), reasons: Object.fromEntries(guide.lessons.filter((row) => row.reason).map((row) => [row.id, row.reason])) } : null,
    highlights: Object.fromEntries(Object.entries(playbook.highlights || {}).map(([key, list]) => [key, list.map(themeKey)]))
  };
  const transitions = [...(previous?.transitions || []), ...diffSnapshots(previous, snapshot, at)].slice(-MAX_TRANSITIONS);
  const { scored, lastScored } = scoreNewReleases(macroHistory, previous?.lastScored || {}, at);
  const eventOutcomes = [...(previous?.eventOutcomes || []), ...scored].slice(-MAX_EVENT_OUTCOMES);
  const themeDay = playbook.asOf;
  const themeHistory = (previous?.themeHistory || []).filter((row) => row.date !== themeDay);
  if (themeDay) themeHistory.push({ date: themeDay, themes: Object.fromEntries(snapshot.themes.map((row) => [themeKey(row), [row.ret1m == null ? null : Math.round(row.ret1m * 10) / 10, row.state]])) });
  return {
    schemaVersion: SCENARIO_STATE_SCHEMA, status: SCENARIO_STATE_CURRENT, generatedAt: at,
    sourceLabel: 'AIO 공개 산출물(거시 기록·확정 종가·스크리너)로 갱신마다 재계산',
    basis: { macroAsOf: crossroads.asOf || null, themeAsOf: themeDay || null, themeAsOfByMarket: playbook.asOfByMarket || null, outcomesAt: outcomes?.generatedAt || null },
    ...snapshot,
    transitions: transitions.slice(-MAX_TRANSITIONS), eventOutcomes, lastScored,
    themeHistory: themeHistory.sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_THEME_DAYS)
  };
}

async function main() {
  const historyRaw = readJson(PD('history.json'));
  const history = Array.isArray(historyRaw) ? historyRaw : historyRaw?.rows || historyRaw?.history || [];
  const payload = buildScenarioState({
    data: readJson(PD('data.json')), history, macroHistory: readJson(PD('macro-history.json')), calendar: readJson(PD('macro-calendar.json')),
    screener: readJson(PD('screener.json')), themeMaps: loadThemeMaps(ROOT), outcomes: ((out) => (out?.status === 'current' ? out : null))(readJson(PD('scenario-outcomes.json'))), previous: ((prev) => (prev?.status === 'current' ? prev : null))(readJson(PD('scenario-state.json'))) // a pending placeholder is not a previous state
  });
  if (!payload.crossroads.items.length) { console.warn('[scenario-state] no branches computed — artifact unchanged'); return; }
  await atomicWriteFile(PD('scenario-state.json'), JSON.stringify(payload));
  console.log(`[scenario-state] lead=${payload.crossroads.leadId} alt=${payload.crossroads.altId} themes=${payload.themes.length} transitions=${payload.transitions.length} scored=${payload.eventOutcomes.length}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[scenario-state] ${error?.message || error}`); process.exitCode = 0; });
}
