// P1438 (포트폴리오 redesign): the holdings read against the market they sit in — how much of the money
// is in names still in an uptrend, in sectors the rotation favours, how the book did against the S&P 500,
// and whether the market regime makes the weakest positions the first to watch. Value-weighted on the
// surface's base-currency values; a holding without a value or a screener row is left out and counted.
import { SECTOR_ETF } from '../entity/stock-read.js';
import { sectorLabel } from '../screener/screener-read.js';

// v57.50 I11: one sector vocabulary on the portfolio screen — the screener's labels (기술·헬스케어·부동산 …), plus the
// two portfolio-only buckets. 'Financial Services' is the import alias of the screener's Financials.
const PORTFOLIO_ONLY_SECTORS = Object.freeze({ CASH: '현금', Unclassified: '미분류' });
// P2115: recent-check.js leads its clause with ', ' since v58.73 (' · ' before); strip either so no stray ' ,' is printed.
const CLAUSE_LEAD = /^(?:, | · )/;
export function portfolioSectorLabel(name) {
  return PORTFOLIO_ONLY_SECTORS[name] || sectorLabel(name === 'Financial Services' ? 'Financials' : name);
}
import { buildAttribution } from './attribution.js';
import { rrgRecentReading } from '../themes/recent-check.js';
import { koreaRecordText, KR_SHOCK_TAIL_PCT } from '../briefing/market-read.js';
import { signedText, readNumber as finite } from '../shared/number.js';
import { hasLeadingIsoDay } from '../shared/session-date.js';

const signed = (value, digits = 1, unit = '%') => signedText(value, digits, unit);
const QUADRANT = Object.freeze({ Leading: { label: '선도', tone: 'favorable' }, Improving: { label: '개선', tone: 'neutral' }, Weakening: { label: '약화', tone: 'neutral' }, Lagging: { label: '후행', tone: 'burden' } });

// v57.81 (analysis audit 2026-10-15): a quadrant is a ~50-session reading. XLK sat at RS-Ratio 100.33 — inside the RRG
// neutral band — and trailed the S&P 500 by 4.5%p in five sessions, yet 59% of the book read '선도'. A point in the band
// is 판정 보류(기준선 부근); a last-five-session move against the quadrant beyond the line's own noise is 약화 중/반등 중. Neither
// counts toward the favourable/burden tone. Band and reversal come from the themes owner (recent-check.js).
function rotationQuadrant(item) {
  if (!QUADRANT[item?.quadrant]) return null;
  const reading = rrgRecentReading(item, item?.relativeStrength || null);
  // v57.84 (owner decision 3-3): the settled quadrant (own-noise band + hysteresis), as on 테마 · 섹터.
  const base = QUADRANT[reading?.quadrant || item.quadrant];
  if (reading?.border) return { label: '판정 보류(기준선 부근)', tone: 'neutral', held: true, base: base.label, why: `상대강도가 100 부근(${reading.between} 사이)${reading.clause ? `이고 ${reading.clause.replace(CLAUSE_LEAD, '')}` : ''}` };
  if (reading?.reversal) return { label: `${base.label}, ${reading.reversal === 'fell' ? '약화 중' : '반등 중'}`, tone: 'neutral', held: true, base: base.label, why: reading.clause.replace(CLAUSE_LEAD, '') };
  return { ...base, held: false, base: base.label, why: '' };
}

// v57.81: a holding 0.38% above its 50-day line (QQQ, 5 sessions -3.8%) is on the line, not in an uptrend. Within
// ±max(1%, the holding's average daily range) of either line the state is 선 근처(판정 보류) — the same idea as the
// market-read trend buffer, with a per-holding band because one day's ordinary range can cross the line.
export const TREND_BUFFER_MIN_PCT = 1;
// v57.81: the Korean part of a book is read beside the US verdict once it is at least this share of the holdings.
export const KR_BOOK_SHARE_PCT = 30;
function trendState(row) {
  const s50 = finite(row?.pctSma50);
  const s200 = finite(row?.pctSma200);
  if (s50 == null || s200 == null) return null;
  const band = Math.max(TREND_BUFFER_MIN_PCT, finite(row?.adrPct) ?? 0);
  if (Math.abs(s50) < band || Math.abs(s200) < band) return 'near';
  return s50 >= 0 && s200 >= 0 ? 'up' : s50 < 0 && s200 >= 0 ? 'pullback' : s50 >= 0 ? 'rebound' : 'down';
}
export const TREND_LABEL = Object.freeze({ up: '상승 추세', near: '선 근처(판정 보류)', pullback: '추세 속 조정', rebound: '장기 추세 아래 반등', down: '하락 추세' });
const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));

