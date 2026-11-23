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
