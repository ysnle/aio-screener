// P1419 (open-source comparison: xang1234 "Backtest" page validates published picks): how the
// screener's ranking has done after the fact. Source: public-data/backtest-history.json — each daily
// record re-runs six past rebalances (147 … 42 sessions ago, 21-session hold) and reports the top
// quintile minus bottom quintile forward return (net of the modelled cost) and how often the top
// quintile won. The predictive-validity status (public-data/model-validation-status.json) is shown
// with it: a present-day universe means survivorship bias, so this is accountability, not proof.
import { createTrendChart } from './trend-chart.js';
import { liveScreenerModelFingerprint } from '../../domain/screener/model-fingerprint.js';

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const pct = (value, digits = 2) => (value == null || !Number.isFinite(Number(value)) ? '—' : `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(digits)}%`);

export function summarizeValidation(history = [], status = null, liveWeights = null) {
  const rows = (Array.isArray(history) ? history : []).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')));
  const last = rows[rows.length - 1] || null;
  const series = rows.filter((row) => Number.isFinite(Number(row.quantileSpreadNet))).map((row) => ({ date: row.date, value: Number(row.quantileSpreadNet) }));
  const wins = last && Number.isFinite(Number(last.netHitRate)) && Number.isFinite(Number(last.dates)) ? Math.round(Number(last.netHitRate) / 100 * Number(last.dates)) : null;
  const tone = !last || !Number.isFinite(Number(last.quantileSpreadNet)) ? 'unknown' : Number(last.quantileSpreadNet) > 0 ? 'favorable' : 'burden';
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
    ic: last?.ic?.composite ?? null,
    series,
    modelMatch,
    tone,
    verdict: !last ? '사후 검증 기록 수신 대기'
      : !modelMatch ? `이 과거 기록은 지금 화면의 순위와 가중치·정의(모델 지문)가 다른 이전 모델로 계산되어, 지금 순위의 검증으로 읽지 않습니다. 같은 모델의 기록이 쌓인 뒤 이 영역이 다시 성과를 말합니다.`
      : tone === 'favorable' ? `최근 ${last.dates}번의 과거 시점에서 기본 복합 순위 상위 20%가 하위 20%보다 평균 ${pct(last.quantileSpreadNet)} 앞섰습니다(비용 반영). 표본이 작고 생존 편향이 있어 예측 우위의 증명은 아닙니다.`
        : `지금까지 이 순위의 예측 우위는 확인되지 않았습니다. 최근 ${last.dates}번의 과거 시점에서 상위 20%가 하위 20%보다 평균 ${pct(last.quantileSpreadNet)} — 기본 복합 순위(모멘텀·추세·저변동·칼만)는 이 기간 동안 뒤처졌습니다(비용 반영).`,
    validation: status?.status === 'BLOCKED' || status?.predictiveValidation === 'not-established'
      ? '예측력 검증 미완료 — 지금의 종목 구성으로 과거를 본 결과라 사라진 종목이 빠진 생존 편향이 있고, 거래량·체결 용량은 반영하지 않았습니다. 순위는 상대 비교용입니다.'
      : status?.status ? `검증 상태: ${status.status}` : null
  };
}

export function renderScreenerValidation({ documentRef: doc, root }) {
  const host = doc?.getElementById('screener-validation');
  if (!host) return null;
  const summary = summarizeValidation(root?._aioScreenerBacktestHistory || [], root?._aioModelValidationStatus || null, root?._aioRankingWeights || null);
  const open = host.querySelector('details')?.open || false;
  host.replaceChildren();
  const details = el(doc, 'details', null, 'screener-validation-details');
  details.open = open;
  const head = el(doc, 'summary', null, 'screener-validation-summary');
  head.append(el(doc, 'span', '순위 사후 검증', 'screener-validation-title'), el(doc, 'span', summary.available ? `상위−하위 20% ${pct(summary.spreadNet)} · ${summary.wins ?? '—'}/${summary.rebalances ?? '—'}회 앞섬` : '기록 수신 대기', `regime-state is-${summary.tone}`));
  details.append(head);
  details.append(el(doc, 'p', summary.verdict, 'pf-check-detail'));
  if (summary.available) {
    details.append(el(doc, 'p', `${summary.date} 계산 · ${summary.stocks}종목 · 과거 ${summary.rebalances}번 시점(147~42거래일 전)에서 순위를 매기고 21거래일 보유 · 거래비용 ${pct(summary.costPct)} 반영 · 순위-수익 상관(IC) ${summary.ic == null ? '—' : Number(summary.ic).toFixed(3)}`, 'theme-strength-basis'));
    details.append(createTrendChart(doc, { series: summary.series, refLines: [0], format: (value) => `${value.toFixed(1)}%`, label: '상위−하위 20% 수익률 차이(비용 반영)' }));
  }
  if (summary.validation) details.append(el(doc, 'p', summary.validation, 'theme-strength-basis'));
  host.append(details);
  host.dataset.aioScreenerValidationRenderer = 'native';
  return summary;
}