export function buildPortfolioRead({ surface = null, rows = [], benchmark = null, benchmarkFor = null, marketReturnFor = null, usdkrwReturnPct = null, usdkrwAsOf, rotation = {}, regime = null, krRecord = null } = {}) {
  // P1449: like the checks panel, this read refuses sums it cannot honestly stand behind.
  // A mixed surface without declared FX legs holds only local-unit values — summing them is
  // the same fabrication the surface already refuses (P1175), while an undeclared-single
  // basis is a disclosed assumption, not a mix.
  if (surface && surface.currencyState === 'mixed-without-conversion') {
    return { available: false, reason: `통화가 다른 보유가 섞여 있는데 환율이 선언되지 않아(${(surface.declaredCurrencies || []).join('/')}) 비중·회전·지수 대비를 한 통화로 만들 수 없습니다. 포트폴리오 설정에서 환율을 선언하면 다시 표시됩니다.` };
  }
  const bySymbol = new Map((rows || []).map((row) => [String(row?.sym || '').toUpperCase(), row]));
  const holdings = (Array.isArray(surface?.rows) ? surface.rows : [])
    .map((row) => ({ symbol: String(row?.symbol || row?.ticker || '').toUpperCase(), value: finite(row?.value), convertedFrom: row?.convertedFrom || null, sector: row?.sector || null }))
    .filter((row) => row.symbol && row.value != null && row.value > 0)
    .map((row) => ({ ...row, data: bySymbol.get(row.symbol) || null }));
  const total = holdings.reduce((sum, row) => sum + row.value, 0);
  if (!holdings.length || !(total > 0)) return { available: false, empty: true, reason: '평가액이 있는 보유 종목이 없어 시장과 연결해 읽을 내용이 없습니다.' };
  const known = holdings.filter((row) => row.data);
  const knownValue = known.reduce((sum, row) => sum + row.value, 0);
  const points = [];

  const trends = { up: 0, near: 0, pullback: 0, rebound: 0, down: 0 };
  let trendTotal = 0;
  for (const row of known) { const state = trendState(row.data); if (state) { trends[state] += row.value; trendTotal += row.value; } }
  const trendMix = trendTotal > 0 ? Object.entries(trends).map(([state, value]) => ({ state, label: TREND_LABEL[state], pct: value / trendTotal * 100 })) : [];
  // P1449: the share must say what population it was measured on. A "% of 평가액" headline
  // computed over only the SMA-reported subset (50·200일선 둘 다 있는 종목) is an undisclosed
  // denominator — publish the contained fraction beside every trend share.
  const trendContainedPct = total > 0 ? trendTotal / total * 100 : 0;
  const trendBasisNote = trendContainedPct >= 100 ? '' : `(추세 판정 가능 보유액 ${trendContainedPct.toFixed(0)}% 기준, 미판정 종목은 추세 분모에서 제외)`;
  const weakest = known.filter((row) => trendState(row.data) === 'down').sort((a, b) => b.value - a.value);
  const breadth = regime?.axes?.find((axis) => axis.id === 'breadth');
  if (trendMix.length) {
    const up = trendMix.find((row) => row.state === 'up').pct;
    const near = trendMix.find((row) => row.state === 'near').pct;
    const down = trendMix.find((row) => row.state === 'down').pct;
    // v57.81: the breadth axis is the US sample's, so its clause speaks only to the US holdings (on the same denominator).
    const usTrend = known.filter((row) => !isKr(row.symbol) && trendState(row.data));
    // Codex audit F08: "미국 보유 중" is a share of the US holdings with a trend read, not of every market's.
    const usTrendValue = usTrend.reduce((sum, row) => sum + row.value, 0);
    const usDown = usTrendValue > 0 ? usTrend.filter((row) => trendState(row.data) === 'down').reduce((sum, row) => sum + row.value, 0) / usTrendValue * 100 : 0;
    const breadthClause = breadth?.state !== 'burden' || !usTrend.length ? ''
      : usDown > 0 ? ` 미국 시장 폭이 좁은 지금은 미국 보유 중 하락 추세 종목(${usDown.toFixed(0)}%)이 지수보다 먼저 흔들리기 쉬운 환경입니다.`
        : ' 미국 시장 폭이 좁은 가운데 미국 보유 종목은 하락 추세에 있지 않습니다.';
    points.push({ id: 'trend', tone: up >= 60 ? 'favorable' : down >= 30 ? 'burden' : 'neutral', title: '보유 종목 추세',
      text: `${trendBasisNote ? trendBasisNote + ': ' : ''}그중 ${up.toFixed(0)}%가 상승 추세(50·200일선 위), ${down.toFixed(0)}%가 하락 추세에 있습니다${near > 0 ? `. ${near.toFixed(0)}%는 50일선이나 200일선과의 차이가 하루 평균 변동폭(최소 ${TREND_BUFFER_MIN_PCT}%) 안이라 방향 판정을 보류합니다` : ''}${weakest.length ? ` — 하락 추세 중 가장 큰 비중은 ${weakest.slice(0, 2).map((row) => `${row.symbol}(${(row.value / trendTotal * 100).toFixed(0)}%, 평가액의 ${(row.value / total * 100).toFixed(0)}%)`).join(', ')}` : ''}.${breadthClause}` });
  }

  // v57.50 C24: one denominator and one classification with the 비중 · 섹터 배분 bars (surface.sectorBreakdown) — total
  // assets including cash, sectors from the surface rows (the screener row via derivePortfolioSurface's sectorOf). When
  // no total exists (cash undeclared) the shares are of the stock part, and every sentence says "주식 부분 중".
  const totalAssets = finite(surface?.totalAssets);
  const assetBasis = totalAssets != null && totalAssets > 0;
  const denom = assetBasis ? totalAssets : total;
  const basisWord = assetBasis ? '총자산(현금 포함)' : '주식 부분';
  const sectors = new Map();
  for (const row of holdings) {
    const sector = row.sector && row.sector !== 'Unclassified' ? row.sector : row.data?.sector || 'Unclassified';
    const entry = sectors.get(sector) || { sector, label: portfolioSectorLabel(sector), value: 0, krValue: 0 };
    entry.value += row.value;
    if (/\.(KS|KQ)$/i.test(row.symbol)) entry.krValue += row.value;
    sectors.set(sector, entry);
  }
  const cashValue = finite(surface?.cash);
  if (assetBasis && cashValue != null && cashValue > 0) sectors.set('CASH', { sector: 'CASH', label: portfolioSectorLabel('CASH'), value: cashValue, krValue: 0 });
  const sectorMix = [...sectors.values()].map((entry) => {
    // P1449: the rotation quadrants are defined on US sector ETFs. A sector bucket that
    // contains a KRX holding (005930.KS 등) must not silently inherit an XLK-style reading —
    // display says 비중만, and the KR share inside the bucket is disclosed.
    const krShare = entry.value > 0 ? entry.krValue / entry.value : 0;
    const etf = krShare >= 0.999 ? null : SECTOR_ETF[entry.sector];
    const quadrant = etf && rotation[etf] ? rotationQuadrant(rotation[etf]) : null;
    return { ...entry, pct: entry.value / denom * 100, quadrant, krShare, basis: assetBasis ? 'total-assets-including-cash' : 'stock-part' };
  }).sort((a, b) => b.value - a.value);
  const rated = sectorMix.filter((row) => row.quadrant);
  if (rated.length) {
    // E03: only the US part of a bucket inherits a US sector-ETF quadrant; a KRX holding in the same sector does not.
    const usPct = (row) => (row.value - row.krValue) / denom * 100;
    const favourable = rated.filter((row) => !row.quadrant.held && row.quadrant.tone === 'favorable').reduce((sum, row) => sum + usPct(row), 0);
    const lagging = rated.filter((row) => !row.quadrant.held && row.quadrant.tone === 'burden').reduce((sum, row) => sum + usPct(row), 0);
    const heldRows = rated.filter((row) => row.quadrant.held);
    const heldPct = heldRows.reduce((sum, row) => sum + usPct(row), 0);
    const krPct = sectorMix.reduce((sum, row) => sum + row.krValue, 0) / denom * 100;
    const krNote = krPct > 0 ? ` 한국 보유(${krPct.toFixed(0)}%)는 미국 섹터 회전으로 분류하지 않아 위 비율에서 빠집니다.` : '';
    const heldNote = heldPct > 0 ? ` ${heldPct.toFixed(0)}%는 판정을 보류합니다 — ${heldRows.map((row) => `${row.label} ${row.pct.toFixed(0)}%: '${row.quadrant.base}' 사분면이지만 ${row.quadrant.why}`).join(', ')}.` : '';
    points.push({ id: 'rotation', tone: favourable === 0 && lagging === 0 ? 'neutral' : favourable >= lagging ? 'favorable' : 'burden', title: '섹터 회전과',
      text: `${basisWord} 중 ${favourable.toFixed(0)}%가 시장보다 강해지는 '선도' 섹터, ${lagging.toFixed(0)}%가 '후행' 섹터에 있습니다(약 50거래일 상대강도 기준) (${sectorMix.slice(0, 3).map((row) => `${row.label} ${row.pct.toFixed(0)}%${row.quadrant ? (row.krShare > 0 ? `(미국 보유분 ${usPct(row).toFixed(0)}% ${row.quadrant.label})` : ` ${row.quadrant.label}`) : ''}`).join(', ')}).${heldNote}${krNote}` });
  }

  // P1466: one decomposition answers both "how did the book do against its index" and "why".
  // Book and benchmark share one population (holdings with a 3-month return, a market return and,
  // when converted, an FX return — P1449), and the gap is split into sector, stock, FX and cash.
  const attribution = buildAttribution({
    holdings: known,
    cash: surface?.cash ?? null,
    baseCurrency: surface?.baseCurrency || null,
    rowFor: (symbol) => (symbol === undefined ? null : bySymbol.get(String(symbol).toUpperCase()) || null),
    marketReturnFor: typeof marketReturnFor === 'function' ? marketReturnFor : typeof benchmarkFor === 'function' ? benchmarkFor : () => benchmark,
    usdkrwReturnPct,
    usdkrwAsOf,
    holdingsValue: total // #10: the whole book, so held-out names do not inflate the cash share
  });
  const book3 = attribution.available ? attribution.totalPct : null;
  const bench3 = attribution.available ? attribution.blendedPct : null;
  const relativeBasisNote = attribution.available && attribution.coveredPct != null && attribution.coveredPct < 100 ? ` (수익률·비교 지수가 확인된 보유액 ${attribution.coveredPct.toFixed(0)}% 기준)` : '';
  if (attribution.available) {
    const gap = attribution.excessPct;
    const parts = attribution.excess.filter((part) => Math.abs(part.pct) >= 0.05).map((part) => `${part.label} ${signed(part.pct, 1, '%p')}`).join(', ');
    const lead = attribution.topStock[0];
    points.push({ id: 'relative', tone: gap >= 0 ? 'favorable' : 'burden', title: '지수 대비',
      text: `지금 구성의 3개월 수익률 ${signed(book3)}(환율 포함, 현금은 수익률 0%로 계산) vs ${attribution.blendedLabel} ${signed(bench3)}${relativeBasisNote} — ${Math.abs(gap).toFixed(1)}%p ${gap >= 0 ? '앞섭니다' : '뒤처집니다'}. 차이의 구성: ${parts || '모두 0.1%p 미만'}${lead && Math.abs(lead.stockPct) >= 0.1 ? `(종목 선택에서 가장 큰 기여는 ${lead.symbol} ${signed(lead.stockPct, 1, '%p')})` : ''}. 실제 매매 시점과 다를 수 있는 현재 구성 기준 값입니다.` });
  }
  // v57.81 (analysis audit 2026-10-15): the tally is the six US axes, so it is named as the US state, and its sentence
  // follows the overall label (부담 우세 at burden 3 · favourable 1 read "극단적이지 않아"). A book whose Korean part is at
  // least KR_BOOK_SHARE_PCT gets its own line from the KOSPI record (koreaMoveRecord): a record-low KOSPI week beside a
  // 70%-Korean book is not a calm environment for that book.
  const krHeldPct = holdings.filter((row) => isKr(row.symbol)).reduce((sum, row) => sum + row.value, 0) / total * 100;
  const krLine = krHeldPct >= KR_BOOK_SHARE_PCT ? koreanBookLine(krRecord, krHeldPct) : null;
  if (regime?.available) {
    const overall = regime.overall;
    const burdenSide = overall === '부담 우세' || overall === '다소 부담';
    const usSentence = overall === '판정 보류' ? (regime.holdReason || '미국 지표가 부족해 판정을 보류합니다.')
      : burdenSide ? '부담 지표가 많은 환경이라, 위 하락 추세 비중과 후행 섹터 비중이 시장 약세에 함께 노출된 부분입니다.'
        : overall === '양호 우세' || overall === '다소 양호' ? '양호한 지표가 많아, 하락 추세 보유 종목은 시장보다 종목 자체의 이유를 먼저 확인할 국면입니다.'
          : krLine ? '미국 지표는 엇갈립니다.' : '미국 지표가 엇갈려 지수 방향보다 보유 종목별 추세가 더 많은 것을 말해 주는 국면입니다.';
    points.push({ id: 'market', tone: burdenSide || krLine?.tone === 'burden' ? 'burden' : 'neutral', title: '시장 환경',
      text: `미국 시장 상태(6개 지표)는 ‘${overall}’(양호 ${regime.counts.favorable}, 부담 ${regime.counts.burden})입니다. ${usSentence}${krLine ? ` ${krLine.text}` : ''}` });
  } else if (krLine) {
    points.push({ id: 'market', tone: krLine.tone, title: '시장 환경', text: krLine.text });
  }
  const excluded = holdings.length - known.length;
  const excludedValue = total - knownValue;
  // v57.55 review (8g, beginner panel): the first line is a plain sentence that names its own denominator, not a row of chips.
  const unpriced = (Array.isArray(surface?.rows) ? surface.rows : []).filter((row) => (row?.symbol || row?.ticker) && !(finite(row?.value) > 0)).length;
  const unpricedNote = unpriced ? `(가격을 아직 못 받은 ${unpriced}종목 제외)` : '';
  const plainBasis = trendContainedPct >= 99.5
    ? (unpriced ? `가격을 확인한 보유분${unpricedNote} 기준으로` : '보유 종목 전체 기준으로')
    : `추세를 확인한 보유분(평가액의 ${trendContainedPct.toFixed(0)}%${unpriced ? `, 가격 미확인 ${unpriced}종목 제외` : ''}) 기준으로`;
  const upPct = trendMix.find((row) => row.state === 'up')?.pct;
  const downPct = trendMix.find((row) => row.state === 'down')?.pct;
  const nearPct = trendMix.find((row) => row.state === 'near')?.pct;
  // v57.84 review: the mix names the remainder (조정·반등) so the shares add up, and the 3-month line says it is the
  // current holdings looked back on, not the account's own track record.
  const otherPct = trendMix.length ? Math.max(0, 100 - (upPct || 0) - (downPct || 0) - (nearPct || 0)) : 0;
  const headline = [trendMix.length ? `${plainBasis} ${(upPct || 0).toFixed(0)}%는 오르는 흐름(50·200일선 위), ${(downPct || 0).toFixed(0)}%는 내리는 흐름입니다${otherPct >= 1 ? `, 조정·반등 ${otherPct.toFixed(0)}%` : ''}${nearPct > 0 ? `(${nearPct.toFixed(0)}%는 선 근처라 판정 보류)` : ''}.` : null,
    book3 != null && bench3 != null ? `지금 구성으로 계산하면 최근 3개월은 지수보다 ${Math.abs(book3 - bench3).toFixed(1)}%p ${book3 >= bench3 ? '앞섰습니다' : '뒤처졌습니다'}${relativeBasisNote}.` : null,
    regime?.available ? `미국 시장 상태는 '${regime.overall}'입니다.` : null, krLine?.headline || null].filter(Boolean).join(' ');
  const next = [];
  if (weakest[0]) next.push({ action: 'showTicker', arg: weakest[0].symbol, route: 'ticker', label: weakest[0].symbol, why: '하락 추세 중 비중이 가장 큰 종목의 요약·차트' });
  next.push({ route: 'themes', label: '테마와 섹터', why: '보유 섹터가 회전의 어느 단계에 있는지' });
  next.push({ route: 'signal', label: '시장 상태', why: '부담 지표가 무엇이고 무엇이 바뀌면 완화되는지' });
  return { available: true, total, headline, points, trendMix, sectorMix, attribution, excluded, excludedValue, containedPct: trendContainedPct, next };
}

