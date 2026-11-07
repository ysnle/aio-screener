#!/usr/bin/env node
// v59.70 (screen review 2026-11-04, items 5–10, 12, 17, 22, 31, 33): one metric, one value on every screen. The HY spread
// read +31/+34/+40/+25bp and the 10-year -32/-40bp across 시장 상태, 매크로 and 연결해서 보면 because each screen cut its own
// window from its own source. This gate builds every screen's model from the same published files and checks that they
// quote the same number for the same metric and window; then the day-move, week-ahead and 오늘 list rules on fixtures.
// Behaviour only: every check calls an exported model function (no source text is read).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => import(pathToFileURL(join(root, path)).href);
const json = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const num = (text, re) => { const hit = String(text || '').match(re); return hit ? Number(hit[1].replace('−', '-')) : null; };

const { buildMarketRegime, oasDelta20Bp } = await load('src/domain/briefing/market-read.js');
const { buildMacroChapters } = await load('src/domain/macro/macro-chapters.js');
const { buildMarketStory } = await load('src/domain/market/market-story.js');
const { crossReadings } = await load('src/domain/market/cross-readings.js');
const { buildMarketDay } = await load('src/domain/market-day/facts.js');
const { buildDayAccount } = await load('src/domain/briefing/day-account.js');
const { keyStocks } = await load('src/ui/components/home-day.js');
const { homeBriefTiers, EVENT_BRIEFS_SCHEMA } = await load('src/domain/briefing/event-briefs.js');

