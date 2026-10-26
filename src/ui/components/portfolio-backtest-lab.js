// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 백테스트 랩 result (#pf-backtest-output) renderer
// and its formatters moved here from js/aio-workspace.js. Markup, labels and the VaR/CVaR certification wording are
// unchanged. runPortfolioBacktestLab in js/aio-workspace.js still fetches the history, runs the engine and calls
// window._aioRenderPortfolioBacktestLab; src/app/legacy-screen-bridges.js installs it and window.varCertLabel.

function fmtPct(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(d == null ? 2 : d) + '%';
}
function fmtNum(v, d) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return Number(v).toFixed(d == null ? 2 : d);
}
// E4/P1190: 인증 문구는 실제 판정을 따른다 — '인증 보류'를 고정 라벨로 두면 인증된 표본도
// 보류로 보이고, 왜 보류인지 소비자가 알 수 없다.
const VAR_REASON_LABELS = {
  'sample-below-declared-minimum': '표본 부족',
  'tail-below-declared-minimum': '꼬리 부족',
  'bootstrap-band-exceeds-declared-maximum': '부트스트랩 변동 큼',
  'estimator-sensitivity-exceeds-declared-maximum': '추정량 민감',
  'tail-sample-single-observation': '꼬리 1개',
  'cvar-bootstrap-band-exceeds-declared-maximum': '부트스트랩 변동 큼',
  'cvar-sensitivity-exceeds-declared-maximum': '최악 1개에 민감'
};
// v57.92 E06: CVaR has its own certification (the tail mean can move while the 5% quantile holds).
function cvarCertLabel(cert) {
  const stability = cert && cert.stability;
  if (!stability || !stability.cvarCertification) return '';
  if (stability.cvarCertification === 'certified') return 'CVaR 인증';
  const reasons = Array.isArray(stability.cvarCertificationReasons) ? stability.cvarCertificationReasons : [];
  return 'CVaR 인증 보류' + (reasons.length ? ' — ' + reasons.map(function(reason) { return VAR_REASON_LABELS[reason] || reason; }).join(', ') : '');
}
export function varCertLabel(cert) {
  if (!cert || typeof cert !== 'object') return '인증 보류';
  if (cert.certification === 'certified') return '인증';
  let reasons = (cert.stability && Array.isArray(cert.stability.certificationReasons)) ? cert.stability.certificationReasons : [];
  if (!reasons.length && Array.isArray(cert.certificationReasons)) reasons = cert.certificationReasons;
  return reasons.length ? '인증 보류 — ' + reasons.map(function(reason) { return VAR_REASON_LABELS[reason] || reason; }).join(', ') : '인증 보류';
}
function fmtMoney(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + Math.round(v).toLocaleString();
}
function td(value, cls) {
  return '<td class="wsl-bt-c is-fig is-r' + (cls ? ' ' + cls : '') + '">' + value + '</td>';
}
const escapeFor = (root) => (s) => (typeof root.escHtml === 'function' ? root.escHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

// The one-line states runPortfolioBacktestLab reports before a result (no holdings, a rejected form, collecting).
export function renderPortfolioBacktestStatus(text, warn, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-backtest-output');
  if (el) el.innerHTML = `<div class="wsl-msg${warn ? ' is-warn' : ''}">${escapeFor(root)(text)}</div>`;
}

export function renderPortfolioBacktestLab(model, { documentRef = globalThis.document, root = globalThis } = {}) {
  const esc = escapeFor(root);
  const el = documentRef.getElementById('pf-backtest-output');
  if (!el) return;
  if (!model || !model.ok) {
    const reason = model && model.warnings && model.warnings.length ? model.warnings.join(', ') : '백테스트를 계산할 수 없습니다.';
    el.innerHTML = '<div class="wsl-msg is-warn">' + esc(reason) + '</div>';
    return;
  }
  const p = model.performance || {};
  const tone = (v) => (v < 0 ? 'is-down' : 'is-up');
  const metricRows = [
    ['Start Balance', fmtMoney(p.startBalance), fmtMoney(p.startBalance)],
    ['End Balance', fmtMoney(p.endBalance), fmtMoney(p.benchmarkEndBalance)],
    ['CAGR', fmtPct(p.cagr), fmtPct(p.benchmarkCagr)],
    ['Stdev', fmtPct(p.stdev), fmtPct(p.benchmarkStdev)],
    ['Best Year', fmtPct(p.bestYear), '—'],
    ['Worst Year', fmtPct(p.worstYear), '—'],
    ['Max Drawdown', fmtPct(-p.maxDrawdown), '—'],
    ['Sharpe / Sortino', fmtNum(p.sharpe) + ' / ' + fmtNum(p.sortino), '—'],
    ['Active / Tracking Error / IR', fmtPct(p.activeReturn) + ' / ' + fmtPct(p.trackingError) + ' / ' + fmtNum(p.informationRatio), '—'],
    ['Beta / Alpha / Corr', fmtNum(p.beta) + ' / ' + fmtPct(p.alpha) + ' / ' + fmtNum(p.benchmarkCorrelation), '—'],
    ['VaR / CVaR 5% monthly' + (p.varCertification ? ' (표본 ' + p.varCertification.sampleN + '·꼬리 ' + p.varCertification.tailN + ', VaR ' + varCertLabel(p.varCertification) + (cvarCertLabel(p.varCertification) ? ', ' + cvarCertLabel(p.varCertification) : '') + ')' : ''), fmtPct(-p.historicalVar5) + ' / ' + fmtPct(-p.conditionalVar5), '—'],
    ['Up / Down Capture', fmtPct(p.upsideCapture) + ' / ' + fmtPct(p.downsideCapture), '—']
  ];
  const metricHtml = metricRows.map(function(r) {
    return '<tr><td class="wsl-bt-c is-dim">' + esc(r[0]) + '</td>' +
      td(r[1]) + td(r[2]) + '</tr>';
  }).join('');
  const annualHtml = (model.annualRows || []).slice(-12).reverse().map(function(r) {
    return '<tr><td class="wsl-bt-c is-fig">' + esc(r.year) + '</td>' +
      td(fmtPct(r.return), tone(r.return)) +
      td(fmtMoney(r.balance)) +
      td(fmtPct(r.benchmarkReturn), tone(r.benchmarkReturn)) +
      td(fmtMoney(r.benchmarkBalance)) + '</tr>';
  }).join('');
  const ddHtml = (model.drawdowns || []).slice(0, 6).map(function(d, i) {
    return '<tr><td class="wsl-bt-c is-ctr">' + (i + 1) + '</td>' +
      '<td class="wsl-bt-c is-fig">' + esc(d.start || '—') + '</td>' +
      '<td class="wsl-bt-c is-fig">' + esc(d.end || '—') + '</td>' +
      '<td class="wsl-bt-c is-fig">' + esc(d.recoveryBy || '—') + '</td>' +
      td(d.recoveryMonths == null ? '—' : d.recoveryMonths + 'm') +
      td(d.underwaterMonths == null ? '—' : d.underwaterMonths + 'm') +
      td(fmtPct(-d.drawdown), 'is-dd') + '</tr>';
  }).join('');
  const compHtml = (model.components || []).slice(0, 8).map(function(c) {
    return '<tr><td class="wsl-bt-c is-fig is-heavy">' + esc(c.ticker) + '</td>' +
      td(fmtPct(c.weight, 1)) +
      td(fmtPct(c.standaloneReturn)) +
      td(fmtMoney(c.returnContribution)) +
      td(c.riskContribution == null ? '—' : fmtPct(c.riskContribution, 1)) + '</tr>';
  }).join('');
  el.innerHTML =
    '<div class="wsl-bt-head">' +
      '<div class="wsl-note">기간 <b class="wsl-strong is-fig">' + esc(model.settings.startMonth) + ' ~ ' + esc(model.settings.endMonth) + '</b>, ' +
      '리밸런싱 <b class="wsl-strong">' + esc(model.settings.rebalanceType) + '</b>, 벤치마크 <b class="wsl-strong is-fig">' + esc(model.settings.benchmarkSymbol) + '</b><br>' +
      '조정주가, 지금 구성 그대로, 배분 기준 ' + esc(model.settings.targetWeightBasis || '—') + ', 거래비용 미모형, RF ' + (model.settings.rfAnnual == null ? '미입력' : fmtPct(model.settings.rfAnnual, 2)) + '</div>' +
      '<span class="aio-source-badge is-delayed">REFERENCE-ONLY, delayed monthly backtest</span>' +
    '</div>' +
    '<div class="wsl-bt-kpis">' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">CAGR</div><div class="wsl-bt-kpi-v ' + (p.cagr >= p.benchmarkCagr ? 'is-ahead' : 'is-behind') + '">' + fmtPct(p.cagr) + '</div><div class="wsl-sub">bench ' + fmtPct(p.benchmarkCagr) + '</div></div>' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">Max Drawdown</div><div class="wsl-bt-kpi-v is-loss">' + fmtPct(-p.maxDrawdown) + '</div><div class="wsl-sub">worst underwater path</div></div>' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">Sharpe / Sortino</div><div class="wsl-bt-kpi-v is-plain">' + fmtNum(p.sharpe) + ' / ' + fmtNum(p.sortino) + '</div><div class="wsl-sub">RF ' + fmtPct(model.settings.rfAnnual, 1) + '</div></div>' +
      '<div class="wsl-bt-kpi"><div class="wsl-bt-kpi-l">Active / IR</div><div class="wsl-bt-kpi-v ' + (p.activeReturn >= 0 ? 'is-up' : 'is-loss') + '">' + fmtPct(p.activeReturn) + ' / ' + fmtNum(p.informationRatio) + '</div><div class="wsl-sub">tracking error ' + fmtPct(p.trackingError) + '</div></div>' +
    '</div>' +
    '<div class="wsl-bt-tables">' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">Performance Summary</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow"><th class="wsl-bt-c is-l">Metric</th><th class="wsl-bt-c is-r">Portfolio</th><th class="wsl-bt-c is-r">Benchmark</th></tr></thead><tbody>' + metricHtml + '</tbody></table></div>' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">Annual Returns</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow"><th class="wsl-bt-c is-l">Year</th><th class="wsl-bt-c is-r">Return</th><th class="wsl-bt-c is-r">Balance</th><th class="wsl-bt-c is-r">Bench</th><th class="wsl-bt-c is-r">Bench Bal</th></tr></thead><tbody>' + annualHtml + '</tbody></table></div>' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">Worst Drawdowns</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow"><th class="wsl-bt-c">#</th><th class="wsl-bt-c is-l">Start</th><th class="wsl-bt-c is-l">Trough</th><th class="wsl-bt-c is-l">Recovery</th><th class="wsl-bt-c is-r">Recover</th><th class="wsl-bt-c is-r">Underwater</th><th class="wsl-bt-c is-r">DD</th></tr></thead><tbody>' + ddHtml + '</tbody></table></div>' +
      '<div class="wsl-bt-scroll"><div class="wsl-head">Return / Risk Attribution</div><table class="wsl-bt-tbl"><thead><tr class="wsl-bt-hrow"><th class="wsl-bt-c is-l">Ticker</th><th class="wsl-bt-c is-r">Weight</th><th class="wsl-bt-c is-r">Standalone</th><th class="wsl-bt-c is-r">Return $</th><th class="wsl-bt-c is-r">Risk</th></tr></thead><tbody>' + compHtml + '</tbody></table></div>' +
    '</div>' +
    '<div class="wsl-bt-warn">' + model.warnings.map(esc).join(', ') + '</div>';
}

