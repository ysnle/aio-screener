// v58.75 (persona review, teach-and-check spec 2026-10-24): the blocks that teach how to choose — the chart's price-level
// map and setup checklist, the stock lens, the open theme with its criteria, and the criteria → count → cause → branches
// answer order. Loaded on the first AI question (market-content.js loadChoosingBlocks), so none of it is in the boot set.
// The app never picks a price, weight or time; every block is facts, conditions and met counts.
import { signedText } from '../../domain/shared/number.js';

export function questionBlocks({ ctxId = '', text = '', root = {}, subjects = [] } = {}) {
  const out = [];
  // v58.75 (persona review): support/resistance/stop/target questions read the chart's level map (the same table the
  // 차트 screen shows). With no daily chart for the asked company the model is told to say how to get one.
  // `subjects` are the chat's resolved companies (typed, named in Korean, or the screen's own), else the typed symbols.
  subjects = subjects.map((id) => String(id).toUpperCase());
  const screenSubject = /^(technical|ticker|fundamental)$/.test(ctxId);
  const onChart = (symbol) => !!symbol && (subjects.some((id) => id === symbol || (/^\d{6}$/.test(id) && (symbol === `${id}.KS` || symbol === `${id}.KQ`))) || (!subjects.length && screenSubject));
  if (LEVEL_WORDS.test(text)) {
    const map = typeof root._aioPriceLevelsFor === 'function' ? root._aioPriceLevelsFor('') : null;
    out.push(map && onChart(map.symbol) ? priceLevelContext(map, text) : PRICE_LEVEL_MISSING);
  }
  // v58.75 (persona review): setup/breakout/pattern questions read the chart's setup coach (life cycle, checklist count,
  // weekly/daily agreement, the stock's own past breakouts); company analysis/thesis/comparison questions read the
  // stock lens. Each block is added only for its question type (P1740).
  if (SETUP_WORDS.test(text)) {
    const coach = typeof root._aioSetupCoachFor === 'function' ? root._aioSetupCoachFor('') : null;
    out.push(coach && onChart(coach.symbol) ? setupCoachContext(coach) : SETUP_COACH_MISSING);
  }
  const lensSymbol = subjects[0] || '';
  // A chart question ("셋업 상태 어때?") is not a company-analysis question unless it names a company lens word.
  const lensAsked = LENS_WORDS.test(text) && ((!SETUP_WORDS.test(text) && !LEVEL_WORDS.test(text)) || LENS_STRONG.test(text));
  if (lensSymbol && lensAsked && typeof root._aioStockLensFor === 'function') {
    let lens = null;
    try { lens = root._aioStockLensFor(lensSymbol); } catch (_) { lens = null; }
    const block = stockLensBlock(lens);
    if (block) out.push(block);
  }
  return out;
}

const SETUP_WORDS = /셋업|돌파|패턴|베이스|피벗|수축|vcp|컵|차트\s*(?:상태|어때|읽|해석)|breakout|setup/i;
const LENS_WORDS = /어때|어떤가|분석|논지|비교|강점|약점|동종|경쟁|밸류|실적|사업|재무|리스크|위험|유리|불리|살\s*만|괜찮|전망|점검/;
const LENS_STRONG = /논지|비교|강점|약점|동종|경쟁|밸류|실적|사업|재무/;
const SETUP_COACH_MISSING = '[셋업 점검표] 질문한 종목의 일봉 셋업 점검표가 이 맥락에 없다. 단계·충족 개수를 지어내지 말고 원리만 설명한 뒤 "차트 화면에서 이 종목 일봉을 열면 셋업 점검표를 근거로 답할 수 있습니다"라고 안내한다.';
const listText = (items, max = 4) => (Array.isArray(items) ? items.filter(Boolean).slice(0, max).join(' / ') : '');

