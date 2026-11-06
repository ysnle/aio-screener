// v59.70 P3 (legacy core wave 2): js/aio-glossary.js (the GLOSSARY literals, about 114 KB) is no longer a boot script.
// Nothing reads GLOSSARY while the classic scripts evaluate: term marks, the glossary modal and the research shell read
// it when they run. It loads once the page is idle after boot, on the first glossary open, or right away for automated
// browsers (as the chat and the QA audits do). aio:glossaryReady tells the readers it has arrived.
const IDLE_TIMEOUT_MS = 3000;

// The glossary carries the same cachebuster as the static shell scripts (bump-version patches those).
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
  const soon = () => {
    if (typeof root.requestIdleCallback === 'function') root.requestIdleCallback(() => { load().catch(() => {}); }, { timeout: IDLE_TIMEOUT_MS });
    else root.setTimeout(() => { load().catch(() => {}); }, 1);
  };
  if (root.navigator?.webdriver) load().catch(() => {});
  else if (doc.readyState === 'complete') soon();
  else root.addEventListener('load', soon, { once: true });
  return load;
}
