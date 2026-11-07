// Owner 2026-10-18 (data-pipeline review): the week's dominant stories — CoreWeave's bonds and default pricing, Anthropic's
// junk rating and IPO repricing, CXMT and the memory sell-off, deleveraging, the midterm and European-debt notes — were
// already in AIO's own artifacts: the Telegram research digest (four public channels, every refresh) and the screener's
// per-ticker headline memos. The market reading never saw them; it read only the top headlines of the 08:00 news bundle,
// which that weekend were oil and gold. This module turns those two artifacts into NARRATIVE_CONTEXT for the same model call
// and pairs each live theme with the analysis note (X-bookmark frames and earlier packets) that says how to read it.
//
// Boundary: everything here is secondary material (a relayed post or a headline title). It is context for which story to
// weigh, never a METRIC_EVIDENCE value, and a rumour or anonymous-source item is labelled as such on its own line.
import { readFileSync } from 'node:fs';
import { LESSONS } from '../../src/domain/knowledge/learning-core.js';
import { reportVerification } from '../../src/domain/news/report-verification.js';

// v59.70: the story registry and its detection live in src/domain/narrative/narratives.js, so the screens read the same
// stories the prompt does (market-day.json `narratives`); this module keeps the prompt text built from them.
import { NARRATIVE_WINDOW_HOURS, NARRATIVE_RECENT_HOURS, NARRATIVE_MAX_THEMES, NARRATIVE_MOVER_MIN_ABS_RET5D, NARRATIVE_THEMES, telegramPosts, moverMemos } from '../../src/domain/narrative/narratives.js';
export { NARRATIVE_WINDOW_HOURS, NARRATIVE_RECENT_HOURS, NARRATIVE_MAX_THEMES, NARRATIVE_MOVER_MIN_ABS_RET5D, NARRATIVE_THEMES };
export const NARRATIVE_SAMPLES_PER_THEME = 2;

// A rumour is named as one ("루머", "설"); an anonymous-source report is "미확인". Both stay labelled in the prompt.
// 2026-10-19: the rule is shared with the news bundle (src/domain/news/report-verification.js).
const CITED_RE = /블룸버그|Bloomberg|로이터|Reuters|파이낸셜\s?타임스|\bFT\b|WSJ|월스트리트저널|CNBC|폴리티코|Politico|The Information|닛케이|Nikkei|중국\s?언론|JP\s?모건|JPMorgan|모건\s?스탠리|Morgan Stanley|골드만|Goldman|BofA|노무라|Nomura|번스타인|Bernstein|씨티|\bCiti(?:group)?\b|도이체|Deutsche|KeyBanc|키뱅크|가트너|Gartner/gi;

export function narrativeVerification(text) {
  return reportVerification(text);
}

