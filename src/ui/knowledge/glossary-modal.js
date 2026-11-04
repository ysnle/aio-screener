// Roadmap item 11 (legacy decomposition, screen 용어 사전): the glossary modal had three classic owners — the opener and
// the category/entry renderers in js/aio-ui.js (openGlossary, renderGlossaryCats, renderGlossaryItems, filterGlossary,
// _glossaryCat, _GLOSSARY_GROUPS, _glossaryPreviousFocus) and the close, category and search handlers in js/aio-core.js
// (_aioCloseGlossary, _aioGlossaryCat, _aioFilterGlossary). They moved here unchanged, so every writer of #glossary-modal,
// #glossary-cats and #glossary-body sits in one place (AG-DOM-WRITER). The entry parts and the cross-surface search stay in
// glossary-bridge.js; the registry stays in js/aio-glossary.js (root.GLOSSARY) and HTML escaping stays root.escHtml, the
// classic helper that also strips pictographs.

// P1599 (F113): 28 raw categories mixed subject, industry and difficulty on four rows; seven reader groups replace them
// (each item keeps its own category tag).
export const GLOSSARY_GROUPS = [
  ['기초·회계', ['기초', '금융수학·통계', '회계·재무제표']],
  ['거시·금리·외환', ['경제', '경제 기본', '거시·돈', '거시', '외환', '채권']],
  ['시장·차트·전략', ['기술적분석', '기술', '전략', '시장·밸류에이션']],
  ['옵션', ['옵션']],
  ['한국', ['한국시장', '한국 기업·시장']],
  ['산업', ['은행', '보험', '부동산·리츠', '소비·유통', '소프트웨어·플랫폼', '바이오·의료', '에너지·화학·소재', '운송·물류', '농업·식품', '반도체·AI 인프라']],
  ['배경·심화', ['배경지식', '심화']]
];

export function glossaryGroupOf(cat) {
  for (const [group, cats] of GLOSSARY_GROUPS) if (cats.includes(cat)) return group;
  return '기타';
}

// The searched term itself first, then terms that start with the query, then terms that contain it, then the rest.
function searchRank(entry, query) {
  const term = entry.term.toLowerCase();
  if (term === query) return 0;
  if (term.indexOf(query) === 0) return 1;
  return term.indexOf(query) !== -1 ? 2 : 3;
}

