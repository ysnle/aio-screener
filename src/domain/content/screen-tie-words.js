// The one sentence each screen's story tie leads with (domain/market/story/screen-tie.js): what the screen's own reading
// says beside what the latest session did. Keyed by the session's shape class and the screen's own state, both decided
// elsewhere — the shape by the session read's thresholds, the state by the screen's existing verdict. `{slot}` places take
// claims only (screen-tie.js fills them), so every number printed here is a claim. No definitions, no causes.

/**
 * Session shape (screen-tie.js sessionShapeOf) → the class a screen's table is keyed by. A screen that reads only the
 * direction folds the leaders' and the whole market's moves together. A quiet session has no class: no sentence.
 */
const BY_REACH = Object.freeze({ 'leaders-down': 'leadDown', 'leaders-more-down': 'leadDown', 'broad-down': 'broadDown',
  'leaders-up': 'leadUp', 'leaders-more-up': 'leadUp', 'broad-up': 'broadUp' });
const BY_SIDE = Object.freeze({ 'leaders-down': 'down', 'leaders-more-down': 'down', 'broad-down': 'down',
  'leaders-up': 'up', 'leaders-more-up': 'up', 'broad-up': 'up' });
const BY_FALL_REACH = Object.freeze({ 'leaders-down': 'leadDown', 'leaders-more-down': 'leadDown', 'broad-down': 'broadDown',
  'leaders-up': 'up', 'leaders-more-up': 'up', 'broad-up': 'up' });

export const SCREEN_TIE_SHAPES = Object.freeze({
  breadth: BY_REACH, sentiment: BY_FALL_REACH, macro: BY_SIDE, fxbond: BY_SIDE, themes: BY_REACH, korea: BY_SIDE, charts: BY_SIDE
});

