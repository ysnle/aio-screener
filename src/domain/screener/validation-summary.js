// How the screener's ranking has done after the fact (public-data/backtest-history.json and model-validation-status.json),
// summarised for the 과거 검증 tab, the screener read and the 스크리너 AI reading's fact packet. Pure.
import { liveScreenerModelFingerprint } from './model-fingerprint.js';
import { readNumber, signedText, mean, stdev } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';

export const VALIDATION_MIN_REBALANCES = 12;
export const VALIDATION_MIN_ABS_T = 2;

// P7-UI-01: Number(null) and Number('') are 0, so a missing spread drew a flat 0% point on the curve and a
// missing rebalance entered the t statistic as a real 0. Missing stays missing: null/blank are dropped before Number().
export const finiteOrNull = readNumber;

// The colour and 판단 가능 of the top-minus-bottom spread come from the spread's own
// per-rebalance series (one-sample t of its mean), never from the composite IC t — a rank correlation can be steady while
// the return gap is carried by one date (IC t 61408 beside a spread t of 1.1).
export function meanTStat(values) {
  const xs = (Array.isArray(values) ? values : []).map(finiteOrNull).filter((x) => x != null);
  const n = xs.length;
  if (n < 2) return null;
  const sd = stdev(xs, { sample: true });
  return sd > 0 ? mean(xs) / (sd / Math.sqrt(n)) : null;
}

const pct = (value, digits = 2) => (readNumber(value) == null ? '—' : signedText(readNumber(value), digits, '%'));

export function summarizeValidation(history = [], status = null, liveWeights = null) {
  const rows = (Array.isArray(history) ? history : []).filter((row) => isIsoDay(String(row?.date || '')));
  const last = rows[rows.length - 1] || null;
  // X04: the curve joined rows of three model fingerprints (and rows with none) into one line. Only rows
  // computed by the same model as the latest record belong on it.
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
  // The one count basis for every "N회 중 M회 앞섬" (screener read, stock read, 과거 검증 tab): net of cost.
  const wins = last && finiteOrNull(last.netHitRate) != null && finiteOrNull(last.dates) != null ? Math.round(Number(last.netHitRate) / 100 * Number(last.dates)) : null;
  // Six rebalances with a composite IC t of about -0.26 were read as "뒤처졌습니다" in a burden colour.
  // A sign is a finding only with |t| >= 2 on at least 12 rebalances; otherwise the record says it cannot tell yet.
  // t is the record's own statistic when it carries one (ic.compositeT / icT); it is never estimated from the pooled n.
  const icT = finiteOrNull(last?.ic?.compositeT) ?? finiteOrNull(last?.icT);
  const spreadSeries = Array.isArray(last?.quantileSpreadNetByDate) ? last.quantileSpreadNetByDate.map(finiteOrNull).filter((x) => x != null) : [];
  const tStat = meanTStat(spreadSeries);
  const samples = finiteOrNull(last?.dates);
  const distinguishable = spreadSeries.length >= VALIDATION_MIN_REBALANCES && tStat != null && Math.abs(tStat) >= VALIDATION_MIN_ABS_T;
  const tone = !last || finiteOrNull(last.quantileSpreadNet) == null ? 'unknown' : !distinguishable ? 'neutral' : Number(last.quantileSpreadNet) > 0 ? 'favorable' : 'burden';
  const undecided = `아직 우연과 구별 안 됨(표본 ${samples ?? '—'}회${tStat != null ? `, t=${tStat.toFixed(2)}` : ''})`;
  // Stored rows must carry the model fingerprint. A mismatch — or no fingerprint at all
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
      ? '예측력 검증 미완료 · 생존 편향 · 체결 용량 미반영' // The survivorship caveat stays on the face
      : status?.status ? `검증 상태: ${status.status}` : null
  };
}
