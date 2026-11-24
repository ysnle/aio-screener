// The glossary carries the same cachebuster as the static shell scripts (bump-version patches those).
// P3 (legacy core wave 2): js/aio-glossary.js (the GLOSSARY literals, about 114 KB) is no longer a boot script.
// Nothing reads GLOSSARY while the classic scripts evaluate: term marks, the glossary modal and the research shell read
// it when they run. It loads when a reader asks for it: a pointer or focus on a 용어 사전 button or a term mark, the
// glossary modal, the command search or the research search; automated test browsers load it at once (as the chat and
// the QA audits do). Term marks do not wait for it: they mark the fixed TERM_MARKS list, every target of which names a
// real entry (pipeline-semantics RUN6-TERM-01). aio:glossaryReady tells the readers it has arrived.

function scriptVersion(doc) {
  const src = doc.querySelector?.('script[src*="aio-core.js"]')?.getAttribute('src') || '';
  const match = /[?&]v=([\d.]+)/.exec(src);
  return match ? match[1] : String(Date.now());
}

export function installGlossaryLoader(root = globalThis, doc = root.document) {
  root.AIO = root.AIO || {};
  if (!doc || typeof root.AIO.loadGlossary === 'function') return root.AIO.loadGlossary || null;
  let pending = Array.isArray(root.GLOSSARY) ? Promise.resolve(true) : null;
  const ready = () => {
    let merged;
    try { merged = root._aioGlossaryAugment?.(); } catch (_) { /* the screen-term merge is optional; the entries still show */ }
    return Promise.resolve(merged).catch(() => {}).then(() => {
      try { doc.dispatchEvent(new CustomEvent('aio:glossaryReady')); } catch (_) { /* no reader listening */ }
    });
  };
  const load = () => pending || (pending = new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = './js/aio-glossary.js?v=' + scriptVersion(doc);
    script.onload = () => { ready().then(() => resolve(true)); };
    script.onerror = () => { pending = null; reject(new Error('aio-glossary.js 로드 실패')); };
    doc.head.appendChild(script);
  }));
  root.AIO.loadGlossary = load;
  // v59.70 (post-boot budget): real glossary use (the modal, a search, a term mark) also brings the remaining screen terms.
  root.AIO.loadGlossaryFull = () => load().then(() => root._aioGlossaryFull?.());
  // Pointing at or focusing a 용어 사전 button or a term mark starts that load, so the first open does not wait for it.
  const intent = (event) => {
    if (!event.target?.closest?.('[data-action="openGlossary"], .aio-term')) return;
    doc.removeEventListener('pointerover', intent, true); doc.removeEventListener('focusin', intent, true);
    root.AIO.loadGlossaryFull().catch(() => {});
  };
  doc.addEventListener('pointerover', intent, true);
  doc.addEventListener('focusin', intent, true);
  // scripts/ci-boot-interaction-check.mjs sets __aioUserBoot to measure the boot a reader gets.
  if (root.navigator?.webdriver && !root.__aioUserBoot) load().catch(() => {});
  return load;
}
