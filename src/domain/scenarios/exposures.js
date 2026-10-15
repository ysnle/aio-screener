// P1743 (owner 2026-10-13): one registry that connects every macro branch to every theme — not only the examples
// the owner named. Each theme (US THEME_MAP ids and KR_THEME_MAP ids) carries exposure tags (what it is sensitive to)
// and a structural thesis with the conditions that would break it. The tags decide, for any branch, which themes
// face a tailwind or a headwind; the thesis lets a pullback in a structural theme be read differently from a
// pullback in a cyclical one. Static, human-reviewed text (AGENTS: slow-changing content is versioned static data);
// every statement here is a hypothesis, never a measured value, and contains no time-stamped numbers.

export const EXPOSURE_TAGS = Object.freeze({
  growth: '장기 성장 · 고PER (할인율 민감)',
  aicapex: 'AI 설비투자 사이클',
  cyclical: '경기 민감',
  defensive: '경기 방어',
  energy: '에너지 · 원자재 가격',
  yield: '금리 민감 배당 (리츠 · 유틸리티 · 통신)',
  financials: '금융 (금리차 · 신용)',
  consumer: '소비 경기',
  dollar: '달러 · 환율 민감 (수출 · 해외 매출)',
  liquidity: '유동성 · 위험 선호',
  policy: '정책 · 지정학 수요'
});

const T = (tags, thesis, breaks) => Object.freeze({ tags: Object.freeze(tags), thesis, breaks: Object.freeze(breaks) });

/** US THEME_MAP ids. */
export const US_THEME_PROFILES = Object.freeze({
  defense: T(['policy', 'defensive'], '각국 국방비 증액과 재고 보충이 여러 해에 걸친 수주잔고로 이어지는 구조', ['국방 예산 동결·삭감', '수주잔고 감소', '휴전·긴장 완화로 긴급 조달 감소']),
  staples: T(['defensive'], '경기와 무관하게 필요한 소비라 이익 변동이 작은 방어 업종', ['원가 상승을 가격에 못 넘김', '자체 브랜드·저가 대체로 점유율 하락']),
  healthcare: T(['defensive'], '고령화와 신약 파이프라인이 경기와 무관한 수요를 만드는 업종', ['약가 규제 강화', '핵심 특허 만료', '임상 실패']),
  utilities: T(['defensive', 'yield', 'aicapex'], '규제 요금으로 안정적 현금흐름 + 데이터센터 전력 수요가 투자 기반을 넓히는 구조', ['금리 급등으로 배당 매력 하락', '요금 인상 승인 지연', '전력 수요 전망 하향']),
  energy: T(['energy', 'cyclical'], '유가·가스 가격이 이익을 직접 좌우하고, 낮은 설비투자로 공급 여력이 제한된 업종', ['유가 하락 추세', 'OPEC 증산', '수요 둔화']),
  semiconductor: T(['aicapex', 'cyclical', 'growth'], 'AI 가속기·HBM·첨단 공정 수요가 이끄는 장기 성장과, 재고·가격이 도는 반도체 경기순환이 겹친 업종', ['하이퍼스케일러 설비투자 가이던스 하향', 'AI 매출이 투자를 따라오지 못한다는 확인', '재고 증가·가격 하락 전환', '수출 규제 강화']),
  software: T(['growth'], '구독 매출의 높은 가시성 — AI가 수요를 늘릴 수도, 기존 좌석 기반 과금을 위협할 수도 있는 응용 계층', ['순매출 유지율 하락', 'AI 대체로 좌석 수 감소', '금리 상승으로 밸류에이션 압박']),
  industrials: T(['cyclical'], '설비투자·인프라·물류 경기를 따라가는 업종 — 전력망·재산업화 투자가 장기 수요를 받침', ['제조업 경기 위축(ISM 50 하회 지속)', '수주 감소', '운임 하락']),
  financials: T(['financials', 'cyclical'], '금리 수준·장단기 금리차와 신용 비용이 이익을 결정하는 업종', ['장단기 금리차 역전 심화', '대손 증가', '신용 스프레드 확대']),
  reits: T(['yield'], '임대료 현금흐름을 금리와 비교해 가치가 매겨지는 자산', ['금리 상승', '공실률 상승', '차환 비용 급증']),
  consumer_disc: T(['consumer', 'cyclical', 'growth'], '고용·임금과 소비 심리에 따라 움직이는 재량 소비', ['실업 증가', '소비 심리 급락', '재고 할인 증가']),
  materials: T(['cyclical', 'energy'], '글로벌 제조·건설 경기와 원자재 가격을 따라가는 업종', ['중국·글로벌 수요 둔화', '원자재 가격 하락', '달러 급등']),
  comm: T(['growth'], '광고·구독 매출과 플랫폼 지배력 — 광고 경기와 AI 투자 비용이 이익을 좌우', ['광고 경기 둔화', 'AI 투자 비용 급증 대비 수익화 지연', '규제·반독점']),
  photonics: T(['aicapex', 'growth'], 'AI 클러스터가 커질수록 가속기를 잇는 광 연결(트랜시버·광섬유·광부품) 수요가 가속기 수보다 빠르게 늘어 공급 병목이 되기 쉬운 영역', ['하이퍼스케일러 설비투자 가이던스 하향', '광모듈 재고 증가·가격 인하', '구리 연결 등 대체 기술로의 이동']),
  crypto: T(['liquidity'], '유동성과 위험 선호에 가장 민감한 자산 — 규제와 자금 유입(ETF 등)이 수급을 좌우', ['유동성 축소·금리 급등', '규제 강화', '대형 거래소·스테이블코인 사고']),
  ai_infra: T(['aicapex', 'growth'], '데이터센터 건설·전력·냉각·AI 호스팅으로 이어지는 설비투자 사슬 — 전력과 장비 리드타임이 병목', ['데이터센터 착공 지연·취소', 'GPU 임대 가격 하락', 'AI 클라우드 기업의 회사채 금리 급등(조달 위축)', '설비투자 가이던스 하향']),
  robotics: T(['growth', 'cyclical'], '인건비 상승과 자동화 수요, AI의 물리 세계 확장이 이끄는 장기 성장', ['제조업 설비투자 위축', '상용화 지연']),
  global_adr: T(['dollar', 'cyclical'], '미국 밖 대형 기업 — 각국 경기와 달러 방향에 민감', ['달러 급등', '해당국 경기 둔화', '지정학 위험'])
});

