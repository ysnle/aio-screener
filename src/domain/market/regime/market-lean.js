// v58.81 (owner 2026-10-26): "매수 우위 / 매도 우위" for the market as a whole — never a buy or sell instruction, a price or
// a target. The lean is built only from evidence the app already publishes, and every piece states what it is:
//   - 지금 조건: the six US axes as a count (favorable vs burden). A count of conditions, not a likelihood (R697).
//   - 과거 빈도: how often the index was higher 21 sessions later after days like today (VIX band, price temperature),
//     shown beside the base rate of the same history with its sample size. A frequency moves the lean only when it
//     differs from the base rate by more than the sampling noise (1.5 binomial standard errors and at least 5%p) on at
//     least 30 independent cases; 10-29 cases show the rate with a small-sample note and do not vote; under 10 show the
//     count only (AGENTS Product decisions, past-frequency rule).
// The base rate is said out loud: since 1990 the S&P 500 was higher 21 sessions later on about two days in three, so
// "no lean" still leaves the long-run upward drift, and a burden-heavy tape shifts that drift rather than reversing it.
import { stressBandOf } from '../signal/stress-outcomes.js';
import { vixBandRecord, vixBandRiskLine } from '../signal/vix-band-record.js';
import { currentStressOutcomes } from '../../scenarios/outcome-fingerprints.js';
import { withTopicParticle } from '../../content/korean-particle.js';
import { evidenceStrength, EVIDENCE_FLOOR } from '../../shared/evidence-strength.js';
import { STATE_LABELS } from '../interpretation/concepts.js';

export const MARKET_LEAN_VERSION = 'market-lean.v1';
export const LEAN_RULES = Object.freeze({ horizon: 21, minVoteN: 30, minRateN: EVIDENCE_FLOOR, minEdgePp: 5, seMultiple: 1.5, conditionGap: 2 });
export const LEAN_LABELS = Object.freeze({ 2: '매수 우위', 1: '약한 매수 우위', 0: '뚜렷한 우위 없음', [-1]: '약한 매도 우위', [-2]: '매도 우위', mixed: '엇갈림' });

// Owner 2026-11-15 ("no unvalidated score shown as a verdict"): the lean's direction word rests on a backtest of this
// rule against what followed (scripts/backtest-market-lean.mjs), judged by scripts/build-validation-gates.mjs on the
// criterion declared in architecture/validation-gate-criteria.json `marketLean` and published as
// model-validation-status.json `marketLean`. Each direction is spoken only when that verdict passed it for this rule
// version; the neutral and mixed labels need both. No verdict, another rule version or a failed direction shows the
// six-axis count as a state with no direction word. This is the one place that decides; consumers print what it returns.
// The risk read of the count (does a burden-heavy count precede more −5% drawdowns?) is judged the same
// way — scripts/backtest-market-lean-risk.mjs, the criterion validation-gate-criteria.json `marketLeanRisk` registered
// before its first run, published as model-validation-status.json `marketLean.risk` — and the fold states that verdict
// (countRiskNote). Without a published verdict it says there is none yet; it never says a check failed that is not on file.
const DIRECTION_OF =Object.freeze({ 2: 'buy', 1: 'buy', [-1]: 'defend', [-2]: 'defend' });

function riskVerdict(block) {
  const risk = block?.risk;
  if (!risk || risk.ruleVersion !== MARKET_LEAN_VERSION || !['PASS', 'FAIL'].includes(risk.status)) return null;
  const c = risk.criterion || {};
  if (![risk.horizon, c.drawdownPct, c.lowBurden, c.highBurdenMin, c.level].every(Number.isFinite)) return null;
  return Object.freeze({ status: risk.status, horizon: risk.horizon, drawdownPct: c.drawdownPct, lowBurden: c.lowBurden, highBurdenMin: c.highBurdenMin, level: c.level,
    from: risk.heldOut?.from || null, to: risk.heldOut?.to || null });
}

