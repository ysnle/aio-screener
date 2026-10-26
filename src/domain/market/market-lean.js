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
import { CHOICES } from './macro-crossroads.js';

export const MARKET_LEAN_VERSION = 'market-lean.v1';
export const LEAN_RULES = Object.freeze({ horizon: 21, minVoteN: 30, minRateN: 10, minEdgePp: 5, seMultiple: 1.5, conditionGap: 2 });
export const LEAN_LABELS = Object.freeze({ 2: '매수 우위', 1: '약한 매수 우위', 0: '뚜렷한 우위 없음', [-1]: '약한 매도 우위', [-2]: '매도 우위', mixed: '엇갈림' });

const round = (value) => Math.round(value);

/** One historical-frequency item: rate vs base, sample gate, and whether it may vote. */
export function frequencyEvidence({ id, label, condition, rate, base, n, unit = '회' }) {
  if (!Number.isFinite(n) || n <= 0 || !Number.isFinite(base)) return null;
  // Floored: an effective count of 9.9 is under the 10-case line, not rounded up to it.
  const sampleN = Math.floor(n);
  if (sampleN < LEAN_RULES.minRateN) {
    return { id, label, kind: 'frequency', vote: 0, small: true, text: `${condition}: 과거 사례 ${sampleN}${unit}뿐이라 비율을 내지 않습니다.` };
  }
  if (!Number.isFinite(rate)) return { id, label, kind: 'frequency', vote: 0, small: true, text: `${condition}: 과거 비율이 기록에 없습니다.` };
  const edge = rate - base;
  const se = Math.sqrt((base / 100) * (1 - base / 100) / sampleN) * 100;
  const threshold = Math.max(LEAN_RULES.minEdgePp, LEAN_RULES.seMultiple * se);
  const voting = sampleN >= LEAN_RULES.minVoteN;
  const vote = voting && Math.abs(edge) >= threshold ? Math.sign(edge) : 0;
  const tail = vote ? (edge > 0 ? ' — 평소보다 상승 쪽' : ' — 평소보다 하락 쪽')
    : voting ? ` — 차이 ${Math.abs(round(edge))}%p가 ${threshold > LEAN_RULES.seMultiple * se ? `최소 기준 ${LEAN_RULES.minEdgePp}%p` : `표본 오차 범위(약 ±${round(LEAN_RULES.seMultiple * se)}%p)`}보다 작아 평소와 구분되지 않음` : ' — 표본이 작아 참고만';
  return { id, label, kind: 'frequency', vote, small: !voting, rate: round(rate), base: round(base), n: sampleN, edge: round(edge),
    text: `${condition}: ${LEAN_RULES.horizon}거래일 뒤 상승 ${round(rate)}% (평소 ${round(base)}%, 표본 ${sampleN}${unit})${tail}` };
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
  return frequencyEvidence({ id, label: `${name} 가격 온도`, condition: `${name} 가격 온도 '${market.state === 'cold' ? '차가움' : '뜨거움'}'(${market.asOf ? `${Number(market.asOf.slice(5, 7))}/${Number(market.asOf.slice(8, 10))} 기준, ` : ''}겹치지 않는 과거 구간)`, rate: outcome.hitRate, base, n: outcome.n, unit: '구간' });
}

function stressItem(stress, vix) {
  const band = stressBandOf(vix);
  const row = band ? stress?.bands?.find((item) => item.id === band.id)?.horizons?.[String(LEAN_RULES.horizon)] : null;
  const base = stress?.all?.[String(LEAN_RULES.horizon)]?.hitRate;
  if (!row) return null;
  // The band rate pools overlapping daily 21-session windows, so it is not a frequency of independent cases (AGENTS
  // past-frequency rule): it is shown for reference beside the base rate and never votes.
  const item = frequencyEvidence({ id: 'vix-band', label: '변동성 구간', condition: `VIX ${Number(vix).toFixed(1)}(${band.label} 구간, 겹치는 날짜 기준)`, rate: row.hitRate, base, n: row.nEff ?? row.n / LEAN_RULES.horizon, unit: '(독립 환산)' });
  return item && { ...item, vote: 0, reference: true, text: `${item.text.replace(/ — .*$/, '')} — 날짜가 겹치는 통계라 참고로만 보고 판단에 넣지 않음` };
}

