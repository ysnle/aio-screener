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
  { term: '이동평균 (50일선 · 200일선)', alias: '이동평균 50일선 200일선 MA', cat: '기술적분석', def: '최근 50일·200일 종가의 평균을 이은 선입니다. 주가가 선 위에 있으면 그 기간 평균보다 강하다는 뜻이고, 시장 폭은 이 선 위에 있는 종목 비율로 셉니다.' }
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
