// P1419 (open-source comparison: xang1234 "Backtest" page validates published picks): how the
// screener's ranking has done after the fact. Source: public-data/backtest-history.json — each daily
// record re-runs six past rebalances (147 … 42 sessions ago, 21-session hold) and reports the top
// quintile minus bottom quintile forward return (net of the modelled cost) and how often the top
// quintile won. The predictive-validity status (public-data/model-validation-status.json) is shown
// with it: a present-day universe means survivorship bias, so this is accountability, not proof.
import { createTrendChart } from './trend-chart.js';
import { liveScreenerModelFingerprint } from '../../domain/screener/model-fingerprint.js';
import { el } from './dom.js';
import { signedText } from '../../domain/shared/number.js';

export const VALIDATION_MIN_REBALANCES = 12;
export const VALIDATION_MIN_ABS_T = 2;

// v58.63 (architecture audit A11): the colour and 판단 가능 of the top-minus-bottom spread come from the spread's own
// per-rebalance series (one-sample t of its mean), never from the composite IC t — a rank correlation can be steady while
// the return gap is carried by one date (IC t 61408 beside a spread t of 1.1).
export function meanTStat(values) {
  const xs = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  const n = xs.length;
  if (n < 2) return null;
  const mean = xs.reduce((sum, x) => sum + x, 0) / n;
  const sd = Math.sqrt(xs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1));
  return sd > 0 ? mean / (sd / Math.sqrt(n)) : null;
}

