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
const { keepDisplacedSessions, heldUsSessionFields, mergeBackfillBars } = await load('scripts/producer/history.mjs');
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

// The live 11/2 NDX placeholder: stamped at the row date's open, valueBasis previous-completed-close, holding the 10/30 close.
const liveHeld = [{ date: '2026-11-02', ndx: 28384.85, fieldMeta: { ndx: { observedAt: '2026-11-02T14:30:00.000Z', valueBasis: 'previous-completed-close', observationRelation: 'carried-forward', sessionDate: '2026-10-30', carriedFrom: '2026-10-30', heldReason: 'session-already-recorded' } } }];
mergeBackfillBars(liveHeld, { '2026-11-02': { date: '2026-11-02', ndx: 28102.4, fieldMeta: { ndx: metaAt('2026-11-02', 'latest-completed-close') } } }, ['ndx']);
check('v59.74 the backfill bar replaces a carried placeholder stamped on its own row date', liveHeld[0].ndx === 28102.4 && liveHeld[0].fieldMeta.ndx.sessionDate === '2026-11-02', JSON.stringify(liveHeld[0]));
// ── 8. v59.84 (screen review C1, recurrence analysis): one fact, one state. P1691/P1761/P2229/P2287 matched one pair of
// screens at a time; this checks every reader of the same fact against its owner on the same close, at the 11/6 close
// where the readers disagreed (HY 348bp with a 20-session record widening; 10-year -38bp with stocks down), and on today's
// files. A reader may word the state differently but never call it another state.
{
  const { buildMarketRead } = await load('src/domain/briefing/market-read.js');
  const { creditJudgement, creditReading } = await load('src/domain/briefing/credit-reading.js');
  const { buildMacroRead } = await load('src/domain/macro/macro-read.js');
  const { participationShift, ROTATION_TITLE, buildMarketScenarios } = await load('src/domain/market/regime-scenarios.js');
  const { buildMarketInterpretation } = await load('src/domain/interpretation/market-interpretation.js');
  const data = json('public-data/data.json');
  const cut = (rows, day) => rows.filter((row) => String(row.date || '') <= day);
  for (const day of ['2026-11-06', null]) {
    const at = day ? cut(history, day) : history;
    if (day && !at.some((row) => row.date === day)) continue; // the fixture close rolled out of the published window
    const hyAt = oasDelta20Bp(macroHistory, 'hyOas', day);
    const reg = buildMarketRegime({ history: at, macroHistory, credit: hyAt ? { hyBp: hyAt.level * 100, hyAsOf: hyAt.date } : {}, now: day ? Date.parse(`${day}T23:00:00Z`) : Date.now() });
    const axis = (id) => (reg.axes || []).find((row) => row.id === id);
    const tag = day || 'today';
    const judgement = creditJudgement(macroHistory, hyAt?.date || null);
    if (axis('credit') && judgement) {
      check(`v59.84 [${tag}] the credit judgement every reader uses is the 시장 상태 credit axis state`, judgement.state === axis('credit').state, `${judgement.state} vs ${axis('credit').state}`);
      const storyAt = buildMarketStory({ history: at, macroHistory, nowMs: day ? Date.parse(`${day}T23:00:00Z`) : Date.now() });
      const storyCredit = storyAt.checks?.find((row) => row.id === 'credit');
      const storyKind = storyAt.credit?.kind;
      if (storyKind) check(`v59.84 [${tag}] 시장 이야기 credit is 'stress' exactly when the axis is 부담`, (storyKind === 'stress') === (judgement.state === 'burden'), `${storyKind} vs ${judgement.state}`);
      if (storyCredit) check(`v59.84 [${tag}] 시장 이야기 credit sentence is the shared credit reading`, storyCredit.read === creditReading(storyAt.credit.judgement, { cccTail: storyAt.credit.cccTail }), storyCredit.read);
      const reading = creditReading(judgement);
      check(`v59.84 [${tag}] a 부담 from speed never reads as a level "폭"`, judgement.state !== 'burden' || judgement.cause.level || (!/크게 벌어졌|번질 수 있는 폭/.test(reading) && /부담 기준 [\d.]+% 아래/.test(reading)), reading);
      const chaptersAt = buildMacroChapters({ macroHistory, history: at });
      const creditChapter = (Array.isArray(chaptersAt) ? chaptersAt : chaptersAt?.chapters || []).find((chapter) => chapter.id === 'credit');
      if (creditChapter && !day) check(`v59.84 [${tag}] 매크로 신용 장 state is the axis state`, creditChapter.state === axis('credit').state, `${creditChapter.state} vs ${axis('credit').state}`);
      if (creditChapter && !day) check(`v59.84 [${tag}] 매크로 신용 장 flip offers no condition that already holds`, !(judgement.state === 'burden' && !judgement.cause.level && /% 아래로 내려오고/.test(creditChapter.flip || '')), creditChapter.flip);
    }
    const macroAt = buildMacroRead({ macro: data.macro || null, macroHistory, regime: reg, history: at });
    const nodes = [...(macroAt?.chain?.nodes || []), ...(macroAt?.chain?.branches || [])];
    for (const id of ['rates', 'credit']) {
      const node = nodes.find((row) => row.id === id); const state = axis(id)?.state;
      if (!node || !state || state === 'unknown' || node.held) continue;
      const expected = state === 'neutral' ? 'flat' : state;
      check(`v59.84 [${tag}] 매크로 연결 상자 ${id} node colours the axis state`, node.impact === expected, `${node.impact} vs axis ${state}`);
    }
    if (axis('rates')?.state !== 'favorable') check(`v59.84 [${tag}] 연결 상자 never says the discount rate is easing while the rates axis is not 양호`, !(macroAt?.chain?.links || []).some((line) => /할인율 부담이 줄고/.test(line)), (macroAt?.chain?.links || []).join(' / '));
    const read = buildMarketRead({ history: at, macroHistory, credit: hyAt ? { hyBp: hyAt.level * 100, hyAsOf: hyAt.date } : {}, now: day ? Date.parse(`${day}T23:00:00Z`) : Date.now() });
    const checks = JSON.stringify(read || {});
    if (axis('credit')?.state !== 'favorable') check(`v59.84 [${tag}] no check offers "양호 조건 상실" while credit is not 양호`, !/양호 조건 상실/.test(checks), (checks.match(/[^"]{0,60}양호 조건 상실[^"]{0,20}/) || [''])[0]);
    const shift = participationShift(at);
    const scen = buildMarketScenarios({ history: at, macroHistory }, { regime: reg });
    if (scen?.available && shift.widening && scen.leadership?.break) check(`v59.84 [${tag}] a leadership break with widening participation is read as rotation, not 동반 약세`, scen.transitionTitle === ROTATION_TITLE && scen.scenarios.every((item) => !item.transition || item.transition === ROTATION_TITLE), scen.transitionTitle);
    if (day) {
      check(`v59.84 [${tag}] fixture: participation widened at the 11/6 close (50일선 위 +26.8%p, 동일가중 +7.0%p)`, shift.widening && shift.breadthPp === 26.8 && shift.equalLeadPp === 7, JSON.stringify(shift));
      check(`v59.84 [${tag}] fixture: the 11/6 credit is a 20-session 부담 below the level line`, judgement?.state === 'burden' && judgement.cause.wide20 && !judgement.cause.level, JSON.stringify(judgement?.cause));
    }
  }
  void buildMarketInterpretation;
}

