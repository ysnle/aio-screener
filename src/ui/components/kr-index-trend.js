// v57.77: the 한국 차트·기술 분석 fold's KOSPI/KOSDAQ cards. They printed a Stage "N단계" with an invented
// "확도 NN%", a setup state and MACD/Bollinger boxes in English, from a live chart fetch. Each card now draws the
// index's completed KRX closes (the same close series the briefing and 시장 상태 read), says where the last close
// sits against its 50- and 200-day averages, and reads three lines of computed facts. No grade, no verdict.
import { buildCloseSeries, koreaRecordText, krSessionThrough, sessionPointBack, KR_SHOCK_TAIL_PCT } from '../../domain/briefing/market-read.js';
import { krIndexMoveRecord, KR_MONTH_SESSIONS } from '../../domain/market/kr-index-record.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { createTrendChart } from './trend-chart.js';
import { el } from './dom.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { signedText } from '../../domain/shared/number.js';

export const KR_INDEX_TRENDS = Object.freeze([
  Object.freeze({ field: 'kospi', label: '코스피', hostId: 'kr-kospi-tech-result' }),
  Object.freeze({ field: 'kosdaq', label: '코스닥', hostId: 'kr-kosdaq-tech-result' })
]);
const YEAR_SESSIONS = 252;

const mean = (series, n) => series.length >= n ? series.slice(-n).reduce((sum, point) => sum + point.value, 0) / n : null;
const level = (value) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const close = (value) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (value) => value == null ? '—' : `${signedText(value, 1)}%`;
const side = (value, average) => value > average ? '위' : value < average ? '아래' : '같은 자리';

/** Facts from one index's completed KRX closes; null when fewer than two closes exist. */
export function krIndexTrendFacts(history = [], field, { through = null, now = null } = {}) {
  const series = buildCloseSeries(history, field, { through });
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const change = (n) => {
    const from = sessionPointBack(series, n, 'KR')?.value ?? null;
    return from ? (last.value / from - 1) * 100 : null;
  };
  const ma50 = mean(series, 50);
  const ma200 = mean(series, 200);
  const window = series.slice(-YEAR_SESSIONS).map((point) => point.value);
  const high = Math.max(...window);
  const low = Math.min(...window);
  // v57.81: the same record as 시장 상태's KR card and the briefing (kr-index-record.js), on the same last close only.
  const record = now != null ? krIndexMoveRecord(history, field, { now }) : null;
  return {
    field, date: last.date, value: last.value, sessions: series.length, series,
    d1: change(1), d5: change(5), d20: change(KR_MONTH_SESSIONS), ma50, ma200, record: record?.date === last.date ? record : null,
    position50: ma50 == null ? null : side(last.value, ma50),
    position200: ma200 == null ? null : side(last.value, ma200),
    cross: ma50 != null && ma200 != null ? side(ma50, ma200) : null,
    rangeSessions: window.length, fullYear: window.length >= RULES.technical.fullYearSessions,
    high, low, fromHigh: (last.value / high - 1) * 100, fromLow: (last.value / low - 1) * 100
  };
}

/** "50일선 위 · 200일선 위"; an average without enough closes says so instead of guessing. */
export function krIndexPositionText(facts) {
  if (!facts) return '';
  const part = (days, position) => position ? `${days}일선 ${position}` : `${days}일선 계산 전`;
  return `${part(50, facts.position50)}, ${part(200, facts.position200)}`;
}

/** Three lines, each a computed fact: the move, the averages, the range. */
export function krIndexReading(facts, label) {
  if (!facts) return [];
  const rare = facts.record ? koreaRecordText(facts.record, { maxTail: KR_SHOCK_TAIL_PCT }) : '';
  const lines = [`${shortDate(facts.date)} ${label} 종가 ${close(facts.value)} — 하루 ${signed(facts.d1)}, 5거래일 ${signed(facts.d5)}, ${KR_MONTH_SESSIONS}거래일 ${signed(facts.d20)}${rare ? `. ${rare}입니다` : ''}.`];
  if (facts.ma50 != null && facts.ma200 != null) {
    lines.push(`종가는 50일선(${level(facts.ma50)}) ${facts.position50}, 200일선(${level(facts.ma200)}) ${facts.position200}에 있고, 50일선은 200일선보다 ${facts.cross}에 있습니다.`);
  } else if (facts.ma50 != null) {
    lines.push(`종가는 50일선(${level(facts.ma50)}) ${facts.position50}에 있습니다. 200일선은 종가 기록이 200거래일을 채우면 계산합니다(현재 ${facts.sessions}거래일).`);
  } else {
    lines.push(`이동평균은 종가 기록이 50거래일을 채우면 계산합니다(현재 ${facts.sessions}거래일).`);
  }
  const span = facts.fullYear ? '최근 1년' : `기록된 ${facts.rangeSessions}거래일`;
  lines.push(`${span} 고점 ${level(facts.high)} 대비 ${signed(facts.fromHigh)}, 저점 ${level(facts.low)} 대비 ${signed(facts.fromLow)}입니다.`);
  return lines;
}

