// v59.62 (owner 2026-11-03: "QQQ 고점 대비 10% 이상 … SOXX 50일선 … 쌍봉 … 660을 지켜줘야"): where each index sits on
// its own chart, from the published closes (history.json) only. Every number is a rule over closes: the 50- and 200-session
// averages, the 252-session closing high, the lowest close of the last six months before the latest two weeks (the
// support the reading names), and a double top — two closing highs within 6% of each other at least 20 sessions apart
// with the close now at (within 3%) or below the lowest close between them (the neck). No level is written by hand and no ETF price is inferred from
// an index.
import { readNumber } from '../../shared/number.js';
import { withTopicParticle } from '../../content/korean-particle.js';
import { historyFieldMeta } from './history-meta.js';

export const LEVEL_FIELDS = Object.freeze([['ndx', '나스닥100'], ['soxx', '반도체(SOXX)'], ['spx', 'S&P 500']]);

const weekday = (date) => { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return day >= 1 && day <= 5; };
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const pct = (value, base) => (value / base - 1) * 100;

/**
 * One close per US session for `field`, keyed by the field's own session date: history rows are dated in KST, so the
 * 11/3 row carries the 11/2 US close (fieldMeta.<field>.sessionDate) and the 11/2 row still held the 10/30 one.
 */
export function sessionCloses(history, field) {
  const bySession = new Map();
  for (const row of Array.isArray(history) ? history : []) {
    const value = readNumber(row?.[field]);
    const session = historyFieldMeta(row, field)?.sessionDate || row?.date;
    if (!session || value === null || !weekday(session)) continue;
    bySession.set(session, { date: session, value });
  }
  return [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function doubleTop(closes) {
  const recent = closes.slice(-252);
  if (recent.length < 60) return null;
  const peakAt = recent.reduce((best, row, i) => (row.value > recent[best].value ? i : best), 0);
  // The other peak: the highest close at least 20 sessions from the first, within 6% of it.
  let other = -1;
  recent.forEach((row, i) => {
    if (Math.abs(i - peakAt) < 20 || row.value < recent[peakAt].value * 0.94) return;
    if (other < 0 || row.value > recent[other].value) other = i;
  });
  if (other < 0) return null;
  const [a, b] = [Math.min(peakAt, other), Math.max(peakAt, other)];
  const between = recent.slice(a + 1, b);
  if (!between.length) return null;
  const neck = between.reduce((low, row) => (row.value < low.value ? row : low));
  const last = recent.at(-1);
  const vsNeckPct = pct(last.value, neck.value);
  // Broken: closed at least 1% under the neck. Testing: within 3% above it (or less than 1% under) after falling from the second top.
  // v59.64: the second top must be recent (the last 60 sessions); an August pattern is not today's chart.
  if (b >= recent.length - 1 || b < recent.length - 60 || vsNeckPct > 3) return null;
  return { first: recent[a], second: recent[b], neck, vsNeckPct, state: vsNeckPct <= -1 ? 'broken' : 'testing' };
}

/** The chart position of one field, or null without 60 sessions. */
export function indexLevel(history, field) {
  const closes = sessionCloses(history, field);
  if (closes.length < 60) return null;
  const last = closes.at(-1);
  const avg = (n) => (closes.length >= n ? mean(closes.slice(-n).map((row) => row.value)) : null);
  const ma50 = avg(50); const ma200 = avg(200);
  const year = closes.slice(-252);
  const high = year.reduce((best, row) => (row.value > best.value ? row : best));
  const halfYear = closes.slice(-126, -10);
  const support = halfYear.length ? halfYear.reduce((low, row) => (row.value < low.value ? row : low)) : null;
  return {
    field, asOf: last.date, close: last.value, ma50, ma200,
    vsMa50Pct: ma50 ? pct(last.value, ma50) : null, vsMa200Pct: ma200 ? pct(last.value, ma200) : null,
    high, fromHighPct: pct(last.value, high.value),
    support: support && support.value < last.value ? { ...support, abovePct: pct(last.value, support.value) } : null,
    doubleTop: doubleTop(closes)
  };
}

export function indexLevels(history) {
  return LEVEL_FIELDS.map(([field, label]) => { const level = indexLevel(history, field); return level ? { ...level, label } : null; }).filter(Boolean);
}

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

/** "나스닥100 고점 대비 -10.3% · 50일선 -5.9%" for one level. */
export function levelValue(level) {
  return [`${level.label} 고점 대비 ${signed(level.fromHighPct)}`, level.vsMa50Pct != null ? `50일선 ${signed(level.vsMa50Pct)}` : null,
    level.vsMa200Pct != null ? `200일선 ${signed(level.vsMa200Pct)}` : null].filter(Boolean).join(', ');
}

/** The reading for the row: the phase of the lead index, its support, and a broken double top where one exists. */
export function levelsRead(levels) {
  const lead = levels.find((level) => level.field === 'ndx') || levels[0];
  if (!lead) return '';
  const phase = lead.fromHighPct <= -20 ? '약세장 기준(고점 대비 -20%)에 닿았습니다.'
    : lead.fromHighPct <= -10 ? '고점 대비 10% 넘게 내려 조정 구간입니다.'
      : lead.vsMa50Pct != null && lead.vsMa50Pct < 0 ? '50일선 아래로 내려와 단기 추세가 꺾였습니다.' : '고점 가까이에서 추세를 유지하고 있습니다.';
  const support = lead.support ? ` 최근 6개월 가장 낮은 종가는 ${md(lead.support.date)} ${Math.round(lead.support.value).toLocaleString('en-US')}로 지금보다 ${Math.abs(lead.support.abovePct).toFixed(1)}% 아래입니다. 그 아래로 내려가면 저점이 낮아지는 흐름이 됩니다.` : '';
  // The pattern line prefers a broken top, then the semiconductor index (the owner's question), then the others; a neck
  // that is the lead's own support is said once.
  const order = (level) => (level.doubleTop?.state === 'broken' ? 0 : level.field === 'soxx' ? 1 : 2);
  const top = levels.filter((level) => level.doubleTop).sort((a, b) => order(a) - order(b))[0];
  const t = top?.doubleTop;
  const neck = t ? `${md(t.first.date)}·${md(t.second.date)} 두 고점 사이 저점(${md(t.neck.date)} ${Math.round(t.neck.value).toLocaleString('en-US')})` : '';
  const pattern = !t ? '' : t.state === 'broken'
    ? ` ${withTopicParticle(top.label)} ${neck} 아래로 ${Math.abs(t.vsNeckPct).toFixed(1)}% 내려와 쌍봉이 완성된 모양입니다.`
    : ` ${withTopicParticle(top.label)} ${neck}${t.vsNeckPct >= 0 ? `보다 ${t.vsNeckPct.toFixed(1)}% 위` : ' 바로 아래'}에 있어, 이 저점을 지키는지가 쌍봉 완성 여부를 가릅니다.`;
  const semis = levels.find((level) => level.field === 'soxx');
  const weakSemis = semis && semis !== lead && semis.vsMa50Pct != null && lead.vsMa50Pct != null && semis.vsMa50Pct < lead.vsMa50Pct - 3
    ? ` ${withTopicParticle(semis.label)} 50일선보다 ${Math.abs(semis.vsMa50Pct).toFixed(1)}% 아래로 지수보다 훨씬 약합니다.` : '';
  const ownSupport = t && top === lead && lead.support && t.neck.date === lead.support.date;
  return `${withTopicParticle(lead.label)} ${phase}${ownSupport ? '' : support}${weakSemis}${pattern}`;
}
