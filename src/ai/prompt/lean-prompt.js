// The system prompt of every chat turn (js/aio-chat.js chatSendUnified). It carries what the reader is looking at and the
// rows of the stocks the question names; everything else (technicals, filings, news, sector and theme flow, macro
// releases, reference frameworks) the model asks for through the data tools, which travel with every turn. Measured on
// the live site before this module: a two-stock return comparison was sent 60K characters of instructions, most of it
// reference material and rule blocks from earlier releases.
import { formatScreenResult, runScreen, screenerInput, SCREEN_SYMBOL_LIMIT } from '../context/screener-query.js';

const ROLE_LINES = Object.freeze([
  '역할: AIO Screener의 투자 리서치 도우미. 독자는 개인 투자자이고 한국어로 묻는다.',
  '범위: 투자·시장·경제·기업과 이 앱의 사용에 관한 질문에만 답한다. 그 밖의 질문(날씨, 요리, 일반 잡담 등)에는 도구와 검색을 쓰지 않고, 범위 밖이라는 것과 여기서 물을 수 있는 것(시장 상태, 돈의 흐름, 조건 검색, 종목, 내 보유 종목)을 두 문장 이내로 알린다.',
  '수치: 현재 수치는 아래 자료, 도구 결과, 인용한 웹 출처에 있는 것만 쓰고 기준일을 붙인다("11월 20일 종가"). 화면 수치는 직전 확정 종가 기준이다. 자료에 없는 현재 수치는 기억으로 채우지 않는다.',
  '판단: 질문에 바로 답하고, 관측한 사실과 그 해석을 구분한다. 판단이 바뀌는 조건을 함께 말한다.',
  '판단 틀: 전망·대응·매매 판단은 하나의 예측이 아니라 시나리오로 답한다. 시나리오마다 가능성(근거와 함께 말로), 맞았을 때의 이익과 틀렸을 때의 손실 폭, 기다리는 쪽(현금)의 기회비용, 판단을 버릴 신호를 말한다. 아래에 시나리오·판단 틀 자료가 있거나 도구가 돌려주면 그 자료를 쓰고, 과거 빈도는 표본 수와 함께 쓴다.',
  '행동: 특정 가격·수량·시점을 정해 사라·팔라고 지시하지 않는다. 어떤 조건에서 무엇을 검토하는지(분할 매수 구간, 비중 조절을 검토할 신호 등)는 조건부로 말한다. 확률 숫자는 근거 자료가 있을 때만 쓴다.',
  '표현: 쉬운 한국어로 쓴다. 도구 이름, 내부 식별자, 자료 제공자 이름은 답에 쓰지 않는다. 웹에서 찾은 내용은 출처 링크와 발행일을 붙인다.'
]);

/** The screener rows of the stocks a question names, as the screen tool prints them ('' when none is in the stock DB). */
export function namedStockRows(root, tickers, { now = Date.now() } = {}) {
  const symbols = (Array.isArray(tickers) ? tickers : []).map((sym) => String(sym || '').toUpperCase()).filter(Boolean).slice(0, SCREEN_SYMBOL_LIMIT);
  if (!symbols.length) return '';
  const result = runScreen({ symbols }, screenerInput(root, { now }));
  if (!result.matched || !result.rows.length) return '';
  // The rows only: the screen result's own heading and its list instruction ("목록 밖 종목을 더하지 말고") are about a
  // condition search, and these stocks were named by the reader.
  return formatScreenResult(result).split('\n').filter((line) => !/^(?:【스크리너 조건 검색|답변 지침:)/.test(line)).join('\n').trim();
}

/**
 * { prompt, stockRows }: `stockRows` is true when the named stocks' rows are in the prompt (their returns, RSI and
 * 52-week position stand for the trend line). `screenBasis` is the screen's own close-basis reading, `profile` the
 * reader's saved profile block.
 */
export function composeLeanPrompt({ root = globalThis, screenTitle = '', tickers = [], screenBasis = '', profile = '', now = Date.now() } = {}) {
  const rows = namedStockRows(root, tickers, { now });
  const parts = [ROLE_LINES.join('\n')];
  if (screenTitle) parts.push(`독자가 보고 있는 화면: ${screenTitle}`);
  if (profile) parts.push(String(profile).trim());
  if (screenBasis) parts.push(`【화면의 시장 판정과 확정 종가 — 독자가 보는 값과 같다】\n${String(screenBasis).trim()}`);
  if (rows) parts.push(`【질문에 나온 종목 — 종목 화면·스크리너 표와 같은 행】\n${rows}`);
  return { prompt: `${parts.join('\n\n')}\n`, stockRows: !!rows };
}
