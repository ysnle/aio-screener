// P1382: a headline-only earnings story ("Micron beats …") carries no numbers, and article
// bodies are not retained (rights). The Finnhub earnings calendar the producer already
// publishes supplies the structured context: estimate and, after the report, the actual.
const DAY = 86400000;

function money(value) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(2)}`;
}

function vsLine(label, actual, estimate, format) {
  const a = typeof actual === 'number' && Number.isFinite(actual) ? actual : null;
  const e = typeof estimate === 'number' && Number.isFinite(estimate) && estimate !== 0 ? estimate : null;
  if (a != null && e != null) {
    const surprise = (a - e) / Math.abs(e) * 100;
    return `${label} ${format(a)} (예상 ${format(e)} 대비 ${surprise >= 0 ? '+' : ''}${surprise.toFixed(1)}%)`;
  }
  if (a != null) return `${label} ${format(a)}`;
  if (e != null) return `${label} 예상 ${format(e)}`;
  return null;
}

export function earningsContextForHeadline(title, { earnings = [], names = {}, nowMs = Date.now(), windowDays = 3 } = {}) {
  const text = String(title || '');
  if (!text) return null;
  for (const row of Array.isArray(earnings) ? earnings : []) {
    const name = String(names[row?.symbol] || '');
    const token = name.split(/[\s,.]+/).find((part) => part.length >= 4);
    const escaped = token ? token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    if (!token || !new RegExp(`\\b${escaped}\\b`, 'i').test(text)) continue;
    const reportedMs = Date.parse(`${row.date}T12:00:00Z`);
    if (!Number.isFinite(reportedMs) || nowMs - reportedMs > windowDays * DAY || reportedMs - nowMs > DAY) continue;
    const parts = [vsLine('EPS', row.epsActual, row.epsEstimate, (v) => v.toFixed(2)), vsLine('매출', row.revenueActual, row.revenueEstimate, money)].filter(Boolean);
    if (!parts.length) continue;
    const when = `${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}${row.hour === 'amc' ? ' 장 마감 후' : row.hour === 'bmo' ? ' 장 시작 전' : ''}`;
    // P1428 (Codex review): the line names its company — a Nike earnings story tagged with an analyst's
    // firm ($MS) read as Morgan Stanley's results.
    return Object.freeze({ symbol: row.symbol, name, text: `${name} (${row.symbol}) 실적(${when}) · ${parts.join(' · ')}`, hasActual: typeof row.epsActual === 'number' || typeof row.revenueActual === 'number', source: 'Finnhub 실적 달력' });
  }
  return null;
}
