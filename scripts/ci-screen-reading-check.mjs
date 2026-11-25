#!/usr/bin/env node
// v60.31 (owner 2026-11-18, text architecture): the per-screen AI reading — fact packet, prompt, validator, producer and
// the screen's gate. No model call and no network: every requester is a stub, and the Worker transport is exercised with a
// fetch stub only. The last section builds the 시장 상태 packet from the repository's own public-data (history.json and
// the artifacts the screens read).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREEN_READING_IDS, SCREEN_READING_RULES, SCREEN_READING_SCHEMA, buildScreenPacket, buildScreenReadingPrompt, buildScreenReadingRetryPrompt, unsupportedFigures, validateScreenReading } from './lib/screen-reading.mjs';
import { genScreenReadings, screenReadingsOutcome, SCREEN_READING_PROVIDER_ATTEMPTS } from './producer/screen-readings.mjs';
import { SHARED_AI_PURPOSES, requestSharedAnalysis, sharedAiPurpose } from './lib/ai-shared-analysis.mjs';
import { estimateAiCostUsd } from '../src/domain/briefing/event-briefs.js';
import { interpretationFromArtifacts } from './lib/market-interpretation-inputs.mjs';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { serverScreenReading } from '../src/data/server-screen-readings.js';
import { readingLimitsOf } from '../src/ai/reading/reading-limits.js';
import { renderScreenReading } from '../src/ui/components/screen-reading.js';
import { SUBJECT_READING_KINDS, buildSubjectPacket, buildSubjectPrompt, validateSubjectReading } from '../src/ai/reading/subject-reading.js';
import { writeSubjectReading } from '../src/ui/components/subject-reading.js';
import { cachedSubjectReading, rememberSubjectReading } from '../src/storage/subject-readings.js';
import { extractCompletedResponseText } from '../src/domain/ai/responses-payload.js';
import { extractCompletedResponseText as producerExtract } from './lib/ai-shared-analysis.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? `: ${String(detail).slice(0, 700)}` : ''}`); };
const section = async (name, run) => { try { await run(); } catch (error) { failures.push(`${name} threw: ${error?.stack || error}`); } };

// A fixed interpretation: the six US axes of 시장 상태 (plus the Korean axis, which the screen counts apart), the 매크로 read.
const axis = (id, title, state, stateLabel, evidence, flip, basis = '11/18') => ({ id, title, state, stateLabel, evidence, flip, basis, read: `${title} 축의 코드 해석 문장입니다.` });
// The market input the 투자 심리 cards read: weekday closes to 11/18 with F&G 25 and VIX ÷ 3개월 VIX 1.01 on the last, and the
// weekly AAII survey of 11/11.
const SESSIONS = [];
for (let t = Date.parse('2026-09-01T12:00:00Z'); t <= Date.parse('2026-11-18T12:00:00Z'); t += 86400000) { const day = new Date(t); if (day.getUTCDay() % 6) SESSIONS.push(day.toISOString().slice(0, 10)); }
const MOOD_HISTORY = SESSIONS.map((date, i) => ({ date, spx: 7000 + i, fg: i === SESSIONS.length - 1 ? 25 : 40, vix: i === SESSIONS.length - 1 ? 24.56 : 18, vix3m: i === SESSIONS.length - 1 ? 24.3 : 20 }));
const FIXTURE = {
  inputs: { history: MOOD_HISTORY, credit: { fg: 25, fgAsOf: '2026-11-18', aaiiAsOf: '2026-11-11' }, rates: {}, macroHistory: null, now: Date.parse('2026-11-19T00:30:00Z'), aaii: { bullish: 30.8, bearish: 51.4, observedAt: '2026-11-11' } },
  regime: {
    available: true, asOf: '2026-11-18', overall: '부담 우세', counts: { favorable: 0, neutral: 4, burden: 2, unknown: 0 }, leadership: { state: 'break' },
    watchAxes: [{ id: 'sentiment', title: '심리', state: 'burden', stateLabel: '부담', watch: true, evidence: [['시장 모멘텀', '2 (최근 165거래일 백분위)'], ['판정 사유', '공포 쪽 쏠림 (6/6)']], flip: '현재 관측 구성 요소의 절반 넘게 1년 하위 20% 안이면 부담(공포 쪽), 아니면 중립.', basis: '11/18', read: '심리 축의 코드 해석 문장입니다.' }],
    axes: [
      axis('trend', '추세', 'burden', '부담', [['S&P 500', '7,323.63 (20일 -5.6%)'], ['50일선 대비', '-4.25%'], ['50일선 / 200일선', '7,649 / 7,347']], 'S&P 500이 50일선(7,649) 위로 마감하면 중립으로 바뀜'),
      axis('breadth', '시장 폭', 'neutral', '중립', [['50일선 위 종목 (중기)', '57%'], ['200일선 위 종목 (장기)', '58%'], ['52주 신고가 / 신저가', '3 / 6']], '50일선·200일선 위 종목 비율이 모두 60% 이상이면 양호, 하나라도 40% 아래면 부담'),
      axis('volatility', '변동성', 'burden', '부담', [['VIX', '24.56 (5일 +40%)'], ['단기 불안 비율', '1.01 (역전)']], 'VIX 20 미만이면 중립으로 바뀜'),
      axis('rates', '금리', 'neutral', '중립', [['미 10년물', '5.07% (5거래일 +7bp, 20일 -8bp), 11/18']], '10년물 20일 +25bp 이상이면 부담', '11/17~11/18'),
      axis('credit', '신용', 'neutral', '중립', [['하이일드 스프레드', '343bp (5거래일 +13bp), 11/17'], ['공포·탐욕 (참고)', '25, 11/18']], '하이일드 스프레드 350bp 미만이면 양호', '11/17~11/18'),
      axis('commodities', '유가와 달러', 'neutral', '중립', [['WTI', '86.01달러 (20일 -15.5%)'], ['달러 지수', '103.49 (20일 +1.7%)']], 'WTI 20일 +10%면 부담'),
      axis('korea', '환율 (원, 엔)', 'neutral', '중립', [['원/달러', '1,332.7원']], '원/달러 20일 +2% 이상이면 부담')
    ]
  },
  macroRead: {
    regime: { label: '국면 판정 보류', inputs: [['근원 PCE (9월)', '최근 3개월 연율 2.9%, 전년 대비 3.1%', '차이 0.5%p 이상이면 그 방향', '방향 없음']] },
    counts: { favorable: 1, neutral: 1, burden: 1, unknown: 0 },
    axes: [
      { id: 'growth', title: '성장', state: 'favorable', stateLabel: '양호', evidence: [['실업률', '4.1% (전월 -0.1%p)']], flip: 'Sahm 지표 0.5%p 이상이면 부담', asOf: '2026-10-01', read: '코드 문장' },
      { id: 'inflation', title: '물가', state: 'burden', stateLabel: '부담', evidence: [['근원 PCE (전년 대비)', '3.1%']], flip: '근원 PCE 2.5% 이하면 양호', asOf: '2026-09-01', read: '코드 문장' },
      { id: 'rates', title: '금리', state: 'neutral', stateLabel: '중립', evidence: [['미 10년물', '5.07%']], flip: '20일 +25bp 이상이면 부담', basis: '11/17~11/18', read: '코드 문장' }
    ]
  }
};
const GOOD = '11/18 종가 기준 시장 상태는 부담 우세입니다. 추세와 변동성이 부담으로, S&P 500은 50일선보다 -4.25% 아래이고 VIX는 24.56으로 5일 +40% 올랐습니다. 반면 신용과 금리는 중립에 머물러 하이일드 스프레드 343bp가 아직 350bp 아래입니다. S&P 500이 50일선(7,649) 위로 마감하면 추세부터 읽기가 달라집니다.';
const answer = (text, usage = { inputTokens: 1800, outputTokens: 420 }) => ({ text, reason: text ? null : 'provider-timeout', usage });
const stub = (answers) => {
  const prompts = [];
  const request = async (prompt) => { prompts.push(prompt); const next = answers.length > 1 ? answers.shift() : answers[0]; return typeof next === 'function' ? next(prompt) : next; };
  return { request, prompts };
};
const run = (options) => genScreenReadings({ interpretation: FIXTURE, nowMs: Date.parse('2026-11-19T00:30:00Z'), screens: ['signal'], ...options });

