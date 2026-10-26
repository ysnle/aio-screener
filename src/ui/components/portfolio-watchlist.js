// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 관심 종목 리스트 view (#wl-select, the
// rename/delete buttons, #wl-add-row, #wl-empty-msg/#wl-table/#wl-tbody) and the reads of its select and add inputs
// moved here from js/aio-workspace.js (refreshWatchlistUI/updateWatchlistButtons/renderWatchlistContent). Texts, the
// v58.63 BND01 input rule (clear only while the inputs still show the request) and the v57.81 quote registration are
// unchanged. Storage and the list edits stay in aio-workspace.js, which passes the lists and the active id to the
// window names that src/app/legacy-screen-bridges.js installs.

const esc = (root, s) => (typeof root.escHtml === 'function' ? root.escHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

const SIGNAL_TONE = { BUY: ' is-buy', SELL: ' is-sell', WATCH: ' is-watch' };

function renderButtons(hasActive, documentRef) {
  const renBtn = documentRef.getElementById('wl-rename-btn');
  const delBtn = documentRef.getElementById('wl-delete-btn');
  const addRow = documentRef.getElementById('wl-add-row');
  if (renBtn) renBtn.disabled = !hasActive;
  if (delBtn) delBtn.disabled = !hasActive;
  if (addRow) addRow.style.display = hasActive ? 'block' : 'none';
}

function renderContent(lists, activeId, { documentRef, root }) {
  const emptyMsg = documentRef.getElementById('wl-empty-msg');
  const table = documentRef.getElementById('wl-table');
  const tbody = documentRef.getElementById('wl-tbody');
  if (!emptyMsg || !table || !tbody) return;
  const empty = (text) => {
    emptyMsg.style.display = 'block';
    table.style.display = 'none';
    if (text != null) emptyMsg.textContent = text;
  };
  if (!activeId) { empty('리스트를 선택하거나 새로 만들어주세요. 관심 종목을 그룹별로 관리할 수 있습니다.'); return; }
  const wl = lists.find((l) => l.id === activeId);
  if (!wl) { empty(null); return; }
  if (wl.tickers.length === 0) { empty(`"${wl.name}" 리스트가 비어 있습니다. 위 입력란에 티커를 넣어 추가하세요.`); return; } // v57.81: the removed-emoji gap left a blank button reference
  emptyMsg.style.display = 'none';
  table.style.display = 'table';
  const ld = root._liveData || {};
  // Signals come from the canonical screener rows (the screener page's values).
  const dbMap = {};
  const screenerRows = typeof root._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() : [];
  if (Array.isArray(screenerRows)) screenerRows.forEach((s) => { dbMap[s.sym] = s; });
  tbody.innerHTML = wl.tickers.map((t) => {
    const d = ld[t.sym];
    if (!d && root.AIO && typeof root.AIO.registerLiveSymbol === 'function') root.AIO.registerLiveSymbol(t.sym, { reason: 'watchlist' }); // v57.81: a saved symbol outside the market set is quoted on the next refresh
    const db = dbMap[t.sym];
    const price = d && d.price ? d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const chg = d && d.pct != null ? d.pct : null;
    const chgTone = chg !== null ? (chg >= 0 ? ' is-up' : ' is-down') : ' is-muted';
    const chgStr = chg !== null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : '—';
    const signal = db ? db.signal : '—';
    const nameStr = db ? db.name : '';
    const eSym = esc(root, t.sym); // v46.9: XSS 방어
    const sigLabel = typeof root._scrSignalLabel === 'function' ? root._scrSignalLabel(signal) : signal;
    return `<tr class="aio-hover-row wsl-wl-row" data-action="_aioPortfolioTicker" data-arg="${esc(root, eSym)}">` +
      `<td class="wsl-wl-c"><b class="wsl-wl-sym">${eSym}</b>${nameStr ? `<div class="wsl-note">${esc(root, nameStr)}</div>` : ''}</td>` +
      `<td class="wsl-wl-fig">${price}</td>` +
      `<td class="wsl-wl-fig${chgTone}">${chgStr}</td>` +
      `<td class="wsl-wl-ctr">${signal !== '—' ? `<span class="wsl-wl-sig${SIGNAL_TONE[signal] || ''}">${sigLabel}</span>` : '<span class="wsl-note">—</span>'}</td>` +
      `<td class="wsl-wl-memo">${esc(root, t.note || '')}</td>` +
      '<td class="wsl-wl-ctr">' +
        `<button data-action="removeFromWatchlist" data-arg="${esc(root, eSym)}" data-stop="1" aria-label="${esc(root, eSym)} 관심 종목에서 삭제" class="aio-btn-table wsl-wl-del" title="삭제">삭제</button>` +
      '</td>' +
    '</tr>';
  }).join('');
}

// mode 'full' rebuilds the select, buttons and table (refreshWatchlistUI); 'view' the buttons and table (a select
// change); 'live' the table only, or everything while the select was never filled (the aio:liveQuotes listener).
export function renderWatchlist(lists, activeId, mode = 'full', { documentRef = globalThis.document, root = globalThis } = {}) {
  const sel = documentRef.getElementById('wl-select');
  if (!sel) return;
  if (mode === 'live' && !sel.dataset.filled) mode = 'full';
  if (mode === 'full') {
    sel.innerHTML = `<option value="">리스트 ${lists.length}개</option>`; sel.dataset.filled = '1'; // run-4 #4
    lists.forEach((l) => {
      const opt = documentRef.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.name} (${l.tickers.length}종목)`;
      if (l.id === activeId) opt.selected = true;
      sel.appendChild(opt);
    });
  }
  if (mode !== 'live') renderButtons(!!activeId, documentRef);
  renderContent(lists, activeId, { documentRef, root });
}

// The list the select shows, or null when it is absent.
export function readWatchlistSelect({ documentRef = globalThis.document } = {}) {
  const sel = documentRef.getElementById('wl-select');
  return sel ? sel.value : null;
}

// What the add inputs hold, as typed.
export function readWatchlistInputs({ documentRef = globalThis.document } = {}) {
  const inp = documentRef.getElementById('wl-add-ticker');
  const noteInp = documentRef.getElementById('wl-add-note');
  return { ticker: inp ? inp.value : '', note: noteInp ? noteInp.value : '' };
}

// v58.63 BND01: clear the inputs only while they still show what this request typed (no typed record: always).
export function clearWatchlistInputs(typed, { documentRef = globalThis.document } = {}) {
  const now = readWatchlistInputs({ documentRef });
  if (typed && (now.ticker !== typed.ticker || now.note !== typed.note)) return;
  const inp = documentRef.getElementById('wl-add-ticker');
  const noteInp = documentRef.getElementById('wl-add-note');
  if (inp) inp.value = '';
  if (noteInp) noteInp.value = '';
}
