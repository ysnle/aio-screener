// P1437 (스크리너 redesign): before the table, say what the ranking is made of and how far to trust it —
// which sectors fill the top fifth (against their share of the universe), whether those sectors are the
// ones leading the rotation, how healthy the top names' trends are, and how the same ranking has done
// after the fact. Pure: the ranked rows, the rotation items, the regime and the validation summary.
import { SECTOR_ETF, normalizeSectorKey } from '../entity/stock-read.js';

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
// V13: labels are keyed by the canonical sector key only; aliases fold through normalizeSectorKey.
const SECTOR_KO = Object.freeze({ Technology: '기술', Financials: '금융', Energy: '에너지', Healthcare: '헬스케어', Industrials: '산업재', Consumer: '경기소비재', 'Consumer Defensive': '필수소비재', 'Real Estate': '부동산', Materials: '소재', Utilities: '유틸리티', 'Communication Services': '통신', ETF: 'ETF' });
const QUADRANT_KO = Object.freeze({ Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' });

export function sectorLabel(sector) {
  return SECTOR_KO[normalizeSectorKey(sector)] || sector || '분류 없음';
}

export function buildScreenerRead({ rows = [], rotation = {}, regime = null, validation = null } = {}) {
  const ranked = (Array.isArray(rows) ? rows : []).filter((row) => finite(row?.screenRank) != null).sort((a, b) => a.screenRank - b.screenRank);
  if (ranked.length < 20) return { available: false, reason: '순위가 계산된 종목이 20개 미만이라 구성을 읽지 않습니다.' };
  const topCount = Math.max(10, Math.round(ranked.length * 0.2));
  const top = ranked.slice(0, topCount);
  // X12 (2026-10-13): the floor of 10 makes a small list's "top" larger than 20% (10 of 25 = 40%); name it by count then.
  const exactQuintile = topCount === Math.round(ranked.length * 0.2);
  const topName = exactQuintile ? '상위 20%' : `상위 ${topCount}종목`;
  const topLabel = exactQuintile ? `상위 20%(${topCount}종목)` : `상위 ${topCount}종목(전체의 ${Math.round(topCount / ranked.length * 100)}%)`;
  const share = (list) => {
    const counts = new Map();
    for (const row of list) { const key = normalizeSectorKey(row.sector) || '분류 없음'; counts.set(key, (counts.get(key) || 0) + 1); }
    return counts;
  };
  const topShare = share(top);
  const allShare = share(ranked);
  const mix = [...topShare.entries()].map(([sector, count]) => ({
    sector, label: sectorLabel(sector), top: count / top.length * 100, all: (allShare.get(sector) || 0) / ranked.length * 100,
    quadrant: SECTOR_ETF[sector] && rotation[SECTOR_ETF[sector]] ? rotation[SECTOR_ETF[sector]].quadrant : null
  })).sort((a, b) => b.top - a.top);
  const over = mix.filter((row) => row.top - row.all >= 5).slice(0, 3);
  const points = [];
  if (over.length) {
    points.push({ id: 'mix', tone: 'neutral', title: '상위권 구성',
      text: `${topLabel}는 ${over.map((row) => `${row.label} ${row.top.toFixed(0)}%(전체 ${row.all.toFixed(0)}%)`).join(' · ')}로 쏠려 있습니다 — 순위가 개별 종목보다 업종 흐름을 먼저 반영하고 있다는 뜻입니다.` });
    const withQuadrant = over.filter((row) => row.quadrant);
    if (withQuadrant.length) {
      const leading = withQuadrant.filter((row) => row.quadrant === 'Leading' || row.quadrant === 'Improving');
      // v57.50 D12: the ranking (momentum·trend) and the rotation quadrant are both built from relative price strength,
      // so agreement between them is the same information seen twice — not a second confirmation. Neutral tone.
      points.push({ id: 'rotation', tone: 'neutral', title: '섹터 회전과',
        text: `${withQuadrant.map((row) => `${row.label} ${QUADRANT_KO[row.quadrant]}`).join(' · ')} — ${leading.length === withQuadrant.length ? '쏠린 업종이 섹터 회전에서도 앞서는 쪽입니다' : leading.length ? '쏠린 업종 중 일부만 섹터 회전에서 앞섭니다' : '쏠린 업종이 섹터 회전에서는 뒤처지는 쪽이라, 순위가 지난 강세를 늦게 반영하고 있을 수 있습니다'}. 순위와 섹터 회전은 같은 가격 상대강도 정보에서 나온 결과라, 둘이 같은 방향이어도 서로를 확인하는 독립 근거는 아닙니다.` });
    }
  } else {
    points.push({ id: 'mix', tone: 'neutral', title: '상위권 구성', text: `${topLabel}의 업종 비중이 전체와 비슷합니다 — 특정 업종 쏠림 없이 종목별 차이로 순위가 갈렸습니다.` });
  }
  const measured = top.filter((row) => finite(row.pctSma50) != null);
  if (measured.length) {
    const above = measured.filter((row) => row.pctSma50 > 0).length / measured.length * 100;
    const nearHigh = top.filter((row) => finite(row.pctFrom52wHigh) != null && row.pctFrom52wHigh > -5).length / top.length * 100;
    const breadth = regime?.axes?.find((axis) => axis.id === 'breadth');
    points.push({ id: 'health', tone: above >= 70 ? 'favorable' : above < 50 ? 'burden' : 'neutral', title: '상위권 추세',
      text: `${topName} 중 ${above.toFixed(0)}%가 50일선 위, ${nearHigh.toFixed(0)}%가 52주 고점 5% 이내${breadth?.state === 'burden' ? ` — 시장 전체는 50일선 위 종목이 적은데(시장 폭 ${breadth.stateLabel}) 상위권은 추세를 지키는 소수입니다` : ''}.` });
  }
  if (validation?.available) {
    const spread = finite(validation.spreadNet);
    // P1449: past performance is a claim about THIS model only when the stored record's model
    // fingerprint matches the live model. On mismatch (or a pre-fingerprint record) the
    // trust point says why it is not validation instead of quoting the old model's spread.
    if (validation.modelMatch === false) {
      points.push({ id: 'trust', tone: 'neutral', title: '순위의 과거 성과',
        text: '과거 기록이 지금 순위와 다른 모델(가중치·정의 지문 불일치)로 계산되어, 이 화면의 순위 검증으로 읽지 않습니다 — 기록이 다시 쌓이기 전까지 성과 문구는 표시하지 않습니다.' });
    } else if (validation.distinguishable === false) {
      // v57.50 D11: the same "cannot tell yet" admission as the validation panel — no 앞섬/뒤처짐 from a small sample.
      points.push({ id: 'trust', tone: 'neutral', title: '순위의 과거 성과',
        text: `${validation.undecided || '아직 구별 불가'} — 같은 순위를 과거 ${validation.rebalances}번 시점에 매겼을 때 상위 20%와 하위 20%의 평균 차이는 ${spread == null ? '—' : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%`}였지만 이 표본으로는 우연과 구별되지 않습니다. 순위는 차트·재무로 확인할 후보 목록으로 읽습니다.` });
    } else {
      points.push({ id: 'trust', tone: spread != null && spread > 0 ? 'favorable' : 'burden', title: '순위의 과거 성과',
        text: spread != null && spread > 0
          ? `같은 순위를 과거 ${validation.rebalances}번 시점에 매겼을 때 상위 20%가 하위보다 평균 ${spread.toFixed(2)}% 앞섰습니다(${validation.wins}/${validation.rebalances}회). 다만 지금 종목 구성으로 본 결과라 생존 편향이 있습니다.`
          : `같은 순위를 과거 ${validation.rebalances}번 시점에 매겼을 때 상위 20%가 하위보다 평균 ${spread == null ? '—' : spread.toFixed(2)}%로 뒤처졌고 ${validation.wins ?? '—'}/${validation.rebalances}회만 앞섰습니다 — 순위는 매수 목록이 아니라 차트·재무로 확인할 후보 목록으로 읽는 편이 맞습니다.` });
    }
  }
  const headline = `조건 순위가 매겨진 ${ranked.length}종목 중 ${topLabel}${over.length ? ` · ${over.map((row) => row.label).join('·')} 쏠림` : ''}${validation?.available && validation.modelMatch !== false && finite(validation.spreadNet) != null ? ` · 과거 상위−하위 ${validation.spreadNet >= 0 ? '+' : ''}${Number(validation.spreadNet).toFixed(2)}%` : ''}`;
  const next = [];
  if (over[0]) next.push({ route: 'themes', label: '테마 · 섹터', why: `${over[0].label} 쏠림이 섹터 회전에서 어떤 단계인지` });
  next.push({ action: 'showTicker', arg: top[0].sym, route: 'ticker', label: `1위 ${top[0].sym}`, why: '상위 종목 하나를 요약·차트·재무로 확인' });
  next.push({ route: 'signal', label: '시장 상태', why: `순위가 놓인 환경 — ${regime?.available ? regime.overall : '판정 대기'}` });
  return { available: true, total: ranked.length, topCount: top.length, topName, mix, headline, points, next };
}