const pct = (value, digits = 2) => (value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(digits)}%`);

export function summarizeValidation(history = [], status = null, liveWeights = null) {
  const rows = (Array.isArray(history) ? history : []).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')));
  const last = rows[rows.length - 1] || null;
  // X04 (2026-10-13): the curve joined rows of three model fingerprints (and rows with none) into one line. Only rows
  // computed by the same model as the latest record belong on it.
  const lastFingerprint = last?.modelFingerprint != null ? String(last.modelFingerprint) : null;
  const sameModel = rows.filter((row) => String(row.modelFingerprint ?? '') === (lastFingerprint ?? ''));
  const series = sameModel.filter((row) => Number.isFinite(Number(row.quantileSpreadNet))).map((row) => ({ date: row.date, value: Number(row.quantileSpreadNet) }));
  let pooledMarkets = false;
  try { pooledMarkets = /market-separated/.test(JSON.parse(lastFingerprint || '{}').populationPolicy || ''); } catch (_) { pooledMarkets = false; }
  // v57.81: the one count basis for every "N회 중 M회 앞섬" (screener read, stock read, 과거 검증 tab): net of cost.
  const wins = last && Number.isFinite(Number(last.netHitRate)) && Number.isFinite(Number(last.dates)) ? Math.round(Number(last.netHitRate) / 100 * Number(last.dates)) : null;
  // v57.50 D11: six rebalances with a composite IC t of about -0.26 were read as "뒤처졌습니다" in a burden colour.
  // A sign is a finding only with |t| >= 2 on at least 12 rebalances; otherwise the record says it cannot tell yet.
  // t is the record's own statistic when it carries one (ic.compositeT / icT); it is never estimated from the pooled n.
  const icT = Number.isFinite(Number(last?.ic?.compositeT)) ? Number(last.ic.compositeT) : Number.isFinite(Number(last?.icT)) ? Number(last.icT) : null;
  const spreadSeries = Array.isArray(last?.quantileSpreadNetByDate) ? last.quantileSpreadNetByDate.map(Number).filter(Number.isFinite) : [];
  const tStat = meanTStat(spreadSeries);
  const samples = Number.isFinite(Number(last?.dates)) ? Number(last.dates) : null;
  const distinguishable = spreadSeries.length >= VALIDATION_MIN_REBALANCES && tStat != null && Math.abs(tStat) >= VALIDATION_MIN_ABS_T;
  const tone = !last || !Number.isFinite(Number(last.quantileSpreadNet)) ? 'unknown' : !distinguishable ? 'neutral' : Number(last.quantileSpreadNet) > 0 ? 'favorable' : 'burden';
  const undecided = `아직 우연과 구별 안 됨(표본 ${samples ?? '—'}회${tStat != null ? `, t=${tStat.toFixed(2)}` : ''})`;
  // P1449: stored rows must carry the model fingerprint. A mismatch — or no fingerprint at all
  // (rows produced before this identity existed) — means the record was NOT produced by the
  // model on screen, so it cannot be presented as that ranking's validation.
  const modelFingerprint = last?.modelFingerprint != null ? String(last.modelFingerprint) : null;
  const liveFingerprint = liveScreenerModelFingerprint(liveWeights);
  const modelMatch = modelFingerprint == null || liveFingerprint == null ? false : modelFingerprint === liveFingerprint;
  return {
    available: !!last,
    date: last?.date || null,
    stocks: last?.n ?? null,
    rebalances: last?.dates ?? null,
    spreadNet: last?.quantileSpreadNet ?? null,
    costPct: last?.transactionCostPct ?? null,
    wins,
    winsBasis: 'net',
    ic: last?.ic?.composite ?? null,
    series,
    sameModelRecords: sameModel.length,
    pooledMarkets,
    modelMatch,
    tone,
    tStat,
    icT,
    distinguishable,
    undecided,
    verdict: !last ? '사후 검증 기록 수신 대기'
      : !modelMatch ? `이 과거 기록은 지금 화면의 순위와 가중치·정의(계산 방식)가 다른 이전 모델로 계산되어, 지금 순위의 검증으로 읽지 않습니다. 같은 모델의 기록이 쌓인 뒤 이 영역이 다시 성과를 말합니다.`
      : !distinguishable ? `${undecided} — 최근 ${last.dates}번의 과거 시점에서 상위 20%와 하위 20%의 평균 차이는 ${pct(last.quantileSpreadNet)}(비용 반영)였지만, 이 표본으로는 우연한 차이와 구별되지 않습니다. 앞섬·뒤처짐 판정은 ${VALIDATION_MIN_REBALANCES}회 이상, |t| ${VALIDATION_MIN_ABS_T} 이상에서 합니다.`
      : tone === 'favorable' ? `최근 ${last.dates}번의 과거 시점에서 기본 복합 순위 상위 20%가 하위 20%보다 평균 ${pct(last.quantileSpreadNet)} 앞섰습니다(비용 반영). 표본이 작고 생존 편향이 있어 예측 우위의 증명은 아닙니다.`
        : `지금까지 이 순위의 예측 우위는 확인되지 않았습니다. 최근 ${last.dates}번의 과거 시점에서 상위 20%가 하위 20%보다 평균 ${pct(last.quantileSpreadNet)} — 기본 복합 순위(모멘텀·추세·저변동·칼만)는 이 기간 동안 뒤처졌습니다(비용 반영).`,
    validation: status?.status === 'BLOCKED' || status?.predictiveValidation === 'not-established'
      ? '예측력 검증 미완료 — 지금의 종목 구성으로 과거를 본 결과라 사라진 종목이 빠진 생존 편향이 있고, 거래량·체결 용량은 반영하지 않았습니다. 순위는 상대 비교용입니다.'
      : status?.status ? `검증 상태: ${status.status}` : null
  };
}

// v57.77: this block used to sit above the results table with its own verdict, spread, IC, sample and survivorship
// notes — the same back-test the 과거 검증 tab reports in full (renderBacktest in src/ui/pages/screener.js: verdict,
// per-factor IC, gross/net spread, sample, 10-year study, forward record). It now lives inside that tab and adds
// only what the tab lacks: the same-model history curve and the |t| decision rule.
export function renderScreenerValidation({ documentRef: doc, root }) {
  const host = doc?.getElementById('screener-validation');
  if (!host) return null;
  const summary = summarizeValidation(root?._aioScreenerBacktestHistory || [], root?._aioModelValidationStatus || null, root?._aioRankingWeights || null);
  host.replaceChildren(el(doc, 'h3', '날마다 다시 계산한 검증의 추이', 'stock-read-vis-title'));
  if (!summary.available) {
    host.append(el(doc, 'p', '사후 검증 기록 수신 대기', 'theme-strength-basis'));
  } else {
    if (!summary.modelMatch) host.append(el(doc, 'p', '이 기록은 지금 화면의 순위와 가중치·계산 방식이 다른 이전 모델로 계산되어, 지금 순위의 검증으로 읽지 않습니다.', 'theme-strength-basis'));
    if (summary.series.length >= 2) host.append(createTrendChart(doc, { series: summary.series, refLines: [0], format: (value) => `${value.toFixed(1)}%`, label: '상위−하위 20% 수익률 차이(비용 반영, 같은 모델 기록만)' }));
    else host.append(el(doc, 'p', `같은 모델로 계산된 기록이 ${summary.sameModelRecords}개뿐이라 추이 그림은 기록이 쌓인 뒤 표시합니다.`, 'theme-strength-basis'));
    host.append(el(doc, 'p', summary.distinguishable
      ? `최근 기록 ${summary.date}, 상위−하위 20% ${pct(summary.spreadNet)} — ${summary.rebalances}회 표본에서 우연의 범위(|t| ${VALIDATION_MIN_ABS_T})를 넘은 차이입니다.`
      : `최근 기록 ${summary.date}, ${summary.undecided} — 앞섬·뒤처짐 판정은 기록이 ${VALIDATION_MIN_REBALANCES}회 이상 쌓이고 차이가 우연의 범위(|t| ${VALIDATION_MIN_ABS_T})를 넘을 때 합니다.`, 'theme-strength-basis'));
  }
  host.dataset.aioScreenerValidationRenderer = 'native';
  return summary;
}

// 개편 v2 (3c/5h): one reading of the validation state for the banner before the table and the 사후 검증 summary.
// Sources: public-data/screener-validation-gate.json (gate status and blockers), the screener artifact's backtest
// (net top-minus-bottom spread, net hit rate, per-rebalance IC) and the |t| decision rule above. A sign is never read
// as a finding below 12 rebalances or |t| < 2 ('판단 불가'), and the tiles stay neutral until it is.
const GATE_BLOCKER_WORDS = Object.freeze({
  pointInTimeUniverse: '과거 시점의 종목 구성',
  delistingAndCorporateAction: '상장폐지·기업 행위 처리',
  filingAvailableDate: '공시 공개일',
  turnoverModeled: '회전율',
  transactionCostsModeled: '거래비용',
  liquidityCapacityModeled: '유동성·체결 용량',
  liveBacktestParity: '실제 순위와 검증 정의의 일치'
});
const finiteOrNull = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
const signedPp = (value, digits = 2) => signedText(value, digits, '%p');
const CANDIDATE_LINE = '순위는 결론이 아니라 확인할 후보입니다.';

export function readValidationState({ metadata = null, root = null, listingMarket = 'US' } = {}) {
  const gate = root?._aioScreenerValidationGate || null;
  const gateChip = !gate ? '검증 상태 없음' : gate.status === 'BLOCKED' ? '검증 요건 미충족' : null;
  const blockers = (Array.isArray(gate?.blockers) ? gate.blockers : []).map((key) => GATE_BLOCKER_WORDS[key] || key);
  const base = { gate, gateChip, blockers, gateObservedAt: gate?.observedAt ? String(gate.observedAt).slice(0, 10) : null };
  if (listingMarket === 'KR') {
    return { ...base, state: 'kr', chips: [gateChip, '판단 불가'].filter(Boolean), sentence: `한국 순위는 아직 사후 검증 기록이 없어 판단 불가입니다 — 미국 검증을 한국 순위의 근거로 쓰지 않습니다. ${CANDIDATE_LINE}` };
  }
  const backtest = metadata?.backtest || null;
  const dates = Array.isArray(backtest?.rebalanceDates) ? backtest.rebalanceDates : [];
  const samples = finiteOrNull(backtest?.rebalancesCounted) ?? (dates.length || null);
  const net = finiteOrNull(backtest?.quantileSpreadNet);
  if (!backtest || samples == null || net == null) {
    return { ...base, state: 'none', chips: [gateChip, '판단 불가'].filter(Boolean), sentence: `사후 검증 기록을 받지 못해 판단 불가입니다. ${CANDIDATE_LINE}` };
  }
  const netRate = finiteOrNull(backtest.netHitRate);
  const rate = netRate ?? finiteOrNull(backtest.hitRate);
  const wins = rate == null ? null : Math.round(rate / 100 * samples);
  // Review fix: t comes only from the record that supplies the sample count (the screener artifact's backtest); without it
  // the sample cannot decide.
  const icT = finiteOrNull(backtest.ic?.compositeT);
  const liveFingerprint = liveScreenerModelFingerprint(metadata?.ranking?.appliedFactorWeights);
  const modelMatch = backtest.modelFingerprint != null && liveFingerprint != null && backtest.modelFingerprint === liveFingerprint;
  const icByDate = Array.isArray(backtest.icByDate?.composite) ? backtest.icByDate.composite : [];
  // v58.56 (#6): the producer names the dates its composite IC values belong to (a date with too few rows is skipped);
  // records before that keep the old positional reading only when the counts match.
  const icDates = Array.isArray(backtest.icCompositeDates) && backtest.icCompositeDates.length === icByDate.length ? backtest.icCompositeDates
    : icByDate.length === dates.length ? dates : [];
  // v58.56 (#6): one top-minus-bottom reading per rebalance (percent, gross; net = after the modelled turnover cost).
  const byDate = (key) => (Array.isArray(backtest[key]) ? backtest[key] : []);
  const spreadPoints = (Array.isArray(backtest.spreadDates) ? backtest.spreadDates : []).map((date, index) => ({
    date,
    gross: finiteOrNull(byDate('quantileSpreadByDate')[index]),
    net: finiteOrNull(byDate('quantileSpreadNetByDate')[index]),
    top: finiteOrNull(byDate('topQuintileMeanByDate')[index]),
    bottom: finiteOrNull(byDate('bottomQuintileMeanByDate')[index]),
    cost: finiteOrNull(byDate('transactionCostByDate')[index])
  })).filter((point) => point.gross != null && point.top != null && point.bottom != null);
  const spreadNets = spreadPoints.map((point) => point.net).filter((value) => value != null);
  const tStat = meanTStat(spreadNets);
  const distinguishable = spreadNets.length >= VALIDATION_MIN_REBALANCES && tStat != null && Math.abs(tStat) >= VALIDATION_MIN_ABS_T;
  const sentence = [
    modelMatch ? null : '지금 가중치와 다른 모델로 계산된 기록입니다.',
    `과거 ${samples}회 시점 중 상위 20%가 하위 20%보다 앞선 것은 ${wins == null ? '—' : `${wins}회`}, 두 묶음의 평균 수익 차이는 ${signedPp(net)}(비용 반영)입니다.`,
    distinguishable ? null : `표본 ${samples}회로는 우연과 구별되지 않아 판단 불가입니다.`,
    CANDIDATE_LINE
  ].filter(Boolean).join(' ');
  return {
    ...base,
    state: distinguishable ? (net > 0 ? 'favorable' : 'burden') : 'undecided',
    chips: [gateChip, distinguishable ? null : '판단 불가'].filter(Boolean),
    sentence,
    samples, net, wins, winsBasis: netRate != null ? '비용 후' : '비용 전', tStat, icT, distinguishable, modelMatch,
    fwdDays: finiteOrNull(backtest.fwdDays) ?? 21,
    asOf: backtest.asOf ? String(backtest.asOf).slice(0, 10) : null,
    points: icDates.map((date, index) => ({ date, ic: finiteOrNull(icByDate[index]) })).filter((point) => point.ic != null),
    spreadPoints
  };
}

export function renderValidationHero({ documentRef: doc, read }) {
  const host = doc?.getElementById('scr-validation-hero');
  if (!host || !read) return;
  const tile = (label, value, sub, className = '') => {
    const node = el(doc, 'div', null, `sx-card sx-card--tile scr-vh-tile ${className}`.trim());
    node.append(el(doc, 'span', label, 'scr-vh-label'), el(doc, 'strong', value, 'sx-kpi scr-vh-value'), el(doc, 'span', sub, 'sx-meta'));
    return node;
  };
  const parts = [];
  if (read.samples != null) {
    const half = read.samples / 2;
    const kpis = el(doc, 'div', null, 'sx-grid sx-grid--3 scr-vh-kpis');
    kpis.append(
      tile('상위 − 하위 평균', signedPp(read.net), `비용 반영, ${read.fwdDays}거래일 뒤, 같은 비중`, read.distinguishable ? `is-${read.state}` : ''),
      tile('상위가 앞선 횟수', read.wins == null ? '—' : `${read.wins} / ${read.samples}`, read.wins == null ? '기록 없음' : `${read.winsBasis}, 동전 던지기 기댓값 ${Number.isInteger(half) ? half : half.toFixed(1)}회${read.wins < half ? '보다 적음' : read.wins > half ? '보다 많음' : '와 같음'}`),
      tile('표본 판단', read.distinguishable ? '판단 가능' : '판단 불가', `시점 ${read.samples}회, ${read.tStat != null ? `차이의 t ${read.tStat.toFixed(2)}` : '차이의 t 미계산'}, ${VALIDATION_MIN_REBALANCES}회·|t| ${VALIDATION_MIN_ABS_T} 이상에서 판단`)
    );
    parts.push(kpis);
  } else {
    const card = el(doc, 'div', null, 'sx-card scr-vh-empty');
    card.append(el(doc, 'span', read.chips.join(', '), 'sx-chip sx-chip--sm sx-chip--warn'), el(doc, 'p', read.sentence, 'sx-lede'));
    parts.push(card);
  }
  // v58.56 (#6, design 5h): the per-date card is the top-minus-bottom spread — what the ranking's top fifth did against its
  // bottom fifth at each past rebalance. The IC (a rank correlation) stays below it in a fold.
  if (read.samples != null || read.points?.length) {
    const card = el(doc, 'div', null, 'sx-card scr-vh-dates');
    const head = el(doc, 'div', null, 'sx-card__head');
    head.append(el(doc, 'h3', '시점별 상위 20% − 하위 20%', 'sx-card__title'), el(doc, 'span', `${read.fwdDays}거래일 뒤 수익률, 같은 비중, 비용 전`, 'sx-card__meta'));
    card.append(head);
    const spread = read.spreadPoints || [];
    if (spread.length) {
      const max = Math.max(0.5, ...spread.map((point) => Math.abs(point.gross)));
      for (const point of spread) {
        const up = point.gross >= 0;
        const line = el(doc, 'div', null, 'scr-vh-row scr-vh-spread-row');
        line.title = `상위 20% 평균 ${pct(point.top)} − 하위 20% 평균 ${pct(point.bottom)} = ${signedPp(point.gross)}${point.net != null ? `, 거래비용(회전율 기준 ${point.cost != null ? `${point.cost.toFixed(2)}%` : '—'}) 반영 ${signedPp(point.net)}` : ''}`;
        const track = el(doc, 'span', null, 'scr-vh-track');
        const fill = el(doc, 'span', null, `scr-vh-fill ${up ? 'is-up' : 'is-burden'}`);
        fill.style.width = `${Math.min(50, Math.abs(point.gross) / max * 50).toFixed(1)}%`;
        fill.style[up ? 'left' : 'right'] = '50%';
        track.append(fill);
        const legs = el(doc, 'span', null, 'scr-vh-legs');
        legs.append(el(doc, 'span', `상위 ${pct(point.top)}`), el(doc, 'span', `하위 ${pct(point.bottom)}`));
        line.append(el(doc, 'span', point.date, 'scr-vh-date'), track, legs, el(doc, 'span', signedPp(point.gross), `scr-vh-ic ${up ? 'sx-up' : 'scr-tone-burden'}`));
        card.append(line);
      }
      card.append(el(doc, 'p', `막대 = 그 시점 상위 20% 평균 − 하위 20% 평균(비용 전). 위의 평균 ${signedPp(read.net)}은 시점마다 바뀐 종목만큼의 거래비용을 뺀 값입니다.`, 'sx-meta scr-vh-note'));
    } else {
      // Records written before the per-date arrays carry only the average; the next screener refresh adds the dates.
      card.append(el(doc, 'p', `시점별 상위·하위 평균은 다음 스크리너 갱신부터 표시됩니다 — 지금 받은 기록${read.asOf ? `(${read.asOf})` : ''}에는 ${read.samples ?? '—'}회 평균만 있습니다.`, 'sx-meta scr-vh-note'));
    }
    if (read.points?.length) {
      const fold = el(doc, 'details', null, 'sx-disclosure scr-vh-ic-fold');
      // Open while the per-date spreads have not arrived (the IC is then the only per-date reading); a re-render keeps the reader's choice.
      const previous = host.querySelector('.scr-vh-ic-fold');
      if (previous?.dataset.userToggled) fold.dataset.userToggled = '1';
      fold.open = previous?.dataset.userToggled ? previous.open : !spread.length;
      const summary = el(doc, 'summary', null);
      summary.append(el(doc, 'span', '시점별 종합 IC', 'scr-vh-ic-title'), el(doc, 'span', `순위와 ${read.fwdDays}거래일 뒤 수익률의 순위상관, 0 = 관계 없음`, 'sx-meta'));
      summary.addEventListener('click', () => { fold.dataset.userToggled = '1'; });
      fold.append(summary);
      const body = el(doc, 'div', null, 'scr-vh-ic-body');
      const maxIc = Math.max(0.1, ...read.points.map((point) => Math.abs(point.ic)));
      for (const point of read.points) {
        const line = el(doc, 'div', null, 'scr-vh-row');
        const track = el(doc, 'span', null, 'scr-vh-track');
        const fill = el(doc, 'span', null, `scr-vh-fill ${point.ic >= 0 ? 'is-up' : 'is-burden'}`);
        fill.style.width = `${Math.min(50, Math.abs(point.ic) / maxIc * 50).toFixed(1)}%`;
        fill.style[point.ic >= 0 ? 'left' : 'right'] = '50%';
        track.append(fill);
        line.append(el(doc, 'span', point.date, 'scr-vh-date'), track, el(doc, 'span', signedText(point.ic, 3), `scr-vh-ic ${point.ic >= 0 ? 'sx-up' : 'scr-tone-burden'}`));
        body.append(line);
      }
      fold.append(body);
      card.append(fold);
    }
    parts.push(card);
  }
  const principle = el(doc, 'div', null, 'sx-card scr-vh-principle');
  principle.append(el(doc, 'h3', '원리, 왜 검증을 먼저 보여주나', 'sx-card__title'));
  const rule = `이 화면은 ${VALIDATION_MIN_REBALANCES}회 이상·|t| ${VALIDATION_MIN_ABS_T} 이상에서 앞섬·뒤처짐을 판단합니다(학술 제안인 t 3보다 느슨한 기준).`;
  const undecided = read.samples != null && !read.distinguishable
    ? ` 표본 ${read.samples}회${read.tStat == null ? '(t 미계산)' : `(t ${read.tStat.toFixed(2)})`}로는 이 기준에 못 미쳐, 순위는 계속 후보 목록으로 표시합니다.` : '';
  principle.append(el(doc, 'p', `요인 점수의 예측력은 정보 계수(IC) — 점수 순위와 이후 수익률 순위의 상관 — 로 잽니다. 학술 연구에서도 '발견된' 요인 상당수가 데이터 마이닝의 산물일 수 있어, 새 요인에는 t 값 3 이상을 요구해야 한다는 제안이 있습니다. ${rule}${undecided}`, 'sx-disclosure__text'));
  if (read.gateChip) principle.append(el(doc, 'p', read.gate ? `검증 게이트 ${read.gateChip}${read.blockers.length ? ` — 아직 확인되지 않은 항목: ${read.blockers.join(', ')}` : ''}${read.gateObservedAt ? ` (${read.gateObservedAt} 기준)` : ''}.` : '검증 게이트 파일을 받지 못했습니다 — 없음.', 'scr-vh-gate'));
  const evidence = el(doc, 'div', null, 'sx-evidence scr-vh-evidence');
  evidence.append(el(doc, 'span', '근거, Grinold(1989) 기본 법칙, Harvey·Liu·Zhu(2016) …and the Cross-Section of Expected Returns'), el(doc, 'span', `데이터, 스크리너 산출물 사후 검증${read.asOf ? ` ${read.asOf}` : ''}, screener-validation-gate`), el(doc, 'span', `상태, ${read.chips.join(', ') || '기록 있음'}`));
  principle.append(evidence);
  parts.push(principle);
  host.replaceChildren(...parts);
  host.dataset.validationState = read.state;
}
