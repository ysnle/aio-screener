// v58.55: the analysis cards (듀폰 · 역 DCF · R&D · 발생액) are drawn only on 종목 요약 and 재무 공시, so they load on first use
// instead of with the boot bundle (architecture/boot-budget.json). The first call starts one shared import and returns null;
// `onReady` repaints the caller once both modules are here. Later calls return the loaded modules synchronously.
let loaded = null;
let loading = null;

export function loadFundamentalAnalysis(onReady) {
  if (loaded) return loaded;
  if (!loading) {
    loading = Promise.all([import('./fundamental-analysis-cards.js'), import('../../domain/fundamental/analysis-read.js')])
      .then(([cards, read]) => { loaded = { ...read, ...cards }; return loaded; })
      .catch((error) => { loading = null; throw error; });
  }
  if (typeof onReady === 'function') loading.then(() => onReady(), () => {});
  return null;
}