/** The published lean verdict (model-validation-status.json), read for this rule version only; absent means not validated. */
export function leanValidation(published) {
  const block = published?.marketLean;
  const current = !!block && block.ruleVersion === MARKET_LEAN_VERSION && block.horizon === LEAN_RULES.horizon;
  const frequencies = {};
  for (const [key, row] of Object.entries(current && block.frequencies || {})) {
    if ([row?.rate, row?.base, row?.n].every(Number.isFinite)) frequencies[key] = { rate: row.rate, base: row.base, n: row.n };
  }
  return Object.freeze({ status: current ? String(block.status || 'NOT_RUN') : 'NOT_RUN', buy: current && block.directions?.buy === true,
    defend: current && block.directions?.defend === true, span: current ? block.span || null : null,
    axes: current && Array.isArray(block.axesReconstructed) ? block.axesReconstructed.length : null, frequencies, risk: current ? riskVerdict(block) : null });
}

/** The fold sentence on the risk read of the count, from the published verdict (status, held-out span, criterion). */
export function countRiskNote(validation) {
  const risk = validation?.risk;
  if (!risk) return '부담 수로 다음 한 달 깊은 하락이 잦은지 가르는 읽기는 아직 공개된 과거 검증 결과가 없습니다.';
  const span = risk.from && risk.to ? `${risk.from.slice(0, 4)}~${risk.to.slice(0, 4)}년 검증 구간에서 ` : '';
  const test = `부담 ${risk.highBurdenMin}개 이상인 날과 ${risk.lowBurden}개인 날의 ${risk.horizon}거래일 안 ${risk.drawdownPct}% 이상 하락 비율 차이는`;
  const rule = `차이의 ${Math.round(risk.level * 100)}% 구간이 0보다 위인지`;
  return risk.status === 'PASS' ? `${test} ${span}기준(${rule})을 통과했습니다.` : `${test} ${span}기준(${rule})을 통과하지 못했습니다.`;
}

/**
 * Whether the label for a lean key may carry its direction word under a verdict: its direction passed, and the study
 * holds a past frequency for that key to print beside it (a key the study never saw, such as 매수 우위 on a count-only
 * history, stays the count).
 */
export function leanSpoken(key, validation) {
  const direction = DIRECTION_OF[key];
  return direction ? validation[direction] === true && !!validation.frequencies[key] : validation.buy === true && validation.defend === true;
}

const countState = (counts) => counts ? `${STATE_LABELS.favorable} ${counts.favorable} · ${STATE_LABELS.neutral} ${counts.neutral} · ${STATE_LABELS.burden} ${counts.burden}${counts.unknown ? ` · ${STATE_LABELS.unknown} ${counts.unknown}` : ''}` : '지표 개수 판정 보류';

// Why an unspoken key has no direction word, by case — no verdict; neither direction passed; one
// direction passed and today's key is the other one, neutral or mixed (those need both); or the key's direction passed
// and the study holds no past frequency for it. Direction words stay off this line (상승 쪽 / 하락 쪽 only).
export function verdictLine(validation, key) {
  if (validation.status === 'NOT_RUN') return '이 개수로 한 달 방향을 정하는 규칙은 아직 과거 검증 결과가 없어 방향을 붙이지 않습니다.';
  const span = validation.span?.from && validation.span?.to ? `${validation.span.from.slice(0, 4)}~${validation.span.to.slice(0, 4)}년 ` : '';
  const axes = validation.axes ? `미국 지표 ${validation.axes}개로 ` : '';
  const lead = `이 개수로 한 달 방향을 정하는 규칙을 ${span}${axes}다시 계산한 과거 검증에서`;
  if (!validation.buy && !validation.defend) return `${lead}, 이후 ${LEAN_RULES.horizon}거래일 수익이 평소와 구분되는지(겹치지 않는 사례 ${LEAN_RULES.minVoteN}개 이상) 기준을 통과하지 못해 방향을 붙이지 않습니다.`;
  const direction = DIRECTION_OF[key];
  const keyPassed = direction ? validation[direction] === true : validation.buy && validation.defend;
  if (keyPassed) return `${lead} 기준은 통과했지만, 지금 판정과 같은 과거 사례 기록이 없어 방향을 붙이지 않습니다.`;
  const side = (name) => (name === 'buy' ? '상승' : '하락');
  const now = direction ? `지금 개수가 가리키는 ${side(direction)} 쪽은 기준을 통과하지 못해` : key === 'mixed' ? '지금은 조건과 과거 빈도가 서로 다른 쪽을 가리켜' : '지금 개수는 한쪽으로 기울지 않아';
  return `${lead} ${side(validation.buy ? 'buy' : 'defend')} 쪽 판정만 기준을 통과했고, ${now} 방향을 붙이지 않습니다.`;
}

