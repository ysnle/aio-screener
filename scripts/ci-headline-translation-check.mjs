#!/usr/bin/env node
// v59.70 (owner D6, screen review 12): headline translation belongs to the producers. Every headline a screen shows —
// 뉴스 and 시간대별 시황 (data.json news, newsIntraday, marketTimeline), 오늘의 핵심 and 브리핑 (market-day.json headline
// facts), 실적 요약 (event-briefs.json headline) — is Korean in the artifact, or its original carries titleKoFailed.
//   1. translateDayHeadlines on fixtures: reuse, the free path, the failure mark, and no paid fallback.
//   2. buildDayAccount passes over a report with no Korean title.
//   3. The published artifacts hold no unmarked English headline. market-day.json is held to it once a run of this
//      producer has written its headlineTranslation receipt (the ledger before that predates the lane).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => import(pathToFileURL(join(root, path)).href);
const json = (path) => { try { return JSON.parse(readFileSync(join(root, path), 'utf8')); } catch { return null; } };
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const korean = (text) => (String(text || '').match(/[가-힣]/g) || []).length >= 2;
const shown = (row) => korean(row?.title) || korean(row?.titleKo) || row?.titleKoFailed === true;

const { translateDayHeadlines } = await load('scripts/build-market-day.mjs');
// v59.74 (site QA 11/7): feed tails (' : Finance : JKN', ' | Reuters') are not sent for translation; a lowercase clause after
// a colon is part of the headline.
{
  const { headlineForTranslation } = await load('scripts/producer/market-narrative.mjs');
  check('v59.74 feed tails are cut before translation, headline clauses are kept',
    headlineForTranslation('Gold hits 2-week high; market eyes Fed policy : Finance : JKN') === 'Gold hits 2-week high; market eyes Fed policy'
    && headlineForTranslation('Stocks fall | Fox Business') === 'Stocks fall'
    && headlineForTranslation('Fed holds : what it means for rates') === 'Fed holds : what it means for rates'
    && headlineForTranslation('Exclusive | Major Investors Are Skeptical') === 'Exclusive | Major Investors Are Skeptical');
}
const { buildDayAccount } = await load('src/domain/briefing/day-account.js');

// ── 1. The producer lane.
const headline = (id, title, extra = {}) => ({ id: `headline:${id}`, kind: 'headline', title, ...extra });
const day = { facts: [headline('a', 'Nvidia stock rises on data center demand'), headline('b', 'Micron leads chip stocks rebound'),
  headline('c', '엔비디아 실적 발표'), headline('d', 'Old story already translated'), headline('e', 'Untranslatable line here')] };
const previous = { facts: [headline('d', 'Old story already translated', { titleKo: '이미 번역된 기사' })] };
let calls = 0; let asked = [];
const translate = async (titles) => { calls += 1; asked = titles; return { translations: titles.map((title) => (title.startsWith('Untranslatable') ? 'Untranslatable' : title.startsWith('Nvidia') ? '엔비디아 주가, 데이터센터 수요에 상승' : '마이크론, 반도체주 반등 주도')), model: 'fixture' }; };
const receipt = await translateDayHeadlines(day, { previous, translate });
const byId = Object.fromEntries(day.facts.map((fact) => [fact.id, fact]));
check('v59.70 1 a Korean title is not sent', !asked.some((title) => /[가-힣]/.test(title)) && !asked.includes('Old story already translated'), JSON.stringify(asked));
check('v59.70 1 the last ledger\'s Korean title is reused', byId['headline:d'].titleKo === '이미 번역된 기사' && receipt.reused === 1, JSON.stringify(receipt));
check('v59.70 1 Workers AI titles are kept', byId['headline:a'].titleKo?.startsWith('엔비디아') && byId['headline:b'].titleKo?.startsWith('마이크론') && calls === 1);
check('v59.70 1 a rejected title keeps its original and is marked titleKoFailed', !byId['headline:e'].titleKo && byId['headline:e'].titleKoFailed === true && receipt.failed === 1, JSON.stringify(byId['headline:e']));
check('v59.70 1 a Korean or translated headline carries no failure mark', ['a', 'b', 'c', 'd'].every((id) => !byId[`headline:${id}`].titleKoFailed));
const offline = { facts: [headline('x', 'Fed holds rates steady')] };
const offReceipt = await translateDayHeadlines(offline, { translate: async () => ({ translations: null, reason: 'shared-ai-not-configured' }) });
check('v59.70 1 no translation path: the title is marked, nothing paid is called', offline.facts[0].titleKoFailed === true && offReceipt.failed === 1 && !offline.facts[0].titleKo, JSON.stringify(offReceipt));

