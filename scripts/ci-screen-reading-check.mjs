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
import { renderScreenReading } from '../src/ui/components/screen-reading.js';

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
      axis('credit', '신용과 위험선호', 'neutral', '중립', [['하이일드 스프레드', '343bp (5거래일 +13bp), 11/17'], ['공포·탐욕 (참고)', '25, 11/18']], '하이일드 스프레드 350bp 미만이면 양호', '11/17~11/18'),
      axis('commodities', '달러와 원자재', 'neutral', '중립', [['WTI', '86.01달러 (20일 -15.5%)'], ['달러 지수', '103.49 (20일 +1.7%)']], 'WTI 20일 +10%면 부담'),
      axis('korea', '환율 (원, 엔)', 'neutral', '중립', [['원/달러', '1,332.7원']], '원/달러 20일 +2% 이상이면 부담')
    ]
  },
  macroRead: {
    regime: { label: '국면 판정 보류', inputs: [['근원 PCE (9월)', '최근 3개월 연율 2.9%, 전년 대비 3.1%', '차이 0.5%p 이상이면 그 방향', '방향 없음']] },
    counts: { favorable: 1, neutral: 1, burden: 1, unknown: 0 },
    axes: [
      { id: 'growth', title: '성장 (고용, 소비)', state: 'favorable', stateLabel: '양호', evidence: [['실업률', '4.1% (전월 -0.1%p)']], flip: 'Sahm 지표 0.5%p 이상이면 부담', asOf: '2026-10-01', read: '코드 문장' },
      { id: 'inflation', title: '물가', state: 'burden', stateLabel: '부담', evidence: [['근원 PCE (전년 대비)', '3.1%']], flip: '근원 PCE 2.5% 이하면 양호', asOf: '2026-09-01', read: '코드 문장' },
      { id: 'rates', title: '금리, 할인율', state: 'neutral', stateLabel: '중립', evidence: [['미 10년물', '5.07%']], flip: '20일 +25bp 이상이면 부담', basis: '11/17~11/18', read: '코드 문장' }
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
  check('v60.31 the registry holds 시장 상태, 시장 폭, 매크로 and 투자 심리; 매크로 reads its own six-factor read and quadrant inputs',
    SCREEN_READING_IDS.join(',') === 'signal,breadth,macro,sentiment' && buildScreenPacket('macro', FIXTURE)?.lines.some((line) => line.includes('국면 판정 보류')) && buildScreenPacket('breadth', FIXTURE)?.axes.length === 1);
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
    validateScreenReading(GOOD.replace('반면 신용과 금리는', '달러와 원자재는 부담이고, 신용과 금리는'), packet).issues.some((issue) => issue.startsWith('state-contradiction'))
      && validateScreenReading(GOOD.replace('반면 신용과 금리는', '달러와 원자재가 부담으로 바뀌면 달라지지만, 신용과 금리는'), packet).issues.length === 0);
  const thin = validateScreenReading(GOOD.replace('읽기가 달라집니다.', '반등 가능성이 더 높아 보입니다.'), packet);
  check('v60.31 ④ an interpretation without a named ground passes with a warning only (owner 2026-11-17)', thin.issues.length === 0 && thin.warnings.includes('likelihood-qualitative'), JSON.stringify(thin));
  check('v60.31 the face size, Korean, prompt labels and emoji are blocking',
    validateScreenReading(GOOD.repeat(3), packet).issues.includes('too-long') && validateScreenReading('The market is weak today because volatility rose and credit spreads widened across the board.', packet).issues.includes('language-not-korean')
      && validateScreenReading(`[사실 묶음] ${GOOD}`, packet).issues.includes('prompt-label-leak') && validateScreenReading(`${GOOD} 📉`, packet).issues.includes('emoji'));
  const retry = buildScreenReadingRetryPrompt(buildScreenReadingPrompt(packet), wrong);
  check('v60.31 the retry carries the blocking reasons and the offending figures, never the rejected paragraph',
    retry.includes('[다시 쓰기]') && retry.includes('26.1') && !retry.includes('S&P 500은 50일선보다'), retry.slice(-400));
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

await section('repository data', async () => {
  const json = (file) => { try { return JSON.parse(read(file)); } catch (_) { return null; } };
  const history = readHistoryRows(json('public-data/history.json'));
  const build = () => interpretationFromArtifacts({ data: json('public-data/data.json'), history, macroHistory: json('public-data/macro-history.json'), calendar: json('public-data/macro-calendar.json'), nowMs: Date.parse(`${history.at(-1)?.date}T23:30:00Z`) });
  const interpretation = build();
  const packet = buildScreenPacket('signal', interpretation);
  const axes = packet?.axes || [];
  const axisLines = (packet?.lines || []).filter((line) => axes.some((row) => line.startsWith(`${row.title}: ${row.stateLabel}`)));
  check('v60.31 ⑨ the repository history.json builds the 시장 상태 packet: six axes, each with its state label and figures',
    !!packet && /^\d{4}-\d{2}-\d{2}$/.test(packet.basis) && axes.length === 6 && axisLines.length === 6 && axisLines.every((line) => /\d/.test(line))
      && axes.every((row) => ['양호', '중립', '부담', '확인 불가'].includes(row.stateLabel)), JSON.stringify(packet?.lines || null));
  check('v60.31 ⑨ the same history builds the same key twice (no clock or random input in the packet)', buildScreenPacket('signal', build())?.key === packet?.key);
  const data = json('public-data/data.json');
  const aaii = data?.marketSurveys?.aaii;
  const mood = buildScreenPacket('sentiment', interpretation);
  check('v60.31 ⑨ the repository artifacts build the 투자 심리 packet, with the AAII survey read from data.json marketSurveys.aaii through the shared market input',
    !!mood && mood.basis === packet?.basis && mood.lines.some((line) => line.startsWith('심리: ')) && (!Number.isFinite(aaii?.bearish) || mood.lines.some((line) => line.startsWith(`AAII 개인 설문: 약세 ${aaii.bearish.toFixed(1)}%`))), JSON.stringify(mood?.lines || null));
  check('v60.31 ⑨ no axis `read` sentence reaches the repository packet', !(interpretation.regime?.axes || []).some((row) => row.read && packet.lines.some((line) => line.includes(row.read))));
});

if (failures.length) {
  console.error(`[screen-reading] FAIL (${failures.length})\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('[screen-reading] OK: packet from the shared interpretation (no axis read, no 참고 rows), cached-prefix prompt, figure/date/state/order/probability blocks with warnings for thin grounds, key reuse and held blocked keys, provider retries capped, monthly ledger, no-requester hold, wiring, and the repository 시장 상태 packet');
