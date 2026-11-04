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
import { readHistoryRows } from '../src/domain/market/history-rows.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PD = (file) => path.join(ROOT, 'public-data', file);
const readJson = (file) => { try { return JSON.parse(readFileSync(PD(file), 'utf8')); } catch { return null; } };

export function marketDayInputs(read = readJson, root = ROOT) {
  const historyRaw = read('history.json');
  const data = read('data.json') || {};
  return {
    history: readHistoryRows(historyRaw),
    screener: read('screener.json'), universe: read('screener-universe.json')?.universe || [],
    news: [...(data.news || []), ...(data.newsIntraday || [])], signals: read('telegram-digest.json')?.signals || [],
    calendar: read('earnings-calendar.json'), briefs: read('event-briefs.json'), macroHistory: read('macro-history.json'),
    macroCalendar: read('macro-calendar.json'), themes: loadThemeMaps(root).usThemes, indexWeights: read('sp500-weights.json')?.rows || []
  };
}

async function main() {
  const inputs = marketDayInputs();
  if (!inputs.history.length || !inputs.screener?.data) { console.warn('[market-day] history or screener unreadable — artifact unchanged'); return; }
  const day = buildMarketDay({ ...inputs, nowMs: Date.now() });
  await atomicWriteFile(PD('market-day.json'), JSON.stringify(day));
  console.log(`[market-day] facts=${day.facts.length} links=${day.links.length} threads=${day.threads.length} ${JSON.stringify(day.counts)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[market-day] ${error?.message || error}`); process.exitCode = 0; });
}
