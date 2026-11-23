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
