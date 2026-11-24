// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 백테스트 랩 result (#pf-backtest-output) renderer
// and its formatters moved here from js/aio-workspace.js. The rendered words are Korean, mapped here.
// runPortfolioBacktestLab in js/aio-workspace.js still fetches the history, runs the engine and calls
// window._aioRenderPortfolioBacktestLab; src/app/legacy-screen-bridges.js installs it and window.varCertLabel.
import { escapeHtml as esc } from '../html.js';
import { signedText, directionOf } from '../../domain/shared/number.js';

// The shared sign rule: a value that rounds to zero prints no sign.
const fmtPct = (v, d) => (typeof v === 'number' && isFinite(v) ? signedText(v * 100, d == null ? 2 : d, '%') : '—');
// The active-return colour follows the sign fmtPct prints (2 decimals of a percent).
const activeClass = (v) => ({ up: 'is-up', down: 'is-loss' })[directionOf(typeof v === 'number' ? v * 100 : null, 2)] || 'is-plain';
function fmtNum(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return Number(v).toFixed(d == null ? 2 : d);
}
// The label follows the actual check, so a stable estimate reads 확정 and an unstable one says why in the
// reader's words (what is short) and what makes it stable; the check's codes stay in the model (varCertification).
const VAR_REASON_LABELS = {
  'sample-below-declared-minimum': '기간이 짧음',
  'tail-below-declared-minimum': '하위 5% 달이 적음',
  'bootstrap-band-exceeds-declared-maximum': '표본에 따라 크게 흔들림',
  'estimator-sensitivity-exceeds-declared-maximum': '계산 방식에 따라 크게 달라짐',
  'tail-sample-single-observation': '하위 5% 달이 1개뿐',
  'cvar-bootstrap-band-exceeds-declared-maximum': '표본에 따라 크게 흔들림',
  'cvar-sensitivity-exceeds-declared-maximum': '가장 나쁜 한 달에 좌우됨'
};
const reasonWords = (reasons) => [...new Set(reasons.map(function(reason) { return VAR_REASON_LABELS[reason] || '값이 안정되지 않음'; }))].join(', ');
// What makes the estimate stable: a longer period (an earlier start month), with the month count the check asks for.
const steadyHint = (cert) => {
  const min = cert && cert.stability && cert.stability.thresholds && cert.stability.thresholds.minSampleN;
  return '시작 달을 앞당겨 기간을 늘리면' + (min ? ' (' + min + '개월 이상)' : '') + ' 확정값이 됩니다';
};
export function varCertLabel(cert) {
  if (!cert || typeof cert !== 'object') return '참고값 — 계산 근거가 없음';
  if (cert.certification === 'certified') return '확정';
  let reasons = (cert.stability && Array.isArray(cert.stability.certificationReasons)) ? cert.stability.certificationReasons : [];
  if (!reasons.length && Array.isArray(cert.certificationReasons)) reasons = cert.certificationReasons;
  return '참고값 — ' + (reasons.length ? reasonWords(reasons) : '값이 안정되지 않음') + ', ' + steadyHint(cert);
}
function fmtMoney(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + Math.round(v).toLocaleString();
}
function td(value, cls) {
  return '<td class="wsl-bt-c is-fig is-r' + (cls ? ' ' + cls : '') + '">' + value + '</td>';
}

// The one-line states runPortfolioBacktestLab reports before a result (no holdings, a rejected form, collecting).
export function renderPortfolioBacktestStatus(text, warn, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-backtest-output');
  if (el) el.innerHTML = `<div class="wsl-msg${warn ? ' is-warn' : ''}">${esc(text)}</div>`;
}

