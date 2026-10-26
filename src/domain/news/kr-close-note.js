// v58.74: an intraday KOSPI/KOSDAQ crash or surge headline ("코스피 5,500선 붕괴", 10/23 09:19 KST) carries that session's
// completed close when the close reversed it (+0.30%), so it reads as the intraday move it was.
import { buildCloseSeries } from '../market/close-series.js';
import { countOpenSessionsBetween, resolveMarketCalendarSession } from '../market/market-calendar.js';

const DOWN = /폭락|급락|최대\s*낙폭|패닉|붕괴|투매|와르르|plung|crash|tumbl|\brout\b/i;
const UP = /폭등|급등|soar|surg/i;
const hhmm = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));

function kstParts(ms) {
  const kst = new Date(ms + 9 * 3600000);
  return { date: kst.toISOString().slice(0, 10), minute: kst.getUTCHours() * 60 + kst.getUTCMinutes() };
}

export function krIndexCloseNote(item, history = []) {
  const title = String(item?.title || '');
  const kospi = /코스피|KOSPI/i.test(title), kosdaq = /코스닥|KOSDAQ/i.test(title);
  if (!kospi && !kosdaq) return null;
  const down = DOWN.test(title), up = UP.test(title);
  if (down === up) return null;
  const published = Date.parse(item?.pubDate || item?.publishedAt || item?.ts || '');
  if (!Number.isFinite(published)) return null;
  const { date, minute } = kstParts(published);
  const session = resolveMarketCalendarSession({ market: 'KR', date }); // v58.82: 수능일 10:00-16:30
  if (session.status !== 'open' || minute < hhmm(session.open) || minute >= hhmm(session.close)) return null;
  const field = kospi ? 'kospi' : 'kosdaq';
  const series = buildCloseSeries(history, field);
  const at = series.findIndex((point) => point.date === date);
  if (at < 1 || countOpenSessionsBetween(series[at - 1].date, date, 'KR') !== 1) return null;
  const change = (series[at].value / series[at - 1].value - 1) * 100;
  if (!Number.isFinite(change) || (down && change < 0) || (up && change > 0)) return null;
  const md = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  return `${kospi ? '코스피' : '코스닥'} ${md} 마감 ${change >= 0 ? '+' : '-'}${Math.abs(change).toFixed(2)}%, 기사 이후 장중에 방향이 바뀌었습니다`;
}