/** KR_THEME_MAP ids. */
export const KR_THEME_PROFILES = Object.freeze({
  defense: T(['policy', 'dollar'], '수출 계약이 여러 해 매출로 잡히는 K-방산 — 지정학 수요와 수출 계약이 핵심', ['대형 수출 계약 지연', '지정학 긴장 완화', '원화 강세']),
  semi: T(['aicapex', 'cyclical', 'dollar'], 'HBM 등 AI 메모리 수요의 장기 성장과 메모리 가격 경기순환이 겹친 업종 — 공급 증설·재고가 꺾임 신호', ['DRAM·HBM 가격 하락 전환', '재고 일수 증가', '증설 경쟁', '중국 업체의 양산·고객 인증 확인(가격 경쟁)', '하이퍼스케일러 설비투자 하향']),
  shipbuilding: T(['cyclical', 'dollar', 'energy'], '선가 상승기에 받은 수주가 몇 년 뒤 매출로 잡히는 장기 사이클 — LNG·친환경 선박 교체 수요', ['신규 수주·선가 하락', '원자재(후판) 가격 급등', '원화 강세']),
  'ai-sw': T(['growth'], '국내 AI·소프트웨어 — 정책 지원과 기업 도입 속도가 수요를 좌우', ['정책 지원 축소', '수익화 지연', '금리 상승']),
  'power-grid': T(['aicapex', 'policy', 'dollar'], '미국 등 전력망 투자와 데이터센터 전력 수요로 변압기·전력기기 수주가 장기화된 구조', ['수주잔고 감소', '미국 전력망 투자 지연', '구리 등 원가 급등']),
  nuclear: T(['policy', 'aicapex'], '탄소 감축과 데이터센터 전력 수요로 원전·SMR 정책 수요가 커진 구조', ['정책 후퇴', '수주 지연', 'SMR 상용화 지연']),
  battery: T(['growth', 'cyclical'], '전기차·ESS 수요의 장기 성장과 리튬 등 원가 경기순환이 겹친 업종', ['전기차 수요 둔화', '보조금 축소', '중국산과의 가격 경쟁']),
  bio: T(['growth'], '임상·기술수출 이벤트가 가치를 좌우하는 성장 업종 — 금리와 위험 선호에 민감', ['임상 실패', '기술수출 해지', '금리 상승']),
  kbeauty: T(['consumer', 'dollar'], '미국·일본 등 수출 다변화로 커진 K-뷰티 — 해외 채널 확장이 핵심', ['주요 시장 소비 둔화', '채널 재고 증가', '경쟁 심화']),
  kcontent: T(['consumer', 'growth'], '글로벌 플랫폼과 IP 수익화 — 흥행 변동성이 큰 업종', ['흥행 부진', '플랫폼 계약 조건 악화']),
  auto: T(['cyclical', 'dollar', 'consumer'], '환율과 미국 판매·관세가 이익을 좌우하는 수출 업종', ['미국 관세 강화', '원화 강세', '판매 둔화']),
  robot: T(['growth'], '자동화·휴머노이드 기대가 이끄는 성장 테마 — 실적보다 기대가 앞서기 쉬움', ['상용화 지연', '위험 선호 위축']),
  finance: T(['financials'], '금리와 주주환원 정책(밸류업)이 가치를 좌우하는 업종', ['금리 급락으로 이자 이익 축소', '대손 증가', '환원 정책 후퇴']),
  kfood: T(['defensive', 'dollar'], '내수 방어 + 해외 K-푸드 수출 성장', ['원재료 가격 급등', '수출 둔화']),
  crypto: T(['liquidity'], '국내 가상자산 거래·인프라 — 유동성과 규제에 민감', ['거래대금 감소', '규제 강화']),
  telecom: T(['defensive', 'yield'], '안정 현금흐름과 배당의 방어 업종', ['요금 규제', '설비투자 부담']),
  construction: T(['cyclical'], '국내 주택·해외 플랜트 수주에 따라 움직이는 경기 업종', ['부동산 경기 위축', 'PF 부실', '원가 상승']),
  retail: T(['consumer'], '국내 소비 경기에 따라 움직이는 유통', ['소비 위축', '온라인 경쟁']),
  steel_chem: T(['cyclical', 'energy'], '중국 공급과 글로벌 경기, 원자재 가격에 민감한 소재 업종', ['중국 저가 공급', '수요 둔화', '스프레드 축소']),
  logistics: T(['cyclical', 'energy'], '운임과 물동량, 유가(연료비)에 민감한 운송 업종', ['운임 하락', '유가 급등', '물동량 감소']),
  medtech_kr: T(['growth'], '수출 중심 의료기기·디지털헬스 성장', ['해외 인허가 지연', '경쟁 심화']),
  energy_kr: T(['energy'], '정제마진과 유가에 따라 움직이는 정유·에너지', ['정제마진 축소', '유가 급락']),
  photonics_kr: T(['aicapex', 'growth'], 'AI 데이터센터 광 연결 수요의 국내 공급망', ['글로벌 광모듈 재고 증가', '설비투자 하향']),
  wind_solar: T(['policy', 'growth', 'yield'], '정책 보조와 금리에 민감한 신재생 투자', ['보조금 축소', '금리 상승', '중국산 가격 경쟁']),
  quantum: T(['liquidity', 'growth'], '상용화 이전의 기대 테마 — 위험 선호에 매우 민감', ['위험 선호 위축', '기술 이정표 지연']),
  uam: T(['liquidity', 'growth'], '상용화 이전의 기대 테마 — 정책과 위험 선호에 민감', ['상용화 일정 지연', '위험 선호 위축']),
  hydrogen: T(['policy', 'liquidity'], '정책 지원에 기대는 장기 테마', ['정책 후퇴', '경제성 미달']),
  space: T(['policy', 'growth'], '위성·발사체 정책 수요와 민간 우주 산업 성장', ['발사 실패', '정책 예산 축소'])
});