// The model keeps its enums (rebalanceType, targetWeightBasis, 'Unrecovered'); the reader sees Korean words.
const REBALANCE_LABEL = Object.freeze({ annual: '매년', quarterly: '분기마다', monthly: '매달', none: '안 함' });
// Quantities that cannot be negative print without a sign (표준편차, 추적오차, 비중, 추종률).
const fmtPlainPct = (v, d) => (typeof v === 'number' && isFinite(v) ? (v * 100).toFixed(d == null ? 2 : d) + '%' : '—');
// The model's sentences end in their own period; joining them with ', ' printed '…다., …'.
const sentences = (lines) => (Array.isArray(lines) ? lines : []).filter(Boolean).map((line) => String(line).trim()).join(' ');
// The start weights differ from today's when they are the current quantities priced at the start month, so they are said.
export function startWeightsLine(model) {
  const weights = model && model.weights && typeof model.weights === 'object' ? model.weights : {};
  const parts = Object.keys(weights).filter((t) => typeof weights[t] === 'number' && isFinite(weights[t]))
    .sort((a, b) => weights[b] - weights[a]).map((t) => t + ' ' + Math.round(weights[t] * 100) + '%');
  if (!parts.length) return '';
  const settings = (model && model.settings) || {};
  const basis = settings.targetWeightBasis === 'explicit-target-weight' ? '입력한 목표 비중'
    : '지금 보유 수량을 ' + (settings.startMonth || '시작 달') + ' 가격으로 평가';
  return '시작 비중: ' + parts.join(', ') + ' — ' + basis;
}
// A stable estimate adds no word; an unstable one says which (VaR or CVaR) is a reference value, why, and what makes it
// stable, once for the row.
function varRowLabel(cert) {
  if (!cert) return '월 VaR / CVaR 5%';
  const varHeld = cert.certification !== 'certified';
  const cvarHeld = !!cert.cvarCertification && cert.cvarCertification !== 'certified';
  let reasons = varHeld ? ((cert.stability && cert.stability.certificationReasons) || cert.certificationReasons || []) : [];
  if (cvarHeld) reasons = reasons.concat(cert.cvarCertificationReasons || []);
  const which = varHeld && cvarHeld ? 'VaR·CVaR' : varHeld ? 'VaR' : cvarHeld ? 'CVaR' : '';
  return '월 VaR / CVaR 5% (' + cert.sampleN + '개월 중 하위 ' + cert.tailN + '개월' + (which ? ', ' + which + ' 참고값: ' + (reasons.length ? reasonWords(reasons) : '값이 안정되지 않음') + ', ' + steadyHint(cert) : '') + ')';
}

