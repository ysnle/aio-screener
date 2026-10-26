// P1740: the answer's shape follows the question instead of one template. Every answer used to be squeezed into
// "summary ≤2 sentences, ≤4 sections × ≤3 sentences" while earlier blocks also demanded a six-step stock memo, so a
// definition, a macro question and a stock comparison all came back in the same short generic form.
import { CHOICE_WORDS } from '../../domain/content/choice-words.js';

export function chooseAnswerMode(policy) {
  const intent = policy?.intent || {};
  const intents = intent.intents || [];
  const canonical = intent.canonical || [];
  const depth = intent.questionPlan?.requestedDepth || 'standard';
  if (policy?.isBroadRecommendation) return 'screen';
  if (policy?.asksDecision && policy.hasTicker) return 'decision';
  if (policy?.asksDecision && intent.wantsAction) return 'outlook'; // P1742: a market/sector-level "buy now?" is a branch question
  if (intent.wantsCompare && canonical.includes('COMPARISON')) return 'comparison';
  if (intent.wantsCompare && canonical.includes('SCREENING')) return 'screen';
  if (intents.includes('EXPLAIN_BEGINNER') && intents.length === 1) return depth === 'brief' ? 'quick' : 'explain';
  if (depth === 'brief') return 'quick';
  // P1742: a forward or "what should I do" question about the market (no single company) is answered as branches.
  if (!policy?.hasTicker && (canonical.includes('OUTLOOK') || intent.wantsAction)) return 'outlook';
  if (policy?.needsTickerFactAnswer && canonical[0] === 'ENTITY_FACT' && !intent.wantsDeep) return 'quick';
  return 'analysis';
}

const ANSWER_MODE_GUIDE = {
  quick: '짧은 확인형 질문이다. summary 1~3문장으로 바로 답하고, 해석이 필요할 때만 sections 1개를 더한다. 배경 설명을 늘어놓지 마라.',
  explain: '개념 설명형 질문이다. 한 줄 정의 → 작동 원리(왜 그렇게 움직이는지) → 실제 예(주입 데이터가 있으면 그 값, 없으면 가상의 예라고 밝힘) → 자주 하는 오해나 한계 순으로 2~4개 섹션을 쓴다. 【시장 가이드】의 원칙이 질문과 맞으면 그 원칙의 오늘 근거를 실제 예로 쓴다. 전문 용어는 처음 나올 때 풀어 쓴다.',
  analysis: '분석형 질문이다. summary에 핵심 판단을 먼저 쓰고, 관측된 근거 → 해석과 전달 경로(무엇이 무엇에 왜 영향을 주는지) → 반대 시나리오 → 판단을 바꿀 확인 신호를 3~6개 섹션으로 구성한다. 앞날을 다룰 때는 단일 예측 대신 조건부 시나리오와 각 시나리오의 기회비용으로 말한다. 질문이 특정 측면만 물으면 그 측면을 깊게 다루고 나머지는 생략한다.',
  comparison: '비교형 질문이다. 무엇을 기준으로 비교하는지 먼저 밝히고, 한 섹션에 markdown 표(열 5개 이하)로 핵심 차이를 정리한 뒤, 차이가 생기는 이유와 상황별로 어느 쪽이 더 맞는지, 각 선택이 틀릴 조건을 쓴다.',
  decision: '매매·비중 판단 질문이다. 사라·팔라는 명령 대신 현재 근거가 어느 쪽을 얼마나 지지하는지(조건 충족 수·시장 가격 방향·과거 빈도와 표본 수), 보유·추가·축소·관망 각각의 기회비용, 지금 조건에서 비용이 작아 보이는 쪽과 그 이유, 판단을 뒤집을 무효화 신호, 결정 전에 확인할 체크리스트를 제시한다. 가격·수량·시점은 정하지 않고 최종 결정은 사용자가 한다.',
  outlook: '전망·대응 질문이다. 하나의 예측 대신 시나리오로 답한다: 지금 위치(한 줄, 근거 수치) → 다음 발표(공식 날짜) → 시나리오 2~3개마다 인과 사슬(무엇이 무엇을 거쳐 주가에 닿는지), 가능성 근거(조건 충족 n/m · 시장 가격 방향 · 과거 빈도와 표본 수), 그 시나리오에서 강해지는 영역과 약해지는 영역 → 각 시나리오에서 선택지(관망 · 분할 접근 · 보유 유지 · 방어 전환)의 기회비용과 ' + CHOICE_WORDS.favored + ' → 테마·섹터가 걸린 질문이면 【테마 시나리오】의 단계(주도 지속·추세 속 조정·반등 시도·약세 지속)·거시 영향·구조 가설과 그것이 깨지는 신호로 같은 선택지 구조를 적용 → 거시 전략가·업종 애널리스트·위험 관리자 관점이 엇갈리는 곳을 한 줄씩 대비하고 어느 근거가 더 무거운지 밝힘 → 【시장 가이드】가 주입됐으면 여러 시나리오를 함께 놓은 선택지 집계(확률이 아닌 개수)와 빗나갈 때의 기회비용, 지향할 것·지양할 것, 오늘 해당하는 원칙(태도·전략·속지 말 것·믿을 것)을 그 근거와 함께 짧게 → 판단을 바꿀 신호. 시나리오 비교는 markdown 표(시나리오 · 근거 · ' + CHOICE_WORDS.favored + ')로 정리해도 좋다. 끝에 세부 종목 선별은 어느 화면(차트 · 기업 · 테마 · 스크리너)에서 무엇을 확인하면 되는지 짧게 안내한다.',
  screen: '후보 탐색형 질문이다. 주입된 스크리너 후보만 사용해 섹터·스타일이 겹치지 않게 후보를 고르고, 각 후보가 뽑힌 이유·약점·제외 조건을 짧게 쓴다. 후보가 부족하면 조건을 바꿔 다시 찾는 방법을 제안한다.',
};

export function answerModeGuide(mode) {
  const key = ANSWER_MODE_GUIDE[mode] ? mode : 'analysis';
  return `\n\n【이번 답변의 형태 — mode=${key}】\n${ANSWER_MODE_GUIDE[key]}\n`;
}