export function setupCoachContext(coach) {
  const life = coach.lifecycle || {};
  const check = coach.checklist;
  const lines = [`【셋업 점검표 — ${coach.symbol}, ${coach.asOf} 완료 일봉, 화면 '셋업 읽기'와 같은 값】`,
    `생애 주기 단계: ${life.headline || life.stage || '미확인'}${life.check ? ` (이 단계에서 확인하는 것: ${life.check})` : ''}${life.sessionsSinceBreakout != null ? `, 돌파 후 ${life.sessionsSinceBreakout}거래일` : ''}`];
  if (check?.items?.length) {
    lines.push(`돌파 전 점검표: ${check.headline}`);
    for (const item of check.items) lines.push(`- ${item.label}: ${item.met === true ? '충족' : item.met === false ? '미충족' : '확인 불가'} — ${item.value}. 원리: ${item.principle}`);
    if (check.failedRule) lines.push(check.failedRule);
  } else lines.push('돌파 전 점검표: 화면에서 아직 계산되지 않음(충족 개수를 말하지 마라).');
  if (coach.alignment?.headline) lines.push(`주봉·일봉 정렬: ${coach.alignment.headline}${coach.alignment.reading ? ` — ${coach.alignment.reading}` : ''}`);
  if (coach.pastBreakouts) lines.push(`이 종목의 과거 돌파: ${typeof coach.pastBreakouts === 'string' ? coach.pastBreakouts : coach.pastBreakouts.text || ''}`);
  if (coach.market) lines.push(`시장 연결: ${coach.market}`);
  lines.push('충족 개수는 성공 확률이 아니다. 단계와 점검표를 원리와 함께 설명하고, 매수 시점·가격을 정하지 마라.');
  return lines.join('\n');
}

export function stockLensBlock(lens) {
  if (!lens) return '';
  const lines = [`【종목 렌즈 — ${lens.symbol}, 화면 '이 기업을 보는 법'과 같은 값】`];
  if (lens.marketLink) lines.push(`시황 연결: ${lens.marketLink}`);
  if (lens.lens?.metrics?.length) lines.push(`렌즈(${lens.lens.name}${lens.lens.basis ? `, ${lens.lens.basis}` : ''}) 추적 지표: ${lens.lens.metrics.slice(0, 6).map((m) => `${m.metric} ${m.value}${m.trend ? `(${m.trend})` : ''} — ${m.why}`).join(' / ')}`);
  if (lens.strengths?.length) lines.push(`동종 대비 강점: ${listText(lens.strengths, 3)}`);
  if (lens.weaknesses?.length) lines.push(`동종 대비 약점: ${listText(lens.weaknesses, 3)}`);
  if (lens.peers?.symbols?.length) lines.push(`비교한 동종(${lens.peers.theme}): ${lens.peers.symbols.slice(0, 8).join(', ')}`);
  if (lens.situation) lines.push(`유리한 환경: ${listText(lens.situation.favour, 3) || '미확인'}. 불리한 환경: ${listText(lens.situation.burden, 3) || '미확인'}.${lens.situation.now ? ` 지금: ${lens.situation.now}` : ''}${lens.situation.beta != null ? ` 시장 대비 베타 ${lens.situation.beta}.` : ''}`);
  if (lens.thesis) {
    const t = lens.thesis;
    if (t.priced) lines.push(`가격이 가정하는 것: ${t.priced}`);
    if (t.conditions?.length) lines.push(`논지가 맞으려면: ${listText(t.conditions)}`);
    if (t.checks?.length) lines.push(`확인 일정: ${listText(t.checks)}`);
    if (t.breaks?.length) lines.push(`논지가 틀렸다는 신호: ${listText(t.breaks, 5)}`);
    if (t.paths?.length) lines.push(`수익 경로(조건부): ${t.paths.map((path) => `${path.label} — 성립: ${path.holds} 깨짐: ${path.fails}`).join(' / ')}`);
  }
  if (lens.watch?.length) lines.push(`계속 볼 것: ${listText(lens.watch, 6)}`);
  if (lines.length < 3) return '';
  lines.push(`${lens.note || '사실·조건·충족 개수이며 매수·매도·가격·비중 판단이 아님'}. 위 값으로 기준 → 맞는 개수 → 이유 → 조건부 시나리오를 쓰고, 없는 값은 미확인으로 둔다.`);
  return lines.join('\n');
}

