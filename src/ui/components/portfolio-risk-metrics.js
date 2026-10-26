// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 리스크 지표 panel (#pf-risk-metrics: scope
// declaration, VaR 95/99·Sharpe·MDD tiles, correlation matrix, notes) and its hold/status lines moved here from
// js/aio-workspace.js (_renderRiskMetrics and the refreshPortfolioRisk writers). Texts and the scope rules (22:PFR02/
// PFR09, P1188, P1197, P1449) are unchanged. refreshPortfolioRisk still fetches the history and assembles the estimate;
// it reports through window._aioRenderPortfolioRiskStatus / _aioRenderPortfolioRiskMetrics (src/app/legacy-screen-bridges.js).

const esc = (root, s) => (typeof root.escHtml === 'function' ? root.escHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

// One status line (no holdings, requesting, or a hold reason). Returns false when the panel is absent.
export function renderPortfolioRiskStatus(text, warn, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-risk-metrics');
  if (!el) return false;
  el.innerHTML = `<div class="wsl-msg${warn ? ' is-warn' : ''}">${esc(root, text)}</div>`;
  return true;
}

export function renderPortfolioRiskMetrics(data, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-risk-metrics');
  if (!el) return;
  const _escHtmlSafe = (s) => esc(root, s);
  let var95 = data.var95, var99 = data.var99, sharpe = data.sharpe,
      mddRes = data.mddRes, corrRes = data.corrRes, n = data.n;
  let est = data.estimate || null;
  let rfAnnual = data.rfAnnual != null ? data.rfAnnual : null;
  // 22:PFR02/PFR09 (E4): every number on this panel belongs to a declared
  // scope. The title carries the denominator so a sleeve figure can never read
  // as account risk, and the declaration block states path/cash/RF/snapshot.
  let scopeToken = est ? est.publishedScope : null;
  let scopeLabel = scopeToken === 'whole_account' ? '계좌 전체' : scopeToken === 'invested_sleeve' ? '주식 부분' : null;
  let scopeSuffix = scopeLabel ? ', ' + scopeLabel : '';

  function fmtLoss(v) { return (v !== null && v !== undefined) ? '-' + (v * 100).toFixed(2) + '%' : '—'; } // v50.22: null일 때 "-—" 대신 "—"
  function fmtN(v, d) { return (v !== null && v !== undefined) ? v.toFixed(d !== undefined ? d : 2) : '—'; }
  // #17: a 3-month Sharpe/MDD carries no 우수/양호/위험 grade — the value and its sample period only.
  function plainTone(v) { return v === null || v === undefined ? 'is-muted' : 'is-plain'; }

  // 선언 블록 — 측정 경로/분모/RF/표본/snapshot. 실제 계좌 성과(TWR/MWR)는 P1449부터
  // pf-ledger-performance 요약으로 분리됐다(시세 이력 게이트와 무관).
  let declLines = [];
  let declCodes = null;
  if (est) {
    // #16: one Korean line on screen; the internal codes (path/scope/lineage/snapshot) go to the folded detail below.
    let declParts = [est.exposureHistoryMode === 'current_composition_retrospective' ? '현재 구성을 표본 기간에 그대로 적용한 소급 계산' : est.exposureHistoryMode === 'fixed_target_weight_strategy' ? '목표 비중 유지 전략' : '실제 계좌 이력', '분모 ' + (scopeLabel || '—'), 'RF ' + (est.rf && est.rf.status === 'accepted' ? '입력' : '미입력 — Sharpe 보류'), '표본 ' + (est.sample && est.sample.n != null ? est.sample.n : n) + '일'];
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
  let sampleTag = ', 최근 ' + n + '거래일 표본';
  let sharpeThin = !(n >= 250);
  let cards = '<div class="wsl-rk-tiles">';

  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">1일 VaR (95%)' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val is-loss">' + fmtLoss(var95) + '</div>' +
    '<div class="wsl-rk-sub">과거 표본 95% 손실 경계(초과 가능), 표본 ' + n + '일 중 하위 ' + Math.max(1, Math.ceil(n * 0.05 - 1e-9)) + '번째 손실</div></div>';
  let tail99 = Math.max(1, Math.ceil(n * 0.01 - 1e-9)), thin99 = !(n >= 100); // #8: under 100 days the 99% "boundary" is just the worst day(s) of the sample
  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">' + (thin99 ? '표본 최악일 (1일 손실)' : '1일 VaR (99%)') + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val is-loss">' + fmtLoss(var99) + '</div>' +
    '<div class="wsl-rk-sub">' + (thin99 ? '표본 ' + n + '일이라 99% 꼬리 관측이 ' + tail99 + '개뿐 — 99% 경계가 아니라 표본 최악일입니다' : '과거 표본 99% 손실 경계(초과 가능), 표본 ' + n + '일, 꼬리 ' + tail99 + '개') + '</div></div>';
  let sharpeShown = sharpeThin ? null : sharpe;
  let sharpeSub = sharpeThin ? '표본 부족, 보류 (' + n + '거래일 — 250일 미만이면 연율화 값이 표본 구간에 크게 좌우됩니다)'
    : sharpe !== null && sharpe !== undefined ? 'RF 입력, 표본 ' + n + '일(연율화)' : (rfAnnual == null && est ? 'RF 미입력 — 보류 (' + n + '일)' : '데이터 부족');
  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">Sharpe Ratio' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val ' + plainTone(sharpeShown) + '">' + fmtN(sharpeShown) + '</div>' +
    '<div class="wsl-rk-sub">' + sharpeSub + '</div></div>';

  cards += '<div class="wsl-rk-tile">' +
    '<div class="wsl-rk-label">표본 기간 최대낙폭 (MDD)' + scopeSuffix + sampleTag + '</div>' +
    '<div class="wsl-rk-val ' + plainTone(mdd) + '">' + fmtLoss(mdd) + '</div>' +
    '<div class="wsl-rk-sub">' + (mdd !== null ? '표본 ' + n + '일 중 고점 대비 최대 하락' : '데이터 부족') + '</div></div>';

  cards += '</div>';

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
        // v57.50 D04: Korea-US cells are weekly returns (non-synchronous closes); no red/blue diversification reading.
        if (corrRes.mixedMarket && corrRes.mixedMarket[i] && corrRes.mixedMarket[i][j]) {
          heatHtml += '<td class="wsl-rk-hv is-mixed" title="한국·미국 종목 쌍 — 장 마감 시각이 달라 5거래일(주간) 수익률로 계산">' +
            (val == null || !isFinite(val) ? '비동시' : val.toFixed(2) + '*') + '</td>';
          return;
        }
        let abs = Math.abs(val);
        let bg, textC;
        if (val >= 0.99) {
          bg = 'rgba(var(--ink-rgb),0.4)'; textC = 'var(--text-muted)';
        } else if (val > 0) {
          bg = 'rgba(' + Math.round(210 * abs) + ',' + Math.round(50 * (1 - abs)) + ',' + Math.round(50 * (1 - abs)) + ',0.4)';
          textC = abs > 0.5 ? '#fff' : 'var(--text-secondary)';
        } else {
          bg = 'rgba(' + Math.round(40 * (1 - abs)) + ',' + Math.round(80 * (1 - abs)) + ',' + Math.round(50 + 150 * abs) + ',0.4)';
          textC = abs > 0.5 ? '#fff' : 'var(--text-secondary)';
        }
        heatHtml += '<td class="wsl-rk-hv" data-heat-bg="' + bg + '" data-heat-fg="' + textC + '">' +
          (Math.abs(val - 1) < 0.001 ? '1.00' : val.toFixed(2)) + '</td>';
      });
      heatHtml += '</tr>';
    });
    heatHtml += '</table></div>';
    let _hasMixed = !!(corrRes.mixedMarket && corrRes.mixedMarket.some(function(r) { return r.some(Boolean); }));
    heatHtml += '<div class="wsl-rk-legend">빨강=정상관(분산 효과↓), 파랑=역상관(분산 효과↑), 같은 시장 종목끼리 일간 수익률, 기간: ' + n + '거래일' +
      (_hasMixed ? '<br>회색 칸(*)은 한국·미국 종목 쌍입니다 — 같은 날짜라도 장 마감 시각이 달라 동시 관측이 아니므로 5거래일(주간) 수익률' + (corrRes.weeklyN ? ' ' + corrRes.weeklyN + '개' : '') + '로 계산했고, 분산 효과 해석은 보류합니다(\'비동시\'는 주간 표본 8개 미만).' : '') + '</div>';
    heatHtml += '</div>';
  }

  let note = '<div class="wsl-rk-note">' +
    '역사적 시뮬레이션 VaR — ' + (scopeLabel ? _escHtmlSafe(scopeLabel) + ' 범위' : '선언된 범위') +
    '의 과거 수익률 기준입니다. 실제 손실은 이보다 클 수 있습니다.</div>';
  // P1449/P1458: the ledger account performance lives in its own panel — this panel says so
  // in the SAME innerHTML pass (an appended node raced with re-renders and vanished).
  note += '<div class="wsl-aside">실제 계좌 성과(TWR/MWR)는 원장 성과 요약에서 시세 이력과 무관하게 표시합니다.</div>';

  el.innerHTML = declHtml + cards + heatHtml + note;
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
}

