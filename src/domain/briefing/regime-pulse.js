// Screen audit 2026-10-20: the top pulse bar showed the retired 0-100 swing score ("52 · 중립 · 신호 혼재") on every page while
// 시장 상태 read '부담 우세'. The bar shows that one verdict with its axis counts (js/aio-pages.js updateMarketPulse reads
// root._aioRegimePulse, src/app/bootstrap.js).
export function regimePulse(summary) {
  const overall = summary?.available && summary.overall ? summary.overall : null;
  if (!overall || overall === '판정 보류') return { value: '판정 보류', label: '종가 기록 대기', color: 'var(--text-muted)' };
  const counts = summary.counts || {};
  return {
    value: overall,
    label: `부담 ${counts.burden || 0}, 양호 ${counts.favorable || 0}${summary.asOf ? `, ${String(summary.asOf).slice(5).replace('-', '/')} 종가` : ''}`,
    color: /부담/.test(overall) ? 'var(--data-red)' : /양호/.test(overall) ? 'var(--data-green)' : 'var(--data-amber)'
  };
}
