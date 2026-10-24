/**
 * Inline term marks (v57.55 review 2b, beginner panel).
 *
 * Readers met PER · bp · Sahm · 하이일드 스프레드 in the reading text with no way to look them up except opening the
 * glossary and typing. The first time a listed term appears in the prose of the active screen it gets a dotted
 * underline; pressing it shows the glossary's first sentence and a link to the full entry. The text itself is not
 * changed (textContent stays the same), only prose is marked (p · li · dd — not headings, tables, buttons or chips),
 * and a term without a glossary entry is left alone.
 */
const EDGE = 8;

/**
 * Live review 2026-10-14: the popover opens below the term (the finger covers what is above it) and moves above only
 * when there is no room below; with room on neither side it takes the larger side, clamped inside the viewport.
 */
export function placeTermPopover(anchorRect, size, viewport) {
  const width = Math.min(size.width, viewport.width - EDGE * 2);
  const left = Math.max(EDGE, Math.min(anchorRect.left + anchorRect.width / 2 - width / 2, viewport.width - width - EDGE));
  const below = anchorRect.bottom + 6;
  const above = anchorRect.top - size.height - 6;
  const roomBelow = viewport.height - EDGE - below;
  const top = roomBelow >= size.height ? below : above >= EDGE ? above
    : roomBelow >= anchorRect.top - EDGE ? Math.min(below, viewport.height - size.height - EDGE) : EDGE;
  return { left: Math.round(left), top: Math.round(Math.max(EDGE, top)), width: Math.round(width), side: top >= anchorRect.bottom ? 'below' : 'above' };
}

// [text as written on screen, glossary term]. Longer forms first so 'Forward PER' is not read as 'PER'.
export const TERM_MARKS = Object.freeze([
  ['Forward PER', 'Forward PER'],
  ['하이일드 스프레드', '하이일드 스프레드'],
  ['근원 물가', '근원 물가 (근원 CPI, 근원 PCE)'],
  ['공포·탐욕', '공포·탐욕 지수 (F&G)'],
  ['달러 지수', 'DXY (달러 인덱스)'],
  ['Sahm', 'Sahm Rule'],
  // v57.79 (UI review): the abbreviations 시장 상태 · 거시 print without a plain-Korean name.
  ['CCC', 'CCC − B 등급 격차'],
  ['RRG', 'RRG (상대회전그래프)'],
  ['OAS', 'OAS / HY 스프레드'],
  ['HY', 'HY 스프레드'],
  ['TIPS', 'TIPS (물가연동국채)'],
  ['풋/콜', 'Put/Call 비율'],
  ['TGA', 'TGA (재무부 일반계정)'],
  ['JOLTS', 'JOLTS (구인·이직 조사)'],
  ['PCE', 'PCE (개인소비지출, PCE 물가지수)'],
  ['PER', 'PER (P/E Ratio)'],
  ['ROE', 'ROE (자기자본이익률)'],
  ['RSI', 'RSI'],
  ['VIX', 'VIX (공포지수)'],
  ['SOFR', 'SOFR'],
  ['bp', 'bp (베이시스 포인트)'],
  ['백분위', '백분위'],
  ['분배일', '분배일'],
  ['정배열', '정배열 / 역배열'],
  ['3개월물', '3개월물 (국채)'],
  ['단기채', '단기채'],
  ['50일선', '이동평균 (50일선, 200일선)'],
  ['200일선', '이동평균 (50일선, 200일선)'],
  // 2026-10-19 market guide: the choice words 오늘 · 시나리오 가이드 use are glossary terms.
  ['기회비용', '기회비용'],
  ['분할 접근', '분할 접근']
]);

const PROSE = 'p, li, dd';
const SKIP = 'button, a, summary, input, textarea, select, label, h1, h2, h3, h4, th, td, svg, canvas, code, script, style, .aio-term, .basis-chip, .tip-body, .sr-only, [aria-hidden="true"], [contenteditable]';
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const patternFor = (text) => new RegExp(/^[A-Za-z]/.test(text) ? `(?<![A-Za-z])${escape(text)}(?![A-Za-z])` : escape(text));

