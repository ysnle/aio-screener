/**
 * Inline term marks (v57.55 review 2b, beginner panel).
 *
 * Readers met PER · bp · Sahm · 하이일드 스프레드 in the reading text with no way to look them up except opening the
 * glossary and typing. The first time a listed term appears in the prose of the active screen it gets a dotted
 * underline; pressing it shows the glossary's first sentence and a link to the full entry. The text itself is not
 * changed (textContent stays the same), only prose is marked (p · li · dd — not headings, tables, buttons or chips),
 * and a term without a glossary entry is left alone.
 */
import { POPOVER_EDGE as EDGE, placePopover, claimPopover, releasePopover, watchScroll, hoverSuppressed } from './popover.js';

/**
 * Live review 2026-10-14: the popover opens below the term (the finger covers what is above it) and moves above only
 * when there is no room below; with room on neither side it takes the larger side, clamped inside the viewport.
 * v58.80: the rule lives in popover.js, shared with the other floating layers.
 */
export const placeTermPopover = placePopover;

// [text as written on screen, glossary term]. Longer forms first so 'Forward PER' is not read as 'PER'.
export const TERM_MARKS = Object.freeze([
  ['Forward PER', 'Forward PER'],
  ['하이일드 스프레드', '하이일드 스프레드'],
  // First-users run-6 (#5): four targets named a glossary term that had been renamed ('·' for ','), so 근원 물가, PCE and
  // 50·200일선 were never marked. markTerms skips a target with no entry, silently; these now match the entry names.
  ['근원 물가', '근원 물가 (근원 CPI · 근원 PCE)'],
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
  ['PCE', 'PCE (개인소비지출 · PCE 물가지수)'],
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
  ['50일선', '이동평균 (50일선 · 200일선)'],
  ['200일선', '이동평균 (50일선 · 200일선)'],
  // 2026-10-19 market guide: the choice words 오늘 · 시나리오 가이드 use are glossary terms.
  ['기회비용', '기회비용'],
  ['분할 접근', '분할 접근'],
  // v58.80 (first-users run-4, newcomer): abbreviations and words a beginner met unmarked on 오늘 · 시장 상태 · 종목.
  ['시장 폭', '시장 폭(Breadth)'],
  ['역배열', '정배열 / 역배열'],
  ['52주', '52주 신고가/신저가'],
  ['베타', '베타(Beta)'],
  ['국면', '시장 국면(Market Regime · 레짐)'],
  ['%p', '%p (퍼센트포인트)'],
  ['KST', 'KST (한국 시간)'],
  ['WTI', 'WTI (서부텍사스유)'],
  ['SMH', 'SMH (반도체 ETF)'],
  ['CPI', 'CPI (소비자물가지수)'],
  ['FOMC', 'FOMC'],
  ['ATR', 'ATR'],
  // First-users run-6 (#5): words 오늘 · 시장 상태 · 종목 · 포트폴리오 printed with no entry (src/domain/knowledge/deferred-screen-terms.js).
  ['희석 EPS', '희석 EPS'],
  ['혼조', '혼조'],
  ['GAAP', 'GAAP / 비GAAP'],
  ['EMA', 'EMA (지수이동평균)'],
  ['FY', 'FY (회계연도)'],
  ['SPY', 'SPY (S&P 500 ETF)'],
  ['XLK', 'XLK (기술 업종 ETF)'],
  ['BTC', '비트코인/암호화폐'],
  ['Markowitz', '평균-분산 분산투자 (Markowitz)'],
  ['EPS', 'EPS'],
  ['ETF', 'ETF'],
  // v58.80 first-users run-5 (newcomer): words met unmarked on 오늘 · 시장 상태 · 종목 · 포트폴리오.
  ['주도 영역', '주도 영역 (AI·반도체)'],
  ['주도주', '주도주(Leader)'],
  ['매도 소진', '매도 소진'],
  ['모멘텀', '모멘텀(Momentum)'],
  ['상대강도', '상대강도(RS)'],
  ['셋업', '셋업 (매매 셋업)'],
  ['피벗', '피벗 (피벗 가격)'],
  ['가이던스', '가이던스(Guidance)'],
  ['잉여현금흐름', '잉여현금흐름(FCF)'],
  ['FCF', '잉여현금흐름(FCF)'],
  ['듀폰', '듀폰 분해'],
  ['역 DCF', '역 DCF'],
  ['할인율', '할인율'],
  ['영구 성장률', '영구 성장률'],
  ['10-K', '10-K / 10-Q'],
  ['10-Q', '10-K / 10-Q'],
  ['13F', '13F (기관 보유 공시)'],
  ['SEC', 'SEC (미국 증권거래위원회)'],
  ['컨센서스', '컨센서스 (실적 전망치)'],
  ['허핀달', '허핀달 지수 (HHI)'],
  ['실질 종목 수', '실질 종목 수'],
  ['CAPM', 'CAPM (자본자산가격결정모형)'],
  ['VCP', 'VCP 패턴']
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
    if (!info) {
      // v58.80: a flex or grid parent turns each text run into its own box, so a mark there is a small standalone target,
      // not a word in a sentence (the 근거 line of 테마와 섹터 read 'ETF' as an 18 px button).
      const view = parent.ownerDocument?.defaultView;
      const display = typeof view?.getComputedStyle === 'function' ? view.getComputedStyle(parent).display : '';
      info = { prose: !parent.closest(SKIP) && !!parent.closest(PROSE) && !/flex|grid/.test(display), length: null, laidOut: null };
      parents.set(parent, info);
    }
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
    releasePopover(documentRef, closeQuiet);
    const mark = opener;
    opener = null;
    mark?.setAttribute('aria-expanded', 'false');
    if (restore && hadFocus && mark?.isConnected) mark.focus({ preventScroll: true });
  };
  const closeQuiet = () => close({ restore: false });
  const open = (mark, { focus = true } = {}) => {
    if (pop && opener === mark) return;
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
    claimPopover(documentRef, closeQuiet);
    const viewport = { width: root.innerWidth || 1024, height: root.innerHeight || 768 };
    // The width is fixed first so the measured height is the wrapped height the popover will really have.
    pop.style.width = `${Math.min(320, viewport.width - EDGE * 2)}px`;
    const place = placeTermPopover(mark.getBoundingClientRect(), { width: pop.offsetWidth || 320, height: pop.offsetHeight || 90 }, viewport);
    Object.assign(pop.style, { left: `${place.left}px`, top: `${place.top}px`, width: `${place.width}px` });
    pop.dataset.side = place.side;
    if (focus) more.focus({ preventScroll: true });
  };
  // v58.80 (first-users bundle 7): "hover does nothing; I had to click". A mouse resting on a term opens its popover
  // (without moving focus) and leaving both the term and the popover closes it; touch and keyboard keep tap/Enter.
  let hoverTimer = null;
  const onOver = (event) => {
    if (event.pointerType !== 'mouse' || hoverSuppressed(root)) return;
    const mark = event.target.closest?.('.aio-term');
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (mark) hoverTimer = setTimeout(() => { hoverTimer = null; open(mark, { focus: false }); }, 250);
    else if (pop && !pop.contains(event.target)) hoverTimer = setTimeout(() => { hoverTimer = null; if (!pop?.contains(documentRef.activeElement)) close({ restore: false }); }, 300);
  };
  const onClick = (event) => {
    const mark = event.target.closest?.('.aio-term');
    if (mark) { event.preventDefault(); open(mark); return; }
    if (pop && !pop.contains(event.target)) close();
  };
  const onKey = (event) => {
    if (event.key === 'Escape' && pop) { event.preventDefault(); close(); return; }
    const mark = (event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.aio-term');
    if (mark) { event.preventDefault(); open(mark); }
  };
  watchScroll(root);
  const observer = new MutationObserver(schedule);
  const content = documentRef.querySelector('.content') || documentRef.body;
  observer.observe(content, { childList: true, subtree: true, characterData: true });
  documentRef.addEventListener('click', onClick);
  documentRef.addEventListener('keydown', onKey);
  documentRef.addEventListener('pointerover', onOver);
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
    documentRef.removeEventListener('pointerover', onOver);
    if (hoverTimer) clearTimeout(hoverTimer);
    root.removeEventListener?.('scroll', onScroll);
    scroller?.removeEventListener('scroll', onScroll);
    documentRef.__aioTermMarks = false;
  };
}