// ── 9. v59.85 (chart review 2026-11-08): one trend vocabulary. The 기술적 분석 index cards, the stock table under them, the
// 종목 page, the screener and the stock chart's chip/areas all read bands.js classifyTrend; on today's files a word is
// never another screen's word for a different state, and an index card says the word the classifier gives its position.
{
  const { classifyTrend, trendKey, bufferedTrend } = await load('src/domain/technical/bands.js');
  const { TREND_WORDS, indexChartReadings, coreStockRows } = await load('src/domain/technical/market-charts.js');
  const { trendOfBars } = await load('src/domain/technical/trend-state.js');
  for (const reading of indexChartReadings(history)) {
    if (!Number.isFinite(reading.ma50) || !Number.isFinite(reading.ma200)) continue;
    const own = classifyTrend({ s50: (reading.close / reading.ma50 - 1) * 100, s200: (reading.close / reading.ma200 - 1) * 100, positionOnly: true });
    check(`v59.85 index card ${reading.field} trend is the shared classifier's`, reading.trend === trendKey(own) && reading.trendWord === own.label, `${reading.trend}/${reading.trendWord} vs ${trendKey(own)}/${own.label}`);
  }
  for (const [s50, s200] of [[10, 22], [-5, 5.5], [-15, -5.6], [5.6, -5], [16.7, 5], [-5.6, -15]]) {
    const t = classifyTrend({ s50, s200, positionOnly: true });
    check(`v59.85 TREND_WORDS.${trendKey(t)} is the classifier's word`, TREND_WORDS[trendKey(t)] === t.label, `${TREND_WORDS[trendKey(t)]} vs ${t.label}`);
  }
  const screenerRows = (() => { try { const file = json('public-data/screener.json'); return Object.entries(file.data || {}).map(([sym, row]) => (row && !Array.isArray(row) ? { ...(file.rowDefaults || {}), ...row, sym } : null)); } catch (_) { return []; } })()
    .map((row) => (Array.isArray(row) ? null : row)).filter((row) => row?.sym);
  const rows = coreStockRows({ screener: { data: Object.fromEntries(screenerRows.map((row) => [row.sym, row])) }, indexWeights: screenerRows.slice(0, 10).map((row, i) => ({ sym: row.sym, weight: 10 - i })) });
  check('v59.85 the stock-table check read screener rows', rows.length >= 5, String(rows.length));
  for (const row of rows) {
    const own = bufferedTrend(screenerRows.find((item) => item.sym === row.sym));
    if (own) check(`v59.85 stock table ${row.sym} says the 종목 page's word`, row.trendWord === own.label, `${row.trendWord} vs ${own.label}`);
  }
  // The chart's bars and a screener row built from the same numbers name one state.
  const bars = Array.from({ length: 260 }, (_, i) => { const c = 100 + Math.sin(i / 9) * 6 + i * 0.05; return { time: `t${i}`, open: c, high: c * 1.012, low: c * 0.988, close: c }; });
  const closes = bars.map((bar) => bar.close), mean = (n) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const row = { pctSma50: (closes.at(-1) / mean(50) - 1) * 100, pctSma200: (closes.at(-1) / mean(200) - 1) * 100, adrPct: bars.slice(-20).reduce((a, b) => a + (b.high - b.low) / b.close * 100, 0) / 20, ret5d: (closes.at(-1) / closes.at(-6) - 1) * 100 };
  check('v59.85 chart bars and the screener row read one trend word', trendOfBars(bars)?.label === bufferedTrend(row)?.label, `${trendOfBars(bars)?.label} vs ${bufferedTrend(row)?.label}`);
}

if (failures.length) {
  console.error(`[metric-consistency] ${failures.length} failure(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`[metric-consistency] OK — 10-year ${ten5}/${ten20}bp and HY ${hy ? `${Math.round(hy.d5)}/${Math.round(hy.value)}` : '—'}bp agree across 시장 상태, 매크로 and 연결해서 보면; day-move, week-ahead, 오늘 and brief rules hold`);