// v58.75 (persona review): the theme criteria table, when the 테마 owner's reader exists (window._aioThemeCriteriaFor).
// The shape is read defensively: items with label/met/value(/principle) are listed; anything else is skipped.
export function themeCriteriaBlock(root, themeId) {
  if (typeof root?._aioThemeCriteriaFor !== 'function' || !themeId) return '';
  let read = null;
  try { read = root._aioThemeCriteriaFor(themeId); } catch (_) { read = null; }
  const items = Array.isArray(read?.items) ? read.items : Array.isArray(read?.criteria) ? read.criteria : [];
  if (!items.length) return '';
  const met = items.filter((item) => item?.met === true).length, known = items.filter((item) => item?.met === true || item?.met === false).length;
  return [`테마 기준표(테마 화면과 같은 값): ${read.headline || `${items.length}개 중 ${met}개 충족${known < items.length ? `, 확인 불가 ${items.length - known}개` : ''}`} — 충족 개수이며 가능성이 아니다.`,
    ...items.slice(0, 8).map((item) => `- ${item.label || item.name || '기준'}: ${item.met === true ? '충족' : item.met === false ? '미충족' : '확인 불가'}${item.value != null ? ` — ${item.value}` : ''}${item.principle || item.why ? `. 원리: ${item.principle || item.why}` : ''}`)].join('\n');
}

const LEVEL_WORDS = /지지|저항|매물대|손절|목표\s*가|목표\s*가격|익절|가격\s*레벨|가격대|stop[-\s]?loss|price\s*target|support|resistance/i; // English as phrases only: 'Target'(TGT) and 'stop' alone are not level questions
const PRICE_LEVEL_METHOD = '[가격 레벨 답변 방식] 앱은 가격을 고르지 않는다. 위 레벨은 관찰할 가격대 후보이며 지지·저항 보장이 아니다. 손절을 물으면 구조 기준(직전 스윙 저점·수축 저점·지지 후보 아래), 변동성 기준(ATR·ADR 배수만큼 떨어진 곳), 시간 기준(정한 기간 안에 기대한 움직임이 없으면 재검토)의 장단점을 위 값으로 설명한다. 목표를 물으면 다음 저항 후보, 측정 이동폭(베이스 깊이만큼), R 배수(감수한 손실 폭의 배수) 방식의 장단점을 설명한다. 특정 가격을 골라 주거나 "이 가격에서 사라/팔라/손절하라"고 쓰지 않는다. 사용자가 자기 가격을 말했으면 아래 사실로 그 가격이 레벨 대비 어디인지 점검해 준다.';
const PRICE_LEVEL_MISSING = '[가격 레벨] 질문한 종목의 일봉 레벨 지도가 이 맥락에 없다. 지지·저항·손절·목표 가격을 지어내지 말고, 방법(구조·변동성·시간 기준 손절, 다음 저항·측정 이동폭·R 배수 목표)의 원리만 설명한 뒤 "차트 화면에서 이 종목 일봉을 열면 레벨 지도를 근거로 답할 수 있습니다"라고 안내한다.';

// The level map plus facts about any price the reader typed (where it sits against the map, and their plan's numbers).
export function priceLevelContext(map, query = '') {
  const num = (value, digits = 2) => (Number.isFinite(value) ? (Math.abs(value) >= 1000 ? Math.round(value).toLocaleString('en-US') : value.toFixed(digits)) : '—');
  const level = (item) => `${num(item.price)} (${num(item.low)}~${num(item.high)}, 현재가 대비 ${signedText(item.pct, 1)}%, ADR ${num(Math.abs(item.adrMultiple), 1)}배, ${item.kinds.join('·')}${item.reactions != null ? `, 반응 ${item.reactions}회` : ''})`;
  const lines = [`【가격 레벨 지도 — ${map.symbol}, ${map.asOf} 종가 ${num(map.close)}, 하루 평균 변동폭(ADR) ${num(map.adrPct, 1)}%, ATR ${num(map.atr)}】`,
    `저항 후보(가까운 순): ${map.resistanceCandidates.map(level).join(' / ') || '현재가 위 레벨 없음(최근 고점 위)'}`,
    `지지 후보(가까운 순): ${map.supportCandidates.map(level).join(' / ') || '현재가 아래 레벨 없음'}`,
    [map.swingLowBelow ? `직전 스윙 저점 ${num(map.swingLowBelow.price)} (${map.swingLowBelow.time})` : '', Number.isFinite(map.pivot) ? `피벗 ${num(map.pivot)}` : '', Number.isFinite(map.contractionLow) ? `마지막 수축 저점 ${num(map.contractionLow)}` : '', map.base ? `베이스 ${num(map.base.low)}~${num(map.base.high)} (깊이 ${num(map.base.depthPct, 1)}%)` : ''].filter(Boolean).join(', ') || '피벗·베이스 없음',
    `${map.note}.`];
  // Prices the reader typed, within ±60% of the close (so "3개월", "2배" are not read as prices).
  // v59.45 (pipeline review PASS13 후보): on a $3 stock "3개월" sat inside that window and was read as a price; a number
  // followed by a period, count, multiple or percent unit is not a price.
  const typed = [...String(query).matchAll(/\$?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?![\d.,])(?!\s*(?:개월|달(?!러)|주|일|년|분기|거래일|시간|분|배|%|퍼센트|회|번|bp|days?|weeks?|months?|years?|x\b))\s*(?:달러|원|불)?/g)].map((m) => Number(m[1].replace(/,/g, '')))
    .filter((value) => value > map.close * 0.4 && value < map.close * 1.6);
  const all = [...map.supportCandidates, ...map.resistanceCandidates];
  for (const value of [...new Set(typed)].slice(0, 4)) {
    const below = all.filter((item) => item.price < value).sort((a, b) => b.price - a.price)[0];
    const above = all.filter((item) => item.price > value).sort((a, b) => a.price - b.price)[0];
    const pct = (value / map.close - 1) * 100;
    lines.push(`사용자가 말한 ${num(value)}: 현재가 대비 ${signedText(pct, 1)}%(ADR ${num(Math.abs(pct) / map.adrPct, 1)}배), 바로 아래 레벨 ${below ? num(below.price) : '없음'}, 바로 위 레벨 ${above ? num(above.price) : '없음'}${map.swingLowBelow ? `, 직전 스윙 저점보다 ${value < map.swingLowBelow.price ? '아래' : '위'}` : ''}.`);
  }
  lines.push(PRICE_LEVEL_METHOD);
  return lines.join('\n');
}

