// v58.75 (teach-and-check D1–D4, owner 2026-10-24): the chart teaches how a desk reads a setup instead of choosing for the
// reader — where the stock sits in a setup's life cycle, a pre-breakout checklist (a count of met conditions with the
// principle and the current value; not a probability or a grade), whether the weekly and daily pictures agree, and what
// followed this stock's own past breakouts (non-overlapping cases; under 10 only the count). Pure functions on the
// chart analysis (chart-analysis.js analyzeChart) and values the caller reads from existing models.
import { RULES } from '../rules/thresholds.js';
import { detectContractions, isBreakoutDay } from './definitions.js';
import { signedText } from '../shared/number.js';

const TECH = RULES.technical;
const pct = (value, digits = 1) => signedText(value, digits, '%');

export const SETUP_STAGES = Object.freeze([
  { id: 'base', label: '베이스 형성', check: '조정 폭이 차례로 얕아지는지(수축), 하락일 거래량이 줄어드는지 봅니다.' },
  { id: 'approach', label: '피벗 접근', check: '피벗 가까이에서 거래량이 마르고 하루 변동폭이 좁아지는지 봅니다.' },
  { id: 'breakout', label: '돌파', check: '피벗 위 종가와 평소보다 많은 거래량이 같은 날 나오는지 봅니다.' },
  { id: 'follow', label: '후속 확인', check: '돌파 뒤 며칠 동안 피벗 위에서 버티는지, 하락일 거래량이 적은지 봅니다.' },
  { id: 'extended', label: '확장(과열)', check: '피벗과 50일선에서 얼마나 멀어졌는지, 새 수축(쉬어 가기)이 생기는지 봅니다.' }
]);

/** The life-cycle stage, or an off-band state (downtrend / failed breakout / no structure). */
export function setupLifecycle(analysis) {
  if (!analysis?.available) return null;
  const close = analysis.last.close;
  const pivot = analysis.pivot;
  const ceiling = pivot != null ? pivot * (1 + TECH.breakout.maxAbovePct / 100) : null;
  const extendedFrom50 = Number.isFinite(analysis.adrFrom50) && analysis.adrFrom50 >= TECH.extension.extended;
  let stage = null, off = null;
  if (analysis.state === 'downtrend') off = 'downtrend';
  else if (analysis.state === 'failed') off = 'failed';
  else if (analysis.state === 'extended' || (extendedFrom50 && analysis.brokeOut)) stage = 'extended';
  else if (analysis.state === 'breakout') stage = 'breakout';
  else if (analysis.brokeOut && pivot != null && close > pivot && close <= ceiling) stage = 'follow';
  else if (analysis.state === 'setup') stage = 'approach';
  else if (analysis.vcp?.contractions?.length) stage = 'base';
  else off = 'none';
  const sessionsSinceBreakout = analysis.breakoutIndex != null ? analysis.bars.length - 1 - analysis.breakoutIndex : null;
  const OFF_TEXT = {
    downtrend: '하락 추세(200일선 아래 또는 50일선이 200일선 아래)라 셋업 생애 주기 밖입니다 — 전문가는 먼저 추세가 돌아서는지(200일선 회복)를 봅니다.',
    failed: `돌파 뒤 피벗 아래로 되돌아온 '실패한 돌파' 상태입니다 — 다시 베이스를 만드는지, 피벗을 거래량과 함께 되찾는지를 봅니다.`,
    none: '수축 구조가 확인되지 않아 셋업 생애 주기의 어느 단계로도 읽지 않습니다.'
  };
  const current = SETUP_STAGES.find((item) => item.id === stage) || null;
  const headline = current
    ? `셋업 생애 주기: 지금은 '${current.label}' 단계${stage === 'follow' && sessionsSinceBreakout != null ? `(돌파 ${sessionsSinceBreakout}거래일 뒤)` : ''}입니다.`
    : OFF_TEXT[off];
  return { stage, off, headline, check: current?.check || null, sessionsSinceBreakout };
}