function frequencyNote(key, validation) {
  const row = validation.frequencies[key];
  if (!row) return null;
  const ev = evidenceStrength(row.n);
  return ev.figures ? `과거 같은 판정 뒤 ${LEAN_RULES.horizon}거래일 상승 ${round(row.rate)}% (평소 ${round(row.base)}%, ${ev.tag})` : `과거 같은 판정 ${ev.count}`;
}

const round = (value) => Math.round(value);

/** One historical-frequency item: rate vs base, sample gate, and whether it may vote. */
export function frequencyEvidence({ id, label, condition, rate, base, n, unit = '회', sampleNote = '' }) {
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(base)) return null;
  // One sample rule with every outcome surface (evidence-strength.js): an effective count (overlapping windows ÷ horizon,
  // e.g. 9.9) is rounded once and that number is judged and shown, so the VIX 40+ row reads the same here and on the
  // stress card.
  const ev = evidenceStrength(n, { approx: !Number.isInteger(n) });
  const sampleN = ev.n;
  if (!ev.figures) {
    return { id, label, kind: 'frequency', vote: 0, small: true, text: `${condition}: 과거 사례 ${sampleN}${unit}뿐이라 비율을 내지 않습니다.` };
  }
  if (!Number.isFinite(rate)) return { id, label, kind: 'frequency', vote: 0, small: true, text: `${condition}: 과거 비율이 기록에 없습니다.` };
  const edge = rate - base;
  const se = Math.sqrt((base / 100) * (1 - base / 100) / sampleN) * 100;
  const threshold = Math.max(LEAN_RULES.minEdgePp, LEAN_RULES.seMultiple * se);
  const voting = sampleN >= LEAN_RULES.minVoteN;
  const vote = voting && Math.abs(edge) >= threshold ? Math.sign(edge) : 0;
  const tail = vote ? (edge > 0 ? ' — 평소보다 상승 쪽' : ' — 평소보다 하락 쪽')
    : voting ? ` — 차이 ${Math.abs(round(edge))}%p가 ${threshold > LEAN_RULES.seMultiple * se ? `최소 기준 ${LEAN_RULES.minEdgePp}%p` : `표본 오차 범위(표준오차의 ${LEAN_RULES.seMultiple}배, 약 ±${round(LEAN_RULES.seMultiple * se)}%p)`}보다 작아 평소와 구분되지 않음` : ' — 표본이 작아 참고만';
  return { id, label, kind: 'frequency', vote, small: !voting, rate: round(rate), base: round(base), n: sampleN, edge: round(edge),
    text: `${condition}: ${LEAN_RULES.horizon}거래일 뒤 상승 ${round(rate)}% (평소 ${round(base)}%, 표본 ${sampleN}${unit}${sampleNote})${tail}` };
}

/** The six-axis count as a condition item (votes when one side leads by two or more). */
export function conditionEvidence(regime) {
  const counts = regime?.available && regime.sufficient !== false ? regime.counts : null;
  if (!counts) return null;
  const net = (counts.favorable || 0) - (counts.burden || 0);
  const vote = net >= LEAN_RULES.conditionGap ? 1 : net <= -LEAN_RULES.conditionGap ? -1 : 0;
  return { id: 'conditions', label: '지금 조건', kind: 'count', vote, net,
    text: `미국 6개 지표 양호 ${counts.favorable}·중립 ${counts.neutral}·부담 ${counts.burden}${vote ? ` — ${vote > 0 ? '양호' : '부담'} 쪽이 ${Math.abs(net)}개 많음` : ' — 한쪽으로 2개 이상 기울지 않음'}` };
}

