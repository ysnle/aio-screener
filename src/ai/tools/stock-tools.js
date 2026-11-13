// Chat tools about one listed company. Each wraps a reader the screens already use; none computes anything new.
// A tool returns { text, asOf, entities } or { error } (the registry turns both into the model's tool output).
import { loadCompletedDailyBars } from '../../data/daily-chart-bars.js';
import { chatTechnicalBlock } from '../context/technical-lines.js';
import { chatStockTrendLine, screenRowFor } from '../context/stock-trend-line.js';
import { companyProfileEntry, companyStoryFor, requestCompanyStory } from '../../data/company-profiles.js';
import { consensusRowFor, requestConsensusEstimates, CONSENSUS_KEY } from '../../data/consensus-estimates.js';
import { COMPANY_PROFILE_INDEX } from '../../data/artifact-registry.js';
import { buildConsensusPoint } from '../../domain/fundamental/consensus-read.js';
import { formatScreenerPrice } from '../../domain/screener/market-scope.js';
import { readNumber } from '../../domain/shared/number.js';
import { isoDay, stampDay as day } from '../../domain/shared/session-date.js';
import { isKrSymbol, resolveToolSymbol, symbolLabel, unknownSymbolText } from './symbol.js';

const SYMBOL = { type: 'string', description: '티커(예: NVDA, 005930.KS) 또는 화면에 등록된 회사 이름' };
const objectSchema = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const clampInt = (value, min, max, fallback) => { const number = readNumber(value); return number == null ? fallback : Math.min(max, Math.max(min, Math.round(number))); };

function waitFor(start, ms) {
  let timer = null;
  return new Promise((resolve) => {
    timer = setTimeout(resolve, ms);
    try { start(resolve); } catch (_) { resolve(); }
  }).finally(() => clearTimeout(timer));
}

const priceHistory = {
  name: 'price_history',
  description: '한 종목의 완료된 일봉(종가·고가·저가)을 최근 sessions 거래일만큼 돌려준다. sessions는 5~120. 진행 중인 오늘 봉은 빠진다.',
  parameters: objectSchema({ symbol: SYMBOL, sessions: { type: 'integer', description: '최근 거래일 수(5~120)' } }),
  maxChars: 6000,
  label: (args, root) => `${symbolLabel(root, resolveToolSymbol(root, args?.symbol) || args?.symbol)} 가격 기록`,
  async run({ symbol, sessions }, { root, signal }) {
    const sym = resolveToolSymbol(root, symbol);
    if (!sym) return { error: unknownSymbolText(symbol) };
    const count = clampInt(sessions, 5, 120, 60);
    const data = await loadCompletedDailyBars(root, sym, { signal });
    const bars = (data?.bars || []).slice(-count);
    if (!bars.length) return { error: `${sym}의 완료된 일봉을 받지 못했습니다.` };
    const currency = isKrSymbol(sym) ? 'KRW' : data?.payload?.meta?.currency || null;
    const price = (value) => formatScreenerPrice(value, currency);
    const lines = bars.map((bar) => `${bar.time} 종가 ${price(bar.close)} (고 ${price(bar.high)} · 저 ${price(bar.low)})`);
    return { text: `【${sym} 완료된 일봉 ${bars.length}거래일】\n${lines.join('\n')}`, asOf: `${bars.at(-1).time} 종가`, entities: [sym] };
  }
};