await section('packet', async () => {
  const packet = buildScreenPacket('signal', FIXTURE);
  check('v60.31 the 시장 상태 packet carries the basis, the overall verdict with its counts and the six US axes (the Korean axis is counted apart)',
    packet?.basis === '2026-11-18' && packet.lines.some((line) => line.includes('부담 우세') && line.includes('6개 지표 중 양호 0 · 중립 4 · 부담 2')) && Object.keys(packet.axisStates).length === 6 && !packet.axisStates.korea, JSON.stringify(packet));
  check('v60.31 an axis gives its title, state label, evidence and flip; its code-assembled `read` never enters the packet',
    packet.lines.some((line) => line.startsWith('추세: 부담') && line.includes('7,323.63') && line.includes('판정이 바뀌는 조건')) && !packet.lines.some((line) => line.includes('코드 해석 문장')), packet.lines.join('\n'));
  check('v60.31 a (참고) evidence row stays out of the packet (it does not judge the axis and is revised within the day)', !packet.lines.some((line) => line.includes('공포·탐욕')), packet.lines.join('\n'));
  check('v60.31 the key is the first 16 hex of the lines\' sha1: the same facts give the same key, a changed figure another',
    /^[0-9a-f]{16}$/.test(packet.key) && buildScreenPacket('signal', FIXTURE).key === packet.key
      && buildScreenPacket('signal', { ...FIXTURE, regime: { ...FIXTURE.regime, axes: FIXTURE.regime.axes.map((a) => (a.id === 'volatility' ? { ...a, evidence: [['VIX', '25.10 (5일 +43%)']] } : a)) } }).key !== packet.key);
  const prompts = SCREEN_READING_IDS.map((screen) => buildScreenReadingPrompt(buildScreenPacket(screen, FIXTURE)));
  check('v60.31 every screen\'s prompt opens with the same static rules (the cacheable prefix) and ends with its facts', prompts.every((prompt) => prompt.startsWith(SCREEN_READING_RULES) && prompt.includes('[사실 묶음]')));
  check('v60.54 the registry holds the four market screens and 금리와 환율, 기술적 분석, 테마와 섹터 and 한국; 매크로 reads its own six-factor read and quadrant inputs',
    SCREEN_READING_IDS.join(',') === 'signal,breadth,macro,sentiment,fxbond,charts,themes,korea' && buildScreenPacket('macro', FIXTURE)?.lines.some((line) => line.includes('국면 판정 보류')) && buildScreenPacket('breadth', FIXTURE)?.axes.length === 1);
  const mood = buildScreenPacket('sentiment', FIXTURE);
  check('v60.31 the 투자 심리 packet carries the shared 심리 verdict, the F&G, VIX ÷ 3개월 VIX and AAII cards with their state words, and the credit and volatility axes; no assembled sentence',
    mood?.basis === '2026-11-18' && mood.lines.some((line) => line.startsWith('심리: 부담') && line.includes('공포 쪽 쏠림')) && mood.lines.some((line) => line.startsWith('공포·탐욕 지수 (F&G): 25 (공포)'))
      && mood.lines.some((line) => line.startsWith('단기 불안 비율 (VIX ÷ 3개월 VIX): 1.01 (역전, 단기 불안)')) && mood.lines.some((line) => line.startsWith('AAII 개인 설문: 약세 51.4%'))
      && Object.keys(mood.axisStates).join(',') === 'sentiment,volatility,credit' && !mood.lines.some((line) => line.includes('코드 해석 문장')), JSON.stringify(mood?.lines || null));
  check('v60.31 a 투자 심리 packet needs the shared 심리 verdict', buildScreenPacket('sentiment', { ...FIXTURE, regime: { ...FIXTURE.regime, watchAxes: [] } }) === null);
  check('v60.31 a screen without facts builds no packet', buildScreenPacket('signal', { regime: { available: false } }) === null && buildScreenPacket('unknown', FIXTURE) === null);
});

await section('validator', async () => {
  const packet = buildScreenPacket('signal', FIXTURE);
  const ok = validateScreenReading(GOOD, packet);
  check('v60.31 ① a paragraph quoting only packet figures passes', ok.issues.length === 0, JSON.stringify(ok));
  check('v60.31 a figure printed with fewer decimals than the packet agrees (24.56 → 24.6), a counted 6 and a packet period pass',
    validateScreenReading(GOOD.replace('24.56', '24.6').replace('5일 +40%', '5거래일 동안 +40%') + ' 6개 지표 중 둘이 부담입니다.', packet).issues.length === 0);
  const wrong = validateScreenReading(GOOD.replace('24.56', '26.1').replace('343bp', '351bp'), packet);
  check('v60.31 ② a figure the packet does not carry is blocked, naming the figure', wrong.issues.some((issue) => issue.startsWith('figure-unsupported') && issue.includes('26.1') && issue.includes('351bp')), JSON.stringify(wrong));
  check('v60.31 a sign against the packet is blocked (-40% for +40%), a date the packet lacks is blocked (11/19)',
    validateScreenReading(GOOD.replace('+40%', '-40%'), packet).issues.some((issue) => issue.startsWith('figure-unsupported'))
      && validateScreenReading(GOOD.replace('11/18', '11/19'), packet).issues.some((issue) => issue.includes('11/19')));
  check('v60.31 a computed figure (a difference the packet does not print) is blocked', unsupportedFigures('VIX는 기준선 20보다 4.56 높습니다.', packet).includes('4.56'));
  check('v60.31 ③ an order is blocked', validateScreenReading(`${GOOD} 지금은 분할 매수하세요.`, packet).issues.includes('trade-instruction'));
  check('v60.31 ③ a percentage probability is blocked', validateScreenReading(GOOD.replace('부담 우세입니다.', '부담 우세이고 반등 확률은 70%입니다.'), packet).issues.includes('probability-claim'));
  const credit = validateScreenReading(GOOD.replace('신용과 금리는 중립에 머물러', '신용은 부담이 커졌고 금리는 중립에 머물러'), packet);
  check('v60.31 a state the packet contradicts is blocked (신용 부담 while the credit axis is 중립)', credit.issues.some((issue) => issue.startsWith('state-contradiction')), JSON.stringify(credit));
  check('v60.31 an axis title with another state label is blocked; a conditional is not',
    validateScreenReading(GOOD.replace('반면 신용과 금리는', '유가와 달러는 부담이고, 신용과 금리는'), packet).issues.some((issue) => issue.startsWith('state-contradiction'))
      && validateScreenReading(GOOD.replace('반면 신용과 금리는', '유가와 달러가 부담으로 바뀌면 달라지지만, 신용과 금리는'), packet).issues.length === 0);
  const thin = validateScreenReading(GOOD.replace('읽기가 달라집니다.', '반등 가능성이 더 높아 보입니다.'), packet);
  check('v60.31 ④ an interpretation without a named ground passes with a warning only (owner 2026-11-17)', thin.issues.length === 0 && thin.warnings.includes('likelihood-qualitative'), JSON.stringify(thin));
  check('v60.31 the face size, Korean, prompt labels and emoji are blocking',
    validateScreenReading(GOOD.repeat(4), packet).issues.includes('too-long') && validateScreenReading('The market is weak today because volatility rose and credit spreads widened across the board.', packet).issues.includes('language-not-korean')
      && validateScreenReading(`[사실 묶음] ${GOOD}`, packet).issues.includes('prompt-label-leak') && validateScreenReading(`${GOOD} 📉`, packet).issues.includes('emoji'));
  const retry = buildScreenReadingRetryPrompt(buildScreenReadingPrompt(packet), wrong);
  check('v60.31 the retry carries the blocking reasons and the offending figures, never the rejected paragraph',
    retry.includes('[다시 쓰기]') && retry.includes('26.1') && !retry.includes('S&P 500은 50일선보다'), retry.slice(-400));
});