// A market body the producer kept from an earlier run (`retained`), or one dated before the close being judged, is not
// today's condition: it is held out of the lean (the 가격 온도 screen marks the same rows stale).
function temperatureItem(market, id, name, { retained = [], asOf = null } = {}) {
  if (!market || !['cold', 'hot'].includes(market.state)) return null;
  const key = id.replace('temp-', '');
  if (retained.includes(key) || (asOf && market.asOf && market.asOf < asOf)) return null;
  const outcome = market.outcomes?.[market.state]?.h21;
  const base = market.outcomes?.all?.h21?.hitRate;
  if (!outcome) return null;
  const item = frequencyEvidence({ id, label: `${name} 가격 온도`, condition: `${name} 가격 온도 '${market.state === 'cold' ? '차가움' : '뜨거움'}'(${market.asOf ? `${Number(market.asOf.slice(5, 7))}/${Number(market.asOf.slice(8, 10))} 기준, ` : ''}겹치지 않는 과거 구간)`, rate: outcome.hitRate, base, n: outcome.n, unit: '구간' });
  return item && { ...item, path: 'index-temperature' };
}

function stressItem(stress, vix) {
  const band = stressBandOf(vix);
  const row = band ? stress?.bands?.find((item) => item.id === band.id)?.horizons?.[String(LEAN_RULES.horizon)] : null;
  const base = stress?.all?.[String(LEAN_RULES.horizon)]?.hitRate;
  if (!row) return null;
  // The band rate pools overlapping daily 21-session windows, so it is not a frequency of independent cases (AGENTS
  // past-frequency rule): it is shown for reference beside the base rate and never votes.
  const item = frequencyEvidence({ id: 'vix-band', label: '변동성 구간', condition: `VIX ${Number(vix).toFixed(1)}(${band.label} 구간)`, rate: row.hitRate, base, n: row.nEff ?? row.n / LEAN_RULES.horizon, unit: '개', sampleNote: ', 겹침 보정' });
  return item && { ...item, vote: 0, reference: true, text: `${item.text.replace(/ — .*$/, '')} — 기간이 서로 겹치는 통계라 참고만 하고 판단에는 넣지 않음` };
}

// Items that share a `path` read one price series twice (S&P 500 and Nasdaq temperature, KOSPI and KOSDAQ): the same
// direction from both is one vote, so two cold indices cannot turn 약한 매수 우위 into 매수 우위 by themselves.
function combine(items) {
  const seen = new Set();
  const votes = items.filter(Boolean).filter((item) => item.vote && !(item.path && seen.has(`${item.path}:${item.vote}`)) && (!item.path || seen.add(`${item.path}:${item.vote}`))).map((item) => item.vote);
  const up = votes.filter((v) => v > 0).length, down = votes.filter((v) => v < 0).length;
  if (up && down) return { key: 'mixed', score: up - down };
  const score = Math.max(-2, Math.min(2, up - down));
  return { key: String(score), score };
}

function leanRead(key, items, baseRate) {
  const drivers = items.filter((item) => item?.vote);
  const base = Number.isFinite(baseRate) ? `1990년 이후 S&P 500은 ${LEAN_RULES.horizon}거래일(약 한 달) 뒤 ${round(baseRate)}%의 경우 올라 있었습니다. 이것이 기본값입니다. ` : '';
  if (key === 'mixed') return `${base}지금 조건과 과거 빈도가 서로 다른 쪽을 가리켜 한쪽 우위로 정리하지 않습니다.`;
  if (!drivers.length) return `${base}지금 확인되는 ${items.some((item) => item?.kind === 'frequency' && !item.reference) ? '조건과 과거 빈도 모두' : '조건이'} 이 기본값을 의미 있게 바꾸지 못해 뚜렷한 우위는 없습니다.`;
  const side = drivers[0].vote > 0 ? '상승' : '하락';
  // R697: the condition count is never called a likelihood; only a frequency that cleared its noise gate moves the odds.
  const counted = drivers.filter((item) => item.kind === 'count');
  const measured = drivers.filter((item) => item.kind === 'frequency');
  const countText = counted.length ? `지금 조건은 ${side === '상승' ? '양호' : '부담'} 쪽이 더 많습니다. ` : '';
  const freqText = measured.length ? `${measured.map((item) => item.label).join('·')}의 과거 빈도가 기본값보다 ${side} 쪽이라, 확률상 기울기가 ${side} 쪽으로 옮겨 갑니다.`
    : items.some((item) => item?.kind === 'frequency' && !item.reference) ? '다만 지금과 비슷한 날들의 과거 빈도는 기본값과 구분되지 않아, 이 기울기는 조건 개수에서만 나옵니다.'
      : '판단에 넣을 수 있는 과거 빈도(겹치지 않는 사례)가 지금은 없어, 조건 개수로만 봅니다.';
  return `${base}${countText}${freqText} 방향이 정해졌다는 뜻은 아닙니다.`;
}

