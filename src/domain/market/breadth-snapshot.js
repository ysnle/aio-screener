// P1620: one completed session and one history producer; never combine snapshot counts with history ratios.
import { buildCloseSeries, closeBasis } from '../briefing/market-read.js';

export function buildBreadthSnapshot(history = []) {
  const asOf = closeBasis(history);
  if (!asOf) return { asOf: null, cards: [] };
  const point = (field) => buildCloseSeries(history, field, { through: asOf, includeProvenance: true }).findLast((row) => row.date === asOf);
  const row = [...history].reverse().find((entry) => entry?.date === asOf);
  const meta = (field) => row?.fieldMeta?.[field] || {};
  const cards = [];
  const add = (id, title, first, second, share, field, detail) => cards.push({ id, title, first, second, share, eligible: meta(field).eligible ?? null, universe: meta(field).universe ?? null, detail });
  const advance = point('advanceRatio');
  if (advance) {
    const share = advance.value <= 1 ? advance.value * 100 : advance.value;
    if (share >= 0 && share <= 100) add('advance', '상승 · 하락 종목', `상승 ${share.toFixed(1)}%`, `하락 ${(100 - share).toFixed(1)}%`, share, 'advanceRatio', '전일 종가보다 오른 종목 / 상승·하락 종목 합계. 보합 제외. 원시 종목 수는 이 기록에 없어 비율에서 역산하지 않습니다.');
  }
  const highs = point('breadthNewHighs'), lows = point('breadthNewLows');
  if (highs && lows) {
    const total = highs.value + lows.value;
    add('high-low', '52주 신고가 · 신저가', `신고가 ${highs.value}개`, `신저가 ${lows.value}개`, total > 0 ? highs.value / total * 100 : null, 'breadthNewHighs', `조정 고가·저가의 약 1년 범위. 막대는 신고·신저 발생 ${total}건 중 비중이며 전체 종목 중 비율이 아닙니다.`);
  }
  for (const [field, days] of [['breadth50', 50], ['breadth200', 200]]) {
    const reading = point(field);
    if (reading && reading.value >= 0 && reading.value <= 100) add(field, `${days}일선 위 종목`, `위 ${reading.value.toFixed(1)}%`, `나머지 ${(100 - reading.value).toFixed(1)}%`, reading.value, field, `조정 종가가 ${days}일 단순이동평균보다 높은 종목의 동일 비중 비율. 나머지는 같은 가격과 아래를 포함합니다.`);
  }
  return { asOf, cards };
}