/** screen → `${shapeClass}:${state}` → the sentence. */
export const SCREEN_TIE_WORDS = Object.freeze({
  // State: the 시장 폭 axis (favorable · neutral · burden). {b}: the share of S&P 500 members above their 50-day line.
  breadth: Object.freeze({
    'leadDown:favorable': '주도주가 더 크게 내렸지만 종목 {b}가 50일선 위라, 하락이 시장 전체로 번지지 않았습니다.',
    'leadDown:neutral': '주도주가 더 크게 내렸고 50일선 위 종목은 {b}로 절반 안팎이라, 하락이 넓게 번지진 않았지만 받치는 힘도 약합니다.',
    'leadDown:burden': '주도주가 더 내린 데다 50일선 위 종목도 {b}에 그쳐, 지수를 받칠 종목이 적습니다.',
    'broadDown:favorable': '시장 전체가 함께 내렸어도 종목 {b}는 아직 50일선 위에 남아 있습니다.',
    'broadDown:neutral': '종목 대부분이 함께 내린 날이고, 50일선 위 종목은 {b}로 절반 안팎입니다.',
    'broadDown:burden': '하락이 종목 전반에 걸쳤고 50일선 위 종목이 {b}로 적어, 약세가 넓게 퍼졌습니다.',
    'leadUp:favorable': '주도주가 더 오른 날이고 종목 {b}도 50일선 위라, 상승을 받치는 종목이 넓습니다.',
    'leadUp:neutral': '상승은 주도주 쪽이 컸고, 50일선 위 종목은 {b}로 아직 반쯤입니다.',
    'leadUp:burden': '주도주가 더 오른 날이지만 50일선 위 종목은 {b}로 적어, 상승이 소수에 쏠렸습니다.',
    'broadUp:favorable': '종목 전반이 함께 올랐고 {b}가 50일선 위라, 상승의 폭이 넓은 편입니다.',
    'broadUp:neutral': '고르게 오른 날이지만 50일선 위 종목은 {b}로, 추세 회복은 아직 절반쯤입니다.',
    'broadUp:burden': '종목 전반이 올랐어도 50일선 위는 {b}에 머물러, 하루 반등이 추세 회복까지 가진 않았습니다.'
  }),
  // State: the 심리 reference row (fear · even · greed). {n}: components read; {f} on the fear side; {g} on the greed side.
  sentiment: Object.freeze({
    'leadDown:fear': '하락은 주도주에 몰렸는데 심리 지표 {n} 중 {f}가 1년 하위권이라, 가격보다 공포가 앞서 있습니다.',
    'leadDown:even': '주도주가 크게 내렸어도 심리 지표 {n} 중 공포 쪽은 {f}라, 공포에 쫓긴 매도는 아직 넓지 않습니다.',
    'leadDown:greed': '주도주가 내린 날에도 심리 지표 {n} 중 {g}가 과열 쪽이라, 낙관이 아직 꺾이지 않았습니다.',
    'broadDown:fear': '시장 전체가 함께 내렸고 심리 지표 {n} 중 {f}가 1년 하위권이라, 공포가 가격 하락과 나란히 갑니다.',
    'broadDown:even': '고르게 내린 날인데도 심리 지표 {n} 중 공포 쪽은 {f}에 그칩니다.',
    'broadDown:greed': '시장 전체가 내렸는데 심리 지표 {n} 중 {g}가 여전히 과열 쪽입니다.',
    'up:fear': '지수가 올랐어도 심리 지표 {n} 중 {f}가 1년 하위권이라, 공포는 아직 풀리지 않았습니다.',
    'up:even': '오른 날이고 심리 지표 {n} 중 공포 쪽은 {f}라, 심리도 한쪽으로 기울지 않은 상태입니다.',
    'up:greed': '오른 날 심리 지표 {n} 중 {g}가 과열 쪽까지 올라, 들뜬 쪽으로 기울었습니다.'
  }),
  // State: how the 2-year's gap to the policy midpoint moved over about a month (down · flat · up). {d}: that change.
  macro: Object.freeze({
    'down:down': '금리 경로가 한 달 새 {d} 내려 금리 부담은 줄어드는 쪽인데도 주가가 내렸습니다.',
    'down:flat': '주가는 내렸고 금리 경로는 한 달 새 {d}로 거의 그대로라, 금리 쪽 부담은 더해지지도 풀리지도 않았습니다.',
    'down:up': '주가가 내린 사이 금리 경로가 한 달 새 {d} 올라, 금리 부담이 하락에 겹쳤습니다.',
    'up:down': '금리 경로가 한 달 새 {d} 내려 금리 부담이 줄어든 가운데 주가가 올랐습니다.',
    'up:flat': '주가는 올랐고 금리 경로는 한 달 새 {d}로 거의 움직이지 않아, 상승이 정책 기대 변화 없이 나왔습니다.',
    'up:up': '주가는 올랐지만 금리 경로가 한 달 새 {d} 올라, 상승이 금리 부담을 안고 갑니다.'
  }),
  // State: the 금리 axis (favorable · neutral · growthScare · burden). {r}: the 10-year's 20-session change.
  fxbond: Object.freeze({
    'down:favorable': '주가가 내린 날, 10년 금리는 20거래일 {r}로 내려와 할인율 쪽 부담은 덜었습니다.',
    'down:neutral': '주가는 내렸지만 10년 금리는 20거래일 {r}로 중립이라, 금리 쪽에서 더해진 부담은 없습니다.',
    'down:growthScare': '10년 금리가 20거래일 {r} 내렸는데도 주가가 빠져, 성장 걱정이 금리 안도를 앞섭니다.',
    'down:burden': '10년 금리가 부담 구간(20거래일 {r})인 채로 주가가 내려, 금리 부담과 하락이 겹쳤습니다.',
    'up:favorable': '10년 금리가 20거래일 {r}로 내려온 가운데 주가가 올라, 금리가 상승을 받칩니다.',
    'up:neutral': '주가가 올랐고 10년 금리는 20거래일 {r}로 중립이라, 금리가 보태거나 덜지 않았습니다.',
    'up:growthScare': '주가가 오른 날이지만 20거래일로는 10년 금리 {r} 하락에 주가 약세가 겹쳐, 성장 걱정이 남아 있습니다.',
    'up:burden': '주가는 올랐지만 10년 금리가 부담 구간(20거래일 {r})이라, 상승이 금리 부담을 이고 갑니다.'
  }),
  // State: the US theme stages (lead: some theme in 주도 · none). {t}: US themes staged; {n}: themes in 주도.
  themes: Object.freeze({
    'leadDown:lead': '주도주가 더 크게 내렸어도 미국 테마 {t} 중 {n}는 지수보다 앞선 주도 단계를 지킵니다.',
    'leadDown:none': '주도주가 더 내린 날, 미국 테마 {t} 가운데 주도 단계에 남은 곳이 없습니다.',
    'broadDown:lead': '시장 전체가 내린 가운데서도 미국 테마 {t} 중 {n}가 주도 단계에 남았습니다.',
    'broadDown:none': '함께 내린 날이고, 미국 테마 {t} 중 지수보다 앞선 주도 단계는 하나도 없습니다.',
    'leadUp:lead': '주도주가 더 오른 날, 미국 테마 {t} 중 {n}가 지수보다 앞선 주도 단계에 있습니다.',
    'leadUp:none': '주도주가 더 올랐지만 미국 테마 {t} 중 주도 단계는 아직 비어 있습니다.',
    'broadUp:lead': '고르게 오른 날이고, 미국 테마 {t} 중 {n}가 주도 단계입니다.',
    'broadUp:none': '종목 전반이 올랐어도 미국 테마 {t} 중 주도 단계는 없어, 앞장선 테마가 아직 안 보입니다.'
  }),
  // State: the Korean theme stages, read on a Korean session after the US one (lead · none). {t}, {n} as for 테마.
  korea: Object.freeze({
    'down:lead': '나스닥 100이 내린 뒤 한국 테마 {t} 중 {n}는 코스피보다 앞선 주도 단계에 있습니다.',
    'down:none': '나스닥 100이 내린 뒤 한국 테마 {t} 중 주도 단계는 없어, 버팀목이 될 테마가 보이지 않습니다.',
    'up:lead': '나스닥 100이 오른 뒤 한국 테마 {t} 중 {n}가 코스피보다 앞선 주도 단계입니다.',
    'up:none': '나스닥 100이 오른 뒤에도 한국 테마 {t} 중 주도 단계는 없어, 한국 쪽 주도 흐름은 아직 비어 있습니다.'
  }),
  // State: the 나스닥100 card's trend (above both lines · near the 50-day · pullback above the 200-day · under the 200-day).
  // {s50}, {s200}: the close against each line.
  charts: Object.freeze({
    'down:above': '내린 날에도 나스닥100은 50일선 대비 {s50}로 위에 있어, 상승 추세가 꺾이진 않았습니다.',
    'down:near': '내린 날 나스닥100은 50일선 대비 {s50}로 선 바로 곁이라, 추세가 갈리는 지점에 있습니다.',
    'down:pullback': '하락으로 나스닥100은 50일선 아래({s50})지만 200일선 대비 {s200}로, 긴 추세 안의 조정에 머뭅니다.',
    'down:under': '나스닥100은 200일선 대비 {s200}로 긴 추세선 아래라, 이날 하락이 약한 차트에 더해졌습니다.',
    'up:above': '오른 날 나스닥100은 50일선 대비 {s50}로 두 추세선 위에 있어, 상승 추세를 이어 갑니다.',
    'up:near': '올랐어도 나스닥100은 50일선 대비 {s50}로 아직 선 근처라, 추세 회복은 확인 전입니다.',
    'up:pullback': '오른 날 나스닥100은 50일선 대비 {s50}로 아래지만, 200일선 대비 {s200}로 긴 추세는 살아 있습니다.',
    'up:under': '나스닥100이 올랐어도 200일선 대비 {s200}로 아래라, 이번 상승은 긴 하락 추세 속 반등입니다.'
  })
});