// ── 2. The account passes over an English report.
const date = '2026-11-03';
const facts = [
  { id: 'stock:AAA:2026-11-03', kind: 'stock-move', subjects: ['AAA'], label: 'Alpha', date, change: -8, rank: 'lead', materiality: 90, explainedBy: ['headline:ko', 'headline:en'] },
  { id: 'headline:en', kind: 'headline', title: 'Alpha shares fall on weak guidance', titleKoFailed: true, subjects: ['AAA'], at: `${date}T15:00:00Z`, date, rank: 'major', materiality: 60 },
  { id: 'headline:ko', kind: 'headline', title: 'Alpha falls', titleKo: '알파 주가, 약한 전망에 하락', subjects: ['AAA'], at: `${date}T16:00:00Z`, date, rank: 'major', materiality: 50 }
];
const account = buildDayAccount({ facts, links: [], coverage: { session: date } });
const cited = (account.stories || []).flatMap((story) => story.evidence || []).map((row) => row.title);
check('v59.70 2 the day account cites the Korean report', cited.includes('알파 주가, 약한 전망에 하락'), JSON.stringify(cited));
check('v59.70 2 the day account passes over the untranslated report', !cited.some((title) => /^Alpha shares/.test(title)), JSON.stringify(cited));

// ── 3. The published artifacts.
const data = json('public-data/data.json') || {};
const bundle = [['뉴스', data.news], ['시간대별 시황 (진행 중)', data.newsIntraday], ['시간대별 시황 현재', data.marketTimeline?.current?.headlines],
  ['시간대별 시황 봉인', (data.marketTimeline?.slots || []).flatMap((slot) => slot?.headlines || [])]];
for (const [name, rows] of bundle) {
  const bad = (Array.isArray(rows) ? rows : []).filter((row) => row?.title && !shown(row));
  check(`v59.70 3 ${name}: every headline is Korean or marked titleKoFailed`, !bad.length, bad.slice(0, 3).map((row) => row.title.slice(0, 60)).join(' | '));
}
const ledger = json('public-data/market-day.json');
let ledgerNote = 'market-day.json missing';
if (ledger?.headlineTranslation) {
  const bad = (ledger.facts || []).filter((fact) => fact.kind === 'headline' && !shown(fact));
  check('v59.70 3 오늘의 핵심·브리핑 (market-day): every headline is Korean or marked titleKoFailed', !bad.length, bad.slice(0, 3).map((fact) => fact.title.slice(0, 60)).join(' | '));
  ledgerNote = `market-day ${ledger.headlineTranslation.failed ?? '?'} marked`;
} else if (ledger) ledgerNote = 'market-day.json predates the translation lane (held to it from the first run that writes headlineTranslation)';
const briefs = json('public-data/event-briefs.json');
const badBriefs = (briefs?.briefs || []).filter((brief) => brief.headline && !korean(brief.headline));
check('v59.70 3 실적 요약: every brief headline is Korean', !badBriefs.length, badBriefs.slice(0, 3).map((brief) => `${brief.symbol}: ${brief.headline}`).join(' | '));

if (failures.length) {
  console.error(`[headline-translation] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`[headline-translation] OK — producer lane (reuse, free path, failure mark, no paid fallback), account passes over English, artifacts clean; ${ledgerNote}`);
