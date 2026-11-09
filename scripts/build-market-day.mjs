#!/usr/bin/env node
// v59.63 phase 1: writes public-data/market-day.json, the one ledger of the last day's moves and events
// (src/domain/market/day/facts.js), from artifacts this refresh and the other producers already published. A run that
// cannot read history or the screener leaves the previous artifact in place.
// v59.70 (owner D6, screen review 12): the one network step — headline facts the news bundle did not translate (the
// screener's per-company memos) get a Korean title here, on the Worker's free Workers AI path only, so every headline
// 오늘의 핵심, 브리핑 and the stock pages show is Korean in the artifact. A title that fails keeps its original and is
// marked titleKoFailed; a screen may show it with that mark or pass it over, never as if it were translated.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteFile } from './lib/atomic-write.mjs';
import { loadThemeMaps } from './build-scenario-state.mjs';
import { buildMarketDay } from '../src/domain/market/day/facts.js';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { HEADLINE_TRANSLATION_MAX, isCleanKoreanTitle, isFaithfulKoreanTitle } from './producer/market-narrative.mjs';
import { requestWorkersAiTranslation } from './lib/ai-shared-analysis.mjs';
import { detectNarratives, narrativeDayLog, publishedNarratives } from '../src/domain/narrative/narratives.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PD = (file) => path.join(ROOT, 'public-data', file);
const readJson = (file) => { try { return JSON.parse(readFileSync(PD(file), 'utf8')); } catch { return null; } };

export function marketDayInputs(read = readJson, root = ROOT) {
  const historyRaw = read('history.json');
  const data = read('data.json') || {};
  const telegram = read('telegram-digest.json');
  return {
    history: readHistoryRows(historyRaw),
    screener: read('screener.json'), universe: read('screener-universe.json')?.universe || [],
    news: [...(data.news || []), ...(data.newsIntraday || [])], signals: telegram?.signals || [], telegramDigest: telegram,
    calendar: read('earnings-calendar.json'), briefs: read('event-briefs.json'), macroHistory: read('macro-history.json'),
    macroCalendar: read('macro-calendar.json'), themes: loadThemeMaps(root).usThemes, indexWeights: read('sp500-weights.json')?.rows || []
  };
}

const hasKoreanTitle = (fact) => isCleanKoreanTitle(fact.title) || isCleanKoreanTitle(fact.titleKo);

/** Korean titles for the ledger's headline facts: reused from the last ledger, else Workers AI; the rest are marked failed. */
export async function translateDayHeadlines(day, { previous = null, translate = null } = {}) {
  const headlines = (day?.facts || []).filter((fact) => fact.kind === 'headline' && fact.title);
  const known = new Map((previous?.facts || []).filter((fact) => fact?.kind === 'headline' && fact.title && isFaithfulKoreanTitle(fact.title, fact.titleKo)).map((fact) => [fact.title, fact.titleKo]));
  let reused = 0; let translated = 0; let reason = null;
  for (const fact of headlines) {
    if (hasKoreanTitle(fact)) continue;
    delete fact.titleKo;
    if (known.has(fact.title)) { fact.titleKo = known.get(fact.title); reused += 1; }
  }
  // The news bundle's translateHeadlines drops a Workers AI batch under 80% yield because it can fall back to the paid
  // model; this lane has no paid fallback, so each title the validator accepts is kept and the rest wait for the next run.
  const pending = headlines.filter((fact) => !hasKoreanTitle(fact)).slice(0, HEADLINE_TRANSLATION_MAX);
  if (pending.length && typeof translate === 'function') {
    let result = null;
    try { result = await translate(pending.map((fact) => fact.title.slice(0, 300))); } catch (_) { result = null; }
    if (Array.isArray(result?.translations) && result.translations.length === pending.length) {
      pending.forEach((fact, index) => {
        const ko = typeof result.translations[index] === 'string' ? result.translations[index].replace(/\s+/g, ' ').trim() : '';
        if (ko.length <= 200 && isFaithfulKoreanTitle(fact.title, ko)) { fact.titleKo = ko; translated += 1; }
      });
    } else reason = result?.reason || 'workers-ai-unavailable';
  } else if (pending.length) reason = 'no-translate';
  let failed = 0;
  for (const fact of headlines) {
    if (hasKoreanTitle(fact)) delete fact.titleKoFailed;
    else { fact.titleKoFailed = true; failed += 1; }
  }
  return { headlines: headlines.length, reused, translated, pending: pending.length, failed, provider: translated ? 'workers-ai' : null, reason };
}

export function narrativesFor(inputs, nowMs, previous = null) {
  try {
    const current = publishedNarratives(detectNarratives({ telegramDigest: inputs.telegramDigest, screener: inputs.screener, news: inputs.news, nowMs }), { nowMs });
    return { ...current, ...narrativeDayLog(previous, current, { nowMs }) };
  }
  catch (error) { return { version: 'narratives.v1', at: new Date(nowMs).toISOString(), stories: [], log: Array.isArray(previous?.log) ? previous.log : [], changes: null, error: String(error?.message || error) }; }
}

async function main() {
  const inputs = marketDayInputs();
  if (!inputs.history.length || !inputs.screener?.data) { console.warn('[market-day] history or screener unreadable — artifact unchanged'); return; }
  const nowMs = Date.now();
  const day = buildMarketDay({ ...inputs, nowMs });
  day.headlineTranslation = await translateDayHeadlines(day, { previous: readJson('market-day.json'), translate: (titles) => requestWorkersAiTranslation(titles) })
    .catch((error) => ({ failed: null, reason: `error:${String(error?.message || error).slice(0, 60)}` }));
  console.log(`[market-day] headline translation ${JSON.stringify(day.headlineTranslation)}`);
  // v59.70 (owner 11/07): the stories the market is relaying, counts only (src/domain/narrative/narratives.js) — the same
  // detection the market reading's prompt uses, so 시장 상태 shows what the reading weighed.
  day.narratives = narrativesFor(inputs, nowMs, readJson('market-day.json')?.narratives || null);
  await atomicWriteFile(PD('market-day.json'), JSON.stringify(day));
  console.log(`[market-day] facts=${day.facts.length} links=${day.links.length} threads=${day.threads.length} ${JSON.stringify(day.counts)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`[market-day] ${error?.message || error}`); process.exitCode = 0; });
}