export function createGlossaryModal({ root = globalThis, documentRef = root.document } = {}) {
  let category = 'all';
  let previousFocus = null;
  let shownQuery = ''; // v59.70: the term the command search opened the modal on (the modal has no search box of its own)
  const entries = () => (Array.isArray(root.GLOSSARY) ? root.GLOSSARY : []);
  const esc = (value) => (typeof root.escHtml === 'function' ? root.escHtml(value) : String(value));

  function renderCats() {
    // P1248: the buttons come from the GLOSSARY registry, so a category that only the data has is never left out.
    const all = entries();
    const counts = {};
    all.forEach((entry) => { const group = glossaryGroupOf(entry.cat); counts[group] = (counts[group] || 0) + 1; });
    const cats = ['all', ...GLOSSARY_GROUPS.map((row) => row[0]), '기타'].filter((c) => c === 'all' || counts[c]);
    let html = '';
    cats.forEach((c) => {
      const label = `${c === 'all' ? '전체' : c} ${c === 'all' ? all.length : counts[c]}`;
      html += `<button data-action="_aioGlossaryCat" data-arg="${esc(c)}" aria-pressed="${c === category}" class="lu-gl-cat">${esc(label)}</button>`;
    });
    const host = documentRef.getElementById('glossary-cats');
    if (host) host.innerHTML = html;
  }

  function entryHtml(entry, open) {
    // v58.53 개편 v2 (3h): each entry is a disclosure row (term · 분류 · 첫 문장); opened, it reads definition →
    // formula → 한계 → "이 개념이 쓰이는 화면" (parts from glossary-bridge.js, cut from the entry's own text).
    let parts = null;
    try { parts = typeof root._aioGlossaryEntryParts === 'function' ? root._aioGlossaryEntryParts(entry) : null; } catch (_e) { parts = null; }
    const lead = parts && parts.lead.length ? parts.lead.join(' ') : entry.def;
    let html = `<details class="aio-glossary-item"${open ? ' open' : ''}>`;
    html += '<summary class="lu-gl-head">';
    html += `<span class="aio-glossary-term">${esc(entry.term)}</span>`;
    html += `<span class="lu-gl-tag">${esc(entry.cat)}</span>`;
    html += `<span class="lu-gl-first">${esc(lead)}</span>`;
    html += '</summary>';
    html += '<div class="lu-gl-def">';
    html += `<p class="lu-gl-lead">${esc(lead)}</p>`;
    if (parts) {
      parts.formulas.forEach((f) => { html += `<div class="lu-gl-formula">${esc(f)}</div>`; });
      if (parts.limits.length) html += `<p class="lu-gl-limits"><b>한계, 주의</b> ${esc(parts.limits.join(' '))}</p>`;
      if (parts.screens.length || parts.conceptId) {
        html += '<div class="lu-gl-used"><span class="lu-gl-used-label">이 개념이 쓰이는 화면</span>';
        parts.screens.forEach((s) => { html += `<button type="button" class="lu-gl-route" data-action="_aioGlossaryOpenScreen" data-arg="${esc(s.route)}">${esc(s.label)}</button>`; });
        if (parts.conceptId) html += `<button type="button" class="lu-gl-route" data-action="_aioGlossaryOpenConcept" data-arg="${esc(parts.conceptId)}">리서치, 개념 사전</button>`;
        html += '</div>';
      }
      if (parts.basis) html += `<p class="lu-gl-basis">근거, ${esc(parts.basis)}</p>`;
    }
    html += '</div></details>';
    return html;
  }

  function renderItems(query) {
    shownQuery = String(query || '').trim();
    const q = shownQuery.toLowerCase();
    const matches = (g) => !q
      || g.term.toLowerCase().indexOf(q) !== -1
      || Boolean(g.alias && g.alias.toLowerCase().indexOf(q) !== -1)
      || g.def.toLowerCase().indexOf(q) !== -1;
    const all = entries();
    let filtered = all.filter((g) => (category === 'all' || glossaryGroupOf(g.cat) === category) && matches(g));
    if (q) filtered.sort((a, b) => searchRank(a, q) - searchRank(b, q)); // v57.55 (2b)
    // P1248: say that the search runs inside the chosen category, and widen to every category when it finds nothing there.
    let scopeNote = '';
    if (q && category !== 'all') {
      if (filtered.length === 0) {
        const global = all.filter(matches);
        if (global.length > 0) {
          scopeNote = `‘${category}’ 분류에서 0건이라 전체에서 검색한 결과입니다.`;
          category = 'all';
          renderCats();
          filtered = global;
        } else {
          scopeNote = `‘${category}’ 분류와 전체 모두에서 0건입니다.`;
        }
      } else {
        scopeNote = `‘${category}’ 분류 안에서 검색 중입니다 — 전체 검색은 ‘전체’를 선택하세요.`;
      }
    }
    let html = scopeNote ? `<div role="status" class="lu-gl-scope">${esc(scopeNote)}</div>` : '';
    // v59.70: a list narrowed to one searched term has one way back to the whole list.
    if (q) html += `<div class="lu-gl-scope"><button type="button" class="lu-gl-route" data-action="_aioGlossaryShowAll">전체 용어 보기</button></div>`;
    if (filtered.length === 0) html += '<div class="lu-gl-empty">검색 결과가 없습니다</div>';
    else filtered.forEach((g, index) => { html += entryHtml(g, Boolean(q) && index === 0); });
    const body = documentRef.getElementById('glossary-body');
    if (!body) return;
    body.innerHTML = html;
    if (!body._aioSingleOpen) {
      body._aioSingleOpen = true;
      // Single-open accordion: opening one entry folds the others (toggle does not bubble, so listen in capture).
      body.addEventListener('toggle', (event) => {
        const item = event.target;
        if (!item || !item.open || !item.classList || !item.classList.contains('aio-glossary-item')) return;
        body.querySelectorAll('details.aio-glossary-item[open]').forEach((other) => { if (other !== item) other.open = false; });
      }, true);
    }
  }

  function close() {
    const modal = documentRef.getElementById('glossary-modal');
    if (modal) {
      modal.style.display = 'none';
      if (modal._aioTrapCleanup) { modal._aioTrapCleanup(); modal._aioTrapCleanup = null; }
    }
    const focusTarget = previousFocus;
    previousFocus = null;
    if (focusTarget && documentRef.contains(focusTarget) && !focusTarget.disabled) { try { focusTarget.focus(); } catch (_) { /* detached */ } }
  }

  // v59.70 (wave2-f S23): open(term) shows that term's entry open (a term mark, a research result or the command search);
  // open() the whole list. Searching is the command search's '용어' scope (the 검색 button in the head).
  function open(term = '') {
    const modal = documentRef.getElementById('glossary-modal');
    if (!modal) return;
    const active = documentRef.activeElement;
    if (modal.style.display === 'none') previousFocus = active && active !== documentRef.body ? active : null;
    if (modal._aioTrapCleanup) modal._aioTrapCleanup();
    modal.style.display = '';
    category = 'all';
    renderCats();
    renderItems(typeof term === 'string' ? term.replace(/\s*\(.*$/, '') : '');
    const title = documentRef.querySelector('#glossary-modal h2');
    if (title) title.textContent = `투자 용어 사전, ${entries().length}개`;
    modal._aioTrapCleanup = typeof root._aioModalTrap === 'function' ? root._aioModalTrap(modal, close) : null;
    const first = shownQuery ? documentRef.querySelector('#glossary-body details[open] > summary') : documentRef.getElementById('glossary-search-open');
    try { (first || documentRef.querySelector('#glossary-modal button'))?.focus(); } catch (_) { /* detached */ }
  }

  function selectCategory(cat) {
    category = cat;
    renderCats();
    renderItems(shownQuery);
  }

  // The Escape key (js/aio-ui.js) closes the glossary first when it is showing.
  function isOpen() {
    const modal = documentRef.getElementById('glossary-modal');
    return Boolean(modal && modal.style.display !== 'none');
  }

  return { open, close, isOpen, renderCats, renderItems, selectCategory };
}

// The window names the markup (data-action / data-on-input), the keyboard shortcuts, term marks, the research shell and
// js/aio-tests.js call. Installed with the lazy screen bridges (src/app/legacy-screen-bridges.js); an open asked before
// they loaded (root._aioGlossaryPending, set by the stub in src/app/compatibility-globals.js) is shown now.
export function installGlossaryModal(root, documentRef) {
  const modal = createGlossaryModal({ root, documentRef });
  root.openGlossary = modal.open;
  root._aioCloseGlossary = modal.close;
  root._aioGlossaryIsOpen = modal.isOpen;
  root.renderGlossaryCats = modal.renderCats;
  root.renderGlossaryItems = modal.renderItems;
  root.filterGlossary = (value) => modal.renderItems(value);
  root._aioGlossaryCat = modal.selectCategory;
  root._aioGlossaryShowAll = () => modal.renderItems('');
  if (root._aioGlossaryPending) { const term = root._aioGlossaryPending; root._aioGlossaryPending = false; modal.open(typeof term === 'string' ? term : ''); }
  return modal;
}