/**
 * Pre-breakout checklist. `regime` is the shared market-regime read (market-regime.js readMarketRegime); `earnings` is
 * buildEarningsSchedule's result (analysis-read.js) or null. Each item: met true / false / null (unknown).
 */
export function breakoutChecklist(analysis, { regime = null, earnings = null } = {}) {
  if (!analysis?.available) return null;
  const items = [];
  const add = (id, label, principle, met, value) => items.push({ id, label, principle, met, value });
  const unknownTemplate = analysis.templateChecks.filter(([, ok]) => ok == null).length;
  const failedTemplate = analysis.templateChecks.filter(([, ok]) => ok === false).map(([label]) => label);
  add('template', '추세 템플릿', '오래 오르는 종목은 대개 장기 이동평균이 정배열이고 52주 고점 가까이에 있습니다 — 돌파는 상승 추세 안에서 나올 때 이어지기 쉽다는 원리입니다.',
    // v59.45 P24-EARNINGS-01 (template): 7 met + 1 unknown read 충족; an unchecked rule leaves the item unknown.
    failedTemplate.length ? false : unknownTemplate ? null : true,
    `8개 중 ${analysis.templatePass}개 충족${failedTemplate.length ? `(미충족: ${failedTemplate.join(', ')})` : ''}${unknownTemplate ? `, 확인 불가 ${unknownTemplate}개` : ''}`);
  add('dryup', '거래 마름', '돌파 직전에는 팔 사람이 줄어 거래량이 평소보다 마릅니다 — 매물이 소화됐다는 흔적입니다.',
    analysis.dryUp == null ? null : analysis.dryUp < 0.8,
    analysis.dryUp == null ? '거래량 기록 부족' : `최근 10일 평균 거래량이 50일 평균의 ${Math.round(analysis.dryUp * 100)}% (80% 미만이면 충족)`);
  add('rs', '상대강도선 신고가 선행', '지수 대비 강세(상대강도선)가 가격보다 먼저 신고가를 쓰면 기관 수요가 앞서 있다는 신호로 읽습니다.',
    analysis.rsFromHigh == null ? null : analysis.rsAtHigh,
    analysis.rsFromHigh == null ? '지수 비교 기록 부족' : analysis.rsAtHigh ? (analysis.rsLeadsPrice ? '상대강도선이 신고가 — 가격보다 먼저' : '상대강도선이 신고가(가격도 고점권)') : `상대강도선이 자체 고점보다 ${pct(analysis.rsFromHigh)}`);
  const overall = regime?.available ? regime.overall : null;
  add('market', '시장 상태', '돌파의 다수는 시장 전체가 받쳐 줄 때 이어집니다 — 지표 대부분이 부담일 때는 좋은 셋업도 실패가 잦다고 보는 관점입니다.',
    !overall || overall === '판정 보류' ? null : ['양호 우세', '다소 양호'].includes(overall),
    overall ? `${overall}${regime.counts ? ` (양호 ${regime.counts.favorable}, 부담 ${regime.counts.burden})` : ''}` : '판정 대기');
  const sessions = earnings?.state === 'scheduled' ? earnings.sessions : null;
  const windowDays = earnings?.state === 'unconfirmed' && earnings.windowEnd ? Math.round((Date.parse(earnings.windowEnd) - Date.parse(analysis.asOf)) / 86400000) : null;
  add('earnings', '다음 실적까지 거리', '실적 발표는 하루에 큰 갭을 만들 수 있어, 발표 2~3주 안에서는 차트 구조보다 발표 결과가 가격을 정하는 경우가 많습니다.',
    // v59.45 P24-EARNINGS-01: 'unconfirmed' means the calendar window does not list the name (fetch-earnings-calendar:
    // "not 'no report'"), so it is not evidence of a report after the window — the item stays unknown.
    sessions != null ? sessions > 10 : null,
    sessions != null ? `${earnings.text} (10거래일 넘게 남으면 충족)` : windowDays != null && windowDays >= 0 ? `실적 일정 목록(${earnings.windowEnd}까지)에 날짜 없음 — 발표 일정 미확인` : earnings?.text || '실적 일정 미확인');
  const multiple = analysis.adrFrom50;
  add('extension', '50일선 대비 과열 아님', '50일선에서 멀리 오른 뒤의 돌파는 되돌림 폭이 커서, 기준선 가까이에서 나온 돌파를 더 낫게 봅니다.',
    Number.isFinite(multiple) ? multiple < TECH.extension.extended : null,
    Number.isFinite(multiple) ? `50일선 대비 일평균 변동폭의 ${signedText(multiple, 1)}배 (${TECH.extension.extended}배 미만이면 충족)` : '기록 부족');
  const met = items.filter((item) => item.met === true).length;
  const known = items.filter((item) => item.met != null).length;
  const pivot = analysis.pivot;
  const failedRule = pivot != null
    ? `돌파 실패로 보는 조건: 거래량 동반 돌파(직전 ${TECH.breakout.volumeSessions}일 평균의 ${TECH.breakout.volumeMultiple}배 이상, 피벗 위 상승 마감) 뒤 종가가 피벗 ${pivot.toLocaleString('en-US', { maximumFractionDigits: 2 })} 아래로 돌아오는 것. 지금: ${analysis.state === 'failed' ? '해당 — 돌파 뒤 피벗 아래 종가' : analysis.brokeOut ? '최근 10거래일 안에 돌파가 있었고 아직 피벗 위' : '최근 10거래일 안에 돌파 없음'}.`
    : '피벗이 계산되지 않아 돌파·돌파 실패 조건을 적용하지 않습니다.';
  return {
    items, met, known, total: items.length,
    headline: `${items.length}개 중 ${met}개 충족${known < items.length ? `, 확인 불가 ${items.length - known}개` : ''} — 충족 개수이며 성공 확률이 아닙니다.`,
    failedRule
  };
}