const kst = (ms) => {
  const d = new Date(ms + 9 * 3600000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} KST`;
};
const clip = (text, max) => {
  const value = String(text || '').replace(/\s+/g, ' ').replace(/^>+\s*/, '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

// v58.71 (owner 2026-10-23): the channels also relay numbers the reading never saw — economic releases against the
// forecast, analyst target-price and rating actions, reported quarters against estimates and the daily list of what
// Korean retail investors bought in US stocks (signals extracted by scripts/lib/telegram-signals.mjs). They join the
// context as one CHANNEL_DATA block: still secondary, still not METRIC_EVIDENCE.
const fmtNumber = (value) => (Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '?');
const kstDay = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
export function channelData(digest, { nowMs, windowHours }) {
  const signals = Array.isArray(digest?.signals) ? digest.signals : [];
  const since = kstDay(nowMs - windowHours * 3600000);
  const inWindow = (signal) => String(signal.date || '') >= since && String(signal.date || '') <= kstDay(nowMs);
  const lines = [];
  const releases = signals.filter((signal) => signal.kind === 'macro' && inWindow(signal));
  for (const release of releases.slice(0, 4)) {
    const side = release.actual > release.forecast ? '예상보다 높음' : release.actual < release.forecast ? '예상보다 낮음' : '예상과 같음';
    const unit = release.unit || '';
    lines.push(`   - [경제지표 ${release.date}] ${release.name}${release.nameEn ? ` (${release.nameEn})` : ''}: ${side} — 실제 ${fmtNumber(release.actual)}${unit} · 예상 ${fmtNumber(release.forecast)}${unit}${release.previous != null ? ` · 이전 ${fmtNumber(release.previous)}${unit}` : ''}`);
  }
  const retail = signals.filter((signal) => signal.kind === 'retail' && signal.side === 'buy').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const latestRetail = retail[0] && inWindow(retail[0]) ? retail[0] : null;
  if (latestRetail) {
    const prior = retail[1];
    lines.push(`   - [서학개미 순매수 ${latestRetail.date}] 상위 10종목 비중 ${latestRetail.top10Share}% · 레버리지 롱 상품 ${latestRetail.leveragedLongShare}%${prior ? ` (직전 ${prior.date} ${prior.leveragedLongShare}%)` : ''} · 1위 ${clip(latestRetail.top?.[0]?.name, 40)} — 개인 매수의 쏠림과 레버리지 비중을 보여 주는 자료`);
  }
  const actions = signals.filter((signal) => signal.kind === 'pt' && inWindow(signal));
  if (actions.length) {
    const count = (direction) => actions.filter((signal) => signal.direction === direction).length;
    const tally = new Map();
    for (const signal of actions.filter((item) => item.direction === 'raise')) tally.set(signal.ticker, (tally.get(signal.ticker) || 0) + 1);
    const crowded = [...tally].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([ticker, n]) => `${ticker} ${n}곳`);
    const rated = actions.filter((signal) => signal.ratingAction).slice(0, 6).map((signal) => `${signal.ticker} ${signal.ratingAction === 'upgrade' ? '상향' : '하향'}(${signal.broker || '증권사'})`);
    lines.push(`   - [애널리스트 ${since}~] 목표주가 상향 ${count('raise')}건 · 하향 ${count('cut')}건 · 신규 ${count('initiate')}건${crowded.length ? ` · 여러 곳이 올린 종목: ${crowded.join(', ')}` : ''}${rated.length ? ` · 투자의견 변경: ${rated.join(', ')}` : ''}`);
  }
  const reports = signals.filter((signal) => signal.kind === 'earnings' && inWindow(signal));
  if (reports.length) {
    const label = (signal) => signal.ticker || signal.name;
    const beat = reports.filter((signal) => [signal.revenue, signal.eps].includes('beat') && ![signal.revenue, signal.eps].includes('miss')).map(label);
    const miss = reports.filter((signal) => [signal.revenue, signal.eps].includes('miss')).map(label);
    lines.push(`   - [실적 ${since}~] 예상 상회 ${beat.length}곳${beat.length ? `(${beat.slice(0, 8).join(', ')})` : ''} · 예상 하회 포함 ${miss.length}곳${miss.length ? `(${miss.slice(0, 8).join(', ')})` : ''}`);
  }
  return {
    text: lines.length ? ['채널 데이터 (리서치 채널이 전한 수치 · 2차 자료 — 어느 주제에 무게를 둘지 고르는 참고이며 METRIC_EVIDENCE가 아니다):', ...lines].join('\n') : '',
    // A new release or a new retail list is worth a fresh reading; target-price counts move every refresh and are not.
    signature: [releases[0]?.key, latestRetail?.date].filter(Boolean).join(','),
    counts: { macro: releases.length, analystActions: actions.length, earnings: reports.length, retail: retail.filter(inWindow).length }
  };
}

const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
function frameLine(frameIds) {
  const frame = frameIds.map((id) => lessonById.get(id)).find((lesson) => lesson && Array.isArray(lesson.steps) && lesson.steps.length);
  if (!frame) return '';
  return `읽는 틀(분석 노트 「${frame.title}」): ${frame.steps.slice(0, 5).join(' → ')}${frame.counterclaim ? ` · 반론: ${clip(frame.counterclaim, 110)}` : ''}`;
}

/**
 * Narrative themes over the last NARRATIVE_WINDOW_HOURS from the Telegram digest and screener mover memos.
 * Returns { themes, text, signature, counts }; text is '' when nothing matched.
 */
export function buildNarrativeContext({ telegramDigest = null, screener = null, nowMs = Date.now(), windowHours = NARRATIVE_WINDOW_HOURS } = {}) {
  const posts = telegramPosts(telegramDigest, { nowMs, windowHours });
  const data = channelData(telegramDigest, { nowMs, windowHours });
  const movers = moverMemos(screener, { nowMs, windowHours });
  const recentSince = nowMs - NARRATIVE_RECENT_HOURS * 3600000;
  const themes = [];
  for (const theme of NARRATIVE_THEMES) {
    const tg = posts.filter((post) => theme.re.test(post.text));
    const tickers = movers.filter((row) => theme.re.test(row.text));
    if (!tg.length && !tickers.length) continue;
    const recent = tg.filter((post) => post.ts >= recentSince).length;
    // A matching mover is the market voting on the story; it weighs as much as two relayed posts.
    const weight = tg.length + recent + tickers.length * 2;
    const samples = [...tg].sort((a, b) => (b.ts >= recentSince) - (a.ts >= recentSince) || b.score - a.score || b.ts - a.ts).slice(0, NARRATIVE_SAMPLES_PER_THEME);
    themes.push({ id: theme.id, label: theme.promptLabel || theme.label, weight, telegramCount: tg.length, recentCount: recent, tickerCount: tickers.length,
      latestAt: new Date(Math.max(...tg.map((post) => post.ts), ...tickers.map((row) => row.ts))).toISOString(),
      samples: samples.map((post) => ({ channel: post.channel, at: new Date(post.ts).toISOString(), verification: narrativeVerification(post.text),
        cites: [...new Set((post.text.match(CITED_RE) || []).map((name) => name.trim()))].slice(0, 2), text: clip(post.text, 150) })),
      movers: tickers.slice(0, 3).map((row) => ({ sym: row.sym, direction: row.ret5d < 0 ? '5거래일 급락' : '5거래일 급등', verification: narrativeVerification(row.text), text: clip(row.headlines.find((line) => theme.re.test(line)) || row.headlines[0], 130) })),
      frame: frameLine(theme.frames) });
  }
  themes.sort((a, b) => b.weight - a.weight);
  const top = themes.slice(0, NARRATIVE_MAX_THEMES);
  const tag = (verification) => (verification === 'rumor' ? '[루머] ' : verification === 'unconfirmed' ? '[미확인·익명 소식통] ' : '');
  const lines = top.map((theme, index) => [
    `${index + 1}) ${theme.label} — 최근 ${windowHours}시간 리서치 채널 ${theme.telegramCount}건(24시간 ${theme.recentCount}건) · 급등락 종목 헤드라인 ${theme.tickerCount}건`,
    ...theme.samples.map((sample) => `   - ${tag(sample.verification)}[채널 ${sample.channel} ${kst(Date.parse(sample.at))}${sample.cites.length ? ` · 인용: ${sample.cites.join('·')}` : ''}] ${sample.text}`),
    ...theme.movers.map((row) => `   - ${tag(row.verification)}[종목 헤드라인 ${row.sym} · ${row.direction}] ${row.text}`),
    theme.frame ? `   ${theme.frame}` : ''
  ].filter(Boolean).join('\n'));
  return {
    themes: top,
    text: [...lines, data.text].filter(Boolean).join('\n'),
    // The reuse check compares the set of leading themes, not the counts (which move every refresh).
    // Order-insensitive and only the leading three, so a 4th/5th-place swap does not buy another model call.
    signature: top.slice(0, 3).map((theme) => theme.id).sort().join('|') + (data.signature ? `#${data.signature}` : ''),
    counts: { telegramPosts: posts.length, moverMemos: movers.length, themesMatched: themes.length, channelData: data.counts }
  };
}

// The producer reads the digest and screener the repository already holds: fetch-data runs before this refresh's Telegram
// step, so the digest is the previous run's (30 minutes old at most); the screener comes from its own workflow.
export function readNarrativeContext({ nowMs = Date.now(), telegramPath = 'public-data/telegram-digest.json', screenerPath = 'public-data/screener.json' } = {}) {
  const read = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch (_) { return null; } };
  try { return buildNarrativeContext({ telegramDigest: read(telegramPath), screener: read(screenerPath), nowMs }); }
  catch (error) { return { themes: [], text: '', signature: '', counts: { error: String(error?.message || error) } }; }
}