// The market investigation's conclusion on the same close reaches the 시장 상태 packet, and the reading names causes as it does.
await section('investigation conclusion', async () => {
  const unconfirmed = { status: 'verified', session: { us: '2026-11-18' }, causes: [{ claim: '반도체 쏠림 되돌림이 유력한 설명이라는 추론이다', kind: 'inference', outlet: null, date: null, url: null }], unknowns: ['11/18 반도체 하락의 직접 촉매'] };
  const confirmed = { status: 'verified', session: { us: '2026-11-18' }, causes: [{ claim: '임금 지표가 예상보다 강해 금리 인상 우려가 커졌다', kind: 'news', outlet: 'Reuters', date: '2026-11-18', url: 'https://www.reuters.com/x' }], unknowns: [] };
  const base = buildScreenPacket('signal', FIXTURE);
  const packetWith = (investigation) => buildScreenPacket('signal', FIXTURE, { data: { marketInvestigation: investigation } });
  const asserted = `${GOOD} 11/18 하락은 임금 지표 충격 때문입니다.`;
  const attributed = `${GOOD} 11/18 Reuters 보도에 따르면 임금 지표 충격이 거론됐습니다.`;
  const issuesOf = (text, packet) => validateScreenReading(text, packet).warnings.filter((issue) => issue.startsWith('investigation-')); // a cause is interpretation: it warns
  check('v60.56 investigation absent, blocked or of another session: no lines, the same key, and no cause issue',
    !base.lines.some((line) => line.startsWith('조사 결론')) && packetWith(null).key === base.key && packetWith({ ...unconfirmed, status: 'blocked' }).key === base.key
      && packetWith({ ...unconfirmed, session: { us: '2026-11-17' } }).key === base.key && issuesOf(asserted, base).length === 0);
  const open = packetWith(unconfirmed);
  check('v60.56 the 시장 상태 packet carries the investigation of its close: the rule head, the inference and what it could not confirm',
    open.key !== base.key && open.lines.some((line) => line.startsWith('조사 결론 기준: 11/18 미국 세션')) && open.lines.includes('조사 결론 추론(보도로 확인 안 됨): 반도체 쏠림 되돌림이 유력한 설명이라는 추론이다')
      && open.lines.includes('조사 결론 미확인: 11/18 반도체 하락의 직접 촉매'), open.lines.filter((line) => line.startsWith('조사')).join('\n'));
  check('v60.56 investigation unconfirmed: a cause stated as fact for the session is recorded as a warning (never blocking); the same cause attributed to a report passes',
    issuesOf(asserted, open).join() === 'investigation-cause-unconfirmed' && issuesOf(attributed, open).length === 0, JSON.stringify(validateScreenReading(asserted, open)));
  const found = packetWith(confirmed);
  check('v60.56 investigation confirmed: the reading may cite the confirmed cause; saying the cause was not found is flagged',
    found.lines.includes('조사 결론 확인(보도 11/18 Reuters): 임금 지표가 예상보다 강해 금리 인상 우려가 커졌다')
      && issuesOf(`${GOOD} 11/18 Reuters 보도에 따르면 임금 지표가 예상보다 강해 금리 인상 우려가 커졌습니다.`, found).length === 0
      && issuesOf(`${GOOD} 11/18 하락의 원인은 아직 확인되지 않았습니다.`, found).join() === 'investigation-cause-contradicted', found.lines.filter((line) => line.startsWith('조사')).join('\n'));
});

await section('producer', async () => {
  const one = stub([answer(GOOD)]);
  const verified = await run({ request: one.request });
  const reading = verified.result.readings.signal;
  check('v60.31 ① one request publishes a verified reading with its basis, key, model, usage and cost',
    one.prompts.length === 1 && reading.status === 'verified' && reading.text === GOOD && reading.basis === '2026-11-18' && reading.key === buildScreenPacket('signal', FIXTURE).key
      && reading.model && reading.usage.inputTokens === 1800 && reading.estimatedUsd === estimateAiCostUsd({ inputTokens: 1800, outputTokens: 420 }) && verified.result.schemaVersion === SCREEN_READING_SCHEMA, JSON.stringify(reading));
  const bad = stub([answer(GOOD.replace('24.56', '26.1'))]);
  const blocked = await run({ request: bad.request });
  const b = blocked.result.readings.signal;
  check('v60.31 ② a wrong figure is retried once with the reasons; still wrong → blocked, no text, a reason code',
    bad.prompts.length === 2 && bad.prompts[1].includes('[다시 쓰기]') && b.status === 'blocked' && b.text === null && b.reason === 'validation-failed' && b.issues.includes('figure-unsupported') && !JSON.stringify(b).includes('26.1'), JSON.stringify(b));
  const fixed = stub([answer(GOOD.replace('24.56', '26.1')), answer(GOOD)]);
  const recovered = await run({ request: fixed.request });
  check('v60.31 a retry that fixes the figure publishes', recovered.result.readings.signal.status === 'verified' && recovered.outcomes.signal === 'verified-after-retry' && fixed.prompts.length === 2);
  const order = stub([answer(`${GOOD} 지금은 분할 매수하세요.`)]);
  check('v60.31 ③ an order is never published', (await run({ request: order.request })).result.readings.signal.status === 'blocked');
  const thin = stub([answer(GOOD.replace('읽기가 달라집니다.', '반등 가능성이 더 높아 보입니다.'))]);
  const thinRun = await run({ request: thin.request });
  check('v60.31 ④ a thin-ground interpretation is published with its warning', thinRun.result.readings.signal.status === 'verified' && thinRun.result.readings.signal.warnings.includes('likelihood-qualitative') && thin.prompts.length === 1);
  const again = stub([answer(GOOD)]);
  const reused = await run({ request: again.request, previous: verified.result });
  check('v60.31 ⑤ the same key reuses the verified reading with no call', again.prompts.length === 0 && reused.result.readings.signal === verified.result.readings.signal && reused.outcomes.signal === 'reused');
  const held = stub([answer(GOOD)]);
  const heldRun = await run({ request: held.request, previous: blocked.result });
  check('v60.31 ⑥ a key the validator blocked is not asked again', held.prompts.length === 0 && heldRun.result.readings.signal.status === 'blocked' && heldRun.outcomes.signal === 'blocked-key-held');
  const down = stub([answer(null)]);
  let state = (await run({ request: down.request })).result;
  check('v60.31 a provider failure is blocked with its reason and an attempt count (no retry inside the run)', state.readings.signal.reason === 'provider-timeout' && state.readings.signal.attempts === 1 && down.prompts.length === 1);
  for (let i = 1; i < SCREEN_READING_PROVIDER_ATTEMPTS; i += 1) state = (await run({ request: down.request, previous: state })).result;
  const after = stub([answer(GOOD)]);
  await run({ request: after.request, previous: state });
  check(`v60.31 a provider failure is retried on later runs, at most ${SCREEN_READING_PROVIDER_ATTEMPTS} times for one key`, down.prompts.length === SCREEN_READING_PROVIDER_ATTEMPTS && after.prompts.length === 0, `${down.prompts.length}/${after.prompts.length}`);
  const ledgerRun = await run({ request: stub([answer(GOOD.replace('24.56', '26.1'))]).request,
    previous: { schemaVersion: SCREEN_READING_SCHEMA, readings: {}, ledger: { '2026-10': { requests: 90, inputTokens: 160000, outputTokens: 40000, estimatedUsd: 0.044 }, '2026-11': { requests: 10, inputTokens: 18000, outputTokens: 4200, estimatedUsd: 0.00478 } } } });
  const nov = ledgerRun.result.ledger['2026-11'];
  check('v60.31 ⑦ the monthly ledger carries the previous months and adds every request of this run (two here) at the Worker\'s rate card',
    ledgerRun.result.ledger['2026-10'].requests === 90 && nov.requests === 12 && nov.inputTokens === 21600 && nov.outputTokens === 5040
      && Math.abs(nov.estimatedUsd - (0.00478 + 2 * estimateAiCostUsd({ inputTokens: 1800, outputTokens: 420 }))) < 1e-5, JSON.stringify(ledgerRun.result.ledger));
  const none = await run({ request: null, previous: verified.result });
  check('v60.31 ⑧ with no requester nothing is called and the previous verified reading stays', none.requests === 0 && none.result.readings.signal === verified.result.readings.signal && none.outcomes.signal === 'not-configured');
  const all = stub([answer(GOOD.replace('24.56', '26.1'))]);
  const capped = await genScreenReadings({ interpretation: FIXTURE, nowMs: Date.parse('2026-11-19T00:30:00Z'), request: all.request });
  check('v60.31 one run asks at most twice per screen', all.prompts.length <= SCREEN_READING_IDS.length * 2 && capped.requests === all.prompts.length, String(all.prompts.length));
  check('v60.31 the run outcome is one reason code for meta.aiUsage', /^[a-z0-9:-]{1,64}$/.test(screenReadingsOutcome(verified)) && screenReadingsOutcome(reused) === 'reused');
});

