// v59.70 (legacy core wave 2, portfolio leftovers): the two classic writers left on 포트폴리오 moved here unchanged from
// js/aio-core.js — the R:R calculator's position select (#rr-position-select, v48.47) and the 저장 기록 잠금 badge with its
// set/unlock panels (#vault-status-badge, v30.11). Callers keep the same globals; _AioVault is js/aio-core.js's global
// lexical binding. src/app/compatibility-globals.js installs this before DOMContentLoaded.
export function installPortfolioShellControls(window = globalThis, document = globalThis.document) {
  var escHtml = function(value) { return window.escHtml(value); };
  var getPortfolioData = function() { return window.getPortfolioData(); };
  window._aioRRPopulateSelect = function() {
    var sel = document.getElementById('rr-position-select');
    if (!sel) return;
    var positions = (typeof getPortfolioData === 'function') ? getPortfolioData() : [];
    var current = sel.value;
    sel.innerHTML = '<option value="">포지션에서 자동 입력...</option>' +
      positions.map(function(p){
        var tk = escHtml(p.ticker); // v59.42: a stored ticker is escaped (it was raw HTML in the option)
        // v59.45 (P27-IMPORT-01): an imported position without a readable cost shows '원가 미확인', not '$NaN'.
        var costNum = Number(p.cost);
        return '<option value="' + tk + '">' + tk + ', ' + escHtml(p.qty) + '주 @ ' + (p.cost != null && p.cost !== '' && isFinite(costNum) ? '$' + costNum.toFixed(2) : '원가 미확인') + '</option>';
      }).join('');
    if (current && positions.some(function(p){return p.ticker===current;})) sel.value = current;
  };

  function _updateVaultStatus() {
    var badge = document.getElementById('vault-status-badge');
    var setPanel = document.getElementById('vault-set-panel');
    var unlockPanel = document.getElementById('vault-unlock-panel');
    if (!badge) return;
    var hasSalt = !!_AioVault.getStorage().getItem('aio_vault_salt');
    var isUnlocked = _AioVault.isUnlocked();
    if (!hasSalt) {
      badge.textContent = ' 미설정'; badge.style.color = 'var(--gold-11)';
      if (setPanel) setPanel.style.display = 'block';
      if (unlockPanel) unlockPanel.style.display = 'none';
    } else if (isUnlocked) {
      badge.textContent = ' 활성'; badge.style.color = 'var(--green-11)';
      if (setPanel) setPanel.style.display = 'none';
      if (unlockPanel) unlockPanel.style.display = 'none';
    } else {
      badge.textContent = ' 잠금'; badge.style.color = 'var(--amber-11)';
      if (setPanel) setPanel.style.display = 'none';
      if (unlockPanel) unlockPanel.style.display = 'block';
    }
  }
  window._updateVaultStatus = _updateVaultStatus;
}
