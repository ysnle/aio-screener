// v58.79 (owner 2026-10-25): the theme screens and the research library pointed nowhere at each other. One registry
// joins each US theme (js/aio-pages.js THEME_MAP id) to the analysis notes that explain how its businesses earn
// (learning-core LESSONS id, opened on 개념·분석) and to its 산업 지도 domain where one exists. Both directions read it:
// the theme detail lists the notes, and a note or domain page lists the themes with their current stage.
export const THEME_RESEARCH = Object.freeze({
  semiconductor: { notes: ['semi-process', 'memory-optics', 'tech-vs-profit'], domain: 'domain-compute-silicon' },
  ai_infra: { notes: ['capex-roic', 'tech-vs-profit'], domain: 'domain-aidc-cooling' },
  photonics: { notes: ['memory-optics'], domain: 'domain-network-photonics' },
  software: { notes: ['software'], domain: 'domain-ai-applications' },
  comm: { notes: ['software', 'expectations'] },
  healthcare: { notes: ['biotech', 'insurance'] },
  financials: { notes: ['bank', 'insurance', 'credit-money'], domain: 'domain-capital-markets-company-map' },
  reits: { notes: ['reit', 'long-bond'] },
  staples: { notes: ['consumer', 'agri'] },
  consumer_disc: { notes: ['consumer', 'elasticity'] },
  energy: { notes: ['energy'] },
  materials: { notes: ['energy', 'agri'], domain: 'domain-resources-materials' },
  industrials: { notes: ['transport', 'capex-roic'], domain: 'domain-power-grid' },
  utilities: { notes: ['capex-roic', 'long-bond'], domain: 'domain-power-grid' },
  defense: { notes: [], domain: 'domain-drone-defense' },
  robotics: { notes: [], domain: 'domain-physical-ai-robotics' },
  global_adr: { notes: ['fx-exporters'] },
  crypto: { notes: [] }
});

// Titles copied from learning-core so the theme screen does not load the 100KB note corpus for a link label; the unit
// check fails when a title drifts from its note.
export const NOTE_TITLES = Object.freeze({
  'semi-process': '반도체 공정과 수율', 'memory-optics': '메모리와 광통신', 'tech-vs-profit': '기술의 중요성과 공급자의 이익',
  'capex-roic': '설비투자·ROIC·현금흐름', software: '소프트웨어·플랫폼', expectations: '좋은 실적과 기대 초과', biotech: '바이오·의료',
  insurance: '보험', bank: '은행', 'credit-money': '은행 대출과 돈', reit: '부동산·리츠·건설', 'long-bond': '금리 인하와 장기채',
  consumer: '소비·유통', agri: '농업·식품', elasticity: '가격과 판매량', energy: '에너지·화학·소재', transport: '운송·물류', 'fx-exporters': '환율과 수출 기업'
});

// v58.79: what the stock chart draws, and the 차트·셋업 읽기 note that teaches it (opened on 개념·분석).
export const CHART_NOTES = Object.freeze([
  { mark: '피벗·돌파', id: 'breakout-follow-through', title: '돌파는 사건, 판단은 후속 움직임' },
  { mark: '단계', id: 'price-cycle-stages', title: '가격 순환의 단계(Oliver Kell)' },
  { mark: 'RS선', id: 'relative-resilience', title: '지수가 빠지는 날 버티는 종목' },
  { mark: '50일선 거리', id: 'climax-extension', title: '과열 확장과 클라이맥스 징후' }
]);

/** The notes and the 산업 지도 domain for a theme id (empty when none is registered). */
export function researchForTheme(themeId) {
  const entry = THEME_RESEARCH[themeId];
  return entry ? { notes: [...entry.notes], domain: entry.domain || null } : { notes: [], domain: null };
}

/** US theme ids whose registry entry names this analysis note. */
export const themesForNote = (noteId) => Object.entries(THEME_RESEARCH).filter(([, entry]) => entry.notes.includes(noteId)).map(([id]) => id);

/** US theme ids whose registry entry names this 산업 지도 domain. */
export const themesForDomain = (domainId) => Object.entries(THEME_RESEARCH).filter(([, entry]) => entry.domain === domainId).map(([id]) => id);
