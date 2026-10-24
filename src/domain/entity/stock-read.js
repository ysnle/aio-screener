// P1434 (종목 요약 redesign, owner direction 2026-10-04): the summary tab answers "what state is this
// stock in, and why" in one connected reading — trend, where it sits in its 52-week range, how it did
// against the S&P 500, its sector's rotation and the market it trades in — each tied to the next.
// Pure: every input is the published screener row, the SPY row of the same artifact, the sector /
// theme rotation items and the market regime. A missing input drops its sentence; nothing is guessed.
import { withTopicParticle } from '../content/korean-particle.js';
import { EXTENSION_BANDS } from '../screener/setup-profile.js';
import { RULES } from '../rules/thresholds.js';
import { NEAR_LINE_ADR, bufferedTrend, extensionBand } from '../technical/bands.js';
import { rrgRecentReading, relativeBand, signedPct } from '../themes/recent-check.js';
import { RRG_QUADRANT_READS, RRG_QUADRANT_WORDS } from '../themes/rrg.js';
import { extensionMultiple } from '../technical/definitions.js';
import { secFilingUrl } from '../fundamental/sec-report.js';

// N20 (2026-10-13): the issuer's own recent filings, from the annual-facts record's submissions snapshot (8-K with
// Item numbers, 10-Q, 10-K). Labels name what the filing is; nothing is read from the filing text.
const FORM_LABEL = Object.freeze({ '10-K': '연간 보고서', '10-Q': '분기 보고서', '8-K': '수시 공시' });
const ITEM_LABEL = Object.freeze({
  '1.01': '중요 계약 체결', '1.02': '중요 계약 종료', '1.03': '파산·회생', '1.05': '사이버보안 사고',
  '2.01': '인수·처분 완료', '2.02': '실적 발표', '2.03': '채무 발생', '2.04': '채무 조기상환 사유', '2.05': '구조조정 비용', '2.06': '자산 손상',
  '3.01': '상장 유지 기준 통지', '3.02': '사모 증권 발행', '3.03': '주주 권리 변경',
  '4.01': '감사인 변경', '4.02': '과거 재무제표 신뢰 불가',
  '5.01': '지배권 변경', '5.02': '임원·이사 변동', '5.03': '정관 변경', '5.07': '주주총회 결과',
  '7.01': '공정공시 자료', '8.01': '기타 중요 사항', '9.01': '재무제표·첨부 서류'
});
export const RECENT_FILING_DISPLAY_DAYS = 30;

export function parseRecentFilings(value) {
  return (Array.isArray(value) ? value : []).map((entry) => {
    if (typeof entry === 'string') {
      const [filedAt, form, items, accession] = entry.split('|');
      return { filedAt, form, items: items ? items.split(',').filter(Boolean) : [], accession };
    }
    return entry && typeof entry === 'object' ? { filedAt: entry.filedAt, form: entry.form, items: Array.isArray(entry.items) ? entry.items : [], accession: entry.accession } : null;
  }).filter((filing) => filing && /^\d{4}-\d{2}-\d{2}$/.test(String(filing.filedAt || '')) && /^(8-K|10-Q|10-K)(\/A)?$/.test(String(filing.form || '')));
}

export function filingLabel(filing) {
  const base = String(filing?.form || '').replace(/\/A$/, '');
  const amended = /\/A$/.test(String(filing?.form || '')) ? ' 정정' : '';
  const items = (filing?.items || []).filter((item) => ITEM_LABEL[item]);
  const named = items.length > 1 ? items.filter((item) => item !== '9.01') : items;
  const what = base === '8-K' && named.length ? named.map((item) => ITEM_LABEL[item]).join('·') : FORM_LABEL[base] || base;
  return `${filing.form} ${what}${amended}`;
}

