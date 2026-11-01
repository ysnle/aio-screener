// v59.56 (X bookmarks 11/01 pipeline review): the 10/30 reading explained Nasdaq 100 -3.46% and SMH -6.98% with one
// headline ("AI 수익성 회의론") while event-briefs.json already held the night's primary-source facts — Intel's Q4 revenue
// guidance $15.0–16.0B and its -28.6% first session, Amazon's quarter — and their reported reasons. Every author the owner
// bookmarked that night led with exactly those facts. The reading never read the briefs; this lane hands it the reports
// whose first sessions closed on the US close the reading is written from. Figures are the briefs' own (each passed the
// quote and source check in src/domain/briefing/event-briefs.js); reasons stay news-report and are attributed as such.
import { readFileSync } from 'node:fs';
import { readNumber } from '../../src/domain/shared/number.js';

export const EARNINGS_CONTEXT_MAX = 5;
export const EARNINGS_MENTION_PCT = 5; // a first-session move this large, or a market-cap leader, is offered
// Leaders whose report moves the index even on a small reaction (the after-hours lane uses S&P 500 weight; briefs carry none).
const LEADERS = new Set(['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'AVGO', 'TSLA', 'BRK-B', 'JPM', 'LLY', 'ORCL', 'NFLX', '005930.KS', '000660.KS']);
const FIGURE_ORDER = ['revenue', 'capex', 'free_cash_flow', 'operating_cash_flow', 'eps_diluted', 'margin'];

const md = (date) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || '')); return m ? `${Number(m[2])}/${Number(m[3])}` : ''; };
const signedPct = (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(1)}%`;
const clip = (text, max) => { const s = String(text || '').replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1)}…` : s; };

export function readEventBriefs(path = 'public-data/event-briefs.json') {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const rank = (brief, date) => (brief.reaction.firstDate === date ? 2 : 0) + (LEADERS.has(brief.symbol) ? 1 : 0);

/** The earnings briefs whose latest close is `usCloseDate`, within three sessions of the report, the close's own reports and leaders first. */
export function earningsContextRows(eventBriefs, usCloseDate, { max = EARNINGS_CONTEXT_MAX } = {}) {
  if (!usCloseDate) return [];
  const briefs = Array.isArray(eventBriefs?.briefs) ? eventBriefs.briefs : [];
  return briefs
    .filter((brief) => brief?.kind === 'earnings' && brief.symbol && brief.reaction?.basis === 'close'
      && brief.reaction.latestDate === usCloseDate && readNumber(brief.reaction.sessions) !== null && readNumber(brief.reaction.sessions) <= 3 && readNumber(brief.reaction.latestPct) !== null)
    .filter((brief) => Math.abs(Number(brief.reaction.latestPct)) >= EARNINGS_MENTION_PCT || LEADERS.has(brief.symbol))
    // The close's own reports first (first session = this close), a leader before a bigger move of a smaller name, then
    // the reports still moving a second or third session.
    .sort((a, b) => rank(b, usCloseDate) - rank(a, usCloseDate) || Math.abs(Number(b.reaction.latestPct)) - Math.abs(Number(a.reaction.latestPct)))
    .slice(0, max);
}

function figureText(brief) {
  const figures = Array.isArray(brief.figures) ? brief.figures : [];
  const picked = [];
  for (const metric of FIGURE_ORDER) {
    const figure = figures.find((row) => row?.metric === metric);
    if (!figure || picked.length >= 3) continue;
    const surprise = Number(figure.estimate?.surprisePct);
    picked.push(`${figure.label} ${figure.value}${Number.isFinite(surprise) && figure.estimate?.basis === 'provider-consensus-reference' ? `(시장 추정 대비 ${signedPct(surprise)})` : ''}`);
  }
  const guidance = (Array.isArray(brief.guidance) ? brief.guidance : []).slice(0, 2).map((row) => `${row.label} 전망 ${row.value}`);
  return [...picked, ...guidance].join(' · ');
}

/** Prompt lines: one per report — reaction on the close, primary-source figures and guidance, reported reasons. */
export function earningsContextLines(eventBriefs, usCloseDate, options = {}) {
  return earningsContextRows(eventBriefs, usCloseDate, options).map((brief) => {
    const r = brief.reaction;
    const sessionWord = Number(r.sessions) === 1 ? '발표 후 첫 거래일' : `발표 후 ${r.sessions}거래일 누적`;
    const reasons = (brief.reasons?.points || []).slice(0, 2).map((point) => clip(point.text, 110)).filter(Boolean);
    return `- ${brief.symbol}(${brief.nameKo || brief.symbol}) ${md(brief.eventDate)} 실적 → ${md(r.latestDate)} 종가 ${signedPct(Number(r.latestPct))}(${sessionWord})`
      + `${figureText(brief) ? ` · ${figureText(brief)}` : ''}${reasons.length ? ` · 보도된 이유: ${reasons.join(' / ')}` : ''}`;
  }).join('\n');
}

/** Reuse key: the reports offered and their whole-percent moves, so a new report or a crossed edge buys a new call. */
export function earningsContextSignature(eventBriefs, usCloseDate) {
  const rows = earningsContextRows(eventBriefs, usCloseDate);
  return rows.length ? `${usCloseDate}:${rows.map((brief) => `${brief.symbol}${Math.round(Number(brief.reaction.latestPct))}`).join(',')}` : '';
}