await section('wiring', async () => {
  check('v60.31 screen-reading is a registered shared-AI purpose on the analysis profile with a lower output ceiling',
    SHARED_AI_PURPOSES['screen-reading']?.profile === 'analysis' && sharedAiPurpose('screen-reading')?.maxOutputTokens === 1500 && SHARED_AI_PURPOSES['screen-reading'].owner === 'scripts/producer/screen-readings.mjs');
  let body = null;
  const env = { AIO_AUTOMATION_TOKEN: 'x'.repeat(40), AI_PROXY_URL: 'https://worker.invalid/' };
  await requestSharedAnalysis('fixture', { env, purpose: 'screen-reading', fetchImpl: async (url, options) => { body = JSON.parse(options.body); return new Response('{}', { status: 500 }); } });
  check('v60.31 the screen-reading request body asks for 1500 output tokens (the market reading keeps its profile ceiling)', body?.max_output_tokens === 1500, JSON.stringify(body));
  const block = { schemaVersion: SCREEN_READING_SCHEMA, readings: { signal: { status: 'verified', text: GOOD, basis: '2026-11-18' }, breadth: { status: 'blocked', text: null, basis: '2026-11-18' }, macro: { status: 'verified', text: '짧다', basis: '2026-11-18' } } };
  check('v60.31 the screen admits a verified reading only (blocked, too short, missing or another schema → none)',
    serverScreenReading({ _aioScreenReadings: block }, 'signal')?.text === GOOD && serverScreenReading({ _aioScreenReadings: block }, 'breadth') === null
      && serverScreenReading({ _aioScreenReadings: block }, 'macro') === null && serverScreenReading({}, 'signal') === null && serverScreenReading({ _aioScreenReadings: { ...block, schemaVersion: 'x' } }, 'signal') === null);
  // The component on a minimal document: text goes in as text, an off-basis or missing reading leaves the host empty and hidden.
  const node = (tag) => ({ tag, className: '', textContent: '', hidden: false, children: [], append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; } });
  const host = node('section');
  const doc = { getElementById: (id) => (id === 'signal-screen-reading' ? host : null), createElement: node };
  const html = `${GOOD} <b>굵게</b>`;
  const shown = renderScreenReading({ documentRef: doc, root: { _aioScreenReadings: { ...block, readings: { signal: { status: 'verified', text: html, basis: '2026-11-18' } } } }, screen: 'signal', shownBasis: '2026-11-18' });
  const textNode = host.children.find((child) => child.className === 'screen-reading__text');
  check('v60.31 a verified reading on the shown close is painted as text with its tag and close date',
    shown && !host.hidden && textNode?.textContent === html && host.children[0]?.children.map((child) => child.textContent).join(' ') === 'AI 읽기 11/18 종가 기준', JSON.stringify(host.children.map((child) => child.className)));
  const off = renderScreenReading({ documentRef: doc, root: { _aioScreenReadings: block }, screen: 'signal', shownBasis: '2026-11-19' });
  check('v60.31 a reading on another close leaves the host empty and hidden', !off && host.hidden && host.children.length === 0);
  host.hidden = false;
  check('v60.31 no reading leaves the host empty and hidden', !renderScreenReading({ documentRef: doc, root: {}, screen: 'signal', shownBasis: '2026-11-18' }) && host.hidden && host.children.length === 0);
});

// ---- the other screens (lane A) on two kinds of day, and the per-subject readings (lane B) -------------------------------
const SESSIONS_LONG = [];
for (let t = Date.parse('2025-09-01T12:00:00Z'); t <= Date.parse('2026-11-18T12:00:00Z'); t += 86400000) { const day = new Date(t); if (day.getUTCDay() % 6) SESSIONS_LONG.push(day.toISOString().slice(0, 10)); }
// A quiet drift up, and a rates-led selloff: the 10-year close up 30bp in five sessions while every index falls.
const dayHistory = (kind) => SESSIONS_LONG.map((date, i) => {
  const shock = kind === 'rates' ? Math.max(0, 5 - (SESSIONS_LONG.length - 1 - i)) : 0;
  const drift = 1 + i * 0.0006;
  return { date, spx: 6000 * drift * (1 - 0.012 * shock), ndx: 21000 * drift * (1 - 0.018 * shock), soxx: 250 * drift * (1 - 0.03 * shock), rut: 2200 * drift * (1 - 0.01 * shock), tnx: 4.2 + 0.06 * shock, distributionDays: kind === 'rates' ? 6 : 1 };
});
const theme = (market, id, label, state, stateLabel, ret1m, ret5d, above50) => ({ market, id, label, state, stateLabel, ret1m, ret5d, above50, windText: '' });
const PLAYBOOK_AI = { available: true, asOf: '2026-11-18', asOfByMarket: { US: '2026-11-18', KR: '2026-11-19' }, highlights: {}, rotation: { tags: [{ label: 'AI 설비투자 사이클', ret1m: 12.4 }, { label: '경기 방어', ret1m: -2.1 }] },
  themes: [theme('US', 'semis', '반도체', 'leading', '주도 지속 (6개월·1개월)', 14.2, 3.1, 88), theme('US', 'ai', 'AI 인프라', 'leading', '주도 지속 (6개월·1개월)', 9.8, 1.2, 75), theme('US', 'utilities', '유틸리티', 'weak', '약세 지속 (6개월·1개월)', -4.6, -1.1, 22),
    theme('KR', 'hbm', '반도체 / HBM', 'leading', '주도 지속 (3개월·1개월, 코스피 대비)', 18.3, 4.4, 90), theme('KR', 'bio', '바이오', 'weak', '약세 지속 (3개월·1개월, 코스피 대비)', -7.7, -2.0, 15), theme('KR', 'ship', '조선', 'inline', '동행', 2.2, 0.4, 55)] };