// v58.75 (persona review): the theme whose detail is open on 테마 (or the one the question names) — name, stage and the
// constituents' 1-month moves at the screener close. The chat used to get only the id ("현재 테마: energy").
export function focusedThemeContext({ root = {}, ctxId = '', query = '', playbook = null, rows = [] } = {}) {
  const map = Array.isArray(root.THEME_MAP) ? root.THEME_MAP : [];
  const panel = root.document?.getElementById?.('theme-detail-panel');
  const openId = /^(themes|theme-detail)$/.test(ctxId) && panel && panel.style?.display !== 'none' ? String(root._currentThemeId || '') : '';
  // A named theme is the longest whole name token the question contains ('광통신' over '통신', which comes first in THEME_MAP).
  const tokenHit = (item) => String(item?.nameKr || '').split(/[ /·]/).filter((token) => token.length >= 2 && query.includes(token)).sort((a, b) => b.length - a.length)[0] || '';
  const named = map.map((item) => ({ item, hit: tokenHit(item) })).filter((entry) => entry.hit).sort((a, b) => b.hit.length - a.hit.length)[0]?.item;
  const theme = map.find((item) => item?.id === openId) || named;
  if (!theme) return '';
  const row = playbook?.available ? playbook.themes.find((item) => item.market === 'US' && item.id === theme.id) : null;
  const pctText = (value) => (value == null ? '—' : `${signedText(value, 1)}%`);
  const leaders = new Set((theme.leaders || []).map((sym) => String(sym).toUpperCase()));
  const priced = rows.filter((item) => leaders.has(String(item?.sym || '').toUpperCase()) && Number.isFinite(item?.ret1m));
  const dates = [...new Set(priced.map((item) => item.factorSessionDate).filter(Boolean))].sort();
  // v59.45 (pipeline review PASS13 후보): members measured at different closes were ranked together under the newest date;
  // only the members at that date are compared (the count below says how many of the theme that is).
  const members = (dates.length ? priced.filter((item) => item.factorSessionDate === dates.at(-1)) : priced).sort((a, b) => b.ret1m - a.ret1m);
  const name = (item) => `${String(item.sym).toUpperCase()}${item.name ? `(${String(item.name).slice(0, 18)})` : ''} ${pctText(item.ret1m)}`;
  const top = members.slice(0, 4).map(name), bottom = members.length > 6 ? members.slice(-2).map(name) : [];
  const criteria = themeCriteriaBlock(root, theme.id);
  return [`【지금 보는 테마】 ${theme.nameKr || theme.id}${theme.etf ? ` (대표 ETF ${theme.etf})` : ''}${openId === theme.id ? ', 화면에서 상세를 연 테마' : ', 질문이 이름을 부른 테마'}`,
    row ? `단계: ${row.stateLabel} (1개월 ${pctText(row.ret1m)}${row.ret6m != null ? `, 6개월 ${pctText(row.ret6m)}` : ''}${row.ret5d != null ? `, 5거래일 ${pctText(row.ret5d)}` : ''}, ${row.basis || '기준일 미확인'} 종가)` : '단계: 이 테마의 단계 판정 자료가 없다(판정 보류).',
    top.length ? `구성 종목 1개월 수익률 상위: ${top.join(', ')}${bottom.length ? ` / 하위: ${bottom.join(', ')}` : ''} (수익률 있는 ${members.length}/${leaders.size}종목, 종가 기준일 ${dates.at(-1) || '미확인'}). 사실 나열이며 매수 후보 추천이 아니다.` : '구성 종목 수익률 자료가 없다.', criteria].filter(Boolean).join('\n');
}