export function themeProfile(market, themeId) {
  return (market === 'KR' ? KR_THEME_PROFILES : US_THEME_PROFILES)[themeId] || null;
}

/** Which way a branch's exposure lists point for a set of tags: 'tail' | 'head' | 'mixed' | 'none'. */
export function windFor(tags = [], branch = null) {
  if (!branch) return 'none';
  const up = tags.filter((tag) => branch.firmer?.includes(tag)).length;
  const down = tags.filter((tag) => branch.weaker?.includes(tag)).length;
  const mixed = tags.filter((tag) => branch.mixed?.includes(tag)).length;
  if (up && !down) return 'tail';
  if (down && !up) return 'head';
  if (up || down || mixed) return 'mixed';
  return 'none';
}

/** v57.54 audit (13): the themes a macro branch favours (tailwind) — or, when it favours none, the ones it splits (e.g.
 *  달러 급등: exporters gain on FX, importers lose) — from the same exposure tags the playbook uses. Ids only; names and
 *  links are the screen's job, and no stock is ever named here. */
export function themesForBranch(branch) {
  const pick = (wind) => [
    ...Object.entries(US_THEME_PROFILES).filter(([, profile]) => windFor(profile.tags, branch) === wind).map(([id]) => ({ market: 'US', id })),
    ...Object.entries(KR_THEME_PROFILES).filter(([, profile]) => windFor(profile.tags, branch) === wind).map(([id]) => ({ market: 'KR', id }))
  ];
  if (!branch) return { wind: 'none', themes: [] };
  const tail = pick('tail');
  return tail.length ? { wind: 'tail', themes: tail } : { wind: 'mixed', themes: (branch.mixed || []).length ? pick('mixed') : [] };
}

export const WIND_LABELS = Object.freeze({ tail: '수혜', head: '부담', mixed: '혼재', none: '영향 작음' });
export const tagLabels = (tags = []) => tags.map((tag) => EXPOSURE_TAGS[tag] || tag);

/** Long-history proxy ETFs for theme state outcomes (reference only; the theme median itself is never replaced). */
export const THEME_PROXY_ETF = Object.freeze({
  semiconductor: 'SMH', software: 'IGV', energy: 'XLE', utilities: 'XLU', financials: 'XLF', healthcare: 'XLV', staples: 'XLP',
  industrials: 'XLI', materials: 'XLB', reits: 'XLRE', consumer_disc: 'XLY', comm: 'XLC', defense: 'ITA', robotics: 'BOTZ', ai_infra: 'SMH'
});