const PLAYBOOK_DEFENSIVE = { available: true, asOf: '2026-11-18', asOfByMarket: { US: '2026-11-18', KR: '2026-11-19' }, highlights: {}, rotation: { tags: [] },
  themes: [theme('US', 'utilities', '유틸리티', 'leading', '주도 지속 (6개월·1개월)', 4.1, 0.8, 70), theme('US', 'semis', '반도체', 'weak', '약세 지속 (6개월·1개월)', -15.3, -6.2, 8),
    theme('KR', 'telecom', '통신', 'inline', '동행', 1.1, 0.2, 50), theme('KR', 'battery', '2차전지', 'weak', '약세 지속', -9.4, -3.3, 10)] };
const laneA = (kind, playbook) => ({ ...FIXTURE, inputs: { ...FIXTURE.inputs, history: dayHistory(kind) }, playbook });
const MACRO_RATES = { dgs2: 4.62, dgs5: 4.71, dgs10: 4.98, dgs20: 5.31, dgs30: 5.27 };
const MACRO_QUIET = { dgs2: 3.91, dgs5: 3.95, dgs10: 4.12, dgs20: 4.5, dgs30: 4.47 };

await section('lane A: the other screens', async () => {
  const quiet = laneA('quiet', PLAYBOOK_AI);
  const rates = laneA('rates', PLAYBOOK_DEFENSIVE);
  const fxQuiet = buildScreenPacket('fxbond', quiet, { data: { macro: MACRO_QUIET } });
  const fxRates = buildScreenPacket('fxbond', rates, { data: { macro: MACRO_RATES } });
  check('v60.54 금리와 환율 builds its packet from the board\'s own model (buildRatesFx): the curve, the 10-year close move and the rates and won/yen axes; a rates-led selloff and a quiet day give different packets',
    !!fxQuiet && !!fxRates && fxRates.lines.some((line) => line.includes('10년 4.98%')) && fxRates.lines.some((line) => line.startsWith('10년물 종가 변화: 5거래일 +30bp'))
      && fxQuiet.lines.some((line) => line.startsWith('10년물 종가 변화: 5거래일 0bp')) && fxRates.key !== fxQuiet.key && Object.keys(fxRates.axisStates).sort().join(',') === 'korea,rates', JSON.stringify([fxRates?.lines, fxQuiet?.lines]));
  const chQuiet = buildScreenPacket('charts', quiet);
  const chRates = buildScreenPacket('charts', rates);
  const trendOf = (packet, label) => packet?.lines.find((line) => line.startsWith(`${label}: `)) || '';
  check('v60.54 기술적 분석 builds its packet from the index cards\' readings (indexChartReadings, chartsConclusion) and the S&P 500 distribution days; the selloff and the quiet day read differently',
    !!chQuiet && !!chRates && chQuiet.lines.some((line) => line.startsWith('지수 추세 집계: 지수 4개 중')) && chRates.lines.some((line) => line.includes('분배일) 6회')) && chQuiet.lines.some((line) => line.includes('분배일) 1회'))
      && trendOf(chQuiet, '반도체(SOXX)') !== trendOf(chRates, '반도체(SOXX)'), JSON.stringify([chQuiet?.lines, chRates?.lines]));
  const thAi = buildScreenPacket('themes', quiet);
  const thDef = buildScreenPacket('themes', rates);
  check('v60.54 테마와 섹터 builds its packet from the theme stages the screen draws (the playbook): the strong and weak US themes by one-month return; an AI-led and a defensive-led day lead with different themes',
    thAi?.lines.find((line) => line.startsWith('강한 테마'))?.startsWith('강한 테마 반도체:') && thDef?.lines.find((line) => line.startsWith('강한 테마'))?.startsWith('강한 테마 유틸리티:')
      && thAi.lines.some((line) => line.startsWith('미국 테마 3개의 단계: 주도 지속 2개 · 약세 지속 1개')), JSON.stringify([thAi?.lines, thDef?.lines]));
  const krAi = buildScreenPacket('korea', quiet);
  const krThin = buildScreenPacket('korea', rates);
  check('v60.54 한국 reads the Korean theme stages on the Korean close with the won/yen axis; thin Korean data still builds a packet that says how many themes it has',
    krAi?.basis === '2026-11-19' && krAi.lines.some((line) => line.startsWith('한국 테마 반도체 / HBM:')) && krThin?.lines.some((line) => line === '한국 테마 2개 (1개월 수익률 높은 순과 낮은 순)') && krAi.axes.some((axis) => axis.id === 'korea'), JSON.stringify([krAi?.lines, krThin?.lines]));
  check('v60.54 a screen without its own facts builds no packet (no playbook, no history, no treasury yields)',
    buildScreenPacket('themes', FIXTURE) === null && buildScreenPacket('korea', FIXTURE) === null && buildScreenPacket('fxbond', FIXTURE, { data: { macro: {} } }) === null);
  const guides = [SCREEN_READING_RULES, ...SCREEN_READING_IDS.map((id) => buildScreenReadingPrompt({ screen: id, lines: [] })), ...SUBJECT_READING_KINDS.map((kind) => buildSubjectPrompt({ kind, lines: [] }))].join('\n');
  check('v60.54 the shared instruction and every guide are time-proof: no date, year, ticker or index level in them',
    !/\d{1,2}\s?\/\s?\d{1,2}|20\d\d|\b[A-Z]{3,5}\b|\d{3,},?\d*\s?(?:선|포인트)/.test(guides.replace(/M\/D/g, '')), (guides.match(/\d{1,2}\s?\/\s?\d{1,2}|20\d\d|\b[A-Z]{3,5}\b/g) || []).join(','));
  check('v60.54 the shared instruction asks for one line of reasoning (verdict first, what the price reflects, what would confirm or change it, what does not fit) and conditional guidance without orders',
    ['첫 문장은 판단', '이미 무엇을 반영', '무엇이 확인되면', '"다만"', '나눠 접근', '% 확률', '블록 1~2개'].every((part) => SCREEN_READING_RULES.includes(part)));
  const TWO = `${GOOD}\n\n다만 하이일드 스프레드 343bp는 아직 350bp 아래라 신용은 중립이고, 미 10년물도 5.07%에서 중립에 머물러 있습니다. S&P 500이 50일선(7,649) 위로 마감하면 추세부터 읽기가 달라지고, 그 전까지는 서두를 이유가 적습니다. VIX가 24.56에서 내려오고 단기 불안 비율 1.01의 역전이 풀리는지가 다음 확인점이며, 그때까지는 조건이 확인될 때마다 나눠 접근하는 쪽이 비용이 작습니다.`;
  const packet = buildScreenPacket('signal', FIXTURE);
  const other = buildScreenPacket('breadth', FIXTURE);
  check('v60.54 a reading of two blocks within 520 characters passes the producer validator; a third block is blocked (v60.55: on every screen but 시장 상태)',
    validateScreenReading(TWO, packet).issues.length === 0 && TWO.length > 400 && validateScreenReading(`${TWO}\n\n${GOOD}`, other).issues.includes('too-many-blocks'), JSON.stringify(validateScreenReading(TWO, packet)));
  const THREE = `${TWO}\n\n${GOOD}`;
  check('v60.55 시장 상태 alone takes a third block within its 760 characters; a fourth block or a longer reading is blocked, and every other check still runs on it',
    validateScreenReading(THREE, packet).issues.length === 0 && THREE.replace(/\n\s*\n/g, ' ').length > 520
      && validateScreenReading(`${THREE}\n\n${GOOD}`, packet).issues.includes('too-many-blocks') && validateScreenReading(`${THREE} ${GOOD}`, packet).issues.includes('too-long')
      && validateScreenReading(THREE.replace('24.56', '26.1'), packet).issues.some((issue) => issue.startsWith('figure-unsupported')) && validateScreenReading(`${THREE} 지금은 분할 매수하세요.`, packet).issues.includes('trade-instruction'),
    JSON.stringify(validateScreenReading(THREE, packet)));
  check('v60.55 the producer validator and the screen gate read one limits table (reading-limits.js): 시장 상태 3 blocks, every other screen 2',
    readingLimitsOf('signal').blocks === 3 && readingLimitsOf('macro').blocks === 2 && readingLimitsOf(undefined).chars === 520);
  const twoBlock = { schemaVersion: SCREEN_READING_SCHEMA, readings: { signal: { status: 'verified', text: TWO, basis: '2026-11-18' }, macro: { status: 'verified', text: THREE, basis: '2026-11-18' } } };
  const admitted = serverScreenReading({ _aioScreenReadings: twoBlock }, 'signal');
  check('v60.54 the screen admits a two-block reading over the old 400-character face and paints each block as its own paragraph; three blocks are not admitted (v60.55: outside 시장 상태)',
    admitted?.blocks?.length === 2 && serverScreenReading({ _aioScreenReadings: twoBlock }, 'macro') === null, JSON.stringify(admitted));
  const threeBlock = { schemaVersion: SCREEN_READING_SCHEMA, readings: { signal: { status: 'verified', text: THREE, basis: '2026-11-18' } } };
  check('v60.55 the 시장 상태 gate admits its three-block reading', serverScreenReading({ _aioScreenReadings: threeBlock }, 'signal')?.blocks?.length === 3);
  const node = (tag) => ({ tag, className: '', textContent: '', hidden: false, children: [], append(...kids) { this.children.push(...kids); }, replaceChildren(...kids) { this.children = kids; } });
  const host = node('section');
  renderScreenReading({ documentRef: { getElementById: (id) => (id === 'signal-screen-reading' ? host : null), createElement: node }, root: { _aioScreenReadings: twoBlock }, screen: 'signal', shownBasis: '2026-11-18' });
  check('v60.54 the painter draws the two blocks as two paragraphs under one tag', host.children.filter((child) => child.className === 'screen-reading__text').length === 2);
});

