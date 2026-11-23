import { createTrendChart } from './trend-chart.js';
import { liveScreenerModelFingerprint } from '../../domain/screener/model-fingerprint.js';
import { marketIcRows } from '../../domain/screener/validation-records.js';
import { kindFold } from './indicator-face.js';
import { el } from './dom.js';
import { signedBar, signedScale } from './signed-bar.js';
import { signedText, mean, stdev } from '../../domain/shared/number.js';
import { isIsoDay } from '../../domain/shared/session-date.js';

export const VALIDATION_MIN_REBALANCES = 12;
export const VALIDATION_MIN_ABS_T = 2;

const finiteOrNull = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

export function meanTStat(values) {
  const xs = (Array.isArray(values) ? values : []).map(finiteOrNull).filter((x) => x != null);
  const n = xs.length;
  if (n < 2) return null;
  const sd = stdev(xs, { sample: true });
  return sd > 0 ? mean(xs) / (sd / Math.sqrt(n)) : null;
}

const pct = (value, digits = 2) => (value == null || !Number.isFinite(Number(value)) ? '—' : signedText(Number(value), digits, '%'));

export function summarizeValidation(history = [], status = null, liveWeights = null) {
  const rows = (Array.isArray(history) ? history : []).filter((row) => isIsoDay(String(row?.date || '')));
  const last = rows[rows.length - 1] || null;
  const lastFingerprint = last?.modelFingerprint != null ? String(last.modelFingerprint) : null;
  const sameModel = rows.filter((row) => String(row.modelFingerprint ?? '') === (lastFingerprint ?? ''));
  // One date basis for every point: the session each record measured when all of them carry it, otherwise the run day
  // for all (a weekend run of Friday's close is keyed by the run day). One point per date, the latest record winning.
  const measured = sameModel.filter((row) => finiteOrNull(row.quantileSpreadNet) != null);
  const seriesBasis = measured.length && measured.every((row) => isIsoDay(String(row.session || ''))) ? 'session' : 'run';
  const byDay = new Map();
  for (const row of measured) byDay.set(seriesBasis === 'session' ? row.session : row.date, finiteOrNull(row.quantileSpreadNet));
  const series = [...byDay].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([date, value]) => ({ date, value }));
  let pooledMarkets = false;
  try { pooledMarkets = /market-separated/.test(JSON.parse(lastFingerprint || '{}').populationPolicy || ''); } catch (_) { pooledMarkets = false; }
  const wins = last && finiteOrNull(last.netHitRate) != null && finiteOrNull(last.dates) != null ? Math.round(Number(last.netHitRate) / 100 * Number(last.dates)) : null;
  const icT = finiteOrNull(last?.ic?.compositeT) ?? finiteOrNull(last?.icT);
  const spreadSeries = Array.isArray(last?.quantileSpreadNetByDate) ? last.quantileSpreadNetByDate.map(finiteOrNull).filter((x) => x != null) : [];
  const tStat = meanTStat(spreadSeries);
  const samples = finiteOrNull(last?.dates);
  const distinguishable = spreadSeries.length >= VALIDATION_MIN_REBALANCES && tStat != null && Math.abs(tStat) >= VALIDATION_MIN_ABS_T;
  const tone = !last || finiteOrNull(last.quantileSpreadNet) == null ? 'unknown' : !distinguishable ? 'neutral' : Number(last.quantileSpreadNet) > 0 ? 'favorable' : 'burden';
  const undecided = `아직 우연과 구별 안 됨(표본 ${samples ?? '—'}회${tStat != null ? `, t=${tStat.toFixed(2)}` : ''})`;
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
    seriesBasis,
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
      ? '예측력 검증 미완료 · 생존 편향 · 체결 용량 미반영'
      : status?.status ? `검증 상태: ${status.status}` : null
  };
}

