// P1445 (review 2026-10-04): the legacy exposure and stress panels summed native price × quantity, so
// $1,000 and ₩1,000,000 at ₩1,000/$ read 0.1 : 99.9 instead of 50 : 50, and unpriced holdings silently
// left the denominator. They now read the native surface's base-currency values (P1407), refuse an
// unconverted currency mix, and report how many holdings were left out.
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
  return { blocked: false, rows: valued, excluded: rows.length - valued.length, currency: surface?.baseCurrency || null };
}

export function baseValueNote(base) {
  if (base?.blocked) return '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">통화가 다른 종목이 섞여 있고 환율이 선언되지 않아 비중·스트레스를 계산하지 않습니다.</div>';
  return base?.excluded ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">평가액이 없는 ${base.excluded}종목은 비중 계산에서 제외했습니다(0으로 보지 않음).</div>` : '';
}