// Three kinds of 종목 (a profitable megacap, a loss-making small cap, a Korean listing with thin data), one chart and one portfolio.
const company = (symbol, { name, market = 'US', sector = null, description = null, returns = {}, sma = {}, fiscal = [], periodEnd = null, asOf = '2026-11-18' }) => ({
  available: true, symbol, identity: { name, market, sector }, business: description ? { description } : { description: null }, associations: [],
  marketEvidence: { asOf, returns, pctSma50: sma.s50 ?? null, pctSma200: sma.s200 ?? null }, financial: { periodEnd, fiscal: { points: fiscal } }, risks: [] });
const MEGACAP = company('MEGA', { name: '메가 테크', sector: 'Technology', description: '스마트폰과 서비스 구독으로 매출을 내는 기기 회사입니다.', returns: { ret1m: 3.2, ret3m: 8.1, ret6m: 15.4 }, sma: { s50: 4.1, s200: 12.3 },
  fiscal: [{ title: '매출', text: '4,160억 달러, 전년 대비 +6.4%' }, { title: '순이익률', text: '26.9%' }], periodEnd: '2026-09-27' });
const SMALLCAP = company('TINY', { name: '타이니 바이오', sector: 'Healthcare', description: '임상 단계 신약 개발사입니다.', returns: { ret1m: -12.5, ret3m: -30.2 }, sma: { s50: -9.8, s200: -25.1 },
  fiscal: [{ title: '순이익', text: '-1.2억 달러, 적자 지속' }, { title: '현금', text: '0.8억 달러' }], periodEnd: '2026-06-30' });
const KOREAN = company('000000.KS', { name: '한국 소형주', market: 'KR', asOf: '2026-11-19', returns: { ret1m: 1.4 } });
const STOCK_GOOD = '메가 테크는 기기와 구독으로 돈을 버는 회사이고, 지금 주가는 50일선보다 +4.1% 위에서 이익이 계속 늘 것을 이미 반영하고 있습니다. 매출은 4,160억 달러로 전년 대비 +6.4% 늘었고 순이익률은 26.9%입니다. 3개월 +8.1%로 시장 상태 부담 우세와는 다른 쪽에 서 있습니다.\n\n다만 시장 상태가 부담 우세라 기대가 꺾이면 먼저 흔들릴 수 있습니다. 다음 실적에서 매출 증가가 이어지는지가 확인되면 판단이 굳어지고, 꺾이면 50일선 위치부터 다시 봐야 합니다.';

