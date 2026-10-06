// P1397 (owner review 2026-10-03): the stock chart reads its own evidence onto the price — VCP
// contractions, the pivot, prior-day pivots and the 52-week high — and states a setup state
// instead of a letter grade (owner decision: no composite grade without predictive evidence).
// Methods are the published ones: Minervini's volatility contraction pattern and trend template,
// O'Neil's pivot/breakout-on-volume, Wilder's ADX, relative strength versus the S&P 500, and
// Raschke's prior-day high/low pivots. Nothing here is a buy or sell instruction.

function finite(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function sma(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    let sum = 0;
    for (let k = index + 1 - period; k <= index; k++) sum += values[k];
    return sum / period;
  });
}

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  values.forEach((value, index) => {
    if (index + 1 < period) { out.push(null); return; }
    if (prev == null) { prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period; out.push(prev); return; }
    prev = value * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

// Wilder's ADX(14).
export function adx(bars, period = 14) {
  if (bars.length < period * 2 + 1) return null;
  const tr = []; const plus = []; const minus = [];
  for (let i = 1; i < bars.length; i++) {
    const up = bars[i].high - bars[i - 1].high;
    const down = bars[i - 1].low - bars[i].low;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
    tr.push(Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close)));
  }
  const smooth = (arr) => { const out = []; let s = arr.slice(0, period).reduce((a, b) => a + b, 0); out.push(s); for (let i = period; i < arr.length; i++) { s = s - s / period + arr[i]; out.push(s); } return out; };
  const trS = smooth(tr); const pS = smooth(plus); const mS = smooth(minus);
  const dx = trS.map((t, i) => { const pdi = t ? (pS[i] / t) * 100 : 0; const mdi = t ? (mS[i] / t) * 100 : 0; return pdi + mdi ? (Math.abs(pdi - mdi) / (pdi + mdi)) * 100 : 0; });
  let value = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) value = (value * (period - 1) + dx[i]) / period;
  const lastT = trS[trS.length - 1];
  return { adx: value, plusDI: lastT ? (pS[pS.length - 1] / lastT) * 100 : null, minusDI: lastT ? (mS[mS.length - 1] / lastT) * 100 : null };
}

// Swing points: a bar whose high (low) is the extreme of `span` bars on each side.
function swings(bars, span) {
  const highs = []; const lows = [];
  for (let i = span; i < bars.length - span; i++) {
    let isHigh = true; let isLow = true;
    for (let k = i - span; k <= i + span; k++) {
      if (k === i) continue;
      if (bars[k].high >= bars[i].high) isHigh = false;
      if (bars[k].low <= bars[i].low) isLow = false;
    }
    if (isHigh) highs.push(i);
    if (isLow) lows.push(i);
  }
  return { highs, lows };
}

/**
 * Volatility contraction: from the highest high of the base, each pullback (swing high → next swing
 * low) must be shallower than the one before; the last one sets the pivot (its swing high).
 */
export function detectContractions(bars, { lookback = 130, span = 3 } = {}) {
  const start = Math.max(0, bars.length - lookback);
  const recent = bars.slice(start);
  if (recent.length < 30) return { contractions: [], valid: false, pivot: null };
  let baseIndex = 0;
  recent.forEach((bar, index) => { if (bar.high > recent[baseIndex].high) baseIndex = index; });
  const { highs, lows } = swings(recent, span);
  const contractions = [];
  let cursorHigh = baseIndex;
  for (let guard = 0; guard < 8; guard++) {
    const lowIndex = lows.find((index) => index > cursorHigh);
    if (lowIndex == null) break;
    const segment = recent.slice(cursorHigh, lowIndex + 1);
    const low = Math.min(...segment.map((bar) => bar.low));
    const depth = (recent[cursorHigh].high - low) / recent[cursorHigh].high * 100;
    contractions.push({ highIndex: start + cursorHigh, lowIndex: start + lowIndex, high: recent[cursorHigh].high, low, depth });
    const nextHigh = highs.find((index) => index > lowIndex);
    if (nextHigh == null) break;
    cursorHigh = nextHigh;
  }
  const all = contractions.filter((row) => row.depth >= 2);
  // The pattern is the latest run of successively shallower pullbacks (Minervini's 'T' count),
  // not the whole base: walk back from the last pullback while each earlier one was deeper.
  let startRun = all.length - 1;
  while (startRun > 0 && all[startRun - 1].depth >= all[startRun].depth * 0.9) startRun--;
  const meaningful = all.slice(Math.max(0, startRun));
  const valid = meaningful.length >= 2 && meaningful[meaningful.length - 1].depth <= 12 && meaningful[0].depth <= 40;
  const last = meaningful[meaningful.length - 1] || null;
  return { contractions: meaningful, valid, pivot: last ? last.high : null, baseHigh: recent[baseIndex].high };
}

