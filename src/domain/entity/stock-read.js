// P1434 (종목 요약 redesign, owner direction 2026-10-04): the summary tab answers "what state is this
// stock in, and why" in one connected reading — trend, where it sits in its 52-week range, how it did
// against the S&P 500, its sector's rotation and the market it trades in — each tied to the next.
// Pure: every input is the published screener row, the SPY row of the same artifact, the sector /
// theme rotation items and the market regime. A missing input drops its sentence; nothing is guessed.
import { withTopicParticle } from '../content/korean-particle.js';
import { EXTENSION_BANDS, extensionStateFor } from '../screener/setup-profile.js';
import { RULES } from '../rules/thresholds.js';
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
    text: `${shown.map((filing) => `${md(filing.filedAt)} ${filingLabel(filing)}`).join(' · ')}${more}${/^\d{4}-\d{2}-\d{2}$/.test(checked) ? ` (${md(checked)} 확인)` : ''}.`,
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
  Leading: { label: '선도', tone: 'favorable', read: '시장보다 강하고 더 강해지는 중' },
  Improving: { label: '개선', tone: 'neutral', read: '아직 시장보다 약하지만 회복 중' },
  Weakening: { label: '약화', tone: 'neutral', read: '시장보다 강하지만 힘이 빠지는 중' },
  Lagging: { label: '후행', tone: 'burden', read: '시장보다 약하고 더 약해지는 중' }
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

