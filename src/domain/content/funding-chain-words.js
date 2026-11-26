// The AI funding chain's fixed words (domain/themes/ai-funding-chain.js): its title, each link's title, the state words
// a link earns from its automated rows, and the line a link with nothing confirmed prints. One place, so the 테마 face,
// the one-line pointers on 매크로 and the AI fact lines say the same thing.

export const FUNDING_CHAIN_WORDS = Object.freeze({
  title: 'AI 자금 조달 사슬',
  // The pointer other screens print beside their own rows.
  pointer: '이어지는 흐름 → 테마와 섹터 › AI 자금 조달 사슬',
  links: Object.freeze({
    capex: '투자',
    cash: '현금',
    funding: '조달',
    credit: '신용 가격',
    lending: '대출 여건',
    hardware: '장비 가격',
    rates: '금리·유동성'
  }),
  states: Object.freeze({ tighter: '부담 커짐', flat: '변화 없음', easier: '완화', mixed: '엇갈림' }),
  none: '확인된 자료 없음',
  auto: '자동 집계',
  method: '계산 방법'
});
