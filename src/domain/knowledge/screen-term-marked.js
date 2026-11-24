// v59.70 (post-boot budget): the screen-term additions that term marks underline (TERM_MARKS in
// src/ui/components/term-marks.js), moved unchanged out of screen-term-additions.js. They join GLOSSARY when it arrives so
// the marks and their popovers stay as before; the other additions load on real glossary use. screen-term-additions.js
// still lists every addition in its original order (it references these entries by index).
export const SCREEN_TERM_MARKED = Object.freeze([
  { term: 'bp (베이시스 포인트)', alias: 'bp 베이시스포인트 basis point', cat: '기초', def: '금리·스프레드 변화를 세는 단위로, 1bp는 0.01%포인트입니다. "10년물 +22bp"는 금리가 0.22%포인트 올랐다는 뜻입니다.' },
  { term: '백분위', alias: 'percentile 퍼센타일', cat: '기초', def: '여러 값 가운데 어디쯤인지를 0~100으로 나타낸 위치입니다. 90이면 비교 대상의 약 90%보다 높거나 같다는 뜻이고(동점 처리와 표본 크기에 따라 조금 다릅니다), 점수나 등급이 아닙니다.' },
  { term: '정배열 / 역배열', alias: '정배열 역배열 이동평균 배열', cat: '기술적분석', def: '짧은 이동평균이 긴 이동평균 위에 차례로 놓인 상태가 정배열(상승 추세 쪽), 반대로 놓인 상태가 역배열(하락 추세 쪽)입니다.' },
  { term: '분배일', alias: 'distribution day 디스트리뷰션', cat: '기술적분석', def: '지수가 전날보다 거래량이 늘면서 일정 폭(흔히 0.2%) 이상 내린 날입니다. 기관 매도가 몰렸을 수 있는 흔적으로 보며(하루하루가 모두 기관 매도라는 뜻은 아닙니다), 짧은 기간에 쌓이면 상승 흐름이 약해지는 신호로 읽습니다.' },
  { term: '공포·탐욕 지수 (F&G)', alias: 'F&G Fear Greed 공포탐욕 공포 탐욕', cat: '기초', def: '여러 시장 지표를 묶어 투자 심리가 공포 쪽인지 탐욕 쪽인지 0~100으로 보여 주는 지수입니다. 숫자가 낮을수록 공포, 높을수록 탐욕입니다.' },
  { term: 'SOFR', alias: 'SOFR 담보 익일물 금리', cat: '채권', def: '미국 국채를 담보로 하루 동안 돈을 빌리는 금리입니다. 현금성 자산(머니마켓펀드 등)이 받는 이자의 기준으로 씁니다.' },
  { term: '근원 물가 (근원 CPI · 근원 PCE)', alias: '근원 PCE 근원 CPI core', cat: '경제', def: '가격이 크게 출렁이는 식품·에너지를 뺀 물가입니다. 연준의 공식 목표는 전체 PCE 물가 2%이고, 추세를 읽을 때는 근원 PCE를 더 중시합니다. 헤드라인 물가는 식품·에너지를 포함한 전체 물가입니다.' },
  { term: '단기채', alias: '단기채 단기 국채 T-bill', cat: '채권', def: '만기가 짧은(보통 1년 이하) 채권으로, 이 화면에서는 주로 미국 단기 국채(T-bill)를 말합니다. 가격 변동이 작고 이자가 기준금리를 따라가서, 기다리는 동안 현금을 두는 곳으로 쓰입니다.' },
  { term: '분할 접근', alias: '분할 매수 분할 접근', cat: '전략', def: '한 번에 사지 않고 여러 번에 나눠 사는 방식입니다. 시점을 잘못 고를 위험을 줄이는 대신, 한 번에 샀을 때보다 덜 오를 수 있습니다.' },
  { term: '3개월물 (국채)', alias: '3개월물 T-bill 3개월 국채', cat: '채권', def: '만기 3개월짜리 미국 국채(T-bill)의 수익률입니다. 몇 달 안의 기준금리 예상을 가장 가깝게 반영하지만, 국채 발행량과 안전자산 수요에 따라 조금 벗어나기도 합니다.' },
  { term: '이동평균 (50일선 · 200일선)', alias: '이동평균 50일선 200일선 MA', cat: '기술적분석', def: '최근 50일·200일 종가의 평균을 이은 선입니다. 주가가 선 위에 있으면 그 기간 평균보다 강하다는 뜻이고, 시장 폭은 이 선 위에 있는 종목 비율로 셉니다.' },
  { term: '기회비용', alias: '기회비용 opportunity cost 놓친 이익', cat: '기초', def: '어떤 선택을 할 때 포기한 대안 가운데 가장 나은 것에서 얻을 수 있었던 이익입니다. 기다리는 동안 시장이 오른 만큼이 기다림의 기회비용이고, 반대로 서둘러 산 뒤 더 내렸다면 기다렸을 때 피할 수 있던 손실이 매수의 비용입니다.' },
  { term: 'TGA (재무부 일반계정)', alias: 'TGA Treasury General Account 재무부 계좌 재무부 일반계정', cat: '거시', def: '미국 재무부가 연준에 두고 쓰는 예금 계좌입니다. 세금이 들어오거나 국채를 팔면 잔액이 늘면서 시중의 돈이 그만큼 이 계좌로 묶이고, 정부가 돈을 쓰면 다시 풀립니다. 그 돈이 은행 준비금에서 빠지는지, 역레포(RRP)에 쉬던 돈에서 빠지는지에 따라 시장에 주는 영향이 다릅니다.' },
  { term: 'JOLTS (구인·이직 조사)', alias: 'JOLTS 구인 건수 구인 이직 job openings', cat: '경제', def: '미국 노동부가 매달 내는 구인 건수·채용·이직 조사입니다. 구인이 줄면 기업의 일손 수요가 식고 있다는 뜻이고, 실업률이 오르기 전의 수요 변화를 보는 데 씁니다.' },
  { term: 'CCC − B 등급 격차', alias: 'CCC B 등급 격차 최하위 등급 CCC-B 스프레드 격차', cat: '채권', def: '하이일드 회사채 가운데 가장 낮은 등급(CCC 이하)과 바로 위 B 등급의 가산금리 차이입니다. 벌어지면 시장이 가장 약한 기업을 더 따로 가려내고 있다는 뜻입니다.' }
]);