function trendOf(row) {
  const s50 = finite(row?.pctSma50);
  const s200 = finite(row?.pctSma200);
  if (s50 == null || s200 == null) return null;
  if (s50 >= 0 && s200 >= 0) return { id: 'up', tone: 'favorable', label: '상승 추세', text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 위 — 단기·장기 추세가 모두 위쪽입니다` };
  if (s50 < 0 && s200 >= 0) return { id: 'pullback', tone: 'neutral', label: '장기 추세 속 조정', text: `200일선 위(${signed(s200)})지만 50일선 아래(${signed(s50)}) — 장기 추세 안에서 쉬는 구간입니다` };
  if (s50 >= 0 && s200 < 0) return { id: 'rebound', tone: 'neutral', label: '장기 추세 아래 반등', text: `50일선은 회복(${signed(s50)})했지만 200일선 아래(${signed(s200)}) — 반등이 장기 추세를 되돌릴지는 아직입니다` };
  return { id: 'down', tone: 'burden', label: '하락 추세', text: `50일선(${signed(s50)})과 200일선(${signed(s200)}) 아래 — 단기·장기 추세가 모두 아래쪽입니다` };
}

// 2026-10-14 audit #13: the screener's own validation verdict for its ranking, said in one clause — or nothing.
function rankVerdict(validation) {
  if (!validation?.available || validation.modelMatch === false) return '';
  if (validation.distinguishable === false) return ' — 과거 검증상 이 순위와 이후 수익의 관계는 아직 구별 불가';
  const spread = finite(validation.spreadNet);
  if (spread == null) return '';
  return spread > 0 ? ` — 과거 검증에서 상위 20%가 하위보다 앞섬(${validation.rebalances}회 중 ${validation.wins ?? '—'}회)` : ` — 과거 검증에서 상위 20%가 하위보다 뒤처짐(${validation.rebalances}회 중 ${validation.wins ?? '—'}회 앞섬)`;
}

export function buildStockRead({ symbol, row = null, benchmark = null, rotation = {}, themes = [], themeStages = [], regime = null, universeSize = null, validation = null, sessionLag = null, holding = null, thirteenF = null, fundamentals = null, now = Date.now() } = {}) {
  if (!row) return { available: false, reason: `${withTopicParticle(symbol || '이 종목')} 스크리너 유니버스 밖이라 추세·상대강도 기록이 없습니다. 차트 탭의 일봉과 재무 공시는 그대로 볼 수 있습니다.` };
  const name = row.name || symbol;
  const points = [];
  const trend = trendOf(row);
  // v57.50 C19: this is the 50·200-day line position. The screener's 이동평균 배열 gate (vcpStage: price > 150 > 200-day
  // line, above the 50-day line, within 30% of the 52-week high) is a stricter, separate test — MSFT read "상승 추세"
  // here and "추세 조건 미충족" there with nothing saying they were different questions.
  const templateNote = row.vcpStage === 'not_stage2' && (trend?.id === 'up' || trend?.id === 'pullback')
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
    points.push({ id: 'relative', tone: anchor.gap > 0 ? 'favorable' : 'burden', title: '지수 대비',
      text: `${anchor.label} ${signed(anchor.stock)} vs ${benchmark?.label || 'S&P 500'} ${signed(anchor.bench)} — ${Math.abs(anchor.gap).toFixed(1)}%p ${anchor.gap >= 0 ? '강함' : '약함'}. ${consistency}.` });
  }

  // P1507: distance from the 50-day line in units of the stock's own average daily range — how late an entry
  // here would be. Volatile names run further, so the raw % alone overstates or understates the stretch.
  const pct50 = finite(row.pctSma50);
  const adr = finite(row.adrPct);
  // 2026-10-13 review S09: the bands are the screener's (setup-profile EXTENSION_BANDS) — 3.8x is not "near".
  if (pct50 != null && adr != null && adr > 0) {
    const multiple = Math.round(pct50 / adr * 10) / 10;
    const band = extensionStateFor(multiple);
    const text = multiple < 0
      ? `50일선보다 ${Math.abs(pct50).toFixed(1)}% 아래 — 기준선 아래에 있는 상태입니다.`
      : band === 'stretched'
        // Codex browser audit H32: the distance is an observed fact; entry/stop wording read as a trade instruction.
        ? `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭(${adr.toFixed(1)}%)의 ${multiple.toFixed(1)}배 — 기준선에서 크게 벌어져, 50일선까지 되돌리기만 해도 지금 가격에서 ${(pct50 / (100 + pct50) * 100).toFixed(1)}% 하락하는 거리입니다.`
        : band === 'extended'
          ? `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭의 ${multiple.toFixed(1)}배 — 추세 위에 있으면서 기준선과의 거리가 꽤 벌어진 상태입니다(${EXTENSION_BANDS.extended}배 이상).`
          : band === 'near-base'
            ? `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭의 ${multiple.toFixed(1)}배 — 기준선 가까이에 있는 상태입니다(${EXTENSION_BANDS.nearBase}배 이하).`
            : `50일선보다 ${pct50.toFixed(1)}% 위, 일평균 변동폭의 ${multiple.toFixed(1)}배 — 기준선 가까이(${EXTENSION_BANDS.nearBase}배 이하)와 확장(${EXTENSION_BANDS.extended}배 이상) 사이입니다.`;
    points.push({ id: 'extension', tone: band === 'stretched' ? 'burden' : band === 'near-base' || multiple < 0 ? 'favorable' : 'neutral', title: '기준선 대비 거리', text });
  }

  // 2026-10-13 review S02: 69.9 printed as "RSI 70" next to "not overheated". The value is shown to one decimal
  // (the screener's digits) and judged on that same number.
  const rsi = finite(row.rsi) == null ? null : Math.round(finite(row.rsi) * 10) / 10;
  if (rsi != null) {
    const shown = rsi.toFixed(1);
    // v57.50 C16: one RSI table (RULES.technical.rsi) for this summary, the screener state label and the climax watch.
    const { overbought: hot, oversold: cold, climax } = RULES.technical.rsi;
    points.push({ id: 'rsi', tone: rsi >= hot || rsi <= cold ? 'neutral' : 'favorable', title: '단기 과열',
      text: rsi >= climax ? `RSI ${shown} — 과열권(${hot} 이상) 중에서도 스크리너가 클라이맥스 관찰로 표시하는 ${climax} 이상 구간입니다.` : rsi >= hot ? `RSI ${shown} — 과열권(${hot} 이상)이라 추세가 강해도 쉬어 가기 쉬운 자리입니다.` : rsi <= cold ? `RSI ${shown} — 과매도권(${cold} 이하)이라 반등 시도가 나오기 쉬운 자리이지만 추세 확인이 먼저입니다.` : rsi >= hot - 5 ? `RSI ${shown} — 과열 기준(${hot}) 바로 아래 구간입니다.` : rsi <= cold + 5 ? `RSI ${shown} — 과매도 기준(${cold}) 바로 위 구간입니다.` : `RSI ${shown} — 과열도 과매도도 아닌 구간입니다.` });
  }

  // P1447: US sector ETFs describe US sectors; a KRX listing is not read against them.
  const isKr = /\.(KS|KQ)$/i.test(String(symbol || ''));
  const etf = isKr ? null : SECTOR_ETF[normalizeSectorKey(row.sector)] || null;
  const sector = etf && rotation[etf] ? { etf, label: SECTOR_KO[etf] || etf, quadrant: QUADRANT[rotation[etf].quadrant] || null } : null;
  const themed = (themes || []).map((theme) => ({ ...theme, quadrant: theme.etf && rotation[theme.etf] ? QUADRANT[rotation[theme.etf].quadrant] || null : null }));
  const topTheme = themed.find((theme) => theme.quadrant) || themed[0] || null;
  // 2026-10-14 audit #5: the theme's stage (same rows as 테마 갈림길) leads this point, one line per theme. The favoured
  // choice is the theme's, never an instruction on this stock. The rotation-quadrant wording stays as folded evidence.
  const stages = (Array.isArray(themeStages) ? themeStages : []).filter((stage) => stage?.id && stage.stateLabel);
  const stageLines = stages.map((stage) => ({ id: stage.id, label: stage.label,
    text: `테마 ${stage.label}: ${stage.stateLabel}${stage.wind ? ` · 거시 ${stage.wind}` : ''}${stage.favoured?.length ? ` · 상대적으로 유리한 쪽: ${stage.favoured.join(', ')}` : ''}` }));
  let rotationText = null;
  let tailwind = false;
  if (sector?.quadrant || topTheme?.quadrant) {
    const parts = [];
    if (sector?.quadrant) parts.push(`섹터 ${sector.label}(${sector.etf})${topic(sector.label)} ${sector.quadrant.label} — ${sector.quadrant.read}`);
    if (topTheme?.quadrant && topTheme.etf !== sector?.etf) parts.push(`테마 ${topTheme.label}(${topTheme.etf})${topic(topTheme.label)} ${topTheme.quadrant.label}`);
    tailwind = sector?.quadrant?.tone === 'favorable' || topTheme?.quadrant?.tone === 'favorable';
    const stockStrong = trend?.id === 'up';
    const tie = tailwind && stockStrong ? '종목 강세가 섹터 흐름과 같은 방향입니다' : !tailwind && stockStrong ? '섹터 흐름이 약한데 종목만 강한 개별 강세입니다' : tailwind && !stockStrong ? '섹터는 강한데 종목은 뒤처져 있습니다' : '섹터와 종목이 함께 약합니다';
    rotationText = `${parts.join(' · ')}. ${tie}.`;
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
    const text = narrow && trend?.id === 'up' ? `시장 상태는 ‘${regime.overall}’이고 시장 폭이 좁습니다(50일선 위 종목이 적음). 이 종목은 그 적은 수의 상승 추세 종목에 속합니다. 지수에 얼마나 기여했는지는 이 화면 자료로 계산하지 않습니다.`
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
  if (ranking) points.push({ id: 'rank', tone: 'neutral', title: '순위', text: `가격 흐름 순위 ${ranking.rank}/${ranking.of}${rankVerdict(validation)}.` });
  const relative3 = spans.find((span) => span.key === 'ret3m');
  // 2026-10-13 review S07: a factor file older than the market's latest completed session says so in the headline.
  const lagSessions = finite(sessionLag?.sessions);
  const headline = [
    lagSessions != null && lagSessions > 0 ? `${lagSessions}거래일 전 종가 기준${sessionLag?.session ? `(${Number(String(sessionLag.session).slice(5, 7))}/${Number(String(sessionLag.session).slice(8, 10))})` : ''}` : null,
    trend ? trend.label : null,
    position != null ? `52주 범위 ${Math.round(position * 100)}% 지점` : null,
    relative3?.gap != null ? `3개월 지수 대비 ${signed(relative3.gap, 1, '%p')}` : null,
    sector?.quadrant ? `섹터 ${sector.quadrant.label}` : null
  ].filter(Boolean).join(' · ');
  const next = [{ route: 'technical', label: '차트', why: trend ? `${trend.label}의 셋업 — 이동평균·피벗·거래량으로 지금 자리가 돌파 전인지 확인` : '일봉과 이동평균 위치' },
    { route: 'fundamental', label: '재무 공시', why: '이 추세를 매출·이익·현금흐름이 뒷받침하는지' }];
  if (topTheme?.id) next.push({ action: 'showThemeDetail', arg: topTheme.id, route: 'themes', label: `테마 · ${topTheme.label}`, why: '같은 테마 안에서 누가 앞서는지' });
  // v57.50 I01: the Korean label (기술) is for the sentence; the screener filters on the artifact's own sector value
  // (Technology), so the handoff carries that value, not a search word that matches no row.
  // v57.54: one Korean sector name on the page ("섹터 기술" above, "같은 섹터(Technology)" here) — the label map is the
  // same SECTOR_ETF → SECTOR_KO path the sector point uses, for KR listings too; the handoff ctx keeps the raw value.
  const sectorName = sector?.label || SECTOR_KO[SECTOR_ETF[normalizeSectorKey(row.sector)]] || row.sector || '';
  next.push({ route: 'screener', label: '스크리너', why: `같은 섹터(${sectorName || '—'})에서 상대 순위가 높은 종목과 비교`, ctx: row.sector ? { sector: row.sector, ticker: symbol } : { ticker: symbol } });
  // v57.50 I12: 13F holders only when the reference ledger lists this ticker; the ledger's scope is stated.
  if (thirteenF?.covered && !isKr) {
    next.push({ route: 'masters', label: '운용사·13F', why: `이 종목을 신고한 운용사 — 13F 역조회 원장 ${finite(thirteenF.tickerCount) ?? '—'}개 종목 범위, 분기 지연 신고`, ctx: { ticker: symbol } });
  }
  return { available: true, symbol, name, headline, points, position, high, spans, sector, themes: themed, ranking, next, benchmarkLabel: benchmark?.label || 'S&P 500', sessionLag: lagSessions != null && lagSessions > 0 ? lagSessions : null };
}