/** Whether the weekly picture (Weinstein stage, 10/30-week order) agrees with the daily setup. */
export function timeframeAlignment(analysis) {
  if (!analysis?.available) return null;
  const stage = analysis.weinstein?.stage ?? null;
  const weekly = analysis.weeklyTrend;
  const dailyUp = ['setup', 'breakout', 'extended'].includes(analysis.state) || (analysis.state === 'none' && analysis.templatePass >= 6);
  const dailyDown = analysis.state === 'downtrend' || analysis.state === 'failed';
  const weeklyUp = stage === 2 || weekly === '정배열';
  const weeklyDown = stage === 4 || weekly === '역배열';
  const weeklyText = `주봉 ${stage ? `Weinstein ${stage}단계` : '단계 미확인'}${weekly ? `, 10·30주 ${weekly}` : ''}`;
  const dailyText = `일봉 ${analysis.stateLabel.split(' — ')[0]}`;
  let aligned = null, reading;
  if (stage == null && !weekly) reading = '주봉 기록이 부족해 두 시간대를 비교하지 않습니다.';
  else if (dailyUp && weeklyUp && !weeklyDown) { aligned = true; reading = '큰 흐름(주봉)과 지금 구조(일봉)가 같은 위쪽을 가리킵니다 — 전문가는 이렇게 겹칠 때 일봉 신호를 더 믿습니다.'; }
  else if (dailyUp && weeklyDown) { aligned = false; reading = '일봉은 위쪽 구조인데 주봉은 하락 쪽입니다 — 큰 흐름을 거스르는 일봉 신호는 짧게 끝나는 경우가 많아 신뢰를 낮춰 읽습니다.'; }
  else if (dailyDown && weeklyUp) { aligned = false; reading = '주봉은 아직 위쪽인데 일봉이 꺾였습니다 — 큰 추세 안의 조정인지, 주봉까지 꺾이는 시작인지 30주선을 지키는지로 가립니다.'; }
  else if (dailyDown && weeklyDown) { aligned = true; reading = '주봉과 일봉 모두 하락 쪽입니다 — 셋업 조건이 성립하지 않는 구간입니다.'; }
  else reading = '한쪽이 뚜렷하지 않아 두 시간대가 같은 방향이라고 말하기 어렵습니다 — 주봉 단계가 분명해지는지를 봅니다.';
  return { aligned, headline: `${weeklyText} / ${dailyText}`, reading };
}

