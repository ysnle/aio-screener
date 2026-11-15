// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 리스크 지표 panel (#pf-risk-metrics: scope
// declaration, VaR 95/99·Sharpe·MDD tiles, correlation matrix, notes) and its hold/status lines moved here from
// js/aio-workspace.js (_renderRiskMetrics and the refreshPortfolioRisk writers). Texts and the scope rules (22:PFR02/
// PFR09, P1188, P1197, P1449) are unchanged. refreshPortfolioRisk still fetches the history and assembles the estimate;
// it reports through window._aioRenderPortfolioRiskStatus / _aioRenderPortfolioRiskMetrics (src/app/legacy-screen-bridges.js).
// The figures are src/domain/portfolio/risk-readout.js: the shell hands over the estimate and the return series, this
// module renders the read-out and returns it (the exposure panel reads its correlation matrix).
import { escapeHtml } from '../html.js';
import { buildRiskReadout } from '../../domain/portfolio/risk-readout.js';
import { shortDate } from '../../domain/content/date-labels.js';


// One status line (no holdings, requesting, or a hold reason). Returns false when the panel is absent.
export function renderPortfolioRiskStatus(text, warn, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-risk-metrics');
  if (!el) return false;
  el.innerHTML = `<div class="wsl-msg${warn ? ' is-warn' : ''}">${escapeHtml(text)}</div>`;
  return true;
}

