// P1419 (open-source comparison: xang1234 "Backtest" page validates published picks): how the
// screener's ranking has done after the fact. Source: public-data/backtest-history.json — each daily
// record re-runs six past rebalances (147 … 42 sessions ago, 21-session hold) and reports the top
// quintile minus bottom quintile forward return (net of the modelled cost) and how often the top
// quintile won. The predictive-validity status (public-data/model-validation-status.json) is shown
// with it: a present-day universe means survivorship bias, so this is accountability, not proof.
import { createTrendChart } from './trend-chart.js';
import { liveScreenerModelFingerprint } from '../../domain/screener/model-fingerprint.js';
import { el } from './dom.js';

export const VALIDATION_MIN_REBALANCES = 12;
export const VALIDATION_MIN_ABS_T = 2;

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
  const tStat = Number.isFinite(Number(last?.ic?.compositeT)) ? Number(last.ic.compositeT) : Number.isFinite(Number(last?.icT)) ? Number(last.icT) : null;
  const samples = Number.isFinite(Number(last?.dates)) ? Number(last.dates) : null;
  const distinguishable = samples != null && samples >= VALIDATION_MIN_REBALANCES && tStat != null && Math.abs(tStat) >= VALIDATION_MIN_ABS_T;
  const tone = !last || !Number.isFinite(Number(last.quantileSpreadNet)) ? 'unknown' : !distinguishable ? 'neutral' : Number(last.quantileSpreadNet) > 0 ? 'favorable' : 'burden';
  const undecided = `아직 구별 불가(표본 ${samples ?? '—'}회${tStat != null ? `, t=${tStat.toFixed(2)}` : ''})`;
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
    if (summary.series.length >= 2) host.append(createTrendChart(doc, { series: summary.series, refLines: [0], format: (value) => `${value.toFixed(1)}%`, label: '상위−하위 20% 수익률 차이(비용 반영 · 같은 모델 기록만)' }));
    else host.append(el(doc, 'p', `같은 모델로 계산된 기록이 ${summary.sameModelRecords}개뿐이라 추이 그림은 기록이 쌓인 뒤 표시합니다.`, 'theme-strength-basis'));
    host.append(el(doc, 'p', summary.distinguishable
      ? `최근 기록 ${summary.date} · 상위−하위 20% ${pct(summary.spreadNet)} — ${summary.rebalances}회 표본에서 우연의 범위(|t| ${VALIDATION_MIN_ABS_T})를 넘은 차이입니다.`
      : `최근 기록 ${summary.date} · ${summary.undecided} — 앞섬·뒤처짐 판정은 기록이 ${VALIDATION_MIN_REBALANCES}회 이상 쌓이고 차이가 우연의 범위(|t| ${VALIDATION_MIN_ABS_T})를 넘을 때 합니다.`, 'theme-strength-basis'));
  }
  host.dataset.aioScreenerValidationRenderer = 'native';
  return summary;
}