/** First sentence of a glossary definition (the popover is one line; the glossary keeps the rest). */
export function firstSentence(definition) {
  const text = String(definition || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/^.+?(?:[.!?](?=\s|$)|다\.|요\.)/);
  return (match ? match[0] : text).slice(0, 220);
}

/**
 * Wraps the first unmarked occurrence of each term inside `page`; returns how many marks were added.
 * v57.77 perf: one text walk per call instead of one per term (32-115 ms per route). The walk keeps only text nodes
 * that contain some pending term; each term then scans that list in document order with the same acceptance rules
 * (prose parent, not skipped, sentence length, laid out, whole-word pattern) and the same TERM_MARKS priority.
 * The parent checks are cached per element: marking only splits a text node inside the same parent, so neither its
 * textContent nor its ancestry changes during the pass.
 */
export function markTerms(page, glossary, documentRef = page?.ownerDocument) {
  if (!page || !documentRef || !Array.isArray(glossary)) return 0;
  const entries = new Map(glossary.map((entry) => [entry?.term, entry]));
  const pending = TERM_MARKS.filter(([text, term]) => entries.has(term) && !page.querySelector(`.aio-term[data-term="${CSS.escape(text)}"]`));
  if (!pending.length) return 0;
  const anyTerm = new RegExp(pending.map(([text]) => escape(text)).join('|'));
  const nodes = [];
  const walker = documentRef.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (anyTerm.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  const parents = new Map();
  const parentInfo = (parent) => {
    let info = parents.get(parent);
    if (!info) { info = { prose: !parent.closest(SKIP) && !!parent.closest(PROSE), length: null, laidOut: null }; parents.set(parent, info); }
    return info;
  };
  // A sentence, not a short label span ('VIX 18.2'): only then is a small inline target exempt (WCAG 2.5.8).
  const accepts = (node, text, pattern) => {
    const parent = node.parentElement;
    if (!parent || !node.nodeValue.includes(text)) return false;
    const info = parentInfo(parent);
    if (!info.prose) return false;
    if (info.length == null) info.length = (parent.textContent || '').trim().length;
    if (info.length <= text.length + 12) return false;
    if (info.laidOut == null) info.laidOut = !!parent.getClientRects().length;
    return info.laidOut && pattern.test(node.nodeValue);
  };
  let added = 0;
  for (const [text, term] of pending) {
    const pattern = patternFor(text);
    const index = nodes.findIndex((node) => accepts(node, text, pattern));
    if (index < 0) continue;
    const node = nodes[index];
    const at = node.nodeValue.search(pattern);
    const target = node.splitText(at);
    const after = target.splitText(text.length);
    // The text before and after the mark stay candidates for the later terms, in document order.
    nodes.splice(index, 1, node, after);
    // A <button> always lays out inline-block; a span with the button role stays part of the sentence (WCAG 2.5.8 inline).
    const mark = documentRef.createElement('span');
    mark.setAttribute('role', 'button');
    mark.tabIndex = 0;
    mark.className = 'aio-term';
    mark.dataset.term = text;
    mark.dataset.glossaryTerm = term;
    mark.setAttribute('aria-haspopup', 'dialog');
    mark.setAttribute('aria-expanded', 'false');
    mark.textContent = target.nodeValue;
    target.replaceWith(mark);
    added += 1;
  }
  return added;
}

export function installTermMarks(documentRef, { root = globalThis } = {}) {
  if (!documentRef || documentRef.__aioTermMarks || typeof MutationObserver === 'undefined') return () => {};
  documentRef.__aioTermMarks = true;
  let timer = null;
  let pop = null;
  let opener = null;
  const activePage = () => documentRef.querySelector('.page.active');
  const run = () => { timer = null; try { markTerms(activePage(), root.GLOSSARY, documentRef); } catch (_) { /* reading text only */ } };
  const schedule = () => { if (!timer) timer = setTimeout(run, 700); };
  // While a popover is open the back-to-top button (bottom-right, fixed) is hidden so it cannot sit on top of it.
  // v57.61 WCAG 2.4.3: when focus was inside the popover, closing it (Escape, scroll) returns focus to the term.
  const close = ({ restore = true } = {}) => {
    if (!pop) return;
    const hadFocus = pop.contains(documentRef.activeElement);
    pop.remove(); pop = null;
    documentRef.body?.classList.remove('aio-term-pop-open');
    const mark = opener;
    opener = null;
    mark?.setAttribute('aria-expanded', 'false');
    if (restore && hadFocus && mark?.isConnected) mark.focus({ preventScroll: true });
  };
  const open = (mark) => {
    close({ restore: false });
    const entry = (root.GLOSSARY || []).find((item) => item?.term === mark.dataset.glossaryTerm);
    if (!entry) return;
    pop = documentRef.createElement('div');
    pop.className = 'aio-term-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', `${entry.term} 뜻`);
    const name = documentRef.createElement('strong');
    name.textContent = entry.term;
    const body = documentRef.createElement('p');
    body.textContent = firstSentence(entry.def);
    const more = documentRef.createElement('button');
    more.type = 'button';
    more.className = 'aio-term-more';
    more.textContent = '용어 사전에서 보기';
    more.addEventListener('click', () => {
      close({ restore: false });
      if (typeof root.openGlossary !== 'function') return;
      root.openGlossary();
      const search = documentRef.getElementById('glossary-search');
      if (search) { search.value = entry.term.replace(/\s*\(.*$/, ''); search.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    pop.append(name, body, more);
    // Tabbing out of the popover closes it; a pointer press elsewhere is handled by the document click.
    pop.addEventListener('focusout', (event) => { if (pop && event.relatedTarget && !pop.contains(event.relatedTarget)) close({ restore: false }); });
    // v57.71 (2026-10-15 audit, WCAG 2.4.3): the popover sits at the end of <body>, so Tab from its button landed on BODY.
    // Tab (either direction) closes it and returns focus to the term, where reading order continues.
    pop.addEventListener('keydown', (event) => { if (event.key === 'Tab') { event.preventDefault(); close(); } });
    pop.setAttribute('aria-modal', 'false');
    opener = mark;
    mark.setAttribute('aria-expanded', 'true');
    documentRef.body.append(pop);
    documentRef.body.classList.add('aio-term-pop-open');
    const viewport = { width: root.innerWidth || 1024, height: root.innerHeight || 768 };
    // The width is fixed first so the measured height is the wrapped height the popover will really have.
    pop.style.width = `${Math.min(320, viewport.width - EDGE * 2)}px`;
    const place = placeTermPopover(mark.getBoundingClientRect(), { width: pop.offsetWidth || 320, height: pop.offsetHeight || 90 }, viewport);
    Object.assign(pop.style, { left: `${place.left}px`, top: `${place.top}px`, width: `${place.width}px` });
    pop.dataset.side = place.side;
    more.focus({ preventScroll: true });
  };
  const onClick = (event) => {
    const mark = event.target.closest?.('.aio-term');
    if (mark) { event.preventDefault(); open(mark); return; }
    if (pop && !pop.contains(event.target)) close();
  };
  const onKey = (event) => {
    if (event.key === 'Escape' && pop) { close(); return; }
    const mark = (event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.aio-term');
    if (mark) { event.preventDefault(); open(mark); }
  };
  const observer = new MutationObserver(schedule);
  const content = documentRef.querySelector('.content') || documentRef.body;
  observer.observe(content, { childList: true, subtree: true, characterData: true });
  documentRef.addEventListener('click', onClick);
  documentRef.addEventListener('keydown', onKey);
  const onScroll = () => close();
  root.addEventListener?.('scroll', onScroll, { passive: true });
  // The reading column scrolls inside .content, not the window; a fixed popover must not stay behind when it moves.
  const scroller = documentRef.querySelector('.content');
  scroller?.addEventListener('scroll', onScroll, { passive: true });
  schedule();
  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
    close();
    documentRef.removeEventListener('click', onClick);
    documentRef.removeEventListener('keydown', onKey);
    root.removeEventListener?.('scroll', onScroll);
    scroller?.removeEventListener('scroll', onScroll);
    documentRef.__aioTermMarks = false;
  };
}