/**
 * This stock's own past breakouts on the loaded bars: each day that met the shared breakout-day rule against the pivot
 * known at that time, cases at least `horizon` sessions apart (non-overlapping). Under 10 cases only the count; 10–29 is
 * marked a small sample; shares stand beside the same history's baseline (every non-overlapping `horizon` window).
 */
export const PAST_SETUP_MIN = 10;
export const PAST_SETUP_SMALL = 30;
export function pastBreakouts(analysis, { horizon = 20 } = {}) {
  if (!analysis?.available) return null;
  const bars = analysis.bars;
  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => (Number.isFinite(bar.volume) && bar.volume > 0 ? bar.volume : null));
  const ceiling = 1 + TECH.breakout.maxAbovePct / 100;
  const cases = [];
  let nextFree = 60;
  for (let i = 60; i + horizon < bars.length; i++) {
    if (i < nextFree) continue;
    const vcp = detectContractions(bars.slice(0, i));
    if (!vcp.valid || vcp.pivot == null) continue;
    if (!(closes[i - 1] <= vcp.pivot * ceiling) || !isBreakoutDay({ closes, volumes, i, pivot: vcp.pivot })) continue;
    const ret = (closes[i + horizon] / closes[i] - 1) * 100;
    const backBelow = closes.slice(i + 1, i + horizon + 1).some((value) => value < vcp.pivot);
    cases.push({ time: bars[i].time, ret, backBelow });
    nextFree = i + horizon;
  }
  const baseline = [];
  for (let i = 0; i + horizon < bars.length; i += horizon) baseline.push((closes[i + horizon] / closes[i] - 1) * 100);
  const median = (list) => { const s = [...list].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
  const share = (list, test) => (list.length ? list.filter(test).length / list.length : null);
  const enough = cases.length >= PAST_SETUP_MIN;
  return {
    horizon,
    count: cases.length,
    sessions: bars.length,
    enough,
    small: enough && cases.length < PAST_SETUP_SMALL,
    cases,
    upShare: enough ? share(cases, (row) => row.ret > 0) : null,
    medianRet: enough ? median(cases.map((row) => row.ret)) : null,
    backBelowShare: enough ? share(cases, (row) => row.backBelow) : null,
    baseline: enough ? { count: baseline.length, upShare: share(baseline, (value) => value > 0), medianRet: median(baseline) } : null
  };
}

export function pastBreakoutsText(past) {
  if (!past) return null;
  const span = `불러온 ${past.sessions}거래일`;
  if (!past.count) return `${span} 안에 이 종목의 돌파일(당시 피벗 기준)은 없었습니다.`;
  if (!past.enough) return `${span} 안에 겹치지 않는 돌파 사례 ${past.count}건 — ${PAST_SETUP_MIN}건 미만이라 결과는 적지 않습니다.`;
  const share = (value) => `${Math.round(value * 100)}%`;
  return `${span} 안에 겹치지 않는 돌파 사례 ${past.count}건: ${past.horizon}거래일 뒤 오른 비율 ${share(past.upShare)}(같은 기간 모든 ${past.horizon}거래일 구간 기준 ${share(past.baseline.upShare)}), 중앙값 ${pct(past.medianRet)}(기준 ${pct(past.baseline.medianRet)}), 그 사이 피벗 아래 종가가 나온 비율 ${share(past.backBelowShare)}${past.small ? ` — 사례 ${PAST_SETUP_SMALL}건 미만의 작은 표본입니다` : ''}. 이 종목 하나의 과거이며 확률이 아닙니다.`;
}
