// P1425 (owner review 2026-10-03, 거시 screen rebuild): the economy is read from the official monthly
// releases the producer already publishes (BLS/BEA/FRED/Treasury in public-data/data.json `macro`),
// one card per indicator with its reference period, release date, next release and source. The page
// states observations only — the old storyline's fixed thresholds (10Y >= 4.4% = '금리 부담',
// SPY +/-0.6% = market tone) and the hand-written cycle timeline/thermometer are retired. The one
// comparison drawn is against a published target (the FOMC's 2% PCE inflation objective).

import { seriesOf, yoySeries } from './macro-read.js';

export const FED_PCE_TARGET = 2; // FOMC Statement on Longer-Run Goals: 2% on the PCE price index

const SOURCE_LABELS = Object.freeze({
  'bls-official-primary': 'BLS',
  'bea-official-primary': 'BEA',
  'fred-official-primary': 'FRED',
  'fred-official-public-csv': 'FRED',
  'us-treasury-official-primary': '미 재무부'
});

// Each indicator: data key, unit and how its producer delta reads (the change from the previous
// release of the same series), plus the official release calendar entry it belongs to.
export const MACRO_GROUPS = Object.freeze([
  Object.freeze({
    id: 'policy', title: '정책금리', items: Object.freeze([
      Object.freeze({ id: 'fedTarget', label: '연준 목표 범위', range: ['fedTargetLower', 'fedTargetUpper'], unit: '%', digits: 2, release: 'us-fomc', daily: true, note: 'FOMC가 정하는 연방기금금리 목표 범위입니다.' }),
      Object.freeze({ id: 'fedRate', history: { field: 'fedFunds', derive: 'level' }, key: 'fedRate', label: '실효 연방기금금리 (월평균)', unit: '%', digits: 2, deltaUnit: '%p', note: '은행 간 하루짜리 대출 금리의 월평균입니다.' })
    ])
  }),
  Object.freeze({
    id: 'inflation', title: '물가', items: Object.freeze([
      Object.freeze({ id: 'cpi', history: { field: 'cpiIndexNsa', derive: 'yoy' }, key: 'cpi', label: 'CPI (전년 대비)', unit: '%', digits: 1, deltaUnit: '%p', release: 'us-cpi', note: '소비자물가지수, 계절조정 전 공식 보도 기준입니다.' }),
      Object.freeze({ id: 'coreCpi', history: { field: 'coreCpiIndexNsa', derive: 'yoy' }, key: 'coreCpi', label: '근원 CPI (전년 대비)', unit: '%', digits: 1, deltaUnit: '%p', release: 'us-cpi', note: '식품·에너지를 뺀 CPI입니다.' }),
      Object.freeze({ id: 'pce', history: { field: 'pceIndex', derive: 'yoy' }, key: 'pce', label: 'PCE 물가 (전년 대비)', unit: '%', digits: 1, deltaUnit: '%p', release: 'us-pce', target: FED_PCE_TARGET, note: '연준 물가 목표(2%)가 기준으로 삼는 지표입니다.' }),
      Object.freeze({ id: 'corePce', history: { field: 'corePceIndex', derive: 'yoy' }, key: 'corePce', label: '근원 PCE (전년 대비)', unit: '%', digits: 1, deltaUnit: '%p', release: 'us-pce', target: FED_PCE_TARGET, note: '식품·에너지를 뺀 PCE 물가입니다.' })
    ])
  }),
  Object.freeze({
    id: 'labor', title: '고용', items: Object.freeze([
      Object.freeze({ id: 'unemployment', history: { field: 'unemployment', derive: 'level' }, key: 'unemployment', label: '실업률', unit: '%', digits: 1, deltaUnit: '%p', release: 'us-nfp', note: 'BLS 가계 조사 기준입니다.' }),
      Object.freeze({ id: 'nfp', history: { field: 'payrolls', derive: 'diff' }, key: 'nfp', label: '비농업 고용 증감', unit: '천 명', digits: 0, signed: true, priorPrint: true, release: 'us-nfp', note: '전월 대비 늘어난 일자리 수(BLS 사업체 조사)입니다.' }),
      Object.freeze({ id: 'usWageGrowth', history: { field: 'hourlyEarnings', derive: 'yoy' }, key: 'usWageGrowth', label: '시간당 임금 (전년 대비)', unit: '%', digits: 1, deltaUnit: '%p', release: 'us-nfp', note: '민간 부문 평균 시간당 임금 상승률입니다.' }),
      Object.freeze({ id: 'participation', key: 'blsLaborForceParticipation', blsSeries: 'laborForceParticipation', label: '경제활동참가율', unit: '%', digits: 1, release: 'us-nfp', note: '16세 이상 인구 중 일하거나 구직 중인 비율입니다.' })
    ])
  }),
  Object.freeze({
    id: 'activity', title: '소비 · 주택', items: Object.freeze([
      Object.freeze({ id: 'retailSales', history: { field: 'retailSales', derive: 'mom' }, key: 'retailSales', label: '소매판매 (전월 대비)', unit: '%', digits: 1, signed: true, release: 'us-retail', note: '미 인구조사국 소매판매 증감률입니다.' }),
      Object.freeze({ id: 'housingStarts', history: { field: 'housingStarts', derive: 'level', scale: 0.1 }, key: 'housingStarts', label: '주택 착공 (연율)', unit: '만 호', scale: 100, digits: 1, deltaUnit: '만 호', note: '착공된 신규 주택 수의 연간 환산치입니다.' })
    ])
  })
]);

