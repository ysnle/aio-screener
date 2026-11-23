export function regimePulse(summary) {
  const overall = summary?.available && summary.overall ? summary.overall : null;
  if (!overall || overall === '판정 보류') return { value: '판정 보류', label: '종가 기록 대기', color: 'var(--color-text-secondary)' };
  const counts = summary.counts && typeof summary.counts === 'object' ? summary.counts : null;
  const count = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const asOf = summary.asOf ? `${String(summary.asOf).slice(5).replace('-', '/')} 종가` : '';
  return {
    value: overall,
    label: counts ? `부담 ${count(counts.burden)}, 양호 ${count(counts.favorable)}${asOf ? `, ${asOf}` : ''}` : asOf || '축 개수 미확인',
    color: /부담/.test(overall) ? 'var(--color-text-error)' : /양호/.test(overall) ? 'var(--color-text-success)' : 'var(--color-text-warning)'
  };
}