const STATE_LABELS = Object.freeze({
  breakout: '돌파 — 피벗 위 거래량 동반', failed: '돌파 실패 — 피벗 아래로 복귀', setup: '셋업 형성 중 — 변동성 수축',
  extended: '피벗에서 멀어진 상승 — 추격 구간', downtrend: '하락 추세 — 셋업 해당 없음', none: '뚜렷한 셋업 없음'
});

/**
 * @param {Array<{time:string,open:number,high:number,low:number,close:number,volume:number}>} input
 * @param {{ benchmark?: Array<{date:string,value:number}> }} [options]
 */
export function analyzeChart(input = [], { benchmark = [] } = {}) {
  const bars = input.filter((bar) => [bar?.open, bar?.high, bar?.low, bar?.close].every((v) => finite(v) != null && v > 0));
  if (bars.length < 60) return { available: false, reason: 'bars-insufficient', bars };
  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => finite(bar.volume) || 0);
  const ema8 = ema(closes, 8);
  const ema21 = ema(closes, 21);
  const sma150 = sma(closes, 150);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const vol50 = sma(volumes, 50);
  const vol10 = sma(volumes, 10);
  const n = bars.length - 1;
  const last = bars[n];
  const prev = bars[n - 1];
  const vcp = detectContractions(bars);
  // P1428 (Codex review): fewer than 252 sessions is not a 52-week range; the label says how long it is.
  const fullYear = bars.length >= 252;
  const rangeLabel = fullYear ? '52주' : `최근 ${bars.length}거래일`;
  const high52 = Math.max(...bars.slice(-252).map((bar) => bar.high));
  const fromHigh = (last.close / high52 - 1) * 100;
  const volRatio = vol50[n] ? volumes[n] / vol50[n] : null;
  const dryUp = vol50[n] && vol10[n] ? vol10[n] / vol50[n] : null;
  const aligned = ema21[n] != null && sma50[n] != null && sma200[n] != null && last.close > ema21[n] && ema21[n] > sma50[n] && sma50[n] > sma200[n];
  // P1397 events (owner-supplied chart material 2026-10-03): descriptive chart events, not orders.
  const events = [];
  const from = Math.max(1, n - 80);
  const avg50 = (i) => vol50[i] || null;
  // (a) 8-day EMA lost / reclaimed — the short-term trend line most swing traders watch.
  for (let i = Math.max(from, 9); i <= n; i++) {
    if (ema8[i] == null || ema8[i - 1] == null) continue;
    if (closes[i - 1] >= ema8[i - 1] && closes[i] < ema8[i]) events.push({ index: i, kind: 'ema8-lost', text: '8일선 이탈', position: 'aboveBar', tone: 'burden' });
    else if (closes[i - 1] < ema8[i - 1] && closes[i] >= ema8[i]) events.push({ index: i, kind: 'ema8-reclaim', text: '8일선 회복', position: 'belowBar', tone: 'favorable' });
  }
  // (b) gap up on heavy volume (earnings/news gap; O'Neil/Minervini "power gap").
  for (let i = from; i <= n; i++) {
    const gap = (bars[i].open / bars[i - 1].close - 1) * 100;
    if (gap >= 4 && avg50(i) && volumes[i] >= 2 * avg50(i) && closes[i] > bars[i - 1].close) events.push({ index: i, kind: 'power-gap', text: `갭 +${gap.toFixed(1)}% (거래량 ${(volumes[i] / avg50(i)).toFixed(1)}배)`, position: 'belowBar', tone: 'favorable' });
  }
  // (c) Bollinger squeeze: 20-day band width at its lowest in six months.
  const sd20 = closes.map((_, i) => { if (i < 19) return null; const slice = closes.slice(i - 19, i + 1); const m = slice.reduce((a, b) => a + b, 0) / 20; return Math.sqrt(slice.reduce((a, b) => a + (b - m) ** 2, 0) / 20); });
  const sma20 = sma(closes, 20);
  const width = closes.map((_, i) => sd20[i] && sma20[i] ? (4 * sd20[i]) / sma20[i] : null);
  let squeezeOn = false;
  for (let i = Math.max(from, 145); i <= n; i++) {
    const past = width.slice(i - 125, i).filter((v) => v != null);
    const isLow = width[i] != null && past.length > 60 && width[i] <= Math.min(...past);
    if (isLow && !squeezeOn) events.push({ index: i, kind: 'squeeze', text: '변동성 압축', position: 'belowBar', tone: 'neutral' });
    squeezeOn = isLow;
  }
  // (d) extension above the 8-day EMA (overheating) — the latest stretch of >= 10%.
  const extension = ema8[n] ? (closes[n] / ema8[n] - 1) * 100 : null;
  for (let i = n; i >= from; i--) {
    if (ema8[i] && (closes[i] / ema8[i] - 1) * 100 >= 10) { events.push({ index: i, kind: 'extended', text: `과열 +${((closes[i] / ema8[i] - 1) * 100).toFixed(0)}%`, position: 'aboveBar', tone: 'burden' }); break; }
  }
  // Keep the chart legible: the latest two of each kind within ~4 months.
  const byKind = new Map();
  for (const event of events.sort((a, b) => b.index - a.index)) { const list = byKind.get(event.kind) || []; if (list.length < 2) list.push(event); byKind.set(event.kind, list); }
  const chartEvents = [...byKind.values()].flat().sort((a, b) => a.index - b.index);
  // Minervini trend template (8 published criteria; RS approximated by 6-month return vs the S&P 500).
  const low52 = Math.min(...bars.slice(-252).map((bar) => bar.low));
  const sma200Then = sma200[n - 21];
  const templateChecks = [
    // P1428: a check whose moving average is not yet computable is unknown (null), never 'unmet'.
    ['종가 > 150·200일선', sma150[n] == null || sma200[n] == null ? null : last.close > sma150[n] && last.close > sma200[n]],
    ['150일선 > 200일선', sma150[n] == null || sma200[n] == null ? null : sma150[n] > sma200[n]],
    ['200일선 1개월 이상 상승', sma200[n] == null || sma200Then == null ? null : sma200[n] > sma200Then],
    ['50일선 > 150·200일선', sma50[n] == null || sma150[n] == null || sma200[n] == null ? null : sma50[n] > sma150[n] && sma50[n] > sma200[n]],
    ['종가 > 50일선', sma50[n] == null ? null : last.close > sma50[n]],
    ['52주 저점 대비 +30% 이상', fullYear ? last.close >= low52 * 1.3 : null],
    ['52주 고점 대비 -25% 이내', fullYear ? last.close >= high52 * 0.75 : null],
    ['상대강도 (S&P 500 대비 6개월 우위)', null]
  ];
  // Buy/sell pressure: volume on up days versus down days over 20 sessions.
  let upVol = 0; let downVol = 0;
  for (let i = n - 19; i <= n; i++) { if (closes[i] > closes[i - 1]) upVol += volumes[i]; else if (closes[i] < closes[i - 1]) downVol += volumes[i]; }
  const pressure = downVol ? upVol / downVol : null;
  // Weekly trend from the last close of each ISO week, against 10- and 30-week averages.
  const weekly = [];
  bars.forEach((bar) => {
    const d = new Date(`${bar.time}T12:00:00Z`);
    const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (weekly.length && weekly[weekly.length - 1].key === key) weekly[weekly.length - 1].close = bar.close; else weekly.push({ key, close: bar.close });
  });
  const wCloses = weekly.map((row) => row.close);
  const w10 = sma(wCloses, 10); const w30 = sma(wCloses, 30);
  const wn = wCloses.length - 1;
  // P1435: Weinstein stage on this stock's own weekly closes (30-week average and its 4-week slope),
  // replacing the page's old SPY-only stage block.
  const w30Then = wn >= 4 ? w30[wn - 4] : null;
  const w30Long = wn >= 26 ? w30[wn - 26] : null;
  let weinstein = null;
  if (w30[wn] != null && w30Then != null) {
    const slope = (w30[wn] / w30Then - 1) * 100;
    const above = wCloses[wn] > w30[wn];
    const flat = Math.abs(slope) < 1;
    const stage = flat ? (w30Long != null && w30[wn] > w30Long ? 3 : 1) : slope > 0 ? (above ? 2 : 3) : (above ? 1 : 4);
    const reads = {
      1: '바닥 형성 — 30주선이 평평하거나 아직 내려가는 중이고, 가격이 그 주변에서 다지는 단계',
      2: '상승 추세 — 가격이 오르는 30주선 위에 있는 단계(추세 추종이 유효한 구간)',
      3: '천장 형성 — 오르던 30주선이 평평해지거나 가격이 그 아래로 내려오는 단계',
      4: '하락 추세 — 가격이 내려가는 30주선 아래에 있는 단계'
    };
    weinstein = { stage, slope, above, text: reads[stage] };
  }
  const weeklyTrend = w10[wn] == null || w30[wn] == null ? null : wCloses[wn] > w10[wn] && w10[wn] > w30[wn] ? '정배열' : wCloses[wn] < w10[wn] && w10[wn] < w30[wn] ? '역배열' : '혼조';
  // Relative strength: 6-month return minus the S&P 500's over the same dates.
  // P1428: each end of the comparison uses the benchmark close on or just before the stock's date (≤ 3 days);
  // a missing date is no comparison, not the benchmark's latest value.
  const benchRows = (benchmark || []).filter((point) => point?.date && Number.isFinite(point.value)).sort((a, b) => a.date.localeCompare(b.date));
  const benchAt = (date) => { let hit = null; for (const point of benchRows) { if (point.date <= date) hit = point; else break; } return hit && (Date.parse(date) - Date.parse(hit.date)) <= 3 * 86400000 ? hit.value : null; };
  const ago = bars[Math.max(0, n - 126)];
  const ret6 = (last.close / ago.close - 1) * 100;
  const b0 = benchAt(ago.time); const b1 = benchAt(last.time);
  const rs = b0 && b1 ? ret6 - (b1 / b0 - 1) * 100 : null;
  const strength = adx(bars);
  templateChecks[7][1] = rs == null ? null : rs > 0;
  const templatePass = templateChecks.filter(([, ok]) => ok === true).length;
  const lastContraction = vcp.contractions[vcp.contractions.length - 1] || null;
  // State.
  let state = 'none';
  const recent = bars.slice(-10);
  const pivot = vcp.pivot;
  const brokeOut = pivot != null && recent.some((bar, i) => bar.close > pivot && (i === 0 ? bars[n - 10].close : recent[i - 1].close) <= pivot);
  if (sma200[n] != null && (last.close < sma200[n] || (sma50[n] < sma200[n] && last.close < sma50[n]))) state = 'downtrend';
  else if (pivot != null && brokeOut && last.close < pivot) state = 'failed';
  // P1428 (Codex review): the heavy-volume day must itself close up and above the pivot — a heavy sell-off
  // below the pivot two days earlier is not breakout volume.
  else if (pivot != null && last.close > pivot && last.close <= pivot * 1.05 && [n - 2, n - 1, n].some((i) => i > 0 && vol50[i] && volumes[i] >= 1.4 * vol50[i] && bars[i].close > pivot && bars[i].close > bars[i - 1].close)) state = 'breakout';
  else if (pivot != null && last.close > pivot * 1.05) state = 'extended';
  else if (vcp.valid && pivot != null && last.close >= pivot * 0.92 && last.close <= pivot) state = 'setup';
  const fmt = (value, digits = 2) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signed = (value, digits = 1, unit = '%') => value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
  const evidence = [
    ['일봉 이동평균', aligned ? '정배열 (종가 > 21일 EMA > 50일 > 200일)' : ema21[n] && sma50[n] ? `혼조 (종가 ${last.close > sma50[n] ? '50일선 위' : '50일선 아래'})` : '기록 부족'],
    ['주봉 추세 (10·30주)', weeklyTrend || '기록 부족'],
    ['Weinstein 단계 (30주선)', weinstein ? `${weinstein.stage}단계 · 30주선 4주 ${weinstein.slope >= 0 ? '+' : ''}${weinstein.slope.toFixed(1)}%` : '기록 부족'],
    ['S&P 500 대비 6개월', rs == null ? '—' : `${signed(rs)}p (종목 ${signed(ret6)})`],
    ['추세 강도 ADX', strength ? `${fmt(strength.adx, 0)} ${strength.adx >= 25 ? '(추세 뚜렷)' : strength.adx < 20 ? '(추세 약함)' : '(보통)'}` : '—'],
    ['거래량 (50일 평균 대비)', volRatio == null ? '—' : `${fmt(volRatio * 100, 0)}%${dryUp != null ? ` · 10일 평균 ${fmt(dryUp * 100, 0)}%${dryUp < 0.8 ? ' (거래 감소)' : ''}` : ''}`],
    [`${rangeLabel} 고점 대비`, signed(fromHigh)],
    ['추세 템플릿 (미너비니)', `${templatePass}/8 충족${templateChecks.some(([, ok]) => ok === false) ? ` · 미충족: ${templateChecks.filter(([, ok]) => ok === false).map(([label]) => label).join(', ')}` : ''}${templateChecks.some(([, ok]) => ok == null) ? ` · 확인 불가 ${templateChecks.filter(([, ok]) => ok == null).length}개(기록 부족)` : ''}`],
    ['8일선 대비 거리', extension == null ? '—' : `${signed(extension)}${extension >= 10 ? ' (과열권)' : extension <= -5 ? ' (8일선 아래 이탈)' : ''}`],
    ['매수·매도 압력 (20일)', pressure == null ? '—' : `상승일/하락일 거래량 ${pressure.toFixed(2)}배 ${pressure >= 1.3 ? '(매수 우위)' : pressure <= 0.77 ? '(매도 우위)' : '(균형)'}`],
    ['변동성 수축 (VCP)', vcp.contractions.length ? `${vcp.contractions.map((row) => `-${row.depth.toFixed(1)}%`).join(' → ')}${vcp.valid ? '' : ' (수축 순서 불충분)'}` : '수축 구간 없음'],
    ['피벗 (마지막 수축 고점)', pivot == null ? '—' : `${fmt(pivot)} (현재가 대비 ${signed((pivot / last.close - 1) * 100)})`],
    ['무효화 가격 (마지막 수축 저점)', lastContraction ? `${fmt(lastContraction.low)} (현재가 대비 ${signed((lastContraction.low / last.close - 1) * 100)})` : '—'],
    ['전일 고가 / 저가', `${fmt(prev.high)} / ${fmt(prev.low)}`]
  ];
  return {
    available: true,
    asOf: last.time,
    last, prev,
    bars,
    lines: { ema8, ema21, sma50, sma200 },
    events: chartEvents,
    templateChecks,
    templatePass,
    weinstein,
    weeklyTrend,
    rs,
    ret6,
    pressure,
    dryUp,
    rangeLabel,
    fromHigh,
    extension,
    vcp,
    pivot,
    high52,
    state,
    stateLabel: STATE_LABELS[state],
    evidence,
    flip: state === 'setup' ? `피벗 ${fmt(pivot)} 위로 50일 평균의 1.4배 이상 거래량과 함께 마감하면 돌파` : state === 'breakout' ? `피벗 ${fmt(pivot)} 아래로 다시 마감하면 돌파 실패` : state === 'downtrend' ? '200일선 회복과 50일선 상향이 먼저 필요' : state === 'failed' ? `피벗 ${fmt(pivot)} 재돌파 전까지 관망 구간` : null
  };
}

