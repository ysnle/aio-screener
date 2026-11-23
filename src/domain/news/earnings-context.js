import { signedText, usdKoreanText, surprisePct } from '../shared/number.js';
const DAY = 86400000;

function money(value) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return usdKoreanText(value);
  return `$${value.toFixed(2)}`;
}

function vsLine(label, actual, estimate, format) {
  const a = typeof actual === 'number' && Number.isFinite(actual) ? actual : null;
  const e = typeof estimate === 'number' && Number.isFinite(estimate) && estimate !== 0 ? estimate : null;
  if (a != null && e != null) {
    const surprise = surprisePct(a, e);
    return `${label} ${format(a)} (예상 ${format(e)} 대비 ${signedText(surprise, 1)}%)`;
  }
  if (a != null) return `${label} ${format(a)}`;
  if (e != null) return `${label} 예상 ${format(e)}`;
  return null;
}

const LEGAL_SUFFIX = /\b(?:Inc|Incorporated|Corp|Corporation|Co|Company|Ltd|Limited|plc|Holdings|Group|N\.?V|S\.?A|AG|SE)\b\.?/gi;
const GENERIC_FIRST = /^(?:bank|first|general|american|united|international|global|national|new|digital|energy|health|capital|financial|technology|technologies|systems|industries|motors|group|royal|china|south|north|west|east)$/i;
const EARNINGS_WORDS = /earnings|results|quarter|beats?|miss(?:es)?|revenue|profit|EPS|guidance|outlook|실적|분기|매출|순이익|영업이익|가이던스/i;
const ANALYST_ACTION = /\b(?:raises?|lifts?|cuts?|lowers?|upgrades?|downgrades?|reiterates?|initiates?|boosts?|trims?)\b[^.]*\b(?:target|rating|price objective|outlook on)\b|목표\s?(?:주)?가/i;
export function earningsContextForHeadline(title, { earnings = [], names = {}, nowMs = Date.now(), windowDays = 3 } = {}) {
  const text = String(title || '');
  if (!text) return null;
  if (!EARNINGS_WORDS.test(text) || ANALYST_ACTION.test(text)) return null;
  const found = [];
  for (const row of Array.isArray(earnings) ? earnings : []) {
    const name = String(names[row?.symbol] || '');
    const core = name.replace(LEGAL_SUFFIX, ' ').replace(/[\s,.]+$/, '').replace(/\s+/g, ' ').trim();
    const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const symbol = String(row?.symbol || '');
    const first = core.split(' ')[0];
    const short = core.includes(' ') && first.length >= 4 && !GENERIC_FIRST.test(first) ? first : null;
    const positions = [core, short].filter((value) => value && value.length >= 3)
      .map((value) => text.search(new RegExp(`(^|[^A-Za-z])${escape(value)}([^A-Za-z]|$)`, 'i')))
      .concat(symbol ? [text.search(new RegExp(`(\\$${escape(symbol)}\\b|\\(${escape(symbol)}\\))`))] : [])
      .filter((at) => at >= 0);
    if (!positions.length) continue;
    const reportedMs = Date.parse(`${row.date}T12:00:00Z`);
    if (!Number.isFinite(reportedMs) || nowMs - reportedMs > windowDays * DAY || reportedMs - nowMs > DAY) continue;
    const parts = [vsLine('EPS', row.epsActual, row.epsEstimate, (v) => v.toFixed(2)), vsLine('매출', row.revenueActual, row.revenueEstimate, money)].filter(Boolean);
    if (!parts.length) continue;
    const when = `${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}${row.hour === 'amc' ? ' 장 마감 후' : row.hour === 'bmo' ? ' 장 시작 전' : ''}`;
    if (found.some((hit) => hit.symbol === row.symbol)) continue;
    found.push({ at: Math.min(...positions), symbol: row.symbol, name, line: `${name} (${row.symbol}) 실적(${when}), ${parts.join(', ')}`, hasActual: typeof row.epsActual === 'number' || typeof row.revenueActual === 'number' });
  }
  if (!found.length) return null;
  const hits = found.sort((a, b) => a.at - b.at).slice(0, 3);
  return Object.freeze({ symbol: hits[0].symbol, symbols: Object.freeze(hits.map((hit) => hit.symbol)), name: hits[0].name, text: hits.map((hit) => hit.line).join(' · '), hasActual: hits.some((hit) => hit.hasActual), source: 'Finnhub 실적 달력' });
}