/**
 * @param {object} input { regime, stress (stress-outcomes artifact), temperature (market-temperature artifact), vix,
 *   validation (model-validation-status.json; absent = not validated) }
 * @returns { us, kr } each { available, label, key, score, items, read, flip }; us also { ruleKey, spoken,
 *   validation, frequency }. `key` is the rule's key when its direction is spoken and 'counts' otherwise.
 * No lean maps to a choice (hold / stage / wait / defend), on screen or in the AI context (R724): a market
 * tilt is never turned into what to do.
 */
export function buildMarketLean({ regime = null, stress: published = null, temperature = null, vix = null, validation: verdict = null } = {}) {
  const validation = leanValidation(verdict);
  const stress = currentStressOutcomes(published); // a record from another definition is not used
  const baseRate = stress?.all?.[String(LEAN_RULES.horizon)]?.hitRate ?? temperature?.markets?.spx?.outcomes?.all?.h21?.hitRate ?? null;
  const retained = Array.isArray(temperature?.retained) ? temperature.retained : [];
  const usAsOf = regime?.asOf || null;
  const usItems = [conditionEvidence(regime), stressItem(stress, vix), temperatureItem(temperature?.markets?.spx, 'temp-spx', 'S&P 500', { retained, asOf: usAsOf }), temperatureItem(temperature?.markets?.nasdaq, 'temp-nasdaq', '나스닥', { retained, asOf: usAsOf })].filter(Boolean);
  const usCombined = combine(usItems);
  const condition = usItems.find((item) => item.id === 'conditions');
  const flip = condition?.vote ? `양호·부담 지표 차이가 1개 이하로 줄면 조건 쪽 기울기는 사라집니다(지금 ${Math.abs(condition.net)}개).`
    : condition ? `부담이나 양호 쪽이 2개 이상 많아지면 조건 쪽 기울기가 생깁니다.` : null;
  // R697: when only the condition count votes, the label says so — a count is not a measured likelihood.
  const countOnly = usCombined.score !== 0 && usItems.every((item) => !item.vote || item.kind === 'count');
  // What the lean is built from today. A frequency votes only past its noise gate; on the published record none of the
  // temperature frequencies does, so the count alone decides and only the three middle labels can appear — said on the
  // card instead of leaving a five-step scale implied.
  const measured = usItems.some((item) => item.kind === 'frequency' && !item.reference && item.vote);
  const basis = measured ? '6개 지표 개수와 기준을 넘은 과거 빈도로 정한 기울기입니다.'
    : `지금은 기준(표본 ${LEAN_RULES.minVoteN}개 이상, 평소와 차이가 표준오차 ${LEAN_RULES.seMultiple}배·${LEAN_RULES.minEdgePp}%p 이상)을 넘는 과거 빈도가 없어 6개 지표 개수만으로 정한 기울기입니다. 그래서 '${LEAN_LABELS[2]}'·'${LEAN_LABELS[-2]}'·'${LEAN_LABELS.mixed}'은 지금 나오지 않습니다.`;
  const spoken = leanSpoken(usCombined.key, validation);
  const counts = condition ? regime.counts : null;
  const baseText = Number.isFinite(baseRate) ? `1990년 이후 S&P 500은 ${LEAN_RULES.horizon}거래일(약 한 달) 뒤 ${round(baseRate)}%의 경우 올라 있었습니다. ` : '';
  const us = { available: usItems.length > 0, market: 'US', key: spoken ? usCombined.key : 'counts', ruleKey: usCombined.key, score: usCombined.score, spoken, validation: validation.status,
    countOnly, measured, items: usItems, horizon: LEAN_RULES.horizon, baseRate,
    ...(spoken ? { label: `${LEAN_LABELS[usCombined.key]}${countOnly ? ' (조건 기준)' : ''}`, frequency: frequencyNote(usCombined.key, validation), basis,
      read: leanRead(usCombined.key, usItems, baseRate), flip }
      : { label: countState(counts), frequency: null, basis: verdictLine(validation, usCombined.key), flip: null,
        read: `${baseText}${counts ? `미국 6개 지표는 ${countState(counts).replace(/ · /g, ', ')}입니다.` : '미국 6개 지표 개수가 판정 기준에 못 미칩니다.'}` }) };
  const krItems = [temperatureItem(temperature?.markets?.kospi, 'temp-kospi', '코스피', { retained }), temperatureItem(temperature?.markets?.kosdaq, 'temp-kosdaq', '코스닥', { retained })].filter(Boolean);
  const krCombined = combine(krItems);
  const krFirst = krItems[0];
  const krName = krFirst?.id === 'temp-kosdaq' ? '코스닥' : '코스피';
  const krBase = temperature?.markets?.[krFirst?.id === 'temp-kosdaq' ? 'kosdaq' : 'kospi']?.outcomes?.all?.h21?.hitRate;
  const krTail = krItems.some((item) => item.vote) ? '가격 온도가 이 기본값을 의미 있게 바꿉니다.' : '지금 가격 온도의 과거 빈도는 이 기본값과 구분되지 않습니다.';
  // The backtest covers the US rule only, so the Korea reference never carries a direction word: its items keep their
  // rates beside the base rate and sample size.
  // Owner-approved: beside the six-axis state, one past-frequency line from the published VIX-band record (the
  // share of −5% drawdowns within 21 sessions vs the base rate, with the case count); the count itself stays a state.
  us.risk = vixBandRiskLine(vixBandRecord(published, vix));
  us.countNote = countRiskNote(validation);
  const kr = { available: krItems.length > 0, market: 'KR', key: 'counts', ruleKey: krCombined.key, score: krCombined.score, label: '가격 온도 과거 빈도', items: krItems,
    read: krItems.length ? `${Number.isFinite(krBase) ? `${withTopicParticle(krName)} 평소 ${LEAN_RULES.horizon}거래일 뒤 ${round(krBase)}%의 경우 올라 있었습니다. ` : ''}${krTail}` : null };
  return { schemaVersion: MARKET_LEAN_VERSION, us, kr };
}

