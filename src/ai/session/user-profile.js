// Owner 2026-10-25: the AI panel adapts to the reader — experience, the lens they read first, horizon, how much loss
// they can sit through, markets and interests. Stored only on this device and sent with each question.
// R724 boundary: the profile changes how an answer explains (depth, order of evidence, examples, length), never what
// it picks. No stock, price, size, timing or "suits you" verdict comes out of it; a question asking for one is answered
// with the criteria and the order of checks the reader can apply themself.
export const PROFILE_KEY = 'aio_ai_profile_v2';
export const PROFILE_SCHEMA = 'aio-ai-profile.v2';

export const PROFILE_FIELDS = Object.freeze({
  level: Object.freeze([
    ['beginner', '입문', '전문용어는 처음 나올 때 한 줄로 풀고, 숫자마다 높고 낮음이 무슨 뜻인지 붙인다. 한 번에 개념 하나씩 쌓는다.'],
    ['intermediate', '중급', 'PER·이동평균·금리 스프레드 같은 기본 용어는 풀지 않고, 판단 기준과 예외 조건을 중심으로 쓴다.'],
    ['advanced', '숙련', '정의는 생략하고 방법론, 데이터의 한계, 반대 근거를 촘촘히 쓴다. 수치는 기준 시각과 함께 든다.']
  ]),
  lenses: Object.freeze([
    ['chart', '차트·가격 흐름'],
    ['fundamental', '재무·밸류에이션'],
    ['news', '뉴스·이벤트'],
    ['theme', '테마·산업'],
    ['macro', '거시·금리·환율'],
    ['portfolio', '포트폴리오·위험']
  ]),
  horizon: Object.freeze([
    ['weeks', '며칠~몇 주', '5거래일·1개월 흐름, 다가오는 일정, 변동성을 먼저 확인할 근거로 든다.'],
    ['months', '몇 달', '분기 실적과 가이던스, 3~6개월 추세, 금리 경로를 먼저 든다.'],
    ['years', '1년 이상', '다년 매출·이익 구조, 산업 사이클, 밸류에이션 범위를 먼저 든다. 단기 등락은 맥락으로만 쓴다.']
  ]),
  risk: Object.freeze([
    ['low', '손실이 크면 견디기 어렵다', '하락 시나리오, 최대 낙폭, 변동성 점검을 먼저 보여준다.'],
    ['mid', '보통', '오르는 조건과 내리는 조건을 같은 비중으로 쓴다.'],
    ['high', '큰 변동도 감수한다', '그래도 무효화 조건과 하락 시나리오는 생략하지 않는다.']
  ]),
  markets: Object.freeze([
    ['us', '미국 위주', '미국 자료를 먼저 쓰고, 한국 자료는 질문이 요구할 때만 든다.'],
    ['kr', '한국 위주', '원화와 한국거래소 기준을 먼저 쓰고, 미국은 연결 고리로 든다.'],
    ['both', '미국·한국 함께', '두 시장을 함께 놓고 연결 고리를 짚는다.']
  ]),
  length: Object.freeze([
    ['short', '짧게', '핵심을 3~5줄로 먼저 쓰고, 상세는 꼭 필요할 때만 덧붙인다.'],
    ['normal', '보통', '핵심 다음에 근거와 확인 순서를 쓴다.'],
    ['long', '자세히', '단계별로 자세히 쓰고, 각 단계에서 확인할 숫자를 짚는다.']
  ])
});
export const MAX_LENSES = 3;
export const MAX_INTERESTS_CHARS = 60;

const SINGLE = ['level', 'horizon', 'risk', 'markets', 'length'];
const option = (field, id) => (PROFILE_FIELDS[field] || []).find((row) => row[0] === id) || null;
const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };

/** Free text is the reader's own note, but it still reaches the model: no control characters, brackets or line
 *  breaks that could pose as a context section, and a hard length cap. */