// v58.75 (persona review, teach-and-check spec 2026-10-24): theme, stock and portfolio questions are answered the way an
// expert teaches choosing — the criteria and why they matter, how many of them the subject meets now (a count with the
// values, never a probability or grade), the data-confirmed cause chain, then conditional branches. Only for analysis-
// type answers about one of those subjects (~400 tokens); a definition or a quick fact keeps its short shape.
const TEACH_CRITERIA = Object.freeze({
  theme: '여러 기간(1·3·6개월) 상대강도가 같은 방향인가, 참여 폭(구성 종목 중 50일선 위 비율 — 소수 종목만 끄는 테마는 약하다), 이익 전망이 가격과 같은 방향인가, 구조적 서사·다가오는 촉매, 과열·쏠림(50일선 대비 거리·단기 급등), 지금 시황·선두 시나리오에서 수혜인가 부담인가',
  stock: '사업 유형에 맞는 핵심 지표(예: 반도체는 재고·매출총이익률·설비투자 사이클, 소프트웨어는 매출 성장·순이익률·현금흐름), 동종 대비 위치(성장·마진·밸류에이션·상대강도), 가격이 이미 가정하는 성장과 실제 성장의 차이(주입됐을 때), 추세와 가까운 지지·저항 후보, 다음 실적 일정',
  portfolio: '종목·업종 쏠림, 실질 분산(보유 종목끼리의 상관), 시나리오 노출(같은 위험 요인을 공유하는 묶음), 현금 비중과 그 선택권 가치, 감내 가능한 낙폭, 보유마다 논지(산 이유)와 그 논지가 깨지는 신호가 있는가'
});
export function teachAndCheckBlock(subject, mode = 'analysis', sources = []) {
  if (!TEACH_CRITERIA[subject] || !/^(analysis|decision|outlook|comparison)$/.test(mode)) return '';
  return ['【가르치듯 답하기 — 기준 → 지금 맞는 개수 → 이유 → 조건부 시나리오】',
    // When the app's own criteria tables were injected (stock lens, setup checklist, theme criteria, level map) the
    // criteria come from them, with their values and met counts; the generic list is the fallback.
    sources.length
      ? `1. 기준과 원리: 주입된 ${sources.map((mark) => mark.replace('【', '')).join(', ')} 블록의 기준(렌즈 지표, 동종 대비 강점·약점, 논지 조건과 깨짐 신호, 점검표 항목)을 기준으로 쓰고 각각 왜 보는지 한 줄로 쓴다. 블록의 충족 개수와 값을 그대로 인용한다.`
      : `1. 기준과 원리: 전문가가 이 대상을 볼 때 쓰는 기준을 질문에 맞게 3~6개 고르고 각각 왜 보는지 한 줄로 쓴다. 후보: ${TEACH_CRITERIA[subject]}.`,
    '2. 지금 맞는 개수와 값: 주입 데이터로 확인되는 기준만 "확인된 N개 중 M개 충족"으로 세고 각 기준의 실제 값과 기준일을 붙인다. 자료가 없는 기준은 "미확인"으로 따로 적고 세지 않는다. 충족 개수는 가능성·등급·점수가 아니다.',
    '3. 이유: 데이터로 확인되는 원인 사슬만 쓴다(거시 축 → 업종, 이익 전망 변화, 같은 기간 뉴스, 자금 이동, 선두 시나리오에서의 수혜·부담). 확인되지 않는 원인은 후보로만 두고 단정하지 않는다.',
    '4. 조건부 시나리오: 유리해지는 조건과 불리해지는 조건, 다음에 확인할 것, 논지가 깨졌다고 볼 신호. 확률·목표가·매매 지시는 쓰지 않는다.',
    '첫머리나 이유 부분에서 지금 시장 상태·선두 시나리오·금리·유가·달러·신용 중 이 대상과 연결되는 것을 한 문장으로 잇는다. 이 순서는 뼈대이며, 질문이 한 측면만 물으면 그 칸을 깊게 쓰고 나머지는 줄인다. 사용자가 스스로 판단하고 추적하도록 돕는 것이 목적이다.'].join('\n');
}


