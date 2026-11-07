#!/usr/bin/env node
// v59.63 phase 1: writes public-data/market-day.json, the one ledger of the last day's moves and events
// (src/domain/market-day/facts.js), from artifacts this refresh and the other producers already published. No network.
// A run that cannot read history or the screener leaves the previous artifact in place.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { loadThemeMaps } from './build-scenario-state.mjs';
import { buildMarketDay } from '../src/domain/market-day/facts.js';
import { detectNarratives, narrativeDayLog, publishedNarratives } from '../src/domain/narrative/narratives.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PD = (file) => path.join(ROOT, 'public-data', file);
const readJson = (file) => { try { return JSON.parse(readFileSync(PD(file), 'utf8')); } catch { return null; } };

export function marketDayInputs(read = readJson, root = ROOT) {
  const historyRaw = read('history.json');
  const data = read('data.json') || {};
  const telegram = read('telegram-digest.json');
  return {
    history: Array.isArray(historyRaw) ? historyRaw : historyRaw?.rows || [],
    screener: read('screener.json'), universe: read('screener-universe.json')?.universe || [],
    news: [...(data.news || []), ...(data.newsIntraday || [])], signals: telegram?.signals || [], telegramDigest: telegram,
    calendar: read('earnings-calendar.json'), briefs: read('event-briefs.json'), macroHistory: read('macro-history.json'),
    macroCalendar: read('macro-calendar.json'), themes: loadThemeMaps(root).usThemes, indexWeights: read('sp500-weights.json')?.rows || []
  };
}

export function narrativesFor(inputs, nowMs, previous = null) {
  try {
    const current = publishedNarratives(detectNarratives({ telegramDigest: inputs.telegramDigest, screener: inputs.screener, nowMs }), { nowMs });
    return { ...current, ...narrativeDayLog(previous, current, { nowMs }) };
  }
  catch (error) { return { version: 'narratives.v1', at: new Date(nowMs).toISOString(), stories: [], log: Array.isArray(previous?.log) ? previous.log : [], changes: null, error: String(error?.message || error) }; }
}

async function main() {
  const inputs = marketDayInputs();
  if (!inputs.history.length || !inputs.screener?.data) { console.warn('[market-day] history or screener unreadable — artifact unchanged'); return; }
  const nowMs = Date.now();
  const day = buildMarketDay({ ...inputs, nowMs });
  // v59.70 (owner 11/07): the stories the market is relaying, counts only (src/domain/narrative/narratives.js) — the same
  // detection the market reading's prompt uses, so 시장 상태 shows what the reading weighed.
  day.narratives = narrativesFor(inputs, nowMs, readJson('market-day.json')?.narratives || null);
  await atomicWriteFile(PD('market-day.json'), JSON.stringify(day));
  console.log(`[market-day] facts=${day.facts.length} links=${day.links.length} threads=${day.threads.length} ${JSON.stringify(day.counts)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[market-day] ${error?.message || error}`); process.exitCode = 0; });
}
