// The fixed words of the session's catalysts and divergences (domain/market/day/catalysts.js, divergence.js). Labels and
// clause templates only; every figure is a claim slot, every headline is the ledger's own Korean title. Neither line
// says why: the catalysts are what the ledger linked to the session's moves, the divergence names two figures that
// went the unexpected way, and the reason is the AI reading's.
export const DAY_READ_WORDS = Object.freeze({
  catalysts: Object.freeze({
    label: '촉매',
    item: '{d} “{title}”',
    // The AI fact line's head: what the list is and is not.
    fact: '촉매(수집된 헤드라인 중 원장이 이 세션의 움직임에 연결한 것, 원인 단정 아님)'
  }),
  divergence: Object.freeze({
    label: '엇갈림',
    said: '{d} {a}, {b}',
    fact: '엇갈림(두 수치가 흔히 보는 방향과 다르게 움직임, 이유는 정하지 않음)',
    // The figure labels, by rule id (divergence.js DIVERGENCE_RULES).
    names: Object.freeze({ tnx: '미국 10년 금리', spx: 'S&P 500', hyOas: '하이일드 스프레드', dxy: '달러지수', gold: '금', wti: 'WTI 유가', energy: '에너지 업종' }),
    release: '{name} {actual}(예상 {forecast})'
  })
});