// v58.75 (persona review): "이번 주", "일주일", "최근 며칠" read up to 7 days of the news already loaded — never wider than
// what the cache holds — and the header names the span it actually covers. null keeps the default 24-hour window.
const WEEK_WORDS = /이번\s*주|지난\s*주|일주일|한\s*주|7\s*일|최근\s*며칠|며칠\s*(?:간|동안|사이)|this\s*week|past\s*week/i;
export function newsWindow(query = '', now = Date.now()) {
  if (!WEEK_WORDS.test(String(query))) return null;
  const day = 24 * 3600000;
  const fmt = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(5, 10).replace('-', '/');
  return {
    windowMs: 7 * day,
    limit: 8,
    header(items = []) {
      const times = items.map((item) => new Date(item?.pubDate).getTime()).filter(Number.isFinite);
      const oldest = times.length ? Math.min(...times) : null;
      return `【최근 시장 뉴스 (자동 수집, 질문이 최근 며칠~일주일을 물어 최대 7일, 실제 보유 범위 ${times.length ? `${fmt(oldest)}~${fmt(Math.max(...times))}` : '미확인'} KST)】\n`
        + (oldest != null && now - oldest < 6 * day ? '보유 뉴스가 일주일보다 짧다. 이 범위 밖의 날은 "수집된 기사 없음"으로 밝히고 사건을 지어내지 마라.\n' : '');
    }
  };
}

// P1729 (moved from js/aio-chat.js, v58.75): the 08:00 KST window boundary and the provisional post-08:00 slot. The
// canonical bundle closes at 08:00, so a Korean session's events reach it only the next morning; the model is told which
// window it reads and whether any post-08:00 headline exists, so an empty slot is not read as "nothing happened".
export function newsWindowContext(root = globalThis) {
  const meta = root._serverDataMeta || {};
  const fmt = (iso) => {
    const ms = Date.parse(iso || '');
    if (!Number.isFinite(ms)) return null;
    const k = new Date(ms + 9 * 3600000).toISOString();
    return `${k.slice(5, 10).replace('-', '/')} ${k.slice(11, 16)}`;
  };
  const start = fmt(meta.newsCycleStart), end = fmt(meta.newsCycleEnd);
  let out = `\n\n【뉴스 수집 창】\n${start && end
    ? `정식 묶음: ${start} ~ ${end} KST(08:00 마감 24시간). 08:00 이후 사건은 이 묶음에 없고 다음 08:00 수집본에 들어간다.`
    : '정식 묶음 창 미확인 — 기사 시각을 직접 확인하라.'}\n`;
  const endMs = Date.parse(meta.newsCycleEnd || '');
  const intraday = (Array.isArray(root._serverNewsIntraday) ? root._serverNewsIntraday : []).filter((it) => {
    const ms = Date.parse(it?.publishedAt || '');
    return it?.title && Number.isFinite(ms) && (!Number.isFinite(endMs) || ms >= endMs);
  }).slice(0, 6);
  if (intraday.length) {
    out += '【08:00 이후 장중 속보 (잠정)】 헤드라인만 수집된 미확정 기사다. 인용 시 "잠정"과 시각을 밝히고 본문 내용을 추정하지 마라.\n'
      + intraday.map((it, i) => `${i + 1}. [${fmt(it.publishedAt) || '시각 미확인'} KST, ${it.source || '출처 미확인'}${it.market ? `, ${it.market}` : ''}] ${String(it.title).substring(0, 140)}`).join('\n') + '\n';
  } else {
    out += '08:00 이후 장중 속보 칸: 수집된 기사 없음. 오늘 한국장 시간대 사건(급락·발표 등)은 이 맥락에 없을 수 있으니 "기사 없음"을 "사건 없음"으로 단정하지 마라.\n';
  }
  return out;
}

