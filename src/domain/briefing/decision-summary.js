// P1346/QA-UX-11: reference-only briefing. Missing close evidence holds each axis.
import { describeCloseBasis, selectCloseBasisObservation } from '../signal/close-basis.js';
import { isNewsAnalysisEligible } from '../news/scoring.js';
import { latestCompletedKrSession } from '../../ai/time/market-session.js';
import { sessionDateInMarket, isValidMarketDate } from '../market/session-time.js';
import { selectReferenceObservation } from '../market/reference-observation.js';

const AXES = Object.freeze([
  { id: 'market', title: '시장 · 심리', keys: ['spxPrice', 'vix', 'fg'], check: '지수·변동성·심리의 방향 대조', pattern: /S&P|VIX|시장|증시/i },
  { id: 'rates', title: '금리 · 달러', keys: ['tnx', 'dxy'], check: '금리 민감주 노출 확인', pattern: /금리|달러|국채|yield|dollar/i },
  { id: 'oil', title: '유가', keys: ['oilPrice'], check: '유가와 물가·금리 반응 확인', pattern: /유가|원유|oil|crude/i },
  { id: 'yen', title: '엔화 · BOJ', keys: ['usdJpy'], check: '엔화와 BOJ 발표 내용 확인', pattern: /엔화|일본은행|BOJ|yen|USD.?JPY/i },
  { id: 'ai', title: 'AI · 반도체', keys: ['nvda', 'smh'], check: '반도체 가격과 기사 근거 대조', pattern: /\bNVDA\b|\bNVIDIA\b|반도체|\bSOX(?:X)?\b|\bSMH\b|semiconductor|\bAI\b/i },
  { id: 'korea', title: '한국 · 수급', keys: ['kospi'], check: '코스피·환율과 외국인 수급 대조', pattern: /코스피|KOSPI|외국인|기관.*수급|순매수|순매도/i }
]);
const LABELS = Object.freeze({ spxPrice: 'S&P 500', vix: 'VIX', fg: 'F&G', tnx: '미 10년물', dxy: 'DXY',
  oilPrice: 'WTI', usdJpy: 'USD/JPY', nvda: 'NVDA', smh: 'SMH (반도체 ETF)', kospi: 'KOSPI' });

export function buildBriefingDecisionSummary({ scoreInputs = {}, observations = {}, items = [], nowMs = Date.now() } = {}) {
  const basis = scoreInputs.closeBasis || null;
  const evidence = { ...(scoreInputs.decisionEvidence || {}) };
  for (const key of ['usdJpy', 'nvda', 'smh']) {
    evidence[key] = selectCloseBasisObservation({ key: 'spxPrice', candidates: Array.isArray(observations[key]) ? observations[key] : [observations[key]], basis, nowMs });
  }
  // Korea uses its own labelled regular close. The index never implies foreign flows.
  const krBasis = latestCompletedKrSession(nowMs);
  const kr = (Array.isArray(observations.kospi) ? observations.kospi : [observations.kospi]).find((row) => {
    const value = ['number', 'string'].includes(typeof row?.value) && String(row.value).trim() ? Number(row.value) : null;
    if (!krBasis || value == null || !Number.isFinite(value) || value <= 0
      || !['MARKET_CLOSED', 'CLOSED_CURRENT', 'COMPLETED', 'CLOSED'].includes(row.session || row.marketState)) return false;
    const completed = ['latest-completed-close', 'regular-session-close'].includes(row.valueBasis);
    if (isValidMarketDate(row.observedAt)) return completed && row.observedAt === krBasis.date;
    const time = Date.parse(row?.observedAt || '');
    return (completed || row.valueBasis === 'provider-current-value')
      && sessionDateInMarket(row.observedAt, 'KR') === krBasis.date
      && time >= krBasis.closeMs && time <= nowMs;
  });
  evidence.kospi = kr ? { ...kr, value: Number(kr.value), status: 'session_close', allowedUse: 'close-basis', asOf: krBasis.date } : null;
  // P1357: US close is the score basis, not a universal clock for FX, oil or Korea.
  // A current delayed observation remains informative and explicitly reference-only.
  for (const key of ['tnx', 'dxy', 'oilPrice', 'usdJpy', 'nvda', 'smh', 'kospi']) {
    const current = selectReferenceObservation(observations[key], { nowMs });
    if (current && (!['close-basis', 'reference'].includes(evidence[key]?.allowedUse) || Date.parse(current.observedAt) > Date.parse(evidence[key].observedAt || ''))) evidence[key] = current;
  }
  const basisLabel = describeCloseBasis(basis) || '종가 기준 미확보';
  const axes = AXES.map((axis) => {
    const values = axis.keys.map((key) => {
      const row = evidence[key];
      const value = ['number', 'string'].includes(typeof row?.value) && String(row.value).trim() ? Number(row.value) : null;
      const usable = (row?.allowedUse === 'close-basis' && row?.status === 'session_close' || row?.allowedUse === 'reference' && row?.status === 'reference_observation') && value != null && Number.isFinite(value);
      return Object.freeze({ key, label: LABELS[key], value: usable ? value : null,
        observedAt: usable ? row.observedAt || null : null, asOf: usable ? row.asOf || basis?.date : null, basisLabel: usable ? row.basisLabel || null : null });
    });
    const missing = values.filter((row) => row.value == null).map((row) => row.label);
    const related = items.filter((item) => axis.pattern.test(`${item?.title || ''} ${item?.summary || ''}`));
    const analyzable = related.filter(isNewsAnalysisEligible).length;
    let tone = missing.length ? 'held' : 'observed';
    let label = missing.length ? '보류' : '참고 관찰';
    if (!missing.length && axis.id === 'market' && (Number(evidence.vix.value) >= 25 || Number(evidence.fg.value) <= 25)) {
      tone = 'caution'; label = '변동성·심리 주의';
    }
    return Object.freeze({ id: axis.id, title: axis.title, tone, label, values: Object.freeze(values), missing: Object.freeze(missing),
      basisLabel: values.some((row) => row.basisLabel) ? '각 값의 관측 시각·시장 세션 기준 · 종가 점수와 분리' : axis.id === 'korea' ? `${krBasis?.date || '미확보'} 한국 정규장 종가 기준${kr ? '' : ' · 관측 미확보'}` : basisLabel,
      newsLabel: related.length ? `키워드 관련 기사 ${related.length}건 · 분석 가능 자료 ${analyzable}건` : '관련 기사 미확보', check: axis.check });
  });
  return Object.freeze({ modelVersion: 'briefing-decision-summary.v1', status: 'reference-only', decisionEligible: false,
    basisLabel, axes: Object.freeze(axes), checks: Object.freeze(axes.map((axis) => axis.check)) });
}