export function renderPortfolioBacktestLab(model, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-backtest-output');
  if (!el) return;
  if (!model || !model.ok) {
    const reason = model && model.warnings && model.warnings.length ? sentences(model.warnings) : '백테스트를 계산할 수 없습니다.';
    el.innerHTML = '<div class="wsl-msg is-warn">' + esc(reason) + '</div>';
    return;
  }
  const p = model.performance || {};
  const settings = model.settings || {};
  // The annual return colour follows the sign fmtPct prints (2 decimals of a percent); 0.00% has no colour.
  const tone = (v) => ({ up: 'is-up', down: 'is-down' })[directionOf(typeof v === 'number' ? v * 100 : null, 2)] || '';
  const metricRows = [
    ['시작 금액', fmtMoney(p.startBalance), fmtMoney(p.startBalance)],
    ['끝 금액', fmtMoney(p.endBalance), fmtMoney(p.benchmarkEndBalance)],
    ['연평균 수익률', fmtPct(p.cagr), fmtPct(p.benchmarkCagr)],
    ['연 표준편차', fmtPlainPct(p.stdev), fmtPlainPct(p.benchmarkStdev)],
    ['최고 연도', fmtPct(p.bestYear), fmtPct(p.benchmarkBestYear)],
    ['최저 연도', fmtPct(p.worstYear), fmtPct(p.benchmarkWorstYear)],
    ['최대 낙폭', fmtPct(-p.maxDrawdown), typeof p.benchmarkMaxDrawdown === 'number' ? fmtPct(-p.benchmarkMaxDrawdown) : '—'],
    ['샤프 / 소르티노', fmtNum(p.sharpe) + ' / ' + fmtNum(p.sortino), '—'],
    ['초과 수익 / 추적오차 / 정보비율', fmtPct(p.activeReturn) + ' / ' + fmtPlainPct(p.trackingError) + ' / ' + fmtNum(p.informationRatio), '—'],
    ['베타 / 알파 / 상관', fmtNum(p.beta) + ' / ' + fmtPct(p.alpha) + ' / ' + fmtNum(p.benchmarkCorrelation), '—'],
    [varRowLabel(p.varCertification), fmtPct(-p.historicalVar5) + ' / ' + fmtPct(-p.conditionalVar5), '—'],
    ['상승장 / 하락장 추종률', fmtPlainPct(p.upsideCapture) + ' / ' + fmtPlainPct(p.downsideCapture), '—']
  ];
  const metricHtml = metricRows.map(function(r) {
    return '<tr><td class="wsl-bt-c is-dim">' + esc(r[0]) + '</td>' +
      td(r[1]) + td(r[2]) + '</tr>';
  }).join('');
  const annualHtml = (model.annualRows || []).slice(-12).reverse().map(function(r) {
    return '<tr><td class="wsl-bt-c is-fig">' + esc(r.label || r.year) + '</td>' +
      td(fmtPct(r.return), tone(r.return)) +
      td(fmtMoney(r.balance)) +
      td(fmtPct(r.benchmarkReturn), tone(r.benchmarkReturn)) +
      td(fmtMoney(r.benchmarkBalance)) + '</tr>';
  }).join('');
  const ddHtml = (model.drawdowns || []).slice(0, 6).map(function(d, i) {
    return '<tr><td class="wsl-bt-c is-ctr">' + (i + 1) + '</td>' +
      '<td class="wsl-bt-c is-fig">' + esc(d.start || '—') + '</td>' +
      '<td class="wsl-bt-c is-fig">' + esc(d.end || '—') + '</td>' +
      '<td class="wsl-bt-c is-fig">' + esc(d.recoveryBy === 'Unrecovered' ? '미회복' : d.recoveryBy || '—') + '</td>' +
      td(d.recoveryMonths == null ? '—' : d.recoveryMonths + '개월') +
      td(d.underwaterMonths == null ? '—' : d.underwaterMonths + '개월') +
      td(fmtPct(-d.drawdown), 'is-dd') + '</tr>';
  }).join('');
  const compHtml = (model.components || []).slice(0, 8).map(function(c) {
    return '<tr><td class="wsl-bt-c is-fig is-heavy">' + esc(c.ticker) + '</td>' +
      td(fmtPlainPct(c.weight, 1)) +
      td(fmtPct(c.standaloneReturn)) +
      td(fmtMoney(c.returnContribution)) +
      td(c.riskContribution == null ? '—' : fmtPct(c.riskContribution, 1)) + '</tr>';
  }).join('');
  const rf = settings.rfAnnual == null ? '무위험 수익률 미입력' : '무위험 수익률 연 ' + fmtPlainPct(settings.rfAnnual, 2);
  const weightsLine = startWeightsLine(model);
  const th = (text, cls) => '<th class="wsl-bt-c' + (cls ? ' ' + cls : '') + '">' + text + '</th>';
  el.innerHTML =
    '<div class="wsl-bt-head">' +
      '<div class="wsl-note">기간 <b class="wsl-strong is-fig">' + esc(settings.startMonth) + ' ~ ' + esc(settings.endMonth) + '</b>, ' +
      '리밸런싱 <b class="wsl-strong">' + esc(REBALANCE_LABEL[settings.rebalanceType] || settings.rebalanceType) + '</b>, 비교 지수 <b class="wsl-strong is-fig">' + esc(settings.benchmarkSymbol) + '</b><br>' +
      '월말 수정 종가, 거래비용 미반영, ' + esc(rf) + (weightsLine ? '<br>' + esc(weightsLine) : '') + '</div>' +
      '<span class="aio-source-badge is-delayed">참고용, 월말 기준</span>' +
    '</div>' +
    '<div class="wsl-bt-kpis">' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">연평균 수익률</div><div class="wsl-bt-kpi-v ' + (p.cagr >= p.benchmarkCagr ? 'is-ahead' : 'is-behind') + '">' + fmtPct(p.cagr) + '</div><div class="wsl-sub">비교 지수 ' + fmtPct(p.benchmarkCagr) + '</div></div>' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">최대 낙폭</div><div class="wsl-bt-kpi-v is-loss">' + fmtPct(-p.maxDrawdown) + '</div><div class="wsl-sub">비교 지수 ' + (typeof p.benchmarkMaxDrawdown === 'number' ? fmtPct(-p.benchmarkMaxDrawdown) : '—') + '</div></div>' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">샤프 / 소르티노</div><div class="wsl-bt-kpi-v is-plain">' + fmtNum(p.sharpe) + ' / ' + fmtNum(p.sortino) + '</div><div class="wsl-sub">' + esc(rf) + '</div></div>' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">초과 수익 / 정보비율</div><div class="wsl-bt-kpi-v ' + activeClass(p.activeReturn) + '">' + fmtPct(p.activeReturn) + ' / ' + fmtNum(p.informationRatio) + '</div><div class="wsl-sub">추적오차 ' + fmtPlainPct(p.trackingError) + '</div></div>' +
    '</div>' +
    '<div class="wsl-bt-tables">' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">성과 요약</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow">' + th('항목', 'is-l') + th('내 포트폴리오', 'is-r') + th('비교 지수', 'is-r') + '</tr></thead><tbody>' + metricHtml + '</tbody></table></div>' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">연도별 수익률</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow">' + th('연도', 'is-l') + th('수익률', 'is-r') + th('잔액', 'is-r') + th('비교 지수', 'is-r') + th('지수 잔액', 'is-r') + '</tr></thead><tbody>' + annualHtml + '</tbody></table></div>' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">큰 낙폭</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow">' + th('#') + th('고점', 'is-l') + th('저점', 'is-l') + th('회복', 'is-l') + th('회복 기간', 'is-r') + th('물려 있던 기간', 'is-r') + th('낙폭', 'is-r') + '</tr></thead><tbody>' + ddHtml + '</tbody></table></div>' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">종목별 수익·위험 기여</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow">' + th('종목', 'is-l') + th('시작 비중', 'is-r') + th('종목 수익률', 'is-r') + th('수익 기여 $', 'is-r') + th('위험 기여', 'is-r') + '</tr></thead><tbody>' + compHtml + '</tbody></table></div>' +
    '</div>' +
    '<div class="wsl-bt-warn">' + esc(sentences(model.warnings)) + '</div>';
}
