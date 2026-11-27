// The one extracted fact a news card carries, joined from facts the pipeline already extracted — never read off the
// headline. Sources, first match wins:
//   1. the company's own release brief (event-briefs.json) for an issuer the card names, published within a day and a
//      half of the article — 수치 when the brief kept figures, 보도 when it kept only its headline;
//   2. the earnings calendar's estimate/actual line the page matched to the headline — 수치;
//   3. the moves the market-day ledger links the article to by subject or member, or the stock move of the one issuer
//      the card names (news-story-link.js) — 수치;
//   4. the issuer's next report inside the next ten US sessions (earnings-calendar.json) — 일정.
// No join, no line.
import { newsStoryLinks } from '../briefing/news-story-link.js';
import { koreanReleaseText, latestBriefFor, provisionalWaiting } from '../briefing/event-briefs.js';
import { LEADER_EARNINGS_SESSIONS, nextEarnings, whenText } from '../briefing/leader-earnings.js';
import { shortDate } from '../content/date-labels.js';

export const ARTICLE_FACT_KINDS = Object.freeze({ report: '보도', figure: '수치', schedule: '일정' });
const HOUR = 3600000;
const BRIEF_REACH_MS = 36 * HOUR;

const publishedMs = (item) => Date.parse(item?.pubDate || item?.publishedAt || item?.eventTime || '') || null;

/**
 * `(item, { issuers, earningsText }) => { kind, text, source } | null` over one set of published artifacts.
 * `issuers` are the card's resolved symbols; `earningsText` is the calendar line the page already matched to the title.
 */
export function articleFactReader({ day = null, briefs = null, calendar = null, nowMs = Date.now() } = {}) {
  const movesOf = newsStoryLinks(day);
  return (item, { issuers = [], earningsText = '' } = {}) => {
    if (!item) return null;
    const symbols = [...new Set((Array.isArray(issuers) ? issuers : []).map((symbol) => String(symbol || '').trim().toUpperCase()).filter((symbol) => /^[A-Z0-9][A-Z0-9.^=-]{0,11}$/.test(symbol)))];
    const at = publishedMs(item);
    if (briefs && at) {
      for (const symbol of symbols) {
        // The latest brief published before the article's next day and at most a day and a half before it.
        const brief = latestBriefFor(briefs, symbol, { nowMs: Math.min(nowMs, at + BRIEF_REACH_MS - HOUR), days: (2 * BRIEF_REACH_MS) / (24 * HOUR) });
        const published = Date.parse(brief?.publishedAt || brief?.eventDate || '');
        if (!brief?.headline || provisionalWaiting(brief) || !Number.isFinite(published) || Math.abs(published - at) > BRIEF_REACH_MS) continue;
        const kind = Array.isArray(brief.figures) && brief.figures.length ? ARTICLE_FACT_KINDS.figure : ARTICLE_FACT_KINDS.report;
        return { kind, text: koreanReleaseText(brief.headline), source: 'brief' };
      }
    }
    if (earningsText) return { kind: ARTICLE_FACT_KINDS.figure, text: String(earningsText), source: 'earnings' };
    const tie = movesOf(item, { issuers: symbols });
    if (tie?.moves?.length) {
      // The moves are a session's closes, the article may be a day later: the line carries the session when the moves share one.
      const sessions = [...new Set(tie.moves.map((move) => move.said.claims?.[0]?.asOf).filter(Boolean))];
      const when = sessions.length === 1 ? `${shortDate(sessions[0])} ` : '';
      return { kind: ARTICLE_FACT_KINDS.figure, text: `관련 움직임 ${when}${tie.moves.map((move) => move.said.text).join(' · ')}`, source: 'ledger' };
    }
    if (calendar) {
      for (const symbol of symbols) {
        const next = nextEarnings(calendar, symbol, { nowMs, sessions: LEADER_EARNINGS_SESSIONS });
        if (next) return { kind: ARTICLE_FACT_KINDS.schedule, text: `${symbol} 실적 발표 ${whenText(next)}`, source: 'calendar' };
      }
    }
    return null;
  };
}