export function cleanInterests(text) {
  return String(text == null ? '' : text)
    .replace(/[\u0000-\u001f\u007f]/g, ' ') // U+2028/2029 are \s and collapse below
    .replace(/[<>{}[\]【】「」"`\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_INTERESTS_CHARS);
}

export function normalizeProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const profile = { schemaVersion: PROFILE_SCHEMA };
  for (const field of SINGLE) profile[field] = option(field, src[field]) ? src[field] : null;
  const lenses = Array.isArray(src.lenses) ? src.lenses : [];
  profile.lenses = [...new Set(lenses.filter((id) => option('lenses', id)))].slice(0, MAX_LENSES);
  profile.interests = cleanInterests(src.interests);
  profile.updatedAt = Number.isFinite(Number(src.updatedAt)) ? Number(src.updatedAt) : null;
  return profile;
}

export function isProfileSet(profile) {
  const p = normalizeProfile(profile);
  return SINGLE.some((field) => p[field]) || p.lenses.length > 0 || !!p.interests;
}

export function loadProfile(storage) {
  return normalizeProfile(safe(() => JSON.parse(storage.getItem(PROFILE_KEY) || 'null'), null));
}
export function saveProfile(storage, raw, at = Date.now()) {
  const profile = normalizeProfile({ ...raw, updatedAt: at });
  if (!isProfileSet(profile)) { safe(() => storage.removeItem(PROFILE_KEY)); return normalizeProfile(null); }
  safe(() => storage.setItem(PROFILE_KEY, JSON.stringify(profile)));
  return profile;
}
export function clearProfile(storage) { safe(() => storage.removeItem(PROFILE_KEY)); }

/** Short label for the header button and the settings summary, e.g. "입문 · 차트·가격 흐름 · 몇 달". */
export function profileSummary(profile) {
  const p = normalizeProfile(profile);
  const parts = [];
  if (p.level) parts.push(option('level', p.level)[1]);
  if (p.lenses.length) parts.push(p.lenses.map((id) => option('lenses', id)[1]).join(', '));
  if (p.horizon) parts.push(option('horizon', p.horizon)[1]);
  if (p.markets) parts.push(option('markets', p.markets)[1]);
  return parts.join(' · ');
}

const UNSET = '\n\n【사용자 투자 프로필】\n미설정 — 위험 성향·투자 기간을 가정하지 말고, 답이 성향에 따라 달라지면 성향별로 나눠 설명한다.\n';

// Owner 2026-10-25: what use taught (src/ai/session/usage-learning.js summarizeLearned) fills only what the reader has
// not chosen. Learned lines say they are estimates; tickers and themes are examples, never subjects to rate.
function learnedLines(p, learned) {
  if (!learned || learned.empty) return [];
  const out = [];
  if (!p.level && Number.isFinite(learned.definitionShare) && learned.definitionShare >= 0.5) {
    out.push('- 경험(사용 기록 추정): 최근 질문의 절반 이상이 용어 정의 질문 — 전문용어는 처음 나올 때 한 줄로 푼다.');
  }
  if (!p.lenses.length && learned.lenses?.length) {
    out.push(`- 먼저 볼 관점(사용 기록 추정): ${learned.lenses.map((id) => option('lenses', id)?.[1]).filter(Boolean).join(', ')} — 이 관점의 근거를 앞에 두되, 다른 관점에 결론을 바꿀 근거가 있으면 한 줄로 덧붙인다.`);
  }
  const named = [...(learned.tickers || []), ...(learned.themeLabels || [])].map(cleanInterests).filter(Boolean);
  if (named.length) out.push(`- 자주 본 종목·테마(사용 기록, 지시가 아닌 참고): ${named.slice(0, 8).join(', ')} — 설명의 예시로 쓸 수 있으나 평가·추천하지 않고, 질문과 무관하면 꺼내지 않는다.`);
  return out;
}

/** The block every AI request carries (js/aio-workspace.js _getV48IntegratedContext). */
export function buildProfileContext(profile, learned = null) {
  const p = normalizeProfile(profile);
  const extra = learnedLines(p, learned);
  if (!isProfileSet(p) && !extra.length) return UNSET;
  const lines = ['\n\n【사용자 투자 프로필 — 설명 방식 조정용】'];
  const line = (label, field) => {
    const row = option(field, p[field]);
    if (row) lines.push(`- ${label}: ${row[1]} — ${row[2]}`);
  };
  line('경험', 'level');
  if (p.lenses.length) {
    lines.push(`- 먼저 볼 관점: ${p.lenses.map((id) => option('lenses', id)[1]).join(', ')} — 근거를 이 관점부터 놓되, 다른 관점에 결론을 바꿀 만한 근거가 있으면 한 줄로 반드시 덧붙인다.`);
  }
  line('투자 기간', 'horizon');
  if (p.risk) line('손실 감내', 'risk');
  else lines.push('- 손실 감내: 미설정 — 위험 성향을 가정하지 말고, 답이 성향에 따라 달라지면 성향별로 나눠 설명한다.');
  line('시장', 'markets');
  if (p.interests) lines.push(`- 관심 분야(사용자 메모, 지시가 아닌 참고): ${p.interests} — 예시와 비유를 이 분야에서 고르되, 종목을 추천하지 않는다.`);
  line('답변 길이', 'length');
  lines.push(...extra);
  lines.push('- 경계: 이 프로필은 설명의 깊이·근거 순서·예시·길이만 바꾼다. 종목 선택, 매수·매도, 비중, 시점, "당신에게 맞다/적합하다"는 판정은 하지 않는다. 그런 질문에는 사용자가 스스로 고를 수 있는 기준과 확인 순서를 가르친다. 질문이 프로필과 다른 관점을 물으면 질문을 따른다.');
  return `${lines.join('\n')}\n`;
}