export function renderPortfolioRiskMetrics(data, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-risk-metrics');
  if (!el) return;
  const _escHtmlSafe = escapeHtml;
  let est = data.estimate || null;
  let rfAnnual = data.rfAnnual != null ? data.rfAnnual : null;
  const readout = buildRiskReadout({ estimate: est, snapshot: data.snapshot, returnsMap: data.returnsMap, rfAnnual });
  let var95 = readout.var95, var99 = readout.var99, sharpe = readout.sharpe,
      mddRes = readout.mddRes, corrRes = readout.corr, n = readout.n;
  // A book that holds Korean and US listings is measured on 5-session returns (risk-readout.js); the labels follow.
  const weekly = readout.sessions > 1;
  const days = readout.dailyN;
  const span = weekly ? readout.sessions + '거래일' : '1일';
  const obs = weekly ? readout.sessions + '거래일 수익률 ' + n + '개' : n + '일';
  const perDay = function(v) { return v == null ? '' : ', 1일 환산 약 ' + fmtLoss(v / Math.sqrt(readout.sessions)); };
  // 22:PFR02/PFR09 (E4): every number on this panel belongs to a declared
  // scope. The title carries the denominator so a sleeve figure can never read
  // as account risk, and the declaration block states path/cash/RF/snapshot.
  let scopeToken = est ? est.publishedScope : null;
  let scopeLabel = scopeToken === 'whole_account' ? '계좌 전체' : scopeToken === 'invested_sleeve' ? '주식 부분' : null;
  let scopeSuffix = scopeLabel ? ', ' + scopeLabel : '';

  function fmtLoss(v) { return (v !== null && v !== undefined) ? '-' + (v * 100).toFixed(2) + '%' : '—'; } // v50.22: null일 때 "-—" 대신 "—"
  function fmtN(v, d) { return (v !== null && v !== undefined) ? v.toFixed(d !== undefined ? d : 2) : '—'; }
  // #17: Sharpe and MDD carry no 우수/양호/위험 grade — the value and its sample period only.
  function plainTone(v) { return v === null || v === undefined ? 'is-muted' : 'is-plain'; }

  // 선언 블록 — 측정 경로/분모/RF/표본/snapshot. 실제 계좌 성과(TWR/MWR)는 P1449부터
  // pf-ledger-performance 요약으로 분리됐다(시세 이력 게이트와 무관).
  let declLines = [];
  let declCodes = null;
  if (est) {
    // #16: one Korean line on screen; the internal codes (path/scope/lineage/snapshot) go to the folded detail below.
    let declParts = [est.exposureHistoryMode === 'current_composition_retrospective' ? '현재 구성을 표본 기간에 그대로 적용한 소급 계산' : est.exposureHistoryMode === 'fixed_target_weight_strategy' ? '목표 비중 유지 전략' : '실제 계좌 이력', '분모 ' + (scopeLabel || '—'), 'RF ' + (est.rf && est.rf.status === 'accepted' ? '입력' : '미입력 — Sharpe 보류'), '표본 ' + (est.sample && est.sample.n != null ? est.sample.n : days) + '일'];
    if (weekly) declParts.push('한국·미국 종목이 함께 있어 ' + obs + '로 계산(두 시장의 마감 시각 차이 반영)');
    // The weights come from the valuation screen's close (or delayed quote) where no live quote was available.
    const ref = data.referenceValued;
    if (ref) declParts.push('비중은 ' + (ref.count < ref.total ? ref.total + '종목 중 ' + ref.count + '종목 ' : '') + (ref.date ? shortDate(ref.date) + ' ' : '') + '종가 평가액 기준');
    declCodes = ['path ' + est.exposureHistoryMode, 'rebalance ' + (est.rebalancePolicyApplied ? est.rebalancePolicy : (est.rebalancePolicyDeclared ? est.rebalancePolicyDeclared + '(미사용)' : '미선언')), 'scope ' + (scopeToken || '—'), 'lineage ' + (est.pathLineage || '—'), 'snapshot ' + est.compositionSnapshotId + ' @ ' + (est.valuationCut || '—')];
    if (est.pathLineage === 'legacy-risk-path') declParts.push('실제 계좌 이력 아님' + (est.rebalancePolicyDeclared ? ', 선언 정책 ' + _escHtmlSafe(est.rebalancePolicyDeclared) + ' 미사용' : '')); // P1197: 소비되지 않는 선언을 화면이 말한다
    if (est.pathLineage === 'fixed-target-weight-strategy') {
      let declaredTargets = est.strategy && est.strategy.targetWeights ? Object.keys(est.strategy.targetWeights) : [];
      declParts.push('목표 비중 유지 전략, 실제 계좌 이력 아님' + (est.strategy && est.strategy.cashWeight > 0 ? ', 현금 ' + (est.strategy.cashWeight * 100).toFixed(1) + '%' : '') + (declaredTargets.length
        ? ', 목표 ' + declaredTargets.map(function(ticker) { return ticker + ' ' + (est.strategy.targetWeights[ticker] * 100).toFixed(1) + '%'; }).join('/')
        : ''));
    }
    declLines.push(_escHtmlSafe(declParts.join(', ')));
    if (est.wholeAccountHold) {
      // E3/E4/P1188: 보류 사유를 구분해 말한다 — 통화 미선언/수익률 미입력/전략 경로 미선언.
      let holdReason = est.wholeAccountHold === 'cash-declaration-unresolved' ? '현금을 기준 통화로 바꿀 환율 없음'
        : est.wholeAccountHold === 'strategy-account-scope-not-declared' ? '전략 경로의 계좌 범위 미선언'
        : '현금 수익률 미입력';
      declLines.push('현금 보류: ' + holdReason + ' — 계좌 전체 위험은 게시하지 않습니다(주식 부분만 게시).');
    }
  }
  let declHtml = declLines.length
    ? '<div class="wsl-rk-decl" data-exposure-path="' + _escHtmlSafe(est.exposureHistoryMode || '') + '" data-risk-scope="' + _escHtmlSafe(scopeToken || '') + '" data-path-lineage="' + _escHtmlSafe(est.pathLineage || '') + '">' + declLines.join('<br>') + (declCodes ? '<details><summary>계산 식별자</summary>' + _escHtmlSafe(declCodes.join(', ')) + '</details>' : '') + '</div>'
    : '';

  // 지표 카드
  let mdd = mddRes ? mddRes.mdd : null;
  // v57.50 D03: every card names its real sample ("최근 n거래일 표본"); Sharpe needs about a year of returns.
  let sampleTag = ', 최근 ' + days + '거래일 표본';
  let sharpeThin = !(days >= 250);
  let cards = '<div class="wsl-rk-tiles">';

  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">' + span + ' VaR (95%)' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val is-loss">' + fmtLoss(var95) + '</div>' +
    '<div class="wsl-rk-sub">과거 표본 95% 손실 경계(초과 가능), 표본 ' + obs + ' 중 하위 ' + Math.max(1, Math.ceil(n * 0.05 - 1e-9)) + '번째 손실' + (weekly ? perDay(var95) : '') + '</div></div>';
  // The mean loss past the 95% boundary; deriveVarStability certifies it on its own bootstrap band and sensitivity.
  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">' + span + ' CVaR (95%)' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val is-loss">' + fmtLoss(readout.cvar95) + '</div>' +
    '<div class="wsl-rk-sub">' + (readout.cvar95 == null ? '데이터 부족' : '95% 경계를 넘은 ' + readout.cvarTailN + '개 관측의 평균 손실' + (readout.cvarCertified ? '' : ', 꼬리 표본이 얇아 참고값')) + '</div></div>';
  let tail99 = Math.max(1, Math.ceil(n * 0.01 - 1e-9)), thin99 = !(n >= 100); // #8: under 100 observations the 99% "boundary" is just the worst of the sample
  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">' + (thin99 ? (weekly ? '표본 최악 구간 (' + span + ' 손실)' : '표본 최악일 (1일 손실)') : span + ' VaR (99%)') + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val is-loss">' + fmtLoss(var99) + '</div>' +
    '<div class="wsl-rk-sub">' + (thin99 ? '표본 ' + obs + '라 99% 꼬리 관측이 ' + tail99 + '개뿐 — 99% 경계가 아니라 표본 ' + (weekly ? '최악 구간' : '최악일') + '입니다' : '과거 표본 99% 손실 경계(초과 가능), 표본 ' + obs + ', 꼬리 ' + tail99 + '개') + '</div></div>';
  let sharpeShown = sharpeThin ? null : sharpe;
  let sharpeSub = sharpeThin ? '표본 부족, 보류 (' + days + '거래일 — 250일 미만이면 연율화 값이 표본 구간에 크게 좌우됩니다)'
    : sharpe !== null && sharpe !== undefined ? 'RF 입력, 표본 ' + obs + '(연율화)' : (rfAnnual == null && est ? 'RF 미입력 — 보류 (' + days + '일)' : '데이터 부족');
  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">Sharpe Ratio' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val ' + plainTone(sharpeShown) + '">' + fmtN(sharpeShown) + '</div>' +
    '<div class="wsl-rk-sub">' + sharpeSub + '</div></div>';

  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">표본 기간 최대낙폭 (MDD)' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val ' + plainTone(mdd) + '">' + fmtLoss(mdd) + '</div>' +
    '<div class="wsl-rk-sub">' + (mdd !== null ? '표본 ' + days + '일 중 고점 대비 최대 하락' : '데이터 부족') + '</div></div>';

  cards += '</div>';

  // Each holding's share of the book's variance at today's weights, beside its weight (sums to 100%).
  let contribHtml = '';
  if (readout.contributions) {
    const shown = readout.contributions.slice(0, 8);
    contribHtml = '<div class="wsl-rk-heat"><div class="wsl-rk-heat-title">종목별 위험 기여</div>' +
      shown.map(function(row) {
        return '<div class="wsl-xp-kv wsl-fs-sm"><span class="wsl-dim">' + _escHtmlSafe(row.ticker) + '</span><span class="wsl-b">비중 ' + row.weightPct.toFixed(1) + '%, 위험 ' + row.contributionPct.toFixed(1) + '%</span></div>';
      }).join('') +
      '<div class="wsl-rk-legend">지금 비중과 표본 ' + obs + '의 공분산으로 나눈 변동성 몫, 전체 합 100%(주식 부분 기준)' + (readout.contributions.length > shown.length ? ', 위험 기여 상위 ' + shown.length + '종목' : '') + '</div></div>';
  }

  // 상관계수 히트맵 (HTML 테이블 + 냉온색)
  let heatHtml = '';
  if (corrRes && corrRes.tickers && corrRes.tickers.length >= 2) {
    let ts = corrRes.tickers;
    heatHtml = '<div class="wsl-rk-heat">' +
      '<div class="wsl-rk-heat-title">종목 간 상관계수 매트릭스</div>' +
      '<div class="wsl-rk-scroll"><table class="wsl-rk-matrix">';

    // 헤더
    heatHtml += '<tr><td class="wsl-rk-hd"></td>';
    ts.forEach(function(t) {
      heatHtml += '<td class="wsl-rk-hd is-label is-col">' + t + '</td>';
    });
    heatHtml += '</tr>';

    // 데이터 행
    corrRes.matrix.forEach(function(row, i) {
      heatHtml += '<tr><td class="wsl-rk-hd is-label">' + ts[i] + '</td>';
      row.forEach(function(val, j) {
        // v59.59: a flat or too-short pair has no correlation (null) — a plain dash, not a colour for 0.
        if (val == null || !isFinite(val)) { heatHtml += '<td class="wsl-rk-hv" title="변동이 없거나 표본이 짧아 상관을 계산하지 않음">—</td>'; return; }
        let abs = Math.abs(val);
        let bg, textC;
        if (val >= 0.99) {
          bg = 'rgba(var(--ink-rgb),0.4)'; textC = 'var(--color-text-secondary)';
        } else {
          // v59.69 (visual audit): theme tokens, tint rising with |r| (darkest at the extremes, clear near 0), and the
          // primary text colour on every tint — the old hand-built RGB put white text on pale pink (below AA).
          bg = 'color-mix(in srgb, ' + (val > 0 ? 'var(--color-text-error)' : 'var(--blue-11)') + ' ' + Math.round(abs * 40) + '%, transparent)';
          textC = 'var(--color-text-primary)';
        }
        heatHtml += '<td class="wsl-rk-hv" data-heat-bg="' + bg + '" data-heat-fg="' + textC + '">' +
          (Math.abs(val - 1) < 0.001 ? '1.00' : val.toFixed(2)) + '</td>';
      });
      heatHtml += '</tr>';
    });
    heatHtml += '</table></div>';
    // One basis for every cell: daily returns, or 5-session returns when the book holds Korean and US listings.
    heatHtml += '<div class="wsl-rk-legend">빨강=정상관(분산 효과↓), 파랑=역상관(분산 효과↑), ' +
      (weekly ? '모든 칸 ' + obs + ' 기준(한국·미국 장 마감 시각이 달라 일간으로 짝짓지 않음)' : '일간 수익률, 기간: ' + n + '거래일') + '</div>';
    heatHtml += '</div>';
  }

  let note = '<div class="wsl-rk-note">' +
    '역사적 시뮬레이션 VaR — ' + (scopeLabel ? _escHtmlSafe(scopeLabel) + ' 범위' : '선언된 범위') +
    '의 과거 수익률 기준입니다. 실제 손실은 이보다 클 수 있습니다.</div>';
  // P1449/P1458: the ledger account performance lives in its own panel — this panel says so
  // in the SAME innerHTML pass (an appended node raced with re-renders and vanished).
  note += '<div class="wsl-aside">실제 계좌 성과(TWR/MWR)는 원장 성과 요약에서 시세 이력과 무관하게 표시합니다.</div>';

  el.innerHTML = declHtml + cards + contribHtml + heatHtml + note;
  // Each matrix cell's colour is computed from its value, so it is set as a style property, not a class.
  if (typeof el.querySelectorAll === 'function') {
    el.querySelectorAll('[data-heat-bg]').forEach((cell) => {
      cell.style.background = cell.dataset.heatBg;
      cell.style.color = cell.dataset.heatFg;
      delete cell.dataset.heatBg;
      delete cell.dataset.heatFg;
    });
  }
  // P1445: returns of foreign holdings without a same-period USD/KRW close leave the currency move out.
  if (data.fxExcluded) el.insertAdjacentHTML('beforeend', '<div class="wsl-aside is-warn">해외 종목 수익률에 환율 변동이 빠져 있습니다(같은 기간 원/달러 종가 부족) — 계좌 통화 기준 전체 위험보다 작게 나올 수 있습니다.</div>');
  return readout;
}