await section('lane B: per-subject readings', async () => {
  const regime = FIXTURE.regime;
  const mega = buildSubjectPacket('stock', { company: MEGACAP, valuation: '시총 약 3.5조 달러(11/18 종가), 직전 4개 분기 PER 35.2배(조정 EPS)', regime });
  const tiny = buildSubjectPacket('stock', { company: SMALLCAP, valuation: '시총 약 4억 달러(11/18 종가)', regime });
  const korean = buildSubjectPacket('stock', { company: KOREAN, valuation: null, regime });
  check('v60.54 the 종목 packet connects business, valuation, the last reported year, the price trend and the market state; a loss-making small cap carries its losses and a thin Korean listing says what is missing',
    mega?.lines.some((line) => line.startsWith('밸류에이션: 시총 약 3.5조 달러')) && mega.lines.some((line) => line.startsWith('최근 회계연도(2026-09-27): 매출: 4,160억 달러')) && mega.lines.some((line) => line.startsWith('가격 추세: 1개월 +3.2%'))
      && tiny?.lines.some((line) => line.includes('적자 지속')) && korean?.lines.includes('사업: 사업 설명 자료 없음') && korean.lines.includes('밸류에이션: 자료 없음') && korean.basis === '2026-11-19'
      && mega.lines.includes('미국 시장 상태 판정: 부담 우세'), JSON.stringify([mega?.lines, tiny?.lines, korean?.lines]));
  check('v60.54 the subject key is per subject per close and changes with any fact; the same facts give the same key',
    mega.key.startsWith('stock:MEGA:2026-11-18:') && buildSubjectPacket('stock', { company: MEGACAP, valuation: '시총 약 3.5조 달러(11/18 종가), 직전 4개 분기 PER 35.2배(조정 EPS)', regime }).key === mega.key
      && buildSubjectPacket('stock', { company: { ...MEGACAP, marketEvidence: { ...MEGACAP.marketEvidence, pctSma50: 4.2 } }, regime }).key !== mega.key);
  const chart = buildSubjectPacket('chart', { symbol: 'mega', analysis: { available: true, asOf: '2026-11-18', stateLabel: '상승 추세', evidence: [['50일선 대비', '+4.1%'], ['거래량 배수', '1.4배']], flip: '50일선(212.40) 아래로 마감하면 조정', templatePass: 7, fromHigh: -3.2 },
    scenarios: { available: true, scenarios: [{ title: '회복', text: '230.10 위 마감이 이어지면 고점 재시험' }] }, regime });
  check('v60.54 the chart packet carries the rule-decided state word, its evidence, the flip, the scenarios and the market state',
    chart?.subject === 'MEGA' && chart.lines.includes('추세 상태어(규칙으로 정함): 상승 추세') && chart.lines.some((line) => line.startsWith('시나리오 회복: 230.10')) && chart.lines.some((line) => line.startsWith('상태가 바뀌는 조건')), JSON.stringify(chart?.lines));
  const book = buildSubjectPacket('portfolio', { rows: { available: true, asOf: '2026-11-18', baseCurrency: 'KRW', cashPct: 12.5, rows: [{ ticker: 'MEGA', sector: 'Technology', allocationPct: 41.2, returnPct: 55.1, quantity: 120, cost: 9000, memo: '내 메모' }, { ticker: 'TINY', sector: 'Healthcare', allocationPct: 8.3, returnPct: -20.4 }] },
    read: { trendMix: [{ label: '상승', pct: 62 }], sectorMix: [{ label: '기술', pct: 41 }] }, regime });
  check('v60.54 the portfolio packet carries ticker, sector, weight and return only (never quantity, cost or memo), the concentration and the market state',
    book?.lines.some((line) => line === '보유: MEGA (Technology) 비중 41.2% · 수익률 +55.1%') && book.lines.includes('상위 3종목 비중 합계 49.5%') && !book.lines.join(' ').match(/120|9000|9,000|내 메모/), JSON.stringify(book?.lines));
  check('v60.54 a subject without its facts builds no packet (no close, no analysis, no holdings)',
    buildSubjectPacket('stock', { company: { ...MEGACAP, marketEvidence: {} } }) === null && buildSubjectPacket('chart', { symbol: 'X', analysis: { available: false } }) === null && buildSubjectPacket('portfolio', { rows: { available: true, rows: [] } }) === null);
  check('v60.54 the subject prompt opens with the same shared instruction as the screens and its own guide',
    [mega, chart, book].every((p) => buildSubjectPrompt(p).startsWith(SCREEN_READING_RULES) && buildSubjectPrompt(p).includes('[사실 묶음]')) && buildSubjectPrompt(mega).length < 4000, String(buildSubjectPrompt(mega).length));
  const ok = validateSubjectReading(STOCK_GOOD, mega);
  check('v60.54 a two-block 종목 reading on packet figures passes; an invented figure, an order, a target price and a % probability are blocked',
    ok.issues.length === 0 && validateSubjectReading(STOCK_GOOD.replace('26.9%', '31.5%'), mega).issues.some((issue) => issue.startsWith('figure-unsupported'))
      && validateSubjectReading(`${STOCK_GOOD} 지금 매수하세요.`, mega).issues.includes('trade-instruction') && validateSubjectReading(`${STOCK_GOOD} 목표가는 250달러입니다.`, mega).issues.includes('trade-instruction')
      && validateSubjectReading(STOCK_GOOD.replace('흔들릴 수 있습니다', '흔들릴 확률이 60%입니다'), mega).issues.includes('probability-claim'), JSON.stringify(ok));
  const asked = [];
  const request = (answers) => async (_root, prompt) => { asked.push(prompt); return answers.shift(); };
  const verified = await writeSubjectReading({}, mega, { request: request([{ text: STOCK_GOOD }]) });
  const retried = await writeSubjectReading({}, mega, { request: request([{ text: STOCK_GOOD.replace('26.9%', '31.5%') }, { text: STOCK_GOOD }]) });
  const blocked = await writeSubjectReading({}, mega, { request: request([{ text: STOCK_GOOD.replace('26.9%', '31.5%') }, { text: STOCK_GOOD.replace('26.9%', '31.5%') }]) });
  const budget = await writeSubjectReading({}, mega, { request: request([{ text: null, reason: 'budget' }]) });
  check('v60.54 a subject reading is asked once, retried once with the blocking reasons (never the rejected text), and otherwise ends blocked or failed with one reason',
    verified.status === 'verified' && verified.text === STOCK_GOOD && retried.status === 'verified' && blocked.status === 'blocked' && blocked.reason === 'blocked' && budget.status === 'failed' && budget.reason === 'budget'
      && asked[2].includes('[다시 쓰기]') && asked[2].includes('31.5%') && !asked[2].includes('메가 테크는 기기와 구독'), JSON.stringify([verified.status, retried.status, blocked, budget]));
  const store = new Map();
  const browser = { localStorage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)) } };
  rememberSubjectReading(browser, mega, { text: STOCK_GOOD, basis: mega.basis });
  rememberSubjectReading(browser, book, { text: STOCK_GOOD, basis: book.basis });
  check('v60.54 a 종목 reading is kept per subject per close in this browser; a portfolio reading stays in memory and never reaches storage',
    cachedSubjectReading(browser, mega)?.text === STOCK_GOOD && String(store.get('aio_subject_readings_v1') || '').includes('stock:MEGA:2026-11-18:') && cachedSubjectReading(browser, book)?.text === STOCK_GOOD && !String(store.get('aio_subject_readings_v1') || '').includes('portfolio:'), [...store.keys()].join(','));
  check('v60.54 the browser and the producers read a completed Worker response with one function', extractCompletedResponseText === producerExtract && extractCompletedResponseText({ status: 'completed', model: 'gpt-6-luna', output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '읽기' }] }] }) === '읽기');
});