function renderCard(doc, host, def, facts) {
  if (!facts) {
    // KOSDAQ is optional: a card without its close record stays out of the way instead of showing an empty frame.
    // (.trend-card sets display:flex, which a bare [hidden] attribute does not override.)
    host.style.display = def.field === 'kospi' ? '' : 'none';
    host.replaceChildren(el(doc, 'p', `${def.label} 한국 종가 기록을 불러오는 중입니다.`, 'trend-card-note'));
    return;
  }
  host.style.display = '';
  const head = el(doc, 'div', null, 'trend-card-head');
  head.append(el(doc, 'h3', def.label, 'trend-card-title'), el(doc, 'span', close(facts.value), 'trend-card-value'));
  // v58.53 개편 v2 (5n): the day's move under the value in the Korean convention (up red · down blue, color-theme.js tokens).
  if (facts.d1 != null) head.append(el(doc, 'span', `하루 ${signed(facts.d1)}`, `kr-index-move ${facts.d1 > 0 ? 'kr-up' : facts.d1 < 0 ? 'kr-down' : ''}`.trim()));
  const tags = el(doc, 'div', null, 'trend-card-tags');
  tags.append(el(doc, 'span', '한국', 'sx-chip sx-chip--sm kr-market-chip'), el(doc, 'span', `${shortDate(facts.date)} 한국 종가`, 'basis-chip'));
  const position = el(doc, 'div', krIndexPositionText(facts), 'trend-card-latest');
  position.dataset.krTrendPosition = facts.field;
  const chart = createTrendChart(doc, { series: facts.series.slice(-YEAR_SESSIONS), format: (value) => level(value), label: `${def.label} 종가` });
  const reading = el(doc, 'div', null, 'kr-index-reading');
  for (const line of krIndexReading(facts, def.label)) reading.append(el(doc, 'p', line, 'trend-card-note'));
  host.setAttribute('data-observed-at', facts.date);
  host.setAttribute('data-source-kind', 'completed-close-history');
  host.replaceChildren(head, tags, position, chart, reading);
}

// v58.75 (persona review): the 차트 screen is about the selected stock; the Korean market fold under it read as off-topic for a
// US listing. It opens when the subject becomes a KRX listing and closes to a one-line link for any other subject; between
// subject changes the reader's own open/close stands.
export const KR_FOLD_SUMMARY = Object.freeze({ kr: '한국 시장 — 코스피·코스닥 추세와 한국 종목 (한국 종가 기준)', other: '한국 시장 추세 보기 (코스피·코스닥)' });
export function syncKrTechnicalFold(doc, root) {
  const fold = doc?.getElementById?.('kr-integrated-technical');
  const summary = fold?.querySelector?.('summary');
  if (!fold || !summary) return null;
  const subject = String(root?._aioLastOpenedSymbol || '').toUpperCase();
  const kr = /\.K[SQ]$/.test(subject);
  const text = kr ? KR_FOLD_SUMMARY.kr : KR_FOLD_SUMMARY.other;
  if (summary.textContent !== text) summary.textContent = text;
  if (fold.dataset.krFoldSubject !== subject) { fold.dataset.krFoldSubject = subject; fold.open = kr; }
  return kr;
}

/** Draws both cards from root._aioHistory. Re-renders only when the last close or the record length changes. */
export function renderKrIndexTrends({ documentRef: doc, root, now = Date.now() } = {}) {
  syncKrTechnicalFold(doc, root);
  const history = Array.isArray(root?._aioHistory) ? root._aioHistory : [];
  const through = krSessionThrough(now);
  let drawn = 0;
  for (const def of KR_INDEX_TRENDS) {
    const host = doc?.getElementById?.(def.hostId);
    if (!host) continue;
    const facts = krIndexTrendFacts(history, def.field, { through, now });
    const key = facts ? `${facts.date}|${facts.value}|${facts.sessions}` : 'none';
    if (facts) drawn += 1;
    if (host.dataset.krTrendKey === key) continue;
    host.dataset.krTrendKey = key;
    renderCard(doc, host, def, facts);
  }
  return drawn;
}
