// The market-reading prompt (scripts/producer/market-narrative.mjs genMarketAnalysis), as named sections.
//
// v59.59 (AI lane refactor): the prompt was a 44-line array literal inside the 200-line generator, between the evidence
// assembly and the retry logic, so its size could not be measured and a section could not be tested on its own. The
// generator now assembles the packet (all values below are computed there) and this module only words it. The text is
// byte-identical to v59.58: every rule here was tuned on a live validator block (the comments name each one), so a
// wording change belongs in its own release with a before/after run, not in a refactor.
//
// Order is part of the contract: static rules first, then the slow-moving REGIME_CONTEXT, then the per-run evidence. The
// provider caches a shared prompt prefix, so moving per-run lines above REGIME_CONTEXT would make every run pay for it.
import { MARKET_SENTENCE_LABEL } from './market-analysis-validate.mjs';
import { readNumber } from '../../src/domain/shared/number.js';

const signed = (value) => `${readNumber(value) >= 0 ? '+' : ''}${value}`;

/** INFLATION_DIRECTION: the CPI direction stated so "물가 둔화" is not inferred from falling yields ('' without CPI data). */
export function inflationDirectionLine(macroNow = {}) {
  // A missing CPI field (null, '') is missing, not 0 (Number(null) === 0 printed "근원 null%" before v59.59).
  const has = (value) => readNumber(value) != null;
  if (!has(macroNow.cpi) || !has(macroNow.cpiDelta)) return '';
  const core = has(macroNow.coreCpi) ? `, 근원 ${macroNow.coreCpi}%${has(macroNow.coreCpiDelta) ? ` (${signed(macroNow.coreCpiDelta)}%p)` : ''}` : '';
  return `INFLATION_DIRECTION: 미국 CPI 전년비 ${macroNow.cpi}% (직전 달 대비 ${signed(macroNow.cpiDelta)}%p)${core}, 기준월 ${String(macroNow._asOf_cpi || '').slice(0, 7) || '미확인'}. `
    + (readNumber(macroNow.cpiDelta) > 0 || readNumber(macroNow.coreCpiDelta) > 0 ? '물가는 오르는 중이다 — "물가 둔화"라고 쓰지 마라.' : '물가 방향을 이 값 밖에서 추정하지 마라.');
}

/**
 * The prompt's sections in order, as [id, text]; an absent optional block is null. `drivers` is always present (an
 * empty MARKET_DRIVERS still takes its place, as before).
 */