// Only filings dated within the last 30 days are named; an older collection never reads as "no filings".
export function recentFilingsPoint(fundamentals, now = Date.now()) {
  const cutoff = now - RECENT_FILING_DISPLAY_DAYS * 86400000;
  const filings = parseRecentFilings(fundamentals?.recentFilings)
    .filter((filing) => { const ms = Date.parse(filing.filedAt); return Number.isFinite(ms) && ms >= cutoff && ms <= now + 86400000; })
    .sort((a, b) => b.filedAt.localeCompare(a.filedAt));
  if (!filings.length) return null;
  const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  const shown = filings.slice(0, 3);
  const more = filings.length > shown.length ? ` 외 ${filings.length - shown.length}건` : '';
  const checked = String(fundamentals?.fetchedAt || '').slice(0, 10);
  const href = secFilingUrl(fundamentals?.cik, shown[0].accession);
  return {
    id: 'filings', tone: 'neutral', title: '최근 공시',
    text: `${shown.map((filing) => `${md(filing.filedAt)} ${filingLabel(filing)}`).join(', ')}${more}${/^\d{4}-\d{2}-\d{2}$/.test(checked) ? ` (${md(checked)} 확인)` : ''}.`,
    ...(href ? { link: { href, label: 'SEC 공시 원문', ariaLabel: `${shown[0].form} ${shown[0].filedAt} 제출 SEC 공시 원문 새 창` } } : {})
  };
}

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
// 은/는 by the final Hangul syllable of the label (the ticker in parentheses is not read).
const topic = (label) => { const code = String(label || '').charCodeAt(String(label || '').length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '은' : '는'; };
const signed = (value, digits = 1, unit = '%') => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;

// V13 (2026-10-13): the one canonical sector key. The universe uses these eleven keys; names from other
// taxonomies (Yahoo/FMP "Consumer Cyclical", "Financial Services", "Basic Materials"; GICS "Health Care",
// "Information Technology", "Consumer Staples"…) fold into them here and nowhere else.
const CANONICAL_SECTOR_ETF = Object.freeze({
  Technology: 'XLK', Financials: 'XLF', Energy: 'XLE', Healthcare: 'XLV', Industrials: 'XLI', Consumer: 'XLY',
  'Consumer Defensive': 'XLP', 'Real Estate': 'XLRE', Materials: 'XLB', Utilities: 'XLU', 'Communication Services': 'XLC'
});
export const SECTOR_KEY_ALIAS = Object.freeze({
  'Consumer Cyclical': 'Consumer', 'Consumer Discretionary': 'Consumer', 'Financial Services': 'Financials',
  'Basic Materials': 'Materials', 'Health Care': 'Healthcare', 'Information Technology': 'Technology',
  Communication: 'Communication Services', 'Consumer Staples': 'Consumer Defensive'
});
export function normalizeSectorKey(sector) {
  const key = String(sector ?? '').trim();
  return SECTOR_KEY_ALIAS[key] || key || null;
}
// Sector name → the SPDR sector ETF tracked by the rotation model. Alias names resolve through the same table,
// so a direct lookup with a provider's sector name still lands on the canonical ETF.
export const SECTOR_ETF = Object.freeze({
  ...CANONICAL_SECTOR_ETF,
  ...Object.fromEntries(Object.entries(SECTOR_KEY_ALIAS).map(([alias, key]) => [alias, CANONICAL_SECTOR_ETF[key]]))
});
// v57.50 I01: an ETF code handed to the screener is read back as the artifact's own sector name(s).
export function sectorsForEtf(code) {
  const etf = String(code || '').trim().toUpperCase();
  return Object.keys(SECTOR_ETF).filter((sector) => SECTOR_ETF[sector] === etf);
}
const SECTOR_KO = Object.freeze({ XLK: '기술', XLF: '금융', XLE: '에너지', XLV: '헬스케어', XLI: '산업재', XLY: '경기소비재', XLP: '필수소비재', XLRE: '부동산', XLB: '소재', XLU: '유틸리티', XLC: '통신' });
const QUADRANT = Object.freeze({
  // v57.84: the same words as 테마 · 섹터 — RS-Ratio sits against its own 50-session average (not "stronger than the market")
  // and RS-Momentum compares with the same reading 10 sessions ago (rrg.v3) (not a present-tense "getting stronger").
  Leading: { label: RRG_QUADRANT_WORDS.Leading, tone: 'favorable', read: RRG_QUADRANT_READS.Leading },
  Improving: { label: RRG_QUADRANT_WORDS.Improving, tone: 'neutral', read: RRG_QUADRANT_READS.Improving },
  Weakening: { label: RRG_QUADRANT_WORDS.Weakening, tone: 'neutral', read: RRG_QUADRANT_READS.Weakening },
  Lagging: { label: RRG_QUADRANT_WORDS.Lagging, tone: 'burden', read: RRG_QUADRANT_READS.Lagging }
});

// Position inside the 52-week range from the artifact's own distances (no live quote needed):
// price/low = 1 + L/100 and price/high = 1 + H/100.
export function rangePosition(pctFromLow, pctFromHigh) {
  const L = finite(pctFromLow);
  const H = finite(pctFromHigh);
  if (L == null || H == null || L < 0 || H > 0) return null;
  const low = 1 / (1 + L / 100);
  const high = 1 / (1 + H / 100);
  if (!(high > low)) return null;
  return Math.max(0, Math.min(1, (1 - low) / (high - low)));
}

// v57.81: the 50·200-day trend passes the ADR buffers in technical/bands.js (50일선 부근, five-session break) — the
// same states the screener's 상대 상태 column uses.
const trendOf = bufferedTrend;

// v57.81: an RRG quadrant is a ~50-session reading. Within the themes' neutral band around 100 it is 경계, and when the
// relative-strength line's last five sessions run against the quadrant's direction its favourable tone and its
// "더 강해지는 중" clause are withheld. The five-session relative move is always shown when the series exists.
function rotationView(item) {
  if (!item || !QUADRANT[item.quadrant]) return null;
  // v57.84 (R707): against the quadrant only beyond twice the usual 5-session move — the bare sign flagged 13 of 31 ETFs
  // where the themes screen flagged 2. v57.84: the zone, the check and that rule are the themes screen's own reading
  // (rrgRecentReading); a missing series fails closed (opposed null).
  const zone = rrgRecentReading({ rsRatio: finite(item.rsRatio), rsMomentum: finite(item.rsMomentum), trail: item.trail || null }, item.relativeStrength);
  // v57.84 (owner decision 3-3): the settled quadrant (own-noise band + hysteresis) names the sector, as on 테마 · 섹터.
  const base = QUADRANT[zone?.quadrant || item.quadrant];
  const check = zone?.check || null;
  const opposed = zone ? zone.opposed : null;
  const recent = check ? `최근 5거래일 상대강도 ${signedPct(check.change)}` : '';
  const border = !!zone?.border;
  const label = border ? '기준선 부근' : base.label;
  const tone = base.tone === 'favorable' && !border && opposed === false ? 'favorable' : base.tone === 'burden' && !border && opposed !== true ? 'burden' : 'neutral';
  const read = border ? '시장 대비 상대강도가 기준선(100) 근처라 사분면을 가르기 어렵습니다'
    : opposed ? `${base.label} 사분면이지만 최근 5거래일은 반대 방향입니다` : base.read;
  return { ...base, label, tone, read, border, between: border ? zone.between : null, opposed, recent, headLabel: border ? '기준선 부근' : opposed ? `${base.label}(최근 반대 방향)` : base.label };
}

// 2026-10-14 audit #13: the screener's own validation verdict for its ranking, said in one clause — or nothing.
function rankVerdict(validation) {
  if (!validation?.available || validation.modelMatch === false) return '';
  if (validation.distinguishable === false) return ' — 과거 검증상 이 순위와 이후 수익의 관계는 아직 구별 불가';
  const spread = finite(validation.spreadNet);
  if (spread == null) return '';
  // v57.81: the count is the net-of-cost one (screener-validation summarizeValidation), named as such everywhere.
  return spread > 0 ? ` — 과거 검증에서 상위 20%가 하위보다 앞섬(${validation.rebalances}회 중 비용 후 ${validation.wins ?? '—'}회)` : ` — 과거 검증에서 상위 20%가 하위보다 뒤처짐(${validation.rebalances}회 중 비용 후 ${validation.wins ?? '—'}회 앞섬)`;
}

export function buildStockRead({ symbol, row = null, benchmark = null, rotation = {}, themes = [], themeStages = [], regime = null, universeSize = null, validation = null, sessionLag = null, holding = null, thirteenF = null, fundamentals = null, now = Date.now() } = {}) {
  if (!row) return { available: false, reason: `${withTopicParticle(symbol || '이 종목')} 스크리너 종목 범위 밖이라 추세·상대강도 기록이 없습니다. 차트 탭의 일봉과 재무 공시는 그대로 볼 수 있습니다.` };
  const name = row.name || symbol;
  const points = [];
  const trend = trendOf(row);
  // v57.50 C19: this is the 50·200-day line position. The screener's 이동평균 배열 gate (vcpStage: price > 150 > 200-day
  // line, above the 50-day line, within 30% of the 52-week high) is a stricter, separate test — MSFT read "상승 추세"
  // here and "추세 조건 미충족" there with nothing saying they were different questions.
  const templateNote = row.vcpStage === 'not_stage2' && ['up', 'up-shaken', 'unconfirmed', 'pullback'].includes(trend?.id)
    ? ' 스크리너의 이동평균 배열 조건(가격 > 150일선 > 200일선, 52주 고점 대비 -30% 이내)은 이보다 엄격한 별도 기준이며, 이 종목은 아직 충족하지 않습니다.'
    : '';
  if (trend) points.push({ id: 'trend', tone: trend.tone, title: '이동평균 위치', text: `${trend.text}.${templateNote}` });

  const position = rangePosition(row.pctFrom52wLow, row.pctFrom52wHigh);
  const high = finite(row.pctFrom52wHigh);
  if (position != null) {
    const where = position >= 0.85 ? '52주 범위 맨 위쪽 — 신고가를 시험하는 자리' : position >= 0.6 ? '52주 범위 위쪽' : position >= 0.4 ? '52주 범위 가운데' : position >= 0.15 ? '52주 범위 아래쪽' : '52주 범위 맨 아래 — 신저가 근처';
    points.push({ id: 'range', tone: position >= 0.6 ? 'favorable' : position < 0.4 ? 'burden' : 'neutral', title: '52주 위치', text: `${where}(범위의 ${Math.round(position * 100)}%, 고점 대비 ${signed(high)}).` });
  }

  const spans = [['ret1m', '1개월'], ['ret3m', '3개월'], ['ret6m', '6개월']].map(([key, label]) => {
    const stock = finite(row[key]);
    const bench = finite(benchmark?.[key]);
    return { key, label, stock, bench, gap: stock != null && bench != null ? stock - bench : null };
  });
  const compared = spans.filter((span) => span.gap != null);
  if (compared.length) {
    const three = spans.find((span) => span.key === 'ret3m');
    const anchor = three?.gap != null ? three : compared[compared.length - 1];
    const ahead = compared.filter((span) => span.gap > 0).length;
    const consistency = ahead === compared.length ? '모든 기간에서 지수를 앞섰습니다' : ahead === 0 ? '모든 기간에서 지수에 뒤졌습니다' : `${compared.length}개 기간 중 ${ahead}개에서 앞섰습니다`;
    // v57.81: "ahead" needs a gap beyond the window's relative band (a typical tracking error, themes recent-check), and
    // the last five sessions against the same index are named when both returns exist (fail closed: no line otherwise).
    const band = relativeBand(anchor.key) ?? 0;
    const stock5 = finite(row.ret5d);
    const bench5 = finite(benchmark?.ret5d);
    const recent5 = stock5 != null && bench5 != null ? stock5 - bench5 : null;
    const against = recent5 != null && Math.sign(recent5) !== 0 && Math.sign(recent5) !== Math.sign(anchor.gap);
    const verdict = Math.abs(anchor.gap) <= band ? `${Math.abs(anchor.gap).toFixed(1)}%p 차이로 비슷(±${band.toFixed(1)}%p 안)` : `${Math.abs(anchor.gap).toFixed(1)}%p ${anchor.gap >= 0 ? '강함' : '약함'}`;
    points.push({ id: 'relative', tone: anchor.gap > band && !against ? 'favorable' : anchor.gap < -band && !against ? 'burden' : 'neutral', title: '지수 대비',
      text: `${anchor.label} ${signed(anchor.stock)} vs ${benchmark?.label || 'S&P 500'} ${signed(anchor.bench)} — ${verdict}. ${consistency}.${recent5 != null ? ` 최근 5거래일은 ${signed(stock5)} vs ${signed(bench5)}(${signed(recent5, 1, '%p')})${against ? '로 반대 방향입니다' : ''}.` : ''}` });
  }

  // P1507: distance from the 50-day line in units of the stock's own average daily range — how late an entry
  // here would be. Volatile names run further, so the raw % alone overstates or understates the stretch.
  const pct50 = finite(row.pctSma50);
  const adr = finite(row.adrPct);
  // 2026-10-13 review S09: the bands are the screener's (setup-profile EXTENSION_BANDS) — 3.8x is not "near".
  if (pct50 != null && adr != null && adr > 0) {
    const multiple = extensionMultiple(pct50, adr);
    // v57.81: a price under the line has its own band ('below'); within one daily range either side is 부근 (bands.js).
    const band = extensionBand(multiple);
    const nearLine = Math.abs(pct50) < NEAR_LINE_ADR * adr;
    const text = nearLine
      ? `50일선과 ${signed(pct50)} 차이, 일평균 변동폭(${adr.toFixed(1)}%)의 ${NEAR_LINE_ADR}배 안 — 50일선 부근이라 위아래를 아직 가를 수 없는 자리입니다.`
      : band === 'below'
      ? `50일선보다 ${Math.abs(pct50).toFixed(1)}% 아래, 일평균 변동폭의 ${Math.abs(multiple).toFixed(1)}배 — 50일선 아래로 내려온 상태입니다.`
      : band === 'stretched'
        // Codex browser audit H32: the distance is an observed fact; entry/stop wording read as a trade instruction.
        ? `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭(${adr.toFixed(1)}%)의 ${multiple.toFixed(1)}배 — 50일선에서 크게 벌어져, 50일선까지 되돌리기만 해도 지금 가격에서 ${(pct50 / (100 + pct50) * 100).toFixed(1)}% 하락하는 거리입니다.`
        : band === 'extended'
          ? `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭의 ${multiple.toFixed(1)}배 — 추세 위에 있으면서 50일선과의 거리가 꽤 벌어진 상태입니다(${EXTENSION_BANDS.extended}배 이상).`
          : band === 'near-base'
            ? `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭의 ${multiple.toFixed(1)}배 — 50일선 가까이에 있는 상태입니다(${EXTENSION_BANDS.nearBase}배 이하).`
            : `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭의 ${multiple.toFixed(1)}배 — 50일선 가까이(${EXTENSION_BANDS.nearBase}배 이하)와 확장(${EXTENSION_BANDS.extended}배 이상) 사이입니다.`;
    // Favourable only above the 부근 band and inside the near-base band; under the line past one daily range is a burden.
    const tone = band === 'stretched' || (band === 'below' && !nearLine) ? 'burden' : band === 'near-base' && !nearLine && !trend?.drop?.broken ? 'favorable' : 'neutral';
    points.push({ id: 'extension', tone, title: '50일선과의 거리', text });
  }

  // 2026-10-13 review S02: 69.9 printed as "RSI 70" next to "not overheated". The value is shown to one decimal
  // (the screener's digits) and judged on that same number.
  const rsi = finite(row.rsi) == null ? null : Math.round(finite(row.rsi) * 10) / 10;
  if (rsi != null) {
    const shown = rsi.toFixed(1);
    // v57.50 C16: one RSI table (RULES.technical.rsi) for this summary, the screener state label and the climax watch.
    const { overbought: hot, oversold: cold, climax } = RULES.technical.rsi;
    // v57.81: "neither overbought nor oversold" is the absence of a signal, not a favourable one — neutral throughout.
    points.push({ id: 'rsi', tone: 'neutral', title: '단기 과열',
      text: rsi >= climax ? `RSI ${shown} — 과열권(${hot} 이상) 중에서도 스크리너가 '과열 정점 주의'로 표시하는 ${climax} 이상 구간입니다.` : rsi >= hot ? `RSI ${shown} — 과열권(${hot} 이상)입니다. 강한 추세에서는 이 구간이 오래 이어지기도 합니다.` : rsi <= cold ? `RSI ${shown} — 과매도권(${cold} 이하)입니다. 약한 추세에서는 이 구간이 이어지기도 해 추세 확인이 먼저입니다.` : rsi >= hot - 5 ? `RSI ${shown} — 과열 기준(${hot}) 바로 아래 구간입니다.` : rsi <= cold + 5 ? `RSI ${shown} — 과매도 기준(${cold}) 바로 위 구간입니다.` : `RSI ${shown} — 과열도 과매도도 아닌 구간입니다.` });
  }

  // P1447: US sector ETFs describe US sectors; a KRX listing is not read against them.
  const isKr = /\.(KS|KQ)$/i.test(String(symbol || ''));
  const etf = isKr ? null : SECTOR_ETF[normalizeSectorKey(row.sector)] || null;
  const sector = etf && rotation[etf] ? { etf, label: SECTOR_KO[etf] || etf, quadrant: rotationView(rotation[etf]), sessionDate: rotation[etf].sessionDate || null } : null;
  const themed = (themes || []).map((theme) => ({ ...theme, quadrant: theme.etf && rotation[theme.etf] ? rotationView(rotation[theme.etf]) : null }));
  const topTheme = themed.find((theme) => theme.quadrant) || themed[0] || null;
  // 2026-10-14 audit #5: the theme's stage (same rows as 테마 시나리오) leads this point, one line per theme. The favoured
  // choice is the theme's, never an instruction on this stock. The rotation-quadrant wording stays as folded evidence.
  const stages = (Array.isArray(themeStages) ? themeStages : []).filter((stage) => stage?.id && stage.stateLabel);
  const stageLines = stages.map((stage) => ({ id: stage.id, label: stage.label,
    text: `테마 ${stage.label}: ${stage.stateLabel}${stage.wind ? `, 거시 ${stage.wind}` : ''}` }));
  let rotationText = null;
  let tailwind = false;
  if (sector?.quadrant || topTheme?.quadrant) {
    const parts = [];
    // v57.70 (2026-10-15 audit): "선도 — 더 강해지는 중" on a -3% sector day read as today's move; it is the multi-week
    // relative-rotation position as of a dated close, and says so.
    const rotationAsOf = /^\d{4}-\d{2}-\d{2}$/.test(String(sector?.sessionDate || '')) ? `${Number(sector.sessionDate.slice(5, 7))}/${Number(sector.sessionDate.slice(8, 10))} 종가까지 몇 주의 상대 흐름` : '몇 주의 상대 흐름';
    if (sector?.quadrant) parts.push(`섹터 ${sector.label}(${sector.etf})${topic(sector.label)} ${sector.quadrant.label}(${sector.quadrant.between ? `${sector.quadrant.between} 사이, ` : ''}${rotationAsOf}) — ${sector.quadrant.read}${sector.quadrant.recent ? `(${sector.quadrant.recent})` : ''}`);
    if (topTheme?.quadrant && topTheme.etf !== sector?.etf) parts.push(`테마 ${topTheme.label}(${topTheme.etf})${topic(topTheme.label)} ${topTheme.quadrant.label}${topTheme.quadrant.between ? `(${topTheme.quadrant.between} 사이)` : ''}${topTheme.quadrant.recent ? `, ${topTheme.quadrant.recent}${topTheme.quadrant.opposed ? '로 반대 방향' : ''}` : ''}`);
    tailwind = sector?.quadrant?.tone === 'favorable' || topTheme?.quadrant?.tone === 'favorable';
    const stockStrong = trend?.id === 'up';
    // v57.81: the tie is said only when both sides have a definite tone (경계·반대 방향 sectors and 부근 stocks say none).
    const headwind = !tailwind && (sector?.quadrant?.tone === 'burden' || topTheme?.quadrant?.tone === 'burden');
    const tie = tailwind && stockStrong ? '종목 강세가 섹터 흐름과 같은 방향입니다' : headwind && stockStrong ? '섹터 흐름이 약한데 종목만 강한 개별 강세입니다'
      : tailwind && trend && trend.tone !== 'favorable' ? '섹터는 강한데 종목은 뒤처져 있습니다' : headwind && trend?.id === 'down' ? '섹터와 종목이 함께 약합니다' : '';
    rotationText = `${parts.join(', ')}.${tie ? ` ${tie}.` : ''}`;
  }
  if (stageLines.length) {
    points.push({ id: 'sector', tone: 'neutral', title: '섹터·테마', text: stageLines.map((line) => line.text).join(' / '), lines: stageLines,
      ...(rotationText ? { evidence: { summary: '섹터 회전(상대강도) 근거', text: rotationText } } : {}) });
  } else if (rotationText) {
    points.push({ id: 'sector', tone: tailwind ? 'favorable' : 'neutral', title: '섹터·테마', text: rotationText });
  }

  const breadth = regime?.axes?.find((axis) => axis.id === 'breadth');
  if (regime?.available && regime.overall && isKr) {
    points.push({ id: 'market', tone: 'neutral', title: '시장 환경', text: `미국 시장 상태는 ‘${regime.overall}’ — 한국 종목에는 환율·외국인 수급을 거쳐 간접적으로 작용합니다(시장 상태의 원·엔 카드 참고).` });
  } else if (regime?.available && regime.overall) {
    const narrow = breadth?.state === 'burden';
    // v57.81: breadth counts stocks; an ETF (SPY, QQQ…) is not "one of the few up-trend stocks", so that clause is skipped.
    const isFund = /^ETF$/i.test(String(row.sector || ''));
    const text = narrow && isFund ? `시장 상태는 ‘${regime.overall}’이고 시장 폭이 좁습니다(50일선 위 종목이 적음).`
      : narrow && trend?.id === 'up' ? `시장 상태는 ‘${regime.overall}’이고 시장 폭이 좁습니다(50일선 위 종목이 적음). 이 종목은 그 적은 수의 상승 추세 종목에 속합니다. 지수에 얼마나 기여했는지는 이 화면 자료로 계산하지 않습니다.`
      : narrow ? `시장 상태는 ‘${regime.overall}’이고 시장 폭이 좁아, 추세가 약한 종목은 지수보다 먼저 흔들리기 쉬운 환경입니다.`
        : `시장 상태는 ‘${regime.overall}’${breadth ? `, 시장 폭은 ${breadth.stateLabel}` : ''}입니다.`;
    points.push({ id: 'market', tone: regime.counts?.burden >= 4 ? 'burden' : 'neutral', title: '시장 환경', text });
  }

  // N20: the issuer's recent filings, when the caller passes this symbol's annual-facts record.
  const filingsPoint = !isKr && fundamentals && String(fundamentals.symbol || symbol || '').toUpperCase() === String(symbol || '').toUpperCase() ? recentFilingsPoint(fundamentals, now) : null;
  if (filingsPoint) points.push(filingsPoint);

  // v57.50 I13: the reader's own position, only from a portfolio surface that was already opened and valued in one
  // currency basis (the caller passes nothing otherwise). A weight, not an instruction.
  const holdingWeight = finite(holding?.weightPct);
  if (holdingWeight != null && holdingWeight > 0) {
    points.push({ id: 'holding', tone: 'neutral', title: '내 보유', text: `내 보유 비중 ${holdingWeight < 0.1 ? '0.1% 미만' : `${holdingWeight.toFixed(1)}%`}(${holding?.basisLabel || '포트폴리오 총자산 대비'}) — 위 추세·위치 판단이 이 비중만큼 내 계좌에 걸려 있습니다.` });
  }

  const rank = finite(row.screenRank);
  // v57.54: a rank outside its own denominator is a mixed row set — say nothing rather than "890/239".
  const ranking = rank != null && rank >= 1 && finite(universeSize) && rank <= universeSize ? { rank, of: universeSize, topPct: Math.max(1, Math.round(rank / universeSize * 100)) } : null;
  // 2026-10-14 audit #13: the rank lives in the reading (not the heading), on the screener's denominator, with the
  // screener's own validation verdict when it is loaded — otherwise the rank alone, without a claim.
  // v57.81: under the screener's 확장 range the denominator includes Russell 2000·Nasdaq stocks — the rank says so.
  const rankScope = row.rankingUniverse === 'extended' ? '(확장 종목 범위 기준: 기본 + 러셀2000·나스닥) ' : '';
  if (ranking) points.push({ id: 'rank', tone: 'neutral', title: '순위', text: `가격 흐름 순위 ${rankScope}${ranking.rank}/${ranking.of}${rankVerdict(validation)}.` });
  const relative3 = spans.find((span) => span.key === 'ret3m');
  // 2026-10-13 review S07: a factor file older than the market's latest completed session says so in the headline.
  const lagSessions = finite(sessionLag?.sessions);
  const headline = [
    lagSessions != null && lagSessions > 0 ? `${lagSessions}거래일 전 종가 기준${sessionLag?.session ? `(${Number(String(sessionLag.session).slice(5, 7))}/${Number(String(sessionLag.session).slice(8, 10))})` : ''}` : null,
    trend ? trend.label : null,
    position != null ? `52주 범위 ${Math.round(position * 100)}% 지점` : null,
    relative3?.gap != null ? `3개월 지수 대비 ${signed(relative3.gap, 1, '%p')}` : null,
    sector?.quadrant ? `섹터 ${sector.quadrant.headLabel}` : null
  ].filter(Boolean).join(', ');
  // v57.55 review (8o): an ETF has no filings to read and no sector peers — its links say so.
  const fund = /^ETF$/i.test(String(row.sector || ''));
  const next = [{ route: 'technical', label: '차트', why: trend ? `${trend.label}의 셋업 — 이동평균·피벗·거래량으로 지금 자리가 돌파 전인지 확인` : '일봉과 이동평균 위치' },
    ...(fund ? [] : [{ route: 'fundamental', label: '재무 공시', why: '이 추세를 매출·이익·현금흐름이 뒷받침하는지' }])];
  if (topTheme?.id) next.push({ action: 'showThemeDetail', arg: topTheme.id, route: 'themes', label: `테마, ${topTheme.label}`, why: '같은 테마 안에서 누가 앞서는지' });
  // v57.50 I01: the Korean label (기술) is for the sentence; the screener filters on the artifact's own sector value
  // (Technology), so the handoff carries that value, not a search word that matches no row.
  // v57.54: one Korean sector name on the page ("섹터 기술" above, "같은 섹터(Technology)" here) — the label map is the
  // same SECTOR_ETF → SECTOR_KO path the sector point uses, for KR listings too; the handoff ctx keeps the raw value.
  const sectorName = sector?.label || SECTOR_KO[SECTOR_ETF[normalizeSectorKey(row.sector)]] || row.sector || '';
  next.push({ route: 'screener', label: '스크리너', why: fund ? '다른 ETF와 수익률·추세 비교' : `같은 섹터(${sectorName || '—'})에서 상대 순위가 높은 종목과 비교`, ctx: row.sector ? { sector: row.sector, ticker: symbol } : { ticker: symbol } });
  // v57.50 I12: 13F holders only when the reference ledger lists this ticker; the ledger's scope is stated.
  if (thirteenF?.covered && !isKr) {
    next.push({ route: 'masters', label: '대가 보유 종목', why: `이 종목을 신고한 운용사 — 13F 역조회 원장 ${finite(thirteenF.tickerCount) ?? '—'}개 종목 범위, 분기 지연 신고`, ctx: { ticker: symbol } });
  }
  // v58.53 (개편 v2 3d): the raw figures behind the points, so the summary's check tiles print short values from the same row.
  const facts = { trendLabel: trend?.label || null, pct50, pct200: finite(row.pctSma200), adr, rsi, ret1m: finite(row.ret1m), basisDate: String(row.factorSessionDate || row.priceDate || '').slice(0, 10) || null };
  return { available: true, symbol, name, headline, points, position, high, spans, sector, themes: themed, ranking, next, facts, benchmarkLabel: benchmark?.label || 'S&P 500', sessionLag: lagSessions != null && lagSessions > 0 ? lagSessions : null };
}