// v57.81: the Korean part of the book against the KOSPI's own record (koreaMoveRecord). The record position is named
// only in the tail (KR_SHOCK_TAIL_PCT, the briefing's cut); otherwise the moves alone.
function koreanBookLine(record, krPct) {
  const share = `한국 보유(평가액의 ${krPct.toFixed(0)}%)는 미국 6개 지표 판정에 들어가지 않습니다`;
  if (!record || record.d1 == null || !record.date) return { tone: 'neutral', text: `${share}. 코스피 종가 기록을 확인하지 못해 한국 쪽은 따로 판정하지 않습니다.`, headline: null };
  const md = `${Number(record.date.slice(5, 7))}/${Number(record.date.slice(8, 10))}`;
  const moves = `코스피 ${md} 하루 ${signed(record.d1)}${record.d5 != null ? `, 5거래일 ${signed(record.d5)}` : ''}`;
  const rare = record.extreme ? koreaRecordText(record, { maxTail: KR_SHOCK_TAIL_PCT }) : '';
  if (!rare) return { tone: 'neutral', text: `${share} — ${moves}.`, headline: null };
  const falling = Math.min(record.d1 ?? 0, record.d5 ?? 0) < 0;
  return { tone: falling ? 'burden' : 'neutral',
    text: `${share} — ${moves}로 ${rare}입니다. 한국 보유분은 이 드문 ${falling ? '하락' : '상승'}에 직접 노출돼 있어 미국 판정과 따로 읽어야 합니다.`,
    headline: `한국 보유가 평가액의 ${krPct.toFixed(0)}%이고, ${moves}로 ${rare}입니다.` };
}