// P1435: one connected reading of the chart — what state, why, what would change it, and how the market
// around it agrees — so the evidence list underneath is support, not the message.
export function chartReading(analysis, regime = null) {
  if (!analysis?.available) return null;
  const pct = (value, digits = 1) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
  const parts = [];
  const w = analysis.weinstein;
  if (w) parts.push(`주봉으로는 Weinstein ${w.stage}단계(${w.text.split(' — ')[0]})`);
  parts.push(`추세 템플릿 ${analysis.templatePass}/8`);
  if (analysis.rs != null) parts.push(`6개월 수익률이 S&P 500보다 ${Math.abs(analysis.rs).toFixed(1)}%p ${analysis.rs >= 0 ? '높음' : '낮음'}`);
  const why = parts.join(', ');
  const vcp = analysis.vcp?.contractions?.length ? `변동성 수축 ${analysis.vcp.contractions.map((row) => `-${row.depth.toFixed(0)}%`).join('→')}${analysis.dryUp != null && analysis.dryUp < 0.8 ? ', 거래량도 줄어드는 중' : ''}` : null;
  const state = {
    setup: `셋업이 만들어지는 중입니다 — ${vcp || '변동성 수축'}이고 피벗까지 ${analysis.pivot ? pct((analysis.pivot / analysis.last.close - 1) * 100) : '—'} 남았습니다`,
    breakout: '피벗을 거래량과 함께 넘었습니다 — 돌파 직후는 피벗 위에서 버티는지가 관건입니다',
    extended: `피벗에서 이미 ${analysis.pivot ? pct((analysis.last.close / analysis.pivot - 1) * 100) : '—'} 올라 추격 구간입니다 — 새 수축(쉬어 가기)을 기다리는 자리입니다`,
    failed: '돌파 뒤 피벗 아래로 되돌아왔습니다 — 실패한 돌파는 매물이 남아 있다는 뜻입니다',
    downtrend: '하락 추세라 셋업을 따지는 단계가 아닙니다 — 200일선 회복이 먼저입니다',
    none: `뚜렷한 셋업은 없습니다${vcp ? ` (${vcp})` : ''}`
  }[analysis.state];
  const market = regime?.available ? (regime.overall === '부담 우세' || regime.overall === '부담 쪽으로 기움'
    ? `시장 상태: ${regime.overall} — 시장 전체가 약할 때는 같은 셋업도 돌파가 이어지지 못하는 경우가 많습니다`
    : `시장 상태: ${regime.overall}`) : null;
  return { headline: state, why, market, flip: analysis.flip };
}
