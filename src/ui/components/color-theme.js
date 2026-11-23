export function chartPalette(root) {
  const style = root.getComputedStyle(root.document.body);
  const value = (key, fallback) => style.getPropertyValue(key).trim() || fallback;
  return { text: value('--text-secondary', '#544f46'), grid: value('--border-subtle', '#e8e2d9'), up: value('--candle-up', '#dc3e42'), down: value('--candle-down', '#2870bd') };
}

export function installColorTheme(root, doc) {
  const update = () => {
    root.__aioStockChartInstance?.applyTheme?.(chartPalette(root));
  };
  doc.addEventListener('aio:colorThemeChanged', update);
  update();
  return () => { doc.removeEventListener('aio:colorThemeChanged', update); };
}
