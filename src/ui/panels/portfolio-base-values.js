export function baseValueRows(surface, positions = []) {
  const list = Array.isArray(positions) ? positions : [];
  if (surface && surface.currencyState === 'mixed-without-conversion') return { blocked: true, rows: [], excluded: list.length };
  const byTicker = new Map();
  for (const row of Array.isArray(surface?.rows) ? surface.rows : []) {
    const key = String(row?.symbol || row?.ticker || '').toUpperCase();
    const value = Number(row?.value);
    if (key && Number.isFinite(value) && value > 0) byTicker.set(key, value);
  }
  const rows = list.map((position) => ({ sym: position.ticker, value: byTicker.get(String(position.ticker || '').toUpperCase()) ?? null }));
  const valued = rows.filter((row) => row.value != null);
  return { blocked: false, rows: valued, excluded: rows.length - valued.length, currency: surface?.valuationCurrency || null };
}

export function baseValueNote(base) {
  if (base?.blocked) return '<div class="pfp-base-blocked">통화가 다른 종목이 섞여 있고 환율이 선언되지 않아 비중·스트레스를 계산하지 않습니다.</div>';
  return base?.excluded ? `<div class="pfp-base-excluded">평가액이 없는 ${base.excluded}종목은 비중 계산에서 제외했습니다(0으로 보지 않음).</div>` : '';
}