export function renderScreenerValidation({ documentRef: doc, root }) {
  const host = doc?.getElementById('screener-validation');
  if (!host) return null;
  const summary = summarizeValidation(root?._aioScreenerBacktestHistory || [], root?._aioModelValidationStatus || null, root?._aioRankingWeights || null);
  host.replaceChildren(el(doc, 'h3', '날마다 다시 계산한 검증의 추이', 'stock-read-vis-title'));
  if (!summary.available) {
    host.append(el(doc, 'p', '사후 검증 기록 수신 대기', 'theme-strength-basis'));
  } else {
    if (!summary.modelMatch) host.append(el(doc, 'p', '이 기록은 지금 화면의 순위와 가중치·계산 방식이 다른 이전 모델로 계산되어, 지금 순위의 검증으로 읽지 않습니다.', 'theme-strength-basis'));
    if (summary.series.length >= 2) host.append(createTrendChart(doc, { series: summary.series, refLines: [0], format: (value) => `${value.toFixed(1)}%`, label: `상위−하위 20% 수익률 차이(비용 반영, 같은 모델 기록만, ${summary.seriesBasis === 'session' ? '날짜는 계산에 쓴 마지막 거래일' : '날짜는 계산을 돌린 날'}, 이웃한 날은 같은 시점들을 하루 밀어 다시 계산해 서로 겹침)` }));
    else host.append(el(doc, 'p', `같은 모델로 계산된 기록이 ${summary.sameModelRecords}개뿐이라 추이 그림은 기록이 쌓인 뒤 표시합니다.`, 'theme-strength-basis'));
    host.append(el(doc, 'p', summary.distinguishable
      ? `최근 기록 ${summary.date}, 상위−하위 20% ${pct(summary.spreadNet)} — ${summary.rebalances}회 표본에서 우연의 범위(|t| ${VALIDATION_MIN_ABS_T})를 넘은 차이입니다.`
      : `최근 기록 ${summary.date}, ${summary.undecided} — 앞섬·뒤처짐 판정은 기록이 ${VALIDATION_MIN_REBALANCES}회 이상 쌓이고 차이가 우연의 범위(|t| ${VALIDATION_MIN_ABS_T})를 넘을 때 합니다.`, 'theme-strength-basis'));
  }
  host.dataset.aioScreenerValidationRenderer = 'native';
  return summary;
}

const GATE_BLOCKER_WORDS = Object.freeze({
  pointInTimeUniverse: '과거 시점의 종목 구성',
  delistingAndCorporateAction: '상장폐지·기업 행위 처리',
  filingAvailableDate: '공시 공개일',
  turnoverModeled: '회전율',
  transactionCostsModeled: '거래비용',
  liquidityCapacityModeled: '유동성·체결 용량',
  liveBacktestParity: '실제 순위와 검증 정의의 일치'
});
const signedPp = (value, digits = 2) => signedText(value, digits, '%p');

