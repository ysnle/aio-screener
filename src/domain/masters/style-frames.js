// P1479 (knowledge review 2026-10-04, 2차): the masters screen should teach what each way of managing
// money is for, not only list famous holdings. Each style states the problem it solves, where its
// return comes from, the risk it accepts and — because 13F shows only long US-listed equity positions
// (and some options/convertibles) at quarter end — what 13F can and cannot reveal about it.
const S = (frame) => Object.freeze(frame);

export const STYLE_FRAMES = Object.freeze([
  S({ id: 'passive', label: '패시브·인덱스', match: /패시브|인덱스|ETF|초저비용/,
    problem: '시장 평균 수익을 낮은 비용으로 얻는다', source: '시장 전체의 수익(베타)', risk: '시장 전체 하락, 지수 구성의 쏠림',
    sees: '지수와 거의 같은 보유와 시가총액 비중', blind: '보유 변화는 판단이 아니라 지수 변경·자금 흐름의 결과' }),
  S({ id: 'concentrated', label: '집중·가치·퀄리티', match: /집중·가치|집중·퀄리티|가치·현금|장기 보유/,
    problem: '내재가치보다 싸거나 오래 복리로 성장할 기업을 소수 보유한다', source: '종목 선택과 장기 보유', risk: '소수 종목 손실, 가치 함정, 긴 부진 기간',
    sees: '소수 종목의 큰 비중, 분기 변화가 적음', blind: '현금·채권·해외·비상장 보유와 매수 가격' }),
  S({ id: 'activist', label: '행동주의', match: /행동주의/,
    problem: '지배구조·자본배분을 바꿔 기업 가치를 끌어올린다', source: '기업 변화(촉매)', risk: '캠페인 실패, 소수 종목·유동성 위험',
    sees: '집중 보유(13D·13G 대량보유 공시와 함께 보면 시점이 더 정확)', blind: '경영진과의 협상 내용과 목표' }),
  S({ id: 'credit', label: '신용·하방 방어', match: /신용|하방 방어/,
    problem: '부도·구조조정 위험을 가격으로 보상받는다', source: '신용 스프레드, 부실 자산 회수', risk: '부도·회수율·유동성',
    sees: '상장 주식·일부 전환사채만', blind: '수익의 대부분인 회사채·대출·부실채권(13F 대상 아님)' }),
  S({ id: 'macro', label: '매크로', match: /매크로|거시/,
    problem: '금리·환율·원자재·국가 간 흐름의 방향에서 수익을 낸다', source: '선물·외환·국채 포지션', risk: '레버리지, 정책 급변',
    sees: '일부 주식·ETF', blind: '핵심 포지션(선물·외환·국채)은 13F에 거의 나타나지 않음' }),
  // Codex review 2026-10-05: Dimensional's own description is low-turnover systematic factor investing,
  // not the high-turnover market-neutral book the quant group describes. It gets its own frame.
  S({ id: 'factor', label: '학술 팩터·체계적', match: /학술 팩터|저비용·체계적/,
    problem: '학술 연구로 확인된 수익 요인(규모·가치·수익성)을 낮은 비용으로 꾸준히 담는다', source: '팩터 프리미엄, 낮은 비용과 낮은 회전', risk: '팩터의 긴 부진 기간, 시장 전체 하락',
    sees: '수천 종목에 넓게 나눈 롱 포지션, 분기 변화가 작음', blind: '펀드별 규칙과 해외 주식·채권 운용' }),
  S({ id: 'quant', label: '퀀트·멀티전략', match: /퀀트|멀티전략|시장중립|팩터|체계적/,
    problem: '작은 통계적 우위 여러 개를 분산해 쌓는다', source: '팩터·시장중립 롱숏, 높은 회전', risk: '모델 붕괴, 같은 전략의 동시 청산, 레버리지',
    sees: '수천 종목의 롱 포지션', blind: '숏 포지션과 헤지 — 롱만 보고 방향성을 판단할 수 없음' }),
  S({ id: 'growth', label: '성장·혁신', match: /성장|혁신|테마|벤처|AI 인프라|모멘텀/,
    problem: '빠르게 커지는 산업·기업을 일찍 보유한다', source: '성장 프리미엄', risk: '밸류에이션 하락, 금리 상승에 민감',
    sees: '테마·업종 집중과 큰 비중 변화', blind: '비상장·초기 투자와 매도 가격' }),
  S({ id: 'event', label: '역발상·이벤트', match: /비대칭|이벤트|역발상/,
    problem: '시장이 크게 잘못 가격을 매긴 소수의 상황을 찾아 비대칭 수익을 노린다', source: '역발상 판단, 특수 상황', risk: '타이밍 오류, 소수 포지션 손실, 긴 대기',
    sees: '소수 종목과 큰 분기 변화, 일부 옵션', blind: '숏·신용부도스와프 같은 하락 베팅 대부분' }),
  S({ id: 'multi-asset', label: '다자산·장기 분산', match: /다자산|대학기금|분산|글로벌·분산|리서치|액티브·장기|기관/,
    problem: '여러 자산군에 나눠 장기 목표 수익을 맞춘다', source: '자산 배분과 각 운용 부문', risk: '자산군 동반 하락, 유동성 낮은 대체투자',
    sees: '상장 주식 부분', blind: '사모·부동산·인프라·헤지펀드 등 대체투자의 대부분' })
]);

export function styleFrameOf(style = '') {
  return STYLE_FRAMES.find((frame) => frame.match.test(String(style))) || null;
}

// Catalog managers grouped by frame (first matching frame), for the comparison table.
export function groupManagersByStyle(managers = []) {
  const groups = new Map(STYLE_FRAMES.map((frame) => [frame.id, []]));
  for (const manager of managers) {
    const frame = styleFrameOf(manager?.style);
    if (frame) groups.get(frame.id).push(manager.displayName || manager.id);
  }
  return groups;
}
