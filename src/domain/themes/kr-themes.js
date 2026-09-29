// P1327/R672: one owner for Korean theme names and ticker → theme membership.
// Theme names used to live in three local maps inside js/aio-kr-data.js (card META, rank N,
// detail CN) that disagreed and were missing ids (quantum/uam/hydrogen/space had no detail
// name). Membership comes from the structural KR_THEME_MAP (codes only, R604).

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
  photonics_kr: '광 / 포토닉스',
  wind_solar: '풍력 / 태양광 / 신재생',
  quantum: '양자컴퓨팅 / 양자암호',
  uam: 'UAM / 도심항공',
  hydrogen: '수소에너지',
  space: '우주항공 / 위성'
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
