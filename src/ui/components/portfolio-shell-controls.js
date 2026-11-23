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
        var tk = escHtml(p.ticker);
        var costNum = Number(p.cost);
        // A KRW cost read "@ $70000.00"; the cost keeps its own unit (declared, else the listing's).
        var won = (p.costCurrency || p.currency) === 'KRW' || (!p.costCurrency && !p.currency && /\.\b(KS|KQ)\b$/i.test(String(p.ticker || '')));
        var costText = won ? Math.round(costNum).toLocaleString('en-US') + '원' : '$' + costNum.toFixed(2);
        return '<option value="' + tk + '">' + tk + ', ' + escHtml(p.qty) + '주 @ ' + (p.cost != null && p.cost !== '' && isFinite(costNum) ? costText : '원가 미확인') + '</option>';
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