// v58.75 (persona review): per-turn pieces of the AI panel, moved out of js/aio-chat.js (R620).
// A screen-selected company (chat-tickers.js source 'screen') is named to the model and heads the answer.
export const screenSubjectPrompt = (symbol) => `\n\n[화면 종목]\n질문에 종목 이름이 없어, 사용자가 지금 화면에서 보고 있는 ${symbol}를 대상으로 답한다. 다른 종목으로 바꾸지 말고, 이 종목 자료가 비어 있으면 비어 있다고 밝힌다.\n`;
export const answerHead = (symbol, gate, text) => (symbol && !gate?.blocked ? `보고 있는 ${symbol} 기준\n\n${text}` : text);

// Holdings reach the model only after the portfolio consent preview, as the redacted rows (ticker, sector, weight,
// return). `pending` is the prompt _aioPortfolioAsk built from those rows; a typed question in a consented session gets
// the rows attached. Otherwise the model is told none were sent, and a holdings question gets a one-line notice.
export function portfolioTurn({ root = globalThis, query = '', pending = null, wrap = (kind, text) => text } = {}) {
  if (pending && String(pending).trim() === query) return { data: true, prompt: '', notice: '' };
  const line = root.AIO?.hasPortfolioAIConsent?.() && typeof root.AIO?.portfolioRowsLine === 'function' ? root.AIO.portfolioRowsLine(root) : '';
  if (line) return { data: true, prompt: wrap('PORTFOLIO_ROWS', `사용자 보유 종목(비식별, 종목·섹터·비중·수익률만): ${line}`, { maxChars: 4000 }), notice: '' };
  return { data: false,
    prompt: '\n\n[포트폴리오]\n이번 질문에는 사용자의 보유 내역이 전송되지 않았다(전송 동의 전). 보유 종목·비중·수익률을 추정하지 말고 일반 점검 기준으로 답한다.\n',
    notice: /포트폴리오|보유|내\s*종목|비중|리밸런싱|복기|수익률|손익/.test(query) ? '보유 내역을 보내려면 동의가 필요합니다. 이번 답은 보유 종목 없이 씁니다. 포트폴리오 화면의 \'종합 분석\' 버튼에서 보낼 항목을 보고 동의할 수 있습니다.' : '' };
}

// Theme, stock and portfolio questions get the teach-and-check order; the app's own criteria tables already in the prompt
// (stock lens, setup checklist, theme criteria, level map) replace the generic criteria list.
export function teachForTurn({ ctxId = '', query = '', tickers = [], mode = 'analysis', prompt = '' } = {}) {
  const subject = ctxId === 'portfolio' || /포트폴리오|보유\s*종목|내\s*종목/.test(query) ? 'portfolio'
    : (/^(themes|theme-detail)$/.test(ctxId) || /테마|섹터|업종/.test(query)) && !tickers.length ? 'theme'
      : tickers.length ? 'stock' : null;
  return teachAndCheckBlock(subject, mode, ['【종목 렌즈', '【셋업 점검표', '테마 기준표', '【가격 레벨 지도'].filter((mark) => prompt.includes(mark)));
}

// Only the evidence this answer actually read, plus the screen and the close it was asked on. Unused sources used to be
// listed in grey on every answer, which read as "checked and empty".
const BADGES = [['ticker', 'on', '종목 데이터'], ['fundamentals', 'on', '재무'], ['technical', 'cyan', '차트 지표'], ['screener', 'amber', '스크리너'], ['domain', 'on', '화면 데이터'], ['news', 'on', '뉴스'], ['portfolio', 'on', '보유 내역'], ['web', 'purple', '웹검색'], ['aiWeb', 'purple', 'AI 웹검색'], ['deep', 'cyan', '심층']];
export function sourceBadge(root, ctxId, flags = {}) {
  const used = { ...flags, fundamentals: /PER:|FCF Yield|Balance Sheet|EV\/EBITDA|Segments|income statement|재무제표/i.test(flags.tickerText || '') };
  let close = null;
  try { close = root._aioChatCloseMarketBasis?.(); } catch (_) { close = null; }
  const items = BADGES.filter(([key]) => used[key]).map(([, tone, label]) => `<span class="lch-src-${tone}">${label}</span>`);
  const basis = `${root.__aioChatSessions?.screenLabel?.(ctxId) || '이'} 화면 기준${close?.asOf ? `, 종가 ${String(close.asOf).slice(5).replace('-', '/')}` : ''}`;
  return `<span class="lch-muted">${basis.replace(/[&<>"']/g, '')}${items.length ? ', 사용한 근거' : ''}</span>${items.join('')}`;
}
