// P1434 (종목 요약 redesign, owner direction 2026-10-04): the summary tab answers "what state is this
// stock in, and why" in one connected reading — trend, where it sits in its 52-week range, how it did
// against the S&P 500, its sector's rotation and the market it trades in — each tied to the next.
// Pure: every input is the published screener row, the SPY row of the same artifact, the sector /
// theme rotation items and the market regime. A missing input drops its sentence; nothing is guessed.

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
// 은/는 by the final Hangul syllable of the label (the ticker in parentheses is not read).
const topic = (label) => { const code = String(label || '').charCodeAt(String(label || '').length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '은' : '는'; };
const signed = (value, digits = 1, unit = '%') => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;

// GICS-style sector names in the screener artifact → the SPDR sector ETF tracked by the rotation model.
export const SECTOR_ETF = Object.freeze({
  Technology: 'XLK', Financials: 'XLF', Energy: 'XLE', Healthcare: 'XLV', Industrials: 'XLI',
  'Consumer Cyclical': 'XLY', Consumer: 'XLY', 'Consumer Defensive': 'XLP', 'Real Estate': 'XLRE',
  Materials: 'XLB', 'Basic Materials': 'XLB', Utilities: 'XLU', 'Communication Services': 'XLC'
});
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

export function buildStockRead({ symbol, row = null, benchmark = null, rotation = {}, themes = [], regime = null, universeSize = null } = {}) {
  if (!row) return { available: false, reason: `${symbol || '이 종목'}은 스크리너 유니버스 밖이라 추세·상대강도 기록이 없습니다. 차트 탭의 일봉과 재무 공시는 그대로 볼 수 있습니다.` };
  const name = row.name || symbol;
  const points = [];
  const trend = trendOf(row);
  if (trend) points.push({ id: 'trend', tone: trend.tone, title: '추세', text: `${trend.text}.` });

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
      text: `${anchor.label} ${signed(anchor.stock)} vs S&P 500 ${signed(anchor.bench)} — ${Math.abs(anchor.gap).toFixed(1)}%p ${anchor.gap >= 0 ? '강함' : '약함'}. ${consistency}.` });
  }

  const rsi = finite(row.rsi);
  if (rsi != null) {
    points.push({ id: 'rsi', tone: rsi >= 70 || rsi <= 30 ? 'neutral' : 'favorable', title: '단기 과열',
      text: rsi >= 70 ? `RSI ${rsi.toFixed(0)} — 과열권이라 추세가 강해도 쉬어 가기 쉬운 자리입니다.` : rsi <= 30 ? `RSI ${rsi.toFixed(0)} — 과매도권이라 반등 시도가 나오기 쉬운 자리이지만 추세 확인이 먼저입니다.` : `RSI ${rsi.toFixed(0)} — 과열도 과매도도 아닌 구간입니다.` });
  }

  const etf = SECTOR_ETF[row.sector] || null;
  const sector = etf && rotation[etf] ? { etf, label: SECTOR_KO[etf] || etf, quadrant: QUADRANT[rotation[etf].quadrant] || null } : null;
  const themed = (themes || []).map((theme) => ({ ...theme, quadrant: theme.etf && rotation[theme.etf] ? QUADRANT[rotation[theme.etf].quadrant] || null : null }));
  const topTheme = themed.find((theme) => theme.quadrant) || themed[0] || null;
  if (sector?.quadrant || topTheme?.quadrant) {
    const parts = [];
    if (sector?.quadrant) parts.push(`섹터 ${sector.label}(${sector.etf})${topic(sector.label)} ${sector.quadrant.label} — ${sector.quadrant.read}`);
    if (topTheme?.quadrant && topTheme.etf !== sector?.etf) parts.push(`테마 ${topTheme.label}(${topTheme.etf})${topic(topTheme.label)} ${topTheme.quadrant.label}`);
    const tailwind = sector?.quadrant?.tone === 'favorable' || topTheme?.quadrant?.tone === 'favorable';
    const stockStrong = trend?.id === 'up';
    const tie = tailwind && stockStrong ? '종목 강세가 섹터 흐름과 같은 방향입니다' : !tailwind && stockStrong ? '섹터 흐름이 약한데 종목만 강한 개별 강세입니다' : tailwind && !stockStrong ? '섹터는 강한데 종목은 뒤처져 있습니다' : '섹터와 종목이 함께 약합니다';
    points.push({ id: 'sector', tone: tailwind ? 'favorable' : 'neutral', title: '섹터·테마', text: `${parts.join(' · ')}. ${tie}.` });
  }

  const breadth = regime?.axes?.find((axis) => axis.id === 'breadth');
  if (regime?.available && regime.overall) {
    const narrow = breadth?.state === 'burden';
    const text = narrow && trend?.id === 'up' ? `시장은 ${regime.overall}이고 시장 폭이 좁습니다(50일선 위 종목이 적음). 이 종목은 그 소수에 속해 지수를 받치는 쪽입니다 — 주도주가 꺾이면 지수도 흔들린다는 뜻이기도 합니다.`
      : narrow ? `시장은 ${regime.overall}이고 시장 폭이 좁아, 추세가 약한 종목은 지수보다 먼저 흔들리기 쉬운 환경입니다.`
        : `시장은 ${regime.overall}${breadth ? `, 시장 폭은 ${breadth.stateLabel}` : ''}입니다.`;
    points.push({ id: 'market', tone: regime.counts?.burden >= 4 ? 'burden' : 'neutral', title: '시장 환경', text });
  }

  const rank = finite(row.screenRank);
  const ranking = rank != null && finite(universeSize) ? { rank, of: universeSize, topPct: Math.max(1, Math.round(rank / universeSize * 100)) } : null;
  const relative3 = spans.find((span) => span.key === 'ret3m');
  const headline = [
    trend ? trend.label : null,
    position != null ? `52주 범위 ${Math.round(position * 100)}% 지점` : null,
    relative3?.gap != null ? `3개월 지수 대비 ${signed(relative3.gap, 1, '%p')}` : null,
    sector?.quadrant ? `섹터 ${sector.quadrant.label}` : null
  ].filter(Boolean).join(' · ');
  const next = [{ route: 'technical', label: '차트', why: trend ? `${trend.label}의 셋업 — 이동평균·피벗·거래량으로 지금 자리가 돌파 전인지 확인` : '일봉과 이동평균 위치' },
    { route: 'fundamental', label: '재무 공시', why: '이 추세를 매출·이익·현금흐름이 뒷받침하는지' }];
  if (topTheme?.id) next.push({ action: 'showThemeDetail', arg: topTheme.id, route: 'themes', label: `테마 · ${topTheme.label}`, why: '같은 테마 안에서 누가 앞서는지' });
  next.push({ route: 'screener', label: '스크리너', why: `같은 섹터(${sector?.label || row.sector || '—'})에서 상대 순위가 높은 종목과 비교` });
  return { available: true, symbol, name, headline, points, position, high, spans, sector, themes: themed, ranking, next };
}