export function marketAnalysisPromptSections({ inflationLine = '', regimeContext = '', evidenceLines = '', koreaIntradayLines = '', intradayLines = '', usCloseAt = null,
  afterHoursLines = '', earningsLines = '', cashflowLines = '', crossMarketIntradayLines = '', newsLines = '', headlineLines = '', driversContext = '',
  narrativeText = '', largeMove = false, largeMoveDirection = null } = {}) {
  return [
  ['task', '아래 근거로 시장 해석을 반드시 한국어로만 작성하라(영어 문장 금지). 제목·마크다운 헤더 없이 7~9줄 평문으로 쓴다. Write the whole answer in Korean.'],
  ['order', '순서: (1) MARKET_DRIVERS의 압력·지금 두 칸 — 무엇이 얼마나 바뀌었고(완료 종가는 날짜 M/D와 METRIC_EVIDENCE·REGIME_CONTEXT의 change 값, 장중 값은 "장중 HH:MM KST") 그 움직임마다 보도된 이유가 무엇인가(이유마다 헤드라인 날짜·출처) (2) 그 변화가 REGIME_CONTEXT의 어느 축·흐름과 맞물리는가 (3) 지금 조건에 가장 가까운 흐름 — 반드시 흐름·시나리오 이름과 함께("「이름」 — 조건 충족 n/m"), 숫자만 단독으로 쓰지 않는다. 단 REGIME_CONTEXT의 판정 문장이 "어느 흐름이라고 보기 이릅니다"·"중심 시나리오를 정하지 않습니다"라고 하면(시나리오 설명 속 "…라고 보기 이릅니다"는 판정이 아니다) 그 판정을 먼저 그대로 쓰고, 가장 많이 맞는 흐름은 "핵심 조건 미충족"과 함께만 언급하며 그 흐름을 결론처럼 쓰지 않는다 (4) 향후 시나리오: REGIME_CONTEXT의 【향후 시나리오】에서 다음 발표(날짜)과 조건이 가장 많이 맞는 시나리오, 시장 가격이 같은 방향인지, 금리 괴리가 있으면 그 뜻 — 인과(무엇이 무엇을 거쳐 주가에 닿는지)를 한 문장으로 (5) 그 시나리오라면 선택지(관망·분할 접근·보유 유지·방어 전환)별 기회비용과 상대적으로 유리한 쪽(중심 시나리오가 없으면 "유리한 쪽"을 정하지 말고 각 시나리오로 갈 때 무엇이 바뀌는지만), 반대 시나리오로 가면 무엇이 바뀌는지, 【테마 시나리오】가 있으면 그 시나리오에서 수혜·부담인 테마와 추세 속 조정 테마를 한 문장으로 (6) MARKET_DRIVERS의 확인·반증 칸: 다음에 확인할 것(일정 포함)과 이 해석이 틀렸다고 볼 반증 조건. 지표를 나열만 하거나 "두 지표는 서로 다르다"처럼 정보가 없는 문장은 쓰지 마라.'],
  ['conduct', '가격·수량·시점·특정 종목 매매 지시(사라/팔아라, 목표가, "비중을 늘리세요" 같은 명령)는 쓰지 않는다. 대신 시나리오별 선택지의 기회비용과 "이 시나리오라면 상대적으로 유리한 쪽"은 REGIME_CONTEXT 근거로 쓴다(소유자 2026-10-13). 가능성은 조건 충족 n/m · 시장 가격 방향 · 과거 빈도(표본 수와 함께)로만 말하고 %·확률 숫자를 만들지 마라. 세부 종목 선택은 사용자가 차트·기업·테마·스크리너에서 한다고 밝혀도 된다.'],
  ['changeFormat', '각 변화율은 반드시 그 지표 이름 바로 뒤에 쓴다(예: "코스피 -1.2%"). 다른 지표의 변화율을 앞 지표 이름에 붙이지 마라. 금리(10Y)의 변화는 bp로만 쓰고 %로 쓰지 마라(금리 수준만 % 단위).'],
  ['sessionWording', 'METRIC_EVIDENCE에는 완료된 종가만 들어 있다. 장중 값은 KOREA_LARGE_INTRADAY_MOVE·CROSS_MARKET_INTRADAY·MARKET_DRIVERS에 적힌 것만 쓴다. 장중 값을 언급하면 "장중"과 관측 시각(예: 13:05 KST)을 같은 문장에 쓰고 "마감·종가"라고 쓰지 마라.'],
  ['evidenceIds', 'Every numeric claim must be supported by one or more supplied METRIC_EVIDENCE ids.'],
  ['vixFearGreed', 'Do not treat VIX and Fear&Greed as the same metric, and do not spend a sentence saying they differ. Do not invent missing values. Return 7-9 concise lines.'],
  // v58.74 (text audit A5): the reading kept "-다" lines beside "-습니다" ones and ran clauses together with semicolons.
  // Outlets stay named when a reported cause is cited (the reader can check it), but never inside a number's own clause.
  ['style', '문체: 모든 문장을 "-습니다/-입니다"로 끝낸다. 한 문장에는 한 생각만 담고 쉼표는 세 개 이하, 세미콜론은 쓰지 않는다. 보도된 이유를 인용할 때 매체 이름은 "M/D 매체 보도에 따르면"처럼 문장 앞에 한 번만 쓰고, 지표 이름과 변화율 사이에는 넣지 않는다.'],
  // v57.75: the CPI direction is stated so the model does not infer "물가 둔화" from falling yields (blocked, then retried).
  ['inflation', inflationLine ? inflationLine : null],
  ['regime', 'REGIME_CONTEXT (deterministic reading from the same completed closes the site shows; cite as [regime-context]):\n' + (regimeContext || 'none')],
  ['metricEvidence', 'METRIC_EVIDENCE:\n' + evidenceLines],
  ['koreaIntraday', koreaIntradayLines ? 'KOREA_LARGE_INTRADAY_MOVE (장중 지연 값 — 반드시 한 줄로 언급하라: "코스피 장중 HH:MM KST 기준 -x.xx%"처럼 장중과 시각을 같은 문장에 쓰고 마감·종가라고 쓰지 마라. ' + (intradayLines
    // v57.75 (crash audit): HEADLINE_CONTEXT is the 08:00 bundle, written before the Korean session — on 10/15 the model
    // pinned a −7.8% intraday drop on those older headlines and called the won "강세" while USD/KRW rose. The cause may
    // only come from post-08:00 headlines; without them the line says the cause headline was not collected.
    // 2026-10-21: the overnight drivers of the +4.48% rebound (WSJ "Stocks Make a U-Turn…" 05:18 KST, SpaceX capex
    // 07:33 KST) came after the US close but before 08:00; headlines after the US close count, the day before's do not.
    ? `원인은 아래 "08:00 이후 장중 속보(잠정)" 헤드라인(잠정이라고 표시)이나 직전 미국 장 마감(${usCloseAt || '미국 종가 시각'}) 뒤에 나온 HEADLINE_CONTEXT 헤드라인에만 귀속하라. 그보다 이전 헤드라인을 장중 움직임의 원인으로 쓰지 마라`
    : '08:00 이후 장중 헤드라인이 없다. 원인을 추정하지 말고 "장중 원인 헤드라인 미수집"이라고 쓴다') + '. 원화 방향은 USD/KRW 값으로만 판단한다(USD/KRW 상승 = 원화 약세)):\n' + koreaIntradayLines : null],
  ['afterHours', afterHoursLines ? 'US_AFTER_HOURS (직전 미국 정규장 마감 뒤 장 마감 후 실적 발표 종목의 시간외 지연 값, 잠정. 크게 움직인 종목이 반도체·대형 기술주·한국 관련 업종과 닿으면 한 줄로 쓴다: "CDNS 10/26 시간외 19:55 ET 기준 +2.40%(잠정)"처럼 시간외·ET 시각·잠정을 같은 문장에 쓰고 마감·종가라고 쓰지 마라. 이유는 실적 수치와 HEADLINE_CONTEXT 헤드라인에만 귀속하라):\n' + afterHoursLines : null],
  // v59.56: what the night's reports said, from the filings — the first thing every bookmarked author led with on 10/30.
  ['earnings', earningsLines ? 'US_EARNINGS (직전 미국 종가까지의 실적 발표 반응. 수치·전망은 SEC 원문에서 확인된 값, "보도된 이유"는 보도 기반. 쓰는 법: (a) 지수·반도체·업종의 큰 움직임을 설명할 때 HEADLINE_CONTEXT의 일반론("AI 수익성 회의론")보다 이 사실을 먼저 쓴다: 어느 회사의 무엇(매출·설비투자·현금흐름·다음 분기 전망)이 기대와 어떻게 달랐고 종가가 얼마였는지 (b) 숫자는 이 블록에 있는 값만, 종목 이름과 M/D 날짜를 같은 문장에 쓴다 (c) "보도된 이유"는 "…보도에 따르면"으로 귀속하고 단정하지 않는다 (d) 여러 보고가 같은 고리(예: 빅테크 설비투자 → 공급망 전망)로 이어지면 그 고리를 한 문장으로 잇되, 연결은 해석이라고 밝힌다 (e) 발표 후 누적 반응은 "발표 후 n거래일 누적"이라고 쓴다):\n' + earningsLines : null],
  // v59.56: the cash side the 10/30 authors led with (Amazon TTM FCF, big-tech capex ÷ operating cash flow).
  ['cashflow', cashflowLines ? 'BIGTECH_CASHFLOW (SEC 10-Q/10-K 현금흐름표에서 분기로 차감해 합친 최근 4분기 값. 설비투자는 유형자산 취득 총액이라 회사가 발표한 잉여현금흐름 정의와 다를 수 있다. 쓰는 법: AI·반도체·빅테크 움직임이나 위 US_EARNINGS의 설비투자·현금흐름을 설명할 때만 쓴다. 숫자는 이 블록 표기 그대로($xx.xB, %) 쓰고 "SEC 공시 기준 최근 4분기"라고 밝힌다. 설비투자 ÷ 영업현금흐름이 높을수록 투자를 내부 현금으로 감당할 여유가 적다는 뜻이며, 그 해석이 차입·신용으로 이어진다는 말은 해석이라고 밝힌다):\n' + cashflowLines : null],
  ['crossMarketIntraday', crossMarketIntradayLines ? 'CROSS_MARKET_INTRADAY (미국 지수 선물·아시아 지수의 장중 지연 값. 한국 장이나 미국 장의 움직임을 설명할 때 반도체(SMH)·선물·아시아가 같은 방향으로 움직였다면 근거로 함께 쓴다. 쓰면 "나스닥 100 선물 장중 HH:MM KST 기준 +x.xx%"처럼 장중과 시각을 같은 문장에 쓰고 마감·종가라고 쓰지 마라):\n' + crossMarketIntradayLines : null],
  ['newsClusters', 'NEWS_CLUSTERS (article-level evidence, may be absent):\n' + (newsLines || 'none')],
  ['headlines', 'HEADLINE_CONTEXT (retained headlines — titles only; these are the only news material available):\n' + (headlineLines || 'none')
    + (intradayLines ? '\n08:00 이후 장중 속보(잠정 — 다음 08:00 묶음 전의 미확정 헤드라인, 인용 시 "잠정"으로 표시):\n' + intradayLines : '')],
  ['drivers', driversContext],
  // Owner 2026-10-18: the stories the 08:00 bundle missed (AI funding, memory, deleveraging …) from AIO's own Telegram
  // digest and mover headlines, with the analysis note that says how to read each. Weighting, not evidence.
  ['narrative', narrativeText ? 'NARRATIVE_CONTEXT (지난 72시간 2차 자료: 리서치 텔레그램 채널 중계와 5거래일 급등락 종목의 헤드라인. 사실 확정이 아니라 지금 시장이 어떤 이야기에 무게를 두는지 보여 주는 참고다. 쓰는 법: (a) 오늘의 긴장과 (2)~(6)의 주제를 고를 때 HEADLINE_CONTEXT의 건수만 보지 말고 REGIME_CONTEXT의 움직임 크기와 여기의 언급 비중을 함께 본다 (b) 인용하면 "리서치 채널 중계에 따르면"·"…보도에 따르면"으로 귀속하고 한 가지 해석으로 제시한다 (c) [루머]·[미확인·익명 소식통] 항목은 같은 문장에 "루머" 또는 "미확인"을 쓰고 원인으로 단정하지 않는다 (d) 여기의 숫자·종목명·티커는 METRIC_EVIDENCE가 아니므로 쓰지 않는다 (e) 같은 주제에 강세 측 반론이 있으면 함께 적어 한쪽으로 기울지 않는다 (f) "읽는 틀"은 그 주제를 확인하는 순서다 — 다음에 확인할 것(6)에 활용한다):\n' + narrativeText : null],
  // v58.74 (audit 10/24): the reading dated a 10/23 04:14 GMT Reuters gold headline "같은 날(10/24)", stated '물가 재가속'
  // (1/4 conditions) as a fact, and repeated "Treasury haven" on a day the 10-year rose 4bp.
  ['datesAndScenarios', 'DATES_AND_SCENARIOS: 헤드라인을 인용할 때 날짜는 그 줄의 date= 값만 쓴다. 시나리오 이름(물가 재가속·AI 투자 꺾임 등)은 사실로 쓰지 말고 "…시나리오 조건 n/m"처럼 충족 수와 함께만 쓴다. 헤드라인이 말하는 방향(예: 국채 선호)이 같은 날 종가(예: 10년물 금리 상승)와 반대이면 그 차이를 함께 쓴다.'],
  ['directional', 'DIRECTIONAL/CAUSAL PROSE: you may offer a directional or causal reading, but attribute it to the named headline ("헤드라인에 따르면", "According to <source>") and present it as one reading among alternatives, never as a confirmed fact. End with what would invalidate the reading and what the reader should check. The final decision belongs to the reader, not to this text.'],
  ['largeMove', largeMove ? 'LARGE_MOVE (S&P 500 1% 이상 또는 코스피 3% 이상): 보도된 배경을 반드시 한 문장으로 쓴다 — "헤드라인에 따르면 …이 배경으로 거론됐다"처럼 HEADLINE_CONTEXT(장중 움직임이면 08:00 이후 장중 속보) 헤드라인 하나를 이름과 함께 든다. 그 문장 안에서 "단정할 수 없다·확인되지 않았다"로 귀속을 지우지 말고, 다른 해석이 있다는 점은 다음 문장에 쓴다.' : null],
  // v57.71 (owner 2026-10-15): the home's one-sentence line, written by the same call (no extra request).
  ['sentence', `마지막에 7~9줄과 별도로 한 줄을 더 쓴다: "${MARKET_SENTENCE_LABEL} " 뒤에 지금 시장을 관통하는 긴장을 대비로 담은 서술문 한 문장(40자 안팎). 질문으로 쓰지 않는다(물음표, '~인가'·'~일까'·'~까' 같은 의문 어미 없이). 숫자·%·종목명·지수명·티커·매매 지시 없이(영문 약어는 AI만 쓴다, 예: HBM·D램 대신 메모리), 오늘의 근거(METRIC_EVIDENCE·HEADLINE_CONTEXT·REGIME_CONTEXT)에서 나온 갈림을 담는다. 갈림의 주제는 REGIME_CONTEXT에서 가장 크게 움직였거나 판정이 바뀐 영역(예: 반도체·AI 주도주 급락, 신용 확대, 유가)에서 고르고, 헤드라인이 많다는 이유만으로 고르지 않는다. ${largeMoveDirection === 'down' ? '오늘은 큰 하락이 마감됐다: 긴장은 그 하락(반등 실패·재하락·낙폭 확대 중 사실에 맞는 것)에서 출발하고, 하락이라는 사실을 문장 안에 쓴다. 소진·바닥·회복만으로 짜인 문장은 쓰지 않는다.' : largeMoveDirection === 'up' ? '오늘은 큰 상승이 마감됐다: 긴장은 그 반등·상승에서 출발하고, 상승이라는 사실을 문장 안에 쓴다.' : largeMoveDirection === 'mixed' ? '오늘은 미국과 한국 장이 엇갈렸다(한쪽의 큰 움직임 뒤 다른 쪽이 반대로 마감): 긴장은 그 엇갈림에서 출발한다. 하락만 또는 상승만 쓰지 말고, 두 방향을 함께 담거나 방향 대신 그 사이의 갈림(무엇이 이어질지)을 서술문으로 쓴다.' : '큰 움직임이 없는 날에만, 바닥 확인 조건이 있으면 그 갈림(소진 대 확인)을 담아도 된다.'} 문체 예시(그대로 쓰지 말 것): "오늘의 하락은 기회와 서사의 끝 사이에 놓여 있다." / "누군가는 이날을 기다렸고, 누군가는 이날을 기점으로 떠날 것이다."`],
  ];
}

export function buildMarketAnalysisPrompt(packet) {
  return marketAnalysisPromptSections(packet).filter(([, text]) => text != null).map(([, text]) => text).join('\n\n');
}

/** Character size of each present section — for the prompt-size receipt and the gate, never the text itself. */
export function marketAnalysisPromptSizes(packet) {
  return Object.fromEntries(marketAnalysisPromptSections(packet).filter(([, text]) => text != null).map(([id, text]) => [id, text.length]));
}

// P1719: one retry with the validator's reasons appended to the same prompt (the unchanged prefix stays cacheable).
export function buildMarketAnalysisRetryPrompt(prompt, issueText) {
  return prompt + '\n\nPREVIOUS_ATTEMPT_REJECTED (자동 검증기가 직전 답을 아래 이유로 차단했다. 같은 오류 없이 처음부터 다시 쓴다. 날짜·시각 숫자를 지표 이름 바로 뒤에 두지 말고, 지표 수준·변화는 METRIC_EVIDENCE 값만 쓴다):\n'
    + issueText;
}