const technicals = {
  name: 'technicals',
  description: '최대 세 종목의 차트 화면 기술 판정(이동평균·RSI·추세 읽기·전환 조건)을 완료된 일봉으로 돌려준다.',
  parameters: objectSchema({ symbols: { type: 'array', items: SYMBOL, description: '종목 1~3개' } }),
  maxChars: 6000,
  label: (args, root) => `${(Array.isArray(args?.symbols) ? args.symbols : []).slice(0, 3).map((raw) => symbolLabel(root, resolveToolSymbol(root, raw) || raw)).join('·')} 차트 지표`,
  async run({ symbols }, { root, signal }) {
    const asked = (Array.isArray(symbols) ? symbols : []).slice(0, 3);
    const known = asked.map((raw) => resolveToolSymbol(root, raw)).filter(Boolean);
    const unknown = asked.filter((raw) => !resolveToolSymbol(root, raw));
    if (!known.length) return { error: unknownSymbolText(asked.join(', ')) };
    const block = String(await chatTechnicalBlock([...new Set(known)], { root, signal }) || '').trim();
    // The block states each symbol's last completed close as "• 종가 <price> (<day>, …"; a held block has none.
    const dates = [...block.matchAll(/• 종가 [^(\n]*\(([^,)\n]+)/g)].map((match) => isoDay(match[1].trim())).filter(Boolean).sort();
    if (!block || !dates.length) return { error: `${known.join(', ')}의 차트 일봉을 받지 못해 기술 지표를 계산하지 않았습니다.` };
    return { text: block + (unknown.length ? `\n${unknownSymbolText(unknown.join(', '))}` : ''), asOf: `${dates.at(-1)} 종가`, entities: known };
  }
};

const trend = {
  name: 'trend',
  description: '한 종목의 주가 추이 한 줄(50·200일선 추세, 5거래일·1개월·3개월 수익률, 52주 범위 위치, RSI)을 종목 화면과 같은 값으로 돌려준다.',
  parameters: objectSchema({ symbol: SYMBOL }),
  label: (args, root) => `${symbolLabel(root, resolveToolSymbol(root, args?.symbol) || args?.symbol)} 주가 추이`,
  async run({ symbol }, { root }) {
    const sym = resolveToolSymbol(root, symbol);
    if (!sym) return { error: unknownSymbolText(symbol) };
    const line = await chatStockTrendLine(sym, { root, timeoutMs: 6000 });
    const session = day(screenRowFor(root, sym)?.row?.factorSessionDate);
    if (!line || !session) return { error: `${sym}의 주가 추이 자료가 없습니다(종목 화면에도 추세가 표시되지 않는 종목).` };
    return { text: `[주가 추이] ${sym}: ${line}`, asOf: `${session} 종가`, entities: [sym] };
  }
};

const fundamentals = {
  name: 'fundamentals',
  description: '미국 상장 종목의 공용 SEC 연간 공시 재무(매출·이익·현금·부채 등 공시된 항목만)를 돌려준다. 한국 종목은 없다.',
  parameters: objectSchema({ symbol: SYMBOL }),
  label: (args, root) => `${symbolLabel(root, resolveToolSymbol(root, args?.symbol) || args?.symbol)} 재무`,
  async run({ symbol }, { root, now }) {
    const sym = resolveToolSymbol(root, symbol);
    if (!sym) return { error: unknownSymbolText(symbol) };
    if (isKrSymbol(sym)) return { error: `${sym}: 공용 SEC 공시 재무는 미국 상장 종목에만 있습니다.` };
    // The stock screen's SEC reader and formatter (src/app/bootstrap.js, compatibility-globals.js), as the chat's deep block reads them.
    if (typeof root?.AIO?.readPublicFundamentals !== 'function' || typeof root?.AIO?.formatSecResearchEvidence !== 'function') return { error: '공시 재무 자료를 읽을 수 없습니다.' };
    const record = (await root.AIO.readPublicFundamentals([sym]))?.[sym] || null;
    const text = record ? root.AIO.formatSecResearchEvidence(record, now) : '';
    const filed = day(record?.filedAt) || day(record?.acceptedAt) || day(record?.availableAt);
    if (!text || !filed) return { error: `${sym}의 현재 공용 SEC 연간 재무 자료가 없습니다.` };
    return { text: text.trim(), asOf: `SEC 공시 ${filed}`, entities: [sym] };
  }
};

const companyStory = {
  name: 'company_story',
  description: '한 종목의 조사된 기업 분석(사업 구조·경쟁·논쟁점)을 종목 화면과 같은 글로 돌려준다. 조사된 종목만 있다.',
  parameters: objectSchema({ symbol: SYMBOL }),
  label: (args, root) => `${symbolLabel(root, resolveToolSymbol(root, args?.symbol) || args?.symbol)} 기업 분석`,
  async run({ symbol }, { root }) {
    const sym = resolveToolSymbol(root, symbol);
    if (!sym) return { error: unknownSymbolText(symbol) };
    if (!companyStoryFor(root, sym) && !(root?.[COMPANY_PROFILE_INDEX.key] && !companyProfileEntry(root, sym))) {
      await waitFor((done) => requestCompanyStory(root, sym, done), 5000);
    }
    const story = companyStoryFor(root, sym);
    const text = String(root?.__aioCompanyStories?.context?.[sym] || '').trim();
    const researched = day(story?.researchedAt);
    if (!story || !text || !researched) return { error: `${sym}의 조사된 기업 분석이 없습니다.` };
    return { text, asOf: `조사 ${researched}`, entities: [sym] };
  }
};

const consensus = {
  name: 'consensus',
  description: '미국 상장 종목의 애널리스트 컨센서스(향후 4개 분기 예상 EPS, Forward PER, 최근 4주 추정치 변경)를 종목 화면과 같은 글로 돌려준다.',
  parameters: objectSchema({ symbol: SYMBOL }),
  label: (args, root) => `${symbolLabel(root, resolveToolSymbol(root, args?.symbol) || args?.symbol)} 시장 예상치`,
  async run({ symbol }, { root, now }) {
    const sym = resolveToolSymbol(root, symbol);
    if (!sym) return { error: unknownSymbolText(symbol) };
    if (isKrSymbol(sym)) return { error: `${sym}: 컨센서스 자료는 미국 상장 종목에만 있습니다.` };
    if (!root?.[CONSENSUS_KEY]) await requestConsensusEstimates(root);
    const point = buildConsensusPoint(screenRowFor(root, sym)?.row || null, consensusRowFor(root, sym), { now });
    if (!point?.text || !day(point.asOf)) return { error: `${sym}의 현재 컨센서스 자료가 없습니다(수집되지 않았거나 오래됨).` };
    return { text: `${sym} ${point.title}: ${point.text}`, asOf: `예상치 수집 ${day(point.asOf)}`, entities: [sym] };
  }
};

export const STOCK_TOOLS = [priceHistory, technicals, trend, fundamentals, companyStory, consensus];
