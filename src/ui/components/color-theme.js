// P1604: theme changes update rendered charts without fetching data or resetting their viewport.
export function chartPalette(root) {
  const style = root.getComputedStyle(root.document.body);
  const value = (key, fallback) => style.getPropertyValue(key).trim() || fallback;
  return { text: value('--text-secondary', '#57513f'), grid: value('--border-subtle', '#e6e0d4'), up: value('--candle-up', '#d23f35'), down: value('--candle-down', '#2a64c8') }; // P1634: KR candle colors
}

export function installColorTheme(root, doc) {
  const update = () => {
    const palette = chartPalette(root);
    const Chart = root.Chart;
    if (Chart?.defaults) Chart.defaults.color = palette.text;
    for (const chart of Object.values(Chart?.instances || {})) {
      for (const scale of Object.values(chart.options?.scales || {})) {
        scale.ticks ||= {}; scale.ticks.color = palette.text;
        scale.grid ||= {}; scale.grid.color = palette.grid;
        scale.title ||= {}; scale.title.color = palette.text;
      }
      if (chart.options?.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = palette.text;
      chart.update('none');
    }
    root.__aioStockChartInstance?.applyTheme?.(palette);
  };
  doc.addEventListener('aio:colorThemeChanged', update);
  const script = doc.getElementById('aio-chart-cdn');
  script?.addEventListener('load', update);
  update();
  return () => { doc.removeEventListener('aio:colorThemeChanged', update); script?.removeEventListener('load', update); };
}
