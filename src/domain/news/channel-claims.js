// A research channel's extracted fact as a line an AI may read: never the post's text (owner 2026-11-01), only the fact
// scripts/lib/telegram-signals.mjs extracted from it, in the app's own sentence (channel-lines.js signalLine), behind a tag
// that says what it is: an unverified claim relayed by a channel of a named kind, on a date. A model reads it as a lead
// to check against prices, an official document or a searched report, never as a cause on its own.
//
// Pure: the channel kind comes from telegram-digest.json `sourceCatalog` (channel -> role), passed in by the caller.
import { signalLine } from './channel-lines.js';

export const CHANNEL_KIND_LABELS = Object.freeze({
  'us-fast-breaking': '미국 속보 채널',
  'kr-semi-broker-notes': '국내 증권사 리포트 요약 채널',
  'china-em-supply-chain': '중화권 공급망 채널',
  'asia-semi-flow': '아시아 반도체 수급 채널'
});
export const CHANNEL_CLAIM_MARK = '[채널 주장 · 미확인';
const DEFAULT_KIND = '리서치 채널';
const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : '날짜 미상'; };

/** The channel's role ('us-fast-breaking', ...) for a signal's post id ("channel/123"), or null. */
export function channelRoleOf(post, catalog = []) {
  const channel = String(post || '').split('/')[0].toLowerCase();
  if (!channel) return null;
  const row = (Array.isArray(catalog) ? catalog : []).find((item) => String(item?.channel || '').toLowerCase() === channel);
  return row?.role || null;
}

/** "[채널 주장 · 미확인 · 미국 속보 채널 · 11/24]" — the tag every channel-derived line starts with. */
export function channelClaimTag({ role = null, date = null } = {}) {
  return `${CHANNEL_CLAIM_MARK} · ${CHANNEL_KIND_LABELS[role] || DEFAULT_KIND} · ${md(date)}]`;
}

export const isChannelClaimLine = (line) => String(line || '').includes(CHANNEL_CLAIM_MARK);

/** One digest signal as a tagged line, '' when the signal has no sentence form. */
export function channelClaimLine(signal, { catalog = [] } = {}) {
  const text = signalLine(signal);
  return text ? `${channelClaimTag({ role: channelRoleOf(signal?.post, catalog), date: signal?.date })} ${text}` : '';
}

/**
 * Tagged lines for a reading or a tool: the signals that name one of `subjects` (target prices, quarters, deals), and with
 * `market` the economic releases against forecast; only signals dated on or after `since` (YYYY-MM-DD), newest first.
 */
export function channelClaimLines(signals, { catalog = [], subjects = [], market = false, since = '', max = 8 } = {}) {
  const wanted = new Set((Array.isArray(subjects) ? subjects : []).map((sym) => String(sym || '').toUpperCase()).filter(Boolean));
  const names = (signal) => (Array.isArray(signal?.tickers) ? signal.tickers : [signal?.ticker, signal?.acquirer, signal?.target]).map((sym) => String(sym || '').toUpperCase());
  return (Array.isArray(signals) ? signals : [])
    .filter((signal) => signal?.kind && String(signal.date || '') >= since
      && ((signal.kind === 'macro' && market) || (signal.kind !== 'macro' && signal.kind !== 'retail' && names(signal).some((sym) => wanted.has(sym)))))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .map((signal) => channelClaimLine(signal, { catalog })).filter(Boolean).slice(0, max);
}
