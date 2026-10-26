// v58.79 (owner 2026-10-25): AIO's own theme-stage record started on 2026-10-12, so the stage run ("N거래일째") and the
// one-month strip read at most ten sessions. The screener run already holds two years of adjusted closes for every
// member; this rebuilds each past session's theme rows from those closes (the same closesToFactors fields the live row
// carries) and runs them through the same group-strength and playbook rules the screens use. Output is the compact
// themeHistory shape ({ date, themes: { 'US:id': [ret1m, state] } }); build-scenario-state fills the days and themes its
// forward record lacks and marks them as recomputed. Each session reads only closes up to that session (ci-lookahead-check
// rewrites every later close and requires the row unchanged); the one later fact is membership — today's theme members are
// applied to every past session, and the screen's hover note says so.
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from '../lib/atomic-write.mjs';
import { closesToFactors, isSessionComplete } from '../../src/domain/screener/price-factors.js';
import { listingMarketOfSymbol } from '../../src/domain/market/session-time.js';
import { buildGroupStrength } from '../../src/domain/themes/group-strength.js';
import { krThemeArtifactRead } from '../../src/domain/themes/kr-themes.js';
import { buildThemePlaybook } from '../../src/domain/scenarios/theme-playbook.js';
import { THEME_STAGE_RULE } from '../../src/domain/scenarios/analogs.js';
import { loadThemeMaps } from '../build-scenario-state.mjs';
import { REPO_ROOT } from './paths.mjs';

export const THEME_STAGE_HISTORY_SCHEMA = 'theme-stage-history.v1';
export const THEME_STAGE_BACKFILL_SESSIONS = 120;
const OUT = `${REPO_ROOT}/public-data/theme-stage-history.json`;

const marketOf = (sym) => (/\.K[SQ]$/i.test(String(sym || '')) ? 'KR' : listingMarketOfSymbol(sym) === 'US' ? 'US' : null);

/** Completed sessions most of a market's symbols traded on, newest last. */
function sessionsOf(series, market, limit, nowMs) {
  const counts = new Map();
  const rows = series.filter((row) => row.market === market);
  for (const row of rows) for (const date of row.dates) counts.set(date, (counts.get(date) || 0) + 1);
  const floor = Math.max(3, rows.length * 0.5);
  return [...counts].filter(([date, n]) => n >= floor && isSessionComplete(date, market === 'KR' ? 'kr' : 'us', nowMs)).map(([date]) => date).sort().slice(-limit);
}

/** Index of the last bar on or before `date` (dates ascending), or -1. */
function lastIndexOnOrBefore(dates, date) {
  let lo = 0, hi = dates.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

/** A screener-shaped row for `sym` as of its last bar on or before `date` (null when that bar is not `date` itself for US). */
function rowAsOf(row, date, { exact }) {
  const index = lastIndexOnOrBefore(row.dates, date);
  if (index < 29 || (exact && row.dates[index] !== date)) return null;
  const factors = closesToFactors(row.closes.slice(0, index + 1));
  if (!factors) return null;
  const { price, ...fields } = factors; // P715: no raw price, as in the live artifact
  return { sym: row.sym, ...fields, factorSessionDate: row.dates[index] };
}

/**
 * @param {object} input
 * @param {Array} input.results   screener fetch results ({ sym, dates, adjCloses })
 * @param {object} input.themeMaps loadThemeMaps() result
 * @param {Array} input.history   public-data/history.json rows (benchmark windows)
 */
export function buildThemeStageBackfill({ results = [], themeMaps = null, history = [], sessions = THEME_STAGE_BACKFILL_SESSIONS, nowMs = Date.now() } = {}) {
  const maps = themeMaps || { usThemes: [], krThemeMap: {}, labels: {} };
  const series = (results || []).filter((row) => row && !row.__error && Array.isArray(row.dates) && Array.isArray(row.adjCloses) && row.dates.length === row.adjCloses.length)
    .map((row) => {
      const keep = row.adjCloses.map((value, i) => [row.dates[i], Number(value)]).filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(String(date)) && Number.isFinite(value) && value > 0);
      return { sym: row.sym, market: marketOf(row.sym), dates: keep.map(([date]) => date), closes: keep.map(([, value]) => value) };
    }).filter((row) => row.market);
  const usSessions = sessionsOf(series, 'US', sessions, nowMs);
  const out = [];
  for (const date of usSessions) {
    const usRows = series.filter((row) => row.market === 'US').map((row) => rowAsOf(row, date, { exact: true })).filter(Boolean);
    const krRows = series.filter((row) => row.market === 'KR').map((row) => rowAsOf(row, date, { exact: false })).filter(Boolean);
    // The close of `date` is "current" for a clock set after that session's close (22:30Z is after 16:00 New York).
    const groups = buildGroupStrength({ themes: maps.usThemes, rows: usRows, sortKey: 'ret3m', now: Date.parse(`${date}T22:30:00Z`) }).groups || [];
    const krThemes = krThemeArtifactRead({ themeMap: maps.krThemeMap, rows: krRows }).themes || [];
    const playbook = buildThemePlaybook({ usGroups: groups, krThemes, labels: maps.labels, history: (history || []).filter((row) => row?.date <= date) });
    const themes = Object.fromEntries((playbook.themes || []).filter((row) => row.state).map((row) => [`${row.market}:${row.id}`, [row.ret1m == null ? null : Math.round(row.ret1m * 10) / 10, row.state]]));
    if (Object.keys(themes).length) out.push({ date, themes });
  }
  return { schemaVersion: THEME_STAGE_HISTORY_SCHEMA, generatedAt: new Date(nowMs).toISOString(), rule: THEME_STAGE_RULE,
    basis: 'recomputed from AIO screener adjusted closes (2y) with the live theme-stage rule and today\'s theme members; not a forward record', sessions: out.length, history: out };
}

export async function writeThemeStageBackfill(results, nowMs = Date.now()) {
  let history = [];
  try { const raw = JSON.parse(await readFile(`${REPO_ROOT}/public-data/history.json`, 'utf8')); history = Array.isArray(raw) ? raw : raw?.rows || []; } catch { /* no benchmark windows: the playbook holds every stage */ }
  const payload = buildThemeStageBackfill({ results, themeMaps: loadThemeMaps(REPO_ROOT), history, nowMs });
  if (!payload.sessions) { console.warn('[theme-stage-backfill] no sessions recomputed — artifact unchanged'); return null; }
  await atomicWriteFile(OUT, JSON.stringify(payload));
  console.log(`[theme-stage-backfill] ${payload.sessions} sessions, ${payload.history[0].date}..${payload.history.at(-1).date}`);
  return payload;
}