function combine(items) {
  const votes = items.filter(Boolean).map((item) => item.vote).filter(Boolean);
  const up = votes.filter((v) => v > 0).length, down = votes.filter((v) => v < 0).length;
  if (up && down) return { key: 'mixed', score: up - down };
  const score = Math.max(-2, Math.min(2, up - down));
  return { key: String(score), score };
}

const CHOICE_BY_LEAN = Object.freeze({ 2: ['stage', 'hold'], 1: ['hold', 'stage'], 0: ['hold', 'wait'], [-1]: ['wait', 'hold'], [-2]: ['defend', 'wait'], mixed: ['hold', 'wait'] });

function leanRead(key, items, baseRate) {
  const drivers = items.filter((item) => item?.vote);
  const base = Number.isFinite(baseRate) ? `기본값부터: 1990년 이후 S&P 500이 ${LEAN_RULES.horizon}거래일 뒤 오른 날은 ${round(baseRate)}%입니다. ` : '';
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
 * @param {object} input { regime, stress (stress-outcomes artifact), temperature (market-temperature artifact), vix }
 * @returns { us, kr } each { available, label, key, score, items, read, flip, choices }
 */
export function buildMarketLean({ regime = null, stress = null, temperature = null, vix = null } = {}) {
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
  const us = { available: usItems.length > 0, market: 'US', key: usCombined.key, score: usCombined.score, countOnly, label: `${LEAN_LABELS[usCombined.key]}${countOnly ? ' (조건 기준)' : ''}`, items: usItems,
    read: leanRead(usCombined.key, usItems, baseRate), flip, choices: CHOICE_BY_LEAN[usCombined.key].map((id) => CHOICES[id]), horizon: LEAN_RULES.horizon, baseRate };
  const krItems = [temperatureItem(temperature?.markets?.kospi, 'temp-kospi', '코스피', { retained }), temperatureItem(temperature?.markets?.kosdaq, 'temp-kosdaq', '코스닥', { retained })].filter(Boolean);
  const krCombined = combine(krItems);
  const krFirst = krItems[0];
  const krName = krFirst?.id === 'temp-kosdaq' ? '코스닥' : '코스피';
  const krBase = temperature?.markets?.[krFirst?.id === 'temp-kosdaq' ? 'kosdaq' : 'kospi']?.outcomes?.all?.h21?.hitRate;
  const krTail = krItems.some((item) => item.vote) ? '가격 온도가 이 기본값을 의미 있게 바꿉니다.' : '지금 가격 온도의 과거 빈도는 이 기본값과 구분되지 않습니다.';
  const kr = { available: krItems.length > 0, market: 'KR', key: krCombined.key, score: krCombined.score, label: LEAN_LABELS[krCombined.key], items: krItems,
    read: krItems.length ? `${Number.isFinite(krBase) ? `${krName}가 ${LEAN_RULES.horizon}거래일 뒤 오른 날은 평소 ${round(krBase)}%입니다. ` : ''}${krTail}` : null };
  return { schemaVersion: MARKET_LEAN_VERSION, us, kr };
}

export function renderMarketLeanContext(model) {
  if (!model?.us?.available) return '';
  const part = (lean, title) => lean?.available ? [`${title}: ${lean.label}. ${lean.read || ''}`, ...lean.items.map((item) => `- ${item.label}: ${item.text}`)] : [];
  return [`[시장 기울기(매수·매도 우위), ${MARKET_LEAN_VERSION}] 시장 전체의 약 1개월(21거래일) 기울기. '(조건 기준)'이 붙으면 조건 개수만으로 기운 것이며 확률 근거가 아님. 지금 조건(개수)과 같은 기록의 과거 빈도(기저율·표본 수와 함께)만 사용하며 가격·목표가·개인 매매 지시가 아님.`,
    ...part(model.us, '미국'), model.us.flip ? `바뀌는 조건: ${model.us.flip}` : '', `일반적으로 상대적으로 덜 불리한 선택(개인 보유 종목에 대한 지시 아님): ${model.us.choices.join(', ')}`, ...part(model.kr, '한국 참고')].filter(Boolean).join('\n');
}