export function renderMarketLeanContext(model) {
  if (!model?.us?.available) return '';
  const part = (lean, title) => lean?.available ? [`${title}: ${lean.label}${lean.frequency ? ` — ${lean.frequency}` : ''}. ${lean.read || ''}`, ...lean.items.map((item) => `- ${item.label}: ${item.text}`)] : [];
  const head = model.us.spoken
    ? `[시장 기울기(매수·매도 우위), ${MARKET_LEAN_VERSION}] 시장 전체의 약 1개월(21거래일) 기울기. 과거 검증을 통과한 방향만 이름을 붙이며 그 판정 뒤의 과거 빈도와 사례 수를 함께 씀. '(조건 기준)'이 붙으면 조건 개수만으로 기운 것이며 확률 근거가 아님. 지금 조건(개수)과 같은 기록의 과거 빈도(기저율·표본 수와 함께)만 사용하며 가격·목표가·개인 매매 지시가 아님.`
    : `[시장 기울기, ${MARKET_LEAN_VERSION}] 미국 6개 지표의 양호·중립·부담 개수(상태). 이 개수로 한 달 방향을 정하는 규칙은 과거 검증을 통과하지 못했거나 검증 전이므로, 개수를 오를 쪽·내릴 쪽이나 사는 쪽·피하는 쪽 판단으로 바꿔 말하지 않는다. 과거 빈도 항목은 기저율·표본 수와 함께만 인용. 가격·목표가·개인 매매 지시가 아님.`;
  return [head, ...part(model.us, '미국'), model.us.basis ? `구성: ${model.us.basis}` : '', model.us.flip ? `바뀌는 조건: ${model.us.flip}` : '',
    model.us.risk ? `변동성 구간 낙폭 기록: ${model.us.risk.text}` : '', model.us.countNote ? `검증: ${model.us.countNote}` : '',
    ...part(model.kr, '한국 참고')].filter(Boolean).join('\n');
}
