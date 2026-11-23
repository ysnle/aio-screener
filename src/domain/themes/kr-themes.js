import { median as sharedMedian } from './theme-medians.js';
import { heavyweightsOf, heavyweightLine } from './group-strength.js';
import { signedText } from '../shared/number.js';
import { isoDay, latestSessionRows } from '../shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';

const value = (row, key) => readRowNumber(row, key);

export const KR_THEME_LABELS = Object.freeze({
  defense: 'K-방산 / 항공우주',
  semi: '반도체 / HBM',
  shipbuilding: '조선 / 해양',
  'ai-sw': 'AI / 소프트웨어',
  'power-grid': '전력기기 / 변압기',
  nuclear: '원전 / SMR',
  battery: '2차전지 / 배터리',
  bio: '바이오 / 제약',
  kbeauty: 'K-뷰티 / 화장품',
  kcontent: 'K-콘텐츠 / 엔터',
  auto: '자동차 / EV',
  robot: '로봇 / 자동화',
  finance: '금융',
  kfood: 'K-푸드 / 식품',
  crypto: '크립토 / 블록체인',
  telecom: '통신',
  construction: '건설 / 인프라',
  retail: '유통 / 리테일',
  steel_chem: '철강 / 화학 / 소재',
  logistics: '물류 / 운송 / 항공',
  medtech_kr: '의료기기 / 디지털헬스',
  energy_kr: '에너지 / 정유',
  photonics_kr: '광통신 / 포토닉스',
  wind_solar: '풍력 / 태양광 / 신재생',
  hydrogen: '수소에너지'
});

export function krThemeLabel(themeId) {
  return KR_THEME_LABELS[themeId] || String(themeId || '');
}

/** `005930`, `005930.KS` or `005930.KQ` → the 6-digit KRX code, else null. */
export function krCodeOf(symbol) {
  const match = String(symbol || '').trim().toUpperCase().match(/^(\d{6})(?:\.(?:KS|KQ))?$/);
  return match ? match[1] : null;
}

/** Themes whose structural constituent list contains the ticker, in map order. */
export function krThemesForSymbol(symbol, themeMap) {
  const code = krCodeOf(symbol);
  if (!code || !themeMap || typeof themeMap !== 'object') return [];
  return Object.entries(themeMap)
    .filter(([, members]) => Array.isArray(members) && members.some((member) => String(member?.code || '') === code))
    .map(([id]) => Object.freeze({ id, label: krThemeLabel(id) }));
}

export const KR_THEME_MIN_COVERED = 3;
export function krThemeArtifactRead({ themeMap = {}, rows = [] } = {}) {
  const bySymbol = new Map((rows || []).map((row) => [String(row?.sym || '').toUpperCase(), row]));
  const sessionOf = (row) => isoDay(row?.factorSessionDate);
  const latest = latestSessionRows((rows || []).filter((row) => /\.(KS|KQ)$/i.test(String(row?.sym || '')))).basis;
  const median = (values) => sharedMedian(values, { minCount: KR_THEME_MIN_COVERED });
  const themes = Object.entries(themeMap || {}).map(([id, members]) => {
    const found = (Array.isArray(members) ? members : []).map((member) => bySymbol.get(`${member.code}.KS`) || bySymbol.get(`${member.code}.KQ`)).filter(Boolean);
    const current = found.filter((row) => latest && sessionOf(row) === latest && row?.factorQuality?.stale !== true);
    const above = current.filter((row) => value(row, 'pctSma50') != null);
    return {
      id, label: krThemeLabel(id).split(' / ')[0], members: (members || []).length,
      // covered = members with a 1-month return on the latest close (the figure the bars rank on); found/notCurrent
      // keep the rows that exist but sit on an older close or are stale.
      covered: current.filter((row) => value(row, 'ret1m') != null).length, found: found.length, notCurrent: found.length - current.length,
      ret1m: median(current.map((row) => value(row, 'ret1m'))), ret3m: median(current.map((row) => value(row, 'ret3m'))),
      ret5d: median(current.map((row) => value(row, 'ret5d'))), vol: median(current.map((row) => value(row, 'vol'))),
      basis: current.length ? latest : null,
      above50Pct: above.length >= KR_THEME_MIN_COVERED ? Math.round(above.filter((row) => value(row, 'pctSma50') > 0).length / above.length * 100) : null,
      heavyweights: heavyweightsOf(current)
    };
  });
  themes.forEach((theme) => { theme.heavyweightNote = heavyweightLine(theme); });
  const usable = themes.filter((theme) => theme.covered >= KR_THEME_MIN_COVERED && theme.ret1m != null).sort((a, b) => b.ret1m - a.ret1m);
  const pct = (value) => (value == null ? '—' : `${signedText(value, 1)}%`);
  const top = usable.slice(0, 3);
  const strongWord = top.every((t) => t.ret1m > 0) ? '강한 테마는' : '상대적으로 덜 약한 테마는';
  const named = (t) => `${t.label}(1개월 ${pct(t.ret1m)}${t.ret5d != null ? `, 5거래일 ${pct(t.ret5d)}` : ''})`;
  const read = usable.length >= 4
    ? `확정 종가 기준 1개월 중앙값으로 ${strongWord} ${top.map(named).join(', ')}, 약한 테마는 ${usable.slice(-2).reverse().map(named).join(', ')}입니다.`
    : `구성 종목 기록이 ${KR_THEME_MIN_COVERED}개 이상인 테마가 적어 순위를 매기지 않습니다.`;
  const hidden = usable.slice(0, 3).find((theme) => theme.heavyweightNote);
  const readWithWeight = hidden ? `${read} ${hidden.label}: ${hidden.heavyweightNote}` : read;
  return { themes, usable, read: readWithWeight, coveredThemes: usable.length, totalThemes: themes.length };
}
