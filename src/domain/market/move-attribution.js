// v59.42 (owner audit 2026-10-28): "every move explained three ways — the correlation, the news that came with it, and
// what to watch next". On 10/28 the KOSPI rose 6.6% and 오늘 said only '한국 고유 요인'. This names the largest index
// contributors (index weight × the screener's one-day return, same session only) and attaches each one's dated item:
// its event brief (the filing itself), else a Telegram post tagged with the exact symbol, else a headline that names the
// company by the shared keyword rule. A contribution is an arithmetic share of the index move, not a cause; the item is
// what was published around that session, not proof it moved the price.
import { keywordHit } from '../news/keyword-match.js';
import { MOVER_BY_SYMBOL } from '../briefing/market-movers.js';
import { withObjectParticle } from '../content/korean-particle.js';

const HOUR = 3600000;
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/** Weights as [{ sym, name, weightPct }] from the two published sources. */
export function krWeightRows(artifact, market = 'KOSPI') {
  const rows = artifact?.schemaVersion === 'kr-index-weights.v1' ? artifact.markets?.[market]?.rows : null;
  return Array.isArray(rows) ? rows.map((row) => ({ sym: `${row.code}.${market === 'KOSDAQ' ? 'KQ' : 'KS'}`, name: row.name, weightPct: Number(row.weightPct) })) : [];
}
export function sp500WeightRows(indexWeights) {
  const columns = Array.isArray(indexWeights?.columns) ? indexWeights.columns : [];
  const at = (name) => columns.indexOf(name);
  return (Array.isArray(indexWeights?.rows) ? indexWeights.rows : []).map((row) => Array.isArray(row)
    ? { sym: row[at('sym')], name: row[at('name')], weightPct: Number(row[at('weight')]) }
    : { sym: row?.sym, name: row?.name, weightPct: Number(row?.weight) }).filter((row) => row.sym && row.weightPct > 0);
}

/**
 * The names that moved the index most in its own direction.
 * @returns {{ sessionDate, items: Array<{ sym, name, weightPct, ret1d, contributionPp }>, explainedPp, indexChange, weightBasis } | null}
 */
export function indexContributors({ rows = [], weights = [], sessionDate, indexChange = null, top = 3, weightBasis = null } = {}) {
  if (!sessionDate || !weights.length) return null;
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const parts = [];
  for (const weight of weights) {
    const row = bySym.get(String(weight.sym).toUpperCase());
    const ret = Number(row?.ret1d);
    // Only the same session's return; an older row is not a contribution to this move.
    if (!row || !Number.isFinite(ret) || row.factorSessionDate !== sessionDate) continue;
    parts.push({ sym: row.sym, name: row.name || weight.name, weightPct: weight.weightPct, ret1d: ret, contributionPp: round((weight.weightPct * ret) / 100, 2) });
  }
  if (!parts.length) return null;
  const side = Number.isFinite(indexChange) && indexChange !== 0 ? Math.sign(indexChange) : Math.sign(parts.reduce((sum, part) => sum + part.contributionPp, 0)) || 1;
  const items = parts.filter((part) => Math.sign(part.contributionPp) === side).sort((a, b) => Math.abs(b.contributionPp) - Math.abs(a.contributionPp)).slice(0, top);
  if (!items.length) return null;
  return { sessionDate, items, explainedPp: round(items.reduce((sum, part) => sum + part.contributionPp, 0), 1), indexChange, weightBasis };
}

const kstDay = (ms) => new Date(ms + 9 * HOUR).toISOString().slice(0, 10);
const mdOf = (ms) => { const d = new Date(ms + 9 * HOUR); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
const clip = (text, max = 60) => { const t = String(text || '').replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };

function namesFor(sym, name) {
  const list = [...(MOVER_BY_SYMBOL[sym]?.newsNames || []), name].filter(Boolean).map(String);
  // Too-short names hit inside unrelated words or other companies; they are not used for headline matching.
  return [...new Set(list)].filter((value) => (/^[\x20-\x7e]+$/.test(value) ? value.trim().length >= 4 : value.length >= 3));
}

/**
 * One dated item for a contributor, published in [sessionCloseMs − 30 h, sessionCloseMs + 1 h].
 * @returns {{ kind: 'brief'|'telegram'|'news', text, atMs, url } | null}
 */
export function datedItemFor({ sym, name }, { sessionCloseMs, briefs = [], telegram = [], news = [] } = {}) {
  if (!Number.isFinite(sessionCloseMs)) return null;
  const inWindow = (ms) => Number.isFinite(ms) && ms >= sessionCloseMs - 30 * HOUR && ms <= sessionCloseMs + HOUR;
  const key = String(sym).toUpperCase();
  const brief = (briefs || []).find((item) => String(item?.symbol || '').toUpperCase() === key && inWindow(Date.parse(item.publishedAt)));
  if (brief) return { kind: 'brief', text: `${brief.period ? `${brief.period} ` : ''}실적 발표`, atMs: Date.parse(brief.publishedAt), url: brief.source?.url || null };
  const names = namesFor(sym, name);
  // A market wrap tags many symbols (and a tag can be wrong); a post counts for this name only when it is about it: at
  // most five tags and the name in its opening text.
  const post = (telegram || []).filter((item) => Array.isArray(item?.tickers) && item.tickers.map((t) => String(t).toUpperCase()).includes(key) && inWindow(Date.parse(item.datetime))
    && item.tickers.length <= 5 && names.some((value) => keywordHit(String(item.summary || '').slice(0, 120).toLowerCase(), value)))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0];
  const headline = (news || []).filter((item) => inWindow(Date.parse(item?.pubDate || item?.eventTime || '')) && names.some((value) => keywordHit(String(item.title || '').toLowerCase(), value)))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))[0];
  // A headline is preferred over a channel post when both exist (a named publisher over a summarised post).
  if (headline) return { kind: 'news', text: clip(headline.title), atMs: Date.parse(headline.pubDate || headline.eventTime), url: headline.link || null };
  if (post) return { kind: 'telegram', text: clip(post.summary), atMs: Date.parse(post.datetime), url: post.url || null };
  return null;
}

/** "SK하이닉스 +10.9%(기여 +2.5%p, 10/28 3분기 실적 발표)" pieces and the sentence that carries them. */
export function contributorsSentence(model, { indexName, sessionCloseMs, briefs, telegram, news } = {}) {
  if (!model?.items?.length) return null;
  const pieces = model.items.map((item) => {
    const dated = datedItemFor(item, { sessionCloseMs, briefs, telegram, news });
    const sign = (value) => `${value > 0 ? '+' : ''}${value}`;
    const datedText = dated ? `, ${mdOf(dated.atMs)} ${dated.kind === 'telegram' ? '채널 글 ' : ''}${dated.text}` : '';
    return { ...item, dated, text: `${item.name} ${sign(round(item.ret1d, 1))}%(기여 ${sign(round(item.contributionPp, Math.abs(item.contributionPp) < 0.5 ? 2 : 1))}%p${datedText})` };
  });
  const share = Number.isFinite(model.indexChange) && Math.abs(model.indexChange) >= 0.3
    ? ` — ${pieces.length}종목이 ${indexName} ${model.indexChange > 0 ? '+' : ''}${round(model.indexChange, 1)}% 중 ${Math.abs(model.explainedPp)}%p` : '';
  return { pieces, text: `${withObjectParticle(indexName)} 가장 많이 움직인 종목: ${pieces.map((piece) => piece.text).join(', ')}${share}.` };
}

export const sessionDateKst = kstDay;