// ── 1. The published files, every screen's model (items 5 and 6).
const { readHistoryRows } = await load('src/domain/market/history-rows.js');
const history = readHistoryRows(json('public-data/history.json'));
const macroHistory = json('public-data/macro-history.json');
const hy = oasDelta20Bp(macroHistory, 'hyOas');
const regime = buildMarketRegime({ history, macroHistory, credit: hy ? { hyBp: hy.level * 100, hyAsOf: hy.date } : {}, now: Date.now() });
const tenRow = (regime.axes || []).find((axis) => axis.id === 'rates')?.evidence?.find(([label]) => label === '미 10년물')?.[1] || '';
const ten20 = num(tenRow, /20일 ([+-]?\d+)bp/); const ten5 = num(tenRow, /5거래일 ([+-]?\d+)bp/);
const model = buildMacroChapters({ macroHistory, history });
const chapters = Array.isArray(model) ? model : model?.chapters || [];
const ratesNow = chapters.find((chapter) => chapter.id === 'rates')?.now || '';
const creditNow = chapters.find((chapter) => chapter.id === 'credit')?.now || '';
const story = buildMarketStory({ history, macroHistory });
const storyRow = (id) => story.checks?.find((row) => row.id === id)?.value || '';
const pair = crossReadings({ history, macroHistory }).map((row) => row.text).find((text) => /미국 10년 금리/.test(text)) || '';
check('v59.70 the verdict table has a 10-year 5- and 20-session change', ten20 != null && ten5 != null, tenRow);
check('v59.70 5 HY: the published OAS has a 20-session and a 5-session reading', hy?.value != null && hy?.d5 != null);
if (ten20 != null) {
  check('v59.70 6 매크로 rates chapter quotes the verdict table\'s 10-year 20-session change', num(ratesNow, /10년 [\d.]+ → [\d.]+% \([^,]+, ([+-]?\d+)bp\)/) === ten20, `${ratesNow} vs ${ten20}`);
  const tenBar = chapters.find((chapter) => chapter.id === 'rates')?.viz?.points?.find((point) => point.x === '10년')?.value;
  check('v59.70 6 매크로 rates chapter draws the same 10-year bar', tenBar != null && Math.round(tenBar) === ten20, `${tenBar} vs ${ten20}`);
  if (pair) check('v59.70 6 연결해서 보면 quotes the same 10-year change', num(pair, /미국 10년 금리 ([+-]?\d+)bp/) === ten20, pair.slice(0, 80));
}
if (ten5 != null && storyRow('rates')) check('v59.70 6 시장 상태 story quotes the verdict table\'s 10-year 5-session change', num(storyRow('rates'), /10년 [\d.]+ → [\d.]+% \(([+-]?\d+)bp\)/) === ten5, `${storyRow('rates')} vs ${ten5}`);
if (hy?.value != null) {
  const hy20 = Math.round(hy.value); const hy5 = Math.round(hy.d5);
  check('v59.70 5 매크로 credit chapter quotes the one 20-session OAS reading', num(creditNow, /하이일드 [\d.]+ → [\d.]+% \(([+-]?\d+)bp\)/) === hy20, `${creditNow} vs ${hy20}`);
  if (pair) check('v59.70 5 연결해서 보면 quotes the same HY change', num(pair, /하이일드 스프레드 ([+-]?\d+)bp/) === hy20, pair.slice(0, 120));
  if (storyRow('credit')) check('v59.70 5 시장 상태 story quotes the one 5-session OAS reading', num(storyRow('credit'), /하이일드 [\d.]+ → [\d.]+% \(([+-]?\d+)bp\)/) === hy5, `${storyRow('credit')} vs ${hy5}`);
}
// A threshold is said as a threshold: every credit flip distance short label starts with 기준.
const creditAxis = (regime.axes || []).find((axis) => axis.id === 'credit');
for (const distance of creditAxis?.flipDistances || []) {
  if (/bp/.test(distance.short || '') && /\d+bp\(/.test(distance.short || '')) check('v59.70 5 a credit threshold label opens with 기준', /^기준 /.test(distance.short), distance.short);
}

// ── 2. A day move is one session (items 7 and 8): a carried-forward close is not a one-day step.
const days = []; for (let ms = Date.parse('2026-08-03T00:00:00Z'); days.length < 70; ms += 86400000) { const d = new Date(ms); if (d.getUTCDay() % 6) days.push(d.toISOString().slice(0, 10)); }
const rows = days.map((date, index) => ({ date, spx: 6000 + index * 3 + (index % 3), ndx: 20000 + index * 9 + (index % 4) * 5, wti: 70 + (index % 5) }));
rows.at(-2).ndx = null; // the producer carried the ndx close the session before the last
const day = buildMarketDay({ history: rows, nowMs: Date.parse(`${days.at(-1)}T22:00:00Z`) });
const facts = Array.isArray(day?.facts) ? day.facts : [];
check('v59.70 7 no one-day 나스닥100 fact spans a missing session', !facts.some((fact) => fact.kind === 'price' && fact.asset === 'ndx'), JSON.stringify(facts.filter((fact) => fact.asset === 'ndx')));
check('v59.70 7 a full series still gives its day move', facts.some((fact) => fact.kind === 'price' && fact.asset === 'spx'));
const priceLines = buildDayAccount({ ...day, facts: facts.map((fact) => (fact.kind === 'price' ? { ...fact, rank: 'major', materiality: 90, z: 3 } : fact)) }).stories?.filter((row) => row.kind === 'price') || [];
check('v59.70 8 a price story names its close date first', priceLines.length > 0 && priceLines.every((row) => /^\d{1,2}\/\d{1,2} 종가 /.test(row.line)), priceLines.map((row) => row.line).join(' | '));

// ── 3. '다음 주' starts at the reader's KST day (item 9): 11/3's vote at 11/4 01:00 KST is over.
const before = buildMarketStory({ history, macroHistory, nowMs: Date.parse('2026-11-02T04:00:00Z') });
const after = buildMarketStory({ history, macroHistory, nowMs: Date.parse('2026-11-03T16:00:00Z') });
const kstDay = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
check('v59.70 9 the week-ahead list keeps a coming event', !before.available || (before.week || []).some((row) => row.date === '2026-11-03'));
check('v59.70 9 the week-ahead list has no event before the KST day', !after.available || (after.week || []).every((row) => !row.date || row.date >= kstDay(Date.parse('2026-11-03T16:00:00Z'))), JSON.stringify((after.week || []).map((row) => row.date)));

// ── 4. A watch row with no observation is not drawn (item 10).
const leadership = (buildMarketRegime({ history: rows, now: Date.parse(`${days.at(-1)}T22:00:00Z`) }).watchAxes || []).find((axis) => axis.id === 'leadership');
check('v59.70 10 AI·반도체 집중 without a SOXX close is marked unobserved', leadership?.observed === false);

// ── 5. 오늘's names (item 33) and the release marks (item 31).
const stocks = keyStocks({ facts: [['285A.T', -15.8], ['BRK.B', 3], ['005930.KS', 4], ['NVDA', 2]].map(([sym, change]) => ({ kind: 'stock-move', rank: 'major', subjects: [sym], label: sym, change })) }).map((row) => row.sym);
check('v59.70 33 오늘 lists US names first, Korean next, no third market', stocks.join(',') === 'BRK.B,NVDA,005930.KS', stocks.join(','));
const nowMs = Date.parse('2026-11-04T00:00:00Z');
const tiers = homeBriefTiers({ schemaVersion: EVENT_BRIEFS_SCHEMA, briefs: [{ kind: 'earnings', symbol: 'ALAB', status: 'complete', publishedAt: '2026-11-03T21:00:00Z', headline: 'Scorpio™ X와 PCIe® 6 매출', checkText: 'Scorpio™' }] }, { nowMs });
const shown = [...tiers.core, ...tiers.notable, ...tiers.rest];
check('v59.70 31 a brief shows no ™ ® ℠', shown.length === 1 && !/[™®℠]/.test(JSON.stringify({ ...shown[0], checkText: '' })) && shown[0].checkText === 'Scorpio™', JSON.stringify(shown[0] || null));

// ── 6. Screen re-review 2026-11-06 (89e8c881).
const { buildRegimeRadar } = await load('src/domain/market/regime-radar.js');
const { buildKrwDecomposition } = await load('src/domain/macro/krw-decomposition.js');
const { closeChange } = await load('src/domain/market/market-windows.js');
const { oneSessionDay } = await load('src/domain/market-day/one-session.js');
const { koreaLinks } = await load('src/domain/market/session-bridge.js');
const { fxSideWord } = await load('src/domain/macro/rates-fx.js');
const { coreStockRows } = await load('src/domain/technical/market-charts.js');
// #5: one HY reading per window — the radar's '피난성' sentence quotes the same 5-session change, and a threshold label
// never prints a '+Nbp' that reads as a second 20-session change (기준 346bp(20일 +34bp) beside the measured +31bp).
if (hy?.d5 != null) {
  const radar = buildRegimeRadar({ history }, { macroHistory });
  const said = num(radar.lead, /하이일드 스프레드가 \+(\d+)bp 벌어져/);
  check('v59.70 re-review 5 the radar quotes the one 5-session HY change', said == null || said === Math.round(hy.d5), `${said} vs ${Math.round(hy.d5)}`);
}
for (const distance of creditAxis?.flipDistances || []) check('v59.70 re-review 5 a credit threshold label carries no +Nbp change', !/\+\d+bp/.test(distance.short || ''), distance.short);
// N2: the KOSPI 20-session change is one number on 금리와 환율, 매크로 and 시장 상태.
const kospi20 = closeChange(history, 'kospi', 20);
if (kospi20) {
  const want = Math.round(kospi20.pct * 10) / 10;
  const krw = buildKrwDecomposition(history);
  if (krw.available && krw.kospiMove != null) check('v59.70 re-review N2 the won decomposition quotes the KOSPI 20 Korean sessions', Math.round(krw.kospiMove * 10) / 10 === want, `${krw.kospiMove} vs ${want}`);
  const growth = chapters.find((chapter) => chapter.id === 'growth')?.now || '';
  if (/코스피/.test(growth)) check('v59.70 re-review N2 매크로 growth chapter quotes the same KOSPI 20-session change', num(growth, /코스피 ([+-]?[\d.]+)%/) === want, `${growth} vs ${want}`);
}
// #7 · #8: a ledger day move over a carried close is dropped where 오늘 and 브리핑 read it (the 11/3 ledger: WTI -7.7%,
// 나스닥100 -0.7% over a missing 11/2 close), so the 브리핑 table's '—' and 오늘의 핵심 agree.
const gapRows = rows.map((row) => ({ ...row }));
gapRows.at(-2).wti = null;
const ledger = { facts: [{ id: 'price:wti:x', kind: 'price', asset: 'wti', label: 'WTI 유가', date: gapRows.at(-1).date, change: -7.7, unit: 'pct', rank: 'lead', materiality: 90 },
  { id: 'price:spx:x', kind: 'price', asset: 'spx', label: 'S&P 500', date: gapRows.at(-1).date, change: 0.4, unit: 'pct', rank: 'major', materiality: 60 }], links: [{ from: 'price:wti:x', to: 'price:spx:x', basis: 'family' }] };
const kept = oneSessionDay(ledger, gapRows);
check('v59.70 re-review 8 a day move over a missing close leaves the day ledger', kept.facts.map((fact) => fact.asset).join(',') === 'spx' && kept.links.length === 0, JSON.stringify(kept.facts.map((fact) => fact.asset)));
const told = JSON.stringify(buildDayAccount(oneSessionDay({ ...ledger, facts: ledger.facts.map((fact) => ({ ...fact, z: 3 })) }, gapRows)));
check('v59.70 re-review 8 오늘의 핵심 does not tell the two-session WTI move', !/WTI 유가 -7\.7%/.test(told), told.slice(0, 160));
// #7: the cause check names the US session it read, so 나스닥 종합 there and 나스닥100 elsewhere read as one close.
const links = koreaLinks({ kospi: { change: -3.4, observedAt: '2026-11-04T06:30:00Z' }, nasdaq: { change: 0.8, observedAt: '2026-11-03T20:30:00Z' } });
check('v59.70 re-review 7 the cause check dates its US session', links.find((link) => link.id === 'us')?.label === '직전 미국장 11/3', links.find((link) => link.id === 'us')?.label);
// N3: a 0.0% currency change has no side word.
check('v59.70 re-review N3 no side word on a change shown as 0.0%', fxSideWord('usdjpy', -0.02) === '' && fxSideWord('usdjpy', -0.3) === '(엔 강세)' && fxSideWord('usdkrw', 0.04) === '');
// N7: 브리핑's unexplained moves and 기술적 분석's movers follow 오늘's US → Korea order, no third market.
const moves = [['285A.T', -15.8], ['2454.TW', -6], ['005930.KS', 4], ['NVDA', 2]].map(([sym, change]) => ({ id: `stock-move:${sym}`, kind: 'stock-move', rank: 'major', subjects: [sym], label: sym, change, materiality: 60 }));
const unexplained = buildDayAccount({ facts: moves }).unexplained.map((row) => row.sym).join(',');
check('v59.70 re-review N7 브리핑 unexplained moves: US first, Korean next, no third market', unexplained === 'NVDA,005930.KS', unexplained);
const screenerData = Object.fromEntries(moves.map((fact) => [fact.subjects[0], { pctSma50: 1, pctSma200: 2 }]));
const charted = coreStockRows({ screener: { data: screenerData }, day: { facts: moves } }).map((row) => row.sym).join(',');
check('v59.70 re-review N7 기술적 분석 movers: US first, Korean next, no third market', charted === 'NVDA,005930.KS', charted);

// ── 7. v59.74 weekly outlook review (11/7): the next release, the week list, the biggest day and the held closes.
const { nextDecidingEvent } = await load('src/domain/market/macro-crossroads.js');
const { keepDisplacedSessions, heldUsSessionFields } = await load('scripts/producer/history.mjs');
const cpi = { id: 'us-cpi', name: 'CPI (소비자물가)', date: '2026-11-10', when: '11/10(화) 22:30 KST' };
const retail = { id: 'us-retail', name: '소매판매', date: '2026-11-17', when: '11/17(화) 22:30 KST' };
const tie = ['reflation', 'aibust', 'volshock'];
check('v59.74 the shared next release is the earliest one any branch reads (CPI before a tie-only retail)', nextDecidingEvent([cpi, retail], tie)?.id === 'us-cpi', nextDecidingEvent([cpi, retail], tie)?.id);
check('v59.74 the tie decider is published apart', nextDecidingEvent([cpi, retail], tie, { inPlayOnly: true })?.id === 'us-retail');
const weekHistory = history.filter((row) => row.date <= '2026-11-07');
const calendarFixture = { earnings: [{ symbol: 'CSCO', date: '2026-11-12', hour: 'amc', indexWeight: 0.64 }, { symbol: 'AMAT', date: '2026-11-12', hour: 'amc', indexWeight: 0.46 },
  { symbol: 'TDG', date: '2026-11-10', hour: 'bmo', indexWeight: 0.09 }, { symbol: 'CRWV', date: '2026-11-10', hour: 'amc', indexWeight: null }] };
const weekStory = buildMarketStory({ history: weekHistory, macroHistory, calendar: calendarFixture, nextEvent: cpi, decidingEvent: retail, events: [cpi, retail],
  storySymbols: new Map([['CRWV', 'AI 인프라 조달·신용']]), nowMs: Date.parse('2026-11-07T10:00:00Z') });
if (weekStory.available) {
  const titles = (weekStory.week || []).map((row) => row.title);
  check('v59.74 the week list carries the 11/10 CPI', (weekStory.week || []).some((row) => row.kind === 'macro' && row.date === '2026-11-10'), JSON.stringify(titles));
  check('v59.74 an empty 1% week lists the two heaviest reports at 0.3%+', titles.some((t) => /CSCO 0\.6% · AMAT 0\.5%/.test(t)) && !titles.some((t) => /TDG/.test(t)), JSON.stringify(titles));
  check('v59.74 a report a current story is about joins the list', (weekStory.week || []).some((row) => row.title === 'CRWV 실적' && row.story === 'AI 인프라 조달·신용' && /'AI 인프라 조달·신용' 이야기의 당사자/.test(row.why)), JSON.stringify(titles));
  check('v59.74 the biggest session is named with its breadth', weekStory.bigDay?.date === '2026-11-05' && /가장 큰 하루는 .*11\/5\(목\) S&P 500 -4\.4%.*전면 매도/.test(weekStory.lead), weekStory.lead);
  check('v59.74 a broad sell-off day withdraws "시장 전체가 팔린 것은 아닙니다"', !/시장 전체가 팔린 것은 아닙니다/.test(weekStory.lead), weekStory.lead);
}
const { biggestDay } = await load('src/domain/market/market-story.js');
const spxRow = (date, spx) => ({ date, spx, fieldMeta: { spx: { observedAt: `${date}T21:00:00.000Z`, observationRelation: 'latest-completed-close', sessionDate: date } } });
const gapDay = biggestDay([spxRow('2026-11-02', 100), spxRow('2026-11-03', 101.5), spxRow('2026-11-05', 104.5), spxRow('2026-11-06', 104.6)], { from: '2026-11-02', to: '2026-11-06', events: [] });
check('v59.74 a two-session span over a missing close is not the biggest day', gapDay === null, JSON.stringify(gapDay));
const metaAt = (session, relation, extra = {}) => ({ observedAt: `${session}T05:00:00.000Z`, observationRelation: relation, sessionDate: session, ...extra });
const heldHist = [
  { date: '2026-11-03', wti: 96.09, fieldMeta: { wti: metaAt('2026-11-03', 'latest-completed-close') } },
  { date: '2026-11-04', wti: 96.09, fieldMeta: { wti: metaAt('2026-11-03', 'carried-forward', { carriedFrom: '2026-11-03', heldReason: 'session-already-recorded' }) } },
  { date: '2026-11-05', wti: 93.1, fieldMeta: { wti: metaAt('2026-11-04', 'previous-completed-close', { valueBasis: 'previous-completed-close' }) } }];
check('v59.74 a weekday held close is found for repair', heldUsSessionFields(heldHist, Date.parse('2026-11-06T02:00:00Z')).some((row) => row.field === 'wti' && row.date === '2026-11-04'));
const keptRows = keepDisplacedSessions(heldHist, '2026-11-05', { fieldMeta: { wti: metaAt('2026-11-05', 'latest-completed-close') } }, { fields: ['wti'] });
check('v59.74 a displaced close replaces a carried placeholder in its own row', keptRows.length === 1 && heldHist[1].wti === 93.1 && heldHist[1].fieldMeta.wti.sessionDate === '2026-11-04', JSON.stringify(heldHist[1]));

if (failures.length) {
  console.error(`[metric-consistency] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`[metric-consistency] OK — 10-year ${ten5}/${ten20}bp and HY ${hy ? `${Math.round(hy.d5)}/${Math.round(hy.value)}` : '—'}bp agree across 시장 상태, 매크로 and 연결해서 보면; day-move, week-ahead, 오늘 and brief rules hold`);