export function readValidationState({ metadata = null, root = null, listingMarket = 'US' } = {}) {
  const gate = root?._aioScreenerValidationGate || null;
  const gateChip = !gate ? '검증 상태 없음' : gate.status === 'BLOCKED' ? '검증 요건 미충족' : null;
  const blockers = (Array.isArray(gate?.blockers) ? gate.blockers : []).map((key) => GATE_BLOCKER_WORDS[key] || key);
  // The gate is judged from the long-run study; its date is the study's, not the day the judgement was recomputed.
  const day = (value) => (value ? String(value).slice(0, 10) : null);
  const base = { gate, gateChip, blockers, gateObservedAt: day(gate?.observedAt), gateEvidenceAt: day(gate?.evidenceGeneratedAt) };
  if (listingMarket === 'KR') {
    // A record that measured Korean rows alone carries their IC only; the spread and the win count stay pooled.
    const krIc = marketIcRows(metadata?.backtest).some((row) => row.market === 'KR');
    return { ...base, state: 'kr', chips: [gateChip, '판단 불가'].filter(Boolean), sentence: `한국 순위는 ${krIc ? '한국 종목만의 IC 기록뿐이라' : '아직 사후 검증 기록이 없어'} 판단 불가입니다 — 미국 검증을 한국 순위의 근거로 쓰지 않습니다.` };
  }
  const backtest = metadata?.backtest || null;
  const dates = Array.isArray(backtest?.rebalanceDates) ? backtest.rebalanceDates : [];
  const samples = finiteOrNull(backtest?.rebalancesCounted) ?? (dates.length || null);
  const net = finiteOrNull(backtest?.quantileSpreadNet);
  if (!backtest || samples == null || net == null) {
    return { ...base, state: 'none', chips: [gateChip, '판단 불가'].filter(Boolean), sentence: `사후 검증 기록을 받지 못해 판단 불가입니다.` };
  }
  const netRate = finiteOrNull(backtest.netHitRate);
  const rate = netRate ?? finiteOrNull(backtest.hitRate);
  const wins = rate == null ? null : Math.round(rate / 100 * samples);
  const icT = finiteOrNull(backtest.ic?.compositeT);
  const liveFingerprint = liveScreenerModelFingerprint(metadata?.ranking?.appliedFactorWeights);
  const modelMatch = backtest.modelFingerprint != null && liveFingerprint != null && backtest.modelFingerprint === liveFingerprint;
  // The ranking is one model per market, so the per-date IC shown for US rows is the US-only series when the record
  // carries it; an older record has only the series pooled over US and Korean rows, and says so.
  const marketIc = Array.isArray(backtest.icByMarket?.US?.icByDate?.composite) && Array.isArray(backtest.icByMarket.US.dates) ? backtest.icByMarket.US : null;
  const icByDate = marketIc ? marketIc.icByDate.composite : Array.isArray(backtest.icByDate?.composite) ? backtest.icByDate.composite : [];
  const icDates = marketIc ? marketIc.dates
    : Array.isArray(backtest.icCompositeDates) && backtest.icCompositeDates.length === icByDate.length ? backtest.icCompositeDates
      : icByDate.length === dates.length ? dates : [];
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
    distinguishable ? null : `표본 ${samples}회로는 우연과 구별되지 않아 판단 불가입니다.`
  ].filter(Boolean).join(' ');
  return {
    ...base,
    state: distinguishable ? (net > 0 ? 'favorable' : 'burden') : 'undecided',
    chips: [gateChip, distinguishable ? null : '판단 불가'].filter(Boolean),
    sentence,
    samples, net, wins, winsBasis: netRate != null ? '비용 후' : '비용 전', tStat, icT, distinguishable, modelMatch,
    fwdDays: finiteOrNull(backtest.fwdDays) ?? 21,
    asOf: backtest.asOf ? String(backtest.asOf).slice(0, 10) : null,
    icScope: marketIc ? '미국 종목만' : '미국·한국 합산',
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
  if (read.samples != null || read.points?.length) {
    const card = el(doc, 'div', null, 'sx-card scr-vh-dates');
    const head = el(doc, 'div', null, 'sx-card__head');
    head.append(el(doc, 'h3', '시점별 상위 20% − 하위 20%', 'sx-card__title'), el(doc, 'span', `${read.fwdDays}거래일 뒤 수익률, 같은 비중, 비용 전`, 'sx-card__meta'));
    card.append(head);
    const spread = read.spreadPoints || [];
    if (spread.length) {
      const max = signedScale(spread.map((point) => point.gross), 0.5);
      for (const point of spread) {
        const up = point.gross >= 0;
        const line = el(doc, 'div', null, 'scr-vh-row scr-vh-spread-row');
        line.title = `상위 20% 평균 ${pct(point.top)} − 하위 20% 평균 ${pct(point.bottom)} = ${signedPp(point.gross)}${point.net != null ? `, 거래비용(회전율 기준 ${point.cost != null ? `${point.cost.toFixed(2)}%` : '—'}) 반영 ${signedPp(point.net)}` : ''}`;
        const track = signedBar(doc, point.gross, max, { tone: 'verdict', digits: 2, trackClass: 'scr-vh-track' });
        const legs = el(doc, 'span', null, 'scr-vh-legs');
        legs.append(el(doc, 'span', `상위 ${pct(point.top)}`), el(doc, 'span', `하위 ${pct(point.bottom)}`));
        line.append(el(doc, 'span', point.date, 'scr-vh-date'), track, legs, el(doc, 'span', signedPp(point.gross), `scr-vh-ic ${up ? 'scr-tone-up' : 'scr-tone-burden'}`));
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
      summary.append(el(doc, 'span', '시점별 종합 IC', 'scr-vh-ic-title'), el(doc, 'span', `${read.icScope}, 순위와 ${read.fwdDays}거래일 뒤 수익률의 순위상관, 0 = 관계 없음`, 'sx-meta'));
      summary.addEventListener('click', () => { fold.dataset.userToggled = '1'; });
      fold.append(summary);
      const body = el(doc, 'div', null, 'scr-vh-ic-body');
      const maxIc = signedScale(read.points.map((point) => point.ic), 0.1);
      for (const point of read.points) {
        const line = el(doc, 'div', null, 'scr-vh-row');
        const track = signedBar(doc, point.ic, maxIc, { tone: 'verdict', digits: 3, trackClass: 'scr-vh-track' });
        line.append(el(doc, 'span', point.date, 'scr-vh-date'), track, el(doc, 'span', signedText(point.ic, 3), `scr-vh-ic ${point.ic >= 0 ? 'scr-tone-up' : 'scr-tone-burden'}`));
        body.append(line);
      }
      fold.append(body);
      card.append(fold);
    }
    parts.push(card);
  }
  if (read.gateChip) parts.push(el(doc, 'p', read.gate ? `검증 게이트 ${read.gateChip}${read.blockers.length ? ` — 아직 확인되지 않은 항목: ${read.blockers.join(', ')}` : ''}${read.gateEvidenceAt ? ` (근거 연구 ${read.gateEvidenceAt}, 현재 살아남은 대형주 표본${read.gateObservedAt ? `; 판정 ${read.gateObservedAt}` : ''})` : read.gateObservedAt ? ` (${read.gateObservedAt} 기준)` : ''}.` : '검증 게이트 파일을 받지 못했습니다 — 없음.', 'scr-vh-gate'));
  const rule = `이 화면은 ${VALIDATION_MIN_REBALANCES}회 이상·|t| ${VALIDATION_MIN_ABS_T} 이상에서 앞섬·뒤처짐을 판단합니다(학술 제안인 t 3보다 느슨한 기준).`;
  const undecided = read.samples != null && !read.distinguishable
    ? ` 표본 ${read.samples}회${read.tStat == null ? '(t 미계산)' : `(t ${read.tStat.toFixed(2)})`}로는 이 기준에 못 미쳐, 순위는 계속 후보 목록으로 표시합니다.` : '';
  const evidence = el(doc, 'div', null, 'sx-evidence scr-vh-evidence');
  evidence.append(el(doc, 'span', '근거, Grinold(1989) 기본 법칙, Harvey·Liu·Zhu(2016) …and the Cross-Section of Expected Returns'), el(doc, 'span', `데이터, 스크리너 결과 사후 검증${read.asOf ? ` ${read.asOf}` : ''}`), el(doc, 'span', `상태, ${read.chips.join(', ') || '기록 있음'}`));
  const principle = kindFold(doc, 'method', '왜 검증을 먼저 보여주나', [
    el(doc, 'p', `요인 점수의 예측력은 정보 계수(IC) — 점수 순위와 이후 수익률 순위의 상관 — 로 잽니다. 학술 연구에서도 '발견된' 요인 상당수가 데이터 마이닝의 산물일 수 있어, 새 요인에는 t 값 3 이상을 요구해야 한다는 제안이 있습니다. ${rule}${undecided}`, 'sx-disclosure__text'),
    evidence]);
  principle.classList.add('scr-vh-principle');
  parts.push(principle);
  host.replaceChildren(...parts);
  host.dataset.validationState = read.state;
}
