// v57.55 review (beginner panel B1-01/B5-F15): terms the screens print that the glossary search did not find. Plain
// definitions only — no thresholds or historical figures (those belong in js/aio-glossary.js with a source row).
// Added at runtime when the legacy glossary has no entry of the same name.
export const SCREEN_TERM_ADDITIONS = Object.freeze([
  { term: 'bp (베이시스 포인트)', alias: 'bp 베이시스포인트 basis point', cat: '기초', def: '금리·스프레드 변화를 세는 단위로, 1bp는 0.01%포인트입니다. "10년물 +22bp"는 금리가 0.22%포인트 올랐다는 뜻입니다.' },
  { term: '백분위', alias: 'percentile 퍼센타일', cat: '기초', def: '여러 값 가운데 어디쯤인지를 0~100으로 나타낸 위치입니다. 90이면 비교 대상의 90%보다 높다는 뜻이고, 점수나 등급이 아닙니다.' },
  { term: '팩터', alias: 'factor 팩터 모멘텀 저변동', cat: '전략', def: '주가 움직임을 설명하는 공통 특성(모멘텀·추세·저변동·규모·밸류·퀄리티 등)입니다. 스크리너는 각 특성의 상대 위치를 따로 보여 줍니다.' },
  { term: '정배열 / 역배열', alias: '정배열 역배열 이동평균 배열', cat: '기술적분석', def: '짧은 이동평균이 긴 이동평균 위에 차례로 놓인 상태가 정배열(상승 추세 쪽), 반대로 놓인 상태가 역배열(하락 추세 쪽)입니다.' },
  { term: '분배일', alias: 'distribution day 디스트리뷰션', cat: '기술적분석', def: '지수가 전날보다 거래량이 늘면서 내린 날입니다. 큰손의 매도가 몰린 흔적으로 보며, 짧은 기간에 쌓이면 상승 흐름이 약해지는 신호로 읽습니다.' },
  { term: '공포·탐욕 지수 (F&G)', alias: 'F&G Fear Greed 공포탐욕 공포 탐욕', cat: '기초', def: '여러 시장 지표를 묶어 투자 심리가 공포 쪽인지 탐욕 쪽인지 0~100으로 보여 주는 지수입니다. 숫자가 낮을수록 공포, 높을수록 탐욕입니다.' },
  { term: 'SOFR', alias: 'SOFR 담보 익일물 금리', cat: '채권', def: '미국 국채를 담보로 하루 동안 돈을 빌리는 금리입니다. 현금성 자산(머니마켓펀드 등)이 받는 이자의 기준으로 씁니다.' },
  { term: '근원 물가 (근원 CPI · 근원 PCE)', alias: '근원 PCE 근원 CPI core', cat: '경제', def: '가격이 크게 출렁이는 식품·에너지를 뺀 물가입니다. 연준은 근원 PCE를 더 중요하게 봅니다. 헤드라인 물가는 에너지를 포함한 전체 물가입니다.' },
  { term: '선물 / 현물', alias: '선물 현물 futures spot', cat: '기초', def: '현물은 지금 바로 사고파는 가격, 선물은 미래의 정해진 날에 거래하기로 오늘 약속한 가격입니다. 유가·지수는 선물 가격으로 많이 봅니다.' },
  { term: '단기채', alias: '단기채 단기 국채 T-bill', cat: '채권', def: '만기가 짧은(보통 1년 이하) 국채입니다. 가격 변동이 작고 이자가 기준금리를 따라가서, 기다리는 동안 현금을 두는 곳으로 쓰입니다.' },
  { term: '분할 접근', alias: '분할 매수 분할 접근', cat: '전략', def: '한 번에 사지 않고 여러 번에 나눠 사는 방식입니다. 시점을 잘못 고를 위험을 줄이는 대신, 한 번에 샀을 때보다 덜 오를 수 있습니다.' },
  { term: '기준금리 목표 범위', alias: '기준금리 상단 하단 연방기금금리', cat: '경제', def: '연준이 정하는 하루짜리 금리의 목표 구간입니다(예: 3.75~4.00%). 2년물이나 3개월물이 이 범위보다 높으면 시장이 추가 인상을 예상한다는 뜻으로 읽습니다.' },
  { term: '3개월물 (국채)', alias: '3개월물 T-bill 3개월 국채', cat: '채권', def: '만기 3개월짜리 미국 국채 금리입니다. 몇 달 안의 기준금리 예상을 가장 가깝게 반영합니다.' },
  { term: '이동평균 (50일선 · 200일선)', alias: '이동평균 50일선 200일선 MA', cat: '기술적분석', def: '최근 50일·200일 종가의 평균을 이은 선입니다. 주가가 선 위에 있으면 그 기간 평균보다 강하다는 뜻이고, 시장 폭은 이 선 위에 있는 종목 비율로 셉니다.' },
  // v57.71 (2026-10-15 audit): a crash morning sent readers to the glossary with 하락장·반대매매·MDD and found nothing.
  { term: '반대매매', alias: '반대매매 강제청산 담보부족 마진콜 margin call', cat: '한국시장', def: '빚을 내 산 주식의 담보 가치가 약정한 비율 아래로 떨어지고 추가 담보를 넣지 못하면, 증권사가 그 주식을 강제로 파는 것입니다. 급락 때 이 매도가 몰리면 하락이 더 깊어질 수 있습니다.' },
  { term: '신용융자 (신용거래융자)', alias: '신용융자 신용거래 빚투 신용잔고', cat: '한국시장', def: '증권사에서 돈을 빌려 주식을 사는 것입니다. 잔고가 많을수록 하락장에서 반대매매로 이어질 수 있는 물량이 많다는 뜻으로 읽습니다.' },
  { term: '최대 낙폭 (MDD)', alias: 'MDD maximum drawdown 최대낙폭 고점 대비 하락', cat: '기초', def: '어느 기간 안에서 가장 높았던 지점부터 그 뒤 가장 낮았던 지점까지 얼마나 떨어졌는지를 나타낸 비율입니다. 같은 수익률이라도 이 값이 클수록 버티기 어려운 길이었다는 뜻입니다.' },
  { term: '약세장 (하락장)', alias: '약세장 하락장 bear market 베어마켓', cat: '기초', def: '주가가 넓게, 오래 내리는 국면을 가리키는 말입니다. 흔히 고점 대비 하락 폭으로 부르지만 기준은 관례일 뿐이고, 이 사이트는 하락 폭과 함께 시장 폭·신용·변동성을 나란히 봅니다.' },
  // v57.73 (owner 2026-10-15 wording review): the scenario cards keep '기회비용' because no shorter word carries it; the term mark explains it.
  { term: '기회비용', alias: '기회비용 opportunity cost 놓친 이익', cat: '기초', def: '어떤 선택을 할 때 포기한 다른 선택에서 얻을 수 있었던 이익입니다. 시장을 기다리는 동안 오른 만큼이 기다림의 기회비용이고, 서둘러 샀다가 더 내린 만큼이 성급한 매수의 비용입니다.' },
  { term: '관망', alias: '관망 기다림 현금 대기', cat: '기초', def: '새로 사거나 팔지 않고 현금이나 단기채로 기다리며 상황을 지켜보는 것입니다. 기다리는 동안의 이자가 놓친 상승을 일부 메워 줍니다.' },
  // v57.74 (owner 2026-10-15 crash-day note): the policy-floor and AI-cloud financing lessons use these words.
  { term: '정책 바닥 (정책 풋)', alias: '정책 바닥 정책 풋 policy put 연준 풋 Fed put', cat: '거시', def: '급락이 금융 불안으로 번질 때 정부·중앙은행이 대응해 하락의 연쇄를 막아 줄 것이라는 기대입니다. 물가가 높으면 중앙은행의 여력이 줄어 이 바닥이 더 낮은 곳에 생기고, 바닥이 생겨도 주가 회복은 이익과 금리에 달려 있습니다.' },
  // v57.76: the 차트 tab's how-to fold "12가지 매매 셋업 패턴" was retired; the setup words it taught stay findable here.
  { term: '돌파 (브레이크아웃)', alias: '돌파 브레이크아웃 breakout 베이스 돌파 신고가 돌파', cat: '기술적분석', def: '주가가 최근 일정 기간의 최고가나 오래 머물던 가격대(베이스)를 넘어 마감하는 것입니다. 거래량이 함께 늘면 확인 조건으로 보지만, 돌파 뒤 다시 밀려 내려오는 경우도 흔해 지속을 보장하지 않습니다.' },
  { term: '눌림목 (풀백)', alias: '눌림목 풀백 pullback 이동평균 반등 MA bounce', cat: '기술적분석', def: '상승 추세 중 주가가 잠시 내려와 이동평균선 근처까지 되돌린 구간입니다. 그 부근에서 다시 오르는 모습이 자주 관찰되지만 항상 그렇지는 않고, 선을 깨고 내려가면 추세 변화를 의심합니다.' },
  { term: '반전 (리버설)', alias: '반전 리버설 reversal 1-2-3 반전 바닥 반전', cat: '기술적분석', def: '하락하던 주가가 방향을 바꾸는 흐름입니다. 흔히 더 낮은 저점 → 반등 → 직전 반등 고점 돌파 순서로 확인하며(1-2-3 반전), 하루 만에 갭 하락 뒤 전일 종가 위로 마감하는 모습도 반전 신호로 부릅니다.' },
  { term: '셰이크아웃', alias: '셰이크아웃 shakeout 흔들기 저점 이탈 후 회복', cat: '기술적분석', def: '주가가 직전 저점을 잠깐 깼다가 같은 날이나 며칠 안에 다시 위로 올라서는 움직임입니다. 약한 보유자를 털어낸다고 해석하지만, 누가 의도했는지는 가격만으로 확인할 수 없습니다.' },
  { term: '건전한 조정 / 추세 전환', alias: '건전한 조정 추세 전환 조정 하락 전환', cat: '기술적분석', def: '상승 중 하락이 이동평균선 위에서 거래량이 줄며 멈추고 저점이 높아지면 건전한 조정으로, 이동평균선을 거래량이 늘며 깨고 저점이 낮아지면 추세 전환 쪽으로 읽습니다. 둘 다 사후에 확인되는 구분입니다.' },
  // v57.79 (UI review): 시장 상태 · 거시 labels print these abbreviations; the term marks and the glossary search explain them.
  { term: 'TGA (재무부 일반계정)', alias: 'TGA Treasury General Account 재무부 계좌 재무부 일반계정', cat: '거시', def: '미국 재무부가 연준에 두고 쓰는 예금 계좌입니다. 세금이 들어오거나 국채를 팔면 잔액이 늘면서 시중의 돈이 그만큼 이 계좌로 묶이고, 정부가 돈을 쓰면 다시 풀립니다.' },
  { term: 'JOLTS (구인·이직 조사)', alias: 'JOLTS 구인 건수 구인 이직 job openings', cat: '경제', def: '미국 노동부가 매달 내는 구인 건수·채용·이직 조사입니다. 구인이 줄면 기업의 일손 수요가 식고 있다는 뜻이고, 실업률이 오르기 전의 수요 변화를 보는 데 씁니다.' },
  { term: 'CCC − B 등급 격차', alias: 'CCC B 등급 격차 최하위 등급 CCC-B 스프레드 격차', cat: '채권', def: '하이일드 회사채 가운데 가장 낮은 등급(CCC 이하)과 바로 위 B 등급의 가산금리 차이입니다. 벌어지면 시장이 가장 약한 기업을 더 따로 가려내고 있다는 뜻입니다.' },
  { term: '네오클라우드', alias: '네오클라우드 neocloud AI 클라우드 GPU 클라우드', cat: '배경지식', def: 'GPU를 사들여 AI 기업에 연산 능력을 빌려주는 신생 클라우드 기업입니다. 장비를 빚으로 사는 경우가 많아 금리와 회사채 시장에 민감하고, 이들의 조달이 막히면 데이터센터 투자와 그 아래 메모리 주문이 늦어질 수 있습니다.' },
]);

export function appendScreenTerms(glossary, additions = SCREEN_TERM_ADDITIONS) {
  if (!Array.isArray(glossary)) return 0;
  const key = (text) => String(text || '').toLowerCase().replace(/\s*\(.*$/, '').replace(/\s+/g, '');
  const known = new Set(glossary.map((entry) => key(entry?.term)));
  let added = 0;
  for (const entry of additions) {
    if (known.has(key(entry.term))) continue;
    glossary.push({ ...entry });
    known.add(key(entry.term));
    added += 1;
  }
  return added;
}