// v57.48 expert review #12: what the portfolio AI request may carry — ticker, sector, weight and return
// only (no quantity, cost, amount or memo), measured on the surface's base-currency values so a won and a
// dollar holding are weighed in one unit. The base currency and the valuation date travel with the rows.
export function portfolioRowsForAI(surface, { sectorOf = () => null } = {}) {
  if (!surface || surface.currencyState === 'mixed-without-conversion') return { available: false, reason: 'currency-unconverted', rows: [] };
  const total = finite(surface.totalAssets);
  const costComparable = surface.costCurrencyState !== 'cost-price-mismatch-held' && !(surface.conversion?.costHeld?.length);
  const round1 = (value) => Math.round(value * 10) / 10;
  const rows = (Array.isArray(surface.rows) ? surface.rows : []).filter((row) => row?.symbol).map((row) => {
    const value = finite(row.value);
    const cost = finite(row.cost);
    return {
      ticker: String(row.symbol).toUpperCase().slice(0, 16),
      sector: String(sectorOf(row.symbol) || row.sector || '미분류').slice(0, 48),
      allocationPct: value != null && total > 0 ? round1(value / total * 100) : null,
      returnPct: costComparable && value != null && cost > 0 ? round1((value - cost) / cost * 100) : null
    };
  });
  const asOf = hasLeadingIsoDay(String(surface.observedAt || '')) ? String(surface.observedAt).slice(0, 10) : null;
  // v57.81: which currencies the cash is held in and the rate basis of its total — currencies only, never amounts.
  const cashCurrencies = (Array.isArray(surface.cashBalances) ? surface.cashBalances : []).filter((row) => row?.currency && finite(row.amount) > 0).map((row) => row.currency);
  return { available: true, baseCurrency: surface.baseCurrency || null, currencyState: surface.currencyState || null, asOf, cashPct: finite(surface.cashPct) == null ? null : round1(surface.cashPct), cashCurrencies, cashBasis: surface.cashConversion?.converted ? surface.cashConversion.basisLabel || null : null, rows };
}