await section('repository data', async () => {
  const json = (file) => { try { return JSON.parse(read(file)); } catch (_) { return null; } };
  const history = readHistoryRows(json('public-data/history.json'));
  const build = () => interpretationFromArtifacts({ data: json('public-data/data.json'), history, macroHistory: json('public-data/macro-history.json'), calendar: json('public-data/macro-calendar.json'), nowMs: Date.parse(`${history.at(-1)?.date}T23:30:00Z`) });
  const interpretation = build();
  const packet = buildScreenPacket('signal', interpretation);
  {
    const ctx = { data: json('public-data/data.json') };
    const story = (screen) => (buildScreenPacket(screen, interpretation, ctx)?.lines || []).filter((line) => line.startsWith('시장 이야기 '));
    const has = (screen, head) => story(screen).some((line) => line.startsWith(`시장 이야기 ${head}`));
    check('v60.55 ⑨ every screen reads the market story beside its own facts: the session on 시장 폭 · 매크로 · 투자 심리, the rate path on 매크로 and 금리와 환율, and its guide ties them only when the lines are there',
      has('breadth', '최근 세션: ') && has('macro', '최근 세션: ') && has('macro', '다른 시장 금리 경로') && has('sentiment', '최근 세션: ') && has('fxbond', '다른 시장 금리 경로')
        && story('signal').length > story('breadth').length
        && buildScreenReadingPrompt(buildScreenPacket('macro', interpretation)).includes('시장이 금리 경로를 어디에 두고 있는지')
        && !buildScreenReadingPrompt({ screen: 'macro', lines: ['기준일: 11/24 미국 종가'] }).includes('시장이 금리 경로를 어디에 두고 있는지'),
      JSON.stringify(Object.fromEntries(['breadth', 'macro', 'sentiment', 'fxbond'].map((screen) => [screen, story(screen).map((line) => line.slice(0, 40))]))));
  }
  const axes = packet?.axes || [];
  const axisLines = (packet?.lines || []).filter((line) => axes.some((row) => line.startsWith(`${row.title}: ${row.stateLabel}`)));
  check('v60.31 ⑨ the repository history.json builds the 시장 상태 packet: six axes, each with its state label and figures',
    !!packet && /^\d{4}-\d{2}-\d{2}$/.test(packet.basis) && axes.length === 6 && axisLines.length === 6 && axisLines.every((line) => /\d/.test(line))
      && axes.every((row) => ['양호', '중립', '부담', '확인 불가'].includes(row.stateLabel)), JSON.stringify(packet?.lines || null));
  check('v60.31 ⑨ the same history builds the same key twice (no clock or random input in the packet)', buildScreenPacket('signal', build())?.key === packet?.key);
  {
    // The cross-market rows reach the 시장 상태 packet with the axis's own state word, after the session and before the standing.
    const lines = packet?.lines || [];
    const word = (title) => (interpretation.regime.axes || []).find((row) => row.title === title)?.stateLabel;
    const crossAt = (label) => lines.findIndex((line) => line.startsWith(`시장 이야기 다른 시장 ${label}(상태어는 규칙으로 정함, 바꾸지 말 것): `));
    const stateOf = (label) => lines[crossAt(label)]?.split('): ')[1]?.split(' — ')[0];
    const sessionAt = lines.findIndex((line) => line.startsWith('시장 이야기 최근 세션: ')), ledeAt = lines.findIndex((line) => line.startsWith('시장 이야기 요약: '));
    check('v60.55 ⑨ the repository 시장 상태 packet carries the five cross-market rows between the session and the standing, credit, volatility, breadth and rates with their axis\'s state word',
      ['신용', '달러', '변동성', '시장 폭', '금리'].every((label) => crossAt(label) > sessionAt && crossAt(label) < ledeAt)
        && ['신용', '변동성', '시장 폭', '금리'].every((label) => stateOf(label) === word(label)), JSON.stringify(lines.filter((line) => line.includes('다른 시장'))));
    check('v60.55 ⑨ the rates row says where the 2-year prices the policy path (a fixed lean word) with its proxy caveat',
      lines.some((line) => /^시장 이야기 다른 시장 금리 경로\(2년물로 어림한 값이라 기간·위험 프리미엄이 섞임, 인상·인하 횟수 아님\): (인상 반영|동결 부근|인하 반영) — 2년물 − 기준금리 중간값 [+-]\d+bp/.test(line)), JSON.stringify(lines.filter((line) => line.includes('금리 경로'))));
    const events = (interpretation.events || []).filter((event) => /\b(?:cpi|pce)\b/.test(event.id) && event.date > packet.basis).sort((a, b) => a.date.localeCompare(b.date));
    check('v60.55 ⑨ the next inflation release is the calendar\'s own (none without one, never invented)',
      events.length ? lines.some((line) => line.startsWith('시장 이야기 다른 시장 금리 다음 확인(수집된 발표 일정): 다음 물가 발표 ') && line.includes(events[0].name)) : !lines.some((line) => line.includes('다음 물가 발표')), JSON.stringify(events[0] || null));
  }
  check('v60.55 the 시장 상태 guide chains the session, where it gathered, whether it spread, whether the other markets confirm (each with its meaning) and what keeps a rebound going, in up to three blocks',
    ['무슨 일이 있었나', '어디에 몰렸나', '시장 전체로 번졌나', '다른 시장이 확인하나', '무엇이 나와야 반등이 이어지나', '금리 경로 가격', '다음 물가 발표', '블록을 3개까지'].every((part) => buildScreenReadingPrompt({ screen: 'signal', lines: [] }).includes(part))
      && !buildScreenReadingPrompt({ screen: 'breadth', lines: [] }).includes('블록을 3개까지'));
  const data = json('public-data/data.json');
  const aaii = data?.marketSurveys?.aaii;
  const mood = buildScreenPacket('sentiment', interpretation);
  check('v60.31 ⑨ the repository artifacts build the 투자 심리 packet, with the AAII survey read from data.json marketSurveys.aaii through the shared market input',
    !!mood && mood.basis === packet?.basis && mood.lines.some((line) => line.startsWith('심리: ')) && (!Number.isFinite(aaii?.bearish) || mood.lines.some((line) => line.startsWith(`AAII 개인 설문: 약세 ${aaii.bearish.toFixed(1)}%`))), JSON.stringify(mood?.lines || null));
  check('v60.54 ⑨ the repository artifacts build the 금리와 환율 and 기술적 분석 packets on the same close as 시장 상태',
    buildScreenPacket('fxbond', interpretation, { data })?.basis === packet?.basis && buildScreenPacket('charts', interpretation)?.basis === packet?.basis);
  {
    const asOf = interpretation.regime.asOf;
    const digest = { sourceCatalog: [{ channel: 'fixturechan', role: 'us-fast-breaking' }], signals: [
      { kind: 'macro', key: 'claims', name: '미국 신규 실업수당청구건수', actual: 203000, forecast: 198000, unit: '건', date: asOf, post: 'fixturechan/1', text: 'POST BODY MUST NOT APPEAR' },
      { kind: 'macro', key: 'old', name: '미국 소매판매', actual: 0.1, forecast: 0.3, unit: '%', date: '2026-01-02', post: 'fixturechan/2' },
      { kind: 'pt', ticker: 'NVDA', direction: 'raise', from: 225, to: 240, currency: 'USD', broker: 'Citi', date: asOf, post: 'fixturechan/3' }] };
    const withClaims = buildScreenPacket('macro', interpretation, { telegram: digest });
    const plain = buildScreenPacket('macro', interpretation);
    const claims = (withClaims?.lines || []).filter((line) => line.startsWith('[채널 주장 · 미확인 · 미국 속보 채널'));
    check('v60.54 매크로 carries the relayed channel releases of the last week as tagged unverified claims — no post text, no target price, no older release — and none without a digest',
      claims.length === 1 && claims[0].includes('실업수당') && !withClaims.lines.join(String.fromCharCode(10)).includes('POST BODY') && !withClaims.lines.join(String.fromCharCode(10)).includes('NVDA') && !withClaims.lines.join(String.fromCharCode(10)).includes('소매판매 실제')
        && !(plain?.lines || []).some((line) => line.includes('채널 주장')) && withClaims.key !== plain.key, JSON.stringify(claims));
  }
  check('v60.31 ⑨ no axis `read` sentence reaches the repository packet', !(interpretation.regime?.axes || []).some((row) => row.read && packet.lines.some((line) => line.includes(row.read))));
});

if (failures.length) {
  console.error(`[screen-reading] FAIL (${failures.length})\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('[screen-reading] OK: packet from the shared interpretation (no axis read, no 참고 rows), cached-prefix prompt, figure/date/state/order/probability blocks with warnings for thin grounds, key reuse and held blocked keys, provider retries capped, monthly ledger, no-requester hold, wiring, and the repository 시장 상태 packet');