function finite(value) {
  const number = Number(value);
  return value != null && value !== '' && Number.isFinite(number) ? number : null;
}

function isoDate(value) {
  const text = String(value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function monthDay(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

function signed(value, digits) {
  return `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(value).toFixed(digits)}`;
}

function sourceLabel(macro, key) {
  const raw = macro[`_source_${key}`] || macro[`_originSource_${key}`] || null;
  return raw ? SOURCE_LABELS[raw] || raw : null;
}

// The release that published a monthly reference period is the first official scheduled date after
// that month ends (CPI, jobs, PCE and retail sales all publish the following month). The registry's
// hand-kept lastRelease is not used: it names the latest release, which may cover a later month than
// the value on screen. BEA's own release timestamp wins for PCE when the producer recorded it.
function releaseInfo({ releases, schedules, id, asOf, daily, releasedAt }) {
  const entry = id ? releases?.[id] : null;
  const next = isoDate(entry?.nextRelease);
  if (daily || !asOf) return { last: null, next };
  if (isoDate(releasedAt)) return { last: isoDate(releasedAt), next };
  const [year, month] = asOf.split('-').map(Number);
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const dates = (Array.isArray(schedules?.[id]) ? schedules[id] : []).map(isoDate).filter(Boolean).sort();
  return { last: dates.find((date) => date > monthEnd) || null, next };
}

// P1426: the plotted 24-month series for one indicator, derived from the raw FRED observations.
function derivedSeries(macroHistory, spec) {
  if (!spec) return [];
  const raw = seriesOf(macroHistory, spec.field);
  const scale = spec.scale || 1;
  const rows = spec.derive === 'yoy' ? yoySeries(raw)
    : spec.derive === 'diff' ? raw.slice(1).map((row, index) => ({ date: row.date, value: row.value - raw[index].value }))
      : spec.derive === 'mom' ? raw.slice(1).map((row, index) => ({ date: row.date, value: raw[index].value ? (row.value / raw[index].value - 1) * 100 : null })).filter((row) => row.value != null)
        : raw.map((row) => ({ date: row.date, value: row.value * scale }));
  return rows.slice(-24);
}

function buildItem(macro, releases, schedules, item, macroHistory = null) {
  const keys = item.range || [item.key];
  const values = keys.map((key) => finite(macro[key]));
  const blsSeries = item.blsSeries ? macro._bls?.series?.[item.blsSeries] : null;
  const asOf = isoDate(macro[`_asOf_${keys[0]}`]) || isoDate(blsSeries?.observedAt) || null;
  const release = releaseInfo({ releases, schedules, id: item.release, asOf, daily: item.daily, releasedAt: item.release === 'us-pce' ? macro._bea?.releasedAt : null });
  const base = { id: item.id, label: item.label, note: item.note, unit: item.unit, release, asOf };
  if (values.some((value) => value == null)) return { ...base, status: 'missing', valueText: '—', deltaText: null, meta: '수집된 값이 없습니다.' };
  const freshness = macro[`_freshness_${keys[0]}`];
  const stale = freshness && freshness !== 'observed';
  const scale = item.scale || 1;
  const value = values[0] * scale;
  const valueText = item.range
    ? `${values[0].toFixed(item.digits)}–${values[1].toFixed(item.digits)}${item.unit}`
    : `${item.signed ? signed(value, item.digits) : value.toFixed(item.digits)}${item.unit}`;
  const rawDelta = finite(macro[`${keys[0]}Delta`]);
  const delta = rawDelta == null ? null : rawDelta * scale;
  let deltaText = null;
  if (item.priorPrint && delta != null) deltaText = `전월 ${signed(value - delta, item.digits)}${item.unit}`;
  else if (item.deltaUnit && delta != null && !item.range) deltaText = `전월 대비 ${signed(delta, item.digits)}${item.deltaUnit}`;
  const targetGap = item.target != null ? value - item.target : null;
  const period = !asOf ? null : item.daily ? `${monthDay(asOf)} 기준` : `${Number(asOf.slice(5, 7))}월분`;
  const meta = [period, release.last && !item.daily ? `${monthDay(release.last)} 발표` : null, release.next ? `다음 ${monthDay(release.next)}` : null, sourceLabel(macro, keys[0]) || (blsSeries ? 'BLS' : null)].filter(Boolean).join(' · ');
  return {
    ...base,
    status: stale ? 'stale' : 'observed',
    value,
    valueText,
    deltaText,
    targetText: targetGap == null ? null : `목표 2%보다 ${Math.abs(targetGap).toFixed(1)}%p ${targetGap >= 0 ? '높음' : '낮음'}`,
    ...trendOf(item, derivedSeries(macroHistory, item.history)),
    meta
  };
}

// Group headline: a plain sentence of what was observed (no favorable/burden label).
function groupFact(group, items) {
  const by = Object.fromEntries(items.map((item) => [item.id, item]));
  const ok = (id) => by[id]?.status !== 'missing' && by[id]?.value != null;
  if (group.id === 'policy') {
    if (!ok('fedTarget')) return '목표 범위 자료를 기다리는 중입니다.';
    return `목표 범위 ${by.fedTarget.valueText}${by.fedTarget.release.next ? ` · 다음 FOMC 결정 ${monthDay(by.fedTarget.release.next)}` : ''}`;
  }
  if (group.id === 'inflation') {
    if (!ok('pce') || !ok('corePce')) return ok('cpi') ? `CPI ${by.cpi.valueText} · PCE 물가 자료 대기` : '물가 자료를 기다리는 중입니다.';
    return `PCE ${by.pce.valueText} · 근원 PCE ${by.corePce.valueText} — 연준 목표 2% 대비 ${signed(by.pce.value - FED_PCE_TARGET, 1)}%p, ${signed(by.corePce.value - FED_PCE_TARGET, 1)}%p`;
  }
  if (group.id === 'labor') {
    if (!ok('unemployment')) return '고용 자료를 기다리는 중입니다.';
    return `실업률 ${by.unemployment.valueText}${by.unemployment.deltaText ? ` (${by.unemployment.deltaText})` : ''}${ok('nfp') ? ` · 일자리 ${by.nfp.valueText}${by.nfp.deltaText ? ` (${by.nfp.deltaText})` : ''}` : ''}`;
  }
  const shown = items.filter((item) => item.status !== 'missing');
  return shown.length ? shown.map((item) => `${item.label.replace(/ \(.*\)$/, '')} ${item.valueText}`).join(' · ') : '자료를 기다리는 중입니다.';
}

// One line on where the indicator came from: a year ago and six months ago, from its own series.
function trendOf(item, series) {
  if (series.length < 13) return { series, trendText: null, direction: null };
  const last = series[series.length - 1];
  const year = series[series.length - 13];
  const half = series[series.length - 7];
  const digits = item.digits ?? 1;
  const unit = item.unit === '%' ? '%' : item.unit;
  const fmt = (value) => `${item.signed ? signed(value, digits) : value.toFixed(digits)}${unit}`;
  // P1427: direction compares 3-month averages (latest vs six months earlier) so one noisy month does not flip it.
  const avg = (rows) => rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  const recent = avg(series.slice(-3));
  const earlier = avg(series.slice(-9, -6));
  const move = recent - earlier;
  const flat = Math.abs(move) < (item.unit === '%' ? 0.15 : Math.max(Math.abs(earlier) * 0.05, item.id === 'nfp' ? 25 : 0));
  return { series, trendText: `1년 전 ${fmt(year.value)} · 6개월 전 ${fmt(half.value)}`, direction: flat ? 'flat' : move > 0 ? 'up' : 'down' };
}

export function buildMacroBoard({ macro = null, releases = {}, schedules = {}, macroHistory = null } = {}) {
  if (!macro || typeof macro !== 'object') return { available: false, groups: [] };
  const groups = MACRO_GROUPS.map((group) => {
    const items = group.items.map((item) => buildItem(macro, releases, schedules, item, macroHistory));
    return { id: group.id, title: group.title, fact: groupFact(group, items), items };
  });
  const dates = groups.flatMap((group) => group.items.map((item) => item.asOf)).filter(Boolean).sort();
  return { available: groups.some((group) => group.items.some((item) => item.status !== 'missing')), latest: dates[dates.length - 1] || null, groups };
}
